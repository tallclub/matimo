# matimo-gmail

> Gmail tools for [Matimo](https://matimo.dev) - send, list, read, and delete emails.

[![PyPI](https://img.shields.io/pypi/v/matimo-gmail)](https://pypi.org/project/matimo-gmail/)
[![Docs](https://img.shields.io/badge/docs-matimo.dev-blue)](https://matimo.dev/docs)

---

## Installation

```bash
pip install matimo matimo-gmail
```

---

## Available Tools (6 Total)

| Tool | Description |
|------|-------------|
| `gmail-send-email` | Send an email (to, subject, body, cc, bcc, html) |
| `gmail-list-messages` | List messages with optional query/label filters |
| `gmail-get-message` | Get full message content by ID |
| `gmail-get-attachment` | Fetch a message attachment by ID (base64url-encoded) |
| `gmail-create-draft` | Create a draft email |
| `gmail-delete-message` | Move message to trash |

---

## Quick Start

```python
import asyncio
from matimo import Matimo
from matimo_gmail import get_tools_path

async def main():
    matimo = await Matimo.init(get_tools_path())

    # Send an email
    await matimo.execute('gmail-send-email', {
        'to': 'user@example.com',
        'subject': 'Hello from Matimo',
        'body': 'This message was sent by an AI agent.',
    })

    # List recent messages
    result = await matimo.execute('gmail-list-messages', {
        'query': 'is:unread',
        'max_results': 10,
    })

asyncio.run(main())
```

---

## Authentication

Gmail tools use OAuth2. Set your credentials via environment variables:

```bash
export GMAIL_ACCESS_TOKEN="ya29.your-oauth2-access-token"
```

### Getting an Access Token (OAuth2)

1. Create a project in [Google Cloud Console](https://console.cloud.google.com/)
2. Enable the **Gmail API**
3. Create OAuth 2.0 credentials (Desktop app)
4. Run the OAuth flow to get an access token

---

## Documentation

- [Gmail API Reference](https://developers.google.com/gmail/api/reference/rest)
- [Python Examples](https://github.com/tallclub/matimo/tree/main/python/examples/native/gmail)

---

## Links

- **PyPI:** https://pypi.org/project/matimo-gmail/
- **GitHub:** https://github.com/tallclub/matimo
- **Gmail API Docs:** https://developers.google.com/gmail/api

