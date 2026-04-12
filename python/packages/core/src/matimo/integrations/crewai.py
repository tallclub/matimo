"""
CrewAI integration — converts Matimo tools to CrewAI BaseTool subclasses.
Mirrors the LangChain pattern, adapted to CrewAI's BaseTool API.

Install with: pip install matimo[crewai]
"""
from __future__ import annotations

import asyncio
import concurrent.futures
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from matimo.core.models import ToolDefinition
    from matimo.instance import Matimo

# Shared thread pool executor for running async code in already-running event loops
_THREAD_EXECUTOR: concurrent.futures.ThreadPoolExecutor | None = None


def _get_executor() -> concurrent.futures.ThreadPoolExecutor:
    """Get or create the shared thread pool executor."""
    global _THREAD_EXECUTOR  # noqa: PLW0603
    if _THREAD_EXECUTOR is None:
        _THREAD_EXECUTOR = concurrent.futures.ThreadPoolExecutor(max_workers=1)
    return _THREAD_EXECUTOR


def convert_tools_to_crewai(
    tools: list[ToolDefinition],
    matimo: Matimo,
    credentials: dict[str, str] | None = None,
) -> list[Any]:
    """
    Convert a list of Matimo ToolDefinitions to CrewAI BaseTool objects.

    Args:
        tools:       List of Matimo ToolDefinition objects.
        matimo:      Matimo instance used to execute tools.
        credentials: Optional per-call credential overrides.

    Returns:
        List of CrewAI BaseTool instances.

    Raises:
        ImportError if crewai is not installed.
    """
    try:
        from crewai.tools import BaseTool  # type: ignore[import] # noqa: F401
    except ImportError as exc:
        raise ImportError(
            "crewai is required for CrewAI integration. "
            "Install with: pip install matimo[crewai]"
        ) from exc

    return [
        _make_crewai_tool(tool, matimo, credentials)
        for tool in tools
    ]


def _make_crewai_tool(
    tool_def: ToolDefinition,
    matimo: Matimo,
    credentials: dict[str, str] | None,
) -> Any:  # noqa: ANN401
    """Build a single CrewAI BaseTool subclass from a ToolDefinition.

    Returns Any because BaseTool is from an optional dependency (crewai).
    """
    import pydantic
    from crewai.tools import BaseTool  # type: ignore[import]

    from matimo.integrations._pydantic_utils import (
        is_secret_parameter,
        parameter_to_pydantic_field,
        sanitize_model_name,
    )

    # Build Pydantic args schema (excluding secrets)
    fields: dict[str, Any] = {}
    for param_name, param in (tool_def.parameters or {}).items():
        if is_secret_parameter(param_name):
            continue
        py_type, field_def = parameter_to_pydantic_field(param)
        fields[param_name] = (py_type, field_def)

    ArgsSchema: type[pydantic.BaseModel] = pydantic.create_model(  # noqa: N806
        f"{sanitize_model_name(tool_def.name)}_args",
        **fields,
    )

    class MatimoCrewTool(BaseTool):
        name: str = tool_def.name
        description: str = tool_def.description
        args_schema: type[pydantic.BaseModel] = ArgsSchema  # type: ignore[assignment]

        def _run(self, **kwargs: object) -> Any:  # noqa: ANN401
            """Synchronous execution — runs async execute in an event loop."""
            # Returns Any: must match CrewAI BaseTool._run signature; results are arbitrary.
            call_kwargs: dict[str, Any] = {}
            if credentials is not None:
                call_kwargs["credentials"] = credentials
            try:
                loop = asyncio.get_event_loop()
            except RuntimeError:
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)

            if loop.is_running():
                # If already in an event loop (e.g. Jupyter), run asyncio.run in a thread
                # to avoid "RuntimeError: asyncio.run() cannot be called from a running event loop"
                executor = _get_executor()
                future = executor.submit(
                    asyncio.run,
                    matimo.execute(tool_def.name, dict(kwargs), **call_kwargs),
                )
                return future.result()
            else:
                return loop.run_until_complete(
                    matimo.execute(tool_def.name, dict(kwargs), **call_kwargs)
                )

        async def _arun(self, **kwargs: object) -> Any:  # noqa: ANN401
            # Returns Any: must match CrewAI BaseTool._arun signature; results are arbitrary.
            call_kwargs: dict[str, Any] = {}
            if credentials is not None:
                call_kwargs["credentials"] = credentials
            return await matimo.execute(
                tool_def.name, dict(kwargs), **call_kwargs
            )

    # Give the dynamically-created class a unique name so CrewAI introspection works
    MatimoCrewTool.__name__ = f"MatimoTool_{tool_def.name}"
    MatimoCrewTool.__qualname__ = f"MatimoTool_{tool_def.name}"

    return MatimoCrewTool()
