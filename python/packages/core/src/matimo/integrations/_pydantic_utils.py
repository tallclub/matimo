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
    sanitized = re.sub(r"[^a-zA-Z0-9_]", "_", tool_name)
    # Ensure it doesn't start with a digit (prepend _ if it does)
    if sanitized and sanitized[0].isdigit():
        sanitized = "_" + sanitized
    return sanitized or "_model"


def _resolve_python_type(param: Parameter) -> Any:  # noqa: ANN401
    """Resolve the plain Python type for a parameter, ignoring Field metadata.

    Recurses into `param.items` for arrays so pydantic emits a concrete
    `items` schema (e.g. `list[str]`) instead of bare `list`/`list[Any]`.
    A bare list renders as JSON-schema `{"type": "array", "items": {}}` —
    an `items` entry with no 'type' key, which OpenAI's function-calling
    schema validator rejects (most visibly once an optional array field's
    schema is wrapped in `anyOf`). Undeclared item types default to `str`,
    matching the overwhelming majority of array params in this codebase.
    """
    if param.type.value == "array":
        item_type = _resolve_python_type(param.items) if param.items is not None else str
        return list[item_type]  # type: ignore[valid-type]

    type_map: dict[str, Any] = {
        "string": str,
        "number": int | float,  # YAML 'number' covers both integers (port, limit) and floats
        "boolean": bool,
        "object": dict,
    }
    return type_map.get(param.type.value, Any)


def parameter_to_pydantic_field(
    param: Parameter,
) -> tuple[Any, Any]:
    """Map a Matimo Parameter to a (Python type, pydantic.Field) tuple.

    Args:
        param: A Matimo Parameter definition.

    Returns:
        A tuple of (Python type, pydantic.Field) for use in pydantic.create_model().
    """
    import pydantic
    from pydantic_core import PydanticUndefined

    py_type: Any = _resolve_python_type(param)

    # Handle optional vs required
    default = param.default if param.default is not None else (PydanticUndefined if param.required else None)

    field_def = pydantic.Field(default=default, description=param.description or "")

    if not param.required:
        py_type = py_type | None

    return py_type, field_def
