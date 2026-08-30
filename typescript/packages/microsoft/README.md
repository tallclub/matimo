# @matimo/microsoft

Microsoft Graph tools for Matimo - search, OneDrive/SharePoint files, Outlook mail,
Microsoft Teams, calendar, and SharePoint publishing through YAML-defined tools that
work with any AI framework.

## 📦 Installation

```bash
npm install @matimo/microsoft
# or
pnpm add @matimo/microsoft
```

## 🚀 Quick Start

```typescript
import { MatimoInstance } from '@matimo/core';

const matimo = await MatimoInstance.init('./packages/microsoft/tools');

// Search across SharePoint and OneDrive
const search = await matimo.execute('ms_search_knowledge', {
  query: 'Q3 budget filetype:xlsx',
  top: 5,
});

// List files in a OneDrive folder
const files = await matimo.execute('ms_list_files', {
  drive_id: 'b!xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
});

// Read a plain-text file's contents
const file = await matimo.execute('ms_read_file', {
  drive_id: 'b!xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
  item_id: '01ABCXYZ7654321',
});

// Send an email (requires_approval: true - routed through HITL)
await matimo.execute('ms_send_email', {
  to: ['alice@contoso.com'],
  subject: 'Weekly status update',
  body: 'Here is the summary for this week...',
});
```

## 🛠️ Available Tools

| Tool | Description | Risk | Graph endpoint |
|------|-------------|------|----------------|
| `ms_search_knowledge` | Search SharePoint sites, OneDrive/SharePoint files, and list items | low | `POST /search/query` |
| `ms_read_file` | Read a OneDrive/SharePoint file's contents (plain-text formats only) | low | `GET /drives/{id}/items/{id}/content` |
| `ms_list_files` | List the children of a OneDrive/SharePoint folder | low | `GET /drives/{id}/items/{id}/children` |
| `ms_get_email` | List messages in the signed-in user's mailbox | low | `GET /me/messages` |
| `ms_send_email` | Send an email as the signed-in user | **high** (approval) | `POST /me/messages` + `/send` |
| `ms_send_teams_message` | Post (or reply to) a message in a Teams channel | medium | `POST /teams/{id}/channels/{id}/messages` |
| `ms_create_document` | Upload a small file to OneDrive/SharePoint (≤4 MB) | medium | `PUT /drives/{id}/items/{id}:/{name}:/content` |
| `ms_create_calendar_event` | Create a calendar event, optionally as a Teams meeting | medium | `POST /me/events` |
| `ms_publish_to_sharepoint` | Create and publish a SharePoint site page | **high** (approval) | `POST /sites/{id}/pages` + `/publish` |

## 🔐 Authentication

Microsoft Graph tools use delegated OAuth2 access tokens. Matimo never performs the
OAuth code exchange itself - connect Microsoft through your Matimo deployment (Nova),
then provide the resulting token at execution time:

```bash
export MICROSOFT_GRAPH_ACCESS_TOKEN="eyJ0eXAiOiJKV1Qi..."
```

or pass it through per-call credentials:

```typescript
await matimo.execute(
  'ms_get_email',
  { top: 5 },
  { credentials: { MICROSOFT_GRAPH_ACCESS_TOKEN: token } }
);
```

See [`definition.yaml`](./definition.yaml) for the full OAuth2 provider configuration
(authorization/token endpoints, default scopes, and app registration setup steps).

## ⚠️ Risk & Approval

`ms_send_email` and `ms_publish_to_sharepoint` are marked `risk: high` and
`requires_approval: true` - Matimo routes them through the human-in-the-loop approval
flow before they execute, since they send mail and publish content visible to others
on the user's behalf. `ms_send_teams_message`, `ms_create_document`, and
`ms_create_calendar_event` are `risk: medium` (external writes, narrower blast radius).
The remaining read-only tools are `risk: low`.

> ⚠️ All 9 tools use `execution.type: function` (needed for the Graph SDK's token
> handling). Matimo's automatic risk classifier assigns `type: function` tools an
> effective floor of `risk: critical` that a lower self-declared `risk:` can never
> reduce - so if you enable HITL quarantine with `critical` in your
> `quarantineRiskLevels`, every tool in this package (including the read-only ones)
> will be quarantined, regardless of the `low`/`medium`/`high` values shown above.

## 📚 Integration Examples

See [`examples/tools/microsoft/`](../../examples/tools/microsoft/) for runnable
factory, decorator, LangChain agent, and policy-approval examples.

## Additional Resources

- [Microsoft Graph API overview](https://learn.microsoft.com/en-us/graph/overview)
- [Microsoft Graph permissions reference](https://learn.microsoft.com/en-us/graph/permissions-reference)
- [Microsoft Entra admin center](https://entra.microsoft.com) (app registration)
- [Graph Explorer](https://developer.microsoft.com/en-us/graph/graph-explorer) (try API calls interactively)
- [Matimo Documentation](../../README.md)
