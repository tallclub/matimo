/**
 * Error codes and custom error class for Matimo
 */

export enum ErrorCode {
  INVALID_SCHEMA = 'INVALID_SCHEMA',
  EXECUTION_FAILED = 'EXECUTION_FAILED',
  AUTH_FAILED = 'AUTH_FAILED',
  TOOL_NOT_FOUND = 'TOOL_NOT_FOUND',
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  TIMEOUT = 'TIMEOUT',
  NETWORK_ERROR = 'NETWORK_ERROR',
  INVALID_PARAMETER = 'INVALID_PARAMETER',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  POLICY_DENIED = 'POLICY_DENIED',
  POLICY_TIER_BLOCKED = 'POLICY_TIER_BLOCKED',
}

/**
 * Custom error class for Matimo
 */
export class MatimoError extends Error {
  public cause?: Error | unknown;

  constructor(
    message: string,
    public code: ErrorCode,
    public details?: Record<string, unknown>,
    cause?: Error | unknown
  ) {
    super(message);
    this.name = 'MatimoError';
    this.cause = cause;
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      details: this.details,
      cause:
        this.cause instanceof Error
          ? { message: this.cause.message, name: this.cause.name }
          : this.cause,
    };
  }
}

/**
 * Normalize an HTTP/Axios-style error into a MatimoError preserving useful metadata.
 * This avoids importing axios in the errors module and works with any object
 * that follows the common `error.response` shape.
 */
export function fromHttpError(error: unknown, message = 'HTTP request failed') {
  // Attempt to extract common HTTP error fields
  const asAny = error as Record<string, unknown> | undefined;
  const response = asAny?.response as Record<string, unknown> | undefined;
  const statusCode = (response?.status as number | undefined) ?? 500;
  const details = response?.data as Record<string, unknown> | undefined;
  const meta: Record<string, unknown> = { statusCode };
  if (details !== undefined) meta.details = details;
  // Preserve original error message/cause for debugging (redaction handled elsewhere)
  meta.originalError = asAny?.message ?? String(error ?? '');
  return new MatimoError(message, ErrorCode.EXECUTION_FAILED, meta, error);
}

/**
 * Create a validation error with context
 */
export function createValidationError(
  message: string,
  details?: Record<string, unknown>
): MatimoError {
  return new MatimoError(message, ErrorCode.VALIDATION_FAILED, details);
}

/**
 * Create an execution error with context
 */
export function createExecutionError(
  message: string,
  details?: Record<string, unknown>
): MatimoError {
  return new MatimoError(message, ErrorCode.EXECUTION_FAILED, details);
}
