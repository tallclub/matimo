import axios from 'axios';
import { MatimoError, ErrorCode } from '@matimo/core';

interface Params {
  parent?: Record<string, unknown>;
  properties?: Record<string, unknown>;
  icon?: Record<string, unknown>;
  cover?: Record<string, unknown>;
  children?: unknown[];
  markdown?: string;
  template?: Record<string, unknown>;
  position?: Record<string, unknown>;
}

function markdownToChildren(md: string): unknown[] {
  // Very small converter: split paragraphs and handle headings (#, ##, ###)
  const parts = md.split(/\n\n+/).map((p) => p.trim()).filter(Boolean);
  const blocks: unknown[] = [];

  for (const part of parts) {
    if (part.startsWith('# ')) {
      blocks.push({
        object: 'block',
        type: 'heading_1',
        heading_1: { rich_text: [{ type: 'text', text: { content: part.replace(/^#\s+/, '') } }] },
      });
    } else if (part.startsWith('## ')) {
      blocks.push({
        object: 'block',
        type: 'heading_2',
        heading_2: { rich_text: [{ type: 'text', text: { content: part.replace(/^##\s+/, '') } }] },
      });
    } else if (part.startsWith('### ')) {
      blocks.push({
        object: 'block',
        type: 'heading_3',
        heading_3: { rich_text: [{ type: 'text', text: { content: part.replace(/^###\s+/, '') } }] },
      });
    } else {
      blocks.push({
        object: 'block',
        type: 'paragraph',
        paragraph: { rich_text: [{ type: 'text', text: { content: part } }] },
      });
    }
  }

  return blocks;
}

export default async function createPage(params: Params) {
  const {
    parent: userProvidedParent,
    properties,
    icon,
    cover,
    children,
    markdown,
    template,
    position,
  } = params as Params;

  const apiKey = process.env.NOTION_API_KEY;
  if (!apiKey) {
    throw new MatimoError('NOTION_API_KEY not set', ErrorCode.AUTH_FAILED, {
      envVar: 'NOTION_API_KEY',
    });
  }

  // If no parent provided, auto-discover a database
  let parent = userProvidedParent;
  if (!parent || typeof parent !== 'object') {
    try {
      const response = await axios.get('https://api.notion.com/v1/databases', {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Notion-Version': '2025-09-03',
        },
        timeout: 15000,
        params: { page_size: 1 },
      });
      const databases = response.data?.results || [];
      if (databases.length > 0) {
        parent = { database_id: databases[0].id };
      } else {
        throw new MatimoError(
          'No databases found in workspace. Create a database first or provide `parent` parameter.',
          ErrorCode.VALIDATION_FAILED
        );
      }
    } catch (err) {
      if (axios.isAxiosError(err)) {
        throw new MatimoError(
          `Failed to auto-discover database: ${(err.response?.data as Record<string, unknown>)?.message || err.message}`,
          ErrorCode.EXECUTION_FAILED
        );
      }
      throw new MatimoError('Failed to auto-discover database', ErrorCode.EXECUTION_FAILED);
    }
  }

  // Validate parameters according to tool contract:
  // - If creating inside a database (`parent.database_id`), `properties` is required
  // - Either `children` or `markdown` can be provided, not both (empty children array is treated as not provided)
  // - When using `template`, `children` is not allowed
  const isDatabaseParent = parent && typeof parent === 'object' && Object.prototype.hasOwnProperty.call(parent, 'database_id');

  if (Array.isArray(children) && children.length > 0 && typeof markdown === 'string' && markdown.trim().length > 0) {
    throw new MatimoError('Provide either `children` or `markdown`, not both', ErrorCode.VALIDATION_FAILED, {
      parameters: { children: children.length, markdown: markdown.length },
    });
  }

  if (template && Array.isArray(children) && children.length > 0) {
    throw new MatimoError('`template` cannot be used together with `children`. Omit `children` when using `template`', ErrorCode.VALIDATION_FAILED, {
      parameters: { template: !!template, children: children.length },
    });
  }

  // Allow generating a minimal title property from `markdown` when creating in a database.
  // If caller didn't provide `properties`, we'll attempt several common title property names
  // (e.g., 'Name', 'Title') derived from the first markdown line. If none succeed,
  // we return the API error to the caller.
  const resolvedProperties = properties as Record<string, unknown> | undefined;
  let titleCandidates: string[] | undefined;

  if (isDatabaseParent) {
    const hasProperties = resolvedProperties && typeof resolvedProperties === 'object' && Object.keys(resolvedProperties).length > 0;

    if (!hasProperties) {
      if (typeof markdown === 'string' && markdown.trim().length > 0) {
        // Candidate property names to try when the database title property name is unknown
        titleCandidates = ['Name', 'Title', 'title', 'name'].map((k) => k);

        // We'll construct properties later per candidate when sending the request.
        // Use resolvedProperties only if caller provided it explicitly.
      } else {
        throw new MatimoError('Creating a page in a database requires `properties` (at minimum a title property)', ErrorCode.VALIDATION_FAILED, {
          parent,
        });
      }
    }
  }

  // Convert markdown to children if provided and children not explicitly set
  let resolvedChildren = children;
  if ((!resolvedChildren || (Array.isArray(resolvedChildren) && resolvedChildren.length === 0)) && markdown) {
    resolvedChildren = markdownToChildren(markdown);
  }

  const baseBody: Record<string, unknown> = {
    parent,
  };

  if (resolvedProperties) baseBody.properties = resolvedProperties;
  if (icon) baseBody.icon = icon;
  if (cover) baseBody.cover = cover;
  if (resolvedChildren) baseBody.children = resolvedChildren;
  if (template) baseBody.template = template;
  if (position) baseBody.position = position;

  // Helper to send request with a given body
  const sendRequest = async (requestBody: Record<string, unknown>) => {
    return axios.post('https://api.notion.com/v1/pages', requestBody, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Notion-Version': '2025-09-03',
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    });
  };

  // If we have title candidates, try each one until a request succeeds.
  if (titleCandidates && titleCandidates.length > 0) {
    let lastError: unknown = null;
    const firstLine = markdown!.split(/\r?\n/)[0].replace(/^#+\s*/, '').trim() || 'New Page';

    for (const candidate of titleCandidates) {
      const candidateProps: Record<string, unknown> = {
        [candidate]: {
          title: [
            {
              text: { content: firstLine },
            },
          ],
        },
      };

      const tryBody = { ...baseBody, ...{ properties: candidateProps } } as Record<string, unknown>;

      try {
        const resp = await sendRequest(tryBody);
        return {
          success: true,
          statusCode: resp.status,
          data: resp.data,
        };
      } catch (err: unknown) {
        lastError = err;
        // If API returns validation error about missing property name, continue to next candidate.
          if (axios.isAxiosError(err)) {
            type NotionError = { message?: string; code?: string; request_id?: string };
            const errData = err.response?.data as NotionError | undefined;
            const message = errData?.message || '';
            if (typeof message === 'string' && /is not a property that exists/i.test(message)) {
              // try next candidate
              continue;
            }
          }
        // For other errors, break and return immediately
        break;
      }
    }

    // All candidates failed — return last error in a structured form
    if (axios.isAxiosError(lastError)) {
      type NotionError = { message?: string; code?: string; request_id?: string };
      const errData = lastError.response?.data as NotionError | undefined;
      const statusCode = lastError.response?.status || 0;
      return {
        success: false,
        statusCode,
        error: errData || (lastError as Error).message,
      };
    }

    return {
      success: false,
      statusCode: 0,
      error: String(lastError),
    };
  }

  // No candidate loop — send single request using baseBody (which may include provided properties)
  try {
    const resp = await sendRequest(baseBody);
    return {
      success: true,
      statusCode: resp.status,
      data: resp.data,
    };
  } catch (err: unknown) {
    if (axios.isAxiosError(err)) {
      // Wrap HTTP error from Notion in a MatimoError so callers can programmatically inspect it
      type NotionError = { message?: string; code?: string; request_id?: string };
      const errData = err.response?.data as NotionError | undefined;
      const details: Record<string, unknown> = {
        status: err.response?.status,
        code: errData?.code,
        request_id: errData?.request_id,
      };
      throw new MatimoError(errData?.message || 'Notion API error', ErrorCode.EXECUTION_FAILED, details);
    }

    // Non-HTTP error (network, unexpected) — wrap and throw
    throw new MatimoError(String(err), ErrorCode.UNKNOWN_ERROR);
  }
}
