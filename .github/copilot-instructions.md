# Copilot Instructions for Matimo

## 30-Second Summary

**Matimo** is a configuration-driven AI tools SDK. Define tools **once in YAML** and execute them from:
- **TypeScript SDK** (`MatimoInstance.init()` → `execute()`) — factory, decorator, LangChain, MCP patterns
- **Python SDK** (`Matimo.init()` → `execute()`) — factory, decorator, LangChain, CrewAI, MCP patterns
- **10 provider packages** — Slack, GitHub, Gmail, Notion, Postgres, Twilio, HubSpot, Mailchimp (TS + Python)

**The big idea:** Write YAML once, use everywhere — across frameworks, languages, and agent runtimes.

---

## Monorepo Structure

```
matimo/
├── typescript/          # TypeScript SDK (pnpm workspaces)
│   ├── packages/core/   # Core SDK: MatimoInstance, executors, policy, MCP, skills
│   ├── packages/cli/    # CLI: validate, install, doctor, search, review, mcp
│   ├── packages/slack/  # Slack provider tools
│   ├── packages/github/ # GitHub provider tools
│   ├── packages/gmail/  # Gmail provider tools
│   ├── packages/notion/ # Notion provider tools
│   ├── packages/postgres/
│   ├── packages/twilio/
│   ├── packages/hubspot/
│   └── packages/mailchimp/
├── python/              # Python SDK (uv workspaces)
│   ├── packages/core/   # Core SDK: Matimo, executors, policy, MCP, skills
│   ├── packages/cli/    # CLI (Python)
│   ├── packages/slack/  # Slack provider tools
│   ├── packages/github/
│   ├── packages/gmail/
│   ├── packages/notion/
│   ├── packages/postgres/
│   ├── packages/twilio/
│   ├── packages/hubspot/
│   ├── packages/mailchimp/
│   └── examples/        # native/, langchain/, crewai/ usage patterns
│       └── mcp/         # HTTP MCP server (port 3101) — exposes all tools via JSON-RPC
├── docs/                # GitHub Pages documentation (matimo.dev/docs)
│   └── mcp/             # MCP setup & developer guides (SETUP_GUIDE, QUICK_REFERENCE, etc.)
├── landing-page/        # Marketing site (matimo.dev)
└── .github/
    ├── copilot-instructions.md  # This file
    ├── agents/          # VS Code Copilot agent definitions
    │   ├── matimo-tool-creator.agent.md           # Original tool creator agent
    │   └── matimo-tool-creator-refactored.agent.md # Lean orchestrator (200 lines)
    ├── skills/          # Reusable skill files for agents
    │   ├── matimo-provider-creation/SKILL.md      # Bilingual TS+Python provider patterns (400+ lines)
    │   ├── matimo-tool-generator/SKILL.md          # Self-maintenance patterns (220 lines)
    │   └── tool-creation/SKILL.md                 # General tool creation guidance
    └── workflows/       # GitHub Actions CI/CD
```

---

## Architecture Overview

### Layered Stack (same for TypeScript and Python)

```
┌──────────────────────────────────────────────────────────────────┐
│  Application Layer: Your Agent / Framework                       │
│  LangChain · CrewAI · MCP · decorator pattern · factory pattern │
└────────────────────────┬─────────────────────────────────────────┘
                         │ matimo.execute(toolName, params)
┌────────────────────────▼─────────────────────────────────────────┐
│  Core SDK Layer: MatimoInstance (TS) / Matimo (Python)           │
│  ToolLoader → ToolRegistry → Execute dispatcher                  │
│  PolicyEngine → approval / HITL / risk classification            │
│  SkillRegistry → semantic search over skills                     │
└────────────────────────┬─────────────────────────────────────────┘
                         │ routes by execution.type
┌────────────────────────▼─────────────────────────────────────────┐
│  Execution Layer                                                  │
│  CommandExecutor · HttpExecutor · FunctionExecutor               │
└────────────────────────┬─────────────────────────────────────────┘
                         │
┌────────────────────────▼─────────────────────────────────────────┐
│  Tool Definition Layer: YAML files                               │
│  packages/{provider}/tools/{tool-name}/definition.yaml           │
└──────────────────────────────────────────────────────────────────┘
```

