/**
 * Typed audit events for Matimo.
 *
 * Host applications subscribe via `onEvent` in InitOptions and route
 * events to their own logging/audit system.
 */

import type { RiskLevel } from './types.js';
import type { Violation } from './types.js';

export type MatimoEvent =
  | {
      type: 'tool:created';
      toolName: string;
      source: 'trusted' | 'untrusted';
      riskLevel: RiskLevel;
      timestamp: string;
    }
  | {
      type: 'tool:approved';
      toolName: string;
      approvedBy?: string;
      hash: string;
      timestamp: string;
    }
  | {
      type: 'tool:rejected';
      toolName: string;
      violations: Violation[];
      timestamp: string;
    }
  | {
      type: 'tool:revoked';
      toolName: string;
      reason: string;
      timestamp: string;
    }
  | {
      /** A tool ran to completion. `success` is false when it returned `{ success: false }`. */
      type: 'tool:executed';
      toolName: string;
      agentId?: string;
      /** Correlates this event with the call's logs. */
      traceId: string;
      /** Time spent in the tool itself, after every gate passed (excludes approval waits). */
      durationMs: number;
      success: boolean;
      /** Execution risk (classifyExecutionRisk) of the tool that ran. */
      riskLevel: RiskLevel;
      timestamp: string;
    }
  | {
      /** A tool that passed every gate threw instead of returning. */
      type: 'tool:execution_failed';
      toolName: string;
      agentId?: string;
      traceId: string;
      durationMs: number;
      riskLevel: RiskLevel;
      /** MatimoError code, or UNKNOWN_ERROR for any other error. */
      errorCode: string;
      error: string;
      timestamp: string;
    }
  | {
      type: 'tool:execution_denied';
      toolName: string;
      reason: string;
      agentId?: string;
      timestamp: string;
    }
  | {
      type: 'tool:quarantined';
      toolName: string;
      riskLevel: RiskLevel;
      reason: string;
      environment?: string;
      timestamp: string;
    }
  | {
      type: 'tool:quarantine_approved';
      toolName: string;
      approvedBy?: string;
      timestamp: string;
    }
  | {
      type: 'tool:quarantine_rejected';
      toolName: string;
      timestamp: string;
    }
  | {
      type: 'tool:approval_granted';
      toolName: string;
      agentId?: string;
      timestamp: string;
    }
  | {
      type: 'tool:approval_denied';
      toolName: string;
      reason: string;
      agentId?: string;
      timestamp: string;
    }
  | {
      type: 'policy:reloaded';
      timestamp: string;
    }
  | {
      type: 'tools:reloaded';
      loaded: number;
      removed: number;
      rejected: string[];
      timestamp: string;
    }
  | {
      type: 'skills:reloaded';
      loaded: number;
      removed: number;
      timestamp: string;
    }
  | {
      type: 'skill:created';
      skillName: string;
      source: 'user' | 'catalog';
      timestamp: string;
    };

export type MatimoEventHandler = (event: MatimoEvent) => void;
