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
      type: 'tool:executed';
      toolName: string;
      agentId?: string;
      duration: number;
      success: boolean;
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
    };

export type MatimoEventHandler = (event: MatimoEvent) => void;
