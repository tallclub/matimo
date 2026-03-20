import { SkillRegistry } from '../../../src/core/skill-registry';
import { SkillDefinition, EmbeddingProvider } from '../../../src/core/types';

function makeSkill(name: string, description: string, body = ''): SkillDefinition {
  return {
    name,
    description,
    body,
    resources: { scripts: [], references: [], assets: [], other: [] },
    source: 'builtin',
  };
}

describe('SkillRegistry — Semantic Search & Content Access', () => {
  let registry: SkillRegistry;

  beforeEach(() => {
    registry = new SkillRegistry();
    registry.register(
      makeSkill(
        'postgres-query-operations',
        'Execute SQL queries, manage connections, handle transactions and locking in PostgreSQL',
        `# Overview\n\nPostgres operations.\n\n# Error Handling\n\n## Connection Pooling\n\nPool details.\n\n## Locking\n\nRow-level locking info.`
      )
    );
    registry.register(
      makeSkill(
        'slack-channel-messaging',
        'Send messages to Slack channels, format with blocks, and manage threads',
        `# Overview\n\nSlack messaging.\n\n# Formatting\n\nBlock kit formatting.`
      )
    );
    registry.register(
      makeSkill(
        'gmail-email-sending',
        'Compose and send emails via Gmail API with attachments and HTML formatting',
        `# Overview\n\nGmail sending.\n\n# Templates\n\nEmail templates.`
      )
    );
  });

  // ─── Selective Content Loading ─────────────────────────────────────

  describe('getSkillContent', () => {
    it('should return full skill content with no options', () => {
      const content = registry.getSkillContent('postgres-query-operations');
      expect(content).toContain('Postgres operations');
      expect(content).toContain('Connection Pooling');
      expect(content).toContain('Locking');
    });

    it('should return specific sections only', () => {
      const content = registry.getSkillContent('postgres-query-operations', {
        sections: ['Error Handling'],
      });
      expect(content).toContain('Connection Pooling');
      expect(content).toContain('Locking');
      expect(content).not.toContain('Postgres operations');
    });

    it('should return null for unknown skill', () => {
      expect(registry.getSkillContent('nonexistent')).toBeNull();
    });
  });

  describe('getSkillSections', () => {
    it('should list all sections with token estimates', () => {
      const sections = registry.getSkillSections('postgres-query-operations');
      expect(sections).not.toBeNull();
      expect(sections!.length).toBeGreaterThanOrEqual(3);
      expect(sections!.some((s) => s.path === 'Error Handling')).toBe(true);
      expect(sections!.some((s) => s.path.includes('Locking'))).toBe(true);
    });

    it('should return null for unknown skill', () => {
      expect(registry.getSkillSections('nonexistent')).toBeNull();
    });
  });

  // ─── Semantic Search ───────────────────────────────────────────────

  describe('search with semantic flag', () => {
    it('should return results ranked by relevance', () => {
      const results = registry.search({
        query: 'database SQL connection locking',
        semantic: true,
      });
      expect(results.length).toBeGreaterThan(0);
      // Postgres should rank higher than Slack for a database query
      expect(results[0].name).toBe('postgres-query-operations');
    });

    it('should still work with substring search (default)', () => {
      const results = registry.search({ query: 'slack' });
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('slack-channel-messaging');
    });
  });

  describe('semanticSearch (async)', () => {
    it('should return scored results', async () => {
      const results = await registry.semanticSearch('postgres locking issue');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].skill.name).toBe('postgres-query-operations');
      expect(results[0].score).toBeGreaterThan(0);
    });

    it('should respect limit', async () => {
      const results = await registry.semanticSearch('operations', { limit: 1 });
      expect(results.length).toBeLessThanOrEqual(1);
    });

    it('should respect minScore threshold', async () => {
      const results = await registry.semanticSearch('xyz123 nonsense', {
        minScore: 0.9,
      });
      // Very high threshold with unrelated query should return few/no results
      expect(results.length).toBeLessThanOrEqual(1);
    });
  });

  // ─── Custom Embedding Provider ────────────────────────────────────

  describe('setEmbeddingProvider', () => {
    it('should accept a custom embedding provider', async () => {
      const mockProvider: EmbeddingProvider = {
        dimensions: 3,
        embed: jest.fn().mockResolvedValue([1, 0, 0]),
        embedBatch: jest.fn().mockResolvedValue([
          [1, 0, 0],
          [0, 1, 0],
          [0, 0, 1],
        ]),
      };

      registry.setEmbeddingProvider(mockProvider);
      const results = await registry.semanticSearch('test query');

      expect(mockProvider.embedBatch).toHaveBeenCalled();
      expect(mockProvider.embed).toHaveBeenCalledWith('test query');
      expect(results.length).toBeGreaterThan(0);
    });
  });

  // ─── Cache invalidation ───────────────────────────────────────────

  describe('cache management', () => {
    it('should rebuild embeddings when new skills are registered', async () => {
      // First search builds cache
      await registry.semanticSearch('postgres');

      // Register new skill
      registry.register(makeSkill('hubspot-crm', 'CRM operations for HubSpot contacts and deals'));

      // Should include new skill in results
      const results = await registry.semanticSearch('CRM contacts deals');
      const hasHubspot = results.some((r) => r.skill.name === 'hubspot-crm');
      expect(hasHubspot).toBe(true);
    });

    it('should handle clear and re-register', () => {
      registry.clear();
      expect(registry.count()).toBe(0);
      expect(registry.getSkillContent('postgres-query-operations')).toBeNull();
    });

    it('should handle remove', () => {
      registry.remove('slack-channel-messaging');
      expect(registry.has('slack-channel-messaging')).toBe(false);
      expect(registry.getSkillContent('slack-channel-messaging')).toBeNull();
    });
  });

  // ─── TF-IDF Fallback Behavior ──────────────────────────────────────

  describe('TF-IDF fallback (no custom provider)', () => {
    it('should use TF-IDF embeddings when no custom provider is set', async () => {
      // Default provider is TfIdfEmbeddingProvider (embeddingProvider is null)
      expect(registry['embeddingProvider']).toBeNull();

      const results = await registry.semanticSearch('SQL queries database');
      expect(results.length).toBeGreaterThan(0);
      // TF-IDF should rank postgres skill higher for database-related query
      expect(results[0].skill.name).toBe('postgres-query-operations');
    });

    it('should give deterministic results with TF-IDF', async () => {
      // Same query should always return same results in same order
      const results1 = await registry.semanticSearch('messaging formatting');
      const results2 = await registry.semanticSearch('messaging formatting');

      expect(results1.map((r) => r.skill.name)).toEqual(results2.map((r) => r.skill.name));
      expect(results1.map((r) => r.score)).toEqual(results2.map((r) => r.score));
    });

    it('should refit TF-IDF vocabulary when register() invalidates embeddings', async () => {
      // Initial search
      const results1 = await registry.semanticSearch('email');
      expect(results1[0].skill.name).toBe('gmail-email-sending');

      // Add a new skill that is highly relevant to the query
      registry.register(
        makeSkill(
          'sendgrid-email',
          'Send transactional email via SendGrid with templates and tracking'
        )
      );

      // Search again - TF-IDF vocabulary should be rebuilt
      const results2 = await registry.semanticSearch('email');

      // Both email skills should be in results after vocabulary refit
      const emailSkills = results2.map((r) => r.skill.name);
      expect(emailSkills).toContain('gmail-email-sending');
      expect(emailSkills).toContain('sendgrid-email');
    });

    it('should correctly filter by minScore with TF-IDF', async () => {
      // Unrelated query with very high minScore threshold
      const results = await registry.semanticSearch('xyz nonsense 12345', {
        minScore: 0.95,
      });

      // Should filter out low-scoring results
      expect(results.length).toBeLessThanOrEqual(1);
      results.forEach((r) => expect(r.score).toBeGreaterThanOrEqual(0.95));
    });
  });
});
