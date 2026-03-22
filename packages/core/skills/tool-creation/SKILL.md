---
name: tool-creation
description: Create tools for the Matimo SDK. Understand YAML tool definitions, execution types, authentication, parameter validation, and quality standards. Apply this skill when implementing Matimo tools.
metadata:
  category: "Tool Development"
  difficulty: "intermediate"
  user-invokable: "true"
---

# Tool Creation for Matimo SDK

This skill teaches you how to properly create, configure, and validate tools for the **Matimo SDK**—a configuration-driven framework where tools are defined once in YAML and executed everywhere (factory pattern, decorators, LangChain).

> **Two audiences — know which one you are:**
>
> | You are an **Agent at runtime** | You are an **SDK developer** |
> |---|---|
> | Creating tools dynamically via `matimo_create_tool` | Adding tools to the SDK codebase |
> | Tools go to `./matimo-tools/{tool-name}/definition.yaml` (configured by developer) | Tools go to `packages/{provider}/tools/{tool-name}/definition.yaml` |
> | Validate with `matimo_doctor` (meta-tool) | Validate with `pnpm validate-tools` (CLI) |
> | Approval needed: `matimo_approve_tool` → `matimo_reload_tools` | No approval flow — merged via git |
>
> **If you are an agent using meta-tools, follow the "Agent at runtime" column throughout this skill.**

## Matimo Architecture Overview

### Tool Execution Flow

```
Tool Definition (YAML)
         ↓
    ToolLoader (parse & validate)
         ↓
    ToolRegistry (in-memory store)
         ↓
MatimoInstance.execute(name, params)
         ↓
  Select Executor Based on execution.type
         ↓
CommandExecutor | HttpExecutor | FunctionExecutor
         ↓
  Validate output against output_schema
         ↓
    Return structured result
```

### Key Concepts

- **Tools are YAML-first**: Define once in YAML, execute anywhere
- **Always include `requires_approval: true`**: Required by policy for all agent-created tools
- **Default execution type is `http`**: `command` and `function` types are **blocked by policy by default** — only use `http` unless the developer has explicitly enabled the others
- **Parameter templating**: Use `{paramName}` syntax for dynamic values
- **Authentication**: Provider-agnostic (API key, bearer, basic, OAuth2)
- **Output validation**: All responses validated against Zod schemas
- **Error handling**: Structured errors with retry/backoff policies

> ⚠️ **Policy defaults block `command` and `function` tools.** Always use `type: http` unless you have confirmed the developer has set `allowCommandTools: true` or `allowFunctionTools: true` in the policy. Creating a `command` or `function` tool without explicit policy permission will fail validation.

### File Structure

**Agent at runtime** (using `matimo_create_tool`):
```
{target_dir}/{tool-name}/              ← target_dir is configured by the developer
└── definition.yaml                    ← Tool YAML — written by meta-tool
```
Default `target_dir` is `./matimo-tools` unless overridden. The approved tool **stays in this path permanently** — it is NOT cleared on restart. The `ApprovalManifest` (`.matimo-approvals.json`) is stored in the same directory.

**SDK developer** (adding to codebase):
```
packages/{provider}/tools/{tool-name}/
├── definition.yaml                    ← Tool configuration
└── index.ts                          ← Executor script (if type: command)
```

### Agent Tool Lifecycle (runtime creation)

```
matimo_doctor(yaml_content)             ← 1. Validate YAML + policy FIRST
         ↓ { valid: true }
matimo_create_tool(name, yaml_content, target_dir)
         ↓ writes {target_dir}/{name}/definition.yaml
         ↓ status: "draft", approvalState: "pending"
matimo_approve_tool(name, tool_dir)     ← 3. Human approves
         ↓ status updated to "approved" in same file
         ↓ .matimo-approvals.json written to target_dir
matimo_reload_tools()                   ← 4. Hot-reload registry
         ↓ approved tool is now live and executable
matimo.execute(tool-name, params)       ← 5. Use the tool
```

> ✅ **Approved tools are stored permanently** in `target_dir` on disk. They survive restarts as long as `target_dir` is included in Matimo's `toolPaths` config. They are NOT stored in temp directories — that is only used in demo examples.

