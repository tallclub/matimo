import { DefaultPolicyEngine } from '../../../src/policy/default-policy';
import type { ToolDefinition } from '../../../src/core/schema';

function makeTool(
  overrides: Partial<ToolDefinition> & { execution: ToolDefinition['execution'] }
): ToolDefinition {
  return {
    name: 'test-tool',
    description: 'Test tool',
    version: '1.0.0',
    ...overrides,
  };
}

describe('DefaultPolicyEngine', () => {
  let engine: DefaultPolicyEngine;

  beforeEach(() => {
    engine = new DefaultPolicyEngine();
  });

  describe('canCreate', () => {
    it('should deny function tools from untrusted sources', () => {
      const tool = makeTool({
        execution: { type: 'function', code: './fn.ts' },
        requires_approval: true,
      });
      const result = engine.canCreate({}, tool);
      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        expect(result.reason).toContain('no-function-execution');
      }
    });

    it('should deny command tools from untrusted sources', () => {
      const tool = makeTool({
        execution: { type: 'command', command: 'echo hello' },
        requires_approval: true,
      });
      const result = engine.canCreate({}, tool);
      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        expect(result.reason).toContain('no-command-execution');
      }
    });

    it('should allow safe HTTP GET tools', () => {
      const tool = makeTool({
        execution: { type: 'http', method: 'GET', url: 'https://api.example.com/data' },
        requires_approval: true,
      });
      const result = engine.canCreate({}, tool);
      expect(result.allowed).toBe(true);
    });

    it('should deny medium+ risk tools in production', () => {
      const tool = makeTool({
        execution: { type: 'http', method: 'POST', url: 'https://api.example.com' },
        requires_approval: true,
      });
      const result = engine.canCreate({ environment: 'prod' }, tool);
      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        expect(result.reason).toContain('production');
      }
    });

    it('should deny tools missing requires_approval', () => {
      const tool = makeTool({
        execution: { type: 'http', method: 'GET', url: 'https://api.example.com' },
        requires_approval: false,
      });
      const result = engine.canCreate({}, tool);
      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        expect(result.reason).toContain('forced-approval');
      }
    });

    it('should deny SSRF targets', () => {
      const tool = makeTool({
        execution: { type: 'http', method: 'GET', url: 'http://169.254.169.254/latest' },
        requires_approval: true,
      });
      const result = engine.canCreate({}, tool);
      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        expect(result.reason).toContain('no-ssrf');
      }
    });

    it('should deny reserved namespace tools', () => {
      const tool = makeTool({
        name: 'matimo_admin',
        execution: { type: 'http', method: 'GET', url: 'https://api.example.com' },
        requires_approval: true,
      });
      const result = engine.canCreate({}, tool);
      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        expect(result.reason).toContain('reserved-namespace');
      }
    });
  });

  describe('canExecute', () => {
    it('should allow normal tools', () => {
      const tool = makeTool({
        execution: { type: 'http', method: 'GET', url: 'https://api.example.com' },
      });
      const result = engine.canExecute({}, tool);
      expect(result.allowed).toBe(true);
    });

    it('should deny deprecated tools', () => {
      const tool = makeTool({
        execution: { type: 'http', method: 'GET', url: 'https://api.example.com' },
        deprecated: true,
      });
      const result = engine.canExecute({}, tool);
      expect(result.allowed).toBe(false);
    });

    it('should deny deprecated tools with status field', () => {
      const tool = makeTool({
        execution: { type: 'http', method: 'GET', url: 'https://api.example.com' },
      });
      tool.status = 'deprecated';
      const result = engine.canExecute({}, tool);
      expect(result.allowed).toBe(false);
    });

    it('should deny draft tools in production', () => {
      const tool = makeTool({
        execution: { type: 'http', method: 'GET', url: 'https://api.example.com' },
      });
      tool.status = 'draft';
      const result = engine.canExecute({ environment: 'prod' }, tool);
      expect(result.allowed).toBe(false);
    });

    it('should deny draft tools without admin role', () => {
      const tool = makeTool({
        execution: { type: 'http', method: 'GET', url: 'https://api.example.com' },
      });
      tool.status = 'draft';
      const result = engine.canExecute({ roles: ['reader'] }, tool);
      expect(result.allowed).toBe(false);
    });

    it('should allow draft tools for admin users', () => {
      const tool = makeTool({
        execution: { type: 'http', method: 'GET', url: 'https://api.example.com' },
      });
      tool.status = 'draft';
      const result = engine.canExecute({ roles: ['admin'] }, tool);
      expect(result.allowed).toBe(true);
    });

    it('should deny approval-required tools in prod without admin/operator role', () => {
      const tool = makeTool({
        execution: { type: 'http', method: 'POST', url: 'https://api.example.com' },
        requires_approval: true,
      });
      const result = engine.canExecute({ environment: 'prod', roles: ['reader'] }, tool);
      expect(result.allowed).toBe(false);
    });

    it('should allow approval-required tools in prod with operator role', () => {
      const tool = makeTool({
        execution: { type: 'http', method: 'POST', url: 'https://api.example.com' },
        requires_approval: true,
      });
      const result = engine.canExecute({ environment: 'prod', roles: ['operator'] }, tool);
      expect(result.allowed).toBe(true);
    });

    it('should use deprecation_message when available', () => {
      const tool = makeTool({
        execution: { type: 'http', method: 'GET', url: 'https://api.example.com' },
        deprecated: true,
        deprecation_message: 'Use v2 instead',
      });
      const result = engine.canExecute({}, tool);
      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        expect(result.reason).toBe('Use v2 instead');
      }
    });
  });

  describe('filterForAgent', () => {
    it('should filter out tools the agent cannot execute', () => {
      const tools = [
        makeTool({
          name: 'allowed',
          execution: { type: 'http', method: 'GET', url: 'https://api.example.com' },
        }),
        makeTool({
          name: 'deprecated',
          execution: { type: 'http', method: 'GET', url: 'https://api.example.com' },
          deprecated: true,
        }),
      ];
      const filtered = engine.filterForAgent({}, tools);
      expect(filtered).toHaveLength(1);
      expect(filtered[0].name).toBe('allowed');
    });

    it('should return empty array when all tools are denied', () => {
      const tools = [
        makeTool({
          name: 'deprecated',
          execution: { type: 'http', method: 'GET', url: 'https://api.example.com' },
          deprecated: true,
        }),
      ];
      const filtered = engine.filterForAgent({}, tools);
      expect(filtered).toHaveLength(0);
    });
  });

  describe('constructor with custom config', () => {
    it('should accept custom allowed domains', () => {
      const customEngine = new DefaultPolicyEngine({
        allowedDomains: ['api.slack.com'],
      });
      const config = customEngine.getConfig();
      expect(config.allowedDomains).toEqual(['api.slack.com']);
    });

    it('should merge with defaults', () => {
      const customEngine = new DefaultPolicyEngine({
        allowCommandTools: true,
      });
      const config = customEngine.getConfig();
      expect(config.allowCommandTools).toBe(true);
      expect(config.allowFunctionTools).toBe(false); // default preserved
      expect(config.protectedNamespaces).toEqual(['matimo_']); // default preserved
    });
  });
});
