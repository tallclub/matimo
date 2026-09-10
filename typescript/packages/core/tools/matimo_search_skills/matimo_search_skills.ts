import { getGlobalMatimoInstance, getGlobalMatimoLogger } from '@matimo/core';

interface SearchSkillsParams {
  query: string;
  limit?: number;
  min_score?: number;
}

interface SkillSearchHit {
  name: string;
  description: string;
  relevanceScore: number;
}

interface SearchSkillsResult {
  success: boolean;
  query: string;
  results: SkillSearchHit[];
  total: number;
  message: string;
}

/**
 * Semantic search across all loaded skills — thin wrapper around
 * `MatimoInstance.semanticSearchSkills()`, exposed as an agent-callable
 * meta-tool so LangChain agents and MCP clients can rank skills by meaning
 * instead of exact keyword/name match.
 *
 * @see https://agentskills.io/specification
 */
export default async function matimoSearchSkills(
  params: SearchSkillsParams,
): Promise<SearchSkillsResult> {
  const logger = getGlobalMatimoLogger();
  const query = (params.query ?? '').trim();

  if (!query) {
    return { success: false, query, results: [], total: 0, message: 'Search query is required' };
  }

  const limit = params.limit ?? 10;
  const minScore = params.min_score ?? 0.1;

  let instance: ReturnType<typeof getGlobalMatimoInstance> | null;
  try {
    instance = getGlobalMatimoInstance();
  } catch {
    instance = null;
  }

  if (!instance) {
    return {
      success: false,
      query,
      results: [],
      total: 0,
      message:
        'No active Matimo instance found. Semantic skill search requires an initialized MatimoInstance.',
    };
  }

  try {
    const hits = await instance.semanticSearchSkills(query, { limit, minScore });
    const results: SkillSearchHit[] = hits.map((hit) => ({
      name: hit.skill.name,
      description: hit.skill.description,
      relevanceScore: hit.score,
    }));

    logger.debug('matimo_search_skills: search complete', { query, count: results.length });

    return {
      success: true,
      query,
      results,
      total: results.length,
      message: `Found ${results.length} matching skill(s).`,
    };
  } catch (err) {
    const errorMsg = (err as Error).message;
    logger.error('matimo_search_skills: search failed', { query, error: errorMsg });
    return { success: false, query, results: [], total: 0, message: `Search failed: ${errorMsg}` };
  }
}
