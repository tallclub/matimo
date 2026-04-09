# @matimo/notion — Notion Tools for Matimo

Notion workspace integration tools for Matimo's universal AI tools ecosystem. Query databases, create pages, manage content, search workspaces, add comments, and retrieve user information through YAML-defined tools that work with any AI framework.

## 📦 Installation

```bash
npm install @matimo/notion
# or
pnpm add @matimo/notion
```

## 🛠️ Available Tools (7 Total)

| Tool | Method | Description |
|------|--------|-------------|
| **notion_list_databases** | POST | List all databases (data sources) in workspace |
| **notion_query_database** | POST | Query pages from database with filters and sorting |
| **notion_create_page** | POST | Create new page in database or as child page |
| **notion_update_page** | PATCH | Update page properties, icon, status, archive |
| **notion_search** | POST | Search workspace pages and databases by title |
| **notion_create_comment** | POST | Add comments to pages, blocks, or discussions |
| **notion_get_user** | GET | Retrieve user information and profile details |

## 🚀 Quick Start

```typescript
import { MatimoInstance } from '@matimo/core';

const matimo = await MatimoInstance.init({ autoDiscover: true });

// Query a database
const results = await matimo.execute('notion_query_database', {
  database_id: 'a1d8501e-1ac1-43e9-a6bd-ea9fe6c8822b'
});

console.log('Found pages:', results.results.length);
```

## 🔐 Authentication Setup

### Get Your Notion API Token

