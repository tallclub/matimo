# matimo-core

> Matimo core - framework-agnostic SDK with pre-built providers, skills layer, MCP, and a policy engine you control.

[![PyPI](https://img.shields.io/pypi/v/matimo-core)](https://pypi.org/project/matimo-core/)
[![Python](https://img.shields.io/pypi/pyversions/matimo-core)](https://pypi.org/project/matimo-core/)
[![Docs](https://img.shields.io/badge/docs-matimo.dev-blue)](https://matimo.dev/docs)
[![Tests](https://img.shields.io/badge/tests-1134%20passing-brightgreen)](https://github.com/tallclub/matimo)
[![Coverage](https://img.shields.io/badge/coverage-97%25-brightgreen)](https://github.com/tallclub/matimo)

Write tools once in YAML, use them everywhere - with LangChain, CrewAI, MCP, and more.

> **Note:** Most users should install [`matimo`](https://pypi.org/project/matimo/) (the convenience wrapper) instead of `matimo-core` directly.

---

## Installation

```bash
pip install matimo-core
# with framework extras
pip install "matimo-core[langchain]"
pip install "matimo-core[crewai]"
pip install "matimo-core[mcp]"
pip install "matimo-core[langchain,crewai,mcp]"
```

---

## Quick Start

### Factory pattern

```python
import asyncio
from matimo import Matimo

async def main():
    # Load tools from a directory
    matimo = await Matimo.init('./tools')
    result = await matimo.execute('my_tool', {'param': 'value'})
    print(result)

asyncio.run(main())
```

### Auto-discover installed providers

```python
from matimo import Matimo

matimo = await Matimo.init(auto_discover=True)
tools = matimo.list_tools()
print(f"{len(tools)} tools loaded")
```

### Decorator pattern

```python
from matimo import Matimo, tool, set_global_matimo_instance

matimo = await Matimo.init('./tools')
set_global_matimo_instance(matimo)

class MyAgent:
    @tool('slack_send_channel_message')
    async def send_message(self, channel: str, text: str): ...
    # Decorator handles execution automatically
```

### LangChain

```python
from matimo import Matimo
from matimo.integrations.langchain import convert_tools_to_langchain
from langchain_openai import ChatOpenAI
from langchain.agents import AgentExecutor, create_tool_calling_agent
from langchain_core.prompts import ChatPromptTemplate

matimo = await Matimo.init(auto_discover=True)
lc_tools = convert_tools_to_langchain(
    matimo.list_tools(),
    matimo,
    credentials={'SLACK_BOT_TOKEN': 'xoxb-...'},
)
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

### CrewAI

```python
from matimo import Matimo
from matimo.integrations.crewai import convert_tools_to_crewai

matimo = await Matimo.init(auto_discover=True)
tools = convert_tools_to_crewai(matimo.list_tools(), matimo)
```

### MCP server

```python
from matimo import Matimo, create_mcp_server, MCPServerOptions

matimo = await Matimo.init(auto_discover=True)
server = await create_mcp_server(matimo, MCPServerOptions(name='my-agent', version='1.0.0'))
await server.start()
```

---

## Core API

### `Matimo.init()`

```python
from matimo import Matimo, InitOptions

matimo = await Matimo.init(
    tool_paths=['./tools', './agent-tools'],  # or a single string
    auto_discover=False,       # discover installed matimo-* packages
    policy_file='./policy.yaml',
    untrusted_paths=['./agent-tools'],
    skill_paths=['./skills'],
    log_level='info',          # silent | error | warn | info | debug
    log_format='json',         # json | simple
    on_event=my_event_handler,
    on_hitl=my_approval_callback,
)
```

### Key methods

| Method | Description |
|--------|-------------|
| `await matimo.execute(name, params)` | Execute a tool by name |
| `matimo.list_tools()` | Return all loaded `ToolDefinition` objects |
| `matimo.get_tool(name)` | Get a single `ToolDefinition` (or `None`) |
| `matimo.search_tools(query)` | Text search over tool names + descriptions |
| `await matimo.reload()` | Hot-reload tools from disk |
| `matimo.list_skills()` | Return all loaded skill definitions |
| `await matimo.semantic_search_skills(query)` | TF-IDF search over skills |
| `matimo.has_policy()` | Whether a policy engine is active |

---

## Tool YAML Format

```yaml
name: my_api_tool
version: '1.0.0'
description: Fetch data from an API
parameters:
  query:
    type: string
    required: true
    description: Search query
execution:
  type: http
  method: GET
  url: 'https://api.example.com/search?q={query}'
  headers:
    Authorization: 'Bearer {API_KEY}'
```

---

## Policy Engine

```python
from matimo import Matimo, InitOptions

matimo = await Matimo.init('./tools', InitOptions(
    policy_file='./policy.yaml',
    on_hitl=lambda req: {'approved': True, 'reason': 'auto'},
))
```

`policy.yaml`:
```yaml
allowedDomains:
  - api.github.com
  - api.slack.com
allowedHttpMethods: [GET, POST]
allowCommandTools: false
allowFunctionTools: false
```

---

## Secrets Management

```python
from matimo.mcp.secrets import create_resolver_chain

resolver = create_resolver_chain([
    {'type': 'env'},
    {'type': 'dotenv', 'path': '.env'},
    {'type': 'vault', 'addr': 'http://vault:8200'},
    {'type': 'aws', 'region': 'us-east-1'},
])
token = await resolver.resolve('SLACK_BOT_TOKEN')
```

---

## Logging

```python
from matimo import Matimo
from matimo.logging import get_global_matimo_logger

matimo = await Matimo.init('./tools', log_level='info', log_format='json')
logger = get_global_matimo_logger()
logger.info('Tool executed', tool='slack_send_channel_message')
```

---

## Meta-Tools (Agent Tool Lifecycle)

Built-in tools that let agents manage other tools at runtime:

| Tool | Purpose | Requires Approval |
|------|---------|:-----------------:|
| `matimo_validate_tool` | Validate YAML definition | No |
| `matimo_create_tool` | Write new tool to disk | Yes |
| `matimo_approve_tool` | Promote draft → approved | Yes |
| `matimo_reload_tools` | Hot-reload registry | Yes |
| `matimo_list_user_tools` | List agent-created tools | No |
| `matimo_get_tool` | Retrieve a tool's full definition | No |
| `matimo_get_tool_status` | Check approval state | Yes |
| `matimo_search_tools` | Search the loaded tool registry by keyword | No |
| `matimo_create_skill` | Create a SKILL.md | Yes |
| `matimo_list_skills` | List available skills | No |
| `matimo_get_skill` | Read skill content | No |
| `matimo_validate_skill` | Validate skill spec | No |

---

## Documentation

- [Getting Started](https://matimo.dev/docs/getting-started/QUICK_START)
- [Full API Reference](https://matimo.dev/docs/api-reference/SDK)
- [LangChain Integration](https://matimo.dev/docs/framework-integrations/LANGCHAIN)
- [CrewAI Integration](https://matimo.dev/docs/framework-integrations/CREWAI)
- [MCP Guide](https://matimo.dev/docs/MCP)
- [Policy & Lifecycle](https://matimo.dev/docs/api-reference/POLICY_AND_LIFECYCLE)
- [Meta-Tools Reference](https://matimo.dev/docs/api-reference/META_TOOLS)

---

## Links

- **PyPI:** https://pypi.org/project/matimo-core/
- **Docs:** https://matimo.dev/docs
- **GitHub:** https://github.com/tallclub/matimo
- **Changelog:** https://github.com/tallclub/matimo/blob/main/docs/RELEASES.md

