# Policy Engine & Tool Lifecycle Guide

> Complete developer and agent guide for Matimo's policy engine, tool creation, approval flow, hot-reload, and MCP integration.

## Table of Contents

- [When to Use the Policy Engine](#when-to-use-the-policy-engine)
  - [Decision Guide](#decision-guide)
  - [Use Cases by Policy Feature](#use-cases-by-policy-feature)
  - [Benefits: Policy vs No Policy](#benefits-policy-vs-no-policy)
- [Overview](#overview)
- [Quick Start](#quick-start)
  - [Option 1: Load Policy from YAML File (Recommended for Teams)](#option-1-load-policy-from-yaml-file-recommended-for-teams)
  - [Option 2: Inline Policy Config (Development)](#option-2-inline-policy-config-development)
  - [Option 3: Custom PolicyEngine (Advanced)](#option-3-custom-policyengine-advanced)
  - [Policy Loading & Initialization](#policy-loading--initialization)
- [Policy Configuration](#policy-configuration)
  - [PolicyConfig YAML File Format](#policyconfig-yaml-file-format)
  - [PolicyConfig Options (TypeScript)](#policyconfig-options-typescript)
  - [InitOptions (Full Configuration)](#initoptions-full-configuration)
  - [Execution Events](#execution-events)
  - [Audit Sink](#audit-sink)
  - [Immutability](#immutability)
- [Content Validator](#content-validator)
  - [How It Integrates with Policy](#how-it-integrates-with-policy)
  - [9 Security Rules](#9-security-rules)
  - [Violation Severities](#violation-severities)
  - [Using validateToolContent()](#using-validatetoolcontent)
- [Risk Classification](#risk-classification)
- [Tool Lifecycle](#tool-lifecycle)
  - [Step 1: Create a Tool](#step-1-create-a-tool)
  - [Step 2: Approve a Tool](#step-2-approve-a-tool)
  - [Step 3: Reload Tools](#step-3-reload-tools)
  - [Step 4: Use the Tool](#step-4-use-the-tool)
  - [Full Lifecycle Example](#full-lifecycle-example)
- [Approval System](#approval-system)
  - [How Approval Works](#how-approval-works)
  - [Interactive Terminal Approval](#interactive-terminal-approval)
  - [Tests and CI](#tests-and-ci)
  - [Pre-Approved Patterns](#pre-approved-patterns)
  - [Session Whitelisting](#session-whitelisting)
  - [MCP Approval Flow](#mcp-approval-flow)
- [HITL Quarantine](#hitl-quarantine)
  - [How Quarantine Works](#how-quarantine-works)
  - [Enabling HITL](#enabling-hitl)
  - [HITLCallback & HITLRequest](#hitlcallback--hitlrequest)
  - [Resolution Flow](#resolution-flow)
  - [Quarantine Events](#quarantine-events)
  - [Quarantine Risk Levels](#quarantine-risk-levels)
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
  - [Setup](#setup)
  - [Full Lifecycle from LangChain Agent](#full-lifecycle-from-langchain-agent)
- [API Reference](#api-reference)
  - [MatimoInstance](#matimoinstance)
  - [ReloadResult](#reloadresult)
  - [Policy Exports](#policy-exports)
- [Examples](#examples)
  - [Policy Demo (Full 11-Mission Autonomous Agent)](#policy-demo-full-11-mission-autonomous-agent)
  - [Minimal Policy Setup](#minimal-policy-setup)
  - [Interactive Approval with Whitelist](#interactive-approval-with-whitelist)
  - [MCP Server with Policy](#mcp-server-with-policy)
- [Python SDK — Policy & Lifecycle](#python-sdk--policy--lifecycle)
  - [Quick Start (Python)](#quick-start-python)
  - [Approval and HITL Callbacks](#approval-and-hitl-callbacks)
  - [Policy Events (Python)](#policy-events-python)
  - [Risk Classification (Python)](#risk-classification-python)
  - [Custom PolicyEngine (Python)](#custom-policyengine-python)
  - [Tool Lifecycle (Python)](#tool-lifecycle-python)
- [Upgrading to 0.2.0](#upgrading-to-020)
  - [Quick path](#quick-path)
  - [New default: DELETE and command tools ask before every call](#new-default-delete-and-command-tools-ask-before-every-call)
  - [Fixes that change behaviour (both modes)](#fixes-that-change-behaviour-both-modes)
  - [Events](#events)
  - [Tool authoring (validators)](#tool-authoring-validators)
  - [New, additive](#new-additive)
- [See Also](#see-also)

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

# Governance mode
# Default approval behaviour for tools whose YAML doesn't set requires_approval.
#   secure: HTTP DELETE and command tools ask before every call (default)
#   legacy: the pre-0.2.0 behaviour, where they don't ask
# See "Upgrading to 0.2.0" below.
governanceMode: secure
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

  /**
   * 'secure': HTTP DELETE and command tools without `requires_approval` ask before
   * every call. 'legacy': pre-0.2.0 defaults. InitOptions.governanceMode overrides it.
   * Default: 'secure'.
   */
  governanceMode?: 'secure' | 'legacy';
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
  auditSink: new JsonlFileSink('./logs/matimo-audit.jsonl'), // Hash-chained audit log

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

### Execution Events

Every call that passes the gates (policy, quarantine, approval) ends in exactly
one of two events. A call a gate refuses gets that gate's event instead
(`tool:execution_denied`, `tool:quarantine_rejected`, `tool:approval_denied`).

| Event | When | Fields |
|---|---|---|
| `tool:executed` | the tool returned | `toolName`, `agentId`?, `traceId`, `durationMs`, `success`, `riskLevel`, `timestamp` |
| `tool:execution_failed` | the tool threw | `toolName`, `agentId`?, `traceId`, `durationMs`, `riskLevel`, `errorCode`, `error`, `timestamp` |

- `success` is `false` when the tool returned `{ success: false }` rather than throwing.
- `durationMs` is time in the tool itself; approval waits are not counted.
- `riskLevel` is the execution risk (`classifyExecutionRisk`).
- The Python SDK emits the same events as dicts with snake_case keys
  (`tool_name`, `trace_id`, `duration_ms`, ...). Both SDKs are tested against
  [`conformance/events/execution-events.json`](../../conformance/events/execution-events.json).

### Audit Sink

`onEvent` hands events to your code. To keep a durable record of the same
events, pass an `AuditSink`. It runs alongside `onEvent`, and a sink that
throws is logged but never fails the tool call.

```typescript
import { MatimoInstance, JsonlFileSink, verifyAuditLog } from '@matimo/core';

const matimo = await MatimoInstance.init({
  autoDiscover: true,
  auditSink: new JsonlFileSink('./logs/matimo-audit.jsonl'),
});

verifyAuditLog('./logs/matimo-audit.jsonl'); // { valid: true, entries: 42 }
```

```python
from matimo import Matimo, JsonlFileSink, verify_audit_log

matimo = await Matimo.init(auto_discover=True, audit_sink=JsonlFileSink("./logs/matimo-audit.jsonl"))
verify_audit_log("./logs/matimo-audit.jsonl")  # AuditLogVerification(valid=True, entries=42)
```

`JsonlFileSink` writes one line per event:

```json
{"event":{...},"hash":"<sha256>","prevHash":"<previous line's hash>","seq":7}
```

- `hash` is `sha256(prevHash + canonicalJson({seq, event}))`. Canonical JSON sorts
  keys at every level and has no whitespace. The first line's `prevHash` is 64 zeros.
- Editing, deleting or reordering a line makes `verifyAuditLog` / `verify_audit_log`
  report the first bad line. Anyone who can write the file can also rewrite the
  whole chain, so ship the file (or its latest hash) somewhere append-only if you
  need tamper evidence against the host itself.
- Opening an existing log continues its chain from the last line.
- Values under secret-named keys (`password`, `token`, `apiKey`, `authorization`,
  `client_secret`, `cookie`, ...) are written as `[REDACTED]`.
- A log written by either SDK verifies in the other. Both are tested against
  [`conformance/audit/hash-chain.json`](../../conformance/audit/hash-chain.json).
- One `JsonlFileSink` per file per process. Two processes appending to the same
  file will fork the chain.

For another destination (a database, a SIEM, a queue), implement
`write(event)`. It may return a promise in TypeScript.

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
const result = await matimo.execute(
  'matimo_approve_tool',
  { name: 'city_lookup', tool_dir: './agent-tools' },
  { context: { agentId: 'reviewer', roles: ['admin'] } } // approving needs the admin role
);

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
import { MatimoInstance, setGlobalMatimoInstance } from 'matimo';
import type { PolicyConfig } from 'matimo';

// 1. Configure
const policyConfig: PolicyConfig = {
  allowedDomains: ['jsonplaceholder.typicode.com'],
  allowedHttpMethods: ['GET'],
  allowCommandTools: false,
  allowFunctionTools: false,
};

// 2. Give the instance a reviewer: creating, approving, reloading and
//    calling the new tool all need approval.
const matimo = await MatimoInstance.init({
  toolPaths: ['./core-tools', './agent-tools'],
  untrustedPaths: ['./agent-tools'],
  policyConfig,
  onApproval: async (request) => {
    console.log(`Approve ${request.toolName}? [y/n]`);
    return true; // or prompt user
  },
});
setGlobalMatimoInstance(matimo); // meta-tools act on this instance

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
await matimo.execute(
  'matimo_approve_tool',
  { name: 'city_lookup', tool_dir: './agent-tools' },
  { context: { agentId: 'reviewer', roles: ['admin'] } } // approving needs the admin role
);

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
   needs approval?
   • requires_approval: true in the YAML
   • HTTP DELETE or command tool without requires_approval (secure mode)
   • destructive keyword in the sql / command argument
         │ yes
         ▼
   pre-approved?  (MATIMO_APPROVED_PATTERNS, or MATIMO_AUTO_APPROVE;
                   never for matimo_approve_tool)        → yes → execute
         │ no
         ▼
   ask, first one that is set:
   1. execute(..., { onApproval })      per call
   2. init({ onApproval })              per instance
   3. getGlobalApprovalHandler()        process-wide (older code)
   4. none                              → rejected
         │
    ┌────┴────┐
    │approved │rejected
    ▼         ▼
  Execute   Throw MatimoError
```

Full reference: [Approval System](APPROVAL-SYSTEM.md).

### Interactive Terminal Approval

```typescript
import { MatimoInstance, type ApprovalRequest } from 'matimo';
import readline from 'readline';

async function askInTerminal(request: ApprovalRequest): Promise<boolean> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  console.log(`\nTool: ${request.toolName}`);
  console.log(`Description: ${request.description}`);
  console.log(`Params: ${JSON.stringify(request.params)}`);
  const answer = await new Promise<string>((resolve) => rl.question('Approve? (y/n): ', resolve));
  rl.close();
  return answer.toLowerCase() === 'y';
}

const matimo = await MatimoInstance.init({ autoDiscover: true, onApproval: askInTerminal });
```

### Tests and CI

Prefer an `onApproval` that encodes what the test allows, or `MATIMO_APPROVED_PATTERNS` listing the tools it may run. `MATIMO_AUTO_APPROVE=true` approves everything unseen (except `matimo_approve_tool`) and logs a warning; keep it to throwaway environments.

### Pre-Approved Patterns

```bash
# Approve specific tools or patterns
export MATIMO_APPROVED_PATTERNS="calculator,weather_*,search"

# Supports wildcards:
#   calculator      → exact match
#   weather_*       → matches weather_get, weather_forecast, etc.
#   *               → matches everything except matimo_approve_tool
```

### Session Whitelisting

In interactive mode, approved tools can be added to a session whitelist so subsequent calls skip the prompt:

```typescript
const whitelist = new Set<string>();

const matimo = await MatimoInstance.init({
  autoDiscover: true,
  onApproval: async (request) => {
    // Skip prompt if already approved this session
    if (whitelist.has(request.toolName)) {
      return true;
    }
    const approved = await promptUser(request);
    if (approved) {
      whitelist.add(request.toolName);
    }
    return approved;
  },
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
server. Role-gated tools refuse a context without their role — e.g.
`matimo_approve_tool` requires `admin` whenever a context is supplied.

**Beyond policy gating**, each MCP tool registration also carries the protocol's standard `readOnlyHint`/`destructiveHint`/`idempotentHint`/`openWorldHint` annotations, derived directly from `execution.type`/HTTP method rather than from the aggregate risk tier above (the two signals can diverge — a GET and a DELETE tool can share a risk tier while having opposite hints). A denied or failed call returns `isError: true` with a `structuredContent` field (`code`/`statusCode`/`retryable`/`message`) instead of only a text string, and every successful result passes through the response-size guardrail before being returned. See [MCP Server docs — Tool Metadata & Error Responses](../MCP.md#tool-metadata--error-responses).

## HITL Quarantine

Traditional policy engines are binary — a tool is either allowed or blocked. HITL (human-in-the-loop) quarantine adds a third state, **pending_approval**: with `enableHITL` on, a call at or above `hitlMinRiskLevel` pauses until a person approves it.

HITL quarantine is separate from per-call approval (`onApproval`, see [APPROVAL-SYSTEM.md](APPROVAL-SYSTEM.md)). Quarantine is decided by the policy engine from the tool's risk; approval by the tool's `requires_approval`, DELETE/command type, or destructive keywords. When both apply, quarantine is resolved first.

### How Quarantine Works

```
matimo.execute('tool_name', params)
         │
         ▼
   policy.canExecute(context, tool)
         │
    ┌────┼────────────────────┐
    │    │                    │
  allowed  pending_approval  false
    │         │               │
    ▼         ▼               ▼
  Execute  approval manifest  Throw POLICY_DENIED
           or onHITL callback
              │
         ┌────┼────┐
         │         │
     Approved   Rejected / no callback
         │         │
         ▼         ▼
      Execute   Throw POLICY_DENIED
                (tool:quarantine_rejected)
```

### Enabling HITL

Pass `enableHITL: true` in your policy config and provide an `onHITL` callback:

```typescript
import { MatimoInstance } from '@matimo/core';
import type { HITLRequest } from '@matimo/core';

const matimo = await MatimoInstance.init({
  toolPaths: ['./tools', './agent-tools'],
  untrustedPaths: ['./agent-tools'],
  policyConfig: {
    allowedDomains: ['api.example.com'],
    enableHITL: true,
    hitlMinRiskLevel: 'medium', // pause every POST/PUT/PATCH, DELETE and other high-risk call
  },
  onHITL: async (request: HITLRequest) => {
    console.log(`Tool: ${request.toolName}`);
    console.log(`Risk: ${request.riskLevel}`);
    console.log(`Reason: ${request.reason}`);
    // Wire this to Slack, email, a UI, or a terminal prompt
    return await askHumanOperator(request);
  },
});
```

```python
matimo = await Matimo.init(
    "./tools",
    untrusted_paths=["./agent-tools"],
    policy_config=PolicyConfig(enable_hitl=True, hitl_min_risk_level="medium"),
    on_hitl=ask_human_operator,
)
```

### HITLCallback & HITLRequest

```typescript
/** Called when a call is quarantined. Return true to approve, false to reject. */
type HITLCallback = (request: HITLRequest) => Promise<boolean>;

interface HITLRequest {
  toolName: string;
  riskLevel: RiskLevel;       // 'low' | 'medium' | 'high' | 'critical'
  reason: string;             // Why the call was quarantined
  environment?: string;       // From the caller's PolicyContext
  agentId?: string;           // Calling agent identifier
  toolDefinition?: unknown;   // Full tool definition for admin review
}
```

### Resolution Flow

When a call is `pending_approval`, Matimo resolves it in order:

1. **Check the approval manifest** — if this tool definition was approved before and its YAML hash hasn't changed, the call runs
2. **Invoke the HITL callback** — call `onHITL(request)` and wait for the answer
3. **Fail closed** — with no callback, the call is rejected

An approval is recorded in the signed approval manifest against the definition's hash, so the reviewer is asked once per tool definition, and again if the YAML changes.

### Quarantine Events

| Event Type | When Emitted |
|-----------|-------------|
| `tool:quarantined` | A quarantined call is about to be sent to `onHITL`, or an untrusted tool is held as pending when it loads |
| `tool:quarantine_approved` | A quarantined call was approved (manifest or callback) |
| `tool:quarantine_rejected` | A quarantined call was refused, or nobody could approve it |

```typescript
const matimo = await MatimoInstance.init({
  // ...
  onEvent: (event) => {
    if (event.type === 'tool:quarantine_approved') {
      console.log(`✅ ${event.toolName} approved`);
    }
    if (event.type === 'tool:quarantine_rejected') {
      console.log(`❌ ${event.toolName} rejected`);
    }
  },
});
```

### Quarantine Risk Levels

The two settings act at different times.

**When a call runs**, `canExecute()` quarantines it when its **execution risk** is at or above `hitlMinRiskLevel` (default: the least severe entry of `quarantineRiskLevels`, so `'medium'` out of the box). A policy that reviews POSTs therefore also reviews DELETEs.

Execution risk is `classifyRisk()` with one difference: a `type: function` tool uses its declared `risk:` (default `high`, raised to `high` by `requires_approval: true`) instead of always rating `critical`. Function tools in the registry are always developer-authored — agent-created function tools are rejected at creation — so `calculator` (`risk: low`) is not quarantined while `execute` (`risk: critical`) is.

| Tool | Execution risk | `enableHITL: true` (defaults) |
|------|----------------|-------------------------------|
| HTTP GET | low | runs |
| HTTP POST / PUT / PATCH | medium | quarantined |
| HTTP DELETE, `requires_approval: true`, `type: command` | high | quarantined |
| `type: function` with `risk: low` | low | runs |
| `type: function` with no `risk:` | high | quarantined |

The full matrix both SDKs are tested against is `conformance/policy/execution-quarantine.json`.

**When an untrusted tool loads** (`untrustedPaths`, or a reload after `matimo_create_tool`), `canCreate()` uses `quarantineRiskLevels` as a list: a tool whose most severe content violation, or (in production) whose risk, is *listed* is held as pending instead of rejected. Agent-created tools carry `requires_approval: true`, which `classifyRisk()` rates `high`, so with the default `['medium']` they are rejected in production rather than held. Use `quarantineRiskLevels: ['medium', 'high']` if you want them held for review there.

You can change the HITL callback at runtime (TypeScript):

```typescript
matimo.setHITLCallback(async (request) => request.riskLevel === 'medium');
matimo.setHITLCallback(null); // back to fail-closed
```

Python sets `on_hitl` at `init()` only.

---

## Policy Hot-Reload

TypeScript can swap the policy at runtime without restarting the process; all tools are re-validated against the new policy. (Python has no `reload_policy()` yet; create a new `Matimo` instance.)

### reloadPolicy()

```typescript
// Option 1: Reload from a new YAML file
await matimo.reloadPolicy('./policy-prod.yaml');

// Option 2: Reload with an inline PolicyConfig
await matimo.reloadPolicy({
  allowedDomains: ['api.production.example.com'],
  enableHITL: true,
  hitlMinRiskLevel: 'medium',
});

// Option 3: Re-read the original policyFile (if MatimoInstance was initialized with one)
await matimo.reloadPolicy();
```

**What happens internally:**

1. The new policy is validated (Zod schema for YAML files)
2. The old policy is replaced and the new one frozen
3. A `policy:reloaded` event is emitted
4. `reloadTools()` runs, re-validating every tool against the new policy
5. Tools that no longer pass are left out of the registry

**Return value:** the `ReloadResult` of that re-validation:

```typescript
const result = await matimo.reloadPolicy('./policy-strict.yaml');
console.log(result.loaded);     // Tools registered
console.log(result.rejected);   // Tools the new policy rejected
```

### parsePolicyFile()

Parse a YAML policy file without applying it — useful for validation:

```typescript
import { parsePolicyFile } from '@matimo/core';

const config = parsePolicyFile('./policy.yaml');
// Returns a validated PolicyConfig; throws if the YAML or schema is invalid
```

### Hot-Reload Events

```typescript
const matimo = await MatimoInstance.init({
  onEvent: (event) => {
    if (event.type === 'policy:reloaded') {
      console.log('Policy reloaded at', event.timestamp);
    }
  },
});
```

**Use case: reload when the file changes:**

```typescript
import fs from 'fs';

fs.watch('./policy.yaml', async () => {
  try {
    const result = await matimo.reloadPolicy('./policy.yaml');
    console.log(`Policy reloaded: ${result.loaded} tools, ${result.rejected.length} rejected`);
  } catch (err) {
    console.error('Policy reload failed — keeping previous policy:', (err as Error).message);
  }
});
```

---

## Integrity & Tamper Detection

### SHA-256 Integrity Tracking

`ToolIntegrityTracker` hashes tool definitions so a reload can tell new, unchanged and modified tools apart:

```typescript
import { ToolIntegrityTracker } from '@matimo/core';

const tracker = new ToolIntegrityTracker();

// After a tool is validated and loaded
tracker.record('my_tool', yamlContent, 'untrusted');

// On the next load
const { action, reason } = tracker.onToolLoaded('my_tool', yamlContent, 'untrusted');
```

| `action` | `reason` | Meaning |
|----------|----------|---------|
| `validate` | `new-tool` | Never seen before; validate it |
| `keep` | `unchanged` | Same hash and source; safe to skip |
| `revalidate` | `content-modified` / `source-changed` | The YAML changed, or it moved between trusted and untrusted paths |

### HMAC Approval Manifest

`ApprovalManifest` stores signed approvals in `<approvalDir>/.matimo-approvals.json`:

```typescript
import { ApprovalManifest } from '@matimo/core';

const manifest = new ApprovalManifest('./', process.env.MATIMO_APPROVAL_SECRET);

const hash = manifest.computeHash(yamlContent);
manifest.approve('my_tool', hash, 'alice');

manifest.isApproved('my_tool', hash);                          // true
manifest.isApproved('my_tool', manifest.computeHash(edited));  // false — the YAML changed
```

Inside an app, use the instance's own manifest (`matimo.getApprovalManifest()`, `get_approval_manifest()` in Python) so approvals are signed with the instance's secret and directory.

**Approval secret:**

```bash
# A persistent secret for HMAC signing
export MATIMO_APPROVAL_SECRET=your-secret-key

# If unset, each process generates its own, so approvals do not survive a restart
```

Never commit `.matimo-approvals.json`.

---

## RBAC & Access Control

`DefaultPolicyEngine.canExecute()` applies these gates by the caller's `PolicyContext` (pinned for both SDKs by `conformance/policy/execution-gates.json`):

| Tool | Denied when |
|------|-------------|
| `status: deprecated` | Always |
| `status: draft` | In production (an environment name containing "prod"), and elsewhere when the caller lacks the `admin` role |
| `requires_approval: true` | In production, when the caller has neither `admin` nor `operator` |

Other tools pass these gates; quarantine and per-call approval may still apply. `roles` is an array, and any listed role counts.

```typescript
import { DefaultPolicyEngine } from '@matimo/core';

const policy = new DefaultPolicyEngine(policyConfig);

const decision = policy.canExecute(
  { roles: ['reader'], environment: 'staging' }, // PolicyContext
  draftTool
);

console.log(decision.allowed); // false
console.log(decision.reason);  // 'Draft tool "my_tool" requires admin role'
```

The context reaches the engine through `execute(name, params, { context })` (`context=` in Python) and the MCP server's `context` option. Framework adapters such as `convertToolsToLangChain` pass none.

**PolicyContext:**

```typescript
interface PolicyContext {
  agentId?: string;                    // Identifier for the calling agent
  environment?: string;                // e.g. 'dev' | 'staging' | 'production'
  roles?: string[];                    // e.g. ['reader', 'operator', 'admin']
  metadata?: Record<string, unknown>;  // Custom metadata for policy rules
}
```

---

## Audit Events

Every policy decision and every run emits a structured event to `onEvent` and to the `auditSink`. The execution events are described in [Execution Events](#execution-events); the full list with fields is in [TYPES.md](TYPES.md). `tool:created`, `tool:approved` and `tool:revoked` are declared in the type but not emitted yet.

---

## MCP Integration

### MCP + Policy Engine

When tools are served over MCP, the same policy engine applies:

```typescript
import { MCPServer } from '@matimo/core';

const mcpServer = new MCPServer({
  transport: 'http',
  port: 3000,
  toolPaths: ['./core-tools', './agent-tools'],
  untrustedPaths: ['./agent-tools'],
  policyConfig: {
    allowedDomains: ['api.example.com'],
  },
  mcpToken: 'your-bearer-token',
});

await mcpServer.start();
// Untrusted tools validated on startup; policy enforced on every tools/call
```

**MCP execution flow:**

```
MCP Client → POST /mcp (tools/call)
  │
  ▼ MCPServer handler
  │
  ▼ matimo.execute(toolName, params, { onApproval: <elicitation for this session> })
  │
  ├─ Policy check (canExecute): gates, HITL quarantine
  ├─ Approval, if the call needs it: elicitation prompt to the client's user
  │    (_matimo_approved counts only with trustClientApproval)
  ├─ Credential injection
  ├─ Executor routing
  │
  ▼ Result → MCP response
```

Each MCP tool registration also carries the protocol's standard `readOnlyHint`/`destructiveHint`/`idempotentHint`/`openWorldHint` annotations, derived from `execution.type` and the HTTP method rather than from the risk tier (the two can diverge). A denied or failed call returns `isError: true` with a `structuredContent` field (`code`/`statusCode`/`retryable`/`message`), and every successful result passes through the response-size guardrail. See [MCP Server docs — Tool Metadata & Error Responses](../MCP.md#tool-metadata--error-responses).

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
import { MatimoInstance, convertToolsToLangChain, setGlobalMatimoInstance } from 'matimo';
import { ChatOpenAI } from '@langchain/openai';
import type { ToolDefinition, PolicyConfig } from 'matimo';

const matimo = await MatimoInstance.init({
  toolPaths: ['./tools', './agent-tools'],
  untrustedPaths: ['./agent-tools'],
  policyConfig: { /* ... */ },
  // Human-in-the-loop approval for every call that needs it
  onApproval: async (request) => {
    console.log(`Agent wants to call: ${request.toolName}`);
    return true; // or prompt user
  },
});
setGlobalMatimoInstance(matimo); // meta-tools act on this instance

// Convert Matimo tools to LangChain format
const tools = matimo.listTools();
const langchainTools = await convertToolsToLangChain(tools as ToolDefinition[], matimo);

// Create LLM with tools bound
const llm = new ChatOpenAI({ model: 'gpt-4o-mini', temperature: 0 });
let llmWithTools = llm.bindTools(langchainTools);
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

// 2. A reviewer approves it (the agent cannot approve its own tool)
await matimo.execute(
  'matimo_approve_tool',
  { name: 'city_lookup', tool_dir: './agent-tools' },
  { context: { agentId: 'reviewer', roles: ['admin'] } } // approving needs the admin role
);

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
| `matimo.setApprovalCallback(callback)` | `void` | Set or clear the instance's approval callback (`null` falls back to the process-wide handler) |
| `matimo.getGovernanceMode()` | `'secure' \| 'legacy'` | The governance mode in effect |
| `matimo.getApprovalManifest()` | `ApprovalManifest \| null` | The manifest `matimo_approve_tool` records approvals in |

### ReloadResult

```typescript
interface ReloadResult {
  loaded: number;       // Tools registered by this reload
  removed: number;      // Tools no longer loaded
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

const matimo = await MatimoInstance.init({
  toolPaths: ['./tools'],
  onApproval: async (req) => {
    if (whitelist.has(req.toolName)) return true;
    const approved = await askUser(`Approve ${req.toolName}?`);
    if (approved) whitelist.add(req.toolName);
    return approved;
  },
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
from matimo import Matimo, PolicyConfig

# Load policy from file
matimo = await Matimo.init(
    ['./tools', './agent-tools'],
    policy_file='./policy.yaml',
    untrusted_paths=['./agent-tools'],
)

# Inline policy config
matimo = await Matimo.init(
    './tools',
    policy_config=PolicyConfig(
        allowed_domains=['api.github.com', 'api.slack.com'],
        allowed_http_methods=['GET', 'POST'],
        allow_command_tools=False,
        allow_function_tools=False,
        protected_namespaces=['matimo_'],
    ),
)
```

`Matimo.init()` takes keyword arguments after the tool paths.

### Approval and HITL Callbacks

```python
from matimo import ApprovalRequest, HITLRequest, Matimo, PolicyConfig


# Per-call approval (requires_approval, DELETE/command tools, destructive keywords)
async def on_approval(request: ApprovalRequest) -> bool:
    return input(f"Approve {request.tool_name} {request.params}? (y/n) ") == 'y'


# Risk-based quarantine (enable_hitl): every call at or above hitl_min_risk_level
async def on_hitl(request: HITLRequest) -> bool:
    return input(f"Run {request.tool_name} ({request.risk_level})? (y/n) ") == 'y'


matimo = await Matimo.init(
    './tools',
    policy_config=PolicyConfig(enable_hitl=True, hitl_min_risk_level='high'),
    on_approval=on_approval,
    on_hitl=on_hitl,
)
```

Both callbacks return `True` to allow the call and `False` to refuse it.

### Policy Events (Python)

```python
def on_event(event: dict) -> None:
    print(f"[{event['type']}] {event.get('tool_name')}")

matimo = await Matimo.init('./tools', policy_file='./policy.yaml', on_event=on_event)
```

Events are dicts with snake_case keys; see [Execution Events](#execution-events)
for `tool:executed` / `tool:execution_failed`.

### Risk Classification (Python)

```python
from matimo import classify_execution_risk, classify_risk

tool = matimo.get_tool('my_api_tool')
print(classify_risk(tool).value)            # risk as an untrusted proposal
print(classify_execution_risk(tool).value)  # risk of running it: 'low' | 'medium' | 'high' | 'critical'
```

### Custom PolicyEngine (Python)

```python
from matimo import Matimo, PolicyAllowed, PolicyDecision, PolicyDenied


class MyPolicy:
    """Any object with these three methods satisfies the PolicyEngine protocol."""

    def can_create(self, context, tool_def) -> PolicyDecision:
        return PolicyAllowed()

    def can_execute(self, context, tool) -> PolicyDecision:
        if tool.name.startswith('delete_'):
            return PolicyDenied(reason='Delete operations are not allowed for agents')
        return PolicyAllowed()

    def filter_for_agent(self, context, tools):
        return [t for t in tools if not t.name.startswith('delete_')]


matimo = await Matimo.init('./tools', policy=MyPolicy())
```

Return `PolicyPendingApproval(reason=..., risk_level=...)` from `can_execute` to quarantine a call for `on_hitl`.

### Tool Lifecycle (Python)

```python
# 1. Validate
result = await matimo.execute('matimo_validate_tool', {'yaml_content': yaml_str})

# 2. Create (asks on_approval: matimo_create_tool requires approval)
result = await matimo.execute('matimo_create_tool', {
    'name': 'my_tool',
    'yaml_content': yaml_str,
    'target_dir': './agent-tools',
    'proposed_by': 'agent',
    'justification': 'User requested this capability',
})

# 3. Approve
result = await matimo.execute('matimo_approve_tool', {'name': 'my_tool', 'tool_dir': './agent-tools'},
                              context=PolicyContext(agent_id='reviewer', roles=['admin']))

# 4. Reload
result = await matimo.execute('matimo_reload_tools', {})

# 5. Use
result = await matimo.execute('my_tool', {'query': 'hello'})
```

> See [`python/examples/native/policy/policy_demo.py`](../../python/examples/native/policy/policy_demo.py) for a complete 11-mission Python policy demo.
> Run with: `cd python && make policy-demo`

## Upgrading to 0.2.0

0.2.0 (TypeScript and Python) makes the governance described in this guide the default. Most
of the changes fix places where a tool call wasn't governed the way these docs said. Those
fixes apply to everyone. One new default, approval for DELETE and shell tools, can be switched
off with `governanceMode: 'legacy'`.

### Quick path

1. Upgrade, then run your test suite or agent once.
2. If a DELETE or command tool now fails with `requires approval`, decide per tool:
   - Wire a reviewer: `onApproval` / `on_approval` at init (see [Approval System](#approval-system)).
   - Pre-approve it: `MATIMO_APPROVED_PATTERNS=my_delete_tool`.
   - Opt the tool out in its YAML: `requires_approval: false`.
   - Or restore the old default everywhere: `governanceMode: 'legacy'` in `InitOptions` or
     `policy.yaml` (`governance_mode="legacy"` in Python).
3. If you run `validate-tools` on your own tools, add `requires_approval` to each DELETE tool and
   `risk` to each function tool (see below).

### New default: DELETE and command tools ask before every call

A tool whose YAML doesn't set `requires_approval` now needs per-call approval when it is an HTTP
`DELETE` or a `type: command` tool. An explicit `requires_approval` always wins. The destructive
keyword scan of `command` / `sql` parameters is unchanged. `governanceMode: 'legacy'` restores
the old default, and nothing else. Both SDKs assert the same table,
[`conformance/approval/definition-requires-approval.json`](../../conformance/approval/definition-requires-approval.json).

### Fixes that change behaviour (both modes)

| Area | Before 0.2.0 | 0.2.0 |
|---|---|---|
| HITL quarantine at execution | Quarantined a tool only when its risk was *listed* in `quarantineRiskLevels`, so with the default `['medium']` a high-risk DELETE ran unquarantined | Quarantines every tool whose risk is **at or above** `hitlMinRiskLevel` (default: least severe entry of `quarantineRiskLevels`) |
| Function tool risk at execution | Always `critical` | The tool's declared `risk:`, or `high` if it declares none. `requires_approval: true` raises it to at least `high` |
| HITL approvals for tools loaded at init | TypeScript wrote the approval but never read it back. Python never used the manifest. Either way the reviewer was asked again on every call | Read from and recorded in the signed approval manifest, in both SDKs |
| Python `requires_approval` | Ignored; only HITL quarantine ran | Enforced per call, as in TypeScript |
| Python `execute(..., approved=True)` | Skipped policy denials too | Skips only the approval prompt; policy denials still apply |
| Approval callback scope | One process-wide callback | Per call (`execute(..., { onApproval })`), then per instance (`InitOptions.onApproval`), then the global handler. With none, the call fails closed |
| MCP approval | The error told the model to retry with `_matimo_approved: true`, and the server trusted it | The server asks the human through MCP elicitation. `_matimo_approved` is offered and honoured only with `trustClientApproval` / `trust_client_approval` |
| MCP HTTP bearer check | String comparison | Constant-time comparison |
| `matimo_approve_tool` | Any caller could approve any tool, including one it had just created; `MATIMO_AUTO_APPROVE` and patterns applied | Refuses when the caller's `agentId` created the tool. Requires the `admin` role when a policy context is supplied. Never pre-approved |
| `MATIMO_AUTO_APPROVE=true` | Silent, and recommended in the approval error hint | Logs a warning at init. The hint recommends `onApproval` or `MATIMO_APPROVED_PATTERNS` |
| `matimo_approve_tool` + reload | Without `MATIMO_APPROVAL_SECRET` (or with a different `approvalDir`) the tool signed with its own key, so the next reload rejected the tool it had just approved | Approvals are recorded with the owning instance and survive the reload |
| `matimo_create_tool` / `matimo_get_tool_status` | Called a low-risk draft "auto-approved … ready for use" | Report `pending` until a human approves the draft |
| `matimo_validate_tool` | TypeScript flagged the `requires_approval`/`status` fields creation sets itself; Python said `valid: true` despite critical violations | `valid` is true exactly when `matimo_create_tool` would accept the definition |
| Python draft tools | Ran for anyone outside production, and for admins in production | Never in production; elsewhere only for the `admin` role, as in TypeScript |
| Python untrusted tools | High-severity violations (disallowed domain, method or credential) rejected only in production; a tool with no `status` was always rejected | Critical and high violations reject in every environment; an unset `status` is accepted, as in TypeScript |
| Python `no-ssrf` | Missed `*.internal`, `*.local`, `*.localhost` and `0.0.0.0` | Blocks them, as in TypeScript |
| Python `ReloadResult` | `loaded` counted new names; `revalidated` counted replaced tools | `loaded` counts every registered tool; `revalidated` the untrusted tools re-checked, as in TypeScript |
| Python LangChain tools | A failed call raised; LangGraph re-raises it, so a refused approval ended the agent run | The tool returns `"Error: <message>"` to the model, as in TypeScript |
| Python credential lookup | Read `MATIMO_<TOOL_NAME>_<NAME>` and `<NAME>`, not the documented `MATIMO_<NAME>` | Reads `MATIMO_<NAME>` first (also from `credentials`); the older names still work |

### Events

- TypeScript now emits `tool:executed` (it never did before) and the new `tool:execution_failed`.
- Python renamed `duration` (seconds) to `duration_ms` (milliseconds). `trace_id` is a full UUID,
  no longer 8 characters. Python also emits the new `tool:execution_failed`.
- The fields are the same in both SDKs; see [Execution Events](#execution-events).

### Tool authoring (validators)

`pnpm validate-tools` and `make validate-tools` now reject:

- An HTTP `DELETE` tool without an explicit `requires_approval` (set `true`, or `false` to opt out).
- A `type: function` tool without a `risk:` level.

### New, additive

- `auditSink` / `audit_sink` with `JsonlFileSink`, a hash-chained audit log ([Audit Sink](#audit-sink)).
- `governanceMode` / `governance_mode` and `getGovernanceMode()` / `get_governance_mode()`.
- `hitlMinRiskLevel` / `hitl_min_risk_level` in `PolicyConfig` and `policy.yaml`.
- Function tools receive the caller's policy context: `(params, { credentials, policyContext })`
  in TypeScript, `run(params, context)` in Python.
- The MCP server's `context` option sets the policy context for every MCP call.

---

## See Also

- [Meta-Tools Reference](META_TOOLS.md) — Built-in tool lifecycle management tools
- [Approval System](APPROVAL-SYSTEM.md) — Complete approval handler configuration
- [SDK Reference](SDK.md) — `Matimo.init()` InitOptions (Python) and `MatimoInstance.init()` (TypeScript)
