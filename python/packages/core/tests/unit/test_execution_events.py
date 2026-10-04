"""
tool:executed / tool:execution_failed carry exactly the fields in
conformance/events/execution-events.json — the same spec the TS SDK's
execution-events.test.ts asserts (camelCase there, snake_case here).
"""
from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

import pytest

from matimo import Matimo
from matimo.core.models import PolicyContext
from matimo.policy.types import PolicyConfig

pytestmark = pytest.mark.asyncio

_SPEC: dict[str, dict[str, list[str]]] = json.loads(
    (Path(__file__).resolve().parents[5] / "conformance" / "events" / "execution-events.json")
    .read_text(encoding="utf-8")
)["events"]


def _snake(name: str) -> str:
    return re.sub(r"(?<!^)([A-Z])", r"_\1", name).lower()


def _assert_fields_match_spec(event: dict[str, Any]) -> None:
    spec = _SPEC[event["type"]]
    required = {_snake(k) for k in spec["required"]}
    allowed = required | {_snake(k) for k in spec["optional"]}
    assert required <= event.keys()
    assert set(event.keys()) <= allowed, set(event.keys()) - allowed


def _write_function_tool(root: Path, name: str, risk: str, body: str) -> None:
    tool_dir = root / name
    tool_dir.mkdir()
    (tool_dir / "definition.yaml").write_text(
        f"name: {name}\nversion: '1.0.0'\nrisk: {risk}\ndescription: d\n"
        f"execution:\n  type: function\n  code: './{name}.py'\n"
    )
    (tool_dir / f"{name}.py").write_text(body)


async def _matimo(tmp_path: Path, events: list[dict[str, Any]], **kwargs: Any) -> Matimo:  # noqa: ANN401
    if not (tmp_path / "ok").exists():
        _write_function_tool(tmp_path, "ok", "low", "async def run(params):\n    return {'success': True}\n")
        _write_function_tool(
            tmp_path, "soft_fail", "medium", "async def run(params):\n    return {'success': False}\n"
        )
        _write_function_tool(
            tmp_path, "boom", "high", "async def run(params):\n    raise RuntimeError('kaboom')\n"
        )
    return await Matimo.init(str(tmp_path), on_event=events.append, log_level="silent", **kwargs)


async def test_executed_for_a_successful_run(tmp_path: Path) -> None:
    events: list[dict[str, Any]] = []
    matimo = await _matimo(tmp_path, events)
    await matimo.execute("ok", {}, context=PolicyContext(agent_id="agent-1"))
    [event] = [e for e in events if e["type"] == "tool:executed"]
    _assert_fields_match_spec(event)
    assert event["tool_name"] == "ok"
    assert event["agent_id"] == "agent-1"
    assert event["success"] is True
    assert event["risk_level"] == "low"
    assert isinstance(event["duration_ms"], int)


async def test_success_false_when_the_tool_reports_failure(tmp_path: Path) -> None:
    events: list[dict[str, Any]] = []
    matimo = await _matimo(tmp_path, events)
    await matimo.execute("soft_fail", {})
    [event] = [e for e in events if e["type"] == "tool:executed"]
    _assert_fields_match_spec(event)
    assert event["success"] is False
    assert event["risk_level"] == "medium"
    assert "agent_id" not in event


async def test_execution_failed_when_the_tool_raises(tmp_path: Path) -> None:
    events: list[dict[str, Any]] = []
    matimo = await _matimo(tmp_path, events)
    with pytest.raises(Exception, match="kaboom"):
        await matimo.execute("boom", {})
    failures = [e for e in events if e["type"] == "tool:execution_failed"]
    assert len(failures) == 1
    _assert_fields_match_spec(failures[0])
    assert failures[0]["risk_level"] == "high"
    assert failures[0]["error_code"] == "EXECUTION_FAILED"
    assert not any(e["type"] == "tool:executed" for e in events)


async def test_neither_when_a_gate_refuses(tmp_path: Path) -> None:
    events: list[dict[str, Any]] = []
    matimo = await _matimo(
        tmp_path, events, policy_config=PolicyConfig(enable_hitl=True, hitl_min_risk_level="low")
    )
    with pytest.raises(Exception, match="(?i)approval"):
        await matimo.execute("ok", {})
    types = {e["type"] for e in events}
    assert "tool:executed" not in types
    assert "tool:execution_failed" not in types


async def test_each_call_gets_its_own_trace_id(tmp_path: Path) -> None:
    events: list[dict[str, Any]] = []
    matimo = await _matimo(tmp_path, events)
    await matimo.execute("ok", {})
    await matimo.execute("ok", {})
    ids = [e["trace_id"] for e in events if e["type"] == "tool:executed"]
    assert len(set(ids)) == 2
