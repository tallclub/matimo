import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { beforeAll, describe, expect, it } from '@jest/globals';

type ToolDefinition = {
  name: string;
  description?: string;
  version?: string;
  status?: string;
  parameters?: Record<string, unknown>;
  execution?: {
    type?: string;
    command?: string;
    args?: unknown[];
    code?: string;
  };
  output_schema?: Record<string, unknown>;
  authentication?: { type?: string };
  examples?: unknown[];
};

describe('bruno tools', () => {
  const toolNames = [
    'bruno_run_collection',
    'bruno_run_request',
    'bruno_list_collections',
    'bruno_get_collection_info',
    'bruno_import_openapi',
    'bruno_create_collection',
    'bruno_add_request',
  ];

  toolNames.forEach((toolName) => {
    describe(toolName, () => {
      let toolDefinition: ToolDefinition;

      beforeAll(() => {
        const toolPath = path.join(__dirname, `../../tools/${toolName}/definition.yaml`);
        const content = fs.readFileSync(toolPath, 'utf-8');
        toolDefinition = yaml.load(content) as ToolDefinition;
      });

      it('should load valid YAML definition', () => {
        expect(toolDefinition).toBeDefined();
        expect(toolDefinition.name).toBe(toolName);
      });

      it('should have required fields', () => {
        expect(toolDefinition.description).toBeDefined();
        expect(toolDefinition.version).toBeDefined();
        expect(['stable', 'approved']).toContain(toolDefinition.status);
        expect(toolDefinition.parameters).toBeDefined();
        expect(toolDefinition.execution).toBeDefined();
        expect(toolDefinition.output_schema).toBeDefined();
      });

      it('should have valid authentication config', () => {
        const auth = toolDefinition.authentication;
        expect(auth).toBeDefined();
        if (!auth) {
          return;
        }

        expect(['api_key', 'bearer', 'basic', 'oauth2']).toContain(auth.type);
      });

      it('should have at least one example', () => {
        const examples = toolDefinition.examples;
        expect(examples).toBeDefined();
        expect(Array.isArray(examples)).toBe(true);
        if (!examples) {
          return;
        }
        expect(examples.length).toBeGreaterThanOrEqual(1);
      });

      it('should have valid execution config', () => {
        const execution = toolDefinition.execution;
        expect(execution).toBeDefined();
        if (!execution) {
          return;
        }

        expect(['command', 'function']).toContain(execution.type);

        // CLI-based tools use command type
        if (execution.type === 'command') {
          expect(execution.command).toBe('bru');
          expect(Array.isArray(execution.args)).toBe(true);
        }

        // Programmatic tools use function type
        if (execution.type === 'function') {
          expect(execution.code).toBeDefined();
        }
      });
    });
  });
});
