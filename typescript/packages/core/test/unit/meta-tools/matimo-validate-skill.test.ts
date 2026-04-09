import fs from 'fs';
import path from 'path';
import os from 'os';
import matimoValidateSkill from '../../../tools/matimo_validate_skill/matimo_validate_skill';

describe('matimo_validate_skill', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'matimo-validate-skill-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function writeSkill(name: string, content: string): string {
    const skillDir = path.join(tmpDir, name);
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(path.join(skillDir, 'SKILL.md'), content, 'utf-8');
    return skillDir;
  }

  function writeResource(skillName: string, filePath: string, content: string): void {
    const fullPath = path.join(tmpDir, skillName, filePath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content, 'utf-8');
  }

  // ── Valid skills ──

  it('should validate a spec-compliant skill', async () => {
    writeSkill(
      'code-review',
      `---
name: code-review
description: Guidelines for reviewing code quality and correctness
---

# Code Review Skill

## When to use
Use when reviewing pull requests or code changes.

## Checklist
- Check error handling
- Verify edge cases
`
    );

    const result = await matimoValidateSkill({ name: 'code-review', skills_dir: tmpDir });
    expect(result.valid).toBe(true);
    expect(result.issues.filter((i) => i.severity === 'error')).toHaveLength(0);
    expect(result.structure.has_skill_md).toBe(true);
    expect(result.message).toContain('valid');
  });

  it('should validate a skill with optional frontmatter fields', async () => {
    writeSkill(
      'pdf-processing',
      `---
name: pdf-processing
description: Extract PDF text, fill forms, merge files. Use when handling PDFs.
license: Apache-2.0
compatibility: Requires pdfplumber package
metadata:
  author: matimo-team
  version: "1.0"
---

# PDF Processing

Instructions here.
`
    );

    const result = await matimoValidateSkill({ name: 'pdf-processing', skills_dir: tmpDir });
    expect(result.valid).toBe(true);
  });

  // ── Structure validation ──

  it('should list bundled resources', async () => {
    writeSkill(
      'data-skill',
      `---
name: data-skill
description: Data analysis skill
---

# Data Analysis
`
    );
    writeResource('data-skill', 'scripts/analyze.py', '# analysis script');
    writeResource('data-skill', 'references/API.md', '# API reference');
    writeResource('data-skill', 'assets/template.csv', 'col1,col2');

    const result = await matimoValidateSkill({ name: 'data-skill', skills_dir: tmpDir });
    expect(result.valid).toBe(true);
    expect(result.structure.resources.scripts).toContain('scripts/analyze.py');
    expect(result.structure.resources.references).toContain('references/API.md');
    expect(result.structure.resources.assets).toContain('assets/template.csv');
  });

  // ── Name validation ──

  it('should reject skill with missing SKILL.md', async () => {
    fs.mkdirSync(path.join(tmpDir, 'empty-skill'), { recursive: true });

    const result = await matimoValidateSkill({ name: 'empty-skill', skills_dir: tmpDir });
    expect(result.valid).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ field: 'SKILL.md', severity: 'error' })
    );
  });

  it('should reject non-existent skill directory', async () => {
    const result = await matimoValidateSkill({ name: 'nonexistent', skills_dir: tmpDir });
    expect(result.valid).toBe(false);
    expect(result.message).toContain('not found');
  });

  it('should reject empty name', async () => {
    const result = await matimoValidateSkill({ name: '', skills_dir: tmpDir });
    expect(result.valid).toBe(false);
    expect(result.message).toContain('required');
  });

  // ── Frontmatter validation ──

  it('should report error when frontmatter name does not match directory', async () => {
    writeSkill(
      'my-skill',
      `---
name: different-name
description: A skill with mismatched name
---

# Content
`
    );

    const result = await matimoValidateSkill({ name: 'my-skill', skills_dir: tmpDir });
    expect(result.valid).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ field: 'name', message: expect.stringContaining('must match') })
    );
  });

  it('should report error when missing required frontmatter fields', async () => {
    writeSkill(
      'no-desc',
      `---
name: no-desc
---

# No description
`
    );

    const result = await matimoValidateSkill({ name: 'no-desc', skills_dir: tmpDir });
    expect(result.valid).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ field: 'description', severity: 'error' })
    );
  });

  it('should report error for invalid frontmatter format', async () => {
    writeSkill('bad-format', 'No frontmatter at all');

    const result = await matimoValidateSkill({ name: 'bad-format', skills_dir: tmpDir });
    expect(result.valid).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ field: 'frontmatter', severity: 'error' })
    );
  });

  // ── Best practice warnings ──

  it('should warn when SKILL.md body is empty', async () => {
    writeSkill(
      'empty-body',
      `---
name: empty-body
description: A skill with no body content
---
`
    );

    const result = await matimoValidateSkill({ name: 'empty-body', skills_dir: tmpDir });
    expect(result.valid).toBe(true); // warnings don't make it invalid
    expect(result.issues).toContainEqual(
      expect.objectContaining({ field: 'body', severity: 'warning' })
    );
  });

  it('should warn when SKILL.md body exceeds 500 lines', async () => {
    const longBody = Array.from({ length: 501 }, (_, i) => `Line ${i + 1}`).join('\n');
    writeSkill(
      'long-body',
      `---
name: long-body
description: A skill with very long body
---

${longBody}
`
    );

    const result = await matimoValidateSkill({ name: 'long-body', skills_dir: tmpDir });
    expect(result.valid).toBe(true);
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        field: 'body',
        severity: 'warning',
        message: expect.stringContaining('500 lines'),
      })
    );
  });
});
