import axios, { AxiosRequestConfig } from 'axios';
import { ToolDefinition } from '../core/schema';
import { applyParameterEncodings } from '../encodings/parameter-encoding';
import { MatimoError, ErrorCode, fromHttpError } from '../errors/matimo-error';

/**
 * HttpExecutor - Executes HTTP requests
 * Handles authentication, retries, and response validation
 */

export class HttpExecutor {
  /**
   * Execute a tool that makes an HTTP request.
   *
   * @param tool - Tool definition
   * @param params - Tool parameters (already env-injected by MatimoInstance)
   * @param credentials - Optional per-call credential overrides. Used for
   *   `authentication.type: basic` (username_env / password_env keys) instead of
   *   reading from `process.env`. Other auth schemes (bearer, api_key) are handled
   *   upstream via parameter templating in MatimoInstance.injectAuthParameters().
   *   Values are never logged.
   */
  async execute(
    tool: ToolDefinition,
    params: Record<string, unknown>,
    credentials?: Record<string, string>
  ): Promise<unknown> {
    if (tool.execution.type !== 'http') {
      throw new MatimoError('Tool execution type is not http', ErrorCode.EXECUTION_FAILED, {
        expectedType: 'http',
        actualType: tool.execution.type,
      });
    }

    const {
      method,
      url,
      headers = {},
      body,
      timeout,
      query_params,
      parameter_encoding,
    } = tool.execution;
    const queryParams = query_params;
    const parameterEncodings = parameter_encoding;

    // Apply parameter encodings (e.g., MIME encoding for email parameters)
    let finalParams = params;
    if (parameterEncodings && parameterEncodings.length > 0) {
      finalParams = applyParameterEncodings(params, parameterEncodings);
    }

    // Validate URL parameters are provided
    this.validateUrlParameters(url, finalParams);

    // Implement parameter templating
    let finalUrl = this.templateString(url, finalParams);

    // Handle query parameters - only include non-empty ones
    if (queryParams) {
      const queryString = this.buildQueryString(queryParams, finalParams);
      if (queryString) {
        finalUrl += '?' + queryString;
      }
    }

    const templatedHeaders = this.templateObject(headers, finalParams, tool.parameters);

    // Natively handle HTTP Basic Auth when authentication.type === 'basic' and
    // username_env/password_env are declared. This eliminates the need for
    // developers to pre-compute base64 credentials as a separate env var step.
    // Credentials override takes precedence over process.env when provided.
    this.applyBasicAuth(tool, templatedHeaders as Record<string, string>, credentials);
    const templatedBody =
      body && typeof body === 'object'
        ? this.templateObject(body as Record<string, unknown>, finalParams, tool.parameters)
        : typeof body === 'string'
          ? this.templateString(body, finalParams)
          : body;

    // Build request config
    const requestConfig: AxiosRequestConfig = {
      method,
      url: finalUrl,
    };

    if (Object.keys(templatedHeaders).length > 0) {
      requestConfig.headers = templatedHeaders as Record<string, string>;
    }

    if (templatedBody !== undefined) {
      // If Content-Type is application/x-www-form-urlencoded and body is an object,
      // convert to URLSearchParams for proper form encoding by axios
      const contentType =
        (templatedHeaders as Record<string, string>)['Content-Type'] ||
        (templatedHeaders as Record<string, string>)['content-type'];

      if (
        contentType?.includes('application/x-www-form-urlencoded') &&
        typeof templatedBody === 'object' &&
        templatedBody !== null &&
        !(templatedBody instanceof FormData)
      ) {
        const params = new URLSearchParams();
        for (const [key, value] of Object.entries(templatedBody as Record<string, unknown>)) {
          if (value !== undefined && value !== null) {
            params.append(key, String(value));
          }
        }
        requestConfig.data = params;
      } else {
        requestConfig.data = templatedBody;
      }
    }

    if (timeout !== undefined) {
      requestConfig.timeout = timeout;
    }

    try {
      const response = await axios.request(requestConfig);

      const success = response.status >= 200 && response.status < 300;
      return {
        success,
        data: response.data,
        statusCode: response.status,
        headers: response.headers,
      };
    } catch (error) {
      // If this is already a MatimoError, rethrow to preserve semantics
      if (error instanceof MatimoError) {
        throw error;
      }

      // Normalize any HTTP/axios-like or generic errors into MatimoError.
      // This keeps callers consistent and preserves original cause via details.cause.
      throw fromHttpError(error, 'HTTP request failed');
    }
  }

