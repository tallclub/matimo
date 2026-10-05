---
name: tool-creation
description: Create tools for the Matimo SDK. Understand YAML tool definitions, execution types, parameter templating, credentials, and what the policy allows. Apply this skill when writing a Matimo tool definition.
metadata:
  category: "Tool Development"
  difficulty: "intermediate"
  user-invokable: "true"
---

# Tool Creation for Matimo SDK

This skill teaches you how to write a correct Matimo tool definition: one YAML file that runs the same way from the SDK, LangChain, CrewAI and MCP.

> **Two audiences — know which one you are:**
>
> | You are an **agent at runtime** | You are an **SDK developer** |
> |---|---|
> | Creating tools with `matimo_create_tool` | Adding tools to the codebase |
> | Tools go to `<target_dir>/<tool-name>/definition.yaml` (default `./matimo-tools`) | Tools go to `packages/<provider>/tools/<tool-name>/definition.yaml` |
> | Validate with `matimo_validate_tool` | Validate with `pnpm validate-tools` |
> | Only `type: http`; a human approves every tool | `http`, `function` or `command`; reviewed in a pull request |
>
> **If you are an agent, follow the agent column. The SDK developer sections are marked.**

## How a Tool Runs

```
definition.yaml
      ↓  loaded and checked against the schema
Tool registry
      ↓  matimo.execute(name, params)
Policy: risk level, execution gates, optional HITL quarantine
      ↓
Approval: a human is asked if the tool requires it
      ↓
Credentials filled into {PLACEHOLDERS}
      ↓
Executor: http | function | command
      ↓
Response size cap, then the result is returned
```

Matimo does **not** check parameters against your `parameters:` block before running, and does **not** check the response against `output_schema`. The API you call reports bad input; write clear parameter descriptions so the caller sends the right values.

## Agent Lifecycle

```
matimo_validate_tool(yaml_content)              ← 1. valid: true means create will accept it
matimo_create_tool(name, yaml_content, target_dir)
      ↓ writes <target_dir>/<name>/definition.yaml
      ↓ sets requires_approval: true and status: draft
matimo_reload_tools()                           ← 2. registers the draft (it cannot run yet)
matimo_approve_tool(name, tool_dir)             ← 3. a human approves it
matimo_reload_tools()                           ← 4. the approved tool is live
<tool name>(params)                             ← 5. each call still asks a human
```

`matimo_create_tool` uses its `name` argument as the tool name, whatever the YAML says, and refuses names that start with `matimo_` or contain `/`, `\` or `..`. Approvals survive a restart only when the developer sets `MATIMO_APPROVAL_SECRET`. See the `meta-tools-lifecycle` skill for each step.

---

## Tool Definition Structure

### Minimal HTTP tool

```yaml
name: github_get_user
description: Get a GitHub user's public profile by username
version: '1.0.0'

parameters:
  username:
    type: string
    required: true
    description: GitHub username, e.g. octocat

execution:
  type: http
  method: GET
  url: 'https://api.github.com/users/{username}'
  headers:
    Accept: application/vnd.github+json
  timeout: 15000
