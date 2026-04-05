import { DefaultPolicyEngine } from '../../../src/policy/default-policy';
import type { ToolDefinition } from '../../../src/core/schema';
// Policy types used indirectly via PolicyEngine configuration

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

describe('DefaultPolicyEngine — HITL Quarantine', () => {
  describe('canCreate with enableHITL=false (default)', () => {
    let engine: DefaultPolicyEngine;

    beforeEach(() => {
      engine = new DefaultPolicyEngine();
    });

    it('should block medium-risk tools in production (backward compat)', () => {
      const tool = makeTool({
        execution: { type: 'http', method: 'POST', url: 'https://api.example.com' },
        requires_approval: true,
      });
      const result = engine.canCreate({ environment: 'prod' }, tool);
      expect(result.allowed).toBe(false);
    });

    it('should return reason mentioning production when denied', () => {
      const tool = makeTool({
        execution: { type: 'http', method: 'POST', url: 'https://api.example.com' },
        requires_approval: true,
      });
      const result = engine.canCreate({ environment: 'prod' }, tool);
      expect(result.allowed).toBe(false);
      if (result.allowed === false) {
        expect(result.reason).toContain('production');
      }
    });

    it('should have enableHITL=false by default in config', () => {
      const config = engine.getConfig();
      expect(config.enableHITL).toBe(false);
    });

    it('should have quarantineRiskLevels=["medium"] by default', () => {
      const config = engine.getConfig();
      expect(config.quarantineRiskLevels).toEqual(['medium']);
    });
  });

  describe('canCreate with enableHITL=true', () => {
    let engine: DefaultPolicyEngine;

    beforeEach(() => {
      // Note: requires_approval=true (required by content validator for untrusted tools)
      // escalates risk to 'high' via classifyRisk(), so quarantineRiskLevels
      // must include 'high' to actually quarantine rather than block.
      engine = new DefaultPolicyEngine({
        enableHITL: true,
        quarantineRiskLevels: ['medium', 'high'],
      });
    });

    it('should quarantine high-risk tools in production when HITL enabled', () => {
      // POST + requires_approval=true → classifyRisk returns 'high'
      const tool = makeTool({
        execution: { type: 'http', method: 'POST', url: 'https://api.example.com' },
        requires_approval: true,
      });
      const result = engine.canCreate({ environment: 'prod' }, tool);
      expect(result.allowed).toBe('pending_approval');
    });

    it('should include riskLevel and reason in pending_approval decision', () => {
      const tool = makeTool({
        execution: { type: 'http', method: 'POST', url: 'https://api.example.com' },
        requires_approval: true,
      });
      const result = engine.canCreate({ environment: 'prod' }, tool);
      expect(result.allowed).toBe('pending_approval');
      if (result.allowed === 'pending_approval') {
        expect(result.riskLevel).toBe('high');
        expect(result.reason).toContain('human approval');
        expect(result.toolName).toBe('test-tool');
      }
    });

    it('should block risk levels NOT in quarantineRiskLevels', () => {
      // Use quarantineRiskLevels=['medium'] only — high-risk tools should still be blocked
      const restrictiveEngine = new DefaultPolicyEngine({
        enableHITL: true,
        quarantineRiskLevels: ['medium'],
      });
      const tool = makeTool({
        execution: { type: 'http', method: 'DELETE', url: 'https://api.example.com' },
        requires_approval: true,
      });
      const result = restrictiveEngine.canCreate({ environment: 'prod' }, tool);
      // DELETE + requires_approval=true → high risk, not in ['medium']
      expect(result.allowed).toBe(false);
    });

    it('should quarantine GET tools with requires_approval in production', () => {
      // GET + requires_approval=true → classifyRisk returns 'high'
      const tool = makeTool({
        execution: { type: 'http', method: 'GET', url: 'https://api.example.com/data' },
        requires_approval: true,
      });
      const result = engine.canCreate({ environment: 'prod' }, tool);
      expect(result.allowed).toBe('pending_approval');
    });

    it('should allow tools in dev environment (no quarantine)', () => {
      const tool = makeTool({
        execution: { type: 'http', method: 'POST', url: 'https://api.example.com' },
        requires_approval: true,
      });
      const result = engine.canCreate({ environment: 'dev' }, tool);
      expect(result.allowed).toBe(true);
    });

    it('should still deny TIER 3 blocked tools (reserved namespace)', () => {
      const tool = makeTool({
        name: 'matimo_internal',
        execution: { type: 'http', method: 'GET', url: 'https://api.example.com' },
        requires_approval: true,
      });
      const result = engine.canCreate({ environment: 'prod' }, tool);
      expect(result.allowed).toBe(false);
      if (result.allowed === false) {
        expect(result.reason).toContain('reserved-namespace');
      }
    });

    it('should still deny SSRF targets even with HITL', () => {
      const tool = makeTool({
        execution: { type: 'http', method: 'GET', url: 'http://169.254.169.254/latest' },
        requires_approval: true,
      });
      const result = engine.canCreate({ environment: 'prod' }, tool);
      expect(result.allowed).toBe(false);
    });

    it('should still deny function execution type even with HITL', () => {
      const tool = makeTool({
        execution: { type: 'function', code: './fn.ts' },
        requires_approval: true,
      });
      const result = engine.canCreate({}, tool);
      expect(result.allowed).toBe(false);
    });

    it('should still deny command execution type even with HITL', () => {
      const tool = makeTool({
        execution: { type: 'command', command: 'rm -rf /' },
        requires_approval: true,
      });
      const result = engine.canCreate({}, tool);
      expect(result.allowed).toBe(false);
    });
  });

  describe('custom quarantineRiskLevels', () => {
    it('should quarantine high-risk tools when high is in quarantineRiskLevels', () => {
      const engine = new DefaultPolicyEngine({
        enableHITL: true,
        quarantineRiskLevels: ['high'],
        allowedHttpMethods: ['GET', 'POST', 'DELETE'],
      });
      const tool = makeTool({
        execution: { type: 'http', method: 'DELETE', url: 'https://api.example.com' },
        requires_approval: true,
      });
      const result = engine.canCreate({ environment: 'prod' }, tool);
      expect(result.allowed).toBe('pending_approval');
      if (result.allowed === 'pending_approval') {
        expect(result.riskLevel).toBe('high');
      }
    });

    it('should block high-risk tools when only medium is in quarantineRiskLevels', () => {
      const engine = new DefaultPolicyEngine({
        enableHITL: true,
        quarantineRiskLevels: ['medium'],
      });
      const tool = makeTool({
        execution: { type: 'http', method: 'DELETE', url: 'https://api.example.com' },
        requires_approval: true,
      });
      // DELETE + requires_approval=true → high risk, not in ['medium']
      const result = engine.canCreate({ environment: 'prod' }, tool);
      expect(result.allowed).toBe(false);
    });

    it('should respect empty quarantineRiskLevels (no quarantine)', () => {
      const engine = new DefaultPolicyEngine({
        enableHITL: true,
        quarantineRiskLevels: [],
      });
      const tool = makeTool({
        execution: { type: 'http', method: 'POST', url: 'https://api.example.com' },
        requires_approval: true,
      });
      const result = engine.canCreate({ environment: 'prod' }, tool);
      // requires_approval=true → high risk, empty quarantineRiskLevels → blocked
      expect(result.allowed).toBe(false);
    });
  });

  describe('updateConfig', () => {
    it('should update config at runtime', () => {
      const engine = new DefaultPolicyEngine();
      expect(engine.getConfig().enableHITL).toBe(false);

      engine.updateConfig({ enableHITL: true });
      expect(engine.getConfig().enableHITL).toBe(true);
    });

    it('should merge with defaults when updating', () => {
      const engine = new DefaultPolicyEngine();
      engine.updateConfig({ enableHITL: true });

      const config = engine.getConfig();
      expect(config.enableHITL).toBe(true);
      // Defaults preserved for unset fields
      expect(config.allowCommandTools).toBe(false);
      expect(config.protectedNamespaces).toEqual(['matimo_']);
      expect(config.quarantineRiskLevels).toEqual(['medium']);
    });

    it('should allow switching from HITL off to HITL on', () => {
      const engine = new DefaultPolicyEngine({ enableHITL: false });
      const tool = makeTool({
        execution: { type: 'http', method: 'POST', url: 'https://api.example.com' },
        requires_approval: true,
      });

      // Before update: blocked (high risk, no HITL)
      const before = engine.canCreate({ environment: 'prod' }, tool);
      expect(before.allowed).toBe(false);

      // Update to enable HITL with high in quarantine levels
      engine.updateConfig({ enableHITL: true, quarantineRiskLevels: ['high'] });

      // After update: quarantined (high risk now in quarantineRiskLevels)
      const after = engine.canCreate({ environment: 'prod' }, tool);
      expect(after.allowed).toBe('pending_approval');
    });

    it('should allow updating quarantineRiskLevels at runtime', () => {
      const engine = new DefaultPolicyEngine({
        enableHITL: true,
        quarantineRiskLevels: ['medium'],
      });
      const highRiskTool = makeTool({
        execution: { type: 'http', method: 'DELETE', url: 'https://api.example.com' },
        requires_approval: true,
      });

      // Before: high-risk blocked (not in quarantineRiskLevels ['medium'])
      expect(engine.canCreate({ environment: 'prod' }, highRiskTool).allowed).toBe(false);

      // Update to include high in quarantine levels + allow DELETE
      engine.updateConfig({
        enableHITL: true,
        quarantineRiskLevels: ['medium', 'high'],
        allowedHttpMethods: ['GET', 'POST', 'DELETE'],
      });

      // After: high-risk quarantined
      expect(engine.canCreate({ environment: 'prod' }, highRiskTool).allowed).toBe(
        'pending_approval'
      );
    });

    it('should allow updating allowedDomains', () => {
      const engine = new DefaultPolicyEngine();
      engine.updateConfig({ allowedDomains: ['api.slack.com'] });
      expect(engine.getConfig().allowedDomains).toEqual(['api.slack.com']);
    });
  });

  describe('PolicyDecision type discriminants', () => {
    it('pending_approval has required fields', () => {
      const engine = new DefaultPolicyEngine({
        enableHITL: true,
        quarantineRiskLevels: ['high'],
      });
      const tool = makeTool({
        name: 'my-post-tool',
        execution: { type: 'http', method: 'POST', url: 'https://api.example.com' },
        requires_approval: true,
      });
      const decision = engine.canCreate({ environment: 'prod' }, tool);
      expect(decision.allowed).toBe('pending_approval');
      if (decision.allowed === 'pending_approval') {
        expect(decision.reason).toBeDefined();
        expect(decision.riskLevel).toBeDefined();
        expect(decision.toolName).toBe('my-post-tool');
      }
    });

    it('allowed: true decision shape', () => {
      const engine = new DefaultPolicyEngine();
      const tool = makeTool({
        execution: { type: 'http', method: 'GET', url: 'https://api.example.com' },
        requires_approval: true,
      });
      const decision = engine.canCreate({}, tool);
      expect(decision).toEqual({ allowed: true });
    });

    it('allowed: false decision includes reason', () => {
      const engine = new DefaultPolicyEngine();
      const tool = makeTool({
        name: 'matimo_admin',
        execution: { type: 'http', method: 'GET', url: 'https://api.example.com' },
        requires_approval: true,
      });
      const decision = engine.canCreate({}, tool);
      expect(decision.allowed).toBe(false);
      if (decision.allowed === false) {
        expect(decision.reason).toBeTruthy();
      }
    });
  });
});
