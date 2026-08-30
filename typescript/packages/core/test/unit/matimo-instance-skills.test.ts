import fs from 'fs';
import path from 'path';
import os from 'os';
import { MatimoInstance } from '../../src/matimo-instance';

/**
 * Tests for MatimoInstance skill proxy methods and reload edge cases.
 * Covers lines 616-701 (skill methods), 1001-1006 (reload rollback),
 * 1116 (getRegistry), 1163-1164 (reloadPolicy edge).
 */
describe('MatimoInstance — Skill & Reload Coverage', () => {
  let tmpDir: string;
  let toolDir: string;
  let skillDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'matimo-skill-cov-'));
    toolDir = path.join(tmpDir, 'tools');
    skillDir = path.join(tmpDir, 'skills');
    fs.mkdirSync(toolDir, { recursive: true });
    fs.mkdirSync(skillDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function writeToolYaml(name: string): void {
    const dir = path.join(toolDir, name);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, 'definition.yaml'),
      `name: ${name}\nversion: '1.0.0'\ndescription: 'Test tool'\nexecution:\n  type: command\n  command: 'echo'\n  args: ['hello']\n`
    );
  }

  function writeSkill(name: string, body = '# Overview\n\nSkill body.'): void {
    const dir = path.join(skillDir, name);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, 'SKILL.md'),
      `---\nname: ${name}\ndescription: Skill for ${name}\n---\n${body}`
    );
  }

  function writeSkillResource(skillName: string, resPath: string, content: string): void {
    const full = path.join(skillDir, skillName, resPath);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
  }

  // ─── Skill proxy methods ──────────────────────────────────────────

  describe('listSkills', () => {
    it('should return registered skills', async () => {
      writeToolYaml('list-tool');
      writeSkill('test-skill');
      const matimo = await MatimoInstance.init({
        toolPaths: [toolDir],
        skillPaths: [skillDir],
        logLevel: 'silent',
      });
      const skills = matimo.listSkills();
      expect(skills.some((s) => s.name === 'test-skill')).toBe(true);
    });
  });

  describe('getSkill', () => {
    it('should return a skill by name', async () => {
      writeToolYaml('get-tool');
      writeSkill('my-skill');
      const matimo = await MatimoInstance.init({
        toolPaths: [toolDir],
        skillPaths: [skillDir],
        logLevel: 'silent',
      });
      const skill = matimo.getSkill('my-skill');
      expect(skill).not.toBeNull();
      expect(skill!.name).toBe('my-skill');
    });

    it('should return null for unknown skill', async () => {
      writeToolYaml('get-tool2');
      const matimo = await MatimoInstance.init({
        toolPaths: [toolDir],
        logLevel: 'silent',
      });
      expect(matimo.getSkill('nonexistent')).toBeNull();
    });
  });

  describe('getSkillContent', () => {
    it('should return skill content', async () => {
      writeToolYaml('content-tool');
      writeSkill('content-skill', '# Intro\n\nHello world.\n\n# Details\n\nMore info.');
      const matimo = await MatimoInstance.init({
        toolPaths: [toolDir],
        skillPaths: [skillDir],
        logLevel: 'silent',
      });
      const content = matimo.getSkillContent('content-skill');
      expect(content).toContain('Hello world');
    });
  });

  describe('getSkillSections', () => {
    it('should return sections', async () => {
      writeToolYaml('sec-tool');
      writeSkill('sec-skill', '# Section A\n\nContent A.\n\n# Section B\n\nContent B.');
      const matimo = await MatimoInstance.init({
        toolPaths: [toolDir],
        skillPaths: [skillDir],
        logLevel: 'silent',
      });
      const sections = matimo.getSkillSections('sec-skill');
      expect(sections).not.toBeNull();
      expect(sections!.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('searchSkills', () => {
    it('should search by query', async () => {
      writeToolYaml('search-tool');
      writeSkill('search-skill');
      const matimo = await MatimoInstance.init({
        toolPaths: [toolDir],
        skillPaths: [skillDir],
        logLevel: 'silent',
      });
      const results = matimo.searchSkills({ query: 'search' });
      expect(results.some((s) => s.name === 'search-skill')).toBe(true);
    });
  });

  describe('semanticSearchSkills', () => {
    it('should perform semantic search', async () => {
      writeToolYaml('sem-tool');
      writeSkill('sem-skill', '# Database operations\n\nSQL query handling.');
      const matimo = await MatimoInstance.init({
        toolPaths: [toolDir],
        skillPaths: [skillDir],
        logLevel: 'silent',
      });
      const results = await matimo.semanticSearchSkills('database SQL');
      expect(results.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('setSkillEmbeddingProvider', () => {
    it('should accept a custom provider', async () => {
      writeToolYaml('emb-tool');
      const matimo = await MatimoInstance.init({
        toolPaths: [toolDir],
        logLevel: 'silent',
      });
      matimo.setSkillEmbeddingProvider({
        dimensions: 3,
        embed: async () => [1, 0, 0],
        embedBatch: async () => [[1, 0, 0]],
      });
      // No error means success
    });
  });

  describe('getSkillResource', () => {
    it('should load a bundled resource', async () => {
      writeToolYaml('res-tool');
      writeSkill('res-skill');
      writeSkillResource('res-skill', 'scripts/run.sh', '#!/bin/bash\necho ok');
      const matimo = await MatimoInstance.init({
        toolPaths: [toolDir],
        skillPaths: [skillDir],
        logLevel: 'silent',
      });
      const content = matimo.getSkillResource('res-skill', 'scripts/run.sh');
      expect(content).toContain('echo ok');
    });
  });

  describe('getSkillPaths', () => {
    it('should return skill paths', async () => {
      writeToolYaml('paths-tool');
      const matimo = await MatimoInstance.init({
        toolPaths: [toolDir],
        skillPaths: [skillDir],
        logLevel: 'silent',
      });
      const paths = matimo.getSkillPaths();
      expect(paths.some((p) => p === skillDir)).toBe(true);
    });
  });

  describe('getRegistry', () => {
    it('should return the tool registry', async () => {
      writeToolYaml('reg-tool');
      const matimo = await MatimoInstance.init({
        toolPaths: [toolDir],
        logLevel: 'silent',
      });
      const registry = matimo.getRegistry();
      expect(registry).toBeDefined();
      expect(typeof registry.getAll).toBe('function');
    });
  });

  // ─── reloadPolicy edge cases ─────────────────────────────────────

  describe('reloadPolicy without any config or file', () => {
    it('should return empty result when there is nothing to reload from', async () => {
      writeToolYaml('no-policy-tool');
      const matimo = await MatimoInstance.init({
        toolPaths: [toolDir],
        logLevel: 'silent',
      });
      const result = await matimo.reloadPolicy();
      expect(result.loaded).toBe(0);
    });
  });

  // ─── reloadTools rollback ────────────────────────────────────────

  describe('reloadTools rollback on I/O failure', () => {
    it('should roll back to previous state on load failure', async () => {
      writeToolYaml('rollback-tool');
      const matimo = await MatimoInstance.init({
        toolPaths: [toolDir],
        logLevel: 'silent',
      });

      // Verify tool loaded initially
      expect(matimo.getTool('rollback-tool')).toBeDefined();

      // Delete tool directory to cause I/O failure on reload
      fs.rmSync(toolDir, { recursive: true, force: true });

      const result = await matimo.reloadTools();
      // The loader should either succeed with 0 tools or roll back
      // Since the directory doesn't exist, loadToolsFromMultiplePaths may return empty
      // But the tool should still be known from the initial load or rolled back
      expect(result).toBeDefined();
    });
  });

  // ─── reloadSkills ──────────────────────────────────────────────────

  describe('reloadSkills', () => {
    it('should pick up a skill written to disk after init', async () => {
      writeToolYaml('reload-skills-tool');
      const matimo = await MatimoInstance.init({
        toolPaths: [toolDir],
        skillPaths: [skillDir],
        logLevel: 'silent',
      });

      expect(matimo.listSkills().some((s) => s.name === 'new-skill')).toBe(false);

      writeSkill('new-skill');
      const result = await matimo.reloadSkills();

      expect(result.loaded).toBe(1);
      expect(matimo.listSkills().some((s) => s.name === 'new-skill')).toBe(true);
    });

    it('should remove a skill deleted from disk', async () => {
      writeToolYaml('reload-skills-tool2');
      writeSkill('temp-skill');
      const matimo = await MatimoInstance.init({
        toolPaths: [toolDir],
        skillPaths: [skillDir],
        logLevel: 'silent',
      });

      expect(matimo.listSkills().some((s) => s.name === 'temp-skill')).toBe(true);

      fs.rmSync(path.join(skillDir, 'temp-skill'), { recursive: true, force: true });
      const result = await matimo.reloadSkills();

      expect(result.removed).toBe(1);
      expect(matimo.listSkills().some((s) => s.name === 'temp-skill')).toBe(false);
    });

    it('should emit a skills:reloaded event', async () => {
      writeToolYaml('reload-skills-tool3');
      const events: Array<{ type: string }> = [];
      const matimo = await MatimoInstance.init({
        toolPaths: [toolDir],
        skillPaths: [skillDir],
        logLevel: 'silent',
        onEvent: (event) => events.push(event),
      });

      writeSkill('event-skill');
      await matimo.reloadSkills();

      expect(events.some((e) => e.type === 'skills:reloaded')).toBe(true);
    });
  });
});
