# Quick Start — 5 Minutes

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

> **ℹ️ Tool Naming**  
> You'll notice Matimo tools use both `kebab-case` (e.g., `slack-send-message`) and `snake_case` (e.g., `slack_send_channel_message`).  
> Both work identically — legacy tools use kebab-case, newer tools use snake_case.  
> **Recommended for new tools:** `snake_case` following `{provider}_{action}` (e.g., `notion_create_page`).

**Build your own Python tool (5 min):**

Most tools are a single YAML file that describes an HTTP call — no code. This one calls the public JSONPlaceholder test API.

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
    print(f"📦 Loaded {len(matimo.list_tools())} tools")

    user = await matimo.execute('get_user', {'id': 1})
    print('✅', user['name'], '-', user['email'])

asyncio.run(main())
```

**3. Run it:**

```bash
python main.py
# 📦 Loaded 1 tools
# ✅ Leanne Graham - Sincere@april.biz
```

A Python HTTP tool returns the parsed response body.

**Python next steps:**
- [SDK Patterns (Python)](#python-sdk-patterns) — factory, decorator, LangChain
- [LangChain Integration](../framework-integrations/LANGCHAIN.md)
- [Examples →](../../python/examples/)

---

## TypeScript SDK

## Choose Your Path

Not sure where to start? Pick one:

### 🚀 **Path A: Use Pre-Built Tools** (Fastest — 2 mins)

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

> **ℹ️ Tool Naming**  
> Matimo supports both `kebab-case` and `snake_case` tool names. Legacy tools (Gmail, GitHub, older Slack) use `kebab-case` (e.g., `slack-send-message`), while newer tools use `snake_case` (e.g., `bruno_run_request`, `matimo_create_tool`).  
> **Recommended:** Use `snake_case` for new tools following `{provider}_{action}`.

✅ Great for: Using existing integrations in your app
📖 **[See All Available Tools →](../../README.md#whats-included)**

---

### 🛠️ **Path B: Build Your Own Tool** (Educational — 5 mins)

You want to understand how to create and execute custom tools.

**[Continue below to create your first tool →](#1-installation-1-min)**

✅ Great for: Learning how Matimo works
📖 **[Build Your First Tool →](./YOUR_FIRST_TOOL.md)**

---

### 🤖 **Path C: Integrate with LangChain** (Advanced — 10 mins)

You want to use Matimo tools with an AI agent (LangChain, CrewAI, etc.).

**[See LangChain Integration →](../framework-integrations/LANGCHAIN.md)**

✅ Great for: Building intelligent agents
📖 **[Examples →](../../typescript/examples/README.md)**

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
  console.log(`📦 Loaded ${tools.length} tools`);

  // Execute a tool
  const result = (await matimo.execute('get_user', { id: 1 })) as {
    data: { name: string; email: string };
  };

  console.log('✅', result.data.name, '-', result.data.email);
}

main().catch(console.error);
```

## 3. Create Your First Tool (1 min)

Create `tools/get_user/definition.yaml` — an HTTP tool, Matimo's default kind, which needs no code:

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
# 📦 Loaded 1 tools
# ✅ Leanne Graham - Sincere@april.biz
```

A TypeScript HTTP tool returns `{ success, data, statusCode, headers }`, with the response body in `data`.

---

## What Just Happened?

1. **MatimoInstance.init('./tools')** — Loaded every `definition.yaml` under `./tools`
2. **matimo.listTools()** — Listed discovered tools
3. **matimo.execute('get_user', { id: 1 })** — The policy engine classified the call (a GET is low risk, so it runs without asking), Matimo filled `{id}` into the URL, made the request and returned the result

### Tools that ask first

In 0.2.0 some calls wait for a person: tools whose YAML says `requires_approval: true`, HTTP `DELETE` tools, and `type: command` tools (unless they say `requires_approval: false`). Give the instance a reviewer, or those calls are refused:

```typescript
const matimo = await MatimoInstance.init({
  toolPaths: ['./tools'],
  onApproval: async (request) => confirmWithUser(request.toolName, request.params),
});
```

See [Approval System](../api-reference/APPROVAL-SYSTEM.md).

---

## Next Steps

### Choose Your Pattern

- **Factory Pattern** (you just used this) — Best for simple scripts and backends
- **Decorator Pattern** — Best for class-based code
- **LangChain** — Best for AI agents with automatic tool selection

See [SDK Usage Patterns](../user-guide/SDK_PATTERNS.md) for details.

### Add More Tools

Create more YAML files in `tools/`:

```
tools/
├── get_user/
│   └── definition.yaml      # Done ✅
├── my-api/
│   └── definition.yaml      # Create more
└── slack/
    └── definition.yaml
```

Each tool is just a YAML file — no code needed!

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

---

## Further Reading

- **[API Reference](../api-reference/SDK.md)** — Full SDK methods and types
- **[Tool Specification](../tool-development/TOOL_SPECIFICATION.md)** — Write production tools
- **[SDK Usage Patterns](../user-guide/SDK_PATTERNS.md)** — Factory, Decorator, LangChain patterns
- **[Architecture Overview](../architecture/OVERVIEW.md)** — How Matimo works internally
- **[Framework Integrations](../framework-integrations/LANGCHAIN.md)** — LangChain integration examples

---

## Common Tasks

### List All Loaded Tools

```typescript
const tools = matimo.listTools();
tools.forEach((tool) => {
  console.log(`${tool.name} - ${tool.description}`);
});
```

### Get Tool by Name

```typescript
const tool = matimo.getTool('get_user');
if (tool) {
  console.log('Parameters:', tool.parameters);
}
```

### Search Tools

```typescript
const results = matimo.searchTools('user');
console.log(
  'Found:',
  results.map((t) => t.name)
);
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

---

## Troubleshooting

**Tools not loading?**

```bash
# Check that YAML files exist
ls tools/*/definition.yaml

# Validate YAML syntax
pnpm validate-tools
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

**Type errors?**

```bash
# Check TypeScript compilation
npx tsc --noEmit
```

---

## Support

- 📖 [Full Documentation](../)
- 💬 [GitHub Discussions](https://github.com/tallclub/matimo/discussions)
- 🐛 [Report Issues](https://github.com/tallclub/matimo/issues)
- 🤝 [Contributing](https://github.com/tallclub/matimo/blob/main/CONTRIBUTING.md)
