# Authentication Guide

Setup OAuth2 for tools that require user authentication.

## Overview

Some tools require authentication (e.g., Gmail, GitHub, Slack). Matimo handles OAuth2 token injection automatically.

**How it works:**

1. Obtain OAuth2 token from provider (Google, GitHub, Slack)
2. Set token in environment variable
3. Matimo automatically injects token into tool execution
4. Execute tool normally

---

## Quick Setup (Gmail Example)

### 1. Get OAuth2 Token

From Google Cloud Console:

```bash
# Set your Gmail access token
export GMAIL_ACCESS_TOKEN="ya29.a0AfH6SMBx..."
```

For other providers, see [Full OAuth2 Guide](../architecture/OAUTH.md).

### 2. Execute OAuth2 Tool

```typescript
import { MatimoInstance } from 'matimo';

const m = await MatimoInstance.init('./tools');

// Token automatically injected from GMAIL_ACCESS_TOKEN env var
const result = await m.execute('gmail-send-email', {
  to: 'user@example.com',
  subject: 'Hello from Matimo',
  body: 'This email was sent via Matimo!',
});

console.log('✅ Email sent:', result.messageId);
```

No additional code needed — Matimo handles token injection.

---

## Supported Providers

| Provider           | Token Env Var         | Scope                                        |
| ------------------ | --------------------- | -------------------------------------------- |
| **Google (Gmail)** | `GMAIL_ACCESS_TOKEN`  | `https://www.googleapis.com/auth/gmail.send` |
| **GitHub**         | `GITHUB_ACCESS_TOKEN` | `repo, gist`                                 |
| **Slack**          | `SLACK_ACCESS_TOKEN`  | `chat:write, users:read`                     |

---

## Environment Variable Pattern

Matimo uses a naming convention for OAuth2 tokens:

```
{PROVIDER}_{CREDENTIAL_TYPE}_TOKEN

Examples:
GMAIL_ACCESS_TOKEN
GITHUB_ACCESS_TOKEN
SLACK_ACCESS_TOKEN
```

Check tool documentation for exact variable name:

```typescript
const tool = m.getTool('gmail-send-email');
console.log(tool.authentication);
// { type: 'oauth2', provider: 'google', ... }
```

---

## Getting OAuth2 Tokens

### Google (Gmail)

1. Visit [Google Cloud Console](https://console.cloud.google.com)
2. Create OAuth2 credentials (type: Web application)
3. Get access token:
   ```bash
   curl -X POST https://oauth2.googleapis.com/token \
     -d "client_id=YOUR_CLIENT_ID&client_secret=YOUR_SECRET&grant_type=refresh_token&refresh_token=YOUR_REFRESH_TOKEN"
   ```
4. Set environment variable:
   ```bash
   export GMAIL_ACCESS_TOKEN="ya29.a0AfH6SMBx..."
   ```

### GitHub

1. Visit [GitHub Settings → Developer Settings → Personal Tokens](https://github.com/settings/tokens)
2. Create Personal Access Token with `repo` and `gist` scopes
3. Set environment variable:
   ```bash
   export GITHUB_ACCESS_TOKEN="ghp_xxxxx..."
   ```

### Slack

1. Visit [Slack App Configuration](https://api.slack.com/apps)
2. Create new app or select existing
3. Install app to workspace
4. Copy Bot Token or OAuth token
5. Set environment variable:
   ```bash
   export SLACK_ACCESS_TOKEN="xoxb-..."
   ```

---

## Verify Authentication

### Check Token

```typescript
// Verify token is set
const token = process.env.GMAIL_ACCESS_TOKEN;
if (!token) {
  console.error('❌ GMAIL_ACCESS_TOKEN not set');
  process.exit(1);
}
console.log('✅ Token found');
```

### Test Execution

```typescript
try {
  const result = await m.execute('gmail-send-email', {
    to: 'test@example.com',
    subject: 'Test',
    body: 'Test email',
  });
  console.log('✅ Authentication successful');
} catch (error) {
  if (error.code === 'EXECUTION_FAILED' && error.details?.statusCode === 401) {
    console.error('❌ Token invalid or expired');
  }
}
```

---

## Troubleshooting

### Token Not Found

**Error:**

```
Tool execution failed: Missing GMAIL_ACCESS_TOKEN environment variable
```

**Solution:**

```bash
# Verify token is set
echo $GMAIL_ACCESS_TOKEN

# If empty, set it
export GMAIL_ACCESS_TOKEN="your_token_here"
```

### Token Expired

**Error:**

```
401 Unauthorized: Invalid Credentials
```

**Solution:**

1. Refresh your OAuth2 token from provider
2. Update environment variable
3. Retry execution

### Invalid Scopes

**Error:**

```
Access denied: Insufficient scopes
```

**Solution:**

1. Check required scopes in tool documentation
2. Generate new token with required scopes
3. Update environment variable

---

## Security Best Practices

⚠️ **Never commit tokens to git**

```bash
# ❌ DON'T do this
export GITHUB_TOKEN="ghp_xxxxx"  # DO NOT COMMIT

# ✅ DO this instead
# Set in your .env file (add .env to .gitignore)
# Or use your shell's secure storage
```

Store tokens securely:

- Environment variables (recommended)
- `.env` file (add to `.gitignore`)
- System keychain (macOS Keychain, Windows Credential Manager)
- CI/CD secrets (GitHub Actions, etc.)

---

## Advanced: Multiple Providers

```typescript
const m = await MatimoInstance.init('./tools');

// Execute Gmail tool
const email = await m.execute('gmail_send_email', {
  to: 'user@example.com',
  subject: 'From Matimo',
  body: 'Test',
});

// Execute GitHub tool
const issue = await m.execute('github-create-issue', {
  owner: 'tallclub',
  repo: 'matimo',
  title: 'Feature request',
  body: 'Please add more tools',
});

// Execute Slack tool
const msg = await m.execute('slack-send-message', {
  channel: '#general',
  text: 'Hello from Matimo!',
});
```

Each tool automatically uses the correct token based on its provider.

---

## Next Steps

- **Full OAuth2 Details**: [OAuth2 Implementation Guide](../architecture/OAUTH.md)
- **Tool Discovery**: [Find Tools](./TOOL_DISCOVERY.md)
- **Error Handling**: [Error Codes Reference](../api-reference/ERRORS.md)
