---
name: add-package
description: Scaffold and fully implement a new @matimo/<name> provider package. Covers: checking typescript/ for WIP implementations, scaffolding the package structure, OAuth2 provider config, implementing all initial tools (each via the full add-tool workflow), writing SKILL.md, README, and registering in pnpm-workspace.yaml. Use when asked to add a new provider integration to Matimo.
---

Add a new Matimo provider package: **$ARGUMENTS**

If no provider specified, ask: which provider (e.g. LinkedIn, Stripe, Twitter/X), and which tools to include in the first release.

---

## Step 1 — Check for existing WIP implementation

Look in `typescript/packages/` first:
```bash
ls typescript/packages/
```
If `typescript/packages/<name>/` exists, examine its tool YAML files. These can be adapted — they may just need schema fixes and Python executors added. Validate them: `pnpm validate-tools`.

If no existing implementation, scaffold from scratch (use `packages/slack/` as the reference template).

---

## Step 2 — Fetch official API docs

Use WebSearch / WebFetch to get the real API reference. Document:
- Base URL
- Authentication method (API key, OAuth2, Basic, Bearer)
- Rate limits
- Available endpoints — pick the highest-value ones for v1 (aim for 3–8 tools)

---

## Step 3 — Create package directory structure

```
packages/<name>/
├── package.json
├── definition.yaml          # OAuth2 provider config (omit if API key auth only)
├── tools/
├── skills/
│   └── <name>/
│       └── SKILL.md
├── test/
│   ├── unit/
│   └── integration/
└── README.md
```

**`package.json`:**
```json
{
  "name": "@matimo/<name>",
  "version": "0.1.0",
  "description": "<Provider> tools for Matimo",
  "type": "module",
  "files": ["tools", "skills", "README.md"],
  "peerDependencies": { "matimo": "workspace:*" },
  "devDependencies": { "@matimo/core": "workspace:*" }
}
```

**Add to `pnpm-workspace.yaml`:**
```yaml
- "packages/<name>"
```

---

## Step 4 — OAuth2 provider config (if OAuth2 auth)

`packages/<name>/definition.yaml`:
```yaml
name: <name>-provider
type: provider
version: '1.0.0'
description: |
  <Provider> OAuth2 Provider Configuration
  Setup instructions here...

provider:
  name: <name>
  displayName: <Provider Name>
  oauth2:
    authorizationUrl: https://provider.com/oauth/authorize
    tokenUrl: https://provider.com/oauth/token
    scopes: [scope1, scope2]
  env:
    CLIENT_ID: <NAME>_CLIENT_ID
    CLIENT_SECRET: <NAME>_CLIENT_SECRET
    REDIRECT_URI: <NAME>_REDIRECT_URI
```

---

## Step 5 — Implement each tool

For each tool in this package, follow the complete `/add-tool` workflow:
1. YAML definition
2. `.ts` + `.py` executors (only if `type: function`)
3. `pnpm validate-tools`
4. Fix lint (TS + Python)
5. Unit tests — 100% coverage for that tool
6. TypeScript examples (factory, decorator, langchain, with-approval)
7. Python examples (native, langchain, crewai)

Run tests after every tool. Do not batch-implement all tools before testing.

---

## Step 6 — Write SKILL.md

`packages/<name>/skills/<name>/SKILL.md`:
```markdown
---
name: <name>
description: "Complete guide to all <Provider> tools — <summary of capabilities>."
version: "1.0.0"
license: "MIT"
metadata:
  category: "<Category>"
  difficulty: "beginner"
  apply-to: "<space-separated list of tool names>"
  author: "Matimo"
  tags: "<name>,<tag2>"
---

# <Provider>

## All Available Tools

| Tool | Purpose | Auth Scope |
|------|---------|------------|
| `<tool_name>` | Description | `scope.name` |

## Authentication

Required env vars and setup instructions.

## Common Patterns

Examples of typical usage with code.

## API Reference

Link to official docs.
```

---

## Step 7 — Write README.md

`packages/<name>/README.md`:
- What the package provides
- Installation: `npm install @matimo/<name>`
- Required env vars (table)
- Quick example (factory pattern, 15 lines)
- Available tools (table matching SKILL.md)
- Link to official provider docs

---

## Step 8 — Install and validate everything

```bash
pnpm install          # pick up new workspace package
pnpm validate-tools   # all tool YAMLs valid
pnpm build            # compiles without error
pnpm test             # all tests pass
pnpm lint             # clean
cd python && uv sync && uv run pytest packages/<name> --cov && uv run ruff check packages/<name>
```

Report done only when all pass.
