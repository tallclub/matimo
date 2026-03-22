import fs from 'fs';
import path from 'path';
import os from 'os';
import matimoCreateTool from '../../../tools/matimo_create_tool/matimo_create_tool';

describe('matimo_create_tool', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'matimo-create-tool-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should create a valid tool on disk with draft status', async () => {
    const yaml = `
version: '1.0.0'
description: 'A test tool'
execution:
  type: http
  method: GET
  url: 'https://api.example.com/data'
`;

    const result = await matimoCreateTool({
      name: 'test_tool',
      yaml_content: yaml,
      target_dir: tmpDir,
    });

    expect(result.success).toBe(true);
    expect(result.status).toBe('draft');
    expect(result.path).toBeDefined();
    expect(fs.existsSync(result.path!)).toBe(true);

    // Verify the YAML on disk has forced fields
    const content = fs.readFileSync(result.path!, 'utf-8');
    expect(content).toContain('status: draft');
    expect(content).toContain('requires_approval: true');
    expect(content).toContain('name: test_tool');
  });

  it('should reject names with path traversal', async () => {
    const result = await matimoCreateTool({
      name: '../escape',
      yaml_content:
        'name: test\nversion: "1.0.0"\ndescription: test\nexecution:\n  type: http\n  method: GET\n  url: https://example.com',
      target_dir: tmpDir,
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain('invalid characters');
  });

  it('should reject names starting with matimo_ namespace', async () => {
    const result = await matimoCreateTool({
      name: 'matimo_internal',
      yaml_content:
        'version: "1.0.0"\ndescription: test\nexecution:\n  type: http\n  method: GET\n  url: https://example.com',
      target_dir: tmpDir,
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain('reserved namespace');
  });

  it('should reject tools with SSRF URLs', async () => {
    const yaml = `
version: '1.0.0'
description: 'SSRF tool'
execution:
  type: http
  method: GET
  url: 'http://localhost:8080/admin'
`;

    const result = await matimoCreateTool({
      name: 'ssrf_tool',
      yaml_content: yaml,
      target_dir: tmpDir,
    });

    expect(result.success).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors!.some((e: string) => e.includes('no-ssrf'))).toBe(true);
  });

  it('should reject function-type tools', async () => {
    const yaml = `
version: '1.0.0'
description: 'Function tool'
execution:
  type: function
  code: './evil.ts'
`;

    const result = await matimoCreateTool({
      name: 'func_tool',
      yaml_content: yaml,
      target_dir: tmpDir,
    });

    expect(result.success).toBe(false);
    expect(result.errors).toBeDefined();
  });

  it('should add comment headers when proposed_by and justification provided', async () => {
    const yaml = `
version: '1.0.0'
description: 'A test tool'
execution:
  type: http
  method: GET
  url: 'https://api.example.com/data'
`;

    const result = await matimoCreateTool({
      name: 'documented_tool',
      yaml_content: yaml,
      target_dir: tmpDir,
      proposed_by: 'agent-007',
      justification: 'Need to fetch data',
    });

    expect(result.success).toBe(true);
    const content = fs.readFileSync(result.path!, 'utf-8');
    expect(content).toContain('# Proposed by: agent-007');
    expect(content).toContain('# Justification: Need to fetch data');
  });

  it('should reject empty names', async () => {
    const result = await matimoCreateTool({
      name: '',
      yaml_content: 'name: test',
      target_dir: tmpDir,
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain('required');
  });

  it('should reject invalid YAML', async () => {
    const result = await matimoCreateTool({
      name: 'bad_yaml',
      yaml_content: ': : [invalid',
      target_dir: tmpDir,
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain('YAML parse error');
  });
});
