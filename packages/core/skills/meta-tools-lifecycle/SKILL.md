---
name: meta-tools-lifecycle
description: "Master the complete tool lifecycle workflow: create, validate, approve, reload, and use. Agents learn to autonomously orchestrate tool creation with policy validation and human approval."
metadata:
  category: "Tool Lifecycle"
  difficulty: "advanced"
  apply-to: "matimo_create_tool matimo_validate_tool matimo_doctor matimo_review matimo_reload_tools matimo_list_user_tools"
---

# Meta-Tools Lifecycle: Complete Workflow

This skill teaches you how to autonomously orchestrate Matimo's **complete tool lifecycle**—from conception through validation, human approval, registration, and delivery. This is the workflow for agents that **create tools dynamically**.

## The Complete Tool Lifecycle

```
1. Understand Requirements
   ↓
2. Design YAML (matimo_validate_tool or matimo_doctor for validation)
   ↓
3. Create on Disk (matimo_create_tool)
   ↓
4. Request Human Approval (matimo_review)
   ↓
5. Reload Registry (matimo_reload_tools)
   ↓
6. Execute the Tool
   ↓
7. List & Manage (matimo_list_user_tools)
```

## Step 1: Understand Requirements

Before writing YAML, clarify:

**What does the tool need to do?**
- Read-only (GET) vs. modify data (POST/PUT/DELETE)
- Which API endpoint(s) to call
- What inputs does it need (parameters)
- What output should it return

**What domain?**
- Public API (GitHub, weather, etc.)
- Internal service
- File system operation
- Something else

**Is it safe?**
- Uses whitelisted domains only
- Uses safe HTTP methods (GET/POST preferred)
- No SSRF attacks (no internal IPs)
- No arbitrary code execution

## Step 2: Design YAML with Validation

### Generate Complete YAML First

**REQUIRED fields (all must be present):**

```yaml
name: tool_name                          # snake_case, unique identifier
version: "1.0.0"                         # semantic version (required string)
description: "What this tool does"       # clear one-liner

parameters:                              # even if empty, must be present
  param_name:
    type: string                         # string, number, boolean, array, object
    required: true                       # boolean (required/optional)
    description: "What it does"

execution:                               # must match: http, command, or function
  type: http                             # exact type string
  method: GET                            # if http: GET, POST, PUT, DELETE, PATCH
  url: "https://api.example.com/endpoint"  # if http: full URL
  # For type: command, provide: command, args
  # For type: function, provide: handler, code
```

**Example: Minimal Valid Tool**

```yaml
name: weather_lookup
version: "1.0.0"
description: Get current weather for a city
parameters:
  city:
    type: string
    required: true
    description: City name (e.g., "New York")
execution:
  type: http
  method: GET
  url: "https://api.weatherapi.com/current?q={city}"
```

### Validate Before Creating

**Always call matimo_doctor BEFORE matimo_create_tool:**

```
Input:  matimo_doctor(yaml_content: "<your complete YAML>")
Output: { valid: true, ... }  ✅ Safe to create
  OR:   { valid: false, schemaErrors: [...], policyErrors: [...] }  ❌ Fix first
```

**If validation fails:**

| Error | Cause | Fix |
|-------|-------|-----|
| `version: Invalid input, expected string` | Missing/wrong type | Add `version: "1.0.0"` |
| `execution: Invalid input, expected object` | Missing section | Add complete `execution` block |
| `execution.method: Invalid option` | Wrong HTTP verb | Use GET, POST, PUT, DELETE, or PATCH |
| `parameters: Invalid input, expected object` | Missing field | Add `parameters: {}` or with actual params |
| `Command tools are blocked (policy)` | Trying to use `type: command` | Use HTTP GET/POST instead |
| `SSRF detected: forbidden IP range` | Using internal IP (169.254.*, 10.*) | Use public APIs |
| `Reserved namespace violation: matimo_*` | Name starts with `matimo_` | Choose different name |

**If policy blocks your tool:**
- **Understand why**: Read the rule that blocked it
- **Redesign**: Use an allowed API or method
- **Re-validate**: Check with matimo_doctor again until `valid: true`

**Example: Fixing Validation Errors**

```
WRONG:
name: weather_fetch
# Missing version ❌

VALIDATED:
name: weather_fetch
version: "1.0.0"
description: Get weather
parameters: {}
execution:
  type: http
  method: GET
  url: "https://api.weatherapi.com/v1/current.json"
```

## Step 3: Create Tool on Disk

Once `matimo_doctor` returns `valid: true`:

