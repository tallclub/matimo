import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  validateSkillName,
  parseSkillContent,
  validateFrontmatter,
  listBundledResources,
} from '../../../tools/shared/skill-validation';

describe('skill-validation', () => {
  // ── validateSkillName ──

  describe('validateSkillName', () => {
    it('should accept valid lowercase names', () => {
      expect(validateSkillName('code-review').valid).toBe(true);
      expect(validateSkillName('pdf-processing').valid).toBe(true);
      expect(validateSkillName('a').valid).toBe(true);
      expect(validateSkillName('skill123').valid).toBe(true);
      expect(validateSkillName('my-cool-skill').valid).toBe(true);
    });

    it('should reject empty names', () => {
      expect(validateSkillName('').valid).toBe(false);
      expect(validateSkillName('  ').valid).toBe(false);
    });

    it('should reject uppercase names', () => {
      const result = validateSkillName('MySkill');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('lowercase');
    });

    it('should reject names starting with hyphen', () => {
      const result = validateSkillName('-leading');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('must not start or end');
    });

    it('should reject names ending with hyphen', () => {
      const result = validateSkillName('trailing-');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('must not start or end');
    });

    it('should reject consecutive hyphens', () => {
      const result = validateSkillName('my--skill');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('consecutive hyphens');
    });

    it('should reject names over 64 characters', () => {
      const result = validateSkillName('a'.repeat(65));
      expect(result.valid).toBe(false);
      expect(result.error).toContain('64');
    });

    it('should accept names at exactly 64 characters', () => {
      expect(validateSkillName('a'.repeat(64)).valid).toBe(true);
    });

    it('should reject underscores', () => {
      const result = validateSkillName('my_skill');
      expect(result.valid).toBe(false);
    });

    it('should reject path traversal', () => {
      expect(validateSkillName('../escape').valid).toBe(false);
      expect(validateSkillName('test\\..\\escape').valid).toBe(false);
    });
  });

  // ── parseSkillContent ──

  describe('parseSkillContent', () => {
    it('should parse valid frontmatter with required fields', () => {
      const result = parseSkillContent(`---
name: my-skill
description: A helpful skill
---

# My Skill

Instructions here.
`);
      expect(result.success).toBe(true);
      expect(result.parsed!.frontmatter.name).toBe('my-skill');
      expect(result.parsed!.frontmatter.description).toBe('A helpful skill');
      expect(result.parsed!.body).toContain('Instructions here.');
    });

    it('should parse optional frontmatter fields', () => {
      const result = parseSkillContent(`---
name: pdf-skill
description: PDF processing
license: Apache-2.0
compatibility: Requires python3
allowed-tools: Bash(git:*) Read
---

# PDF
`);
      expect(result.success).toBe(true);
      expect(result.parsed!.frontmatter.license).toBe('Apache-2.0');
      expect(result.parsed!.frontmatter.compatibility).toBe('Requires python3');
      expect(result.parsed!.frontmatter['allowed-tools']).toBe('Bash(git:*) Read');
    });

    it('should parse metadata sub-keys', () => {
      const result = parseSkillContent(`---
name: meta-skill
description: A skill with metadata
metadata:
  author: test-org
  version: "2.0"
---

# Content
`);
      expect(result.success).toBe(true);
      expect(result.parsed!.frontmatter.metadata).toEqual({
        author: 'test-org',
        version: '2.0',
      });
    });

    it('should reject content without frontmatter', () => {
      const result = parseSkillContent('# No frontmatter');
      expect(result.success).toBe(false);
      expect(result.error).toContain('frontmatter');
    });

    it('should reject content without closing frontmatter', () => {
      const result = parseSkillContent('---\nname: test\n');
      expect(result.success).toBe(false);
      expect(result.error).toContain('closing');
    });

    it('should handle empty body', () => {
      const result = parseSkillContent(`---
name: empty
description: Empty body skill
---
`);
      expect(result.success).toBe(true);
      expect(result.parsed!.body).toBe('');
    });
  });

  // ── validateFrontmatter ──

  describe('validateFrontmatter', () => {
    it('should accept valid frontmatter', () => {
      const result = validateFrontmatter({
        name: 'valid-skill',
        description: 'A valid skill description',
      });
      expect(result.valid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('should reject missing name', () => {
      const result = validateFrontmatter({
        name: '',
        description: 'Has description',
      });
      expect(result.valid).toBe(false);
      expect(result.issues).toContainEqual(
        expect.objectContaining({ field: 'name', severity: 'error' })
      );
    });

    it('should reject missing description', () => {
      const result = validateFrontmatter({
        name: 'valid-name',
        description: '',
      });
      expect(result.valid).toBe(false);
      expect(result.issues).toContainEqual(
        expect.objectContaining({ field: 'description', severity: 'error' })
      );
    });

    it('should reject description over 1024 characters', () => {
      const result = validateFrontmatter({
        name: 'valid-name',
        description: 'x'.repeat(1025),
      });
      expect(result.valid).toBe(false);
      expect(result.issues).toContainEqual(
        expect.objectContaining({ field: 'description', message: expect.stringContaining('1024') })
      );
    });

    it('should reject compatibility over 500 characters', () => {
      const result = validateFrontmatter({
        name: 'valid-name',
        description: 'Valid',
        compatibility: 'x'.repeat(501),
      });
      expect(result.valid).toBe(false);
      expect(result.issues).toContainEqual(
        expect.objectContaining({ field: 'compatibility', message: expect.stringContaining('500') })
      );
    });

    it('should enforce name matches directory name', () => {
      const result = validateFrontmatter({ name: 'skill-a', description: 'Valid' }, 'skill-b');
      expect(result.valid).toBe(false);
      expect(result.issues).toContainEqual(
        expect.objectContaining({ message: expect.stringContaining('must match') })
      );
    });

    it('should pass when name matches directory name', () => {
      const result = validateFrontmatter({ name: 'my-skill', description: 'Valid' }, 'my-skill');
      expect(result.valid).toBe(true);
    });
  });

  // ── listBundledResources ──

  describe('listBundledResources', () => {
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'matimo-resources-'));
      // Create SKILL.md
      fs.writeFileSync(
        path.join(tmpDir, 'SKILL.md'),
        '---\nname: test\ndescription: test\n---\n# Test'
      );
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('should list files in scripts/, references/, assets/ directories', () => {
      fs.mkdirSync(path.join(tmpDir, 'scripts'), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, 'scripts', 'run.py'), '# script');
      fs.mkdirSync(path.join(tmpDir, 'references'), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, 'references', 'API.md'), '# API');
      fs.mkdirSync(path.join(tmpDir, 'assets'), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, 'assets', 'logo.png'), 'image');

      const resources = listBundledResources(tmpDir);
      expect(resources.scripts).toContain('scripts/run.py');
      expect(resources.references).toContain('references/API.md');
      expect(resources.assets).toContain('assets/logo.png');
    });

    it('should list other files under "other"', () => {
      fs.writeFileSync(path.join(tmpDir, 'README.md'), '# Readme');
      fs.writeFileSync(path.join(tmpDir, 'LICENSE'), 'MIT');

      const resources = listBundledResources(tmpDir);
      expect(resources.other).toContain('README.md');
      expect(resources.other).toContain('LICENSE');
    });

    it('should not include SKILL.md in any category', () => {
      const resources = listBundledResources(tmpDir);
      const all = [
        ...resources.scripts,
        ...resources.references,
        ...resources.assets,
        ...resources.other,
      ];
      expect(all).not.toContain('SKILL.md');
    });

    it('should return empty for non-existent directory', () => {
      const resources = listBundledResources('/nonexistent/path');
      expect(resources.scripts).toEqual([]);
      expect(resources.references).toEqual([]);
      expect(resources.assets).toEqual([]);
      expect(resources.other).toEqual([]);
    });
  });
});
