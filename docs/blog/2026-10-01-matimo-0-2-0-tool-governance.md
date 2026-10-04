---
layout: default
title: "Matimo OSS 0.2.0: tool governance, on by default"
description: "Matimo OSS 0.2.0 asks a human before DELETE and shell tools run, stops an agent approving its own tool, and writes a hash-chained audit log you can verify. TypeScript and Python."
date: 2026-10-01
---

# Matimo OSS 0.2.0: tool governance, on by default

Most agent frameworks make it easy to give an agent a tool. Few of them make it easy to answer the questions that come right after: Did a human approve that delete? Could the agent have approved its own tool? Can I trust the log of what ran?

Matimo OSS 0.2.0 is about making those answers true, in both the TypeScript and Python SDKs.

## What changed

**Risky calls now ask first.** An HTTP `DELETE` tool or a shell-command tool asks for approval on every call unless its YAML says `requires_approval: false`. With no one to answer, the call is refused, not run. Here is the real output from the no-key demo (`pnpm policy:approval-modes`):

```
2. Secure mode (secure) with no approval callback
   ⛔ shell_echo: Destructive operation requires approval: shell_echo

4. A per-call onApproval overrides the instance callback
   🔒 per-call callback declines delete_post
   ⛔ delete_post: Operation rejected by approval handler: delete_post
```

**An agent can't approve its own tool.** When an agent writes a new tool at runtime, someone else has to approve it. `matimo_approve_tool` refuses a tool the same agent created, and no setting such as `MATIMO_AUTO_APPROVE` can skip that prompt. Roles like `admin` are set by your application, never read from what the agent writes. One caveat worth knowing: the self-approval check needs your app to pass the agent's `agentId`. Without a context, the human approval prompt is the only gate, so route it to a real person.

**An audit log you can verify.** Every call ends in a `tool:executed` or `tool:execution_failed` event. Add a `JsonlFileSink` and each event is written to a hash-chained file with secrets redacted. From the Python demo (`audit_log_demo.py`):

```
{'valid': True, 'entries': 5, 'line': None, 'reason': None}
After editing line 2: {'valid': False, 'entries': 1, 'line': 2, 'reason': 'hash does not match the entry'}
...
{"user": "ada", "apiKey": "[REDACTED]", "headers": {"Authorization": "[REDACTED]"}}
```

An edited, removed or reordered line is found. This makes the log tamper-evident, not tamper-proof: someone who can rewrite the whole file can rebuild the chain, so keep the log where the agent host can't write.

**The same rules in both SDKs.** Shared fixtures in `conformance/` pin approval, quarantine, events and the audit chain, and both SDKs are tested against them. A log written by one SDK verifies in the other.

**Also in 0.2.0:** per-call and per-instance approval callbacks, MCP approval through elicitation instead of telling the model to retry, skill search and loading as meta-tools (15 in all), MCP tool annotations and structured errors, a response-size guardrail, and Agno support in Python.

## Upgrading

This is a minor version with behaviour changes. If you have DELETE or command tools that used to run without a prompt, they now ask. Read [Upgrading to 0.2.0](https://docs.matimo.dev/api-reference/POLICY_AND_LIFECYCLE#upgrading-to-020) first. Setting `governanceMode: 'legacy'` restores the old default while you migrate, and `requires_approval: false` opts a single tool out.

```bash
npm install @matimo/core     # TypeScript
pip install matimo           # Python
```

## Try it with no API key

```bash
cd typescript/examples/tools
pnpm policy:approval-modes   # who gets asked, and what happens with no one to ask
pnpm policy:audit            # tamper detection on a hash-chained log
```

## What Matimo OSS is, and isn't

Matimo OSS is an MIT-licensed layer that runs inside your process. It governs tool calls; it doesn't replace your own authentication or hold your credentials. It has no compliance certifications. If you want managed integrations and OAuth at scale, Matimo can wrap a service such as Composio's catalog under the same policy layer, using your own key.

Source, docs and the full 0.2.0 notes: [github.com/tallclub/matimo](https://github.com/tallclub/matimo) and [docs.matimo.dev](https://docs.matimo.dev). Questions or a security report? [Discord](https://discord.gg/3JPt4mxWDV) or the repo's security page.
