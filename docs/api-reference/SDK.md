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

- `options` (InitOptions | string, optional) - Initialization configuration
  - `InitOptions` object:
    - `autoDiscover` (boolean, optional) - Automatically discover tools from `node_modules/@matimo/*` packages
    - `toolPaths` (string[], optional) - Array of explicit tool directory paths
    - `includeCore` (boolean, optional) - Include core built-in tools (default: true when using InitOptions)
  - String: Backward-compatible single directory path (e.g., `'./tools'`)

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

// Backward compatibility - single directory
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
}
```

**Parameters:**

- `toolName` (string, required) - Exact name of the tool to execute
- `params` (object, required) - Tool parameters (must match tool's parameter schema)
- `options.timeout` (number, optional) - Execution timeout in milliseconds
- `options.credentials` (object, optional) - Per-call credential overrides (see Multi-tenant Usage below)

**Returns:** `Promise<unknown>` - Tool result (validated against output schema)

**Throws:**

- `MatimoError(TOOL_NOT_FOUND)` - If tool name doesn't exist
- `MatimoError(PARAMETER_VALIDATION)` - If params don't match tool schema
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
    credentials: { GITHUB_ACCESS_TOKEN: 'ghp-tenant-c-token' },
  }
);
```

**Credential key naming convention:**

Credential keys must match the env-var names the tool's YAML definition
references (e.g. `SLACK_BOT_TOKEN`, `GITHUB_ACCESS_TOKEN`). The credential
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
//   'github-create-issue':  ['GITHUB_ACCESS_TOKEN'],
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

const matimo = await MatimoInstance.init('./tools');
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

  @tool('slack-get-channel')
  async getChannel(name: string) {
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

### `convertToolsToLangChain(tools, matimo, secrets)`

Convert Matimo tools to LangChain tool schema with integrated execution.

**Signature:**

```typescript
function convertToolsToLangChain(
  tools: ToolDefinition[],
  matimo: MatimoInstance,
  secrets?: Record<string, string>
): LanguageModelToolUse[];
```

**Parameters:**

- `tools` (ToolDefinition[], required) - Tools from `matimo.listTools()`
- `matimo` (MatimoInstance, required) - Initialized Matimo instance
- `secrets` (object, optional) - Environment variables for authentication
  - Automatically detects params ending in TOKEN, KEY, SECRET, PASSWORD
  - Injects from env vars: `process.env.MATIMO_{TOOL_NAME}_{PARAM_NAME}`

**Returns:** `LanguageModelToolUse[]` - LangChain-compatible tool definitions

**Example:**

```typescript
import { MatimoInstance, convertToolsToLangChain } from 'matimo';
import { ChatOpenAI } from '@langchain/openai';
import { createAgent } from './agent-utils';

const matimo = await MatimoInstance.init({ autoDiscover: true });

const tools = matimo.listTools();
const langchainTools = convertToolsToLangChain(tools, matimo);

// Use with LangChain agent
const model = new ChatOpenAI({ modelName: 'gpt-4o-mini' });
const agent = await createAgent({
  model,
  tools: langchainTools,
  instructions: 'You are a helpful Slack assistant',
});

// Agent automatically selects and executes tools
const response = await agent.invoke({
  input: 'Send a message to #general saying hello',
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
  INVALID_SCHEMA = 'INVALID_SCHEMA', // Tool definition invalid
  TOOL_NOT_FOUND = 'TOOL_NOT_FOUND', // Tool name not found
  PARAMETER_VALIDATION = 'PARAMETER_VALIDATION', // Params don't match schema
  EXECUTION_FAILED = 'EXECUTION_FAILED', // Tool execution error
  AUTH_FAILED = 'AUTH_FAILED', // Authentication error
  TIMEOUT = 'TIMEOUT', // Execution timeout
  FILE_NOT_FOUND = 'FILE_NOT_FOUND', // Tool file not found
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
  execution: ExecutionConfig; // How to execute
  output_schema?: Record<string, unknown>; // Response schema (Zod)
  authentication?: AuthConfig; // Auth configuration
  examples?: Example[]; // Usage examples
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

### ExecutionConfig

```typescript
type ExecutionConfig =
  | {
      type: 'command';
      command: string;
      args?: string[];
    }
  | {
      type: 'http';
      method: string;
      url: string;
      headers?: Record<string, string>;
      body?: Record<string, unknown>;
    }
  | {
      type: 'function';
      function: string; // Path to function
    };
```

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
    tool_paths: list[str] | str | None = None,
    options: InitOptions | None = None,
    *,
    auto_discover: bool = False,
    untrusted_paths: list[str] | None = None,
    policy_config: PolicyConfig | None = None,
    policy_file: str | None = None,
    skill_paths: list[str] | None = None,
    log_level: str = 'info',
    log_format: str = 'simple',
    on_hitl: Callable | None = None,
    on_event: Callable | None = None,
) -> 'Matimo'
```

**Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `tool_paths` | `list[str] \| str` | `None` | Explicit tool directories to load |
| `auto_discover` | `bool` | `False` | Load tools from installed `matimo-*` packages |
| `untrusted_paths` | `list[str]` | `None` | Paths requiring stricter content validation |
| `policy_config` | `PolicyConfig` | `None` | Policy engine configuration |
| `policy_file` | `str` | `None` | Load policy from a YAML file path |
| `skill_paths` | `list[str]` | `None` | Directories containing SKILL.md files |
| `log_level` | `str` | `'info'` | `'debug' \| 'info' \| 'warn' \| 'error' \| 'silent'` |
| `log_format` | `str` | `'simple'` | `'simple' \| 'json'` |
| `on_hitl` | `async Callable` | `None` | Human-in-the-loop callback for approval requests |
| `on_event` | `Callable` | `None` | Event callback for lifecycle events |

**Examples:**

```python
import asyncio
from matimo import Matimo
from matimo.policy.types import PolicyConfig

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
        blocked_commands=['rm', 'curl'],
    ),
    log_level='debug',
)

# With HITL callback + skills
async def my_approval_callback(request):
    print(f"Approve {request.tool_name}? (y/n): ", end='', flush=True)
    answer = input()
    return {'approved': answer.lower() == 'y', 'reason': 'manual review'}

matimo = await Matimo.init(
    './tools',
    auto_discover=True,
    skill_paths=['./skills'],
    on_hitl=my_approval_callback,
)
```

---

### `matimo.execute()` {#python-execute}

```python
async def execute(
    self,
    tool_name: str,
    params: dict[str, object],
    credentials: dict[str, str] | None = None,
) -> object
```

Execute a tool by name. Raises `MatimoError` on failure.

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
    print(f"[{e.code}] {e.message}")
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

Hot-reload all tools from their source paths. Atomic — rolls back on error.

```python
result = await matimo.reload()
print(f"Reloaded {result.reloaded_count} tools")
if result.rolled_back:
    print("Registry was rolled back due to an error")
```

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
    print(f"[{e.code}] {e.message}")
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
