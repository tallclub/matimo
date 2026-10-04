"""
Agno integration: exposes governed Matimo tools to Agno agents, teams and workflows.

Mirrors the LangChain and CrewAI integrations, adapted to Agno's `Function` and
`Toolkit` API. Two entry points:

* :func:`MatimoTools`: an Agno ``Toolkit``, named to match Agno's own
  ``<Name>Tools`` convention so it drops into ``Agent(tools=[...])`` alongside
  ``SlackTools()`` or ``YFinanceTools()``.
* :func:`convert_tools_to_agno`: the lower-level call returning a list of Agno
  ``Function`` objects, matching ``convert_tools_to_langchain`` /
  ``convert_tools_to_crewai``.

Every call still routes through ``Matimo.execute()``, so the policy engine, HITL
quarantine and audit events apply exactly as they do everywhere else. On top of
that, Matimo's per-call approval is mapped onto Agno's own human-in-the-loop
flag: a tool arrives with ``requires_confirmation=True`` when its definition
needs approval on every call (``requires_approval``, or an HTTP DELETE or
command tool in secure mode) or its execution risk is ``high`` or ``critical``.
The Agno run pauses for the human, and a call they confirm reaches Matimo as
already approved, so they are not asked twice. A call Agno does not confirm
(for example one whose SQL contains a destructive keyword) is still decided by
Matimo's ``on_approval`` callback.

Lazy-imports agno to avoid a hard dependency.
Install with: pip install matimo[agno]
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from matimo.approval.handler import definition_requires_approval
from matimo.integrations._async_bridge import run_coroutine_sync
from matimo.integrations._pydantic_utils import is_secret_parameter
from matimo.policy.risk_classifier import classify_execution_risk
from matimo.policy.types import RiskLevel

if TYPE_CHECKING:
    from collections.abc import Sequence

    from matimo.core.models import Parameter, PolicyContext, ToolDefinition
    from matimo.instance import Matimo

# Risk levels that get Agno's `requires_confirmation=True` by default. Mirrors the
# policy engine's own stance: `low` runs freely, `medium` is a write that most
# callers accept, `high`/`critical` are destructive or arbitrary-execution tools.
DEFAULT_CONFIRM_RISK_LEVELS: tuple[RiskLevel, ...] = (RiskLevel.HIGH, RiskLevel.CRITICAL)

# Parameters Agno injects itself, based on the entrypoint signature. Our entrypoints
# take **kwargs, so Agno should never inject these, but drop them defensively so a
# framework object can never be forwarded to Matimo as a tool parameter.
_AGNO_RESERVED_PARAMS = frozenset(
    {"run_context", "agent", "team", "images", "videos", "audios", "files"}
)


def _import_agno_function() -> Any:  # noqa: ANN401 (agno is an optional dependency)
    """Import Agno's `Function` class, with an actionable error when agno is missing."""
    try:
        from agno.tools.function import Function
    except ImportError as exc:
        raise ImportError(
            "agno is required for the Agno integration. Install with: pip install matimo[agno]"
        ) from exc
    return Function


def _import_agno_toolkit() -> Any:  # noqa: ANN401 (agno is an optional dependency)
    """Import Agno's `Toolkit` class, with an actionable error when agno is missing."""
    try:
        from agno.tools.toolkit import Toolkit
    except ImportError as exc:
        raise ImportError(
            "agno is required for the Agno integration. Install with: pip install matimo[agno]"
        ) from exc
    return Toolkit


def _parameter_to_json_schema(param: Parameter) -> dict[str, Any]:
    """
    Map a Matimo `Parameter` onto a JSON Schema fragment.

    Agno's `Function` takes an explicit `parameters` schema, so unlike the
    LangChain and CrewAI integrations there is no Pydantic model :
    the YAML definition is translated straight to JSON Schema.

    Array items and object properties recurse. An array with no declared item
    type defaults to `string`, matching `_pydantic_utils._resolve_python_type`:
    an empty `items` object is rejected by OpenAI's function-schema validator.
    """
    schema: dict[str, Any] = {"type": param.type.value}

    if param.description:
        schema["description"] = param.description
    if param.enum:
        schema["enum"] = list(param.enum)
    if param.default is not None:
        schema["default"] = param.default

    if param.type.value == "array":
        schema["items"] = (
            _parameter_to_json_schema(param.items) if param.items is not None else {"type": "string"}
        )
    elif param.type.value == "object" and param.properties:
        schema["properties"] = {
            name: _parameter_to_json_schema(prop) for name, prop in param.properties.items()
        }

    return schema


def _build_parameters_schema(tool: ToolDefinition) -> dict[str, Any]:
    """
    Build the JSON Schema Agno sends to the model for one tool.

    Secret-looking parameters are omitted so the model never sees a credential;
    they are injected at execution time from `credentials` or the environment,
    the same way the LangChain and CrewAI integrations handle them.
    """
    properties: dict[str, Any] = {}
    required: list[str] = []

    for name, param in (tool.parameters or {}).items():
        if is_secret_parameter(name):
            continue
        properties[name] = _parameter_to_json_schema(param)
        if param.required:
            required.append(name)

    schema: dict[str, Any] = {"type": "object", "properties": properties}
    if required:
        schema["required"] = required
    return schema


