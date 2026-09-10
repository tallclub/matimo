import { getGlobalMatimoInstance } from '@matimo/core';
import matimoGetSkillContent from '../../../tools/matimo_get_skill_content/matimo_get_skill_content';

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

describe('matimo_get_skill_content', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should reject an empty name', async () => {
    const result = await matimoGetSkillContent({ name: '' });
    expect(result.success).toBe(false);
    expect(result.message).toContain('required');
  });

  it('should report no active instance when none is set', async () => {
    mockGetInstance.mockImplementation(() => {
      throw new Error('Global MatimoInstance not set.');
    });

    const result = await matimoGetSkillContent({ name: 'slack' });
    expect(result.success).toBe(false);
    expect(result.message).toContain('No active Matimo instance found');
  });

  it('should fail when the skill is not found', async () => {
    const getSkillContent = jest.fn().mockReturnValue(null);
    mockGetInstance.mockReturnValue({
      getSkillContent,
    } as unknown as ReturnType<typeof getGlobalMatimoInstance>);

    const result = await matimoGetSkillContent({ name: 'nonexistent' });
    expect(result.success).toBe(false);
    expect(result.message).toContain('not found');
  });

  it('should return content and an approximate token count', async () => {
    const getSkillContent = jest.fn().mockReturnValue('Send a message via the Slack API.');
    mockGetInstance.mockReturnValue({
      getSkillContent,
    } as unknown as ReturnType<typeof getGlobalMatimoInstance>);

    const result = await matimoGetSkillContent({ name: 'slack' });
    expect(result.success).toBe(true);
    expect(result.content).toBe('Send a message via the Slack API.');
    expect(result.tokensUsed).toBeGreaterThan(0);
    expect(result.message).toContain('tokens');
  });

  it('should pass selective-loading options through in camelCase', async () => {
    const getSkillContent = jest.fn().mockReturnValue('content');
    mockGetInstance.mockReturnValue({
      getSkillContent,
    } as unknown as ReturnType<typeof getGlobalMatimoInstance>);

    await matimoGetSkillContent({
      name: 'slack',
      sections: ['Messaging'],
      max_tokens: 500,
      include_preamble: false,
      max_depth: 1,
    });

    expect(getSkillContent).toHaveBeenCalledWith('slack', {
      sections: ['Messaging'],
      maxTokens: 500,
      includePreamble: false,
      maxDepth: 1,
    });
  });

  it('should return zero tokens for empty content', async () => {
    const getSkillContent = jest.fn().mockReturnValue('');
    mockGetInstance.mockReturnValue({
      getSkillContent,
    } as unknown as ReturnType<typeof getGlobalMatimoInstance>);

    const result = await matimoGetSkillContent({ name: 'empty-skill' });
    expect(result.success).toBe(true);
    expect(result.content).toBe('');
    expect(result.tokensUsed).toBe(0);
  });
});
