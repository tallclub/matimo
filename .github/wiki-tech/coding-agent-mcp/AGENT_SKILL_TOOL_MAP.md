# Matimo Agent-Skill-Tool Hierarchy

## Overview

```
User Request
    ↓
Agent (matimo-tool-creator-refactored.agent.md)
    ↓
Skill (matimo-provider-creation/SKILL.md)
    ↓
Matimo MCP Tools (matimo_create_tool, matimo_validate_tool, etc.)
    ↓
Generated Tool in Codebase ✅
```

---

## Agent: `matimo-tool-creator-refactored.agent.md`

**Purpose**: Orchestrate provider package creation for both TypeScript AND Python

**Responsibilities**:
- ✅ Clarify requirements
- ✅ Reference skill for patterns
- ✅ Call Matimo MCP tools for scaffolding
- ✅ Coordinate validation
- ✅ Report results

**Key Insight**: Agent is intentionally thin. All technical details in the skill.

---

## Skill: `matimo-provider-creation/SKILL.md`

**Purpose**: Teach patterns and standards for both SDKs (TS & Python)

**Contains**:
- § Part 1: Provider structure (layouts for TS & Python)
- § Part 2: Tool YAML definitions (identical format)
- § Part 3: Authentication patterns (4 types)
- § Part 4: TypeScript testing standards
- § Part 5: Python testing standards
- § Part 6: Matimo tool usage guide
- § Part 7: Side-by-side code examples (TS vs Python)
- § Part 8: README template

**Key Insight**: This is the source of truth for what to generate.

---

## Matimo MCP Tools: Used by Agent

| Tool | Via MCP | Purpose | When to Use |
|------|---------|---------|-------------|
| `matimo_create_tool` | POST to 3101 | Generate tool YAML with validation | Scaffolding new tool definitions |
| `matimo_validate_tool` | POST to 3101 | Validate existing tool YAML | After each tool creation |
| `matimo_create_skill` | POST to 3101 | Generate skill documentation | Creating provider skill docs |
| `matimo_reload_tools` | POST to 3101 | Load new tools into registry | After creating tools |
| `execute` | POST to 3101 | Run commands (test, lint, git) | Validation, testing, commits |
| `search` | POST to 3101 | Search for patterns in codebase | Finding existing tool examples |

**Key Insight**: Agent uses these to scaffold and validate — no manual writing.

---

## Workflow Example: Create GitHub Tool to List PRs

### Step 1: User Gives Request
```
"Create a GitHub tool to list pull requests"
```

### Step 2: Agent Loads Skill
```
Agent reads: .github/skills/matimo-provider-creation/SKILL.md
Sections to reference:
  - § Part 1: GitHub provider structure
  - § Part 2: HTTP tool definition format
  - § Part 3: Bearer token authentication
  - § Part 7: GitHub examples (if available)
```

### Step 3: Agent Retrieves API Docs
```
Agent fetches: https://docs.github.com/en/rest/pulls/pulls?apiVersion=2022-11-28
Extracts: Endpoint, method, parameters, response schema
```

### Step 4: Agent Uses Matimo Tools to Create

**Generate Tool #1: github_list_pull_requests**
```
Tool: matimo_create_tool (MCP)
Input: {
  name: "github-list-pull-requests",
  yaml_content: "name: github_list_pull_requests\n..." (from Skill § Part 2),
  justification: "Query pull requests from GitHub repo",
  proposed_by: "Agent"
}
Output: ✅ YAML created at:
  - TypeScript: packages/github/tools/github-list-pull-requests/definition.yaml
  - Python: python/packages/github/src/matimo_github/tools/github-list-pull-requests/definition.yaml
```

**Validate Tool #1**
```
Tool: matimo_validate_tool (MCP)
Input: { name: "github-list-pull-requests" }
Output: ✅ valid: true, issues: []
```

### Step 5: Generate Implementations

**TypeScript**: `packages/github/tools/github-list-pull-requests/index.ts`
```
Pattern from: Skill § Part 7 (use exact HTTP executor pattern)
```

**Python**: `python/packages/github/src/matimo_github/tools/github-list-pull-requests/executor.py`
```
Pattern from: Skill § Part 7 (use exact HTTP executor pattern)
```

### Step 6: Generate Tests

**TypeScript**:
- `packages/github/test/unit/github-list-pull-requests.test.ts`
- `packages/github/test/integration/github-tools.test.ts`
```
Pattern from: Skill § Part 4
```

**Python**:
- `python/packages/github/tests/unit/test_github_list_pull_requests.py`
- `python/packages/github/tests/integration/test_github_tools.py`
```
Pattern from: Skill § Part 5
```

### Step 7: Validate All Code

```
Tool: execute (MCP)
Commands:
  - pnpm validate-tools
  - pnpm lint
  - pnpm test
  - uv run pytest
```

### Step 8: Create Skill Documentation

```
Tool: matimo_create_skill (MCP)
Input: {
  name: "github-pull-requests",
  content: "---\nname: github-pull-requests\n...\n---\n# How to work with GitHub PRs" 
           (from Skill § Part 8)
}
Output: ✅ Skill created at .github/skills/github-pull-requests/SKILL.md
```

