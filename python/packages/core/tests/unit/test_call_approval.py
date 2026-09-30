"""Per-call approval in Matimo.execute() — mirrors the approval step in
MatimoInstance.execute() (typescript/packages/core/src/matimo-instance.ts)."""
from __future__ import annotations

from pathlib import Path
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from matimo.approval.handler import ApprovalHandler, ApprovalRequest
from matimo.core.models import (
    CommandExecution,
    HttpExecution,
    Parameter,
    ParameterType,
    PolicyContext,
    ToolDefinition,
)
from matimo.core.registry import ToolRegistry
from matimo.errors import ErrorCode, MatimoError
from matimo.instance import Matimo
from matimo.policy.default_policy import DefaultPolicyEngine
from matimo.policy.types import PolicyConfig

pytestmark = pytest.mark.asyncio


def _http_tool(name: str, method: str = "GET", *, requires_approval: bool = False) -> ToolDefinition:
    return ToolDefinition(
        name=name,
        description=f"{method} tool",
        parameters={"sql": Parameter(type=ParameterType.STRING, description="q", required=False)},
        execution=HttpExecution(type="http", method=method, url="https://api.example.com/x"),
        requires_approval=requires_approval,
    )


def _command_tool() -> ToolDefinition:
    return ToolDefinition(
        name="run_shell",
        description="Run a shell command",
        parameters={"command": Parameter(type=ParameterType.STRING, description="c", required=True)},
        execution=CommandExecution(type="command", command="sh", args=["-c", "{command}"]),
    )


def _matimo(
    *tools: ToolDefinition,
    handler: ApprovalHandler,
    events: list[dict[str, Any]] | None = None,
    policy: PolicyConfig | None = None,
    on_approval: Any = None,  # noqa: ANN401
) -> Matimo:
    reg = ToolRegistry()
    for tool in tools:
        reg.register(tool)
    matimo = Matimo(
        registry=reg,
        policy_engine=DefaultPolicyEngine(policy or PolicyConfig(allow_command_tools=True)),
        loader=MagicMock(),
        tool_paths=[],
        on_event=events.append if events is not None else None,
        on_hitl=None,
        matimo_logger=MagicMock(),
        approval_handler=handler,
        on_approval=on_approval,
    )
    matimo._dispatch = AsyncMock(return_value={"ok": True})  # type: ignore[method-assign]
    return matimo


def _handler(decision: bool | None = None) -> ApprovalHandler:
    """A clean handler; `decision` installs a callback returning it."""
    with patch.dict("os.environ", {"MATIMO_AUTO_APPROVE": "", "MATIMO_APPROVED_PATTERNS": ""}):
        handler = ApprovalHandler()
    if decision is not None:
        handler.set_approval_callback(AsyncMock(return_value=decision))
    return handler


class TestRequiresApprovalFlag:
    async def test_no_callback_fails_closed(self) -> None:
        events: list[dict[str, Any]] = []
        matimo = _matimo(_http_tool("wipe", requires_approval=True), handler=_handler(), events=events)
        with pytest.raises(MatimoError, match="requires approval: wipe") as exc:
            await matimo.execute("wipe", {})
        assert exc.value.code == ErrorCode.EXECUTION_FAILED
        assert [e["type"] for e in events] == ["tool:approval_denied"]
        matimo._dispatch.assert_not_awaited()  # type: ignore[attr-defined]

    async def test_rejecting_callback_blocks(self) -> None:
        events: list[dict[str, Any]] = []
        matimo = _matimo(
            _http_tool("wipe", requires_approval=True), handler=_handler(False), events=events
        )
        with pytest.raises(MatimoError, match="rejected by approval handler: wipe"):
            await matimo.execute("wipe", {}, context=PolicyContext(agent_id="a1"))
        assert events[0]["type"] == "tool:approval_denied"
        assert events[0]["agent_id"] == "a1"
        matimo._dispatch.assert_not_awaited()  # type: ignore[attr-defined]

    async def test_approving_callback_runs_and_sees_the_call(self) -> None:
        events: list[dict[str, Any]] = []
        handler = _handler(True)
        matimo = _matimo(_http_tool("wipe", requires_approval=True), handler=handler, events=events)
        assert await matimo.execute("wipe", {"sql": "x"}) == {"ok": True}
        callback = handler.get_approval_callback()
        assert isinstance(callback, AsyncMock)
        request = callback.await_args.args[0]
        assert isinstance(request, ApprovalRequest)
        assert (request.tool_name, request.params) == ("wipe", {"sql": "x"})
        assert "tool:approval_granted" in [e["type"] for e in events]

    async def test_approved_true_skips_the_prompt(self) -> None:
        handler = _handler(False)
        matimo = _matimo(_http_tool("wipe", requires_approval=True), handler=handler)
        assert await matimo.execute("wipe", {}, approved=True) == {"ok": True}

    async def test_approved_pattern_skips_the_prompt_case_insensitively(self) -> None:
        handler = _handler(False)
        handler.add_approved_pattern("WIPE*")
        matimo = _matimo(_http_tool("wipe_all", requires_approval=True), handler=handler)
        assert await matimo.execute("wipe_all", {}) == {"ok": True}

    async def test_tools_without_the_flag_are_not_prompted(self) -> None:
        matimo = _matimo(_http_tool("read"), handler=_handler(False))
        assert await matimo.execute("read", {}) == {"ok": True}


