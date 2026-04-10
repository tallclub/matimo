"""
LangChain integration — converts Matimo tools to LangChain StructuredTools.
Mirrors: packages/core/src/integrations/langchain.ts

Lazy-imports langchain-core to avoid a hard dependency.
Install with: pip install matimo[langchain]
"""
from __future__ import annotations

from typing import TYPE_CHECKING, Any

from matimo.integrations._pydantic_utils import is_secret_parameter, parameter_to_pydantic_field, sanitize_model_name

if TYPE_CHECKING:
    from matimo.core.models import ToolDefinition
    from matimo.instance import Matimo


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
        py_type, field_def = parameter_to_pydantic_field(param)
        fields[param_name] = (py_type, field_def)

    # Dynamically create a Pydantic model class
    # Sanitize tool name to ensure it's a valid Python identifier
    safe_model_name = sanitize_model_name(tool.name)
    ArgsModel = pydantic.create_model(  # noqa: N806
        f"{safe_model_name}_args",
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
