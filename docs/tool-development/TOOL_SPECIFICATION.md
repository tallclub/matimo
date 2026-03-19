# Tool Specification — YAML Schema

Complete guide to writing Matimo tools in YAML.

## Overview

Every Matimo tool is defined in a YAML file with a standardized schema. Tools define:

- **Metadata** — Name, version, description
- **Parameters** — What inputs the tool accepts
- **Execution** — How the tool runs (command, HTTP, script)
- **Output** — What the tool returns
- **Authentication** — How to authenticate (if needed)
- **Error Handling** — Retry and recovery logic

---

## Basic Structure

```yaml
name: tool-name
description: Brief description of what the tool does
version: '1.0.0'

parameters:
  # Define input parameters here

execution:
  # Define how to execute the tool

output_schema:
  # Define the output format

authentication: # Optional
  # Define authentication if needed

error_handling: # Optional
  # Define retry and error recovery logic
```

---

## Metadata

### name

Unique tool identifier. Use lowercase, kebab-case.

```yaml
name: github-create-issue
name: slack-send-message
name: calculator
```

**Rules:**

- Lowercase only
- Kebab-case (hyphens, no spaces)
- Globally unique
- 3-50 characters

### description

What the tool does. One sentence.

```yaml
description: Create a new GitHub issue in a repository
description: Send a message to a Slack channel
description: Perform basic math calculations
```

### version

Semantic versioning: `MAJOR.MINOR.PATCH`

```yaml
version: "1.0.0"
version: "2.1.3"
```

---

## Parameters

Define what inputs the tool accepts.

### Basic Structure

```yaml
parameters:
  param_name:
    type: string|number|boolean|object|array
    description: What this parameter does
    required: true|false
```

### Parameter Properties

#### type (required)

Parameter data type.

```yaml
type: string    # Text input
type: number    # Integer or float
type: boolean   # True/false
type: object    # JSON object
type: array     # Array of items
```

#### description (required)

What this parameter does.

```yaml
description: GitHub repository in owner/repo format
description: Number of items to fetch
description: Enable verbose logging
```

#### required (required)

Whether parameter is mandatory.

```yaml
required: true   # Must be provided
required: false  # Optional
```

#### default (optional)

Default value if not provided.

```yaml
default: 10
default: "main"
default: false
```

#### enum (optional)

List of allowed values.

```yaml
enum:
  - add
  - subtract
  - multiply
  - divide
```

#### validation (optional)

Constraints on parameter values.

```yaml
# For strings:
validation:
  minLength: 1
  maxLength: 100
  pattern: "^[a-z]+$"  # Regex pattern

# For numbers:
validation:
  min: 0
  max: 100

# For arrays:
validation:
  minItems: 1
  maxItems: 10
```

### Examples

#### String Parameter

```yaml
parameters:
  message:
    type: string
    description: Message to send
    required: true
    validation:
      minLength: 1
      maxLength: 1000
```

#### Number Parameter with Constraints

```yaml
parameters:
  count:
    type: number
    description: Number of items to fetch
    required: false
    default: 10
    validation:
      min: 1
      max: 100
```

#### Choice Parameter

```yaml
parameters:
  operation:
    type: string
    description: Math operation to perform
    required: true
    enum:
      - add
      - subtract
      - multiply
      - divide
```

#### Object Parameter

```yaml
parameters:
  config:
    type: object
    description: Configuration object
    required: true
    properties:
      timeout:
        type: number
      retries:
        type: number
```

---

## Execution

Define how the tool runs.

### Type: Command

Execute shell commands.

```yaml
execution:
  type: command
  command: node
  args:
    - script.js
    - '{param1}'
    - '{param2}'
  timeout_ms: 5000
  env:
    CUSTOM_VAR: value
```

**Fields:**

- `command` (string, required) — Command to execute
- `args` (array, optional) — Command arguments with parameter substitution
- `timeout_ms` (number, optional, default: 30000) — Timeout in milliseconds
- `env` (object, optional) — Environment variables

**Parameter Substitution:**

Use `{param_name}` to reference parameters.

```yaml
args:
  - '--operation={operation}'
  - '{a}'
  - '{b}'
```

When executed with `{ operation: 'add', a: 5, b: 3 }`, becomes:

```
--operation=add 5 3
```

### Type: HTTP

Make HTTP requests.

```yaml
execution:
  type: http
  method: POST
  url: 'https://api.example.com/endpoint'
  headers:
    Content-Type: application/json
    Authorization: 'Bearer {api_key}'
  auth:
    type: bearer
    secret_env_var: MATIMO_API_KEY
  timeout_ms: 10000
```

**Fields:**

- `method` (string, required) — HTTP method: GET, POST, PUT, DELETE, PATCH
- `url` (string, required) — API endpoint URL with parameter substitution
- `headers` (object, optional) — HTTP headers
- `auth` (object, optional) — Authentication config (see Authentication section)
- `timeout_ms` (number, optional, default: 30000) — Timeout in milliseconds

