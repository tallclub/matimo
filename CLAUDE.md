# Matimo OSS — CLAUDE.md

Policy-governed tool-execution SDK for AI agents. MIT licensed, dual TypeScript + Python implementation with feature parity. Part of the roaiq Matimo™ suite — see [../CLAUDE.md](../CLAUDE.md) for how this fits with Matimo Workbench (`Universal-AgentForge/`).

## What this is

Governance-first: every tool call (built-in, third-party, or agent-created) passes through a **policy engine** (risk classification low/medium/high/critical, 9 deterministic security rules, HITL quarantine) before executing. On top of that: 139+ tools across 10 provider packages (plus a governed 449-tool Composio catalog), 12 meta-tools for runtime self-extension (`matimo_create_tool`, `matimo_create_skill`, `matimo_reload_tools`, and 9 more), and one YAML tool definition that runs across TS, Python, LangChain, CrewAI, and MCP.

## Layout

```
typescript/     pnpm workspace — packages/{core,cli,slack,github,gmail,notion,hubspot,postgres,twilio,mailchimp,microsoft,bruno,composio}
python/         uv workspace  — packages/{core,cli,matimo,<same providers>} — mirrors typescript/ 1:1
docs/           full docs: getting-started, api-reference, architecture, tool-development, framework-integrations, mcp, skills
examples/       usage examples per integration pattern (factory, decorator, LangChain, MCP)
```

## Commands

TypeScript (`cd typescript`):
```bash
pnpm install && pnpm build
pnpm test              # jest; pretest runs build first
pnpm test:coverage
pnpm lint / lint:fix
pnpm validate-tools    # validate all YAML tool definitions
```

Python (`cd python`):
```bash
make install           # uv sync --all-extras --dev
make test / test-unit / test-integration / test-coverage
make lint / format / typecheck
make validate-tools
```

Changelog (repo root): `pnpm changelog` (git-cliff, from `cliff.toml`).

## Conventions

- Conventional Commits: feat/fix/docs/style/refactor/perf/test/chore/ci/revert/example — enforced by commitlint + husky pre-commit.
- TS: strict mode, ESM (`"type": "module"`), Node ≥18, pnpm ≥8.
- Python: version pinned in `.python-version`; ruff for lint/format; mypy strict on `packages/core/src`.
- New provider package → mirror an existing one exactly (see `slack` or `github`) in both languages — see root skill `new-matimo-provider`.
- Every tool needs a risk classification (low/medium/high/critical) — see `docs/api-reference/POLICY_AND_LIFECYCLE.md`.
- 3,700+ tests, 95%+ coverage target across TS + Python — don't drop coverage on new code.

## Where to look

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
- Don't let TS and Python SDKs drift — new features ship to both unless the user says otherwise.
- Don't hand-edit `pnpm-lock.yaml` / `uv.lock` — regenerate via the package manager.
