import axios from 'axios';
import { HttpExecutor } from '../../../src/executors/http-executor';
import { ErrorCode } from '../../../src/errors/matimo-error';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('HttpExecutor - Error Handling (Issue #40)', () => {
  let executor: HttpExecutor;

  beforeEach(() => {
    executor = new HttpExecutor();
    mockedAxios.request.mockReset();
  });

  it('throws MatimoError classified as AUTH_FAILED with statusCode and details for a 401 response', async () => {
    const axiosError = {
      isAxiosError: true,
      message: 'Request failed with status code 401',
      response: {
        status: 401,
        data: { error: 'Invalid Credentials' },
        headers: {},
      },
    } as unknown as import('axios').AxiosError;

    mockedAxios.request.mockRejectedValue(axiosError);

    const tool = {
      execution: {
        type: 'http',
        method: 'GET',
        url: 'https://api.example.com/protected',
      },
      parameters: {},
    } as unknown as import('../../../src/core/schema').ToolDefinition;

    await expect(executor.execute(tool, {})).rejects.toMatchObject({
      name: 'MatimoError',
      code: ErrorCode.AUTH_FAILED,
      details: expect.objectContaining({ statusCode: 401, retryable: false }),
    });
  });

  it('throws MatimoError classified as NETWORK_ERROR when axios fails without a response', async () => {
    const axiosError = {
      isAxiosError: true,
      message: 'Network Error',
    } as unknown as import('axios').AxiosError;

    mockedAxios.request.mockRejectedValue(axiosError);

    const tool2 = {
      execution: {
        type: 'http',
        method: 'GET',
        url: 'https://api.example.com/unreachable',
      },
      parameters: {},
    } as unknown as import('../../../src/core/schema').ToolDefinition;

    await expect(executor.execute(tool2, {})).rejects.toMatchObject({
      name: 'MatimoError',
      code: ErrorCode.NETWORK_ERROR,
      details: expect.objectContaining({ retryable: true }),
    });
  });

  it('throws MatimoError classified as TIMEOUT when axios times out', async () => {
    const axiosError = {
      isAxiosError: true,
      code: 'ECONNABORTED',
      message: 'timeout of 5000ms exceeded',
    } as unknown as import('axios').AxiosError;

    mockedAxios.request.mockRejectedValue(axiosError);

    const tool = {
      execution: {
        type: 'http',
        method: 'GET',
        url: 'https://api.example.com/slow',
      },
      parameters: {},
    } as unknown as import('../../../src/core/schema').ToolDefinition;

    await expect(executor.execute(tool, {})).rejects.toMatchObject({
      name: 'MatimoError',
      code: ErrorCode.TIMEOUT,
      details: expect.objectContaining({ retryable: true }),
    });
  });

  it('throws MatimoError with AUTH_FAILED for a 403 response', async () => {
    const axiosError = {
      isAxiosError: true,
      message: 'Request failed with status code 403',
      response: {
        status: 403,
        data: { error: 'Forbidden' },
        headers: {},
      },
    } as unknown as import('axios').AxiosError;

    mockedAxios.request.mockRejectedValue(axiosError);

    const tool = {
      execution: {
        type: 'http',
        method: 'GET',
        url: 'https://api.example.com/forbidden',
      },
      parameters: {},
    } as unknown as import('../../../src/core/schema').ToolDefinition;

    await expect(executor.execute(tool, {})).rejects.toMatchObject({
      name: 'MatimoError',
      code: ErrorCode.AUTH_FAILED,
      details: expect.objectContaining({ statusCode: 403 }),
    });
  });

  it('throws MatimoError with RATE_LIMIT_EXCEEDED for a 429 response', async () => {
    const axiosError = {
      isAxiosError: true,
      message: 'Request failed with status code 429',
      response: {
        status: 429,
        data: { error: 'Too Many Requests' },
        headers: {},
      },
    } as unknown as import('axios').AxiosError;

    mockedAxios.request.mockRejectedValue(axiosError);

    const tool = {
      execution: {
        type: 'http',
        method: 'GET',
        url: 'https://api.example.com/limited',
      },
      parameters: {},
    } as unknown as import('../../../src/core/schema').ToolDefinition;

    await expect(executor.execute(tool, {})).rejects.toMatchObject({
      name: 'MatimoError',
      code: ErrorCode.RATE_LIMIT_EXCEEDED,
      details: expect.objectContaining({ statusCode: 429, retryable: true }),
    });
  });
});
