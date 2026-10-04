# Matimo Python MCP Examples

Run Matimo tools as an MCP server, and connect a LangChain agent to it, with the Python SDK. The TypeScript counterpart is [`typescript/examples/mcp/`](../../../typescript/examples/mcp/).

This directory is its own uv project (`pyproject.toml`, `uv.lock`), separate from the `python/` workspace.

---

## Files

| File | What it does |
|------|--------------|
| `src/server_stdio.py` | MCP server over stdio, for Claude Desktop, Cursor and VS Code |
| `src/server_http.py` | MCP server over Streamable HTTP on port 3101 (`MATIMO_SERVER_PORT`) |
| `src/agent.py` | LangChain agent that connects over `--stdio` (spawns `matimo mcp`), `--http`, or `--multi` (both) |
| `src/agent_stdio.py` | Smallest stdio agent: spawns `server_stdio.py` and runs Slack tasks |
| `src/agent_http.py` | Smallest HTTP agent: connects to `server_http.py` |
| `src/diagnose_tools.py` | Prints where tools are found and how many load; no server, no model |

Both servers load every installed `matimo-*` provider package with `auto_discover=True` (144 tools with this project's dependencies).

---

## Setup

```bash
cd python/examples/mcp
uv sync --extra dev        # servers + the agent dependencies (langchain-mcp-adapters, langchain-openai, langgraph)
```

Create `.env` here with the keys for the tools you'll call:

```bash
OPENAI_API_KEY=sk-...        # agents only
SLACK_BOT_TOKEN=xoxb-...
GITHUB_TOKEN=ghp_...
TEST_CHANNEL=C0123456789     # optional, used by agent_stdio.py
```

`server_stdio.py` reads `.env` through a secret resolver; the agents load it with `python-dotenv`.

---

## Run

```bash
# Inspect tool discovery (no keys needed)
uv run python src/diagnose_tools.py

# Servers
uv run python src/server_stdio.py
uv run python src/server_http.py          # http://localhost:3101/mcp, health at /health

# Agents (need OPENAI_API_KEY)
uv run python src/agent_stdio.py
uv run python src/agent.py --stdio
uv run python src/agent.py --http --url http://localhost:3101/mcp     # start server_http.py first
uv run python src/agent.py --multi
```

`agent.py` options: `--stdio | --http | --multi`, `--url URL` (default `http://localhost:3101/mcp`), `--token TOKEN`, `--model NAME`; or `MCP_TRANSPORT`, `MCP_SERVER_URL`, `MCP_BEARER_TOKEN`/`MATIMO_MCP_TOKEN`, `OPENAI_MODEL`. It binds at most 128 tools, OpenAI's limit.

From `python/examples/` the Makefile has shortcuts: `make mcp-server-stdio`, `make mcp-server-http`, `make mcp-agent` (stdio), `make mcp-agent-http-mode`, `make mcp-agent-multi`, `make mcp-agent-stdio`, `make mcp-agent-http`.

> **These agents act on your accounts.** `agent_stdio.py` creates a Slack channel and posts messages; `agent.py` sends a Slack message. Use a test workspace.

---

## Approval over MCP

The servers apply the same policy as the SDK. A call that needs approval (HTTP DELETE, `type: command`, `requires_approval: true`, destructive SQL) asks the client's user through MCP elicitation. A client without elicitation support gets an error saying the call needs human approval; it can't approve the call itself. See [MCP.md](../../../docs/MCP.md) and [APPROVAL-SYSTEM.md](../../../docs/api-reference/APPROVAL-SYSTEM.md).

---

## Client Configuration

### Claude Desktop

`~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "matimo": {
      "command": "uv",
      "args": ["run", "--directory", "/path/to/matimo/python/examples/mcp", "python", "src/server_stdio.py"],
      "env": {
        "SLACK_BOT_TOKEN": "xoxb-your-token",
        "GITHUB_TOKEN": "ghp_your-token"
      }
    }
  }
}
```

Restart Claude Desktop. Cursor takes the same entry in its MCP settings.

### VS Code

`.vscode/mcp.json` in the workspace (the monorepo ships one):

```json
{
  "servers": {
    "matimo": {
      "type": "stdio",
      "command": "uv",
      "args": ["run", "python", "src/server_stdio.py"],
      "cwd": "${workspaceFolder}/python/examples/mcp"
    }
  }
}
```

Or, with `server_http.py` running: `{ "servers": { "matimo": { "type": "http", "url": "http://localhost:3101/mcp" } } }`. Then run **MCP: Restart Server** from the Command Palette.

---

## Security Notes for `server_http.py`

The example server is for local use: it sets no bearer token and listens on all interfaces. Before exposing it, pass `mcp_token` in `MCPServerOptions` (clients then send `Authorization: Bearer <token>`), bind it behind a firewall or reverse proxy, and use HTTPS. See [MCP.md](../../../docs/MCP.md) for the options.

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `ModuleNotFoundError: langchain_mcp_adapters` | `uv sync --extra dev` |
| `Port 3101 is already in use` | Stop the other process (`lsof -i :3101`) or set `MATIMO_SERVER_PORT` |
| Agent `--http` can't connect | Start `server_http.py` first; check `--url` matches its port |
| Fewer tools than expected | Run `diagnose_tools.py`; install the missing `matimo-*` package |
| `Authentication credentials are missing` or 401 | Set the provider variable in `.env` or the client's `env` block |
| OpenAI rejects the request (too many tools) | Bind fewer tools; `agent.py` caps at 128 |

## See Also

- [MCP.md](../../../docs/MCP.md) — server options, clients, HTTPS, Python and TypeScript
- [Python MCP server reference](../../packages/core/src/matimo/mcp/README.md)
- [TypeScript MCP examples](../../../typescript/examples/mcp/)
