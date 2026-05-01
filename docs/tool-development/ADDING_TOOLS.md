# Adding Tools to Matimo

Tools in Matimo are organized as **independent npm packages** in the `packages/` directory. This guide walks you through creating and publishing a new tool provider.

## Overview

Each tool provider:

- Is published to npm as `@matimo/{provider}` (e.g., `@matimo/slack`, `@matimo/github`)
- Can be installed via CLI: `matimo install {provider}`
- Is auto-discovered when installed in `node_modules/@matimo/*`
- Contains YAML tool definitions that work across all patterns

> **⚠️ Tool Naming Convention**  
> Matimo supports both `kebab-case` and `snake_case` tool names for backward compatibility:  
> - **Legacy tools** (GitHub, Gmail, older Slack): `kebab-case` (e.g., `gmail-send-email`, `github-create-issue`)  
> - **Modern tools** (Bruno, meta-tools, newer providers): `snake_case` (e.g., `bruno_run_request`, `matimo_create_tool`)  
> - **Recommended for new tools**: `snake_case` following the pattern `{provider}_{action}` (e.g., `stripe_create_payment`, `notion_create_page`)  
> - Both naming styles work identically in all SDK patterns, filters need to check both: `.startsWith('slack-') || .startsWith('slack_')`

## Step 1: Create a New Tool Provider Package

```bash
# Create provider directory
mkdir packages/github
cd packages/github

# Create package.json
cat > package.json << 'EOF'
{
  "name": "@matimo/github",
  "version": "0.1.0",
  "description": "GitHub repository and issue management tools for Matimo",
  "type": "module",
  "files": ["tools", "definition.yaml"],
  "dependencies": {
    "@matimo/core": "workspace:*"
  }
}
EOF

# Create tool directories
mkdir -p tools/github-create-issue
mkdir -p tools/github-list-repos
```

## Step 2: Define Your Tools as YAML

Each tool gets its own directory with a `definition.yaml` file.

### Example: GitHub Create Issue

Create `packages/github/tools/github-create-issue/definition.yaml`:

```yaml
name: github_create_issue
description: Create a new issue in a GitHub repository
version: '1.0.0'

parameters:
  owner:
    type: string
    required: true
    description: GitHub repository owner
  repo:
    type: string
    required: true
    description: GitHub repository name
  title:
    type: string
    required: true
    description: Issue title
  body:
    type: string
    required: false
    description: Issue description

execution:
  type: http
  method: POST
  url: https://api.github.com/repos/{owner}/{repo}/issues
  headers:
    Authorization: 'Bearer {GITHUB_TOKEN}'
    Accept: application/vnd.github.v3+json
  body:
    title: '{title}'
    body: '{body}'

authentication:
  type: api_key
  location: header
  name: Authorization

output_schema:
  type: object
  properties:
    id:
      type: number
      description: Issue ID
    number:
      type: number
      description: Issue number
    title:
      type: string
      description: Issue title
    url:
      type: string
      description: Issue URL
  required:
    - id
    - number
    - title

error_handling:
  retry: 2
  backoff_type: exponential
  initial_delay_ms: 1000
```

### Tool Definition Structure

**Required fields:**

- `name` - Unique tool identifier (lowercase, hyphens)
- `description` - What the tool does
- `version` - Semantic version
- `parameters` - Input schema with types, required flags
- `execution` - How to execute (type, method, url/command, etc.)

**Optional fields:**

- `authentication` - Auth method (api_key, bearer, oauth2, basic)
- `output_schema` - Response validation schema
- `error_handling` - Retry policy and backoff strategy
- `examples` - Usage examples

See [Tool Specification](./TOOL_SPECIFICATION.md) for complete schema.

## Step 3: Add Provider Configuration

Create `packages/github/definition.yaml` with provider metadata:

```yaml
# Provider configuration
provider: github
description: GitHub repository and issue management tools
version: '1.0.0'

tools:
  - github-create-issue
  - github-list-repos
  - github-get-issue
  - github-create-pull-request

authentication:
  type: oauth2
  provider: github
  scopes:
    - repo
    - issues
    - pull_requests
```

## Step 4: Test & Validate

From the root `matimo/` directory:

```bash
# Validate all tool definitions (YAML syntax + schema)
pnpm validate-tools

# Run tests
pnpm test

# Build the package
pnpm build
```

