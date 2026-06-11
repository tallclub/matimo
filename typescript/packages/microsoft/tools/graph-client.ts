/**
 * Shared Microsoft Graph helpers for all `type: function` tools in this package.
 *
 * Conventions (mirrors @matimo/slack and @matimo/gmail):
 * - Tools NEVER perform OAuth token exchange. A delegated Graph access token is
 *   injected at execution time via `context.credentials.MICROSOFT_GRAPH_ACCESS_TOKEN`
 *   (or the MICROSOFT_GRAPH_ACCESS_TOKEN environment variable as a fallback).
 * - Every Graph error is normalized into a MatimoError with the closest matching
 *   ErrorCode (Matimo has no per-provider error classes — see errors/matimo-error.ts).
 */
import axios from 'axios';
import { MatimoError, ErrorCode } from '@matimo/core/runtime';

export const GRAPH_BASE_URL = 'https://graph.microsoft.com/v1.0';

export interface ToolContext {
  credentials?: Record<string, string>;
}

const RETRYABLE_STATUS_CODES = new Set([429, 500, 503]);
const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 500;

/**
 * Resolve the delegated Graph access token. Matimo never exchanges OAuth codes —
 * the token must already be present in per-call credentials or the environment.
 */
export function getAccessToken(context?: ToolContext): string {
  const token =
    context?.credentials?.MICROSOFT_GRAPH_ACCESS_TOKEN ?? process.env.MICROSOFT_GRAPH_ACCESS_TOKEN;

  if (!token) {
    throw new MatimoError(
      'Microsoft Graph access token is missing. Provide it via credentials.MICROSOFT_GRAPH_ACCESS_TOKEN ' +
        'or the MICROSOFT_GRAPH_ACCESS_TOKEN environment variable. Matimo never performs the OAuth ' +
        'exchange itself — connect Microsoft in Nova first.',
      ErrorCode.AUTH_FAILED,
      { provider: 'microsoft', placeholder: 'MICROSOFT_GRAPH_ACCESS_TOKEN' }
    );
  }

  return token;
}

/**
 * Validate required parameters BEFORE any network call, mirroring the
 * "ValidationError before any API call" requirement. Throws VALIDATION_FAILED.
 */
export function requireParams(
  params: Record<string, unknown>,
  required: string[],
  toolName: string
): void {
  const missing = required.filter((name) => {
    const value = params[name];
    return value === undefined || value === null || value === '';
  });

  if (missing.length > 0) {
    throw new MatimoError(
      `${toolName}: missing required parameter(s): ${missing.join(', ')}`,
      ErrorCode.VALIDATION_FAILED,
      { toolName, missingParams: missing }
    );
  }
}

interface GraphErrorBody {
  error?: { code?: string; message?: string };
}

/**
 * Map a Microsoft Graph HTTP error response onto a MatimoError using the closest
 * matching ErrorCode (Matimo has no CredentialError/NotFoundError/ProviderError
 * classes — see typescript/packages/core/src/errors/matimo-error.ts):
 *   401/403 -> AUTH_FAILED      ("Microsoft Graph access denied. Check connection status in Nova.")
 *   404     -> FILE_NOT_FOUND   (details.resourceType identifies what was missing)
 *   429     -> RATE_LIMIT_EXCEEDED (details.retryAfterSeconds carries Retry-After)
 *   500/503 -> EXECUTION_FAILED (retryable)
 *   other   -> EXECUTION_FAILED
 */
