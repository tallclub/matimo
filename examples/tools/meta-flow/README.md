# Meta-Tools Integration Flow

**The most comprehensive example showing tool creation → policy validation → human approval → execution.**

A real LangChain ReAct agent demonstrates the complete tool lifecycle without being told which metadata tools to use.

## What It Shows

```
Agent receives high-level goals (not tool names):
  ├─ "Create a safe HTTP GET tool"
  ├─ "Attempt a shell command tool" (will be blocked)
  ├─ "Attempt a file reader tool" (will be blocked)
  ├─ "Create safe tools that pass policy"  
  └─ "List and use the tools we created"

Agent autonomously discovers and uses:
  ├─ matimo_doctor → Validate YAML against policies
  ├─ matimo_create_tool → Create draft tools on disk
  ├─ matimo_review → Get human approval (terminal prompt)
  ├─ matimo_reload_tools → Reload registry after approval
  ├─ matimo_list_user_tools → List created tools
  └─ [Tool execution] → Use the approved tools

Policy engine enforces:
  ├─ ✅ Only allowed domains (safe)
  ├─ ✅ Only HTTP methods GET/POST
  ├─ ❌ No shell commands
  ├─ ❌ No SSRF attacks
  └─ ❌ No namespace hijacking
```

## Running It

```bash
# From examples/tools/
pnpm meta:flow

# Or with auto-approval (for CI/testing):
printf "y\ny\ny\ny\ny\ny\n" | npx tsx meta-flow/meta-tools-integration.ts

# Run just meta-tools validation from anywhere:
cd examples/tools
pnpm validate:meta
```

When prompted: type `y` to approve tools, `n` to reject them. Agent learns from rejections.

## Key Differences from Other Examples

| Aspect | Policy Demo | Skills Demo | **Meta-Tools** |
|--------|------------|------------|--|--|
| Focus | Policy engine | Skills system | **Complete lifecycle** |
| Agent task | Validates tools | Creates skills | **Creates tools → approves → uses** |
| Policy demo | ✓ | - | ✓ |
| Skills demo | - | ✓ | - |
| Human approval | ✓ | ✓ | **✓ (most interactive)** |
| Tool creation | - | ✓ | **✓** |
| Tool execution | - | - | **✓** |
| Missions | 10 | 6 | **5 progressive** |
| Duration | ~90s | ~60s | **~120s** |

## Mission Breakdown

### Mission 1: Safe HTTP Tool
```
Agent: "Create a weather tool that calls a safe API"
  ↓
Agent thinks: "I need to validate, create, get approval, reload, then test"
  ↓
Agent: matmo_doctor(weather_fetch yaml)
  → ✅ "Valid: api.weatherapi.com approved, GET method allowed"
  ↓
Agent: matimo_create_tool('weather_fetch', yaml, toolsDir)
  → ✅ "Created draft: weather_fetch"
  ↓
Agent: matimo_review('weather_fetch', toolsDir)
  → Terminal: "Approve weather_fetch? (y/n): "
  → Human types: y
  → ✅ "Approved by human operator"
  ↓
Agent: matimo_reload_tools(toolsDir)
  → ✅ "Reloaded: weather_fetch available"
  ↓
Agent: weather_fetch({city: 'London'})
  → ✅ "API response: temp, condition, etc."
```

**Result**: ✅ Agent successfully created, approved, and executed a safe tool

---

### Mission 2: Attempt Shell Command (Will Fail)
```
Agent: "Create a tool that executes shell commands"
  ↓
Agent generates: name: shell_exec, type: command, command: bash
  ↓
Agent: matimo_doctor(yaml)
  → ❌ "Command tools are blocked by policy (allowCommandTools=false)"
  ↓
Agent learns: "I cannot create command-type tools"
```

**Result**: ⚠️  Policy enforced, Agent learns constraints

---

