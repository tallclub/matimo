---
name: meta-tools-lifecycle
description: "Master the complete tool lifecycle workflow: validate, create, approve, reload, and use. Agents learn to orchestrate tool creation with policy validation and human approval."
metadata:
  category: "Tool Lifecycle"
  difficulty: "advanced"
  apply-to: "matimo_validate_tool matimo_create_tool matimo_approve_tool matimo_reload_tools matimo_list_user_tools matimo_get_tool_status"
---

# Meta-Tools Lifecycle: Complete Workflow

This skill teaches you how to take a new tool from idea to first call: validate the YAML, write it to disk, get a human to approve it, reload the registry, and use it. Every tool you create is **untrusted** — it starts as a draft and cannot run until a human approves it.

## The Complete Tool Lifecycle

```
1. Understand requirements
   ↓
2. Validate the YAML            matimo_validate_tool
   ↓
3. Create it on disk            matimo_create_tool      → status: draft, approvalState: pending
   ↓
4. Reload the registry          matimo_reload_tools     → the draft is registered, not yet runnable
   ↓
5. Ask a human to approve it    matimo_approve_tool     → a human confirms; status: approved
   ↓
6. Reload again                 matimo_reload_tools     → the approved tool is runnable
   ↓
7. Call the tool                (every call still asks a human: requires_approval is true)

Check progress at any point with matimo_get_tool_status and matimo_list_user_tools.
```

## Step 1: Understand Requirements

Before writing YAML, clarify:

- **What it does:** read-only (GET) or changes data (POST/PUT/DELETE)
- **Which endpoint:** a public HTTPS API the developer allows
- **Inputs:** the parameters it needs
- **Output:** what the caller should get back

**Is it allowed?** Untrusted tools must be `type: http`, must not target localhost, private networks or cloud metadata addresses, must not use a `matimo_` name, and must stay within the developer's allowed domains, HTTP methods (GET and POST by default) and credentials.

## Step 2: Validate the YAML

### Write the complete YAML first

```yaml
name: weather_lookup                     # snake_case, unique
version: "1.0.0"                         # a string
description: Get current weather for a city
parameters:
  city:
    type: string                         # string | number | boolean | array | object
    required: true
    description: City name (e.g., "New York")
execution:
  type: http
  method: GET
  url: "https://api.weatherapi.com/v1/current.json?q={city}"
```

### Call matimo_validate_tool before creating

```
matimo_validate_tool(yaml_content: "<your complete YAML>")

→ { "valid": true, "schemaErrors": [], "policyViolations": [], "riskLevel": "low" }   ✅ create it
→ { "valid": false, "schemaErrors": [...], "policyViolations": [...] }                ❌ fix first
```

| Error | Cause | Fix |
|-------|-------|-----|
| `version: ... expected string` | `version` missing or a number | Add `version: "1.0.0"` |
| `execution: ... expected object` | No `execution` block | Add a complete `execution` block |
| `execution.method: Invalid option` | Unknown HTTP verb | Use GET, POST, PUT, DELETE or PATCH |
| `no-command-execution` / `no-function-execution` | `type: command` or `type: function` | Use `type: http` |
| `no-ssrf` | URL targets localhost, a private range or `169.254.169.254` | Use a public API |
| `reserved-namespace` | Name starts with `matimo_` | Choose another name |
| `blocked-http-method` | Not GET or POST | Use GET or POST, or ask the developer |

Validate again after each fix until `valid` is `true`.

`matimo_validate_tool` checks the default rules, and reports a definition as valid when `matimo_create_tool` would accept it (it adds `requires_approval` and `status` itself, so leave them out). The developer's own policy — allowed domains, allowed methods, allowed credentials — applies when the tool loads, so a valid tool can still appear in `rejected` after `matimo_reload_tools` (rules `blocked-domain`, `blocked-http-method`, `unauthorized-credential`).

## Step 3: Create the Tool on Disk

```
matimo_create_tool(
  name: "weather_lookup",
  yaml_content: "<the validated YAML>",
  target_dir: "<directory the developer gave you>",
  proposed_by: "<your agent id>",          # optional
  justification: "<why the task needs it>"  # optional
)

→ {
    "success": true,
    "path": "<target_dir>/weather_lookup/definition.yaml",
    "riskLevel": "high",
    "status": "draft",
    "approvalState": "pending",
    "message": "Tool created as a draft (low risk, read-only). It runs after a reviewer approves it with matimo_approve_tool and the tools reload."
  }
```

`matimo_create_tool` itself asks a human before it writes anything. It then forces two fields:

- `status: draft` — a draft never runs in production, and elsewhere runs only for an admin caller
- `requires_approval: true` — every call of the new tool asks a human (this is also why `riskLevel` is `high`)

| Response | Meaning | Next step |
|----------|---------|-----------|
| `success: true, approvalState: "pending"` | Draft written | Reload, then ask for approval |
| `success: false, errors: [...]` | Policy rejected it | Read the rule, redesign, validate again |
| `success: false, message: "Schema validation failed..."` | Invalid YAML | Fix it, validate again |

## Step 4: Reload the Registry

```
matimo_reload_tools()        # no parameters

→ { "success": true, "loaded": 1, "removed": 0, "revalidated": 24, "rejected": [], "message": "..." }
```

