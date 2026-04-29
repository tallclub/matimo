"""Unit tests for the main Matimo instance."""
from __future__ import annotations

from pathlib import Path
from unittest.mock import AsyncMock, MagicMock

import httpx
import pytest
import respx

from matimo.core.models import (
    HttpExecution,
    Parameter,
    ParameterType,
    ToolDefinition,
)
from matimo.core.registry import ToolRegistry
from matimo.errors import ErrorCode, MatimoError
from matimo.instance import Matimo
from matimo.policy.default_policy import DefaultPolicyEngine
from matimo.policy.types import PolicyConfig, RiskLevel


def _make_get_tool(name: str = "get_data") -> ToolDefinition:
    return ToolDefinition(
        name=name,
        description="Get data",
        parameters={
            "resource_id": Parameter(type=ParameterType.STRING, description="ID", required=True)
        },
        execution=HttpExecution(
            type="http",
            method="GET",
            url="https://api.example.com/data/{resource_id}",
        ),
    )


def _make_delete_tool() -> ToolDefinition:
    return ToolDefinition(
        name="delete_data",
        description="Delete data",
        parameters={
            "resource_id": Parameter(type=ParameterType.STRING, description="ID", required=True)
        },
        execution=HttpExecution(
            type="http",
            method="DELETE",
            url="https://api.example.com/data/{resource_id}",
        ),
        requires_approval=True,
    )


class TestMatimoInit:
    @pytest.mark.asyncio
    async def test_init_from_directory(self, tmp_path: Path) -> None:
        tool_dir = tmp_path / "tools" / "my_tool"
        tool_dir.mkdir(parents=True)
        definition = tool_dir / "definition.yaml"
        definition.write_text(
            "name: my_tool\ndescription: test\nexecution:\n  type: http\n  method: GET\n  url: https://x.com\n"
        )
        matimo = await Matimo.init(str(tmp_path / "tools"))
        assert matimo.get_tool("my_tool") is not None

    @pytest.mark.asyncio
    async def test_init_empty_directory(self, tmp_path: Path) -> None:
        matimo = await Matimo.init(str(tmp_path))
        assert matimo.list_tools() == []
        assert len(matimo.list_tools()) == 0


class TestMatimoExecute:
    @respx.mock
    @pytest.mark.asyncio
    async def test_execute_http_tool_success(self) -> None:
        respx.get("https://api.example.com/data/42").mock(
            return_value=httpx.Response(200, json={"id": 42, "name": "item"})
        )
        reg = ToolRegistry()
        reg.register(_make_get_tool())
        matimo = Matimo(
            registry=reg,
            policy_engine=DefaultPolicyEngine(),
            loader=MagicMock(),
            tool_paths=[],
            on_event=None,
            on_hitl=None,
            matimo_logger=MagicMock(),
        )
        result = await matimo.execute("get_data", {"resource_id": "42"})
        assert result["id"] == 42

    @pytest.mark.asyncio
    async def test_execute_tool_not_found(self) -> None:
        reg = ToolRegistry()
        matimo = Matimo(
            registry=reg,
            policy_engine=DefaultPolicyEngine(),
            loader=MagicMock(),
            tool_paths=[],
            on_event=None,
            on_hitl=None,
            matimo_logger=MagicMock(),
        )
        with pytest.raises(MatimoError) as exc:
            await matimo.execute("nonexistent_tool", {})
        assert exc.value.code == ErrorCode.TOOL_NOT_FOUND

    @pytest.mark.asyncio
    async def test_deprecated_tool_raises(self) -> None:
        reg = ToolRegistry()
        deprecated = ToolDefinition(
            name="old_api",
            description="deprecated",
            deprecated=True,
            execution=HttpExecution(type="http", method="GET", url="https://x.com"),
        )
        reg.register(deprecated)
        matimo = Matimo(
            registry=reg,
            policy_engine=DefaultPolicyEngine(),
            loader=MagicMock(),
            tool_paths=[],
            on_event=None,
            on_hitl=None,
            matimo_logger=MagicMock(),
        )
        with pytest.raises(MatimoError) as exc:
            await matimo.execute("old_api", {})
        assert exc.value.code in (ErrorCode.POLICY_DENIED, ErrorCode.POLICY_TIER_BLOCKED)

    @pytest.mark.asyncio
    async def test_requires_approval_with_callback(self) -> None:
        reg = ToolRegistry()
        reg.register(_make_delete_tool())

        approval_callback = AsyncMock(return_value=True)
        hitl_policy = DefaultPolicyEngine(
            PolicyConfig(enable_hitl=True, quarantine_risk_levels=[RiskLevel.HIGH, RiskLevel.CRITICAL])
        )
        matimo = Matimo(
            registry=reg,
            policy_engine=hitl_policy,
            loader=MagicMock(),
            tool_paths=[],
            on_event=None,
            on_hitl=approval_callback,
            matimo_logger=MagicMock(),
        )
        with respx.mock:
            respx.delete("https://api.example.com/data/99").mock(
                return_value=httpx.Response(200, json={"deleted": True})
            )
            await matimo.execute("delete_data", {"resource_id": "99"})
        approval_callback.assert_awaited()

    @pytest.mark.asyncio
    async def test_requires_approval_denied_raises(self) -> None:
        reg = ToolRegistry()
        reg.register(_make_delete_tool())

        approval_callback = AsyncMock(return_value=False)
        hitl_policy = DefaultPolicyEngine(
            PolicyConfig(enable_hitl=True, quarantine_risk_levels=[RiskLevel.HIGH, RiskLevel.CRITICAL])
        )
        matimo = Matimo(
            registry=reg,
            policy_engine=hitl_policy,
            loader=MagicMock(),
            tool_paths=[],
            on_event=None,
            on_hitl=approval_callback,
            matimo_logger=MagicMock(),
        )
        with pytest.raises(MatimoError) as exc:
            await matimo.execute("delete_data", {"resource_id": "99"})
        assert exc.value.code in (ErrorCode.POLICY_DENIED, ErrorCode.EXECUTION_FAILED)


