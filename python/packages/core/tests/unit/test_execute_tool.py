"""Unit tests for the execute tool (parity with typescript execute.ts)."""
from __future__ import annotations

import sys

import pytest

from matimo.approval.handler import ApprovalHandler, requires_mandatory_human_approval
from matimo.errors import ErrorCode, MatimoError
from matimo.tools.execute.execute import _split_command, run

PY = sys.executable


@pytest.mark.asyncio
async def test_args_are_appended_to_command() -> None:
    result = await run({"command": PY, "args": ["-c", "print('a b')"]})
    assert result["success"] is True
    assert result["stdout"] == "a b"


@pytest.mark.asyncio
async def test_embedded_args_still_work() -> None:
    result = await run({"command": f'"{PY}" -c "print(1)"'})
    assert result["stdout"] == "1"


@pytest.mark.asyncio
async def test_nonzero_exit_code_and_trimmed_output() -> None:
    result = await run({"command": PY, "args": ["-c", "import sys; print('x'); sys.exit(3)"]})
    assert result["success"] is False
    assert result["exitCode"] == 3
    assert result["stdout"] == "x"


@pytest.mark.asyncio
async def test_spawn_failure_reports_exit_code_1() -> None:
    result = await run({"command": "definitely_not_a_real_binary_xyz"})
    assert result["success"] is False
    assert result["exitCode"] == 1
    assert result["stderr"]


@pytest.mark.asyncio
async def test_timeout_reports_exit_code_minus_1() -> None:
    result = await run({"command": PY, "args": ["-c", "import time; time.sleep(5)"], "timeout": 200})
    assert result["success"] is False
    assert result["exitCode"] == -1


@pytest.mark.asyncio
@pytest.mark.parametrize("command", ["echo a; ls", "a | b", "a\nb", "echo $SECRET", "a `b`"])
async def test_injection_rejected(command: str) -> None:
    with pytest.raises(MatimoError) as exc:
        await run({"command": command})
    assert exc.value.code == ErrorCode.INVALID_PARAMETER


@pytest.mark.asyncio
async def test_empty_command_and_bad_args_rejected() -> None:
    with pytest.raises(MatimoError):
        await run({"command": "  "})
    with pytest.raises(MatimoError):
        await run({"command": PY, "args": "nope"})
    with pytest.raises(MatimoError):
        await run({"command": PY, "args": [1]})


def test_split_command_quotes_and_unterminated() -> None:
    assert _split_command("a 'b c' \"d e\"") == ["a", "b c", "d e"]
    with pytest.raises(MatimoError):
        _split_command("a 'b")


SH = "cmd" if sys.platform == "win32" else "/bin/sh"
PIPELINE = "echo hi | findstr hi" if sys.platform == "win32" else "echo hi | cat"


@pytest.mark.asyncio
async def test_shell_runs_a_pipeline() -> None:
    result = await run({"command": PIPELINE, "shell": SH})
    assert result["success"] is True
    assert result["stdout"] == "hi"


@pytest.mark.asyncio
async def test_shell_passes_args_as_positional_parameters() -> None:
    if sys.platform == "win32":
        pytest.skip("POSIX shell only")
    result = await run({"command": 'echo "$1-$2"', "args": ["a", "b c"], "shell": SH})
    assert result["stdout"] == "a-b c"


@pytest.mark.asyncio
async def test_shell_rejects_bad_values() -> None:
    with pytest.raises(MatimoError):
        await run({"command": "echo", "shell": "sh\nrm"})
    with pytest.raises(MatimoError):
        await run({"command": "echo", "shell": True})
    with pytest.raises(MatimoError):
        await run({"command": "echo", "args": ["x"], "shell": "cmd.exe"})
    with pytest.raises(MatimoError):
        await run({"command": "echo", "args": ["x"], "shell": "pwsh"})


def test_mandatory_human_approval_only_for_execute_with_shell() -> None:
    assert requires_mandatory_human_approval("execute", {"command": "ls", "shell": "/bin/sh"})
    assert not requires_mandatory_human_approval("execute", {"command": "ls"})
    assert not requires_mandatory_human_approval("execute", {"command": "ls", "shell": ""})
    assert not requires_mandatory_human_approval("other", {"shell": "/bin/sh"})
    assert not requires_mandatory_human_approval("execute", None)


def test_shell_call_is_never_pre_approved(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("MATIMO_AUTO_APPROVE", "true")
    monkeypatch.setenv("MATIMO_APPROVED_PATTERNS", "*")
    handler = ApprovalHandler()
    assert handler.is_pre_approved("execute", {"command": "ls", "shell": "/bin/sh"}) is False
    # without a shell the pre-approval settings still apply
    assert handler.is_pre_approved("execute", {"command": "ls"}) is True
    assert handler.is_pre_approved("execute") is True


@pytest.mark.asyncio
async def test_instance_asks_a_human_for_shell_despite_every_skip(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from matimo import Matimo

    monkeypatch.setenv("MATIMO_AUTO_APPROVE", "true")
    monkeypatch.setenv("MATIMO_APPROVED_PATTERNS", "*")
    params = {"command": PIPELINE, "shell": SH}

    # no callback: fails closed even with auto-approve, a pattern and approved=True
    m = await Matimo.init(auto_discover=True, log_level="silent")
    with pytest.raises(MatimoError):
        await m.execute("execute", params, approved=True)

    # with a callback: the human is asked, and a refusal is honoured
    asked: list[str] = []

    async def deny(request: object) -> bool:
        asked.append(request.tool_name)  # type: ignore[attr-defined]
        return False

    m = await Matimo.init(auto_discover=True, log_level="silent", on_approval=deny)
    with pytest.raises(MatimoError):
        await m.execute("execute", params, approved=True)
    assert asked == ["execute"]
