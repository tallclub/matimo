---
name: skill-creator
description: "Create new skills, validate and improve existing skills, and manage the skill lifecycle in Matimo. USE THIS SKILL whenever the user or you (agent) wants to create a skill from scratch, turn a workflow into a reusable skill, edit or optimize an existing skill, validate a skill against the Agent Skills spec, or manage skills in the catalog. Also use when agents need to capture a repeatable pattern as a skill for future use."
version: "1.0.0"
license: "MIT"
metadata:
  category: "Meta"
  difficulty: "intermediate"
  apply-to: "matimo_create_skill matimo_validate_skill matimo_list_skills matimo_get_skill"
---

# Skill Creator

A skill for creating new skills and iteratively improving them in Matimo.

At a high level, creating a skill goes like this:

1. Understand what the skill should do and when it should trigger
2. Interview the user to capture requirements and edge cases
3. Draft the SKILL.md with proper frontmatter and instructions
4. Validate the skill using `matimo_validate_skill`
5. Create the skill using `matimo_create_skill`
6. Iterate based on feedback

---

## When to Use This Skill

- User says "create a skill for X" or "turn this into a skill"
- User wants to capture a workflow as a reusable pattern
- User wants to teach agents how to do a specific task
- User wants to create provider-specific skills for their tools
- User wants to edit, improve, or validate an existing skill
- An agent recognizes a repeatable pattern worth capturing

---

## Step 1: Capture Intent

Start by understanding what the user wants. The current conversation might already contain a workflow to capture (e.g., they say "turn this into a skill"). If so, extract answers from the conversation first — the tools used, the sequence of steps, corrections the user made.

Key questions to answer:

1. **What should this skill enable an agent to do?** Be specific about the outcome.
2. **When should this skill trigger?** What user phrases or contexts should activate it.
3. **Which Matimo tools does it use?** These go in the `apply-to` frontmatter field.
4. **What's the expected workflow?** Step-by-step process the agent should follow.
5. **What are the common errors and edge cases?** These become the error handling section.

---

## Step 2: Interview and Research

Proactively ask about:

- **Edge cases:** What happens when inputs are missing or invalid?
- **Error handling:** Which errors are common and how to recover?
- **Best practices:** What patterns produce the best results?
- **Anti-patterns:** What should agents avoid doing?
- **Dependencies:** Does this skill require specific tools or providers?

If the skill relates to an existing Matimo provider, use `matimo_list_skills` to check what skills already exist. Use `matimo_get_skill` to read existing skills for reference patterns.

### Check Existing Skills

```
matimo_list_skills({ skills_dir: "./matimo-tools/skills" })
```

If a similar skill exists, consider extending it rather than creating a duplicate.

---

## Step 3: Write the SKILL.md

### Anatomy of a Skill

```
skill-name/
├── SKILL.md          (required — frontmatter + instructions)
├── scripts/          (optional — executable code for deterministic tasks)
├── references/       (optional — docs loaded into context as needed)
└── assets/           (optional — templates, icons, files used in output)
```

### Required YAML Frontmatter

```yaml
---
name: my-skill-name
description: "What this skill does and WHEN to use it. Be specific and slightly pushy — include trigger phrases so agents know when to activate this skill."
version: "1.0.0"
license: "MIT"
metadata:
  category: "Communication|Database|CRM|Marketing|Meta|DevOps"
  difficulty: "beginner|intermediate|advanced"
  apply-to: "tool_name_1 tool_name_2 tool_name_3"
---
```

### Frontmatter Rules

| Field | Required | Rules |
|-------|----------|-------|
| `name` | Yes | Lowercase letters, numbers, hyphens only. 1-64 chars. Must match directory name. No consecutive hyphens. |
| `description` | Yes | Max 1024 chars. Should describe WHAT the skill does AND WHEN to use it. |
| `version` | No | Semver format (e.g., `1.0.0`) |
| `license` | No | SPDX identifier (e.g., `MIT`, `Apache-2.0`) |
| `metadata.category` | No | Grouping category for catalog discovery |
| `metadata.difficulty` | No | `beginner`, `intermediate`, or `advanced` |
| `metadata.apply-to` | No | Space-delimited list of Matimo tool names this skill teaches |
| `compatibility` | No | Tool or environment requirements |
| `allowed-tools` | No | Restrict which tools the skill can reference |

### Description Writing Guide

