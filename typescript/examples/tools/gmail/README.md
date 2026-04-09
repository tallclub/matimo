# Gmail Tools - LangChain Integration Examples

Complete guide for using Matimo Gmail tools with LangChain and OpenAI for email automation and AI-driven agent workflows.

## 📋 Overview

This directory contains three patterns for integrating Gmail tools with LangChain:

1. **Factory Pattern** (`gmail-factory.ts`) - Direct tool execution with explicit parameters
2. **Decorator Pattern** (`gmail-decorator.ts`) - TypeScript decorators with automatic auth injection
3. **AI Agent** (`gmail-langchain.ts`) - OpenAI-powered agent that decides which tools to use

All patterns use **Matimo's YAML-based tool definitions** and **automatic authentication token injection**.

## 🔐 Step 1: Get OAuth2 Access Token

### Using Google OAuth Playground (Easiest)

1. **Visit** [Google OAuth Playground](https://developers.google.com/oauthplayground)

2. **Configure OAuth Credentials** (top-right ⚙️ settings):
   - ☑️ Check "Use your own OAuth credentials"
   - Enter your OAuth **Client ID** (from [Google Cloud Console](https://console.cloud.google.com))
   - Enter your OAuth **Client Secret**

   > **Don't have credentials?** [Create them here](https://console.cloud.google.com/apis/credentials)

3. **Select Gmail API Scopes** (left panel):
   
   Select based on what you need:
   ```
   ✅ https://www.googleapis.com/auth/gmail.readonly
      (Read emails - needed for list-messages)
   
   ✅ https://www.googleapis.com/auth/gmail.send
      (Send emails - needed for send-email)
   
   ✅ https://www.googleapis.com/auth/gmail.compose
      (Create drafts - needed for create-draft)
   ```

4. **Authorize**:
   - Click "Authorize APIs"
   - Grant permission in the popup
   - Copy the generated **Access Token** (long string starting with `ya29.a0...`)

### Example Token
```
ya29.a0AfH6SMBx1234567890abcdefghijklmnopqrstuvwxyz...
```

## 🔑 Step 2: Set Environment Variables

### Option A: Using `.env` file (Recommended)

1. **Create `.env` file** in this directory:
   ```bash
   cd examples/tools/gmail
   cat > .env << EOF
   GMAIL_ACCESS_TOKEN=ya29.a0AfH6SMBx...your-token-here...
   OPENAI_API_KEY=sk-...your-openai-key...
   EOF
   ```

2. **Verify the file** exists:
   ```bash
   cat .env
   ```

### Option B: Using Environment Variables Directly

```bash
export GMAIL_ACCESS_TOKEN="ya29.a0AfH6SMBx...your-token-here..."
export OPENAI_API_KEY="sk-...your-openai-key..."
```

### Option C: Using `.env.example` Template

Copy the template and add your values:
```bash
cp .env.example .env
# Then edit .env with your actual tokens
```

## 🧪 Step 3: Test the Examples

### Prerequisites
```bash
# Install dependencies (if not already done)
cd /Users/sajesh/My\ Work\ Directory/matimo/examples/tools
pnpm install
```

### Run Factory Pattern
Tests direct tool execution with factory initialization:
```bash
pnpm run gmail:factory --email:youremail@gmail.com
```

**What it does:**
- ✅ Lists recent emails (5 most recent)
- ✅ Sends test email to your address
- ✅ Creates a draft email

**Expected Output:**
```
📬 Example 1: List Your Recent Messages
✅ Found 5 recent messages:
   1. From: Alice <alice@example.com>
   2. From: Bob <bob@example.com>
   ...

📧 Example 2: Send Email
✅ Email sent successfully!

✏️  Example 3: Create Draft
✅ Draft created successfully!
```

### Run Decorator Pattern
Tests TypeScript decorator-based tool calling:
```bash
pnpm run gmail:decorator --email:youremail@gmail.com
```

**What it does:**
- ✅ Lists messages via `@tool` decorator
- ✅ Sends email using decorated method
- ✅ Creates draft via decorator

**Key Feature:** Auto-injects `GMAIL_ACCESS_TOKEN` from environment

### Run AI Agent (Recommended)
Tests OpenAI-powered agent that decides which tools to use:
```bash
pnpm run gmail:langchain --email:youremail@gmail.com
```

**What it does:**
- ✅ **Example 1:** Agent analyzes your email count
- ✅ **Example 2:** Agent sends email autonomously
- ✅ **Example 3:** Agent creates professionally-written draft

**Key Features:**
- 🤖 OpenAI GPT-4o-mini decides which tool to call
- 📝 Natural language requests (not API calls)
- 💭 LLM generates appropriate parameters
- 🔄 Multi-step agentic reasoning

**Example Interaction:**
```
Example 2: Send a test email
────────────────────────────────────
👤 User: "Please send a test email to vsajeshnair@gmail.com 
         with subject 'Hello from AI Agent' and body '...'"

🤖 Agent: The test email has been successfully sent to 
          **vsajeshnair@gmail.com** with the subject "Hello 
          from AI Agent"...
```

## 🛠️ Troubleshooting

### Error: `GMAIL_ACCESS_TOKEN not set`
**Solution:** Set the environment variable:
```bash
export GMAIL_ACCESS_TOKEN="ya29.a0AfH6SMBx..."
```

### Error: `401 Unauthorized` or `403 Forbidden`
**Solution:** Your token may be expired or have insufficient scopes
- Get a new token from [OAuth Playground](https://developers.google.com/oauthplayground)
- Ensure you selected all required scopes: `gmail.readonly`, `gmail.send`, `gmail.compose`

### Error: `400 Bad Request` with empty query params
**Solution:** This is fixed by Matimo's parameter encoding system - update if needed:
```bash
cd /Users/sajesh/My\ Work\ Directory/matimo
pnpm build
```

### Error: `Email not actually sent/drafted`
**Solution:** Verify the OAuth token has been refreshed and scopes are correct. The email should appear in:
- **Sent folder** for `gmail-send-email`
- **Drafts folder** for `gmail-create-draft`

## 📚 Understanding the Patterns

### 1. Factory Pattern (`gmail-factory.ts`)
Direct SDK usage with explicit parameter passing:
```typescript
await matimo.execute('gmail-send-email', {
  to: userEmail,
  subject: 'Hello',
  body: 'Message',
  // GMAIL_ACCESS_TOKEN auto-injected from env
});
```

**Use when:** You know exactly what parameters to pass

### 2. Decorator Pattern (`gmail-decorator.ts`)
TypeScript decorators for clean syntax:
```typescript
@tool('gmail-send-email')
async sendEmail(to: string, subject: string, body: string) {
  // Matimo intercepts, auto-injects token
  return undefined;
}

await agent.sendEmail(userEmail, 'Hello', 'Message');
```

**Use when:** Building decorator-based agents or frameworks

### 3. AI Agent Pattern (`gmail-langchain.ts`)
OpenAI agent that reasons about tools:
```typescript
const agent = await createAgent({
  model: new ChatOpenAI({ modelName: 'gpt-4o-mini' }),
  tools: langchainTools,
});

await agent.invoke({
  messages: [{
    role: 'user',
    content: 'Send me a test email'
  }]
});
// Agent decides which tool to use and calls it!
```

**Use when:** Building autonomous AI agents with natural language

## 🔄 How Authentication Works

All three patterns use **Matimo's automatic auth injection**:

1. **Tool Definition** declares auth requirement in YAML:
   ```yaml
   authentication:
     type: oauth2
     provider: google
   ```

2. **Execution Config** references auth parameter:
   ```yaml
   execution:
     headers:
       Authorization: "Bearer {GMAIL_ACCESS_TOKEN}"
   ```

3. **Matimo auto-injects** from environment:
   ```typescript
   // No explicit token passing needed!
   await matimo.execute('gmail-send-email', {
     to: 'user@example.com',
     subject: 'Hello',
     body: 'Message'
     // GMAIL_ACCESS_TOKEN auto-added from process.env
   });
   ```

This keeps your code clean and secure - no tokens in source code!

## 📦 What Gets Created

### Emails Sent
- Appear in your **Gmail Sent folder** immediately
- Subject: Varies per example
- From: Your configured Gmail account

### Drafts Created
- Appear in your **Gmail Drafts folder**
- Ready to edit and send manually
- Useful for AI-generated content review

### Messages Listed
- Shows your 5 most recent emails
- Displays sender, subject, and snippet
- No modifications to existing emails

## 🔗 Related Resources

- **[Matimo Documentation](https://tallclub.github.io/matimo/api-reference/SDK.html)** - Complete SDK reference
- **[Gmail API Docs](https://developers.google.com/gmail/api)** - Official Gmail API
- **[OAuth Playground](https://developers.google.com/oauthplayground)** - Get tokens
- **[Google Cloud Console](https://console.cloud.google.com)** - Manage credentials
- **[LangChain Docs](https://js.langchain.com/)** - LangChain reference

## 💡 Tips & Tricks

### Refresh Tokens
Tokens expire after 1 hour. Get a new one from OAuth Playground:
```bash
# Get fresh token
export GMAIL_ACCESS_TOKEN="ya29.a0AfH6SMBx...new-token..."

# Re-run example
pnpm run gmail:langchain --email:youremail@gmail.com
```

### Test with Different Emails
```bash
# Send to a different recipient
pnpm run gmail:factory --email:different@example.com
```

### Run All Three Patterns
```bash
echo "Factory Pattern:"
pnpm run gmail:factory --email:youremail@gmail.com

echo -e "\nDecorator Pattern:"
pnpm run gmail:decorator --email:youremail@gmail.com

echo -e "\nAI Agent Pattern:"
pnpm run gmail:langchain --email:youremail@gmail.com
```

### View Generated Emails
1. Open Gmail: https://gmail.com
2. Check **Sent folder** for sent emails
3. Check **Drafts folder** for created drafts
4. Check **Inbox** for received emails

## ✨ Key Principles

✅ **All tools defined in YAML** - No code changes needed to modify tools
✅ **Auth tokens auto-injected** - Matimo reads from environment
✅ **Framework-agnostic** - Works with LangChain, CrewAI, custom agents
✅ **Stateless** - Matimo doesn't store tokens or state
✅ **Scalable** - Same pattern works for 10,000+ tools

## ❓ Questions or Issues?

1. Check the error message carefully
2. Verify your OAuth token is valid (less than 1 hour old)
3. Ensure all Gmail scopes are selected
4. Check that `GMAIL_ACCESS_TOKEN` is set correctly
5. Review the [main README](https://github.com/tallclub/matimo) for general setup

---

**Happy emailing! 📧** Use these patterns to build powerful, autonomous email agents with Matimo and OpenAI.
