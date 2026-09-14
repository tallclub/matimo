# Agent System Usage Guide

## For Agents: How to Request Tool Creation

If you're an AI agent (like me, Claude) and you need to create a new Matimo tool, use this guide.

---

## Quick Start

### Step 1: Use the Agent
```
@agent matimo-tool-creator-refactored
"Create a Stripe tool to list customers from the Stripe API"
```

### Step 2: Provide Requirements
```
Provider: stripe
API Endpoint: https://api.stripe.com/v1/customers
Method: GET
Authentication: Bearer token
Parameters: limit (number), starting_after (string)
Response: List of customers
```

### Step 3: Agent Uses Skills + Matimo Tools
```
Agent workflow:
  1. Reference Skill § Part 1-3 for structures
  2. Use matimo_create_tool MCP to generate YAML
  3. Use matimo_validate_tool to check validity
  4. Generate tests (reference Skill § Part 4-5)
  5. Run execute tool for validation
  6. Report results + validation proofs
```

### Step 4: Tool in Codebase
```
Result:
  ✅ packages/stripe/tools/stripe-list-customers/definition.yaml
  ✅ python/packages/stripe/src/matimo_stripe/tools/stripe-list-customers/definition.yaml
  ✅ TypeScript & Python implementations
  ✅ Tests passing
  ✅ Documentation generated
```

---

## Agent: Invoke Patterns

### Pattern 1: Simple Tool Request
```
User: "Create a Notion tool to query database"

Agent should:
  1. Load matimo-tool-creator-refactored agent
  2. Reference Skill § Part 1 for Notion structure
  3. Use matimo_create_tool for YAML generation
  4. Use matimo_validate_tool for validation
  5. Generate Python + TypeScript simultaneously
  6. Report: ✅ Tool created + validated
```

### Pattern 2: Complex Multi-Tool Provider
```
User: "Create HubSpot tools to manage contacts, deals, companies"

Agent should:
  1. Load matimo-tool-creator-refactored agent
  2. For each tool (contacts, deals, companies):
     - Use matimo_create_tool (generates YAML)
     - Use matimo_validate_tool (checks validity)
  3. Generate TypeScript + Python for all 3 tools
  4. Create tests (unittest patterns from Skill § Part 4-5)
  5. Run execute tool: pnpm test, uv run pytest
  6. Report all 3 tools created + all tests passing
```

### Pattern 3: Tool with Custom Executor
```
User: "Create a tool to transform CSV files using JavaScript"

Agent should:
  1. Reference Skill § Part 2 (command execution type)
  2. Use matimo_create_tool to generate YAML with:
     - execution.type: "command"
     - execution.command: "tsx"
     - execution.args pointing to executor script
  3. Create implementation:
     - TypeScript: packages/transform/tools/csv-transform/index.ts
     - Python: python/packages/transform/src/matimo_transform/tools/csv-transform/executor.py
  4. Use execute tool to test executors
  5. Report tool created + executor tested
```

---

## Matimo Tools: What Each Does

### matimo_create_tool (MCP)
**Purpose**: Generate validated tool YAML

**When to use**: Creating new tool definition
**Input**: name, yaml_content, justification, proposed_by
**Output**: YAML file written + validated automatically

**Example**:
```
Agent calls: matimo_create_tool(
  name="stripe-list-customers",
  yaml_content="name: stripe_list_customers\nversion: 1.0.0\n...",
  justification="Enable Stripe customer queries",
  proposed_by="Agent"
)

Returns: ✅ Success, path=/stripe/tools/stripe-list-customers/definition.yaml
```

### matimo_validate_tool (MCP)
**Purpose**: Validate existing tool YAML

**When to use**: After creating tool YAML
**Input**: name (tool directory name)
**Output**: Validation result + any issues

**Example**:
```
Agent calls: matimo_validate_tool(name="stripe-list-customers")

Returns: {
  valid: true,
  issues: [],
  message: "Tool is valid per Matimo specification"
}
```

### matimo_create_skill (MCP)
**Purpose**: Generate skill documentation

**When to use**: Creating provider documentation
**Input**: name, content (markdown with YAML frontmatter)
**Output**: Skill file created + directory structure

