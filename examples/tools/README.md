# Matimo Examples - All Patterns, Providers & Features

**Complete collection of production-ready examples** demonstrating Matimo SDK integration across:
- **Three calling patterns** (LangChain Official, Decorator, Factory)
- **10+ providers** (Slack, Gmail, GitHub, PostgreSQL, Notion, HubSpot, Mailchimp, Twilio, etc.)
- **Core features** (Execute, Read, Edit, Search, Web scraping)
- **Advanced capabilities** (Policy validation, Skills system, Meta-tools, Credentials)

## 🎯 What These Examples Demonstrate

✅ **Framework-Independent Tool Execution:**
- Matimo loads and manages tools independently
- Tools work the same way in any framework (LangChain, CrewAI, etc.)
- No tool redefinition needed across frameworks
- Simple adapter layer for any framework integration

✅ **Three SDK Calling Patterns (Demonstrated Everywhere):**
1. **LangChain Official API** (⭐ Recommended): Use `createAgent()` with `tool()` function
2. **Decorator Pattern**: Use `@tool(toolName)` decorator on methods
3. **Factory Pattern**: Direct `matimo.execute(toolName, params)` calls

✅ **10+ Provider Integrations:**
- Slack, Gmail, GitHub, PostgreSQL, Notion, HubSpot, Mailchimp, Twilio (each with 3 patterns)
- Approval workflows (PostgreSQL, GitHub)

✅ **Core Functionality Examples:**
- Execute system commands
- Read files from disk
- Edit/modify files
- Search code/files
- Web scraping & HTTP requests

✅ **Advanced Features:**
- Meta-tools (tool creation, policy checking, approvals)
- Policy validation & blocking  
- Skills system (define reusable skill components)
- Credentials management
- Human-in-the-loop approval workflows

✅ **Production Ready:**
- Independent npm package setup
- Environment variable management  
- Proper TypeScript configuration
- Clean imports from Matimo SDK

## � Quick Start: Pick Your Path

### Setup (All Examples)
```bash
# 1. Install dependencies
npm install

# 2. Setup environment
cp .env.example .env
echo "OPENAI_API_KEY=sk-your-key-here" >> .env  # From: https://platform.openai.com/api-keys
```

### Choose Your Learning Path

**👉 First time? Start here:**
```bash
npm run agent:langchain      # ⭐ Simplest integration (recommended)
```

**👉 Want to explore all examples?**
```bash
# See QUICK_COMMANDS.md for complete reference (50+ examples)
# Or run batch validation:
cd ..
pnpm validate:all
```

**👉 Want to dive into providers?**
```bash
npm run slack:factory        # Try any provider (factory/decorator/langchain)
npm run gmail:langchain
npm run github:decorator
```

**👉 Want to test core features?**
```bash
npm run execute:factory      # Execute, read, edit, search, web
npm run search:langchain
npm run web:decorator
```

**👉 Want advanced features?**
```bash
npm run meta:flow            # Meta-tools + policy + approvals
pnpm policy:demo
pnpm skills:demo
```

---

## 📋 All Available Examples

For complete reference of all 50+ examples, see [QUICK_COMMANDS.md](./QUICK_COMMANDS.md).

Quick reference:

### Meta/Demo Examples
```bash
npm run meta:flow            # Meta-tools integration (most comprehensive)
pnpm policy:demo             # Policy engine validation
pnpm skills:demo             # Skills system
pnpm credentials:example     # Credentials management
```

### Provider Examples (Pick Pattern)
```bash
# Slack (3 patterns):
npm run slack:factory | npm run slack:decorator | npm run slack:langchain

# Gmail (3 patterns):
npm run gmail:factory | npm run gmail:decorator | npm run gmail:langchain

# GitHub (3 patterns + approval workflow):
npm run github:factory | npm run github:decorator | npm run github:langchain | npm run github:approval

# PostgreSQL (3 patterns + approval workflow):
npm run postgres:factory | npm run postgres:decorator | npm run postgres:langchain | npm run postgres:approval

# Notion, HubSpot, Mailchimp, Twilio (same 3-pattern structure)
```

### Core Functionality Examples (3 patterns each)
```bash
# Execute system commands:
npm run execute:factory | npm run execute:decorator | npm run execute:langchain

# Read files:
npm run read:factory | npm run read:decorator | npm run read:langchain

# Edit files:
npm run edit:factory | npm run edit:decorator | npm run edit:langchain

# Search:
npm run search:factory | npm run search:decorator | npm run search:langchain

# Web scraping:
npm run web:factory | npm run web:decorator | npm run web:langchain
```

