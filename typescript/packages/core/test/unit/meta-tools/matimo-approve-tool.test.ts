import fs from 'fs';
import path from 'path';
import os from 'os';
import matimoApproveTool from '../../../tools/matimo_approve_tool/matimo_approve_tool';

describe('matimo_approve_tool', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'matimo-approve-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function writeToolYaml(name: string, yaml: string): void {
    const toolDir = path.join(tmpDir, name);
    fs.mkdirSync(toolDir, { recursive: true });
    fs.writeFileSync(path.join(toolDir, 'definition.yaml'), yaml, 'utf-8');
  }

  it('should approve a valid draft tool', async () => {
    writeToolYaml(
      'my-tool',
      `
name: my-tool
version: '1.0.0'
description: 'A tool to approve'
status: draft
requires_approval: true
execution:
  type: http
  method: GET
  url: 'https://api.example.com/data'
`
    );

    const result = await matimoApproveTool({
      name: 'my-tool',
      tool_dir: tmpDir,
    });

    expect(result.success).toBe(true);
    expect(result.name).toBe('my-tool');
    expect(result.hash).toBeDefined();
    expect(result.approvedAt).toBeDefined();

    // Verify YAML on disk was updated
    const content = fs.readFileSync(path.join(tmpDir, 'my-tool', 'definition.yaml'), 'utf-8');
    expect(content).toContain('status: approved');
  });

  it('should create approval manifest file', async () => {
    writeToolYaml(
      'my-tool',
      `
name: my-tool
version: '1.0.0'
description: 'A tool to approve'
status: draft
requires_approval: true
execution:
  type: http
  method: GET
  url: 'https://api.example.com/data'
`
    );

    await matimoApproveTool({
      name: 'my-tool',
      tool_dir: tmpDir,
    });

    const manifestPath = path.join(tmpDir, '.matimo-approvals.json');
    expect(fs.existsSync(manifestPath)).toBe(true);

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    expect(manifest.version).toBe('1');
    expect(manifest.approvals).toBeDefined();
    const approval = manifest.approvals.find((a: { name: string }) => a.name === 'my-tool');
    expect(approval).toBeDefined();
    expect(approval.signature).toBeDefined();
  });

  it('should return error for non-existent tool', async () => {
    const result = await matimoApproveTool({
      name: 'nonexistent',
      tool_dir: tmpDir,
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain('not found');
  });

  it('should reject tool with policy violations', async () => {
    writeToolYaml(
      'ssrf-tool',
      `
name: ssrf-tool
version: '1.0.0'
description: 'SSRF tool'
status: draft
requires_approval: true
execution:
  type: http
  method: GET
  url: 'http://169.254.169.254/latest/meta-data'
`
    );

    const result = await matimoApproveTool({
      name: 'ssrf-tool',
      tool_dir: tmpDir,
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain('policy violations');
  });

  it('should use provided approval secret', async () => {
    writeToolYaml(
      'my-tool',
      `
name: my-tool
version: '1.0.0'
description: 'A tool'
status: draft
requires_approval: true
execution:
  type: http
  method: GET
  url: 'https://api.example.com/data'
`
    );

    const result = await matimoApproveTool(
      {
        name: 'my-tool',
        tool_dir: tmpDir,
      },
      { credentials: { MATIMO_APPROVAL_SECRET: 'test-secret-123' } }
    );

    expect(result.success).toBe(true);
  });
});
