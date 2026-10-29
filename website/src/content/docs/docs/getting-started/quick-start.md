---
title: "Quick Start: 5 Minutes"
---
Get Matimo up and running in 5 minutes. Available in **TypeScript** and **Python**.

---

## Python SDK

### Path D: Python Quick Start

**Install:**

```bash
pip install matimo
# or with uv
uv add matimo
```

**Use pre-built tools immediately:**

```bash
pip install matimo matimo-slack matimo-github
```

```python
import asyncio
from matimo import Matimo

async def main():
    # Load all installed provider packages automatically
    matimo = await Matimo.init(auto_discover=True)

    # Execute a Slack tool
    result = await matimo.execute('slack_send_channel_message', {
        'channel': '#general',
        'text': 'Hello from Matimo!',
    })
    print('Message sent!', result)

asyncio.run(main())
```

> **Tool Naming**  
> You'll notice Matimo tools use both `kebab-case` (e.g., `slack-send-message`) and `snake_case` (e.g., `slack_send_channel_message`).  
> Both work identically, legacy tools use kebab-case, newer tools use snake_case.  
> **Recommended for new tools:** `snake_case` following `{provider}_{action}` (e.g., `notion_create_page`).

**Build your own Python tool (5 min):**

Most tools are a single YAML file that describes an HTTP call, no code. This one calls the public JSONPlaceholder test API.

**1. Create `tools/get_user/definition.yaml`:**

```yaml
name: get_user
description: Look up a user by id on the JSONPlaceholder test API
version: '1.0.0'

parameters:
  id:
    type: number
    required: true
    description: User id (1-10)

execution:
  type: http
  method: GET
  url: 'https://jsonplaceholder.typicode.com/users/{id}'

output_schema:
  type: object
  properties:
    name:
      type: string
    email:
      type: string
```

**2. Create `main.py`:**

```python
import asyncio
from matimo import Matimo

async def main():
    matimo = await Matimo.init('./tools', log_level='warn')
    print(f"Loaded {len(matimo.list_tools())} tools")

    user = await matimo.execute('get_user', {'id': 1})
    print('', user['name'], '-', user['email'])

asyncio.run(main())
```

**3. Run it:**

```bash
python main.py
# Loaded 1 tools
# Leanne Graham - Sincere@april.biz
```

A Python HTTP tool returns the parsed response body.

