import { CommandExecutor } from '../../src/executors/command-executor';

describe('CommandExecutor', () => {
  let executor: CommandExecutor;

  beforeEach(() => {
    executor = new CommandExecutor();
  });

  describe('execute', () => {
    it('should execute a simple command', async () => {
      const tool = {
        name: 'echo-test',
        version: '1.0.0',
        description: 'Test',
        parameters: {},
        execution: {
          type: 'command' as const,
          command: 'echo',
          args: ['hello'],
        },
      };

      const result = (await executor.execute(tool, {})) as Record<string, unknown>;
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.stdout).toContain('hello');
    });

    it('should execute command with parameter templating', async () => {
      const tool = {
        name: 'echo-param',
        version: '1.0.0',
        description: 'Test',
        parameters: {
          message: {
            type: 'string' as const,
            description: 'Message',
          },
        },
        execution: {
          type: 'command' as const,
          command: 'echo',
          args: ['{message}'],
        },
      };

      const result = (await executor.execute(tool, { message: 'test message' })) as Record<
        string,
        unknown
      >;
      expect(result.success).toBe(true);
      expect(result.stdout).toContain('test message');
    });

    it('should handle command with multiple arguments', async () => {
      const tool = {
        name: 'multi-args',
        version: '1.0.0',
        description: 'Test',
        parameters: {
          arg1: {
            type: 'string' as const,
            description: 'Arg 1',
          },
          arg2: {
            type: 'string' as const,
            description: 'Arg 2',
          },
        },
        execution: {
          type: 'command' as const,
          command: 'echo',
          args: ['{arg1}', '{arg2}'],
        },
      };

      const result = (await executor.execute(tool, { arg1: 'hello', arg2: 'world' })) as Record<
        string,
        unknown
      >;
      expect(result.success).toBe(true);
      expect(result.stdout).toContain('hello');
      expect(result.stdout).toContain('world');
    });

    it('should capture stderr on error', async () => {
      const tool = {
        name: 'error-cmd',
        version: '1.0.0',
        description: 'Test',
        parameters: {},
        execution: {
          type: 'command' as const,
          command: 'ls',
          args: ['/nonexistent-directory-12345'],
        },
      };

      const result = (await executor.execute(tool, {})) as Record<string, unknown>;
      expect(result.success).toBe(false);
      expect(result.stderr).toBeDefined();
    });

    it('should respect timeout', async () => {
      const tool = {
        name: 'timeout-test',
        version: '1.0.0',
        description: 'Test',
        parameters: {},
        execution: {
          type: 'command' as const,
          command: 'sleep',
          args: ['10'],
          timeout: 1000,
        },
      };

      const result = (await executor.execute(tool, {})) as Record<string, unknown>;
      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout');
    });

    it('should handle missing command gracefully', async () => {
      const tool = {
        name: 'missing-cmd',
        version: '1.0.0',
        description: 'Test',
        parameters: {},
        execution: {
          type: 'command' as const,
          command: 'nonexistent-command-xyz',
          args: [],
        },
      };

      const result = (await executor.execute(tool, {})) as Record<string, unknown>;
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle exit code errors', async () => {
      const tool = {
        name: 'exit-code',
        version: '1.0.0',
        description: 'Test',
        parameters: {},
        execution: {
          type: 'command' as const,
          command: 'sh',
          args: ['-c', 'exit 1'],
        },
      };

      const result = (await executor.execute(tool, {})) as Record<string, unknown>;
      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(1);
    });

    it('should preserve output format', async () => {
      const tool = {
        name: 'json-output',
        version: '1.0.0',
        description: 'Test',
        parameters: {},
        execution: {
          type: 'command' as const,
          command: 'echo',
          args: ['{"key":"value"}'],
        },
      };

      const result = (await executor.execute(tool, {})) as Record<string, unknown>;
      expect(result.success).toBe(true);
      expect(result.stdout).toContain('key');
    });
  });

  describe('parameter templating', () => {
    it('should replace single parameter in arguments', async () => {
      const tool = {
        name: 'single-param',
        version: '1.0.0',
        description: 'Test',
        parameters: {
          name: {
            type: 'string' as const,
            description: 'Name',
          },
        },
        execution: {
          type: 'command' as const,
          command: 'echo',
          args: ['Hello {name}!'],
        },
      };

      const result = (await executor.execute(tool, { name: 'Alice' })) as Record<string, unknown>;
      expect(result.stdout).toContain('Hello Alice!');
    });

    it('should handle multiple occurrences of same parameter', async () => {
      const tool = {
        name: 'repeat-param',
        version: '1.0.0',
        description: 'Test',
        parameters: {
          word: {
            type: 'string' as const,
            description: 'Word',
          },
        },
        execution: {
          type: 'command' as const,
          command: 'echo',
          args: ['{word} {word} {word}'],
        },
      };

      const result = (await executor.execute(tool, { word: 'test' })) as Record<string, unknown>;
      expect(result.stdout).toContain('test test test');
    });

    it('should handle numeric parameters', async () => {
      const tool = {
        name: 'numeric-param',
        version: '1.0.0',
        description: 'Test',
        parameters: {
          count: {
            type: 'number' as const,
            description: 'Count',
          },
        },
        execution: {
          type: 'command' as const,
          command: 'echo',
          args: ['Number: {count}'],
        },
      };

      const result = (await executor.execute(tool, { count: 42 })) as Record<string, unknown>;
      expect(result.stdout).toContain('42');
    });
  });

  describe('result structure', () => {
    it('should return properly structured result', async () => {
      const tool = {
        name: 'structured',
        version: '1.0.0',
        description: 'Test',
        parameters: {},
        execution: {
          type: 'command' as const,
          command: 'echo',
          args: ['output'],
        },
      };

      const result = (await executor.execute(tool, {})) as Record<string, unknown>;

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('stdout');
      expect(typeof result.success).toBe('boolean');
      expect(typeof result.stdout).toBe('string');
    });

    it('should include execution time', async () => {
      const tool = {
        name: 'timing',
        version: '1.0.0',
        description: 'Test',
        parameters: {},
        execution: {
          type: 'command' as const,
          command: 'echo',
          args: ['test'],
        },
      };

      const result = (await executor.execute(tool, {})) as Record<string, unknown>;
      expect(result).toHaveProperty('duration');
      expect(typeof result.duration).toBe('number');
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it('should throw error when execution type is not command', async () => {
      const tool = {
        name: 'http-tool',
        version: '1.0.0',
        description: 'Test HTTP tool',
        parameters: {},
        execution: {
          type: 'http' as const,
          method: 'GET',
          url: 'https://example.com',
        },
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await expect(executor.execute(tool as any, {})).rejects.toThrow(
        'Tool execution type is not command'
      );
    });
  });
});
