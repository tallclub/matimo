"""Unit tests for Agno integration."""
from __future__ import annotations

import asyncio
import inspect
import sys
from unittest.mock import AsyncMock, MagicMock

import pytest

from matimo.core.models import (
    CommandExecution,
    FunctionExecution,
    HttpExecution,
    Parameter,
    ParameterType,
    PolicyContext,
    ToolDefinition,
)


def _make_tool(
    name: str = "search_tool",
    method: str = "GET",
    params: dict | None = None,
    **extra: object,
) -> ToolDefinition:
    return ToolDefinition(
        name=name,
        description=f"Tool {name} description",
        parameters=params if params is not None else {
            "query": Parameter(type=ParameterType.STRING, description="search query", required=True)
        },
        execution=HttpExecution(type="http", method=method, url="https://x.com/search"),
        **extra,
    )


def _make_matimo(result: object = None) -> MagicMock:
    """Mock Matimo instance: sync surface on MagicMock, execute() as AsyncMock."""
    matimo_mock = MagicMock()
    matimo_mock.execute = AsyncMock(return_value=result if result is not None else {"ok": True})
    return matimo_mock


class TestParameterSchemaTranslation:
    """Cover _parameter_to_json_schema: Matimo Parameter to JSON Schema."""

    def test_string_parameter(self) -> None:
        from matimo.integrations.agno import _parameter_to_json_schema

        schema = _parameter_to_json_schema(
            Parameter(type=ParameterType.STRING, description="a message", required=True)
        )
        assert schema == {"type": "string", "description": "a message"}

    def test_description_omitted_when_empty(self) -> None:
        from matimo.integrations.agno import _parameter_to_json_schema

        assert _parameter_to_json_schema(Parameter(type=ParameterType.NUMBER)) == {"type": "number"}

    def test_enum_preserved(self) -> None:
        from matimo.integrations.agno import _parameter_to_json_schema

        schema = _parameter_to_json_schema(Parameter(type=ParameterType.STRING, enum=["a", "b"]))
        assert schema["enum"] == ["a", "b"]

    def test_default_preserved(self) -> None:
        from matimo.integrations.agno import _parameter_to_json_schema

        assert _parameter_to_json_schema(Parameter(type=ParameterType.NUMBER, default=10))["default"] == 10

    def test_array_recurses_into_items(self) -> None:
        from matimo.integrations.agno import _parameter_to_json_schema

        schema = _parameter_to_json_schema(
            Parameter(
                type=ParameterType.ARRAY,
                items=Parameter(type=ParameterType.NUMBER, description="a number"),
            )
        )
        assert schema["items"] == {"type": "number", "description": "a number"}

    def test_untyped_array_defaults_items_to_string(self) -> None:
        """An empty items object is rejected by OpenAI's function-schema validator."""
        from matimo.integrations.agno import _parameter_to_json_schema

        assert _parameter_to_json_schema(Parameter(type=ParameterType.ARRAY))["items"] == {"type": "string"}

    def test_object_recurses_into_properties(self) -> None:
        from matimo.integrations.agno import _parameter_to_json_schema

        schema = _parameter_to_json_schema(
            Parameter(
                type=ParameterType.OBJECT,
                properties={"inner": Parameter(type=ParameterType.BOOLEAN, description="flag")},
            )
        )
        assert schema["properties"] == {"inner": {"type": "boolean", "description": "flag"}}

    def test_object_without_properties_omits_key(self) -> None:
        from matimo.integrations.agno import _parameter_to_json_schema

        assert _parameter_to_json_schema(Parameter(type=ParameterType.OBJECT)) == {"type": "object"}


