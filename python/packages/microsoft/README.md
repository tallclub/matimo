# matimo-microsoft

> Microsoft Graph tools for [Matimo](https://matimo.dev) - search, OneDrive/SharePoint
> files, Outlook mail, Microsoft Teams, calendar, and SharePoint publishing.

[![PyPI](https://img.shields.io/pypi/v/matimo-microsoft)](https://pypi.org/project/matimo-microsoft/)
[![Docs](https://img.shields.io/badge/docs-matimo.dev-blue)](https://matimo.dev/docs)

---

## Installation

```bash
pip install matimo matimo-microsoft
```

---

## Available Tools (9 Total)

| Tool | Description | Approval | Graph endpoint |
|------|-------------|------|----------------|
| `ms_search_knowledge` | Search SharePoint sites, OneDrive/SharePoint files, and list items | - | `POST /search/query` |
| `ms_read_file` | Read a OneDrive/SharePoint file's contents (plain-text formats only) | - | `GET /drives/{id}/items/{id}/content` |
| `ms_list_files` | List the children of a OneDrive/SharePoint folder | - | `GET /drives/{id}/items/{id}/children` |
| `ms_get_email` | List messages in the signed-in user's mailbox | - | `GET /me/messages` |
| `ms_send_email` | Send an email as the signed-in user | **required** | `POST /me/messages` + `/send` |
| `ms_send_teams_message` | Post (or reply to) a message in a Teams channel | - | `POST /teams/{id}/channels/{id}/messages` |
| `ms_create_document` | Upload a small file to OneDrive/SharePoint (≤4 MB) | - | `PUT /drives/{id}/items/{id}:/{name}:/content` |
| `ms_create_calendar_event` | Create a calendar event, optionally as a Teams meeting | - | `POST /me/events` |
| `ms_publish_to_sharepoint` | Create and publish a SharePoint site page | **required** | `POST /sites/{id}/pages` + `/publish` |

---

## Quick Start

```python
from matimo import Matimo

matimo = await Matimo.init(auto_discover=True)

# Search across SharePoint and OneDrive
search = await matimo.execute("ms_search_knowledge", {"query": "Q3 budget filetype:xlsx", "top": 5})

# List messages in the signed-in user's mailbox
inbox = await matimo.execute("ms_get_email", {"top": 5, "filter": "isRead eq false"})

# Send an email (requires_approval: true - routed through HITL)
await matimo.execute(
    "ms_send_email",
    {"to": ["alice@contoso.com"], "subject": "Weekly status update", "body": "Here is the summary..."},
)
```

---

## Authentication

Microsoft Graph tools use delegated OAuth2 access tokens. Matimo never performs the
OAuth code exchange itself - connect Microsoft through your Matimo deployment (Nova),
then provide the resulting token at execution time:

```bash
export MICROSOFT_GRAPH_ACCESS_TOKEN="eyJ0eXAiOiJKV1Qi..."
```

or pass it through per-call credentials:

```python
await matimo.execute(
    "ms_get_email",
    {"top": 5},
    credentials={"MICROSOFT_GRAPH_ACCESS_TOKEN": token},
)
```

---

## Risk & Approval

`ms_send_email` and `ms_publish_to_sharepoint` are marked `requires_approval: true` -
Matimo routes them through the human-in-the-loop approval flow before they execute,
since they send mail and publish content visible to others on the user's behalf. The
other 7 tools have no `requires_approval` flag and execute immediately.

None of the 9 tools declare an explicit `risk:` field in their YAML. If you enable
HITL quarantine (`enableHITL=True` with a `quarantineRiskLevels` policy config), be
aware that every tool in this package uses `execution.type: function`, and Matimo's
automatic risk classifier assigns `type: function` tools `risk: critical` by default
regardless of what they actually do - so all 9 tools, including the read-only ones,
will classify as `critical` if `critical` is in your `quarantineRiskLevels`.

---

## Documentation

- [Microsoft Graph API overview](https://learn.microsoft.com/en-us/graph/overview)
- [Graph Explorer](https://developer.microsoft.com/en-us/graph/graph-explorer)
- [Python Examples - Direct SDK](https://github.com/tallclub/matimo/tree/main/python/examples/native/microsoft)
- [Python Examples - LangChain agent](https://github.com/tallclub/matimo/tree/main/python/examples/langchain/microsoft)
- [Python Examples - CrewAI crew](https://github.com/tallclub/matimo/tree/main/python/examples/crewai/microsoft)

---

## Links

- **PyPI:** https://pypi.org/project/matimo-microsoft/
- **GitHub:** https://github.com/tallclub/matimo
- **Microsoft Graph API Docs:** https://learn.microsoft.com/en-us/graph/overview
- **Matimo documentation:** https://matimo.dev/docs
