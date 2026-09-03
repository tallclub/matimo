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


def derive_tool_annotations(tool: ToolDefinition) -> dict[str, bool]:
    """
    Derive MCP standard tool annotations directly from execution type and
    HTTP method. Mirrors deriveToolAnnotations() in tool-converter.ts.

    More precise than projecting through the aggregate risk *level* string,
    since e.g. GET and DELETE can share a risk tier on some tools while
    having opposite readOnlyHint/destructiveHint values.

    `requires_approval=True` always forces destructiveHint to True, since
    that flag exists precisely to flag operations a human should confirm.
    """
    exec_type = tool.execution.type

    if exec_type in ("function", "command"):
        annotations = {
            "readOnlyHint": False,
            "destructiveHint": True,
            "idempotentHint": False,
            "openWorldHint": True,
        }
    elif exec_type == "http":
        method = tool.execution.method.upper()  # type: ignore[union-attr]
        if method == "GET":
            annotations = {
                "readOnlyHint": True,
                "destructiveHint": False,
                "idempotentHint": True,
                "openWorldHint": True,
            }
        elif method == "PUT":
            annotations = {
                "readOnlyHint": False,
                "destructiveHint": False,
                "idempotentHint": True,
                "openWorldHint": True,
            }
        elif method == "DELETE":
            annotations = {
                "readOnlyHint": False,
                "destructiveHint": True,
                "idempotentHint": True,
                "openWorldHint": True,
            }
        else:
            # POST, PATCH, and any other write method: not idempotent by default
            annotations = {
                "readOnlyHint": False,
                "destructiveHint": False,
                "idempotentHint": False,
                "openWorldHint": True,
            }
    else:
        # Unknown execution type — treat conservatively (matches
        # _classify_automatic_risk's HIGH fallback for unrecognized types).
        annotations = {
            "readOnlyHint": False,
            "destructiveHint": True,
            "idempotentHint": False,
            "openWorldHint": True,
        }

    if tool.requires_approval:
        annotations = {**annotations, "destructiveHint": True}

    return annotations


def humanize_tool_name(name: str) -> str:
    """
    Convert a snake_case tool name into a human-readable title for MCP
    clients, e.g. `slack_get_channel_history` -> `Slack Get Channel History`.
    Mirrors humanizeToolName() in tool-converter.ts — only the first
    character of each word is uppercased, the remainder is left as-is.
    """
    return " ".join(word[0].upper() + word[1:] for word in name.split("_") if word)


def tool_to_mcp_registration(tool: ToolDefinition) -> dict[str, Any]:
    """
    Build the full MCP tool registration metadata from a ToolDefinition.
    Mirrors toolToMcpRegistration() in tool-converter.ts.

    Returns a dict with title, description, inputSchema, and annotations.
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
        "title": humanize_tool_name(tool.name),
        "description": tool.description or tool.name,
        "inputSchema": schema,
        "annotations": derive_tool_annotations(tool),
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
        else:
            # Some MCP clients/extensions require `items` to be present
            # for array-typed parameters. When the tool doesn't specify an
            # element type, provide an empty schema so validators accept it.
            schema["items"] = {}

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
