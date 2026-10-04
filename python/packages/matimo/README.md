# matimo

> A framework-agnostic SDK with pre-built providers, a skills knowledge layer, MCP out of the box, and agents that autonomously build new capabilities - governed by a policy engine you control.

[![PyPI](https://img.shields.io/pypi/v/matimo)](https://pypi.org/project/matimo/)
[![Python](https://img.shields.io/pypi/pyversions/matimo)](https://pypi.org/project/matimo/)
[![Docs](https://img.shields.io/badge/docs-docs.matimo.dev-blue)](https://docs.matimo.dev)

`matimo` is the convenience meta-package that installs [`matimo-core`](https://pypi.org/project/matimo-core/) and [`matimo-cli`](https://pypi.org/project/matimo-cli/). Provider packages (Slack, GitHub, Gmail, etc.) are installed separately.

---

## Installation

```bash
# Core SDK + CLI
pip install matimo

# With optional framework integrations
pip install "matimo[langchain]"   # LangChain support
pip install "matimo[crewai]"      # CrewAI support
pip install "matimo[agno]"        # Agno support
pip install "matimo[mcp]"         # MCP server support

# With secrets backends
pip install "matimo[dotenv]"      # .env file support
pip install "matimo[vault]"       # HashiCorp Vault
pip install "matimo[aws]"         # AWS Secrets Manager

# Everything (all optional integrations)
pip install "matimo[all]"

# With provider packages
pip install matimo matimo-slack matimo-github matimo-gmail
```

---

## Quick Start

### Factory pattern

```python
import asyncio
from matimo import Matimo

async def main():
    matimo = await Matimo.init('./tools')
    result = await matimo.execute('my_tool', {'param': 'value'})
    print(result)

asyncio.run(main())
```

### Auto-discover installed providers

```python
from matimo import Matimo

matimo = await Matimo.init(auto_discover=True)
print([t.name for t in matimo.list_tools()])
```

### With provider packages

```python
from matimo import Matimo
from matimo_slack import get_tools_path as slack_tools
from matimo_github import get_tools_path as github_tools

matimo = await Matimo.init([slack_tools(), github_tools()])
result = await matimo.execute('slack_send_channel_message', {
    'channel': '#general',
    'text': 'Hello from Matimo!',
})
```

### LangChain agent

```python
from matimo import Matimo, convert_tools_to_langchain
from langchain_openai import ChatOpenAI
from langchain.agents import create_agent   # LangChain 1.x

matimo = await Matimo.init(auto_discover=True)
slack = [t for t in matimo.list_tools() if t.name.startswith('slack')]
lc_tools = convert_tools_to_langchain(slack, matimo)   # pass a short list: OpenAI accepts at most 128 tools

agent = create_agent(ChatOpenAI(model='gpt-4o-mini'), tools=lc_tools)
result = await agent.ainvoke({'messages': [('user', 'List all Slack channels')]})
```

### CrewAI agent

```python
from matimo import Matimo
from matimo.integrations.crewai import convert_tools_to_crewai

matimo = await Matimo.init(auto_discover=True)
crewai_tools = convert_tools_to_crewai(matimo.list_tools(), matimo)
```

### MCP server (Claude Desktop / Cursor)

```python
from matimo import Matimo, MCPServer, MCPServerOptions

matimo = await Matimo.init(auto_discover=True)
server = MCPServer(matimo, MCPServerOptions(transport='stdio'))
await server.start()
```

Or from the shell: `matimo mcp`.

### Approval

Calls that need approval (HTTP DELETE, shell commands, tools marked `requires_approval`) ask your callback:

```python
from matimo import ApprovalRequest, Matimo

async def confirm(request: ApprovalRequest) -> bool:
    return input(f"Allow {request.tool_name}? [y/N] ").strip().lower() == "y"

matimo = await Matimo.init(auto_discover=True, on_approval=confirm)
```

---

## Provider Packages

Install the tools you need:

| Package | Tools | Install |
|---------|-------|---------|
| [`matimo-slack`](https://pypi.org/project/matimo-slack/) | Messaging, channels, files, reactions | `pip install matimo-slack` |
| [`matimo-github`](https://pypi.org/project/matimo-github/) | Repos, issues, PRs, releases | `pip install matimo-github` |
| [`matimo-gmail`](https://pypi.org/project/matimo-gmail/) | Send, list, read, delete emails | `pip install matimo-gmail` |
| [`matimo-notion`](https://pypi.org/project/matimo-notion/) | Pages, databases, comments | `pip install matimo-notion` |
| [`matimo-postgres`](https://pypi.org/project/matimo-postgres/) | Execute SQL queries | `pip install matimo-postgres` |
| [`matimo-twilio`](https://pypi.org/project/matimo-twilio/) | SMS, MMS, message history | `pip install matimo-twilio` |
| [`matimo-hubspot`](https://pypi.org/project/matimo-hubspot/) | CRM: contacts, deals, companies | `pip install matimo-hubspot` |
| [`matimo-mailchimp`](https://pypi.org/project/matimo-mailchimp/) | Campaigns, lists, members | `pip install matimo-mailchimp` |
| [`matimo-microsoft`](https://pypi.org/project/matimo-microsoft/) | Mail, OneDrive/SharePoint, Teams, calendar | `pip install matimo-microsoft` |
| [`matimo-bruno`](https://pypi.org/project/matimo-bruno/) | Manage and run Bruno API test collections | `pip install matimo-bruno` |

---

## Key Features

- **YAML-defined tools** - define once, use from any framework
- **10 provider packages** - 100+ pre-built tools ready to use
- **LangChain / CrewAI / Agno / MCP** - first-class integrations
- **Policy engine** - risk classification, per-call approval, HITL quarantine, content validation, hash-chained audit log
- **Skills system** - inject reusable domain knowledge into agents
- **Meta-tools** - agents can create, approve, and reload tools at runtime
- **Secrets management** - env, `.env`, Vault, AWS Secrets Manager resolver chain
- **Structured logging** - JSON/simple formats, configurable log levels

---

## Documentation

- [Getting Started](https://docs.matimo.dev/getting-started/QUICK_START)
- [API Reference](https://docs.matimo.dev/api-reference/SDK)
- [LangChain Integration](https://docs.matimo.dev/framework-integrations/LANGCHAIN)
- [CrewAI Integration](https://docs.matimo.dev/framework-integrations/CREWAI)
- [MCP Guide](https://docs.matimo.dev/MCP)
- [Policy & Lifecycle](https://docs.matimo.dev/api-reference/POLICY_AND_LIFECYCLE)

---

## Links

- **PyPI:** https://pypi.org/project/matimo/
- **Docs:** https://docs.matimo.dev
- **GitHub:** https://github.com/tallclub/matimo
- **Changelog:** https://github.com/tallclub/matimo/blob/main/docs/RELEASES.md

