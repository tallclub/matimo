# Meta-Tools Integration Flow

**The full lifecycle of a tool an agent writes itself: validate → create → reload → human approval → reload → use.**

A LangChain agent (gpt-4o-mini) gets high-level goals, not step-by-step instructions, and works through Matimo's meta-tools. You are the human reviewer: the terminal asks you before anything that needs approval.

## What It Shows

```
Goals the agent receives:
  ├─ "Create a safe HTTP GET tool"            → validated, created, approved by you, used
  ├─ "Create a shell command tool"            → rejected by policy (no-command-execution)
  ├─ "Create a file reader using cat"         → rejected by policy (no-command-execution)
  ├─ "Create two safe tools"                  → validated, created, approved by you
  └─ "List the tools and use one"             → listed and called (you approve the call)

Meta-tools the agent uses:
  ├─ matimo_validate_tool    → check the YAML against schema and policy rules
  ├─ matimo_create_tool      → write a draft tool to disk (asks you first)
  ├─ matimo_reload_tools     → reload the registry (asks you first)
  ├─ matimo_approve_tool     → approve a draft (always asks you; you are the reviewer)
  └─ matimo_list_user_tools  → list what was created

Policy for agent-written tools:
  ├─ ✅ type: http only, GET or POST
  ├─ ❌ no command or function tools
  ├─ ❌ no internal or cloud-metadata addresses (SSRF)
  └─ ❌ no matimo_* names
```

A created tool is a **draft**. Calling it before approval fails with `Draft tool "<name>" requires admin role`. After you approve it and the registry reloads, each call still asks you, because agent-written tools keep `requires_approval: true`.

## Running It

```bash
# From typescript/examples/tools/, with OPENAI_API_KEY in .env
pnpm meta:flow
```

Answer `y` to approve or `n` to decline at each prompt. Read each prompt before answering: the agent can also reach core tools such as `execute` and `edit`, and a `y` lets that call run. Declining is always safe — the agent is told the call was refused and adapts.

## Missions

| # | Goal | What should happen |
|---|------|--------------------|
| 1 | Create `weather_fetch` (GET api.weatherapi.com) | Validate → create (you approve) → reload → `matimo_approve_tool` (you approve) → reload |
| 2 | Create `shell_exec` (bash) | `matimo_validate_tool` reports `no-command-execution`; the agent stops |
| 3 | Create `file_reader` (`cat`) | Same rule; the agent explains why it can't |
| 4 | Create `user_lookup` and `github_stars` | The full lifecycle for each, with your approvals |
| 5 | List the tools and call one | `matimo_list_user_tools`, then a call you approve |

The agent decides the exact calls, so runs differ. A mission can also end early if you decline something.

## Code Structure

```
meta-flow/meta-tools-integration.ts
  ├─ interactiveApproval   → the terminal prompt passed as onApproval
  ├─ AGENT_SYSTEM_PROMPT   → the meta-tools, their inputs, and the lifecycle
  ├─ runMission            → the tool-calling loop (max 12 iterations)
  └─ main                  → init (untrustedPaths = a temp tools dir), 5 missions, summary
```

The temp directory is deleted at the end. Approvals are recorded with the running Matimo instance; without `MATIMO_APPROVAL_SECRET` they last for this process only.

## Common Issues

| Issue | Solution |
|-------|----------|
| "OpenAI API timeout" | Increase `timeout` in the `ChatOpenAI` config (30s) |
| The agent stops before finishing | It hit `MAX_ITERATIONS` (12), or you declined a step |
| `Draft tool ... requires admin role` | The tool was not approved yet: `matimo_approve_tool`, then reload |
| A created tool is missing after reload | Check `rejected` in the reload result: a policy rule blocked it |
| No terminal prompt | `onApproval` must be passed to `MatimoInstance.init()` |

## See Also

- [policy-demo.ts](../policy/policy-demo.ts) — policy engine missions
- [approval-modes-demo.ts](../policy/approval-modes-demo.ts) — who approves, without an LLM
- [skills-demo.ts](../skills/skills-demo.ts) — skills lifecycle
- [Meta-tools reference](../../../../docs/api-reference/META_TOOLS.md)
