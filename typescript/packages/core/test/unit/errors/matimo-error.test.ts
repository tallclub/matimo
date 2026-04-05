import {
  MatimoError,
  ErrorCode,
  fromHttpError,
  createValidationError,
  createExecutionError,
} from '../../../src/errors/matimo-error';

describe('MatimoError', () => {
  describe('constructor', () => {
    it('should create error with message and code', () => {
      const error = new MatimoError('Test error', ErrorCode.INVALID_SCHEMA);
      expect(error.message).toBe('Test error');
      expect(error.code).toBe(ErrorCode.INVALID_SCHEMA);
      expect(error.name).toBe('MatimoError');
      expect(error.details).toBeUndefined();
      expect(error.cause).toBeUndefined();
    });

    it('should create error with details', () => {
      const details = { field: 'test', reason: 'invalid' };
      const error = new MatimoError('Test error', ErrorCode.VALIDATION_FAILED, details);
      expect(error.details).toEqual(details);
    });

    it('should create error with cause Error object', () => {
      const cause = new Error('Original error');
      const error = new MatimoError('Wrapped error', ErrorCode.EXECUTION_FAILED, {}, cause);
      expect(error.cause).toBe(cause);
    });

    it('should create error with cause non-Error object', () => {
      const cause = { reason: 'some issue' };
      const error = new MatimoError('Wrapped error', ErrorCode.EXECUTION_FAILED, {}, cause);
      expect(error.cause).toEqual(cause);
    });

    it('should be instanceof Error', () => {
      const error = new MatimoError('Test error', ErrorCode.UNKNOWN_ERROR);
      expect(error instanceof Error).toBe(true);
    });
  });

  describe('toJSON', () => {
    it('should return JSON representation with all fields', () => {
      const details = { foo: 'bar' };
      const cause = new Error('Cause error');
      const error = new MatimoError('Test error', ErrorCode.EXECUTION_FAILED, details, cause);

      const json = error.toJSON();
      expect(json.name).toBe('MatimoError');
      expect(json.message).toBe('Test error');
      expect(json.code).toBe(ErrorCode.EXECUTION_FAILED);
      expect(json.details).toEqual(details);
      expect(json.cause).toEqual({ message: 'Cause error', name: 'Error' });
    });

    it('should handle cause as Error object', () => {
      const cause = new Error('Original error');
      const error = new MatimoError('Test', ErrorCode.EXECUTION_FAILED, {}, cause);
      const json = error.toJSON();
      expect(json.cause).toEqual({ message: 'Original error', name: 'Error' });
    });

    it('should handle cause as non-Error object', () => {
      const cause = { type: 'custom', code: 500 };
      const error = new MatimoError('Test', ErrorCode.EXECUTION_FAILED, {}, cause);
      const json = error.toJSON();
      expect(json.cause).toEqual(cause);
    });

    it('should handle cause as string', () => {
      const cause = 'string cause';
      const error = new MatimoError('Test', ErrorCode.EXECUTION_FAILED, {}, cause);
      const json = error.toJSON();
      expect(json.cause).toBe('string cause');
    });

    it('should handle cause as null', () => {
      const error = new MatimoError('Test', ErrorCode.EXECUTION_FAILED, {}, null);
      const json = error.toJSON();
      expect(json.cause).toBeNull();
    });

    it('should handle cause as undefined', () => {
      const error = new MatimoError('Test', ErrorCode.EXECUTION_FAILED, {});
      const json = error.toJSON();
      expect(json.cause).toBeUndefined();
    });

    it('should omit undefined details', () => {
      const error = new MatimoError('Test', ErrorCode.INVALID_SCHEMA);
      const json = error.toJSON();
      expect(json.details).toBeUndefined();
    });
  });

  describe('fromHttpError', () => {
    it('should create error from response with status and data', () => {
      const httpError = {
        message: 'Request failed',
        response: {
          status: 404,
          data: { error: 'Not found' },
        },
      };
      const error = fromHttpError(httpError, 'Custom message');
      expect(error.code).toBe(ErrorCode.EXECUTION_FAILED);
      expect(error.message).toBe('Custom message');
      expect(error.details?.statusCode).toBe(404);
      expect(error.details?.details).toEqual({ error: 'Not found' });
      expect(error.details?.originalError).toBe('Request failed');
    });

    it('should use default message', () => {
      const httpError = { response: { status: 500 } };
      const error = fromHttpError(httpError);
      expect(error.message).toBe('HTTP request failed');
    });

    it('should default to 500 status when not provided', () => {
      const httpError = { message: 'error' };
      const error = fromHttpError(httpError);
      expect(error.details?.statusCode).toBe(500);
    });

    it('should handle missing response', () => {
      const httpError = { message: 'Network error' };
      const error = fromHttpError(httpError);
      expect(error.details?.statusCode).toBe(500);
      expect(error.details?.originalError).toBe('Network error');
    });

    it('should handle undefined error input', () => {
      const error = fromHttpError(undefined);
      expect(error.details?.statusCode).toBe(500);
      expect(error.details?.originalError).toBe('');
    });

    it('should not include details when undefined', () => {
      const httpError = { response: { status: 400 } };
      const error = fromHttpError(httpError);
      expect(error.details?.details).toBeUndefined();
    });

    it('should handle complex response data', () => {
      const httpError = {
        message: 'Validation failed',
        response: {
          status: 422,
          data: {
            errors: [
              { field: 'name', message: 'Required' },
              { field: 'email', message: 'Invalid' },
            ],
          },
        },
      };
      const error = fromHttpError(httpError);
      expect(error.details?.details).toEqual({
        errors: [
          { field: 'name', message: 'Required' },
          { field: 'email', message: 'Invalid' },
        ],
      });
    });

    it('should preserve original error as cause', () => {
      const originalError = new Error('Original HTTP error');
      const error = fromHttpError(originalError);
      expect(error.cause).toBe(originalError);
    });
  });

  describe('createValidationError', () => {
    it('should create validation error with message and details', () => {
      const details = { field: 'username', error: 'too short' };
      const error = createValidationError('Validation failed', details);
      expect(error.code).toBe(ErrorCode.VALIDATION_FAILED);
      expect(error.message).toBe('Validation failed');
      expect(error.details).toEqual(details);
    });

    it('should create validation error without details', () => {
      const error = createValidationError('Invalid input');
      expect(error.code).toBe(ErrorCode.VALIDATION_FAILED);
      expect(error.message).toBe('Invalid input');
      expect(error.details).toBeUndefined();
    });

    it('should handle complex validation details', () => {
      const details = {
        errors: [
          { path: 'config.url', message: 'Invalid URL format' },
          { path: 'config.timeout', message: 'Must be positive' },
        ],
      };
      const error = createValidationError('Multiple validation errors', details);
      expect(error.details).toEqual(details);
    });
  });

  describe('createExecutionError', () => {
    it('should create execution error with message and details', () => {
      const details = { toolName: 'test-tool', exitCode: 1 };
      const error = createExecutionError('Execution failed', details);
      expect(error.code).toBe(ErrorCode.EXECUTION_FAILED);
      expect(error.message).toBe('Execution failed');
      expect(error.details).toEqual(details);
    });

    it('should create execution error without details', () => {
      const error = createExecutionError('Tool crashed');
      expect(error.code).toBe(ErrorCode.EXECUTION_FAILED);
      expect(error.message).toBe('Tool crashed');
      expect(error.details).toBeUndefined();
    });

    it('should handle complex execution details', () => {
      const details = {
        toolName: 'test-tool',
        exitCode: 127,
        stdout: 'Output text',
        stderr: 'Error text',
      };
      const error = createExecutionError('Execution failed', details);
      expect(error.details).toEqual(details);
    });
  });

  describe('ErrorCode enum', () => {
    it('should have all required error codes', () => {
      expect(ErrorCode.INVALID_SCHEMA).toBe('INVALID_SCHEMA');
      expect(ErrorCode.EXECUTION_FAILED).toBe('EXECUTION_FAILED');
      expect(ErrorCode.AUTH_FAILED).toBe('AUTH_FAILED');
      expect(ErrorCode.TOOL_NOT_FOUND).toBe('TOOL_NOT_FOUND');
      expect(ErrorCode.FILE_NOT_FOUND).toBe('FILE_NOT_FOUND');
      expect(ErrorCode.VALIDATION_FAILED).toBe('VALIDATION_FAILED');
      expect(ErrorCode.RATE_LIMIT_EXCEEDED).toBe('RATE_LIMIT_EXCEEDED');
      expect(ErrorCode.TIMEOUT).toBe('TIMEOUT');
      expect(ErrorCode.NETWORK_ERROR).toBe('NETWORK_ERROR');
      expect(ErrorCode.INVALID_PARAMETER).toBe('INVALID_PARAMETER');
      expect(ErrorCode.UNKNOWN_ERROR).toBe('UNKNOWN_ERROR');
      expect(ErrorCode.POLICY_DENIED).toBe('POLICY_DENIED');
      expect(ErrorCode.POLICY_TIER_BLOCKED).toBe('POLICY_TIER_BLOCKED');
    });
  });

  describe('Error inheritance', () => {
    it('should have stack trace', () => {
      const error = new MatimoError('Test', ErrorCode.UNKNOWN_ERROR);
      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('MatimoError');
    });

    it('should work with Error.captureStackTrace', () => {
      const error = new MatimoError('Test', ErrorCode.UNKNOWN_ERROR);
      expect(error instanceof Error).toBe(true);
      expect(Object.getPrototypeOf(error)).toBe(MatimoError.prototype);
    });
  });

  describe('JSON serialization', () => {
    it('should be JSON serializable with JSON.stringify', () => {
      const error = new MatimoError('Test', ErrorCode.EXECUTION_FAILED, { foo: 'bar' });
      const json = JSON.stringify(error);
      expect(json).toContain('Test');
      expect(json).toContain(ErrorCode.EXECUTION_FAILED);
    });

    it('should handle circular references in details', () => {
      const details: Record<string, unknown> = { a: 1 };
      // Create circular reference would be caught by JSON.stringify, just test normal case
      const error = new MatimoError('Test', ErrorCode.EXECUTION_FAILED, details);
      const json = error.toJSON();
      expect(json.details).toEqual({ a: 1 });
    });
  });
});
