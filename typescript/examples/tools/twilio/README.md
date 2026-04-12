# Twilio Tools Examples

Example directory contains **3 example patterns** showing different ways to use Matimo's Twilio tools:

1. **Factory Pattern** - Direct SDK execution (simplest)
2. **Decorator Pattern** - Class-based with `@tool` decorators
3. **LangChain Pattern** - AI-driven with OpenAI agent

All examples demonstrate real Twilio Messaging API operations (send SMS, send MMS, retrieve messages, list history).

---

## 🚀 Quick Start

### 1. Create a Twilio Account

1. Go to [twilio.com/try-twilio](https://www.twilio.com/try-twilio) and sign up for a free account
2. After verifying your email and phone number, you'll land on the **Twilio Console** dashboard

### 2. Find Your Account SID and Auth Token

On the [Twilio Console dashboard](https://console.twilio.com), look for the **Account Info** section:

- **Account SID** — a 34-character identifier starting with `AC`. Acts as your username for every API call.
- **Auth Token** — a 32-character secret key. Click the **eye (👁) icon** to reveal it.

> ⚠️ **Keep both values secret.** Do not commit them to version control.

### 3. Get a Phone Number

1. In the Console sidebar, go to **Phone Numbers → Manage → Buy a Number**
2. Choose a number with SMS capability
3. Click **Buy** (free trial credit covers this)
4. This will be your `TWILIO_FROM_NUMBER`

> **Trial accounts**: You can also use the number auto-assigned to your trial account, shown on the Console dashboard.

### 4. Verify Your "To" Number (Trial Accounts Only)

Free trial accounts can only send messages to **Verified Caller IDs**:

1. Go to **Phone Numbers → Manage → Verified Caller IDs**
2. Click **Add a new Caller ID**
3. Enter the phone number you want to send messages to
4. Complete the verification call or SMS

### 5. Set Up Environment Variables

Create or update `.env` in `examples/tools/`:

```env
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_FROM_NUMBER=+15557122661
TWILIO_TO_NUMBER=+15558675310
OPENAI_API_KEY=sk-your-openai-key-here   # Required for LangChain example only
```

> **Note:** All phone numbers must be in **E.164 format** (e.g. `+15551234567`).  
> Matimo automatically handles Basic Auth encoding — no manual base64 encoding required.

### 6. Run Examples

```bash
# From examples/tools/ directory

# Factory Pattern (simplest, direct API calls)
pnpm twilio:factory

# Decorator Pattern (class-based OOP approach)
pnpm twilio:decorator

# LangChain Pattern (AI-driven agent with OpenAI)
pnpm twilio:langchain
```

---

## 📚 Examples Overview

### 1. Factory Pattern (`twilio-factory.ts`)

**Best for:** Scripts, quick tests, CLI tools

**What it does:**
- ✅ Direct tool execution with `matimo.execute()`
- ✅ Validates environment variables before running
- ✅ Sends an SMS via `twilio-send-sms`
- ✅ Retrieves the sent message via `twilio-get-message`
- ✅ Lists recent messages via `twilio-list-messages`
- ✅ Simplest implementation

**Run it:**
```bash
pnpm twilio:factory
```

**Key Code:**
```typescript
const matimo = await MatimoInstance.init('./tools');

// Send SMS
await matimo.execute('twilio-send-sms', {
  account_sid: process.env.TWILIO_ACCOUNT_SID,
  to: '+15558675310',
  from: '+15557122661',
  body: 'Hello from Matimo!'
});

// List recent messages
await matimo.execute('twilio-list-messages', {
  account_sid: process.env.TWILIO_ACCOUNT_SID,
  page_size: 5
});
```

**File:** [twilio-factory.ts](twilio-factory.ts)

---

### 2. Decorator Pattern (`twilio-decorator.ts`)

**Best for:** Object-oriented design, class-based applications, service wrappers

**What it does:**
- ✅ Class methods decorated with `@tool`
- ✅ Automatic tool execution via decorators
- ✅ Account SID bound at construction time and reused
- ✅ Sends SMS, retrieves messages, lists history
- ✅ OOP-friendly approach

**Run it:**
```bash
pnpm twilio:decorator
```

**Key Code:**
```typescript
class TwilioDecoratorAgent {
  constructor(private readonly accountSid: string) {}

  @tool('twilio-send-sms')
  async sendSms(account_sid: string, to: string, from: string, body: string) {
    // @tool decorator auto-executes via matimo.execute()
    return undefined;
  }

  @tool('twilio-list-messages')
  async listMessages(account_sid: string, page_size?: number) {
    return undefined;
  }
}

const agent = new TwilioDecoratorAgent(process.env.TWILIO_ACCOUNT_SID!);
await agent.sendSms(accountSid, '+15558675310', '+15557122661', 'Hello!');
```

**File:** [twilio-decorator.ts](twilio-decorator.ts)

---

### 3. LangChain AI Agent (`twilio-langchain.ts`)

**Best for:** True autonomous agents with AI reasoning

**What it does:**
- ✅ AI agent (OpenAI GPT-4o-mini) decides which Twilio tools to use
- ✅ Takes natural language instructions
- ✅ Autonomously executes Twilio operations
- ✅ Processes results and responds naturally
- ✅ Multi-step reasoning (e.g. send then verify delivery status)

**Run it:**
```bash
pnpm twilio:langchain
```

**Example Conversation:**
```
User: "Send a test SMS to my verified number and check its delivery status"
AI Agent: I'll send the SMS first using twilio-send-sms...
[AI calls twilio-send-sms tool]
AI Agent: Message sent with SID SM1234... Now checking delivery status...
[AI calls twilio-get-message tool]
AI Agent: The message was delivered successfully. Status: delivered.
```

**Key Code:**
```typescript
const agent = await createAgent({
  model: new ChatOpenAI({ modelName: 'gpt-4o-mini' }),
  tools: langchainTools  // AI picks which Twilio tools to use
});

const response = await agent.invoke({
  messages: [{ role: 'user', content: 'Send a test SMS to my number' }]
});
```

**File:** [twilio-langchain.ts](twilio-langchain.ts)

---

## 🛠️ Available Twilio Tools (4 Total)

All patterns have access to these 4 Twilio tools:

| Tool | Method | Description |
|------|--------|-------------|
| `twilio-send-sms` | POST | Send an SMS message |
| `twilio-send-mms` | POST | Send an MMS message with media |
| `twilio-get-message` | GET | Retrieve a message by SID |
| `twilio-list-messages` | GET | List messages with optional filters |

### Tool Parameters

#### `twilio-send-sms`
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `account_sid` | string | ✅ | Your Twilio Account SID (`AC...`) |
| `to` | string | ✅ | Recipient phone number (E.164) |
| `from` | string | ✅ | Twilio phone number (E.164) |
| `body` | string | ✅ | SMS message text |
| `status_callback` | string | ❌ | URL for delivery status webhooks |

#### `twilio-send-mms`
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `account_sid` | string | ✅ | Your Twilio Account SID (`AC...`) |
| `to` | string | ✅ | Recipient phone number (E.164) |
| `from` | string | ✅ | Twilio phone number (E.164) |
| `media_url` | string | ✅ | Publicly accessible URL of the media file |
| `body` | string | ❌ | Optional text caption |
| `status_callback` | string | ❌ | URL for delivery status webhooks |

#### `twilio-get-message`
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `account_sid` | string | ✅ | Your Twilio Account SID (`AC...`) |
| `message_sid` | string | ✅ | Message SID (`SM...`) to retrieve |

#### `twilio-list-messages`
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `account_sid` | string | ✅ | Your Twilio Account SID (`AC...`) |
| `to` | string | ❌ | Filter by recipient number |
| `from` | string | ❌ | Filter by sender number |
| `date_sent` | string | ❌ | Filter by date (YYYY-MM-DD) |
| `page_size` | number | ❌ | Results per page (default 50, max 1000) |

---

## 🧪 Trial Account Limitations

| Limitation | Details |
|-----------|---------|
| **Daily message limit** | 50 messages/day |
| **Recipients** | Must be Verified Caller IDs only |
| **Trial prefix** | All outgoing messages include `"Sent from your Twilio trial account -"` |
| **Geographic reach** | Sending to some international numbers may be restricted |
| **Phone numbers** | 1 trial number provided free |
| **WhatsApp** | Not available on trial |

To remove these limitations, [upgrade to a paid account](https://console.twilio.com/us1/billing/upgrade).

---

## 🔧 Troubleshooting

### `❌ Error 21659: From number is not a valid, SMS-capable Twilio number`
Your `TWILIO_FROM_NUMBER` is not a Twilio number on your account, or it doesn't have SMS capability.  
**Fix:** Go to [Phone Numbers → Manage → Active Numbers](https://console.twilio.com/us1/develop/phone-numbers/manage/active) and confirm the number is SMS-capable.

### `❌ Error 21211: Invalid To phone number`
The `to` number is not in E.164 format or is not a valid phone number.  
**Fix:** Use format `+15551234567` (country code + number, no dashes or spaces).

### `❌ Error 21408: Permission to send to this region is not enabled`
Your account doesn't have permission to send to that country.  
**Fix:** Go to [Messaging → Settings → Geo Permissions](https://console.twilio.com/us1/develop/sms/settings/geo-permissions) and enable the target region.

### `❌ Error 21266: Unverified phone number in To field during trial`
You're on a trial account and the recipient number is not a Verified Caller ID.  
**Fix:** Add the number at [Phone Numbers → Manage → Verified Caller IDs](https://console.twilio.com/us1/develop/phone-numbers/manage/verified).

### `❌ 401 Unauthorized / Error 20003: Authentication Failed`
Your `TWILIO_ACCOUNT_SID` or `TWILIO_AUTH_TOKEN` is incorrect.  
**Fix:** Copy both values directly from the [Console dashboard](https://console.twilio.com). Matimo handles Basic Auth encoding automatically.

### `TWILIO_ACCOUNT_SID not set in .env`
The `account_sid` parameter is required for all Twilio tools.  
**Fix:** Add `TWILIO_ACCOUNT_SID=ACxxxxxxxx` to `examples/tools/.env`.

### Messages have an unexpected prefix
Trial accounts automatically prepend `"Sent from your Twilio trial account - "` to all messages. This is removed when you upgrade to a paid account.

### `OPENAI_API_KEY not set` (LangChain example only)
The LangChain agent requires an OpenAI API key.  
**Fix:** Get one at [platform.openai.com/api-keys](https://platform.openai.com/api-keys) and add `OPENAI_API_KEY=sk-...` to your `.env`.

---

## 🔗 Related Documentation

- [Matimo Twilio Package](../../../packages/twilio/README.md)
- [Twilio Messages API Reference](https://www.twilio.com/docs/messaging/api/message-resource)
- [Twilio Console](https://console.twilio.com)
- [Twilio Free Trial Guide](https://www.twilio.com/docs/messaging/guides/how-to-use-your-free-trial-account)
- [Matimo SDK Docs](../../../packages/core/README.md)
