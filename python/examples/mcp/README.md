# Matimo Python MCP Examples

Python examples for running Matimo tools via the **Model Context Protocol (MCP)**, mirroring the [`typescript/examples/mcp/`](../../typescript/examples/mcp/) counterpart.

> **Transport support:** The Python SDK supports **stdio** (for Claude Desktop), **HTTP/SSE** (for web agents), and **multi-server** (advanced scenarios).

---

## 🚀 Quick Navigation: Which File Should I Use?

| Your Goal | Use This | Command |
|-----------|----------|---------|
| **I want a simple demo** | `src/agent.py` | `make mcp-agent -- --stdio` |
| **I'm building an HTTP agent** | `src/agent.py` | `make mcp-agent -- --http` |
| **I need all tools merged (advanced)** | `src/agent.py` | `make mcp-agent -- --multi` |
| **Learning: How to write a stdio agent?** | `src/agent_stdio.py` | `make mcp-agent-stdio` |
| **Learning: How to write an HTTP agent?** | `src/agent_http.py` | `make mcp-agent-http` |
| **Learning: How to write an MCP server?** | `src/server_stdio.py` or `src/server_http.py` | `make mcp-server-stdio` |
| **I need to debug/inspect tools** | `src/diagnose_tools.py` | `make mcp-diagnose` |
| **Setting up Claude Desktop** | `src/server_stdio.py` | See [Claude Integration](#claude-desktop-integration) |

---

## 📁 File Organization

```
src/                           # All agents and servers
├── agent.py                   # ⭐ RECOMMENDED: Unified agent (stdio/http/multi)
├── agent_http.py              # Single HTTP transport example
├── agent_stdio.py             # Single stdio transport example
├── server_stdio.py            # MCP server over stdio
├── server_http.py             # MCP server over HTTP/SSE
└── diagnose_tools.py          # Tool discovery troubleshooting

tests/                         # Test suite
├── test_stdio_protocol.py
├── test_mcp_tools.py
└── test_derivation.py
```

---

## 📖 Understanding the Files

### **Agents** (Executors of tools)

| File | Purpose | Best For | Line Count |
|------|---------|----------|-----------|
| `agent.py` ⭐ | **Unified** — supports `--stdio`, `--http`, `--multi` | 🎯 Start here! Production use | 299 |
| `agent_http.py` | HTTP-only transport | Learning HTTP pattern | 212 |
| `agent_stdio.py` | Stdio-only transport | Learning stdio pattern | 166 |

**recommendation**: Most users should use `agent.py` with CLI flags.

### **Servers** (Exposers of tools)

| File | Purpose | Best For | Line Count |
|------|---------|----------|-----------|
| `server_stdio.py` | Exposes tools over stdio | Claude Desktop, Cursor | 86 |
| `server_http.py` | Exposes tools over HTTP/SSE | Web agents, standalone servers | 43 |

**Recommendation**: Run `make mcp-server-stdio` for Claude, or use `matimo mcp` CLI (simpler).

### **Utilities**

| File | Purpose | Best For | Line Count |
|------|---------|----------|-----------|
| `diagnose_tools.py` | Tool discovery & inspection | Debugging missing tools | 88 |

---

## 🏃 Quick Start

### 1. Install dependencies

```bash
cd python/examples/mcp
uv sync
```

This installs `matimo-core` (minimal setup) and development dependencies needed for agents.

**Optional**: To test all provider tools, install with all dependencies:
```bash
uv sync --all-extras
```

### 2. Create your `.env`

```bash
# Copy template
cp ../.env .env  # or create manually

# Fill in required env vars
export OPENAI_API_KEY=sk-xxxxxxxxxxxxx
export SLACK_BOT_TOKEN=xoxb-xxxxxxxxxxxxx
export TEST_CHANNEL=C0123456789  # optional
```

### 3. Run the Unified Agent (⭐ Recommended)

```bash
# Stdio transport (no server to start, simplest):
make mcp-agent -- --stdio
uv run python src/agent.py -- --stdio

# HTTP transport (start server first):
make mcp-server-http &
uv run python src/agent.py -- --http --token your-token

# Multi-server (combine stdio + HTTP):
uv run python src/agent.py -- --multi
```

### 4. Or Run Individual Transport Examples

```bash
# Stdio agent (simple):
make mcp-agent-stdio
uv run python src/agent_stdio.py

# HTTP agent:
make mcp-server-http &
make mcp-agent-http
uv run python src/agent_http.py
```

### 5. Advanced: Run the MCP Server

```bash
# Start stdio server (for Claude Desktop):
make mcp-server-stdio
uv run python src/server_stdio.py

# OR start HTTP server:
make mcp-server-http
uv run python src/server_http.py
```

---

## 📚 Use Cases & Examples

### Use Case 1: **Quick Demo (No Server Setup)**

```bash
make mcp-agent -- --stdio
```

✅ Spawns matimo subprocess  
✅ No separate server needed  
✅ Simplest way to test  

Equivalent to: `src/agent.py --stdio`

---

### Use Case 2: **Building an HTTP Agent**

```bash
# Terminal 1: Start server
make mcp-server-http

# Terminal 2: Connect agent
make mcp-agent-http-mode

# Optional: Use specific URL/token
uv run python src/agent.py -- --http --url http://localhost:9000/mcp --token my-token
```

Reference implementation: See `src/agent_http.py`

---

### Use Case 3: **Advanced Multi-Server Setup**

```bash
# Merge tools from both stdio and HTTP simultaneously:
make mcp-agent-multi

# Use custom models:
uv run python src/agent.py -- --multi --model gpt-4
```

Reference implementation: See `src/agent.py`

---

### Use Case 4: **Learning MCP Patterns**

**Want to understand how an agent works?**

1. Read `src/agent_stdio.py` (166 lines, simplest)
   - Single transport
   - Clear flow: spawn → load → execute

2. Read `src/agent_http.py` (212 lines, HTTP variant)
   - Connect to remote server
   - Error handling & auth

3. Read `src/agent.py` (299 lines, production pattern)
   - Multi-transport support
   - CLI argument parsing
   - Multiple scenarios

---

### Use Case 5: **Setting Up Claude Desktop**

See [Claude Desktop Integration](#claude-desktop-integration)

Uses: `src/server_stdio.py`

---

### Use Case 6: **Debugging Tool Discovery**

```bash
make mcp-diagnose
uv run python src/diagnose_tools.py
```

Shows:
- All discovered tools
- Tool metadata
- Parameter schemas
- Any discovery errors

---

## 🏗️ Architecture & How It Works

### Tool Discovery

In a standalone Python project, tools are discovered using the `site-packages` directory of your virtual environment. Matimo looks for any installed package starting with `matimo_` (e.g., `matimo_slack`, `matimo_github`) that contains a `tools/` directory.

The pattern is: `site-packages/matimo_*/tools`.

To ensure all tools are detected in these examples, we use `site.getsitepackages()` to point the `Matimo.init()` call to the environment's installation directory.

---

## 🤖 The Unified Agent: `src/agent.py`

The **recommend** starting point. Supports all three transports with a single entry point.

```bash
uv run python src/agent.py -- --stdio
uv run python src/agent.py -- --http
uv run python src/agent.py -- --multi
```

**What it does:**
1. Parses CLI flags (`--stdio`, `--http`, `--multi`, `--token`, `--url`, `--model`)
2. Sets up the appropriate MCP transport(s)
3. Discovers all available tools
4. Creates a LangChain ReAct agent with OpenAI GPT-4o-mini
5. Runs against multiple services (Slack, Gmail, GitHub, Database)
6. Reports what worked and what didn't

**Why use it:**
- ✅ One file handles all scenarios
- ✅ No code changes needed to switch transports
- ✅ Production-ready
- ✅ Matches TypeScript's `agent.ts`

**Example run:**
```
╔════════════════════════════════════════════════════════╗
║     Matimo MCP + LangChain AI Agent (Unified)          ║
║     All Available Tools Test                           ║
╚════════════════════════════════════════════════════════╝

🚀 Configuration:
   Transport: STDIO
   Model: gpt-4o-mini

📦 Loaded 127 tools from Matimo MCP:

  📌 slack (12 tools)
     • slack_list_channels
     • slack_create_channel
     • ... and 10 more
  📌 github (18 tools)
  📌 execute (2 tools)

🧠 Running agent tasks...

✅ Agent complete. Summary:

1. Discovery: Found 127 tools
2. Slack: ✅ Listed channels
3. GitHub: ✅ Listed repos
...
```

---

## 📡 MCP Servers

### Stdio Server: `src/server_stdio.py`

Exposes all Matimo tools over **stdio** transport. Best for desktop applications like Claude Desktop.

```bash
make mcp-server-stdio
uv run python src/server_stdio.py
```

This server:
- Auto-discovers all installed `matimo_*` providers
- Implements MCP server protocol over stdin/stdout
- No network overhead (pure IPC)
- Ideal for tight integration with desktop tools

**Claude Desktop Integration:**

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "matimo": {
      "command": "uv",
      "args": [
        "run",
        "--directory", "/path/to/matimo/python/examples/mcp",
        "python",
        "src/server_stdio.py"
      ],
      "env": {
        "SLACK_BOT_TOKEN": "xoxb-your-token",
        "GITHUB_TOKEN": "ghp-your-token"
      }
    }
  }
}
```

Then restart Claude Desktop. All Matimo tools appear as MCP tools in Claude!

**Cursor Integration:** Same config, just in Cursor's MCP settings panel.

---

### HTTP Server: `src/server_http.py`

Exposes tools over **HTTP using SSE (Server-Sent Events)**. Best for web agents or distributed systems.

```bash
make mcp-server-http
uv run python src/server_http.py
```

Listens on: `http://localhost:3555` (configurable)

