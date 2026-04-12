# @matimo/slack - Slack Tools for Matimo

Slack workspace integration tools for Matimo's universal AI tools ecosystem. Send messages, manage channels, upload files, and interact with Slack through YAML-defined tools that work with any AI framework.

## 📦 Installation

```bash
npm install @matimo/slack
# or
pnpm add @matimo/slack
```

## 🛠️ Available Tools (19 Total)

| Category | Tools | Description |
|----------|-------|-------------|
| **Messaging** | 4 tools | Send messages, replies, DMs |
| **Channels** | 4 tools | Create, join, manage channels |
| **Files** | 3 tools | Upload and share files |
| **Reading** | 3 tools | Read messages and history |
| **Reactions** | 2 tools | Add/get emoji reactions |
| **Users** | 2 tools | Get user information |

### Complete Tool List

- **slack-send-message** - Post message to channel
- **slack_send_channel_message** - Post message with markdown/blocks
- **slack_reply_to_message** - Reply in thread
- **slack_send_dm** - Send direct message
- **slack-list-channels** - List all channels/DMs
- **slack_create_channel** - Create public/private channel
- **slack_join_channel** - Add bot to channel
- **slack_set_channel_topic** - Update channel description
- **slack_upload_file** - Upload file to Slack (modern API)
- **slack_upload_file_v2** - Get upload URL for files
- **slack_complete_file_upload** - Complete upload and share
- **slack_get_channel_history** - Get messages from channel
- **slack_get_thread_replies** - Get thread replies
- **slack_search_messages** - Search message history
- **slack_add_reaction** - Add emoji reaction
- **slack_get_reactions** - Get reactions on message
- **slack_get_user_info** - Get user details
- **slack-get-user** - Alias of slack_get_user_info

## 🚀 Quick Start

```typescript
import { MatimoInstance } from 'matimo';

const matimo = await MatimoInstance.init({ autoDiscover: true });

// Send a message to a channel
await matimo.execute('slack-send-message', {
  channel: '#general',
  text: 'Hello from Matimo AI!'
});

// List available channels
const channels = await matimo.execute('slack-list-channels', {});
```

## 🔐 Authentication

Set your Slack Bot token:

```bash
export SLACK_BOT_TOKEN="xoxb-your-bot-token"
```

Or use environment variables in your application.

## 📚 Integration Examples

### With LangChain

```typescript
import { MatimoInstance } from 'matimo';
import { ChatOpenAI } from '@langchain/openai';

const matimo = await MatimoInstance.init({ autoDiscover: true });
const tools = matimo.listTools().filter(t => t.name.startsWith('slack'));

// Use with LangChain agent
```

### With Custom Code

```typescript
import { MatimoInstance } from 'matimo';

class SlackAgent {
  private matimo: MatimoInstance;

  constructor() {
    this.matimo = await MatimoInstance.init({ autoDiscover: true });
  }

  async sendMessage(channel: string, text: string) {
    return await this.matimo.execute('slack-send-message', { channel, text });
  }
}
```

## 🔗 API Reference

