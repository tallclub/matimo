---
name: skills-catalog
description: "Discover, search, and use skills from the Matimo Skills Catalog — browse provider skills, core skills, and user-created skills. USE THIS SKILL whenever the you(agent) asks what skills are available, wants to find a skill for a specific task, needs to understand what a skill does, or wants to browse the skill catalog."
version: "1.0.0"
license: "MIT"
metadata:
  category: "Meta"
  difficulty: "beginner"
  apply-to: "matimo_list_skills matimo_get_skill"
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

Bundled with provider packages. Teach agents how to use specific providers effectively.

| Provider | Skills | Focus |
|----------|--------|-------|
| **Slack** | `slack-channel-messaging`, `slack-channel-management`, `slack-user-interaction` | Messaging, channels, users |
| **GitHub** | `github-pr-workflow`, `github-issue-management`, `github-repository-management`, `github-code-search` | PRs, issues, repos, search |
| **Notion** | `notion-database-operations`, `notion-content-management` | Databases, pages |
| **HubSpot** | `hubspot-contact-management`, `hubspot-deal-pipeline`, `hubspot-crm-entities` | CRM contacts, deals, entities |
| **Gmail** | `gmail-email-sending`, `gmail-inbox-management` | Send/draft, search/read |
| **Twilio** | `twilio-sms-messaging` | SMS, MMS, delivery tracking |
| **Postgres** | `postgres-query-operations` | SQL queries, schema discovery |
| **Mailchimp** | `mailchimp-campaign-management`, `mailchimp-audience-management` | Campaigns, subscribers |

### 3. User-Created Skills

Created at runtime by agents or users. Stored in `./matimo-tools/skills/` by default.

---

## Discovering Skills

### List All Available Skills

Use `matimo_list_skills` to get Level 1 metadata for all skills in a directory:

```
matimo_list_skills({
  skills_dir: "./matimo-tools/skills"
})
```

Returns each skill's name, description, and optional metadata (license, category, difficulty).

### Read a Specific Skill

Use `matimo_get_skill` for Level 2 activation — the full SKILL.md content:

```
matimo_get_skill({
  name: "slack-channel-messaging",
  skills_dir: "./matimo-tools/skills"
})
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
| Send a Slack message | `slack-channel-messaging` |
| Create a GitHub PR | `github-pr-workflow` |
| Query a database | `postgres-query-operations` |
| Send an email | `gmail-email-sending` |
| Send an SMS | `twilio-sms-messaging` |
| Create a marketing campaign | `mailchimp-campaign-management` |
| Manage CRM contacts | `hubspot-contact-management` |
| Create a Notion page | `notion-content-management` |
| Create a new skill | `skill-creator` |
| Find available tools | `tool-discovery` |
| Create a new tool | `tool-creation` |

### By Category

| Category | Skills |
|----------|--------|
| Communication | `slack-*`, `gmail-*`, `twilio-*` |
| Developer Tools | `github-*`, `postgres-*` |
| CRM & Marketing | `hubspot-*`, `mailchimp-*` |
| Productivity | `notion-*` |
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