---

## Key Modules — TypeScript (`typescript/packages/core/src/`)

| Module | Purpose |
|--------|---------|
| `matimo-instance.ts` | `MatimoInstance` — single entry point; `init()`, `execute()`, `reload()`, `listTools()`, `searchTools()` |
| `core/tool-loader.ts` | Parse YAML → `ToolDefinition[]`, Zod validation |
| `core/tool-registry.ts` | In-memory `Map<name, ToolDefinition>` |
| `core/skill-loader.ts` | Load `.md` skill files with YAML frontmatter |
| `core/skill-registry.ts` | `SkillRegistry` — search, semantic search (TF-IDF) |
| `core/tfidf-embedding.ts` | TF-IDF embedding provider |
| `core/schema.ts` | Zod schemas for all YAML contracts |
| `executors/command-executor.ts` | Spawn processes, template args |
| `executors/http-executor.ts` | HTTP requests, response validation |
| `executors/function-executor.ts` | Execute JS/TS functions |
| `decorators/tool-decorator.ts` | `@tool('name')` class decorator |
| `integrations/langchain.ts` | Convert tools to LangChain `StructuredTool` |
| `auth/oauth2-handler.ts` | Provider-agnostic OAuth2 flows |
| `auth/oauth2-provider-loader.ts` | Load OAuth2 provider configs from YAML |
| `policy/types.ts` | `PolicyDecision`, `RiskLevel`, `PolicyTier`, HITL types, event types |
| `policy/default-policy.ts` | `DefaultPolicyEngine` — allow/deny/quarantine |
| `policy/risk-classifier.ts` | `classifyRisk()` — assigns risk level to tools |
| `policy/content-validator.ts` | Pattern-based content violation detection |
| `policy/integrity-tracker.ts` | Hash-based tamper detection |
| `policy/approval-manifest.ts` | `ApprovalManifest` — persisted approval records |
| `policy/policy-loader.ts` | Load policy config from YAML |
| `approval/approval-handler.ts` | `ApprovalHandler` — HITL workflow management |
| `mcp/mcp-server.ts` | `MCPServer` — serve tools over MCP (Claude, etc.) |
| `mcp/tool-converter.ts` | Convert `ToolDefinition` → MCP tool schema |
| `mcp/secrets/` | `EnvResolver`, `DotenvResolver`, `VaultResolver`, `AwsResolver`, `ResolverChain` |
| `logging/logger.ts` | `MatimoLogger` interface |
| `logging/winston-logger.ts` | Winston-backed logger with JSON/simple formats |
| `errors/matimo-error.ts` | `MatimoError` + `ErrorCode` enum |
| `encodings/parameter-encoding.ts` | `applyParameterEncodings()` — json/base64/csv |

---

## Key Modules — Python (`python/packages/core/src/matimo/`)