### Validation Checks:

- ✅ YAML syntax is valid
- ✅ All required fields present
- ✅ Parameter types are valid (string, number, boolean, etc.)
- ✅ Execution config is complete
- ✅ Output schema matches response structure

## Step 5: Publish to npm

```bash
# Build everything
pnpm build

# Publish the provider package
npm publish packages/github --access public

# Or for pre-release versions
npm publish packages/github --access public --tag alpha
```

**Publishing checklist:**

- [ ] Package name starts with `@matimo/`
- [ ] Version number in `package.json` updated
- [ ] All YAML files validate
- [ ] Tests pass
- [ ] Documentation in provider README
- [ ] CHANGELOG updated

## Step 6: Users Install and Auto-Discover

### Installation

```bash
# Install via CLI
matimo install github

# Or directly with npm
npm install @matimo/github
```

### Auto-Discovery

Users can auto-discover all installed tool packages:

```typescript
import { MatimoInstance } from 'matimo';

// Auto-discover finds all @matimo/* packages in node_modules
const matimo = await MatimoInstance.init({ autoDiscover: true });

// github-create-issue is now available!
const result = await matimo.execute('github_create_issue', {
  owner: 'tallclub',
  repo: 'matimo',
  title: 'Amazing new feature',
  body: 'This would be a great addition!',
});

console.log(`Issue #${result.number} created: ${result.url}`);
```

## Auto-Discovery Mechanism

When `autoDiscover: true`:

1. **Scans** `node_modules/@matimo/` for installed packages
2. **Discovers** `tools/` directories in each package
3. **Loads** all YAML definitions from those directories
4. **Validates** each definition against the tool schema
5. **Registers** tools in the tool registry
6. **Exposes** them via `matimo.listTools()`, `matimo.getTool()`, `matimo.execute()`

```typescript
const matimo = await MatimoInstance.init({ autoDiscover: true });

// Finds and registers:
// ✅ node_modules/@matimo/slack/tools/* → Slack tools
// ✅ node_modules/@matimo/github/tools/* → GitHub tools
// ✅ node_modules/@matimo/stripe/tools/* → Stripe tools
// ✅ ... any other @matimo/* packages

console.log(matimo.listTools()); // All tools from all packages
```

## Tool Discovery Features

### List Installed Packages

```bash
matimo list
```

Output:

```
📦 Installed Matimo Packages:

  📍 @matimo/slack
     Slack workspace tools
     Tools: slack-send-message, slack-list-channels, slack-get-messages, ...

  📍 @matimo/github
     GitHub repository and issue management tools
     Tools: github-create-issue, github-list-repos, github-get-issue, ...

Total: 2 packages installed
```

### Search for Tools

```bash
matimo search email
```

Output:

```
Results:
  📍 @matimo/gmail
     Gmail email tools
     Tools: gmail-send-email, gmail-list-messages, gmail-create-draft, ...
```

### Install Multiple Packages

```bash
matimo install stripe twilio notion
```

## Directory Structure

```
packages/github/
├── tools/
│   ├── github-create-issue/
│   │   ├── definition.yaml          # Tool definition
│   │   └── (index.ts - optional)    # Custom logic if needed
│   ├── github-list-repos/
│   │   └── definition.yaml
│   └── github-get-issue/
│       └── definition.yaml
├── definition.yaml                  # Provider metadata
├── package.json                     # npm package config
├── tsconfig.json                    # TypeScript config (if needed)
└── README.md                        # Provider documentation
```

## Execution Types

### Command Execution

For shell commands with parameter templating:

```yaml
execution:
  type: command
  command: node
  args:
    - scripts/process.js
    - '{param1}'
    - '{param2}'
  timeout: 30000
  env:
    DEBUG: 'true'
```

### HTTP Execution

For REST APIs with authentication:

```yaml
execution:
  type: http
  method: POST
  url: https://api.example.com/items
  headers:
    Authorization: 'Bearer {API_TOKEN}'
    Content-Type: application/json
  body:
    name: '{name}'
    description: '{description}'
  timeout: 15000
```

### Function Execution

Matimo supports two patterns for function execution:

#### 1. Recommended: External TypeScript/JavaScript Files (Trusted)

```yaml
execution:
  type: function
  code: ./handler.ts # Path to external .ts or .js file
  timeout: 10000
