import fs from 'fs';
import path from 'path';
import os from 'os';
import matimoListUserTools from '../../../tools/matimo_list_user_tools/matimo_list_user_tools';

describe('matimo_list_user_tools', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'matimo-list-tools-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function writeToolYaml(name: string, yaml: string): void {
    const toolDir = path.join(tmpDir, name);
    fs.mkdirSync(toolDir, { recursive: true });
    fs.writeFileSync(path.join(toolDir, 'definition.yaml'), yaml, 'utf-8');
  }

  it('should list tools in the directory', async () => {
    writeToolYaml(
      'tool-a',
      `
name: tool-a
version: '1.0.0'
description: 'Tool A'
execution:
  type: http
  method: GET
  url: 'https://api.example.com/a'
`
    );
    writeToolYaml(
      'tool-b',
      `
name: tool-b
version: '1.0.0'
description: 'Tool B'
tags:
  - testing
execution:
  type: http
  method: POST
  url: 'https://api.example.com/b'
  body:
    key: value
`
    );

    const result = await matimoListUserTools({ tool_dir: tmpDir });
    expect(result.total).toBe(2);
    expect(result.tools.map((t: { name: string }) => t.name).sort()).toEqual(['tool-a', 'tool-b']);
  });

  it('should include risk level for each tool', async () => {
    writeToolYaml(
      'get-tool',
      `
name: get-tool
version: '1.0.0'
description: 'GET tool'
execution:
  type: http
  method: GET
  url: 'https://api.example.com/data'
`
    );
    writeToolYaml(
      'delete-tool',
      `
name: delete-tool
version: '1.0.0'
description: 'DELETE tool'
execution:
  type: http
  method: DELETE
  url: 'https://api.example.com/data'
`
    );

    const result = await matimoListUserTools({ tool_dir: tmpDir });
    const getTool = result.tools.find((t: { name: string }) => t.name === 'get-tool');
    const deleteTool = result.tools.find((t: { name: string }) => t.name === 'delete-tool');

    expect(getTool?.riskLevel).toBe('low');
    expect(deleteTool?.riskLevel).toBe('high');
  });

  it('should filter out draft tools when include_drafts is false', async () => {
    writeToolYaml(
      'approved-tool',
      `
name: approved-tool
version: '1.0.0'
description: 'Approved tool'
status: approved
execution:
  type: http
  method: GET
  url: 'https://api.example.com/data'
`
    );
    writeToolYaml(
      'draft-tool',
      `
name: draft-tool
version: '1.0.0'
description: 'Draft tool'
status: draft
execution:
  type: http
  method: GET
  url: 'https://api.example.com/data'
`
    );

    const result = await matimoListUserTools({
      tool_dir: tmpDir,
      include_drafts: false,
    });

    expect(result.total).toBe(1);
    expect(result.tools[0].name).toBe('approved-tool');
  });

  it('should include draft tools by default', async () => {
    writeToolYaml(
      'draft-tool',
      `
name: draft-tool
version: '1.0.0'
description: 'Draft tool'
status: draft
execution:
  type: http
  method: GET
  url: 'https://api.example.com/data'
`
    );

    const result = await matimoListUserTools({ tool_dir: tmpDir });
    expect(result.total).toBe(1);
    expect(result.tools[0].status).toBe('draft');
  });

  it('should return empty list for non-existent directory', async () => {
    const result = await matimoListUserTools({
      tool_dir: '/nonexistent/path',
    });

    expect(result.tools).toHaveLength(0);
    expect(result.total).toBe(0);
  });

  it('should skip invalid tool definitions gracefully', async () => {
    writeToolYaml(
      'valid-tool',
      `
name: valid-tool
version: '1.0.0'
description: 'Valid tool'
execution:
  type: http
  method: GET
  url: 'https://api.example.com/data'
`
    );
    writeToolYaml('invalid-tool', `invalid: [yaml content`);

    const result = await matimoListUserTools({ tool_dir: tmpDir });
    expect(result.total).toBe(1);
    expect(result.tools[0].name).toBe('valid-tool');
  });
});