## When Creating Tools

Apply this skill when:
- An agent needs to **create a new tool at runtime** (use meta-tools workflow above)
- **Defining tool YAML** structure (applies to both agents and SDK developers)
- Configuring **authentication**, **parameter templating**, or **output validation**
- An SDK developer is **adding a new provider package** (e.g., GitHub, AWS, Notion)


## Tool Definition Structure

### Minimal Valid Tool (HTTP)

```yaml
name: tool_name                           # snake_case, unique across all tools
description: What this tool does          # Clear, specific description
version: '1.0.0'
requires_approval: true                    # Must be true for agent-created tools

parameters:                               # User-provided inputs
  required_param:
    type: string                          # string, number, boolean, object, array
    required: true
    description: What this parameter does

execution:
  type: http                              # Type: http, command, or function
  method: POST
  url: 'https://api.example.com/v1/resource'
  headers:
    Authorization: 'Bearer {AUTH_TOKEN}'  # Template with env vars
  body:
    field: '{required_param}'             # Template with parameters

authentication:
  type: api_key                           # Define how auth is handled
  location: header
  name: Authorization

output_schema:                            # Response must match this schema
  type: object
  properties:
    success:
      type: boolean
  required:
    - success

examples:
  - name: "Basic usage"
    params:
      required_param: "value"
```

---

## Execution Types

> **Policy Rule:** By default, `command` and `function` execution types are **blocked** (`allowCommandTools: false`, `allowFunctionTools: false`). The safe default is `type: http`. Before using `command` or `function`, always run `matimo_doctor` to check if the policy in your environment allows it.

### Type: HTTP ✅ Always Allowed

For REST API integrations (Slack, GitHub, AWS, etc.):

```yaml
execution:
  type: http
  method: POST                          # GET, POST, PUT, DELETE, PATCH
  url: 'https://api.example.com/endpoint'
  timeout_ms: 30000
  headers:
    Authorization: 'Bearer {API_TOKEN}'
    Content-Type: application/json
  query_params:
    filter: '{paramName}'
  body:
    channel: '{channel}'
    message: '{text}'
```

**Key patterns:**
- Templating: `{paramName}` replaced with actual parameter values
- Auth template: `{API_TOKEN}` replaced with `MATIMO_{TOOL_NAME}_API_KEY` env var
- Headers/query/body all support templating
- Timeouts default to 30000ms (30 seconds)

### Type: Command ⛔ Blocked by Default

> **Policy:** `allowCommandTools: false` by default. Creating a `command` tool will fail `matimo_doctor` unless the developer has explicitly set `allowCommandTools: true`. Do not attempt to create command tools unless you have confirmed this is allowed.

If allowed by policy:

```yaml
execution:
  type: command
  command: 'tsx'                        # Executable to run
  timeout_ms: 30000
  args:
    - 'packages/provider/tool/executor.ts'
    - '--param'
    - '{paramValue}'
```

**Key patterns:**
- Command executor receives templated args
- Executor must output JSON to stdout
- Parse args with Node's `parseArgs` utility
- Use `getGlobalMatimoLogger()` for logging, never bare `console.log`

### Type: Function ⛔ Blocked by Default

> **Policy:** `allowFunctionTools: false` by default. Creating a `function` tool will fail `matimo_doctor` unless the developer has explicitly set `allowFunctionTools: true`. Do not attempt to create function tools unless you have confirmed this is allowed.

If allowed by policy:

```yaml
execution:
  type: function
  handler: 'execute'                    # Function name in code block
  code: |
    export async function execute(params) {
      return { success: true, data: params };
    }
```

**Key patterns:**
- Handler function receives `params` object
- Must return object matching `output_schema`
- Can be async
- No file I/O or CLI access

---

## Authentication Configuration

> ❌ **NEVER write placeholder text in YAML** — strings like `YOUR_API_KEY`, `API_KEY_HERE`, or `replace_me` are **invalid**. They will be sent to the API as-is and cause authentication failures.
>
> ✅ **Always use `{VARIABLE_NAME}` template syntax.** The system replaces these at execution time from environment variables.

### API Key (Header)

