/**
 * ms_create_calendar_event — POST /me/events
 * https://learn.microsoft.com/en-us/graph/api/user-post-events
 */
import { MatimoError, ErrorCode } from '@matimo/core/runtime';
import { getAccessToken, requireParams, graphRequest } from '../graph-client.js';

interface ToolContext {
  credentials?: Record<string, string>;
}

const DEFAULT_TIMEZONE = 'UTC';

interface OnlineMeeting {
  joinUrl?: string;
}

interface CalendarEvent {
  id?: string;
  webLink?: string;
  onlineMeeting?: OnlineMeeting;
}

function toAttendeeList(value: unknown): Array<{ emailAddress: { address: string }; type: 'required' }> {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string' || !entry)) {
    throw new MatimoError(
      "ms_create_calendar_event: 'attendees' must be an array of email address strings",
      ErrorCode.VALIDATION_FAILED,
      { attendees: value }
    );
  }
  return (value as string[]).map((address) => ({
    emailAddress: { address },
    type: 'required' as const,
  }));
}

export default async function execute(
  params: Record<string, unknown>,
  context?: ToolContext
): Promise<unknown> {
  requireParams(params, ['subject', 'start', 'end'], 'ms_create_calendar_event');

  const subject = String(params.subject);
  const start = String(params.start);
  const end = String(params.end);
  const timezone =
    typeof params.timezone === 'string' && params.timezone ? params.timezone : DEFAULT_TIMEZONE;

  const attendees = toAttendeeList(params.attendees);
  const isOnlineMeeting = params.is_online_meeting === true;

  const token = getAccessToken(context);

  const event = await graphRequest<CalendarEvent>({
    method: 'POST',
    path: '/me/events',
    token,
    resourceType: 'Calendar',
    body: {
      subject,
      ...(typeof params.body === 'string' && params.body
        ? { body: { contentType: 'Text', content: params.body } }
        : {}),
      start: { dateTime: start, timeZone: timezone },
      end: { dateTime: end, timeZone: timezone },
      ...(attendees.length > 0 ? { attendees } : {}),
      ...(typeof params.location === 'string' && params.location
        ? { location: { displayName: params.location } }
        : {}),
      isOnlineMeeting,
      ...(isOnlineMeeting ? { onlineMeetingProvider: 'teamsForBusiness' } : {}),
    },
  });

  return {
    success: true,
    event_id: event?.id ?? '',
    web_link: event?.webLink ?? '',
    ...(event?.onlineMeeting?.joinUrl ? { join_url: event.onlineMeeting.joinUrl } : {}),
  };
}
