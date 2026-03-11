# Matimo — Toolbox For AI Agents

<p align="center">
  <img src="./docs/assets/logo.png" alt="Matimo Logo" width="300" />
</p>
<p align="center">
    <strong>Matimo - "to be powerful"</strong>
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

**Matimo** is a universal, configuration‑driven AI tools ecosystem. Define tools **once in YAML** and reuse them across the SDK, LangChain, custom agents, and a single MCP server, without re‑implementing schemas or fragmenting integration logic.

**Define once → Plug into any agent ecosystem.**

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

## Why Matimo?

**The Problem:** Every AI framework (LangChain, CrewAI, custom agents, etc.) defines tools differently. You duplicate tool logic across frameworks.

**The Solution:** Define tools **once** in clean YAML, use them **everywhere** — with built-in:

- TypeScript SDK (factory & decorator patterns)
- LangChain integration (with examples)
- Matimo CLI (tool discovery & management)
- Auto-discovery from npm packages
- OAuth2 support + parameter validation

See [Contributing](./CONTRIBUTING.md) for details.

---

## Three Integration Patterns

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
