"""matimo_get_skill_sections — inventory a skill's sections and token costs."""
from __future__ import annotations

import logging

logger = logging.getLogger("matimo")


async def run(params: dict) -> dict:  # type: ignore[type-arg]
    name: str = (params.get("name") or "").strip()

    if not name:
        return {"success": False, "name": name, "sections": [], "total": 0, "message": "Skill name is required"}

    try:
        from matimo.decorators import get_global_matimo_instance

        instance = get_global_matimo_instance()
    except Exception:
        instance = None

    if instance is None:
        return {
            "success": False,
            "name": name,
            "sections": [],
            "total": 0,
            "message": "No active Matimo instance found. Section inventory requires an initialized Matimo instance.",
        }

    sections = instance.get_skill_sections(name)
    if sections is None:
        return {"success": False, "name": name, "sections": [], "total": 0, "message": f'Skill "{name}" not found'}

    # Remap to camelCase for output-schema parity with the TypeScript tool.
    results = [
        {"path": s["path"], "level": s["level"], "tokenEstimate": s["token_estimate"]} for s in sections
    ]

    logger.debug("matimo_get_skill_sections: retrieved name=%s count=%d", name, len(results))

    return {
        "success": True,
        "name": name,
        "sections": results,
        "total": len(results),
        "message": f'Found {len(results)} section(s) for skill "{name}".',
    }
