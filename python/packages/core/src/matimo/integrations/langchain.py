"""
LangChain integration — converts Matimo tools to LangChain StructuredTools.
Mirrors: packages/core/src/integrations/langchain.ts

Lazy-imports langchain-core to avoid a hard dependency.
Install with: pip install matimo[langchain]
"""
from __future__ import annotations

import re
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from matimo.core.models import Parameter, ToolDefinition
    from matimo.instance import Matimo

# Patterns that identify a parameter as a secret (should be hidden from LLM schema)
_SECRET_RE = re.compile(
    r"(?:^|_)(TOKEN|KEY|SECRET|PASSWORD)(?:_|$)|"
    r"[a-z](Token|Key|Secret|Password)",
)


def is_secret_parameter(name: str) -> bool:
    """Return True if the parameter name looks like a credential."""
    return bool(_SECRET_RE.search(name))


def convert_tools_to_langchain(
    tools: list[ToolDefinition],
    matimo: Matimo,
    credentials: dict[str, str] | None = None,
) -> list[Any]:
    """
    Convert a list of Matimo ToolDefinitions to LangChain StructuredTool objects.

    Secret parameters (token, key, secret, password) are excluded from the
    LangChain schema so the LLM never sees them — they are injected at call time
    from the credentials dict or environment.

    Args:
        tools:       List of Matimo ToolDefinition objects.
        matimo:      Matimo instance used to execute tools.
        credentials: Optional per-call credential overrides.

    Returns:
        List of LangChain StructuredTool instances.

    Raises:
        ImportError if langchain-core is not installed.
    """
    try:
        from langchain_core.tools import StructuredTool  # type: ignore[import] # noqa: F401
    except ImportError as exc:
        raise ImportError(
            "langchain-core is required for LangChain integration. "
            "Install with: pip install matimo[langchain]"
        ) from exc

    lc_tools: list[Any] = []
    for tool in tools:
        lc_tool = _make_langchain_tool(tool, matimo, credentials)
        lc_tools.append(lc_tool)
    return lc_tools


def _make_langchain_tool(
    tool: ToolDefinition,
    matimo: Matimo,
    credentials: dict[str, str] | None,
) -> Any:  # noqa: ANN401
    """Build a single LangChain StructuredTool from a ToolDefinition.

    Returns Any because StructuredTool is from an optional dependency (langchain-core).
    """
    import pydantic
    from langchain_core.tools import StructuredTool  # type: ignore[import]

    # Build a Pydantic model for the tool's non-secret parameters
    fields: dict[str, Any] = {}
    for param_name, param in (tool.parameters or {}).items():
        if is_secret_parameter(param_name):
            continue
        py_type, field_def = _parameter_to_pydantic_field(param)
        fields[param_name] = (py_type, field_def)

    # Dynamically create a Pydantic model class
    ArgsModel = pydantic.create_model(  # noqa: N806
        f"{tool.name}_args",
        **fields,
    )

    async def _invoke(**kwargs: object) -> Any:  # noqa: ANN401
        # Returns Any: tool execution results are arbitrary JSON/values.
        return await matimo.execute(tool.name, dict(kwargs), credentials=credentials)

    return StructuredTool(
        name=tool.name,
        description=tool.description,
        args_schema=ArgsModel,
        coroutine=_invoke,
    )


def _parameter_to_pydantic_field(
    param: Parameter,
) -> tuple[type, Any]:
    """Map a Matimo Parameter to a (Python type, pydantic.Field) tuple."""
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
