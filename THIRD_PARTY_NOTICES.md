# Third-Party Notices

Matimo (`matimo` core + `@matimo/*` provider packages) is MIT-licensed. That
license governs Matimo's own source code — it does not extend to, and has no
bearing on, the terms of any third-party API or platform a Matimo tool
connects to. **Matimo is not affiliated with, endorsed by, or sponsored by
any provider listed below.** Provider names are used solely to describe
interoperability.

Every credential below is supplied at runtime by the person or application
deploying Matimo (bring-your-own-key / bring-your-own-account) — Matimo does
not embed, route through, or hold its own account with any of these
providers. **Users are responsible for independently reading and complying
with each provider's own Terms of Service, Privacy Policy, and API/Fair
Usage policies before connecting it to Matimo.**

| Provider | Matimo package | Credential(s) (env var) | Provider's terms |
|---|---|---|---|
| [Composio](https://composio.dev) | `@matimo/composio` | `COMPOSIO_API_KEY` (+ per-toolkit connected account) | [Terms](https://composio.dev/terms) · [Privacy](https://composio.dev/privacy) |
| [Slack](https://slack.com) | `@matimo/slack` | `SLACK_BOT_TOKEN` | [Slack API Terms](https://slack.com/terms-of-service/api) |
| [Google (Gmail)](https://developers.google.com/gmail/api) | `@matimo/gmail` | `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` (OAuth2) | [Google APIs Terms](https://developers.google.com/terms) |
| [Microsoft](https://learn.microsoft.com/graph/) | `@matimo/microsoft` | `MICROSOFT_CLIENT_ID` / `MICROSOFT_CLIENT_SECRET` (OAuth2) | [Microsoft APIs Terms of Use](https://learn.microsoft.com/legal/microsoft-apis/terms-of-use) |
| [GitHub](https://github.com) | `@matimo/github` | `GITHUB_TOKEN` | [GitHub Terms of Service](https://docs.github.com/site-policy/github-terms/github-terms-of-service) |
| [HubSpot](https://hubspot.com) | `@matimo/hubspot` | `MATIMO_HUBSPOT_API_KEY` | [HubSpot Legal](https://legal.hubspot.com/) |
| [Notion](https://notion.so) | `@matimo/notion` | `NOTION_API_KEY` | [Notion API Terms](https://www.notion.so/notion-api-terms) |
| [Mailchimp](https://mailchimp.com) | `@matimo/mailchimp` | `MAILCHIMP_API_KEY` | [Mailchimp Standard Terms of Use](https://mailchimp.com/legal/terms/) |
| [Twilio](https://twilio.com) | `@matimo/twilio` | `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` | [Twilio Terms of Service](https://www.twilio.com/legal/tos) |
| PostgreSQL (user-controlled infrastructure) | `@matimo/postgres` | Connection string, user-supplied | N/A — connects to infrastructure the user already controls, not a hosted third-party SaaS platform |

## Composio specifically

`@matimo/composio` calls Composio's `/tools/execute/{slug}` REST endpoint
to expose 449+ third-party actions (Asana, Jira, Linear, Google Workspace,
Microsoft 365, and more) under Matimo's policy engine. See:

- [`typescript/packages/composio/README.md`](./typescript/packages/composio/README.md) — rationale for the dependency and BYOK model
- [`docs/COMPOSIO.md`](./docs/COMPOSIO.md) — usage reference

## Generated catalog data

Tool names, descriptions, and parameter schemas under
`typescript/packages/composio/tools/composio_*/` were extracted from
Composio's catalog API by `scripts/generate-tools.ts` and are redistributed
as static files in the `@matimo/composio` package. This is a one-time,
project-level extraction — distinct from the runtime BYOK credential each
end user supplies to actually execute a tool.

## No bundled third-party client libraries

None of the packages above depend on a vendor-published client SDK
(`composio-core`, `@slack/web-api`, etc.) — every provider integration in
Matimo is implemented as a `type: http` YAML definition calling the
provider's REST API directly, so there is no third-party library license to
reconcile against Matimo's own MIT license.

## Reporting an issue

If you believe a listing here is inaccurate, missing, or that Matimo's use
of a provider's API is inconsistent with that provider's terms, open an
issue or see [SECURITY.md](./SECURITY.md) for responsible disclosure.
