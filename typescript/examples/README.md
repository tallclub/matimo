# Matimo TypeScript Examples

<p align="center">
  <a href="https://discord.gg/3JPt4mxWDV"><img src="https://img.shields.io/badge/Discord-Join%20Chat-5865F2?style=for-the-badge&logo=discord&logoColor=white" alt="Discord"></a>
</p>

Runnable examples for `@matimo/core` 0.2.0 and the provider packages. Every tool is defined once in YAML and called three ways: directly (factory), through a `@tool` method (decorator), or by an LLM (LangChain). Write tools also have a `-with-approval` example.

| Directory | What's in it |
|-----------|--------------|
| [`tools/`](./tools/) | Per-provider and per-tool examples, plus the policy, skills and meta-tool demos |
| [`mcp/`](./mcp/) | Running Matimo as an MCP server ([README](./mcp/README.md)) |

Python equivalents are in [`python/examples/`](../../python/examples/).

---

## Quick Start

```bash
cd matimo/typescript
pnpm install && pnpm build      # build the workspace packages
cd examples/tools
cp .env.example .env            # then fill in the keys you need

pnpm slack:factory              # factory pattern
pnpm slack:decorator            # decorator pattern
pnpm slack:langchain            # LangChain agent (needs OPENAI_API_KEY)
```

Requirements: Node.js 18+, and the provider credentials for the examples you run (`.env.example` lists them). LangChain examples also need `OPENAI_API_KEY`.

---

## The Three Patterns

### Factory — call a tool by name

```typescript
import { MatimoInstance } from '@matimo/core';

const matimo = await MatimoInstance.init({ autoDiscover: true });
const result = await matimo.execute('slack-send-message', {
  channel: 'C0123456789',
  text: 'Hello from Matimo!',
});
```

### Decorator — `@tool` methods

```typescript
import { MatimoInstance, setGlobalMatimoInstance, tool } from '@matimo/core';

const matimo = await MatimoInstance.init({ autoDiscover: true });
setGlobalMatimoInstance(matimo);

class SlackBot {
  @tool('slack-send-message')
  async sendMessage(channel: string, text: string) {} // arguments map to the YAML parameters in order

  @tool('slack-list-channels')
  async listChannels() {}
}

await new SlackBot().sendMessage('C0123456789', 'Hello!');
```

The method body never runs; the call goes through `matimo.execute()` with the same policy and approval checks. See the [Decorator Guide](../../docs/tool-development/DECORATOR_GUIDE.md).

### LangChain — let the model choose

```typescript
import { MatimoInstance, convertToolsToLangChain } from '@matimo/core';
import { ChatOpenAI } from '@langchain/openai';

const matimo = await MatimoInstance.init({ autoDiscover: true });
const slackTools = matimo.listTools().filter((t) => t.name.startsWith('slack'));
const tools = await convertToolsToLangChain(slackTools, matimo);

const llm = new ChatOpenAI({ model: 'gpt-4o-mini', temperature: 0 }).bindTools(tools);
const reply = await llm.invoke([{ role: 'user', content: 'List my Slack channels' }]);
```

Pass a short, relevant tool list: OpenAI rejects more than 128 tools. See [LangChain integration](../../docs/framework-integrations/LANGCHAIN.md).

---

## Scripts (run from `examples/tools/`)

