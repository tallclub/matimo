import { TfIdfEmbeddingProvider, cosineSimilarity } from '../../../src/core/tfidf-embedding';

describe('TfIdfEmbeddingProvider', () => {
  let provider: TfIdfEmbeddingProvider;

  beforeEach(() => {
    provider = new TfIdfEmbeddingProvider();
  });

  describe('fit', () => {
    it('should build vocabulary from documents', () => {
      provider.fit(['hello world', 'world of code']);
      expect(provider.dimensions).toBeGreaterThan(0);
    });

    it('should handle empty corpus', () => {
      provider.fit([]);
      expect(provider.dimensions).toBe(0);
    });
  });

  describe('embed', () => {
    it('should return vector of correct dimensions', async () => {
      provider.fit(['database queries', 'messaging api', 'email sending']);
      const vec = await provider.embed('database queries');
      expect(vec).toHaveLength(provider.dimensions);
    });

    it('should return empty array before fit', async () => {
      const vec = await provider.embed('anything');
      expect(vec).toHaveLength(0);
    });

    it('should produce normalized vectors (L2 norm ≈ 1)', async () => {
      provider.fit(['postgres database query', 'slack messaging api']);
      const vec = await provider.embed('postgres database query');
      const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
      // Normalized vectors should have L2 norm close to 1
      if (norm > 0) {
        expect(norm).toBeCloseTo(1.0, 3);
      }
    });
  });

  describe('embedBatch', () => {
    it('should embed multiple texts', async () => {
      provider.fit(['hello', 'world', 'test']);
      const vecs = await provider.embedBatch(['hello', 'world']);
      expect(vecs).toHaveLength(2);
      expect(vecs[0]).toHaveLength(provider.dimensions);
    });
  });

  describe('semantic similarity', () => {
    it('should rank similar text higher than dissimilar text', async () => {
      const docs = [
        'postgres database query operations locking connection pooling',
        'slack messaging channel posts notifications',
        'email sending smtp gmail inbox',
        'database sql transactions indexes performance',
      ];
      provider.fit(docs);

      const query = await provider.embed('database query postgres');
      const dbVec = await provider.embed(docs[0]);
      const slackVec = await provider.embed(docs[1]);
      const dbVec2 = await provider.embed(docs[3]);

      const dbScore = cosineSimilarity(query, dbVec);
      const slackScore = cosineSimilarity(query, slackVec);
      const dbScore2 = cosineSimilarity(query, dbVec2);

      // Database docs should be more similar to a database query
      expect(dbScore).toBeGreaterThan(slackScore);
      expect(dbScore2).toBeGreaterThan(slackScore);
    });
  });
});

describe('cosineSimilarity', () => {
  it('should return 1 for identical vectors', () => {
    expect(cosineSimilarity([1, 0, 0], [1, 0, 0])).toBeCloseTo(1.0);
  });

  it('should return 0 for orthogonal vectors', () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0.0);
  });

  it('should return 0 for empty vectors', () => {
    expect(cosineSimilarity([], [])).toBe(0);
  });

  it('should return 0 for mismatched lengths', () => {
    expect(cosineSimilarity([1, 2], [1, 2, 3])).toBe(0);
  });

  it('should handle negative components', () => {
    expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1.0);
  });
});