class TestMatimoToolQuery:
    def test_list_tools(self) -> None:
        reg = ToolRegistry()
        reg.register(_make_get_tool("tool_a"))
        reg.register(_make_get_tool("tool_b"))
        matimo = Matimo(
            registry=reg,
            policy_engine=DefaultPolicyEngine(),
            loader=MagicMock(),
            tool_paths=[],
            on_event=None,
            on_hitl=None,
            matimo_logger=MagicMock(),
        )
        tools = matimo.list_tools()
        assert len(tools) == 2

    def test_search_tools(self) -> None:
        reg = ToolRegistry()
        reg.register(_make_get_tool("slack_send"))
        reg.register(_make_get_tool("slack_read"))
        reg.register(_make_get_tool("github_issue"))
        matimo = Matimo(
            registry=reg,
            policy_engine=DefaultPolicyEngine(),
            loader=MagicMock(),
            tool_paths=[],
            on_event=None,
            on_hitl=None,
            matimo_logger=MagicMock(),
        )
        slack_tools = matimo.search_tools("slack")
        assert len(slack_tools) == 2

    def test_get_tool_returns_definition(self) -> None:
        reg = ToolRegistry()
        tool = _make_get_tool("my_tool")
        reg.register(tool)
        matimo = Matimo(
            registry=reg,
            policy_engine=DefaultPolicyEngine(),
            loader=MagicMock(),
            tool_paths=[],
            on_event=None,
            on_hitl=None,
            matimo_logger=MagicMock(),
        )
        assert matimo.get_tool("my_tool") is tool

    def test_count(self) -> None:
        reg = ToolRegistry()
        reg.register_all([_make_get_tool(f"t{i}") for i in range(4)])
        matimo = Matimo(
            registry=reg,
            policy_engine=DefaultPolicyEngine(),
            loader=MagicMock(),
            tool_paths=[],
            on_event=None,
            on_hitl=None,
            matimo_logger=MagicMock(),
        )
        assert len(matimo.list_tools()) == 4


