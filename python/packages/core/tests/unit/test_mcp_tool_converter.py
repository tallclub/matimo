"""Unit tests for mcp/tool_converter.py."""
from __future__ import annotations

import pytest

from matimo.core.models import HttpExecution, Parameter, ParameterType, ToolDefinition
from matimo.mcp.tool_converter import (
    _AUTH_PATTERNS,
    _is_auth_parameter,
    _parameter_to_json_schema,
    convert_parameters_to_mcp_schema,
    tool_to_mcp_registration,
)

# ---------------------------------------------------------------------------
# _is_auth_parameter
# ---------------------------------------------------------------------------


class TestIsAuthParameter:
    @pytest.mark.parametrize(
        "name",
        [
            "token",
            "api_token",
            "apiToken",
            "bot_token",
            "SLACK_BOT_TOKEN",
            "key",
            "api_key",
            "apiKey",
            "secret",
            "client_secret",
            "clientSecret",
            "password",
            "user_password",
            "credential",
            "auth",
            "auth_header",
            "bearer",
            "bearer_token",
            "access_token",
            "ACCESS_TOKEN",
        ],
    )
    def test_auth_parameter_detected(self, name: str) -> None:
        assert _is_auth_parameter(name) is True

    @pytest.mark.parametrize(
        "name",
        [
            "channel",
            "message",
            "user",
            "repo",
            "monkey",   # contains "key" as substring but NOT a full segment
            "author",   # contains "auth" as substring but NOT a full segment
            "count",
            "limit",
            "offset",
            "enabled",
        ],
    )
    def test_non_auth_parameter_not_detected(self, name: str) -> None:
        assert _is_auth_parameter(name) is False

    def test_auth_patterns_constant_is_frozenset(self) -> None:
        assert isinstance(_AUTH_PATTERNS, frozenset)
        assert "token" in _AUTH_PATTERNS
        assert "key" in _AUTH_PATTERNS


class TestConvertParametersToMcpSchema:
    def test_empty_parameters(self) -> None:
        schema = convert_parameters_to_mcp_schema({})
        assert schema["type"] == "object"
        assert schema["properties"] == {}
        assert "required" not in schema

    def test_single_required_parameter(self) -> None:
        params = {
            "channel": Parameter(
                type=ParameterType.STRING,
                description="The channel",
                required=True,
            )
        }
        schema = convert_parameters_to_mcp_schema(params)
        assert "channel" in schema["properties"]
        assert schema["required"] == ["channel"]

    def test_single_optional_parameter_no_required_key(self) -> None:
        params = {
            "text": Parameter(
                type=ParameterType.STRING,
                description="Optional text",
                required=False,
            )
        }
        schema = convert_parameters_to_mcp_schema(params)
        assert "required" not in schema

    def test_mixed_required_and_optional(self) -> None:
        params = {
            "required_param": Parameter(type=ParameterType.STRING, required=True),
            "optional_param": Parameter(type=ParameterType.NUMBER, required=False),
        }
        schema = convert_parameters_to_mcp_schema(params)
        assert "required_param" in schema["required"]
        assert "optional_param" not in schema["required"]

    def test_all_parameters_present(self) -> None:
        params = {
            "a": Parameter(type=ParameterType.STRING, required=True),
            "b": Parameter(type=ParameterType.BOOLEAN, required=True),
            "c": Parameter(type=ParameterType.NUMBER, required=False),
        }
        schema = convert_parameters_to_mcp_schema(params)
        assert set(schema["properties"].keys()) == {"a", "b", "c"}
        assert set(schema["required"]) == {"a", "b"}

    def test_auth_parameters_excluded(self) -> None:
        """Auth/secret params must be stripped so clients never see them."""
        params = {
            "channel": Parameter(type=ParameterType.STRING, required=True),
            "bot_token": Parameter(type=ParameterType.STRING, required=True),
            "api_key": Parameter(type=ParameterType.STRING, required=True),
            "message": Parameter(type=ParameterType.STRING, required=False),
        }
        schema = convert_parameters_to_mcp_schema(params)
        assert "channel" in schema["properties"]
        assert "message" in schema["properties"]
        assert "bot_token" not in schema["properties"]
        assert "api_key" not in schema["properties"]
        # Auth params must not appear in required either
        assert "bot_token" not in schema.get("required", [])
        assert "api_key" not in schema.get("required", [])

    def test_only_auth_parameters_returns_empty_properties(self) -> None:
        params = {
            "SLACK_BOT_TOKEN": Parameter(type=ParameterType.STRING, required=True),
            "api_key": Parameter(type=ParameterType.STRING, required=True),
        }
        schema = convert_parameters_to_mcp_schema(params)
        assert schema["properties"] == {}
        assert "required" not in schema


# ---------------------------------------------------------------------------
# tool_to_mcp_registration
# ---------------------------------------------------------------------------


def _make_tool_def(
    name: str = "my_tool",
    requires_approval: bool = False,
    params: dict[str, Parameter] | None = None,
) -> ToolDefinition:
    return ToolDefinition(
        name=name,
        description="A test tool",
        parameters=params or {
            "channel": Parameter(type=ParameterType.STRING, required=True),
        },
        execution=HttpExecution(type="http", method="GET", url="https://api.example.com/"),
        requires_approval=requires_approval,
    )


