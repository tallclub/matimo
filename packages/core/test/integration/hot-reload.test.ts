import fs from 'fs';
import path from 'path';
import os from 'os';
import { MatimoInstance } from '../../src/matimo-instance';
import type { MatimoEvent } from '../../src/policy/events';

/**
 * Tests for MatimoInstance.reloadTools() hot-reload behavior:
 * adding, removing, modifying tools, and integrity tracking.
 */
describe('Hot Reload', () => {
  let tmpDir: string;
  let toolDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'matimo-hotreload-'));
    toolDir = path.join(tmpDir, 'tools');
    fs.mkdirSync(toolDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function writeToolYaml(name: string, yaml: string, dir = toolDir): string {
    const toolDirPath = path.join(dir, name);
    fs.mkdirSync(toolDirPath, { recursive: true });
    const filePath = path.join(toolDirPath, 'definition.yaml');
    fs.writeFileSync(filePath, yaml, 'utf-8');
    return filePath;
  }

  it('should pick up new tools added to disk after reload', async () => {
    writeToolYaml(
      'tool-a',
      `
name: tool-a
version: '1.0.0'
description: 'Tool A'
execution:
  type: command
  command: 'echo'
  args: ['a']
`
    );

    const matimo = await MatimoInstance.init({
      toolPaths: [toolDir],
      logLevel: 'silent',
    });

    expect(matimo.listTools()).toHaveLength(1);

    // Add a new tool on disk
    writeToolYaml(
      'tool-b',
      `
name: tool-b
version: '1.0.0'
description: 'Tool B'
execution:
  type: command
  command: 'echo'
  args: ['b']
`
    );

    const result = await matimo.reloadTools();
    expect(result.loaded).toBe(2);
    expect(matimo.listTools()).toHaveLength(2);
    const names = matimo
      .listTools()
      .map((t) => t.name)
      .sort();
    expect(names).toEqual(['tool-a', 'tool-b']);
  });

  it('should remove tools deleted from disk after reload', async () => {
    writeToolYaml(
      'tool-a',
      `
name: tool-a
version: '1.0.0'
description: 'Tool A'
execution:
  type: command
  command: 'echo'
  args: ['a']
`
    );
    writeToolYaml(
      'tool-b',
      `
name: tool-b
version: '1.0.0'
description: 'Tool B'
execution:
  type: command
  command: 'echo'
  args: ['b']
`
    );

    const matimo = await MatimoInstance.init({
      toolPaths: [toolDir],
      logLevel: 'silent',
    });

    expect(matimo.listTools()).toHaveLength(2);

    // Remove tool-b from disk
    fs.rmSync(path.join(toolDir, 'tool-b'), { recursive: true });

    const result = await matimo.reloadTools();
    expect(result.loaded).toBe(1);
    expect(result.removed).toBe(1);
    expect(matimo.listTools()).toHaveLength(1);
    expect(matimo.listTools()[0].name).toBe('tool-a');
  });

  it('should detect modification and track integrity changes', async () => {
    writeToolYaml(
      'tool-a',
      `
name: tool-a
version: '1.0.0'
description: 'Original description'
execution:
  type: command
  command: 'echo'
  args: ['original']
`
    );

    const matimo = await MatimoInstance.init({
      toolPaths: [toolDir],
      logLevel: 'silent',
    });

    const tracker = matimo.getIntegrityTracker();

    // First reload to baseline the tracker
    await matimo.reloadTools();
    const originalHash = tracker.getHash('tool-a');
    expect(originalHash).toBeDefined();

    // Modify tool on disk
    writeToolYaml(
      'tool-a',
      `
name: tool-a
version: '1.0.0'
description: 'Updated description'
execution:
  type: command
  command: 'echo'
  args: ['updated']
`
    );

    await matimo.reloadTools();

    const newHash = tracker.getHash('tool-a');
    expect(newHash).toBeDefined();
    expect(newHash).not.toBe(originalHash);
  });

  it('should reject untrusted tools that fail policy validation on reload', async () => {
    const untrustedDir = path.join(tmpDir, 'untrusted');
    fs.mkdirSync(untrustedDir, { recursive: true });

    // Write a trusted tool
    writeToolYaml(
      'trusted-tool',
      `
name: trusted-tool
version: '1.0.0'
description: 'Trusted tool'
execution:
  type: command
  command: 'echo'
  args: ['safe']
`
    );

    const matimo = await MatimoInstance.init({
      toolPaths: [toolDir, untrustedDir],
      policyConfig: {
        allowCommandTools: false,
      },
      untrustedPaths: [untrustedDir],
      logLevel: 'silent',
    });

    expect(matimo.listTools()).toHaveLength(1);

    // Add a command tool in untrusted path — should be rejected by policy
    writeToolYaml(
      'bad-tool',
      `
name: bad-tool
version: '1.0.0'
description: 'Bad command tool'
execution:
  type: command
  command: 'rm'
  args: ['-rf', '/']
`,
      untrustedDir
    );

    const result = await matimo.reloadTools();
    expect(result.rejected.length).toBeGreaterThan(0);
    expect(result.rejected).toContain('bad-tool');
    // The trusted tool should still be loaded
    const names = matimo.listTools().map((t) => t.name);
    expect(names).toContain('trusted-tool');
    expect(names).not.toContain('bad-tool');
  });

  it('should emit tools:reloaded event after reload', async () => {
    writeToolYaml(
      'tool-a',
      `
name: tool-a
version: '1.0.0'
description: 'Tool A'
execution:
  type: command
  command: 'echo'
  args: ['a']
`
    );

    const events: MatimoEvent[] = [];
    const matimo = await MatimoInstance.init({
      toolPaths: [toolDir],
      logLevel: 'silent',
      onEvent: (event) => events.push(event),
    });

    await matimo.reloadTools();

    const reloadEvents = events.filter((e) => e.type === 'tools:reloaded');
    expect(reloadEvents).toHaveLength(1);
    if (reloadEvents[0].type === 'tools:reloaded') {
      expect(reloadEvents[0].loaded).toBe(1);
    }
  });

  it('should not produce duplicate registrations on repeated reloads', async () => {
    writeToolYaml(
      'tool-a',
      `
name: tool-a
version: '1.0.0'
description: 'Tool A'
execution:
  type: command
  command: 'echo'
  args: ['a']
`
    );

    const matimo = await MatimoInstance.init({
      toolPaths: [toolDir],
      logLevel: 'silent',
    });

    expect(matimo.listTools()).toHaveLength(1);

    // Reload multiple times
    await matimo.reloadTools();
    await matimo.reloadTools();
    await matimo.reloadTools();

    expect(matimo.listTools()).toHaveLength(1);
  });
});
