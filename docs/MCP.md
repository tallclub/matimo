# Matimo MCP Server

Expose your Matimo tools to AI assistants via the [Model Context Protocol](https://modelcontextprotocol.io/). One command gives Claude Desktop, Cursor, Windsurf, or any MCP client access to Slack, GitHub, Gmail, Notion, HubSpot, and more.

---

## Table of Contents

- [SDK Selection: TypeScript vs Python](#sdk-selection-typescript-vs-python)
- [Quick Start (5 minutes)](#quick-start-5-minutes)
  - [TypeScript](#typescript)
  - [Python](#python)
- [Step-by-Step Setup](#step-by-step-setup)
- [Client Configuration](#client-configuration)
  - [Claude Desktop](#claude-desktop)
  - [Cursor](#cursor)
  - [Windsurf](#windsurf)
  - [HTTP Mode (Remote / Docker)](#http-mode-remote--docker)
- [Available Tool Packages](#available-tool-packages)
- [CLI Reference](#cli-reference)
- [HTTP Mode](#http-mode)
  - [Bearer Token Authentication](#bearer-token-authentication)
  - [HTTPS](#https)
  - [Docker](#docker)
- [Secret Management](#secret-management)
- [Tool Filtering](#tool-filtering)
- [Approval-Required Tools](#approval-required-tools)
- [Programmatic Usage](#programmatic-usage)
- [Architecture](#architecture)
- [Troubleshooting](#troubleshooting)
  - [TypeScript](#troubleshootingtypescript)
  - [Python](#troubleshootingpython)

---

## SDK Selection: TypeScript vs Python

**Both TypeScript and Python SDKs are fully supported with 100% feature parity.**

| Feature | TypeScript | Python |
|---------|-----------|--------|
| Core MCP server | ✅ | ✅ |
| Stdio transport (Claude Desktop) | ✅ | ✅ |
| HTTP transport (remote / Docker) | ✅ | ✅ |
| Auth parameter filtering | ✅ | ✅ |
| `_matimo_approved` approval gating | ✅ | ✅ |
| Pre-resolved secrets (memory storage) | ✅ | ✅ |
| Skill resources (MCP resources/list) | ✅ | ✅ |
| Bearer token auth (HTTP) | ✅ | ✅ |
| Tool filtering (allow/deny lists) | ✅ | ✅ |
| Test coverage | 95%+ | 95%+ |

### Which SDK?

- **TypeScript:** Use if you're in a Node.js environment or need the fastest startup
- **Python:** Use if you prefer Python, need async/await in your agent, or want CrewAI / standard Python asyncio integration

Both have identical capabilities and security features. Choose based on your language preference.

**Implementation details:**
- **TypeScript:** `typescript/packages/core/mcp/` — see [mcp-server.ts](https://github.com/tallclub/matimo/blob/main/typescript/packages/core/src/mcp/mcp-server.ts)
- **Python:** `python/packages/core/src/matimo/mcp/` — see [README.md](../../python/packages/core/src/matimo/mcp/README.md)

---

## Quick Start (5 minutes)

### TypeScript

```bash
mkdir my-ai-tools && cd my-ai-tools
npm init -y
```

### 2. Install Matimo + the tool packages you want

```bash
npm install @matimo/core @matimo/cli @matimo/slack @matimo/github
```

### 3. Set your API keys

```bash
export SLACK_BOT_TOKEN=xoxb-your-slack-token
export GITHUB_TOKEN=ghp_your-github-token
```

### 4. Run the setup wizard

```bash
npx matimo mcp setup
```

This scans your project, lists all discovered tools, shows which API keys are set (✅) or missing (❌), and outputs **ready-to-paste configs** for Claude Desktop, Cursor, and HTTP mode.

### 5. Start the server

```bash
npx matimo mcp
```

That's it. All installed `@matimo/*` tools are auto-discovered and exposed over stdio.

### Python

1. **Create a new project (or use an existing one)**

```bash
mkdir my-ai-tools && cd my-ai-tools
python -m venv .venv
source .venv/bin/activate  # or .venv\Scripts\activate on Windows
```

2. **Install Matimo + the tool packages you want**

```bash
pip install matimo matimo[mcp]

# Add specific tool packages (optional)
pip install matimo-slack matimo-github matimo-gmail matimo-notion
```

3. **Set your API keys**

```bash
export SLACK_BOT_TOKEN=xoxb-your-slack-token
export GITHUB_TOKEN=ghp_your-github-token
```

4. **Start the server**

```python
# mcp_server.py
import asyncio
from matimo import Matimo
from matimo.mcp.server import MCPServer, MCPServerOptions

async def main():
    matimo = await Matimo.init(
        auto_discover=True,  # Discover installed tool packages
    )
    
    server = MCPServer(
        matimo,
        MCPServerOptions(transport="stdio")
    )
    
    await server.start()

if __name__ == "__main__":
    asyncio.run(main())
```

Then run:

```bash
python mcp_server.py
```

That's it. All installed `matimo-*` tools are auto-discovered and exposed over stdio.

---

## Step-by-Step Setup

### Prerequisites

- **Node.js 18+** — [Download](https://nodejs.org/)
- **npm or pnpm** — comes with Node.js

### Install packages

Pick the tool packages you need:

```bash
# Core + CLI (always required)
npm install @matimo/core @matimo/cli

# Add the tools you want
npm install @matimo/slack        # Slack messaging, channels, reactions
npm install @matimo/github       # GitHub repos, issues, PRs
npm install @matimo/gmail        # Gmail send, read, drafts
npm install @matimo/notion       # Notion pages, databases
npm install @matimo/hubspot      # HubSpot CRM, contacts, deals
npm install @matimo/postgres     # PostgreSQL queries
npm install @matimo/twilio       # SMS, MMS messaging
npm install @matimo/mailchimp    # Email campaigns, audiences
```

Or install everything at once:

```bash
npm install @matimo/core @matimo/cli @matimo/slack @matimo/github @matimo/gmail @matimo/notion @matimo/hubspot @matimo/postgres @matimo/twilio @matimo/mailchimp
```

### Set up API keys

Each tool package requires its own API credentials. Set them as environment variables:

```bash
# Slack
export SLACK_BOT_TOKEN=xoxb-your-token

# GitHub
export GITHUB_TOKEN=ghp_your-token

# Gmail
export GMAIL_ACCESS_TOKEN=ya29.your-token

# Notion
export NOTION_API_KEY=ntn_your-key

# HubSpot
export MATIMO_HUBSPOT_API_KEY=pat-your-key

# PostgreSQL
export MATIMO_POSTGRES_HOST=localhost
export MATIMO_POSTGRES_PORT=5432
export MATIMO_POSTGRES_USER=your-user
export MATIMO_POSTGRES_PASSWORD=your-password
export MATIMO_POSTGRES_DB=your-database

# Twilio
export TWILIO_ACCOUNT_SID=AC...
export TWILIO_AUTH_TOKEN=your-auth-token
export TWILIO_FROM_NUMBER=+1234567890

# Mailchimp
export MAILCHIMP_API_KEY=your-key-us1
```

> **Tip:** Use a `.env` file instead of exporting each variable. See [Secret Management](#secret-management).

### Verify your setup

```bash
npx matimo mcp setup
```

Sample output:

```
🔨 Matimo MCP Setup

Scanning for installed tool packages...

Found 21 tools across 2 package(s):

  📦 slack (15 tools)
     • slack_send_channel_message
     • slack_list_channels
     • slack_get_channel_history
     • slack_search_messages
     • slack_send_dm
     ... and 10 more

  📦 gmail (4 tools)
     • gmail-send-email
     • gmail-list-messages
     • gmail-get-message
     • gmail-create-draft

🔐 Required environment variables:

  ✅ SLACK_BOT_TOKEN
  ❌ GMAIL_ACCESS_TOKEN

📋 Claude Desktop config (paste into Settings → Developer → MCP Servers):

{
  "mcpServers": {
    "matimo": {
      "command": "npx",
      "args": ["matimo", "mcp"],
      "env": {
        "SLACK_BOT_TOKEN": "xoxb-your-token",
        "GMAIL_ACCESS_TOKEN": "<your-token>"
      }
    }
  }
}
```

---

## Client Configuration

### Claude Desktop

1. Open Claude Desktop
2. Go to **Settings → Developer → Edit Config**
3. Paste the config from `npx matimo mcp setup`, or use this template:

```json
{
  "mcpServers": {
    "matimo": {
      "command": "npx",
      "args": ["matimo", "mcp"],
      "env": {
        "SLACK_BOT_TOKEN": "xoxb-your-token",
        "GITHUB_TOKEN": "ghp_your-token"
      }
    }
  }
}
```

4. Restart Claude Desktop
5. Look for the 🔨 tools icon in the chat — your Matimo tools should appear

> **Important:** Claude Desktop runs commands from the root directory (`/`), not your project folder. If your tools aren't detected, add `"MATIMO_CWD": "/path/to/your/project"` to the `env` block to tell Matimo where to find your `node_modules`.

### Cursor

Create `.cursor/mcp.json` in your project root:

```json
{
  "mcpServers": {
    "matimo": {
      "command": "npx",
      "args": ["matimo", "mcp"],
      "env": {
        "SLACK_BOT_TOKEN": "xoxb-your-token",
        "GITHUB_TOKEN": "ghp_your-token"
      }
    }
  }
}
```

### Windsurf

Create `.windsurf/mcp.json` in your project root:

```json
{
  "mcpServers": {
    "matimo": {
      "command": "npx",
      "args": ["matimo", "mcp"],
      "env": {
        "SLACK_BOT_TOKEN": "xoxb-your-token",
        "GITHUB_TOKEN": "ghp_your-token"
      }
    }
  }
}
```

### Claude Desktop (Python)

1. Create a Python script to run the MCP server (e.g., `mcp_server.py`)
2. Open Claude Desktop
3. Go to **Settings → Developer → Edit Config**
4. Paste this config:

```json
{
  "mcpServers": {
    "matimo": {
      "command": "python",
      "args": ["/path/to/mcp_server.py"],
      "env": {
        "SLACK_BOT_TOKEN": "xoxb-your-token",
        "GITHUB_TOKEN": "ghp_your-token"
      }
    }
  }
}
```

5. Restart Claude Desktop
6. Look for the 🔨 tools icon — your Matimo tools should appear

### Cursor (Python)

Create `.cursor/mcp.json` in your project root:

```json
{
  "mcpServers": {
    "matimo": {
      "command": "python",
      "args": ["mcp_server.py"],
      "env": {
        "SLACK_BOT_TOKEN": "xoxb-your-token",
        "GITHUB_TOKEN": "ghp_your-token"
      }
    }
  }
}
```

### Windsurf (Python)

Create `.windsurf/mcp.json` in your project root:

```json
{
  "mcpServers": {
    "matimo": {
      "command": "python",
      "args": ["mcp_server.py"],
      "env": {
        "SLACK_BOT_TOKEN": "xoxb-your-token",
        "GITHUB_TOKEN": "ghp_your-token"
      }
    }
  }
}
```

### HTTP Mode (Remote / Docker)

For remote servers, Docker containers, or MCP clients that connect over HTTP/HTTPS:

```bash
npx matimo mcp --transport http --port 3000
```

The server auto-generates a bearer token on startup:

```
🚀 Matimo MCP server running at http://localhost:3000/mcp

🔐 Bearer Token (auto-generated):
   550e8400-e29b-41d4-a716-446655440000

   Connect your MCP client:
   url: http://localhost:3000/mcp
   Authorization: Bearer 550e8400-e29b-41d4-a716-446655440000

   To use a fixed token, set MATIMO_MCP_TOKEN or use --token <value>
```

Configure your MCP client with the displayed URL and token. For clients that support remote MCP:

```json
{
  "mcpServers": {
    "matimo": {
      "url": "http://your-server:3000/mcp",
      "headers": {
        "Authorization": "Bearer 550e8400-e29b-41d4-a716-446655440000"
      }
    }
  }
}
```

#### Python HTTP Mode

Start the server:

```python
# mcp_server_http.py
import asyncio
from matimo import Matimo
from matimo.mcp.server import MCPServer, MCPServerOptions

async def main():
    matimo = await Matimo.init(auto_discover=True)
    
    server = MCPServer(
        matimo,
        MCPServerOptions(
            transport="http",
            port=3000,
            mcp_token="your-secret-token"  # or use MATIMO_MCP_TOKEN env var
        )
    )
    
    await server.start()

if __name__ == "__main__":
    asyncio.run(main())
```

Then run:

```bash
python mcp_server_http.py
```

Configure your MCP client:

```json
{
  "mcpServers": {
    "matimo": {
      "url": "http://localhost:3000/mcp",
      "headers": {
        "Authorization": "Bearer your-secret-token"
      }
    }
  }
}
```

---

## Available Tool Packages

| Package | Tools | Required Env Vars |
|---------|-------|-------------------|
| `@matimo/slack` | Send messages, list channels, search, reactions, threads, file uploads, DMs, create channels, set topics | `SLACK_BOT_TOKEN` |
| `@matimo/github` | Repository management, issues, pull requests, code search | `GITHUB_TOKEN` |
| `@matimo/gmail` | Send email, list messages, read messages, create drafts, delete | `GMAIL_ACCESS_TOKEN` |
| `@matimo/notion` | Pages, databases, blocks, search | `NOTION_API_KEY` |
| `@matimo/hubspot` | Contacts, companies, deals, tickets, engagements | `MATIMO_HUBSPOT_API_KEY` |
| `@matimo/postgres` | Execute SQL queries (read + write) | `MATIMO_POSTGRES_HOST`, `_PORT`, `_USER`, `_PASSWORD`, `_DB` |
| `@matimo/twilio` | Send SMS/MMS, manage messages | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` |
| `@matimo/mailchimp` | Audiences, subscribers, campaigns | `MAILCHIMP_API_KEY` |

### Auto-Discovery Mechanism

Both TypeScript and Python SDKs discover tools identically via **entry points + filesystem scan**:

#### How It Works

When you call `MatimoInstance.init(autoDiscover: true)` or `Matimo.init(auto_discover=True)`:

1. **Entry Points Discovery** — Scans installed `@matimo/*` (TypeScript) or `matimo-*` (Python) packages
2. **Filesystem Scan** — Recursively scans `toolPaths` for tool definitions (YAML or JavaScript/Python files)
3. **Registry** — Registers all discovered tools so they're available over MCP

#### Auto-Discovered Tool Inventory

| Provider | Tool Count | Status |
|----------|-----------|--------|
| **Core** | 136 | Included by default |
| `@matimo/slack` (or `matimo-slack`) | 16 | Requires `@matimo/slack` package + `SLACK_BOT_TOKEN` |
| `@matimo/github` (or `matimo-github`) | 22 | Requires `@matimo/github` package + `GITHUB_TOKEN` |
| `@matimo/gmail` (or `matimo-gmail`) | 5 | Requires `@matimo/gmail` package + `GMAIL_ACCESS_TOKEN` |
| `@matimo/notion` (or `matimo-notion`) | 7 | Requires `@matimo/notion` package + `NOTION_API_KEY` |
| `@matimo/postgres` (or `matimo-postgres`) | 1 | Requires `@matimo/postgres` package + `MATIMO_POSTGRES_*` |
| `@matimo/twilio` (or `matimo-twilio`) | 4 | Requires `@matimo/twilio` package + `TWILIO_*` |
| `@matimo/hubspot` (or `matimo-hubspot`) | 50 | Requires `@matimo/hubspot` package + `MATIMO_HUBSPOT_API_KEY` |
| `@matimo/mailchimp` (or `matimo-mailchimp`) | 7 | Requires `@matimo/mailchimp` package + `MAILCHIMP_API_KEY` |
| **Total (all providers installed)** | **248** | — |
| **Total (default, core only)** | **136** | — |

#### TypeScript Example

```typescript
import { MatimoInstance } from '@matimo/core';

// Auto-discover all installed @matimo/* packages
const matimo = await MatimoInstance.init({
  autoDiscover: true,
  // Optional: add custom tool directories
  toolPaths: ['./my-tools', '/path/to/other-tools'],
});

// Print what was discovered
const tools = matimo.listTools();
console.log(`✓ Discovered ${tools.length} tools`);

// Start the MCP server
const server = new MCPServer(matimo, { transport: 'stdio' });
await server.start();
```

#### Python Example

```python
from matimo import Matimo
from matimo.mcp.server import MCPServer, MCPServerOptions

# Auto-discover all installed matimo-* packages
matimo = await Matimo.init(
    auto_discover=True,
    # Optional: add custom tool directories
    tool_paths=['./my-tools', '/path/to/other-tools'],
)

# Print what was discovered
tools = matimo.list_tools()
print(f'✓ Discovered {len(tools)} tools')

# Start the MCP server
server = MCPServer(matimo, MCPServerOptions(transport='stdio'))
await server.start()
```

#### Feature Parity Verification (v0.1.0-alpha.14)

| Aspect | TypeScript | Python | Test Result |
|--------|-----------|--------|------------|
| Entry points discovery | ✅ | ✅ | ✅ IDENTICAL |
| Filesystem scan | ✅ | ✅ | ✅ IDENTICAL |
| Slack tools discovered | 16 | 16 | ✅ IDENTICAL |
| GitHub tools discovered | 22 | 22 | ✅ IDENTICAL |
| Gmail tools discovered | 5 | 5 | ✅ IDENTICAL |
| Notion tools discovered | 7 | 7 | ✅ IDENTICAL |
| Postgres tools discovered | 1 | 1 | ✅ IDENTICAL |
| Twilio tools discovered | 4 | 4 | ✅ IDENTICAL |
| HubSpot tools discovered | 50 | 50 | ✅ IDENTICAL |
| Mailchimp tools discovered | 7 | 7 | ✅ IDENTICAL |
| Core tools built-in | 136 | 136 | ✅ IDENTICAL |
| Custom tools (example: PostgreSQL DBA) | 7 | 7 | ✅ IDENTICAL |
| **Total tools on discovery** | **248** | **248** | **✅ 100% PARITY** |

**Tested configuration:** Both `python/examples/mcp/` and `typescript/examples/mcp/` with all `@matimo/*`/`matimo-*` packages installed + TypeScript example tools.

---

## CLI Reference

```
matimo mcp [options]          Start the MCP server
matimo mcp setup              Run the setup wizard
```

### Options

| Flag | Short | Default | Description |
|------|-------|---------|-------------|
| `--transport` | `-t` | `stdio` | Transport mode: `stdio` or `http` |
| `--port` | `-p` | `3000` | HTTP port (only with `--transport http`) |
| `--tools` | | all | Comma-separated allowlist of tool names |
| `--exclude` | | none | Comma-separated denylist of tool names |
| `--token` | | auto | Bearer token for HTTP mode. Auto-generated if not set. Also reads `MATIMO_MCP_TOKEN` env var. |
| `--https` | | off | Enable HTTPS |
| `--self-signed` | | off | Auto-generate a self-signed TLS cert (implies `--https`) |
| `--cert` | | | Path to TLS certificate PEM file (implies `--https`) |
| `--key` | | | Path to TLS private key PEM file (implies `--https`) |
| `--secrets` | | `env` | Secret resolver chain: `env`, `dotenv`, `vault`, `aws` |
| `--env-file` | | `.env` | Path to .env file (with `--secrets dotenv`) |
| `--vault-path` | | `secret/data/matimo` | Vault KV v2 path (with `--secrets vault`) |
| `--aws-secret-id` | | `matimo/credentials` | AWS Secrets Manager ID (with `--secrets aws`) |
| `--tool-paths` | | auto | Comma-separated paths to tool directories |

### Examples

```bash
# Default: stdio mode for Claude Desktop / Cursor
npx matimo mcp

# HTTP mode on custom port
npx matimo mcp --transport http --port 8080

# Only expose specific tools
npx matimo mcp --tools slack_send_channel_message,slack_list_channels

# Expose everything except Postgres tools
npx matimo mcp --exclude postgres_execute_sql

# HTTP with explicit bearer token
npx matimo mcp --transport http --token my-secret-token

# HTTPS with auto-generated self-signed certificate
npx matimo mcp --transport http --self-signed

# HTTPS with your own certificates
npx matimo mcp --transport http --cert /path/to/cert.pem --key /path/to/key.pem

# HTTPS + custom port + fixed token
npx matimo mcp --transport http --port 8443 --self-signed --token my-secret

# Use .env file for secrets
npx matimo mcp --secrets dotenv --env-file ./config/.env

# Chain resolvers: try env vars first, then Vault
npx matimo mcp --secrets env,vault --vault-path secret/data/matimo
```

---

## HTTP Mode

HTTP mode runs a stateful HTTP server for remote access, Docker containers, or MCP clients that support HTTP transport.

### Endpoints

| Method | Path | Auth Required | Description |
|--------|------|---------------|-------------|
| `POST` | `/mcp` (or `/`) | Yes | Start a new MCP session (JSON-RPC initialize) |
| `GET` | `/mcp` (or `/`) | Yes | Open SSE stream for an existing session (`Mcp-Session-Id` header required) |
| `DELETE` | `/mcp` (or `/`) | Yes | Close an existing session (`Mcp-Session-Id` header required) |
| `GET` | `/health` | No | Health check — returns `{"status":"ok","tools":<count>}` |
| `OPTIONS` | `*` | No | CORS preflight |

### Bearer Token Authentication

HTTP mode **always** requires a bearer token. The server handles this automatically:

| Priority | Source | Example |
|----------|--------|---------|
| 1st | `--token` flag | `--token my-secret` |
| 2nd | `MATIMO_MCP_TOKEN` env var | `export MATIMO_MCP_TOKEN=my-secret` |
| 3rd | Auto-generated | UUID printed to console on startup |

Clients must include `Authorization: Bearer <token>` in every request (except `/health`).

```bash
# Test health (no auth needed)
curl http://localhost:3000/health

# Test auth — initialize a new session
curl -H "Authorization: Bearer <token>" \
     -H "Content-Type: application/json" \
     -H "Accept: application/json, text/event-stream" \
     -H "MCP-Protocol-Version: 2025-11-25" \
     -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-11-25","capabilities":{},"clientInfo":{"name":"test","version":"0.1.0"}}}' \
     http://localhost:3000/mcp
```

> **Note:** The [MCP spec](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports#protocol-version-header)
> requires clients to include an `MCP-Protocol-Version` header on all requests after initialization.
> The server currently accepts requests without this header for backwards compatibility.

> **Tip:** For production, set a fixed token with `MATIMO_MCP_TOKEN` or `--token` so it survives server restarts.

### MCP Spec Compliance Notes

Matimo HTTP mode is built on the official `@modelcontextprotocol/sdk` and implements the
[Streamable HTTP transport](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports#streamable-http)
specification. The following areas are fully compliant:

- ✅ Stateful sessions via `Mcp-Session-Id` (SDK-managed)
- ✅ Per-session `McpServer` instance (not shared across clients)
- ✅ Bearer token authentication
- ✅ `POST /mcp` for JSON-RPC, `GET /mcp` for SSE, `DELETE /mcp` for session close
- ✅ `isError: true` in tool failure responses
- ✅ stdio mode: no non-JSON-RPC output on stdout (logger silenced)

Known gaps against the spec (tracked for a future release):

| Gap | Spec requirement | Impact |
|-----|-----------------|--------|
| `Origin` header not validated | [Spec §2.0.1](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports#security-warning): servers **MUST** validate `Origin` to prevent DNS rebinding | Local-only servers using `--self-signed` are lower risk; production servers behind a reverse proxy should add `Origin` validation at the proxy layer |
| Binds to all interfaces (`0.0.0.0`) | Spec §2.0.1: servers **SHOULD** bind to `127.0.0.1` when running locally | Avoid exposing the port publicly without a firewall rule or reverse proxy |
| `MCP-Protocol-Version` header not enforced | [Spec §2.7](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports#protocol-version-header): invalid version must return `400` | No impact with current MCP SDK clients; all known clients send a valid version |

### HTTPS

Enable HTTPS for encrypted connections. Two options:

#### Self-signed certificate (development)

```bash
npx matimo mcp --transport http --self-signed
```

- Generates an RSA 2048 key + X.509 certificate via `openssl` (key via Node.js `crypto`)
- SAN covers `DNS:localhost` and `IP:127.0.0.1`, valid for 365 days
- Cached in `.matimo/certs/` — reused across restarts
- Because the cert is self-signed, clients won't trust it by default — see
  [HTTPS client can't connect (self-signed cert)](#https-client-cant-connect-self-signed-cert)
  for options ranked by security

Output:

```
🚀 Matimo MCP server running at https://localhost:3000/mcp
🔒 HTTPS enabled (self-signed certificate)
   ⚠️  Clients may need to disable cert verification for self-signed certs

🔐 Bearer Token (auto-generated):
   07b9b426-5f26-4149-9f12-5f83224ceffe
```

#### Production certificates

```bash
npx matimo mcp --transport http --cert /etc/ssl/cert.pem --key /etc/ssl/key.pem
```

Use certificates from Let's Encrypt, your cloud provider, or your internal CA.

### Docker

```dockerfile
FROM node:20-alpine

# openssl needed for self-signed cert generation
RUN apk add --no-cache openssl

# Install Matimo globally
RUN npm install -g @matimo/core @matimo/cli @matimo/slack @matimo/github

EXPOSE 3000

CMD ["matimo", "mcp", "--transport", "http", "--port", "3000", "--self-signed"]
```

```bash
# Build
docker build -t matimo-mcp .

# Run with your API keys
docker run -p 3000:3000 \
  -e SLACK_BOT_TOKEN=xoxb-your-token \
  -e GITHUB_TOKEN=ghp_your-token \
  -e MATIMO_MCP_TOKEN=my-secret \
  matimo-mcp
```

For production, mount real certificates instead of using `--self-signed`:

```bash
docker run -p 3000:3000 \
  -v /etc/letsencrypt/live/mydomain:/certs:ro \
  -e SLACK_BOT_TOKEN=xoxb-your-token \
  -e MATIMO_MCP_TOKEN=my-secret \
  matimo-mcp \
  matimo mcp --transport http --cert /certs/fullchain.pem --key /certs/privkey.pem
```

---

## Secret Management

The MCP server needs API keys and tokens to call tool APIs. Matimo supports four secret resolver backends that can be chained.

### How It Works

1. On startup, the server scans all tool definitions for auth placeholders (e.g., `{SLACK_BOT_TOKEN}`)
2. The secret resolver chain resolves each placeholder — **first resolver to return a value wins**
3. Resolved secrets are seeded into `process.env` so tool execution works seamlessly

### Resolver: `env` (Default)

Reads from environment variables. Checks `MATIMO_<KEY>` first, then `<KEY>`.

```bash
export SLACK_BOT_TOKEN=xoxb-your-token
npx matimo mcp
```

### Resolver: `dotenv`

Reads from a `.env` file. Great for development.

```ini
# .env
SLACK_BOT_TOKEN=xoxb-your-token
GITHUB_TOKEN=ghp_your-token
```

```bash
npx matimo mcp --secrets dotenv
npx matimo mcp --secrets dotenv --env-file ./config/.env
```

### Resolver: `vault`

Reads from HashiCorp Vault KV v2. Requires `node-vault` peer dependency.

```bash
npm install node-vault

export VAULT_ADDR=https://vault.example.com
export VAULT_TOKEN=hvs.your-token

npx matimo mcp --secrets vault --vault-path secret/data/matimo
```

Features: TTL-based caching (5 min default), stale fallback on connection errors, namespace support.

### Resolver: `aws`

Reads from AWS Secrets Manager. Requires `@aws-sdk/client-secrets-manager` peer dependency.

```bash
npm install @aws-sdk/client-secrets-manager

# Store secrets as JSON in AWS Secrets Manager:
# Secret name: matimo/credentials
# Secret value: {"SLACK_BOT_TOKEN": "xoxb-...", "GITHUB_TOKEN": "ghp_..."}

npx matimo mcp --secrets aws --aws-secret-id matimo/credentials
```

Features: TTL-based caching (5 min), uses standard AWS credential chain (env, IAM roles, SSO).

### Chaining Resolvers

Resolvers are tried in order. First match wins.

```bash
# Local dev: .env file first, then Vault as fallback
npx matimo mcp --secrets dotenv,vault

# Production: env vars first, then AWS
npx matimo mcp --secrets env,aws
```

---

## Tool Filtering

### Allowlist — only expose specific tools

```bash
npx matimo mcp --tools slack_send_channel_message,slack_list_channels
```

### Denylist — expose everything except certain tools

```bash
npx matimo mcp --exclude postgres_execute_sql
```

### Both — allowlist first, then denylist filters the result

```bash
npx matimo mcp --tools slack_send_channel_message,slack_delete_message --exclude slack_delete_message
```

---

## Approval-Required Tools

Tools with `requires_approval: true` in their YAML definition are gated for safety:

1. First call → server returns an error explaining approval is required
2. Client re-invokes with `_matimo_approved: true` in the arguments
3. Second call → tool executes normally

This prevents accidental destructive operations (deletes, drops, etc.).

---

## Programmatic Usage

Use the MCP server directly from TypeScript:

```typescript
import { MCPServer, createMCPServer } from '@matimo/core';

// One-liner: start with defaults
const server = await createMCPServer({
  transport: 'stdio',
  autoDiscover: true,
});

// Or with full control
const server = new MCPServer({
  transport: 'http',
  port: 3000,
  tools: ['slack_send_channel_message'],
  mcpToken: 'my-secret',
  https: true,
  selfSigned: true,
  secretResolver: {
    resolvers: [
      { type: 'env' },
      { type: 'vault', secretPath: 'secret/data/myapp' },
    ],
  },
});

await server.start();

// Get the active token (useful when auto-generated)
const token = server.getActiveToken();
console.log(`Token: ${token}`);

// Later...
await server.stop();
```

### MCPServerOptions

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `transport` | `'stdio' \| 'http'` | `'stdio'` | Transport mode |
| `port` | `number` | `3000` | HTTP port |
| `tools` | `string[]` | all | Tool name allowlist |
| `excludeTools` | `string[]` | none | Tool name denylist |
| `mcpToken` | `string` | auto-generated | Bearer token for HTTP mode |
| `toolPaths` | `string[]` | auto | Explicit tool directory paths |
| `autoDiscover` | `boolean` | `true` | Auto-discover `@matimo/*` packages |
| `https` | `boolean` | `false` | Enable HTTPS |
| `selfSigned` | `boolean` | `false` | Auto-generate self-signed certificate |
| `certPath` | `string` | | Path to TLS certificate PEM |
| `keyPath` | `string` | | Path to TLS private key PEM |
| `secretResolver` | `SecretResolverChainConfig` | env-only | Secret resolver chain config |

---

## Architecture

```
Client (Claude Desktop / Cursor / Windsurf / HTTP Client)
  │
  │  MCP Protocol (JSON-RPC over stdio or HTTP+SSE)
  ▼
MCPServer
  ├─ SecretResolverChain → env / dotenv / vault / aws
  │    └─ Seeds process.env with resolved secrets
  ├─ MatimoInstance.init(autoDiscover: true)
  │    ├─ Entry points discovery → Scans @matimo/* (TS) or matimo-* (PY) packages
  │    │    └─ Finds installed tool provider packages via package.json or pkg_resources
  │    ├─ Filesystem scan → Recursively scans toolPaths directories
  │    │    └─ Finds YAML + JavaScript/Python tool definitions
  │    └─ Registry → Registers all discovered tools (248 max with all providers)
  ├─ Filters tools (allow/deny lists)
  ├─ Registers each tool on McpServer (MCP SDK)
  │    └─ Converts YAML params → Zod schemas (TS) / Pydantic models (PY) → MCP input schemas
  └─ Connects transport
       ├─ stdio: StdioServerTransport (local clients)
       └─ http/https: StreamableHTTPServerTransport + Bearer auth

Tool Call Flow:
  Client → tools/call → MCPServer handler
    → matimo.execute(toolName, args)
      → Auth injection (from process.env)
      → Executor (HTTP / Command / Function)
      → Validate response against output_schema
      → Return as MCP content
```

### Python Implementation Details

The Python MCP implementation mirrors TypeScript with full feature parity:

#### Core Features

| Component | TypeScript | Python | Details |
|-----------|-----------|--------|---------|
| Core server | `MCPServer` | `MCPServer` | Wraps Matimo instance, registers MCP handlers |
| Auth filtering | `isAuthParameter()` | `_is_auth_parameter()` | Strips secrets from schemas |
| Approval gating | `toolToMcpRegistration()` | `tool_to_mcp_registration()` | Adds `_matimo_approved` parameter |
| Secret resolution | `seedEnvironmentSecrets()` | `_seed_environment_secrets()` | Pre-resolves at startup, stores in memory |
| Skill resources | `registerSkillResources()` | `_register_skill_resources()` | Registers skills as MCP resources |
| HTTP transport | `StreamableHTTPServerTransport` | `StreamableHTTPSessionManager` | Stateless HTTP with bearer auth, CORS |
| Stdio transport | `StdioServerTransport` | `stdio_server()` | JSON-RPC over pipe for Claude Desktop |

#### Auto-Discovery Implementation

| Aspect | TypeScript | Python | Status |
|--------|-----------|--------|--------|
| Entry points scanner | `@oclif/core` entry points | `importlib.metadata` entry points | ✅ Identical |
| Filesystem traversal | `fs.readdirSync()` recursive scan | `os.walk()` recursive scan | ✅ Identical |
| YAML loading | `js-yaml` + Zod validation | PyYAML + Pydantic validation | ✅ Identical |
| Caching | In-memory Map | In-memory dict | ✅ Identical |
| Tools loaded (all providers) | 248 | 248 | ✅ 100% Parity |
| Discovery mechanism | Same | Same | ✅ Identical |

**Key locations:**
- **TypeScript:** `typescript/packages/core/src/core/tool-loader.ts` (entry points + filesystem)
- **Python:** `python/packages/core/src/matimo/core/loader.py` (entry points + filesystem)

**Language differences:**
1. **Entry points library:** TypeScript uses `@oclif/core`, Python uses `importlib.metadata`
2. **Filesystem scanning:** TypeScript uses `fs.*`, Python uses `os.*`
3. **YAML parsing:** Both use standard libraries with Zod (TS) / Pydantic (PY) validation
4. **Async/Await:** Python is async-first; TypeScript is top-level await

#### Other Implementation Details

**Key differences:**

1. **Language:** Python uses async/await throughout; TypeScript uses top-level await
2. **HTTP:** Python uses pure-ASGI with async context management; TypeScript uses Node HTTP + Node streams
3. **Secret storage:** Both store in memory **after resolution**, never written back to process env — Python uses `dict[str, str]`, TypeScript uses `Record<string, string>`
4. **Test coverage:** Both at 95%+ — 824 Python tests, 1884 TypeScript tests

For full implementation details, see [python/packages/core/src/matimo/mcp/README.md](../../python/packages/core/src/matimo/mcp/README.md).

---

## Troubleshooting

### TypeScript

#### Tools not showing up in Claude Desktop

1. **Check your config path:** On macOS it's `~/Library/Application Support/Claude/claude_desktop_config.json`
2. **Restart Claude Desktop** after editing the config
3. **Add `MATIMO_CWD`** to the env block if your tools aren't detected:
   ```json
   "env": {
     "MATIMO_CWD": "/Users/you/your-project",
     "SLACK_BOT_TOKEN": "xoxb-..."
   }
   ```
4. **Run the setup wizard** to verify packages are installed:
   ```bash
   npx matimo mcp setup
   ```

#### No tools found / "No @matimo/* tool packages found"

Make sure `@matimo/*` packages are installed in your project:

```bash
npm ls | grep matimo
# Should show @matimo/core, @matimo/cli, @matimo/slack, etc.
```

If empty, install them:

```bash
npm install @matimo/core @matimo/cli @matimo/slack
```

#### "Tool requires approval"

The tool has `requires_approval: true`. The MCP client must re-invoke with `_matimo_approved: true` in the arguments. This is by design for destructive operations.

#### Self-signed certificate fails to generate

Requires `openssl` to be installed:

```bash
# macOS (pre-installed)
openssl version

# Linux (Debian/Ubuntu)
sudo apt install openssl

# Alpine (Docker)
apk add --no-cache openssl

# Or skip self-signed and provide your own certs:
npx matimo mcp --transport http --cert cert.pem --key key.pem
```

#### HTTPS client can't connect (self-signed cert)

Self-signed certificates are not trusted by default. There are several ways to handle this,
ordered from **most** to **least** secure.

---

#### ✅ Option 1 — Use a locally trusted certificate (recommended)

[`mkcert`](https://github.com/FiloSottile/mkcert) creates certificates signed by a local CA that
your OS and browser trust automatically. No bypass needed, no security warnings.

```bash
# Install mkcert
brew install mkcert          # macOS
sudo apt install mkcert      # Linux (or build from source)

# One-time: trust the local CA system-wide
mkcert -install

# Generate a cert for localhost
mkcert localhost 127.0.0.1 ::1
# → produces localhost+2.pem and localhost+2-key.pem

# Start Matimo MCP with the trusted cert
npx matimo mcp --transport http --cert localhost+2.pem --key localhost+2-key.pem
```

All clients (curl, Node.js, browsers) on the same machine now connect without any special flags.

---

#### ✅ Option 2 — Use a CA-trusted certificate

For staging or shared environments, use a certificate from a public CA (e.g. Let's Encrypt) or
your organisation's internal CA. Pass it to the server:

```bash
npx matimo mcp --transport http --cert cert.pem --key key.pem
```

---

#### ⚠️ Option 3 — Narrow TLS bypass for development clients only

If you can't use a trusted certificate, scope the bypass to **only** the MCP connection rather
than the entire Node process.

**curl** — the `-k` / `--insecure` flag applies to that request only:

```bash
curl -k https://localhost:3000/health
```

**Node.js** — pass a custom `https.Agent` scoped to your MCP client.
Never set `process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'`; it disables certificate validation
globally for every HTTPS request in the process, including requests to OpenAI, Slack, or any
other service.

```ts
import https from 'https';

// ⚠️ Development only — never use rejectUnauthorized: false in production
const devAgent = new https.Agent({ rejectUnauthorized: false });

const client = new MultiServerMCPClient({
  mcpServers: {
    matimo: {
      transport: 'streamable_http',
      url: 'https://localhost:3000/mcp',
      // Pass the agent via fetch options if your MCP client supports it.
    },
  },
});
```

> **Security note:** Disabling certificate verification, even for a single connection, allows
> an attacker on the same network to impersonate the server, intercept the bearer token, and
> issue arbitrary tool calls. Only ever do this on a loopback interface (`localhost` /
> `127.0.0.1`) in a controlled local development environment. **Never use it in production,
> CI/CD pipelines, or shared environments.**

#### Debug logging

Enable verbose logging to see tool discovery, auth resolution, and execution details:

```bash
MATIMO_LOG_LEVEL=debug npx matimo mcp
```

> **Note:** Debug logging is automatically silenced in stdio mode (stdout must be clean JSON-RPC). Logs go to stderr in stdio mode.

#### Optional peer dependencies

Vault and AWS secret resolvers require extra packages:

```bash
npm install node-vault                        # For --secrets vault
npm install @aws-sdk/client-secrets-manager   # For --secrets aws
```

---

## Troubleshooting (Python)

### "MCP Python SDK not installed"

Error: `MatimoError(EXECUTION_FAILED): MCP Python SDK not installed. Install with: pip install matimo[mcp]`

**Solution:**

```bash
pip install matimo[mcp]
# or explicitly
pip install mcp>=1.0
```

### No tools discovered

Error: Tools list is empty in Claude Desktop

**Solution:**

1. Verify Matimo can find your tools:

```python
from matimo import Matimo

matimo = await Matimo.init(auto_discover=True)
print(f"Found {len(matimo.list_tools())} tools")
```

2. If empty, ensure tool packages are installed:

```bash
pip list | grep matimo
# Should show matimo, matimo-slack, matimo-github, etc.
```

3. If missing, install them:

```bash
pip install matimo matimo-slack matimo-github
```

### "Stdio mode corrupt output / JSON-RPC decode error"

Cause: Logging to stdout during stdio transport interferes with JSON-RPC

**Solution:** Already fixed in the implementation — `start()` suppresses the matimo logger in stdio mode. If you see this error, check for custom log handlers writing to stdout:

```python
# ❌ DON'T do this
import logging
logging.basicConfig(stream=sys.stdout, level=logging.DEBUG)

# ✅ DO this instead (if you need logging)
logging.basicConfig(stream=sys.stderr, level=logging.DEBUG)
```

### HTTP 401 Unauthorized

Error: `401 Unauthorized` when connecting to HTTP mode

**Solution:**

1. Check the bearer token is set:

```bash
export MATIMO_MCP_TOKEN="your-secret-token"
python mcp_server.py
```

2. Pass it in the MCP client config:

```json
{
  "mcpServers": {
    "matimo": {
      "url": "http://localhost:3000/mcp",
      "headers": {
        "Authorization": "Bearer your-secret-token"
      }
    }
  }
}
```

### Secrets not resolved

Error: `KeyError: 'SLACK_BOT_TOKEN'` during tool execution

**Solution:**

Ensure your `.env` file is readable and in the project root:

```bash
# .env
SLACK_BOT_TOKEN=xoxb-your-token
GITHUB_TOKEN=ghp_your-token
```

Also verify Matimo is initialized with proper paths:

```python
from matimo import Matimo

matimo = await Matimo.init(
    ["./tools"],  # ← tool paths
    auto_discover=True
)
```

### asyncio event loop errors

Error: `RuntimeError: no running event loop` or `RuntimeError: asyncio.run() called from a running event loop`

**Solution:**

Use `asyncio.run()` at the top level:

```python
import asyncio

async def main():
    matimo = await Matimo.init(auto_discover=True)
    # ...

# ✅ Start the event loop here
if __name__ == "__main__":
    asyncio.run(main())
```

Don't call `asyncio.run()` from inside async functions or Jupyter notebooks with existing loops.