```yaml
authentication:
  type: api_key
  location: header                      # Or: query, body
  name: Authorization
```

Environment variable: `MATIMO_{TOOL_NAME}_API_KEY`

When executing, the system injects: `Authorization: Bearer <key-from-env>`

### API Key (Query Parameter)

Some APIs (e.g., weatherapi.com, OpenWeatherMap) require the key in the URL query string, not a header:

```yaml
execution:
  type: http
  method: GET
  url: 'https://api.weatherapi.com/v1/current.json'
  query_params:
    key: '{WEATHER_API_KEY}'            # ✅ Template — resolved from env at runtime
    q: '{city}'

authentication:
  type: api_key
  location: query
  name: key
```

Set the key via environment variable before running: `WEATHER_API_KEY=your_actual_key`

> ⚠️ Never embed the key directly in the URL string like `?key=abc123` — use the `query_params` map with `{VAR_NAME}` templating.

### Bearer Token

```yaml
authentication:
  type: bearer
```

Environment variable: `MATIMO_{TOOL_NAME}_BEARER_TOKEN`

Injected as: `Authorization: Bearer <token>`

### Basic Auth

```yaml
authentication:
  type: basic
  username_env: MATIMO_{TOOL_NAME}_USERNAME
  password_env: MATIMO_{TOOL_NAME}_PASSWORD
```

Encodes as `Authorization: Basic base64(username:password)`

### OAuth2

```yaml
authentication:
  type: oauth2
  provider: google                      # google, github, slack, etc.
  scopes:
    - 'https://www.googleapis.com/auth/drive'
```

OAuth configuration defined in provider's `definition.yaml`. System handles authorization code → token exchange.

---

## Parameter Definition

### Basic Parameters

```yaml
parameters:
  name:
    type: string                        # string, number, boolean, object, array
    required: true
    description: Parameter description
```

### With Constraints

```yaml
parameters:
  email:
    type: string
    required: true
    pattern: '^[^\s@]+@[^\s@]+\.[^\s@]+$'    # Email regex validation
  
  priority:
    type: string
    enum:
      - low
      - medium
      - high                            # Restrict to specific values
  
  timeout:
    type: number
    min: 1
    max: 300
    default: 30                         # Use if not provided
  
  port:
    type: number
    min: 1
    max: 65535
  
  count:
    type: number
    min_length: 0
    max_length: 100                     # For strings
```

### Parameter Templating in Execution

```yaml
execution:
  type: http
  body:
    filter: '{priority}'                # Replaced with actual value
    count: '{count}'                    # Numbers automatically stringified
    tags:
      - '{tag1}'
      - '{tag2}'
```

When executing with `{ priority: 'high', count: 42, tag1: 'urgent', tag2: 'system' }`:
- `{priority}` → `"high"`
- `{count}` → `"42"`
- `{tag1}`, `{tag2}` → array elements

---

## Output Schema Validation

All tools must define `output_schema`. Responses are validated with Zod:

```yaml
output_schema:
  type: object
  properties:
    success:
      type: boolean
      description: Operation success
    
    data:
      type: object
      description: Response data
      properties:
        id:
          type: string
        timestamp:
          type: string
        count:
          type: number
    
    error:
      type: object
      description: Error details (if failed)
  
  required:
    - success
```

**Execution behavior:**
1. Tool executes (HTTP, command, or function)
2. Response parsed and validated against schema
3. If validation fails → `MatimoError(INVALID_SCHEMA, ...)`
4. If validation succeeds → result returned to caller

---

## Error Handling & Retry Policies

```yaml
error_handling:
  retry: 3                              # Retry up to 3 times
  backoff_type: exponential             # exponential or linear
  initial_delay_ms: 500                 # First retry delay
  max_delay_ms: 30000                   # Maximum delay between retries
  retry_on_status:                      # HTTP status codes to retry
    - 429                               # Rate limited
    - 500                               # Server error
    - 503                               # Service unavailable
```

**Retry behavior:**
- Delay = `initial_delay_ms * (backoff_exponent ^ attempt_number)`
- Capped at `max_delay_ms`
- Only retries on specified HTTP status codes
- Non-2xx responses still validated against schema

