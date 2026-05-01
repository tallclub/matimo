"""matimo_search_tools — search the loaded tool registry by keyword."""
from __future__ import annotations

import logging
from pathlib import Path

import yaml

logger = logging.getLogger("matimo")


async def run(params: dict) -> dict:  # type: ignore[type-arg]
    from matimo.core.models import ToolDefinition
    from matimo.policy.risk_classifier import classify_risk

    query: str = params.get("query", "")
    limit: int = int(params.get("limit", 20))

    def to_summary(tool: ToolDefinition) -> dict:  # type: ignore[type-arg]
        try:
            risk = classify_risk(tool)
        except Exception:
            risk = "medium"
        return {
            "name": tool.name,
            "description": tool.description,
            "version": tool.version,
            "tags": list(tool.tags or []),
            "riskLevel": risk,
        }

    # Prefer global instance (has all loaded tools)
    try:
        from matimo.decorators import get_global_matimo_instance

        instance = get_global_matimo_instance()
        if instance is not None and hasattr(instance, "search_tools"):
            found = instance.search_tools(query)[:limit]
            logger.debug("matimo_search_tools: registry search query=%s count=%d", query, len(found))
            return {"results": [to_summary(t) for t in found], "total": len(found), "query": query}
    except Exception as exc:
        logger.debug("matimo_search_tools: no global instance, falling back to disk: %s", exc)

    # Fallback: scan default tools directory
    tool_dir = Path("./matimo-tools")
    if not tool_dir.exists():
        return {"results": [], "total": 0, "query": query}

    lower_query = query.lower()
    results: list[dict] = []  # type: ignore[type-arg]

    for entry in tool_dir.iterdir():
        if not entry.is_dir():
            continue
        def_path = entry / "definition.yaml"
        if not def_path.exists():
            continue
        try:
            parsed = yaml.safe_load(def_path.read_text(encoding="utf-8"))
            tool = ToolDefinition.model_validate(parsed)
            tags_lower = [t.lower() for t in (tool.tags or [])]
            if (
                lower_query in tool.name.lower()
                or lower_query in tool.description.lower()
                or any(lower_query in t for t in tags_lower)
            ):
                results.append(to_summary(tool))
        except Exception as exc:
            logger.debug("matimo_search_tools: skipping invalid tool %s: %s", entry.name, exc)
        if len(results) >= limit:
            break

    return {"results": results, "total": len(results), "query": query}
