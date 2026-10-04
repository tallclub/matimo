/**
 * Per-call approval over MCP: ask the human behind the MCP client through an
 * elicitation request instead of trusting a flag the model can set itself.
 * Mirrors python/packages/core/src/matimo/mcp/approval_elicitation.py.
 */

import type { ApprovalCallback, ApprovalRequest } from '../approval/approval-handler.js';
import { MatimoError, ErrorCode } from '../errors/matimo-error.js';

/** Arguments longer than this are cut short in the approval prompt. */
const MAX_ARGUMENTS_CHARS = 2000;

/** The single yes/no field the client renders for the human. */
export const APPROVAL_ELICITATION_SCHEMA = {
  type: 'object',
  properties: {
    approve: {
      type: 'boolean',
      title: 'Approve',
      description: 'Allow this one call to run',
    },
  },
  required: ['approve'],
} as const;

/** The minimal surface of the MCP SDK's low-level `Server` this needs. */
export interface ElicitingServer {
  getClientCapabilities(): { elicitation?: unknown } | undefined;
  elicitInput(
    params: { message: string; requestedSchema: typeof APPROVAL_ELICITATION_SCHEMA },
    options?: { relatedRequestId?: string | number }
  ): Promise<{ action: string; content?: Record<string, unknown> }>;
}

/** What the human reads before deciding. */
export function approvalElicitationMessage(request: ApprovalRequest): string {
  let args = JSON.stringify(request.params ?? {}, null, 2);
  if (args.length > MAX_ARGUMENTS_CHARS) {
    args = `${args.slice(0, MAX_ARGUMENTS_CHARS)}\n… (truncated)`;
  }
  const lines = [`Allow the agent to run "${request.toolName}"?`];
  if (request.description) {
    lines.push(request.description.trim());
  }
  lines.push('', 'Arguments:', args);
  return lines.join('\n');
}

/**
 * Build an approval callback that asks the MCP client's user. Clients that
 * can't elicit get an error saying so; the model is never told how to
 * approve its own call.
 */
export function createElicitationApprovalCallback(
  server: ElicitingServer | undefined,
  relatedRequestId?: string | number
): ApprovalCallback {
  return async (request) => {
    if (!server?.getClientCapabilities()?.elicitation) {
      throw new MatimoError(
        `Tool '${request.toolName}' needs human approval, but this MCP client does not support elicitation, so there is no one to ask.`,
        ErrorCode.EXECUTION_FAILED,
        {
          toolName: request.toolName,
          hint:
            'Use an MCP client that supports elicitation, pre-approve the tool on the server with ' +
            'MATIMO_APPROVED_PATTERNS, or start the server with trustClientApproval if the client ' +
            'itself confirms each call with its user.',
        }
      );
    }
    const result = await server.elicitInput(
      {
        message: approvalElicitationMessage(request),
        requestedSchema: APPROVAL_ELICITATION_SCHEMA,
      },
      relatedRequestId !== undefined ? { relatedRequestId } : undefined
    );
    return result.action === 'accept' && result.content?.approve === true;
  };
}
