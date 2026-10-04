# Contributing to Matimo

Welcome to Matimo! Matimo is a policy-governed tool-execution SDK for AI agents: a tool is defined once in YAML and runs from TypeScript, Python, LangChain, CrewAI and MCP, with every call passing through the policy engine. The repo holds two SDKs that must stay in step: `typescript/` (a pnpm workspace) and `python/` (a uv workspace).

## Quick Links

- **GitHub:** https://github.com/tallclub/matimo
- **Issues:** https://github.com/tallclub/matimo/issues
- **Discussions:** https://github.com/tallclub/matimo/discussions

- **Discord:** https://discord.gg/3JPt4mxWDV

## How to Contribute

1. **Bugs & small fixes** → Open a PR!
2. **New features / architecture** → Start a [GitHub Discussion](https://github.com/tallclub/matimo/discussions) first
3. **Questions** → Open a GitHub Discussion

---

## 🌟 Good First Contributions (Start Here!)

New to Matimo? Here are tasks perfect for first-time contributors:

### Level 1: Documentation (15-30 mins)

**Improve clarity in existing docs**

- Fix typos or unclear explanations in `/docs/**/*.md`
- Add missing examples to existing tool documentation
- Improve error message clarity in code comments
- Link related documentation pages

**Example PR:**

```
feat(docs): clarify QUICK_START OAuth examples with real Slack credentials flow
```

### Level 2: Add a Simple Tool (30-60 mins)

**Add a tool to an existing provider package**

- Template: any tool under `typescript/packages/<provider>/tools/` (for example `typescript/packages/github/tools/`)
- Follow the [Tool Workflow](./docs/tool-development/TOOL_WORKFLOW.md) checklist

**Steps:**

1. Create `typescript/packages/<provider>/tools/<tool-name>/definition.yaml` and the same file under `python/packages/<provider>/src/matimo_<provider>/tools/<tool-name>/`
2. Prefer `type: http`; a `type: function` tool also needs `<tool-name>.ts` and `<tool-name>.py` beside the YAML
3. Add unit tests in both SDKs (mocked HTTP) and the examples listed in the workflow
4. Run `cd typescript && pnpm validate-tools && pnpm test`, and `cd python && make test`

**Example PR:**

```
feat(github): add github-list-releases tool
```

### Level 3: Fix a Bug (1-2 hours)

**Look for issues labeled `bug` or `good-first-issue`**

- Check [Open Issues](https://github.com/tallclub/matimo/issues?q=label%3A%22good-first-issue%22)
- Pick one, fix locally, test with `pnpm test`
- Submit PR with reproduction steps in description

**Example PR:**

```
fix(core): handle empty input in calculator division operation
```

### Level 4: Expand Tool Tests (1-2 hours)

**Add test coverage for existing tools**

- Look for tools with low coverage in `pnpm test:coverage`
- Add edge cases, error scenarios, validation tests
- See test patterns: [typescript/packages/core/test/unit/](./typescript/packages/core/test/unit/) and [Testing Tools](./docs/tool-development/TESTING.md)

**Example PR:**

```
test(gmail): add tests for invalid email address validation
```

### Level 5: Create a Simple Provider (2-4 hours)

**Build a new tool provider package** (e.g., `@matimo/weather`, `@matimo/dictionary`)

- Follow: [Adding Tools to Matimo](./docs/tool-development/ADDING_TOOLS.md)
- Include 3-5 simple tools (no complex auth needed)
- Add examples and tests

**Example PR:**

```
feat(weather): add OpenWeatherMap tools (get-forecast, get-current-temp)
```

---

## How to Submit Your First PR

1. **Pick a task** from above
2. **Create a branch:** `git checkout -b {type}/{short-desc}`
   - Example: `docs/quick-start-clarity`, `feat/uuid-tool`, `fix/calc-division`
3. **Make changes** and test locally:
   ```bash
   cd typescript && pnpm build && pnpm lint:fix && pnpm format && pnpm test
   cd ../python && make lint && make typecheck && make test
   ```
4. **Write clear PR title:**
   - ✅ `feat(core): add timestamp tool`
   - ✅ `docs(quickstart): clarify OAuth setup`
   - ❌ `Update stuff`, `Fix thing`, `Changes`
5. **Describe WHAT and WHY** in PR description (see template)
6. **Expect feedback** — don't be discouraged! Maintainers will help guide you.

---

## Need Help?

- 🐦 Ask in [GitHub Discussions](https://github.com/tallclub/matimo/discussions)
- 💬 Join [Discord](https://discord.gg/3JPt4mxWDV) for real-time chat
- 📖 Read the [documentation index](./docs/index.md) for detailed guides

---

## Before You PR

- Test both SDKs: `cd typescript && pnpm test`, `cd python && make test`
- Run linters: `pnpm lint` (from `typescript/`), `make lint && make typecheck` (from `python/`)
- Run the formatter: `pnpm format`
- Change TypeScript and Python together; a feature that ships in one SDK only needs a reason in the PR
- Keep PRs focused (one thing per PR)
- Describe **what** and **why** in the description

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/matimo.git`
3. Install dependencies: `cd typescript && pnpm install`, then `cd ../python && make install`
4. Create a feature branch: `git checkout -b feature/short-description`

Run every `pnpm` command from `typescript/` and every `make`/`uv` command from `python/`. The root `packages/` and `examples/` directories are untracked leftovers; don't add files there.

## Development Setup

### Prerequisites

- Node.js v18+ installed
- pnpm 8: `npm install -g pnpm@8`
- Python 3.11 and [uv](https://docs.astral.sh/uv/)
- Git configured
- VS Code (or preferred IDE)

### Git Hooks Setup

This project uses [Husky](https://typicode.io/husky/) v9 to enforce code quality at different stages:

**Setup Instructions:**

After cloning the repo, dependencies install should auto-initialize hooks:

```bash
pnpm install
```

Or manually initialize:

```bash
pnpm exec husky install
chmod +x .husky/pre-commit .husky/pre-push .husky/commit-msg
```

**Available Git Hooks:**

| Hook         | Stage        | Checks               | Purpose                                 |
| ------------ | ------------ | -------------------- | --------------------------------------- |
| `pre-commit` | `git commit` | Lint + Format (TS), ruff (Python) | Fast feedback before committing |
| `pre-push`   | `git push`   | TS tests + coverage, Python core tests (≥95% coverage) | Comprehensive validation before pushing |
| `commit-msg` | `git commit` | Conventional commits | Enforce commit message format           |

**What runs at each stage:**

**Pre-commit (fast):**

```bash
cd typescript && pnpm lint && pnpm format:check   # ESLint + Prettier check (no modifications)
cd python && uv run ruff check packages/          # skipped if uv isn't installed
```

**Pre-push (comprehensive):**

```bash
cd typescript && pnpm test:coverage   # fails below the floors in jest.config.cjs
cd python && uv run pytest packages/core/tests/ --cov=packages/core/src/matimo --cov-fail-under=95
```

**Note:** The pre-commit hook uses `format:check` to validate formatting without modifying files. If formatting issues are found, run `pnpm format` to fix them and then commit again.

**Troubleshooting:**

If hooks aren't triggering:

```bash
# Re-initialize hooks
pnpm exec husky install

# Check hook permissions
chmod +x .husky/pre-commit .husky/pre-push .husky/commit-msg

# Test hook directly
bash .husky/pre-commit
```

**Bypass hooks (not recommended):**

```bash
git commit --no-verify  # Skip pre-commit hook
git push --no-verify    # Skip pre-push hook
```

### Build & Test Commands

```bash
# TypeScript (from typescript/)
pnpm install            # Install dependencies
pnpm build              # Compile TypeScript
pnpm test               # Run all tests
pnpm test:watch         # Watch mode for TDD
pnpm test:coverage      # Coverage report (enforces the floors)
pnpm lint               # Check for linting issues
pnpm lint:fix           # Auto-fix linting issues
pnpm format             # Format with Prettier
pnpm validate-tools     # Validate every tool YAML
pnpm clean              # Remove build artifacts

# Python (from python/)
make install            # uv sync --all-extras --dev
make test               # All tests
make test-coverage      # HTML coverage report
make lint               # ruff
make typecheck          # mypy strict on packages/core/src
make validate-tools     # Validate every tool YAML
```

## Code Standards

### TypeScript Best Practices

**DO:**

```typescript
// Use explicit types (no `any`)
function loadTool(path: string): ToolDefinition {
  // implementation
}

// Use interfaces for contracts
interface ToolDefinition {
  name: string;
  execute(params: Record<string, unknown>): Promise<Result>;
}

// Use const for immutable data
const EXECUTION_TYPES = ['http', 'function', 'command'] as const;

// Include JSDoc comments explaining WHY, not WHAT
/**
 * Load a tool definition from a YAML/JSON file
 * @param path - Path to tool definition file
 * @returns Loaded and validated tool definition
 * @throws {FileNotFoundError} If file doesn't exist
 * @throws {SchemaValidationError} If tool schema invalid
 */
function loadToolFromFile(path: string): ToolDefinition {
  // implementation
}

// Return structured errors with codes
throw new MatimoError('Tool execution failed', ErrorCode.EXECUTION_FAILED, {
  toolName: 'slack_post',
  details: { statusCode: 500 },
});
```

**DON'T:**

```typescript
// No implicit any
function loadTool(path) {}

// No var
var toolName = 'calculator';

// No generic errors
throw new Error('Something went wrong');

// No console.log in production code
console.log('Tool loaded');
```

### Naming Conventions

```typescript
// Classes: PascalCase
class ToolExecutor {}
class CommandExecutor {}

// Functions/Variables: camelCase
function loadTool() {}
const toolRegistry = new Map();

// Constants: UPPER_SNAKE_CASE
const MAX_RETRIES = 3;
const DEFAULT_TIMEOUT = 5000;

// Files: kebab-case
// tool-loader.ts, command-executor.ts, error-codes.ts
```

### Error Handling

```typescript
// Throw MatimoError with an existing ErrorCode (see docs/api-reference/ERRORS.md for all 13)
import { MatimoError, ErrorCode } from '@matimo/core';

// Always include context in error logs
try {
  await execute(tool);
} catch (error) {
  logger.error('Tool execution failed', {
    toolName: tool.name,
    error: error.message,
    traceId: context.traceId,
  });
  throw new MatimoError('Tool execution failed', ErrorCode.EXECUTION_FAILED);
}
```

### Security Standards

**DO:**

```typescript
// Validate inputs before using them
if (typeof params.channel !== 'string' || params.channel.length === 0) {
  throw new MatimoError('channel is required', ErrorCode.INVALID_PARAMETER);
}

// Take secrets from credential placeholders in the YAML ('Bearer {SLACK_BOT_TOKEN}');
// Matimo fills them from the call's credentials or MATIMO_<NAME> / <NAME> in the environment

// Redact sensitive data in logs
logger.info('Tool auth', { userId: user.id, hasToken: !!token });
```

**DON'T:**

```typescript
// Never hardcode credentials
const API_KEY = 'abc123xyz'; // NEVER

// Never log sensitive data
logger.info('Token', { token: apiKey }); // WRONG

// Never trust user input
const result = userInput.trim(); // Need validation
```

### Logging Standards

```typescript
// Use structured logging with context
logger.info('tool_execution', {
  traceId: context.traceId,
  toolName: tool.name,
  parameters: sanitized(params), // Never log raw secrets
  duration: executionTime,
  status: 'success' | 'failed',
});

// Log at appropriate levels
logger.debug('Parsing tool definition'); // Detailed info
logger.info('Tool loaded successfully'); // Informational
logger.warn('Tool schema drift detected'); // Warning
logger.error('Tool execution failed', error); // Error
```

## Testing Standards

### TDD Approach

All features must follow Test-Driven Development:

1. Write a failing test describing desired behavior
2. Implement minimal code to pass the test
3. Refactor if needed
4. Repeat

**Example:**

```typescript
// ✅ Test first
describe('ToolLoader', () => {
  it('should load valid YAML tool definition', () => {
    // Arrange
    const filePath = './fixtures/calculator.yaml';

    // Act
    const tool = loader.loadToolFromFile(filePath);

    // Assert
    expect(tool.name).toBe('calculator');
  });

  it('should throw FileNotFoundError for missing file', () => {
    // Arrange
    const filePath = './fixtures/nonexistent.yaml';

    // Act & Assert
    expect(() => loader.loadToolFromFile(filePath)).toThrow(FileNotFoundError);
  });
});

// ✅ Then implement
function loadToolFromFile(path: string): ToolDefinition {
  const yaml = fs.readFileSync(path, 'utf-8');
  const parsed = YAML.parse(yaml);
  return schema.parse(parsed);
}
```

### Test Quality

- **Coverage:** TypeScript must stay at or above the floors in `typescript/jest.config.cjs` (lines 95%, functions 97%, branches 87%, statements 95%); new tools aim for 100% in both SDKs
- **Naming:** Describe behavior - "should X when Y"
- **Organization:** Use `describe` and `it` blocks
- **Pattern:** AAA - Arrange, Act, Assert
- **Fixtures:** Use test data files in `test/fixtures/`
- **Mocks:** Never call live APIs in unit tests; mock HTTP with `jest.mock('axios')` (TypeScript) or `respx` (Python)

## Commits & Pull Requests

### Commit Format

```
<type>(<scope>): <subject>

<body>

Closes #<issue>
```

**Types** (enforced by commitlint): `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`, `ci`, `revert`, `example`. See [Commit Guidelines](./docs/community/COMMIT_GUIDELINES.md).

**Examples:**

```
feat(executor): add HTTP executor with response validation
fix(schema): handle missing required fields correctly
docs(tool-spec): add examples for all execution types
test(validator): add schema validation test cases
refactor(loader): simplify YAML parsing logic
```

### PR Requirements

- [ ] **Title:** Descriptive, concise summary
- [ ] **Description:** What changed and why
- [ ] **Tests:** All passing in both SDKs; TypeScript coverage floors hold
- [ ] **Code:** Formatted (`pnpm format`) and linted (`pnpm lint`)
- [ ] **Build:** TypeScript compiles without errors (`pnpm build`)
- [ ] **Docs:** Updated if behavior changes

## Adding a Tool

Follow the [Tool Workflow](./docs/tool-development/TOOL_WORKFLOW.md) checklist; [Adding Tools](./docs/tool-development/ADDING_TOOLS.md) has the detail. In short:

1. Read the provider's official API reference
2. Write `definition.yaml` for both SDKs (prefer `type: http`; leave `status` unset)
3. `pnpm validate-tools` (it also requires `requires_approval: true` on HTTP DELETE tools and `risk:` on function tools)
4. Unit tests in both SDKs with mocked HTTP
5. Examples: TypeScript factory, decorator, LangChain and (for writes) with-approval; Python native, LangChain and CrewAI
6. Run the full gate in both SDKs

**Example tool structure** (a GitHub HTTP tool):

```yaml
name: github-get-repository
description: Get repository details
version: '1.0.0'
parameters:
  owner:
    type: string
    required: true
    description: Repository owner
  repo:
    type: string
    required: true
    description: Repository name
execution:
  type: http
  method: GET
  url: 'https://api.github.com/repos/{owner}/{repo}'
  headers:
    Authorization: 'Bearer {GITHUB_TOKEN}'
    Accept: application/vnd.github+json
authentication:
  type: bearer
  location: header
notes:
  env: GITHUB_TOKEN
```

## Third-Party Connectors — Credential Policy (BYOK)

Every provider package that talks to an external API or platform (Slack,
Composio, HubSpot, a future Stripe/Zendesk/etc. connector) **must** follow a
bring-your-own-key (BYOK) / bring-your-own-account model:

- The credential (API key, OAuth client ID/secret, connected-account ID,
  etc.) is always supplied at runtime by whoever deploys or configures
  Matimo — via an environment variable or tool parameter — never hardcoded,
  never a Matimo-owned/shared account, and never routed through
  Matimo-operated infrastructure.
- Grep the tool's `definition.yaml` and any executor code for literal
  secrets before opening a PR; only `{ENV_VAR}` placeholders and
  `notes.env` references should appear (see
  [SECURITY.md § Never Hardcode Secrets](./SECURITY.md#2-never-hardcode-secrets)).
- Add an entry to [`THIRD_PARTY_NOTICES.md`](./THIRD_PARTY_NOTICES.md) for
  the new provider: package name, credential env var(s), and a link to that
  provider's own Terms of Service.
- If the connector is a thin wrapper over another platform's catalog (the way
  `@matimo/composio` wraps Composio), state that plainly in the package
  README along with a non-affiliation disclaimer — see
  [`typescript/packages/composio/README.md`](./typescript/packages/composio/README.md)
  for the pattern to follow.

This exists because Matimo's own MIT license only governs Matimo's source
code — it says nothing about, and doesn't excuse anyone from, the terms of
whatever third-party service a tool connects to. Keeping every connector on
a BYOK model means that compliance relationship stays directly between the
end user and the provider, where it belongs.

## AI/Vibe-Coded PRs

Welcome! 🤖 Built with Claude, ChatGPT, or other AI tools? **Awesome!** Just mark it:

- [ ] Mark as AI-assisted in PR title or description
- [ ] Note the degree of testing (untested / lightly tested / fully tested)
- [ ] Include prompts or session logs if possible (super helpful!)
- [ ] Confirm you understand what the code does

AI PRs are first-class citizens here. We just want transparency so reviewers know what to look for.

## Current Focus

See the [Roadmap](./docs/ROADMAP.md) for what is planned and [GitHub Issues](https://github.com/tallclub/matimo/issues) for "good first issue" labels.

### Build Quality

- **Zero TypeScript errors** (strict mode) and mypy strict on `python/packages/core/src`
- **Zero ESLint and ruff errors**
- **All tests passing** in both SDKs before merge
- **No `any` types** in TypeScript source

## Troubleshooting

### Tests Failing

```bash
# Clean and reinstall (keep pnpm-lock.yaml)
cd typescript
pnpm clean && rm -rf node_modules
pnpm install && pnpm test
```

### TypeScript Errors

```bash
# Check and build
pnpm build
# Fix reported errors
```

### Linting Errors

```bash
# Auto-fix and format
pnpm lint:fix
pnpm format
```

## Need Help?

- **Questions:** Open a [GitHub Discussion](https://github.com/tallclub/matimo/discussions)
- **Found a bug?** [Open an issue](https://github.com/tallclub/matimo/issues)
- **Want to chat?** Start a discussion in our community

## License

By contributing to Matimo, you agree that your contributions will be licensed under the project's [MIT License](./LICENSE).

Thank you for contributing to Matimo! 🙏
