import { SkillRegistry } from '../../../src/core/skill-registry';
import { SkillDefinition } from '../../../src/core/types';
import { MatimoError } from '../../../src/errors/matimo-error';

function makeSkill(
  name: string,
  description: string,
  opts: Partial<SkillDefinition> = {}
): SkillDefinition {
  return {
    name,
    description,
    body: opts.body ?? '',
    resources: opts.resources ?? { scripts: [], references: [], assets: [], other: [] },
    source: opts.source ?? 'builtin',
    metadata: opts.metadata,
    version: opts.version,
    license: opts.license,
    allowedTools: opts.allowedTools,
  };
}

describe('SkillRegistry — Core Methods', () => {
  let registry: SkillRegistry;

  beforeEach(() => {
    registry = new SkillRegistry();
    registry.register(
      makeSkill('postgres-ops', 'SQL queries and database management', {
        metadata: {
          category: 'database',
          difficulty: 'intermediate',
          tags: 'sql,postgres,db',
          author: 'matimo-team',
        },
      })
    );
    registry.register(
      makeSkill('slack-messaging', 'Send Slack messages', {
        metadata: {
          category: 'communication',
          difficulty: 'beginner',
          tags: 'slack,chat',
          author: 'community',
        },
      })
    );
    registry.register(
      makeSkill('gmail-sending', 'Send emails via Gmail', {
        metadata: {
          category: 'communication',
          difficulty: 'intermediate',
          tags: 'email,gmail',
          author: 'matimo-team',
        },
      })
    );
  });

  // ─── getRequired ─────────────────────────────────────────────────

  describe('getRequired', () => {
    it('should return skill when found', () => {
      const skill = registry.getRequired('postgres-ops');
      expect(skill.name).toBe('postgres-ops');
    });

    it('should throw MatimoError when skill not found', () => {
      expect(() => registry.getRequired('nonexistent')).toThrow(MatimoError);
      expect(() => registry.getRequired('nonexistent')).toThrow(/not found/);
    });
  });

  // ─── register validation ───────────────────────────────────────

  describe('register', () => {
    it('should throw when skill has no name', () => {
      expect(() => registry.register({ name: '', description: 'test' } as SkillDefinition)).toThrow(
        MatimoError
      );
    });
  });

  // ─── search with filters ─────────────────────────────────────────

  describe('search', () => {
    it('should filter by category', () => {
      const results = registry.search({ category: 'communication' });
      expect(results).toHaveLength(2);
      expect(results.every((r) => r.name !== 'postgres-ops')).toBe(true);
    });

    it('should filter by difficulty', () => {
      const results = registry.search({ difficulty: 'beginner' });
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('slack-messaging');
    });

    it('should filter by tags', () => {
      const results = registry.search({ tags: ['sql'] });
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('postgres-ops');
    });

    it('should filter by multiple tags (any match)', () => {
      const results = registry.search({ tags: ['email', 'sql'] });
      expect(results).toHaveLength(2);
    });

    it('should filter by author', () => {
      const results = registry.search({ author: 'community' });
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('slack-messaging');
    });

    it('should combine filters', () => {
      const results = registry.search({
        category: 'communication',
        author: 'matimo-team',
      });
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('gmail-sending');
    });

    it('should respect pagination', () => {
      const results = registry.search({ limit: 1, offset: 1 });
      expect(results).toHaveLength(1);
    });

    it('should return empty for no matches', () => {
      const results = registry.search({ category: 'nonexistent' });
      expect(results).toHaveLength(0);
    });
  });

  // ─── remove ───────────────────────────────────────────────────

  describe('remove', () => {
    it('should remove an existing skill', () => {
      expect(registry.remove('slack-messaging')).toBe(true);
      expect(registry.has('slack-messaging')).toBe(false);
      expect(registry.count()).toBe(2);
    });

    it('should return false for non-existent skill', () => {
      expect(registry.remove('nonexistent')).toBe(false);
    });
  });

  // ─── clear ───────────────────────────────────────────────────

  describe('clear', () => {
    it('should remove all skills', () => {
      registry.clear();
      expect(registry.count()).toBe(0);
      expect(registry.list()).toHaveLength(0);
    });
  });

  // ─── list and getAll ──────────────────────────────────────────

  describe('list', () => {
    it('should return summaries without body', () => {
      const summaries = registry.list();
      expect(summaries).toHaveLength(3);
      expect(summaries[0]).toHaveProperty('name');
      expect(summaries[0]).toHaveProperty('description');
      expect(summaries[0]).not.toHaveProperty('body');
    });
  });

  describe('getAll', () => {
    it('should return full definitions', () => {
      const all = registry.getAll();
      expect(all).toHaveLength(3);
    });
  });
});
