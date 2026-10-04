# Matimo - The Governance Layer for AI Agent Tools

<p align="center">
  <img src="./docs/assets/logo.png" alt="Matimo Logo" width="300" />
</p>
<p align="center">
    <strong>Policy-governed tool execution for any agent framework - plus a toolkit and meta-tools for agents that build their own capabilities</strong>
</p>

<p align="center">
  <a href="https://github.com/tallclub/matimo/actions/workflows/ci.yml?branch=main"><img src="https://img.shields.io/github/actions/workflow/status/tallclub/matimo/ci.yml?branch=main&style=for-the-badge" alt="CI status"></a>
  <a href="https://www.npmjs.com/package/matimo"><img src="https://img.shields.io/npm/v/matimo.svg?style=for-the-badge" alt="npm version"></a>
  <a href="https://pypi.org/project/matimo/"><img src="https://img.shields.io/pypi/v/matimo.svg?style=for-the-badge" alt="PyPI version"></a>
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge" alt="MIT License"></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-5.9+-blue?style=for-the-badge" alt="TypeScript"></a>
  <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/Node.js-18+-green?style=for-the-badge" alt="Node.js"></a>
  <a href="https://www.python.org/"><img src="https://img.shields.io/badge/Python-3.11+-blue?style=for-the-badge" alt="Python"></a>
</p>

<p align="center">
  <a href="https://discord.gg/3JPt4mxWDV"><img src="https://img.shields.io/badge/Discord-Join%20Chat-5865F2?style=for-the-badge&logo=discord&logoColor=white" alt="Discord"></a>
</p>

<p align="center">
  <a href="https://colab.research.google.com/github/tallclub/matimo/blob/main/docs/notebooks/00_index.ipynb">
    <img src="https://colab.research.google.com/assets/colab-badge.svg" alt="Open In Colab"/>
  </a>
</p>

## Governance First - Then Tools, Meta-Tools, and Universal Integration

Every tool call - built-in, third-party, or agent-created - passes through Matimo's **policy engine** before it executes. On top of that governance layer, agents get **129 production-ready tools** (plus a governed 449-tool Composio catalog), **15 meta-tools** to create/validate/approve new capabilities at runtime, and **one YAML definition** that runs across every framework you use.

**Why this matters:**

- 🛡️ **Policy Engine (Governance)**: Every execution - not just agent-created tools - is classified by risk level (low/medium/high/critical), checked against deterministic security rules, and reported as an audit event. Add an audit sink and every event is written to a hash-chained log that shows any edit or deletion. This is the layer everything else sits on top of.

- 🤝 **Human-in-the-Loop (HITL)**: With HITL on, every call at or above your risk threshold pauses for human approval before it runs. HTTP DELETE and shell-command tools ask before every call. Configurable timeouts, HMAC-signed approval manifests, and an audit event for every decision. You stay in control even as agents gain autonomy.

- 🔧 **Meta-Tools & Self-Extension**: Agents write new tool definitions in YAML, submit them for policy validation, get human approval when required, and hot-reload - all mid-conversation. No restart. No redeployment. Every agent-created tool is governed the same way as your built-in ones.

- 🌐 **Universal Integration**: One YAML definition works across TypeScript, Python, LangChain, CrewAI, Claude MCP, OpenAI. Write once, run everywhere - with the same policy enforcement everywhere.