---

## Command Executor Implementation

> ⚠️ **Only applicable if `allowCommandTools: true` is set in policy.** If you are unsure, run `matimo_doctor` on your YAML first — it will fail immediately if command tools are blocked.

For `type: command` tools, create an executor at `packages/{provider}/tools/{tool-name}/index.ts`:

```typescript
import { parseArgs } from 'util';
import { getGlobalMatimoLogger } from '@matimo/core';

interface ExecutorParams {
  channel: string;
  text?: string;
}

async function main() {
  const logger = getGlobalMatimoLogger();
  
  try {
    // Parse command-line arguments
    const { values } = parseArgs({
      options: {
        channel: { type: 'string' },
        text: { type: 'string' }
      }
    });
    
    // Validate required params
    if (!values.channel) {
      throw new Error('channel is required');
    }
    
    const params: ExecutorParams = {
      channel: values.channel as string,
      text: values.text
    };
    
    // Execute business logic
    const result = await executeLogic(params);
    
    // Output as JSON
    console.log(JSON.stringify(result));
  } catch (error) {
    logger.error('Executor failed', {
      error: error instanceof Error ? error.message : String(error)
    });
    
    console.log(JSON.stringify({
      success: false,
      message: error instanceof Error ? error.message : String(error)
    }));
    
    process.exit(1);
  }
}

async function executeLogic(params: ExecutorParams) {
  // Your actual logic here
  return {
    success: true,
    message: 'Operation completed',
    data: { channel: params.channel }
  };
}

main();
```

**Key guidelines:**
- Always use `getGlobalMatimoLogger()`, never bare `console.log` in core code
- Validate all parameters
- Output JSON with structure matching `output_schema`
- Exit with code 1 on error
- Never log secrets

---

## Code Quality Standards

### Zod Validation

All parameter parsing must use Zod:

```typescript
import { z } from 'zod';

const ParamSchema = z.object({
  channel: z.string().min(1),
  text: z.string().optional(),
  timeout: z.number().min(1).max(300).default(30)
});

const params = ParamSchema.parse(input);  // Throws if invalid
```

### Error Handling

Use `MatimoError` with structured error codes:

```typescript
import { MatimoError, ErrorCode } from '@matimo/core';

throw new MatimoError(
  'API request failed',
  ErrorCode.EXECUTION_FAILED,
  {
    toolName: 'slack_send',
    statusCode: 500,
    details: { message: 'Server error' }
    // Never include secrets
  }
);
```

Error codes:
- `INVALID_SCHEMA` — Parameter or response validation failed
- `EXECUTION_FAILED` — Tool execution failed
- `AUTH_FAILED` — Authentication missing or invalid
- `TOOL_NOT_FOUND` — Tool definition not found

### Type Safety

- Use strict TypeScript (no `any` type)
- Export types alongside implementations
- Use discriminated unions: `{ type: 'command', command: string }`
- Never trust user input without validation

---

## Strict Rules & Enforcement Standards

These rules are **non-negotiable** for all Matimo tools. Violations block tool approval.

### 1. Naming Conventions (STRICT)

**Tool Names:**
- ✅ MUST use `snake_case` (e.g., `slack_send_message`, `github_create_issue`)
- ✅ MUST be globally unique across all providers
- ✅ MUST describe the action clearly (no abbreviations like `slack_msg`)
- ❌ NO camelCase, PascalCase, or kebab-case
- ❌ NO generic names like `execute` or `run`

**Parameters (YAML):**
- ✅ MUST use `camelCase` (e.g., `channelId`, `messageText`, `retryCount`)
- ✅ MUST be descriptive and match API conventions
- ❌ NO snake_case in parameter names
- ❌ NO single-letter parameters (except standard `a`, `b` in math examples)

**Parameters (TypeScript/JavaScript):**
- ✅ MUST use `camelCase` for variables (e.g., `const channelId = ...`)
- ✅ Class/function names MUST use `PascalCase` (e.g., `SlackClient`, `parseResponse()`)
- ✅ Constants MUST use `UPPER_SNAKE_CASE` (e.g., `MAX_RETRIES`, `API_TIMEOUT_MS`)
- ✅ Private methods MUST use `#` prefix (e.g., `#validateResponse()`)
- ❌ NO inconsistent casing within a single tool

