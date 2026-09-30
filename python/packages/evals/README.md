# matimo-evals

Python mirror of `@matimo/evals` (`typescript/packages/evals/`) — same deterministic tool-selection eval, same fixture format, ported 1:1. See that package's README for the full design rationale (why TF-IDF, fixture format, `top_k` conventions, known limitations).

## Running it

```bash
cd python
uv run matimo-eval-tool-selection
# or
make eval-tool-selection
```

## Structure

```
src/matimo_evals/
  tool_selection/
    tool_selection_matcher.py   # TF-IDF ranking, wraps matimo.core.tfidf_embedding
    tool_corpus.py              # loads + validates every packages/*/src/*/tools/**/definition.yaml
    fixtures.py                 # loads every packages/*/evals/*.eval.yaml
    run_eval.py                 # orchestrates a run, scoring + reporting
  scoring/
    precision_recall.py         # shared scoring: precision (top-1) + recall (top-k band)
  cli.py                        # `matimo-eval-tool-selection` entrypoint
```

Unlike the TypeScript SDK, Python has no `@matimo/composio` package yet, so every tool in this workspace is hand-authored and every one needs a fixture — no exclusion list.
