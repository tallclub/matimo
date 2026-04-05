import { MatimoInstance, setGlobalMatimoInstance, tool } from '@matimo/core';

/**
 * Example: Execute tool using @tool decorator pattern
 * Demonstrates class-based tool execution with automatic decoration
 */
class CommandExecutor {
  @tool('execute')
  async runCommand(command: string, timeout?: number): Promise<unknown> {
    // Decorator automatically intercepts and executes via Matimo
    return undefined;
  }

  @tool('execute')
  async listDirectory(): Promise<unknown> {
    // Decorator automatically intercepts and executes via Matimo
    return undefined;
  }
}

async function decoratorExample() {
  // Set up decorator support with autoDiscover
  const matimo = await MatimoInstance.init({ autoDiscover: true });
  setGlobalMatimoInstance(matimo);

  console.info('=== Execute Tool - Decorator Pattern ===\n');

  const executor = new CommandExecutor();

  try {
    // Example 1: Run command through decorated method
    console.info('1. Running command: echo "Hello from decorator"\n');
    const result1 = await executor.runCommand('echo "Hello from decorator"');
    console.info('Success:', (result1 as any).success);
    console.info('Output:', (result1 as any).stdout);
    console.info('---\n');

    // Example 2: List directory
    console.info('2. Running command: pwd\n');
    const result2 = await executor.listDirectory();
    console.info('Success:', (result2 as any).success);
    console.info('Output:', (result2 as any).stdout);
    console.info('---\n');
  } catch (error: any) {
    console.error('Error:', error.message);
  }
}

decoratorExample();
