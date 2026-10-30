# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---
## [0.4.0] - 2026-10-30

TypeScript and Python now share one version number: TypeScript moves from 0.3.0 and Python from 0.2.0, both to 0.4.0. Python has no 0.3.0. Security hardening from a repository audit. Read the behaviour changes before upgrading.

### ⚠️ Behaviour changes
- MCP HTTP servers (both SDKs) bind `127.0.0.1` by default instead of all interfaces. Containers and remote clients need `--host 0.0.0.0` (`host` / `host=` option) and should use HTTPS
- Python's MCP HTTP server now requires a bearer token like the TypeScript one: it reads `MATIMO_MCP_TOKEN`, or generates a token and prints it to stderr. It used to run unauthenticated when no token was passed
- TypeScript `execute` runs the command without a shell (`execFile`), as the Python tool already did. Shell builtins such as `dir` and `echo` are not available on Windows. Newline, CR and NUL are rejected
- Network tools (`web`, `web_scraper`, `extract_from_file`) and HTTP tools refuse hostnames that resolve to internal addresses. Set `MATIMO_ALLOW_PRIVATE_DNS=true` if a tool must reach an internal service by DNS name
- A function tool's `execution.code` must stay inside the tool's directory
- Python MCP server now requires `mcp>=2.0` (the `matimo[mcp]` extra, `matimo-cli` and `matimo-core` pins moved from `>=1.28.1`). The mcp 1.x decorator-based code path is removed. Run `pip install -U "mcp>=2.0"` if you installed `mcp` 1.x yourself. The TypeScript server is unchanged (`@modelcontextprotocol/sdk` has no 2.x release)

### 🔒 Security
- SSRF check: blocks all of `127.0.0.0/8`, IPv4-mapped and NAT64 IPv6, unique-local and link-local IPv6 (including `fd00:ec2::254`), `100.64.0.0/10`, `[::]`, trailing-dot hosts and legacy numeric hosts. The four separate copies of the check now share one classifier
- Redirects are re-validated on every hop; TypeScript also pins the connection to the address it checked
- The `web` tool had no SSRF check at all; it has one now
- Python `postgres-execute-sql` interpolated `schema` into `SET search_path`; it is now a bound parameter
- Approval is now requested for SQL that reaches files, the OS or other servers (`COPY`, `pg_read_file`, `lo_export`, `dblink`, `DO $$`, `CALL`, ...)
- Dependencies: `undici` override raised from an exact `8.11.2` to `>=8.12.2`, plus `body-parser`, `zod`, `@azure/msal-node`; `python/examples/mcp` lockfile upgraded (`aiohttp`, `mcp`, `pillow`, `pyjwt`, `pypdf`, `urllib3`, ...)
- CodeQL findings fixed: a ReDoS in SSRF host normalisation and unescaped quotes in diagram attributes
- Python: `certifi` bumped to 2026.10.23 (PYSEC-2026-4320)
- Known and unfixed: `chromadb` (via `crewai`, optional extra only) has advisories with no fixed release

### ✨ Features
- `MATIMO_FILE_ROOTS` confines `read`, `edit`, `search`, `convert_to_file` and `extract_from_file` to listed directories, resolving symlinks. Off unless set
- `MATIMO_POSTGRES_SSL` (`disable`, `require`, `verify-ca`, `verify-full`) for the Postgres tool
- `matimo mcp --host`

