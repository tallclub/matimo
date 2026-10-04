# Authentication

Tools that call an authenticated API name their credential in the YAML (for example `Authorization: 'Bearer {GITHUB_TOKEN}'`). Matimo fills it in at call time; you supply the value through the environment or per call.

## Quick Start

```bash
export GITHUB_TOKEN="ghp_..."          # or MATIMO_GITHUB_TOKEN
```

```typescript
import { MatimoInstance } from '@matimo/core';

const matimo = await MatimoInstance.init({ autoDiscover: true });
const repo = await matimo.execute('github-get-repository', { owner: 'tallclub', repo: 'matimo' });
```

For a token per user (multi-tenant), pass it with the call instead of the environment:

```typescript
await matimo.execute(
  'github-get-repository',
  { owner: 'tallclub', repo: 'matimo' },
  { credentials: { GITHUB_TOKEN: tokenForThisUser } }
);
```

```python
await matimo.execute(
    "github-get-repository",
    {"owner": "tallclub", "repo": "matimo"},
    credentials={"GITHUB_TOKEN": token_for_this_user},
)
```

## Lookup Order

For each credential placeholder, Matimo uses the first value it finds:

1. The call's `credentials` — `NAME`, then `MATIMO_NAME`
2. `MATIMO_NAME` in the environment
3. `NAME` in the environment

A placeholder counts as a credential when its name contains `TOKEN`, `KEY`, `SECRET`, `PASSWORD`, `CREDENTIAL`, `AUTH`, `BEARER` or `API_KEY`. Details: [OAuth2 and Credentials](../architecture/OAUTH.md).

## Variables by Provider

| Package | Variable(s) | How to get it |
|---------|-------------|---------------|
| `@matimo/github` | `GITHUB_TOKEN` | [Personal access token](https://github.com/settings/tokens) with the scopes the tools need (e.g. `repo`) |
| `@matimo/slack` | `SLACK_BOT_TOKEN` | Slack app → OAuth & Permissions → Bot User OAuth Token (`xoxb-…`), with scopes such as `chat:write`, `channels:read` |
| `@matimo/gmail` | `GMAIL_ACCESS_TOKEN` | A Google OAuth2 access token with Gmail scopes (e.g. from the [OAuth Playground](https://developers.google.com/oauthplayground) or `OAuth2Handler`) |
| `@matimo/notion` | `NOTION_API_KEY` | Notion integration secret; share the pages with the integration |
| `@matimo/hubspot` | `MATIMO_HUBSPOT_API_KEY` | HubSpot private app access token |
| `@matimo/mailchimp` | `MAILCHIMP_API_KEY` | Mailchimp API key (the tools also take `server_prefix`, e.g. `us6`) |
| `@matimo/twilio` | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` | Twilio console; used for basic auth |
| `@matimo/microsoft` | `MICROSOFT_GRAPH_ACCESS_TOKEN` | A delegated Microsoft Graph token |
| `@matimo/postgres` | `MATIMO_POSTGRES_URL`, or `MATIMO_POSTGRES_HOST` / `_PORT` / `_USER` / `_PASSWORD` / `_DB` | Your database |
| `@matimo/composio` | `COMPOSIO_API_KEY` | Composio dashboard; each call also takes the user's connected account ID |

The exact name is in each tool's YAML (`headers`, `query_params`, or `authentication.username_env` / `password_env`) and in its `notes.env`:

```typescript
const tool = matimo.getTool('slack_send_channel_message');
console.log(tool?.execution);   // headers: { Authorization: 'Bearer {SLACK_BOT_TOKEN}', … }
```

## Verify

```bash
matimo doctor          # checks installed packages for missing credential variables
```

```typescript
matimo.getRequiredCredentials('github-get-repository'); // ['GITHUB_TOKEN'] (TypeScript only)
```

In TypeScript, a call whose auth header can't be filled fails before anything is sent:

```
AUTH_FAILED: Authentication credentials are missing for tool "github-get-repository".
  • GITHUB_TOKEN  →  MATIMO_GITHUB_TOKEN (or pass via credentials option)
```

In Python the request is sent and the API's 401 becomes `AUTH_FAILED`.

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `Authentication credentials are missing` | No value for the placeholder | Set the variable from the table, or pass `credentials` |
| `AUTH_FAILED` with `statusCode: 401` | Token wrong, expired or revoked | Generate or refresh the token |
| `AUTH_FAILED` with `statusCode: 403` | Token lacks a scope or permission | Add the scope (and, for Slack, invite the bot to the channel) |
| Works locally, fails in another process | The variable isn't set there | Set it in that environment, or pass `credentials` |

## Security

- Never commit tokens. Use a `.env` file listed in `.gitignore`, or a secret manager.
- Use the narrowest scopes the tools need.
- In servers that act for several users, pass tokens per call with `credentials`; don't put one user's token in a shared process's environment.
- Never pass a token as a tool parameter: parameters are visible to the model and to approval prompts.

## Next Steps

- [OAuth2 and Credentials](../architecture/OAUTH.md) — the full lookup rules and the `OAuth2Handler` flow
- [Tool Discovery](./TOOL_DISCOVERY.md)
- [Error Codes](../api-reference/ERRORS.md)
