---
name: mailchimp
description: "Complete guide to all Mailchimp tools — campaigns, audiences, lists, templates, segments, and email marketing."
version: "1.0.0"
license: "MIT"
metadata:
  category: "Marketing"
  difficulty: "intermediate"
  apply-to: "mailchimp-create-campaign mailchimp-send-campaign mailchimp-get-campaign mailchimp-list-campaigns mailchimp-add-member mailchimp-list-members mailchimp-get-member"
  author: "Matimo"
  tags: "mailchimp,email,campaigns,marketing,audiences"
---

# Mailchimp

Complete guide to using Matimo's Mailchimp tools for campaign management, audience operations, and email marketing.

## All Available Tools

| Tool | Purpose | Category |
|------|---------|----------|
| `mailchimp-create-campaign` | Create a new campaign | Campaigns |
| `mailchimp-send-campaign` | Send or schedule a campaign | Campaigns |
| `mailchimp-get-campaign` | Get campaign details and stats | Campaigns |
| `mailchimp-list-campaigns` | List campaigns with filters | Campaigns |
| `mailchimp-add-member` | Add a subscriber to an audience | Audiences |
| `mailchimp-list-members` | List subscribers in an audience | Audiences |
| `mailchimp-get-member` | Get subscriber details | Audiences |

## Authentication

Requires `MAILCHIMP_API_KEY` (format: `key-dc`, where `dc` is the data center, e.g., `abc123-us21`).

---

## Campaigns

### Creating Campaigns

Use `mailchimp-create-campaign` with:
- `type` — `regular`, `plaintext`, `absplit`, or `rss`
- `recipients` — `{ "list_id": "..." }` (required audience)
- `settings` — `subject_line`, `from_name`, `reply_to`, `title`

```json
{
  "type": "regular",
  "recipients": { "list_id": "abc123" },
  "settings": {
    "subject_line": "Weekly Newsletter",
    "from_name": "Acme Team",
    "reply_to": "team@acme.com"
  }
}
```

### Sending Campaigns

Use `mailchimp-send-campaign` with `campaign_id`. Ensure campaign has content and recipients before sending.

**Pre-send checklist:**
1. Campaign has content (template or HTML)
2. Recipients/audience set
3. Subject line and from address configured
4. Test email sent

### Campaign Stats

Use `mailchimp-get-campaign` to retrieve delivery stats: `emails_sent`, `opens`, `clicks`, `bounces`, `unsubscribes`.

---

## Audiences (Lists)

### Adding Members

Use `mailchimp-add-member` with:
- `list_id` (required) — the audience ID
- `email_address` (required) — subscriber email
- `status` — `subscribed`, `unsubscribed`, `cleaned`, `pending`
- `merge_fields` — `{ "FNAME": "Alice", "LNAME": "Smith" }`

**Best practices:**
- Always use `pending` status for double opt-in compliance
- Set merge fields for personalization
- Check for existing subscribers before adding

### Listing Members

Use `mailchimp-list-members` with `list_id` and optional `status`, `count`, `offset` for pagination.

### Getting Member Details

Use `mailchimp-get-member` with `list_id` and `subscriber_hash` (MD5 of lowercase email) or `email_address`.

---

## Common Workflows

### Newsletter Campaign
1. Add new subscribers: `mailchimp-add-member` with `status: "pending"`
2. Create campaign: `mailchimp-create-campaign`
3. Send campaign: `mailchimp-send-campaign`
4. Check results: `mailchimp-get-campaign` for stats

### Audience Growth Tracking
1. List members: `mailchimp-list-members` with different statuses
2. Monitor subscriber counts over time
3. Review bounce and unsubscribe rates

---

## Common Errors

| Error | Cause | Fix |
|-------|-------|-----|
| 401 `API Key Invalid` | Wrong API key or data center | Check key format `key-dc` |
| 400 `Member Exists` | Email already in audience | Use update instead of add |
| 400 `Campaign Not Ready` | Missing content or recipients | Complete all required fields |
| 429 `Too Many Requests` | Rate limit (10 concurrent connections) | Implement backoff |
| 404 `Resource Not Found` | Invalid list_id or campaign_id | Verify IDs |
