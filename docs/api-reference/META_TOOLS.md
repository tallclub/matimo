# Meta-Tools Reference

> Complete reference for all built-in Matimo meta-tools — the tools that manage other tools.

## Overview

Meta-tools are built-in tools that live in `packages/core/tools/` and provide tool lifecycle management capabilities. They allow agents (LangChain, MCP, SDK) to create, validate, approve, reload, and discover tools at runtime.

| Meta-Tool | Purpose | Requires Approval |
|-----------|---------|:-----------------:|
| [`matimo_validate_tool`](#matimo_validate_tool) | Validate YAML against schema + policy rules | No |
| [`matimo_create_tool`](#matimo_create_tool) | Write a new tool definition to disk | Yes |
| [`matimo_approve_tool`](#matimo_approve_tool) | Promote a draft tool to approved status | Yes |
| [`matimo_reload_tools`](#matimo_reload_tools) | Hot-reload all tools into the live registry | Yes |
| [`matimo_list_user_tools`](#matimo_list_user_tools) | List tools in a directory with metadata | No |
| [`matimo_get_tool_status`](#matimo_get_tool_status) | Get status, risk level, and approval state of a tool | Yes |
| [`matimo_create_skill`](#matimo_create_skill) | Create a SKILL.md file with validated frontmatter | Yes |
| [`matimo_list_skills`](#matimo_list_skills) | List skills in a directory with metadata | No |
| [`matimo_get_skill`](#matimo_get_skill) | Read a skill's full content by name | No |
| [`matimo_validate_skill`](#matimo_validate_skill) | Validate a skill against the Agent Skills spec | No |

> **Note on `matimo_doctor`:** Examples, prompts, and older docs may refer to `matimo_doctor`. This is an informal human-readable alias for `matimo_validate_tool` — it is **not a separate tool**. The actual registered tool name you must use in `matimo.execute()` is `matimo_validate_tool`.

> 💡 **New to meta-tools?** See [When to Use Which Meta-Tool](#when-to-use-which-meta-tool) for decision guides and typical agent workflows before diving into individual tool references.

**Common tags:** All meta-tools are tagged with `matimo` and `meta`.

---

## When to Use Which Meta-Tool

### Decision Guide: Tool Lifecycle

```
I want to...
  ├─ Check if my YAML is safe before doing anything  →  matimo_validate_tool
  ├─ Write a new tool to disk                        →  matimo_create_tool
  ├─ Promote a draft to production-ready             →  matimo_approve_tool
  ├─ Make newly created/approved tools available     →  matimo_reload_tools
  ├─ See what tools an agent has created             →  matimo_list_user_tools
  └─ Check a specific tool's approval state          →  matimo_get_tool_status
```

### Decision Guide: Skills Lifecycle

```
I want to...
  ├─ Discover what skills are available              →  matimo_list_skills
  ├─ Read the full content of a skill                →  matimo_get_skill
  ├─ Create a new SKILL.md at runtime                →  matimo_create_skill
  └─ Check if a skill follows the Agent Skills spec  →  matimo_validate_skill
```

### Use Cases by Meta-Tool

| Meta-Tool | When to Use | What Happens If You Skip It |
|-----------|-------------|-----------------------------|
| `matimo_validate_tool` | Before `matimo_create_tool` — catch errors early without writing to disk | Tool creation may fail mid-write with a less clear error |
| `matimo_create_tool` | Agent proposes a new capability (weather lookup, data fetch) | Tool never exists; agent can't use the new capability |
| `matimo_approve_tool` | After creation — promote draft to usable state | Tool stays in `draft` status; `matimo_reload_tools` won't load it |
| `matimo_reload_tools` | After create+approve — make new tools available without restart | Agent can't call the new tool until the process is restarted |
| `matimo_list_user_tools` | Agent wants to audit what it has created this session | Agent re-creates duplicates, wastes tool slots |
| `matimo_get_tool_status` | Before using a tool the agent created — verify it's approved | Agent calls a draft tool and hits an approval gate error |
| `matimo_list_skills` | At session start or when agent needs domain knowledge | Agent misses available expertise, gives generic responses |
| `matimo_get_skill` | When agent needs specific domain knowledge for a task | Agent works without guidelines, prone to API misuse |
| `matimo_create_skill` | Team wants to package reusable agent expertise | Knowledge scattered in system prompts, not reusable |
| `matimo_validate_skill` | After creating a skill — verify spec compliance | Skill may fail to load or have invalid frontmatter silently |

### Typical Agent Workflows

**Workflow A — Agent creates and uses a new tool (full lifecycle)**
```
1. matimo_validate_tool   → Check YAML is safe (no approval needed)
2. matimo_create_tool     → Write draft to disk (needs human ✅)
3. matimo_approve_tool    → Promote to approved (needs human ✅)
4. matimo_reload_tools    → Load into live registry (needs human ✅)
5. matimo.execute(name)   → Use the tool
```

**Workflow B — Agent discovers and applies skills**
```
1. matimo_list_skills     → See available skills (free — no approval)
2. matimo_get_skill       → Load the relevant one (free — no approval)
3. Agent applies guidelines from skill content in its response
```

**Workflow C — Agent audits what it built**
```
1. matimo_list_user_tools  → List all tools created this session
2. matimo_get_tool_status  → Check approval state for each tool
3. matimo_reload_tools     → Ensure approved tools are live
```

---

## matimo_validate_tool

> **Alias:** Also informally called `matimo_doctor` in examples and prompts. The registered tool name is always `matimo_validate_tool`.

Validate a tool definition YAML string against the Matimo schema and policy rules. Returns schema errors, policy violations, and risk classification.

**Does not require approval** — safe for agents to call freely.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|:--------:|-------------|
| `yaml_content` | string | Yes | The YAML content of the tool definition to validate |

### Response

```typescript
{
  valid: boolean;           // true if tool passes all checks
  schemaErrors: string[];   // Zod schema validation errors
  policyViolations: Array<{
    rule: string;           // e.g., 'no-command-execution'
    severity: string;       // 'critical' | 'high' | 'medium' | 'low'
    message: string;        // Human-readable explanation
  }>;
  riskLevel: string;        // 'low' | 'medium' | 'high' | 'critical'
}
```

### Example

```typescript
const result = await matimo.execute('matimo_validate_tool', {
  yaml_content: `
name: my_api_tool
version: '1.0.0'
description: Fetch data from an API
parameters:
  query:
    type: string
    required: true
execution:
  type: http
  method: GET
  url: 'https://api.example.com/search?q={query}'
`,
});

// {
//   valid: true,
//   schemaErrors: [],
//   policyViolations: [],  // medium: force-approval, force-draft-status (non-blocking)
//   riskLevel: 'low'
// }
```

### What It Checks

1. **YAML syntax** — can the content be parsed?
2. **Schema validation** — does it match the `ToolDefinition` Zod schema? (name, version, description, execution, parameters)
3. **Content rules** — runs all 9 content validator rules (see [POLICY_AND_LIFECYCLE.md](POLICY_AND_LIFECYCLE.md#9-security-rules))
4. **Risk classification** — assigns risk level based on execution type and HTTP method

### Error Cases

| Scenario | `valid` | Response |
|----------|:-------:|----------|
| Invalid YAML syntax | `false` | `schemaErrors: ["YAML parse error: ..."]` |
| Missing required fields | `false` | `schemaErrors: ["Schema validation failed: ..."]` |
| Command tool (blocked by policy) | `false` | `policyViolations: [{ rule: "no-command-execution", severity: "critical" }]` |
| SSRF attempt | `false` | `policyViolations: [{ rule: "no-ssrf", severity: "critical" }]` |
| Valid HTTP GET tool | `true` | `riskLevel: "low"` |

---

## matimo_create_tool

Create a new tool definition on disk. Validates the YAML, forces draft status and `requires_approval: true`, and writes the tool to the target directory.

**Requires approval** — human must confirm before tool is written to disk.

### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|:--------:|---------|-------------|
| `name` | string | Yes | — | Name for the new tool (snake_case) |
| `yaml_content` | string | Yes | — | The YAML content of the tool definition |
| `target_dir` | string | No | `./matimo-tools` | Directory to create the tool in |
| `proposed_by` | string | No | — | Identifier of who proposed this tool |
| `justification` | string | No | — | Reason for creating this tool |

### Response

```typescript
// Success
{
  success: true,
  path: './agent-tools/weather/definition.yaml',
  riskLevel: 'low',
  status: 'draft',
  message: 'Tool created as draft. Use matimo_approve_tool to promote.'
}

// Failure
{
  success: false,
  message: 'Tool failed policy validation',
  errors: ['[critical] no-command-execution: Command-type tools are not allowed']
}
```

### Example

```typescript
const result = await matimo.execute('matimo_create_tool', {
  name: 'city_lookup',
  target_dir: './agent-tools',
  proposed_by: 'agent-1',
  justification: 'User requested city information lookup',
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
```

### Safety Enforcement

The following fields are **always forced** regardless of what the YAML contains:

| Field | Forced Value | Why |
|-------|-------------|-----|
| `name` | `params.name` | Prevents name mismatch |
| `requires_approval` | `true` | Agent-created tools must be approved |
| `status` | `'draft'` | Agent-created tools start as draft |

### Auto-Approval for Low-Risk GET Tools

`matimo_create_tool` classifies risk at creation time. **HTTP GET tools targeting approved domains** are classified as `low` risk and receive `approvalState: 'auto-approved'` immediately — they still start as `status: 'draft'` and must go through `matimo_approve_tool`, but the human approval step produces an immediate approval rather than a pending review. All other tools start as `approvalState: 'pending'`.

| Execution Type | Method | `riskLevel` | `approvalState` after create |
|---------------|--------|-------------|-------------------------------|
| `http` | GET | `low` | `auto-approved` |
| `http` | POST/PUT/DELETE | `medium` | `pending` |
| `http` with auth headers | any | `high` | `pending` |
| `command` / `function` | — | blocked by policy | — |

### Name Validation

The tool name is sanitized to prevent security issues:

| Check | Blocked Pattern | Example |
|-------|----------------|---------|
| Path traversal | `../`, `..\\` | `../../etc/passwd` |
| Backslash | `\` | `tools\backdoor` |
| Control characters | `\x00`-`\x1f` | Null bytes, newlines |
| Reserved namespace | `matimo_*` | `matimo_backdoor` |
| Empty/whitespace | `""`, `" "` | Blank names |

### Internal Flow

1. Sanitize name (reject invalid patterns)
2. Parse YAML (reject syntax errors)
3. Force `name`, `requires_approval: true`, `status: 'draft'`
4. Validate against `ToolDefinition` Zod schema
5. Run content validator (9 rules)
6. Reject if any `critical` or `high` severity violations
7. Classify risk level
8. Create directory `{target_dir}/{name}/`
9. Write `definition.yaml` (with optional proposer/justification comments)

### Output on Disk

```
agent-tools/
  city_lookup/
    definition.yaml     ← Created by matimo_create_tool
```

The written YAML will include the forced safety fields:

```yaml
# Proposed by: agent-1
# Justification: User requested city information lookup

name: city_lookup
version: '1.0.0'
description: Look up user information including city and address details
requires_approval: true
status: draft
parameters:
  id:
    type: string
    required: true
    description: User ID to look up (1-10)
execution:
  type: http
  method: GET
  url: 'https://jsonplaceholder.typicode.com/users/{id}'
```

---

## matimo_approve_tool

Approve a draft tool for production use. Re-validates the tool, signs with HMAC, and updates the approval manifest.

**Requires approval** — human must confirm before tool is promoted.

### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|:--------:|---------|-------------|
| `name` | string | Yes | — | Name of the tool to approve |
| `tool_dir` | string | No | `./matimo-tools` | Directory containing the tool |

### Response

```typescript
// Success
{
  success: true,
  name: 'city_lookup',
  hash: 'sha256:a1b2c3d4e5f6...',
  approvedAt: '2026-03-14T09:30:00.000Z',
  message: 'Tool approved. Effective after reload or immediately if auto-reload is active.'
}

// Failure
{
  success: false,
  message: 'Tool has policy violations that must be resolved before approval'
}
```

### Example

```typescript
const result = await matimo.execute('matimo_approve_tool', {
  name: 'city_lookup',
  tool_dir: './agent-tools',
});
```

### Internal Flow

1. Read `{tool_dir}/{name}/definition.yaml`
2. Parse and validate against Zod schema
3. **Re-run content validator** (prevents approve-after-modify attacks)
4. Reject if any `critical` or `high` violations remain
5. Compute SHA-256 hash of the YAML content
6. Create HMAC signature using `MATIMO_APPROVAL_SECRET` (or random UUID)
7. Store approval in `.matimo-approvals.json`
8. Update YAML: `status: draft` → `status: approved`
9. Write updated YAML to disk

### Approval Manifest File

Created at `{tool_dir}/.matimo-approvals.json`:

```json
{
  "city_lookup": {
    "hash": "sha256:a1b2c3d4e5f6...",
    "signature": "hmac-sha256:...",
    "approvedAt": "2026-03-14T09:30:00.000Z",
    "approvedBy": "system"
  }
}
```

### Tamper Detection

If the YAML is modified after approval:

1. On next `matimo_approve_tool` or `reloadTools()`, the hash is recomputed
2. New hash ≠ stored hash → approval is invalid
3. Tool must be re-approved

---

## matimo_reload_tools

Hot-reload all tools from configured `toolPaths`. Clears the registry, re-reads YAML definitions from disk, re-validates untrusted tools against the active policy, and returns a summary.

**Requires approval** — human must confirm before registry is rebuilt.

### Parameters

No parameters required. The tool uses the `toolPaths` and `untrustedPaths` configured during `MatimoInstance.init()`.

### Response

```typescript
{
  success: true,
  loaded: 13,        // Total tools now in registry
  removed: 0,        // Tools that were in registry but no longer on disk
  revalidated: 1,    // Untrusted tools that were re-checked against policy
  rejected: [],      // Tool names that failed policy and were not loaded
  message: 'Reload complete. 13 tools loaded, 0 removed, 0 rejected.'
}
```

### Example

```typescript
// Via meta-tool (works from SDK, LangChain, and MCP)
const result = await matimo.execute('matimo_reload_tools', {});

// Or programmatically (SDK only)
const reloadResult = await matimo.reloadTools();
```

### Why This Meta-Tool Exists

Without `matimo_reload_tools`, the create→approve→reload→use lifecycle could only be completed from SDK code (`matimo.reloadTools()`). MCP clients and LangChain agents had no way to trigger a reload.

With this meta-tool:

| Interface | Reload Method |
|-----------|:-------------|
| SDK | `matimo.reloadTools()` or `matimo.execute('matimo_reload_tools', {})` |
| LangChain | Agent calls `matimo_reload_tools` as a tool |
| MCP | Client calls `tools/call` with `name: "matimo_reload_tools"` |

### Internal Flow (Interception Pattern)

This tool uses a special interception pattern. Unlike other meta-tools that execute via the `FunctionExecutor`, `matimo_reload_tools` is intercepted directly in `MatimoInstance.execute()`:

```
matimo.execute('matimo_reload_tools', {})
  │
  ├─ Policy check (canExecute)
  ├─ Approval check (requires_approval: true)
  │
  ▼ Intercepted BEFORE executor routing
  │
  this.reloadTools()  ← Called directly on the instance
  │
  ▼ Returns ReloadResult formatted as tool response
```

**Why interception?** The `FunctionExecutor` doesn't have a reference to the `MatimoInstance`, so it can't call `this.reloadTools()`. The interception happens after all policy and approval checks, so security is fully enforced.

### After Reload (LangChain)

After calling `matimo_reload_tools`, LangChain agents must rebind their tools:

```typescript
// Reload registry
await matimo.execute('matimo_reload_tools', {});

// Rebind LangChain tools (registry changed)
const updatedTools = matimo.listTools() as ToolDefinition[];
const langchainTools = await convertToolsToLangChain(updatedTools, matimo);
llmWithTools = llm.bindTools(langchainTools);
```

### After Reload (MCP)

MCP reload automatically sends a `notifications/tools/list_changed` notification to connected clients, prompting them to re-fetch the tool list.

---

## matimo_get_tool_status

Get the current status, risk level, and approval state of a specific tool by name. Works for both draft and approved tools.

**Requires approval** — reads from the approval manifest (sensitive metadata).

### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|:--------:|---------|-------------|
| `name` | string | Yes | — | Name of the tool to check |
| `tool_dir` | string | No | `./matimo-tools` | Directory containing the tool |

### Response

```typescript
// Tool found
{
  found: true,
  name: 'weather_fetch',
  status: 'approved',          // 'draft' | 'approved'
  riskLevel: 'low',            // 'low' | 'medium' | 'high' | 'critical'
  approvalState: 'approved',   // 'pending' | 'auto-approved' | 'approved'
  approvedAt: '2026-03-14T09:30:00.000Z',
  approvedBy: 'system',
  message: 'Tool "weather_fetch" is approved and ready for use.'
}

// Tool not found
{
  found: false,
  name: 'nonexistent',
  message: 'Tool "nonexistent" not found at ./matimo-tools/nonexistent/definition.yaml'
}
```

### Example

```typescript
const result = await matimo.execute('matimo_get_tool_status', {
  name: 'weather_fetch',
  tool_dir: './agent-tools',
});

if (result.found) {
  console.log(`Status: ${result.status}, Risk: ${result.riskLevel}`);
}
```

---

## matimo_list_user_tools

List all user-created tools in a directory with risk classification, approval status, and metadata.

**Does not require approval** — safe for agents to call freely.

### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|:--------:|---------|-------------|
| `tool_dir` | string | No | `./matimo-tools` | Directory to scan for tools |
| `include_drafts` | boolean | No | `true` | Whether to include draft tools |

### Response

```typescript
{
  tools: [
    {
      name: 'city_lookup',
      description: 'Look up city information',
      version: '1.0.0',
      status: 'approved',
      riskLevel: 'low',
      tags: []
    },
    {
      name: 'weather',
      description: 'Get current weather',
      version: '1.0.0',
      status: 'draft',
      riskLevel: 'low',
      tags: ['weather']
    }
  ],
  total: 2
}
```

### Example

```typescript
// List all tools (including drafts)
const result = await matimo.execute('matimo_list_user_tools', {
  tool_dir: './agent-tools',
});

// List only approved tools
const approvedOnly = await matimo.execute('matimo_list_user_tools', {
  tool_dir: './agent-tools',
  include_drafts: false,
});
```

### Internal Flow

1. Check if `tool_dir` exists (return empty if not)
2. Scan directory entries
3. For each subdirectory, look for `definition.yaml`
4. Parse YAML + validate against schema
5. Classify risk level
6. Filter by `include_drafts` flag
7. Return tool summaries

### Error Handling

- If a tool's YAML is invalid, it's skipped with a warning log (doesn't fail the entire listing)
- If `tool_dir` doesn't exist, returns `{ tools: [], total: 0 }`

---

## matimo_create_skill

Create a new skill definition (SKILL.md) on disk. Validates YAML frontmatter and writes the file to the target directory.

**Requires approval** — human must confirm before skill is written.

### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|:--------:|---------|-------------|
| `name` | string | Yes | — | Name for the new skill (alphanumeric, hyphens, underscores) |
| `content` | string | Yes | — | Markdown content with YAML frontmatter |
| `target_dir` | string | No | `./matimo-tools/skills` | Directory to create the skill in |

### Response

```typescript
// Success
{
  success: true,
  path: './matimo-tools/skills/my-skill/SKILL.md',
  message: 'Skill created successfully.'
}

// Failure
{
  success: false,
  message: 'YAML frontmatter must include a "description" field'
}
```

### Example

```typescript
const result = await matimo.execute('matimo_create_skill', {
  name: 'data-analysis',
  content: `---
name: data-analysis
description: Analyze datasets using statistical methods
---

# Data Analysis Skill

This skill enables statistical analysis of tabular datasets.

## Capabilities

- Descriptive statistics (mean, median, mode, std deviation)
- Correlation analysis
- Trend detection
`,
});
```

### Frontmatter Requirements

The content must start with YAML frontmatter (`---`) containing at least:

| Field | Required | Description |
|-------|:--------:|-------------|
| `name` | Yes | Skill name (must be in frontmatter) |
| `description` | Yes | What the skill does |

### Name Validation

Same as `matimo_create_tool`:
- No path traversal (`../`)
- No backslashes
- No control characters
- No empty/whitespace-only names

### Output on Disk

```
matimo-tools/
  skills/
    data-analysis/
      SKILL.md          ← Created by matimo_create_skill
```

---

## matimo_list_skills

List all skills (SKILL.md files) in a directory. Returns each skill's name, description, and file path from its YAML frontmatter.

**Does not require approval** — read-only operation.

### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|:--------:|---------|-------------|
| `skills_dir` | string | No | `./matimo-tools/skills` | Directory to scan for skills |

### Response

```typescript
{
  skills: [
    {
      name: 'code-review',
      description: 'Code review checklist and best practices',
      path: './matimo-tools/skills/code-review/SKILL.md'
    },
    {
      name: 'security-checklist',
      description: 'Security vulnerability detection checklist',
      path: './matimo-tools/skills/security-checklist/SKILL.md'
    }
  ],
  total: 2
}
```

### Example

```typescript
const result = await matimo.execute('matimo_list_skills', {
  skills_dir: './my-skills',
});
// result.skills → array of { name, description, path }
// result.total → number of skills found
```

### Behavior

1. Check if `skills_dir` exists (return empty if not)
2. Scan directory entries
3. For each subdirectory, look for `SKILL.md`
4. Parse YAML frontmatter for `name` and `description`
5. Skip skills with missing frontmatter fields (warning logged)
6. Return skill summaries

---

## matimo_get_skill

Read the full content of a skill (SKILL.md) by name. Returns the skill's frontmatter metadata and complete markdown content so the agent can use it as instructions or context.

**Does not require approval** — read-only operation.

### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|:--------:|---------|-------------|
| `name` | string | Yes | — | Name of the skill (matches the skill's directory name) |
| `skills_dir` | string | No | `./matimo-tools/skills` | Directory containing skills |

### Response

```typescript
// Success
{
  success: true,
  name: 'code-review',
  description: 'Code review checklist and best practices',
  content: '---\nname: code-review\ndescription: ...\n---\n\n# Code Review Checklist\n...',
  path: './matimo-tools/skills/code-review/SKILL.md',
  message: 'Skill retrieved successfully.'
}

// Failure
{
  success: false,
  message: 'Skill "nonexistent" not found at ./matimo-tools/skills/nonexistent/SKILL.md'
}
```

### Example

```typescript
const result = await matimo.execute('matimo_get_skill', {
  name: 'code-review',
  skills_dir: './my-skills',
});

if (result.success) {
  // The agent can now read result.content and apply the skill's guidelines
  console.log(result.content);
}
```

### Name Validation

Spec-compliant name rules:
- Lowercase letters, numbers, and hyphens only
- 1–64 characters
- No leading/trailing hyphens
- No consecutive hyphens
- Must match the skill's directory name

---

## matimo_validate_skill

Validate an existing skill against the [Agent Skills specification](https://agentskills.io/specification). Checks SKILL.md existence, frontmatter validity, name rules, and directory structure.

**Does not require approval** — read-only validation.

### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|:--------:|---------|-------------|
| `name` | string | Yes | — | Name of the skill to validate |
| `skills_dir` | string | No | `./matimo-tools/skills` | Directory containing skills |

### Response

```typescript
// Valid skill
{
  valid: true,
  name: 'code-review',
  issues: [],
  structure: {
    has_skill_md: true,
    resources: { scripts: [], references: [], assets: [], other: [] }
  },
  message: 'Skill "code-review" is valid.'
}

// Invalid skill
{
  valid: false,
  name: 'Bad_Name',
  issues: [
    { level: 'error', message: 'Name contains invalid characters...' },
    { level: 'error', message: 'Skill name "Bad_Name" does not match directory name...' }
  ],
  structure: { has_skill_md: true, resources: { ... } },
  message: 'Skill "Bad_Name" has 2 issue(s).'
}
```

### Example

```typescript
const result = await matimo.execute('matimo_validate_skill', {
  name: 'code-review',
  skills_dir: './my-skills',
});

if (result.valid) {
  console.log('Skill is spec-compliant!');
} else {
  console.log('Issues:', result.issues);
}
```

---

## Usage Across Interfaces

All meta-tools work consistently across SDK (TypeScript or Python), LangChain, and MCP:

### TypeScript SDK

```typescript
const result = await matimo.execute('matimo_validate_tool', { yaml_content: '...' });
```

### Python SDK

```python
from matimo import Matimo

matimo = await Matimo.init('./tools')

# Validate a tool definition
result = await matimo.execute('matimo_validate_tool', {'yaml_content': '...'})
print(result['valid'], result['riskLevel'])

# Full lifecycle from Python
validate  = await matimo.execute('matimo_validate_tool',  {'yaml_content': yaml_str})
create    = await matimo.execute('matimo_create_tool',    {'name': 'my_tool', 'yaml_content': yaml_str, 'target_dir': './agent-tools'})
approve   = await matimo.execute('matimo_approve_tool',   {'name': 'my_tool', 'tool_dir': './agent-tools'})
reload    = await matimo.execute('matimo_reload_tools',   {})
status    = await matimo.execute('matimo_get_tool_status',{'name': 'my_tool', 'tool_dir': './agent-tools'})
```

> See [`python/examples/native/meta_flow/meta_tools_integration.py`](../../python/examples/native/meta_flow/meta_tools_integration.py) for a complete end-to-end Python demo covering all 10 meta-tools.
> Run it with: `cd python && make meta-flow`

### LangChain

The LLM decides which meta-tool to call based on the conversation:

```
User: "Create a weather lookup tool"
Agent → matimo_validate_tool (check YAML)
Agent → matimo_create_tool (write to disk)
Agent → matimo_approve_tool (promote status)
Agent → matimo_reload_tools (load into registry)
Agent → weather_lookup (use the new tool)
```

### MCP

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "matimo_validate_tool",
    "arguments": {
      "yaml_content": "name: my_tool\n..."
    }
  }
}
```

For tools with `requires_approval: true`, MCP clients must include `_matimo_approved: true`:

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "matimo_create_tool",
    "arguments": {
      "name": "my_tool",
      "yaml_content": "...",
      "_matimo_approved": true
    }
  }
}
```

---

## File Locations

All meta-tools are located in `packages/core/tools/`:

```
packages/core/tools/
  matimo_validate_tool/
    definition.yaml
    matimo_validate_tool.ts
  matimo_create_tool/
    definition.yaml
    matimo_create_tool.ts
  matimo_approve_tool/
    definition.yaml
    matimo_approve_tool.ts
  matimo_reload_tools/
    definition.yaml
    matimo_reload_tools.ts
  matimo_list_user_tools/
    definition.yaml
    matimo_list_user_tools.ts
  matimo_create_skill/
    definition.yaml
    matimo_create_skill.ts
  matimo_list_skills/
    definition.yaml
    matimo_list_skills.ts
  matimo_get_skill/
    definition.yaml
    matimo_get_skill.ts
  matimo_validate_skill/
    definition.yaml
    matimo_validate_skill.ts
  shared/
    skill-validation.ts
```

---

## See Also

- [Policy & Lifecycle Guide](POLICY_AND_LIFECYCLE.md) — Complete policy engine and lifecycle documentation
- [Tool Specification](../tool-development/TOOL_SPECIFICATION.md) — YAML tool definition format reference
- [Adding Tools](../tool-development/ADDING_TOOLS.md) — How to add new tool providers
- [Approval System](APPROVAL-SYSTEM.md) — Approval handler configuration
