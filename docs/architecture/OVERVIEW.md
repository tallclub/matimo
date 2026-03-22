# System Architecture Overview

Understand how Matimo's monorepo structure works and how components interact.

## Monorepo Organization

Matimo uses a **pnpm workspaces** monorepo with independent, installable packages:

```
packages/core              # Core SDK (matimo on npm)
├── Orchestration
├── Executors
├── Policy engine (allowCommand, allowHttp, protectedNamespaces)
├── Type definitions
├── Built-in tools (calculator, echo)
├── Meta-tools (packages/core/tools/matimo_*/)
│   ├── matimo_validate_tool / matimo_create_tool / matimo_approve_tool
│   ├── matimo_reload_tools / matimo_list_user_tools / matimo_get_tool_status
│   └── matimo_create_skill / matimo_list_skills / matimo_get_skill / matimo_validate_skill
└── skills/ (built-in SKILL.md domain knowledge)
    ├── tool-creation/
    ├── meta-tools-lifecycle/
    ├── policy-validation/
    └── tool-discovery/

packages/slack             # Slack tools (@matimo/slack)
├── 6+ Slack tool definitions
└── Slack OAuth2 config

packages/gmail             # Gmail tools (@matimo/gmail)
├── 4+ Gmail tool definitions
└── Gmail OAuth2 config

packages/cli               # CLI (@matimo/cli)
├── install, list, search commands
└── Tool discovery & management

examples/tools             # Working examples
├── factory-pattern-agent.ts
├── decorator-pattern-agent.ts
├── langchain-agent.ts
└── Provider-specific examples
```

**Key principle:** Each package is independently installable from npm, but shares a single source of truth for tool definitions.

## High-Level Runtime Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                    Application Layer                             │
│    (Your code: Express, CLI, Scheduled Job, LangChain, etc)      │
└───────────────────────────┬──────────────────────────────────────┘
                            │
        ┌───────────────────┴────────────────────┐
        │                                        │
        ▼                                        ▼
