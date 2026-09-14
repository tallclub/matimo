---
name: release-engineer
description: Matimo release engineering skill. Covers the full release lifecycle — version bump, branch/PR creation, quality gates, Copilot review, documentation updates, and tag-triggered publish. Use when preparing any Matimo release.
metadata:
  category: "Release Management"
  difficulty: "advanced"
  domain: "Matimo SDK Release"
  user-invokable: "true"
  invocation: "Use when cutting a Matimo release: alpha, patch, or stable"
---

# Matimo Release Engineering Skill

## Repository Facts (always read, never assume)

| Item | How to Verify |
|------|---|
| Current TS version | Read all 11 `typescript/packages/*/package.json` — must match exactly |
| Current Python version | Read all 12 `python/packages/*/pyproject.toml` — note: `core` may differ from providers |
| Release triggers | TS: `git tag v*.*.*` → npm-release.yml; Python: `git tag python/v*` → publish-python.yml |
| CI branch targets | See `.github/workflows/ci.yml` on_push branches |
| Coverage requirement | **95%+ both SDKs** (enforced in CI; Python fails under 95%) |
| Test count | Always read from `ci.yml` test-python matrix and pnpm test output — do not assume |

---

## Part 1 — Version Numbering Convention

### TypeScript  
- Pre-release: `0.X.Y-alpha.N` (example: `0.1.0-alpha.15`)
- Patch: `0.X.Y-alpha.N-patch.M` (example: `0.1.0-alpha.14-patch.2`)
- Stable: `0.X.Y` (example: `1.0.0`)

All 11 `typescript/packages/*/package.json` files must have **identical version strings**.

### Python (PEP 440)
| Pattern | Example |
|---|---|
| Pre-release | `0.X.YaN` (e.g. `0.1.0a15` maps to TS `0.1.0-alpha.15`) |
| Patch | `0.X.YaN.postM` (e.g. `0.1.0a14.post2`) |
| Stable | `0.X.Y` (e.g. `1.0.0`) |

All 12 `python/packages/*/pyproject.toml` files must have the same base version. **Exception**: `python/packages/core` may have a `.postN` increment separate from other packages; read it before assuming consistency.

**Files to bump every release:**
```
typescript/packages/core/package.json
typescript/packages/cli/package.json
typescript/packages/slack/package.json
typescript/packages/github/package.json
typescript/packages/gmail/package.json
typescript/packages/notion/package.json
typescript/packages/postgres/package.json
typescript/packages/twilio/package.json
typescript/packages/hubspot/package.json
typescript/packages/mailchimp/package.json
typescript/packages/bruno/package.json

python/packages/core/pyproject.toml
python/packages/cli/pyproject.toml
python/packages/matimo/pyproject.toml
python/packages/slack/pyproject.toml
python/packages/github/pyproject.toml
python/packages/gmail/pyproject.toml
python/packages/notion/pyproject.toml
python/packages/postgres/pyproject.toml
python/packages/twilio/pyproject.toml
python/packages/hubspot/pyproject.toml
python/packages/mailchimp/pyproject.toml
python/packages/bruno/pyproject.toml
```

---

## Part 2 — Quality Gates (All Must Pass Before PR)

Run these commands from their respective directories and confirm zero failures.

### TypeScript (cwd: `typescript/`)
```bash
pnpm install --frozen-lockfile          # dependencies locked
pnpm lint                               # ESLint — zero warnings
pnpm format:check                       # Prettier — zero diffs
pnpm build                              # tsc — zero errors
pnpm test:coverage                      # Jest — 95%+ all thresholds
pnpm validate-tools                     # YAML tool schema — all valid
```

**Expected thresholds** (from `jest.config.cjs`):
```
branches: 87, functions: 97, lines: 95, statements: 95
```

### Python (cwd: `python/`)
```bash
uv sync --group dev
uv run ruff check packages/             # zero lint errors
uv run pytest packages/core/tests/ \
  --cov=packages/core/src/matimo \
  --cov-fail-under=95 -q --tb=short    # 95%+ coverage
```

### Security checks (both)
- No hardcoded secrets (`grep -r "sk-\|SLACK_BOT_TOKEN\s*=" --include="*.ts" --include="*.py"`)
- No `console.log` in `packages/core/src/` or `python/packages/core/src/`
- No `Any` / `any` without `# noqa: ANN401` + reason comment
- OWASP Top 10 patterns: no eval, no shell injection, no SQL injection

---

## Part 3 — Release Branch Convention

