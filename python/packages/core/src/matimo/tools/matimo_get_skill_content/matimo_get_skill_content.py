"""matimo_get_skill_content — load only specific sections of a skill."""
from __future__ import annotations

import logging
import math

logger = logging.getLogger("matimo")


def _estimate_tokens(text: str) -> int:
    """Rough heuristic: 1 token ~= 0.75 words (mirrors the core skill-content-parser estimate)."""
    if not text:
        return 0
    word_count = len(text.split())
    return math.ceil(word_count / 0.75)


async def run(params: dict) -> dict:  # type: ignore[type-arg]
    from matimo.core.models import SkillContentOptions

    name: str = (params.get("name") or "").strip()

    if not name:
        return {"success": False, "name": name, "message": "Skill name is required"}

    try:
        from matimo.decorators import get_global_matimo_instance

        instance = get_global_matimo_instance()
    except Exception:
        instance = None

    if instance is None:
        return {
            "success": False,
            "name": name,
            "message": (
                "No active Matimo instance found. Selective content loading requires "
                "an initialized Matimo instance."
            ),
        }

    options = SkillContentOptions(
        sections=params.get("sections"),
        max_tokens=params.get("max_tokens"),
        include_preamble=params.get("include_preamble", True),
        max_depth=params.get("max_depth"),
    )

    content = instance.get_skill_content(name, options)
    if content is None:
        return {"success": False, "name": name, "message": f'Skill "{name}" not found'}

    tokens_used = _estimate_tokens(content)
    logger.debug("matimo_get_skill_content: retrieved name=%s tokensUsed=%d", name, tokens_used)

    return {
        "success": True,
        "name": name,
        "content": content,
        "tokensUsed": tokens_used,
        "message": f'Retrieved content for skill "{name}" ({tokens_used} tokens).',
    }
