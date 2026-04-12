"""matimo_validate_skill — validate an existing skill against the Agent Skills spec."""
from __future__ import annotations

import logging
import re
from pathlib import Path

import yaml

logger = logging.getLogger("matimo")

NAME_RE = re.compile(r"^[a-z0-9][a-z0-9-]{0,62}[a-z0-9]$|^[a-z0-9]$")
CONSECUTIVE_HYPHENS = re.compile(r"--")
EMPTY_STRUCTURE: dict = {"scripts": [], "references": [], "assets": [], "other": []}  # type: ignore[type-arg]


async def run(params: dict) -> dict:  # type: ignore[type-arg]
    name: str = (params.get("name") or "").strip()
    skills_dir: str = params.get("skills_dir", "./matimo-tools/skills")

    issues: list[dict] = []  # type: ignore[type-arg]

    def error(field: str, msg: str) -> None:
        issues.append({"field": field, "severity": "error", "message": msg})

    def warning(field: str, msg: str) -> None:
        issues.append({"field": field, "severity": "warning", "message": msg})

    if not name:
        return {
            "valid": False,
            "name": "",
            "issues": [{"field": "name", "severity": "error", "message": "Skill name is required"}],
            "structure": {"has_skill_md": False, "resources": EMPTY_STRUCTURE},
            "message": "Skill name is required",
        }

    # Validate name format
    if not NAME_RE.match(name):
        error("name", "Skill name must be lowercase letters, numbers, and hyphens only")
    if CONSECUTIVE_HYPHENS.search(name):
        error("name", "Skill name must not contain consecutive hyphens")
    if len(name) > 64:
        error("name", "Skill name must be 64 characters or less")

    skill_dir = Path(skills_dir) / name
    skill_file = skill_dir / "SKILL.md"
    has_skill_md = skill_file.exists()

    if not skill_dir.exists():
        return {
            "valid": False,
            "name": name,
            "issues": [
                {
                    "field": "directory",
                    "severity": "error",
                    "message": f"Skill directory not found: {skill_dir}",
                }
            ],
            "structure": {"has_skill_md": False, "resources": EMPTY_STRUCTURE},
            "message": f'Skill "{name}" not found',
        }

    if not has_skill_md:
        error("SKILL.md", "Required SKILL.md file is missing")
        return {
            "valid": False,
            "name": name,
            "issues": issues,
            "structure": {"has_skill_md": False, "resources": EMPTY_STRUCTURE},
            "message": "SKILL.md is missing",
        }

    content = skill_file.read_text(encoding="utf-8")
    body = ""
    if not content.startswith("---"):
        error("frontmatter", "SKILL.md must start with YAML frontmatter (---)")
    else:
        end = content.find("---", 3)
        if end == -1:
            error("frontmatter", "YAML frontmatter is not closed with ---")
        else:
            body = content[end + 3:].strip()
            try:
                fm = yaml.safe_load(content[3:end]) or {}
                if not fm.get("name"):
                    error("name", "Frontmatter must include 'name' field")
                elif fm["name"] != name:
                    error("name", f"Frontmatter name '{fm['name']}' must match directory name '{name}'")
                if not fm.get("description"):
                    error("description", "Frontmatter must include 'description' field")
                elif len(fm["description"]) > 256:
                    warning("description", "Description exceeds 256 characters (recommended limit)")
            except yaml.YAMLError as exc:
                error("frontmatter", f"Frontmatter YAML parse error: {exc}")

    # Body checks (only when frontmatter was parseable)
    if not issues or not any(i["field"] == "frontmatter" for i in issues):
        if not body or not body.strip():
            warning("body", "SKILL.md has no instructions body — add content after the frontmatter")
        else:
            line_count = len(body.split("\n"))
            if line_count > 500:
                warning(
                    "body",
                    f"SKILL.md body has {line_count} lines — spec recommends < 500 lines. "
                    "Consider splitting into referenced files.",
                )

    # Scan resources
    resources: dict = {"scripts": [], "references": [], "assets": [], "other": []}  # type: ignore[type-arg]
    for entry in sorted(skill_dir.iterdir()):
        if entry.name == "SKILL.md":
            continue
        if entry.is_file():
            resources["other"].append(entry.name)
        elif entry.is_dir():
            if entry.name in ("scripts", "references", "assets"):
                resources[entry.name] = [f.name for f in sorted(entry.iterdir()) if f.is_file()]

    is_valid = not any(i["severity"] == "error" for i in issues)
    error_count = sum(1 for i in issues if i["severity"] == "error")
    return {
        "valid": is_valid,
        "name": name,
        "issues": issues,
        "structure": {"has_skill_md": has_skill_md, "resources": resources},
        "message": (
            f'Skill "{name}" is valid per the Agent Skills specification.'
            if is_valid
            else f'Skill "{name}" has {error_count} error(s).'
        ),
    }
