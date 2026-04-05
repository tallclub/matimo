import fs from 'fs';
import path from 'path';
import os from 'os';
import { SkillLoader, parseSkillContent } from '../../../src/core/skill-loader';
import { MatimoError } from '../../../src/errors/matimo-error';

describe('SkillLoader', () => {
  let loader: SkillLoader;
  let tmpDir: string;

  beforeEach(() => {
    loader = new SkillLoader();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-loader-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // Helper to create a valid SKILL.md
  function createSkill(
    name: string,
    opts: { body?: string; extraFrontmatter?: string } = {}
  ): string {
    const skillDir = path.join(tmpDir, name);
    fs.mkdirSync(skillDir, { recursive: true });
    const body = opts.body ?? `# Overview\n\nA test skill.`;
    const extra = opts.extraFrontmatter ?? '';
    fs.writeFileSync(
      path.join(skillDir, 'SKILL.md'),
      `---\nname: ${name}\ndescription: Test skill for ${name}\n${extra}---\n${body}`
    );
    return skillDir;
  }

  // ─── loadSkillsFromDirectory ─────────────────────────────────────

  describe('loadSkillsFromDirectory', () => {
    it('should return empty array for non-existent directory', () => {
      const result = loader.loadSkillsFromDirectory('/nonexistent/path');
      expect(result).toEqual([]);
    });

    it('should skip non-directory entries', () => {
      // Create a plain file in the skills dir (not a directory)
      fs.writeFileSync(path.join(tmpDir, 'not-a-skill.txt'), 'hello');
      createSkill('valid-skill');
      const result = loader.loadSkillsFromDirectory(tmpDir);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('valid-skill');
    });

    it('should skip directories without SKILL.md', () => {
      fs.mkdirSync(path.join(tmpDir, 'empty-dir'));
      createSkill('valid-skill');
      const result = loader.loadSkillsFromDirectory(tmpDir);
      expect(result).toHaveLength(1);
    });

    it('should load multiple skills', () => {
      createSkill('skill-a');
      createSkill('skill-b');
      const result = loader.loadSkillsFromDirectory(tmpDir, 'builtin');
      expect(result).toHaveLength(2);
      expect(result[0].source).toBe('builtin');
    });

    it('should skip skills with invalid names and continue', () => {
      // Create a directory with an invalid skill name (uppercase)
      const badDir = path.join(tmpDir, 'Bad_Skill');
      fs.mkdirSync(badDir);
      fs.writeFileSync(
        path.join(badDir, 'SKILL.md'),
        `---\nname: Bad_Skill\ndescription: Bad\n---\nBody`
      );
      createSkill('good-skill');
      const result = loader.loadSkillsFromDirectory(tmpDir);
      // Bad skill is skipped (loadSkill throws, caught in loop)
      expect(result.some((s) => s.name === 'good-skill')).toBe(true);
    });
  });

  // ─── loadSkill ──────────────────────────────────────────────────

  describe('loadSkill', () => {
    it('should load a valid skill', () => {
      createSkill('my-tool');
      const result = loader.loadSkill('my-tool', tmpDir);
      expect(result).not.toBeNull();
      expect(result!.name).toBe('my-tool');
      expect(result!.description).toBe('Test skill for my-tool');
      expect(result!.source).toBe('user');
    });

    it('should throw for empty name', () => {
      expect(() => loader.loadSkill('', tmpDir)).toThrow(MatimoError);
    });

    it('should throw for name too long', () => {
      const longName = 'a'.repeat(65);
      expect(() => loader.loadSkill(longName, tmpDir)).toThrow(MatimoError);
    });

    it('should throw for name with uppercase', () => {
      expect(() => loader.loadSkill('BadName', tmpDir)).toThrow(MatimoError);
    });

    it('should throw for name with consecutive hyphens', () => {
      expect(() => loader.loadSkill('bad--name', tmpDir)).toThrow(MatimoError);
    });

    it('should throw for name starting with hyphen', () => {
      expect(() => loader.loadSkill('-bad-name', tmpDir)).toThrow(MatimoError);
    });

    it('should throw if SKILL.md not found', () => {
      fs.mkdirSync(path.join(tmpDir, 'no-skill'));
      expect(() => loader.loadSkill('no-skill', tmpDir)).toThrow(MatimoError);
    });

    it('should throw if frontmatter name does not match directory', () => {
      const skillDir = path.join(tmpDir, 'dir-name');
      fs.mkdirSync(skillDir);
      fs.writeFileSync(
        path.join(skillDir, 'SKILL.md'),
        `---\nname: different-name\ndescription: Mismatch\n---\nBody`
      );
      expect(() => loader.loadSkill('dir-name', tmpDir)).toThrow(/must match directory name/);
    });

    it('should throw for invalid frontmatter YAML', () => {
      const skillDir = path.join(tmpDir, 'bad-yaml');
      fs.mkdirSync(skillDir);
      fs.writeFileSync(
        path.join(skillDir, 'SKILL.md'),
        `---\nname: bad-yaml\ndescription:\n  - invalid: [yaml\n---\nBody`
      );
      expect(() => loader.loadSkill('bad-yaml', tmpDir)).toThrow(MatimoError);
    });

    it('should populate bundled resources', () => {
      const skillDir = createSkill('with-resources');
      // Create bundled resource directories
      const scriptsDir = path.join(skillDir, 'scripts');
      fs.mkdirSync(scriptsDir);
      fs.writeFileSync(path.join(scriptsDir, 'extract.py'), 'print("hello")');

      const refsDir = path.join(skillDir, 'references');
      fs.mkdirSync(refsDir);
      fs.writeFileSync(path.join(refsDir, 'guide.md'), '# Guide');

      const assetsDir = path.join(skillDir, 'assets');
      fs.mkdirSync(assetsDir);
      fs.writeFileSync(path.join(assetsDir, 'template.json'), '{}');

      // Also a non-known directory
      const customDir = path.join(skillDir, 'custom');
      fs.mkdirSync(customDir);
      fs.writeFileSync(path.join(customDir, 'data.csv'), 'a,b');

      // And a loose file
      fs.writeFileSync(path.join(skillDir, 'README.md'), '# Readme');

      const result = loader.loadSkill('with-resources', tmpDir);
      expect(result!.resources.scripts).toContain('scripts/extract.py');
      expect(result!.resources.references).toContain('references/guide.md');
      expect(result!.resources.assets).toContain('assets/template.json');
      expect(result!.resources.other).toContain('custom/data.csv');
      expect(result!.resources.other).toContain('README.md');
    });

    it('should set metadata from frontmatter', () => {
      createSkill('meta-skill', {
        extraFrontmatter: 'version: "2.0.0"\nlicense: MIT\ncompatibility: ">=1.0"\n',
      });
      const result = loader.loadSkill('meta-skill', tmpDir);
      expect(result!.version).toBe('2.0.0');
      expect(result!.license).toBe('MIT');
      expect(result!.compatibility).toBe('>=1.0');
    });
  });

  // ─── loadSkillResource ─────────────────────────────────────────

  describe('loadSkillResource', () => {
    it('should load a resource file', () => {
      const skillDir = createSkill('res-skill');
      const scriptsDir = path.join(skillDir, 'scripts');
      fs.mkdirSync(scriptsDir);
      fs.writeFileSync(path.join(scriptsDir, 'run.sh'), '#!/bin/bash\necho ok');

      const content = loader.loadSkillResource('res-skill', tmpDir, 'scripts/run.sh');
      expect(content).toContain('echo ok');
    });

    it('should throw for path traversal with ..', () => {
      createSkill('safe-skill');
      expect(() => loader.loadSkillResource('safe-skill', tmpDir, '../../../etc/passwd')).toThrow(
        MatimoError
      );
    });

    it('should throw for path with backslash', () => {
      createSkill('safe-skill2');
      expect(() => loader.loadSkillResource('safe-skill2', tmpDir, 'scripts\\bad.sh')).toThrow(
        MatimoError
      );
    });

    it('should throw for path with control characters', () => {
      createSkill('safe-skill3');
      expect(() => loader.loadSkillResource('safe-skill3', tmpDir, 'scripts/\0bad.sh')).toThrow(
        MatimoError
      );
    });

    it('should throw for nonexistent resource', () => {
      createSkill('no-res-skill');
      expect(() => loader.loadSkillResource('no-res-skill', tmpDir, 'scripts/missing.sh')).toThrow(
        MatimoError
      );
    });

    it('should throw if read fails', () => {
      const skillDir = createSkill('read-fail');
      const scriptsDir = path.join(skillDir, 'scripts');
      fs.mkdirSync(scriptsDir);
      const filePath = path.join(scriptsDir, 'test.sh');
      fs.writeFileSync(filePath, 'content');

      // Mock readFileSync to throw for this specific call
      const originalReadFile = fs.readFileSync;
      jest.spyOn(fs, 'readFileSync').mockImplementation(((p: unknown, ...args: unknown[]) => {
        if (typeof p === 'string' && p === filePath) {
          throw new Error('Permission denied');
        }
        return (originalReadFile as (...a: unknown[]) => ReturnType<typeof fs.readFileSync>)(
          p,
          ...args
        );
      }) as typeof fs.readFileSync);

      expect(() => loader.loadSkillResource('read-fail', tmpDir, 'scripts/test.sh')).toThrow(
        /Failed to read resource file/
      );

      jest.restoreAllMocks();
    });
  });
});

// ─── parseSkillContent (standalone function) ──────────────────────

describe('parseSkillContent', () => {
  it('should reject content without frontmatter', () => {
    const result = parseSkillContent('Just a body');
    expect(result.error).toContain('must start with YAML');
  });

  it('should reject content without closing ---', () => {
    const result = parseSkillContent('---\nname: test\n');
    expect(result.error).toContain('closing YAML');
  });

  it('should reject invalid YAML', () => {
    const result = parseSkillContent('---\n: :\n  bad:\n---\nBody');
    expect(result.error).toBeDefined();
  });

  it('should reject missing required fields', () => {
    const result = parseSkillContent('---\nname: test\n---\nBody');
    expect(result.error).toContain('validation failed');
  });

  it('should parse valid content', () => {
    const result = parseSkillContent(
      '---\nname: my-skill\ndescription: A skill\n---\n# Overview\n\nDetails.'
    );
    expect(result.error).toBeUndefined();
    expect(result.frontmatter.name).toBe('my-skill');
    expect(result.body).toContain('Details.');
  });

  it('should normalize allowed-tools from string to array', () => {
    const result = parseSkillContent(
      '---\nname: my-skill\ndescription: A skill\nallowed-tools: "tool-a tool-b"\n---\nBody'
    );
    expect(result.error).toBeUndefined();
    expect(result.frontmatter['allowed-tools']).toEqual(['tool-a', 'tool-b']);
  });
});
