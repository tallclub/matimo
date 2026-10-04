"""
Per-call approval over MCP: ask the human behind the MCP client through an
elicitation request instead of trusting a flag the model can set itself.
Mirrors typescript/packages/core/src/mcp/approval-elicitation.ts.
"""
from __future__ import annotations

import json
from typing import Any

from matimo.approval.handler import ApprovalCallback, ApprovalRequest
from matimo.errors import ErrorCode, MatimoError

# Arguments longer than this are cut short in the approval prompt.
_MAX_ARGUMENTS_CHARS = 2000

# The single yes/no field the client renders for the human.
APPROVAL_ELICITATION_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "approve": {
            "type": "boolean",
            "title": "Approve",
            "description": "Allow this one call to run",
        },
    },
    "required": ["approve"],
}


def approval_elicitation_message(request: ApprovalRequest) -> str:
    """What the human reads before deciding."""
    args = json.dumps(request.params or {}, indent=2, default=str)
    if len(args) > _MAX_ARGUMENTS_CHARS:
        args = f"{args[:_MAX_ARGUMENTS_CHARS]}\n… (truncated)"
    lines = [f'Allow the agent to run "{request.tool_name}"?']
    if request.description:
        lines.append(request.description.strip())
    lines += ["", "Arguments:", args]
    return "\n".join(lines)


def _supports_elicitation(session: Any) -> bool:  # noqa: ANN401
    try:
        import mcp.types as mcp_types

        return bool(
            session.check_client_capability(
                mcp_types.ClientCapabilities(elicitation=mcp_types.ElicitationCapability())
            )
        )
    except Exception:  # noqa: BLE001 — no session / older SDK: treat as unsupported
        return False


def create_elicitation_approval_callback(
    session: Any | None,  # noqa: ANN401 — mcp ServerSession
    related_request_id: str | int | None = None,
) -> ApprovalCallback:
    """
    Build an approval callback that asks the MCP client's user. Clients that
    can't elicit get an error saying so; the model is never told how to
    approve its own call.
    """

    async def ask(request: ApprovalRequest) -> bool:
        if session is None or not _supports_elicitation(session):
            raise MatimoError(
                f"Tool '{request.tool_name}' needs human approval, but this MCP client "
                "does not support elicitation, so there is no one to ask.",
                ErrorCode.EXECUTION_FAILED,
                {
                    "tool_name": request.tool_name,
                    "hint": (
                        "Use an MCP client that supports elicitation, pre-approve the tool on "
                        "the server with MATIMO_APPROVED_PATTERNS, or start the server with "
                        "trust_client_approval if the client itself confirms each call with "
                        "its user."
                    ),
                },
            )
        result = await session.elicit_form(
            approval_elicitation_message(request),
            APPROVAL_ELICITATION_SCHEMA,
            related_request_id=related_request_id,
        )
        content = result.content or {}
        return result.action == "accept" and content.get("approve") is True

    return ask