1. Go to [Notion Integrations](https://www.notion.so/my-integrations)
2. Click "Create new integration"
3. Set workspace and name your integration
4. Grant required capabilities:
   - ✅ Read content
   - ✅ Update content
   - ✅ Insert content
   - ✅ Read user information
   - ✅ Insert comments
5. Copy your "Internal Integration Secret" (token)
6. Set environment variable:
   ```bash
   export NOTION_API_KEY=secret_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```

### Share Resources with Your Integration

For each database/page you want to access:
1. Click the ••• menu (top-right)
2. Scroll to "Add connections"
3. Search for and select your integration

## 🤖 How AI Agents Use These Tools

AI agents (Claude, ChatGPT, etc.) don't need to know internal API details. They discover tools automatically:

```typescript
// AI agent discovers all available tools
const tools = matimo.listTools();

// Each tool has:
// - name: "notion_list_databases"  ← Tool identifier
// - description: "List all databases..."  ← What it does
// - parameters: {  ← What inputs it accepts
//     database_id: { type: "string", description: "Get from notion_list_databases..." }
//   }
// - examples: [...]  ← How to use it

// AI agent reads descriptions and automatically knows:
// 1. Use notion_list_databases() first to get database IDs
// 2. Pass those IDs to notion_query_database() for queries
// 3. Use returned page IDs with notion_create_page(), etc.
```

**No memorization needed.** Tools are self-describing through their schemas, descriptions, and examples.

## 📖 Integration Examples

### Factory Pattern (Simple)

```typescript
import { MatimoInstance } from '@matimo/core';

const matimo = await MatimoInstance.init({ autoDiscover: true });

// AI agent autonomously discovers and uses tools
// Step 1: List databases
const databases = await matimo.execute('notion_list_databases', { page_size: 10 });
const myDb = databases.data.results[0];

// Step 2: Query the database
const pages = await matimo.execute('notion_query_database', {
  database_id: myDb.id,
  page_size: 5
});

// Step 3: Create a new page
const newPage = await matimo.execute('notion_create_page', {
  parent: { database_id: myDb.id },
  markdown: '# New Page\n\nContent here'
});

console.log('Created:', newPage.data.url);
```

### Decorator Pattern (Class-Based)

```typescript
import { MatimoInstance, setGlobalMatimoInstance, tool } from '@matimo/core';

const matimo = await MatimoInstance.init('./tools');
setGlobalMatimoInstance(matimo);

class NotionManager {
  @tool('notion_query_database')
  async queryDatabase(database_id: string, filter?: Record<string, any>) {
    // Auto-executed by decorator
  }

  @tool('notion_create_page')
  async createPage(
    parent: Record<string, string>, // e.g., { database_id: '...' } or { page_id: '...' }
    markdown?: string,
    icon?: Record<string, string>
  ) {
    // Auto-executed by decorator
  }

  @tool('notion_search')
  async search(query: string, sort_by?: string) {
    // Auto-executed by decorator
  }
}

const manager = new NotionManager();
const results = await manager.queryDatabase('db-id');
```

### LangChain Integration (AI Framework)

```typescript
import { MatimoInstance } from '@matimo/core';

const matimo = await MatimoInstance.init('./tools');

// Get tool schemas for LangChain
const notionTools = matimo.listTools()
  .filter(t => t.name.startsWith('notion_'))
  .map(tool => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: {
        type: 'object',
        properties: tool.parameters || {},
        required: Object.entries(tool.parameters || {})
          .filter(([_, p]: [string, any]) => p.required)
          .map(([name]) => name),
      },
    },
  }));

// Use with your LLM/agent
console.log('Available tools for LangChain:', notionTools.map(t => t.function.name));
```

## 📚 API Reference

### notion_query_database

Query pages in a Notion database with optional filtering and sorting.

**Parameters:**
- `database_id` (required): UUID of the database
- `filter` (optional): JSON filter object (e.g., `{"property": "Status", "status": {"equals": "Done"}}`)
- `sort` (optional): Array of sort objects
- `page_size` (optional): Results per page (1-100, default 100)
- `start_cursor` (optional): Pagination cursor

**Returns:** Paginated list of pages with `results`, `has_more`, `next_cursor`

---

### notion_create_page

Create a new page, optionally with properties and content.

**Parameters:**
- `parent` (required): Object describing where to create the page. Provide ONE of:
  - `{ "database_id": "..." }` to create inside a database
  - `{ "page_id": "..." }` to create as a child page
- `properties` (optional): JSON properties matching parent schema
- `markdown` (optional): String content using Markdown (easiest way to add content)
- `icon` (optional): Object for page icon, e.g. `{ type: 'emoji', emoji: '✅' }`
- `children` (optional): Array of Notion block objects to add to the page

> **Note:** This tool accepts a single `parent` object (for example `{ "database_id": "..." }` or `{ "page_id": "..."`) — do not pass separate `parent_id` / `parent_type` parameters. This matches the tool's YAML definition (`packages/notion/tools/notion_create_page/definition.yaml`).

**Returns:** Created page object with `id`, `url`, and `properties`

---

### notion_update_page

Update page properties, status, archive status, or icon.

**Parameters:**
- `page_id` (required): UUID of page to update
- `properties` (optional): JSON properties to update
- `icon` (optional): Object for page icon (e.g., { "type": "emoji", "emoji": "✅" } or { "type": "external", "external": { "url": "https://..." } })
- `archived` (optional): Archive/unarchive page (boolean)
- `in_trash` (optional): Move to/restore from trash
- `is_locked` (optional): Lock/unlock page editing

**Returns:** Updated page object

---

### notion_search

Search workspace pages and databases by title.

**Parameters:**
- `query` (optional): Search text (omit to return all items)
- `filter_object` (optional): 'page' or 'data_source'
- `sort_timestamp` (optional): 'last_edited_time' or 'created_time'
- `sort_direction` (optional): 'ascending' or 'descending'
- `page_size` (optional): Results per page (1-100)
- `start_cursor` (optional): Pagination cursor

**Returns:** Paginated list of pages/databases matching search

---

### notion_create_comment

Add a comment to a page, block, or discussion thread.

**Parameters:**
- `parent` (optional): Object describing the comment target. Provide ONE of:
  - `{ "page_id": "..." }` — comment on a page
  - `{ "block_id": "..." }` — comment on a block
  - omit to reply to a `discussion_id` (use `discussion_id` parameter)
- `discussion_id` (optional): Discussion thread to reply to (alternative to `parent`)
- `rich_text` (required): Array of rich text objects representing the comment content
- `attachments` (optional): Array of file objects to attach to the comment
- Formatting/annotations should be provided within the `rich_text` objects (bold/italic/code via annotations)

**Returns:** Created comment object with `id` and `created_time`

---

### notion_get_user

Retrieve user information including name, avatar, and email.

**Parameters:**
- `user_id` (required): UUID of user to retrieve

**Returns:** User object with `id`, `name`, `avatar_url`, `email`

## ⚙️ Environment Variables

```bash
# Required
NOTION_API_KEY=secret_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Optional (for OAuth2 - Phase 2)
NOTION_OAUTH_CLIENT_ID=your_client_id
NOTION_OAUTH_CLIENT_SECRET=your_client_secret
NOTION_OAUTH_REDIRECT_URI=https://yourdomain.com/callback
```

## 🔧 Troubleshooting

### "403 Forbidden" Error

**Cause:** Integration lacks required capability or resource not shared.

**Solutions:**
1. Check integration has "Read/Update/Insert content" capabilities in Notion dashboard
2. Share the database/page with your integration (•••  → Add connections → select integration)
3. Verify token is current (refresh in Notion integrations dashboard)

### "404 Not Found" Error

**Cause:** Database/page ID is incorrect or integration doesn't have access.

**Solutions:**
1. Verify database ID from Notion URL: `https://www.notion.so/{database_id}`
2. Ensure resource is shared with integration
3. Check API key is correct

### Filters Not Working

**Cause:** Incorrect filter syntax for property type.

**Solutions:**
- Use Notion's property filtering UI as reference
- Filters depend on property type (status, checkbox, date, etc.)
- See [Notion Filter Reference](https://developers.notion.com/reference/post-database-query-filter)

### Rate Limiting

**Info:** Notion API has rate limits (~3-4 requests/second per integration). Implement exponential backoff for production systems.

## 📖 Learning Resources

- [Notion API Docs](https://developers.notion.com)
- [Notion Integrations Dashboard](https://www.notion.so/my-integrations)
- [Working with Databases](https://developers.notion.com/guides/data-apis/working-with-databases)
- [Creating Pages](https://developers.notion.com/guides/data-apis/working-with-page-content)
- [Notion Developers Slack](https://join.slack.com/t/notiondevs/shared_invite/zt-20b5996xv-DzJdLiympy6jP0GGzu3AMg)

## 🤝 Contributing

Found a bug or want to suggest a feature? See [CONTRIBUTING.md](/CONTRIBUTING.md).

---

**Part of the Matimo ecosystem** — Write YAML once, use everywhere.
