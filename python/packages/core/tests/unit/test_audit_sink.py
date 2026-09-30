"""
Hash-chain and redaction rules come from conformance/audit/hash-chain.json,
which the TS SDK's audit-sink.test.ts asserts too.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest

from matimo import (
    AUDIT_GENESIS_HASH,
    AuditLogVerification,
    AuditSink,
    JsonlFileSink,
    Matimo,
    hash_audit_entry,
    redact_secrets,
    verify_audit_log,
)
from matimo.policy.audit_sink import canonical_json, is_secret_key

_SPEC: dict[str, Any] = json.loads(
    (Path(__file__).resolve().parents[5] / "conformance" / "audit" / "hash-chain.json")
    .read_text(encoding="utf-8")
)


def _event(tool_name: str) -> dict[str, Any]:
    return {
        "type": "tool:execution_denied",
        "tool_name": tool_name,
        "reason": "denied",
        "timestamp": "2026-09-30T00:00:00.000Z",
    }


def _lines(path: Path) -> list[str]:
    return path.read_text(encoding="utf-8").strip().split("\n")


@pytest.fixture
def log_file(tmp_path: Path) -> Path:
    return tmp_path / "logs" / "audit.jsonl"


# ── conformance ──────────────────────────────────────────────────────────────


def test_genesis_hash_matches_spec() -> None:
    assert _SPEC["genesisPrevHash"] == AUDIT_GENESIS_HASH


def test_canonical_json_matches_spec() -> None:
    example = _SPEC["canonicalJsonExample"]
    assert canonical_json(example["value"]) == example["expected"]


@pytest.mark.parametrize(("key", "secret"), list(_SPEC["secretKeys"].items()))
def test_is_secret_key_matches_spec(key: str, secret: bool) -> None:
    assert is_secret_key(key) is secret


def test_writes_the_specified_entries(log_file: Path) -> None:
    sink = JsonlFileSink(log_file)
    for entry in _SPEC["entries"]:
        sink.write(entry["event"])
    assert [json.loads(ln) for ln in _lines(log_file)] == [e["expected"] for e in _SPEC["entries"]]


def test_integral_floats_hash_like_javascript() -> None:
    assert hash_audit_entry(1, AUDIT_GENESIS_HASH, {"n": 2.0}) == hash_audit_entry(
        1, AUDIT_GENESIS_HASH, {"n": 2}
    )


# ── sink behaviour ───────────────────────────────────────────────────────────


def test_redacts_nested_secret_keys() -> None:
    assert redact_secrets({"a": [{"password": "p", "keep": 1}], "c": None, "token": {"x": 1}}) == {
        "a": [{"password": "[REDACTED]", "keep": 1}],
        "c": None,
        "token": "[REDACTED]",
    }


def test_continues_the_chain_of_an_existing_log(log_file: Path) -> None:
    JsonlFileSink(log_file).write(_event("a"))
    JsonlFileSink(log_file).write(_event("b"))
    first, second = (json.loads(ln) for ln in _lines(log_file))
    assert second["seq"] == 2
    assert second["prevHash"] == first["hash"]
    assert verify_audit_log(log_file) == AuditLogVerification(True, 2)


def test_starts_a_fresh_chain_for_an_empty_file(log_file: Path) -> None:
    log_file.parent.mkdir(parents=True)
    log_file.write_text("\n")
    JsonlFileSink(log_file).write(_event("a"))
    assert verify_audit_log(log_file) == AuditLogVerification(True, 1)


def test_refuses_to_continue_a_log_whose_last_line_is_not_an_entry(log_file: Path) -> None:
    log_file.parent.mkdir(parents=True)
    log_file.write_text('{"hello":"world"}\n')
    with pytest.raises(ValueError, match="not an audit entry"):
        JsonlFileSink(log_file)


def test_json_file_sink_is_an_audit_sink(log_file: Path) -> None:
    assert isinstance(JsonlFileSink(log_file), AuditSink)


# ── verify_audit_log ─────────────────────────────────────────────────────────


def _write_three(log_file: Path) -> list[str]:
    sink = JsonlFileSink(log_file)
    for name in ("a", "b", "c"):
        sink.write(_event(name))
    return _lines(log_file)


def test_verify_detects_an_edited_event(log_file: Path) -> None:
    lines = _write_three(log_file)
    lines[1] = lines[1].replace('"tool_name":"b"', '"tool_name":"z"')
    log_file.write_text("\n".join(lines))
    assert verify_audit_log(log_file) == AuditLogVerification(
        False, 1, 2, "hash does not match the entry"
    )


def test_verify_detects_a_deleted_line(log_file: Path) -> None:
    lines = _write_three(log_file)
    log_file.write_text("\n".join([lines[0], lines[2]]))
    assert verify_audit_log(log_file) == AuditLogVerification(
        False, 1, 2, "expected seq 2, got 3"
    )


def test_verify_detects_a_rehashed_line_that_breaks_the_chain(log_file: Path) -> None:
    lines = _write_three(log_file)
    forged = json.loads(lines[1])
    forged["prevHash"] = AUDIT_GENESIS_HASH
    forged["hash"] = hash_audit_entry(forged["seq"], forged["prevHash"], forged["event"])
    lines[1] = json.dumps(forged)
    log_file.write_text("\n".join(lines))
    assert verify_audit_log(log_file) == AuditLogVerification(
        False, 1, 2, "prevHash does not match the previous entry"
    )


def test_verify_detects_a_line_that_is_not_json(log_file: Path) -> None:
    lines = _write_three(log_file)
    lines[2] = "garbage"
    log_file.write_text("\n".join(lines))
    assert verify_audit_log(log_file) == AuditLogVerification(False, 2, 3, "not valid JSON")


def test_verify_rejects_a_line_that_is_not_an_object(log_file: Path) -> None:
    lines = _write_three(log_file)
    lines[0] = "5"
    log_file.write_text("\n".join(lines))
    assert verify_audit_log(log_file) == AuditLogVerification(
        False, 0, 1, "expected seq 1, got None"
    )


# ── Matimo(audit_sink=) ──────────────────────────────────────────────────────


def _write_ok_tool(root: Path) -> Path:
    tool_dir = root / "tools" / "ok"
    tool_dir.mkdir(parents=True)
    (tool_dir / "definition.yaml").write_text(
        "name: ok\nversion: '1.0.0'\nrisk: low\ndescription: d\n"
        "execution:\n  type: function\n  code: './ok.py'\n"
    )
    (tool_dir / "ok.py").write_text("async def run(params):\n    return {'success': True}\n")
    return tool_dir.parent


@pytest.mark.asyncio
async def test_matimo_records_events_alongside_on_event(tmp_path: Path, log_file: Path) -> None:
    seen: list[dict[str, Any]] = []
    matimo = await Matimo.init(
        str(_write_ok_tool(tmp_path)),
        on_event=seen.append,
        audit_sink=JsonlFileSink(log_file),
        log_level="silent",
    )
    await matimo.execute("ok", {})
    logged = [json.loads(ln)["event"] for ln in _lines(log_file)]
    assert [e["type"] for e in logged] == [e["type"] for e in seen]
    assert any(e["type"] == "tool:executed" for e in logged)
    assert verify_audit_log(log_file).valid


@pytest.mark.asyncio
async def test_matimo_keeps_executing_when_the_sink_raises(tmp_path: Path) -> None:
    class BrokenSink:
        def write(self, event: dict[str, Any]) -> None:
            raise OSError("disk full")

    matimo = await Matimo.init(
        str(_write_ok_tool(tmp_path)), audit_sink=BrokenSink(), log_level="silent"
    )
    assert await matimo.execute("ok", {}) == {"success": True}
