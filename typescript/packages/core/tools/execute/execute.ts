/**
 * Execute Tool - Execute shell commands with full output capture
 * By default runs the command WITHOUT a shell (execFile on a parsed argv), matching the Python SDK.
 * Shell operators, redirection and expansion do not work; builtins such as `dir` or `echo`
 * are not executables and are unavailable on Windows (use `node`, `git`, ... instead).
 * Passing `shell` opts in to running the command through that shell; every such call needs
 * a human approval that MATIMO_AUTO_APPROVE, approved patterns and `approved` cannot skip.
 */

import { execFile } from 'child_process';
import path from 'path';
import { promisify } from 'util';
import { MatimoError, ErrorCode, getGlobalMatimoLogger } from '@matimo/core/runtime';

const execFileAsync = promisify(execFile);

/**
 * Basic injection detection - checks for common shell metacharacters
 * that could be used for command injection attacks
 */
function detectCommandInjection(command: string): boolean {
  // Common injection patterns: command chaining, redirection, substitution
  // Note: $\w+ pattern is handled separately below
  const dangerousPatterns = [
    /[\r\n\0]/, // Newline / CR / NUL: command separators in sh, never legitimate in one command
    /;/,      // Command separator
    /\|/,     // Pipe
    /&/,      // Background/AND
    /`/,      // Command substitution (backticks)
    /\$\(/,   // Command substitution ($(command))
    /</,      // Input redirection
    />/,      // Output redirection
    /\$\{/,   // Variable expansion ${VAR}
  ];

  // Allow some safe variable expansions like $HOME, $PATH, but flag suspicious ones
  const safeVars = /^\$(HOME|PATH|USER|PWD|SHELL|LANG|TERM)$/i;

  // Check for dangerous patterns first
  for (const pattern of dangerousPatterns) {
    if (pattern.test(command)) {
      return true;
    }
  }

  // Special handling for environment variables: allow safe ones, flag suspicious ones
  const variablePattern = /\$\w+/g;
  const variables = command.match(variablePattern);
  if (variables) {
    for (const variable of variables) {
      if (!safeVars.test(variable)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Split a command line into argv the way a POSIX shell would for quoting only:
 * whitespace separates arguments, single and double quotes group, and a
 * backslash escapes the next character (not on Windows, where it is a path
 * separator). No expansion, globbing, or operators are interpreted.
 */
function splitCommand(command: string): string[] {
  const args: string[] = [];
  let current = '';
  let inArg = false;
  let quote: '"' | "'" | null = null;
  const backslashEscapes = process.platform !== 'win32';

  for (let i = 0; i < command.length; i++) {
    const ch = command[i];
    if (quote) {
      if (ch === quote) {
        quote = null;
      } else if (ch === '\\' && quote === '"' && backslashEscapes && '"\\'.includes(command[i + 1] ?? '')) {
        current += command[++i];
      } else {
        current += ch;
      }
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      inArg = true;
    } else if (ch === '\\' && backslashEscapes && i + 1 < command.length) {
      current += command[++i];
      inArg = true;
    } else if (/\s/.test(ch)) {
      if (inArg) {
        args.push(current);
        current = '';
        inArg = false;
      }
    } else {
      current += ch;
      inArg = true;
    }
  }
  if (quote) {
    throw new MatimoError('Unterminated quote in command', ErrorCode.INVALID_PARAMETER, {
      reason: 'Command has an unmatched quote character',
    });
  }
  if (inArg) args.push(current);
  return args;
}

interface ExecuteParams {
  command: string;
  args?: string[];
  cwd?: string;
  timeout?: number;
  shell?: string;
}

/**
 * Build the argv for running `command` through `shell`. POSIX-style shells get
 * `-c command` with `args` as positional parameters ($1, $2, ...); cmd and
 * PowerShell take the command line only.
 */
function shellInvocation(shell: string, command: string, args: string[]): string[] {
  const name = path.basename(shell).toLowerCase().replace(/\.exe$/, '');
  if (name === 'cmd' || name === 'powershell' || name === 'pwsh') {
    if (args.length > 0) {
      throw new MatimoError('Invalid args', ErrorCode.INVALID_PARAMETER, {
        reason: `args are not supported with shell '${name}'; put them in the command`,
      });
    }
    return name === 'cmd' ? ['/c', command] : ['-NoProfile', '-Command', command];
  }
  return ['-c', command, shell, ...args];
}

interface ExecuteResult {
  success: boolean;
  exitCode: number;
  stdout: string;
  stderr: string;
  command: string;
  duration: number;
}

/**
 * Execute a shell command and return structured output
 * Pattern based on LangChain.js exec/execSync approach
 */
export default async function executeCommand(
  params: ExecuteParams
): Promise<ExecuteResult> {
  const logger = getGlobalMatimoLogger();
  const { command, args: extraArgs = [], cwd, timeout = 30000, shell } = params;
  const useShell = shell !== undefined && shell !== null && shell !== '';
  const startTime = Date.now();

  if (!command || command.trim().length === 0) {
    logger.error('Execute tool: Empty command provided', {
      reason: 'No command provided',
    });
    throw new MatimoError('Command required', ErrorCode.INVALID_PARAMETER, {
      reason: 'No command provided',
    });
  }

  logger.debug('Execute tool: Command received', {
    command: command.substring(0, 100),
    cwd,
    timeout,
  });

  if (useShell && (typeof shell !== 'string' || /[\r\n\0]/.test(shell))) {
    throw new MatimoError('Invalid shell', ErrorCode.INVALID_PARAMETER, {
      reason: 'shell must be a single-line string naming a shell executable',
    });
  }

  // Check for potential command injection. A command run through an explicit
  // shell is a shell line by definition, so the filter does not apply: such a
  // call always goes to a human first (see requiresMandatoryHumanApproval).
  if (!useShell && detectCommandInjection(command)) {
    logger.warn('Execute tool: Command injection detected', {
      command: command.substring(0, 100),
      reason: 'Contains potentially dangerous shell metacharacters',
    });
    throw new MatimoError('Command injection detected', ErrorCode.INVALID_PARAMETER, {
      reason: 'Command contains potentially dangerous shell metacharacters',
      command: command,
    });
  }

  // Approval is enforced before this executor runs: the tool declares
  // `requires_approval: true`, so MatimoInstance.execute() asks the
  // instance's onApproval callback (or the global approval handler's) for
  // every call, and for a call with a `shell` it asks a human even under
  // MATIMO_AUTO_APPROVE. Asking again here would prompt twice and bypass a
  // per-instance callback.

  if (!Array.isArray(extraArgs) || extraArgs.some((a) => typeof a !== 'string')) {
    throw new MatimoError('Invalid args', ErrorCode.INVALID_PARAMETER, {
      reason: 'args must be an array of strings',
    });
  }

  // Explicit args are appended verbatim (never re-split), so an argument with spaces stays one argument.
  const argv = useShell
    ? [shell as string, ...shellInvocation(shell as string, command, extraArgs)]
    : [...splitCommand(command), ...extraArgs];
  if (argv.length === 0) {
    throw new MatimoError('Command required', ErrorCode.INVALID_PARAMETER, {
      reason: 'No command provided',
    });
  }

  try {
    // Without `shell`, argv[0] is executed directly, so metacharacters in arguments
    // are inert; the injection check above stays as defence in depth and for parity
    // with the Python SDK. With `shell`, argv[0] is that shell. Approval is the
    // primary control either way.
    const [file, ...args] = argv;
    const { stdout, stderr } = await execFileAsync(file, args, {
      cwd,
      timeout,
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer for large outputs
      windowsHide: true,
    });

    const duration = Date.now() - startTime;

    // Convert Buffer to string if needed
    const stdoutStr = typeof stdout === 'string' ? stdout : (stdout as unknown ? String(stdout) : '');
    const stderrStr = typeof stderr === 'string' ? stderr : (stderr as unknown ? String(stderr) : '');

    logger.info('Execute tool: Command completed successfully', {
      command: command.substring(0, 100),
      duration,
      stdoutLength: stdoutStr.length,
      stderrLength: stderrStr.length,
    });

    return {
      success: true,
      exitCode: 0,
      stdout: stdoutStr.trim(),
      stderr: stderrStr.trim(),
      command,
      duration,
    };
  } catch (error: unknown) {
    const duration = Date.now() - startTime;
    
    // Type guard for error object
    const errorObj = error as Record<string, unknown> & { 
      killed?: boolean;
      signal?: string;
      code?: number | string;
      stdout?: string;
      stderr?: string;
      message?: string;
    };
    
    const isTimeout = errorObj.killed || errorObj.signal === 'SIGTERM';
    // Spawn failures (e.g. ENOENT) carry a string code and no stderr: report exit code 1
    // and surface the message so the agent can see what went wrong.
    const exitCode = isTimeout ? -1 : typeof errorObj.code === 'number' ? errorObj.code || 1 : 1;

    // If it's already a MatimoError, re-throw it
    if (error instanceof MatimoError) {
      throw error;
    }

    // Convert Buffer to string if needed
    const stdoutStr = typeof errorObj.stdout === 'string' ? errorObj.stdout : (errorObj.stdout ? String(errorObj.stdout) : '');
    const stderrStr = typeof errorObj.stderr === 'string' ? errorObj.stderr : (errorObj.stderr ? String(errorObj.stderr) : '');

    logger.warn('Execute tool: Command execution failed', {
      command: command.substring(0, 100),
      duration,
      exitCode,
      isTimeout,
      errorMessage: errorObj.message ? errorObj.message.substring(0, 100) : 'Unknown error',
      stderrLength: stderrStr.length,
    });

    // For command execution failures, return structured result (not throw)
    // This allows the agent to see what went wrong
    return {
      success: false,
      exitCode,
      stdout: stdoutStr.trim(),
      stderr: stderrStr.trim() || (typeof errorObj.code === 'string' ? (errorObj.message ?? '') : ''),
      command,
      duration,
    };
  }
}
