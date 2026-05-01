# Tool Discovery & Filtering

Find and filter tools by name, description, and tags.

## Auto-Discovery

Matimo automatically discovers tools from installed packages in `node_modules`. When you call `MatimoInstance.init()`, it scans for tool provider packages and loads all available tools.

### How Auto-Discovery Works

```typescript
import { MatimoInstance } from 'matimo';

// Auto-discovery: scans node_modules for @matimo/* packages
const m = await MatimoInstance.init({ autoDiscover: true });

// All tools from installed providers are now available
const allTools = m.listTools();
console.log(`Discovered ${allTools.length} tools`);
```

**Discovery Process:**

1. **Scan node_modules** — Looks for `@matimo/*` scoped packages
2. **Load definitions** — Each package's `definition.yaml` is parsed
3. **Register tools** — Tools are indexed by name for fast lookup
4. **Cache in memory** — Tools remain available for the lifetime of the Matimo instance

### Installed Providers

Tools are automatically discovered from these providers:

```typescript
// Tools are auto-discovered from installed packages:
// @matimo/slack      → slack_send_message, slack_list_channels, etc.
// @matimo/gmail      → gmail_send_email, gmail_list_messages, etc.
// @matimo/github     → github_create_issue, github_list_repos, etc.

const m = await MatimoInstance.init({ autoDiscover: true });
const allTools = m.listTools();

allTools.forEach((tool) => {
  console.log(`• ${tool.name}`);
  // • slack_send_message
  // • slack_list_channels
  // • gmail_send_email
  // • gmail_list_messages
  // • github_create_issue
  // ...
});
```

### Install New Providers

Add more tools by installing new provider packages:

```bash
# Install Gmail tools
npm install @matimo/gmail

# Install GitHub tools
npm install @matimo/github

# Install Slack tools
npm install @matimo/slack
```

Restart your Matimo instance to pick up newly installed providers:

```typescript
// Before: only some tools loaded
const m1 = await MatimoInstance.init({ autoDiscover: true });
console.log(m1.listTools().length); // e.g., 12 tools

// After installing @matimo/github:
// Restart your app/service

// Now: GitHub tools are included
const m2 = await MatimoInstance.init({ autoDiscover: true });
console.log(m2.listTools().length); // e.g., 18 tools (12 + 6 GitHub tools)
```

### Local Tools with Auto-Discovery

Auto-discovery also loads tools from the local `./tools` directory if provided:

```typescript
// Load from both node_modules (auto-discovery) AND local ./tools directory
const m = await MatimoInstance.init({
  autoDiscover: true,
  toolPaths: ['./tools'],
});

// Includes:
// 1. All @matimo/* provider packages from node_modules
// 2. Custom tools from ./tools directory
const allTools = m.listTools();
```

**Directory structure:**

```
project/
├── package.json
├── tools/                    # Local custom tools
│   ├── my-provider/
│   │   └── my-tool/
│   │       └── definition.yaml
│   └── ...
└── node_modules/
    ├── @matimo/slack/       # Auto-discovered
    ├── @matimo/gmail/       # Auto-discovered
    └── @matimo/github/      # Auto-discovered
```

---

```typescript
import { MatimoInstance } from 'matimo';

const m = await MatimoInstance.init({
  autoDiscover: true,
  toolPaths: ['./tools'],
});

// List all loaded tools
const allTools = m.listTools();
console.log(`Loaded ${allTools.length} tools`);

allTools.forEach((tool) => {
  console.log(`• ${tool.name} - ${tool.description}`);
});
```

**Output:**

```
Loaded 8 tools
• calculator - Perform basic math operations
• gmail_send_email - Send an email via Gmail API
• gmail_list_messages - List emails from Gmail
• github_create_issue - Create a GitHub issue
... (more tools)
```

---

## Get Specific Tool

```typescript
const tool = m.getTool('calculator');

console.log(`Name: ${tool.name}`);
console.log(`Description: ${tool.description}`);
console.log(`Version: ${tool.version}`);
```

---

## Filter by Tags

```typescript
// Get tools with specific tags
const mathTools = m.getToolsByTag('math');
console.log(`Math tools: ${mathTools.map((t) => t.name).join(', ')}`);

const emailTools = m.getToolsByTag('email');
console.log(`Email tools: ${emailTools.map((t) => t.name).join(', ')}`);
```