### Mission 3: Attempt File Reader (Will Fail)
```
Agent: "Create a tool to read files"
  ↓
Agent generates: name: file_reader, command: cat {path}
  ↓
Agent: matimo_doctor(yaml)
  → ❌ "Command tool type is blocked"
  ↓
Agent learns: "Command execution is not allowed"
```

**Result**: ⚠️  Policy blocks dangerous operation type

---

### Mission 4: Create Safe Tools (Learning from Failures)
```
Agent notices previous commands were blocked.
Agent now creates ONLY HTTP tools:
  ├─ Tool 1: user_lookup (HTTP GET from jsonplaceholder)
  │  ├─ doctor: ✅ Valid
  │  ├─ create: ✅ Created
  │  ├─ review: 🛡️  Human approves
  │  └─ reload: ✅ Available
  │
  └─ Tool 2: github_stars (HTTP GET from api.github.com)
     ├─ doctor: ✅ Valid
     ├─ create: ✅ Created
     ├─ review: 🛡️  Human approves
     └─ reload: ✅ Available
```

**Result**: ✅ Multiple tools created, approved, and reloaded

---

### Mission 5: List and Execute Tools
```
Agent: "Show all tools we created and test one"
  ↓
Agent: matimo_list_user_tools(toolsDir)
  → Returns: [user_lookup, github_stars]
  ↓
Agent picks user_lookup and executes:
Agent: user_lookup({id: 5})
  → Returns: {name: 'Chelsey', city: 'Roscoe', ...}
  ↓
Agent reports: "Both tools work correctly"
```

**Result**: ✅ Tools are listed and executable

---

## Output You'll See

```
╔════════════════════════════════════════════════════════════════════╗
║  Matimo Meta-Tools Integration Flow                               ║
║  Tool Creation → Policy Validation → Human Approval → Usage       ║
╚════════════════════════════════════════════════════════════════════╝

═══════════════════════════════════════════════════════════════════════
  PHASE 1: Setup
═══════════════════════════════════════════════════════════════════════

    ℹ  Matimo meta-tools loaded: 9 tools
    ✓ PASS  Meta-tools available: matimo_doctor, matimo_create_tool, ...
    ✓ PASS  LangChain agent initialized: gpt-4o-mini with meta-tools

    ℹ  Tools directory: /tmp/matimo-meta-flow-xxx/tools
    ℹ  When prompted, type 'y' to approve tools

═══════════════════════════════════════════════════════════════════════
  PHASE 2: Missions (Agent-Driven Tool Lifecycle)
═══════════════════════════════════════════════════════════════════════

  ── Mission 1: Create a safe HTTP GET tool ─────────────────────────
    🎯 Agent Goal: "Create a weather tool that calls a safe API"

    🔧 Agent calls: matimo_doctor("name: weather_fetch,...")
    📋 Result: Valid: safe domain (api.weatherapi.com), GET method allowed

    🔧 Agent calls: matimo_create_tool("weather_fetch", yaml, ...)
    📋 Result: Created draft: weather_fetch

    🔧 Agent calls: matimo_review("weather_fetch", ...)
    
    ╔══════════════════════════════════════════════════════╗
    ║  🛡️  HUMAN APPROVAL REQUIRED                         ║
    ║  Tool: weather_fetch                                 ║
    ║  Desc: Fetch current weather for a city             ║
    ╚══════════════════════════════════════════════════════╝
    ❓ Approve? (y/n): y
    ✓ PASS  Approved by human operator.

    🔧 Agent calls: matimo_reload_tools(...)
    📋 Result: Reloaded: weather_fetch now available

    💬 Agent: I have successfully created and approved a weather tool.

  ── Mission 2: Attempt to create a shell command tool ──────────────
    🎯 Agent Goal: "Create a tool that executes shell commands"

    🔧 Agent calls: matimo_doctor("name: shell_exec, type: command,...")
    ❌ Command tools are blocked (allowCommandTools=false)

    💬 Agent: I understand. Command execution tools are not allowed.

  [... more missions ...]

═══════════════════════════════════════════════════════════════════════
  PHASE 3: Verification & Summary
═══════════════════════════════════════════════════════════════════════

  ✓ PASS  Tools created on disk: 4 tools
  ✓ PASS  weather_fetch/definition.yaml
  ✓ PASS  user_lookup/definition.yaml
  ✓ PASS  github_stars/definition.yaml
  ✓ PASS  city_lookup/definition.yaml

  Mission Results:
    ✓ PASS  Safe HTTP Tool
       Created: weather_fetch
    ⚠ WARN  Shell Command (blocked)
    ⚠ WARN  File Reader (blocked)
    ✓ PASS  Safe Tool Creation
       Created: user_lookup, github_stars
    ✓ PASS  List & Execute Tools

  Summary:
    ℹ  Missions: 5
    ℹ  Successful: 4
    ℹ  Tools created: 4
    ℹ  Policy blocks enforced: 2
    ℹ  Human approval invoked: 4 times

    ✓ PASS  Real LangChain agent making autonomous decisions
    ✓ PASS  Policy engine validating tool definitions
    ✓ PASS  Agent learning from policy rejections
    ✓ PASS  Human-in-the-loop approval workflow
    ✓ PASS  Tool registry reloading after approval
    ✓ PASS  Tool execution after approval
```