**Provider Packages:**
- ✅ MUST use `snake_case` (e.g., `@matimo/slack`, `@matimo/github`)
- ✅ Directory path: `packages/{provider}/tools/{tool_name}/`
- ❌ NO uppercase letters in directory names

**Example (Correct):**
```yaml
# packages/slack/tools/slack_send_message/definition.yaml
name: slack_send_message
parameters:
  channelId:        # camelCase
    type: string
    required: true
  messageText:      # camelCase
    type: string
```

### 2. Tool Completeness (CRITICAL)

**All tools MUST be fully functional:**

✅ **Required Elements:**
- ☑️ Tool definition YAML must be complete and valid
- ☑️ All parameters in YAML must be documented with type, description, required
- ☑️ All examples in YAML must match the defined parameters (no extra/missing params)
- ☑️ All referenced environment variables MUST be documented in description
- ☑️ Output schema MUST match actual API response structure
- ☑️ Error handling MUST cover all documented failure modes
- ☑️ Executor code (if `type: command`) must be fully implemented
- ☑️ Authentication setup must be tested and working
- ☑️ Tool must execute without errors in all example scenarios

❌ **Never Allow:**
- Stub implementations with TODO comments
- @TODO, FIXME, XXX, HACK comments in production code
- @ts-ignore, eslint-disable comments (fix the actual issue)
- Placeholder values in examples
- "Coming soon" features
- Incomplete authentication configuration

**Completeness Checklist:**
```
Before submitting a tool:
[ ] Tool YAML parses without errors (pnpm validate-tools)
[ ] All parameters in YAML have type + description + required
[ ] All examples match parameter definitions exactly
[ ] Output schema matches real API responses
[ ] Error handling uses MatimoError with ErrorCode
[ ] Tests pass with 80%+ coverage (pnpm test:coverage)
[ ] No console.log in main code (use logger)
[ ] No env var references without documentation
[ ] Tool executes successfully in all examples
[ ] No TODO/FIXME/XXX/HACK comments
[ ] No @ts-ignore, eslint-disable comments
```

### 3. Parameter Validation (STRICT)

**Parameter Definition Requirements:**
- ✅ EVERY parameter MUST have `type`, `description`, `required`
- ✅ `type` must be one of: `string`, `number`, `boolean`, `array`, `object`
- ✅ `description` must explain WHAT and WHY (e.g., "Slack channel ID (starts with C)")
- ✅ Constraints MUST be specific:
  - For strings: `minLength`, `maxLength`, `pattern` (regex)
  - For numbers: `minimum`, `maximum`, step
  - For arrays: `minItems`, `maxItems`, `items` (type)
  - For enums: `enum: [value1, value2]`
- ✅ Default values MUST match their type
- ❌ NO `type: object` without `properties` defined
- ❌ NO vague descriptions like "The text parameter"

**Valid Parameter Example:**
```yaml
parameters:
  channelId:
    type: string
    required: true
    description: "Slack channel ID (format: C0123456789, starts with C)"
    pattern: "^C[A-Z0-9]{10,}$"
    
  messageText:
    type: string
    required: false
    description: "Plain text message to send. Supports markdown. Max 4000 chars."
    maxLength: 4000
    
  threadTimestamp:
    type: number
    required: false
    description: "Parent message timestamp for threading (Unix epoch, decimal)"
    minimum: 0
    
  tags:
    type: array
    required: false
    description: "Optional tags to categorize the message"
    items:
      type: string
    minItems: 1
    maxItems: 5
```

### 4. Authentication (MANDATORY for HTTP tools)

**Every HTTP tool MUST have authentication:**
- ✅ `authentication` block MUST specify type and location
- ✅ Supported types: `api_key`, `bearer`, `basic`, `oauth2`
- ✅ Environment variable naming: `MATIMO_{TOOL_NAME}_{AUTH_TYPE}` (uppercase)
- ✅ Authentication setup MUST be documented (which provider supports which auth)
- ✅ Token refresh/expiration MUST be handled if applicable
- ❌ NO tools with `type: http` and no authentication
- ❌ NO hardcoded credentials or tokens

