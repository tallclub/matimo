# Matimo Examples

<p align="center">
  <a href="https://discord.gg/3JPt4mxWDV"><img src="https://img.shields.io/badge/Discord-Join%20Chat-5865F2?style=for-the-badge&logo=discord&logoColor=white" alt="Discord"></a>
</p>

Production-ready examples showcasing **three core integration patterns**:

> **"Define tools ONCE in YAML, use them EVERYWHERE"**

---

## Quick Start

```bash
cd matimo
pnpm install && pnpm build    # Build all packages
cd examples/tools
pnpm install                   # Install example dependencies

# Run any example
pnpm slack:factory             # 1️⃣ Factory pattern
pnpm slack:decorator           # 2️⃣ Decorator pattern  
pnpm slack:langchain           # 3️⃣ LangChain integration

# Policy/Skills/Meta-Tools validation (advanced)
pnpm meta:flow                 # Complete tool lifecycle
printf "y\ny\ny\n" | npx tsx policy/policy-demo.ts   # Policy validation
printf "y\ny\n" | npx tsx skills/skills-demo.ts      # Skills system
```

**Required Environment:**
- Node.js 18+
- `.env` file with API tokens (see `.env.example`)

---

## 1️⃣ Factory Pattern — Direct SDK Usage

**Best for:** Scripts, APIs, backends, microservices | **Simplicity:** ⭐⭐⭐⭐⭐

Load tools once, execute by name.

```typescript
import { MatimoInstance } from 'matimo';

const matimo = await MatimoInstance.init('./tools');
const result = await matimo.execute('slack-send-message', {
  channel: '#general',
  text: 'Hello from Matimo!',
});
```

**Files:**
- [Factory Pattern - Full Example](./tools/factory-pattern-agent.ts)
- [Slack Factory](./tools/slack/slack-factory.ts)
- [Gmail Factory](./tools/gmail/gmail-factory.ts)
- [Postgres Factory](./tools/postgres/postgres-factory.ts)

**Real-World Use Cases:** Express.js endpoints | AWS Lambda | Cron jobs | Webhooks | CLI tools

---

## 2️⃣ Decorator Pattern — Class-Based

**Best for:** Object-oriented apps, clean architecture | **Simplicity:** ⭐⭐⭐⭐

Use `@tool` decorators as class methods.

```typescript
import { MatimoInstance, setGlobalMatimoInstance, tool } from 'matimo';
const matimo = await MatimoInstance.init('./tools');
setGlobalMatimoInstance(matimo);

class SlackBot {
  @tool('slack-send-message')
  async sendMessage(channel: string, text: string) {}
  
  @tool('slack-list-channels')
  async listChannels() {}
}

const bot = new SlackBot();
await bot.sendMessage('#general', 'Hello!');
```

**Files:**
- [Decorator Pattern - Full Example](./tools/agents/decorator-pattern-agent.ts)
- [Slack Decorator](./tools/agents/slack-decorator.ts)
- [Gmail Decorator](./tools/agents/gmail-decorator.ts)
- [Postgres Decorator](./tools/agents/postgres-decorator.ts)

**Real-World Use Cases:** Class-based agents | NestJS services | Dependency injection | Microservices

---

## 3️⃣ LangChain Integration — AI Agents

**Best for:** AI automation, natural language | **Simplicity:** ⭐⭐⭐

Let LLMs decide which tools to use.

```typescript
import { MatimoInstance, convertToolsToLangChain } from 'matimo';
import { ChatOpenAI } from '@langchain/openai';

// 1. Initialize Matimo
const matimo = await MatimoInstance.init('./tools');

// 2. Convert to LangChain format
const langchainTools = await convertToolsToLangChain(
  matimo.listTools(),
  matimo
);

// 3. Create LLM with tools bound
const llm = new ChatOpenAI({ model: 'gpt-4o-mini', temperature: 0 });
const llmWithTools = llm.bindTools(langchainTools);

// 4. Run agent with natural language goal
const messages = [
  { role: 'user', content: 'Send a message to #general saying hello' },
];
const result = await llmWithTools.invoke(messages);
```

