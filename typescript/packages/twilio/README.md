# @matimo/twilio — Twilio Messaging Tools for Matimo

Twilio Programmable Messaging integration tools for Matimo's universal AI tools ecosystem. Send SMS and MMS messages, and manage message resources through YAML-defined tools that work with any AI framework.

## 📦 Installation

```bash
npm install @matimo/twilio
# or
pnpm add @matimo/twilio
```

## 🛠️ Available Tools (4 Total)

| Category | Tool | Method | Description |
|----------|------|--------|-------------|
| **Messaging** | `twilio-send-sms` | POST | Send an outbound SMS message |
| **Messaging** | `twilio-send-mms` | POST | Send an outbound MMS message with media |
| **Messages** | `twilio-get-message` | GET | Fetch a single message by SID |
| **Messages** | `twilio-list-messages` | GET | List messages with optional filters |

## 🚀 Quick Start

```typescript
import { MatimoInstance } from 'matimo';

const matimo = await MatimoInstance.init({ autoDiscover: true });

// Send an SMS
const result = await matimo.execute('twilio-send-sms', {
  account_sid: process.env.TWILIO_ACCOUNT_SID,
  to: '+15558675310',
  from: '+15557122661',
  body: 'Hello from Matimo!',
});

// List recent messages
const messages = await matimo.execute('twilio-list-messages', {
  account_sid: process.env.TWILIO_ACCOUNT_SID,
  page_size: 10,
});
```

## 🔐 Account Setup & Authentication

Twilio uses **HTTP Basic authentication** (`Account SID` as the username and `Auth Token` as the password). Matimo handles the encoding automatically — you only need to set two environment variables.

### Step 1: Create a Twilio Account

If you don't have one yet, sign up at [https://www.twilio.com/try-twilio](https://www.twilio.com/try-twilio). No credit card is required for a free trial account.

During sign-up you will:
1. Verify your **email address**
2. Verify your **personal phone number** (this becomes a Verified Caller ID automatically)
3. Customize your account by providing information about your project

