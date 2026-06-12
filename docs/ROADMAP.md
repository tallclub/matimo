# Matimo Roadmap

## Current Status

**Latest Release**: **v0.1.4** (June 11, 2026) — **🪟 Microsoft Graph Provider + Stability Patches**

### 🏆 Production Launch — General Availability

Matimo v0.1.4 stable is now **production-ready** with full TypeScript and Python SDK support, 146+ tools across 11 providers, enterprise-grade security, and comprehensive framework integrations.

✅ **v0.1.0 Stable — Completed Features**:

**Core SDK (TypeScript + Python)**
- OAuth2 authentication with multi-provider setup
- Tool execution (function, command, and HTTP types)
- YAML-based tool definitions + Zod (TS) / Pydantic v2 (Python) validation
- **4 SDK patterns**: Factory, Decorator, LangChain, CrewAI
- **10 meta-tools** for runtime tool and skill management
- CLI: list, search, install, help, doctor, review, validate, mcp
- MCP Server (stdio + HTTP on port 3101, Claude Desktop compatible)
- Skills system with TF-IDF semantic search
- Policy engine with risk classification + HITL workflows
- Secret management (Env, Dotenv, Vault, AWS Secrets Manager)

**Provider Ecosystem** (146+ tools across 11 providers)
- **Slack** (16+), **GitHub** (10+), **Gmail** (5+), **Notion** (7+)
- **HubSpot** (50+), **Mailchimp** (8+), **Postgres** (6+), **Twilio** (4+)
- **Bruno CLI** (7), **Microsoft Graph** (9) — Mail, Teams, calendar, SharePoint, OneDrive search
- All providers ship with TypeScript + Python SDKs, LangChain/CrewAI examples

**Bruno CLI Provider** (v0.1.0 — NEW)
- ✅ 7 production tools: create, add, run, inspect, import OpenAPI
- ✅ Full workflow examples in both SDKs
- ✅ JSON reporter integration
- ✅ Collection and request-level execution

**Meta-Tools** (10 total — 2 new in v0.1.0)
- ✅ Tool lifecycle: `create`, `validate`, `approve`, `reload`, `list`
- ✅ Tool discovery: **`get_tool`** (NEW), **`search_tools`** (NEW)
- ✅ Skill management: `create_skill`, `get_skill`, `list_skills`, `validate_skill`
- ✅ Full MCP + LangChain agent integration

**HITL Enhancements** (v0.1.0 — NEW)
- ✅ `hitlTimeoutMs` / `hitl_timeout_ms` — Configurable approval timeout
- ✅ `approval_ttl_seconds` — Policy-level approval TTL
- ✅ Production fail-fast if HITL handler not provided

**Quality & Security** (v0.1.0 stable)
- ✅ **2996 total tests** (2001 TypeScript + 995 Python)
- ✅ **95%+ test coverage** (both SDKs)
- ✅ **Zero test pollution** (pytest-asyncio markers fixed)
- ✅ **5 critical security patches** applied
- ✅ **MCP 1.0 standards compliance**

**Python SDK** (v0.1.0 stable)
- ✅ 995 tests, 95%+ coverage
- ✅ Python 3.11+ (asyncio-based)
- ✅ `convert_tools_to_langchain()` — LangChain integration
- ✅ `convert_tools_to_crewai()` — CrewAI integration
- ✅ `create_mcp_server()` — MCP server support
- ✅ Decorator + Factory patterns with 40+ examples
- ✅ Complete type hints + documentation

**TypeScript SDK** (v0.1.0 stable)
- ✅ 2001 tests, 95%+ coverage (branches: 87%, functions: 97%, lines: 95%)
- ✅ Node.js 18+, 20+, 22+
- ✅ `convertToolsToLangChain()` — LangChain integration
- ✅ `MCPServer` — MCP stdio + HTTP server
- ✅ pnpm workspaces, Jest, TypeScript strict mode
- ✅ 40+ production examples

**See [RELEASES.md](./RELEASES.md)** for the complete changelog and migration guides across all releases.

---

## v0.1.1 — Next Patch Release

> **Theme:** Skills Meta-Tools & Agent Call Ability — Expose skills discovery and content loading as first-class agent-callable meta-tools

### Skills Meta-Tools (Planned)

- [ ] **`matimo_search_skills`** — Wrap `semanticSearchSkills()` as a meta-tool
  - Allows LangChain agents and MCP clients to semantic-search skills by natural language query
  - Backed by TF-IDF or custom embedding provider
  - Returns: `Array<{ name, description, relevanceScore }>`
  
