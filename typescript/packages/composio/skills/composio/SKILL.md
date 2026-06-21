---
name: composio
description: "Understand the @matimo/composio governance wrapper — how composio_* tools proxy Composio's 250+ integrations, what risk levels mean for approval, and how to handle missing connected accounts."
version: "1.0.0"
license: "MIT"
metadata:
  category: "Governance & Integrations"
  difficulty: "intermediate"
  apply-to: "composio_*"
  tags: "composio,governance,policy,risk,integrations,hitl"
---

# Composio Governance Wrapper

`@matimo/composio` gives you governed, auditable access to Composio's tool
catalog — Jira, Linear, Asana, Google Workspace, Microsoft 365, Salesforce,
and dozens of other toolkits — without giving up Matimo's policy engine,
risk classification, or human-in-the-loop (HITL) approval flow.

Every tool in this package is named `composio_<toolkit>_<action>`
(e.g. `composio_jira_get_issue`, `composio_linear_create_linear_issue`)
and proxies exactly one Composio action via Composio's REST execute endpoint.
**These tool definitions are generated** by `scripts/generate-tools.ts` — do
not hand-edit `tools/composio_*/definition.yaml` files; adjust
`scripts/risk-overrides.json` and re-run the generator instead.

## How a composio_* Call Works

```
Agent calls composio_jira_get_issue(
  composio_user_id: "...",
  composio_connected_account_id: "...",
  issue_id_or_key: "PROJ-123"
)
        │
        ▼
Matimo's standard policy checks run (canExecute: deprecation, draft
status, requires_approval + role checks) — see "Risk Levels" below for
what the explicit `risk:` field does and does not gate automatically.
        │
        ▼
HTTP POST https://backend.composio.dev/api/v3/tools/execute/JIRA_GET_ISSUE
  headers: { "x-api-key": <COMPOSIO_API_KEY> }
  body: {
    user_id: composio_user_id,
    connected_account_id: composio_connected_account_id,
    arguments: { _matimo_tool: "composio_jira_get_issue", issue_id_or_key: "PROJ-123" }
  }
        │
        ▼
Response envelope: { success, data: { data, error, successful } }
```

`arguments._matimo_tool` is a generated marker (always present, even when
every other argument is omitted) — Composio's execute endpoint requires the
`arguments` key to exist in the request body, and Matimo's HTTP executor
drops empty nested objects. Ignore this field; it carries no semantic
meaning beyond keeping `arguments` non-empty and tagging Composio-side logs
with the originating Matimo tool name.

## Every Tool Needs Three Things

| Parameter | Where it comes from | Notes |
|-----------|---------------------|-------|
| `COMPOSIO_API_KEY` | Environment variable (auto-injected as `x-api-key` header) | Provisioned by the embedding application, not by you |
| `composio_user_id` | Tool parameter, required | The Composio entity/user ID for the calling tenant or user |
| `composio_connected_account_id` | Tool parameter, required | The connected account ID for **this specific toolkit**, scoped to the calling tenant |

If you don't have `composio_user_id` or `composio_connected_account_id` for
the current request, **do not guess or invent placeholder values** — ask the
calling application/user to supply them. They are passed through unchanged
from whatever credential-injection layer the host app uses.

## Risk Levels — What They Mean for You

Every generated tool sets an explicit `risk: low | medium | high` field,
derived from the Composio action name (e.g. `GET_ISSUE` → `low`,
`CREATE_ISSUE` → `medium`, `DELETE_ISSUE` → `high`), with manual overrides in
`scripts/risk-overrides.json` for actions the heuristic gets wrong.
`classifyRisk(tool)` always honors this explicit field.

- **`risk: low`** (read-only — list, get, search, fetch)
- **`risk: medium`** (writes — create, update, send, upload, invite)
- **`risk: high`** (destructive — delete, remove, archive, revoke, cancel)

**With Matimo's default policy engine (`DefaultPolicyEngine`), `risk:`
alone does not pause `execute()` calls** — `canExecute()` only checks
deprecation/draft status and `requires_approval` + role. Medium/high-risk
composio tools execute immediately unless the **embedding application**
does one of:

- Implements a custom `PolicyEngine` whose `canExecute()` calls
  `classifyRisk(tool)` and returns `{ allowed: 'pending_approval', riskLevel, reason, toolName }`
  for risk levels in its `quarantineRiskLevels` — `MatimoInstance.execute()`
  will then invoke the configured `onHITL` callback before proceeding.
- Registers composio tools under `untrustedPaths` with `requires_approval: true`
  and runs `reloadTools()` in a `{ environment: 'prod' }` context —
  `DefaultPolicyEngine.canCreate()` returns `pending_approval` for
  medium/high-risk tools when `enableHITL: true` and the risk level is in
  `quarantineRiskLevels`.

**If your `execute('composio_jira_create_issue', ...)` call ever does return
`pending_approval` (because the host app wired up one of the above), treat it
as the expected, successful outcome for a write/destructive action — it is
not an error and should not be retried.** Tell the user the action is queued
for human approval; do not attempt the call again or try to "work around" the
pause. Once a human approves it out-of-band, the same call will proceed to
Composio.

## Missing Connected Account

If `composio_connected_account_id` is missing, invalid, or not yet connected
for the target toolkit, Composio's execute endpoint returns an auth/"no
connected account" error. **Surface this to the user as "connect `<toolkit>`
first"** (e.g. "Connect Jira in your integrations settings before I can read
issues") — this is a setup/configuration gap on the user's side, not a
transient failure. Do not retry the call; retrying will not create the
missing connection.

## Reading the Response

A successful Composio call returns:

```json
{
  "success": true,
  "data": {
    "data": { /* action-specific result, e.g. the Jira issue object */ },
    "error": null,
    "successful": true
  }
}
```

- `success` reflects the HTTP request to Composio (2xx status).
- `data.successful` reflects whether Composio executed the *underlying*
  action successfully — `success: true` with `data.successful: false` and a
  populated `data.error` means Composio reached the integration but the
  integration itself rejected the call (e.g. invalid issue ID, insufficient
  scope on the connected account).

## Out of Scope for This Package

This skill (and `@matimo/composio` generally) does **not** cover:

- How `composio_user_id` / `composio_connected_account_id` are obtained or
  stored — that's the embedding application's responsibility.
- The "Connect `<toolkit>`" OAuth UI flow.
- Provisioning or rotating `COMPOSIO_API_KEY`.

If a user asks about any of these, point them to their application's
integrations/settings UI rather than attempting to resolve it via tool calls.
