# Approval System

Some tool calls should not run until a person says yes: deleting data, running a shell command, approving a tool an agent wrote. Matimo's approval system decides **which calls need a human**, and **who answers**. It works the same way in the TypeScript and Python SDKs and for every provider.

> **Approval vs. HITL quarantine.** This page covers per-call approval (`onApproval`). The policy engine's separate, risk-based checkpoint — `enableHITL` + `hitlMinRiskLevel` + `onHITL` — is described in [Policy and Lifecycle](POLICY_AND_LIFECYCLE.md). When both apply, the HITL check runs first, then approval.

## When a call needs approval

A call needs approval when any of these is true:

| Trigger | Example |
|---------|---------|
| The tool's YAML says `requires_approval: true` | `github-delete-repository`, `execute`, `matimo_create_tool` |
| The YAML doesn't set `requires_approval`, and the tool is an HTTP `DELETE` or a `type: command` tool (secure mode, the 0.2.0 default) | a `delete_post` HTTP tool you define (no built-in tool is a command tool) |
| A destructive keyword appears in the call's `sql` argument, or in `command` for a command tool | `{ sql: 'DROP TABLE users' }` |

`requires_approval: false` opts a tool out of the first two triggers. It does **not** turn off the keyword scan: a call whose `sql` contains `DELETE` still asks.

Check a definition without running it:

```typescript
import { definitionRequiresApproval } from '@matimo/core';
definitionRequiresApproval(tool, 'secure'); // true for DELETE/command tools without requires_approval
definitionRequiresApproval(tool, 'legacy'); // only true when the YAML says requires_approval: true
```

```python
from matimo import definition_requires_approval
definition_requires_approval(tool, "secure")
```

`governanceMode: 'legacy'` (`governance_mode="legacy"`, or `governanceMode: legacy` in `policy.yaml`) restores the pre-0.2.0 default, where DELETE and command tools ask only if their YAML says so. See the [migration guide](POLICY_AND_LIFECYCLE.md).

## Who answers

When a call needs approval, Matimo checks these in order and uses the first that applies:

1. **Pre-approval** — the tool's name matches a pattern in `MATIMO_APPROVED_PATTERNS` (or `MATIMO_AUTO_APPROVE=true`). The call runs without asking.
2. **`onApproval` passed to `execute()`** for this one call.
3. **`onApproval` passed to `MatimoInstance.init()`** (or set later with `setApprovalCallback`).
4. **The process-wide handler's callback** — `getGlobalApprovalHandler().setApprovalCallback()`, kept for older code.
5. **Nobody** — the call is rejected.

`matimo_approve_tool` is never pre-approved, whatever the patterns or `MATIMO_AUTO_APPROVE` say: approving a tool lets agent-written YAML run, so a person always sees it.

### Per-instance callback (recommended)

```typescript
import { MatimoInstance, type ApprovalRequest } from '@matimo/core';

const matimo = await MatimoInstance.init({
  autoDiscover: true,
  onApproval: async (request: ApprovalRequest) => {
    // request.toolName, request.description, request.params
    return await askReviewer(request); // true = run it, false = refuse
  },
});
```

```python
from matimo import ApprovalRequest, Matimo

async def on_approval(request: ApprovalRequest) -> bool:
    # request.tool_name, request.description, request.params
    return await ask_reviewer(request)

matimo = await Matimo.init(auto_discover=True, on_approval=on_approval)
```

Each instance has its own reviewer, so two tenants in one process never share one. The callback can return `false`/`False` or throw to refuse.

### Per-call callback

```typescript
await matimo.execute('delete_post', { id: 1 }, { onApproval: async () => userClickedConfirm });
```

```python
await matimo.execute("delete_post", {"id": 1}, on_approval=confirm_in_ui)
```

Use it when the reviewer depends on the request — a web handler that already has the user's confirmation, for example.

### Pre-approved patterns

```bash
export MATIMO_APPROVED_PATTERNS="get_*,list_*,calculator"
```

Comma-separated globs (`*` matches anything), case-insensitive. A matching tool runs without asking. The variable is read when the process-wide handler is created, so set it before your app starts; in a running process use `getGlobalApprovalHandler().addApprovedPattern('get_*')` (`add_approved_pattern` in Python).

### `MATIMO_AUTO_APPROVE`

`MATIMO_AUTO_APPROVE=true` approves every request unseen (except `matimo_approve_tool`); each instance logs a warning when it starts with it on. It is meant for throwaway test environments only. For CI, prefer an `onApproval` that encodes the test's intent, or `MATIMO_APPROVED_PATTERNS` listing the tools the test may run.

### Skipping the prompt for one call

`execute(tool, params, { approved: true })` (`approved=True`) skips the approval prompt for that call — for a host that has already confirmed the call through its own UI. It skips **only** the prompt: policy denials, draft gates and HITL quarantine still apply.

## What the reviewer sees

