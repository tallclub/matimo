/**
 * Unit tests for all 9 Microsoft Graph tool YAML definitions and executors.
 *
 * Mirrors the bruno/gmail unit test pattern: YAML structural assertions for every
 * tool, then per-tool executor tests with axios mocked (no live Graph calls).
 */
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import axios from 'axios';
import { MatimoError, ErrorCode } from '@matimo/core';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

import searchKnowledge from '../../tools/ms_search_knowledge/ms_search_knowledge';
import readFile from '../../tools/ms_read_file/ms_read_file';
import listFiles from '../../tools/ms_list_files/ms_list_files';
import getEmail from '../../tools/ms_get_email/ms_get_email';
import sendEmail from '../../tools/ms_send_email/ms_send_email';
import sendTeamsMessage from '../../tools/ms_send_teams_message/ms_send_teams_message';
import createDocument from '../../tools/ms_create_document/ms_create_document';
import createCalendarEvent from '../../tools/ms_create_calendar_event/ms_create_calendar_event';
import publishToSharepoint from '../../tools/ms_publish_to_sharepoint/ms_publish_to_sharepoint';

type ToolDefinition = {
  name: string;
  description?: string;
  version?: string;
  status?: string;
  risk?: string;
  requires_approval?: boolean;
  parameters?: Record<string, { required?: boolean }>;
  execution?: { type?: string; code?: string };
  output_schema?: Record<string, unknown>;
  authentication?: { type?: string; provider?: string };
  examples?: Array<{ name: string; params: Record<string, unknown> }>;
};

const TOOLS_ROOT = path.join(__dirname, '../../tools');

const TOOL_SPECS: Array<{ name: string; risk: string; requiresApproval: boolean }> = [
  { name: 'ms_search_knowledge', risk: 'low', requiresApproval: false },
  { name: 'ms_read_file', risk: 'low', requiresApproval: false },
  { name: 'ms_list_files', risk: 'low', requiresApproval: false },
  { name: 'ms_get_email', risk: 'low', requiresApproval: false },
  { name: 'ms_send_email', risk: 'high', requiresApproval: true },
  { name: 'ms_send_teams_message', risk: 'medium', requiresApproval: false },
  { name: 'ms_create_document', risk: 'medium', requiresApproval: false },
  { name: 'ms_create_calendar_event', risk: 'medium', requiresApproval: false },
  { name: 'ms_publish_to_sharepoint', risk: 'high', requiresApproval: true },
];

const CONTEXT = { credentials: { MICROSOFT_GRAPH_ACCESS_TOKEN: 'test-token' } };

function mockGraphResponse(status: number, data: unknown, headers: Record<string, unknown> = {}) {
  mockedAxios.request.mockResolvedValueOnce({ status, data, headers });
}

async function expectMatimoError(promise: Promise<unknown>, code: ErrorCode): Promise<MatimoError> {
  try {
    await promise;
    throw new Error('expected promise to reject with a MatimoError');
  } catch (error) {
    expect(error).toBeInstanceOf(MatimoError);
    expect((error as MatimoError).code).toBe(code);
    return error as MatimoError;
  }
}

// ─── YAML definition structural tests ────────────────────────────────────────

describe('microsoft tool YAML definitions', () => {
  TOOL_SPECS.forEach(({ name, risk, requiresApproval }) => {
    describe(name, () => {
      let def: ToolDefinition;

      beforeAll(() => {
        const toolPath = path.join(TOOLS_ROOT, name, 'definition.yaml');
        def = yaml.load(fs.readFileSync(toolPath, 'utf-8')) as ToolDefinition;
      });

      it('has all required YAML fields', () => {
        expect(def.name).toBe(name);
        expect(def.description).toBeTruthy();
        expect(def.version).toBeTruthy();
        expect(def.status).toBe('approved');
        expect(def.parameters).toBeDefined();
        expect(def.execution).toBeDefined();
        expect(def.output_schema).toBeDefined();
      });

      it('is implemented as a function tool with a co-located executor file', () => {
        expect(def.execution?.type).toBe('function');
        expect(def.execution?.code).toBe(`${name}.js`);
        expect(fs.existsSync(path.join(TOOLS_ROOT, name, def.execution?.code as string))).toBe(
          true
        );
      });

      it(`has risk: ${risk}`, () => {
        expect(def.risk).toBe(risk);
      });

      it(`has requires_approval ${requiresApproval ? '=== true' : 'unset/false'}`, () => {
        expect(def.requires_approval ?? false).toBe(requiresApproval);
      });

      it('uses Microsoft OAuth2 authentication', () => {
        expect(def.authentication?.type).toBe('oauth2');
        expect(def.authentication?.provider).toBe('microsoft');
      });

      it('has at least one example', () => {
        expect(Array.isArray(def.examples)).toBe(true);
        expect((def.examples ?? []).length).toBeGreaterThanOrEqual(1);
      });
    });
  });
});

