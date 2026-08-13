## v0.1.7 — Composio Google Workspace Expansion: Gmail, Sheets, Docs, Forms, Meet 📇

> **Release**: Five new Composio-backed Google Workspace toolkits (Gmail, Sheets, Docs, Forms, Meet) adding 107 governed tools, plus explicit BYOK compliance documentation for the Composio dependency, two small fixes, and a flaky-test timeout fix.

**Released**: August 11, 2026
**Scope**: `typescript/` workspace — all 13 packages (`core`, `cli`, `bruno`, `slack`, `gmail`, `github`, `hubspot`, `notion`, `mailchimp`, `microsoft`, `postgres`, `twilio`, `composio`) bumped to `0.1.7` in lockstep. Python untouched this release.
**Severity**: 🟢 **Additive** — new tools and documentation only, no breaking changes to existing package APIs

---

### ✨ **Composio: 5 new Google Workspace toolkits**

`@matimo/composio`'s generated catalog grows from 342 → 449 tools across 9 → 14 toolkits: Gmail (23), Google Sheets (36), Google Docs (32), Google Forms (7), and Google Meet (9). Same governed-access model as every other `composio_*` tool — bring-your-own `COMPOSIO_API_KEY` + `composio_connected_account_id`, risk-classified, policy-gated.

### 🧪 **Gmail: example coverage**

The new Gmail toolkit is exercised across all four example patterns (factory, decorator, LangChain, HITL-approval).

### 📚 **Composio: BYOK & third-party notices**

Documented `@matimo/composio`'s bring-your-own-key credential model explicitly: a non-affiliation disclaimer and links to Composio's Terms of Service and Privacy Policy were added to the package README and `docs/COMPOSIO.md`. Added `THIRD_PARTY_NOTICES.md`, listing every provider Matimo can connect to, its credential env var, and a link to that provider's own terms. `CONTRIBUTING.md` and `SECURITY.md` now mandate the BYOK pattern for all future third-party connectors, not just Composio.

### 🐛 **Fixes**

- Provider sub-package manifests were missing an explicit `license: MIT` field, silently triggering an npm/pnpm publish warning on everything but `core`
- CI now pins `uv run ruff` (locked `0.15.9`) instead of the floating `uv tool run ruff`, which pulled an unpinned version and flagged findings never enforced for these packages
- HITL integration tests (`matimo-instance-hitl-paths.test.ts`) given headroom above Jest's 5000ms default — they drive a real `type: command` child-process spawn plus approval-manifest disk I/O with no prior margin, which could exceed the default under CI load even though the logic itself was correct

---

## v0.1.6 — Document & Web Tooling: web_scraper, convert_to_file, extract_from_file 🛠️

> **Release**: Three new core tools for pulling content into an agent's context and turning agent output into shippable files, plus expression-mode calculator, a Gmail attachment tool, a Bruno bug fix, and a round of dependency security patches.

**Released**: July 15, 2026
**Scope**: `typescript/` workspace — all 13 packages (`core`, `cli`, `bruno`, `slack`, `gmail`, `github`, `hubspot`, `notion`, `mailchimp`, `microsoft`, `postgres`, `twilio`, `composio`) bumped to `0.1.6` in lockstep. Corresponding Python changes land in Python v0.1.2, immediately below.
**Severity**: 🟢 **Additive** — three new tools, one new tool parameter mode, one bug fix, no breaking changes to existing package APIs

---

### ✨ **New Core Tool: `web_scraper`**

Crawls a website starting from a given URL and extracts the main readable content of every page discovered within the same domain (child/sibling pages reachable via same-domain links), bounded by `maxPages`/`maxDepth`. No headless browser — fetches HTML directly and extracts readable content via `@mozilla/readability` + `jsdom` (TypeScript) / `readability-lxml` + `markdownify` (Python).

### ✨ **New Core Tool: `convert_to_file`**

Converts structured content between JSON, CSV, Markdown, and plain text into a target file format: JSON↔CSV round-tripping, Markdown→PDF, Markdown→DOCX, plain text→DOCX/TXT. Markdown is parsed into headings/paragraphs/lists before being re-rendered into the target format, rather than dumped as raw text. TypeScript: `marked` + `pdfkit` + `docx`. Python: `mistune` + `reportlab` + `python-docx`.

### ✨ **New Core Tool: `extract_from_file`**

Extracts text content from a local or remote file — PDF (text extraction), DOCX (raw text extraction), plain text/CSV. Format is auto-detected from the file extension and magic bytes unless explicitly specified. TypeScript: `pdf-parse` + `mammoth`. Python: `pypdf` + `python-docx`.

### ✨ **Calculator: expression mode**

`calculator` now supports two mutually exclusive modes: the existing binary/unary `operation` + `a`/`b` mode, and a new `expression` string mode with full operator precedence, parentheses, and the constants `pi`/`e` (e.g. `"sqrt(16) + 2^3 - sin(pi/2)"`). An optional `precision` rounds the final result. Expressions are evaluated in a sandboxed parser — `mathjs` in TypeScript, `simpleeval` in Python — never raw `eval()`/`Function()`.

### ✨ **Gmail: `get-attachment` tool**

Fetches a Gmail message attachment by ID, returning its size and base64url-encoded raw data.

### 🐛 **Fix: Bruno tools silently discarded subprocess errors**

`bruno_run_collection` and `bruno_run_request` always returned an empty `errors` array on subprocess failure, discarding `bru`'s stderr output — making failures undebuggable. Both now capture stderr into `errors` when the process exits non-zero. `bruno_run_request` also concatenated stdout/stderr with a stray leading newline when stdout was empty; now joins only the parts that are present.

### 🔐 **Security: dependency bumps**

- `js-yaml` `^4.1.1` → `^5.2.1` (TypeScript) — `YAML.load()` now throws on empty/comment-only input instead of returning `undefined`; `skill-loader.ts` and `policy-loader.ts` updated to use `YAML.loadAll()` and treat a zero-document result as "no content"
- `uuid` `^10.0.0` → `^11.1.1` (TypeScript)
- `fast-uri` → `3.1.3` (root devDependency chain via `ajv`/commitlint) — fixes two chained high-severity advisories (path traversal via percent-encoded dot segments; host confusion via percent-encoded authority delimiters)
- Seven transitive TypeScript dependencies bumped via `pnpm.overrides` (Dependabot-flagged, several levels deep: `grpc`/`proto-loader` and others)
- Python: `starlette`, `cryptography`, `aiohttp`, `langsmith` bumped across `python/uv.lock` and `python/examples/mcp/uv.lock`
- Python: `langgraph-sdk`, `langgraph-checkpoint`, `pyjwt`, `python-multipart`, `pydantic-settings` bumped (root + `examples/mcp`)

### 📚 **Documentation**

- Root `README.md` repositioned to lead with Matimo's governance-layer identity ahead of feature listing
- `docs/api-reference/META_TOOLS.md` — added full reference sections for `matimo_get_tool` and `matimo_search_tools` (previously undocumented despite being implemented), corrected an inflated claim about Python example coverage
- `docs/architecture/OVERVIEW.md` — removed a reference to a nonexistent "echo" tool, corrected the built-in tool list and counts, fixed the ASCII architecture diagram
- `docs/index.md`, `docs/getting-started/QUICK_START.md` — corrected meta-tool counts and a dead link

### 🧪 **Verification**

- `pnpm validate-tools`: 492/492 valid
- `pnpm lint`: clean
- `pnpm test:coverage`: 2412/2412 tests passing, 95.24% lines / 87.90% branches / 97.53% functions / 95.95% statements

---

## Python v0.1.2 — Document Tooling Parity, Calculator Expressions & Bruno Fix 🐍

> **Release**: Python-side parity with the TypeScript v0.1.6 release above — same three new core tools, same calculator expression mode, same Bruno fix.

**Released**: July 15, 2026
**Scope**: `python/` workspace — all 13 packages (`matimo-core`, `matimo-cli`, `matimo` meta-package, `matimo-bruno`, `matimo-slack`, `matimo-gmail`, `matimo-github`, `matimo-hubspot`, `matimo-notion`, `matimo-mailchimp`, `matimo-microsoft`, `matimo-postgres`, `matimo-twilio`) bumped to `0.1.2` in lockstep, matching the versioning strategy TypeScript already uses. Previously, only the `matimo` meta-package (last at `0.1.1.post1`) and `matimo-core` (last at `0.1.0`) had diverged; this release re-synchronizes every package.
**Severity**: 🟢 **Additive** — no breaking changes; `matimo-core`'s dependency bound (`>=0.1.0,<0.2.0`) on every provider package already covers `0.1.2`, so no constraint changes were needed

---

### ✨ **New `matimo-core` tools**: `web_scraper`, `convert_to_file`, `extract_from_file`

Same behavior as the TypeScript versions (see v0.1.6 above). New dependencies added to `matimo-core`: `pypdf`, `python-docx`, `mistune`, `reportlab`, `readability-lxml`, `markdownify`, `lxml-html-clean`.

### ✨ **Calculator: expression mode**

Same `expression` parameter mode as TypeScript, evaluated via `simpleeval` (never raw `eval()`). New dependency: `simpleeval`.

### ✨ **Gmail: `get-attachment` tool**

Python executor added alongside the TypeScript one.

### 🐛 **Fix: Bruno tools silently discarded subprocess errors**

Same root cause and fix as the TypeScript side — `bruno_run_collection`/`bruno_run_request` now populate `errors` from stderr on non-zero exit, and `bruno_run_request` no longer prepends a stray newline when stdout is empty. Also fixed a test assertion in `test_bruno_tools.py` that expected `collection.name` to be `None` when no `bruno.json` is present — the tool correctly falls back to the directory name, matching the TypeScript implementation.

### 🧪 **Verification**

- `ruff check packages/ scripts/`: clean
- `python scripts/validate_tools.py`: 155/155 valid
- `matimo-core` tests: 97% line coverage (`pytest packages/core/tests/`)
- `matimo-bruno` tests: 107/107 passing (`uv run --package matimo-bruno pytest packages/bruno/tests/`)
- `matimo-gmail` tests: 12/12 passing
- `matimo-microsoft` tests: 146/146 passing (unaffected, re-run as part of the lockstep bump)

---

## v0.1.5 — @matimo/composio: Governed Access to 342 Composio Tools 🔌

> **Release**: Introduces `@matimo/composio` — a policy-governed, risk-classified wrapper around Composio's integration catalog. Agents now get governed, auditable, human-approvable access to Jira, Google Workspace, Microsoft 365, Asana, Linear, and more without losing Matimo's policy engine.

**Released**: June 21, 2026
**Scope**: `typescript/` workspace — all 13 packages (`core`, `cli`, `bruno`, `slack`, `gmail`, `github`, `hubspot`, `notion`, `mailchimp`, `microsoft`, `postgres`, `twilio`, `composio`) bumped to `0.1.5` in lockstep
**Severity**: 🟢 **Additive** — new package + dependency maintenance, no breaking changes to existing package APIs

---

### ⬆️ **Dependency Upgrade: axios `^1.15.2` → `^1.18.0`**

Bumped axios workspace-wide ahead of this release — applied via the `pnpm.overrides` block in `typescript/package.json` plus the direct `axios` dependency in `core`, `composio`, `gmail`, `notion`, `microsoft`, and `slack`. Verified `axios@1.18.0` resolves consistently across every package in the workspace (including transitive consumers like `cli`, `bruno`, `postgres`, `twilio`, `hubspot`, `github`, `mailchimp`, and `examples/tools`) via the lockfile and `node_modules` resolution.

No code changes were required — axios 1.18 is backward-compatible with 1.15 for Matimo's usage. Verified via:
- Full test suite: 2185/2185 tests passing, including HTTP-executor and secrets-resolver suites that exercise axios-based requests
- All 4 composio examples re-run live against a real Jira connected account, making real HTTP calls through the upgraded axios — all behaved identically to pre-upgrade

---

### 🐛 **Fix: `pnpm test` could run against stale/missing compiled tool files**

