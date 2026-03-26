# Matimo — The Agent That Builds Itself

<p align="center">
  <img src="./docs/assets/logo.png" alt="Matimo Logo" width="300" />
</p>
<p align="center">
    <strong>Let The Agent Build Itself</strong>
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

**Matimo** is a framework-agnostic SDK with pre-built providers, a skills knowledge layer, MCP out of the box, and agents that autonomously build new capabilities — governed by a policy engine you control.

Define tools **once in YAML**. Let agents extend themselves with new capabilities. Works with LangChain, OpenAI, Claude, CrewAI — any framework.

**Key differentiator:** Unlike other SDKs that give agents tools, Matimo gives agents the power to build new tools themselves — validated, approved, and live — without restarting.

[📖 Documentation](./docs) · [🚀 Quick Start](./docs/getting-started/QUICK_START.md) · [📚 API Reference](./docs/api-reference/SDK.md) · [🛠️ Add Tools](./docs/tool-development/ADDING_TOOLS.md) · [🤖 Examples](./examples)

---

## Quick Start

### Installation

```bash
npm install matimo
# OR auto-discover tools from node_modules/@matimo/*
npm install matimo @matimo/slack @matimo/gmail
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

See [Three Integration Patterns](#three-integration-patterns) and [examples/](./examples) for more.

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
- **Auto-Discovery**: Automatic detection of `@matimo/*` providers from npm
- **Matimo CLI**: Tool discovery, setup wizard, MCP config generation
- **OAuth2 Support**: Provider-agnostic authorization for Slack, Gmail, GitHub, etc.
- **Framework Support**: Factory pattern, Decorator pattern, LangChain, CrewAI
- **TypeScript SDK**: Full type safety and IDE support
- **Agent Skills System**: [SKILL.md](https://agentskills.io) knowledge files with semantic search, content chunking, and progressive disclosure
- **Policy Engine**: 9 security rules, HITL quarantine, hot-reload, SHA-256 integrity tracking, HMAC approvals, audit events

## Why Matimo?

**The Problem:** Every AI framework (LangChain, CrewAI, custom agents, etc.) defines tools differently. You duplicate tool logic across frameworks. And most SDKs can't handle agents that need to build new tools at runtime.

**The Solution:** 

1. **Write Once, Use Everywhere** — Define tools in clean YAML, deploy to SDK, LangChain, MCP, or custom agents without duplication.
2. **Agent Self-Extension** — Agents autonomously build new tools and skills at runtime without restarting:
   - **Tool Creation**: `matimo_create_tool` — agents write YAML definitions, submit for approval, and use instantly
   - **Skill Creation**: `matimo_create_skill` — agents author domain knowledge (SKILL.md) directly into the system
   - **Hot-Reload**: `matimo_reload_tools` — updated capabilities live immediately without server restart
   - **Policy-Gated**: All agent-created tools validated against security rules; HITL approval for high-risk changes
3. **Pre-built Ecosystem** — 9 providers (Slack, Gmail, GitHub, Notion, HubSpot, Postgres, Twilio, Mailchimp, etc.) ready to go.
4. **Skills + Policies** — Teach agents domain knowledge via SKILL.md files. Control what agents can do with deterministic security rules and HITL quarantine.

Included:
- TypeScript SDK (factory & decorator patterns)
- LangChain integration (with examples)
- Matimo CLI (tool discovery & setup)
- MCP Server (Claude Desktop, Cursor, Windsurf, any MCP client)
- Auto-discovery from npm packages
- OAuth2 support + parameter validation
- 9 security rules + HITL approval system

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
const tools = matimo.listTools().map(tool => ({
  type: 'function',
  function: { name: tool.name, description: tool.description, ... }
}));
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

### From npm (Recommended)

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

matimo list      # Show installed packages
matimo search email  # Find tools
matimo install slack # Install tools
```

See [CLI Docs](./packages/cli/README.md) for full reference.

### From Source (Contributors)

```bash
git clone https://github.com/tallclub/matimo
cd matimo && pnpm install && pnpm build
pnpm test
cd examples/tools && pnpm install && pnpm agent:factory
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

See [Skills Documentation](./docs/skills/SKILLS.md) for the full guide.

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

See [Policy & Lifecycle Docs](./docs/api-reference/POLICY_AND_LIFECYCLE.md) for the complete reference.

---

## Features **Coming Soon:**

- More tool providers (Stripe, Jira, Linear, etc.)
- Python SDK
- Custom Tool Marketplace

---

## Adding Tools to Matimo

If you build @matimo/<provider> following this pattern, we’ll list it in the official docs and README with you as maintainer.

Create tool providers as independent npm packages:

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

See [Adding Tools to Matimo](./docs/tool-development/ADDING_TOOLS.md) for the complete 6-step guide.

---

## Documentation

- [Getting Started](./docs/getting-started/)
- [API Reference](./docs/api-reference/SDK.md)
- [Skills System](./docs/skills/SKILLS.md)
- [Policy Engine & Tool Lifecycle](./docs/api-reference/POLICY_AND_LIFECYCLE.md)
- [LangChain Integration](./docs/framework-integrations/LANGCHAIN.md)
- [Tool Development](./docs/tool-development/ADDING_TOOLS.md)
- [Architecture Overview](./docs/architecture/OVERVIEW.md)
- [Contributing](./CONTRIBUTING.md)

---

## License

MIT © 2026 Matimo Contributors

---

## Support the Project

- ⭐ Star the repo
- 🐛 Open issues for bugs or features
- 🔀 Submit PRs (see [Contributing](./CONTRIBUTING.md))
  Best way to help: add a new provider (Notion, Jira, Stripe, Twilio…) or expand existing toolsets.
- 📢 Share on Twitter, Reddit, Discord

---

## Contributors

<a href="https://github.com/tallclub/matimo/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=tallclub/matimo" />
</a>

---

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=tallclub/matimo&type=Date)](https://star-history.com/#tallclub/matimo&Date)
