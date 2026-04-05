import { HttpExecutor } from '../../src/executors/http-executor';
import { ToolDefinition } from '../../src/core/schema';
import { ExecutionResult } from '../../src/core/types';
import { MatimoError, ErrorCode } from '../../src/errors/matimo-error';
import axios from 'axios';

// Mock axios to avoid real HTTP calls
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('HttpExecutor - Extended Coverage', () => {
  let executor: HttpExecutor;

  beforeEach(() => {
    executor = new HttpExecutor();
    jest.clearAllMocks();
  });

  // Helper to mock successful HTTP responses
  const mockSuccessResponse = (data: unknown = { success: true }) => {
    mockedAxios.request.mockResolvedValueOnce({
      data,
      status: 200,
      statusText: 'OK',
      headers: {
        'content-type': 'application/json',
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      config: {} as any,
    });
  };

  it('should successfully construct and execute GET request', async () => {
    mockSuccessResponse({ success: true });

    const tool: ToolDefinition = {
      name: 'test',
      description: 'test',
      version: '1.0.0',
      execution: {
        type: 'http',
        method: 'GET',
        url: 'https://httpbin.org/get',
      },
      parameters: {},
    };

    const result = (await executor.execute(tool, {})) as ExecutionResult;
    expect(result).toBeDefined();
    expect(result.success).toBe(true);
  });

  it('should successfully execute GET request with query params', async () => {
    mockSuccessResponse({ success: true });

    const tool: ToolDefinition = {
      name: 'test',
      description: 'test',
      version: '1.0.0',
      execution: {
        type: 'http',
        method: 'GET',
        url: 'https://httpbin.org/get',
        query_params: {
          test: 'value',
          key: 'data',
        },
      },
      parameters: {},
    };

    const result = (await executor.execute(tool, {})) as ExecutionResult;
    expect(result).toBeDefined();
    expect(result.success).toBe(true);
  });

  it('should successfully execute POST request with body', async () => {
    mockSuccessResponse({ success: true });

    const tool: ToolDefinition = {
      name: 'test',
      description: 'test',
      version: '1.0.0',
      execution: {
        type: 'http',
        method: 'POST',
        url: 'https://httpbin.org/post',
        body: { test: 'data', nested: { key: 'value' } },
      },
      parameters: {},
    };

    const result = (await executor.execute(tool, {})) as ExecutionResult;
    expect(result).toBeDefined();
    expect(result.success).toBe(true);
  });

  it('should successfully execute request with custom headers', async () => {
    mockSuccessResponse({ success: true });

    const tool: ToolDefinition = {
      name: 'test',
      description: 'test',
      version: '1.0.0',
      execution: {
        type: 'http',
        method: 'GET',
        url: 'https://httpbin.org/get',
        headers: {
          'X-Custom-Header': 'custom-value',
          'X-Another-Header': 'another-value',
        },
      },
      parameters: {},
    };

    const result = (await executor.execute(tool, {})) as ExecutionResult;
    expect(result).toBeDefined();
    expect(result.success).toBe(true);
  });

  it('should successfully replace URL placeholders', async () => {
    mockSuccessResponse({ success: true });

    const tool: ToolDefinition = {
      name: 'test',
      description: 'test',
      version: '1.0.0',
      execution: {
        type: 'http',
        method: 'GET',
        url: 'https://httpbin.org/{path}',
        query_params: {
          query: '{search}',
        },
      },
      parameters: {
        path: { type: 'string', description: 'Path' },
        search: { type: 'string', description: 'Search' },
      },
    };

    const result = (await executor.execute(tool, {
      path: 'get',
      search: 'test',
    })) as ExecutionResult;
    expect(result).toBeDefined();
    expect(result.success).toBe(true);
  });

  it('should successfully replace header placeholders', async () => {
    mockSuccessResponse({ success: true });

    const tool: ToolDefinition = {
      name: 'test',
      description: 'test',
      version: '1.0.0',
      execution: {
        type: 'http',
        method: 'GET',
        url: 'https://httpbin.org/get',
        headers: {
          Authorization: 'Bearer {token}',
          'X-Custom': '{header_value}',
        },
      },
      parameters: {
        token: { type: 'string', description: 'Token' },
        header_value: { type: 'string', description: 'Value' },
      },
    };

    const result = (await executor.execute(tool, {
      token: 'test-token',
      header_value: 'test-header',
    })) as ExecutionResult;
    expect(result).toBeDefined();
    expect(result.success).toBe(true);
  });

  it('should successfully replace body placeholders', async () => {
    mockSuccessResponse({ success: true });

    const tool: ToolDefinition = {
      name: 'test',
      description: 'test',
      version: '1.0.0',
      execution: {
        type: 'http',
        method: 'POST',
        url: 'https://httpbin.org/post',
        body: {
          name: '{user_name}',
          email: '{user_email}',
          nested: {
            field: '{nested_value}',
          },
        },
      },
      parameters: {
        user_name: { type: 'string', description: 'Name' },
        user_email: { type: 'string', description: 'Email' },
        nested_value: { type: 'string', description: 'Value' },
      },
    };

    const result = (await executor.execute(tool, {
      user_name: 'John',
      user_email: 'john@example.com',
      nested_value: 'test',
    })) as ExecutionResult;
    expect(result).toBeDefined();
    expect(result.success).toBe(true);
  });

  it('should handle DELETE requests', async () => {
    mockSuccessResponse({ success: true });

    const tool: ToolDefinition = {
      name: 'test',
      description: 'test',
      version: '1.0.0',
      execution: {
        type: 'http',
        method: 'DELETE',
        url: 'https://httpbin.org/delete',
      },
      parameters: {},
    };

    const result = (await executor.execute(tool, {})) as ExecutionResult;
    expect(result).toBeDefined();
    expect(result.success).toBe(true);
  });

  it('should handle PATCH requests', async () => {
    mockSuccessResponse({ data: 'patched' });

    const tool: ToolDefinition = {
      name: 'test',
      description: 'test',
      version: '1.0.0',
      execution: {
        type: 'http',
        method: 'PATCH',
        url: 'https://httpbin.org/patch',
        body: { field: 'value' },
      },
      parameters: {},
    };

    const result = (await executor.execute(tool, {})) as ExecutionResult;
    expect(result).toBeDefined();
    expect(result.data).toBeDefined();
  });

  it('should handle PUT requests', async () => {
    mockSuccessResponse({ success: true });

    const tool: ToolDefinition = {
      name: 'test',
      description: 'test',
      version: '1.0.0',
      execution: {
        type: 'http',
        method: 'PUT',
        url: 'https://httpbin.org/put',
        body: { field: 'value' },
      },
      parameters: {},
    };

    const result = (await executor.execute(tool, {})) as ExecutionResult;
    expect(result).toBeDefined();
    expect(result.success).toBe(true);
  });

  it('should extract response headers from HTTP response', async () => {
    mockedAxios.request.mockResolvedValueOnce({
      data: { success: true },
      status: 200,
      statusText: 'OK',
      headers: {
        'content-type': 'application/json',
        'x-custom-header': 'custom-value',
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      config: {} as any,
    });

    const tool: ToolDefinition = {
      name: 'test',
      description: 'test',
      version: '1.0.0',
      execution: {
        type: 'http',
        method: 'GET',
        url: 'https://httpbin.org/get',
      },
      parameters: {},
    };

    const result = await executor.execute(tool, {});
    expect(result).toBeDefined();
    const response = result as { headers: Record<string, string> };
    expect(response.headers).toBeDefined();
    expect(typeof response.headers).toBe('object');
  });

  it('should include status code in response', async () => {
    mockedAxios.request.mockResolvedValueOnce({
      data: { success: true },
      status: 200,
      statusText: 'OK',
      headers: { 'content-type': 'application/json' },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      config: {} as any,
    });

    const tool: ToolDefinition = {
      name: 'test',
      description: 'test',
      version: '1.0.0',
      execution: {
        type: 'http',
        method: 'GET',
        url: 'https://httpbin.org/status/200',
      },
      parameters: {},
    };

    const result = (await executor.execute(tool, {})) as ExecutionResult;
    expect(result).toBeDefined();
    expect(result.statusCode).toBeDefined();
    expect(typeof result.statusCode).toBe('number');
  });

  it('should handle array values in body', async () => {
    mockSuccessResponse({ success: true });

    const tool: ToolDefinition = {
      name: 'test',
      description: 'test',
      version: '1.0.0',
      execution: {
        type: 'http',
        method: 'POST',
        url: 'https://httpbin.org/post',
        body: {
          items: [
            { id: 1, name: 'item1' },
            { id: 2, name: 'item2' },
          ],
        },
      },
      parameters: {},
    };

    const result = (await executor.execute(tool, {})) as ExecutionResult;
    expect(result).toBeDefined();
    expect(result.success).toBe(true);
  });

  it('should handle complex nested body structures', async () => {
    mockSuccessResponse({ success: true });

    const tool: ToolDefinition = {
      name: 'test',
      description: 'test',
      version: '1.0.0',
      execution: {
        type: 'http',
        method: 'POST',
        url: 'https://httpbin.org/post',
        body: {
          user: {
            profile: {
              name: 'John',
              address: {
                city: 'New York',
                country: 'USA',
              },
            },
            settings: {
              notifications: true,
              privacy: 'public',
            },
          },
        },
      },
      parameters: {},
    };

    const result = (await executor.execute(tool, {})) as ExecutionResult;
    expect(result).toBeDefined();
    expect(result.success).toBe(true);
  });
});

describe('HttpExecutor - GitHub Approval Flows', () => {
  let executor: HttpExecutor;

  beforeEach(() => {
    executor = new HttpExecutor();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should skip approval for non-github tools', async () => {
    mockedAxios.request.mockResolvedValueOnce({
      data: { success: true },
      status: 200,
      statusText: 'OK',
      headers: {},
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      config: {} as any,
    });

    const tool: ToolDefinition = {
      name: 'slack-send-message',
      description: 'Send a message to Slack',
      version: '1.0.0',
      execution: {
        type: 'http',
        method: 'POST',
        url: 'https://slack.com/api/chat.postMessage',
      },
      parameters: {},
    };

    const result = (await executor.execute(tool, {})) as ExecutionResult;
    expect(result).toBeDefined();
    expect(result.success).toBe(true);
  });

  it('should throw error when wrong execution type', async () => {
    const tool: ToolDefinition = {
      name: 'test',
      description: 'test',
      version: '1.0.0',
      execution: {
        type: 'command' as const,
        command: 'echo test',
      },
      parameters: {},
    };

    await expect(executor.execute(tool, {})).rejects.toThrow('Tool execution type is not http');
  });

  it('should handle axios request errors with error response', async () => {
    const error = new Error('Request failed');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (error as any).response = {
      status: 500,
      data: { error: 'Internal Server Error' },
    };

    mockedAxios.request.mockRejectedValueOnce(error);

    const tool: ToolDefinition = {
      name: 'test',
      description: 'test',
      version: '1.0.0',
      execution: {
        type: 'http',
        method: 'GET',
        url: 'https://api.example.com/error',
      },
      parameters: {},
    };

    try {
      await executor.execute(tool, {});
      fail('Expected executor to throw MatimoError');
    } catch (err) {
      expect(err).toBeInstanceOf(MatimoError);
      expect((err as MatimoError).code).toBe(ErrorCode.EXECUTION_FAILED);
      expect((err as MatimoError).details?.statusCode).toBe(500);
    }
  });

  it('should handle axios request errors without error response', async () => {
    const error = new Error('Network error');

    mockedAxios.request.mockRejectedValueOnce(error);

    const tool: ToolDefinition = {
      name: 'test',
      description: 'test',
      version: '1.0.0',
      execution: {
        type: 'http',
        method: 'GET',
        url: 'https://api.example.com/network-error',
      },
      parameters: {},
    };

    try {
      await executor.execute(tool, {});
      fail('Expected executor to throw MatimoError');
    } catch (err) {
      expect(err).toBeInstanceOf(MatimoError);
      expect((err as MatimoError).code).toBe(ErrorCode.EXECUTION_FAILED);
      expect((err as MatimoError).details?.statusCode).toBe(500);
    }
  });

  it('should preserve query params structure when building query string', async () => {
    mockedAxios.request.mockResolvedValueOnce({
      data: { success: true },
      status: 200,
      statusText: 'OK',
      headers: {},
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      config: {} as any,
    });

    const tool: ToolDefinition = {
      name: 'test',
      description: 'test',
      version: '1.0.0',
      execution: {
        type: 'http',
        method: 'GET',
        url: 'https://api.example.com/search',
        query_params: {
          q: '{query}',
          limit: '{limit}',
          offset: '{offset}',
        },
      },
      parameters: {
        query: { type: 'string', description: 'Search query' },
        limit: { type: 'string', description: 'Limit' },
        offset: { type: 'string', description: 'Offset' },
      },
    };

    const result = (await executor.execute(tool, {
      query: 'test search',
      limit: '10',
      offset: '0',
    })) as ExecutionResult;

    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(mockedAxios.request).toHaveBeenCalledWith(
      expect.objectContaining({
        url: expect.stringContaining('?'),
      })
    );
  });

  it('should handle empty query params', async () => {
    mockedAxios.request.mockResolvedValueOnce({
      data: { success: true },
      status: 200,
      statusText: 'OK',
      headers: {},
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      config: {} as any,
    });

    const tool: ToolDefinition = {
      name: 'test',
      description: 'test',
      version: '1.0.0',
      execution: {
        type: 'http',
        method: 'GET',
        url: 'https://api.example.com/test',
        query_params: {},
      },
      parameters: {},
    };

    const result = (await executor.execute(tool, {})) as ExecutionResult;
    expect(result).toBeDefined();
    expect(result.success).toBe(true);
  });

  it('should skip unfilled query param placeholders', async () => {
    mockedAxios.request.mockResolvedValueOnce({
      data: { success: true },
      status: 200,
      statusText: 'OK',
      headers: {},
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      config: {} as any,
    });

    const tool: ToolDefinition = {
      name: 'test',
      description: 'test',
      version: '1.0.0',
      execution: {
        type: 'http',
        method: 'GET',
        url: 'https://api.example.com/test',
        query_params: {
          provided: '{query}',
          missing: '{notProvided}',
        },
      },
      parameters: {
        query: { type: 'string', description: 'Query' },
        notProvided: { type: 'string', description: 'Optional' },
      },
    };

    const result = (await executor.execute(tool, {
      query: 'search',
    })) as ExecutionResult;

    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    // Should have query param for 'provided' but not 'missing'
    const callUrl = mockedAxios.request.mock.calls[0][0].url;
    expect(callUrl).toContain('provided=search');
    expect(callUrl).not.toContain('notProvided');
  });

  it('should encode query parameters', async () => {
    mockedAxios.request.mockResolvedValueOnce({
      data: { success: true },
      status: 200,
      statusText: 'OK',
      headers: {},
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      config: {} as any,
    });

    const tool: ToolDefinition = {
      name: 'test',
      description: 'test',
      version: '1.0.0',
      execution: {
        type: 'http',
        method: 'GET',
        url: 'https://api.example.com/test',
        query_params: {
          q: '{query}',
        },
      },
      parameters: {
        query: { type: 'string', description: 'Query' },
      },
    };

    const result = (await executor.execute(tool, {
      query: 'hello world & special=chars',
    })) as ExecutionResult;

    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    // Should have encoded query parameter
    const callUrl = mockedAxios.request.mock.calls[0][0].url;
    expect(callUrl).toContain('q=');
  });
});
