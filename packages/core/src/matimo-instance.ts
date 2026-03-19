import fs from 'fs';
import path from 'path';
import { ToolLoader } from './core/tool-loader';
import { ToolRegistry } from './core/tool-registry';
import { SkillLoader } from './core/skill-loader';
import { SkillRegistry } from './core/skill-registry';
import type { SemanticSearchResult } from './core/skill-registry';
import { CommandExecutor } from './executors/command-executor';
import { HttpExecutor } from './executors/http-executor';
import { FunctionExecutor } from './executors/function-executor';
import {
  ToolDefinition,
  SkillDefinition,
  SkillSummary,
  SearchSkillsOptions,
  SkillContentOptions,
  EmbeddingProvider,
} from './core/types';
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
import type { PolicyEngine, PolicyContext, PolicyConfig, HITLCallback } from './policy/types';
import { DefaultPolicyEngine } from './policy/default-policy';
import { loadPolicyFromFile } from './policy/policy-loader';
import { ToolIntegrityTracker } from './policy/integrity-tracker';
import { ApprovalManifest } from './policy/approval-manifest';
import type { MatimoEvent, MatimoEventHandler } from './policy/events';

/**
 * Find the core skills directory by walking up from process.cwd().
 * Works in CJS (Jest), ESM (tsx), compiled dist, and on all platforms.
 */
