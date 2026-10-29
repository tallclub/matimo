---
title: "Tool Specification: YAML Schema"
description: "The Matimo tool YAML schema: name, parameters, execution, authentication, output and risk fields, with examples."
---
Complete guide to writing Matimo tools in YAML.

## Overview

Every Matimo tool is defined in a YAML file with a standardized schema. Tools define:

- **Metadata**: Name, version, description
- **Parameters**: What inputs the tool accepts
- **Execution**: How the tool runs (HTTP, command, function)
- **Output**: What the tool returns
- **Authentication**: How to authenticate (if needed)
- **Error Handling**: Retry and recovery logic

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

requires_approval: true # Optional, see Governance Fields
risk: medium            # Optional (required for function tools)

error_handling: # Optional
  # Retry settings (accepted, not yet applied)
```

---

## Metadata

### name

Unique tool identifier.

```yaml
name: slack_send_channel_message   # newer packages: snake_case
name: github-create-issue          # older packages: kebab-case
name: calculator
```

**Rules:**

- Lowercase, no spaces
- Globally unique among the tools a `MatimoInstance` loads
- New tools use `snake_case`. The GitHub, Gmail, HubSpot, Mailchimp, Twilio and Postgres packages and `slack-send-message` predate that and use kebab-case. Neither style is enforced by the loader, so keep the convention of the package you're adding to

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

#### required (optional)

Whether the parameter is mandatory. Defaults to optional, so say `required: true` for anything the tool cannot run without.

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

#### examples, items, properties (optional)

`examples` lists sample values. `items` describes the element type of an `array` parameter, and `properties` describes the fields of an `object` parameter. Both nest.

#### No min, max or pattern keys

There is no `validation:` block. A key Matimo doesn't know, such as `minLength`, `min` or `pattern`, is ignored when the YAML loads, so it enforces nothing. State limits in the `description` instead, and enforce them in the API the tool calls.

`MatimoInstance.execute()` does not check arguments against `type`, `required` or `enum` either (only a missing `{placeholder}` in an HTTP URL is rejected). Those fields describe the tool to the model: the LangChain adapter turns them into a Zod schema, and the MCP server publishes them as the tool's `inputSchema`. `default` is applied only by the LangChain adapter.

### Examples

#### String Parameter

```yaml
parameters:
  message:
    type: string
    description: Message to send (1 to 1000 characters)
    required: true
```

#### Number Parameter with a Default

```yaml
parameters:
  count:
    type: number
    description: Number of items to fetch (1 to 100)
    required: false
    default: 10
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
  timeout: 5000
```

**Fields:**

- `command` (string, required), The executable. It cannot contain `{placeholders}`; only `args` are templated
- `args` (array, optional), Command arguments with parameter substitution
- `timeout` (number, optional, default: 30000), Timeout in milliseconds
- `cwd`, `shell` (optional), Accepted by the schema. Python applies `cwd`; TypeScript ignores both and runs without a shell

The child process gets the parent's environment plus any per-call `credentials`. Python also accepts an `env` map under `execution` and adds it; TypeScript's schema drops `env`, so don't rely on it in a tool meant for both SDKs.

A command tool asks a human before every call unless it declares `requires_approval: false`, and agents cannot create one.

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
    Authorization: 'Bearer {MATIMO_API_KEY}'
  body:
    name: '{name}'
  timeout: 10000
```

**Fields:**

- `method` (string, required), HTTP method: GET, POST, PUT, DELETE, PATCH
- `url` (string, required), API endpoint URL with parameter substitution
- `headers` (object, optional), HTTP headers
- `body` (any, optional), Request body, with parameter substitution
- `query_params` (object, optional), Query string parameters
- `parameter_encoding` (array, optional), See [HTTP Parameter Embedding](/docs/tool-development/http-parameter-embedding/)
- `timeout` (number, optional), Timeout in milliseconds. Python defaults to 30000; TypeScript sets no timeout unless you give one, so set it explicitly

