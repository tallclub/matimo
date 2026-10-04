/**
 * Risk Classifier for Matimo tools.
 *
 * Pure function that classifies a tool's risk level based on its execution
 * type, HTTP method, and approval requirements. No schema changes needed.
 */

import type { ToolDefinition } from '../core/schema.js';
import type { RiskLevel } from './types.js';

const SEVERITY_RANK: Record<RiskLevel, number> = { low: 0, medium: 1, high: 2, critical: 3 };

/**
 * Rank two risk levels and return the more severe one. Used so a tool's
 * self-declared `risk:` can only raise the automatically computed level,
 * never lower it — a `type: function` tool declaring `risk: low` must still
 * classify as `critical`.
 */
export function maxRisk(a: RiskLevel, b: RiskLevel): RiskLevel {
  return SEVERITY_RANK[a] >= SEVERITY_RANK[b] ? a : b;
}

/**
 * Compute risk purely from a tool's execution type, HTTP method, and
 * approval requirement — ignores any self-declared `risk:` field.
 *
 * - critical: arbitrary code execution (type: function)
 * - high: shell execution (type: command), HTTP DELETE, or explicit requires_approval
 * - medium: HTTP POST/PUT/PATCH (write operations)
 * - low: HTTP GET, read-only tools
 */
function classifyAutomaticRisk(tool: ToolDefinition): RiskLevel {
  const exec = tool.execution;

  // Arbitrary code execution is always critical risk
  if (exec.type === 'function') {
    return 'critical';
  }

  // Shell commands are high risk (injection vectors)
  if (exec.type === 'command') {
    return 'high';
  }

  // HTTP tools: risk depends on method
  if (exec.type === 'http') {
    if (tool.requires_approval === true) {
      return 'high';
    }
    const method = exec.method.toUpperCase();
    if (method === 'DELETE') {
      return 'high';
    }
    if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
      return 'medium';
    }
    // GET is low risk
    return 'low';
  }

  // Unknown execution type — treat as high
  return 'high';
}

/**
 * Classify the risk level of a tool based on its definition.
 *
 * A self-declared `risk:` field can only raise the automatically computed
 * risk level, never lower it — a `type: function` tool cannot downgrade
 * itself from `critical` to `low` by declaring `risk: low`.
 */
export function classifyRisk(tool: ToolDefinition): RiskLevel {
  const automaticRisk = classifyAutomaticRisk(tool);
  if (tool.risk) {
    return maxRisk(automaticRisk, tool.risk as RiskLevel);
  }
  return automaticRisk;
}

/**
 * Classify the risk of *running* an already-registered tool.
 *
 * Identical to `classifyRisk` except for `type: function` tools, which
 * `classifyRisk` always rates `critical` because an agent-proposed code tool
 * is the worst case at creation time. Every function tool that reaches the
 * registry is developer-authored (canCreate/canReload reject agent-created
 * function tools unconditionally), so its declared `risk:` describes what the
 * call actually does — `calculator` is low, `execute` is critical. An
 * undeclared function tool is treated as `high`, and `requires_approval`
 * raises it to at least `high`.
 */
export function classifyExecutionRisk(tool: ToolDefinition): RiskLevel {
  if (tool.execution.type !== 'function') {
    return classifyRisk(tool);
  }
  const declared = (tool.risk as RiskLevel | undefined) ?? 'high';
  return tool.requires_approval === true ? maxRisk(declared, 'high') : declared;
}

/** True when `risk` is at or above `threshold` (low < medium < high < critical). */
export function meetsRiskThreshold(risk: RiskLevel, threshold: RiskLevel): boolean {
  return SEVERITY_RANK[risk] >= SEVERITY_RANK[threshold];
}

/** The least severe level in `levels`, or undefined when the list is empty. */
export function lowestRisk(levels: RiskLevel[]): RiskLevel | undefined {
  return levels.reduce<RiskLevel | undefined>(
    (lowest, level) =>
      lowest === undefined || SEVERITY_RANK[level] < SEVERITY_RANK[lowest] ? level : lowest,
    undefined
  );
}