| Module | Purpose |
|--------|---------|
| `instance.py` | `Matimo` — `init()`, `execute()`, `reload()`, `list_tools()`, `search_tools()`, `get_tools_for_agent()` |
| `core/loader.py` | `ToolLoader` — parse YAML → `ToolDefinition` (Pydantic v2) |
| `core/registry.py` | `ToolRegistry` — in-memory store |
| `core/models.py` | All Pydantic v2 models: `ToolDefinition`, `Parameter`, `ExecutionResult`, `InitOptions`, etc. |
| `core/skill_loader.py` | `SkillLoader` — load `.md` skill files |
| `core/skill_registry.py` | `SkillRegistry` — search, async semantic search |
| `core/skill_content_parser.py` | Parse skill markdown sections |
| `core/tfidf_embedding.py` | TF-IDF embedding provider |
| `executors/command_executor.py` | Spawn subprocesses, template args |
| `executors/http_executor.py` | `httpx`-based HTTP executor |
| `executors/function_executor.py` | Execute Python callables; `.ts`→`.py` sibling fallback |
| `decorators/__init__.py` | `@tool('name')` decorator, `set_global_matimo_instance()` |
| `integrations/langchain.py` | `convert_tools_to_langchain()` → `StructuredTool` list |
| `integrations/crewai.py` | `convert_tools_to_crewai()` → `BaseTool` list |
| `auth/injection.py` | `inject_auth_parameters()`, `extract_parameter_placeholders()` |
| `auth/oauth2_handler.py` | `OAuth2Handler` — provider-agnostic OAuth2 |
| `auth/oauth2_config.py` | `OAuth2Config`, `OAuth2Token`, `TokenResponse` |
| `auth/oauth2_provider_loader.py` | `OAuth2ProviderLoader` |
| `policy/types.py` | `PolicyDecision`, `RiskLevel`, `PolicyTier`, `MatimoEvent`, HITL types |
| `policy/default_policy.py` | `DefaultPolicyEngine`, `PolicyEngine` ABC |
| `policy/risk_classifier.py` | `classify_risk()` |
| `policy/content_validator.py` | `validate_tool_content()`, `ContentViolation` |
| `policy/integrity_tracker.py` | `ToolIntegrityTracker` — hash-based tamper detection |
| `policy/approval_manifest.py` | `ApprovalManifest`, `ApprovalRecord` |
| `policy/policy_loader.py` | `load_policy_from_file()` |
| `approval/handler.py` | `ApprovalHandler` — HITL workflow |
| `mcp/server.py` | `MCPServer`, `MCPServerOptions`, `create_mcp_server()` |
| `mcp/tool_converter.py` | `convert_parameters_to_mcp_schema()` |
| `mcp/secrets/__init__.py` | `EnvSecretResolver`, `DotenvSecretResolver`, `VaultSecretResolver`, `AwsSecretsManagerResolver`, `SecretResolverChain`, `create_resolver_chain()` |
| `logging/__init__.py` | `MatimoLogger`, `setup_logger()`, `get_global_matimo_logger()` |
| `errors.py` | `MatimoError`, `ErrorCode`, helper factories |
| `encodings/parameter_encoding.py` | `apply_parameter_encodings()` |

---

## Build & Test Commands

### TypeScript (run from `typescript/`)
```bash
pnpm install           # Install all workspace dependencies
pnpm build             # Compile TypeScript → dist/
pnpm test              # Run all 1884 Jest tests
pnpm test:watch        # Watch mode for TDD
pnpm test:coverage     # Coverage — must meet 95%+ thresholds
pnpm lint              # ESLint
pnpm lint:fix          # Auto-fix lint
pnpm format            # Prettier
pnpm format:check      # Check formatting (used in pre-commit)
pnpm validate-tools    # Validate all YAML tool definitions
pnpm cli <command>     # CLI: validate | install | doctor | search | review | mcp
```

### Python (run from `python/`)
```bash
uv sync                                          # Install all workspace dependencies
uv run -w . ruff check packages/                # Lint (runs in pre-commit hook)
uv run -w . ruff check packages/ --fix          # Auto-fix
uv run -w . ruff check packages/ --unsafe-fixes # Fix everything possible
uv run pytest packages/core/tests/              # Run all 160 tests
uv run pytest packages/core/tests/ \
  --cov=packages/core/src/matimo \
  --cov-report=term-missing                     # Coverage report — target 95%+
```

### Pre-commit Hook (Husky, both SDKs)
- **TypeScript**: `pnpm lint && pnpm format:check`
- **Python**: `uv run -w . ruff check packages/`
- Never skip: `git commit --no-verify` only in genuine emergencies

---

## Code Quality & Testing Standards

### Coverage Target: **95%+ for both TypeScript and Python**