- [ ] **`matimo_get_skill_sections`** — Expose `getSkillSections()` as a meta-tool
  - Enables agents to inventory a skill's sections and token costs before loading
  - Progressive disclosure Level 2.5
  - Returns: `Array<{ sectionName, tokenEstimate }>`
  
- [ ] **`matimo_get_skill_content`** — Expose `getSkillContent()` as a meta-tool
  - Allows agents to load only specific sections of a skill (token-efficient)
  - Replaces full-file loads with selective section retrieval
  - Returns: `{ skillName, content, tokensUsed }`

### Context Window Tooling (Planned)

- [ ] **Dynamic tool filtering** — When `autoDiscover` loads 146+ tools (at model API limits):
  - Provide utility: `selectToolsByProvider(tools, providers)` to filter by provider/tag
  - Prevents silent tool drops at API limit
  - Example: `selectToolsByProvider(allTools, ['slack', 'github'])` returns only those provider tools

---

## v0.2.0 — Future Minor Release

**Target**: Q3 2026 — Extended Provider Ecosystem

### Phase 1: Additional 3rd Party Tools

Expand provider ecosystem with real-world integrations:

- [x] **GitHub** — Repositories, issues, pull requests, releases (v0.1.0-alpha.8)
- [x] **HubSpot** — CRM, contacts, deals, tickets (v0.1.0-alpha.9)
- [x] **Notion** — Databases, pages, blocks (v0.1.0-alpha.10)
- [x] **Twilio** — SMS, MMS, messaging (v0.1.0-alpha.11)
- [x] **Mailchimp** — Email campaigns, subscribers, lists (v0.1.0-alpha.11)
- [x] **Bruno CLI** — API testing lifecycle (v0.1.0 stable) ✅
- [ ] **Stripe** — Payments, invoices, customers, subscriptions
- [ ] **Linear** — Issues, projects, milestones
- [ ] **Airtable** — Tables, records, views
- [ ] **Jira** — Issues, projects, workflows
- [ ] **AWS** — EC2, S3, Lambda, and core services
- [ ] **Azure** — VMs, Storage, Functions

**Acceptance Criteria**:

- Each provider has 5+ tools
- OAuth2 or API key authentication working
- Comprehensive examples for all patterns
- Unit tests for parameter validation
- Integration tests with mocked responses

### Priority 1: Python SDK ✅ SHIPPED (v0.1.0-alpha.14)

Full-featured Python implementation with feature parity — **delivered in v0.1.0-alpha.14**:

- [x] **Python Core SDK** — asyncio-based, Pydantic v2 models (`matimo-core 0.1.0a14`)
- [x] **YAML Tool Support** — Load same definitions as TypeScript SDK
- [x] **LangChain Integration** — `convert_tools_to_langchain()` → `StructuredTool` list
- [x] **CrewAI Integration** — `convert_tools_to_crewai()` → `BaseTool` list
- [x] **Decorator Pattern** — `@tool('name')` decorators for Python classes
- [x] **OAuth2 Handler** — Multi-provider authentication
- [x] **Provider Packages** — `matimo-slack`, `matimo-github`, `matimo-gmail`, etc. (10 providers)
- [x] **MCP Server** — `create_mcp_server()`, stdio + HTTP transport, Claude Desktop compatible
- [x] **Skills System** — `get_skills_metadata()`, `semantic_search_skills()`, `build_relevant_skill_prompt()`
- [x] **Policy Engine** — `DefaultPolicyEngine`, `classify_risk()`, `validate_tool_content()`, approval manifest
- [x] **Meta-Tools** — 10 agent-callable tools (`matimo_create_tool`, `matimo_validate_tool`, etc.)
- [x] **Advanced Examples** — 58 files: native (factory/decorator/advanced demos), LangChain, CrewAI
- [x] **657 tests** — 97.38% coverage (exceeds 95% requirement)
- [x] **Type hints throughout** — full mypy-compatible annotations
- [x] **Published on PyPI** — `pip install matimo` or `uv add matimo`

### Priority 3: MCP (Model Context Protocol) Server ✅ SHIPPED (v0.1.0-alpha.12)

Enable Claude and other MCP clients to use Matimo tools:

- [x] **MCP Server** — Dual-transport (stdio + Streamable HTTP) implementation (v0.1.0-alpha.12)
- [x] **Tool Discovery** — Expose all loaded tools via MCP protocol (v0.1.0-alpha.12)
- [x] **Tool Execution** — Execute tools through MCP interface with parameter templating (v0.1.0-alpha.12)
- [x] **Session Management** — Handle MCP client lifecycle with graceful shutdown (v0.1.0-alpha.12)
- [x] **Authentication** — Pluggable secret resolution (env, dotenv, Vault, AWS) + bearer token auth (v0.1.0-alpha.12)
- [x] **Claude Integration** — Works with Claude Desktop via `matimo mcp setup` command (v0.1.0-alpha.12)
- [x] **Comprehensive Examples** — Complete examples for stdio and HTTP transports (v0.1.0-alpha.12)
- [ ] **Docker Container** — MCP server in Docker for easy deployment (Future)

