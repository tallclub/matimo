/**
 * Default Policy Engine for Matimo.
 *
 * Conservative defaults that protect against malicious agent-created tools.
 * Frozen at boot time — agents cannot modify policy at runtime.
 */

import type { ToolDefinition } from '../core/schema';
import type { PolicyEngine, PolicyContext, PolicyDecision, PolicyConfig } from './types';
import { validateToolContent } from './content-validator';
import { classifyRisk } from './risk-classifier';

const DEFAULT_CONFIG: Required<PolicyConfig> = {
  allowedDomains: [],
  allowedCredentials: [],
  allowedHttpMethods: ['GET', 'POST'],
  allowCommandTools: false,
  allowFunctionTools: false,
  protectedNamespaces: ['matimo_'],
};

export class DefaultPolicyEngine implements PolicyEngine {
  private readonly config: Required<PolicyConfig>;

  constructor(config?: PolicyConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Check whether a tool definition may be created/proposed.
   * Runs ContentValidator rules against the definition.
   */
  canCreate(context: PolicyContext, toolDef: ToolDefinition): PolicyDecision {
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
    }

    // In production, block anything above low risk
    const risk = classifyRisk(toolDef);
    if (context.environment === 'prod' && risk !== 'low') {
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
}
