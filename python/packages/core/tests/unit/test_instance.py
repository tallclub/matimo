"""Unit tests for the main Matimo instance."""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import respx
import httpx

from matimo.core.models import (
    HttpExecution,
    Parameter,
    ParameterType,
    ToolDefinition,
    ToolStatus,
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
    async def test_init_from_directory(self, tmp_path):
        tool_dir = tmp_path / "tools" / "my_tool"
        tool_dir.mkdir(parents=True)
        definition = tool_dir / "definition.yaml"
        definition.write_text(
            "name: my_tool\ndescription: test\nexecution:\n  type: http\n  method: GET\n  url: https://x.com\n"
        )
        matimo = await Matimo.init(str(tmp_path / "tools"))
        assert matimo.get_tool("my_tool") is not None

    @pytest.mark.asyncio
    async def test_init_empty_directory(self, tmp_path):
        matimo = await Matimo.init(str(tmp_path))
        assert matimo.list_tools() == []
        assert len(matimo.list_tools()) == 0


class TestMatimoExecute:
    @respx.mock
    @pytest.mark.asyncio
    async def test_execute_http_tool_success(self):
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
    async def test_execute_tool_not_found(self):
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
    async def test_deprecated_tool_raises(self):
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
    async def test_requires_approval_with_callback(self):
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
            result = await matimo.execute("delete_data", {"resource_id": "99"})
        approval_callback.assert_awaited()

    @pytest.mark.asyncio
    async def test_requires_approval_denied_raises(self):
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
    def test_list_tools(self):
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

    def test_search_tools(self):
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

    def test_get_tool_returns_definition(self):
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

    def test_count(self):
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
    async def test_on_event_called_after_execute(self):
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
