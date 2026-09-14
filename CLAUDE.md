# Matimo — CLAUDE.md

Framework-agnostic, policy-governed tool-execution SDK for AI agents. Define a tool once in YAML and deploy it to LangChain, CrewAI, MCP, OpenAI, and Claude. MIT licensed, dual TypeScript + Python implementation at feature parity. Competitor: [Composio](https://docs.composio.dev/docs/tools-and-toolkits). A separate hosted product, [Matimo Workbench](https://matimo.ai), builds on top of this governance layer with a visual builder — out of scope for this repo.

**Package manager:** pnpm 8.15.0 | **Node:** ≥18 | **Python:** 3.11

## What this is

Governance-first: every tool call (built-in, third-party, or agent-created) passes through a **policy engine** (risk classification low/medium/high/critical, deterministic security rules, HITL quarantine) before executing. On top of that: 139+ tools across 10 provider packages (plus a governed Composio catalog for third-party reach), 15 meta-tools for runtime self-extension (`matimo_create_tool`, `matimo_create_skill`, `matimo_reload_tools`, and 12 more), and one YAML tool definition that runs across TS, Python, LangChain, CrewAI, and MCP.

---

## Workspace structure

> **Root `packages/` and root `examples/` are dead leftovers — do not add files there.** The TypeScript SDK was restructured into `typescript/` (commit `dfefb3c`, "restructure monorepo into typescript/python directories"). Verified directly: `git ls-files packages/` and `git ls-files examples/` both return 0 — nothing under either root directory is git-tracked. What's physically on disk there (`dist/`, `node_modules/`, `tsconfig.tsbuildinfo`) is stale local build output from before the restructure. There is no `pnpm-workspace.yaml` at repo root and root `package.json` is only a 3-line devDependency shim (commitlint, husky). The active TS workspace config is `typescript/pnpm-workspace.yaml`; run all `pnpm` commands **from `typescript/`**, not repo root. Real examples live in `typescript/examples/` and `python/examples/`.

```
typescript/                   # THE active pnpm workspace — TypeScript SDK
  pnpm-workspace.yaml         # Authoritative list of active packages
  packages/
    core/
      src/                    # TypeScript source (approval, auth, core, executors, mcp, policy…)
      tools/                  # Built-in YAML tools (calculator, read, web, matimo_* meta-tools)
      skills/                 # Core Matimo SKILL.md files (tool-creation, policy-validation…)
      test/                   # Jest unit + integration tests
    cli/                      # matimo CLI — src/, test/
    slack/                    # Slack tools — tools/, skills/, test/
    gmail/                    # Gmail tools — tools/, skills/, test/
    github/                   # GitHub tools — tools/, skills/
    hubspot/                  # HubSpot tools — tools/, skills/, test/
    notion/                   # Notion tools — tools/, skills/, test/
    postgres/                 # SQL tools — tools/, skills/, test/
    twilio/                   # Twilio SMS/MMS — tools/, skills/, test/
    mailchimp/                # Mailchimp tools — tools/, skills/, test/
    microsoft/                # Microsoft tools
    composio/                 # Composio-routed third-party tools (never call it a "proxy" — see wording note below)
    bruno/                    # WIP package
  examples/
    tools/                    # Per-provider: factory, decorator, langchain, with-approval
    mcp/                      # MCP server examples
python/                       # Python SDK — full feature parity with typescript/
  pyproject.toml              # uv workspace root
  packages/                   # Python package source (uv workspaces), mirrors typescript/packages/ 1:1
  examples/
    native/                   # Direct SDK — mirrors TS factory pattern
    langchain/                # LangChain agents (Python)
    crewai/                   # CrewAI agents
    mcp/                      # MCP server usage (own uv lockfile — separate uv project)
docs/                         # Full docs site: getting-started, api-reference, architecture, tool-development, framework-integrations, mcp, skills
packages/                     # DEAD — untracked leftover build output, not a workspace. Do not add files here.
examples/                     # DEAD — untracked leftover, not a workspace. Do not add files here.
```

---

## Commands

```bash
# TypeScript (run from typescript/, NOT repo root)
cd typescript
pnpm install && pnpm build   # pretest also runs build first
pnpm test              # Jest — all packages
pnpm test:coverage     # With coverage (see thresholds below)
pnpm lint              # ESLint
pnpm lint:fix          # Auto-fix lint
pnpm format            # Prettier
pnpm validate-tools    # Validate all YAML definitions against Zod schema

# Python (run from python/)
make install           # uv sync --all-extras --dev
make test              # all tests
make test-unit / test-integration
make test-coverage     # HTML report at htmlcov/index.html (informational — no enforced fail-under)
make lint              # ruff check packages/ scripts/
make format            # ruff format
make typecheck         # mypy strict, scoped to packages/core/src
make validate-tools

# Changelog (repo root)
pnpm changelog          # git-cliff, from cliff.toml
pnpm changelog:preview  # unreleased entries only
```

---

## Conventions

- Conventional Commits: feat/fix/docs/style/refactor/perf/test/chore/ci/revert/example — enforced by commitlint + husky pre-commit.
- TS: strict mode, ESM (`"type": "module"`), Node ≥18, pnpm ≥8.
- Python: version pinned in `python/.python-version` (3.11); ruff for lint/format; mypy strict on `packages/core/src` only.
- New provider package → mirror an existing one exactly (see `slack` or `github`) in both languages — use the `add-package` skill.
- Every tool needs a risk classification (low/medium/high/critical) — see `docs/api-reference/POLICY_AND_LIFECYCLE.md`.
- Coverage target across TS + Python — don't drop coverage on new code (see exact TS thresholds below; Python has no enforced floor but keep new code well-tested).

---

## Adding a new tool — mandatory workflow

**Do every step in order. No shortcuts.**

### 1. Read official docs
Fetch the provider's official API reference (WebSearch/WebFetch). Understand: endpoint URL, HTTP method, required/optional params, response schema, auth, rate limits. Do not guess schemas.

### 2. Create the YAML definition
```
typescript/packages/<provider>/tools/<tool-name>/definition.yaml
```
- Use `type: http` for any standard REST call — this is the default
- Only use `type: function` when you need multi-step logic, response transformation, or file I/O
- Only use `type: command` for shell CLI tools (requires policy opt-in)

For `type: function`, co-locate executors **in the same directory as the YAML**:
```
typescript/packages/<provider>/tools/<tool-name>/<tool-name>.ts   # TypeScript executor
typescript/packages/<provider>/tools/<tool-name>/<tool-name>.py   # Python executor
```
HTTP-type tools need no executor files in either language.

### 3. Validate the YAML
```bash
cd typescript && pnpm validate-tools
```
Fix every schema error before continuing.

### 4. Fix all lint
```bash
cd typescript && pnpm lint:fix
cd python && uv run ruff check --fix packages/<provider>
```

### 5. Write unit tests — 100% coverage for this tool

**TypeScript:** `typescript/packages/<provider>/test/unit/<tool-name>.test.ts`
- Mock HTTP calls with jest; never hit live APIs
- Cover: YAML loads/parses, required params present, auth config correct, success path, error path

**Python:** `python/packages/<provider>/tests/unit/test_<tool-name>.py`
- Mock HTTP with `respx`; same coverage requirements

Overall TS coverage must stay at or above the thresholds in `typescript/jest.config.cjs` after your additions (currently lines 95%, functions 97%, branches 87%, statements 95%).

### 6. Create TypeScript examples
`typescript/examples/tools/<provider>/` — add to existing files if the provider already has them:
1. `<provider>-factory.ts` — Direct `MatimoInstance.execute()`
2. `<provider>-decorator.ts` — `@tool` decorator
3. `<provider>-langchain.ts` — Real LangChain agent with OpenAI LLM calling this tool
4. `<provider>-with-approval.ts` — Policy approval flow (for POST/PUT/DELETE tools)

### 7. Create Python examples
1. `python/examples/native/<provider>/<tool-name>_example.py` — Direct SDK
2. `python/examples/langchain/<provider>/<tool-name>_langchain_agent.py` — LangChain
3. `python/examples/crewai/<provider>/<tool-name>_crewai_agent.py` — CrewAI

### 8. Final gate check
```bash
cd typescript && pnpm validate-tools && pnpm lint && pnpm test:coverage
cd python && uv run ruff check . && uv run pytest --cov
```
All must pass. Or run the `add-tool` skill for a guided checklist.

---

## Tool YAML schema

```yaml
name: provider_tool_name       # snake_case; must match directory name
description: |
  Clear description of what the tool does.
version: '1.0.0'
status: stable                 # stable | approved | draft

parameters:
  param_name:
    type: string               # string | number | boolean | array | object
    description: What this param does
    required: true
    enum: [val1, val2]         # optional
    default: value             # optional

execution:
  type: http
  method: POST                 # GET | POST | PUT | DELETE | PATCH
  url: 'https://api.example.com/v1/resource'
  headers:
    Authorization: 'Bearer {ENV_VAR}'
    Content-Type: application/json
  body:
    key: '{param_name}'
  query_params:
    key: '{param_name}'
  timeout: 15000

  # function type only:
  # code: './<tool-name>.ts'

authentication:
  type: api_key                # api_key | oauth2 | basic | bearer
  location: header
  name: Authorization
  # basic auth:
  # username_env: PROVIDER_USERNAME
  # password_env: PROVIDER_PASSWORD

output_schema:
  type: object
  properties:
    success:
      type: boolean

error_handling:
  retry: 2
  backoff_type: exponential
  initial_delay_ms: 500

tags: [provider, category]

notes:
  env: PROVIDER_TOKEN          # or list: [TOKEN, SECRET]
  scopes: [scope.read]
  caution: 'Any important warning'
```

`typescript/packages/core/src/core/schema.ts` is the authoritative Zod source for these rules — check it when the YAML validator rejects something this doc doesn't explain.

---

## Provider package structure

```
typescript/packages/<name>/
├── package.json               # {"name": "@matimo/<name>", "type": "module"}
├── definition.yaml            # OAuth2 provider config (if OAuth2)
├── tools/
│   └── <tool-name>/
│       ├── definition.yaml
│       ├── <tool-name>.ts     # Only for type: function
│       └── <tool-name>.py     # Python executor (same directory, co-located)
├── skills/
│   └── <name>/
│       └── SKILL.md           # Agent knowledge document
├── test/
│   ├── unit/
│   └── integration/
└── README.md
```

Add to `typescript/pnpm-workspace.yaml` after creating. `python/packages/<name>/` mirrors this 1:1.

---

## Adding a new provider package

1. Check whether `typescript/packages/<name>/` already has a WIP implementation to finish out
2. Scaffold structure from an existing package (use `typescript/packages/slack/` as template)
3. Create `definition.yaml` (OAuth2 config), `tools/`, `skills/<name>/SKILL.md`, `README.md`
4. Add to `typescript/pnpm-workspace.yaml`
5. Follow the "Adding a new tool" workflow for each tool
6. Run the `add-package` skill for a guided checklist

---

## Test requirements

| | TypeScript | Python |
|---|---|---|
| Unit tests | `typescript/packages/<provider>/test/unit/` | `python/packages/<provider>/tests/unit/` |
| Integration tests | `typescript/packages/<provider>/test/integration/` | `python/packages/<provider>/tests/integration/` |
| Framework | Jest (ts-jest) | pytest + respx + asyncio |
| Coverage floor (enforced) | lines 95%, functions 97%, branches 87%, statements 95% (`typescript/jest.config.cjs`) | none enforced — `make test-coverage` is informational only |
| New tool target | 100% unit coverage | 100% unit coverage |

Never call live APIs in unit tests. Mock all HTTP.

---

## Policy engine

Every tool call — built-in, third-party, or agent-created — is classified into one of four risk levels (`low`/`medium`/`high`/`critical`, see `typescript/packages/core/src/policy/risk-classifier.ts`) and then gated:

| Tier | Triggers | Behaviour |
|------|---------|-----------|
| `auto` | GET, no auth, low-risk keywords | Executes immediately |
| `approval-required` | POST/PUT/DELETE, has auth, external writes | Queued for HITL callback (quarantined) |
| `blocked` | `type: function`/`command`, SSRF targets, reserved namespaces | Denied unless policy opt-in |

Full reference: `docs/api-reference/POLICY_AND_LIFECYCLE.md`.

---

## Release process

Each SDK is lockstepped independently: every `typescript/packages/*/package.json` shares one version number, and every `python/packages/*/pyproject.toml` shares a separate one. TS and Python version numbers are not meant to match each other (e.g. TS core at `0.1.8` alongside Python core at `0.1.3` is expected, not drift).

1. Bump `version` in `typescript/package.json` and all `typescript/packages/*/package.json`
2. `cd typescript && pnpm build && pnpm test` — must pass
3. Commit: `git commit -m "chore: release vX.Y.Z"`
4. Tag: `git tag vX.Y.Z && git push --tags`
5. CI publishes to npm and PyPI

Use the `release` skill for a guided flow with commit history summary and changelog generation (`pnpm changelog`, git-cliff, `cliff.toml`).

---

## Key source files

| Path | Purpose |
|------|---------|
| `typescript/packages/core/src/core/schema.ts` | Zod schemas — authoritative YAML validation rules |
| `typescript/packages/core/src/matimo-instance.ts` | TypeScript SDK main entry point |
| `typescript/packages/core/src/mcp/mcp-server.ts` | MCP stdio + HTTP transport |
| `typescript/packages/core/src/policy/` | Policy engine (risk classifier, HITL, content validator) |
| `typescript/packages/core/tools/` | Built-in tools (calculator, read, web, matimo_* meta-tools) |
| `typescript/packages/core/skills/` | Core Matimo SKILL.md files (tool-creation, policy-validation…) |
| `typescript/scripts/validate-tool.ts` | Runs YAML validation across all workspace packages |
| `typescript/pnpm-workspace.yaml` | Authoritative list of active packages |

---

## Where to look (docs)

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

---

## Don't

- Don't add files under root `packages/` or root `examples/` — both are untracked, dead leftovers from before the `typescript/`/`python/` restructure.
- Don't add a provider without a matching risk classification per tool.
- Don't let TS and Python SDKs drift — new features ship to both unless the user says otherwise.
- Don't hand-edit `pnpm-lock.yaml` / `uv.lock` — regenerate via the package manager.
- Don't describe `@matimo/composio` as a "proxy" of Composio's API — say it "wraps"/"calls"/"routes through" Composio instead.
