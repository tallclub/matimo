---
name: policy-validation
description: "Understand Matimo's security policy engine. Learn which tool types are allowed, what domains are safe, how SSRF is prevented, and how the policy validator (matimo_doctor) enforces rules."
metadata:
  category: "Security & Policy"
  difficulty: "intermediate"
  apply-to: "matimo_doctor matimo_validate_tool"
---

# Policy Validation: Security Rules and Enforcement

This skill teaches you **Matimo's security policy engine**—a **developer-controlled, object-frozen, non-bypassable** system that blocks dangerous tool patterns before they execute.

## Core Principle: Policy is Immutable

Once the developer initializes Matimo with a policy configuration, that policy is **frozen** and **cannot be changed by agents**. This ensures:

- ✅ Agents cannot weaken security rules
- ✅ Agents cannot bypass domain restrictions  
- ✅ Agents cannot create shell commands if blocked
- ✅ Policy is transparent and auditable

```typescript
// At deploy time, developer sets immutable policy:
const policyConfig: PolicyConfig = {
  allowedDomains: ['api.github.com', 'api.weatherapi.com'],
  allowedHttpMethods: ['GET', 'POST'],
  allowCommandTools: false,
  allowFunctionTools: false,
  protectedNamespaces: ['matimo_'],
  allowedCredentials: ['GITHUB_TOKEN', 'WEATHER_API_KEY']
};

Object.freeze(policyConfig);  // ← Now immutable

// Agent cannot change this, even if it tries
// All tools are validated against this frozen policy
```

## The matimo_doctor Meta-Tool

**matimo_doctor** is the policy validator. It checks tool definitions against:
1. **Schema validation** — YAML structure is correct
2. **Policy validation** — Tool complies with security rules

```
Input:  YAML tool definition (string)
Output: { valid: true, ... }  ✅ Safe to use
    OR: { valid: false, schemaErrors: [...], policyErrors: [...] }  ❌ Blocked
```

### Example: Valid Tool → Passes Both Checks

```yaml
name: github_user_lookup
version: "1.0.0"
description: Look up a GitHub user
parameters:
  username:
    type: string
    required: true
execution:
  type: http
  method: GET
  url: "https://api.github.com/users/{username}"
```

**matimo_doctor result:**
```json
{
  "valid": true,
  "schemaErrors": [],
  "policyErrors": []
}
```

### Example: Invalid YAML → Schema Error

```yaml
name: my_tool
# Missing: version, description, parameters, execution
```

**matimo_doctor result:**
```json
{
  "valid": false,
  "schemaErrors": [
    {"field": "version", "message": "Invalid input: expected string, received undefined"},
    {"field": "execution", "message": "Invalid input: expected object, received undefined"}
  ],
  "policyErrors": []
}
```

### Example: Policy Violation → Policy Error

```yaml
name: shell_exec
version: "1.0.0"
execution:
  type: command      # ← Command tools blocked by policy
  command: bash
  args: ["-c", "rm -rf /"]
```

**matimo_doctor result:**
```json
{
  "valid": false,
  "schemaErrors": [],
  "policyErrors": [
    {"rule": "allowCommandTools", "severity": "critical", "message": "Command tools are blocked by policy"}
  ]
}
```

---

## Policy Rules Reference

### 1. Allowed Domains (HTTP Tools Only)

**What it does:** Restricts HTTP tools to specific domains to prevent abuse.

**Config:**
```typescript
allowedDomains: ['api.github.com', 'api.weatherapi.com', 'jsonplaceholder.typicode.com']
```

**Example: Allowed**
```yaml
execution:
  type: http
  url: "https://api.github.com/users/octocat"  ✅ In allowedDomains
```

**Example: Blocked**
```yaml
execution:
  type: http
  url: "https://backdoor.attacker.com/hack"  ❌ Not in allowedDomains

matimo_doctor: "Domain blocked: backdoor.attacker.com not in allowed list"
```

---

### 2. Allowed HTTP Methods

**What it does:** Restricts HTTP verbs to prevent unintended data modification.

**Config:**
```typescript
allowedHttpMethods: ['GET', 'POST']  // Common safe methods
```

**Example: Allowed**
```yaml
execution:
  type: http
  method: GET      ✅ In allowedHttpMethods
```

**Example: Blocked**
```yaml
execution:
  type: http
  method: DELETE   ❌ Not in allowedHttpMethods

matimo_doctor: "HTTP method DELETE not allowed; must use GET or POST"
```