def _resolve_confirm_levels(
    confirm_risk_levels: Sequence[RiskLevel | str] | None,
) -> frozenset[RiskLevel]:
    """Normalise the caller's risk-level selection into a set of `RiskLevel`."""
    if confirm_risk_levels is None:
        return frozenset(DEFAULT_CONFIRM_RISK_LEVELS)
    return frozenset(RiskLevel(level) for level in confirm_risk_levels)


def _strip_reserved(kwargs: dict[str, Any]) -> dict[str, Any]:
    """Drop Agno-injected framework parameters before handing args to Matimo."""
    return {key: value for key, value in kwargs.items() if key not in _AGNO_RESERVED_PARAMS}


def _make_sync_entrypoint(
    tool: ToolDefinition,
    matimo: Matimo,
    credentials: dict[str, str] | None,
    context: PolicyContext | None,
    approved: bool,
) -> Any:  # noqa: ANN401 (tool args and results are arbitrary JSON)
    """
    Build the sync entrypoint Agno uses for `agent.run()` / `print_response()`.

    Safe in both worlds: `run_coroutine_sync` offloads to a worker thread when a
    loop is already running, so a `Function` carrying only this entrypoint still
    works under `arun()`, just with an extra thread hop.

    `MatimoError` from a policy denial propagates unchanged, matching how the
    LangChain (Python) and CrewAI integrations behave.

    `approved` is True for a tool built with `requires_confirmation=True`: Agno
    only calls it after the human confirmed the paused call, so Matimo skips its
    own approval prompt. Policy checks and HITL quarantine still run.
    """
    tool_name = tool.name

    def call(**kwargs: Any) -> Any:  # noqa: ANN401 (see above)
        return run_coroutine_sync(
            matimo.execute(
                tool_name,
                _strip_reserved(kwargs),
                credentials=credentials,
                context=context,
                approved=approved,
            )
        )

    # Agno surfaces the entrypoint's __name__ in logs and traces.
    call.__name__ = tool_name
    return call


def _make_async_entrypoint(
    tool: ToolDefinition,
    matimo: Matimo,
    credentials: dict[str, str] | None,
    context: PolicyContext | None,
    approved: bool,
) -> Any:  # noqa: ANN401 (see _make_sync_entrypoint)
    """
    Build the async entrypoint Agno uses for `agent.arun()` / `aprint_response()`.

    Reaches Matimo's async `execute()` directly, with no thread hop.
    """
    tool_name = tool.name

    async def acall(**kwargs: Any) -> Any:  # noqa: ANN401 (see above)
        return await matimo.execute(
            tool_name,
            _strip_reserved(kwargs),
            credentials=credentials,
            context=context,
            approved=approved,
        )

    acall.__name__ = f"a{tool_name}"
    return acall


def _needs_confirmation(
    tool: ToolDefinition, matimo: Matimo, confirm_levels: frozenset[RiskLevel]
) -> bool:
    """
    Whether Agno should pause for the human before this tool runs.

    With Agno-side confirmation on (a non-empty `confirm_levels`), that is every
    tool Matimo's definition makes ask on every call, plus every tool whose
    execution risk is in `confirm_levels`. An empty set turns it off, leaving
    each call to Matimo's own `on_approval` callback.
    """
    if not confirm_levels:
        return False
    if definition_requires_approval(tool, matimo.get_governance_mode()):
        return True
    return classify_execution_risk(tool) in confirm_levels


def _build_function(
    function_cls: Any,  # noqa: ANN401 (agno's Function, an optional dependency)
    tool: ToolDefinition,
    entrypoint: Any,  # noqa: ANN401 (a closure over matimo.execute)
    requires_confirmation: bool,
) -> Any:  # noqa: ANN401 (returns agno's Function)
    """
    Wrap one Matimo tool as an Agno `Function`.

    `strict` is deliberately left unset: Agno rewrites the schema's `required`
    list when strict=True, which would make every optional Matimo parameter
    mandatory.
    """
    return function_cls(
        name=tool.name,
        description=tool.description,
        parameters=_build_parameters_schema(tool),
        entrypoint=entrypoint,
        requires_confirmation=requires_confirmation,
    )


