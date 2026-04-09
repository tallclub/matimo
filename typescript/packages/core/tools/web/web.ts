#!/usr/bin/env node
/**
 * Web Tool - Fetch web content from URLs with flexible HTTP methods
 * Function-type tool: Exports default async function
 */

import axios, { AxiosRequestConfig, AxiosError } from 'axios';
import { MatimoError, ErrorCode } from '../../src/errors/matimo-error';

interface WebParams {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  timeout?: number;
  followRedirects?: boolean;
  parseJson?: boolean;
  maxSize?: number;
}

interface WebResult {
  success: boolean;
  url: string;
  statusCode: number;
  statusText: string;
  contentType: string;
  content: unknown;
  headers: Record<string, unknown>;
  size: number;
  duration: number;
  redirects?: string[];
}

/**
 * Fetch URL and return response with optional JSON parsing
 */
export default async function webTool(params: WebParams): Promise<WebResult> {
  const {
    url,
    method = 'GET',
    headers,
    body,
    timeout = 30000,
    followRedirects = true,
    parseJson = true,
    maxSize = 10485760,
  } = params;

  const startTime = Date.now();

  // Validate required parameter
  if (!url) {
    throw new MatimoError('Missing required parameter', ErrorCode.INVALID_PARAMETER, {
      reason: 'url is required',
    });
  }

  // Validate URL
  try {
    new URL(url);
  } catch {
    throw new MatimoError('Invalid URL', ErrorCode.INVALID_PARAMETER, {
      url,
      reason: 'URL must be valid http or https',
    });
  }

  const requestConfig: AxiosRequestConfig = {
    method: method.toUpperCase() || 'GET',
    url,
    timeout,
    maxContentLength: maxSize,
    maxBodyLength: maxSize,
    headers: {
      'User-Agent': 'Matimo/1.0 (AI Agent Tool SDK)',
      Accept: 'application/json, text/plain, text/html, */*',
      ...headers,
    },
    validateStatus: () => true, // Don't throw on any status code
  };

  if (body && ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
    requestConfig.data = body;
  }

  if (!followRedirects) {
    requestConfig.maxRedirects = 0;
  }

  try {
    const response = await axios.request(requestConfig);
    let content: unknown = response.data;

    // Try to parse JSON if requested and content-type suggests JSON
    if (parseJson && response.headers['content-type']?.includes('application/json')) {
      try {
        if (typeof response.data === 'string') {
          content = JSON.parse(response.data);
        } else {
          content = response.data;
        }
      } catch {
        // If JSON parsing fails, keep original content
        content = response.data;
      }
    }

    const result: WebResult = {
      success: response.status >= 200 && response.status < 300,
      url,
      statusCode: response.status,
      statusText: response.statusText || '',
      contentType: (response.headers['content-type'] as string) || 'unknown',
      content,
      headers: response.headers,
      size: JSON.stringify(response.data).length,
      duration: Date.now() - startTime,
    };

    return result;
  } catch (error) {
    const axiosError = error as AxiosError;
    throw new MatimoError(
      'HTTP request failed',
      ErrorCode.NETWORK_ERROR,
      {
        url,
        statusCode: axiosError.response?.status,
        statusText: axiosError.response?.statusText,
        originalError: axiosError.message,
      }
    );
  }
}