```typescript
interface ApprovalRequest {
  toolName: string;                 // 'github-delete-repository'
  description?: string;             // the tool's description from its YAML
  params: Record<string, unknown>;  // the arguments of this call
}
```

Python's `ApprovalRequest` dataclass has the same fields in snake_case: `tool_name`, `description`, `params`.

## Outcomes

| Outcome | Result | Event |
|---------|--------|-------|
| Approved | The call runs | `tool:approval_granted` |
| Callback returns false | `MatimoError`: `Operation rejected by approval handler: <tool>` | `tool:approval_denied` |
| No one to ask | `MatimoError`: `Destructive operation requires approval: <tool>`, with a hint naming `onApproval` and `MATIMO_APPROVED_PATTERNS` | `tool:approval_denied` |

Events reach `onEvent` and the audit sink; see [Types](TYPES.md) for their fields.

## Destructive keywords

The keyword scan upper-cases the `sql` argument (or `command`, for command tools) and looks for each keyword as a substring. Set `MATIMO_APPROVAL_SCAN_ALL_PARAMS=true` to scan every string argument instead.

Built-in keywords in both SDKs: `CREATE`, `DELETE`, `DROP`, `ALTER`, `TRUNCATE`, `UPDATE`, `INSERT`, `UPSERT`, `REPLACE`, `MERGE`, `GRANT`, `REVOKE`, `EDIT`, `WRITE`, `APPEND`, `REMOVE`, `RENAME`, `SHUTDOWN`, `EXECUTE`, `EXEC`. Python's list also has `DESTROY` and `PURGE`.

Because the match is a substring of upper-cased text, a column such as `created_at` contains `CREATE` and makes a `SELECT` ask. Give such a tool its own approval rule rather than relying on the scan.

**TypeScript** reads the list from `destructive-keywords.yaml`, looked up in `./packages/core/`, then `./node_modules/@matimo/core/`, then the working directory, falling back to the built-in list. Write keywords in **upper case**: content is upper-cased before matching, so a lower-case entry never matches. **Python** uses the built-in list; change `matimo.get_global_approval_handler().destructive_keywords` to adjust it.

## In MCP servers

An MCP server asks the person behind the client through an MCP elicitation request. Clients that can't show one get a clear error. See [MCP](../MCP.md#approval-over-mcp) for `trustClientApproval` and the server's `context` option.

## Environment variables

| Variable | Effect |
|----------|--------|
| `MATIMO_APPROVED_PATTERNS` | Comma-separated globs of tools that never ask |
| `MATIMO_AUTO_APPROVE` | `true` approves everything except `matimo_approve_tool`, with a warning — test environments only |
| `MATIMO_APPROVAL_SCAN_ALL_PARAMS` | `true` scans every string argument for destructive keywords |

## Testing approval

```typescript
test('asks before deleting', async () => {
  const asked: string[] = [];
  const matimo = await MatimoInstance.init({
    toolPaths: ['./tools'],
    onApproval: async (request) => {
      asked.push(request.toolName);
      return false;
    },
  });

  await expect(matimo.execute('delete_post', { id: 1 })).rejects.toThrow(
    'Operation rejected by approval handler'
  );
  expect(asked).toEqual(['delete_post']);
});
```

```python
async def test_asks_before_deleting() -> None:
    asked: list[str] = []

    async def decline(request: ApprovalRequest) -> bool:
        asked.append(request.tool_name)
        return False

    matimo = await Matimo.init("./tools", on_approval=decline)
    with pytest.raises(MatimoError, match="rejected by approval handler"):
        await matimo.execute("delete_post", {"id": 1})
    assert asked == ["delete_post"]
```

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `Destructive operation requires approval: <tool>` | The call needs approval and nothing can answer | Pass `onApproval` to `init()`, or pre-approve the tool with `MATIMO_APPROVED_PATTERNS` |
| A read-only SQL query asks | The text contains a keyword, e.g. `created_at` | Expected with substring matching; approve it, or use a dedicated read-only tool |
| A tool with `requires_approval: false` still asks | The keyword scan found a destructive keyword | Expected: the flag doesn't disable the scan |
| A DELETE tool started asking after upgrading | Secure mode, new in 0.2.0 | Add an `onApproval`, set `requires_approval: false` on the tool, or use `governanceMode: 'legacy'` while migrating |
| A custom keyword in `destructive-keywords.yaml` never triggers | It is lower-case | Write it in upper case |
| `matimo_approve_tool` asks even with `MATIMO_AUTO_APPROVE=true` | By design | A person must approve every tool approval |

## See Also

- [Policy and Lifecycle](POLICY_AND_LIFECYCLE.md) — risk levels, HITL quarantine, execution gates, migration to 0.2.0
- Runnable demos (no API keys): `typescript/examples/tools/policy/approval-modes-demo.ts`, `python/examples/native/policy/approval_modes_demo.py`
- Provider examples: `typescript/examples/tools/postgres/postgres-with-approval.ts`, `typescript/examples/tools/github/github-with-approval.ts`
