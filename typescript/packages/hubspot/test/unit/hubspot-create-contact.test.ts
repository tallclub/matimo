import * as fs from 'fs';
import * as path from 'path';

describe('hubspot-create-contact', () => {
  let toolDef: Record<string, unknown>;

  beforeAll(() => {
    const toolPath = path.join(__dirname, '../../tools/hubspot-create-contact/definition.yaml');
    const content = fs.readFileSync(toolPath, 'utf8');
    toolDef = require('js-yaml').load(content);
  });

  it('should have valid tool definition with required fields', () => {
    expect(toolDef.name).toBe('hubspot-create-contact');
    expect(toolDef.description).toBeDefined();
    expect(typeof toolDef.description).toBe('string');
    expect((toolDef.description as string).length > 0).toBe(true);
    expect(toolDef.parameters).toBeDefined();
    expect(toolDef.execution).toBeDefined();
    expect(toolDef.output_schema).toBeDefined();
  });

  it('should have valid execution config', () => {
    const execution = toolDef.execution as { type: string; method?: string; url?: string };
    expect(['command', 'http', 'function']).toContain(execution.type);
    if (execution.type === 'http') {
      expect(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']).toContain(execution.method);
      expect(execution.url).toBeDefined();
      expect(typeof execution.url).toBe('string');
    }
  });

  it('should validate all parameters have types', () => {
    Object.entries(toolDef.parameters as Record<string, { type: string }>).forEach(([_, param]) => {
      expect(param.type).toBeDefined();
      expect(['string', 'number', 'boolean', 'object', 'array']).toContain(param.type);
    });
  });

  it('should have output_schema that describes expected response', () => {
    const outputSchema = toolDef.output_schema as { type: string };
    expect(outputSchema).toBeDefined();
    expect(['object', 'string', 'number', 'boolean', 'array']).toContain(outputSchema.type);
  });

  it('should include examples section', () => {
    expect(toolDef.examples).toBeDefined();
    expect(Array.isArray(toolDef.examples)).toBe(true);
    expect((toolDef.examples as Array<unknown>).length > 0).toBe(true);
    (toolDef.examples as Array<Record<string, unknown>>).forEach((example) => {
      expect(example.name).toBeDefined();
      expect(example.params).toBeDefined();
    });
  });
});
