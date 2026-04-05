"""Unit tests for Pydantic models in matimo.core.models."""
from __future__ import annotations

import pytest
from pydantic import ValidationError

from matimo.core.models import (
    AuthConfig,
    AuthType,
    CommandExecution,
    FunctionExecution,
    HttpExecution,
    Parameter,
    ParameterEncoding,
    ParameterEncodingType,
    ParameterType,
    ToolDefinition,
    ToolStatus,
)


class TestParameter:
    def test_required_defaults_to_false_or_none(self):
        p = Parameter(type=ParameterType.STRING, description="desc")
        # required is Optional[bool], defaults to None (falsy)
        assert not p.required

    def test_all_parameter_types_valid(self):
        for pt in ParameterType:
            p = Parameter(type=pt, description="x")
            assert p.type == pt

    def test_enum_values_as_strings_list(self):
        p = Parameter(type=ParameterType.STRING, description="x", enum=["a", "b"])
        assert p.enum == ["a", "b"]

    def test_unknown_field_ignored_extra_allow(self):
        # Models use extra='allow' for forward-compat
        p = Parameter(type=ParameterType.STRING, description="x", future_field="y")
        assert p.future_field == "y"  # type: ignore[attr-defined]


class TestHttpExecution:
    def test_minimal_http(self):
        e = HttpExecution(type="http", method="GET", url="https://example.com")
        assert e.method == "GET"
        assert e.url == "https://example.com"
        assert e.headers == {}
        assert e.query_params == {}
        assert e.body is None

    def test_method_uppercased(self):
        e = HttpExecution(type="http", method="post", url="https://x.com")
        assert e.method == "POST"

    def test_type_must_be_http(self):
        with pytest.raises(ValidationError):
            HttpExecution(type="command", method="GET", url="https://x.com")

    def test_body_dict(self):
        e = HttpExecution(type="http", method="POST", url="https://x.com", body={"k": "v"})
        assert e.body == {"k": "v"}

    def test_parameter_encodings_list(self):
        enc = ParameterEncoding(param="payload", encoding=ParameterEncodingType.JSON)
        e = HttpExecution(
            type="http", method="POST", url="https://x.com", parameter_encodings=[enc]
        )
        assert len(e.parameter_encodings) == 1
        assert e.parameter_encodings[0].encoding == ParameterEncodingType.JSON


class TestCommandExecution:
    def test_minimal_command(self):
        e = CommandExecution(type="command", command="echo")
        assert e.command == "echo"
        assert e.args == []
        assert e.timeout == 30_000

    def test_type_must_be_command(self):
        with pytest.raises(ValidationError):
            CommandExecution(type="http", command="echo")

    def test_custom_timeout(self):
        e = CommandExecution(type="command", command="sleep", timeout=5000)
        assert e.timeout == 5000


class TestFunctionExecution:
    def test_minimal_function(self):
        e = FunctionExecution(type="function", code="path/to/func.py")
        assert e.code == "path/to/func.py"

    def test_type_must_be_function(self):
        with pytest.raises(ValidationError):
            FunctionExecution(type="command", code="x.py")


class TestToolDefinition:
    def test_minimal_required_fields(self):
        tool = ToolDefinition(
            name="my_tool",
            description="Test",
            execution=HttpExecution(type="http", method="GET", url="https://x.com"),
        )
        assert tool.name == "my_tool"
        assert tool.version == "1.0.0"  # default
        assert tool.status == ToolStatus.STABLE  # default
        assert tool.parameters == {}
        assert tool.tags == []
        assert tool.requires_approval is False

    def test_missing_name_raises(self):
        with pytest.raises(ValidationError):
            ToolDefinition(
                description="No name",
                execution=HttpExecution(type="http", method="GET", url="https://x.com"),
            )

    def test_missing_execution_raises(self):
        with pytest.raises(ValidationError):
            ToolDefinition(name="tool", description="No exec")

    def test_deprecated_status(self):
        tool = ToolDefinition(
            name="old_tool",
            description="Deprecated",
            execution=HttpExecution(type="http", method="GET", url="https://x.com"),
            status=ToolStatus.DEPRECATED,
        )
        assert tool.status == ToolStatus.DEPRECATED

    def test_discriminated_union_http(self):
        tool = ToolDefinition(
            name="t",
            description="d",
            execution={"type": "http", "method": "GET", "url": "https://x.com"},
        )
        assert isinstance(tool.execution, HttpExecution)

    def test_discriminated_union_command(self):
        tool = ToolDefinition(
            name="t",
            description="d",
            execution={"type": "command", "command": "ls"},
        )
        assert isinstance(tool.execution, CommandExecution)

    def test_discriminated_union_function(self):
        tool = ToolDefinition(
            name="t",
            description="d",
            execution={"type": "function", "code": "x.py"},
        )
        assert isinstance(tool.execution, FunctionExecution)

    def test_set_definition_path(self):
        tool = ToolDefinition(
            name="t",
            description="d",
            execution=HttpExecution(type="http", method="GET", url="https://x.com"),
        )
        assert tool.definition_path is None
        tool.set_definition_path("/path/to/definition.yaml")
        assert tool.definition_path == "/path/to/definition.yaml"

    def test_auth_config(self):
        auth = AuthConfig(type=AuthType.API_KEY, location="header", name="Authorization")
        tool = ToolDefinition(
            name="t",
            description="d",
            execution=HttpExecution(type="http", method="GET", url="https://x.com"),
            authentication=auth,
        )
        assert tool.authentication is not None
        assert tool.authentication.type == AuthType.API_KEY

    def test_requires_approval_flag(self):
        tool = ToolDefinition(
            name="t",
            description="d",
            execution=HttpExecution(type="http", method="DELETE", url="https://x.com/{id}"),
            requires_approval=True,
        )
        assert tool.requires_approval is True

    def test_tags_list(self):
        tool = ToolDefinition(
            name="t",
            description="d",
            execution=HttpExecution(type="http", method="GET", url="https://x.com"),
            tags=["messaging", "slack"],
        )
        assert "messaging" in tool.tags
        assert "slack" in tool.tags
