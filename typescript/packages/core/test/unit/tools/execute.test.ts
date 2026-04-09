import path from 'path';
import fs from 'fs';
import { ToolLoader } from '../../../src/core/tool-loader';
import { MatimoError } from '../../../src/errors/matimo-error';
import type { Parameter } from '../../../src/core/types';

describe('Execute Tool', () => {
  const coreToolsPath = path.join(__dirname, '../../../tools');
  let toolLoader: ToolLoader;

  beforeAll(() => {
    toolLoader = new ToolLoader();
  });

  describe('Tool Definition', () => {
    it('should have valid execute tool definition file', () => {
      const executePath = path.join(coreToolsPath, 'execute', 'definition.yaml');
      expect(fs.existsSync(executePath)).toBe(true);
    });

    it('should load execute tool with correct metadata', async () => {
      const tools = await toolLoader.loadToolsFromDirectory(coreToolsPath);
      const executeTool = tools.get('execute');

      expect(executeTool).toBeDefined();
      expect(executeTool!.name).toBe('execute');
      expect(executeTool!.version).toBe('1.0.0');
      expect(executeTool!.description).toBeDefined();
    });

    it('should have function-type execution', async () => {
      const tools = await toolLoader.loadToolsFromDirectory(coreToolsPath);
      const executeTool = tools.get('execute');

      expect(executeTool!.execution.type).toBe('function');
      expect(executeTool!.execution).toHaveProperty('code');
    });
  });

  describe('Parameters', () => {
    it('should have all required execute parameters', async () => {
      const tools = await toolLoader.loadToolsFromDirectory(coreToolsPath);
      const executeTool = tools.get('execute')!;

      expect(executeTool!.parameters).toBeDefined();
      const params = executeTool!.parameters as Record<string, Parameter>;
      expect(params.command).toBeDefined();
      expect(params.cwd).toBeDefined();
      expect(params.timeout).toBeDefined();
    });
  });

  describe('Output Schema', () => {
    it('should define output schema', async () => {
      const tools = await toolLoader.loadToolsFromDirectory(coreToolsPath);
      const executeTool = tools.get('execute')!;

      expect(executeTool!.output_schema).toBeDefined();
      expect(executeTool!.output_schema!.properties).toBeDefined();
    });

    it('should have success, stdout, stderr and exitCode fields', async () => {
      const tools = await toolLoader.loadToolsFromDirectory(coreToolsPath);
      const executeTool = tools.get('execute')!;

      const props = executeTool!.output_schema!.properties as Record<string, unknown>;
      expect(props).toHaveProperty('success');
      expect(props).toHaveProperty('stdout');
      expect(props).toHaveProperty('stderr');
      expect(props).toHaveProperty('exitCode');
    });
  });

  describe('Implementation', () => {
    it('should have implementation file', () => {
      const executeImplPath = path.join(coreToolsPath, 'execute', 'execute.ts');
      expect(fs.existsSync(executeImplPath)).toBe(true);
    });

    it('implementation should use exec from child_process', () => {
      const executeImplPath = path.join(coreToolsPath, 'execute', 'execute.ts');
      const content = fs.readFileSync(executeImplPath, 'utf-8');

      expect(content).toContain('child_process');
      expect(content).toContain('exec');
    });

    it('implementation should export default async function', () => {
      const executeImplPath = path.join(coreToolsPath, 'execute', 'execute.ts');
      const content = fs.readFileSync(executeImplPath, 'utf-8');

      expect(content).toContain('export default');
      expect(content).toContain('async');
    });
  });

  describe('Examples', () => {
    it('should include example in tool definition', async () => {
      const tools = await toolLoader.loadToolsFromDirectory(coreToolsPath);
      const executeTool = tools.get('execute')!;

      expect(executeTool!.examples).toBeDefined();
      expect(Array.isArray(executeTool!.examples)).toBe(true);
      expect((executeTool!.examples as Array<unknown>).length).toBeGreaterThan(0);
    });

    it('example should have name and params', async () => {
      const tools = await toolLoader.loadToolsFromDirectory(coreToolsPath);
      const executeTool = tools.get('execute')!;

      const example = (executeTool!.examples as Array<Record<string, unknown>>)[0] as Record<
        string,
        unknown
      >;
      expect(example.name).toBeDefined();
      expect(example.params).toBeDefined();
      expect((example.params as Record<string, unknown>).command).toBeDefined();
    });
  });
});

