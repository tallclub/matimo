# Credentials Management Example

Demonstrates how to securely manage credentials and API keys across different provider integrations in Matimo.

## 🎯 What This Example Shows

✅ **Environment Variable Loading** — Load credentials from `.env`  
✅ **Multiple Providers** — Manage keys for different services (Slack, GitHub, etc.)  
✅ **Credential Validation** — Verify keys are set before tool execution  
✅ **Multi-Pattern Support** — Works with factory, decorator, and LangChain patterns  
✅ **Production Patterns** — Best practices for credential management  

## 🚀 Run the Example

```bash
cd examples/tools

# Setup environment with credentials
cp .env.example .env
# Then edit .env and add your actual API keys

# Run with factory pattern (simplest)
npm run credentials:example
```

## 🔐 Credentials Setup

### Environment Variables

Create `.env` file in `examples/tools/` with your credentials:

```bash
# Slack
SLACK_BOT_TOKEN=xoxb-your-slack-token
SLACK_APP_TOKEN=xapp-your-app-token

# GitHub
GITHUB_TOKEN=ghp_your-github-token

# Gmail
GMAIL_API_KEY=your-gmail-api-key

# PostgreSQL
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your-password
POSTGRES_DB=your-database

# OpenAI (for agent examples)
OPENAI_API_KEY=sk-your-openai-key

# HubSpot
HUBSPOT_API_KEY=your-hubspot-key

# Mailchimp
MAILCHIMP_API_KEY=your-mailchimp-key

# Twilio
TWILIO_ACCOUNT_SID=your-account-sid
TWILIO_AUTH_TOKEN=your-auth-token

# Notion
NOTION_API_KEY=your-notion-token

# Others as needed...
```

### Loading Credentials in Code

```typescript
import * as dotenv from 'dotenv';

// Load .env file
dotenv.config();

// Access credentials
const slackToken = process.env.SLACK_BOT_TOKEN;
const githubToken = process.env.GITHUB_TOKEN;

if (!slackToken) {
  throw new Error('SLACK_BOT_TOKEN not set in .env');
}
```

## 🔒 Best Practices

### 1. Never Commit `.env` Files

```bash
# .gitignore
.env
.env.local
.env.*.local
```

### 2. Use `.env.example` Template

```bash
# .env.example (commit this to repo)
SLACK_BOT_TOKEN=<your-slack-bot-token>
GITHUB_TOKEN=<your-github-token>
OPENAI_API_KEY=<your-openai-key>
```

### 3. Validate Credentials on Startup

```typescript
function validateCredentials() {
  const required = ['SLACK_BOT_TOKEN', 'GITHUB_TOKEN', 'OPENAI_API_KEY'];
  
  for (const key of required) {
    if (!process.env[key]) {
      throw new Error(`Missing required credential: ${key}`);
    }
  }
  
  console.log('✅ All credentials loaded');
}

validateCredentials();
```

### 4. Rotate Credentials Regularly

- Update tokens in your provider dashboards
- Update `.env` file locally
- Never share credentials in code or chat

### 5. Use Different Keys for Different Environments

```typescript
// development
process.env.SLACK_BOT_TOKEN = '...dev-token...';

// production
process.env.SLACK_BOT_TOKEN = '...prod-token...';

// testing
process.env.SLACK_BOT_TOKEN = '...mock-token...';
```

## 📋 Getting API Keys

### Slack
1. Go to [api.slack.com/apps](https://api.slack.com/apps)
2. Create a new app
3. Go to OAuth & Permissions
4. Copy Bot Token

### GitHub
1. Go to [github.com/settings/tokens](https://github.com/settings/tokens)
2. Create Personal Access Token
3. Copy the token

### Gmail
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create OAuth credentials
3. Download credentials JSON

### OpenAI
1. Go to [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
2. Create new API key
3. Copy the key

### PostgreSQL
- Host: Your database server address
- Port: Usually 5432
- User: Database user
- Password: Database password
- DB: Database name

### HubSpot
1. Go to [hubspot.com/account/settings](https://hubspot.com/account/settings)
2. Find Private App tokens
3. Copy the token

### Mailchimp
1. Go to [mailchimp.com/account/api](https://mailchimp.com/account/api)
2. Create API key
3. Copy the key

### Twilio
1. Go to [twilio.com/console](https://twilio.com/console)
2. Find Account SID and Auth Token
3. Copy both

### Notion
1. Go to [notion.so/myintegrations](https://notion.so/myintegrations)
2. Create new integration
3. Copy API key

## 🧪 Testing with Dummy Credentials

For testing without real credentials:

```typescript
// Test credentials (these won't actually work)
process.env.SLACK_BOT_TOKEN = 'xoxb-test-token';
process.env.GITHUB_TOKEN = 'ghp-test-token';
process.env.OPENAI_API_KEY = 'sk-test-key';
```

## ⚠️ Troubleshooting

| Problem | Solution |
|---------|----------|
| "SLACK_BOT_TOKEN not set" | Add to `.env` file |
| "Invalid token" | Check token is correct in `.env` |
| "401 Unauthorized" | Token may have expired, refresh it |
| ".env not loading" | Ensure `dotenv.config()` is called first |
| "Module not found: dotenv" | Run `npm install dotenv` |

## 🔗 Related Examples

- [Slack Examples](../slack/) — Slack integration with credentials
- [GitHub Examples](../github/) — GitHub integration with credentials
- [QUICK_COMMANDS.md](../QUICK_COMMANDS.md) — All examples reference

## ✅ Verification

After setting up credentials:

```bash
# Check credentials are loaded
npm run credentials:example

# Expected output:
# ✅ SLACK_BOT_TOKEN loaded
# ✅ GITHUB_TOKEN loaded
# ✅ OPENAI_API_KEY loaded
# ... (for each configured credential)
```

## 🚀 Next Steps

1. **Add your credentials** to `.env`
2. **Run provider examples** with credentials (e.g., `npm run slack:factory`)
3. **Use in your agent** — credentials auto-load when tools execute
4. **Rotate periodically** — refresh tokens in provider dashboards
5. **Deploy with confidence** — production servers read from secure env vars
