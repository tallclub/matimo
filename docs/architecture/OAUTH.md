# OAuth2 and Credentials in Matimo

How Matimo gets a token into a tool call, and the OAuth2 helpers it provides for obtaining one. Both SDKs work the same way; Python names are snake_case.

## The Short Version

- A tool's YAML names its credential as a placeholder: `Authorization: 'Bearer {GMAIL_ACCESS_TOKEN}'`.
- At call time Matimo fills it from the call's `credentials`, or from `MATIMO_GMAIL_ACCESS_TOKEN` / `GMAIL_ACCESS_TOKEN` in the environment.
- Matimo does **not** run the OAuth2 browser flow or store tokens for you during `execute()`. Your app obtains the token (with `OAuth2Handler`, or any OAuth library) and passes it in.

```typescript
// One token per process
process.env.GMAIL_ACCESS_TOKEN = token;
await matimo.execute('gmail-list-messages', { maxResults: 5 });

// One token per user (multi-tenant): pass it with the call
await matimo.execute('gmail-list-messages', { maxResults: 5 }, {
  credentials: { GMAIL_ACCESS_TOKEN: tokenForThisUser },
});
```

```python
await matimo.execute(
    "gmail-list-messages",
    {"maxResults": 5},
    credentials={"GMAIL_ACCESS_TOKEN": token_for_this_user},
)
```

## How Placeholders Are Filled

Before a tool runs, Matimo scans its `url`, `headers`, `body` and `query_params` for `{NAME}` placeholders. A placeholder is treated as a credential when its name contains `TOKEN`, `KEY`, `SECRET`, `PASSWORD`, `CREDENTIAL`, `AUTH`, `BEARER` or `API_KEY` (any case). For each credential placeholder the call did not already supply, Matimo looks in order:

| # | Source | Example for `{GMAIL_ACCESS_TOKEN}` |
|---|--------|------------------------------------|
| 1 | The call's `credentials` | `credentials.GMAIL_ACCESS_TOKEN`, then `credentials.MATIMO_GMAIL_ACCESS_TOKEN` |
| 2 | Environment, prefixed | `MATIMO_GMAIL_ACCESS_TOKEN` |
| 3 | Environment, plain | `GMAIL_ACCESS_TOKEN` |

Python also accepts `MATIMO_<TOOL_NAME>_<NAME>` between 2 and 3, for older deployments.

If an auth header placeholder is still empty, TypeScript fails before sending with `AUTH_FAILED` and names the variable to set:

```
Authentication credentials are missing for tool "gmail-list-messages".
  • GMAIL_ACCESS_TOKEN  →  MATIMO_GMAIL_ACCESS_TOKEN (or pass via credentials option)
```

Python sends the request and the API answers 401, which becomes `AUTH_FAILED`.

### Why `credentials` and not a parameter

You *can* pass `{ GMAIL_ACCESS_TOKEN: token }` as a tool parameter, and it will be used. Don't: parameters are what the model sees and writes, they appear in approval requests, and they are part of the call record. `credentials` stays with the host: it never reaches the model, approval callbacks or events, and it overrides the environment for that call only. Function tools receive the same values in their context (`context.credentials`).

For LangChain agents, `convertToolsToLangChain(tools, matimo, secrets)` (`convert_tools_to_langchain(tools, matimo, credentials)` in Python) hides secret-looking parameters from the model and fills them from the map you pass.

## Basic Auth

```yaml
authentication:
  type: basic
  username_env: JIRA_EMAIL
  password_env: JIRA_API_TOKEN
```

Matimo reads both variables (or the same keys in `credentials`) and sends `Authorization: Basic base64(user:password)`; the YAML needs no header template.

## The `authentication` Block

```yaml
authentication:
  type: oauth2            # api_key | bearer | basic | oauth2
  provider: google        # oauth2: names the provider definition
  location: header        # api_key: header | query | body
  name: Authorization     # api_key: header or query parameter name
```

It documents how the tool authenticates. Apart from basic auth, it does not inject anything; the placeholder in `headers` or `query_params` does. The Gmail tools also list `scopes:` here as documentation; the schema drops unknown keys, so nothing enforces them.

## Provider Definitions

Each OAuth2 provider package ships a `definition.yaml` with `type: provider` (TypeScript: `typescript/packages/<provider>/definition.yaml`):

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
    - https://www.googleapis.com/auth/gmail.readonly
```

Providers shipped: `github`, `google`, `hubspot`, `microsoft`, `notion`, `slack`.

## Getting a Token with `OAuth2Handler`

`OAuth2Handler` implements the authorization-code flow against a provider's endpoints. Your app owns the redirect route and the token storage.

```typescript
import { OAuth2ProviderLoader, OAuth2Handler } from '@matimo/core';

