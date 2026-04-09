# @matimo/mailchimp — Mailchimp Tools for Matimo

Mailchimp email marketing integration tools for Matimo's universal AI tools ecosystem. Manage audiences, subscribers, and campaigns through YAML-defined tools that work with any AI framework.

## 📦 Installation

```bash
npm install @matimo/mailchimp
# or
pnpm add @matimo/mailchimp
```

## 🛠️ Available Tools (7 Total)

| Category | Tool | Method | Description |
|----------|------|--------|-------------|
| **Audiences** | `mailchimp-get-lists` | GET | Get all audiences/lists |
| **Subscribers** | `mailchimp-add-list-member` | POST | Subscribe a contact to an audience |
| **Subscribers** | `mailchimp-get-list-members` | GET | Get subscribers with filters and pagination |
| **Subscribers** | `mailchimp-update-list-member` | PATCH | Update subscriber info or status |
| **Subscribers** | `mailchimp-remove-list-member` | DELETE | Remove subscriber (🔒 requires approval) |
| **Campaigns** | `mailchimp-create-campaign` | POST | Create an email campaign |
| **Campaigns** | `mailchimp-send-campaign` | POST | Send a campaign (🔒 requires approval) |

## 🚀 Quick Start

```typescript
import { MatimoInstance } from 'matimo';

const matimo = await MatimoInstance.init({ autoDiscover: true });

// Get all audiences
const audiences = await matimo.execute('mailchimp-get-lists', {
  server_prefix: 'us6',
  count: 10,
});

// Add a subscriber
await matimo.execute('mailchimp-add-list-member', {
  server_prefix: 'us6',
  list_id: 'your_list_id',
  email_address: 'jane@example.com',
  status: 'subscribed',
  merge_fields: { FNAME: 'Jane', LNAME: 'Doe' },
});
```

## 🔐 Authentication

Mailchimp Marketing API v3 uses **API key authentication**.

### Step 1: Get Your API Key

1. Log in to your Mailchimp account
2. Navigate to **Account → Extras → API Keys**
3. Click **Create A Key**
4. Copy the generated key (format: `abc123def456-us6`)

### Step 2: Find Your Server Prefix

Your server prefix is the suffix on your API key after the dash.

```
API Key: abc123def456-us6
              ↑
         server_prefix = "us6"
```

### Step 3: Set Environment Variables

```bash
export MAILCHIMP_API_KEY="abc123def456-us6"
```

### Step 4: Use in Tool Calls

Pass `server_prefix` as a parameter to every tool call:

```typescript
await matimo.execute('mailchimp-get-lists', {
  server_prefix: 'us6',   // ← your data center prefix
});
```

## 📚 Integration Examples

### Factory Pattern

```typescript
import 'dotenv/config';
import { MatimoInstance } from 'matimo';

const matimo = await MatimoInstance.init({ autoDiscover: true });
const SERVER = process.env.MAILCHIMP_SERVER_PREFIX || 'us6';

// List audiences
const result = await matimo.execute('mailchimp-get-lists', {
  server_prefix: SERVER,
  count: 10,
});
console.info('Audiences:', result.data.lists.map(l => l.name));

// Add subscriber
await matimo.execute('mailchimp-add-list-member', {
  server_prefix: SERVER,
  list_id: 'abc123def4',
  email_address: 'newuser@example.com',
  status: 'subscribed',
  merge_fields: { FNAME: 'New', LNAME: 'User' },
});
```

### Decorator Pattern

```typescript
import { MatimoInstance, tool, setGlobalMatimoInstance } from 'matimo';

const matimo = await MatimoInstance.init({ autoDiscover: true });
setGlobalMatimoInstance(matimo);

class MailchimpAgent {
  @tool('mailchimp-get-lists')
  async getLists(server_prefix: string, count?: number): Promise<unknown> {
    return undefined;
  }

  @tool('mailchimp-add-list-member')
  async addSubscriber(
    server_prefix: string,
    list_id: string,
    email_address: string,
    status: string
  ): Promise<unknown> {
    return undefined;
  }
}

const agent = new MailchimpAgent();
const lists = await agent.getLists('us6', 10);
```

### With LangChain

```typescript
import { MatimoInstance, convertToolsToLangChain } from 'matimo';
import { ChatOpenAI } from '@langchain/openai';
import { createAgent } from 'langchain';

const matimo = await MatimoInstance.init({ autoDiscover: true });

// Filter and convert Mailchimp tools for LangChain
const mailchimpTools = matimo
  .listTools()
  .filter(t => t.name.startsWith('mailchimp-'));

const langchainTools = convertToolsToLangChain(mailchimpTools, matimo);

const llm = new ChatOpenAI({ model: 'gpt-4o-mini' });
const agent = await createAgent({ llm, tools: langchainTools });

// Agent can now use Mailchimp tools autonomously
await agent.invoke({
  input: 'Subscribe john@example.com to the main newsletter list'
});
```

