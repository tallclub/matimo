# @matimo/core — Core SDK for Matimo

Matimo core provides the TypeScript SDK that loads, validates, and executes YAML-defined tools across frameworks.

## 📦 Installation

Install the unified package (includes core exports):

```bash
# install unscope package which includes core and cli 
npm install matimo
pnpm add matimo
# or install scoped core package directly
npm install @matimo/core
pnpm add @matimo/core
```

## 🔧 Purpose

`@matimo/core` contains:

- `MatimoInstance` — initialization, discovery, registry, and execution API
- **Executors** — Command (shell), HTTP (REST with object/array embedding), Function (JS/TS)
- **Policy Engine** — content validation, risk classification, RBAC, integrity tracking
- **Meta-Tools** — 9 built-in tools for tool lifecycle management (create, validate, approve, reload, list, skill)
- **Approval System** — human-in-the-loop approval with interactive, auto-approve, and MCP patterns
- **MCP Server** — Model Context Protocol server with HTTP and stdio transports
- Decorator utilities (`@tool`, `setGlobalMatimoInstance`)
- Zod-based schema validation for YAML tool definitions
- **Structured error handling** — `MatimoError` with error chaining via optional `cause` field
- OAuth2 authentication support (provider integrations in separate packages)

This package is intended to be imported by applications, CLIs, and provider packages.

## 🚀 Quick Start

```typescript
import { MatimoInstance } from 'matimo';

// Auto-discover installed @matimo/* tool packages
const matimo = await MatimoInstance.init({ autoDiscover: true });

// List tools
console.log('Loaded', matimo.listTools().length, 'tools');

// Execute a tool
await matimo.execute('calculator', { operation: 'add', a: 1, b: 2 });
```

## 🛠 Included Core Tools

`@matimo/core` includes 18 built-in tools:

### Utility Tools
- **`execute`** — Run shell commands with output capture, timeout, and working directory control
- **`read`** — Read files with line range support and encoding detection
- **`edit`** — Edit/replace content in files with backup
- **`search`** — Search files with grep patterns and context
- **`web`** — Fetch and parse web content
- **`web_scraper`** — Crawl and extract readable content from web pages, with SSRF/robots.txt-aware multi-page support
- **`calculator`** — Arithmetic operations, including a sandboxed expression mode (`sqrt(16) + 2^3`)
- **`convert_to_file`** — Convert content between formats (JSON/CSV/Markdown/text to PDF/DOCX/etc.)
- **`extract_from_file`** — Extract text/structured content from local or remote PDF, DOCX, CSV, and text files

### Meta-Tools (Tool Lifecycle Management)
- **`matimo_validate_tool`** — Validate YAML against schema + policy rules, returns risk level
- **`matimo_create_tool`** — Write a new tool to disk with safety enforcement (forces draft + requires_approval)
- **`matimo_approve_tool`** — Promote a draft tool with HMAC-signed approval manifest
- **`matimo_reload_tools`** — Hot-reload all tools into the live registry without restart
- **`matimo_list_user_tools`** — List tools in a directory with risk classification and status
- **`matimo_create_skill`** — Create SKILL.md files with validated YAML frontmatter
- **`matimo_list_skills`** — List skills in a directory with name, description, and path
- **`matimo_get_skill`** — Read a skill's full content by name for agent context
- **`matimo_validate_skill`** — Validate a skill against the Agent Skills specification

All core tools use **function-based execution** (not shell commands) for better performance and reliability.

## 🧩 Usage Patterns

- Factory pattern: `MatimoInstance.init()` + `matimo.execute()`
- Decorator pattern: use `@tool()` and `setGlobalMatimoInstance()` for class-based code
- LangChain integration: convert Matimo tools to LangChain function schemas

See the full SDK docs: [docs/api-reference/SDK.md](../../docs/api-reference/SDK.md)

## ⚙️ Executors

`@matimo/core` provides three execution engines:

### FunctionExecutor (Recommended for Core Tools)
Executes TypeScript/JavaScript functions with type-safe parameters:
- ✅ **Direct execution** — No subprocess overhead
- ✅ **Better performance** — Direct async function calls
- ✅ **Type safety** — Proper TypeScript integration
- ✅ **Error handling** — Native exception handling

**Core tools** (`execute`, `read`, `edit`, `search`, `web`, `calculator`) all use function-based execution:
```yaml
# Tool YAML:
execution:
  type: function
  code: './execute.ts'  # Relative path to implementation

# File: execute.ts
export default async function execute(params: {
  command: string
  args?: string[]
  cwd?: string
  timeout?: number
}): Promise<{ success: boolean; stdout: string; stderr: string; exitCode: number }> {
  // Implementation here
}
```