```
Call matimo_create_tool with:
  - name: "tool_name"
  - yaml_content: "<complete YAML string>"
  - target_dir: "<directory path provided by user>"

Expected response:
{
  "success": true,
  "path": "/path/to/tool_name/definition.yaml",
  "status": "draft",
  "approvalState": "pending",
  "message": "Tool created as draft. Requires approval before execution..."
}
```

**What happens:**
1. ✅ Tool YAML written to disk: `{target_dir}/tool_name/definition.yaml`
2. ✅ Tool status set to `draft` (not yet approved)
3. ✅ Approval state marked `pending` (waiting for human)
4. ⏸️ Tool NOT yet executable (needs approval)

**Common responses:**

| Response | Meaning | Next Step |
|----------|---------|-----------|
| `success: true, approvalState: "pending"` | Draft created, awaiting approval | Call matimo_review |
| `success: true, approvalState: "auto-approved"` | Low-risk tool, ready to use | Call matimo_reload_tools |
| `success: false, message: "..."` | Creation failed (invalid YAML) | Call matimo_doctor again, fix errors, retry |

## Step 4: Request Human Approval

**Critical:** Tools created by agents are `untrusted` and require human approval:

```
Call matimo_review with:
  - toolName: "weather_fetch"
  - target_dir: "<same directory>"

Expected response (if human approves):
{
  "approved": true,
  "message": "Tool approved for production."
}

Expected response (if human rejects):
{
  "approved": false,
  "message": "Tool rejected."
  // Tool remains draft, NOT executable
}
```

**What the human sees:**
- Tool name and description
- Parameters and their types
- Execution method (HTTP GET, etc.)
- Proposed by agent, security reviewed
- **Decision:** Approve (y) or reject (n)

**If rejected:**
- ❌ Tool remains in `draft` status
- ❌ Cannot execute or reload
- 💡 Understand why human rejected, redesign, and re-submit

**If approved:**
- ✅ Tool marked as `approved` status
- ✅ HMAC signature created (tamper detection)
- ✅ Ready for reload

## Step 5: Reload Registry

After human approval, the tool registry must be refreshed:

```
Call matimo_reload_tools with:
  - target_dir: "<same directory>"

Expected response:
{
  "loaded": ["weather_fetch", "..."],
  "approved": ["weather_fetch"],
  "rejected": [],
  "message": "Reloaded X tools..."
}
```

**What happens:**
1. 🔄 System re-scans all tool directories
2. ✅ Approved tools become executable
3. ❌ Rejected tools are skipped
4. 📝 Registry updated in-memory

**After reload:**
- Tool is **discoverable** by agents
- Tool can be **called** via matimo.execute()
- Tool appears in **LLM tool bindings** (if using LangChain)

## Step 6: Execute the Tool

Once reloaded, the agent can call the tool naturally:

```
For HTTP tool:
  Input:  { city: "New York" }
  Action: matimo.execute("weather_fetch", { city: "New York" })
  Output: { success: true, weather: { ... } }

For created tool with requires_approval: true:
  First call prompts human: "Approve execution of weather_fetch?"
  On approval: Tool executes
  On rejection: Tool blocked
```

**Agent-created tools with requires_approval:**
- ✅ Can be created
- ✅ Can be approved for production
- ✅ Still require human approval on **first execution** (extra safety)
- ✅ After human approves once, auto-approved in session

## Step 7: List and Manage Tools

Discover what tools have been created:

```
Call matimo_list_user_tools with:
  - target_dir: "<same directory>"

Expected response:
{
  "tools": [
    {
      "name": "weather_fetch",
      "status": "approved",
      "riskLevel": "LOW",
      "description": "Get weather for a city"
    },
    {
      "name": "file_reader",
      "status": "rejected",
      "reason": "Command tools are blocked"
    }
  ]
}
```

**What you learn:**
- ✅ `weather_fetch` is ready to use (approved)
- ❌ `file_reader` failed policy (rejected)
- 📊 Risk levels guide execution safety

---

## Common Patterns

### Pattern 1: Safe HTTP GET Tool

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

→ **Result**: Auto-approved (low-risk read-only), no human approval needed

---

### Pattern 2: Safe HTTP POST Tool

```yaml
name: todo_create
version: "1.0.0"
description: Create a new todo item
parameters:
  title:
    type: string
    required: true
  completed:
    type: boolean
    required: false
execution:
  type: http
  method: POST
  url: "https://jsonplaceholder.typicode.com/todos"
```

→ **Result**: Pending approval, human reviews then approves

---

### Pattern 3: Blocked Command Tool