┌───────────────────────────┐        ┌──────────────────────────────┐
│   Pure SDK Patterns       │        │ Framework Integration Layer  │
│   (No Framework)          │        │  (With AI Framework)         │
├───────────────────────────┤        ├──────────────────────────────┤
│ • Factory Pattern         │        │ • LangChain Official API*    │
│ • Decorator Pattern       │        │   (LLM-driven, automatic)    │
│                           │        │                              │
│ For: CLI, backends,       │        │ • Decorator + LangChain      │
│ APIs, simple logic        │        │   (Class-based agents)       │
└─────────────┬─────────────┘        │                              │
              │                      │ • Factory + LangChain        │
              │                      │   (Manual routing)           │
              │                      │                              │
              │                      │ For: AI agents,              │
              └──────────┬───────────┤ intelligent orchestration    │
                         │           └──────────┬───────────────────┘
                         │                      │
                         └──────────┬───────────┘
                                    │
            ┌───────────────────────▼────────────────────────────────┐
            │            SDK Layer (packages/core/src/)             │
            │                                                       │
            │  ┌─────────────────────────────────────────────────┐  │
            │  │           MatimoInstance (Orchestrator)         │  │
            │  │  • Tool registry      • Executor coordination   │  │
            │  │  • Parameter validation  • Error handling       │  │
            │  │  • Skills registry    • Auto-discovery          │  │
            │  └──────────────────────────┬──────────────────────┘  │
            │                             │                         │
            │  ┌──────────────────────────▼──────────────────────┐  │
            │  │                    Policy Gate                  │  │
            │  │  • allowCommand / allowFunction tools           │  │
            │  │  • allowedHttpMethods    (default: GET, POST)   │  │
            │  │  • protectedNamespaces   (default: matimo_)     │  │
            │  │  • Content validator: 9 security rules          │  │
            │  │  • HMAC approval verification on tool load      │  │
            │  │  • Immutable after MatimoInstance.init()        │  │
            │  └─────────────────────────────────────────────────┘  │
            └──────────┬──────────────────────┬──────────────┬──────┘
                       │                      │              │
       ┌───────────────▼────┐    ┌────────────▼────────┐    ┌▼────────────────────┐
       │  Command Executor  │    │   HTTP Executor     │    │  Function Executor  │
       │                    │    │                     │    │                     │
       │ • Shell commands   │    │ • REST APIs         │    │ • JS/TS direct call │
       │ • Param templating │    │ • Auth injection    │    │ • Core tools        │
       │ • Exit handling    │    │ • Response valid    │    │ • Meta-tools        │
       │ • Legacy scripts   │    │                     │    │ • Skills access     │
       └──────────┬─────────┘    └──────────┬──────────┘    └─────────┬───────────┘
                  │                         │                         │
                  └──────────────┬──────────┘               ┌─────────┘
                                 │                          │
     ┌───────────────────────────┴──────┐    ┌──────────────▼──────────────────────────┐
     │   Tool & Provider Definitions    │    │   Meta-Tools & Skills                   │
     │   (YAML files)                   │    │   (Built-in, protected namespace)       │
     │                                  │    │                                         │
     │   packages/core/tools/           │    │   packages/core/tools/matimo_*/         │
     │   ├─ calculator/                 │    │   ├─ matimo_validate_tool               │
     │   ├─ echo-tool/                  │    │   ├─ matimo_create_tool                 │
     │                                  │    │   ├─ matimo_approve_tool                │
     │   packages/slack/tools/          │    │   ├─ matimo_reload_tools                │
     │   ├─ send-message/               │    │   ├─ matimo_list_user_tools             │
     │   ├─ list-channels/ ...          │    │   ├─ matimo_get_tool_status             │
     │                                  │    │   ├─ matimo_list_skills                 │
     │   packages/{provider}/           │    │   ├─ matimo_get_skill                   │
     │   ├─ definition.yaml (OAuth2)    │    │   ├─ matimo_create_skill                │
     │   └─ tools/{tool}/def.yaml       │    │   └─ matimo_validate_skill              │
     │                                  │    │                                         │
     │                                  │    │   packages/core/skills/                 │
     │                                  │    │   ├─ tool-creation/SKILL.md             │
     │                                  │    │   ├─ meta-tools-lifecycle/SKILL.md      │
     │                                  │    │   ├─ policy-validation/SKILL.md         │
     │                                  │    │   └─ tool-discovery/SKILL.md            │
     └──────────────────┬───────────────┘    └─────────────────────────────────────────┘
                        │
                 ┌──────▼────────┐
                 │   External    │
                 │   Services    │
                 │               │
                 │ • Gmail API   │
                 │ • Slack API   │
                 │ • GitHub API  │
                 │ • Shell cmd   │
                 │ • Custom APIs │
                 │               │
                 └───────────────┘

* Recommended for AI agents with automatic tool selection
```

---

## Component Layers

### 1. Application Layer

Your code that uses Matimo. Examples:

- Express.js API endpoint
- LangChain agent
- CLI tool
- Scheduled job
- Discord bot

### 2. SDK Layer (packages/core)

**Factory Pattern**:

```typescript
import { MatimoInstance } from 'matimo';

const m = await MatimoInstance.init('./tools');
const result = await m.execute('calculator', params);
```

**Decorator Pattern**:

```typescript
import { tool } from 'matimo';

