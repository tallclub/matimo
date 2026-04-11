# matimo

> Configuration-driven AI tools SDK — write tools once in YAML, use them everywhere.

[![PyPI](https://img.shields.io/pypi/v/matimo)](https://pypi.org/project/matimo/)
[![Python](https://img.shields.io/pypi/pyversions/matimo)](https://pypi.org/project/matimo/)
[![Docs](https://img.shields.io/badge/docs-matimo.dev-blue)](https://matimo.dev/docs)

`matimo` is the convenience meta-package that installs [`matimo-core`](https://pypi.org/project/matimo-core/) and re-exports its full public API. Everything you need is in one `pip install`.

---

## Installation

```bash
pip install matimo
# with LangChain support
pip install "matimo[langchain]"
# with CrewAI support
pip install "matimo[crewai]"
# with MCP server
pip install "matimo[mcp]"
# everything
pip install "matimo[langchain,crewai,mcp]"
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

```bash
pip install matimo matimo-slack matimo-github matimo-gmail
```

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
from matimo import Matimo
from matimo.integrations.langchain import convert_tools_to_langchain
from langchain_openai import ChatOpenAI
from langchain.agents import AgentExecutor, create_tool_calling_agent
from langchain_core.prompts import ChatPromptTemplate

matimo = await Matimo.init(auto_discover=True)
lc_tools = convert_tools_to_langchain(matimo.list_tools(), matimo)

llm = ChatOpenAI(model='gpt-4o-mini')
prompt = ChatPromptTemplate.from_messages([
    ('system', 'You are a helpful assistant.'),
    ('human', '{input}'),
    ('placeholder', '{agent_scratchpad}'),
])
agent = create_tool_calling_agent(llm, lc_tools, prompt)
executor = AgentExecutor(agent=agent, tools=lc_tools)
result = await executor.ainvoke({'input': 'List all Slack channels'})
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
from matimo import Matimo, create_mcp_server, MCPServerOptions

matimo = await Matimo.init(auto_discover=True)
server = await create_mcp_server(matimo, MCPServerOptions(name='my-agent', version='1.0.0'))
await server.start()
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

---

## Key Features

- **YAML-defined tools** — define once, use from any framework
- **10 provider packages** — 100+ pre-built tools ready to use
- **LangChain / CrewAI / MCP** — first-class integrations
- **Policy engine** — risk classification, HITL approvals, content validation
- **Skills system** — inject reusable domain knowledge into agents
- **Meta-tools** — agents can create, approve, and reload tools at runtime
- **Secrets management** — env, `.env`, Vault, AWS Secrets Manager resolver chain
- **Structured logging** — JSON/simple formats, configurable log levels

---

## Documentation

- [Getting Started](https://matimo.dev/docs/getting-started/QUICK_START)
- [API Reference](https://matimo.dev/docs/api-reference/SDK)
- [LangChain Integration](https://matimo.dev/docs/framework-integrations/LANGCHAIN)
- [CrewAI Integration](https://matimo.dev/docs/framework-integrations/CREWAI)
- [MCP Guide](https://matimo.dev/docs/MCP)
- [Policy & Lifecycle](https://matimo.dev/docs/api-reference/POLICY_AND_LIFECYCLE)

---

## Links

- **PyPI:** https://pypi.org/project/matimo/
- **Docs:** https://matimo.dev/docs
- **GitHub:** https://github.com/tallclub/matimo
- **Changelog:** https://github.com/tallclub/matimo/blob/main/docs/RELEASES.md