**Example (Correct):**
```yaml
execution:
  type: http
  method: POST
  url: 'https://slack.com/api/chat.postMessage'
  headers:
    Authorization: 'Bearer {SLACK_BOT_TOKEN}'

authentication:
  type: api_key
  location: header
  name: Authorization
```

### 5. Output Schema Validation (REQUIRED)

**Output schema MUST match actual API response:**
- ✅ Schema MUST be present for every tool
- ✅ Schema MUST use Zod-compatible JSON schema
- ✅ Schema MUST match real API success response
- ✅ Response validation MUST fail if schema doesn't match
- ❌ NO generic `{ type: object }` schemas
- ❌ NO schemas that don't match actual responses

**Example (Correct):**
```yaml
output_schema:
  type: object
  properties:
    ok:
      type: boolean
      description: "Request succeeded"
    message:
      type: object
      properties:
        type:
          type: string
        ts:
          type: string
        channel:
          type: string
  required: [ok, message]
```

### 6. Error Handling (MANDATORY)

**All errors MUST use MatimoError:**
- ✅ MUST import and use `MatimoError` from `@matimo/core`
- ✅ MUST use correct `ErrorCode` (INVALID_SCHEMA, EXECUTION_FAILED, AUTH_FAILED, TOOL_NOT_FOUND)
- ✅ Error messages MUST be clear and actionable
- ✅ Error details MUST include context (but NO secrets)
- ✅ Setup `error_handling.retry` if operation is idempotent
- ❌ NO custom error classes
- ❌ NO throwing plain Error or Error subclasses

**Example (Correct):**
```typescript
import { MatimoError, ErrorCode } from '@matimo/core';

if (!channelId) {
  throw new MatimoError(
    'Channel ID is required',
    ErrorCode.INVALID_SCHEMA,
    { expectedFormat: 'C0123456789' }
  );
}

try {
  const response = await fetch(url);
  if (!response.ok) {
    throw new MatimoError(
      'Slack API request failed',
      ErrorCode.EXECUTION_FAILED,
      { statusCode: response.status }  // NOT the response body
    );
  }
} catch (error) {
  throw new MatimoError(
    'Network error',
    ErrorCode.EXECUTION_FAILED,
    { message: error instanceof Error ? error.message : 'Unknown error' }
  );
}
```

### 7. Logging (NO console.log in Core)

**Log Usage Rules:**
- ✅ Use `getGlobalMatimoLogger()` from `@matimo/core`
- ✅ Log at appropriate levels: `error`, `warn`, `info`, `debug`
- ✅ Log important validation failures, auth issues, retries
- ✅ Never log secrets, credentials, or sensitive data
- ❌ NO `console.log`, `console.error`, `console.warn` in package code
- ❌ NO logging secrets, API keys, tokens, passwords
- ❌ NO over-logging (avoid logs for normal happy paths)

**Example (Correct):**
```typescript
import { getGlobalMatimoLogger } from '@matimo/core';

const logger = getGlobalMatimoLogger();

try {
  logger.info('Sending message to Slack', { channel: channelId });
  // ...
} catch (error) {
  logger.error('Slack API call failed', { statusCode, message });
  throw new MatimoError('Failed', ErrorCode.EXECUTION_FAILED, { statusCode });
}
```

### 10. Enforcement Gates (Agent Checklist)

When reviewing a tool, the agent MUST verify:

```
NAMING CONVENTIONS GATE
✓ Tool name is snake_case (slack_send_message)
✓ requires_approval: true is present
✓ Parameters are camelCase (channelId, messageText)
✓ Tool name does NOT start with matimo_ (reserved namespace)
✓ TypeScript uses PascalCase for classes

POLICY GATE (run matimo_doctor first — fail fast)
✓ execution.type is http  (command/function blocked by default)
✓ URL domain is in allowedDomains list
✓ HTTP method is GET or POST (default allowed methods)
✓ No SSRF risk (no internal IPs or metadata endpoints)
✓ Credential name is in allowedCredentials list
✓ matimo_doctor returns { valid: true } before create

COMPLETENESS GATE
✓ YAML parses without errors
✓ All parameters have type, description, required
✓ All examples match parameter definitions
✓ No TODO/FIXME/HACK comments

QUALITY GATE
✓ Output schema matches real API response
✓ Error handling uses MatimoError + ErrorCode
✓ Authentication configured (if HTTP)
✓ Env vars documented and referenced

DELIVERY GATE
✓ All gates passed
✓ Tool ready for production use
✓ Can be merged without caveats
```

