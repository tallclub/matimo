# Matimo Documentation

<p align="center">
<img src="./assets/logo.png" alt="Matimo Logo" width="300" style="border-radius: 8px; margin: 20px 0;" />
</p>

<p align="center">
  <a href="https://discord.gg/3JPt4mxWDV"><img src="https://img.shields.io/badge/Discord-Join%20Chat-5865F2?style=for-the-badge&logo=discord&logoColor=white" alt="Discord"></a>
</p>

**Matimo — Enable AI Agents To Build Themselves**

> The First AI SDK with Meta-Tools, Policy Engine, and Human-in-the-Loop Control

Give your agents **139+ production-ready tools** to start (plus a governed 449-tool Composio catalog). Then activate **12 meta-tools** that let them create, validate, and approve new capabilities at runtime — governed by your **policy engine** with **human approval workflows** for critical actions.

**Self-extending agents with enterprise-grade control:**
- 🔧 **Meta-Tools** — Agents write new tool definitions in YAML, validate schemas, approve for production, and hot-reload — all mid-conversation
- 🛡️ **Policy Engine** — Classify every action by risk level, block dangerous operations, quarantine draft tools
- 🤝 **Human-in-the-Loop (HITL)** — Critical tools require human approval before execution with configurable timeouts and audit trails
- 🌐 **Universal Integration** — One YAML definition works across TypeScript, Python, LangChain, CrewAI, Claude MCP, OpenAI

Complete documentation for Matimo **v0.1.8** (TypeScript & Python).

---

## 🚀 Choose Your SDK

