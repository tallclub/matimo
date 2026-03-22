# Matimo Roadmap

## Current Status

**Latest Release**: v0.1.0-alpha.13 (March 22, 2026)

✅ **Completed Features**:

- OAuth2 authentication with multi-provider support
- Tool execution (function, command, and HTTP types)
- YAML-based tool definitions with Zod validation
- SDK patterns (Factory, Decorator, LangChain)
- Core tools suite (execute, read, edit, search, web, calculator)
- Provider integrations (Slack with 16+ tools, Gmail with 5 tools, GitHub, HubSpot with 50+ tools, Notion with 7 tools)
- CLI tool management (list, search, install, help)
- 1,884 comprehensive tests passing across 96 suites with consistent coverage targets
- Complete documentation and examples
- Structured error handling with MatimoError and error chaining
- Enhanced HTTP executor with parameter embedding (objects, arrays)
- MCP Server (dual-transport stdio + HTTP, pluggable secrets, Claude Desktop integration)
- **Per-execution credential override** — multi-tenant `options.credentials` on `execute()`
- **`getRequiredCredentials()`** — DX helper to discover required credential keys per tool
- Package-level release workflow via Changesets
- **Skills System** — First-class skill discovery, semantic search (`semanticSearchSkills`), section loading
- **Policy Engine** — Risk classification, approval tiers, policy-as-YAML, atomic hot-reload
- **Meta-tools** — Tool lifecycle management (create, validate, approve, reload, list, describe)
- **CLI enhancements** — `matimo doctor`, `matimo review`, comprehensive diagnostics
- **Security hardening** — 20 vulnerability fixes, ReDoS prevention, sensitive data protection

**See [RELEASES.md](./RELEASES.md)** for detailed release notes on completed features.

---

## v0.1.0-alpha.14 — Next Release (Skills SDK as Agent Callable Tools)

> **Theme:** Promote the skills SDK APIs to first-class agent-callable meta-tools, and demonstrate all skills capabilities in examples. Currently `semanticSearchSkills`, `getSkillSections`, and `getSkillContent` are SDK-only — agents (LangChain, MCP) cannot call them. This release closes that gap.

### Skills Meta-Tools (New)

- [ ] **`matimo_search_skills`** — Wrap `semanticSearchSkills()` as a meta-tool so LangChain agents and MCP clients can semantic-search skills by natural language query (backed by TF-IDF or custom embedding provider)
- [ ] **`matimo_get_skill_sections`** — Expose `getSkillSections()` as a meta-tool so agents can inventory a skill's sections and token costs before loading (progressive disclosure Level 2.5)
- [ ] **`matimo_get_skill_content`** — Expose `getSkillContent()` as a meta-tool so agents can load only specific sections of a skill rather than the full SKILL.md (token-efficient context loading)

### Skills Example Coverage

- [x] **`skills-demo.ts` — Non-MCP progressive disclosure** — Implemented `getSkillsMetadata` (Level 1), `semanticSearchSkills()` (raw TF-IDF scores per skill), and `buildRelevantSkillPrompt` (Level 2 via TF-IDF) demonstrated in Phase 4 of the skills demo
  - `getSkillsMetadata(matimo)` → names + descriptions only (token-safe)
  - `matimo.semanticSearchSkills(query, { limit, minScore })` → raw TF-IDF ranked results with per-skill scores printed
  - `buildRelevantSkillPrompt(matimo, query, { topK, minScore })` → TF-IDF semantic search → load only relevant skill content
  - Both helpers exported from `matimo` and documented in `docs/framework-integrations/LANGCHAIN.md`
  - ⚠️ Still needed: `matimo.getSkillSections(name)`, `matimo.getSkillContent(name, { sections })`, `matimo.setSkillEmbeddingProvider(provider)` demo
- [ ] **`langchain-skills-policy-agent.ts`** — Update system prompt to mention `matimo_search_skills` so agents can find skills by meaning, not just by exact name

### Context Window Tooling