class TestDestructiveContentScan:
    async def test_destructive_shell_command_prompts(self) -> None:
        matimo = _matimo(_command_tool(), handler=_handler(False))
        with pytest.raises(MatimoError, match="rejected"):
            await matimo.execute("run_shell", {"command": "DELETE everything"})

    async def test_harmless_shell_command_runs(self) -> None:
        matimo = _matimo(_command_tool(), handler=_handler(False))
        assert await matimo.execute("run_shell", {"command": "echo hi"}) == {"ok": True}

    async def test_destructive_sql_param_prompts(self) -> None:
        matimo = _matimo(_http_tool("query", "POST"), handler=_handler(False))
        with pytest.raises(MatimoError, match="rejected"):
            await matimo.execute("query", {"sql": "drop table users"})

    async def test_other_params_are_only_scanned_when_opted_in(self) -> None:
        tool = ToolDefinition(
            name="note",
            description="note",
            parameters={"text": Parameter(type=ParameterType.STRING, description="t", required=True)},
            execution=HttpExecution(type="http", method="POST", url="https://api.example.com/n"),
        )
        matimo = _matimo(tool, handler=_handler(False))
        assert await matimo.execute("note", {"text": "please delete me"}) == {"ok": True}
        with (
            patch.dict("os.environ", {"MATIMO_APPROVAL_SCAN_ALL_PARAMS": "true"}),
            pytest.raises(MatimoError, match="rejected"),
        ):
            await matimo.execute("note", {"text": "please delete me"})


class TestApprovalHandlerParity:
    def test_requires_approval_mirrors_ts(self) -> None:
        handler = _handler()
        assert handler.requires_approval(True) is True
        assert handler.requires_approval(False) is False
        assert handler.requires_approval(None, "select 1") is False
        assert handler.requires_approval(False, "truncate t") is True

    def test_is_pre_approved(self) -> None:
        handler = _handler()
        assert handler.is_pre_approved("x") is False
        handler.add_approved_pattern("slack_*")
        assert handler.is_pre_approved("Slack_Send") is True
        handler.auto_approve = True
        assert handler.is_pre_approved("anything") is True

    def test_callback_can_be_cleared(self) -> None:
        handler = _handler(True)
        handler.set_approval_callback(None)
        assert handler.get_approval_callback() is None


class TestApprovedFlagCannotBypassPolicy:
    """approved=True answers the per-call prompt; it is not a policy override."""

    async def test_policy_denial_still_applies(self) -> None:
        tool = _http_tool("old")
        tool.deprecated = True
        matimo = _matimo(tool, handler=_handler(True))
        with pytest.raises(MatimoError) as exc:
            await matimo.execute("old", {}, approved=True)
        assert exc.value.code == ErrorCode.POLICY_DENIED
        matimo._dispatch.assert_not_awaited()  # type: ignore[attr-defined]

    async def test_quarantine_still_applies(self) -> None:
        matimo = _matimo(
            _http_tool("wipe", "DELETE"),
            handler=_handler(True),
            policy=PolicyConfig(enable_hitl=True),
        )
        with pytest.raises(MatimoError) as exc:
            await matimo.execute("wipe", {}, approved=True)
        assert exc.value.code == ErrorCode.POLICY_DENIED
        matimo._dispatch.assert_not_awaited()  # type: ignore[attr-defined]


class TestPerInstanceApprovalCallback:
    """on_approval / set_approval_callback() — mirrors MatimoInstance onApproval."""

    async def test_on_approval_takes_precedence_over_the_handler_callback(self) -> None:
        handler = _handler(False)
        on_approval = AsyncMock(return_value=True)
        matimo = _matimo(
            _http_tool("wipe", requires_approval=True), handler=handler, on_approval=on_approval
        )
        assert await matimo.execute("wipe", {}) == {"ok": True}
        on_approval.assert_awaited_once()
        handler_callback = handler.get_approval_callback()
        assert isinstance(handler_callback, AsyncMock)
        handler_callback.assert_not_awaited()

    async def test_instances_sharing_a_handler_stay_isolated(self) -> None:
        shared = _handler()
        tenant_a = AsyncMock(return_value=True)
        tenant_b = AsyncMock(return_value=False)
        a = _matimo(_http_tool("wipe", requires_approval=True), handler=shared, on_approval=tenant_a)
        b = _matimo(_http_tool("wipe", requires_approval=True), handler=shared, on_approval=tenant_b)
        assert await a.execute("wipe", {}) == {"ok": True}
        with pytest.raises(MatimoError, match="rejected"):
            await b.execute("wipe", {})
        tenant_a.assert_awaited_once()
        tenant_b.assert_awaited_once()

    async def test_clearing_falls_back_to_the_handler_callback(self) -> None:
        handler = _handler(True)
        matimo = _matimo(
            _http_tool("wipe", requires_approval=True),
            handler=handler,
            on_approval=AsyncMock(return_value=False),
        )
        matimo.set_approval_callback(None)
        assert await matimo.execute("wipe", {}) == {"ok": True}

    async def test_init_wires_on_approval(self, tmp_path: Path) -> None:
        tool_dir = tmp_path / "guarded"
        tool_dir.mkdir()
        (tool_dir / "definition.yaml").write_text(
            "name: guarded\ndescription: d\nrequires_approval: true\n"
            "execution:\n  type: http\n  method: GET\n  url: https://api.example.com/g\n"
        )
        on_approval = AsyncMock(return_value=False)
        matimo = await Matimo.init(str(tmp_path), on_approval=on_approval, log_level="silent")
        with pytest.raises(MatimoError, match="rejected by approval handler: guarded"):
            await matimo.execute("guarded", {})
        on_approval.assert_awaited_once()