### 🐛 Fixes
- `pnpm validate-tools` no longer fails when pnpm hoists js-yaml 5.x (#196)
- TypeScript approval manifest: saving could fail on Windows with `EPERM` when two writers renamed over `.matimo-approvals.json` at once. Temp names are now unique, the rename retries on `EPERM`/`EBUSY`/`EACCES`, and a failed save removes its temp file
- TypeScript examples `policy:demo`, `skills:demo` and `meta:flow` sent all 153 tools to OpenAI on Windows (limit 128) because their provider-tool filter only matched `/` in paths. It now matches both `/` and `\` separators

- `execute` (both SDKs) ignored its declared `args`, so `{command: 'node', args: ['-v']}` ran bare `node` until the timeout. `args` is now appended to the command, one argument each. The declared `shell` parameter was never read; it now works as an explicit opt-in. `execute` still runs without a shell by default. With `shell` set, the command runs through that shell (`-c`, `/c` for `cmd`, `-Command` for PowerShell), `args` become `$1`, `$2`, ... for POSIX shells, and the metacharacter filter does not apply. **Every call with a `shell` needs a human decision**: `MATIMO_AUTO_APPROVE`, `MATIMO_APPROVED_PATTERNS` (even `*`), and the `approved` flag (including the MCP server's `trustClientApproval`) are ignored for it, and with no approval callback configured the call is refused
- Python `execute` now matches TypeScript: output is trimmed, a spawn failure reports exit code 1, the quote-aware splitter is shared in behaviour, newline/CR/NUL are rejected, and errors are `MatimoError(INVALID_PARAMETER)` instead of `ValueError`
- TypeScript `extract_from_file` could not read PDFs written by `convert_to_file` ("bad XRef entry"): `pdf-parse` 1.1.4's bundled pdf.js rejects pdfkit output on every pdfkit version. PDF text is now read with `unpdf`
- Python `matimo_list_skills` returned 0 skills unless the caller registered the instance with `set_global_matimo_instance`. A function tool now sees the instance that is executing it, which also fixes the other skill meta-tools, `matimo_reload_tools`, `matimo_search_tools` and the approval tools
- `@matimo/bruno` no longer depends on `@usebruno/cli`, which it never imported (it runs the `bru` binary on PATH, documented as a global install). This removes the 13 `npm audit` findings (9 high) that installing the package pulled in. Install the CLI yourself with `npm install -g @usebruno/cli`

### 🔧 Maintenance
- matimo.dev and the docs are rebuilt as one Astro Starlight site, with use-case guides, a privacy notice and opt-in analytics
- HubSpot: the OAuth token endpoint points at the real token URL and every tool declares its auth env var notes
- Docs, website pages, READMEs, examples and Colab notebooks checked against the source and updated: the `execute` `args`/`shell` behaviour and its mandatory approval, Python meta-tools no longer needing `set_global_matimo_instance`, the Bruno CLI no longer being bundled, the MCP `127.0.0.1` default and `mcp>=2.0`, and the 0.4.0 safeguards (`MATIMO_FILE_ROOTS`, `MATIMO_ALLOW_PRIVATE_DNS`, `MATIMO_POSTGRES_SSL`, broader SQL approval). Corrected tool counts (153 with every native provider, 24 core), test counts and version references; removed a non-existent Python MCP class, tool names, environment variables and a `validation:` YAML block from the docs; documented that `error_handling` retries are not applied yet; and brought `docs/` level with the more recent website pages. Notebook install cells now require `matimo>=0.4.0`
- Python MCP tests run against the real mcp 2.x SDK (in-memory client), and the legacy mcp 1.x tests are gone
- Every GitHub Action pinned to a commit SHA; `tool-validation.yml` brought off v2/v3 actions; CI fails on high-severity `pnpm audit` and `pip-audit` findings

---
## [typescript/v0.3.0] - 2026-10-13

Node 22.19 or newer is now required. Node 18 and 20 are no longer supported.

### ⚠️ Breaking changes
- `engines.node` is now `>=22.19.0` in every `@matimo/*` package. The patched `undici` 8 needs it. `matimo doctor` checks for it. CI tests Node 22 and 24

### ✨ Features
- `@matimo/composio`: every generated tool takes `composio_toolkit_version` (default `latest`) and sends it as `version`. Composio v3 otherwise runs the stale base version `00000000_00`, which can call upstream APIs that no longer exist. Pass a dated version such as `20251027_00` to pin

### 🔒 Security
- `@modelcontextprotocol/sdk` ^1.31.0 (OAuth client could send credentials to an authorization server chosen by the MCP server)
- Patched transitive advisories through `pnpm.overrides`: `proxy-addr` (critical), `handlebars` (2 critical, 1 moderate), `undici` (10 findings, now 8.11.2), `fast-uri`, `ip-address`, `hono` (>=4.13.7), `yaml` and `csv-parse` (both pinned by `@usebruno/cli`), and `uuid` ^14.0.3
- Known and unfixed: `sprintf-js` (moderate, no patched release, via `mammoth`)

### 🔧 Maintenance
- Pinned the `@babel/core` override to ^7
- `.snyk` accepts the `yaml` advisory pinned by `@usebruno/cli` 4.2.0 until 2026-12-04 (the new override should make this unnecessary)

---
## [typescript/v0.2.0] - 2026-10-04

Governance is now true by default: every tool call is governed the same way in both SDKs. Read
[Upgrading to 0.2.0](docs/api-reference/POLICY_AND_LIFECYCLE.md#upgrading-to-020) before upgrading.

### ⚠️ Behaviour changes
- HTTP `DELETE` and `type: command` tools without an explicit `requires_approval` now ask for per-call approval. To restore the old default, set `governanceMode: 'legacy'` in `InitOptions` or `policy.yaml`, or set `requires_approval: false` on the tool
- `pnpm validate-tools` rejects a DELETE tool without `requires_approval` and a function tool without `risk`

### 🛡️ Governance
- HITL quarantine at execution now applies to every tool whose risk is at or above `hitlMinRiskLevel`. It used to apply only when the risk was listed in `quarantineRiskLevels`, so a DELETE or function tool skipped quarantine while a POST did not
- Function tools are classified by their declared `risk:`. Every built-in function tool now declares one
- HITL approvals of tools loaded at `init()` are read back from the approval manifest instead of being asked again on every call
- Per-call approval callbacks: `InitOptions.onApproval`, `setApprovalCallback()`, and `execute(..., { onApproval })`. The global handler remains a fallback, and with no callback the call fails closed
- MCP asks the human through elicitation. `_matimo_approved` is no longer offered to the model unless the server sets `trustClientApproval`. The HTTP bearer token is compared in constant time
- `matimo_approve_tool` refuses to approve a tool created by the calling agent, requires `admin` when the host supplies a policy context (roles come from your application, never from the agent; with no context the human approval prompt is the only gate), and can never be pre-approved by `MATIMO_AUTO_APPROVE` or patterns
- The approval hint no longer recommends `MATIMO_AUTO_APPROVE`, and a warning is logged while it is on

### ✨ Features
- `tool:executed` is now emitted, together with the new `tool:execution_failed`. Both have fields identical to Python's (`conformance/events/execution-events.json`)
- `auditSink` with `JsonlFileSink`: a hash-chained JSONL audit log with secret redaction and `verifyAuditLog()`. The log format is shared with Python
- `governanceMode` and `getGovernanceMode()`, plus `hitlMinRiskLevel` in `PolicyConfig` and `policy.yaml`
- Function tools receive `{ credentials, policyContext }`. The MCP server's `context` option sets the policy context for MCP calls
- Skills: pluggable skill paths, meta-tools for skill search, sections and content, per-section budgets, and prompt-context helpers
- MCP standard tool annotations and humanized titles; structured error codes across the MCP boundary; a response-size guardrail with configurable ceilings
- `ApprovalHandler.addApprovedPattern()` pre-approves tools in a running process, as Python's `add_approved_pattern()` does
- The public `ToolDefinition` type exposes the declared `risk`
- No-key demos in both SDKs: approval modes, audit log, response-size guardrail, skills registry

### 🐛 Bug Fixes
- Array parameter item types resolve correctly for OpenAI function-calling schemas
- Example env vars and tool names match the current definitions
- An approval made with `matimo_approve_tool` survives the next reload. The tool signed it with its own manifest, so without `MATIMO_APPROVAL_SECRET` (or with a different `approvalDir`) the reload rejected the tool it had just approved. The approve and status tools now use the owning instance's manifest
- `matimo_create_tool` reports every new tool as `pending` and names the approval step; it used to call low-risk drafts "auto-approved … ready for use", though a draft runs only once approved. `matimo_get_tool_status` reports an unapproved draft as `pending`
- `matimo_validate_tool` is valid exactly when `matimo_create_tool` would accept the definition. It used to flag the `requires_approval` and `status` fields that creation sets itself
- `matimo_list_skills` adds the skills in `skills_dir` when a global instance is registered; it used to ignore the parameter
- Examples pass approval callbacks where 0.2.0 needs them, and the meta-flow agents name meta-tools that exist (`matimo_doctor` and `matimo_review` never did)
- Every npm package, wheel and sdist includes the MIT `LICENSE`. They shipped without one before; `core` listed `LICENSE` in `files` but the file did not exist in the package directory
- `matimo`'s `matimo` command runs the CLI from `@matimo/cli` instead of a second bundled copy
- `matimo` re-exports `@matimo/core` instead of bundling a second copy of it. With two copies, `import … from 'matimo'` kept the global instance in a different module than the provider tools and meta-tools used, so `matimo_search_skills`, `matimo_get_skill_sections` and `matimo_get_skill_content` reported "No active Matimo instance found"
- The TypeScript MCP server starts under plain Node. Its imports of the MCP SDK's `server/mcp`, `server/stdio`, `server/streamableHttp` and `types` lacked the `.js` the SDK's export map requires, so a Node process failed with `ERR_MODULE_NOT_FOUND`; Jest and tsx resolved them anyway
- The `@matimo/core` and provider npm packages include their `skills/` directory. Earlier tarballs left it out, so `autoDiscover` found no skills in an installed project

### 📚 Documentation
- The core skills shipped to agents (`meta-tools-lifecycle`, `policy-validation`, `tool-creation`, `tool-discovery`) describe the real lifecycle and the meta-tools as defined
- API references, guides, READMEs and all seven notebooks were checked against the code and rerun against the 0.2.0 packages

### 🔧 Chores
- `.matimo-approvals.json` is no longer tracked. A committed manifest pre-approved two Composio Jira tools
- Dependabot config; CVE patches for `@modelcontextprotocol/sdk`, `@usebruno/cli`, undici, nanoid, faker, minimatch, brace-expansion and browserslist

### 📦 Version Bumps
- All `typescript/` packages: `0.1.8` → `0.2.0`

---
## [python/v0.2.0] - 2026-10-04

Parity release with typescript/v0.2.0. Every governance change above applies to the Python SDK too, with snake_case names (`on_approval`, `governance_mode`, `audit_sink`, `hitl_min_risk_level`, `verify_audit_log`).

### ⚠️ Behaviour changes
- The DELETE/command approval default and the new validator rules, as in TypeScript. `governance_mode="legacy"` restores the old default
- `requires_approval` is now enforced on every call. It used to be ignored
- `execute(..., approved=True)` skips only the approval prompt. Policy denials still apply
- Execution events: `duration` (seconds) is now `duration_ms` (milliseconds), and `trace_id` is a full UUID. `tool:execution_failed` is new
- Draft tools are gated as in TypeScript: never in production, and elsewhere only for a caller with the `admin` role. Python used to run drafts for anyone outside production (`conformance/policy/execution-gates.json` now pins this in both SDKs)
- Critical and high content violations reject an untrusted tool in every environment. Python used to reject high ones only in production, so `allowed_domains` and `allowed_http_methods` had no effect elsewhere
- `no-ssrf` also blocks `*.internal`, `*.local` and `*.localhost` hosts and `0.0.0.0`, as in TypeScript
- `ReloadResult.loaded` counts every tool the reload registered and `revalidated` the untrusted tools re-checked, as in TypeScript
- LangChain tools return `"Error: <message>"` to the model when a call fails, as in TypeScript. They used to raise, and LangGraph's `ToolNode` re-raises, so one refused approval ended the agent run

### ✨ Features
- Agno framework integration
- `run(params, context)` function tools receive a `FunctionToolContext(credentials, policy_context)`
- `Matimo.get_approval_manifest()`, mirroring `getApprovalManifest()`
- The `matimo-core` and provider wheels ship their `SKILL.md` files. `Matimo.init()` always loads the six core skills and, with `auto_discover=True`, each installed provider's skills, as TypeScript does
- `tool:quarantined` and `tool:rejected` events, and an outcome event (`tool:quarantine_approved` / `_rejected`) for every quarantined call, as in TypeScript

### 🐛 Bug Fixes
- MCP server works with both `mcp` 1.x and `mcp>=2.0`
- OAuth2 endpoints are built with the pydantic alias field names
- Untrusted tools that leave `status` unset are accepted; the model's `stable` default made the forced-draft-status rule reject them all
- The meta-tool fixes listed for TypeScript (approvals surviving reload, `pending` drafts, `matimo_validate_tool` validity) apply to Python too, and `matimo_validate_tool` no longer reports `valid: true` with a critical or high violation
- LangChain and CrewAI tools no longer send `None` for optional parameters the model left out
- A call confirmed in Agno is not asked again by Matimo
- Credential placeholders are filled from `MATIMO_<NAME>` (and that key in `credentials`), as in TypeScript and the docs. Only `MATIMO_<TOOL_NAME>_<NAME>` and `<NAME>` used to work
- The `matimo` meta-package re-exports `classify_execution_risk` and `meets_risk_threshold`

### 🔧 Chores
- `make typecheck` (strict mypy on `matimo-core`) passes and now blocks CI. CI also runs the tests of every provider package
- Dependency bumps: `cryptography`, `pypdf`, `anyio`, `soupsieve`, `crewai`

### 📦 Version Bumps
- All 13 `python/` packages: `0.1.3` → `0.2.0`. Provider packages now require `matimo-core>=0.2.0,<0.3.0`

---
## [typescript/v0.1.8] - 2026-08-30

### 🛡️ Governance
- `MatimoInstance.init()` now always constructs a real `DefaultPolicyEngine()` when no `policy` option is given, since a zero-config instance previously had governance silently disabled
- Fix the `matimo_approve_tool` → `reloadTools()` hash-timing bug: the approval hash is now computed after the `status: approved` write, not before, so the SDK's own self-extension workflow can actually complete end-to-end; `reloadTools()` now distinguishes legitimately-approved tools (narrower `canReload()`) from everything else (`canCreate()`)
- `HttpExecutor` re-checks the fully-resolved URL for SSRF targets immediately before the request fires, closing a gap where only the `{placeholder}`-blanked URL was checked at creation time
- `matimo_get_tool` and `matimo_get_tool_status` now sanitize the `name` parameter against the same path-traversal pattern `matimo_create_tool` already used
- A self-declared `risk:` field can now only raise the automatically computed risk level, never lower it
- Production-environment matching is now a case-insensitive substring check, matching Python's existing behavior

### ✨ Features
- Emit `tool:approval_granted` / `tool:approval_denied` audit events for the simple per-tool `requires_approval` flag, independent of whether a full `PolicyEngine` is configured
- Add `reloadSkills()`, mirroring `reloadTools()`'s clear/re-walk/re-register shape, plus a `skills:reloaded` event

### 🐛 Bug Fixes
- Validate the `execute` tool's command before logging it, instead of crashing on an undefined command
- Use a namespace import for `js-yaml` in meta-tools, since the 5.x ESM build has no default export
- Log discarded tool-discovery errors instead of silently dropping malformed tool YAML from the registry
- Fix `pnpm build` on Windows (`cmd.exe` doesn't strip single-quoted `--filter`), add the missing root `build` delegate script
- Fix Windows-only test failures across `command-executor`, `credentials-override`, `search`, `execute`, and `matimo-get-skill` test suites (bare-executable ENOENT, case-sensitive `PATH` lookup, forward-slash-only path assertions)
- Fix TypeScript compile errors in Bruno examples; make execute-tool examples work cross-platform; cap auto-discovery agent examples to fewer than 128 bound tools (OpenAI's hard limit)

### 📚 Documentation
- Correct tool/provider counts repo-wide to the verified 139+ tools / 10 provider packages / 12 meta-tools, with `@matimo/composio`'s separate 449-tool catalog called out distinctly
- Fix ~15 broken example cross-references, a fabricated `convertToolsToVercelAI` API writeup, several fabricated Python `Matimo.init()`/`ReloadResult` fields, and stale HITL/SSRF/reload-lifecycle guidance across `docs/`
- Add `AGENTS.md` and `llms.txt` for AI-agent and MCP/npm discoverability
- Fix landing-page SEO issues (broken `og:image`, duplicate JSON-LD key, stale version, sitemap protocol violation)

### 🧪 Testing
- Add end-to-end coverage for the approve→reload lifecycle, zero-config policy defaults, execution-time SSRF re-check, and path-traversal rejection on the 3 newly-sanitized meta-tools

### 🔐 Security (flagged, not fixed this release)
- `pnpm audit`: 19 high-severity transitive vulnerabilities via `@modelcontextprotocol/sdk`'s dependency chain, tracked separately

### 📦 Version Bumps
- All 13 `typescript/` packages (`core`, `cli`, `bruno`, `slack`, `gmail`, `github`, `hubspot`, `notion`, `mailchimp`, `microsoft`, `postgres`, `twilio`, `composio`): `0.1.7` → `0.1.8`

---
## [python/v0.1.3] - 2026-08-30

### 🛡️ Governance
- Parity with the TypeScript v0.1.8 governance fixes above: `untrusted_paths` and an `ApprovalManifest` are now actually wired into `Matimo` (previously accepted but unused), a new `can_reload()` sits alongside the now-live `can_create()`, and `http_executor.py` re-checks SSRF targets at the fully-resolved URL before the request fires
- Close an anti-self-approval hole: `can_create()` previously only enforced critical/high-severity content violations, so a hand-edited `status: approved` with no high-severity findings passed unconditionally
- `matimo_get_tool.py`, `matimo_approve_tool.py`, and `matimo_get_tool_status.py` now sanitize the `name` parameter for path traversal
- A self-declared `risk` field can now only raise the automatically computed risk level, never lower it
- Add `reload_skills()`, mirroring `reload()`'s clear/re-walk/re-register shape

### 🐛 Bug Fixes
- Use `Path.is_relative_to()` for the skill-resource containment check, since the previous forward-slash-only check rejected every resource read on Windows
- Install all 10 provider packages by default in the `uv` workspace: they were listed as workspace members but never as project dependencies, so `uv sync` never installed them
- Make execute-tool examples work cross-platform (switch to `git` subcommands; fix two decorator-example methods that sent no command at all)

### 📚 Documentation
- Fix stale/fabricated quickstart parameters and stale per-provider tool counts in `python/README.md`; fix wrong env var names (HubSpot, Postgres) and missing provider-name prefixes (GitHub, Gmail) across provider READMEs
- Add `AGENTS.md` and `llms.txt`

### ⬆️ Dependency Bumps
- `pypdf` 6.14.2 → 6.15.0, `aiohttp` 3.14.1 → 3.14.3, `pillow` 12.2.0 → 12.3.0, `mcp` → 1.28.1, `litellm` 1.72.0 → 1.84.0, `json-repair` 0.25.2 → 0.60.1, `cryptography` (examples/mcp)

### 📦 Version Bumps
- All 13 `python/` packages (`matimo` meta-package, `matimo-core`, `matimo-cli`, `matimo-bruno`, `matimo-slack`, `matimo-gmail`, `matimo-github`, `matimo-hubspot`, `matimo-notion`, `matimo-mailchimp`, `matimo-microsoft`, `matimo-postgres`, `matimo-twilio`): `0.1.2` → `0.1.3`

**Known non-blocking issue (pre-existing):** `mypy` strict typecheck on `packages/core/src` reports 127 errors traced to April 2026 code, predating `python/v0.1.2`. This repo's CI already runs mypy non-blocking (`|| true`); not treated as a release blocker.

---
## [v0.1.7] - 2026-08-11

### ✨ Features
- `@matimo/composio`: 5 new Google Workspace toolkits — Gmail (23 tools), Google Sheets (36), Google Docs (32), Google Forms (7), Google Meet (9) — growing the generated catalog from 342 to 449 tools across 9 to 14 toolkits

### 📚 Documentation
- Document `@matimo/composio`'s bring-your-own-key (BYOK) credential model, with a non-affiliation disclaimer and links to Composio's Terms of Service and Privacy Policy, in the package README and `docs/COMPOSIO.md`
- Add `THIRD_PARTY_NOTICES.md` listing every third-party provider Matimo can connect to, its credential env var, and a link to that provider's own terms
- Mandate the BYOK pattern for all future third-party connectors in `CONTRIBUTING.md` and `SECURITY.md`
- Update `docs/COMPOSIO.md` toolkit table and tool counts (342 → 449 tools, 9 → 14 toolkits)

### 🧪 Testing
- Exercise the new Gmail toolkit across all four example patterns (factory, decorator, LangChain, HITL-approval)
- Give HITL integration tests headroom above Jest's 5000ms default — they drive a real `type: command` child-process spawn plus approval-manifest disk I/O with no prior margin, which could exceed the default under CI load

### 🐛 Bug Fixes
- Add the missing `license: MIT` field to provider sub-package manifests, silencing an npm/pnpm publish warning
- Pin CI to `uv run ruff` (locked `0.15.9`) instead of the floating `uv tool run ruff`, which pulled an unpinned version and flagged findings never enforced for these packages

### 📦 Version Bumps
- All 13 `typescript/` packages (`core`, `cli`, `bruno`, `slack`, `gmail`, `github`, `hubspot`, `notion`, `mailchimp`, `microsoft`, `postgres`, `twilio`, `composio`): `0.1.6` → `0.1.7`

---
## [v0.1.1.post1] - 2026-05-12

### 🐛 Bug Fixes
- Fix `get_core_tools_path()` in `matimo` meta-package — `importlib.resources.files("matimo")` resolved to the meta-package directory in editable installs, returning a non-existent path and causing `matimo_reload_tools` to fail with 0 tools loaded
- Resolve via `matimo.instance.__file__` (always in `matimo-core`) with `importlib.resources` as secondary fallback for published wheels
- Add typed wrapper signatures for `convert_tools_to_langchain`, `convert_tools_to_crewai`, and `build_relevant_skill_prompt`
- Derive `__version__` from `importlib.metadata` with `"0.1.1.post1"` fallback
- Fix `matimo` Python meta-package `__init__.py` — was empty, causing `ImportError: cannot import name 'Matimo' from 'matimo'` for all users after `pip install matimo`
- Use `pkgutil.extend_path` to merge meta-package namespace with `matimo-core` site-packages, enabling direct submodule imports
- Full public API of `matimo-core` and `matimo-cli` now re-exported from the `matimo` meta-package

### 📦 Version Bumps
- `matimo` (Python meta-package): `0.1.1` → `0.1.1.post1`


---
## [v0.1.0] - 2026-05-01

### example[bruno]
-Add Petstore API and Sample API test cases by [@[object]](https://github.com/[object])

### ♻️ Refactoring
-Tool executors and definitions by [@[object]](https://github.com/[object])

### ⚙️ Miscellaneous
-Style contributors with smaller rounded avatars by [@[object]](https://github.com/[object])
-Address axios 1.13.6 and fast-xml-parser security vulnerabilities by [@[object]](https://github.com/[object])
-Remove checked-in build artifacts by [@[object]](https://github.com/[object])
-Update Python uv.lock for v0.1.0 stable by [@[object]](https://github.com/[object])
-Bump all packages to v0.1.0 stable by [@[object]](https://github.com/[object])
-Update pnpm lockfile with @usebruno/cli dependency by [@[object]](https://github.com/[object])
-Bump langchain-openai from 1.1.12 to 1.1.14 in /python by [@[object]](https://github.com/[object])
-Bump langchain-openai in /python/examples/mcp by [@[object]](https://github.com/[object])
-Bump langsmith in /python/examples/mcp by [@[object]](https://github.com/[object])
-Update TypeScript configuration and pnpm workspace for Bruno package integration by [@[object]](https://github.com/[object])
-Bump langsmith from 0.7.29 to 0.7.31 in /python by [@[object]](https://github.com/[object])
-Bump python-multipart from 0.0.24 to 0.0.26 in /python by [@[object]](https://github.com/[object])
-Bump uv from 0.9.30 to 0.11.6 in /python by [@[object]](https://github.com/[object])

### ✅ Testing
-Add small policy and dotenv edge-case coverage tests by [@[object]](https://github.com/[object])
-Fix pytest-asyncio test pollution with explicit markers by [@[object]](https://github.com/[object])

### ✨ Features
-Enhance request handling and validation, update output schema by [@[object]](https://github.com/[object])
-Add matimo_get_tool and matimo_search_tools functionalities with definitions by [@[object]](https://github.com/[object])
-Implement HITL timeout and approval TTL features by [@[object]](https://github.com/[object])
-Add shared utility for Bruno CLI version checking and update tool definitions by [@[object]](https://github.com/[object])
-Update array param handling to include empty items schema for compatibility with MCP clients by [@[object]](https://github.com/[object])
-Implement auto-discovery for skill paths and enhance logging in matimo_list_skills by [@[object]](https://github.com/[object])
-Add Bruno CLI installation check and update package.json dependencies by [@[object]](https://github.com/[object])
-Enhance Python MCP examples with new transport support and auto-discovery features by [@[object]](https://github.com/[object])
-Bruno tools for importing OpenAPI specs, listing, running collections, and individual requests by [@[object]](https://github.com/[object])

### 🐛 Bug Fixes
-Align tool parameters and outputs with implementations by [@[object]](https://github.com/[object])
-Strengthen _matimo_approved boolean validation for PR #93 and Issue #69 by [@[object]](https://github.com/[object])
-Avoid trusting client approval flags by [@[object]](https://github.com/[object])
-Polyfill crypto in Jest for Node 18 LangChain tests by [@[object]](https://github.com/[object])
-Update axios version to ^1.15.2 across all packages by [@[object]](https://github.com/[object])
-Apply anyOf JSON Schema pattern for nullable next_cursor fields by [@[object]](https://github.com/[object])
-Update all provider packages to accept stable matimo-core v0.1.0 by [@[object]](https://github.com/[object])
-Align bruno_import_openapi output field with schema by [@[object]](https://github.com/[object])
-Fail closed on invalid TTL timestamp in approval manifest by [@[object]](https://github.com/[object])
-Distinguish HITL timeout from explicit rejection using sentinel by [@[object]](https://github.com/[object])
-Align bruno_run_request Python impl with TypeScript by [@[object]](https://github.com/[object])
-Align bruno_list_collections output with schema by [@[object]](https://github.com/[object])
-Restore nullable next_cursor type in pagination schemas by [@[object]](https://github.com/[object])
-Update MCP examples dependencies to v0.1.0 stable by [@[object]](https://github.com/[object])
-Update examples dependencies to v0.1.0 stable by [@[object]](https://github.com/[object])
-Remove report_format parameter - simplify to JSON-only for v0.1.0 by [@[object]](https://github.com/[object])
-Downgrade matimo_list_skills logging from info to debug by [@[object]](https://github.com/[object])
-Simplify next_cursor type definition in output schema by [@[object]](https://github.com/[object])
-Add ts-jest paths config to resolve @matimo/core without build by [@[object]](https://github.com/[object])
-Move @matimo/core to dependencies so CI can resolve types by [@[object]](https://github.com/[object])

### 📚 Documentation
-Comprehensive v0.1.0 documentation update by [@[object]](https://github.com/[object])
-Add Bruno CLI integration documentation and examples for API testing by [@[object]](https://github.com/[object])## [python/v0.1.0a14.post2] - 2026-04-16

### ⚙️ Miscellaneous
-Update version to 0.1.0a14.post2 matimo_core and mcp example in pyproject.toml files by [@[object]](https://github.com/[object])
-Update package overrides and dependencies by [@[object]](https://github.com/[object])
-Bump langsmith from 0.7.29 to 0.7.31 in /python by [@[object]](https://github.com/[object])
-Bump python-multipart from 0.0.24 to 0.0.26 in /python by [@[object]](https://github.com/[object])
-Bump uv from 0.9.30 to 0.11.6 in /python by [@[object]](https://github.com/[object])
-Update package overrides and dependencies by [@[object]](https://github.com/[object])
-Bump axios from 1.13.5 to 1.15.0 in /typescript by [@[object]](https://github.com/[object])

### 🐛 Bug Fixes
-Adjust handling of array types in JSON schema to omit default items key when not specified by [@[object]](https://github.com/[object])
-Enhance tool discovery and server configuration with env var; remove obsolete tests by [@[object]](https://github.com/[object])
-Redact sensitive information in example outputs and improve temporary file handling by [@[object]](https://github.com/[object])
-Improve error message for unknown secret resolver type by [@[object]](https://github.com/[object])
-Fix python mcp examples and validate with both stdio and http by [@[object]](https://github.com/[object])

### 📚 Documentation
-Add QUICK_REFERENCE and SETUP_GUIDE for Matimo MCP by [@[object]](https://github.com/[object])## [python/v0.1.0a14] - 2026-04-12

### ✨ Features
-Update descriptions and README files for clarity; add PYPI API token for publishing by [@[object]](https://github.com/[object])

### 🐛 Bug Fixes
-Dev dependency install fix by [@[object]](https://github.com/[object])
-Fix dependencies install by [@[object]](https://github.com/[object])
-Correct dependency-groups syntax and dynamic package discovery by [@[object]](https://github.com/[object])
-Use dependency-groups only [remove](https://github.com/tallclub/matimo/issues/) duplicate) by [@[object]](https://github.com/[object])
-Use --group dev instead of --all-groups by [@[object]](https://github.com/[object])
-Install test deps in python publish workflow by [@[object]](https://github.com/[object])<!-- generated by git-cliff -->
