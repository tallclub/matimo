# Matimo Python SDK

> **Write YAML once. Run your tools everywhere.**

[![PyPI](https://img.shields.io/pypi/v/matimo)](https://pypi.org/project/matimo/)
[![Python 3.11+](https://img.shields.io/badge/python-3.11+-blue.svg)](https://www.python.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](../LICENSE)
[![Tests](https://github.com/tallclub/matimo/actions/workflows/test-python.yml/badge.svg)](https://github.com/tallclub/matimo/actions)

Matimo is a configuration-driven AI tools SDK. Define tools once in YAML and execute them from any framework — LangChain, CrewAI, MCP, or plain Python.

```python
from matimo import Matimo

matimo = await Matimo.init("./tools")
result = await matimo.execute("slack_send_channel_message", {
    "channel": "#general",
    "text": "Hello from Matimo!",
})
```

---

## Features

- **YAML-first tool definitions** — parameters, HTTP config, auth, output schema in one file
- **Three execution types** — `http`, `command`, `function`
- **Framework integrations** — LangChain, CrewAI, MCP
- **Policy engine** — risk classification, content validation, HITL approval, audit events
- **Provider packages** — 112 pre-built tools across 8 services (Slack, GitHub, Gmail, HubSpot, Notion, PostgreSQL, Mailchimp, Twilio)
- **`@tool` decorator** — class-based agent pattern
- **Typed, async, Pydantic v2** throughout

---

## Installation

```bash
pip install matimo
```

**With framework integrations:**

```bash
pip install "matimo[langchain]"   # LangChain
pip install "matimo[crewai]"      # CrewAI
pip install "matimo[mcp]"         # Model Context Protocol
pip install "matimo[all]"         # Everything
```

**With provider tools:**

```bash
pip install matimo-slack matimo-github matimo-gmail
```

Available providers: `matimo-slack`, `matimo-github`, `matimo-gmail`, `matimo-hubspot`, `matimo-notion`, `matimo-postgres`, `matimo-mailchimp`, `matimo-twilio`

---

## Quick Start

### 1. Factory pattern (simplest)

```python
import asyncio
from matimo import Matimo

async def main():
    matimo = await Matimo.init("./tools")

    result = await matimo.execute("calculator", {
        "operation": "add",
        "a": 5,
        "b": 3,
    })
    print(result)  # {"result": 8, "operation": "add"}

asyncio.run(main())
```

### 2. Provider packages

```python
from matimo import Matimo
from matimo_slack import get_tools_path

matimo = await Matimo.init(get_tools_path())

await matimo.execute("slack_send_channel_message", {
    "channel": "#general",
    "text": "Hello from Matimo!",
})
```

### 3. `@tool` decorator (class-based agents)

```python
from matimo import Matimo
from matimo.decorators import tool, set_global_matimo_instance

matimo = await Matimo.init("./tools")
set_global_matimo_instance(matimo)

class SlackAgent:
    @tool("slack_send_channel_message")
    async def notify(self, channel: str, text: str): ...

    @tool("slack_get_channel_history")
    async def history(self, channel: str, limit: int = 10): ...

agent = SlackAgent()
await agent.notify(channel="#ops", text="Deploy complete")
```

### 4. LangChain integration

```python
from matimo import Matimo
from matimo_slack import get_tools_path
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage

matimo = await Matimo.init(get_tools_path())

# Convert Matimo tools → OpenAI function schemas
tools = [
    {
        "type": "function",
        "function": {
            "name": t.name,
            "description": t.description,
            "parameters": {
                "type": "object",
                "properties": {
                    k: {"type": v.type.value, "description": v.description or ""}
                    for k, v in (t.parameters or {}).items()
                },
                "required": [k for k, v in (t.parameters or {}).items() if v.required],
            },
        },
    }
    for t in matimo.list_tools()
]

llm = ChatOpenAI(model="gpt-4o-mini")
response = await llm.ainvoke([HumanMessage(content="Send hi to #general")], tools=tools)

if response.tool_calls:
    for call in response.tool_calls:
        result = await matimo.execute(call["name"], call["args"])
```

---

## Defining Tools

Tools live in `tools/{tool-name}/definition.yaml`:

```yaml
name: send_notification
version: "1.0.0"
description: Send a Slack notification to a channel

parameters:
  channel:
    type: string
    required: true
    description: Channel ID or name
  text:
    type: string
    required: true
    description: Message text

execution:
  type: http
  method: POST
  url: "https://slack.com/api/chat.postMessage"
  headers:
    Authorization: "Bearer {SLACK_BOT_TOKEN}"
    Content-Type: application/json
  body:
    channel: "{channel}"
    text: "{text}"

authentication:
  type: api_key
  location: header
  name: Authorization
```

**Execution types:**

| Type | Use case |
|------|----------|
| `http` | REST API calls |
| `command` | Spawn a subprocess |
| `function` | Execute a Python/JS file |

---

## Policy Engine

```python
from matimo import Matimo
from matimo.policy.types import PolicyConfig, RiskLevel

config = PolicyConfig(
    enable_hitl=True,
    quarantine_risk_levels=[RiskLevel.HIGH, RiskLevel.CRITICAL],
)
matimo = await Matimo.init("./tools", policy_config=config)

# Wire a human-in-the-loop approval callback
async def approve(request) -> bool:
    print(f"Approve {request.tool_name}? (y/n)")
    return input().strip().lower() == "y"

matimo = await Matimo.init("./tools", policy_config=config, on_hitl=approve)
```

**Built-in rules:**
- Deprecated tools are blocked
- Draft tools blocked in production without admin role
- Risk classification: `function` → CRITICAL, `command` → HIGH, DELETE → HIGH, POST/PUT → MEDIUM
- Content validation: SSRF protection, blocked HTTP methods, reserved namespaces
- Integrity tracking: detect tool tampering via checksums

---

## MCP Server

```python
from matimo import Matimo
from matimo.mcp.server import MatimoMCPServer

matimo = await Matimo.init("./tools")
server = MatimoMCPServer(matimo, name="my-agent")
await server.run()  # stdio MCP transport
```

---

## Configuration

| Environment variable | Default | Description |
|----------------------|---------|-------------|
| `MATIMO_LOG_LEVEL` | `info` | `silent`, `error`, `warn`, `info`, `debug` |
| `MATIMO_LOG_FORMAT` | `simple` | `json` or `simple` |
| `MATIMO_AUTO_APPROVE` | `false` | Skip HITL approval in CI |
| `MATIMO_APPROVED_PATTERNS` | — | Comma-separated glob patterns (e.g. `get_*,list_*`) |

---

## Project Structure

```
python/
├── src/matimo/
│   ├── core/          # models, loader, registry
│   ├── executors/     # http, command, function
│   ├── policy/        # engine, risk classifier, content validator
│   ├── approval/      # HITL handler
│   ├── auth/          # credential injection
│   ├── encodings/     # parameter encodings (MIME, JSON, URL)
│   ├── integrations/  # LangChain, CrewAI
│   ├── mcp/           # MCP server
│   ├── decorators/    # @tool decorator
│   └── instance.py    # Matimo entry point
├── providers/         # matimo-slack, matimo-github, …
├── examples/
│   ├── factory_example.py
│   ├── langchain_slack_agent.py
│   ├── langchain_github_agent.py
│   └── crewai_project_manager.py
└── tests/
```

---

## Contributing

See [CONTRIBUTING.md](../CONTRIBUTING.md). All PRs require tests (`pytest`) and lint (`ruff`).

```bash
pip install -e ".[dev]"
pytest
ruff check src/
```

---

## License

MIT © [Tallclub](https://github.com/tallclub)