---

## Workflow: Creating a New Tool

### Agent at Runtime (using meta-tools)

#### Step 1: Write YAML in memory

Compose the full tool definition YAML string. Required fields:
- `name`, `description`, `version`
- `requires_approval: true` ← **mandatory — policy will reject without it**
- `parameters` (with types and descriptions)
- `execution` — **use `type: http`** (command/function blocked by default)
- `authentication` (mandatory for HTTP tools)
- `output_schema`

#### Step 2: Validate with `matimo_doctor` FIRST

```
matimo_doctor(yaml_content: "<full YAML string>")
```

- ✅ `{ valid: true }` → proceed to Step 3
- ❌ `{ valid: false, policyViolations: [...] }` → fix the YAML and re-validate

**Common failures and fixes:**

| Failure | Fix |
|---------|-----|
| `command tools blocked` | Change `type: command` → `type: http` |
| `function tools blocked` | Change `type: function` → `type: http` |
| `domain not allowed` | Use a domain in the `allowedDomains` list |
| `HTTP method not allowed` | Use `GET` or `POST` |
| `reserved namespace` | Rename — don't start with `matimo_` |
| `requires_approval missing` | Add `requires_approval: true` |
| `forced-approval` | Same — add `requires_approval: true` |

#### Step 3: Create on disk with `matimo_create_tool`

```
matimo_create_tool(
  name: "my_tool_name",
  yaml_content: "<validated YAML>",
  target_dir: "<path the developer configured, e.g. ./matimo-tools>"
)
```

Result:
- Tool written to `{target_dir}/{name}/definition.yaml`
- `status: "draft"`, `approvalState: "pending"` (or `"auto-approved"` for low-risk GET tools)
- **This path is permanent** — approved tools stay here and survive restarts

#### Step 4: Get human approval

```
matimo_approve_tool(name: "my_tool_name", tool_dir: "<same target_dir>")
```

- Updates `status` to `"approved"` in the same `definition.yaml`
- Writes approval hash to `{target_dir}/.matimo-approvals.json`

#### Step 5: Reload and use

```
matimo_reload_tools()         ← Hot-reloads registry from disk
matimo.execute("my_tool_name", params)   ← Tool is now live
```

---

### SDK Developer (adding to codebase)

#### Step 1: Create directory
```bash
mkdir -p packages/{provider}/tools/{tool-name}
```

#### Step 2: Write `definition.yaml`

Same YAML structure as above. No `requires_approval` needed for SDK-shipped tools.

#### Step 3: Add test fixture
```bash
cp packages/{provider}/tools/{tool-name}/definition.yaml \
   packages/core/test/fixtures/{provider}/{tool-name}-fixture.yaml
```

#### Step 4: Validate & test
```bash
pnpm validate-tools              # Check YAML schema
pnpm test                        # Run test suite
pnpm test:coverage               # Verify 80%+ coverage
pnpm lint                        # Check code quality
```

---

## Validation & Quality Checks

### Agent: Validate with `matimo_doctor`

Run before every `matimo_create_tool` call:

✅ YAML syntax is valid  
✅ Policy compliance (domains, methods, execution type, namespace)  
✅ Schema fields present (name, parameters, execution, output_schema)  
✅ `requires_approval: true` present  

### SDK Developer: Validate with CLI

```bash
pnpm validate-tools
```

✅ YAML syntax is valid  
✅ Schema matches ToolDefinition contract  
✅ All required fields present  
✅ Parameter types are consistent  

### Code Quality

```bash
pnpm lint              # ESLint checks
pnpm format           # Prettier formatting
pnpm test             # All tests pass
pnpm test:coverage    # 80%+ coverage
```