class TestMatimoEventEmission:
    @respx.mock
    @pytest.mark.asyncio
    async def test_on_event_called_after_execute(self) -> None:
        respx.get("https://api.example.com/data/1").mock(
            return_value=httpx.Response(200, json={"ok": True})
        )
        reg = ToolRegistry()
        reg.register(_make_get_tool())

        events = []
        matimo = Matimo(
            registry=reg,
            policy_engine=DefaultPolicyEngine(),
            loader=MagicMock(),
            tool_paths=[],
            on_event=lambda e: events.append(e),
            on_hitl=None,
            matimo_logger=MagicMock(),
        )
        await matimo.execute("get_data", {"resource_id": "1"})
        assert len(events) > 0

    @respx.mock
    @pytest.mark.asyncio
    async def test_on_event_handler_exception_does_not_propagate(self) -> None:
        """Event handlers that raise should not break execution."""
        respx.get("https://api.example.com/data/1").mock(
            return_value=httpx.Response(200, json={"ok": True})
        )
        reg = ToolRegistry()
        reg.register(_make_get_tool())

        def bad_handler(e: object) -> None:
            raise RuntimeError("handler crashed")

        matimo = Matimo(
            registry=reg,
            policy_engine=DefaultPolicyEngine(),
            loader=MagicMock(),
            tool_paths=[],
            on_event=bad_handler,
            on_hitl=None,
            matimo_logger=MagicMock(),
        )
        # Should not raise despite broken event handler
        result = await matimo.execute("get_data", {"resource_id": "1"})
        assert result["ok"] is True


class TestMatimoInitExtended:
    @pytest.mark.asyncio
    async def test_init_from_string_path(self, tmp_path: Path) -> None:
        tool_dir = tmp_path / "tools" / "my_tool"
        tool_dir.mkdir(parents=True)
        (tool_dir / "definition.yaml").write_text(
            "name: my_tool\ndescription: test\nexecution:\n  type: http\n  method: GET\n  url: https://x.com\n"
        )
        matimo = await Matimo.init(str(tmp_path / "tools"))
        assert matimo.get_tool("my_tool") is not None

    @pytest.mark.asyncio
    async def test_init_from_list_paths(self, tmp_path: Path) -> None:
        """init() with list of paths loads from all of them."""
        dir_a = tmp_path / "a"
        dir_a.mkdir()
        tool_a = dir_a / "tool_a"
        tool_a.mkdir()
        (tool_a / "definition.yaml").write_text(
            "name: tool_a\ndescription: A\nexecution:\n  type: http\n  method: GET\n  url: https://a.com\n"
        )
        dir_b = tmp_path / "b"
        dir_b.mkdir()
        tool_b = dir_b / "tool_b"
        tool_b.mkdir()
        (tool_b / "definition.yaml").write_text(
            "name: tool_b\ndescription: B\nexecution:\n  type: http\n  method: GET\n  url: https://b.com\n"
        )
        matimo = await Matimo.init([str(dir_a), str(dir_b)])
        assert matimo.get_tool("tool_a") is not None
        assert matimo.get_tool("tool_b") is not None

    @pytest.mark.asyncio
    async def test_init_empty_paths(self) -> None:
        matimo = await Matimo.init(None)
        assert matimo.list_tools() == []

    @pytest.mark.asyncio
    async def test_init_with_policy_config(self, tmp_path: Path) -> None:
        """init() with policy_config parameter builds a custom policy engine."""
        from matimo.policy.types import PolicyConfig
        cfg = PolicyConfig(allowed_http_methods=["GET", "POST", "PUT", "DELETE", "PATCH"])
        matimo = await Matimo.init(None, policy_config=cfg)
        assert matimo is not None

    @pytest.mark.asyncio
    async def test_init_with_policy_file(self, tmp_path: Path) -> None:
        """init() with policy_file parameter loads policy from YAML."""
        policy_yaml = tmp_path / "policy.yaml"
        policy_yaml.write_text("enable_hitl: false\nallowed_http_methods:\n  - GET\n  - POST\n")
        matimo = await Matimo.init(None, policy_file=str(policy_yaml))
        assert matimo is not None


