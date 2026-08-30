import { classifyRisk, maxRisk } from '../../../src/policy/risk-classifier';
import type { ToolDefinition } from '../../../src/core/schema';

function makeTool(
  overrides: Partial<ToolDefinition> & { execution: ToolDefinition['execution'] }
): ToolDefinition {
  return {
    name: 'test-tool',
    description: 'Test',
    version: '1.0.0',
    ...overrides,
  };
}

describe('classifyRisk', () => {
  it('a declared risk cannot lower the automatically computed risk', () => {
    // type: function is automatically 'critical' — declaring 'low' must not downgrade it.
    const tool = makeTool({
      execution: { type: 'function', code: './fn.ts' },
      risk: 'low',
    });
    expect(classifyRisk(tool)).toBe('critical');
  });

  it('a declared risk can raise the automatically computed risk', () => {
    // type: http GET is automatically 'low' — declaring 'high' should raise it.
    const tool = makeTool({
      execution: { type: 'http', method: 'GET', url: 'https://api.example.com' },
      risk: 'high',
    });
    expect(classifyRisk(tool)).toBe('high');
  });

  it('a declared risk equal to the automatic level passes through unchanged', () => {
    const tool = makeTool({
      execution: { type: 'command', command: 'echo hello' },
      risk: 'high',
    });
    expect(classifyRisk(tool)).toBe('high');
  });

  it('should classify function execution as critical', () => {
    const tool = makeTool({ execution: { type: 'function', code: './fn.ts' } });
    expect(classifyRisk(tool)).toBe('critical');
  });

  it('should classify command execution as high', () => {
    const tool = makeTool({ execution: { type: 'command', command: 'echo hello' } });
    expect(classifyRisk(tool)).toBe('high');
  });

  it('should classify HTTP GET as low', () => {
    const tool = makeTool({
      execution: { type: 'http', method: 'GET', url: 'https://api.example.com' },
    });
    expect(classifyRisk(tool)).toBe('low');
  });

  it('should classify HTTP DELETE as high', () => {
    const tool = makeTool({
      execution: { type: 'http', method: 'DELETE', url: 'https://api.example.com/item' },
    });
    expect(classifyRisk(tool)).toBe('high');
  });

  it('should classify HTTP POST as medium', () => {
    const tool = makeTool({
      execution: { type: 'http', method: 'POST', url: 'https://api.example.com' },
    });
    expect(classifyRisk(tool)).toBe('medium');
  });

  it('should classify HTTP PUT as medium', () => {
    const tool = makeTool({
      execution: { type: 'http', method: 'PUT', url: 'https://api.example.com' },
    });
    expect(classifyRisk(tool)).toBe('medium');
  });

  it('should classify HTTP PATCH as medium', () => {
    const tool = makeTool({
      execution: { type: 'http', method: 'PATCH', url: 'https://api.example.com' },
    });
    expect(classifyRisk(tool)).toBe('medium');
  });

  it('should classify HTTP GET with requires_approval as high', () => {
    const tool = makeTool({
      execution: { type: 'http', method: 'GET', url: 'https://api.example.com' },
      requires_approval: true,
    });
    expect(classifyRisk(tool)).toBe('high');
  });

  it('should treat unknown execution type as high risk', () => {
    const tool = makeTool({
      execution: { type: 'http', method: 'GET', url: 'https://api.example.com' },
    });
    // Runtime guard: if malformed definitions bypass schema validation, default to high risk.
    (tool as unknown as { execution: { type: string } }).execution.type = 'unknown';
    expect(classifyRisk(tool)).toBe('high');
  });
});

describe('maxRisk', () => {
  it('returns the more severe of the two levels', () => {
    expect(maxRisk('low', 'critical')).toBe('critical');
    expect(maxRisk('critical', 'low')).toBe('critical');
    expect(maxRisk('medium', 'high')).toBe('high');
    expect(maxRisk('high', 'high')).toBe('high');
  });
});