```

The referenced file should export a default async function:

```typescript
// handler.ts
export default async function handler(params: Record<string, unknown>) {
  const { query } = params;
  // Your logic here
  return { result: 'success' };
}
```

**Security**: ✅ Recommended. Code is version-controlled, reviewable, and cannot be injected via YAML.

#### 2. Legacy: Embedded Code (Disabled by Default)

```yaml
execution:
  type: function
  code: |
    async (params) => {
      return { result: params.value };
    }
  timeout: 10000
```

**SECURITY WARNING**: Embedded code execution is **disabled by default** because it:

- Runs arbitrary JavaScript with access to `fs`, `path`, `axios` modules
- Creates an RCE (Remote Code Execution) vector if YAML comes from untrusted sources
- Cannot be audited without parsing the YAML

**How it works**:

```typescript
// Logic in function-executor.ts
const embeddedCodeDisabled = process.env.MATIMO_ALLOW_EMBEDDED_CODE !== 'true';

// If MATIMO_ALLOW_EMBEDDED_CODE is NOT set to 'true' → disabled (default)
// If MATIMO_ALLOW_EMBEDDED_CODE = 'true' → enabled (opt-in)
if (embeddedCodeDisabled) {
  throw new MatimoError('Embedded code execution is disabled by default...');
}
```

**To enable (NOT recommended)**:

```bash
export MATIMO_ALLOW_EMBEDDED_CODE=true
```

⚠️ Only enable if you **fully trust** all tool YAML sources. Never enable in production without careful review.

## Authentication

Tools support multiple authentication methods:

### API Key

```yaml
authentication:
  type: api_key
  location: header
  name: Authorization
  # Loads from env: MATIMO_GITHUB_API_KEY or GITHUB_API_KEY
```

### Bearer Token

```yaml
authentication:
  type: bearer
  location: header
  # Loads from env: MATIMO_GITHUB_TOKEN or GITHUB_TOKEN
```

### OAuth2

```yaml
authentication:
  type: oauth2
  provider: github
  scopes:
    - repo
    - issues
```

### Basic Auth

```yaml
authentication:
  type: basic
  # Loads from env: MATIMO_GITHUB_USERNAME, MATIMO_GITHUB_PASSWORD
```

## Best Practices

### Naming

- **Package name**: `@matimo/{provider}` (e.g., `@matimo/slack`)
- **Tool name**: `{provider}-{action}` (e.g., `slack-send-message`)
- **Parameter names**: lowercase, hyphens for multi-word

### Parameters

```yaml
parameters:
  channel_id:
    type: string
    required: true
    description: Slack channel ID (e.g., C123456)
    enum: [] # Optional: restrict to specific values
```

### Error Handling

Always include retry logic for reliability:

```yaml
error_handling:
  retry: 2 # Number of retries
  backoff_type: exponential # exponential or linear
  initial_delay_ms: 1000 # Starting delay in ms
```

### Output Schema

Validate responses to catch API changes:

```yaml
output_schema:
  type: object
  properties:
    id:
      type: number
    created_at:
      type: string
      format: date-time
  required:
    - id
```

## Examples in Repository

See these working examples:

- **Slack tools**: `packages/slack/tools/`
- **Gmail tools**: `packages/gmail/tools/`
- **Calculator tool**: `packages/core/tools/`

## Publishing Your Tools

### Steps:

1. Ensure tests pass: `pnpm test`
2. Validate tools: `pnpm validate-tools`
3. Update version in `package.json`
4. Build: `pnpm build`
5. Publish: `npm publish packages/github --access public`

### Naming Convention:

Always use `@matimo/{provider}` scope for consistency and discoverability.

## Getting Help

- 📖 See [Tool Specification](./TOOL_SPECIFICATION.md) for complete schema
- 💬 Open an issue on [GitHub](https://github.com/tallclub/matimo/issues)
- 🔗 Check [Architecture Overview](../architecture/OVERVIEW.md) for system design

## Contributing Your Tools

We'd love to include your tools in the ecosystem! Submit a PR with:

1. Tool definitions in `packages/{provider}/`
2. Tests for your tools
3. Documentation in provider README
4. Examples showing how to use them

See [Contributing Guidelines](../../CONTRIBUTING.md) for details.
