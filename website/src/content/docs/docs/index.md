---
title: "Matimo Documentation"
description: "Documentation for Matimo OSS: open-source, policy-governed tool execution for AI agents, in TypeScript and Python. Quick start, API reference and guides."
---
![Matimo Logo](../../../assets/logo.png)

<p align="center">
  <a href="https://discord.gg/3JPt4mxWDV"><img src="https://img.shields.io/badge/Discord-Join%20Chat-5865F2?style=for-the-badge&logo=discord&logoColor=white" alt="Discord"></a>
</p>

**Matimo, Enable AI Agents To Build Themselves**

> Open-source tool governance for AI agents: every call risk-checked, every risky one approved by a human, every result on a log you can verify

Give your agents **129 production-ready tools** to start (plus a governed 449-tool Composio catalog). Then activate **15 meta-tools** that let them create, validate, and approve new capabilities at runtime, governed by your **policy engine** with **human approval workflows** for critical actions.

**Self-extending agents with enterprise-grade control:**
- **Meta-Tools**: Agents write new tool definitions in YAML, validate schemas, approve for production, and hot-reload, all mid-conversation
- **Policy Engine**: Classify every action by risk level, block dangerous operations, quarantine draft tools
- **Human-in-the-Loop (HITL)**: Critical tools require human approval before execution with configurable timeouts and audit trails
- **Universal Integration**: One YAML definition works across TypeScript, Python, LangChain, CrewAI, Claude MCP, OpenAI

New here? Read [Why Matimo OSS](/docs/why-matimo/) and [what changed in 0.2.0](/docs/blog/2026-10-01-matimo-0-2-0-tool-governance/).

Complete documentation for Matimo **0.4.0** (TypeScript `@matimo/core` and Python `matimo`, both 0.4.0).

> **New in 0.4.0:** TypeScript and Python now share one version number. HTTP MCP servers bind `127.0.0.1` by default and the Python one needs a bearer token (set `MATIMO_MCP_TOKEN`), `execute` takes `args` and an opt-in `shell` that always asks a human, network tools refuse hostnames that resolve to internal addresses, and `MATIMO_FILE_ROOTS` can confine the file tools. Read the [release notes](/docs/releases/) before upgrading.
>
> **Since 0.2.0, secure by default.** HTTP DELETE and command tools ask a human before every call, each instance has its own approval callback (`onApproval`), MCP servers ask the client's user through elicitation, every call emits events you can keep in a tamper-evident audit log, and both SDKs enforce the same rules. Upgrading? Read the [migration guide](/docs/api-reference/policy-and-lifecycle/#upgrading-to-020).

---

## Choose Your SDK

