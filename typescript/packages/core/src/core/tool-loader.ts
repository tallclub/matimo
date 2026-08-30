import * as fs from 'fs';
import * as path from 'path';
import * as YAML from 'js-yaml';
import { ToolDefinition, validateToolDefinition } from './schema.js';
import { MatimoError, ErrorCode } from '../errors/matimo-error.js';
import { getGlobalMatimoLogger } from '../logging/index.js';

/**
 * Tool Loader - Loads and validates YAML/JSON tool definitions
 * Implements TDD pattern: test failures guide implementation
 * Features caching for efficient discovery with thousands of tools
 */

export class ToolLoader {
  private logger = getGlobalMatimoLogger();

  /**
   * Static cache for discovered paths - populated on first autoDiscover call
   * Subsequent calls return cached result (O(1) instead of O(n))
   */
  private static discoveredPathsCache: string[] | null = null;
  /**
   * Discover packages using only fs and path (no createRequire needed)
   * Searches for tools in node_modules/@matimo/* and workspace packages.
   * Tries process.cwd() first, then falls back to __dirname-based discovery
   * (critical for Claude Desktop where cwd may be '/' on macOS).
   */
  private getNodeModulesPath(): string | null {
    try {
      // Strategy 1: Walk up from process.cwd()
      let currentPath = process.cwd();
      for (let i = 0; i < 15; i++) {
        const nodeModules = path.join(currentPath, 'node_modules');
        if (fs.existsSync(nodeModules)) {
          const matimoScope = path.join(nodeModules, '@matimo');
          if (fs.existsSync(matimoScope)) {
            return nodeModules;
          }
        }
        currentPath = path.dirname(currentPath);
      }

      // Strategy 2: Walk up from this file's location (__dirname)
      // When this code is in node_modules/@matimo/core/dist/core/tool-loader.js,
      // walking up will find the node_modules directory directly.
      // When in monorepo at packages/core/src/core/, it will find root node_modules.
      currentPath = __dirname;
      for (let i = 0; i < 10; i++) {
        const nodeModules = path.join(currentPath, 'node_modules');
        if (fs.existsSync(nodeModules)) {
          const matimoScope = path.join(nodeModules, '@matimo');
          if (fs.existsSync(matimoScope)) {
            return nodeModules;
          }
        }
        currentPath = path.dirname(currentPath);
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Load a single tool from a YAML or JSON file
   * @param filePath - Path to tool definition file
   * @returns Validated tool definition
   * @throws {Error} If file not found or invalid schema
   */
  loadToolFromFile(filePath: string): ToolDefinition {
    // Read file
    if (!fs.existsSync(filePath)) {
      throw new MatimoError(`Tool file not found: ${filePath}`, ErrorCode.FILE_NOT_FOUND, {
        filePath,
      });
    }

    const content = fs.readFileSync(filePath, 'utf-8');

    // Parse based on file extension
    let parsed: unknown;
    const ext = path.extname(filePath).toLowerCase();

    if (ext === '.yaml' || ext === '.yml') {
      parsed = YAML.load(content);
    } else if (ext === '.json') {
      parsed = JSON.parse(content);
    } else {
      throw new MatimoError(
        `Unsupported file format: ${ext}. Use .yaml or .json`,
        ErrorCode.INVALID_SCHEMA,
        {
          filePath,
          fileExtension: ext,
        }
      );
    }

    // Validate against schema
    try {
      const tool = validateToolDefinition(parsed);
      // Store the definition file path for relative path resolution in executors
      tool._definitionPath = path.resolve(filePath);
      return tool;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new MatimoError(
        `Invalid tool definition in ${filePath}:\n${message}`,
        ErrorCode.INVALID_SCHEMA,
        {
          filePath,
          originalError: message,
        }
      );
    }
  }

  /**
   * Load all tools from a directory
   * @param dirPath - Path to directory containing tool files
   * @returns Map of tool names to definitions
   * @note Prefers definition.yaml/definition.json over tool.yaml/tool.json
   */
  loadToolsFromDirectory(dirPath: string): Map<string, ToolDefinition> {
    const tools = new Map<string, ToolDefinition>();

    if (!fs.existsSync(dirPath)) {
      throw new MatimoError(`Tools directory not found: ${dirPath}`, ErrorCode.FILE_NOT_FOUND, {
        directoryPath: dirPath,
      });
    }

    // Recursively find all definition files (definition.yaml/definition.json preferred)
    // Also finds tool.yaml/tool.json for backwards compatibility
    const findToolFiles = (dir: string): string[] => {
      const files: string[] = [];
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          files.push(...findToolFiles(fullPath));
        } else if (
          entry.isFile() &&
          (/^definition\.(yaml|yml|json)$/.test(entry.name) ||
            /^tool\.(yaml|yml|json)$/.test(entry.name))
        ) {
          files.push(fullPath);
        }
      }

      return files;
    };

    const toolFiles = findToolFiles(dirPath);

    for (const file of toolFiles) {
      try {
        const tool = this.loadToolFromFile(file);
        // Don't add if we already have this tool (definition.yaml takes precedence)
        if (!tools.has(tool.name)) {
          tools.set(tool.name, tool);
        }
      } catch (error) {
        // Skip files that fail validation - they may not be tool definitions
        // (e.g., provider definitions are in tools/ directory but are not tools)
        this.logger.debug('ToolLoader: skipped file that failed validation', {
          file,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return tools;
  }

  /**
   * Load a tool from a JSON object
   * @param data - Tool definition as object
   * @returns Validated tool definition
   */
  loadToolFromObject(data: unknown): ToolDefinition {
    return validateToolDefinition(data);
  }

  /**
   * Auto-discover tool packages in node_modules/@matimo/* and core tools
   * Features efficient caching: first call discovers, subsequent calls return cached result
   * @returns Array of paths to tool directories
   */
  autoDiscoverPackages(): string[] {
    // Return cached paths if already discovered (O(1) lookup)
    if (ToolLoader.discoveredPathsCache !== null) {
      return ToolLoader.discoveredPathsCache;
    }

    const discoveredPaths: string[] = [];

    // 1. Discover core tools from workspace (packages/core/tools) or @matimo/core in node_modules
    try {
      // Try node_modules first (@matimo/core)
      const nodeModulesPath = this.getNodeModulesPath();
      if (nodeModulesPath) {
        const coreToolsPath = path.join(nodeModulesPath, '@matimo', 'core', 'tools');
        if (fs.existsSync(coreToolsPath)) {
          discoveredPaths.push(coreToolsPath);
        }
      }

      // If not found in node_modules, try workspace (from cwd and __dirname)
      if (discoveredPaths.length === 0) {
        const searchRoots = [process.cwd(), __dirname];
        let found = false;
        for (const root of searchRoots) {
          if (found) break;
          let currentPath = root;
          for (let i = 0; i < 20; i++) {
            const coreToolsPath = path.join(currentPath, 'packages', 'core', 'tools');
            if (fs.existsSync(coreToolsPath)) {
              discoveredPaths.push(coreToolsPath);
              found = true;
              break;
            }
            currentPath = path.dirname(currentPath);
          }
        }
      }
    } catch (error) {
      // Continue if core tools discovery fails
      this.logger.warn('ToolLoader: core tools discovery failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // 2. Discover @matimo/* packages from node_modules (installed providers like slack, gmail)
    try {
      const nodeModulesPath = this.getNodeModulesPath();

      if (nodeModulesPath && fs.existsSync(nodeModulesPath)) {
        const matimoScopePath = path.join(nodeModulesPath, '@matimo');

        if (fs.existsSync(matimoScopePath)) {
          // Scan @matimo/* directories for tools/
          const entries = fs.readdirSync(matimoScopePath, { withFileTypes: true });

          for (const entry of entries) {
            // Skip core if already discovered
            if (entry.name === 'core') {
              continue;
            }

            // Handle both real directories and symlinks
            let isDir = entry.isDirectory();
            if (!isDir && !entry.name.startsWith('.')) {
              try {
                // Use statSync to follow symlinks
                isDir = fs.statSync(path.join(matimoScopePath, entry.name)).isDirectory();
              } catch {
                continue;
              }
            }

            if (isDir && !entry.name.startsWith('.')) {
              const toolsPath = path.join(matimoScopePath, entry.name, 'tools');
              if (fs.existsSync(toolsPath)) {
                discoveredPaths.push(toolsPath);
              }
            }
          }
        }
      }
    } catch (error) {
      // Continue even if @matimo discovery fails
      this.logger.warn('ToolLoader: @matimo package discovery failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Cache the results for future calls - this makes subsequent autoDiscoverPackages() calls O(1)
    ToolLoader.discoveredPathsCache = discoveredPaths;

    return discoveredPaths;
  }

  /**
   * Clear the discovery cache (useful for testing or dynamic tool loading scenarios)
   * @internal Used for testing only
   */
  static clearDiscoveryCache(): void {
    ToolLoader.discoveredPathsCache = null;
  }

  /**
   * Load tools from multiple directories
   * @param dirPaths - Array of directory paths
   * @returns Combined map of all tools
   */
  loadToolsFromMultiplePaths(dirPaths: string[]): Map<string, ToolDefinition> {
    const allTools = new Map<string, ToolDefinition>();

    for (const dirPath of dirPaths) {
      try {
        const tools = this.loadToolsFromDirectory(dirPath);
        for (const [name, definition] of tools) {
          // Later paths can override earlier ones
          allTools.set(name, definition);
        }
      } catch {
        // Continue with other paths even if one fails
        // This allows optional tool packages
      }
    }

    return allTools;
  }
}

export default ToolLoader;