**TypeScript** — enforced via `jest.config.cjs` `coverageThreshold`:
```javascript
branches: 87, functions: 97, lines: 95, statements: 95
```
Run `pnpm test:coverage` — CI fails if thresholds not met.

**Python** — enforced via `pyproject.toml`:
```toml
[tool.coverage.report]
fail_under = 95   # target — raise to 95 once gaps are closed
```
Run `uv run pytest --cov=packages/core/src/matimo --cov-report=term-missing`.

**Python modules currently below 95% — need tests, not ignores:**
- `core/skill_content_parser.py` (15%), `core/skill_loader.py` (16%), `core/skill_registry.py` (25%)
- `core/tfidf_embedding.py` (30%), `mcp/tool_converter.py` (14%), `mcp/secrets/` (27%)
- `auth/oauth2_handler.py` (29%), `auth/oauth2_provider_loader.py` (33%)
- `policy/approval_manifest.py` (36%), `policy/policy_loader.py` (35%)
- `decorators/__init__.py` (26%), `mcp/server.py` (31%)

### TypeScript Test Organisation
```
packages/core/test/
├── unit/          # Per-class tests — describe/it/expect, Jest mocks
├── integration/   # YAML → load → execute → validate end-to-end flows
└── fixtures/      # Real YAML definitions consumed by tests
```

### Python Test Organisation
```
packages/core/tests/
├── conftest.py            # Shared fixtures (ToolDefinition, Matimo instance)
├── unit/                  # Per-module pytest tests with asyncio
│   ├── test_instance.py · test_loader.py · test_registry.py · test_models.py
│   ├── test_http_executor.py · test_command_executor.py · test_function_executor.py
│   ├── test_langchain.py · test_crewai.py
│   ├── test_policy.py · test_approval.py · test_auth_injection.py
│   └── test_encodings.py
└── integration/
    └── test_instance_integration.py
```

### Python Test Patterns
```python
import pytest
from matimo import Matimo

@pytest.mark.asyncio
async def test_execute_tool(matimo_instance: Matimo) -> None:
    result = await matimo_instance.execute("my_tool", {"param": "value"})
    assert result["ok"] is True

# HTTP mocking with respx
import respx, httpx

@respx.mock
async def test_http_executor(http_tool: ToolDefinition) -> None:
    respx.post("https://api.example.com/endpoint").mock(
        return_value=httpx.Response(200, json={"ok": True})
    )
    # ... test body
```

### TypeScript Test Patterns
```typescript
describe('CommandExecutor', () => {
  let executor: CommandExecutor;
  beforeEach(() => { executor = new CommandExecutor(); });

  it('should template parameters into args', async () => {
    const tool = buildToolDef({ args: ['--channel', '{channel}'] });
    const result = await executor.execute(tool, { channel: '#general' });
    expect(result.success).toBe(true);
  });
});
```

### Python Linting (ruff)
Config in `python/packages/core/pyproject.toml`:
```toml
[tool.ruff.lint]
select = ["E", "F", "I", "UP", "B", "S", "ANN"]
ignore = ["ANN101", "ANN102", "S603", "S607"]

[tool.ruff.lint.per-file-ignores]
"tests/**" = ["S101", "S105", "S106"]
```

Key rules:
- **ANN** — all public functions must have type annotations; use `object` not `Any` where possible
- **S** — no hardcoded secrets, no subprocess shell injection
- **UP** — modern Python syntax (`X | Y` not `Union[X, Y]`, `X | None` not `Optional[X]`)
- **ANN401** — add `# noqa: ANN401` **with a comment explaining why** `Any` is genuinely needed

Justified `# noqa: ANN401` cases (never suppress without written reason):
- Pydantic `@model_validator(mode="before")` input (pydantic passes raw data)
- `execute()` / `_dispatch()` return types (tool results are arbitrary JSON values)
- Optional-dep return types (`langchain-core`, `crewai`, `mcp` not guaranteed installed)