A name in `rejected` failed the policy checks on load; read the reason in the logs or validate the YAML again. After this reload the draft is registered, but calling it fails with `Draft tool "<name>" requires admin role` until it is approved.

## Step 5: Ask a Human to Approve It

**You cannot approve your own tool.** `matimo_approve_tool` always asks a human — nothing can pre-approve it — so calling it puts the decision in front of the person running you:

```
matimo_approve_tool(name: "weather_lookup", tool_dir: "<same directory>")

→ approved:  { "success": true, "name": "weather_lookup", "hash": "...", "approvedAt": "...", "message": "Tool approved. Effective after reload..." }
→ declined:  the call fails with an approval error; the tool stays a draft
```

Tell the human what the tool does, which URL it calls, and why the task needs it before you call it. When the host identifies callers, approving also needs the `admin` role, and the agent that created a tool can never approve it — another reviewer must.

**If approved:** the YAML changes to `status: approved` and a signed approval record is stored. Editing the file afterwards voids the approval.

**If declined:** do not retry the same tool. Ask what concerned the human, then redesign or drop it.

## Step 6: Reload Again

```
matimo_reload_tools()
```

The approved tool loads with its approval verified and is now runnable. Confirm with:

```
matimo_get_tool_status(name: "weather_lookup", tool_dir: "<same directory>")
→ { "found": true, "status": "approved", "approvalState": "approved", ... }
```

## Step 7: Call the Tool

```
weather_lookup(city: "New York")
```

Because the tool keeps `requires_approval: true`, a human confirms each call. If they decline, the call fails with an approval error — report it rather than retrying.

## Listing What You Created

```
matimo_list_user_tools(tool_dir: "<same directory>", include_drafts: true)

→ {
    "tools": [
      { "name": "weather_lookup", "description": "...", "version": "1.0.0", "status": "approved", "riskLevel": "high", "tags": [] }
    ],
    "total": 1
  }
```

Pass `include_drafts: false` to see only approved tools.

---

## Common Patterns

### Safe HTTP GET tool

```yaml
name: github_user_lookup
version: "1.0.0"
description: Look up a GitHub user's profile
parameters:
  username:
    type: string
    required: true
    description: GitHub username (e.g., "octocat")
execution:
  type: http
  method: GET
  url: "https://api.github.com/users/{username}"
```

→ Validates as low risk. Still a draft after creation: it needs approval like every created tool.

### HTTP POST tool

```yaml
name: todo_create
version: "1.0.0"
description: Create a new todo item
parameters:
  title:
    type: string
    required: true
execution:
  type: http
  method: POST
  url: "https://jsonplaceholder.typicode.com/todos"
  body:
    title: "{title}"
```

→ Validates as medium risk; same lifecycle. The human reviewing it should expect a write.

### Rejected: command tool

```yaml
execution:
  type: command
  command: bash
  args: ["-c", "{cmd}"]
```

→ `matimo_validate_tool` reports `no-command-execution`. Agents can only create HTTP tools.

### Rejected: SSRF

```yaml
execution:
  type: http
  method: GET
  url: "http://169.254.169.254/latest/meta-data/"
```

→ `matimo_validate_tool` reports `no-ssrf`. Internal and metadata addresses are always blocked.

### Rejected: reserved name

```yaml
name: matimo_backdoor
```

→ `matimo_create_tool` refuses names starting with `matimo_`.

---

## Workflow Decision Tree

```
Does a new tool solve the user's goal?
  └─ YES → matimo_validate_tool
       ├─ valid    → matimo_create_tool → matimo_reload_tools
       │             → matimo_approve_tool (a human decides)
       │                ├─ approved → matimo_reload_tools → call the tool
       │                └─ declined → ask why; redesign or stop
       └─ invalid  → read the rule → redesign → validate again
```

---

## Troubleshooting

### "Draft tool "<name>" requires admin role"
The tool has not been approved. Run Step 5, then reload (Step 6).

### "Draft tool "<name>" is not available in production"
Drafts never run in production. Approve it first.

### The tool is missing after matimo_reload_tools
- Check `rejected` in the reload result: the tool failed a policy rule.
- A tool whose file changed after approval loses its approval and is checked as a new proposal. A file hand-edited to `status: approved` without `matimo_approve_tool` is rejected.

### matimo_approve_tool says the admin role is required
The host identifies callers and you do not have the role. Ask the human to approve the tool from their side.

### matimo_approve_tool refuses because you created the tool
Someone other than the creating agent must approve it.

---

## Key Principles

1. ✅ **Validate before creating** — matimo_validate_tool catches schema and policy errors early
2. ✅ **Every created tool needs a human** — approval is never automatic, whatever the risk
3. ✅ **Reload after creating and after approving** — the registry only changes on reload
4. ✅ **Accept a decline** — learn why and redesign; do not resubmit the same tool
5. ✅ **Respect policy** — the rules exist to stop exactly the tools an attacker would write
6. ✅ **Name tools clearly** — the human approving it should understand it at a glance

---

## References

- **Writing tool YAML**: see the `tool-creation` skill
- **Policy rules**: see the `policy-validation` skill
- **Finding existing tools first**: see the `tool-discovery` skill