**Files:**
- [LangChain Integration - Full Example](./tools/agents/langchain-agent.ts)
- [Slack LangChain](./tools/slack/slack-langchain.ts)
- [Gmail LangChain](./tools/gmail/gmail-langchain.ts)
- [Postgres LangChain](./tools/postgres/postgres-langchain.ts)

**Real-World Use Cases:** AI chatbots | Autonomous agents | Natural language interfaces | Multi-step workflows

---

## Pattern Comparison

| Feature | Factory | Decorator | LangChain |
|---------|---------|-----------|-----------|
| **Simplicity** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| **Best For** | Scripts, APIs | Classes | AI agents |
| **Learning Curve** | 5 min | 10 min | 15 min |
| **Type Safety** | Good | Excellent | Excellent |
| **Framework Required** | None | None | LangChain |

Choose **Factory** if you just want to execute tools. Choose **Decorator** if building class-based apps. Choose **LangChain** if you want AI-powered automation.

---

## Available Tools by Service

### Slack Tools
- `slack-send-message` — Send messages to channels
- `slack-list-channels` — List all channels
- `slack_get_channel_history` — Get message history
- `slack_add_reaction` — Add emoji reactions
- `slack_get_user_info` — Get user profiles
- `slack_send_dm` — Send direct messages

### Gmail Tools
- `gmail-send-email` — Send emails
- `gmail-list-messages` — List messages
- `gmail-get-message` — Get message details
- `gmail-create-draft` — Create drafts

### Postgres Tools
- `postgres-execute-sql` — Execute SQL queries with safety approval
  - ✅ `SELECT` / `INSERT` — Auto-allowed
  - 🔒 `UPDATE` / `DELETE` / `CREATE` — Requires approval
  - Use `pnpm postgres:approval` to see interactive approval flow

### Utility Tools
- `calculator` — Math operations
- `echo-tool` — Echo for testing

---

## Advanced Examples: Policy & Skills

### Policy Engine Validation

The policy system prevents dangerous tools from being created or executed.

```bash
# See agent learn policy boundaries
printf "y\ny\ny\ny\ny\n" | npx tsx policy/policy-demo.ts

# What it validates:
✅ Safe HTTP tools pass
❌ Shell commands blocked
❌ SSRF attacks blocked
❌ Namespace hijacking blocked
✅ Human approves risky tools
```

**File:** [Policy Demo](./tools/policy/policy-demo.ts)

**What it teaches:**
- Policy blocks dangerous patterns in real-time
- Agent learns from rejections and retries safely
- Human-in-the-loop approval for risky operations
- Complete audit trail of all decisions

---

### Skills System Validation

The skills system lets agents discover and apply instructional guides (SKILL.md files).

```bash
# See agent create and use skills
printf "y\ny\ny\n" | npx tsx skills/skills-demo.ts

# What it shows:
✓ Create skills with YAML frontmatter
✓ Discover available skills
✓ Read and apply skill guidelines
✓ Validate against spec
✓ Use multiple skills together
```

**File:** [Skills Demo](./tools/skills/skills-demo.ts)

**What it teaches:**
- Progressive disclosure: list → read → apply
- Skill creation with proper YAML structure
- Spec validation and compliance
- Multi-skill agent reasoning

---

### Meta-Tools & Complete Lifecycle

The most comprehensive example showing tool creation → validation → approval → execution.

```bash
# Complete workflow with human approval
printf "y\ny\ny\ny\ny\ny\n" | npx tsx meta-flow/meta-tools-integration.ts

# What it demonstrates:
Step 1: Create HTTP tool (passes validation)
Step 2: Attempt shell command (policy blocks)
Step 3: Attempt SSRF attack (blocked)
Step 4: Human approves safe tool
Step 5: Registry reloads with new tool
Step 6: Execute newly approved tool
```

**File:** [Meta-Tools Integration](./tools/meta-flow/meta-tools-integration.ts)

