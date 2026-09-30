"""
Governance decisions outside a tool's own run are emitted as events, as in
matimo-instance.ts: tool:quarantined when a call waits for on_hitl, and
tool:rejected / tool:quarantined when a reload re-checks an untrusted tool.
"""
from __future__ import annotations

from pathlib import Path
from typing import Any

import pytest

from matimo import Matimo, PolicyConfig, PolicyContext

GET_TOOL = """name: get_item
version: '1.0.0'
description: Fetch an item
execution:
  type: http
  method: GET
  url: 'https://api.example.com/item'
"""

SHELL_TOOL = """name: shell
version: '1.0.0'
description: Run ls
requires_approval: true
execution:
  type: command
  command: ls
"""

POSTER_TOOL = """name: poster
version: '1.0.0'
description: Post an item
requires_approval: true
execution:
  type: http
  method: POST
  url: 'https://api.example.com/item'
"""


def _write(directory: Path, name: str, yaml: str) -> None:
    (directory / name).mkdir(parents=True)
    (directory / name / "definition.yaml").write_text(yaml)


@pytest.mark.asyncio
async def test_quarantined_call_emits_tool_quarantined_before_on_hitl(tmp_path: Path) -> None:
    _write(tmp_path / "tools", "get_item", GET_TOOL)
    events: list[dict[str, Any]] = []
    seen_at_hitl: list[str] = []

    async def on_hitl(_request: Any) -> bool:  # noqa: ANN401
        seen_at_hitl.extend(event["type"] for event in events)
        return False

    matimo = await Matimo.init(
        str(tmp_path / "tools"),
        log_level="silent",
        approval_dir=str(tmp_path),
        policy_config=PolicyConfig(enable_hitl=True, hitl_min_risk_level="low"),
        on_hitl=on_hitl,
        on_event=events.append,
    )
    with pytest.raises(Exception, match="Human approval denied"):
        await matimo.execute("get_item", {}, context=PolicyContext(environment="staging"))

    quarantined = next(e for e in events if e["type"] == "tool:quarantined")
    assert set(quarantined) == {
        "type", "tool_name", "risk_level", "reason", "environment", "timestamp"
    }
    assert quarantined["tool_name"] == "get_item"
    assert quarantined["risk_level"] == "low"
    assert quarantined["environment"] == "staging"
    assert "tool:quarantined" in seen_at_hitl
    assert [e["type"] for e in events][-1] == "tool:quarantine_rejected"


@pytest.mark.asyncio
async def test_no_environment_key_without_one_in_the_context(tmp_path: Path) -> None:
    _write(tmp_path / "tools", "get_item", GET_TOOL)
    events: list[dict[str, Any]] = []

    async def on_hitl(_request: Any) -> bool:  # noqa: ANN401
        return True

    matimo = await Matimo.init(
        str(tmp_path / "tools"),
        log_level="silent",
        approval_dir=str(tmp_path),
        policy_config=PolicyConfig(enable_hitl=True, hitl_min_risk_level="low"),
        on_hitl=on_hitl,
        on_event=events.append,
    )
    import httpx
    import respx

    with respx.mock:
        respx.get("https://api.example.com/item").mock(return_value=httpx.Response(200, json={}))
        await matimo.execute("get_item", {})
    quarantined = next(e for e in events if e["type"] == "tool:quarantined")
    assert "environment" not in quarantined


@pytest.mark.asyncio
async def test_reload_emits_rejected_and_quarantined_for_untrusted_tools(tmp_path: Path) -> None:
    untrusted = tmp_path / "untrusted"
    _write(untrusted, "shell", SHELL_TOOL)
    _write(untrusted, "poster", POSTER_TOOL)
    events: list[dict[str, Any]] = []
    matimo = await Matimo.init(
        str(untrusted),
        log_level="silent",
        untrusted_paths=[str(untrusted)],
        approval_dir=str(tmp_path),
        policy_config=PolicyConfig(enable_hitl=True, quarantine_risk_levels=["medium", "high"]),
        on_event=events.append,
    )
    events.clear()

    result = await matimo.reload()

    assert result.rejected == ["shell"]
    rejected = next(e for e in events if e["type"] == "tool:rejected")
    assert rejected["tool_name"] == "shell"
    assert rejected["violations"][0]["rule"] == "policy-denied"
    assert rejected["violations"][0]["severity"] == "high"
    quarantined = next(e for e in events if e["type"] == "tool:quarantined")
    assert quarantined["tool_name"] == "poster"
    assert quarantined["risk_level"] in ("medium", "high")
    assert "environment" not in quarantined
