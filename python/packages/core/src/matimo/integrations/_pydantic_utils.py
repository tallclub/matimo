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
_SECRET_RE = re.compile(
    r"(?:^|_)(TOKEN|KEY|SECRET|PASSWORD)(?:_|$)|"
    r"[a-z](Token|Key|Secret|Password)",
)


def is_secret_parameter(name: str) -> bool:
    """Return True if the parameter name looks like a credential."""
    return bool(_SECRET_RE.search(name))


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