Endpoints:
- **SSE**: `http://localhost:3555/mcp/sse` — tool calls streamed to client
- **Messages**: `http://localhost:3555/mcp/messages` — client sends tool requests

Usage with agent:
```bash
# Terminal 1: Start server
uv run python src/server_http.py

# Terminal 2: Connect agent
uv run python src/agent.py -- --http --url http://localhost:3555/mcp
```

---

## 🎓 Learning Examples

### For Beginners: `src/agent_stdio.py`

A **simple, single-transport agent** (166 lines).

```bash
make mcp-agent-stdio
uv run python src/agent_stdio.py
```

**What you'll learn:**
- How to spawn an MCP server as subprocess
- How to load tools via `langchain-mcp-adapters`
- How to run a ReAct agent loop
- Error handling basics

✅ Best for: Understanding the fundamentals

---

### HTTP Variant: `src/agent_http.py`

Same agent, but **connects over HTTP** instead of spawning subprocess (212 lines).

```bash
# Terminal 1: Start server
make mcp-server-http

# Terminal 2: Run agent
make mcp-agent-http
uv run python src/agent_http.py
```

**What you'll learn:**
- How to connect to a running HTTP server
- Bearer token authentication
- HTTP reconnection logic
- Remote agent patterns

✅ Best for: Building production HTTP agents

