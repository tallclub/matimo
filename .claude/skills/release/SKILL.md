---
name: release
description: Cut a Matimo release — assess changes since the last tag, propose a semver bump, update all package.json versions in lockstep, verify build/tests/validation pass, commit, tag, and draft release notes. Use when asked to release, ship, cut a version, or publish a new Matimo version.
---

Prepare release **$ARGUMENTS**. If no version given, inspect history and propose the next semver bump.

---

## Step 1 — Assess changes since the last tag

```bash
git describe --tags --abbrev=0
git log $(git describe --tags --abbrev=0)..HEAD --oneline
```

Classify by conventional-commit prefix:
- `fix:` / `hotfix:` → patch bump
- `feat:` → minor bump
- `feat!:` / `BREAKING CHANGE:` in body → major bump

Take the highest-severity bump found.

---

## Step 2 — Confirm with the user

State the proposed version and why (e.g. "v0.1.2 → v0.2.0: 3 feat commits found, no breaking changes"). **Wait for confirmation before changing any files.**

---

## Step 3 — Bump versions in lockstep

All packages share one version number. Update `version` in:

```
package.json                      (root)
packages/core/package.json
packages/cli/package.json
packages/slack/package.json
packages/gmail/package.json
packages/github/package.json
packages/hubspot/package.json
packages/notion/package.json
packages/postgres/package.json
packages/twilio/package.json
packages/mailchimp/package.json
```
Plus any packages added since the last release — check `pnpm-workspace.yaml` for the current authoritative list.

Also check for any pinned (non-`workspace:*`) cross-package version references that need updating.

---

## Step 4 — Verify everything passes

```bash
pnpm install
pnpm build
pnpm test
pnpm validate-tools
pnpm lint
```

**Do not proceed if anything fails.** Fix issues, re-run, only continue once green.

---

## Step 5 — Commit the version bump

```bash
git add package.json packages/*/package.json
git commit -m "chore: release vX.Y.Z"
```

---

## Step 6 — Tag the release

```bash
git tag vX.Y.Z
```

Show the push command but **do not run it** — ask the user to confirm first:
```bash
git push && git push --tags
```

---

## Step 7 — Draft release notes

Summarize the commits from Step 1, grouped:

```markdown
## What's New in vX.Y.Z

### New tools / packages
- ...

### Enhancements
- ...

### Bug fixes
- ...

### Breaking changes
- ... (omit section if none)
```

Present this to the user as ready-to-paste GitHub release markdown.