class TestToolSchemaBuilding:
    """Cover _build_parameters_schema: whole-tool schema plus secret exclusion."""

    def test_required_params_listed(self) -> None:
        from matimo.integrations.agno import _build_parameters_schema

        schema = _build_parameters_schema(
            _make_tool(
                params={
                    "needed": Parameter(type=ParameterType.STRING, required=True),
                    "optional": Parameter(type=ParameterType.STRING, required=False),
                }
            )
        )
        assert schema["required"] == ["needed"]
        assert set(schema["properties"]) == {"needed", "optional"}

    def test_required_key_omitted_when_nothing_required(self) -> None:
        from matimo.integrations.agno import _build_parameters_schema

        schema = _build_parameters_schema(
            _make_tool(params={"optional": Parameter(type=ParameterType.STRING, required=False)})
        )
        assert "required" not in schema

    def test_secret_params_excluded_from_schema(self) -> None:
        from matimo.integrations.agno import _build_parameters_schema

        schema = _build_parameters_schema(
            _make_tool(
                params={
                    "query": Parameter(type=ParameterType.STRING, required=True),
                    "API_KEY": Parameter(type=ParameterType.STRING, required=True),
                    "BOT_TOKEN": Parameter(type=ParameterType.STRING, required=True),
                    "password": Parameter(type=ParameterType.STRING, required=True),
                }
            )
        )
        assert set(schema["properties"]) == {"query"}
        assert schema["required"] == ["query"]

    def test_tool_without_parameters(self) -> None:
        from matimo.integrations.agno import _build_parameters_schema

        assert _build_parameters_schema(_make_tool(params={})) == {"type": "object", "properties": {}}


class TestConfirmRiskLevels:
    """Cover _resolve_confirm_levels: risk selection normalisation."""

    def test_default_is_high_and_critical(self) -> None:
        from matimo.integrations.agno import DEFAULT_CONFIRM_RISK_LEVELS, _resolve_confirm_levels
        from matimo.policy.types import RiskLevel

        assert _resolve_confirm_levels(None) == frozenset({RiskLevel.HIGH, RiskLevel.CRITICAL})
        assert DEFAULT_CONFIRM_RISK_LEVELS == (RiskLevel.HIGH, RiskLevel.CRITICAL)

    def test_accepts_plain_strings(self) -> None:
        from matimo.integrations.agno import _resolve_confirm_levels
        from matimo.policy.types import RiskLevel

        assert _resolve_confirm_levels(["medium", "high"]) == frozenset(
            {RiskLevel.MEDIUM, RiskLevel.HIGH}
        )

    def test_accepts_enum_members(self) -> None:
        from matimo.integrations.agno import _resolve_confirm_levels
        from matimo.policy.types import RiskLevel

        assert _resolve_confirm_levels([RiskLevel.LOW]) == frozenset({RiskLevel.LOW})

    def test_empty_sequence_disables_confirmation(self) -> None:
        from matimo.integrations.agno import _resolve_confirm_levels

        assert _resolve_confirm_levels([]) == frozenset()

    def test_invalid_level_raises(self) -> None:
        from matimo.integrations.agno import _resolve_confirm_levels

        with pytest.raises(ValueError, match="nonsense"):
            _resolve_confirm_levels(["nonsense"])


class TestStripReservedParams:
    """Cover _strip_reserved: Agno-injected framework objects must not reach Matimo."""

    def test_removes_agno_injected_params(self) -> None:
        from matimo.integrations.agno import _strip_reserved

        cleaned = _strip_reserved(
            {"query": "hi", "agent": object(), "run_context": object(), "files": []}
        )
        assert cleaned == {"query": "hi"}

    def test_leaves_ordinary_params_untouched(self) -> None:
        from matimo.integrations.agno import _strip_reserved

        assert _strip_reserved({"a": 1, "b": 2}) == {"a": 1, "b": 2}


class TestAgnoConversion:
    def test_convert_returns_agno_functions(self) -> None:
        pytest.importorskip("agno")
        from matimo.integrations.agno import convert_tools_to_agno

        functions = convert_tools_to_agno([_make_tool("a"), _make_tool("b")], _make_matimo())
        assert [f.name for f in functions] == ["a", "b"]

    def test_tool_description_preserved(self) -> None:
        pytest.importorskip("agno")
        from matimo.integrations.agno import convert_tools_to_agno

        functions = convert_tools_to_agno([_make_tool("t")], _make_matimo())
        assert "Tool t description" in functions[0].description

    def test_schema_attached_to_function(self) -> None:
        pytest.importorskip("agno")
        from matimo.integrations.agno import convert_tools_to_agno

        functions = convert_tools_to_agno([_make_tool()], _make_matimo())
        assert functions[0].parameters["properties"]["query"]["type"] == "string"

    def test_secret_param_excluded_from_function_schema(self) -> None:
        pytest.importorskip("agno")
        from matimo.integrations.agno import convert_tools_to_agno

        tool = _make_tool(
            params={
                "query": Parameter(type=ParameterType.STRING, required=True),
                "API_TOKEN": Parameter(type=ParameterType.STRING, required=True),
            }
        )
        props = convert_tools_to_agno([tool], _make_matimo())[0].parameters["properties"]
        assert "query" in props
        assert "API_TOKEN" not in props

    def test_empty_tool_list(self) -> None:
        pytest.importorskip("agno")
        from matimo.integrations.agno import convert_tools_to_agno

        assert convert_tools_to_agno([], _make_matimo()) == []


