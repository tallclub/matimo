"""matimo_get_skill — read a skill's SKILL.md content and metadata."""
from __future__ import annotations

import logging
import re
from pathlib import Path

import yaml

logger = logging.getLogger("matimo")

UNSAFE_NAME = re.compile(r"[/\\]|\.\.|[\x00-\x1f]")


def _extract_frontmatter(content: str) -> tuple[dict, str]:  # type: ignore[type-arg]
    if not content.startswith("---"):
        return {}, content
    end = content.find("---", 3)
    if end == -1:
        return {}, content
    try:
        fm: dict = yaml.safe_load(content[3:end]) or {}  # type: ignore[type-arg]
    except Exception:
        fm = {}
    body = content[end + 3:].lstrip("\n")
    return fm, body


def _scan_resources(skill_dir: Path) -> dict:  # type: ignore[type-arg]
    resources: dict = {"scripts": [], "references": [], "assets": [], "other": []}  # type: ignore[type-arg]
    for entry in sorted(skill_dir.iterdir()):
        if entry.name == "SKILL.md":
            continue
        if entry.is_file():
            resources["other"].append(entry.name)
        elif entry.is_dir():
            if entry.name in ("scripts", "references", "assets"):
                resources[entry.name] = [f.name for f in sorted(entry.iterdir()) if f.is_file()]
    return resources


def _find_skill_dir(name: str, explicit_dir: str | None) -> Path | None:
    if explicit_dir:
        p = Path(explicit_dir) / name
        if (p / "SKILL.md").exists():
            return p

    # Try global instance skill paths
    try:
        from matimo.decorators import get_global_matimo_instance

        instance = get_global_matimo_instance()
        if instance is not None and hasattr(instance, "list_skills"):
            for s in instance.list_skills():
                if s.name == name and getattr(s, "_path", None):
                    p = Path(s._path)  # type: ignore[union-attr]
                    if (p / "SKILL.md").exists():
                        return p
    except Exception as exc:
        logger.debug("matimo_get_skill: global instance lookup failed: %s", exc)

    return None


async def run(params: dict) -> dict:  # type: ignore[type-arg]
    name: str = (params.get("name") or "").strip()
    skills_dir: str | None = params.get("skills_dir")
    file: str | None = params.get("file")

    if not name:
        return {"success": False, "message": "Skill name is required"}
    if UNSAFE_NAME.search(name):
        return {"success": False, "message": "Skill name contains invalid characters"}

    skill_dir = _find_skill_dir(name, skills_dir)
    if skill_dir is None:
        return {"success": False, "name": name, "message": f'Skill "{name}" not found'}

    if file:
        # Reject path traversal in the file param
        if re.search(r"\.\.|\\|[\x00-\x1f]", file):
            return {"success": False, "message": "File path contains invalid characters"}
        resource_path = skill_dir / file
        # Ensure the resolved path stays inside the skill directory
        resolved = resource_path.resolve()
        skill_dir_resolved = skill_dir.resolve()
        if resolved != skill_dir_resolved and not resolved.is_relative_to(skill_dir_resolved):
            return {"success": False, "message": "File path escapes the skill directory"}
        if not resource_path.exists():
            return {
                "success": False,
                "name": name,
                "message": f'Resource file "{file}" not found in skill "{name}"',
            }
        return {
            "success": True,
            "name": name,
            "content": resource_path.read_text(encoding="utf-8"),
            "path": str(resource_path),
            "message": f'Resource file "{file}" retrieved successfully.',
        }

    skill_file = skill_dir / "SKILL.md"
    content = skill_file.read_text(encoding="utf-8")
    fm, _body = _extract_frontmatter(content)
    resources = _scan_resources(skill_dir)

    return {
        "success": True,
        "name": fm.get("name", name),
        "description": fm.get("description", ""),
        "content": content,
        "path": str(skill_file),
        "license": fm.get("license"),
        "compatibility": fm.get("compatibility"),
        "metadata": fm.get("metadata"),
        "resources": resources,
        "message": "Skill retrieved successfully.",
    }
