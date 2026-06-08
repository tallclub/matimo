"""
ms_send_teams_message
  New message:  POST /teams/{team-id}/channels/{channel-id}/messages
                https://learn.microsoft.com/en-us/graph/api/channel-post-messages
  Reply:        POST /teams/{team-id}/channels/{channel-id}/messages/{message-id}/replies
                https://learn.microsoft.com/en-us/graph/api/chatmessage-post-replies
Mirrors: typescript/packages/microsoft/tools/ms_send_teams_message/ms_send_teams_message.ts
"""
from __future__ import annotations

from typing import Any
from urllib.parse import quote

from matimo.errors import ErrorCode, MatimoError
from matimo_microsoft.graph_client import get_access_token, graph_request, require_params

_VALID_CONTENT_TYPES = ["text", "html"]


async def run(params: dict[str, Any]) -> dict[str, Any]:
    require_params(params, ["team_id", "channel_id", "text"], "ms_send_teams_message")

    team_id = str(params["team_id"])
    channel_id = str(params["channel_id"])
    text = str(params["text"])

    content_type_param = params.get("content_type")
    content_type = "text" if content_type_param is None else str(content_type_param)
    if content_type not in _VALID_CONTENT_TYPES:
        raise MatimoError(
            f"ms_send_teams_message: 'content_type' must be one of {', '.join(_VALID_CONTENT_TYPES)} "
            f"(received '{content_type}')",
            ErrorCode.VALIDATION_FAILED,
            {"content_type": content_type_param},
        )

    reply_to_param = params.get("reply_to_message_id")
    reply_to_message_id = reply_to_param if isinstance(reply_to_param, str) and reply_to_param else None

    token = get_access_token(params)

    base_path = f"/teams/{quote(team_id, safe='')}/channels/{quote(channel_id, safe='')}/messages"
    path = f"{base_path}/{quote(reply_to_message_id, safe='')}/replies" if reply_to_message_id else base_path

    message = await graph_request(
        method="POST",
        path=path,
        token=token,
        resource_type="Teams channel",
        body={"body": {"contentType": content_type, "content": text}},
    )
    message = message if isinstance(message, dict) else {}

    return {
        "success": True,
        "message_id": message.get("id") or "",
        "web_url": message.get("webUrl") or "",
        "created_at": message.get("createdDateTime") or "",
    }