### Agent Examples
```bash
npm run agent:factory        # Factory pattern agent
npm run agent:decorator      # Decorator pattern agent
npm run agent:langchain      # LangChain Official API (⭐ recommended)
npm run agent:skills         # LangChain with skills & policy
```

---

## 🌟 Deep Dive: Three Calling Patterns

### 3. Run LangChain Official API Agent (⭐ Recommended)

```bash
npm run agent:langchain
```

**What it does:**

- Loads all tools from YAML using Matimo SDK
- Converts each tool to LangChain's native tool format
- Uses `createAgent()` for automatic tool orchestration
- LLM intelligently selects and executes tools
- Runs 3 example queries with real Matimo execution

**Pattern:**

```
LLM decides tool needed
         ↓
createAgent() invokes tool
         ↓
LangChain tool() wrapper executes
         ↓
Wrapper calls matimo.execute()
         ↓
Matimo executes via CommandExecutor or HttpExecutor
         ↓
Result flows back through LangChain
```

**Why this approach is best:**

- ✅ Minimal code (~100 lines)
- ✅ Pure LangChain API (no workarounds)
- ✅ Automatic schema generation from Zod
- ✅ Framework handles all complexity
- ✅ Matimo tools execute natively
- ✅ Production-ready out of the box

**Example output:**

```
❓ User: "🧮 What is 42 plus 8?"

  🔌 [MATIMO] Executing tool via Matimo SDK: calculator
  📥 [MATIMO] Input parameters: {"operation":"add","a":42,"b":8}
  ✅ [MATIMO] Execution successful

✅ Agent Response:
42 plus 8 equals 50.
```

### 4. Run Decorator Pattern Agent

```bash
npm run agent:decorator
```

**What it does:**

- Loads all tools from YAML using Matimo SDK
- Creates agent with `@tool(toolName)` decorated methods
- Decorator intercepts method calls → executes via Matimo
- Uses **dynamic dispatch** to route tool calls to decorated methods
- No hardcoded routing - scales to any number of tools
- Runs 3 example queries

**Pattern:**

```
LLM decides tool name (string)
         ↓
executeTool(toolName, params)
         ↓
getToolMethodMap() maps name → method name
         ↓
Dynamically call decorated method
         ↓
@tool decorator intercepts
         ↓
Decorator calls matimo.execute()
         ↓
Matimo executes via CommandExecutor or HttpExecutor
         ↓
Result returned to agent
```

**Why this approach is elegant:**

- ✅ Decorated methods define agent's API clearly
- ✅ No if-else routing code (scales automatically)
- ✅ Add 100 tools = just add 100 `@tool()` decorated methods
- ✅ Full type safety with TypeScript
- ✅ Decorator pattern working with real magic
- ✅ Dynamic dispatch handles routing

**Example output:**

```
❓ Prompt: "🧮 What is 42 plus 8?"

🔧 Using tool: calculator
   Parameters: {"operation":"add","a":42,"b":8}

✅ Result: { result: 50 }
```

### 5. Run Factory Pattern Agent

```bash
npm run agent:factory
```

**What it does:**

- Loads all tools from YAML (only those that actually exist)
- Directly calls `matimo.execute(toolName, params)`
- Simple, straightforward execution model
- Adapts to LangChain for agent orchestration
- Runs 3 example queries

**Pattern:**

```
Direct Matimo Call
        ↓
matimo.execute(toolName, params)
        ↓
Registry lookup & execution
        ↓
Result returned to LangChain
```

## 🔀 Patterns Compared

| Aspect                | LangChain Official         | Decorator                            | Factory                  |
| --------------------- | -------------------------- | ------------------------------------ | ------------------------ |
| **Call Style**        | `createAgent()` + `tool()` | `await agent.method()`               | `await matimo.execute()` |
| **Complexity**        | ~100 lines                 | ~200 lines (with dynamic dispatch)   | ~150 lines               |
| **Schema**            | Automatic from Zod         | Inferred from method signature       | Manual mapping           |
| **Tool Binding**      | Native LangChain           | Decorator intercept + reflection     | Direct call              |
| **Scalability**       | ✅ Great                   | ✅ Excellent (no routing code)       | ✅ Great                 |
| **Type Safety**       | ✅ Yes                     | ✅ Yes (full TS support)             | ✅ Yes                   |
| **Best For**          | Framework integration      | Class-based agents                   | Functional style         |
| **Recommended**       | ⭐ **Start here**          | ⭐ **For class apps**                | For direct calls         |
| **Production Ready**  | ✅ Yes                     | ✅ Yes                               | ✅ Yes                   |
| **Works With**        | All providers & features   | All providers & features             | All providers & features |

