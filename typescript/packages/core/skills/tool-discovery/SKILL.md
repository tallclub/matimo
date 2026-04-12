---
name: tool-discovery
description: "Find and manage available tools. Learn how to list user-created tools, search by criteria, categorize by risk level, and understand tool status states."
metadata:
  category: "Tool Management"
  difficulty: "beginner"
  apply-to: "matimo_list_user_tools matimo_list_skills matimo_get_tool_status"
---

# Tool Discovery: Finding and Managing Tools

This skill teaches you how to **discover, search, and manage** Matimo tools that are available in your system.

## Overview: Tool Sources

Three sources of tools:

1. **Core/Built-in Tools** — Shipped with Matimo SDK
   - `matimo_create_tool`, `matimo_validate_tool`, `matimo_doctor`, etc.
   - Read-only, always available
   - Used by agents to manage tool lifecycle

2. **Provider Tools** — Application-specific tools from packages
   - Slack tools, GitHub tools, AWS tools, etc.
   - Defined in `packages/{provider}/tools/`
   - Available after initialization with `toolPaths`

3. **User-Created Tools** — Dynamically created by agents
   - Stored in `target_dir` (usually temp directory)
   - Status: `draft`, `approved`, `rejected`
   - Discovered via `matimo_list_user_tools`

---

## Meta-Tool: matimo_list_user_tools

Lists all tools created by agents in a specific directory.

```
Input:  { target_dir: "/path/to/tools" }
Output: { tools: [...] status: "success" }
```

### Basic Usage

```
Call: matimo_list_user_tools(target_dir="/tmp/my-tools")

Response:
{
  "tools": [
    {
      "name": "weather_fetch",
      "version": "1.0.0",
      "description": "Get current weather for a city",
      "status": "approved",
      "riskLevel": "LOW",
      "createdAt": "2026-03-17T10:30:00Z",
      "executionType": "http",
      "requiresApproval": false
    },
    {
      "name": "file_reader",
      "version": "1.0.0",
      "description": "Read files from filesystem",
      "status": "rejected",
      "riskLevel": "CRITICAL",
      "reason": "Command tools are blocked by policy",
      "createdAt": "2026-03-17T10:31:00Z",
      "executionType": "command",
      "requiresApproval": true
    }
  ],
  "summary": {
    "total": 2,
    "approved": 1,
    "rejected": 1,
    "draft": 0
  }
}
```

---

## Understanding Tool Status

### Status: `approved`

Tool has been validated and approved by human operator. Ready to use.

```
Indicators:
- ✅ Created with matimo_create_tool
- ✅ Passed matimo_doctor validation
- ✅ Human approved via matimo_review
- ✅ Registry reloaded via matimo_reload_tools
- ✅ Executable via matimo.execute()
```

**Example in response:**
```json
{
  "name": "weather_fetch",
  "status": "approved",
  "riskLevel": "LOW",
  "message": "Ready for execution"
}
```

### Status: `draft`

Tool created but not yet approved. Cannot be executed.

```
Indicators:
- ✅ Created with matimo_create_tool
- ✅ Passed validation
- ⏸️ Waiting for human approval via matimo_review
- ❌ NOT executable
```

**Example in response:**
```json
{
  "name": "todo_create",
  "status": "draft",
  "riskLevel": "MEDIUM",
  "message": "Awaiting human approval"
}
```

### Status: `rejected`

Tool failed policy validation or human rejected it. Cannot be used.

```
Indicators:
- ❌ Failed policy check (e.g., command blocked)
- OR: ❌ Human rejected after review
- ❌ NOT executable
- ❌ Marked as rejected
```

**Example in response:**
```json
{
  "name": "file_reader",
  "status": "rejected",
  "riskLevel": "CRITICAL",
  "reason": "Command tools are blocked by policy. Use HTTP endpoints instead."
}
```

---

## Understanding Risk Levels

Risk level indicates **potential impact** if the tool is misused or exploited:

### Risk Level: `LOW`

**When:** Read-only HTTP GET to public APIs

```yaml
execution:
  type: http
  method: GET
  url: "https://api.github.com/users/{username}"
```