---

## Search Tools

```typescript
// Search by name or description
const results = m.searchTools('email');

results.forEach((tool) => {
  console.log(`Found: ${tool.name}`);
  console.log(`  Description: ${tool.description}`);
  console.log(`  Tags: ${tool.tags?.join(', ') || 'none'}`);
});
```

**Output:**

```
Found: gmail_send_email
  Description: Send an email via Gmail API
  Tags: email, gmail, http

Found: gmail_list_messages
  Description: List emails from Gmail
  Tags: email, gmail, http
```

---

## Filter Criteria

### By Type

```typescript
// Filter by execution type
const httpTools = m.listTools().filter((t) => t.execution?.type === 'http');
console.log(`HTTP tools: ${httpTools.length}`);

const cmdTools = m.listTools().filter((t) => t.execution?.type === 'command');
console.log(`Command tools: ${cmdTools.length}`);
```

### By Authentication

```typescript
// Tools requiring OAuth2
const oauth2Tools = m.listTools().filter((t) => t.authentication?.type === 'oauth2');
console.log(`OAuth2 tools: ${oauth2Tools.map((t) => t.name).join(', ')}`);
```

### By Provider

```typescript
// Gmail tools
const gmailTools = m.listTools().filter((t) => t.name.startsWith('gmail_'));
console.log(`Gmail tools: ${gmailTools.map((t) => t.name).join(', ')}`);

// GitHub tools
const githubTools = m.listTools().filter((t) => t.name.startsWith('github_'));
console.log(`GitHub tools: ${githubTools.map((t) => t.name).join(', ')}`);
```

---

## Tool Metadata

Each tool has:

```typescript
const tool = m.getTool('calculator');

// Basic info
tool.name; // 'calculator'
tool.description; // 'Perform basic math operations'
tool.version; // '1.0.0'

// Parameters
tool.parameters; // { operation: {...}, a: {...}, b: {...} }
Object.keys(tool.parameters); // ['operation', 'a', 'b']

// Execution config
tool.execution.type; // 'command' | 'http'
tool.execution.command; // shell command (if type === 'command')
tool.execution.url; // API endpoint (if type === 'http')

// Authentication
tool.authentication?.type; // 'oauth2' | 'api_key' | etc.
tool.authentication?.provider; // 'google' | 'github' | 'slack'

// Output
tool.output_schema; // { type: 'object', properties: {...} }

// Metadata
tool.tags; // ['math', 'calculator']
tool.author; // 'Matimo'
tool.license; // 'MIT'
```

---

## Common Use Cases

### Find All Email Tools

```typescript
const emailTools = m.listTools().filter((t) => t.tags?.includes('email'));

emailTools.forEach((tool) => {
  console.log(`- ${tool.name}: ${tool.description}`);
});
```

### Find Tools Without Authentication

```typescript
const publicTools = m.listTools().filter((t) => !t.authentication);

console.log(`Public tools (no auth required):`);
publicTools.forEach((t) => console.log(`  - ${t.name}`));
```

### Find Tools Requiring OAuth2

```typescript
const oauth2Tools = m.listTools().filter((t) => t.authentication?.type === 'oauth2');

console.log(`Tools requiring OAuth2:`);
oauth2Tools.forEach((t) => {
  console.log(`  - ${t.name} (${t.authentication?.provider})`);
});
```

### List All Providers

```typescript
const providers = new Set(
  m
    .listTools()
    .filter((t) => t.authentication?.provider)
    .map((t) => t.authentication?.provider)
);

console.log(`Available providers: ${Array.from(providers).join(', ')}`);
```

---

## Next Steps

- **Auto-Discovery**: [Installing Providers](#auto-discovery) — Learn how Matimo auto-discovers tools from npm packages
- **Execute Tools**: [Your First Tool](../getting-started/YOUR_FIRST_TOOL.md)
- **Learn Patterns**: [SDK Usage Patterns](./SDK_PATTERNS.md)
- **Setup OAuth2**: [Authentication Guide](./AUTHENTICATION.md)
- **Add Tools**: [Adding Tools to Matimo](../tool-development/ADDING_TOOLS.md) — Create and publish your own provider packages
