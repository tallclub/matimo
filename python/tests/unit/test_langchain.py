"""Unit tests for LangChain integration."""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from matimo.core.models import HttpExecution, Parameter, ParameterType, ToolDefinition


def _make_tool(
    name: str = "echo_tool",
    params: dict | None = None,
) -> ToolDefinition:
    return ToolDefinition(
        name=name,
        description=f"Tool {name}",
        parameters=params or {
            "message": Parameter(type=ParameterType.STRING, description="msg", required=True)
        },
        execution=HttpExecution(type="http", method="GET", url="https://x.com"),
    )


class TestLangChainConversion:
    def test_convert_returns_langchain_tools(self):
        pytest.importorskip("langchain_core")
        from matimo.integrations.langchain import convert_tools_to_langchain

        matimo_mock = AsyncMock()
        matimo_mock.execute = AsyncMock(return_value={"ok": True})

        tools = convert_tools_to_langchain([_make_tool()], matimo_mock)
        assert len(tools) == 1

    def test_tool_name_preserved(self):
        pytest.importorskip("langchain_core")
        from matimo.integrations.langchain import convert_tools_to_langchain

        matimo_mock = AsyncMock()
        matimo_mock.execute = AsyncMock(return_value={"ok": True})

        tools = convert_tools_to_langchain([_make_tool("my_special_tool")], matimo_mock)
        assert tools[0].name == "my_special_tool"

    def test_tool_description_preserved(self):
        pytest.importorskip("langchain_core")
        from matimo.integrations.langchain import convert_tools_to_langchain

        matimo_mock = AsyncMock()
        matimo_mock.execute = AsyncMock(return_value={"ok": True})

        tools = convert_tools_to_langchain([_make_tool("t")], matimo_mock)
        assert "Tool t" in tools[0].description

    def test_secret_params_excluded_from_schema(self):
        pytest.importorskip("langchain_core")
        from matimo.integrations.langchain import convert_tools_to_langchain

        matimo_mock = AsyncMock()
        matimo_mock.execute = AsyncMock(return_value={"ok": True})

        tool = _make_tool(
            params={
                "message": Parameter(type=ParameterType.STRING, description="msg", required=True),
                "API_KEY": Parameter(type=ParameterType.STRING, description="secret key", required=True),
                "BOT_TOKEN": Parameter(type=ParameterType.STRING, description="bot token", required=True),
            }
        )
        lc_tools = convert_tools_to_langchain([tool], matimo_mock)
        schema = lc_tools[0].args_schema.schema() if hasattr(lc_tools[0], "args_schema") else {}
        props = schema.get("properties", {})
        # Secret-like params should be excluded from the LLM-visible schema
        assert "API_KEY" not in props
        assert "BOT_TOKEN" not in props
        assert "message" in props

    @pytest.mark.asyncio
    async def test_invoke_calls_matimo_execute(self):
        pytest.importorskip("langchain_core")
        from matimo.integrations.langchain import convert_tools_to_langchain

        matimo_mock = MagicMock()
        matimo_mock.execute = AsyncMock(return_value={"result": "ok"})

        tools = convert_tools_to_langchain([_make_tool()], matimo_mock)
        result = await tools[0].ainvoke({"message": "hello"})
        matimo_mock.execute.assert_awaited_once_with("echo_tool", {"message": "hello"}, credentials=None)

    def test_multiple_tools_converted(self):
        pytest.importorskip("langchain_core")
        from matimo.integrations.langchain import convert_tools_to_langchain

        matimo_mock = MagicMock()
        matimo_mock.execute = AsyncMock(return_value={})

        tool_defs = [_make_tool(f"tool_{i}") for i in range(5)]
        lc_tools = convert_tools_to_langchain(tool_defs, matimo_mock)
        assert len(lc_tools) == 5