### TypeScript Type Safety
- **No `any`** — ESLint warns; use `unknown` or specific types
- **Strict mode** — `tsconfig.json` `strict: true`
- **Zod** for all YAML/JSON runtime validation; never trust raw input
- **Discriminated unions** — `{ type: 'command', command: string }` pattern

### Logging
**TypeScript**: Winston via `getGlobalMatimoLogger()` / `setGlobalMatimoLogger()`
**Python**: `MatimoLogger` wrapping stdlib `logging` via `get_global_matimo_logger()` / `set_global_matimo_logger()`
- Levels: `silent | error | warn | info | debug` — env: `MATIMO_LOG_LEVEL`
- Format: JSON (production) / simple (dev) — env: `MATIMO_LOG_FORMAT`
- **Never** log secrets; **never** use `console.log` / `print` in core SDK packages

### Error Handling
```typescript
// TypeScript
throw new MatimoError('Tool execution failed', ErrorCode.EXECUTION_FAILED, {
  toolName: 'slack_post',
  details: { statusCode: 500 },
});
```
```python
# Python
raise MatimoError("Tool execution failed", ErrorCode.EXECUTION_FAILED, details={"tool": name})
```

---

## Core SDK Patterns

### Factory Pattern (Simplest)

**TypeScript:**
```typescript
const matimo = await MatimoInstance.init('./tools');
const result = await matimo.execute('slack_send_channel_message', { channel: '#general', text: 'Hello' });
const tools = matimo.listTools();
const found = matimo.searchTools('slack');
```

**Python:**
```python
from matimo import Matimo

matimo = await Matimo.init('./tools')
result = await matimo.execute('slack_send_channel_message', {'channel': '#general', 'text': 'Hello'})
tools = matimo.list_tools()
found = matimo.search_tools('slack')
```

### Decorator Pattern

**TypeScript:**
```typescript
setGlobalMatimoInstance(matimo);
class MyAgent {
  @tool('slack_send_channel_message')
  async sendMessage(channel: string, text: string) { /* auto-executed */ }
}
```

**Python:**
```python
from matimo import tool, set_global_matimo_instance
set_global_matimo_instance(matimo)

class MyAgent:
    @tool('slack_send_channel_message')
    async def send_message(self, channel: str, text: str): ...  # auto-executed
```

### LangChain Integration

**TypeScript:**
```typescript
import { convertToolsToLangChain } from 'matimo';
const tools = convertToolsToLangChain(matimo.listTools(), matimo);
```

**Python:**
```python
from matimo import Matimo, convert_tools_to_langchain
tools = convert_tools_to_langchain(matimo.list_tools(), matimo)
```

### CrewAI Integration (Python only)
```python
from matimo import Matimo, convert_tools_to_crewai
tools = convert_tools_to_crewai(matimo.list_tools(), matimo)
```

### MCP Server (serve tools to Claude or any MCP client)

**TypeScript:**
```typescript
const server = new MCPServer(matimo, { name: 'my-agent', version: '1.0.0' });
await server.start(); // stdio or HTTP transport
```

**Python:**
```python
from matimo import create_mcp_server, MCPServerOptions
server = await create_mcp_server(matimo, MCPServerOptions(name='my-agent', version='1.0.0'))
await server.start()
```

### Policy, Risk & HITL

**TypeScript:**
```typescript
const matimo = await MatimoInstance.init('./tools', {
  policyFile: './policy.yaml',
  onEvent: (event) => logger.info(event.type, event),
  onHitl: async (request) => ({ approved: true, reason: 'reviewed' }),
});
```

**Python:**
```python
from matimo import Matimo, InitOptions

matimo = await Matimo.init('./tools', InitOptions(
    policy_file='./policy.yaml',
    on_event=lambda event: logger.info(event),
    on_hitl=my_async_approval_callback,
))
```

Policy tiers: `low` / `medium` / `high` / `critical`
Risk levels: `low` / `medium` / `high` / `critical`
Decisions: `PolicyAllowed` / `PolicyDenied` / `PolicyPendingApproval`

