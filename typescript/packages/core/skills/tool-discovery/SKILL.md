---
name: tool-discovery
description: "Find and inspect available tools. Learn how to search the registry, list the tools you created, read a tool's definition and approval state, and find skills — before creating anything new."
metadata:
  category: "Tool Management"
  difficulty: "beginner"
  apply-to: "matimo_search_tools matimo_get_tool matimo_list_user_tools matimo_get_tool_status matimo_list_skills matimo_search_skills"
---

# Tool Discovery: Finding and Inspecting Tools

This skill teaches you how to find the tools you can use **before** you write a new one. Reusing an existing, approved tool is always faster and safer than creating one.

## Where Tools Come From

1. **Core tools** — shipped with Matimo: `calculator`, `web`, `read`, `search`, `edit`, `execute` and others, plus the `matimo_*` meta-tools that manage tools and skills.
2. **Provider tools** — from installed provider packages (Slack, GitHub, Gmail, Notion, HubSpot, and more), loaded by the developer.
3. **Tools created by agents** — written with `matimo_create_tool` into a directory the developer chose. They start as drafts and run only after a human approves them.

## Which Tool Answers Which Question

| Question | Tool |
|----------|------|
| Is there already a tool for this? | `matimo_search_tools` |
| What exactly does tool X do and take? | `matimo_get_tool` |
| Which tools have agents created here? | `matimo_list_user_tools` |
| Can tool X run yet? | `matimo_get_tool_status` |
| Is there guidance for this kind of task? | `matimo_search_skills`, `matimo_list_skills` |

---

## matimo_search_tools — search everything that is loaded

```
matimo_search_tools(query: "slack message", limit: 5)

→ {
    "results": [
      { "name": "slack_send_message", "description": "...", "version": "1.0.0", "tags": ["slack", "messaging"], "riskLevel": "medium" }
    ],
    "total": 1,
    "query": "slack message"
  }
```

- Matches the query against tool names, descriptions and tags.
- Searches every loaded tool — core, provider and approved agent-created tools.
- An empty result means nothing loaded matches: try other words before deciding to create a tool.

## matimo_get_tool — read one tool's definition

```
matimo_get_tool(name: "weather_lookup", tool_dir: "<directory>")

→ { "found": true, "name": "weather_lookup", "yaml_content": "name: weather_lookup\n...", "definition": { ... }, "message": "..." }
```

Use it to see a tool's parameters before calling it, or to start a new tool from an existing one.

## matimo_list_user_tools — the tools agents created in a directory

```
matimo_list_user_tools(tool_dir: "<directory>", include_drafts: true)

→ {
    "tools": [
      { "name": "weather_lookup", "description": "Get current weather for a city", "version": "1.0.0", "status": "approved", "riskLevel": "high", "tags": [] },
      { "name": "todo_create", "description": "Create a todo item", "version": "1.0.0", "status": "draft", "riskLevel": "high", "tags": [] }
    ],
    "total": 2
  }
```

- `include_drafts: false` lists only tools that are no longer drafts.
- A tool that failed the policy rules is never written by `matimo_create_tool`, and a tool rejected on reload is not loaded — neither appears with a special status. Check the `rejected` list returned by `matimo_reload_tools` instead.

## matimo_get_tool_status — can this tool run yet?

```
matimo_get_tool_status(name: "todo_create", tool_dir: "<directory>")

→ {
    "found": true,
    "name": "todo_create",
    "status": "draft",
    "riskLevel": "high",
    "approvalState": "pending",
    "approvedAt": null,
    "approvedBy": null,
    "message": "Tool \"todo_create\" is pending (high risk)"
  }
```

| `approvalState` | Meaning | Can it run? |
|-----------------|---------|-------------|
| `pending` | A draft waiting for `matimo_approve_tool`, or a tool that needs approval | No — ask a human to approve it, then reload |
| `approved` | Approved, and the file has not changed since | Yes, after `matimo_reload_tools` |
| `auto-approved` | A low-risk, read-only tool that is not a draft | Yes |
| `rejected` | The tool is deprecated | No |

Even an approved tool you created keeps `requires_approval: true`, so each call still asks a human.

---

## Understanding Risk Levels

| Risk | Typical tool | What happens when it runs |
|------|--------------|---------------------------|
| `low` | HTTP GET | Runs, unless the developer requires review |
| `medium` | HTTP POST / PUT / PATCH | Runs; the developer may require review |
| `high` | HTTP DELETE, command tools, any tool with `requires_approval: true` (every tool you create) | A human approves each call |
| `critical` | Function tools, or tools that declare `risk: critical` | Developer-written code; agents cannot create these |

A tool's `risk:` field can raise its level, never lower it.

---

## Finding Skills

Skills are guidance documents for a kind of task — such as this one.

```
matimo_search_skills(query: "create an http tool", limit: 3)
→ { "success": true, "results": [ { "name": "tool-creation", "description": "...", "relevanceScore": 0.42 } ], "total": 1, ... }

matimo_list_skills()
→ { "skills": [ { "name": "tool-creation", "description": "...", "path": "..." }, ... ], "total": 6 }
```

Then load one with `matimo_get_skill(name: "tool-creation")`, or only the part you need with `matimo_get_skill_sections` and `matimo_get_skill_content`.

---

## Common Patterns

### Before creating a tool

```
1. matimo_search_tools(query: "<what you need>")
     found → read it with matimo_get_tool → call it
     none  → try different words once more
2. Still nothing → follow the meta-tools-lifecycle skill to create one
```

### "What tools did we create, and which can run?"

```
1. matimo_list_user_tools(tool_dir: "<directory>")
2. For each draft: matimo_get_tool_status → report it as waiting for approval
3. Report approved tools as ready (each call still asks a human)
```

### "Why can't I call this tool?"

```
- matimo_get_tool_status says pending → it needs matimo_approve_tool, then a reload
- Calling it fails with "Draft tool ... requires admin role" → same: it is still a draft
- It is not found at all → it was rejected on reload; check matimo_reload_tools' rejected list
```

---

## Key Principles

1. ✅ **Search before you create** — an existing tool is already approved and tested
2. ✅ **Read the definition before calling** — use the parameter names it declares
3. ✅ **Check status, not assumptions** — a created tool is a draft until a human approves it
4. ✅ **Report honestly** — say which tools are waiting for approval rather than calling them

---

## References

- **Creating and approving tools**: see the `meta-tools-lifecycle` skill
- **Writing tool YAML**: see the `tool-creation` skill
- **Policy rules**: see the `policy-validation` skill
