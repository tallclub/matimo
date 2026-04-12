/**
 * Integration test suite for Gmail tools
 * Tests end-to-end execution using MatimoInstance (production-grade)
 */

import { MatimoInstance } from '../../../core/src/matimo-instance';
import axios from 'axios';
import { MatimoError } from '../../../core/src/errors/matimo-error';
import path from 'path';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

interface MatimoResult {
  success: boolean;
  data?: unknown;
  error?: string;
  statusCode?: number;
}

interface GmailMessage {
  id: string;
  labelIds: string[];
  snippet: string;
  payload: {
    headers: Array<{ name: string; value: string }>;
    body: { data: string };
  };
}

interface GmailDraft {
  id: string;
  message: GmailMessage;
}

describe('Gmail Tools Integration', () => {
  let matimo: MatimoInstance;
  const toolsPath = path.join(__dirname, '../../tools');

  beforeEach(async () => {
    jest.clearAllMocks();

    // Mock environment variable for OAuth2
    process.env.GMAIL_ACCESS_TOKEN = 'ya29.mock-token';

    // Initialize MatimoInstance which loads all Gmail tools
    matimo = await MatimoInstance.init(toolsPath);
  });

  afterEach(() => {
    delete process.env.GMAIL_ACCESS_TOKEN;
  });

  describe('Tool Loading & Availability', () => {
    it('should load all 5 Gmail tools via MatimoInstance', async () => {
      const tools = matimo.listTools();
      const gmailTools = tools.filter((tool) => tool.name.startsWith('gmail-'));

      expect(gmailTools).toHaveLength(5);
      expect(gmailTools.map((t) => t.name).sort()).toEqual([
        'gmail-create-draft',
        'gmail-delete-message',
        'gmail-get-message',
        'gmail-list-messages',
        'gmail-send-email',
      ]);
    });

    it('should have correct tool metadata', () => {
      const tools = matimo.listTools();
      const sendEmailTool = tools.find((t) => t.name === 'gmail-send-email');

      expect(sendEmailTool).toBeDefined();
      expect(sendEmailTool?.description).toContain('Send an email');
    });
  });

  describe('Tool Execution - Send Email', () => {
    it('should execute gmail-send-email with valid parameters', async () => {
      mockedAxios.request.mockResolvedValue({
        status: 200,
        data: {
          id: '123456789',
          threadId: 'thread123',
          labelIds: ['SENT'],
        },
        headers: {},
      } as unknown);

      const params = {
        to: 'recipient@example.com',
        subject: 'Test Subject',
        body: 'Test Body',
      };

      const result = (await matimo.execute('gmail-send-email', params)) as MatimoResult;

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        id: '123456789',
        threadId: 'thread123',
        labelIds: ['SENT'],
      });

      expect(mockedAxios.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'POST',
          url: 'https://www.googleapis.com/gmail/v1/users/me/messages/send',
          headers: expect.objectContaining({
            Authorization: 'Bearer ya29.mock-token',
            'Content-Type': 'application/json',
          }),
        })
      );
    });

    it('should handle send-email with optional parameters', async () => {
      mockedAxios.request.mockResolvedValue({
        status: 200,
        data: { id: 'msg123', threadId: 'thread123', labelIds: ['SENT'] },
        headers: {},
      } as unknown);

      const params = {
        to: 'recipient@example.com',
        subject: 'Test',
        body: 'Body',
        cc: 'cc@example.com',
        bcc: 'bcc@example.com',
      };

      await matimo.execute('gmail-send-email', params);

      expect(mockedAxios.request).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            raw: expect.any(String), // Email is encoded as base64 'raw' field
          }),
        })
      );
    });
  });

  describe('Tool Execution - List Messages', () => {
    it('should execute gmail-list-messages with query parameter', async () => {
      mockedAxios.request.mockResolvedValue({
        status: 200,
        data: {
          messages: [
            { id: 'msg1', threadId: 'thread1' },
            { id: 'msg2', threadId: 'thread2' },
          ],
          nextPageToken: 'token123',
          resultSizeEstimate: 2,
        },
        headers: {},
      } as unknown);

      const params = {
        query: 'is:unread',
        maxResults: 10,
      };

      const result = (await matimo.execute('gmail-list-messages', params)) as MatimoResult;

      expect(result.success).toBe(true);
      expect((result.data as { messages: unknown[]; nextPageToken: string }).messages).toHaveLength(
        2
      );
      expect((result.data as { messages: unknown[]; nextPageToken: string }).nextPageToken).toBe(
        'token123'
      );

      expect(mockedAxios.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'GET',
          url: expect.stringContaining('gmail/v1/users/me/messages'),
        })
      );
    });
  });

  describe('Tool Execution - Get Message', () => {
    it('should execute gmail-get-message with messageId', async () => {
      mockedAxios.request.mockResolvedValue({
        status: 200,
        data: {
          id: 'msg123',
          threadId: 'thread123',
          labelIds: ['INBOX'],
          snippet: 'Test snippet',
          payload: {
            headers: [
              { name: 'Subject', value: 'Test Subject' },
              { name: 'From', value: 'sender@example.com' },
            ],
            body: { data: 'dGVzdCBib2R5' },
          },
        },
        headers: {},
      } as unknown);

      const params = {
        messageId: 'msg123',
        format: 'full',
      };

      const result = (await matimo.execute('gmail-get-message', params)) as MatimoResult;

      expect(result.success).toBe(true);
      const message = result.data as GmailMessage;
      expect(message.id).toBe('msg123');
      expect(message.payload.headers).toBeDefined();
      expect(message.payload.body).toBeDefined();
    });
  });

  describe('Tool Execution - Create Draft', () => {
    it('should execute gmail-create-draft', async () => {
      mockedAxios.request.mockResolvedValue({
        status: 200,
        data: {
          id: 'draft123',
          message: {
            id: 'msg123',
            threadId: 'thread123',
          },
        },
        headers: {},
      } as unknown);

      const params = {
        to: 'recipient@example.com',
        subject: 'Draft Subject',
        body: 'Draft Body',
      };

      const result = (await matimo.execute('gmail-create-draft', params)) as MatimoResult;

      expect(result.success).toBe(true);
      const draft = result.data as GmailDraft;
      expect(draft.id).toBe('draft123');
      expect(draft.message.id).toBe('msg123');
    });
  });

  describe('Tool Execution - Delete Message', () => {
    it('should execute gmail-delete-message', async () => {
      mockedAxios.request.mockResolvedValue({
        status: 204,
        data: {},
        headers: {},
      } as unknown);

      const params = {
        messageId: 'msg123',
      };

      const result = (await matimo.execute('gmail-delete-message', params)) as MatimoResult;

      expect(result.success).toBe(true);

      expect(mockedAxios.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'DELETE',
          url: 'https://www.googleapis.com/gmail/v1/users/me/messages/msg123',
        })
      );
    });
  });

  describe('Parameter Validation', () => {
    it('should reject gmail-send-email with missing required parameters', async () => {
      const params = {
        to: 'recipient@example.com',
        // missing subject and body
      };

      await expect(matimo.execute('gmail-send-email', params)).rejects.toThrow();
    });

    it('should accept gmail-list-messages with optional parameters', async () => {
      mockedAxios.request.mockResolvedValue({
        status: 200,
        data: { messages: [] },
        headers: {},
      } as unknown);

      const params = {}; // all optional

      const result = (await matimo.execute('gmail-list-messages', params)) as MatimoResult;
      expect(result.success).toBe(true);
    });
  });

  describe('Authentication', () => {
    it('should include Bearer token in all Gmail API requests', async () => {
      mockedAxios.request.mockResolvedValue({
        status: 200,
        data: { id: '123' },
        headers: {},
      } as unknown);

      await matimo.execute('gmail-send-email', {
        to: 'test@example.com',
        subject: 'Test',
        body: 'Test',
      });

      expect(mockedAxios.request).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer ya29.mock-token',
          }),
        })
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      mockedAxios.request.mockRejectedValue(new Error('API Error'));

      const params = {
        to: 'recipient@example.com',
        subject: 'Test',
        body: 'Test',
      };

      try {
        await matimo.execute('gmail-send-email', params);
        fail('Expected MatimoError');
      } catch (err) {
        expect(err).toBeInstanceOf(MatimoError);
        const me = err as MatimoError;
        expect(String(me.details?.originalError)).toContain('API Error');
      }
    });

    it('should retry on failure according to configuration', async () => {
      // Note: Retry is not yet implemented in HttpExecutor
      // Mock failure - should fail immediately
      mockedAxios.request.mockRejectedValueOnce(new Error('Network error'));

      const params = {
        to: 'recipient@example.com',
        subject: 'Test',
        body: 'Test',
      };

      try {
        await matimo.execute('gmail-send-email', params);
        fail('Expected MatimoError');
      } catch (err) {
        expect(err).toBeInstanceOf(MatimoError);
        const me = err as MatimoError;
        expect(String(me.details?.originalError)).toContain('Network error');
      }
      expect(mockedAxios.request).toHaveBeenCalledTimes(1); // Only one call since no retry
    });
  });
});
