#!/usr/bin/env python3
"""
============================================================================
AUDIT LOG — tamper-evident record of every governed tool call
============================================================================

Every governance decision and every tool run is emitted as an event. Pass
`on_event` to watch them live, and `audit_sink` to keep them. The built-in
`JsonlFileSink` writes one JSON line per event, each chained to the previous
by SHA-256, so `verify_audit_log()` reports the first line that was edited,
deleted or reordered. The TypeScript SDK writes the same format: a log
written by either SDK verifies in the other.

This example:
  1. Runs a successful call          → tool:executed (success: True)
  2. Runs a call that throws         → tool:execution_failed
  3. Approves one call, declines one → tool:approval_granted / _denied
  4. Verifies the log, then edits one line and verifies again
  5. Reopens the log: a new sink continues the same hash chain

No API keys needed. Calls the public JSONPlaceholder test API.
Mirrors audit-log-demo.ts.

USAGE:
  uv run python native/policy/audit_log_demo.py
============================================================================
"""

from __future__ import annotations

import asyncio
import json
import shutil
import tempfile
from dataclasses import asdict
from pathlib import Path
from typing import Any

from matimo import (
    ApprovalRequest,
    JsonlFileSink,
    Matimo,
    redact_secrets,
    verify_audit_log,
)

GET_POST_YAML = """name: get_post
version: '1.0.0'
description: Fetch one post from the JSONPlaceholder test API
parameters:
  id:
    type: number
    description: Post id
    required: true
execution:
  type: http
  method: GET
  url: 'https://jsonplaceholder.typicode.com/posts/{id}'
"""


async def approve_reads_only(request: ApprovalRequest) -> bool:
    """Approves reads, declines everything else, so both outcomes are logged."""
    approved = request.tool_name == "read"
    print(
        f"   🔒 {request.tool_name} needs approval → {'approved' if approved else 'declined'}"
    )
    return approved


def describe(event: dict[str, Any]) -> str:
    kind = event["type"]
    if kind == "tool:executed":
        return (
            f"{event['tool_name']} success={event['success']} "
            f"{event['duration_ms']}ms risk={event['risk_level']}"
        )
    if kind == "tool:execution_failed":
        return f"{event['tool_name']} {event['error_code']}: {event['error']}"
    if kind == "tool:approval_granted":
        return event["tool_name"]
    if kind == "tool:approval_denied":
        return f"{event['tool_name']}: {event['reason']}"
    return ""


async def main() -> None:
    work_dir = Path(tempfile.mkdtemp(prefix="matimo-audit-"))
    tools_dir = work_dir / "tools"
    (tools_dir / "get_post").mkdir(parents=True)
    (tools_dir / "get_post" / "definition.yaml").write_text(GET_POST_YAML)
    log_file = work_dir / "audit.jsonl"

    try:
        print(f"\n📝 Audit log: {log_file}\n")

        matimo = await Matimo.init(
            str(tools_dir),
            auto_discover=True,
            log_level="silent",
            audit_sink=JsonlFileSink(log_file),
            on_event=lambda event: print(
                f"   📣 {event['type']:<22} {describe(event)}"
            ),
            on_approval=approve_reads_only,
        )

        print("1. A successful call")
        await matimo.execute("get_post", {"id": 1})

        print("\n2. A call that throws (HTTP 404)")
        try:
            await matimo.execute("get_post", {"id": 0})
        except Exception:  # noqa: BLE001
            pass

        print("\n3. One call approved, one declined")
        await matimo.execute(
            "read", {"filePath": __file__, "startLine": 1, "endLine": 3}
        )
        try:
            await matimo.execute(
                "edit",
                {
                    "filePath": str(work_dir / "notes.txt"),
                    "operation": "append",
                    "content": "x",
                    "startLine": 1,
                },
            )
        except Exception:  # noqa: BLE001
            pass

        print("\n4. Verify the log")
        lines = log_file.read_text().strip().split("\n")
        print(f"   First line: {lines[0][:150]}…")
        print(f"   {asdict(verify_audit_log(log_file))}")

        edited = list(lines)
        edited[1] = edited[1].replace('"tool:execution_failed"', '"tool:executed"')
        tampered = work_dir / "tampered.jsonl"
        tampered.write_text("\n".join(edited) + "\n")
        print(f"   After editing line 2: {asdict(verify_audit_log(tampered))}")

        print("\n5. Reopen the log: a new sink continues the chain")
        following = await Matimo.init(
            str(tools_dir), log_level="silent", audit_sink=JsonlFileSink(log_file)
        )
        await following.execute("get_post", {"id": 2})
        print(f"   {asdict(verify_audit_log(log_file))}")

        print("\n6. Values under secret-named keys never reach the log")
        redacted = redact_secrets(
            {
                "user": "ada",
                "apiKey": "sk-live-123",
                "headers": {"Authorization": "Bearer x"},
            }
        )
        print(f"   {json.dumps(redacted)}\n")
    finally:
        shutil.rmtree(work_dir, ignore_errors=True)


if __name__ == "__main__":
    asyncio.run(main())