After signing up you land in the [Twilio Console](https://console.twilio.com) where you can manage credentials, phone numbers, and usage.

---

### Step 2: Find Your Account SID and Auth Token

Your **Account SID** and **Auth Token** are displayed on your [Twilio Console dashboard](https://console.twilio.com) under **Account Info**.

- **Account SID** — a 34-character identifier that starts with `AC` (e.g. `ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`). Acts as your username for every API call.
- **Auth Token** — a 32-character secret key. Acts as your password. Click the **eye (👁) icon** to reveal it.

> ⚠️ **Security Note**: Keep both values secret. Do not commit them to version control. Anyone with your Account SID and Auth Token has full access to your Twilio project. Source: [Twilio Help — What is a Twilio Account SID?](https://help.twilio.com/articles/14726256820123-What-is-a-Twilio-Account-SID)

You can also find your Account SID in:
- The [API Keys & Tokens](https://console.twilio.com/us1/account/keys-credentials/api-keys) page
- Twilio communications emails sent to your registered address
- Your Twilio invoices

---

### Step 3: Get a Twilio Phone Number

You need a **Twilio phone number** to use as the sender (`from` parameter). Trial accounts include one free phone number.

**To get your first number:**
1. Open the [Twilio Console](https://console.twilio.com) and click **Get phone number** on the home page, or go to [Buy a Number](https://console.twilio.com/us1/develop/phone-numbers/manage/search)
2. Set the search filters — **Country**, **Capabilities** (SMS / MMS / Voice), and **Number Type** (local, mobile, or toll-free)
3. Click **Buy** to provision the number to your account

> **Trial accounts**: You can have only **one Twilio phone number** at a time on a trial account, with a maximum of 3 unique numbers over the lifetime of the trial. [Upgrade your account](https://help.twilio.com/articles/223183208-Upgrading-to-a-paid-Twilio-Account) to provision additional numbers.

---

### Step 4: Set Environment Variables

```bash
# .env — only two Twilio credentials needed
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_32_char_auth_token_here
```

> **Zero extra steps!** Matimo natively handles HTTP Basic Auth — it reads `TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN`, encodes them as `base64(AccountSid:AuthToken)`, and injects `Authorization: Basic ...` automatically on every request. No manual encoding required.

---

### Step 5: Required `account_sid` Parameter

Every Twilio tool requires your **Account SID** as the `account_sid` parameter. Twilio uses it in the API URL path (`/2010-04-01/Accounts/{AccountSid}/Messages.json`):

```typescript
await matimo.execute('twilio-send-sms', {
  account_sid: process.env.TWILIO_ACCOUNT_SID, // ← required for URL path on every call
  to: '+15558675310',
  from: '+15557122661',
  body: 'Hello!',
});
```

---

## 📞 Phone Number Format (E.164)

All phone numbers must be in **E.164 format**: the `+` sign followed by the country code and number, with no spaces, dashes, or parentheses.

| Country | Local Format | E.164 Format |
|---------|-------------|--------------|
| United States | (555) 867-5309 | `+15558675309` |
| United Kingdom | 07700 900123 | `+447700900123` |
| India | 98765 43210 | `+919876543210` |
| Germany | 030 12345678 | `+493012345678` |

Reference: [What is E.164?](https://www.twilio.com/docs/glossary/what-e164)

---

## 🧪 Trial Account Limitations

Twilio trial accounts include a small pre-loaded balance and some important restrictions. Source: [Twilio Free Trial Limitations](https://help.twilio.com/articles/360036052753-Twilio-Free-Trial-Limitations)

| Limitation | Details |
|-----------|---------|
| **Recipient verification** | You can only send messages to [Verified Caller IDs](https://console.twilio.com/us1/develop/phone-numbers/manage/verified). Sending to an unverified number returns error `21659`. |
| **Trial message prefix** | All outbound messages begin with _"Sent from a Twilio trial account"_. This is removed once you upgrade. |
| **Daily message limit** | Maximum **50 messages per day**. Exceeding this returns error `63038`. |
| **One phone number** | Only one Twilio phone number per trial account (up to 3 total over the account lifetime). |
| **No alphanumeric sender IDs** | Alphanumeric Sender IDs are not supported on trial accounts. |
| **No short codes** | Short codes are not available on trial accounts. |
| **US Twilio Region only** | Trial accounts are restricted to the US1 Twilio region. |
| **No WhatsApp** | WhatsApp Business API onboarding requires a paid account. |
| **International messaging** | Verify the recipient number AND enable the target country in [Messaging Geographic Permissions](https://console.twilio.com/us1/develop/sms/settings/geo-permissions). |

> To remove all trial restrictions, [upgrade to a paid Twilio account](https://help.twilio.com/articles/223183208-Upgrading-to-a-paid-Twilio-Account).

### How to Verify a Recipient Phone Number (Trial Accounts Only)

During trial, you can only send to numbers you have explicitly verified. To add a Verified Caller ID:

1. Go to [Verified Caller IDs](https://console.twilio.com/us1/develop/phone-numbers/manage/verified) in the Console
2. Click **Add a new Caller ID**
3. Enter the phone number in E.164 format (e.g. `+15558675310`)
4. Select **SMS** as the verification method — trial accounts **cannot** verify numbers by voice call
5. Enter the verification code sent to that number

The phone number you verified during sign-up is automatically included.

## 📚 Integration Examples

### Factory Pattern

```typescript
import 'dotenv/config';
import { MatimoInstance } from 'matimo';

const matimo = await MatimoInstance.init({ autoDiscover: true });
const accountSid = process.env.TWILIO_ACCOUNT_SID;

// Send SMS
const smsResult = await matimo.execute('twilio-send-sms', {
  account_sid: accountSid,
  to: '+15558675310',
  from: '+15557122661',
  body: 'Hello from Matimo!',
});

const message = (smsResult as any).data;
console.info(`✅ SMS sent: ${message.sid} — Status: ${message.status}`);
```

### Decorator Pattern

```typescript
import 'dotenv/config';
import { MatimoInstance, tool, setGlobalMatimoInstance } from 'matimo';

class TwilioAgent {
  constructor(private readonly accountSid: string) {}

  @tool('twilio-send-sms')
  async sendSms(
    account_sid: string,
    to: string,
    from: string,
    body: string
  ): Promise<unknown> {
    return undefined; // Decorator auto-executes via matimo
  }

  @tool('twilio-list-messages')
  async listMessages(
    account_sid: string,
    page_size?: number
  ): Promise<unknown> {
    return undefined; // Decorator auto-executes via matimo
  }

  async sendMessage(to: string, from: string, body: string) {
    return this.sendSms(this.accountSid, to, from, body);
  }

  async getRecentMessages(count = 20) {
    return this.listMessages(this.accountSid, count);
  }
}

const matimo = await MatimoInstance.init({ autoDiscover: true });
setGlobalMatimoInstance(matimo);

const agent = new TwilioAgent(process.env.TWILIO_ACCOUNT_SID!);
const result = await agent.sendMessage('+15558675310', '+15557122661', 'Hello!');
```

### LangChain Integration

```typescript
import 'dotenv/config';
import { MatimoInstance, convertToolsToLangChain, ToolDefinition } from 'matimo';
import { ChatOpenAI } from '@langchain/openai';
import { createAgent } from 'langchain';

const matimo = await MatimoInstance.init({ autoDiscover: true });
const twilioTools = matimo.listTools().filter(t => t.name.startsWith('twilio-'));

// No extra credential injection needed — Matimo handles Basic Auth automatically
const langchainTools = await convertToolsToLangChain(
  twilioTools as ToolDefinition[],
  matimo
);

const model = new ChatOpenAI({ modelName: 'gpt-4o-mini', temperature: 0.7 });
const agent = await createAgent({ model, tools: langchainTools as any[] });
```

## 📖 API Reference

### `twilio-send-sms`

Send an outbound SMS message. Source: [Twilio Messages API — Create a Message](https://www.twilio.com/docs/messaging/api/message-resource#create-a-message-resource)

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `account_sid` | string | ✅ | Your Twilio Account SID (starts with `AC`) |
| `to` | string | ✅ | Recipient phone number in E.164 format (e.g. `+15558675310`) |
| `from` | string | ✅ | Sender Twilio phone number in E.164 format (e.g. `+15557122661`) |
| `body` | string | ✅ | Text content of the SMS (up to 1,600 characters; messages over 160 GSM-7 chars are segmented and billed per segment) |
| `status_callback` | string | ❌ | Webhook URL for delivery status updates |

### `twilio-send-mms`

Send an outbound MMS message with media.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `account_sid` | string | ✅ | Your Twilio Account SID (starts with `AC`) |
| `to` | string | ✅ | Recipient phone number in E.164 format |
| `from` | string | ✅ | Sender Twilio MMS-capable phone number in E.164 format |
| `media_url` | string | ✅ | Publicly accessible URL of the media file to attach |
| `body` | string | ❌ | Optional text content to accompany the media |
| `status_callback` | string | ❌ | Webhook URL for delivery status updates |

**Supported media types**: jpeg, jpg, gif, png (up to 5 MB); other types up to 500 KB. Up to 10 `media_url` values per message.

### `twilio-get-message`

Fetch a single Message resource by SID. Source: [Twilio — Fetch a Message resource](https://www.twilio.com/docs/messaging/api/message-resource#fetch-a-message-resource)

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `account_sid` | string | ✅ | Your Twilio Account SID |
| `message_sid` | string | ✅ | The Message SID to fetch (`SM...` for SMS, `MM...` for MMS) |

### `twilio-list-messages`

List Message resources with optional filters. Results are sorted by `DateSent`, most recent first. Source: [Twilio — Read multiple Message resources](https://www.twilio.com/docs/messaging/api/message-resource#read-multiple-message-resources)

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `account_sid` | string | ✅ | Your Twilio Account SID |
| `to` | string | ❌ | Filter by recipient phone number (E.164 format) |
| `from` | string | ❌ | Filter by sender phone number (E.164 format) |
| `date_sent` | string | ❌ | Filter by sent date: `YYYY-MM-DD`, `<=YYYY-MM-DD`, or `>=YYYY-MM-DD` |
| `page_size` | number | ❌ | Results per page (default: `50`, max: `1000`) |

---

## 📊 Message Status Values

Source: [Twilio Message Status Values](https://www.twilio.com/docs/messaging/api/message-resource#message-status-values)

| Status | Applies To | Description |
|--------|-----------|-------------|
| `queued` | Outbound | API request accepted; message is queued for a specific sender |
| `sending` | Outbound | Dispatching to the nearest upstream carrier |
| `sent` | Outbound | Accepted by the upstream carrier |
| `delivered` | Outbound | Confirmed delivery to the destination handset |
| `undelivered` | Outbound | Carrier delivery receipt indicates non-delivery (e.g. carrier filtering, handset unavailable) |
| `failed` | Outbound | Failed to send (e.g. queue overflow, account suspension, media error) |
| `receiving` | Inbound | Message received by Twilio; processing in progress |
| `received` | Inbound | Inbound message received and processing complete |
| `accepted` | Outbound (Messaging Service) | Sender is being dynamically selected from a Messaging Service Sender Pool |
| `scheduled` | Outbound (Messaging Service) | Message is scheduled for future delivery |
| `canceled` | Outbound (Messaging Service) | Scheduled message was canceled |

---

## ⚠️ Rate Limits

Twilio queues messages up to your prescribed rate limits. Requests that exceed the rate are queued and executed as capacity allows.

| Number Type | Throughput |
|-------------|-----------|
| Short codes (US) | Up to 100 messages/second |
| Long codes / 10DLC (US) | Typically 1 message/second per number |
| Toll-free numbers (US) | Varies; depends on verification tier |
| International long codes | Country-dependent; see [carrier limits](https://help.twilio.com/articles/223183648) |

For high-volume messaging, use [Twilio Messaging Services](https://www.twilio.com/docs/messaging/services) to pool multiple senders and increase throughput.

---

## 🔧 Troubleshooting

### `HTTP 401 — Authentication Failed (Error 20003)`

Your `TWILIO_AUTH_TOKEN` is incorrect or does not match the `TWILIO_ACCOUNT_SID`. Both values must come from the same Twilio account.

1. Go to your [Twilio Console dashboard](https://console.twilio.com)
2. Under **Account Info**, copy the **Account SID** (starts with `AC`)
3. Click the **eye icon** next to **Auth Token** to reveal it, then copy the exact value
4. Update your environment variables — Matimo encodes them automatically, no base64 step needed

```bash
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_32_char_auth_token_here
```

---

### `Error 21659 — Unverified "To" Phone Number (Trial Accounts)`

Your account is in trial mode and you are trying to send to a number that has not been verified as a Caller ID.

**Fix — verify the recipient number:**
1. Go to [Verified Caller IDs](https://console.twilio.com/us1/develop/phone-numbers/manage/verified) in the Console
2. Click **Add a new Caller ID** and enter the recipient number in E.164 format
3. Select **SMS** as the verification method (trial accounts cannot use voice verification)
4. Enter the code sent to that number to complete verification

Alternatively, [upgrade your Twilio account](https://help.twilio.com/articles/223183208-Upgrading-to-a-paid-Twilio-Account) to remove this restriction and send to any number.

---

### `Error 21266 — Cannot Use Same "To" and "From" Number`

The `to` and `from` phone numbers are identical. Twilio does not allow a number to message itself. Use a different verified recipient number.

---

### `Error 21211 — Invalid "To" Phone Number`

The `to` value is not a valid dialable phone number. Ensure it is in **E.164 format** — a `+` sign followed by the country code and number, with no spaces or dashes (e.g. `+15558675310`).

---

### `Error 21212 — Invalid "From" Phone Number`

The `from` number is not a Twilio number in your account, or it is not SMS-capable.

1. Check your provisioned numbers at [Active Numbers](https://console.twilio.com/us1/develop/phone-numbers/manage/incoming)
2. Confirm the number has **SMS capability** enabled
3. Ensure the number is in E.164 format

---

### `Error 21408 — Permission to Send an SMS Has Not Been Enabled`

Sending to the target country requires geographic permission approval.

1. Go to [Messaging Geographic Permissions](https://console.twilio.com/us1/develop/sms/settings/geo-permissions) in the Console
2. Enable the target country
3. If on a trial account, also confirm the recipient is a [Verified Caller ID](https://console.twilio.com/us1/develop/phone-numbers/manage/verified)

---

### `Error 63038 — Daily Message Limit Exceeded (Trial Only)`

Trial accounts are limited to **50 messages per day**. You have reached that limit.

- Wait until the next calendar day (UTC) for the limit to reset
- Or [upgrade your Twilio account](https://help.twilio.com/articles/223183208-Upgrading-to-a-paid-Twilio-Account) to remove this restriction

---

### `Error 30007 — Carrier Violation`

The carrier blocked the message. Common causes:
- Content flagged as spam or containing prohibited URL shorteners
- Unregistered US toll-free numbers sending application-to-person (A2P) traffic
- Unregistered 10DLC long codes sending to US recipients

**Fixes:**
- Complete [Toll-Free Verification](https://www.twilio.com/docs/messaging/compliance/toll-free/console-onboarding) if using a US toll-free number (requires paid account)
- Register for [A2P 10DLC](https://help.twilio.com/articles/1260801864489) if using a US 10-digit long code number (requires paid account)
- Review your message content for spam-like patterns

---

### Messages Arrive with "Sent from a Twilio trial account" Prefix

This prefix is automatically prepended by Twilio on all outbound messages from trial accounts. It is **not a Matimo behaviour** — it is a Twilio trial restriction. Upgrading your account removes this prefix immediately.

---

### `account_sid` Is Required on Every Tool Call

Every tool requires `account_sid` because Twilio uses it in the API URL path (`/2010-04-01/Accounts/{AccountSid}/Messages.json`). Always pass your Account SID:

```typescript
await matimo.execute('twilio-send-sms', {
  account_sid: process.env.TWILIO_ACCOUNT_SID, // required on every call
  to: '+15558675310',
  from: '+15557122661',
  body: 'Hello!',
});
```

---

## 🤝 Contributing

See the [Contributing Guide](../../CONTRIBUTING.md) for details on how to add new tools, report bugs, or improve documentation.

---

*Part of the [Matimo](https://github.com/tallclub/matimo) ecosystem — universal AI tools SDK.*