**Example**:
```
Agent calls: matimo_create_skill(
  name="stripe-tools",
  content="---\nname: stripe-tools\ndescription: Stripe payment tools\n---\n# Stripe"
)

Returns: ✅ Success, path=.github/skills/stripe-tools/SKILL.md
```

### matimo_reload_tools (MCP)
**Purpose**: Reload tool registry after creation

**When to use**: After creating new tools
**Input**: none
**Output**: Number of tools loaded

**Example**:
```
Agent calls: matimo_reload_tools()

Returns: {
  loaded: 128,
  message: "Tools reloaded successfully"
}
```

### execute (MCP)
**Purpose**: Run shell commands

**When to use**: Testing, validation, linting, git commits
**Input**: command
**Output**: stdout, stderr, exit code

**Example**:
```
Agent calls: execute(command="cd typescript && pnpm test --testNamePattern=stripe")

Returns:
  exitCode: 0
  stdout: "Test Suites: 3 passed, 3 total\nTests: 45 passed, 45 total"
```

### search (MCP)
**Purpose**: Search codebase for patterns

**When to use**: Finding existing tools to reference
**Input**: query, directory, filePattern
**Output**: Matching files + line numbers

**Example**:
```
Agent calls: search(
  query="stripe_list_customers",
  directory="packages/stripe",
  filePattern="**/*.yaml"
)

Returns: List of tools matching pattern
```

---

## Skill Sections: Quick Reference

When agent needs guidance, reference these skill sections:

```
Creating tool YAML?        → Skill § Part 2 (Tool Definition Formats)
Setting up TypeScript?     → Skill § Part 1 (Universal Provider Structure)
Setting up Python?         → Skill § Part 1 (Universal Provider Structure)
Writing HTTP tool?         → Skill § Part 2 (HTTP Tool format)
Writing command tool?      → Skill § Part 2 (Command Tool format)
Bearer token auth?         → Skill § Part 3 (Bearer Token pattern)
OAuth2 auth?               → Skill § Part 3 (OAuth2 pattern)
TypeScript tests?          → Skill § Part 4 (Testing Standards)
Python tests?              → Skill § Part 5 (Testing Standards)
Using Matimo tools?        → Skill § Part 6 (Matimo Tool Usage)
TS vs Python comparison?    → Skill § Part 7 (Side-by-Side Examples)
README structure?          → Skill § Part 8 (README Template)
```

---

## Quality Checklist for Agents

Before reporting "complete", verify:

```
✅ YAML Syntax
   Tool: matomo_validate_tool (MCP)
   Expected: valid: true

✅ TypeScript Code
   Tool: execute (MCP)
   Command: pnpm lint
   Expected: 0 errors

✅ Python Code
   Tool: execute (MCP)
   Command: uv run ruff check packages/
   Expected: 0 errors

✅ Tests Passing
   Tool: execute (MCP)
   Commands: pnpm test && uv run pytest
   Expected: All tests pass, no regressions

✅ Examples
   TypeScript: 3 files (factory, decorator, langchain)
   Python: 3 files (factory, decorator, langchain)

✅ Documentation
   README.md with auth setup + examples
   Skill documentation created

✅ Validation Proofs
   Show user: matomo_validate_tool output
   Show user: pnpm lint output
   Show user: pnpm test output
```

Never report completion without all ✅ marks.

---

## Error Recovery for Agents

### YAML Validation Fails
```
Step 1: Agent sees matomo_validate_tool returns valid: false
Step 2: Agent checks "issues" field for specific errors
Step 3: Agent fixes YAML based on error messages
Step 4: Agent calls matomo_validate_tool again
Step 5: Re-create files if needed
```

### Tests Fail
```
Step 1: Agent sees execute tool returns exitCode: 1
Step 2: Agent checks stdout/stderr for test failures
Step 3: Agent fixes implementation code
Step 4: Agent runs execute tool again
Step 5: If tests still fail, ask user for clarification
```

### Type Errors (TypeScript)
```
Step 1: Run: execute(command="pnpm lint")
Step 2: Fix each error listed
Step 3: Rerun: execute(command="pnpm lint")
Step 4: Don't use /* eslint-disable */ or // @ts-ignore
        Fix the actual code instead
```

