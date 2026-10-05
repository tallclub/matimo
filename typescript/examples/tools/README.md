# Matimo Examples - All Patterns, Providers & Features

**Complete collection of production-ready examples** demonstrating Matimo SDK integration across:
- **Three calling patterns** (LangChain Official, Decorator, Factory)
- **10+ providers** (Slack, Gmail, GitHub, PostgreSQL, Notion, HubSpot, Mailchimp, Twilio, etc.)
- **Core features** (Execute, Read, Edit, Search, Web scraping)
- **Advanced capabilities** (Policy validation, Skills system, Meta-tools, Credentials)

## 🎯 What These Examples Demonstrate

✅ **Bruno CLI API Testing (New):**
- 7 tools for full API collection lifecycle management
- Complete + LangChain agent examples - no API key required for complete workflow
- Integrates with any existing Bruno collection

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

## 🚀 Quick Start: Pick Your Path

### Setup (All Examples)
```bash
# 1. Install dependencies
pnpm install

# 2. Setup environment
cp .env.example .env
echo "OPENAI_API_KEY=sk-your-key-here" >> .env  # From: https://platform.openai.com/api-keys
```

### Choose Your Learning Path

**👉 First time? Start here:**
```bash
pnpm agent:langchain      # ⭐ Simplest integration (recommended)
```

**👉 Want to explore all examples?**
```bash
# See QUICK_COMMANDS.md for complete reference (50+ examples)
# Or run batch validation:
pnpm validate:all
```

**👉 Want to dive into providers?**
```bash
pnpm slack:factory        # Try any provider (factory/decorator/langchain)
pnpm gmail:langchain
pnpm github:decorator
```

**👉 Want to test core features?**
```bash
pnpm execute:factory      # Execute, read, edit, search, web
pnpm search:langchain
pnpm web:decorator
```

**👉 Want to test API collections with Bruno?**
```bash
pnpm bruno:complete       # 7 tools × 6 workflows (no API key needed)
pnpm bruno:langchain      # LangChain agent driving Bruno tools (needs OPENAI_API_KEY)
```

**👉 Want advanced features?**
```bash
pnpm meta:flow            # Meta-tools + policy + approvals
pnpm policy:demo
pnpm skills:demo

# No API key or LLM needed:
pnpm policy:approval-modes   # Who approves what: callbacks, governance modes, HITL threshold
pnpm policy:audit            # Execution events + hash-chained JSONL audit log
pnpm policy:response-size    # Response-size guardrail
pnpm skills:registry         # registerSkill, addSkillPath, buildSkillPromptContext, skill:created
```

---

## 📋 All Available Examples

For complete reference of all 50+ examples, see [QUICK_COMMANDS.md](./QUICK_COMMANDS.md).

Quick reference:

### Bruno CLI API Testing
```bash
pnpm bruno:complete       # Complete workflow - 7 tools × 6 workflows (no API key needed)
pnpm bruno:langchain      # LangChain agent driving Bruno tools autonomously
```

Covers: `bruno_create_collection`, `bruno_add_request`, `bruno_get_collection_info`, `bruno_run_collection`, `bruno_run_request`, `bruno_list_collections`, `bruno_import_openapi`

### Meta/Demo Examples
```bash
pnpm meta:flow            # Meta-tools integration (most comprehensive)
pnpm policy:demo             # Policy engine validation
pnpm policy:approval-modes   # Approval triggers, callbacks, governance modes (no API key)
pnpm policy:audit            # Execution events + audit log (no API key)
pnpm policy:response-size    # Response-size guardrail (no API key)
pnpm skills:demo             # Skills system
pnpm skills:registry         # Skills from anywhere (no API key)
pnpm credentials:example     # Credentials management
```

### Provider Examples (Pick Pattern)
```bash
# Slack (3 patterns):
pnpm slack:factory | pnpm slack:decorator | pnpm slack:langchain

# Gmail (3 patterns):
pnpm gmail:factory | pnpm gmail:decorator | pnpm gmail:langchain

# GitHub (3 patterns + approval workflow):
pnpm github:factory | pnpm github:decorator | pnpm github:langchain | pnpm github:approval

# PostgreSQL (3 patterns + approval workflow):
pnpm postgres:factory | pnpm postgres:decorator | pnpm postgres:langchain | pnpm postgres:approval

# Notion, HubSpot, Mailchimp, Twilio (same 3-pattern structure)
```

