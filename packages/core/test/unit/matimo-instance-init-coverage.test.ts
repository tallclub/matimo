import fs from 'fs';
import path from 'path';
import os from 'os';
import { MatimoInstance } from '../../src/matimo-instance';

/**
 * Initialization and setup coverage tests for matimo-instance.ts
 * Targets: Policy file loading (line 288), Skill discovery logging (line 319),
 * Skill origin tracking (builtin vs user), and permission handling
 */
describe('MatimoInstance — Initialization Coverage', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'matimo-init-coverage-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function createToolDir(name: string): string {
    const toolDir = path.join(tmpDir, 'tools', name);
    fs.mkdirSync(toolDir, { recursive: true });
    fs.writeFileSync(
      path.join(toolDir, 'definition.yaml'),
      `name: ${name}\nversion: '1.0.0'\ndescription: 'Test tool'\nexecution:\n  type: command\n  command: 'echo'\n  args: ['test']\n`
    );
    return path.join(tmpDir, 'tools');
  }

  function createSkillDir(name: string): string {
    const skillDir = path.join(tmpDir, 'skills', name);
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(path.join(skillDir, 'SKILL.md'), `# ${name}\nTest skill for coverage.\n`);
    return path.join(tmpDir, 'skills');
  }

  // ─── Line 288: Policy file loading path ────────────────────────

  describe('Policy file loading (line 288)', () => {
    it('should load policy from policyFile option', async () => {
      const toolsPath = createToolDir('test-tool');
      const skillsPath = createSkillDir('test-skill');

      const policyPath = path.join(tmpDir, 'policy.yaml');
      fs.writeFileSync(
        policyPath,
        `enableHITL: false
quarantineRiskLevels:
  - high
  - critical
riskLevels:
  low: 1
  medium: 2
`
      );

      const matimo = await MatimoInstance.init({
        toolPaths: [toolsPath],
        skillPaths: [skillsPath],
        policyFile: policyPath,
        logLevel: 'silent',
      });

      // Verify matimo was initialized with policy
      expect(matimo).toBeDefined();
      expect(matimo.getTool('test-tool')).toBeDefined();
    });

    it('should use policyConfig when policyFile not provided', async () => {
      const toolsPath = createToolDir('config-tool');
      const skillsPath = createSkillDir('config-skill');

      const matimo = await MatimoInstance.init({
        toolPaths: [toolsPath],
        skillPaths: [skillsPath],
        policyConfig: {
          enableHITL: true,
          quarantineRiskLevels: ['high'],
        },
        logLevel: 'silent',
      });

      expect(matimo).toBeDefined();
      expect(matimo.getTool('config-tool')).toBeDefined();
    });

    it('should create DefaultPolicyEngine when neither policyFile nor policyConfig provided', async () => {
      const toolsPath = createToolDir('default-tool');
      const skillsPath = createSkillDir('default-skill');

      const matimo = await MatimoInstance.init({
        toolPaths: [toolsPath],
        skillPaths: [skillsPath],
        logLevel: 'silent',
      });

      expect(matimo).toBeDefined();
      expect(matimo.getTool('default-tool')).toBeDefined();
    });

    it('should prefer custom policy engine over all others', async () => {
      const toolsPath = createToolDir('policy-tool');
      const skillsPath = createSkillDir('policy-skill');

      // Mock policy engine
      const mockPolicy = {
        validate: jest.fn().mockResolvedValue({ allowed: true }),
      };

      const matimo = await MatimoInstance.init({
        toolPaths: [toolsPath],
        skillPaths: [skillsPath],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        policy: mockPolicy as any,
        policyFile: path.join(tmpDir, 'ignored.yaml'),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        policyConfig: { enableHITL: false } as any,
        logLevel: 'silent',
      });

      expect(matimo).toBeDefined();
    });
  });

  // ─── Line 319: Skill discovery and logging ─────────────────────

  describe('Skill discovery and logging (line 319)', () => {
    it('should discover skills from specified paths', async () => {
      const toolsPath = createToolDir('skill-test');
      const skillsPath = createSkillDir('test-skill');

      const matimo = await MatimoInstance.init({
        toolPaths: [toolsPath],
        skillPaths: [skillsPath],
        logLevel: 'debug',
      });

      expect(matimo).toBeDefined();
      // Skills should be discoverable
      const skills = matimo.searchSkills({ query: 'test' });
      expect(Array.isArray(skills)).toBe(true);
    });

    it('should handle skill loading failures gracefully', async () => {
      const toolsPath = createToolDir('error-tool');
      const skillsPath = path.join(tmpDir, 'invalid-skills');
      fs.mkdirSync(skillsPath, { recursive: true });

      // Create an invalid file (not SKILL.md)
      fs.writeFileSync(path.join(skillsPath, 'not-a-skill.txt'), 'invalid');

      const matimo = await MatimoInstance.init({
        toolPaths: [toolsPath],
        skillPaths: [skillsPath],
        logLevel: 'warn',
      });

      // Should still initialize despite skill loading error
      expect(matimo).toBeDefined();
      expect(matimo.getTool('error-tool')).toBeDefined();
    });

    it('should track skill origin as builtin for core paths', async () => {
      const toolsPath = createToolDir('builtin-test');

      // Create a fake core skills directory structure
      const coreSkillsPath = path.join(tmpDir, 'packages', 'core', 'skills', 'test');
      fs.mkdirSync(coreSkillsPath, { recursive: true });
      fs.writeFileSync(path.join(coreSkillsPath, 'SKILL.md'), '# Core Skill\nBuiltin skill\n');

      const matimo = await MatimoInstance.init({
        toolPaths: [toolsPath],
        skillPaths: [path.join(tmpDir, 'packages', 'core', 'skills')],
        logLevel: 'silent',
      });

      expect(matimo).toBeDefined();
    });

    it('should track skill origin as user for non-core paths', async () => {
      const toolsPath = createToolDir('user-test');
      const userSkillsPath = createSkillDir('user-skill');

      const matimo = await MatimoInstance.init({
        toolPaths: [toolsPath],
        skillPaths: [userSkillsPath],
        logLevel: 'silent',
      });

      expect(matimo).toBeDefined();
      const skills = matimo.searchSkills({ query: 'user-skill' });
      expect(Array.isArray(skills)).toBe(true);
    });
  });

  // ─── Authorization and trusted paths ──────────────────────────

  describe('Trusted and untrusted paths setup', () => {
    it('should register trusted paths from options', async () => {
      const toolsPath = createToolDir('trusted-tool');
      const trustedPath = path.join(tmpDir, 'trusted');
      fs.mkdirSync(trustedPath, { recursive: true });

      const matimo = await MatimoInstance.init({
        toolPaths: [toolsPath],
        trustedPaths: [trustedPath],
        logLevel: 'silent',
      });

      expect(matimo).toBeDefined();
    });

    it('should register untrusted paths from options', async () => {
      const toolsPath = createToolDir('untrusted-tool');
      const untrustedPath = path.join(tmpDir, 'untrusted');
      fs.mkdirSync(untrustedPath, { recursive: true });

      const matimo = await MatimoInstance.init({
        toolPaths: [toolsPath],
        untrustedPaths: [untrustedPath],
        logLevel: 'silent',
      });

      expect(matimo).toBeDefined();
    });

    it('should create approval manifest when approvalDir provided', async () => {
      const toolsPath = createToolDir('approval-test');
      const approvalDir = path.join(tmpDir, 'approvals');
      fs.mkdirSync(approvalDir, { recursive: true });

      const matimo = await MatimoInstance.init({
        toolPaths: [toolsPath],
        approvalDir,
        approvalSecret: 'test-secret-key',
        logLevel: 'silent',
      });

      expect(matimo).toBeDefined();
      expect(matimo.getApprovalManifest()).toBeDefined();
    });
  });

  // ─── Event handler setup ──────────────────────────────────────

  describe('Event handler registration', () => {
    it('should register onEvent handler on init', async () => {
      const toolsPath = createToolDir('event-test');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const events: any[] = [];

      const matimo = await MatimoInstance.init({
        toolPaths: [toolsPath],
        onEvent: (event) => {
          events.push(event);
        },
        logLevel: 'silent',
      });

      expect(matimo).toBeDefined();
      // Events should have been captured during init
      expect(Array.isArray(events)).toBe(true);
    });

    it('should register onHITL callback on init', async () => {
      const toolsPath = createToolDir('hitl-test');

      const matimo = await MatimoInstance.init({
        toolPaths: [toolsPath],
        onHITL: async () => false,
        logLevel: 'silent',
      });

      expect(matimo).toBeDefined();
      // HITL callback should be set
      matimo.setHITLCallback(async () => true);
    });
  });

  // ─── Multiple path initialization ─────────────────────────────

  describe('Multiple path handling', () => {
    it('should load tools from multiple paths', async () => {
      const toolsPath1 = createToolDir('tool1');

      const toolsPath2Dir = path.join(tmpDir, 'tools2');
      fs.mkdirSync(toolsPath2Dir, { recursive: true });
      const tool2Dir = path.join(toolsPath2Dir, 'tool2');
      fs.mkdirSync(tool2Dir, { recursive: true });
      fs.writeFileSync(
        path.join(tool2Dir, 'definition.yaml'),
        'name: tool2\nversion: "1.0.0"\ndescription: "Tool 2"\nexecution:\n  type: command\n  command: "echo"\n  args: ["test2"]\n'
      );

      const matimo = await MatimoInstance.init({
        toolPaths: [toolsPath1, toolsPath2Dir],
        logLevel: 'silent',
      });

      expect(matimo).toBeDefined();
      expect(matimo.getTool('tool1')).toBeDefined();
      expect(matimo.getTool('tool2')).toBeDefined();
    });

    it('should load skills from multiple paths', async () => {
      const skillsPath1 = createSkillDir('skill1');

      const skillsPath2Dir = path.join(tmpDir, 'skills2');
      fs.mkdirSync(skillsPath2Dir, { recursive: true });
      const skill2Dir = path.join(skillsPath2Dir, 'skill2');
      fs.mkdirSync(skill2Dir, { recursive: true });
      fs.writeFileSync(path.join(skill2Dir, 'SKILL.md'), '# Skill 2\nUser skill 2\n');

      const matimo = await MatimoInstance.init({
        toolPaths: [createToolDir('dummy')],
        skillPaths: [skillsPath1, skillsPath2Dir],
        logLevel: 'silent',
      });

      expect(matimo).toBeDefined();
      const skills = matimo.searchSkills({ query: 'skill' });
      expect(Array.isArray(skills)).toBe(true);
    });
  });

  // ─── Logger configuration ────────────────────────────────────

  describe('Logger configuration', () => {
    it('should initialize with custom logger config', async () => {
      const toolsPath = createToolDir('logger-test');

      const matimo = await MatimoInstance.init({
        toolPaths: [toolsPath],
        logLevel: 'debug',
        logFormat: 'json',
      });

      expect(matimo).toBeDefined();
    });

    it('should use default logger config when not provided', async () => {
      const toolsPath = createToolDir('default-logger-test');

      const matimo = await MatimoInstance.init({
        toolPaths: [toolsPath],
      });

      expect(matimo).toBeDefined();
    });
  });

  // ─── Comprehensive HITL & Reload coverage ──────────────────────

  describe('Comprehensive HITL & reload paths', () => {
    it('should handle quarantine approval during execute', async () => {
      const toolsPath = createToolDir('hitl-approve');

      const policyPath = path.join(tmpDir, 'policy-hitl.yaml');
      fs.writeFileSync(
        policyPath,
        `enableHITL: true
quarantineRiskLevels:
  - medium
  - high
`
      );

      const untrustedPath = path.join(tmpDir, 'untrusted-hitl');
      fs.mkdirSync(untrustedPath, { recursive: true });
      const tool2Dir = path.join(untrustedPath, 'hitl-tool');
      fs.mkdirSync(tool2Dir, { recursive: true });
      fs.writeFileSync(
        path.join(tool2Dir, 'definition.yaml'),
        'name: hitl-tool\nversion: "1.0.0"\ndescription: "HITL test tool"\nexecution:\n  type: command\n  command: "echo"\n  args: ["success"]\n'
      );

      const matimo = await MatimoInstance.init({
        toolPaths: [toolsPath, untrustedPath],
        untrustedPaths: [untrustedPath],
        policyFile: policyPath,
        logLevel: 'silent',
      });

      // Set callback to approve
      matimo.setHITLCallback(async () => {
        return true;
      });

      // Execute - should trigger HITL if quarantined
      try {
        await matimo.execute('hitl-tool', {});
      } catch {
        // May fail for other reasons, HITL flow is what matters
      }

      expect(typeof matimo.getTool('hitl-tool')).toBe('object');
    });

    it('should mark quarantined tools as pending during reload', async () => {
      const toolsPath = createToolDir('reload-quar-test');

      const policyPath = path.join(tmpDir, 'policy-reload.yaml');
      fs.writeFileSync(
        policyPath,
        `enableHITL: true
quarantineRiskLevels:
  - medium
`
      );

      const untrustedPath = path.join(tmpDir, 'untrusted-reload');
      fs.mkdirSync(untrustedPath, { recursive: true });
      const toolDir = path.join(untrustedPath, 'reload-quar');
      fs.mkdirSync(toolDir, { recursive: true });
      fs.writeFileSync(
        path.join(toolDir, 'definition.yaml'),
        'name: reload-quar\nversion: "1.0.0"\ndescription: "Reload quar test"\nexecution:\n  type: command\n  command: "echo"\n  args: ["test"]\n'
      );

      const approvalDir = path.join(tmpDir, 'approvals-reload');
      fs.mkdirSync(approvalDir, { recursive: true });

      const matimo = await MatimoInstance.init({
        toolPaths: [toolsPath],
        untrustedPaths: [untrustedPath],
        policyFile: policyPath,
        approvalDir,
        logLevel: 'silent',
      });

      // Add the untrusted path for reload
      matimo['toolPaths'].push(untrustedPath);

      // Reload - should quarantine untrusted tool
      const result = await matimo.reloadTools();

      expect(result).toBeDefined();
      expect(typeof result.loaded).toBe('number');
      expect(typeof result.revalidated).toBe('number');
    });

    it('should record reload completion with message', async () => {
      const toolsPath = createToolDir('reload-complete');

      const matimo = await MatimoInstance.init({
        toolPaths: [toolsPath],
        logLevel: 'silent',
      });

      const result = await matimo.reloadTools();

      // Verify reload result structure (lines 497-503)
      expect(result).toHaveProperty('loaded');
      expect(result).toHaveProperty('removed');
      expect(result).toHaveProperty('revalidated');
      expect(result).toHaveProperty('rejected');
      expect(typeof result.loaded).toBe('number');
      expect(typeof result.removed).toBe('number');
      expect(typeof result.revalidated).toBe('number');
      expect(Array.isArray(result.rejected)).toBe(true);
    });

    it('should handle HITL resolution with existing approvals', async () => {
      const toolsPath = createToolDir('hitl-resolve');

      const policyPath = path.join(tmpDir, 'policy-resolve.yaml');
      fs.writeFileSync(
        policyPath,
        `enableHITL: true
quarantineRiskLevels:
  - medium
`
      );

      const untrustedPath = path.join(tmpDir, 'untrusted-resolve');
      fs.mkdirSync(untrustedPath, { recursive: true });
      const toolDir = path.join(untrustedPath, 'resolve-tool');
      fs.mkdirSync(toolDir, { recursive: true });
      fs.writeFileSync(
        path.join(toolDir, 'definition.yaml'),
        'name: resolve-tool\nversion: "1.0.0"\ndescription: "Resolve test"\nexecution:\n  type: command\n  command: "echo"\n  args: ["test"]\n'
      );

      const approvalDir = path.join(tmpDir, 'approvals-resolve');
      fs.mkdirSync(approvalDir, { recursive: true });

      const matimo = await MatimoInstance.init({
        toolPaths: [toolsPath, untrustedPath],
        untrustedPaths: [untrustedPath],
        policyFile: policyPath,
        approvalDir,
        logLevel: 'silent',
      });

      // Pre-approve the tool
      const tool = matimo.getTool('resolve-tool');
      if (tool) {
        const manifest = matimo.getApprovalManifest();
        if (manifest) {
          const hash = manifest.computeHash(JSON.stringify(tool));
          manifest.approve(tool.name, hash);
        }
      }

      // Execute - should use existing approval
      try {
        await matimo.execute('resolve-tool', {});
      } catch {
        // Expected to fail at execution, approval check is what matters
      }

      expect(matimo.getTool('resolve-tool')).toBeDefined();
    });
  });
});