```yaml
name: shell_exec
version: "1.0.0"
description: Execute shell commands
parameters:
  cmd:
    type: string
    required: true
execution:
  type: command
  command: bash
  args: ["-c", "{cmd}"]
```

→ **Result**: `matimo_doctor` blocks immediately with "Command tools are blocked (policy)"

**What agent learns:** "I can't create shell commands; use HTTP instead"

---

### Pattern 4: Policy Violation - SSRF

```yaml
name: metadata_probe
version: "1.0.0"
execution:
  type: http
  method: GET
  url: "http://169.254.169.254/latest/meta-data/"  # AWS EC2 metadata ❌
```

→ **Result**: `matimo_doctor` blocks with "SSRF detected: forbidden IP range 169.254.*"

**What agent learns:** "Can't probe internal IPs; they're blocked"

---

### Pattern 5: Namespace Hijack (Rejected)

```yaml
name: matimo_backdoor  # WRONG: Reserved namespace ❌
```

→ **Result**: `matimo_doctor` blocks with "Reserved namespace violation: matimo_* is protected"

**What agent learns:** "Can't use matimo_* names; they're reserved for built-ins"

---

## Workflow Decision Tree

**Should I create this tool?**

```
Does it solve the user's goal? → YES → Proceed
  ↓
Is it safe (policy passes)?
  ├─ YES → Create (agent-created tools always pending approval)
  │  └─→ matimo_doctor → matimo_create_tool → matimo_review
  │     → matimo_reload_tools → Execute
  │
  └─ NO → Understand policy error
     → Redesign to comply (different API, different method)
     → Re-validate with matimo_doctor
     → When valid, create
```

**If human rejects approval:**

```
Why did they reject?
  ├─ Security concern → Redesign differently
  ├─ Governance concern → Ask for clarification
  ├─ Not needed → Mark complete, try different approach
  └─ Technical issue → Fix and re-submit
```

**If policy blocks:**

```
Which rule blocked it?
  ├─ Command blocked → Use HTTP instead
  ├─ SSRF detected → Use public API, not internal IP
  ├─ Namespace reserved → Rename without matimo_ prefix
  ├─ Domain blocked → Check allowed-domains policy
  └─ Other → Read error, understand constraint, redesign
```

---

## Debugging & Troubleshooting

### Symptom: matimo_doctor returns validation errors

```
Field: "execution.method"
Message: "Invalid option: expected one of GET|POST|PUT|DELETE|PATCH"
```

**Fix:**
1. Read error: method was `PATCH` when `execution.type: http` expects GET/POST/PUT/DELETE/PATCH
2. Check YAML: wrong value or syntax
3. Correct: `method: POST` (exact casing)
4. Re-validate with matimo_doctor

### Symptom: matimo_create_tool returns "success: false"

```
Message: "Schema validation failed: Tool schema validation failed:
  • version: Invalid input: expected string, received undefined"
```

**Fix:**
1. YAML is missing `version` field
2. Add: `version: "1.0.0"`
3. Call matimo_doctor to verify
4. Then matimo_create_tool

### Symptom: matimo_review asks for approval but tool is `auto-approved`

```
Expected: Tool should be executable immediately
Actual: Human still asked to approve
```

**Fix:**
- Low-risk tools (GET-only to public APIs) are `auto-approved`
- Other tools are `pending` and require human approval
- This is correct behavior for agent-created tools
- Call matimo_reload_tools after approval

### Symptom: Tool not in registry after matimo_reload_tools

```
Expected: "weather_fetch" in matimo_list_user_tools()
Actual: Not in list
```

**Fix:**
1. Did matimo_review succeed? (Check for `approved: true`)
2. Did matimo_reload_tools complete? (Check response)
3. Call matimo_list_user_tools() to verify
4. If still missing, re-run matimo_reload_tools

---

## Key Principles

1. ✅ **Always validate before creating** — matimo_doctor catches errors early
2. ✅ **Accept human feedback** — If rejected, learn why and redesign
3. ✅ **Respect policy** — It's there to prevent attacks; work within it
4. ✅ **Reload after approval** — Tools don't appear until registry is refreshed
5. ✅ **Complete YAML is critical** — Missing `version` or `execution` = failure
6. ✅ **Name tools for discovery** — Clear names help humans understand what they're approving

---

## References

- **Complete tool creation spec**: See `tool-creation` skill
- **Policy validation rules**: See `policy-validation` skill
- **Tool discovery**: See `tool-discovery` skill
- **Matimo Architecture**: See copilot-instructions.md

---

**Last Updated:** March 2026  
**Status:** Complete  
**Level:** Advanced (assumes familiarity with tool-creation skill)
