# Your First Tool — Step by Step

Execute your first Matimo tool in 5 minutes.

## Prerequisites

- ✅ Matimo installed (`npm install matimo` — see [Installation](./installation.md))
- ✅ Node.js v18+

This guide uses `calculator`, one of the core tools that ship with Matimo.

## Step 1: Initialize Matimo

Create `first-tool.ts`:

```typescript
import { MatimoInstance } from 'matimo';

async function main() {
  // Load Matimo's core tools, plus any @matimo/* provider packages you installed
  const m = await MatimoInstance.init({ autoDiscover: true });

  console.log(`✅ Loaded ${m.listTools().length} tools`);
}

main().catch(console.error);
```

Run it:

```bash
npx tsx first-tool.ts
```

**Output:**

```
✅ Loaded 24 tools
```

(24 core tools; each provider package you install adds its own.)

---

## Step 2: List Available Tools

Update `first-tool.ts`:

```typescript
import { MatimoInstance } from 'matimo';

async function main() {
  const m = await MatimoInstance.init({ autoDiscover: true });

  // List all tools
  const tools = m.listTools();

  console.log('\n📦 Available Tools:\n');
  tools.forEach((tool) => {
    console.log(`  • ${tool.name}`);
    console.log(`    ${tool.description}\n`);
  });
}

main().catch(console.error);
```

**Output:**

```
📦 Available Tools:

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

See [Error Codes](../api-reference/ERRORS.md) for all possible errors.

---

## Next Steps

- **Learn SDK Patterns**: [Factory vs Decorator](../user-guide/SDK_PATTERNS.md)
- **Find More Tools**: [Tool Discovery](../user-guide/TOOL_DISCOVERY.md)
- **Use with LangChain**: [LangChain Integration](../framework-integrations/LANGCHAIN.md)
- **Build Your Own Tools**: [YAML Tool Specification](../tool-development/YAML_TOOLS.md)

---

## Complete Example

```typescript
import { MatimoInstance } from 'matimo';

async function main() {
  // 1. Initialize
  const m = await MatimoInstance.init({ autoDiscover: true });
  console.log(`✅ Loaded ${m.listTools().length} tools\n`);

  // 2. List tools
  const tools = m.listTools();
  console.log('📦 Available tools:');
  tools.forEach((t) => console.log(`  - ${t.name}`));

  // 3. Get tool
  const calc = m.getTool('calculator');
  console.log(`\n🔧 Tool: ${calc.name}`);

  // 4. Execute
  console.log('\n⚙️  Executing calculator...');
  const result = await m.execute('calculator', {
    operation: 'add',
    a: 5,
    b: 3,
  });
  console.log('✅ Result:', result.result);
}

main().catch(console.error);
```

**Output:**

```
✅ Loaded 24 tools

📦 Available tools:
  - calculator
  - convert_to_file
  - edit
  ... (more tools)

🔧 Tool: calculator

⚙️ Executing calculator...
✅ Result: 8
```
