import axios from 'axios';
jest.mock('axios');

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { MatimoInstance } from '../../../core/src/matimo-instance';

interface ToolDefinition {
  name: string;
  description: string;
  version: string;
  parameters: Record<string, { type: string; required: boolean; description: string }>;
  execution: {
    type: string;
    method?: string;
    url?: string;
    headers?: Record<string, string>;
  };
  authentication: { type: string; provider?: string; scopes?: string[] };
  output_schema: { type: string; properties?: Record<string, unknown> };
  error_handling?: Record<string, unknown>;
}

describe('gmail-get-attachment YAML definition', () => {
  const defPath = path.join(__dirname, '../../tools/get-attachment/definition.yaml');
  let def: ToolDefinition;

  beforeAll(() => {
    def = yaml.load(fs.readFileSync(defPath, 'utf-8')) as ToolDefinition;
  });

  it('has correct name and version', () => {
    expect(def.name).toBe('gmail-get-attachment');
    expect(def.version).toBeDefined();
  });

  it('has a non-empty description', () => {
    expect(typeof def.description).toBe('string');
    expect(def.description.length).toBeGreaterThan(0);
  });

  it('has required parameters messageId and attachmentId', () => {
    expect(def.parameters.messageId).toBeDefined();
    expect(def.parameters.messageId.required).toBe(true);
    expect(def.parameters.messageId.type).toBe('string');

    expect(def.parameters.attachmentId).toBeDefined();
    expect(def.parameters.attachmentId.required).toBe(true);
    expect(def.parameters.attachmentId.type).toBe('string');
  });

  it('every parameter has a type and description', () => {
    Object.values(def.parameters).forEach((param) => {
      expect(param.type).toBeDefined();
      expect(['string', 'number', 'boolean', 'object', 'array']).toContain(param.type);
      expect(typeof param.description).toBe('string');
      expect(param.description.length).toBeGreaterThan(0);
    });
  });

  it('is a GET http execution against the Gmail API', () => {
    expect(def.execution.type).toBe('http');
    expect(def.execution.method).toBe('GET');
    expect(def.execution.url).toContain(
      'googleapis.com/gmail/v1/users/me/messages/{messageId}/attachments/{attachmentId}'
    );
  });

  it('sends a Bearer authorization header', () => {
    const headers = def.execution.headers || {};
    expect(headers.Authorization).toBe('Bearer {GMAIL_ACCESS_TOKEN}');
  });

  it('uses oauth2 authentication with the gmail.readonly scope, matching get-message', () => {
    expect(def.authentication.type).toBe('oauth2');
    expect(def.authentication.provider).toBe('google');
    expect(def.authentication.scopes).toContain('https://www.googleapis.com/auth/gmail.readonly');
  });

  it('does not request broader scopes than necessary', () => {
    expect(def.authentication.scopes).toHaveLength(1);
  });

  it('has an output_schema describing size and base64url data', () => {
    expect(def.output_schema.type).toBe('object');
    const props = def.output_schema.properties as Record<string, { type: string }>;
    expect(props.size).toBeDefined();
    expect(props.data).toBeDefined();
    expect(props.attachmentId).toBeDefined();
  });

  it('configures retry/backoff error handling', () => {
    expect(def.error_handling).toBeDefined();
    expect((def.error_handling as Record<string, unknown>).retry).toBeGreaterThan(0);
  });
});

describe('gmail-get-attachment execution', () => {
  let matimo: MatimoInstance;
  const mockedAxios = axios as jest.Mocked<typeof axios>;

  beforeAll(async () => {
    process.env.GMAIL_ACCESS_TOKEN = 'test-access-token';
    const toolsPath = path.join(__dirname, '../../tools');
    matimo = await MatimoInstance.init(toolsPath);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    jest.resetAllMocks();
    delete process.env.GMAIL_ACCESS_TOKEN;
  });

  it('calls the Gmail attachments endpoint with the correct URL, method, and auth header', async () => {
    mockedAxios.request = jest.fn().mockResolvedValue({
      status: 200,
      data: {
        attachmentId: 'ANGjdJ_xyz123',
        size: 1024,
        data: 'aGVsbG8gd29ybGQ',
      },
      headers: {},
    });

    const result = (await matimo.execute('gmail-get-attachment', {
      messageId: '187a65b7f3f2f11e',
      attachmentId: 'ANGjdJ_xyz123',
    })) as Record<string, unknown>;

    expect(mockedAxios.request).toHaveBeenCalledTimes(1);
    const callArg = mockedAxios.request.mock.calls[0][0] as Record<string, unknown>;
    expect(callArg.method).toBe('GET');
    expect(callArg.url).toBe(
      'https://www.googleapis.com/gmail/v1/users/me/messages/187a65b7f3f2f11e/attachments/ANGjdJ_xyz123'
    );
    const headers = callArg.headers as Record<string, unknown>;
    expect(headers.Authorization).toBe('Bearer test-access-token');

    const data = result.data as Record<string, unknown>;
    expect(data.size).toBe(1024);
    expect(data.data).toBe('aGVsbG8gd29ybGQ');
    expect(data.attachmentId).toBe('ANGjdJ_xyz123');
  });

  it('propagates an error when the Gmail API call fails', async () => {
    mockedAxios.request = jest.fn().mockRejectedValue(
      Object.assign(new Error('Request failed with status code 404'), {
        isAxiosError: true,
        response: {
          status: 404,
          data: { error: { message: 'Attachment not found' } },
        },
      })
    );

    await expect(
      matimo.execute('gmail-get-attachment', {
        messageId: 'missing-message',
        attachmentId: 'missing-attachment',
      })
    ).rejects.toBeDefined();
  });
});