  /**
   * Automatically inject `Authorization: Basic <base64(username:password)>` when
   * the tool declares `authentication.type: basic` with `username_env` and `password_env`.
   *
   * This is a zero-friction pattern: developers only set two natural env vars
   * (e.g. TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN) and Matimo handles encoding.
   * No pre-computed base64 credential string required.
   *
   * When `credentials` is provided the lookup order is:
   *   1. `credentials[envVarName]`  (per-call override — multi-tenant use)
   *   2. `process.env[envVarName]`  (singleton / single-tenant fallback)
   *
   * Credential values are never logged or included in error details.
   */
  private applyBasicAuth(
    tool: ToolDefinition,
    headers: Record<string, string>,
    credentials?: Record<string, string>
  ): void {
    const auth = tool.authentication;
    if (auth?.type !== 'basic' || !auth.username_env || !auth.password_env) {
      return;
    }

    // Prefer per-call credentials, fall back to process.env
    const username =
      (credentials && credentials[auth.username_env]) ?? process.env[auth.username_env];
    const password =
      (credentials && credentials[auth.password_env]) ?? process.env[auth.password_env];

    if (!username || !password) {
      throw new MatimoError(
        `Basic Auth requires env vars '${auth.username_env}' and '${auth.password_env}' to be set`,
        ErrorCode.AUTH_FAILED,
        { toolName: tool.name, username_env: auth.username_env, password_env: auth.password_env }
      );
    }

    const encoded = Buffer.from(`${username}:${password}`).toString('base64');
    headers['Authorization'] = `Basic ${encoded}`;
  }

  /**
   * Replace parameter placeholders in a string
   */
  private templateString(str: string, params: Record<string, unknown>): string {
    let result = str;
    for (const [key, value] of Object.entries(params)) {
      const placeholder = `{${key}}`;
      // Allow empty-string values to be substituted (validation allows empty strings)
      if (value !== undefined && value !== null) {
        result = result.replace(new RegExp(placeholder, 'g'), String(value));
      }
    }
    return result;
  }

  /**
   * Check if a string is an unfilled placeholder
   * Only matches single placeholders like "{param}", not "{...}" or embedded placeholders
   */
  private isUnfilledPlaceholder(str: string): boolean {
    // Match exactly "{word}" where word is a valid identifier
    return /^\{[a-zA-Z_][a-zA-Z0-9_]*\}$/.test(str);
  }

  /**
   * Validate that all URL parameters are provided
   */
  private validateUrlParameters(url: string, params: Record<string, unknown>): void {
    // Extract all placeholders from URL like {param_name}
    const urlParamMatches = url.match(/\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g);
    if (!urlParamMatches) {
      return; // No parameters in URL
    }

    for (const match of urlParamMatches) {
      const paramName = match.slice(1, -1); // Remove { }
      const paramValue = params[paramName];

      // Check if parameter is missing or undefined
      if (paramValue === undefined) {
        throw new MatimoError(
          `Required URL parameter '${paramName}' is missing`,
          ErrorCode.INVALID_SCHEMA,
          { url, missingParam: paramName }
        );
      }

      // Allow null, empty string, 0, false, etc. as valid values
      // Just ensure the parameter is defined
    }
  }

  /**
   * Build query string from query_params, only including provided values
   */
  private buildQueryString(
    queryParams: Record<string, string>,
    params: Record<string, unknown>
  ): string {
    const parts: string[] = [];
    for (const [key, template] of Object.entries(queryParams)) {
      const value = this.templateString(template, params);
      // Only include if not empty and didn't result in "{param}" (unfilled placeholder)
      if (value && !value.startsWith('{')) {
        parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
      }
    }
    return parts.join('&');
  }

