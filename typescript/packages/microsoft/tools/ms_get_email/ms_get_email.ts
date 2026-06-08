/**
 * ms_get_email — GET /me/messages
 * https://learn.microsoft.com/en-us/graph/api/user-list-messages
 */
import { MatimoError, ErrorCode } from '@matimo/core';
import { getAccessToken, requireParams, graphRequest, type ToolContext } from '../graph-client';

const DEFAULT_TOP = 10;
const MAX_TOP = 50;

interface EmailAddress {
  name?: string;
  address?: string;
}

interface MessageRecipient {
  emailAddress?: EmailAddress;
}

interface GraphMessage {
  id?: string;
  subject?: string;
  from?: MessageRecipient;
  receivedDateTime?: string;
  isRead?: boolean;
  bodyPreview?: string;
  hasAttachments?: boolean;
}

interface MessagesResponse {
  value?: GraphMessage[];
}

function formatSender(message: GraphMessage): string {
  const address = message.from?.emailAddress;
  if (!address) return '';
  if (address.name && address.address) return `${address.name} <${address.address}>`;
  return address.name ?? address.address ?? '';
}

export default async function execute(
  params: Record<string, unknown>,
  context?: ToolContext
): Promise<unknown> {
  requireParams(params, [], 'ms_get_email');

  const top = params.top === undefined ? DEFAULT_TOP : Number(params.top);
  if (!Number.isFinite(top) || top < 1 || top > MAX_TOP) {
    throw new MatimoError(
      `ms_get_email: 'top' must be a number between 1 and ${MAX_TOP} (received ${String(params.top)})`,
      ErrorCode.VALIDATION_FAILED,
      { top: params.top }
    );
  }

  const folderId = typeof params.folder_id === 'string' && params.folder_id ? params.folder_id : undefined;
  const filter = typeof params.filter === 'string' && params.filter ? params.filter : undefined;
  const search = typeof params.search === 'string' && params.search ? params.search : undefined;

  const token = getAccessToken(context);

  const path = folderId
    ? `/me/mailFolders/${encodeURIComponent(folderId)}/messages`
    : '/me/messages';

  const data = await graphRequest<MessagesResponse>({
    method: 'GET',
    path,
    token,
    resourceType: 'Mail folder',
    query: {
      $top: top,
      $select: 'id,subject,from,receivedDateTime,isRead,bodyPreview,hasAttachments',
      ...(filter ? { $filter: filter } : {}),
      ...(search ? { $search: search } : {}),
    },
  });

  const messages = (data?.value ?? []).map((message) => ({
    id: message.id ?? '',
    subject: message.subject ?? '',
    from: formatSender(message),
    received_at: message.receivedDateTime ?? '',
    is_read: message.isRead ?? false,
    body_preview: message.bodyPreview ?? '',
    has_attachments: message.hasAttachments ?? false,
  }));

  return {
    success: true,
    messages,
  };
}
