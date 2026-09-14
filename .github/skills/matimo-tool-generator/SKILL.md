---
name: matimo-tool-generator
description: Coding agents use this skill to rapidly create new Matimo tools and skills by invoking Matimo's own core tools via MCP. Self-maintaining Matimo codebase through AI agents.
metadata:
  category: "Tool Development"
  difficulty: "advanced"
  domain: "Matimo SDK Maintenance"
  user-invokable: "true"
  invocation: "When user asks to create tools, skills, or extend Matimo — use this skill + Matimo MCP tools"
---

# Self-Maintaining Matimo via Coding Agents

This skill enables **coding agents** to create new **Matimo tools and skills** using **Matimo's own core tools via MCP**.

## The Self-Maintaining Loop

```
Agent Request
     ↓
Connect to MCP Server (http://0.0.0.0:3101)
     ↓
Invoke Matimo Core Tools:
  • matimo_create_tool
  • matimo_validate_tool
  • matimo_create_skill
  • matimo_reload_tools
  • execute (tests + git)
     ↓
Tool/Skill Added to Codebase
     ↓
Matimo Maintains Itself 🚀
```

## Available Matimo Core Tools via MCP

### 1. `matimo_create_tool`
**Purpose:** Generate tool YAML definition with validation

**Signature:**
```
POST http://0.0.0.0:3101/messages

{
  "method": "call_tool",
  "params": {
    "name": "matimo_create_tool",
    "arguments": {
      "name": "tool-name",
      "yaml_content": "name: tool_name\ngit: ...",
      "justification": "Why create this tool",
      "proposed_by": "Agent Name"
    }
  }
}
```

### 2. `matimo_validate_tool`
**Purpose:** Validate tool YAML against Matimo schema

**Signature:**
```
POST http://0.0.0.0:3101/messages

{
  "method": "call_tool",
  "params": {
    "name": "matimo_validate_tool",
    "arguments": {
      "name": "tool-name"
    }
  }
}
```

### 3. `matimo_create_skill`
**Purpose:** Create skill documentation with YAML frontmatter

**Signature:**
```
POST http://0.0.0.0:3101/messages

{
  "method": "call_tool",
  "params": {
    "name": "matimo_create_skill",
    "arguments": {
      "name": "skill-name",
      "content": "---\nname: skill-name\n...\n---\n# Skill Content"
    }
  }
}
```

### 4. `matimo_reload_tools`
**Purpose:** Reload tools after creation

**Signature:**
```
POST http://0.0.0.0:3101/messages

{
  "method": "call_tool",
  "params": {
    "name": "matimo_reload_tools",
    "arguments": {}
  }
}
```

### 5. `execute`
**Purpose:** Run shell commands (tests, git commits)

**Signature:**
```
POST http://0.0.0.0:3101/messages

{
  "method": "call_tool",
  "params": {
    "name": "execute",
    "arguments": {
      "command": "git commit -m 'feat: add new tool'"
    }
  }
}
```

## Complete Workflow: Create a Slack Tool

### Step 1: Research API
```bash
search query="Slack API user.info endpoint"
```

### Step 2: Generate Tool YAML
```bash
matimo_create_tool(
  name="slack-get-user-info",
  yaml_content="""
name: slack_get_user_info
description: Get information about a Slack user
version: '1.0.0'
status: draft

parameters:
  user_id:
    type: string
    required: true
    description: Slack user ID

execution:
  type: http
  method: GET
  url: 'https://slack.com/api/users.info?user={user_id}'
  headers:
    Authorization: 'Bearer {SLACK_BOT_TOKEN}'

authentication:
  type: bearer

output_schema:
  type: object
  properties:
    ok:
      type: boolean
""",
  justification="Enable agents to retrieve Slack user profiles",
  proposed_by="Agent"
)
```

### Step 3: Validate Tool
```bash
matimo_validate_tool(name="slack-get-user-info")
```

### Step 4: Create Skill Documentation
```bash
matimo_create_skill(
  name="slack-user-management",
  content="""---
name: slack-user-management
description: Slack user management tools
---

# Slack User Management

Tools for querying and managing Slack users.

## slack_get_user_info

Get user profile information by user ID.
"""
)
```

### Step 5: Reload Tools
```bash
matimo_reload_tools()
```

### Step 6: Test and Commit
```bash
execute(command="cd python && uv run pytest packages/core/tests/ -k slack")
execute(command="git add -A && git commit -m 'feat(slack): add slack_get_user_info tool'")
```

## Agent Invocation Pattern

When user requests a new tool:

```
User: "Create a GitHub tool to list repository PRs"
  ↓
Agent: Load matimo-tool-generator skill
  ↓
Agent: Follow Complete Workflow above
  ↓
Agent: Uses Matimo tools via MCP to generate, validate, test, commit
  ↓
Result: Tool in codebase + documented + tested ✨
```

## Key Principles

✅ **Use Matimo tools, not manual scripts** — leverage standardization
✅ **Validate every generated tool** — matimo_validate_tool catches issues
✅ **Automate documentation** — matimo_create_skill maintains consistency
✅ **Test before committing** — execute runs test suites
✅ **Commit with proper messages** — version control with clarity

## Result

Matimo becomes **self-maintaining** — coding agents build the SDK using the SDK's own tools. 🚀
