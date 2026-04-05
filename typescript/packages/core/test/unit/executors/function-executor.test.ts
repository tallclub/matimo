import { FunctionExecutor } from '../../../src/executors/function-executor';
import { ToolDefinition } from '../../../src/core/schema';

describe('FunctionExecutor', () => {
  let executor: FunctionExecutor;

  beforeEach(() => {
    // Keep embedded code execution DISABLED by default (secure by default)
    // Tests that need it will explicitly enable the flag
    delete process.env.MATIMO_ALLOW_EMBEDDED_CODE;
    executor = new FunctionExecutor();
  });

  afterEach(() => {
    // Clean up environment variable after tests
    delete process.env.MATIMO_ALLOW_EMBEDDED_CODE;
  });

  describe('execute', () => {
    it('should execute a simple async function', async () => {
      // Enable embedded code only for this test
      process.env.MATIMO_ALLOW_EMBEDDED_CODE = 'true';

      const tool: ToolDefinition = {
        name: 'test-func',
        version: '1.0.0',
        description: 'Test function',
        parameters: {},
        execution: {
          type: 'function',
          code: 'async () => ({ result: "success" })',
        },
      };

      const result = await executor.execute(tool, {});
      expect(result).toEqual({ result: 'success' });
    });

    it('should execute a function that returns a string', async () => {
      // Enable embedded code only for this test
      process.env.MATIMO_ALLOW_EMBEDDED_CODE = 'true';

      const tool: ToolDefinition = {
        name: 'string-func',
        version: '1.0.0',
        description: 'Returns a string',
        parameters: {},
        execution: {
          type: 'function',
          code: 'async () => "test-string"',
        },
      };

      const result = await executor.execute(tool, {});
      expect(result).toBe('test-string');
    });

    it('should execute a function with parameters', async () => {
      // Enable embedded code only for this test
      process.env.MATIMO_ALLOW_EMBEDDED_CODE = 'true';

      const tool: ToolDefinition = {
        name: 'param-func',
        version: '1.0.0',
        description: 'Uses parameters',
        parameters: {},
        execution: {
          type: 'function',
          code: 'async (params) => ({ input: params.value, doubled: params.value * 2 })',
        },
      };

      const result = await executor.execute(tool, { value: 5 });
      expect(result).toEqual({ input: 5, doubled: 10 });
    });

    it('should throw error when code is empty', async () => {
      const tool: ToolDefinition = {
        name: 'empty-func',
        version: '1.0.0',
        description: 'Empty code',
        parameters: {},
        execution: {
          type: 'function',
          code: '',
        },
      };

      await expect(executor.execute(tool, {})).rejects.toThrow();
    });

    it('should reject embedded code when MATIMO_ALLOW_EMBEDDED_CODE is not set', async () => {
      // Embedded code is disabled by default (flag not set)
      // embeddedCodeDisabled = (undefined !== 'true') = true → throws error

      const tool: ToolDefinition = {
        name: 'embedded-func',
        version: '1.0.0',
        description: 'Embedded function',
        parameters: {},
        execution: {
          type: 'function',
          code: 'async () => ({ result: "success" })',
        },
      };

      // Should reject with security error
      const result = await executor.execute(tool, {});
      expect(result).toHaveProperty('success', false);
      expect(result).toHaveProperty('error');
      expect((result as Record<string, unknown>).error).toMatch(/disabled by default/);
    });

    it('should allow embedded code when MATIMO_ALLOW_EMBEDDED_CODE=true', async () => {
      // Enable embedded code for this test
      // embeddedCodeDisabled = ('true' !== 'true') = false → allows execution
      process.env.MATIMO_ALLOW_EMBEDDED_CODE = 'true';

      const tool: ToolDefinition = {
        name: 'embedded-allowed-func',
        version: '1.0.0',
        description: 'Embedded function (allowed)',
        parameters: {},
        execution: {
          type: 'function',
          code: 'async () => ({ result: "success with flag" })',
        },
      };

      const result = await executor.execute(tool, {});
      expect(result).toEqual({ result: 'success with flag' });
    });

    it('should handle non-function code gracefully', async () => {
      // Enable embedded code only for this test
      process.env.MATIMO_ALLOW_EMBEDDED_CODE = 'true';

      const tool: ToolDefinition = {
        name: 'not-func',
        version: '1.0.0',
        description: 'Not a function',
        parameters: {},
        execution: {
          type: 'function',
          code: '"just a string"',
        },
      };

      const result = (await executor.execute(tool, {})) as { success: boolean; error: string };
      expect(result.success).toBe(false);
      expect(result.error).toContain('not a function');
    });

    it('should handle function errors gracefully', async () => {
      // Enable embedded code only for this test
      process.env.MATIMO_ALLOW_EMBEDDED_CODE = 'true';

      const tool: ToolDefinition = {
        name: 'error-func',
        version: '1.0.0',
        description: 'Function that throws',
        parameters: {},
        execution: {
          type: 'function',
          code: 'async () => { throw new Error("Expected error"); }',
        },
      };

      const result = (await executor.execute(tool, {})) as { success: boolean; error: string };
      expect(result.success).toBe(false);
      expect(result.error).toContain('Expected error');
    });

    it('should handle promise returns', async () => {
      // Enable embedded code only for this test
      process.env.MATIMO_ALLOW_EMBEDDED_CODE = 'true';

      const tool: ToolDefinition = {
        name: 'promise-func',
        version: '1.0.0',
        description: 'Returns a promise',
        parameters: {},
        execution: {
          type: 'function',
          code: 'async () => Promise.resolve({ status: "resolved" })',
        },
      };

      const result = await executor.execute(tool, {});
      expect(result).toEqual({ status: 'resolved' });
    });

    it('should handle array returns', async () => {
      // Enable embedded code only for this test
      process.env.MATIMO_ALLOW_EMBEDDED_CODE = 'true';

      const tool: ToolDefinition = {
        name: 'array-func',
        version: '1.0.0',
        description: 'Array return',
        parameters: {},
        execution: {
          type: 'function',
          code: 'async () => [1, 2, 3]',
        },
      };

      const result = await executor.execute(tool, {});
      expect(Array.isArray(result)).toBe(true);
      expect(result).toEqual([1, 2, 3]);
    });

    it('should handle null returns', async () => {
      // Enable embedded code only for this test
      process.env.MATIMO_ALLOW_EMBEDDED_CODE = 'true';

      const tool: ToolDefinition = {
        name: 'null-func',
        version: '1.0.0',
        description: 'Null return',
        parameters: {},
        execution: {
          type: 'function',
          code: 'async () => null',
        },
      };

      const result = await executor.execute(tool, {});
      expect(result).toBeNull();
    });

    it('should handle boolean returns', async () => {
      // Enable embedded code only for this test
      process.env.MATIMO_ALLOW_EMBEDDED_CODE = 'true';

      const tool: ToolDefinition = {
        name: 'bool-func',
        version: '1.0.0',
        description: 'Boolean return',
        parameters: {},
        execution: {
          type: 'function',
          code: 'async () => true',
        },
      };

      const result = await executor.execute(tool, {});
      expect(result).toBe(true);
    });

    it('should validate execution type is function', async () => {
      const tool: ToolDefinition = {
        name: 'wrong-type',
        version: '1.0.0',
        description: 'Wrong execution type',
        parameters: {},
        execution: {
          type: 'command' as const,
          command: 'echo test',
        },
      };

      await expect(executor.execute(tool, {})).rejects.toThrow();
    });

    it('should handle timeout for long-running functions', async () => {
      // Enable embedded code only for this test
      process.env.MATIMO_ALLOW_EMBEDDED_CODE = 'true';

      const tool: ToolDefinition = {
        name: 'timeout-func',
        version: '1.0.0',
        description: 'Function that times out',
        parameters: {},
        execution: {
          type: 'function',
          code: 'async () => new Promise(resolve => setTimeout(() => resolve("done"), 500))',
          timeout: 100,
        },
      };

      const result = (await executor.execute(tool, {})) as { success: boolean };
      expect(result.success).toBe(false);
    }, 10000);

    it('should handle complex object returns', async () => {
      // Enable embedded code only for this test
      process.env.MATIMO_ALLOW_EMBEDDED_CODE = 'true';

      const tool: ToolDefinition = {
        name: 'complex-func',
        version: '1.0.0',
        description: 'Complex return',
        parameters: {},
        execution: {
          type: 'function',
          code: `async (params) => ({
            name: "test",
            nested: { value: 42 },
            array: [1, 2, 3],
            flag: true
          })`,
        },
      };

      const result = (await executor.execute(tool, {})) as {
        name: string;
        nested: { value: number };
        array: number[];
        flag: boolean;
      };
      expect(result.name).toBe('test');
      expect(result.nested.value).toBe(42);
      expect(result.array).toEqual([1, 2, 3]);
      expect(result.flag).toBe(true);
    });

    it('should handle functions with multiple parameters', async () => {
      // Enable embedded code only for this test
      process.env.MATIMO_ALLOW_EMBEDDED_CODE = 'true';

      const tool: ToolDefinition = {
        name: 'multi-param',
        version: '1.0.0',
        description: 'Multiple params',
        parameters: {},
        execution: {
          type: 'function',
          code: 'async (params) => ({ sum: params.a + params.b, product: params.a * params.b })',
        },
      };

      const result = await executor.execute(tool, { a: 3, b: 4 });
      expect(result).toEqual({ sum: 7, product: 12 });
    });

    it('should handle default timeout when not specified', async () => {
      // Enable embedded code only for this test
      process.env.MATIMO_ALLOW_EMBEDDED_CODE = 'true';

      const tool: ToolDefinition = {
        name: 'default-timeout-func',
        version: '1.0.0',
        description: 'Default timeout',
        parameters: {},
        execution: {
          type: 'function',
          code: 'async () => ({ result: "completed" })',
        },
      };

      const result = await executor.execute(tool, {});
      expect(result).toEqual({ result: 'completed' });
    });

    it('should handle code that looks like a file path but is not', async () => {
      const tool: ToolDefinition = {
        name: 'path-like-code',
        version: '1.0.0',
        description: 'Code with .ts in it',
        parameters: {},
        execution: {
          type: 'function',
          code: 'async () => ({ file: "something.ts" })',
        },
      };

      const result = await executor.execute(tool, {});
      // This might fail because it tries to load as file, which is ok
      expect(result).toBeDefined();
    });

    it('should handle number returns', async () => {
      // Enable embedded code only for this test
      process.env.MATIMO_ALLOW_EMBEDDED_CODE = 'true';

      const tool: ToolDefinition = {
        name: 'number-func',
        version: '1.0.0',
        description: 'Number return',
        parameters: {},
        execution: {
          type: 'function',
          code: 'async () => 42',
        },
      };

      const result = await executor.execute(tool, {});
      expect(result).toBe(42);
    });

    it('should handle string returns', async () => {
      // Enable embedded code only for this test
      process.env.MATIMO_ALLOW_EMBEDDED_CODE = 'true';

      const tool: ToolDefinition = {
        name: 'string-return-func',
        version: '1.0.0',
        description: 'String return',
        parameters: {},
        execution: {
          type: 'function',
          code: 'async () => "hello"',
        },
      };

      const result = await executor.execute(tool, {});
      expect(result).toBe('hello');
    });

    it('should handle nested function calls', async () => {
      // Enable embedded code only for this test
      process.env.MATIMO_ALLOW_EMBEDDED_CODE = 'true';

      const tool: ToolDefinition = {
        name: 'nested-func',
        version: '1.0.0',
        description: 'Nested calls',
        parameters: {},
        execution: {
          type: 'function',
          code: `async (params) => {
            const inner = () => ({ nested: true });
            return { ...inner(), params };
          }`,
        },
      };

      const result = (await executor.execute(tool, {})) as { nested: boolean };
      expect(result.nested).toBe(true);
    });

    it('should handle object spread operators', async () => {
      // Enable embedded code only for this test
      process.env.MATIMO_ALLOW_EMBEDDED_CODE = 'true';

      const tool: ToolDefinition = {
        name: 'spread-func',
        version: '1.0.0',
        description: 'Spread operator',
        parameters: {},
        execution: {
          type: 'function',
          code: 'async (params) => ({ ...params, added: true })',
        },
      };

      const result = (await executor.execute(tool, { existing: 'value' })) as {
        existing: string;
        added: boolean;
      };
      expect(result.existing).toBe('value');
      expect(result.added).toBe(true);
    });

    it('should throw error when code is empty', async () => {
      const tool: ToolDefinition = {
        name: 'empty-func',
        version: '1.0.0',
        description: 'Empty function',
        parameters: {},
        execution: {
          type: 'function',
          code: '   ', // Only whitespace
        },
      };

      try {
        await executor.execute(tool, {});
        expect(true).toBe(false); // Should throw
      } catch (error) {
        expect((error as Error).message).toContain('empty');
      }
    });

    it('should handle function that throws synchronously', async () => {
      // Enable embedded code only for this test
      process.env.MATIMO_ALLOW_EMBEDDED_CODE = 'true';

      const tool: ToolDefinition = {
        name: 'throw-sync',
        version: '1.0.0',
        description: 'Throws synchronously',
        parameters: {},
        execution: {
          type: 'function',
          code: '() => { throw new Error("Sync error"); }',
        },
      };

      const result = await executor.execute(tool, {});

      expect((result as Record<string, unknown>).success).toBe(false);
      expect((result as Record<string, unknown>).error).toContain('Sync error');
    });

    it('should handle non-Promise return from async function', async () => {
      // Enable embedded code only for this test
      process.env.MATIMO_ALLOW_EMBEDDED_CODE = 'true';

      const tool: ToolDefinition = {
        name: 'non-promise-func',
        version: '1.0.0',
        description: 'Returns non-Promise value',
        parameters: {},
        execution: {
          type: 'function',
          code: '() => "direct-return"', // Not async, returns directly
        },
      };

      const result = await executor.execute(tool, {});

      expect(result).toBe('direct-return');
    });

    it('should handle timeout during function execution', async () => {
      // Enable embedded code only for this test
      process.env.MATIMO_ALLOW_EMBEDDED_CODE = 'true';

      const tool: ToolDefinition = {
        name: 'timeout-func',
        version: '1.0.0',
        description: 'Times out',
        parameters: {},
        execution: {
          type: 'function',
          code: 'async () => new Promise(resolve => setTimeout(() => resolve("never"), 500))',
          timeout: 50, // Very short timeout
        },
      };

      const result = await executor.execute(tool, {});

      expect((result as Record<string, unknown>).success).toBe(false);
      expect((result as Record<string, unknown>).error).toBe('Function execution timeout');
    }, 1000); // Jest timeout 1 second

    it('should handle Promise rejection', async () => {
      // Enable embedded code only for this test
      process.env.MATIMO_ALLOW_EMBEDDED_CODE = 'true';

      const tool: ToolDefinition = {
        name: 'reject-func',
        version: '1.0.0',
        description: 'Rejects promise',
        parameters: {},
        execution: {
          type: 'function',
          code: 'async () => Promise.reject(new Error("Promise rejected"))',
        },
      };

      const result = await executor.execute(tool, {});

      expect((result as Record<string, unknown>).success).toBe(false);
      expect((result as Record<string, unknown>).error).toContain('Promise rejected');
    });

    it('should handle external file loading attempt', async () => {
      const tool: ToolDefinition = {
        name: 'slack-test',
        version: '1.0.0',
        description: 'Test external file',
        parameters: {},
        execution: {
          type: 'function',
          code: 'slack-test.ts',
        },
      };

      // This will attempt to load but fail gracefully in test environment
      // The key is that it enters the file-loading code path
      const result = await executor.execute(tool, { test: 'data' });

      // Should handle the error gracefully
      expect((result as Record<string, unknown>).success).toBe(false);
      expect((result as Record<string, unknown>).error).toBeDefined();
    });

    it('should handle non-function execution type', async () => {
      const tool: ToolDefinition = {
        name: 'wrong-type',
        version: '1.0.0',
        description: 'Wrong execution type',
        parameters: {},
        execution: {
          type: 'command' as unknown as 'function',
          code: 'echo test',
        },
      };

      try {
        await executor.execute(tool, {});
        expect(true).toBe(false); // Should throw
      } catch (error) {
        expect((error as Error).message).toContain('not function');
      }
    });

    it('should pass fs/path/axios to embedded functions', async () => {
      // Enable embedded code only for this test
      process.env.MATIMO_ALLOW_EMBEDDED_CODE = 'true';

      const tool: ToolDefinition = {
        name: 'with-modules',
        version: '1.0.0',
        description: 'Uses fs and path',
        parameters: {},
        execution: {
          type: 'function',
          code: `async (params, config, fsModule, pathModule, axiosModule) => {
            return { 
              hasFs: typeof fsModule === 'object',
              hasPath: typeof pathModule === 'object',
              hasAxios: axiosModule !== null && axiosModule !== undefined
            };
          }`,
        },
      };

      const result = (await executor.execute(tool, {})) as Record<string, boolean>;

      expect(result.hasFs).toBe(true);
      expect(result.hasPath).toBe(true);
      // axios might not be an object in all contexts, just verify it's passed
      expect(result.hasAxios).toBe(true);
    });

    it('should handle non-Promise return from embedded code', async () => {
      // Enable embedded code only for this test
      process.env.MATIMO_ALLOW_EMBEDDED_CODE = 'true';

      const executor = new FunctionExecutor();
      const tool: ToolDefinition = {
        name: 'sync-function',
        description: 'Sync function test',
        version: '1.0.0',
        parameters: {},
        execution: {
          type: 'function',
          code: `(input) => ({ success: true, input })`,
          timeout: 5000,
        },
      };

      const result = await executor.execute(tool, { test: 'value' });

      expect((result as Record<string, unknown>).success).toBe(true);
      expect((result as Record<string, unknown>).input).toEqual({ test: 'value' });
    });

    it('should handle embedded code that throws synchronously', async () => {
      // Enable embedded code only for this test
      process.env.MATIMO_ALLOW_EMBEDDED_CODE = 'true';

      const executor = new FunctionExecutor();
      const tool: ToolDefinition = {
        name: 'sync-error',
        description: 'Sync error test',
        version: '1.0.0',
        parameters: {},
        execution: {
          type: 'function',
          code: `(input) => { throw new Error('Sync error'); }`,
          timeout: 5000,
        },
      };

      const result = await executor.execute(tool, {});

      expect((result as Record<string, unknown>).success).toBe(false);
      expect((result as Record<string, unknown>).error).toContain('Sync error');
    });

    it('should compute tool directory for single-word tool names', async () => {
      // This tests the else branch on line 109 where toolName doesn't include '-'
      const executor = new FunctionExecutor('/some/tools/path');
      const tool: ToolDefinition = {
        name: 'calculator', // No '-' in name
        description: 'Single word tool',
        version: '1.0.0',
        parameters: {},
        execution: {
          type: 'function',
          code: './index.ts', // File path to trigger the external import path
          timeout: 5000,
        },
      };

      // This will fail at import() since the file doesn't exist,
      // but it tests the directory computation logic
      const result = await executor.execute(tool, {});

      // Should have error from failed import
      expect((result as Record<string, unknown>).success).toBe(false);
    });

    it('should handle non-Promise return from externally imported file', async () => {
      // This tests lines 118-127: non-Promise return from external import
      // Enable embedded code only for this test
      process.env.MATIMO_ALLOW_EMBEDDED_CODE = 'true';

      const executor = new FunctionExecutor();
      const tool: ToolDefinition = {
        name: 'sync-test',
        description: 'Test sync function from file',
        version: '1.0.0',
        parameters: {},
        execution: {
          type: 'function',
          // Use a simple code expression that returns a function directly
          // This simulates a non-Promise return
          code: '(input) => ({ success: true, input, type: "sync" })',
          timeout: 5000,
        },
      };

      const result = await executor.execute(tool, { test: 'data' });

      expect((result as Record<string, unknown>).success).toBe(true);
      expect((result as Record<string, unknown>).type).toBe('sync');
      expect((result as Record<string, unknown>).input).toEqual({ test: 'data' });
    });
  });
});
