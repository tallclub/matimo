/**
 * Policy Engine types for Matimo Agent-Native SDK.
 *
 * The policy engine governs what tools agents can create, execute, and discover.
 * It is immutable at runtime — set by the developer at deploy time.
 */

import type { ToolDefinition } from '../core/schema';

// ─── Risk Levels ────────────────────────────────────────────────────────

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

// ─── Policy Context ─────────────────────────────────────────────────────

/**
 * Identity and environment context passed by the host application.
 * Matimo does not authenticate — this is whatever the caller provides.
 */
export interface PolicyContext {
  /** Identifier for the calling agent (optional — SDK doesn't mandate identity) */
  agentId?: string;
  /** Deployment environment (e.g. 'dev', 'staging', 'prod') */
  environment?: string;
  /** Roles assigned to the caller (e.g. ['reader', 'writer', 'admin']) */
  roles?: string[];
  /** Extensible metadata for custom policy rules */
  metadata?: Record<string, unknown>;
}

// ─── Policy Decision ────────────────────────────────────────────────────

export type PolicyDecision =
  | { allowed: true }
  | { allowed: false; reason: string; riskLevel?: RiskLevel };

// ─── Validation ─────────────────────────────────────────────────────────

export interface Violation {
  /** Machine-readable rule identifier (e.g. 'no-ssrf', 'reserved-namespace') */
  rule: string;
  /** Severity of the violation */
  severity: RiskLevel;
  /** Human-readable explanation */
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  violations: Violation[];
}

export interface ValidationContext {
  /** Whether the tool comes from a trusted or untrusted path */
  source: 'trusted' | 'untrusted';
  /** Active policy configuration (defaults to empty/permissive) */
  policy?: PolicyConfig;
}

// ─── Policy Configuration ───────────────────────────────────────────────

/**
 * Developer-configurable policy rules. All fields optional with conservative defaults.
 */
export interface PolicyConfig {
  /** HTTP tool URL domain allowlist. If set, only these domains are permitted. */
  allowedDomains?: string[];
  /** Env var names that agent-created tools may reference for auth. */
  allowedCredentials?: string[];
  /** HTTP methods allowed for agent-created tools (default: ['GET', 'POST']). */
  allowedHttpMethods?: string[];
  /** Allow agent-created tools with execution type 'command' (default: false). */
  allowCommandTools?: boolean;
  /** Allow agent-created tools with execution type 'function' (default: false — always false for untrusted). */
  allowFunctionTools?: boolean;
  /** Tool name prefixes reserved for built-in tools (default: ['matimo_']). */
  protectedNamespaces?: string[];
}

// ─── Policy Engine Interface ────────────────────────────────────────────

/**
 * The PolicyEngine interface. Implementations are frozen at boot time and
 * cannot be mutated by agents at runtime.
 */
export interface PolicyEngine {
  /** Check whether this agent is allowed to execute a given tool. */
  canExecute(context: PolicyContext, tool: ToolDefinition): PolicyDecision;

  /** Check whether this agent is allowed to create/propose a tool definition. */
  canCreate(context: PolicyContext, toolDef: ToolDefinition): PolicyDecision;

  /** Filter a list of tools to only those this agent is allowed to see/use. */
  filterForAgent(context: PolicyContext, tools: ToolDefinition[]): ToolDefinition[];
}
