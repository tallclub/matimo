# Commit Guidelines — Conventional Commits

Guidelines for writing clear, semantic commit messages.

## Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

## Components

### Type (required)

What kind of change is this?

```
feat:      A new feature
fix:       A bug fix
docs:      Documentation only
style:     Code style changes (formatting, semicolons, etc.)
refactor:  Code refactoring without feature change
perf:      Performance improvement
test:      Test additions or updates
chore:     Build, CI/CD, dependencies, package.json
ci:        CI/CD configuration changes
```

### Scope (optional)

What part of the codebase is affected?

```
feat(executor): add HTTP executor
fix(schema): handle missing required fields
docs(api): update API reference
test(loader): add tool loader tests
```

Common scopes:

- `executor` — Executor implementations
- `schema` — Schema validation
- `loader` — Tool loader
- `cli` — Command-line interface
- `mcp` — MCP server
- `types` — Type definitions
- `error` — Error handling
- `tool` — Tool definitions
- `test` — Testing infrastructure
- `docs` — Documentation

### Subject (required)

Short description of the change (50 characters max).

```
✓ add HTTP executor with response validation
✓ fix schema validation for missing fields
✓ update API reference documentation
✓ improve error messages

✗ added executor
✗ fixed things
✗ refactored code a lot
```

**Rules:**

- Imperative mood: "add" not "added" or "adds"
- Lowercase first letter
- No period at end
- Clear and specific

### Body (optional)

Detailed explanation of the change (72 characters per line).

```
The HTTP executor now validates responses against the output_schema
defined in the tool. This ensures that:

- API responses match the expected format
- Type safety is maintained across executions
- Invalid responses throw SchemaValidationError

Implementation uses Zod for schema validation, consistent with
the rest of the codebase.
```

**Guidelines:**

- Explain WHAT and WHY, not HOW
- Reference relevant issues
- Wrap at 72 characters
- Separate paragraphs with blank lines

### Footer (optional)

Reference issues and breaking changes.

```
Closes #123
Refs #456, #789

BREAKING CHANGE: Tool YAML format changed (see migration guide)
```

**Format:**

- `Closes #<issue>` — Automatically close issue when PR merges
- `Refs #<issue>` — Reference without closing
- `BREAKING CHANGE:` — Document breaking changes

---

## Examples

### Feature

```
feat(executor): add HTTP executor with response validation

Implement HttpExecutor class to make HTTP requests with:
- Automatic parameter templating
- Response validation against output_schema
- Support for API authentication (bearer, api_key, basic)
- Timeout and error recovery

This enables defining tools that call external APIs and validate
responses, with full type safety.

Closes #42
```

### Bug Fix

```
fix(schema): handle missing required fields in tool definition

Previously, the schema validation would crash if a tool was missing
required fields. Now it returns a clear validation error with the
list of missing fields.

This improves error messages for developers writing tools and makes
debugging YAML syntax issues much easier.

Closes #38
```

### Documentation

```
docs(api-reference): document tool discovery methods

Add comprehensive API documentation for:
- MatimoInstance.listTools()
- MatimoInstance.getTool()
- MatimoInstance.searchTools()

Include parameter types, return values, error codes, and examples
for each method.

Refs #45
```

### Refactoring

```
refactor(error-handling): consolidate error classes

Move all error handling logic to MatimoError base class with
structured error codes. This reduces duplication and makes error
handling consistent across the codebase.

Changes:
- Create ErrorCode enum for standard codes
- Extend MatimoError for all error types
- Update all throw statements to use structured errors
- Add context objects to error messages
```

### Test

```
test(command-executor): add parameter templating tests

Add comprehensive test coverage for parameter substitution in
command execution:
- Single parameter: {param}
- Multiple parameters: {a} {b} {c}
- Parameter in nested strings: "--op={op}"
- Escaped parameters
- Missing parameters

Closes #51
```

### Chore

```
chore: upgrade TypeScript to 5.3

- Update package.json to use TypeScript 5.3
- Update tsconfig.json for new strict mode settings
- Fix type errors discovered by stricter checking
- Run full test suite to verify no regressions
```

### Breaking Change

```
refactor(schema): change tool YAML format

BREAKING CHANGE: Tool YAML files must now include execution_type
field. Update existing tools:

Before:
  execution:
    command: node script.js

After:
  execution:
    type: command
    command: node script.js

See migration guide at docs/MIGRATION_v2.md
```

---

## Best Practices

### ✅ DO

```
✓ Write in imperative mood
✓ Keep subject under 50 characters
✓ Wrap body at 72 characters
✓ Explain WHY the change was made
✓ Reference related issues
✓ Use semantic types (feat, fix, etc.)
✓ Be specific and descriptive
✓ Keep commits focused (one thing per commit)
```

### ❌ DON'T

```
✗ Use past tense ("added", "fixed")
✗ Make the subject too long
✗ Forget the type
✗ Combine multiple features in one commit
✗ Leave out important details
✗ Use vague descriptions ("fixes stuff")
✗ Write in passive voice
✗ Include multiple types in one commit
```

---

## Commit Scope Guide

### When to Use Scopes

**Good (clear and specific):**

```
feat(executor): add HTTP method support
fix(loader): handle YAML parse errors
docs(api): document error codes
test(schema): add validation tests
```

