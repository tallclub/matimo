import { ToolDefinition } from './schema';
import { MatimoError, ErrorCode } from '../errors/matimo-error';

/**
 * Tool Registry - In-memory store for loaded tools
 * Enables tool discovery and management
 */

export class ToolRegistry {
  private tools: Map<string, ToolDefinition> = new Map();
  private toolsByTag: Map<string, Set<string>> = new Map();

  /**
   * Register a tool in the registry
   * @param tool - Tool definition to register
   */
  register(tool: ToolDefinition): void {
    if (this.tools.has(tool.name)) {
      throw new MatimoError(`Tool '${tool.name}' is already registered`, ErrorCode.TOOL_NOT_FOUND, {
        toolName: tool.name,
        reason: 'duplicate_registration',
      });
    }

    this.tools.set(tool.name, tool);

    // Index by tags for discovery
    if (tool.tags && tool.tags.length > 0) {
      for (const tag of tool.tags) {
        if (!this.toolsByTag.has(tag)) {
          this.toolsByTag.set(tag, new Set());
        }
        this.toolsByTag.get(tag)!.add(tool.name);
      }
    }
  }

  /**
   * Register multiple tools
   */
  registerAll(tools: ToolDefinition[]): void {
    for (const tool of tools) {
      this.register(tool);
    }
  }

  /**
   * Get a tool by name
   */
  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  /**
   * Check if a tool exists
   */
  has(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * Get all tools
   */
  getAll(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  /**
   * Get tools by tag
   */
  getByTag(tag: string): ToolDefinition[] {
    const toolNames = this.toolsByTag.get(tag);
    if (!toolNames) return [];
    return Array.from(toolNames)
      .map((name) => this.tools.get(name))
      .filter((tool): tool is ToolDefinition => tool !== undefined);
  }

  /**
   * Search tools by name (partial match)
   */
  search(query: string): ToolDefinition[] {
    const lowerQuery = query.toLowerCase();
    return this.getAll().filter(
      (tool) =>
        tool.name.toLowerCase().includes(lowerQuery) ||
        tool.description.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Get total count of registered tools
   */
  count(): number {
    return this.tools.size;
  }

  /**
   * Clear all tools
   */
  clear(): void {
    this.tools.clear();
    this.toolsByTag.clear();
  }
}

export default ToolRegistry;