- [ ] **Dynamic tool filtering** — When `autoDiscover` loads 128+ tools (at OpenAI's hard limit), provide a utility to select a subset by provider/tag before binding to LangChain — prevents silent tool drops at the API limit


### Acceptance Criteria

- `matimo_search_skills`, `matimo_get_skill_sections`, `matimo_get_skill_content` registered as meta-tools in `packages/core/tools/`
- Agent in `pnpm agent:skills` can call `matimo_search_skills` with a natural language query and get ranked results
- `skills-demo.ts` Phase 4 executes without errors and prints TF-IDF scores
- All new meta-tools have tests in `packages/core/test/unit/meta-tools/`
- Docs updated: `META_TOOLS.md` reference entries for 3 new tools

---

## v0.1.0 Roadmap

**Target**: March 2026


### Vercel AI 
- Convert tools to vercelAI tools
- Implement Examples

### Priority 1: More 3rd Party Tools

Expand provider ecosystem with real-world integrations:

- [x] **GitHub** — Repositories, issues, pull requests, releases (v0.1.0-alpha.8)
- [ ] **Stripe** — Payments, invoices, customers, subscriptions
- [x] **HubSpot** — CRM, contacts, deals, tickets (v0.1.0-alpha.9)
- [ ] **Linear** — Issues, projects, milestones
- [x] **Notion** — Databases, pages, blocks (v0.1.0-alpha.10)
- [x] **Twilio** — SMS, MMS, messaging (v0.1.0-alpha.11)
- [x] **Mailchimp** — Email campaigns, subscribers, lists (v0.1.0-alpha.11)
- [ ] **Airtable** — Tables, records, views
- [ ] **Jira** — Issues, projects, workflows
- [ ] **AWS** — EC2, S3, Lambda, and core services
- [ ] **Azure** — VMs, Storage, Functions
- [ ] **Bruno CLI** - Bruno CLI as native matimo tool for agent to call api and test

**Acceptance Criteria**:

- Each provider has 5+ tools
- OAuth2 or API key authentication working
- Comprehensive examples for all patterns
- Unit tests for parameter validation
- Integration tests with mocked responses

### Priority 1: Python SDK
### Python SDK
- Matimo python Version
- CrewAI support
- Implement Examples

Full-featured Python implementation with feature parity:

- [ ] **Python Core SDK** — Same tool execution patterns
- [ ] **YAML Tool Support** — Load same definitions as Node.js SDK
- [ ] **LangChain Integration** — Works with Python LangChain agents
- [ ] **Decorator Pattern** — @tool decorators for Python classes
- [ ] **OAuth2 Handler** — Multi-provider authentication
- [ ] **Provider Packages** — `@matimo/slack-py`, `@matimo/gmail-py`, etc.
- [ ] **CLI Tool** — `matimo list`, `matimo search` in Python
- [ ] **Type Hints** — Full type safety with mypy support

**Acceptance Criteria**:

- Package published on PyPI
- Installation via `pip install matimo`
- Works with Python 3.8+
- 80%+ test coverage
- Full documentation with examples

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

### Priority 4: Logging & Monitoring

Production-ready observability:

- [ ] **Structured Logging** — Log all tool executions with context
- [ ] **Log Levels** — DEBUG, INFO, WARN, ERROR with filtering
- [ ] **Log Outputs** — Console, file, and remote logging
- [ ] **Metrics Collection** — Execution time, success rate, errors
- [ ] **Performance Monitoring** — Track slow tool executions
- [ ] **Error Tracking** — Detailed error logs with stack traces
- [ ] **Health Checks** — Monitor API endpoint availability
- [ ] **Audit Trail** — Log who ran what tool and when

**Acceptance Criteria**:

- Structured JSON logs for easy parsing
- Integration with common logging services (DataDog, New Relic, etc.)
- Configurable log levels
- Performance metrics dashboard-ready format
- Admin command for viewing logs

### Priority 5: Skills (Native to Matimo)

- [ ] **Skill Registry** — Store and reuse skills across projects
- [ ] **Skill Examples** — Pre-built skills for common tasks
- [ ] **Skill Versioning** — Multiple versions per skill

**Example Skills**:

- Process customer support tickets (GitHub → Slack → Email)
- Sync data between systems (Stripe → Hubspot → Airtable)
- Monitor and alert on metrics (AWS → Datadog → Slack)

**Acceptance Criteria**:

- Skill definition format (markdown)
- Skill execution engine working correctly
- Error recovery on tool failures
- Documented skill specification
- 10+ example skills included

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
Alpha Phase (✅ Completed)
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
  v0.1.0-alpha.13   Mar 22, 2026  (🧠 Skills system, policy engine, 10 meta-tools, HITL quarantine, security hardening) ← Current
  v0.1.0-alpha.14   TBD           (🔍 Skills SDK as agent-callable tools — matimo_search_skills, matimo_get_skill_sections, matimo_get_skill_content, dynamic tool filtering)

v0.1.0 Release (📅 Late March 2026)
  ✅ Completed:
    - MCP Server (dual-transport, pluggable secrets)
    - Claude Desktop integration
    - Comprehensive MCP examples & docs
    - Security fixes (CodeQL)
  
  Remaining priorities:
    1. More 3rd party tools     (Stripe, Airtable, etc.)     March 2026
    2. Python SDK               March-April 2026
    3. Logging & Monitoring     April 2026
    4. Skills/Workflows         April-May 2026
    5. Changeset-driven package releases (in progress)

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
