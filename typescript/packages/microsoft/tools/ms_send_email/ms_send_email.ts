/**
 * ms_send_email — draft + send, two Graph calls
 *   1. POST /me/messages           https://learn.microsoft.com/en-us/graph/api/user-post-messages
 *   2. POST /me/messages/{id}/send https://learn.microsoft.com/en-us/graph/api/message-send
 *
 * Why two calls: POST /me/sendMail returns an empty 202 Accepted with no message
 * identifier, but this tool's contract promises a `message_id`. Creating a draft
 * first gives us a real message ID we can report back, then we send that draft.
 */
import { MatimoError, ErrorCode } from '@matimo/core';
import { getAccessToken, requireParams, graphRequest, type ToolContext } from '../graph-client';

const VALID_BODY_TYPES = ['text', 'html'];

interface DraftMessage {
  id?: string;
}

function toRecipientList(value: unknown, fieldName: string): Array<{ emailAddress: { address: string } }> {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string' || !entry)) {
    throw new MatimoError(
      `ms_send_email: '${fieldName}' must be an array of email address strings`,
      ErrorCode.VALIDATION_FAILED,
      { field: fieldName, received: value }
    );
  }
  return (value as string[]).map((address) => ({ emailAddress: { address } }));
}

export default async function execute(
  params: Record<string, unknown>,
  context?: ToolContext
): Promise<unknown> {
  requireParams(params, ['to', 'subject', 'body'], 'ms_send_email');

  const to = toRecipientList(params.to, 'to');
  if (to.length === 0) {
    throw new MatimoError(
      "ms_send_email: 'to' must contain at least one recipient email address",
      ErrorCode.VALIDATION_FAILED,
      { to: params.to }
    );
  }
  const cc = toRecipientList(params.cc, 'cc');
  const bcc = toRecipientList(params.bcc, 'bcc');

  const bodyType = params.body_type === undefined ? 'text' : String(params.body_type);
  if (!VALID_BODY_TYPES.includes(bodyType)) {
    throw new MatimoError(
      `ms_send_email: 'body_type' must be one of ${VALID_BODY_TYPES.join(', ')} (received '${bodyType}')`,
      ErrorCode.VALIDATION_FAILED,
      { body_type: params.body_type }
    );
  }

  const token = getAccessToken(context);

  const draft = await graphRequest<DraftMessage>({
    method: 'POST',
    path: '/me/messages',
    token,
    resourceType: 'Mail draft',
    body: {
      subject: String(params.subject),
      body: {
        contentType: bodyType === 'html' ? 'HTML' : 'Text',
        content: String(params.body),
      },
      toRecipients: to,
      ...(cc.length > 0 ? { ccRecipients: cc } : {}),
      ...(bcc.length > 0 ? { bccRecipients: bcc } : {}),
    },
  });

  const messageId = draft?.id;
  if (!messageId) {
    throw new MatimoError(
      'ms_send_email: Microsoft Graph did not return an ID for the created draft message.',
      ErrorCode.EXECUTION_FAILED,
      { draft }
    );
  }

  await graphRequest({
    method: 'POST',
    path: `/me/messages/${encodeURIComponent(messageId)}/send`,
    token,
    resourceType: 'Mail draft',
    allowEmptyResponse: true,
  });

  return {
    success: true,
    sent: true,
    message_id: messageId,
  };
}
