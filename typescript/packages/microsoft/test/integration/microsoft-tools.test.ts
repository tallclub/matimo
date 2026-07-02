/**
 * Integration test suite for Microsoft Graph tools
 * Tests end-to-end loading and metadata using MatimoInstance (production-grade)
 *
 * Live executions are gated behind MICROSOFT_GRAPH_ACCESS_TOKEN — without it they're
 * skipped (mirrors the notion/postgres integration suites, which gate on their own
 * provider credentials rather than mocking axios at the dynamic-import boundary).
 */

import { MatimoInstance } from '../../../core/src/matimo-instance';
import path from 'path';

/**
 * `risk` is part of the validated YAML schema but not the public ToolDefinition
 * interface returned by MatimoInstance — read it off the underlying parsed object.
 */
function riskOf(tool: unknown): string | undefined {
  return (tool as { risk?: string } | undefined)?.risk;
}

const TOOL_NAMES = [
  'ms_search_knowledge',
  'ms_read_file',
  'ms_list_files',
  'ms_get_email',
  'ms_send_email',
  'ms_send_teams_message',
  'ms_create_document',
  'ms_create_calendar_event',
  'ms_publish_to_sharepoint',
];

describe('Microsoft Graph Tools Integration', () => {
  let matimo: MatimoInstance;
  const toolsPath = path.join(__dirname, '../../tools');

  beforeAll(async () => {
    process.env.MICROSOFT_GRAPH_ACCESS_TOKEN =
      process.env.MICROSOFT_GRAPH_ACCESS_TOKEN || 'mock-graph-token';
    matimo = await MatimoInstance.init(toolsPath);
  });

  afterAll(() => {
    delete process.env.MICROSOFT_GRAPH_ACCESS_TOKEN;
  });

  describe('Tool Loading & Availability', () => {
    it('should load all 9 Microsoft Graph tools via MatimoInstance', () => {
      const tools = matimo.listTools();
      const msTools = tools.filter((tool) => tool.name.startsWith('ms_'));

      expect(msTools).toHaveLength(9);
      expect(msTools.map((t) => t.name).sort()).toEqual([...TOOL_NAMES].sort());
    });

    it('should have correct tool metadata', () => {
      const tools = matimo.listTools();
      const sendEmailTool = tools.find((t) => t.name === 'ms_send_email');

      expect(sendEmailTool).toBeDefined();
      expect(sendEmailTool?.description).toContain('email');
    });

    it('should filter Microsoft tools via search', () => {
      const msTools = matimo.searchTools('microsoft');
      expect(msTools.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Authentication', () => {
    it('should use oauth2 authentication for every Microsoft Graph tool', () => {
      const tools = matimo.listTools();
      const msTools = tools.filter((tool) => tool.name.startsWith('ms_'));

      expect(msTools.length).toBeGreaterThan(0);
      msTools.forEach((tool) => {
        expect(tool.authentication?.type).toBe('oauth2');
      });
    });
  });

  describe('Risk & Approval Metadata', () => {
    it('marks ms_send_email and ms_publish_to_sharepoint as high-risk + requires_approval', () => {
      const highRisk = ['ms_send_email', 'ms_publish_to_sharepoint'];
      highRisk.forEach((name) => {
        const tool = matimo.getTool(name);
        expect(tool).toBeDefined();
        expect(riskOf(tool)).toBe('high');
        expect(tool?.requires_approval).toBe(true);
      });
    });

    it('does not require approval for the read-only and medium-risk tools', () => {
      const notHighRisk = TOOL_NAMES.filter(
        (name) => name !== 'ms_send_email' && name !== 'ms_publish_to_sharepoint'
      );
      notHighRisk.forEach((name) => {
        const tool = matimo.getTool(name);
        expect(tool).toBeDefined();
        expect(tool?.requires_approval ?? false).toBe(false);
        expect(['low', 'medium']).toContain(riskOf(tool));
      });
    });
  });

  describe('Tool Metadata', () => {
    it('should have all tools with non-empty descriptions', () => {
      const msTools = matimo.listTools().filter((t) => t.name.startsWith('ms_'));
      msTools.forEach((tool) => {
        expect(tool.description).toBeDefined();
        expect(tool.description.length).toBeGreaterThan(0);
      });
    });

    it('should have parameters with types, descriptions, and required flags', () => {
      const msTools = matimo.listTools().filter((t) => t.name.startsWith('ms_'));
      msTools.forEach((tool) => {
        expect(tool.parameters).toBeDefined();
        Object.entries(tool.parameters || {}).forEach(([, param]) => {
          expect(param.type).toBeDefined();
          expect(param.description).toBeDefined();
          expect(typeof param.required).toBe('boolean');
        });
      });
    });

    it('should declare function execution with a co-located executor file', () => {
      const msTools = matimo.listTools().filter((t) => t.name.startsWith('ms_'));
      msTools.forEach((tool) => {
        expect(tool.execution.type).toBe('function');
        if (tool.execution.type === 'function') {
          expect(tool.execution.code).toBe(`${tool.name}.js`);
        }
      });
    });
  });

  describe('ms_search_knowledge', () => {
    it('should have correct tool definition loaded', () => {
      const tool = matimo.getTool('ms_search_knowledge');
      expect(tool).toBeDefined();
      expect(tool?.parameters?.query?.required).toBe(true);
      expect(riskOf(tool)).toBe('low');
    });
  });

  describe('ms_read_file', () => {
    it('should have correct tool definition loaded', () => {
      const tool = matimo.getTool('ms_read_file');
      expect(tool).toBeDefined();
      expect(tool?.parameters?.drive_id?.required).toBe(true);
      expect(tool?.parameters?.item_id?.required).toBe(true);
      expect(riskOf(tool)).toBe('low');
    });
  });

  describe('ms_list_files', () => {
    it('should have correct tool definition loaded', () => {
      const tool = matimo.getTool('ms_list_files');
      expect(tool).toBeDefined();
      expect(tool?.parameters?.drive_id?.required).toBe(true);
      expect(tool?.parameters?.item_id?.required).toBe(false);
    });
  });

  describe('ms_get_email', () => {
    it('should have correct tool definition loaded', () => {
      const tool = matimo.getTool('ms_get_email');
      expect(tool).toBeDefined();
      expect(tool?.description.toLowerCase()).toContain('mail');
      expect(riskOf(tool)).toBe('low');
    });
  });

  describe('ms_send_email', () => {
    it('should have correct tool definition loaded', () => {
      const tool = matimo.getTool('ms_send_email');
      expect(tool).toBeDefined();
      expect(tool?.parameters?.to?.required).toBe(true);
      expect(tool?.parameters?.subject?.required).toBe(true);
      expect(tool?.parameters?.body?.required).toBe(true);
    });

    // Not exercised via matimo.execute(): requires_approval routes through the
    // HITL approval flow before the executor's own validation ever runs — the
    // executor's validation-before-network-call behaviour is covered directly
    // in test/unit/microsoft-tools.test.ts.
  });

  describe('ms_send_teams_message', () => {
    it('should have correct tool definition loaded', () => {
      const tool = matimo.getTool('ms_send_teams_message');
      expect(tool).toBeDefined();
      expect(tool?.parameters?.team_id?.required).toBe(true);
      expect(tool?.parameters?.channel_id?.required).toBe(true);
      expect(tool?.parameters?.text?.required).toBe(true);
      expect(riskOf(tool)).toBe('medium');
    });
  });

  describe('ms_create_document', () => {
    it('should have correct tool definition loaded', () => {
      const tool = matimo.getTool('ms_create_document');
      expect(tool).toBeDefined();
      expect(tool?.parameters?.drive_id?.required).toBe(true);
      expect(tool?.parameters?.filename?.required).toBe(true);
      expect(tool?.parameters?.content?.required).toBe(true);
      expect(riskOf(tool)).toBe('medium');
    });
  });

  describe('ms_create_calendar_event', () => {
    it('should have correct tool definition loaded', () => {
      const tool = matimo.getTool('ms_create_calendar_event');
      expect(tool).toBeDefined();
      expect(tool?.parameters?.subject?.required).toBe(true);
      expect(tool?.parameters?.start?.required).toBe(true);
      expect(tool?.parameters?.end?.required).toBe(true);
      expect(riskOf(tool)).toBe('medium');
    });
  });

  describe('ms_publish_to_sharepoint', () => {
    it('should have correct tool definition loaded', () => {
      const tool = matimo.getTool('ms_publish_to_sharepoint');
      expect(tool).toBeDefined();
      expect(tool?.parameters?.site_id?.required).toBe(true);
      expect(tool?.parameters?.title?.required).toBe(true);
      expect(tool?.parameters?.content?.required).toBe(true);
    });

    // Not exercised via matimo.execute(): requires_approval routes through the
    // HITL approval flow before the executor's own validation ever runs — the
    // executor's validation-before-network-call behaviour is covered directly
    // in test/unit/microsoft-tools.test.ts.
  });

  describe('Error Handling and Security', () => {
    it('should not expose the access token in validation error output', async () => {
      const token = process.env.MICROSOFT_GRAPH_ACCESS_TOKEN as string;
      const result = await matimo.execute('ms_search_knowledge', { query: '' });
      const serialized = JSON.stringify(result);
      expect(serialized).not.toContain(token);
    });
  });
});
