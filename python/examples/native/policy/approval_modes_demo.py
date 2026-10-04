#!/usr/bin/env python3
"""
============================================================================
APPROVAL MODES — who decides, and when a call must ask
============================================================================

A call needs a human's approval when its tool declares
`requires_approval: true`, when it is an HTTP DELETE or `type: command` tool
that does not declare `requires_approval: false` (the 0.2.0 secure default),
or when its `sql`/`command` contains a destructive keyword.

Who decides, in order: `execute(..., on_approval=...)` for one call, then the
instance's `on_approval`, then the process-wide handler. With none of them,
the call is rejected. Tools matched by MATIMO_APPROVED_PATTERNS skip the
question.

Separately, `enable_hitl` quarantines every call whose risk is at or above
`hitl_min_risk_level` until `on_hitl` approves it, and function tools receive
the caller's policy context.

No API keys needed. The DELETE calls go to the JSONPlaceholder test API,
which only pretends to delete. Mirrors approval-modes-demo.ts.

USAGE:
  uv run python native/policy/approval_modes_demo.py
============================================================================
"""

from __future__ import annotations

import asyncio
import shutil
import tempfile
from pathlib import Path
from typing import Any

from matimo import (
    ApprovalRequest,
    HITLRequest,
    Matimo,
    PolicyConfig,
    PolicyContext,
    definition_requires_approval,
)

TOOLS: dict[str, str] = {
    "shell_echo/definition.yaml": """name: shell_echo
version: '1.0.0'
description: Print a greeting with the echo command
execution:
  type: command
  command: echo
  args: ['hello from a command tool']
""",
    "delete_post/definition.yaml": """name: delete_post
version: '1.0.0'
description: Delete a post (JSONPlaceholder only pretends to)
execution:
  type: http
  method: DELETE
  url: 'https://jsonplaceholder.typicode.com/posts/1'
""",
    "delete_draft/definition.yaml": """name: delete_draft
version: '1.0.0'
description: Delete a scratch draft; opted out of per-call approval
requires_approval: false
execution:
  type: http
  method: DELETE
  url: 'https://jsonplaceholder.typicode.com/posts/2'
""",
    "get_post/definition.yaml": """name: get_post
version: '1.0.0'
description: Fetch one post
execution:
  type: http
  method: GET
  url: 'https://jsonplaceholder.typicode.com/posts/1'
""",
    "whoami/definition.yaml": """name: whoami
version: '1.0.0'
description: Report which agent is calling
risk: low
execution:
  type: function
  code: './whoami.py'
""",
    # A function tool's second argument carries the caller's policy context.
    "whoami/whoami.py": """def run(params, context=None):
    caller = context.policy_context if context else None
    return {
        "agent_id": caller.agent_id if caller else None,
        "roles": list(caller.roles or []) if caller else [],
    }
""",
}


def approve(label: str) -> Any:  # noqa: ANN401
    async def callback(request: ApprovalRequest) -> bool:
        print(f"   🔒 {label} approves {request.tool_name}")
        return True

    return callback


def decline(label: str) -> Any:  # noqa: ANN401
    async def callback(request: ApprovalRequest) -> bool:
        print(f"   🔒 {label} declines {request.tool_name}")
        return False

    return callback


async def attempt(matimo: Matimo, tool: str, **options: Any) -> None:  # noqa: ANN401
    try:
        await matimo.execute(tool, {}, **options)
        print(f"   ✅ {tool} ran")
    except Exception as error:  # noqa: BLE001
        print(f"   ⛔ {tool}: {error}")


async def main() -> None:
    work_dir = Path(tempfile.mkdtemp(prefix="matimo-approval-"))
    tools_dir = work_dir / "tools"
    for rel, content in TOOLS.items():
        target = tools_dir / rel
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content)
    base: dict[str, Any] = {"log_level": "silent", "approval_dir": str(work_dir)}

    try:
        print("\n1. Which tools ask on every call?")
        probe = await Matimo.init(str(tools_dir), **base)
        for tool in sorted(probe.list_tools(), key=lambda t: t.name):
            print(
                f"   {tool.name:<13} secure={definition_requires_approval(tool, 'secure')}"
                f"  legacy={definition_requires_approval(tool, 'legacy')}"
            )

        print(
            f"\n2. Secure mode ({probe.get_governance_mode()}) with no approval callback"
        )
        await attempt(probe, "shell_echo")

        print("\n3. An instance on_approval callback decides")
        secure = await Matimo.init(
            str(tools_dir), **base, on_approval=approve("instance callback")
        )
        await attempt(secure, "shell_echo")
        await attempt(secure, "delete_post")

        print("\n4. A per-call on_approval overrides the instance callback")
        await attempt(secure, "delete_post", on_approval=decline("per-call callback"))

        print("\n5. requires_approval: false opts a DELETE tool out")
        await attempt(probe, "delete_draft")

        print('\n6. governance_mode="legacy" restores the pre-0.2.0 default')
        legacy = await Matimo.init(str(tools_dir), **base, governance_mode="legacy")
        print(f"   mode: {legacy.get_governance_mode()}")
        await attempt(legacy, "shell_echo")

        print("\n7. HITL quarantine for calls at or above hitl_min_risk_level: high")

        async def on_hitl(request: HITLRequest) -> bool:
            print(
                f"   🛑 on_hitl: {request.tool_name} ({request.risk_level}) — approved"
            )
            return True

        quarantined = await Matimo.init(
            str(tools_dir),
            **base,
            policy_config=PolicyConfig(enable_hitl=True, hitl_min_risk_level="high"),
            on_hitl=on_hitl,
            on_approval=approve("instance callback"),
            on_event=lambda event: print(f"   📣 {event['type']}"),
        )
        await attempt(quarantined, "get_post")
        await attempt(quarantined, "delete_post")

        print("\n8. Function tools receive the caller's policy context")
        result = await probe.execute(
            "whoami", {}, context=PolicyContext(agent_id="agent-7", roles=["analyst"])
        )
        print(f"   whoami → {result}\n")
    finally:
        shutil.rmtree(work_dir, ignore_errors=True)


if __name__ == "__main__":
    asyncio.run(main())
