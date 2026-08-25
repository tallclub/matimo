import fs from 'fs';
import path from 'path';
import os from 'os';
import matimoGetToolStatus from '../../../tools/matimo_get_tool_status/matimo_get_tool_status';

describe('matimo_get_tool_status', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'matimo-get-tool-status-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function writeToolYaml(name: string, yaml: string): void {
    const toolDir = path.join(tmpDir, name);
    fs.mkdirSync(toolDir, { recursive: true });
    fs.writeFileSync(path.join(toolDir, 'definition.yaml'), yaml, 'utf-8');
  }

  it('should retrieve status for an existing tool', async () => {
    writeToolYaml(
      'my-tool',
      `
name: my-tool
version: '1.0.0'
description: 'A tool'
status: draft
execution:
  type: http
  method: GET
  url: 'https://api.example.com/data'
`
    );

    const result = await matimoGetToolStatus({ name: 'my-tool', tool_dir: tmpDir });
    expect(result.found).toBe(true);
    expect(result.name).toBe('my-tool');
    expect(result.riskLevel).toBeDefined();
  });

  it('should return not-found for a missing tool', async () => {
    const result = await matimoGetToolStatus({ name: 'nonexistent', tool_dir: tmpDir });
    expect(result.found).toBe(false);
  });

  it('should reject names with path traversal (../)', async () => {
    const result = await matimoGetToolStatus({
      name: '../../../etc/passwd',
      tool_dir: tmpDir,
    });
    expect(result.found).toBe(false);
    expect(result.message).toContain('invalid characters');
  });

  it('should reject names with backslash traversal', async () => {
    const result = await matimoGetToolStatus({ name: '..\\..\\secrets', tool_dir: tmpDir });
    expect(result.found).toBe(false);
    expect(result.message).toContain('invalid characters');
  });

  it('should reject names with control characters', async () => {
    const result = await matimoGetToolStatus({ name: 'tool\x00name', tool_dir: tmpDir });
    expect(result.found).toBe(false);
    expect(result.message).toContain('invalid characters');
  });
});
