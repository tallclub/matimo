"""Unit tests for LangChain integration."""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

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
    def test_convert_returns_langchain_tools(self) -> None:
        pytest.importorskip("langchain_core")
        from matimo.integrations.langchain import convert_tools_to_langchain

        matimo_mock = AsyncMock()
        matimo_mock.execute = AsyncMock(return_value={"ok": True})

        tools = convert_tools_to_langchain([_make_tool()], matimo_mock)
        assert len(tools) == 1

    def test_tool_name_preserved(self) -> None:
        pytest.importorskip("langchain_core")
        from matimo.integrations.langchain import convert_tools_to_langchain

        matimo_mock = AsyncMock()
        matimo_mock.execute = AsyncMock(return_value={"ok": True})

        tools = convert_tools_to_langchain([_make_tool("my_special_tool")], matimo_mock)
        assert tools[0].name == "my_special_tool"

    def test_tool_description_preserved(self) -> None:
        pytest.importorskip("langchain_core")
        from matimo.integrations.langchain import convert_tools_to_langchain

        matimo_mock = AsyncMock()
        matimo_mock.execute = AsyncMock(return_value={"ok": True})

        tools = convert_tools_to_langchain([_make_tool("t")], matimo_mock)
        assert "Tool t" in tools[0].description

    def test_secret_params_excluded_from_schema(self) -> None:
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
    async def test_invoke_calls_matimo_execute(self) -> None:
        pytest.importorskip("langchain_core")
        from matimo.integrations.langchain import convert_tools_to_langchain

        matimo_mock = MagicMock()
        matimo_mock.execute = AsyncMock(return_value={"result": "ok"})

        tools = convert_tools_to_langchain([_make_tool()], matimo_mock)
        await tools[0].ainvoke({"message": "hello"})
        matimo_mock.execute.assert_awaited_once_with("echo_tool", {"message": "hello"}, credentials=None)

    def test_multiple_tools_converted(self) -> None:
        pytest.importorskip("langchain_core")
        from matimo.integrations.langchain import convert_tools_to_langchain

        matimo_mock = MagicMock()
        matimo_mock.execute = AsyncMock(return_value={})

        tool_defs = [_make_tool(f"tool_{i}") for i in range(5)]
        lc_tools = convert_tools_to_langchain(tool_defs, matimo_mock)
        assert len(lc_tools) == 5


class TestLangChainImportError:
    def test_raises_import_error_without_langchain(self) -> None:
        """Cover lines 54-55: except ImportError when langchain-core is not installed."""
        import sys
        from unittest.mock import patch

        matimo_mock = MagicMock()
        with patch.dict(sys.modules, {"langchain_core": None, "langchain_core.tools": None}):
            from importlib import reload

            import matimo.integrations.langchain as lc_mod
            reload(lc_mod)
            with pytest.raises(ImportError, match="langchain-core"):
                lc_mod.convert_tools_to_langchain([_make_tool()], matimo_mock)


class TestLangChainOptionalParam:
    def test_optional_param_uses_none_union(self) -> None:
        """Cover line 128: py_type = py_type | None for non-required params."""
        pytest.importorskip("langchain_core")
        from matimo.integrations.langchain import convert_tools_to_langchain

        matimo_mock = MagicMock()
        matimo_mock.execute = AsyncMock(return_value={})

        tool = _make_tool(
            params={
                "message": Parameter(type=ParameterType.STRING, description="msg", required=True),
                "context": Parameter(type=ParameterType.STRING, description="opt", required=False),
            }
        )
        lc_tools = convert_tools_to_langchain([tool], matimo_mock)
        assert len(lc_tools) == 1
        schema = lc_tools[0].args_schema.model_json_schema()
        # required field should be in required list; optional should not be
        required_fields = schema.get("required", [])
        assert "message" in required_fields
        assert "context" not in required_fields


class TestMatimoInitLangChainWrapper:
    def test_top_level_convert_tools_to_langchain(self) -> None:
        """Cover matimo/__init__.py lines 172-173: convert_tools_to_langchain wrapper."""
        pytest.importorskip("langchain_core")
        from matimo import convert_tools_to_langchain

        matimo_mock = MagicMock()
        matimo_mock.execute = AsyncMock(return_value={})

        tools = convert_tools_to_langchain([_make_tool()], matimo_mock)
        assert len(tools) == 1


# ---------------------------------------------------------------------------
# Skills Metadata and Semantic Search Tests
# ---------------------------------------------------------------------------


class TestGetSkillsMetadata:
    """Cover get_skills_metadata() function — lines 112-128."""

    def test_returns_empty_when_no_skills(self) -> None:
        """No skills → empty list."""
        matimo_mock = MagicMock()
        matimo_mock.list_skills.return_value = []

        from matimo.integrations.langchain import get_skills_metadata

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

        from matimo.integrations.langchain import get_skills_metadata

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

        from matimo.integrations.langchain import get_skills_metadata

        result = get_skills_metadata(matimo_mock)
        assert result[0]["description"] == ""


class TestBuildRelevantSkillPrompt:
    """Cover build_relevant_skill_prompt() function — lines 131-194."""

    @pytest.mark.asyncio
    async def test_returns_empty_string_when_no_search_results(self) -> None:
        """No skills match → empty string."""
        matimo_mock = AsyncMock()
        matimo_mock.semantic_search_skills = AsyncMock(return_value=[])

        from matimo.integrations.langchain import build_relevant_skill_prompt

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

        from matimo.integrations.langchain import build_relevant_skill_prompt

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

        from matimo.integrations.langchain import build_relevant_skill_prompt

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

        from matimo.integrations.langchain import build_relevant_skill_prompt

        await build_relevant_skill_prompt(matimo_mock, "query", top_k=5)
        matimo_mock.semantic_search_skills.assert_called_once_with(
            "query", limit=5, min_score=0.3
        )

    @pytest.mark.asyncio
    async def test_respects_min_score(self) -> None:
        """min_score parameter passed to semantic_search_skills."""
        matimo_mock = AsyncMock()
        matimo_mock.semantic_search_skills = AsyncMock(return_value=[])

        from matimo.integrations.langchain import build_relevant_skill_prompt

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

        from matimo.integrations.langchain import build_relevant_skill_prompt

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

        from matimo.integrations.langchain import build_relevant_skill_prompt

        result = await build_relevant_skill_prompt(matimo_mock, "query")
        assert result == ""
