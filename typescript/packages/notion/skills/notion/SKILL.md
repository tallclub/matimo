---
name: notion
description: "Complete guide to all Notion tools — databases, pages, blocks, queries, and content management."
version: "1.0.0"
license: "MIT"
metadata:
  category: "Productivity"
  difficulty: "beginner"
  apply-to: "notion-create-page notion-get-page notion-update-page notion-query-database notion-create-database notion-get-database notion-update-database"
  author: "Matimo"
  tags: "notion,pages,databases,content,wiki"
---

# Notion

Complete guide to using Matimo's Notion tools for managing pages, databases, and content.

## All Available Tools

| Tool | Purpose | Category |
|------|---------|----------|
| `notion-create-page` | Create a new page or database entry | Pages |
| `notion-get-page` | Retrieve page content and properties | Pages |
| `notion-update-page` | Update page properties or archive | Pages |
| `notion-query-database` | Query a database with filters and sorts | Databases |
| `notion-create-database` | Create a new database | Databases |
| `notion-get-database` | Get database schema and metadata | Databases |
| `notion-update-database` | Update database title, description, or schema | Databases |

## Authentication

Requires `NOTION_API_KEY` (internal integration token). The integration must be connected to the workspace and shared with relevant pages/databases.

---

## Pages

### Creating Pages

Use `notion-create-page` with:
- `parent` — either `{ "database_id": "..." }` (add row to database) or `{ "page_id": "..." }` (create sub-page)
- `properties` — property values matching the parent database schema
- `children` — optional array of block content

**Adding a row to a database:**
```json
{
  "parent": { "database_id": "abc123" },
  "properties": {
    "Name": { "title": [{ "text": { "content": "New Item" } }] },
    "Status": { "select": { "name": "In Progress" } }
  }
}
```

### Getting Pages

Use `notion-get-page` with `page_id`. Returns all properties. For rich content (blocks), you'll see the page structure.

### Updating Pages

Use `notion-update-page` with `page_id` and the `properties` to change. To archive: `{ "archived": true }`.

---

## Databases

### Querying

Use `notion-query-database` with `database_id` and optional:
- `filter` — property-based conditions
- `sorts` — ordering rules
- `page_size` — results per page (max 100)
- `start_cursor` — for pagination

**Filter examples:**
```json
{
  "filter": {
    "property": "Status",
    "select": { "equals": "Done" }
  }
}
```

**Compound filters:**
```json
{
  "filter": {
    "and": [
      { "property": "Status", "select": { "equals": "In Progress" } },
      { "property": "Priority", "select": { "equals": "High" } }
    ]
  }
}
```

**Sort examples:**
```json
{
  "sorts": [
    { "property": "Created", "direction": "descending" }
  ]
}
```

### Creating Databases

Use `notion-create-database` with `parent` (page_id), `title`, and `properties` schema definition.

### Notion Property Types

| Type | Filter Operators | Example |
|------|-----------------|---------|
| `title` / `rich_text` | equals, contains, starts_with, ends_with | Text fields |
| `number` | equals, greater_than, less_than | Numeric values |
| `select` | equals, does_not_equal | Single choice |
| `multi_select` | contains, does_not_contain | Multiple choices |
| `date` | equals, before, after, on_or_before | Date values |
| `checkbox` | equals (true/false) | Boolean |
| `people` | contains, does_not_contain | User references |
| `relation` | contains, does_not_contain | Links to other DBs |

---

## Common Workflows

### Task Management
1. Query database for open tasks: `notion-query-database` with status filter
2. Get task details: `notion-get-page`
3. Update completion: `notion-update-page` with new status

### Content Wiki
1. Create page: `notion-create-page` under a parent page
2. Query existing pages: `notion-query-database` for related content
3. Update pages: `notion-update-page` as content evolves

---

## Common Errors

| Error | Cause | Fix |
|-------|-------|-----|
| 401 `Unauthorized` | Invalid API key | Check `NOTION_API_KEY` |
| 404 `Not Found` | Page/DB not shared with integration | Share the page with your integration |
| 400 `Validation error` | Bad property format | Match the database schema types |
| 409 `Conflict` | Concurrent edits | Retry with latest version |
| 429 `Rate limited` | Too many requests | 3 requests/second — use backoff |
