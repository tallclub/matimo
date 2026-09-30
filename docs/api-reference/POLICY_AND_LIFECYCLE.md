# Policy Engine & Tool Lifecycle Guide

> Complete developer and agent guide for Matimo's policy engine, tool creation, approval flow, hot-reload, and MCP integration.

## Table of Contents

- [When to Use the Policy Engine](#when-to-use-the-policy-engine)
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
- [HITL Quarantine](#hitl-quarantine)
  - [How Quarantine Works](#how-quarantine-works)
  - [Enabling HITL](#enabling-hitl)
  - [HITLCallback & HITLRequest](#hitlcallback--hitlrequest)
  - [Resolution Flow](#resolution-flow)
  - [Quarantine Events](#quarantine-events)
  - [Quarantine Risk Level Configuration](#quarantine-risk-level-configuration)
- [Policy Hot-Reload](#policy-hot-reload)
  - [reloadPolicy()](#reloadpolicy)
  - [parsePolicyFile()](#parsepolicyfile)
  - [Hot-Reload Events](#hot-reload-events)
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

## When to Use the Policy Engine

### Decision Guide

| Situation | Recommendation |
|-----------|-----------------|
| Agents can create/run tools dynamically (LangChain, MCP) | ✅ Always enable policy — agents must not execute arbitrary code |
| Fixed tool set, no agent-created tools | Optional — policy is still best practice but not critical |
| Production deployment | ✅ Load policy from `policy.yaml` file — version-controlled, auditable |
| Development / local testing | Inline `policyConfig` is fine for quick iteration |
| Multiple environments (dev/staging/prod) | Use `policyFile: process.env.POLICY_FILE` with environment-specific files |
| LLM must call shell commands | ❌ Never — `allowCommandTools: false` always |
| LLM must run arbitrary JS functions | ❌ Never — `allowFunctionTools: false` always |

### Use Cases by Policy Feature

**`allowedDomains`** — Use when agents may create HTTP tools
```yaml
# ✅ Lock agents to only call known-safe APIs
allowedDomains:
  - api.github.com
  - api.slack.com
  - jsonplaceholder.typicode.com
# Without this: an agent could create a tool targeting internal infrastructure
```

**`allowedCredentials`** — Use when agents handle auth tokens
```yaml
# ✅ Prevent credential theft — agents can't reference env vars you haven't allowed
allowedCredentials:
  - GITHUB_TOKEN
  - SLACK_BOT_TOKEN
# Without this: agent could create a tool that exfiltrates OPENAI_API_KEY or AWS_SECRET
```

**`protectedNamespaces`** — Use to prevent namespace hijacking
```yaml
# ✅ Agents cannot create tools named matimo_backdoor or company_prod_delete
protectedNamespaces:
  - matimo_
  - company_prod_
```

**`enableHITL` + `quarantineRiskLevels`** — Use for medium/high-risk agentic workflows
```yaml
# ✅ Human reviews any tool classified as medium or high risk before it executes
enableHITL: true
quarantineRiskLevels:
  - medium
  - high
# Without this: agent will auto-execute POST/PUT/DELETE tools without human review
```

**`untrustedPaths`** — Always set when loading agent-created tools
```typescript
await MatimoInstance.init({
  autoDiscover: true,
  toolPaths: [agentToolsDir],       // Where agent writes tools
  untrustedPaths: [agentToolsDir],  // ← Mark same dir as untrusted → runs 9 security rules
});
// Without untrustedPaths: agent-created tools skip validation entirely
```

### Benefits: Policy vs No Policy

| Risk | Without Policy | With Policy |
|------|:--------------:|:-----------:|
| Agent creates shell command tool | Executes ✗ | Blocked at `critical` |
| Agent targets internal IP (SSRF) | Potential data leak ✗ | Blocked at `critical` |
| Agent uses unapproved credential | Token theft possible ✗ | Blocked at `high` |
| Agent names tool `matimo_backdoor` | Namespace collision ✗ | Blocked at `high` |
| Medium-risk POST tool auto-executes | No oversight ✗ | HITL quarantine |
| Policy changed by agent at runtime | Possible ✗ | `Object.freeze()` prevents it |

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

### Option 1: Load Policy from YAML File (Recommended for Teams)

Create `policy.yaml`:
```yaml
allowedDomains:
  - api.github.com
  - api.slack.com
allowedHttpMethods:
  - GET
  - POST
allowCommandTools: false
allowFunctionTools: false
protectedNamespaces:
  - matimo_
```

Then initialize:
```typescript
import { MatimoInstance } from 'matimo';

const matimo = await MatimoInstance.init({
  toolPaths: ['./tools'],
  policyFile: './policy.yaml',           // ← Load from file
  untrustedPaths: ['./agent-tools'],     // Tools here get validated
});

console.log(matimo.hasPolicy()); // true
await matimo.execute('my_tool', { query: 'hello' });
```

**Advantages:**
- ✅ Environment-specific configs (dev/staging/prod policies)
- ✅ Version-controlled policy changes
- ✅ Easy to audit policy decisions
- ✅ No rebuild needed to change policy

### Option 2: Inline Policy Config (Development)

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
  toolPaths: ['./tools'],
  policyConfig,
  untrustedPaths: ['./agent-tools'],
});
```

### Option 3: Custom PolicyEngine (Advanced)

```typescript
import { MatimoInstance } from 'matimo';
import type { PolicyEngine, PolicyContext, PolicyDecision } from 'matimo';
import type { ToolDefinition } from 'matimo';

class MyCustomPolicy implements PolicyEngine {
  canCreate(context: PolicyContext, tool: ToolDefinition): PolicyDecision {
    // Custom logic here
    return { allowed: true };
  }
  canExecute(context: PolicyContext, tool: ToolDefinition): PolicyDecision {
    // Custom logic here
    return { allowed: true };
  }
  filterForAgent(tools: ToolDefinition[], context: PolicyContext): ToolDefinition[] {
    return tools; // Custom filtering
  }
}

const matimo = await MatimoInstance.init({
  toolPaths: ['./tools'],
  policy: new MyCustomPolicy(),
});
```

### Policy Loading & Initialization

Under the hood, when you pass `policyFile`, Matimo:
1. Reads the YAML file using [`loadPolicyFromFile()`](../../typescript/packages/core/src/policy/policy-loader.ts)
2. Validates it against a strict Zod schema
3. Creates a `DefaultPolicyEngine` with the config
4. **Freezes the policy** with `Object.freeze()` — immutable at runtime
5. Returns the initialized instance

If the YAML is invalid (syntax error, schema violation, or file missing), an error is thrown:
```
Error: Policy file "./policy.yaml" is invalid:
  • allowedDomains: expected array, received string
```

---

## Policy Configuration

### PolicyConfig YAML File Format

When using `policyFile`, create a YAML file with the following structure:

```yaml
# policy.yaml
# Matimo Policy Configuration
#
# Governs what agent-created tools are permitted.
# Developer-authored tools in trustedPaths are NOT subject to this policy.
# Only agent-proposed tools in untrustedPaths go through validation.

# HTTP domain allowlist
# If set, agent-created HTTP tools may only target these domains.
allowedDomains:
  - api.slack.com
  - api.github.com
  - api.openai.com
  - jsonplaceholder.typicode.com

# Credential allowlist
# Env-var names that agent-created tools are allowed to reference.
# If omitted, any credential is allowed (not recommended for production).
allowedCredentials:
  - SLACK_BOT_TOKEN
  - GITHUB_TOKEN
  - OPENAI_API_KEY

# HTTP methods allowlist
# Methods allowed for agent-created HTTP tools.
# Default: ['GET', 'POST']
allowedHttpMethods:
  - GET
  - POST
  # - PUT        # Uncomment to allow
  # - DELETE     # Uncomment to allow

# Shell execution permission
# Whether agent-created tools may use execution type 'command'.
# BLOCKED at TIER 3 regardless — only developer tools should use this.
# Recommendation: always false
allowCommandTools: false

# Function execution permission
# Whether agent-created tools may use execution type 'function'.
# BLOCKED at TIER 3 regardless — only developer tools should use this.
# Recommendation: always false
allowFunctionTools: false

# Protected namespaces
# Tool name prefixes reserved for built-in / developer tools.
# Agents cannot create tools with these prefixes.
# Default: ['matimo_']
protectedNamespaces:
  - matimo_
  # - internal_     # Uncomment to add your own
  # - company_prod_ # Can add as many as needed
```

**Notes:**
- All fields are **optional** — conservative defaults are used if omitted
- Empty arrays (`[]`) are different from `null`/omitted:
  - Omitted: Use default (e.g., GET/POST for methods)
  - Empty array: Allow nothing (most restrictive)
- **Case sensitivity:** HTTP methods should be uppercase (GET, POST, etc.)
- Comments (`#`) are allowed — standard YAML

### PolicyConfig Options (TypeScript)

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

  /**
   * Enable quarantine/HITL. When true, `canCreate()` quarantines agent-proposed tools
   * whose risk is listed in `quarantineRiskLevels`, and `canExecute()` quarantines every
   * tool whose execution risk is at or above `hitlMinRiskLevel`. Default: false.
   */
  enableHITL?: boolean;

  /**
   * Risk levels quarantined (instead of rejected) when an agent creates a tool. Its least
   * severe entry is also the execution threshold unless `hitlMinRiskLevel` is set.
   * Default: ['medium']
   */
  quarantineRiskLevels?: RiskLevel[];

  /** Execution-time quarantine threshold. Default: least severe entry of quarantineRiskLevels. */
  hitlMinRiskLevel?: RiskLevel;

  /** Seconds after which an approval expires and the tool must be re-approved. Default: never expires. */
  approvalTtlSeconds?: number;
}
```

### InitOptions (Full Configuration)

```typescript
const matimo = await MatimoInstance.init({
  // Tool discovery
  toolPaths: ['./tools', './agent-tools'],           // Explicit paths
  autoDiscover: true,                                // Auto-discover @matimo/* packages
  includeCore: true,                                 // Include built-in core tools

  /*────────────── POLICY (Choose ONE) ──────────────*/
  
  // Option 1: Load from policy.yaml (RECOMMENDED for production)
  policyFile: './policy.yaml',
  
  // Option 2: Inline policy config (development/simple cases)
  // policyConfig: {
  //   allowedDomains: ['api.example.com'],
  //   allowedHttpMethods: ['GET', 'POST'],
  //   allowCommandTools: false,
  //   allowFunctionTools: false,
  //   protectedNamespaces: ['matimo_'],
  //   enableHITL: true,                         // Enable quarantine flow
  //   quarantineRiskLevels: ['medium', 'high'],  // Risk levels eligible for quarantine
  // },
  
  // Option 3: Custom PolicyEngine (advanced)
  // policy: new MyCustomPolicyEngine(),
  
  /*──────────────────────────────────────────────*/

  untrustedPaths: ['./agent-tools'],        // Agent tools → validated against policy
  trustedPaths: ['./tools'],                // Developer tools → skip validation

  // Approval & Audit
  approvalSecret: process.env.MATIMO_APPROVAL_SECRET,  // HMAC secret for signatures
  approvalDir: './approvals',                         // Where to store approvals
  onEvent: (event) => {                               // Audit trail handler
    console.log(`[${event.type}]`, event);
  },

  // HITL Quarantine
  onHITL: async (request) => {                         // Human-in-the-loop callback
    console.log(`Quarantined: ${request.toolName} (${request.riskLevel})`);
    return await askHumanOperator(request);             // Return true to approve
  },

  // Logging
  logLevel: 'info',                // 'silent' | 'error' | 'warn' | 'info' | 'debug'
  logFormat: 'json',               // 'json' | 'simple'
});
```

**Policy Priority:**
1. If `policy` is provided → use it (highest priority)
2. Else if `policyFile` is provided → load and use it
3. Else if `policyConfig` is provided → use it
4. Else → use `DefaultPolicyEngine()` with conservative defaults

**Recommendation for Production:**
```bash
# Store policy.yaml in version control
git add policy.yaml

# Different policies per environment
policy-dev.yaml
policy-staging.yaml
policy-prod.yaml

# Load based on environment
policyFile: process.env.POLICY_FILE || './policy.yaml'
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

### How It Integrates with Policy

The content validator is the enforcement engine for your policy:

```
policy.yaml  ──┐
               │
               ▼
        PolicyConfig ──────────────────────┐
                                           │
                                           ▼
Agent proposes tool ──▶ ContentValidator ──▶ Check 9 rules
                       (uses config)         + policy settings
                                           │
                                           ▼
                            ✅ Pass / ❌ Blocked
```

The validator **automatically** uses your `allowedDomains`, `allowedHttpMethods`, `allowedCredentials`, and `protectedNamespaces` from the policy configuration.

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

> **This check also runs a second time, at execution.** The rule above only ever sees a tool's raw,
> unresolved URL — any `{placeholder}` tokens are blanked out before checking, since the real value
> isn't known yet at creation/approval time. A URL like `http://{host}/{path}` therefore passes this
> creation-time check unconditionally. To close that gap, `HttpExecutor`/`http_executor.py` re-run the
> same SSRF check against the **fully-resolved** URL immediately before the real HTTP request fires —
> so a call that resolves `{host}` to `169.254.169.254` at execution time is still blocked with a
> `POLICY_DENIED` error, even though the tool definition itself validated cleanly.

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

Note: Agent-created tools always have `requires_approval: true`, so every execution triggers an approval prompt (over MCP, an elicitation request to the client's user).

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

When tools are called via MCP there is no terminal to prompt, so the server asks
the human behind the MCP client with an [elicitation](https://modelcontextprotocol.io/specification/draft/client/elicitation)
request — a yes/no form the client shows its user:

```
MCP Client → tools/call { name: 'tool_name', arguments: { ... } }
                │
                ▼
          matimo.execute(..., { onApproval: <ask this session's user> })
                │  call needs approval? (requires_approval, DELETE/command,
                │  destructive keyword — see APPROVAL-SYSTEM.md)
                ▼ yes
          client supports elicitation?
          ├─ yes → elicitation/create "Allow the agent to run 'tool_name'? …"
          │        accept + approve → run   ·   anything else → rejected
          └─ no  → error: "needs human approval, but this MCP client does not
                   support elicitation" (with how to configure the server)
```

The model is never told how to approve its own call. `_matimo_approved` exists
only for clients that confirm every call with their user themselves: start the
server with `trustClientApproval: true` (`trust_client_approval=True` in
Python) and approval-requiring tools gain an optional `_matimo_approved`
boolean, which then counts as approval. Without that option the parameter is
not advertised and is ignored. Pre-approved tools
(`MATIMO_APPROVED_PATTERNS`) run without asking either way.

MCP calls run with no roles unless the operator grants some with the server's
`context` option (`MCPServerOptions.context` in both SDKs), e.g.
`{ agentId: 'claude-desktop', roles: ['admin'] }` for a single-user local
server. Role-gated tools such as `matimo_approve_tool` need it.

**Beyond policy gating**, each MCP tool registration also carries the protocol's standard `readOnlyHint`/`destructiveHint`/`idempotentHint`/`openWorldHint` annotations, derived directly from `execution.type`/HTTP method rather than from the aggregate risk tier above (the two signals can diverge — a GET and a DELETE tool can share a risk tier while having opposite hints). A denied or failed call returns `isError: true` with a `structuredContent` field (`code`/`statusCode`/`retryable`/`message`) instead of only a text string, and every successful result passes through the response-size guardrail before being returned. See [MCP Server docs — Tool Metadata & Error Responses](../MCP.md#tool-metadata--error-responses).

### MCP + Tool Lifecycle

The complete create→approve→reload→use lifecycle works via MCP. `curl` cannot
answer elicitation requests, so this walkthrough assumes a server started with
`trustClientApproval: true`, where `_matimo_approved: true` counts as the
approval. With an elicitation-capable client, leave the flag out and answer the
prompts instead.

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
| `matimo.reloadTools()` | `Promise<ReloadResult>` | Hot-reload tools from disk |
| `matimo.reloadSkills()` | `Promise<{ loaded: number; removed: number }>` | Hot-reload skills from configured `skillPaths` |
| `matimo.hasPolicy()` | `boolean` | Always `true` — `init()` always constructs a `DefaultPolicyEngine()` when no `policy`/`policyFile`/`policyConfig` is given, so every instance is policy-gated by default |
| `matimo.reloadPolicy(configOrFile?)` | `Promise<ReloadResult>` | Hot-reload policy engine + re-validate tools |
| `matimo.setHITLCallback(callback)` | `void` | Set or clear the HITL quarantine callback |

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
  loadPolicyFromFile,
  parsePolicyFile,

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
  type HITLCallback,
  type HITLRequest,
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

See [examples/tools/policy/README.md](../../typescript/examples/tools/policy/README.md) for detailed documentation.

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

---

## Python SDK — Policy & Lifecycle

The Python SDK exposes the same policy engine, risk classifier, and lifecycle controls as TypeScript. The API mirrors the TypeScript version with Pythonic naming (snake_case).

### Quick Start (Python)

```python
from matimo import Matimo, InitOptions

# Load policy from file
matimo = await Matimo.init('./tools', InitOptions(
    policy_file='./policy.yaml',
    untrusted_paths=['./agent-tools'],
))

# Inline policy config
from matimo.policy.types import PolicyConfig

matimo = await Matimo.init('./tools', InitOptions(
    policy_config=PolicyConfig(
        allowed_domains=['api.github.com', 'api.slack.com'],
        allowed_http_methods=['GET', 'POST'],
        allow_command_tools=False,
        allow_function_tools=False,
        protected_namespaces=['matimo_'],
    ),
))
```

### HITL (Human-in-the-Loop) Callback

```python
async def my_approval_callback(request):
    print(f"Approve {request.tool_name}? (y/n)")
    answer = input()
    return {'approved': answer == 'y', 'reason': 'manual review'}

matimo = await Matimo.init('./tools', InitOptions(
    policy_file='./policy.yaml',
    on_hitl=my_approval_callback,
))
```

### Policy Events (Python)

```python
def on_event(event) -> None:
    print(f"[{event.type}] {event.tool_name}")

matimo = await Matimo.init('./tools', InitOptions(
    policy_file='./policy.yaml',
    on_event=on_event,
))
```

### Risk Classification (Python)

```python
from matimo.policy.risk_classifier import classify_risk

tool = matimo.get_tool('my_api_tool')
risk = classify_risk(tool)
print(risk)  # 'low' | 'medium' | 'high' | 'critical'
```

### Custom PolicyEngine (Python)

```python
from matimo.policy.default_policy import PolicyEngine
from matimo.policy.types import PolicyDecision

class MyPolicy(PolicyEngine):
    def can_create(self, context, tool) -> PolicyDecision:
        return PolicyDecision(allowed=True)

    def can_execute(self, context, tool) -> PolicyDecision:
        if tool.name.startswith('delete_'):
            return PolicyDecision(allowed=False, reason='Delete ops require manual approval')
        return PolicyDecision(allowed=True)

    def filter_for_agent(self, tools, context):
        return [t for t in tools if t.status == 'approved']

matimo = await Matimo.init('./tools', InitOptions(policy=MyPolicy()))
```

### Tool Lifecycle (Python)

```python
# 1. Validate
result = await matimo.execute('matimo_validate_tool', {'yaml_content': yaml_str})

# 2. Create (triggers HITL if on_hitl is set)
result = await matimo.execute('matimo_create_tool', {
    'name': 'my_tool',
    'yaml_content': yaml_str,
    'target_dir': './agent-tools',
    'proposed_by': 'agent',
    'justification': 'User requested this capability',
})

# 3. Approve
result = await matimo.execute('matimo_approve_tool', {'name': 'my_tool', 'tool_dir': './agent-tools'})

# 4. Reload
result = await matimo.execute('matimo_reload_tools', {})

# 5. Use
result = await matimo.execute('my_tool', {'query': 'hello'})
```

> See [`python/examples/native/policy/policy_demo.py`](../../python/examples/native/policy/policy_demo.py) for a complete 11-mission Python policy demo.
> Run with: `cd python && make policy-demo`

---

## See Also

- [Meta-Tools Reference](META_TOOLS.md) — Built-in tool lifecycle management tools
- [Approval System](APPROVAL-SYSTEM.md) — Complete approval handler configuration
- [SDK Reference](SDK.md) — `Matimo.init()` InitOptions (Python) and `MatimoInstance.init()` (TypeScript)
