import { ToolDefinition } from '../core/types.js';
import type { MatimoInstance } from '../matimo-instance.js';
import { MatimoError, ErrorCode } from '../errors/matimo-error';

/**
 * Global Matimo instance for decorator usage
 * Set via setGlobalMatimoInstance() before using @tool decorators
 */
let globalMatimoInstance: MatimoInstance | null = null;

/**
 * Set the global Matimo instance for decorator usage
 *
 * Must be called before any @tool decorated methods are invoked
 *
 * @param instance - The MatimoInstance to use globally
 *
 * @example
 * ```typescript
 * const matimo = await MatimoInstance.init('./tools');
 * setGlobalMatimoInstance(matimo);
 *
 * class MyAgent {
 *   @tool('calculator')
 *   async calculate(operation: string, a: number, b: number) { }
 * }
 *
 * const agent = new MyAgent();
 * await agent.calculate('add', 5, 3);
 * ```
 */
export function setGlobalMatimoInstance(instance: MatimoInstance | null): void {
  globalMatimoInstance = instance;
}

/**
 * Get the global Matimo instance
 *
 * @throws {Error} If no global instance is set
 */
export function getGlobalMatimoInstance(): MatimoInstance {
  if (!globalMatimoInstance) {
    throw new MatimoError(
      'Global MatimoInstance not set. Call setGlobalMatimoInstance() before using @tool decorator.',
      ErrorCode.TOOL_NOT_FOUND
    );
  }
  return globalMatimoInstance;
}

/**
 * Tool decorator - transforms a method into a tool executor
 *
 * Automatically calls matimo.execute() with the method's arguments mapped to tool parameters.
 * Must be used in a class that has a `matimo` property or after setGlobalMatimoInstance() is called.
 *
 * Works with both traditional and modern TypeScript decorator syntax.
 *
 * @param toolName - Name of the tool to execute (e.g., 'calculator', 'github-get-repo')
 *
 * @example
 * ```typescript
 * // Using global instance
 * const matimo = await MatimoInstance.init('./tools');
 * setGlobalMatimoInstance(matimo);
 *
 * class MyAgent {
 *   @tool('calculator')
 *   async calculate(operation: string, a: number, b: number) {
 *     // Automatically executes: matimo.execute('calculator', { operation, a, b })
 *   }
 *
 *   @tool('github-get-repo')
 *   async getRepo(owner: string, repo: string) {
 *     // Automatically executes: matimo.execute('github-get-repo', { owner, repo })
 *   }
 * }
 *
 * const agent = new MyAgent();
 * const result = await agent.calculate('add', 5, 3);
 * ```
 *
 * @example
 * ```typescript
 * // Using instance property
 * class MyAgent {
 *   constructor(public matimo: MatimoInstance) {}
 *
 *   @tool('calculator')
 *   async calculate(operation: string, a: number, b: number) { }
 * }
 *
 * const matimo = await MatimoInstance.init('./tools');
 * const agent = new MyAgent(matimo);
 * const result = await agent.calculate('add', 5, 3);
 * ```
 */
export function tool(toolName: string) {
  return function <This, Args extends unknown[], Return>(
    _target: (this: This, ...args: Args) => Return,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    _context: any
  ) {
    // Handle modern experimental decorator API
    // The decorator can be used on methods and will receive the method and context

    // Return a new function that intercepts the call
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return async function (this: any, ...args: Args): Promise<unknown> {
      return executeToolViaDecorator(toolName, this, args);
    };
  };
}

/**
 * Execute tool via decorator - shared logic for both decorator syntaxes
 * Exported for testing purposes
 */
export async function executeToolViaDecorator(
  toolName: string,
  thisArg: unknown,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  args: any[]
): Promise<unknown> {
  // Get Matimo instance (from class property or global)
  let matimoInstance: MatimoInstance | null = null;

  if (thisArg && typeof thisArg === 'object' && 'matimo' in thisArg) {
    matimoInstance = (thisArg as { matimo?: MatimoInstance }).matimo || null;
  }

  if (!matimoInstance) {
    matimoInstance = globalMatimoInstance;
  }

  if (!matimoInstance) {
    throw new MatimoError(
      `Matimo instance not found for @tool('${toolName}') decorator. ` +
        `Either add matimo property to class or call setGlobalMatimoInstance() first.`,
      ErrorCode.TOOL_NOT_FOUND,
      { toolName }
    );
  }

  // Get tool definition
  const toolDef = matimoInstance.getTool(toolName);
  if (!toolDef) {
    throw new MatimoError(
      `Tool '${toolName}' not found in Matimo registry`,
      ErrorCode.TOOL_NOT_FOUND,
      {
        toolName,
      }
    );
  }

  // Convert positional arguments to parameters object
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const params = convertArgsToParams(args, toolDef as any);

  // Execute tool via Matimo
  return matimoInstance.execute(toolName, params);
}
/**
 * Convert positional arguments to named parameters object
 * Maps function arguments to tool parameter names in order
 * Exported for testing purposes
 *
 * @example
 * ```
 * Tool has parameters: { operation, a, b }
 * Args: ['add', 5, 3]
 * Result: { operation: 'add', a: 5, b: 3 }
 * ```
 */
export function convertArgsToParams(
  args: unknown[],
  toolDef: ToolDefinition
): Record<string, unknown> {
  const params: Record<string, unknown> = {};

  if (!toolDef.parameters) {
    return params;
  }

  const paramNames = Object.keys(toolDef.parameters);

  for (let i = 0; i < args.length && i < paramNames.length; i++) {
    params[paramNames[i]] = args[i];
  }

  return params;
}
