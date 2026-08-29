# Testing Tools

Write and validate tests for Matimo tools.

## Tool Validation

### Validate All Tools

```bash
# Validate tool definitions (YAML syntax and schema)
pnpm validate-tools

# Output:
# ✅ tools/calculator/definition.yaml - Valid
# ✅ tools/gmail/send-email/definition.yaml - Valid
# ✅ tools/gmail/list-messages/definition.yaml - Valid
```

This validates:

- YAML syntax is correct
- All required fields present
- Parameter types are valid
- Execution config is complete
- Output schema is valid

---

## Unit Tests

### Test Tool Definition

```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import { MatimoInstance } from 'matimo';

describe('Tool Definition', () => {
  let matimo: Awaited<ReturnType<typeof MatimoInstance.init>>;

  beforeAll(async () => {
    matimo = await MatimoInstance.init('./tools');
  });

  it('should load calculator tool', () => {
    const tool = matimo.getTool('calculator');

    expect(tool).toBeDefined();
    expect(tool!.name).toBe('calculator');
    expect(tool!.description).toBe('Perform basic math operations');
    expect(tool!.version).toBe('1.0.0');
  });

  it('should have required parameters', () => {
    const tool = matimo.getTool('calculator');

    expect(tool!.parameters).toHaveProperty('operation');
    expect(tool!.parameters).toHaveProperty('a');
    expect(tool!.parameters).toHaveProperty('b');
  });

  it('should validate parameter types', () => {
    const tool = matimo.getTool('calculator');

    expect(tool!.parameters!.operation.type).toBe('string');
    expect(tool!.parameters!.a.type).toBe('number');
    expect(tool!.parameters!.b.type).toBe('number');
  });

  it('should have execution config', () => {
    const tool = matimo.getTool('calculator');

    expect(tool!.execution).toBeDefined();
    expect(tool!.execution.type).toMatch(/command|http/);
  });
});
```

---

## Integration Tests

### Test Tool Execution

```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import { MatimoInstance } from 'matimo';

describe('Calculator Tool Execution', () => {
  let m: Awaited<ReturnType<typeof MatimoInstance.init>>;

  beforeAll(async () => {
    m = await MatimoInstance.init('./tools');
  });

  it('should execute add operation', async () => {
    const result = await m.execute('calculator', {
      operation: 'add',
      a: 5,
      b: 3,
    });

    expect(result.result).toBe(8);
  });

  it('should execute subtract operation', async () => {
    const result = await m.execute('calculator', {
      operation: 'subtract',
      a: 10,
      b: 4,
    });

    expect(result.result).toBe(6);
  });

  it('should execute multiply operation', async () => {
    const result = await m.execute('calculator', {
      operation: 'multiply',
      a: 5,
      b: 3,
    });

    expect(result.result).toBe(15);
  });

  it('should execute divide operation', async () => {
    const result = await m.execute('calculator', {
      operation: 'divide',
      a: 10,
      b: 2,
    });

    expect(result.result).toBe(5);
  });
});
```

---

## Parameter Validation Tests

### Test Parameter Constraints

```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import { MatimoInstance } from 'matimo';

describe('Calculator Parameter Validation', () => {
  let m: Awaited<ReturnType<typeof MatimoInstance.init>>;

  beforeAll(async () => {
    m = await MatimoInstance.init('./tools');
  });

  it('should reject invalid operation', async () => {
    expect(async () => {
      await m.execute('calculator', {
        operation: 'invalid', // Not in enum
        a: 5,
        b: 3,
      });
    }).rejects.toThrow('INVALID_PARAMETERS');
  });

  it('should require all parameters', async () => {
    expect(async () => {
      await m.execute('calculator', {
        operation: 'add',
        // Missing: a, b
      });
    }).rejects.toThrow('INVALID_PARAMETERS');
  });

  it('should validate parameter types', async () => {
    expect(async () => {
      await m.execute('calculator', {
        operation: 'add',
        a: 'five', // Should be number
        b: 3,
      });
    }).rejects.toThrow('INVALID_PARAMETERS');
  });
});
```

---

## OAuth2 Tool Tests

### Test OAuth2 Tools

