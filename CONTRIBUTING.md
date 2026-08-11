# Contributing to Matimo

Welcome to Matimo! We're building a universal, configuration-driven AI tools ecosystem where tools are defined once in YAML and accessed everywhere.

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

**Create a new core tool with no external dependencies**

- See: [packages/core/tools/calculator/](./packages/core/tools/) for template
- Examples: `timestamp`, `uuid-generator`, `hash`, `base64-encode`

**Steps:**

1. Create `packages/core/tools/{tool-name}/definition.yaml`
2. Implement the tool logic
3. Add test fixture: `packages/core/test/fixtures/{tool-name}-fixture.yaml`
4. Run `pnpm validate-tools && pnpm test`

**Example PR:**

```
feat(core): add uuid-generator tool for random ID creation
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
- See test patterns: [packages/core/test/unit/](./packages/core/test/unit/)

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
   pnpm build
   pnpm lint:fix && pnpm format
   pnpm test
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
- 📖 Read [docs/](/docs/) for detailed guides

---

## Before You PR

- Test locally with `pnpm test`
- Run linter: `pnpm lint`
- Run formatter: `pnpm format`
- Keep PRs focused (one thing per PR)
- Describe **what** and **why** in the description

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/matimo.git`
3. Install dependencies: `pnpm install`
4. Create a feature branch: `git checkout -b feature/short-description`

## Development Setup

### Prerequisites

- Node.js v18+ installed
- pnpm installed globally: `npm install -g pnpm`
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
| `pre-commit` | `git commit` | Lint + Format        | Fast feedback before committing         |
| `pre-push`   | `git push`   | Tests + Coverage     | Comprehensive validation before pushing |
| `commit-msg` | `git commit` | Conventional commits | Enforce commit message format           |

**What runs at each stage:**

**Pre-commit (fast):**

```bash
pnpm lint         # ESLint checks
pnpm format:check # Prettier formatting check (no modifications)
```

**Pre-push (comprehensive):**

```bash
pnpm test:coverage  # Run all tests with coverage report

# Optional faster local check before pushing (runs unit + integration quickly)
# pnpm test
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
pnpm install            # Install dependencies
pnpm build              # Compile TypeScript
pnpm test               # Run all tests
pnpm test:watch         # Watch mode for TDD
pnpm test:coverage      # Coverage report
pnpm lint               # Check for linting issues
pnpm lint:fix           # Auto-fix linting issues
pnpm format             # Format with Prettier
pnpm clean              # Remove build artifacts
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
const EXECUTION_TYPES = ['command', 'http', 'script'] as const;

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
// Use custom error classes with standard codes
enum ErrorCode {
  INVALID_SCHEMA = 'INVALID_SCHEMA',
  EXECUTION_FAILED = 'EXECUTION_FAILED',
  AUTH_FAILED = 'AUTH_FAILED',
  TOOL_NOT_FOUND = 'TOOL_NOT_FOUND',
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  VALIDATION_FAILED = 'VALIDATION_FAILED',
}

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
// Validate all inputs against schema
const validated = toolSchema.parameters.parse(params);

// Use environment variables for secrets (prefix: MATIMO_)
const apiKey = process.env.MATIMO_SLACK_API_KEY;
if (!apiKey) {
  throw new MatimoError('Missing Slack API key', ErrorCode.AUTH_FAILED);
}

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

- **Coverage Target:** 80%+ minimum, 90%+ for critical paths
- **Naming:** Describe behavior - "should X when Y"
- **Organization:** Use `describe` and `it` blocks
- **Pattern:** AAA - Arrange, Act, Assert
- **Fixtures:** Use test data files in `test/fixtures/`
- **Mocks:** Clean up mocks after each test with `afterEach(() => jest.clearAllMocks())`

## Commits & Pull Requests

### Commit Format

```
<type>(<scope>): <subject>

<body>

Closes #<issue>
```

**Types:** `feat`, `fix`, `docs`, `refactor`, `test`, `chore`

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
- [ ] **Tests:** All passing, coverage maintained (>80%)
- [ ] **Code:** Formatted (`pnpm format`) and linted (`pnpm lint`)
- [ ] **Build:** TypeScript compiles without errors (`pnpm build`)
- [ ] **Docs:** Updated if behavior changes

## Adding a Tool

1. Create `tools/{provider}/{tool-name}.yaml` with full YAML schema
2. Include all required fields:
   - `name`, `description`, `version`
   - `parameters` with types and validation
   - `execution` with proper command/HTTP config
   - `output_schema` for response validation
   - `authentication` if required
3. Add test fixture in `test/fixtures/{provider}/`
4. Add examples in tool YAML showing actual usage
5. Test locally: `pnpm test`
6. Create PR with tool definition

**Example tool structure:**

```yaml
name: calculator
description: Perform basic math operations
version: '1.0.0'
parameters:
  operation:
    type: string
    enum: [add, subtract, multiply, divide]
    required: true
  a:
    type: number
    required: true
  b:
    type: number
    required: true
execution:
  type: command
  command: node calculator.js
  args: ['--op', '{operation}', '{a}', '{b}']
output_schema:
  type: object
  properties:
    result:
      type: number
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

We are currently prioritizing:

- **Foundation:** Core tool loading, execution, and validation
- **SDK:** TypeScript SDK with factory and decorator patterns
- **Integration:** MCP server for Claude integration
- **Tools:** Building 1000+ pre-configured tools
- **Testing:** Comprehensive test coverage (80%+)

Check [GitHub Issues](https://github.com/tallclub/matimo/issues) for "good first issue" labels!

## Performance & Quality Targets

### Execution Time

- Simple tools (echo, time): <100ms
- API tools (GitHub, Slack): <2 seconds
- Data processing (CSV, JSON): <1 second

### Test Coverage

- **Overall:** 80%+ (currently 112 tests across 11 suites)
- **Critical paths:** 90%+
- **Branch coverage:** All if/else paths tested

### Build Quality

- **Zero TypeScript errors** (strict mode)
- **Zero ESLint warnings**
- **All tests passing** before merge
- **No `any` types** in codebase

## Roadmap

### Foundation (Complete)

- Core tool types and schema validation
- Tool loader (YAML/JSON parsing)
- Command and HTTP executors
- Error handling and logging
- 10+ example tools
- 112+ comprehensive tests

### Reliability (Coming)

- OAuth2 authentication
- Rate limiting and quota tracking
- API schema health monitoring
- Advanced error recovery

### Ecosystem (Coming)

- Distributed tool registry
- Automated schema translation (OpenAPI → Matimo)
- Skills/workflows (multi-tool composition)
- Python SDK

### Intelligence (Coming)

- LLM-powered tool recommendations
- Automatic parameter inference
- Schema generation from API docs

## Troubleshooting

### Tests Failing

```bash
# Clean and reinstall
rm -rf node_modules pnpm-lock.yaml
pnpm install
pnpm test
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

By contributing to Matimo, you agree that your contributions will be licensed under the same license as the project (check LICENSE file).

Thank you for contributing to Matimo! 🙏