### Step 9: Report Results
```
✅ Tool created and validated
✅ TypeScript + Python both generated
✅ Tests passing (no regressions)
✅ Skills documentation created
✅ Ready for publication
```

---

## Context Window Efficiency

**Why this structure saves context?**

| Without Skill-Separation | With Skill-Separation |
|-------------------------|----------------------|
| Agent contains 100KB of code examples | Agent is 5KB (references skill) |
| Agent contains all TS/Python patterns | Skill contains patterns (reused by multiple agents) |
| Agent repeated in every workspace | Agent + skill loaded once, used many times |
| Context bloat with every agent call | Context tight, focused on orchestration |

**Result**: Agent stays small. Skill is reusable. Multiple agents can reference same skill.

---

## Python vs TypeScript: Key Differences

### Tool Definitions: IDENTICAL ✅
```
packages/github/tools/github-list-pull-requests/definition.yaml
python/packages/github/src/matimo_github/tools/github-list-pull-requests/definition.yaml
↓ SAME YAML FILE ↓
```

### Implementation: DIFFERENT ✅
```
TypeScript: packages/github/tools/github-list-pull-requests/index.ts
Python: python/packages/github/src/matimo_github/tools/github-list-pull-requests/executor.py
↓ Different code, same algorithm ↓
```

### Testing: Same Pattern, Different Syntax
```
TypeScript: Jest + describe/it/expect (Skill § Part 4)
Python: pytest + def test_* (Skill § Part 5)
↓ Same coverage goals ↓
```

### Package Metadata: Different Format
```
TypeScript: package.json (Skill § Part 1)
Python: pyproject.toml (Skill § Part 1)
↓ Same dependencies ↓
```

**Agent Strategy**: Use Skill § Part 7 for side-by-side examples. Copy both simultaneously.

---

## Agent Decision Flow

**When agent encounters question, use this:**

```
Q: "How should I structure the tool?"
→ Check: Skill § Part 1 (Universal Provider Structure)

Q: "What fields go in YAML?"
→ Check: Skill § Part 2 (Tool Definition Formats)

Q: "Which authentication type?"
→ Check: Skill § Part 3 (Authentication Patterns)

Q: "Write tests for TypeScript?"
→ Check: Skill § Part 4 (TypeScript Testing Standards)

Q: "Write tests for Python?"
→ Check: Skill § Part 5 (Python Testing Standards)

Q: "Use Matimo tools or manual creation?"
→ Check: Skill § Part 6 (Matimo Tool Usage)
→ ALWAYS use matimo_create_tool, matimo_validate_tool via MCP

Q: "Show me TypeScript vs Python differences?"
→ Check: Skill § Part 7 (Side-by-Side Examples)

Q: "What goes in README?"
→ Check: Skill § Part 8 (README Template)
```

---

## Tools by Objective

### Creating Tools
```
Objective: Generate a new tool YAML
Tool: matimo_create_tool (MCP)
Validation: matimo_validate_tool
Reference: Skill § Part 2 (definition formats)
```

### Validating Tools
```
Objective: Check tool YAML is correct
Tool: matimo_validate_tool (MCP)
Reference: Skill § Part 2 (definition formats)
```

### Testing Code
```
Objective: Run tests for new tools
Tool: execute (MCP)
Commands: pnpm test, uv run pytest
Reference: Skill § Part 4-5 (test patterns)
```

### Creating Documentation
```
Objective: Generate skill for provider
Tool: matimo_create_skill (MCP)
Reference: Skill § Part 8 (README template)
```

### Finding Patterns
```
Objective: Research existing tool to copy from
Tool: search (MCP)
Reference: Skill § Part 7 (examples)
```

### Committing Changes
```
Objective: Save progress to git
Tool: execute (MCP)
Command: git commit -m "feat: add github tools"
```

---

## Quick Commands for Agent

### Validate All Tools
```bash
pnpm validate-tools
```

### Lint TypeScript Code
```bash
pnpm lint
pnpm format:check
```

### Run All Tests
```bash
pnpm test
uv run pytest packages/core/tests/
```

### Create and Validate Tool via MCP
```bash
# Use matimo_create_tool → writes YAML
# Use matimo_validate_tool → checks YAML
# Use execute → runs pnpm test
```

---

## Summary: The Three Layers

```
Layer 1: AGENT (Orchestration)
  └─ Thin, focused on workflow coordination
  └─ References skills for technical guidance
  └─ Calls Matimo tools for scaffolding/validation

Layer 2: SKILL (Technical Guidance)
  └─ Contains all patterns, standards, examples
  └─ Both TypeScript AND Python covered equally
  └─ Referenced by agent for each decision

Layer 3: MATIMO TOOLS (Execution)
  └─ Actual tool generation and validation
  └─ matimo_create_tool, matimo_validate_tool, execute, etc.
  └─ Called by agent via MCP when scaffolding needed

Result: Clean separation of concerns + context efficiency + bilingual support
```
