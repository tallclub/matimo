# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
