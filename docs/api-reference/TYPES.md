# TypeScript Type Definitions Reference

Complete type definitions for the Matimo TypeScript SDK.

## Core Types

### ToolDefinition

Complete tool definition structure.

```typescript
interface ToolDefinition {
  name: string;
  description: string;
  version: string;

  parameters?: Record<string, Parameter>;
  execution: HttpExecution | CommandExecution | FunctionExecution;
  output_schema?: OutputSchema;
  authentication?: AuthConfig;
  rate_limiting?: RateLimitConfig;
  error_handling?: ErrorHandlingConfig;
  examples?: ToolExample[];

  // Governance
  requires_approval?: boolean;                        // ask a human before every call
  risk?: 'low' | 'medium' | 'high' | 'critical';      // can raise, never lower, the computed risk
  status?: 'draft' | 'approved' | 'deprecated';
  deprecated?: boolean;
  deprecation_message?: string;

  tags?: string[];
}
```

**Example:**

```typescript
const tool: ToolDefinition = {
  name: 'calculator',
  description: 'Perform basic math operations',
  version: '1.0.0',
  parameters: {
    operation: {
      type: 'string',
      enum: ['add', 'subtract', 'multiply', 'divide'],
      required: true,
    },
    a: { type: 'number', required: true },
    b: { type: 'number', required: true },
  },
  execution: {
    type: 'command',
    command: 'node calculator.js',
    args: ['--op', '{operation}', '{a}', '{b}'],
  },
};
```

---

### Parameter

Define a single tool parameter.

```typescript
interface Parameter {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description?: string;
  required?: boolean;
  default?: unknown;

  // String constraints
  minLength?: number;
  maxLength?: number;
  pattern?: string;

  // Number constraints
  minimum?: number;
  maximum?: number;

  // Enum constraint
  enum?: unknown[];

  // Array/Object items
  items?: Parameter;
  properties?: Record<string, Parameter>;
}
```

**Examples:**

```typescript
// String parameter with enum
const operation: Parameter = {
  type: 'string',
  enum: ['add', 'subtract', 'multiply', 'divide'],
  required: true,
};

// Number with range
const count: Parameter = {
  type: 'number',
  minimum: 1,
  maximum: 100,
  required: true,
};

// Optional string with pattern
const email: Parameter = {
  type: 'string',
  pattern: '^[^@]+@[^@]+\\.[^@]+$',
  required: false,
};

// Array parameter
const tags: Parameter = {
  type: 'array',
  items: { type: 'string' },
  required: false,
};
```

---

### Execution types

`ToolDefinition.execution` is one of three shapes, chosen by `type`.

```typescript
interface HttpExecution {
  type: 'http';
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  url: string;
  headers?: Record<string, string>;
  body?: unknown;
  params?: Record<string, string>;
  query_params?: Record<string, string>;
  parameter_encoding?: ParameterEncodingConfig[];
  timeout?: number; // ms
}

interface FunctionExecution {
  type: 'function';
  code: string; // module path, relative to the YAML file
  timeout?: number; // ms
}

interface CommandExecution {
  type: 'command';
  command: string;
  args?: string[];
  cwd?: string;
  shell?: boolean;
  timeout?: number; // ms
  env?: Record<string, string>;
}
```

**Examples:**

```typescript
import type { HttpExecution, FunctionExecution } from '@matimo/core';

// HTTP execution
const httpExecution: HttpExecution = {
  type: 'http',
  method: 'POST',
  url: 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
  headers: {
    Authorization: 'Bearer {GMAIL_ACCESS_TOKEN}',
    'Content-Type': 'application/json',
  },
  body: { raw: '{raw}' },
  timeout: 15000,
};

// Function execution
const functionExecution: FunctionExecution = {
  type: 'function',
  code: './calculator.ts',
};
```

---

### AuthConfig

Authentication configuration.

```typescript
interface AuthConfig {
  type: 'oauth2' | 'api_key' | 'basic' | 'bearer';
  provider?: string;
  required_scopes?: string[];
  location?: 'header' | 'query' | 'body';
  parameter_name?: string;
}
```

**Examples:**

```typescript
// OAuth2
const oauth2: AuthConfig = {
  type: 'oauth2',
  provider: 'google',
  required_scopes: ['https://www.googleapis.com/auth/gmail.send'],
};

// API Key
const apiKey: AuthConfig = {
  type: 'api_key',
  location: 'header',
  parameter_name: 'X-API-Key',
};

// Bearer token
const bearer: AuthConfig = {
  type: 'bearer',
  location: 'header',
  parameter_name: 'Authorization',
};
```

---

### OutputSchema

Defines tool output structure.

```typescript
interface OutputSchema {
  type: 'object' | 'string' | 'number' | 'array' | 'boolean';
  description?: string;
  properties?: Record<string, OutputSchema>;
  items?: OutputSchema;
  required?: string[];
  max_response_size?: number; // Bytes. Overrides the instance/default response-size cap for this tool.
}
```

**Example:**

```typescript
const schema: OutputSchema = {
  type: 'object',
  properties: {
    result: { type: 'number' },
    calculation: { type: 'string' },
    timestamp: { type: 'string' },
  },
  required: ['result'],
};
```

---

### ErrorHandlingConfig

Retry settings a tool can declare. The schema accepts them, but neither SDK applies them yet: a failed call is not retried.