Want a hosted runtime on top of this governance layer, with a visual builder and 16 reasoning engines included? Take a look at [Matimo Workbench](https://matimo.ai).

---

### See It In Action

```python
matimo = await Matimo.init(
    './agent-tools',
    auto_discover=True,
    untrusted_paths=['./agent-tools'],  # agent-written tools must pass the content rules
    on_approval=ask_reviewer,           # a human answers every call that needs approval
)
set_global_matimo_instance(matimo)

# The agent meets a new API mid-task and writes a tool for it (a draft)
await matimo.execute('matimo_create_tool', {
    'name': 'stripe_create_payment',
    'yaml_content': yaml_content,  # agent-generated YAML
    'target_dir': './agent-tools',
})

# A human reviews the draft and approves it
await matimo.execute(
    'matimo_approve_tool',
    {'name': 'stripe_create_payment', 'tool_dir': './agent-tools'},
    context=PolicyContext(agent_id='reviewer', roles=['admin']),
)
await matimo.execute('matimo_reload_tools', {})

# Live - and every call still asks the reviewer
payment = await matimo.execute('stripe_create_payment', {'amount': 5000, 'currency': 'usd'})
```

**Other SDKs give agents a toolbox. Matimo gives them a workshop - with safety guardrails.**

🎯 **0.2.0 - secure by default** - DELETE and command tools ask a human, per-instance approval callbacks, MCP elicitation, a hash-chained audit log, and one set of rules enforced identically by both SDKs · 4,400+ tests across TypeScript and Python · see [CHANGELOG](./CHANGELOG.md) and the [migration guide](./docs/api-reference/POLICY_AND_LIFECYCLE.md#upgrading-to-020)

[📖 Documentation](./docs) · [🚀 Quick Start](./docs/getting-started/QUICK_START.md) · [📚 API Reference](./docs/api-reference/SDK.md) · [🛠️ Add Tools](./docs/tool-development/ADDING_TOOLS.md) · [🤖 Examples](./typescript/examples) ([Python](./python/examples))

---

## Quick Start

### Installation

```bash
# TypeScript / Node.js
npm install matimo
# OR auto-discover tools from node_modules/@matimo/*
npm install matimo @matimo/slack @matimo/gmail

# Python
pip install matimo
pip install "matimo[langchain]"   # with LangChain support
pip install "matimo[crewai]"      # with CrewAI support
pip install "matimo[agno]"        # with Agno support
pip install "matimo[all]"         # all extras
```

### Minimal Example (TypeScript)

```typescript
import { MatimoInstance } from '@matimo/core';

const matimo = await MatimoInstance.init({
  autoDiscover: true,
});

const result = await matimo.execute('slack_send_channel_message', {
  channel: '#general',
  text: 'Hello from Matimo!',
});
```

### Minimal Example (Python)

```python
import asyncio
from matimo import Matimo

async def main():
    matimo = await Matimo.init(auto_discover=True)
    result = await matimo.execute('slack_send_channel_message', {
        'channel': '#general',
        'text': 'Hello from Matimo!',
    })

asyncio.run(main())
```

See [Four Integration Patterns](#four-integration-patterns) and [typescript/examples/](./typescript/examples) or [python/examples/](./python/examples) for more. Python SDK reference: [python/README.md](./python/README.md).

## What's Included

Matimo ships with built-in support for:

- **Core Tools**: File I/O, Web fetch, Command execution, Code search
- **MCP Server**: Expose all tools via stdio or Streamable HTTP to Claude Desktop, Cursor, Windsurf, and any MCP client (`npx matimo mcp`)
- **Slack Integration**: Send messages, manage channels, reactions, threads, DMs
- **Gmail Integration**: Send/read email, manage threads, drafts
- **GitHub Integration**: Issues, pull requests, releases, code search
- **Notion Integration**: Pages, databases, blocks, search
- **HubSpot Tools**: Contacts, companies, deals, tickets
- **Postgres Tools**: Query/modify data with safety checks
- **Twilio Tools**: Send SMS/MMS, manage messages
- **Mailchimp Tools**: Audiences, subscribers, email campaigns
- **Microsoft Graph Tools**: Search, files, mail, Teams, calendar, SharePoint
- **Bruno Tools**: Execute, import, and validate Bruno API collections
- **Composio Catalog (Governed)**: 449 tools across Asana, Jira, Linear, Google Workspace, Microsoft 365, and more - routed through [Composio](https://composio.dev) with Matimo's policy engine and HITL layered on top ([why](./typescript/packages/composio/README.md#-credit-where-its-due))
- **Auto-Discovery**: Automatic detection of `@matimo/*` providers from npm
- **Matimo CLI**: Tool discovery, setup wizard, MCP config generation
- **OAuth2 Support**: Provider-agnostic authorization for Slack, Gmail, GitHub, etc.
- **Framework Support**: Factory pattern, Decorator pattern, LangChain, CrewAI, Agno
- **TypeScript SDK**: Full type safety and IDE support
- **Python SDK**: The same policy engine, approval rules and YAML tools as TypeScript - factory pattern, decorator, LangChain, CrewAI, Agno, MCP (the Composio catalog and a few instance methods are TypeScript-only; see [SDK.md](./docs/api-reference/SDK.md))
- **Agent Skills System**: [SKILL.md](https://agentskills.io) knowledge files with semantic search, content chunking, and progressive disclosure
- **Policy Engine**: 9 security rules, HITL quarantine, hot-reload, SHA-256 integrity tracking, HMAC approvals, audit events

## Why Matimo?

**The Problem:** Every AI framework (LangChain, CrewAI, custom agents, etc.) defines tools differently, with no shared layer to govern what an agent is actually allowed to do. You duplicate tool logic across frameworks, bolt on approval checks per-project, and most SDKs can't safely handle agents that build new tools at runtime.

**The Solution:** Matimo is, first, a **governance layer** - a policy engine that classifies risk and gates execution for every tool call, agent-created or not. Everything else builds on that foundation:

1. **Governance by Default** - Every tool execution is classified by risk (low/medium/high/critical), checked against deterministic security rules (SSRF detection, namespace protection, credential allowlists), and can require human approval before running. This applies uniformly to built-in tools, third-party providers, and anything an agent creates itself.
2. **Write Once, Use Everywhere** - Define tools in clean YAML, deploy to SDK, LangChain, MCP, or custom agents without duplication - with the same policy enforcement in every context.
3. **Agent Self-Extension, Safely** - Agents autonomously build new tools and skills at runtime without restarting, and every new capability is policy-gated:
   - **Tool Creation**: `matimo_create_tool` - agents write YAML definitions as drafts; a human approves them with `matimo_approve_tool`
   - **Skill Creation**: `matimo_create_skill` - agents author domain knowledge (SKILL.md) directly into the system
   - **Hot-Reload**: `matimo_reload_tools` - updated capabilities live immediately without server restart
   - **Policy-Gated**: All agent-created tools are validated against security rules, run only once a human approves them, and ask again on every call
4. **Pre-built Ecosystem** - 10 providers (Slack, Gmail, GitHub, Notion, HubSpot, Postgres, Twilio, Mailchimp, Microsoft, Bruno) ready to go, all governed by the same policy engine, plus a governed 449-tool Composio catalog for broader coverage.

Included:
- **Policy Engine** - 9 content rules, risk classification, per-call approval, HITL quarantine, HMAC approval manifests, events and a hash-chained audit log
- TypeScript SDK (factory & decorator patterns)
- **Python SDK** (factory, decorator, LangChain, CrewAI, Agno, MCP - same policy engine and YAML tools as TypeScript)
- LangChain integration (with examples)
- Matimo CLI (tool discovery & setup)
- MCP Server (Claude Desktop, Cursor, Windsurf, any MCP client)
- Auto-discovery from npm packages
- OAuth2 support + parameter validation

See [Contributing](./CONTRIBUTING.md) for details.

---

## Four Integration Patterns

### 1️⃣ Factory Pattern (Simplest)

```typescript
const matimo = await MatimoInstance.init({ autoDiscover: true });
const result = await matimo.execute('calculator', { operation: 'add', a: 5, b: 3 });
```

### 2️⃣ Decorator Pattern (Class-Based)

```typescript
@tool('slack_send_channel_message')
async sendMessage(channel: string, text: string) { /* Auto-executed */ }
```

### 3️⃣ LangChain Integration

```typescript
import { convertToolsToLangChain } from '@matimo/core';

const tools = await convertToolsToLangChain(
  matimo.listTools().filter((t) => t.name.startsWith('slack')),
  matimo,
  { SLACK_BOT_TOKEN: process.env.SLACK_BOT_TOKEN! }
);
```

### 4️⃣ MCP Server (Claude Desktop, Cursor, Windsurf, any MCP client)

```bash
# Expose all installed @matimo/* tools via MCP in one command
npx matimo mcp

# Run the setup wizard to get a ready-to-paste client config
npx matimo mcp setup

# HTTP mode for remote access / Docker
npx matimo mcp --transport http --port 3000 --self-signed
```

See [MCP Docs](./docs/MCP.md) for the full reference.

See [SDK Usage Patterns](./docs/user-guide/SDK_PATTERNS.md), [LangChain Integration](./docs/framework-integrations/LANGCHAIN.md), and [MCP Server](./docs/MCP.md) for details.

---

## Installation

TypeScript and Python install commands are under [Quick Start](#installation) above. Use `autoDiscover: true` (TypeScript) or `auto_discover=True` (Python) to load every installed `@matimo/*` provider.

See [python/README.md](./python/README.md) for the full Python SDK reference.

### Matimo CLI (Tool Management)

```bash
npm install -g @matimo/cli

matimo list      # Show installed packages
matimo search email  # Find tools
matimo install slack # Install tools
```

See [CLI Docs](./typescript/packages/cli/README.md) for full reference.

### From Source (Contributors)

```bash
git clone https://github.com/tallclub/matimo
cd matimo/typescript && pnpm install && pnpm build
pnpm test
cd examples/tools && pnpm install && pnpm agent:factory   # needs provider credentials, see the example README
```

---

## Skills System

Matimo supports the [Agent Skills specification](https://agentskills.io) - structured knowledge files (`SKILL.md`) that teach agents domain expertise at runtime.

```typescript
// Discover available skills (Level 1 - metadata only)
const skills = matimo.listSkills();

// Load a specific skill (Level 2 - full content)
const skill = matimo.getSkill('slack');

// Load only the sections you need (smart context management)
const content = matimo.getSkillContent('postgres', {
  sections: ['Error Handling', 'Parameterized Queries'],
  maxTokens: 500,
});

// Semantic search across all skills
const results = await matimo.semanticSearchSkills('How do I handle rate limiting?');
```

**Each provider ships one skill** with domain knowledge for all its tools. Agents load skills on demand - no context bloat.

See [Skills Documentation](./docs/skills/SKILLS.md) for the full guide.

## Policy Engine & HITL (The Governance Layer)

This is Matimo's core: a defense-in-depth policy engine that governs every tool execution, not just agent-created ones.

```typescript
const matimo = await MatimoInstance.init({
  toolPaths: ['./tools', './agent-tools'],
  policyFile: './policy.yaml', // 9 security rules, domain allowlists
  untrustedPaths: ['./agent-tools'], // Agent-created tools validated here
  onHITL: async (request) => {
    // Human-in-the-loop quarantine
    console.log(`Approve ${request.toolName}? Risk: ${request.riskLevel}`);
    return promptUser();
  },
  onEvent: (event) => auditLog.push(event),
  auditSink: new JsonlFileSink('./logs/matimo-audit.jsonl'), // hash-chained audit log
});

// Hot-reload policy at runtime (no restart needed)
await matimo.reloadPolicy('./policy-prod.yaml');
```

**Key features:**

- 9 deterministic security rules (SSRF detection, namespace protection, credential allowlists)
- HITL quarantine - every tool at or above the risk threshold (`hitlMinRiskLevel`) pauses for human approval
- Policy hot-reload - swap policies at runtime with automatic tool re-validation
- SHA-256 integrity tracking + HMAC approval manifest
- Audit events for every call (`tool:executed`, `tool:execution_failed`, denials, approvals), identical in both SDKs
- `JsonlFileSink` writes them to a hash-chained log; `verifyAuditLog` finds the first edited or deleted line

See [Policy & Lifecycle Docs](./docs/api-reference/POLICY_AND_LIFECYCLE.md) for the complete reference.

---

## Coming Soon

- More native tool providers (Google Calendar/Drive/Sheets, Jira, Linear, Stripe)
- Custom Tool Marketplace

See the [Roadmap](./docs/ROADMAP.md).

---

## Adding Tools to Matimo

If you build @matimo/<provider> following this pattern, we’ll list it in the official docs and README with you as maintainer.

Create tool providers as independent npm packages:

```bash
cd typescript
mkdir packages/acme
cd packages/acme && cat > package.json << 'EOF'
{ "name": "@matimo/acme", "type": "module", ... }
EOF

mkdir -p tools/acme_create_ticket
cat > tools/acme_create_ticket/definition.yaml << 'EOF'
name: acme_create_ticket
description: Create a ticket in Acme
version: '1.0.0'
requires_approval: true
parameters:
  title: { type: string, required: true }
  body: { type: string, required: false }
execution:
  type: http
  method: POST
  url: https://api.acme.example/v1/tickets
  headers:
    Authorization: "Bearer {ACME_TOKEN}"
  body:
    title: "{title}"
    body: "{body}"
EOF
```

Then publish to npm as `@matimo/acme`. Users install and auto-discover:

```bash
npm install @matimo/acme
```

```typescript
const matimo = await MatimoInstance.init({ autoDiscover: true }); // acme_* tools are now loaded
```

See [Adding Tools to Matimo](./docs/tool-development/ADDING_TOOLS.md) for the complete 6-step guide.

---

## Documentation

- [Getting Started](./docs/getting-started/)
- [Python SDK](./python/README.md)
- [API Reference](./docs/api-reference/SDK.md)
- [Skills System](./docs/skills/SKILLS.md)
- [Policy Engine & Tool Lifecycle](./docs/api-reference/POLICY_AND_LIFECYCLE.md)
- [LangChain Integration](./docs/framework-integrations/LANGCHAIN.md)
- [Tool Development](./docs/tool-development/ADDING_TOOLS.md)
- [Architecture Overview](./docs/architecture/OVERVIEW.md)
- [Contributing](./CONTRIBUTING.md)

---

## Acknowledgments

Broad integration coverage (Asana, Jira, Linear, Google Workspace, Microsoft
365, and more - 449 tools total) is made possible today by
[Composio](https://composio.dev), whose catalog `@matimo/composio` wraps with
Matimo's policy engine, risk classification, and HITL approval. Building and
maintaining native, fully-tested first-party tools for that many actions
ourselves would take far longer than agents should have to wait for governed
access - so we lean on Composio's integration breadth as a deliberate,
temporary bridge while we grow native `@matimo/<provider>` packages for the
highest-usage toolkits over time. See
[the composio package README](./typescript/packages/composio/README.md#-credit-where-its-due)
for the full rationale.

## License

MIT © 2026 ROAIQ TECHNOLOGIES PRIVATE LIMITED

---

## Support the Project

- ⭐ Star the repo
- 🐛 Open issues for bugs or features
- 🔀 Submit PRs (see [Contributing](./CONTRIBUTING.md))
  Best way to help: add a new provider (Google Calendar/Drive/Sheets, Jira, Linear, Stripe…) or expand existing toolsets.
- 📢 Share on Twitter, Reddit, Discord

---

## Contributors

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
<!-- prettier-ignore-start -->
<!-- markdownlint-disable -->

<div align="left">
  <a href="https://github.com/tallclub"><img src="https://avatars.githubusercontent.com/u/112923179?v=4&s=60" width="60" height="60" style="border-radius:50%;margin:0 10px;" alt="tallclub" title="tallclub - Code 💻 Documentation 📖 Design 🎨 Review 👀 Ideas 🤔 Maintenance 🚧"/></a>
  <a href="https://github.com/Genmin"><img src="https://avatars.githubusercontent.com/u/90125084?v=4&s=60" width="60" height="60" style="border-radius:50%;margin:0 10px;" alt="Genmin" title="Genmin - Code 💻 Security 🛡️"/></a>
  <a href="https://github.com/marketcalls"><img src="https://avatars.githubusercontent.com/u/8728989?v=4&s=60" width="60" height="60" style="border-radius:50%;margin:0 10px;" alt="marketcalls" title="marketcalls - Code 💻 Documentation 📖"/></a>
</div>

<!-- markdownlint-enable -->
<!-- prettier-ignore-end -->

<!-- ALL-CONTRIBUTORS-LIST:END -->

---

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=tallclub/matimo&type=Date)](https://star-history.com/#tallclub/matimo&Date)
