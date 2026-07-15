---
name: gmail
description: "Complete guide to all Gmail tools — inbox management, search, sending, drafts, and attachments."
version: "1.1.0"
license: "MIT"
metadata:
  category: "Communication"
  difficulty: "beginner"
  apply-to: "gmail-send-email gmail-list-messages gmail-get-message gmail-get-attachment gmail-create-draft gmail-delete-message"
  author: "Matimo"
  tags: "gmail,email,inbox,google"
---

# Gmail

Complete guide to using Matimo's Gmail tools for sending emails, inbox management, search, drafts, and attachments.

## All Available Tools

| Tool | Purpose |
|------|---------|
| `gmail-send-email` | Send a new email |
| `gmail-list-messages` | List/search messages with Gmail query syntax and label filters |
| `gmail-get-message` | Get full details of a message (headers, body, attachment metadata) |
| `gmail-get-attachment` | Fetch a message attachment's raw data by ID |
| `gmail-create-draft` | Create a draft email without sending it |
| `gmail-delete-message` | Permanently delete a message |

## Authentication

Gmail tools use OAuth2. Required scopes:
- `https://www.googleapis.com/auth/gmail.readonly` — for listing/reading messages and attachments
- `https://www.googleapis.com/auth/gmail.send` — for sending
- `https://www.googleapis.com/auth/gmail.compose` — for drafts
- `https://www.googleapis.com/auth/gmail.modify` — for deleting messages

Environment variable: `GMAIL_ACCESS_TOKEN` (or `GMAIL_CLIENT_ID` / `GMAIL_CLIENT_SECRET` / `GMAIL_REFRESH_TOKEN` when using the OAuth2 provider flow).

---

## Sending Emails

Use `gmail-send-email` with:
- `to` (required) — recipient email or comma-separated list
- `subject` (required) — email subject
- `body` (required) — email body (supports HTML via `isHtml`)
- `cc`, `bcc` — optional recipients

**Best practices:**
- Always include a meaningful subject
- Keep body concise; use HTML for formatting
- Handle bounces — validate addresses before sending

---

## Drafts

Use `gmail-create-draft` with the same parameters as `gmail-send-email` (`to`, `subject`, `body`, `cc`, `bcc`, `isHtml`) to stage an email for manual review before sending.

---

## Inbox Management

### Listing and Searching Messages

`gmail-list-messages` handles both listing and search — pass Gmail's advanced query syntax via `query`, plus `labelIds`, `maxResults`, `pageToken`, and `includeSpamTrash`.

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

Combine operators: `from:alice has:attachment after:2024/01/01`. Common label IDs for `labelIds`: `INBOX`, `SENT`, `TRASH`, `SPAM`, `DRAFT`, `STARRED`, `UNREAD` (system labels) or custom user labels.

### Getting Message Details

Use `gmail-get-message` with `messageId` to retrieve full headers, body, and attachment metadata (`payload.parts[].body.attachmentId`).

### Fetching Attachments

Use `gmail-get-attachment` with `messageId` and `attachmentId` (from `gmail-get-message`'s payload parts) to retrieve the attachment's `size` and base64url-encoded `data`.

---

## Common Workflows

### Daily Inbox Triage
1. List unread emails: `gmail-list-messages` with `labelIds: "UNREAD"`
2. Search for priority: `gmail-list-messages` with `query: "is:important"`
3. Get details on flagged items: `gmail-get-message` for each
4. Pull any attachments: `gmail-get-attachment` using `attachmentId` values from step 3

### Email Notification
1. Send email: `gmail-send-email` with formatted body
2. Verify delivery by searching: `gmail-list-messages` with `query: "in:sent subject:..."`

---

## Common Errors

| Error | Cause | Fix |
|-------|-------|-----|
| 401 `Unauthorized` | Invalid or expired token | Refresh OAuth2 token |
| 403 `Insufficient Permission` | Missing scope | Add required Gmail scope |
| 400 `Invalid to header` | Bad email address | Validate email format |
| 429 `Rate limit` | Too many requests | Gmail API: 250 quota units/sec |
