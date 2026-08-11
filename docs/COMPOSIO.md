---
layout: default
title: Composio Integration
nav_order: 4
---

# @matimo/composio — Governed Access to Composio's Tool Catalog

`@matimo/composio` turns [Composio](https://composio.dev)'s 250+ integrations from "agent has raw API access" into "agent has governed, auditable, human-approvable API access" — same breadth, with Matimo's policy engine, risk classification, and human-in-the-loop (HITL) approval layered on top.

> **Bring your own key.** Every tool here requires *your own* `COMPOSIO_API_KEY` and Composio connected accounts, supplied at runtime — Matimo does not hold a Composio account or proxy requests through Matimo-operated infrastructure. You're responsible for complying with [Composio's Terms of Service](https://composio.dev/terms) and [Privacy Policy](https://composio.dev/privacy) independently. Matimo is not affiliated with, endorsed by, or sponsored by Composio. See [`THIRD_PARTY_NOTICES.md`](../THIRD_PARTY_NOTICES.md) for the full list of third-party providers Matimo can connect to.

---

## What Is Composio?

Composio is a managed integration platform that provides pre-built connectors to hundreds of SaaS tools (Jira, Google Workspace, Microsoft 365, Salesforce, GitHub, Linear, Asana, and more). Its key primitives:

| Concept | What it is |
|---------|-----------|
| **Toolkit** | A named group of actions for one SaaS product (e.g. `jira`, `googledrive`) |
| **Action / Slug** | A single API operation (e.g. `JIRA_GET_ISSUE`), addressable by slug |
| **Connected Account** | An OAuth2 token for one user+toolkit combination (e.g. Sajesh's Jira token) |
| **Entity / User ID** | Your application's stable identifier for a user (passed as `composio_user_id`) |

`@matimo/composio` generates one Matimo tool per Composio action, exposes them all via `MatimoInstance`, and adds risk classification + optional HITL approval before any action reaches Composio's execute endpoint.

---

## Architecture

```
Your Agent
    │
    │ matimo.execute('composio_jira_create_issue', { ... })
    ▼
MatimoInstance.execute()
    │
    │ 1. PolicyEngine.canExecute()          ← risk gate (custom or default)
    │ 2. [onHITL callback]                  ← optional human approval
    │ 3. HttpExecutor → POST /v3/tools/execute/JIRA_CREATE_ISSUE
    ▼
Composio REST API
    │
    │ Forwards to your connected Jira, Drive, Teams, etc.
    ▼
Jira Cloud / Google / Microsoft ...
```

Every generated tool is `type: http` — no custom executor code. `@matimo/composio` stays in `typescript/packages/composio/` as a managed third-party integration (intentionally separate from the root `packages/` workspace).

---

## Available Toolkits

| Toolkit slug | Matimo prefix | Tools | Examples |
|---|---|---|---|
| `jira` | `composio_jira_*` | 46 | `get_issue`, `create_issue`, `search_issues` |
| `asana` | `composio_asana_*` | 84 | `get_task`, `create_task`, `update_task` |
| `linear` | `composio_linear_*` | 21 | `get_issue`, `create_linear_issue`, `archive_issue` |
| `googledrive` | `composio_googledrive_*` | 51 | `list_files`, `find_file`, `upload_file` |
| `googlecalendar` | `composio_googlecalendar_*` | 28 | `list_calendars`, `create_event`, `find_event` |
| `outlook` | `composio_outlook_*` | 43 | `list_emails`, `send_email`, `create_calendar` |
| `one_drive` | `composio_one_drive_*` | 35 | `list_drives`, `download_file`, `search_items` |
| `share_point` | `composio_share_point_*` | 6 | `create_folder`, `create_list`, `find_user` |
| `microsoft_teams` | `composio_microsoft_teams_*` | 28 | `teams_list`, `teams_post_channel_message`, `create_meeting` |

**Total: 342 tools** across 9 toolkits (as of v0.1.5). Add more toolkits by running the generator — see [Generating More Toolkits](#generating-more-toolkits).

---

## Every Tool Call Needs Three Things

All 342 tools share the same three required inputs:

| Input | How it's supplied |
|-------|-----------------|
| `COMPOSIO_API_KEY` | Environment variable — auto-injected as `x-api-key` header |
| `composio_user_id` | Tool parameter — your application's stable user/tenant identifier |
| `composio_connected_account_id` | Tool parameter — the OAuth connected account for *this user + this toolkit* |

`composio_connected_account_id` is obtained when a user completes the Composio OAuth flow ("Connect Jira", "Connect Google Drive", etc.). Your application is responsible for storing and retrieving the correct account ID per user per toolkit — this is out of scope for `@matimo/composio`.

---

## Quick Start

```typescript
import path from 'path';
import { MatimoInstance } from '@matimo/core';

const TOOLS_DIR = path.join(__dirname, 'path/to/packages/composio/tools');

const matimo = await MatimoInstance.init({ toolPaths: [TOOLS_DIR] });

// Low-risk: executes immediately
const user = await matimo.execute('composio_jira_get_current_user', {
  composio_user_id: 'user_123',
  composio_connected_account_id: 'ca_abc123',
});

// Medium-risk: also executes immediately with DefaultPolicyEngine —
// see "Governance" below to add HITL approval for write operations
const files = await matimo.execute('composio_googledrive_list_files', {
  composio_user_id: 'user_123',
  composio_connected_account_id: 'ca_def456',
});
```

---

## Risk Classification

Every generated tool has an explicit `risk: low | medium | high` field derived from the Composio action name:

| Pattern in action slug | Risk | Examples |
|---|---|---|
| `GET`, `LIST`, `FETCH`, `SEARCH`, `READ`, `FIND` | `low` | `JIRA_GET_ISSUE`, `GOOGLEDRIVE_LIST_FILES` |
| `CREATE`, `SEND`, `UPDATE`, `EDIT`, `ADD`, `UPLOAD`, `INVITE` | `medium` | `JIRA_CREATE_ISSUE`, `OUTLOOK_SEND_EMAIL` |
| `DELETE`, `REMOVE`, `ARCHIVE`, `REVOKE`, `CANCEL` | `high` | `JIRA_DELETE_ISSUE`, `GOOGLECALENDAR_CALENDARS_DELETE` |
| Matches none | `medium` (safe default) | — |

Destructive patterns are checked first, so `ARCHIVE_AND_GET` → `high`. Some actions are overridden manually in `scripts/risk-overrides.json` when the heuristic gets it wrong (e.g. `GOOGLEDRIVE_EMPTY_TRASH` → `high`, `GOOGLECALENDAR_CLEAR_CALENDAR` → `high`).

Use `classifyRisk(tool)` from `@matimo/core` to read a tool's risk level at runtime:

```typescript
import { classifyRisk } from '@matimo/core';

const tool = matimo.getRegistry().get('composio_jira_delete_issue');
console.log(classifyRisk(tool)); // 'high'
```

---

## Governance — Adding HITL Approval

`DefaultPolicyEngine.canExecute()` does not gate on `risk:` (it only checks deprecation/draft/`requires_approval`). To pause medium/high-risk composio tools for human approval, supply a custom `PolicyEngine`:

```typescript
import {
  MatimoInstance,
  DefaultPolicyEngine,
  classifyRisk,
  type PolicyEngine,
  type PolicyContext,
  type PolicyDecision,
  type ToolDefinition,
} from '@matimo/core';

class ComposioRiskPolicy implements PolicyEngine {
  private base = new DefaultPolicyEngine();

  canExecute(ctx: PolicyContext, tool: ToolDefinition): PolicyDecision {
    const base = this.base.canExecute(ctx, tool);
    if (base.allowed !== true) return base;

    if (tool.name.startsWith('composio_')) {
      const risk = classifyRisk(tool);
      if (risk === 'medium' || risk === 'high') {
        return {
          allowed: 'pending_approval',
          riskLevel: risk,
          reason: `${tool.name} (${risk} risk) requires approval`,
          toolName: tool.name,
        };
      }
    }
    return { allowed: true };
  }

  canCreate(ctx: PolicyContext, tool: ToolDefinition): PolicyDecision {
    return this.base.canCreate(ctx, tool);
  }
}

const matimo = await MatimoInstance.init({
  toolPaths: [TOOLS_DIR],
  policy: new ComposioRiskPolicy(),
  onHITL: async (request) => {
    // Wire to: interactive prompt, Slack message, approval queue, etc.
    console.log(`⏸  Approval needed: ${request.toolName} (${request.riskLevel})`);
    return promptUser(); // returns Promise<boolean>
  },
});
```

See `typescript/examples/tools/composio/composio-with-approval.ts` for the full runnable example.

---

## LangChain Integration

With 342 tools, loading all of them into a LangChain agent exceeds OpenAI's 128-tool limit. **Always filter to the toolkits relevant to the agent before binding:**

```typescript
import { MatimoInstance, convertToolsToLangChain, type ToolDefinition } from '@matimo/core';
import { ChatOpenAI } from '@langchain/openai';
import { createAgent } from 'langchain';

const matimo = await MatimoInstance.init({ toolPaths: [TOOLS_DIR] });

// Pick only the toolkits this agent needs
const jiraTools = matimo.getRegistry().getAll()
  .filter(t => t.name.startsWith('composio_jira_'));

// convertToolsToLangChain(tools, matimoInstance, envVarsToInject)
// COMPOSIO_API_KEY is resolved from process.env automatically via Matimo's
// auth-parameter injection. composio_user_id and composio_connected_account_id
// are tool parameters — include them in the task/system prompt so the LLM
// knows what values to pass on each call.
const langchainTools = await convertToolsToLangChain(
  jiraTools as ToolDefinition[],
  matimo,
  { COMPOSIO_API_KEY: process.env.COMPOSIO_API_KEY! }
);

const agent = await createAgent({ model: new ChatOpenAI({ modelName: 'gpt-4o-mini' }), tools: langchainTools as any[] });
const response = await agent.invoke({
  messages: [{ role: 'user', content: 'Find all unresolved issues assigned to me. composio_user_id="user_123", composio_connected_account_id="ca_abc123"' }],
});
const lastMessage = response.messages[response.messages.length - 1];
console.log(lastMessage.content);
```

> **Note on Jira search actions**: As of March 2026, Jira removed the `/rest/api/3/search` endpoint. If `composio_jira_search_issues` or `composio_jira_search_for_issues_using_jql_post` return HTTP 410, Composio's catalog hasn't updated to the new `/rest/api/3/search/jql` endpoint yet. Use `composio_jira_get_issue` or `composio_jira_get_current_user` as a workaround, or wait for Composio to update the action.

See `typescript/examples/tools/composio/composio-langchain.ts` for the complete example.

---

## Naming Conventions

Tool names follow `composio_<toolkit_lower>_<action_slug_lower>`. Some Composio action slugs already include the toolkit name, resulting in repetition:

| Composio slug | Matimo tool name |
|---|---|
| `JIRA_GET_ISSUE` | `composio_jira_get_issue` |
| `LINEAR_CREATE_LINEAR_ISSUE` | `composio_linear_create_linear_issue` |
| `ONE_DRIVE_ONEDRIVE_CREATE_FOLDER` | `composio_one_drive_onedrive_create_folder` |
| `SHARE_POINT_SHAREPOINT_CREATE_LIST` | `composio_share_point_sharepoint_create_list` |

This is Composio's own naming — Matimo preserves it exactly. Always verify tool names against the `tools/composio_*/` directories rather than assuming a "natural" name.

---

## Generating More Toolkits

The tool definitions under `tools/composio_*/` are **generated** — do not hand-edit them. To add a new Composio toolkit:

```bash
cd typescript/
export COMPOSIO_API_KEY=your-key

# Add new toolkits (idempotent — existing files are left untouched)
pnpm generate:composio --toolkits=SALESFORCE,HUBSPOT,GITHUB

# Re-generate a toolkit after editing risk-overrides.json
pnpm generate:composio --toolkits=SALESFORCE --force-refresh

# Validate all generated YAML against Matimo's schema
pnpm validate-tools
```

To override a misclassified risk level, add an entry to `typescript/packages/composio/scripts/risk-overrides.json`:

```json
{
  "GOOGLEDRIVE_EMPTY_TRASH": "high",
  "GOOGLECALENDAR_CLEAR_CALENDAR": "high",
  "SALESFORCE_BULK_DELETE_RECORDS": "high"
}
```

Then re-run with `--force-refresh` for the affected toolkits.

---

## Response Structure

Every composio tool returns the same envelope:

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "data": { "...action-specific payload..." },
    "error": null,
    "successful": true
  }
}
```

Check **`data.successful`** (not just `success`) to confirm the underlying action succeeded. A `success: true` with `data.successful: false` means Composio's HTTP layer worked but the integration itself rejected the call (e.g. invalid issue ID, expired token, insufficient scope on the connected account).

---

## Missing Connected Account

If `composio_connected_account_id` is missing, invalid, or not yet connected, Composio returns a "no connected account" error. Surface this to the user as **"connect `<toolkit>` first"** — do not retry, as retrying cannot create the missing OAuth connection.

---

## See Also

- [Examples — composio-factory.ts](../typescript/examples/tools/composio/composio-factory.ts)
- [Examples — composio-decorator.ts](../typescript/examples/tools/composio/composio-decorator.ts)
- [Examples — composio-langchain.ts](../typescript/examples/tools/composio/composio-langchain.ts)
- [Examples — composio-with-approval.ts](../typescript/examples/tools/composio/composio-with-approval.ts)
- [SKILL.md agent knowledge doc](../typescript/packages/composio/skills/composio/SKILL.md)
- [Composio official docs](https://docs.composio.dev)