---

### 3. Allow/Disallow Command Tools

**What it does:** Command tools execute shell commands—inherently risky.

**Config:**
```typescript
allowCommandTools: false  // Strongly recommended
```

**Example: Blocked**
```yaml
execution:
  type: command
  command: "cat /etc/passwd"  ❌ Commands blocked

matimo_doctor: "Command tools are blocked by policy"
```

---

### 4. Allow/Disallow Function Tools

**What it does:** Function tools execute arbitrary JavaScript code.

**Config:**
```typescript
allowFunctionTools: false  // Strongly recommended
```

**Example: Blocked**
```yaml
execution:
  type: function
  code: |
    return require('fs').readFileSync('/etc/passwd');  ❌ Blocked

matimo_doctor: "Function tools are blocked by policy"
```

---

### 5. Protected Namespaces

**What it does:** Prevents agents from hijacking reserved tool names (matimo_* for built-ins).

**Config:**
```typescript
protectedNamespaces: ['matimo_']
```

**Example: Allowed**
```yaml
name: github_webhook  ✅ Doesn't start with matimo_
```

**Example: Blocked**
```yaml
name: matimo_backdoor  ❌ Tries to hijack reserved namespace

matimo_doctor: "Reserved namespace violation: matimo_* is protected for built-in tools"
```

---

### 6. Allowed Credentials

**What it does:** Whitelists which environment variables can be used for auth.

**Config:**
```typescript
allowedCredentials: ['GITHUB_TOKEN', 'WEATHER_API_KEY']
```

**Example: Allowed**
```yaml
authentication:
  type: api_key
  location: header
  name: Authorization
# Uses MATIMO_GITHUB_TOKEN from env  ✅ Whitelisted
```

**Example: Blocked**
```yaml
authentication:
  type: api_key
  location: header
  name: X-Custom-Secret
# Uses MATIMO_X_CUSTOM_SECRET from env  ❌ Not whitelisted

matimo_doctor: "Credential X_CUSTOM_SECRET not in allowed list"
```

---

## Security Patterns Blocked by Policy

### Pattern 1: SSRF (Server-Side Request Forgery)

**Attack:** Probe internal IPs to discover service topology or exploit internal endpoints.

**Blocked ranges:**
- `169.254.169.254/32` — AWS EC2 metadata service
- `127.0.0.1/8`, `localhost` — Local machine
- `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16` — Private networks
- `::1`, `fe80::/10` — IPv6 loopback/link-local

**Example: Attempted Attack**
```yaml
name: metadata_probe
execution:
  type: http
  method: GET
  url: "http://169.254.169.254/latest/meta-data/"  ❌ SSRF!

matimo_doctor: "SSRF detected: forbidden IP range 169.254.* is not allowed"
```

### Pattern 2: Shell Command Execution

**Attack:** Execute arbitrary commands on the host system.

**Example: Attempted Attack**
```yaml
name: shell_exec
execution:
  type: command
  command: bash
  args: ["-c", "{user_command}"]  ❌ Dangerous!

matimo_doctor: "Command tools are blocked by policy"
```

### Pattern 3: Arbitrary Code Execution

**Attack:** Run untrusted JavaScript code with full system access.

**Example: Attempted Attack**
```yaml
name: code_executor
execution:
  type: function
  code: |
    const fs = require('fs');
    return fs.readFileSync('/etc/passwd', 'utf8');  ❌ Dangerous!

matimo_doctor: "Function tools are blocked by policy"
```

### Pattern 4: Namespace Hijacking

**Attack:** Create a tool named `matimo_*` to impersonate a built-in tool.

**Example: Attempted Attack**
```yaml
name: matimo_create_tool_backdoor  ❌ Looks like built-in!

matimo_doctor: "Reserved namespace violation: matimo_* is protected"
```

---

## Using matimo_doctor in Agent Workflows

### Step 1: Validate YAML Before Creating

```
Agent: "I'll validate this tool first"
Agent: matimo_doctor(yaml_content="...")
Result: { valid: true } ✅ or { valid: false, errors: [...] } ❌
```

### Step 2: Understand Errors

```
If matimo_doctor returns { valid: false, errors: [...] }:

For schema errors:
  - Read field name and message
  - Fix YAML syntax or missing fields
  - Re-validate

For policy errors:
  - Understand which rule was violated
  - Redesign tool to comply
  - Use allowed domains, methods, execution types
  - Re-validate
```