```

Required fields: `name`, `description`, `version`, `execution`. Every entry in `parameters` needs a `description`.

### All top-level fields

| Field | Purpose |
|-------|---------|
| `name`, `description`, `version` | Identity. Use `snake_case` names, unique across loaded tools |
| `parameters` | Inputs the caller passes (see below) |
| `execution` | How the tool runs: `http`, `function` or `command` |
| `authentication` | Describes the credential (see Credentials) |
| `output_schema` | Documents the response shape; `max_response_size` caps it in bytes |
| `requires_approval` | `true` asks a human before every call. Forced to `true` for agent-created tools |
| `risk` | `low`, `medium`, `high` or `critical`. Can raise the computed risk, never lower it |
| `status` | `draft`, `approved` or `deprecated`. Forced to `draft` for agent-created tools |
| `tags`, `examples` | Discovery and documentation |
| `deprecated`, `deprecation_message` | Mark a tool for removal |
| `error_handling`, `rate_limiting` | Accepted by the schema; **not applied yet** (no retries, no rate limiting) |

Any other key is dropped silently when the tool loads.

---

## Execution Types

> **Agents create `type: http` tools only.** `matimo_validate_tool` reports `no-function-execution` or `no-command-execution` for the others, and `matimo_create_tool` refuses them.

### `type: http` — always allowed

```yaml
execution:
  type: http
  method: POST                    # GET, POST, PUT, DELETE, PATCH
  url: 'https://api.example.com/v1/items/{item_id}'
  headers:
    Authorization: 'Bearer {EXAMPLE_API_TOKEN}'
    Content-Type: application/json
  query_params:
    expand: '{expand}'
  body:
    title: '{title}'
    count: '{count}'
  timeout: 15000                  # milliseconds
```

| Field | Notes |
|-------|-------|
| `method`, `url` | Required |
| `headers`, `query_params`, `body` | Optional; all support `{placeholders}` |
| `parameter_encoding` | Optional; e.g. MIME-encode an email body |
| `timeout` | Milliseconds. Python defaults to 30000; TypeScript has no default, so always set one |

For agent-created tools, the default policy allows only `GET` and `POST`, only public HTTPS hosts (no `localhost`, private ranges, `169.254.*`, `*.internal`, `*.local`), and only the domains and credentials the developer allowed.

### `type: function` — SDK developers only

```yaml
risk: low                         # required for function tools
execution:
  type: function
  code: './my_tool.ts'            # module path, relative to this YAML
  timeout: 30000
```

```typescript
// my_tool.ts
import type { FunctionToolContext } from '@matimo/core';

export default async function myTool(
  params: Record<string, unknown>,
  context?: FunctionToolContext // { credentials?, policyContext? }
): Promise<unknown> {
  return { success: true, value: params.value };
}
```

The Python executor lives next to it as `my_tool.py` with a `run(params, context)` function. A function tool is classified by its declared `risk:`; `pnpm validate-tools` rejects one without it.

### `type: command` — SDK developers only

```yaml
execution:
  type: command
  command: node                   # fixed executable; no {placeholders} here
  args: ['scripts/report.js', '--id', '{report_id}']
  timeout: 30000
```

Only `args` are templated. Every call asks a human unless the YAML says `requires_approval: false`. The process gets the parent's environment plus per-call credentials; TypeScript ignores `cwd`, `shell` and `env`.

---

## Parameters

```yaml
parameters:
  channel:
    type: string                  # string | number | boolean | array | object
    required: true
    description: Channel ID, e.g. C0123456789
  limit:
    type: number
    required: false
    default: 20
    description: Maximum results (1-100)
  state:
    type: string
    enum: [open, closed, all]
    description: Filter by state
  labels:
    type: array
    items:
      type: string
    description: Label names
