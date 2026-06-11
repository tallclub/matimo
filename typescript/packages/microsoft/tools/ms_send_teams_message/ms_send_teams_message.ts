/**
 * ms_send_teams_message
 *   New message:  POST /teams/{team-id}/channels/{channel-id}/messages
 *                 https://learn.microsoft.com/en-us/graph/api/channel-post-messages
 *   Reply:        POST /teams/{team-id}/channels/{channel-id}/messages/{message-id}/replies
 *                 https://learn.microsoft.com/en-us/graph/api/chatmessage-post-replies
 */
import { MatimoError, ErrorCode } from '@matimo/core/runtime';
import { getAccessToken, requireParams, graphRequest } from '../graph-client.js';

interface ToolContext {
  credentials?: Record<string, string>;
}

const VALID_CONTENT_TYPES = ['text', 'html'];

interface ChannelMessage {
  id?: string;
  webUrl?: string;
  createdDateTime?: string;
}

export default async function execute(
  params: Record<string, unknown>,
  context?: ToolContext
): Promise<unknown> {
  requireParams(params, ['team_id', 'channel_id', 'text'], 'ms_send_teams_message');

  const teamId = String(params.team_id);
  const channelId = String(params.channel_id);
  const text = String(params.text);

  const contentType = params.content_type === undefined ? 'text' : String(params.content_type);
  if (!VALID_CONTENT_TYPES.includes(contentType)) {
    throw new MatimoError(
      `ms_send_teams_message: 'content_type' must be one of ${VALID_CONTENT_TYPES.join(', ')} (received '${contentType}')`,
      ErrorCode.VALIDATION_FAILED,
      { content_type: params.content_type }
    );
  }

  const replyToMessageId =
    typeof params.reply_to_message_id === 'string' && params.reply_to_message_id
      ? params.reply_to_message_id
      : undefined;

  const token = getAccessToken(context);

  const basePath = `/teams/${encodeURIComponent(teamId)}/channels/${encodeURIComponent(channelId)}/messages`;
  const path = replyToMessageId
    ? `${basePath}/${encodeURIComponent(replyToMessageId)}/replies`
    : basePath;

  const message = await graphRequest<ChannelMessage>({
    method: 'POST',
    path,
    token,
    resourceType: 'Teams channel',
    body: {
      body: {
        contentType,
        content: text,
      },
    },
  });

  return {
    success: true,
    message_id: message?.id ?? '',
    web_url: message?.webUrl ?? '',
    created_at: message?.createdDateTime ?? '',
  };
}
