"""
MCP tool converter — converts Matimo parameter schemas to MCP JSON Schema.
Mirrors: packages/core/src/mcp/tool-converter.ts
"""
from __future__ import annotations

import re
from typing import Any

from matimo.core.models import Parameter, ToolDefinition

# Auth-related parameter name patterns.
# Parameters matching these are excluded from the MCP input schema
# because they are injected server-side by the secret resolver.
_AUTH_PATTERNS = frozenset(
    ["token", "key", "secret", "password", "credential", "auth", "bearer"]
)


def _is_auth_parameter(name: str) -> bool:
    """
    Check if a parameter name looks like a secret/auth parameter.

    Normalises camelCase to segments first (e.g. apiKey → ['api', 'key']),
    then splits on word separators (_ - .) and checks each segment for an
    exact match against _AUTH_PATTERNS, preventing false positives such as
    "monkey" matching "key" or "author" matching "auth".
    """
    # Convert camelCase → snake_case (apiKey → api_key)
    snake = re.sub(r"([a-z])([A-Z])", r"\1_\2", name).lower()
    segments = [s for s in re.split(r"[_\-.]+", snake) if s]
    return any(segment in _AUTH_PATTERNS for segment in segments)


def convert_parameters_to_mcp_schema(
    parameters: dict[str, Parameter],
) -> dict[str, Any]:
    """
    Convert a Matimo parameters dict to a JSON Schema object suitable for
    MCP inputSchema. Auth parameters are excluded — they are injected server-side.

    Returns a JSON Schema of type: object with properties + required list.
    """
    properties: dict[str, Any] = {}
    required: list[str] = []

    for name, param in parameters.items():
        # Skip auth parameters — they are injected by the MCP server
        if _is_auth_parameter(name):
            continue
        properties[name] = _parameter_to_json_schema(param)
        if param.required:
            required.append(name)

    schema: dict[str, Any] = {"type": "object", "properties": properties}
    if required:
        schema["required"] = required
    return schema


def tool_to_mcp_registration(tool: ToolDefinition) -> dict[str, Any]:
    """
    Build the full MCP tool registration metadata from a ToolDefinition.
    Mirrors toolToMcpRegistration() in tool-converter.ts.

    Returns a dict with title, description, and inputSchema.
    Tools with requires_approval get an extra ``_matimo_approved`` parameter
    so clients can confirm destructive operations.
    """
    schema = convert_parameters_to_mcp_schema(tool.parameters or {})

    # Tools with requires_approval need the _matimo_approved parameter in
    # the MCP schema so clients can confirm destructive operations.
    if tool.requires_approval:
        schema.setdefault("properties", {})["_matimo_approved"] = {
            "type": "boolean",
            "description": (
                "Set to true to confirm execution of this approval-required tool"
            ),
        }

    return {
        "title": tool.name,
        "description": tool.description or tool.name,
        "inputSchema": schema,
    }


def _parameter_to_json_schema(param: Parameter) -> dict[str, Any]:
    """Convert a single Matimo Parameter to a JSON Schema fragment."""
    schema: dict[str, Any] = {"type": param.type.value}

    if param.description:
        schema["description"] = param.description
    if param.enum:
        schema["enum"] = param.enum
    if param.default is not None:
        schema["default"] = param.default

    if param.type.value == "array":
        if param.items:
            schema["items"] = _parameter_to_json_schema(param.items)
        # If no `items` are provided, do not inject a default `items` key.
        # The MCP schema should omit `items` when the tool definition doesn't
        # specify the element type.

    if param.type.value == "object" and param.properties:
        nested_props: dict[str, Any] = {}
        nested_required: list[str] = []
        for k, v in param.properties.items():
            nested_props[k] = _parameter_to_json_schema(v)
            if v.required:
                nested_required.append(k)
        schema["properties"] = nested_props
        if nested_required:
            schema["required"] = nested_required

    return schema
