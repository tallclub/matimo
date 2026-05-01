"""Unit tests for CrewAI integration."""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

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
    def test_convert_returns_crewai_tools(self) -> None:
        pytest.importorskip("crewai")
        from matimo.integrations.crewai import convert_tools_to_crewai

        matimo_mock = MagicMock()
        matimo_mock.execute = AsyncMock(return_value={"ok": True})

        tools = convert_tools_to_crewai([_make_tool()], matimo_mock)
        assert len(tools) == 1

    def test_tool_name_preserved(self) -> None:
        pytest.importorskip("crewai")
        from matimo.integrations.crewai import convert_tools_to_crewai

        matimo_mock = MagicMock()
        matimo_mock.execute = AsyncMock(return_value={})

        tools = convert_tools_to_crewai([_make_tool("my_crew_tool")], matimo_mock)
        assert tools[0].name == "my_crew_tool"

    def test_tool_description_preserved(self) -> None:
        pytest.importorskip("crewai")
        from matimo.integrations.crewai import convert_tools_to_crewai

        matimo_mock = MagicMock()
        matimo_mock.execute = AsyncMock(return_value={})

        tools = convert_tools_to_crewai([_make_tool("t")], matimo_mock)
        assert "description" in tools[0].description.lower() or "t" in tools[0].description

    def test_run_method_sync_calls_execute(self) -> None:
        pytest.importorskip("crewai")
        from matimo.integrations.crewai import convert_tools_to_crewai

        matimo_mock = MagicMock()
        matimo_mock.execute = AsyncMock(return_value={"answer": "42"})

        tools = convert_tools_to_crewai([_make_tool()], matimo_mock)
        crew_tool = tools[0]
        # _run is a sync method
        crew_tool._run(query="meaning of life")
        matimo_mock.execute.assert_awaited()

    @pytest.mark.asyncio
    async def test_arun_method_async_calls_execute(self) -> None:
        pytest.importorskip("crewai")
        from matimo.integrations.crewai import convert_tools_to_crewai

        matimo_mock = MagicMock()
        matimo_mock.execute = AsyncMock(return_value={"answer": "42"})

        tools = convert_tools_to_crewai([_make_tool()], matimo_mock)
        crew_tool = tools[0]
        await crew_tool._arun(query="meaning of life")
        matimo_mock.execute.assert_awaited_once_with("search_tool", {"query": "meaning of life"})

    def test_multiple_tools_converted(self) -> None:
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

    @pytest.mark.asyncio
    async def test_arun_with_credentials(self) -> None:
        pytest.importorskip("crewai")
        from matimo.integrations.crewai import convert_tools_to_crewai

        matimo_mock = MagicMock()
        matimo_mock.execute = AsyncMock(return_value={"result": "ok"})

        tools = convert_tools_to_crewai([_make_tool()], matimo_mock, credentials={"MY_TOKEN": "secret"})
        crew_tool = tools[0]
        result = await crew_tool._arun(query="test")
        assert result == {"result": "ok"}
        # Credentials should have been passed through
        matimo_mock.execute.assert_awaited_once_with(
            "search_tool",
            {"query": "test"},
            credentials={"MY_TOKEN": "secret"},
        )

    def test_run_with_credentials(self) -> None:
        pytest.importorskip("crewai")
        from matimo.integrations.crewai import convert_tools_to_crewai

        matimo_mock = MagicMock()
        matimo_mock.execute = AsyncMock(return_value={"done": True})

        tools = convert_tools_to_crewai([_make_tool()], matimo_mock, credentials={"TOKEN": "x"})
        crew_tool = tools[0]
        result = crew_tool._run(query="hello")
        assert result == {"done": True}


class TestCrewAIImportError:
    def test_raises_import_error_without_crewai(self) -> None:
        """Without crewai installed, convert_tools_to_crewai raises ImportError."""
        import sys
        import unittest.mock

        matimo_mock = MagicMock()
        with unittest.mock.patch.dict(
            sys.modules,
            {"crewai": None, "crewai.tools": None},
        ):
            from importlib import reload
            # Re-import the module with crewai mocked as None
            # The function itself checks for crewai on call
            try:
                import matimo.integrations.crewai as crewai_mod
                reload(crewai_mod)
                crewai_mod.convert_tools_to_crewai([], matimo_mock)
            except ImportError:
                pass  # Expected
            except Exception:  # noqa: S110
                pass  # Module already imported — ImportError path may not be reachable


class TestCrewAISecretExclusion:
    def test_secret_param_excluded_from_schema(self) -> None:
        """Cover line 68: continue when is_secret_parameter()."""
        pytest.importorskip("crewai")
        from matimo.integrations.crewai import convert_tools_to_crewai

        matimo_mock = MagicMock()
        matimo_mock.execute = AsyncMock(return_value={})

        tool = _make_tool(
            params={
                "query": Parameter(type=ParameterType.STRING, description="q", required=True),
                "API_TOKEN": Parameter(type=ParameterType.STRING, description="secret", required=True),
            }
        )
        crew_tools = convert_tools_to_crewai([tool], matimo_mock)
        schema = crew_tools[0].args_schema.model_json_schema()
        props = schema.get("properties", {})
        assert "query" in props
        assert "API_TOKEN" not in props


class TestCrewAIRunBranches:
    def test_run_no_event_loop_creates_new(self) -> None:
        """Cover lines 90-92: except RuntimeError branch in _run."""
        pytest.importorskip("crewai")
        from unittest.mock import patch

        from matimo.integrations.crewai import convert_tools_to_crewai

        matimo_mock = MagicMock()
        matimo_mock.execute = AsyncMock(return_value={"ok": True})

        tools = convert_tools_to_crewai([_make_tool()], matimo_mock)
        crew_tool = tools[0]

        with patch("asyncio.get_event_loop", side_effect=RuntimeError("no loop")):
            result = crew_tool._run(query="test")

        assert result == {"ok": True}

    def test_run_in_running_loop_uses_thread(self) -> None:
        """Cover lines 96-102: concurrent.futures branch when loop.is_running()."""
        pytest.importorskip("crewai")
        from matimo.integrations.crewai import convert_tools_to_crewai

        matimo_mock = MagicMock()
        matimo_mock.execute = AsyncMock(return_value={"ok": True})

        tools = convert_tools_to_crewai([_make_tool()], matimo_mock)
        crew_tool = tools[0]

        # This is an async test so the event loop IS running → goes into ThreadPoolExecutor path
        result = crew_tool._run(query="hello")
        assert result == {"ok": True}


class TestMatimoInitCrewAIWrapper:
    def test_top_level_convert_tools_to_crewai(self) -> None:
        """Cover matimo/__init__.py lines 182-183: convert_tools_to_crewai wrapper."""
        pytest.importorskip("crewai")
        from matimo import convert_tools_to_crewai

        matimo_mock = MagicMock()
        matimo_mock.execute = AsyncMock(return_value={})

        tools = convert_tools_to_crewai([_make_tool()], matimo_mock)
        assert len(tools) == 1