```
release/vN.N.N-alpha.N      # e.g. release/v0.1.0-alpha.15
release/vN.N.N-patch.N      # e.g. release/v0.1.0-alpha.14-patch.2
release/vN.N.N              # stable only
```

**Branch from**: `main` (or `develop` if a separate develop branch is active).  
Check current HEAD: confirm no unrelated WIP changes on the branch.

---

## Part 4 — PR Template Requirements

PR title format: `release: vN.N.N-alpha.N — <one-line theme>`

PR description must include all sections from `.github/PULL_REQUEST_TEMPLATE.md`:
- [ ] Type of change: **Release**
- [ ] All tests passing
- [ ] Coverage maintained (>95%)
- [ ] Code formatted
- [ ] Linting passes
- [ ] Documentation updated
- [ ] No console.log statements
- [ ] No hardcoded secrets
- [ ] Tool YAML validated

PR target branch: **`main`**

---

## Part 5 — Documentation Files to Update

Every release touches these files (verify each one):

| File | What to update |
|------|---------------|
| `docs/RELEASES.md` | Prepend new release block at top: version, date, features, tools table, examples, requirements |
| `docs/ROADMAP.md` | Move completed items to ✅, update "Current Status" header, uncheck next-release items |
| `docs/index.md` | Update "latest version" badge/mention if present |
| `docs/mcp/QUICK_REFERENCE.md` | Update version references if any |
| `docs/mcp/SETUP_GUIDE.md` | Update install commands (`npm install matimo@vN`) if version pinned |
| `typescript/packages/core/CHANGELOG.md` | If file exists: prepend new version block |
| `README.md` (root) | Update "Latest Release" or badge if present |
| `landing-page/index.html` | Update version text if hardcoded |

**Do NOT modify** auto-generated files: `pnpm-lock.yaml`, `coverage/`, `dist/`, `_site/`.

---

## Part 6 — Copilot Review Handling

After PR is created:
1. Wait for Copilot review comments on the PR.
2. For each comment: read → understand → implement fix in the affected file.
3. Run the relevant quality gate again for the changed module.
4. Commit fixes with message: `fix(release): address Copilot review — <summary>`
5. Re-request review after all comments are resolved.

**Never dismiss a comment without either fixing it or explaining why it does not apply.**

---

## Part 7 — Git Tagging & Publish

Only after the PR is **merged to main**:

```bash
# TypeScript publish — triggers npm-release.yml
git tag v0.1.0-alpha.15
git push origin v0.1.0-alpha.15

# Python publish — triggers publish-python.yml
git tag python/v0.1.0a15
git push origin python/v0.1.0a15
```

Verify CI passes on both tag pushes before declaring release complete.

---

## Part 8 — Security Audit Checklist

Run before every release:

```bash
# Secrets scan
grep -rn "token\s*=\s*['\"]" typescript/packages/core/src/ python/packages/core/src/
grep -rn "password\s*=\s*['\"]" typescript/packages/core/src/ python/packages/core/src/

# No shell=True in Python (subprocess injection risk)
grep -rn "shell=True" python/packages/

# No eval/Function constructor in TypeScript
grep -rn "eval(\|new Function(" typescript/packages/core/src/

# Dependency audit
cd typescript && pnpm audit --audit-level=high
cd python && uv run pip-audit 2>/dev/null || echo "install pip-audit if needed"
```

All `high` or `critical` vulnerabilities must be resolved before tagging.

---

## Part 9 — Commit Message Convention

```
release: vN.N.N-alpha.N — <one-line theme>
chore(release): bump versions to vN.N.N-alpha.N
docs(release): update RELEASES.md and ROADMAP.md for vN.N.N-alpha.N
fix(release): address Copilot review — <brief description>
```

---

## Part 10 — Common Pitfalls (Do Not Repeat)

| Pitfall | Guard |
|---------|-------|
| Python pyproject.toml versions out of sync | Read ALL 12 files; verify versions match or have deliberate reason |
| Assumed Python version consistency | `python/packages/core` may have `.postN` that others don't — always read the actual files first |
| Skipped version verification | Use `grep "version" <file>` on ALL 22 files before and after bumping |
| Release notes missing tool count | Always derive from actual commits: `git log main..HEAD --oneline` |
| Roadmap not updated to reflect release | Must update "Current Status" section with actual released version |
| PR merged before Copilot review | Always wait for and resolve all review comments |
| Tag pushed before PR merged | Tags trigger CI publish — only tag after merge to main is confirmed |
| Forgot a provider package file | Verify the full count: 11 TS + 12 Python = 23 total files (core may differ) |
