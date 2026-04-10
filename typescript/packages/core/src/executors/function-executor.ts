import path from 'path';
import { pathToFileURL } from 'node:url';
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
          // ── Embedded code execution ──────────────────────────────────────
          // Requires explicit admin opt-in: MATIMO_ALLOW_EMBEDDED_CODE=true
          // Even when enabled, a static security scan runs before evaluation
          // to block known exploit patterns. No dangerous globals are passed
          // into the sandbox — only `params` is accessible.

          if (process.env.MATIMO_ALLOW_EMBEDDED_CODE !== 'true') {
            throw new MatimoError(
              `Tool '${tool.name}': embedded code execution is disabled by default. ` +
                'Set MATIMO_ALLOW_EMBEDDED_CODE=true to enable, or use a colocated .ts/.js file instead ' +
                "(set execution.code to its relative path, e.g. './my-tool.ts').",
              ErrorCode.EXECUTION_FAILED,
              {
                toolName: tool.name,
                recommendation:
                  'Create a separate .ts file in the tool directory and set execution.code to its relative path',
              }
            );
          }

          // Static security scan — reject code containing dangerous constructs
          // BEFORE new Function() is ever called.
          const BLOCKED_PATTERNS: { re: RegExp; label: string }[] = [
            { re: /\brequire\s*\(/u, label: 'require()' },
            { re: /\bimport\s*\(/u, label: 'dynamic import()' },
            { re: /\bprocess\b/u, label: 'process object' },
            { re: /\b__dirname\b|\b__filename\b/u, label: '__dirname / __filename' },
            { re: /\beval\s*\(/u, label: 'eval()' },
            { re: /\bnew\s+Function\b/u, label: 'new Function()' },
            { re: /\bglobalThis\b|\bglobal\b/u, label: 'global / globalThis' },
          ];

          for (const { re, label } of BLOCKED_PATTERNS) {
            if (re.test(code)) {
              throw new MatimoError(
                `Embedded code in tool '${tool.name}' contains a blocked construct: '${label}'. ` +
                  'Embedded code may only access the provided params argument.',
                ErrorCode.EXECUTION_FAILED,
                { toolName: tool.name, blockedConstruct: label }
              );
            }
          }

          const logger = getGlobalMatimoLogger();
          logger.warn(
            `Executing embedded code for tool '${tool.name}'. Ensure this tool YAML is from a trusted source.`,
            { toolName: tool.name }
          );

          // Execute with strict mode and only params in scope.
          // No fs, path, axios, or require are passed — embedded code is
          // intentionally limited to pure data transformation of params.
          const fn = new Function('params', '"use strict";\nreturn (' + code + ')(params);') as (
            input: Record<string, unknown>
          ) => Promise<unknown>;

          const result = fn(params);
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
