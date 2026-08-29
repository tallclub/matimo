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

**1. Create `tools/calculator/definition.yaml`:**

```yaml
name: calculator
description: Perform basic math operations
version: '1.0.0'

parameters:
  operation:
    type: string
    enum: [add, subtract, multiply, divide]
    required: true
  a:
    type: number
    required: true
  b:
    type: number
    required: true

execution:
  type: command
  command: python
  args:
    - -c
    - |
      import sys, json, operator
      op, a, b = sys.argv[1], float(sys.argv[2]), float(sys.argv[3])
      ops = {'add': a+b, 'subtract': a-b, 'multiply': a*b, 'divide': a/b}
      print(json.dumps({'result': ops[op]}))
    - '{operation}'
    - '{a}'
    - '{b}'

output_schema:
  type: object
  properties:
    result:
      type: number
  required: [result]
```

**2. Create `main.py`:**

```python
import asyncio
from matimo import Matimo

async def main():
    matimo = await Matimo.init('./tools')
    tools = matimo.list_tools()
    print(f"📦 Loaded {len(tools)} tools")

    result = await matimo.execute('calculator', {
        'operation': 'add',
        'a': 10,
        'b': 5,
    })
    print('✅ Result:', result)  # {'result': 15.0}

asyncio.run(main())
```

**3. Run it:**

```bash
python main.py
# or
uv run python main.py
```

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

**[Continue below to create a calculator tool →](#1-installation-1-min)**

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
  const result = await matimo.execute('calculator', {
    operation: 'add',
    a: 10,
    b: 5,
  });

  console.log('✅ Result:', result);
}

main().catch(console.error);
```

## 3. Create Your First Tool (1 min)

Create `tools/calculator/definition.yaml`:

```yaml
name: calculator
description: Perform basic math operations
version: '1.0.0'

parameters:
  operation:
    type: string
    enum: [add, subtract, multiply, divide]
    required: true
    description: Mathematical operation to perform
  a:
    type: number
    required: true
    description: First operand
  b:
    type: number
    required: true
    description: Second operand

execution:
  type: command
  command: node
  args:
    - -e
    - |
      const op = process.argv[1];
      const a = parseFloat(process.argv[2]);
      const b = parseFloat(process.argv[3]);
      const ops = { add: a + b, subtract: a - b, multiply: a * b, divide: a / b };
      console.log(JSON.stringify({ result: ops[op] }));
    - '{operation}'
    - '{a}'
    - '{b}'

output_schema:
  type: object
  properties:
    result:
      type: number
      description: Result of the operation
  required: [result]

error_handling:
  retry: 2
  backoff_type: exponential
  initial_delay_ms: 100
```

## 4. Run It (< 1 min)

```bash
# Compile TypeScript
npx tsc demo.ts

# Run the script
node demo.js

# Output:
# 📦 Loaded 1 tools
# ✅ Result: { result: 15 }
```

---

## What Just Happened?

1. **MatimoInstance.init('./tools')** — Loaded all YAML files from `./tools/**/*.yaml`
2. **matimo.listTools()** — Listed discovered tools
3. **matimo.execute('calculator', {...})** — Executed the tool with parameters
4. Matimo **validated parameters**, **spawned process**, **validated output**, **returned result**

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
├── calculator/
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
const tool = matimo.getTool('calculator');
if (tool) {
  console.log('Parameters:', tool.parameters);
}
```

### Search Tools

```typescript
const results = matimo.searchTools('calculate');
console.log(
  'Found:',
  results.map((t) => t.name)
);
```

### Execute with Error Handling

```typescript
try {
  const result = await matimo.execute('calculator', {
    operation: 'divide',
    a: 10,
    b: 0,
  });
  console.log('Success:', result);
} catch (error) {
  if (error.code === 'TOOL_NOT_FOUND') {
    console.error('Tool not found:', error.message);
  } else if (error.code === 'INVALID_PARAMETERS') {
    console.error('Invalid parameters:', error.details);
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

const matimo = await MatimoInstance.init(['./tools', './node_modules/@matimo/slack/tools']);

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
