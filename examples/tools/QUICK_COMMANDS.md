# Quick Command Reference

Fast validation of all Matimo implementations.

> ⚠️ **Important:** Matimo is a **pnpm monorepo**. Use `pnpm` commands, not `npm`. The `workspace:*` protocol is pnpm-specific and not supported by npm.

## Test Everything (2-5 minutes)

```bash
cd /path/to/matimo

# Build the project
pnpm build

# Change to examples directory
cd examples/tools

# Option A: Validate all implementations in batch
pnpm validate:all   # Runs all examples with auto-approval
pnpm validate:meta  # Only meta-tools
pnpm validate:policy # Only policy
pnpm validate:skills # Only skills

# Option B: Run specific category examples
# Meta/Demo Examples
pnpm meta:flow      # Meta-tools integration (most comprehensive)
pnpm policy:demo    # Policy engine focus
pnpm skills:demo    # Skills system focus
pnpm credentials:example # Credentials management

# Option C: Run by provider (factory pattern is simplest to start, Please update provider api key in .env ref example.env)
pnpm agent:factory          # Base agent example
pnpm slack:factory          # Slack provider
pnpm gmail:factory          # Gmail provider
pnpm github:factory         # GitHub provider
pnpm postgres:factory       # PostgreSQL provider
pnpm notion:factory         # Notion provider
pnpm hubspot:factory        # HubSpot provider
pnpm mailchimp:factory      # Mailchimp provider
pnpm twilio:factory         # Twilio provider

# Option D: Run by core functionality (decorator pattern)
pnpm execute:decorator      # Execute tool
pnpm read:decorator         # Read tool
pnpm edit:decorator         # Edit tool
pnpm search:decorator       # Search tool
pnpm web:decorator          # Web tool

# Option E: Run LangChain integration examples
pnpm agent:langchain        # Full LangChain agent
pnpm agent:skills           # LangChain with skills & policy
pnpm slack:langchain        # Slack with LangChain
pnpm execute:langchain      # Execute with LangChain
```

## Available Examples by Category

### Meta/Demo Examples
| Command | Purpose |
|---------|---------|
| `pnpm meta:flow` | Meta-tools integration demo (tool creation, policy, approvals) |
| `pnpm policy:demo` | Policy engine validation & blocking scenarios |
| `pnpm skills:demo` | Skills system creation and validation |
| `pnpm credentials:example` | Credentials management patterns |

### Provider Examples - Factory Pattern
| Command | Purpose |
|---------|---------|
| `pnpm agent:factory` | Base agent with factory pattern |
| `pnpm slack:factory` | Slack tools via factory |
| `pnpm gmail:factory` | Gmail tools via factory |
| `pnpm github:factory` | GitHub tools via factory |
| `pnpm postgres:factory` | PostgreSQL tools via factory |
| `pnpm postgres:approval` | PostgreSQL with approval workflow |
| `pnpm notion:factory` | Notion tools via factory |
| `pnpm hubspot:factory` | HubSpot tools via factory |
| `pnpm mailchimp:factory` | Mailchimp tools via factory |
| `pnpm twilio:factory` | Twilio tools via factory |

### Provider Examples - Decorator Pattern
| Command | Purpose |
|---------|---------|
| `pnpm agent:decorator` | Base agent with decorator pattern |
| `pnpm slack:decorator` | Slack tools via decorators |
| `pnpm gmail:decorator` | Gmail tools via decorators |
| `pnpm github:decorator` | GitHub tools via decorators |
| `pnpm postgres:decorator` | PostgreSQL tools via decorators |
| `pnpm notion:decorator` | Notion tools via decorators |
| `pnpm hubspot:decorator` | HubSpot tools via decorators |
| `pnpm mailchimp:decorator` | Mailchimp tools via decorators |
| `pnpm twilio:decorator` | Twilio tools via decorators |

