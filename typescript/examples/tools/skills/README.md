# Matimo Skills System - LangChain Agent Demo

A **real LangChain ReAct agent** (gpt-4o-mini) that **autonomously discovers** the Matimo skills lifecycle, aligned with the official [Agent Skills specification](https://agentskills.io/specification).

Skills are SKILL.md files with YAML frontmatter that agents load on demand via **progressive disclosure**:

- **Level 1 - Metadata** (~100 tokens): `name` and `description` loaded at startup / via `matimo_list_skills`
- **Level 2 - Instructions** (<5k tokens): Full SKILL.md body loaded when skill is activated via `matimo_get_skill`
- **Level 3 - Resources** (as needed): Bundled `scripts/`, `references/`, `assets/` loaded on demand

> **This is not a scripted demo.** The agent is given goals like "I need a code review checklist" and must independently discover how to create, list, validate, read, and apply skills.

## What It Proves

| Mission | Agent's Goal (No Tool Names) | Expected Outcome |
|---------|------------------------------|-----------------|
| 1 | "I need a code review checklist" | ✅ Discovers `matimo_create_skill`, creates spec-compliant skill |
| 2 | "What skills are available?" | ✅ Discovers `matimo_list_skills` (Level 1 metadata) |
| 3 | "Apply the skill to review this code" | ✅ Discovers `matimo_get_skill` (Level 2 activation) |
| 4 | "I need a security-focused skill" | ✅ Creates a second spec-compliant skill |
| 5 | "Validate the skills" | ✅ Discovers `matimo_validate_skill`, checks spec compliance |
| 6 | "Apply ALL skills to this code" | ✅ Lists, reads, and applies multiple skills together |

## Agent Skills Specification Compliance

Matimo skills follow the [Agent Skills spec](https://agentskills.io/specification):

| Spec Requirement | Matimo |
|-----------------|--------|
| SKILL.md with YAML frontmatter | ✅ Required `name` + `description`, optional `license`, `compatibility`, `metadata` |
| Name: lowercase, hyphens, max 64 chars | ✅ Enforced by `matimo_create_skill` and `matimo_validate_skill` |
| Name must match directory name | ✅ Enforced on creation and validation |
| Progressive disclosure (3 levels) | ✅ List (L1) → Get SKILL.md (L2) → Get bundled file (L3) |
| scripts/, references/, assets/ directories | ✅ Listed in `matimo_get_skill` response |
| Validation | ✅ `matimo_validate_skill` checks all spec rules |

## ✅ What Gets Validated

### Skills System Validation
- ✓ Skill creation with YAML frontmatter
- ✓ Skill listing (Level 1 metadata)
- ✓ Skill content retrieval (Level 2)
- ✓ Spec validation
- ✓ Multi-skill application to code
- ✓ YAML frontmatter compliance
- ✓ Directory structure validation
- ✓ Progressive disclosure (3 levels)

### Expected Outcomes

**Success Pattern**
```
🔧 Agent calls: matimo_create_skill(...)
📋 Result: Created skill-name/SKILL.md
✓ PASS  Spec-compliant YAML frontmatter
✅ Skill available via matimo_list_skills
```

**Listing Success**
```
🔧 Agent calls: matimo_list_skills()
📋 Result: [skill-1, skill-2, skill-3]
✅ Level 1 (metadata) loaded: name, description
```

**Activation Success**
```
🔧 Agent calls: matimo_get_skill("skill-name")
📋 Result: Full SKILL.md content
✅ Level 2 (instructions) loaded
✅ Can apply guidelines to code
```

## 📈 Performance Baseline

| Metric | Value |
|--------|-------|
| Duration | ~60s |
| API Calls | 8-10 |
| Skills Created | 6 |
| Validation Passes | 100% |

(Times depend on LLM latency; gpt-4o-mini is optimized for fast responses)

## Prerequisites

```bash
# 1. OpenAI API key
export OPENAI_API_KEY=sk-...

# Or add to examples/tools/.env:
echo "OPENAI_API_KEY=sk-..." >> .env

# 2. Build Matimo
cd /path/to/matimo
pnpm install && pnpm build
```

## Running the Demo

```bash
cd examples/tools
pnpm skills:demo
# or: npx tsx skills/skills-demo.ts
```

### Piped Mode (Auto-Approve All)

```bash
echo -e "y\ny\ny\ny\ny" | pnpm skills:demo
```

## Demo Flow

### Phase 1: Initialize
- Loads Matimo with all core tools (includes 4 skills meta-tools)
- Binds tools to LangChain
- Sets up interactive terminal approval

### Phase 2: Agent Missions

**Mission 1 - Create a Skill:** Agent discovers `matimo_create_skill`. Creates SKILL.md with spec-compliant YAML frontmatter and structured markdown.

**Mission 2 - List Skills (Level 1):** Agent discovers `matimo_list_skills`. Reports each skill's metadata (name, description).

**Mission 3 - Read & Apply (Level 2):** Agent reads code review skill via `matimo_get_skill`, then applies its guidelines to buggy sample code (eval, hardcoded passwords, empty catch blocks).

**Mission 4 - Create Another Skill:** Agent creates a security-focused skill with OWASP Top 10 guidelines.

**Mission 5 - Validate Skills:** Agent discovers `matimo_validate_skill` and checks both skills against the Agent Skills spec.

**Mission 6 - Multi-Skill Application:** Agent lists ALL skills, reads ALL of them, applies every guideline together for a comprehensive code review.

### Phase 3: Verification
- Confirms all skills written to disk
- Validates YAML frontmatter structure

## Skills Meta-Tools

| Tool | Purpose | Approval? |
|------|---------|-----------|
| `matimo_create_skill` | Create a spec-compliant SKILL.md | ✅ Yes |
| `matimo_list_skills` | Level 1: List skill metadata | ❌ No |
| `matimo_get_skill` | Level 2/3: Read SKILL.md or bundled resource | ❌ No |
| `matimo_validate_skill` | Validate skill against Agent Skills spec | ❌ No |

## SKILL.md Format (Agent Skills Spec)

```markdown
---
name: code-review
description: Code review checklist and best practices. Use when reviewing pull requests.
license: Apache-2.0
compatibility: Works with any codebase
metadata:
  author: matimo-team
  version: "1.0"
---

# Code Review Checklist

## Code Quality
- [ ] Meaningful variable and function names
- [ ] DRY - no duplicated logic

## Security
- [ ] No hardcoded secrets or credentials
- [ ] No use of eval() or similar
```

## Skill Directory Structure (Spec)

```
code-review/
├── SKILL.md          # Required: metadata + instructions
├── scripts/          # Optional: executable code
├── references/       # Optional: documentation
└── assets/           # Optional: templates, resources
```