class Agent {
  @tool('calculator')
  async calculate(...) { }
}
```

### 3. Core Orchestration (packages/core/src)

**MatimoInstance**: Central orchestrator that:

- Initializes tool loading
- Manages auto-discovery
- Coordinates execution
- Handles errors
- Manages OAuth2 tokens
- Validates parameters
- Enforces policy gate on tool loads and meta-tool operations
- Routes meta-tool calls to the built-in meta-tools subsystem

### 4. Tool Management (packages/core/src/core)

**ToolLoader** (internal): Loads tools from YAML files

- Reads from `packages/{provider}/tools/*/definition.yaml`
- Validates against Zod schema
- Returns `ToolDefinition[]`
- Auto-discovers packages from `node_modules/@matimo/*/tools`

**ToolRegistry** (internal): In-memory index of all tools

```
tools: Map<name, ToolDefinition>
|
├── calculator (from packages/core/tools/)
├── slack-send-message (from packages/slack/tools/)
├── slack-list-channels (from packages/slack/tools/)
├── gmail-send-email (from packages/gmail/tools/)
├── matimo_validate_tool (built-in meta-tool)
├── matimo_create_tool   (built-in meta-tool)
├── matimo_approve_tool  (built-in meta-tool)
└── ...
```

### 5. Execution Layer (packages/core/src/executors)

**FunctionExecutor** (Primary for Core Tools): Executes JavaScript/TypeScript functions directly

```
Input: { code: "execute.ts", params: {...} }
Process: Import and call function directly (no subprocess)
Output: { result }
```

Used by all 6 core tools: `execute`, `read`, `edit`, `search`, `web`, `calculator`

**HttpExecutor**: Makes HTTP requests with automatic validation

```
Input: { method: "POST", url: "...", headers: {...}, body: {...} }
Process: Send request, embed params, validate by output_schema
Output: { status, data, headers }
```

**CommandExecutor** (Legacy Shell Execution): Runs external shell commands

```
Input: { command: "node script.js", args: [...] }
Process: Spawn child process
Output: { stdout, stderr, exitCode }
```

Used for external tools and legacy scripts that need subprocess execution.

### 6. Tool Definitions (YAML)

**Core Tools** (packages/core/tools/):

```yaml
name: calculator
execution:
  type: function
  code: './calculator.ts'
```

**Provider Tools** (packages/{provider}/tools/):

```yaml
name: slack-send-message
execution:
  type: http
  method: POST
  url: https://slack.com/api/chat.postMessage
```

**Provider Config** (packages/{provider}/definition.yaml):

```yaml
type: provider
name: slack
provider:
  endpoints:
    authorizationUrl: https://slack.com/oauth_authorize
```

### 7. External Services

Tools interact with:

- Google Gmail API
- Slack Web API
- GitHub REST API
- Shell commands
- Custom HTTP APIs

### 8. Policy Gate (packages/core/src/policy)

**PolicyEngine**: Enforces security rules during tool registration and meta-tool operations:

- `allowCommandTools` — block/allow command-type tools (default: `false`)
- `allowFunctionTools` — block/allow function-type tools that run arbitrary code (default: `false`)
- `allowedHttpMethods` — restrict HTTP verbs (default: `['GET', 'POST']`)
- `protectedNamespaces` — namespaces that cannot be overwritten by user tools (default: `['matimo_']`)
- **Content Validator** — 9 security rules: no path traversal, no env var injection, no credential exposure, etc.
- **Immutable after init** — `PolicyConfig` is frozen once `MatimoInstance.init()` completes

For full details see [Policy Engine & Lifecycle](../api-reference/POLICY_AND_LIFECYCLE.md).

### 9. Meta-Tools Subsystem (packages/core/tools/matimo_*/)

Built-in tools that manage the tool lifecycle from within the agent. They are always present and cannot be removed or shadowed (protected namespace):

| Tool | Purpose |
|------|---------|
| `matimo_validate_tool` | Validate a YAML definition against schema + policy |
| `matimo_create_tool` | Create a new `.draft` tool definition (policy-safe) |
| `matimo_approve_tool` | Sign and promote a draft tool (HMAC, integrity) |
| `matimo_reload_tools` | Hot-reload the live registry without restarting |
| `matimo_list_user_tools` | List non-meta user tools with metadata |
| `matimo_get_tool_status` | Check lifecycle state of a single tool |
| `matimo_create_skill` | Create a new SKILL.md in the skills directory |
| `matimo_list_skills` | List available SKILL.md files |
| `matimo_get_skill` | Read a skill by name |
| `matimo_validate_skill` | Validate a skill against the Agent Skills spec |

For full details see [Meta-Tools Reference](../api-reference/META_TOOLS.md).

### 10. Approval & Integrity Layer

When a tool is approved via `matimo_approve_tool`, the approval system:

1. Computes **SHA-256** hash of the YAML content
2. Issues an **HMAC-SHA256** signature using a secret key
3. Writes an entry to `.matimo-approvals.json` in the target directory
4. Renames the file from `*.draft.yaml` → `*.yaml`
5. On subsequent loads, verifies the HMAC — any tampering causes load failure

This ensures that agent-written tools cannot be silently altered between sessions.

For full details see [Approval System](../api-reference/APPROVAL-SYSTEM.md).

### 11. Skills System (packages/core/skills/)

Skills are **SKILL.md** files that carry domain knowledge the agent can load on demand. Unlike tools (which execute actions), skills are read-only instruction documents.

```
packages/core/skills/
├── tool-creation/SKILL.md        # How to create Matimo tools
├── meta-tools-lifecycle/SKILL.md # How to use meta-tools
├── policy-validation/SKILL.md    # How to work within policy constraints
└── tool-discovery/SKILL.md       # How to discover available tools
```

Agent runtime skills live in `./matimo-tools/skills/` (created by `matimo_create_skill`).

For full details see [Skills System](../tool-development/SKILLS.md).

---

## Agent Tool Lifecycle

For agents that create tools at runtime (e.g., autonomous coding agents), the full lifecycle is:

```
1. Agent decides a new tool is needed
   │
   └─> matimo_create_tool(name, description, execution, parameters)
       │
       ├─ Policy Gate: blocks command/function type if disallowed
       ├─ Content Validator: 9 security rules
       ├─ Saves as {name}.draft.yaml in ./matimo-tools/
       ▼