**What it teaches:**
- Real agent autonomy (discovers tools by description)
- Policy enforcement in real-time
- Human approval workflow (interactive prompts)
- Complete tool lifecycle
- Agent learning from policy rejections

---

## Advanced: Postgres Approval Flow

Postgres examples enforce safety by requiring approval for destructive operations.

```bash
# Interactive approval demo
pnpm postgres:approval
```

**Workflow:**
```
Step 1: Discover tables (SELECT - auto-allowed)
Step 2: Analyze structure (SELECT - auto-allowed)
Step 3: Execute DELETE/UPDATE/CREATE (requires approval)
  → Terminal prompt: "Do you approve? (yes/no): "
  → When approved, tool executes
```

**Approval Rules:**
| Operation | Status | Requires Approval? |
|-----------|--------|-------------------|
| SELECT | ✅ Safe | No |
| INSERT | ⚠️ Modifies | No |
| UPDATE / DELETE | 🔴 Dangerous | **Yes** |
| CREATE / DROP / ALTER | 🔴 Dangerous | **Yes** |

**Files:**
- Factory: [postgres-factory.ts](./tools/agents/postgres-factory.ts)
- Decorator: [postgres-decorator.ts](./tools/agents/postgres-decorator.ts)
- LangChain: [postgres-langchain.ts](./tools/agents/postgres-langchain.ts)
- Interactive Approval: [postgres-with-approval.ts](./tools/agents/postgres-with-approval.ts)

---

## All Available Commands

### Integration Patterns
```bash
pnpm slack:factory
pnpm slack:decorator
pnpm slack:langchain
pnpm gmail:factory
pnpm gmail:decorator
pnpm gmail:langchain
pnpm postgres:factory
pnpm postgres:decorator
pnpm postgres:langchain
pnpm postgres:approval      # Interactive approval demo
pnpm agent:factory
pnpm agent:decorator
pnpm agent:langchain
```

### Validation & Advanced
```bash
pnpm meta:flow              # Tool lifecycle validation
npx tsx policy/policy-demo.ts       # Policy engine
npx tsx skills/skills-demo.ts       # Skills system
npx tsx validate-implementation.ts  # Run all validations
```

### CLI Commands
```bash
pnpm cli -- doctor <tool-dir>           # Validate tools + show policy
pnpm cli -- review list                 # Show pending approvals
pnpm cli -- review approve <name>       # Approve tool
pnpm cli -- search <keyword>            # Search tools
pnpm cli -- list                        # List all tools
```

---

## Tips & Troubleshooting

### "Tool not found" Error
Ensure tools are in the right directory structure:
```
tools/
├── slack/
│   └── tools/
│       └── {tool-name}/
│           └── definition.yaml
├── gmail/
│   └── tools/
│       └── {tool-name}/
│           └── definition.yaml
```

### "Permission denied" on Approval
When running interactive examples, you need to **type** the approval:
```bash
npx tsx postgres-with-approval.ts
# When prompted: "Do you approve? (yes/no): " type "yes"
```

For CI/CD with auto-approval:
```bash
export MATIMO_SQL_AUTO_APPROVE=true
pnpm postgres:factory
```

### "Module not found" in Examples
Make sure to:
1. Build main project: `pnpm build` (from matimo/ root)
2. Install examples: `pnpm install` (from examples/tools/)
3. Set environment: Create `.env` with your API tokens

### Running Specific Examples
```bash
# Just the factory pattern
npx tsx agents/factory-pattern-agent.ts

# Just Slack decorator
npx tsx agents/slack-decorator.ts

# Interactive policy demo with auto-approval (5 approvals)
printf "y\ny\ny\ny\ny\n" | npx tsx policy/policy-demo.ts
```

### Adding Your Own Tools
1. Create tool YAML in `packages/{provider}/tools/{name}/definition.yaml`
2. Load via: `await matimo.execute('your-tool-name', {...})`
3. See main README for complete tool creation guide

---

## Architecture Overview

All patterns use the same underlying layers:

