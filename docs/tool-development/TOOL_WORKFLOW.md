# Tool Development Workflow

The step-by-step process for adding a tool to Matimo and submitting it. Every tool ships in **both** SDKs with tests and examples. [ADDING_TOOLS.md](./ADDING_TOOLS.md) has the detail for each step; this page is the checklist.

```
1. Read the provider's API docs
2. Write definition.yaml (TypeScript and Python copies)
3. Validate
4. Add executor code (function tools only)
5. Write tests (both SDKs, mocked HTTP)
6. Add examples (both SDKs)
7. Run the full gate
8. Open the PR
```

---

## Step 1: Read the API Docs

Get the endpoint, method, parameters, response shape, auth and rate limits from the provider's official reference. Don't guess field names.

## Step 2: Write `definition.yaml`

```
typescript/packages/<provider>/tools/<tool-name>/definition.yaml
python/packages/<provider>/src/matimo_<provider>/tools/<tool-name>/definition.yaml   # same YAML
```

Use `type: http` unless the tool needs several calls, response shaping or file I/O.

```yaml
name: provider_get_item
description: Get one item by ID
version: '1.0.0'

parameters:
  item_id:
    type: string
    required: true
    description: The item's ID

execution:
  type: http
  method: GET
  url: 'https://api.provider.com/v1/items/{item_id}'
  headers:
    Authorization: 'Bearer {PROVIDER_API_KEY}'
  timeout: 15000

authentication:
  type: api_key
  location: header
  name: Authorization

notes:
  env: PROVIDER_API_KEY
```

Governance:
- **Every tool needs a risk classification.** Writes are `medium` automatically; DELETE and other destructive calls must declare `requires_approval: true`; function tools must declare `risk:`.
- **Leave `status` unset.** Only `draft`, `approved` and `deprecated` are valid, and TypeScript skips a tool with any other value.

Field reference: [TOOL_SPECIFICATION.md](./TOOL_SPECIFICATION.md).

## Step 3: Validate

```bash
cd typescript && pnpm validate-tools
```

It checks every definition against the schema, and that DELETE tools declare `requires_approval: true` and function tools declare `risk:`. Unknown keys (such as `timeout_ms`) are dropped silently, so compare your YAML with [TOOL_SPECIFICATION.md](./TOOL_SPECIFICATION.md) too.

## Step 4: Executor Code (function tools only)

HTTP tools need no code. A `type: function` tool has two files beside its YAML:

| SDK | File | Entry point |
|-----|------|-------------|
| TypeScript | `<tool-name>.ts` (compiled to `.js`; `code:` points at the `.js`) | `export default async function (params, context?)` |
| Python | `<tool-name>.py` (`code:` points at it) | `async def run(params, context=None)` |

`context` carries the call's `credentials` and the caller's `policyContext`. See `typescript/packages/microsoft/tools/` for a working example.

Command tools (`type: command`) exist for shell CLIs, ask for approval on every call, and are rarely the right choice for a provider package.

## Step 5: Tests

| SDK | Location | Framework |
|-----|----------|-----------|
| TypeScript | `typescript/packages/<provider>/test/unit/<tool-name>.test.ts` | Jest, `jest.mock('axios')` |
| Python | `python/packages/<provider>/tests/unit/test_<tool_name>.py` | pytest, `respx` |

Cover: the YAML loads, required parameters, the request sent (method, URL, body), the success result, an error status, and — for tools that need approval — that a refused approval sends nothing. Never call a live API. Copy the patterns in [TESTING.md](./TESTING.md).

## Step 6: Examples

| SDK | Files |
|-----|-------|
| TypeScript | `typescript/examples/tools/<provider>/<provider>-factory.ts`, `-decorator.ts`, `-langchain.ts`, and `-with-approval.ts` for write/delete tools |
| Python | `python/examples/native/<provider>/…`, `python/examples/langchain/<provider>/…`, `python/examples/crewai/<provider>/…` |

Add to the existing files when the provider already has them.

## Step 7: Run the Full Gate

```bash
cd typescript && pnpm validate-tools && pnpm lint && pnpm test:coverage
cd python && uv run ruff check . && uv run pytest --cov
```

TypeScript coverage must stay at or above the thresholds in `typescript/jest.config.cjs` (lines 95%, functions 97%, branches 87%, statements 95%). Aim for full coverage of the new tool.

## Step 8: Open the PR

```bash
git checkout -b feat/<provider>-<tool-name>
git add typescript/packages/<provider> python/packages/<provider> typescript/examples python/examples
git commit -m "feat(<provider>): add <tool-name>"
git push -u origin feat/<provider>-<tool-name>
```

Commits follow Conventional Commits (enforced by commitlint); see [COMMIT_GUIDELINES.md](../community/COMMIT_GUIDELINES.md).

PR description:

```markdown
## What
<tool-name>: <one line> (<METHOD> <endpoint>)

## Risk
low / medium / high — requires_approval: yes/no, and why

## Testing
- [ ] pnpm validate-tools
- [ ] pnpm lint && pnpm test:coverage
- [ ] uv run ruff check . && uv run pytest
- [ ] Examples run (or explain why they need credentials)
```

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `pnpm validate-tools` fails | Run it and read the path and message; compare with [TOOL_SPECIFICATION.md](./TOOL_SPECIFICATION.md) |
| `HTTP DELETE tools must declare requires_approval: true` | Add `requires_approval: true` |
| `function tools must declare risk` | Add `risk: low | medium | high | critical` |
| The tool loads in Python but not TypeScript | Remove an invalid `status` such as `stable` |
| A key in the YAML has no effect | It isn't in the schema and was dropped |
| `Authentication credentials are missing` in a test | Set the variable in the test, or pass `credentials` |
| Coverage drops below the threshold | Add tests for the uncovered branches the report lists |

## See Also

- [ADDING_TOOLS.md](./ADDING_TOOLS.md) — the detailed guide
- [TOOL_SPECIFICATION.md](./TOOL_SPECIFICATION.md) — every YAML field
- [TESTING.md](./TESTING.md) — test patterns that run
- [POLICY_AND_LIFECYCLE.md](../api-reference/POLICY_AND_LIFECYCLE.md) — risk levels and approval