### Provider Examples - LangChain Pattern
| Command | Purpose |
|---------|---------|
| `pnpm agent:langchain` | Base agent with LangChain integration |
| `pnpm agent:skills` | LangChain agent with skills & policy |
| `pnpm slack:langchain` | Slack tools via LangChain |
| `pnpm gmail:langchain` | Gmail tools via LangChain |
| `pnpm github:langchain` | GitHub tools via LangChain |
| `pnpm github:approval` | GitHub with approval workflow |
| `pnpm postgres:langchain` | PostgreSQL tools via LangChain |
| `pnpm notion:langchain` | Notion tools via LangChain |
| `pnpm hubspot:langchain` | HubSpot tools via LangChain |
| `pnpm mailchimp:langchain` | Mailchimp tools via LangChain |
| `pnpm twilio:langchain` | Twilio tools via LangChain |

### Core Functionality Examples - Factory Pattern
| Command | Purpose |
|---------|---------|
| `pnpm execute:factory` | Execute commands via factory |
| `pnpm read:factory` | Read files via factory |
| `pnpm edit:factory` | Edit files via factory |
| `pnpm search:factory` | Search files via factory |
| `pnpm web:factory` | Web scraping via factory |

### Core Functionality Examples - Decorator Pattern
| Command | Purpose |
|---------|---------|
| `pnpm execute:decorator` | Execute commands via decorators |
| `pnpm read:decorator` | Read files via decorators |
| `pnpm edit:decorator` | Edit files via decorators |
| `pnpm search:decorator` | Search files via decorators |
| `pnpm web:decorator` | Web scraping via decorators |

### Core Functionality Examples - LangChain Pattern
| Command | Purpose |
|---------|---------|
| `pnpm execute:langchain` | Execute commands via LangChain |
| `pnpm read:langchain` | Read files via LangChain |
| `pnpm edit:langchain` | Edit files via LangChain |
| `pnpm search:langchain` | Search files via LangChain |
| `pnpm web:langchain` | Web scraping via LangChain |

### Validation Commands
| Command | Purpose |
|---------|---------|
| `pnpm validate:all` | Run all meta examples with auto-approval |
| `pnpm validate:meta` | Only meta-tools example |
| `pnpm validate:policy` | Only policy demo |
| `pnpm validate:skills` | Only skills demo |
| `pnpm validate:impl` | Implementation validation |


```bash
# From matimo root
cd packages/cli

# Validate all tools in a directory
pnpm cli -- doctor packages/core/tools/

# List pending and approved tools
pnpm cli -- review list

# Approve a tool (requires computed HMAC)
pnpm cli -- review approve calculator --secret <hmac-hash>

# Reject/revoke a tool
pnpm cli -- review reject calculator
```

## Test Coverage

```bash
cd /path/to/matimo

# Test policy engine (100% coverage expected)
pnpm test -- packages/core/test/unit/policy/

# Test skills system (100% coverage expected)
pnpm test -- packages/core/test/unit/skills/

# Test CLI commands (doctor, review, skills, etc.)
pnpm test -- packages/cli/test/unit/commands/

# Full project coverage
pnpm test:coverage      # Shows summary and detailed report
```

## Quick Validation Checklist

```bash
# 1. Does meta-tools example run without errors?
npx tsx examples/tools/meta-flow/meta-tools-integration.ts --help
# Expected: Shows agent setup messages, or --help info

# 2. Does policy engine block dangerous tools?
cd examples/tools
printf "y\ny\ny\ny\ny\ny\n" | npx tsx policy/policy-demo.ts 2>&1 | grep -i "blocked\|error" | head -10
# Expected: Multiple "BLOCKED" messages for shell commands, SSRF, etc.

# 3. Does skills system create valid SKILL.md files?
printf "y\ny\ny\n" | npx tsx skills/skills-demo.ts 2>&1 | grep "skill" | grep -i "created\|pass"
# Expected: Messages about skills being created and validated

# 4. Can CLI doctor command validate tools?
pnpm cli -- doctor packages/core/tools/ 2>&1 | grep -i "valid\|error\|pass" | head -10
# Expected: Validation results for tools in directory

# 5. Can review command manage approvals?
pnpm cli -- review list 2>&1 | grep -i "pending\|approved\|tool"
# Expected: Tool status listing (even if empty)
```

