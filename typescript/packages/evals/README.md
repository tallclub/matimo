# @matimo/evals

Evaluation harness for Matimo tool-selection and argument correctness — the model-in-the-loop layer above the deterministic, mocked unit test suite.

Matimo's ~3,400+ unit/integration tests confirm each tool executes correctly in isolation. None of them confirm an LLM can actually *pick* the right tool from its description, or supply the right required arguments, once that tool sits in a catalog of hundreds. This package closes that gap, starting with a deterministic tool-selection check that runs in CI on every PR.

## What it checks

For each fixture (one YAML file per tool, co-located at `packages/<provider>/evals/<tool>.eval.yaml`):

1. **Tool selection** — rank every tool in the live workspace catalog against the fixture's prompt using TF-IDF cosine similarity (`ToolSelectionMatcher`, reusing `TfIdfEmbeddingProvider` from `@matimo/core` — the same mechanism `SkillRegistry.search({ semantic: true })` already uses for skill discovery). Assert the fixture's own tool ranks within its declared `top_k` (default `1`, i.e. strict top-1).
2. **Argument correctness** — assert every `expected_required_params` entry is actually `required: true` on that tool's schema. Pure structural check, no matcher involved.

No model calls, no API cost, sub-second for the whole catalog — genuinely viable to run on every PR.

## Running it

```bash
cd typescript
pnpm --filter @matimo/evals run eval:tool-selection
```

## Fixture format

```yaml
tool: slack-get-user
cases:
  - prompt: "Retrieve detailed information about a Slack user"
    expected_required_params: [user]
    # top_k: 2   # only set this for a documented, genuine near-duplicate — see below
```

- `prompt` — a natural-language request a user might type. Prefer wording that mirrors the tool's own vocabulary (name + description terms) — TF-IDF is a bag-of-words matcher, so naturalistic embellishment that doesn't overlap with the tool's own terms tends to *dilute* the signal rather than help it.
- `expected_required_params` — optional; every name listed must be `required: true` in the tool's `parameters`.
- `top_k` — optional, defaults to `1`. Only widen this for a **documented** near-duplicate or CRUD-cluster case (e.g. `hubspot-create-deal` sharing all its object-noun vocabulary with `hubspot-get-deal`/`hubspot-update-deal`/`hubspot-delete-deal` — create/get/update/delete carry almost no TF-IDF weight since they recur across the whole catalog). Add a comment above the case explaining *why* it's ambiguous — a bare `top_k: 4` with no explanation just hides a real problem.

## Adding fixtures for a new tool

Every hand-authored tool (i.e. everything outside `@matimo/composio`'s auto-routed catalog) needs a fixture — see `test/unit/fixture-coverage.test.ts`, which fails CI if one is missing. Composio's ~450 auto-generated tools are excluded from this requirement; see that test for the current scope and the open follow-up on Composio coverage.

## Known limitations (v1)

- Fixture prompts here were drafted mechanically from each tool's own description, then hand-tuned only where the mechanical version failed. They're a reasonable deterministic regression check, not a substitute for real usage data — a good next pass is diversifying prompt phrasing per tool.
- TF-IDF cannot reliably distinguish same-resource CRUD tools (create/get/update/delete on the same object) purely by vocabulary — that's a structural limit of a bag-of-words matcher, not a fixture-writing problem. Those cases use `top_k` deliberately; don't "fix" them by padding prompts with more of the same shared nouns.
- This surfaced a real duplicate in the tool catalog: `packages/slack/tools/get-user` (`name: slack-get-user`) and `packages/slack/tools/slack_get_user_info` are near-identical — the latter's own description says `(Alias: slack-get-user)`. Worth a follow-up to deprecate one.

## Structure

```
src/
  tool-selection/
    tool-selection-matcher.ts   # TF-IDF ranking, wraps @matimo/core's TfIdfEmbeddingProvider
    tool-corpus.ts              # loads + validates every packages/*/tools/**/definition.yaml
    fixtures.ts                 # loads every packages/*/evals/*.eval.yaml
    run-eval.ts                 # orchestrates a run, scoring + reporting (testable, no CLI concerns)
  scoring/
    precision-recall.ts         # shared scoring: precision (top-1) + recall (top-k band)
  cli.ts                        # thin `pnpm eval:tool-selection` entrypoint
```

Golden-trajectory replay (multi-turn, model-in-the-loop) and the recalibration runbook are tracked as separate follow-on work, not part of this package yet.