// Load provider definitions from a directory of provider packages
const loader = new OAuth2ProviderLoader('./node_modules/@matimo');
await loader.loadProviders();           // finds <dir>/<pkg>/definition.yaml with type: provider
loader.listProviders();                 // ['github', 'google', 'hubspot', 'microsoft', 'notion', 'slack']

const oauth = new OAuth2Handler(
  {
    provider: 'google',
    clientId: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    redirectUri: 'http://localhost:3000/callback',
  },
  loader
);

// 1. Send the user to the provider
const url = oauth.getAuthorizationUrl({
  scopes: ['https://www.googleapis.com/auth/gmail.readonly'],
  userId: 'user-123',
});

// 2. In your callback route
const token = await oauth.exchangeCodeForToken(code, 'user-123');
// { accessToken, refreshToken?, expiresAt, scopes, provider, userId } — store it yourself

// 3. Before each use
const fresh = await oauth.refreshTokenIfNeeded('user-123', token);
await matimo.execute('gmail-list-messages', { maxResults: 5 }, {
  credentials: { GMAIL_ACCESS_TOKEN: fresh.accessToken },
});
```

Other methods: `revokeToken(token)`, `isTokenValid(token)`, `setTokenRefreshBuffer(ms)`, `getEndpoints()`.

Python: `OAuth2ProviderLoader(tools_path)` with `await load_providers()`, and `OAuth2Handler(OAuth2Config(provider=…, client_id=…, client_secret=…, redirect_uri=…), loader)` with `get_authorization_url`, `exchange_code_for_token`, `refresh_token_if_needed`, `revoke_token`, `is_token_valid`.

### Where endpoints come from

| Priority | Source |
|----------|--------|
| 1 | `endpoints` passed in the handler config |
| 2 | `OAUTH_<PROVIDER>_AUTH_URL` and `OAUTH_<PROVIDER>_TOKEN_URL` (both required), optional `OAUTH_<PROVIDER>_REVOKE_URL` |
| 3 | The provider's `definition.yaml` from the loader |

With none of these, the handler throws `AUTH_FAILED` ("Unsupported OAuth2 provider").

## Adding an OAuth2 Provider

1. Create `typescript/packages/<provider>/definition.yaml` with `type: provider` and its `endpoints` (and the Python copy in `python/packages/<provider>/src/matimo_<provider>/`).
2. In each tool, put the token in a header placeholder whose name marks it as a credential, e.g. `Authorization: 'Bearer {LINEAR_ACCESS_TOKEN}'`, and add `authentication: { type: oauth2, provider: <provider> }`.
3. Document the variable in the tool's `notes.env` and the package README.

See [ADDING_TOOLS.md](../tool-development/ADDING_TOOLS.md) for the full checklist.

## Security

- Keep tokens in a secret manager or `.env` (git-ignored); never in YAML or code.
- In multi-tenant apps, pass tokens through `credentials`, never through the environment of a shared process.
- Request the narrowest scopes the tools need.
- `credentials` values are never logged; the audit log (`JsonlFileSink`) also redacts any secret-looking field in the events it writes.
- MCP servers resolve credentials from their own environment or secret resolvers; see [MCP.md](../MCP.md).

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `Authentication credentials are missing for tool …` | No credential for an auth header placeholder (TypeScript) | Set `MATIMO_<NAME>` or `<NAME>`, or pass `credentials` |
| HTTP 401 → `AUTH_FAILED` | Token missing (Python), expired or revoked | Refresh with `refreshTokenIfNeeded`, or re-authorize |
| HTTP 403 → `AUTH_FAILED` | Token lacks a scope | Re-authorize with the scope the API needs |
| A placeholder is sent literally | Its name doesn't look like a credential, so it wasn't filled | Include `TOKEN`, `KEY`, `SECRET`, … in the name, or pass it as a parameter |
| `Unsupported OAuth2 provider` | The loader didn't find the provider | Point the loader at the directory that contains the provider packages and call `loadProviders()` first |
| `Incomplete OAuth environment config` | Only one of the `OAUTH_<PROVIDER>_*_URL` variables is set | Set both |

## See Also

- [AUTHENTICATION.md](../user-guide/AUTHENTICATION.md) — per-provider setup
- [TOOL_SPECIFICATION.md](../tool-development/TOOL_SPECIFICATION.md#authentication) — the YAML fields
- [ERRORS.md](../api-reference/ERRORS.md) — `AUTH_FAILED` and the other codes
