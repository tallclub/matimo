# Tool Development Workflow

Complete step-by-step process for creating and submitting a new Matimo tool.

---

## Overview

```
1. Create Tool Directory
        ↓
2. Write definition.yaml
        ↓
3. Validate Syntax
        ↓
4. Implement Tool Logic (if needed)
        ↓
5. Write Tests
        ↓
6. Add Examples
        ↓
7. Validate Coverage
        ↓
8. Submit PR
```

**Total time:** 30 minutes (simple tool) to 2 hours (full provider package)

---

## Step 1: Create Tool Structure

### For a Simple Tool (in core)

```bash
# Create directory
mkdir -p packages/core/tools/{tool-name}

# Create YAML definition
touch packages/core/tools/{tool-name}/definition.yaml
```

### For a Provider Package (npm)

```bash
# Create provider structure
mkdir -p packages/{provider}/tools/{tool-name}

# Create YAML definition
touch packages/{provider}/tools/{tool-name}/definition.yaml
```

**Directory structure:**

```
packages/core-or-provider/
├── tools/
│   └── my-tool/
│       ├── definition.yaml          # Tool definition (YAML)
│       ├── index.ts                 # Implementation (optional)
│       └── README.md                # Usage docs (optional)
```

---

## Step 2: Write definition.yaml

See full specification: [TOOL_SPECIFICATION.md](./TOOL_SPECIFICATION.md)

**Minimal example (command-based):**

```yaml
name: my-tool
description: Brief description of what the tool does
version: '1.0.0'

parameters:
  input:
    type: string
    required: true
    description: Input parameter

execution:
  type: command
  command: node
  args:
    - -e
    - |
      console.log(JSON.stringify({ result: process.argv[1].toUpperCase() }));
    - '{input}'

output_schema:
  type: object
  properties:
    result:
      type: string
  required: [result]
```

**For HTTP tools:**

```yaml
name: api-tool
execution:
  type: http
  method: POST
  url: https://api.example.com/endpoint
  headers:
    Authorization: 'Bearer {API_TOKEN}'
  body:
    param: '{param_value}'
```

---

## Step 3: Validate Syntax

**Before writing tests, validate your YAML:**

```bash
# Validate all tools
pnpm validate-tools

# What it checks:
# ✅ Valid YAML syntax
# ✅ Matches ToolDefinition schema
# ✅ All required fields present
# ✅ Parameter types are valid
# ✅ Output schema is valid
```

**Expected output:**

```
✅ Validating tools...
  ✅ packages/core/tools/my-tool/definition.yaml
  ✅ packages/slack/tools/slack-send-message/definition.yaml
  ...
✅ All tools valid!
```

**If validation fails:**

```
❌ Error in packages/core/tools/my-tool/definition.yaml:
   Missing required field: "name"

❌ Error in packages/slack/tools/slack-api/definition.yaml:
   Unknown execution type: "webhook" (valid: command, http, function)
```

**Fix and re-validate immediately.**

---

## Step 4: Implement Tool Logic (If Needed)

### For Command-Based Tools

If your tool type is `command`, you may need an executable file.

**Simple implementation (inline in YAML):**

```yaml
execution:
  type: command
  command: node
  args:
    - -e
    - |
      // JS code inline
      const result = process.argv[1].toUpperCase();
      console.log(JSON.stringify({ result }));
    - '{input}'
```

**Complex implementation (separate file):**

Create `packages/{provider}/tools/{tool-name}/index.ts`:

```typescript
// Receives args from YAML, outputs JSON to stdout
const input = process.argv[1];
const result = await processInput(input);
console.log(JSON.stringify(result));

async function processInput(data: string) {
  // Your logic here
  return { result: data.toUpperCase() };
}
```

Then reference in YAML:

```yaml
execution:
  type: command
  command: tsx
  args:
    - packages/provider/tools/my-tool/index.ts
    - '{input}'
```

### For HTTP Tools

No implementation needed — just define the HTTP request in YAML.

### For Function-Based Tools

Not yet supported, but coming in Phase 2.

---

## Step 5: Write Tests

### Create Test Fixture

Tests use YAML fixtures to validate tools. Create:

**File:** `packages/core/test/fixtures/{tool-category}/{tool-name}-fixture.yaml`

