# Policy Engine & Tool Lifecycle Guide

> Complete developer and agent guide for Matimo's policy engine, tool creation, approval flow, hot-reload, and MCP integration.

## Table of Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
- [Policy Configuration](#policy-configuration)
  - [PolicyConfig Options](#policyconfig-options)
  - [Initialization](#initialization)
  - [Immutability](#immutability)
- [Content Validator](#content-validator)
  - [9 Security Rules](#9-security-rules)
  - [Violation Severities](#violation-severities)
  - [Using validateToolContent()](#using-validatetoolcontent)
- [Risk Classification](#risk-classification)
- [Tool Lifecycle](#tool-lifecycle)
  - [Step 1: Create a Tool (matimo_create_tool)](#step-1-create-a-tool)
  - [Step 2: Approve a Tool (matimo_approve_tool)](#step-2-approve-a-tool)
  - [Step 3: Reload Tools (matimo_reload_tools)](#step-3-reload-tools)
  - [Step 4: Use the Tool](#step-4-use-the-tool)
  - [Full Lifecycle Example](#full-lifecycle-example)
- [Approval System](#approval-system)
  - [How Approval Works](#how-approval-works)
  - [Interactive Terminal Approval](#interactive-terminal-approval)
  - [Auto-Approve (CI/CD)](#auto-approve-cicd)
  - [Pre-Approved Patterns](#pre-approved-patterns)
  - [Session Whitelisting](#session-whitelisting)
  - [MCP Approval Flow](#mcp-approval-flow)
- [Integrity & Tamper Detection](#integrity--tamper-detection)
  - [SHA-256 Integrity Tracking](#sha-256-integrity-tracking)
  - [HMAC Approval Manifest](#hmac-approval-manifest)
- [RBAC & Access Control](#rbac--access-control)
- [Audit Events](#audit-events)
- [MCP Integration](#mcp-integration)
  - [MCP + Policy Engine](#mcp--policy-engine)
  - [MCP + Tool Lifecycle](#mcp--tool-lifecycle)
- [LangChain Agent Integration](#langchain-agent-integration)
- [API Reference](#api-reference)
- [Examples](#examples)

---

## Overview

The Matimo Policy Engine provides defense-in-depth security for AI agent tool usage:

```
┌─────────────────────────────────────────────────────────────────┐
│  Agent / Framework (LangChain, MCP, SDK)                       │
└─────────────────────┬───────────────────────────────────────────┘
                      │ matimo.execute(toolName, params)
┌─────────────────────▼───────────────────────────────────────────┐
│  Policy Gate                                                    │
│  ┌──────────────┐  ┌─────────────┐  ┌──────────────────────┐   │
│  │ canExecute() │  │ Approval    │  │ Content Validator    │   │
│  │ RBAC+status  │  │ Handler     │  │ 9 security rules     │   │
│  └──────────────┘  └─────────────┘  └──────────────────────┘   │
│  ┌──────────────┐  ┌─────────────┐  ┌──────────────────────┐   │
│  │ Risk         │  │ Integrity   │  │ HMAC Approval        │   │
│  │ Classifier   │  │ Tracker     │  │ Manifest             │   │
│  └──────────────┘  └─────────────┘  └──────────────────────┘   │
└─────────────────────┬───────────────────────────────────────────┘
                      │ allowed
┌─────────────────────▼───────────────────────────────────────────┐
│  Tool Execution (HTTP / Command / Function)                     │
└─────────────────────────────────────────────────────────────────┘
```

**Key principles:**

1. **Developer defines policy at deploy time** — agents cannot modify it
2. **Policy is Object.freeze()'d** after initialization — immutable at runtime
3. **All untrusted tools** are validated against the content rules
4. **Every decision** is logged as a structured audit event
5. **Deterministic** — same input always produces the same policy decision

---

## Quick Start

```typescript
import { MatimoInstance } from 'matimo';
import type { PolicyConfig } from 'matimo';

// 1. Define your policy
const policyConfig: PolicyConfig = {
  allowedDomains: ['api.github.com', 'api.slack.com'],
  allowedHttpMethods: ['GET', 'POST'],
  allowCommandTools: false,
  allowFunctionTools: false,
  protectedNamespaces: ['matimo_'],
};

// 2. Initialize with policy
const matimo = await MatimoInstance.init({
  toolPaths: ['./tools'],
  policyConfig,
  untrustedPaths: ['./agent-tools'],  // Tools here get validated
});

// 3. Policy is now active and immutable
console.log(matimo.hasPolicy()); // true

// 4. Execute tools — policy enforced automatically
await matimo.execute('my_tool', { query: 'hello' });
```

---

## Policy Configuration

### PolicyConfig Options

```typescript
interface PolicyConfig {
  /** Allowed domains for HTTP tools. Tools targeting other domains are rejected. */
  allowedDomains?: string[];

  /** Allowed HTTP methods. Default: ['GET', 'POST'] */
  allowedHttpMethods?: string[];

  /** Allow tools with execution.type: 'command'. Default: false */
  allowCommandTools?: boolean;

  /** Allow tools with execution.type: 'function'. Default: false */
  allowFunctionTools?: boolean;

  /** Reserved namespace prefixes. Default: ['matimo_'] */
  protectedNamespaces?: string[];

  /** Allowed credential/env var names for agent-created tools */
  allowedCredentials?: string[];
}
```

### InitOptions (Full Configuration)

```typescript
const matimo = await MatimoInstance.init({
  // Tool discovery
  toolPaths: ['./tools', './agent-tools'],  // Directories to load tools from
  autoDiscover: true,                       // Auto-discover @matimo/* packages
  includeCore: true,                        // Include built-in core tools

  // Policy
  policyConfig: {                           // Creates DefaultPolicyEngine
    allowedDomains: ['api.example.com'],
    allowedHttpMethods: ['GET', 'POST'],
    allowCommandTools: false,
    allowFunctionTools: false,
    protectedNamespaces: ['matimo_'],
  },
  untrustedPaths: ['./agent-tools'],        // Paths subject to content validation
  trustedPaths: ['./tools'],                // Developer-authored (skip content validation)

  // Approval
  approvalSecret: process.env.MATIMO_APPROVAL_SECRET,  // HMAC secret for manifests
  approvalDir: './approvals',               // Directory for .matimo-approvals.json

  // Audit
  onEvent: (event) => {                     // Subscribe to all policy events
    console.log(`[${event.type}]`, event);
  },

  // Logging
  logLevel: 'info',                         // 'silent' | 'error' | 'warn' | 'info' | 'debug'
  logFormat: 'json',                        // 'json' | 'simple'
});
```

> **Tip:** You can also pass a custom `PolicyEngine` implementation via the `policy` option instead of `policyConfig`.
```

### Immutability

After `MatimoInstance.init()`, the policy configuration is `Object.freeze()`'d:

```typescript
// ❌ These would throw at runtime — policy is frozen
matimo.policyConfig.allowCommandTools = true;       // TypeError: Cannot assign
matimo.policyConfig.allowedDomains.push('evil.com'); // TypeError: Cannot add
```

This ensures agents cannot weaken security at runtime.

---

## Content Validator

### 9 Security Rules

The content validator runs 9 deterministic rules against every untrusted tool definition. Each rule produces a violation with a severity level.

| # | Rule ID | Severity | What It Checks |
|---|---------|----------|----------------|
| 1 | `no-function-execution` | **critical** | Blocks `execution.type: function` (arbitrary code execution) |
| 2 | `no-command-execution` | **critical** | Blocks `execution.type: command` (shell injection) |
| 3 | `no-ssrf` | **critical** | Blocks internal IPs/hostnames in URLs |
| 4 | `no-unauthorized-credentials` | **high** | Blocks credentials not in `allowedCredentials` |
| 5 | `reserved-namespace` | **high** | Blocks tool names starting with protected prefixes |
| 6 | `force-approval` | **medium** | Enforces `requires_approval: true` |
| 7 | `allowed-http-methods` | **high** | Blocks HTTP methods not in `allowedHttpMethods` |
| 8 | `allowed-domains` | **high** | Blocks domains not in `allowedDomains` |
| 9 | `force-draft-status` | **medium** | Enforces `status: 'draft'` on new tools |

#### SSRF (Server Side Request Forgery) Blocked Patterns

The `no-ssrf` rule blocks URLs targeting:

- `169.254.169.254` — AWS/cloud metadata endpoint
- `10.*`, `172.16-31.*`, `192.168.*` — RFC 1918 private networks
- `localhost`, `127.0.0.1`, `0.0.0.0` — Loopback addresses
- `*.internal`, `*.local` — Internal DNS suffixes
- `metadata.google.internal` — GCP metadata

### Violation Severities

| Severity | Meaning | Effect |
|----------|---------|--------|
| `critical` | Security vulnerability | Tool rejected — cannot be created or loaded |
| `high` | Policy violation | Tool rejected — cannot be created or loaded |
| `medium` | Best practice enforcement | Warning — tool created but flagged |
| `low` | Informational | Advisory only |

**Rejection threshold:** Any violation with severity `critical` or `high` causes the tool to be rejected.

### Using validateToolContent()

```typescript
import { validateToolContent, validateToolDefinition } from 'matimo';

const tool = validateToolDefinition({
  name: 'my_tool',
  version: '1.0.0',
  description: 'My tool',
  execution: { type: 'command', command: 'rm', args: ['-rf', '/'] },
});

const result = validateToolContent(tool, { source: 'untrusted' });

console.log(result.valid);      // false
console.log(result.violations); // [{ rule: 'no-command-execution', severity: 'critical', ... }]
console.log(result.riskLevel);  // 'high'
```

---

## Risk Classification

Risk is classified deterministically based on execution type and HTTP method:

| Risk Level | Criteria |
|-----------|---------|
| **critical** | `execution.type: function` (arbitrary code) |
| **high** | `execution.type: command` (shell), HTTP `DELETE`, or `requires_approval: true` |
| **medium** | HTTP `POST`, `PUT`, `PATCH` |
| **low** | HTTP `GET`, `HEAD`, `OPTIONS` |

```typescript
import { classifyRisk } from 'matimo';

const risk = classifyRisk(toolDefinition);
// Returns: 'low' | 'medium' | 'high' | 'critical'
```

Risk classification is deterministic — the same tool definition always produces the same risk level.

---

## Tool Lifecycle

The full lifecycle for agent-created tools:

```
 Create          Approve           Reload            Use
┌──────┐      ┌──────────┐     ┌──────────┐     ┌──────────┐
│ YAML │ ───▶ │  HMAC    │ ──▶ │ Registry │ ──▶ │ Execute  │
│ draft│      │ approved │     │ loaded   │     │ result   │
└──────┘      └──────────┘     └──────────┘     └──────────┘
    │              │                │                │
    │ validates    │ re-validates   │ policy check   │ approval
    │ content      │ signs HMAC     │ untrusted      │ if required
    │ forces draft │ updates YAML   │ tools          │

HMAC - Hash based Message Authentication Code.
```

### Step 1: Create a Tool

Use `matimo_create_tool` to write a new tool definition to disk.

**Via SDK:**
```typescript
const result = await matimo.execute('matimo_create_tool', {
  name: 'city_lookup',
  target_dir: './agent-tools',
  yaml_content: `
name: city_lookup
version: '1.0.0'
description: Look up user information including city and address details
parameters:
  id:
    type: string
    required: true
    description: User ID to look up (1-10)
execution:
  type: http
  method: GET
  url: 'https://jsonplaceholder.typicode.com/users/{id}'
`,
});

console.log(result);
// {
//   success: true,
//   path: './agent-tools/city_lookup/definition.yaml',
//   riskLevel: 'low',
//   status: 'draft',          ← forced by policy
//   message: 'Tool created as draft. Use matimo_approve_tool to promote.'
// }
```

**What happens internally:**

1. **Name sanitization** — blocks path traversal (`../`), control characters, `matimo_` prefix
2. **YAML parsing** — validates syntax
3. **Safety fields forced** — `requires_approval: true` and `status: 'draft'` always set
4. **Schema validation** — validates against Zod ToolDefinition schema
5. **Content validation** — runs all 9 content rules
6. **Risk classification** — assigns risk level
7. **Write to disk** — creates `{target_dir}/{name}/definition.yaml`

**What gets blocked:**

```typescript
// ❌ Shell command tool — blocked by content validator
await matimo.execute('matimo_create_tool', {
  name: 'file_reader',
  yaml_content: `
name: file_reader
execution:
  type: command
  command: cat
  args: ['{path}']
`,
});
// Error: Tool failed policy validation
// [critical] no-command-execution: Command-type tools are not allowed

// ❌ SSRF tool — blocked
await matimo.execute('matimo_create_tool', {
  name: 'metadata_probe',
  yaml_content: `
execution:
  type: http
  url: 'http://169.254.169.254/latest/meta-data/'
`,
});
// Error: [critical] no-ssrf: URL targets internal/metadata endpoint

// ❌ Namespace hijack — blocked
await matimo.execute('matimo_create_tool', {
  name: 'matimo_backdoor',
  yaml_content: '...',
});
// Error: Tool name cannot start with reserved namespace "matimo_"
```

### Step 2: Approve a Tool

Use `matimo_approve_tool` to promote a draft tool to approved status.

```typescript
const result = await matimo.execute('matimo_approve_tool', {
  name: 'city_lookup',
  tool_dir: './agent-tools',
});

console.log(result);
// {
//   success: true,
//   name: 'city_lookup',
//   hash: 'a1b2c3d4...',           ← SHA-256 hash of YAML content
//   approvedAt: '2026-03-14T...',
//   message: 'Tool approved. Effective after reload.'
// }
```

**What happens internally:**

1. **Read definition** from `{tool_dir}/{name}/definition.yaml`
2. **Re-validate** — runs content validator again (prevents approve-after-modify attacks)
3. **Compute hash** — SHA-256 of the YAML content
4. **HMAC sign** — creates cryptographic approval signature
5. **Update YAML** — changes `status: draft` → `status: approved`
6. **Write manifest** — saves to `.matimo-approvals.json`

**HMAC Approval Manifest:**

The approval is stored as a signed record:

```json
{
  "city_lookup": {
    "hash": "sha256:a1b2c3d4...",
    "signature": "hmac-sha256:...",
    "approvedAt": "2026-03-14T09:30:00.000Z",
    "approvedBy": "system"
  }
}
```

If someone modifies the YAML after approval, the hash won't match and the approval is automatically revoked on the next reload.

### Step 3: Reload Tools

Use `matimo_reload_tools` to hot-reload all tools from disk into the live registry.

```typescript
// Via meta-tool (works from SDK, LangChain, and MCP)
const result = await matimo.execute('matimo_reload_tools', {});

console.log(result);
// {
//   success: true,
//   loaded: 13,
//   removed: 0,
//   revalidated: 1,     ← untrusted tools re-checked against policy
//   rejected: [],
//   message: 'Reload complete. 13 tools loaded, 0 removed, 0 rejected.'
// }

// Or programmatically (SDK only)
const reloadResult = await matimo.reloadTools();
```

**What happens internally:**

1. **Clear registry** — removes all tools from memory
2. **Re-read YAML** from all configured `toolPaths`
3. **Re-validate untrusted** — tools from `untrustedPaths` run through `canCreate()` policy check
4. **Reject violations** — tools with critical/high violations are rejected
5. **Register** — approved tools added to registry
6. **Track integrity** — SHA-256 hashes recorded for tamper detection
7. **Emit event** — `tools:reloaded` audit event with counts

**Why is matimo_reload_tools a meta-tool?**

Because it enables the full create→approve→reload→use lifecycle from **any** interface:

| Interface | How to Reload |
|-----------|--------------|
| SDK | `matimo.reloadTools()` or `matimo.execute('matimo_reload_tools', {})` |
| LangChain | Agent calls `matimo_reload_tools` tool |
| MCP | Client calls `tools/call` with `name: 'matimo_reload_tools'` |

Without this tool, MCP clients had no way to trigger a reload — they'd need SDK access.

### Step 4: Use the Tool

After reload, the tool is in the registry and can be executed:

```typescript
// The newly created tool is now available
const tools = matimo.listTools();
console.log(tools.map(t => t.name));
// [..., 'city_lookup']

// Execute it
const result = await matimo.execute('city_lookup', { query: 'London' });
```

Note: Agent-created tools always have `requires_approval: true`, so the first execution will trigger an approval prompt (or require `_matimo_approved: true` via MCP).

### Full Lifecycle Example

```typescript
import { MatimoInstance, getGlobalApprovalHandler } from 'matimo';
import type { PolicyConfig } from 'matimo';

// 1. Configure
const policyConfig: PolicyConfig = {
  allowedDomains: ['jsonplaceholder.typicode.com'],
  allowedHttpMethods: ['GET'],
  allowCommandTools: false,
  allowFunctionTools: false,
};

const matimo = await MatimoInstance.init({
  toolPaths: ['./core-tools', './agent-tools'],
  untrustedPaths: ['./agent-tools'],
  policyConfig,
});

// 2. Set up approval handler
getGlobalApprovalHandler().setApprovalCallback(async (request) => {
  console.log(`Approve ${request.toolName}? [y/n]`);
  return true; // or prompt user
});

// 3. Create
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

// 4. Approve
await matimo.execute('matimo_approve_tool', {
  name: 'city_lookup',
  tool_dir: './agent-tools',
});

// 5. Reload
await matimo.execute('matimo_reload_tools', {});

// 6. Use
const user = await matimo.execute('city_lookup', { id: '1' });
console.log(user);
// { success: true, data: { name: "Leanne Graham", address: { city: "Gwenborough" } } }
```

---

## Approval System

### How Approval Works

```
matimo.execute('tool_name', params)
         │
         ▼
   tool.requires_approval === true    ──── OR ────   content has destructive keywords?
         │ yes                                        (DELETE, DROP, TRUNCATE, etc.)
         ▼
   Is tool pre-approved?
   • MATIMO_AUTO_APPROVE=true?         → yes → execute
   • matches MATIMO_APPROVED_PATTERNS? → yes → execute
         │ no
         ▼
   Call approval callback
   • interactiveApproval(request)
   • Shows: toolName, description, params
   • Returns: boolean (approved or rejected)
         │
    ┌────┴────┐
    │approved │rejected
    ▼         ▼
  Execute   Throw MatimoError
            (EXECUTION_FAILED)
```

### Interactive Terminal Approval

```typescript
import { getGlobalApprovalHandler } from 'matimo';
import readline from 'readline';

const handler = getGlobalApprovalHandler();

handler.setApprovalCallback(async (request) => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise<boolean>((resolve) => {
    console.log(`\nTool: ${request.toolName}`);
    console.log(`Description: ${request.description}`);
    console.log(`Params: ${JSON.stringify(request.params)}`);

    rl.question('Approve? (y/n): ', (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y');
    });
  });
});
```

### Auto-Approve (CI/CD)

```bash
# Approve ALL tools (use in trusted CI/CD only)
export MATIMO_AUTO_APPROVE=true
```

### Pre-Approved Patterns

```bash
# Approve specific tools or patterns
export MATIMO_APPROVED_PATTERNS="calculator,weather_*,search"

# Supports wildcards:
#   calculator      → exact match
#   weather_*       → matches weather_get, weather_forecast, etc.
#   *               → matches everything (same as AUTO_APPROVE)
```

### Session Whitelisting

In interactive mode, approved tools can be added to a session whitelist so subsequent calls skip the prompt:

```typescript
const whitelist = new Set<string>();

handler.setApprovalCallback(async (request) => {
  // Skip prompt if already approved this session
  if (whitelist.has(request.toolName)) {
    return true;
  }

  const approved = await promptUser(request);

  if (approved) {
    whitelist.add(request.toolName);
  }

  return approved;
});
```

### MCP Approval Flow

When tools are called via MCP, approval works differently — there's no terminal to prompt:

```
MCP Client → tools/call { name: 'tool_name', arguments: { ... } }
                │
                ▼
          tool.requires_approval === true?
                │ yes
                ▼
          args._matimo_approved === true?
          ├─ no  → Return error: "Re-invoke with _matimo_approved: true"
          └─ yes → Strip _matimo_approved from args, execute tool
```

**MCP client pattern:**

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "matimo_reload_tools",
    "arguments": {
      "_matimo_approved": true
    }
  }
}
```

The `_matimo_approved` parameter is automatically added to the MCP schema for any tool with `requires_approval: true`. It appears in `tools/list` as an optional boolean parameter.

---

## Integrity & Tamper Detection

### SHA-256 Integrity Tracking

The `ToolIntegrityTracker` computes SHA-256 hashes of tool definitions and detects changes between reloads:

```typescript
import { ToolIntegrityTracker } from 'matimo';

const tracker = new ToolIntegrityTracker();

// Record a tool's hash
tracker.record('my_tool', yamlContent, 'untrusted');

// On reload, check if content changed
const action = tracker.check('my_tool', yamlContent);
// Returns:
//   'keep'       — hash matches, skip re-validation
//   'revalidate' — hash changed, must re-run policy checks
//   'validate'   — new tool, first-time validation needed
```

| Action | Meaning |
|--------|---------|
| `validate` | New tool — never seen before, must validate |
| `keep` | Same hash — content unchanged, safe to skip |
| `revalidate` | Different hash — content was modified, must re-validate |

### HMAC Approval Manifest

The `ApprovalManifest` stores cryptographic approvals:

```typescript
import { ApprovalManifest } from 'matimo';

const manifest = new ApprovalManifest('./tools', process.env.MATIMO_APPROVAL_SECRET);

// Approve a tool
const hash = manifest.computeHash(yamlContent);
manifest.approve('my_tool', hash);

// Verify approval
const isValid = manifest.verify('my_tool', hash);
// true — hash matches, HMAC valid

// Modify the YAML, then re-check
const newHash = manifest.computeHash(modifiedYaml);
const stillValid = manifest.verify('my_tool', newHash);
// false — hash changed, approval auto-revoked
```

**Approval secret:**

```bash
# Set a persistent secret for HMAC signing
export MATIMO_APPROVAL_SECRET=your-secret-key

# If not set, Matimo generates a random UUID (approvals don't persist across restarts)
```

---

## RBAC & Access Control

The `DefaultPolicyEngine.canExecute()` method enforces role-based access control:

| Tool Status | Who Can Execute | Notes |
|-------------|----------------|-------|
| `approved` | Everyone | Normal production tools |
| `draft` | `admin` role only | Agent-created tools before approval |
| `deprecated` | Nobody | Always blocked |
| `requires_approval` in prod | `admin` role only | Draft tools in production environment |

> **Note:** RBAC uses `roles: string[]` (array), not a single role string. A user with `roles: ['admin', 'reader']` gets the highest-privilege match.

```typescript
import { DefaultPolicyEngine } from 'matimo';

const policy = new DefaultPolicyEngine(policyConfig);

// Check if a caller can execute a tool
const decision = policy.canExecute(
  { roles: ['reader'], environment: 'production' }, // PolicyContext
  toolDefinition
);

console.log(decision.allowed); // true or false
console.log(decision.reason);  // 'Draft tool requires admin role'
```

**PolicyContext:**

```typescript
interface PolicyContext {
  agentId?: string;                    // Identifier for the calling agent
  environment?: string;                // 'dev' | 'staging' | 'prod'
  roles?: string[];                    // ['reader', 'writer', 'admin']
  metadata?: Record<string, unknown>;  // Custom metadata for policy rules
}
```

---

## Audit Events

Every policy decision emits a structured event via the `onEvent` callback:

```typescript
const auditLog: MatimoEvent[] = [];

const matimo = await MatimoInstance.init({
  // ...
  onEvent: (event) => auditLog.push(event),
});

// After operations, inspect the log:
auditLog.forEach(event => {
  console.log(`[${event.type}] ${event.toolName} at ${event.timestamp}`);
});
```

**Event types:**

| Event Type | When Emitted | Key Fields |
|-----------|-------------|------------|
| `tool:created` | New tool loaded into registry | `toolName`, `source`, `riskLevel` |
| `tool:approved` | Tool approved via manifest | `toolName`, `approvedBy`, `hash` |
| `tool:rejected` | Tool failed content validation | `toolName`, `violations[]` |
| `tool:revoked` | Approval revoked (YAML changed) | `toolName`, `reason` |
| `tool:executed` | Tool executed successfully or not | `toolName`, `agentId`, `duration`, `success` |
| `tool:execution_denied` | Policy blocked an execute() call | `toolName`, `reason`, `agentId` |
| `tools:reloaded` | reloadTools() completed | `loaded`, `removed`, `rejected[]` |

**Event structure (discriminated union):**

`MatimoEvent` is a discriminated union — each event type has its own shape:

```typescript
type MatimoEvent =
  | { type: 'tool:created'; toolName: string; source: 'trusted' | 'untrusted'; riskLevel: RiskLevel; timestamp: string }
  | { type: 'tool:approved'; toolName: string; approvedBy?: string; hash: string; timestamp: string }
  | { type: 'tool:rejected'; toolName: string; violations: Violation[]; timestamp: string }
  | { type: 'tool:revoked'; toolName: string; reason: string; timestamp: string }
  | { type: 'tool:executed'; toolName: string; agentId?: string; duration: number; success: boolean; timestamp: string }
  | { type: 'tool:execution_denied'; toolName: string; reason: string; agentId?: string; timestamp: string }
  | { type: 'tools:reloaded'; loaded: number; removed: number; rejected: string[]; timestamp: string };

type MatimoEventHandler = (event: MatimoEvent) => void;
```

---

## MCP Integration

### MCP + Policy Engine

When tools are served via MCP, the same policy engine applies:

```typescript
import { MCPServer } from 'matimo';

const mcpServer = new MCPServer({
  transport: 'http',
  port: 3000,
  toolPaths: ['./core-tools', './agent-tools'],
  untrustedPaths: ['./agent-tools'],
  policyConfig: {
    allowedDomains: ['api.example.com'],
    allowCommandTools: false,
  },
  mcpToken: 'your-bearer-token',
});

await mcpServer.start();
// All tools validated on startup
// Policy enforced on every tools/call
```

**MCP execution flow:**

```
MCP Client → POST /mcp (tools/call)
  │
  ▼ MCPServer handler
  │
  ├─ requires_approval? → check _matimo_approved
  │
  ▼ matimo.execute(toolName, params)
  │
  ├─ Policy check (canExecute)
  ├─ Approval check (auto-approved in MCP context)
  ├─ Auth injection
  ├─ Executor routing
  │
  ▼ Result → MCP response
```

### MCP + Tool Lifecycle

The complete create→approve→reload→use lifecycle works via MCP:

```bash
# 1. Create a tool via MCP
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Mcp-Session-Id: $SESSION" \
  -d '{
    "jsonrpc": "2.0", "id": 1,
    "method": "tools/call",
    "params": {
      "name": "matimo_create_tool",
      "arguments": {
        "name": "my_new_tool",
        "target_dir": "./agent-tools",
        "yaml_content": "name: my_new_tool\nversion: '\''1.0.0'\''\n...",
        "_matimo_approved": true
      }
    }
  }'

# 2. Approve it
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Mcp-Session-Id: $SESSION" \
  -d '{
    "jsonrpc": "2.0", "id": 2,
    "method": "tools/call",
    "params": {
      "name": "matimo_approve_tool",
      "arguments": {
        "name": "my_new_tool",
        "tool_dir": "./agent-tools",
        "_matimo_approved": true
      }
    }
  }'

# 3. Reload (brings new tool into registry + notifies MCP clients)
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Mcp-Session-Id: $SESSION" \
  -d '{
    "jsonrpc": "2.0", "id": 3,
    "method": "tools/call",
    "params": {
      "name": "matimo_reload_tools",
      "arguments": { "_matimo_approved": true }
    }
  }'

# 4. Use the new tool (now in tools/list)
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Mcp-Session-Id: $SESSION" \
  -d '{
    "jsonrpc": "2.0", "id": 4,
    "method": "tools/call",
    "params": {
      "name": "my_new_tool",
      "arguments": { "query": "test", "_matimo_approved": true }
    }
  }'
```

---

## LangChain Agent Integration

### Setup

```typescript
import { MatimoInstance, convertToolsToLangChain, getGlobalApprovalHandler } from 'matimo';
import { ChatOpenAI } from '@langchain/openai';
import type { ToolDefinition, PolicyConfig } from 'matimo';

const matimo = await MatimoInstance.init({
  toolPaths: ['./tools', './agent-tools'],
  untrustedPaths: ['./agent-tools'],
  policyConfig: { /* ... */ },
});

// Convert Matimo tools to LangChain format
const tools = matimo.listTools();
const langchainTools = await convertToolsToLangChain(tools as ToolDefinition[], matimo);

// Create LLM with tools bound
const llm = new ChatOpenAI({ model: 'gpt-4o-mini', temperature: 0 });
let llmWithTools = llm.bindTools(langchainTools);

// Set up human-in-the-loop approval
getGlobalApprovalHandler().setApprovalCallback(async (request) => {
  console.log(`Agent wants to call: ${request.toolName}`);
  return true; // or prompt user
});
```

### Full Lifecycle from LangChain Agent

```typescript
// Agent creates a tool → human approves → reload → agent uses it

// 1. Agent calls matimo_create_tool (LLM decides this autonomously)
const createResult = await matimo.execute('matimo_create_tool', {
  name: 'city_lookup',
  target_dir: './agent-tools',
  yaml_content: '...',
});

// 2. Agent calls matimo_approve_tool
await matimo.execute('matimo_approve_tool', {
  name: 'city_lookup',
  tool_dir: './agent-tools',
});

// 3. Agent calls matimo_reload_tools
await matimo.execute('matimo_reload_tools', {});

// 4. IMPORTANT: Rebind LangChain tools (registry changed)
const updatedTools = matimo.listTools();
const updatedLangchainTools = await convertToolsToLangChain(
  updatedTools as ToolDefinition[],
  matimo
);
llmWithTools = llm.bindTools(updatedLangchainTools);

// 5. Now the agent can call the new tool
const result = await matimo.execute('city_lookup', { id: '1' });
```

> **Important:** After `matimo_reload_tools`, you must rebind LangChain tools because the registry has changed. The LLM needs an updated tool list to know about newly available tools.

---

## API Reference

### MatimoInstance

| Method | Returns | Description |
|--------|---------|-------------|
| `MatimoInstance.init(config)` | `Promise<MatimoInstance>` | Initialize with policy and tools |
| `matimo.execute(name, params)` | `Promise<unknown>` | Execute a tool (policy enforced) |
| `matimo.listTools(context?)` | `ToolDefinition[]` | List available tools (policy filtered) |
| `matimo.searchTools(query)` | `ToolDefinition[]` | Search tools by name/description |
| `matimo.reloadTools()` | `Promise<ReloadResult>` | Hot-reload from disk |
| `matimo.hasPolicy()` | `boolean` | Check if policy is active |

### ReloadResult

```typescript
interface ReloadResult {
  loaded: number;       // Total tools loaded
  removed: number;      // Tools no longer on disk
  revalidated: number;  // Untrusted tools re-checked
  rejected: string[];   // Tool names that failed policy
}
```

### Policy Exports

```typescript
import {
  // Policy engine
  DefaultPolicyEngine,
  validateToolContent,
  isSSRFTarget,
  classifyRisk,

  // Integrity
  ToolIntegrityTracker,
  ApprovalManifest,

  // Approval
  ApprovalHandler,
  getGlobalApprovalHandler,

  // Types
  type PolicyEngine,
  type PolicyConfig,
  type PolicyContext,
  type PolicyDecision,
  type RiskLevel,
  type Violation,
  type ValidationResult,
  type ValidationContext,
  type MatimoEvent,
  type MatimoEventHandler,
  type ReloadResult,
  type ApprovalRequest,
  type ApprovalCallback,
} from 'matimo';
```

---

## Examples

### Policy Demo (Full 11-Mission Autonomous Agent)

```bash
cd examples/tools
export OPENAI_API_KEY=sk-...
printf "y\ny\ny\ny\nn\ny\n" | pnpm policy:demo
```

See [examples/tools/policy/README.md](../../examples/tools/policy/README.md) for detailed documentation.

### Minimal Policy Setup

```typescript
const matimo = await MatimoInstance.init({
  toolPaths: ['./tools'],
  policyConfig: {
    allowedDomains: ['api.example.com'],
    allowCommandTools: false,
  },
});
```

### Interactive Approval with Whitelist

```typescript
const whitelist = new Set<string>();

getGlobalApprovalHandler().setApprovalCallback(async (req) => {
  if (whitelist.has(req.toolName)) return true;

  const approved = await askUser(`Approve ${req.toolName}?`);
  if (approved) whitelist.add(req.toolName);
  return approved;
});
```

### MCP Server with Policy

```typescript
const server = new MCPServer({
  transport: 'http',
  port: 3000,
  policyConfig: {
    allowedDomains: ['api.github.com'],
    allowCommandTools: false,
  },
  mcpToken: process.env.MCP_TOKEN,
});
await server.start();
```