class TestAgnoRiskConfirmationMapping:
    """Matimo risk level drives Agno's requires_confirmation flag."""

    def test_get_tool_does_not_require_confirmation(self) -> None:
        pytest.importorskip("agno")
        from matimo.integrations.agno import convert_tools_to_agno

        functions = convert_tools_to_agno([_make_tool(method="GET")], _make_matimo())
        assert functions[0].requires_confirmation is False

    def test_delete_tool_requires_confirmation(self) -> None:
        pytest.importorskip("agno")
        from matimo.integrations.agno import convert_tools_to_agno

        functions = convert_tools_to_agno([_make_tool(method="DELETE")], _make_matimo())
        assert functions[0].requires_confirmation is True

    def test_post_tool_does_not_confirm_by_default(self) -> None:
        """POST classifies as medium risk, which the default set deliberately excludes."""
        pytest.importorskip("agno")
        from matimo.integrations.agno import convert_tools_to_agno

        functions = convert_tools_to_agno([_make_tool(method="POST")], _make_matimo())
        assert functions[0].requires_confirmation is False

    def test_post_tool_confirms_when_medium_included(self) -> None:
        pytest.importorskip("agno")
        from matimo.integrations.agno import convert_tools_to_agno

        functions = convert_tools_to_agno(
            [_make_tool(method="POST")], _make_matimo(), confirm_risk_levels=["medium", "high"]
        )
        assert functions[0].requires_confirmation is True

    def test_function_execution_is_critical_and_confirms(self) -> None:
        pytest.importorskip("agno")
        from matimo.integrations.agno import convert_tools_to_agno

        tool = ToolDefinition(
            name="local_fn",
            description="runs code",
            parameters={},
            execution=FunctionExecution(type="function", code="./fn.py"),
        )
        assert convert_tools_to_agno([tool], _make_matimo())[0].requires_confirmation is True

    def test_command_execution_is_high_and_confirms(self) -> None:
        pytest.importorskip("agno")
        from matimo.integrations.agno import convert_tools_to_agno

        tool = ToolDefinition(
            name="shell",
            description="runs a command",
            parameters={},
            execution=CommandExecution(type="command", command="ls"),
        )
        assert convert_tools_to_agno([tool], _make_matimo())[0].requires_confirmation is True

    def test_self_declared_risk_raises_confirmation(self) -> None:
        """A GET tool declaring risk: high must confirm; declared risk can only raise."""
        pytest.importorskip("agno")
        from matimo.integrations.agno import convert_tools_to_agno

        functions = convert_tools_to_agno([_make_tool(risk="high")], _make_matimo())
        assert functions[0].requires_confirmation is True

    def test_empty_confirm_levels_never_confirms(self) -> None:
        pytest.importorskip("agno")
        from matimo.integrations.agno import convert_tools_to_agno

        functions = convert_tools_to_agno(
            [_make_tool(method="DELETE")], _make_matimo(), confirm_risk_levels=[]
        )
        assert functions[0].requires_confirmation is False


