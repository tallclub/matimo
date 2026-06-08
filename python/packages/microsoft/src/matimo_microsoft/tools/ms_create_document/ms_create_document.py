"""
ms_create_document — PUT /drives/{drive-id}/items/{parent-item-id}:/{filename}:/content
https://learn.microsoft.com/en-us/graph/api/driveitem-put-content
Mirrors: typescript/packages/microsoft/tools/ms_create_document/ms_create_document.ts

Uses the "simple upload" by-path addressing syntax. Graph caps this endpoint at
4 MB; larger files require a resumable upload session, which is out of scope here
and is rejected with a clear validation error rather than silently truncating.
"""
from __future__ import annotations

import base64
import binascii
from typing import Any
from urllib.parse import quote

from matimo.errors import ErrorCode, MatimoError
from matimo_microsoft.graph_client import get_access_token, graph_request, require_params

_VALID_ENCODINGS = ["text", "base64"]
_VALID_CONFLICT_BEHAVIOURS = ["replace", "rename", "fail"]
_DEFAULT_PARENT_ITEM_ID = "root"
_MAX_UPLOAD_BYTES = 4 * 1024 * 1024


async def run(params: dict[str, Any]) -> dict[str, Any]:
    require_params(params, ["drive_id", "filename", "content"], "ms_create_document")

    drive_id = str(params["drive_id"])
    parent_item_id_param = params.get("parent_item_id")
    parent_item_id = (
        parent_item_id_param
        if isinstance(parent_item_id_param, str) and parent_item_id_param
        else _DEFAULT_PARENT_ITEM_ID
    )
    filename = str(params["filename"])

    encoding_param = params.get("content_encoding")
    encoding = "text" if encoding_param is None else str(encoding_param)
    if encoding not in _VALID_ENCODINGS:
        raise MatimoError(
            f"ms_create_document: 'content_encoding' must be one of {', '.join(_VALID_ENCODINGS)} "
            f"(received '{encoding}')",
            ErrorCode.VALIDATION_FAILED,
            {"content_encoding": encoding_param},
        )

    conflict_param = params.get("conflict_behaviour")
    conflict_behaviour = "replace" if conflict_param is None else str(conflict_param)
    if conflict_behaviour not in _VALID_CONFLICT_BEHAVIOURS:
        raise MatimoError(
            f"ms_create_document: 'conflict_behaviour' must be one of {', '.join(_VALID_CONFLICT_BEHAVIOURS)} "
            f"(received '{conflict_behaviour}')",
            ErrorCode.VALIDATION_FAILED,
            {"conflict_behaviour": conflict_param},
        )

    raw_content = str(params["content"])
    if encoding == "base64":
        # Mirror Node's lenient Buffer.from(str, 'base64'), which decodes whatever
        # it can rather than throwing on malformed input — pad out to a multiple
        # of 4 and ignore decode errors from stray characters.
        padded = raw_content + "=" * (-len(raw_content) % 4)
        try:
            buffer = base64.b64decode(padded, validate=False)
        except (binascii.Error, ValueError):
            buffer = b""
    else:
        buffer = raw_content.encode("utf-8")

    if len(buffer) > _MAX_UPLOAD_BYTES:
        raise MatimoError(
            f"ms_create_document: content is {len(buffer)} bytes, exceeding the "
            f"{_MAX_UPLOAD_BYTES}-byte limit of the simple-upload endpoint. Files this large "
            "require a resumable upload session, which this tool does not implement.",
            ErrorCode.VALIDATION_FAILED,
            {"sizeBytes": len(buffer), "maxBytes": _MAX_UPLOAD_BYTES},
        )

    token = get_access_token(params)

    # By-path addressing uses literal colons as delimiters — only the path SEGMENTS
    # (drive id, parent item id, filename) are percent-encoded, not the colons.
    path = (
        f"/drives/{quote(drive_id, safe='')}/items/{quote(parent_item_id, safe='')}"
        f":/{quote(filename, safe='')}:/content"
    )

    item = await graph_request(
        method="PUT",
        path=path,
        token=token,
        resource_type="Drive folder",
        query={"@microsoft.graph.conflictBehavior": conflict_behaviour},
        body=buffer,
        headers={"Content-Type": "application/octet-stream"},
    )
    item = item if isinstance(item, dict) else {}

    return {
        "success": True,
        "item_id": item.get("id") or "",
        "name": item.get("name") or filename,
        "web_url": item.get("webUrl") or "",
        "size_bytes": item.get("size") or len(buffer),
    }
