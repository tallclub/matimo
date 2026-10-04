import fs from 'fs';
import os from 'os';
import path from 'path';
import { MatimoInstance } from '../../src/matimo-instance';

/**
 * ReloadResult counts mean the same in both SDKs; the Python twin is
 * TestMatimoReload.test_reload_counts_match_typescript.
 */
describe('reloadTools() result counts', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'matimo-reload-result-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function writeTool(dir: string, name: string, extra = ''): void {
    fs.mkdirSync(path.join(dir, name), { recursive: true });
    fs.writeFileSync(
      path.join(dir, name, 'definition.yaml'),
      `name: ${name}\nversion: '1.0.0'\ndescription: ${name}\n${extra}execution:\n  type: http\n  method: GET\n  url: https://${name}.example.com\n`
    );
  }

  it('counts every registered tool as loaded and each re-checked untrusted tool as revalidated', async () => {
    const trustedDir = path.join(tmpDir, 'trusted');
    const untrustedDir = path.join(tmpDir, 'untrusted');
    writeTool(trustedDir, 'tool_a');
    writeTool(untrustedDir, 'tool_b', 'status: draft\nrequires_approval: true\n');
    const matimo = await MatimoInstance.init({
      toolPaths: [trustedDir, untrustedDir],
      untrustedPaths: [untrustedDir],
      logLevel: 'silent',
    });

    const result = await matimo.reloadTools();

    expect(result.loaded).toBe(2);
    expect(result.revalidated).toBe(1);
    expect(result.rejected).toEqual([]);
  });
});