## 📁 Project Structure

```
examples/tools/
├── agents/                             # Agent examples (3 patterns)
│   ├── langchain-agent.ts              # ⭐ LangChain Official API (recommended)
│   ├── decorator-pattern-agent.ts      # Uses @tool decorator with MatimoInstance
│   ├── factory-pattern-agent.ts        # Uses matimo.execute() with MatimoInstance
│   └── langchain-skills-policy-agent.ts # LangChain with skills & policy
├── slack/                              # Slack provider (3 patterns)
├── gmail/                              # Gmail provider (3 patterns)
├── github/                             # GitHub provider (3 patterns + approval)
├── postgres/                           # PostgreSQL provider (3 patterns + approval)
├── notion/                             # Notion provider (3 patterns)
├── hubspot/                            # HubSpot provider (3 patterns)
├── mailchimp/                          # Mailchimp provider (3 patterns)
├── twilio/                             # Twilio provider (3 patterns)
├── execute/                            # Execute/run commands (3 patterns)
├── read/                               # Read files (3 patterns)
├── edit/                               # Edit files (3 patterns)
├── search/                             # Search files (3 patterns)
├── web/                                # Web scraping (3 patterns)
├── meta-flow/                          # Meta-tools integration demo
├── policy/                             # Policy engine demo
├── skills/                             # Skills system demo
├── credentials/                        # Credentials management
├── package.json                        # Dependencies (LangChain, Matimo, etc.)
├── tsconfig.json                       # TypeScript configuration
├── .env.example                        # Environment template
├── QUICK_COMMANDS.md                   # Complete reference (50+ examples)
└── README.md                           # This file

**Key:** All examples load tools from: `../../tools/` (parent project's tool definitions)
**Pattern:** Each category (provider, feature) has 3 file variants:
- `*-factory.ts` — Use MatimoInstance.execute()
- `*-decorator.ts` — Use @tool() decorators
- `*-langchain.ts` — Use LangChain Official API
```

## 🔄 SDK Patterns Explained

## 🛠️ Converting Matimo Tools to LangChain

### Approach 1: Official LangChain API (⭐ Recommended)

Use LangChain's native `tool()` function with Zod schemas:

```typescript
import { tool } from 'langchain';
import { z } from 'zod';
import { MatimoInstance } from 'matimo';

// 1. Load Matimo tools
const matimo = await MatimoInstance.init('./tools');

// 2. Convert each Matimo tool to LangChain tool
function convertMatimoTool(matimo: MatimoInstance, toolName: string) {
  const matimoTool = matimo.getTool(toolName);

  // Build Zod schema from Matimo parameters
  const schemaShape = {};
  Object.entries(matimoTool.parameters).forEach(([paramName, param]) => {
    let fieldSchema = z.string(); // Map Matimo types to Zod
    if (!param.required) fieldSchema = fieldSchema.optional();
    schemaShape[paramName] = fieldSchema;
  });

  // Create LangChain tool
  return tool(
    async (input) => {
      // Execute via Matimo (the real tool execution)
      const result = await matimo.execute(toolName, input);
      return JSON.stringify(result);
    },
    {
      name: matimoTool.name,
      description: matimoTool.description,
      schema: z.object(schemaShape),
    }
  );
}

// 3. Create agent with tools
const agent = await createAgent({
  model: 'gpt-4o-mini',
  tools: matimoTools.map(t => convertMatimoTool(matimo, t.name)),
});

// 4. Invoke agent
await agent.invoke({
  messages: [{ role: 'user', content: 'What is 42 plus 8?' }],
});
````

**Why this works:**

- ✅ LangChain handles all schema management
- ✅ Automatic parameter validation
- ✅ Native function calling with OpenAI
- ✅ Zero manual schema binding
- ✅ ~10 lines of tool conversion code
- ✅ All Matimo features preserved

### Approach 2: Decorator Pattern

Use Matimo's `@tool()` decorator for method-based calling:

```typescript
import { tool, setGlobalMatimoInstance, MatimoInstance } from 'matimo';

