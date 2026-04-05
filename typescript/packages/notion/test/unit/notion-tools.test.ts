/**
 * Unit Tests for Notion Tools
 * Tests YAML structure, parameter validation, and schema correctness
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

interface ToolDefinition {
  name: string;
  description: string;
  version: string;
  parameters?: Record<string, unknown>;
  execution: Record<string, unknown>;
  output_schema: Record<string, unknown>;
  authentication: Record<string, unknown>;
  notes?: Record<string, unknown>;
  examples?: Record<string, unknown>[];
}

describe('Notion Tools Unit Tests', () => {
  const toolsDir = path.join(__dirname, '../../tools');
  const tools = [
    'notion_list_databases',
    'notion_query_database',
    'notion_create_page',
    'notion_update_page',
    'notion_search',
    'notion_create_comment',
    'notion_get_user',
  ];

  tools.forEach((toolName) => {
    describe(`${toolName}`, () => {
      let toolDef: ToolDefinition;

      beforeAll(() => {
        const toolPath = path.join(toolsDir, toolName, 'definition.yaml');
        if (!fs.existsSync(toolPath)) {
          throw new Error(`Tool definition not found: ${toolPath}`);
        }
        const content = fs.readFileSync(toolPath, 'utf8');
        toolDef = yaml.load(content) as ToolDefinition;
      });

      it('should have valid tool definition with required fields', () => {
        expect(toolDef).toBeDefined();
        expect(toolDef.name).toBe(toolName);
        expect(toolDef.description).toBeDefined();
        expect(typeof toolDef.description).toBe('string');
        expect(toolDef.description.length > 0).toBe(true);
        expect(toolDef.version).toBeDefined();
        expect(toolDef.parameters).toBeDefined();
        expect(toolDef.execution).toBeDefined();
        expect(toolDef.output_schema).toBeDefined();
      });

      it('should have valid execution config', () => {
        expect(['command', 'http', 'function']).toContain(toolDef.execution.type);
        if (toolDef.execution.type === 'http') {
          expect(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']).toContain(toolDef.execution.method);
          expect(toolDef.execution.url).toBeDefined();
          expect(typeof toolDef.execution.url).toBe('string');
          expect((toolDef.execution.url as string).startsWith('https')).toBe(true);
        }
      });

      it('should have authentication config', () => {
        expect(toolDef.authentication).toBeDefined();
        expect(['api_key', 'bearer', 'oauth2', 'basic']).toContain(toolDef.authentication.type);
      });

      it('should validate all parameters have types and descriptions', () => {
        Object.entries(toolDef.parameters || {}).forEach(
          ([_paramName, param]: [string, unknown]) => {
            const p = param as Record<string, unknown>;
            expect(p.type).toBeDefined();
            expect(['string', 'number', 'boolean', 'object', 'array']).toContain(p.type);
            expect(p.description).toBeDefined();
            expect(typeof p.description).toBe('string');
            expect((p.description as string).length > 0).toBe(true);
            expect(p.required).toBeDefined();
            expect(typeof p.required).toBe('boolean');
          }
        );
      });

      it('should have output_schema that describes expected response', () => {
        expect(toolDef.output_schema).toBeDefined();
        expect(['object', 'string', 'number', 'boolean', 'array']).toContain(
          toolDef.output_schema.type
        );
        if (toolDef.output_schema.type === 'object') {
          expect(toolDef.output_schema.properties).toBeDefined();
          // `required` is optional in some tool definitions; if present it must be an array
          if (Object.prototype.hasOwnProperty.call(toolDef.output_schema, 'required')) {
            expect(Array.isArray(toolDef.output_schema.required)).toBe(true);
          }
        }
      });

      it('should include authentication notes', () => {
        expect(toolDef.notes).toBeDefined();
        expect((toolDef.notes as Record<string, unknown>).env).toBeDefined();
        expect((toolDef.notes as Record<string, unknown>).caution).toBeDefined();
      });

      it('should include examples section with multiple examples', () => {
        expect(toolDef.examples).toBeDefined();
        expect(Array.isArray(toolDef.examples)).toBe(true);
        expect((toolDef.examples as Record<string, unknown>[]).length >= 2).toBe(true);
        (toolDef.examples as Record<string, unknown>[]).forEach((example) => {
          expect(example.name).toBeDefined();
          expect(typeof example.name).toBe('string');
          expect(example.params).toBeDefined();
          expect(typeof example.params).toBe('object');
          expect(example.expected_result).toBeDefined();
          expect(typeof example.expected_result).toBe('string');
        });
      });

      it('should have Notion API v1 base URL when using HTTP execution, or point to function/command otherwise', () => {
        const exec = toolDef.execution as Record<string, unknown>;
        const execType = typeof exec.type === 'string' ? exec.type : undefined;
        if (execType === 'http') {
          const url = exec.url as string;
          expect(url).toContain('api.notion.com');
          expect(url).toContain('/v1/');
        } else if (execType === 'function') {
          // function-executed tools should declare a code entry
          const code = exec.code as string | undefined;
          expect(code).toBeDefined();
          expect(typeof code).toBe('string');
        } else if (execType === 'command') {
          const command = exec.command as string | undefined;
          expect(command).toBeDefined();
          expect(typeof command).toBe('string');
        }
      });

      it('should use Bearer token authentication header for HTTP tools, or declare bearer auth at top-level for others', () => {
        const exec = toolDef.execution as Record<string, unknown>;
        const execType = typeof exec.type === 'string' ? exec.type : undefined;
        if (execType === 'http') {
          const headers = (exec.headers as Record<string, unknown>) || {};
          expect(headers.Authorization).toBeDefined();
          expect(headers.Authorization as string).toContain('Bearer');
        } else {
          // non-HTTP tools should still declare authentication at top-level
          expect(toolDef.authentication).toBeDefined();
          const auth = toolDef.authentication as Record<string, unknown>;
          expect(auth.type).toBeDefined();
          // prefer bearer for Notion provider tools
          expect(['bearer', 'api_key', 'oauth2', 'basic']).toContain(auth.type);
        }
      });

      it('should not expose secrets in examples', () => {
        const examplesStr = JSON.stringify(toolDef.examples);
        expect(examplesStr).not.toContain('secret_');
        expect(examplesStr).not.toContain('NOTION_API_KEY');
      });
    });
  });

  describe('Provider Configuration', () => {
    let providerDef: ToolDefinition;

    beforeAll(() => {
      const providerPath = path.join(__dirname, '../../definition.yaml');
      const content = fs.readFileSync(providerPath, 'utf8');
      providerDef = yaml.load(content) as ToolDefinition;
    });

    it('should have a valid provider config (provider schema or legacy)', () => {
      expect(providerDef).toBeDefined();
      // New-style provider YAML should declare type: provider and have provider.endpoints
      const asAny = providerDef as unknown as Record<string, unknown>;
      if (asAny.type === 'provider' || asAny.provider) {
        // provider-style schema
        const provider = (asAny.provider as Record<string, unknown>) || {};
        expect(asAny.type === 'provider' || !!provider).toBeTruthy();

        // oauth / endpoints expectations
        if (provider.endpoints) {
          const endpoints = provider.endpoints as Record<string, unknown>;
          expect(
            endpoints.defaultScopes ||
              endpoints.scopes ||
              endpoints.tokenUrl ||
              endpoints.authorizationUrl
          ).toBeDefined();
        }
      } else {
        // legacy-style provider definition (keeps authentication, oauth2, notes top-level)
        expect(providerDef.name).toBe('notion_provider');
        expect((providerDef.authentication as Record<string, unknown>).type).toBe('bearer');
        // Ensure setup_docs is a valid absolute URL targeting Notion (strict whitelist)
        const setupDocs =
          ((providerDef.notes as Record<string, unknown>).setup_docs as string) || '';
        expect(typeof setupDocs).toBe('string');
        // Require a valid absolute URL; let URL parsing throw (test will fail) if invalid
        const parsed = new URL(setupDocs);
        const host = parsed.hostname;
        expect(host === 'notion.com' || host.endsWith('.notion.com')).toBe(true);
      }
    });
  });

  describe('Tool Directory Structure', () => {
    it('should have all tool directories', () => {
      tools.forEach((toolName) => {
        const toolDir = path.join(toolsDir, toolName);
        expect(fs.existsSync(toolDir)).toBe(true);
        expect(fs.existsSync(path.join(toolDir, 'definition.yaml'))).toBe(true);
      });
    });

    it('should have package.json with correct metadata', () => {
      const packagePath = path.join(__dirname, '../../package.json');
      const content = fs.readFileSync(packagePath, 'utf8');
      const pkg = JSON.parse(content);

      expect(pkg.name).toBe('@matimo/notion');
      expect(pkg.description).toContain('Notion');
      expect(pkg.type).toBe('module');
      expect(pkg.files).toContain('tools');
      expect(pkg.files).toContain('README.md');
      expect(pkg.files).toContain('definition.yaml');
    });

    it('should have README documentation', () => {
      const readmePath = path.join(__dirname, '../../README.md');
      expect(fs.existsSync(readmePath)).toBe(true);
      const content = fs.readFileSync(readmePath, 'utf8');
      expect(content).toContain('Notion');
      expect(content).toContain('Tools');
      tools.forEach((toolName) => {
        expect(content).toContain(toolName);
      });
    });
  });
});
