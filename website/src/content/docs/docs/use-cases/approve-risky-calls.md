---
title: "Require approval for risky agent calls"
description: "Make an agent ask a person before it runs an HTTP DELETE or a shell command, and keep a hash-chained record of what was approved or denied."
---
**The job:** your agent can call real tools, and you want a person to say yes before the dangerous ones run.

Since Matimo 0.2.0 this is on by default. HTTP `DELETE` tools and command (shell) tools ask on every call. A tool can also opt in with `requires_approval: true` in its YAML.

## 1. Give it someone to ask

A call that needs approval and has nobody to ask fails closed. You supply the person (or the UI) as a callback.

```typescript
import { MatimoInstance, JsonlFileSink, verifyAuditLog, type ApprovalRequest } from '@matimo/core';

const matimo = await MatimoInstance.init({
  toolPaths: ['./tools'],
  onApproval: async (request: ApprovalRequest) => {
    // request.toolName, request.description, request.params
    return await askReviewer(request); // true = run it, false = refuse
  },
  auditSink: new JsonlFileSink('./audit.jsonl'),
});
```

```python
from matimo import ApprovalRequest, Matimo, JsonlFileSink, verify_audit_log

async def on_approval(request: ApprovalRequest) -> bool:
    # request.tool_name, request.description, request.params
    return await ask_reviewer(request)

matimo = await Matimo.init(
    "./tools",
    on_approval=on_approval,
    audit_sink=JsonlFileSink("./audit.jsonl"),
)
```

If the callback returns `false`, the call is refused and the agent gets an error.

## 2. Check the record

Every call ends in an audit event. With `JsonlFileSink` each line is linked to the one before it, and verification reports the first line that was edited.

```typescript
verifyAuditLog('./audit.jsonl'); // { valid: true, entries: 3 }
```

```python
verify_audit_log("./audit.jsonl")  # AuditLogVerification(valid=True, entries=3)
```

The [home page demo](https://matimo.dev/#try-it) replays a real run of this flow.

## Limits

- The log is **tamper evident, not tamper proof.** Verification shows an edit or a deleted line. It does not prevent one.
- You write the reviewer. Matimo asks; it does not decide who your reviewers are.
- With no `onApproval`, a call that needs approval fails. That is the intended behavior.
- `MATIMO_AUTO_APPROVE=true` approves everything unseen. Use it only in throwaway test environments.

## Read next

- [Approval System](/docs/api-reference/approval-system/): which calls need a human, patterns and testing
- [Policy Engine and Tool Lifecycle](/docs/api-reference/policy-and-lifecycle/): risk classes, security rules and the audit log
