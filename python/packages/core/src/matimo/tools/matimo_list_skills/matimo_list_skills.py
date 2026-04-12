"""matimo_list_skills — list all available skills."""
from __future__ import annotations

import logging
from pathlib import Path

import yaml

logger = logging.getLogger("matimo")


def _extract_frontmatter(content: str) -> dict:  # type: ignore[type-arg]
    if not content.startswith("---"):
        return {}
    end = content.find("---", 3)
    if end == -1:
        return {}
    try:
        return yaml.safe_load(content[3:end]) or {}  # type: ignore[return-value]
    except Exception:
        return {}


def _load_skills_from_path(skills_path: Path) -> list[dict]:  # type: ignore[type-arg]
    skills = []
    if not skills_path.exists():
        return skills
    for entry in sorted(skills_path.iterdir()):
        if not entry.is_dir():
            continue
        skill_file = entry / "SKILL.md"
        if not skill_file.exists():
            continue
        try:
            content = skill_file.read_text(encoding="utf-8")
            fm = _extract_frontmatter(content)
            skills.append({
                "name": fm.get("name", entry.name),
                "description": fm.get("description", ""),
                "version": fm.get("version"),
                "license": fm.get("license"),
                "metadata": fm.get("metadata"),
                "source": "user",
            })
        except Exception as exc:
            logger.debug("matimo_list_skills: failed to read %s: %s", skill_file, exc)
    return skills


async def run(params: dict) -> dict:  # type: ignore[type-arg]
    skills_dir: str | None = params.get("skills_dir")
    # Use dict to deduplicate by name (mirrors TS Map behaviour)
    all_skills: dict[str, dict] = {}  # type: ignore[type-arg]

    # Try global instance first
    try:
        from matimo.decorators import get_global_matimo_instance

        instance = get_global_matimo_instance()
        if instance is not None and hasattr(instance, "list_skills"):
            for s in instance.list_skills():
                all_skills[s.name] = {
                    "name": s.name,
                    "description": getattr(s, "description", ""),
                    "version": getattr(s, "version", None),
                    "license": getattr(s, "license", None),
                    "metadata": getattr(s, "metadata", None),
                    "source": getattr(s, "source", "user"),
                }
    except Exception as exc:
        logger.debug("matimo_list_skills: global instance lookup failed: %s", exc)

    # Explicit directory (supplements instance results)
    if skills_dir:
        for skill in _load_skills_from_path(Path(skills_dir)):
            all_skills.setdefault(skill["name"], skill)

    skills = list(all_skills.values())
    return {"skills": skills, "total": len(skills)}
