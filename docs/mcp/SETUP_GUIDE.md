# Matimo MCP Server Setup Guide (TypeScript & Python)

**Last Updated**: April 2026  
**Target Audience**: Development teams (TypeScript and Python)  
**Estimated Setup Time**: 20-30 minutes

---

## 📋 Table of Contents

1. [Quick Start (5 min)](#quick-start-5-min)
2. [System Architecture](#system-architecture)
3. [Prerequisites](#prerequisites)
4. [Step 1: Start the MCP Server](#step-1-start-the-mcp-server)
5. [Step 2: Configure VS Code Copilot](#step-2-configure-vs-code-copilot)
6. [Step 3: Verify Setup](#step-3-verify-setup)
7. [Understanding the System](#understanding-the-system)
8. [Creating Your First Tool](#creating-your-first-tool)
9. [TypeScript vs Python Workflow](#typescript-vs-python-workflow)
10. [Troubleshooting](#troubleshooting)

---

## Quick Start (5 min)

### For TypeScript Developers

```bash
# 1. Start the MCP server (from matimo root)
cd python/examples/mcp
uv run python src/server_http.py

# 2. Note the port (default 3101)
# Server running on http://localhost:3101

# 3. In VS Code settings.json:
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

# 4. In Copilot Chat:
@agent matimo-tool-creator-refactored
"Create a Slack tool (TypeScript) to send direct messages"

# Done! ✅
```

### For Python Developers

```bash
# Setup is identical! Python/TypeScript agents use same MCP server
# Only difference: When requesting tools, specify language preference

# In Copilot Chat:
@agent matimo-tool-creator-refactored
"Create a GitHub tool (Python) to list pull requests by label"

# Agent generates BOTH TypeScript AND Python implementations ✅
```

**For detailed setup**, continue reading.

---

## System Architecture

Matimo MCP exposes **146+ tools** that agents use to create new provider packages:

```
┌─────────────────────────────────────────────────────────┐
│ VS Code Copilot Chat                                    │
│ "@agent matimo-tool-creator-refactored"                 │
│ "Create a tool to..."                                   │
└────────────┬────────────────────────────────────────────┘
             │
             ↓
┌─────────────────────────────────────────────────────────┐
│ MCP Server on port 3101 (Python process)                │
│ Exposes 146+ Matimo tools via JSON-RPC                  │
└────────────┬────────────────────────────────────────────┘
             │
             ↓
┌──────────────────────────────────────────────────────────┐
│ Agent: matimo-tool-creator-refactored (200 lines)        │
│                                                          │
│ Workflow:                                                │
│ 1. Load Skill for patterns                              │
│ 2. Call matamo_create_tool (MCP) → YAML definition      │
│ 3. Call matamo_validate_tool (MCP) → validate schema    │
│ 4. Generate TypeScript + Python code (from Skill)       │
│ 5. Run tests: pnpm test (TS) + uv pytest (Py)          │
│ 6. Report: ✅ tool created with both implementations    │
└──────────────────────────────────────────────────────────┘
             │
             ↓
┌──────────────────────────────────────────────────────────┐
│ Skill: matimo-provider-creation (400+ lines)             │
│                                                          │
│ • § Part 1-2: YAML patterns (identical for TS & Py)    │
│ • § Part 3: Authentication patterns (all languages)     │
│ • § Part 4: TypeScript testing (Jest)                   │
│ • § Part 5: Python testing (pytest)                     │
│ • § Part 7: Code examples (TS vs Python side-by-side)  │
│ • § Part 8: README template                            │
└──────────────────────────────────────────────────────────┘
             │
             ↓
┌──────────────────────────────────────────────────────────┐
│ Result: Bilingual Provider Package                       │
│                                                          │
│ ✅ packages/{provider}/tools/{tool}/definition.yaml      │
│ ✅ packages/{provider}/tools/{tool}/index.ts (executor) │
│ ✅ packages/{provider}/tools/{tool}/__tests__/ (Jest)   │
│                                                          │
│ ✅ python/packages/{provider}/src/matamo_{provider}/    │
│    └─ tools/{tool}/executor.py                          │
│    └─ tools/{tool}/tests/test_{tool}.py (pytest)        │
│                                                          │
│ ✅ README.md (shared documentation)                      │
└──────────────────────────────────────────────────────────┘
```

**Key Principle**: Single request creates **both TypeScript and Python** implementations automatically.

---

## Prerequisites

### System Requirements

- **macOS, Linux, or Windows WSL2**
- **Python 3.10+**
  ```bash
  python3 --version
  ```
- **Node.js 18+** (for TypeScript)
  ```bash
  node --version
  ```

### Matimo Repository

```bash
cd /path/to/matimo
git fetch origin
git status
```

### Package Managers

**Python** - Uses `uv`:
```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
cd python && uv sync
```

**TypeScript** - Uses `pnpm`:
```bash
npm install -g pnpm
cd typescript && pnpm install
```

### VS Code Setup

- **VS Code** (latest)
- **GitHub Copilot Chat** extension
- Both SDKs should have tooling available

---

## Step 1: Start the MCP Server

### 1.1 Navigate to MCP Server

```bash
cd python/examples/mcp
```

### 1.2 Set Environment Variables (Optional)

```bash
# Custom port (if 3101 is busy)
export MATIMO_SERVER_PORT=3102

# Tools path (if needed)
export MATIMO_EXTRA_TOOLS_PATH="/path/to/tools"

# Logging level (error | warn | info | debug)
export MATIMO_LOG_LEVEL=debug
```

### 1.3 Start the Server

```bash
uv run python src/server_http.py
```

**Expected output:**
```
Matimo MCP Server
Starting HTTP server on http://localhost:3101
Tools loaded: 128
[2026-04-16 10:30:45] Server started successfully
```

Keep this terminal open.

### 1.4 Verify Server

In a new terminal:

```bash
# Health check
curl -s http://localhost:3101/health

# Should return:
# {"status": "ok", "tools_count": 128}

# List tools
curl -s http://localhost:3101/tools | python3 -m json.tool | head -50
```

---

## Step 2: Configure VS Code Copilot

### 2.1 Open Settings

**Option A**: Settings UI (recommended)
- Open Settings (⌘, on macOS / Ctrl+, on Windows)
- Search: `mcpServers`
- Click "Edit in settings.json"

**Option B**: Direct file edit
```bash
code ~/.vscode/settings.json
```

### 2.2 Add MCP Server Configuration

```json
{
  "github.copilot.chat.mcpServers": {
    "matimo": {
      "command": "python3",
      "args": ["src/server_http.py"],
      "cwd": "${workspaceFolder}/python/examples/mcp",
      "env": {
        "MATIMO_SERVER_PORT": "3101",
        "MATIMO_LOG_LEVEL": "info"
      }
    }
  }
}
```

### 2.3 Reload VS Code

Command Palette (Cmd+Shift+P) → "Developer: Reload Window"

### 2.4 Verify Connection

1. Open Copilot Chat (Cmd+Shift+I on macOS)
2. Type: `@workspace`
3. You should see Matimo tools listed

---

## Step 3: Verify Setup

### 3.1 Test MCP Connection

```
In Copilot Chat:

What Matimo tools are available?
```

Should list 128+ tools.

### 3.2 Test Agent Loading

```
Load the matimo-tool-creator-refactored agent
```

### 3.3 Test Tool Creation (Bilingual)

**TypeScript version:**
```
@agent matimo-tool-creator-refactored

Create a simple echo tool in TypeScript.

Provider: demo
Tool Name: echo_message
Description: Echo back the input message unchanged
Parameter: message (string, required)
```

**Python version:**
```
@agent matimo-tool-creator-refactored

Create a simple echo tool in Python.

Provider: demo_py
Tool Name: echo_message
Description: Echo back the input message unchanged
Parameter: message (string, required)
```

### 3.4 Verify Files Were Created

```bash
# TypeScript implementation
ls -la packages/demo/tools/echo_message/

# Python implementation
ls -la python/packages/demo_py/src/matamo_demo_py/tools/echo_message/
```

Both should have:
- `definition.yaml` (shared YAML)
- Language-specific executor (`index.ts` or `executor.py`)
- Language-specific tests

---

## Understanding the System

### Layer 1: Agent (200 lines)

**File**: `.github/agents/matimo-tool-creator-refactored.agent.md`

Orchestrator that:
1. Receives user request
2. Loads Skill patterns
3. Calls MCP tools for YAML generation
4. Generates TS + Python code (from Skill patterns)
5. Runs TS tests (pnpm test)
6. Runs Python tests (uv run pytest)
7. Reports results

**Why small**: No embedded code, uses Skill for patterns, uses MCP tools for validation.

---

### Layer 2: Skill (400+ lines)

**File**: `.github/skills/matimo-provider-creation/SKILL.md`

**8 sections providing patterns for both languages:**

| Section | Content | Used For |
|---------|---------|----------|
| § 1-2 | YAML definitions | Both TS & Python (identical) |
| § 3 | Authentication patterns | API key, Bearer, OAuth2, Basic |
| § 4 | **TypeScript** testing | Jest patterns |
| § 5 | **Python** testing | pytest patterns |
| § 6 | Matimo tool reference | Which tool when |
| § 7 | **Code examples** | TS vs Python side-by-side |
| § 8 | README template | Shared documentation |

Agent uses:
- § 1-2: Generate YAML (same for both)
- § 3: Auth setup (same for both)
- § 4: Create TS tests
- § 5: Create Python tests
- § 7: Generate TS + Python executors

---

### Layer 3: Matimo Tools (128+ via MCP)

**Key tools:**

| Tool | Language | Purpose |
|------|----------|---------|
| `matamo_create_tool` | Python binary | Generate YAML from description |
| `matamo_validate_tool` | Python binary | Validate schema compliance |
| `execute` | Python binary | Run shell commands (pnpm, uv, git) |
| `search` | Python binary | Find code patterns |
| `matamo_create_skill` | Python binary | Generate skill docs |

All are language-agnostic and work with both TS + Python codebases.

---

## Creating Your First Tool

### Scenario: Create a GitHub Tool

#### Prepare Requirements

```
Provider: github
Tool Name: list_issues
Description: List issues in a repository
Endpoint: GET https://api.github.com/repos/{owner}/{repo}/issues
Auth: Bearer token (GitHub PAT)
Parameters:
  - owner (required)
  - repo (required)
  - state (optional: open, closed, all)
  - limit (optional)
```

#### Request from Agent

```
@agent matimo-tool-creator-refactored

Create a GitHub tool with:

Provider: github
Tool Name: list_issues
Description: List issues in a repository

API Details:
- Endpoint: GET https://api.github.com/repos/{owner}/{repo}/issues
- Auth: GitHub Personal Access Token (Bearer)
- Parameters: owner (req), repo (req), state (opt), limit (opt)

Requirements:
- Implement in both TypeScript and Python
- Include comprehensive tests for both languages
- Test fixture data matches real GitHub API responses
```

#### Watch Agent Execute (Bilingual)

```
1. Load Skill § Parts 1-7

2. Generate YAML
   ✓ Definition created (same for both languages)

3. Validate YAML
   ✓ Schema valid

4. Generate TypeScript
   ✓ Reference Skill § Part 7 (TS code)
   ✓ Generate index.ts (executor)
   ✓ Generate __tests__/github_list_issues.test.ts
   ✓ Run: pnpm test
   ✓ Result: 8/8 tests passing

5. Generate Python
   ✓ Reference Skill § Part 7 (Py code)
   ✓ Generate executor.py
   ✓ Generate tests/test_list_issues.py
   ✓ Run: uv run pytest
   ✓ Result: 6/6 tests passing

6. Report
   ✅ Tool created (both implementations)
   
   TypeScript:
   - packages/github/tools/list_issues/definition.yaml
   - packages/github/tools/list_issues/index.ts
   - packages/github/tools/list_issues/__tests__/
   
   Python:
   - python/packages/github/src/matamo_github/tools/list_issues/executor.py
   - python/packages/github/src/matamo_github/tools/list_issues/tests/
   
   Validation:
   ✅ YAML schema valid
   ✅ TypeScript: 8/8 tests
   ✅ Python: 6/6 tests
```

#### Review Generated Files

```bash
# YAML (shared)
cat packages/github/tools/list_issues/definition.yaml

# TypeScript
cat packages/github/tools/list_issues/index.ts
cat packages/github/tools/list_issues/__tests__/list_issues.test.ts

# Python
cat python/packages/github/src/matamo_github/tools/list_issues/executor.py
cat python/packages/github/src/matamo_github/tools/list_issues/tests/test_list_issues.py
```

#### Run Tests Manually

```bash
# TypeScript
cd packages/github
pnpm test -- list_issues

# Python
cd python/packages/github
uv run pytest src/matamo_github/tools/list_issues/tests/ -v
```

#### Commit Changes

```bash
git checkout -b feat/github-list-issues

# Add both implementations
git add packages/github/tools/list_issues/
git add python/packages/github/src/matamo_github/tools/list_issues/

git commit -m "feat(github): add list_issues tool (TS + Py)"
git push origin feat/github-list-issues
```

---

## TypeScript vs Python Workflow

### Key Differences in Generated Code

**YAML Definition** (100% identical):
```yaml
name: github_list_issues
description: List issues in a repository
parameters:
  owner:
    type: string
    required: true
execution:
  type: http
  method: GET
  url: 'https://api.github.com/repos/{owner}/{repo}/issues'
```

**TypeScript Executor** (from Skill § Part 7):
```typescript
// packages/github/tools/list_issues/index.ts
export async function execute(params: Parameters): Promise<Output> {
  const url = `https://api.github.com/repos/${params.owner}/${params.repo}/issues`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github.v3+json'
    }
  });
  
  if (!response.ok) {
    throw new MatimoError(`GitHub API error: ${response.status}`);
  }
  
  return await response.json();
}
```

**Python Executor** (from Skill § Part 7):
```python
# python/packages/github/src/matamo_github/tools/list_issues/executor.py
async def execute(params: Parameters) -> Output:
    url = f"https://api.github.com/repos/{params['owner']}/{params['repo']}/issues"
    
    async with httpx.AsyncClient() as client:
        response = await client.get(
            url,
            headers={
                "Authorization": f"Bearer {os.getenv('GITHUB_TOKEN')}",
                "Accept": "application/vnd.github.v3+json"
            }
        )
        
        if response.status_code != 200:
            raise MatimoError(f"GitHub API error: {response.status_code}")
        
        return response.json()
```

### Test Patterns

**TypeScript (Jest)**:
```typescript
describe('github_list_issues', () => {
  it('should list issues', async () => {
    const result = await execute({
      owner: 'tallclub',
      repo: 'matimo'
    });
    
    expect(result).toEqual(expect.arrayContaining([
      expect.objectContaining({
        number: expect.any(Number),
        title: expect.any(String)
      })
    ]));
  });
});
```

**Python (pytest)**:
```python
@pytest.mark.asyncio
async def test_list_issues():
    result = await execute({
        'owner': 'tallclub',
        'repo': 'matimo'
    })
    
    assert isinstance(result, list)
    assert all('number' in issue for issue in result)
    assert all('title' in issue for issue in result)
```

### Command Reference

| Task | TypeScript | Python |
|------|-----------|--------|
| **Run tests** | `pnpm test` | `uv run pytest` |
| **Lint code** | `pnpm lint` | `uv run ruff check` |
| **Format code** | `pnpm format` | `uv run ruff format` |
| **Install deps** | `pnpm install` | `uv sync` |
| **Build** | `pnpm build` | `uv run python -m build` |

---

## Workflow Examples

### Example 1: Simple Authentication

```
@agent matimo-tool-creator-refactored

Create a Slack tool (Slack API).

Provider: slack
Tool: list_channels
Description: List all channels in a workspace
Auth: Slack Bot Token (Bearer)
Parameters: limit (optional)
Languages: Both TypeScript and Python
```

**Agent will:**
- Reference Skill § Part 3 (Bearer auth pattern)
- Generate YAML with Bearer token
- Create TS + Python executors
- Generate TS tests + Python tests
- Report success (both passing)

---

### Example 2: Complex Output Validation

```
@agent matimo-tool-creator-refactored

Create a Notion tool (both languages).

Provider: notion
Tool: get_page
Description: Retrieve a Notion page's properties
Auth: Notion API Key (Bearer)
Parameters: page_id (required)
Output: Complex nested JSON with properties, title, created_time
Include output schema validation
```

**Agent will:**
- Generate comprehensive output_schema
- Create TS tests validating structure
- Create Python tests validating structure
- Both test suites pass

---

### Example 3: Error Handling

```
@agent matimo-tool-creator-refactored

Create a GitHub tool (both implementations).

Provider: github
Tool: update_issue
Description: Update a GitHub issue
Auth: GitHub Personal Access Token
Parameters: owner, repo, issue_number, title (opt), body (opt)
HTTP: PATCH request
Handle errors: 404 (not found), 422 (validation failed)
Languages: TypeScript and Python
```

**Agent will:**
- Generate error handling for both languages
- Create test cases for success + error scenarios
- Run both test suites
- Report comprehensive results

---

## Troubleshooting

### Issue 1: MCP Server Won't Start

```bash
# Check port
lsof -i :3101

# Either kill or use different port
kill -9 <PID>
# OR
export MATIMO_SERVER_PORT=3102
uv run python src/server_http.py
```

---

### Issue 2: VS Code Can't Find Tools

1. **Verify server running**: `curl http://localhost:3101/health`
2. **Check config**: Settings → "mcpServers" section
3. **Reload VS Code**: Command Palette → "Developer: Reload Window"
4. **Check logs**: Output → "GitHub Copilot" channel

---

### Issue 3: Tests Failing (TypeScript)

```bash
cd packages/{provider}/tools/{tool}

# Run with verbose output
pnpm test -- --verbose

# Common issues:
# - Mock data doesn't match real API
# - Parameter templating wrong ({paramName} syntax)
# - Output schema too strict
```

---

### Issue 4: Tests Failing (Python)

```bash
cd python/packages/{provider}

# Run with verbose output
uv run pytest src/matamo_{provider}/tools/{tool}/tests/ -v

# Common issues:
# - ModuleNotFoundError → run: uv sync
# - Async/await issues → use @pytest.mark.asyncio
# - Mock data mismatches → update fixtures
```

---

### Issue 5: Python Import Errors

```bash
# Reinstall package in editable mode
cd python/packages/{provider}
uv pip install -e .

# Or sync all dependencies
cd /path/to/matimo/python
uv sync

# Then retry tests
uv run pytest packages/{provider}/tests/ -v
```

---

### Issue 6: Skill Not Found

```bash
# Verify skill location
ls -la .github/skills/matimo-provider-creation/SKILL.md

# If missing, check old location
ls -la python/examples/mcp/.github/skills/

# Copy if needed
cp python/examples/mcp/.github/skills/matimo-tool-generator/SKILL.md \
   .github/skills/matimo-tool-generator/SKILL.md
```

---

## Quick Reference

### File Locations

```
Agent:                     .github/agents/matimo-tool-creator-refactored.agent.md
Skill:                     .github/skills/matimo-provider-creation/SKILL.md
MCP Server:                python/examples/mcp/src/server_http.py

TypeScript Tools:          packages/{provider}/tools/{tool}/
├─ definition.yaml         (shared)
├─ index.ts               (executor)
└─ __tests__/             (Jest tests)

Python Tools:              python/packages/{provider}/src/matamo_{provider}/tools/{tool}/
├─ executor.py            (executor)
└─ tests/                 (pytest tests)
```

### Key Commands

```bash
# Start MCP server
cd python/examples/mcp && uv run python src/server_http.py

# Verify server
curl http://localhost:3101/health

# Run TypeScript tests
pnpm test

# Run Python tests
uv run pytest

# Validate tools
matamo_validate_tool {tool_name}

# List tools
curl http://localhost:3101/tools | python3 -m json.tool
```

---

## Success Criteria

- ✅ MCP server runs on port 3101
- ✅ VS Code recognizes Matimo tools
- ✅ Agent loads and responds
- ✅ Generates YAML (shared)
- ✅ Generates TypeScript code + tests
- ✅ Generates Python code + tests
- ✅ Both test suites pass
- ✅ Create first bilingual tool in <30 minutes

---

**Happy bilingual tool building! 🚀**