**Unclear (too broad):**

```
feat(src): add new code
fix(test): update tests
docs: various documentation
```

### Scope Examples by Area

#### Core Components

```
feat(executor)      # Executor implementations
feat(loader)        # Tool loader
feat(schema)        # Schema validation
feat(registry)      # Tool registry
```

#### Integration

```
feat(mcp)           # MCP server
feat(cli)           # CLI tools
feat(decorators)    # Decorator support
```

#### Infrastructure

```
chore(build)        # Build configuration
chore(ci)           # CI/CD pipeline
chore(deps)         # Dependencies
chore(types)        # Type definitions
```

#### Documentation & Testing

```
docs(api)           # API documentation
docs(guide)         # User guides
test(unit)          # Unit tests
test(integration)   # Integration tests
```

---

## Commit Workflow

### Before Committing

1. Make sure changes are focused (one feature/fix)
2. Stage relevant files: `git add <files>`
3. Review changes: `git diff --staged`
4. Run tests: `pnpm test`
5. Check format: `pnpm lint && pnpm format`

```bash
# Stage specific files
git add src/executors/http-executor.ts test/unit/http-executor.test.ts

# Review changes
git diff --staged

# Verify everything works
pnpm build && pnpm test && pnpm lint
```

### Writing the Commit

1. Use `git commit` (not `git commit -m` for longer messages)
2. Follow the format: type(scope): subject
3. Add body if needed (blank line after subject)
4. Reference issues in footer

```bash
# Commits with detailed message
git commit

# Opens editor with template:
# feat(scope): subject
#
# Detailed body explaining the change.
# Multiple paragraphs separated by blank lines.
#
# Closes #123
```

### Example Workflow

```bash
# Create feature branch
git checkout -b feature/http-executor

# Make changes
# ... edit files ...

# Stage changes
git add src/executors/http-executor.ts
git add test/unit/http-executor.test.ts

# Verify
git diff --staged
pnpm test

# Commit with detailed message
git commit

# In editor:
# feat(executor): add HTTP executor with response validation
#
# Implement HttpExecutor class for making HTTP requests to APIs with:
# - Automatic parameter templating
# - Response validation against output_schema
# - Support for various authentication types
# - Built-in timeout and retry logic
#
# This enables defining tools that call external REST APIs while
# maintaining type safety and validation.
#
# Closes #42

# Push to remote
git push origin feat/http-executor
```

---

## Common Mistakes

### ❌ Too Vague

```
feat: update code
fix: bug fixes
docs: update docs
chore: maintenance
```

**Better:**

```
feat(executor): add HTTP method parameter support
fix(schema): validate enum values in parameters
docs(api): document all executor public methods
chore(deps): upgrade TypeScript to 5.3
```

### ❌ Multiple Changes

```
feat(executor): add HTTP support and fix timeout bug
```

**Better (two commits):**

```
feat(executor): add HTTP executor with response validation
fix(executor): handle timeout edge cases correctly
```

### ❌ Unclear Scope

```
feat(src): add new features
fix(test): improve tests
docs(docs): update documentation
```

**Better:**

```
feat(executor): add HTTP support
fix(loader): improve error messages
docs(api): document parameter validation
```

### ❌ Future Tense

```
feat(executor): will add HTTP support
fix(schema): will fix validation
```

**Better:**

```
feat(executor): add HTTP support
fix(schema): validate enum values
```

---

## Git Aliases

Create aliases for faster committing:

```bash
# Add to ~/.gitconfig

[alias]
  co = checkout
  br = branch
  ci = commit
  st = status
  unstage = reset HEAD --
  last = log -1 HEAD
  visual = log --graph --oneline --all
```

Usage:

```bash
git co -b feat/my-feature
git ci                        # Opens commit editor
git visual                    # See commit graph
```

---

## Tools & Helpers

### commitizen (Guided Commits)

Interactively create commits:

```bash
pnpm add -D commitizen
npx cz      # Interactive commit prompt
```

### husky (Pre-commit Hooks)

Prevent bad commits:

```bash
pnpm add -D husky
npx husky install
npx husky add .husky/commit-msg 'pnpm lint-staged'
```

### lint-staged

Lint before committing:

```bash
pnpm add -D lint-staged

# In package.json:
{
  "lint-staged": {
    "*.ts": ["eslint --fix", "prettier --write"],
    "*.md": ["prettier --write"]
  }
}
```

---

## See Also

- [CONTRIBUTING.md](../../CONTRIBUTING.md) — Full contribution guide
- [DEVELOPMENT_STANDARDS.md](../user-guide/DEVELOPMENT_STANDARDS.md) — Code quality standards
- [Conventional Commits](https://www.conventionalcommits.org/) — Full specification

---

## Quick Reference

```
feat:    New feature
fix:     Bug fix
docs:    Documentation
style:   Formatting (no code change)
refactor: Code restructuring
perf:    Performance improvement
test:    Test changes
chore:   Build, CI, dependencies
ci:      CI configuration

Format: <type>(<scope>): <subject>

Rules:
- Imperative mood ("add" not "added")
- Lowercase first letter
- No period at end
- 50 chars for subject, 72 for body
- Reference issues: Closes #123
```
