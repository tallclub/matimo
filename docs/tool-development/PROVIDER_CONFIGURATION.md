# Provider Configuration Guide

## Overview

Matimo uses a **configuration-driven** approach to OAuth2 provider endpoints. Instead of hardcoding provider information into the application, all provider definitions are stored in **YAML files**. This enables:

- ✅ Support for **infinite providers** without code changes
- ✅ **Configuration-driven design** - no coupling between code and provider endpoints
- ✅ **Easy customization** - override endpoints via environment variables or runtime config
- ✅ **Zero code modifications** - users can add new providers just by creating YAML files

## Provider Definition Structure

Each OAuth2 provider must have a `definition.yaml` file in its provider folder:

```
tools/
├── gmail/
│   └── definition.yaml          ← Provider definition
├── github/
│   └── definition.yaml
├── slack/
│   └── definition.yaml
└── [your-provider]/
    └── definition.yaml
```

### Provider Definition Format

```yaml
name: google-provider # Unique name for this provider definition
type: provider # MUST be "provider" to indicate this is an OAuth2 config
version: '1.0.0' # Semantic version of the provider config
description: Google OAuth2 provider # Optional description

provider:
  name: google # Provider identifier (used in code)
  displayName: Google # Human-readable name

  endpoints:
    authorizationUrl: https://accounts.google.com/o/oauth2/v2/auth
    tokenUrl: https://oauth2.googleapis.com/token
    revokeUrl: https://oauth2.googleapis.com/revoke # Optional

  defaultScopes: # Optional default scopes
    - https://www.googleapis.com/auth/gmail.send
    - https://www.googleapis.com/auth/gmail.readonly

  documentation: https://developers.google.com/identity/protocols/oauth2
```

## Configuration Priority

Matimo resolves OAuth2 endpoints using a **3-tier priority system**:

### 1. Runtime Configuration (Highest Priority)

User provides endpoints directly in code:

```typescript
const oauth2 = new OAuth2Handler({
  provider: 'google',
  clientId: '...',
  clientSecret: '...',
  redirectUri: '...',
  endpoints: {
    // ← These override everything else
    authorizationUrl: 'https://custom.company.com/auth',
    tokenUrl: 'https://custom.company.com/token',
  },
});
```

**Use case:** Custom or internal OAuth2 servers

### 2. Environment Variables (Medium Priority)

Deploy-time configuration via environment variables:

```bash
export OAUTH_GOOGLE_AUTH_URL=https://custom.company.com/auth
export OAUTH_GOOGLE_TOKEN_URL=https://custom.company.com/token
export OAUTH_GOOGLE_REVOKE_URL=https://custom.company.com/revoke
```

**Use case:** Different endpoints per deployment (dev, staging, prod)

### 3. YAML Configuration (Default)

Default endpoints defined in `tools/[provider]/definition.yaml`:

```yaml
provider:
  endpoints:
    authorizationUrl: https://accounts.google.com/o/oauth2/v2/auth
    tokenUrl: https://oauth2.googleapis.com/token
```

**Use case:** Standard provider defaults

### Resolution Example

```typescript
// If config.endpoints is provided → Use that (Priority 1)
const handler = new OAuth2Handler({
  provider: 'google',
  clientId: '...',
  endpoints: { authorizationUrl: 'https://custom/auth', ... }  // ← Used
});

// Else if OAUTH_GOOGLE_AUTH_URL env var is set → Use that (Priority 2)
process.env.OAUTH_GOOGLE_AUTH_URL = 'https://custom/auth';
const handler = new OAuth2Handler({
  provider: 'google',
  clientId: '...',
  // No endpoints provided, env var checked
});

// Else use the provider's definition.yaml (Priority 3) — needs a loaded loader
const loader = new OAuth2ProviderLoader('./node_modules/@matimo');
await loader.loadProviders();
const handler = new OAuth2Handler({ provider: 'google', clientId: '...', clientSecret: '...', redirectUri: '...' }, loader);
```

## Adding a New Provider

### Step 1: Create Provider Definition File

Create `typescript/packages/<provider>/definition.yaml` (and the Python copy in `python/packages/<provider>/src/matimo_<provider>/definition.yaml`):

```yaml
name: microsoft-provider
type: provider
version: '1.0.0'
description: Microsoft Azure AD OAuth2 provider

provider:
  name: microsoft
  displayName: Microsoft

  endpoints:
    authorizationUrl: https://login.microsoftonline.com/common/oauth2/v2.0/authorize
    tokenUrl: https://login.microsoftonline.com/common/oauth2/v2.0/token
    revokeUrl: https://login.microsoftonline.com/common/oauth2/v2.0/token/revoke

  defaultScopes:
    - https://graph.microsoft.com/Mail.Send
    - https://graph.microsoft.com/user.read

  documentation: https://docs.microsoft.com/en-us/azure/active-directory/develop/v2-oauth2-auth-code-flow
```