  /**
   * Replace parameter placeholders in an object (headers, body, query params)
   *
   * CORE PRINCIPLE: "Define once in YAML, embed correctly at execution time"
   *
   * This method intelligently handles different parameter types:
   * - STRING placeholders like "{title}": Always templated as strings
   * - OBJECT placeholders like "{parent}": Embedded directly as JSON objects (not stringified) if paramDefinitions specifies type:object
   * - ARRAY placeholders like "{items}": Embedded directly as JSON arrays (not stringified) if paramDefinitions specifies type:array
   *
   * Key behaviors:
   * - Recursively processes nested objects
   * - Skips keys with unfilled placeholders (e.g., "{sort_by}" when sort_by not provided)
   * - Uses parameter schema type from YAML to determine how to embed values
   * - Preserves JSON structure for complex types (objects/arrays) sent to APIs
   *
   * @example
   * ```
   * // YAML definition:
   * parameters:
   *   parent:
   *     type: object  // <-- Tells executor to embed as-is, not stringify
   *   items:
   *     type: array   // <-- Tells executor to embed as-is, not stringify
   *   title:
   *     type: string  // <-- String templating applies
   *
   * body:
   *   parent: "{parent}"  // Object embedded as {"id": "123", ...}
   *   items: "{items}"    // Array embedded as [{"name": "a"}, ...]
   *   title: "{title}"    // String embedded as "My Title"
   *
   * // JavaScript call:
   * const result = await matimo.execute('notion_create_page', {
   *   parent: { database_id: 'abc123' },  // JavaScript object
   *   items: [{ type: 'text' }],          // JavaScript array
   *   title: 'Create This Page'           // String
   * });
   *
   * // HTTP body sent to API:
   * {
   *   "parent": {"database_id": "abc123"},     // Proper JSON object
   *   "items": [{"type": "text"}],            // Proper JSON array
   *   "title": "Create This Page"             // String
   * }
   * ```
   */
  private templateObject(
    obj: Record<string, unknown>,
    params: Record<string, unknown>,
    paramDefinitions?: Record<string, { type: string }>
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        // Check if this is exactly a placeholder like "{parent}"
        const paramNameMatch = value.match(/^\{([a-zA-Z_][a-zA-Z0-9_]*)\}$/);

        if (paramNameMatch) {
          const paramName = paramNameMatch[1];
          const paramValue = params[paramName];

          // If parameter is defined in schema with type object or array,
          // embed the value directly instead of stringifying
          if (paramValue !== undefined && paramDefinitions?.[paramName]) {
            const paramType = paramDefinitions[paramName].type;
            if ((paramType === 'object' || paramType === 'array') && paramValue !== null) {
              result[key] = paramValue;
              continue;
            }
          }
        }

        // Otherwise, do normal string templating
        const templated = this.templateString(value, params);
        if (
          templated !== undefined &&
          templated !== null &&
          !this.isUnfilledPlaceholder(templated)
        ) {
          // Extract parameter name from template (e.g., "{page_size}" → "page_size")
          const paramName = paramNameMatch ? paramNameMatch[1] : null;

          // If this is a single parameter placeholder, use the parameter's defined type
          if (paramName && paramDefinitions?.[paramName]) {
            const paramType = paramDefinitions[paramName].type;
            if (paramType === 'number' && !isNaN(Number(templated))) {
              result[key] = Number(templated);
            } else if (paramType === 'boolean') {
              result[key] = templated === 'true' || templated === '1' || templated === 'yes';
            } else {
              result[key] = templated;
            }
          } else {
            result[key] = templated;
          }
        }
      } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        // Recursively template nested objects
        const nestedResult = this.templateObject(
          value as Record<string, unknown>,
          params,
          paramDefinitions
        );
        // Only include nested object if it has content
        if (Object.keys(nestedResult).length > 0) {
          result[key] = nestedResult;
        }
      } else if (Array.isArray(value)) {
        // Handle arrays of objects
        const templatedArray = value
          .map((item) => {
            if (typeof item === 'string') {
              const templated = this.templateString(item, params);
              // Skip unfilled placeholders; allow empty strings
              if (
                templated !== undefined &&
                templated !== null &&
                !this.isUnfilledPlaceholder(templated)
              ) {
                // Extract parameter name from template
                const paramNameMatch = item.match(/^\{([a-zA-Z_][a-zA-Z0-9_]*)\}$/);
                const paramName = paramNameMatch ? paramNameMatch[1] : null;

                // If this is a single parameter placeholder, use the parameter's defined type
                if (paramName && paramDefinitions?.[paramName]) {
                  const paramType = paramDefinitions[paramName].type;
                  if (paramType === 'number' && !isNaN(Number(templated))) {
                    return Number(templated);
                  } else if (paramType === 'boolean') {
                    return templated === 'true' || templated === '1' || templated === 'yes';
                  }
                }
                return templated;
              }
              return null;
            } else if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
              const templated = this.templateObject(
                item as Record<string, unknown>,
                params,
                paramDefinitions
              );
              // Only include if has content
              return Object.keys(templated).length > 0 ? templated : null;
            }
            return item;
          })
          .filter((item) => item !== null);
        // Only include array if it has items
        if (templatedArray.length > 0) {
          result[key] = templatedArray;
        }
      } else if (value !== undefined && value !== null) {
        result[key] = value;
      }
    }
    return result;
  }
}

export default HttpExecutor;
