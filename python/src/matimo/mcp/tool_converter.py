"""
MCP tool converter — converts Matimo parameter schemas to MCP JSON Schema.
Mirrors: packages/core/src/mcp/tool-converter.ts
"""
from __future__ import annotations

from typing import Any

from matimo.core.models import Parameter


def convert_parameters_to_mcp_schema(
    parameters: dict[str, Parameter],
) -> dict[str, Any]:
    """
    Convert a Matimo parameters dict to a JSON Schema object suitable for
    MCP inputSchema.

    Returns a JSON Schema of type: object with properties + required list.
    """
    properties: dict[str, Any] = {}
    required: list[str] = []

    for name, param in parameters.items():
        properties[name] = _parameter_to_json_schema(param)
        if param.required:
            required.append(name)

    schema: dict[str, Any] = {"type": "object", "properties": properties}
    if required:
        schema["required"] = required
    return schema


def _parameter_to_json_schema(param: Parameter) -> dict[str, Any]:
    """Convert a single Matimo Parameter to a JSON Schema fragment."""
    schema: dict[str, Any] = {"type": param.type.value}

    if param.description:
        schema["description"] = param.description
    if param.enum:
        schema["enum"] = param.enum
    if param.default is not None:
        schema["default"] = param.default

    if param.type.value == "array" and param.items:
        schema["items"] = _parameter_to_json_schema(param.items)

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
