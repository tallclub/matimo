# Matimo MCP Developer Quick Reference (TypeScript & Python)

**Print this page or bookmark it!** 🚀

---

## 🚀 Get Started in 3 Steps (5 minutes)

### Step 1: Start the MCP Server
```bash
cd python/examples/mcp
uv run python src/server_http.py
# Server runs on http://localhost:3101
```

### Step 2: Configure VS Code
File: `~/.vscode/settings.json`
```json
{
  "github.copilot.chat.mcpServers": {
    "matimo": {
      "command": "python3",
      "args": ["src/server_http.py"],
      "cwd": "${workspaceFolder}/python/examples/mcp",
      "env": {"MATIMO_SERVER_PORT": "3101"}
    }
  }
}
```

### Step 3: Create a Tool
In Copilot Chat:
```
@agent matimo-tool-creator-refactored
"Create a tool to {action}"
```

**Agent automatically creates both TypeScript AND Python implementations!** ✅

---

## 📋 System Overview (Bilingual)

```
User Request → Agent → MCP Tools → Skill Patterns
         ↓
Creates: TypeScript + Python implementations (both tested)
         ↓
Results:
  • packages/{provider}/tools/{tool}/ (TypeScript)
  • python/packages/{provider}/tools/{tool}/ (Python)
  • Both YAML-defined, both tested, both production-ready
```

---

## 🔧 Key Commands

### MCP Server
```bash
# Start
cd python/examples/mcp && uv run python src/server_http.py

# Health check
curl http://localhost:3101/health

# List tools
curl http://localhost:3101/tools | python3 -m json.tool
```

### TypeScript Development
```bash
# Navigate
cd packages/{provider}/tools/{tool}

# Install deps
pnpm install

# Run tests
pnpm test -- {tool_name}

# Lint
pnpm lint

# Format
pnpm format
```

### Python Development
```bash
# Navigate
cd python/packages/{provider}

# Sync deps
uv sync

# Run tests
uv run pytest src/matamo_{provider}/tools/{tool}/tests/ -v

# Lint
uv run ruff check

# Format
uv run ruff format
```

---

## 📁 File Structure

```
TypeScript Implementation:
packages/{provider}/tools/{tool}/
├─ definition.yaml      ← Shared (identical for both)
├─ index.ts            ← Executor
└─ __tests__/          ← Jest tests

Python Implementation:
python/packages/{provider}/src/matamo_{provider}/tools/{tool}/
├─ executor.py         ← Executor
└─ tests/             ← pytest tests

Shared Definition:
Both use same definition.yaml (in TS location, or copied to Py)
```

---

## 💬 Common Requests (Copy-Paste)

### Simple Tool
```
@agent matimo-tool-creator-refactored

Create a {provider} tool to {action}.

Endpoint: {API_URL}
Auth: {bearer|api_key|oauth2|basic}
Parameters: {list}
```

### Tool with Validation
```
@agent matimo-tool-creator-refactored

Create a {provider} tool with:
- Complex nested JSON response
- Input validation
- Error handling (4xx/5xx)

Endpoint: {API_URL}
Auth: {TYPE}
Output schema: {STRUCTURE}
```

### Both Implementations Required
```
@agent matimo-tool-creator-refactored

Create tool with BOTH implementations:
- TypeScript (Jest tests, pnpm)
- Python (pytest tests, uv)

Provider: {name}
Tool: {name}
Description: {text}
Endpoint: {URL}
Auth: {TYPE}
```

---

## 🆚 TypeScript vs Python at a Glance

| Aspect | TypeScript | Python |
|--------|-----------|--------|
| **Location** | `packages/{provider}/` | `python/packages/{provider}/` |
| **Executor** | `index.ts` | `executor.py` |
| **Tests Framework** | Jest | pytest |
| **Test Location** | `__tests__/` | `tests/` |
| **Install** | `pnpm install` | `uv sync` |
| **Run Tests** | `pnpm test` | `uv run pytest` |
| **Lint** | `pnpm lint` | `uv run ruff check` |
| **Type System** | TypeScript types | Python type hints |
| **Async** | async/await | async/await |
| **Package Manager** | pnpm | uv |

---

## 🎯 Typical Workflow (20-30 min)

```
1. Prepare requirements       (5 min)
   └─ endpoint, auth, params

2. Request from agent        (1 min)
   └─ Paste into Copilot Chat

3. Watch agent work         (5 min)
   ├─ Generates YAML
   ├─ Creates TS code + tests
   └─ Creates Py code + tests

4. Review files            (5 min)
   ├─ TypeScript: packages/{provider}/tools/{tool}/
   └─ Python: python/packages/{provider}/...

5. Run tests manually      (5 min)
   ├─ pnpm test (TypeScript)
   └─ uv run pytest (Python)

6. Commit & push           (5 min)
   └─ git add + commit + push
```

---

## 📚 Skill Sections Reference

When agent says "Reference Skill § Part X":

| Part | Content | Both TS & Py? |
|------|---------|---------------|
| § 1-2 | YAML definitions | ✅ Yes (identical) |
| § 3 | Auth patterns | ✅ Yes (both use) |
| § 4 | **TypeScript testing** (Jest) | ✅ TS only |
| § 5 | **Python testing** (pytest) | ✅ Py only |
| § 6 | Tool reference | ✅ Yes (both use) |
| § 7 | **Code examples** | ✅ Yes (TS + Py side-by-side) |
| § 8 | README template | ✅ Yes (shared) |

