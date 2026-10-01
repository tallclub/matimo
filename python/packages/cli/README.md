# matimo-cli

> Command-line interface for [Matimo](https://matimo.dev) - tool package manager & MCP server launcher.

[![PyPI](https://img.shields.io/pypi/v/matimo-cli)](https://pypi.org/project/matimo-cli/)
[![Docs](https://img.shields.io/badge/docs-matimo.dev-blue)](https://matimo.dev/docs)

---

## Installation

```bash
pip install matimo-cli
# or with uv
uv add matimo-cli
```

---

## Commands

### `matimo install` - Install provider packages

```bash
matimo install slack github gmail         # install specific providers
```

### `matimo list` - List available tools

```bash
matimo list                               # all loaded tools
```

### `matimo search` - Search for tools

```bash
matimo search email                       # text search over tool names + descriptions
matimo search "send message"
```

### `matimo mcp` - Start MCP server

Serve all loaded tools over the [Model Context Protocol](https://matimo.dev/docs/MCP) so Claude Desktop, Cursor, or any MCP client can access them.

```bash
matimo mcp                                # start on stdio (default)
matimo mcp --transport http --port 3000   # start as HTTP server
```

**Claude Desktop `claude_desktop_config.json`:**
```json
{
  "mcpServers": {
    "matimo": {
      "command": "matimo",
      "args": ["mcp"]
    }
  }
}
```

### `matimo doctor` - Diagnose your setup

```bash
matimo doctor                             # check config, installed providers, connectivity
```

### `matimo review` - Review agent-created tool definitions

Operates on the current directory (or `$MATIMO_TOOL_DIR`), not an arbitrary path argument:

```bash
matimo review list                        # list approved tools and HITL-pending ones
matimo review approve my_tool             # approve a pending tool
matimo review reject my_tool              # reject/revoke a tool
```

`review` works on one directory that holds both the agent-created tools (`<dir>/<tool>/definition.yaml`) and the approval manifest (`<dir>/.matimo-approvals.json`): the current directory, or `MATIMO_TOOL_DIR`. For your app to see a CLI approval:

- set `approvalDir` (`approval_dir`) in the app to that same directory, and
- use the same `MATIMO_APPROVAL_SECRET` in the CLI and the app (`approve` refuses to run without it).

`approve` sets `status: approved` in the YAML and signs it; reload the app's tools afterwards. `list` shows the tools the manifest records as approved, and those held as pending by HITL quarantine on reload. Inside a running agent, `matimo_approve_tool` does the same job with the app's own manifest.

---

## Configuration

The CLI reads configuration entirely from environment variables - there is no
`.matimo.yaml` config file:

```bash
export MATIMO_LOG_LEVEL=info        # silent | error | warn | info | debug
export MATIMO_LOG_FORMAT=json       # json | simple
export MATIMO_APPROVED_PATTERNS="get_*,list_*"  # tools that never ask for approval
```

---

## Documentation

- [CLI Guide](https://matimo.dev/docs/user-guide/)
- [MCP Guide](https://matimo.dev/docs/MCP)
- [Getting Started](https://matimo.dev/docs/getting-started/QUICK_START)

---

## Links

- **PyPI:** https://pypi.org/project/matimo-cli/
- **Docs:** https://matimo.dev/docs
- **GitHub:** https://github.com/tallclub/matimo

