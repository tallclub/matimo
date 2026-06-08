/**
 * ms_search_knowledge — POST /search/query
 * https://learn.microsoft.com/en-us/graph/api/search-query
 */
import { MatimoError, ErrorCode } from '@matimo/core';
import { getAccessToken, requireParams, graphRequest, type ToolContext } from '../graph-client';

const VALID_ENTITY_TYPES = ['driveItem', 'listItem', 'site', 'list', 'drive'];
const DEFAULT_ENTITY_TYPES = ['driveItem', 'listItem', 'site'];
const DEFAULT_TOP = 10;
const MAX_TOP = 25;

interface SearchHit {
  hitId?: string;
  rank?: number;
  summary?: string;
  resource?: {
    id?: string;
    name?: string;
    webUrl?: string;
    lastModifiedDateTime?: string;
  };
}

interface SearchResponse {
  value?: Array<{
    hitsContainers?: Array<{
      total?: number;
      hits?: SearchHit[];
    }>;
  }>;
}

export default async function execute(
  params: Record<string, unknown>,
  context?: ToolContext
): Promise<unknown> {
  requireParams(params, ['query'], 'ms_search_knowledge');

  const query = String(params.query);

  const entityTypes = Array.isArray(params.entity_types)
    ? (params.entity_types as unknown[]).map(String)
    : DEFAULT_ENTITY_TYPES;

  const invalidEntityTypes = entityTypes.filter((t) => !VALID_ENTITY_TYPES.includes(t));
  if (entityTypes.length === 0 || invalidEntityTypes.length > 0) {
    throw new MatimoError(
      `ms_search_knowledge: invalid entity_types ${JSON.stringify(invalidEntityTypes)}. ` +
        `Valid values are: ${VALID_ENTITY_TYPES.join(', ')}`,
      ErrorCode.VALIDATION_FAILED,
      { entityTypes, invalidEntityTypes }
    );
  }

  const top = params.top === undefined ? DEFAULT_TOP : Number(params.top);
  if (!Number.isFinite(top) || top < 1 || top > MAX_TOP) {
    throw new MatimoError(
      `ms_search_knowledge: 'top' must be a number between 1 and ${MAX_TOP} (received ${String(params.top)})`,
      ErrorCode.VALIDATION_FAILED,
      { top: params.top }
    );
  }

  // Microsoft Search has no dedicated site/drive filter for driveItem/listItem/site
  // entity types — fold the IDs into the query string as a best-effort scoping hint.
  // This is documented in the tool description so callers don't expect a hard filter.
  const scopeHints = [params.site_id, params.drive_id].filter(
    (value): value is string => typeof value === 'string' && value.length > 0
  );
  const queryString = scopeHints.length > 0 ? `${query} ${scopeHints.join(' ')}` : query;

  const token = getAccessToken(context);

  const data = await graphRequest<SearchResponse>({
    method: 'POST',
    path: '/search/query',
    token,
    resourceType: 'Search results',
    body: {
      requests: [
        {
          entityTypes,
          query: { queryString },
          from: 0,
          size: top,
        },
      ],
    },
  });

  const container = data?.value?.[0]?.hitsContainers?.[0];
  const hits = container?.hits ?? [];

  const results = hits.map((hit) => ({
    id: hit.resource?.id ?? hit.hitId ?? '',
    name: hit.resource?.name ?? '',
    summary: hit.summary ?? '',
    web_url: hit.resource?.webUrl ?? '',
    last_modified: hit.resource?.lastModifiedDateTime ?? '',
    score: hit.rank ?? 0,
  }));

  return {
    success: true,
    results,
    total_count: container?.total ?? results.length,
  };
}