2. Agent (or human) reviews the draft
   │
   └─> matimo_validate_tool(tool_path)
       │
       ├─ Re-runs schema + policy validation
       ├─ Returns validation_passed: true | false
       │
       ▼
3. Approval
   │
   └─> matimo_approve_tool(tool_path)
       │
       ├─ Generates SHA-256 hash of YAML content
       ├─ Signs with HMAC-SHA256
       ├─ Writes entry to .matimo-approvals.json
       ├─ Renames .draft.yaml → .yaml
       │
       ▼
4. Reload
   │
   └─> matimo_reload_tools(tools_dir)
       │
       ├─ Rescans the tools directory
       ├─ Verifies HMAC for each approved tool
       ├─ Registers new tools into the live registry
       │
       ▼
5. Use
   │
   └─> matimo.execute(new_tool_name, params)
```

---

## Data Flow

### Tool Execution Flow

```
1. Application
   │
   └─> matimo.execute('calculator', { operation: 'add', a: 5, b: 3 })
       │
       ▼
2. MatimoInstance
   └─> Validate parameters against schema
       │
       ▼
3. ToolRegistry
   └─> Lookup 'calculator' definition
       │
       ├─ execution: { type: 'function', code: './calculator.ts' }
       ├─ parameters: { operation, a, b }
       │
       ▼
4. FunctionExecutor (or CommandExecutor/HttpExecutor based on type)
   └─> Execute: Import function and call with params { operation: 'add', a: 5, b: 3 }
       │
       ├─ (For command type): Spawn child process with templated args
       ├─ (For http type): Make HTTP request with embedded params
       │
       ▼
5. Tool Implementation
   └─> Run: calculator({ operation: 'add', a: 5, b: 3 })
       │
       ├─ Calculate: 5 + 3 = 8
       │
       ▼
6. Result Validation
   └─> Validate against output_schema
       │
       ├─ Check type matches
       ├─ Check required fields present
       │
       ▼
7. Return to Application
   └─> { result: 8 }
```

### OAuth2 Token Flow

```
1. Environment
   │
   └─> process.env.GMAIL_ACCESS_TOKEN = "ya29.abc..."
       │
       ▼
2. HTTP Tool Execution
   └─> Tool requires OAuth2 token
       │
       ├─ Check authentication config
       ├─ Find provider: google
       │
       ▼
3. Token Injection
   └─> Read from environment variable
       │
       ├─ GMAIL_ACCESS_TOKEN → "ya29.abc..."
       │
       ▼
4. HTTP Request
   └─> Add to headers
       │
       ├─ Authorization: "Bearer ya29.abc..."
       │
       ▼
5. External Service (Gmail API)
   └─> Verify token
       │
       ├─ Token valid → Execute request
       ├─ Token invalid → 401 Unauthorized
       │
       ▼
6. Response
   └─> Return result or error
