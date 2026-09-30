import { RankedTool } from '../tool-selection/tool-selection-matcher.js';

export interface CaseScore {
  prompt: string;
  expectedTool: string;
  rank: number; // 1-based position of expectedTool in the ranking; -1 if absent
  topK: number;
  /** rank === 1 */
  precisionHit: boolean;
  /** rank !== -1 && rank <= topK */
  recallHit: boolean;
}

/**
 * Score one fixture case against a ranked tool list.
 * Precision = the expected tool is the single best match (rank 1).
 * Recall (band) = the expected tool is at least within the fixture's
 * declared `topK`, for legitimately near-duplicate tools where strict
 * top-1 isn't realistic.
 */
export function scoreCase(
  prompt: string,
  expectedTool: string,
  ranked: RankedTool[],
  topK = 1
): CaseScore {
  const rank = ranked.findIndex((r) => r.name === expectedTool) + 1 || -1;
  return {
    prompt,
    expectedTool,
    rank,
    topK,
    precisionHit: rank === 1,
    recallHit: rank !== -1 && rank <= topK,
  };
}

export interface AggregateScore {
  total: number;
  precisionHits: number;
  recallHits: number;
  precision: number;
  recall: number;
  failures: CaseScore[];
}

/**
 * Aggregate scores across every case in a tool-selection eval run. A case "passes" the
 * suite when it clears its own recall band (topK, default 1 = strict
 * top-1); `failures` lists every case that didn't.
 */
export function aggregateScores(scores: CaseScore[]): AggregateScore {
  const total = scores.length;
  const precisionHits = scores.filter((s) => s.precisionHit).length;
  const recallHits = scores.filter((s) => s.recallHit).length;
  return {
    total,
    precisionHits,
    recallHits,
    precision: total === 0 ? 1 : precisionHits / total,
    recall: total === 0 ? 1 : recallHits / total,
    failures: scores.filter((s) => !s.recallHit),
  };
}