```

Supported keys: `type`, `description`, `required`, `enum`, `default`, `examples`, `items`, `properties`. There are no `pattern`, `min` or `max` keys; describe limits in `description` instead.

`default` is applied when a call comes through LangChain or MCP (their schemas fill it in). A direct `matimo.execute()` does not fill defaults, so an omitted optional parameter is simply left out of the request.

Use `snake_case` parameter names, matching the API you call where you can.

### Templating

`{name}` is replaced with the parameter's value.

| Where | Behavior |
|-------|----------|
| `url` | Every placeholder must be supplied, or the call fails with `INVALID_SCHEMA` |
| `query_params` | An entry whose placeholder is not supplied is left out |
| `headers`, `body` | A key whose placeholder is not supplied is left out |
| Whole-value placeholder in `body` (`count: '{count}'`) | Sent with the parameter's type: a `number` as a number, a `boolean` as a boolean, an `object` or `array` as JSON |
| Placeholder inside a longer string (`'id-{id}'`) | Sent as a string |

---

## Credentials

> ❌ **Never write a real key or placeholder text** such as `YOUR_API_KEY` into YAML. It is sent as-is.
>
> ✅ **Write `{UPPER_CASE_NAME}`** and let Matimo fill it in.

A placeholder is filled from a credential when its name contains `TOKEN`, `KEY`, `SECRET`, `PASSWORD`, `CREDENTIAL`, `AUTH`, `BEARER` or `API_KEY` (any case). Matimo looks in this order:

1. The call's `credentials` option (`NAME`, then `MATIMO_NAME`)
2. The environment: `MATIMO_NAME`, then `NAME` (Python also accepts `MATIMO_<TOOL_NAME>_NAME`)

```yaml
execution:
  type: http
  method: GET
  url: 'https://api.weatherapi.com/v1/current.json'
  query_params:
    key: '{WEATHER_API_KEY}'      # filled from MATIMO_WEATHER_API_KEY or WEATHER_API_KEY
    q: '{city}'

authentication:
  type: api_key
  location: query
  name: key
```

In TypeScript, if an auth header placeholder (such as `Authorization: 'Bearer {SLACK_BOT_TOKEN}'`) cannot be filled, the call fails with `AUTH_FAILED` and names the variable to set. Python sends the request and the API rejects it.

The `authentication` block documents the credential (`type: api_key | bearer | basic | oauth2`, `location`, `name`). It injects nothing by itself, with one exception — basic auth:

```yaml
authentication:
  type: basic
  username_env: JIRA_EMAIL
  password_env: JIRA_API_TOKEN    # Matimo builds the Authorization: Basic header
```

If the developer set `allowedCredentials`, a placeholder naming any other credential is rejected (`unauthorized-credential`).

---

## Responses and Errors

- An HTTP tool returns `{ success, data, statusCode, headers }` in TypeScript and the parsed response body in Python.
- A non-2xx response raises a `MatimoError`: 401/403 → `AUTH_FAILED`, 429 → `RATE_LIMIT_EXCEEDED`, others → `EXECUTION_FAILED`, with `details.retryable` set for 429 and 5xx. Timeouts and connection failures raise `TIMEOUT` / `NETWORK_ERROR`.
- Results larger than `output_schema.max_response_size` (default 256 KB) are truncated and marked.

---

## Checklist Before You Create

```
[ ] type: http, method GET or POST, a public HTTPS URL
[ ] name in snake_case, not starting with matimo_
[ ] every parameter has type + description; required set where needed
[ ] every URL placeholder is a required parameter
[ ] credentials written as {UPPER_CASE_NAME} containing TOKEN/KEY/SECRET/...
[ ] timeout set
[ ] matimo_validate_tool returns valid: true
```

SDK developers also run `pnpm validate-tools` and write unit tests with mocked HTTP; see `docs/tool-development/ADDING_TOOLS.md`.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `description is required` | A parameter has no `description` | Add one to every parameter |
| `Required URL parameter 'x' is missing` | A URL placeholder was not passed | Make it `required: true`, or move it to `query_params` |
| `Authentication credentials are missing` (TypeScript) or a 401 | An auth placeholder could not be filled | Set `MATIMO_<NAME>` or `<NAME>`, or pass `credentials` |
| The API gets `{param}` literally | The placeholder is inside a longer string and the parameter was not passed | Pass it, or make it its own body key |
| A key you added has no effect | It is not in the schema (e.g. `timeout_ms`, `pattern`) and was dropped | Use the fields listed above |
| `no-ssrf`, `blocked-domain`, `unauthorized-credential` | Policy rule | See the `policy-validation` skill |

---

## References

- **Lifecycle**: the `meta-tools-lifecycle` skill
- **Policy rules**: the `policy-validation` skill
- **Finding existing tools first**: the `tool-discovery` skill
