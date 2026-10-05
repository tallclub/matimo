import { getGlobalMatimoInstance } from '@matimo/core';
import matimoSearchSkills from '../../../tools/matimo_search_skills/matimo_search_skills';

jest.mock('@matimo/core', () => {
  const actual = jest.requireActual('@matimo/core');
  return {
    ...actual,
    getGlobalMatimoInstance: jest.fn(actual.getGlobalMatimoInstance),
  };
});

const mockGetInstance = getGlobalMatimoInstance as jest.MockedFunction<
  typeof getGlobalMatimoInstance
>;

describe('matimo_search_skills', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should reject an empty query', async () => {
    const result = await matimoSearchSkills({ query: '' });
    expect(result.success).toBe(false);
    expect(result.message).toContain('required');
    expect(result.results).toEqual([]);
    expect(result.total).toBe(0);
  });

  it('should reject a whitespace-only query', async () => {
    const result = await matimoSearchSkills({ query: '   ' });
    expect(result.success).toBe(false);
    expect(result.message).toContain('required');
  });

  it('should report no active instance when none is set', async () => {
    mockGetInstance.mockImplementation(() => {
      throw new Error('Global MatimoInstance not set.');
    });

    const result = await matimoSearchSkills({ query: 'rate limiting' });
    expect(result.success).toBe(false);
    expect(result.message).toContain('No active Matimo instance found');
  });

  it('should return ranked results from semanticSearchSkills', async () => {
    const semanticSearchSkills = jest.fn().mockResolvedValue([
      { skill: { name: 'slack', description: 'Slack messaging', source: 'builtin' }, score: 0.82 },
      { skill: { name: 'postgres', description: 'SQL queries', source: 'builtin' }, score: 0.41 },
    ]);
    mockGetInstance.mockReturnValue({
      semanticSearchSkills,
    } as unknown as ReturnType<typeof getGlobalMatimoInstance>);

    const result = await matimoSearchSkills({ query: 'rate limiting and retries' });

    expect(result.success).toBe(true);
    expect(result.total).toBe(2);
    expect(result.results).toEqual([
      { name: 'slack', description: 'Slack messaging', relevanceScore: 0.82 },
      { name: 'postgres', description: 'SQL queries', relevanceScore: 0.41 },
    ]);
    expect(semanticSearchSkills).toHaveBeenCalledWith('rate limiting and retries', {
      limit: 10,
      minScore: 0.1,
    });
  });

  it('should pass through custom limit and min_score', async () => {
    const semanticSearchSkills = jest.fn().mockResolvedValue([]);
    mockGetInstance.mockReturnValue({
      semanticSearchSkills,
    } as unknown as ReturnType<typeof getGlobalMatimoInstance>);

    await matimoSearchSkills({ query: 'slack', limit: 3, min_score: 0.5 });

    expect(semanticSearchSkills).toHaveBeenCalledWith('slack', { limit: 3, minScore: 0.5 });
  });

  it('should return an empty result set when nothing matches', async () => {
    const semanticSearchSkills = jest.fn().mockResolvedValue([]);
    mockGetInstance.mockReturnValue({
      semanticSearchSkills,
    } as unknown as ReturnType<typeof getGlobalMatimoInstance>);

    const result = await matimoSearchSkills({ query: 'nonexistent topic' });
    expect(result.success).toBe(true);
    expect(result.results).toEqual([]);
    expect(result.total).toBe(0);
  });

  it('should report a failure message when semanticSearchSkills throws', async () => {
    const semanticSearchSkills = jest.fn().mockRejectedValue(new Error('embedding provider down'));
    mockGetInstance.mockReturnValue({
      semanticSearchSkills,
    } as unknown as ReturnType<typeof getGlobalMatimoInstance>);

    const result = await matimoSearchSkills({ query: 'slack' });
    expect(result.success).toBe(false);
    expect(result.message).toContain('Search failed');
    expect(result.message).toContain('embedding provider down');
  });
});