### **TypeScript / Node.js**
- Node.js 22.19+, npm/pnpm
- ESM, full type support
- Enforced coverage floors (95% lines)
- **[Start with TypeScript](#typescript-getting-started)**

### **Python** *Stable Release*
- Python 3.11+, pip/uv
- Native asyncio, full type hints (mypy strict)
- LangChain, CrewAI, MCP support
- **[Start with Python](#python-getting-started)**

---

## Getting Started

### TypeScript Getting Started

1. **[Quick Start](/docs/getting-started/quick-start/#typescript-sdk)**: 5-minute setup
2. **[Your First Tool](/docs/getting-started/your-first-tool/)**: Create a basic YAML tool
3. **[API Reference](/docs/api-reference/sdk/#typescript-sdk-matimoinstance)**: SDK fundamentals

### Python Getting Started

1. **[Quick Start](/docs/getting-started/quick-start/#python-sdk)**: 5-minute setup with `pip install matimo`
2. **[Your First Tool](/docs/getting-started/your-first-tool/)**: Run the built-in calculator step by step (TypeScript and Python)
3. **[LangChain Integration](/docs/framework-integrations/langchain/#python-langchain-integration)**: Build ReAct agents
4. **[CrewAI Integration](/docs/framework-integrations/crewai/)**: Multi-agent orchestration
5. **[Agno Integration](/docs/framework-integrations/agno/)**: Governed Agno agents, teams and workflows
6. **[API Reference](/docs/api-reference/sdk/#python-sdk-matimo-api)**: Python SDK documentation

### **Installation & Requirements**

- **[Installation](/docs/getting-started/installation/)**: Detailed setup for both SDKs
  - TypeScript (Node.js 22.19+) and Python (3.11+) requirements
  - From npm/pip (recommended) or from source
  - Troubleshooting & environment setup
  - Provider authentication via OAuth2

---

## Reference (By Topic)

### **Core Concepts (Start Here)**

- **[Architecture Overview](/docs/architecture/overview/)**: Understand how Matimo works
  - High-level system design
  - Three integration patterns (Factory, Decorator, Framework)
  - Framework compatibility (LangChain, CrewAI, MCP, custom)
  - Data flow and execution model

- **[SDK Patterns](/docs/user-guide/sdk-patterns/)**: TypeScript & Python examples
  - Factory pattern (simplest)
  - Decorator pattern (class-based)
  - Framework integration patterns

- **[API Reference](/docs/api-reference/sdk/)**: Complete SDK reference
  - TypeScript `MatimoInstance` API
  - Python `Matimo` API
  - `.execute()`, `.listTools()`, `.searchTools()`
  - Error handling & logging
  - Complete type definitions

- **[Error Reference](/docs/api-reference/errors/)**: Troubleshooting guide
  - Error codes and meanings
  - Common scenarios
  - Debugging techniques
  - Recovery patterns

### **Tool Development**

- **[Tool Specification](/docs/tool-development/tool-specification/)**: Write tools in YAML
  - Tool metadata and parameters
  - Execution types (`http`, `function`, `command`)
  - Authentication and credential placeholders
  - Risk, `requires_approval` and status fields
  - Real definitions from the provider packages

- **[Tool Workflow](/docs/tool-development/tool-workflow/)**: Checklist for adding a tool to both SDKs

- **[Decorator Guide](/docs/tool-development/decorator-guide/)**: `@tool` methods backed by YAML tools

- **[Adding Tools to Matimo](/docs/tool-development/adding-tools/)**: Publish @matimo/* packages
  - 6-step guide for creating providers
  - Auto-discovery mechanism
  - Publishing to npm
  - GitHub provider real example
  - CLI tool management

- **[Testing Tools](/docs/tool-development/testing/)**: Unit & integration testing
  - Testing patterns with Jest / pytest
  - Mocking external services
  - TypeScript coverage floors (lines 95%, functions 97%, branches 87%)
  - Test fixtures

- **[OAuth Setup](/docs/architecture/oauth/)**: OAuth2 authentication
  - OAuth2 flow implementation
  - Provider-specific configurations
  - Token management
  - Security best practices

### **Policy & Lifecycle (Security)**

- **[Policy Engine & Tool Lifecycle](/docs/api-reference/policy-and-lifecycle/)**: Complete security guide
  - PolicyConfig setup and immutability
  - Content Validator (9 security rules)
  - Risk classification levels
  - Tool lifecycle: create → approve → reload → use
  - Approval system (interactive, auto-approve, MCP)
  - Integrity tracking (SHA-256, HMAC)
  - RBAC & access control
  - Audit events

- **[Meta-Tools Reference](/docs/api-reference/meta-tools/)**: Built-in tool management tools
  - `matimo_search_tools` / `matimo_get_tool` / `matimo_get_tool_status`, Find tools and inspect their definition and status
  - `matimo_validate_tool`: Validate YAML against schema + policy
  - `matimo_create_tool`: Create tools with safety enforcement
  - `matimo_approve_tool`: Promote draft tools with HMAC signing
  - `matimo_reload_tools`: Hot-reload the live registry
  - `matimo_list_user_tools`: Discover tools with metadata
  - `matimo_create_skill`: Create SKILL.md files
  - `matimo_list_skills`: List skills in a directory
  - `matimo_get_skill`: Read a skill's content by name
  - `matimo_validate_skill`: Validate a skill against the Agent Skills spec
  - `matimo_search_skills`: Rank skills by keyword relevance (TF-IDF)
  - `matimo_get_skill_sections`: Inventory a skill's sections and token costs
  - `matimo_get_skill_content`: Load only specific sections of a skill

- **[Approval System](/docs/api-reference/approval-system/)**: Approval handler configuration
  - Per-instance `onApproval` callbacks
  - Pre-approved patterns and environment variables
  - MCP elicitation

- **[Logging](/docs/api-reference/logging/)**: Logger configuration and formats

- **[MCP Server](/docs/mcp-server/)**: Serve Matimo tools to Claude Desktop, Cursor and other MCP clients ([setup guides](/docs/mcp/))

- **[Composio](/docs/composio/)**: The governed Composio catalog (`@matimo/composio`)

### **Advanced Topics**

- **[OAuth Architecture](/docs/architecture/oauth/)**: Deep dive into OAuth2
  - Protocol flow details
  - Provider integrations
  - Token lifecycle
  - Security considerations

- **[Provider Configuration](/docs/tool-development/provider-configuration/)**: Multi-provider setup
  - Managing multiple providers
  - Configuration patterns
  - Environment variables
  - Provider-specific settings

- **[Type Definitions](/docs/api-reference/types/)**: Complete TypeScript types
  - Full interface reference
  - Parameter and execution types
  - Response validation types

- **Framework Integrations**: [LangChain](/docs/framework-integrations/langchain/) (TS + Python), [CrewAI](/docs/framework-integrations/crewai/), [Agno](/docs/framework-integrations/agno/), [Vercel AI SDK](/docs/framework-integrations/vercel-ai/), [Bruno](/docs/framework-integrations/bruno/)

- **[Skills](/docs/skills/skills/)**: SKILL.md knowledge documents and [TF-IDF search](/docs/skills/tfidf-semantic-search/)

- **[Notebooks](https://github.com/tallclub/matimo/blob/main/docs/notebooks/00_index.ipynb)**: Colab notebooks: quickstart, policy engine, meta-tools, skills, MCP server

## Project Information

- **[Release Notes](/docs/releases/)**: New features, bug fixes, and breaking changes
- **[Roadmap](/docs/roadmap/)**: Upcoming features and long-term vision

---

## For Contributors

**Want to contribute? Start here:**

1. **[Contributing Guidelines](https://github.com/tallclub/matimo/blob/main/CONTRIBUTING.md)**: Full contribution workflow
   - Setup and development environment
   - Code standards and best practices
   - TDD (Test-Driven Development) approach
   - Commit message format
   - PR checklist

2. **[Commit Guidelines](/docs/community/commit-guidelines/)**: Conventional commits standard
   - Type, scope, subject format
   - Examples for feat, fix, docs, etc.
   - Git workflow tips

3. **[Development Standards](/docs/user-guide/development-standards/)**: Code quality requirements
   - TypeScript strictness
   - Testing coverage (95% floors enforced in CI on TypeScript core and `matimo-core`)
   - ESLint / ruff and Prettier
   - JSDoc documentation

---

## Development & Advanced Usage

- **[SDK Patterns](/docs/user-guide/sdk-patterns/)**: SDK usage patterns and best practices
  - Factory pattern usage
  - Decorator pattern examples
  - LangChain integration patterns
  - Error handling strategies
  - Performance optimization

- **[Tool Discovery](/docs/user-guide/tool-discovery/)**: Finding and using tools
  - Auto-discovery from npm packages
  - Tool search and filtering
  - Registry management
  - Loading from directories

- **[Authentication](/docs/user-guide/authentication/)**: API keys, OAuth2, and token management
  - API key setup
  - OAuth2 flows
  - Token refresh and storage
  - Provider-specific auth patterns
  - Security best practices

---

## Troubleshooting

- **[FAQ & Common Issues](/docs/troubleshooting/faq/)**: Answers to common questions
  - Setup problems
  - Tool execution issues
  - Authentication errors
  - Performance tips

---

## Quick Navigation by Role

### Just Getting Started (First 30 minutes)
1. [Quick Start](/docs/getting-started/quick-start/): Install and run your first tool
2. [Your First Tool](/docs/getting-started/your-first-tool/): Create a basic YAML tool
3. [API Reference](/docs/api-reference/sdk/): Understand the SDK basics
4. If stuck → [FAQ](/docs/troubleshooting/faq/)

### Building Tools
1. [Tool Specification](/docs/tool-development/tool-specification/): YAML schema reference
2. [Adding Tools to Matimo](/docs/tool-development/adding-tools/): Publish a package
3. [Testing Tools](/docs/tool-development/testing/): Write tests
4. [OAuth Setup](/docs/architecture/oauth/): Add authentication

### Integrating with Frameworks (LangChain, CrewAI, etc.)
1. [Architecture Overview](/docs/architecture/overview/): Understand patterns
2. [Framework Integrations](/docs/framework-integrations/langchain/): Integration examples
3. [SDK Patterns](/docs/user-guide/sdk-patterns/): Best practices

### Securing Agent Tool Usage
1. [Policy & Lifecycle Guide](/docs/api-reference/policy-and-lifecycle/): Full security setup
2. [Meta-Tools Reference](/docs/api-reference/meta-tools/): Built-in management tools
3. [Approval System](/docs/api-reference/approval-system/): Approval handler config
4. [Policy Demo (Python)](https://github.com/tallclub/matimo/tree/main/python/examples/native/policy/): 11-mission autonomous agent demo
5. [Policy Demo (TypeScript)](https://github.com/tallclub/matimo/tree/main/typescript/examples/tools/policy/): TypeScript equivalent
6. [Skills Demo (Python)](https://github.com/tallclub/matimo/tree/main/python/examples/native/skills/): 6-mission skills lifecycle demo

### For AI Agents (Quick Orientation)
> If you are an AI agent (LangChain, CrewAI, MCP client) reading this to understand Matimo:

1. **Read first**: [Meta-Tools Reference](/docs/api-reference/meta-tools/), the 15 built-in meta-tools you can call right now
2. **Tool creation flow**: `matimo_validate_tool` → `matimo_create_tool` → `matimo_approve_tool` → `matimo_reload_tools`
3. **Skills discovery**: `matimo_list_skills` → `matimo_get_skill` to load domain expertise on-demand
4. **OpenAI 128-tool limit**: If using `auto_discover=True`, cap your bound tool list, prioritize `matimo_*` tools first
5. **Policy rules**: Draft tools are blocked whenever the context `environment` string contains "prod" (case-insensitive substring match, `"prod"`, `"production"`, `"PRODUCTION-us-east"` all match), and in any other environment they run only for a caller with the `admin` role; approve a tool with `matimo_approve_tool` to use it normally. Command tools, HTTP DELETE tools and tools with `requires_approval: true` ask a human before every call. SSRF-blocked URL patterns are rejected by the content validator both at creation/approval time and again at execution time against the fully-resolved URL.
6. **Errors**: All errors are `MatimoError` with typed `ErrorCode`. Check `error.code` for programmatic handling.
7. **Examples to study**: [`python/examples/native/meta_flow/meta_tools_integration.py`](https://github.com/tallclub/matimo/tree/main/python/examples/native/meta_flow/meta_tools_integration.py) is the canonical end-to-end reference.

### Contributing Code
1. **Start here:** [Contributing Guidelines](https://github.com/tallclub/matimo/blob/main/CONTRIBUTING.md)
2. Clone repo and set up locally
3. [Commit Guidelines](/docs/community/commit-guidelines/): Proper commit format
4. [Development Standards](/docs/user-guide/development-standards/): Code quality rules  
5. Open PR and request review

### Maintaining/Reviewing
1. [Development Standards](/docs/user-guide/development-standards/): Review checklist
2. [Contributing Guidelines](https://github.com/tallclub/matimo/blob/main/CONTRIBUTING.md): PR requirements
3. [Commit Guidelines](/docs/community/commit-guidelines/): Validate commits
4. [Architecture Overview](/docs/architecture/overview/): Understand design decisions

---

## Documentation Structure

```
docs/
├── index.md                      # This file, documentation index
├── RELEASES.md                   # Release notes and changelog
├── ROADMAP.md                    # Project roadmap
├── MCP.md                        # MCP server setup and Claude Desktop
├── COMPOSIO.md                   # Governed Composio catalog
├── mcp/                          # MCP setup, quick reference, maintenance
├── notebooks/                    # Colab notebooks (00_index … 05_mcp_server)
├── getting-started/
│   ├── QUICK_START.md            # 5-minute setup (TypeScript + Python)
│   ├── installation.md           # Detailed installation
│   └── YOUR_FIRST_TOOL.md        # Create your first tool
├── api-reference/
│   ├── SDK.md                    # Complete SDK API (TypeScript + Python)
│   ├── ERRORS.md                 # Error handling and error codes
│   ├── TYPES.md                  # TypeScript type definitions
│   ├── META_TOOLS.md             # Built-in meta-tools reference (15 tools)
│   ├── POLICY_AND_LIFECYCLE.md   # Policy engine and tool lifecycle
│   ├── APPROVAL-SYSTEM.md        # Approval handler configuration
│   └── LOGGING.md                # Logger API and formats
├── tool-development/
│   ├── TOOL_SPECIFICATION.md     # YAML tool schema reference
│   ├── YAML_TOOLS.md             # YAML tool writing guide
│   ├── ADDING_TOOLS.md           # Creating tool provider packages
│   ├── DECORATOR_GUIDE.md        # TypeScript decorators
│   ├── TESTING.md                # Testing tools
│   ├── TOOL_WORKFLOW.md          # Step-by-step tool checklist
│   ├── HTTP_PARAMETER_EMBEDDING.md # HTTP parameter encoding
│   └── PROVIDER_CONFIGURATION.md # Multi-provider setup
├── framework-integrations/
│   ├── LANGCHAIN.md              # LangChain (Python + TypeScript)
│   ├── CREWAI.md                 # CrewAI multi-agent (Python)
│   ├── AGNO.md                   # Agno agents/teams/workflows (Python)
│   ├── BRUNO.md                  # Bruno API testing
│   └── VERCEL_AI.md              # Vercel AI SDK (TypeScript)
├── skills/
│   ├── SKILLS.md                 # Skills system guide
│   └── TFIDF_SEMANTIC_SEARCH.md  # TF-IDF implementation details
├── architecture/
│   ├── OVERVIEW.md               # System design and patterns
│   └── OAUTH.md                  # OAuth2 implementation
├── user-guide/
│   ├── SDK_PATTERNS.md           # Factory, decorator, framework patterns
│   ├── TOOL_DISCOVERY.md         # Auto-discovery and search
│   ├── AUTHENTICATION.md         # API keys, OAuth2, token management
│   └── DEVELOPMENT_STANDARDS.md  # Code quality rules
├── community/
│   └── COMMIT_GUIDELINES.md      # Conventional commits
└── troubleshooting/
    └── FAQ.md                    # Common questions & solutions

Python examples (python/examples/):
├── native/                       # Factory, decorator + advanced agent demos
│   ├── policy/policy_demo.py     # 11-mission policy + HITL lifecycle
│   ├── skills/skills_demo.py     # 6-mission skills lifecycle
│   ├── meta_flow/meta_tools_integration.py  # 5-mission meta-tools lifecycle
│   └── logger_example.py         # Logging demo (no API key needed)
├── langchain/                    # LangChain agents, per provider
├── crewai/                       # CrewAI agents, per provider
├── agno/                         # Agno agents
├── bruno/                        # Bruno collections as governed tools
└── mcp/                          # MCP server and client (own uv project)

TypeScript examples (typescript/examples/tools/):
├── <provider>/                   # factory, decorator, langchain, with-approval per provider
├── policy/policy-demo.ts         # 11-mission policy lifecycle
├── skills/skills-demo.ts         # Skills lifecycle + TF-IDF
├── meta-flow/meta-tools-integration.ts  # Meta-tools lifecycle
└── agents/langchain-skills-policy-agent.ts  # Production agent pattern
```

---

## Key Concepts

### Tools

Tools are the building blocks of Matimo. They define what can be executed, what parameters they accept, and how they run.

- **YAML Tools**: Declarative tool definitions (see [Tool Specification](/docs/tool-development/tool-specification/))
- **Decorators**: `@tool('name')` class methods that call a loaded YAML tool (see [Decorator Guide](/docs/tool-development/decorator-guide/))

### Executors

Executors run tools with different backends:

- **HttpExecutor**: `type: http`, REST calls (the default)
- **FunctionExecutor**: `type: function`, a co-located `.ts`/`.js` or `.py` file
- **CommandExecutor**: `type: command`, shell CLIs (asks for approval on every call)

See [API Reference](/docs/api-reference/sdk/) for details.

### SDK

Load tools and execute them:

```typescript
import { MatimoInstance } from '@matimo/core';

const matimo = await MatimoInstance.init({ autoDiscover: true });
const result = await matimo.execute('calculator', { operation: 'add', a: 2, b: 3 });
```

```python
from matimo import Matimo

matimo = await Matimo.init(auto_discover=True)
result = await matimo.execute("calculator", {"operation": "add", "a": 2, "b": 3})
```

See [Quick Start](/docs/getting-started/quick-start/) and [API Reference](/docs/api-reference/sdk/).

### MCP Server

Matimo can run as an MCP server, allowing Claude and other clients to discover and use tools:

```bash
npx matimo mcp                 # stdio, for Claude Desktop / Cursor
```

```typescript
import { createMCPServer } from '@matimo/core/mcp';

const server = await createMCPServer({ transport: 'http', port: 3000, autoDiscover: true });
```

See [MCP.md](/docs/mcp-server/) for client configuration, HTTP mode and Python.

---

## Standards & Practices

### Code Quality

- **TypeScript**: Strict mode enforced (no `any`)
- **Testing**: TypeScript coverage floors enforced (lines 95%, functions 97%, branches 87%, statements 95%); CI also enforces a 95% floor on `matimo-core` (Python)
- **Linting**: ESLint with automatic formatting
- **Documentation**: JSDoc comments for all public APIs

See [Development Standards](/docs/user-guide/development-standards/).

### Commits

- **Format**: Conventional Commits (type(scope): subject)
- **Types**: feat, fix, docs, refactor, test, chore, perf, style, ci, revert, example
- **Examples**: "feat(executor): add HTTP support", "fix(schema): validate enums"

See [Commit Guidelines](/docs/community/commit-guidelines/).

### Pull Requests

- Follow TDD approach (test first, implement after)
- Keep PRs focused (one feature/fix per PR)
- Ensure tests pass and the coverage floors hold
- Follow code standards and get code review

See [Contributing Guidelines](https://github.com/tallclub/matimo/blob/main/CONTRIBUTING.md).

---

## Common Tasks

### Write a YAML Tool

1. Create `tools/<tool-name>/definition.yaml` (`name` matches the directory)
2. Follow the [Tool Specification](/docs/tool-development/tool-specification/) schema
3. Include parameters and execution; add authentication if needed
4. Run `pnpm validate-tools`
5. Follow the [Tool Workflow](/docs/tool-development/tool-workflow/) for tests and examples in both SDKs

### Write a Decorator Tool

1. Load the YAML tool with `MatimoInstance.init(...)` and call `setGlobalMatimoInstance(matimo)`
2. Add a class method decorated with `@tool('tool-name')`
3. Calling the method executes the tool through the policy engine
4. Follow [Decorator Guide](/docs/tool-development/decorator-guide/) patterns

### Integrate with LangChain

1. See [Framework Integrations](/docs/framework-integrations/langchain/) for patterns
2. Check `typescript/examples/tools/` and `python/examples/langchain/` for working examples
3. Follow [Architecture Overview](/docs/architecture/overview/) for design decisions

### Contribute Code

1. Fork and clone repository
2. Create feature branch: `git checkout -b feat/description`
3. Write tests first (TDD)
4. Implement feature
5. Follow [Development Standards](/docs/user-guide/development-standards/)
6. Commit using [Commit Guidelines](/docs/community/commit-guidelines/)
7. Push and create PR
8. Follow [Contributing Guidelines](https://github.com/tallclub/matimo/blob/main/CONTRIBUTING.md) checklist

---

## Need Help?

- **Questions?** Check relevant documentation or open a [GitHub Discussion](https://github.com/tallclub/matimo/discussions)
- **Found a bug?** [Open an issue](https://github.com/tallclub/matimo/issues)
- **Troubleshooting?** See [FAQ](/docs/troubleshooting/faq/)
- **Want to contribute?** See [Contributing Guidelines](https://github.com/tallclub/matimo/blob/main/CONTRIBUTING.md)

---

> **Documentation Note:** While I strive for accuracy and completeness, this documentation may contain oversights, outdated information, or areas needing improvement, due to my limitations. If you notice any errors, missing information, or have suggestions for enhancement, please help me to improve! See our [Contributing Guidelines](https://github.com/tallclub/matimo/blob/main/CONTRIBUTING.md) to learn how to submit corrections and improvements. Your contributions to documentation are highly valued! Thank you.

---

Last updated: October 2026