**Why LOW:**
- ✅ No data modification
- ✅ Public API (no secrets)
- ✅ Limited impact even if exposed
- ✅ Auto-approved, no human approval needed

---

### Risk Level: `MEDIUM`

**When:** Data modification via HTTP POST/PUT

```yaml
execution:
  type: http
  method: POST
  url: "https://api.slack.com/api/chat.postMessage"
```

**Why MEDIUM:**
- ⚠️ Can modify data (send messages, create issues)
- ⚠️ Requires credentials (API key)
- ⚠️ Requires human review before execution
- ✅ Policy allows it (HTTP only)

---

### Risk Level: `HIGH`

**When:** Access to sensitive APIs or complex operations

```yaml
execution:
  type: http
  method: DELETE
  url: "https://api.github.com/repos/{owner}/{repo}"
```

**Why HIGH:**
- ⚠️ Destructive operation (deletion)
- ⚠️ Affects multiple users
- ⚠️ Hard to undo
- ✅ Policy allows it (HTTP only)
- ⚠️ Requires careful human review

---

### Risk Level: `CRITICAL`

**When:** Shell commands, code execution, or policy violations

```yaml
execution:
  type: command
  command: bash
  args: ["-c", "{user_command}"]
```

**Why CRITICAL:**
- ❌ Full system access
- ❌ Can read/write files, modify system
- ❌ Cannot be restricted
- ❌ Policy blocks (allowCommandTools: false)
- ❌ Always rejected

---

## Query Examples

### Example 1: List All Tools in a Directory

```
Call: matimo_list_user_tools(target_dir="/tmp/matimo-tools")

What you'll see:
- All tools created in that directory
- Their current status (approved/draft/rejected)
- Risk level and reason (if rejected)
- Execution type and requirements
```

### Example 2: Check Which Tools Are Approved

Agent logic:
```
Call: matimo_list_user_tools(target_dir="/tmp/matimo-tools")
Filter: tools where status === "approved"
Result: Only ready-to-use tools
```

**Use case:** "What tools can I use right now?"

### Example 3: Check Why a Tool Was Rejected

Agent logic:
```
Call: matimo_list_user_tools(target_dir="/tmp/matimo-tools")
Find: tool named "file_reader"
Check: status === "rejected"
Read: tool.reason
Output: "Command tools are blocked by policy"
```

**Use case:** "Why doesn't file_reader work?"

### Example 4: Understand Tool Capabilities

Agent logic:
```
Call: matimo_list_user_tools(target_dir="/tmp/matimo-tools")
For each tool:
  - executionType: "http" or "command" or "function"
  - riskLevel: "LOW" to "CRITICAL"
  - requiresApproval: true/false

Decision: Which tools match my goal?
```

**Use case:** "What operations can I do?"

---

## Complete Tool Information

When `matimo_list_user_tools` returns a tool, it includes:

```json
{
  "name": "github_create_issue",         // Unique identifier
  "version": "1.0.0",                    // Semantic version
  "description": "Create an issue...",   // What it does
  "status": "approved",                  // approved | draft | rejected
  "riskLevel": "MEDIUM",                 // LOW | MEDIUM | HIGH | CRITICAL
  "createdAt": "2026-03-17T10:30:00Z",   // When created
  "executionType": "http",               // http | command | function
  "requiresApproval": false,             // approval needed for execution?
  "reason": null,                        // If rejected, why
  "approvedBy": "human-operator",        // Who approved it
  "approvedAt": "2026-03-17T10:31:00Z",  // When approved
  "parameters": {                        // Input parameters
    "owner": { "type": "string", "required": true },
    "repo": { "type": "string", "required": true },
    "title": { "type": "string", "required": true }
  }
}
```

---

## Common Discovery Patterns

### Pattern 1: Report on All Tools

Agent goal: "What tools has the system created?"

```
Call: matimo_list_user_tools(target_dir=<providedDir>)
Output each tool:
  - Name and description
  - Status (✅ approved or ❌ rejected)
  - Risk level

Summary: "System has 3 tools: 2 approved, 1 rejected"
```

### Pattern 2: Find Tools Ready to Use

Agent goal: "What can I execute right now?"

