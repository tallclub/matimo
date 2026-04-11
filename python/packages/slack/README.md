# matimo-slack

> Slack tools for the [Matimo](https://matimo.dev) AI tools SDK — send messages, manage channels, upload files, and more.

[![PyPI](https://img.shields.io/pypi/v/matimo-slack)](https://pypi.org/project/matimo-slack/)
[![Docs](https://img.shields.io/badge/docs-matimo.dev-blue)](https://matimo.dev/docs)

---

## Installation

```bash
pip install matimo matimo-slack
```

---

## Available Tools (19 Total)

| Category | Tool | Description |
|----------|------|-------------|
| **Messaging** | `slack_send_channel_message` | Post message with markdown/blocks |
| | `slack-send-message` | Post plain message to channel |
| | `slack_reply_to_message` | Reply in thread |
| | `slack_send_dm` | Send direct message |
| **Channels** | `slack-list-channels` | List all channels/DMs |
| | `slack_create_channel` | Create public/private channel |
| | `slack_join_channel` | Add bot to channel |
| | `slack_set_channel_topic` | Update channel description/topic |
| **Files** | `slack_upload_file` | Upload file (modern API) |
| | `slack_upload_file_v2` | Get upload URL for large files |
| | `slack_complete_file_upload` | Complete upload and share to channel |
| **Reading** | `slack_get_channel_history` | Read messages from channel |
| | `slack_get_thread_replies` | Get thread replies |
| | `slack_search_messages` | Search message history |
| **Reactions** | `slack_add_reaction` | Add emoji reaction to message |
| | `slack_get_reactions` | Get reactions on a message |
| **Users** | `slack_get_user_info` | Get user profile details |
| | `slack-get-user` | Alias of `slack_get_user_info` |

---

## Quick Start

```python
import asyncio
import os
from matimo import Matimo
from matimo_slack import get_tools_path

async def main():
    matimo = await Matimo.init(get_tools_path())

    # Send a message
    await matimo.execute('slack_send_channel_message', {
        'channel': '#general',
        'text': 'Hello from Matimo!',
    })

    # List channels
    result = await matimo.execute('slack-list-channels', {})
    print(result)

asyncio.run(main())
```

---

## Authentication

All tools authenticate using a Slack Bot Token:

```bash
export SLACK_BOT_TOKEN="xoxb-your-bot-token"
```

### Setting Up a Slack App

1. Go to [api.slack.com/apps](https://api.slack.com/apps) → **Create New App** → From scratch
2. Navigate to **OAuth & Permissions** and add scopes (see table below)
3. Click **Install to Workspace** and copy the **Bot User OAuth Token**
4. Set `SLACK_BOT_TOKEN` in your environment

### Required OAuth Scopes

| Tool | Slack API Method | Required Scopes |
|------|-----------------|-----------------|
| `slack_send_channel_message` / `slack-send-message` | `chat.postMessage` | `chat:write` |
| `slack_reply_to_message` | `chat.postMessage` | `chat:write` |
| `slack_send_dm` | `conversations.open` + `chat.postMessage` | `im:write`, `chat:write` |
| `slack-list-channels` | `conversations.list` | `channels:read`, `groups:read`, `im:read`, `mpim:read` |
| `slack_create_channel` | `conversations.create` | `channels:manage` |
| `slack_join_channel` | `conversations.join` | `channels:join` |
| `slack_set_channel_topic` | `conversations.setTopic` | `channels:write.topic` |
| `slack_upload_file` / `slack_upload_file_v2` | `files.getUploadURLExternal` | `files:write` |
| `slack_complete_file_upload` | `files.completeUploadExternal` | `files:write` |
| `slack_get_channel_history` | `conversations.history` | `channels:history` |
| `slack_get_thread_replies` | `conversations.replies` | `channels:history` |
| `slack_search_messages` | `search.messages` | `search:read` |
| `slack_add_reaction` | `reactions.add` | `reactions:write` |
| `slack_get_reactions` | `reactions.get` | `reactions:read` |
| `slack_get_user_info` / `slack-get-user` | `users.info` | `users:read` |

---

## LangChain Agent Example

```python
from matimo import Matimo
from matimo_slack import get_tools_path
from matimo.integrations.langchain import convert_tools_to_langchain
from langchain_openai import ChatOpenAI
from langchain.agents import AgentExecutor, create_tool_calling_agent
from langchain_core.prompts import ChatPromptTemplate

matimo = await Matimo.init(get_tools_path())
lc_tools = convert_tools_to_langchain(
    matimo.list_tools(),
    matimo,
    credentials={'SLACK_BOT_TOKEN': os.environ['SLACK_BOT_TOKEN']},
)
llm = ChatOpenAI(model='gpt-4o-mini')
prompt = ChatPromptTemplate.from_messages([
    ('system', 'You are a Slack assistant.'),
    ('human', '{input}'),
    ('placeholder', '{agent_scratchpad}'),
])
agent = create_tool_calling_agent(llm, lc_tools, prompt)
executor = AgentExecutor(agent=agent, tools=lc_tools)
result = await executor.ainvoke({'input': 'List all public channels'})
```

---

## Usage Notes

- The bot must be **a member of a channel** before it can post messages or read history
- Use `slack_upload_file` (not the deprecated `files.upload`) for file uploads
- `slack_search_messages` requires the `search:read` scope which needs special approval from Slack
- Rate limits apply — add delays between rapid API calls in bulk operations

---

## Documentation

- [Slack Integration Guide](https://matimo.dev/docs) 
- [Slack Web API Reference](https://api.slack.com/methods)
- [Python Examples](https://github.com/tallclub/matimo/tree/main/python/examples/native/slack)

---

## Links

- **PyPI:** https://pypi.org/project/matimo-slack/
- **GitHub:** https://github.com/tallclub/matimo
- **Slack API Docs:** https://api.slack.com/

