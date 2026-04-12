/**
 * Example: Enhanced Zod Error Messages
 *
 * This demonstrates the improved error handling with detailed validation messages
 */

import { validateToolDefinition } from '../packages/core/src/core/schema';

// Example 1: Missing required field
console.log('Example 1: Missing required field\n');
try {
  const invalidTool = {
    version: '1.0.0',
    // Missing 'name' - required field
    parameters: {},
    execution: {
      type: 'command',
      command: 'echo test',
    },
  };

  validateToolDefinition(invalidTool);
} catch (error) {
  console.log('Error caught:');
  console.log((error as Error).message);
  console.log('\n---\n');
}

// Example 2: Invalid parameter schema
console.log('Example 2: Invalid parameter schema\n');
try {
  const invalidTool = {
    name: 'test-tool',
    version: '1.0.0',
    parameters: {
      myParam: {
        type: 'string',
        // Missing 'description' - required field
      },
    },
    execution: {
      type: 'command',
      command: 'echo test',
    },
  };

  validateToolDefinition(invalidTool);
} catch (error) {
  console.log('Error caught:');
  console.log((error as Error).message);
  console.log('\n---\n');
}

// Example 3: Invalid execution type
console.log('Example 3: Invalid execution type\n');
try {
  const invalidTool = {
    name: 'test-tool',
    version: '1.0.0',
    parameters: {},
    execution: {
      type: 'invalid-type', // Not 'command' or 'http'
    },
  };

  validateToolDefinition(invalidTool);
} catch (error) {
  console.log('Error caught:');
  console.log((error as Error).message);
  console.log('\n---\n');
}

// Example 4: Valid tool (should not throw)
console.log('Example 4: Valid tool definition\n');
try {
  const validTool = {
    name: 'calculator',
    version: '1.0.0',
    description: 'A simple calculator tool',
    parameters: {
      operation: {
        type: 'string',
        description: 'The operation to perform',
        enum: ['add', 'subtract', 'multiply', 'divide'],
      },
      a: {
        type: 'number',
        description: 'First number',
      },
      b: {
        type: 'number',
        description: 'Second number',
      },
    },
    execution: {
      type: 'command',
      command: 'calculator',
      args: ['--op', '{operation}', '{a}', '{b}'],
    },
  };

  const validated = validateToolDefinition(validTool);
  console.log('✓ Tool validated successfully');
  console.log('Tool name:', validated.name);
  console.log('Tool version:', validated.version);
} catch (error) {
  console.log('Unexpected error:', (error as Error).message);
}