// ─── ms_search_knowledge ──────────────────────────────────────────────────────

describe('ms_search_knowledge executor', () => {
  beforeEach(() => jest.clearAllMocks());

  it('throws VALIDATION_FAILED when query is missing', async () => {
    await expectMatimoError(searchKnowledge({}, CONTEXT), ErrorCode.VALIDATION_FAILED);
    expect(mockedAxios.request).not.toHaveBeenCalled();
  });

  it('rejects invalid entity_types before calling Graph', async () => {
    await expectMatimoError(
      searchKnowledge({ query: 'q', entity_types: ['bogus'] }, CONTEXT),
      ErrorCode.VALIDATION_FAILED
    );
    expect(mockedAxios.request).not.toHaveBeenCalled();
  });

  it('rejects out-of-range top values', async () => {
    await expectMatimoError(
      searchKnowledge({ query: 'q', top: 100 }, CONTEXT),
      ErrorCode.VALIDATION_FAILED
    );
    await expectMatimoError(
      searchKnowledge({ query: 'q', top: 0 }, CONTEXT),
      ErrorCode.VALIDATION_FAILED
    );
  });

  it('searches with default entity types and transforms hits into results', async () => {
    mockGraphResponse(200, {
      value: [
        {
          hitsContainers: [
            {
              total: 2,
              hits: [
                {
                  hitId: 'h1',
                  rank: 1,
                  summary: 'Quarterly summary',
                  resource: {
                    id: 'item1',
                    name: 'Q3-budget.xlsx',
                    webUrl: 'https://contoso.sharepoint.com/Q3-budget.xlsx',
                    lastModifiedDateTime: '2026-05-01T00:00:00Z',
                  },
                },
              ],
            },
          ],
        },
      ],
    });

    const result = (await searchKnowledge({ query: 'budget' }, CONTEXT)) as Record<string, unknown>;

    expect(result.success).toBe(true);
    expect(result.total_count).toBe(2);
    expect(result.results).toEqual([
      {
        id: 'item1',
        name: 'Q3-budget.xlsx',
        summary: 'Quarterly summary',
        web_url: 'https://contoso.sharepoint.com/Q3-budget.xlsx',
        last_modified: '2026-05-01T00:00:00Z',
        score: 1,
      },
    ]);

    const body = (
      mockedAxios.request.mock.calls[0][0] as { data: { requests: Array<Record<string, unknown>> } }
    ).data.requests[0];
    expect(body.entityTypes).toEqual(['driveItem', 'listItem', 'site']);
    expect((body.query as { queryString: string }).queryString).toBe('budget');
  });

  it('folds site_id and drive_id into the query string as best-effort hints', async () => {
    mockGraphResponse(200, { value: [{ hitsContainers: [{ total: 0, hits: [] }] }] });

    await searchKnowledge({ query: 'onboarding', site_id: 'site-1', drive_id: 'drive-1' }, CONTEXT);

    const body = (
      mockedAxios.request.mock.calls[0][0] as { data: { requests: Array<Record<string, unknown>> } }
    ).data.requests[0];
    expect((body.query as { queryString: string }).queryString).toBe('onboarding site-1 drive-1');
  });

  it('falls back to empty results when the response has no hits container', async () => {
    mockGraphResponse(200, { value: [] });

    const result = (await searchKnowledge({ query: 'q' }, CONTEXT)) as Record<string, unknown>;
    expect(result.results).toEqual([]);
    expect(result.total_count).toBe(0);
  });
});

