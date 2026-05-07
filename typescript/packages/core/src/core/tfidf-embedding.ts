/**
 * TF-IDF Embedding Provider — zero-dependency semantic search
 * (Term Frequency–Inverse Document Frequency)
 * Provides a lightweight text-to-vector implementation using TF-IDF (Term
 * Frequency–Inverse Document Frequency) for cosine-similarity ranking. This
 * is good enough for 10–200 skills. For production enterprise deployments,
 * plug in an OpenAI/Cohere `EmbeddingProvider` instead.
 *
 * No external dependencies — works out of the box.
 */

import { EmbeddingProvider } from './types.js';

/**
 * Simple TF-IDF based embedding provider.
 * Builds a vocabulary from the registered corpus and represents each text as
 * a TF-IDF weighted vector.
 */
export class TfIdfEmbeddingProvider implements EmbeddingProvider {
  private vocabulary: Map<string, number> = new Map();
  private idf: Float64Array = new Float64Array(0);
  private corpusSize = 0;
  private _dimensions = 0;

  get dimensions(): number {
    return this._dimensions;
  }

  /**
   * Build the vocabulary and IDF weights from a corpus of documents.
   * Must be called before `embed()` or `embedBatch()`.
   */
  fit(documents: string[]): void {
    this.vocabulary.clear();
    this.corpusSize = documents.length;

    // Build vocabulary (unique terms across all documents)
    const docFrequency = new Map<string, number>();
    for (const doc of documents) {
      const terms = this.tokenize(doc);
      const uniqueTerms = new Set(terms);
      for (const term of uniqueTerms) {
        docFrequency.set(term, (docFrequency.get(term) || 0) + 1);
      }
    }

    // Assign indices and compute IDF
    let idx = 0;
    const idfValues: number[] = [];
    for (const [term, df] of docFrequency) {
      this.vocabulary.set(term, idx++);
      // Smooth IDF: log((N + 1) / (df + 1)) + 1
      idfValues.push(Math.log((this.corpusSize + 1) / (df + 1)) + 1);
    }

    this._dimensions = idfValues.length;
    this.idf = new Float64Array(idfValues);
  }

  async embed(text: string): Promise<number[]> {
    return this.embedSync(text);
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    return texts.map((t) => this.embedSync(t));
  }

  /**
   * Synchronous embed for internal use (no async overhead).
   */
  embedSync(text: string): number[] {
    if (this._dimensions === 0) {
      return [];
    }

    const terms = this.tokenize(text);
    const tf = new Float64Array(this._dimensions);

    // Count term frequencies
    for (const term of terms) {
      const idx = this.vocabulary.get(term);
      if (idx !== undefined) {
        tf[idx]++;
      }
    }

    // Normalize TF (sublinear: 1 + log(tf) if tf > 0)
    for (let i = 0; i < this._dimensions; i++) {
      if (tf[i] > 0) {
        tf[i] = (1 + Math.log(tf[i])) * this.idf[i];
      }
    }

    // L2 normalize
    let norm = 0;
    for (let i = 0; i < this._dimensions; i++) {
      norm += tf[i] * tf[i];
    }
    norm = Math.sqrt(norm);
    if (norm > 0) {
      for (let i = 0; i < this._dimensions; i++) {
        tf[i] /= norm;
      }
    }

    return Array.from(tf);
  }

  /**
   * Tokenize text into lowercase terms.
   * Splits on non-alphanumeric characters and filters stopwords.
   */
  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length > 1 && !STOPWORDS.has(t));
  }
}

/**
 * Cosine similarity between two vectors.
 * Returns a value between -1 and 1 (1 = identical, 0 = orthogonal).
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dot / denominator;
}

/** Common English stopwords to exclude from TF-IDF */
const STOPWORDS = new Set([
  'a',
  'an',
  'the',
  'and',
  'or',
  'but',
  'in',
  'on',
  'at',
  'to',
  'for',
  'of',
  'with',
  'by',
  'from',
  'is',
  'it',
  'as',
  'be',
  'was',
  'are',
  'this',
  'that',
  'not',
  'do',
  'if',
  'so',
  'no',
  'up',
  'my',
  'we',
  'he',
  'she',
  'they',
  'you',
  'me',
  'us',
  'all',
  'can',
  'had',
  'has',
  'have',
  'will',
  'would',
  'could',
  'should',
  'may',
  'might',
  'shall',
  'been',
  'being',
  'were',
  'did',
  'does',
  'its',
  'than',
  'then',
  'when',
  'what',
  'which',
  'who',
  'how',
  'there',
  'here',
  'about',
  'into',
  'over',
  'after',
  'also',
  'each',
  'just',
  'only',
  'very',
]);