class TestAgnoEntrypointExecution:
    def test_entrypoint_routes_through_matimo_execute(self) -> None:
        pytest.importorskip("agno")
        from matimo.integrations.agno import convert_tools_to_agno

        matimo_mock = _make_matimo({"posted": True})
        functions = convert_tools_to_agno([_make_tool("send")], matimo_mock)

        assert functions[0].entrypoint(query="hello") == {"posted": True}
        matimo_mock.execute.assert_awaited_once_with(
            "send", {"query": "hello"}, credentials=None, context=None
        )

    def test_entrypoint_forwards_credentials(self) -> None:
        pytest.importorskip("agno")
        from matimo.integrations.agno import convert_tools_to_agno

        matimo_mock = _make_matimo()
        functions = convert_tools_to_agno(
            [_make_tool("send")], matimo_mock, {"MY_TOKEN": "secret"}
        )
        functions[0].entrypoint(query="test")

        matimo_mock.execute.assert_awaited_once_with(
            "send", {"query": "test"}, credentials={"MY_TOKEN": "secret"}, context=None
        )

    def test_entrypoint_forwards_policy_context(self) -> None:
        pytest.importorskip("agno")
        from matimo.integrations.agno import convert_tools_to_agno

        matimo_mock = _make_matimo()
        ctx = PolicyContext(agent_id="agent-1", environment="dev", roles=["admin"])
        functions = convert_tools_to_agno([_make_tool("send")], matimo_mock, context=ctx)
        functions[0].entrypoint(query="test")

        matimo_mock.execute.assert_awaited_once_with(
            "send", {"query": "test"}, credentials=None, context=ctx
        )

    def test_entrypoint_drops_agno_injected_params(self) -> None:
        pytest.importorskip("agno")
        from matimo.integrations.agno import convert_tools_to_agno

        matimo_mock = _make_matimo()
        functions = convert_tools_to_agno([_make_tool("send")], matimo_mock)
        functions[0].entrypoint(query="hi", agent=object(), run_context=object())

        matimo_mock.execute.assert_awaited_once_with(
            "send", {"query": "hi"}, credentials=None, context=None
        )

    def test_entrypoint_propagates_policy_denial(self) -> None:
        """A MatimoError from the policy engine must surface, not be swallowed."""
        pytest.importorskip("agno")
        from matimo.errors import ErrorCode, MatimoError
        from matimo.integrations.agno import convert_tools_to_agno

        matimo_mock = MagicMock()
        matimo_mock.execute = AsyncMock(
            side_effect=MatimoError("Policy denied execution", ErrorCode.POLICY_DENIED)
        )
        functions = convert_tools_to_agno([_make_tool("blocked")], matimo_mock)

        with pytest.raises(MatimoError) as excinfo:
            functions[0].entrypoint(query="hi")
        assert excinfo.value.code == ErrorCode.POLICY_DENIED

    def test_entrypoint_name_matches_tool(self) -> None:
        pytest.importorskip("agno")
        from matimo.integrations.agno import convert_tools_to_agno

        functions = convert_tools_to_agno([_make_tool("my_tool")], _make_matimo())
        assert functions[0].entrypoint.__name__ == "my_tool"


class TestMatimoToolsToolkit:
    def test_defaults_to_all_registered_tools(self) -> None:
        pytest.importorskip("agno")
        from matimo.integrations.agno import MatimoTools

        matimo_mock = _make_matimo()
        matimo_mock.list_tools.return_value = [_make_tool("a"), _make_tool("b")]

        toolkit = MatimoTools(matimo_mock)
        assert set(toolkit.functions) == {"a", "b"}

    def test_explicit_tool_list_overrides_list_tools(self) -> None:
        pytest.importorskip("agno")
        from matimo.integrations.agno import MatimoTools

        matimo_mock = _make_matimo()
        matimo_mock.list_tools.return_value = [_make_tool("ignored")]

        toolkit = MatimoTools(matimo_mock, [_make_tool("chosen")])
        assert set(toolkit.functions) == {"chosen"}

    def test_registers_sync_and_async_variants(self) -> None:
        """agent.run() uses functions, agent.arun() uses async_functions."""
        pytest.importorskip("agno")
        from matimo.integrations.agno import MatimoTools

        toolkit = MatimoTools(_make_matimo(), [_make_tool("a")])

        assert "a" in toolkit.functions
        assert "a" in toolkit.async_functions
        assert not inspect.iscoroutinefunction(toolkit.functions["a"].entrypoint)
        assert inspect.iscoroutinefunction(toolkit.async_functions["a"].entrypoint)

    def test_async_variant_keeps_full_parameter_schema(self) -> None:
        """Regression: registering via Agno's async_tools= would yield an empty schema."""
        pytest.importorskip("agno")
        from matimo.integrations.agno import MatimoTools, _build_parameters_schema

        tool = _make_tool("a")
        toolkit = MatimoTools(_make_matimo(), [tool])

        expected = _build_parameters_schema(tool)
        assert toolkit.async_functions["a"].parameters == expected
        assert toolkit.functions["a"].parameters == expected

    @pytest.mark.asyncio
    async def test_async_entrypoint_routes_through_matimo_execute(self) -> None:
        pytest.importorskip("agno")
        from matimo.integrations.agno import MatimoTools

        matimo_mock = _make_matimo({"ok": 1})
        toolkit = MatimoTools(matimo_mock, [_make_tool("send")])

        result = await toolkit.async_functions["send"].entrypoint(query="hi")

        assert result == {"ok": 1}
        matimo_mock.execute.assert_awaited_once_with(
            "send", {"query": "hi"}, credentials=None, context=None
        )

    def test_default_toolkit_name(self) -> None:
        pytest.importorskip("agno")
        from matimo.integrations.agno import MatimoTools

        assert MatimoTools(_make_matimo(), []).name == "matimo_tools"

    def test_custom_toolkit_name(self) -> None:
        pytest.importorskip("agno")
        from matimo.integrations.agno import MatimoTools

        assert MatimoTools(_make_matimo(), [], name="stock_tools").name == "stock_tools"

    def test_instructions_passed_through(self) -> None:
        pytest.importorskip("agno")
        from matimo.integrations.agno import MatimoTools

        toolkit = MatimoTools(_make_matimo(), [], instructions="Prefer read-only tools.")
        assert toolkit.instructions == "Prefer read-only tools."
        assert toolkit.add_instructions is True

    def test_extra_toolkit_kwargs_forwarded(self) -> None:
        pytest.importorskip("agno")
        from matimo.integrations.agno import MatimoTools

        toolkit = MatimoTools(_make_matimo(), [_make_tool("a")], exclude_tools=["a"])
        assert "a" not in toolkit.functions

    def test_risk_mapping_applies_to_toolkit_functions(self) -> None:
        pytest.importorskip("agno")
        from matimo.integrations.agno import MatimoTools

        toolkit = MatimoTools(
            _make_matimo(),
            [_make_tool("get_it", method="GET"), _make_tool("del_it", method="DELETE")],
        )
        assert toolkit.functions["get_it"].requires_confirmation is False
        assert toolkit.functions["del_it"].requires_confirmation is True