// ─── ms_read_file ─────────────────────────────────────────────────────────────

describe('ms_read_file executor', () => {
  beforeEach(() => jest.clearAllMocks());

  it('throws VALIDATION_FAILED when required params are missing', async () => {
    await expectMatimoError(readFile({ drive_id: 'd1' }, CONTEXT), ErrorCode.VALIDATION_FAILED);
    expect(mockedAxios.request).not.toHaveBeenCalled();
  });

  it('decodes plain-text content as UTF-8', async () => {
    mockGraphResponse(200, { name: 'notes.txt', size: 11, file: { mimeType: 'text/plain' } });
    mockGraphResponse(200, Buffer.from('hello world'));

    const result = (await readFile({ drive_id: 'd1', item_id: 'i1' }, CONTEXT)) as Record<
      string,
      unknown
    >;

    expect(result).toMatchObject({
      success: true,
      content: 'hello world',
      name: 'notes.txt',
      mime_type: 'text/plain',
      size_bytes: 11,
    });
    expect(result.warning).toBeUndefined();
  });

  it('decodes application/json content as text', async () => {
    mockGraphResponse(200, { name: 'data.json', size: 13, file: { mimeType: 'application/json' } });
    mockGraphResponse(200, Buffer.from('{"ok":true}'));

    const result = (await readFile({ drive_id: 'd1', item_id: 'i1' }, CONTEXT)) as Record<
      string,
      unknown
    >;
    expect(result.content).toBe('{"ok":true}');
  });

  it('returns an empty content with a format-specific warning for rich documents', async () => {
    mockGraphResponse(200, {
      name: 'report.pdf',
      size: 2048,
      file: { mimeType: 'application/pdf' },
    });
    mockGraphResponse(200, Buffer.from('%PDF-1.4'));

    const result = (await readFile({ drive_id: 'd1', item_id: 'i1' }, CONTEXT)) as Record<
      string,
      unknown
    >;

    expect(result.content).toBe('');
    expect(result.warning).toContain('PDF document');
    expect(result.warning).not.toBe('Binary file — text extraction not supported');
  });

  it('returns the exact spec warning for genuinely unsupported binaries', async () => {
    mockGraphResponse(200, {
      name: 'archive.zip',
      size: 4096,
      file: { mimeType: 'application/zip' },
    });
    mockGraphResponse(200, Buffer.from([0x50, 0x4b, 0x03, 0x04]));

    const result = (await readFile({ drive_id: 'd1', item_id: 'i1' }, CONTEXT)) as Record<
      string,
      unknown
    >;

    expect(result.content).toBe('');
    expect(result.warning).toBe('Binary file — text extraction not supported');
  });

  it('defaults missing metadata fields gracefully', async () => {
    mockGraphResponse(200, {});
    mockGraphResponse(200, Buffer.from('x'));

    const result = (await readFile({ drive_id: 'd1', item_id: 'i1' }, CONTEXT)) as Record<
      string,
      unknown
    >;
    expect(result.name).toBe('');
    expect(result.mime_type).toBe('application/octet-stream');
    expect(result.size_bytes).toBe(0);
  });
});

// ─── ms_list_files ────────────────────────────────────────────────────────────