## What Each Component Validates

For detailed validation details and expected outputs, see individual README files:

### Meta-Tools Integration (`meta:flow`)
📖 **Full details:** [meta-flow/README.md](./meta-flow/README.md)

✓ Tool creation (matimo_create_tool)  
✓ Policy validation (matimo_doctor)  
✓ Human approval (matimo_review)  
✓ Registry reload (matimo_reload_tools)  
✓ Tool listing (matimo_list_user_tools)  
✓ Tool execution after approval  
✓ Agent learns from policy rejections  

**Duration:** ~120s | **API Calls:** 12-15 | **Missions:** 5

### Policy Demo (`policy:demo`)
📖 **Full details:** [policy/README.md](./policy/README.md)

✓ Safe tool validation passes  
✓ Shell commands blocked  
✓ SSRF attacks blocked  
✓ Namespace hijacking blocked  
✓ Human approval workflow  
✓ Risk classification  

**Duration:** ~90s | **API Calls:** 10-12 | **Missions:** 10

### Skills Demo (`skills:demo`)
📖 **Full details:** [skills/README.md](./skills/README.md)

✓ Skill creation with YAML frontmatter  
✓ Skill listing (Level 1 metadata)  
✓ Skill content retrieval (Level 2)  
✓ Spec validation  
✓ Multi-skill application to code  

**Duration:** ~60s | **API Calls:** 8-10 | **Missions:** 6

### Credentials Management
📖 **Full details:** [credentials/README.md](./credentials/README.md)

✓ Environment variable loading  
✓ Multi-provider credential setup  
✓ Credential validation  
✓ Best practices and patterns  

---

## Troubleshooting Quick Fixes

| Problem | Fix |
|---------|-----|
| "OPENAI_API_KEY not set" | Add to examples/tools/.env |
| "Agent loops indefinitely" | Increase MAX_ITERATIONS constant |
| "No human prompt appears" | Ensure approval handler is set |
| "Module not found: tsx" | `pnpm install -g tsx` or use `npx tsx` |
| "Tools don't execute" | Verify matimo_reload_tools() called |
| "Policy doesn't block" | Check PolicyConfig in init() |

---

## Performance Benchmarks

| Example | Duration | API Calls | Missions |
|---------|----------|-----------|----------|
| meta:flow | ~120s | 12-15 | 5 |
| policy:demo | ~90s | 10-12 | 10 |
| skills:demo | ~60s | 8-10 | 6 |

(Times depend on LLM latency; gpt-4o-mini is optimized for fast responses)

---

## Report All Results

After running validations, check:

```bash
# cd to Matimo root folder from example/tools
cd ../..
# Test results
pnpm test:coverage 2>&1 | tail -20

# Meta-tools: created tools on disk
ls -la /tmp/matimo-meta-flow-*/tools/*/definition.yaml

# Skills: created SKILL.md files
ls -la /tmp/matimo-skills-demo-*/skills/*/SKILL.md

# Policy: validation logs show blocks
grep -i "blocked\|invalid" /tmp/*.log
```

---

## Next: Detailed Information

For comprehensive information about each example including validation details, expected output patterns, troubleshooting, and performance metrics, see individual README files:

| Example | Documentation |
|---------|----------------|
| **Meta-Tools** | [meta-flow/README.md](./meta-flow/README.md) — Tool creation, policy validation, approvals |
| **Policy Engine** | [policy/README.md](./policy/README.md) — Policy validation, blocking scenarios, risk classification |
| **Skills System** | [skills/README.md](./skills/README.md) — Skills creation, listing, validation, multi-skill application |
| **Credentials** | [credentials/README.md](./credentials/README.md) — API key management, environment setup, best practices |
| **All Examples** | [README.md](./README.md) — Overview of all 50+ examples |

---

**Quick tip: When in doubt, run: `pnpm meta:flow`** 🚀
