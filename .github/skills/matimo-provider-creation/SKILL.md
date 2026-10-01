---
name: matimo-provider-creation
description: Create new Matimo provider packages for TypeScript and Python SDKs. Covers package layout, HTTP and function tool definitions, governance fields, authentication patterns, and test standards, using Matimo's MCP tools for validation.
metadata:
  category: "Tool Development"
  difficulty: "advanced"
  domain: "Provider Implementation"
  languages: ["typescript", "python"]
  user-invokable: false
  invocation: "Referenced by matimo-tool-creator agent for technical guidance"
---

# Matimo Provider Creation — TypeScript & Python

This skill teaches the comprehensive workflow for creating production-grade provider packages in **both TypeScript and Python SDKs** with identical patterns and full Matimo tool integration.

## Quick Reference: Agent Tool Mapping

| Objective | Tool | Usage |
|-----------|------|-------|
| **Write tool YAML** | `edit/createFile` | Write `definition.yaml` in the package directory (both SDKs) |
| **Validate YAML** | `matimo_validate_tool` | `yaml_content` → schema errors and policy notes |
| **Validate all tools** | `execute` → `pnpm validate-tools` | Schema plus repo rules (DELETE needs `requires_approval: true`, function tools need `risk:`) |
| **Validate Skill** | `matimo_validate_skill` | Check a SKILL.md against the Agent Skills spec |
| **Search Code** | `search` | Find existing patterns/tools to copy from |
| **Execute Commands** | `execute` | Run tests and linting (the user approves each command) |
| **Fetch Web Content** | `web` | Retrieve official API documentation |

> **Never use `matimo_create_tool` for a provider package.** It is the runtime meta-tool for agents: it writes `./matimo-tools/<name>/definition.yaml`, forces `status: draft` and `requires_approval: true`, and asks a human before it runs. A draft only runs for the `admin` role, so a provider tool written this way would not work for users.

---

## Part 1: Universal Provider Structure

### TypeScript Provider Package

```
typescript/packages/{provider}/
├── package.json                              # {"name": "@matimo/{provider}", "type": "module"}
├── definition.yaml                           # OAuth2 provider config (if OAuth2)
├── README.md                                 # Usage guide, examples, auth setup
├── tools/
│   ├── {tool-1}/
│   │   └── definition.yaml                   # HTTP tool: YAML only
│   └── {tool-2}/
│       ├── definition.yaml                   # Function tool: code: ./{tool-2}.js
│       └── {tool-2}.ts                       # compiled to {tool-2}.js by the package build
├── skills/
│   └── {provider}/SKILL.md                   # Agent knowledge document
└── test/
    ├── unit/
    │   └── {tool-1}.test.ts
    └── integration/
        └── {provider}-tools.test.ts
```

Add the package to `typescript/pnpm-workspace.yaml`.

### Python Provider Package

```
python/packages/{provider}/
├── pyproject.toml                           # name = "matimo-{provider}", depends on matimo-core>=0.2.0,<0.3.0
├── README.md
├── src/
│   └── matimo_{provider}/
│       ├── __init__.py
│       ├── definition.yaml                  # OAuth2 provider config (if OAuth2)
│       └── tools/
│           ├── {tool-1}/
│           │   └── definition.yaml          # same YAML as TypeScript
│           └── {tool-2}/
│               ├── definition.yaml          # code: ./{tool-2}.py
│               └── {tool-2}.py              # async def run(params, context=None)
└── tests/
    ├── unit/
    │   └── test_{tool_1}.py
    └── integration/
        └── test_{provider}_tools.py
```

Python packages do not ship a SKILL.md yet; the skill lives in the TypeScript package.

HTTP tool definitions are identical in both SDKs. A function tool's `code:` path differs (`.js` in TypeScript, `.py` in Python); if the YAML names a non-`.py` file, Python runs the `.py` sibling.

Copy an existing package (`slack` for HTTP tools, `microsoft` for function tools) rather than starting from scratch.

---

## Part 2: Tool Definition Formats

### HTTP Tool (identical in both SDKs)

