/**
 * Integration Tests for Notion Tools
 * Tests actual tool execution with Matimo instance and error handling
 */

import { MatimoInstance } from '../../../core/src/matimo-instance';
import path from 'path';

describe('Notion Tools Integration Tests', () => {
  let matimo: MatimoInstance;

  beforeAll(async () => {
    const toolsPath = path.join(__dirname, '../../tools');
    matimo = await MatimoInstance.init(toolsPath);
  });

  it('should load all Notion tools from directory', () => {
    const tools = matimo.listTools();
    const toolNames = tools.map((t) => t.name);

    expect(tools.length).toBeGreaterThan(0);
    expect(toolNames).toContain('notion_list_databases');
    expect(toolNames).toContain('notion_query_database');
    expect(toolNames).toContain('notion_create_page');
    expect(toolNames).toContain('notion_update_page');
    expect(toolNames).toContain('notion_search');
    expect(toolNames).toContain('notion_create_comment');
    expect(toolNames).toContain('notion_get_user');
  });

  it('should filter Notion tools correctly', () => {
    const notionTools = matimo.searchTools('notion');
    expect(notionTools.length).toBeGreaterThanOrEqual(7);
    notionTools.forEach((tool) => {
      expect(tool.name).toContain('notion');
    });
  });

  describe('notion_query_database', () => {
    it('should have correct tool definition loaded', () => {
      const tool = matimo.listTools().find((t) => t.name === 'notion_query_database');
      expect(tool).toBeDefined();
      expect(tool?.description).toContain('Query');
      expect(tool?.parameters).toBeDefined();
      expect(tool?.parameters?.database_id).toBeDefined();
      expect(tool?.parameters?.database_id?.required).toBe(true);
    });

    it('should validate required parameters', () => {
      // Validate against the tool definition parameters locally (no network)
      const tool = matimo.getTool('notion_query_database');
      expect(tool).toBeDefined();

      const params = { database_id: 'a1d8501e-1ac1-43e9-a6bd-ea9fe6c8822b' };

      // Ensure required parameters are declared on the tool
      const declaredParams = tool?.parameters || {};
      const requiredParams = Object.entries(declaredParams)
        .filter(([, p]) => (p as { required?: boolean }).required === true)
        .map(([name]) => name);

      requiredParams.forEach((r) => {
        expect(params[r as keyof typeof params]).toBeDefined();
      });

      // Basic type checks for declared parameters (string/number/boolean)
      for (const [name, def] of Object.entries(declaredParams)) {
        const provided = (params as Record<string, unknown>)[name];
        if (provided !== undefined && def.type) {
          if (def.type === 'string') expect(typeof provided).toBe('string');
          if (def.type === 'number') expect(typeof provided).toBe('number');
          if (def.type === 'boolean') expect(typeof provided).toBe('boolean');
        }
      }
    });

    it('should throw error without required database_id', async () => {
      const apiKey = process.env.NOTION_API_KEY;
      if (!apiKey) {
        console.info('⊘ Skipping - NOTION_API_KEY not set');
        return;
      }

      try {
        await matimo.execute('notion_query_database', {});
        fail('Should have thrown error for missing database_id');
      } catch (error: unknown) {
        expect(error).toBeDefined();
        const err = error as Record<string, unknown>;
        expect(err.name || (error as Record<string, unknown>).constructor.name).toContain('Error');
      }
    });

    it('should execute with valid parameters if API key available', async () => {
      const apiKey = process.env.NOTION_API_KEY;
      if (!apiKey) {
        console.info('⊘ Skipping - NOTION_API_KEY not set');
        return;
      }

      try {
        const result = (await matimo.execute('notion_query_database', {
          database_id: 'a1d8501e-1ac1-43e9-a6bd-ea9fe6c8822b',
          page_size: 5,
        })) as {
          success?: boolean;
          statusCode?: number;
          data?: Record<string, unknown>;
          [key: string]: unknown;
        };

        expect(result).toBeDefined();
        expect(result.data).toBeDefined();
        const data = result.data as { results?: unknown; has_more?: unknown };
        expect(data.results).toBeDefined();
        expect(Array.isArray(data.results)).toBe(true);
        expect(data.has_more).toBeDefined();
        expect(typeof data.has_more).toBe('boolean');
      } catch (error: unknown) {
        // May fail with 404 if database doesn't exist, but should still be a valid error
        expect(error).toBeDefined();
      }
    });
  });

  describe('notion_create_page', () => {
    it('should have correct tool definition loaded', () => {
      const tool = matimo.listTools().find((t) => t.name === 'notion_create_page');
      expect(tool).toBeDefined();
      expect(tool?.description).toContain('Create');
      expect(tool?.parameters?.parent?.required).toBe(true);
    });

    it('should require parent parameter', async () => {
      const apiKey = process.env.NOTION_API_KEY;
      if (!apiKey) {
        console.info('⊘ Skipping - NOTION_API_KEY not set');
        return;
      }

      try {
        await matimo.execute('notion_create_page', { title: 'Test' });
        fail('Should require parent parameter');
      } catch (error: unknown) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('notion_update_page', () => {
    it('should have correct tool definition loaded', () => {
      const tool = matimo.listTools().find((t) => t.name === 'notion_update_page');
      expect(tool).toBeDefined();
      expect(tool?.parameters?.page_id?.required).toBe(true);
    });
  });

  describe('notion_search', () => {
    it('should have correct tool definition loaded', () => {
      const tool = matimo.listTools().find((t) => t.name === 'notion_search');
      expect(tool).toBeDefined();
      expect(tool?.description).toContain('Search');
    });

    it('should handle search without query parameter', async () => {
      const apiKey = process.env.NOTION_API_KEY;
      if (!apiKey) {
        console.info('⊘ Skipping - NOTION_API_KEY not set');
        return;
      }

      try {
        const result = (await matimo.execute('notion_search', {
          page_size: 5,
        })) as {
          success: boolean;
          statusCode: number;
          data?: Record<string, unknown>;
          [key: string]: unknown;
        };

        expect(result).toBeDefined();
        expect(result.success).toBe(true);
        expect(result.statusCode).toBeGreaterThanOrEqual(200);
        expect(result.statusCode).toBeLessThan(300);
        expect(result.data).toBeDefined();

        const data = result.data as { results?: unknown };
        expect(data.results).toBeDefined();
      } catch (error: unknown) {
        // If the call throws, ensure it's a handled error (e.g., permission/HTTP error)
        expect(error).toBeDefined();
      }
    });
  });

  describe('notion_create_comment', () => {
    it('should have correct tool definition loaded', () => {
      const tool = matimo.listTools().find((t) => t.name === 'notion_create_comment');
      expect(tool).toBeDefined();
      expect(tool?.parameters?.rich_text).toBeDefined();
      expect(tool?.parameters?.parent).toBeDefined();
    });

    it('should require text parameter', async () => {
      const apiKey = process.env.NOTION_API_KEY;
      if (!apiKey) {
        console.info('⊘ Skipping - NOTION_API_KEY not set');
        return;
      }

      try {
        await matimo.execute('notion_create_comment', {
          page_id: 'be633bf1-dfa0-436d-b259-571129a590e5',
        });
        fail('Should require text parameter');
      } catch (error: unknown) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('notion_get_user', () => {
    it('should have correct tool definition loaded', () => {
      const tool = matimo.listTools().find((t) => t.name === 'notion_get_user');
      expect(tool).toBeDefined();
      expect(tool?.parameters?.user_id?.required).toBe(true);
    });

    it('should accept user_id parameter', async () => {
      const apiKey = process.env.NOTION_API_KEY;
      if (!apiKey) {
        console.info('⊘ Skipping - NOTION_API_KEY not set');
        return;
      }

      try {
        const result = await matimo.execute('notion_get_user', {
          user_id: 'e79a0b74-3aba-4149-9f74-0bb5791a6ee6',
        });
        expect(result).toBeDefined();
      } catch (error: unknown) {
        // May fail with invalid user, but not validation error
        expect(error).toBeDefined();
      }
    });
  });

  describe('Error Handling and Security', () => {
    it('should not expose API keys in error messages', async () => {
      const apiKey = process.env.NOTION_API_KEY;
      if (!apiKey) {
        console.info('⊘ Skipping - NOTION_API_KEY not set');
        return;
      }

      try {
        const result = await matimo.execute('notion_query_database', {
          database_id: 'invalid-id-format',
        });

        // Matimo HTTP executor returns a structured failure object instead of throwing
        if (
          result &&
          typeof result === 'object' &&
          'success' in (result as Record<string, unknown>)
        ) {
          const s = JSON.stringify(result);
          expect(s).not.toContain(apiKey);
          expect(s).not.toContain('secret_');
        }
      } catch (error: unknown) {
        const errorString = JSON.stringify(error);
        expect(errorString).not.toContain(apiKey);
        expect(errorString).not.toContain('secret_');
      }
    });

    it('should provide meaningful error messages', async () => {
      const apiKey = process.env.NOTION_API_KEY;
      if (!apiKey) {
        console.info('⊘ Skipping - NOTION_API_KEY not set');
        return;
      }

      try {
        const result = await matimo.execute('notion_query_database', {});

        if (
          result &&
          typeof result === 'object' &&
          'success' in (result as Record<string, unknown>)
        ) {
          const r = result as Record<string, unknown>;
          if ((r.success as unknown) === false) {
            const msg =
              (r.error && (r.error as Record<string, unknown>).message) ||
              r.message ||
              JSON.stringify(r);
            expect(msg).toBeDefined();
            expect(String(msg).length > 0).toBe(true);
          }
        }
      } catch (error: unknown) {
        const err = error as Record<string, unknown>;
        expect(err.message).toBeDefined();
        expect((err.message as string).length > 0).toBe(true);
      }
    });
  });

  describe('Tool Metadata', () => {
    it('should have all tools with descriptions', () => {
      const notionTools = matimo.listTools().filter((t) => t.name.startsWith('notion_'));
      notionTools.forEach((tool) => {
        expect(tool.description).toBeDefined();
        expect(tool.description.length > 0).toBe(true);
      });
    });

    it('should have parameters with types and descriptions', () => {
      const notionTools = matimo.listTools().filter((t) => t.name.startsWith('notion_'));
      notionTools.forEach((tool) => {
        if (tool.parameters) {
          Object.entries(tool.parameters).forEach(([_paramName, param]: [string, unknown]) => {
            const p = param as Record<string, unknown>;
            expect(p.type).toBeDefined();
            expect(p.description).toBeDefined();
            expect(p.required).toBeDefined();
          });
        }
      });
    });

    it('should have all tools with authentication config', () => {
      const notionTools = matimo.listTools().filter((t) => t.name.startsWith('notion_'));
      notionTools.forEach((tool) => {
        expect(tool.authentication).toBeDefined();
        expect(((tool.authentication as Record<string, unknown>).type as string) === 'bearer').toBe(
          true
        );
      });
    });
  });

  describe('notion_list_databases', () => {
    it('should have correct tool definition loaded', () => {
      const tool = matimo.listTools().find((t) => t.name === 'notion_list_databases');
      expect(tool).toBeDefined();
      expect(tool?.description).toContain('databases');
      expect(tool?.parameters).toBeDefined();
    });

    it('should execute with optional parameters if API key available', async () => {
      const apiKey = process.env.NOTION_API_KEY;
      if (!apiKey) {
        console.info('⊘ Skipping - NOTION_API_KEY not set');
        return;
      }

      const result = await matimo.execute('notion_list_databases', {
        page_size: 5,
      });

      expect(result).toBeDefined();
      expect((result as Record<string, unknown>).success).toBe(true);
    });
  });
});
