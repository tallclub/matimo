# Matimo Policy Engine — LangChain Agent Demo

A **real LangChain ReAct agent** (gpt-4o-mini) that **autonomously discovers** the Matimo tool lifecycle. The agent receives high-level goals — never tool names — and must figure out which tools to call by examining tool descriptions.

> **This is not a scripted demo.** The agent is given goals like "I need a city lookup tool" and must independently discover the create → approve → reload lifecycle. No mission tells the agent which tool to call.

## What It Proves

| Mission | Agent's Goal (No Tool Names) | Expected Outcome |
|---------|------------------------------|-----------------|
| 1 | "What is 42 + 58?" | ✅ Discovers and uses calculator |
| 2 | "Is this tool definition safe?" | ✅ Discovers `matimo_validate_tool`, passes |
| 3 | "Review this for security" | ⊘ Discovers validation, finds shell command **blocked** |
| 4 | "Any security concerns?" | ⊘ Discovers validation, finds SSRF **blocked** |
| 5 | "Is this compliant?" | ⊘ Discovers validation, finds namespace **blocked** |
| 6 | "I need a city lookup tool" | ✅ **AUTONOMOUSLY**: create → approve → reload |
| 7 | "Look up user 1" | ✅ Uses agent-created `city_lookup` — returns real data |
| 8 | "I need a file reader" | ⊘ **Blocked** — human rejects malicious tool |
| 9 | "What tools were created?" | ✅ Discovers `matimo_list_user_tools` |
| 10 | "Refresh the registry" | ✅ Discovers `matimo_reload_tools` |
| 11 | MCP server verification | ✅ All tools (incl. agent-created) via MCP |

After the agent finishes, **Phase 3** runs programmatic checks that can't be done through tool calls:

- **SHA-256 integrity tracking** — detects YAML tampering between reloads
- **HMAC approval lifecycle** — approve → verify → auto-revoke on modification
- **Risk classification** — deterministic, per execution type (low/medium/high/critical)
- **Policy access control** — draft/deprecated/prod restrictions with RBAC
- **Audit event trail** — every policy decision emits a structured event

## ✅ What Gets Validated

### Policy Engine Validation
- ✓ Safe tool validation passes
- ✓ Shell commands blocked
- ✓ SSRF attacks blocked
- ✓ Namespace hijacking blocked
- ✓ Human approval workflow
- ✓ Risk classification
- ✓ Policy enforcement on creation
- ✓ Deterministic risk assessment

### Expected Outcomes

**Success Pattern**
```
🔧 Agent calls: matimo_doctor(...)
📋 Result: Valid: safe domain, HTTP GET allowed
✓ PASS  Tool creation on disk
✅ Approved by human operator.
```

**Policy Block Pattern**
```
🔧 Agent calls: matimo_doctor(...)
❌ Command tools are blocked by policy
💬 Agent: I understand. I'll try a different approach.
```

**Human Rejection Pattern**
```
❓ Approve? (y/n): n
✗ FAIL  Rejected by human operator.
💬 Agent: The human declined. Let me try a safer alternative.
```

## 📈 Performance Baseline

| Metric | Value |
|--------|-------|
| Duration | ~90s |
| API Calls | 10-12 |
| Validation Missions | 10 |
| Policy Blocks | 3+ |

(Times depend on LLM latency; gpt-4o-mini is optimized for fast responses)

## Prerequisites

```bash
# 1. OpenAI API key (the agent needs an LLM)
export OPENAI_API_KEY=sk-...

# Or add to examples/tools/.env:
echo "OPENAI_API_KEY=sk-..." >> .env

# 2. Build Matimo (must be compiled before running)
cd /path/to/matimo
pnpm install && pnpm build
```

## Understanding Policy Configuration

The demo uses a **policy.yaml file** to configure what agent-created tools are allowed. This is the core security mechanism.

### How Policy Works

When the demo runs, it:
1. Loads `policy.yaml` (in the demo, inline config is used for simplicity)
2. Creates a `DefaultPolicyEngine` from the policy
3. **Freezes the policy** at startup (`Object.freeze()`) — agents cannot change it
4. When an agent proposes a tool, the engine **validates** it against the policy
5. **Dangerous patterns are blocked** before they can be created

### The Policy Configuration Used by This Demo

```typescript
// From policy-demo.ts
const policyConfig: PolicyConfig = {
  allowedDomains: ['api.weatherapi.com', 'api.github.com', 'jsonplaceholder.typicode.com'],
  allowedHttpMethods: ['GET', 'POST'],
  allowCommandTools: false,      // ❌ No shell commands
  allowFunctionTools: false,     // ❌ No arbitrary code execution
  protectedNamespaces: ['matimo_'], // ❌ Can't hijack matimo_* names
  allowedCredentials: ['WEATHER_API_KEY'],
};
```

