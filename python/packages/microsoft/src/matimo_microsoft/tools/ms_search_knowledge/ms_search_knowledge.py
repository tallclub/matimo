"""
ms_search_knowledge — POST /search/query
https://learn.microsoft.com/en-us/graph/api/search-query
Mirrors: typescript/packages/microsoft/tools/ms_search_knowledge/ms_search_knowledge.ts
"""
from __future__ import annotations

import math
from typing import Any

from matimo.errors import ErrorCode, MatimoError
from matimo_microsoft.graph_client import get_access_token, graph_request, require_params

_VALID_ENTITY_TYPES = ["driveItem", "listItem", "site", "list", "drive"]
_DEFAULT_ENTITY_TYPES = ["driveItem", "listItem", "site"]
_DEFAULT_TOP = 10
_MAX_TOP = 25


async def run(params: dict[str, Any]) -> dict[str, Any]:
    require_params(params, ["query"], "ms_search_knowledge")

    query = str(params["query"])

    raw_entity_types = params.get("entity_types")
    entity_types = (
        [str(t) for t in raw_entity_types] if isinstance(raw_entity_types, list) else _DEFAULT_ENTITY_TYPES
    )

    invalid_entity_types = [t for t in entity_types if t not in _VALID_ENTITY_TYPES]
    if not entity_types or invalid_entity_types:
        raise MatimoError(
            f"ms_search_knowledge: invalid entity_types {invalid_entity_types}. "
            f"Valid values are: {', '.join(_VALID_ENTITY_TYPES)}",
            ErrorCode.VALIDATION_FAILED,
            {"entityTypes": entity_types, "invalidEntityTypes": invalid_entity_types},
        )

    raw_top = params.get("top")
    top = _DEFAULT_TOP if raw_top is None else raw_top
    try:
        top_number = float(top)
    except (TypeError, ValueError):
        top_number = math.nan
    if not math.isfinite(top_number) or top_number < 1 or top_number > _MAX_TOP:
        raise MatimoError(
            f"ms_search_knowledge: 'top' must be a number between 1 and {_MAX_TOP} (received {top!r})",
            ErrorCode.VALIDATION_FAILED,
            {"top": raw_top},
        )

    # Microsoft Search has no dedicated site/drive filter for driveItem/listItem/site
    # entity types — fold the IDs into the query string as a best-effort scoping hint.
    # This is documented in the tool description so callers don't expect a hard filter.
    scope_hints = [
        value
        for value in (params.get("site_id"), params.get("drive_id"))
        if isinstance(value, str) and value
    ]
    query_string = f"{query} {' '.join(scope_hints)}" if scope_hints else query

    token = get_access_token(params)

    data = await graph_request(
        method="POST",
        path="/search/query",
        token=token,
        resource_type="Search results",
        body={
            "requests": [
                {
                    "entityTypes": entity_types,
                    "query": {"queryString": query_string},
                    "from": 0,
                    "size": int(top_number),
                }
            ]
        },
    )

    container: dict[str, Any] = {}
    if isinstance(data, dict):
        values = data.get("value") or []
        if values and isinstance(values[0], dict):
            containers = values[0].get("hitsContainers") or []
            if containers and isinstance(containers[0], dict):
                container = containers[0]

    hits = container.get("hits") or []

    results = []
    for hit in hits:
        resource = hit.get("resource") or {}
        results.append(
            {
                "id": resource.get("id") or hit.get("hitId") or "",
                "name": resource.get("name") or "",
                "summary": hit.get("summary") or "",
                "web_url": resource.get("webUrl") or "",
                "last_modified": resource.get("lastModifiedDateTime") or "",
                "score": hit.get("rank") or 0,
            }
        )

    return {
        "success": True,
        "results": results,
        "total_count": container.get("total", len(results)),
    }
