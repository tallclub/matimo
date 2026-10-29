---
title: "Matimo Roadmap"
description: "What Matimo OSS has shipped and what is planned next, with links to the release notes."
---
## Current Status

| | TypeScript | Python |
|---|---|---|
| Latest release | **0.4.0** (release date to be confirmed) | **0.2.0** (2026-10-04) |
| Install | `npm install matimo` | `pip install matimo` |
| Runtime | Node 22.19+ | Python 3.11+ |

0.3.0 raised the Node floor to 22.19 and patched the open security advisories. The Python SDK has no 0.3.0 release; its latest is 0.2.0. The previous release, **0.2.0** (both SDKs), made governance **secure by default**: HTTP DELETE and command tools ask a human, each instance has its own approval callback, MCP servers ask the client's user through elicitation, and a hash-chained audit log records every call. See [Release Notes](/docs/releases/) and the [migration guide](/docs/api-reference/policy-and-lifecycle/#upgrading-to-020).

### What ships today

**Core SDK (TypeScript and Python)**
- Tool execution for `http`, `command` and `function` tools, defined in YAML and loaded with Zod (TypeScript) or Pydantic v2 (Python)
- Factory and decorator patterns, plus adapters for LangChain (both SDKs), and CrewAI and Agno (Python)
- Policy engine with risk classification, content rules, human-in-the-loop approval, signed approval manifests, and an audit log
- 15 meta-tools that let an agent create, validate, approve and hot-reload tools and skills
- Skills system with TF-IDF keyword-relevance search
- MCP server over stdio and Streamable HTTP, with secrets from the environment, `.env` files, Vault or AWS Secrets Manager
- CLI: `install`, `list`, `search`, `mcp`, `mcp setup`, `doctor`, `review`, `help`, `version`

**Providers**
- 129 tools across 10 native packages: Slack, GitHub, Gmail, Notion, HubSpot, Mailchimp, Postgres, Twilio, Bruno CLI and Microsoft Graph. Together with the 24 built-in core tools, an instance with every package installed loads 153 tools
- `@matimo/composio`: 449 governed tools across 14 Composio toolkits (Jira, Linear, Asana, Google Workspace, Microsoft 365 and more). **TypeScript only today**

**Quality**
- About 4,700 tests pass across the two SDKs: 2,825 in TypeScript and 1,883 in Python (3 skipped), plus shared conformance fixtures that both must satisfy
- CI enforces a 95% coverage floor on TypeScript core and on `matimo-core` (Python)

---

## Release History

| Date | Release | Headline |
|---|---|---|
| 2026-02-04 to 02-27 | `0.1.0-alpha.1` to `alpha.11` | Core SDK. Postgres (alpha.7), GitHub (alpha.8), HubSpot (alpha.9), Notion (alpha.10), Twilio and Mailchimp (alpha.11) |
| 2026-03-11 | `0.1.0-alpha.12` | MCP server over stdio and HTTP, secret resolvers, Claude Desktop setup |
| 2026-03-22 | `0.1.0-alpha.13` | Skills system, policy engine, HITL quarantine |
| 2026-04-12 | `0.1.0-alpha.14` | Python SDK |
| 2026-05-01 | `0.1.0` | First stable release. Bruno CLI provider, `matimo_get_tool` and `matimo_search_tools` |
| 2026-06-09 | Microsoft Graph provider | `@matimo/microsoft` and `matimo-microsoft` 0.1.0 |
| 2026-08-11 | TypeScript `0.1.7` | Composio catalog grows from 342 to 449 tools across 14 toolkits |
| 2026-08-30 | TypeScript `0.1.8`, Python `0.1.3` | A real policy engine is always on, and the self-extension approval flow works end to end |
| 2026-10-04 | `0.2.0` (both) | Secure by default, per-instance approval, audit log, MCP elicitation |
| 2026-10-13 | TypeScript `0.3.0` | Node 22.19+, security advisories patched, Composio toolkit version |

Per-release details are in [Release Notes](/docs/releases/).

---

## What's Next

These items are open today. Each was checked against the code when this page was last updated.

**Security hardening**
- [ ] SSRF checks on every redirect hop and on the resolved IP address, not only the URL
- [ ] Command tools run with a minimal environment instead of the parent process's
- [ ] Function tools run out of process, with a timeout that stops them

**Correctness and parity**
- [ ] `error_handling` retries applied by the HTTP executors (validated today, not used)
- [ ] Parameter validation before execution, with every problem reported at once
- [ ] Composio tools classified by the action they perform, not as HTTP POSTs
- [ ] Python: `get_tools_by_tag`, `get_required_credentials`, `reload_policy`, `set_hitl_callback` and `get_skill_resource`, which TypeScript already has
- [ ] One meaning for `allow_command_tools` / `allow_function_tools` on untrusted tools in both SDKs
- [ ] A policy context passed through the LangChain and CrewAI adapters
- [ ] Dynamic tool filtering helpers. With every provider installed, `autoDiscover` loads 153 tools, above OpenAI's limit of 128 per request, so pick a subset by provider, tag or search (see [Tool Discovery](/docs/user-guide/tool-discovery/))

**Builder features**
- [ ] Adapters for the OpenAI, Anthropic, Vercel AI and other agent SDKs (see [Vercel AI SDK](/docs/framework-integrations/vercel-ai/) for the current workaround)
- [ ] YAML pagination, response field selection, caching and rate limits
- [ ] Argument-level policy rules, budgets, and a dry-run `explain`
- [ ] Connections: per-user token storage and refresh, `matimo connect`
- [ ] Remote MCP with OAuth 2.1
- [ ] OpenAPI import (`matimo import`)
- [ ] An MCP server Docker image

**Provider expansion**
- [ ] Native packages for Stripe, Airtable, AWS and Azure
- Jira and Linear are available today through the governed [Composio catalog](/docs/composio/), so they are not planned as native packages

Each new provider should have 5 or more tools, working API-key or OAuth2 authentication, examples for every pattern, and unit tests with mocked responses.

---

## Future Phases

Longer-range ideas, with no committed dates. Treat them as direction, not promises.

**Enterprise and DevOps**
- A REST API server for tool execution, with async jobs, webhooks and multi-tenant support
- A tool marketplace with publishing, versioning, ratings and usage analytics
- Docker images, Helm charts, and CloudRun and Lambda deployment templates

**Ecosystem maturity**
- Schema auto-translation between OpenAPI and Matimo YAML, and tool generation from specifications
- Intelligent tool discovery and recommendations
- Enterprise audit logging and compliance reporting
- Rate limiting and quota management

---

## How to Contribute

We welcome contributions at any level.

- **Report Issues**: [GitHub Issues](https://github.com/tallclub/matimo/issues)
- **Feature Requests and Questions**: [GitHub Discussions](https://github.com/tallclub/matimo/discussions)
- **Submit Code**: [Contributing Guide](https://github.com/tallclub/matimo/blob/main/CONTRIBUTING.md)
- **Suggest Tools**: Propose provider integrations you need
- **Documentation**: Help improve guides and examples

Have an idea for the roadmap? [Open a GitHub Discussion](https://github.com/tallclub/matimo/discussions).
