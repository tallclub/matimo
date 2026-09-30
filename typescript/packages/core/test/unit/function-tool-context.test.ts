import fs from 'fs';
import os from 'os';
import path from 'path';
import { MatimoInstance } from '../../src/matimo-instance';

/**
 * Function tools receive the host-supplied PolicyContext as
 * `context.policyContext`, next to per-call credentials.
 */
describe('function tool context', () => {
  let toolDir: string;
  let matimo: MatimoInstance;

  beforeAll(async () => {
    toolDir = fs.mkdtempSync(path.join(os.tmpdir(), 'matimo-fn-context-'));
    const dir = path.join(toolDir, 'whoami');
    fs.mkdirSync(dir);
    fs.writeFileSync(
      path.join(dir, 'definition.yaml'),
      "name: whoami\nversion: '1.0.0'\nrisk: low\ndescription: Echo the call context\nexecution:\n  type: function\n  code: './whoami.js'\n"
    );
    fs.writeFileSync(
      path.join(dir, 'whoami.js'),
      'module.exports = async (_params, context) => ({ context: context ?? null });\n'
    );
    matimo = await MatimoInstance.init({ toolPaths: [toolDir], logLevel: 'silent' });
  });

  afterAll(() => fs.rmSync(toolDir, { recursive: true, force: true }));

  it('passes the caller policy context', async () => {
    const context = { agentId: 'agent-7', roles: ['admin'] };
    await expect(matimo.execute('whoami', {}, { context })).resolves.toEqual({
      context: { policyContext: context },
    });
  });

  it('passes credentials and policy context together', async () => {
    const result = await matimo.execute(
      'whoami',
      {},
      { context: { agentId: 'a' }, credentials: { TOKEN: 't' } }
    );
    expect(result).toEqual({
      context: { credentials: { TOKEN: 't' }, policyContext: { agentId: 'a' } },
    });
  });

  it('passes no context when there is none (backward compatible)', async () => {
    await expect(matimo.execute('whoami', {})).resolves.toEqual({ context: null });
  });
});
