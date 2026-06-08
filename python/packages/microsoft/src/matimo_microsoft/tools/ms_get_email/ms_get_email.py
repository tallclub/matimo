"""
ms_get_email — GET /me/messages
https://learn.microsoft.com/en-us/graph/api/user-list-messages
Mirrors: typescript/packages/microsoft/tools/ms_get_email/ms_get_email.ts
"""
from __future__ import annotations

import math
from typing import Any
from urllib.parse import quote

from matimo.errors import ErrorCode, MatimoError
from matimo_microsoft.graph_client import get_access_token, graph_request, require_params

_DEFAULT_TOP = 10
_MAX_TOP = 50


def _format_sender(message: dict[str, Any]) -> str:
    address = (message.get("from") or {}).get("emailAddress")
    if not address:
        return ""
    name = address.get("name")
    email = address.get("address")
    if name and email:
        return f"{name} <{email}>"
    return name or email or ""


async def run(params: dict[str, Any]) -> dict[str, Any]:
    require_params(params, [], "ms_get_email")

    raw_top = params.get("top")
    top = _DEFAULT_TOP if raw_top is None else raw_top
    try:
        top_number = float(top)
    except (TypeError, ValueError):
        top_number = math.nan
    if not math.isfinite(top_number) or top_number < 1 or top_number > _MAX_TOP:
        raise MatimoError(
            f"ms_get_email: 'top' must be a number between 1 and {_MAX_TOP} (received {top!r})",
            ErrorCode.VALIDATION_FAILED,
            {"top": raw_top},
        )

    folder_id_param = params.get("folder_id")
    folder_id = folder_id_param if isinstance(folder_id_param, str) and folder_id_param else None
    filter_param = params.get("filter")
    filter_expr = filter_param if isinstance(filter_param, str) and filter_param else None
    search_param = params.get("search")
    search_expr = search_param if isinstance(search_param, str) and search_param else None

    token = get_access_token(params)

    path = (
        f"/me/mailFolders/{quote(folder_id, safe='')}/messages" if folder_id else "/me/messages"
    )

    query: dict[str, Any] = {
        "$top": int(top_number),
        "$select": "id,subject,from,receivedDateTime,isRead,bodyPreview,hasAttachments",
    }
    if filter_expr:
        query["$filter"] = filter_expr
    if search_expr:
        query["$search"] = search_expr

    data = await graph_request(
        method="GET",
        path=path,
        token=token,
        resource_type="Mail folder",
        query=query,
        headers={"ConsistencyLevel": "eventual"} if search_expr else None,
    )
    raw_messages = data.get("value") if isinstance(data, dict) else None

    messages = [
        {
            "id": message.get("id") or "",
            "subject": message.get("subject") or "",
            "from": _format_sender(message),
            "received_at": message.get("receivedDateTime") or "",
            "is_read": message.get("isRead") or False,
            "body_preview": message.get("bodyPreview") or "",
            "has_attachments": message.get("hasAttachments") or False,
        }
        for message in raw_messages or []
    ]

    return {
        "success": True,
        "messages": messages,
    }
