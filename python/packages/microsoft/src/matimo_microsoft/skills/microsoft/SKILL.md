---
name: microsoft
description: "Complete guide to all Microsoft Graph tools — search, OneDrive/SharePoint files, Outlook mail, Teams, calendar, and SharePoint publishing."
version: "1.0.0"
license: "MIT"
metadata:
  category: "Productivity"
  difficulty: "intermediate"
  apply-to: "ms_search_knowledge ms_read_file ms_list_files ms_get_email ms_send_email ms_send_teams_message ms_create_document ms_create_calendar_event ms_publish_to_sharepoint"
  author: "Matimo"
  tags: "microsoft,graph,office365,sharepoint,onedrive,outlook,teams,calendar"
---

# Microsoft Graph

Complete guide to using Matimo's Microsoft Graph tools for searching organizational
knowledge, reading and writing OneDrive/SharePoint files, managing Outlook mail and
calendar events, posting to Microsoft Teams, and publishing SharePoint pages.

## All Available Tools

| Tool | Purpose | Risk |
|------|---------|------|
| `ms_search_knowledge` | Search SharePoint sites, OneDrive/SharePoint files, and list items | low |
| `ms_read_file` | Read a file's contents from OneDrive/SharePoint | low |
| `ms_list_files` | List the children of a OneDrive/SharePoint folder | low |
| `ms_get_email` | List messages in the signed-in user's mailbox | low |
| `ms_send_email` | Send an email as the signed-in user | **high** — requires approval |
| `ms_send_teams_message` | Post or reply to a message in a Teams channel | medium |
| `ms_create_document` | Upload a small file (≤4 MB) to OneDrive/SharePoint | medium |
| `ms_create_calendar_event` | Create a calendar event, optionally a Teams meeting | medium |
| `ms_publish_to_sharepoint` | Create and publish a SharePoint site page | **high** — requires approval |

## Authentication

