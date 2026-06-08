"""
ms_send_email — draft + send, two Graph calls
  1. POST /me/messages           https://learn.microsoft.com/en-us/graph/api/user-post-messages
  2. POST /me/messages/{id}/send https://learn.microsoft.com/en-us/graph/api/message-send
Mirrors: typescript/packages/microsoft/tools/ms_send_email/ms_send_email.ts

Why two calls: POST /me/sendMail returns an empty 202 Accepted with no message
identifier, but this tool's contract promises a `message_id`. Creating a draft
first gives us a real message ID we can report back, then we send that draft.
"""
from __future__ import annotations

from typing import Any
from urllib.parse import quote

from matimo.errors import ErrorCode, MatimoError
from matimo_microsoft.graph_client import get_access_token, graph_request, require_params

_VALID_BODY_TYPES = ["text", "html"]


def _to_recipient_list(value: Any, field_name: str) -> list[dict[str, Any]]:
    if value is None:
        return []
    if not isinstance(value, list) or any(not isinstance(entry, str) or not entry for entry in value):
        raise MatimoError(
            f"ms_send_email: '{field_name}' must be an array of email address strings",
            ErrorCode.VALIDATION_FAILED,
            {"field": field_name, "received": value},
        )
    return [{"emailAddress": {"address": address}} for address in value]


async def run(params: dict[str, Any]) -> dict[str, Any]:
    require_params(params, ["to", "subject", "body"], "ms_send_email")

    to = _to_recipient_list(params.get("to"), "to")
    if not to:
        raise MatimoError(
            "ms_send_email: 'to' must contain at least one recipient email address",
            ErrorCode.VALIDATION_FAILED,
            {"to": params.get("to")},
        )
    cc = _to_recipient_list(params.get("cc"), "cc")
    bcc = _to_recipient_list(params.get("bcc"), "bcc")

    body_type_param = params.get("body_type")
    body_type = "text" if body_type_param is None else str(body_type_param)
    if body_type not in _VALID_BODY_TYPES:
        raise MatimoError(
            f"ms_send_email: 'body_type' must be one of {', '.join(_VALID_BODY_TYPES)} (received '{body_type}')",
            ErrorCode.VALIDATION_FAILED,
            {"body_type": body_type_param},
        )

    token = get_access_token(params)

    draft_body: dict[str, Any] = {
        "subject": str(params["subject"]),
        "body": {
            "contentType": "HTML" if body_type == "html" else "Text",
            "content": str(params["body"]),
        },
        "toRecipients": to,
    }
    if cc:
        draft_body["ccRecipients"] = cc
    if bcc:
        draft_body["bccRecipients"] = bcc

    draft = await graph_request(
        method="POST",
        path="/me/messages",
        token=token,
        resource_type="Mail draft",
        body=draft_body,
    )

    message_id = draft.get("id") if isinstance(draft, dict) else None
    if not message_id:
        raise MatimoError(
            "ms_send_email: Microsoft Graph did not return an ID for the created draft message.",
            ErrorCode.EXECUTION_FAILED,
            {"draft": draft},
        )

    await graph_request(
        method="POST",
        path=f"/me/messages/{quote(message_id, safe='')}/send",
        token=token,
        resource_type="Mail draft",
        allow_empty_response=True,
    )

    return {
        "success": True,
        "sent": True,
        "message_id": message_id,
    }
