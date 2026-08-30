# matimo-mailchimp

> Mailchimp tools for [Matimo](https://matimo.dev) - manage campaigns, lists, and subscribers.

[![PyPI](https://img.shields.io/pypi/v/matimo-mailchimp)](https://pypi.org/project/matimo-mailchimp/)
[![Docs](https://img.shields.io/badge/docs-matimo.dev-blue)](https://matimo.dev/docs)

---

## Installation

```bash
pip install matimo matimo-mailchimp
```

---

## Available Tools (7 Total)

| Tool | Description |
|------|-------------|
| `mailchimp-get-lists` | List all audiences (lists) in your account |
| `mailchimp-get-list-members` | Get subscribers in an audience |
| `mailchimp-add-list-member` | Subscribe an email address to an audience |
| `mailchimp-update-list-member` | Update subscriber tags, status, or merge fields |
| `mailchimp-remove-list-member` | Unsubscribe or archive a list member |
| `mailchimp-create-campaign` | Create a new email campaign |
| `mailchimp-send-campaign` | Send a campaign to its audience |

---

## Quick Start

```python
import asyncio
import os
from matimo import Matimo
from matimo_mailchimp import get_tools_path

async def main():
    matimo = await Matimo.init(get_tools_path())

    # List all audiences (server_prefix is required on every call)
    lists = await matimo.execute('mailchimp-get-lists', {
        'server_prefix': 'us1',
    })
    print(lists)

    # Add a subscriber
    await matimo.execute('mailchimp-add-list-member', {
        'server_prefix': 'us1',
        'list_id': 'abc123def',
        'email_address': 'new@example.com',
        'status': 'subscribed',
        'merge_fields': {'FNAME': 'Jane', 'LNAME': 'Doe'},
    })

    # Create and send a campaign
    campaign = await matimo.execute('mailchimp-create-campaign', {
        'server_prefix': 'us1',
        'list_id': 'abc123def',
        'subject_line': 'April Newsletter',
        'from_name': 'My Company',
        'reply_to': 'hello@example.com',
    })
    await matimo.execute('mailchimp-send-campaign', {
        'server_prefix': 'us1',
        'campaign_id': campaign['id'],
    })

asyncio.run(main())
```

---

## Authentication

```bash
export MAILCHIMP_API_KEY="your-api-key-us1"     # includes datacenter suffix
```

Every tool also requires a `server_prefix` parameter (e.g. `'us1'`) passed
directly in the call - it is not read from an environment variable.

### Getting Mailchimp API Credentials

1. Log in to [Mailchimp](https://mailchimp.com) → **Profile** → **Extras** → **API keys**
2. Click **Create A Key**
3. Copy the API key - the suffix (`us1`, `us6`, etc.) is your server prefix, used as the `server_prefix` parameter

---

## Documentation

- [Mailchimp Marketing API](https://mailchimp.com/developer/marketing/api/)
- [Python Examples](https://github.com/tallclub/matimo/tree/main/python/examples/native/mailchimp)

---

## Links

- **PyPI:** https://pypi.org/project/matimo-mailchimp/
- **GitHub:** https://github.com/tallclub/matimo
- **Mailchimp Developer Docs:** https://mailchimp.com/developer/

