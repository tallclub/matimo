---
name: mailchimp
description: "Guide to the Mailchimp tools — audiences, subscribers, and creating and sending campaigns."
version: "1.0.0"
license: "MIT"
metadata:
  category: "Marketing"
  difficulty: "intermediate"
  apply-to: "mailchimp-get-lists mailchimp-get-list-members mailchimp-add-list-member mailchimp-update-list-member mailchimp-remove-list-member mailchimp-create-campaign mailchimp-send-campaign"
  author: "Matimo"
  tags: "mailchimp,email,campaigns,marketing,audiences"
---

# Mailchimp

How to use Matimo's Mailchimp tools for audiences, subscribers and campaigns.

## All Available Tools

| Tool | Purpose | Approval |
|------|---------|----------|
| `mailchimp-get-lists` | List audiences (lists) | No |
| `mailchimp-get-list-members` | List an audience's subscribers | No |
| `mailchimp-add-list-member` | Add a subscriber | No |
| `mailchimp-update-list-member` | Change a subscriber's status, email or merge fields | No |
| `mailchimp-remove-list-member` | Archive a subscriber | **Yes** (DELETE) |
| `mailchimp-create-campaign` | Create a campaign | No |
| `mailchimp-send-campaign` | Send a campaign now | **Yes** |

There is no tool to set campaign content, read campaign reports, or list campaigns; do those in Mailchimp.

## Authentication

Requires `MAILCHIMP_API_KEY`. Every tool also takes `server_prefix`, the data center at the end of the key (`abc123-us6` → `us6`).

---

## Audiences

- `mailchimp-get-lists` with `server_prefix`; optional `count` (max 1000), `offset`. Each list's `id` is the `list_id` the other tools take.
- `mailchimp-get-list-members` with `server_prefix`, `list_id`; optional `status` (`subscribed`, `unsubscribed`, `pending`, `cleaned`, `transactional`, `archived`), `count`, `offset`.

### Adding a Subscriber

`mailchimp-add-list-member` with `server_prefix`, `list_id`, `email_address`, `status` (`subscribed`, `unsubscribed`, `pending`, `cleaned`), and optional `merge_fields`, `tags`.

```json
{
  "server_prefix": "us6",
  "list_id": "abc123",
  "email_address": "alice@example.com",
  "status": "pending",
  "merge_fields": { "FNAME": "Alice", "LNAME": "Smith" },
  "tags": ["webinar"]
}
```

Use `pending` to send a double opt-in confirmation. Adding an address that is already in the audience fails with `Member Exists`; use the update tool instead.

### Updating or Removing a Subscriber

Both take `subscriber_hash`: the MD5 of the lowercase email address (`md5("alice@example.com")`).

- `mailchimp-update-list-member` with `server_prefix`, `list_id`, `subscriber_hash`, and any of `status`, `email_address`, `merge_fields`.
- `mailchimp-remove-list-member` with `server_prefix`, `list_id`, `subscriber_hash`. It archives the member and asks for approval first.

---

## Campaigns

### Creating

`mailchimp-create-campaign` with `server_prefix`, `type` (`regular`, `plaintext`, `rss`, `variate`), and — for `regular` and `plaintext` — `list_id`; optional `subject_line`, `preview_text`, `title`, `from_name`, `reply_to`.

```json
{
  "server_prefix": "us6",
  "type": "regular",
  "list_id": "abc123",
  "subject_line": "Weekly Newsletter",
  "from_name": "Acme Team",
  "reply_to": "team@acme.com"
}
```

The response's `id` is the `campaign_id`.

### Sending

`mailchimp-send-campaign` with `server_prefix` and `campaign_id`. It sends immediately and asks for approval first. The campaign must already have content (set in Mailchimp), recipients, a subject line and a from address, or Mailchimp answers `Campaign Not Ready`.

---

## Common Workflows

### Grow an Audience
1. `mailchimp-get-lists` → pick the `list_id`
2. `mailchimp-add-list-member` with `status: "pending"`
3. `mailchimp-get-list-members` with `status: "subscribed"` to see who confirmed

### Send a Newsletter
1. `mailchimp-create-campaign` with the audience's `list_id`
2. Add content in the Mailchimp editor
3. `mailchimp-send-campaign` (a human approves the send)

---

## Common Errors

| Error | Cause | Fix |
|-------|-------|-----|
| 401 `API Key Invalid` | Wrong API key, or `server_prefix` doesn't match the key | Use the suffix of the key as `server_prefix` |
| 400 `Member Exists` | Email already in audience | Use `mailchimp-update-list-member` |
| 400 `Campaign Not Ready` | Missing content or recipients | Complete all required fields |
| 429 `Too Many Requests` | Rate limit (10 concurrent connections) | Implement backoff |
| 404 `Resource Not Found` | Invalid list_id or campaign_id | Verify IDs |
