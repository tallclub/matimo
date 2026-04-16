# Matimo MCP Maintenance & Enhancement Guide (TypeScript & Python)

**For**: Team Leads, Architects, Maintainers  
**Purpose**: Manage and maintain the Matimo tool creation system  
**Status**: Production Ready (April 2026)

---

## 📋 Table of Contents

1. [System Health & Monitoring](#system-health--monitoring)
2. [Managing the Agent](#managing-the-agent)
3. [Managing the Skill](#managing-the-skill)
4. [TypeScript vs Python Considerations](#typescript-vs-python-considerations)
5. [Adding Matimo Tools](#adding-matimo-tools)
6. [Updating Standards (Both SDKs)](#updating-standards-both-sdks)
7. [Team Best Practices](#team-best-practices)
8. [Performance Optimization](#performance-optimization)
9. [Troubleshooting Production Issues](#troubleshooting-production-issues)

---

## System Health & Monitoring

### Daily Health Checks

```bash
#!/bin/bash
# Save as: scripts/matimo-health-check.sh

echo "🔍 Matimo System Health Check (TS + Py)"
echo "========================================"

# Check MCP server
echo -n "MCP Server (port 3101): "
if curl -s http://localhost:3101/health >/dev/null 2>&1; then
  echo "✅ HEALTHY"
else
  echo "❌ DOWN"
fi

# Check tools available
echo -n "Tools loaded: "
TOOL_COUNT=$(curl -s http://localhost:3101/tools | grep -o '"name"' | wc -l)
echo "$TOOL_COUNT tools"

# Check TypeScript setup
echo -n "TypeScript env: "
if [[ -f "typescript/pnpm-workspace.yaml" ]]; then
  echo "✅ OK"
else
  echo "❌ MISSING"
fi

# Check Python setup
echo -n "Python env: "
if [[ -f "python/pyproject.toml" ]]; then
  echo "✅ OK"
else
  echo "❌ MISSING"
fi

# Check agent
echo -n "Agent file: "
if [[ -f ".github/agents/matimo-tool-creator-refactored.agent.md" ]]; then
  echo "✅ EXISTS"
else
  echo "❌ MISSING"
fi

# Check skill
echo -n "Skill file: "
if [[ -f ".github/skills/matimo-provider-creation/SKILL.md" ]]; then
  echo "✅ EXISTS"
else
  echo "❌ MISSING"
fi

# Check recent tool creations (both SDKs)
echo ""
echo "Recent implementations:"
echo "TypeScript: $(find packages/*/tools -name 'index.ts' -newermt '1 hour ago' | wc -l) files"
echo "Python: $(find python/packages/*/tools -name 'executor.py' -newermt '1 hour ago' | wc -l) files"

# Coverage check
echo ""
echo "Test Coverage:"
echo -n "TypeScript: "
cd typescript && pnpm test:coverage 2>&1 | grep "TOTAL" | tail -1 && cd .. || echo "N/A"
echo -n "Python: "
cd python && uv run pytest --cov --cov-report=term-missing 2>&1 | grep "TOTAL" | tail -1 && cd .. || echo "N/A"
```

Run daily:
```bash
bash scripts/matimo-health-check.sh
```

---

## Managing the Agent

### Agent Architecture

**File**: `.github/agents/matimo-tool-creator-refactored.agent.md` (200 lines)

**What it does**:
1. Receives user request ("Create a tool to...")
2. Loads Skill for patterns
3. Calls MCP tools (matamo_create_tool, matamo_validate_tool)
4. Generates TypeScript + Python code
5. Runs both test suites (pnpm test + uv run pytest)
6. Reports bilingual results

### When to Update

| Scenario | Action |
|----------|--------|
| **New MCP tool added** | Add to Tools Mapping section |
| **New auth type** | Update + reference Skill § Part 3 |
| **Test framework changes** (Jest→Vitest, pytest→testplan) | Update tool calling strategy |
| **Performance issue** | Optimize parallel tool calling |
| **Quality issue** | Add validation checkpoints |
| **New provider support** | Document + add to examples |

### Agent Update Checklist

```markdown
Before deploying agent changes:

- [ ] Syntax check: No formatting errors
- [ ] Load test: @agent matimo-tool-creator-refactored "Hello"
- [ ] Create TS tool: "Create a test tool in TypeScript"
- [ ] Create Py tool: "Create a test tool in Python"
- [ ] Verify skill refs: All § Part X references correct
- [ ] Check MCP tools: All tool names match inventory
- [ ] Review examples: Works for both SDKs
- [ ] Git commit: feat(agent): {description}
- [ ] Verify CI/CD: Both TS and Py pipelines pass
```

---

## Managing the Skill

### Skill Architecture

**File**: `.github/skills/matimo-provider-creation/SKILL.md` (400+ lines)

**8 sections providing patterns for both SDKs**:

| Section | Content | For Both SDKs? |
|---------|---------|----------------|
| § 1 | Provider structure | ✅ Identical |
| § 2 | YAML definitions | ✅ Identical |
| § 3 | Authentication patterns | ✅ Both languages use |
| § 4 | **TypeScript** testing (Jest) | ✅ TS-specific patterns |
| § 5 | **Python** testing (pytest) | ✅ Py-specific patterns |
| § 6 | Matimo tool reference | ✅ Both languages use |
| § 7 | **Code examples** | ✅ **Side-by-side TS vs Py** |
| § 8 | README template | ✅ Shared |

### When to Update

**High Priority** (breaks future tools):
- YAML structure changes (§ 1-2)
- Auth standards evolution (§ 3)
- Test framework migration (§ 4 or § 5)
- Output schema requirements (§ 2)

**Medium Priority** (affects quality):
- Code pattern improvements (§ 7)
- New error handling standards (§ 4 & 5)
- New provider support (§ 7)

**Low Priority** (documentation):
- README template clarification (§ 8)
- Examples clarity (§ 7)
- Comments/explanations

### Update Both Sections for Parity

When updating patterns, maintain **TypeScript = Python** parity:

**Example: Add new error handling**

```markdown
§ Part 4: TypeScript Testing (Jest)

NEW PATTERN:
test('should handle 429 rate limit', async () => {
  mockFetch.mockResolvedValueOnce({
    status: 429,
    json: async () => ({ message: 'Rate limited' })
  });
  
  expect(() => execute()).rejects.toThrow('Rate limited');
});
```

```markdown
§ Part 5: Python Testing (pytest)

NEW PATTERN:
def test_handle_rate_limit():
    mock_response = Mock()
    mock_response.status_code = 429
    mock_response.json.return_value = {'message': 'Rate limited'}
    
    with pytest.raises(MatimoError, match='Rate limited'):
        await execute()
```

Both sections must have equivalent patterns!

---

## TypeScript vs Python Considerations

### Coverage Requirements (Both 95%+)

**TypeScript** - Enforced via `jest.config.cjs`:
```javascript
coverageThreshold: {
  branches: 87,
  functions: 97,
  lines: 95,
  statements: 95
}
```

**Python** - Enforced via `pyproject.toml`:
```toml
[tool.coverage.report]
fail_under = 95
```

Monitor both:
```bash
# TypeScript
cd typescript && pnpm test:coverage

# Python
cd python && uv run pytest --cov
```

### Test Organization

**TypeScript**:
```
packages/{provider}/tools/{tool}/
├─ __tests__/
│  ├─ {tool}.test.ts
│  └─ integration/
```

**Python**:
```
python/packages/{provider}/src/matamo_{provider}/tools/{tool}/
├─ tests/
│  ├─ test_{tool}.py
│  └─ test_integration_{tool}.py
```

### Linting Standards

**TypeScript** (ESLint):
```javascript
// typescript/eslint.config.cjs
extends: ['eslint:recommended', '@typescript-eslint/recommended'],
rules: {
  'no-any': 'warn',
  '@typescript-eslint/strict-boolean-expressions': 'error'
}
```

**Python** (Ruff):
```toml
# python/pyproject.toml
[tool.ruff.lint]
select = ["E", "F", "I", "UP", "B", "S", "ANN"]
ignore = ["ANN101", "ANN401"]
```

Both must pass before merge!

---

## Adding Matimo Tools

### When to Add

Add new MCP tools when:
- Agent repeatedly tries non-existent tool
- New capability needed (e.g., `matamo_update_tool`)
- Tool creation becomes bottleneck
- New provider APIs need exposing

### Tool Addition Workflow

#### 1. Define Requirements

```
Name: matamo_get_tool_metrics
Purpose: Retrieve usage metrics for a tool
Input: tool_name (string)
Output: metrics object {usage_count, avg_time_ms, error_rate}
Language: Python (MCP tools run in Python)
```

#### 2. Create Definition

```yaml
# packages/core/tools/matamo_get_tool_metrics/definition.yaml
name: matamo_get_tool_metrics
description: Retrieve usage metrics for a Matimo tool
version: '1.0.0'
status: stable

parameters:
  tool_name:
    type: string
    required: true
    description: Name of tool to get metrics for

execution:
  type: function
  function_name: get_tool_metrics

output_schema:
  type: object
  properties:
    usage_count: {type: integer}
    avg_time_ms: {type: number}
    error_rate: {type: number}
```

#### 3. Implement (Python)

```python
# python/packages/core/src/matimo/core/tools/matamo_get_tool_metrics.py
async def get_tool_metrics(tool_name: str) -> dict[str, Any]:
    """Retrieve metrics for a tool."""
    metrics = await metrics_db.get(tool_name)
    if not metrics:
        raise MatimoError(f"Tool not found: {tool_name}")
    
    return {
        'usage_count': metrics.calls,
        'avg_time_ms': metrics.avg_duration,
        'error_rate': metrics.error_pct
    }
```

#### 4. Test

```python
# tests
@pytest.mark.asyncio
async def test_get_tool_metrics():
    result = await get_tool_metrics('slack_send_message')
    
    assert isinstance(result['usage_count'], int)
    assert 0 <= result['error_rate'] <= 100
```

#### 5. Validate

```bash
matamo_validate_tool matamo_get_tool_metrics
# ✅ Valid
```

#### 6. Update Agent & Skill

- Add to Agent Tools Mapping
- Document in Skill § Part 6
- Add usage example to Skill § Part 7

---

## Updating Standards (Both SDKs)

### Example: Migrate from Jest to Vitest (TypeScript)

#### 1. Update Dependency

```json
// typescript/package.json
{
  "devDependencies": {
    "vitest": "^1.0.0",
    "vi": "^1.0.0"
  }
}
```

#### 2. Update Skill § Part 4

**Before**:
```typescript
import { describe, it, expect } from '@jest/globals';
```

**After**:
```typescript
import { describe, it, expect } from 'vitest';
```

#### 3. Update Test Config

```javascript
// typescript/vitest.config.ts
export default {
  test: {
    globals: true,
    environment: 'node'
  }
}
```

#### 4. Test with Agent

```
@agent matimo-tool-creator-refactored
"Create a test tool using Vitest (TypeScript)"
```

#### 5. Verify All Tests Pass

```bash
cd typescript
pnpm test
# All tests pass with Vitest
```

### Example: Add pytest-asyncio Support (Python)

#### 1. Update Dependency

```toml
# python/pyproject.toml
[project]
dependencies = [
    "pytest>=8.0",
    "pytest-asyncio>=0.23.0"
]
```

#### 2. Update Conftest

```python
# python/conftest.py
import pytest

@pytest.fixture
def event_loop():
    """Create event loop for async tests."""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()
```

#### 3. Update Skill § Part 5

```markdown
§ Part 5: Python Testing Standards

Use @pytest.mark.asyncio for all async tests:

@pytest.mark.asyncio
async def test_tool_execution():
    result = await execute({...})
    assert result['ok'] is True
```

#### 4. Test with Agent

```
@agent matimo-tool-creator-refactored
"Create a test tool using pytest-asyncio (Python)"
```

#### 5. Verify

```bash
cd python
uv run pytest --asyncio-mode=auto
# All tests pass
```

---

## Team Best Practices

### Code Review Checklist (Both SDKs)

```markdown
## Tool Creation Review Checklist

### YAML Definition
- [ ] Schema valid (matamo_validate_tool check)
- [ ] Parameters describe clearly
- [ ] output_schema matches real API
- [ ] error_handling configured (retry: 2+)
- [ ] examples included

### TypeScript Implementation
- [ ] Follows Skill § Part 7 patterns
- [ ] Parameter templating correct ({paramName})
- [ ] Error handling comprehensive
- [ ] No hardcoded secrets
- [ ] No `any` types (use `unknown`)
- [ ] Passes linting: pnpm lint
- [ ] Tests: pnpm test (≥90% coverage)

### Python Implementation
- [ ] Follows Skill § Part 7 patterns (parallel to TS)
- [ ] Type hints on all public functions
- [ ] Parameter templating correct ({paramName})
- [ ] Error handling comprehensive
- [ ] No hardcoded secrets
- [ ] Passes linting: uv run ruff check
- [ ] Tests: uv run pytest (≥90% coverage)
- [ ] Docstrings present

### Bilingual Verification
- [ ] YAML definition identical (shared)
- [ ] TS and Py executor logic equivalent
- [ ] Both test suites pass independently
- [ ] Error messages consistent
- [ ] README documents both implementations

### Quality Gates
- [ ] TypeScript: pnpm test ✅
- [ ] Python: uv run pytest ✅
- [ ] Coverage TS: ≥90%
- [ ] Coverage Py: ≥90%
- [ ] No CI/CD failures
- [ ] Code review approved
- [ ] Ready to merge main
```

### Metrics to Track (Both SDKs)

```bash
#!/bin/bash
# Save as: scripts/track-metrics.sh

echo "📊 Tool Creation Metrics (TypeScript + Python)"
echo "=============================================="

# TypeScript tools
TOTAL_TS=$(find packages/*/tools -name "index.ts" | wc -l)
echo "Total tools (TS): $TOTAL_TS"

# Python tools
TOTAL_PY=$(find python/packages/*/tools -name "executor.py" | wc -l)
echo "Total tools (Py): $TOTAL_PY"

# Bilingual coverage (both should be equal or very close)
echo ""
echo "Bilingual Coverage Check:"
if [ "$TOTAL_TS" -eq "$TOTAL_PY" ]; then
  echo "✅ Equal coverage: $TOTAL_TS/$TOTAL_PY"
else
  DIFF=$((TOTAL_TS - TOTAL_PY))
  echo "⚠️  Imbalance: TS=$TOTAL_TS, Py=$TOTAL_PY (diff: $DIFF)"
fi

# Tools created this month
THIS_MONTH=$(find packages/*/tools -name "index.ts" -newermt "$(date +%Y-%m-01)" | wc -l)
THIS_MONTH_PY=$(find python/packages/*/tools -name "executor.py" -newermt "$(date +%Y-%m-01)" | wc -l)
echo ""
echo "Created this month: TS=$THIS_MONTH, Py=$THIS_MONTH_PY"

# Most common provider (compare both)
echo ""
echo "Top providers (TypeScript):"
find packages/*/tools -name "index.ts" | sed 's|packages/||' | cut -d/ -f1 | sort | uniq -c | sort -rn | head -3

echo ""
echo "Top providers (Python):"
find python/packages/*/tools -name "executor.py" | sed 's|python/packages/||' | cut -d/ -f1 | sort | uniq -c | sort -rn | head -3
```

---

## Performance Optimization

### Reduce Tool Creation Time

**Current**: 25-35 min per bilingual tool

**Optimizations**:

1. **Parallel code generation** (already implemented)
   ```
   Instead of: YAML → TS → Py → Test TS → Test Py
   Instead: YAML → [Parallel: TS + Py] → [Parallel: Test TS + Py]
   ```

2. **Cache test fixtures** (for common APIs)
   ```python
   # Reuse mock responses between similar tools
   GITHUB_API_FIXTURES = {
       'list_repos': {...},
       'list_issues': {...}
   }
   ```

3. **Pre-validate patterns** (before code generation)
   ```
   Validate YAML early → catch errors before generation
   ```

---

## Troubleshooting Production Issues

### Issue 1: TypeScript Tests Failing

```bash
cd packages/{provider}/tools/{tool}

# Verbose output
pnpm test -- --verbose

# Common issues:
# - Jest config outdated
# - Mock data stale
# - Type errors
```

### Issue 2: Python Tests Failing

```bash
cd python/packages/{provider}

# Verbose output
uv run pytest src/matamo_{provider}/tools/{tool}/tests/ -vv

# Common issues:
# - asyncio issues → use @pytest.mark.asyncio
# - Import errors → run: uv sync
# - Type hint issues → check annotations
```

### Issue 3: Bilingual Mismatch

When TS and Py implementations diverge:

```bash
# Compare implementations
diff \
  packages/{provider}/tools/{tool}/index.ts \
  python/packages/{provider}/src/matamo_{provider}/tools/{tool}/executor.py

# Verify YAML is identical
diff \
  packages/{provider}/tools/{tool}/definition.yaml \
  python/packages/{provider}/src/matamo_{provider}/tools/{tool}/definition.yaml

# Should be identical - if not, regenerate Py version
```

### Issue 4: Coverage Gaps (Either SDK)

```bash
# TypeScript coverage report
cd typescript
pnpm test:coverage

# Python coverage report
cd python
uv run pytest --cov=packages/core/src/matimo --cov-report=term-missing

# Fix low coverage: add tests, not suppressions
```

---

## CI/CD Integration

### GitHub Actions for Bilingual Testing

```yaml
# .github/workflows/test-bilingual.yml
name: Test TypeScript & Python

on: [push, pull_request]

jobs:
  typescript:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: pnpm install
      - run: pnpm test
      - run: pnpm test:coverage

  python:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      - run: cd python && uv sync
      - run: uv run pytest --cov
      - run: uv run ruff check

  bilingual-check:
    runs-on: ubuntu-latest
    needs: [typescript, python]
    steps:
      - uses: actions/checkout@v3
      - run: bash scripts/verify-bilingual.sh
        # Verify TS and Py implementations are equivalent
```

---

## Quarterly Review

Every 3 months:

- [ ] Tool creation metrics (trending?)
- [ ] Bilingual coverage (TS ≈ Py?)
- [ ] Test coverage (both ≥90%?)
- [ ] Performance (time per tool stable?)
- [ ] Team feedback (pain points?)
- [ ] Security audit (no hardcoded secrets?)
- [ ] Documentation updated?
- [ ] New providers to add?
- [ ] New auth types needed?
- [ ] Update cycles needed (Jest→Vitest? pytest→pytest-asyncio?)

---

**Last Updated**: April 2026 | **Bilingual**: ✅ TypeScript + Python