### HttpExecutor
Makes HTTP requests with automatic parameter embedding and response validation:
```yaml
# Tool YAML:
execution:
  type: http
  method: POST
  url: https://api.example.com/data
  headers:
    Authorization: 'Bearer {AUTH_TOKEN}'
  body:
    text: '{text}'
    metadata: '{metadata}'  # Objects/arrays automatically JSON-encoded
```

**Key features:**
- ✅ **Parameter embedding** — Objects and arrays automatically JSON-encoded in request body
- ✅ **Response validation** — Validates output against `output_schema` using Zod
- ✅ **Error normalization** — Converts Axios/HTTP errors to structured `MatimoError`
- ✅ **Structured error details** — Original error preserved via `error.cause` field

### CommandExecutor (Legacy Shell Execution)
Spawns shell processes for external commands:
```typescript
// Tool YAML:
execution:
  type: command
  command: node
  args: ["script.js", "{param1}"]

// Spawns: node script.js value1
```

**Use when:**
- Executing external shell commands or legacy scripts
- Running tools from other packages that expect shell execution
- Most core Matimo tools now use function-based execution instead

## 🚨 Error Handling

All executors throw `MatimoError` (never generic `Error`) with structured context:

```typescript
import { MatimoError, ErrorCode } from '@matimo/core';

try {
  await matimo.execute('my-tool', params);
} catch (error) {
  if (error instanceof MatimoError) {
    console.error(`Error: ${error.message}`);
    console.error(`Code: ${error.code}`);
    console.error(`Details:`, error.details);
    
    // Access original exception (if available)
    if (error.cause) {
      console.error(`Original error:`, error.cause);
    }
  }
}
```

**Error codes:**
- `INVALID_SCHEMA` — Tool definition or parameters invalid
- `EXECUTION_FAILED` — Tool execution failed (network, timeout, etc.)
- `AUTH_FAILED` — Authentication/authorization error
- `TOOL_NOT_FOUND` — Tool not found in registry

**Error chaining:**
The optional `cause` field preserves the original error for debugging:
```typescript
throw new MatimoError('HTTP request failed', ErrorCode.EXECUTION_FAILED, {
  toolName: 'slack_send',
  statusCode: 500,
  details: { originalError: axiosError }
});
// Access via: error.cause or error.details.originalError
```

## 🔐 Authentication & Security

Tools declare authentication requirements in YAML. `@matimo/core` supports:

- **API keys** (header/query injection)
- **Bearer/basic tokens** (automatic injection)
- **OAuth2** (provider configurations via OAuth2Handler)

Credentials are loaded from environment variables by convention:
```bash
export SLACK_BOT_TOKEN=xoxb-...
export GMAIL_ACCESS_TOKEN=ya29-...
export NOTION_API_KEY=ntn_...
```

**Security notes:**
- ✅ Secrets never logged (error messages exclude credential values)
- ✅ OAuth tokens refreshed automatically when expired
- ✅ HTTP Executor validates all authentication before making requests
- ✅ Missing credentials throw `MatimoError(AUTH_FAILED)` with helpful guidance

## 🛡 Policy Engine

The policy engine provides defense-in-depth security for AI agent tool usage. Policy is defined at deploy time and `Object.freeze()`'d at runtime — agents cannot modify it.

```typescript
import { MatimoInstance } from 'matimo';
import type { PolicyConfig } from 'matimo';

const policyConfig: PolicyConfig = {
  allowedDomains: ['api.github.com', 'api.slack.com'],
  allowedHttpMethods: ['GET', 'POST'],
  allowCommandTools: false,
  allowFunctionTools: false,
  protectedNamespaces: ['matimo_'],
};

const matimo = await MatimoInstance.init({
  toolPaths: ['./tools', './agent-tools'],
  untrustedPaths: ['./agent-tools'],
  policyConfig,
});
```

### Content Validator (9 Rules)

| Rule | Severity | What It Checks |
|------|----------|----------------|
| `no-function-execution` | critical | Blocks arbitrary code execution |
| `no-command-execution` | critical | Blocks shell injection |
| `no-ssrf` | critical | Blocks internal IPs/metadata endpoints |
| `unauthorized-credential` | high | Blocks unapproved credentials |
| `reserved-namespace` | high | Blocks hijacking of `matimo_` prefix |
| `forced-approval` | medium | Enforces `requires_approval: true` |
| `blocked-http-method` | high | Blocks disallowed HTTP methods |
| `blocked-domain` | high | Blocks disallowed domains |
| `forced-draft-status` | medium | Enforces `status: draft` on new tools |

### Risk Classification

| Risk Level | Criteria |
|-----------|----------|
| **critical** | `execution.type: function` |
| **high** | `execution.type: command`, HTTP `DELETE`, `requires_approval: true` |
| **medium** | HTTP `POST`, `PUT`, `PATCH` |
| **low** | HTTP `GET`, `HEAD`, `OPTIONS` |

