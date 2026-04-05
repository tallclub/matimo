import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'node:url';
import axios from 'axios';
import { ToolDefinition } from '../core/schema';
import { MatimoError, ErrorCode } from '../errors/matimo-error';
import { getGlobalMatimoLogger } from '../logging/logger';

/**
 * FunctionExecutor - Executes async functions
 * Supports functions defined in:
 * 1. Embedded code in tool YAML (legacy)
 * 2. Colocated .ts files (recommended)
 *
 * For .ts files, the tool directory structure should be:
 * tools/provider/tool-name/
 * ├── definition.yaml
 * └── tool-name.ts (exports default async function)
 */
export class FunctionExecutor {
  private toolsPath: string;

  constructor(toolsPath?: string) {
    this.toolsPath = toolsPath || process.cwd();
  }

  /**
   * Execute a tool that runs an async function.
   * Supports both embedded code and external .ts/.js files.
   *
   * @param tool - Tool definition
   * @param params - Tool parameters
   * @param credentials - Optional per-call credential overrides passed as `context.credentials`
   *   to the tool function. The function can use them with:
   *   `const token = context?.credentials?.MY_TOKEN ?? process.env.MY_TOKEN;`
   *   Values are never logged. Falls back to undefined when not provided.
   */
  async execute(
    tool: ToolDefinition,
    params: Record<string, unknown>,
    credentials?: Record<string, string>
  ): Promise<unknown> {
    if (tool.execution.type !== 'function') {
      throw new MatimoError('Tool execution type is not function', ErrorCode.EXECUTION_FAILED, {
        expectedType: 'function',
        actualType: tool.execution.type,
      });
    }

    const { code, timeout = 30000 } = tool.execution;

    if (!code || code.trim().length === 0) {
      throw new MatimoError('Function code is empty', ErrorCode.EXECUTION_FAILED, {
        toolName: tool.name,
      });
    }

    return new Promise((resolve) => {
      let timedOut = false;
      let settled = false;

      // Set up timeout that resolves with error
      const timer = setTimeout(() => {
        timedOut = true;
        if (!settled) {
          settled = true;
          resolve({
            success: false,
            error: 'Function execution timeout',
            code: ErrorCode.EXECUTION_FAILED,
          });
        }
      }, timeout);

      const cleanup = () => {
        clearTimeout(timer);
      };

      const handleError = (error: unknown) => {
        cleanup();
        if (!settled) {
          settled = true;
          // Resolve with error object for tools to handle
          if (error instanceof MatimoError) {
            resolve({
              success: false,
              error: error.message,
              code: error.code,
              details: error.details,
            });
          } else if (error instanceof Error) {
            resolve({
              success: false,
              error: error.message,
            });
          } else {
            resolve({
              success: false,
              error: String(error),
            });
          }
        }
      };

      const handleSuccess = (data: unknown) => {
        cleanup();
        if (!settled) {
          settled = true;
          if (timedOut) {
            resolve({
              success: false,
              error: 'Function execution timeout',
              code: ErrorCode.EXECUTION_FAILED,
            });
          } else {
            resolve(data);
          }
        }
      };

      try {
        // Check if code is a file path (starts with ./ or contains .ts or .js)
        if (code.includes('.ts') || code.includes('.js') || code.startsWith('./')) {
          // Load from external file using dynamic import()
          // This works with TypeScript via ESM import

          // Resolve relative to the tool definition file location
          let absolutePath: string;
          if (tool._definitionPath) {
            // Use the definition file directory as the base for relative paths
            const definitionDir = path.dirname(tool._definitionPath);
            absolutePath = path.resolve(definitionDir, code);
          } else {
            // Fallback: use the old logic (for backward compatibility)
            // Compute tool directory: tools/{provider}/{tool-name}/
            const toolName = tool.name;
            let toolDir: string;
            if (toolName.includes('-')) {
              const parts = toolName.split('-');
              const provider = parts[0];
              toolDir = path.join(this.toolsPath, provider, toolName);
            } else {
              toolDir = path.join(this.toolsPath, toolName);
            }
            absolutePath = path.resolve(toolDir, code);
          }

          const fileUrl = pathToFileURL(absolutePath).href;

          // Use dynamic import() for ESM/TypeScript compatibility with robust URL handling
          import(fileUrl)
            .then((module) => {
              const fn = (module.default || module) as (
                input: Record<string, unknown>,
                context?: { credentials?: Record<string, string> }
              ) => Promise<unknown>;
              const result = fn(params, credentials ? { credentials } : undefined);

              // Handle both Promise and non-Promise returns
              if (result instanceof Promise) {
                result.then(handleSuccess).catch(handleError);
              } else {
                handleSuccess(result);
              }
            })
            .catch(handleError);
        } else {
          // Execute embedded code (legacy) - create function from string
          // SECURITY WARNING: Embedded code execution runs arbitrary JS with fs/path/axios access.
          // This is a potential RCE vector if tool YAML files come from untrusted sources.
          // Embedded code is DISABLED by default. Must explicitly opt-in via MATIMO_ALLOW_EMBEDDED_CODE=true

          const embeddedCodeDisabled = process.env.MATIMO_ALLOW_EMBEDDED_CODE !== 'true';
          if (embeddedCodeDisabled) {
            throw new MatimoError(
              'Embedded code execution is disabled by default for security. Use external .ts/.js files instead.',
              ErrorCode.EXECUTION_FAILED,
              {
                toolName: tool.name,
                recommendation:
                  'Create a separate .ts file in the tool directory instead of using embedded code',
                enableFeatureFlag:
                  'Set MATIMO_ALLOW_EMBEDDED_CODE=true to enable (not recommended)',
              }
            );
          }

          // Log warning when embedded code is executed
          const logger = getGlobalMatimoLogger();
          logger.warn(
            `⚠️  Warning: Executing embedded code from tool '${tool.name}'. This carries security risks if tool YAML is from untrusted sources.`,
            { toolName: tool.name }
          );

          // In ESM modules, require is not available by default
          // We pass a safe require function that embedded code can use
          const functionBody = `return (${code})`;
          const fn = new Function(functionBody)() as (
            input: Record<string, unknown>,
            config: unknown,
            fs: unknown,
            pathModule: unknown,
            axios: unknown,
            require: NodeRequire | undefined
          ) => Promise<unknown>;
          // Pass undefined for require in ESM - embedded code should use import syntax
          const result = fn(params, {}, fs, path, axios, undefined);

          // Handle both Promise and non-Promise returns
          if (result instanceof Promise) {
            result.then(handleSuccess).catch(handleError);
          } else {
            handleSuccess(result);
          }
        }
      } catch (error) {
        handleError(error);
      }
    });
  }
}

export default FunctionExecutor;