```yaml
# Copy of your tool definition or a test variant
name: my-tool
description: My test tool
version: '1.0.0'

parameters:
  input:
    type: string
    required: true
    description: Test input

execution:
  type: command
  command: node
  args:
    - -e
    - |
      console.log(JSON.stringify({ result: process.argv[1].toUpperCase() }));
    - '{input}'

output_schema:
  type: object
  properties:
    result:
      type: string
  required: [result]
```

### Write Unit Tests

**File:** `packages/core/test/unit/tools/{tool-name}.test.ts`

```typescript
import { MatimoInstance } from '../../src/matimo-instance';

describe('MyTool', () => {
  let matimo: MatimoInstance;

  beforeAll(async () => {
    matimo = await MatimoInstance.init('./packages/core/tools');
  });

  it('should execute with valid parameters', async () => {
    const result = await matimo.execute('my-tool', {
      input: 'test',
    });
    expect(result).toHaveProperty('result');
    expect(result.result).toBe('TEST');
  });

  it('should fail with missing required parameter', async () => {
    await expect(matimo.execute('my-tool', {})).rejects.toThrow();
  });

  it('should validate output schema', async () => {
    const result = await matimo.execute('my-tool', {
      input: 'hello',
    });
    // Output validation happens automatically
    expect(typeof result.result).toBe('string');
  });
});
```

**Test template:**

```typescript
describe('ToolName', () => {
  // Test basic execution
  // Test with invalid params
  // Test with edge cases
  // Test output validation
  // Test error handling (if HTTP, test error codes)
});
```

---

## Step 6: Add Examples

Add your tool to `examples/tools/` if it's a provider tool.

**Example:** `examples/tools/{provider}/{tool-name}.ts`

```typescript
import { MatimoInstance } from '@matimo/core';

async function main() {
  const matimo = await MatimoInstance.init({ autoDiscover: true });

  console.log('Executing my-tool...');
  const result = await matimo.execute('my-tool', {
    input: 'Hello World',
  });

  console.log('Result:', result);
}

main().catch(console.error);
```

---

## Step 7: Validate Coverage

Before submitting PR, ensure tests pass:

```bash
# Run tests
pnpm test

# Check coverage (target: 95%+)
pnpm test:coverage

# View coverage report
open coverage/lcov-report/index.html
```

**For your tool, aim for:**

- ✅ 95%+ line coverage
- ✅ 87%+ branch coverage
- ✅ 97%+ function coverage
- ✅ Happy path + error cases

---

## Full Checklist Before PR

Before submitting a pull request, verify:

### YAML & Validation

- [ ] `pnpm validate-tools` passes
- [ ] All required fields in definition.yaml
- [ ] Parameter types match Zod schema
- [ ] Output schema is valid

### Code Quality

- [ ] `pnpm lint:fix` + `pnpm format` passes
- [ ] No TypeScript errors (if code implementation)
- [ ] No console.log in core SDK (use logger instead)
- [ ] Proper error handling with MatimoError

### Testing

- [ ] Unit tests written (95%+ coverage)
- [ ] Test fixtures created
- [ ] `pnpm test` passes (all 603+ tests)
- [ ] `pnpm test:coverage` shows 95%+ for tool

### Documentation

- [ ] Tool has clear description
- [ ] Parameters documented with descriptions
- [ ] Examples provided (at least 1)
- [ ] README added (if complex tool)

### Security

- [ ] No hardcoded secrets
- [ ] No sensitive data in logs
- [ ] API keys from environment variables (prefix: MATIMO\_)
- [ ] Input validated via Zod

### Logging

- [ ] Tool imports `getGlobalMatimoLogger()`
- [ ] Errors logged with context
- [ ] No silent failures
- [ ] Debug logs for validation issues

---

## Step 8: Submit PR

### Branch & Commit

```bash
# Create feature branch
git checkout -b feat/my-tool-description

# Stage changes
git add packages/core/tools/my-tool/

# Commit with conventional message
git commit -m "feat(core): add my-tool for X functionality"

# Push
git push origin feat/my-tool-description
```

### PR Description Template

````markdown
## Description

What does this tool do? Why is it useful?

## Changes

- Added my-tool definition
- Implemented core logic
- Added comprehensive tests
- Created usage examples

## Tool Details