```
Call: matimo_list_user_tools(target_dir=<dir>)
Filter: status === "approved" AND riskLevel !== "CRITICAL"
Then: User can safely call matimo.execute(toolName, params)
```

### Pattern 3: Understand Why Tool Was Rejected

Agent goal: "Can I fix the rejected file_reader tool?"

```
Call: matimo_list_user_tools(target_dir=<dir>)
Find: "file_reader"
Read: reason = "Command tools are blocked by policy"
Learn: "I can't fix this; policy is immutable. I need HTTP instead."
```

### Pattern 4: Summarize Safety Status

Agent goal: "Is the tool environment safe?"

```
Call: matimo_list_user_tools(target_dir=<dir>)
Count: CRITICAL-level tools
If count === 0:
  Result: ✅ "Safe—no critical-risk tools"
If count > 0:
  Result: ⚠️ "Unsafe—{count} high-risk tools present"
```

---

## Meta-Tool: matimo_list_skills

Lists available **skills** (domain knowledge files) in the system.

```
Call: matimo_list_skills()

Response:
{
  "skills": [
    {
      "name": "tool-creation",
      "description": "Create tools for the Matimo SDK...",
      "category": "Tool Development",
      "difficulty": "intermediate"
    },
    {
      "name": "meta-tools-lifecycle",
      "description": "Master the tool lifecycle workflow...",
      "category": "Tool Lifecycle",
      "difficulty": "advanced"
    },
    {
      "name": "policy-validation",
      "description": "Security rules and enforcement...",
      "category": "Security & Policy",
      "difficulty": "intermediate"
    }
  ],
  "summary": {
    "total": 3,
    "byCategory": {
      "Tool Development": 1,
      "Tool Lifecycle": 1,
      "Security & Policy": 1
    }
  }
}
```

### When to Use Skills

```
Agent: "I need to learn how to create a tool"
Agent: matimo_list_skills()
Agent: "I found 'tool-creation' skill. Let me apply it to my task."
Result: Agent generates better YAML with complete structure
```

---

## Meta-Tool: matimo_get_tool_status

Gets detailed status of a specific tool.

```
Call: matimo_get_tool_status(toolName="weather_fetch", target_dir="/tmp/tools")

Response:
{
  "name": "weather_fetch",
  "status": "approved",
  "details": {
    "createdAt": "2026-03-17T10:30:00Z",
    "approvedAt": "2026-03-17T10:31:00Z",
    "approvedBy": "human-operator",
    "integrityHash": "sha256:abc123...",
    "tamperDetected": false,
    "lastExecutedAt": "2026-03-17T10:45:00Z",
    "executionCount": 5
  }
}
```

---

## Workflow: From Creation to Discovery

```
1. Agent creates tool
   matimo_create_tool(name="weather_fetch", yaml, dir)
   Result: ✅ Created, status="draft"

2. Agent validates with doctor
   matimo_doctor(yaml)
   Result: ✅ Valid, no policy errors

3. Human approves via review
   matimo_review(name="weather_fetch", dir)
   Result: ✅ Approved, status="approved"

4. Agent reloads registry
   matimo_reload_tools(dir)
   Result: ✅ Reloaded

5. Agent lists to verify
   matimo_list_user_tools(dir)
   Result: ✅ "weather_fetch" appears with status="approved"

6. Agent uses the tool
   matimo.execute("weather_fetch", {city: "New York"})
   Result: ✅ Tool executes, returns weather data
```

---

## Key Principles

1. ✅ **Status is authoritative** — How matimo_list_user_tools reports it is the truth
2. ✅ **Risk level guides decisions** — Don't assume LOW-risk tools are safe; always understand what they do
3. ✅ **Rejection is immutable** — If rejected by policy, it cannot be used (policy is frozen)
4. ✅ **Approval lasts through session** — Approved tool stays approved until session ends
5. ✅ **Metadata is useful** — createdAt, approvedBy, executionCount help understand tool history

---

## References

- **Tool creation**: See `tool-creation` skill
- **Tool lifecycle**: See `meta-tools-lifecycle` skill
- **Policy validation**: See `policy-validation` skill

---

**Last Updated:** March 2026  
**Status:** Complete  
**Level:** Beginner
