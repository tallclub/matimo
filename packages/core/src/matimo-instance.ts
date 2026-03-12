import path from 'path';
import { ToolLoader } from './core/tool-loader';
import { ToolRegistry } from './core/tool-registry';
import { CommandExecutor } from './executors/command-executor';
import { HttpExecutor } from './executors/http-executor';
import { FunctionExecutor } from './executors/function-executor';
import { ToolDefinition } from './core/schema';
import { MatimoError, ErrorCode } from './errors/matimo-error';
import {
  MatimoLogger,
  LoggerConfig,
  getLoggerConfig,
  createLogger,
  setGlobalMatimoLogger,
} from './logging';
import { ApprovalHandler, getGlobalApprovalHandler } from './approval/approval-handler';
import type { ExecuteOptions } from './core/types';

/**
 * Options for MatimoInstance initialization
 */
export interface InitOptions extends LoggerConfig {
  toolPaths?: string[];
  autoDiscover?: boolean;
  includeCore?: boolean;
}

/**
 * Matimo Instance - Single initialization point for tool execution
 * Combines loader, registry, and executors into one interface
 */
export class MatimoInstance {
  private toolPaths: string[];
  private loader: ToolLoader;
  private registry: ToolRegistry;
  private commandExecutor: CommandExecutor;
  private httpExecutor: HttpExecutor;
  private functionExecutor: FunctionExecutor;
  private logger: MatimoLogger;
  private approvalHandler: ApprovalHandler;

  private constructor(toolPaths: string[], logger: MatimoLogger) {
    this.toolPaths = toolPaths;
    this.logger = logger;
    this.loader = new ToolLoader();
    this.registry = new ToolRegistry();
    // Use the first path (primary) as working directory for command executor
    const workingDir = toolPaths.length > 0 ? path.dirname(toolPaths[0]) : process.cwd();
    this.commandExecutor = new CommandExecutor(workingDir);
    this.httpExecutor = new HttpExecutor();
    this.functionExecutor = new FunctionExecutor(toolPaths[0] || '');
    this.approvalHandler = getGlobalApprovalHandler();
  }

  /**
   * Initialize Matimo with tools from directory or auto-discovery
   * @param options - Initialization options (string for backward compatibility)
   * @returns MatimoInstance ready to execute tools
   *
   * @example
   * // Backward compatible - single path
   * const matimo = await MatimoInstance.init('./tools');
   *
   * // New - auto-discovery
   * const matimo = await MatimoInstance.init({ autoDiscover: true });
   *
   * // Explicit paths with logging config
   * const matimo = await MatimoInstance.init({
   *   toolPaths: ['./tools'],
   *   logLevel: 'debug',
   *   logFormat: 'json'
   * });
   *
   * // Custom logger
   * const matimo = await MatimoInstance.init({
   *   toolPaths: ['./tools'],
   *   logger: myCustomLogger
   * });
   */
  static async init(options?: InitOptions | string): Promise<MatimoInstance> {
    let finalOptions: InitOptions;

    // Backward compatibility: if string is passed, treat as toolPath
    if (typeof options === 'string') {
      finalOptions = {
        toolPaths: [options],
        autoDiscover: false,
        includeCore: false,
      };
    } else {
      finalOptions = {
        autoDiscover: false,
        includeCore: true,
        ...options,
      };
    }

    // Initialize logger from config and environment variables
    const loggerConfig = getLoggerConfig({
      logLevel: finalOptions.logLevel,
      logFormat: finalOptions.logFormat,
      logger: finalOptions.logger,
    });
    const logger = createLogger(loggerConfig);

    // Set global logger for use by modules
    setGlobalMatimoLogger(logger);

    logger.debug('Matimo SDK initializing', {
      logLevel: loggerConfig.logLevel,
      logFormat: loggerConfig.logFormat,
      hasPaths: !!finalOptions.toolPaths?.length,
      autoDiscover: finalOptions.autoDiscover,
    });

    const toolPaths: string[] = [];

    // Include core tools (calculator, etc.) - currently not used in monorepo
    // Use explicit toolPaths or autoDiscover instead
    // if (finalOptions.includeCore) { ... }

    // Add explicit paths
    if (finalOptions.toolPaths) {
      toolPaths.push(...finalOptions.toolPaths);
      logger.debug(`Adding explicit tool paths`, { count: finalOptions.toolPaths.length });
    }

    // Auto-discover @matimo/* packages
    if (finalOptions.autoDiscover) {
      const discoveredPaths = new ToolLoader().autoDiscoverPackages();
      toolPaths.push(...discoveredPaths);
      logger.debug(`Auto-discovered tool paths`, { count: discoveredPaths.length });
    }

    const instance = new MatimoInstance(toolPaths, logger);

    // Load tools from all paths
    const allTools = instance.loader.loadToolsFromMultiplePaths(toolPaths);
    instance.registry.registerAll(Array.from(allTools.values()));

    logger.info(`Matimo SDK initialized successfully`, {
      toolCount: allTools.size,
      paths: toolPaths.length,
    });

    return instance;
  }