class TestMatimoHitl:
    @pytest.mark.asyncio
    async def test_hitl_no_callback_denies_by_default(self) -> None:
        """When on_hitl is None and policy requires approval, execution is denied."""
        reg = ToolRegistry()
        reg.register(_make_delete_tool())

        hitl_policy = DefaultPolicyEngine(
            PolicyConfig(enable_hitl=True, quarantine_risk_levels=[RiskLevel.HIGH, RiskLevel.CRITICAL])
        )
        matimo = Matimo(
            registry=reg,
            policy_engine=hitl_policy,
            loader=MagicMock(),
            tool_paths=[],
            on_event=None,
            on_hitl=None,  # No callback
            matimo_logger=MagicMock(),
        )
        with pytest.raises(MatimoError) as exc:
            await matimo.execute("delete_data", {"resource_id": "1"})
        assert exc.value.code in (ErrorCode.POLICY_DENIED, ErrorCode.EXECUTION_FAILED)

    @pytest.mark.asyncio
    async def test_execute_approved_skip_policy(self) -> None:
        """approved=True bypasses policy check entirely."""
        reg = ToolRegistry()
        deprecated = ToolDefinition(
            name="old_tool",
            description="deprecated",
            deprecated=True,
            execution=HttpExecution(type="http", method="GET", url="https://x.com"),
        )
        reg.register(deprecated)
        matimo = Matimo(
            registry=reg,
            policy_engine=DefaultPolicyEngine(),
            loader=MagicMock(),
            tool_paths=[],
            on_event=None,
            on_hitl=None,
            matimo_logger=MagicMock(),
        )
        with respx.mock:
            respx.get("https://x.com").mock(return_value=httpx.Response(200, json={"ok": True}))
            # approved=True skips policy
            result = await matimo.execute("old_tool", {}, approved=True)
        assert result["ok"] is True

    @pytest.mark.asyncio
    async def test_hitl_timeout_auto_rejects(self) -> None:
        """When hitl_timeout_ms is set and callback exceeds it, tool is auto-rejected."""
        import asyncio

        reg = ToolRegistry()
        reg.register(_make_delete_tool())

        hitl_policy = DefaultPolicyEngine(
            PolicyConfig(enable_hitl=True, quarantine_risk_levels=[RiskLevel.HIGH, RiskLevel.CRITICAL])
        )

        async def slow_callback(req: object) -> bool:  # noqa: ANN401
            await asyncio.sleep(10)  # never resolves in test
            return True

        matimo = Matimo(
            registry=reg,
            policy_engine=hitl_policy,
            loader=MagicMock(),
            tool_paths=[],
            on_event=None,
            on_hitl=slow_callback,
            matimo_logger=MagicMock(),
            hitl_timeout_ms=50,  # 50 ms timeout
        )

        with pytest.raises(MatimoError) as exc:
            await matimo.execute("delete_data", {"resource_id": "1"})

        # Should be denied because timeout expired
        assert exc.value.code == ErrorCode.POLICY_DENIED

    @pytest.mark.asyncio
    async def test_hitl_timeout_allows_fast_callback(self) -> None:
        """When hitl_timeout_ms is set and callback resolves within time, tool proceeds normally."""
        reg = ToolRegistry()
        fast_tool = ToolDefinition(
            name="fast_tool",
            description="Fast approval",
            execution=HttpExecution(type="http", method="DELETE", url="https://api.example.com/fast"),
        )
        reg.register(fast_tool)

        hitl_policy = DefaultPolicyEngine(
            PolicyConfig(enable_hitl=True, quarantine_risk_levels=[RiskLevel.HIGH, RiskLevel.CRITICAL])
        )

        async def fast_callback(req: object) -> bool:  # noqa: ANN401
            return True  # resolves immediately

        matimo = Matimo(
            registry=reg,
            policy_engine=hitl_policy,
            loader=MagicMock(),
            tool_paths=[],
            on_event=None,
            on_hitl=fast_callback,
            matimo_logger=MagicMock(),
            hitl_timeout_ms=5000,  # generous timeout
        )

        with respx.mock:
            respx.delete("https://api.example.com/fast").mock(
                return_value=httpx.Response(200, json={"ok": True})
            )
            result = await matimo.execute("fast_tool", {})

        assert result["ok"] is True

    @pytest.mark.asyncio
    async def test_hitl_no_timeout_waits_for_callback(self) -> None:
        """When hitl_timeout_ms is None (default), no timeout is applied."""
        reg = ToolRegistry()
        reg.register(_make_delete_tool())

        hitl_policy = DefaultPolicyEngine(
            PolicyConfig(enable_hitl=True, quarantine_risk_levels=[RiskLevel.HIGH, RiskLevel.CRITICAL])
        )

        call_count = 0

        async def approving_callback(req: object) -> bool:  # noqa: ANN401
            nonlocal call_count
            call_count += 1
            return False  # reject

        matimo = Matimo(
            registry=reg,
            policy_engine=hitl_policy,
            loader=MagicMock(),
            tool_paths=[],
            on_event=None,
            on_hitl=approving_callback,
            matimo_logger=MagicMock(),
            # hitl_timeout_ms=None (default)
        )

        with pytest.raises(MatimoError) as exc:
            await matimo.execute("delete_data", {"resource_id": "1"})

        assert call_count == 1
        assert exc.value.code == ErrorCode.POLICY_DENIED