---

### Production Pattern: `src/agent.py`

**Unified agent** handling stdio, HTTP, and multi-server (299 lines).

```bash
uv run python src/agent.py -- --help
uv run python src/agent.py -- --stdio
uv run python src/agent.py -- --http
uv run python src/agent.py -- --multi
```

**What you'll learn:**
- CLI argument parsing for transports
- Dynamic MCP client configuration
- Supporting multiple scenarios
- Production readiness patterns

✅ Best for: Building real agents

---

## 🔄 Comparison: TypeScript vs Python

Now in sync! 🎉

| Feature | TypeScript | Python |
|---------|-----------|--------|
| Stdio transport | ✅ `agent-stdio.ts` | ✅ `src/agent_stdio.py` |
| HTTP transport | ✅ `agent-http.ts` | ✅ `src/agent_http.py` |
| Unified agent | ✅ `agent.ts` | ✅ `src/agent.py` |
| Multi-server | ✅ `--multi` flag | ✅ `--multi` flag |
| CLI transport picker | ✅ `--stdio/--http` | ✅ `--stdio/--http` |
| OpenAI integration | ✅ `@langchain/openai` | ✅ `langchain-openai` |
| Claude Desktop | ✅ `matimo mcp` CLI | ✅ `src/server_stdio.py` |
| HTTP server | ❌ (uses `matimo mcp --http`) | ✅ `src/server_http.py` |

---

## 📦 Dependencies

This project has **minimal dependencies by default**:

```toml
# Base (always installed)
"matimo-core>=0.1.0a14"
"python-dotenv>=1.2.2"
"mcp>=1.27.0"

# Optional: For agents
"langchain-mcp-adapters>=0.1.0"
"langchain-openai>=0.1.2"
"langgraph>=0.1.0"
```

**Install exactly what you need:**

```bash
# Minimal (core only):
pip install matimo-py-mcp

# For agents with Slack:
pip install matimo-py-mcp[slack,dev]

# For HTTP server:
pip install matimo-py-mcp[http,all]

# Development (all providers + test tools):
pip install matimo-py-mcp[all,dev]
```

---

## 🛠️ Command Reference

| Task | Command | See File |
|------|---------|----------|
| **Unified agent (stdio)** | `make mcp-agent -- --stdio` | `src/agent.py` |
| **Unified agent (HTTP)** | `make mcp-agent-http-mode` | `src/agent.py` |
| **Unified agent (multi)** | `make mcp-agent-multi` | `src/agent.py` |
| **Stdio-only agent** | `make mcp-agent-stdio` | `src/agent_stdio.py` |
| **HTTP-only agent** | `make mcp-agent-http` | `src/agent_http.py` |
| **Start stdio server** | `make mcp-server-stdio` | `src/server_stdio.py` |
| **Start HTTP server** | `make mcp-server-http` | `src/server_http.py` |
| **Diagnose tools** | `make mcp-diagnose` | `src/diagnose_tools.py` |
| **Run tests** | `make mcp-test` | `tests/` |

---

## 💡 Tips

### Running Locally vs Deployed

