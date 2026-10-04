---
name: skills-catalog
description: "Discover, search, and use skills from the Matimo Skills Catalog — browse provider skills, core skills, and user-created skills. USE THIS SKILL whenever the you(agent) asks what skills are available, wants to find a skill for a specific task, needs to understand what a skill does, or wants to browse the skill catalog."
version: "1.0.0"
license: "MIT"
metadata:
  category: "Meta"
  difficulty: "beginner"
  apply-to: "matimo_list_skills matimo_get_skill matimo_search_skills matimo_get_skill_sections matimo_get_skill_content"
---

# Skills Catalog

This skill teaches you how to **discover, browse, and use** skills from the Matimo Skills Catalog.

## What Are Skills?

Skills are structured instructions (SKILL.md files) that teach agents HOW to use tools effectively. While tools define WHAT can be done, skills teach:

- **When** to use each tool
- **How** to combine tools into workflows
- **What** parameters to use for common scenarios
- **How** to handle errors and edge cases
- **Best practices** that produce the best results

---

## Skill Sources

Matimo has three sources of skills:

### 1. Core Skills (Built-in)

Shipped with the Matimo SDK. Always available. Teach agents about Matimo itself.

| Skill | What It Teaches |
|-------|-----------------|
| `skill-creator` | How to create new skills at runtime |
| `skills-catalog` | How to discover and use skills (this skill) |
| `tool-discovery` | How to find and manage available tools |
| `tool-creation` | How to create new tool definitions |
| `meta-tools-lifecycle` | Tool lifecycle management |
| `policy-validation` | Policy and approval workflows |

### 2. Provider Skills

Each provider package ships one skill, named after the provider, covering all of its tools. It is available when the package is installed and loaded.

| Skill | Package | Focus |
|-------|---------|-------|
| `slack` | `@matimo/slack` | Messages, channels, threads, reactions, files, users |
| `gmail` | `@matimo/gmail` | Send, draft, list, read and delete email |
| `github` | `@matimo/github` | Repositories, issues, pull requests, releases, code search |
| `notion` | `@matimo/notion` | Search, query databases, create and update pages |
| `hubspot` | `@matimo/hubspot` | CRM contacts, companies, deals, tickets and more |
| `mailchimp` | `@matimo/mailchimp` | Audiences, subscribers, campaigns |
| `twilio` | `@matimo/twilio` | SMS, MMS, message history |
| `postgres` | `@matimo/postgres` | SQL queries, schema discovery, safe writes |
| `microsoft` | `@matimo/microsoft` | Mail, OneDrive/SharePoint, Teams, calendar |
| `composio` | `@matimo/composio` | The governed Composio catalog |

### 3. User-Created Skills

Created at runtime by agents or users. Stored in `./matimo-tools/skills/` by default.

---

## Discovering Skills

### List All Available Skills

Use `matimo_list_skills` to get Level 1 metadata for every loaded skill (core, installed providers, and any skill paths the app configured). Pass `skills_dir` to list a specific directory instead:

```
matimo_list_skills({})
matimo_list_skills({ skills_dir: "./matimo-tools/skills" })
```

Returns each skill's name, description, and optional metadata (license, category, difficulty).

### Read a Specific Skill

Use `matimo_get_skill` for Level 2 activation — the full SKILL.md content:

```
matimo_get_skill({ name: "slack" })
```

Returns the complete skill instructions plus a listing of any bundled resources.

### Read Bundled Resources

Use `matimo_get_skill` with a `file` parameter for Level 3 access:

```
matimo_get_skill({
  name: "my-skill",
  file: "references/advanced-patterns.md"
})
```

---

## Choosing the Right Skill

### By Task Type

| Task | Skill to Use |
|------|-------------|
| Send a Slack message | `slack` |
| Create a GitHub PR | `github` |
| Query a database | `postgres` |
| Send an email | `gmail` (or `microsoft` for Outlook) |
| Send an SMS | `twilio` |
| Create a marketing campaign | `mailchimp` |
| Manage CRM contacts | `hubspot` |
| Create a Notion page | `notion` |
| Create a new skill | `skill-creator` |
| Find available tools | `tool-discovery` |
| Create a new tool | `tool-creation` |

Not sure which skill fits? `matimo_search_skills({ query: "send an SMS" })` ranks skills by relevance, and `matimo_get_skill_content({ name, sections: [...] })` loads only the sections you need.

### By Category

| Category | Skills |
|----------|--------|
| Communication | `slack`, `gmail`, `twilio`, `microsoft` |
| Developer Tools | `github`, `postgres` |
| CRM & Marketing | `hubspot`, `mailchimp` |
| Productivity | `notion`, `microsoft` |
| Third-party catalog | `composio` |
| Meta (Matimo) | `skill-creator`, `skills-catalog`, `tool-*`, `policy-*` |

---

## Progressive Disclosure

Skills load in three levels to keep context efficient:

### Level 1: Discovery (Always Visible)
- Name, description, category, difficulty
- Used to decide WHICH skill to activate
- Loaded via `matimo_list_skills`

### Level 2: Activation (On Trigger)
- Full SKILL.md body with workflows, examples, error handling
- Loaded via `matimo_get_skill`
- Contains everything needed to execute the skill

### Level 3: Resources (On Demand)
- Scripts, reference docs, templates, assets
- Loaded via `matimo_get_skill` with `file` parameter
- Used for extended documentation or executable code

### When to Load Each Level

1. **User asks "what can you do?"** → Level 1: List skills with descriptions
2. **User asks to do a specific task** → Level 2: Load the matching skill's full instructions
3. **Skill references a resource file** → Level 3: Load the specific file on demand

---

## Creating New Skills

Want to create a custom skill? Use the `skill-creator` skill. It guides you through:

1. Capturing intent and requirements
2. Interviewing for edge cases
3. Writing the SKILL.md with proper frontmatter
4. Validating against the Agent Skills spec
5. Iterating based on feedback

```
matimo_get_skill({ name: "skill-creator" })
```

---

## Skill Quality Indicators

When browsing skills, look for:

| Indicator | Good Sign |
|-----------|-----------|
| **Specific description** | Includes trigger phrases and use cases |
| **Concrete examples** | Real JSON examples with realistic parameter values |
| **Error handling section** | Documents common errors and recovery steps |
| **Best practices** | Practical tips beyond just parameter docs |
| **apply-to field** | Clearly linked to specific Matimo tools |
| **Under 500 lines** | Focused, uses references/ for overflow |