All tools are based on official Slack Web API methods. See [Slack API Documentation](https://api.slack.com/methods).

| Tool | Slack API Method | Bot Scopes Required |
|------|------------------|-------------------|
| slack-send-message | chat.postMessage | chat:write |
| slack_send_channel_message | chat.postMessage | chat:write |
| slack_reply_to_message | chat.postMessage | chat:write |
| slack_send_dm | conversations.open + chat.postMessage | chat:write, im:write |
| slack-list-channels | conversations.list | channels:read, groups:read, im:read, mpim:read |
| slack_create_channel | conversations.create | channels:manage |
| slack_join_channel | conversations.join | channels:write |
| slack_set_channel_topic | conversations.setTopic | channels:write |
| slack_upload_file | files.getUploadURLExternal | files:write |
| slack_upload_file_v2 | files.getUploadURLExternal | files:write |
| slack_complete_file_upload | files.completeUploadExternal | files:write |
| slack_get_channel_history | conversations.history | channels:history |
| slack_get_thread_replies | conversations.replies | channels:history |
| slack_search_messages | search.messages | search:read |
| slack_add_reaction | reactions.add | reactions:write |
| slack_get_reactions | reactions.get | reactions:read |
| slack_get_user_info | users.info | users:read |
| slack-get-user | users.info | users:read |

## 📋 Tool Specifications

Each tool is defined in YAML with complete parameter validation and error handling. Tools include:

- **Parameter validation** with Zod schemas
- **OAuth2/bot token authentication** with automatic injection
- **Error handling** with structured error codes
- **Output validation** against defined schemas

## 🤝 Contributing

Found a bug or want to add a Slack tool? See [Contributing Guide](../../CONTRIBUTING.md) and [Adding Tools Guide](../tool-development/ADDING_TOOLS.md).

---

**Part of the Matimo ecosystem** - Define tools once, use them everywhere! 🎯
| slack_reply_to_message     | chat.postMessage                     | chat:write           |
| slack_send_dm              | conversations.open, chat.postMessage | im:write, chat:write |
| slack-list-channels        | conversations.list                   | channels:read        |
| slack_create_channel       | conversations.create                 | channels:manage      |
| slack_join_channel         | conversations.join                   | channels:join        |
| slack_set_channel_topic    | conversations.setTopic               | channels:write.topic |
| slack_upload_file          | files.getUploadURLExternal           | files:write          |
| slack_upload_file_v2       | files.getUploadURLExternal           | files:write          |
| slack_complete_file_upload | files.completeUploadExternal         | files:write          |
| slack_get_channel_history  | conversations.history                | channels:history     |
| slack_get_thread_replies   | conversations.replies                | channels:history     |
| slack_search_messages      | search.messages                      | search:read          |
| slack_add_reaction         | reactions.add                        | reactions:write      |
| slack_get_reactions        | reactions.get                        | reactions:read       |
| slack_get_user_info        | users.info                           | users:read           |
| slack-get-user             | users.info                           | users:read           |

## ✅ Status

- ✅ **19 Tools Implemented** - All audited against official Slack API
- ✅ **Modern APIs** - Using latest Slack recommendations
- ✅ **OAuth Scopes Documented** - All required scopes listed
- ✅ **Type-Safe** - Full TypeScript support with Zod validation
- ✅ **Production Ready** - Tested and working

## 📋 Tool Definitions

Each tool is defined in a `definition.yaml` file with:

- **Parameters** - Input parameters with types and descriptions
- **Execution** - How to execute (HTTP method, URL, headers, body)
- **Authentication** - Auth type and location
- **Output Schema** - Response validation
- **Notes** - Usage notes, scopes, best practices

### Example Tool Structure

```yaml
name: slack-send-message
description: Post a message to a Slack channel
parameters:
  channel:
    type: string
    required: true
    description: Channel ID or name
  text:
    type: string
    required: true
    description: Message text
execution:
  type: http
  method: POST
  url: https://slack.com/api/chat.postMessage
  headers:
    Authorization: Bearer {SLACK_BOT_TOKEN}
  body:
    channel: '{channel}'
    text: '{text}'
```

## 🚀 Quick Start

### 1. Create Slack App

1. Go to [api.slack.com/apps](https://api.slack.com/apps)
2. Click "Create New App" → "From scratch"
3. Name: "Matimo" (or your choice)
4. Select your workspace

### 2. Add OAuth Scopes

Navigate to **OAuth & Permissions** and add all required scopes from the table above.

### 3. Install App

Click "Install to Workspace" and authorize permissions.

### 4. Get Bot Token

Copy the **Bot User OAuth Token** (starts with `xoxb-`)

### 5. Set Environment Variable

```bash
export SLACK_BOT_TOKEN=xoxb-your-token-here
```

## 💡 Usage Examples

### Send Message (Factory Pattern)

```typescript
const matimo = await MatimoInstance.init('./tools');

const result = await matimo.execute('slack-send-message', {
  channel: 'C024BE91L',
  text: 'Hello from Matimo!',
});
```

### List Channels

```typescript
const channels = await matimo.execute('slack-list-channels', {
  types: 'public_channel,private_channel',
});
```

### Upload File (Modern 2-Step)

```typescript
// Step 1: Get upload URL
const upload = await matimo.execute('slack_upload_file_v2', {
  filename: 'report.pdf',
  file_size: 1024000,
});

// Step 2: Upload file binary (manual)

// Step 3: Complete upload
await matimo.execute('slack_complete_file_upload', {
  files: [{ id: upload.file_id }],
  channel_id: 'C024BE91L',
});
```

## 📚 Documentation

- **[Comprehensive Guide](/examples/tools/slack/README.md)** - Full guide with examples
- **[Official Slack Docs](https://docs.slack.dev/)** - Slack Web API reference

## 🔐 Authentication

All tools use OAuth2 with bot tokens:

```bash
# Set environment variable with bot token
export SLACK_BOT_TOKEN=xoxb-your-token-here
```

The token is automatically injected into all API requests.

## 📝 Notes

- **Bot Membership Required** - Bot must be member of channels to send messages
- **Scopes Matter** - Ensure all required scopes are granted in OAuth settings
- **Rate Limits** - Slack has rate limits; implement delays between rapid calls
- **File Uploads** - Use modern API (slack_upload_file) for best compatibility
- **Error Handling** - All responses include `ok` field and error details

## 🔄 Versioning

- **Version 1.0.0** - Initial release with 19 tools
- **Modern APIs** - All tools use current Slack API (as of Feb 2026)
- **No Deprecated Tools** - Replaced deprecated files.upload with modern API

## 📞 Support

- **Slack API Docs** - https://docs.slack.dev/
- **Matimo GitHub** - https://github.com/tallclub/matimo
- **Issues** - Report issues on GitHub

---

**All tools are production-ready and fully tested.** 🎉