- **Name:** my-tool
- **Type:** command/http/function
- **Authentication:** none/api_key/oauth2
- **Parameters:** [list them]

## Testing

- [x] All tests pass (`pnpm test`)
- [x] Coverage 95%+ (`pnpm test:coverage`)
- [x] YAML validates (`pnpm validate-tools`)
- [x] Lint passes (`pnpm lint`)

## Example Usage

```typescript
const result = await matimo.execute('my-tool', {
  param: 'value',
});
```
````

## Related Issues

Closes #123

## Checklist

- [x] YAML syntax valid
- [x] Tests cover happy path + errors
- [x] Documentation complete
- [x] No hardcoded secrets
- [x] Logger used for errors

````

### What to Expect

1. **Automated checks run:**
   - Tests (must all pass)
   - Linting (auto-fixed if needed)
   - Coverage (must be 95%+)

2. **Maintainer review:**
   - Code quality feedback
   - Documentation suggestions
   - Security considerations

3. **Merge:**
   - Once approved, tool is merged
   - Published with next release

---

## Troubleshooting

### "pnpm validate-tools fails"

**Check:**
```bash
# See actual error
pnpm validate-tools 2>&1

# Common issues:
# - Missing required field (name, execution, output_schema)
# - Invalid YAML syntax
# - Parameter type mismatched
````

**Fix:**

- Review [TOOL_SPECIFICATION.md](./TOOL_SPECIFICATION.md)
- Check existing tools for examples
- Run again after fixes

---

### "Tests don't find my tool"

**Check:**

```bash
# Verify tool loads
pnpm test -- --testPathPattern="tool-loader"

# Tool must be in:
# packages/core/tools/{name}/definition.yaml
# packages/{provider}/tools/{name}/definition.yaml
```

---

### "Coverage too low"

**Add tests for:**

- Valid parameter combinations
- Invalid/missing parameters
- Edge cases (empty strings, zero values)
- Error scenarios (network failures, timeouts)

```typescript
// Example: Test error scenario
it('should handle network errors gracefully', async () => {
  // If HTTP tool, mock failed request
  const result = await matimo.execute('my-tool', { bad: 'param' });
  // Should throw MatimoError with ERROR_CODE
});
```

---

### "Lint/Format issues"

**Auto-fix:**

```bash
pnpm lint:fix
pnpm format
git add .
git commit --amend
```

---

## Real Example: Adding git-clone Tool

```bash
# 1. Create structure
mkdir -p packages/github/tools/github-clone-repo

# 2. Write definition.yaml
cat > packages/github/tools/github-clone-repo/definition.yaml << 'EOF'
name: github-clone-repo
description: Clone a GitHub repository to a local directory
version: '1.0.0'

parameters:
  owner:
    type: string
    required: true
    description: Repository owner (username or org)
  repo:
    type: string
    required: true
    description: Repository name
  path:
    type: string
    required: false
    description: Local directory to clone into

execution:
  type: command
  command: bash
  args:
    - -c
    - |
      if [ -z "{path}" ]; then
        git clone https://github.com/{owner}/{repo}.git
      else
        git clone https://github.com/{owner}/{repo}.git {path}
      fi
      echo '{"status":"cloned"}'

output_schema:
  type: object
  properties:
    status:
      type: string
  required: [status]
EOF

# 3. Validate
pnpm validate-tools

# 4. Write tests
cat > packages/core/test/unit/tools/github-clone.test.ts << 'EOF'
describe('GitHubClone', () => {
  it('should clone repository', async () => {
    // Mock git command in test
  });
});
EOF

# 5. Run tests
pnpm test

# 6. Check coverage
pnpm test:coverage

# 7. Submit PR
git add packages/github/tools/github-clone-repo/
git commit -m "feat(github): add github-clone-repo tool"
```

---

## Next Steps

- ✅ Follow this workflow
- ✅ Test locally with `pnpm test`
- ✅ Validate with `pnpm validate-tools`
- ✅ Submit PR with description
- ✅ Respond to feedback from maintainers

**Questions?**

- 📖 [Tool Specification](./TOOL_SPECIFICATION.md)
- 📖 [YAML Tools](./YAML_TOOLS.md)
- 💬 [GitHub Discussions](https://github.com/tallclub/matimo/discussions)