The description is the **primary triggering mechanism** — it determines whether agents activate the skill. Make it specific and slightly "pushy":

**Bad:** `"Manage Slack messages."`

**Good:** `"Send effective messages to Slack channels — text, markdown, blocks, threads, reactions — and handle common errors. USE THIS SKILL whenever the user wants to send a Slack message, post to a channel, create a thread, or react to messages, even if they don't explicitly mention Slack tools."`

Include:
- What the skill does
- Specific contexts that should trigger it
- Adjacent tasks that should also trigger it

### Body Structure Template

```markdown
# Skill Title

Brief overview of what this skill teaches and why it matters.

## Tools You Will Use

| Tool | Purpose |
|------|---------|
| `tool-name` | What it does |

---

## Core Workflow

Step-by-step instructions for the primary use case.

### Required Parameters

| Parameter | Type | Description |
|-----------|------|-------------|

### Best Practices

1. **Do this.** Explain why.
2. **Avoid that.** Explain the consequence.

### Example: Primary Use Case

```json
{
  "param": "value"
}
```

---

## Common Patterns

### Pattern: Name

Description and example.

---

## Error Handling

| Error | Cause | Resolution |
|-------|-------|------------|

---

## Authentication

How auth works for the tools in this skill.
```

### Writing Guidelines

1. **Explain the WHY, not just the WHAT.** Agents with context make better decisions than agents following rigid rules.
2. **Use imperative form.** "Set the channel parameter" not "You should set the channel parameter."
3. **Include practical examples.** Real JSON examples agents can adapt, not abstract descriptions.
4. **Keep it under 500 lines.** If approaching this limit, split into references/ files with clear pointers.
5. **Use tables for structured data.** Parameters, errors, and status values are clearest in tables.
6. **Show the workflow sequence.** `Step 1 → Step 2 → Step 3` helps agents plan multi-tool operations.
7. **Cover error recovery.** Every tool call can fail — teach agents how to handle each failure mode.

### Progressive Disclosure Levels

Skills use a three-level loading system:

1. **Level 1 — Metadata** (name + description): Always in context (~100 words). Used for skill selection.
2. **Level 2 — SKILL.md body**: In context when skill triggers (<500 lines). Full instructions.
3. **Level 3 — Bundled resources**: Loaded on-demand (unlimited). Scripts, reference docs, assets.

Keep the most important information in the SKILL.md body. Move reference material, large examples, and scripts to bundled resources.

---

## Step 4: Validate

Before creating, validate the skill content:

```
matimo_validate_skill({
  name: "my-skill-name",
  skills_dir: "./matimo-tools/skills"
})
```

This checks:
- Name follows agentskills.io spec (lowercase, hyphens, 1-64 chars)
- Frontmatter has required fields (name, description)
- Frontmatter name matches directory name
- Description isn't too long
- Directory structure is valid
- Best practices are followed

Fix any validation errors before creating.

---

## Step 5: Create

Use `matimo_create_skill` to write the skill to disk:

```
matimo_create_skill({
  name: "my-skill-name",
  content: "---\nname: my-skill-name\ndescription: \"...\"\n---\n\n# My Skill\n\n...",
  target_dir: "./matimo-tools/skills"
})
```

The tool will:
1. Validate the name against the Agent Skills spec
2. Parse and validate the frontmatter
3. Ensure frontmatter name matches the directory name
4. Create the directory and write SKILL.md
5. Return the file path on success

### Important: Requires Approval

`matimo_create_skill` has `requires_approval: true`. The user must confirm before the skill is written to disk. Present the skill content for review before calling the tool.

---

## Step 6: Iterate

After creating, gather feedback:

1. **Read it back:** `matimo_get_skill({ name: "my-skill-name" })` to verify
2. **Ask for feedback:** "Does this capture the workflow correctly? Anything to add or change?"
3. **Improve:** Edit the SKILL.md based on feedback
4. **Re-validate:** `matimo_validate_skill` after each change

### Common Improvements

| Feedback | Action |
|----------|--------|
| "It's too generic" | Add specific examples with real parameter values |
| "Missing edge case X" | Add to error handling section |
| "Too long" | Move reference material to `references/` subdirectory |
| "Doesn't trigger when I expect" | Expand the description with more trigger phrases |
| "Missing tool Y" | Add to the `apply-to` frontmatter and document in body |

---

## Working with Existing Skills