### Security Review

- No hardcoded secrets in definitions
- No sensitive data in error messages
- Auth env vars properly documented
- No `console.log` in production code

---

## Common Patterns

### Pattern 1: Parameter Templating

```yaml
execution:
  type: http
  url: 'https://api.example.com/users/{user_id}'
  body:
    name: '{name}'
    email: '{email}'
```

Parameters are replaced before execution. Type conversion handled automatically (numbers → strings).

### Pattern 2: Environment Variable Injection

```yaml
execution:
  type: http
  headers:
    Authorization: 'Bearer {API_TOKEN}'    # Gets MATIMO_SLACK_API_KEY from env
```

Template syntax: `{UPPERCASE_NAME}` → `process.env.MATIMO_{TOOL_NAME}_UPPERCASE_NAME`

### Pattern 3: Optional Parameters with Defaults

```yaml
parameters:
  timeout:
    type: number
    required: false
    default: 30

execution:
  args:
    - '--timeout'
    - '{timeout}'        # Uses default if not provided
```

### Pattern 4: Enum Validation

```yaml
parameters:
  status:
    type: string
    enum:
      - draft
      - published
      - archived

execution:
  query_params:
    status: '{status}'   # Only allows draft, published, or archived
```

---

## Real Example: Slack Send Message

### definition.yaml

```yaml
name: slack_send_message
description: Send a text message to a Slack channel
version: '1.0.0'

parameters:
  channel:
    type: string
    required: true
    description: Channel ID or name (e.g., #general or C12345)
  text:
    type: string
    required: true
    description: Message text to send
  thread_ts:
    type: string
    required: false
    description: Parent message timestamp for thread replies

execution:
  type: http
  method: POST
  url: 'https://slack.com/api/chat.postMessage'
  headers:
    Authorization: 'Bearer {SLACK_BOT_TOKEN}'
    Content-Type: application/json
  body:
    channel: '{channel}'
    text: '{text}'
    thread_ts: '{thread_ts}'

authentication:
  type: api_key
  location: header
  name: Authorization

output_schema:
  type: object
  properties:
    ok:
      type: boolean
    ts:
      type: string
    channel:
      type: string
  required:
    - ok
    - ts

error_handling:
  retry: 2
  backoff_type: exponential
  initial_delay_ms: 500
  retry_on_status:
    - 429
    - 500
    - 503

examples:
  - name: "Send to channel"
    description: Post a message to #general
    params:
      channel: "#general"
      text: "Hello team!"
  
  - name: "Reply in thread"
    description: Reply to a message thread
    params:
      channel: "#general"
      text: "Thanks for the update"
      thread_ts: "1234567890.123456"
```

### Key Decisions

- **Type: http** because Slack API is REST-based
- **Auth: api_key** in header (standard for Slack)
- **Parameters**: Optional `thread_ts` for thread replies
- **Output**: Validates `ok` and `ts` fields
- **Retry**: Handles rate limiting (429) and server errors

---

## Troubleshooting

### Tool Definition Won't Validate

Run `pnpm validate-tools --verbose` to see:
- Missing required fields (name, parameters, execution, output_schema)
- Parameter type mismatches
- Invalid execution config for selected type
- Schema validation errors

### Execution Fails with Auth Error

Check:
- Env variable exists: `MATIMO_{TOOL_NAME}_API_KEY`
- Template references correct field: `{API_TOKEN}` not `{api_token}`
- Authentication.location matches where secret is used (header, query, body)

### Command Executor Not Found

Verify:
- `index.ts` exists at correct path
- `command` field in execution matches executable
- Args array is properly formatted
- Script outputs valid JSON to stdout

### Parameter Templating Doesn't Work

Ensure:
- Parameter name in definition matches template: `{paramName}`
- Template syntax uses exact name from parameters section
- Parameter is defined as `required: true` or has `default` value
- Type matches: numbers auto-converted to strings in templates

---

## References

- **Tool lifecycle**: See `meta-tools-lifecycle` skill
- **Complete tool creation**: See `tool-creation` skill
- **Tool discovery**: See `tool-discovery` skill

---
