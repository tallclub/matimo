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


def _http_tool(
    name: str, method: str = "GET", *, requires_approval: bool | None = None
) -> ToolDefinition:
    """`requires_approval=None` leaves the field unset, as in a YAML that omits it."""
    extra = {} if requires_approval is None else {"requires_approval": requires_approval}
    return ToolDefinition(
        name=name,
        description=f"{method} tool",
        parameters={"sql": Parameter(type=ParameterType.STRING, description="q", required=False)},
        execution=HttpExecution(type="http", method=method, url="https://api.example.com/x"),
        **extra,
    )


def _command_tool(**overrides: Any) -> ToolDefinition:  # noqa: ANN401
    return ToolDefinition(
        name="run_shell",
        description="Run a shell command",
        parameters={"command": Parameter(type=ParameterType.STRING, description="c", required=True)},
        execution=CommandExecution(type="command", command="sh", args=["-c", "{command}"]),
        **overrides,
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
        # The hint points at a human reviewer, never at switching approval off
        hint = str((exc.value.details or {}).get("hint"))
        assert "on_approval" in hint
        assert "MATIMO_AUTO_APPROVE" not in hint
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
    """Tools opted out with requires_approval: false are still scanned."""

    async def test_destructive_shell_command_prompts(self) -> None:
        matimo = _matimo(_command_tool(requires_approval=False), handler=_handler(False))
        with pytest.raises(MatimoError, match="rejected"):
            await matimo.execute("run_shell", {"command": "DELETE everything"})

    async def test_harmless_shell_command_runs(self) -> None:
        matimo = _matimo(_command_tool(requires_approval=False), handler=_handler(False))
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


class TestAutoApproveWarning:
    def _build(self, handler: ApprovalHandler) -> MagicMock:
        logger = MagicMock()
        Matimo(
            registry=ToolRegistry(),
            policy_engine=DefaultPolicyEngine(),
            loader=MagicMock(),
            tool_paths=[],
            on_event=None,
            on_hitl=None,
            matimo_logger=logger,
            approval_handler=handler,
        )
        return logger

    def test_warns_while_auto_approve_is_active(self) -> None:
        handler = _handler()
        handler.auto_approve = True
        logger = self._build(handler)
        assert any("MATIMO_AUTO_APPROVE=true" in str(c.args[0]) for c in logger.warn.call_args_list)

    def test_stays_quiet_otherwise(self) -> None:
        logger = self._build(_handler())
        logger.warn.assert_not_called()


class TestApprovalRequiredByDefinition:
    """definition_requires_approval — mirrors definitionRequiresApproval() in TS."""

    async def test_delete_needs_approval_by_default(self) -> None:
        matimo = _matimo(_http_tool("wipe", "DELETE"), handler=_handler())
        with pytest.raises(MatimoError, match="requires approval: wipe"):
            await matimo.execute("wipe", {})

    async def test_command_tool_needs_approval_by_default(self) -> None:
        matimo = _matimo(_command_tool(), handler=_handler())
        with pytest.raises(MatimoError, match="requires approval: run_shell"):
            await matimo.execute("run_shell", {"command": "echo hi"})

    async def test_explicit_false_opts_out(self) -> None:
        matimo = _matimo(_http_tool("wipe", "DELETE", requires_approval=False), handler=_handler())
        assert await matimo.execute("wipe", {}) == {"ok": True}


class TestPerCallApprovalCallback:
    """execute(on_approval=...) — mirrors ExecuteOptions.onApproval in TS."""

    async def test_per_call_callback_wins(self) -> None:
        instance_callback = AsyncMock(return_value=False)
        per_call = AsyncMock(return_value=True)
        matimo = _matimo(
            _http_tool("wipe", requires_approval=True),
            handler=_handler(False),
            on_approval=instance_callback,
        )
        assert await matimo.execute("wipe", {}, on_approval=per_call) == {"ok": True}
        per_call.assert_awaited_once()
        instance_callback.assert_not_awaited()

    async def test_execute_tool_passes_it_through(self) -> None:
        per_call = AsyncMock(return_value=False)
        matimo = _matimo(_http_tool("wipe", requires_approval=True), handler=_handler(True))
        with pytest.raises(MatimoError, match="rejected"):
            await matimo.execute_tool("wipe", {}, on_approval=per_call)
        per_call.assert_awaited_once()

    async def test_a_callback_that_cannot_ask_is_audited_as_a_denial(self) -> None:
        events: list[dict[str, Any]] = []

        async def cannot_ask(_request: ApprovalRequest) -> bool:
            raise MatimoError("no one to ask", ErrorCode.EXECUTION_FAILED)

        matimo = _matimo(_http_tool("wipe", requires_approval=True), handler=_handler(), events=events)
        with pytest.raises(MatimoError, match="no one to ask"):
            await matimo.execute("wipe", {}, on_approval=cannot_ask)
        assert [e["type"] for e in events] == ["tool:approval_denied"]
        assert "no one to ask" in events[0]["reason"]


class TestNeverPreApproved:
    """matimo_approve_tool always reaches a human — mirrors NEVER_PRE_APPROVED_TOOLS in TS."""

    def test_auto_approve_and_patterns_do_not_cover_it(self) -> None:
        handler = _handler()
        handler.auto_approve = True
        handler.add_approved_pattern("*")
        assert handler.is_pre_approved("matimo_approve_tool") is False
        assert handler.is_pre_approved("anything_else") is True

    async def test_request_approval_still_asks_the_callback(self) -> None:
        handler = _handler(False)
        handler.auto_approve = True
        request = ApprovalRequest(tool_name="matimo_approve_tool", description=None, params={})
        assert await handler.request_approval(request) is False
        assert await handler.request_approval(
            ApprovalRequest(tool_name="other", description=None, params={})
        ) is True

    async def test_execute_asks_a_human_even_with_auto_approve_on(self) -> None:
        tool = _http_tool("matimo_approve_tool", "POST", requires_approval=True)
        handler = _handler()
        handler.auto_approve = True
        human = AsyncMock(return_value=False)
        matimo = _matimo(tool, handler=handler, on_approval=human)
        with pytest.raises(MatimoError, match="rejected"):
            await matimo.execute("matimo_approve_tool", {})
        human.assert_awaited_once()