### Step 2: Use in Code

Load the provider definitions, then pass the loader to the handler:

```typescript
import { OAuth2Handler, OAuth2ProviderLoader } from '@matimo/core';

const loader = new OAuth2ProviderLoader('./node_modules/@matimo'); // directory holding the provider packages
await loader.loadProviders();

const oauth2 = new OAuth2Handler(
  {
    provider: 'microsoft', // provider.name from definition.yaml
    clientId: process.env.MICROSOFT_CLIENT_ID!,
    clientSecret: process.env.MICROSOFT_CLIENT_SECRET!,
    redirectUri: 'http://localhost:3000/callback',
  },
  loader
);

// Get authorization URL
const authUrl = oauth2.getAuthorizationUrl({
  scopes: ['https://graph.microsoft.com/Mail.Send'],
  userId: 'user-123',
});
```

### Step 3: (Optional) Override with Environment Variables

For deployment-specific endpoints:

```bash
export OAUTH_MICROSOFT_AUTH_URL=https://custom-idp.company.com/authorize
export OAUTH_MICROSOFT_TOKEN_URL=https://custom-idp.company.com/token
export OAUTH_MICROSOFT_REVOKE_URL=https://custom-idp.company.com/revoke
```

## Built-in Provider Examples

### Google (Gmail)

**File:** `typescript/packages/gmail/definition.yaml`

```yaml
name: google-provider
type: provider
version: '1.0.0'

provider:
  name: google
  displayName: Google

  endpoints:
    authorizationUrl: https://accounts.google.com/o/oauth2/v2/auth
    tokenUrl: https://oauth2.googleapis.com/token
    revokeUrl: https://oauth2.googleapis.com/revoke

  defaultScopes:
    - https://www.googleapis.com/auth/gmail.send
    - https://www.googleapis.com/auth/gmail.readonly
    - https://www.googleapis.com/auth/gmail.compose

  documentation: https://developers.google.com/identity/protocols/oauth2
```

### GitHub

**File:** `typescript/packages/github/definition.yaml`

```yaml
name: github-provider
type: provider
version: '1.0.0'

provider:
  name: github
  displayName: GitHub

  endpoints:
    authorizationUrl: https://github.com/login/oauth/authorize
    tokenUrl: https://github.com/login/oauth/access_token

  defaultScopes:
    - user:email
    - repo
    - gist

  documentation: https://docs.github.com/en/developers/apps/building-oauth-apps
```

### Slack

**File:** `typescript/packages/slack/definition.yaml`

```yaml
name: slack-provider
type: provider
version: '1.0.0'

provider:
  name: slack
  displayName: Slack

  endpoints:
    authorizationUrl: https://slack.com/oauth/v2/authorize
    tokenUrl: https://slack.com/api/oauth.v2.access

  defaultScopes:
    - chat:write
    - channels:read
    - users:read

  documentation: https://api.slack.com/authentication/oauth-v2
```

## Token Management

Matimo handles OAuth2 flows but **does NOT store tokens**. Token storage is your responsibility:

```typescript
import { OAuth2Handler } from '@matimo/core';

// 1. Initialize handler (loader as in "Adding a New Provider")
const oauth2 = new OAuth2Handler(
  {
    provider: 'google',
    clientId: '...',
    clientSecret: '...',
    redirectUri: 'http://localhost:3000/callback',
  },
  loader
);

// 2. Generate auth URL
const authUrl = oauth2.getAuthorizationUrl({
  scopes: ['https://www.googleapis.com/auth/gmail.send'],
  userId: 'user-123',
});
// → Redirect user to authUrl

// 3. Exchange code for token
const token = await oauth2.exchangeCodeForToken(authCode, 'user-123');
// Result: { accessToken, refreshToken, expiresAt, ... }

// 4. YOU store the token (database, Redis, file, etc.)
await database.saveToken('user-123', token);

// 5. Later, retrieve and use the token with Matimo tools
const stored = await oauth2.refreshTokenIfNeeded('user-123', await database.getToken('user-123'));
await matimo.execute(
  'gmail-send-email',
  { to: 'recipient@example.com', subject: 'Hi', body: 'Hello' },
  { credentials: { GMAIL_ACCESS_TOKEN: stored.accessToken } } // ← per-call, never shown to the model
);
```

## Dynamic Provider Discovery

The provider loader automatically discovers all providers from YAML files:

```typescript
import { OAuth2ProviderLoader } from '@matimo/core';

const loader = new OAuth2ProviderLoader('./node_modules/@matimo');
const providers = await loader.loadProviders(); // Map<name, endpoints>

// List all discovered providers
loader.listProviders();
// Output: ['github', 'google', 'hubspot', 'microsoft', 'notion', 'slack']

// Get endpoints for specific provider
const googleEndpoints = providers.get('google');
console.log(googleEndpoints);
// Output: {
//   authorizationUrl: 'https://accounts.google.com/...',
//   tokenUrl: 'https://oauth2.googleapis.com/token',
//   revokeUrl: '...'
// }
```

## Custom OAuth2 Server

Use runtime configuration to connect to a custom OAuth2 server:

```typescript
const oauth2 = new OAuth2Handler({
  provider: 'internal-oauth', // Any name
  clientId: 'internal-client',
  clientSecret: 'internal-secret',
  redirectUri: 'http://localhost:3000/callback',
  endpoints: {
    authorizationUrl: 'https://oauth.company.internal/authorize',
    tokenUrl: 'https://oauth.company.internal/token',
    revokeUrl: 'https://oauth.company.internal/revoke',
  },
});
```

Or use environment variables:

```bash
export OAUTH_INTERNAL_AUTH_URL=https://oauth.company.internal/authorize
export OAUTH_INTERNAL_TOKEN_URL=https://oauth.company.internal/token
export OAUTH_INTERNAL_REVOKE_URL=https://oauth.company.internal/revoke
```

```typescript
const oauth2 = new OAuth2Handler({
  provider: 'internal',
  clientId: '...',
  clientSecret: '...',
  redirectUri: '...',
  // Endpoints loaded from env vars automatically
});
```

## Best Practices

### 1. Use Configuration-Driven Approach

❌ Don't hardcode endpoints:

```typescript
const oauth2 = new OAuth2Handler({
  provider: 'custom',
  clientId: '...',
  endpoints: {
    authorizationUrl: 'https://hardcoded.example.com/auth', // ❌ Bad
  },
});
```

✅ Use YAML or environment variables:

```yaml
# tools/custom/definition.yaml
provider:
  endpoints:
    authorizationUrl: https://custom.example.com/auth
```

### 2. Document Provider Requirements

Include setup instructions in provider definition:

```yaml
provider:
  documentation: https://docs.example.com/oauth2-setup
  # Include links to:
  # - How to register OAuth app
  # - Where to get client ID/secret
  # - Required scopes for different use cases
```

### 3. Use Semantic Versioning

Update version when endpoints change:

```yaml
version: '1.1.0' # Increment for breaking changes
```

### 4. Never Hardcode Secrets

Always use environment variables:

```typescript
const oauth2 = new OAuth2Handler({
  provider: 'google',
  clientId: process.env.GOOGLE_CLIENT_ID, // ✅ From env vars
  clientSecret: process.env.GOOGLE_CLIENT_SECRET, // ✅ From env vars
  redirectUri: process.env.GOOGLE_REDIRECT_URI, // ✅ From env vars
});
```

### 5. Validate Provider Definition

Matimo automatically validates YAML structure:

```typescript
// This throws MatimoError if definition is invalid
const loader = new OAuth2ProviderLoader('./tools');
await loader.loadProviders();
```

## Troubleshooting

### Provider Not Found

```
MatimoError: Unsupported OAuth2 provider: custom. Provide endpoints via:
  1. config.endpoints (runtime override)
  2. OAUTH_CUSTOM_AUTH_URL env var (deployment config)
  3. tools/custom/definition.yaml (YAML configuration)
```

**Solution:** Pass `endpoints`, set both `OAUTH_<PROVIDER>_*_URL` variables, or create the provider's `definition.yaml` and pass a loader on which you called `loadProviders()`. A handler built without a loader looks in `./tools` and never loads it, so only the first two options work there.

### Invalid Provider Definition

```
MatimoError: Provider validation failed: …
```

**Solution:** Ensure YAML has required fields:

- `name`
- `type: provider`
- `provider.endpoints.authorizationUrl`
- `provider.endpoints.tokenUrl`

### Environment Variable Not Read

Make sure env var name matches the pattern:

```bash
# For provider: 'google'
export OAUTH_GOOGLE_AUTH_URL=...
export OAUTH_GOOGLE_TOKEN_URL=...
export OAUTH_GOOGLE_REVOKE_URL=...  # Optional

# For provider: 'microsoft'
export OAUTH_MICROSOFT_AUTH_URL=...
```

## See Also

- [OAuth2Handler API](../../typescript/packages/core/src/auth/oauth2-handler.ts)
- [Provider Loader Implementation](../../typescript/packages/core/src/auth/oauth2-provider-loader.ts)
- [Integration Tests](../../typescript/packages/core/test/integration/oauth2-provider-config.integration.test.ts)
