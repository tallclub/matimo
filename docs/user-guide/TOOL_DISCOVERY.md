# Tool Discovery & Filtering

Load tools, then find the ones you need by name, tag, text or definition.

## Loading Tools

```typescript
import { MatimoInstance } from '@matimo/core';

const matimo = await MatimoInstance.init({
  autoDiscover: true,     // built-in tools + every installed @matimo/* package
  toolPaths: ['./tools'], // optional: your own tools
});
console.log(matimo.listTools().length); // e.g. 153 with all providers installed
```

```python
from matimo import Matimo

matimo = await Matimo.init("./tools", auto_discover=True)
print(len(matimo.list_tools()))
```

- **`autoDiscover` / `auto_discover`** loads the core tools (`calculator`, `web`, `read`, `edit`, `execute`, the `matimo_*` meta-tools, …) and the tools of every installed provider package: `@matimo/*` in `node_modules`, or `matimo-*` packages in the Python environment.
- **`toolPaths`** adds directories of your own. They are scanned recursively for `definition.yaml` files, so `tools/my-provider/my_tool/definition.yaml` works.
- **A path alone** (`init('./tools')`) loads only that directory, without the built-in tools.

Tools are read once at start-up. After installing a package, restart the process; after adding YAML files, call `reloadTools()` / `reload()`.

### Provider packages

```bash
npm install @matimo/github @matimo/slack     # TypeScript
pip install matimo-github matimo-slack       # Python
```

Tool names come from each package's YAML, and the packages use both styles:

| Package | Example tools |
|---------|---------------|
| `@matimo/github` | `github-create-issue`, `github-get-repository`, `github-list-repositories` |
| `@matimo/gmail` | `gmail-send-email`, `gmail-list-messages`, `gmail-get-message` |
| `@matimo/slack` | `slack-send-message`, `slack_send_channel_message`, `slack_get_channel_history` |
| `@matimo/microsoft` | `ms_get_email`, `ms_send_email`, `ms_list_files` |

Use `startsWith('slack')` rather than `'slack_'` or `'slack-'` to catch both styles.

---

## Get One Tool

```typescript
const tool = matimo.getTool('calculator');
if (!tool) throw new Error('calculator is not loaded');

console.log(tool.description);
console.log(Object.keys(tool.parameters ?? {})); // ['operation', 'a', 'b', 'expression', 'precision']
console.log(tool.execution.type);                // 'function'
```

```python
tool = matimo.get_tool("calculator")
```

## Search by Text

`searchTools(query)` matches the query against tool names, descriptions and tags:

```typescript
matimo.searchTools('email').map((t) => t.name);
// ['gmail-create-draft', 'gmail-send-email', 'mailchimp-add-list-member', …, 'ms_get_email', …]
```

```python
[t.name for t in matimo.search_tools("email")]
```

## Filter by Tag

```typescript
matimo.getToolsByTag('math').map((t) => t.name); // ['calculator']
```

Python has no `get_tools_by_tag` yet; filter the list:

```python
math_tools = [t for t in matimo.list_tools() if "math" in (t.tags or [])]
```

Both `searchTools` and `getToolsByTag` accept an optional `PolicyContext` as a second argument and then return only the tools that caller may run.

## Filter by Definition

```typescript
const tools = matimo.listTools();

const httpTools = tools.filter((t) => t.execution.type === 'http');
const functionTools = tools.filter((t) => t.execution.type === 'function');
const oauth2Tools = tools.filter((t) => t.authentication?.type === 'oauth2');
const noAuthTools = tools.filter((t) => !t.authentication);
const needsApproval = tools.filter((t) => t.requires_approval === true);
const githubTools = tools.filter((t) => t.name.startsWith('github'));
```

To list the credentials a tool needs (TypeScript): `matimo.getRequiredCredentials('github-create-issue')` → `['GITHUB_TOKEN']`.

## Tool Metadata

```typescript
const tool = matimo.getTool('github-create-issue')!;

tool.name;               // 'github-create-issue'
tool.description;        // 'Create a new issue in a repository'
tool.parameters;         // { owner, repo, title, body, … }
tool.execution;          // { type: 'http', method: 'POST', url: …, headers: …, body: … }
tool.authentication;     // { type: 'bearer', location: 'header' }
tool.requires_approval;  // true
tool.tags;               // tags from the YAML, if any
```

## Giving an Agent the Right Tools

A model works best with a short list, and OpenAI rejects more than 128 tools. Pick by provider, tag or search before converting:

```typescript
const picked = matimo.searchTools('issue').slice(0, 20);
const tools = await convertToolsToLangChain(picked, matimo);
```

Agents can also search for themselves with the `matimo_search_tools` and `matimo_get_tool` meta-tools, and load guidance with the skill meta-tools; see [META_TOOLS.md](../api-reference/META_TOOLS.md).

## Next Steps

- [SDK Patterns](./SDK_PATTERNS.md) — factory, decorator and LangChain usage
- [Tool Specification](../tool-development/TOOL_SPECIFICATION.md) — the fields you can filter on
- [Authentication](./AUTHENTICATION.md) — credentials per provider
