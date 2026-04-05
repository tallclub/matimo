# @matimo/github — GitHub Tools for Matimo

Comprehensive GitHub REST API integration for Matimo. Execute 22 focused tools across search, issues, repositories, pull requests, commits, collaborators, releases, and code scanning.

## Installation

```bash
npm install @matimo/github
# or
pnpm add @matimo/github
```

## Quick Start

### Factory Pattern

```typescript
import { MatimoInstance } from '@matimo/core';

const matimo = await MatimoInstance.init({
  autoDiscover: true  // Auto-loads @matimo/github from node_modules
});

// Search repositories
const repos = await matimo.execute('github-search-repositories', {
  query: 'language:typescript stars:>1000'
});

// Create issue
const issue = await matimo.execute('github-create-issue', {
  owner: 'nodejs',
  repo: 'node',
  title: 'Bug: Memory leak in event loop',
  body: 'Description of the issue...'
});

// Merge pull request
const merged = await matimo.execute('github-merge-pull-request', {
  owner: 'nodejs',
  repo: 'node',
  pull_number: 42,
  merge_method: 'squash'
});
```

### Decorator Pattern

```typescript
import { MatimoInstance, setGlobalMatimoInstance, tool } from '@matimo/core';

const matimo = await MatimoInstance.init({ autoDiscover: true });
setGlobalMatimoInstance(matimo);

class GitHubAgent {
  @tool('github-search-repositories')
  async searchRepos(query: string) { /* auto-executed */ }

  @tool('github-create-issue')
  async createIssue(owner: string, repo: string, title: string, body: string) {
    /* auto-executed */
  }
}

const agent = new GitHubAgent();
await agent.searchRepos('language:typescript');
```

### LangChain Integration

```typescript
import { MatimoInstance } from '@matimo/core';

const matimo = await MatimoInstance.init({ autoDiscover: true });

// Get all GitHub tools as LangChain function schemas
const ghTools = matimo.listTools()
  .filter(t => t.name.startsWith('github-'))
  .map(tool => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: {
        type: 'object',
        properties: tool.parameters || {},
        required: Object.entries(tool.parameters || {})
          .filter(([_, p]) => p.required)
          .map(([name]) => name)
      }
    }
  }));

// Use with your LLM + function calling
```

## Available Tools

| Tool | Description | HTTP Method |
|------|-------------|------------|
| **Search** | | |
| `github-search-repositories` | Search repositories by name, stars, topics | GET |
| `github-search-code` | Search code across repositories | GET |
| `github-search-issues` | Search issues and pull requests | GET |
| `github-search-users` | Search users by location, followers | GET |
| **Issues** | | |
| `github-list-issues` | List repository issues with filtering | GET |
| `github-create-issue` | Create a new issue | POST |
| `github-get-issue` | Get specific issue details | GET |
| `github-update-issue` | Update issue title, body, state | PATCH |
| **Repositories** | | |
| `github-list-repositories` | List organization/user repositories | GET |
| `github-create-repository` | Create new repository | POST |
| `github-get-repository` | Get repository details (120+ fields) | GET |
| `github-delete-repository` | Delete repository (admin only) | DELETE |
| **Pull Requests** | | |
| `github-list-pull-requests` | List pull requests with filtering | GET |
| `github-create-pull-request` | Create new pull request | POST |
| `github-merge-pull-request` | Merge pull request | PUT |
| **Commits** | | |
| `github-list-commits` | List repository commits | GET |
| **Collaborators** | | |
| `github-list-collaborators` | List repository collaborators | GET |
| `github-add-collaborator` | Add user as collaborator | PUT |
| **Releases** | | |
| `github-list-releases` | List repository releases | GET |
| `github-create-release` | Create new release | POST |
| **Code Scanning** | | |
| `github-list-code-alerts` | List security scanning alerts | GET |
| `github-update-code-alert` | Update alert status (dismiss/reopen) | PATCH |

## Authentication

### Personal Access Token (PAT)

1. Create token at https://github.com/settings/tokens
2. Choose scopes:
   - **repo** — Full access to repositories
   - **gist** — Full access to gists
   - **user** — Read user profile
   - **admin:org_hook** — Write organization webhooks (optional)
   - **security_events** — Read code scanning alerts

3. Set environment variable:

```bash
export GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx
```

### Fine-grained Personal Access Token

1. Create at https://github.com/settings/personal-access-tokens/new
2. Minimum required permissions:
   - Repository (selected): Code, Commit, Issues, Pull Requests, Releases, Security events
3. Set environment variable:

```bash
export GITHUB_TOKEN=github_pat_xxxxxxxxxxxxxxxx
```

### OAuth2 (GitHub App)

1. Create GitHub App at https://github.com/settings/apps
2. Get Client ID from app settings
3. Use OAuth2Handler for authorization:

```typescript
import { OAuth2Handler } from '@matimo/core';

const handler = new OAuth2Handler('github');
const { authorize_url, state } = handler.getAuthorizationUrl();

// Redirect user to authorize_url
// Handle callback with authorization code
const tokens = await handler.exchangeAuthorizationCode(code, state);

// tokens.access_token ready for use
process.env.GITHUB_TOKEN = tokens.access_token;
```

## Rate Limiting

GitHub has multiple rate limits:

- **Primary**: 5,000 requests/hour (authenticated), 60/hour (unauthenticated)
- **Search**: 30 requests/minute (general), 10 requests/minute (code search)
- **Secondary**: 100 concurrent requests, 900 points/minute

### Handling Rate Limits

Tools include exponential backoff and retry logic. When you hit rate limits:
- Get reset time from response header: `x-ratelimit-reset` (Unix timestamp)
- Wait until reset time, then retry
- Check remaining quota with `x-ratelimit-remaining` header

