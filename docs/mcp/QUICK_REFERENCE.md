# Provider Packages with Copilot — Quick Reference

One page for the contributor workflow in [SETUP_GUIDE.md](SETUP_GUIDE.md).

## Start

```bash
cd python/examples/mcp && uv sync && uv run python src/server_http.py   # port 3101
curl -s http://localhost:3101/health
```

`.vscode/mcp.json`:

```json
{ "servers": { "matimo-python-mcp-server": { "type": "http", "url": "http://localhost:3101/mcp" } } }
```

In Copilot Chat, choose **Matimo Tool Creator** and describe the provider and its API docs.

## MCP Tools the Agent Uses

| Tool | Input | Asks you first? |
|------|-------|-----------------|
| `matimo_validate_tool` | `yaml_content` | No |
| `matimo_validate_skill` | `name`, `skills_dir` | No |
| `matimo_list_skills`, `matimo_get_skill` | `name` | No |
| `web` | URL | No |
| `search`, `read` | `query`, `directory` / `filePath` | **Yes** |
| `execute` | `command` | **Yes** |
| `edit` | `filePath`, `operation`, `content` | **Yes** |
| `matimo_create_skill` | `name`, `content`, `target_dir` | **Yes** |
| `matimo_reload_tools` | — | **Yes** |

`matimo_create_tool` and `matimo_approve_tool` are for agents creating their own runtime tools, not for provider packages.

## Where Files Go

```
typescript/packages/<provider>/
├── package.json  README.md  definition.yaml (OAuth2 only)
├── tools/<tool>/definition.yaml           (+ <tool>.ts for function tools)
├── skills/<provider>/SKILL.md
└── test/unit/  test/integration/

python/packages/<provider>/
├── pyproject.toml  README.md
├── src/matimo_<provider>/tools/<tool>/definition.yaml   (+ <tool>.py for function tools)
└── tests/unit/  tests/integration/

typescript/examples/tools/<provider>/      factory, decorator, langchain, with-approval
python/examples/{native,langchain,crewai}/<provider>/
```

HTTP tool YAML is identical in both SDKs.

## Tool YAML Essentials

```yaml
name: provider_action              # snake_case, unique
description: From the API docs
version: '1.0.0'                   # leave status unset
parameters:
  item_id: { type: string, required: true, description: Item ID }
execution:
  type: http
  method: GET
  url: 'https://api.provider.com/v1/items/{item_id}'
  headers:
    Authorization: 'Bearer {PROVIDER_API_KEY}'   # MATIMO_PROVIDER_API_KEY or PROVIDER_API_KEY
  timeout: 15000
requires_approval: true            # required for DELETE / destructive calls
```

## Checks

```bash
cd typescript && pnpm validate-tools && pnpm lint && pnpm test -- packages/<provider>
cd python && uv run ruff check packages/<provider> && uv run pytest packages/<provider>
```

## Quick Fixes

| Problem | Fix |
|---------|-----|
| Port in use | `MATIMO_SERVER_PORT=3102` |
| No tools in VS Code | URL must end in `/mcp`; check `/health` |
| Agent can't reach a tool | Server name must be `matimo-python-mcp-server` |
| Approval error instead of a prompt | Use a client with MCP elicitation support |
| New tool not visible | Restart the server |
| Tool loads in Python only | Remove `status: stable` |