Authentication goes in the top-level `authentication` block (see [Authentication](#authentication)), not under `execution`.

**URL Templating:**

```yaml
url: 'https://api.github.com/repos/{owner}/{repo}/issues'
```

When executed with `{ owner: 'tallclub', repo: 'matimo' }`:

```
https://api.github.com/repos/tallclub/matimo/issues
```

### Type: Function

Execute a JavaScript/TypeScript module exported as the tool's default function. The `code` field is a path (relative to the tool's YAML file) to the implementation module.

```yaml
execution:
  type: function
  code: './my_tool.ts'
  timeout: 30000
```

The implementation module must export a default async function. Its optional second argument carries the call's per-call credentials and the caller's policy context, both supplied by the host (`execute(..., { credentials, context })`), never by the agent:

```typescript
// my_tool.ts
import type { FunctionToolContext } from '@matimo/core';

export default async function myTool(
  params: Record<string, unknown>,
  context?: FunctionToolContext // { credentials?, policyContext?: { agentId, roles, environment } }
): Promise<unknown> {
  if (!context?.policyContext?.roles?.includes('admin')) {
    return { success: false, error: 'admin only' };
  }
  return { result: params.value };
}
```

The Python SDK runs `my_tool.py` next to the YAML (same name, `.py` suffix). Its `run()` may be sync or async, and receives a `FunctionToolContext` when it accepts a second argument:

```python
# my_tool.py
from matimo import FunctionToolContext


def run(params: dict, context: FunctionToolContext | None = None) -> dict:
    caller = context.policy_context if context else None
    return {"result": params.get("value"), "agent": caller.agent_id if caller else None}
```

**Fields:**

- `code` (string, required), Relative path to the implementation module (`.ts` or `.js`; Python uses the sibling `.py`)
- `timeout` (number, optional), Execution timeout in milliseconds

Every function tool must declare `risk:`, it is the risk the policy engine uses when the tool runs, since its code can do anything. `pnpm validate-tools` and `make validate-tools` reject a function tool without one. See [Governance Fields](#governance-fields).

**Trust model, IMPORTANT:**

`execution.type: function` is **blocked for agent-created tools** (`untrusted` source). Agents cannot propose tools with this execution type because it allows arbitrary code execution. Only developer-authored tools in `trustedPaths` (installed `@matimo/*` packages or explicit file paths) may use `type: function`.

In TypeScript this is a hard block, the policy engine rejects any `untrusted` tool with `execution.type: function` regardless of policy configuration. The Python SDK rejects it unless the policy sets `allow_function_tools`.

If you are building meta-tools (like the built-in `matimo_approve_tool`), use `type: function` freely, they live in trusted paths.

---

## Governance Fields

These fields decide how the policy engine treats a tool. All are optional except `risk` on function tools.

```yaml
requires_approval: true   # ask a human before every call
risk: high                # low | medium | high | critical
status: approved          # draft | approved | deprecated
deprecated: false
deprecation_message: 'Use slack_send_channel_message instead'
```

| Field | Effect |
|-------|--------|
| `requires_approval` | `true`: every call waits for an approval callback ([Approval System](/docs/api-reference/approval-system/)). Unset: HTTP `DELETE` and `type: command` tools still ask (the 0.2.0 secure default); everything else doesn't. `false`: opts a DELETE or command tool out of that default, the destructive-keyword scan of `sql`/`command` arguments still applies. HTTP DELETE tools in this repo must say `requires_approval: true`; the validator enforces it |
| `risk` | Raises the automatically computed risk (GET low; POST/PUT/PATCH medium; DELETE, command, or `requires_approval` high), never lowers it. For function tools it **is** the risk, and is required |
| `status` | `draft` tools never run in production and run elsewhere only for an `admin` caller; `deprecated` tools never run. Agent-created tools start as `draft` |
| `deprecated` / `deprecation_message` | Same as `status: deprecated`; the message is returned to the caller |

Risk feeds HITL quarantine (`enableHITL` + `hitlMinRiskLevel`) and appears on every `tool:executed` event. See [Policy and Lifecycle](/docs/api-reference/policy-and-lifecycle/).

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

### max_response_size

Optional. Caps how many bytes of this tool's raw result Matimo will return before truncating it, overriding the instance-wide default.

```yaml
output_schema:
  type: array
  items:
    type: object
  max_response_size: 1048576  # 1 MB, in bytes
```

Every tool call passes through a response-size guardrail in `execute()`, regardless of whether it's invoked directly, via LangChain/CrewAI, or via MCP, so this applies uniformly across every integration. Precedence, highest first:

1. This tool's own `output_schema.max_response_size`
2. The instance-level default passed to `MatimoInstance.init()` (`defaultMaxResponseSize` in TS, `default_max_response_size` in Python)
3. A built-in 256 KB (262,144 byte) default applied to every tool that sets neither of the above

When a result exceeds the effective cap, it's truncated rather than rejected:

- **Arrays** are sliced to fit the byte budget, with a sentinel element appended: `"...truncated, N of M items shown"`.
- **Long strings** are sliced with an inline `"...truncated, N of M characters shown"` marker.
- **Large objects** are truncated per-field (smaller fields like `statusCode`/`headers` are kept intact; the largest field absorbs the cut), and the outermost object gets an additive `_truncated: true` field, existing keys are never renamed or removed.

See [Tool Execution Flow](/docs/architecture/overview/#tool-execution-flow) for where this fits in the request lifecycle, and [Error Codes Reference](/docs/api-reference/errors/) for how a truncated result differs from an error response (it's never an error, the result is still returned, just capped).

---

## Authentication

Describe how the tool authenticates (optional).

```yaml
authentication:
  type: none|api_key|basic|bearer|oauth2|custom
  location: header|query|body
  name: header_name
  provider: provider_name   # oauth2 only
  required: true
  username_env: ENV_NAME    # basic only
  password_env: ENV_NAME    # basic only
```

There is no `secret_env_var` field. Apart from `basic`, the `authentication` block describes the scheme and is not what injects the secret. The secret reaches the request through a `{PLACEHOLDER}` in `headers`, `query_params`, `url` or `body`:

```yaml
execution:
  type: http
  method: GET
  url: 'https://api.example.com/items'
  headers:
    Authorization: 'Bearer {EXAMPLE_API_KEY}'

authentication:
  type: bearer
  location: header
  name: Authorization
```

Only a placeholder whose name contains `token`, `key`, `secret`, `password`, `credential`, `auth` or `bearer` is treated as a credential, so name yours that way. At call time Matimo fills `{EXAMPLE_API_KEY}` from the first of these that is set (see [Authentication](/docs/user-guide/authentication/)):

1. The call's `credentials`: `EXAMPLE_API_KEY`, then `MATIMO_EXAMPLE_API_KEY`
2. The environment variable `MATIMO_EXAMPLE_API_KEY`
3. The environment variable `EXAMPLE_API_KEY`

### Type: Basic Auth

`basic` is the one scheme the HTTP executor handles itself. Name the two variables that hold the username and password, and it builds the `Authorization: Basic ...` header:

```yaml
authentication:
  type: basic
  username_env: TWILIO_ACCOUNT_SID
  password_env: TWILIO_AUTH_TOKEN
```

If either variable is unset (and not passed in `credentials`) the call fails with an error naming both.

### Type: OAuth2

```yaml
authentication:
  type: oauth2
  provider: github
```

`provider` names a provider definition that holds the authorization and token URLs. Matimo does not run the browser flow or refresh tokens for you: your application obtains the token (see [OAuth2 and credentials](/docs/architecture/oauth/)) and supplies it as the placeholder value.

---

## Error Handling

> **Not applied yet.** `error_handling` is validated and kept on the tool definition, but neither SDK's executors read it today: a failed call is not retried. Retries with these settings are planned. Errors carry `details.retryable` (set for timeouts, 429 and 5xx responses) so a caller can retry itself.

Retry settings (optional).

```yaml
error_handling:
  retry: 3
  backoff_type: exponential|linear|fixed
  initial_delay_ms: 1000
  max_delay_ms: 30000
```

**Fields:**

- `retry` (number), Number of retry attempts
- `backoff_type` (string), `exponential`, `linear` or `fixed`
- `initial_delay_ms` (number), Initial delay between retries
- `max_delay_ms` (number), Maximum delay between retries

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

#### fixed

Wait time = initial_delay

```yaml
backoff_type: fixed
initial_delay_ms: 2000
```

Delays: 2s, 2s, 2s, 2s

---

## Complete Examples

### Add Two Numbers (command tool)

A minimal `type: command` tool. Arguments are passed to the process as separate `args` entries, never through a shell, so a parameter value cannot inject extra commands. `{placeholder}` only substitutes values; it does not evaluate expressions.

```yaml
name: add_numbers
description: Add two numbers
version: '1.0.0'
risk: low
requires_approval: false # command tools ask a human before every call unless they opt out

parameters:
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
    - 'console.log(JSON.stringify({ result: Number(process.argv[1]) + Number(process.argv[2]) }))'
    - '{a}'
    - '{b}'

output_schema:
  type: object
  properties:
    result:
      type: number
```

The built-in `calculator` is a `type: function` tool with a sandboxed expression parser (`typescript/packages/core/tools/calculator/definition.yaml`). It is a better model for anything beyond arithmetic.

### GitHub Create Issue

From `typescript/packages/github/tools/create-issue/definition.yaml` (abridged):

```yaml
name: github-create-issue
description: Create a new issue in a repository
version: '1.0.0'
requires_approval: true

parameters:
  owner:
    type: string
    required: true
    description: Repository owner username or organization
  repo:
    type: string
    required: true
    description: Repository name
  title:
    type: string
    required: true
    description: Issue title
  body:
    type: string
    required: false
    description: Issue description (markdown supported)
  labels:
    type: array
    required: false
    description: Array of label names

execution:
  type: http
  method: POST
  url: 'https://api.github.com/repos/{owner}/{repo}/issues'
  headers:
    Accept: application/vnd.github+json
    Authorization: 'Bearer {GITHUB_TOKEN}'
    X-GitHub-Api-Version: '2022-11-28'
    Content-Type: application/json
  body:
    title: '{title}'
    body: '{body}'
    labels: '{labels}'          # an array parameter is sent as a JSON array
  timeout: 15000

authentication:
  type: bearer
  location: header

output_schema:
  type: object
  properties:
    number:
      type: number
      description: Issue number in repository
    title:
      type: string
    html_url:
      type: string
```

### Slack Send Message

From `typescript/packages/slack/tools/slack_send_channel_message/definition.yaml`:

```yaml
name: slack_send_channel_message
description: Post a message (text, markdown, blocks) to a public/private Slack channel.
version: '1.0.0'
parameters:
  channel:
    type: string
    required: true
    description: Channel ID or name to post the message to
  text:
    type: string
    required: false
    description: Plain-text message (optional if blocks provided, recommended as fallback for accessibility)
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
  timeout: 15000
authentication:
  type: api_key
  location: header
  name: Authorization
notes:
  env: SLACK_BOT_TOKEN
```

---

## Best Practices

1. **Naming**: Lowercase and globally unique; new tools use `snake_case` (`slack_send_channel_message`), though older packages use kebab-case
2. **Description**: Clear, one sentence explaining purpose
3. **Parameters**: A description on every parameter; use `enum` for fixed values and state limits in the description (there are no min/max/pattern keys)
4. **Output Schema**: Document the response fields the caller needs
5. **Authentication**: `{UPPER_CASE}` placeholders filled from the environment; never hardcode a secret
6. **Governance**: `requires_approval: true` on anything destructive, and `risk:` on function tools
7. **Timeout**: Set appropriate timeouts (avoid infinite hangs)
8. **Testing**: Include examples of real-world usage

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
typescript/packages/gmail/
├── definition.yaml                  # Provider manifest (OAuth2 endpoints), not a tool
└── tools/
    ├── send-email/
    │   └── definition.yaml
    ├── create-draft/
    │   └── definition.yaml
    └── list-messages/
        └── definition.yaml

typescript/packages/core/tools/
└── calculator/
    ├── definition.yaml
    └── calculator.ts                # Implementation for a `type: function` tool
```

**Naming conventions:**

- Tool subdirectories hold one tool each and are named after it (`send-email`, `slack_send_channel_message`)
- Files: Always `definition.yaml` for tool definitions
- A `definition.yaml` at a provider's root is the provider manifest, not a tool, and is not counted among its tools

---

## See Also

- [Quick Start](/docs/getting-started/quick-start/): Get started in 5 minutes
- [API Reference](/docs/api-reference/sdk/): Complete SDK documentation
- [Decorator Guide](/docs/tool-development/decorator-guide/): Use decorators
- [CONTRIBUTING.md](https://github.com/tallclub/matimo/blob/main/CONTRIBUTING.md): Development guide
