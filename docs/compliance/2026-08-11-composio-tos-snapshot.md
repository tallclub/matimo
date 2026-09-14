# Composio Terms of Service — Snapshot, 2026-08-11

**Source:** https://composio.dev/terms
**Fetched:** 2026-08-11, via AI summarization tool (see reliability warning
in [README.md](./README.md) — this is NOT a verbatim capture)
**Related:** Fair Usage Policy is referenced by the ToS by name but — see
finding below — could not be located as a published document as of this
snapshot date.

---

## Extraction #1 (first fetch, same session)

Focused query: restrictions on resale/derivative use, trademark/brand rules,
attribution requirements, rate limits, white-labeling.

> "This license does not include any resale or commercial use of the
> platform or its contents, any derivative use"

> "All access and usage must remain within reasonable limits as defined
> under our Fair Usage Policy. Excessive, abusive, or automated use beyond
> those limits may result in suspension"

No trademark/brand guidelines, attribution requirements, or explicit
white-labeling prohibition were found in this pass.

## Extraction #2 (second fetch, same session, full-page summary)

> **License & Usage**: "limited, non-exclusive, non-transferable, revocable
> license" for **personal and commercial use, excluding resale or data
> mining**.

Also surfaced in this pass (not covered by extraction #1's narrower query):

- **Prohibited Conduct**: no illegal activity, no harm to minors, no spam,
  no impersonation, no interfering with others' use of the platform.
- **Google Workspace Integration**: data access governed by Google's API
  Services User Data Policy, with user revocation options.
- **User Content**: users retain ownership but grant Composio a worldwide,
  non-exclusive, royalty-free license to use submitted content.
- **Termination**: Composio may suspend access without notice, for any
  reason.
- **Warranties Disclaimer**: platform provided "AS IS."
- **Liability Limits**: consequential damages and lost profits excluded.
- **Governing Law**: Delaware.
- **Co-Marketing**: "Customers agree to participate in marketing activities
  using their name and logo" (scope/applicability — e.g. whether this
  applies to free/API-only usage vs. a separate enterprise order form — was
  not determined).
- **Contact**: tech@composio.dev.

---

## ⚠️ Direct contradiction between the two extractions

Extraction #1 reads as: **commercial use is excluded** from the license.
Extraction #2 reads as: **commercial use is included**, only resale/data
mining is excluded.

These cannot both be accurate paraphrases of the same clause. This is the
central open question for whether Matimo's BYOK-based `@matimo/composio`
wrapper is compliant, and it was not resolved by either fetch. **Read the
primary source directly rather than trusting either summary above.**

---

## Fair Usage Policy — searched for, not found as a published document

The ToS references "our Fair Usage Policy" twice (see quotes above) as the
standard access/usage is measured against, but **the phrase is not a
hyperlink** on the `/terms` page (confirmed by direct inspection of every
link on that page — only two hyperlinks exist on the whole page: composio.dev
itself and YouTube's ToS). Attempted direct URL guesses that all returned
HTTP 404: `composio.dev/fair-usage-policy`,
`composio.dev/acceptable-use-policy`, `composio.dev/legal/fair-usage-policy`,
`composio.dev/legal`. A `site:composio.dev` search for "fair usage" /
"acceptable use" returned no matching pages either.

**Finding, as of 2026-08-11: no standalone, publicly linked Fair Usage
Policy document could be located.** Either it isn't published publicly (e.g.
shown only inside the authenticated dashboard, or provided on request), or
it doesn't exist as a separate document despite being referenced by name in
a binding contract term. Both possibilities are worth raising directly with
Composio rather than guessing further — a contract term that references an
undefined/unpublished policy is itself a point worth clarifying, since it
means the actual usage limits are effectively undefined from the outside.