**URL Templating:**

```yaml
url: 'https://api.github.com/repos/{owner}/{repo}/issues'
```

When executed with `{ owner: 'tallclub', repo: 'matimo' }`:

```
https://api.github.com/repos/tallclub/matimo/issues
```

### Type: Script

Execute inline JavaScript/TypeScript.

```yaml
execution:
  type: script
  language: javascript|typescript
  code: |
    return params.a + params.b;
  timeout_ms: 5000
```

### Type: Function

Execute a JavaScript/TypeScript module exported as the tool's default function. The `code` field is a path (relative to the tool's YAML file) to the implementation module.

```yaml
execution:
  type: function
  code: './my_tool.ts'
  timeout: 30000
```

The implementation module must export a default async function:

```typescript
// my_tool.ts
export default async function myTool(params: Record<string, unknown>): Promise<unknown> {
  // params contains the tool's input parameters
  return { result: params.value };
}
```

**Fields:**

- `code` (string, required) — Relative path to the implementation module (`.ts` or `.js`)
- `timeout` (number, optional) — Execution timeout in milliseconds

**Trust model — IMPORTANT:**

`execution.type: function` is **blocked for agent-created tools** (`untrusted` source). Agents cannot propose tools with this execution type because it allows arbitrary code execution. Only developer-authored tools in `trustedPaths` (installed `@matimo/*` packages or explicit file paths) may use `type: function`.

This is a hard block enforced at the policy tier level — `getTierForTool()` returns `'blocked'` for any `untrusted` tool with `execution.type: function`, regardless of policy configuration.

If you are building meta-tools (like the built-in `matimo_approve_tool`), use `type: function` freely — they live in trusted paths.

---

## Output Schema

Define what the tool returns.

```yaml
output_schema:
  type: object
  properties:
    id:
      type: number
    name:
      type: string
    created_at:
      type: string
  required:
    - id
    - name
```

### Supported Types

```yaml
type: object    # JSON object
type: array     # Array of items
type: string    # Text
type: number    # Integer or float
type: boolean   # True/false
```

### Object Schema

```yaml
type: object
properties:
  field_name:
    type: string
    description: Field description
  field_count:
    type: number
required:
  - field_name
```

### Array Schema

```yaml
type: array
items:
  type: object
  properties:
    id:
      type: number
    name:
      type: string
```

### Examples

#### Simple Object

```yaml
output_schema:
  type: object
  properties:
    result:
      type: number
    timestamp:
      type: string
  required:
    - result
```

#### Array of Objects

```yaml
output_schema:
  type: array
  items:
    type: object
    properties:
      id:
        type: number
      title:
        type: string
      author:
        type: string
```

#### Nested Objects

```yaml
output_schema:
  type: object
  properties:
    user:
      type: object
      properties:
        id:
          type: number
        name:
          type: string
        email:
          type: string
    status:
      type: string
  required:
    - user
    - status
```

---

## Authentication

Define how to authenticate (optional).

```yaml
authentication:
  type: api_key|bearer|oauth2|basic
  location: header|query|body
  name: header_name
  secret_env_var: MATIMO_SECRET_NAME
```

### Type: API Key

```yaml
authentication:
  type: api_key
  location: header
  name: X-API-Key
  secret_env_var: MATIMO_API_KEY
```

Environment variable: `MATIMO_API_KEY=your-api-key`

### Type: Bearer Token

```yaml
authentication:
  type: bearer
  secret_env_var: MATIMO_API_TOKEN
```

Environment variable: `MATIMO_API_TOKEN=your-token`

Automatically adds header: `Authorization: Bearer your-token`

### Type: Basic Auth

```yaml
authentication:
  type: basic
  secret_env_var: MATIMO_CREDENTIALS
```

Environment variable: `MATIMO_CREDENTIALS=username:password`

Automatically creates Basic auth header.

### Type: OAuth2

```yaml
authentication:
  type: oauth2
  secret_env_var: MATIMO_OAUTH_TOKEN
```

(Full OAuth2 implementation in Phase 2)

---

## Error Handling

Define retry and recovery logic (optional).

```yaml
error_handling:
  retry: 3
  backoff_type: exponential|linear|constant
  initial_delay_ms: 1000
  max_delay_ms: 30000
```

**Fields:**

- `retry` (number, default: 0) — Number of retry attempts
- `backoff_type` (string) — Backoff strategy
- `initial_delay_ms` (number) — Initial delay between retries
- `max_delay_ms` (number) — Maximum delay between retries

### Backoff Strategies

#### exponential

Wait time = initial_delay × (2 ^ attempt_number)

```yaml
error_handling:
  retry: 3
  backoff_type: exponential
  initial_delay_ms: 1000
  max_delay_ms: 30000
```

Delays: 1s, 2s, 4s, 8s (capped at 30s)

#### linear

Wait time = initial_delay × (attempt_number + 1)

