import fs from 'fs';
import os from 'os';
import path from 'path';
import { MatimoInstance } from '../../src/matimo-instance';
import {
  getGlobalApprovalHandler,
  type ApprovalRequest,
} from '../../src/approval/approval-handler';

/**
 * InitOptions.onApproval / setApprovalCallback(): the per-call approval
 * callback belongs to the instance, so two instances (e.g. two tenants)
 * never share a reviewer. The global handler's callback is only a fallback.
 */
describe('MatimoInstance per-instance approval callback', () => {
  jest.setTimeout(15000);

  let toolDir: string;

  beforeEach(() => {
    toolDir = fs.mkdtempSync(path.join(os.tmpdir(), 'matimo-on-approval-'));
    const dir = path.join(toolDir, 'guarded-echo');
    fs.mkdirSync(dir);
    fs.writeFileSync(
      path.join(dir, 'definition.yaml'),
      [
        'name: guarded-echo',
        "version: '1.0.0'",
        'description: Echo that always needs approval',
        'requires_approval: true',
        'parameters:',
        '  text:',
        '    type: string',
        '    description: Text to echo',
        '    required: true',
        'execution:',
        '  type: command',
        '  command: echo',
        "  args: ['{text}']",
        '',
      ].join('\n')
    );
  });

  afterEach(() => {
    getGlobalApprovalHandler().setApprovalCallback(null);
    fs.rmSync(toolDir, { recursive: true, force: true });
  });

  const init = (onApproval?: (r: ApprovalRequest) => Promise<boolean>) =>
    MatimoInstance.init({ toolPaths: [toolDir], logLevel: 'silent', onApproval });

  it('asks onApproval with the call details and runs when approved', async () => {
    const requests: ApprovalRequest[] = [];
    const matimo = await init(async (r) => {
      requests.push(r);
      return true;
    });

    await expect(matimo.execute('guarded-echo', { text: 'hi' })).resolves.toBeDefined();
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({ toolName: 'guarded-echo', params: { text: 'hi' } });
  });

  it('blocks the call when onApproval rejects', async () => {
    const matimo = await init(async () => false);
    await expect(matimo.execute('guarded-echo', { text: 'hi' })).rejects.toThrow(
      /rejected by approval handler: guarded-echo/
    );
  });

  it('takes precedence over the global approval handler callback', async () => {
    const globalCallback = jest.fn(async () => false);
    getGlobalApprovalHandler().setApprovalCallback(globalCallback);
    const matimo = await init(async () => true);

    await expect(matimo.execute('guarded-echo', { text: 'hi' })).resolves.toBeDefined();
    expect(globalCallback).not.toHaveBeenCalled();
  });

  it('keeps instances isolated from each other', async () => {
    const tenantA = jest.fn(async () => true);
    const tenantB = jest.fn(async () => false);
    const a = await init(tenantA);
    const b = await init(tenantB);

    await expect(a.execute('guarded-echo', { text: 'a' })).resolves.toBeDefined();
    await expect(b.execute('guarded-echo', { text: 'b' })).rejects.toThrow(/rejected/);
    expect(tenantA).toHaveBeenCalledTimes(1);
    expect(tenantB).toHaveBeenCalledTimes(1);
  });

  it('falls back to the global callback once cleared with setApprovalCallback(null)', async () => {
    const globalCallback = jest.fn(async () => true);
    getGlobalApprovalHandler().setApprovalCallback(globalCallback);
    const matimo = await init(async () => false);
    matimo.setApprovalCallback(null);

    await expect(matimo.execute('guarded-echo', { text: 'hi' })).resolves.toBeDefined();
    expect(globalCallback).toHaveBeenCalledTimes(1);
  });

  it('fails closed when no callback is configured anywhere', async () => {
    const matimo = await init();
    await expect(matimo.execute('guarded-echo', { text: 'hi' })).rejects.toThrow(
      /requires approval: guarded-echo/
    );
  });
});
