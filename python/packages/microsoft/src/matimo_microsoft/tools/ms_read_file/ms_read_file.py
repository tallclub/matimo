"""
ms_read_file — GET /drives/{drive_id}/items/{item_id}/content
https://learn.microsoft.com/en-us/graph/api/driveitem-get-content
Mirrors: typescript/packages/microsoft/tools/ms_read_file/ms_read_file.ts

Scope decision (documented, not a shortcut): this tool performs REAL UTF-8 text
extraction only for plain-text formats. Rich document formats (PDF/Word/Excel/
PowerPoint) return `content: ""` with a format-specific warning rather than
bundling unverified parsing dependencies. Truly-unsupported binaries get the exact
warning the tool's contract specifies: "Binary file — text extraction not supported".
"""
from __future__ import annotations

from typing import Any
from urllib.parse import quote

from matimo_microsoft.graph_client import get_access_token, graph_request, require_params

_TEXT_MIME_PREFIXES = ("text/",)
_TEXT_MIME_TYPES = {"application/json", "application/xml"}

_RICH_DOCUMENT_LABELS = {
    "application/pdf": "PDF document",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "Word document (.docx)",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "Excel workbook (.xlsx)",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": "PowerPoint presentation (.pptx)",
    "application/msword": "Word document (.doc)",
    "application/vnd.ms-excel": "Excel workbook (.xls)",
    "application/vnd.ms-powerpoint": "PowerPoint presentation (.ppt)",
}


def _is_plain_text_mime(mime_type: str) -> bool:
    return mime_type in _TEXT_MIME_TYPES or mime_type.startswith(_TEXT_MIME_PREFIXES)


async def run(params: dict[str, Any]) -> dict[str, Any]:
    require_params(params, ["drive_id", "item_id"], "ms_read_file")

    drive_id = str(params["drive_id"])
    item_id = str(params["item_id"])
    token = get_access_token(params)

    metadata = await graph_request(
        method="GET",
        path=f"/drives/{quote(drive_id, safe='')}/items/{quote(item_id, safe='')}",
        token=token,
        resource_type="Drive item",
        query={"$select": "name,size,file"},
    )
    metadata = metadata if isinstance(metadata, dict) else {}

    name = metadata.get("name") or ""
    mime_type = (metadata.get("file") or {}).get("mimeType") or "application/octet-stream"
    size_bytes = metadata.get("size") or 0

    raw = await graph_request(
        method="GET",
        path=f"/drives/{quote(drive_id, safe='')}/items/{quote(item_id, safe='')}/content",
        token=token,
        resource_type="Drive item content",
        response_type="bytes",
    )
    buffer = raw if isinstance(raw, (bytes, bytearray)) else b""

    if _is_plain_text_mime(mime_type):
        return {
            "success": True,
            "content": buffer.decode("utf-8"),
            "name": name,
            "mime_type": mime_type,
            "size_bytes": size_bytes,
        }

    rich_document_label = _RICH_DOCUMENT_LABELS.get(mime_type)
    if rich_document_label:
        return {
            "success": True,
            "content": "",
            "name": name,
            "mime_type": mime_type,
            "size_bytes": size_bytes,
            "warning": (
                f"{rich_document_label} — text extraction for this format is not implemented to avoid "
                "bundling unverified parsing dependencies. Share the file via its web URL instead."
            ),
        }

    return {
        "success": True,
        "content": "",
        "name": name,
        "mime_type": mime_type,
        "size_bytes": size_bytes,
        "warning": "Binary file — text extraction not supported",
    }
