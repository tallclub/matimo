/**
 * Skill Registry — in-memory store and search for skills
 *
 * Mirrors ToolRegistry but for skills. Provides discovery, search, and filtering.
 * Supports both substring matching (default) and semantic search via pluggable embeddings.
 */

import {
  SkillDefinition,
  SkillSummary,
  SearchSkillsOptions,
  EmbeddingProvider,
  SkillContentOptions,
} from './types.js';
import { MatimoError, ErrorCode } from '../errors/matimo-error.js';
import { getGlobalMatimoLogger } from '../logging/index.js';
import { TfIdfEmbeddingProvider, cosineSimilarity } from './tfidf-embedding.js';
import {
  parseSkillSections,
  extractSkillContent,
  listSkillSections,
} from './skill-content-parser.js';
import type { ParsedSkillContent } from './skill-content-parser.js';

/**
 * Semantic search result with relevance score.
 */
export interface SemanticSearchResult {
  skill: SkillSummary;
  /** Cosine similarity score (0–1, higher = more relevant) */
  score: number;
}

export class SkillRegistry {
  private logger = getGlobalMatimoLogger();
  private skills = new Map<string, SkillDefinition>();

  /** Pluggable embedding provider for semantic search */
  private embeddingProvider: EmbeddingProvider | null = null;
  /** Cached embeddings: skill name → vector */
  private embeddings = new Map<string, number[]>();
  /** Whether embeddings need rebuilding */
  private embeddingsDirty = true;
  /** Cached parsed content for selective loading */
  private parsedContent = new Map<string, ParsedSkillContent>();

  /**
   * Set a custom embedding provider (OpenAI, Cohere, etc.).
   * If not set, a built-in TF-IDF provider is used as fallback.
   */
  setEmbeddingProvider(provider: EmbeddingProvider): void {
    this.embeddingProvider = provider;
    this.embeddingsDirty = true;
    this.logger.debug('SkillRegistry: custom embedding provider set');
  }

  /**
   * Register a single skill
   */
  register(skill: SkillDefinition): void {
    if (!skill.name) {
      throw new MatimoError('Skill must have a name', ErrorCode.INVALID_SCHEMA);
    }
    this.skills.set(skill.name, skill);
    this.embeddingsDirty = true;

    // Cache parsed sections for selective loading
    if (skill.body) {
      this.parsedContent.set(skill.name, parseSkillSections(skill.body));
    }

    this.logger.debug('SkillRegistry: skill registered', { name: skill.name });
  }

  /**
   * Register multiple skills
   */
  registerAll(skills: SkillDefinition[]): void {
    for (const skill of skills) {
      this.register(skill);
    }
  }

  /**
   * Get a single skill by name
   */
  get(name: string): SkillDefinition | undefined {
    return this.skills.get(name);
  }

  /**
   * Get a single skill by name (throws if not found)
   */
  getRequired(name: string): SkillDefinition {
    const skill = this.skills.get(name);
    if (!skill) {
      throw new MatimoError(`Skill not found: ${name}`, ErrorCode.TOOL_NOT_FOUND);
    }
    return skill;
  }

  /**
   * Get selective skill content — only the sections an agent needs.
   * This prevents dumping entire SKILL.md files into the LLM context.
   *
   * @example
   * // Get only the error handling section, max 500 tokens
   * registry.getSkillContent('postgres-query-operations', {
   *   sections: ['Error Handling'],
   *   maxTokens: 500,
   * })
   */
  getSkillContent(name: string, options?: SkillContentOptions): string | null {
    const parsed = this.parsedContent.get(name);
    if (!parsed) return null;
    return extractSkillContent(parsed, options);
  }

  /**
   * List all sections of a skill with their token costs.
   * Agents use this to decide which sections to load.
   */
  getSkillSections(
    name: string
  ): Array<{ path: string; level: number; tokenEstimate: number }> | null {
    const parsed = this.parsedContent.get(name);
    if (!parsed) return null;
    return listSkillSections(parsed);
  }

  /**
   * List all skills (Level 1 discovery — minimal context)
   */
  list(): SkillSummary[] {
    return Array.from(this.skills.values()).map((skill) => ({
      name: skill.name,
      description: skill.description,
      version: skill.version,
      license: skill.license,
      metadata: skill.metadata,
      source: skill.source,
    }));
  }

  /**
   * Search skills by keyword, category, difficulty, etc.
   *
   * When `options.semantic` is true, uses embedding-based similarity ranking
   * instead of substring matching. Falls back to built-in TF-IDF if no
   * external embedding provider is configured.
   */
  search(options: SearchSkillsOptions = {}): SkillSummary[] {
    const { query = '', category, difficulty, tags, author, limit = 50, offset = 0 } = options;

    let results = Array.from(this.skills.values());

    // Apply filters first (these are always exact/substring)
    if (category) {
      results = results.filter(
        (skill) => skill.metadata?.category?.toLowerCase() === category.toLowerCase()
      );
    }
    if (difficulty) {
      results = results.filter(
        (skill) => skill.metadata?.difficulty?.toLowerCase() === difficulty.toLowerCase()
      );
    }
    if (tags && tags.length > 0) {
      const metadataTags = tags.map((t) => t.toLowerCase());
      results = results.filter((skill) => {
        const skillTags = (skill.metadata?.tags || '')
          .split(',')
          .map((t) => t.trim().toLowerCase());
        return metadataTags.some((tag) => skillTags.includes(tag));
      });
    }
    if (author) {
      results = results.filter(
        (skill) => skill.metadata?.author?.toLowerCase() === author.toLowerCase()
      );
    }

    // Apply query filter (substring or semantic)
    if (query) {
      if (options.semantic) {
        // Semantic search: rank by embedding similarity
        const scored = this.rankBySimilarity(query, results);
        // Precompute a map for O(1) lookup by skill name
        const skillByName = new Map(results.map((skill) => [skill.name, skill] as const));
        results = scored
          .filter((r) => r.score > 0.1) // Minimum relevance threshold
          .sort((a, b) => b.score - a.score)
          .map((r) => skillByName.get(r.skill.name))
          .filter((skill): skill is NonNullable<typeof skill> => skill !== undefined);
      } else {
        // Substring search (original behavior)
        const lowerQuery = query.toLowerCase();
        results = results.filter((skill) => {
          const nameMatch = skill.name.toLowerCase().includes(lowerQuery);
          const descMatch = skill.description.toLowerCase().includes(lowerQuery);
          return nameMatch || descMatch;
        });
      }
    }

    // Pagination
    const paged = results.slice(offset, offset + limit);

    return paged.map((skill) => ({
      name: skill.name,
      description: skill.description,
      version: skill.version,
      license: skill.license,
      metadata: skill.metadata,
      source: skill.source,
    }));
  }

