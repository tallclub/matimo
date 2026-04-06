"""Unit tests for CrewAI integration."""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch
import asyncio

import pytest

from matimo.core.models import HttpExecution, Parameter, ParameterType, ToolDefinition


def _make_tool(
    name: str = "search_tool",
    params: dict | None = None,
) -> ToolDefinition:
    return ToolDefinition(
        name=name,
        description=f"Tool {name} description",
        parameters=params or {
            "query": Parameter(type=ParameterType.STRING, description="search query", required=True)
        },
        execution=HttpExecution(type="http", method="GET", url="https://x.com/search"),
    )


class TestCrewAIConversion:
    def test_convert_returns_crewai_tools(self):
        pytest.importorskip("crewai")
        from matimo.integrations.crewai import convert_tools_to_crewai

        matimo_mock = MagicMock()
        matimo_mock.execute = AsyncMock(return_value={"ok": True})

        tools = convert_tools_to_crewai([_make_tool()], matimo_mock)
        assert len(tools) == 1

    def test_tool_name_preserved(self):
        pytest.importorskip("crewai")
        from matimo.integrations.crewai import convert_tools_to_crewai

        matimo_mock = MagicMock()
        matimo_mock.execute = AsyncMock(return_value={})

        tools = convert_tools_to_crewai([_make_tool("my_crew_tool")], matimo_mock)
        assert tools[0].name == "my_crew_tool"

    def test_tool_description_preserved(self):
        pytest.importorskip("crewai")
        from matimo.integrations.crewai import convert_tools_to_crewai

        matimo_mock = MagicMock()
        matimo_mock.execute = AsyncMock(return_value={})

        tools = convert_tools_to_crewai([_make_tool("t")], matimo_mock)
        assert "description" in tools[0].description.lower() or "t" in tools[0].description

    def test_run_method_sync_calls_execute(self):
        pytest.importorskip("crewai")
        from matimo.integrations.crewai import convert_tools_to_crewai

        matimo_mock = MagicMock()
        matimo_mock.execute = AsyncMock(return_value={"answer": "42"})

        tools = convert_tools_to_crewai([_make_tool()], matimo_mock)
        crew_tool = tools[0]
        # _run is a sync method
        result = crew_tool._run(query="meaning of life")
        matimo_mock.execute.assert_awaited()

    @pytest.mark.asyncio
    async def test_arun_method_async_calls_execute(self):
        pytest.importorskip("crewai")
        from matimo.integrations.crewai import convert_tools_to_crewai

        matimo_mock = MagicMock()
        matimo_mock.execute = AsyncMock(return_value={"answer": "42"})

        tools = convert_tools_to_crewai([_make_tool()], matimo_mock)
        crew_tool = tools[0]
        result = await crew_tool._arun(query="meaning of life")
        matimo_mock.execute.assert_awaited_once_with("search_tool", {"query": "meaning of life"})

    def test_multiple_tools_converted(self):
        pytest.importorskip("crewai")
        from matimo.integrations.crewai import convert_tools_to_crewai

        matimo_mock = MagicMock()
        matimo_mock.execute = AsyncMock(return_value={})

        tool_defs = [_make_tool(f"crew_{i}") for i in range(3)]
        crew_tools = convert_tools_to_crewai(tool_defs, matimo_mock)
        assert len(crew_tools) == 3
        names = {t.name for t in crew_tools}
        assert "crew_0" in names
        assert "crew_2" in names