`type: function` tools (e.g. `@matimo/microsoft`'s `ms_search_knowledge`, `ms_read_file`, `ms_list_files`, `ms_create_document`) ship as colocated `.ts` sources that `tsc` compiles in place to `.js` — the `.js` outputs are gitignored (`typescript/packages/*/tools/**/*.js`) and only exist after `pnpm build`. Running `pnpm test` without building first causes `FunctionExecutor`'s dynamic `import()` to fail to find those files, producing a generic (non-`MatimoError`) failure with `result.code: undefined` instead of `'VALIDATION_FAILED'` — this is what surfaced as recurring, hard-to-pin-down microsoft integration test failures across releases.

CI already guarded against this with an explicit `Build` step (added after the v0.1.4 release for the same reason), but local `pnpm test` runs had no equivalent guard. Root-caused by reproducing directly: removing the compiled `.js` files locally reproduced the exact failure (4 failing assertions, `code: undefined`); rebuilding fixed it immediately.

**Fix**: added `pretest`/`pretest:coverage` scripts (`pnpm build`) to `typescript/package.json`, and set `enable-pre-post-scripts=true` in `typescript/.npmrc` — pnpm defaults this to `false`, so the lifecycle hooks were silently never firing. Verified the fix by reproducing the failure, confirming `pnpm test` now auto-rebuilds and passes without a manual `pnpm build` step first; full suite re-run clean (2185/2185) afterward.

---

### 🆕 **New Package: `@matimo/composio`**

`@matimo/composio` wraps [Composio](https://composio.dev)'s REST execute endpoint with Matimo's full governance stack. Every Composio action becomes a schema-valid Matimo tool with explicit risk classification, policy-gated execution, and optional HITL approval — all without custom executor code.

**342 generated tools across 9 toolkits:**

| Toolkit | Tools | Key actions |
|---------|-------|-------------|
| `jira` | 46 | get/create/update/delete issue, search JQL, manage projects |
| `asana` | 84 | tasks, projects, teams, portfolios, goals |
| `linear` | 21 | issues, cycles, projects, roadmaps |
| `googledrive` | 51 | upload/download/search files, manage permissions, shared drives |
| `googlecalendar` | 28 | create/find/list events, free/busy query, multi-calendar |
| `outlook` | 43 | email rules, folders, contacts, calendar, attachments |
| `one_drive` | 35 | files, folders, SharePoint lists, site contents, subscriptions |
| `share_point` | 6 | folders, lists, list items, user management |
| `microsoft_teams` | 28 | teams, channels, chats, messages, meetings |

---

### 🏗 **Generator: `scripts/generate-tools.ts`**

A typed TypeScript script (`pnpm generate:composio`) that fetches a toolkit's action catalog from Composio's REST API and writes one `definition.yaml` per action — idempotent, paginated, and schema-validated on every write.

Key generator behaviors:
- **Risk heuristic**: derives `risk: low | medium | high` from the action slug (`GET_*` → low, `CREATE_*` → medium, `DELETE_*` → high; destructive patterns win over read patterns)
- **`risk-overrides.json`**: per-action overrides for actions the heuristic misclassifies (e.g. `GOOGLEDRIVE_EMPTY_TRASH` → `high`, `GOOGLECALENDAR_CLEAR_CALENDAR` → `high`)
- **`_matimo_tool` marker**: every generated tool bakes its own name into `execution.body.arguments._matimo_tool` as a literal (not a `{param}` placeholder) — this is the fix for Composio's API requirement that `arguments` always be present in the request body even when empty, which would otherwise be stripped by Matimo's HTTP executor after parameter templating
- **`--force-refresh`**: regenerates all files for a toolkit even if they already exist (use after editing `risk-overrides.json`)

```bash
cd typescript/
pnpm generate:composio --toolkits=JIRA,LINEAR,GOOGLEDRIVE
pnpm generate:composio --toolkits=GOOGLEDRIVE,GOOGLECALENDAR --force-refresh
pnpm validate-tools   # 488 valid, 0 invalid
```

---

### 🛡 **Governance Layer**

`DefaultPolicyEngine.canExecute()` does not gate on `risk:` (it handles deprecation/draft/`requires_approval`). To enforce human approval for composio write/delete operations, applications supply a custom `PolicyEngine`:

```typescript
class ComposioRiskPolicy implements PolicyEngine {
  canExecute(ctx, tool): PolicyDecision {
    const base = new DefaultPolicyEngine().canExecute(ctx, tool);
    if (base.allowed !== true) return base;
    const risk = classifyRisk(tool);
    if (tool.name.startsWith('composio_') && (risk === 'medium' || risk === 'high')) {
      return { allowed: 'pending_approval', riskLevel: risk, reason: '...', toolName: tool.name };
    }
    return { allowed: true };
  }
  canCreate(ctx, tool) { return new DefaultPolicyEngine().canCreate(ctx, tool); }
}

const matimo = await MatimoInstance.init({
  toolPaths: [COMPOSIO_TOOLS_DIR],
  policy: new ComposioRiskPolicy(),
  onHITL: async (req) => promptForApproval(req),
});
```

---

### 📚 **Documentation & Examples**

- **[`docs/COMPOSIO.md`](COMPOSIO.md)** — full integration guide (architecture, toolkit catalog, governance, LangChain 128-tool limit, naming conventions, response structure)
- **[`typescript/packages/composio/README.md`](../typescript/packages/composio/README.md)** — package-level README (generator usage, what gets generated, `_matimo_tool` marker explanation, risk overrides, testing strategy)
- **[`typescript/packages/composio/skills/composio/SKILL.md`](../typescript/packages/composio/skills/composio/SKILL.md)** — agent knowledge document (how composio_* calls work, three required inputs, risk levels, missing connected account handling, reading the response envelope)

**4 TypeScript examples** in `typescript/examples/tools/composio/`:
- `composio-factory.ts` — direct execute() across Jira, Drive, Calendar, Teams
- `composio-decorator.ts` — `@tool` class-method decorators with pre-filled tenant credentials
- `composio-langchain.ts` — LangChain agent with curated toolkit subset (solves 128-tool limit)
- `composio-with-approval.ts` — custom PolicyEngine that quarantines medium/high risk tools at execute() time

---

### 🧪 **Testing**

`@matimo/composio` follows the "generated tools" testing exception (no per-tool tests or examples required):
- `packages/composio/test/unit/generator.test.ts` — 29 tests covering the generator, risk classification, parameter mapping, schema validation, pagination, idempotency
- `pnpm validate-tools` — all 488 tools (342 composio + 146 existing) schema-valid
- Live smoke test + full example run, all confirmed against a real Jira connected account:
  - `composio_jira_get_current_user` (factory + decorator + approval examples) → real Jira user data (displayName, accountId, timeZone)
  - `composio_jira_get_issue_types` (decorator) → real Jira issue type list (`Epic`, etc.)
  - LangChain agent (GPT-4o-mini) → loaded 342 tools, filtered to 46 Jira tools, made real Composio API call, returned natural language response
  - HITL approval flow → low-risk executed immediately; medium (`create_issue`) and high (`delete_issue`) both triggered approval prompt with correct risk labels before proceeding
  - `canCreate()` returned `pending_approval` for medium-risk tools in prod context; `classifyRisk()` honored explicit YAML risk fields + overrides

**Known Composio catalog issue**: As of March 2026, Jira deprecated `/rest/api/3/search`. Composio's `JIRA_SEARCH_ISSUES` and `JIRA_SEARCH_FOR_ISSUES_USING_JQL_POST` actions return HTTP 410 until Composio updates their catalog to use `/rest/api/3/search/jql`. All other Jira actions are unaffected.

**Full workspace gate** (post version bump to `0.1.5`, all 13 packages): `pnpm install`, `pnpm build`, `pnpm validate-tools` (488/488 valid), `pnpm lint` (clean), `pnpm test` / `test:coverage` (2185/2185 passing, 95.24% lines / 97.53% functions) — all green.

---

## v0.1.4 — Function-Type Tool Runtime Loading Fix & Microsoft Provider Fixes 🔧

> **Release**: Closes the remaining "function-type tools crash at runtime for npm consumers" gap from v0.1.3 across `@matimo/core`, `@matimo/bruno`, `@matimo/notion`, `@matimo/postgres`, and `@matimo/microsoft` — plus Microsoft Graph bug fixes and example corrections

**Released**: June 11, 2026
**Scope**: TypeScript workspace — `matimo` (root), `@matimo/core`, `@matimo/bruno`, `@matimo/notion`, `@matimo/postgres`, and `@matimo/microsoft` bumped to v0.1.4
**Severity**: 🟠 **Important** — fixes a runtime crash for npm consumers of `type: function` tools in the affected packages; no breaking API changes

---

### 🐛 **Bug Fix: Function-Type Tools Now Compile to `.js` In Place (extends v0.1.3 Issue 1)**

**Problem:**
v0.1.3 fixed `@matimo/core`'s built-in function-type tools (`web`, `calculator`, `execute`) by rewriting their imports to a runtime-safe `@matimo/core/runtime` subpath — but the tool files themselves still shipped as raw `.ts` source with `code: './foo.ts'` in `definition.yaml`. `FunctionExecutor` loads these via dynamic `import()`, which Node cannot resolve for `.ts` files without a transpiling loader (`tsx`/`ts-node`) — something npm consumers of `@matimo/core`, `@matimo/bruno`, `@matimo/notion`, `@matimo/postgres`, and `@matimo/microsoft` do not have installed. Every `type: function` tool in these 5 packages — built-in core tools (`web`, `calculator`, `execute`, `read`, `edit`, `search`), all 10 `matimo_*` meta-tools, the 7 Bruno CLI tools, the Notion page-creation tool, the Postgres SQL executor, and all 9 Microsoft Graph tools — would fail to load at runtime outside the monorepo.

**Fix:**
- Each affected package now compiles `tools/**/*.ts` → `tools/**/*.js` **in place** via a new build step (`@matimo/core` adds `tsc -p tsconfig.tools.json`; `@matimo/bruno`, `@matimo/notion`, `@matimo/postgres`, and `@matimo/microsoft` each get their own `tsc` build script). The `tools/` tsconfig uses `module: ES2020`, `moduleResolution: bundler`, and `outDir` == `rootDir` (`./tools`), so the compiled `.js` sits next to its `.ts` source and ships in the npm tarball alongside it.
- Every `definition.yaml` for a `type: function` tool now points `code:` at the compiled `./<tool>.js` instead of `./<tool>.ts`.
- All affected tool source files import `@matimo/core/runtime` (not the full `@matimo/core` barrel), use explicit `.js` extensions on relative imports (e.g. `'../graph-client.js'`), and define local `ToolContext`-style interfaces instead of importing TypeScript-only types across the runtime boundary — the same pattern v0.1.3 established for core's built-in tools and skill meta-tools.
- `@matimo/bruno`, `@matimo/notion`, `@matimo/postgres`, and `@matimo/microsoft` now declare `@matimo/core` as a runtime `dependency` (previously absent or dev-only), since their compiled tool files `import` from `@matimo/core/runtime` at execution time.
- `@matimo/core` gained `glob` as a runtime dependency (used by the `search` tool, now compiled and shipped under `tools/`).
- The hand-written `tools/shared/skill-validation.js` runtime shim added in v0.1.3 is now generated from `skill-validation.ts` by the new build step and removed from version control (`.gitignore` now excludes `typescript/packages/*/tools/**/*.js`).
- `jest.config.cjs` updated (`allowJs: true`, transform matches `.ts`/`.js`, `transformIgnorePatterns` for `node_modules`/`dist`) so ts-jest runs cleanly against the mixed `.ts`/`.js` `tools/` trees.

---

### 🐛 **Bug Fix: Microsoft Graph `$search` ConsistencyLevel Header & Non-UTF-8 File Decoding**

**Problem 1 — `ms_get_email` search queries:**
Microsoft Graph's `$search` on `/me/messages` requires the `ConsistencyLevel: eventual` header; omitting it can cause a `400 UnsupportedQuery` error.

**Fix:** `ms_get_email` now injects `ConsistencyLevel: eventual` only when the `search` parameter is provided — `$filter`/`$orderby`-only queries are unaffected.

**Problem 2 — `ms_read_file` non-UTF-8 content:**
The Python executor decoded file content with `buffer.decode('utf-8')`, which raises `UnicodeDecodeError` on non-UTF-8 bytes (e.g. Latin-1 encoded `text/plain` files). Node's `Buffer.toString()` has no equivalent failure mode — it silently replaces invalid sequences — so the Python and TypeScript executors behaved differently for the same file.

**Fix:** Python decode now uses `errors='replace'`, matching the TypeScript executor's behavior. Regression tests added for both cases.

*(commit `b8c7cb0`)*

---

### 🛠 **Example Fixes**

- **`bruno-complete-workflow.ts`** — Fixed 5 field-name mismatches between the example script and the current `@matimo/bruno` tool output schemas; all 6 workflows now run end-to-end without crashing.
- **128-tool cap in LangChain demos** — `policy-demo.ts`, `skills-demo.ts`, and `meta-tools-integration.ts` now filter provider-package tools out of the LangChain binding via a shared `forLangChain()` helper before calling `bindTools()`. With `autoDiscover: true` now loading 146+ tools across 11 provider packages, OpenAI's 128-tool hard limit was previously exceeded; these demos only ever invoke `matimo_*` meta-tools, core tools, and self-created tools, so provider-package tools are safely excluded from the binding.

---

### 📦 **Version Bumps**

| Package | Previous | New | Type |
|---------|----------|-----|------|
| matimo (root) | 0.1.3 | 0.1.4 | Patch |
| @matimo/core | 0.1.3 | 0.1.4 | Patch |
| @matimo/bruno | 0.1.3 | 0.1.4 | Patch |
| @matimo/notion | 0.1.3 | 0.1.4 | Patch |
| @matimo/postgres | 0.1.3 | 0.1.4 | Patch |
| @matimo/microsoft | 0.1.0 | 0.1.4 | Catch-up |

`@matimo/microsoft` jumps from `0.1.0` to `0.1.4` to align with the rest of the workspace's release train. All other packages (slack, gmail, github, hubspot, mailchimp, twilio, cli, linkedin, medium, reddit) are unchanged in this release — they have no `type: function` tools affected by the build-pipeline fix above.

---

### 📊 **Current Totals**

- **146+ tools** across **11 provider packages**: Slack (16+), GitHub (10+), Gmail (5+), Notion (7+), HubSpot (50+), Mailchimp (8+), Postgres (6+), Twilio (4+), Bruno CLI (7), Microsoft Graph (9), plus Core (19 built-in tools)
- **10 meta-tools** for runtime tool and skill management

---

### 🧪 **Verification**

- ✅ `pnpm build` — 12/12 packages, `tools/**/*.js` generated alongside `.ts` source for every `type: function` tool in core, bruno, notion, postgres, and microsoft
- ✅ `pnpm test` — 100/100 suites, 2156/2156 tests passing
- ✅ All 6 `bruno-complete-workflow.ts` workflows complete without error
- ✅ Policy, Skills, and Meta-Tools LangChain demos run cleanly under the 128-tool cap

---

### 🔄 **Upgrade**

```bash
npm install matimo@0.1.4
# or
npm update matimo
```

No API changes — all interfaces remain identical. Consumers of `@matimo/core`, `@matimo/bruno`, `@matimo/notion`, `@matimo/postgres`, or `@matimo/microsoft` who previously hit `ERR_MODULE_NOT_FOUND` / `ERR_UNKNOWN_FILE_EXTENSION` errors loading `type: function` tools should reinstall to pick up the compiled `.js` tool files.

---
---

## Microsoft Graph Provider — v0.1.0 🪟

> **Release**: New provider package — Microsoft Graph integration for search, mail, files, Teams, calendar, and SharePoint

**Released**: June 9, 2026
**Scope**: New packages only — `@matimo/microsoft v0.1.0` (npm) · `matimo-microsoft v0.1.0` (PyPI)
**Severity**: 🟢 **Additive** — no changes to existing packages

---

### 🆕 **New Provider: Microsoft Graph**

9 tools covering the full Microsoft 365 surface area, using delegated OAuth2 access tokens:

| Tool | Description | Risk | Graph Endpoint |
|------|-------------|------|----------------|
| `ms_search_knowledge` | Search SharePoint sites, OneDrive/SharePoint files, and list items | low | `POST /search/query` |
| `ms_read_file` | Read a OneDrive/SharePoint file's contents (plain-text formats) | low | `GET /drives/{id}/items/{id}/content` |
| `ms_list_files` | List children of a OneDrive/SharePoint folder | low | `GET /drives/{id}/items/{id}/children` |
| `ms_get_email` | List messages in the signed-in user's mailbox | low | `GET /me/messages` |
| `ms_send_email` | Send an email as the signed-in user | **high** (approval) | `POST /me/messages` + `/send` |
| `ms_send_teams_message` | Post or reply to a message in a Teams channel | medium | `POST /teams/{id}/channels/{id}/messages` |
| `ms_create_document` | Upload a file to OneDrive/SharePoint (≤4 MB) | medium | `PUT /drives/{id}/items/{id}:/{name}:/content` |
| `ms_create_calendar_event` | Create a calendar event, optionally as a Teams meeting | medium | `POST /me/events` |
| `ms_publish_to_sharepoint` | Create and publish a SharePoint site page | **high** (approval) | `POST /sites/{id}/pages` + `/publish` |

`ms_send_email` and `ms_publish_to_sharepoint` are `risk: high` with `requires_approval: true` — routed through the HITL flow before execution.

---

### 🐛 **Bug Fix: Retry-After Header Parsing**

**Problem:**
The Python `graph_client.py` called `float(retry_after_header)` directly when mapping 429 responses. Per RFC 9110 §10.2.3, `Retry-After` MAY be an HTTP-date string (e.g. `Fri, 31 Dec 1999 23:59:59 GMT`) rather than delta-seconds. Python's `float()` raises `ValueError` on non-numeric input — unlike JavaScript's `Number()` which returns `NaN` — so an HTTP-date header from a proxy or gateway would crash error mapping entirely rather than gracefully falling back to exponential backoff.

**Fix:**
Extracted `_parse_retry_after_seconds()` helper that guards the conversion in a `try/except (TypeError, ValueError)` block, returning `None` on non-numeric values. The retry loop already handled `None` correctly (falls back to exponential backoff). Regression test added for the HTTP-date case.

---

### 📦 **New Packages**

| Package | Version | Registry |
|---------|---------|----------|
| `@matimo/microsoft` | 0.1.0 | npm |
| `matimo-microsoft` | 0.1.0 | PyPI |

No existing package versions changed.

---

### 🧪 **Verification**

- ✅ All 9 TypeScript tool YAMLs validate against schema (`pnpm validate-tools`)
- ✅ TypeScript: 2155 tests pass, 95.94% line coverage, 97.53% function coverage
- ✅ Python: 1141 tests pass, 98% coverage — `matimo_microsoft` package at 100%
- ✅ TypeScript lint clean
- ✅ Python ruff clean (all findings are pre-existing in unrelated example files)

---

### 🔄 **Install**

```bash
# TypeScript
npm install @matimo/microsoft

# Python
pip install matimo-microsoft
```

Authentication: provide a delegated Microsoft Graph access token via the `MICROSOFT_GRAPH_ACCESS_TOKEN` environment variable or `credentials` parameter. Matimo never performs the OAuth exchange itself.

---

---

## v0.1.3 — Tool Import & Package Hotfix 🔧

> **Release**: Critical fix for broken runtime imports in published tool files and missing meta package README

**Released**: May 19, 2026  
**Scope**: TypeScript SDK only — All packages bumped to v0.1.3  
**Severity**: 🔴 **CRITICAL** — Function-type tools crash at runtime for all public npm consumers

---

### 🐛 **Issue 1: Tool Files Importing from `../../src/` at Runtime**

**Problem:**  
Function-type tool files shipped under `tools/` in the tarball contained imports pointing to `../../src/...` — a path that does not exist in the published npm package (only `dist/` is shipped):

```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module
  '/path/to/node_modules/@matimo/core/src/errors/matimo-error'
```

**Root Cause:**  
The `tsconfig.json` for `@matimo/core` only compiles `src/**/*` to `dist/`. Tool files under `tools/` are shipped as raw source and loaded at runtime via dynamic `import()` by `FunctionExecutor`. These files must import from the compiled `dist/` output, not the unshipped `src/` tree.

**Files Fixed:**
- `tools/web/web.ts` — 1 import
- `tools/calculator/calculator.ts` — 2 imports
- `tools/execute/execute.ts` — 3 imports

**Before:**
```typescript
import { MatimoError, ErrorCode } from '../../src/errors/matimo-error';
import { getGlobalMatimoLogger } from '../../src/logging/logger';
```

**After:**
```typescript
import { MatimoError, ErrorCode, getGlobalMatimoLogger, getGlobalApprovalHandler } from '@matimo/core/runtime';
```

**Why `@matimo/core/runtime` and not `../../dist/`:**  
Tool files are shipped as raw `.ts` source in the npm tarball (`tools/` is not compiled). They are loaded at runtime via dynamic `import()` by the `FunctionExecutor`. Two constraints apply simultaneously:
- `../../src/` — works in the monorepo (dev/tests) but `src/` is not shipped in the tarball, so it fails for npm consumers
- `../../dist/` — exists in the tarball but is ESM output; Jest (CJS runtime) cannot parse it

The `@matimo/core/runtime` subpath resolves both:
- **npm runtime**: resolved by `package.json` `exports["./runtime"]` → `dist/runtime/index.js` ✅
- **Jest**: mapped by `moduleNameMapper` → `src/runtime/index.ts` ✅

A dedicated `src/runtime/index.ts` entrypoint was added as a narrow export surface (only the 4 symbols built-in tools need), reducing coupling to the full package barrel.

---

### 🐛 **Issue 2: Skill Tool Files Importing Shared Helper Without `.js` Extension**

**Problem:**  
`matimo_create_skill`, `matimo_get_skill`, and `matimo_validate_skill` tool files imported `'../shared/skill-validation'` without a `.js` extension. Node ESM requires explicit extensions on relative imports.

**Solution:**  
- Added `.js` extension to all three imports: `'../shared/skill-validation.js'`
- Created `tools/shared/skill-validation.js` — a plain ESM JavaScript runtime equivalent of the `.ts` source (since `tools/` is excluded from `tsconfig` compilation, the `.ts` file cannot be `import()`-ed directly at runtime)
- Replaced TypeScript-only type imports (`type ValidationIssue`, `type BundledResources`) with local interface definitions in each tool file

---

### 🐛 **Issue 3: Default `excludePatterns` in `search` Tool**

**Problem:**  
The `search` tool silently excluded `dist/`, `build/`, `node_modules/`, and `.git/` from results by default — preventing legitimate use cases (e.g. inspecting compiled output).

**Solution:**  
Removed all hardcoded default exclusions. The `glob` `ignore` option is now only applied when the caller explicitly provides `excludePatterns`. Callers who want to exclude common directories must opt in explicitly.

---

### 🐛 **Issue 4: Meta `matimo` Package Had No README**

**Problem:**  
`typescript/package.json` declared `"README.md"` in its `files` array, but no `typescript/README.md` existed — so the `matimo` npm package tarball shipped with no README at all.

**Solution:**  
Added `typescript/README.md` — a TypeScript-only edition of the project README with absolute GitHub URLs for all links and images (relative paths do not resolve on npmjs.com).

---

### 📦 **Version Bumps**

| Package | Previous | New | Type |
|---------|----------|-----|------|
| matimo (root) | 0.1.2 | 0.1.3 | Patch |
| @matimo/core | 0.1.2 | 0.1.3 | Patch |
| @matimo/cli | 0.1.2 | 0.1.3 | Patch |
| @matimo/bruno | 0.1.2 | 0.1.3 | Patch |
| @matimo/github | 0.1.2 | 0.1.3 | Patch |
| @matimo/gmail | 0.1.2 | 0.1.3 | Patch |
| @matimo/hubspot | 0.1.2 | 0.1.3 | Patch |
| @matimo/linkedin | 0.1.0 | 0.1.3 | Patch |
| @matimo/mailchimp | 0.1.2 | 0.1.3 | Patch |
| @matimo/medium | 0.1.0 | 0.1.3 | Patch |
| @matimo/notion | 0.1.2 | 0.1.3 | Patch |
| @matimo/postgres | 0.1.2 | 0.1.3 | Patch |
| @matimo/reddit | 0.1.0 | 0.1.3 | Patch |
| @matimo/slack | 0.1.2 | 0.1.3 | Patch |
| @matimo/twilio | 0.1.2 | 0.1.3 | Patch |

---

### 🧪 **Verification**

- ✅ Function-type tools (`web`, `calculator`, `execute`, skill meta-tools) load and execute correctly from installed package
- ✅ Skill meta-tools (`matimo_create_skill`, `matimo_get_skill`, `matimo_validate_skill`) import shared helper correctly
- ✅ `search` tool returns results from `dist/` and `build/` when no `excludePatterns` specified
- ✅ `matimo` npm package tarball includes README
- ✅ All 137+ tools discoverable via auto-discovery

---

### 🔄 **Upgrade**

```bash
npm install matimo@0.1.3
# or
npm update matimo
```

No API changes — all interfaces remain identical.

---


## v0.1.1.post1 — Meta-Package Tools Path Fix 🐛

> **Release**: Hotfix for broken `pip install matimo` imports in Python SDK

**Released**: May 12, 2026  
**Scope**: Python SDK only — `matimo` meta-package bumped to v0.1.1.post1  
**Severity**: 🔴 **CRITICAL** — Breaks all public `pip install matimo` consumers

---
### 🐛 **Issue: Empty Meta-Package `__init__.py`**

**Problem:**  
After `pip install matimo`, all import attempts failed with:
```
ImportError: cannot import name 'Matimo' from 'matimo'
```

**Root Cause:**  
The `matimo` Python meta-package `__init__.py` was empty — it declared `matimo-core` as a dependency but never re-exported anything from it. Users installing `matimo` got an empty shell with no accessible API.

**Impact:**
- `from matimo import Matimo` — broken
- `from matimo import convert_tools_to_langchain` — broken  
- `from matimo import convert_tools_to_crewai` — broken
- All LangChain, CrewAI, MCP integrations inaccessible
- **`matimo` PyPI package unusable by all public users**

---

### ✅ **Solution: `pkgutil.extend_path` Namespace Merge**

Updated `python/packages/matimo/src/matimo/__init__.py` to:
1. Use `pkgutil.extend_path(__path__, __name__)` to merge the meta-package namespace with `matimo-core`'s files in site-packages
2. Explicitly re-export the full public API from `matimo-core` submodules
3. Include a complete `__all__` matching `matimo-core`'s public API

**Before:**
```python
# Empty — no exports at all
```

**After:**
```python
import pkgutil
__path__ = pkgutil.extend_path(__path__, __name__)

from matimo.instance import Matimo, InitOptions, ReloadResult, matimo
from matimo import convert_tools_to_langchain
from matimo import convert_tools_to_crewai
# ... full public API (lazy wrappers — no ImportError if optional deps absent)
```

---

### 📦 **Version Bumps**

| Package | Previous | New | Type |
|---------|----------|-----|------|
| matimo (Python meta-package) | 0.1.0 | 0.1.1.post1 | Patch |

---

### 🧪 **Verification**

- ✅ `from matimo import Matimo` works
- ✅ `from matimo import convert_tools_to_langchain, convert_tools_to_crewai` works
- ✅ All policy, MCP, secrets, logging, approval exports accessible
- ✅ `Matimo.init(auto_discover=True)` — 119 tools loaded successfully
- ✅ No recursion errors

---

### ✅ **Additional Improvements**

- Typed wrapper signatures for `convert_tools_to_langchain`, `convert_tools_to_crewai`, `build_relevant_skill_prompt` (replacing `*args/**kwargs`)
- `__version__` derived from `importlib.metadata.version("matimo")` with `"0.1.1.post1"` fallback

---
## v0.1.2 — TypeScript ESM Hotfix 🔧

> **Release**: Critical fix for ES Module imports in published npm package

**Released**: May 7, 2026  
**Scope**: TypeScript SDK only — All 11 packages bumped to v0.1.2  
**Severity**: 🔴 **CRITICAL** — Breaks all public npm consumers

---

### 🐛 **Issue: ESM Module Resolution Failure**

**Problem:**  
Published npm package (`matimo@0.1.1`) failed on all public consumers with:
```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module 
  '/path/to/node_modules/@matimo/core/dist/core/schema'
```

**Root Cause:**  
TypeScript compilation **does not automatically add `.js` extensions** to ES Module imports. When compiled JavaScript runs in Node.js, ESM resolution is **strict** and requires explicit file extensions.

**Example:**
```typescript
// ❌ This source compiles to `dist/index.js` but breaks at runtime:
export { ToolLoader } from './core/tool-loader';  // Missing .js!

// ✅ Should compile to:
export { ToolLoader } from './core/tool-loader.js';  // Correct
```

**Impact:**
- All 137 tools unavailable
- LangChain integration broken
- MCP server failed to start
- CLI non-functional
- **v0.1.1 npm package unusable by public users**

---

### ✅ **Solution: Add Explicit `.js` Extensions**

**Files Fixed:**
- `typescript/packages/core/src/index.ts` — 35+ imports
- `typescript/packages/core/src/matimo-instance.ts` — 19+ imports
- **Total: 102+ imports corrected across 23 files**

**Before:**
```typescript
import { ToolLoader } from './core/tool-loader';
import { MatimoError } from './errors/matimo-error';
import { ApprovalHandler } from './approval/approval-handler';
```

**After:**
```typescript
import { ToolLoader } from './core/tool-loader.js';
import { MatimoError } from './errors/matimo-error.js';
import { ApprovalHandler } from './approval/approval-handler.js';
```

When TypeScript compiles these imports, the `.js` extensions are preserved in the output, allowing Node.js ESM resolution to work correctly.

---

### 📦 **Version Bumps**

| Package | Previous | New | Type |
|---------|----------|-----|------|
| matimo (root) | 0.1.1 | 0.1.2 | Patch |
| @matimo/core | 0.1.0 | 0.1.2 | Patch |
| @matimo/cli | 0.1.0 | 0.1.2 | Patch |
| @matimo/bruno | 0.1.0 | 0.1.2 | Patch |
| @matimo/github | 0.1.0 | 0.1.2 | Patch |
| @matimo/gmail | 0.1.0 | 0.1.2 | Patch |
| @matimo/hubspot | 0.1.0 | 0.1.2 | Patch |
| @matimo/mailchimp | 0.1.0 | 0.1.2 | Patch |
| @matimo/notion | 0.1.0 | 0.1.2 | Patch |
| @matimo/postgres | 0.1.0 | 0.1.2 | Patch |
| @matimo/slack | 0.1.0 | 0.1.2 | Patch |
| @matimo/twilio | 0.1.0 | 0.1.2 | Patch |

---

### 🧪 **Verification**

- ✅ Build succeeds for all packages
- ✅ 137 tools discovered correctly  
- ✅ All examples work (slack, github, postgres, bruno, web, read, search, etc.)
- ✅ Meta-tools functional (`matimo_list_tools`, `matimo_search_tools`, etc.)
- ✅ LangChain integration verified
- ✅ Approval workflows operational

---

### 📝 **Why This Happened**

**TypeScript Compilation Behavior:**
TypeScript's `tsc` compiler is **format-preserving** for import statements. When you write `import { X } from './x'`, the compiler outputs `import { X } from './x'` (no automatic `.js` addition). 

**CJS vs ESM:**
- **CommonJS** (`.js` with `require()`): Node resolves `./x` to `./x.js` automatically
- **ESM** (`.mjs` or `"type": "module"` in package.json): Node **requires explicit extensions** per ES spec

**Local Development vs npm:**
- Local examples using `tsx` or `ts-node` have TypeScript semantic understanding — they resolve `./x` to `./x.ts` automatically
- Published npm consumers get **pre-compiled JavaScript only** — `tsc` output with no semantic help

**Best Practice Going Forward:**
Always add `.js` extensions explicitly in TypeScript when targeting ESM + npm distribution.

---

### 🔄 **Next Steps for Users**

**Immediate:**
```bash
npm install matimo@0.1.2  # New hotfix version
# or
npm update matimo
```

**Local Development:**
Continue using local source — no changes needed. TypeScript compilation still works correctly.

**Migration:**
No code changes required — the fix is transparent. All APIs remain identical.

---

## v0.1.0 — First Stable Release 🎉

> **Release**: Production-Ready AI Tools SDK — Full-Stack TypeScript & Python with 137+ Tools, LangChain/CrewAI/MCP Support

**Released**: May 1, 2026  

---

### 🎊 **Matimo v0.1.0 Stable — General Availability**

After 14 alpha releases and extensive production testing, Matimo is now **production-ready**. This release represents the culmination of months of development, featuring a complete dual-SDK architecture, enterprise-grade security, and a rich ecosystem of 137+ production-tested tools.

---

## 📦 **What's New in v0.1.0**

### 🧪 **Bruno CLI Provider** (NEW)

Complete API testing lifecycle support via [Bruno](https://www.usebruno.com/) integration:

**7 New Tools:**

| Tool | Purpose |
|------|---------|
| `bruno_create_collection` | Create new Bruno API collection |
| `bruno_add_request` | Add HTTP request to collection (GET/POST/PUT/DELETE/PATCH) |
| `bruno_get_collection_info` | Inspect collection structure and requests |
| `bruno_list_collections` | Discover all Bruno collections in workspace |
| `bruno_run_collection` | Execute entire collection with JSON reporter |
| `bruno_run_request` | Run single named request from collection |
| `bruno_import_openapi` | Bootstrap collection from OpenAPI 3.0 spec |

**Requirements**: Bruno CLI (`npm install -g @usebruno/cli`)  
**Examples**: `pnpm bruno:complete` (TS), `uv run python bruno/complete_workflow.py` (Python)

### 🔧 **Meta-Tools Enhancement**

**2 New Meta-Tools** for runtime tool discovery:

- `matimo_get_tool` — Retrieve full definition of any loaded tool (YAML + metadata)
- `matimo_search_tools` — Search tools by name/description (supports fuzzy matching)

These join the existing 8 meta-tools (`matimo_create_tool`, `matimo_validate_tool`, `matimo_approve_tool`, `matimo_reload_tools`, `matimo_list_user_tools`, `matimo_get_tool_status`, `matimo_create_skill`, `matimo_validate_skill`, `matimo_get_skill`, `matimo_list_skills`) for complete self-maintenance capability.

### ⏱️ **HITL (Human-in-the-Loop) Enhancements**

**New Features:**
- `hitlTimeoutMs` / `hitl_timeout_ms` — Configurable timeout for approval requests (default: 5 minutes)
- `approval_ttl_seconds` — Policy-level TTL for cached approvals (prevents stale approvals)

**Example:**
```typescript
const matimo = await MatimoInstance.init('./tools', {
  hitlTimeoutMs: 120000, // 2 minutes
  onHitl: async (request) => {
    // Custom approval UI
    return { approved: true, reason: 'User reviewed' };
  }
});
```

### 🧹 **Quality & Stability**

- ✅ **2996 total tests** (2001 TypeScript + 995 Python) — all passing
- ✅ **95%+ test coverage** across both SDKs
- ✅ **Zero test pollution** — Fixed pytest-asyncio marker issues
- ✅ **Production security hardening** — 5 critical patches applied
- ✅ **MCP standards compliance** — Full MCP 1.0 spec support

---

## 🚀 **Complete Feature Set** (v0.1.0 Stable)

### **Core SDK** (TypeScript + Python)

- ✅ **137+ production tools** across 10 provider packages
- ✅ **4 SDK patterns**: Factory, Decorator, LangChain, CrewAI
- ✅ **3 execution types**: HTTP, Command, Function
- ✅ **10 meta-tools** for runtime tool management
- ✅ **Skills system** with TF-IDF semantic search
- ✅ **Policy engine** with risk classification + HITL workflows
- ✅ **MCP Server** (stdio + HTTP) — Claude Desktop compatible
- ✅ **OAuth2 support** with multi-provider setup
- ✅ **Secret management** — Env, Dotenv, Vault, AWS Secrets Manager

### **10 Provider Packages**

| Provider | Tools | Highlights |
|----------|-------|------------|
| **@matimo/slack** / **matimo-slack** | 16+ | Messaging, channels, users, reactions |
| **@matimo/github** / **matimo-github** | 10+ | Issues, repos, users, releases |
| **@matimo/gmail** / **matimo-gmail** | 5+ | Send, read, search emails |
| **@matimo/notion** / **matimo-notion** | 7+ | Databases, pages, blocks |
| **@matimo/hubspot** / **matimo-hubspot** | 50+ | CRM, contacts, email campaigns |
| **@matimo/mailchimp** / **matimo-mailchimp** | 8+ | Lists, campaigns, members |
| **@matimo/postgres** / **matimo-postgres** | 6+ | Query, schema, transactions |
| **@matimo/twilio** / **matimo-twilio** | 4+ | SMS, calls, messaging |
| **@matimo/bruno** / **matimo-bruno** | 7 | API testing lifecycle (NEW) |
| **@matimo/core** / **matimo-core** | 10+ | Meta-tools, execute, edit, search |

### **Framework Integrations**

- **LangChain** (TypeScript + Python) — `convertToolsToLangChain()`
- **CrewAI** (Python only) — `convert_tools_to_crewai()`
- **MCP** (TypeScript + Python) — `MCPServer` / `create_mcp_server()`

### **Documentation & Examples**

- ✅ **40+ production examples** across both SDKs
- ✅ **Complete API documentation** at [matimo.dev/docs](https://matimo.dev/docs)
- ✅ **MCP setup guides** for Claude Desktop, Cline, Continue
- ✅ **Framework integration guides** for LangChain, CrewAI
- ✅ **Bruno integration guide** with 6 workflow scenarios

---

## 📊 **By the Numbers** (v0.1.0)

| Metric | Value |
|--------|-------|
| **Total Tools** | 137+ |
| **Provider Packages** | 10 |
| **Meta-Tools** | 10 |
| **Skills** | 14 built-in |
| **Test Suites** | 98 (TypeScript) + 102 (Python) |
| **Total Tests** | 2996 |
| **Test Coverage** | 95%+ (both SDKs) |
| **Production Examples** | 40+ |
| **Supported Patterns** | 4 (Factory, Decorator, LangChain, CrewAI) |
| **Supported Languages** | 2 (TypeScript, Python) |
| **Python Versions** | 3.11, 3.12 |
| **Node Versions** | 18+, 20+, 22+ |

---

## 🔐 **Security Hardening**

All critical security patches applied:

1. ✅ **MCP Environment Isolation** — No `process.env` seeding in MCP server
2. ✅ **Command Injection Prevention** — Template placeholder validation
3. ✅ **Production Approval Secret** — `MATIMO_PRODUCTION_APPROVAL_SECRET` enforcement
4. ✅ **Embedded Code Sandboxing** — Function executor hardening
5. ✅ **Template Dollar Sign Fix** — Prevent `$&`, `$'`, `$`` special sequence injection

---

## 📦 **Installation**

### TypeScript
```bash
npm install @matimo/core @matimo/slack @matimo/github @matimo/bruno
# or
pnpm add @matimo/core @matimo/slack
```

### Python
```bash
pip install matimo-core[slack,github,bruno]
# or  
uv add matimo-core --extras slack --extras bruno
```

---

## 🎯 **Migration from Alpha**

### From v0.1.0-alpha.14 → v0.1.0

**Breaking Changes:** None (100% backward compatible)  
**Deprecations:** None  
**New Features:** Bruno CLI, 2 meta-tools, HITL timeout/TTL

Simply update your `package.json` / `pyproject.toml`:
```diff
- "version": "0.1.0-alpha.14"
+ "version": "0.1.0"
```

All existing code, tool definitions, and configurations work as-is.

---

## 🙏 **Acknowledgments**

Special thanks to all contributors and alpha testers who helped make Matimo production-ready. This release represents the work of many hands and countless hours of testing, refinement, and community feedback.

---

## v0.1.0-alpha.14-patch.1 — Bruno CLI Integration

> **Release**: Bruno CLI provider package — first-class API testing lifecycle support for TypeScript and Python SDKs

**Released**: April 25, 2026

---

## v0.1.0-alpha.14

> **Release**: Python SDK Official Launch — Full-featured Python support for LangChain, CrewAI, and MCP with comprehensive examples, 657+ tests, 97.38% coverage, and enterprise-grade security hardening

**Released**: April 10, 2026  

---

## 🐍 Python SDK — Official Launch

### Core Features

**Python SDK Release** (`matimo-core 0.1.0a14`)

This is the official Python SDK, feature-parity with the TypeScript SDK plus Python-specific optimizations:

- ✅ **Full SDK Implementation** — All core SDK features in Python (asyncio-based, Pydantic v2)
- ✅ **Python 3.11 & 3.12** — Type-safe, fully tested across versions
- ✅ **657 Tests** — 97.38% coverage; exceeds 95% requirement
- ✅ **Async/await native** — Full async support via `asyncio`
- ✅ **Type hints throughout** — Complete type annotations for IDE support

### SDK Patterns (Identical to TypeScript)

```python
# Factory Pattern (simplest)
from matimo import Matimo

matimo = await Matimo.init('./tools')
result = await matimo.execute('slack_send_message', {'channel': '#general', 'text': 'Hello'})
tools = matimo.list_tools()
```

```python
# Decorator Pattern (class-based)
from matimo import tool, set_global_matimo_instance

set_global_matimo_instance(matimo)

class MyAgent:
    @tool('slack_send_message')
    async def send(self, channel: str, text: str): ...  # auto-executed
```

```python
# LangChain Integration
from matimo import Matimo, convert_tools_to_langchain

matimo = await Matimo.init('./tools')
tools = convert_tools_to_langchain(matimo.list_tools(), matimo)
# Use with LangChain AgentExecutor, ReAct, etc.
```

```python
# CrewAI Integration
from matimo import Matimo, convert_tools_to_crewai

matimo = await Matimo.init('./tools')
tools = convert_tools_to_crewai(matimo.list_tools(), matimo)
# Use with CrewAI Agent, Crew, etc.
```

---

## 🚀 Provider Tools (Python)

All 10 providers ship with full Python support:

| Provider | Tools | Examples |
|----------|-------|----------|
| **Slack** | 16+ | `slack_send_message`, `slack_get_user`, `slack_list_channels`, etc. |
| **GitHub** | 10+ | `github_create_issue`, `github_list_repos`, `github_get_user`, etc. |
| **Gmail** | 5+ | `gmail_send_message`, `gmail_get_messages`, etc. |
| **Notion** | 7+ | `notion_create_database`, `notion_query_database`, etc. |
| **HubSpot** | 50+ | `hubspot_create_contact`, `hubspot_send_email`, etc. |
| **Mailchimp** | 8+ | `mailchimp_add_member`, `mailchimp_get_list`, etc. |
| **Postgres** | 6+ | `postgres_execute_query`, `postgres_get_schema`, etc. |
| **Twilio** | 4+ | `twilio_send_sms`, `twilio_make_call`, etc. |

**Installation**: `pip install matimo-core[slack,github,gmail]` (selective providers)

---

## 🤖 Framework Integrations

### LangChain Integration (Python)

**Full Feature Support**:
- ✅ `convert_tools_to_langchain()` — Convert Matimo tools to `StructuredTool`
- ✅ Secret parameter masking — Credentials excluded from schemas
- ✅ Tool name sanitization — Hyphenated names handled safely
- ✅ AgentExecutor compatibility — Works with `ReActAgent`, `OpenAIFunctionsAgent`, etc.

**Example**:
```python
from langchain.agents import create_react_agent, AgentExecutor
from langchain_openai import ChatOpenAI
from matimo import Matimo, convert_tools_to_langchain

matimo = await Matimo.init('./tools')
tools = convert_tools_to_langchain(matimo.list_tools(), matimo)

llm = ChatOpenAI(model='gpt-4')
agent = create_react_agent(llm, tools)
executor = AgentExecutor.from_agent_and_tools(agent=agent, tools=tools, verbose=True)

result = await executor.ainvoke({'input': 'Send a Slack message to #general saying hello'})
```

### CrewAI Integration (Python)

**Full Feature Support**:
- ✅ `convert_tools_to_crewai()` — Convert Matimo tools to `BaseTool`
- ✅ Secret parameter masking — Credentials excluded from schemas  
- ✅ Tool name sanitization — Hyphenated names handled safely
- ✅ Async/sync execution — Shared thread executor for event loop handling
- ✅ Crew compatibility — Works with `Agent`, `Task`, `Crew`

**Example**:
```python
from crewai import Agent, Task, Crew
from langchain_openai import ChatOpenAI
from matimo import Matimo, convert_tools_to_crewai

matimo = await Matimo.init('./tools')
tools = convert_tools_to_crewai(matimo.list_tools(), matimo)

llm = ChatOpenAI(model='gpt-4')
agent = Agent(role='Slack Manager', goal='Send messages', tools=tools, llm=llm)
task = Task(description='Send hello to #general', agent=agent)
crew = Crew(agents=[agent], tasks=[task])

result = crew.kickoff()
```

### MCP Server (Python)

**Built-in Support**:
- ✅ `create_mcp_server()` — Serve Matimo tools over MCP protocol
- ✅ Dual transport — stdio + HTTP
- ✅ Claude Desktop compatible — Register and use tools in Claude
- ✅ Settings support — Per-tool configuration overrides

**Example**:
```python
from matimo import Matimo, create_mcp_server, MCPServerOptions

matimo = await Matimo.init('./tools')
server = await create_mcp_server(
    matimo,
    MCPServerOptions(name='my-agent', version='1.0.0')
)
await server.start()
```

---

## 📚 Python Examples (Production Patterns)

### Native — Advanced Agent Demos (fully tested, exit 0)

These walkthroughs use real LangChain ReAct loops and verify each step programmatically. No mocks.

| File | Missions | What it demonstrates |
|------|----------|---------------------|
| **`native/policy/policy_demo.py`** | 11 | Full policy lifecycle: risk classification, draft/deprecated/blocked tools, content validation, HITL approval, hot-reload atomicity, approval state tracking |
| **`native/skills/skills_demo.py`** | 6 + Phase 4 | Create/list/read/validate SKILL.md files via agent; `get_skills_metadata()` (L1), `semantic_search_skills()` (TF-IDF), `build_relevant_skill_prompt()` (L2) |
| **`native/meta_flow/meta_tools_integration.py`** | 5 | Full meta-tool lifecycle: `matimo_create_tool` → `matimo_validate_tool` → `matimo_approve_tool` → `matimo_reload_tools` → execute; policy-blocked tools (shell/file-reader) |
| **`native/logger_example.py`** | 6 sections | `setup_logger()`, JSON vs simple format, global singleton, SDK internal logger, level filtering, silent mode — **no API key needed** |

Run them via:
```bash
cd python/
make policy-demo     # OPENAI_API_KEY required
make skills-demo     # OPENAI_API_KEY required
make meta-flow       # OPENAI_API_KEY required
make logger-example  # no key needed
```

### Native — Factory & Decorator (no LLM required)
- **Provider factory/decorator examples** — `slack/`, `github/`, `gmail/`, `notion/`, `hubspot/`, `mailchimp/`, `postgres/`, `twilio/`
- **Generic pattern agents** — `agents/factory_pattern_agent.py`, `agents/decorator_pattern_agent.py`
- **Core tool examples** — `execute/`, `read/`, `edit/`, `search/`, `web/`, `credentials/`

### LangChain Integration (17 files)
- **`langchain/agents/langchain_agent.py`** — Generic multi-provider ReAct agent
- **`langchain/agents/langchain_skills_policy_agent.py`** — Production-pattern agent: Level 1+2 skills injection + policy-aware tool creation in one ReAct loop
- **Provider agents** — Slack, GitHub (`github_with_approval.py`), Gmail, Notion, HubSpot, Mailchimp, Postgres (`postgres_with_approval.py`), Twilio
- **Core tool agents** — `read/`, `search/`, `execute/`, `edit/`, `web/`

### CrewAI Integration (10 files)
- **`crewai/agents/crewai_agent.py`** — Single CrewAI agent with Matimo tools
- **`crewai/agents/multi_agent_crew.py`** — Multi-agent crew orchestration
- **Provider crews** — Slack, GitHub, Gmail, Notion, HubSpot, Mailchimp, Postgres, Twilio

**Total Python examples: 58 files** across 3 patterns and 8+ providers. All lint-clean (ruff), all end-to-end tested.

---

## 🔒 Security Hardening (6 Critical Patches)

### Patch A: MCP Server Secret Isolation
- **Impact**: Secrets no longer exposed to `process.env`; kept in memory only
- **Changed**: Both TypeScript and Python implementations hardened
- **Result**: No sibling module access to credentials

### Patch B: Command Injection Prevention
- **Impact**: Command tools with `{placeholders}` rejected at validation time
- **Changed**: Both TypeScript + Python: `CommandExecutor` validates before execution
- **Blocked**: Untrusted parameter injection into shell commands

### Patch C: Production Fail-Fast for Missing Approvals
- **Impact**: In production, missing approval secrets cause immediate failure
- **Changed**: `ApprovalManifest` checks `NODE_ENV` / `MATIMO_ENV`
- **Prevents**: Silent deployments with broken approval setup

### Patch D: Embedded Code Sandboxing (Python)
- **Impact**: Directory traversal (`../`) blocked in `execution.code` paths
- **Changed**: `FunctionExecutor` validates file paths
- **Allows**: Absolute paths (admin intent); blocks relative escapes

---

## 🔐 Integration Layer Hardening

### Case-Insensitive Secret Detection
- ✅ **Fixed**: Regex now catches lowercase `token`, `api_key`, `secret`
- ✅ **Testing**: 19 new test cases cover all variations
- ⚠️ **Impact**: More secrets properly masked in LangChain/CrewAI schemas

### Tool Name Sanitization for Pydantic
- ✅ **Fixed**: `github-create-issue` → `github_create_issue_args`
- ✅ **Testing**: LangChain + CrewAI integration tests pass
- ⚠️ **Impact**: No more invalid Pydantic model names

### Comprehensive Auth Injection Testing
- ✅ **19 new test cases**: Placeholder extraction, injection precedence, non-auth handling
- ✅ **Coverage**: HTTP + command tools, edge cases, list-valued parameters
- ⚠️ **Impact**: Developers can trust auth behavior across all executor types

---

## 🚀 Performance Optimizations

### CrewAI ThreadPoolExecutor Reuse
- ✅ **Changed**: Shared module-level executor instead of per-call creation
- ✅ **Impact**: Significant overhead reduction in high-frequency tool calls
- ⚠️ **For**: Jupyter notebooks, async contexts with already-running event loops

---

## 🔧 Build Quality & CI/CD

### PEP 440 Version Compliance
- ✅ **Format**: `0.1.0a14` (was `0.1.0-alpha.14`)
- ⚠️ **Impact**: Proper PyPI pre-release ordering
- ✅ **Verified**: `uv build` produces `matimo_core-0.1.0a14.tar.gz`

### Python Version Alignment
- ✅ **Requirement**: All packages now require `>=3.11`
- ⚠️ **Impact**: Users on Python 3.10 must upgrade
- ✅ **Benefit**: Consistent requirement across SDK

### GitHub Actions Workflow Fixes
- ✅ **Fixed**: `uv tool run pytest` → `uv run pytest` (correct dependency resolution)
- ✅ **Fixed**: `uv tool run mypy` uses synced workspace context
- ⚠️ **Impact**: Python tests now run reliably in CI

---

## 🧪 Test Coverage & Quality Metrics

**Python Core** (`657 tests`):
- Unit tests: `test_instance.py`, `test_loader.py`, `test_registry.py`, `test_models.py`
- Integration tests: `test_http_executor.py`, `test_command_executor.py`, `test_function_executor.py`
- Framework tests: `test_langchain.py` (9 tests), `test_crewai.py` (13 tests)
- Policy tests: `test_policy.py`, `test_approval.py`, `test_integrity_tracker.py`
- Auth tests: `test_auth_injection.py` (19 tests, comprehensive)
- Encoding tests: `test_encodings.py`
- **Coverage**: 97.38% (exceeds 95% requirement)

**TypeScript Core** (`1,884 tests`):
- Maintained parity with Python
- All security patches verified with existing test suite
- **Coverage**: Consistent 95%+ across all modules

**Total**: **2,541 tests passing** (TypeScript 1,884 + Python 657)

---

## 📖 Python Documentation

**New Python-Specific Docs**:
- ✅ `docs/framework-integrations/PYTHON_SDK.md` — Python SDK getting started
- ✅ `docs/framework-integrations/LANGCHAIN.md` — Updated with Python examples
- ✅ `docs/framework-integrations/CREWAI.md` — CrewAI integration guide
- ✅ `docs/api-reference/AUTH_INJECTION.md` — Auth parameter handling (Python focus)
- ✅ `docs/troubleshooting/PYTHON_COMMON_ISSUES.md` — FAQ for Python users

---

## ⚠️ Breaking Changes & Migration Guide

| Aspect | Old Behavior | New Behavior | Action |
|--------|--------------|--------------|--------|
| **Python support** | Not available | Official Python 3.11+ | Update to Python 3.11+ |
| **CrewAI version** | Manual tool wiring | `convert_tools_to_crewai()` | Use conversion function |
| **LangChain Python** | Not available | Full support (langchain-core) | Use conversion function |
| **Secret detection** | Case-sensitive | Case-insensitive | No action (more secure) |
| **Command injection** | Allowed edge cases | Rejected at validation | Review command definitions |
| **Production approval** | Silent fallback | Fail-fast | Set `APPROVAL_SECRET` in prod |
| **PEP 440 version** | `0.1.0-alpha.14` | `0.1.0a14` | Automatic in PyPI |

---

## 🎯 Cautions & Disclaimers

### For AI Agents
- ⚠️ **Secret masking**: Credentials are now excluded from LangChain/CrewAI schema generation; agents cannot see or leak credentials in tool definitions
- ⚠️ **Command validation**: Strict validation may reject some edge cases; file an issue if blocking legitimate use
- ⚠️ **Placeholder precedence**: Auth parameters follow strict precedence (explicit > MATIMO_* > direct env); no fallback to random env vars

### For Developers
- ⚠️ **Python 3.10 EOL**: Minimum version is now 3.11; update your environment
- ⚠️ **Event loop context**: In async contexts (Jupyter), CrewAI uses a shared executor; single-threaded (suitable for most use cases; scale horizontally if needed)
- ⚠️ **Embedded code opt-in**: Function tools require `MATIMO_ALLOW_EMBEDDED_CODE=true` environment variable
- ⚠️ **Tool name sanitization**: Verify hyphenated tool names work in your schema after upgrade (they should work transparently)

### For Production
- ⚠️ **Approval secret**: Must be set before deploying tools with approval-required policies
- ⚠️ **Upgrade testing**: Run full integration test suite before deploying to production
- ⚠️ **Dependency verification**: PyPI pre-release ordering now correct; old installations may require `pip install --upgrade matimo-core==0.1.0a14`

---

## 🚀 Upgrade Instructions

### From alpha.13 (TypeScript users)
No breaking changes to TypeScript SDK; all security patches are backward-compatible.

### For New Python Users
```bash
# Install core + specific providers
pip install matimo matimo-slack matimo-github

# With LangChain
pip install "matimo[langchain]" matimo-slack

# With CrewAI
pip install "matimo[crewai]" matimo-slack

# With everything
pip install "matimo[langchain,crewai]"
```

### Verify Installation
```python
import matimo
print(f"Matimo version: {matimo.__version__}")  # Should be 0.1.1.post1

# Quick test
from matimo import Matimo
matimo = await Matimo.init('./tools')
tools = matimo.list_tools()
print(f"Loaded {len(tools)} tools")
```

---

## 📊 Release Statistics

| Metric | Value |
|--------|-------|
| **Total Tests** | 2,541 (1,884 TS + 657 Python) |
| **Coverage** | 97.38% Python (exceeds 95% requirement) |
| **Security Patches** | 6 (3 critical + 1 CodeQL + 2 optimization) |
| **Python Modules** | 11 (core, 10 providers) |
| **Python Examples** | 58 files (native, LangChain, CrewAI patterns) |
| **TypeScript Examples** | 20+ (tools/, agents/, policy/, skills/) |
| **Provider Tools** | 110+ across 8 providers (both SDKs) |
| **Supported Python** | 3.11, 3.12 |
| **Framework Support** | LangChain, CrewAI, MCP (native), Decorator, Factory |
| **Advanced Demos** | 4 (policy, skills, meta-tools, logger — fully tested) |

---

## v0.1.0-alpha.13

---

## v0.1.0-alpha.13

> Release: Skills System, Policy Engine, Meta-Tools Hardening — Complete agent autonomy layer with skill discovery, policy-driven tool creation, HITL quarantine, hot-reload safety, and security hardening

**Released**: March 22, 2026

### 🚀 Major Features

**Skills System — First-Class Integration** (`@matimo/core`)

- **Agent Skills Catalog** — 6 built-in SKILL.md files shipped with `@matimo/core` for agent self-education
  - `tool-creation` — `matimo_create_tool`, `matimo_validate_tool`, `matimo_approve_tool` workflow
  - `meta-tools-lifecycle` — Full lifecycle management (create, validate, approve, reload, list)
  - `policy-validation` — Risk classification, approval tiers, policy configuration
  - `tool-discovery` — Finding and learning about existing tools
  - `skill-creator` — How to create new SKILL.md files for use in agents
  - `skills-catalog` — How to use and leverage the skills ecosystem
- **`semanticSearchSkills(query)`** — TF-IDF (Term Frequency - Inverse Document Frequency embedding)-based semantic search across all SKILL.md files; ranked results with relevance scores
  - [TF-IDF implementation details](./skills/TFIDF_SEMANTIC_SEARCH.md)
- **`getSkillSections(skillName)`** — Returns section inventory with token estimates for progressive disclosure
- **`getSkillContent(skillName, options?)`** — Load full or selective sections of a skill (token-efficient context loading)
- **`getSkillsMetadata(matimo)`** — Non-MCP LangChain helper: returns `Array<{ name, description }>` only (Level 1, no file I/O, always token-safe)
- **`buildRelevantSkillPrompt(matimo, query, options?)`** — Non-MCP LangChain helper: runs TF-IDF cosine similarity ranking and loads only the top-K relevant skills above a minimum score into a ready-to-inject system prompt block (Level 2, lazy). Both helpers exported from `matimo` — see [LangChain integration guide](./framework-integrations/LANGCHAIN.md#skills-integration-non-mcp)
- **Agent meta-tools** — 10 meta-tools callable by LangChain agents and MCP clients:
  - **Skill meta-tools**: `matimo_list_skills`, `matimo_get_skill`, `matimo_create_skill`, `matimo_validate_skill`
  - **Tool lifecycle meta-tools**: `matimo_create_tool`, `matimo_validate_tool`, `matimo_approve_tool`, `matimo_reload_tools`, `matimo_list_user_tools`, `matimo_get_tool_status`
  - See [META_TOOLS.md](./api-reference/META_TOOLS.md) for full reference
- **Provider skill bundles** — Each provider package ships a consolidated `SKILL.md` documenting its complete tool ecosystem (Slack, GitHub, Gmail, HubSpot, Mailchimp, Notion, Postgres, Twilio)
- **MCP resource exposure** — Skills auto-registered as `skills://{name}` resources on the MCP server; Claude Desktop and Cursor can read them via the Resources protocol without tool calls; hot-reloads on `reloadTools()`

**Policy Engine** (`@matimo/core`)

> [Full Policy Documentation](./api-reference/POLICY_AND_LIFECYCLE.md)

- **Policy-as-YAML loader** — `loadPolicyFromFile(path)` + `policyFile` option in `MatimoInstance.init()`
- **Policy tier API** — `getTierForTool(tool, config): PolicyTier` returning `'auto' | 'approval-required' | 'blocked'`
- **Approval state tracking** — `approvalState: 'auto-approved' | 'pending' | 'approved' | 'rejected'` in `CreateResult`
- **Pending tools inventory** — `getPendingTools(): string[]` in approval manifest for agent status queries
- **Tool status meta-tool** — `matimo_get_tool_status` returns `{ name, status, riskLevel, approvalState, approvedAt?, approvedBy? }`
- **Human-readable validation** — `matimo_validate_tool` returns `SchemaError[]` with `validOptions?` per field (not raw Zod output)
- **Content validator** — `content-validator.ts` scans agent-written tool YAML for blocked patterns (SSRF, secrets in plain text, unsafe command templates) before the tool reaches the registry
- **Integrity tracker** — `integrity-tracker.ts` records a hash of each approved tool file; detects file tampering between restarts
- **Policy events** — `events.ts` emits typed lifecycle events (`tool:created`, `tool:approved`, `tool:rejected`, `tool:quarantined`) for external monitoring hooks
- **HITL quarantine** — Tools that fail content validation during a policy-restricted session are written to a quarantine directory rather than discarded; human reviewer can inspect, amend, and re-submit via `matimo review`

**Hot-Reload Atomicity & Safety** (`@matimo/core`)

- **Atomic reload** — `reloadTools()` snapshots registry, restores on mid-load error
- **Rollback signal** — `ReloadResult { success, reloadedCount, rolledBack }` tells agents whether state was preserved
- **MCP auto-trigger** — MCP server emits `tools/list_changed` + `resources/list_changed` notifications on successful reload

**Security Hardening** (`@matimo/core`)

- **20 security vulnerabilities resolved** via pnpm overrides and direct fixes:
  - **ReDoS prevention** — `HEADING_REGEX` hardened against catastrophic backtracking in skill section parsing
  - **Sensitive data logging** — Secrets never logged or exposed in error messages or stack traces
  - **Dependency audit** — Comprehensive override strategy for transitive vulnerabilities
- **Regex safety** — All regex patterns reviewed and hardened
- **Logging guardrails** — Credentials and sensitive parameters redacted from all logs

**CLI Enhancements** (`@matimo/cli`)

- **`matimo doctor`** — Diagnoses environment in one command:
  - Node.js ≥18 check
  - `@matimo/*` package scan
  - Environment variable audit per tool
  - YAML validation with field-level messages
- **`matimo review`** — Bridge for approval workflows:
  - `matimo review list` — Show pending and quarantined tools awaiting approval
  - `matimo review approve <tool-name>` — Approve a pending tool (updates approval manifest + tool status)
  - `matimo review reject <tool-name>` — Reject a pending tool

### 📚 Examples & Documentation

**New Examples**

- **`examples/tools/policy/policy-demo.ts`** — LangChain agent demonstrating the full policy-aware tool creation workflow (create → validate → quarantine → review → approve → execute)
- **`examples/tools/skills/skills-demo.ts`** — Multi-phase demo: agent skill missions (create, list, read, validate), Phase 4 direct TF-IDF ranking via `semanticSearchSkills()` with per-skill scores, and non-MCP progressive disclosure via `getSkillsMetadata()` + `buildRelevantSkillPrompt()`
- **`examples/tools/meta-flow/meta-tools-integration.ts`** — Full lifecycle: create tool, validate, approve, reload, list via meta-tools; includes policy agent and skills agent in one flow
- **`examples/tools/agents/langchain-skills-policy-agent.ts`** — Production-pattern LangChain agent combining skills discovery (Level 1 + Level 2) with policy-aware tool creation in a single mission-based ReAct loop
- **`examples/tools/validate-implementation.ts`** — SDK validation script that verifies all meta-tools, skill operations, and policy flows are wired correctly end-to-end

**New Documentation**

- **`docs/api-reference/META_TOOLS.md`** — Complete reference for all 10 meta-tools (parameters, return shapes, examples, approval requirements)
- **`docs/api-reference/POLICY_AND_LIFECYCLE.md`** — Policy engine deep-dive: tier system, YAML config, HITL quarantine flow, approval manifest schema, integrity tracker
- **`docs/skills/TFIDF_SEMANTIC_SEARCH.md`** — TF-IDF implementation details: tokenization, IDF computation, cosine similarity, embedding cache, custom provider interface
- **`docs/skills/SKILLS.md`** — Complete Skills System guide: SKILL.md format, progressive disclosure levels, MCP resource exposure, LangChain non-MCP helpers, semantic search API
- **`docs/framework-integrations/LANGCHAIN.md`** — Added Skills Integration (Non-MCP) section: `getSkillsMetadata` + `buildRelevantSkillPrompt` API reference with full options and code patterns
- **`docs/ROADMAP.md`** — Updated with alpha.14 focus (agent-callable TF-IDF, `matimo_search_skills`, dynamic tool filtering)
- **`docs/tool-development/TOOL_SPECIFICATION.md`** — `execution.type: function` fully documented with trust model

### 🧪 Test Coverage

42 new test files added across unit, integration, and CLI suites:

- **Meta-tools**: Unit tests for all 10 meta-tools (`matimo_create_tool`, `matimo_validate_tool`, `matimo_approve_tool`, `matimo_reload_tools`, `matimo_list_user_tools`, `matimo_get_tool_status`, `matimo_create_skill`, `matimo_get_skill`, `matimo_list_skills`, `matimo_validate_skill`)
- **Policy engine**: Unit tests for `approval-manifest`, `content-validator`, `default-policy`, `hitl-quarantine`, `integrity-tracker`, `risk-classifier`, policy loader and parser
- **Skills system**: TF-IDF embedding, section parser, skill-loader, skill-registry (core + semantic), `langchain-integration` helpers (`getSkillsMetadata`, `buildRelevantSkillPrompt`)
- **Integration**: Hot-reload atomicity, HITL quarantine paths, `matimo-instance-hitl-paths`, policy integration end-to-end
- **CLI**: `doctor` command, `review approve/reject/list` commands
- **Full suite: 1,884 tests passing** across 96 test suites

### 📦 Packages

All packages bumped to v0.1.0-alpha.13:

- `@matimo/core` — Skills, policy engine, 10 meta-tools, HITL quarantine, security fixes, LangChain helpers
- `@matimo/cli` — `doctor` command, `review` command, enhanced help
- `@matimo/slack`, `@matimo/github`, `@matimo/gmail`, `@matimo/hubspot`, `@matimo/mailchimp`, `@matimo/notion`, `@matimo/postgres`, `@matimo/twilio` — Version sync, provider SKILL.md bundles in each

### ⚠️ Breaking Changes

None. All new features are additive or opt-in.

### 🔗 Related

- **Previous**: [v0.1.0-alpha.12.1](#v0101-alpha121)
- **Next**: [v0.1.0-alpha.14](./ROADMAP.md#v0101-alpha14--next-release)

---

## v0.1.0-alpha.12.1

> Release: Per-Execution Credential Override — Multi-tenant credential injection, `getRequiredCredentials()` DX helper, package-level release workflow (Changesets), improved test coverage

**Released**: March 12, 2026

### 🚀 Features

**Per-Execution Credential Override** (`@matimo/core`)

- **`ExecuteOptions.credentials`** — Pass `Record<string, string>` per `execute()` call; credentials are scoped to that execution and never written to `process.env`
- **Priority lookup chain**: `credentials[key]` → `credentials[MATIMO_key]` → `process.env[MATIMO_key]` → `process.env[key]`
- **All executor types updated**: `HttpExecutor`, `CommandExecutor`, `FunctionExecutor` all accept and forward per-call credentials
- **Fully backward compatible**: existing code without `options` is unaffected

**`getRequiredCredentials(toolName)` DX Helper** (`@matimo/core`)

- Returns the exact credential key names a tool expects (`string[]`)
- Scans `{PLACEHOLDER}` patterns in headers, URL, body, and `query_params` for auth-pattern names
- Also includes `username_env` / `password_env` from `authentication.type: basic` config
- Throws `MatimoError(TOOL_NOT_FOUND)` for unknown tool names
- Enables multi-tenant credential manifest pattern:
  ```typescript
  const keys = matimo.getRequiredCredentials('slack-send-message');
  // → ['SLACK_BOT_TOKEN']
  const credentials = Object.fromEntries(keys.map(k => [k, tenant.secrets[k]]));
  await matimo.execute('slack-send-message', params, { credentials });
  ```

**New Example: Multi-Tenant Credentials** (`examples/tools/credentials/`)

- Runnable demo showing per-tenant credential isolation with `Promise.all` parallel execution
- Verifies `process.env` immutability and env-var fallback behaviour
- Credential key reference table for all Slack tools
- Script: `pnpm credentials:example`


### 🧪 Test Coverage

- **26 new tests** in `credentials-override.test.ts` covering all executors, credential priority, `getRequiredCredentials()`, and `process.env` immutability
- **8 new branch-coverage tests** in `matimo-instance.test.ts` targeting previously uncovered paths:
  - `params.command` scan for command-type tools
  - `params.sql` destructive-keyword scan
  - `MATIMO_APPROVAL_SCAN_ALL_PARAMS=true` path
  - Approval callback invocation
  - Basic-auth `username_env`/`password_env` in `getRequiredCredentials()`
  - `scanObjectForParams` non-object early return & circular reference guard
  - `getExecutor` unsupported-type throw
- `matimo-instance.ts` statements and lines: **100%** (up from 88.81% / 89.74%)
- Full suite: **1298+ tests passing**

### 📦 Packages

All packages bumped to v0.1.0-alpha.12.1:

- `@matimo/core` — `ExecuteOptions`, `getRequiredCredentials()`, new tests
- `@matimo/cli` — Version sync
- `@matimo/slack`, `@matimo/github`, `@matimo/gmail`, `@matimo/hubspot`, `@matimo/mailchimp`, `@matimo/notion`, `@matimo/postgres`, `@matimo/twilio` — Version sync

### ⚠️ Breaking Changes

None. The `options` parameter on `execute()` is optional; all existing call sites continue to work unchanged.

---

## v0.1.0-alpha.12

> Release: First-Class MCP Support — Standalone server, pluggable secrets, Claude Desktop integration, comprehensive examples

**Released**: March 11, 2026

### 🚀 Major Features: MCP is Here

**MCP Server Implementation** (`@matimo/core/mcp`)

- **Dual-transport support**:
  - **Stdio transport** — Lightweight, no networking, perfect for Claude Desktop and local agents
  - **Streamable HTTP transport** — Remote deployment ready, bearer token auth, reconnect logic
- **Tool discovery & execution** — MCP protocol compliant; Claude instantly sees all loaded tools
- **Session management** — Handles MCP client lifecycle, graceful shutdown with active connection draining
- **Zero configuration** — Works with default YAML tool definitions; no MCP-specific schema needed

**Pluggable Secret Resolution** (`SecretResolverChain`)

- **Multiple backends supported**:
  - `env` — Load from environment variables (fastest, default)
  - `dotenv` — Load from `.env` file (development friendly)
  - `vault` — HashiCorp Vault integration (enterprise secrets)
  - `aws` — AWS Secrets Manager integration (cloud-native)
- **Automatic injection** — Tool parameters matching auth patterns (token, key, secret, etc.) auto-resolved server-side
- **Chain resolution** — Try resolvers in order; fall back gracefully if missing

**CLI Commands: MCP First Class**

- **`matimo mcp`** — Start MCP server
  - `--transport stdio` — Default, no networking
  - `--transport http --port 3000` — Remote, auth-ready
  - `--tools slack,gmail` — Tool allowlist/denylist
  - `--secrets env,dotenv,vault` — Enable secret backends
- **`matimo mcp setup`** — Generate Claude Desktop config
  - Auto-discovers Matimo bin path
  - Generates valid `claude_desktop_config.json`
  - Writes to `~/.config/Claude/claude_desktop_config.json` (macOS/Linux)

**New Examples: Complete MCP Integration**

- **`examples/mcp/`** — Full-featured MCP demo
  - `agent-stdio.ts` — Claude Desktop integration via stdio
  - `agent-http.ts` — LangChain agent via HTTP transport
  - `agent.ts` — Unified agent supporting both transports
  - `README.md` — Step-by-step setup with real Slack tools
  - `.env.example` — All environment variables documented
  - `package.json` scripts — `pnpm agent:stdio`, `pnpm agent:http`, `pnpm mcp:start:http`

### 📚 Documentation

- **`docs/MCP.md`** — Complete MCP architecture guide
  - Endpoints reference (GET /mcp for health, SSE for streams)
  - MCP spec compliance notes
  - TLS setup (mkcert recommended for local HTTPS)
  - Troubleshooting guide
- **`examples/mcp/README.md`** — Quick start (5 minutes to Langchain Agent with Slack integration via mcp)
  - Prerequisites (Node, npm, OpenAI key, Slack token)
  - Quick Start section with 2 patterns (stdio, HTTP)
  - Environment variable reference
  - Troubleshooting (connection, token, tools)

### 🔐 Security & Quality Improvements

**CodeQL Fixes**

- **Polynomial regex (ReDoS)** — Fixed `/\{([^}]+)\}/g` → `/\{(\w+)\}/g` in `tool-converter.ts`
- **TLS bypass removed** — Deleted `NODE_TLS_REJECT_UNAUTHORIZED = '0'` from examples; plain HTTP default for localhost
- **HTTP server shutdown** — Added `closeIdleConnections()` + `closeAllConnections()` to drain active SSE streams before closing

**CLI Robustness**

- **Flag validation** — All value-consuming flags now guard against missing args with clear error messages
- **Auto-execution detection** — Fixed to handle different `tsx` versions' argv-shifting behavior

**Schema Fixes**

- **Zod optional-before-default** — Fixed parameter-to-Zod conversion so defaults apply correctly to non-required params

### 📦 Packages

All packages bumped to v0.1.0-alpha.12:

- `@matimo/core` — New `mcp` exports; schema/security fixes
- `matimo-cli` — New `mcp` and `mcp setup` commands; updated help
- `matimo-mcp-examples` — New project with full MCP integration

### 🎯 Key Achievements

✅ Claude Desktop integration works out-of-the-box  
✅ HTTP transport for remote/docker/network use cases  
✅ Pluggable secrets (env, dotenv, vault, AWS)  
✅ Zero configuration needed beyond YAML tool definitions  
✅ Full test coverage for MCP flows  
✅ Production-ready examples for all patterns  
✅ Comprehensive troubleshooting documentation  
✅ Security fixes from CodeQL review

### ⚠️ Breaking Changes

None. MCP is additive; existing SDK patterns (Factory, Decorator, LangChain) unchanged.

### 📝 Migration & Quick Start

**Try MCP in 5 minutes:**

```bash
# 1. Start MCP server (stdio — Claude Desktop compatible)
npx matimo mcp

# 2. In another terminal, generate Claude Desktop config
npx matimo mcp setup

# 3. Restart Claude Desktop, tools appear in Tools panel
```

**For HTTP (remote/docker):**

```bash
# Server
MATIMO_MCP_TOKEN=secret npx matimo mcp --transport http --port 3000

# Client (LangChain agent example)
cd examples/mcp
pnpm install
MATIMO_MCP_TOKEN=secret pnpm agent:http
```

---

## v0.1.0-alpha.11

> Release: Twilio SMS/MMS provider, Mailchimp email marketing provider, native Basic Auth support, enhanced HTTP executor form-encoding, comprehensive test coverage, production-ready examples.

**Released**: February 27, 2026

### 🚀 Features

**New Providers** (11 New Tools)

- **Twilio Provider** (`packages/twilio`) — **4 SMS/MMS Tools**
  - `twilio-send-sms` — Send SMS to E.164 formatted phone numbers with message content and optional callbacks
  - `twilio-send-mms` — Send MMS with media URLs to recipients
  - `twilio-get-message` — Retrieve message status and details by SID
  - `twilio-list-messages` — List messages with filtering (to/from phone, date, pagination)
  - E.164 phone number format validation and handling
  - Trial account support (50 messages/day limit)
  - Full Twilio Programmable Messaging API integration

- **Mailchimp Provider** (`packages/mailchimp`) — **7 Email Marketing Tools**
  - `mailchimp-get-lists` — Retrieve email lists from account
  - `mailchimp-add-list-member` — Add subscribers to lists (with merge fields)
  - `mailchimp-update-list-member` — Update subscriber information (email, name, status)
  - `mailchimp-get-list-members` — Query list members with pagination
  - `mailchimp-remove-list-member` — Remove subscribers from lists
  - `mailchimp-create-campaign` — Create new email campaigns with templates
  - `mailchimp-send-campaign` — Send campaigns to lists with content
  - Full Mailchimp Marketing API integration with OAuth2
  - Campaign scheduling and performance tracking

**HTTP Executor Enhancements**

- **Native Basic Auth Support**
  - New `authentication.type: basic` with `username_env` and `password_env` fields
  - Automatic base64 encoding of `username:password` at request time
  - Works with Mailchimp, HubSpot, and any Basic Auth service
  - No pre-computation needed; credentials stored separate in env vars
  - Added to `AuthConfig` interface in `packages/core/src/core/types.ts`

- **Form-Encoded Request Bodies**
  - Automatic URLSearchParams conversion when `Content-Type: application/x-www-form-urlencoded`
  - Fixes axios default JSON serialization for form submissions
  - Validated with Twilio SMS/MMS live API testing
  - Intelligent null/undefined filtering in templated fields
  - Preserves JSON and custom formats for other Content-Types


**Documentation & Examples**

- **Provider READMEs**
  - `packages/twilio/README.md` 
  - `packages/mailchimp/README.md`

- **Integration Examples** (Factory, Decorator, LangChain patterns)
  - Twilio: `twilio-factory.ts`, `twilio-decorator.ts`, `twilio-langchain.ts` 
  - Mailchimp: `mailchimp-factory.ts`, `mailchimp-decorator.ts`, `mailchimp-langchain.ts` 
  - Real-world scenarios: Send SMS from agent, manage email subscribers, create campaigns
  - Full error handling and credential validation


### 🛠 Fixes & Improvements

- **HTTP Executor** (`packages/core/src/executors/http-executor.ts`)
  - Enhanced request body handling for form encoding 
  - Automatic URLSearchParams conversion for form-encoded bodies
  - Better parameter templating with string conversion for numbers/booleans
  - Improved null/undefined filtering to prevent orphaned keys in templated objects
  - Case-insensitive Content-Type detection

- **Mailchimp Documentation**
  - Updated API key logging for clarity (removed sensitive details)
  - Adjusted asset paths for logo handling
  - Corrected authentication method clarification

### 🔧 Technical Notes

- **Basic Auth Pattern**: Set two env vars per service
  - Example: `MATIMO_MAILCHIMP_USERNAME=api_key_start`, `MATIMO_MAILCHIMP_PASSWORD=api_key_end`
  - Executor base64-encodes at request time; credentials never exposed in logs

- **Form Encoding**: Automatically triggered when `Content-Type: application/x-www-form-urlencoded` detected
  - No YAML changes needed; existing tools work transparently
  - Objects in body converted to URLSearchParams by HTTP executor
  - Numbers and booleans automatically converted to strings for form submission

- **Twilio Setup**: Environment variables required
  - `TWILIO_ACCOUNT_SID` — Find in Twilio Console
  - `TWILIO_AUTH_TOKEN` — Find in Twilio Console
  - `TWILIO_FROM_NUMBER` — Phone number to send from (E.164 format: +1234567890)
  - `TWILIO_TO_NUMBER` — Optional; can also be passed as parameter

- **Mailchimp Setup**: OAuth2 or API key
  - API key: Set `MATIMO_MAILCHIMP_API_KEY` (Basic Auth with 'user' + key)
  - OAuth2: Supported; token refresh handled transparently

- **Trial Accounts**: Twilio trial accounts prepend "[Twilio] " prefix to messages; upgrade to paid account to remove

### ⚠️ Breaking Changes

- None.

### 📝 Migration Notes

- **New Tools**: Twilio and Mailchimp available immediately after alpha.11 merge; no migration needed
- **Basic Auth**: Existing tools can opt-in to native Basic Auth by updating YAML; backward compatible with hardcoded Authorization headers
- **Dependencies**: Added `twilio` and `mailchimp` TypeScript types to `packages/core/test/integration/`; no user-facing API changes

---

## v0.1.0-alpha.10

> Release: Notion tools provider, enhanced HTTP executor with structured parameters, and improved error handling

**Released**: February 21, 2026


### 🚀 Features

- **Notion Provider** (`packages/notion`)
  - Complete Notion tools package with 7 core tools for database and page operations
  - **Tools**: `notion_list_databases`, `notion_query_database`, `notion_create_page`, `notion_update_page`, `notion_get_page`, `notion_search`, `notion_create_comment`
  - Support for markdown content, database queries, page properties, icons, and covers
  - Full OAuth2 or API key authentication
  - Comprehensive YAML definitions with examples and output schemas

- **Notion Examples** (Factory, Decorator, LangChain patterns)
  - Three complete example scripts for integrating Notion tools
  - **Factory Pattern** (`notion-factory.ts`) — Direct tool execution with database discovery and real operations
  - **Decorator Pattern** (`notion-decorator.ts`) — Class-based `@tool()` decorator pattern
  - **LangChain Pattern** (`notion-langchain.ts`) — AI agent with OpenAI GPT-4o-mini that auto-discovers databases
  - Comprehensive README with setup, environment configuration, and troubleshooting

- **HTTP Executor Enhancements**
  - Improved parameter embedding for complex types (objects, arrays)
  - Better handling of empty strings and null values in templating
  - Structured response extraction with proper data validation
  - Enhanced error normalization via new `fromHttpError()` factory method

- **Error Handling Improvements**
  - `MatimoError` class extended with optional `cause` field for error chaining
  - New `fromHttpError()` helper to standardize HTTP/Axios errors into structured `MatimoError`
  - Consistent error context preservation across executors

### 🛠 Fixes & Improvements

- **Notion Tools**
  - Auto-title generation for pages when DB properties are missing
  - Validation of required `parent` parameter for create/update operations
  - Proper markdown-to-block conversion for page content
  - Fixed parameter templating for optional fields

- **HTTP Executor**
  - Fixed parameter validation to allow empty strings in templates
  - Improved object/array embedding logic with explicit null/undefined checks
  - Better error messages with original error details preserved
  - Response schema validation via Zod

- **Tests**
  - Enhanced unit tests for HTTP executor with edge cases (empty strings, objects, arrays)
  - Improved integration tests with better parameter validation
  - Added response fixtures for multiple tool types

- **Examples**
  - Standardized `convertToolsToLangChain()` pattern across Slack, Gmail, and Notion examples
  - LangChain examples now auto-discover resources (channels, databases) before creating agents
  - Improved error handling and logging in all example patterns

- **Documentation**
  - Updated tool parameter documentation for clarity
  - Added examples for complex parameter types (objects, arrays)
  - Improved HTTP executor documentation with structured parameter embedding

### 🔧 Technical Notes

- **Parameter Templating**: Object and array parameters are now properly embedded as JSON when indicated by parameter type in YAML
- **Error Chaining**: Use `MatimoError.cause` and `MatimoError.details.originalError` to access the original exception
- **LangChain Integration**: Secret injection pattern now supports complex types (objects) in addition to strings
- **Notion Authentication**: Both API key and OAuth2 flows are fully supported; requires database sharing via Notion UI

### ⚠️ Breaking Changes

- None.

### 📝 Migration Notes

- **Notion Tools**: Set `NOTION_API_KEY` environment variable; share databases with your integration in Notion UI
- **Error Handling**: Code catching generic `Error` types should check for `MatimoError` first; original errors available via `error.cause`
- **LangChain Examples**: All examples now discover required context (database IDs, channel IDs) before creating agents; no changes needed if using as-is

---

## v0.1.0-alpha.9

> Release: HubSpot provider, 50+ CRM tools, LLM-powered examples, approval enforcement, and full documentation

**Released**: February 19, 2026

### 🚀 Features

- **HubSpot Provider**
  - Added full HubSpot CRM integration as a new provider package (`packages/hubspot`).
  - 50+ tools for Contacts, Companies, Deals, Tickets, Leads, Line Items, Invoices, Orders, Products, and Custom Objects (CRUD + list for each).
  - All destructive tools (`update`, `delete`) require approval (`requires_approval: true`).
  - OAuth2 and API key authentication supported.
  - Comprehensive YAML tool definitions with examples and output schemas.
- **Examples**
  - New HubSpot example scripts for Factory, Decorator, and LangChain agent patterns (`examples/tools/hubspot-*`).
  - Example scripts use real LLM agent pattern (OpenAI GPT-4o-mini via LangChain).
  - Example and package READMEs for HubSpot, with setup, usage, and troubleshooting.
- **Testing**
  - Integration and unit tests for HubSpot tools (Jest, 85%+ coverage).
  - Approval system tested for all destructive actions.
- **Documentation**
  - Full documentation for HubSpot tools in both `packages/hubspot/README.md` and `examples/tools/hubspot/README.md`.
  - Updated main `README.md` to mention HubSpot support.
- **CI/CD**
  - Updated GitHub Actions workflow for npm releases and Discord notifications.

### 🛠 Fixes & Improvements

- Lint: Removed all `any` types from test files, fixed all lint warnings.
- Tests: Fixed all TypeScript errors in test files, all tests pass.
- Approval: Confirmed all destructive HubSpot tools have `requires_approval: true`.
- Package: Added HubSpot scripts to `examples/tools/package.json`.
- Monorepo: Registered HubSpot in `pnpm-workspace.yaml` and `pnpm-lock.yaml`.

### ⚠️ Breaking Changes

- None.

### 📝 Migration Notes

- To use HubSpot tools, install dependencies and set `MATIMO_HUBSPOT_API_KEY` or configure OAuth2 as described in the package README.
- Approval system is enforced for all destructive HubSpot actions; set `MATIMO_APPROVAL_ENABLED=true` to require approval.

---

## v0.1.0-alpha.8

> Release: focused on a unified approval system, logging, new GitHub tools, and workflow fixes

**Released**: February 18, 2026

### 🚀 Highlights

- **Unified approval system** — Reworked approvals for destructive operations across core tools (`edit`, `execute`, `read`, `search`) with a single `requires_approval` flow and integration into `MatimoInstance`.
- **Structured logging** — Integrated Winston for consistent, structured logs across core packages.
- **New GitHub provider tools** — Added tools to manage repositories, releases, pull requests, and code search.
- **Examples & tests updated** — Examples refactored to use the new approval flow; test coverage expanded across core modules.
- **CI / release fixes** — Discord notification payload fixes and release workflow improvements.

### 📦 Packages

- All publishable packages bumped to v0.1.0-alpha.8

### 🔧 Notable Changes

- Removed legacy approval implementations (`PathApprovalManager`, `SQLApprovalManager`) and related tests in favor of the unified system.
- Improved approval matching: glob -> regex conversion and expanded content-type checks to reduce false positives.
- All tools updated to rely on the new approval flow; redundant tests removed.
- Documentation: outdated File Operation Approval docs removed/updated to reflect the new approach.

### 🐛 Fixes

- Fixed redundant Discord notification payload construction and formatting in release workflow.
---

## v0.1.0-alpha.7.1

> Patch: Discord release notifications + workflow improvements

**Released**: February 15, 2026

### 🔧 Updates

#### CI/CD Improvements
- **Fixed Discord webhook notifications** — Proper JSON escaping for release notes with special characters
- **Dynamic package discovery** — Automatically extracts publishable packages from `pnpm-workspace.yaml` instead of hardcoding
- **Improved error handling** — Better escaping of quotes, backslashes, and newlines in release notes payload

#### Security & Robustness
- All special characters (quotes, newlines, backslashes) in release notes are now safely escaped via jq
- Webhook URL passed securely via GitHub Actions secrets
- No hardcoded package lists — future packages auto-discovered

### 📊 Changes
- npm-release.yml workflow improvements
- All 7 packages bumped to v0.1.0-alpha.7.1

### 🐛 Bug Fixes
- Discord notification JSON escaping
- Date formatting in Discord footer
- Package list generation from workspace configuration

---

## v0.1.0-alpha.7

> Postgres tools suite + SQL approval workflows: Execute database queries safely with interactive approval, LangChain integration, and comprehensive examples

**Released**: February 15, 2026

### 🚀 New Features

#### Postgres Package & Tools
- **New `@matimo/postgres` package** — Production-ready PostgreSQL tool provider
- **`postgres-execute-sql` tool** — Execute arbitrary SQL with parameterized query support for safety
- **Two authentication methods**:
  - Connection string: `MATIMO_POSTGRES_URL=postgresql://...`
  - Separate env vars: `MATIMO_POSTGRES_HOST`, `MATIMO_POSTGRES_PORT`, `MATIMO_POSTGRES_USER`, `MATIMO_POSTGRES_PASSWORD`, `MATIMO_POSTGRES_DB`

#### SQL Approval Workflow System
- **`SQLApprovalManager` core class** — Centralized approval management for destructive queries (DELETE, DROP, UPDATE, ALTER, TRUNCATE)
- **Interactive approval prompts** — Real-time user approval for sensitive SQL operations
- **Smart detection** — Automatically classifies queries as read-only or write/destructive
- **Session caching** — Approve once per session, reduces repeated prompts
- **Auto-approval mode** — Set `MATIMO_SQL_AUTO_APPROVE=true` for CI/CD environments
- **Custom approval callbacks** — Integrate with your own approval logic via `setApprovalCallback()`

### 📚 Examples & Documentation

#### 4 Complete Postgres Examples
All 3 integration patterns (Factory, Decorator, LangChain) + SQL approval workflow:
1. **Factory Pattern** — Direct tool execution with Matimo SDK
2. **Decorator Pattern** — Class-based `@tool()` decorator usage
3. **LangChain Pattern** — AI agent integration with table discovery and analysis
4. **Approval Workflow** — Interactive SQL approval with automatic/manual modes

#### Comprehensive Documentation
- **Postgres Package README** — Complete tool specification, examples, authentication methods, error handling
- **Examples README** — Sequential Discovery Pattern, Approval Workflow Guide, integration patterns
- **`.env.example`** — Postgres configuration with both auth methods documented
- **Inline code comments** — All examples extensively documented for easy understanding


#### CI/CD Enhancements
- **Discord webhook notifications** — Automatic release notifications in Discord channel
- **Workflow improvement** — npm-release workflow now posts Discord embed with release notes extracted from `docs/RELEASES.md`

### 📦 Package Updates

- All 7 packages bumped to v0.1.0-alpha.7:
  - `matimo` (root)
  - `@matimo/core`
  - `@matimo/cli`
  - `@matimo/slack`
  - `@matimo/gmail`
  - `@matimo/postgres` ✨ **NEW**
  - `matimo-examples`

### 🔧 Developer Experience

#### New APIs
- `SQLApprovalManager.isApproved(sql, mode)` — Check if SQL is approved, prompts user if needed
- `SQLApprovalManager.setApprovalCallback()` — Custom approval callback integration
- `setSQLApprovalManager()` — Global singleton support for cross-module approval management

#### Configuration
- Environment variables for Postgres connection (2 methods)
- `MATIMO_SQL_AUTO_APPROVE` env var for automated environments
- Graceful fallback handling for missing credentials

### 🐛 Fixes & Improvements

- **Error messages** — Helpful hints for connection failures (ECONNREFUSED, missing role, missing database)
- **Non-TTY handling** — Approval prompt properly rejects in non-interactive environments (CI/CD)
- **Parameter validation** — Strict validation of SQL parameters in approval checks
- **Encoding support** — Proper handling of connection string encoding for special characters in passwords


### 🔗 Related Documentation

- [Postgres Package README](../packages/postgres/README.md) — Tool specifications and usage
- [Examples README](../examples/README.md) — Sequential discovery pattern, approval workflow
- [Tool Development Guide](../docs/tool-development/EXTENDING.md) — How to create new tools

### ⚠️ Breaking Changes

None. This is a purely additive release.

---

## v0.1.0-alpha.6

> Core tools architecture overhaul: function-based execution, unified SDK model, and comprehensive tool suite

**Released**: February 13, 2026

### Security & Safety Improvements

- **Approval flow for file operation tools** — File read/write operations now require explicit approval to prevent unauthorized access
- **Command injection detection in execute tool** — Added security validation to detect and block potentially malicious shell commands

### Core Tools Architecture Overhaul

- **All core tools converted to function-type execution** — Eliminates subprocess spawning and `tsx` PATH dependencies
- **Unified execution model** — All core tools now use direct async function calls for better performance and error handling
- **Core tools suite expanded**:
  - **execute** — Execute shell commands with timeout, cwd control, and environment variables
  - **read** — Read files with line range support, encoding detection, and large file handling
  - **edit** — Edit/replace file contents with optional encoding and backup support
  - **search** — Search files using grep patterns with line output and context display
  - **web** — Fetch and parse web content with headers, cookies, and response validation
  - **calculator** — Refactored to function-type for consistency

### Execution Model Improvements

- **No external dependencies** — Core tools no longer depend on `tsx` or other CLI tools
- **Direct in-process execution** — Function-based tools execute directly without subprocess overhead
- **Better error handling** — Native exception throwing instead of stdout/stderr parsing
- **Simpler type safety** — Direct TypeScript function signatures for all tools

### Testing & Examples

- **Comprehensive unit tests** for all 5 new core tools (execute, read, edit, search, web)
- **Complete examples** for all core tools in 3 integration patterns:
  - Factory pattern (direct tool execution)
  - Decorator pattern (class-based with @tool)
  - LangChain pattern (AI agent integration)
- **Tests pass**: 624+ test suite with 100% pass rate

### Schema & Tool Loading Improvements

- **Enhanced ToolDefinitionSchema** — Better parameter validation and default value handling
- **Improved tool caching** — Tool packages cached for faster discovery and loading
- **Better tool discovery** — Provider auto-discovery with efficient lookup
- **Passthrough validation removed** — Stricter schema validation for tool definitions
- **Default parameters support** — YAML definitions can now specify default values

### Developer Experience

- **Unified core tools** — Consistent execution model across all built-in tools
- **Cleaner imports** — Tools properly structured under `packages/core/tools/`
- **commitlint updates** — Added support for 'example' commit type in conventional commits

### Quality & Reliability

- **Build fixes** — Resolved issues from previous release
- **Lint fixes** — Eliminated linting issues in updated code
- **Type safety** — All tools properly typed with strict TypeScript checking

## Architecture Comparison

### Before (alpha.5)

```yaml
# Command-type execution (subprocess spawning)
execution:
  type: command
  command: 'tsx'
  args: ['packages/core/tools/read/read.ts', '{filePath}']
```

### After (alpha.6)

```yaml
# Function-type execution (direct calls)
execution:
  type: function
  code: './read.ts'
```

**Benefits**: Faster execution, no PATH dependencies, native error handling, simpler debugging

## Tools Now Available

### Core Utilities (6 tools)

- `calculator` — Arithmetic operations (add, subtract, multiply, divide)
- `execute` — Execute shell commands with full control
- `read` — Read file contents with line ranges
- `edit` — Edit/replace file contents
- `search` — Search files by pattern
- `web` — Fetch and parse web content

### Provider Integrations (21+ tools)

- `slack` — 16+ Slack tools (messaging, channels, users, etc.)
- `gmail` — 5 Gmail tools (send, list, get, draft, delete)

## Examples

### Execute Tool - All 3 Patterns

```typescript
// Factory pattern
const matimo = await MatimoInstance.init('./tools');
const result = await matimo.execute('execute', {
  command: 'ls -la',
  cwd: '/tmp'
});

// Decorator pattern
@tool('execute')
async runCommand(command: string) { }

// LangChain pattern
const tools = matimo.listTools()
  .map(t => ({ type: 'function', function: {...} }));
```

### Read Tool

```typescript
const result = await matimo.execute('read', {
  filePath: './src/index.ts',
  startLine: 10,
  endLine: 50,
});
```

### Edit Tool

```typescript
const result = await matimo.execute('edit', {
  filePath: './config.json',
  newContent: '{"updated": true}',
  createBackup: true,
});
```

### Search Tool

```typescript
const result = await matimo.execute('search', {
  pattern: 'function execute',
  directoryPattern: './src/**/*.ts',
  outputLines: true,
});
```

### Web Tool

```typescript
const result = await matimo.execute('web', {
  url: 'https://example.com',
  method: 'GET',
});
```

## Migration from Alpha.5

### If you were using core tools:

**Before (command-type with tsx)**:

```typescript
// Tools required tsx in PATH
const result = await matimo.execute('read', {...});
```

**After (function-type, no dependencies)**:

```typescript
// Same API, better performance, no PATH dependencies
const result = await matimo.execute('read', {...});
```

API remains the same — no code changes needed! Just update Matimo version.

## Testing & Quality

- ✅ **Improved test coverage** across all packages
- ✅ **No lint errors** — Strict ESLint configuration
- ✅ **100% TypeScript strict mode** — Full type safety
- ✅ **Complete test coverage** — Unit + integration tests for all tools
- ✅ **All examples tested** — 3 patterns × 6 core tools

## Known Issues & Limitations

This is an **alpha release**. Not recommended for production without thorough testing.

## Installation

```bash
npm install matimo@0.1.0-alpha.6
pnpm add matimo@0.1.0-alpha.6
```

## Documentation

- [Quick Start](./getting-started/QUICK_START.md)
- [SDK Patterns](./user-guide/SDK_PATTERNS.md)
- [Tool Reference](./api-reference/SDK.md)
- [Examples](../examples/)

## Contributing

[Contributing Guide](../CONTRIBUTING.md) | [Report Issues](https://github.com/tallclub/matimo/issues)

---

## v0.1.0-alpha.5

> Readme addition to core, slack and gmail packages and custom domain setup for github pages (docs).

**Released**: February 11, 2026

## What's New

- **Documentation Theme**: Updated to Jekyll Slate theme for cleaner, simpler documentation rendering with GitHub Pages native support
- **Workspace Dependencies**: Updated all peer dependencies across cli, gmail, and slack packages to use `workspace:*` versioning for better monorepo management
- **Version Bump**: Official release of v0.1.0-alpha.5 with updated package versions across workspace
- **Release Workflow**: Removed redundant custom GitHub Pages workflow in favor of GitHub's native pages-build-deployment action
- **CNAME Configuration**: Maintained custom domain setup for `docs.matimo.dev`
- **Package Documentation**: Added comprehensive README documentation to core, slack, and gmail packages

## Notes

- Documentation now uses Slate theme for better compatibility with GitHub Pages
- All workspace packages updated with consistent versioning
- Simplified GitHub Actions workflow reduces maintenance and improves reliability

## v0.1.0-alpha.4

> Packaging restructure, Matimo CLI, independent tools package publishing, and docs

**Released**: February 10, 2026

## What's New

- **Monorepo packaging**: repository updated to a workspace layout. Core packages are split under `packages/` and publishable as separate npm packages.
- **Matimo CLI**: cli operations for list, search, install, help within Matimo eco-system.
- **CI publish update**: GitHub Actions updated to publish workspace packages via `pnpm -r publish` so non-private workspace packages are released together.
- **Tools packages**: Tool YAML and assets live under `package/<provider-name>` folders and are published as separate npm packages with in `@matimo/<provider-name>`
- **Examples & docs**: Updated examples and docs to reflect packaging changes and improved quick-start guidance.
- **Build & test fixes**: Ensured `pnpm build` and `pnpm test` run across workspace packages.

## Notes

- The release workflow now publishes all non-private workspace packages (filterable if needed).

# v0.1.0-alpha.3

> Slack integration suite, standardized error handling, improved test coverage, and comprehensive documentation

**Released**: February 5, 2026

## What's New

### Slack Integration Suite

- **16+ Slack tools** across messaging, channel management, user queries, and topic management
- Real OAuth2 integration with Slack workspace testing
- Complete examples for all integration patterns
- Comprehensive Slack API coverage: send messages, list/manage channels, set topics, list users, and more

### Error Handling & Quality

- **Standardized MatimoError** throughout SDK with machine-readable error codes
- Consistent error structure across all executors and decorators
- Error codes: `INVALID_SCHEMA`, `FILE_NOT_FOUND`, `EXECUTION_FAILED`, `TOOL_NOT_FOUND`, `INVALID_PARAMETER`
- Proper error context without exposing sensitive data

### Testing Improvements

- **Mocked HTTP tests** - Removed real network calls from test suite
- 14 HTTP executor test cases with mocked axios responses
- **410 tests** across 23 test suites with 100% pass rate
- Deterministic, fast test execution with no external dependencies

### Examples & Documentation

- **Examples directory renamed** from `langchain` to `tools` - better reflects all three patterns
- **Comprehensive examples README** - 300+ lines covering all integration patterns with code examples
- **Three integration patterns** documented: Factory (direct), Decorator (class-based), LangChain (AI agents)
- Tool reference tables for Slack and Gmail tools
- Pattern comparison matrix and learning path
- Configuration guides for Slack, Gmail, and OpenAI setup

### Package Improvements

- Examples package now uses published matimo (`^0.1.0-alpha.3`) instead of local path
- Examples are now portable and work without building the SDK locally
- Proper version constraints for all dependencies

## What's Improved from Alpha.2

- Slack tools set
- Unified error handling prevents silent failures
- Test suite no longer makes real HTTP calls
- Better developer experience with comprehensive examples
- Documentation aligned with actual SDK capabilities

## Installation

```bash
npm install matimo@0.1.0-alpha.3
pnpm add matimo@0.1.0-alpha.3
```

## Quick Start - Three Integration Patterns

### 1. Factory Pattern (Direct SDK Usage)

```typescript
const matimo = await MatimoInstance.init('./tools');
const result = await matimo.execute('slack-send-message', {
  channel: '#general',
  message: 'Hello from Matimo!',
});
```

### 2. Decorator Pattern (Class-Based)

```typescript
@tool('slack-send-message')
async sendMessage(channel: string, message: string) {
  // Auto-executed via Matimo
}
```

### 3. LangChain Integration (AI Agents)

```typescript
const tools = matimo.listTools()
  .map(t => ({
    type: 'function',
    function: { name: t.name, description: t.description, ... }
  }));
const response = await llm.invoke(messages, { tools });
```

## Tools Included

- **Slack** (16+ tools): Send messages, manage channels, list topics, manage users, etc.
- **Gmail** (5 tools): Send, list, get, draft, delete messages
- **Utilities**: Calculator, echo, HTTP client

## Documentation

- [Installation & Setup](./getting-started/installation.md)
- [Quick Start](./getting-started/QUICK_START.md)
- [Examples Guide](../examples/README.md) - All three patterns with detailed walkthrough
- [SDK Patterns](./user-guide/SDK_PATTERNS.md)
- [OAuth2 Guide](./architecture/OAUTH.md)
- [API Reference](./api-reference/SDK.md)

## Known Limitations

This is an **alpha release**. Not recommended for production without thorough testing.

See [Roadmap](./ROADMAP.md) for future features (REST API, MCP server, Python SDK, rate limiting).

## Contributing

[Contributing Guide](../CONTRIBUTING.md) | [Report Issues](https://github.com/tallclub/matimo/issues)

---

# v0.1.0-alpha.2

> Improved alpha.1 release - Better npm workflow, fixed exports, accurate feature descriptions

**Released**: February 4, 2026

## What's Improved

### Release & Distribution

- Improved npm publish workflow configuration (pre-releases currently publish under default 'latest' dist-tag)
- Replaced deprecated GitHub Actions (softprops/action-gh-release@v2)
- Proper semantic versioning for release titles
- Fixed broken documentation links in releases

### Package & Exports

- Explicit package exports for main and MCP modules
- Accurate npm description (reflects current Phase 1 scope)
- Proper Node.js module resolution

---

# v0.1.0-alpha.1

> First alpha release - Core OAuth2, tool execution, and SDK patterns

**Released**: February 3, 2026

## What's New

### OAuth2 Multi-Provider Support

- OAuth2 handler with token injection
- Providers: Google (Gmail), GitHub, Slack
- Provider YAML configuration
- Automatic token injection into requests

### Tool System

- YAML/JSON tool definitions with Zod validation
- Command executor (shell commands with templating)
- HTTP executor (REST APIs with OAuth2)
- Provider definition system
- Tool discovery and filtering

### SDK Patterns

- **Factory pattern**: `const m = await matimo.init('./tools'); m.execute(toolName, params)`
- **Decorator pattern**: `@tool('calculator')` for class-based usage
- Tool discovery, filtering, and search
- Full TypeScript support with strict types

### Tools Included

- **Gmail** (5 tools): send, list, get, draft, delete
- **Utilities**: calculator, echo, HTTP client
- **Provider configs**: Google, GitHub, Slack

## Installation

```bash
npm install matimo@0.1.0-alpha.1
pnpm add matimo@0.1.0-alpha.1
```

## Quick Start

```typescript
import { matimo } from 'matimo';

const m = await matimo.init('./tools');
const result = await m.execute('calculator', {
  operation: 'add',
  a: 5,
  b: 3,
});
```

## Documentation

- [Installation & Setup](./getting-started/installation.md)
- [Quick Start](./getting-started/QUICK_START.md)
- [SDK Patterns](./user-guide/SDK_PATTERNS.md)
- [OAuth2 Guide](./architecture/OAUTH.md)
- [API Reference](./api-reference/SDK.md)
- [Examples](../examples/)

## Known Limitations

This is an **alpha release**. Not recommended for production without thorough testing.

See [Roadmap](./ROADMAP.md) for future features.

## Contributing

[Contributing Guide](../CONTRIBUTING.md) | [Report Issues](https://github.com/tallclub/matimo/issues)