### 🟦 **TypeScript / Node.js**
- Node.js 18+, npm/pnpm
- ESM, full type support
- 2,001 tests, 95%+ coverage
- **[Start with TypeScript](#typescript-getting-started)**

### 🐍 **Python** 🎉 *Stable Release*
- Python 3.11+, pip/uv
- Native asyncio, full type hints
- 995 tests, 96.89% coverage
- LangChain, CrewAI, MCP support
- **[Start with Python](#python-getting-started)**

---

## ⚡ Getting Started

### TypeScript Getting Started

1. **[Quick Start](./getting-started/QUICK_START.md#typescript)** — 5-minute setup 
2. **[Your First Tool](./getting-started/YOUR_FIRST_TOOL.md)** — Create a basic YAML tool
3. **[API Reference](./api-reference/SDK.md#typescript)** — SDK fundamentals

### Python Getting Started

1. **[Quick Start](./getting-started/QUICK_START.md#python)** — 5-minute setup with `pip install matimo`
2. **[LangChain Integration](./framework-integrations/LANGCHAIN.md#python-langchain-integration)** — Build ReAct agents
3. **[CrewAI Integration](./framework-integrations/CREWAI.md)** — Multi-agent orchestration
4. **[API Reference](./api-reference/SDK.md#python)** — Python SDK documentation

### 📦 **Installation & Requirements**

- **[Installation](./getting-started/installation.md)** — Detailed setup for both SDKs
  - TypeScript (Node.js 18+) and Python (3.11+) requirements
  - From npm/pip (recommended) or from source
  - Troubleshooting & environment setup
  - Provider authentication via OAuth2

---

## 📚 Reference (By Topic)

### 🟢 **Core Concepts (Start Here)**

- **[Architecture Overview](./architecture/OVERVIEW.md)** — Understand how Matimo works
  - High-level system design
  - Three integration patterns (Factory, Decorator, Framework)
  - Framework compatibility (LangChain, CrewAI, MCP, custom)
  - Data flow and execution model

- **[SDK Patterns](./user-guide/SDK_PATTERNS.md)** — TypeScript & Python examples
  - Factory pattern (simplest)
  - Decorator pattern (class-based)
  - Framework integration patterns

- **[API Reference](./api-reference/SDK.md)** — Complete SDK reference
  - TypeScript `MatimoInstance` API
  - Python `Matimo` API
  - `.execute()`, `.listTools()`, `.searchTools()`
  - Error handling & logging
  - Complete type definitions

- **[Error Reference](./api-reference/ERRORS.md)** — Troubleshooting guide
  - Error codes and meanings
  - Common scenarios
  - Debugging techniques
  - Recovery patterns

### 🟡 **Tool Development**

- **[Tool Specification](./tool-development/TOOL_SPECIFICATION.md)** — Write tools in YAML
  - Tool metadata and parameters
  - Execution types (command, HTTP, script)
  - Output validation schemas
  - Authentication configuration
  - Retry logic and error handling
  - Real examples

- **[Adding Tools to Matimo](./tool-development/ADDING_TOOLS.md)** — Publish @matimo/* packages
  - 6-step guide for creating providers
  - Auto-discovery mechanism
  - Publishing to npm
  - GitHub provider real example
  - CLI tool management

- **[Testing Tools](./tool-development/TESTING.md)** — Unit & integration testing
  - Testing patterns with Jest / pytest
  - Mocking external services
  - Coverage requirements (95%+)
  - Test fixtures

- **[OAuth Setup](./architecture/OAUTH.md)** — OAuth2 authentication
  - OAuth2 flow implementation
  - Provider-specific configurations
  - Token management
  - Security best practices

### 🛡️ **Policy & Lifecycle (Security)**

- **[Policy Engine & Tool Lifecycle](./api-reference/POLICY_AND_LIFECYCLE.md)** — Complete security guide
  - PolicyConfig setup and immutability
  - Content Validator (9 security rules)
  - Risk classification levels
  - Tool lifecycle: create → approve → reload → use
  - Approval system (interactive, auto-approve, MCP)
  - Integrity tracking (SHA-256, HMAC)
  - RBAC & access control
  - Audit events

- **[Meta-Tools Reference](./api-reference/META_TOOLS.md)** — Built-in tool management tools
  - `matimo_validate_tool` — Validate YAML against schema + policy
  - `matimo_create_tool` — Create tools with safety enforcement
  - `matimo_approve_tool` — Promote draft tools with HMAC signing
  - `matimo_reload_tools` — Hot-reload the live registry
  - `matimo_list_user_tools` — Discover tools with metadata
  - `matimo_create_skill` — Create SKILL.md files
  - `matimo_list_skills` — List skills in a directory
  - `matimo_get_skill` — Read a skill's content by name
  - `matimo_validate_skill` — Validate a skill against the Agent Skills spec

- **[Approval System](./api-reference/APPROVAL-SYSTEM.md)** — Approval handler configuration
  - Auto-approve and interactive approval
  - Environment variables
  - Callback patterns

### 🔴 **Advanced Topics**

- **[OAuth Architecture](./architecture/OAUTH.md)** — Deep dive into OAuth2
  - Protocol flow details
  - Provider integrations
  - Token lifecycle
  - Security considerations

- **[Provider Configuration](./tool-development/PROVIDER_CONFIGURATION.md)** — Multi-provider setup
  - Managing multiple providers
  - Configuration patterns
  - Environment variables
  - Provider-specific settings

- **[Type Definitions](./api-reference/TYPES.md)** — Complete TypeScript types
  - Full interface reference
  - Parameter and execution types
  - Response validation types

- **[Framework Integrations](./framework-integrations/LANGCHAIN.md)** — LangChain & CrewAI
  - LangChain agent patterns
  - CrewAI tool composition
  - Custom framework integration

## Project Information

- **[Release Notes](./RELEASES.md)** — New features, bug fixes, and breaking changes
- **[Roadmap](./ROADMAP.md)** — Upcoming features and long-term vision

---

## 👥 For Contributors

**Want to contribute? Start here:**

1. **[Contributing Guidelines](https://github.com/tallclub/matimo/blob/main/CONTRIBUTING.md)** — Full contribution workflow
   - Setup and development environment
   - Code standards and best practices
   - TDD (Test-Driven Development) approach
   - Commit message format
   - PR checklist

2. **[Commit Guidelines](./community/COMMIT_GUIDELINES.md)** — Conventional commits standard
   - Type, scope, subject format
   - Examples for feat, fix, docs, etc.
   - Git workflow tips

3. **[Development Standards](./user-guide/DEVELOPMENT_STANDARDS.md)** — Code quality requirements
   - TypeScript strictness
   - Testing coverage (95%+ — TypeScript and Python)
   - ESLint / ruff and Prettier
   - JSDoc documentation

---

## Development & Advanced Usage

- **[SDK Patterns](./user-guide/SDK_PATTERNS.md)** — SDK usage patterns and best practices
  - Factory pattern usage
  - Decorator pattern examples
  - LangChain integration patterns
  - Error handling strategies
  - Performance optimization

- **[Tool Discovery](./user-guide/TOOL_DISCOVERY.md)** — Finding and using tools
  - Auto-discovery from npm packages
  - Tool search and filtering
  - Registry management
  - Loading from directories

- **[Authentication](./user-guide/AUTHENTICATION.md)** — API keys, OAuth2, and token management
  - API key setup
  - OAuth2 flows
  - Token refresh and storage
  - Provider-specific auth patterns
  - Security best practices

---

## Troubleshooting

- **[FAQ & Common Issues](./troubleshooting/FAQ.md)** — Answers to common questions
  - Setup problems
  - Tool execution issues
  - Authentication errors
  - Performance tips

---

## Quick Navigation by Role

### 🚀 Just Getting Started (First 30 minutes)
1. [Quick Start](./getting-started/QUICK_START.md) — Install and run your first tool
2. [Your First Tool](./getting-started/YOUR_FIRST_TOOL.md) — Create a basic YAML tool
3. [API Reference](./api-reference/SDK.md) — Understand the SDK basics
4. If stuck → [FAQ](./troubleshooting/FAQ.md)

### 🛠️ Building Tools
1. [Tool Specification](./tool-development/TOOL_SPECIFICATION.md) — YAML schema reference
2. [Adding Tools to Matimo](./tool-development/ADDING_TOOLS.md) — Publish a package
3. [Testing Tools](./tool-development/TESTING.md) — Write tests
4. [OAuth Setup](./architecture/OAUTH.md) — Add authentication

### 🤖 Integrating with Frameworks (LangChain, CrewAI, etc.)
1. [Architecture Overview](./architecture/OVERVIEW.md) — Understand patterns
2. [Framework Integrations](./framework-integrations/LANGCHAIN.md) — Integration examples
3. [SDK Patterns](./user-guide/SDK_PATTERNS.md) — Best practices

### 🔒 Securing Agent Tool Usage
1. [Policy & Lifecycle Guide](./api-reference/POLICY_AND_LIFECYCLE.md) — Full security setup
2. [Meta-Tools Reference](./api-reference/META_TOOLS.md) — Built-in management tools
3. [Approval System](./api-reference/APPROVAL-SYSTEM.md) — Approval handler config
4. [Policy Demo (Python)](https://github.com/tallclub/matimo/tree/main/python/examples/native/policy/) — 11-mission autonomous agent demo
5. [Policy Demo (TypeScript)](https://github.com/tallclub/matimo/tree/main/typescript/examples/tools/policy/) — TypeScript equivalent
6. [Skills Demo (Python)](https://github.com/tallclub/matimo/tree/main/python/examples/native/skills/) — 6-mission skills lifecycle demo

### 🤖 For AI Agents (Quick Orientation)
> If you are an AI agent (LangChain, CrewAI, MCP client) reading this to understand Matimo:

1. **Read first**: [Meta-Tools Reference](./api-reference/META_TOOLS.md) — the 12 built-in tools you can call right now
2. **Tool creation flow**: `matimo_validate_tool` → `matimo_create_tool` → `matimo_approve_tool` → `matimo_reload_tools`
3. **Skills discovery**: `matimo_list_skills` → `matimo_get_skill` to load domain expertise on-demand
4. **OpenAI 128-tool limit**: If using `auto_discover=True`, cap your bound tool list — prioritize `matimo_*` tools first
5. **Policy rules**: Draft tools are blocked whenever the context `environment` string contains "prod" (case-insensitive substring match — `"prod"`, `"production"`, `"PRODUCTION-us-east"` all match). Command tools (`type: command`) require explicit approval. SSRF-blocked URL patterns are rejected by the content validator both at creation/approval time and again at execution time against the fully-resolved URL.
6. **Errors**: All errors are `MatimoError` with typed `ErrorCode`. Check `error.code` for programmatic handling.
7. **Examples to study**: [`python/examples/native/meta_flow/meta_tools_integration.py`](https://github.com/tallclub/matimo/tree/main/python/examples/native/meta_flow/meta_tools_integration.py) is the canonical end-to-end reference.

### 👨‍💻 Contributing Code
1. **Start here:** [Contributing Guidelines](https://github.com/tallclub/matimo/blob/main/CONTRIBUTING.md)
2. Clone repo and set up locally
3. [Commit Guidelines](./community/COMMIT_GUIDELINES.md) — Proper commit format
4. [Development Standards](./user-guide/DEVELOPMENT_STANDARDS.md) — Code quality rules  
5. Open PR and request review

### 📖 Maintaining/Reviewing
1. [Development Standards](./user-guide/DEVELOPMENT_STANDARDS.md) — Review checklist
2. [Contributing Guidelines](https://github.com/tallclub/matimo/blob/main/CONTRIBUTING.md) — PR requirements
3. [Commit Guidelines](./community/COMMIT_GUIDELINES.md) — Validate commits
4. [Architecture Overview](./architecture/OVERVIEW.md) — Understand design decisions

---

## Documentation Structure

```
docs/
├── index.md                      # This file — documentation index
├── RELEASES.md                   # Release notes and changelog
├── ROADMAP.md                    # Project roadmap
├── MCP.md                        # MCP server setup and Claude Desktop
├── getting-started/
│   ├── QUICK_START.md            # 5-minute setup (TypeScript + Python)
│   ├── installation.md           # Detailed installation
│   └── YOUR_FIRST_TOOL.md        # Create your first tool
├── api-reference/
│   ├── SDK.md                    # Complete SDK API (TypeScript + Python)
│   ├── ERRORS.md                 # Error handling and error codes
│   ├── TYPES.md                  # TypeScript type definitions
│   ├── META_TOOLS.md             # Built-in meta-tools reference (12 tools)
│   ├── POLICY_AND_LIFECYCLE.md   # Policy engine and tool lifecycle
│   ├── APPROVAL-SYSTEM.md        # Approval handler configuration
│   └── LOGGING.md                # Logger API and formats
├── tool-development/
│   ├── TOOL_SPECIFICATION.md     # YAML tool schema reference
│   ├── YAML_TOOLS.md             # YAML tool writing guide
│   ├── ADDING_TOOLS.md           # Creating tool provider packages
│   ├── DECORATOR_GUIDE.md        # TypeScript decorators
│   ├── TESTING.md                # Testing tools
│   ├── HTTP_PARAMETER_EMBEDDING.md # HTTP parameter encoding
│   └── PROVIDER_CONFIGURATION.md # Multi-provider setup
├── framework-integrations/
│   ├── LANGCHAIN.md              # LangChain (Python + TypeScript)
│   ├── CREWAI.md                 # CrewAI multi-agent (Python)
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
├── langchain/                    # LangChain ReAct examples (17 files)
└── crewai/                       # CrewAI examples (10 files)

TypeScript examples (typescript/examples/tools/):
├── policy/policy-demo.ts         # 11-mission policy lifecycle
├── skills/skills-demo.ts         # Skills lifecycle + TF-IDF
├── meta-flow/meta-tools-integration.ts  # Meta-tools lifecycle
└── agents/langchain-skills-policy-agent.ts  # Production agent pattern
```

---

## Key Concepts

### Tools

Tools are the building blocks of Matimo. They define what can be executed, what parameters they accept, and how they run.

- **YAML Tools** — Declarative tool definitions (see [Tool Specification](./TOOL_SPECIFICATION.md))
- **Decorator Tools** — TypeScript-based tool definitions (see [Decorator Guide](./DECORATOR_GUIDE.md))

### Executors

Executors run tools with different backends:

- **CommandExecutor** — Execute shell commands
- **HttpExecutor** — Make HTTP requests

See [API Reference](./api-reference/SDK.md) for details.

### SDK

Use the Matimo SDK (TypeScript) to load and execute tools:

```typescript
import { MatimoInstance } from 'matimo';

const matimo = await MatimoInstance.init('./tools');
const result = await matimo.execute('tool-name', { param: 'value' });
```

See [Quick Start](./getting-started/QUICK_START.md) and [API Reference](./api-reference/SDK.md).

### MCP Server

Matimo can run as an MCP server, allowing Claude and other clients to discover and use tools:

```typescript
// MCP Server - Coming in Phase 2
// import { MCPServer } from 'matimo/mcp';

const server = new MCPServer({ toolsPath: './tools', port: 3000 });
await server.start();
```

See [Quick Start](./getting-started/QUICK_START.md) for setup.

---

## Standards & Practices

### Code Quality

- **TypeScript**: Strict mode enforced (no `any`)
- **Testing**: 95%+ coverage (TypeScript + Python), TDD approach
- **Linting**: ESLint with automatic formatting
- **Documentation**: JSDoc comments for all public APIs

See [Development Standards](./DEVELOPMENT_STANDARDS.md).

### Commits

- **Format**: Conventional Commits (type(scope): subject)
- **Types**: feat, fix, docs, refactor, test, chore, perf, style, ci
- **Examples**: "feat(executor): add HTTP support", "fix(schema): validate enums"

See [Commit Guidelines](./community/COMMIT_GUIDELINES.md).

### Pull Requests

- Follow TDD approach (test first, implement after)
- Keep PRs focused (one feature/fix per PR)
- Ensure tests pass and coverage maintained (95%+)
- Follow code standards and get code review

See [Contributing Guidelines](https://github.com/tallclub/matimo/blob/main/CONTRIBUTING.md).

---

## Common Tasks

### Write a YAML Tool

1. Create `tools/provider/tool-name.yaml`
2. Follow [Tool Specification](./tool-development/TOOL_SPECIFICATION.md) schema
3. Include parameters, execution, output_schema
4. Add authentication if needed
5. Test with `pnpm test`

### Write a Decorator Tool

1. Create `src/tools/tool-name.tool.ts`
2. Use @tool and @param decorators
3. Implement execute() or async execute()
4. Follow [Decorator Guide](./tool-development/DECORATOR_GUIDE.md) patterns
5. Add unit tests

### Integrate with LangChain

1. See [Framework Integrations](./framework-integrations/LANGCHAIN.md) for patterns
2. Check `examples/tools/` for working examples
3. Follow [Architecture Overview](./architecture/OVERVIEW.md) for design decisions

### Contribute Code

1. Fork and clone repository
2. Create feature branch: `git checkout -b feat/description`
3. Write tests first (TDD)
4. Implement feature
5. Follow [Development Standards](./user-guide/DEVELOPMENT_STANDARDS.md)
6. Commit using [Commit Guidelines](./community/COMMIT_GUIDELINES.md)
7. Push and create PR
8. Follow [Contributing Guidelines](https://github.com/tallclub/matimo/blob/main/CONTRIBUTING.md) checklist

---

## Need Help?

- **Questions?** Check relevant documentation or open a [GitHub Discussion](https://github.com/tallclub/matimo/discussions)
- **Found a bug?** [Open an issue](https://github.com/tallclub/matimo/issues)
- **Troubleshooting?** See [FAQ](./troubleshooting/FAQ.md)
- **Want to contribute?** See [Contributing Guidelines](https://github.com/tallclub/matimo/blob/main/CONTRIBUTING.md)

---

> **Documentation Note:** While I strive for accuracy and completeness, this documentation may contain oversights, outdated information, or areas needing improvement, due to my limitations. If you notice any errors, missing information, or have suggestions for enhancement, please help me to improve! See our [Contributing Guidelines](https://github.com/tallclub/matimo/blob/main/CONTRIBUTING.md) to learn how to submit corrections and improvements. Your contributions to documentation are highly valued! Thank you.

---

Last updated: June 2026
