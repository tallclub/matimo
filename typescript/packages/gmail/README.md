# @matimo/gmail - Gmail Tools for Matimo

Gmail integration tools for Matimo's universal AI tools ecosystem. Send emails, manage drafts, and read messages through YAML-defined tools that work with any AI framework.

## 📦 Installation

```bash
npm install @matimo/gmail
# or
pnpm add @matimo/gmail
```

## 🛠️ Available Tools

| Tool | Description | API Method |
|------|-------------|------------|
| `gmail-send-email` | Send email to recipients | Gmail API send |
| `gmail-create-draft` | Create email draft | Gmail API drafts.create |
| `gmail-list-messages` | List recent messages | Gmail API messages.list |

## 🚀 Quick Start

```typescript
import { MatimoInstance } from 'matimo';

const matimo = await MatimoInstance.init({ autoDiscover: true });

// Send an email
await matimo.execute('gmail-send-email', {
  to: 'recipient@example.com',
  subject: 'Hello from Matimo',
  body: 'This email was sent by AI!'
});

// List recent messages
const messages = await matimo.execute('gmail-list-messages', {
  maxResults: 10
});
```

## 🔐 Authentication

Set your Gmail OAuth2 access token:

```bash
export GMAIL_ACCESS_TOKEN="ya29.a0AfH6SMBx..."
```

Or use environment variables in your application.

## 📚 Integration Examples

### With LangChain

```typescript
import { MatimoInstance } from 'matimo';
import { ChatOpenAI } from '@langchain/openai';

const matimo = await MatimoInstance.init({ autoDiscover: true });
const tools = matimo.listTools().filter(t => t.name.startsWith('gmail'));

// Use with LangChain agent
```

### With Custom Code

```typescript
import { MatimoInstance } from 'matimo';

class GmailAgent {
  private matimo: MatimoInstance;

  constructor() {
    this.matimo = await MatimoInstance.init({ autoDiscover: true });
  }

  async sendEmail(to: string, subject: string, body: string) {
    return await this.matimo.execute('gmail-send-email', { to, subject, body });
  }
}
```

## 🔗 API Reference

