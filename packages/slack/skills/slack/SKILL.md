---
name: slack
description: "Complete guide to all Slack tools — messaging, channels, users, search, files, reactions, and threads."
version: "1.0.0"
license: "MIT"
metadata:
  category: "Communication"
  difficulty: "beginner"
  apply-to: "slack_send_channel_message slack_reply_to_message slack_add_reaction slack_get_channel_history slack_get_reactions slack_get_thread_replies slack_send_dm slack_search_messages slack_get_user_info slack_upload_file slack-get-user slack-list-channels slack-send-message slack_create_channel slack_set_channel_topic slack_join_channel"
  author: "Matimo"
  tags: "slack,messaging,channels,communication"
---

# Slack

Complete guide to using Matimo's Slack tools for messaging, channels, users, search, and file sharing.

## All Available Tools

| Tool | Purpose | Category |
|------|---------|----------|
| `slack_send_channel_message` | Post a message to a channel | Messaging |
| `slack_reply_to_message` | Reply in a thread | Messaging |
| `slack_add_reaction` | Add an emoji reaction | Messaging |
| `slack_get_reactions` | Get reactions on a message | Messaging |
| `slack_get_channel_history` | Read recent messages from a channel | Messaging |
| `slack_get_thread_replies` | Get all replies in a thread | Messaging |
| `slack_send_dm` | Send a direct message to a user | Users |
| `slack_search_messages` | Search across all channels | Search |
| `slack_get_user_info` | Look up a user's profile | Users |
| `slack-get-user` | Get basic user details | Users |
| `slack_upload_file` | Upload a file to a channel or DM | Files |
| `slack-list-channels` | List available channels | Channels |
| `slack-send-message` | Send a message (simplified) | Messaging |
| `slack_create_channel` | Create a new channel | Channels |
| `slack_set_channel_topic` | Set or update the channel topic | Channels |
| `slack_join_channel` | Join an existing channel | Channels |

## Authentication

All Slack tools require a `SLACK_BOT_TOKEN` environment variable. The bot must have the relevant OAuth scopes (`chat:write`, `channels:read`, `channels:history`, `users:read`, `search:read`, `files:write`).

---

## Channel Messaging

### Sending a Message

Use `slack_send_channel_message` to post to any public or private channel the bot is a member of.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `channel` | string | Yes | Channel ID (`C01ABCDEF`) or name (`#general`) |
| `text` | string | No | Plain-text message body |
| `blocks` | array | No | Block Kit UI layout for rich formatting |

**Best practices:**
- Always provide `text` even with `blocks` — it's the notification preview and screen reader fallback
- Use channel IDs over names for reliability (names can change)
- Keep messages under 4000 characters; split longer content

```json
{
  "channel": "C01ABCDEF",
  "text": "Deployment to production completed successfully :white_check_mark:"
}
```

### Replying in Threads

Use `slack_reply_to_message` to keep conversations organized.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `channel` | string | Yes | Channel ID where the parent message lives |
| `thread_ts` | string | Yes | Timestamp of the parent message |
| `text` | string | Yes | Reply text |

Use threads for follow-up info, status updates, and error details rather than cluttering the main channel.

### Reactions

Use `slack_add_reaction` to acknowledge messages silently.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `channel` | string | Yes | Channel ID |
| `timestamp` | string | Yes | Message timestamp to react to |
| `name` | string | Yes | Emoji name without colons (e.g., `thumbsup`) |

Common patterns: `eyes` = "looking into it", `white_check_mark` = "done", `hourglass_flowing_sand` = "working on it".

### Reading History

Use `slack_get_channel_history` before responding to understand context.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `channel` | string | Yes | Channel ID |
| `limit` | number | No | Number of messages (default: 10, max: 100) |

**Always read channel history before sending** to prevent duplicate messages.

---

## Users

### Direct Messages

Use `slack_send_dm` to message a user privately.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `user_id` | string | Yes | User ID (`U01ABCDEF`) — not email or display name |
| `text` | string | Yes | Message text |

Use DMs for personal notifications and sensitive information. Use channels for team-wide announcements.

### Looking Up Users

Use `slack_get_user_info` to retrieve profile data (name, email, timezone, status, bot/admin flags).

### Finding User IDs

1. Use `slack-get-user` or `slack_get_user_info` to look up by name
2. Read channel history — messages include a `user` field
3. Slack profile URL: `team.slack.com/team/U01ABCDEF`

---

## Search

Use `slack_search_messages` to find messages across the workspace.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | Yes | Search query with optional modifiers |

**Search modifiers:** `from:@user`, `in:#channel`, `before:YYYY-MM-DD`, `after:YYYY-MM-DD`, `has:link`, `has:reaction`.

```json
{ "query": "deployment failed in:#production after:2024-03-01" }
```

---

## Channels

### Listing Channels

Use `slack-list-channels` to discover existing channels before creating duplicates.

### Creating a Channel

Use `slack_create_channel` with a `name` (lowercase, hyphens, max 80 chars) and optional `is_private` boolean.

**Naming conventions:** `proj-{name}`, `team-{name}`, `incident-{id}`, `tmp-{name}`, `announce-{scope}`.

Always search before creating. Set a topic immediately after creation.

### Setting Topics

Use `slack_set_channel_topic` to describe channel purpose. Good topics include purpose, key links, and contact info.

### Joining

Use `slack_join_channel` before reading history or sending messages. If you get `not_in_channel`, join first.

---

## Files

Use `slack_upload_file` to share files in channels or DMs.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `channels` | string | Yes | Comma-separated channel IDs |
| `content` | string | Yes | File content (text-based) |
| `filename` | string | No | Filename (e.g., `report.csv`) |
| `filetype` | string | No | File type (`csv`, `json`, `text`) |
| `title` | string | No | File title |

---

## Common Workflows

### Notify Then Follow Up
1. Read channel history with `slack_get_channel_history`
2. Send notification with `slack_send_channel_message`
3. React with `eyes` on user's request
4. Reply with results in a thread
5. React with `white_check_mark` when done

### Investigate and Report
1. Search for messages with `slack_search_messages`
2. Look up requesting user with `slack_get_user_info`
3. Read channel history for context
4. DM findings to user via `slack_send_dm`
5. Upload detailed report via `slack_upload_file`

### Set Up a Project Channel
1. List existing channels to avoid duplicates
2. Create channel: `proj-{project-name}`
3. Set topic with purpose and links
4. Send introductory message

---

## Common Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `channel_not_found` | Bot not a member | Invite: `/invite @botname` |
| `not_in_channel` | Bot hasn't joined | Use `slack_join_channel` first |
| `invalid_blocks` | Malformed Block Kit JSON | Validate at Slack Block Kit Builder |
| `msg_too_long` | Exceeds 40,000 chars | Split into multiple messages |
| `user_not_found` | Invalid user ID | Verify with `slack_get_user_info` |
| `cannot_dm_bot` | Trying to DM a bot | Only DM real users |
| `name_taken` | Channel name exists | List channels first |
| `not_allowed_token_type` | Missing OAuth scope | Reconfigure bot permissions |
