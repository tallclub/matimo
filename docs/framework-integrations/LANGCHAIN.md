# LangChain Integration

## Overview

Matimo provides a simple, unified API (`convertToolsToLangChain`) to convert tool definitions to LangChain-compatible format. This eliminates boilerplate and scales to many tools seamlessly.

## Installation

```bash
npm install matimo langchain @langchain/core
# or
pnpm add matimo langchain @langchain/core
```

## The Simplified Approach: `convertToolsToLangChain`

### Key Benefits

- **One function, any tool** — Works with all Matimo tools
- **Automatic Zod schema generation** — Parameters validated against tool definition
- **Simple secret injection** — Pass API keys explicitly
- **LLM-friendly results** — Formatted for agent consumption
- **code** — Lightweight & maintainable

### Basic Integration

```typescript
import { MatimoInstance, convertToolsToLangChain } from 'matimo';
import { ChatOpenAI } from '@langchain/openai';
import { createAgent } from 'langchain/agents';

// 1. Load Matimo tools
const matimo = await MatimoInstance.init('./tools');

// 2. Convert to LangChain (that's it!)
const langchainTools = await convertToolsToLangChain(
  matimo.listTools().filter((t) => t.name.startsWith('slack-')),
  matimo,
  { SLACK_BOT_TOKEN: process.env.SLACK_BOT_TOKEN! }
);

// 3. Create agent
const agent = await createAgent({
  model: new ChatOpenAI({ modelName: 'gpt-4o-mini' }),
  tools: langchainTools,
});

// Run it
const result = await agent.invoke({
  input: 'List all Slack channels',
});

console.log('Agent response:', result.output);
```

### Complete LangChain Agent Example

```typescript
import { MatimoInstance, convertToolsToLangChain } from 'matimo';
import { ChatOpenAI } from '@langchain/openai';
import { createAgent } from 'langchain/agents';

async function runSlackAgent() {
  // Initialize Matimo
  const matimo = await MatimoInstance.init('./tools');

  // Get all Slack tools
  const slackTools = matimo.listTools().filter((t) => t.name.startsWith('slack-'));

  console.log(`📦 Loaded ${slackTools.length} Slack tools`);

  // Convert to LangChain format (one line!)
  const langchainTools = await convertToolsToLangChain(slackTools, matimo, {
    SLACK_BOT_TOKEN: process.env.SLACK_BOT_TOKEN!,
  });

  // Create OpenAI LLM
  const model = new ChatOpenAI({
    modelName: 'gpt-4o-mini',
    temperature: 0,
  });

  // Create agent
  const agent = await createAgent({
    model,
    tools: langchainTools,
  });

  // Test queries
  const queries = [
    'List all channels',
    'Get message history for #general',
    'Send a test message to #general',
  ];

  for (const query of queries) {
    console.log(`\n📝 User: "${query}"`);
    const result = await agent.invoke({ input: query });
    console.log(`🤖 Agent: ${result.output}`);
  }
}

runSlackAgent().catch(console.error);
```

## API Reference: `convertToolsToLangChain`

```typescript
export async function convertToolsToLangChain(
  tools: ToolDefinition[],
  matimo: MatimoInstance,
  secrets?: Record<string, string>
): Promise<LangChainTool[]>;
```

### Parameters

- **`tools`** — Array of Matimo tool definitions to convert
- **`matimo`** — MatimoInstance for tool execution
- **`secrets`** _(optional)_ — Object with secret values to inject
  - Keys: parameter names (e.g., `SLACK_BOT_TOKEN`, `api_key`)
  - Values: secret values from environment or storage
  - Auto-detection: Parameters containing `TOKEN`, `KEY`, `SECRET`, or `PASSWORD` are automatically treated as secrets

### Returns

Array of LangChain-compatible tools ready for agents.

## Secret Handling

### Explicit Secret Injection

```typescript
const tools = await convertToolsToLangChain(matimo.listTools(), matimo, {
  SLACK_BOT_TOKEN: process.env.SLACK_BOT_TOKEN!,
  GMAIL_ACCESS_TOKEN: process.env.GMAIL_ACCESS_TOKEN!,
  api_key: process.env.MY_API_KEY!,
});
```