### Secrets Management (resolver chain)

**TypeScript:**
```typescript
const resolver = new SecretResolverChain([
  new EnvSecretResolver(),
  new DotenvSecretResolver('.env'),
  new VaultSecretResolver({ address: 'http://vault:8200', token: process.env.VAULT_TOKEN }),
  new AwsSecretsManagerResolver({ region: 'us-east-1' }),
]);
const apiKey = await resolver.resolve('SLACK_BOT_TOKEN');
```

**Python:**
```python
from matimo import create_resolver_chain
resolver = create_resolver_chain([
    {'type': 'env'},
    {'type': 'dotenv', 'path': '.env'},
    {'type': 'vault', 'address': 'http://vault:8200'},
    {'type': 'aws', 'region': 'us-east-1'},
])
api_key = await resolver.resolve('SLACK_BOT_TOKEN')
```

### Skills (context injection for agents)

**TypeScript:**
```typescript
const matimo = await MatimoInstance.init('./tools', { skillPaths: ['./skills'] });
const skills = matimo.listSkills();
const results = await matimo.searchSkills({ query: 'sending messages' });
const content = matimo.getSkillContent('slack-messaging', { sections: ['examples'] });
```

**Python:**
```python
matimo = await Matimo.init('./tools', InitOptions(skill_paths=['./skills']))
skills = matimo.list_tools()   # skills exposed as tools
results = await matimo.search_tools('sending messages')
```

---

## Tool & Parameter Naming Conventions

### Tool Names — `{provider}_{action}` snake_case

All tools (provider and meta) use **snake_case with underscores**. Kebab-case variants (`slack-send-message`) exist only in legacy files and must not be used for new tools.

| Pattern | Example |
|---------|---------|
| `{provider}_{action}` | `slack_send_channel_message`, `github_create_issue` |
| `{provider}_{resource}_{action}` | `slack_get_channel_history`, `notion_create_page` |
| `matimo_{action}` (meta-tools) | `matimo_create_tool`, `matimo_reload_tools` |

### Parameter Names — simple lowercase

Parameter names are **simple lowercase** — no prefix, no underscores. Match the provider API's natural semantics:

```yaml
parameters:
  channel:       # ✅ NOT channel_id or channelName
    type: string
  text:          # ✅ NOT message_text
    type: string
  owner:         # ✅ NOT repo_owner
    type: string
```

### Template Substitution — `{paramName}`

Parameters are referenced in `execution` using `{paramName}` syntax in URLs, headers, and body:

```yaml
execution:
  type: http
  method: POST
  url: 'https://api.github.com/repos/{owner}/{repo}/issues'
  headers:
    Authorization: 'Bearer {GITHUB_TOKEN}'   # env var — ALL_CAPS
  body:
    title: '{title}'
    body: '{body}'
```

**Rules:**
- `{UPPER_CASE}` — resolved from environment / secrets chain (never hardcode)
- `{lower_case}` — resolved from call-time parameters
- `{paramName}` substitution applies in: `url`, `args`, `body`, `headers`

---

## Meta-Tools (Self-Maintenance)

Matimo ships **10 built-in meta-tools** (`matimo_*`) that agents use to create and manage tools at runtime. These exist in both SDKs with identical names.

| Tool | Purpose |
|------|---------|
| `matimo_create_tool` | Write new tool YAML to disk (created as `status: draft`) |
| `matimo_validate_tool` | Validate YAML schema without writing to disk |
| `matimo_approve_tool` | Promote a draft tool to `stable` (HMAC signed) |
| `matimo_reload_tools` | Hot-reload tool registry from all configured `toolPaths` |
| `matimo_list_user_tools` | List user-created tools (not auto-discovered provider tools) |
| `matimo_get_tool_status` | Get detailed status of a specific tool |
| `matimo_create_skill` | Create a new skill `.md` file with YAML frontmatter |
| `matimo_validate_skill` | Validate a skill definition without creating it |
| `matimo_get_skill` | Retrieve a skill by name |
| `matimo_list_skills` | List all available skills |

