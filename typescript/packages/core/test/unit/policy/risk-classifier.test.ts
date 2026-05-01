import { classifyRisk } from '../../../src/policy/risk-classifier';
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
  it('should honor explicit risk override before execution-type checks', () => {
    const tool = makeTool({
      execution: { type: 'command', command: 'echo hello' },
      risk: 'low',
    });
    expect(classifyRisk(tool)).toBe('low');
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