describe('ms_list_files executor', () => {
  beforeEach(() => jest.clearAllMocks());

  it('throws VALIDATION_FAILED when drive_id is missing', async () => {
    await expectMatimoError(listFiles({}, CONTEXT), ErrorCode.VALIDATION_FAILED);
  });

  it('rejects out-of-range top values', async () => {
    await expectMatimoError(
      listFiles({ drive_id: 'd1', top: 0 }, CONTEXT),
      ErrorCode.VALIDATION_FAILED
    );
    await expectMatimoError(
      listFiles({ drive_id: 'd1', top: 1000 }, CONTEXT),
      ErrorCode.VALIDATION_FAILED
    );
  });

  it('defaults item_id to "root" and classifies files vs folders', async () => {
    mockGraphResponse(200, {
      value: [
        {
          id: 'f1',
          name: 'Reports',
          folder: { childCount: 3 },
          lastModifiedDateTime: '2026-01-01T00:00:00Z',
          webUrl: 'https://contoso.sharepoint.com/Reports',
        },
        {
          id: 'i1',
          name: 'summary.docx',
          size: 2048,
          file: {
            mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          },
          lastModifiedDateTime: '2026-02-01T00:00:00Z',
          webUrl: 'https://contoso.sharepoint.com/summary.docx',
        },
      ],
    });

    const result = (await listFiles({ drive_id: 'd1' }, CONTEXT)) as Record<string, unknown>;
    const items = result.items as Array<Record<string, unknown>>;

    expect(items[0]).toMatchObject({ id: 'f1', name: 'Reports', type: 'folder', size_bytes: 0 });
    expect(items[0].mime_type).toBeUndefined();
    expect(items[1]).toMatchObject({
      id: 'i1',
      name: 'summary.docx',
      type: 'file',
      size_bytes: 2048,
      mime_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });

    const requestPath = (mockedAxios.request.mock.calls[0][0] as { url: string }).url;
    expect(requestPath).toContain('/drives/d1/items/root/children');
  });

  it('passes a custom item_id and top through to the request path/query', async () => {
    mockGraphResponse(200, { value: [] });

    await listFiles({ drive_id: 'd1', item_id: 'folder-123', top: 5 }, CONTEXT);

    const requestUrl = (mockedAxios.request.mock.calls[0][0] as { url: string }).url;
    expect(requestUrl).toContain('/drives/d1/items/folder-123/children');
    expect(requestUrl).toContain('%24top=5');
  });
});

// ─── ms_get_email ─────────────────────────────────────────────────────────────

describe('ms_get_email executor', () => {
  beforeEach(() => jest.clearAllMocks());

  it('rejects out-of-range top values', async () => {
    await expectMatimoError(getEmail({ top: 0 }, CONTEXT), ErrorCode.VALIDATION_FAILED);
    await expectMatimoError(getEmail({ top: 51 }, CONTEXT), ErrorCode.VALIDATION_FAILED);
  });

  it('lists messages from /me/messages by default and formats sender + fields', async () => {
    mockGraphResponse(200, {
      value: [
        {
          id: 'm1',
          subject: 'Welcome',
          from: { emailAddress: { name: 'Alice', address: 'alice@contoso.com' } },
          receivedDateTime: '2026-06-01T08:00:00Z',
          isRead: false,
          bodyPreview: 'Hi there...',
          hasAttachments: true,
        },
      ],
    });

    const result = (await getEmail({}, CONTEXT)) as Record<string, unknown>;
    const messages = result.messages as Array<Record<string, unknown>>;

    expect(mockedAxios.request.mock.calls[0][0]).toMatchObject({
      url: expect.stringContaining('/me/messages'),
    });
    expect(messages[0]).toEqual({
      id: 'm1',
      subject: 'Welcome',
      from: 'Alice <alice@contoso.com>',
      received_at: '2026-06-01T08:00:00Z',
      is_read: false,
      body_preview: 'Hi there...',
      has_attachments: true,
    });
  });

  it('scopes to a folder when folder_id is provided and applies filter/search', async () => {
    mockGraphResponse(200, { value: [] });

    await getEmail({ folder_id: 'inbox', filter: 'isRead eq false', search: '"invoice"' }, CONTEXT);

    const call = mockedAxios.request.mock.calls[0][0] as {
      url: string;
      headers: Record<string, string>;
    };
    expect(call.url).toContain('/me/mailFolders/inbox/messages');
    expect(call.url).toContain('%24filter=isRead%20eq%20false');
    expect(call.url).toContain('%24search=%22invoice%22');
    expect(call.headers['ConsistencyLevel']).toBe('eventual');
  });

  it('does not send ConsistencyLevel header when search is not provided', async () => {
    mockGraphResponse(200, { value: [] });

    await getEmail({}, CONTEXT);

    const call = mockedAxios.request.mock.calls[0][0] as { headers: Record<string, string> };
    expect(call.headers['ConsistencyLevel']).toBeUndefined();
  });

  it('handles a sender with only a name or only an address', async () => {
    mockGraphResponse(200, {
      value: [
        { id: 'm1', from: { emailAddress: { name: 'No Address' } } },
        { id: 'm2', from: { emailAddress: { address: 'only@contoso.com' } } },
        { id: 'm3' },
      ],
    });

    const result = (await getEmail({}, CONTEXT)) as Record<string, unknown>;
    const messages = result.messages as Array<Record<string, unknown>>;
    expect(messages[0].from).toBe('No Address');
    expect(messages[1].from).toBe('only@contoso.com');
    expect(messages[2].from).toBe('');
  });
});