  /**
   * Semantic search with relevance scores.
   * Returns ranked results with cosine similarity scores.
   *
   * @example
   * const results = await registry.semanticSearch('How do I handle Postgres connection pooling?');
   * // → [{ skill: { name: 'postgres-query-operations', ... }, score: 0.82 }]
   */
  async semanticSearch(
    query: string,
    options: { limit?: number; minScore?: number } = {}
  ): Promise<SemanticSearchResult[]> {
    const { limit = 10, minScore = 0.1 } = options;

    await this.ensureEmbeddings();

    const provider = this.embeddingProvider || this.getDefaultProvider();
    const queryEmbedding = await provider.embed(query);

    const results: SemanticSearchResult[] = [];
    for (const [name, embedding] of this.embeddings) {
      const skill = this.skills.get(name);
      if (!skill) continue;

      const score = cosineSimilarity(queryEmbedding, embedding);
      if (score >= minScore) {
        results.push({
          skill: {
            name: skill.name,
            description: skill.description,
            version: skill.version,
            license: skill.license,
            metadata: skill.metadata,
            source: skill.source,
          },
          score,
        });
      }
    }

    return results.sort((a, b) => b.score - a.score).slice(0, limit);
  }

  /**
   * Get all skills (full definitions)
   */
  getAll(): SkillDefinition[] {
    return Array.from(this.skills.values());
  }

  /**
   * Check if a skill exists
   */
  has(name: string): boolean {
    return this.skills.has(name);
  }

  /**
   * Get the count of registered skills
   */
  count(): number {
    return this.skills.size;
  }

  /**
   * Clear all skills
   */
  clear(): void {
    this.skills.clear();
    this.embeddings.clear();
    this.parsedContent.clear();
    this.embeddingsDirty = true;
  }

  /**
   * Remove a skill
   */
  remove(name: string): boolean {
    this.embeddings.delete(name);
    this.parsedContent.delete(name);
    this.embeddingsDirty = true;
    return this.skills.delete(name);
  }

  // ─── Private: Embedding Management ──────────────────────────────────────

  /**
   * Ensure embeddings are computed and up-to-date.
   */
  private async ensureEmbeddings(): Promise<void> {
    if (!this.embeddingsDirty) return;

    const provider = this.embeddingProvider || this.getDefaultProvider();
    const skills = Array.from(this.skills.values());

    // Build text corpus: name + description + metadata tags
    const texts = skills.map((s) => this.skillToText(s));

    // If using TF-IDF, refit the vocabulary
    if (provider instanceof TfIdfEmbeddingProvider) {
      provider.fit(texts);
    }

    const vectors = await provider.embedBatch(texts);

    this.embeddings.clear();
    for (let i = 0; i < skills.length; i++) {
      this.embeddings.set(skills[i].name, vectors[i]);
    }

    this.embeddingsDirty = false;
  }

  /**
   * Synchronous ranking using TF-IDF (for the non-async search() method).
   */
  private rankBySimilarity(query: string, candidates: SkillDefinition[]): SemanticSearchResult[] {
    const provider = this.getDefaultProvider();

    // Build corpus from candidates
    const texts = candidates.map((s) => this.skillToText(s));
    provider.fit([...texts, query]); // Include query in vocab

    const queryVec = provider.embedSync(query);

    return candidates.map((skill) => {
      const skillVec = provider.embedSync(this.skillToText(skill));
      return {
        skill: {
          name: skill.name,
          description: skill.description,
          version: skill.version,
          license: skill.license,
          metadata: skill.metadata,
          source: skill.source,
        },
        score: cosineSimilarity(queryVec, skillVec),
      };
    });
  }

  /**
   * Get or create the default TF-IDF provider.
   */
  private defaultProvider: TfIdfEmbeddingProvider | null = null;
  private getDefaultProvider(): TfIdfEmbeddingProvider {
    if (!this.defaultProvider) {
      this.defaultProvider = new TfIdfEmbeddingProvider();
    }
    return this.defaultProvider;
  }

  /**
   * Convert a skill into a searchable text string for embedding.
   */
  private skillToText(skill: SkillDefinition): string {
    const parts = [skill.name.replace(/-/g, ' '), skill.description];
    if (skill.metadata?.tags) parts.push(skill.metadata.tags);
    if (skill.metadata?.category) parts.push(skill.metadata.category);
    if (skill.allowedTools) parts.push(skill.allowedTools.join(' '));
    return parts.join(' ');
  }
}