| Area | Scripts | Credentials |
|------|---------|-------------|
| Pattern overviews | `agent:factory`, `agent:decorator`, `agent:langchain`, `agent:skills-policy` | `OPENAI_API_KEY` |
| Core tools | `<tool>:factory`, `:decorator`, `:langchain` for `read`, `edit`, `search`, `execute`, `web`, `web-scraper`, `extract-from-file`, `convert-to-file` | none for factory/decorator; `OPENAI_API_KEY` for langchain |
| Slack | `slack:factory`, `slack:decorator`, `slack:langchain` | `SLACK_BOT_TOKEN` |
| Gmail | `gmail:factory`, `gmail:decorator`, `gmail:langchain` | `GMAIL_ACCESS_TOKEN` |
| GitHub | `github:factory`, `github:decorator`, `github:langchain`, `github:approval` | `GITHUB_TOKEN` |
| HubSpot | `hubspot:factory`, `hubspot:decorator`, `hubspot:langchain` | `MATIMO_HUBSPOT_API_KEY` |
| Notion | `notion:factory`, `notion:decorator`, `notion:langchain` | `NOTION_API_KEY` |
| Microsoft | `microsoft:factory`, `microsoft:decorator`, `microsoft:langchain`, `microsoft:approval` | `MICROSOFT_GRAPH_ACCESS_TOKEN` |
| Mailchimp | `mailchimp:factory`, `mailchimp:decorator`, `mailchimp:langchain` | `MAILCHIMP_API_KEY` |
| Twilio | `twilio:factory`, `twilio:decorator`, `twilio:langchain` | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` |
| Postgres | `postgres:factory`, `postgres:decorator`, `postgres:langchain`, `postgres:approval` | `MATIMO_POSTGRES_URL` or `MATIMO_POSTGRES_HOST`/`_PORT`/`_USER`/`_PASSWORD`/`_DB` |
| Composio | `composio:factory`, `composio:decorator`, `composio:langchain`, `composio:approval` | `COMPOSIO_API_KEY`, connected account IDs |
| Bruno | `bruno:complete`, `bruno:langchain` | Bruno CLI |
| Credentials | `credentials:example` | per-call `credentials` |
| Policy | `policy:demo`, `policy:audit`, `policy:approval-modes`, `policy:response-size` | `OPENAI_API_KEY` for `policy:demo` |
| Skills | `skills:demo`, `skills:registry` | `OPENAI_API_KEY` for `skills:demo` |
| Meta-tools | `meta:flow` | `OPENAI_API_KEY` |
| Self-check | `validate:all`, `validate:policy`, `validate:skills`, `validate:meta` | none |

The exact file behind each script is in [`tools/package.json`](./tools/package.json). Each provider directory has a README with setup details.

---

## Approval in the Examples

0.2.0 asks a human before these calls run:

| Calls | Why |
|-------|-----|
| HTTP `DELETE` tools and `type: command` tools | Secure-mode default |
| Tools with `requires_approval: true` in the YAML (e.g. `github-create-issue`, `edit`, `execute`) | Declared by the tool |
| `postgres-execute-sql` when the `sql` contains a destructive keyword (`INSERT`, `UPDATE`, `DELETE`, `CREATE`, `DROP`, `ALTER`, …) | Keyword scan of `params.sql` |

`SELECT` queries run without a prompt. The GitHub, Microsoft and Postgres `-with-approval` examples install an approval callback that prompts in the terminal; type `y` to approve. `composio:approval` uses policy HITL instead (`onHITL` with `enableHITL`), because Composio tools are POST calls with no `requires_approval`.

For unattended runs, pre-approve the tools you trust by name instead of disabling approval:

```bash
export MATIMO_APPROVED_PATTERNS="postgres-execute-sql"
pnpm postgres:approval
```

See [APPROVAL-SYSTEM.md](../../docs/api-reference/APPROVAL-SYSTEM.md) and [POLICY_AND_LIFECYCLE.md](../../docs/api-reference/POLICY_AND_LIFECYCLE.md).

---

## Policy, Skills and Meta-Tool Demos

| Demo | Shows | Docs |
|------|-------|------|
| [`policy/policy-demo.ts`](./tools/policy/policy-demo.ts) | An agent creates tools; the content rules reject shell, SSRF and reserved-namespace attempts; a human approves the rest | [policy/README.md](./tools/policy/README.md) |
| [`policy/audit-log-demo.ts`](./tools/policy/audit-log-demo.ts) | `JsonlFileSink` hash-chained audit log and `verifyAuditLog` | |
| [`policy/approval-modes-demo.ts`](./tools/policy/approval-modes-demo.ts) | `onApproval`, pre-approved patterns, and `governanceMode` | |
| [`skills/skills-demo.ts`](./tools/skills/skills-demo.ts) | Creating, listing, validating and loading SKILL.md files | [skills/README.md](./tools/skills/README.md) |
| [`meta-flow/meta-tools-integration.ts`](./tools/meta-flow/meta-tools-integration.ts) | validate → create (draft) → approve → reload → execute | [META_TOOLS.md](../../docs/api-reference/META_TOOLS.md) |
| [`agents/langchain-skills-policy-agent.ts`](./tools/agents/langchain-skills-policy-agent.ts) | A LangChain agent using skills and the policy engine together | |

The interactive demos read answers from the terminal. To script them, pipe answers in, e.g. `printf "y\ny\n" | pnpm skills:demo`.

---

## Environment

`tools/.env.example` lists every variable the examples read. The common ones:

```bash
OPENAI_API_KEY=sk-...                 # LangChain examples
SLACK_BOT_TOKEN=xoxb-...
GMAIL_ACCESS_TOKEN=ya29....
GITHUB_TOKEN=ghp_...
MATIMO_POSTGRES_URL=postgresql://user:password@localhost:5432/dbname
```

Any credential can also be set as `MATIMO_<NAME>`, or passed per call with `{ credentials: { NAME: value } }`. See [AUTHENTICATION.md](../../docs/user-guide/AUTHENTICATION.md).

A local Postgres for the SQL examples:

```bash
docker run -d -e POSTGRES_USER=user -e POSTGRES_PASSWORD=pass -e POSTGRES_DB=matimo-test -p 5432:5432 postgres:16
```

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `Cannot find module '@matimo/core'` | Run `pnpm install && pnpm build` in `typescript/`, then `pnpm install` in `examples/tools/` |
| `TOOL_NOT_FOUND` | The tool's package isn't loaded: init with `autoDiscover: true` and check the name with `matimo.listTools()` |
| `Authentication credentials are missing` | Set the variable named in the message (see `.env.example`) |
| A call waits or is rejected for approval | Answer the prompt, or pre-approve with `MATIMO_APPROVED_PATTERNS` |

---

## Adding Your Own Tool

Follow the [Tool Workflow](../../docs/tool-development/TOOL_WORKFLOW.md): YAML in `typescript/packages/<provider>/tools/<tool-name>/definition.yaml` (and the Python copy), tests in both SDKs, then factory, decorator, LangChain and (for writes) with-approval examples here.

## See Also

- [Main README](../../README.md) and [documentation index](../../docs/index.md)
- [SDK Patterns](../../docs/user-guide/SDK_PATTERNS.md)
- [GitHub Discussions](https://github.com/tallclub/matimo/discussions)
