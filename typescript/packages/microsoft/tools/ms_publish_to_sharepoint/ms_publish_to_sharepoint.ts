/**
 * ms_publish_to_sharepoint
 *   Create:  POST /sites/{site-id}/pages
 *            https://learn.microsoft.com/en-us/graph/api/sitepage-create
 *   Publish: POST /sites/{site-id}/pages/{page-id}/microsoft.graph.sitePage/publish
 *            https://learn.microsoft.com/en-us/graph/api/sitepage-publish
 *
 * Site pages always store web part bodies as HTML, so plain-text content is
 * HTML-escaped and wrapped in a single <p> before being placed in a textWebPart.
 */
import { MatimoError, ErrorCode } from '@matimo/core';
import { getAccessToken, requireParams, graphRequest, type ToolContext } from '../graph-client';

const VALID_CONTENT_TYPES = ['html', 'text'];

interface SitePage {
  id?: string;
  webUrl?: string;
}

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch]);
}

function deriveFileName(title: string): string {
  const slug = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${slug || 'page'}.aspx`;
}

export default async function execute(
  params: Record<string, unknown>,
  context?: ToolContext
): Promise<unknown> {
  requireParams(params, ['site_id', 'title', 'content'], 'ms_publish_to_sharepoint');

  const siteId = String(params.site_id);
  const title = String(params.title);

  const contentType = params.content_type === undefined ? 'html' : String(params.content_type);
  if (!VALID_CONTENT_TYPES.includes(contentType)) {
    throw new MatimoError(
      `ms_publish_to_sharepoint: 'content_type' must be one of ${VALID_CONTENT_TYPES.join(', ')} (received '${contentType}')`,
      ErrorCode.VALIDATION_FAILED,
      { content_type: params.content_type }
    );
  }

  const rawContent = String(params.content);
  const innerHtml = contentType === 'text' ? `<p>${escapeHtml(rawContent)}</p>` : rawContent;

  const shouldPublish = params.publish === undefined ? true : params.publish === true;

  const token = getAccessToken(context);

  const page = await graphRequest<SitePage>({
    method: 'POST',
    path: `/sites/${encodeURIComponent(siteId)}/pages`,
    token,
    resourceType: 'SharePoint site',
    body: {
      '@odata.type': '#microsoft.graph.sitePage',
      name: deriveFileName(title),
      title,
      pageLayout: 'article',
      canvasLayout: {
        horizontalSections: [
          {
            layout: 'oneColumn',
            id: '1',
            emphasis: 'none',
            columns: [
              {
                id: '1',
                width: 12,
                webparts: [
                  {
                    '@odata.type': '#microsoft.graph.textWebPart',
                    innerHtml,
                  },
                ],
              },
            ],
          },
        ],
      },
    },
  });

  const pageId = page?.id;
  if (!pageId) {
    throw new MatimoError(
      'ms_publish_to_sharepoint: Microsoft Graph did not return an ID for the created page.',
      ErrorCode.EXECUTION_FAILED,
      { page }
    );
  }

  if (shouldPublish) {
    await graphRequest({
      method: 'POST',
      path: `/sites/${encodeURIComponent(siteId)}/pages/${encodeURIComponent(pageId)}/microsoft.graph.sitePage/publish`,
      token,
      resourceType: 'SharePoint page',
      allowEmptyResponse: true,
    });
  }

  return {
    success: true,
    page_id: pageId,
    web_url: page?.webUrl ?? '',
    published: shouldPublish,
  };
}