```yaml
name: {provider}_{action}                    # snake_case, unique across all tools
description: Clear description from the API docs
version: '1.0.0'
# status: leave unset (= approved). Allowed values are draft | approved | deprecated;
# TypeScript skips a tool with any other value, such as "stable".

parameters:
  param_name:
    type: string                             # string, number, boolean, object, array
    required: true
    description: From the official API docs
  limit:
    type: number
    required: false
    default: 10
    description: Maximum results (1-100)

execution:
  type: http
  method: GET                                # GET, POST, PUT, DELETE, PATCH
  url: 'https://api.provider.com/v1/resource/{param_name}'
  headers:
    Authorization: 'Bearer {PROVIDER_API_KEY}'   # filled from MATIMO_PROVIDER_API_KEY or PROVIDER_API_KEY
    Content-Type: application/json
  query_params:
    limit: '{limit}'
  timeout: 15000                             # TypeScript has no default; always set it

authentication:
  type: api_key                              # api_key, bearer, basic, oauth2
  location: header                           # header, query, body
  name: Authorization

output_schema:
  type: object
  properties:
    id:
      type: string

examples:
  - name: Example from the API docs
    params:
      param_name: value

notes:
  env: PROVIDER_API_KEY
```

**Governance (required):**
- `DELETE` and other destructive calls: `requires_approval: true` (`pnpm validate-tools` rejects a DELETE without it)
- Every function tool: `risk: low | medium | high | critical`
- Writes (POST/PUT/PATCH) are `medium` risk automatically; add `requires_approval: true` when a write is hard to undo (sending email, posting publicly)

`error_handling` and `rate_limiting` are accepted but not applied yet. Matimo does not validate parameters or responses against the YAML.

### Function Tool (multi-step logic, response shaping, file I/O)

Use `type: function` only when one HTTP call can't do the job.

**TypeScript** — `tools/{tool}/definition.yaml` and `tools/{tool}/{tool}.ts`:

```yaml
name: {provider}_{action}
description: ...
version: '1.0.0'
risk: medium
parameters:
  input:
    type: string
    required: true
    description: ...
execution:
  type: function
  code: ./{provider}_{action}.js              # the compiled output of {provider}_{action}.ts
```

```typescript
import type { FunctionToolContext } from '@matimo/core';

export default async function execute(
  params: Record<string, unknown>,
  context?: FunctionToolContext // { credentials?, policyContext? }
): Promise<unknown> {
  const token = context?.credentials?.PROVIDER_API_KEY ?? process.env.PROVIDER_API_KEY;
  // ... call the API, shape the result
  return { success: true };
}
```

**Python** — same YAML with `code: ./{provider}_{action}.py`, and:

```python
from typing import Any


async def run(params: dict[str, Any], context: Any = None) -> dict[str, Any]:
    # ... call the API, shape the result
    return {"success": True}
```

Agents can never create function or command tools; only maintainers add them here. No provider package ships a `type: command` tool.

---

## Part 3: Authentication Patterns (Identical)

A `{PLACEHOLDER}` is filled from a credential when its name contains `TOKEN`, `KEY`, `SECRET`, `PASSWORD`, `CREDENTIAL`, `AUTH`, `BEARER` or `API_KEY`. Lookup order: the call's `credentials`, then `MATIMO_<NAME>`, then `<NAME>` in the environment. Do **not** declare the credential as a parameter — that would show it to the model.

### Pattern 1: API Key (Header)

```yaml
execution:
  headers:
    X-Api-Key: '{PROVIDER_API_KEY}'
authentication:
  type: api_key
  location: header
  name: X-Api-Key
```

Setup: `export PROVIDER_API_KEY="sk_..."` (or `MATIMO_PROVIDER_API_KEY`).

### Pattern 2: Bearer Token (OAuth2)

```yaml
execution:
  headers:
    Authorization: 'Bearer {PROVIDER_ACCESS_TOKEN}'
authentication:
  type: oauth2
  provider: {provider}           # matches the package's definition.yaml
```

### Pattern 3: Basic Auth

```yaml
authentication:
  type: basic
  username_env: PROVIDER_EMAIL
  password_env: PROVIDER_API_TOKEN
```

Matimo builds the `Authorization: Basic …` header from the two variables; no header template is needed.

### Pattern 4: API Key in the query string

```yaml
execution:
  query_params:
    key: '{PROVIDER_API_KEY}'
authentication:
  type: api_key
  location: query
  name: key
```

