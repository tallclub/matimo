# matimo-twilio

> Twilio tools for the [Matimo](https://matimo.dev) AI tools SDK — send SMS, send MMS, and retrieve message history.

[![PyPI](https://img.shields.io/pypi/v/matimo-twilio)](https://pypi.org/project/matimo-twilio/)
[![Docs](https://img.shields.io/badge/docs-matimo.dev-blue)](https://matimo.dev/docs)

---

## Installation

```bash
pip install matimo matimo-twilio
```

---

## Available Tools (4 Total)

| Tool | Description |
|------|-------------|
| `twilio-send-sms` | Send an SMS message to a phone number |
| `twilio-send-mms` | Send an MMS message with media |
| `twilio-list-messages` | List sent/received messages with filters |
| `twilio-get-message` | Get details of a specific message by SID |

---

## Quick Start

```python
import asyncio
import os
from matimo import Matimo
from matimo_twilio import get_tools_path

async def main():
    matimo = await Matimo.init(get_tools_path())

    # Send an SMS
    await matimo.execute('twilio-send-sms', {
        'to': '+15551234567',
        'from': '+15559876543',
        'body': 'Hello from Matimo!',
    })

    # List recent messages
    result = await matimo.execute('twilio-list-messages', {
        'limit': 10,
    })
    print(result)

asyncio.run(main())
```

---

## Authentication

```bash
export TWILIO_ACCOUNT_SID="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
export TWILIO_AUTH_TOKEN="your-auth-token"
```

Find these in your [Twilio Console](https://console.twilio.com/).

---

## Documentation

- [Twilio Messaging API](https://www.twilio.com/docs/messaging)
- [Python Examples](https://github.com/tallclub/matimo/tree/main/python/examples/native/twilio)

---

## Links

- **PyPI:** https://pypi.org/project/matimo-twilio/
- **GitHub:** https://github.com/tallclub/matimo
- **Twilio Docs:** https://www.twilio.com/docs

