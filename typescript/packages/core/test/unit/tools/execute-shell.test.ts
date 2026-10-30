import {
  ApprovalHandler,
  requiresMandatoryHumanApproval,
} from '../../../src/approval/approval-handler';
import executeTool from '../../../tools/execute/execute';

const isWin = process.platform === 'win32';
const sh = isWin ? 'cmd' : '/bin/sh';

describe('execute: args', () => {
  it('appends args to the command, one argument each', async () => {
    const r = await executeTool({ command: 'node', args: ['-e', "console.log('a b')"] });
    expect(r.success).toBe(true);
    expect(r.stdout).toBe('a b');
  });

  it('rejects non-string args', async () => {
    await expect(
      executeTool({ command: 'node', args: [1 as unknown as string] })
    ).rejects.toThrow('Invalid args');
  });
});

describe('execute: shell opt-in', () => {
  it('rejects shell metacharacters without a shell', async () => {
    await expect(executeTool({ command: 'node -v | cat' })).rejects.toThrow(
      'Command injection detected'
    );
  });

  it('runs a pipeline through the given shell', async () => {
    const r = await executeTool({
      command: isWin ? 'echo hi | findstr hi' : 'echo hi | cat',
      shell: sh,
    });
    expect(r.success).toBe(true);
    expect(r.stdout).toBe('hi');
  });

  it('passes args to POSIX shells as positional parameters', async () => {
    if (isWin) return;
    const r = await executeTool({ command: 'echo "$1-$2"', args: ['a', 'b c'], shell: sh });
    expect(r.stdout).toBe('a-b c');
  });

  it('rejects args for cmd and PowerShell', async () => {
    await expect(executeTool({ command: 'echo', args: ['x'], shell: 'cmd.exe' })).rejects.toThrow(
      'Invalid args'
    );
    await expect(executeTool({ command: 'echo', args: ['x'], shell: 'pwsh' })).rejects.toThrow(
      'Invalid args'
    );
  });

  it('rejects a multi-line or non-string shell', async () => {
    await expect(executeTool({ command: 'echo', shell: 'sh\nrm' })).rejects.toThrow(
      'Invalid shell'
    );
    await expect(
      executeTool({ command: 'echo', shell: true as unknown as string })
    ).rejects.toThrow('Invalid shell');
  });
});

describe('execute with shell: mandatory human approval', () => {
  const OLD_ENV = { ...process.env };
  afterEach(() => {
    process.env = { ...OLD_ENV };
  });

  it('flags only execute calls that carry a shell', () => {
    expect(requiresMandatoryHumanApproval('execute', { command: 'ls', shell: '/bin/sh' })).toBe(
      true
    );
    expect(requiresMandatoryHumanApproval('execute', { command: 'ls' })).toBe(false);
    expect(requiresMandatoryHumanApproval('execute', { command: 'ls', shell: '' })).toBe(false);
    expect(requiresMandatoryHumanApproval('other_tool', { shell: '/bin/sh' })).toBe(false);
  });

  it('is never pre-approved by MATIMO_AUTO_APPROVE or an approved pattern', () => {
    process.env.MATIMO_AUTO_APPROVE = 'true';
    process.env.MATIMO_APPROVED_PATTERNS = '*';
    const handler = new ApprovalHandler();
    expect(handler.isPreApproved('execute', { command: 'ls', shell: '/bin/sh' })).toBe(false);
    // without a shell the pre-approval settings still apply
    expect(handler.isPreApproved('execute', { command: 'ls' })).toBe(true);
    expect(handler.isPreApproved('execute')).toBe(true);
  });
});