```

---

## Framework Integration Patterns

Matimo supports 3 patterns for integrating with AI frameworks like LangChain, where the LLM automatically decides which tool to use:

### Pattern 1: LangChain Official API (⭐ Recommended)

Uses LangChain's official `tool()` function with automatic schema generation:

```
┌──────────────────────────────────┐
│  LangChain Agent                 │
│  (with OpenAI GPT-4)             │
└────────────┬─────────────────────┘
             │
             ▼
┌──────────────────────────────────┐
│  LangChain Official API          │
│  tool(async fn, schema)          │
│  ├─ Automatic schema generation  │
│  ├─ Type validation via Zod      │
│  └─ Best IDE support             │
└────────────┬─────────────────────┘
             │
             ▼
┌──────────────────────────────────┐
│  Matimo SDK                      │
│  m.execute(toolName, params)     │
└────────────┬─────────────────────┘
             │
             ▼
┌──────────────────────────────────┐
│  Tool Executors                  │
│  (Command/HTTP)                  │
└──────────────────────────────────┘
```

**When to use:** Default choice for AI agents with LangChain

### Pattern 2: Decorator Pattern with LangChain

Uses Matimo's `@tool()` decorators for class-based agents:

```
┌──────────────────────────────────┐
│  Class-Based Agent               │
│                                  │
│  @tool('calculator')             │
│  async calculate(...) { }        │
│                                  │
│  @tool('email-sender')           │
│  async sendEmail(...) { }        │
└────────────┬─────────────────────┘
             │
             ▼
┌──────────────────────────────────┐
│  @tool Decorator                 │
│  ├─ Intercepts method calls      │
│  ├─ Maps args to parameters      │
│  └─ Calls matimo.execute()       │
└────────────┬─────────────────────┘
             │
             ▼
┌──────────────────────────────────┐
│  Matimo SDK                      │
│  m.execute(toolName, params)     │
└────────────┬─────────────────────┘
             │
             ▼
┌──────────────────────────────────┐
│  Tool Executors                  │
│  (Command/HTTP)                  │
└──────────────────────────────────┘
```

**When to use:** Class-based agents, automatic tool binding

### Pattern 3: Factory Pattern with LangChain

Direct `matimo.execute()` calls in agent logic:

```
┌──────────────────────────────────┐
│  Agent with Custom Logic         │
│                                  │
│  if (prompt.includes('calc'))    │
│    m.execute('calculator', ...)  │
│                                  │
│  if (prompt.includes('email'))   │
│    m.execute('gmail-send', ...)  │
└────────────┬─────────────────────┘
             │
             ▼
┌──────────────────────────────────┐
│  Matimo SDK                      │
│  m.execute(toolName, params)     │
└────────────┬─────────────────────┘
             │
             ▼
┌──────────────────────────────────┐
│  Tool Executors                  │
│  (Command/HTTP)                  │
└──────────────────────────────────┘
```

**When to use:** Simple logic, manual tool routing

### Comparison Matrix

| Aspect             | Official API       | Decorator          | Factory      |
| ------------------ | ------------------ | ------------------ | ------------ |
| **LLM-Driven**     | ✅ Yes (automatic) | ✅ Yes             | ❌ Manual    |
| **Schema Gen**     | ✅ Automatic       | ✅ Manual          | ✅ Manual    |
| **Type Safety**    | Excellent          | Excellent          | Good         |
| **Framework**      | LangChain+         | LangChain+         | Any          |
| **Best For**       | AI agents          | Class-based agents | Simple logic |
| **Learning Curve** | Low                | Medium             | Low          |

For full details, see [Framework Integrations - LangChain](../framework-integrations/LANGCHAIN.md).

---

## Core Types

```typescript
// Tool Definition
interface ToolDefinition {
  name: string;
  description: string;
  version: string;
  parameters?: Record<string, Parameter>;
  execution: ExecutionConfig; // command or http
  authentication?: AuthConfig;
  output_schema?: OutputSchema;
}

// Execution Config (Command)
interface CommandExecution {
  type: 'command';
  command: string;
  args?: string[];
  cwd?: string;
  timeout?: number;
}

// Execution Config (HTTP)
interface HttpExecution {
  type: 'http';
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  url: string;
  headers?: Record<string, string>;
  body?: unknown;
  query_params?: Record<string, string>;
}

