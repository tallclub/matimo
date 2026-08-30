import { CommandExecutor } from '../../src/executors/command-executor';

// CommandExecutor spawns processes directly (no shell), so test commands must be real,
// directly-spawnable executables on every platform — shell builtins like POSIX `echo`/`sh`
// or POSIX-only binaries like `sleep` don't exist as standalone executables on Windows.
// process.execPath (the Node binary running these tests) is guaranteed present everywhere.
const NODE = process.execPath;
const ECHO_ARGS_SCRIPT = "console.log(process.argv.slice(1).join(' '))";

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
          command: NODE,
          args: ['-e', ECHO_ARGS_SCRIPT, 'hello'],
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
          command: NODE,
          args: ['-e', ECHO_ARGS_SCRIPT, '{message}'],
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
          command: NODE,
          args: ['-e', ECHO_ARGS_SCRIPT, '{arg1}', '{arg2}'],
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
          command: NODE,
          args: ['-e', "console.error('boom'); process.exit(1)"],
        },
      };

      const result = (await executor.execute(tool, {})) as Record<string, unknown>;
      expect(result.success).toBe(false);
      expect(result.stderr).toBeDefined();
      expect(result.stderr).toContain('boom');
    });

    it('should respect timeout', async () => {
      const tool = {
        name: 'timeout-test',
        version: '1.0.0',
        description: 'Test',
        parameters: {},
        execution: {
          type: 'command' as const,
          command: NODE,
          args: ['-e', 'setTimeout(() => {}, 10000)'],
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
          command: NODE,
          args: ['-e', 'process.exit(1)'],
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
          command: NODE,
          args: ['-e', "console.log(JSON.stringify({ key: 'value' }))"],
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
          command: NODE,
          args: ['-e', ECHO_ARGS_SCRIPT, 'Hello {name}!'],
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
          command: NODE,
          args: ['-e', ECHO_ARGS_SCRIPT, '{word} {word} {word}'],
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
          command: NODE,
          args: ['-e', ECHO_ARGS_SCRIPT, 'Number: {count}'],
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
          command: NODE,
          args: ['-e', ECHO_ARGS_SCRIPT, 'output'],
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
          command: NODE,
          args: ['-e', ECHO_ARGS_SCRIPT, 'test'],
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

    it('should reject templated execution.command values', async () => {
      const tool = {
        name: 'templated-command',
        version: '1.0.0',
        description: 'Invalid templated command',
        parameters: {
          cmd: { type: 'string' as const, description: 'Command' },
        },
        execution: {
          type: 'command' as const,
          command: '{cmd}',
          args: ['hello'],
        },
      };

      await expect(executor.execute(tool, { cmd: 'echo' })).rejects.toThrow(
        'execution.command must not contain parameter placeholders'
      );
    });

    it('should reject execution.command longer than 1024 chars', async () => {
      const tool = {
        name: 'long-command',
        version: '1.0.0',
        description: 'Too-long command',
        parameters: {},
        execution: {
          type: 'command' as const,
          command: 'x'.repeat(1025),
          args: [],
        },
      };

      await expect(executor.execute(tool, {})).rejects.toThrow(
        'execution.command exceeds maximum length (1024 chars)'
      );
    });
  });
});
