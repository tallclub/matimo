import { spawn } from 'child_process';
import { ToolDefinition } from '../core/schema';
import { MatimoError, ErrorCode } from '../errors/matimo-error';

/**
 * CommandExecutor - Executes shell commands
 * Handles parameter templating, timeouts, and error capture
 */

export class CommandExecutor {
  private cwd?: string;

  constructor(cwd?: string) {
    this.cwd = cwd;
  }

  /**
   * Execute a tool that runs a shell command.
   *
   * @param tool - Tool definition
   * @param params - Tool parameters
   * @param credentials - Optional per-call credential overrides. Keys must match the env-var
   *   names used by the tool (e.g. `SLACK_BOT_TOKEN`). When provided they are merged on top of
   *   `process.env` inside the child process so the spawned script sees them as normal env vars.
   *   Values are never logged. Falls back to the current environment when not provided.
   */
  async execute(
    tool: ToolDefinition,
    params: Record<string, unknown>,
    credentials?: Record<string, string>
  ): Promise<unknown> {
    if (tool.execution.type !== 'command') {
      throw new MatimoError('Tool execution type is not command', ErrorCode.EXECUTION_FAILED, {
        expectedType: 'command',
        actualType: tool.execution.type,
      });
    }

    const { command, args = [], timeout = 30000 } = tool.execution;
    const startTime = Date.now();

    // SECURITY: command must be a fixed executable — never a templated value.
    // Only 'args' may contain {placeholder} tokens.
    if (/\{[^}]+\}/u.test(command)) {
      throw new MatimoError(
        `execution.command must not contain parameter placeholders — only 'args' may be templated. ` +
          `Found: '${command}'. Move the dynamic part into 'args'.`,
        ErrorCode.EXECUTION_FAILED,
        { toolName: tool.name }
      );
    }
    const templatedCommand = command; // Never template the executable
    const templatedArgs = args.map((arg) => this.templateString(arg, params));

    return new Promise((resolve) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const spawnOptions: any = {
        stdio: ['pipe', 'pipe', 'pipe'],
        // Merge per-call credentials on top of the current environment so that
        // the spawned process sees them as ordinary env vars. This is safe:
        // values are held only in memory for the duration of the spawn setup
        // and are never written to disk or logged.
        env: credentials ? { ...process.env, ...credentials } : process.env,
      };

      // Set working directory if provided
      if (this.cwd) {
        spawnOptions.cwd = this.cwd;
      }

      const child = spawn(templatedCommand, templatedArgs, spawnOptions);

      let stdout = '';
      let stderr = '';
      let timedOut = false;

      // Set up timeout
      const timer = setTimeout(() => {
        timedOut = true;
        child.kill('SIGTERM');
      }, timeout);

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        clearTimeout(timer);
        const duration = Date.now() - startTime;

        if (timedOut) {
          resolve({
            success: false,
            error: 'timeout',
            exitCode: -1,
            duration,
          });
        } else {
          const exitCode = code || 0;
          const success = exitCode === 0;

          resolve({
            success,
            stdout: stdout.trim(),
            stderr: stderr.trim(),
            exitCode,
            duration,
          });
        }
      });

      child.on('error', (error) => {
        clearTimeout(timer);
        const duration = Date.now() - startTime;

        resolve({
          success: false,
          error: error.message,
          exitCode: -1,
          duration,
        });
      });
    });
  }

  /**
   * Replace parameter placeholders in a string
   */
  private templateString(str: string, params: Record<string, unknown>): string {
    let result = str;
    for (const [key, value] of Object.entries(params)) {
      const placeholder = `{${key}}`;
      result = result.replace(new RegExp(placeholder, 'g'), String(value));
    }
    return result;
  }
}

export default CommandExecutor;