function findCoreSkillsPath(): string | null {
  let dir = process.cwd();
  for (let i = 0; i < 20; i++) {
    const candidate = path.join(dir, 'packages', 'core', 'skills');
    if (fs.existsSync(candidate)) return candidate;
    // Also check node_modules/@matimo/core/skills
    const nmCandidate = path.join(dir, 'node_modules', '@matimo', 'core', 'skills');
    if (fs.existsSync(nmCandidate)) return nmCandidate;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

/**
 * Result of a hot-reload operation
 */
export interface ReloadResult {
  loaded: number;
  removed: number;
  revalidated: number;
  rejected: string[];
  /** True if a mid-load failure caused the registry to be restored to its previous state. */
  rolledBack?: boolean;
}

/**
 * Options for MatimoInstance initialization
 */
export interface InitOptions extends LoggerConfig {
  toolPaths?: string[];
  /** Skill paths for discovering SKILL.md files (Level 1 discovery) */
  skillPaths?: string[];
  autoDiscover?: boolean;
  includeCore?: boolean;
  /** Custom PolicyEngine implementation. Mutually exclusive with policyConfig and policyFile. */
  policy?: PolicyEngine;
  /** Shorthand to create a DefaultPolicyEngine. Ignored if `policy` is provided. */
  policyConfig?: PolicyConfig;
  /** Path to a policy.yaml file. Loaded into a DefaultPolicyEngine. Ignored if `policy` is provided. */
  policyFile?: string;
  /** Paths containing trusted (developer-authored) tools. Defaults to auto-discovered @matimo/* paths. */
  trustedPaths?: string[];
  /** Paths containing untrusted (agent-created) tools. These tools undergo content validation. */
  untrustedPaths?: string[];
  /** HMAC secret for approval manifest. Overrides MATIMO_APPROVAL_SECRET env. */
  approvalSecret?: string;
  /** Directory for .matimo-approvals.json. Defaults to process.cwd(). */
  approvalDir?: string;
  /** Event handler for audit events (tool creation, approval, execution, etc.) */
  onEvent?: MatimoEventHandler;
  /**
   * Human-in-the-loop callback for quarantined tools.
   * Called when a tool enters `pending_approval` state (medium-risk in prod with enableHITL).
   * Return `true` to approve, `false` to reject.
   * If not set, quarantined tools are rejected by default.
   */
  onHITL?: HITLCallback;
}

/**
 * Matimo Instance - Single initialization point for tool execution
 * Combines loader, registry, and executors into one interface
 */
export class MatimoInstance {
  private toolPaths: string[];
  private skillPaths: string[];
  private loader: ToolLoader;
  private registry: ToolRegistry;
  private skillLoader: SkillLoader;
  private skillRegistry: SkillRegistry;
  private commandExecutor: CommandExecutor;
  private httpExecutor: HttpExecutor;
  private functionExecutor: FunctionExecutor;
  private logger: MatimoLogger;
  private approvalHandler: ApprovalHandler;

  // Policy engine fields — runtime-enforced encapsulation via ES #private
  #policy: PolicyEngine | null;
  #integrityTracker: ToolIntegrityTracker;
  #approvalManifest: ApprovalManifest | null;
  #onEvent: MatimoEventHandler | null;
  #hitlCallback: HITLCallback | null;
  #trustedPaths: string[];
  #untrustedPaths: string[];
  #policyFile: string | null;

  private constructor(
    toolPaths: string[],
    skillPaths: string[],
    logger: MatimoLogger,
    policyOptions?: {
      policy?: PolicyEngine | null;
      trustedPaths?: string[];
      untrustedPaths?: string[];
      approvalSecret?: string;
      approvalDir?: string;
      onEvent?: MatimoEventHandler;
      onHITL?: HITLCallback;
      policyFile?: string;
    }
  ) {
    this.toolPaths = toolPaths;
    this.skillPaths = skillPaths;
    this.logger = logger;
    this.loader = new ToolLoader();
    this.registry = new ToolRegistry();
    this.skillLoader = new SkillLoader();
    this.skillRegistry = new SkillRegistry();
    // Use the first path (primary) as working directory for command executor
    const workingDir = toolPaths.length > 0 ? path.dirname(toolPaths[0]) : process.cwd();
    this.commandExecutor = new CommandExecutor(workingDir);
    this.httpExecutor = new HttpExecutor();
    this.functionExecutor = new FunctionExecutor(toolPaths[0] || '');
    this.approvalHandler = getGlobalApprovalHandler();

    // Policy engine setup
    this.#policy = policyOptions?.policy ?? null;
    this.#trustedPaths = policyOptions?.trustedPaths ?? [];
    this.#untrustedPaths = policyOptions?.untrustedPaths ?? [];
    this.#integrityTracker = new ToolIntegrityTracker();
    this.#onEvent = policyOptions?.onEvent ?? null;
    this.#hitlCallback = policyOptions?.onHITL ?? null;
    this.#policyFile = policyOptions?.policyFile ?? null;

    // Approval manifest
    if (this.#policy) {
      const approvalDir = policyOptions?.approvalDir ?? process.cwd();
      this.#approvalManifest = new ApprovalManifest(approvalDir, policyOptions?.approvalSecret);
    } else {
      this.#approvalManifest = null;
    }

    // Freeze policy to prevent runtime mutation by agents.
    // (The SDK's own reloadPolicy() bypasses the frozen reference by replacing #policy.)
    if (this.#policy) {
      Object.freeze(this.#policy);
    }
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
    const skillPaths: string[] = [];

    // Include core tools (calculator, etc.) - currently not used in monorepo
    // Use explicit toolPaths or autoDiscover instead
    // if (finalOptions.includeCore) { ... }

    // Add explicit tool paths
    if (finalOptions.toolPaths) {
      toolPaths.push(...finalOptions.toolPaths);
      logger.debug(`Adding explicit tool paths`, { count: finalOptions.toolPaths.length });
    }

    // Add explicit skill paths (include core skills by default)
    if (finalOptions.skillPaths) {
      skillPaths.push(...finalOptions.skillPaths);
      logger.debug(`Adding explicit skill paths`, { count: finalOptions.skillPaths.length });
    }
    // Always include core skills bundled with Matimo
    const coreSkillsPath = findCoreSkillsPath();
    if (coreSkillsPath && !skillPaths.includes(coreSkillsPath)) {
      skillPaths.push(coreSkillsPath);
      logger.debug(`Including core skills`, { path: coreSkillsPath });
    }

    // Auto-discover @matimo/* packages
    if (finalOptions.autoDiscover) {
      const discoveredPaths = new ToolLoader().autoDiscoverPackages();
      toolPaths.push(...discoveredPaths);
      logger.debug(`Auto-discovered tool paths`, { count: discoveredPaths.length });

      // Also discover skill paths from the same @matimo/* packages
      // Each discovered tool path is like @matimo/slack/tools/ — sibling skills/ may exist
      for (const toolPath of discoveredPaths) {
        const pkgDir = path.dirname(toolPath); // e.g. @matimo/slack/
        const pkgSkillsPath = path.join(pkgDir, 'skills');
        if (fs.existsSync(pkgSkillsPath) && !skillPaths.includes(pkgSkillsPath)) {
          skillPaths.push(pkgSkillsPath);
        }
      }
      logger.debug(`Auto-discovered skill paths`, { count: skillPaths.length });
    }

    // Build policy engine
    let policy: PolicyEngine | null = null;
    if (finalOptions.policy) {
      policy = finalOptions.policy;
    } else if (finalOptions.policyFile) {
      policy = loadPolicyFromFile(finalOptions.policyFile);
    } else if (finalOptions.policyConfig) {
      policy = new DefaultPolicyEngine(finalOptions.policyConfig);
    }

    const instance = new MatimoInstance(toolPaths, skillPaths, logger, {
      policy,
      trustedPaths: finalOptions.trustedPaths,
      untrustedPaths: finalOptions.untrustedPaths,
      approvalSecret: finalOptions.approvalSecret,
      approvalDir: finalOptions.approvalDir,
      onEvent: finalOptions.onEvent,
      onHITL: finalOptions.onHITL,
      policyFile: finalOptions.policyFile,
    });

    // Load tools from all paths
    const allTools = instance.loader.loadToolsFromMultiplePaths(toolPaths);
    instance.registry.registerAll(Array.from(allTools.values()));

    // Load skills from all paths
    for (const skillPath of skillPaths) {
      try {
        const skillsFromPath = instance.skillLoader.loadSkillsFromDirectory(
          skillPath,
          skillPath.includes('core') ? 'builtin' : 'user'
        );
        instance.skillRegistry.registerAll(skillsFromPath);
      } catch (err) {
        logger.warn(`Failed to load skills from path: ${skillPath}`, {
          error: (err as Error).message,
        });
      }
    }

    logger.info(`Matimo SDK initialized successfully`, {
      toolCount: allTools.size,
      skillCount: instance.skillRegistry.count(),
      paths: toolPaths.length,
      skillPaths: skillPaths.length,
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
      // Policy check: enforce RBAC and tool status before any execution
      if (this.#policy) {
        const policyContext: PolicyContext = options?.context ?? {};
        const decision = this.#policy.canExecute(policyContext, tool);
        if (decision.allowed === false) {
          this.#emitEvent({
            type: 'tool:execution_denied',
            toolName,
            reason: decision.reason,
            agentId: policyContext.agentId,
            timestamp: new Date().toISOString(),
          });
          throw new MatimoError(
            `Policy denied execution of '${toolName}': ${decision.reason}`,
            ErrorCode.POLICY_DENIED,
            { toolName, reason: decision.reason, riskLevel: decision.riskLevel }
          );
        }

        // Handle quarantined tools — check approval manifest or invoke HITL callback
        if (decision.allowed === 'pending_approval') {
          const approved = await this.#resolveHITL(tool, decision, policyContext);
          if (!approved) {
            this.#emitEvent({
              type: 'tool:quarantine_rejected',
              toolName,
              timestamp: new Date().toISOString(),
            });
            throw new MatimoError(
              `Tool '${toolName}' is quarantined and was not approved: ${decision.reason}`,
              ErrorCode.POLICY_DENIED,
              { toolName, reason: decision.reason, riskLevel: decision.riskLevel }
            );
          }
          this.#emitEvent({
            type: 'tool:quarantine_approved',
            toolName,
            timestamp: new Date().toISOString(),
          });
        }
      }

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
      const timeoutOverride = options?.timeout;

      // Auto-inject authentication parameters. When per-call credentials are
      // supplied they take precedence over process.env (multi-tenant support).
      const finalParams = this.injectAuthParameters(tool, params, credentials);

      // After injection, detect any auth-looking placeholders that are still unfilled.
      // This gives a clear actionable error instead of silently sending a bad header to the API.
      this.assertAuthParamsFilled(tool, finalParams, credentials);

      // Apply per-call timeout override if provided. Create a shallow copy so the
      // registered tool definition is never mutated between calls.
      // Built-in interception: matimo_reload_tools must run on the instance
      // itself because reloadTools() clears/rebuilds the in-memory registry.
      // The function executor has no reference to the MatimoInstance, so we
      // handle it directly here. This works identically for SDK, LangChain,
      // and MCP callers.
      if (toolName === 'matimo_reload_tools') {
        const reloadResult = await this.reloadTools();
        this.logger.info('matimo_reload_tools: reload completed', {
          loaded: reloadResult.loaded,
          removed: reloadResult.removed,
          rejected: reloadResult.rejected.length,
        });
        return {
          success: true,
          loaded: reloadResult.loaded,
          removed: reloadResult.removed,
          revalidated: reloadResult.revalidated,
          rejected: reloadResult.rejected,
          message: `Reload complete. ${reloadResult.loaded} tools loaded, ${reloadResult.removed} removed, ${reloadResult.rejected.length} rejected.`,
        };
      }

      const effectiveTool =
        timeoutOverride !== undefined
          ? { ...tool, execution: { ...tool.execution, timeout: timeoutOverride } }
          : tool;

      const executor = this.getExecutor(effectiveTool);
      const result = await executor.execute(effectiveTool, finalParams, credentials);

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
   * List all available tools, optionally filtered by policy.
   * @param context - PolicyContext for filtering. If omitted and policy is active, returns all tools (backward compatible).
   * @returns Array of tool definitions
   */
  listTools(context?: PolicyContext): ToolDefinition[] {
    const tools = this.registry.getAll();
    if (this.#policy && context) {
      return this.#policy.filterForAgent(context, tools);
    }
    return tools;
  }

  /**
   * Get all available tools (alias for listTools)
   * @returns Array of tool definitions
   */
  getAllTools(context?: PolicyContext): ToolDefinition[] {
    return this.listTools(context);
  }

  /**
   * Search tools by name or description
   * @param query - Search query
   * @returns Matching tools
   */
  searchTools(query: string, context?: PolicyContext): ToolDefinition[] {
    const results = this.registry.search(query);
    if (this.#policy && context) {
      return this.#policy.filterForAgent(context, results);
    }
    return results;
  }

  /**
   * Get tools by tag
   * @param tag - Tag to search for
   * @returns Tools with the given tag
   */
  getToolsByTag(tag: string, context?: PolicyContext): ToolDefinition[] {
    const results = this.registry.getByTag(tag);
    if (this.#policy && context) {
      return this.#policy.filterForAgent(context, results);
    }
    return results;
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

  // ─── Skills API ──────────────────────────────────────────────────────────

  /**
   * List all available skills (Level 1 discovery - minimal context)
   * @returns Array of skill summaries
   */
  listSkills(): SkillSummary[] {
    return this.skillRegistry.list();
  }

  /**
   * Get a single skill by name (Level 2 activation - full content)
   * @param name - Skill name
   * @returns Skill definition or null
   */
  getSkill(name: string): SkillDefinition | null {
    return this.skillRegistry.get(name) || null;
  }

  /**
   * Get selective skill content — only the sections an agent needs.
   * Prevents dumping entire SKILL.md files into the LLM context window.
   *
   * @example
   * // Get only error handling, max 500 tokens
   * matimo.getSkillContent('postgres-query-operations', {
   *   sections: ['Error Handling'],
   *   maxTokens: 500,
   * })
   */
  getSkillContent(name: string, options?: SkillContentOptions): string | null {
    return this.skillRegistry.getSkillContent(name, options);
  }

  /**
   * List all sections of a skill with their token costs.
   * Agents use this to decide which sections to load before activating.
   */
  getSkillSections(
    name: string
  ): Array<{ path: string; level: number; tokenEstimate: number }> | null {
    return this.skillRegistry.getSkillSections(name);
  }

  /**
   * Search skills by keyword, category, difficulty, etc.
   * Set `options.semantic = true` for embedding-based similarity ranking.
   * @param options - Search options
   * @returns Matching skills
   */
  searchSkills(options: SearchSkillsOptions = {}): SkillSummary[] {
    return this.skillRegistry.search(options);
  }

  /**
   * Semantic search with relevance scores.
   * Uses embeddings to find skills by meaning, not just keywords.
   *
   * @example
   * const results = await matimo.semanticSearchSkills('How do I handle Postgres locking?');
   * // → [{ skill: { name: 'postgres-query-operations' }, score: 0.82 }]
   */
  async semanticSearchSkills(
    query: string,
    options?: { limit?: number; minScore?: number }
  ): Promise<SemanticSearchResult[]> {
    return this.skillRegistry.semanticSearch(query, options);
  }

  /**
   * Set a custom embedding provider for semantic skill search.
   * If not set, a built-in TF-IDF provider is used.
   */
  setSkillEmbeddingProvider(provider: EmbeddingProvider): void {
    this.skillRegistry.setEmbeddingProvider(provider);
  }

  /**
   * Get a bundled resource from a skill (Level 3 resources)
   * @param skillName - Skill name
   * @param resourcePath - Relative path to resource (e.g., "scripts/extract.py")
   * @returns Resource content
   */
  getSkillResource(skillName: string, resourcePath: string): string {
    return this.skillLoader.loadSkillResource(skillName, this.skillPaths[0], resourcePath);
  }

  /**
   * Get all skill paths
   * @returns Array of skill paths
   */
  getSkillPaths(): string[] {
    return [...this.skillPaths];
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
   * After injectAuthParameters(), verify no auth-looking placeholders remain unfilled.
   * Only checks HTTP headers (where auth credentials are injected) — not query params or body.
   * Throws AUTH_FAILED with actionable guidance naming the missing env var(s).
   */
  private assertAuthParamsFilled(
    tool: ToolDefinition,
    finalParams: Record<string, unknown>,
    credentials?: Record<string, string>
  ): void {
    const execution = tool.execution;
    if (!('headers' in execution) || !execution.headers) return;

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
    const placeholderRegex = /\{([^}]+)\}/g;
    const missing: string[] = [];

    // Only inspect headers — auth credentials belong there, not in query_params or body
    for (const [headerName, headerValue] of Object.entries(execution.headers)) {
      if (typeof headerValue !== 'string') continue;
      // Only check headers that look auth-related (Authorization, X-API-Key, etc.)
      const lowerHeader = headerName.toLowerCase();
      const isAuthHeader =
        lowerHeader === 'authorization' ||
        lowerHeader.includes('auth') ||
        lowerHeader.includes('token') ||
        lowerHeader.includes('key') ||
        lowerHeader.includes('secret');
      if (!isAuthHeader) continue;

      let match: RegExpExecArray | null;
      placeholderRegex.lastIndex = 0;
      while ((match = placeholderRegex.exec(headerValue)) !== null) {
        const paramName = match[1];
        if (paramName in finalParams) continue;
        const lowerName = paramName.toLowerCase();
        if (authPatterns.some((p) => lowerName.includes(p))) {
          missing.push(paramName);
        }
      }
    }

    if (missing.length === 0) return;

    const hints = missing
      .map((n) => `  • ${n}  →  MATIMO_${n} (or pass via credentials option)`)
      .join('\n');
    const credentialsHint = credentials ? '' : '  (No per-call credentials were supplied.)';

    throw new MatimoError(
      `Authentication credentials are missing for tool "${tool.name}".\n${hints}\n${credentialsHint}`.trim(),
      ErrorCode.AUTH_FAILED,
      { toolName: tool.name, missingCredentials: missing }
    );
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

  /**
   * Emit an audit event to the registered handler.
   */
  #emitEvent(event: MatimoEvent): void {
    if (this.#onEvent) {
      try {
        this.#onEvent(event);
      } catch {
        // Never let event handler errors break SDK execution
      }
    }
  }

  /**
   * Hot-reload tools from all configured paths.
   * Re-validates untrusted tools via content validator and integrity tracker.
   * Tools that fail validation are rejected and not loaded.
   *
   * Atomic: if loading fails mid-way (e.g. I/O error), the registry is restored
   * to its previous state and `rolledBack: true` is included in the result.
   */
  async reloadTools(): Promise<ReloadResult> {
    const previousNames = new Set(this.registry.getAll().map((t) => t.name));
    // Snapshot the previous registry state for rollback on partial failure
    const snapshot = this.registry.getAll();

    this.registry.clear();

    const result: ReloadResult = {
      loaded: 0,
      removed: 0,
      revalidated: 0,
      rejected: [],
      rolledBack: false,
    };

    let allTools: Map<string, ToolDefinition>;
    try {
      allTools = this.loader.loadToolsFromMultiplePaths(this.toolPaths);
    } catch (err) {
      // I/O failure during load — restore snapshot and signal rollback
      this.registry.registerAll(snapshot);
      result.rolledBack = true;
      this.logger.error('reloadTools: failed to load tools, rolled back to previous state', {
        error: (err as Error).message,
      });
      return result;
    }

    const untrustedSet = new Set(this.#untrustedPaths);

    for (const [, tool] of allTools) {
      const defPath = tool._definitionPath ?? '';
      const isUntrusted =
        untrustedSet.size > 0 && this.#untrustedPaths.some((up) => defPath.startsWith(up));

      if (isUntrusted && this.#policy) {
        // Run policy validation on untrusted tools
        const policyDecision = this.#policy.canCreate({}, tool);
        if (policyDecision.allowed === false) {
          result.rejected.push(tool.name);
          this.#emitEvent({
            type: 'tool:rejected',
            toolName: tool.name,
            violations: [
              { rule: 'policy-denied', severity: 'high', message: policyDecision.reason },
            ],
            timestamp: new Date().toISOString(),
          });
          this.logger.warn(`Tool rejected during reload: ${tool.name}`, {
            reason: policyDecision.reason,
          });
          continue;
        }
        if (policyDecision.allowed === 'pending_approval') {
          // Quarantine: mark as pending in the approval manifest
          if (this.#approvalManifest) {
            this.#approvalManifest.markPending(tool.name);
          }
          this.#emitEvent({
            type: 'tool:quarantined',
            toolName: tool.name,
            riskLevel: policyDecision.riskLevel,
            reason: policyDecision.reason,
            timestamp: new Date().toISOString(),
          });
          this.logger.info(`Tool quarantined during reload: ${tool.name}`, {
            riskLevel: policyDecision.riskLevel,
            reason: policyDecision.reason,
          });
          // Still register the tool so it exists, but it will be blocked
          // at execution time until approved via the approval manifest
          result.revalidated++;
        } else {
          result.revalidated++;
        }
      }

      this.registry.register(tool);
      const source = isUntrusted ? 'untrusted' : 'trusted';
      this.#integrityTracker.record(tool.name, JSON.stringify(tool), source);
      result.loaded++;
    }

    // Calculate removed tools
    const currentNames = new Set(this.registry.getAll().map((t) => t.name));
    for (const name of previousNames) {
      if (!currentNames.has(name)) {
        result.removed++;
        this.#integrityTracker.removeEntry(name);
      }
    }

    this.#emitEvent({
      type: 'tools:reloaded',
      loaded: result.loaded,
      removed: result.removed,
      rejected: result.rejected,
      timestamp: new Date().toISOString(),
    });

    this.logger.info('Tools reloaded', {
      loaded: result.loaded,
      removed: result.removed,
      revalidated: result.revalidated,
      rejected: result.rejected.length,
    });

    return result;
  }

  /**
   * Check if a policy engine is active.
   */
  hasPolicy(): boolean {
    return this.#policy !== null;
  }

  /**
   * Get the approval manifest (if policy engine is active).
   */
  getApprovalManifest(): ApprovalManifest | null {
    return this.#approvalManifest;
  }

  /**
   * Get the integrity tracker.
   */
  getIntegrityTracker(): ToolIntegrityTracker {
    return this.#integrityTracker;
  }

  /**
   * Get the tool registry (for advanced use cases).
   */
  getRegistry(): ToolRegistry {
    return this.registry;
  }

  /**
   * Set a Human-in-the-Loop callback for quarantined tools.
   * The callback is invoked when a tool with `pending_approval` status is executed.
   * Return `true` to approve, `false` to reject.
   */
  setHITLCallback(callback: HITLCallback | null): void {
    this.#hitlCallback = callback;
  }

  /**
   * Hot-reload the policy engine at runtime.
   *
   * - If `configOrFile` is a `PolicyConfig` object, creates a new `DefaultPolicyEngine`.
   * - If `configOrFile` is a string, re-reads and parses the YAML file.
   * - If omitted and the instance was initialized with `policyFile`, re-reads that file.
   *
   * The new policy is validated before swap — if validation fails, the old policy remains active.
   * After swap, all tools are re-validated against the new policy via `reloadTools()`.
   *
   * @returns The ReloadResult from the subsequent tool re-validation.
   */
  async reloadPolicy(configOrFile?: PolicyConfig | string): Promise<ReloadResult> {
    let newPolicy: PolicyEngine;

    if (typeof configOrFile === 'string') {
      // Re-read from file path
      newPolicy = loadPolicyFromFile(configOrFile);
      this.#policyFile = configOrFile;
    } else if (configOrFile) {
      // Build from inline config
      newPolicy = new DefaultPolicyEngine(configOrFile);
    } else if (this.#policyFile) {
      // Re-read the original policy file
      newPolicy = loadPolicyFromFile(this.#policyFile);
    } else if (this.#policy && 'updateConfig' in this.#policy) {
      // No config provided and no file — nothing to reload
      this.logger.warn('reloadPolicy: no config or file provided, nothing to reload');
      return {
        loaded: 0,
        removed: 0,
        revalidated: 0,
        rejected: [],
      };
    } else {
      this.logger.warn('reloadPolicy: no policy engine to reload');
      return {
        loaded: 0,
        removed: 0,
        revalidated: 0,
        rejected: [],
      };
    }

    // Atomic swap: replace the policy engine reference
    this.#policy = newPolicy;
    Object.freeze(this.#policy);

    this.#emitEvent({
      type: 'policy:reloaded',
      timestamp: new Date().toISOString(),
    });

    this.logger.info('Policy engine reloaded');

    // Re-validate all tools against the new policy
    return this.reloadTools();
  }

  /**
   * Resolve a quarantined tool via HITL callback or approval manifest.
   *
   * Resolution order:
   * 1. Check approval manifest — if already approved, allow.
   * 2. Invoke HITL callback — if set, ask the human.
   * 3. If no callback, reject by default (safe fail-closed).
   */
  async #resolveHITL(
    tool: ToolDefinition,
    decision: {
      allowed: 'pending_approval';
      reason: string;
      riskLevel: import('./policy/types').RiskLevel;
      toolName?: string;
    },
    context: PolicyContext
  ): Promise<boolean> {
    // 1. Check approval manifest — previously approved tools pass through
    if (this.#approvalManifest) {
      const yamlHash = this.#integrityTracker.getHash(tool.name);
      if (yamlHash && this.#approvalManifest.isApproved(tool.name, yamlHash)) {
        return true;
      }
    }

    // 2. Invoke HITL callback
    if (this.#hitlCallback) {
      this.#emitEvent({
        type: 'tool:quarantined',
        toolName: tool.name,
        riskLevel: decision.riskLevel,
        reason: decision.reason,
        environment: context.environment,
        timestamp: new Date().toISOString(),
      });

      const approved = await this.#hitlCallback({
        toolName: tool.name,
        riskLevel: decision.riskLevel,
        reason: decision.reason,
        environment: context.environment,
        agentId: context.agentId,
        toolDefinition: tool,
      });

      // If approved, record in manifest for future calls
      if (approved && this.#approvalManifest) {
        const yamlHash =
          this.#integrityTracker.getHash(tool.name) ??
          this.#approvalManifest.computeHash(JSON.stringify(tool));
        this.#approvalManifest.approve(tool.name, yamlHash);
      }

      return approved;
    }

    // 3. No callback — fail closed
    return false;
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