---

## ⚡ Bilingual Code Example

### Shared: YAML Definition
```yaml
name: slack_post_message
description: Post message to Slack channel
parameters:
  channel:
    type: string
    required: true
  message:
    type: string
    required: true
execution:
  type: http
  method: POST
  url: 'https://slack.com/api/chat.postMessage'
  headers:
    Authorization: 'Bearer {SLACK_BOT_TOKEN}'
```

### TypeScript Executor
```typescript
// packages/slack/tools/slack_post_message/index.ts
export async function execute(params: {
  channel: string;
  message: string;
}): Promise<{ ok: boolean; ts: string }> {
  const response = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.SLACK_BOT_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      channel: params.channel,
      text: params.message
    })
  });

  if (!response.ok) {
    throw new Error(`Slack API error: ${response.statusText}`);
  }

  return response.json();
}
```

### Python Executor
```python
# python/packages/slack/src/matamo_slack/tools/slack_post_message/executor.py
async def execute(params: dict[str, str]) -> dict[str, Any]:
    async with httpx.AsyncClient() as client:
        response = await client.post(
            'https://slack.com/api/chat.postMessage',
            headers={
                'Authorization': f"Bearer {os.getenv('SLACK_BOT_TOKEN')}",
                'Content-Type': 'application/json'
            },
            json={
                'channel': params['channel'],
                'text': params['message']
            }
        )

        if response.status_code != 200:
            raise MatimoError(f"Slack API error: {response.text}")

        return response.json()
```

### TypeScript Tests (Jest)
```typescript
describe('slack_post_message', () => {
  it('should post to channel', async () => {
    const result = await execute({
      channel: '#general',
      message: 'Hello'
    });

    expect(result.ok).toBe(true);
    expect(result.ts).toBeDefined();
  });
});
```

### Python Tests (pytest)
```python
@pytest.mark.asyncio
async def test_post_message():
    result = await execute({
        'channel': '#general',
        'message': 'Hello'
    })

    assert result['ok'] is True
    assert 'ts' in result
```

---

## 🆘 Quick Fixes

| Problem | Fix |
|---------|-----|
| **Port 3101 busy** | `export MATIMO_SERVER_PORT=3102` |
| **Server not found** | Restart server + reload VS Code |
| **TS tests fail** | `cd packages/{pr}/tools/{tool}` then `pnpm test -- --verbose` |
| **Py tests fail** | `cd python/packages/{pr}` then `uv run pytest -v` |
| **Import error (Py)** | Run `cd python && uv sync` |
| **Skill not found** | Check `.github/skills/matimo-provider-creation/SKILL.md` exists |
| **Agent doesn't load** | Reload VS Code: Cmd+Shift+P → "Reload Window" |

---

## ✅ Success Checklist

After setup, verify:
- [ ] MCP server starts: `curl http://localhost:3101/health` ✅
- [ ] VS Code recognizes tools: Type `@workspace` in Copilot
- [ ] Agent loads: Try `@agent matimo-tool-creator-refactored`
- [ ] Create test tool (both implementations)
- [ ] Check files: `packages/demo/` + `python/packages/demo_py/`
- [ ] Run tests: `pnpm test` + `uv run pytest` both pass
- [ ] Commit: `git add + commit + push`

---

## 🎓 Learning Path

**Beginner** (30 min):
1. Read: This file
2. Start: MCP server
3. Create: Echo tool
4. Run: Both test suites

**Intermediate** (1 hour):
1. Read: SETUP_GUIDE.md
2. Create: 3-5 more tools
3. Mix: Different auth types
4. Compare: TS output vs Py output

**Advanced** (2+ hours):
1. Read: `.github/skills/matimo-provider-creation/SKILL.md` (all 8 parts)
2. Create: Complex tools (OAuth2, pagination, validation)
3. Extend: Agent behavior
4. Contribute: New patterns to skill

---

## 📞 Need Help?

| Question | Answer |
|----------|--------|
| Full setup details | Read: `docs/mcp/SETUP_GUIDE.md` |
| System architecture | Read: `docs/mcp/ARCHITECTURE.md` |
| How to use system | Read: `docs/mcp/USAGE_GUIDE.md` |
| Team maintenance | Read: `docs/mcp/MAINTENANCE_GUIDE.md` |
| Find docs | Read: `docs/mcp/NAVIGATION_MAP.md` |

---

## 🚀 TL;DR — 2-Minute Start

```bash
# Terminal: Start MCP server
cd python/examples/mcp
uv run python src/server_http.py

# VS Code: Add to settings.json
{
  "github.copilot.chat.mcpServers": {
    "matimo": {
      "command": "python3",
      "args": ["src/server_http.py"],
      "cwd": "${workspaceFolder}/python/examples/mcp",
      "env": {"MATIMO_SERVER_PORT": "3101"}
    }
  }
}

# VS Code: Reload window
Cmd+Shift+P → "Developer: Reload Window"

# Copilot Chat: Request tool
@agent matimo-tool-creator-refactored
"Create a GitHub tool to list repos"

# Result: ✅ TypeScript + Python implementations created
```

---

**Last Updated**: April 2026 | **Status**: Production Ready | **Bilingual**: TypeScript + Python

Print this. Bookmark this. Share with your team. 📋✨
