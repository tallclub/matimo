"""matimo_create_skill — create a new skill (SKILL.md) on disk."""
from __future__ import annotations

import logging
import re
from pathlib import Path

import yaml

logger = logging.getLogger("matimo")

NAME_RE = re.compile(r"^[a-z0-9][a-z0-9-]{0,62}[a-z0-9]$|^[a-z0-9]$")
CONSECUTIVE_HYPHENS = re.compile(r"--")


def _validate_name(name: str) -> str | None:
    """Return error message or None if valid."""
    if not name or len(name) > 64:
        return "Skill name must be 1-64 characters"
    if not NAME_RE.match(name):
        return "Skill name must be lowercase letters, numbers, and hyphens only"
    if CONSECUTIVE_HYPHENS.search(name):
        return "Skill name must not contain consecutive hyphens"
    return None


def _extract_frontmatter(content: str) -> dict | None:  # type: ignore[type-arg]
    if not content.startswith("---"):
        return None
    end = content.find("---", 3)
    if end == -1:
        return None
    try:
        return yaml.safe_load(content[3:end]) or {}  # type: ignore[return-value]
    except Exception:
        return None


async def run(params: dict) -> dict:  # type: ignore[type-arg]
    name: str = (params.get("name") or "").strip()
    content: str = params.get("content", "")
    target_dir: str = params.get("target_dir", "./matimo-tools/skills")

    err = _validate_name(name)
    if err:
        return {"success": False, "message": err}

    fm = _extract_frontmatter(content)
    if fm is None:
        return {"success": False, "message": "SKILL.md must start with --- YAML frontmatter ---"}
    if not fm.get("name"):
        return {"success": False, "message": "Frontmatter must include 'name' field"}
    if not fm.get("description"):
        return {"success": False, "message": "Frontmatter must include 'description' field"}
    if fm["name"] != name:
        return {"success": False, "message": f"Frontmatter name '{fm['name']}' must match directory name '{name}'"}

    skill_dir = Path(target_dir) / name
    skill_dir.mkdir(parents=True, exist_ok=True)
    file_path = skill_dir / "SKILL.md"
    file_path.write_text(content, encoding="utf-8")

    logger.info("matimo_create_skill: created path=%s", file_path)
    return {"success": True, "path": str(file_path), "message": f'Skill "{name}" created successfully.'}
