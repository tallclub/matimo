/**
 * Unit tests for the shared Microsoft Graph helper module.
 */
import axios from 'axios';
import { MatimoError, ErrorCode } from '@matimo/core';
import {
  GRAPH_BASE_URL,
  getAccessToken,
  requireParams,
  mapGraphError,
  graphRequest,
} from '../../tools/graph-client';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('graph-client', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.MICROSOFT_GRAPH_ACCESS_TOKEN;
  });

  describe('GRAPH_BASE_URL', () => {
    it('points at the v1.0 Graph endpoint', () => {
      expect(GRAPH_BASE_URL).toBe('https://graph.microsoft.com/v1.0');
    });
  });

  describe('getAccessToken', () => {
    it('reads the token from context.credentials first', () => {
      const token = getAccessToken({ credentials: { MICROSOFT_GRAPH_ACCESS_TOKEN: 'ctx-token' } });
      expect(token).toBe('ctx-token');
    });

    it('falls back to the environment variable', () => {
      process.env.MICROSOFT_GRAPH_ACCESS_TOKEN = 'env-token';
      expect(getAccessToken(undefined)).toBe('env-token');
    });

    it('prefers context credentials over the environment variable', () => {
      process.env.MICROSOFT_GRAPH_ACCESS_TOKEN = 'env-token';
      const token = getAccessToken({ credentials: { MICROSOFT_GRAPH_ACCESS_TOKEN: 'ctx-token' } });
      expect(token).toBe('ctx-token');
    });

    it('throws AUTH_FAILED when no token is available', () => {
      try {
        getAccessToken(undefined);
        throw new Error('expected getAccessToken to throw');
      } catch (error) {
        expect(error).toBeInstanceOf(MatimoError);
        expect((error as MatimoError).code).toBe(ErrorCode.AUTH_FAILED);
        expect((error as MatimoError).message).toContain('MICROSOFT_GRAPH_ACCESS_TOKEN');
      }
    });

    it('throws AUTH_FAILED when context.credentials is present but empty', () => {
      try {
        getAccessToken({ credentials: {} });
        throw new Error('expected getAccessToken to throw');
      } catch (error) {
        expect(error).toBeInstanceOf(MatimoError);
        expect((error as MatimoError).code).toBe(ErrorCode.AUTH_FAILED);
      }
    });
  });

  describe('requireParams', () => {
    it('does not throw when all required params are present', () => {
      expect(() => requireParams({ a: '1', b: 2 }, ['a', 'b'], 'tool')).not.toThrow();
    });

    it('throws VALIDATION_FAILED listing every missing param', () => {
      try {
        requireParams({ a: '1', b: '', c: null }, ['a', 'b', 'c', 'd'], 'my_tool');
        throw new Error('expected requireParams to throw');
      } catch (error) {
        expect(error).toBeInstanceOf(MatimoError);
        const matimoError = error as MatimoError;
        expect(matimoError.code).toBe(ErrorCode.VALIDATION_FAILED);
        expect(matimoError.message).toContain('my_tool');
        expect(matimoError.message).toContain('b, c, d');
        expect(matimoError.details?.missingParams).toEqual(['b', 'c', 'd']);
      }
    });
  });

  describe('mapGraphError', () => {
    it('maps 401 and 403 to AUTH_FAILED', () => {
      expect(mapGraphError(401, {}, undefined, 'Resource').code).toBe(ErrorCode.AUTH_FAILED);
      expect(mapGraphError(403, {}, undefined, 'Resource').code).toBe(ErrorCode.AUTH_FAILED);
    });

    it('maps 404 to FILE_NOT_FOUND and includes the resource type in the message', () => {
      const error = mapGraphError(404, {}, undefined, 'Drive item');
      expect(error.code).toBe(ErrorCode.FILE_NOT_FOUND);
      expect(error.message).toContain('Drive item');
    });

    it('maps 429 to RATE_LIMIT_EXCEEDED and captures retry-after', () => {
      const error = mapGraphError(429, {}, { 'retry-after': '30' }, 'Resource');
      expect(error.code).toBe(ErrorCode.RATE_LIMIT_EXCEEDED);
      expect(error.details?.retryAfterSeconds).toBe(30);
    });

    it('maps 429 without a retry-after header to undefined retryAfterSeconds', () => {
      const error = mapGraphError(429, {}, undefined, 'Resource');
      expect(error.code).toBe(ErrorCode.RATE_LIMIT_EXCEEDED);
      expect(error.details?.retryAfterSeconds).toBeUndefined();
    });

    it('maps 500 and 503 to EXECUTION_FAILED', () => {
      expect(mapGraphError(500, {}, undefined, 'Resource').code).toBe(ErrorCode.EXECUTION_FAILED);
      expect(mapGraphError(503, {}, undefined, 'Resource').code).toBe(ErrorCode.EXECUTION_FAILED);
    });

    it('maps any other status to EXECUTION_FAILED with the status code in the message', () => {
      const error = mapGraphError(418, {}, undefined, 'Resource');
      expect(error.code).toBe(ErrorCode.EXECUTION_FAILED);
      expect(error.message).toContain('418');
    });

    it('captures the Graph error body in details.graphError', () => {
      const error = mapGraphError(
        404,
        { error: { code: 'itemNotFound', message: 'The item was not found' } },
        undefined,
        'Drive item'
      );
      expect(error.details?.graphError).toEqual({
        code: 'itemNotFound',
        message: 'The item was not found',
      });
    });
  });

  describe('graphRequest', () => {
    it('returns response data on success', async () => {
      mockedAxios.request.mockResolvedValue({
        status: 200,
        data: { value: [1, 2, 3] },
        headers: {},
      });

      const result = await graphRequest({ method: 'GET', path: '/me/messages', token: 'tok' });

      expect(result).toEqual({ value: [1, 2, 3] });
      expect(mockedAxios.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'GET',
          url: 'https://graph.microsoft.com/v1.0/me/messages',
          headers: expect.objectContaining({ Authorization: 'Bearer tok' }),
        })
      );
    });

    it('builds a query string from provided query params, skipping empty values', async () => {
      mockedAxios.request.mockResolvedValue({ status: 200, data: {}, headers: {} });

      await graphRequest({
        method: 'GET',
        path: '/me/messages',
        token: 'tok',
        query: { $top: 5, $filter: undefined, $search: '' },
      });

      expect(mockedAxios.request).toHaveBeenCalledWith(
        expect.objectContaining({ url: 'https://graph.microsoft.com/v1.0/me/messages?%24top=5' })
      );
    });

    it('returns null for empty/204 responses when allowEmptyResponse is set', async () => {
      mockedAxios.request.mockResolvedValue({ status: 204, data: '', headers: {} });

      const result = await graphRequest({
        method: 'POST',
        path: '/me/messages/123/send',
        token: 'tok',
        allowEmptyResponse: true,
      });

      expect(result).toBeNull();
    });

    it('sends Buffer bodies without a JSON content-type and respects explicit headers', async () => {
      mockedAxios.request.mockResolvedValue({ status: 201, data: { id: 'abc' }, headers: {} });
      const buffer = Buffer.from('hello');

      await graphRequest({
        method: 'PUT',
        path: '/drives/d/items/root:/file.txt:/content',
        token: 'tok',
        body: buffer,
        headers: { 'Content-Type': 'application/octet-stream' },
      });

      const callArgs = mockedAxios.request.mock.calls[0][0] as { headers: Record<string, string> };
      expect(callArgs.headers['Content-Type']).toBe('application/octet-stream');
    });

    it('adds a JSON content-type for plain object bodies', async () => {
      mockedAxios.request.mockResolvedValue({ status: 200, data: {}, headers: {} });

      await graphRequest({
        method: 'POST',
        path: '/me/events',
        token: 'tok',
        body: { subject: 'Standup' },
      });

      const callArgs = mockedAxios.request.mock.calls[0][0] as { headers: Record<string, string> };
      expect(callArgs.headers['Content-Type']).toBe('application/json');
    });

    it('throws NETWORK_ERROR when the request itself fails', async () => {
      mockedAxios.request.mockRejectedValue(new Error('socket hang up'));

      try {
        await graphRequest({ method: 'GET', path: '/me/messages', token: 'tok' });
        throw new Error('expected graphRequest to throw');
      } catch (error) {
        expect(error).toBeInstanceOf(MatimoError);
        expect((error as MatimoError).code).toBe(ErrorCode.NETWORK_ERROR);
      }
    });

    it('throws a mapped MatimoError for non-retryable error statuses', async () => {
      mockedAxios.request.mockResolvedValue({
        status: 404,
        data: { error: { code: 'itemNotFound' } },
        headers: {},
      });

      try {
        await graphRequest({
          method: 'GET',
          path: '/drives/d/items/x',
          token: 'tok',
          resourceType: 'Drive item',
        });
        throw new Error('expected graphRequest to throw');
      } catch (error) {
        expect(error).toBeInstanceOf(MatimoError);
        expect((error as MatimoError).code).toBe(ErrorCode.FILE_NOT_FOUND);
      }
      expect(mockedAxios.request).toHaveBeenCalledTimes(1);
    });

    it('retries on 429 honoring Retry-After, then succeeds', async () => {
      jest.spyOn(globalThis, 'setTimeout').mockImplementation(((fn: () => void) => {
        fn();
        return 0 as unknown as NodeJS.Timeout;
      }) as unknown as typeof setTimeout);

      mockedAxios.request
        .mockResolvedValueOnce({ status: 429, data: {}, headers: { 'retry-after': '0' } })
        .mockResolvedValueOnce({ status: 200, data: { ok: true }, headers: {} });

      const result = await graphRequest({ method: 'GET', path: '/search/query', token: 'tok' });

      expect(result).toEqual({ ok: true });
      expect(mockedAxios.request).toHaveBeenCalledTimes(2);

      (globalThis.setTimeout as unknown as jest.SpyInstance).mockRestore();
    });

    it('retries on 503 with exponential backoff when no Retry-After is present', async () => {
      jest.spyOn(globalThis, 'setTimeout').mockImplementation(((fn: () => void) => {
        fn();
        return 0 as unknown as NodeJS.Timeout;
      }) as unknown as typeof setTimeout);

      mockedAxios.request
        .mockResolvedValueOnce({ status: 503, data: {}, headers: {} })
        .mockResolvedValueOnce({ status: 200, data: { ok: true }, headers: {} });

      const result = await graphRequest({ method: 'GET', path: '/search/query', token: 'tok' });

      expect(result).toEqual({ ok: true });
      expect(mockedAxios.request).toHaveBeenCalledTimes(2);

      (globalThis.setTimeout as unknown as jest.SpyInstance).mockRestore();
    });

    it('gives up after the maximum number of retries and throws the mapped error', async () => {
      jest.spyOn(globalThis, 'setTimeout').mockImplementation(((fn: () => void) => {
        fn();
        return 0 as unknown as NodeJS.Timeout;
      }) as unknown as typeof setTimeout);

      mockedAxios.request.mockResolvedValue({ status: 429, data: {}, headers: {} });

      try {
        await graphRequest({ method: 'GET', path: '/search/query', token: 'tok' });
        throw new Error('expected graphRequest to throw');
      } catch (error) {
        expect(error).toBeInstanceOf(MatimoError);
        expect((error as MatimoError).code).toBe(ErrorCode.RATE_LIMIT_EXCEEDED);
      }
      // initial attempt + MAX_RETRIES (3) retries = 4 total calls
      expect(mockedAxios.request).toHaveBeenCalledTimes(4);

      (globalThis.setTimeout as unknown as jest.SpyInstance).mockRestore();
    });
  });
});
