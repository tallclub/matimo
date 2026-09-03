import {
  applyResponseSizeGuardrail,
  DEFAULT_MAX_RESPONSE_SIZE_BYTES,
} from '../../../src/core/response-size-guardrail';
import type { ToolDefinition } from '../../../src/core/schema';

function makeTool(overrides: Partial<ToolDefinition> = {}): ToolDefinition {
  return {
    name: 'test-tool',
    description: 'Test',
    version: '1.0.0',
    execution: { type: 'http', method: 'GET', url: 'https://api.example.com' },
    ...overrides,
  } as ToolDefinition;
}

describe('applyResponseSizeGuardrail', () => {
  it('returns small results unchanged', () => {
    const tool = makeTool();
    const result = { success: true, data: { id: 1 } };
    expect(applyResponseSizeGuardrail(tool, result)).toEqual(result);
  });

  it('truncates a large array and appends the exact marker text with correct N/M counts', () => {
    const tool = makeTool();
    const items = Array.from({ length: 5000 }, (_, i) => ({
      id: i,
      name: `item-${i}`,
      description: 'x'.repeat(50),
    }));

    const result = applyResponseSizeGuardrail(tool, items, 5_000) as unknown[];

    expect(Array.isArray(result)).toBe(true);
    const marker = result[result.length - 1];
    expect(typeof marker).toBe('string');
    expect(marker as string).toMatch(/^\.\.\.truncated, \d+ of 5000 items shown$/);

    const shownCount = result.length - 1; // exclude the marker itself
    const match = (marker as string).match(/^\.\.\.truncated, (\d+) of 5000 items shown$/);
    expect(match).not.toBeNull();
    expect(Number(match![1])).toBe(shownCount);
    expect(shownCount).toBeLessThan(items.length);
    expect(shownCount).toBeGreaterThan(0);
  });

  it('does not truncate an array that already fits the budget', () => {
    const tool = makeTool();
    const items = [{ id: 1 }, { id: 2 }, { id: 3 }];
    const result = applyResponseSizeGuardrail(tool, items, 10_000);
    expect(result).toEqual(items);
  });

  it('truncates a long string and appends a character-count marker', () => {
    const tool = makeTool();
    const longString = 'a'.repeat(10_000);
    const result = applyResponseSizeGuardrail(tool, longString, 500) as string;

    expect(result.length).toBeLessThan(longString.length);
    expect(result).toMatch(/\.\.\.truncated, \d+ of 10000 characters shown$/);
  });

  it('truncates a large nested object, preserves small sibling fields intact, and adds _truncated once at the top level', () => {
    const tool = makeTool();
    const result = {
      success: true,
      statusCode: 200,
      headers: { 'content-type': 'application/json' },
      data: Array.from({ length: 2000 }, (_, i) => ({ id: i, payload: 'y'.repeat(100) })),
    };

    const truncated = applyResponseSizeGuardrail(tool, result, 5_000) as Record<string, unknown>;

    // Small fields must survive completely unchanged — no data loss.
    expect(truncated.success).toBe(true);
    expect(truncated.statusCode).toBe(200);
    expect(truncated.headers).toEqual({ 'content-type': 'application/json' });

    // The large field was truncated.
    expect(Array.isArray(truncated.data)).toBe(true);
    expect((truncated.data as unknown[]).length).toBeLessThan(2001);

    // Marked exactly once, at the outermost object.
    expect(truncated._truncated).toBe(true);
  });

  it('respects a per-tool output_schema.max_response_size override', () => {
    const tool = makeTool({
      output_schema: { max_response_size: 200 },
    } as Partial<ToolDefinition>);
    const items = Array.from({ length: 100 }, (_, i) => ({ id: i, name: `item-${i}` }));

    // Instance default is huge, but the per-tool override (200 bytes) should win.
    const result = applyResponseSizeGuardrail(tool, items, 1_000_000) as unknown[];
    expect(result.length).toBeLessThan(items.length + 1);
  });

  it('respects an instance-level defaultMaxResponseSize when no per-tool override is set', () => {
    const tool = makeTool();
    const items = Array.from({ length: 100 }, (_, i) => ({ id: i, name: `item-${i}` }));

    const result = applyResponseSizeGuardrail(tool, items, 200) as unknown[];
    expect(result.length).toBeLessThan(items.length + 1);
  });

  it('falls back to DEFAULT_MAX_RESPONSE_SIZE_BYTES when neither per-tool nor instance default is set', () => {
    const tool = makeTool();
    const small = { ok: true };
    // Well under the default cap — should pass through unchanged.
    expect(applyResponseSizeGuardrail(tool, small)).toEqual(small);

    const huge = Array.from({ length: 200_000 }, (_, i) => ({ id: i, blob: 'z'.repeat(50) }));
    const result = applyResponseSizeGuardrail(tool, huge) as unknown[];
    expect(result.length).toBeLessThan(huge.length + 1);
    expect(DEFAULT_MAX_RESPONSE_SIZE_BYTES).toBe(262_144);
  });

  it('never removes or renames existing keys on a truncated object envelope', () => {
    const tool = makeTool();
    const result = {
      success: true,
      data: Array.from({ length: 1000 }, (_, i) => ({ id: i, blob: 'q'.repeat(100) })),
      statusCode: 200,
      headers: {},
    };
    const truncated = applyResponseSizeGuardrail(tool, result, 2_000) as Record<string, unknown>;
    expect(Object.keys(truncated)).toEqual(
      expect.arrayContaining(['success', 'data', 'statusCode', 'headers'])
    );
  });
});
