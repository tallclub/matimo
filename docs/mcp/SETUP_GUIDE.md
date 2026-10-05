# Building Provider Packages with Copilot and Matimo's MCP Server

This guide sets up the contributor workflow in this repository: VS Code Copilot Chat runs the **Matimo Tool Creator** agent (`.github/agents/matimo-tool-creator-refactored.agent.md`), which writes a provider package in both SDKs and checks its work with tools from Matimo's own MCP server.

> Looking for how to run Matimo as an MCP server for your own agents (Claude Desktop, Cursor, the `matimo mcp` CLI, options, approval over MCP)? See [MCP.md](../MCP.md). This guide is only about contributing provider packages.

## How It Fits Together

```
VS Code Copilot Chat
  └─ agent: Matimo Tool Creator (.github/agents/matimo-tool-creator-refactored.agent.md)
       ├─ reads  .github/skills/matimo-provider-creation/SKILL.md   (layout, YAML, auth, tests)
       ├─ writes typescript/packages/<provider>/…  and  python/packages/<provider>/…
       └─ calls MCP tools on the Python example server
            ├─ matimo_validate_tool(yaml_content)      check each definition
            ├─ matimo_validate_skill(name)             check the package SKILL.md
            ├─ search, read                            find patterns to copy (you approve each)
            └─ execute                                 pnpm validate-tools, lint, tests (you approve each)
```

The agent writes tool YAML files directly. It does **not** use `matimo_create_tool`, which is for agents creating their own tools at runtime: it writes drafts to `./matimo-tools` that only an admin can run.

## Prerequisites

- Node.js ≥ 18 and pnpm 8 (`cd typescript && pnpm install && pnpm build`)
- Python 3.11 and [uv](https://docs.astral.sh/uv/) (`cd python && make install`)
- VS Code with GitHub Copilot Chat, with agent mode and MCP enabled

## Step 1: Start the MCP Server

```bash
cd python/examples/mcp
uv sync
uv run python src/server_http.py        # or, from python/examples: make mcp-server-http
```

The server loads every installed `matimo_*` package from the repo (editable installs) plus the core tools, and listens on port **3101** (`MATIMO_SERVER_PORT` to change it; the script refuses to start if the port is taken). Add a directory of extra tools with `MATIMO_EXTRA_TOOLS_PATH`.

Check it:

```bash
curl -s http://localhost:3101/health
# {"status": "ok", "tools": 144, "transport": "http"}
```

The MCP endpoint is `http://localhost:3101/mcp`.

> **Security:** the example server binds to `0.0.0.0` and sets no bearer token, so anyone who can reach the port can call its tools, including `execute`. Run it only on a trusted machine, or pass `mcp_token` in `MCPServerOptions` (see [MCP.md](../MCP.md)) and send it from the client.

## Step 2: Connect VS Code

Create `.vscode/mcp.json` (it is not committed). The server name must be `matimo-python-mcp-server`, because the agent's tool list refers to tools as `matimo-python-mcp-server/<tool>`:

```json
{
  "servers": {
    "matimo-python-mcp-server": {
      "type": "http",
      "url": "http://localhost:3101/mcp"
    }
  }
}
```

Start the server from the MCP view or the code lens in `mcp.json`, and confirm that its tools are listed.

## Step 3: Approvals

Several tools the agent uses declare `requires_approval: true` — `execute`, `edit`, `read`, `search`, `matimo_create_skill`, `matimo_reload_tools`. With Matimo 0.2.0 the server asks **you** before each such call, through an MCP elicitation prompt in VS Code. Read the command before you accept; declining is always safe, and the agent is told the call was refused.

If a client cannot show elicitation prompts, these calls fail with an error that says so. Don't work around it with `MATIMO_AUTO_APPROVE`; it approves every call unseen.

## Step 4: Create a Provider Package

In Copilot Chat, pick the **Matimo Tool Creator** agent and give it the provider and its API docs:

```
Create a provider package for Linear: list issues, get an issue, create an issue.
API docs: https://developers.linear.app/docs/graphql/working-with-the-graphql-api
```

The agent:

1. Reads the provider skill and the API docs, and asks about anything unclear.
2. Proposes the tool list and the risk of each tool (`requires_approval: true` on deletes).
3. Writes each `definition.yaml` in both SDKs and validates it with `matimo_validate_tool`.
4. Adds executors only for `type: function` tools, then unit tests with mocked HTTP.
5. Runs `pnpm validate-tools`, lint and the tests through `execute` (you approve each command).
6. Writes the README, the package SKILL.md and the examples, and reports every file and result.

Review the diff like any pull request. The agent's output is a starting point, not a verified integration.

## Step 5: Check the Result Yourself

```bash
cd typescript && pnpm validate-tools && pnpm lint && pnpm test -- packages/<provider>
cd python && uv run ruff check packages/<provider> && uv run pytest packages/<provider>
```

To try the new tools through the server, restart it (or approve a `matimo_reload_tools` call).

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `Port 3101 is already in use` | Another server is running | Stop it, or set `MATIMO_SERVER_PORT` |
| VS Code lists no tools | Wrong URL, or the server isn't running | Use `http://localhost:<port>/mcp`; check `/health` |
| The agent can't call a Matimo tool | The server name in `mcp.json` differs from the agent's | Name it `matimo-python-mcp-server` |
| A tool call fails with a message about approval | The client did not show an elicitation prompt | Use a client that supports elicitation (current VS Code does) |
| A new tool is missing from the server | The server loaded tools at start-up | Restart it, or approve `matimo_reload_tools` |
| `matimo_validate_tool` reports `blocked-http-method` for a DELETE tool | It applies the rules for agent-created tools | Expected for provider tools; rely on `pnpm validate-tools` |
| A tool YAML loads in Python but not TypeScript | An invalid `status` such as `stable` | Leave `status` unset |

## See Also

- [QUICK_REFERENCE.md](QUICK_REFERENCE.md) — commands and tool inputs on one page
- [MAINTENANCE_GUIDE.md](MAINTENANCE_GUIDE.md) — keeping the agent and skill in step with the SDK
- [ADDING_TOOLS.md](../tool-development/ADDING_TOOLS.md) — the manual workflow the agent follows
- [MCP.md](../MCP.md) — the MCP server reference
