import { TfIdfEmbeddingProvider, cosineSimilarity } from '@matimo/core';

/**
 * Minimal shape needed to rank a tool — deliberately narrower than
 * ToolDefinition so callers don't need a fully validated tool to build a
 * corpus entry.
 */
export interface ToolCorpusEntry {
  name: string;
  description: string;
  parameterDescriptions: string[];
}

export interface RankedTool {
  name: string;
  score: number;
}

/**
 * Ranks tools against a natural-language prompt using TF-IDF cosine
 * similarity — the same deterministic, zero-API-cost mechanism
 * `SkillRegistry.search({ semantic: true })` already uses for skill
 * discovery. Stands in for "would an external LLM pick the right tool from
 * its description?" without ever calling a model.
 */
export class ToolSelectionMatcher {
  private readonly provider = new TfIdfEmbeddingProvider();

  constructor(private readonly corpus: ToolCorpusEntry[]) {}

  /**
   * Rank every tool in the corpus against `prompt`, most similar first.
   */
  rank(prompt: string): RankedTool[] {
    const toolTexts = this.corpus.map((tool) => this.toolToText(tool));
    // Refit per query, including the query itself in the vocabulary — mirrors
    // SkillRegistry.rankBySimilarity so short prompts still get meaningful IDF weights.
    this.provider.fit([...toolTexts, prompt]);

    const promptVector = this.provider.embedSync(prompt);
    const toolVectors = toolTexts.map((text) => this.provider.embedSync(text));

    return this.corpus
      .map((tool, index) => ({
        name: tool.name,
        score: cosineSimilarity(promptVector, toolVectors[index]),
      }))
      .sort((a, b) => b.score - a.score);
  }

  private toolToText(tool: ToolCorpusEntry): string {
    return [tool.name.replace(/[-_]/g, ' '), tool.description, ...tool.parameterDescriptions].join(
      ' '
    );
  }
}