**Completed in v0.1.0-alpha.12**:

- Dual-transport MCP server (stdio for Claude Desktop, HTTP for remote)
- Pluggable secret resolution chain (env/dotenv/Vault/AWS)
- New CLI commands: `matimo mcp` and `matimo mcp setup`
- Full examples with LangChain integration
- Comprehensive MCP documentation
- Security fixes (ReDoS, TLS bypass, HTTP shutdown, flag validation, Zod ordering)

### Priority 4: Logging & Monitoring ✅ SHIPPED (v0.1.0-alpha.14)

- [x] **Structured Logging** — `setup_logger()`, `MatimoLogger`, Winston (TS) / stdlib logging (Python)
- [x] **Log Levels** — `debug | info | warn | error | silent` with env override (`MATIMO_LOG_LEVEL`)
- [x] **Log Formats** — Simple (development) and JSON (production) — `MATIMO_LOG_FORMAT`
- [x] **Global singleton** — `get_global_matimo_logger()` / `set_global_matimo_logger()` (both SDKs)
- [x] **Secret redaction** — Credentials never appear in logs

---

### Priority 5: Skills System ✅ SHIPPED (v0.1.0-alpha.13)

- [x] **Skill Registry** — SKILL.md-based skills loaded from `skill_paths`
- [x] **Built-in SDK Skills** — 6 core skills shipped with `@matimo/core` / `matimo-core`
- [x] **Provider skill bundles** — Each provider package ships a SKILL.md
- [x] **TF-IDF semantic search** — `semanticSearchSkills()` / `semantic_search_skills()`
- [x] **Progressive disclosure** — Level 1 (`getSkillsMetadata`) → Level 2 (`buildRelevantSkillPrompt`)
- [x] **Agent meta-tools** — `matimo_list_skills`, `matimo_get_skill`, `matimo_create_skill`, `matimo_validate_skill`
- [x] **MCP resource exposure** — Skills auto-registered as `skills://{name}` resources

---

## Future Phases (Post-v0.1.0) / Not sure Yet - but trying to be ambitious.

### Phase 2: Enterprise & DevOps (Q3-Q4 2026)

**REST API Server**

- [ ] HTTP API for tool execution
- [ ] Async job execution and webhooks
- [ ] OpenAPI/Swagger documentation
- [ ] Authentication and authorization
- [ ] Multi-tenant support

**Tool Marketplace**

- [ ] Distributed tool registry
- [ ] Tool publishing and versioning
- [ ] Community tool submissions
- [ ] Tool ratings and reviews
- [ ] Tool analytics and usage tracking

**Container & Orchestration**

- [ ] Docker images and containers
- [ ] Kubernetes Helm charts
- [ ] CloudRun/Lambda deployment templates
- [ ] CI/CD integration guides

### Phase 3: Ecosystem Maturity (2027+)

**Advanced Features**

- [ ] Schema auto-translation (OpenAPI ↔ Matimo YAML)
- [ ] Tool auto-generation from specifications
- [ ] Intelligent tool discovery and recommendations
- [ ] Enterprise audit logging and compliance
- [ ] Rate limiting and quota management

---

## Timeline Overview