See the full guide: [docs/tool-development/POLICY_AND_LIFECYCLE.md](../../docs/tool-development/POLICY_AND_LIFECYCLE.md)

## 🔄 Tool Lifecycle (Create → Approve → Reload → Use)

Agents can create tools at runtime with full policy enforcement:

```typescript
// 1. Create — writes YAML to disk (forces draft + requires_approval)
await matimo.execute('matimo_create_tool', {
  name: 'city_lookup',
  target_dir: './agent-tools',
  yaml_content: `
name: city_lookup
version: '1.0.0'
description: Look up user information including city and address details
parameters:
  id: { type: string, required: true }
execution:
  type: http
  method: GET
  url: 'https://jsonplaceholder.typicode.com/users/{id}'
`,
});

// 2. Approve — re-validates, signs HMAC, updates status to approved
await matimo.execute('matimo_approve_tool', {
  name: 'city_lookup',
  tool_dir: './agent-tools',
});

// 3. Reload — clears registry, re-reads YAML, re-validates untrusted tools
await matimo.execute('matimo_reload_tools', {});

// 4. Use — tool is now in the live registry
const result = await matimo.execute('city_lookup', { id: '1' });
```

This lifecycle works identically across SDK, LangChain, and MCP interfaces.

See the full reference: [docs/tool-development/META_TOOLS.md](../../docs/tool-development/META_TOOLS.md)

## ✅ Approval System

Tools with `requires_approval: true` require human confirmation before execution:

```typescript
import { getGlobalApprovalHandler } from 'matimo';

// Interactive terminal approval
getGlobalApprovalHandler().setApprovalCallback(async (request) => {
  console.log(`Tool: ${request.toolName}`);
  console.log(`Params: ${JSON.stringify(request.params)}`);
  // return true to approve, false to reject
  return await promptUser('Approve? (y/n)');
});

// Auto-approve (CI/CD only)
process.env.MATIMO_AUTO_APPROVE = 'true';

// Pre-approved patterns
process.env.MATIMO_APPROVED_PATTERNS = 'calculator,weather_*';
```

**MCP approval:** MCP clients pass `_matimo_approved: true` in arguments for tools that require approval.

See: [docs/APPROVAL-SYSTEM.md](../../docs/APPROVAL-SYSTEM.md)

## 🌐 MCP Server

Serve Matimo tools via the Model Context Protocol:

```typescript
import { MCPServer } from 'matimo';

const server = new MCPServer({
  transport: 'http',
  port: 3000,
  toolPaths: ['./tools'],
  policyConfig: { allowCommandTools: false },
  mcpToken: process.env.MCP_TOKEN,
});

await server.start();
// Tools available at POST http://localhost:3000/mcp
```

**Supports:**
- HTTP and stdio transports
- Bearer token authentication
- Tool lifecycle via meta-tools (create, approve, reload)
- Automatic `notifications/tools/list_changed` on reload

See: [docs/MCP.md](../../docs/MCP.md)

## ✅ Validation & Output Schema

All tool execution includes automatic validation:

**Input Validation:**
- Tool YAML definitions validated against Zod schema on load
- Parameters validated against tool's declared `parameters` schema
- Invalid parameters throw `MatimoError(INVALID_SCHEMA)`

**Output Validation:**
- HTTP executor validates response against tool's `output_schema`
- Function executor validates return value against `output_schema` (for HTTP tools)
- Invalid responses/returns throw `MatimoError(EXECUTION_FAILED)`
- Zod provides detailed validation error messages

**Example (core `execute` tool):**
```yaml
# Definition: packages/core/tools/execute/definition.yaml
execution:
  type: function
  code: './execute.ts'

output_schema:
  type: object
  properties:
    success: { type: boolean }
    exitCode: { type: number }
    stdout: { type: string }
    stderr: { type: string }
  required: [success, exitCode, stdout, stderr]
```

Invalid parameters or responses trigger validation errors with structured details.

## 🧪 Testing & Development

To run core package tests:

```bash
pnpm --filter "@matimo/core" test
```

To build:

```bash
pnpm --filter "@matimo/core" build
```

## 📚 Documentation

- [Quick Start](../../docs/getting-started/QUICK_START.md)
- [API Reference](../../docs/api-reference/SDK.md)
- [Policy & Lifecycle Guide](../../docs/tool-development/POLICY_AND_LIFECYCLE.md)
- [Meta-Tools Reference](../../docs/tool-development/META_TOOLS.md)
- [Approval System](../../docs/APPROVAL-SYSTEM.md)
- [MCP Server](../../docs/MCP.md)
- [Tool Specification](../../docs/tool-development/TOOL_SPECIFICATION.md)
- [Adding Tools](../../docs/tool-development/ADDING_TOOLS.md)
- [Contributing](https://github.com/tallclub/matimo/blob/main/CONTRIBUTING.md)

---

Part of the Matimo ecosystem — define tools once, use them everywhere.
