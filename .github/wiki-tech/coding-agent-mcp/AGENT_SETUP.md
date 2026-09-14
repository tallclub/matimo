# 🤖 Matimo Self-Maintaining Agent System

## What's Set Up

### 1. **Copilot Skill: `matimo-tool-generator`**
Location: `.vscode/skills/matimo-tool-generator/SKILL.md`

**Purpose:** Teaches coding agents (like me) how to create new Matimo tools and skills using Matimo's own tools via MCP.

**Key Features:**
- ✅ Connect to MCP server (http://0.0.0.0:3101)
- ✅ Use `matimo_create_tool` to validate YAML
- ✅ Use `matimo_validate_tool` to check schemas  
- ✅ Use `matimo_create_skill` to document tools
- ✅ Use `execute` to test and commit
- ✅ Self-maintaining: Matimo builds itself

### 2. **How It Works**

```
You (user)
  ↓
Request: "Add a GitHub tool to list PRs"
  ↓
Me (Claude) loads matimo-tool-generator skill
  ↓
I invoke Matimo tools via MCP server:
  1. matimo_create_tool          → Generate YAML
  2. matimo_validate_tool        → Verify it
  3. matimo_create_skill         → Document it
  4. execute                     → Test & commit
  ↓
New tool in Matimo codebase ✨
```

### 3. **Prerequisites**

**Start the Matimo HTTP MCP server** (exposes Matimo tools):
```bash
cd python/examples/mcp
uv run python src/server_http.py &
# Server on http://0.0.0.0:3101
```

Verify:
```bash
curl http://localhost:3101/health
# {"ok": true, "transport": "http"}
```

### 4. **Key Matimo Tools Used by Agents**

Via MCP at `http://0.0.0.0:3101/messages`:

| Tool | Via Agent | Purpose |
|------|-----------|---------|
| `matimo_create_tool` | cURL POST | Generate & validate tool YAML |
| `matimo_validate_tool` | cURL POST | Schema validation |
| `matimo_create_skill` | cURL POST | Generate skill documentation |
| `matimo_reload_tools` | cURL POST | Load new tools into registry |
| `execute` | cURL POST | Run shell commands (tests, git commit) |
| `search` | cURL POST | Find code patterns |
| `web` | cURL POST | Fetch API documentation |

### 5. **Example: Agent Creates a Tool**

**User Prompt:**
```
Create a new Slack tool to get user info.
```

**What Happens:**

1. **Agent loads skill**
   - Reads `.vscode/skills/matimo-tool-generator/SKILL.md`

2. **Agent defines requirements**
   - Tool: `slack_get_user`
   - Endpoint: `/users.info`
   - Auth: bearer token

3. **Agent calls Matimo via MCP** (cURL)
   ```bash
   curl -X POST http://0.0.0.0:3101/messages \
     -d '{
       "method": "call_tool",
       "params": {
         "name": "matimo_create_tool",
         "arguments": {
           "name": "slack-get-user",
           "yaml_content": "..."
         }
       }
     }'
   ```

4. **Agent validates** with `matimo_validate_tool`

5. **Agent writes to disk**
   ```bash
   python/packages/slack/src/matimo_slack/tools/slack-get-user/definition.yaml
   ```

6. **Agent creates skill** with `matimo_create_skill`
   ```bash
   .github/skills/slack/SKILL.md (updated)
   ```

7. **Agent tests & commits** via `execute` tool
   ```bash
   cd python && uv run pytest packages/core/tests/ -k slack
   git commit -m "feat(slack): add slack_get_user tool"
   ```

**Result:** New tool in codebase, validated, tested, documented! 🎉

---

## 📋 Self-Maintaining Loop

```
┌─────────────────────────────────────────┐
│  User asks for new tool/feature         │
└──────────────┬──────────────────────────┘
               ↓
┌─────────────────────────────────────────┐
│  Me (Claude) loads matimo-tool-generator│
│  skill from .vscode/skills/             │
└──────────────┬──────────────────────────┘
               ↓
┌─────────────────────────────────────────┐
│  I invoke Matimo tools via MCP:         │
│  • matimo_create_tool                   │
│  • matimo_validate_tool                 │
│  • matimo_reload_tools                  │
│  • matimo_create_skill                  │
│  • execute (tests + commit)             │
└──────────────┬──────────────────────────┘
               ↓
┌─────────────────────────────────────────┐
│  New tool/skill in Matimo codebase      │
│  ✅ Validated                           │
│  ✅ Tested                              │
│  ✅ Documented                          │
│  ✅ Committed                           │
└─────────────────────────────────────────┘

Loop: Matimo maintains itself! 🚀
```

---

## 🎯 How to Use

### Request 1: Create a tool
```
"Create a new GitHub tool to list repository issues.
Endpoint: https://api.github.com/repos/{owner}/{repo}/issues
Method: GET
Auth: bearer token"
```

**I will:**
1. Load the skill
2. Use Matimo's `matimo_create_tool` to generate YAML
3. Validate with `matimo_validate_tool`
4. Write to `python/packages/github/src/matimo_github/tools/github-list-issues/`
5. Document with `matimo_create_skill`
6. Test with `execute`
7. Commit to git

### Request 2: Create a skill
```
"Create a Notion integration skill that documents how to
query Notion databases"
```

**I will:**
1. Load the skill
2. Use `matimo_create_skill` to generate the skill YAML + markdown
3. Write to `.github/skills/notion-databases/`
4. Validate with `matimo_validate_skill`
5. Commit

---

## 🔗 Files Created

| File | Purpose |
|------|---------|
| `.vscode/skills/matimo-tool-generator/SKILL.md` | Agent skill — teaches how to use Matimo tools via MCP |

---

## ✨ What Makes This Self-Maintaining

1. **Agents use Matimo tools** (not manual scripts)
2. **Standards built-in** (validation, testing, docs)
3. **Reproducible** (same process every time)
4. **Auditable** (git commits track all changes)
5. **Improves itself** (if Matimo tools improve, agents benefit)

**Result:** Matimo SDK that builds itself through AI agents! 🚀
