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


# ─── Skill injection helpers for non-MCP (direct) integrations ───────────────
#
# When Matimo is used directly (e.g., CrewAI without an MCP server), skills
# are not surfaced via MCP Resources. These helpers provide a spec-compliant
# alternative that preserves the progressive disclosure model:
#
#   Level 1 — Discovery : get_skills_metadata()        → name + description only
#   Level 2 — Activation: build_relevant_skill_prompt() → semantic search → load matched content
#
# Mirrors: matimo/integrations/langchain.py (get_skills_metadata / build_relevant_skill_prompt).
# Duplicated here (rather than re-exported) so CrewAI-only integrators don't pull in
# langchain-core just to use these two functions.


def get_skills_metadata(matimo: Matimo) -> list[dict[str, str]]:
    """Return Level-1 metadata (name + description) for all available skills.

    Token-safe — only a few lines per skill. Include this in an agent's backstory
    or task description so it knows what skills exist and can request them by name.

    Args:
        matimo: Initialised Matimo instance.

    Returns:
        List of ``{"name": ..., "description": ...}`` dicts.

    Example::

        meta = get_skills_metadata(matimo)
        # → [{"name": "code-review", "description": "Code review checklist"}, ...]
    """
    return [
        {"name": s.name, "description": s.description or ""}
        for s in matimo.list_skills()
    ]


async def build_relevant_skill_prompt(
    matimo: Matimo,
    query: str,
    *,
    top_k: int = 3,
    min_score: float = 0.3,
    header: str | None = None,
) -> str:
    """Build a backstory/task-injectable snippet from semantically relevant skills.

    Uses TF-IDF semantic search to rank all skills against the given query
    and loads full content only for the top matches. This preserves the
    progressive disclosure model without MCP:

      Level 1 at startup → Level 2 per-request (only relevant skills)

    Args:
        matimo:    Initialised Matimo instance.
        query:     The agent's current task/goal; drives semantic ranking.
        top_k:     Max skills to load (default 3); keeps token cost bounded.
        min_score: Minimum cosine similarity to include (default 0.3).
        header:    Custom header text (optional).

    Returns:
        Formatted string ready to inject into a CrewAI `Agent.backstory` or
        `Task.description`, or empty string when no skills score above `min_score`.

    Example::

        skill_context = await build_relevant_skill_prompt(matimo, task_description, top_k=2)
        agent = Agent(
            role="Slack Community Manager",
            goal="...",
            backstory=f"{base_backstory}\\n\\n{skill_context}",
            tools=crewai_tools,
        )
    """
    search_results = await matimo.semantic_search_skills(
        query, limit=top_k, min_score=min_score
    )
    if not search_results:
        return ""

    blocks: list[str] = []
    for r in search_results:
        content = matimo.get_skill_content(r.skill.name)
        if content:
            desc = f"_{r.skill.description}_\n\n" if r.skill.description else ""
            blocks.append(
                f"## Skill: {r.skill.name} (relevance: {r.score:.2f})\n{desc}{content}"
            )

    if not blocks:
        return ""

    prompt_header = (
        header
        or "The following skills are relevant to the current task — apply their guidelines:"
    )
    return "\n\n".join([prompt_header, *blocks])
