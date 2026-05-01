# Bruno CLI Integration

Matimo ships a first-class **Bruno CLI** provider package (`@matimo/bruno` / `matimo-bruno`) that exposes all aspects of the [Bruno](https://www.usebruno.com/) API testing lifecycle as callable Matimo tools.

> **Bruno** is an open-source API client (alternative to Postman/Insomnia) with a Git-friendly collection format and a powerful headless CLI (`bru`).

---

## Overview

The Bruno package adds **7 tools** that cover the complete API collection lifecycle:

| Tool | Purpose |
|------|---------|
| `bruno_create_collection` | Create a new collection directory + `bruno.json` scaffold |
| `bruno_add_request` | Add a `.bru` request file (GET / POST / PUT / DELETE / PATCH) |
| `bruno_get_collection_info` | Read collection metadata and list all requests with methods |
| `bruno_list_collections` | Recursively discover all Bruno collections in a workspace |
| `bruno_run_collection` | Execute all requests via `bru run` with JSON reporter output |
| `bruno_run_request` | Execute a single named request for targeted debugging |
| `bruno_import_openapi` | Bootstrap a collection from an OpenAPI 3.0 spec URL or file |

All tools work identically from any calling pattern: factory, decorator, LangChain, CrewAI, or MCP.

---

## Installation

### TypeScript

```bash
# Install the provider package
pnpm add @matimo/bruno

# Ensure Bruno CLI is installed globally
npm install -g @usebruno/cli
bru --version   # should print 1.x or later
```

### Python

```bash
# Install the provider package
pip install matimo-bruno
# or with uv
uv add matimo-bruno

# Ensure Bruno CLI is installed globally
npm install -g @usebruno/cli
bru --version
```

---

## Quick Start

### TypeScript

```typescript
import { MatimoInstance } from 'matimo';

const matimo = await MatimoInstance.init({ autoDiscover: true });

// 1. Create a collection
await matimo.execute('bruno_create_collection', {
  collection_name: 'My API Tests',
  collection_path: './collections/my-api',
});

// 2. Add requests
await matimo.execute('bruno_add_request', {
  collection_path: './collections/my-api',
  request_name: 'list-users',
  method: 'GET',
  url: 'https://api.example.com/users',
  headers: { Accept: 'application/json' },
});

// 3. Run the collection
const result = await matimo.execute('bruno_run_collection', {
  collection_path: './collections/my-api',
});
console.log(result.summary); // { total, passed, failed, duration }
```

### Python

```python
from matimo.instance import Matimo
from matimo_bruno import get_tools_path

matimo = await Matimo.init([get_tools_path()])

# 1. Create a collection
await matimo.execute('bruno_create_collection', {
    'collection_name': 'My API Tests',
    'collection_path': './collections/my-api',
})

# 2. Add a request
await matimo.execute('bruno_add_request', {
    'collection_path': './collections/my-api',
    'request_name': 'list-users',
    'method': 'GET',
    'url': 'https://api.example.com/users',
    'headers': {'Accept': 'application/json'},
})

# 3. Run the collection
result = await matimo.execute('bruno_run_collection', {
    'collection_path': './collections/my-api',
})
print(result['summary'])  # {'total': 1, 'passed': 1, 'failed': 0, 'duration': '...'}
```

---

## LangChain Agent

Use `convertToolsToLangChain` / `convert_tools_to_langchain` to drive Bruno tools with an LLM agent. The agent can make natural language requests like *"Create a petstore collection and run all tests"* and the model will autonomously select and invoke the correct Bruno tools.

### TypeScript

```typescript
import { MatimoInstance, convertToolsToLangChain, ToolDefinition } from 'matimo';
import { createAgent } from 'langchain';
import { ChatOpenAI } from '@langchain/openai';

const matimo = await MatimoInstance.init({ autoDiscover: true });
const brunoTools = matimo.listTools().filter((t: ToolDefinition) => t.name.startsWith('bruno'));
const langchainTools = await convertToolsToLangChain(brunoTools, matimo);

const agent = await createAgent({
  model: new ChatOpenAI({ model: 'gpt-4o-mini', temperature: 0 }),
  tools: langchainTools,
});

const response = await agent.invoke({
  messages: [{
    role: 'user',
    content: 'Create a "petstore" collection, add a GET /pets request, then run it.',
  }],
});
```

### Python (CrewAI)

```python
from matimo.instance import Matimo
from matimo.integrations.crewai import convert_tools_to_crewai
from matimo_bruno import get_tools_path
from crewai import Agent, Task, Crew

matimo = await Matimo.init([get_tools_path()])
crewai_tools = convert_tools_to_crewai(matimo.list_tools(), matimo)

tester = Agent(
    role='API Tester',
    goal='Create and run a Bruno API test collection autonomously',
    tools=crewai_tools,
    llm='gpt-4o-mini',
)
task = Task(
    description='Create a collection called "smoke-tests", add a GET request to https://httpbin.org/get, then run it.',
    expected_output='Test results summary with pass/fail counts',
    agent=tester,
)
crew = Crew(agents=[tester], tasks=[task])
result = crew.kickoff()
```

---

## Tool Reference

### `bruno_create_collection`

Creates an empty Bruno collection with a `bruno.json` descriptor.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `collection_name` | string | ✅ | Human-readable collection name |
| `collection_path` | string | ✅ | Absolute or relative path where the collection directory is created |

**Returns:** `{ success, collection_path, message, errors }`

---

### `bruno_add_request`

Writes a `.bru` request file into an existing collection.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `collection_path` | string | ✅ | Path to the collection root |
| `request_name` | string | ✅ | Request name (used as the filename slug, alphanumeric + hyphens) |
| `method` | string | ✅ | HTTP method: `GET`, `POST`, `PUT`, `DELETE`, `PATCH`, `HEAD`, `OPTIONS` |
| `url` | string | ✅ | Request URL (can contain `{variables}`) |
| `headers` | object | ❌ | Key-value headers |
| `body` | string | ❌ | JSON or raw text request body (for POST/PUT/PATCH) |
| `tests` | string | ❌ | Bruno test script (JavaScript assertions) |
| `documentation` | string | ❌ | Request documentation/description |

**Returns:** `{ success, request_path, request_name, message }`

---

### `bruno_get_collection_info`

Reads collection metadata and enumerates all `.bru` files.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `collection_path` | string | ✅ | Path to the collection root (file or directory) |

**Returns:** `{ success, collection: { name, path, requests: [{ name, method, url, tags, has_tests }], environments, variables, authentication } }`

---

### `bruno_list_collections`

Recursively scans a workspace directory for Bruno collections (directories containing `bruno.json`).

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `workspace_path` | string | ✅ | Root directory to search |
| `filter` | string | ❌ | Filter collections by name (substring match) |

**Returns:** `{ success, collections: [{ name, path, request_count, environments, tags }] }`

---

### `bruno_run_collection`

Executes all requests in a collection using `bru run` and captures the JSON report.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `collection_path` | string | ✅ | Path to the collection root |
| `environment` | string | ❌ | Bruno environment name to load |
| `env_file` | string | ❌ | Path to environment file to override collection environment |
| `data_file` | string | ❌ | Path to CSV or JSON file for data-driven testing |
| `iteration_count` | number | ❌ | Number of times to run the collection (default: 1) |
| `delay_ms` | number | ❌ | Delay between each request in milliseconds |
| `tags` | string | ❌ | Comma-separated tags — only run requests with ALL specified tags |
| `exclude_tags` | string | ❌ | Comma-separated tags — skip requests with ANY of these tags |
| `tests_only` | boolean | ❌ | Only run requests that have tests or active assertions (default: false) |
| `bail_on_failure` | boolean | ❌ | Stop execution after first failure (default: false) |
| `parallel` | boolean | ❌ | Run requests in parallel (default: false) |
| `sandbox_mode` | string | ❌ | JavaScript execution mode: `safe` or `developer` (default: safe) |
| `report_format` | string | ❌ | Report format: `json`, `junit`, or `html` |
| `report_path` | string | ❌ | Path to write the report file |

**Returns:** `{ success, summary: { total_requests, passed, failed, execution_time_ms }, results, report_path, errors }`

---

### `bruno_run_request`

Executes a single named request from a collection.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `collection_path` | string | ✅ | Path to the collection root |
| `request_name` | string | ✅ | Name of the request to run (exact match) |
| `environment` | string | ❌ | Environment name to use (overrides collection default) |
| `env_file` | string | ❌ | Path to environment file to override variables |
| `sandbox_mode` | string | ❌ | JavaScript execution mode: `safe` or `developer` (default: safe) |

**Returns:** `{ success, request: { method, url, headers, body }, response: { status, headers, body, duration_ms }, assertions, errors }`

---

### `bruno_import_openapi`

Generates a Bruno collection from an OpenAPI 3.0 specification.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `spec_source` | string | ✅ | URL or file path to an OpenAPI 3.0 JSON/YAML spec |
| `output_directory` | string | ✅ | Output directory for the generated collection |
| `collection_name` | string | ❌ | Override the collection name (defaults to spec name) |
| `collection_format` | string | ❌ | `bru` (classic) or `opencollection` (YAML, default: bru) |
| `group_by` | string | ❌ | Group requests by `tags` or `path` (default: tags) |
| `insecure` | boolean | ❌ | Skip TLS verification when spec source is an HTTPS URL (default: false) |

**Returns:** `{ success, collection_path, collection_name, requests_created, message, errors }`

---

## Examples

### TypeScript (complete + LangChain)

```bash
cd typescript/examples/tools

# Complete workflow — 7 tools × 6 workflows (no API key needed)
pnpm bruno:complete

# LangChain agent driving Bruno tools autonomously
pnpm bruno:langchain
```

### Python (complete workflow + CrewAI agent)

```bash
cd python/examples

# Complete workflow — no API key needed
make bruno-complete
# or: uv run python bruno/complete_workflow.py

# CrewAI agent (needs OPENAI_API_KEY)
make bruno-crewai
# or: uv run python bruno/crewai_agent.py
```

---

## Requirements

- **Bruno CLI** (`bru`) — install globally: `npm install -g @usebruno/cli`
- **`bru` version**: 1.x or later (tested with 3.1.3)
- No API key required for `bruno:complete` / `make bruno-complete`
- `OPENAI_API_KEY` required for LangChain and CrewAI agent examples

---

## How `bru run` Works Inside Matimo

Bruno requires `bru run` to be invoked **from the collection root** (the directory containing `bruno.json`). The `bruno_run_collection` and `bruno_run_request` executors handle this automatically using `execFileSync(bru, args, { cwd: absoluteCollectionPath })` — you never need to `cd` manually.

The JSON reporter (`--reporter-json`) writes results to a temporary file which is read back and returned as structured data.

---

## See Also

- [Bruno documentation](https://docs.usebruno.com/)
- [Matimo tool-development guide](../tool-development/TOOL_SPECIFICATION.md)
- [CrewAI integration](./CREWAI.md)
- [LangChain integration](./LANGCHAIN.md)