export function mapGraphError(
  status: number,
  data: unknown,
  headers: Record<string, unknown> | undefined,
  resourceType: string
): MatimoError {
  const graphError = (data as GraphErrorBody | undefined)?.error;
  const details: Record<string, unknown> = { statusCode: status, graphError, resourceType };

  if (status === 401 || status === 403) {
    return new MatimoError(
      'Microsoft Graph access denied. Check connection status in Nova.',
      ErrorCode.AUTH_FAILED,
      details
    );
  }

  if (status === 404) {
    return new MatimoError(`${resourceType} not found.`, ErrorCode.FILE_NOT_FOUND, details);
  }

  if (status === 429) {
    const retryAfterHeader = headers?.['retry-after'] ?? headers?.['Retry-After'];
    const retryAfterSeconds =
      retryAfterHeader !== undefined ? Number(retryAfterHeader) : undefined;
    return new MatimoError(
      'Microsoft Graph rate limit exceeded. Respect Retry-After before retrying.',
      ErrorCode.RATE_LIMIT_EXCEEDED,
      { ...details, retryAfterSeconds }
    );
  }

  if (status === 500 || status === 503) {
    return new MatimoError(
      'Microsoft Graph service is temporarily unavailable. Please retry shortly.',
      ErrorCode.EXECUTION_FAILED,
      details
    );
  }

  return new MatimoError(
    `Microsoft Graph request failed with status ${status}.`,
    ErrorCode.EXECUTION_FAILED,
    details
  );
}

function buildQueryString(query?: Record<string, string | number | undefined>): string {
  if (!query) return '';
  const parts = Object.entries(query)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  return parts.length > 0 ? `?${parts.join('&')}` : '';
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface GraphRequestOptions {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** Path relative to https://graph.microsoft.com/v1.0, e.g. '/me/messages' */
  path: string;
  token: string;
  query?: Record<string, string | number | undefined>;
  body?: unknown;
  headers?: Record<string, string>;
  /** Human-readable resource name used to build a clear 404 message, e.g. 'Drive item' */
  resourceType?: string;
  /** Set to 'arraybuffer' for binary downloads (e.g. file content) */
  responseType?: 'json' | 'arraybuffer';
  /** Treat a 204/empty body as success and return null (e.g. publish, sendMail) */
  allowEmptyResponse?: boolean;
}

/**
 * Perform an authenticated Microsoft Graph request with retry-on-429/5xx
 * (respecting Retry-After, exponential backoff, max 3 retries) and normalized
 * MatimoError mapping for every other failure.
 */
export async function graphRequest<T = unknown>(options: GraphRequestOptions): Promise<T> {
  const {
    method,
    path,
    token,
    query,
    body,
    headers,
    resourceType = 'Resource',
    responseType = 'json',
    allowEmptyResponse = false,
  } = options;

  const url = `${GRAPH_BASE_URL}${path}${buildQueryString(query)}`;

  let attempt = 0;
  for (;;) {
    let response;
    try {
      response = await axios.request({
        method,
        url,
        data: body,
        responseType,
        validateStatus: () => true,
        headers: {
          Authorization: `Bearer ${token}`,
          ...(responseType === 'json' ? { Accept: 'application/json' } : {}),
          ...(body !== undefined && !(body instanceof Buffer)
            ? { 'Content-Type': 'application/json' }
            : {}),
          ...headers,
        },
      });
    } catch (error) {
      throw new MatimoError(
        'Microsoft Graph request failed before a response was received (network error).',
        ErrorCode.NETWORK_ERROR,
        { path, originalError: error instanceof Error ? error.message : String(error) },
        error
      );
    }

    if (response.status >= 200 && response.status < 300) {
      if (allowEmptyResponse && (response.status === 204 || !response.data)) {
        return null as T;
      }
      return response.data as T;
    }

    const error = mapGraphError(
      response.status,
      response.data,
      response.headers as Record<string, unknown>,
      resourceType
    );

    const isRetryable = RETRYABLE_STATUS_CODES.has(response.status) && attempt < MAX_RETRIES;
    if (!isRetryable) {
      throw error;
    }

    const retryAfterSeconds = error.details?.retryAfterSeconds as number | undefined;
    const delayMs =
      retryAfterSeconds !== undefined && !Number.isNaN(retryAfterSeconds)
        ? retryAfterSeconds * 1000
        : INITIAL_BACKOFF_MS * 2 ** attempt;

    attempt += 1;
    await sleep(delayMs);
  }
}
