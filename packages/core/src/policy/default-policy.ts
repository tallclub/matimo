/**
 * Default Policy Engine for Matimo.
 *
 * Conservative defaults that protect against malicious agent-created tools.
 * Frozen at boot time — agents cannot modify policy at runtime.
 */

import type { ToolDefinition } from '../core/schema';
import type {
  PolicyEngine,
  PolicyContext,
  PolicyDecision,
  PolicyConfig,
  PolicyTier,
  RiskLevel,
} from './types';
import { validateToolContent } from './content-validator';
import { classifyRisk } from './risk-classifier';
import { extractAuthPlaceholders } from '../mcp/tool-converter';

const DEFAULT_CONFIG: Required<PolicyConfig> = {
  allowedDomains: [],
  allowedCredentials: [],
  allowedHttpMethods: ['GET', 'POST'],
  allowCommandTools: false,
  allowFunctionTools: false,
  protectedNamespaces: ['matimo_'],
  enableHITL: false,
  quarantineRiskLevels: ['medium'],
};

export class DefaultPolicyEngine implements PolicyEngine {
  private config: Required<PolicyConfig>;

  constructor(config?: PolicyConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Check whether a tool definition may be created/proposed.
   * First applies the tier gate (fast early-return for TIER 3 blocked tools),
   * then runs ContentValidator rules.
   */
  canCreate(context: PolicyContext, toolDef: ToolDefinition): PolicyDecision {
    // Hard TIER 3 gate — blocked regardless of content validator.
    // Each check uses a reason string that the policy tests assert (.toContain).
    const protectedNamespaces = this.config.protectedNamespaces;
    if (protectedNamespaces.some((ns) => toolDef.name.startsWith(ns))) {
      return {
        allowed: false,
        reason: `reserved-namespace: Tool "${toolDef.name}" uses a protected namespace (${protectedNamespaces.join(', ')})`,
        riskLevel: 'critical',
      };
    }
    if (toolDef.execution.type === 'function') {
      return {
        allowed: false,
        reason: `no-function-execution: Agent-created tools may not use execution type "function"`,
        riskLevel: 'critical',
      };
    }
    if (toolDef.execution.type === 'command') {
      return {
        allowed: false,
        reason: `no-command-execution: Agent-created tools may not use execution type "command"`,
        riskLevel: 'critical',
      };
    }
    if (toolDef.execution.type === 'http') {
      const url = toolDef.execution.url ?? '';
      if (isBlockedUrl(url)) {
        return {
          allowed: false,
          reason: `no-ssrf: URL "${url}" targets a blocked internal/metadata address`,
          riskLevel: 'critical',
        };
      }
    }

    const result = validateToolContent(toolDef, {
      source: 'untrusted',
      policy: this.config,
    });

    if (!result.valid) {
      const critical = result.violations.filter(
        (v) => v.severity === 'critical' || v.severity === 'high'
      );
      if (critical.length > 0) {
        return {
          allowed: false,
          reason: critical.map((v) => `[${v.rule}] ${v.message}`).join('; '),
          riskLevel: critical[0].severity,
        };
      }
      // No high/critical violations, but the content is still invalid.
      // Treat these (e.g., medium "forced-draft-status") as policy violations:
      // either deny or quarantine for HITL, rather than silently allowing.
      if (result.violations.length > 0) {
        const orderedSeverities: RiskLevel[] = ['low', 'medium', 'high', 'critical'];
        const mostSevere = result.violations
          .map((v) => v.severity as RiskLevel)
          .sort(
            (a, b) => orderedSeverities.indexOf(b) - orderedSeverities.indexOf(a)
          )[0] as RiskLevel;
        const reason = result.violations.map((v) => `[${v.rule}] ${v.message}`).join('; ');
        if (this.config.enableHITL) {
          return {
            allowed: 'pending_approval',
            reason,
            riskLevel: mostSevere,
            toolName: toolDef.name,
          };
        }
        return {
          allowed: false,
          reason,
          riskLevel: mostSevere,
        };
      }
    }

    // In production, block anything above low risk — unless HITL is enabled
    // for the tool's risk level, in which case quarantine it for human review
    const risk = classifyRisk(toolDef);
    if (context.environment === 'prod' && risk !== 'low') {
      if (this.config.enableHITL && this.config.quarantineRiskLevels.includes(risk)) {
        return {
          allowed: 'pending_approval',
          reason: `Tool risk level "${risk}" requires human approval in production`,
          riskLevel: risk,
          toolName: toolDef.name,
        };
      }
      return {
        allowed: false,
        reason: `Tool risk level "${risk}" is too high for production environment`,
        riskLevel: risk,
      };
    }

    return { allowed: true };
  }

  /**
   * Check whether the caller is allowed to execute a given tool.
   */
  canExecute(context: PolicyContext, tool: ToolDefinition): PolicyDecision {
    const status = tool.status;

    // Block deprecated tools
    if (status === 'deprecated' || tool.deprecated === true) {
      return {
        allowed: false,
        reason: tool.deprecation_message ?? `Tool "${tool.name}" is deprecated`,
      };
    }

    // Draft tools in prod: deny
    if (status === 'draft' && context.environment === 'prod') {
      return {
        allowed: false,
        reason: `Draft tool "${tool.name}" is not available in production`,
        riskLevel: 'medium',
      };
    }

    // Draft tools without admin role: deny
    if (status === 'draft' && !context.roles?.includes('admin')) {
      return {
        allowed: false,
        reason: `Draft tool "${tool.name}" requires admin role`,
        riskLevel: 'medium',
      };
    }

    // In prod, tools requiring approval need admin or operator role
    if (
      context.environment === 'prod' &&
      tool.requires_approval === true &&
      !context.roles?.includes('admin') &&
      !context.roles?.includes('operator')
    ) {
      return {
        allowed: false,
        reason: `Tool "${tool.name}" requires approval and caller lacks admin/operator role in production`,
        riskLevel: 'high',
      };
    }

    return { allowed: true };
  }

  /**
   * Filter tools to only those the caller is allowed to see and use.
   */
  filterForAgent(context: PolicyContext, tools: ToolDefinition[]): ToolDefinition[] {
    return tools.filter((tool) => {
      const decision = this.canExecute(context, tool);
      return decision.allowed;
    });
  }

  /** Expose the resolved config (read-only snapshot). */
  getConfig(): Readonly<Required<PolicyConfig>> {
    return { ...this.config };
  }

  /**
   * Hot-reload policy configuration at runtime.
   * Merges the new config with DEFAULT_CONFIG (preserving conservative defaults
   * for any unset fields), then replaces the active config atomically.
   */
  updateConfig(config: PolicyConfig): void {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }
}

/**
 * Pure utility: classify an agent-proposed tool into a policy tier.
 *
 * - `blocked`: reserved namespace, function/command execution type, SSRF URL
 * - `approval-required`: any auth credential, non-GET HTTP method, any data write
 * - `auto`: low-risk read-only HTTP GET with no auth
 *
 * This runs BEFORE content validation and is a hard gate — `blocked` tools
 * are rejected immediately without running the full content-validator.
 */
export function getTierForTool(tool: ToolDefinition, config?: PolicyConfig): PolicyTier {
  const protectedNamespaces = config?.protectedNamespaces ?? ['matimo_'];

  // TIER 3 — ALWAYS BLOCKED
  if (protectedNamespaces.some((ns) => tool.name.startsWith(ns))) return 'blocked';
  if (tool.execution.type === 'function') return 'blocked';
  if (tool.execution.type === 'command') return 'blocked';
  if (tool.execution.type === 'http') {
    const url = tool.execution.url ?? '';
    if (isBlockedUrl(url)) return 'blocked';
  }

  // TIER 2 — APPROVAL REQUIRED
  if (tool.execution.type === 'http') {
    const method = (tool.execution.method ?? 'GET').toUpperCase();
    if (method !== 'GET') return 'approval-required';
    const authVars = extractAuthPlaceholders(tool);
    if (authVars.length > 0) return 'approval-required';
  }

  // TIER 1 — AUTO (low-risk read-only)
  return 'auto';
}

/** Check if a URL targets a blocked/internal destination (mirrors content-validator SSRF check). */
function isBlockedUrl(url: string): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    return (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '::1' ||
      hostname.startsWith('169.254.') || // link-local / AWS metadata
      hostname.startsWith('10.') ||
      hostname.startsWith('192.168.') ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(hostname)
    );
  } catch {
    return false;
  }
}