class TestToolToMcpRegistration:
    def test_returns_title_description_inputschema(self) -> None:
        tool = _make_tool_def()
        reg = tool_to_mcp_registration(tool)
        assert reg["title"] == "my_tool"
        assert reg["description"] == "A test tool"
        assert "inputSchema" in reg

    def test_description_falls_back_to_name_when_empty(self) -> None:
        tool = ToolDefinition(
            name="no_desc",
            description="",
            parameters={},
            execution=HttpExecution(type="http", method="GET", url="https://api.example.com/"),
        )
        reg = tool_to_mcp_registration(tool)
        assert reg["description"] == "no_desc"

    def test_no_matimo_approved_for_non_approval_tool(self) -> None:
        tool = _make_tool_def(requires_approval=False)
        reg = tool_to_mcp_registration(tool)
        props = reg["inputSchema"].get("properties", {})
        assert "_matimo_approved" not in props

    def test_matimo_approved_added_for_approval_tool(self) -> None:
        tool = _make_tool_def(requires_approval=True)
        reg = tool_to_mcp_registration(tool)
        props = reg["inputSchema"]["properties"]
        assert "_matimo_approved" in props
        assert props["_matimo_approved"]["type"] == "boolean"
        assert "description" in props["_matimo_approved"]

    def test_auth_params_excluded_in_registration(self) -> None:
        tool = _make_tool_def(
            params={
                "channel": Parameter(type=ParameterType.STRING, required=True),
                "bot_token": Parameter(type=ParameterType.STRING, required=True),
            }
        )
        reg = tool_to_mcp_registration(tool)
        props = reg["inputSchema"]["properties"]
        assert "channel" in props
        assert "bot_token" not in props


class TestParameterToJsonSchema:
    def test_string_type(self) -> None:
        param = Parameter(type=ParameterType.STRING)
        schema = _parameter_to_json_schema(param)
        assert schema["type"] == "string"

    def test_number_type(self) -> None:
        param = Parameter(type=ParameterType.NUMBER)
        schema = _parameter_to_json_schema(param)
        assert schema["type"] == "number"

    def test_boolean_type(self) -> None:
        param = Parameter(type=ParameterType.BOOLEAN)
        schema = _parameter_to_json_schema(param)
        assert schema["type"] == "boolean"

    def test_description_included(self) -> None:
        param = Parameter(type=ParameterType.STRING, description="A test string")
        schema = _parameter_to_json_schema(param)
        assert schema["description"] == "A test string"

    def test_no_description_excluded(self) -> None:
        param = Parameter(type=ParameterType.STRING)
        schema = _parameter_to_json_schema(param)
        assert "description" not in schema

    def test_enum_included(self) -> None:
        param = Parameter(type=ParameterType.STRING, enum=["a", "b", "c"])
        schema = _parameter_to_json_schema(param)
        assert schema["enum"] == ["a", "b", "c"]

    def test_no_enum_excluded(self) -> None:
        param = Parameter(type=ParameterType.STRING)
        schema = _parameter_to_json_schema(param)
        assert "enum" not in schema

    def test_default_included(self) -> None:
        param = Parameter(type=ParameterType.STRING, default="hello")
        schema = _parameter_to_json_schema(param)
        assert schema["default"] == "hello"

    def test_default_none_excluded(self) -> None:
        param = Parameter(type=ParameterType.STRING)
        schema = _parameter_to_json_schema(param)
        assert "default" not in schema

    def test_array_type_with_items(self) -> None:
        items_param = Parameter(type=ParameterType.STRING, description="Item")
        array_param = Parameter(type=ParameterType.ARRAY, items=items_param)
        schema = _parameter_to_json_schema(array_param)
        assert schema["type"] == "array"
        assert "items" in schema
        assert schema["items"]["type"] == "string"

    def test_array_type_without_items_has_empty_items_schema(self) -> None:
        # When no element type is specified, the converter adds items: {} so that
        # MCP clients that require the items key (e.g. some VS Code extensions) still
        # accept the schema. An empty schema means "items can be anything".
        param = Parameter(type=ParameterType.ARRAY)
        schema = _parameter_to_json_schema(param)
        assert schema["type"] == "array"
        assert "items" in schema
        assert schema["items"] == {}

    def test_object_type_with_properties(self) -> None:
        nested = Parameter(type=ParameterType.STRING, required=True)
        obj_param = Parameter(
            type=ParameterType.OBJECT,
            properties={"name": nested},
        )
        schema = _parameter_to_json_schema(obj_param)
        assert schema["type"] == "object"
        assert "name" in schema["properties"]
        assert schema["required"] == ["name"]

    def test_object_type_with_optional_properties(self) -> None:
        nested = Parameter(type=ParameterType.STRING, required=False)
        obj_param = Parameter(
            type=ParameterType.OBJECT,
            properties={"tag": nested},
        )
        schema = _parameter_to_json_schema(obj_param)
        assert schema["type"] == "object"
        assert "required" not in schema

    def test_object_type_without_properties_no_properties_key(self) -> None:
        param = Parameter(type=ParameterType.OBJECT)
        schema = _parameter_to_json_schema(param)
        assert schema["type"] == "object"
        assert "properties" not in schema
