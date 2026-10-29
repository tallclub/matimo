---
title: "Your First Tool: Step by Step"
---
Execute your first Matimo tool in 5 minutes.

## Prerequisites

- Matimo installed, see [Installation](/docs/getting-started/installation/):
  - **TypeScript**: `npm install matimo` and Node.js v22.19+
  - **Python**: `pip install matimo` and Python 3.11+

Every step shows both SDKs. Pick one and follow it through.

This guide uses `calculator`, one of the core tools that ship with Matimo.

## Step 1: Initialize Matimo

### TypeScript

Create `first-tool.ts`:

```typescript
import { MatimoInstance } from 'matimo';

async function main() {
  // Load Matimo's core tools, plus any @matimo/* provider packages you installed
  const m = await MatimoInstance.init({ autoDiscover: true });

  console.log(`Loaded ${m.listTools().length} tools`);
}

main().catch(console.error);
```

Run it:

```bash
npx tsx first-tool.ts
```

**Output:**

```
Loaded 24 tools
```

(24 core tools; each provider package you install adds its own.)

### Python

Create `first_tool.py`:

```python
import asyncio
from matimo import Matimo

async def main():
    # Load Matimo's core tools, plus any matimo-* provider packages you installed
    m = await Matimo.init(auto_discover=True)

    print(f"Loaded {len(m.list_tools())} tools")

asyncio.run(main())
```