```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import { MatimoInstance } from 'matimo';

describe('Gmail Tool Execution', () => {
  let m: Awaited<ReturnType<typeof MatimoInstance.init>>;

  beforeAll(async () => {
    // Ensure GMAIL_ACCESS_TOKEN is set in environment
    if (!process.env.GMAIL_ACCESS_TOKEN) {
      console.warn('⚠️  Skipping Gmail tests: GMAIL_ACCESS_TOKEN not set');
      return;
    }

    m = await MatimoInstance.init('./tools');
  });

  it('should send email', async () => {
    if (!m) {
      console.warn('Skipping: no Matimo instance');
      return;
    }

    const result = await m.execute('gmail-send-email', {
      to: 'test@example.com',
      subject: 'Test Email',
      body: 'This is a test email',
    });

    expect(result.messageId).toBeDefined();
  });

  it('should list messages', async () => {
    if (!m) return;

    const result = await m.execute('gmail-list-messages', {
      maxResults: 10,
    });

    expect(result.messages).toBeDefined();
    expect(Array.isArray(result.messages)).toBe(true);
  });

  it('should handle missing auth token', async () => {
    // Clear token temporarily
    const saved = process.env.GMAIL_ACCESS_TOKEN;
    delete process.env.GMAIL_ACCESS_TOKEN;

    const m2 = await MatimoInstance.init('./tools');

    expect(async () => {
      await m2.execute('gmail-send-email', {
        to: 'test@example.com',
        subject: 'Test',
        body: 'Test',
      });
    }).rejects.toThrow('AUTH_FAILED');

    // Restore token
    if (saved) {
      process.env.GMAIL_ACCESS_TOKEN = saved;
    }
  });
});
```

---

## Error Handling Tests

### Test Error Conditions

```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import { MatimoInstance } from 'matimo';

describe('Error Handling', () => {
  let m: Awaited<ReturnType<typeof MatimoInstance.init>>;

  beforeAll(async () => {
    m = await MatimoInstance.init('./tools');
  });

  it('should throw TOOL_NOT_FOUND', async () => {
    expect(async () => {
      await m.execute('unknown-tool', {});
    }).rejects.toThrow('TOOL_NOT_FOUND');
  });

  it('should throw INVALID_PARAMETERS', async () => {
    expect(async () => {
      await m.execute('calculator', {
        operation: 'add',
        // Missing: a, b
      });
    }).rejects.toThrow('INVALID_PARAMETERS');
  });

  it('should include error details', async () => {
    try {
      await m.execute('calculator', {
        operation: 'invalid',
        a: 5,
        b: 3,
      });
      expect.fail('Should throw error');
    } catch (error) {
      expect(error.code).toBe('INVALID_PARAMETERS');
      expect(error.details).toBeDefined();
    }
  });
});
```

---

## Running Tests

```bash
# Run all tests
pnpm test

# Run with coverage
pnpm test:coverage

# Run in watch mode (during development)
pnpm test:watch

# Run specific test file
pnpm test -- tools.test.ts

# Run tests matching pattern
pnpm test -- --grep "Calculator"
```

---

## Test Coverage

### View Coverage Report

```bash
pnpm test:coverage

# Output:
# ✅ 100% Statements
# ✅ 100% Branches
# ✅ 100% Functions
# ✅ 100% Lines
```

---

## Best Practices

### 1. Test YAML Syntax First

Always validate YAML before testing execution:

```bash
pnpm validate-tools
```

### 2. Test Parameters Before Execution

```typescript
// First: validate tool definition
const tool = m.getTool('calculator');
expect(tool.parameters).toBeDefined();

// Then: test execution
const result = await m.execute('calculator', params);
```

### 3. Mock External Calls (for unit tests)

```typescript
import { describe, it, expect, vi } from 'vitest';

describe('Gmail Tool (Mocked)', () => {
  it('should call Gmail API', async () => {
    const mockExecute = vi.fn().mockResolvedValue({
      messageId: 'msg_123',
    });

    const result = await mockExecute({
      to: 'test@example.com',
      subject: 'Test',
      body: 'Test',
    });

    expect(result.messageId).toBe('msg_123');
  });
});
```

### 4. Test Error Cases

```typescript
it('should handle execution errors', async () => {
  expect(async () => {
    await m.execute('calculator', {
      operation: 'divide',
      a: 10,
      b: 0, // Division by zero
    });
  }).rejects.toThrow();
});
```

---

## Next Steps

- **Tool Development**: [YAML Tool Specification](./YAML_TOOLS.md)
- **Error Codes**: [Error Reference](../api-reference/ERRORS.md)
- **Examples**: [Code Examples](../../typescript/examples/)
