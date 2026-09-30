import { MatimoInstance, setGlobalMatimoInstance, tool, type ApprovalRequest } from '@matimo/core';
import * as readline from 'readline';

/**
 * Example: Execute tool using @tool decorator pattern
 * Demonstrates class-based tool execution with automatic decoration
 *
 * NOTE: @tool maps positional call-site arguments to the *tool's own*
 * declared parameter order (see convertArgsToParams in tool-decorator.ts),
 * not to this class's parameter names — so listDirectory(command) must be
 * called with the actual command string, and a no-arg call sends no
 * `command` at all rather than falling back to a JS default value.
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

class CommandExecutor {
  @tool('execute')
  async runCommand(command: string, timeout?: number): Promise<unknown> {
    // Decorator automatically intercepts and executes via Matimo
    return undefined;
  }

  @tool('execute')
  async listDirectory(command: string): Promise<unknown> {
    // Decorator automatically intercepts and executes via Matimo
    return undefined;
  }
}

async function decoratorExample() {
  // Set up decorator support with autoDiscover
  const matimo = await MatimoInstance.init({ autoDiscover: true, onApproval: approveCommand });
  setGlobalMatimoInstance(matimo);

  console.info('=== Execute Tool - Decorator Pattern ===\n');

  const executor = new CommandExecutor();

  try {
    // Example 1: Run command through decorated method
    console.info('1. Running command: echo Hello from decorator\n');
    const result1 = await executor.runCommand('echo Hello from decorator');
    console.info('Success:', (result1 as any).success);
    console.info('Output:', (result1 as any).stdout);
    console.info('---\n');

    // Example 2: List directory
    const listCommand = isWindows ? 'dir' : 'ls';
    console.info(`2. Running command: ${listCommand}\n`);
    const result2 = await executor.listDirectory(listCommand);
    console.info('Success:', (result2 as any).success);
    console.info('Output:', (result2 as any).stdout);
    console.info('---\n');
  } catch (error: any) {
    console.error('Error:', error.message);
  }
}

decoratorExample();