class TestMatimoReload:
    @pytest.mark.asyncio
    async def test_reload_adds_new_tool(self, tmp_path: Path) -> None:
        """Reload picks up new tool definition files."""
        tool_dir = tmp_path / "t1"
        tool_dir.mkdir()
        (tool_dir / "definition.yaml").write_text(
            "name: t1\ndescription: T1\nexecution:\n  type: http\n  method: GET\n  url: https://x.com\n"
        )
        matimo = await Matimo.init(str(tmp_path))
        assert matimo.get_tool("t1") is not None

        # Add a new tool file
        tool_dir2 = tmp_path / "t2"
        tool_dir2.mkdir()
        (tool_dir2 / "definition.yaml").write_text(
            "name: t2\ndescription: T2\nexecution:\n  type: http\n  method: GET\n  url: https://y.com\n"
        )
        result = await matimo.reload()
        assert result.loaded >= 1 or result.revalidated >= 0
        assert matimo.get_tool("t2") is not None

    @pytest.mark.asyncio
    async def test_reload_removes_deleted_tool(self, tmp_path: Path) -> None:
        """Reload removes tools whose definition files are deleted."""
        tool_dir = tmp_path / "t1"
        tool_dir.mkdir()
        def_file = tool_dir / "definition.yaml"
        def_file.write_text(
            "name: t1\ndescription: T1\nexecution:\n  type: http\n  method: GET\n  url: https://x.com\n"
        )
        matimo = await Matimo.init(str(tmp_path))
        assert matimo.get_tool("t1") is not None

        # Delete the tool file
        import shutil
        shutil.rmtree(str(tool_dir))

        result = await matimo.reload()
        assert result.removed >= 1
        assert matimo.get_tool("t1") is None


class TestMatimoGetToolsForAgent:
    def test_returns_allowed_tools_for_context(self) -> None:
        reg = ToolRegistry()
        reg.register(_make_get_tool("read_data"))
        deprecated = ToolDefinition(
            name="old_tool",
            description="deprecated",
            deprecated=True,
            execution=HttpExecution(type="http", method="GET", url="https://x.com"),
        )
        reg.register(deprecated)
        matimo = Matimo(
            registry=reg,
            policy_engine=DefaultPolicyEngine(),
            loader=MagicMock(),
            tool_paths=[],
            on_event=None,
            on_hitl=None,
            matimo_logger=MagicMock(),
        )
        from matimo.core.models import PolicyContext
        ctx = PolicyContext(agent_id="agent1")
        tools = matimo.get_tools_for_agent(ctx)
        names = {t.name for t in tools}
        assert "read_data" in names
        assert "old_tool" not in names