**Usage example (the self-maintenance loop):**

```python
# Python — agent creates and immediately uses a new tool
result = await matimo.execute('matimo_create_tool', {
    'name': 'stripe_list_customers',
    'definition': yaml_content,   # YAML string
    'target_dir': './tools/user'
})
await matimo.execute('matimo_reload_tools')        # hot-reload registry
customers = await matimo.execute('stripe_list_customers', {'limit': 10})
```

```typescript
// TypeScript — same pattern
await matimo.execute('matimo_create_tool', { name, definition, target_dir });
await matimo.execute('matimo_reload_tools');
const result = await matimo.execute('stripe_list_customers', { limit: 10 });
```

> **⚠️ Draft gate:** `matimo_create_tool` always creates tools with `status: draft`. The default policy blocks draft tools. Call `matimo_approve_tool` before executing user-created tools in production.

---

## Agent & Skill System

Matimo uses its own MCP server to self-maintain — agents create new tools by calling Matimo tools via MCP.

### MCP Server (port 3101)

```bash
# Start the HTTP MCP server (exposes all 128+ tools via JSON-RPC)
cd python/examples/mcp
uv run python src/server_http.py
# Configurable: MATIMO_SERVER_PORT, MATIMO_EXTRA_TOOLS_PATH, MATIMO_LOG_LEVEL
```

### Agent Files (`.github/agents/`)

| File | Purpose |
|------|---------|
| `matimo-tool-creator-refactored.agent.md` | **Preferred** — lean 200-line orchestrator; loads skill, calls MCP tools |
| `matimo-tool-creator.agent.md` | Original full-featured agent |

### Skill Files (`.github/skills/`)

| File | Content |
|------|---------|
| `matimo-provider-creation/SKILL.md` | 400+ lines; bilingual TS+Python patterns for all 8 aspects of tool creation |
| `matimo-tool-generator/SKILL.md` | Self-maintenance workflow patterns (220 lines) |
| `tool-creation/SKILL.md` | General tool creation guidance |

### Self-Maintenance Loop

```
User request → Agent loads Skill (patterns) → calls MCP meta-tools
  → matimo_create_tool (YAML) → matimo_validate_tool → matimo_approve_tool
  → matimo_reload_tools → execute new tool
  → Report: definition.yaml + index.ts + executor.py + tests
```

### Developer Documentation (`docs/mcp/`)

| File | Purpose |
|------|---------|
| `docs/mcp/INDEX.md` | Entry point |
| `docs/mcp/SETUP_GUIDE.md` | Complete bilingual setup guide (TypeScript + Python) |
| `docs/mcp/QUICK_REFERENCE.md` | Cheat sheet with code examples |
| `docs/mcp/MAINTENANCE_GUIDE.md` | Team operations and system maintenance |
| `docs/mcp/NAVIGATION_MAP.md` | Task-based navigation |

---

## Tool Definition Structure

```yaml
name: slack_send_channel_message
description: Post a message to a Slack channel.
version: '1.0.0'
status: stable           # draft | stable | deprecated

parameters:
  channel:
    type: string
    required: true
    description: Channel ID or name
  text:
    type: string
    required: false
    description: Message text

execution:
  type: http             # http | command | function
  method: POST
  url: 'https://slack.com/api/chat.postMessage'
  headers:
    Authorization: 'Bearer {SLACK_BOT_TOKEN}'
    Content-Type: application/json
  body:
    channel: '{channel}'
    text: '{text}'

authentication:
  type: api_key          # api_key | bearer | oauth2 | basic
  location: header
  name: Authorization

output_schema:
  type: object
  properties:
    ok: { type: boolean }

error_handling:
  retry: 2
  backoff_type: exponential
  initial_delay_ms: 500

examples:
  - name: "Post hello"
    params:
      channel: '#general'
      text: 'Hello, world!'
```