// ─── ms_send_email ────────────────────────────────────────────────────────────

describe('ms_send_email executor', () => {
  beforeEach(() => jest.clearAllMocks());

  it('throws VALIDATION_FAILED when required params are missing', async () => {
    await expectMatimoError(
      sendEmail({ to: ['a@b.com'], subject: 's' }, CONTEXT),
      ErrorCode.VALIDATION_FAILED
    );
  });

  it('rejects a non-array "to"', async () => {
    await expectMatimoError(
      sendEmail({ to: 'a@b.com', subject: 's', body: 'b' }, CONTEXT),
      ErrorCode.VALIDATION_FAILED
    );
  });

  it('rejects an empty "to" array', async () => {
    await expectMatimoError(
      sendEmail({ to: [], subject: 's', body: 'b' }, CONTEXT),
      ErrorCode.VALIDATION_FAILED
    );
  });

  it('rejects an invalid body_type', async () => {
    await expectMatimoError(
      sendEmail({ to: ['a@b.com'], subject: 's', body: 'b', body_type: 'markdown' }, CONTEXT),
      ErrorCode.VALIDATION_FAILED
    );
  });

  it('creates a draft then sends it, returning the draft message_id', async () => {
    mockGraphResponse(201, { id: 'draft-123' });
    mockGraphResponse(202, '');

    const result = (await sendEmail(
      { to: ['alice@contoso.com'], cc: ['bob@contoso.com'], subject: 'Hi', body: 'Hello' },
      CONTEXT
    )) as Record<string, unknown>;

    expect(result).toEqual({ success: true, sent: true, message_id: 'draft-123' });
    expect(mockedAxios.request).toHaveBeenCalledTimes(2);

    const draftCall = mockedAxios.request.mock.calls[0][0] as {
      url: string;
      data: Record<string, unknown>;
    };
    expect(draftCall.url).toContain('/me/messages');
    expect(draftCall.data).toMatchObject({
      subject: 'Hi',
      body: { contentType: 'Text', content: 'Hello' },
      toRecipients: [{ emailAddress: { address: 'alice@contoso.com' } }],
      ccRecipients: [{ emailAddress: { address: 'bob@contoso.com' } }],
    });

    const sendCall = mockedAxios.request.mock.calls[1][0] as { url: string };
    expect(sendCall.url).toContain('/me/messages/draft-123/send');
  });

  it('uses HTML content type when body_type is html', async () => {
    mockGraphResponse(201, { id: 'draft-html' });
    mockGraphResponse(202, '');

    await sendEmail(
      { to: ['a@b.com'], subject: 's', body: '<p>hi</p>', body_type: 'html' },
      CONTEXT
    );

    const draftCall = mockedAxios.request.mock.calls[0][0] as {
      data: { body: { contentType: string } };
    };
    expect(draftCall.data.body.contentType).toBe('HTML');
  });

  it('throws EXECUTION_FAILED when Graph does not return a draft id', async () => {
    mockGraphResponse(201, {});

    await expectMatimoError(
      sendEmail({ to: ['a@b.com'], subject: 's', body: 'b' }, CONTEXT),
      ErrorCode.EXECUTION_FAILED
    );
    expect(mockedAxios.request).toHaveBeenCalledTimes(1);
  });
});

// ─── ms_send_teams_message ────────────────────────────────────────────────────