```
Application Layer (Your code)
    ↓ uses matimo.execute() or @tool decorators
Matimo SDK Layer (MatimoInstance, ToolRegistry)
    ↓ routes to correct executor
Executor Layer (CommandExecutor, HttpExecutor, FunctionExecutor)
    ↓ validates input with Zod
Tool Definition Layer (YAML files)
```

All three patterns are equivalent at the execution layer — just different interfaces for different use cases.

---

## Next Steps

1. **Try the patterns:** Run `pnpm slack:factory`, `pnpm slack:decorator`, `pnpm slack:langchain`
2. **See validation:** Run `npx tsx policy/policy-demo.ts`
3. **Add your own:** Follow [Tool Creation Guide](../tool-development/)
4. **Integrate:** Use with LangChain, Decorator, or Factory in your app

For more details, see the main [Matimo README](../../README.md).


### LangChain Integration

```bash
# Slack AI agent - Let GPT decide which Slack tool to use
pnpm slack:langchain

# Gmail AI agent - Let GPT handle Gmail
pnpm gmail:langchain

# Postgres AI agent - Let GPT execute SQL queries
pnpm postgres:langchain

# General AI agent - Full tool access via natural language
pnpm agent:langchain
```

### Postgres with Approval Flow (Interactive)

```bash
# Run interactive Postgres example with approval flow
# Demonstrates destructive SQL detection and approval workflow
pnpm postgres:approval
```

This example requires a running Postgres instance. See [packages/postgres/README.md](../packages/postgres/README.md) for setup instructions.

---

## Environment Setup

Create `.env` file in `examples/tools/` with your API tokens:

```bash
# Slack (get from https://api.slack.com/apps)
SLACK_BOT_TOKEN=xoxb-your-token-here

# Gmail (see docs for OAuth2 setup)
GMAIL_ACCESS_TOKEN=ya29.your-token-here

# OpenAI (for LangChain examples, from platform.openai.com)
---

## Environment Setup

Create `.env` with your API keys:

```bash
# Slack
SLACK_BOT_TOKEN=xoxb-your-token
SLACK_APP_TOKEN=xapp-your-token

# Gmail  
GMAIL_ACCESS_TOKEN=ya29-your-token
GMAIL_REFRESH_TOKEN=1//refresh-token

# OpenAI (for LangChain examples)
OPENAI_API_KEY=sk-your-key

# Postgres (optional)
MATIMO_POSTGRES_URL=postgresql://user:password@localhost:5432/dbname
# OR individual params:
MATIMO_POSTGRES_HOST=localhost
MATIMO_POSTGRES_PORT=5432
MATIMO_POSTGRES_USER=user
MATIMO_POSTGRES_PASSWORD=password
MATIMO_POSTGRES_DB=matimo-test

# Auto-approve all SQL operations (for CI/CD)
# MATIMO_SQL_AUTO_APPROVE=true
```

**Postgres (Optional):** 
- Use Docker: `docker run -d -e POSTGRES_USER=user -e POSTGRES_PASSWORD=pass -e POSTGRES_DB=matimo-test -p 5432:5432 pgvector/pgvector:pg15`
- Or use existing instance: update `.env` with connection details

---

## File Structure

```
examples/tools/
├── agents/                          # Integration pattern examples
│   ├── factory-pattern-agent.ts
│   ├── decorator-pattern-agent.ts
│   └── langchain-agent.ts
├── slack/ gmail/ postgres/          # Service-specific examples
│   ├── {service}-factory.ts
│   ├── {service}-decorator.ts
│   └── {service}-langchain.ts
├── policy/                          # Policy validation demo
│   └── policy-demo.ts
├── skills/                          # Skills system demo
│   └── skills-demo.ts
├── meta-flow/                       # Complete lifecycle demo
│   └── meta-tools-integration.ts
├── .env.example
├── package.json
└── README.md (this file)
```

---

## Support

- 📖 Main [README](../../README.md) and [Docs](../../docs)
- 💬 [GitHub Discussions](https://github.com/tallclub/matimo/discussions)
- 🐛 [Report Issues](https://github.com/tallclub/matimo/issues)
- ⭐ [GitHub Repo](https://github.com/tallclub/matimo)