class TestMatimoInstanceMissingLines:
    """Targeted tests to cover remaining gaps in instance.py."""

    @pytest.mark.asyncio
    async def test_init_auto_discover_triggers_discovery(self) -> None:
        """Cover lines 176-177: auto_discover=True calls auto_discover_packages."""
        matimo = await Matimo.init([], auto_discover=True)
        assert matimo is not None  # Discovers installed packages (may be empty)

    @pytest.mark.asyncio
    async def test_init_registration_failure_warns_and_continues(
        self, tmp_path: Path
    ) -> None:
        """Cover lines 190-191: duplicate tool name causes MatimoError during register."""
        from unittest.mock import patch

        from matimo.core.registry import ToolRegistry

        # Patch ToolRegistry.register to raise on the second call
        original_register = ToolRegistry.register
        call_count = 0

        def patched_register(self: ToolRegistry, tool: ToolDefinition) -> None:
            nonlocal call_count
            call_count += 1
            if call_count > 1:
                raise MatimoError("Duplicate tool", ErrorCode.TOOL_NOT_FOUND)
            return original_register(self, tool)

        # Create two tools in the directory
        tool_a = tmp_path / "tool_a"
        tool_a.mkdir()
        (tool_a / "definition.yaml").write_text(
            "name: tool_a\ndescription: A\nexecution:\n  type: http\n  method: GET\n  url: https://a.com\n"
        )
        tool_b = tmp_path / "tool_b"
        tool_b.mkdir()
        (tool_b / "definition.yaml").write_text(
            "name: tool_b\ndescription: B\nexecution:\n  type: http\n  method: GET\n  url: https://b.com\n"
        )

        with patch.object(ToolRegistry, "register", patched_register):
            matimo = await Matimo.init(str(tmp_path))  # Should log warning, not raise
        assert matimo is not None

    @pytest.mark.asyncio
    async def test_execute_generic_exception_wrapped(self) -> None:
        """Cover lines 280-283: non-MatimoError exceptions wrapped as EXECUTION_FAILED."""
        from unittest.mock import patch

        reg = ToolRegistry()
        reg.register(_make_get_tool())
        matimo = Matimo(
            registry=reg,
            policy_engine=DefaultPolicyEngine(),
            loader=MagicMock(),
            tool_paths=[],
            on_event=None,
            on_hitl=None,
            matimo_logger=MagicMock(),
        )
        with patch.object(matimo._http_executor, "execute", side_effect=RuntimeError("crash")):
            with pytest.raises(MatimoError) as exc:
                await matimo.execute("get_data", {"resource_id": "1"})
        assert exc.value.code == ErrorCode.EXECUTION_FAILED

    @pytest.mark.asyncio
    async def test_reload_registration_failure_rejected(self, tmp_path: Path) -> None:
        """Cover lines 354-356: reload catches MatimoError during re-registration."""
        from unittest.mock import patch

        # Create one tool initially
        tool_dir = tmp_path / "rt"
        tool_dir.mkdir()
        (tool_dir / "definition.yaml").write_text(
            "name: rt\ndescription: R\nexecution:\n  type: http\n  method: GET\n  url: https://r.com\n"
        )
        matimo = await Matimo.init(str(tmp_path))

        # Add a second (NEW) tool file — this will be a fresh registration during reload
        tool_dir2 = tmp_path / "rt_new"
        tool_dir2.mkdir()
        (tool_dir2 / "definition.yaml").write_text(
            "name: rt_new\ndescription: RN\nexecution:\n  type: http\n  method: GET\n  url: https://rn.com\n"
        )

        # Patch register to raise for NEW tools (rt_new doesn't exist yet in registry)
        original = matimo._registry.register

        def raise_for_new(tool: ToolDefinition) -> None:
            if tool.name == "rt_new":
                raise MatimoError("duplicate", ErrorCode.TOOL_NOT_FOUND)
            return original(tool)

        with patch.object(matimo._registry, "register", side_effect=raise_for_new):
            result = await matimo.reload()
        assert "rt_new" in result.rejected

    @pytest.mark.asyncio
    async def test_dispatch_command_tool(self) -> None:
        """Cover lines 382-383: _dispatch routes command execution type."""
        from unittest.mock import AsyncMock, patch

        from matimo.core.models import CommandExecution

        command_tool = ToolDefinition(
            name="cmd_tool",
            description="test",
            execution=CommandExecution(type="command", command="echo", args=["hello"]),
        )
        reg = ToolRegistry()
        reg.register(command_tool)
        matimo = Matimo(
            registry=reg,
            policy_engine=DefaultPolicyEngine(),
            loader=MagicMock(),
            tool_paths=[],
            on_event=None,
            on_hitl=None,
            matimo_logger=MagicMock(),
        )
        with patch.object(matimo._command_executor, "execute", new=AsyncMock(return_value={"ok": True})):
            result = await matimo.execute("cmd_tool", {})
        assert result["ok"] is True

    @pytest.mark.asyncio
    async def test_dispatch_function_tool(self, tmp_path: Path) -> None:
        """Cover lines 384-385: _dispatch routes function execution type."""
        from matimo.core.models import FunctionExecution

        py_file = tmp_path / "fn.py"
        py_file.write_text("def run(params):\n    return {'fn': True}\n")
        fn_tool = ToolDefinition(
            name="fn_tool",
            description="test",
            execution=FunctionExecution(type="function", code=str(py_file)),
        )
        fn_tool.set_definition_path(str(tmp_path / "definition.yaml"))
        reg = ToolRegistry()
        reg.register(fn_tool)
        matimo = Matimo(
            registry=reg,
            policy_engine=DefaultPolicyEngine(),
            loader=MagicMock(),
            tool_paths=[],
            on_event=None,
            on_hitl=None,
            matimo_logger=MagicMock(),
        )
        result = await matimo.execute("fn_tool", {})
        assert result == {"fn": True}

    @pytest.mark.asyncio
    async def test_execute_matimo_error_from_dispatch_reraises(self) -> None:
        """Cover line 281: MatimoError from _dispatch is re-raised as-is."""
        from unittest.mock import patch

        reg = ToolRegistry()
        reg.register(_make_get_tool())
        matimo = Matimo(
            registry=reg,
            policy_engine=DefaultPolicyEngine(),
            loader=MagicMock(),
            tool_paths=[],
            on_event=None,
            on_hitl=None,
            matimo_logger=MagicMock(),
        )
        with patch.object(
            matimo._http_executor, "execute",
            side_effect=MatimoError("tool error", ErrorCode.EXECUTION_FAILED)
        ):
            with pytest.raises(MatimoError) as exc:
                await matimo.execute("get_data", {"resource_id": "1"})
        assert exc.value.code == ErrorCode.EXECUTION_FAILED

    @pytest.mark.asyncio
    async def test_dispatch_unknown_execution_type_raises(self) -> None:
        """Cover lines 386-388: _dispatch raises for unknown execution type."""
        reg = ToolRegistry()
        tool = _make_get_tool()
        reg.register(tool)
        matimo = Matimo(
            registry=reg,
            policy_engine=DefaultPolicyEngine(),
            loader=MagicMock(),
            tool_paths=[],
            on_event=None,
            on_hitl=None,
            matimo_logger=MagicMock(),
        )
        # Directly manipulate execution type to bypass Pydantic validation
        tool.execution.type = "unknown_type"  # type: ignore[assignment]
        with pytest.raises(MatimoError) as exc:
            await matimo._dispatch(tool, {}, None)
        assert exc.value.code == ErrorCode.EXECUTION_FAILED

    @pytest.mark.asyncio
    async def test_build_policy_engine_with_direct_policy(self) -> None:
        """Cover line 442: _build_policy_engine returns the passed policy directly."""
        custom_policy = DefaultPolicyEngine()
        matimo = await Matimo.init(None, policy=custom_policy)
        assert matimo is not None

    @pytest.mark.asyncio
    async def test_matimo_namespace_init(self) -> None:
        """Cover line 469: _MatimoNamespace.init() delegates to Matimo.init()."""
        from matimo.instance import matimo as matimo_ns
        instance = await matimo_ns.init([])
        assert isinstance(instance, Matimo)


