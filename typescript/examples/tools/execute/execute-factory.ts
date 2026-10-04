import { MatimoInstance, type ApprovalRequest } from '@matimo/core';
import * as readline from 'readline';

/**
 * Example: Execute tool using factory pattern
 * Demonstrates running shell commands and capturing output
 *
 * The built-in `execute` tool runs commands through a real shell
 * (cmd.exe on Windows, sh on Unix/macOS — see tools/execute/execute.ts),
 * so the commands below are picked per-platform rather than assuming
 * POSIX-only tools like `ls`/`pwd` exist.
 */
const isWindows = process.platform === 'win32';

/**
 * `execute` declares `requires_approval: true`: every command it runs is
 * shown to a human first. Pre-approve it for scripts and CI with
 * MATIMO_APPROVED_PATTERNS="execute" instead.
 */
async function approveCommand(request: ApprovalRequest): Promise<boolean> {
  console.info(`🔒 Approval required — ${request.toolName}: ${String(request.params.command)}`);
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
    const listCommand = isWindows ? 'dir' : 'ls';
    console.info(`1. Running: ${listCommand}\n`);
    const lsResult = await matimo.execute('execute', {
      command: listCommand,
      timeout: 10000,
    });
    console.info('Success:', (lsResult as any).success);
    console.info('Output:', (lsResult as any).stdout?.substring(0, 200));
    console.info('---\n');

    // Example 2: Get current working directory
    const pwdCommand = isWindows ? 'cd' : 'pwd';
    console.info(`2. Running: ${pwdCommand}\n`);
    const pwdResult = await matimo.execute('execute', {
      command: pwdCommand,
    });
    console.info('Success:', (pwdResult as any).success);
    console.info('Output:', (pwdResult as any).stdout);
    console.info('---\n');

    // Example 3: Echo command (unquoted — cmd.exe's `echo` does not strip
    // quotes the way POSIX sh does, so a quoted string would print the
    // literal quotes on Windows).
    console.info('3. Running: echo Hello from Matimo\n');
    const echoResult = await matimo.execute('execute', {
      command: 'echo Hello from Matimo',
    });
    console.info('Success:', (echoResult as any).success);
    console.info('Output:', (echoResult as any).stdout);
    console.info('---\n');
  } catch (error: any) {
    console.error('Error executing command:', error.message);
  }
}

executeExample();
