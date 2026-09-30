"""Mirrors typescript/packages/core/test/unit/mcp/approval-elicitation.test.ts."""
from __future__ import annotations

from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest

from matimo.approval.handler import ApprovalRequest
from matimo.errors import MatimoError
from matimo.mcp.approval_elicitation import (
    APPROVAL_ELICITATION_SCHEMA,
    approval_elicitation_message,
    create_elicitation_approval_callback,
)

pytestmark = pytest.mark.asyncio

REQUEST = ApprovalRequest(tool_name="wipe", description="Delete a record", params={"id": 42})


def _session(*, can_elicit: bool, action: str = "accept", content: Any = None) -> MagicMock:  # noqa: ANN401
    session = MagicMock()
    session.check_client_capability.return_value = can_elicit
    session.elicit_form = AsyncMock(return_value=MagicMock(action=action, content=content))
    return session


@pytest.mark.parametrize(
    ("action", "content", "expected"),
    [
        ("accept", {"approve": True}, True),
        ("accept", {"approve": False}, False),
        ("accept", None, False),
        ("decline", None, False),
        ("cancel", None, False),
    ],
)
async def test_answer_maps_to_decision(action: str, content: Any, expected: bool) -> None:  # noqa: ANN401
    session = _session(can_elicit=True, action=action, content=content)
    assert await create_elicitation_approval_callback(session)(REQUEST) is expected


async def test_asks_with_the_approval_schema_and_request_id() -> None:
    session = _session(can_elicit=True, content={"approve": True})
    await create_elicitation_approval_callback(session, "req-1")(REQUEST)
    session.elicit_form.assert_awaited_once_with(
        approval_elicitation_message(REQUEST),
        APPROVAL_ELICITATION_SCHEMA,
        related_request_id="req-1",
    )


@pytest.mark.parametrize("session", [None, _session(can_elicit=False)], ids=["no-session", "no-elicitation"])
async def test_fails_with_an_actionable_error(session: Any) -> None:  # noqa: ANN401
    with pytest.raises(MatimoError, match="does not support elicitation"):
        await create_elicitation_approval_callback(session)(REQUEST)


async def test_capability_check_errors_count_as_unsupported() -> None:
    session = _session(can_elicit=True)
    session.check_client_capability.side_effect = RuntimeError("not initialised")
    with pytest.raises(MatimoError, match="does not support elicitation"):
        await create_elicitation_approval_callback(session)(REQUEST)


def test_message_shows_tool_description_and_arguments() -> None:
    message = approval_elicitation_message(REQUEST)
    assert '"wipe"' in message
    assert "Delete a record" in message
    assert '"id": 42' in message


def test_message_truncates_long_arguments() -> None:
    message = approval_elicitation_message(
        ApprovalRequest(tool_name="t", description=None, params={"blob": "x" * 5000})
    )
    assert "(truncated)" in message
    assert len(message) < 2300
