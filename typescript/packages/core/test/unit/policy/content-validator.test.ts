import { validateToolContent, isSSRFTarget } from '../../../src/policy/content-validator';
import type { ToolDefinition } from '../../../src/core/schema';
import type { ValidationContext } from '../../../src/policy/types';

function makeTool(
  overrides: Partial<ToolDefinition> & { execution: ToolDefinition['execution'] }
): ToolDefinition {
  return {
    name: 'test-tool',
    description: 'Test tool',
    version: '1.0.0',
    requires_approval: true,
    ...overrides,
  };
}

function makeContext(overrides?: Partial<ValidationContext>): ValidationContext {
  return {
    source: 'untrusted',
    policy: {
      allowedDomains: [],
      allowedCredentials: [],
      allowedHttpMethods: ['GET', 'POST'],
      allowCommandTools: false,
      allowFunctionTools: false,
      protectedNamespaces: ['matimo_'],
    },
    ...overrides,
  };
}

describe('validateToolContent', () => {
  it('should pass for trusted sources without checks', () => {
    const tool = makeTool({
      execution: { type: 'function', code: './fn.ts' },
      requires_approval: false,
    });
    const result = validateToolContent(tool, { ...makeContext(), source: 'trusted' });
    expect(result.valid).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  describe('no-function-execution', () => {
    it('should block function execution from untrusted sources', () => {
      const tool = makeTool({ execution: { type: 'function', code: './fn.ts' } });
      const result = validateToolContent(tool, makeContext());
      expect(result.valid).toBe(false);
      expect(result.violations).toContainEqual(
        expect.objectContaining({ rule: 'no-function-execution', severity: 'critical' })
      );
    });

    it('should allow function execution when explicitly enabled', () => {
      const tool = makeTool({ execution: { type: 'function', code: './fn.ts' } });
      const ctx = makeContext({ policy: { ...makeContext().policy, allowFunctionTools: true } });
      const result = validateToolContent(tool, ctx);
      const fnViolation = result.violations.find((v) => v.rule === 'no-function-execution');
      expect(fnViolation).toBeUndefined();
    });
  });

  describe('no-command-execution', () => {
    it('should block command execution from untrusted sources', () => {
      const tool = makeTool({ execution: { type: 'command', command: 'rm -rf /' } });
      const result = validateToolContent(tool, makeContext());
      expect(result.violations).toContainEqual(
        expect.objectContaining({ rule: 'no-command-execution', severity: 'critical' })
      );
    });

    it('should allow command execution when explicitly enabled', () => {
      const tool = makeTool({ execution: { type: 'command', command: 'ls' } });
      const ctx = makeContext({ policy: { ...makeContext().policy, allowCommandTools: true } });
      const result = validateToolContent(tool, ctx);
      const cmdViolation = result.violations.find((v) => v.rule === 'no-command-execution');
      expect(cmdViolation).toBeUndefined();
    });
  });

  describe('no-ssrf', () => {
    it('should block localhost URLs', () => {
      const tool = makeTool({
        execution: { type: 'http', method: 'GET', url: 'http://localhost:8080/secret' },
      });
      const result = validateToolContent(tool, makeContext());
      expect(result.violations).toContainEqual(
        expect.objectContaining({ rule: 'no-ssrf', severity: 'critical' })
      );
    });

    it('should block cloud metadata URLs', () => {
      const tool = makeTool({
        execution: { type: 'http', method: 'GET', url: 'http://169.254.169.254/latest/meta-data' },
      });
      const result = validateToolContent(tool, makeContext());
      expect(result.violations).toContainEqual(expect.objectContaining({ rule: 'no-ssrf' }));
    });

    it('should allow public URLs', () => {
      const tool = makeTool({
        execution: { type: 'http', method: 'GET', url: 'https://api.example.com/data' },
      });
      const result = validateToolContent(tool, makeContext());
      const ssrfViolation = result.violations.find((v) => v.rule === 'no-ssrf');
      expect(ssrfViolation).toBeUndefined();
    });
  });

  describe('reserved-namespace', () => {
    it('should block tools with matimo_ prefix', () => {
      const tool = makeTool({
        name: 'matimo_admin',
        execution: { type: 'http', method: 'GET', url: 'https://api.example.com' },
      });
      const result = validateToolContent(tool, makeContext());
      expect(result.violations).toContainEqual(
        expect.objectContaining({ rule: 'reserved-namespace', severity: 'critical' })
      );
    });

    it('should allow non-reserved names', () => {
      const tool = makeTool({
        name: 'my_custom_tool',
        execution: { type: 'http', method: 'GET', url: 'https://api.example.com' },
      });
      const result = validateToolContent(tool, makeContext());
      const nsViolation = result.violations.find((v) => v.rule === 'reserved-namespace');
      expect(nsViolation).toBeUndefined();
    });
  });

  describe('forced-approval', () => {
    it('should flag tools without requires_approval', () => {
      const tool = makeTool({
        execution: { type: 'http', method: 'GET', url: 'https://api.example.com' },
        requires_approval: false,
      });
      const result = validateToolContent(tool, makeContext());
      expect(result.violations).toContainEqual(
        expect.objectContaining({ rule: 'forced-approval', severity: 'high' })
      );
    });

    it('should pass tools with requires_approval: true', () => {
      const tool = makeTool({
        execution: { type: 'http', method: 'GET', url: 'https://api.example.com' },
        requires_approval: true,
      });
      const result = validateToolContent(tool, makeContext());
      const approvalViolation = result.violations.find((v) => v.rule === 'forced-approval');
      expect(approvalViolation).toBeUndefined();
    });
  });

  describe('blocked-http-method', () => {
    it('should block DELETE when not in allowed list', () => {
      const tool = makeTool({
        execution: { type: 'http', method: 'DELETE', url: 'https://api.example.com/item' },
      });
      const result = validateToolContent(tool, makeContext());
      expect(result.violations).toContainEqual(
        expect.objectContaining({ rule: 'blocked-http-method', severity: 'high' })
      );
    });

    it('should allow GET and POST by default', () => {
      const toolGet = makeTool({
        execution: { type: 'http', method: 'GET', url: 'https://api.example.com' },
      });
      const toolPost = makeTool({
        execution: { type: 'http', method: 'POST', url: 'https://api.example.com' },
      });
      const ctx = makeContext();
      expect(
        validateToolContent(toolGet, ctx).violations.find((v) => v.rule === 'blocked-http-method')
      ).toBeUndefined();
      expect(
        validateToolContent(toolPost, ctx).violations.find((v) => v.rule === 'blocked-http-method')
      ).toBeUndefined();
    });
  });

  describe('blocked-domain', () => {
    it('should block domains not in allowlist when configured', () => {
      const tool = makeTool({
        execution: { type: 'http', method: 'GET', url: 'https://evil.com/data' },
      });
      const ctx = makeContext({
        policy: { ...makeContext().policy, allowedDomains: ['api.example.com'] },
      });
      const result = validateToolContent(tool, ctx);
      expect(result.violations).toContainEqual(
        expect.objectContaining({ rule: 'blocked-domain', severity: 'high' })
      );
    });

    it('should allow domains matching allowlist', () => {
      const tool = makeTool({
        execution: { type: 'http', method: 'GET', url: 'https://api.example.com/data' },
      });
      const ctx = makeContext({
        policy: { ...makeContext().policy, allowedDomains: ['api.example.com'] },
      });
      const result = validateToolContent(tool, ctx);
      const domainViolation = result.violations.find((v) => v.rule === 'blocked-domain');
      expect(domainViolation).toBeUndefined();
    });

    it('should allow subdomains of allowlisted domains', () => {
      const tool = makeTool({
        execution: { type: 'http', method: 'GET', url: 'https://sub.example.com/data' },
      });
      const ctx = makeContext({
        policy: { ...makeContext().policy, allowedDomains: ['example.com'] },
      });
      const result = validateToolContent(tool, ctx);
      const domainViolation = result.violations.find((v) => v.rule === 'blocked-domain');
      expect(domainViolation).toBeUndefined();
    });

    it('should skip blocked-domain check when URL cannot be parsed', () => {
      const tool = makeTool({
        execution: { type: 'http', method: 'GET', url: 'not-a-valid-url' },
      });
      const ctx = makeContext({
        policy: { ...makeContext().policy, allowedDomains: ['api.example.com'] },
      });
      const result = validateToolContent(tool, ctx);
      const domainViolation = result.violations.find((v) => v.rule === 'blocked-domain');
      expect(domainViolation).toBeUndefined();
    });
  });

  describe('unauthorized-credential', () => {
    it('should flag credentials not present in allowlist', () => {
      const tool = makeTool({
        execution: {
          type: 'http',
          method: 'GET',
          url: 'https://api.example.com/data',
          headers: {
            Authorization: 'Bearer {SECRET_TOKEN}',
          },
        },
      });
      const ctx = makeContext({
        policy: { ...makeContext().policy, allowedCredentials: ['SAFE_TOKEN'] },
      });
      const result = validateToolContent(tool, ctx);
      expect(result.violations).toContainEqual(
        expect.objectContaining({ rule: 'unauthorized-credential', severity: 'high' })
      );
    });

    it('should allow credentials present in allowlist', () => {
      const tool = makeTool({
        execution: {
          type: 'http',
          method: 'GET',
          url: 'https://api.example.com/data',
          headers: {
            Authorization: 'Bearer {SAFE_TOKEN}',
          },
        },
      });
      const ctx = makeContext({
        policy: { ...makeContext().policy, allowedCredentials: ['SAFE_TOKEN'] },
      });
      const result = validateToolContent(tool, ctx);
      const credentialViolation = result.violations.find(
        (v) => v.rule === 'unauthorized-credential'
      );
      expect(credentialViolation).toBeUndefined();
    });
  });

  describe('forced-draft-status', () => {
    it('should flag tools with non-draft status', () => {
      const tool = makeTool({
        execution: { type: 'http', method: 'GET', url: 'https://api.example.com' },
      });
      tool.status = 'approved';
      const result = validateToolContent(tool, makeContext());
      expect(result.violations).toContainEqual(
        expect.objectContaining({ rule: 'forced-draft-status', severity: 'medium' })
      );
    });

    it('should pass tools with draft status', () => {
      const tool = makeTool({
        execution: { type: 'http', method: 'GET', url: 'https://api.example.com' },
      });
      tool.status = 'draft';
      const result = validateToolContent(tool, makeContext());
      const statusViolation = result.violations.find((v) => v.rule === 'forced-draft-status');
      expect(statusViolation).toBeUndefined();
    });
  });

  it('should accumulate multiple violations', () => {
    const tool = makeTool({
      name: 'matimo_evil',
      execution: { type: 'function', code: './evil.ts' },
      requires_approval: false,
    });
    const result = validateToolContent(tool, makeContext());
    expect(result.valid).toBe(false);
    expect(result.violations.length).toBeGreaterThanOrEqual(3);
  });
});

describe('isSSRFTarget', () => {
  it.each([
    'http://localhost/api',
    'http://127.0.0.1/api',
    'http://0.0.0.0/api',
    'http://[::1]/api',
    'http://169.254.169.254/latest/meta-data',
    'http://169.254.1.1/data',
    'http://10.0.0.1/internal',
    'http://192.168.1.1/admin',
    'http://172.16.0.1/data',
    'http://172.31.255.255/data',
    'http://service.internal/api',
    'http://service.local/api',
    'http://sub.localhost/api',
  ])('should detect SSRF target: %s', (url) => {
    expect(isSSRFTarget(url)).toBe(true);
  });

  it.each([
    'https://api.example.com/data',
    'https://slack.com/api/chat.postMessage',
    'https://172.15.0.1/ok',
    'https://172.32.0.1/ok',
  ])('should allow safe URL: %s', (url) => {
    expect(isSSRFTarget(url)).toBe(false);
  });

  it('should handle URLs with template placeholders', () => {
    expect(isSSRFTarget('https://{host}/api/{path}')).toBe(false);
  });

  it('should allow unparseable URLs with only placeholders', () => {
    expect(isSSRFTarget('{base_url}/{path}')).toBe(false);
  });
});