describe('Injection Detection', () => {
  let executeCommand: (params: { command: string; cwd?: string; timeout?: number }) => Promise<{
    success: boolean;
    exitCode: number;
    stdout: string;
    stderr: string;
    command: string;
    duration: number;
  }>;

  beforeAll(async () => {
    // Import the execute function
    const executeModule = await import('../../../tools/execute/execute');
    executeCommand = executeModule.default;
  });

  describe('detectCommandInjection function', () => {
    it('should detect command chaining with semicolon', async () => {
      await expect(executeCommand({ command: 'echo hello; rm -rf /' })).rejects.toThrow(
        'Command injection detected'
      );
    });

    it('should detect pipe injection', async () => {
      await expect(executeCommand({ command: 'echo hello | rm -rf /' })).rejects.toThrow(
        'Command injection detected'
      );
    });

    it('should detect background execution', async () => {
      await expect(executeCommand({ command: 'echo hello & rm -rf /' })).rejects.toThrow(
        'Command injection detected'
      );
    });

    it('should detect command substitution with backticks', async () => {
      await expect(executeCommand({ command: 'echo `rm -rf /`' })).rejects.toThrow(
        'Command injection detected'
      );
    });

    it('should detect command substitution with $()', async () => {
      await expect(executeCommand({ command: 'echo $(rm -rf /)' })).rejects.toThrow(
        'Command injection detected'
      );
    });

    it('should detect input redirection', async () => {
      await expect(executeCommand({ command: 'cat < /etc/passwd' })).rejects.toThrow(
        'Command injection detected'
      );
    });

    it('should detect output redirection', async () => {
      await expect(executeCommand({ command: 'echo hello > /tmp/malicious' })).rejects.toThrow(
        'Command injection detected'
      );
    });

    it('should detect variable expansion with ${}', async () => {
      await expect(executeCommand({ command: 'echo ${PATH}/malicious' })).rejects.toThrow(
        'Command injection detected'
      );
    });

    it('should allow safe environment variables', async () => {
      // These should not throw
      const result = await executeCommand({ command: 'echo $HOME' });
      expect(result.success).toBe(true);
    });

    it('should allow safe environment variables like PATH', async () => {
      const result = await executeCommand({ command: 'echo $PATH' });
      expect(result.success).toBe(true);
    });

    it('should allow safe environment variables like USER', async () => {
      const result = await executeCommand({ command: 'echo $USER' });
      expect(result.success).toBe(true);
    });

    it('should detect suspicious variable expansion', async () => {
      await expect(executeCommand({ command: 'echo $MALICIOUS_VAR' })).rejects.toThrow(
        'Command injection detected'
      );
    });

    it('should allow legitimate commands without injection', async () => {
      const result = await executeCommand({ command: 'echo "hello world"' });
      expect(result.success).toBe(true);
      expect(result.stdout.trim()).toBe('hello world');
    });

    it('should allow commands with quotes', async () => {
      const result = await executeCommand({ command: 'echo "safe command"' });
      expect(result.success).toBe(true);
    });
  });

  describe('Error handling', () => {
    it('should throw MatimoError with correct code for injection', async () => {
      try {
        await executeCommand({ command: 'echo hello; rm -rf /' });
        fail('Should have thrown');
      } catch (error: unknown) {
        const matimoError = error as MatimoError;
        expect(matimoError.message).toBe('Command injection detected');
        expect(matimoError.code).toBe('INVALID_PARAMETER');
        expect(matimoError.details?.reason).toBe(
          'Command contains potentially dangerous shell metacharacters'
        );
      }
    });
  });
});
