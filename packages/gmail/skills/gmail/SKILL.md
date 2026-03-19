---
name: gmail
description: "Complete guide to all Gmail tools — inbox management, email sending, labels, search, and threads."
version: "1.0.0"
license: "MIT"
metadata:
  category: "Communication"
  difficulty: "beginner"
  apply-to: "gmail-send-email gmail-list-emails gmail-get-email gmail-search-emails gmail-list-labels"
  author: "Matimo"
  tags: "gmail,email,inbox,google"
---

# Gmail

Complete guide to using Matimo's Gmail tools for sending emails, inbox management, search, and labels.

## All Available Tools

| Tool | Purpose |
|------|---------|
| `gmail-send-email` | Send a new email |
| `gmail-list-emails` | List emails with optional filters |
| `gmail-get-email` | Get full details of an email |
| `gmail-search-emails` | Advanced search with Gmail query syntax |
| `gmail-list-labels` | List all labels (system + user) |

## Authentication

Gmail tools use OAuth2. Required scopes:
- `https://www.googleapis.com/auth/gmail.readonly` — for reading
- `https://www.googleapis.com/auth/gmail.send` — for sending
- `https://www.googleapis.com/auth/gmail.labels` — for labels

Environment variables: `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN`.

---

## Sending Emails

Use `gmail-send-email` with:
- `to` (required) — recipient email or comma-separated list
- `subject` (required) — email subject
- `body` (required) — email body (supports HTML)
- `cc`, `bcc` — optional recipients

**Best practices:**
- Always include a meaningful subject
- Keep body concise; use HTML for formatting
- Handle bounces — validate addresses before sending

---

## Inbox Management

### Listing Emails

Use `gmail-list-emails` with optional `labelIds` (e.g., `INBOX`, `UNREAD`, `STARRED`), `maxResults`, and `pageToken`.

### Getting Email Details

Use `gmail-get-email` with `messageId` to retrieve full headers, body, and attachments metadata.

---

## Search

Use `gmail-search-emails` with Gmail's advanced query syntax:

| Operator | Example | Purpose |
|----------|---------|---------|
| `from:` | `from:alice@acme.com` | From specific sender |
| `to:` | `to:team@acme.com` | Sent to |
| `subject:` | `subject:invoice` | In subject line |
| `has:attachment` | | Has attachments |
| `is:unread` | | Unread messages |
| `is:starred` | | Starred messages |
| `after:` | `after:2024/01/01` | Date filter |
| `before:` | `before:2024/06/01` | Date filter |
| `label:` | `label:work` | By label |
| `filename:` | `filename:pdf` | Attachment type |
| `-` | `-from:noreply` | Exclude results |

Combine operators: `from:alice has:attachment after:2024/01/01`.

---

## Labels

Use `gmail-list-labels` to retrieve all labels. System labels include `INBOX`, `SENT`, `TRASH`, `SPAM`, `DRAFT`, `STARRED`, `UNREAD`. User labels are custom.

---

## Common Workflows

### Daily Inbox Triage
1. List unread emails: `gmail-list-emails` with `labelIds: ["UNREAD"]`
2. Search for priority: `gmail-search-emails` with `is:important`
3. Get details on flagged items: `gmail-get-email` for each

### Email Notification
1. Send email: `gmail-send-email` with formatted body
2. Verify delivery by searching: `gmail-search-emails` with `in:sent subject:...`

---

## Common Errors

| Error | Cause | Fix |
|-------|-------|-----|
| 401 `Unauthorized` | Invalid or expired token | Refresh OAuth2 token |
| 403 `Insufficient Permission` | Missing scope | Add required Gmail scope |
| 400 `Invalid to header` | Bad email address | Validate email format |
| 429 `Rate limit` | Too many requests | Gmail API: 250 quota units/sec |
