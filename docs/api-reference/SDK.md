# API Reference — Complete SDK

Complete reference for the Matimo SDK in **TypeScript** and **Python**. For a simpler introduction, see [Quick Start](../getting-started/QUICK_START.md) or [SDK Patterns](../user-guide/SDK_PATTERNS.md).

## Table of Contents

### TypeScript SDK (`MatimoInstance`)
- [init()](#initoptions)
- [execute()](#executetoolname-params)
- [getRequiredCredentials()](#getrequiredcredentialstoolname)
- [listTools()](#listtools)
- [getTool()](#gettoolname)
- [searchTools()](#searchtoolsquery)
- [Decorators](#decorators)
- [LangChain Integration](#langchain-integration)
- [Error Handling](#error-handling)
- [Types](#types)

### Python SDK (`Matimo`)
- [Matimo.init()](#python-init)
- [matimo.execute()](#python-execute)
- [matimo.list_tools()](#python-list-tools)
- [matimo.get_tool()](#python-get-tool)
- [matimo.search_tools()](#python-search-tools)
- [matimo.reload()](#python-reload)
- [matimo.list_skills() / semantic_search_skills()](#python-list-skills)
- [Decorator pattern](#python-decorators)
- [LangChain integration](#python-langchain)
- [CrewAI integration](#python-crewai)
- [Logging](#python-logging)
- [Error handling](#python-errors)

---

## TypeScript SDK — `MatimoInstance`

Main entry point for the Matimo TypeScript SDK.

### `init(options?)`

Initialize Matimo with tools from specified paths or auto-discovery.

**Signature:**

```typescript
static async init(options?: InitOptions | string): Promise<MatimoInstance>
```

**Parameters:**

- `options` (InitOptions | string, optional) — a single directory path, or:

| Option | Type | Description |
|--------|------|-------------|
| `toolPaths` | `string[]` | Tool directories to load |
| `autoDiscover` | `boolean` | Also load tools (and their skills) from installed `@matimo/*` packages |
| `skillPaths` | `string[]` | Directories of `SKILL.md` skills. Matimo's core skills are always added |
| `policy` | `PolicyEngine` | Custom policy engine; overrides `policyConfig` and `policyFile` |
| `policyConfig` | `PolicyConfig` | Options for the built-in `DefaultPolicyEngine` |
| `policyFile` | `string` | Path to a `policy.yaml` |
| `trustedPaths` / `untrustedPaths` | `string[]` | Which directories hold developer tools and agent-written tools; untrusted tools must pass the content rules |
| `governanceMode` | `'secure' \| 'legacy'` | `'secure'` (default): HTTP DELETE and command tools ask on every call. `'legacy'`: pre-0.2.0 defaults |
| `onApproval` | `ApprovalCallback` | This instance's reviewer for calls that need approval ([Approval System](APPROVAL-SYSTEM.md)) |
| `onHITL` | `HITLCallback` | Decides calls quarantined by `policyConfig.enableHITL` |
| `hitlTimeoutMs` | `number` | Reject a quarantined call when `onHITL` takes longer |
| `onEvent` | `MatimoEventHandler` | Receives every governance and execution event ([Types](TYPES.md)) |
| `auditSink` | `AuditSink` | Durable destination for the same events, e.g. `new JsonlFileSink(path)` |
| `approvalSecret` / `approvalDir` / `approvalTtlSeconds` | | Signing secret (else `MATIMO_APPROVAL_SECRET`, else ephemeral), location (default: cwd) and expiry of `matimo_approve_tool` approvals |
| `defaultMaxResponseSize` | `number` | Response-size cap in bytes for tools that don't set `output_schema.max_response_size` (built-in default 262144 / 256 KB — see [Response Size Guardrail](../architecture/OVERVIEW.md#tool-execution-flow)) |
| `defaultSkillWriteDir` | `string` | Where `matimo_create_skill` writes when the caller gives no `target_dir` |
| `logLevel` / `logFormat` | | Logger settings |

`includeCore` is accepted but has no effect.

**Returns:** `Promise<MatimoInstance>` - Initialized instance ready to execute tools

**Throws:**

- `MatimoError(INVALID_SCHEMA)` - If tool definitions have invalid schema
- `MatimoError(FILE_NOT_FOUND)` - If tools directory doesn't exist

**Example:**

```typescript
import { MatimoInstance } from 'matimo';

// Auto-discover tools from node_modules/@matimo/* packages
const matimo = await MatimoInstance.init({ autoDiscover: true });

// Or specify custom tool paths
const matimo = await MatimoInstance.init({
  toolPaths: ['./tools'],
});

// Backward compatibility - single directory (loads only ./tools, no built-in tools)
const matimo = await MatimoInstance.init('./tools');

console.log(`Loaded ${matimo.listTools().length} tools`);
```

---

### `execute(toolName, params, options?)`

Execute a tool by name with parameters.

**Signature:**

```typescript
async execute(
  toolName: string,
  params: Record<string, unknown>,
  options?: ExecuteOptions
): Promise<unknown>

interface ExecuteOptions {
  /** Execution timeout in milliseconds. */
  timeout?: number;
  /**
   * Per-call credential overrides for multi-tenant use.
   * Keys must match the env-var names the tool references (e.g. `SLACK_BOT_TOKEN`).
   * When provided, they take precedence over `process.env` for that single call.
   * Values are never logged and are held in memory only for the duration of the call.
   */
  credentials?: Record<string, string>;
  /** Who is calling: checked by the policy engine (environment, roles, agentId). */
  context?: PolicyContext;
  /** Skip the approval prompt for this call only; policy denials and HITL still apply. */
  approved?: boolean;
  /** Reviewer for this call only; takes precedence over the instance's onApproval. */
  onApproval?: ApprovalCallback;
}
```

**Parameters:**

- `toolName` (string, required) - Exact name of the tool to execute
- `params` (object, required) - Tool parameters (must match tool's parameter schema)
- `options.timeout` (number, optional) - Execution timeout in milliseconds
- `options.credentials` (object, optional) - Per-call credential overrides (see Multi-tenant Usage below)
- `options.context` (PolicyContext, optional) - The caller's identity, environment and roles, e.g. `{ agentId: 'agent-7', environment: 'production', roles: ['operator'] }`. Function tools receive it as `context.policyContext`
- `options.approved` (boolean, optional) - The host already confirmed this call; skips only the approval prompt
- `options.onApproval` (ApprovalCallback, optional) - Reviewer for this one call

**Returns:** `Promise<unknown>` - Tool result (validated against output schema). If the raw result exceeds the effective response-size cap (`output_schema.max_response_size`, else `defaultMaxResponseSize`, else a built-in 256 KB), it is truncated rather than rejected — see [Response Size Guardrail](../architecture/OVERVIEW.md#tool-execution-flow).

**Throws:**

- `MatimoError(TOOL_NOT_FOUND)` - If tool name doesn't exist
- `MatimoError(INVALID_PARAMETER)` - If params don't match tool schema
- `MatimoError(POLICY_DENIED)` - If the policy engine, a draft/production gate or a HITL reviewer refuses the call
- `MatimoError(EXECUTION_FAILED)` - If the call needs approval and is declined or nobody can answer
- `MatimoError(EXECUTION_FAILED)` - If tool execution fails
- `MatimoError(AUTH_FAILED)` - If authentication fails
- `MatimoError(TIMEOUT)` - If execution exceeds timeout

**Example (single-tenant):**

```typescript
import { MatimoInstance, MatimoError } from 'matimo';

const matimo = await MatimoInstance.init({ autoDiscover: true });

try {
  // Credentials read from process.env (SLACK_BOT_TOKEN, etc.)
  const result = await matimo.execute('calculator', {
    operation: 'add',
    a: 10,
    b: 5,
  });
  console.log('Result:', result); // { result: 15 }

  const slackResult = await matimo.execute('slack-send-message', {
    channel: '#general',
    text: 'Hello',
  });
  console.log('Message sent:', slackResult);
} catch (error) {
  if (error instanceof MatimoError) {
    console.error(`Error [${error.code}]:`, error.message);
  }
}
```

**Multi-tenant Usage:**

Different tenants can supply their own credentials **per call** without touching
`process.env`. This lets a single process serve many tenants safely.

```typescript
import { MatimoInstance } from 'matimo';

const matimo = await MatimoInstance.init({ autoDiscover: true });

// Tenant A — uses their own Slack token
await matimo.execute(
  'slack-send-message',
  { channel: '#general', text: 'Hello from Tenant A' },
  { credentials: { SLACK_BOT_TOKEN: 'xoxb-tenant-a-token' } }
);

// Tenant B — same process, completely isolated credentials
await matimo.execute(
  'slack-send-message',
  { channel: '#general', text: 'Hello from Tenant B' },
  { credentials: { SLACK_BOT_TOKEN: 'xoxb-tenant-b-token' } }
);

// Timeout + credentials together
await matimo.execute(
  'github-create-issue',
  { repo: 'myorg/myrepo', title: 'Bug report' },
  {
    timeout: 10_000,
    credentials: { GITHUB_TOKEN: 'ghp-tenant-c-token' },
  }
);
```

**Credential key naming convention:**

Credential keys must match the env-var names the tool's YAML definition
references (e.g. `SLACK_BOT_TOKEN`, `GITHUB_TOKEN`). The credential
value is resolved in this order for each placeholder found in the tool YAML:

1. `credentials[paramName]` — per-call override (highest priority)
2. `credentials[MATIMO_${paramName}]` — prefixed per-call override
3. `process.env[MATIMO_${paramName}]` — prefixed env var
4. `process.env[paramName]` — direct env var (lowest priority)

**Security notes:**
- Credential values are **never logged** by the Matimo SDK.
- Credentials are **never persisted** — held in memory only for the life of the call.
- `process.env` is **never modified** — each call's credentials are isolated.
- For `command` tools, credentials are merged into the child-process environment
  (`{ ...process.env, ...credentials }`) and not leaked back to the parent process.

---

### `getRequiredCredentials(toolName)`

Return the credential key names a tool needs, so callers know exactly what to
put in `options.credentials` without reading the tool YAML.

This is the primary discovery API for multi-tenant platforms: call this once
when building your tenant-credential collection step, then pass the result
directly to `execute()`.

**Signature:**

```typescript
getRequiredCredentials(toolName: string): string[]
```

**Parameters:**

- `toolName` (string, required) — Exact tool name

**Returns:** `string[]` — Array of credential key names the tool requires (empty if the tool needs no auth)

**Throws:** `MatimoError(TOOL_NOT_FOUND)` if the tool doesn't exist

**Example:**

```typescript
const matimo = await MatimoInstance.init({ autoDiscover: true });

// 1. Discover what credentials this tool needs
const keys = matimo.getRequiredCredentials('slack-send-message');
console.log(keys); // → ['SLACK_BOT_TOKEN']

// 2. Collect those values from your secrets store / tenant config
const credentials = Object.fromEntries(
  keys.map((key) => [key, tenant.vault.get(key)])
);

// 3. Execute with isolated per-tenant credentials
await matimo.execute('slack-send-message', params, { credentials });
```

**Multi-tool credential prep:**

```typescript
// Build a credential map for every installed tool at startup
const credentialManifest = Object.fromEntries(
  matimo.listTools().map((tool) => [
    tool.name,
    matimo.getRequiredCredentials(tool.name),
  ])
);

// credentialManifest looks like:
// {
//   'slack-send-message':   ['SLACK_BOT_TOKEN'],
//   'github-create-issue':  ['GITHUB_TOKEN'],
//   'twilio-send-sms':      ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN'],
// }

// When a request comes in for tenant X, collect only what that tool needs:
async function runForTenant(toolName: string, params: Record<string, unknown>, tenant: Tenant) {
  const keys = credentialManifest[toolName];
  const credentials = Object.fromEntries(keys.map((k) => [k, tenant.secrets[k]]));
  return matimo.execute(toolName, params, { credentials });
}
```

---

### `listTools()`

Get all available tools.

**Signature:**

```typescript
listTools(): ToolDefinition[]
```

**Returns:** `ToolDefinition[]` - Array of all loaded tool definitions

**Example:**

```typescript
const matimo = await MatimoInstance.init({ autoDiscover: true });

const tools = matimo.listTools();
console.log(`Available tools (${tools.length}):`);

tools.forEach((tool) => {
  console.log(`  - ${tool.name}: ${tool.description}`);
  console.log(`    Parameters: ${Object.keys(tool.parameters || {}).join(', ')}`);
});
```

---

### `getTool(name)`

Get a single tool definition by name.

**Signature:**

```typescript
getTool(name: string): ToolDefinition | undefined
```

**Parameters:**

- `name` (string) - Exact tool name

**Returns:** `ToolDefinition | undefined` - Tool definition if found, undefined otherwise

**Example:**

```typescript
const matimo = await MatimoInstance.init({ autoDiscover: true });

const slackTool = matimo.getTool('slack-send-message');
if (slackTool) {
  console.log('Tool:', slackTool.name);
  console.log('Description:', slackTool.description);
  console.log('Parameters:');
  Object.entries(slackTool.parameters || {}).forEach(([name, param]) => {
    console.log(`  - ${name}: ${param.type}${param.required ? ' (required)' : ''}`);
  });
} else {
  console.log('Tool not found');
}
```

---

### `searchTools(query)`

Search tools by name or description.

**Signature:**

```typescript
searchTools(query: string): ToolDefinition[]
```

**Parameters:**

- `query` (string) - Search query (matched case-insensitively against name and description)

**Returns:** `ToolDefinition[]` - Matching tools

**Example:**

```typescript
const matimo = await MatimoInstance.init({ autoDiscover: true });

// Find all Slack-related tools
const slackTools = matimo.searchTools('slack');
console.log(`Found ${slackTools.length} Slack tools`);

// Find email tools
const emailTools = matimo.searchTools('email');
emailTools.forEach((tool) => console.log(`  - ${tool.name}`));
```

---

## Decorators

Use decorators for clean, declarative tool execution in class-based code.

### Governance and skills methods

| TypeScript | Python | Description |
|------------|--------|-------------|
| `setApprovalCallback(cb)` | `set_approval_callback(cb)` | Set or clear the instance's approval callback (`null`/`None` falls back to the process-wide handler) |
| `getGovernanceMode()` | `get_governance_mode()` | `'secure'` or `'legacy'` |
| `getApprovalManifest()` | `get_approval_manifest()` | The manifest `matimo_approve_tool` records approvals in |
| `reloadTools()` | `reload()` | Re-read tool directories; returns `{ loaded, removed, revalidated, rejected }` |
| `setHITLCallback(cb)` | — | Set or clear the HITL callback (Python: pass `on_hitl` to `init()`) |
| `reloadPolicy(configOrFile?)` | — | Swap the policy engine and re-check tools |
| `getToolsByTag(tag)` | — | Tools carrying a tag |
| `registerSkill(skill)` / `registerSkills([...])` | `register_skill(skill)` / `register_skills([...])` | Add skills from your own storage (dropped by the next `reloadSkills()`) |
| `addSkillPath(dir)` + `reloadSkills()` | `add_skill_path(dir)` + `reload_skills()` | Mount another skills directory at runtime; returns `{ loaded, removed }` |
| `getSkillSections(name)` | `get_skill_sections(name)` | Section headings and token estimates |
| `getSkillContent(name, { sections, maxTokens, includePreamble, maxDepth })` | `get_skill_content(name, SkillContentOptions(...))` | Load part of a skill |
| `buildSkillPromptContext(query, { topK })` | `build_skill_prompt_context(query, top_k=...)` | Relevant skills (TF-IDF), formatted for a system prompt |
| `getDefaultSkillWriteDir()` | `get_default_skill_write_dir()` | Where `matimo_create_skill` writes by default |
| `getSkillResource(name, path)` | — | Read a file bundled with a skill |

Runnable demos of these, needing no API keys: `typescript/examples/tools/policy/approval-modes-demo.ts`, `skills/skills-registry-demo.ts`, and the Python twins under `python/examples/native/`.

---

### `@tool(toolName)`

Class method decorator that automatically executes a tool when the method is called.

**Signature:**

```typescript
function tool(toolName: string): MethodDecorator;
```

**How it works:**

1. When decorated method is called, decorator intercepts the call
2. Method parameters are passed to `matimo.execute(toolName, params)`
3. Tool result is returned directly
4. Method body is never executed

**Requirements:**

- Global Matimo instance must be set: `setGlobalMatimoInstance(matimo)`
- Tool name must match exactly (case-sensitive)
- Method parameters must match tool parameters (by order or destructuring)

**Example — Simple Tool Execution:**

```typescript
import { tool, setGlobalMatimoInstance, MatimoInstance } from 'matimo';

const matimo = await MatimoInstance.init({ autoDiscover: true });
setGlobalMatimoInstance(matimo);

class Calculator {
  @tool('calculator')
  async add(operation: string, a: number, b: number) {
    // Method body is ignored
    // Decorator passes (operation, a, b) to matimo.execute('calculator', {...})
  }
}

const calc = new Calculator();
const result = await calc.add('add', 5, 3);
console.log(result); // { result: 8 }
```

**Example — Slack Agent:**

```typescript
import { tool, setGlobalMatimoInstance, MatimoInstance, MatimoError } from 'matimo';

const matimo = await MatimoInstance.init({ autoDiscover: true });
setGlobalMatimoInstance(matimo);

class SlackAgent {
  @tool('slack-send-message')
  async sendMessage(channel: string, text: string) {
    // Decorator handles execution
  }

  @tool('slack_get_channel_history')
  async getHistory(channel: string, limit: number) {
    // Also handled by decorator
  }
}

try {
  const agent = new SlackAgent();

  // These calls trigger matimo.execute() automatically
  await agent.sendMessage('#general', 'Hello world!');
  const channelInfo = await agent.getChannel('general');

  console.log('Channel:', channelInfo);
} catch (error) {
  if (error instanceof MatimoError) {
    console.error(`Tool error [${error.code}]:`, error.message);
  }
}
```

**Example — With Error Handling:**

```typescript
import { tool, setGlobalMatimoInstance, MatimoInstance, MatimoError } from 'matimo';

const matimo = await MatimoInstance.init({ autoDiscover: true });
setGlobalMatimoInstance(matimo);

class APIClient {
  @tool('api-call')
  async makeRequest(method: string, url: string, body?: string) {
    // Never runs, but provides type hints
  }
}

const client = new APIClient();

try {
  const response = await client.makeRequest('GET', 'https://api.example.com/users');
  console.log('Response:', response);
} catch (error) {
  if (error instanceof MatimoError) {
    switch (error.code) {
      case 'TOOL_NOT_FOUND':
        console.error('Tool not found');
        break;
      case 'AUTH_FAILED':
        console.error('Authentication failed');
        break;
      case 'EXECUTION_FAILED':
        console.error('Tool execution failed:', error.details);
        break;
      default:
        console.error('Unknown error:', error.message);
    }
  }
}
```

---

### `setGlobalMatimoInstance(instance)`

Set the global Matimo instance for all decorators to use.

**Signature:**

```typescript
function setGlobalMatimoInstance(instance: MatimoInstance): void;
```

**Parameters:**

- `instance` (MatimoInstance) - Initialized Matimo instance from `MatimoInstance.init()`

**Note:** Must be called before using any `@tool` decorators.

**Example:**

```typescript
import { setGlobalMatimoInstance, MatimoInstance } from 'matimo';

// Initialize once
const matimo = await MatimoInstance.init({ autoDiscover: true });

// Set globally for all decorators
setGlobalMatimoInstance(matimo);

// Now @tool decorators will use this instance
```

---

## LangChain Integration

Convert Matimo tools to LangChain tool format for AI agents.

### `convertToolsToLangChain(tools, matimo, secrets?, secretParamNames?)`

Convert Matimo tools to LangChain tools whose calls go through `matimo.execute()`, with the same policy and approval checks as a direct call.

**Signature:**

```typescript
async function convertToolsToLangChain(
  tools: ToolDefinition[],
  matimo: MatimoInstance,
  secrets?: Record<string, string>,
  secretParamNames?: Set<string>
): Promise<LangChainTool[]>;
```

**Parameters:**

- `tools` (ToolDefinition[], required) - The tools to expose; keep the list small (OpenAI accepts at most 128)
- `matimo` (MatimoInstance, required) - Initialized Matimo instance; its `onApproval` answers approval requests
- `secrets` (object, optional) - Values for secret parameters, keyed by parameter name
- `secretParamNames` (Set, optional) - Parameter names to treat as secrets, in place of the keys of `secrets`

Parameters whose names contain `TOKEN`, `KEY`, `SECRET` or `PASSWORD` are treated as secrets too: they are left out of the schema the model sees, and filled from `secrets`. Credentials in `{PLACEHOLDERS}` that no parameter declares are filled by `execute()` from `MATIMO_<NAME>` or `<NAME>` in the environment.

**Returns:** `Promise<LangChainTool[]>`

**Example:**

```typescript
import { MatimoInstance, convertToolsToLangChain } from '@matimo/core';
import { ChatOpenAI } from '@langchain/openai';
import { createAgent } from 'langchain';

const matimo = await MatimoInstance.init({
  autoDiscover: true,
  onApproval: async (request) => askUser(request), // asked before writes that need approval
});

const tools = matimo.listTools().filter((t) => t.name.startsWith('slack_'));
const langchainTools = await convertToolsToLangChain(tools, matimo);

const agent = createAgent({
  model: new ChatOpenAI({ model: 'gpt-4o-mini' }),
  tools: langchainTools,
});

const response = await agent.invoke({
  messages: [{ role: 'user', content: 'Send a message to #general saying hello' }],
});
```

For complete LangChain integration guide, see [LangChain Integration](../framework-integrations/LANGCHAIN.md).

---

## Error Handling

All SDK errors are instances of `MatimoError` with structured error codes.

### MatimoError

**Properties:**

- `message` (string) - Human-readable error message
- `code` (ErrorCode) - Machine-readable error code
- `details` (object, optional) - Additional error context

**Available Error Codes:**

```typescript
enum ErrorCode {
  INVALID_SCHEMA = 'INVALID_SCHEMA', // Tool definition invalid, or a URL parameter is missing
  INVALID_PARAMETER = 'INVALID_PARAMETER', // A parameter value cannot be encoded
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  TOOL_NOT_FOUND = 'TOOL_NOT_FOUND', // Tool name not found
  FILE_NOT_FOUND = 'FILE_NOT_FOUND', // Tool file not found
  EXECUTION_FAILED = 'EXECUTION_FAILED', // Tool error, a non-2xx HTTP response, or approval refused
  AUTH_FAILED = 'AUTH_FAILED', // Missing credentials, or HTTP 401/403
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED', // HTTP 429
  TIMEOUT = 'TIMEOUT', // Execution timeout
  NETWORK_ERROR = 'NETWORK_ERROR', // DNS failure, connection refused
  POLICY_DENIED = 'POLICY_DENIED', // Denied by policy, or quarantined and not approved
  POLICY_TIER_BLOCKED = 'POLICY_TIER_BLOCKED',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}
```

**Example:**

```typescript
import { MatimoInstance, MatimoError } from 'matimo';

const matimo = await MatimoInstance.init({ autoDiscover: true });

try {
  await matimo.execute('unknown-tool', {});
} catch (error) {
  if (error instanceof MatimoError) {
    console.error(`[${error.code}] ${error.message}`);

    // Handle specific errors
    if (error.code === 'TOOL_NOT_FOUND') {
      console.error(
        'Available tools:',
        matimo.listTools().map((t) => t.name)
      );
    }

    // View additional context
    if (error.details) {
      console.error('Details:', error.details);
    }
  }
}
```

---

## Types

Complete TypeScript type definitions.

### ToolDefinition

```typescript
interface ToolDefinition {
  name: string; // Unique tool name
  version: string; // Semantic version
  description: string; // Tool description
  parameters?: Record<string, Parameter>; // Tool parameters
  execution: HttpExecution | FunctionExecution | CommandExecution; // How to execute
  output_schema?: Record<string, unknown>; // Response schema (Zod)
  authentication?: AuthConfig; // Auth configuration
  examples?: Example[]; // Usage examples
  requires_approval?: boolean; // Whether execution needs human approval
  risk?: 'low' | 'medium' | 'high' | 'critical'; // Self-declared risk (can only raise the automatically-computed level, never lower it)
  status?: 'draft' | 'approved' | 'deprecated'; // Lifecycle status — see POLICY_AND_LIFECYCLE.md
  tags?: string[]; // Free-form categorization tags
  deprecated?: boolean;
  deprecation_message?: string;
}
```

### Parameter

```typescript
interface Parameter {
  type: string; // 'string', 'number', 'boolean', etc.
  required?: boolean; // Required flag
  description?: string; // Parameter description
  enum?: (string | number)[]; // Allowed values
  default?: unknown; // Default value
}
```

### Execution types

```typescript
type Execution =
  | {
      type: 'http';
      method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
      url: string;
      headers?: Record<string, string>;
      body?: unknown;
      query_params?: Record<string, string>;
      parameter_encoding?: ParameterEncodingConfig[];
      timeout?: number; // ms
    }
  | {
      type: 'function';
      code: string; // module path, relative to the YAML file
      timeout?: number;
    }
  | {
      type: 'command';
      command: string;
      args?: string[];
      timeout?: number;
    };
```

Exported as `HttpExecution`, `FunctionExecution` and `CommandExecution`. See [Types](TYPES.md#execution-types).

### AuthConfig

```typescript
interface AuthConfig {
  type: 'api_key' | 'bearer' | 'basic' | 'oauth2';
  location?: 'header' | 'query' | 'body'; // For api_key/bearer
  name?: string; // Header/param name
  provider?: string; // For oauth2
}
```

---

## Python SDK — `Matimo` API

Complete Python SDK reference. Mirrors the TypeScript `MatimoInstance` API with Python conventions (`snake_case`, `asyncio`).

### Table of Contents (Python)

- [`Matimo.init()`](#python-init)
- [`matimo.execute()`](#python-execute)
- [`matimo.list_tools()`](#python-list-tools)
- [`matimo.get_tool()`](#python-get-tool)
- [`matimo.search_tools()`](#python-search-tools)
- [`matimo.reload()`](#python-reload)
- [`matimo.list_skills()`](#python-list-skills)
- [`matimo.semantic_search_skills()`](#python-semantic-search-skills)
- [Decorator pattern](#python-decorators)
- [LangChain integration](#python-langchain)
- [CrewAI integration](#python-crewai)
- [Logging](#python-logging)
- [Error handling](#python-errors)

---

### `Matimo.init()` {#python-init}

```python
@classmethod
async def init(
    cls,
    tool_paths: str | list[str] | None = None,
    *,
    auto_discover: bool = False,
    skill_paths: list[str] | None = None,
    policy: PolicyEngine | None = None,
    policy_config: PolicyConfig | None = None,
    policy_file: str | None = None,
    trusted_paths: list[str] | None = None,
    untrusted_paths: list[str] | None = None,
    approval_secret: str | None = None,
    approval_dir: str | None = None,
    approval_ttl_seconds: int | None = None,
    on_event: MatimoEventHandler | None = None,
    audit_sink: AuditSink | None = None,
    on_hitl: HITLCallback | None = None,
    on_approval: ApprovalCallback | None = None,
    governance_mode: GovernanceMode | None = None,
    hitl_timeout_ms: int | None = None,
    log_level: str | None = None,
    log_format: str | None = None,
    default_max_response_size: int | None = None,
    default_skill_write_dir: str | None = None,
) -> 'Matimo'
```

Every option is a direct keyword-only argument on `init()` itself — there is no `InitOptions` wrapper object in Python (unlike an options-bag pattern you may have seen elsewhere).

**Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `tool_paths` | `str \| list[str]` | `None` | Explicit tool directories to load |
| `auto_discover` | `bool` | `False` | Load tools from installed `matimo-*` packages |
| `skill_paths` | `list[str]` | `None` | Directories containing SKILL.md files |
| `policy` | `PolicyEngine` | `None` | Custom policy engine instance. Mutually exclusive with `policy_config`/`policy_file` |
| `policy_config` | `PolicyConfig` | `None` | Shorthand to build a `DefaultPolicyEngine` with this config |
| `policy_file` | `str` | `None` | Load policy from a YAML file path |
| `trusted_paths` | `list[str]` | `None` | Paths considered developer-authored (skip content validation) |
| `untrusted_paths` | `list[str]` | `None` | Paths requiring stricter content validation |
| `approval_secret` | `str` | `None` | HMAC secret for the approval manifest. Overrides `MATIMO_APPROVAL_SECRET` env |
| `approval_dir` | `str` | `None` | Directory for `.matimo-approvals.json`. Defaults to the current working directory |
| `approval_ttl_seconds` | `int` | `None` | Approval expiry in seconds. `None` means approvals never expire |
| `on_event` | `Callable` | `None` | Event callback for audit/lifecycle events (dicts with snake_case keys) |
| `audit_sink` | `AuditSink` | `None` | Durable destination for the same events, e.g. `JsonlFileSink(path)` |
| `on_hitl` | `async Callable[[HITLRequest], bool]` | `None` | Decides calls quarantined by `policy_config.enable_hitl` |
| `on_approval` | `async Callable[[ApprovalRequest], bool]` | `None` | This instance's reviewer for calls that need approval |
| `governance_mode` | `'secure' \| 'legacy'` | `None` (secure) | `'legacy'` restores the pre-0.2.0 approval defaults |
| `hitl_timeout_ms` | `int` | `None` | Timeout for the HITL callback; `None` waits indefinitely |
| `log_level` | `str` | `None` | `'debug' \| 'info' \| 'warn' \| 'error' \| 'silent'` (resolved from env/defaults when unset) |
| `log_format` | `str` | `None` | `'simple' \| 'json'` (resolved from env/defaults when unset) |
| `default_skill_write_dir` | `str` | `None` | Where `matimo_create_skill` writes when the caller gives no `target_dir` |
| `default_max_response_size` | `int` | `None` | Instance-wide response-size cap in bytes, applied to every tool call via `execute()` unless that tool's own `output_schema.max_response_size` overrides it (falls back to a built-in 262144 / 256 KB when unset — see [Response Size Guardrail](../architecture/OVERVIEW.md#tool-execution-flow)) |

If no `policy`/`policy_config`/`policy_file` is given, `init()` always constructs a `DefaultPolicyEngine()` — a zero-config Python instance is never left ungated (this always was Python's behavior; the equivalent TypeScript `MatimoInstance.init()` was fixed to match it).

**Examples:**

```python
import asyncio
from matimo import ApprovalRequest, Matimo, PolicyConfig

# Simplest — load from a directory
matimo = await Matimo.init('./tools')

# All installed provider packages
matimo = await Matimo.init(auto_discover=True)

# Custom tools + auto-discover + policy
matimo = await Matimo.init(
    tool_paths=['./tools'],
    auto_discover=True,
    untrusted_paths=['./tools'],
    policy_config=PolicyConfig(
        allowed_domains=['api.example.com'],
        allow_command_tools=False,
    ),
    log_level='debug',
)

# With an approval callback + skills
async def my_approval_callback(request: ApprovalRequest) -> bool:
    return input(f"Approve {request.tool_name}? (y/n): ").lower() == 'y'

matimo = await Matimo.init(
    './tools',
    auto_discover=True,
    skill_paths=['./skills'],
    on_approval=my_approval_callback,
)
```

---

### `matimo.execute()` {#python-execute}

```python
async def execute(
    self,
    tool_name: str,
    params: dict[str, object],
    *,
    credentials: dict[str, str] | None = None,
    context: PolicyContext | None = None,
    approved: bool = False,
    on_approval: ApprovalCallback | None = None,
) -> object
```

`context`, `approved` and `on_approval` behave as in TypeScript: the caller's identity and roles, skip-the-prompt for a call the host already confirmed, and a reviewer for this call only.

Execute a tool by name. Raises `MatimoError` on failure. If the raw result exceeds the effective response-size cap (`output_schema.max_response_size`, else `default_max_response_size`, else a built-in 256 KB), it's truncated rather than rejected — see [Response Size Guardrail](../architecture/OVERVIEW.md#tool-execution-flow).

```python
from matimo import Matimo, MatimoError

matimo = await Matimo.init(auto_discover=True)

# Basic call
result = await matimo.execute('calculator', {'operation': 'add', 'a': 10, 'b': 5})
print(result)  # {'result': 15.0}

# Per-call credential override (multi-tenant)
result = await matimo.execute(
    'slack_send_channel_message',
    {'channel': '#general', 'text': 'Hello'},
    credentials={'SLACK_BOT_TOKEN': tenant_token},
)

# Error handling
try:
    result = await matimo.execute('unknown_tool', {})
except MatimoError as e:
    print(f"[{e.code}] {e}")
    if e.details:
        print("Details:", e.details)
```

---

### `matimo.list_tools()` {#python-list-tools}

```python
def list_tools(self) -> list[ToolDefinition]
```

Return all currently registered tools as `ToolDefinition` objects.

```python
tools = matimo.list_tools()
print(f"Loaded {len(tools)} tools")

for tool in tools:
    print(f"  {tool.name} v{tool.version} — {tool.description}")
```

---

### `matimo.get_tool()` {#python-get-tool}

```python
def get_tool(self, name: str) -> ToolDefinition | None
```

```python
tool_def = matimo.get_tool('slack_send_channel_message')
if tool_def:
    for param_name, param in (tool_def.parameters or {}).items():
        print(f"  {param_name}: {param.type}{'*' if param.required else ''}")
```

---

### `matimo.search_tools()` {#python-search-tools}

```python
def search_tools(self, query: str) -> list[ToolDefinition]
```

Case-insensitive substring search across tool `name` and `description`.

```python
slack_tools = matimo.search_tools('slack')
email_tools = matimo.search_tools('email')
```

---

### `matimo.reload()` {#python-reload}

```python
async def reload(self) -> ReloadResult
```

Hot-reload all tools from their source paths. Untrusted tools are re-validated against the active
policy — already-approved tools are checked with the looser `can_reload()` gate, everything else
with the stricter `can_create()` gate (see POLICY_AND_LIFECYCLE.md).

```python
result = await matimo.reload()
print(f"Loaded: {result.loaded}, removed: {result.removed}, rejected: {result.rejected}")
```

`ReloadResult` has `loaded`, `removed`, `revalidated`, `rejected`, and `rolled_back` fields (mirroring
TypeScript's `ReloadResult`). Note: unlike the TypeScript SDK — which snapshots the registry and
restores it on a mid-load I/O failure, setting `rolledBack: true` — Python's `reload()` does not yet
implement that snapshot/restore behavior, so `rolled_back` is currently always `False`.

---

### `matimo.list_skills()` and `matimo.semantic_search_skills()` {#python-list-skills} {#python-semantic-search-skills}

```python
def list_skills(self) -> list[SkillDefinition]

async def semantic_search_skills(
    self,
    query: str,
    limit: int = 5,
    min_score: float = 0.0,
) -> list[SemanticSearchResult]
```

```python
# List all skills
skills = matimo.list_skills()
for skill in skills:
    print(f"  {skill.name}: {skill.description}")

# Semantic search (TF-IDF)
results = await matimo.semantic_search_skills('rate limiting and retries', limit=3)
for r in results:
    print(f"  {r.name} (score: {r.score:.3f})")
```

For higher-level helpers see [LangChain Skills Integration](../framework-integrations/LANGCHAIN.md#skills-integration-non-mcp).

---

### Python Decorators {#python-decorators}

```python
from matimo import tool, set_global_matimo_instance, Matimo

matimo = await Matimo.init(auto_discover=True)
set_global_matimo_instance(matimo)

class MyAgent:
    @tool('slack_send_channel_message')
    async def send(self, channel: str, text: str) -> object:
        ...  # body never runs; decorator calls matimo.execute()

    @tool('calculator')
    async def calc(self, operation: str, a: float, b: float) -> object:
        ...

agent = MyAgent()
result = await agent.calc('add', 10, 5)  # → {'result': 15.0}
```

---

### Python LangChain Integration {#python-langchain}

```python
from matimo import Matimo, convert_tools_to_langchain
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, AIMessage, ToolMessage

matimo = await Matimo.init(auto_discover=True)
lc_tools = convert_tools_to_langchain(matimo.list_tools(), matimo)

llm = ChatOpenAI(model='gpt-4o-mini', temperature=0).bind_tools(lc_tools)
tool_map = {t.name: t for t in lc_tools}

# ReAct loop
messages = [HumanMessage(content='List Slack channels')]
for _ in range(10):
    response: AIMessage = await llm.ainvoke(messages)
    messages.append(response)
    if not response.tool_calls:
        print(response.content)
        break
    for call in response.tool_calls:
        tool_result = await tool_map[call['name']].ainvoke(call['args'])
        messages.append(ToolMessage(tool_call_id=call['id'], content=str(tool_result)))
```

**OpenAI 128-tool hard limit:** When `auto_discover=True` loads 146+ tools, bind only the subset you need:

```python
# Keep matimo_* meta-tools + specific providers
_LIMIT = 128

def cap_tools(tools, priority_names=None):
    if len(tools) <= _LIMIT:
        return tools
    pri = set(priority_names or [])
    prioritized = [t for t in tools if t.name in pri]
    rest = [t for t in tools if t.name not in pri]
    return (prioritized + rest)[:_LIMIT]

matimo_names = [t.name for t in lc_tools if t.name.startswith('matimo_')]
lc_tools_capped = cap_tools(lc_tools, priority_names=matimo_names)
llm = ChatOpenAI(model='gpt-4o-mini').bind_tools(lc_tools_capped)
```

See [LangChain Integration](../framework-integrations/LANGCHAIN.md) for the full guide.

---

### Python CrewAI Integration {#python-crewai}

```python
from crewai import Agent, Task, Crew
from langchain_openai import ChatOpenAI
from matimo import Matimo, convert_tools_to_crewai

matimo = await Matimo.init(auto_discover=True)
tools = convert_tools_to_crewai(matimo.list_tools(), matimo)

llm = ChatOpenAI(model='gpt-4o-mini')
agent = Agent(role='Slack Manager', goal='Send messages', tools=tools, llm=llm)
task = Task(description='Send a hello message to #general', agent=agent)
crew = Crew(agents=[agent], tasks=[task])

result = crew.kickoff()
```

See [CrewAI Integration](../framework-integrations/CREWAI.md) for the full guide.

---

### Python Logging {#python-logging}

```python
from matimo.logging import setup_logger, get_global_matimo_logger, set_global_matimo_logger

# Simple text format (development)
logger = setup_logger(level='debug', log_format='simple')
logger.info('Starting', component='my-agent')

# JSON structured format (production)
logger = setup_logger(level='info', log_format='json')
logger.warn('High latency', latency_ms=1200, tool='slack_send_channel_message')

# Global singleton
global_logger = get_global_matimo_logger()
global_logger.error('Failed', code='EXECUTION_FAILED')

# SDK logger access (all SDK internal logs use this)
matimo = await Matimo.init('./tools', log_level='debug', log_format='simple')
matimo._logger.debug('Custom debug message')

# Silent mode (useful for tests)
setup_logger(level='silent')
```

Log levels: `debug | info | warn | error | silent`
Formats: `simple` (human-readable) | `json` (structured, for log aggregators)

---

### Python Error Handling {#python-errors}

```python
from matimo import MatimoError
from matimo.errors import ErrorCode

try:
    result = await matimo.execute('unknown_tool', {})
except MatimoError as e:
    print(f"[{e.code}] {e}")
    # e.code is a string matching ErrorCode enum values
    if e.code == ErrorCode.TOOL_NOT_FOUND:
        available = [t.name for t in matimo.list_tools()]
        print("Available:", available[:5])
    elif e.code == ErrorCode.EXECUTION_FAILED:
        print("Details:", e.details)
```

**Error codes (same in TypeScript and Python):**

| Code | Description |
|------|-------------|
| `INVALID_SCHEMA` | Tool definition YAML failed Pydantic validation |
| `TOOL_NOT_FOUND` | No tool with that name in the registry |
| `PARAMETER_VALIDATION` | Provided params don't match the tool's schema |
| `EXECUTION_FAILED` | Tool ran but returned an error or failed output validation |
| `AUTH_FAILED` | Missing or invalid credentials |
| `TIMEOUT` | Execution exceeded timeout (HTTP executor) |
| `FILE_NOT_FOUND` | Tool definition file missing |
| `POLICY_BLOCKED` | PolicyEngine rejected the tool (blocked/deprecated) |
| `POLICY_PENDING` | Tool requires HITL approval before execution |

---

## See Also

- [Quick Start](../getting-started/QUICK_START.md) — 5-minute guide
- [SDK Patterns](../user-guide/SDK_PATTERNS.md) — Factory, Decorator, LangChain patterns
- [LangChain Integration](../framework-integrations/LANGCHAIN.md) — AI agent integration
- [Architecture Overview](../architecture/OVERVIEW.md) — System design