All tools are based on the official Gmail REST API. See [Gmail API Documentation](https://developers.google.com/gmail/api).

| Tool | Gmail API Method | OAuth Scopes |
|------|------------------|--------------|
| gmail-send-email | gmail.send | https://www.googleapis.com/auth/gmail.send |
| gmail-create-draft | drafts.create | https://www.googleapis.com/auth/gmail.compose |
| gmail-list-messages | messages.list | https://www.googleapis.com/auth/gmail.readonly |

## 📋 Tool Specifications

Each tool is defined in YAML with complete parameter validation and error handling. Tools include:

- **Parameter validation** with Zod schemas
- **OAuth2 authentication** with automatic token injection
- **Error handling** with structured error codes
- **Output validation** against defined schemas

## 🤝 Contributing

Found a bug or want to add a Gmail tool? See [Contributing Guide](../../CONTRIBUTING.md) and [Adding Tools Guide](../tool-development/ADDING_TOOLS.md).

---

**Part of the Matimo ecosystem** - Define tools once, use them everywhere! 🎯

YAML keeps tool definitions **maintainable, readable, and contributor-friendly**:

```yaml
# Human-readable
name: send-email
description: Send an email via Gmail

# Parameters clearly defined
parameters:
  to:
    type: string
    description: Recipient email address
    required: true
  subject:
    type: string
    required: true
  body:
    type: string
    required: true

# Auth declared once (used everywhere)
authentication:
  type: oauth2
  provider: google

# Execution details (HTTP call)
execution:
  type: http
  method: POST
  url: https://www.googleapis.com/gmail/v1/users/me/messages/send
  headers:
    Authorization: 'Bearer {GMAIL_ACCESS_TOKEN}'

# Output schema for validation
output_schema:
  type: object
  properties:
    id:
      type: string
      description: Message ID
```

### How Matimo Uses YAML

1. **Load & Parse** - YAML → Tool object
2. **Validate** - Check parameters against schema
3. **Execute** - Run HTTP request with auth
4. **Transform** - Apply parameter encodings (MIME, base64, etc.)
5. **Return** - Validate output against schema

This is what makes Matimo **framework-agnostic** and **scalable**.

## YAML-Based Tool Architecture

### File Structure

```
tools/gmail/
├── README.md                          # This file
├── send-email/
│   ├── definition.yaml                # Tool definition
├── list-messages/
│   ├── definition.yaml
├── create-draft/
│   ├── definition.yaml
├── get-message/
│   ├── definition.yaml
└── delete-message/
    ├── definition.yaml
```

### Anatomy of a Tool Definition (YAML)

Every tool has these sections:

#### 1. **Metadata**

```yaml
name: send-email
version: '1.0.0'
description: Send an email via Gmail
tags: [email, gmail, messaging]
```

#### 2. **Parameters** (Input Schema)

```yaml
parameters:
  to:
    type: string
    description: Recipient email address
    required: true
    example: 'user@example.com'

  subject:
    type: string
    required: true
    example: 'Hello World'

  body:
    type: string
    required: true
    example: 'This is the email body'

  cc:
    type: string
    required: false # Optional
    example: 'cc@example.com'

  isHtml:
    type: boolean
    required: false
    default: false
```

#### 3. **Authentication** (Credentials)

```yaml
authentication:
  type: oauth2 # How to authenticate
  provider: google # Which service
  scopes: # Permissions needed
    - gmail.readonly # Read emails
    - gmail.send # Send emails
    - gmail.compose # Create drafts
```

Matimo auto-injects tokens from environment:

```typescript
// No explicit token passing - Matimo handles it!
await matimo.execute('gmail-send-email', {
  to: 'user@example.com',
  subject: 'Hello',
  body: 'Message',
  // GMAIL_ACCESS_TOKEN auto-added from process.env
});
```

#### 4. **Execution** (How to run the tool)

```yaml
execution:
  type: http # Command or HTTP
  method: POST # HTTP method
  url: https://www.googleapis.com/... # API endpoint

  headers:
    Authorization: 'Bearer {GMAIL_ACCESS_TOKEN}' # Auth header
    Content-Type: application/json

  body:
    # Parameter encoding: Convert params to Gmail's format
    # Gmail requires MIME message in base64url
    message:
      raw: '{raw}' # Special encoding directive
```

#### 5. **Parameter Encoding** (Transformation)

```yaml
parameter_encoding:
  - source: [to, subject, body, cc, bcc, isHtml]
    target: raw
    encoding: mime_rfc2822_base64url # Convert to MIME format
```

This is how Matimo handles complex transformations:

- 🔄 **mime_rfc2822_base64url** - Encode email as MIME message
- 🔗 **url_encoded** - URL-encode form data
- 📦 **json_compact** - Minify JSON

#### 6. **Output Schema** (Result Validation)

```yaml
output_schema:
  type: object
  properties:
    id:
      type: string
      description: 'Gmail message ID'
    threadId:
      type: string
      description: 'Thread ID for grouping conversations'
  required: [id, threadId]
```

### Why This Architecture Matters

| Aspect           | Benefit                                             |
| ---------------- | --------------------------------------------------- |
| **Declarative**  | Tool behavior defined in human-readable YAML        |
| **Validated**    | Schema validation at load time + execution time     |
| **Reusable**     | Same YAML works with any framework (SDK, MCP, REST) |
| **Maintainable** | Update tool = edit YAML, no code changes needed     |
| **Scalable**     | Add 1000s of tools without changing core code       |
| **Secure**       | Auth tokens never in source code or YAML            |
| **Transparent**  | LLMs can see tool definitions and understand them   |

## Provider YAML Architecture

### Why Provider YAML?

In addition to individual tool definitions, Matimo uses **Provider YAML** files to centralize OAuth2 configuration and shared settings across all tools for a single provider (in this case, Google).

```
tools/gmail/
├── definition.yaml                    # ← PROVIDER YAML (Google OAuth2 config)
│                                         All Gmail tools reference this
├── send-email/
│   ├── definition.yaml                # Individual tool definition
│   └── ...
├── create-draft/
│   ├── definition.yaml
│   └── ...
└── list-messages/
    ├── definition.yaml
    └── ...
```

### Provider YAML: `tools/gmail/definition.yaml`

The provider-level YAML file serves multiple purposes:

**1. Centralize OAuth2 Configuration**

```yaml
name: google-provider
type: provider

provider:
  name: google
  displayName: Google

  # OAuth2 endpoints - used by all Google-dependent tools
  endpoints:
    authorizationUrl: https://accounts.google.com/o/oauth2/v2/auth
    tokenUrl: https://oauth2.googleapis.com/token
    revokeUrl: https://oauth2.googleapis.com/revoke
```

**Benefits:**

- ✅ **Single source of truth** - All Gmail tools reference these endpoints
- ✅ **Override capability** - Users can change endpoints via environment variables
- ✅ **Extensibility** - Easy to add new Google-dependent tools
- ✅ **Maintainability** - If Google changes endpoints, update once

**2. Define Standard Scopes**

The provider file defines OAuth2 scopes required by Gmail tools:

```yaml
# From definition.yaml
scopes:
  - gmail.readonly # Read emails
  - gmail.send # Send emails
  - gmail.compose # Create drafts
  - gmail.modify # Delete/modify emails
```

Each individual tool declares which scopes it needs:

```yaml
# In send-email/definition.yaml
authentication:
  type: oauth2
  provider: google
  scopes:
    - gmail.send # This tool needs to send emails
```

**3. Configuration Override Pattern**

The provider YAML enables this priority system:

```
Priority (High → Low):
  1. Runtime configuration (programmatic)
  2. Environment variables: OAUTH_GOOGLE_AUTH_URL, etc.
  3. Provider YAML: definition.yaml
```

Example - Change endpoints for custom proxy:

```bash
# Option A: Environment variable (highest priority)
export OAUTH_GOOGLE_AUTH_URL="https://my-proxy.example.com/auth"

# Option B: Edit definition.yaml (lowest priority)
# endpoints:
#   authorizationUrl: https://my-proxy.example.com/auth
```

### How Tool Definition References Provider

Each individual tool declares its dependency on the provider:

**send-email/definition.yaml:**

```yaml
name: gmail-send-email
version: '1.0.0'

authentication:
  type: oauth2
  provider: google # ← References the provider
  scopes:
    - gmail.send # Specific scopes for this tool
    - gmail.compose

execution:
  type: http
  url: https://www.googleapis.com/gmail/v1/users/me/messages/send
  headers:
    # Uses GMAIL_ACCESS_TOKEN from provider's OAuth2 flow
    Authorization: 'Bearer {GMAIL_ACCESS_TOKEN}'
```

**Matimo's Resolution:**

1. Load tool: `gmail-send-email`
2. Read `authentication.provider: google`
3. Find provider YAML: `tools/gmail/definition.yaml`
4. Load OAuth2 endpoints and scopes from provider
5. Merge with tool-specific requirements
6. Ready to execute!

### Multi-Provider Scenario

When Matimo has tools from multiple providers, provider YAML keeps them isolated:

```
tools/
├── gmail/
│   ├── definition.yaml          # ← Provider: Google
│   ├── send-email/
│   ├── create-draft/
│   └── list-messages/
│
├── slack/
│   ├── definition.yaml          # ← Provider: Slack
│   ├── send-message/
│   ├── post-channel/
│   └── get-users/
│
└── github/
    ├── definition.yaml          # ← Provider: GitHub
    ├── create-issue/
    ├── list-repos/
    └── create-pr/
```

Each provider has:

- ✅ Its own OAuth2 endpoints
- ✅ Its own scopes/permissions
- ✅ Its own credentials (CLIENT_ID, CLIENT_SECRET)
- ✅ Its own authentication flow

Matimo loads all providers and their tools - **no code changes needed**.

### Why Not Hardcode in Code?

❌ **Bad approach:**

```typescript
// Tools/Gmail.ts - Code changes for each provider
if (provider === 'google') {
  authUrl = 'https://accounts.google.com/...';
  scopes = ['gmail.readonly', 'gmail.send'];
}
if (provider === 'slack') {
  authUrl = 'https://slack.com/oauth...';
  scopes = ['chat:write', 'users:read'];
}
```

**Problems:**

- Non-technical contributors can't add providers
- Code must be modified for each provider
- Doesn't scale to 100s of providers
- Risk of bugs during refactoring

✅ **Good approach (Matimo):**

```yaml
# tools/gmail/definition.yaml
provider: google
endpoints:
  authorizationUrl: https://accounts.google.com/...
scopes:
  - gmail.readonly
  - gmail.send
```

**Benefits:**

- Maintainers submit YAML, not code
- Matimo loads all providers dynamically
- Scales to 1000s of providers
- Single deployment handles all tools
- Contributors can add providers without code knowledge

### Real-World Example: Adding GitHub Tools

To add GitHub tools to Matimo:

**Step 1:** Create provider file:

```bash
tools/github/definition.yaml
```

**Step 2:** Define GitHub OAuth2 endpoints:

```yaml
name: github-provider
type: provider
provider:
  name: github
  endpoints:
    authorizationUrl: https://github.com/login/oauth/authorize
    tokenUrl: https://github.com/login/oauth/access_token
```

**Step 3:** Add tool definitions:

```bash
tools/github/create-issue/definition.yaml
tools/github/list-repos/definition.yaml
tools/github/create-pr/definition.yaml
```

**Step 4:** Each tool references provider:

```yaml
# In create-issue/definition.yaml
authentication:
  type: oauth2
  provider: github # ← Links to github/definition.yaml
  scopes:
    - repo
    - issues
```

**Done!** No code changes needed. Matimo automatically:

- ✅ Loads the provider
- ✅ Loads all GitHub tools
- ✅ Sets up OAuth2 with GitHub endpoints
- ✅ Makes tools available to SDK, MCP, REST API

This is the **"Define Once, Use Everywhere"** principle in action!

## Quick Start

Get started with Gmail tools in 5 minutes.

### 1️⃣ Get OAuth Token (2 minutes)

#### Easiest: Google OAuth Playground

1. **Visit** https://developers.google.com/oauthplayground
2. **Configure** (⚙️ settings, top right):
   - ☑️ Check "Use your own OAuth credentials"
   - Enter **Client ID** (from [Google Cloud Console](https://console.cloud.google.com/apis/credentials))
   - Enter **Client Secret**
3. **Select Scopes** (left panel):
   ```
   https://www.googleapis.com/auth/gmail.readonly    # Read emails
   https://www.googleapis.com/auth/gmail.send        # Send emails
   https://www.googleapis.com/auth/gmail.compose     # Create drafts
   ```
4. **Authorize & Copy Token**:
   - Click "Authorize APIs"
   - Grant permission
   - Copy the **Access Token** (starts with `ya29.a0...`)

#### Production: Set Up Your Own OAuth App

1. Go to https://console.cloud.google.com
2. Create project: "My Gmail App"
3. Enable **Gmail API**:
   - Search "Gmail API"
   - Click "Enable"
4. Create **OAuth 2.0 Credentials**:
   - Credentials → "Create Credentials" → "OAuth 2.0 Client ID"
   - App type: **Desktop app** (testing) or **Web application** (production)
   - Add redirect URIs:
     ```
     http://localhost:3000/callback
     http://localhost:3000/auth/gmail/callback
     ```
   - Download JSON credentials

### 2️⃣ Set Environment Variable (1 minute)

#### Option A: `.env` file (Recommended)

```bash
# Create .env in your project root
cat > .env << EOF
GMAIL_ACCESS_TOKEN=ya29.a0AfH6SMBx...your-token...
EOF

# Add to .gitignore
echo ".env" >> .gitignore
```

#### Option B: Export in shell

```bash
export GMAIL_ACCESS_TOKEN="ya29.a0AfH6SMBx...your-token..."
```

### 3️⃣ Test It! (2 minutes)

```bash
cd /Users/sajesh/My\ Work\ Directory/matimo/examples/tools

# Install dependencies
pnpm install

# Run factory pattern test
pnpm run gmail:factory --email:youremail@gmail.com
```

**Expected output:**

```
📬 Example 1: List Your Recent Messages
✅ Found 5 recent messages

📧 Example 2: Send Email
✅ Email sent successfully!

✏️  Example 3: Create Draft
✅ Draft created successfully!
```

## Available Tools

### Overview

| Tool                   | Purpose                | Input                                | Output                     |
| ---------------------- | ---------------------- | ------------------------------------ | -------------------------- |
| `gmail-list-messages`  | List emails from inbox | `maxResults`, `query`, `labelIds`    | `messages[]`               |
| `gmail-get-message`    | Get full email details | `messageId`, `format`               | `id`, `payload`, `headers` |
| `gmail-send-email`     | Send email             | `to`, `subject`, `body`, `cc`, `bcc` | `id`                       |
| `gmail-create-draft`   | Create draft email     | `to`, `subject`, `body`, `cc`, `bcc` | `id`                       |
| `gmail-delete-message` | Delete email           | `messageId`                         | `success`                  |

### Tool Reference

#### 1. gmail-list-messages

**Description:** List recent emails from your inbox with optional filtering.

**Parameters:**

```typescript
{
  query?: string;              // Gmail search syntax
                               // Examples:
                               //  "from:alice@example.com"
                               //  "subject:meeting"
                               //  "is:unread"
                               //  "is:starred"
  maxResults?: number;         // 1-500 (default: 10)
  pageToken?: string;          // For pagination
  labelIds?: string[];         // Filter by labels
                               // Common: ["INBOX", "SENT", "DRAFT"]
  includeSpamTrash?: boolean;  // Include spam/trash
}
```

**Returns:**

```typescript
{
  messages: Array<{
    id: string;              // Gmail message ID
    threadId: string;        // For conversation grouping
    snippet: string;         // Email preview
  }>,
  resultSizeEstimate: number;
}
```

**Example:**

```typescript
const result = await matimo.execute('gmail-list-messages', {
  maxResults: 5,
  query: 'from:alice@example.com',
});
```

---

#### 2. gmail-send-email

**Description:** Send an email via Gmail.

**Parameters:**

```typescript
{
  to: string;                  // Required: Recipient email
  subject: string;             // Required: Email subject
  body: string;                // Required: Email body
  cc?: string;                 // Optional: CC recipient(s)
  bcc?: string;                // Optional: BCC recipient(s)
  isHtml?: boolean;           // Optional: HTML body (default: false)
}
```

**Returns:**

```typescript
{
  id: string;                  // Sent message ID
  threadId: string;            // Thread ID
  labelIds: string[];          // ["SENT"]
}
```

**How It Works:**

1. Matimo converts `to`, `subject`, `body` → MIME message
2. Encodes as base64url (required by Gmail API)
3. Sends via POST to Gmail API
4. Returns message ID

**Example:**

```typescript
const result = await matimo.execute('gmail-send-email', {
  to: 'user@example.com',
  subject: 'Hello from Matimo',
  body: 'This email was sent via Gmail tools!',
  isHtml: false,
});
```

---

#### 3. gmail-create-draft

**Description:** Create a draft email (not sent).

**Parameters:**

```typescript
{
  to: string;                  // Required: Draft recipient
  subject: string;             // Required: Draft subject
  body: string;                // Required: Draft body
  cc?: string;                 // Optional: CC recipient(s)
  bcc?: string;                // Optional: BCC recipient(s)
  isHtml?: boolean;           // Optional: HTML body (default: false)
}
```

**Returns:**

```typescript
{
  id: string;                  // Draft ID
  message: {
    id: string;
    threadId: string;
    labelIds: string[];        // ["DRAFT"]
  }
}
```

**Use Case:** AI agents generating email content for review before sending.

**Example:**

```typescript
const result = await matimo.execute('gmail-create-draft', {
  to: 'user@example.com',
  subject: 'Weekly Summary',
  body: 'Generated by AI agent...',
  isHtml: true,
});
// User can manually review and send from Gmail
```

---

#### 4. gmail-get-message

**Description:** Get full details of a specific email.

**Parameters:**

```typescript
{
  messageId: string;          // Required: Email ID (from list-messages)
  format?: string;             // Optional: "minimal" | "full" | "raw"
                               // Default: "full"
}
```

**Returns:**

```typescript
{
  id: string;
  threadId: string;
  labelIds: string[];
  snippet: string;
  payload: {
    mimeType: string;
    headers: Array<{
      name: string;           // "Subject", "From", etc.
      value: string;
    }>,
    parts?: Array<...>;        // Email parts (attachments, etc.)
    body: {
      size: number;
      data?: string;          // Base64 encoded body (if format=full)
    }
  }
}
```

**Example:**

```typescript
const result = await matimo.execute('gmail-get-message', {
  messageId: '18b8f4a2a1c5e3d2',
  format: 'full',
});
```

---

#### 5. gmail-delete-message

**Description:** Delete an email (moves to trash).

**Parameters:**

```typescript
{
  messageId: string; // Required: Email ID to delete
}
```

**Returns:**

```typescript
{
  success: boolean;
  messageId: string;
}
```

**Example:**

```typescript
const result = await matimo.execute('gmail-delete-message', {
  messageId: '18b8f4a2a1c5e3d2',
});
```

## Integration Patterns

### Pattern 1: Factory Pattern (Direct SDK)

Use when you have explicit parameters:

```typescript
import { MatimoInstance } from 'matimo';
import path from 'path';

const matimo = await MatimoInstance.init(path.join(__dirname, 'tools'));

// Tool executes, token auto-injected from GMAIL_ACCESS_TOKEN env var
const result = await matimo.execute('gmail-send-email', {
  to: 'user@example.com',
  subject: 'Hello',
  body: 'Message',
});
```

**When to use:** Scripts, cron jobs, simple automation

---

### Pattern 2: Decorator Pattern (LangChain Decorators)

Use when building agent frameworks:

```typescript
import { tool } from 'langchain';

class EmailAgent {
  @tool('gmail-send-email')
  async sendEmail(to: string, subject: string, body: string) {
    return undefined; // Matimo intercepts and executes
  }
}
```

**When to use:** Framework integration, reusable agents

---

### Pattern 3: AI Agent Pattern (OpenAI + LangChain)

Use when you want LLM to decide which tool to use:

```typescript
import { createAgent } from 'langchain';
import { ChatOpenAI } from '@langchain/openai';

const agent = await createAgent({
  model: new ChatOpenAI({ modelName: 'gpt-4o-mini' }),
  tools: gmailTools,
});

// Natural language request
await agent.invoke({
  messages: [
    {
      role: 'user',
      content: 'Send me a test email',
    },
  ],
});
// Agent decides which tool to use and calls it!
```

**When to use:** Autonomous agents, natural language interfaces

---

## Advanced Usage

### Gmail Search Query Syntax

Use powerful Gmail search in `list-messages`:

```typescript
// Single condition
await matimo.execute('gmail-list-messages', {
  query: 'from:alice@example.com',
  maxResults: 10,
});

// Multiple conditions
await matimo.execute('gmail-list-messages', {
  query: 'from:alice@example.com subject:meeting is:unread',
  maxResults: 10,
});
```

**Common search operators:**

```
from:alice@example.com        # From specific sender
to:bob@example.com            # To specific recipient
subject:meeting               # Keywords in subject
body:coffee                   # Keywords in body
has:attachment                # Has attachments
is:unread                      # Unread emails
is:starred                     # Starred emails
is:important                   # Marked important
label:work                     # With specific label
before:2024/01/01             # Before date
after:2023/12/01              # After date
filename:pdf                  # Specific attachment type
```

---

### Pagination

For large email lists, use pagination:

```typescript
let pageToken: string | undefined = undefined;
let allMessages = [];

while (true) {
  const result = await matimo.execute('gmail-list-messages', {
    maxResults: 100,
    pageToken: pageToken,
  });

  allMessages = allMessages.concat(result.messages);

  if (!result.nextPageToken) break;
  pageToken = result.nextPageToken;
}

console.log(`Total messages: ${allMessages.length}`);
```

---

### HTML Emails

Send formatted HTML emails:

```typescript
await matimo.execute('gmail-send-email', {
  to: 'user@example.com',
  subject: 'HTML Email Example',
  body: `
    <h1>Hello!</h1>
    <p>This is an <strong>HTML</strong> email.</p>
    <a href="https://example.com">Click here</a>
  `,
  isHtml: true, // Enable HTML parsing
});
```

---

### Multiple Recipients

Send to CC/BCC recipients:

```typescript
await matimo.execute('gmail-send-email', {
  to: 'primary@example.com',
  cc: 'cc1@example.com,cc2@example.com', // Comma-separated
  bcc: 'bcc@example.com',
  subject: 'Team Update',
  body: 'Status update for the team',
});
```

---

### How Parameter Encoding Works

Gmail requires emails in MIME format (base64url). Matimo handles this automatically via YAML:

**Your code:**

```typescript
await matimo.execute('gmail-send-email', {
  to: 'user@example.com',
  subject: 'Hello',
  body: 'Message',
});
```

**What Matimo does:**

```
1. Read parameters: to, subject, body
2. Build MIME message:
   From: <your-account>
   To: user@example.com
   Subject: Hello

   Message

3. Encode as base64url (required by Gmail API)
4. Send as: POST /send with {message: {raw: "base64string"}}
```

**This is defined in YAML:**

```yaml
parameter_encoding:
  - source: [to, subject, body, cc, bcc, isHtml]
    target: raw
    encoding: mime_rfc2822_base64url # Handles all the above
```

---

## Security & Best Practices

### "Missing GMAIL_ACCESS_TOKEN"

**Problem:** Error when trying to use Gmail tools without token.

**Solution:**

```bash
# Check if environment variable is set
echo $GMAIL_ACCESS_TOKEN

# Set it if missing
export GMAIL_ACCESS_TOKEN=ya29.a0AfH6SMBx...
```

### "Invalid Credentials (401)"

**Problem:** Gmail API returns 401 Unauthorized.

**Possible causes:**

1. Token is expired (access tokens expire after ~1 hour)
2. Token has wrong scopes
3. Token is for wrong Google account
4. Application not authorized in Google Cloud

**Solution:**

1. Get a fresh token (especially if > 1 hour old)
2. Check scopes match your app's needs
3. Re-authenticate with the correct account
4. Verify app is authorized in Google Cloud Console

### "Permission Denied (403)"

**Problem:** Gmail API returns 403 Forbidden.

**Possible causes:**

1. Token missing required scope
2. Trying to access another user's mailbox
3. Gmail API not enabled in Cloud project
4. Rate limit exceeded

**Solution:**

1. Add required scopes when getting token
2. Ensure token is for the account you're accessing
3. Enable Gmail API in Cloud Console
4. Wait before retrying (rate limited)

### "Invalid Token Format"

**Problem:** Error when passing token parameter.

**Solution:**
Ensure token is a string and properly passed:

```typescript
// ✅ Correct
GMAIL_ACCESS_TOKEN: process.env.GMAIL_ACCESS_TOKEN;

// ❌ Wrong
GMAIL_ACCESS_TOKEN: undefined; // Missing env var
GMAIL_ACCESS_TOKEN: {
  token: 'ya29...';
} // Object instead of string
```

## Security Best Practices

### ✅ DO

- Store tokens in environment variables
- Use `.env` files locally (not in git)
- Rotate tokens regularly
- Use minimum required scopes
- Implement server-side token refresh (Phase 3)
- Log token refresh events
- Monitor token usage for suspicious activity

### ❌ DON'T

- Hardcode tokens in source files
- Commit `.env` files to git
- Share tokens between users
- Use full account access when limited scope available
- Log full tokens (log truncated: `ya29.a0...`)
- Expose tokens in error messages
- Store tokens in localStorage (browser)
- Use same token for multiple apps

## Troubleshooting

# Use in script

pnpm exec ts-node examples/gmail-oauth-usage.ts

# Or use in Node REPL

node

> process.env.GMAIL_ACCESS_TOKEN
> // Use in matimo.execute()

````

## API Reference

### send-email

Sends an email via Gmail API.

**Parameters:**
- `to` (required): Recipient email(s), comma-separated
- `subject` (required): Email subject
- `body` (required): Email body (plain text or HTML)
- `cc` (optional): CC recipients
- `bcc` (optional): BCC recipients
- `isHtml` (optional): Treat body as HTML (default: false)
- `GMAIL_ACCESS_TOKEN` (required): OAuth access token

**Response:**
```typescript
{
  id: string;                // Message ID
  threadId: string;          // Thread ID
  labelIds: string[];        // Applied labels
}
````

### list-messages

Lists emails from your mailbox.

**Parameters:**

- `query` (optional): Search query (e.g., "from:user@example.com")
- `maxResults` (optional): Max messages to return (1-500)
- `pageToken` (optional): Token for pagination
- `labelIds` (optional): Filter by label IDs
- `includeSpamTrash` (optional): Include spam/trash
- `GMAIL_ACCESS_TOKEN` (required): OAuth access token

**Response:**

```typescript
{
  messages: Array<{ id: string; threadId: string }>;
  nextPageToken?: string;    // For pagination
  resultSizeEstimate: number;
}
```

### get-message

Gets a specific message with full details.

**Parameters:**

- `messageId` (required): Message ID to retrieve
- `format` (optional): Response format ("minimal" | "full" | "raw")
- `GMAIL_ACCESS_TOKEN` (required): OAuth access token

**Response:**

```typescript
{
  id: string;
  threadId: string;
  headers: Record<string, string>;
  body: { data?: string };
  attachments?: any[];
}
```

### create-draft

Creates a draft email.

**Parameters:**

- `to` (required): Draft recipient
- `subject` (required): Draft subject
- `body` (required): Draft body
- `cc` (optional): CC recipients
- `bcc` (optional): BCC recipients
- `isHtml` (optional): Treat body as HTML
- `GMAIL_ACCESS_TOKEN` (required): OAuth access token

**Response:**

```typescript
{
  id: string; // Draft ID
}
```

### delete-message

Permanently deletes a message.

**Parameters:**

- `messageId` (required): Message ID to delete
- `GMAIL_ACCESS_TOKEN` (required): OAuth access token

**Response:**

```typescript
{
  success: boolean;
}
```

## Additional Resources

- [Gmail API Documentation](https://developers.google.com/gmail/api)
- [Gmail API Authentication Guide](https://developers.google.com/gmail/api/auth/about-auth)
- [OAuth 2.0 Playground](https://developers.google.com/oauthplayground)
- [Google Cloud Console](https://console.cloud.google.com/)
- [Matimo Documentation](../../README.md)
