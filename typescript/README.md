# Matimo — Enable AI Agents To Build Themselves

<p align="center">
  <img src="https://raw.githubusercontent.com/tallclub/matimo/main/docs/assets/logo.png" alt="Matimo Logo" width="300" />
</p>
<p align="center">
    <strong>Self-extending agents with enterprise-grade control</strong>
</p>

<p align="center">
  <a href="https://github.com/tallclub/matimo/actions/workflows/ci.yml?branch=main"><img src="https://img.shields.io/github/actions/workflow/status/tallclub/matimo/ci.yml?branch=main&style=for-the-badge" alt="CI status"></a>
  <a href="https://www.npmjs.com/package/matimo"><img src="https://img.shields.io/npm/v/matimo.svg?style=for-the-badge" alt="npm version"></a>
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge" alt="MIT License"></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-5.9+-blue?style=for-the-badge" alt="TypeScript"></a>
  <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/Node.js-18+-green?style=for-the-badge" alt="Node.js"></a>
</p>

<p align="center">
  <a href="https://discord.gg/3JPt4mxWDV"><img src="https://img.shields.io/badge/Discord-Join%20Chat-5865F2?style=for-the-badge&logo=discord&logoColor=white" alt="Discord"></a>
</p>

## The TypeScript AI SDK with Meta-Tools, Policy Engine, Governance and Human-in-the-Loop Control

Give your agents **137+ production-ready tools** to start. Then activate **10 meta-tools** that let them create, validate, and approve new capabilities at runtime — governed by your **policy engine** with **human approval workflows** for critical actions.

**Why this matters:**

- 🔧 **Meta-Tools**: Agents write new tool definitions in YAML, validate schemas, approve for production, and hot-reload — all mid-conversation. No restart. No redeployment.

- 🛡️ **Policy Engine**: Classify every action by risk level (low/medium/high/critical). Block dangerous operations. Quarantine draft tools. Enforce your rules automatically.

- 🤝 **Human-in-the-Loop (HITL)**: Critical tools require human approval before execution. Configurable timeouts, approval manifests, audit trails. You stay in control.

- 🌐 **Universal Integration**: One YAML definition works across TypeScript, LangChain, Claude MCP, OpenAI. Write once, run everywhere.

