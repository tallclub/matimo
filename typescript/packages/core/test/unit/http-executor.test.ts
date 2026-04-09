import { HttpExecutor } from '../../src/executors/http-executor';
import axios from 'axios';
import { MatimoError, ErrorCode } from '../../src/errors/matimo-error';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('HttpExecutor', () => {
  let executor: HttpExecutor;

  beforeEach(() => {
    executor = new HttpExecutor();
    jest.clearAllMocks();
  });

  describe('execute', () => {
    it('should execute HTTP GET request', async () => {
      const tool = {
        name: 'http-get',
        version: '1.0.0',
        description: 'Test',
        parameters: {},
        execution: {
          type: 'http' as const,
          method: 'GET' as const,
          url: 'https://api.example.com/users',
        },
      };

      mockedAxios.request.mockResolvedValue({
        status: 200,
        data: { id: 1, name: 'Test User' },
      });

      const result = (await executor.execute(tool, {})) as Record<string, unknown>;
      expect(result.success).toBe(true);
      expect(result.statusCode).toBe(200);
      expect(mockedAxios.request).toHaveBeenCalledWith({
        method: 'GET',
        url: 'https://api.example.com/users',
        timeout: undefined,
      });
    });

    it('should execute HTTP POST request with body', async () => {
      const tool = {
        name: 'http-post',
        version: '1.0.0',
        description: 'Test',
        parameters: {
          name: {
            type: 'string' as const,
            description: 'Name',
          },
        },
        execution: {
          type: 'http' as const,
          method: 'POST' as const,
          url: 'https://api.example.com/users',
          body: { name: '{name}' },
        },
      };

      mockedAxios.request.mockResolvedValue({
        status: 201,
        data: { id: 2, name: 'New User' },
      });

      const result = (await executor.execute(tool, { name: 'New User' })) as Record<
        string,
        unknown
      >;
      expect(result.success).toBe(true);
      expect(mockedAxios.request).toHaveBeenCalledWith({
        method: 'POST',
        url: 'https://api.example.com/users',
        data: { name: 'New User' },
        timeout: undefined,
      });
    });

    it('should include custom headers', async () => {
      const tool = {
        name: 'http-headers',
        version: '1.0.0',
        description: 'Test',
        parameters: {},
        execution: {
          type: 'http' as const,
          method: 'GET' as const,
          url: 'https://api.example.com/data',
          headers: {
            Authorization: 'Bearer token123',
            'X-Custom-Header': 'value',
          },
        },
      };

      mockedAxios.request.mockResolvedValue({
        status: 200,
        data: { result: 'success' },
      });

      const result = (await executor.execute(tool, {})) as Record<string, unknown>;
      expect(result.success).toBe(true);
      expect(mockedAxios.request).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: {
            Authorization: 'Bearer token123',
            'X-Custom-Header': 'value',
          },
        })
      );
    });

    it('should support PUT requests', async () => {
      const tool = {
        name: 'http-put',
        version: '1.0.0',
        description: 'Test',
        parameters: {},
        execution: {
          type: 'http' as const,
          method: 'PUT' as const,
          url: 'https://api.example.com/users/1',
          body: { name: 'Updated Name' },
        },
      };

      mockedAxios.request.mockResolvedValue({
        status: 200,
        data: { id: 1, name: 'Updated Name' },
      });

      const result = (await executor.execute(tool, {})) as Record<string, unknown>;
      expect(result.success).toBe(true);
      expect(mockedAxios.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'PUT',
        })
      );
    });

    it('should support DELETE requests', async () => {
      const tool = {
        name: 'http-delete',
        version: '1.0.0',
        description: 'Test',
        parameters: {},
        execution: {
          type: 'http' as const,
          method: 'DELETE' as const,
          url: 'https://api.example.com/users/1',
        },
      };

      mockedAxios.request.mockResolvedValue({
        status: 204,
        data: null,
      });

      const result = (await executor.execute(tool, {})) as Record<string, unknown>;
      expect(result.success).toBe(true);
      expect(mockedAxios.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'DELETE',
        })
      );
    });

    it('should support PATCH requests', async () => {
      const tool = {
        name: 'http-patch',
        version: '1.0.0',
        description: 'Test',
        parameters: {},
        execution: {
          type: 'http' as const,
          method: 'PATCH' as const,
          url: 'https://api.example.com/users/1',
          body: { status: 'active' },
        },
      };

      mockedAxios.request.mockResolvedValue({
        status: 200,
        data: { id: 1, status: 'active' },
      });

      const result = (await executor.execute(tool, {})) as Record<string, unknown>;
      expect(result.success).toBe(true);
      expect(mockedAxios.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'PATCH',
        })
      );
    });

    it('should handle request timeout', async () => {
      const tool = {
        name: 'http-timeout',
        version: '1.0.0',
        description: 'Test',
        parameters: {},
        execution: {
          type: 'http' as const,
          method: 'GET' as const,
          url: 'https://api.example.com/data',
          timeout: 5000,
        },
      };

      mockedAxios.request.mockRejectedValue(new Error('timeout'));

      try {
        await executor.execute(tool, {});
        fail('Expected executor to throw MatimoError');
      } catch (err) {
        expect(err).toBeInstanceOf(MatimoError);
        const me = err as MatimoError;
        expect(me.details).toBeDefined();
        expect(String(me.details?.originalError)).toContain('timeout');
      }
      expect(mockedAxios.request).toHaveBeenCalledWith(
        expect.objectContaining({
          timeout: 5000,
        })
      );
    });

    it('should handle HTTP errors', async () => {
      const tool = {
        name: 'http-error',
        version: '1.0.0',
        description: 'Test',
        parameters: {},
        execution: {
          type: 'http' as const,
          method: 'GET' as const,
          url: 'https://api.example.com/notfound',
        },
      };

      mockedAxios.request.mockResolvedValue({
        status: 404,
        data: { error: 'Not found' },
      });

      const result = (await executor.execute(tool, {})) as Record<string, unknown>;
      expect(result.success).toBe(false);
      expect(result.statusCode).toBe(404);
    });

    it('should handle connection errors', async () => {
      const tool = {
        name: 'http-connection-error',
        version: '1.0.0',
        description: 'Test',
        parameters: {},
        execution: {
          type: 'http' as const,
          method: 'GET' as const,
          url: 'https://invalid-domain-12345.com',
        },
      };

      mockedAxios.request.mockRejectedValue(new Error('ECONNREFUSED'));

      try {
        await executor.execute(tool, {});
        fail('Expected executor to throw MatimoError');
      } catch (err) {
        expect(err).toBeInstanceOf(MatimoError);
        const me = err as MatimoError;
        expect(me.details).toBeDefined();
        expect(String(me.details?.originalError)).toContain('ECONNREFUSED');
      }
    });
  });

  describe('parameter templating', () => {
    it('should template URL parameters', async () => {
      const tool = {
        name: 'url-template',
        version: '1.0.0',
        description: 'Test',
        parameters: {
          userId: {
            type: 'string' as const,
            description: 'User ID',
          },
        },
        execution: {
          type: 'http' as const,
          method: 'GET' as const,
          url: 'https://api.example.com/users/{userId}',
        },
      };

      mockedAxios.request.mockResolvedValue({
        status: 200,
        data: {},
      });

      await executor.execute(tool, { userId: '123' });

      expect(mockedAxios.request).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'https://api.example.com/users/123',
        })
      );
    });

    it('should template body parameters', async () => {
      const tool = {
        name: 'body-template',
        version: '1.0.0',
        description: 'Test',
        parameters: {
          name: {
            type: 'string' as const,
            description: 'Name',
          },
          email: {
            type: 'string' as const,
            description: 'Email',
          },
        },
        execution: {
          type: 'http' as const,
          method: 'POST' as const,
          url: 'https://api.example.com/users',
          body: {
            name: '{name}',
            email: '{email}',
          },
        },
      };

      mockedAxios.request.mockResolvedValue({
        status: 201,
        data: {},
      });

      await executor.execute(tool, { name: 'John', email: 'john@example.com' });

      expect(mockedAxios.request).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            name: 'John',
            email: 'john@example.com',
          },
        })
      );
    });

    it('should template header parameters', async () => {
      const tool = {
        name: 'header-template',
        version: '1.0.0',
        description: 'Test',
        parameters: {
          token: {
            type: 'string' as const,
            description: 'Token',
          },
        },
        execution: {
          type: 'http' as const,
          method: 'GET' as const,
          url: 'https://api.example.com/data',
          headers: {
            Authorization: 'Bearer {token}',
          },
        },
      };

      mockedAxios.request.mockResolvedValue({
        status: 200,
        data: {},
      });

      await executor.execute(tool, { token: 'secret123' });

      expect(mockedAxios.request).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: {
            Authorization: 'Bearer secret123',
          },
        })
      );
    });
  });

  describe('result structure', () => {
    it('should return properly structured result', async () => {
      const tool = {
        name: 'http-result',
        version: '1.0.0',
        description: 'Test',
        parameters: {},
        execution: {
          type: 'http' as const,
          method: 'GET' as const,
          url: 'https://api.example.com/test',
        },
      };

      mockedAxios.request.mockResolvedValue({
        status: 200,
        data: { result: 'success' },
      });

      const result = (await executor.execute(tool, {})) as Record<string, unknown>;

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('statusCode');
      expect(result).toHaveProperty('data');
      expect(typeof result.success).toBe('boolean');
      expect(typeof result.statusCode).toBe('number');
    });

    it('should include response headers', async () => {
      const tool = {
        name: 'http-headers-response',
        version: '1.0.0',
        description: 'Test',
        parameters: {},
        execution: {
          type: 'http' as const,
          method: 'GET' as const,
          url: 'https://api.example.com/test',
        },
      };

      mockedAxios.request.mockResolvedValue({
        status: 200,
        headers: { 'content-type': 'application/json' },
        data: {},
      });

      const result = (await executor.execute(tool, {})) as Record<string, unknown>;

      expect(result).toHaveProperty('headers');
    });

    it('should handle object templating with non-string values', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tool: any = {
        name: 'http-headers-mixed',
        version: '1.0.0',
        description: 'Test',
        parameters: {},
        execution: {
          type: 'http' as const,
          method: 'POST' as const,
          url: 'https://api.example.com/data',
          headers: {
            'X-Number': '123',
            'X-Object': { nested: 'value' },
            'X-Array': [1, 2, 3],
          },
        },
      };

      mockedAxios.request.mockResolvedValue({
        status: 200,
        data: { success: true },
      });

      const result = (await executor.execute(tool, {})) as Record<string, unknown>;
      expect(result.success).toBe(true);
      // Verify non-string values in headers are preserved
      expect(mockedAxios.request).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Object': { nested: 'value' },
            'X-Array': [1, 2, 3],
          }),
        })
      );
    });

    it('should handle request body with mixed types', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tool: any = {
        name: 'http-body-mixed',
        version: '1.0.0',
        description: 'Test',
        parameters: {},
        execution: {
          type: 'http' as const,
          method: 'POST' as const,
          url: 'https://api.example.com/data',
          body: {
            text: 'string value',
            number: 42,
            flag: true,
            nested: { key: 'value' },
          },
        },
      };

      mockedAxios.request.mockResolvedValue({
        status: 201,
        data: { id: 1 },
      });

      const result = (await executor.execute(tool, {})) as Record<string, unknown>;
      expect(result.success).toBe(true);
      expect(mockedAxios.request).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            text: 'string value',
            number: 42,
            flag: true,
            nested: { key: 'value' },
          }),
        })
      );
    });

    describe('Form Encoding (application/x-www-form-urlencoded)', () => {
      it('should convert body object to URLSearchParams when Content-Type is form-urlencoded', async () => {
        const tool = {
          name: 'form-post',
          version: '1.0.0',
          description: 'Test form submission',
          parameters: {
            username: { type: 'string' as const, description: 'Username' },
            password: { type: 'string' as const, description: 'Password' },
          },
          execution: {
            type: 'http' as const,
            method: 'POST' as const,
            url: 'https://api.example.com/login',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: {
              username: '{username}',
              password: '{password}',
            },
          },
        };

        mockedAxios.request.mockResolvedValue({
          status: 200,
          data: { token: 'abc123' },
        });

        await executor.execute(tool, {
          username: 'testuser',
          password: 'testpass123',
        });

        // Verify URLSearchParams was used instead of plain object
        const callArgs = mockedAxios.request.mock.calls[0][0];
        expect(callArgs.headers).toEqual({
          'Content-Type': 'application/x-www-form-urlencoded',
        });

        // Check that data is URLSearchParams (has append method)
        expect(callArgs.data).toBeInstanceOf(URLSearchParams);
        expect(callArgs.data?.toString()).toBe('username=testuser&password=testpass123');
      });

      it('should filter null and undefined values from URLSearchParams', async () => {
        const tool = {
          name: 'form-with-optional',
          version: '1.0.0',
          description: 'Form with optional fields',
          parameters: {
            field1: { type: 'string' as const, description: 'Required' },
            field2: { type: 'string' as const, description: 'Optional' },
          },
          execution: {
            type: 'http' as const,
            method: 'POST' as const,
            url: 'https://api.example.com/submit',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: {
              field1: '{field1}',
              field2: '{field2}',
            },
          },
        };

        mockedAxios.request.mockResolvedValue({
          status: 200,
          data: { id: 'new-id' },
        });

        // Call with only field1, field2 is undefined
        await executor.execute(tool, {
          field1: 'value1',
        });

        const callArgs = mockedAxios.request.mock.calls[0][0];
        expect(callArgs.data).toBeInstanceOf(URLSearchParams);
        // Undefined field2 should not be included
        expect(callArgs.data?.toString()).toBe('field1=value1');
      });

      it('should handle special characters in form-encoded values', async () => {
        const tool = {
          name: 'form-special-chars',
          version: '1.0.0',
          description: 'Form with special characters',
          parameters: {
            message: { type: 'string' as const, description: 'Message' },
          },
          execution: {
            type: 'http' as const,
            method: 'POST' as const,
            url: 'https://api.example.com/send',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: {
              message: '{message}',
            },
          },
        };

        mockedAxios.request.mockResolvedValue({
          status: 200,
          data: { success: true },
        });

        await executor.execute(tool, {
          message: 'Hello & goodbye! Special: ?#@=',
        });

        const callArgs = mockedAxios.request.mock.calls[0][0];
        expect(callArgs.data).toBeInstanceOf(URLSearchParams);
        // URLSearchParams should properly encode special characters
        const encodedStr = callArgs.data?.toString();
        expect(encodedStr).toContain('message=');
        // Should be URL-encoded
        expect(encodedStr).not.toContain('&');
      });

      it('should NOT convert to URLSearchParams for non-form Content-Type', async () => {
        const tool = {
          name: 'json-post',
          version: '1.0.0',
          description: 'JSON POST request',
          parameters: {
            data: { type: 'string' as const, description: 'Data' },
          },
          execution: {
            type: 'http' as const,
            method: 'POST' as const,
            url: 'https://api.example.com/data',
            headers: {
              'Content-Type': 'application/json',
            },
            body: {
              data: '{data}',
            },
          },
        };

        mockedAxios.request.mockResolvedValue({
          status: 200,
          data: { ok: true },
        });

        await executor.execute(tool, {
          data: 'test-data',
        });

        const callArgs = mockedAxios.request.mock.calls[0][0];
        // Should be plain object, not URLSearchParams
        expect(callArgs.data).toEqual({ data: 'test-data' });
        expect(callArgs.data).not.toBeInstanceOf(URLSearchParams);
      });

      it('should handle case-insensitive Content-Type header check', async () => {
        const tool = {
          name: 'form-lowercase',
          version: '1.0.0',
          description: 'Form with lowercase header',
          parameters: {
            field: { type: 'string' as const, description: 'Field' },
          },
          execution: {
            type: 'http' as const,
            method: 'POST' as const,
            url: 'https://api.example.com/submit',
            headers: {
              'content-type': 'application/x-www-form-urlencoded',
            },
            body: {
              field: '{field}',
            },
          },
        };

        mockedAxios.request.mockResolvedValue({
          status: 200,
          data: { id: 1 },
        });

        await executor.execute(tool, {
          field: 'test-value',
        });

        const callArgs = mockedAxios.request.mock.calls[0][0];
        // Should still convert to URLSearchParams even with lowercase header
        expect(callArgs.data).toBeInstanceOf(URLSearchParams);
      });

      it('should work with Twilio SMS-like form submission', async () => {
        const tool = {
          name: 'twilio-send-sms',
          version: '1.0.0',
          description: 'Twilio SMS',
          parameters: {
            to: { type: 'string' as const, description: 'To' },
            from: { type: 'string' as const, description: 'From' },
            body: { type: 'string' as const, description: 'Body' },
          },
          execution: {
            type: 'http' as const,
            method: 'POST' as const,
            url: 'https://api.twilio.com/2010-04-01/Accounts/ACxxxx/Messages.json',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: {
              To: '{to}',
              From: '{from}',
              Body: '{body}',
            },
          },
        };

        mockedAxios.request.mockResolvedValue({
          status: 201,
          data: { sid: 'SM1234567890abcdef1234567890abcdef' },
        });

        await executor.execute(tool, {
          to: '+15558675310',
          from: '+15557122661',
          body: 'Test SMS message',
        });

        const callArgs = mockedAxios.request.mock.calls[0][0];
        expect(callArgs.data).toBeInstanceOf(URLSearchParams);
        const formData = callArgs.data?.toString();
        expect(formData).toContain('To=%2B15558675310');
        expect(formData).toContain('From=%2B15557122661');
        expect(formData).toContain('Body=Test+SMS+message');
      });
    });
  });

  describe('Error Handling', () => {
    it('should rethrow MatimoError without wrapping', async () => {
      const tool = {
        name: 'error-test',
        version: '1.0.0',
        description: 'Test',
        parameters: {},
        execution: {
          type: 'http' as const,
          method: 'GET' as const,
          url: 'https://api.example.com/data/{missing_param}',
        },
      };

      // Missing parameter in URL will throw MatimoError before axios
      await expect(executor.execute(tool, {})).rejects.toThrow(MatimoError);
    });

    it('should rethrow MatimoError thrown by axios without wrapping', async () => {
      const tool = {
        name: 'matimo-error-from-axios',
        version: '1.0.0',
        description: 'Test',
        parameters: {},
        execution: {
          type: 'http' as const,
          method: 'GET' as const,
          url: 'https://api.example.com/data',
        },
      };

      // Create a MatimoError and throw it from axios to test the instanceof check
      const matimoError = new MatimoError('Test error from axios', ErrorCode.EXECUTION_FAILED, {
        details: 'test',
      });
      mockedAxios.request.mockRejectedValue(matimoError);

      // Should rethrow the MatimoError without wrapping
      await expect(executor.execute(tool, {})).rejects.toThrow(MatimoError);
      await expect(executor.execute(tool, {})).rejects.toThrow('Test error from axios');
    });

    it('should convert axios errors to MatimoError', async () => {
      const tool = {
        name: 'error-test',
        version: '1.0.0',
        description: 'Test',
        parameters: {},
        execution: {
          type: 'http' as const,
          method: 'GET' as const,
          url: 'https://api.example.com/data',
        },
      };

      const axiosError = new Error('Network error');
      mockedAxios.request.mockRejectedValue(axiosError);

      await expect(executor.execute(tool, {})).rejects.toThrow(MatimoError);
    });
  });

  describe('Parameter Type Conversion', () => {
    it('should convert string number placeholders to numbers in body when paramDefinitions has type:number', async () => {
      const tool = {
        name: 'type-conversion',
        version: '1.0.0',
        description: 'Test type conversion',
        parameters: {
          count: { type: 'number' as const, description: 'A count' },
          page: { type: 'number' as const, description: 'Page number' },
        },
        execution: {
          type: 'http' as const,
          method: 'POST' as const,
          url: 'https://api.example.com/items',
          body: {
            count: '{count}',
            page: '{page}',
            name: 'test',
          },
        },
      };

      mockedAxios.request.mockResolvedValue({
        status: 200,
        data: { items: [] },
      });

      await executor.execute(tool, {
        count: 42,
        page: 3,
      });

      const callArgs = mockedAxios.request.mock.calls[0][0];
      const bodyData = callArgs.data as Record<string, unknown>;
      expect(bodyData).toEqual({
        count: 42,
        page: 3,
        name: 'test',
      });
      // Verify they're numbers not strings
      expect(typeof bodyData.count).toBe('number');
      expect(typeof bodyData.page).toBe('number');
    });

    it('should convert string boolean placeholders to booleans in body when paramDefinitions has type:boolean', async () => {
      const tool = {
        name: 'bool-conversion',
        version: '1.0.0',
        description: 'Test boolean conversion',
        parameters: {
          enabled: { type: 'boolean' as const, description: 'Enabled flag' },
          active: { type: 'boolean' as const, description: 'Active flag' },
        },
        execution: {
          type: 'http' as const,
          method: 'POST' as const,
          url: 'https://api.example.com/config',
          body: {
            enabled: '{enabled}',
            active: '{active}',
          },
        },
      };

      mockedAxios.request.mockResolvedValue({
        status: 200,
        data: { ok: true },
      });

      await executor.execute(tool, {
        enabled: true,
        active: false,
      });

      const callArgs = mockedAxios.request.mock.calls[0][0];
      const bodyData = callArgs.data as Record<string, unknown>;
      expect(bodyData).toEqual({
        enabled: true,
        active: false,
      });
      expect(typeof bodyData.enabled).toBe('boolean');
      expect(typeof bodyData.active).toBe('boolean');
    });

    it('should not include parameters with undefined/null values in templated strings', async () => {
      const tool = {
        name: 'undefined-test',
        version: '1.0.0',
        description: 'Test undefined filtering',
        parameters: {
          required_field: { type: 'string' as const, description: 'Required' },
          optional_field: { type: 'string' as const, description: 'Optional' },
        },
        execution: {
          type: 'http' as const,
          method: 'POST' as const,
          url: 'https://api.example.com/submit',
          body: {
            required_field: '{required_field}',
            optional_field: '{optional_field}',
          },
        },
      };

      mockedAxios.request.mockResolvedValue({
        status: 200,
        data: { id: 'new-id' },
      });

      // Pass only required_field, optional_field is undefined
      await executor.execute(tool, {
        required_field: 'value',
      });

      const callArgs = mockedAxios.request.mock.calls[0][0];
      // Only required_field should be in body; optional_field should be omitted
      expect(callArgs.data).toEqual({ required_field: 'value' });
      expect(callArgs.data).not.toHaveProperty('optional_field');
    });

    it('should convert array item placeholders to correct types', async () => {
      const tool = {
        name: 'array-types',
        version: '1.0.0',
        description: 'Test array type conversion',
        parameters: {
          ids: { type: 'array' as const, description: 'IDs' },
          count: { type: 'number' as const, description: 'Count' },
        },
        execution: {
          type: 'http' as const,
          method: 'POST' as const,
          url: 'https://api.example.com/batch',
          body: {
            items: '{ids}',
            total: '{count}',
          },
        },
      };

      mockedAxios.request.mockResolvedValue({
        status: 200,
        data: { processed: 3 },
      });

      await executor.execute(tool, {
        ids: ['id1', 'id2', 'id3'],
        count: 42,
      });

      const callArgs = mockedAxios.request.mock.calls[0][0];
      const bodyData = callArgs.data as Record<string, unknown>;
      // When using '{ids}' directly (not in an array), it embeds the array as-is
      expect(bodyData.items).toEqual(['id1', 'id2', 'id3']);
      expect((bodyData.items as Array<unknown>)[0]).toBe('id1');
      expect(bodyData.total).toBe(42);
    });

    it('should handle boolean string values in parameters (true/1/yes)', async () => {
      const tool = {
        name: 'bool-strings',
        version: '1.0.0',
        description: 'Test boolean string conversion',
        parameters: {
          flag: { type: 'boolean' as const, description: 'Flag' },
        },
        execution: {
          type: 'http' as const,
          method: 'POST' as const,
          url: 'https://api.example.com/action',
          body: {
            flag: '{flag}',
          },
        },
      };

      mockedAxios.request.mockResolvedValue({
        status: 200,
        data: { ok: true },
      });

      // Test with 'true' string
      await executor.execute(tool, { flag: 'true' });

      const callArgs = mockedAxios.request.mock.calls[0][0];
      const bodyData = callArgs.data as Record<string, unknown>;
      expect(bodyData.flag).toBe(true);

      // Reset mock
      mockedAxios.request.mockClear();
      mockedAxios.request.mockResolvedValue({ status: 200, data: { ok: true } });

      // Test with '1' string
      await executor.execute(tool, { flag: '1' });
      const callArgs2 = mockedAxios.request.mock.calls[0][0];
      expect((callArgs2.data as Record<string, unknown>).flag).toBe(true);

      // Reset mock
      mockedAxios.request.mockClear();
      mockedAxios.request.mockResolvedValue({ status: 200, data: { ok: true } });

      // Test with 'yes' string
      await executor.execute(tool, { flag: 'yes' });
      const callArgs3 = mockedAxios.request.mock.calls[0][0];
      expect((callArgs3.data as Record<string, unknown>).flag).toBe(true);
    });

    it('should convert numeric string placeholders to numbers when type is number', async () => {
      const tool = {
        name: 'num-strings',
        version: '1.0.0',
        description: 'Test numeric string conversion',
        parameters: {
          count: { type: 'number' as const, description: 'Count' },
        },
        execution: {
          type: 'http' as const,
          method: 'POST' as const,
          url: 'https://api.example.com/data',
          body: {
            count: '{count}',
          },
        },
      };

      mockedAxios.request.mockResolvedValue({
        status: 200,
        data: { ok: true },
      });

      // Pass string '123' which should be converted to number 123
      await executor.execute(tool, { count: '123' });

      const callArgs = mockedAxios.request.mock.calls[0][0];
      const bodyData = callArgs.data as Record<string, unknown>;
      expect(bodyData.count).toBe(123);
      expect(typeof bodyData.count).toBe('number');
    });

    it('should apply Basic Auth when authentication.type is basic with env vars', async () => {
      const tool = {
        name: 'basic-auth-test',
        version: '1.0.0',
        description: 'Test Basic Auth',
        parameters: {},
        execution: {
          type: 'http' as const,
          method: 'GET' as const,
          url: 'https://api.example.com/protected',
        },
        authentication: {
          type: 'basic' as const,
          username_env: 'TEST_USERNAME',
          password_env: 'TEST_PASSWORD',
        },
      };

      // Set up environment variables
      process.env.TEST_USERNAME = 'myuser';
      process.env.TEST_PASSWORD = 'mypass';

      mockedAxios.request.mockResolvedValue({
        status: 200,
        data: { authenticated: true },
      });

      await executor.execute(tool, {});

      const callArgs = mockedAxios.request.mock.calls[0][0];
      expect(callArgs.headers).toBeDefined();
      const headers = callArgs.headers as Record<string, string>;
      expect(headers.Authorization).toBeDefined();
      // Should be "Basic " prefix followed by base64 encoded "myuser:mypass"
      expect(headers.Authorization).toMatch(/^Basic /);
      const expectedAuth = Buffer.from('myuser:mypass').toString('base64');
      expect(headers.Authorization).toBe(`Basic ${expectedAuth}`);

      // Clean up
      delete process.env.TEST_USERNAME;
      delete process.env.TEST_PASSWORD;
    });

    it('should handle array items with number type conversion', async () => {
      const tool = {
        name: 'array-number-convert',
        version: '1.0.0',
        description: 'Array with number conversion',
        parameters: {
          count: { type: 'number' as const, description: 'Count' },
        },
        execution: {
          type: 'http' as const,
          method: 'POST' as const,
          url: 'https://api.example.com/data',
          body: {
            counts: ['{count}'],
          },
        },
      };

      mockedAxios.request.mockResolvedValue({
        status: 200,
        data: { ok: true },
      });

      await executor.execute(tool, { count: '99' });

      const callArgs = mockedAxios.request.mock.calls[0][0];
      const bodyData = callArgs.data as Record<string, unknown>;
      const counts = bodyData.counts as unknown[];
      expect(counts[0]).toBe(99);
      expect(typeof counts[0]).toBe('number');
    });

    it('should handle array items with boolean type conversion', async () => {
      const tool = {
        name: 'array-bool-convert',
        version: '1.0.0',
        description: 'Array with boolean conversion',
        parameters: {
          flag: { type: 'boolean' as const, description: 'Flag' },
        },
        execution: {
          type: 'http' as const,
          method: 'POST' as const,
          url: 'https://api.example.com/data',
          body: {
            flags: ['{flag}'],
          },
        },
      };

      mockedAxios.request.mockResolvedValue({
        status: 200,
        data: { ok: true },
      });

      await executor.execute(tool, { flag: 'true' });

      const callArgs = mockedAxios.request.mock.calls[0][0];
      const bodyData = callArgs.data as Record<string, unknown>;
      const flags = bodyData.flags as unknown[];
      expect(flags[0]).toBe(true);
      expect(typeof flags[0]).toBe('boolean');
    });

    it('should filter out null array items', async () => {
      const tool = {
        name: 'array-null-filter',
        version: '1.0.0',
        description: 'Array with null filtering',
        parameters: {
          optional_value: { type: 'string' as const, description: 'Optional' },
        },
        execution: {
          type: 'http' as const,
          method: 'POST' as const,
          url: 'https://api.example.com/data',
          body: {
            items: ['static', '{optional_value}'],
          },
        },
      };

      mockedAxios.request.mockResolvedValue({
        status: 200,
        data: { ok: true },
      });

      // Pass undefined for optional_value
      await executor.execute(tool, {});

      const callArgs = mockedAxios.request.mock.calls[0][0];
      const bodyData = callArgs.data as Record<string, unknown>;
      const items = bodyData.items as unknown[];
      // Should only have 'static', the undefined placeholder should be filtered
      expect(items.length).toBe(1);
      expect(items[0]).toBe('static');
    });

    it('should handle templates with null/undefined parameter values', async () => {
      const tool = {
        name: 'null-param-test',
        version: '1.0.0',
        description: 'Test with null parameters',
        parameters: {
          optional_text: { type: 'string' as const, description: 'Optional text' },
        },
        execution: {
          type: 'http' as const,
          method: 'POST' as const,
          url: 'https://api.example.com/data',
          body: {
            text: '{optional_text}',
            fallback: 'default',
          },
        },
      };

      mockedAxios.request.mockResolvedValue({
        status: 200,
        data: { ok: true },
      });

      // Pass null explicitly for optional_text
      await executor.execute(tool, { optional_text: null });

      const callArgs = mockedAxios.request.mock.calls[0][0];
      const bodyData = callArgs.data as Record<string, unknown>;
      // When optional_text is null, the key with null value is excluded from body
      expect(bodyData).not.toHaveProperty('text');
      expect(bodyData.fallback).toBe('default');
    });
  });
});
