# Development Standards — Code Quality Rules

Code quality standards and best practices for Matimo. Covers both **Python** and **TypeScript** SDKs.

## Table of Contents

- [Python Standards](#python-standards)
- [TypeScript Standards](#typescript-standards)
- [Naming Conventions](#naming-conventions)
- [Error Handling](#error-handling)
- [Testing Standards](#testing-standards)
- [Documentation Standards](#documentation-standards)
- [Security Standards](#security-standards)
- [Logging Standards](#logging-standards)
- [Performance Standards](#performance-standards)
- [Quality Metrics](#quality-metrics)

---

## Python Standards

### Strict Type Hints (Required)

All Python code must use type hints throughout. Checked by `mypy` in strict mode.

```python
# pyproject.toml (mypy config)
[tool.mypy]
strict = true
python_version = "3.11"
```

**DO:**

```python
from __future__ import annotations
from typing import Any

def load_tool(path: str) -> ToolDefinition:
    ...

async def execute(tool: ToolDefinition, params: dict[str, Any]) -> Any:
    ...
```

**DON'T:**

```python
def load_tool(path):           # No type hints
    ...

def execute(tool, params):     # No types
    ...
```

### Pydantic for Runtime Validation

All tool definitions, configs, and external inputs must use Pydantic models.

```python
from pydantic import BaseModel, Field

class Parameter(BaseModel):
    type: str
    required: bool = False
    description: str | None = None

# Pydantic validates on construction — never trust raw dicts
tool = ToolDefinition.model_validate(raw_yaml)
```

### Code Style (Ruff + Mypy)

```bash
# From python/ workspace root:
make lint          # ruff check
make lint-fix      # ruff check --fix
make format        # ruff format
make typecheck     # mypy strict (via packages/core)

# Or directly with uv:
uv run ruff check packages/ scripts/
uv run ruff format packages/ scripts/
cd packages/core && uv run mypy src/
```

**Rules enforced:**
- No `# type: ignore` without a comment explaining why
- No `Any` without explicit justification
- Snake_case for all functions, variables, modules
- `from __future__ import annotations` at the top of every file

### Async-First

All I/O operations must be `async def`. Use `asyncio.run()` only at the top-level entry point.

```python
# ✅ DO: async methods
async def execute(self, tool_name: str, params: dict[str, Any]) -> Any:
    ...

# ✅ DO: asyncio.run() only at entry
if __name__ == '__main__':
    asyncio.run(main())

# ❌ DON'T: Synchronous I/O in the call stack
def execute(self, tool_name: str, ...):  # DO NOT block the event loop
    result = requests.get(url)           # Blocking!
```

---

## Python Naming Conventions

| Construct | Convention | Example |
|-----------|-----------|---------|
| Files | `snake_case.py` | `tool_loader.py` |
| Classes | `PascalCase` | `ToolLoader`, `MatimoError` |
| Functions/methods | `snake_case` | `load_tool_from_file()` |
| Variables | `snake_case` | `tool_registry` |
| Constants | `UPPER_SNAKE_CASE` | `MAX_RETRIES = 3` |
| Private | `_leading_underscore` | `_resolve_path()` |

---

## Python Error Handling

### Use Structured Errors

```python
from matimo.errors import MatimoError, ErrorCode

# Throw with context
raise MatimoError(
    "Tool execution failed",
    ErrorCode.EXECUTION_FAILED,
    {"tool_name": tool.name, "reason": "timeout"},
)
```

### Catching Pattern

```python
try:
    result = await executor.execute(tool, params)
    return result
except MatimoError:
    raise  # re-raise structured errors as-is
except Exception as exc:
    raise MatimoError(
        f"Unexpected error executing '{tool.name}': {exc}",
        ErrorCode.EXECUTION_FAILED,
        {"tool_name": tool.name},
    ) from exc
```

---

## Python Testing Standards

### Framework: pytest + pytest-asyncio

```bash
# From python/ workspace root (recommended):
make test             # full suite
make test-unit        # unit tests only
make test-integration # integration tests only
make test-coverage    # tests + HTML coverage report

# Or with uv directly:
uv run pytest packages/core/tests/ -v
uv run pytest packages/core/tests/ --cov=packages/core/src/matimo --cov-report=term-missing
```

### Test Structure

```python
# packages/core/tests/unit/test_tool_loader.py
import pytest
from matimo.core.loader import ToolLoader

class TestToolLoader:
    def setup_method(self):
        self.loader = ToolLoader()

    @pytest.mark.asyncio
    async def test_load_valid_yaml(self, tmp_path):
        # Arrange
        yaml_content = "name: calculator\n..."
        path = tmp_path / "definition.yaml"
        path.write_text(yaml_content)

        # Act
        tool = self.loader.load_tool_from_file(str(path))

        # Assert
        assert tool.name == "calculator"

    def test_raises_on_missing_file(self):
        with pytest.raises(MatimoError) as exc_info:
            self.loader.load_tool_from_file("./nonexistent.yaml")
        assert exc_info.value.code == ErrorCode.FILE_NOT_FOUND
```

### Coverage Targets

| Metric | Minimum |
|--------|----------|
| Statements | 95% |
| Branches | 87% |
| Functions | 97% |
| Lines | 95% |

---

## Python Development Workflow

The `python/` workspace root has a **Makefile** that mirrors the TypeScript `package.json` scripts. Run all commands from `python/`.

### Command Reference

| Makefile | Equivalent to TS | What it does |
|----------|-----------------|--------------|
| `make install` | `pnpm install` | `uv sync --all-extras --dev` |
| `make test` | `pnpm test` | Run full pytest suite |
| `make test-unit` | — | Unit tests only |
| `make test-integration` | — | Integration tests only |
| `make test-coverage` | `pnpm test:coverage` | Tests + HTML coverage report |
| `make lint` | `pnpm lint` | Ruff check (read-only) |
| `make lint-fix` | `pnpm lint:fix` | Ruff check --fix |
| `make format` | `pnpm format` | Ruff format (write) |
| `make format-check` | — | Ruff format --check (CI) |
| `make typecheck` | `pnpm build` | mypy strict on `packages/core/src` |
| `make validate-tools` | `pnpm validate-tools` | Validate all YAML definitions |
| `make build` | `pnpm build` | Build all provider packages |
| `make clean` | `pnpm clean` | Remove `__pycache__`, dist, .coverage |

```bash
cd python

make install        # first-time setup
make test           # run all tests
make lint-fix       # auto-fix lint issues
make format         # auto-format code
make typecheck      # strict mypy
make validate-tools # validate all YAMLs
```

### Scripts directory

Standard utility scripts live in `python/scripts/`:

| Script | Purpose |
|--------|---------|
| `scripts/validate_tools.py` | YAML tool definition validator (invoked by `make validate-tools`) |
| `scripts/build_providers.py` | Builds provider packages (invoked by `make build`) |

### Before Committing

```bash
cd python
make format         # Format
make lint           # Lint
make typecheck      # Type-check
make test           # Tests
```

### Pre-Merge Checklist (Python)

- [ ] All tests passing (`make test`)
- [ ] No mypy errors (`make typecheck`)
- [ ] Ruff clean (`make lint && make format-check`)
- [ ] Coverage ≥ 95% (`make test-coverage`)
- [ ] Pydantic models validate all external inputs
- [ ] No hardcoded secrets
- [ ] `from __future__ import annotations` in every file

---

## TypeScript Standards

### Strict Mode (Required)

All code must compile in TypeScript strict mode.

```typescript
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "noImplicitThis": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitReturns": true
  }
}
```

### Type Safety

**DO:**

```typescript
// Explicit types everywhere
function loadTool(path: string): ToolDefinition {
  // implementation
}

// Use interface for contracts
interface ToolDefinition {
  name: string;
  execute(params: Record<string, unknown>): Promise<Result>;
}

// Use union types for variants
type ExecutionType = 'command' | 'http' | 'script';

// Use const assertions for immutable data
const EXECUTION_TYPES = ['command', 'http', 'script'] as const;
```

**DON'T:**

```typescript
// No implicit any
function loadTool(path) {}

// No any types
function execute(tool: any, params: any): any {}

// No untyped variables
let result;
```

### Export Types

Export types alongside implementations:

```typescript
// ✅ DO: Export types with implementation
export interface ToolDefinition {
  name: string;
  // ...
}

export class ToolLoader {
  loadToolFromFile(path: string): ToolDefinition {}
}

// ❌ DON'T: Types only in comments
// ToolDefinition = { name: string, ... }
class ToolLoader {}
```

---

## Naming Conventions

### Files

```typescript
// kebab-case for files
tool - loader.ts;
command - executor.ts;
error - codes.ts;
matimo - error.ts;

// Descriptive names
// ✓ command-executor.ts
// ✗ executor.ts
// ✗ cmd-exec.ts
```

### Classes & Types

```typescript
// PascalCase for classes
class ToolLoader {}
class CommandExecutor {}
class MatimoError extends Error {}

// PascalCase for types/interfaces
interface ToolDefinition {}
interface ExecutionConfig {}
type ExecutionType = 'command' | 'http' | 'script';
```

### Functions & Variables

```typescript
// camelCase for functions and variables
function loadTool() {}
const toolRegistry = new Map();
let executionCount = 0;

// Descriptive names
// ✓ loadToolFromFile()
// ✓ validateToolParameters()
// ✗ load()
// ✗ validate()
```

### Constants

```typescript
// UPPER_SNAKE_CASE for constants
const MAX_RETRIES = 3;
const DEFAULT_TIMEOUT = 5000;
const SUPPORTED_TYPES = ['command', 'http', 'script'];

// Constants should be immutable
const readonly EXECUTION_TYPES = ['command', 'http'] as const;
```

---

## Error Handling

### Use Structured Errors

```typescript
// Define standard error codes
export enum ErrorCode {
  INVALID_SCHEMA = 'INVALID_SCHEMA',
  EXECUTION_FAILED = 'EXECUTION_FAILED',
  AUTH_FAILED = 'AUTH_FAILED',
  TOOL_NOT_FOUND = 'TOOL_NOT_FOUND',
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  VALIDATION_FAILED = 'VALIDATION_FAILED',
}

// Use structured error class
export class MatimoError extends Error {
  constructor(
    message: string,
    public code: ErrorCode,
    public context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'MatimoError';
  }
}

// Throw with context
throw new MatimoError('Tool execution failed', ErrorCode.EXECUTION_FAILED, {
  toolName: tool.name,
  reason: 'timeout',
  duration: 30000,
});
```

### Error Message Guidelines

```typescript
// ✅ DO: Clear, actionable messages
throw new MatimoError(
  'Tool validation failed: missing required parameter "repo"',
  ErrorCode.VALIDATION_FAILED
);

// ✅ DO: Include context
throw new MatimoError('HTTP request failed', ErrorCode.EXECUTION_FAILED, {
  status: 500,
  endpoint: '/api/issues',
});

// ❌ DON'T: Generic errors
throw new Error('Something went wrong');

// ❌ DON'T: Include sensitive data
throw new Error(`Failed with token: ${apiKey}`);
```

### Error Handling Pattern

```typescript
try {
  const result = await executor.execute(tool, params);
  return result;
} catch (error) {
  if (error instanceof MatimoError) {
    logger.error('Execution failed', {
      code: error.code,
      message: error.message,
      context: error.context,
    });
    throw error;
  }

  // Convert unknown errors
  throw new MatimoError('Unknown error during execution', ErrorCode.EXECUTION_FAILED, {
    originalError: error.message,
  });
}
```

---

## Testing Standards

### Test File Organization

```typescript
// test/unit/tool-loader.test.ts
describe('ToolLoader', () => {
  describe('loadToolFromFile', () => {
    it('should load valid YAML tool definition', () => {
      // Arrange
      const filePath = './fixtures/calculator.yaml';

      // Act
      const tool = loader.loadToolFromFile(filePath);

      // Assert
      expect(tool.name).toBe('calculator');
      expect(tool.parameters).toBeDefined();
    });

    it('should throw FileNotFoundError when file does not exist', () => {
      // Arrange
      const filePath = './fixtures/nonexistent.yaml';

      // Act & Assert
      expect(() => {
        loader.loadToolFromFile(filePath);
      }).toThrow(FileNotFoundError);
    });
  });
});
```

### Test Naming

```typescript
// ✅ DO: Descriptive test names
it('should load valid YAML tool definition');
it('should throw FileNotFoundError when file does not exist');
it('should validate parameters against schema');
it('should handle missing required parameters');
it('should retry on temporary failure');

// ❌ DON'T: Vague test names
it('should work');
it('tests loading');
it('handles errors');
```

### Test Coverage

**Minimum targets (enforced by jest.config.cjs):**

- Statements: **95%+**
- Branches: **87%+**
- Functions: **97%+**
- Lines: **95%+**

```bash
# Check coverage
pnpm test:coverage

# Expected:
# Statements   : 95%+
# Branches     : 87%+
# Functions    : 97%+
# Lines        : 95%+
```

### Mocking & Fixtures

```typescript
// ✅ DO: Use fixtures for test data
const validTool = loadYaml('./fixtures/calculator.yaml');

// ✅ DO: Mock external dependencies
const mockAPI = jest.spyOn(axios, 'get').mockResolvedValue({ data: { id: 1 } });

// ✅ DO: Clean up mocks
afterEach(() => {
  jest.clearAllMocks();
});

// ✅ DO: Use AAA pattern
it('should execute tool', () => {
  // Arrange
  const tool = loadTool('calculator');

  // Act
  const result = executor.execute(tool, { a: 1, b: 2 });

  // Assert
  expect(result.output.result).toBe(3);
});
```

---

## Documentation Standards

### JSDoc Comments

```typescript
// ✅ DO: JSDoc for all public APIs
/**
 * Load a tool definition from a YAML/JSON file.
 *
 * @param path - Path to tool definition file
 * @returns Loaded and validated tool definition
 * @throws {FileNotFoundError} If file doesn't exist
 * @throws {SchemaValidationError} If tool schema invalid
 *
 * @example
 * const tool = loader.loadToolFromFile('./tools/calculator.yaml');
 */
export function loadToolFromFile(path: string): ToolDefinition {
  // implementation
}

// ❌ DON'T: Missing or vague documentation
function load(p) {}

// ❌ DON'T: Obvious comments
// Increment i
i++;
```

### Code Comments

Comments should explain **WHY**, not **WHAT**.

```typescript
// ✅ DO: Explain why
// We retry exponentially because the API has rate limits
// and temporary network issues are common
const delay = initialDelay * Math.pow(2, retries);

// ✅ DO: Document non-obvious logic
// Skip first item because it's always metadata
for (let i = 1; i < items.length; i++) {
  // process item
}

// ❌ DON'T: Describe what the code does
// Calculate exponential backoff
const delay = initialDelay * Math.pow(2, retries);

// ❌ DON'T: Obvious comments
// Get the first item
const first = items[0];
```

### README Structure

```markdown
# Tool Name

Brief description (1 sentence)

## Features

- Feature 1
- Feature 2

## Installation
```

## Installation

Step-by-step setup instructions

## Usage

Code examples

## API Reference

Methods and options

## Troubleshooting

Common issues and solutions

````

---

## Security Standards

### Input Validation

```typescript
// ✅ DO: Validate all inputs
const validated = toolSchema.parameters.parse(params);
const result = await executor.execute(tool, validated);

// ✅ DO: Use Zod for schema validation
import { z } from 'zod';

const paramSchema = z.object({
  repo: z.string().regex(/^[^/]+\/[^/]+$/),
  issue: z.number().min(1)
});

const validated = paramSchema.parse(params);

// ❌ DON'T: Trust user input
const command = `git clone ${userUrl}`;  // Dangerous!

### Secret Management

```typescript
// ✅ DO: Use environment variables with MATIMO_ prefix
const apiKey = process.env.MATIMO_SLACK_API_KEY;
if (!apiKey) {
  throw new MatimoError('Missing Slack API key', ErrorCode.AUTH_FAILED);
}

// ✅ DO: Validate secrets exist before use
const token = process.env.MATIMO_GITHUB_TOKEN;
if (!token || token.length === 0) {
  throw new MatimoError('Invalid GitHub token', ErrorCode.AUTH_FAILED);
}

// ❌ DON'T: Hardcode secrets
const API_KEY = 'sk_live_abc123xyz789'; // NEVER!

// ❌ DON'T: Log secrets
logger.info('Token retrieved:', apiKey); // WRONG!
logger.info('Token retrieved'); // OK
```

### Output Escaping

```typescript
// ✅ DO: Escape shell commands
import { shellEscape } from 'shell-escape';
const escaped = shellEscape([command, ...args]);

// ✅ DO: Sanitize error messages
const sanitized = error.message.replace(apiKey, '[REDACTED]');

// ❌ DON'T: Include secrets in error messages
throw new Error(`Failed with key: ${apiKey}`);
```

---

## Logging Standards

### Structured Logging

```typescript
// ✅ DO: Use structured logging
logger.info('tool_execution', {
  traceId: context.traceId,
  toolName: tool.name,
  parameters: sanitized(params),
  duration: executionTime,
  status: 'success' | 'failed',
});

// ✅ DO: Include trace IDs
logger.error('execution_failed', {
  traceId: context.traceId,
  toolName: tool.name,
  error: error.message,
});

// ❌ DON'T: Unstructured logging
console.log('Tool loaded');
logger.info('tool loaded: ' + toolName);

// ❌ DON'T: Log secrets
logger.info('Token: ' + apiKey);
```

### Log Levels

```typescript
logger.debug('Parsing tool definition'); // Detailed info
logger.info('Tool loaded successfully'); // Informational
logger.warn('Tool schema drift detected'); // Warning
logger.error('Tool execution failed', error); // Error

// ❌ DON'T: Use console.log in production
console.log('Debug info');
```

---

## Performance Standards

### Execution Time Targets

```
Simple tools (echo, time): <100ms
API tools (GitHub, Slack): <2 seconds
Data processing (CSV, JSON): <1 second
Heavy computation: <10 seconds
```

### Memory Targets

```
Tool loading: <10MB
Tool execution: <50MB
Registry loading: <20MB
```

### Throughput Targets

```
Tools loaded: 1000+ in <1 second
Concurrent executions: 100+
Requests/second: 1000+
```

---

## Quality Metrics

### Code Quality Checklist

```typescript
// ✅ Types
- Strict TypeScript mode enabled
- No `any` types used
- All functions have type signatures
- Return types explicitly declared

// ✅ Testing
- 95%+ test coverage (TypeScript) / 95%+ (Python)
- Unit tests for all modules
- Integration tests for critical paths
- Edge cases tested

// ✅ Documentation
- JSDoc comments on all public APIs
- README with examples
- Code comments explaining WHY
- Type definitions exported

// ✅ Error Handling
- All errors use MatimoError
- Errors include codes and context
- No generic Error throws
- Error messages are clear

// ✅ Security
- No hardcoded secrets
- All inputs validated
- Sensitive data never logged
- Shell commands properly escaped

// ✅ Performance
- Tool loading <10MB
- Execution meets time targets
- No memory leaks
- Concurrent operations supported
```

### Build Verification

```bash
# Check TypeScript
pnpm build
# Expected: No errors

# Check linting
pnpm lint
# Expected: 0 errors, 0 warnings

# Check tests
pnpm test
# Expected: All tests passing

# Check coverage
pnpm test:coverage
# Expected: 95%+ coverage
```

---

## Development Workflow

### Before Committing

1. **Format code:** `pnpm format`
2. **Check types:** `pnpm build`
3. **Lint:** `pnpm lint`
4. **Test:** `pnpm test`
5. **Coverage:** `pnpm test:coverage` (verify 95%+)

### Pre-Merge Checklist

- [ ] All tests passing
- [ ] Coverage 95%+
- [ ] No TypeScript errors
- [ ] No ESLint warnings
- [ ] Code formatted with Prettier
- [ ] Commit messages follow guidelines
- [ ] Documentation updated
- [ ] PR reviewed and approved

---

## Common Anti-Patterns

```typescript
// ❌ DON'T: Use any types
function execute(tool: any, params: any): any { }

// ✅ DO: Use proper types
function execute(
  tool: ToolDefinition,
  params: Record<string, unknown>
): Promise<ExecutionResult> { }

// ❌ DON'T: Generic error handling
catch (error) {
  throw new Error('Failed');
}

// ✅ DO: Structured error handling
catch (error) {
  throw new MatimoError(
    'Tool execution failed',
    ErrorCode.EXECUTION_FAILED,
    { toolName, reason: error.message }
  );
}

// ❌ DON'T: Log secrets
logger.info('Authenticated with key:', apiKey);

// ✅ DO: Redact sensitive data
logger.info('Authentication successful', { hasKey: !!apiKey });

// ❌ DON'T: Skip validation
const result = userInput.trim();

// ✅ DO: Validate all inputs
const validated = schema.parse(userInput);
```

---

## See Also

- [CONTRIBUTING.md](../CONTRIBUTING.md) — Contribution guide
- [COMMIT_GUIDELINES.md](../community/COMMIT_GUIDELINES.md) — Commit standards
- [QUICK_START.md](../getting-started/QUICK_START.md) — Get started
- [API_REFERENCE.md](../api-reference/SDK.md) — SDK documentation
````
