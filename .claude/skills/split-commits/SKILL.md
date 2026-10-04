---
name: split-commits
description: Split a large working tree with many unrelated changes into clean, logical git commits — grouping by concern, excluding named topics (e.g. "don't commit evals"), and safely partial-staging individual files. Use whenever asked to "make logical commits", "group these changes", "commit just the X work", or "split this into commits by feature/concern".
---

Turn a messy working tree (many modified/untracked files spanning several unrelated efforts) into a small number of clean, reviewable commits — each one a single concern — without dragging in excluded topics or unrelated noise.

---

## Hard rule — read this before staging anything

**`git commit -- <pathspec>` does NOT commit the index for those paths. It silently re-stages the full current working-tree content of every matching path first, then commits that.**

This means: if you carefully split a file into "wanted hunk" (staged) + "unwanted hunk" (left unstaged) via `git apply --cached <patch>`, and then run `git commit -m "..." -- path/to/that/file`, git throws away your careful staging and commits the **entire** working-tree diff for that file — wanted and unwanted hunks both. This fails silently: the commit succeeds, looks reasonable in the summary, and the pollution only shows up if you diff the commit against what you intended.

**Consequence:** once ANY file in the commit needs partial-hunk staging (some lines committed now, some left for later/never), you cannot scope that commit with a trailing pathspec. Instead:

1. Build the index to contain **exactly** the target commit's content — nothing more, nothing less:
   - Whole files: `git add <path>`
   - Partial files: `git apply --cached <hunk-patch>` (see "Splitting a single file" below) — never `git add <path>` on a file you're only partially staging.
2. Check for pre-existing staged content that predates this task (e.g. the user had files already staged before you started — `git status` shows these with a non-space index column). Unstage anything not part of the current commit with `git reset -- <path>` (this only touches the index, never the working tree).
3. Verify the index is exactly right: `git diff --cached --stat` for the whole set, and `git diff --cached -- <file>` + `git diff -- <file>` for any partially-staged file (staged half should be the wanted hunk; unstaged remainder should be everything else).
4. Commit with **no trailing pathspec**: `git commit -m "..."`. The index is already correct — trust it.
5. After every commit, sanity-check it actually contains what you think: `git show <sha> --stat` and, for any file you partial-staged, `git show <sha> -- <file>` to eyeball the hunks.

If you skip step 5 and only discover the leak later, see "Recovering from a polluted commit" below — it's fixable without amending.

---

## Workflow

### 1. Inventory everything

```bash
git status --porcelain -uall
```

For a large listing, redirect to a scratchpad file and read it in chunks rather than trying to hold it all in one view.

### 2. Categorize every path (and, within a file, every hunk)

For each changed/untracked path, decide which bucket it belongs to:
- **Concern A / B / C...** — the logical commits you're building. Name them by what they *do* (`feat(x): ...`), not by a plan's phase number (see the project's phase-naming rule if one exists).
- **Excluded topic** — anything the user named as off-limits (e.g. "don't commit anything related to evals"). Exclude the whole file if its *purpose* is that topic; if only *part* of a file's diff relates to it, that's a partial-staging case.
- **Unrelated noise** — changes clearly from a different, unrequested effort (a repo-wide lint/typing sweep, an autoformat, a stray local artifact like a generated approvals/cache file). Leave these uncommitted entirely unless the user asks for them. Don't assume a file belongs to your concern just because it's in the diff — read the diff.

Grep is faster than reading full diffs when a file's category is ambiguous:
```bash
git diff --stat -- <file>              # size signal — a 1-2 line diff is often incidental
git diff -- <file> | grep -ic <keyword>  # e.g. "eval", "skill" — confirms or rules out a topic
```

A file mixing a wanted concern with unrelated noise (e.g. a real feature addition plus a handful of unrelated `# type: ignore` removals from an unrequested mypy sweep) is a **partial-staging case** — see below. Don't pull in the noise just because splitting is more work; don't drop the wanted content just because splitting is annoying.

### 3. Splitting a single file into wanted/unwanted hunks

```bash
git diff -- <file> > /tmp-scratch/full.diff   # use your scratchpad dir, not /tmp
```

Read it with line numbers, identify the hunk(s) you want by their `@@ -old,count +new,count @@` boundaries, and extract them into a standalone patch:

```bash
{ sed -n '1,4p' full.diff; sed -n '<hunk-start>,<hunk-end>p' full.diff; } > wanted.diff
```

Get the line range **exactly right**: a hunk's old/new counts in its `@@ @@` header must match the number of context+removed lines (old) and context+added lines (new) actually included — cutting a hunk short (e.g. missing a trailing blank context line) produces a patch that `git apply` rejects as "corrupt patch". If it's rejected, recount the hunk boundaries in the original diff rather than guessing.

Validate against the **index**, not the working tree — the working tree already contains the target state, so a plain `git apply --check` will conflict:

```bash
git apply --cached --check wanted.diff && git apply --cached wanted.diff
```

This stages only that hunk. The rest of the file's diff remains unstaged in the working tree, available for a later commit or to leave alone.

### 4. Commit each concern

Once the index for one concern is exactly right (step 3 of the Workflow, verified per the Hard Rule above), commit with no pathspec. Use a Conventional Commits type prefix. Whether to add a `Co-Authored-By` trailer is a per-commit call, not a fixed rule — check current session guidance, and when the user has clearly driven the design/direction of a particular commit, lean toward leaving the trailer off rather than defaulting it on. Also check `commitlint`'s header length limit if a pre-commit/commit-msg hook enforces one — a header that reads fine to you can still be rejected for exceeding the character cap; shorten it and retry rather than fighting the hook.

### 5. Repeat, then do a final audit

After all commits are made, confirm the excluded topic never landed:

```bash
git log --oneline <base>..HEAD
git log -p <base>..HEAD -- . | grep -i <excluded-keyword>   # should return nothing
git status --porcelain -uall   # whatever's left should be exactly what you intentionally excluded
```

---

## Recovering from a polluted commit

If you discover after the fact that a commit swept in unwanted content (most commonly: hit the Hard Rule above), don't amend — this repo's convention is new commits over amend unless the user explicitly asks for amend/rebase. Instead:

1. Diff the polluted file between the commit and its parent to isolate exactly which hunks shouldn't be there:
   ```bash
   git diff <commit>^:path/to/file <commit>:path/to/file
   ```
2. Build a patch of *just* those unwanted hunks (same extraction technique as above) and reverse-apply it to undo them, in both the index and working tree:
   ```bash
   git apply -R unwanted.diff
   git add path/to/file
   ```
3. Commit that as its own small corrective commit (e.g. `chore: revert unrelated X pulled in by prior commit`), explaining briefly why (so `git log` stays legible, not just a mystery revert).

This is recoverable, not destructive: the original content still exists in the polluted commit's history if anyone needs to recover it later (e.g. to give it its own proper commit).

---

## Notes

- Files already staged before you started (check `git status` at the very beginning) reflect the user's own prior actions — don't fold them into your commits and don't unstage them permanently; a plain `git reset -- <path>` during your work is fine (index-only), just make sure whatever you don't touch ends up back in whatever state makes sense, and mention anything you deliberately left alone in your final summary.
- When a chunk of work is genuinely one cohesive change split across TS + Python (a mirrored feature, same behavior in both SDKs), that's one commit, not two — don't over-split just to hit a smaller diff size.
- Prefer categorizing by *why the code changed* over *where it lives*: a doc update that documents a new feature belongs with that feature's commit, not lumped into a generic "docs" commit, unless the doc change is itself a standalone concern (e.g. a full restructuring unrelated to any single feature in this batch).
