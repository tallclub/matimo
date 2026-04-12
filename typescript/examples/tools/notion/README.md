# Notion Tools Examples

Example directory contains **3 example patterns** showing different ways to use Matimo's Notion tools:
1. **Factory Pattern** - Direct SDK execution (simplest)
2. **Decorator Pattern** - Class-based with @tool decorators
3. **LangChain Pattern** - AI-driven with OpenAI agent

All examples are **fully working** and demonstrate real Notion operations (creating pages, querying databases, updating pages, etc.).

## 🚀 Quick Start

### 1. Create a Notion Integration

1. Go to [notion.com/my-integrations](https://www.notion.com/my-integrations)
2. Click "Create new integration"
3. Give it a name like "Matimo"
4. Select "Internal Integration"
5. Accept the guidelines and click "Create integration"

OR Create an internal integration by visiting - https://www.notion.so/profile/integrations/internal

### 2. Get Your API Key

- Copy the **Internal Integration Token** (starts with `ntn_`)
- This is your `NOTION_API_KEY`

### 3. Share Databases with Integration

1. Open any Notion database you want Matimo to access
2. Click **Share** in the top-right
3. Select your integration from the dropdown and click "Invite"
4. Confirm the invitation

### 4. Set Up Environment

Create a `.env` file in `examples/tools/`:

```env
NOTION_API_KEY=secret_your-notion-api-key-here
OPENAI_API_KEY=sk-your-openai-key-here
```

### 5. Run Examples

```bash
# Factory Pattern (simplest, direct API calls)
pnpm notion:factory

# Decorator Pattern (class-based OOP approach)
pnpm notion:decorator

# LangChain Pattern (AI-driven agent with OpenAI)
pnpm notion:langchain
```

## 📚 Examples Overview

### 1. Factory Pattern (`notion-factory.ts`)

**Best for:** Scripts, quick tests, CLI tools

**What it does:**
- ✅ Direct tool execution with `matimo.execute()`
- ✅ Automatically discovers accessible databases
- ✅ Queries database for pages
- ✅ Creates new pages with content
- ✅ Updates pages with icons
- ✅ Simplest implementation

**Run it:**
```bash
pnpm notion:factory
```

**Key Code:**
```typescript
const matimo = await MatimoInstance.init({ autoDiscover: true });

// List databases
const databases = await matimo.execute('notion_list_databases', { page_size: 10 });

// Query a database
const pages = await matimo.execute('notion_query_database', {
  database_id: 'db-id-here'
});

// Create a page
const newPage = await matimo.execute('notion_create_page', {
  parent: { database_id: 'db-id-here' },
  markdown: '# New Page\n\nContent here'
});
```

**File:** [notion-factory.ts](notion-factory.ts)

### 2. Decorator Pattern (`notion-decorator.ts`)

**Best for:** Object-oriented design, class-based applications

**What it does:**
- ✅ Class methods decorated with `@tool`
- ✅ Automatic tool execution via decorators
- ✅ Multiple operations in organized class
- ✅ Creates and updates pages automatically
- ✅ OOP-friendly approach

**Run it:**
```bash
pnpm notion:decorator
```

**Key Code:**
```typescript
class NotionAgent {
  @tool('notion_list_databases')
  async listDatabases() {
    // Decorator auto-executes tool
  }

  @tool('notion_create_page')
  async createPage(parent: any, markdown: string) {
    // Also auto-executed
  }
}

const agent = new NotionAgent();
await agent.listDatabases();
```

**File:** [notion-decorator.ts](notion-decorator.ts)

### 3. LangChain AI Agent (`notion-langchain.ts`)

**Best for:** True autonomous agents with AI reasoning

**What it does:**
- ✅ AI agent (OpenAI GPT-4o-mini) decides which tools to use
- ✅ Takes natural language instructions
- ✅ Automatically discovers databases
- ✅ Executes Notion tools autonomously
- ✅ Processes results and responds naturally
- ✅ Multi-step reasoning

**Run it:**
```bash
pnpm notion:langchain
```

**Example Conversation:**
```
User: "Explore my Notion workspace and tell me what databases you find"
AI Agent: I'll explore your workspace and list the databases...
[AI calls notion_list_databases tool]
AI Agent: I found 3 databases:
  1. Product Roadmap
  2. Projects
  3. Tasks

User: "Create a new page with the title 'Meeting Notes'"
AI Agent: I'll create a new page for you...
[AI calls notion_create_page tool with discovered database]
AI Agent: Done! I've created a new page titled 'Meeting Notes'
```

**Key Code:**
```typescript
// Discover database first
const listResult = await matimo.execute('notion_list_databases', { page_size: 5 });
const selectedDatabase = listResult.data.results[0];

// Create agent with database context
const agent = await createAgent({
  model: new ChatOpenAI({ modelName: 'gpt-4o-mini' }),
  tools: langchainTools
});

// AI decides which tools to use
const response = await agent.invoke({
  messages: [{ role: 'user', content: 'Create a new page' }]
});
```

**File:** [notion-langchain.ts](notion-langchain.ts)

## 🎯 Available Notion Tools

All patterns have access to these core Notion tools:

### Database Operations
- `notion_list_databases` - List all accessible databases
- `notion_query_database` - Query pages in a database with filters

### Page Operations
- `notion_create_page` - Create new page in a database or as child page
- `notion_update_page` - Update page properties and icon
- `notion_get_page` - Retrieve page details

### Comments
- `notion_create_comment` - Add comments to pages

### Search
- `notion_search` - Search workspace for pages and databases

## 📝 Common Patterns

### Discovering Available Databases

```typescript
const result = await matimo.execute('notion_list_databases', { 
  page_size: 10 
});

const databases = result.data.results; // Array of database objects
databases.forEach(db => {
  const title = db.title[0]?.plain_text || 'Untitled';
  console.log(`📊 ${title} (${db.id})`);
});
```

### Creating Pages with Markdown

```typescript
const newPage = await matimo.execute('notion_create_page', {
  parent: { database_id: 'your-db-id' },
  icon: { type: 'emoji', emoji: '✅' },
  markdown: '# Page Title\n\n## Section\n\nContent here'
});
```

### Querying Database for Pages

```typescript
const result = await matimo.execute('notion_query_database', {
  database_id: 'your-db-id',
  page_size: 10,
  filter: {
    property: 'Status',
    status: { equals: 'Done' }
  }
});

const pages = result.data.results;
```

## 🔗 Resources

- **Notion API Documentation:** [developers.notion.com](https://developers.notion.com)
- **Create Integration:** [notion.com/my-integrations](https://www.notion.com/my-integrations)
- **Matimo Notion Tools:** [packages/notion](../../packages/notion)
- **Matimo Documentation:** [docs/](../../docs)

## ⚠️ Important Notes

### 1. Database Sharing Required
Tools can only access databases that have been **explicitly shared** with your integration. Use the Share button in Notion to grant access.

### 2. Destructive Operations
Tools like `notion_create_page` and `notion_update_page` make real changes to your Notion workspace. Be careful with credentials.

### 3. LangChain Pattern Limitations
The LangChain AI agent example:
- Automatically discovers and uses the first available database
- Does not support multi-step operations (e.g., create page then add comment) in a single request
- For complex workflows, use Factory or Decorator patterns

### 4. API Rate Limits
Notion API has rate limits. Long-running operations may need to retry. See [rate limiting docs](https://developers.notion.com/reference/node-sdk#rate-limits).

## 🚨 Troubleshooting

### "Not Authorized to Access This Resource"
- Ensure the database is **shared** with your integration
- Check the integration has the correct permissions

### "Notion API Error"
- Verify `NOTION_API_KEY` is set correctly
- Check the integration token hasn't expired

### "Database Not Found"
- Confirm the database ID is correct
- Ensure the database is shared with the integration

### No Databases Returned
- Create a database in Notion first
- Share it with your integration
- Run `notion:factory` to test discovery

## 📞 Support

For issues with:
- **Matimo tools:** See [packages/notion/README.md](../../packages/notion/README.md)
- **Notion API:** Visit [developers.notion.com/reference](https://developers.notion.com/reference)
- **LangChain:** Check [langchain.com/docs](https://docs.langchain.com)