**What each rule does:**
- **allowedDomains**: Only HTTP tools targeting these domains are allowed. Blocks SSRF attacks.
- **allowedHttpMethods**: Only GET and POST are allowed. Protects against DELETE/PUT abuse.
- **allowCommandTools/allowFunctionTools**: Shell and code execution are always blocked for agent tools.
- **protectedNamespaces**: Prevents agents from hijacking built-in tool names.
- **allowedCredentials**: Only these environment variables can be referenced.

### Using a Policy File (Recommended for Production)

For production, use a YAML file instead of inline config:

```bash
# 1. Create policy.yaml
cat > policy.yaml << 'EOF'
allowedDomains:
  - api.slack.com
  - api.github.com
allowedHttpMethods:
  - GET
  - POST
allowCommandTools: false
allowFunctionTools: false
protectedNamespaces:
  - matimo_
EOF

# 2. Initialize with the file
const matimo = await MatimoInstance.init({
  policyFile: './policy.yaml'
});
```

**Advantages:**
- ✅ Policy changes don't require code changes
- ✅ Different policies per environment (dev/staging/prod)
- ✅ Version-controlled security decisions
- ✅ Easy for teams to understand what's allowed

For more details, see [Policy Configuration Guide](../../../docs/tool-development/POLICY_AND_LIFECYCLE.md#policy-configuration).

## Running the Demo

### Interactive Mode (Terminal)

```bash
cd examples/tools
pnpm policy:demo
# or: npx tsx policy/policy-demo.ts
```

You'll be prompted to approve/reject operations:

```
┌──────────────────────────────────────────────────────────────┐
│  🛡️  HUMAN-IN-THE-LOOP APPROVAL REQUIRED                     │
├──────────────────────────────────────────────────────────────┤
│  Tool:        matimo_create_tool
│  Description: Create a new tool definition on disk...
│  Params:      {"name":"city_lookup","target_dir":"/tmp/..."}…
└──────────────────────────────────────────────────────────────┘
❓ Approve this operation? (y/n):
```

Type `y` to approve, `n` to reject. Approved tools are added to a session whitelist.

### Automated Mode (Piped Input)

```bash
cd examples/tools

# 6 inputs for Mission 6 lifecycle (create, approve, reload),
# Mission 7 (use city_lookup), Mission 8 (reject malicious), Mission 10 (reload)
printf "y\ny\ny\ny\nn\ny\n" | npx tsx policy/policy-demo.ts
```

### Save Output to File

```bash
printf "y\ny\ny\ny\nn\ny\n" | npx tsx policy/policy-demo.ts 2>&1 | tee demo-output.txt
```

## Expected Output

The demo outputs ~400 lines. Key sections:

### Phase 1: Initialization
```
╔════════════════════════════════════════════════════════════════════╗
║    Matimo Policy Engine — LangChain Agent Demonstration            ║
╚════════════════════════════════════════════════════════════════════╝

═══════════════════════════════════════════════════════════════════
  PHASE 1: Initialize Matimo + LangChain with Policy Engine
═══════════════════════════════════════════════════════════════════

  ℹ Policy Configuration:
    • allowedDomains:      api.weatherapi.com, api.github.com, jsonplaceholder.typicode.com
    • allowedHttpMethods:  GET, POST
    • allowCommandTools:   false
    • allowFunctionTools:  false
    • protectedNamespaces: matimo_

  ✓ PASS  Interactive terminal approval callback installed
  ✓ PASS  Matimo initialized — 13 tools loaded
  ✓ PASS  Policy engine active: true
  ✓ PASS  Converted 13 tools to LangChain format
  ✓ PASS  LLM (gpt-4o-mini) initialized with tool bindings
```

### Phase 2: Autonomous Agent Missions (sample)
```
  ── Mission 6: AUTONOMOUS LIFECYCLE — "I need a city lookup tool" ──
    🎯 Goal: Make a city lookup tool available in the system.
    🎯 The agent must DISCOVER the lifecycle: create → approve → reload.

    🔧 Agent calls: matimo_create_tool({"name":"city_lookup",...})
    📋 Result: { "success": true, "status": "draft" }

    🔧 Agent calls: matimo_approve_tool({"tool_name":"city_lookup",...})
    📋 Result: { "success": true, "status": "approved" }

    🔧 Agent calls: matimo_reload_tools({})
    📋 Result: { "success": true, "loaded": 13 }

    💬 Agent conclusion: The city lookup tool has been created, approved,
       and loaded into the live registry. It's ready to use.
```

### Phase 2: MCP Verification (Mission 11)
```
  ✓ PASS  MCP server started (HTTP mode): port=20687
  ✓ PASS  MCP /health endpoint: status=ok, tools=13
  ✓ PASS  MCP tools/list: 13 tools (including city_lookup)
  ✓ PASS  MCP tools/call (calculator 7×6): { "result": 42 }
  ✓ PASS  matimo_reload_tools in MCP: Reload meta-tool available
  ✓ PASS  MCP tools/call (matimo_reload_tools): { "success": true, "loaded": 13 }
```

### Summary
```
════════════════════════════════════════════════════════════════════
  SUMMARY
════════════════════════════════════════════════════════════════════

  Autonomous Agent Discovery (Goal-Driven — No Tool Names Given):
    ✓ PASS  1. "What is 42+58?" → discovered calculator
    ✓ PASS  2. "Is this tool safe?" → discovered matimo_validate_tool
    ⊘ BLOCKED  3. "Review this for security" → found shell command violations
    ⊘ BLOCKED  4. "Any security concerns?" → found SSRF blocked
    ⊘ BLOCKED  5. "Is this compliant?" → found namespace hijack
    ✓ PASS  6. "I need a city lookup tool" → AUTONOMOUSLY: create → approve → reload
    ✓ PASS  7. "Look up user 1" → used agent-created city_lookup tool
    ⊘ BLOCKED  8. "I need a file reader" → malicious tool rejected by human
    ✓ PASS  9. "What tools were created?" → discovered matimo_list_user_tools
    ✓ PASS  10. "Refresh the registry" → discovered matimo_reload_tools
    ✓ PASS  11. MCP server verified — all tools (incl. city_lookup) via MCP
```

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  LangChain ReAct Agent (gpt-4o-mini)                    │
│  Receives GOAL → reasons → discovers tools → calls them  │
└────────────────────┬────────────────────────────────────┘
                     │ tool_calls
┌────────────────────▼────────────────────────────────────┐
│  MatimoInstance.execute(toolName, params)               │
│  1. Policy check (canExecute: status, roles, RBAC)     │
│  2. Approval check (requires_approval + keywords)      │
│  3. Human-in-the-loop callback (if needed)             │
│  4. Auth injection (env vars, per-call credentials)    │
│  5. Executor routing (http/command/function)           │
│  6. Response validation (Zod schemas)                  │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│  Policy Engine (Object.freeze'd at boot)               │
│  • ContentValidator: 9 deterministic security rules    │
│  • RiskClassifier: low/medium/high/critical            │
│  • ToolIntegrityTracker: SHA-256 tamper detection      │
│  • ApprovalManifest: HMAC-signed approvals             │
│  • DefaultPolicyEngine: RBAC + status enforcement      │
└─────────────────────────────────────────────────────────┘
```

## Policy Configuration Used

```typescript
const policyConfig: PolicyConfig = {
  allowedDomains: ['api.weatherapi.com', 'api.github.com', 'jsonplaceholder.typicode.com'],
  allowedHttpMethods: ['GET', 'POST'],
  allowCommandTools: false,      // No shell commands
  allowFunctionTools: false,     // No arbitrary code execution
  protectedNamespaces: ['matimo_'], // Reserved for built-in tools
  allowedCredentials: ['WEATHER_API_KEY'],
};
```

## Content Validator Rules (9 Rules)

| # | Rule | What It Blocks |
|---|------|---------------|
| 1 | `no-function-execution` | `execution.type: function` (arbitrary code) |
| 2 | `no-command-execution` | `execution.type: command` (shell injection) |
| 3 | `no-ssrf` | Internal IPs: `169.254.169.254`, `10.*`, `192.168.*`, `localhost`, `.internal` |
| 4 | `unauthorized-credential` | Credentials not in allowedCredentials list |
| 5 | `reserved-namespace` | Tool names starting with `matimo_` |
| 6 | `forced-approval` | Forces `requires_approval: true` on all untrusted tools |
| 7 | `blocked-http-method` | HTTP methods not in allowedHttpMethods |
| 8 | `blocked-domain` | Domains not in allowedDomains |
| 9 | `forced-draft-status` | Forces `status: draft` on new tools |

## Approval Flow

```
User/Agent calls matimo.execute('tool_name', params)
         │
         ▼
┌─ Is tool.requires_approval === true? ──┐
│  OR does content contain destructive   │
│  keywords (DELETE, DROP, etc.)?        │
└───────────────┬────────────────────────┘
                │ yes
                ▼
┌─ Is tool pre-approved? ───────────────┐
│  MATIMO_AUTO_APPROVE=true?            │
│  matches MATIMO_APPROVED_PATTERNS?    │
└───────────────┬────────────────────────┘
                │ no
                ▼
┌─ Call approval callback ──────────────┐
│  interactiveApproval(request)         │
│  Shows: tool name, description, params│
│  Human types y/n                      │
│  If approved → add to whitelist       │
└───────────────┬────────────────────────┘
                │ approved
                ▼
         Execute the tool
```

## Files

| File | Purpose |
|------|---------|
| `policy-demo.ts` | Main demo — 11 autonomous missions + Phase 3 checks |
| `README.md` | This file |

## Related Documentation

- [Policy Engine & Tool Lifecycle Guide](../../../docs/tool-development/POLICY_AND_LIFECYCLE.md) — Complete developer guide
- [Meta-Tools Reference](../../../docs/tool-development/META_TOOLS.md) — All built-in matimo_* tools
- [Approval System](../../../docs/APPROVAL-SYSTEM.md) — Approval handler configuration
- [MCP Server](../../../docs/MCP.md) — Model Context Protocol integration
