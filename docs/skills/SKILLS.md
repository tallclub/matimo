# Skills System

> Complete guide to the Matimo Skills System — what skills are, how they are structured, how agents create and use them, and how they comply with the Agent Skills specification.

## Table of Contents

- [When to Use Skills](#when-to-use-skills)
- [Overview](#overview)
- [Skills vs Tools](#skills-vs-tools)
- [SKILL.md Format](#skillmd-format)
  - [Frontmatter Fields](#frontmatter-fields)
  - [Spec-Compliant Frontmatter](#spec-compliant-frontmatter)
  - [Progressive Disclosure Levels](#progressive-disclosure-levels)
  - [Minimal Valid Example](#minimal-valid-example)
- [Provider Skills (One Per Provider)](#provider-skills-one-per-provider)
- [Built-in SDK Skills](#built-in-sdk-skills)
- [Content Chunking & Smart Context](#content-chunking--smart-context)
  - [getSkillContent() — Selective Loading](#getskillcontent--selective-loading)
  - [getSkillSections() — Section Inventory](#getskillsections--section-inventory)
- [Semantic Search](#semantic-search)
  - [Built-in TF-IDF Search](#built-in-tf-idf-search)
  - [Custom Embedding Provider](#custom-embedding-provider)
- [Agent Skill Lifecycle](#agent-skill-lifecycle)
  - [Creating a Skill](#creating-a-skill)
  - [Listing Skills](#listing-skills)
  - [Reading a Skill](#reading-a-skill)
  - [Validating a Skill](#validating-a-skill)
- [MCP Server — Skills as Resources](#mcp-server--skills-as-resources)
- [LangChain Agent with Skills](#langchain-agent-with-skills)
- [Storage Paths](#storage-paths)
- [Name Rules](#name-rules)
- [Examples Demo](#examples-demo)
- [Coming in Next Release (alpha.14)](#coming-in-next-release-alpha14)

---

## Coming in Next Release (alpha.14)

> **Theme: Skills SDK as Agent-Callable Tools** — Promote programmatic SDK APIs to first-class agent-callable meta-tools, closing the gap between what the SDK can do and what agents can call from their tool loop.

### New Meta-Tools

| Meta-Tool | Wraps SDK API | What agents gain |
|-----------|--------------|-----------------|
| `matimo_search_skills` | `semanticSearchSkills()` | Natural language semantic search across all skills (TF-IDF or custom embeddings) |
| `matimo_get_skill_sections` | `getSkillSections()` | Inventory a skill's sections and token costs before loading (progressive disclosure Level 2.5) |
| `matimo_get_skill_content` | `getSkillContent()` | Load only specific sections of a skill — token-efficient context loading |

**Why this matters:** Today `semanticSearchSkills`, `getSkillSections`, and `getSkillContent` are SDK-only. LangChain agents and MCP clients (Claude) cannot call them from their tool loop. alpha.14 wraps each as a registered meta-tool in `packages/core/tools/`, making them callable like any other Matimo tool.

### Agent Workflow Upgrade (after alpha.14)

```typescript
// Current (alpha.13) — agents discover by exact name only
matimo_list_skills()              // → all skill names + descriptions
matimo_get_skill('slack')         // → full content

// alpha.14 — agents can search by meaning and load selectively
matimo_search_skills('rate limiting and retries')  // → ranked TF-IDF results with scores
matimo_get_skill_sections('slack')                 // → section inventory with token estimates
matimo_get_skill_content('slack', { sections: ['Messaging'] })  // → targeted section content
```

### Example Coverage Additions

- **`skills-demo.ts`** — add `getSkillSections()` demo, `getSkillContent(name, { sections })` demo, and `setSkillEmbeddingProvider(provider)` demo
- **`langchain-skills-policy-agent.ts`** — update system prompt to mention `matimo_search_skills` so agents can discover skills by meaning from their tool loop

### Context Window Tooling

- **Dynamic tool filtering** — when `autoDiscover` loads 128+ tools (at OpenAI's hard limit), a utility to select a subset by provider/tag before binding to LangChain prevents silent tool drops at the API limit

### Acceptance Criteria

- `matimo_search_skills`, `matimo_get_skill_sections`, `matimo_get_skill_content` registered in `packages/core/tools/`
- Agent in `pnpm agent:skills` can call `matimo_search_skills` with a natural language query and get ranked results
- All 3 new meta-tools have tests in `packages/core/test/unit/meta-tools/`
- `META_TOOLS.md` updated with reference entries for the 3 new tools

---

## When to Use Skills

### Decision Guide

| Situation | Use Skills? | Why |
|-----------|:-----------:|-----|
| Agent needs domain knowledge at runtime (how to use Slack, Postgres patterns) | ✅ Yes | Pull knowledge on demand without bloating the system prompt |
| Agent must execute an API call or shell command | ❌ No | Use a tool (YAML `definition.yaml`) |
| Knowledge varies per user / per session | ✅ Yes | Agent reads the right skill for the task, not a static prompt |
| You want the same guidelines reused by multiple agents | ✅ Yes | Write once in SKILL.md, any agent can discover and load it |
| Knowledge is static and always relevant to every request | ❌ No | Put it in the system prompt instead |
| You need structured, versioned, sharable agent expertise | ✅ Yes | Skills are files — version-controlled, composable, shareable |

### Real-World Use Cases

**Use Case 1 — Slack messaging agent**
Without skills: System prompt contains 500 lines of Slack API guidelines (always in context, always costs tokens).
With skills: Agent calls `matimo_get_skill("slack")` only when it needs to send a message — loads 500 lines on demand and discards them after.

**Use Case 2 — Multi-provider agent (Slack + GitHub + Postgres)**
Agent serves many domains. At startup, list all skills (Level 1 — ~50 tokens each). When the user asks about GitHub, agent reads only the `github` skill (Level 2). When user switches to Postgres, agent reads `postgres`. Total context = only the active skill, not all three simultaneously.

**Use Case 3 — Code review assistant**
Agent creates a `code-review` skill at runtime (via `matimo_create_skill`) containing your team's specific checklist. Every code review session starts by reading that skill. Update the SKILL.md to immediately change agent behavior — no redeployment.

**Use Case 4 — Compliance-aware agent**
A security team packages OWASP Top 10 rules as a `security-checklist` skill. Any agent in the org can discover and apply it. When rules update, update one file.

**Use Case 5 — Dynamic skill selection based on task**
Agent receives a broad request: "Help me with infrastructure". It calls `matimo_list_skills`, sees `postgres` and `tool-creation` skills, picks the relevant one based on context, and loads only that — the LLM never sees the others.

### Benefits vs Alternatives

| Approach | Context Cost | Reusability | Updateable at Runtime | Discoverable by Agent |
|----------|:---:|:---:|:---:|:---:|
| Static system prompt | Always full cost | ❌ | Needs redeploy | ❌ |
| RAG / vector search | High infra cost | Partial | ✅ | ❌ |
| **Matimo Skills** | Only when used | ✅ | ✅ (edit SKILL.md) | ✅ |

---

## Overview

A **skill** is a structured knowledge file (`SKILL.md`) that teaches an agent *how to do something* — guidelines, patterns, checklists, and rules written in Markdown. Skills are distinct from tools: tools execute actions, skills provide context and guidance.

Matimo supports the [Agent Skills specification](https://agentskills.io/specification) (`agentskills.io`) for SKILL.md formatting and validation.

**Key idea:** Skills encode domain knowledge once. Agents can list, read, and apply skills at runtime — without re-reading long system prompts.

```
SDK Developer writes SKILL.md          Agent at runtime
────────────────────────────           ───────────────────────────
packages/core/skills/                  matimo_list_skills()
  tool-creation/SKILL.md      →         matimo_get_skill("tool-creation")
  policy-validation/SKILL.md            matimo_create_skill(name, content)
  meta-tools-lifecycle/SKILL.md         matimo_validate_skill(name)
  tool-discovery/SKILL.md
```

---

### Skill vs Tool Decision Flowchart

```
Does it need to RUN something (API call, DB query, command)?
  ├─ YES → Use a Tool (definition.yaml)
  └─ NO  → Does it need to TEACH the agent something?
             ├─ YES → Use a Skill (SKILL.md)
             └─ NO  → Put it in the system prompt
```

---

## Skills vs Tools

| | **Skill** | **Tool** |
|---|---|---|
| **File** | `SKILL.md` | `definition.yaml` |
| **Purpose** | Teach agent guidelines | Execute an action |
| **Content** | Markdown prose + examples | YAML execution spec |
| **Runtime effect** | Agent reads and applies | Agent calls → side effect |
| **Policy gated?** | No | Yes |
| **Approval required?** | Create: yes (meta-tool) | Create + approve: yes |
| **SDK location** | `packages/core/skills/` | `packages/{provider}/tools/` |
| **Agent location** | `./matimo-tools/skills/` | `./matimo-tools/` |

---

## SKILL.md Format

Every skill is a Markdown file with YAML frontmatter at the top, stored as:

```
{skills_dir}/
  {skill-name}/
    SKILL.md
```

### Frontmatter Fields

The [Agent Skills spec](https://agentskills.io/specification) defines the following valid top-level frontmatter fields:

| Field | Required | Description |
|-------|:--------:|-------------|
| `name` | Yes | Skill identifier (lowercase, hyphens, ≤64 chars) |
| `description` | Yes | One or two sentences describing what the skill teaches |
| `license` | No | SPDX identifier (e.g., `MIT`, `Apache-2.0`) |
| `compatibility` | No | Compatible agent frameworks or versions |
| `metadata` | No | Arbitrary key-value object for non-spec fields |
| `allowed-tools` | No | List of tool names the skill may reference or invoke |

### Spec-Compliant Frontmatter

> ⚠️ **Only six keys are valid at the top level.** Custom fields (`category`, `difficulty`, `applyTo`, `user-invokable`) must go under `metadata:` — placing them at top level violates the spec and will fail `matimo_validate_skill`.

```yaml
---
name: code-review
description: Guidelines for systematic code review focusing on correctness, security, and maintainability.
license: MIT
metadata:
  category: "Engineering"
  difficulty: "intermediate"
  apply-to: "review, pull-request"
---
```

❌ **Wrong — non-spec fields at top level:**

```yaml
---
name: code-review
description: ...
category: Engineering        # ❌ not a spec field
difficulty: intermediate     # ❌ not a spec field
---
```

### Matimo's Progressive Disclosure Levels

The spec defines three levels of detail an agent loads:

| Level | Operation | What agent gets |
|-------|-----------|-----------------|
| **1** | `matimo_list_skills` | Name + description only |
| **2** | `matimo_get_skill` | Full SKILL.md content |
| **3** | Resources (scripts, assets) | Additional files alongside SKILL.md |

Agents should use Level 1 first to survey available skills, then Level 2 to load the one they need — minimising context window usage.

### Minimal Valid Example

```markdown
---
name: api-error-handling
description: Patterns for handling API errors gracefully in TypeScript services.
---

# API Error Handling

## When to Apply

Apply when writing HTTP client code that calls external APIs.

## Required Patterns

- Always check `response.ok` before parsing the body
- Log the status code and URL on failure (never the response body if it may contain secrets)
- Use `MatimoError` with appropriate `ErrorCode` for structured errors
- Retry only on `429` and `5xx`, never on `4xx`

## Example

```typescript
const response = await fetch(url);
if (!response.ok) {
  throw new MatimoError(
    `API request failed: ${response.status}`,
    ErrorCode.EXECUTION_FAILED,
    { statusCode: response.status, url }
  );
}
```
```

---

## Provider Skills (One Per Provider)

Every Matimo provider package ships **one consolidated skill** containing domain knowledge for all of that provider's tools. This keeps the skill registry compact and gives agents a single entry point per provider.

| Provider | Skill Name | Path | Covers |
|----------|-----------|------|--------|
| **Slack** | `slack` | `packages/slack/skills/slack/SKILL.md` | 16 tools — channels, messages, reactions, threads, DMs, pins, bookmarks, reminders |
| **GitHub** | `github` | `packages/github/skills/github/SKILL.md` | Issues, PRs, code search, repositories |
| **Gmail** | `gmail` | `packages/gmail/skills/gmail/SKILL.md` | Email sending, inbox management, drafts, threads |
| **HubSpot** | `hubspot` | `packages/hubspot/skills/hubspot/SKILL.md` | Contacts, companies, deals, CRM entities |
| **Mailchimp** | `mailchimp` | `packages/mailchimp/skills/mailchimp/SKILL.md` | Audiences, subscribers, campaigns |
| **Notion** | `notion` | `packages/notion/skills/notion/SKILL.md` | Pages, databases, blocks, search |
| **Postgres** | `postgres` | `packages/postgres/skills/postgres/SKILL.md` | Parameterized queries, schema discovery, write operations |
| **Twilio** | `twilio` | `packages/twilio/skills/twilio/SKILL.md` | SMS/MMS sending, message tracking, E.164 formatting |

**Why one skill per provider?**
- Agents load one skill to get comprehensive knowledge for all tools in that provider
- Reduces registry noise — 8 skills instead of 24+ individual tool skills
- Content chunking lets agents load only the sections they need (see below)

---

## Built-in SDK Skills

Matimo ships six SDK-level skills in `packages/core/skills/`. These are designed for agents and VS Code Copilot, not end-user runtimes.

| Skill | Path | Purpose |
|-------|------|---------|
| `tool-creation` | `packages/core/skills/tool-creation/SKILL.md` | How to write correct YAML tool definitions — includes policy warnings, auth patterns, required fields |
| `policy-validation` | `packages/core/skills/policy-validation/SKILL.md` | Security rules, blocked patterns (command/function types, SSRF), default policy values |
| `meta-tools-lifecycle` | `packages/core/skills/meta-tools-lifecycle/SKILL.md` | The complete create → validate → approve → reload lifecycle using meta-tools |
| `tool-discovery` | `packages/core/skills/tool-discovery/SKILL.md` | Tool listing, risk levels, status states, how to query the registry |
| `skill-creator` | `packages/core/skills/skill-creator/SKILL.md` | How to create SKILL.md files following the Agent Skills spec |
| `skills-catalog` | `packages/core/skills/skills-catalog/SKILL.md` | Catalog of all available skills and their purposes |

### Key Guidance in `tool-creation` Skill

- **Never use placeholder API keys** (`YOUR_API_KEY`, `replace_me`) — use `{VAR_NAME}` templating
- **`command` and `function` types are blocked by default** (`allowCommandTools: false`, `allowFunctionTools: false`) — always use `type: http` unless policy explicitly allows otherwise
- **Always include `requires_approval: true`** in agent-generated YAML
- **Query-param API keys** need `query_params: { key: '{VAR_NAME}' }` + `authentication: { type: api_key, location: query }`

---

## Content Chunking & Smart Context

Skills can be large (200+ lines). Dumping an entire SKILL.md into the LLM context wastes tokens. Matimo's content parser splits skills into sections automatically, and agents can load only what they need.

### getSkillContent() — Selective Loading

Load specific sections of a skill by heading name:

```typescript
// Load only "Error Handling" and "Parameterized Queries" sections
const content = matimo.getSkillContent('postgres', {
  sections: ['Error Handling', 'Parameterized Queries'],
  maxTokens: 500,
});
// Returns concatenated content from those sections only

// Load everything (equivalent to getSkill().content)
const full = matimo.getSkillContent('postgres');
```

**`SkillContentOptions`:**

```typescript
interface SkillContentOptions {
  /** Load only these section headings (case-insensitive substring match) */
  sections?: string[];
  /** Truncate output to approximately this many tokens (1 token ≈ 4 chars) */
  maxTokens?: number;
}
```

### getSkillSections() — Section Inventory

Before loading content, agents can inventory a skill's sections to decide what's relevant:

```typescript
const sections = matimo.getSkillSections('slack');
// Returns:
// [
//   { path: 'Channel Operations', level: 2, tokenEstimate: 120 },
//   { path: 'Messaging', level: 2, tokenEstimate: 200 },
//   { path: 'Messaging > Thread Replies', level: 3, tokenEstimate: 80 },
//   { path: 'Reactions & Pins', level: 2, tokenEstimate: 90 },
//   ...
// ]
```

This enables a two-step agent workflow:
1. `getSkillSections('slack')` — see what's available and token costs
2. `getSkillContent('slack', { sections: ['Messaging'] })` — load only what's needed

---

## Semantic Search

Matimo provides embedding-based search across all registered skills, so agents can find relevant knowledge by meaning rather than exact keywords.

### Built-in TF-IDF (Term Frequency - Inverse Document Frequency) Search

The default provider uses zero-dependency TF-IDF embeddings with cosine similarity:

```typescript
// Find skills related to a natural language query
const results = await matimo.semanticSearchSkills('How do I handle Postgres locking?');
// Returns:
// [
//   { skill: { name: 'postgres', description: '...' }, score: 0.82 },
//   { skill: { name: 'policy-validation', description: '...' }, score: 0.31 },
// ]

// With options
const results = await matimo.semanticSearchSkills('rate limiting and retries', {
  limit: 3,        // Max results (default: 5)
  minScore: 0.3,   // Minimum relevance threshold (default: 0.1)
});
```

Embeddings are cached per skill — the first search builds the index, subsequent searches are fast.

> **Agent availability:** `semanticSearchSkills` is a **programmatic SDK API** — it is not yet exposed as an agent-callable meta-tool. Agents using LangChain or MCP cannot call TF-IDF search during their tool loop today. Use `buildRelevantSkillPrompt()` (non-MCP LangChain) or the [`matimo_list_skills` + `matimo_get_skill` meta-tools](#agent-skill-lifecycle) instead. A `matimo_search_skills` meta-tool that wraps this API is planned for alpha.14.

### Custom Embedding Provider

Replace the built-in TF-IDF with OpenAI, Cohere, or any other embedding model:

```typescript
import type { EmbeddingProvider } from 'matimo';

class OpenAIEmbeddingProvider implements EmbeddingProvider {
  async embed(texts: string[]): Promise<number[][]> {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: texts,
    });
    return response.data.map(d => d.embedding);
  }
}

matimo.setSkillEmbeddingProvider(new OpenAIEmbeddingProvider());

// Now semantic search uses OpenAI embeddings
const results = await matimo.semanticSearchSkills('How do I send a Slack message?');
```

---

## Agent Skill Lifecycle

### Creating a Skill

```typescript
// Agent creates a skill at runtime
const result = await matimo.execute('matimo_create_skill', {
  name: 'data-validation',
  content: `---
name: data-validation
description: Patterns for validating user input and external API responses with Zod.
---

# Data Validation Guidelines

Always use Zod for runtime validation. Never trust user input without Zod parsing.
`,
  target_dir: './agent-skills',   // optional, defaults to ./matimo-tools/skills
});
// result.success → true
// result.path → './agent-skills/data-validation/SKILL.md'
```

**Requires human approval** — `matimo_create_skill` has `requires_approval: true`.

### Listing Skills

```typescript
// Discover available skills (Level 1: name + description only)
const result = await matimo.execute('matimo_list_skills', {
  skills_dir: './agent-skills',   // optional, defaults to ./matimo-tools/skills
});
// result.skills → [{ name, description, path }, ...]
// result.total → number
```

### Reading a Skill

```typescript
// Load full content (Level 2)
const result = await matimo.execute('matimo_get_skill', {
  name: 'data-validation',
  skills_dir: './agent-skills',
});

if (result.success) {
  // result.content → full SKILL.md text the agent can apply
  // result.description → frontmatter description
}
```

### Validating a Skill

```typescript
// Check spec compliance
const result = await matimo.execute('matimo_validate_skill', {
  name: 'data-validation',
  skills_dir: './agent-skills',
});

if (result.valid) {
  // Spec-compliant
} else {
  // result.issues → [{ level: 'error' | 'warning', message }]
}
```

Validation checks:
- `SKILL.md` exists in `{skills_dir}/{name}/`
- Frontmatter is parseable YAML
- `name` field present and matches directory name
- `description` field present
- Name follows spec rules (lowercase, hyphens, 1–64 chars, no leading/trailing hyphens)

---

## MCP Server — Skills as Resources

When the Matimo MCP server is running, every registered skill is automatically exposed as an **MCP Resource** under the `skills://` URI scheme. MCP clients (Claude Desktop, Cursor, Windsurf, any MCP-compliant client) can read skill content without calling a tool — they use the Resources protocol directly.

### Resource URIs

Each skill gets a resource at:
```
skills://{skill-name}
```

| Skill | URI | MIME type |
|-------|-----|-----------|
| `slack` | `skills://slack` | `text/markdown` |
| `github` | `skills://github` | `text/markdown` |
| `tool-creation` | `skills://tool-creation` | `text/markdown` |
| `code-review` _(agent-created)_ | `skills://code-review` | `text/markdown` |

All skills registered in Matimo — built-in SDK skills, provider skills, and agent-created skills — are exposed automatically. No configuration required.

### How Claude accesses skills

With the MCP server running (`npx matimo mcp`), Claude has two complementary ways to access skills:

**Via Resources (passive read):**
Claude can browse and read `skills://` resources without invoking a tool. The content is the full `SKILL.md` text. This is equivalent to Level 2 in the progressive disclosure model — full content on demand.

**Via Meta-Tools (agent-driven discovery):**
Claude can also use the skill meta-tools to actively discover and interact with skills:
- `matimo_list_skills` → Level 1 metadata (names + descriptions)
- `matimo_get_skill` → Level 2 full content (same as reading the resource)
- `matimo_create_skill` → create a new skill (writes to disk + registers new resource)
- `matimo_validate_skill` → check spec compliance

The practical difference: reading a `skills://` resource is a direct read by the MCP client; calling `matimo_get_skill` is an agent tool call that goes through Matimo's execution layer.

### Hot-reload

When `matimo.reloadTools()` is called (e.g. after `matimo_create_skill` writes a new skill to disk), the MCP server:

1. Removes stale skill resource registrations
2. Re-registers all current skills from `matimo.listSkills()`
3. Calls `sendResourceListChanged()` — MCP clients receive an automatic notification and refresh their resource list

Agents and clients never need to reconnect to see newly created skills.

### Starting the MCP server

```bash
# Expose all tools + skills over stdio (for Claude Desktop, Cursor, Windsurf)
npx matimo mcp

# Or HTTP mode (remote / Docker)
npx matimo mcp --transport http --port 3000
```

After connecting, Claude sees:
- All tools in the standard MCP `tools/list`
- All skills as resources in `resources/list` under `skills://*`

See [MCP documentation](../MCP.md) for the full server setup guide.

---

## LangChain Agent with Skills

Skills are pull-based — they're not auto-injected into LLM context. Instead, agents discover and load skills at runtime using meta-tools. Here's a complete LangChain agent that uses skills as context:

```typescript
import { MatimoInstance, convertToolsToLangChain } from 'matimo';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage, ToolMessage } from '@langchain/core/messages';
import type { ToolDefinition } from 'matimo';

// Initialize Matimo with skills auto-loaded from providers
const matimo = await MatimoInstance.init({ autoDiscover: true });

// Convert tools to LangChain format (includes skill meta-tools)
const tools = matimo.listTools();
const langchainTools = await convertToolsToLangChain(tools as ToolDefinition[], matimo);

const llm = new ChatOpenAI({ model: 'gpt-4o-mini', temperature: 0 });
const llmWithTools = llm.bindTools(langchainTools);

// The agent can now autonomously:
// 1. matimo_list_skills() — discover available skills
// 2. matimo_get_skill('slack') — load the Slack skill for context
// 3. Use skill knowledge to correctly call Slack tools
// 4. matimo_create_skill() — create new skills from experience

const messages = [
  new SystemMessage(`You have access to Matimo skills and tools.
    Use matimo_list_skills to discover domain knowledge.
    Use matimo_get_skill to load a skill before working in that domain.`),
  new HumanMessage('Send a message to #general in Slack saying "Hello from Matimo"'),
];

// Agent loop — LLM discovers skills, loads context, then acts
let response = await llmWithTools.invoke(messages);
while (response.tool_calls?.length) {
  messages.push(response);
  for (const call of response.tool_calls) {
    const result = await matimo.execute(call.name, call.args);
    messages.push(new ToolMessage({
      tool_call_id: call.id || '',
      content: JSON.stringify(result),
      name: call.name,
    }));
  }
  response = await llmWithTools.invoke(messages);
}
console.log(response.content);
```

**The agent workflow:**
1. LLM calls `matimo_list_skills` → gets names/descriptions of all 8 provider skills + 6 core skills
2. LLM calls `matimo_get_skill('slack')` → loads full Slack domain knowledge (channels, messages, threads, etc.)
3. LLM now has context to correctly call `slack_send_channel_message` with the right parameters
4. No skill content is wasted on providers the agent doesn't need

**Non-MCP usage — programmatic progressive disclosure:**

When running LangChain without an MCP server, use the two helper functions to implement the same progressive disclosure pattern in code:

```typescript
import {
  MatimoInstance,
  getSkillsMetadata,
  buildRelevantSkillPrompt,
} from 'matimo';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';

// Level 1 — once at startup (token-safe, names + descriptions only)
const meta = getSkillsMetadata(matimo);
const metaBlock = meta.map((s) => `- **${s.name}**: ${s.description}`).join('\n');

// Level 2 — per request via TF-IDF semantic search (loads only relevant skills)
const userMessage = 'How do I handle rate limits in Slack?';
const skillContext = await buildRelevantSkillPrompt(matimo, userMessage, {
  topK: 2,       // load at most 2 skills
  minScore: 0.3, // ignore skills below this relevance
});

const messages = [
  new SystemMessage(`You are a helpful agent.\n\nAvailable skills:\n${metaBlock}`),
  ...(skillContext ? [new SystemMessage(skillContext)] : []),
  new HumanMessage(userMessage),
];
```

`getSkillsMetadata` returns `Array<{ name, description }>` — no file I/O, always cheap.  
`buildRelevantSkillPrompt` runs TF-IDF cosine similarity ranking and loads full content only for top-K matches above `minScore`. Returns an empty string when no skills are relevant, so it's safe to spread into the messages array unconditionally.

See the [LangChain integration guide](../framework-integrations/LANGCHAIN.md#skills-integration-non-mcp) for the full API reference and examples.

---

## Storage Paths

| Context | Default path |
|---------|-------------|
| Agent-created skills | `./matimo-tools/skills/{name}/SKILL.md` |
| SDK built-in skills | `packages/core/skills/{name}/SKILL.md` |
| Custom (via `target_dir`) | `{target_dir}/{name}/SKILL.md` |

> Skills created by agents are **permanent** — they are written to `target_dir` on disk, not to a temp location. They survive restarts and can be read back via `matimo_get_skill`.

---

## Name Rules

Skill names follow the Agent Skills spec:

| Rule | Valid | Invalid |
|------|-------|---------|
| Lowercase letters and numbers | `api-errors` | `API-Errors` |
| Hyphens as separators | `code-review` | `code_review` (underscores) |
| 1–64 characters | `my-skill` | (empty or >64 chars) |
| No leading/trailing hyphens | `tool-usage` | `-tool-usage` |
| No consecutive hyphens | `my-skill` | `my--skill` |

---

## Examples Demo

Run the skills demo to see a real LangChain agent create, read, apply, and validate skills:

```bash
cd examples/tools
pnpm skills:demo
```

**What it demonstrates:**

**Phase 2 — Agent missions (goal-driven, no tool names given):**
1. Agent creates a `code-review` skill (human approves)
2. Agent lists available skills (Level 1 discovery)
3. Agent reads `code-review` skill and applies its guidelines to review sample code
4. Agent creates a `security-checklist` skill (auto-approved via whitelist)
5. Agent validates both skills against the Agent Skills spec
6. Agent lists, reads, and applies *all* available skills in one pass

**Phase 4 — Non-MCP progressive disclosure:**
- `getSkillsMetadata()` — Level 1: names + descriptions only (no file I/O)
- `semanticSearchSkills(query)` — raw TF-IDF ranked results with scores per skill
- `buildRelevantSkillPrompt(query)` — Level 2: TF-IDF search loads only relevant skill content

> ⚠️ **Note:** `semanticSearchSkills` is a **programmatic SDK API only** — no agent-callable meta-tool wraps it yet. Agents (LangChain, MCP/Claude) cannot call TF-IDF search directly in their tool loop; they can only discover skills by level with `matimo_list_skills` and `matimo_get_skill`. A `matimo_search_skills` meta-tool is planned for alpha.14.

**Docs:** See [`examples/tools/skills/README.md`](../../examples/tools/skills/README.md) for the full walkthrough.
