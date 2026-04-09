import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

interface ToolDefinition {
  name: string;
  parameters: Record<string, { type: string }>;
  execution: { type: string };
  output_schema: Record<string, unknown>;
}

describe('postgres-execute-sql definition', () => {
  let def: ToolDefinition;

  beforeAll(() => {
    const defPath = path.join(__dirname, '..', '..', 'tools', 'execute-sql', 'definition.yaml');
    const content = fs.readFileSync(defPath, 'utf8');
    def = yaml.load(content) as ToolDefinition;
  });

  it('has required fields', () => {
    expect(def.name).toBe('postgres-execute-sql');
    expect(def.parameters).toBeDefined();
    expect(def.execution).toBeDefined();
    expect(def.output_schema).toBeDefined();
    expect(def.execution.type).toBe('function');
  });

  it('parameters have types', () => {
    Object.entries(def.parameters).forEach(([_k, v]) => {
      expect(v.type).toBeDefined();
      expect(['string', 'array', 'number', 'object', 'boolean']).toContain(v.type);
    });
  });
});