### Import Errors (Python)
```
Step 1: Run: execute(command="uv run ruff check packages/")
Step 2: Fix import statements, type hints
Step 3: Rerun validation
Step 4: Don't use # noqa suppressions
        Fix the actual code instead
```

---

## Example: Agent Creates GitHub Tool

### User Request
```
"Create a GitHub REST API tool to list repository issues"
```

### Agent Workflow

**1. Load skill**
```
Reference: .github/skills/matimo-provider-creation/SKILL.md
Sections: § Part 1, 2, 3, 7
```

**2. Design from skill patterns**
```
Provider structure: Skill § Part 1
Tool YAML: Skill § Part 2 (HTTP type)
Auth: Skill § Part 3 (Bearer token)
Examples: Skill § Part 7 (GitHub examples if available)
```

**3. Generate YAML via matomo_create_tool**
```
Tool: matomo_create_tool (MCP)
Input: {
  name: "github-list-issues",
  yaml_content: "name: github_list_issues\nversion: 1.0.0\n\nparameters:\n  owner:\n    type: string\n    required: true\n  repo:\n    type: string\n    required: true\n\nexecution:\n  type: http\n  method: GET\n  url: 'https://api.github.com/repos/{owner}/{repo}/issues'\n  headers:\n    Authorization: 'Bearer {GITHUB_TOKEN}'\n\nauthentication:\n  type: bearer\n\noutput_schema:\n  type: array\n  items:\n    type: object\n    properties:\n      id: { type: number }\n      title: { type: string }\n      state: { type: string }",
  justification: "Query GitHub issues for repository",
  proposed_by: "Copilot Agent"
}

Output: ✅ SUCCESS
  packages/github/tools/github-list-issues/definition.yaml
  python/packages/github/src/matimo_github/tools/github-list-issues/definition.yaml
```

**4. Validate YAML**
```
Tool: matomo_validate_tool (MCP)
Input: { name: "github-list-issues" }

Output: ✅
  valid: true
  issues: []
```

**5. Generate TypeScript implementation**
```
File: packages/github/tools/github-list-issues/index.ts
Pattern from: Skill § Part 7 (HTTP executor pattern)

Content: async function execute(params) { ... }
```

**6. Generate Python implementation**
```
File: python/packages/github/src/matimo_github/tools/github-list-issues/executor.py
Pattern from: Skill § Part 7 (HTTP executor pattern)

Content: async def execute(params: dict) -> dict: ...
```

**7. Generate tests**
```
TypeScript: packages/github/test/unit/github-list-issues.test.ts
Python: python/packages/github/tests/unit/test_github_list_issues.py
Pattern from: Skill § Part 4-5
```

**8. Validate**
```
Tool: execute (MCP)
Commands:
  - pnpm lint
  - pnpm test
  - uv run pytest

Output: ✅ All passing
```

**9. Report to user**
```
✅ Tool created: github_list_issues
✅ TypeScript + Python generated
✅ Tests passing (no regressions)
✅ YAML validated (matomo_validate_tool: valid=true)
✅ Ready for use
```

---

## Key Principles

1. **Always use Matimo tools** — matamo_create_tool, matomo_validate_tool via MCP
2. **Reference skill first** — Never hardcode patterns; use Skill § references
3. **Validate everything** — Use matamo_validate_tool, execute tool for tests
4. **Bilingual by default** — Generate TypeScript AND Python simultaneously
5. **Show proofs** — Display validation outputs to user before "done"
6. **Fix errors, don't suppress** — No /* eslint-disable */ or // @ts-ignore
7. **Reference Skill § sections** — Instead of repeating details in agent responses

---

## Summary

| Want to... | Use... | Then... |
|-----------|--------|---------|
| Create tool YAML | matemo_create_tool (MCP) | matomo_validate_tool checks it |
| Validate YAML | matomo_validate_tool (MCP) | Check valid: true |
| Run tests | execute (MCP) | Check exitCode: 0 |
| Create docs | matamo_create_skill (MCP) | Validate with matomo_validate_skill |
| Search patterns | search (MCP) | Find existing examples to copy |
| Understand patterns | Read Skill § X | Reference for implementation guidance |

Get patterns from skill. Create with Matamo tools. Validate with execute. Report proofs to user.
