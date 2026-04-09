"""Unit tests for mcp/tool_converter.py."""
from __future__ import annotations

from matimo.core.models import Parameter, ParameterType
from matimo.mcp.tool_converter import (
    _parameter_to_json_schema,
    convert_parameters_to_mcp_schema,
)


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

    def test_array_type_without_items_no_items_key(self) -> None:
        param = Parameter(type=ParameterType.ARRAY)
        schema = _parameter_to_json_schema(param)
        assert schema["type"] == "array"
        assert "items" not in schema

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
