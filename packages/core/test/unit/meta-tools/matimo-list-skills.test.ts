import fs from 'fs';
import path from 'path';
import os from 'os';
import matimoListSkills from '../../../tools/matimo_list_skills/matimo_list_skills';

describe('matimo_list_skills', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'matimo-list-skills-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function writeSkill(name: string, content: string): void {
    const skillDir = path.join(tmpDir, name);
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(path.join(skillDir, 'SKILL.md'), content, 'utf-8');
  }

  it('should list skills in the directory', async () => {
    writeSkill(
      'code-review',
      `---
name: code-review
description: Guidelines for reviewing code
---

# Code Review Skill

Review code for quality and correctness.
`
    );
    writeSkill(
      'testing',
      `---
name: testing
description: Best practices for writing tests
---

# Testing Skill

Write thorough tests.
`
    );

    const result = await matimoListSkills({ skills_dir: tmpDir });
    expect(result.total).toBe(2);
    expect(result.skills.map((s) => s.name).sort()).toEqual(['code-review', 'testing']);
  });

  it('should include description and path for each skill', async () => {
    writeSkill(
      'my-skill',
      `---
name: my-skill
description: A helpful skill
---

# My Skill
`
    );

    const result = await matimoListSkills({ skills_dir: tmpDir });
    expect(result.skills[0].name).toBe('my-skill');
    expect(result.skills[0].description).toBe('A helpful skill');
    expect(result.skills[0].path).toContain('my-skill/SKILL.md');
  });

  it('should return optional frontmatter fields (license, compatibility)', async () => {
    writeSkill(
      'pdf-processing',
      `---
name: pdf-processing
description: Extract PDF text and fill forms
license: Apache-2.0
compatibility: Requires pdfplumber package
---

# PDF Processing
`
    );

    const result = await matimoListSkills({ skills_dir: tmpDir });
    expect(result.skills[0].license).toBe('Apache-2.0');
    expect(result.skills[0].compatibility).toBe('Requires pdfplumber package');
  });

  it('should return metadata from frontmatter', async () => {
    writeSkill(
      'versioned-skill',
      `---
name: versioned-skill
description: A skill with metadata
metadata:
  author: matimo-team
  version: "2.0"
---

# Versioned Skill
`
    );

    const result = await matimoListSkills({ skills_dir: tmpDir });
    expect(result.skills[0].metadata).toEqual({
      author: 'matimo-team',
      version: '2.0',
    });
  });

  it('should skip directories without SKILL.md', async () => {
    writeSkill(
      'valid-skill',
      `---
name: valid-skill
description: Valid
---

# Content
`
    );
    // Create a directory without SKILL.md
    fs.mkdirSync(path.join(tmpDir, 'empty-dir'), { recursive: true });

    const result = await matimoListSkills({ skills_dir: tmpDir });
    expect(result.total).toBe(1);
    expect(result.skills[0].name).toBe('valid-skill');
  });

  it('should skip skills with missing frontmatter fields', async () => {
    writeSkill(
      'no-desc',
      `---
name: no-desc
---

# No description
`
    );
    writeSkill(
      'valid',
      `---
name: valid
description: Has description
---

# Valid
`
    );

    const result = await matimoListSkills({ skills_dir: tmpDir });
    expect(result.total).toBe(1);
    expect(result.skills[0].name).toBe('valid');
  });

  it('should return empty list for non-existent directory', async () => {
    const result = await matimoListSkills({
      skills_dir: '/nonexistent/path',
    });

    expect(result.skills).toHaveLength(0);
    expect(result.total).toBe(0);
  });

  it('should use default skills_dir when not specified', async () => {
    // Should not throw, just return empty since default dir doesn't exist
    const result = await matimoListSkills({});
    expect(result.skills).toBeInstanceOf(Array);
    expect(result.total).toBe(0);
  });

  it('should skip files (non-directories) at root level', async () => {
    writeSkill(
      'real-skill',
      `---
name: real-skill
description: A real skill
---

# Content
`
    );
    // Create a file (not directory) at root level
    fs.writeFileSync(path.join(tmpDir, 'stray-file.md'), 'not a skill');

    const result = await matimoListSkills({ skills_dir: tmpDir });
    expect(result.total).toBe(1);
  });

  it('should skip skills with invalid frontmatter format', async () => {
    writeSkill('bad-frontmatter', 'No frontmatter at all, just plain text');
    writeSkill(
      'good-skill',
      `---
name: good-skill
description: A valid skill
---

# Content
`
    );

    const result = await matimoListSkills({ skills_dir: tmpDir });
    expect(result.total).toBe(1);
    expect(result.skills[0].name).toBe('good-skill');
  });
});