describe('ms_send_teams_message executor', () => {
  beforeEach(() => jest.clearAllMocks());

  it('throws VALIDATION_FAILED when required params are missing', async () => {
    await expectMatimoError(
      sendTeamsMessage({ team_id: 't1', channel_id: 'c1' }, CONTEXT),
      ErrorCode.VALIDATION_FAILED
    );
  });

  it('rejects an invalid content_type', async () => {
    await expectMatimoError(
      sendTeamsMessage(
        { team_id: 't1', channel_id: 'c1', text: 'hi', content_type: 'markdown' },
        CONTEXT
      ),
      ErrorCode.VALIDATION_FAILED
    );
  });

  it('posts a new top-level channel message by default', async () => {
    mockGraphResponse(201, {
      id: 'msg-1',
      webUrl: 'https://teams.microsoft.com/l/message/msg-1',
      createdDateTime: '2026-06-01T00:00:00Z',
    });

    const result = (await sendTeamsMessage(
      { team_id: 't1', channel_id: 'c1', text: 'hello' },
      CONTEXT
    )) as Record<string, unknown>;

    expect(result).toEqual({
      success: true,
      message_id: 'msg-1',
      web_url: 'https://teams.microsoft.com/l/message/msg-1',
      created_at: '2026-06-01T00:00:00Z',
    });

    const call = mockedAxios.request.mock.calls[0][0] as {
      url: string;
      data: Record<string, unknown>;
    };
    expect(call.url).toContain('/teams/t1/channels/c1/messages');
    expect(call.url).not.toContain('/replies');
    expect(call.data).toEqual({ body: { contentType: 'text', content: 'hello' } });
  });

  it('posts a threaded reply when reply_to_message_id is provided', async () => {
    mockGraphResponse(201, {
      id: 'reply-1',
      webUrl: 'https://x',
      createdDateTime: '2026-06-02T00:00:00Z',
    });

    await sendTeamsMessage(
      {
        team_id: 't1',
        channel_id: 'c1',
        text: 'following up',
        reply_to_message_id: 'msg-1',
        content_type: 'html',
      },
      CONTEXT
    );

    const call = mockedAxios.request.mock.calls[0][0] as {
      url: string;
      data: Record<string, unknown>;
    };
    expect(call.url).toContain('/teams/t1/channels/c1/messages/msg-1/replies');
    expect(call.data).toEqual({ body: { contentType: 'html', content: 'following up' } });
  });
});

// ─── ms_create_document ───────────────────────────────────────────────────────

describe('ms_create_document executor', () => {
  beforeEach(() => jest.clearAllMocks());

  it('throws VALIDATION_FAILED when required params are missing', async () => {
    await expectMatimoError(
      createDocument({ drive_id: 'd1', filename: 'a.txt' }, CONTEXT),
      ErrorCode.VALIDATION_FAILED
    );
  });

  it('rejects an invalid content_encoding', async () => {
    await expectMatimoError(
      createDocument(
        { drive_id: 'd1', filename: 'a.txt', content: 'x', content_encoding: 'rot13' },
        CONTEXT
      ),
      ErrorCode.VALIDATION_FAILED
    );
  });

  it('rejects an invalid conflict_behaviour', async () => {
    await expectMatimoError(
      createDocument(
        { drive_id: 'd1', filename: 'a.txt', content: 'x', conflict_behaviour: 'overwrite' },
        CONTEXT
      ),
      ErrorCode.VALIDATION_FAILED
    );
  });

  it('rejects content larger than the 4 MB simple-upload limit', async () => {
    const oversized = 'x'.repeat(4 * 1024 * 1024 + 1);
    await expectMatimoError(
      createDocument({ drive_id: 'd1', filename: 'big.txt', content: oversized }, CONTEXT),
      ErrorCode.VALIDATION_FAILED
    );
    expect(mockedAxios.request).not.toHaveBeenCalled();
  });

  it('uploads plain-text content to the drive root by default', async () => {
    mockGraphResponse(201, {
      id: 'item-1',
      name: 'notes.md',
      webUrl: 'https://contoso.sharepoint.com/notes.md',
      size: 5,
    });

    const result = (await createDocument(
      { drive_id: 'd1', filename: 'notes.md', content: 'hello' },
      CONTEXT
    )) as Record<string, unknown>;

    expect(result).toEqual({
      success: true,
      item_id: 'item-1',
      name: 'notes.md',
      web_url: 'https://contoso.sharepoint.com/notes.md',
      size_bytes: 5,
    });

    const call = mockedAxios.request.mock.calls[0][0] as {
      method: string;
      url: string;
      data: Buffer;
      headers: Record<string, string>;
    };
    expect(call.method).toBe('PUT');
    expect(call.url).toContain('/drives/d1/items/root:/notes.md:/content');
    expect(call.url).toContain('conflictBehavior');
    expect(call.data.toString('utf-8')).toBe('hello');
    expect(call.headers['Content-Type']).toBe('application/octet-stream');
  });

  it('decodes base64 content before uploading', async () => {
    mockGraphResponse(201, { id: 'item-2', name: 'data.bin', webUrl: 'https://x', size: 2 });

    await createDocument(
      {
        drive_id: 'd1',
        parent_item_id: 'folder-1',
        filename: 'data.bin',
        content: Buffer.from('hi').toString('base64'),
        content_encoding: 'base64',
        conflict_behaviour: 'rename',
      },
      CONTEXT
    );

    const call = mockedAxios.request.mock.calls[0][0] as { url: string; data: Buffer };
    expect(call.url).toContain('/drives/d1/items/folder-1:/data.bin:/content');
    expect(call.data.toString('utf-8')).toBe('hi');
  });
});

