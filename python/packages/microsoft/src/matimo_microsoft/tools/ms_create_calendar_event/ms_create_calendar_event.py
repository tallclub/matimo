"""
ms_create_calendar_event — POST /me/events
https://learn.microsoft.com/en-us/graph/api/user-post-events
Mirrors: typescript/packages/microsoft/tools/ms_create_calendar_event/ms_create_calendar_event.ts
"""
from __future__ import annotations

from typing import Any

from matimo.errors import ErrorCode, MatimoError
from matimo_microsoft.graph_client import get_access_token, graph_request, require_params

_DEFAULT_TIMEZONE = "UTC"


def _to_attendee_list(value: Any) -> list[dict[str, Any]]:
    if value is None:
        return []
    if not isinstance(value, list) or any(not isinstance(entry, str) or not entry for entry in value):
        raise MatimoError(
            "ms_create_calendar_event: 'attendees' must be an array of email address strings",
            ErrorCode.VALIDATION_FAILED,
            {"attendees": value},
        )
    return [{"emailAddress": {"address": address}, "type": "required"} for address in value]


async def run(params: dict[str, Any]) -> dict[str, Any]:
    require_params(params, ["subject", "start", "end"], "ms_create_calendar_event")

    subject = str(params["subject"])
    start = str(params["start"])
    end = str(params["end"])
    timezone_param = params.get("timezone")
    timezone = timezone_param if isinstance(timezone_param, str) and timezone_param else _DEFAULT_TIMEZONE

    attendees = _to_attendee_list(params.get("attendees"))
    is_online_meeting = params.get("is_online_meeting") is True

    token = get_access_token(params)

    body_param = params.get("body")
    location_param = params.get("location")

    event_body: dict[str, Any] = {
        "subject": subject,
        **(
            {"body": {"contentType": "Text", "content": body_param}}
            if isinstance(body_param, str) and body_param
            else {}
        ),
        "start": {"dateTime": start, "timeZone": timezone},
        "end": {"dateTime": end, "timeZone": timezone},
        **({"attendees": attendees} if attendees else {}),
        **(
            {"location": {"displayName": location_param}}
            if isinstance(location_param, str) and location_param
            else {}
        ),
        "isOnlineMeeting": is_online_meeting,
        **({"onlineMeetingProvider": "teamsForBusiness"} if is_online_meeting else {}),
    }

    event = await graph_request(
        method="POST",
        path="/me/events",
        token=token,
        resource_type="Calendar",
        body=event_body,
    )
    event = event if isinstance(event, dict) else {}

    online_meeting = event.get("onlineMeeting") or {}
    join_url = online_meeting.get("joinUrl")

    return {
        "success": True,
        "event_id": event.get("id") or "",
        "web_link": event.get("webLink") or "",
        **({"join_url": join_url} if join_url else {}),
    }
