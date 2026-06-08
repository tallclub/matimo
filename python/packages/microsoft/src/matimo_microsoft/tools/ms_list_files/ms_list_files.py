"""
ms_list_files — GET /drives/{drive_id}/items/{item_id}/children
https://learn.microsoft.com/en-us/graph/api/driveitem-list-children
Mirrors: typescript/packages/microsoft/tools/ms_list_files/ms_list_files.ts
"""
from __future__ import annotations

import math
from typing import Any
from urllib.parse import quote

from matimo.errors import ErrorCode, MatimoError
from matimo_microsoft.graph_client import get_access_token, graph_request, require_params

_DEFAULT_ITEM_ID = "root"
_DEFAULT_TOP = 20
_MAX_TOP = 100


async def run(params: dict[str, Any]) -> dict[str, Any]:
    require_params(params, ["drive_id"], "ms_list_files")

    drive_id = str(params["drive_id"])
    item_id_param = params.get("item_id")
    item_id = item_id_param if isinstance(item_id_param, str) and item_id_param else _DEFAULT_ITEM_ID

    raw_top = params.get("top")
    top = _DEFAULT_TOP if raw_top is None else raw_top
    try:
        top_number = float(top)
    except (TypeError, ValueError):
        top_number = math.nan
    if not math.isfinite(top_number) or top_number < 1 or top_number > _MAX_TOP:
        raise MatimoError(
            f"ms_list_files: 'top' must be a number between 1 and {_MAX_TOP} (received {top!r})",
            ErrorCode.VALIDATION_FAILED,
            {"top": raw_top},
        )

    token = get_access_token(params)

    data = await graph_request(
        method="GET",
        path=f"/drives/{quote(drive_id, safe='')}/items/{quote(item_id, safe='')}/children",
        token=token,
        resource_type="Drive folder",
        query={
            "$top": int(top_number),
            "$select": "id,name,size,lastModifiedDateTime,webUrl,file,folder",
        },
    )
    raw_items = data.get("value") if isinstance(data, dict) else None

    items = []
    for item in raw_items or []:
        entry = {
            "id": item.get("id") or "",
            "name": item.get("name") or "",
            "type": "folder" if item.get("folder") else "file",
            "size_bytes": item.get("size") or 0,
            "last_modified": item.get("lastModifiedDateTime") or "",
            "web_url": item.get("webUrl") or "",
        }
        mime_type = (item.get("file") or {}).get("mimeType")
        if mime_type:
            entry["mime_type"] = mime_type
        items.append(entry)

    return {
        "success": True,
        "items": items,
    }