class TestAgnoImportError:
    def test_convert_raises_actionable_import_error(self, monkeypatch: pytest.MonkeyPatch) -> None:
        from matimo.integrations.agno import convert_tools_to_agno

        monkeypatch.setitem(sys.modules, "agno.tools.function", None)
        with pytest.raises(ImportError, match=r"pip install matimo\[agno\]"):
            convert_tools_to_agno([_make_tool()], _make_matimo())

    def test_toolkit_raises_actionable_import_error(self, monkeypatch: pytest.MonkeyPatch) -> None:
        from matimo.integrations.agno import MatimoTools

        monkeypatch.setitem(sys.modules, "agno.tools.toolkit", None)
        with pytest.raises(ImportError, match=r"pip install matimo\[agno\]"):
            MatimoTools(_make_matimo(), [])


class TestMatimoInitAgnoWrapper:
    """The top-level lazy wrapper must be importable from the matimo namespace."""

    def test_top_level_convert_tools_to_agno_importable(self) -> None:
        pytest.importorskip("agno")
        from matimo import convert_tools_to_agno

        functions = convert_tools_to_agno([_make_tool("a")], _make_matimo())
        assert functions[0].name == "a"

    def test_top_level_matimo_tools_importable(self) -> None:
        pytest.importorskip("agno")
        from matimo import MatimoTools

        assert MatimoTools(_make_matimo(), [_make_tool("a")]).name == "matimo_tools"


class TestAsyncBridge:
    """Cover _async_bridge.run_coroutine_sync, which backs the sync entrypoint."""

    def test_runs_coroutine_without_a_running_loop(self) -> None:
        from matimo.integrations._async_bridge import run_coroutine_sync

        async def work() -> str:
            return "done"

        assert run_coroutine_sync(work()) == "done"

    def test_runs_coroutine_from_inside_a_running_loop(self) -> None:
        """Cover the thread-offload branch taken when a loop is already running."""
        from matimo.integrations._async_bridge import run_coroutine_sync

        async def work() -> str:
            return "from thread"

        async def outer() -> str:
            return run_coroutine_sync(work())

        assert asyncio.run(outer()) == "from thread"

    def test_propagates_exceptions(self) -> None:
        from matimo.integrations._async_bridge import run_coroutine_sync

        async def boom() -> None:
            raise ValueError("kaboom")

        with pytest.raises(ValueError, match="kaboom"):
            run_coroutine_sync(boom())

    def test_propagates_exceptions_from_inside_a_running_loop(self) -> None:
        from matimo.integrations._async_bridge import run_coroutine_sync

        async def boom() -> None:
            raise ValueError("kaboom")

        async def outer() -> None:
            run_coroutine_sync(boom())

        with pytest.raises(ValueError, match="kaboom"):
            asyncio.run(outer())