**Python next steps:**
- [SDK Patterns (Python)](/docs/user-guide/sdk-patterns/#python-sdk): factory, decorator, LangChain
- [LangChain Integration](/docs/framework-integrations/langchain/)
- [Examples →](https://github.com/tallclub/matimo/blob/main/python/examples/)

---

## TypeScript SDK

## Choose Your Path

Not sure where to start? Pick one:

### **Path A: Use Pre-Built Tools** (Fastest: 2 mins)

You want to execute existing tools (Slack, Gmail, GitHub, etc.) without building your own.

**Install:**

```bash
npm install matimo @matimo/slack @matimo/gmail
```

**Use immediately:**

```typescript
import { MatimoInstance } from 'matimo';

const matimo = await MatimoInstance.init({ autoDiscover: true });

// Execute a Slack tool
const result = await matimo.execute('slack-send-message', {
  channel: '#general',
  text: 'Hello from Matimo!',
});

console.log('Message sent!', result);
```

> **Tool Naming**  
> Matimo supports both `kebab-case` and `snake_case` tool names. Legacy tools (Gmail, GitHub, older Slack) use `kebab-case` (e.g., `slack-send-message`), while newer tools use `snake_case` (e.g., `bruno_run_request`, `matimo_create_tool`).  
> **Recommended:** Use `snake_case` for new tools following `{provider}_{action}`.

Great for: Using existing integrations in your app
**[See All Available Tools →](https://github.com/tallclub/matimo/blob/main/README.md#whats-included)**

---

### **Path B: Build Your Own Tool** (Educational: 5 mins)

You want to understand how to create and execute custom tools.

**[Continue below to create your first tool →](#1-installation-1-min)**

Great for: Learning how Matimo works
**[Build Your First Tool →](/docs/getting-started/your-first-tool/)**

---

### **Path C: Integrate with LangChain** (Advanced: 10 mins)

You want to use Matimo tools with an AI agent (LangChain, CrewAI, etc.).

**[See LangChain Integration →](/docs/framework-integrations/langchain/)**

Great for: Building intelligent agents
**[Examples →](https://github.com/tallclub/matimo/blob/main/typescript/examples/README.md)**

---

## 1. Installation (1 min)

```bash
npm install matimo
# or with pnpm
pnpm add matimo
```

## 2. Create Your First Script (3 min)

Create a file `demo.ts`:

```typescript
import { MatimoInstance } from 'matimo';

async function main() {
  // Initialize Matimo with your tools
  const matimo = await MatimoInstance.init('./tools');

  // List available tools
  const tools = matimo.listTools();
  console.log(`Loaded ${tools.length} tools`);

  // Execute a tool
  const result = (await matimo.execute('get_user', { id: 1 })) as {
    data: { name: string; email: string };
  };

  console.log('', result.data.name, '-', result.data.email);
}

main().catch(console.error);
```

## 3. Create Your First Tool (1 min)

Create `tools/get_user/definition.yaml`, an HTTP tool, Matimo's default kind, which needs no code:

```yaml
name: get_user
description: Look up a user by id on the JSONPlaceholder test API
version: '1.0.0'

parameters:
  id:
    type: number
    required: true
    description: User id (1-10)

execution:
  type: http
  method: GET
  url: 'https://jsonplaceholder.typicode.com/users/{id}'

output_schema:
  type: object
  properties:
    name:
      type: string
    email:
      type: string
```

## 4. Run It (< 1 min)

```bash
# Compile TypeScript
npx tsc demo.ts

# Run the script
node demo.js

# Output:
# Loaded 1 tools
# Leanne Graham - Sincere@april.biz
```

A TypeScript HTTP tool returns `{ success, data, statusCode, headers }`, with the response body in `data`.

---

## What Just Happened?

1. **MatimoInstance.init('./tools')**: Loaded every `definition.yaml` under `./tools`
2. **matimo.listTools()**: Listed discovered tools
3. **matimo.execute('get_user', { id: 1 })**: The policy engine classified the call (a GET is low risk, so it runs without asking), Matimo filled `{id}` into the URL, made the request and returned the result

### The `MATIMO_APPROVAL_SECRET` warning

On a first run both SDKs log `No MATIMO_APPROVAL_SECRET set`. It is a warning, not an error. Matimo signs approvals with that secret, and without one it makes a temporary secret for the process, so approvals do not survive a restart. For local experiments you can ignore it. Before you rely on approvals, set a long random value (`export MATIMO_APPROVAL_SECRET=...`). It is required when `NODE_ENV` or `MATIMO_ENV` is `production`.

### Tools that ask first

In 0.2.0 some calls wait for a person: tools whose YAML says `requires_approval: true`, HTTP `DELETE` tools, and `type: command` tools (unless they say `requires_approval: false`). Give the instance a reviewer, or those calls are refused:

```typescript
const matimo = await MatimoInstance.init({
  toolPaths: ['./tools'],
  onApproval: async (request) => confirmWithUser(request.toolName, request.params),
});
```

```python
async def on_approval(request) -> bool:
    return await confirm_with_user(request.tool_name, request.params)

matimo = await Matimo.init("./tools", on_approval=on_approval)
```

See [Approval System](/docs/api-reference/approval-system/).

---

## Next Steps

### Choose Your Pattern

- **Factory Pattern** (you just used this), Best for simple scripts and backends
- **Decorator Pattern**: Best for class-based code
- **LangChain**: Best for AI agents with automatic tool selection

See [SDK Usage Patterns](/docs/user-guide/sdk-patterns/) for details.

### Add More Tools

Create more YAML files in `tools/`:

```
tools/
├── get_user/
│   └── definition.yaml      # Done 
├── my-api/
│   └── definition.yaml      # Create more
└── slack/
    └── definition.yaml
```

Each tool is just a YAML file, no code needed!

### Use Provider Tools

Install pre-built tools from npm:

```bash
pnpm add @matimo/slack @matimo/gmail
```

Then load them alongside your custom tools:

```typescript
const matimo = await MatimoInstance.init({
  toolPaths: [
    './tools',                              // Your custom tools
    './node_modules/@matimo/slack/tools',   // Pre-built tools
    './node_modules/@matimo/gmail/tools',
  ],
});
```

In Python, install the provider packages from PyPI and let auto-discovery find them, with your own folder alongside:

```bash
pip install matimo-slack matimo-gmail
```

```python
matimo = await Matimo.init("./tools", auto_discover=True)
```

---

## Further Reading

- **[API Reference](/docs/api-reference/sdk/)**: Full SDK methods and types
- **[Tool Specification](/docs/tool-development/tool-specification/)**: Write production tools
- **[SDK Usage Patterns](/docs/user-guide/sdk-patterns/)**: Factory, Decorator, LangChain patterns
- **[Architecture Overview](/docs/architecture/overview/)**: How Matimo works internally
- **[Framework Integrations](/docs/framework-integrations/langchain/)**: LangChain integration examples

---

## Common Tasks

Each task is shown in TypeScript, then Python.

### List All Loaded Tools

```typescript
const tools = matimo.listTools();
tools.forEach((tool) => {
  console.log(`${tool.name} - ${tool.description}`);
});
```

```python
for tool in matimo.list_tools():
    print(f"{tool.name} - {tool.description}")
```

### Get Tool by Name

```typescript
const tool = matimo.getTool('get_user');
if (tool) {
  console.log('Parameters:', tool.parameters);
}
```

```python
tool = matimo.get_tool("get_user")
if tool:
    print("Parameters:", tool.parameters)
```

### Search Tools

```typescript
const results = matimo.searchTools('user');
console.log(
  'Found:',
  results.map((t) => t.name)
);
```

```python
results = matimo.search_tools("user")
print("Found:", [t.name for t in results])
```

### Execute with Error Handling

```typescript
try {
  const result = await matimo.execute('get_user', { id: 1 });
  console.log('Success:', result);
} catch (error) {
  if (error.code === 'TOOL_NOT_FOUND') {
    console.error('Tool not found:', error.message);
  } else if (error.code === 'INVALID_PARAMETER') {
    console.error('Invalid parameters:', error.details);
  } else if (error.code === 'POLICY_DENIED') {
    console.error('Refused by policy or by a reviewer:', error.message);
  } else if (error.code === 'EXECUTION_FAILED') {
    console.error('Execution failed:', error.details);
  }
}
```

```python
from matimo import MatimoError

try:
    result = await matimo.execute("get_user", {"id": 1})
    print("Success:", result)
except MatimoError as error:
    if error.code == "TOOL_NOT_FOUND":
        print("Tool not found:", error)
    elif error.code == "INVALID_PARAMETER":
        print("Invalid parameters:", error.details)
    elif error.code == "POLICY_DENIED":
        print("Refused by policy or by a reviewer:", error)
    elif error.code == "EXECUTION_FAILED":
        print("Execution failed:", error.details)
```

---

## Example: Using Slack

After installing `@matimo/slack`:

```typescript
import { MatimoInstance } from 'matimo';

const matimo = await MatimoInstance.init({
  toolPaths: ['./tools', './node_modules/@matimo/slack/tools'],
});

// Execute a Slack tool
const result = await matimo.execute('slack-send-message', {
  channel: '#general',
  text: 'Hello from Matimo!',
});

console.log(result);
```

The same call in Python, after `pip install matimo-slack`:

```python
matimo = await Matimo.init("./tools", auto_discover=True)

result = await matimo.execute("slack-send-message", {
    "channel": "#general",
    "text": "Hello from Matimo!",
})
print(result)
```

---

## Troubleshooting

**Tools not loading?**

```bash
# Check that YAML files exist
ls tools/*/definition.yaml

# Validate YAML syntax
pnpm validate-tools     # TypeScript: from typescript/ in a clone of the repo
make validate-tools     # Python: from python/ in a clone of the repo
```

**Execution failing?**

```typescript
// Enable detailed error messages
try {
  const result = await matimo.execute('tool-name', params);
} catch (error) {
  console.error('Full error:', JSON.stringify(error, null, 2));
}
```

```python
# Python: print the full error, including its details
try:
    result = await matimo.execute("tool-name", params)
except MatimoError as error:
    print(error.code, error, error.details)
```

**Type errors?**

```bash
# Check TypeScript compilation
npx tsc --noEmit
```

---

## Support

- [Full Documentation](https://github.com/tallclub/matimo/blob/main/docs/./)
- [GitHub Discussions](https://github.com/tallclub/matimo/discussions)
- [Report Issues](https://github.com/tallclub/matimo/issues)
- [Contributing](https://github.com/tallclub/matimo/blob/main/CONTRIBUTING.md)