// Provider Definition
interface ProviderDefinition {
  type: 'provider';
  name: string;
  provider: {
    endpoints: OAuth2Endpoints;
    // ...
  };
}
```

---

## Validation Pipeline

Every tool goes through validation:

```
YAML File
   │
   ├─> Parse YAML
   ├─> Validate against Zod schema
   │   ├─ Check required fields
   │   ├─ Check types
   │   ├─ Check enums
   ├─> Validate authentication (if OAuth2)
   │   ├─ Check provider exists
   │   ├─ Check endpoints are URLs
   ├─> Validate execution
   │   ├─ Check type is 'command' or 'http'
   │   ├─ Check required fields for type
   ├─> Validate parameters
   │   ├─ Check types match
   │   ├─ Check required fields
   │
   ▼
ToolDefinition (validated)
```

---

## Error Handling

```
Error occurs
   │
   ├─> Catch with try/catch
   ├─> Wrap in MatimoError
   │   ├─ code: ErrorCode
   │   ├─ message: string
   │   ├─ details?: object
   │
   ▼
Application error handling
   │
   ├─> Log error (never log secrets)
   ├─> Return structured error
   ├─> Notify user/system
   │
   ▼
Application recovery
```

---

## Design Principles

### 1. Configuration-Driven

Tools defined in YAML, not code:

- ✅ Easy to update without redeploying
- ✅ Non-technical users can add tools
- ✅ Version control friendly

### 2. Stateless

Matimo doesn't store anything:

- ✅ No database required
- ✅ Easy to scale
- ✅ Simple to test

### 3. Multi-Provider

Support any OAuth2 provider:

- ✅ Google, GitHub, Slack out of box
- ✅ Add new providers with YAML
- ✅ No code changes needed

### 4. Type-Safe

Full TypeScript + Zod validation:

- ✅ Catch errors at load time
- ✅ IDE autocomplete support
- ✅ Zero `any` types

### 5. Framework-Agnostic

Works with any framework:

- ✅ Direct SDK usage
- ✅ LangChain integration
- ✅ Custom framework support
- ✅ Coming: CrewAI, Vercel AI, etc.

### 6. Secure by Default

Policy engine is on from the start:

- ✅ Command and function tools blocked unless explicitly allowed
- ✅ Protected namespaces prevent shadowing built-in tools
- ✅ Agent-created tools must pass policy + content validation
- ✅ Approved tools are HMAC-signed to prevent silent tampering

---

## Extension Points

### Adding a New Tool

1. Create `tools/category/tool-name/definition.yaml`
2. Loader automatically discovers it
3. Validation confirms correctness
4. Ready to use

### Adding an Executor

1. Extend `Executor` base class
2. Implement `execute(tool, params)` method
3. Add to tool execution dispatch
4. Support new execution types

### Adding a Provider

1. Create `tools/provider-name/definition.yaml`
2. Set `type: provider`
3. Configure OAuth2 endpoints
4. Tools reference provider in authentication

---

## Performance Characteristics

| Operation          | Time      | Notes                       |
| ------------------ | --------- | --------------------------- |
| Load tools         | ~50ms     | One-time, cached            |
| Validate schema    | ~5ms      | Per tool                    |
| Execute command    | Varies    | Depends on command          |
| Execute HTTP       | 100-500ms | Network dependent           |
| OAuth token inject | <1ms      | Environment variable lookup |

---

## Next Steps

- **[SDK Usage Patterns](../user-guide/SDK_PATTERNS.md)** — How to use Matimo
- **[Tool Specification](../tool-development/YAML_TOOLS.md)** — How to build tools
- **[Policy Engine & Lifecycle](../api-reference/POLICY_AND_LIFECYCLE.md)** — Security controls and tool lifecycle
- **[Meta-Tools Reference](../api-reference/META_TOOLS.md)** — Built-in tool management
- **[Approval System](../api-reference/APPROVAL-SYSTEM.md)** — Approval handler configuration
- **[Skills System](../tool-development/SKILLS.md)** — Domain knowledge via SKILL.md
- **[Logging](../api-reference/LOGGING.md)** — Winston logger integration
- **[Troubleshooting](../troubleshooting/FAQ.md)** — Common issues