```yaml
backoff_type: linear
initial_delay_ms: 1000
```

Delays: 1s, 2s, 3s, 4s

#### constant

Wait time = initial_delay

```yaml
backoff_type: constant
initial_delay_ms: 2000
```

Delays: 2s, 2s, 2s, 2s

---

## Complete Examples

### Calculator Tool

```yaml
name: calculator
description: Perform basic math calculations
version: '1.0.0'

parameters:
  operation:
    type: string
    description: Math operation to perform
    required: true
    enum:
      - add
      - subtract
      - multiply
      - divide
  a:
    type: number
    description: First number
    required: true
  b:
    type: number
    description: Second number
    required: true

execution:
  type: command
  command: node
  args:
    - -e
    - 'console.log(JSON.stringify({ result: eval(`${process.argv[1]} ${process.argv[2]} ${process.argv[3]}`) }))'
    - "{operation === 'add' ? '+' : operation === 'subtract' ? '-' : operation === 'multiply' ? '*' : '/'}"
    - '{a}'
    - '{b}'

output_schema:
  type: object
  properties:
    result:
      type: number
  required:
    - result
```

### GitHub Create Issue

```yaml
name: github-create-issue
description: Create a new issue in a GitHub repository
version: '1.0.0'

parameters:
  owner:
    type: string
    description: Repository owner
    required: true
  repo:
    type: string
    description: Repository name
    required: true
  title:
    type: string
    description: Issue title
    required: true
    validation:
      minLength: 1
      maxLength: 200
  body:
    type: string
    description: Issue body/description
    required: false
  labels:
    type: array
    description: Labels to assign
    required: false

execution:
  type: http
  method: POST
  url: 'https://api.github.com/repos/{owner}/{repo}/issues'
  headers:
    Accept: application/vnd.github.v3+json
  auth:
    type: bearer
    secret_env_var: MATIMO_GITHUB_TOKEN

output_schema:
  type: object
  properties:
    id:
      type: number
    number:
      type: number
    title:
      type: string
    url:
      type: string
  required:
    - id
    - number
    - title
    - url

error_handling:
  retry: 3
  backoff_type: exponential
  initial_delay_ms: 1000
```

### Slack Send Message

```yaml
name: slack-send-message
description: Send a message to a Slack channel
version: '1.0.0'

parameters:
  channel:
    type: string
    description: Channel ID or name
    required: true
  message:
    type: string
    description: Message text
    required: true
    validation:
      minLength: 1
      maxLength: 4000
  thread_ts:
    type: string
    description: Thread timestamp (for replies)
    required: false

execution:
  type: http
  method: POST
  url: 'https://slack.com/api/chat.postMessage'
  headers:
    Content-Type: application/json
  auth:
    type: bearer
    secret_env_var: MATIMO_SLACK_TOKEN

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
    - channel

error_handling:
  retry: 2
  backoff_type: exponential
  initial_delay_ms: 500
```

---

## Best Practices

1. **Naming** — Use lowercase, kebab-case, globally unique
2. **Description** — Clear, one sentence explaining purpose
3. **Parameters** — Validate with min/max, enum, patterns
4. **Output Schema** — Document all response fields
5. **Authentication** — Use environment variables, never hardcode
6. **Error Handling** — Include retry logic for flaky APIs
7. **Timeout** — Set appropriate timeouts (avoid infinite hangs)
8. **Testing** — Include examples of real-world usage

---

## File Organization

Store tools in provider directories. Each tool can be a single file or a subdirectory with its own `definition.yaml`:

```
tools/
├── provider-name/
│   ├── definition.yaml           # Single tool per provider
│   └── ...
├── multi-tool-provider/
│   ├── tool-1/
│   │   └── definition.yaml       # Multi-tool provider
│   └── tool-2/
│       └── definition.yaml
└── examples/
    └── example-tool.yaml
```

Example:

```
tools/
├── github/
│   └── definition.yaml
├── slack/
│   └── definition.yaml
├── gmail/
│   ├── send-email/
│   │   └── definition.yaml
│   ├── create-draft/
│   │   └── definition.yaml
│   ├── list-messages/
│   │   └── definition.yaml
│   └── definition.yaml              # Optional: shared config
├── calculator/
│   └── definition.yaml
└── examples/
    ├── http-client.yaml
    └── echo-tool.yaml
```

**Naming conventions:**

- Provider directories: lowercase, kebab-case (`github`, `slack`, `gmail`)
- Tool subdirectories: lowercase, kebab-case (`send-email`, `create-draft`)
- Files: Always `definition.yaml` for tool definitions

---

## See Also

- [Quick Start](../getting-started/QUICK_START.md) — Get started in 5 minutes
- [API Reference](../api-reference/SDK.md) — Complete SDK documentation
- [Decorator Guide](./DECORATOR_GUIDE.md) — Use decorators
- [CONTRIBUTING.md](../CONTRIBUTING.md) — Development guide