// ─── ms_create_calendar_event ─────────────────────────────────────────────────

describe('ms_create_calendar_event executor', () => {
  beforeEach(() => jest.clearAllMocks());

  it('throws VALIDATION_FAILED when required params are missing', async () => {
    await expectMatimoError(
      createCalendarEvent({ subject: 's' }, CONTEXT),
      ErrorCode.VALIDATION_FAILED
    );
  });

  it('rejects a non-array attendees value', async () => {
    await expectMatimoError(
      createCalendarEvent(
        {
          subject: 's',
          start: '2026-06-15T09:00:00',
          end: '2026-06-15T09:30:00',
          attendees: 'alice@contoso.com',
        },
        CONTEXT
      ),
      ErrorCode.VALIDATION_FAILED
    );
  });

  it('creates an event with defaults (UTC timezone, no online meeting)', async () => {
    mockGraphResponse(201, { id: 'evt-1', webLink: 'https://outlook.office.com/evt-1' });

    const result = (await createCalendarEvent(
      { subject: 'Sync', start: '2026-06-15T09:00:00', end: '2026-06-15T09:30:00' },
      CONTEXT
    )) as Record<string, unknown>;

    expect(result).toEqual({
      success: true,
      event_id: 'evt-1',
      web_link: 'https://outlook.office.com/evt-1',
    });
    expect(result.join_url).toBeUndefined();

    const call = mockedAxios.request.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(call.data).toMatchObject({
      subject: 'Sync',
      start: { dateTime: '2026-06-15T09:00:00', timeZone: 'UTC' },
      end: { dateTime: '2026-06-15T09:30:00', timeZone: 'UTC' },
      isOnlineMeeting: false,
    });
    expect(call.data.onlineMeetingProvider).toBeUndefined();
    expect(call.data.attendees).toBeUndefined();
  });

  it('includes attendees, location, body, custom timezone, and join_url for online meetings', async () => {
    mockGraphResponse(201, {
      id: 'evt-2',
      webLink: 'https://outlook.office.com/evt-2',
      onlineMeeting: { joinUrl: 'https://teams.microsoft.com/l/meetup-join/evt-2' },
    });

    const result = (await createCalendarEvent(
      {
        subject: 'All-hands',
        body: 'Quarterly update',
        start: '2026-06-20T17:00:00',
        end: '2026-06-20T18:00:00',
        timezone: 'America/Los_Angeles',
        attendees: ['alice@contoso.com', 'bob@contoso.com'],
        location: 'Building 4',
        is_online_meeting: true,
      },
      CONTEXT
    )) as Record<string, unknown>;

    expect(result.join_url).toBe('https://teams.microsoft.com/l/meetup-join/evt-2');

    const call = mockedAxios.request.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(call.data).toMatchObject({
      body: { contentType: 'Text', content: 'Quarterly update' },
      start: { dateTime: '2026-06-20T17:00:00', timeZone: 'America/Los_Angeles' },
      location: { displayName: 'Building 4' },
      isOnlineMeeting: true,
      onlineMeetingProvider: 'teamsForBusiness',
    });
    expect(call.data.attendees).toEqual([
      { emailAddress: { address: 'alice@contoso.com' }, type: 'required' },
      { emailAddress: { address: 'bob@contoso.com' }, type: 'required' },
    ]);
  });
});