### List All Skills

```
matimo_list_skills({
  skills_dir: "./matimo-tools/skills"
})
```

Returns Level 1 metadata for all skills — name, description, and optional fields.

### Read a Skill

```
matimo_get_skill({
  name: "skill-name",
  skills_dir: "./matimo-tools/skills"
})
```

Returns the full SKILL.md content plus a listing of bundled resources.

### Read a Bundled Resource

```
matimo_get_skill({
  name: "skill-name",
  file: "references/advanced-patterns.md"
})
```

Returns the content of a specific bundled file.

### Updating an Existing Skill

1. Read the current skill: `matimo_get_skill`
2. Modify the content
3. Re-create with `matimo_create_skill` (overwrites existing)
4. Validate with `matimo_validate_skill`

---

## Creating Provider-Specific Skills

When creating skills for a Matimo provider (Slack, GitHub, Notion, etc.):

1. **Check existing provider tools first.** List the provider's available tools to understand what capabilities exist.
2. **Group related tools.** A skill should cover 2-6 related tools that form a coherent workflow.
3. **Reference provider auth.** Include authentication setup in the skill (OAuth2 scopes, API keys, etc.).
4. **Include provider-specific quirks.** Rate limits, API constraints, naming conventions.

### Example: Creating a Slack Notification Skill

```yaml
---
name: slack-automated-notifications
description: "Set up automated notification workflows in Slack — deployment alerts, monitoring notifications, scheduled reports. USE THIS whenever the user wants to build notification automation, alert systems, or scheduled Slack messages."
version: "1.0.0"
license: "MIT"
metadata:
  category: "Communication"
  difficulty: "intermediate"
  apply-to: "slack_send_channel_message slack_reply_to_message"
---

# Slack Automated Notifications

## Tools You Will Use

| Tool | Purpose |
|------|---------|
| `slack_send_channel_message` | Post notification to a channel |
| `slack_reply_to_message` | Add context in a thread |

## Notification Patterns

### Deployment Alert

...best practices for deployment notifications...

### Error Alert

...escalation patterns, severity mapping...
```

---

## Adding Bundled Resources

For skills that need supporting files:

### Scripts (Deterministic Tasks)

Put executable code in `scripts/` for repetitive operations:

```
my-skill/
├── SKILL.md
└── scripts/
    ├── validate-input.py
    └── generate-template.sh
```

Reference from SKILL.md: "Run the validation script at `scripts/validate-input.py` to check input format."

### References (Extended Documentation)

Put long-form docs in `references/` to keep SKILL.md focused:

```
my-skill/
├── SKILL.md
└── references/
    ├── advanced-patterns.md
    ├── error-codes.md
    └── api-quirks.md
```

Reference from SKILL.md: "For advanced error handling, read `references/error-codes.md`."

### Assets (Templates and Files)

Put reusable templates in `assets/`:

```
my-skill/
├── SKILL.md
└── assets/
    ├── email-template.html
    └── report-template.md
```

---

## Quality Checklist

Before finalizing a skill, verify:

- [ ] **Name** follows spec: lowercase, hyphens, 1-64 chars, no consecutive hyphens
- [ ] **Description** is specific and includes trigger phrases (under 1024 chars)
- [ ] **Frontmatter name matches directory name**
- [ ] **Tools referenced in body are listed in `apply-to`**
- [ ] **At least one concrete example** with real parameter values
- [ ] **Error handling section** covers common failure modes
- [ ] **Authentication section** if tools require auth
- [ ] **Under 500 lines** (or uses references/ for overflow)
- [ ] **Validated** with `matimo_validate_skill` — zero errors

---

## Anti-Patterns to Avoid

| Anti-Pattern | Why It's Bad | Do Instead |
|--------------|-------------|------------|
| Vague description | Agent won't trigger the skill | Be specific about WHEN to use it |
| No examples | Agent guesses parameter values | Include at least 2-3 real examples |
| Missing error handling | Agent fails silently | Document every common error and recovery |
| Duplicating existing skill | Fragmenting knowledge | Extend existing skills or create references/ |
| Over 500 lines | Slow to load, hard to maintain | Split into SKILL.md + references/ |
| Using ALWAYS/NEVER in caps | Rigid, brittle instructions | Explain the WHY so the agent can reason |
| No `apply-to` field | Skill disconnected from tools | List every tool the skill teaches |