  /**
   * Get tool paths
   * @returns Array of tool paths
   */
  getToolPaths(): string[] {
    return [...this.toolPaths];
  }

  /**
   * Get the logger instance
   * @returns MatimoLogger instance
   */
  getLogger(): MatimoLogger {
    return this.logger;
  }

  /**
   * Execute a tool by name with parameters.
   *
   * @param toolName - Name of the tool to execute
   * @param params - Tool parameters
   * @param options - Optional execution options
   * @param options.timeout - Execution timeout in milliseconds
   * @param options.credentials - Per-call credential overrides (multi-tenant support).
   *   Keys must match the env-var names the tool references (e.g. `SLACK_BOT_TOKEN`).
   *   When provided, they take precedence over `process.env` for that single call.
   *   Values are never logged and held in memory only for the duration of the call.
   * @returns Tool execution result
   */
  async execute(
    toolName: string,
    params: Record<string, unknown>,
    options?: ExecuteOptions
  ): Promise<unknown> {
    const tool = this.registry.get(toolName);
    if (!tool) {
      const availableTools = this.registry.getAll().map((t) => t.name);
      this.logger.error(`Tool not found: ${toolName}`, {
        toolName,
        availableTools,
      });
      throw new MatimoError(`Tool '${toolName}' not found in registry`, ErrorCode.TOOL_NOT_FOUND, {
        toolName,
        availableTools,
      });
    }

    this.logger.debug(`Executing tool: ${toolName}`, {
      toolName,
      paramCount: Object.keys(params).length,
    });

    try {
      // Simple approval flow:
      // 1. Check if tool requires approval (from YAML or keyword detection)
      // 2. Check if pre-approved via env vars
      // 3. Call approval callback if not pre-approved

      // Prefer execution-type-specific checks to reduce false positives.
      // - `command` tools: scan `params.command`
      // - SQL tools (convention): scan `params.sql`
      // If configured via `MATIMO_APPROVAL_SCAN_ALL_PARAMS=true`, fall back
      // to scanning all string-valued params.
      const executionType = (tool.execution.type || '') as string;
      let scanContent: string | undefined;

      if (executionType === 'command' && typeof params.command === 'string') {
        scanContent = params.command;
      } else if (typeof params.sql === 'string') {
        scanContent = params.sql;
      } else if (process.env.MATIMO_APPROVAL_SCAN_ALL_PARAMS === 'true') {
        const parts: string[] = [];
        for (const val of Object.values(params)) {
          if (typeof val === 'string') parts.push(val);
        }
        if (parts.length > 0) scanContent = parts.join(' ');
      }

      const requiresApproval = this.approvalHandler.requiresApproval(
        tool.requires_approval,
        scanContent
      );

      if (requiresApproval && !this.approvalHandler.isPreApproved(toolName)) {
        this.logger.debug(`Approval required for: ${toolName}`, { toolName });
        await this.approvalHandler.requestApproval({
          toolName,
          description: tool.description,
          params,
        });
        this.logger.info(`Destructive operation approved: ${toolName}`, { toolName });
      }

      const credentials = options?.credentials;

      // Auto-inject authentication parameters. When per-call credentials are
      // supplied they take precedence over process.env (multi-tenant support).
      const finalParams = this.injectAuthParameters(tool, params, credentials);

      const executor = this.getExecutor(tool);
      const result = await executor.execute(tool, finalParams, credentials);

      this.logger.debug(`Tool executed successfully: ${toolName}`, {
        toolName,
        hasResult: !!result,
      });

      return result;
    } catch (error) {
      this.logger.error(`Tool execution failed: ${toolName}`, {
        toolName,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get a tool definition by name
   * @param toolName - Name of the tool
   * @returns Tool definition or undefined
   */
  getTool(toolName: string): ToolDefinition | undefined {
    return this.registry.get(toolName);
  }

  /**
   * List all available tools
   * @returns Array of tool definitions
   */
  listTools(): ToolDefinition[] {
    return this.registry.getAll();
  }

  /**
   * Get all available tools (alias for listTools)
   * @returns Array of tool definitions
   */
  getAllTools(): ToolDefinition[] {
    return this.registry.getAll();
  }

  /**
   * Search tools by name or description
   * @param query - Search query
   * @returns Matching tools
   */
  searchTools(query: string): ToolDefinition[] {
    return this.registry.search(query);
  }

  /**
   * Get tools by tag
   * @param tag - Tag to search for
   * @returns Tools with the given tag
   */
  getToolsByTag(tag: string): ToolDefinition[] {
    return this.registry.getByTag(tag);
  }

  /**
   * Return the credential key names that a tool expects.
   *
   * This lets multi-tenant callers know exactly what to put in `options.credentials`
   * without having to read the tool's YAML definition.
   *
   * The returned strings are the keys you pass to `execute()`:
   * ```typescript
   * const keys = matimo.getRequiredCredentials('slack-send-message');
   * // → ['SLACK_BOT_TOKEN']
   *
   * // Then collect from your secrets store:
   * const credentials = Object.fromEntries(
   *   keys.map(k => [k, tenant.secrets[k]])
   * );
   * await matimo.execute('slack-send-message', params, { credentials });
   * ```
   *
   * @param toolName - Exact tool name
   * @returns Array of credential key names (may be empty if the tool needs no auth)
   * @throws `MatimoError(TOOL_NOT_FOUND)` if the tool doesn't exist
   */
  getRequiredCredentials(toolName: string): string[] {
    const tool = this.registry.get(toolName);
    if (!tool) {
      throw new MatimoError(`Tool '${toolName}' not found in registry`, ErrorCode.TOOL_NOT_FOUND, {
        toolName,
        availableTools: this.registry.getAll().map((t) => t.name),
      });
    }

    const authPatterns = [
      'token',
      'key',
      'secret',
      'password',
      'credential',
      'auth',
      'bearer',
      'api_key',
    ];

    const referencedParams = this.extractParameterPlaceholders(tool);
    const credentialKeys: string[] = [];

    for (const paramName of referencedParams) {
      const lowerName = paramName.toLowerCase();
      if (authPatterns.some((pattern) => lowerName.includes(pattern))) {
        credentialKeys.push(paramName);
      }
    }

    // Also include basic-auth env var names declared in authentication config
    const auth = tool.authentication;
    if (auth?.type === 'basic') {
      if (auth.username_env && !credentialKeys.includes(auth.username_env)) {
        credentialKeys.push(auth.username_env);
      }
      if (auth.password_env && !credentialKeys.includes(auth.password_env)) {
        credentialKeys.push(auth.password_env);
      }
    }

    return credentialKeys;
  }

  /**
   * Automatically inject parameters from environment variables
   * Uses a YAML-native, scale-friendly approach:
   *
   * 1. Scans the execution config for all parameter placeholders
   * 2. For each parameter not provided by user, checks if it looks like auth (TOKEN, KEY, SECRET, etc.)
   * 3. If yes, attempts to load from (in order of priority):
   *    a. `credentials[paramName]`          — per-call override (multi-tenant)
   *    b. `credentials[MATIMO_${paramName}]` — prefixed per-call override
   *    c. `process.env[MATIMO_${paramName}]` — prefixed env var
   *    d. `process.env[paramName]`           — direct env var
   *
   * Credential values are never logged.
   */
  private injectAuthParameters(
    tool: ToolDefinition,
    params: Record<string, unknown>,
    credentials?: Record<string, string>
  ): Record<string, unknown> {
    const result = { ...params };

    // Collect all parameter names referenced in the execution config
    const referencedParams = this.extractParameterPlaceholders(tool);
    // Auth-related parameter name patterns (case-insensitive)
    const authPatterns = [
      'token',
      'key',
      'secret',
      'password',
      'credential',
      'auth',
      'bearer',
      'api_key',
    ];

    // Check each referenced parameter
    for (const paramName of referencedParams) {
      // Skip if user already provided it
      if (paramName in result) {
        continue;
      }

      // Check if parameter name looks like auth
      const lowerName = paramName.toLowerCase();
      const isAuthParam = authPatterns.some((pattern) => lowerName.includes(pattern));

      if (isAuthParam) {
        // Lookup order:
        // 1. Per-call credentials (multi-tenant override — never touches process.env)
        // 2. Per-call credentials with MATIMO_ prefix
        // 3. Environment variable with MATIMO_ prefix
        // 4. Environment variable with the exact param name
        let resolvedValue: string | undefined;

        if (credentials) {
          resolvedValue = credentials[paramName] ?? credentials[`MATIMO_${paramName}`];
        }

        if (!resolvedValue) {
          resolvedValue = process.env[`MATIMO_${paramName}`] ?? process.env[paramName];
        }

        if (resolvedValue) {
          result[paramName] = resolvedValue;
        }
      }
    }

    return result;
  }

  /**
   * Extract all parameter placeholders from execution config
   * Scans headers, body, URL, and query_params for {paramName} patterns
   */
  private extractParameterPlaceholders(tool: ToolDefinition): Set<string> {
    const params = new Set<string>();
    const placeholderRegex = /\{([^}]+)\}/g;

    const execution = tool.execution;

    // Scan URL
    if ('url' in execution && execution.url) {
      let match;
      while ((match = placeholderRegex.exec(execution.url)) !== null) {
        params.add(match[1]);
      }
    }

    // Scan headers
    if ('headers' in execution && execution.headers && typeof execution.headers === 'object') {
      for (const value of Object.values(execution.headers)) {
        if (typeof value === 'string') {
          let match;
          while ((match = placeholderRegex.exec(value)) !== null) {
            params.add(match[1]);
          }
        }
      }
    }

    // Scan body (recursively for nested objects)
    if ('body' in execution && execution.body) {
      this.scanObjectForParams(execution.body, params);
    }

    // Scan query_params
    if (
      'query_params' in execution &&
      execution.query_params &&
      typeof execution.query_params === 'object'
    ) {
      for (const value of Object.values(execution.query_params)) {
        if (typeof value === 'string') {
          let match;
          while ((match = placeholderRegex.exec(value)) !== null) {
            params.add(match[1]);
          }
        }
      }
    }

    return params;
  }

  /**
   * Recursively scan object for parameter placeholders
   */
  private scanObjectForParams(
    obj: unknown,
    params: Set<string>,
    visited = new WeakSet<object>()
  ): void {
    if (!obj || typeof obj !== 'object') {
      return;
    }

    // Prevent infinite loops
    if (visited.has(obj as object)) {
      return;
    }
    visited.add(obj as object);

    const placeholderRegex = /\{([^}]+)\}/g;

    if (Array.isArray(obj)) {
      for (const item of obj) {
        if (typeof item === 'string') {
          let match;
          while ((match = placeholderRegex.exec(item)) !== null) {
            params.add(match[1]);
          }
        } else if (item && typeof item === 'object') {
          this.scanObjectForParams(item, params, visited);
        }
      }
    } else {
      for (const value of Object.values(obj)) {
        if (typeof value === 'string') {
          let match;
          while ((match = placeholderRegex.exec(value)) !== null) {
            params.add(match[1]);
          }
        } else if (value && typeof value === 'object') {
          this.scanObjectForParams(value, params, visited);
        }
      }
    }
  }

  /**
   * Get the appropriate executor for a tool
   */
  private getExecutor(tool: ToolDefinition) {
    const executionType = tool.execution.type as string;
    switch (executionType) {
      case 'command':
        return this.commandExecutor;
      case 'http':
        return this.httpExecutor;
      case 'function':
        return this.functionExecutor;
      default:
        throw new MatimoError(
          `Unsupported execution type: ${executionType}`,
          ErrorCode.EXECUTION_FAILED,
          { executionType }
        );
    }
  }
}

/**
 * Matimo namespace - Entry point for the SDK
 */
export const matimo = {
  /**
   * Initialize Matimo with a tools directory
   * @param toolsPath - Path to tools directory
   * @returns MatimoInstance ready to use
   */
  async init(toolsPath: string): Promise<MatimoInstance> {
    return MatimoInstance.init(toolsPath);
  },
};