## 🔧 API Reference

### mailchimp-get-lists

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `server_prefix` | string | ✅ Yes | Data center prefix (e.g., `us6`) |
| `count` | number | No | Results per page (default: 10, max: 1000) |
| `offset` | number | No | Records to skip for pagination (default: 0) |

### mailchimp-add-list-member

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `server_prefix` | string | ✅ Yes | Data center prefix |
| `list_id` | string | ✅ Yes | Audience/list ID |
| `email_address` | string | ✅ Yes | Subscriber email address |
| `status` | string | ✅ Yes | `subscribed`, `unsubscribed`, `pending`, or `cleaned` |
| `merge_fields` | object | No | Merge fields like `{"FNAME": "Jane", "LNAME": "Doe"}` |
| `tags` | array | No | Array of tag name strings |

### mailchimp-get-list-members

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `server_prefix` | string | ✅ Yes | Data center prefix |
| `list_id` | string | ✅ Yes | Audience/list ID |
| `status` | string | No | Filter by status: `subscribed`, `unsubscribed`, `pending`, `cleaned` |
| `count` | number | No | Results per page (default: 10, max: 1000) |
| `offset` | number | No | Records to skip |

### mailchimp-update-list-member

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `server_prefix` | string | ✅ Yes | Data center prefix |
| `list_id` | string | ✅ Yes | Audience/list ID |
| `subscriber_hash` | string | ✅ Yes | MD5 hash of the lowercase email address |
| `status` | string | No | New subscription status |
| `email_address` | string | No | New email address |
| `merge_fields` | object | No | Merge fields to update |

### mailchimp-remove-list-member ⚠️ Requires Approval

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `server_prefix` | string | ✅ Yes | Data center prefix |
| `list_id` | string | ✅ Yes | Audience/list ID |
| `subscriber_hash` | string | ✅ Yes | MD5 hash of the lowercase email address |

### mailchimp-create-campaign

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `server_prefix` | string | ✅ Yes | Data center prefix |
| `type` | string | ✅ Yes | `regular`, `plaintext`, `rss`, or `variate` |
| `list_id` | string | No | Audience/list ID to send to |
| `subject_line` | string | No | Campaign subject line |
| `preview_text` | string | No | Preview text for email clients |
| `title` | string | No | Internal campaign title |
| `from_name` | string | No | Sender display name |
| `reply_to` | string | No | Reply-to email address |

### mailchimp-send-campaign ⚠️ Requires Approval

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `server_prefix` | string | ✅ Yes | Data center prefix |
| `campaign_id` | string | ✅ Yes | Campaign ID from `mailchimp-create-campaign` |

## 💡 Tips

### Finding the Subscriber Hash

The `subscriber_hash` is the MD5 hash of the lowercase email address:

```javascript
import { createHash } from 'crypto';
const email = 'jane@example.com';
const hash = createHash('md5').update(email.toLowerCase()).digest('hex');
// Use hash as subscriber_hash
```

### Rate Limits

- Mailchimp Marketing API: 10 requests per second per account
- Some batch operations count as multiple requests
- Implement appropriate delays in high-volume scenarios

### Pagination

For large audiences, paginate through results:

```typescript
let offset = 0;
const count = 100;
let allMembers = [];

while (true) {
  const result = await matimo.execute('mailchimp-get-list-members', {
    server_prefix: 'us6',
    list_id: 'abc123',
    count,
    offset,
  });
  allMembers.push(...result.data.members);
  if (result.data.members.length < count) break;
  offset += count;
}
```

## 🐛 Troubleshooting

| Error | Cause | Solution |
|-------|-------|----------|
| `404 Resource Not Found` | Wrong `list_id` or `subscriber_hash` | Verify IDs from Mailchimp dashboard |
| `400 Invalid Resource` | Malformed request body | Check parameter types and required fields |
| `401 Unauthorized` | Invalid or expired API key | Regenerate API key at Mailchimp account settings |
| `403 Forbidden` | Insufficient permissions | Check API key permissions |
| `429 Too Many Requests` | Rate limit exceeded | Implement delays between requests |

## 🤝 Contributing

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for guidelines on contributing to Matimo.

---

Part of the [Matimo](https://github.com/tallclub/matimo) ecosystem — Write YAML once, use everywhere.