def convert_tools_to_agno(
    tools: list[ToolDefinition],
    matimo: Matimo,
    credentials: dict[str, str] | None = None,
    *,
    context: PolicyContext | None = None,
    confirm_risk_levels: Sequence[RiskLevel | str] | None = None,
) -> list[Any]:
    """
    Convert Matimo tool definitions into Agno `Function` objects.

    Args:
        tools:               Matimo tool definitions, e.g. from `matimo.list_tools()`.
        matimo:              Async `Matimo` instance used to execute the tools.
        credentials:         Optional per-call credential overrides, keyed by the
                             placeholder names the YAML references (e.g.
                             `SLACK_BOT_TOKEN`), not by tool parameter name.
        context:             Optional `PolicyContext` (agent id, environment, roles)
                             forwarded to the policy engine on every call.
        confirm_risk_levels: Execution risk levels that get
                             `requires_confirmation=True`, on top of every tool
                             whose definition needs approval on each call.
                             Defaults to `("high", "critical")`. Pass an empty
                             sequence to disable Agno-side confirmation entirely
                             and let Matimo's `on_approval` callback decide.

    Returns:
        A list of Agno `Function` objects, ready for `Agent(tools=[...])`.

    Raises:
        ImportError: if agno is not installed.
    """
    function_cls = _import_agno_function()
    confirm_levels = _resolve_confirm_levels(confirm_risk_levels)

    functions: list[Any] = []
    for tool in tools:
        confirm = _needs_confirmation(tool, matimo, confirm_levels)
        functions.append(
            _build_function(
                function_cls,
                tool,
                _make_sync_entrypoint(tool, matimo, credentials, context, confirm),
                confirm,
            )
        )
    return functions


def MatimoTools(  # noqa: N802 (matches Agno's <Name>Tools toolkit convention)
    matimo: Matimo,
    tools: list[ToolDefinition] | None = None,
    *,
    credentials: dict[str, str] | None = None,
    context: PolicyContext | None = None,
    confirm_risk_levels: Sequence[RiskLevel | str] | None = None,
    name: str = "matimo_tools",
    instructions: str | None = None,
    add_instructions: bool = True,
    **toolkit_kwargs: Any,  # noqa: ANN401 (forwarded verbatim to Agno's Toolkit)
) -> Any:  # noqa: ANN401 (Toolkit comes from an optional dependency)
    """
    Build an Agno `Toolkit` exposing governed Matimo tools.

    Named in CapWords to match Agno's `<Name>Tools` convention, so it reads like
    any other toolkit at the call site::

        from matimo import Matimo
        from matimo.integrations.agno import MatimoTools

        m = await Matimo.init(auto_discover=True)
        agent = Agent(model=OpenAIChat(id="gpt-5.4"), tools=[MatimoTools(m)])

    It is a factory function rather than a class so that importing this module
    does not require agno to be installed.

    Both a sync and an async entrypoint are registered for each tool, so
    `agent.run()` and `agent.arun()` are each served natively. `arun()` reaches
    Matimo's async `execute()` directly, with no thread hop.

    Args:
        matimo:              Async `Matimo` instance used to execute the tools.
        tools:               Tool definitions to expose. Defaults to
                             `matimo.list_tools()`. Pass
                             `matimo.get_tools_for_agent(context)` instead to
                             advertise only tools that need no approval. Note
                             that excludes quarantined tools, which are otherwise
                             usable once approved.
        credentials:         Optional per-call credential overrides, keyed by the
                             placeholder names the YAML references.
        context:             Optional `PolicyContext` forwarded on every call.
        confirm_risk_levels: Execution risk levels that pause the run for
                             confirmation, on top of every tool whose definition
                             needs approval on each call. Defaults to
                             `("high", "critical")`; empty disables it.
        name:                Toolkit name shown in Agno logs.
        instructions:        Optional usage guidance added to the agent's context.
                             A natural source is Matimo's skills layer, e.g.
                             `matimo.get_skill_content("slack")`.
        add_instructions:    Whether to add `instructions` to the agent context.
        **toolkit_kwargs:    Forwarded to Agno's `Toolkit` (e.g. `include_tools`,
                             `exclude_tools`, `cache_results`).

    Returns:
        An Agno `Toolkit` instance.

    Raises:
        ImportError: if agno is not installed.
    """
    toolkit_cls = _import_agno_toolkit()
    function_cls = _import_agno_function()
    confirm_levels = _resolve_confirm_levels(confirm_risk_levels)

    tool_defs = matimo.list_tools() if tools is None else tools

    # Two Function objects per tool: one sync, one async. Agno routes them by
    # coroutine detection, so the sync one lands in `Toolkit.functions` (used by
    # `agent.run()`) and the async one in `Toolkit.async_functions` (used by
    # `agent.arun()`), each keeping the explicit schema built above.
    #
    # Registering the async variant through Agno's `async_tools=[(callable, name)]`
    # parameter instead would lose the schema: Agno derives one from the callable's
    # signature, and these entrypoints take **kwargs, which yields an empty
    # parameter list. The model would then be told the tool takes no arguments.
    functions: list[Any] = []
    for tool in tool_defs:
        confirm = _needs_confirmation(tool, matimo, confirm_levels)
        functions.append(
            _build_function(
                function_cls,
                tool,
                _make_sync_entrypoint(tool, matimo, credentials, context, confirm),
                confirm,
            )
        )
        functions.append(
            _build_function(
                function_cls,
                tool,
                _make_async_entrypoint(tool, matimo, credentials, context, confirm),
                confirm,
            )
        )

    return toolkit_cls(
        name=name,
        tools=functions,
        instructions=instructions,
        add_instructions=add_instructions,
        **toolkit_kwargs,
    )
