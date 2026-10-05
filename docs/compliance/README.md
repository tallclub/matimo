# Compliance Snapshots

Dated evidence and reference material for Matimo's dependency on third-party
platforms (currently: Composio). Not legal advice, and not a substitute for
counsel reviewing primary sources directly.

## ⚠️ Known reliability issue with the AI-extracted snapshots in this folder

The `*-tos-snapshot.md` and `*-privacy-snapshot.md` files in this folder were
produced by fetching Composio's published pages through an AI summarization
tool, **not** by a verbatim capture (print-to-PDF / full-page screenshot /
view-source save). While preparing these files, the same Terms of Service URL
was fetched twice in one sitting and produced two contradictory summaries of
the same license clause — one describing commercial use as excluded, the
other describing it as included with only resale/data-mining excluded. See
`2026-08-11-composio-tos-snapshot.md` for both extractions side by side.

**Do not rely on the paraphrased text in these files to answer the "is BYOK
commercial use compliant" question.** They're useful as a dated pointer to
what was published and when, and as a starting point for research — not as
evidence of exact clause wording. Before this matters for a real decision,
someone should:

1. Open the primary URLs directly in a browser and read the actual clause
   text (not a model's summary of it).
2. Save a verbatim, dated capture (print-to-PDF or full-page screenshot) for
   the actual evidentiary record — an AI-paraphrased `.md` file is not
   sufficient for that purpose.
3. If material, loop in counsel before treating any interpretation as settled.

## Files

- `2026-08-11-composio-tos-snapshot.md` — Terms of Service, two independent
  AI extractions (contradictory on the commercial-use clause — see warning
  above), fetched 2026-08-11
- `2026-08-11-composio-privacy-snapshot.md` — Privacy Policy, AI extraction,
  fetched 2026-08-11
- `2026-08-11-byok-precedent.md` — Evidence that "bring your own Composio API
  key" is a standard, Composio-documented integration pattern used by other
  platforms (Langflow, KiloClaw) and by Composio's own toolkit docs (Placekey)