---

## Part 4: Testing Standards (TypeScript)

Unit tests live in `typescript/packages/{provider}/test/unit/` and never call a live API. Write two kinds:

1. **Definition tests** — read the YAML with `js-yaml` and check method, URL, required parameters, credential placeholder and governance fields. See `typescript/packages/mailchimp/test/unit/mailchimp-tools.test.ts`.
2. **Execution tests** — `jest.mock('axios')`, load the tools with `MatimoInstance.init({ toolPaths: [TOOLS_DIR] })`, call `matimo.execute()`, and assert the request sent and the result. For tools that need approval, pass an `onApproval` that records and refuses, and assert nothing was sent.

Copy the working examples in [docs/tool-development/TESTING.md](../../../docs/tool-development/TESTING.md); they were run as real tests. Remember that a TypeScript HTTP tool returns `{ success, data, statusCode, headers }`.

---

## Part 5: Testing Standards (Python)

Unit tests live in `python/packages/{provider}/tests/unit/` and mock HTTP with `respx`:

```python
@respx.mock
@pytest.mark.asyncio
async def test_get_user() -> None:
    route = respx.get("https://api.provider.com/users/123").mock(
        return_value=httpx.Response(200, json={"id": "123"})
    )
    matimo = await Matimo.init(TOOLS_DIR)

    result = await matimo.execute("{provider}_get_user", {"user_id": "123"})

    assert route.called
    assert result == {"id": "123"}        # Python returns the parsed body
```

Mark every async test with `@pytest.mark.asyncio`. See [docs/tool-development/TESTING.md](../../../docs/tool-development/TESTING.md) for the approval-path test.

---

## Part 6: Matimo Tool Usage in Workflows

### `matimo_validate_tool` — check one YAML before saving it

```json
{ "name": "matimo_validate_tool", "arguments": { "yaml_content": "name: provider_get_user\n..." } }
```

Returns:

```json
{ "valid": true, "schemaErrors": [], "policyViolations": [], "riskLevel": "low" }
```

Fix every `schemaErrors` entry. `policyViolations` apply the rules for *agent-created* tools, so a legitimate provider tool can trip some of them — for example `blocked-http-method` for a `DELETE`. Treat those as a prompt to check the governance fields, not as errors.

### `pnpm validate-tools` — check the whole workspace

```json
{ "name": "execute", "arguments": { "command": "cd typescript && pnpm validate-tools" } }
```

This is the gate CI runs. It also enforces `requires_approval: true` on DELETE tools and `risk:` on function tools.

### Running tests

```json
{ "name": "execute", "arguments": { "command": "cd typescript && pnpm test -- packages/{provider}" } }
```

`execute` declares `requires_approval: true`, so the MCP server asks the user before each command (through MCP elicitation, if the client supports it). Tell the user what you are about to run.

### Reloading

A running MCP server does not see new files until it reloads. `matimo_reload_tools` asks the user first; restarting the server works too.

---

## Part 7: Side-by-Side Pattern Examples

### HTTP Tool: TypeScript vs Python (Identical YAML)

**Shared definition:** `packages/provider/tools/get-user/definition.yaml` (TypeScript) or `python/packages/provider/src/matimo_provider/tools/get-user/definition.yaml` (Python)

```yaml
name: provider_get_user
description: Retrieve user information from Provider API
version: '1.0.0'

parameters:
  user_id:
    type: string
    required: true
    description: Unique user identifier

execution:
  type: http
  method: GET
  url: 'https://api.provider.com/users/{user_id}'
  headers:
    Authorization: 'Bearer {PROVIDER_API_TOKEN}'

authentication:
  type: bearer

output_schema:
  type: object
  properties:
    id:
      type: string
    name:
      type: string
    email:
      type: string

examples:
  - name: Get specific user
    params:
      user_id: "user123"
```

Both TypeScript and Python use this **exact same YAML**. The execution is handled by their respective HTTP executors already built into `@matimo/core` and `matimo` Python SDK.

### Function Tool Implementation

**TypeScript**: `typescript/packages/provider/tools/provider_transform/provider_transform.ts`
```typescript
export default async function execute(params: Record<string, unknown>): Promise<unknown> {
  const inputData = params.input_data as string;
  return { transformed: true, data: inputData };
}
```

