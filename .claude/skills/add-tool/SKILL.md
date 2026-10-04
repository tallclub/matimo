---
name: add-tool
description: Add a new tool to an existing Matimo provider package. Covers the complete workflow: read official API docs → YAML definition → TypeScript + Python executors → validate → lint → unit tests (100% coverage) → TypeScript examples (factory, decorator, langchain, with-approval) → Python examples (native, langchain, crewai). Use when asked to implement any new tool for an existing package like Slack, GitHub, Gmail, HubSpot, etc.
---

Add a new Matimo tool: **$ARGUMENTS**

If no name given, ask: which provider package, what is the tool name, and which API endpoint it wraps.

---

## Step 1 — Read official API docs

Fetch the real documentation (WebSearch / WebFetch). Do not guess parameter schemas or response shapes. Understand:
- Endpoint URL and HTTP method
- Required vs optional parameters (types, enums, constraints)
- Authentication method and required env vars / OAuth scopes
- Response schema (fields, types)
- Error codes and rate limits

---

## Step 2 — Create the YAML definition

Path: `packages/<provider>/tools/<tool-name>/definition.yaml`

**Execution type rules:**
- `type: http` — Use for any standard REST call. The HTTP executor injects auth, builds headers/body/query automatically. This is almost always the right choice.
- `type: function` — Only when you need multi-step calls, response transformation, or file I/O. Requires co-located `.ts` and `.py` executor files.
- `type: command` — Shell CLI tools only. Requires `allowCommandTools: true` in policy (blocked by default).

**Auth type mapping:**

| Provider auth style | `authentication.type` | Header value example |
|--------------------|-----------------------|----------------------|
| Bot token (Slack, Notion) | `api_key` | `Bearer {SLACK_BOT_TOKEN}` |
| PAT / API key in header | `bearer` | `token {GITHUB_TOKEN}` |
| HTTP Basic | `basic` | use `username_env` + `password_env` |
| OAuth2 access token | `oauth2` | `Bearer {PROVIDER_ACCESS_TOKEN}` |

Run `pnpm validate-tools` immediately. Fix every error before the next step.

---

## Step 3 — Executor files (only for type: function)

Both files live **in the same directory as definition.yaml**.

**TypeScript** — `packages/<provider>/tools/<tool-name>/<tool-name>.ts`:
```typescript
import type { ToolParams } from '../../../core/src/core/models';

export async function execute(params: ToolParams): Promise<Record<string, unknown>> {
  const { param1, param2 } = params as { param1: string; param2?: string };
  // implementation
  return { success: true };
}
```

**Python** — `packages/<provider>/tools/<tool-name>/<tool-name>.py`:
```python
from __future__ import annotations
from typing import Any

def execute(params: dict[str, Any]) -> dict[str, Any]:
    param1 = params["param1"]
    param2 = params.get("param2")
    # implementation
    return {"success": True}
```

---

## Step 4 — Fix all lint

```bash
pnpm lint:fix
cd python && uv run ruff check --fix packages/<provider>
```

---

## Step 5 — Write unit tests (100% coverage for this tool)

**TypeScript** — `packages/<provider>/test/unit/<tool-name>.test.ts`:
```typescript
import * as yaml from 'js-yaml';
import * as fs from 'fs';
import * as path from 'path';

const DEF_PATH = path.join(__dirname, '../../tools/<tool-name>/definition.yaml');

describe('<tool-name>', () => {
  let def: any;
  beforeAll(() => { def = yaml.load(fs.readFileSync(DEF_PATH, 'utf-8')); });

  it('has correct name and version', () => {
    expect(def.name).toBe('<tool_name>');
    expect(def.version).toBeDefined();
  });

  it('has required parameters', () => {
    const required = Object.entries(def.parameters)
      .filter(([, v]: any) => v.required).map(([k]) => k);
    expect(required).toContain('<required_param>');
  });

  it('uses correct authentication', () => {
    expect(def.authentication.type).toBe('api_key');
  });

  it('has output_schema', () => {
    expect(def.output_schema).toBeDefined();
  });
});
```

**Python** — `python/packages/<provider>/tests/unit/test_<tool-name>.py`:
```python
from __future__ import annotations
from pathlib import Path
import pytest, yaml, respx, httpx

TOOL_DIR = Path(__file__).parent.parent.parent / "tools" / "<tool-name>"

def test_definition_valid():
    data = yaml.safe_load((TOOL_DIR / "definition.yaml").read_text())
    assert data["name"] == "<tool_name>"
    assert "parameters" in data
    assert "output_schema" in data

def test_required_params():
    data = yaml.safe_load((TOOL_DIR / "definition.yaml").read_text())
    required = [k for k, v in data["parameters"].items() if v.get("required")]
    assert "<required_param>" in required

@pytest.mark.asyncio
@respx.mock
async def test_execute_success():
    respx.post("https://api.example.com/endpoint").mock(
        return_value=httpx.Response(200, json={"ok": True})
    )
    from matimo import Matimo
    m = await Matimo.init(str(TOOL_DIR.parent.parent))
    result = await m.execute("<tool_name>", {"<required_param>": "value"})
    assert result["ok"] is True
```

