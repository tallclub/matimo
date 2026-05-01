# Matimo MCP + LangChain Examples

LangChain ReAct agents that connect to **Matimo MCP** via **stdio** and **Streamable HTTP** transports, testing all 12 Slack tools end-to-end using [`@langchain/mcp-adapters`](https://www.npmjs.com/package/@langchain/mcp-adapters).

---

## Prerequisites

### 1. Install dependencies

```bash
cd examples/mcp
pnpm install
```

### 2. Create a `.env` file

Copy `.env.example` and fill in your values:

```env
# Required
OPENAI_API_KEY=sk-xxxxxxxxxxxxx
SLACK_BOT_TOKEN=xoxb-xxxxxxxxxxxxx

# Required for HTTP transport (must match the server token)
MATIMO_MCP_TOKEN=matimo-dev-token

# Optional: pin a specific channel; otherwise auto-detected
TEST_CHANNEL=C0123456789
```

> **Where to get these:**
> - `OPENAI_API_KEY` → [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
> - `SLACK_BOT_TOKEN` → [api.slack.com/apps](https://api.slack.com/apps) → OAuth & Permissions → Bot Token
> - `TEST_CHANNEL` → Right-click a Slack channel → Copy link → extract the `C…` ID

---

## Quick Start

### Stdio transport (simplest — no server to start)

```bash
pnpm agent:stdio
```

The agent **spawns `matimo mcp`** as a subprocess automatically. No separate server needed.

```bash
# Optional: target a specific channel
pnpm agent:stdio -- --channel=C0123456789
```

### Streamable HTTP transport (remote / networked)

**Step 1 — Start the MCP server:**

```bash
pnpm mcp:start:http
# equivalent: npx matimo mcp --transport http --port 3555
```

The server reads `MATIMO_MCP_TOKEN` from your `.env` automatically and starts on **plain HTTP**
on `localhost:3555`. This is the recommended setup for local development — no TLS required.

> **Want HTTPS locally?** Run `matimo mcp --transport http --port 3555 --self-signed` and
> set `MCP_SERVER_URL=https://localhost:3555/mcp` in `.env`. You'll need to trust the generated
> cert (`mkcert -install`) — see the [TLS troubleshooting guide](../../docs/MCP.md#https-client-cant-connect-self-signed-cert).

**Step 2 — Run the agent:**

```bash
pnpm agent:http

# Optional: target a specific channel
pnpm agent:http -- --channel=C0123456789
```

Verify the server is up before running the agent:

```bash
curl http://localhost:3555/health
# → {"status":"ok","tools":27}
```

### Unified agent (stdio / HTTP / multi in one script)

```bash
# Stdio — no server needed (default)
pnpm agent -- --stdio

# HTTP — requires a running server
pnpm agent -- --http

# HTTP with explicit token
pnpm agent -- --http --url http://localhost:3555/mcp --token matimo-dev-token

# Multi-server — merge stdio + HTTP tools
pnpm agent -- --multi --token matimo-dev-token
```

---

## What the Examples Test

Both `agent-stdio.ts` and `agent-http.ts` run the **same 12 Slack tools in order**:

| # | Tool | What it does |
|---|------|-------------|
| 1 | `slack-list-channels` | List all workspace channels (used to auto-detect test channel) |
| 2 | `slack_create_channel` | Create a new private channel |
| 3 | `slack_send_channel_message` | Send a text message to the channel |
| 4 | `slack_get_channel_history` | Retrieve the last 5 messages |
| 5 | `slack_add_reaction` | Add a 🚀 reaction to the latest message |
| 6 | `slack_get_reactions` | Read reactions on a message |
| 7 | `slack_reply_to_message` | Post a threaded reply |
| 8 | `slack_get_thread_replies` | Read replies in the thread |
| 9 | `slack_search_messages` | Search channel messages by keyword |
| 10 | `slack_get_user_info` | Look up a Slack user by ID |
| 11 | `slack_set_channel_topic` | Update the channel topic |
| 12 | `slack_send_dm` | Send a direct message to a user |

Each task is counted as **passed** or **failed** and a summary is printed at the end.  
Tasks that fail (e.g., missing OAuth scopes) are caught individually and do not block subsequent tasks.

> **Note on Slack bot token scopes:** Some tools require additional scopes on your Slack app:
> `groups:write` (create channel), `reactions:write/read`, `users:read`, `channels:history`.
> Search (`slack_search_messages`) requires a user token — bot tokens cannot use the Search API.

---

## File Structure

```
examples/mcp/
├── .env                 # Your secrets (gitignored)
├── .env.example         # Template — copy to .env
├── package.json
└── src/
    ├── agent-stdio.ts   # All 12 Slack tools — stdio transport
    ├── agent-http.ts    # All 12 Slack tools — HTTP transport
    └── agent.ts         # Unified agent (--stdio / --http / --multi flags)
```

---

## How It Works

```
┌──────────────────────────────┐
│  LangChain ReAct Agent       │   createReactAgent (langgraph/prebuilt)
│  ChatOpenAI (gpt-4o-mini)    │   MultiServerMCPClient (mcp-adapters)
└─────────────┬────────────────┘
              │
        ┌─────┴──────┐
        │             │
     Stdio          HTTP
        │             │
        ▼             ▼
  ┌──────────┐  ┌───────────┐
  │ matimo    │  │ matimo    │
  │ mcp       │  │ mcp       │
  │ (child    │  │ --http    │
  │ process)  │  │ :3555     │
  └──────────┘  └───────────┘
        │             │
        └──────┬──────┘
               ▼
      ┌─────────────────┐
      │  @matimo/slack   │  16 tools auto-discovered
      │  @matimo/gmail   │   5 tools auto-discovered
      │  core tools      │   6 tools (calc, read, edit…)
      └─────────────────┘
```

### Channel auto-detection

If `TEST_CHANNEL` is not set and no `--channel=` flag is provided, the agent calls
`slack-list-channels` first and extracts the first public channel ID from the response.
This channel is then used for all subsequent tasks in the same run.

### Stdio transport
- `MultiServerMCPClient` spawns `npx matimo mcp` as a child process
- Communication over stdin/stdout via the MCP protocol
- Tools are auto-discovered from installed `@matimo/*` packages
- No server setup required — ideal for local development and CI

### Streamable HTTP transport
- Connects to a running `matimo mcp --transport http` server
- Authenticates with a bearer token (`MATIMO_MCP_TOKEN` / `Authorization: Bearer …`)
- The token is loaded from `.env` by the server automatically (no need to pass it on the CLI)
- Supports SSE fallback for compatibility with older clients
- Ideal for remote/shared servers and production deployments

---

## Environment Variables

| Variable | Description | Required |
|----------|-------------|---------|
| `OPENAI_API_KEY` | OpenAI API key | ✅ |
| `SLACK_BOT_TOKEN` | Slack bot token (`xoxb-…`) | ✅ |
| `MATIMO_MCP_TOKEN` | Bearer token shared between server and HTTP agent | HTTP only |
| `TEST_CHANNEL` | Slack channel ID to use (`C…`) | Optional |
| `MCP_SERVER_URL` | Override HTTP server URL | Optional (default: `http://localhost:3555/mcp`) |
| `MCP_BEARER_TOKEN` | Alias for `MATIMO_MCP_TOKEN` (takes precedence) | Optional |
| `OPENAI_MODEL` | OpenAI model name | Optional (default: `gpt-4o-mini`) |

---

## VS Code Integration

Connect the TypeScript HTTP server to **VS Code Copilot Chat**.

### Step 1 — Start the MCP server
```bash
cd typescript
pnpm mcp:start:http
# equivalent: npx matimo mcp --transport http --port 3555
# Server starts on http://localhost:3555
```

### Step 2 — Configure VS Code

Create (or update) `.vscode/mcp.json` at your **workspace root** — **not** `settings.json`:

```json
{
  "servers": {
    "matimo-ts": {
      "type": "http",
      "url": "http://localhost:3555/mcp",
      "headers": {
        "Authorization": "Bearer ${input:matimo_token}"
      }
    }
  },
  "inputs": [
    {
      "id": "matimo_token",
      "type": "promptString",
      "description": "MATIMO_MCP_TOKEN from your .env",
      "password": true
    }
  ]
}
```

Or **no token** (skip auth by omitting the `headers` block if your server runs without
`MATIMO_MCP_TOKEN`).

**No pre-start needed?** Use stdio — VS Code spawns the server on demand:
```json
{
  "servers": {
    "matimo": {
      "type": "stdio",
      "command": "npx",
      "args": ["matimo", "mcp"],
      "cwd": "${workspaceFolder}/typescript"
    }
  }
}
```

### Step 3 — Reload
Command Palette (Cmd+Shift+P) → `MCP: Restart Server`

---

## Troubleshooting

**`SLACK_BOT_TOKEN not set`**
- Add `SLACK_BOT_TOKEN=xoxb-...` to your `.env` file.

**`Unauthorized` when running `pnpm agent:http`**
- Ensure `MATIMO_MCP_TOKEN` in `.env` matches the token the server was started with.
- The server reads `MATIMO_MCP_TOKEN` from `.env` automatically — no need to pass it on the CLI.

**No tools loaded (0 tools)**
- For stdio: ensure `@matimo/slack` is installed (`pnpm ls @matimo/slack`).
- For HTTP: verify the server is running (`curl http://localhost:3555/health`).

**Connection refused (HTTP)**
- Start the server: `npx matimo mcp --transport http --port 3555`
- Check port matches `MCP_SERVER_URL` (default `3555`).

**Self-signed certificate errors**
- Use [`mkcert`](https://github.com/FiloSottile/mkcert) to generate a locally trusted certificate
  instead of a self-signed one. See the [MCP TLS troubleshooting guide](../../docs/MCP.md#https-client-cant-connect-self-signed-cert)
  for step-by-step instructions.

**`slack_create_channel` / `slack_add_reaction` / `slack_get_user_info` fail**
- Your Slack bot token is missing OAuth scopes. In your Slack app settings ([api.slack.com/apps](https://api.slack.com/apps)):
  - Add `groups:write` for creating private channels
  - Add `reactions:write` + `reactions:read` for reactions
  - Add `users:read` for user lookup
  - Reinstall the app to your workspace after adding scopes

**`slack_search_messages` always fails**
- This is a Slack API limitation: bot tokens cannot use the Search API.
  Use a user token (`xoxp-…`) if search is required.
