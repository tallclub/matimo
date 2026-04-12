"""
Shared Pydantic utilities for integrations (LangChain, CrewAI, etc.).
Internal module — not part of the public API.
"""
from __future__ import annotations

import re
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from matimo.core.models import Parameter

# Patterns that identify a parameter as a secret (should be hidden from LLM schema)
# re.IGNORECASE ensures lowercase names like 'token', 'api_key', 'secret' are detected
_SECRET_RE = re.compile(
    r"(?:^|_)(TOKEN|KEY|SECRET|PASSWORD)(?:_|$)|"
    r"[a-z](Token|Key|Secret|Password)",
    re.IGNORECASE,
)


def is_secret_parameter(name: str) -> bool:
    """Return True if the parameter name looks like a credential."""
    return bool(_SECRET_RE.search(name))


def sanitize_model_name(tool_name: str) -> str:
    """
    Convert a tool name into a valid Python identifier for Pydantic model names.
    
    Replaces hyphens, dots, and other non-alphanumeric characters with underscores.
    Ensures the result is a valid Python identifier (starts with letter or underscore).
    
    Examples:
        'github-create-issue' -> 'github_create_issue'
        'my.tool' -> 'my_tool'
        '2to3' -> '_2to3'
    """
    # Replace non-alphanumeric chars (except underscore) with underscore
    sanitized = re.sub(r'[^a-zA-Z0-9_]', '_', tool_name)
    # Ensure it doesn't start with a digit (prepend _ if it does)
    if sanitized and sanitized[0].isdigit():
        sanitized = '_' + sanitized
    return sanitized or '_model'


def parameter_to_pydantic_field(
    param: Parameter,
) -> tuple[type, Any]:
    """Map a Matimo Parameter to a (Python type, pydantic.Field) tuple.
    
    Args:
        param: A Matimo Parameter definition.
        
    Returns:
        A tuple of (Python type, pydantic.Field) for use in pydantic.create_model().
    """
    import pydantic

    type_map: dict[str, type] = {
        "string": str,
        "number": int | float,  # YAML 'number' covers both integers (port, limit) and floats
        "boolean": bool,
        "array": list,
        "object": dict,
    }
    py_type: type = type_map.get(param.type.value, Any)  # type: ignore[assignment]

    # Handle optional vs required
    default = param.default if param.default is not None else (
        pydantic.fields.PydanticUndefined if param.required else None
    )

    field_def = pydantic.Field(default=default, description=param.description or "")

    if not param.required:
        py_type = py_type | None  # type: ignore[assignment]

    return py_type, field_def
