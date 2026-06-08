# matimo-microsoft

> Microsoft Graph tools for [Matimo](https://matimo.dev) — search, OneDrive/SharePoint
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

---

## Quick Start

```python
from matimo import MatimoInstance

matimo = await MatimoInstance.init(auto_discover=True)

# Search across SharePoint and OneDrive
search = await matimo.execute("ms_search_knowledge", {"query": "Q3 budget filetype:xlsx", "top": 5})

# List messages in the signed-in user's mailbox
inbox = await matimo.execute("ms_get_email", {"top": 5, "filter": "isRead eq false"})

# Send an email (requires_approval: true — routed through HITL)
await matimo.execute(
    "ms_send_email",
    {"to": ["alice@contoso.com"], "subject": "Weekly status update", "body": "Here is the summary..."},
)
```

---

## Authentication

Microsoft Graph tools use delegated OAuth2 access tokens. Matimo never performs the
OAuth code exchange itself — connect Microsoft through your Matimo deployment (Nova),
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

`ms_send_email` and `ms_publish_to_sharepoint` are marked `risk: high` and
`requires_approval: true` — Matimo routes them through the human-in-the-loop approval
flow before they execute, since they send mail and publish content visible to others
on the user's behalf. `ms_send_teams_message`, `ms_create_document`, and
`ms_create_calendar_event` are `risk: medium` (external writes, narrower blast radius).
The remaining read-only tools are `risk: low`.

---

## Documentation

- [Microsoft Graph API overview](https://learn.microsoft.com/en-us/graph/overview)
- [Graph Explorer](https://developer.microsoft.com/en-us/graph/graph-explorer)
- [Python Examples — Direct SDK](https://github.com/tallclub/matimo/tree/main/python/examples/native/microsoft)
- [Python Examples — LangChain agent](https://github.com/tallclub/matimo/tree/main/python/examples/langchain/microsoft)
- [Python Examples — CrewAI crew](https://github.com/tallclub/matimo/tree/main/python/examples/crewai/microsoft)

---

## Links

- **PyPI:** https://pypi.org/project/matimo-microsoft/
- **GitHub:** https://github.com/tallclub/matimo
- **Microsoft Graph API Docs:** https://learn.microsoft.com/en-us/graph/overview
- **Matimo documentation:** https://matimo.dev/docs
