import {
  MatimoError,
  ErrorCode,
  createValidationError,
  createExecutionError,
} from '../../src/errors/matimo-error';

describe('MatimoError', () => {
  it('should create an error with code and details', () => {
    const error = new MatimoError('Test error', ErrorCode.VALIDATION_FAILED, {
      field: 'name',
    });

    expect(error.message).toBe('Test error');
    expect(error.code).toBe(ErrorCode.VALIDATION_FAILED);
    expect(error.details).toEqual({ field: 'name' });
  });

  it('should convert to JSON', () => {
    const error = new MatimoError('Test error', ErrorCode.EXECUTION_FAILED);
    const json = error.toJSON();

    expect(json.message).toBe('Test error');
    expect(json.code).toBe(ErrorCode.EXECUTION_FAILED);
  });

  it('should create validation error helper', () => {
    const error = createValidationError('Validation failed', { field: 'email' });

    expect(error.code).toBe(ErrorCode.VALIDATION_FAILED);
    expect(error.details).toEqual({ field: 'email' });
  });

  it('should create execution error helper', () => {
    const error = createExecutionError('Execution failed', { statusCode: 500 });

    expect(error.code).toBe(ErrorCode.EXECUTION_FAILED);
    expect(error.details).toEqual({ statusCode: 500 });
  });
});