```typescript
interface ErrorHandlingConfig {
  retry?: number;
  backoff_type?: 'exponential' | 'linear' | 'fixed';
  initial_delay_ms?: number;
  max_delay_ms?: number;
}
```

---

## Runtime Types

### MatimoInstance

Main SDK class for tool execution.

```typescript
class MatimoInstance {
  static init(options?: InitOptions | string): Promise<MatimoInstance>;

  listTools(context?: PolicyContext): ToolDefinition[];
  getTool(name: string): ToolDefinition | undefined;
  getToolsByTag(tag: string): ToolDefinition[];
  searchTools(query: string): ToolDefinition[];

  execute(toolName: string, params: Record<string, unknown>, options?: ExecuteOptions): Promise<unknown>;
}
```

See the [SDK reference](SDK.md) for every option and method.

---

### MatimoEvent

Every governance decision and tool run is emitted to `onEvent` (and to `auditSink`, if set). Python emits the same events as dicts with snake_case keys (`tool_name`, `duration_ms`, `risk_level`, ...).

| `type` | Extra fields | When |
|--------|--------------|------|
| `tool:executed` | `toolName`, `traceId`, `durationMs`, `success`, `riskLevel`, `agentId?` | A tool ran to completion. `success` is `false` when it returned `{ success: false }` |
| `tool:execution_failed` | `toolName`, `traceId`, `durationMs`, `riskLevel`, `errorCode`, `error`, `agentId?` | A tool that passed every gate threw (for example an HTTP 4xx/5xx) |
| `tool:execution_denied` | `toolName`, `reason`, `agentId?` | The policy engine refused the call |
| `tool:quarantined` | `toolName`, `riskLevel`, `reason`, `environment?` | A call is waiting for `onHITL`, or a reload quarantined an untrusted tool |
| `tool:quarantine_approved` | `toolName` | A quarantined call was let through (by `onHITL` or a stored approval) |
| `tool:quarantine_rejected` | `toolName` | A quarantined call was refused (including when there is no `onHITL`) |
| `tool:approval_granted` | `toolName`, `agentId?` | A call that needed approval was approved |
| `tool:approval_denied` | `toolName`, `reason`, `agentId?` | A call that needed approval was refused, or nobody could answer |
| `tool:rejected` | `toolName`, `violations` | A reload refused an untrusted tool |
| `tools:reloaded` | `loaded`, `removed`, `rejected` | Tools were reloaded |
| `skills:reloaded` | `loaded`, `removed` | Skills were reloaded |
| `skill:created` | `skillName`, `source` | `matimo_create_skill` wrote a skill |
| `policy:reloaded` | — | `reloadPolicy()` swapped the policy engine (TypeScript only) |

Every event also has an ISO-8601 `timestamp`. `tool:created`, `tool:approved` and `tool:revoked` are declared in the type but not emitted yet.

```typescript
const matimo = await MatimoInstance.init({
  autoDiscover: true,
  onEvent: (event) => {
    if (event.type === 'tool:execution_failed') {
      console.error(`${event.toolName} failed [${event.errorCode}] after ${event.durationMs}ms`);
    }
  },
  auditSink: new JsonlFileSink('./matimo-audit.jsonl'), // hash-chained; check with verifyAuditLog()
});
```

---

### MatimoError

Error returned by SDK.

```typescript
interface MatimoError extends Error {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  statusCode?: number;
}
```

**Example:**

```typescript
try {
  await m.execute('unknown-tool', {});
} catch (error) {
  const matimoError = error as MatimoError;
  console.log(matimoError.code); // 'TOOL_NOT_FOUND'
  console.log(matimoError.message); // 'Tool not found'
  console.log(matimoError.details); // { toolName: 'unknown-tool' }
}
```

---

## Validation Types

### ValidationError

Schema validation error.

```typescript
interface ValidationError {
  field: string;
  message: string;
  expected?: string;
  actual?: string;
}
```

---

## Complete Type Examples

### Using TypeScript Types in Code

```typescript
import {
  ToolDefinition,
  Parameter,
  HttpExecution,
  AuthConfig,
  OutputSchema,
  ErrorHandlingConfig,
  MatimoInstance,
  MatimoError,
} from 'matimo';

// Load and type tool
const tool: ToolDefinition = matimo.getTool('calculator')!;

// Type parameters
const params: Record<string, unknown> = {
  operation: 'add',
  a: 5,
  b: 3,
};

// Execute with types
try {
  const result = await matimo.execute('calculator', params);
  console.log(result); // { result: 8 }, or { success: false, error, code } for bad input (TypeScript)
} catch (error) {
  const matimoError = error as MatimoError;
  if (matimoError.code === 'POLICY_DENIED') {
    console.error('Blocked:', matimoError.details);
  }
}
```

---

### TypeScript Strict Mode

All Matimo types are **strict**. Never use `any`:

```typescript
// ❌ DON'T
const params: any = { ... };

// ✅ DO
const params: Record<string, unknown> = { ... };

// ✅ BETTER (fully typed)
interface CalculatorParams {
  operation: 'add' | 'subtract' | 'multiply' | 'divide';
  a: number;
  b: number;
}
const params: CalculatorParams = { ... };
```

---

## Next Steps

- **Error Codes**: [Error Reference](./ERRORS.md)
- **API Methods**: [SDK API Reference](./SDK.md)
- **Tool Definition**: [YAML Tool Specification](../tool-development/YAML_TOOLS.md)
