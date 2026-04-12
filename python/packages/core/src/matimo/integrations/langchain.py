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


# ─── Skill injection helpers for non-MCP (direct) integrations ───────────────
#
# When Matimo is used directly (e.g., LangChain without an MCP server), skills
# are not surfaced via MCP Resources. These helpers provide a spec-compliant
# alternative that preserves the progressive disclosure model:
#
#   Level 1 — Discovery : get_skills_metadata()        → name + description only
#   Level 2 — Activation: build_relevant_skill_prompt() → semantic search → load matched content
#
# Mirrors: packages/core/src/integrations/langchain.ts (getSkillsMetadata / buildRelevantSkillPrompt)


def get_skills_metadata(matimo: Matimo) -> list[dict[str, str]]:
    """Return Level-1 metadata (name + description) for all available skills.

    Token-safe — only a few lines per skill. Include this in the system prompt
    so the agent knows what skills exist and can request them by name.

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
    """Build a per-request system-prompt snippet from semantically relevant skills.

    Uses TF-IDF semantic search to rank all skills against the user's query
    and loads full content only for the top matches. This preserves the
    progressive disclosure model without MCP:

      Level 1 at startup → Level 2 per-request (only relevant skills)

    Args:
        matimo:    Initialised Matimo instance.
        query:     The user's current message/query; drives semantic ranking.
        top_k:     Max skills to load (default 3); keeps token cost bounded.
        min_score: Minimum cosine similarity to include (default 0.3).
        header:    Custom header text (optional).

    Returns:
        Formatted string ready to inject as a context block, or empty string
        when no skills score above ``min_score``.

    Example::

        skill_context = await build_relevant_skill_prompt(matimo, user_message, top_k=2)
        messages = [
            SystemMessage(base_system_prompt),
            *([] if not skill_context else [SystemMessage(skill_context)]),
            HumanMessage(user_message),
        ]
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
        or "The following skills are relevant to the current request — apply their guidelines:"
    )
    return "\n\n".join([prompt_header, *blocks])
