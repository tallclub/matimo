# @matimo/composio - Governed Access to Composio's Tool Catalog

`@matimo/composio` turns [Composio](https://composio.dev)'s 250+ integrations
from "agent has raw API access" into "agent has governed, auditable,
human-approvable API access" - same breadth, with Matimo's policy engine,
risk classification, and human-in-the-loop (HITL) approval layered on top.

## 🙏 Credit Where It's Due

The 449 tool definitions in this package exist because
[Composio](https://composio.dev) already built, tested, and maintains OAuth
and API coverage for Asana, Jira, Linear, Google Workspace, Microsoft 365,
and dozens of other toolkits. Matimo's own tool-authoring bar is intentionally
high - every native provider tool requires 100% unit coverage, four
TypeScript examples, and three Python examples (see the root
[CLAUDE.md](../../../CLAUDE.md#adding-a-new-tool--mandatory-workflow)).
Hand-building and maintaining that for 449 actions across 14 toolkits, each
with its own auth flow and API quirks, isn't a good use of engineering time
when Composio has already solved it well.

**This is a deliberate, temporary bridge, not the long-term architecture.**
Wrapping Composio's catalog with Matimo's policy engine gets users governed
access to broad integration coverage immediately. Over time, the highest-usage
toolkits here (Google Workspace, Jira, Linear, Asana are the current
candidates) are expected to graduate into first-party `@matimo/<provider>`
packages with native auth, no extra network hop, and the full test/example suite -
at which point their `composio_*` equivalents can be deprecated in favor of
the native ones. Until then, this package is the pragmatic way to give
agents broad, governed tool access without gating it on our own build
velocity.

## 🔑 Bring Your Own Composio Key - and Non-Affiliation

Every tool in this package requires **your own** `COMPOSIO_API_KEY` and your
own Composio connected accounts, supplied at runtime - Matimo never holds a Composio account or credential of its own, and no request is routed through any Matimo-operated infrastructure other than your own deployment. You are responsible for independently reading and complying with [Composio's Terms of Service](https://composio.dev/terms) and [Privacy Policy](https://composio.dev/privacy) before connecting an account.
This BYOK pattern mirrors how other platforms built on Composio's catalog
work (e.g. [Langflow](https://docs.langflow.org/bundles-composio),
[KiloClaw](https://kilo.ai/docs/kiloclaw/development-tools/composio)) 

**Matimo is not affiliated with, endorsed by, or sponsored by Composio.**
"Composio" is used here solely to describe interoperability with their
public API.

Every tool in this package calls a single Composio action via Composio's
REST execute endpoint:

```
POST https://backend.composio.dev/api/v3/tools/execute/{TOOL_SLUG}
```

## 📦 Installation

```bash
npm install @matimo/composio
# or
pnpm add @matimo/composio
```

## 🧬 Tools Are Generated, Not Hand-Written

Unlike other Matimo provider packages, the `tools/composio_*/` directory is
**generated** by [`scripts/generate-tools.ts`](./scripts/generate-tools.ts)
from Composio's live catalog API. **Do not hand-edit
`tools/composio_<toolkit>_<action>/definition.yaml` files** - changes will be
overwritten the next time the generator runs.

### Running the Generator

```bash
# Requires COMPOSIO_API_KEY in the environment (used only at generation time,
# to call Composio's catalog API)
export COMPOSIO_API_KEY="your-composio-project-api-key"

pnpm generate:composio --toolkits=JIRA,LINEAR,ASANA
```

- **Idempotent and incremental**: re-running with new toolkits only adds new
  files; existing tool definitions are left untouched.
- Pass `--force-refresh` to regenerate every file for the named toolkits
  (e.g. after editing `scripts/risk-overrides.json`):

```bash
pnpm generate:composio --toolkits=JIRA --force-refresh
```

### What Gets Generated

For each Composio action (e.g. `JIRA_GET_ISSUE`), the generator writes
`tools/composio_jira_get_issue/definition.yaml`:

```yaml
name: composio_jira_get_issue
description: Fetch a Jira issue by ID
version: '1.0.0'
risk: low
parameters:
  composio_user_id:
    type: string
    required: true
    description: The Composio entity/user ID for the calling tenant or user.
  composio_connected_account_id:
    type: string
    required: true
    description: >-
      The Composio connected account ID for the JIRA toolkit, scoped to the
      calling tenant. The "Connect JIRA" flow must be completed before this
      tool will succeed.
  issue_id_or_key:
    type: string
    required: true
    description: The ID or key of the Jira issue to retrieve.
execution:
  type: http
  method: POST
  url: https://backend.composio.dev/api/v3/tools/execute/JIRA_GET_ISSUE
  headers:
    x-api-key: '{COMPOSIO_API_KEY}'
    Content-Type: application/json
  body:
    user_id: '{composio_user_id}'
    connected_account_id: '{composio_connected_account_id}'
    arguments:
      _matimo_tool: composio_jira_get_issue
      issue_id_or_key: '{issue_id_or_key}'
  timeout: 30000
authentication:
  type: api_key
  location: header
  name: x-api-key
tags: [composio, jira]
```

`arguments._matimo_tool` is a literal marker baked in at generation time
(not a `{param}` placeholder) - see
[Why `_matimo_tool` Is in Every `arguments` Block](#why-_matimo_tool-is-in-every-arguments-block)
below.

### Why `_matimo_tool` Is in Every `arguments` Block

Composio's `/tools/execute/{slug}` endpoint requires the `arguments` key to
be present in the request body, even when empty (`{}`) - omitting it
entirely returns `HTTP 400 "Only one of 'text' or 'arguments' must be
provided"`. Matimo's HTTP executor, however, drops empty nested objects from
the request body after templating. For any action where the caller supplies
none of the optional parameters (or the action has no input parameters at
all), `arguments` would template down to `{}` and then be stripped entirely
- triggering that 400 on every such call.

The generator works around this by always including a literal
`_matimo_tool: <tool name>` entry in `arguments`. Because it's a plain string
baked in at generation time (not a `{param}` placeholder), it always survives
templating, keeping `arguments` non-empty. Composio tolerates the extra field
and ignores it; it also serves as a debugging breadcrumb in Composio's logs
identifying which Matimo tool made the call.

## 🔑 Runtime Configuration

Every generated tool requires three values, all supplied by the application
embedding Matimo (e.g. via its existing credential-injection layer - the same
mechanism that provides `SLACK_BOT_TOKEN` for `@matimo/slack`):

| Value | Type | How it's resolved |
|-------|------|--------------------|
| `COMPOSIO_API_KEY` | Environment variable | Auto-injected as the `x-api-key` header by Matimo's auth-parameter resolution (any execution-config placeholder containing `key` resolves from `process.env`) |
| `composio_user_id` | Tool parameter, required | The Composio entity/user ID for the calling tenant/user |
| `composio_connected_account_id` | Tool parameter, required | The connected account ID for the specific toolkit, scoped to the calling tenant - requires the "Connect `<toolkit>`" flow to have been completed |

How `composio_user_id` / `composio_connected_account_id` are obtained, stored,
or surfaced via a "Connect via Composio" UI is **out of scope** for this
package - see [`definition.yaml`](./definition.yaml) for details.

## 🚦 Risk Classification

Every generated tool sets an explicit `risk: low | medium | high` field. The
generator derives this from the Composio action's slug:

| Pattern in action slug | Risk | Examples |
|-------------------------|------|----------|
| `GET`, `LIST`, `FETCH`, `SEARCH`, `READ`, `FIND` | `low` | `JIRA_GET_ISSUE`, `LINEAR_LIST_ISSUES` |
| `CREATE`, `SEND`, `UPDATE`, `EDIT`, `ADD`, `POST`, `UPLOAD`, `INVITE` | `medium` | `LINEAR_CREATE_ISSUE`, `GMAIL_SEND_EMAIL` |
| `DELETE`, `REMOVE`, `ARCHIVE`, `REVOKE`, `CANCEL` | `high` | `JIRA_DELETE_ISSUE`, `LINEAR_ARCHIVE_ISSUE` |
| Matches none of the above | `medium` (default) | An unnecessary approval prompt beats a silent destructive write |

Destructive patterns are checked first, so an ambiguous name that also looks
destructive (e.g. `ARCHIVE_AND_GET_ISSUE`) is still flagged `high`.

### Overriding the Heuristic

If the generator misclassifies a specific action, add an entry to
[`scripts/risk-overrides.json`](./scripts/risk-overrides.json) keyed by the
Composio tool slug:

```json
{
  "JIRA_DELETE_ISSUE_LINK": "high"
}
```

Then re-run the generator with `--force-refresh` for the affected toolkit(s)
to apply the override.

### Acting on `risk:` - Opt-In HITL Quarantine

`classifyRisk(tool)` always returns each generated tool's explicit `risk:`
field. `DefaultPolicyEngine.canExecute()` gates `execute()` calls on that
risk level, but only when HITL quarantine is turned on - it's **off by
default** so enabling it never surprises callers who haven't configured it.

To get `pending_approval` quarantine for medium/high-risk composio tools
(e.g. `composio_jira_create_issue`, `composio_jira_delete_issue`), configure
the default policy engine with:

```typescript
const matimo = await MatimoInstance.init({
  autoDiscover: true,
  policyConfig: {
    enableHITL: true,
    quarantineRiskLevels: ['medium', 'high'],
  },
});
```

With this set, `DefaultPolicyEngine.canExecute()` returns
`{ allowed: 'pending_approval', riskLevel, reason, toolName }` for any tool
whose `classifyRisk(tool)` falls in `quarantineRiskLevels`, and
`MatimoInstance.execute()` invokes the configured `onHITL` callback before
proceeding. No custom `PolicyEngine` implementation is required.

See [`skills/composio/SKILL.md`](./skills/composio/SKILL.md) for how agents
should handle a `pending_approval` result if the host wires this up.

## 🚀 Quick Start

```typescript
import { MatimoInstance } from 'matimo';

const matimo = await MatimoInstance.init({ autoDiscover: true });

// Low-risk: executes immediately
const result = await matimo.execute('composio_jira_get_issue', {
  composio_user_id: 'user_123',
  composio_connected_account_id: 'ca_abc123',
  issue_id_or_key: 'PROJ-123',
});

// Medium-risk: executes immediately under DefaultPolicyEngine - see
// "Acting on risk:" above for how to make this return `pending_approval`
const created = await matimo.execute('composio_linear_create_linear_issue', {
  composio_user_id: 'user_123',
  composio_connected_account_id: 'ca_def456',
  title: 'Investigate flaky test',
  team_id: 'team_abc789',
});
```

## 🧪 Testing Strategy (Exception to Standard Matimo Rules)

Most Matimo provider packages require 100% unit coverage, 4 TypeScript
examples, and 3 Python examples **per tool**. That rule does not apply here:
the initial toolkit set generates 200–1000+ tool definition files across
14 toolkits, and per-tool hand-written tests/examples for every generated
file would be unmaintainable busywork that breaks on every catalog change.

Instead:

1. **`test/unit/generator.test.ts`** covers the generator itself - `pnpm
   jest packages/composio` - with mocked Composio API responses. It asserts:
   - Risk classification for representative action-name patterns (one case
     per heuristic bucket: GET-like → `low`, CREATE-like → `medium`,
     DELETE-like → `high`, ambiguous → `medium` default, and destructive
     patterns winning over ambiguous matches)
   - Risk override resolution (`scripts/risk-overrides.json` wins over the
     heuristic)
   - Parameter mapping from Composio's JSON Schema `input_parameters` to
     Matimo's `parameters` block
   - Generated tool definitions are schema-valid via `validateToolDefinition`
   - Pagination via `next_cursor` when fetching a toolkit's catalog
   - Idempotent file writes (`created` / `skipped` / `forceRefresh`)
2. **`pnpm validate-tools` passing on all generated YAML is the acceptance
   gate for generated files.** No per-tool hand-written tests or examples
   (TypeScript or Python) are required or expected for `tools/composio_*/`.
3. There is no `executor.test.ts` - every generated tool is `type: http`, so
   there is no shared executor to test.

## 🤝 Contributing

See [CONTRIBUTING.md](../../../CONTRIBUTING.md) for guidelines on contributing to
Matimo.

---

Part of the [Matimo](https://github.com/tallclub/matimo) ecosystem - Write
YAML once, use everywhere.
