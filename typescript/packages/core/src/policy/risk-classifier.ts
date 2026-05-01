/**
 * Risk Classifier for Matimo tools.
 *
 * Pure function that classifies a tool's risk level based on its execution
 * type, HTTP method, and approval requirements. No schema changes needed.
 */

import type { ToolDefinition } from '../core/schema';
import type { RiskLevel } from './types';

/**
 * Classify the risk level of a tool based on its definition.
 *
 * - critical: arbitrary code execution (type: function)
 * - high: shell execution (type: command), HTTP DELETE, or explicit requires_approval
 * - medium: HTTP POST/PUT/PATCH (write operations)
 * - low: HTTP GET, read-only tools
 */
export function classifyRisk(tool: ToolDefinition): RiskLevel {
  // Explicit override declared in the tool YAML takes precedence
  if (tool.risk) {
    return tool.risk as RiskLevel;
  }

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