> **Python SDK?** Install [`matimo` on PyPI](https://pypi.org/project/matimo/) — full feature parity with TypeScript.

---

### See It In Action

```typescript
// Agent encounters a new API mid-task
const result = await matimo.execute('matimo_create_tool', {
  name: 'stripe_create_payment',
  definition: yamlContent, // Agent generates this
});

// Policy engine classifies risk → requires approval
// HITL callback triggers → human reviews and approves

await matimo.execute('matimo_reload_tools');

// Tool is now live and production-ready
const payment = await matimo.execute('stripe_create_payment', {
  amount: 5000,
  currency: 'usd',
});
```

**Other SDKs give agents a toolbox. Matimo gives them a workshop — with safety guardrails.**

🎯 **v0.1.0 Stable** (May 1, 2026) — 2,996 tests · 95%+ coverage · Production-ready

[📖 Documentation](https://github.com/tallclub/matimo/tree/main/docs) · [🚀 Quick Start](https://github.com/tallclub/matimo/blob/main/docs/getting-started/QUICK_START.md) · [📚 API Reference](https://github.com/tallclub/matimo/blob/main/docs/api-reference/SDK.md) · [🛠️ Add Tools](https://github.com/tallclub/matimo/blob/main/docs/tool-development/ADDING_TOOLS.md)

---

## Quick Start

### Installation

```bash
# Install the SDK + auto-discover provider tools
npm install matimo
npm install matimo @matimo/slack @matimo/gmail
```

### Minimal Example

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

---

## What's Included

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
- **Auto-Discovery**: Automatic detection of `@matimo/*` providers from npm
- **Matimo CLI**: Tool discovery, setup wizard, MCP config generation
- **OAuth2 Support**: Provider-agnostic authorization for Slack, Gmail, GitHub, etc.
- **Framework Support**: Factory pattern, Decorator pattern, LangChain
- **Agent Skills System**: [SKILL.md](https://agentskills.io) knowledge files with semantic search, content chunking, and progressive disclosure
- **Policy Engine**: 9 security rules, HITL quarantine, hot-reload, SHA-256 integrity tracking, HMAC approvals, audit events

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
import { convertToolsToLangChain } from 'matimo';
const tools = convertToolsToLangChain(matimo.listTools(), matimo);
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

See [MCP Docs](https://github.com/tallclub/matimo/blob/main/docs/MCP.md) for the full reference.

---

## Installation

```bash
npm install matimo

# Install tool providers
npm install @matimo/slack @matimo/gmail
```

Then use with auto-discovery:

```typescript
const matimo = await MatimoInstance.init({ autoDiscover: true });
```

### Matimo CLI (Tool Management)

```bash
npm install -g @matimo/cli

matimo list          # Show installed packages
matimo search email  # Find tools
matimo install slack # Install a provider
```

### From Source (Contributors)

```bash
git clone https://github.com/tallclub/matimo
cd matimo && pnpm install && pnpm build
pnpm test
```

---

## Skills System

Matimo supports the [Agent Skills specification](https://agentskills.io) — structured knowledge files (`SKILL.md`) that teach agents domain expertise at runtime.

```typescript
// Discover available skills (Level 1 — metadata only)
const skills = matimo.listSkills();

// Load a specific skill (Level 2 — full content)
const skill = matimo.getSkill('slack');

// Load only the sections you need (smart context management)
const content = matimo.getSkillContent('postgres', {
  sections: ['Error Handling', 'Parameterized Queries'],
  maxTokens: 500,
});

// Semantic search across all skills
const results = await matimo.semanticSearchSkills('How do I handle rate limiting?');
```

**Each provider ships one skill** with domain knowledge for all its tools. Agents load skills on demand — no context bloat.

See [Skills Documentation](https://github.com/tallclub/matimo/blob/main/docs/skills/SKILLS.md) for the full guide.

---

## Policy Engine & HITL

Matimo includes a defense-in-depth policy engine for agent tool usage:

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
});

// Hot-reload policy at runtime (no restart needed)
await matimo.reloadPolicy('./policy-prod.yaml');
```

**Key features:**

- 9 deterministic security rules (SSRF detection, namespace protection, credential allowlists)
- HITL quarantine — medium-risk tools pause for human approval instead of auto-rejecting
- Policy hot-reload — swap policies at runtime with automatic tool re-validation
- SHA-256 integrity tracking + HMAC approval manifest
- Full audit trail via structured events

See [Policy & Lifecycle Docs](https://github.com/tallclub/matimo/blob/main/docs/api-reference/POLICY_AND_LIFECYCLE.md) for the complete reference.

---

## Adding Tools to Matimo

Create tool providers as independent npm packages. If you build `@matimo/<provider>` following this pattern, we'll list it in the official docs and README with you as maintainer.

```bash
mkdir packages/github
cd packages/github && cat > package.json << 'EOF'
{ "name": "@matimo/github", "type": "module", ... }
EOF

mkdir tools/github-create-issue
cat > tools/github-create-issue/definition.yaml << 'EOF'
name: github-create-issue
parameters:
  owner: { type: string, required: true }
  repo: { type: string, required: true }
  title: { type: string, required: true }
execution:
  type: http
  method: POST
  url: https://api.github.com/repos/{owner}/{repo}/issues
  headers:
    Authorization: "Bearer {GITHUB_TOKEN}"
EOF
```

Then publish to npm as `@matimo/github`. Users install and auto-discover:

```bash
npm install @matimo/github
# New tools automatically available!
const matimo = await MatimoInstance.init({ autoDiscover: true });
```

See [Adding Tools to Matimo](https://github.com/tallclub/matimo/blob/main/docs/tool-development/ADDING_TOOLS.md) for the complete guide.

---

## Documentation

- [Getting Started](https://github.com/tallclub/matimo/tree/main/docs/getting-started)
- [API Reference](https://github.com/tallclub/matimo/blob/main/docs/api-reference/SDK.md)
- [Skills System](https://github.com/tallclub/matimo/blob/main/docs/skills/SKILLS.md)
- [Policy Engine & Tool Lifecycle](https://github.com/tallclub/matimo/blob/main/docs/api-reference/POLICY_AND_LIFECYCLE.md)
- [LangChain Integration](https://github.com/tallclub/matimo/blob/main/docs/framework-integrations/LANGCHAIN.md)
- [Tool Development](https://github.com/tallclub/matimo/blob/main/docs/tool-development/ADDING_TOOLS.md)
- [Architecture Overview](https://github.com/tallclub/matimo/blob/main/docs/architecture/OVERVIEW.md)
- [Contributing](https://github.com/tallclub/matimo/blob/main/CONTRIBUTING.md)
- [Python SDK on PyPI](https://pypi.org/project/matimo/)

---

## License

MIT © 2026 Matimo Contributors

---

## Support the Project

- ⭐ Star the repo
- 🐛 Open issues for bugs or features
- 🔀 Submit PRs (see [Contributing](https://github.com/tallclub/matimo/blob/main/CONTRIBUTING.md))
- 📢 Share on Twitter, Reddit, Discord

---

## Contributors

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
<!-- prettier-ignore-start -->
<!-- markdownlint-disable -->

<div align="left">
  <a href="https://github.com/tallclub"><img src="https://avatars.githubusercontent.com/u/112923179?v=4&s=60" width="60" height="60" style="border-radius:50%;margin:0 10px;" alt="tallclub" title="tallclub - Code 💻 Documentation 📖 Design 🎨 Review 👀 Ideas 🤔 Maintenance 🚧"/></a>
  <a href="https://github.com/Genmin"><img src="https://avatars.githubusercontent.com/u/90125084?v=4&s=60" width="60" height="60" style="border-radius:50%;margin:0 10px;" alt="Genmin" title="Genmin - Code 💻 Security 🛡️"/></a>
</div>

<!-- markdownlint-enable -->
<!-- prettier-ignore-end -->
<!-- ALL-CONTRIBUTORS-LIST:END -->

---

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=tallclub/matimo&type=Date)](https://star-history.com/#tallclub/matimo&Date)
