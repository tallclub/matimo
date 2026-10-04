---
name: notion
description: "Guide to the Notion tools — search, list and query databases, create and update pages, comments, and users."
version: "1.0.0"
license: "MIT"
metadata:
  category: "Productivity"
  difficulty: "beginner"
  apply-to: "notion_search notion_list_databases notion_query_database notion_create_page notion_update_page notion_create_comment notion_get_user"
  author: "Matimo"
  tags: "notion,pages,databases,content,wiki"
---

# Notion

How to use Matimo's Notion tools to find, read and write pages and databases.

## All Available Tools

| Tool | Purpose | Approval |
|------|---------|----------|
| `notion_search` | Search pages and databases by title | No |
| `notion_list_databases` | List the databases the integration can see | No |
| `notion_query_database` | Query a database's pages with filters and sorts | No |
| `notion_create_page` | Create a page in a database or under a page | No |
| `notion_update_page` | Update properties, icon, cover; archive or trash a page | No |
| `notion_create_comment` | Comment on a page or reply in a discussion | No |
| `notion_get_user` | Get a user by ID | No |

There is no tool to read a page's block content or to create or change a database schema.

## Authentication

Requires `NOTION_API_KEY` (an internal integration secret). Share each page or database with the integration, or the API answers 404. The tools send `Notion-Version: 2025-09-03`.

---

## Finding Things

- `notion_search` with `query` (title text); optional `filter_object` (`{"property": "object", "value": "page"}` or `"data_source"`), `sort_direction`, `sort_timestamp`, `page_size`, `start_cursor`. Omit `query` to list everything shared with the integration.
- `notion_list_databases` with `page_size` (1-100, set it explicitly). Each result's `id` is the `database_id` the other tools take.

## Querying a Database

`notion_query_database` with `database_id` (from `notion_list_databases`) and optional `filter`, `sorts`, `page_size` (max 100), `start_cursor`, `archived`, `in_trash`.

**Filter:**
```json
{ "database_id": "abc123", "filter": { "property": "Status", "select": { "equals": "Done" } } }
```

**Compound filter and sort:**
```json
{
  "database_id": "abc123",
  "filter": {
    "and": [
      { "property": "Status", "select": { "equals": "In Progress" } },
      { "property": "Priority", "select": { "equals": "High" } }
    ]
  },
  "sorts": [{ "property": "Created", "direction": "descending" }]
}
```

When the response has `has_more: true`, call again with `start_cursor` set to `next_cursor`.

### Property Types

| Type | Filter operators |
|------|------------------|
| `title` / `rich_text` | equals, contains, starts_with, ends_with |
| `number` | equals, greater_than, less_than |
| `select` | equals, does_not_equal |
| `multi_select` | contains, does_not_contain |
| `date` | equals, before, after, on_or_before |
| `checkbox` | equals (true/false) |
| `people` / `relation` | contains, does_not_contain |

---

## Creating Pages

`notion_create_page` with `parent` — exactly one of `{ "database_id": "..." }` (a new row) or `{ "page_id": "..." }` (a sub-page) — and any of:

- `markdown` — page content as Markdown; the simplest way to add content
- `properties` — values matching the database's schema
- `children` — block objects (max 100), `icon`, `cover`, `template`, `position`

**A database row:**
```json
{
  "parent": { "database_id": "abc123" },
  "properties": {
    "Name": { "title": [{ "text": { "content": "New Item" } }] },
    "Status": { "select": { "name": "In Progress" } }
  }
}
```

**A sub-page with content:**
```json
{ "parent": { "page_id": "def456" }, "markdown": "# Meeting notes\n\n- Decided X\n- Follow up on Y" }
```

## Updating Pages

`notion_update_page` with `page_id` and any of `properties`, `icon`, `cover`, `is_locked`, `template` (with `erase_content` to replace the content), `archived`, `in_trash`. To archive: `{ "page_id": "...", "archived": true }`.

## Comments and Users

- `notion_create_comment` with `rich_text` (array of rich-text objects) and either `parent` (`{ "page_id": "..." }`) or `discussion_id` to reply in a thread.
- `notion_get_user` with `user_id`.

---

## Common Workflows

### Task Management
1. `notion_list_databases` → find the tasks database ID
2. `notion_query_database` with a status filter
3. `notion_update_page` with the new status

### Notes
1. `notion_search` for the parent page
2. `notion_create_page` with `parent.page_id` and `markdown`
3. `notion_create_comment` to flag it for review

---

## Common Errors

| Error | Cause | Fix |
|-------|-------|-----|
| 401 `Unauthorized` | Invalid API key | Check `NOTION_API_KEY` |
| 404 `Not Found` | Page/DB not shared with integration | Share the page with your integration |
| 400 `Validation error` | Bad property format | Match the database schema types |
| 409 `Conflict` | Concurrent edits | Retry with latest version |
| 429 `Rate limited` | Too many requests | 3 requests/second — use backoff |