```
Alpha Phase (✅ Completed — Feb-Apr 2026)
  v0.1.0-alpha.1  Feb 3, 2026
  v0.1.0-alpha.2  Feb 4, 2026
  v0.1.0-alpha.3  Feb 5, 2026
  v0.1.0-alpha.4  Feb 10, 2026
  v0.1.0-alpha.5  Feb 11, 2026
  v0.1.0-alpha.6  Feb 13, 2026
  v0.1.0-alpha.7  Feb 15, 2026  (Postgres tools)
  v0.1.0-alpha.8  Feb 18, 2026  (GitHub tools, unified approval)
  v0.1.0-alpha.9  Feb 19, 2026  (HubSpot tools)
  v0.1.0-alpha.10 Feb 21, 2026  (Notion tools)
  v0.1.0-alpha.11 Feb 27, 2026  (Twilio & Mailchimp tools)
  v0.1.0-alpha.12   Mar 11, 2026  (🚀 MCP Server — stdio + HTTP, secrets, Claude integration)
  v0.1.0-alpha.12.1 Mar 12, 2026  (🔑 Per-execution credential override, getRequiredCredentials(), Changesets release workflow)
  v0.1.0-alpha.13   Mar 22, 2026  (🧠 Skills system, policy engine, 10 meta-tools, HITL quarantine, security hardening)
  v0.1.0-alpha.14   Apr 10, 2026  (🐍 Python SDK — LangChain, CrewAI, MCP, 995 tests, 96.89% coverage)

v0.1.0 Stable Release (✅ Released — May 1, 2026)
  ✅ Production-Ready GA:
    - 137+ tools across 10 providers
    - Bruno CLI provider (7 new tools)
    - 2 new meta-tools (matimo_get_tool, matimo_search_tools)
    - HITL enhancements (timeout, TTL)
    - 2996 total tests passing (2001 TS + 995 Python)
    - 5 critical security patches
    - Full TypeScript + Python SDK parity
    - Comprehensive documentation and examples

v0.1.1 Patch Release (📅 Planned — Q3 2026)
  Priorities:
    - Skills meta-tools (matimo_search_skills, matimo_get_skill_sections, matimo_get_skill_content)
    - Dynamic tool filtering for context window management
    - Additional provider enhancements

  v0.1.0-rc.1     Late March 2026
  v0.1.0          March 2026 ← Stable Release

Post-Release (🎯 Future)
  Phase 2: Enterprise             Q3-Q4 2026
  Phase 3: Ecosystem Maturity     2027+
```

**Realistic Estimate**:

- **3-4 weeks per priority** depending on scope
- v0.1.0 stable release: **~6 weeks from now** (Late-March 2026)
- Total from alpha.1 to v0.1.0: ~8 weeks in rapid iteration

---

---

## How to Contribute

We welcome contributions at any level!

- **Report Issues**: [GitHub Issues](https://github.com/tallclub/matimo/issues)
- **Feature Requests**: [GitHub Discussions](https://github.com/tallclub/matimo/discussions)
- **Submit Code**: [Contributing Guide](../CONTRIBUTING.md)
- **Suggest Tools**: Propose new provider integrations you need
- **Documentation**: Help improve guides and examples
- **Testing**: Help test features and report edge cases

---

## Questions & Feedback

- **Technical Questions**: [GitHub Discussions](https://github.com/tallclub/matimo/discussions)
- **Report Bugs**: [GitHub Issues](https://github.com/tallclub/matimo/issues)
- **Feature Ideas**: [GitHub Discussions - Ideas](https://github.com/tallclub/matimo/discussions/categories/ideas)
- **Contact**: Visit [tallclub/matimo](https://github.com/tallclub/matimo)

### ✅ Core Features Implemented

**Unified Core Tools Architecture**

- **Function-based execution model** for all core tools (no subprocess spawning)
- Eliminated `tsx` PATH dependency
- All core tools use direct async function calls for better performance
- Native exception throwing and error handling

**Expanded Core Tools Suite**

- `execute` — Shell command execution with timeout, cwd, and environment control
- `read` — File reading with line range support and encoding detection
- `edit` — File editing/replacement with backup support
- `search` — File pattern searching with grep and context display
- `web` — Web content fetching and parsing
- `calculator` — Refactored to function-type for consistency

**Execution Models**

- Function-type tools (direct calls, recommended for SDK)
- Command-type tools (still supported for external commands)
- HTTP tools (powered by HttpExecutor with OAuth2)
- Unified dispatcher for all execution types

**Schema & Tool Loading**

- Enhanced ToolDefinitionSchema with better validation
- Default parameter support in YAML definitions
- Improved tool caching for faster discovery
- Provider auto-discovery with efficient lookup
- Stricter schema validation (removed passthrough)

**Examples & Integration Patterns**

- Complete examples for all 6 core tools
- Factory pattern examples (direct execution)
- Decorator pattern examples (class-based @tool)
- LangChain pattern examples (AI agent integration)
- All patterns tested and working

**Quality & Reliability**

- 625+ test suite with 100% pass rate
- Comprehensive unit tests for all core tools
- Build and lint issues resolved
- Full TypeScript strict mode
- Zero external command dependencies

**Developer Experience**

- Cleaner tool structure under `packages/core/tools/`
- commitlint support for 'example' commit type
- Simplified error handling patterns
- Better debugging with native exceptions

---

## How to Use This Roadmap

- **Current Version**: v0.1.0-alpha.13 (March 22, 2026)
- **Future Releases**: See sections above for planned features
- **Past Releases**: See [RELEASES.md](./RELEASES.md) for detailed release notes for all previous versions
- **Contributing**: See [CONTRIBUTING.md](https://github.com/tallclub/matimo/blob/main/CONTRIBUTING.md) for how to help

---

## Contributing to the Roadmap

Have ideas? [Open a GitHub Discussion](https://github.com/tallclub/matimo/discussions) to propose features for future releases.