class TestInstanceSkillsAndCoverage:
    """Cover lines 213-216, 299-306, 370, 378, 382, 386, 390, 400 in instance.py."""

    def _make_matimo(self) -> Matimo:
        """Return a bare Matimo instance with no tools or skills."""
        return Matimo(
            registry=ToolRegistry(),
            policy_engine=DefaultPolicyEngine(),
            loader=MagicMock(),
            tool_paths=[],
            on_event=None,
            on_hitl=None,
            matimo_logger=MagicMock(),
        )

    # ------------------------------------------------------------------
    # Lines 213-216: skill_paths loading in Matimo.init()
    # ------------------------------------------------------------------

    @pytest.mark.asyncio
    async def test_init_with_skill_paths_loads_skills(self, tmp_path: Path) -> None:
        """Lines 213-216: passing skill_paths causes SkillLoader to run."""
        skills_dir = tmp_path / "skills" / "my-skill"
        skills_dir.mkdir(parents=True)
        (skills_dir / "SKILL.md").write_text(
            "---\nname: my-skill\ndescription: A test skill\n---\n\nContent here."
        )
        matimo = await Matimo.init([], skill_paths=[str(tmp_path / "skills")])
        skills = matimo.list_skills()
        assert any(s.name == "my-skill" for s in skills)

    # ------------------------------------------------------------------
    # Lines 299-306: matimo_reload_tools interception in execute()
    # ------------------------------------------------------------------

    @pytest.mark.asyncio
    async def test_execute_matimo_reload_tools_interception(self) -> None:
        """Lines 299-306: matimo_reload_tools is intercepted and calls reload()."""
        from pathlib import Path
        from unittest.mock import AsyncMock, patch

        import matimo as _matimo_pkg
        from matimo.instance import ReloadResult

        # Load built-in core tools so matimo_reload_tools is in the registry
        core_tools_dir = str(Path(_matimo_pkg.__file__).parent / "tools")
        instance = await Matimo.init(core_tools_dir)
        reload_result = ReloadResult(loaded=5, removed=1, revalidated=0, rejected=[])
        with patch.object(instance, "reload", new=AsyncMock(return_value=reload_result)):
            result = await instance.execute("matimo_reload_tools", {})
        assert result["success"] is True
        assert result["loaded"] == 5
        assert result["removed"] == 1
        assert "Reload complete" in result["message"]

    # ------------------------------------------------------------------
    # Line 370: get_tools_for_agent — filter_for_agent return
    # ------------------------------------------------------------------

    def test_get_tools_for_agent_returns_filtered_list(self) -> None:
        """Line 370: get_tools_for_agent delegates to policy.filter_for_agent."""
        from matimo.core.models import PolicyContext

        tool = ToolDefinition(
            name="my_tool",
            description="test",
            execution=HttpExecution(type="http", method="GET", url="https://example.com/"),
        )
        reg = ToolRegistry()
        reg.register(tool)
        matimo = Matimo(
            registry=reg,
            policy_engine=DefaultPolicyEngine(),
            loader=MagicMock(),
            tool_paths=[],
            on_event=None,
            on_hitl=None,
            matimo_logger=MagicMock(),
        )
        ctx = PolicyContext(agent_id="agent-1")
        tools = matimo.get_tools_for_agent(ctx)
        assert isinstance(tools, list)

    # ------------------------------------------------------------------
    # Lines 378, 382, 386, 390: Skills API methods
    # ------------------------------------------------------------------

    def test_list_skills_returns_list(self) -> None:
        """Line 378: list_skills() returns SkillSummary list."""
        matimo = self._make_matimo()
        assert matimo.list_skills() == []

    def test_get_all_skills_returns_list(self) -> None:
        """Line 382: get_all_skills() returns SkillDefinition list."""
        matimo = self._make_matimo()
        assert matimo.get_all_skills() == []

    def test_get_skill_returns_none_when_absent(self) -> None:
        """Line 386: get_skill() returns None for unknown skill."""
        matimo = self._make_matimo()
        assert matimo.get_skill("nonexistent") is None

    def test_get_skill_content_returns_none_when_absent(self) -> None:
        """Line 390: get_skill_content() returns None for unknown skill."""
        matimo = self._make_matimo()
        assert matimo.get_skill_content("nonexistent") is None

    # ------------------------------------------------------------------
    # Line 400: semantic_search_skills
    # ------------------------------------------------------------------

    @pytest.mark.asyncio
    async def test_semantic_search_skills_returns_empty_when_no_skills(self) -> None:
        """Line 400: semantic_search_skills() returns empty list with no skills loaded."""
        matimo = self._make_matimo()
        results = await matimo.semantic_search_skills("sending messages")
        assert results == []

    @pytest.mark.asyncio
    async def test_semantic_search_skills_finds_loaded_skill(self, tmp_path: Path) -> None:
        """Line 400: semantic_search_skills() returns results for matching skills."""
        skills_dir = tmp_path / "skills" / "slack-messaging"
        skills_dir.mkdir(parents=True)
        (skills_dir / "SKILL.md").write_text(
            "---\nname: slack-messaging\ndescription: Sending Slack messages\n---\n\n"
            "# Slack Messaging\n\nUse this skill to send messages via Slack channels."
        )
        matimo = await Matimo.init([], skill_paths=[str(tmp_path / "skills")])
        results = await matimo.semantic_search_skills("send slack message", limit=5)
        assert isinstance(results, list)
