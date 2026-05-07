import * as fs from 'fs';
import * as path from 'path';
import { MatimoError, ErrorCode } from '../errors/matimo-error.js';

/**
 * Approval request for any tool operation
 */
export interface ApprovalRequest {
  toolName: string;
  description?: string;
  params: Record<string, unknown>;
}

/**
 * Generic approval callback - simple and scalable
 * Returns true if approved, false if rejected or user declines
 */
export type ApprovalCallback = (request: ApprovalRequest) => Promise<boolean>;

/**
 * Generic, simple approval handler for all tools
 *
 * Design: Single, scalable approval flow for any number of tools
 * - Tools declare requires_approval in YAML OR contain destructive keywords
 * - Check MATIMO_AUTO_APPROVE env var (approve all)
 * - Check MATIMO_APPROVED_PATTERNS env var (pre-approved patterns)
 * - If not pre-approved, invoke single generic callback
 * - No per-provider validators or custom logic needed
 */
export class ApprovalHandler {
  private autoApprove: boolean = false;
  private approvedPatterns: Set<string> = new Set();
  private approvalCallback: ApprovalCallback | null = null;
  private destructiveKeywords: string[] = [];

  constructor() {
    // Load destructive keywords from YAML configuration
    this.loadDestructiveKeywords();

    // Load from environment variables
    this.autoApprove = process.env.MATIMO_AUTO_APPROVE === 'true';

    // Load pre-approved patterns (comma-separated)
    // Example: "tool-name,pattern-*,prefix-*"
    const approvedEnv = process.env.MATIMO_APPROVED_PATTERNS || '';
    if (approvedEnv) {
      approvedEnv.split(',').forEach((pattern) => {
        const trimmed = pattern.trim();
        if (trimmed) {
          this.approvedPatterns.add(trimmed);
        }
      });
    }
  }

  /**
   * Load destructive keywords from YAML configuration file
   * Searches for destructive-keywords.yaml in:
   * 1. packages/core/ (development/workspace)
   * 2. node_modules/@matimo/core/ (installed package)
   * 3. Relative to current working directory
   */
  private loadDestructiveKeywords(): void {
    try {
      // Possible locations for destructive-keywords.yaml
      const possiblePaths = [
        path.join(process.cwd(), 'packages/core/destructive-keywords.yaml'), // workspace root
        path.join(process.cwd(), 'node_modules/@matimo/core/destructive-keywords.yaml'), // installed
        path.join(process.cwd(), 'destructive-keywords.yaml'), // current directory
      ];

      let configContent: string | null = null;

      for (const filePath of possiblePaths) {
        try {
          if (fs.existsSync(filePath)) {
            configContent = fs.readFileSync(filePath, 'utf8');
            break;
          }
        } catch {
          // Continue to next path
        }
      }

      // If file not found, use fallback keywords defined below
      if (!configContent) {
        this.useDefaultKeywords();
        return;
      }

      // Simple YAML parsing for flat structure
      // Parse lines and extract keywords from each section
      const lines = configContent.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        // Skip comments and empty lines and section headers
        if (trimmed && !trimmed.startsWith('#') && !trimmed.endsWith(':')) {
          // Extract keyword (remove leading dash and whitespace)
          const keyword = trimmed.replace(/^-\s*/, '').trim();
          if (keyword) {
            this.destructiveKeywords.push(keyword);
          }
        }
      }

      // Fallback: If no keywords loaded, use defaults
      if (this.destructiveKeywords.length === 0) {
        this.useDefaultKeywords();
      }
    } catch {
      // Fallback to hardcoded keywords if file parsing fails
      this.useDefaultKeywords();
    }
  }

  /**
   * Set default destructive keywords
   */
  private useDefaultKeywords(): void {
    this.destructiveKeywords = [
      'CREATE',
      'DELETE',
      'DROP',
      'ALTER',
      'TRUNCATE',
      'UPDATE',
      'INSERT',
      'UPSERT',
      'REPLACE',
      'MERGE',
      'GRANT',
      'REVOKE',
      'EDIT',
      'WRITE',
      'APPEND',
      'REMOVE',
      'RENAME',
      'SHUTDOWN',
      'EXECUTE',
      'EXEC',
    ];
  }

  /**
   * Set approval callback for interactive/custom approval
   */
  setApprovalCallback(callback: ApprovalCallback | null): void {
    this.approvalCallback = callback;
  }

  /**
   * Get the current approval callback (for save/restore patterns)
   */
  getApprovalCallback(): ApprovalCallback | null {
    return this.approvalCallback;
  }

  /**
   * Check if a tool requires approval based on YAML definition or supplied content.
   * @param requiresApproval In Yaml - From tool definition `requires_approval` field
   * @param content - Optional content (SQL, shell command, etc.) to check for destructive keywords
   *
   * Notes:
   * -  We now accept any textual content so keyword detection also applies to command/shell and sql
   *   based tools (e.g. `params.command`).
   */
  requiresApproval(requiresApprovalInYaml: boolean | undefined, content?: string): boolean {
    // Explicit YAML definition takes precedence
    if (requiresApprovalInYaml === true) {
      return true;
    }

    // Check provided content (SQL, shell command, etc.) for destructive keywords
    if (content) {
      const upper = String(content).toUpperCase();
      return this.destructiveKeywords.some((keyword) => upper.includes(keyword));
    }

    return false;
  }

  /**
   * Check if operation is pre-approved via env vars
   */
  isPreApproved(toolName: string): boolean {
    // Auto-approve everything
    if (this.autoApprove) {
      return true;
    }

    // Check against patterns
    for (const pattern of this.approvedPatterns) {
      if (this.matchesPattern(toolName, pattern)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Request approval for an operation
   * Throws if not approved and no callback available
   */
  async requestApproval(request: ApprovalRequest): Promise<void> {
    // If no callback set, fail safely
    if (!this.approvalCallback) {
      throw new MatimoError(
        `Destructive operation requires approval: ${request.toolName}`,
        ErrorCode.EXECUTION_FAILED,
        {
          toolName: request.toolName,
          hint: 'Set MATIMO_AUTO_APPROVE=true or MATIMO_APPROVED_PATTERNS or install approval callback',
        }
      );
    }

    // Call callback to get approval
    const approved = await this.approvalCallback(request);
    if (!approved) {
      throw new MatimoError(
        `Operation rejected by approval handler: ${request.toolName}`,
        ErrorCode.EXECUTION_FAILED,
        {
          toolName: request.toolName,
          message: 'User or policy rejected the operation',
        }
      );
    }
  }

  /**
   * Simple pattern matching (supports wildcards)
   */
  private matchesPattern(toolName: string, pattern: string): boolean {
    if (pattern === '*') {
      return true;
    }

    // Convert glob pattern to regex:
    // 1. Escape all regex metacharacters, including backslashes.
    // 2. Turn escaped '*' back into a wildcard '.*'.
    const escapedPattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regexPattern = escapedPattern.replace(/\\\*/g, '.*');
    const regex = new RegExp(`^${regexPattern}$`, 'i');
    return regex.test(toolName);
  }
}

// Global instance
let globalApprovalHandler: ApprovalHandler | null = null;

/**
 * Get or create global approval handler
 */
export function getGlobalApprovalHandler(): ApprovalHandler {
  if (!globalApprovalHandler) {
    globalApprovalHandler = new ApprovalHandler();
  }
  return globalApprovalHandler;
}