// 1. Load tools from YAML
const matimo = await MatimoInstance.init('./tools');
setGlobalMatimoInstance(matimo);

// 2. Define agent class with decorated methods
class MyAgent {
  // @tool decorator intercepts call and executes via Matimo
  @tool('calculator')
  async calculator(operation: string, a: number, b: number) {
    throw new Error('Decorator handles execution');
  }
}

// 3. Call decorated method
const agent = new MyAgent();
const result = await agent.calculator('add', 5, 3); // Decorator intercepts → Matimo executes
```

### Approach 3: Factory Pattern

Use `MatimoInstance.init()` then direct `execute()` calls:

```typescript
import { MatimoInstance } from 'matimo';

// 1. Initialize Matimo with tools directory
const matimo = await MatimoInstance.init('./tools');

// 2. List all available tools
const tools = matimo.listTools();

// 3. Execute tools directly
const result = await matimo.execute('calculator', {
  operation: 'add',
  a: 5,
  b: 3,
});
```

## 🔄 How It Works: Matimo + LangChain Integration

The beauty of Matimo is that it stays **completely independent**:

```
┌─────────────────────────────────────────────────────────┐
│ LangChain Agent (framework orchestration)                │
│                                                          │
│  LLM decides: "I need to use calculator tool"            │
│      ↓                                                   │
│  createAgent() invokes tool with user's params           │
│      ↓                                                   │
│  LangChain tool() wrapper receives params                │
│      ↓                                                   │
│  ┌──────────────────────────────────────────────────┐   │
│  │ Matimo Wrapper Function                          │   │
│  │                                                  │   │
│  │  const result = await matimo.execute(            │   │
│  │    'calculator',                                 │   │
│  │    { operation: 'add', a: 42, b: 8 }             │   │
│  │  );                                              │   │
│  │      ↓                                           │   │
│  │  Matimo loads: tools/calculator.yaml             │   │
│  │  Validates params against schema                 │   │
│  │  Executes: node calculator.js --op add 42 8      │   │
│  │  Parses output                                   │   │
│  │      ↓                                           │   │
│  │  Returns: { result: 50 }                         │   │
│  └──────────────────────────────────────────────────┘   │
│      ↓                                                   │
│  Wrapper returns JSON to LangChain                       │
│      ↓                                                   │
│  LLM processes result: "42 + 8 = 50"                     │
└─────────────────────────────────────────────────────────┘
```

**Key insight:** LangChain orchestrates tool selection, Matimo executes the tool.

- ✅ Matimo tools work the same in any framework
- ✅ No framework-specific tool reimplementation
- ✅ Add tool to `tools/*.yaml`, it appears everywhere
- ✅ Changes to tool YAML automatically reflect in all frameworks

## ✅ Verification: Matimo Executes, Not LangChain

When you run `npm run agent:langchain`, you'll see debug output confirming **Matimo is executing**:

```
❓ User: "🧮 What is 42 plus 8?"

  🔌 [MATIMO] Executing tool via Matimo SDK: calculator
  📥 [MATIMO] Input parameters: {"operation":"add","a":42,"b":8}
  ✅ [MATIMO] Execution successful

✅ Agent Response:
42 plus 8 equals 50.
```

This proves:

1. ✅ LangChain selected the `calculator` tool
2. ✅ LangChain called the tool wrapper
3. ✅ **Matimo executed the actual tool** (via CommandExecutor)
4. ✅ Result flowed back through both frameworks

Not a LangChain tool—a **Matimo tool executed through LangChain's orchestration**.

## 🔑 Key Principles

### "Define Tools ONCE, Use EVERYWHERE" - The Matimo Philosophy

Tools are defined in `../../tools/*.yaml` **ONCE**:

```yaml
# tools/calculator.yaml
name: calculator
description: Perform math operations
parameters:
  operation:
    type: string
    enum: [add, subtract, multiply, divide]
  a:
    type: number
  b:
    type: number
execution:
  type: command
  command: node calculator.js
  args: ['--op', '{operation}', '{a}', '{b}']
```

These same tools are used in:

- ✅ This example: **LangChain agents** (via both patterns)
- ✅ **Matimo SDK direct**: `await matimo.execute('calculator', params)`
- ✅ **MCP Server**: Claude can call them natively
- ✅ **REST API**: HTTP endpoints (Phase 2)
- ✅ **CLI**: Command-line tool runner
- ✅ **CrewAI, LlamaIndex, etc.**: Framework integration

**No duplication. No reimplementation. Pure reusability.**

Both this example's agents use the exact same YAML tools - just different calling patterns.

## 🚀 Available Tools

These examples work with whatever tools are in `../../tools/`:

| Tool         | Type    | Purpose                                           |
| ------------ | ------- | ------------------------------------------------- |
| `calculator` | Command | Math operations (add, subtract, multiply, divide) |
| `echo`       | Command | Echo messages back                                |
| `http`       | HTTP    | Make HTTP requests (GET, POST, etc.)              |

**Framework Independence:** Add any tool to `../../tools/` and it automatically appears in all three agents. No code changes needed.

(See parent project's `tools/` directory for all available tools)

## 🧪 Testing

All agents are fully testable. The parent project's test suite validates all tools:

```bash
# From parent project root
pnpm test test/integration/
```

## 🐛 Troubleshooting

### "Cannot find module 'matimo'"

**Solution:** Make sure parent project is built:

```bash
cd ../..
pnpm build
cd examples/tools
### "OPENAI_API_KEY is not set"

**Solution:** Create `.env` with your API key:

```bash
cp .env.example .env
# Edit .env and add your OpenAI API key
```

### LangChain package errors

**Solution:** Reinstall all dependencies:

```bash
rm -rf node_modules package-lock.json
npm install
```

### Tools not executing

**Solution:** Ensure parent project tools are compiled:

```bash
cd ../..
pnpm build
cd examples/tools
npm run agent:langchain   # or agent:decorator, agent:factory
```

## 📚 Next Steps

### Beginner
1. **Run all three agent patterns** — compare approaches: `npm run agent:langchain`, `agent:decorator`, `agent:factory`
2. **Try a provider** — pick Slack/Gmail/GitHub: `npm run slack:factory`, `npm run github:langchain`, etc.
3. **Test core features** — execute, read, edit: `npm run execute:factory`, `npm run read:langchain`, etc.

### Intermediate
4. **Modify example prompts** — edit `agents/*.ts` or provider files to change queries
5. **Add custom tools** — create `../../tools/custom-tool/definition.yaml`, they auto-appear in all examples
6. **Extend agents** — add memory, streaming, custom system prompts, better error handling

### Advanced
7. **Use advanced features** — try `npm run meta:flow` (meta-tools), `pnpm policy:demo` (validation), `pnpm skills:demo` (reusable skills)
8. **Implement approvals** — try PostgreSQL/GitHub approval workflows: `npm run postgres:approval`, `npm run github:approval`
9. **Deploy to production** — use Matimo REST API (Phase 2) or MCP server for Claude integration

## 🔗 Related Documentation

- [Matimo API Reference](../../docs/api-reference/SDK.md)
- [Tool Specification](../../docs/tool-development/TOOL_SPECIFICATION.md)
- [Decorator Guide](../../docs/tool-development/DECORATOR_GUIDE.md)
- [LangChain Documentation](https://docs.langchain.com/)
- [OpenAI API](https://platform.openai.com/docs/)

## 💡 Key Takeaway

These examples prove Matimo's core value proposition:

**Define tools ONCE in YAML** ↓  
**Use them with THREE calling patterns** (LangChain, Decorator, Factory) ↓  
**Use them with TEN+ providers** (Slack, Gmail, GitHub, PostgreSQL, Notion, HubSpot, Mailchimp, Twilio, etc.) ↓  
**Use them with FIVE core features** (Execute, Read, Edit, Search, Web) ↓  
**Use them with advanced capabilities** (Meta-tools, Policy, Skills, Approvals) ↓  
**Use them EVERYWHERE**: LangChain, SDK, CrewAI, MCP, REST API, CLI ↓  

**Zero duplication. Pure productivity.**

All examples use the exact same Matimo tools with different patterns, providers, and frameworks. **That's the Matimo difference.**

---

### 📖 For Complete Reference

See [QUICK_COMMANDS.md](./QUICK_COMMANDS.md) for:
- All 50+ example commands organized by category
- Complete provider list with all three patterns
- Core functionality examples (execute, read, edit, search, web)
- Meta/demo examples (meta-tools, policy, skills, credentials)
- Validation & testing commands