### Auto-Detected Secret Parameters

**How it works:** The `convertToolsToLangChain` function automatically detects which parameters should be treated as secrets by scanning their names for common secret patterns. When a parameter is detected as a secret:

1. It's **excluded from the LangChain schema** (users don't need to provide it)
2. It's **injected automatically** when present in the secrets map
3. It's **never logged or exposed** in error messages

Parameters are automatically detected as secrets if they match these patterns:

- Parameter name contains `TOKEN` (e.g., `bot_token`, `access_TOKEN`)
- Parameter name contains `KEY` (e.g., `api_key`, `encryption_KEY`)
- Parameter name contains `SECRET` (e.g., `api_secret`)
- Parameter name contains `PASSWORD` (e.g., `db_password`)
- Case-insensitive matching (e.g., `ApiKey` matches the `KEY` pattern)

**Example:**

```typescript
// Tool has parameters: slack_bot_token, channel
// When passed to convertToolsToLangChain with { slack_bot_token: '...' }:
// ✓ slack_bot_token is auto-detected as a secret and excluded from schema
// ✓ Only channel appears in the LangChain schema
// ✓ slack_bot_token is injected automatically on tool execution

const tools = await convertToolsToLangChain(
  [slackTool], // tool.parameters = { slack_bot_token, channel, ... }
  matimo,
  { slack_bot_token: process.env.SLACK_BOT_TOKEN! }
);

// User only provides: channel
// slack_bot_token is injected automatically
await tools[0].invoke({ channel: '#general' });
```

## Working Examples

See [examples/tools/](../../examples/tools/) for complete examples:

- `gmail-langchain.ts` - Gmail tool integration with LangChain
- `gmail-decorator.ts` - Decorator pattern example
- `gmail-factory.ts` - Factory pattern example

Run them:

```bash
cd examples/tools
pnpm install
pnpm gmail:langchain --email:your@email.com
```

## Tool Parameter Mapping

Matimo parameters map directly to LangChain function calls:

```yaml
# Matimo tool definition
parameters:
  email:
    type: string
    required: true
  subject:
    type: string
    required: true
  body:
    type: string
    required: true
```

Becomes in LangChain:

```json
{
  "name": "gmail-send-email",
  "description": "Send an email",
  "parameters": {
    "type": "object",
    "properties": {
      "email": { "type": "string" },
      "subject": { "type": "string" },
      "body": { "type": "string" }
    },
    "required": ["email", "subject", "body"]
  }
}
```

## OAuth2 with LangChain

Tools requiring OAuth2 authentication:

```typescript
// Set OAuth tokens as environment variables
process.env.GMAIL_ACCESS_TOKEN = 'your-access-token';
process.env.GITHUB_TOKEN = 'your-github-token';

// Matimo automatically injects tokens into tools
const result = await matimoInstance.execute('gmail-send-email', {
  to: 'user@example.com',
  subject: 'Hello',
  body: 'Message',
  // Token is automatically included from environment
});
```

## Error Handling

```typescript
try {
  const result = await agentExecutor.invoke({
    input: 'Send an email',
  });
} catch (error) {
  if (error.code === 'TOOL_NOT_FOUND') {
    console.error('Tool not available:', error.message);
  } else if (error.code === 'INVALID_PARAMETERS') {
    console.error('Invalid parameters:', error.details);
  } else if (error.code === 'EXECUTION_FAILED') {
    console.error('Tool execution failed:', error.details);
  } else {
    console.error('Unexpected error:', error);
  }
}
```

## Skills Integration (Non-MCP)

When using Matimo with LangChain **without an MCP server**, skills are not surfaced as MCP Resources. Instead, use the two helper functions exported from `matimo` to implement the same [progressive disclosure model](../skills/SKILLS.md) programmatically:

| Helper | Level | When to call |
|--------|-------|--------------|
| `getSkillsMetadata(matimo)` | 1 — Discovery | **Once at startup** — inject into system prompt so the agent knows which skills exist |
| `buildRelevantSkillPrompt(matimo, query, options)` | 2 — Activation | **Per request** — semantic search (TF-IDF) loads full content only for top-K relevant skills |

