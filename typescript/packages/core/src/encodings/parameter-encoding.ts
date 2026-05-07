/**
 * Generic parameter encoding system for transforming input parameters
 * Used to convert structured parameters into API-specific formats (MIME, JSON, etc.)
 *
 * This is YAML-driven via the parameter_encoding directive in tool definitions.
 * No tool-specific code needed - keeps Matimo universal.
 */

import { MatimoError, ErrorCode } from '../errors/matimo-error.js';

/**
 * Encoding configuration from YAML
 */
export interface ParameterEncodingConfig {
  source: string[]; // Parameter names to combine (e.g., [to, subject, body])
  target: string; // Parameter name to store result in (e.g., raw)
  encoding: string; // Encoding type (mime_rfc2822_base64url, json_compact, etc.)
  options?: Record<string, unknown>; // Optional config per encoding type
}

/**
 * Apply parameter encodings to transform input parameters
 * @param params - User-provided parameters
 * @param encodings - List of encoding configurations from tool YAML
 * @returns Parameters with encoded values added
 */
export function applyParameterEncodings(
  params: Record<string, unknown>,
  encodings: ParameterEncodingConfig[]
): Record<string, unknown> {
  const result = { ...params };

  for (const config of encodings) {
    // Extract source parameters
    const sourceValues: Record<string, unknown> = {};
    for (const key of config.source) {
      if (key in params) {
        sourceValues[key] = params[key];
      }
    }

    // Apply encoding function
    const encodedValue = encodeParameters(sourceValues, config.encoding, config.options);

    // Store in target parameter
    result[config.target] = encodedValue;
  }

  return result;
}

/**
 * Route to specific encoding function based on type
 */
function encodeParameters(
  sourceValues: Record<string, unknown>,
  encoding: string,
  _options?: Record<string, unknown>
): string {
  switch (encoding) {
    case 'mime_rfc2822_base64url':
      return encodeMimeRfc2822(sourceValues);
    case 'json_compact':
      return JSON.stringify(sourceValues);
    case 'url_encoded':
      return encodeUrlParams(sourceValues);
    default:
      throw new MatimoError(
        `Unknown parameter encoding type: ${encoding}`,
        ErrorCode.INVALID_PARAMETER,
        {
          encodingType: encoding,
          supportedTypes: ['mime_rfc2822_base64url', 'json_compact', 'url_encoded'],
        }
      );
  }
}

/**
 * Encode parameters as RFC 2822 MIME message with base64url encoding
 * Used for Gmail and other email APIs that accept raw MIME format
 */
function encodeMimeRfc2822(sourceValues: Record<string, unknown>): string {
  const to = sourceValues.to as string;
  const subject = sourceValues.subject as string;
  const body = sourceValues.body as string;
  const cc = sourceValues.cc as string | undefined;
  const bcc = sourceValues.bcc as string | undefined;
  // Accept both camelCase (`isHtml`) and snake_case (`is_html`) for backward compatibility
  const isHtml = ((sourceValues.isHtml ?? sourceValues.is_html) as boolean) || false;

  if (!to || !subject || !body) {
    throw new MatimoError(
      'MIME encoding requires: to, subject, body parameters',
      ErrorCode.INVALID_PARAMETER,
      {
        requiredFields: ['to', 'subject', 'body'],
        providedFields: Object.keys(sourceValues),
      }
    );
  }

  // Build RFC 2822 MIME message
  let message = '';
  message += `To: ${to}\r\n`;
  message += `Subject: ${subject}\r\n`;
  if (cc) message += `Cc: ${cc}\r\n`;
  if (bcc) message += `Bcc: ${bcc}\r\n`;
  message += `Content-Type: ${isHtml ? 'text/html' : 'text/plain'}; charset="UTF-8"\r\n`;
  message += 'Content-Transfer-Encoding: 7bit\r\n';
  message += '\r\n'; // Empty line separates headers from body
  message += body;

  // Convert to base64url
  const base64 = Buffer.from(message).toString('base64');
  // Replace standard base64 characters with URL-safe variants, then strip
  // trailing padding. Use while+endsWith instead of a regex to avoid ReDoS.
  let result = base64.replace(/\+/g, '-').replace(/\//g, '_');
  while (result.endsWith('=')) result = result.slice(0, -1);
  return result;
}

/**
 * Encode parameters as URL-encoded form data
 */
function encodeUrlParams(sourceValues: Record<string, unknown>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(sourceValues)) {
    if (value !== undefined && value !== null) {
      params.append(key, String(value));
    }
  }
  return params.toString();
}

/**
 * Example usage in YAML:
 *
 * execution:
 *   type: http
 *   method: POST
 *   url: 'https://www.googleapis.com/gmail/v1/users/me/messages/send'
 *   headers:
 *     Content-Type: 'application/json'
 *     Authorization: 'Bearer {GMAIL_ACCESS_TOKEN}'
 *
 *   parameter_encoding:
 *     - source: [to, subject, body, cc, bcc, isHtml]
 *       target: raw
 *       encoding: mime_rfc2822_base64url
 *
 *   body:
 *     raw: '{raw}'
 *
 * Then users call:
 *   matimo.execute('gmail-send-email', {
 *     to: 'user@example.com',
 *     subject: 'Hello',
 *     body: 'Hi there',
 *     GMAIL_ACCESS_TOKEN: token
 *   });
 */
