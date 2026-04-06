"""
Skill Loader — loads and validates skills from the filesystem.

Mirrors: packages/core/src/core/skill-loader.ts

Implements agentskills.io specification with proper YAML parsing and
Pydantic validation.
"""
from __future__ import annotations

import logging
import re
from pathlib import Path

import yaml

from matimo.core.models import (
    BundledResources,
    ParsedSkill,
    SkillDefinition,
    SkillFrontmatter,
    SkillSummary,
)
from matimo.core.skill_content_parser import parse_skill_sections
from matimo.errors import ErrorCode, MatimoError

logger = logging.getLogger("matimo")

# ---------------------------------------------------------------------------
# Name validation
# ---------------------------------------------------------------------------

_VALID_NAME_RE = re.compile(r"^[a-z0-9]([a-z0-9-]*[a-z0-9])?$")
_CONSECUTIVE_HYPHENS_RE = re.compile(r"--")
_MAX_NAME_LENGTH = 64


def _validate_skill_name(name: str) -> str | None:
    """Return error string or None if valid."""
    if not name or not name.strip():
        return "Skill name is required"
    if len(name) > _MAX_NAME_LENGTH:
        return f"Skill name must be at most {_MAX_NAME_LENGTH} characters"
    if not _VALID_NAME_RE.match(name):
        return (
            "Skill name must contain only lowercase letters, numbers, and hyphens, "
            "and must not start or end with a hyphen"
        )
    if _CONSECUTIVE_HYPHENS_RE.search(name):
        return "Skill name must not contain consecutive hyphens"
    return None


# ---------------------------------------------------------------------------
# Frontmatter extraction
# ---------------------------------------------------------------------------


def _extract_frontmatter(
    content: str,
) -> tuple[SkillFrontmatter | None, str | None, str | None]:
    """
    Extract and validate YAML frontmatter from SKILL.md content.

    Returns ``(frontmatter, body, error)``.
    """
    if not content or not content.startswith("---"):
        return None, None, "Skill content must start with YAML frontmatter (---)"

    end_idx = content.index("---", 3) if "---" in content[3:] else -1
    if end_idx == -1:
        return None, None, "Skill content must have closing YAML frontmatter (---)"
    # Adjust because we searched from position 3
    end_idx = content.index("---", 3)

    fm_block = content[3:end_idx].strip()
    body = content[end_idx + 3 :].strip()

    try:
        parsed = yaml.safe_load(fm_block) or {}
    except yaml.YAMLError as exc:
        return None, None, f"Failed to parse YAML frontmatter: {exc}"

    if not isinstance(parsed, dict):
        return None, None, "Frontmatter must be a YAML mapping"

    # Normalise allowed-tools: space-delimited string → list
    at = parsed.get("allowed-tools")
    if isinstance(at, str):
        parsed["allowed-tools"] = at.split()

    # Validate required fields
    if not parsed.get("name"):
        return None, None, "Frontmatter validation failed: name is required"
    if not parsed.get("description"):
        return None, None, "Frontmatter validation failed: description is required"

    try:
        frontmatter = SkillFrontmatter.model_validate(parsed)
    except Exception as exc:
        return None, None, f"Frontmatter validation failed: {exc}"

    return frontmatter, body, None


# ---------------------------------------------------------------------------
# Public helpers
# ---------------------------------------------------------------------------


def parse_skill_content(content: str) -> ParsedSkill:
    """Parse YAML frontmatter from SKILL.md content."""
    frontmatter, body, error = _extract_frontmatter(content)

    if error:
        # Return a best-effort result
        fallback_body = ""
        idx = content.find("---", 3)
        if idx != -1:
            fallback_body = content[idx + 3 :].strip()
        return ParsedSkill(
            frontmatter=SkillFrontmatter(name="", description=""),
            body=fallback_body,
            raw=content,
        )

    assert frontmatter is not None
    assert body is not None

    parsed_content = parse_skill_sections(body)

    return ParsedSkill(
        frontmatter=frontmatter,
        body=body,
        raw=content,
        sections=parsed_content.sections,
        total_tokens=parsed_content.total_tokens,
    )


def extract_skill_metadata(
    content: str,
    source: str = "user",
) -> tuple[bool, SkillSummary | None, str | None]:
    """
    Extract ONLY metadata from SKILL.md without parsing body/sections.

    Optimised for listing skills — reads YAML frontmatter only.
    Returns ``(success, summary, error)``.
    """
    frontmatter, _, error = _extract_frontmatter(content)
    if error:
        return False, None, error

    assert frontmatter is not None
    return (
        True,
        SkillSummary(
            name=frontmatter.name,
            description=frontmatter.description,
            version=frontmatter.version,
            license=frontmatter.license,
            metadata=frontmatter.metadata,
            source=source,  # type: ignore[arg-type]
        ),
        None,
    )


# ---------------------------------------------------------------------------
# Bundled resources
# ---------------------------------------------------------------------------

