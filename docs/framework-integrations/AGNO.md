# Agno Integration

Matimo integrates with **[Agno](https://docs.agno.com)** for agents, teams and workflows. Convert any Matimo tool to an Agno `Function`, or hand an agent a whole governed toolkit with one call.

The difference from a plain tool list: Agno keeps deciding *which* tool to call, and Matimo keeps deciding *whether* it may run. A tool that Matimo would ask a human about arrives in Agno with `requires_confirmation` already set, so the run pauses for a human without you writing any policy code, and the human's answer is the approval: Matimo does not ask again.

- [Installation](#installation)
- [Basic Setup](#basic-setup)
- [Risk to Confirmation Mapping](#risk-to-confirmation-mapping)
- [Single Agent Example](#single-agent-example)
- [Confirmation Flow](#confirmation-flow)
- [API Reference](#api-reference)
- [Secret Handling](#secret-handling)
- [Skills Integration](#skills-integration)
- [Error Handling](#error-handling)
- [Advanced Patterns](#advanced-patterns)
- [Non-Python Runtimes](#non-python-runtimes)
- [Troubleshooting](#troubleshooting)
- [Working Examples](#working-examples)

> Agno is a Python SDK, so this integration is Python only. There is no Agno TypeScript SDK to target. If you need governed Matimo tools from a non-Python runtime, see [Non-Python Runtimes](#non-python-runtimes).

---

## Installation

### Requirements

- Python 3.11+
- Agno >= 3.0
- Matimo >= 0.2.0 (the Agno integration is new in 0.2.0)

### Install

```bash
# Install matimo with Agno support
pip install "matimo[agno]" matimo-slack
# or with uv
uv add "matimo[agno]" matimo-slack

# Install Agno plus a model provider
pip install agno openai
```

---

## Basic Setup

```python
import asyncio

from agno.agent import Agent
from agno.models.openai import OpenAIChat

from matimo import Matimo
from matimo.integrations.agno import MatimoTools


async def setup():
    # 1. Initialize Matimo. The policy engine is active from here on.
    matimo = await Matimo.init(auto_discover=True)

    # 2. Filter to the tools this agent should see.
    slack_tools = [t for t in matimo.list_tools() if t.name.startswith("slack")]

    # 3. Hand them to Agno as a toolkit.
    agent = Agent(
        model=OpenAIChat(id="gpt-5.4"),
        tools=[MatimoTools(matimo, slack_tools)],
    )

    await agent.aprint_response("Post a hello message to the first public channel")


asyncio.run(setup())
```

`MatimoTools` is named to match Agno's own `<Name>Tools` convention, so it sits alongside `SlackTools()` or `YFinanceTools()` in the `tools=[...]` list.

---

## Risk to Confirmation Mapping

A tool arrives in Agno with `requires_confirmation=True` when either of these holds:

1. **Its definition needs approval on every call:** it declares `requires_approval: true`, or it is an HTTP `DELETE` or `type: command` tool without `requires_approval: false` (the 0.2.0 default in `secure` governance mode; `legacy` mode has no such default).
2. **Its execution risk is in `confirm_risk_levels`** (default `high` and `critical`), as computed by `classify_execution_risk()`:

| Execution risk | How it is reached | Agno behavior by default |
|---|---|---|
| `low` | HTTP GET, or a function tool declaring `risk: low` | Runs immediately |
| `medium` | HTTP POST, PUT, PATCH, or a function tool declaring `risk: medium` | Runs immediately |
| `high` | HTTP DELETE, an HTTP tool with `requires_approval: true`, `type: command`, a function tool declaring `risk: high` or no `risk:`, or a function tool with `requires_approval: true` | `requires_confirmation=True`, run pauses |
| `critical` | A tool declaring `risk: critical` | `requires_confirmation=True`, run pauses |

A declared `risk:` can only raise the level computed for HTTP and command tools, never lower it. For a `type: function` tool the declared risk is the execution risk, because every function tool in the registry is developer-authored.

A call the human confirms in Agno reaches `Matimo.execute()` with `approved=True`, so Matimo's own approval prompt is skipped. The policy engine and HITL quarantine still run. A call that pauses nothing in Agno but still needs Matimo's approval (for example a `postgres-execute-sql` call whose SQL contains `DELETE`) goes to the `on_approval` callback passed to `Matimo.init()`; with no callback it is rejected.

Change the set with `confirm_risk_levels`:

```python
# Also pause on writes
MatimoTools(matimo, tools, confirm_risk_levels=["medium", "high", "critical"])

# Never pause in Agno; every approval goes to Matimo's on_approval callback instead
MatimoTools(matimo, tools, confirm_risk_levels=[])
```

---

## Single Agent Example

A stock desk agent with one read tool and one write tool:

```python
import asyncio
import os

from agno.agent import Agent
from agno.models.openai import OpenAIChat

from matimo import Matimo
from matimo.integrations.agno import MatimoTools


async def run(task: str) -> None:
    matimo = await Matimo.init("./tools", log_level="silent")
    toolkit = MatimoTools(matimo, matimo.list_tools(), name="stock_tools")

    agent = Agent(
        model=OpenAIChat(id=os.environ["OPENAI_MODEL"]),
        tools=[toolkit],
        instructions="You are a stock market assistant. Report concrete numbers.",
    )

    result = await agent.arun(task)
    print(result.content)


asyncio.run(run("What is the latest quote for AAPL?"))
```

---

## Confirmation Flow

When the model calls a tool that needs confirmation, the run pauses instead of executing. Resolve the requirement, then continue:

```python
result = await agent.arun("Buy 5 shares of AAPL")

if result.is_paused:
    for requirement in result.active_requirements:
        if requirement.needs_confirmation:
            call = requirement.tool_execution
            print(f"Approve {call.tool_name}({call.tool_args})?")
            if input("[y/N] ").strip().lower() == "y":
                requirement.confirm()
            else:
                requirement.reject()

    result = await agent.acontinue_run(run_response=result)

print(result.content)
```

A rejected requirement means the tool never executes, and Matimo never sees the call. A confirmed one runs as approved, so the human is asked once.

---

## API Reference

### MatimoTools

```python
MatimoTools(
    matimo: Matimo,
    tools: list[ToolDefinition] | None = None,
    *,
    credentials: dict[str, str] | None = None,
    context: PolicyContext | None = None,
    confirm_risk_levels: Sequence[RiskLevel | str] | None = None,
    name: str = "matimo_tools",
    instructions: str | None = None,
    add_instructions: bool = True,
    **toolkit_kwargs,
) -> Toolkit
```

| Parameter | Type | Description |
|---|---|---|
| `matimo` | `Matimo` | Async instance used to execute the tools |
| `tools` | `list[ToolDefinition] \| None` | Tools to expose. Defaults to `matimo.list_tools()` |
| `credentials` | `dict[str, str] \| None` | Per-call credential overrides, keyed by the placeholder names the YAML references (for example `SLACK_BOT_TOKEN`), not by tool parameter name |
| `context` | `PolicyContext \| None` | Agent id, environment and roles, forwarded to the policy engine on every call |
| `confirm_risk_levels` | `Sequence[RiskLevel \| str] \| None` | Execution risk levels that pause the run, on top of tools whose definition needs approval on every call. Defaults to `("high", "critical")`; empty disables Agno-side confirmation |
| `name` | `str` | Toolkit name shown in Agno logs |
| `instructions` | `str \| None` | Usage guidance added to the agent's context |
| `add_instructions` | `bool` | Whether to add `instructions` to the agent context |
| `**toolkit_kwargs` | | Forwarded to Agno's `Toolkit`, for example `include_tools`, `exclude_tools`, `cache_results` |

**Returns:** an Agno `Toolkit` with both a sync and an async variant of each tool registered, so `agent.run()` and `agent.arun()` are each served natively.

**Raises:** `ImportError` if agno is not installed.

### convert_tools_to_agno

```python
convert_tools_to_agno(
    tools: list[ToolDefinition],
    matimo: Matimo,
    credentials: dict[str, str] | None = None,
    *,
    context: PolicyContext | None = None,
    confirm_risk_levels: Sequence[RiskLevel | str] | None = None,
) -> list[Function]
```

The lower-level call, matching `convert_tools_to_langchain` and `convert_tools_to_crewai`. Returns a list of Agno `Function` objects for `Agent(tools=[...])`.

**Raises:** `ImportError` if agno is not installed.

Both are also importable from the top level:

```python
from matimo import MatimoTools, convert_tools_to_agno
```

---

## Secret Handling

Secret parameters are excluded from the schema sent to the model, so the LLM never sees a credential. A parameter counts as a secret when its name contains `TOKEN`, `KEY`, `SECRET` or `PASSWORD`, case insensitive. Values are injected at execution time from the `credentials` argument or the environment.

```python
# The model sees only `channel` and `text`; SLACK_BOT_TOKEN is injected at call time.
MatimoTools(matimo, slack_tools, credentials={"SLACK_BOT_TOKEN": os.environ["SLACK_BOT_TOKEN"]})
```

---

## Skills Integration

Matimo skills are domain knowledge, separate from tools. Pass a skill's content as the toolkit's instructions so the agent gets it as context:

```python
toolkit = MatimoTools(
    matimo,
    slack_tools,
    instructions=matimo.get_skill_content("slack"),
)
```

For token-efficient loading, rank skills against the current request first and inline only what matches:

```python
from matimo import build_relevant_skill_prompt

guidance = await build_relevant_skill_prompt(matimo, user_message, top_k=2)
toolkit = MatimoTools(matimo, tools, instructions=guidance)
```

See [Skills System](../skills/SKILLS.md) for the progressive disclosure model.

---

## Error Handling

Tool errors propagate as `MatimoError`, which carries a machine-readable code:

```python
from matimo.errors import ErrorCode, MatimoError

try:
    result = await agent.arun("Delete the production database")
except MatimoError as exc:
    if exc.code is ErrorCode.POLICY_DENIED:
        print(f"Blocked by policy: {exc}")
    elif exc.code is ErrorCode.TOOL_NOT_FOUND:
        print(f"No such tool: {exc.details.get('tool_name')}")
    else:
        raise
```

`ErrorCode.POLICY_DENIED` covers both an outright policy denial and a quarantined tool whose Matimo-side HITL approval was refused or timed out.

---

## Advanced Patterns

### Pattern 1: Role-based access with PolicyContext

The same toolkit behaves differently per caller. In production, a tool declaring `requires_approval: true` is denied unless the caller holds the `admin` or `operator` role:

```python
from matimo.core.models import PolicyContext

analyst = PolicyContext(agent_id="desk-bot", environment="production", roles=["analyst"])
operator = PolicyContext(agent_id="desk-bot", environment="production", roles=["operator"])

read_only_agent = Agent(model=model, tools=[MatimoTools(matimo, tools, context=analyst)])
trading_agent = Agent(model=model, tools=[MatimoTools(matimo, tools, context=operator)])
```

### Pattern 2: Choosing which tools to advertise

```python
# Everything, including tools that will pause for approval
MatimoTools(matimo, matimo.list_tools())

# Only tools that need no approval for this caller.
# Note this also excludes quarantined tools, which are usable once approved.
MatimoTools(matimo, matimo.get_tools_for_agent(context))
```

### Pattern 3: Staying under a model's tool limit

OpenAI accepts at most 128 tools per request. With `auto_discover=True` across many providers you can exceed that, so filter first:

```python
allowed_prefixes = ("slack_", "github_", "read", "search", "web")
tools = [t for t in matimo.list_tools() if t.name.startswith(allowed_prefixes)][:128]
MatimoTools(matimo, tools)
```

---

## Non-Python Runtimes

Agno is a Python SDK, so there is no TypeScript connector. Agno does consume Model Context Protocol servers, and Matimo ships one, so the same governed tools reach an Agno agent over MCP:

```bash
# Start Matimo's MCP server
matimo mcp                                  # stdio
matimo mcp --transport http --port 3000     # HTTP
```

```python
from agno.agent import Agent
from agno.tools.mcp import MCPTools

async with MCPTools(command="matimo mcp") as matimo_mcp:
    agent = Agent(model=model, tools=[matimo_mcp])
    await agent.aprint_response("List the available Slack channels")
```

The policy engine still gates every call, since the MCP server executes through the same `Matimo.execute()` path. The tradeoff versus the native connector is an extra process hop and no direct access to `PolicyContext` per call. Prefer `MatimoTools` when your agent is Python.

See [MCP Server](../MCP.md) for transports and client configuration.

---

## Troubleshooting

**`ImportError: agno is required for the Agno integration`:** install the extra with `pip install "matimo[agno]"`.

**The run never pauses on a destructive tool:** check the tool's execution risk and whether its definition needs approval. Only `high` and `critical` pause by default, and HTTP POST classifies as `medium`. Declare `requires_approval: true` or `risk: high` in the YAML, or pass `confirm_risk_levels=["medium", "high", "critical"]`.

```python
from matimo import classify_execution_risk, definition_requires_approval

tool = matimo.get_tool("my_tool")
print(classify_execution_risk(tool).value, definition_requires_approval(tool))
```

**`Destructive operation requires approval` after the run was not paused:** the call needed Matimo's approval for a reason Agno could not see in advance, such as a destructive keyword in its SQL or command. Pass `on_approval=` to `Matimo.init()`, or pre-approve the tool with `MATIMO_APPROVED_PATTERNS`.

**The model says a tool takes no arguments:** do not register Matimo tools through Agno's `async_tools=[(callable, name)]` parameter. Agno derives a schema from the callable's signature, and these entrypoints take `**kwargs`, which yields an empty parameter list. `MatimoTools` handles this correctly.

**`400 Function tools with reasoning_effort are not supported ... in /v1/chat/completions`:** the model is a reasoning model, and Agno's `OpenAIChat` posts to `/v1/chat/completions`. Use `OpenAIResponses`, which posts to `/v1/responses`:

```python
from agno.models.openai import OpenAIResponses

agent = Agent(model=OpenAIResponses(id="gpt-5.6"), tools=[MatimoTools(matimo)])
```

**`401 invalid_api_key` even though the key in `.env` is good:** `load_dotenv()` does not override variables already present in the environment, so a stale `OPENAI_API_KEY` in your shell wins. Pass `override=True`:

```python
load_dotenv(Path(__file__).parent / ".env", override=True)
```

**Credentials not reaching the API:** keys in `credentials` must match the placeholder names in the YAML (`SLACK_BOT_TOKEN`), not the tool's parameter names. An unresolved placeholder raises `ErrorCode.INVALID_PARAMETER`.

**Tool call fails only under `agent.run()`:** the sync entrypoint drives Matimo's async `execute()` through a worker thread when a loop is already running. If you are inside an existing event loop, prefer `agent.arun()`, which reaches `execute()` directly.

---

## Working Examples

See [python/examples/agno/](../../python/examples/agno/).

| File | Description |
|---|---|
| `agents/agno_agent.py` | Multi-provider Agno agent over auto-discovered tools |
| `agents/agno_with_approval.py` | Confirmation flow driven by risk classification |

```bash
cd python/examples
cp .env.example .env
uv run python agno/agents/agno_agent.py
```

---

## See Also

- [LangChain Integration](./LANGCHAIN.md): ReAct agents, Python and TypeScript
- [CrewAI Integration](./CREWAI.md): multi-agent crews, Python
- [Policy Engine and Tool Lifecycle](../api-reference/POLICY_AND_LIFECYCLE.md): risk classification and HITL
- [SDK Usage Patterns](../user-guide/SDK_PATTERNS.md#python): factory and decorator patterns
- [MCP Server](../MCP.md): governed tools over Model Context Protocol
