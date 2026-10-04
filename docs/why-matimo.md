---
layout: default
title: "Why Matimo OSS: tool governance for AI agents"
description: "What Matimo OSS does, who it is for, how it differs from a plain tool library or a hosted tool gateway, and what it does not do."
---

# Why Matimo OSS

Matimo OSS is an open-source (MIT) SDK that governs the tool calls an AI agent makes. It runs inside your process, in TypeScript and Python, and works with LangChain, CrewAI, Agno (Python) and any MCP client.

## The problem

Giving an agent a tool is easy. The questions that follow are harder: who approved that delete, could the agent have approved its own tool, and can you trust the record of what ran?

## What Matimo OSS does

- **Classifies every call by risk** (low, medium, high, critical) and checks it against deterministic security rules.
- **Asks a human for risky calls.** Since 0.2.0, HTTP `DELETE` and shell-command tools ask before every call unless the tool says otherwise. With nobody to answer, the call is refused. See [Approval System](api-reference/APPROVAL-SYSTEM).
- **Stops an agent approving its own tool.** Roles such as `admin` are set by your application, never read from the agent's text. See [Where roles come from](api-reference/POLICY_AND_LIFECYCLE#where-roles-come-from).
- **Writes an audit log you can verify.** Each event is chained to the previous one by SHA-256, with secrets redacted, and `verifyAuditLog()` finds an edited, removed or reordered line.
- **Defines a tool once** in YAML and runs it in TypeScript, Python, LangChain, CrewAI, Agno and MCP, with the same rules in each. Shared fixtures in `conformance/` keep both SDKs aligned.
- **Lets agents extend themselves safely:** a new tool starts as a draft, is validated, and must be approved by someone other than the agent that created it. See [Meta-Tools](api-reference/META_TOOLS).

It ships 129 tools across 10 provider packages (Slack, Gmail, GitHub, Notion, HubSpot, Postgres, Twilio, Mailchimp, Microsoft Graph, Bruno), plus built-in tools and 15 meta-tools.

## Who it is for

| If you are | You get |
|---|---|
| Building agents | One tool definition for every framework, and approval for destructive actions without writing it yourself |
| Responsible for security or platform | A policy layer you can read, host and test, with a log you can verify |
| An AI agent or coding assistant | Facts and honest limits in [llms.txt](llms.txt) |

## How it fits with other tools

- **A plain tool library** gives an agent functions to call. Matimo adds the checks before and the record after.
- **A hosted tool gateway** runs governance on the vendor's servers. Matimo OSS runs in your process, so no vendor sits in the call path, and the log is a file you hold. Matimo can wrap a third-party catalog such as Composio's under the same policy layer, using your own key (`@matimo/composio`).

## What Matimo OSS does not do

- It has no compliance certifications.
- It governs tool calls. It does not replace your own authentication, and you supply the credentials.
- The audit log is tamper-evident, not tamper-proof: someone who can rewrite the whole file can rebuild the chain, so keep it where the agent host can't write.
- A call that needs approval fails closed if nobody can answer. Send the prompt to a real person.
- Agno support is Python-only. The [release notes](RELEASES) list the other differences between the SDKs.

## Try it

```bash
npm install @matimo/core     # TypeScript
pip install matimo           # Python
```

Then follow the [Quick Start](getting-started/QUICK_START), or read [what changed in 0.2.0](blog/2026-10-01-matimo-0-2-0-tool-governance). To see approval and audit working with no API key, run `pnpm policy:approval-modes` and `pnpm policy:audit` from `typescript/examples/tools`.
