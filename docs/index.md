# Matimo Documentation

<p align="center">
<img src="./assets/logo.png" alt="Matimo Logo" width="300" style="border-radius: 8px; margin: 20px 0;" />
</p>

<p align="center">
  <a href="https://discord.gg/3JPt4mxWDV"><img src="https://img.shields.io/badge/Discord-Join%20Chat-5865F2?style=for-the-badge&logo=discord&logoColor=white" alt="Discord"></a>
</p>

**Matimo — Enable Agents To Extentend Itsel.**.
Most SDKs give agents tools. Matimo gives agents the ability to build new tools — validated, approved, and live — without restarting. The meta-tool layer is Matimo's core differentiator.

> A framework-agnostic SDK with pre-built provider tools, a skills knowledge layer, MCP out of the box, and agents that autonomously build new capabilities — governed by a policy engine you control

Complete documentation for Matimo.

## ⚡ Getting Started

1. **[Quick Start](./getting-started/QUICK_START.md)** — 5-minute setup (npm install → first tool execution)
2. **[Your First Tool](./getting-started/YOUR_FIRST_TOOL.md)** — Create and test a basic YAML tool
3. **[API Reference](./api-reference/SDK.md)** — Understand the SDK fundamentals

Then explore [Three Integration Patterns](./architecture/OVERVIEW.md#three-integration-patterns) to see what's possible.

### 📦 **Full Installation & Requirements**

- **[Installation](./getting-started/installation.md)** — Detailed setup for Windows/macOS/Linux
  - Node.js 18+ and npm/pnpm requirements
  - From npm (recommended) or from source
  - Troubleshooting common issues
  - Environment setup (API keys, OAuth)

## Reference

### 🟢 **Core Concepts (Start Here)**

- **[Architecture Overview](./architecture/OVERVIEW.md)** — Understand how Matimo works
  - High-level system design
  - Three integration patterns explained
  - Framework compatibility
  - Data flow diagrams

- **[API Reference](./api-reference/SDK.md)** — TypeScript SDK documentation
  - `MatimoInstance` class and methods
  - `.execute()`, `.listTools()`, `.searchTools()`
  - Decorator pattern (`@tool`)
  - Error handling
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
  - Testing patterns with Jest
  - Mocking external services
  - Coverage requirements (80%+)
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
   - Testing coverage (80%+ minimum)
   - ESLint and Prettier
   - JSDoc documentation

---

## Development & Advanced Usage

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
4. [Policy Demo](https://github.com/tallclub/matimo/tree/main/examples/tools/policy) — 11-mission autonomous agent demo
5. [Skills Demo](https://github.com/tallclub/matimo/tree/main/examples/tools/skills) — 5-mission skills lifecycle demo

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

### 🟢 For First-Time Users

1. Start with [Quick Start](./getting-started/QUICK_START.md) for setup
2. Try [Your First Tool](./getting-started/YOUR_FIRST_TOOL.md) to create a tool
3. Check [API Reference](./api-reference/SDK.md) for SDK usage
4. See [Tool Specification](./tool-development/TOOL_SPECIFICATION.md) to write tools
5. Review [Architecture Overview](./architecture/OVERVIEW.md) to understand design

### For Tool Writers

1. Read [Tool Specification](./tool-development/TOOL_SPECIFICATION.md) for YAML tools
2. See [Adding Tools to Matimo](./tool-development/ADDING_TOOLS.md) to publish packages
3. Follow [Development Standards](./user-guide/DEVELOPMENT_STANDARDS.md) for code quality

### For Framework Integration

1. Check [Framework Integrations](./framework-integrations/LANGCHAIN.md) for LangChain/CrewAI
2. See [Architecture Overview](./architecture/OVERVIEW.md) for integration patterns
3. Review examples in `examples/` directory

### For Contributors

1. Check [Contributing Guidelines](https://github.com/tallclub/matimo/blob/main/CONTRIBUTING.md) for contribution guidelines
2. Follow [Development Standards](./user-guide/DEVELOPMENT_STANDARDS.md) for code quality
3. Use [Commit Guidelines](./community/COMMIT_GUIDELINES.md) for proper commit format

### For Maintainers

1. Review [Development Standards](./user-guide/DEVELOPMENT_STANDARDS.md) for quality metrics
2. Check [Commit Guidelines](./community/COMMIT_GUIDELINES.md) for PR commit validation
3. See [Contributing Guidelines](https://github.com/tallclub/matimo/blob/main/CONTRIBUTING.md) for overall workflow

---

## Documentation Structure

```
docs/
├── index.md                      # This file - documentation index
├── RELEASES.md                   # Release notes and changelog
├── ROADMAP.md                    # Project roadmap
├── getting-started/
│   ├── QUICK_START.md            # 5-minute setup guide
│   ├── installation.md           # Detailed installation instructions
│   └── YOUR_FIRST_TOOL.md        # Create your first tool
├── api-reference/
│   ├── SDK.md                    # Complete SDK API
│   ├── ERRORS.md                 # Error handling and error codes
│   ├── TYPES.md                  # TypeScript type definitions
│   ├── META_TOOLS.md             # Built-in meta-tools reference
│   ├── POLICY_AND_LIFECYCLE.md   # Policy engine and tool lifecycle
│   ├── APPROVAL-SYSTEM.md        # Approval handler configuration
│   └── LOGGING.md                # Winston logger integration
├── tool-development/
│   ├── TOOL_SPECIFICATION.md     # YAML tool schema
│   ├── YAML_TOOLS.md             # YAML tool writing guide
│   ├── ADDING_TOOLS.md           # Creating tool packages
│   ├── DECORATOR_GUIDE.md        # TypeScript decorators
│   ├── TESTING.md                # Testing tools
│   └── PROVIDER_CONFIGURATION.md # Multi-provider setup
├── framework-integrations/
│   └── LANGCHAIN.md              # LangChain & framework patterns
├── architecture/
│   ├── OVERVIEW.md               # System design and patterns
│   └── OAUTH.md                  # OAuth2 implementation
├── user-guide/
│   ├── SDK_PATTERNS.md           # SDK usage patterns
│   ├── TOOL_DISCOVERY.md         # Discovering tools
│   ├── AUTHENTICATION.md         # Authentication setup
│   └── DEVELOPMENT_STANDARDS.md  # Code quality rules
├── community/
│   └── COMMIT_GUIDELINES.md      # Conventional commits
└── troubleshooting/
    └── FAQ.md                    # Common questions & solutions

Root-level files:
├── [CONTRIBUTING.md](https://github.com/tallclub/matimo/blob/main/CONTRIBUTING.md) — Contribution guidelines
├── [SECURITY.md](https://github.com/tallclub/matimo/blob/main/SECURITY.md) — Security policy
└── [README.md](https://github.com/tallclub/matimo/blob/main/README.md) — Project overview
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
- **Testing**: 80%+ coverage, TDD approach
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
- Ensure tests pass and coverage maintained (80%+)
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

Last updated: February 2026
