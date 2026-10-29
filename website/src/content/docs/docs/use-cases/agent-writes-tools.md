---
title: "Let an agent write tools safely"
description: "An agent can draft a new tool with matimo_create_tool, but it stays a draft until a reviewer approves it and tools are reloaded. The exact flow in TypeScript and Python."
---
**The job:** let an agent create a new capability at runtime, without letting it run unreviewed code.

The 15 [meta-tools](/docs/api-reference/meta-tools/) are in both SDKs. The flow below was run with a plain `pip install matimo` 0.2.0 and with the TypeScript SDK.

## The flow

1. The agent calls `matimo_create_tool` with a name and the tool YAML.
2. The tool is written as a **draft**: `approvalState: pending`, `riskLevel: high`.
3. It is **not runnable**. Calling it reports "not found".
4. A reviewer calls `matimo_approve_tool`, then `matimo_reload_tools`.
5. The tool now loads and runs.

```typescript
const matimo = await MatimoInstance.init({
  toolPaths: ['./matimo-tools'],
  autoDiscover: true,
  onApproval: async (request) => askReviewer(request),
});

const created = await matimo.execute('matimo_create_tool', { name: 'fetch-weather', yaml_content });
// created.path shows where it was written; that directory must be in toolPaths
await matimo.execute('matimo_approve_tool', { name: 'fetch-weather' });
await matimo.execute('matimo_reload_tools', {});
await matimo.execute('fetch-weather', { city: 'Paris' });
```

```python
matimo = await Matimo.init(
    tool_paths=["./matimo-tools"],
    auto_discover=True,
    on_approval=on_approval,
)

await matimo.execute("matimo_create_tool", {"name": "fetch-weather", "yaml_content": yaml_content})
await matimo.execute("matimo_approve_tool", {"name": "fetch-weather"})
await matimo.execute("matimo_reload_tools", {})
await matimo.execute("fetch-weather", {"city": "Paris"})
```

## Who may approve

When your host passes a context that carries the agent's `agentId`, the agent that created a tool cannot approve it, even with the `admin` role. A different agent with the `admin` role can. When your host passes no context, nothing checks who is calling, and only the approval prompt protects the step. Roles are strings your host puts in the context. Matimo has no user accounts. See [Where roles come from](/docs/api-reference/policy-and-lifecycle/#where-roles-come-from).

## Things that trip people up

- Set a stable `MATIMO_APPROVAL_SECRET`. Approve and reload in the same process, or approvals will not match.
- Keep the directory the tool was written to in `toolPaths` (`tool_paths`). Otherwise the new tool reports not found after reload.
- Approving is itself a call that needs approval. With no `onApproval`, it fails closed.
- Editing an approved tool's definition invalidates its approval. It must be approved again.

## Read next

- [Meta-Tools reference](/docs/api-reference/meta-tools/)
- [Policy Engine and Tool Lifecycle](/docs/api-reference/policy-and-lifecycle/)
- [Skills](/docs/skills/skills/): let an agent write and load knowledge files too
