# Matimo Python SDK

> **Write YAML once. Run your tools everywhere.**

[![PyPI](https://img.shields.io/pypi/v/matimo)](https://pypi.org/project/matimo/)
[![Python 3.11+](https://img.shields.io/badge/python-3.11+-blue.svg)](https://www.python.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](../LICENSE)
[![Tests](https://github.com/tallclub/matimo/actions/workflows/test-python.yml/badge.svg)](https://github.com/tallclub/matimo/actions)

Matimo is a configuration-driven AI tools SDK. Define tools once in YAML and execute them from any framework — LangChain, CrewAI, MCP, or plain Python.

```python
from matimo import Matimo

matimo = await Matimo.init(auto_discover=True)
result = await matimo.execute("slack_send_channel_message", {
    "channel": "#general",
    "text": "Hello from Matimo!",
})
```

---

## Repository Structure

This is a **monorepo** with independent packages managed by `uv` workspaces:

```
python/
  packages/
    core/              # Core SDK (tool loading, execution, policy engine)
      src/matimo/
      tests/
    cli/               # CLI tool manager
      src/matimo_cli/
    github/            # GitHub provider (23 tools)
    gmail/             # Gmail provider (5 tools)
    hubspot/           # HubSpot provider (55 tools)
    mailchimp/         # Mailchimp provider (7 tools)
    notion/            # Notion provider (7 tools)
    postgres/          # PostgreSQL provider (1 tool)
    slack/             # Slack provider (19 tools)
    twilio/            # Twilio provider (4 tools)
  examples/
    native/            # Pure Python examples (factory, decorator, provider-specific)
    langchain/         # LangChain integration examples
    crewai/            # CrewAI integration examples
  scripts/
    build_providers.py # Build all provider packages
    validate_tools.py  # Validate all YAML tool definitions
  Makefile             # Developer commands (mirrors TypeScript package.json scripts)
  pyproject.toml       # Workspace config + shared dev dependencies
```

Each package has independent versioning and dependencies. The core package is the base; providers depend on it.

---

## Installation

### From PyPI (when published)

```bash
pip install matimo
pip install "matimo[langchain]"   # LangChain
pip install "matimo[crewai]"      # CrewAI
pip install "matimo[mcp]"         # Model Context Protocol
pip install "matimo[all]"         # All extras
```

### From Local Monorepo (Development)

```bash
cd python
uv sync --all-extras --dev   # Install all packages + dev tools
```

Install individual packages:
```bash
cd python
uv run pip install packages/core
uv run pip install packages/slack
uv run pip install "packages/core[langchain]"
```

---

## Quick Start

### 1. Factory Pattern (Simplest)

```python
import asyncio
from matimo import Matimo

async def main():
    # Auto-discover all installed provider tools
    matimo = await Matimo.init(auto_discover=True)

    result = await matimo.execute("calculator", {
        "operation": "add",
        "a": 5,
        "b": 3,
    })
    print(result)  # {"result": 8, "operation": "add"}

asyncio.run(main())
```

**Run example:**
```bash
cd python
uv run python examples/native/agents/factory_pattern_agent.py
```

### 2. Using Provider Tools

```python
import asyncio
from matimo import Matimo

async def main():
    # Load all Slack tools via auto-discovery
    matimo = await Matimo.init(auto_discover=True, providers=["slack"])

    await matimo.execute("slack_send_channel_message", {
        "channel": "#general",
        "text": "Hello from Matimo!",
    })

asyncio.run(main())
```

**Run example:**
```bash
cd python
SLACK_BOT_TOKEN=xoxb-... uv run python examples/native/slack/slack_factory.py
```

### 3. Class-Based Agent with `@tool` Decorator

```python
import asyncio
from matimo import Matimo
from matimo.decorators import tool, set_global_matimo_instance

async def main():
    matimo = await Matimo.init(auto_discover=True)
    set_global_matimo_instance(matimo)

    class SlackAgent:
        @tool("slack_send_channel_message")
        async def notify(self, channel: str, text: str): ...

        @tool("slack_get_channel_history")
        async def history(self, channel: str, limit: int = 10): ...

    agent = SlackAgent()
    await agent.notify(channel="#ops", text="Deploy complete")

asyncio.run(main())
```

### 4. LangChain Integration

```python
import asyncio
from matimo import Matimo, convert_tools_to_langchain
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage

async def main():
    matimo = await Matimo.init(auto_discover=True)

    # Convert all Matimo tools → LangChain-compatible tool schemas
    tools = convert_tools_to_langchain(matimo)

    llm = ChatOpenAI(model="gpt-4o-mini")
    response = await llm.ainvoke([HumanMessage(content="Send hi to #general")], tools=tools)

    if response.tool_calls:
        for call in response.tool_calls:
            result = await matimo.execute(call["name"], call["args"])

asyncio.run(main())
```

**Run example:**
```bash
cd python
OPENAI_API_KEY=sk-... SLACK_BOT_TOKEN=xoxb-... uv run python examples/langchain/agents/langchain_agent.py
```

---

## Defining Tools

Tools live in `packages/{provider}/tools/{tool-name}/definition.yaml`:

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

async def main():
    matimo = await Matimo.init(auto_discover=True)
    server = MatimoMCPServer(matimo, name="my-agent")
    await server.run()  # stdio MCP transport

asyncio.run(main())
```

---

## Development

The Python SDK uses a `Makefile` for all developer commands, mirroring the TypeScript `package.json` scripts. Run all commands from the `python/` directory.

### Setup

```bash
cd python
make install   # uv sync --all-extras --dev
```

### Makefile Commands

| Command | Description |
|---------|-------------|
| `make install` / `make sync` | Install all packages + dev tools |
| `make test` | Run full test suite |
| `make test-unit` | Unit tests only |
| `make test-integration` | Integration tests only |
| `make test-watch` | Watch mode (TDD) |
| `make test-coverage` | Coverage report (HTML) |
| `make lint` | Ruff lint check |
| `make lint-fix` | Auto-fix lint issues |
| `make format` | Format code with ruff |
| `make format-check` | Check formatting (for CI) |
| `make typecheck` | mypy type checking |
| `make validate-tools` | Validate all YAML tool definitions |
| `make build` | Build all provider packages |
| `make clean` | Remove build artifacts |

### Running Tests

```bash
cd python
make test             # All tests
make test-unit        # packages/core/tests/unit/
make test-integration # packages/core/tests/integration/
make test-coverage    # HTML report in htmlcov/
```

### Lint, Format, Type Check

```bash
cd python
make lint        # Check for issues
make lint-fix    # Auto-fix lint issues
make format      # Format all code
make typecheck   # mypy on core package
```

### Validating Tools

```bash
cd python
make validate-tools   # Validates all definition.yaml files across providers
```

This runs `scripts/validate_tools.py` which walks all `packages/*/tools/*/definition.yaml` files and validates them against the Pydantic schema. Exits non-zero on any violation.

### Adding a New Tool

1. Create tool definition: `packages/{provider}/tools/{tool-name}/definition.yaml`
2. Update provider's `pyproject.toml` if adding new dependencies
3. Add tests to `packages/{provider}/tests/`
4. Run `make validate-tools` to verify the YAML
5. Run `make test` to ensure all tests pass

---

## Configuration

| Environment variable | Default | Description |
|----------------------|---------|-------------|
| `MATIMO_LOG_LEVEL` | `info` | `silent`, `error`, `warn`, `info`, `debug` |
| `MATIMO_LOG_FORMAT` | `simple` | `json` or `simple` |
| `MATIMO_AUTO_APPROVE` | `false` | Skip HITL approval in CI |
| `MATIMO_APPROVED_PATTERNS` | — | Comma-separated glob patterns (e.g. `get_*,list_*`) |

---

## Monorepo Structure

```
packages/
  core/                    # Core SDK (matimo-core)
    src/matimo/
      __init__.py
      instance.py          # Matimo entry point
      core/                # models, loader, registry
      executors/           # http, command, function
      policy/              # engine, risk classifier, content validator
      approval/            # HITL handler
      auth/                # credential injection
      integrations/        # LangChain, CrewAI
      mcp/                 # MCP server
      decorators/          # @tool decorator
    tests/
    pyproject.toml

  cli/                     # CLI tool (matimo-cli)
    src/matimo_cli/
    tests/
    pyproject.toml

  {provider}/              # Provider packages (slack, github, gmail, etc.)
    tools/
      {tool-name}/
        definition.yaml
    src/matimo_{provider}/
      __init__.py
      discovery.py         # Tool path discovery
    tests/
    pyproject.toml

examples/
  native/                  # Pure Python examples (factory, decorator, provider-specific)
    agents/
    slack/  github/  gmail/  ...
  langchain/               # LangChain integration examples
    agents/
    slack/  github/  gmail/  ...
  crewai/                  # CrewAI integration examples
    agents/
    slack/  github/  gmail/  ...

scripts/
  build_providers.py       # Build all provider packages
  validate_tools.py        # Validate all YAML definitions

Makefile                   # Developer commands
pyproject.toml             # Workspace config + shared dev deps
```

---

## Contributing

See [CONTRIBUTING.md](../CONTRIBUTING.md). All PRs require tests and linting.

### Before Committing

```bash
cd python

make test         # Run full test suite
make lint-fix     # Auto-fix lint issues
make format       # Format code
make typecheck    # Type checking
```

### Pre-commit Hooks

From the workspace root:

```bash
husky install
```

Pre-commit will run linting on Python changes automatically.

---

## Resources

- **Documentation**: See [docs/](../docs/)
- **Examples**: See [examples/](./examples/)
- **Contributing**: See [CONTRIBUTING.md](../CONTRIBUTING.md)
- **Architecture**: See [../docs/architecture/](../docs/architecture/)

---

## License

MIT © [Tallclub](https://github.com/tallclub)
