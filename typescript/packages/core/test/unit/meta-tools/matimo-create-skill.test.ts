import fs from 'fs';
import path from 'path';
import os from 'os';
import { getGlobalMatimoInstance } from '@matimo/core';
import matimoCreateSkill from '../../../tools/matimo_create_skill/matimo_create_skill';

jest.mock('@matimo/core', () => {
  const actual = jest.requireActual('@matimo/core');
  return {
    ...actual,
    getGlobalMatimoInstance: jest.fn(actual.getGlobalMatimoInstance),
  };
});

const mockGetInstance = getGlobalMatimoInstance as jest.MockedFunction<
  typeof getGlobalMatimoInstance
>;

describe('matimo_create_skill', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'matimo-create-skill-'));
    mockGetInstance.mockImplementation(() => {
      throw new Error('Global MatimoInstance not set.');
    });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    jest.resetAllMocks();
  });

  it('should create a valid skill on disk', async () => {
    const content = `---
name: data-analysis
description: Skill for analyzing data sets
---

# Data Analysis Skill

This skill helps with data analysis tasks.
`;

    const result = await matimoCreateSkill({
      name: 'data-analysis',
      content,
      target_dir: tmpDir,
    });

    expect(result.success).toBe(true);
    expect(result.path).toBeDefined();
    expect(fs.existsSync(result.path!)).toBe(true);

    const written = fs.readFileSync(result.path!, 'utf-8');
    expect(written).toContain('data-analysis');
    expect(written).toContain('Data Analysis Skill');
  });

  it('should create a skill with optional frontmatter fields', async () => {
    const content = `---
name: pdf-processing
description: Extract PDF text, fill forms, merge files. Use when handling PDFs.
license: Apache-2.0
compatibility: Requires pdfplumber package
metadata:
  author: matimo-team
  version: "1.0"
---

# PDF Processing

Use pdfplumber to extract text from PDFs.
`;

    const result = await matimoCreateSkill({
      name: 'pdf-processing',
      content,
      target_dir: tmpDir,
    });

    expect(result.success).toBe(true);
    expect(result.path).toBeDefined();
    expect(result.message).toContain('pdf-processing');
  });

  it('should reject content without frontmatter', async () => {
    const result = await matimoCreateSkill({
      name: 'no-frontmatter',
      content: '# No frontmatter\n\nJust content.',
      target_dir: tmpDir,
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain('frontmatter');
  });

  it('should reject content without closing frontmatter', async () => {
    const result = await matimoCreateSkill({
      name: 'open-frontmatter',
      content: '---\nname: open-frontmatter\ndescription: test\nno closing',
      target_dir: tmpDir,
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain('closing');
  });

  it('should reject frontmatter without name field', async () => {
    const result = await matimoCreateSkill({
      name: 'no-name',
      content: '---\ndescription: test\n---\n# Content',
      target_dir: tmpDir,
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain('name');
  });

  it('should reject frontmatter without description field', async () => {
    const result = await matimoCreateSkill({
      name: 'no-desc',
      content: '---\nname: no-desc\n---\n# Content',
      target_dir: tmpDir,
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain('description');
  });

  it('should reject names with path traversal', async () => {
    const result = await matimoCreateSkill({
      name: '../escape',
      content: '---\nname: test\ndescription: test\n---\n# Content',
      target_dir: tmpDir,
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain('invalid characters');
  });

  it('should reject empty names', async () => {
    const result = await matimoCreateSkill({
      name: '',
      content: '---\nname: test\ndescription: test\n---\n# Content',
      target_dir: tmpDir,
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain('required');
  });

  // Agent Skills spec: name must be lowercase
  it('should reject uppercase names', async () => {
    const result = await matimoCreateSkill({
      name: 'MySkill',
      content: '---\nname: MySkill\ndescription: test\n---\n# Content',
      target_dir: tmpDir,
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain('lowercase');
  });

  // Agent Skills spec: no consecutive hyphens
  it('should reject names with consecutive hyphens', async () => {
    const result = await matimoCreateSkill({
      name: 'my--skill',
      content: '---\nname: my--skill\ndescription: test\n---\n# Content',
      target_dir: tmpDir,
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain('consecutive hyphens');
  });

  // Agent Skills spec: name must not start with hyphen
  it('should reject names starting with hyphen', async () => {
    const result = await matimoCreateSkill({
      name: '-leading',
      content: '---\nname: -leading\ndescription: test\n---\n# Content',
      target_dir: tmpDir,
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain('must not start or end');
  });

  // Agent Skills spec: name must not end with hyphen
  it('should reject names ending with hyphen', async () => {
    const result = await matimoCreateSkill({
      name: 'trailing-',
      content: '---\nname: trailing-\ndescription: test\n---\n# Content',
      target_dir: tmpDir,
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain('must not start or end');
  });

  // Agent Skills spec: name max 64 characters
  it('should reject names longer than 64 characters', async () => {
    const longName = 'a'.repeat(65);
    const result = await matimoCreateSkill({
      name: longName,
      content: `---\nname: ${longName}\ndescription: test\n---\n# Content`,
      target_dir: tmpDir,
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain('64');
  });

  // Agent Skills spec: name in frontmatter must match directory name
  it('should reject when frontmatter name does not match directory name', async () => {
    const result = await matimoCreateSkill({
      name: 'my-skill',
      content: '---\nname: different-name\ndescription: test\n---\n# Content',
      target_dir: tmpDir,
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain('must match');
  });

  // Agent Skills spec: underscores not allowed in name
  it('should reject names with underscores', async () => {
    const result = await matimoCreateSkill({
      name: 'my_skill',
      content: '---\nname: my_skill\ndescription: test\n---\n# Content',
      target_dir: tmpDir,
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain('lowercase');
  });

  describe('global MatimoInstance integration', () => {
    const content = `---
name: instance-integration
description: Skill used to test global instance integration
---

# Instance Integration
`;

    it('should fall back to the default target_dir when no global instance is set', async () => {
      const originalCwd = process.cwd();
      process.chdir(tmpDir);
      try {
        const result = await matimoCreateSkill({ name: 'instance-integration', content });

        expect(result.success).toBe(true);
        expect(result.path).toBe(
          path.resolve('./matimo-tools/skills', 'instance-integration', 'SKILL.md')
        );
      } finally {
        process.chdir(originalCwd);
      }
    });

    it('should use the instance defaultSkillWriteDir when target_dir is not passed', async () => {
      mockGetInstance.mockReturnValue({
        getDefaultSkillWriteDir: () => tmpDir,
        notifySkillCreated: jest.fn(),
      } as unknown as ReturnType<typeof getGlobalMatimoInstance>);

      const result = await matimoCreateSkill({ name: 'instance-integration', content });

      expect(result.success).toBe(true);
      expect(result.path).toBe(path.join(tmpDir, 'instance-integration', 'SKILL.md'));
    });

    it('should prefer an explicit target_dir over the instance default', async () => {
      const otherDir = fs.mkdtempSync(path.join(os.tmpdir(), 'matimo-create-skill-other-'));
      mockGetInstance.mockReturnValue({
        getDefaultSkillWriteDir: () => otherDir,
        notifySkillCreated: jest.fn(),
      } as unknown as ReturnType<typeof getGlobalMatimoInstance>);

      const result = await matimoCreateSkill({
        name: 'instance-integration',
        content,
        target_dir: tmpDir,
      });

      expect(result.success).toBe(true);
      expect(result.path).toBe(path.join(tmpDir, 'instance-integration', 'SKILL.md'));

      fs.rmSync(otherDir, { recursive: true, force: true });
    });

    it('should notify the instance of skill creation on success', async () => {
      const notifySkillCreated = jest.fn();
      mockGetInstance.mockReturnValue({
        getDefaultSkillWriteDir: () => undefined,
        notifySkillCreated,
      } as unknown as ReturnType<typeof getGlobalMatimoInstance>);

      await matimoCreateSkill({ name: 'instance-integration', content, target_dir: tmpDir });

      expect(notifySkillCreated).toHaveBeenCalledWith('instance-integration', 'user');
    });

    it('should not notify the instance when skill creation fails', async () => {
      const notifySkillCreated = jest.fn();
      mockGetInstance.mockReturnValue({
        getDefaultSkillWriteDir: () => undefined,
        notifySkillCreated,
      } as unknown as ReturnType<typeof getGlobalMatimoInstance>);

      const result = await matimoCreateSkill({
        name: 'bad-name-fail',
        content: '---\nname: mismatch\ndescription: test\n---\n# Content',
        target_dir: tmpDir,
      });

      expect(result.success).toBe(false);
      expect(notifySkillCreated).not.toHaveBeenCalled();
    });

    it('should tolerate notifySkillCreated throwing', async () => {
      mockGetInstance.mockReturnValue({
        getDefaultSkillWriteDir: () => undefined,
        notifySkillCreated: () => {
          throw new Error('handler exploded');
        },
      } as unknown as ReturnType<typeof getGlobalMatimoInstance>);

      const result = await matimoCreateSkill({
        name: 'instance-integration',
        content,
        target_dir: tmpDir,
      });

      expect(result.success).toBe(true);
    });
  });
});
