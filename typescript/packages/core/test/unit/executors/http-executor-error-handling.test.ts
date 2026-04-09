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

  it('throws MatimoError with statusCode and details when axios returns an error response', async () => {
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
      code: ErrorCode.EXECUTION_FAILED,
      details: expect.objectContaining({ statusCode: 401 }),
    });
  });

  it('throws MatimoError with statusCode 500 when axios fails without response (network error)', async () => {
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
      code: ErrorCode.EXECUTION_FAILED,
      details: expect.objectContaining({ statusCode: 500 }),
    });
  });
});
