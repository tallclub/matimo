---
name: github
description: "Complete guide to all GitHub tools — search, issues, pull requests, repositories, releases, collaborators, and security alerts."
version: "1.0.0"
license: "MIT"
metadata:
  category: "Development"
  difficulty: "beginner"
  apply-to: "github-search-code github-search-issues github-search-repositories github-search-users github-create-issue github-get-issue github-list-issues github-update-issue github-create-pull-request github-list-pull-requests github-merge-pull-request github-create-repository github-get-repository github-delete-repository github-list-repositories github-add-collaborator github-list-collaborators github-list-commits github-create-release github-list-releases github-list-code-alerts github-update-code-alert"
  author: "Matimo"
  tags: "github,git,issues,pull-requests,repositories,search"
---

# GitHub

Complete guide to using Matimo's GitHub tools for search, issues, PRs, repositories, releases, and security.

## All Available Tools

| Tool | Purpose | Category |
|------|---------|----------|
| `github-search-code` | Search code across repositories | Search |
| `github-search-issues` | Search issues and pull requests | Search |
| `github-search-repositories` | Find repositories | Search |
| `github-search-users` | Find users and organizations | Search |
| `github-create-issue` | Create a new issue | Issues |
| `github-get-issue` | Get issue details | Issues |
| `github-list-issues` | List issues for a repository | Issues |
| `github-update-issue` | Update an existing issue | Issues |
| `github-create-pull-request` | Create a pull request | Pull Requests |
| `github-list-pull-requests` | List PRs for a repository | Pull Requests |
| `github-merge-pull-request` | Merge a pull request | Pull Requests |
| `github-create-repository` | Create a new repository | Repos |
| `github-get-repository` | Get repository details | Repos |
| `github-delete-repository` | Delete a repository (destructive!) | Repos |
| `github-list-repositories` | List repos for a user/org | Repos |
| `github-add-collaborator` | Add a collaborator | Repos |
| `github-list-collaborators` | List current collaborators | Repos |
| `github-list-commits` | List recent commits | Repos |
| `github-create-release` | Create a tagged release | Releases |
| `github-list-releases` | List existing releases | Releases |
| `github-list-code-alerts` | View security/code scanning alerts | Security |
| `github-update-code-alert` | Dismiss or acknowledge alerts | Security |

## Authentication

Requires `GITHUB_TOKEN` environment variable with appropriate scopes (`repo`, `read:org`, `read:user`).

---

## Search

### Code Search

Use `github-search-code` with query qualifiers:

| Qualifier | Example | Purpose |
|-----------|---------|---------|
| `repo:owner/name` | `repo:acme/api` | Specific repo |
| `org:name` | `org:acme` | Across an org |
| `path:dir` | `path:src/utils` | In directory |
| `filename:name` | `filename:package.json` | By filename |
| `extension:ext` | `extension:ts` | By extension |
| `language:lang` | `language:typescript` | By language |

Use `-` prefix for negation: `-path:test -path:node_modules`.

### Issue & PR Search

Use `github-search-issues` with qualifiers: `is:issue`/`is:pr`, `state:open`/`state:closed`, `label:name`, `assignee:user`, `author:user`.

### Repository Search

Use `github-search-repositories` with: `stars:>N`, `language:lang`, `topic:name`, `pushed:>date`.

### Search Tips

1. Start broad, then narrow with qualifiers
2. Use negation (`-`) to exclude noise
3. Quote `"exact phrases"` for multi-word searches
4. Rate limit: 30 requests/minute for authenticated users

---

## Issues

### Creating Issues

Use `github-create-issue` with `owner`, `repo`, `title` (required), and optional `body`, `labels`, `assignees`.

**Best practices:**
- Descriptive titles: "Login page returns 500 on invalid email" not "Bug"
- Add labels for categorization
- Reference related issues with `#number`
- Assign to the right person

### Updating Issues

Use `github-update-issue` to change title, body, state (`open`/`closed`), labels, assignees, or milestone.

### Listing Issues

Use `github-list-issues` with filters: `state` (open/closed/all), `labels`, `assignee`, `sort` (created/updated/comments), `direction` (asc/desc).

---

## Pull Requests

### Creating PRs

Use `github-create-pull-request` with `owner`, `repo`, `title`, `head` (source branch), `base` (target branch), and optional `body`, `draft`.

**Best practices:**
- Reference the issue: "Fixes #42"
- Use draft PRs for work-in-progress
- Keep PRs focused on a single change

### Merging PRs

Use `github-merge-pull-request` with `owner`, `repo`, `pull_number`, and optional `merge_method` (`merge`/`squash`/`rebase`).

**Pre-merge checklist:** CI passing, reviews approved, no conflicts, branch up to date.

---

## Repositories

### Creating Repos

```json
{
  "owner": "acme",
  "name": "new-service",
  "description": "Backend service for payment processing",
  "private": true,
  "auto_init": true
}
```

Always add a description. Start private, go public when ready. Use `auto_init: true` for README.

### Collaborators

Use `github-add-collaborator` with `owner`, `repo`, `username`, and `permission` (`pull`/`push`/`admin`). Always use least-privilege.

### Releases

Use `github-create-release` with `owner`, `repo`, `tag_name`, `name`, `body`, and optional `draft`/`prerelease`. Follow semantic versioning.

---

## Security

Use `github-list-code-alerts` to review Dependabot and CodeQL findings. Use `github-update-code-alert` to dismiss with reason (`false_positive`, `wont_fix`, `used_in_tests`).

**Triage workflow:** List alerts → assess severity → dismiss false positives → create issues for real vulnerabilities.

---

## Common Workflows

### Bug Fix Flow
1. Search issues: `github-search-issues` for duplicates
2. Create issue: `github-create-issue`
3. Create PR: `github-create-pull-request` referencing the issue
4. Merge: `github-merge-pull-request`
5. Update issue: close with comment

### Release Flow
1. List PRs merged since last release
2. Create release with changelog
3. List and triage any new security alerts

---

## Common Errors

| Error | Cause | Fix |
|-------|-------|-----|
| 404 `Not Found` | Repo doesn't exist or no access | Check owner/repo and token scopes |
| 422 `Validation Failed` | Missing required fields or bad syntax | Check parameters |
| 403 `Rate limit exceeded` | Too many requests | Wait and retry; use conditional requests |
| 409 `Merge conflict` | PR has conflicts | Resolve conflicts before merging |
