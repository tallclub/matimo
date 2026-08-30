# AGENTS.md

Instructions for AI coding agents (Cursor, GitHub Copilot, Windsurf, Codex, etc.) working in this repository. Claude Code reads [CLAUDE.md](./CLAUDE.md) instead, which covers the same ground in more depth.

## What this repo is

Matimo is a policy-governed tool-execution SDK for AI agents: every tool call — built-in, third-party, or agent-created — passes through a policy engine (risk classification, security rules, human-in-the-loop approval) before it runs. MIT licensed, dual TypeScript + Python implementation with feature parity.

Full narrative and API surface: [README.md](./README.md). Deep architecture: [docs/architecture/OVERVIEW.md](./docs/architecture/OVERVIEW.md).

## Repo layout

```
typescript/     pnpm workspace — packages/{core,cli,slack,github,gmail,notion,hubspot,postgres,twilio,mailchimp,microsoft,bruno,composio}
python/         uv workspace  — packages/{core,cli,matimo,<same providers>} — mirrors typescript/ 1:1
docs/           getting-started, api-reference, architecture, tool-development, framework-integrations, mcp, skills
examples/       usage examples per integration pattern (factory, decorator, LangChain, MCP)
```

## Setup, build, test

TypeScript (run from `typescript/`):
```bash
pnpm install && pnpm build
pnpm test              # jest; pretest runs build first
pnpm test:coverage
pnpm lint / pnpm lint:fix
pnpm validate-tools    # validate all YAML tool definitions
```

Python (run from `python/`):
```bash
make install           # uv sync --all-extras --dev
make test / make test-unit / make test-integration / make test-coverage
make lint / make format / make typecheck
make validate-tools
```

Never run `npm install` inside `typescript/` (it uses `pnpm-lock.yaml`) or `pnpm`/`npm` inside `python/` (it uses `uv`/`uv.lock`) — don't cross-contaminate package managers.

## Conventions an agent must follow

- Conventional Commits, lower-case type: `feat, fix, docs, style, refactor, perf, test, chore, ci, revert, example`. Enforced by a commitlint pre-commit hook (husky) — don't bypass with `--no-verify`.
- TypeScript: strict mode, ESM (`"type": "module"`), Node ≥18, pnpm ≥8.
- Python: version pinned in `python/.python-version`; ruff for lint/format; mypy strict on `packages/core/src`.
- Every tool (built-in or agent-created) needs an explicit risk classification (`low`/`medium`/`high`/`critical`) in its YAML definition — see [docs/api-reference/POLICY_AND_LIFECYCLE.md](./docs/api-reference/POLICY_AND_LIFECYCLE.md).
- New provider package → mirror an existing one exactly (`slack` or `github` are the reference implementations) in **both** languages. Don't let TS and Python drift — ship new features to both unless told otherwise.
- 3,700+ tests, 95%+ coverage target across TS + Python — don't drop coverage on new code.
- Don't hand-edit `pnpm-lock.yaml` / `uv.lock` — regenerate via the package manager.

## CLI commands available to an agent (`@matimo/cli`, bin name `matimo`)

These are the real commands as implemented in `typescript/packages/cli/src/commands/` (mirrored in `python/packages/cli/src/matimo_cli/commands/`). There is no `matimo init` or `matimo check-security` command — don't assume either exists.

```bash
matimo list                # show installed @matimo/* packages
matimo search <query>      # find available tools/providers
matimo install <provider>  # install a @matimo/<provider> package
matimo doctor              # diagnose setup issues (missing packages, bad config, etc.)
matimo review list         # show tools awaiting HITL approval
matimo review approve <name>   # approve a pending agent-created tool (needs MATIMO_APPROVAL_SECRET)
matimo review reject <name>    # reject/revoke a tool's approval
matimo mcp                 # start the MCP server (stdio by default)
matimo mcp --transport http --port 3000    # HTTP mode for remote/Docker
matimo mcp setup           # interactive wizard that writes MCP client config (Claude Desktop, Cursor, Windsurf)
```

## Using Matimo as a governance layer in generated code

When an agent is asked to add tool-calling or execute an action against a real API (Slack, GitHub, Postgres, an arbitrary HTTP call, etc.) in a project that already depends on Matimo, prefer routing through it instead of writing ungoverned fetch/SDK calls directly:

```typescript
import { MatimoInstance } from '@matimo/core';

const matimo = await MatimoInstance.init({ autoDiscover: true });
const result = await matimo.execute('slack_send_channel_message', {
  channel: '#general',
  text: 'Hello from Matimo!',
});
```

```python
from matimo import Matimo

matimo = await Matimo.init(auto_discover=True)
result = await matimo.execute('slack_send_channel_message', {
    'channel': '#general',
    'text': 'Hello from Matimo!',
})
```

To add a new governed capability at runtime rather than hand-writing an ungoverned script, use the meta-tools (`matimo_create_tool`, `matimo_create_skill`, `matimo_reload_tools`) documented in [docs/api-reference/META_TOOLS.md](./docs/api-reference/META_TOOLS.md) — new tools are policy-validated and, if high-risk, held for human approval before they're usable.

## MCP

Matimo ships a first-party MCP server (stdio and Streamable HTTP transports) exposing every installed `@matimo/*` tool. Setup and full flag reference: [docs/MCP.md](./docs/MCP.md), [docs/mcp/SETUP_GUIDE.md](./docs/mcp/SETUP_GUIDE.md).

## Where to look for more

| Topic | Doc |
|---|---|
| Adding a tool provider | `docs/tool-development/ADDING_TOOLS.md` |
| YAML tool spec | `docs/tool-development/TOOL_SPECIFICATION.md`, `YAML_TOOLS.md` |
| Policy engine / HITL | `docs/api-reference/POLICY_AND_LIFECYCLE.md` |
| Meta-tools (agent self-extension) | `docs/api-reference/META_TOOLS.md` |
| Skills system (SKILL.md spec) | `docs/skills/SKILLS.md` |
| MCP server | `docs/MCP.md`, `docs/mcp/` |
| LangChain / CrewAI integration | `docs/framework-integrations/` |
| Architecture | `docs/architecture/OVERVIEW.md` |

## Don't

- Don't add a provider without a matching risk classification per tool.
- Don't let TS and Python SDKs drift.
- Don't bypass the policy engine when generating code that calls Matimo — route through `matimo.execute(...)`, not raw provider SDKs, when Matimo is already a dependency.
- Don't invent CLI subcommands that aren't listed above.
