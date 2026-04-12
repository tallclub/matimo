/**
 * Execute Tool - Execute shell commands with full output capture
 * LangChain-style: uses exec() directly from same process
 * Cross-platform: Windows (cmd.exe), Unix/Linux/Mac (sh/bash)
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { MatimoError, ErrorCode } from '../../src/errors/matimo-error';
import { getGlobalMatimoLogger } from '../../src/logging/logger';
import { getGlobalApprovalHandler } from '../../src/approval/approval-handler';

const execAsync = promisify(exec);

/**
 * Basic injection detection - checks for common shell metacharacters
 * that could be used for command injection attacks
 */
function detectCommandInjection(command: string): boolean {
  // Common injection patterns: command chaining, redirection, substitution
  // Note: $\w+ pattern is handled separately below
  const dangerousPatterns = [
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

interface ExecuteParams {
  command: string;
  cwd?: string;
  timeout?: number;
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
  const { command, cwd, timeout = 30000 } = params;
  const startTime = Date.now();

  logger.debug('Execute tool: Command received', {
    command: command.substring(0, 100),
    cwd,
    timeout,
  });

  if (!command || command.trim().length === 0) {
    logger.error('Execute tool: Empty command provided', {
      reason: 'No command provided',
    });
    throw new MatimoError('Command required', ErrorCode.INVALID_PARAMETER, {
      reason: 'No command provided',
    });
  }

  // Check for potential command injection
  if (detectCommandInjection(command)) {
    logger.warn('Execute tool: Command injection detected', {
      command: command.substring(0, 100),
      reason: 'Contains potentially dangerous shell metacharacters',
    });
    throw new MatimoError('Command injection detected', ErrorCode.INVALID_PARAMETER, {
      reason: 'Command contains potentially dangerous shell metacharacters',
      command: command,
    });
  }

  // Check if command appears to be destructive and request approval if needed
  // ApprovalHandler checks against centralized destructive keywords from YAML
  const approvalHandler = getGlobalApprovalHandler();
  
  if (approvalHandler.requiresApproval(false, command)) {
    logger.info('Execute tool: Destructive command detected - requesting approval', {
      command: command.substring(0, 100),
    });

    // Request user approval before executing destructive command
    if (!approvalHandler.isPreApproved('execute')) {
      await approvalHandler.requestApproval({
        toolName: 'execute',
        description: `Execute shell command: ${command.substring(0, 100)}${command.length > 100 ? '...' : ''}`,
        params: { command, cwd },
      });
    }
  }

  try {
    // SECURITY WARNING: This tool executes arbitrary shell commands directly.
    // The 'command' parameter is passed to exec() without sanitization, creating
    // a command injection vulnerability if user input is not properly validated.
    // Basic injection detection is performed above, but this is NOT foolproof.
    // Only use with trusted input or implement additional validation layers.
    // exec() auto-selects shell: cmd.exe on Windows, /bin/sh on Unix
    const { stdout, stderr } = await execAsync(command, {
      cwd,
      timeout,
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer for large outputs
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
      code?: number;
      stdout?: string;
      stderr?: string;
      message?: string;
    };
    
    const isTimeout = errorObj.killed || errorObj.signal === 'SIGTERM';

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
      exitCode: isTimeout ? -1 : (errorObj.code || 1),
      isTimeout,
      errorMessage: errorObj.message ? errorObj.message.substring(0, 100) : 'Unknown error',
      stderrLength: stderrStr.length,
    });

    // For command execution failures, return structured result (not throw)
    // This allows the agent to see what went wrong
    return {
      success: false,
      exitCode: isTimeout ? -1 : (errorObj.code || 1),
      stdout: stdoutStr.trim(),
      stderr: stderrStr.trim(),
      command,
      duration,
    };
  }
}
