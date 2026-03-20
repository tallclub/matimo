/**
 * Content Validator for Matimo tools.
 *
 * Deterministic structural rules that detect malicious or unsafe patterns
 * in agent-created tool definitions. No LLM involved.
 */

import type { ToolDefinition } from '../core/schema';
import type { ValidationResult, ValidationContext, Violation } from './types';
import { extractAuthPlaceholders } from '../mcp/tool-converter';

const DEFAULT_ALLOWED_HTTP_METHODS = ['GET', 'POST'];
const DEFAULT_PROTECTED_NAMESPACES = ['matimo_'];

/**
 * Validate a tool definition against content safety rules.
 * Returns all violations found (does not short-circuit).
 */
export function validateToolContent(
  tool: ToolDefinition,
  context: ValidationContext
): ValidationResult {
  const violations: Violation[] = [];
  const config = context.policy ?? {};

  // Only apply restrictive rules to untrusted sources
  if (context.source !== 'untrusted') {
    return { valid: true, violations: [] };
  }

  // Rule 1: Block execution type: function (arbitrary code)
  if (tool.execution.type === 'function') {
    if (!config.allowFunctionTools) {
      violations.push({
        rule: 'no-function-execution',
        severity: 'critical',
        message:
          'Agent-created tools cannot use execution type "function" (arbitrary code execution)',
      });
    }
  }

  // Rule 2: Block execution type: command (shell injection)
  if (tool.execution.type === 'command') {
    if (!config.allowCommandTools) {
      violations.push({
        rule: 'no-command-execution',
        severity: 'critical',
        message: 'Agent-created tools cannot use execution type "command" (shell injection risk)',
      });
    }
  }

  // Rule 3: Block SSRF targets in HTTP URLs
  if (tool.execution.type === 'http') {
    const url = tool.execution.url;
    if (isSSRFTarget(url)) {
      violations.push({
        rule: 'no-ssrf',
        severity: 'critical',
        message: `URL targets internal/metadata network: ${url}`,
      });
    }
  }

  // Rule 4: Block unauthorized credential references
  if (config.allowedCredentials && config.allowedCredentials.length > 0) {
    const referencedVars = extractAuthPlaceholders(tool);
    for (const envVar of referencedVars) {
      if (!config.allowedCredentials.includes(envVar)) {
        violations.push({
          rule: 'unauthorized-credential',
          severity: 'high',
          message: `Tool references credential "${envVar}" not in allowlist`,
        });
      }
    }
  }

  // Rule 5: Block reserved namespaces
  const namespaces = config.protectedNamespaces ?? DEFAULT_PROTECTED_NAMESPACES;
  for (const ns of namespaces) {
    if (tool.name.startsWith(ns)) {
      violations.push({
        rule: 'reserved-namespace',
        severity: 'critical',
        message: `Tool name prefix "${ns}" is reserved for built-in tools`,
      });
    }
  }

  // Rule 6: Force requires_approval on agent-created tools
  if (tool.requires_approval === false || tool.requires_approval === undefined) {
    violations.push({
      rule: 'forced-approval',
      severity: 'high',
      message: 'Agent-created tools must have requires_approval: true',
    });
  }

  // Rule 7: Block disallowed HTTP methods
  if (tool.execution.type === 'http') {
    const allowed = config.allowedHttpMethods ?? DEFAULT_ALLOWED_HTTP_METHODS;
    const method = tool.execution.method.toUpperCase();
    if (!allowed.map((m) => m.toUpperCase()).includes(method)) {
      violations.push({
        rule: 'blocked-http-method',
        severity: 'high',
        message: `HTTP method "${method}" is not in the allowed list: ${allowed.join(', ')}`,
      });
    }
  }

  // Rule 8: Block domains not in allowlist (if configured)
  if (tool.execution.type === 'http' && config.allowedDomains && config.allowedDomains.length > 0) {
    const hostname = extractHostname(tool.execution.url);
    if (
      hostname &&
      !config.allowedDomains.some((d) => hostname === d || hostname.endsWith(`.${d}`))
    ) {
      violations.push({
        rule: 'blocked-domain',
        severity: 'high',
        message: `URL domain "${hostname}" is not in the allowed list`,
      });
    }
  }

  // Rule 9: Force draft status on agent-created tools
  if (tool.status !== undefined && tool.status !== 'draft') {
    violations.push({
      rule: 'forced-draft-status',
      severity: 'medium',
      message: 'Agent-created tools must have status "draft"',
    });
  }

  return { valid: violations.length === 0, violations };
}

/**
 * Check if a URL targets an internal/metadata network (SSRF protection).
 * Handles IPv4, IPv6, and common internal hostnames.
 */
export function isSSRFTarget(url: string): boolean {
  let hostname: string;
  try {
    // Handle template placeholders by replacing them with a dummy value
    const cleanUrl = url.replace(/\{[^}]*?\}/g, 'placeholder');
    const parsed = new URL(cleanUrl);
    hostname = parsed.hostname.toLowerCase();
  } catch {
    // If URL can't be parsed, it may contain only placeholders — allow it
    return false;
  }

  // Strip IPv6 brackets
  if (hostname.startsWith('[') && hostname.endsWith(']')) {
    hostname = hostname.slice(1, -1);
  }

  // Exact matches
  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname === '0.0.0.0' ||
    hostname === '0'
  ) {
    return true;
  }

  // AWS/cloud metadata endpoint
  if (hostname === '169.254.169.254') {
    return true;
  }

  // Private IPv4 ranges
  if (hostname.startsWith('169.254.')) return true;
  if (hostname.startsWith('10.')) return true;
  if (hostname.startsWith('192.168.')) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(hostname)) return true;

  // Internal/local domain suffixes
  if (hostname.endsWith('.internal')) return true;
  if (hostname.endsWith('.local')) return true;
  if (hostname.endsWith('.localhost')) return true;

  return false;
}

/**
 * Extract the hostname from a URL string. Returns undefined if unparseable.
 */
function extractHostname(url: string): string | undefined {
  try {
    const cleanUrl = url.replace(/\{[^}]+\}/g, 'placeholder');
    return new URL(cleanUrl).hostname.toLowerCase();
  } catch {
    return undefined;
  }
}