Run `pnpm test:coverage` — overall must stay ≥96% lines, ≥97% functions.

---

## Step 6 — TypeScript examples

Path: `examples/tools/<provider>/` — add to existing provider files or create new ones.

**1. Factory** (`<provider>-factory.ts`) — Direct `MatimoInstance.execute()`:
```typescript
import 'dotenv/config';
import { MatimoInstance } from '@matimo/core';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const toolsPath = path.join(__dirname, '../../../packages/<provider>/tools');
const matimo = await MatimoInstance.init(toolsPath);
const result = await matimo.execute('<tool_name>', { param1: 'value' });
console.log(result);
```

**2. Decorator** (`<provider>-decorator.ts`) — `@tool` decorator.

**3. LangChain** (`<provider>-langchain.ts`) — Real agent with OpenAI LLM:
```typescript
import { MatimoInstance, convertToolsToLangChain } from '@matimo/core';
import { ChatOpenAI } from '@langchain/openai';
import { AgentExecutor, createOpenAIFunctionsAgent } from 'langchain/agents';
import { ChatPromptTemplate } from '@langchain/core/prompts';

const matimo = await MatimoInstance.init('./packages/<provider>/tools');
const tools = convertToolsToLangChain(matimo.listTools(), matimo);
const llm = new ChatOpenAI({ model: 'gpt-4o-mini', temperature: 0 });
const prompt = ChatPromptTemplate.fromMessages([
  ['system', 'You are a helpful assistant.'],
  ['human', '{input}'],
  ['placeholder', '{agent_scratchpad}'],
]);
const agent = await createOpenAIFunctionsAgent({ llm, tools, prompt });
const executor = AgentExecutor.fromAgentAndTools({ agent, tools });
const result = await executor.invoke({ input: 'Natural language task here' });
```

**4. With approval** (`<provider>-with-approval.ts`) — For POST/PUT/DELETE tools that trigger the approval flow.

---

## Step 7 — Python examples

**Native** (`python/examples/native/<provider>/<tool-name>_example.py`):
```python
import asyncio
from matimo import Matimo

async def main():
    m = await Matimo.init('./packages/<provider>/tools')
    result = await m.execute('<tool_name>', {'param1': 'value'})
    print(result)

asyncio.run(main())
```

**LangChain** (`python/examples/langchain/<provider>/<tool-name>_langchain_agent.py`):
```python
import asyncio
from matimo import Matimo
from matimo.integrations.langchain import convert_tools_to_langchain
from langchain_openai import ChatOpenAI
from langchain.agents import AgentExecutor, create_openai_functions_agent
from langchain_core.prompts import ChatPromptTemplate

async def main():
    m = await Matimo.init('./packages/<provider>/tools')
    tools = convert_tools_to_langchain(m.list_tools(), m)
    llm = ChatOpenAI(model='gpt-4o-mini', temperature=0)
    prompt = ChatPromptTemplate.from_messages([
        ('system', 'You are a helpful assistant.'),
        ('human', '{input}'),
        ('placeholder', '{agent_scratchpad}'),
    ])
    agent = create_openai_functions_agent(llm, tools, prompt)
    executor = AgentExecutor(agent=agent, tools=tools, verbose=True)
    result = await executor.ainvoke({'input': 'Natural language task here'})
    print(result)

asyncio.run(main())
```

**CrewAI** (`python/examples/crewai/<provider>/<tool-name>_crewai_agent.py`):
```python
import asyncio
from matimo import Matimo
from matimo.integrations.crewai import convert_tools_to_crewai
from crewai import Agent, Task, Crew

async def main():
    m = await Matimo.init('./packages/<provider>/tools')
    tools = convert_tools_to_crewai(m.list_tools(), m)
    agent = Agent(role='<Provider> Specialist', goal='Complete tasks efficiently',
                  backstory='Expert at using <Provider> API', tools=tools)
    task = Task(description='Your task', agent=agent)
    Crew(agents=[agent], tasks=[task]).kickoff()

asyncio.run(main())
```

---

## Step 8 — Final gate check

```bash
pnpm validate-tools && pnpm lint && pnpm test:coverage
cd python && uv run ruff check . && uv run mypy . && uv run pytest --cov
```

All must pass. Only then report done.