## Code Structure

```
meta-flow/
├── meta-tools-integration.ts
│   ├─ Header: Policy config, system prompt
│   ├─ Phase 1: Initialize matimo with meta-tools
│   ├─ Phase 2: Run 5 autonomous missions
│   └─ Phase 3: Verification and summary
├─ (No mock data in toolspaths)
└─ Temp directory created for tool artifacts
```

## Environment Setup

```bash
# .env file in examples/tools/
OPENAI_API_KEY=sk-...  # Required for LLM

# Optional:
MATIMO_LOG_LEVEL=debug  # See internal logging
```

## What to Look For

✅ **Success markers**:
- Agent successfully creates tools step-by-step
- Policy engine actually blocks dangerous patterns (not just demo)
- Human approval prompts work and agent waits for input
- Tools are created on disk and can be listed
- Approved tools execute and return real data

⚠️ **Learning moments**:
- Watch agent adjust strategy after policy rejection
- See how agent learns allowedDomains/allowedMethods constraints
- Notice agent doesn't attempt blocked patterns after first failure

🛡️ **Human-in-the-loop in action**:
- Every tool creation prompts for human approval
- Type 'y' to simulate approval
- Type 'n' to simulate rejection, watch agent adapt

## Common Issues

| Issue | Solution |
|-------|----------|
| "OpenAI API timeout" | Increase `timeout` in ChatOpenAI config (default: 30s) |
| "Agent doesn't conclude" | MAX_ITERATIONS may be too low (default: 12) |
| "Tools don't execute" | Check reload was called after review approval |
| "No terminal prompt" | Verify approval handler is set: `approvalHandler.setApprovalCallback(...)` |
| "Policy doesn't block" | Check PolicyConfig is passed to MatimoInstance.init() |

## Next: Using in Production

1. **Deploy policy config**: Define your domain allowlist
2. **Integrate storage**: Replace temp dir with persistent tool registry
3. **Integrate approval DB**: Log all human decisions
4. **Monitor violations**: Alert when policy blocks attempts
5. **Fine-tune prompts**: Customize for your domain

---

**See also**: 
- [PRACTICAL_EXAMPLES.md](../PRACTICAL_EXAMPLES.md) — Complete walkthroughs
- [IMPLEMENTATION_VALIDATION.md](../IMPLEMENTATION_VALIDATION.md) — Validation guide
- [policy-demo.ts](../policy/policy-demo.ts) — Policy engine focused example
- [skills-demo.ts](../skills/skills-demo.ts) — Skills system focused example