Run it with `python first_tool.py`. You get the 24 core tools plus the tools of every `matimo-*` provider package installed in that environment (a plain `pip install matimo` prints `Loaded 24 tools`). On first run Matimo also logs a `MATIMO_APPROVAL_SECRET` warning, explained in [Quick Start](/docs/getting-started/quick-start/#the-matimo_approval_secret-warning).

---

## Step 2: List Available Tools

**TypeScript**: update `first-tool.ts`:

```typescript
import { MatimoInstance } from 'matimo';

async function main() {
  const m = await MatimoInstance.init({ autoDiscover: true });

  // List all tools
  const tools = m.listTools();

  console.log('\nAvailable Tools:\n');
  tools.forEach((tool) => {
    console.log(`  • ${tool.name}`);
    console.log(`    ${tool.description}\n`);
  });
}

main().catch(console.error);
```

**Python**: update `first_tool.py`:

```python
import asyncio
from matimo import Matimo

async def main():
    m = await Matimo.init(auto_discover=True)

    print("
Available Tools:
")
    for tool in m.list_tools():
        print(f"  - {tool.name}")
        print(f"    {tool.description}
")

asyncio.run(main())
```

**Output:**

```
Available Tools:

  • calculator
    Perform arithmetic operations. Two mutually exclusive modes are supported: ...

  • convert_to_file
    Convert structured content between JSON, CSV, Markdown, and plain text ...

  ... (more tools)
```

---

## Step 3: Get Tool Details

```typescript
const tool = m.getTool('calculator');

console.log(`Tool: ${tool.name}`);
console.log(`Description: ${tool.description}`);
console.log(`Parameters:`, tool.parameters);
```

```python
tool = m.get_tool("calculator")

print(f"Tool: {tool.name}")
print(f"Description: {tool.description}")
print("Parameters:", list(tool.parameters))  # operation, a, b, expression, precision
```

**Output:**

```
Tool: calculator
Description: Perform arithmetic operations. Two mutually exclusive modes are supported: ...
Parameters: {
  operation: { type: 'string', enum: [...], ... },
  a: { type: 'number', ... },
  b: { type: 'number', ... },
  expression: { type: 'string', ... },
  precision: { type: 'number', ... }
}
```

---

## Step 4: Execute a Tool

```typescript
const result = await m.execute('calculator', {
  operation: 'add',
  a: 5,
  b: 3,
});

console.log('Result:', result);
// Output: Result: { result: 8, operation: 'add', original_operation: 'add', operands: { a: 5, b: 3 } }
```

```python
result = await m.execute("calculator", {"operation": "add", "a": 5, "b": 3})

print("Result:", result)
# Result: {'result': 8.0, 'operation': 'add', 'original_operation': 'add', 'operands': {'a': 5.0, 'b': 3.0}}
```

### Execute Different Operations

```typescript
// Add
const add = await m.execute('calculator', { operation: 'add', a: 10, b: 5 });
console.log('10 + 5 =', add.result); // 15

// Subtract
const sub = await m.execute('calculator', { operation: 'subtract', a: 10, b: 5 });
console.log('10 - 5 =', sub.result); // 5

// Multiply
const mul = await m.execute('calculator', { operation: 'multiply', a: 10, b: 5 });
console.log('10 * 5 =', mul.result); // 50

// Divide
const div = await m.execute('calculator', { operation: 'divide', a: 10, b: 5 });
console.log('10 / 5 =', div.result); // 2
```

```python
for op in ("add", "subtract", "multiply", "divide"):
    r = await m.execute("calculator", {"operation": op, "a": 10, "b": 5})
    print(f"10 {op} 5 =", r["result"])  # 15.0, 5.0, 50.0, 2.0
```

---

## Step 5: Handle Errors

A tool can report a failure in its result, or Matimo can throw:

```typescript
// The calculator reports division by zero in its result
const div0 = await m.execute('calculator', { operation: 'divide', a: 10, b: 0 });
// { success: false, error: 'Division by zero', code: 'EXECUTION_FAILED', details: { a: 10, b: 0 } }

// Matimo throws a MatimoError for unknown tools, bad parameters, policy refusals, ...
try {
  await m.execute('no_such_tool', {});
} catch (error) {
  if (error.code === 'TOOL_NOT_FOUND') {
    console.error('Tool not found:', error.message);
  } else if (error.code === 'INVALID_PARAMETER') {
    console.error('Invalid parameters:', error.details);
  } else {
    console.error('Error:', error.code, error.message);
  }
}
```

```python
from matimo import MatimoError

# Python raises on a tool failure, including division by zero
try:
    await m.execute("calculator", {"operation": "divide", "a": 10, "b": 0})
except MatimoError as error:
    print(error.code)  # EXECUTION_FAILED

# Unknown tools, bad parameters and policy refusals raise too
try:
    await m.execute("no_such_tool", {})
except MatimoError as error:
    if error.code == "TOOL_NOT_FOUND":
        print("Tool not found:", error)
    elif error.code == "INVALID_PARAMETER":
        print("Invalid parameters:", error.details)
    else:
        print("Error:", error.code, error)
```

The two SDKs differ here: TypeScript returns `{ success: false, ... }` when the calculator hits a division by zero, while Python raises `MatimoError`. See [Error Codes](/docs/api-reference/errors/) for all possible errors.

---

## Next Steps

- **Learn SDK Patterns**: [Factory vs Decorator](/docs/user-guide/sdk-patterns/)
- **Find More Tools**: [Tool Discovery](/docs/user-guide/tool-discovery/)
- **Use with LangChain**: [LangChain Integration](/docs/framework-integrations/langchain/)
- **Build Your Own Tools**: [YAML Tool Specification](/docs/tool-development/yaml-tools/)

---

## Complete Example

### TypeScript

```typescript
import { MatimoInstance } from 'matimo';

async function main() {
  // 1. Initialize
  const m = await MatimoInstance.init({ autoDiscover: true });
  console.log(`Loaded ${m.listTools().length} tools\n`);

  // 2. List tools
  const tools = m.listTools();
  console.log('Available tools:');
  tools.forEach((t) => console.log(`  - ${t.name}`));

  // 3. Get tool
  const calc = m.getTool('calculator');
  console.log(`\nTool: ${calc.name}`);

  // 4. Execute
  console.log('\nExecuting calculator...');
  const result = await m.execute('calculator', {
    operation: 'add',
    a: 5,
    b: 3,
  });
  console.log('Result:', result.result);
}

main().catch(console.error);
```

**Output:**

```
Loaded 24 tools

Available tools:
  - calculator
  - convert_to_file
  - edit
  ... (more tools)

Tool: calculator

Executing calculator...
Result: 8
```

### Python

```python
import asyncio
from matimo import Matimo

async def main():
    # 1. Initialize
    m = await Matimo.init(auto_discover=True)
    print(f"Loaded {len(m.list_tools())} tools
")

    # 2. List tools
    print("Available tools:")
    for t in m.list_tools():
        print(f"  - {t.name}")

    # 3. Get tool
    calc = m.get_tool("calculator")
    print(f"
Tool: {calc.name}")

    # 4. Execute
    print("
Executing calculator...")
    result = await m.execute("calculator", {"operation": "add", "a": 5, "b": 3})
    print("Result:", result["result"])  # 8.0

asyncio.run(main())
```
