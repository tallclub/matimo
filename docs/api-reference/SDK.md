# API Reference — Complete SDK

Complete reference for the Matimo TypeScript SDK. For a simpler introduction, see [Quick Start](../getting-started/QUICK_START.md) or [SDK Patterns](../user-guide/SDK_PATTERNS.md).

## Table of Contents

- [MatimoInstance](#matimoinstance)
  - [init()](#initoptions)
  - [execute()](#executetoolname-params)
  - [getRequiredCredentials()](#getrequiredcredentialstoolname)
  - [listTools()](#listtools)
  - [getTool()](#gettoolname)
  - [searchTools()](#searchtoolsquery)
- [Decorators](#decorators)
  - [@tool()](#toolttoolname)
  - [setGlobalMatimoInstance()](#setglobalmatimoinstanceinstance)
- [LangChain Integration](#langchain-integration)
- [Error Handling](#error-handling)
- [Types](#types)

---

## MatimoInstance

Main entry point for the Matimo SDK. Initialize once at startup, then execute tools as needed.

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

## See Also

- [Quick Start](../getting-started/QUICK_START.md) — 5-minute guide
- [SDK Patterns](../user-guide/SDK_PATTERNS.md) — Factory, Decorator, LangChain patterns
- [LangChain Integration](../framework-integrations/LANGCHAIN.md) — AI agent integration
- [Architecture Overview](../architecture/OVERVIEW.md) — System design
