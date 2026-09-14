# BYOK-for-Composio Precedent — Evidence Log, 2026-08-11

Purpose: document that "bring your own Composio API key" is a standard,
Composio-documented integration pattern used by other platforms that build
on Composio's catalog — not a novel or unusual architecture invented for
`@matimo/composio`. Quotes below were retrieved via an AI fetch tool
(paraphrase risk applies — see [README.md](./README.md) reliability
warning) but are corroborated across independent sources/searches, unlike
the ToS commercial-use clause.

For an actual evidentiary record (not just this log), the underlying pages
should also be captured verbatim (print-to-PDF or full-page screenshot) and
stored alongside this file, dated.

---

## 1. Langflow

**Source:** https://docs.langflow.org/bundles-composio
**Also relevant:** https://docs.composio.dev/framework/langflow (Composio's
own docs for the same integration — i.e. Composio itself documents and
endorses this pattern for a third-party framework)

Quoted:

> "You can provide this key directly in your components, or you can use the
> `COMPOSIO_API_KEY` global variable, which Langflow can automatically load
> from your `.env` file."

> "In the Composio API Key field, enter your Composio API key or use the
> `COMPOSIO_API_KEY` global variable. If the key is valid, the Alert is
> replaced by a Success indicator, and the Actions list populates with
> actions available to your API key."

> "The Composio API key only handles the connection to Composio; service
> provider authentication is managed through the Composio platform, meaning
> you'll need to authenticate with individual services (like GitHub or
> Google Calendar) separately through Composio."

This is functionally identical to `@matimo/composio`'s model:
`COMPOSIO_API_KEY` supplied by the embedding application/user, per-service
auth handled via Composio's own connected-account flow.

## 2. KiloClaw (Kilo AI's hosted OpenClaw agent platform)

**Source:** https://kilo.ai/docs/kiloclaw/development-tools/composio

Quoted setup steps:

> "Go to composio.dev and sign up for a free account...click Create API
> Key, give it a name...and copy the key"

> "Go to the Settings tab on your KiloClaw dashboard...Paste the API key
> into the Composio API Key field"

> "you need to authorise it once inside Composio: In your Composio
> dashboard, go to Integrations or Connected Accounts"

Also: "KiloClaw can connect to Composio to instantly unlock access to 250+
tool integrations... Composio is a platform that handles the authentication
and connection details for each service, so your agent can use them without
you having to set up each one individually." — a commercial hosted product
built directly on user-supplied Composio credentials.

## 3. Placekey (Composio's own toolkit docs)

**Source:** https://docs.composio.dev/toolkits/placekey

> "Placekey requires you to configure your own API key credentials, and
> once set up, Composio handles secure credential storage and API request
> handling."

This is Composio's own documentation describing per-user, self-supplied API
key credentials as the intended pattern for at least one of their toolkits
— i.e. the BYOK model is one Composio itself documents, not just one
third parties have adopted unilaterally.

---

## Summary

Three independent sources — one third-party low-code platform (Langflow),
one commercial hosted agent product (KiloClaw), and Composio's own toolkit
documentation (Placekey) — all describe or require a pattern where the
Composio API key is supplied by the end user/deploying application rather
than held centrally by the integrating platform. This supports treating
`@matimo/composio`'s BYOK model as consistent with how Composio's ecosystem
generally expects third-party integrations to be built. It does **not** by
itself resolve the ToS commercial-use ambiguity logged in
`2026-08-11-composio-tos-snapshot.md` — a platform can require BYOK for
technical/security reasons while still restricting commercial packaging in
its terms. Both threads should be read together, not treated as
substitutes for each other.