**Local development:**
```bash
# Everything in one machine, simple
make mcp-agent -- --stdio
```

**Deployed setup:**
```bash
# Terminal 1: Server (on machine A)
make mcp-server-http

# Terminal 2: Agent (on machine B)
uv run python src/agent.py -- --http --url http://machine-a:3555/mcp
```

### Switching Models

```bash
# Use GPT-4 instead of default gpt-4o-mini
uv run python src/agent.py -- --stdio --model gpt-4

# Use Claude (requires @anthropic-sdk):
uv run python src/agent.py -- --stdio --model claude-3-sonnet
```

### Custom Server Port

HTTP server defaults to port 3555, but you can change it:

**In `src/server_http.py`, modify:**
```python
app = Starlette(...)
uvicorn.run(app, host="0.0.0.0", port=9999)  # Change 3555 → 9999
```

Then connect agent:
```bash
uv run python src/agent.py -- --http --url http://localhost:9999/mcp
```

---

## 🔧 Troubleshooting

### "ModuleNotFoundError: No module named langchain_mcp_adapters"

**Solution:**
```bash
cd python/examples/mcp
uv sync  # Installs all dependencies including langchain packages
```

Or install specific agent dependencies:
```bash
pip install langchain-mcp-adapters langchain-openai langgraph
```

---

### Claude Desktop shows "0 tools" after reload

**Symptom:** Server runs, but Claude Desktop shows "0 loaded, 0 removed" for the `matimo` MCP server.

**Solution:**

1. **Fully quit Claude Desktop** (not just close the window): ⌘Q
2. **Check server debug logs** — run `server_stdio.py` manually:

   ```bash
   cd python/examples/mcp
   uv run python src/server_stdio.py
   ```

   You should see:
   ```
   [matimo-mcp] Initialising Matimo (auto-discover=True)...
   [matimo-mcp] 127 tools loaded: slack_list_channels, github_list_repos, ...
   ```

3. **If you see 0 tools**, check:
   - ✅ `uv sync` completed successfully
   - ✅ Provider packages installed in `.venv/lib/python3.11/site-packages`
   - ✅ TypeScript tools path is correct (if configured)
   - ✅ `auto_discover=True` is set in code

4. **Restart Claude Desktop** → try again

---

### "Address already in use :3555" with HTTP server

```bash
# Kill any process on port 3555
lsof -t -i :3555 | xargs kill -9

# Or use a different port (modify src/server_http.py)
```

---

### Agent loads tools but says "No tools loaded"

**Check:** Do you have OpenAI API key set?

```bash
echo $OPENAI_API_KEY  # Should show your key

# If empty:
export OPENAI_API_KEY=sk-xxxxxxxxxxxxx
```

---

### Tests fail: "ModuleNotFoundError: No module named pytest"

```bash
# Install test dependencies
uv sync --all-extras
# or just:
pip install pytest pytest-asyncio
```

---

## 📚 Resources & Further Reading

| Topic | Resource |
|-------|----------|
| **MCP Protocol** | [`docs/MCP.md`](../../docs/MCP.md) |
| **TypeScript Examples** | [`typescript/examples/mcp/`](../../typescript/examples/mcp/) |
| **Matimo Core SDK** | [`python/packages/core/`](../../python/packages/core/) |
| **Tool Development** | [`docs/tool-development/`](../../docs/tool-development/) |
| **Matimo CLI** | `matimo --help` (run from monorepo) |
| **LangChain MCP Adapters** | https://github.com/langchain-ai/langchain |

---

## 🎯 Summary

**You have 6 files in `src/`, each serving a purpose:**

| File | Use When | Start With? |
|------|----------|-------------|
| `agent.py` ⭐ | You want production-ready agent | ✅ YES |
| `agent_http.py` | Learning HTTP transport pattern | For study |
| `agent_stdio.py` | Learning basic MCP pattern | For study |
| `server_stdio.py` | Setting up Claude Desktop | When needed |
| `server_http.py` | Building HTTP infrastructure | When needed |
| `diagnose_tools.py` | Debugging tool discovery | Troubleshooting |

**Most users:** Use `agent.py` with different CLI flags

```bash
# Just works:
make mcp-agent -- --stdio

# Doesn't require code changes:
make mcp-agent-http-mode
make mcp-agent-multi
```

**Next steps:**
1. ✅ Run `make mcp-agent -- --stdio` to test it works
2. ✅ Try different transport modes (`--http`, `--multi`)
3. ✅ Integrate with Claude Desktop or your own app
4. 📖 Read the specific file you want to understand
5. 🔧 Customize for your use case

---

**Questions?** See the [TypeScript equivalents](../../typescript/examples/mcp/) or check the [MCP documentation](../../docs/MCP.md).

Last updated: April 2026