// ─── ms_publish_to_sharepoint ─────────────────────────────────────────────────

describe('ms_publish_to_sharepoint executor', () => {
  beforeEach(() => jest.clearAllMocks());

  it('throws VALIDATION_FAILED when required params are missing', async () => {
    await expectMatimoError(
      publishToSharepoint({ site_id: 's1', title: 't' }, CONTEXT),
      ErrorCode.VALIDATION_FAILED
    );
  });

  it('rejects an invalid content_type', async () => {
    await expectMatimoError(
      publishToSharepoint(
        { site_id: 's1', title: 't', content: 'c', content_type: 'markdown' },
        CONTEXT
      ),
      ErrorCode.VALIDATION_FAILED
    );
  });

  it('creates and publishes an HTML page by default, deriving a slug filename', async () => {
    mockGraphResponse(201, {
      id: 'page-1',
      webUrl: 'https://contoso.sharepoint.com/SitePages/q3-results.aspx',
    });
    mockGraphResponse(204, '');

    const result = (await publishToSharepoint(
      { site_id: 'site-1', title: 'Q3 Results!', content: '<h1>Great quarter</h1>' },
      CONTEXT
    )) as Record<string, unknown>;

    expect(result).toEqual({
      success: true,
      page_id: 'page-1',
      web_url: 'https://contoso.sharepoint.com/SitePages/q3-results.aspx',
      published: true,
    });
    expect(mockedAxios.request).toHaveBeenCalledTimes(2);

    const createCall = mockedAxios.request.mock.calls[0][0] as {
      url: string;
      data: Record<string, unknown>;
    };
    expect(createCall.url).toContain('/sites/site-1/pages');
    expect(createCall.data.name).toBe('q3-results.aspx');
    const webpart = (
      createCall.data.canvasLayout as {
        horizontalSections: Array<{ columns: Array<{ webparts: Array<{ innerHtml: string }> }> }>;
      }
    ).horizontalSections[0].columns[0].webparts[0];
    expect(webpart.innerHtml).toBe('<h1>Great quarter</h1>');

    const publishCall = mockedAxios.request.mock.calls[1][0] as { url: string };
    expect(publishCall.url).toContain(
      '/sites/site-1/pages/page-1/microsoft.graph.sitePage/publish'
    );
  });

  it('escapes plain-text content into a paragraph and skips publishing when publish: false', async () => {
    mockGraphResponse(201, {
      id: 'page-2',
      webUrl: 'https://contoso.sharepoint.com/SitePages/draft.aspx',
    });

    const result = (await publishToSharepoint(
      {
        site_id: 'site-1',
        title: 'Draft <Page>',
        content: 'Tom & Jerry said "hi"',
        content_type: 'text',
        publish: false,
      },
      CONTEXT
    )) as Record<string, unknown>;

    expect(result.published).toBe(false);
    expect(mockedAxios.request).toHaveBeenCalledTimes(1);

    const createCall = mockedAxios.request.mock.calls[0][0] as { data: Record<string, unknown> };
    const webpart = (
      createCall.data.canvasLayout as {
        horizontalSections: Array<{ columns: Array<{ webparts: Array<{ innerHtml: string }> }> }>;
      }
    ).horizontalSections[0].columns[0].webparts[0];
    expect(webpart.innerHtml).toBe('<p>Tom &amp; Jerry said &quot;hi&quot;</p>');
  });

  it('falls back to "page" when the title slug would be empty', async () => {
    mockGraphResponse(201, { id: 'page-3', webUrl: 'https://x' });
    mockGraphResponse(204, '');

    await publishToSharepoint({ site_id: 'site-1', title: '!!!', content: 'c' }, CONTEXT);

    const createCall = mockedAxios.request.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(createCall.data.name).toBe('page.aspx');
  });

  it('throws EXECUTION_FAILED when Graph does not return a page id', async () => {
    mockGraphResponse(201, {});

    await expectMatimoError(
      publishToSharepoint({ site_id: 's1', title: 't', content: 'c' }, CONTEXT),
      ErrorCode.EXECUTION_FAILED
    );
    expect(mockedAxios.request).toHaveBeenCalledTimes(1);
  });
});