**Python**: `python/packages/provider/src/matimo_provider/tools/provider_transform/provider_transform.py`
```python
from typing import Any


async def run(params: dict[str, Any], context: Any = None) -> dict[str, Any]:
    return {"transformed": True, "data": params["input_data"]}
```

---

## Part 8: README Template (Both SDKs)

**Location**: `packages/{provider}/README.md` (TS) or `python/packages/{provider}/README.md` (Python)

```markdown
# @matimo/{provider} — {Provider} Tools for Matimo

{Provider} integration for Matimo SDK. Perform actions like list users, create resources, send notifications.

## Installation

### TypeScript
\`\`\`bash
npm install @matimo/{provider}
# or
pnpm add @matimo/{provider}
\`\`\`

### Python
\`\`\`bash
pip install matimo-{provider}
# or
uv add matimo-{provider}
\`\`\`

## Available Tools

| Tool | Method | Purpose |
|------|--------|---------|
| `{provider}_get_user` | GET | Retrieve user profile |
| `{provider}_create_resource` | POST | Create new resource |

## Quick Start

### TypeScript
\`\`\`typescript
import { MatimoInstance } from '@matimo/core';

const matimo = await MatimoInstance.init({ autoDiscover: true });

const user = await matimo.execute('{provider}_get_user', { user_id: '123' });
console.log(user);
\`\`\`

### Python
\`\`\`python
from matimo import Matimo

matimo = await Matimo.init(auto_discover=True)

user = await matimo.execute('{provider}_get_user', {'user_id': '123'})
print(user)
\`\`\`

## Authentication

Set your {Provider} API key:

\`\`\`bash
export {PROVIDER}_API_KEY="your_api_key_here"   # or MATIMO_{PROVIDER}_API_KEY
\`\`\`

## Examples

### LangChain Integration

**TypeScript**:
\`\`\`typescript
import { MatimoInstance, convertToolsToLangChain } from '@matimo/core';

const matimo = await MatimoInstance.init({ autoDiscover: true, onApproval: askUser });
const tools = await convertToolsToLangChain(
  matimo.listTools().filter((t) => t.name.startsWith('{provider}_')),
  matimo
);

// Use with LangChain agents
\`\`\`

**Python**:
\`\`\`python
from matimo import Matimo, convert_tools_to_langchain

matimo = await Matimo.init(auto_discover=True, on_approval=ask_user)
tools = convert_tools_to_langchain(
    [t for t in matimo.list_tools() if t.name.startswith("{provider}_")], matimo
)

# Use with LangChain agents
\`\`\`

## Contributing

See [CONTRIBUTING.md](../../CONTRIBUTING.md)

## License

MIT — Part of the Matimo SDK
```

---

## Agents: Decision Tree

```
Q: "Should I write tool YAML myself or use matimo_create_tool?"
→ Write it yourself, in the package directory, then validate it.
→ matimo_create_tool is for runtime agent tools: it makes drafts in ./matimo-tools.

Q: "Is Python different from TypeScript?"
→ HTTP tool YAML is identical.
→ Function tools: code: points at .js (TS) or .py (Python); the logic is ported.

Q: "How do I validate a tool?"
→ One YAML: matimo_validate_tool(yaml_content)
→ Whole workspace: pnpm validate-tools (the CI gate)
→ Code: pnpm lint / pnpm test, uv run ruff check / uv run pytest

Q: "Does every write need approval?"
→ DELETE and destructive calls: requires_approval: true (enforced)
→ Other writes: decide per tool; sending or publishing usually should

Q: "Which tool should I use?"
→ Writing files? → edit/createFile
→ Validating? → matimo_validate_tool, then execute → pnpm validate-tools
→ Searching patterns? → search
→ Running tests? → execute
→ Checking a skill? → matimo_validate_skill
```

---

## Key Principles

✅ **Patterns are identical** across TS and Python — only language differs
✅ **Validate every tool** with matimo_validate_tool and pnpm validate-tools
✅ **Test thoroughly** — unit + integration tests mandatory
✅ **Reference existing tools** before creating new ones (Slack, Gmail examples)
✅ **YAML first** — define once, execute everywhere
✅ **No secrets in code** — all auth via environment variables and templating
