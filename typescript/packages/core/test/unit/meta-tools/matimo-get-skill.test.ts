import fs from 'fs';
import path from 'path';
import os from 'os';
import matimoGetSkill from '../../../tools/matimo_get_skill/matimo_get_skill';

describe('matimo_get_skill', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'matimo-get-skill-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function writeSkill(name: string, content: string): void {
    const skillDir = path.join(tmpDir, name);
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(path.join(skillDir, 'SKILL.md'), content, 'utf-8');
  }

  function writeResource(skillName: string, filePath: string, content: string): void {
    const fullPath = path.join(tmpDir, skillName, filePath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content, 'utf-8');
  }

  // ── Level 2: SKILL.md retrieval ──

  it('should retrieve a valid skill (Level 2)', async () => {
    const content = `---
name: code-review
description: Guidelines for reviewing code
---

# Code Review Skill

Always check for:
- Error handling
- Edge cases
- Performance implications
`;
    writeSkill('code-review', content);

    const result = await matimoGetSkill({ name: 'code-review', skills_dir: tmpDir });
    expect(result.success).toBe(true);
    expect(result.name).toBe('code-review');
    expect(result.description).toBe('Guidelines for reviewing code');
    expect(result.content).toContain('Error handling');
    expect(result.content).toContain('Edge cases');
    expect(result.path).toContain(path.join('code-review', 'SKILL.md'));
  });

  it('should return full content including frontmatter', async () => {
    const content = `---
name: testing
description: Testing best practices
---

# Testing

Write unit tests first.
`;
    writeSkill('testing', content);

    const result = await matimoGetSkill({ name: 'testing', skills_dir: tmpDir });
    expect(result.success).toBe(true);
    expect(result.content).toContain('---');
    expect(result.content).toContain('name: testing');
    expect(result.content).toContain('Write unit tests first.');
  });

  it('should return optional frontmatter fields', async () => {
    writeSkill(
      'licensed-skill',
      `---
name: licensed-skill
description: A skill with license and compatibility
license: MIT
compatibility: Requires python3
---

# Licensed Skill
`
    );

    const result = await matimoGetSkill({ name: 'licensed-skill', skills_dir: tmpDir });
    expect(result.success).toBe(true);
    expect(result.license).toBe('MIT');
    expect(result.compatibility).toBe('Requires python3');
  });

  it('should return metadata from frontmatter', async () => {
    writeSkill(
      'meta-skill',
      `---
name: meta-skill
description: A skill with metadata
metadata:
  author: test-user
  version: "1.0"
---

# Meta Skill
`
    );

    const result = await matimoGetSkill({ name: 'meta-skill', skills_dir: tmpDir });
    expect(result.success).toBe(true);
    expect(result.metadata).toEqual({
      author: 'test-user',
      version: '1.0',
    });
  });

  // ── Level 3: Bundled resource listing ──

  it('should list bundled resources in response', async () => {
    writeSkill(
      'pdf-skill',
      `---
name: pdf-skill
description: PDF processing skill
---

# PDF Processing
`
    );
    writeResource('pdf-skill', 'scripts/extract.py', '# extraction script');
    writeResource('pdf-skill', 'references/FORMS.md', '# Forms guide');
    writeResource('pdf-skill', 'assets/template.docx', 'template content');

    const result = await matimoGetSkill({ name: 'pdf-skill', skills_dir: tmpDir });
    expect(result.success).toBe(true);
    expect(result.resources).toBeDefined();
    expect(result.resources!.scripts).toContain('scripts/extract.py');
    expect(result.resources!.references).toContain('references/FORMS.md');
    expect(result.resources!.assets).toContain('assets/template.docx');
  });

  it('should return empty resources for skill with no bundled files', async () => {
    writeSkill(
      'simple-skill',
      `---
name: simple-skill
description: A simple skill
---

# Simple
`
    );

    const result = await matimoGetSkill({ name: 'simple-skill', skills_dir: tmpDir });
    expect(result.success).toBe(true);
    expect(result.resources).toBeDefined();
    expect(result.resources!.scripts).toEqual([]);
    expect(result.resources!.references).toEqual([]);
    expect(result.resources!.assets).toEqual([]);
    expect(result.resources!.other).toEqual([]);
  });

  // ── Level 3: Read specific bundled file ──

  it('should read a specific bundled resource file', async () => {
    writeSkill(
      'data-skill',
      `---
name: data-skill
description: Data processing
---

# Data
`
    );
    writeResource('data-skill', 'scripts/parse.py', 'import json\nprint("parsed")');

    const result = await matimoGetSkill({
      name: 'data-skill',
      skills_dir: tmpDir,
      file: 'scripts/parse.py',
    });
    expect(result.success).toBe(true);
    expect(result.content).toBe('import json\nprint("parsed")');
    expect(result.path).toContain(path.join('scripts', 'parse.py'));
    // resources should NOT be included when reading a specific file
    expect(result.resources).toBeUndefined();
  });

  it('should fail when reading a non-existent resource file', async () => {
    writeSkill(
      'some-skill',
      `---
name: some-skill
description: Some skill
---

# Content
`
    );

    const result = await matimoGetSkill({
      name: 'some-skill',
      skills_dir: tmpDir,
      file: 'scripts/missing.py',
    });
    expect(result.success).toBe(false);
    expect(result.message).toContain('not found');
  });

  // ── Error cases ──

  it('should fail for non-existent skill', async () => {
    const result = await matimoGetSkill({ name: 'nonexistent', skills_dir: tmpDir });
    expect(result.success).toBe(false);
    expect(result.message).toContain('not found');
  });

  it('should reject empty name', async () => {
    const result = await matimoGetSkill({ name: '', skills_dir: tmpDir });
    expect(result.success).toBe(false);
    expect(result.message).toContain('required');
  });

  it('should reject names with path traversal', async () => {
    const result = await matimoGetSkill({ name: '../escape', skills_dir: tmpDir });
    expect(result.success).toBe(false);
    expect(result.message).toContain('invalid characters');
  });

  it('should reject names with backslashes', async () => {
    const result = await matimoGetSkill({ name: 'test\\..\\escape', skills_dir: tmpDir });
    expect(result.success).toBe(false);
    expect(result.message).toContain('invalid characters');
  });

  it('should reject file paths with path traversal', async () => {
    writeSkill(
      'safe-skill',
      `---
name: safe-skill
description: Safe skill
---

# Content
`
    );

    const result = await matimoGetSkill({
      name: 'safe-skill',
      skills_dir: tmpDir,
      file: '../../etc/passwd',
    });
    expect(result.success).toBe(false);
    expect(result.message).toContain('invalid characters');
  });

  it('should use default skills_dir when not specified', async () => {
    const result = await matimoGetSkill({ name: 'nonexistent' });
    expect(result.success).toBe(false);
    expect(result.message).toContain('not found');
  });

  it('should handle skill with minimal frontmatter', async () => {
    writeSkill(
      'minimal',
      `---
name: minimal
description: Minimal skill
---

Minimal content.
`
    );

    const result = await matimoGetSkill({ name: 'minimal', skills_dir: tmpDir });
    expect(result.success).toBe(true);
    expect(result.name).toBe('minimal');
    expect(result.content).toContain('Minimal content.');
  });
});