Microsoft Graph tools use delegated OAuth2 access tokens via the `microsoft` provider
(see the package's `definition.yaml`). Matimo never performs the OAuth code exchange
itself — a valid Graph access token must already be available, supplied either as:

- `credentials.MICROSOFT_GRAPH_ACCESS_TOKEN` on the execution context, or
- the `MICROSOFT_GRAPH_ACCESS_TOKEN` environment variable

Common delegated scopes: `Sites.Read.All`, `Files.Read.All`, `Files.ReadWrite`,
`Mail.Read`, `Mail.Send`, `ChannelMessage.Send`, `Calendars.ReadWrite`,
`Sites.Manage.All`. Each tool's YAML lists the narrower scopes it actually needs.

---

## Searching Organizational Knowledge

Use `ms_search_knowledge` with:
- `query` (required) — KQL-style search string, e.g. `"Q3 budget filetype:xlsx"`
- `entity_types` — which content types to search (`driveItem`, `listItem`, `site`, `list`, `drive`); defaults to `[driveItem, listItem, site]`
- `top` — max results, 1-25 (default 10)
- `site_id` / `drive_id` — **best-effort scoping hints**, folded into the query string. Microsoft Search has no dedicated server-side filter for sites/drives on these entity types, so don't expect a hard filter — narrow the `query` text itself for reliable scoping.

---

## Reading & Listing Files

`ms_list_files` lists the children of a folder (`item_id` defaults to `"root"`),
returning `{id, name, type: "file"|"folder", size_bytes, last_modified, mime_type, web_url}`.

`ms_read_file` downloads and decodes a file's content. **Plain-text formats only**
(`text/*`, `application/json`, `application/xml`) are returned as UTF-8 text. Rich
document formats — PDF, Word, Excel, PowerPoint — and other binaries return
`content: ""` plus a `warning` explaining why (this tool deliberately does not bundle
unverified parsing libraries like `pdf-parse`/`mammoth`/`xlsx`). When you see a
`warning`, share the file's `web_url` instead of trying to summarize its content.

---

## Outlook Mail

`ms_get_email` lists messages with optional `filter` (OData, e.g. `"isRead eq false"`),
`search` (free text), and `folder_id` (e.g. `"inbox"`, `"sentitems"`, or a folder ID).

`ms_send_email` sends mail **(risk: high, requires_approval: true — routed through
Matimo's human-in-the-loop approval flow)**. It creates a draft first and then sends
it, so it can return a real `message_id` — Graph's `/me/sendMail` endpoint returns no
identifier on its own. Required: `to[]`, `subject`, `body`. Optional: `cc[]`, `bcc[]`,
`body_type` (`text` default, or `html`).

**Best practices:**
- Always confirm recipient lists before sending — this tool requires HITL approval for exactly this reason
- Use `body_type: html` for formatted announcements; keep plain text for quick notes

---

## Microsoft Teams

`ms_send_teams_message` posts to a channel (`team_id`, `channel_id`, `text`
required). Pass `reply_to_message_id` to thread a reply instead of starting a new
top-level message. `content_type` is `text` (default) or `html`.

---

## Calendar

`ms_create_calendar_event` creates an event on the user's default calendar. Required:
`subject`, `start`, `end` (e.g. `"2026-06-15T09:00:00"`). The single `timezone`
parameter (default `UTC`) applies to both `start` and `end`. Set
`is_online_meeting: true` to have Teams generate a meeting — the response then
includes a `join_url`.

---

## Files & SharePoint Writes

`ms_create_document` uploads small text-based files (≤4 MB — Graph's simple-upload
limit; larger files need a resumable upload session, not implemented here). Provide
`content` as plain text or, with `content_encoding: base64`, as base64. `filename`
and `drive_id` are required; `parent_item_id` defaults to the drive root.
`conflict_behaviour` (`replace`/`rename`/`fail`) is passed as a best-effort hint.

`ms_publish_to_sharepoint` creates a site page with a single text web part and
publishes it by default **(risk: high, requires_approval: true)**. Plain-text
`content_type: text` is HTML-escaped and wrapped in a paragraph before being placed
in the page (SharePoint always stores web part bodies as HTML). Set `publish: false`
to leave the page as an unpublished draft for review.

---

## Common Workflows

### Answer a question from organizational knowledge
1. `ms_search_knowledge` with a focused query
2. `ms_read_file` on the most relevant `driveItem` hit's `id`/drive — check for a `warning` before trusting `content`
3. Summarize, citing the hit's `web_url`

### Triage the inbox and follow up in Teams
1. `ms_get_email` with `filter: "isRead eq false"` to find unread mail
2. `ms_send_teams_message` to notify a channel about anything urgent
3. `ms_send_email` to reply (will require approval)

### Schedule and announce a meeting
1. `ms_create_calendar_event` with `is_online_meeting: true` to get a `join_url`
2. `ms_send_teams_message` or `ms_send_email` to share the `join_url` and `web_link`

---

## Common Errors

| Error code | Cause | Fix |
|------------|-------|-----|
| `AUTH_FAILED` | Missing/expired/insufficient-scope access token (Graph 401/403) | Reconnect Microsoft in Nova; verify the token has the scope the tool's YAML lists |
| `FILE_NOT_FOUND` | Graph returned 404 for the given drive/item/site/team/channel ID | Double-check the ID — Graph IDs are case-sensitive and tenant-specific |
| `RATE_LIMIT_EXCEEDED` | Graph returned 429 | Respect `details.retryAfterSeconds`; the tool already retries transient 429/5xx with backoff |
| `VALIDATION_FAILED` | A required parameter is missing or an enum/range value is invalid | Check the tool's `parameters` block — validation runs before any network call |
| `EXECUTION_FAILED` | Graph returned 5xx, or an unexpected/empty response shape | Usually transient — retry; if persistent, check Graph service health |
