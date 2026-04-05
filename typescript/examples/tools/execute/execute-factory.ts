import { MatimoInstance } from '@matimo/core';

/**
 * Example: Execute tool using factory pattern
 * Demonstrates running shell commands and capturing output
 */
async function executeExample() {
  // Initialize Matimo with autoDiscover to find all tools (core + providers)
  const matimo = await MatimoInstance.init({ autoDiscover: true });

  console.info('=== Execute Tool - Factory Pattern ===\n');

  try {
    // Example 1: List files in current directory
    console.info('1. Running: ls\n');
    const lsResult = await matimo.execute('execute', {
      command: 'ls',
      timeout: 10000,
    });
    console.info('Success:', (lsResult as any).success);
    console.info('Output:', (lsResult as any).stdout?.substring(0, 200));
    console.info('---\n');

    // Example 2: Get current working directory
    console.info('2. Running: pwd\n');
    const pwdResult = await matimo.execute('execute', {
      command: 'pwd',
    });
    console.info('Success:', (pwdResult as any).success);
    console.info('Output:', (pwdResult as any).stdout);
    console.info('---\n');

    // Example 3: Echo command
    console.info('3. Running: echo "Hello from Matimo"\n');
    const echoResult = await matimo.execute('execute', {
      command: 'echo "Hello from Matimo"',
    });
    console.info('Success:', (echoResult as any).success);
    console.info('Output:', (echoResult as any).stdout);
    console.info('---\n');
  } catch (error: any) {
    console.error('Error executing command:', error.message);
  }
}

executeExample();
