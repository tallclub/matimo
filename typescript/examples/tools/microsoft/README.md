# Microsoft Graph Tools Examples

Example directory contains **4 example patterns** showing different ways to use Matimo's
Microsoft Graph tools:
1. **Factory Pattern** (`microsoft-factory.ts`) — Direct SDK execution (simplest)
2. **Decorator Pattern** (`microsoft-decorator.ts`) — Class-based with `@tool` decorators
3. **LangChain Pattern** (`microsoft-langchain.ts`) — AI-driven ReAct agent with OpenAI
4. **Approval Pattern** (`microsoft-with-approval.ts`) — Human-in-the-loop (HITL) approval flow

All examples exercise the 9 `ms_*` tools — search, mail, files/OneDrive/SharePoint,
Teams, calendar, and SharePoint publishing — against a real Microsoft Graph tenant.

## 🔐 Step 1: Register an App and Get a Graph Access Token

Matimo never performs the OAuth code exchange itself — you connect Microsoft through
your own app registration (or your Matimo deployment / Nova) and provide the resulting
**delegated** access token at execution time.

### Register an app in Microsoft Entra

1. Go to the [Microsoft Entra admin center](https://entra.microsoft.com) →
   **Applications → App registrations → New registration**
2. Add a redirect URI (e.g. `http://localhost:3000/callback` for a desktop/native flow)
3. Under **API permissions**, add the **delegated** Microsoft Graph scopes you need
   (see table below) and grant admin consent if required
4. Run an OAuth2 delegated flow (e.g. the [Microsoft Graph Explorer](https://developer.microsoft.com/en-us/graph/graph-explorer)
   sign-in, or the auth code/device-code flow against your registered app) to obtain
   a **delegated access token** for the signed-in user

> ⚠️ A real Graph v1.0 access token is a **JWT** — three base64url segments joined by
> dots, e.g. `eyJ0eXAiOiJKV1Qi....<payload>....<signature>`. If your token has no dots
> (e.g. an `EwB…`-prefixed compact SSO/MSA ticket), Graph will reject it with
> `401 InvalidAuthenticationToken — "JWT is not well formed, there are no dots (.)"`.
> Make sure you're copying a **Graph-scoped Bearer token**, not an MSA/SSO ticket.

### Required scopes by tool

| Tool | Scope(s) | Risk |
|------|----------|------|
| `ms_search_knowledge` | `Sites.Read.All`, `Files.Read.All` | low |
| `ms_read_file` | `Files.Read.All` | low |
| `ms_list_files` | `Files.Read.All` | low |
| `ms_get_email` | `Mail.Read` | low |
| `ms_send_email` | `Mail.Send` | **high** (approval) |
| `ms_send_teams_message` | `ChannelMessage.Send` | medium |
| `ms_create_document` | `Files.ReadWrite` | medium |
| `ms_create_calendar_event` | `Calendars.ReadWrite` | medium |
| `ms_publish_to_sharepoint` | `Sites.Manage.All` | **high** (approval) |

## 🔑 Step 2: Set Environment Variables

Create a `.env` file in `examples/tools/` (or export directly):

```env
MICROSOFT_GRAPH_ACCESS_TOKEN=eyJ0eXAiOiJKV1Qi...your-jwt-access-token...
OPENAI_API_KEY=sk-...your-openai-key...
```

`OPENAI_API_KEY` is only required for the LangChain example. Delegated Graph access
tokens are short-lived (typically ~1 hour) — re-issue one if you start seeing
`AUTH_FAILED` / `401` errors.

## 🧪 Step 3: Run the Examples

```bash
cd typescript/examples/tools
pnpm install

# Factory Pattern — direct execution, simplest
pnpm microsoft:factory

# Decorator Pattern — class-based @tool methods
pnpm microsoft:decorator

# LangChain Pattern — OpenAI ReAct agent decides which tools to call
pnpm microsoft:langchain

# Approval Pattern — HITL approval flow for high-risk tools
pnpm microsoft:approval
```

## 📚 Understanding the Patterns

### 1. Factory Pattern (`microsoft-factory.ts`)

**Best for:** scripts, quick tests, CLI tools — direct execution with explicit parameters.

```typescript
const matimo = await MatimoInstance.init({ autoDiscover: true });

const search = await matimo.execute('ms_search_knowledge', {
  query: 'Q3 budget filetype:xlsx',
  top: 5,
});

const inbox = await matimo.execute('ms_get_email', {
  top: 5,
  filter: 'isRead eq false',
});
```

**File:** [microsoft-factory.ts](microsoft-factory.ts)

### 2. Decorator Pattern (`microsoft-decorator.ts`)

**Best for:** object-oriented agents — class methods auto-route through Matimo.

```typescript
import { setGlobalMatimoInstance, tool } from '@matimo/core';

class MicrosoftGraphAgent {
  @tool('ms_search_knowledge')
  async searchKnowledge(query: string, top?: number) { /* auto-executed */ }

  @tool('ms_get_email')
  async getEmail(top?: number, filter?: string) { /* auto-executed */ }
}

const agent = new MicrosoftGraphAgent();
await agent.searchKnowledge('quarterly report', 3);
```

**File:** [microsoft-decorator.ts](microsoft-decorator.ts)

### 3. LangChain Pattern (`microsoft-langchain.ts`)

**Best for:** autonomous AI agents that reason about which Graph operation to perform.

```typescript
import { createAgent } from 'langchain';
import { ChatOpenAI } from '@langchain/openai';
import { convertToolsToLangChain } from '@matimo/core';

const matimo = await MatimoInstance.init({ autoDiscover: true });
const msTools = matimo.listTools().filter(t => t.name.startsWith('ms_'));
const langchainTools = await convertToolsToLangChain(msTools, matimo);

const agent = await createAgent({
  model: new ChatOpenAI({ modelName: 'gpt-4o-mini' }),
  tools: langchainTools,
});

await agent.invoke({
  messages: [{ role: 'user', content: 'How many unread emails do I have?' }],
});
```

**File:** [microsoft-langchain.ts](microsoft-langchain.ts)

> 💡 **Note:** LLM-driven agents (LangChain and CrewAI alike) often wrap raw tool
> failures — e.g. `AUTH_FAILED` from an expired/malformed token — in polished,
> conversational prose ("It seems there was an issue accessing your mailbox due to
> authentication problems…"). A fluent response is *not* proof the underlying Graph
> call succeeded; check the tool-call trace / raw `MatimoError` for the real outcome.

### 4. Approval Pattern (`microsoft-with-approval.ts`)

**Best for:** demonstrating the human-in-the-loop (HITL) flow that gates `risk: high`
tools (`ms_send_email`, `ms_publish_to_sharepoint`) before they ever reach the executor.

```typescript
const matimo = await MatimoInstance.init({
  autoDiscover: true,
  onApprovalRequest: createApprovalCallback(), // prompts in the terminal
});

// Routed through the approval handler BEFORE execution:
await matimo.execute('ms_send_email', {
  to: ['alice@contoso.com'],
  subject: 'Weekly status update',
  body: 'Here is the summary for this week...',
});
```

Three ways to resolve approval:
- **Interactive** (default): you'll be prompted to approve/reject each high-risk call
  in the terminal — requires a TTY (won't work under `nohup`/non-interactive shells)
- **Auto-approve everything** (CI / unattended runs):
  ```bash
  MATIMO_AUTO_APPROVE=true pnpm microsoft:approval
  ```
- **Pre-approve specific tools** by name pattern:
  ```bash
  MATIMO_APPROVED_PATTERNS="ms_send_email,ms_publish_to_sharepoint" pnpm microsoft:approval
  ```

> ⚠️ Without a TTY *and* without `MATIMO_AUTO_APPROVE=true`, approval requests are
> auto-**rejected** with `"non-interactive environment (no terminal)"` — a different
> failure mode than `AUTH_FAILED`. Don't confuse the two when debugging.

**File:** [microsoft-with-approval.ts](microsoft-with-approval.ts)

## 🔧 Available Tools

| Tool | Description | Risk | Graph endpoint |
|------|-------------|------|----------------|
| `ms_search_knowledge` | Search SharePoint sites, OneDrive/SharePoint files, and list items | low | `POST /search/query` |
| `ms_read_file` | Read a OneDrive/SharePoint file's contents (plain-text formats only) | low | `GET /drives/{id}/items/{id}/content` |
| `ms_list_files` | List the children of a OneDrive/SharePoint folder | low | `GET /drives/{id}/items/{id}/children` |
| `ms_get_email` | List messages in the signed-in user's mailbox | low | `GET /me/messages` |
| `ms_send_email` | Send an email as the signed-in user | **high** (approval) | `POST /me/messages` + `/send` |
| `ms_send_teams_message` | Post (or reply to) a message in a Teams channel | medium | `POST /teams/{id}/channels/{id}/messages` |
| `ms_create_document` | Upload a small file to OneDrive/SharePoint (≤4 MB) | medium | `PUT /drives/{id}/items/{id}:/{name}:/content` |
| `ms_create_calendar_event` | Create a calendar event, optionally as a Teams meeting | medium | `POST /me/events` |
| `ms_publish_to_sharepoint` | Create and publish a SharePoint site page | **high** (approval) | `POST /sites/{id}/pages` + `/publish` |

See [packages/microsoft/README.md](../../../packages/microsoft/README.md) for full
tool documentation and the OAuth2 provider configuration.

## 🛠️ Troubleshooting

### `AUTH_FAILED` / `401 InvalidAuthenticationToken`
Your token is missing, expired, or malformed:
- Confirm `MICROSOFT_GRAPH_ACCESS_TOKEN` is set and non-empty
- Confirm it's a **JWT** (three dot-separated base64url segments) — not an opaque
  `EwB…` SSO/MSA ticket. Verify quickly without printing the secret:
  ```bash
  awk -F. '{print NF-1" dot(s)"}' <<< "$MICROSOFT_GRAPH_ACCESS_TOKEN"   # expect "2 dot(s)"
  ```
- Re-issue a fresh delegated token — Graph access tokens are short-lived (~1 hour)

### `403 Forbidden` / "Microsoft Graph access denied"
Your token is well-formed but lacks the scope the tool needs — recheck the
**Required scopes by tool** table above and re-consent with the missing permission.

### "non-interactive environment (no terminal)"
You ran `microsoft-with-approval.ts` (or any flow touching `ms_send_email` /
`ms_publish_to_sharepoint`) without a TTY and without `MATIMO_AUTO_APPROVE=true`.
Either run interactively or set `MATIMO_AUTO_APPROVE=true`.

### "OpenAI API error" (LangChain example)
```bash
export OPENAI_API_KEY="sk-your-openai-key-here"
```

### `entity_types` rejected by `ms_search_knowledge`
The tool validates `entity_types` against `["driveItem", "listItem", "site", "list", "drive"]`
— values like `"message"` are rejected by design, since the tool's declared scopes
(`Sites.Read.All`, `Files.Read.All`) don't cover mail search. Use `ms_get_email` for mail.

## 🔗 Related Resources

- [Microsoft Graph API overview](https://learn.microsoft.com/en-us/graph/overview)
- [Microsoft Graph permissions reference](https://learn.microsoft.com/en-us/graph/permissions-reference)
- [Microsoft Entra admin center](https://entra.microsoft.com) (app registration)
- [Graph Explorer](https://developer.microsoft.com/en-us/graph/graph-explorer) (try API calls interactively)
- [Package Docs](../../../packages/microsoft/README.md)
- [Matimo Documentation](https://matimo.dev/docs)

---

**Questions?** See [CONTRIBUTING.md](../../../../CONTRIBUTING.md) or review the Matimo core documentation.