### Correct Pattern

```typescript
import {
  MatimoInstance,
  convertToolsToLangChain,
  getSkillsMetadata,
  buildRelevantSkillPrompt,
} from 'matimo';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';

// 1. Startup — Level 1 metadata block (token-safe, ~50 tokens/skill)
const matimo = await MatimoInstance.init({ autoDiscover: true });
const meta = getSkillsMetadata(matimo);
// meta → [{ name: 'slack', description: 'Complete guide to all Slack tools…' }, …]

const metaBlock = meta
  .map((s) => `- **${s.name}**: ${s.description}`)
  .join('\n');

const systemPrompt = `You are a helpful agent.\n\nAvailable skills (use matimo_get_skill to load details):\n${metaBlock}`;

// 2. Per-request — Level 2 semantic search, loads only relevant content
const userMessage = 'How do I handle Slack rate limits?';

const skillContext = await buildRelevantSkillPrompt(matimo, userMessage, {
  topK: 2,        // Max skills to load (default: 3)
  minScore: 0.3,  // Minimum relevance threshold (default: 0.3)
  header: 'Apply these skill guidelines:',  // Optional custom header
});
// skillContext → markdown block with relevant skills embedded, or empty string

const messages = [
  new SystemMessage(systemPrompt),
  ...(skillContext ? [new SystemMessage(skillContext)] : []),
  new HumanMessage(userMessage),
];
```

### Why not load all skill content upfront?

The [agentskills.io specification](https://agentskills.io) explicitly recommends **against** injecting all skill content into every system prompt:

- Skills vary per session — most requests need 1–2 skills, not all 15
- Large skill files can easily exceed 10,000 tokens each
- `buildRelevantSkillPrompt` uses TF-IDF cosine similarity to load only what's relevant to the current query — cost proportional to relevance

For scenarios where a skill is always relevant (e.g. a Slack-only bot), load it directly with `matimo.getSkillContent('slack')` rather than using the semantic search helper.

### `getSkillsMetadata` reference

```typescript
export function getSkillsMetadata(
  matimo: MatimoInstance
): Array<{ name: string; description: string }>;
```

Returns Level 1 metadata (name + description) for every registered skill. Does not load file content — always token-safe.

### `buildRelevantSkillPrompt` reference

```typescript
export async function buildRelevantSkillPrompt(
  matimo: MatimoInstance,
  query: string,
  options?: {
    topK?: number;      // Max skills to load (default: 3)
    minScore?: number;  // Minimum TF-IDF cosine similarity (default: 0.3)
    header?: string;    // Custom header line (optional)
  }
): Promise<string>;
```

Calls `matimo.semanticSearchSkills(query, { limit: topK, minScore })` (TF-IDF) internally, then loads full content only for the top-matching skills. Returns a formatted markdown block ready to inject as a `SystemMessage`, or an empty string when no skills score above `minScore`.

Each skill block is formatted as:
```
## Skill: {name} (relevance: {score})
_{description}_

{full SKILL.md content}
```

---

## Future Releases

🔜 **v0.2.0** will include:

- Official LangChain adapter package
- Automatic tool schema conversion
- LangChain Tool subclass implementation
- CrewAI integration examples
- Vercel AI SDK integration

---

## Troubleshooting

### Tool Not Found Error

```
Error: Tool not found: gmail-send-email
```

**Solution**: Verify tools are loaded correctly

```typescript
const tools = matimoInstance.listTools();
console.log(
  'Available tools:',
  tools.map((t) => t.name)
);
```

### OAuth Token Missing

```
Error: Missing OAuth token for provider: google
```

**Solution**: Set environment variable

```bash
export GMAIL_ACCESS_TOKEN=your_token_here
```

### Type Errors with LangChain Tools

Ensure all Matimo tools are properly typed:

```bash
pnpm validate-tools  # Validates all YAML definitions
```

See [Troubleshooting Guide](../troubleshooting/FAQ.md) for more help.
