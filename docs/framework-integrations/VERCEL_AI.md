# Vercel AI SDK Integration

> ⚠️ **Not yet implemented.** `convertToolsToVercelAI` does not exist in the current SDK — the export
> is commented out in `typescript/packages/core/src/index.ts` and `integrations/vercel-ai.ts` was
> never written (only `integrations/langchain.ts` exists today). Everything below describes the
> planned API, not something you can `import` and run yet. For a working framework integration, see
> [LANGCHAIN.md](./LANGCHAIN.md) or [CREWAI.md](./CREWAI.md) instead.

Matimo provides `convertToolsToVercelAI` to wrap any Matimo tool as a [`CoreTool`](https://sdk.vercel.ai/docs/ai-sdk-core/tools-and-tool-calling) accepted by `generateText`, `streamText`, `generateObject`, and `streamObject`.

## Installation

```bash
npm install matimo ai @ai-sdk/openai
# or
pnpm add matimo ai @ai-sdk/openai
```

> `ai` and `@ai-sdk/openai` are peer dependencies — install the providers you need.

## Basic Usage

```typescript
import { MatimoInstance, convertToolsToVercelAI } from 'matimo';
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';

// 1. Load tool definitions from YAML
const matimo = await MatimoInstance.init('./tools');

// 2. Convert once — synchronous, no await needed
const tools = convertToolsToVercelAI(
  matimo.listTools(),
  matimo,
  { SLACK_BOT_TOKEN: process.env.SLACK_BOT_TOKEN! }
);

// 3. Pass to any Vercel AI function
const { text } = await generateText({
  model: openai('gpt-4o-mini'),
  messages: [{ role: 'user', content: 'Send hello to #general on Slack' }],
  tools,
  maxSteps: 5, // allow multi-turn tool use
});
```

## Streaming with Tool Results

```typescript
import { streamText } from 'ai';

const { textStream } = await streamText({
  model: openai('gpt-4o-mini'),
  messages: [{ role: 'user', content: 'List my unread emails' }],
  tools: convertToolsToVercelAI(matimo.listTools(), matimo, secrets),
  maxSteps: 5,
});

for await (const chunk of textStream) {
  process.stdout.write(chunk);
}
```

## Filtering Tools

Pass a filtered subset of tools to keep the model's context focused:

```typescript
const slackTools = convertToolsToVercelAI(
  matimo.listTools().filter((t) => t.name.startsWith('slack')),
  matimo,
  { SLACK_BOT_TOKEN: process.env.SLACK_BOT_TOKEN! }
);
```

## Secret Injection

Parameters whose names contain `TOKEN`, `KEY`, `SECRET`, or `PASSWORD` are **auto-detected** as secrets and excluded from the schema shown to the model. Their values are injected at execution time from the `secrets` map you provide.

```typescript
const tools = convertToolsToVercelAI(
  matimo.listTools(),
  matimo,
  {
    SLACK_BOT_TOKEN: process.env.SLACK_BOT_TOKEN!,
    OPENAI_API_KEY:  process.env.OPENAI_API_KEY!,
  }
);
// SLACK_BOT_TOKEN and OPENAI_API_KEY won't appear in tool schemas shown to the model
```

Override auto-detection with an explicit set:

```typescript
const tools = convertToolsToVercelAI(
  matimo.listTools(),
  matimo,
  secrets,
  new Set(['MY_CUSTOM_CREDENTIAL'])  // treat this param as secret regardless of name
);
```

## API Reference

### `convertToolsToVercelAI(tools, matimo, secrets?, secretParamNames?)`

| Parameter | Type | Description |
|-----------|------|-------------|
| `tools` | `ToolDefinition[]` | From `matimo.listTools()` |
| `matimo` | `MatimoInstance` | Used to execute tool calls |
| `secrets` | `Record<string, string>` | Credential values, keyed by env-var name |
| `secretParamNames` | `Set<string>` | Explicit override for secret param detection |

Returns a `VercelAIToolSet` (`Record<string, CoreTool>`) ready to pass to `generateText` etc.

### Types

```typescript
import type { VercelAITool, VercelAIToolSet } from 'matimo';
```

## Full Example

No runnable example exists yet (see the not-yet-implemented notice at the top of this page). For a
complete working agent today, see [`typescript/examples/tools/agents/langchain-agent.ts`](../../typescript/examples/tools/agents/langchain-agent.ts).

## Comparison with LangChain Adapter

| Feature | Vercel AI | LangChain |
|---------|-----------|-----------|
| Return type | `VercelAIToolSet` (plain object) | `LangChainTool[]` (array) |
| Async | No — synchronous | Yes — async (lazy loads `@langchain/core`) |
| Streaming | Via `streamText` | Via LangChain chains |
| Schema format | Zod (inline) | Zod (bound to `tool()` fn) |
| Peer dependency | `ai` | `@langchain/core` |