**Key rules:**
- `{paramName}` is substituted at execution time in args, URL, body, and headers
- `status: draft` tools are **blocked** by the default policy engine
- `output_schema` is validated — executor throws `EXECUTION_FAILED` on mismatch
- Provider tools live under `packages/{provider}/tools/` — never under `packages/core/`

---

## Workflow: Adding a New Tool

### Option A: Via Agent (Preferred)

Use the `matimo-tool-creator-refactored` agent with the MCP server running:

```
@agent matimo-tool-creator-refactored

Create a {provider} tool to {action}.
Endpoint: {URL}
Auth: {TYPE}
Parameters: {LIST}
```

The agent loads the skill, calls MCP meta-tools, generates YAML + TS + Python code + tests, and reports results.

### Option B: New Provider Package (Manual)
1. Create `python/packages/{provider}/` and `typescript/packages/{provider}/` (copy from `packages/slack/`)
2. Update `package.json` and `pyproject.toml` with provider name and dependencies
3. Add `tsconfig.json` extending base config (TS)
4. Add OAuth config in `packages/{provider}/definition.yaml` if the provider needs OAuth

### Option C: Individual Tool (Manual, both SDKs)
1. **Create** `packages/{provider}/tools/{tool-name}/definition.yaml`
2. **If `type: command`**: add `packages/{provider}/tools/{tool-name}/index.ts` (TS) or `index.py` (Python)
3. **Add test fixture** → `packages/core/test/fixtures/` (TS) or `packages/core/tests/fixtures/` (Python)
4. **Validate**: `pnpm validate-tools` (TS)
5. **Test**: `pnpm test` (TS) / `uv run pytest packages/core/tests/` (Python)

---

## Commit Message Convention

```
<type>(<scope>): <subject>
```

- **Types**: `feat` `fix` `docs` `style` `refactor` `perf` `test` `chore` `ci` `revert`
- **Scopes**: `core` `cli` `auth` `policy` `mcp` `skills` `python` `ts` `slack` `github` …
- **Max length**: 100 characters
- **Examples**: `feat(python): add skill registry semantic search`, `test(policy): cover approval manifest`

---

## Critical Do's & Don'ts

✅ **DO:**
- Run `pnpm test` / `uv run pytest` before committing — all tests must pass
- Meet **95%+ coverage** for all modified modules — write tests, not ignores or suppressions
- Use `MatimoError` (`ErrorCode`) in TypeScript and `MatimoError` (`ErrorCode`) in Python for all failures
- Use `getGlobalMatimoLogger()` (TS) / `get_global_matimo_logger()` (Python) — never silent failures
- Use **Zod** (TS) / **Pydantic v2** (Python) for all runtime input validation
- Use `{paramName}` templating in YAML for parameter substitution
- Keep tools single-purpose
- Follow conventional commits with `<type>(<scope>)` format
- Run lint + format check before pushing (pre-commit catches this)
- Name all tools in **snake_case** (`slack_send_channel_message`) — new tools only
- Use **simple lowercase** parameter names (`channel`, `text`) — no prefixes or underscores
- Call meta-tools as `matimo_*` — `matimo_create_tool`, `matimo_reload_tools`, etc.

❌ **DON'T:**
- Hardcode secrets — always load from env or resolver chain
- Log secrets anywhere — not in errors, not in debug output
- Add `ignore` / `noqa` / `pragma: no cover` suppressions without a written justification comment
- Use `any` (TS) or `Any` (Python) without genuinely unavoidable reason
- Use `console.log` / `print` in core SDK packages — use the logger
- Commit without passing lint and tests
- Place tool YAML outside `packages/{provider}/tools/`
- Mark coverage gaps with `pragma: no cover` — close them with real tests
- Skip pre-commit hooks (`--no-verify`) except in genuine emergencies
- Use kebab-case tool names (`slack-send-message`) — snake_case only for new tools
- Prefix parameter names (`channel_id`, `message_text`) — use simple names matching the provider API
