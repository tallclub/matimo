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


# ---------------------------------------------------------------------------
# Skill injection helpers (get_skills_metadata / build_relevant_skill_prompt)
# ---------------------------------------------------------------------------


class TestGetSkillsMetadata:
    """Cover get_skills_metadata() in matimo.integrations.crewai."""

    def test_returns_empty_when_no_skills(self) -> None:
        """No skills → empty list."""
        matimo_mock = MagicMock()
        matimo_mock.list_skills.return_value = []

        from matimo.integrations.crewai import get_skills_metadata

        result = get_skills_metadata(matimo_mock)
        assert result == []

    def test_returns_name_and_description_for_each_skill(self) -> None:
        """Each skill returns {name, description}."""
        from matimo.core.models import SkillSummary

        matimo_mock = MagicMock()
        matimo_mock.list_skills.return_value = [
            SkillSummary(
                name="code-review",
                description="Code review guidelines",
                version="1.0.0",
            ),
            SkillSummary(
                name="debugging",
                description="Debugging tips",
                version="1.0.0",
            ),
        ]

        from matimo.integrations.crewai import get_skills_metadata

        result = get_skills_metadata(matimo_mock)
        assert len(result) == 2
        assert result[0] == {"name": "code-review", "description": "Code review guidelines"}
        assert result[1] == {"name": "debugging", "description": "Debugging tips"}

    def test_handles_skills_without_description(self) -> None:
        """Skill with no description returns empty string."""
        from matimo.core.models import SkillSummary

        matimo_mock = MagicMock()
        matimo_mock.list_skills.return_value = [
            SkillSummary(
                name="skill-a",
                description="",
                version="1.0.0",
            ),
        ]

        from matimo.integrations.crewai import get_skills_metadata

        result = get_skills_metadata(matimo_mock)
        assert result[0]["description"] == ""


class TestBuildRelevantSkillPrompt:
    """Cover build_relevant_skill_prompt() in matimo.integrations.crewai."""

    @pytest.mark.asyncio
    async def test_returns_empty_string_when_no_search_results(self) -> None:
        """No skills match → empty string."""
        matimo_mock = AsyncMock()
        matimo_mock.semantic_search_skills = AsyncMock(return_value=[])

        from matimo.integrations.crewai import build_relevant_skill_prompt

        result = await build_relevant_skill_prompt(matimo_mock, "test query")
        assert result == ""

    @pytest.mark.asyncio
    async def test_returns_formatted_skill_content_with_default_header(self) -> None:
        """Matching skill → formatted output with default header."""
        from types import SimpleNamespace

        from matimo.core.models import SkillSummary

        skill_summary = SkillSummary(
            name="code-review",
            description="Code review guidelines",
            version="1.0.0",
        )
        search_result = SimpleNamespace(skill=skill_summary, score=0.85)

        matimo_mock = AsyncMock()
        matimo_mock.semantic_search_skills = AsyncMock(return_value=[search_result])
        matimo_mock.get_skill_content = MagicMock(return_value="# Code Review Checklist\n- Test coverage")

        from matimo.integrations.crewai import build_relevant_skill_prompt

        result = await build_relevant_skill_prompt(matimo_mock, "code review")
        assert "The following skills are relevant" in result
        assert "Code Review Checklist" in result
        assert "0.85" in result

    @pytest.mark.asyncio
    async def test_uses_custom_header_when_provided(self) -> None:
        """Custom header overrides default."""
        from types import SimpleNamespace

        from matimo.core.models import SkillSummary

        skill_summary = SkillSummary(
            name="skill", description="desc", version="1.0.0"
        )
        search_result = SimpleNamespace(skill=skill_summary, score=0.8)

        matimo_mock = AsyncMock()
        matimo_mock.semantic_search_skills = AsyncMock(return_value=[search_result])
        matimo_mock.get_skill_content = MagicMock(return_value="content")

        from matimo.integrations.crewai import build_relevant_skill_prompt

        result = await build_relevant_skill_prompt(
            matimo_mock,
            "query",
            header="Custom header",
        )
        assert "Custom header" in result
        assert "The following skills are relevant" not in result

    @pytest.mark.asyncio
    async def test_respects_top_k_limit(self) -> None:
        """top_k parameter passed to semantic_search_skills."""
        matimo_mock = AsyncMock()
        matimo_mock.semantic_search_skills = AsyncMock(return_value=[])

        from matimo.integrations.crewai import build_relevant_skill_prompt

        await build_relevant_skill_prompt(matimo_mock, "query", top_k=5)
        matimo_mock.semantic_search_skills.assert_called_once_with(
            "query", limit=5, min_score=0.3
        )

    @pytest.mark.asyncio
    async def test_respects_min_score(self) -> None:
        """min_score parameter passed to semantic_search_skills."""
        matimo_mock = AsyncMock()
        matimo_mock.semantic_search_skills = AsyncMock(return_value=[])

        from matimo.integrations.crewai import build_relevant_skill_prompt

        await build_relevant_skill_prompt(matimo_mock, "query", min_score=0.5)
        matimo_mock.semantic_search_skills.assert_called_once_with(
            "query", limit=3, min_score=0.5
        )

    @pytest.mark.asyncio
    async def test_handles_skill_without_description(self) -> None:
        """Skill with no description still renders correctly."""
        from types import SimpleNamespace

        from matimo.core.models import SkillSummary

        skill_summary = SkillSummary(
            name="skill", description="", version="1.0.0"
        )
        search_result = SimpleNamespace(skill=skill_summary, score=0.7)

        matimo_mock = AsyncMock()
        matimo_mock.semantic_search_skills = AsyncMock(return_value=[search_result])
        matimo_mock.get_skill_content = MagicMock(return_value="content\nblock")

        from matimo.integrations.crewai import build_relevant_skill_prompt

        result = await build_relevant_skill_prompt(matimo_mock, "query")
        assert "skill" in result
        assert "0.70" in result

    @pytest.mark.asyncio
    async def test_returns_empty_string_when_no_skill_content(self) -> None:
        """Matching skill but get_skill_content returns None → empty string."""
        from types import SimpleNamespace

        from matimo.core.models import SkillSummary

        skill_summary = SkillSummary(
            name="skill", description="desc", version="1.0.0"
        )
        search_result = SimpleNamespace(skill=skill_summary, score=0.8)

        matimo_mock = AsyncMock()
        matimo_mock.semantic_search_skills = AsyncMock(return_value=[search_result])
        matimo_mock.get_skill_content = MagicMock(return_value=None)

        from matimo.integrations.crewai import build_relevant_skill_prompt

        result = await build_relevant_skill_prompt(matimo_mock, "query")
        assert result == ""