### Step 3: Only Create Valid Tools

```
Once matimo_doctor returns { valid: true }:
  Agent: matimo_create_tool(name, yaml_content, target_dir)
  Result: Tool created on disk, marked as draft
```

---

## Examples: Learning from Blocked Patterns

### Example 1: Redesign for Policy

**Agent's first attempt (blocked):**
```yaml
name: file_system
execution:
  type: command
  command: cat
  args: ["{path}"]
# ❌ matimo_doctor: "Command tools are blocked by policy"
```

**Agent learns:** "I can't use commands; let me use HTTP instead"

**Agent's redesign (approved):**
```yaml
name: file_server_lookup
execution:
  type: http
  method: GET
  url: "https://api.example.com/files/{file_id}"
# ✅ matimo_doctor: { valid: true }
```

---

### Example 2: Respect Domain Restrictions

**Agent's first attempt (blocked):**
```yaml
name: internal_service_caller
execution:
  type: http
  method: POST
  url: "http://10.0.0.5:8080/admin"
# ❌ matimo_doctor: "SSRF detected: internal IP 10.0.0.5 not allowed"
```

**Agent learns:** "I can't probe internal networks; only public APIs"

**Agent's redesign (approved):**
```yaml
name: public_api_caller
execution:
  type: http
  method: POST
  url: "https://api.public-service.com/endpoint"
# ✅ matimo_doctor: { valid: true }
```

---

### Example 3: Avoid Namespace Conflicts

**Agent's first attempt (blocked):**
```yaml
name: matimo_my_tool
# ❌ matimo_doctor: "Reserved namespace violation: matimo_* is protected"
```

**Agent learns:** "Built-in tools use matimo_*; I need a different name"

**Agent's redesign (approved):**
```yaml
name: my_custom_tool
# ✅ matimo_doctor: { valid: true }
```

---

## Policy in Action: Complete Flow

```
Developer deploys Matimo:
  policyConfig = {
    allowedDomains: ['api.github.com'],
    allowCommandTools: false
  }
  Object.freeze(policyConfig)

Agent receives goal: "I need a tool to run bash commands"

Agent designs: 
  execution: { type: command, command: bash }
  
Agent validates:
  matimo_doctor(yaml) → { valid: false, error: "Command tools blocked" }

Agent learns:
  "Commands are not allowed; policy is immutable; I must redesign"

Agent redesigns:
  execution: { type: http, method: GET, url: "https://api.github.com/..." }

Agent validates:
  matimo_doctor(yaml) → { valid: true }

Agent creates:
  matimo_create_tool(...) → Success ✅
```

---

## Developer Perspective: Setting Policy

```typescript
// At initialization time, developer sets immutable policy for their deployment:

const policyConfig: PolicyConfig = {
  // Only these domains can be called
  allowedDomains: [
    'api.github.com',
    'api.slack.com',
    'jsonplaceholder.typicode.com'  // Safe test API
  ],
  
  // Only safe HTTP methods
  allowedHttpMethods: ['GET', 'POST'],
  
  // Block dangerous execution types
  allowCommandTools: false,        // No shell access
  allowFunctionTools: false,       // No arbitrary code
  
  // Protect built-in tools
  protectedNamespaces: ['matimo_'],
  
  // Whitelist auth credentials
  allowedCredentials: ['GITHUB_TOKEN', 'SLACK_BOT_TOKEN']
};

// Freeze it—agents cannot modify
Object.freeze(policyConfig);

const matimo = await MatimoInstance.init({
  policyConfig,  // ← Immutable policy applied to all tools
  // ...
});
```

---

## Key Takeaways

1. ✅ **Policy is immutable** — Agents cannot bypass or weaken security rules
2. ✅ **matimo_doctor enforces policy** — Use it to validate YAML before creating
3. ✅ **Domains are restricted** — Only allowed APIs can be called
4. ✅ **Commands and functions are optional** — Developers can block them entirely
5. ✅ **SSRF is prevented** — Internal IP ranges are blocked by default
6. ✅ **Namespaces are protected** — `matimo_*` is reserved for built-ins
7. ✅ **Credentials are whitelisted** — Only approved env vars can be used

---

## References

- **Tool lifecycle**: See `meta-tools-lifecycle` skill
- **Complete tool creation**: See `tool-creation` skill
- **Tool discovery**: See `tool-discovery` skill

---

**Last Updated:** March 2026  
**Status:** Complete  
**Level:** Intermediate
