# Mailchimp Tools Examples

Example directory contains **3 example patterns** showing different ways to use Matimo's Mailchimp tools:
1. **Factory Pattern** - Direct SDK execution (simplest)
2. **Decorator Pattern** - Class-based with @tool decorators
3. **LangChain Pattern** - AI-driven with OpenAI agent

All examples are **fully working** and demonstrate real Mailchimp operations (audiences, subscribers, and campaigns).

## 🚀 Quick Start

### 1. Create a Mailchimp API Key

1. Log in to your [Mailchimp account](https://login.mailchimp.com/)
2. Navigate to **Account & Billing** → **Extras** → **API Keys**
3. Click **Create A Key**
4. Give it a name and copy the generated key

Your API key will look like: `abc123def456ghi789-us6`

The suffix after the final `-` (e.g., `us6`) is your **server prefix** — the examples extract this automatically from the API key.

### 2. Set Up Environment

Create a `.env` file in `examples/tools/`:

```env
MAILCHIMP_API_KEY=abc123def456ghi789-us6
OPENAI_API_KEY=sk-your-openai-key-here
```

The `OPENAI_API_KEY` is only required for the LangChain example.

### 3. Run Examples

```bash
# Factory Pattern (simplest, direct API calls)
pnpm mailchimp:factory

# Decorator Pattern (class-based OOP approach)
pnpm mailchimp:decorator

# LangChain Pattern (AI-driven agent with OpenAI)
pnpm mailchimp:langchain
```

## 📚 Examples Overview

### 1. Factory Pattern (`mailchimp-factory.ts`)

**Best for:** Scripts, quick tests, CLI tools

**What it does:**
- ✅ Direct tool execution with `matimo.execute()`
- ✅ Loads live audiences and real subscribers from your account
- ✅ Updates a subscriber's status via PATCH
- ✅ Creates a draft campaign with a real reply-to address
- ✅ Simplest implementation

**Run it:**
```bash
pnpm mailchimp:factory
```

**Key Code:**
```typescript
const matimo = await MatimoInstance.init({ autoDiscover: true });
const SERVER = apiKey.split('-').pop()!;

// Get all audiences
const listsData = await matimo.execute('mailchimp-get-lists', {
  server_prefix: SERVER,
  count: 10,
});

// Get real subscribers from the first audience
const membersData = await matimo.execute('mailchimp-get-list-members', {
  server_prefix: SERVER,
  list_id: listId,
  count: 5,
});

// Create a draft campaign replying to a real subscriber
const campaign = await matimo.execute('mailchimp-create-campaign', {
  server_prefix: SERVER,
  type: 'regular',
  list_id: listId,
  subject_line: 'Hello from Matimo!',
  reply_to: contact.email_address,
});
```

**File:** [mailchimp-factory.ts](mailchimp-factory.ts)

---

### 2. Decorator Pattern (`mailchimp-decorator.ts`)

**Best for:** Object-oriented design, class-based applications

**What it does:**
- ✅ Class methods decorated with `@tool`
- ✅ Automatic tool execution via decorators
- ✅ Same CRUD flow as factory: audiences → subscribers → update → campaign
- ✅ OOP-friendly approach

**Run it:**
```bash
pnpm mailchimp:decorator
```

**Key Code:**
```typescript
import { setGlobalMatimoInstance, tool } from 'matimo';

const matimo = await MatimoInstance.init({ autoDiscover: true });
setGlobalMatimoInstance(matimo);

class MailchimpAgent {
  @tool('mailchimp-get-lists')
  async getLists(server_prefix: string, count?: number): Promise<unknown> {
    return undefined;
  }

  @tool('mailchimp-get-list-members')
  async getListMembers(
    server_prefix: string,
    list_id: string,
    status?: string,
    count?: number
  ): Promise<unknown> {
    return undefined;
  }

  @tool('mailchimp-create-campaign')
  async createCampaign(
    server_prefix: string,
    type: string,
    list_id: string,
    subject_line: string,
    preview_text?: string,
    title?: string,
    from_name?: string,
    reply_to?: string
  ): Promise<unknown> {
    return undefined;
  }
}

const agent = new MailchimpAgent();
const lists = await agent.getLists(SERVER, 10);
```

**File:** [mailchimp-decorator.ts](mailchimp-decorator.ts)

---

### 3. LangChain Pattern (`mailchimp-langchain.ts`)

**Best for:** AI-driven workflows, autonomous agents, multi-step reasoning

**What it does:**
- ✅ Real AI agent using OpenAI (GPT-4o-mini)
- ✅ LLM decides which tools to use based on natural language goals
- ✅ Autonomous execution of multi-step Mailchimp workflows
- ✅ No tool names in prompts — pure business objectives

**Prerequisites:**
- Requires `OPENAI_API_KEY` set in `.env`
- Requires `@langchain/openai` and `langchain` dependencies

**Run it:**
```bash
pnpm mailchimp:langchain
```

**Key Code:**
```typescript
import { MatimoInstance, convertToolsToLangChain } from 'matimo';
import { ChatOpenAI } from '@langchain/openai';

const matimo = await MatimoInstance.init({ autoDiscover: true });

const mailchimpToolDefs = matimo.listTools().filter((t) => t.name.startsWith('mailchimp-'));
const langchainTools = await convertToolsToLangChain(mailchimpToolDefs as any[], matimo, {
  MAILCHIMP_API_KEY: apiKey,
});

const model = new ChatOpenAI({ model: 'gpt-4o-mini' });
const agent = createReactAgent({ llm: model, tools: langchainTools });

// Natural language goals — the agent picks the right tools autonomously
await agent.invoke({ messages: [{ role: 'user', content: 'Show me all my mailing lists' }] });
await agent.invoke({ messages: [{ role: 'user', content: 'Show me the 5 most recent active subscribers in my first list' }] });
await agent.invoke({ messages: [{ role: 'user', content: "Create a draft campaign with a descriptive subject line; use the first subscriber's email as reply-to" }] });
```

**Agent Examples:**
```
User: "Show me all my mailing lists with names and subscriber counts"
Agent: [calls mailchimp-get-lists]
Agent: "You have 2 mailing lists: 'Newsletter' (1,234 subscribers) and 'Updates' (567 subscribers)"

User: "Show me the 5 most recent active subscribers in my first list"
Agent: [calls mailchimp-get-list-members]
Agent: "Here are 5 recent subscribers: jane@example.com (subscribed), ..."

User: "Get my first subscriber and confirm they are still subscribed"
Agent: [calls mailchimp-get-list-members, then mailchimp-update-list-member]
Agent: "Confirmed — jane@example.com is subscribed"

User: "Create a draft campaign for the newsletter list, use the first subscriber's email as reply-to"
Agent: [calls mailchimp-create-campaign]
Agent: "Draft campaign 'Newsletter Update' created (ID: abc123)"
```

**File:** [mailchimp-langchain.ts](mailchimp-langchain.ts)

---

## 🔧 Supported Operations

All examples work with these Mailchimp operations:

| Category | Tool Name | Description |
|----------|-----------|-------------|
| **Audiences** | `mailchimp-get-lists` | Get all audiences with subscriber counts |
| **Subscribers** | `mailchimp-get-list-members` | List members with status filter and pagination |
| **Subscribers** | `mailchimp-add-list-member` | Add a new subscriber to an audience |
| **Subscribers** | `mailchimp-update-list-member` | Update subscriber status or merge fields (PATCH) |
| **Subscribers** | `mailchimp-remove-list-member` | Remove a subscriber ⚠️ Requires Approval |
| **Campaigns** | `mailchimp-create-campaign` | Create a draft email campaign |
| **Campaigns** | `mailchimp-send-campaign` | Send a campaign ⚠️ Requires Approval |

See [packages/mailchimp/README.md](../../packages/mailchimp/README.md) for complete parameter documentation.

---

## 🔐 Finding Your Server Prefix

Your **server prefix** (e.g., `us6`, `us21`) is embedded in your API key:

```
API Key:  abc123def456ghi789-us6
                              ^^^
                        server_prefix
```

All examples extract this automatically:

```typescript
const apiKey = process.env.MAILCHIMP_API_KEY!;
const SERVER = apiKey.split('-').pop()!;  // → "us6"
```

Pass `SERVER` as the `server_prefix` parameter in every tool call.

---

## 🛠️ Troubleshooting

### "MAILCHIMP_API_KEY not set"
```bash
export MAILCHIMP_API_KEY="abc123def456-us6"
```
Or add it to `examples/tools/.env`.

### "404 Resource Not Found"
- Wrong `list_id` — retrieve it fresh from `mailchimp-get-lists`
- Wrong `subscriber_hash` — the examples use the `id` field from `mailchimp-get-list-members`, which is already the MD5 hash

### "400 Invalid Resource" on update
- Mailchimp accounts may require specific merge fields (e.g., ADDRESS sub-fields) that differ per account
- The `update-list-member` step uses PATCH to update only the fields you provide
- If the update fails, check your account's audience merge field requirements in Mailchimp → Audience → Settings → Audience fields

### "401 Unauthorized"
- Verify the API key (check for typos or extra spaces)
- Regenerate it at **Account → Extras → API Keys**

### "OpenAI API error" (LangChain example)
```bash
export OPENAI_API_KEY="sk-your-openai-key-here"
```
Get a key from [platform.openai.com](https://platform.openai.com/account/api-keys).

### "Module not found: @langchain/openai"
```bash
pnpm install
```

---

## 📖 Full Documentation

- **Package Docs:** [packages/mailchimp/README.md](../../packages/mailchimp/README.md)
- **Mailchimp API Reference:** https://mailchimp.com/developer/marketing/api/
- **Matimo Documentation:** [docs/getting-started/](../../docs/getting-started/)

---

## 🚀 Next Steps

1. **Try each example in order:**
   - Start with Factory (simplest)
   - Try Decorator (OOP style)
   - Explore LangChain (AI-driven)

2. **Build your own:**
   - Add the `mailchimp-add-list-member` tool to create new subscribers
   - Chain `mailchimp-create-campaign` → `mailchimp-send-campaign` for a full send flow
   - Combine with Slack or Gmail tools for cross-provider workflows

3. **Advanced:**
   - Use the LangChain agent for multi-step automated email campaigns
   - Paginate through large audiences with `count` and `offset` parameters
   - Combine Mailchimp tools with other Matimo providers (Slack, Gmail, HubSpot, etc.)

---

**Questions?** See [CONTRIBUTING.md](../../CONTRIBUTING.md) or review the Matimo core documentation.
