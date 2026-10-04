"""matimo_search_skills — semantic search across all loaded skills."""
from __future__ import annotations

import logging

logger = logging.getLogger("matimo")


async def run(params: dict) -> dict:  # type: ignore[type-arg]
    query: str = (params.get("query") or "").strip()

    if not query:
        return {"success": False, "query": query, "results": [], "total": 0, "message": "Search query is required"}

    limit = int(params.get("limit") or 10)
    min_score = float(params.get("min_score") or 0.1)

    try:
        from matimo.decorators import get_global_matimo_instance

        instance = get_global_matimo_instance()
    except Exception:
        instance = None

    if instance is None:
        return {
            "success": False,
            "query": query,
            "results": [],
            "total": 0,
            "message": (
                "No active Matimo instance found. Semantic skill search requires "
                "an initialized Matimo instance."
            ),
        }

    try:
        hits = await instance.semantic_search_skills(query, limit=limit, min_score=min_score)
        results = [
            {"name": hit.skill.name, "description": hit.skill.description, "relevanceScore": hit.score}
            for hit in hits
        ]
        logger.debug("matimo_search_skills: search complete query=%s count=%d", query, len(results))
        return {
            "success": True,
            "query": query,
            "results": results,
            "total": len(results),
            "message": f"Found {len(results)} matching skill(s).",
        }
    except Exception as exc:
        logger.error("matimo_search_skills: search failed query=%s error=%s", query, exc)
        return {"success": False, "query": query, "results": [], "total": 0, "message": f"Search failed: {exc}"}
