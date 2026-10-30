import { MatimoInstance, type ApprovalRequest } from '@matimo/core';
import * as readline from 'readline';

/**
 * Example: Execute tool using factory pattern
 * Demonstrates running commands and capturing output
 *
 * By default the built-in `execute` tool runs the command directly, with no
 * shell (see tools/execute/execute.ts), so shell built-ins such as `ls`/`dir`/
 * `echo` are not available everywhere and the commands below are picked
 * per-platform. Pass `args` to append arguments one by one, or `shell` to opt
 * in to a full shell line (Example 5); a call with `shell` ALWAYS asks a
 * human, even with MATIMO_AUTO_APPROVE or MATIMO_APPROVED_PATTERNS set.
 */
const isWindows = process.platform === 'win32';

/**
 * `execute` declares `requires_approval: true`: every command it runs is
 * shown to a human first. Pre-approve it for scripts and CI with
 * MATIMO_APPROVED_PATTERNS="execute" instead.
 */
async function approveCommand(request: ApprovalRequest): Promise<boolean> {
  const shell = request.params.shell
    ? ` (through shell: ${String(request.params.shell)}; this call always asks)`
    : '';
  console.info(
    `🔒 Approval required: ${request.toolName}: ${String(request.params.command)}${shell}`
  );
  if (!process.stdin.isTTY) {
    console.info(
      '   ❌ Rejected: no terminal. Pre-approve with MATIMO_APPROVED_PATTERNS="execute"'
    );
    return false;
  }
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise<string>((resolve) =>
    rl.question('   Approve? (y/n): ', resolve)
  );
  rl.close();
  return ['y', 'yes'].includes(answer.trim().toLowerCase());
}

async function executeExample() {
  // Initialize Matimo with autoDiscover to find all tools (core + providers)
  const matimo = await MatimoInstance.init({ autoDiscover: true, onApproval: approveCommand });

  console.info('=== Execute Tool - Factory Pattern ===\n');

  try {
    // Example 1: List files in current directory
    // The execute tool runs without a shell, so `dir`/`cd` (cmd built-ins) do not exist on Windows.
    const listCommand = isWindows ? `node -p "fs.readdirSync('.').join(' ')"` : 'ls';
    console.info(`1. Running: ${listCommand}\n`);
    const lsResult = await matimo.execute('execute', {
      command: listCommand,
      timeout: 10000,
    });
    console.info('Success:', (lsResult as any).success);
    console.info('Output:', (lsResult as any).stdout?.substring(0, 200));
    console.info('---\n');

    // Example 2: Get current working directory
    const pwdCommand = isWindows ? 'node -p process.cwd()' : 'pwd';
    console.info(`2. Running: ${pwdCommand}\n`);
    const pwdResult = await matimo.execute('execute', {
      command: pwdCommand,
    });
    console.info('Success:', (pwdResult as any).success);
    console.info('Output:', (pwdResult as any).stdout);
    console.info('---\n');

    // Example 3: Print a message. `echo` is a shell built-in on Windows, so use node,
    // which exists on every platform where this example runs.
    console.info('3. Running: node -p "\'Hello from Matimo\'"\n');
    const echoResult = await matimo.execute('execute', {
      command: 'node -p "\'Hello from Matimo\'"',
    });
    console.info('Success:', (echoResult as any).success);
    console.info('Output:', (echoResult as any).stdout);
    console.info('---\n');

    // Example 4: `args` are appended to the command, one argument each, so a value
    // with spaces or quotes needs no escaping.
    console.info('4. Running: node -e <script> with args\n');
    const argsResult = await matimo.execute('execute', {
      command: 'node',
      args: ['-e', 'console.log(process.argv.slice(1).join(" | "))', 'first arg', 'second arg'],
    });
    console.info('Success:', (argsResult as any).success);
    console.info('Output:', (argsResult as any).stdout);
    console.info('---\n');

    // Example 5: opt in to a shell for a pipe. The command is a full shell line, so this
    // call ALWAYS asks a human: MATIMO_AUTO_APPROVE, MATIMO_APPROVED_PATTERNS and
    // `approved` do not apply, and with no approval callback it is rejected.
    if (process.stdin.isTTY) {
      const shell = isWindows ? 'cmd' : '/bin/sh';
      const line = isWindows ? 'echo one two | findstr two' : 'echo one two | tr a-z A-Z';
      console.info(`5. Running through ${shell}: ${line}\n`);
      try {
        const shellResult = await matimo.execute('execute', { command: line, shell });
        console.info('Success:', (shellResult as any).success);
        console.info('Output:', (shellResult as any).stdout);
      } catch (error: any) {
        console.info('Example 5 not run:', error.message);
      }
      console.info('---\n');
    }
  } catch (error: any) {
    console.error('Error executing command:', error.message);
  }
}

executeExample();