```typescript
// Automatic retry with exponential backoff
try {
  const result = await matimo.execute('github-search-code', {
    query: 'language:python'
  });
} catch (error) {
  // If 429 (rate limited), solution automatically retries with backoff
  // If still fails after retries, throws MatimoError with details
}
```

## Error Handling

All tools throw `MatimoError` with structured error information:

```typescript
import { MatimoError } from '@matimo/core';

try {
  await matimo.execute('github-create-issue', { /* ... */ });
} catch (error) {
  if (error instanceof MatimoError) {
    console.error('Code:', error.code);           // EXECUTION_FAILED
    console.error('Message:', error.message);     // User-friendly message
    console.error('Details:', error.details);     // { statusCode: 404, toolName: '...' }
    
    // Handle specific scenarios
    if (error.code === 'EXECUTION_FAILED' && error.details?.statusCode === 404) {
      console.error('Repository not found');
    }
  }
}
```

Common GitHub API errors:
- **401 Unauthorized** — Invalid or expired token
- **403 Forbidden** — Insufficient permissions, rate limited, or GHSA disabled
- **404 Not Found** — Repository, issue, or user doesn't exist
- **422 Unprocessable Entity** — Invalid parameters
- **429 Too Many Requests** — Rate limit exceeded

## Examples

### Search and Report

```typescript
const matimo = await MatimoInstance.init({ autoDiscover: true });

// Find high-quality TypeScript projects
const results = await matimo.execute('github-search-repositories', {
  query: 'language:typescript stars:>5000'
});

console.log(`Found ${results.total_count} matching repositories`);
results.items?.slice(0, 5).forEach(repo => {
  console.log(`- ${repo.full_name}: ⭐ ${repo.stargazers_count}`);
});
```

### Create and Manage Issues

```typescript
// Create an issue
const issue = await matimo.execute('github-create-issue', {
  owner: 'myorg',
  repo: 'myrepo',
  title: 'Feature request: Add dark mode',
  body: '# Description\nUsers want a dark mode theme\n\n# Solution\nImplement CSS dark mode support'
});

console.log(`Created issue #${issue.number}: ${issue.html_url}`);

// Update the issue
await matimo.execute('github-update-issue', {
  owner: 'myorg',
  repo: 'myrepo',
  issue_number: issue.number,
  state: 'closed'
});
```

### Pull Request Workflow

```typescript
// List open PRs
const prs = await matimo.execute('github-list-pull-requests', {
  owner: 'kubernetes',
  repo: 'kubernetes',
  state: 'open',
  sort: 'updated'
});

// Merge a PR
if (prs.length > 0) {
  const merged = await matimo.execute('github-merge-pull-request', {
    owner: 'kubernetes',
    repo: 'kubernetes',
    pull_number: prs[0].number,
    merge_method: 'squash'
  });
  
  console.log(`Merged as commit ${merged.sha}`);
}
```

### Security Scanning

```typescript
// List critical security alerts
const alerts = await matimo.execute('github-list-code-alerts', {
  owner: 'myorg',
  repo: 'myrepo',
  state: 'open',
  severity: 'critical'
});

// Dismiss false positives
for (const alert of alerts.filter(a => a.rule.id === 'false-positive')) {
  await matimo.execute('github-update-code-alert', {
    owner: 'myorg',
    repo: 'myrepo',
    alert_number: alert.number,
    state: 'dismissed',
    dismissed_reason: 'false positive'
  });
}
```

## Troubleshooting

### "401 Unauthorized"
- Verify `GITHUB_TOKEN` is set: `echo $GITHUB_TOKEN`
- Token may be expired or revoked — create new one
- For fine-grained PAT, verify it hasn't been expired

### "403 Forbidden" for private repos
- Ensure token has `repo` scope
- For fine-grained tokens, ensure organization/repository is added
- Check GitHub Advanced Security is enabled (for code scanning)

### "404 Not Found"
- Verify owner/repo names are correct
- Check repository exists and is accessible with token
- For code scanning, ensure Advanced Security is enabled

### Rate limited (429)
- Wait for `x-ratelimit-reset` timestamp
- Consider implementing request queuing for bulk operations
- Use search filters to reduce unnecessary API calls
- For Enterprise, higher rate limits (15,000/hour) available

### Code scanning not available
- Requires GitHub Advanced Security (Enterprise or public repos with premium)
- Verify `security_events:read` scope in token
- Check repository has security scanning enabled

## API Reference

### Parameters and Response Schemas

Each tool accepts specific parameters documented in its definition. Common patterns:

**Pagination**: `per_page` (1-100, default 30) and `page` (starting at 1)
**Filtering**: `state`, `sort`, `direction`, `labels`, `assignee` (varies by tool)
**Templating**: URL parameters use `{placeholders}` syntax

Responses are validated against `output_schema` defined in each tool. All responses include status codes in `x-github-` headers for monitoring rate limits.

### HTTP Headers

All requests include:
```
Accept: application/vnd.github+json
Authorization: Bearer {GITHUB_TOKEN}
X-GitHub-Api-Version: 2022-11-28
Content-Type: application/json (for POST/PATCH/PUT)
```

Rate limit headers in all responses:
```
x-ratelimit-limit: 5000
x-ratelimit-remaining: 4999
x-ratelimit-reset: 1234567890
x-ratelimit-used: 1
```

## Contributing

For bug reports, feature requests, or tool improvements, visit the main Matimo repository CONTRIBUTING guidelines.

## License

Part of the Matimo ecosystem. See main repository for licensing information.

---

**Need help?** Check the [Matimo documentation](https://matimo.dev) or open an issue in the main repository.
