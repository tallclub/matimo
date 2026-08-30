import fs from 'fs';
import path from 'path';
import os from 'os';
import matimoGetTool from '../../../tools/matimo_get_tool/matimo_get_tool';

describe('matimo_get_tool', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'matimo-get-tool-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function writeToolYaml(name: string, yaml: string): void {
    const toolDir = path.join(tmpDir, name);
    fs.mkdirSync(toolDir, { recursive: true });
    fs.writeFileSync(path.join(toolDir, 'definition.yaml'), yaml, 'utf-8');
  }

  it('should retrieve an existing tool', async () => {
    writeToolYaml(
      'my-tool',
      `
name: my-tool
version: '1.0.0'
description: 'A tool'
execution:
  type: http
  method: GET
  url: 'https://api.example.com/data'
`
    );

    const result = await matimoGetTool({ name: 'my-tool', tool_dir: tmpDir });
    expect(result.found).toBe(true);
    expect(result.name).toBe('my-tool');
    expect(result.definition).toBeDefined();
  });

  it('should return not-found for a missing tool', async () => {
    const result = await matimoGetTool({ name: 'nonexistent', tool_dir: tmpDir });
    expect(result.found).toBe(false);
  });

  it('should reject names with path traversal (../)', async () => {
    // A real file exists one directory above tmpDir's tool root; traversal must not reach it.
    const outsideName = `outside-secret-${Date.now()}`;
    fs.writeFileSync(
      path.join(path.dirname(tmpDir), `${outsideName}.yaml`),
      'name: leaked\nversion: "1.0.0"\n'
    );

    const result = await matimoGetTool({
      name: `../${outsideName}.yaml`,
      tool_dir: tmpDir,
    });

    expect(result.found).toBe(false);
    expect(result.message).toContain('invalid characters');
  });

  it('should reject names with backslash traversal', async () => {
    const result = await matimoGetTool({ name: '..\\..\\secrets', tool_dir: tmpDir });
    expect(result.found).toBe(false);
    expect(result.message).toContain('invalid characters');
  });

  it('should reject names with control characters', async () => {
    const result = await matimoGetTool({ name: 'tool\x00name', tool_dir: tmpDir });
    expect(result.found).toBe(false);
    expect(result.message).toContain('invalid characters');
  });

  it('should reject an empty name', async () => {
    const result = await matimoGetTool({ name: '', tool_dir: tmpDir });
    expect(result.found).toBe(false);
  });
});
