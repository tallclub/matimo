# Matimo CLI

Command-line tool for managing Matimo tool packages and discovering available tools.

## Installation

```bash
npm install -g @matimo/cli
```

Or use directly with npx:

```bash
npx @matimo/cli@latest list
npx @matimo/cli@latest search
```

## Commands

### `matimo list`

List all installed Matimo tool packages.

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

  📍 @matimo/gmail
     Gmail email tools
     Tools: gmail-send-email, gmail-list-messages, gmail-create-draft, ...

Total: 3 packages installed
```

**Use when:** You want to see all installed tool packages and a preview of available tools.

### `matimo install [package...]`

Install one or more tool packages from npm.

```bash
# Install a single package
matimo install slack

# Install multiple packages
matimo install github stripe notion

# Install specific version
matimo install slack@1.2.0
```

The CLI automatically resolves `{package}` to `@matimo/{package}` and installs from npm.

**Examples:**

```bash
# Install Slack tools
matimo install slack
# → Installs @matimo/slack

# Install GitHub and Stripe
matimo install github stripe
# → Installs @matimo/github and @matimo/stripe

# See what's available
matimo search email
```

**Next Steps:**

After installation, you can use auto-discovery in your code:

```typescript
import { MatimoInstance } from 'matimo';

const matimo = await MatimoInstance.init({ autoDiscover: true });

// New tools are automatically available!
const result = await matimo.execute('slack-send-message', {
  channel: '#general',
  text: 'Hello from Matimo!'
});
```

### `matimo search [query]`

Search for tools or packages by name.

```bash
# Search for email tools
matimo search email

# Search for a specific package
matimo search github

# Search for Slack tools
matimo search slack
```

Output:
```
Results for "email":

  📍 @matimo/gmail
     Gmail email tools
     Tools: gmail-send-email, gmail-list-messages, gmail-create-draft, ...

  📍 @matimo/sendgrid
     SendGrid email tools
     Tools: sendgrid-send-email, sendgrid-list-templates, ...
```

**Use when:** You want to find tools before installing them, or discover what's available for a specific service.

## Auto-Discovery

After installing packages with the CLI, use auto-discovery to automatically load them:

```typescript
import { MatimoInstance } from 'matimo';

// Discovers all installed @matimo/* packages
const matimo = await MatimoInstance.init({ autoDiscover: true });

// List all available tools
const tools = matimo.listTools();

// Execute any tool
const result = await matimo.execute('github-create-issue', {
  owner: 'tallclub',
  repo: 'matimo',
  title: 'My issue'
});
```

**How it works:**

1. CLI installs packages to `node_modules/@matimo/{provider}`
2. `MatimoInstance.init({ autoDiscover: true })` scans that directory
3. All tool definitions are loaded and registered automatically
4. Tools are ready to use via `matimo.execute()`

## Package Ecosystem

Matimo packages are published to npm with the `@matimo` scope:

- `@matimo/slack` - Slack workspace tools
- `@matimo/github` - GitHub repository tools
- `@matimo/gmail` - Gmail email tools
- `@matimo/stripe` - Stripe payment tools (coming soon)
- `@matimo/twilio` - Twilio SMS/voice tools (coming soon)

[Browse all Matimo packages](https://www.npmjs.com/search?q=%40matimo)

## Creating Tool Packages

Want to create your own tools? See the [Adding Tools to Matimo](../../docs/tool-development/ADDING_TOOLS.md) guide.

**Summary:** Create a package with YAML tool definitions and publish it to npm as `@matimo/{provider}`.

## Development

Build and test the CLI:

```bash
# Install deps
pnpm install

# Build
pnpm build

# Test
pnpm test

# Link locally for testing
pnpm link --global packages/cli
matimo list  # Test the command
```

## Help

Get help for any command:

```bash
matimo --help
matimo list --help
matimo search --help
```

## Examples

### Install and Use Slack Tools

```bash
# 1. Install
matimo install slack

# 2. Use in code
const { MatimoInstance } = require('matimo');

const matimo = await MatimoInstance.init({ autoDiscover: true });

const result = await matimo.execute('slack-send-message', {
  channel: '#general',
  text: 'Hello Slack!'
});
```

### Search and Install GitHub Tools

```bash
# 1. Search for GitHub tools
matimo search github

# 2. Install
matimo install github

# 3. Use
const matimo = await MatimoInstance.init({ autoDiscover: true });

const issue = await matimo.execute('github-create-issue', {
  owner: 'tallclub',
  repo: 'matimo',
  title: 'New feature'
});
```

### Install Multiple Packages

```bash
matimo install slack github gmail

# All three are now installed and auto-discoverable
const matimo = await MatimoInstance.init({ autoDiscover: true });

// Use any tool from any package
await matimo.execute('slack-send-message', {...});
await matimo.execute('github-create-issue', {...});
await matimo.execute('gmail-send-email', {...});
```

## Troubleshooting

### "Package not found" error

```bash
# Verify the package name (should be valid npm package)
npm search @matimo/slack

# Try installing with full name
npm install @matimo/slack
```

### Tools not showing in list

```bash
# Reinstall packages in current project
npm install @matimo/slack

# Verify they're installed
npm ls @matimo/slack

# Use auto-discovery in code
const matimo = await MatimoInstance.init({ autoDiscover: true });
```

### Need specific version?

```bash
matimo install slack@1.2.0
npm install @matimo/slack@1.2.0
```

## Support

- 📖 [Matimo Documentation](../../docs/index.md)
- 🛠️ [Tool Development Guide](../../docs/tool-development/ADDING_TOOLS.md)
- 💬 [GitHub Issues](https://github.com/tallclub/matimo/issues)