### Core Functionality Examples (3 patterns each)
```bash
# Execute system commands:
pnpm execute:factory | pnpm execute:decorator | pnpm execute:langchain

# Read files:
pnpm read:factory | pnpm read:decorator | pnpm read:langchain

# Edit files:
pnpm edit:factory | pnpm edit:decorator | pnpm edit:langchain

# Search:
pnpm search:factory | pnpm search:decorator | pnpm search:langchain

# Web scraping:
pnpm web:factory | pnpm web:decorator | pnpm web:langchain
```

### Agent Examples
```bash
pnpm agent:factory        # Factory pattern agent
pnpm agent:decorator      # Decorator pattern agent
pnpm agent:langchain      # LangChain Official API (⭐ recommended)
pnpm agent:skills-policy  # LangChain with skills & policy
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
├── bruno/                              # Bruno CLI API testing
│   ├── bruno-complete-workflow.ts      # 7 tools × 6 workflows (no API key)
│   └── bruno-langchain-agent.ts        # LangChain agent driving Bruno tools
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
├── policy/                             # Policy engine demo, approval modes, audit log, response size
├── skills/                             # Skills system demo, skills registry
├── credentials/                        # Credentials management
├── package.json                        # Dependencies (LangChain, Matimo, etc.)
├── tsconfig.json                       # TypeScript configuration
├── .env.example                        # Environment template
├── QUICK_COMMANDS.md                   # Complete reference (50+ examples)
└── README.md                           # This file

**Key:** The examples load tools with `autoDiscover: true`: the core tools plus the `@matimo/*` packages in `package.json`.
**Pattern:** Each category (provider, feature) has 3 file variants:
- `*-factory.ts` - Use MatimoInstance.execute()
- `*-decorator.ts` - Use @tool() decorators
- `*-langchain.ts` - Use LangChain Official API
```

## 🔄 SDK Patterns Explained

## 🛠️ Converting Matimo Tools to LangChain

### Approach 1: `convertToolsToLangChain` (⭐ Recommended)

```typescript
import { createAgent } from 'langchain';
import { ChatOpenAI } from '@langchain/openai';
import { MatimoInstance, convertToolsToLangChain } from '@matimo/core';

// 1. Load Matimo tools (built-ins + installed @matimo/* packages)
const matimo = await MatimoInstance.init({ autoDiscover: true });

// 2. Convert the tools the agent needs; each call still goes through matimo.execute()
const tools = await convertToolsToLangChain([matimo.getTool('calculator')!], matimo);

// 3. Create the agent
const agent = createAgent({ model: new ChatOpenAI({ model: 'gpt-4o-mini' }), tools });

// 4. Invoke it
await agent.invoke({ messages: [{ role: 'user', content: 'What is 42 plus 8?' }] });
```

The helper builds each tool's Zod schema from its YAML parameters, hides secret-looking parameters from the model (pass their values as the third argument), and returns `"Error: …"` text to the model when a call fails.

### Approach 2: Decorator Pattern

Use Matimo's `@tool()` decorator for method-based calling:

```typescript
import { tool, setGlobalMatimoInstance, MatimoInstance } from '@matimo/core';

// 1. Load tools
const matimo = await MatimoInstance.init({ autoDiscover: true });
setGlobalMatimoInstance(matimo);

// 2. Define a class with decorated methods
class MyAgent {
  // Arguments map to the YAML parameters in order; the body never runs
  @tool('calculator')
  async calculator(operation: string, a: number, b: number) {}
}

// 3. Call the decorated method
const result = await new MyAgent().calculator('add', 5, 3); // → matimo.execute('calculator', …)
```

### Approach 3: Factory Pattern

Use `MatimoInstance.init()` then direct `execute()` calls:

```typescript
import { MatimoInstance } from '@matimo/core';

// 1. Initialize Matimo
const matimo = await MatimoInstance.init({ autoDiscover: true });

// 2. List all available tools
const tools = matimo.listTools();

// 3. Execute tools directly
const result = await matimo.execute('calculator', { operation: 'add', a: 5, b: 3 });
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
│  │  Policy check + approval (if the tool needs it)  │   │
│  │  Executes the calculator function tool           │   │
│  │  Emits tool:executed for the audit log           │   │
│  │                                                  │   │
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
- ✅ Add a tool's `definition.yaml`, it appears everywhere
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
3. ✅ **Matimo executed the actual tool** (via FunctionExecutor)
4. ✅ Result flowed back through both frameworks

Not a LangChain tool - a **Matimo tool executed through LangChain's orchestration**.

## 🔑 Key Principles

### "Define Tools ONCE, Use EVERYWHERE" - The Matimo Philosophy

Each tool is one `definition.yaml`, e.g. `typescript/packages/core/tools/calculator/definition.yaml` (a `type: function` tool with `calculator.ts` beside it) or `typescript/packages/github/tools/get-repository/definition.yaml` (a `type: http` tool).

These same tools are used in:

- ✅ This example: **LangChain agents** (via both patterns)
- ✅ **Matimo SDK direct**: `await matimo.execute('calculator', params)`
- ✅ **MCP Server**: Claude can call them natively
- ✅ **MCP over HTTP**: `createMCPServer({ transport: 'http' })`
- ✅ **CLI**: Command-line tool runner
- ✅ **Python**: the same YAML in `matimo` (LangChain, CrewAI, Agno)

**No duplication. No reimplementation. Pure reusability.**

Both this example's agents use the exact same YAML tools - just different calling patterns.

## 🚀 Available Tools

With `autoDiscover: true` the examples see the core tools (`calculator`, `read`, `edit`, `search`, `execute`, `web`, `web_scraper`, `extract_from_file`, `convert_to_file`, and the `matimo_*` meta-tools) plus every `@matimo/*` package in `package.json`. List them with `matimo.listTools()`.

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
1. **Run all three agent patterns** - compare approaches: `npm run agent:langchain`, `agent:decorator`, `agent:factory`
2. **Try Bruno API testing** - no API key needed: `pnpm bruno:complete`
3. **Try a provider** - pick Slack/Gmail/GitHub: `npm run slack:factory`, `npm run github:langchain`, etc.
4. **Test core features** - execute, read, edit: `npm run execute:factory`, `npm run read:langchain`, etc.

### Intermediate
4. **Modify example prompts** - edit `agents/*.ts` or provider files to change queries
5. **Add custom tools** - put `my-tool/definition.yaml` in a directory and pass it in `toolPaths`
6. **Extend agents** - add memory, streaming, custom system prompts, better error handling

### Advanced
7. **Use advanced features** - try `npm run meta:flow` (meta-tools), `pnpm policy:demo` (validation), `pnpm skills:demo` (reusable skills)
8. **Implement approvals** - try PostgreSQL/GitHub approval workflows: `npm run postgres:approval`, `npm run github:approval`
9. **Deploy** - serve the tools over MCP (`npx matimo mcp`, see [MCP.md](../../../docs/MCP.md)) or call them from your own service

## 🔗 Related Documentation

- [Matimo API Reference](../../../docs/api-reference/SDK.md)
- [Tool Specification](../../../docs/tool-development/TOOL_SPECIFICATION.md)
- [Decorator Guide](../../../docs/tool-development/DECORATOR_GUIDE.md)
- [LangChain Documentation](https://docs.langchain.com/)
- [OpenAI API](https://platform.openai.com/docs/)

## 💡 Key Takeaway

These examples prove Matimo's core value proposition:

**Define tools ONCE in YAML** ↓  
**Use them with THREE calling patterns** (LangChain, Decorator, Factory) ↓  
**Use them with TEN+ providers** (Slack, Gmail, GitHub, PostgreSQL, Notion, HubSpot, Mailchimp, Twilio, etc.) ↓  
**Use them with FIVE core features** (Execute, Read, Edit, Search, Web) ↓  
**Use them for API testing** (Bruno CLI - create, run, import, inspect collections) ↓  
**Use them with advanced capabilities** (Meta-tools, Policy, Skills, Approvals) ↓  
**Use them EVERYWHERE**: LangChain, SDK, CrewAI, Agno, MCP, CLI ↓  

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
