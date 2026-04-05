import fs from 'fs';
import path from 'path';
import os from 'os';
import { MatimoInstance } from '../../src/matimo-instance';
import { ErrorCode } from '../../src/errors/matimo-error';
import type { PolicyContext } from '../../src/policy/types';
import type { MatimoEvent } from '../../src/policy/events';

/**
 * Integration tests: policy enforcement across the full MatimoInstance lifecycle.
 */
describe('Policy Integration', () => {
  let tmpDir: string;
  let toolDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'matimo-policy-int-'));
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

  it('should deny execution of deprecated tools when policy is active', async () => {
    writeToolYaml(
      'deprecated-tool',
      `
name: deprecated-tool
version: '1.0.0'
description: 'An old tool'
status: deprecated
deprecated: true
deprecation_message: 'Use new-tool instead'
execution:
  type: http
  method: GET
  url: 'https://api.example.com/data'
`
    );

    const matimo = await MatimoInstance.init({
      toolPaths: [toolDir],
      policyConfig: {},
      logLevel: 'silent',
    });

    const context: PolicyContext = { environment: 'prod' };

    await expect(matimo.execute('deprecated-tool', {}, { context })).rejects.toMatchObject({
      code: ErrorCode.POLICY_DENIED,
    });
  });

  it('should deny execution of draft tools without admin role', async () => {
    writeToolYaml(
      'draft-tool',
      `
name: draft-tool
version: '1.0.0'
description: 'A draft tool'
status: draft
execution:
  type: http
  method: GET
  url: 'https://api.example.com/data'
`
    );

    const matimo = await MatimoInstance.init({
      toolPaths: [toolDir],
      policyConfig: {},
      logLevel: 'silent',
    });

    const context: PolicyContext = { roles: ['reader'] };

    await expect(matimo.execute('draft-tool', {}, { context })).rejects.toMatchObject({
      code: ErrorCode.POLICY_DENIED,
    });
  });

  it('should allow draft tools for admin users', async () => {
    writeToolYaml(
      'draft-tool',
      `
name: draft-tool
version: '1.0.0'
description: 'A draft tool'
status: draft
execution:
  type: command
  command: 'echo'
  args: ['hello']
`
    );

    const matimo = await MatimoInstance.init({
      toolPaths: [toolDir],
      policyConfig: {},
      logLevel: 'silent',
    });

    const context: PolicyContext = { roles: ['admin'] };

    // Should not throw POLICY_DENIED
    const result = await matimo.execute('draft-tool', {}, { context });
    expect(result).toBeDefined();
  });

  it('should filter tools via listTools with policy context', async () => {
    writeToolYaml(
      'visible-tool',
      `
name: visible-tool
version: '1.0.0'
description: 'Visible tool'
execution:
  type: http
  method: GET
  url: 'https://api.example.com/data'
`
    );
    writeToolYaml(
      'deprecated-tool',
      `
name: deprecated-tool
version: '1.0.0'
description: 'Deprecated tool'
deprecated: true
execution:
  type: http
  method: GET
  url: 'https://api.example.com/old'
`
    );

    const matimo = await MatimoInstance.init({
      toolPaths: [toolDir],
      policyConfig: {},
      logLevel: 'silent',
    });

    // Without context: all tools visible
    expect(matimo.listTools()).toHaveLength(2);

    // With context: deprecated filtered out
    const context: PolicyContext = { environment: 'prod' };
    expect(matimo.listTools(context)).toHaveLength(1);
    expect(matimo.listTools(context)[0].name).toBe('visible-tool');
  });

  it('should emit events for policy-denied executions', async () => {
    writeToolYaml(
      'deprecated-tool',
      `
name: deprecated-tool
version: '1.0.0'
description: 'Old tool'
deprecated: true
execution:
  type: http
  method: GET
  url: 'https://api.example.com/data'
`
    );

    const events: MatimoEvent[] = [];
    const matimo = await MatimoInstance.init({
      toolPaths: [toolDir],
      policyConfig: {},
      logLevel: 'silent',
      onEvent: (event) => events.push(event),
    });

    const context: PolicyContext = { agentId: 'test-agent' };

    await expect(matimo.execute('deprecated-tool', {}, { context })).rejects.toMatchObject({
      code: ErrorCode.POLICY_DENIED,
    });

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('tool:execution_denied');
    if (events[0].type === 'tool:execution_denied') {
      expect(events[0].toolName).toBe('deprecated-tool');
      expect(events[0].agentId).toBe('test-agent');
    }
  });

  it('should filter searchTools with policy context', async () => {
    writeToolYaml(
      'search-visible',
      `
name: search-visible
version: '1.0.0'
description: 'Searchable tool'
tags: ['search']
execution:
  type: http
  method: GET
  url: 'https://api.example.com/data'
`
    );
    writeToolYaml(
      'search-deprecated',
      `
name: search-deprecated
version: '1.0.0'
description: 'Deprecated searchable'
deprecated: true
tags: ['search']
execution:
  type: http
  method: GET
  url: 'https://api.example.com/old'
`
    );

    const matimo = await MatimoInstance.init({
      toolPaths: [toolDir],
      policyConfig: {},
      logLevel: 'silent',
    });

    // searchTools with context filters deprecated
    const context: PolicyContext = { environment: 'prod' };
    const results = matimo.searchTools('search', context);
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('search-visible');

    // getToolsByTag with context filters deprecated
    const tagged = matimo.getToolsByTag('search', context);
    expect(tagged).toHaveLength(1);
    expect(tagged[0].name).toBe('search-visible');
  });

  it('should expose hasPolicy and getIntegrityTracker', async () => {
    writeToolYaml(
      'accessor-test',
      `
name: accessor-test
version: '1.0.0'
description: 'Test tool'
execution:
  type: http
  method: GET
  url: 'https://api.example.com/data'
`
    );

    const matimo = await MatimoInstance.init({
      toolPaths: [toolDir],
      policyConfig: {},
      logLevel: 'silent',
    });

    expect(matimo.hasPolicy()).toBe(true);
    expect(matimo.getIntegrityTracker()).toBeDefined();
    expect(matimo.getApprovalManifest()).toBeDefined();
  });

  it('should work without policy (backward compatible)', async () => {
    writeToolYaml(
      'simple-tool',
      `
name: simple-tool
version: '1.0.0'
description: 'Simple tool'
execution:
  type: command
  command: 'echo'
  args: ['hello']
`
    );

    // No policyConfig = no policy engine
    const matimo = await MatimoInstance.init({
      toolPaths: [toolDir],
      logLevel: 'silent',
    });

    expect(matimo.hasPolicy()).toBe(false);

    // Should execute without requiring context
    const result = await matimo.execute('simple-tool', {});
    expect(result).toBeDefined();
  });
});
