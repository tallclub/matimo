# Security — Matimo

How to report a vulnerability, what Matimo's governance layer protects against today, what it does not, and the rules contributors follow. Applies to `@matimo/*` 0.2.x (TypeScript) and `matimo` 0.2.x (Python).

## Table of Contents

- [Reporting Security Issues](#reporting-security-issues)
- [What Matimo Enforces](#what-matimo-enforces)
- [Known Limitations](#known-limitations)
- [Deployment Checklist](#deployment-checklist)
- [Rules for Contributors](#rules-for-contributors)
- [Third-Party Credentials — Always BYOK](#third-party-credentials--always-byok)

---

## Reporting Security Issues

**Do not** open a public GitHub issue for a vulnerability.

1. **Report privately** through a [GitHub security advisory](https://github.com/tallclub/matimo/security/advisories/new) or by email to security@matimo.dev.
2. **Include** the type of vulnerability, steps to reproduce, affected package and version, potential impact, and a suggested fix if you have one.
3. **Response timeline:** acknowledgment within 48 hours, an initial fix within 7 days, a release within 14 days.

Security fixes ship as patch releases of the affected SDK and are noted in the [CHANGELOG](./CHANGELOG.md) and GitHub releases.

---

## What Matimo Enforces

Every tool call — built-in, provider package, or agent-created — goes through `execute()`, which applies these checks in both SDKs. Details: [POLICY_AND_LIFECYCLE.md](./docs/api-reference/POLICY_AND_LIFECYCLE.md).

| Control | What it does |
|---------|--------------|
| **Risk classification** | Every tool is `low`, `medium`, `high` or `critical`, from its method, execution type and declared `risk` |
| **Content rules** | Nine deterministic rules check agent-created and untrusted tools: no function or command execution, no SSRF targets, no unauthorized credential placeholders, no reserved `matimo_` namespace, forced approval, blocked HTTP methods, blocked domains, forced draft status |
| **SSRF check at execution** | The fully resolved URL is checked against private, loopback, link-local and metadata addresses before the request is sent |
| **Approval** | HTTP `DELETE`, `type: command` and `requires_approval: true` tools, and SQL with destructive keywords, ask the instance's `onApproval` / `on_approval` callback before running. With no callback, the call is rejected |
| **HITL quarantine** | Tools at or above `hitlMinRiskLevel` can be held for a human decision (`onHITL`) |
| **Draft gate** | Draft tools never run in an environment containing `prod`, and elsewhere only for an `admin` caller; `matimo_approve_tool` requires `admin` and refuses the tool's creator |
| **Approval manifest** | Approvals are HMAC-signed with `MATIMO_APPROVAL_SECRET`; an edited tool file loses its approval |
| **Credentials outside parameters** | Secrets come from `credentials` or the environment and are filled into credential placeholders at call time; they never reach the model, approval callbacks or events |
| **Audit trail** | Every call emits events; `JsonlFileSink` writes a hash-chained log with secret-looking fields redacted, and `verifyAuditLog` finds the first altered line |
| **MCP** | HTTP servers accept an optional bearer token (compared in constant time); approvals are asked of the client's user through elicitation, and the model cannot approve its own call |
| **Embedded code** | Inline `code` in YAML is off unless `MATIMO_ALLOW_EMBEDDED_CODE=true` (TypeScript) |
| **Response size** | Large responses are truncated before they reach the model |

---

## Known Limitations

Plan around these; they are tracked on the [roadmap](./docs/ROADMAP.md).

- **No parameter validation.** Parameters are not checked against the YAML types, `enum` or `required` before execution. Validate in your app or in function-tool code.
- **Function tools run in-process.** `type: function` code runs with the host's permissions; the static code check is not a sandbox. Load function tools only from sources you trust, and keep agent-written tools in `untrustedPaths`.
- **Command tools inherit the environment.** A `type: command` tool sees the process environment (plus per-call credentials). Every call asks for approval, but run them only where that environment holds nothing the command shouldn't read.
- **SSRF via redirects and DNS.** The SSRF check covers the URL Matimo builds; it does not re-check redirect targets or the address a hostname resolves to.
- **Composio and Bruno write tools** don't declare `requires_approval`; use `hitlMinRiskLevel: 'high'` or approval patterns to gate them.
- **The example MCP HTTP server** (`python/examples/mcp/src/server_http.py`) sets no token and listens on all interfaces. Set `mcpToken` / `mcp_token` and use HTTPS before exposing any MCP server.

---

## Deployment Checklist

- [ ] Secrets come from the environment, a secret manager, or per-call `credentials` — never from YAML, code or tool parameters
- [ ] `MATIMO_APPROVAL_SECRET` is set to a stable random value
- [ ] An `onApproval` / `on_approval` callback reaches a human; `MATIMO_AUTO_APPROVE` is not set
- [ ] Agent-created tool directories are listed in `untrustedPaths`
- [ ] The policy's `environment` names production as such (it contains `prod`)
- [ ] MCP over HTTP uses a bearer token and HTTPS
- [ ] An `auditSink` is configured and the log is kept where agents can't write
- [ ] Dependencies audited (`pnpm audit`, `pip-audit`)

---

## Rules for Contributors

### 1. Validate Untrusted Input

Function-tool code receives parameters as the model wrote them. Check types and ranges before use, and throw `MatimoError` with `ErrorCode.INVALID_PARAMETER`.

```typescript
if (typeof params.limit !== 'number' || params.limit < 1 || params.limit > 100) {
  throw new MatimoError('limit must be 1-100', ErrorCode.INVALID_PARAMETER);
}
```

### 2. Never Hardcode Secrets

A tool's YAML names its credential as a placeholder; Matimo fills it at call time from the call's `credentials`, then `MATIMO_<NAME>`, then `<NAME>` in the environment.

```yaml
# ❌ WRONG: hardcoded secret
headers:
  Authorization: 'Bearer ghp_xxxxxxxxxxxxxxxxxxxx'

# ✅ CORRECT: credential placeholder
headers:
  Authorization: 'Bearer {GITHUB_TOKEN}'
notes:
  env: GITHUB_TOKEN
```

A placeholder is treated as a credential only when its name contains `TOKEN`, `KEY`, `SECRET`, `PASSWORD`, `CREDENTIAL`, `AUTH`, `BEARER` or `API_KEY`. For basic auth, use `authentication.username_env` / `password_env`. See [AUTHENTICATION.md](./docs/user-guide/AUTHENTICATION.md).

### 3. Never Log Secrets

Use the Matimo logger, log tool names and outcomes, and never log tokens, credentials, or raw parameters that may contain them.

### 4. Safe Errors

Throw `MatimoError` with an `ErrorCode` and a message that helps the caller without exposing internals, stack traces or secrets. See [ERRORS.md](./docs/api-reference/ERRORS.md).

### 5. Shell Commands

Prefer `type: http` or `type: function` over `type: command`. If a command tool is necessary, pass parameters as separate `args` entries rather than interpolating them into one shell string, and never pass a secret as a command-line argument (it is visible in the process list).

### 6. Risk and Approval

Every tool needs a risk classification. HTTP `DELETE` tools must declare `requires_approval: true` and function tools must declare `risk:`; `pnpm validate-tools` enforces both.

---

## Third-Party Credentials — Always BYOK

Credentials always come from the deploying application — its environment or per-call `credentials` — never from a value baked into a tool definition or shipped in a Matimo package. This is also how Matimo keeps every provider connector on a bring-your-own-key model, so the compliance relationship with that provider (its Terms of Service, usage policy, data handling) stays directly between the end user and the provider, not routed through any Matimo-operated account or infrastructure.

`@matimo/composio` is the clearest example: every `composio_*` tool requires a caller-supplied `COMPOSIO_API_KEY` plus a `composio_connected_account_id` obtained through Composio's own OAuth flow — see [`docs/COMPOSIO.md`](./docs/COMPOSIO.md) and [`THIRD_PARTY_NOTICES.md`](./THIRD_PARTY_NOTICES.md). Before adding a new third-party connector, see [CONTRIBUTING.md § Third-Party Connectors — Credential Policy](./CONTRIBUTING.md#third-party-connectors--credential-policy-byok).

---

## Resources

- [OWASP Top 10 for LLM Applications](https://owasp.org/www-project-top-10-for-large-language-model-applications/)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- Questions about security that aren't vulnerabilities: [GitHub Discussions](https://github.com/tallclub/matimo/discussions)