_KNOWN_DIRS: dict[str, str] = {
    "scripts": "scripts",
    "references": "references",
    "assets": "assets",
}


def _list_bundled_resources(skill_dir: Path) -> BundledResources:
    resources = BundledResources()
    if not skill_dir.is_dir():
        return resources

    for entry in skill_dir.iterdir():
        if entry.name == "SKILL.md":
            continue

        if entry.is_dir():
            category = _KNOWN_DIRS.get(entry.name)
            sub_entries = [f.name for f in entry.iterdir() if not f.name.startswith(".")]
            items = [f"{entry.name}/{s}" for s in sub_entries]
            if category:
                getattr(resources, category).extend(items)
            else:
                resources.other.extend(items)
        else:
            resources.other.append(entry.name)

    return resources


# ---------------------------------------------------------------------------
# SkillLoader
# ---------------------------------------------------------------------------


class SkillLoader:
    """Reads and validates skills from directories."""

    def load_skills_from_directory(
        self,
        skills_dir: str,
        source: str = "user",
    ) -> list[SkillDefinition]:
        """Load all skills from a directory."""
        skills: list[SkillDefinition] = []
        skills_path = Path(skills_dir)

        if not skills_path.is_dir():
            return skills

        for entry in skills_path.iterdir():
            if not entry.is_dir():
                continue

            skill_path = entry / "SKILL.md"
            if not skill_path.is_file():
                continue

            try:
                skill = self.load_skill(entry.name, skills_dir, source)
                if skill:
                    skills.append(skill)
                    logger.debug("SkillLoader: loaded skill %s", skill.name)
            except Exception:
                logger.exception("SkillLoader: failed to load skill from %s", entry.name)

        return skills

    def load_skill(
        self,
        name: str,
        skills_dir: str,
        source: str = "user",
    ) -> SkillDefinition | None:
        """Load a single skill by name."""
        error = _validate_skill_name(name)
        if error:
            raise MatimoError(f"Invalid skill name: {error}", ErrorCode.INVALID_SCHEMA)

        skill_dir = Path(skills_dir) / name
        skill_path = skill_dir / "SKILL.md"

        if not skill_path.is_file():
            raise MatimoError(f"Skill not found: {skill_path}", ErrorCode.TOOL_NOT_FOUND)

        content = skill_path.read_text(encoding="utf-8")
        parsed = parse_skill_content(content)

        if not parsed.frontmatter.name:
            raise MatimoError(
                f"Failed to parse skill: invalid frontmatter in {skill_path}",
                ErrorCode.INVALID_SCHEMA,
            )

        if parsed.frontmatter.name != name:
            raise MatimoError(
                f'Skill name "{parsed.frontmatter.name}" must match directory name "{name}"',
                ErrorCode.INVALID_SCHEMA,
            )

        resources = _list_bundled_resources(skill_dir)

        allowed_tools = parsed.frontmatter.allowed_tools
        if isinstance(allowed_tools, str):
            allowed_tools = [allowed_tools]

        return SkillDefinition(
            name=parsed.frontmatter.name,
            description=parsed.frontmatter.description,
            version=parsed.frontmatter.version,
            license=parsed.frontmatter.license,
            compatibility=parsed.frontmatter.compatibility,
            allowed_tools=allowed_tools,
            metadata=parsed.frontmatter.metadata,
            body=parsed.body,
            sections=parsed.sections,
            total_tokens=parsed.total_tokens,
            resources=resources,
            source=source,  # type: ignore[arg-type]
            **{"_path": str(skill_dir)},
        )

    def load_skill_resource(
        self,
        skill_name: str,
        skills_dir: str,
        resource_path: str,
    ) -> str:
        """Load a skill resource file (scripts/, references/, assets/)."""
        # Validate resource path (prevent traversal)
        if ".." in resource_path or "\\" in resource_path:
            raise MatimoError(
                "Resource path contains invalid characters",
                ErrorCode.INVALID_SCHEMA,
            )
        # Reject control characters
        if any(0 <= ord(c) <= 0x1F for c in resource_path):
            raise MatimoError(
                "Resource path contains invalid characters",
                ErrorCode.INVALID_SCHEMA,
            )

        skill_dir = Path(skills_dir) / skill_name
        resource_full = (skill_dir / resource_path).resolve()

        # Verify path stays within skill directory
        if not str(resource_full).startswith(str(skill_dir.resolve())):
            raise MatimoError(
                "Resource path escapes the skill directory",
                ErrorCode.INVALID_SCHEMA,
            )

        if not resource_full.is_file():
            raise MatimoError(
                f"Resource file not found: {resource_path}",
                ErrorCode.TOOL_NOT_FOUND,
            )

        try:
            return resource_full.read_text(encoding="utf-8")
        except Exception as exc:
            raise MatimoError(
                f"Failed to read resource file: {exc}",
                ErrorCode.EXECUTION_FAILED,
            ) from exc
