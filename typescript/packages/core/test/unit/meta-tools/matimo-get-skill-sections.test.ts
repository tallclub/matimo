import { getGlobalMatimoInstance } from '@matimo/core';
import matimoGetSkillSections from '../../../tools/matimo_get_skill_sections/matimo_get_skill_sections';

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

describe('matimo_get_skill_sections', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should reject an empty name', async () => {
    const result = await matimoGetSkillSections({ name: '' });
    expect(result.success).toBe(false);
    expect(result.message).toContain('required');
    expect(result.sections).toEqual([]);
  });

  it('should report no active instance when none is set', async () => {
    mockGetInstance.mockImplementation(() => {
      throw new Error('Global MatimoInstance not set.');
    });

    const result = await matimoGetSkillSections({ name: 'slack' });
    expect(result.success).toBe(false);
    expect(result.message).toContain('No active Matimo instance found');
  });

  it('should fail when the skill is not found', async () => {
    const getSkillSections = jest.fn().mockReturnValue(null);
    mockGetInstance.mockReturnValue({
      getSkillSections,
    } as unknown as ReturnType<typeof getGlobalMatimoInstance>);

    const result = await matimoGetSkillSections({ name: 'nonexistent' });
    expect(result.success).toBe(false);
    expect(result.message).toContain('not found');
    expect(getSkillSections).toHaveBeenCalledWith('nonexistent');
  });

  it('should return the section inventory for a known skill', async () => {
    const sections = [
      { path: 'Messaging', level: 1, tokenEstimate: 120 },
      { path: 'Messaging.Error Handling', level: 2, tokenEstimate: 45 },
    ];
    const getSkillSections = jest.fn().mockReturnValue(sections);
    mockGetInstance.mockReturnValue({
      getSkillSections,
    } as unknown as ReturnType<typeof getGlobalMatimoInstance>);

    const result = await matimoGetSkillSections({ name: 'slack' });
    expect(result.success).toBe(true);
    expect(result.sections).toEqual(sections);
    expect(result.total).toBe(2);
    expect(result.message).toContain('2 section');
  });

  it('should return an empty inventory for a skill with no headings', async () => {
    const getSkillSections = jest.fn().mockReturnValue([]);
    mockGetInstance.mockReturnValue({
      getSkillSections,
    } as unknown as ReturnType<typeof getGlobalMatimoInstance>);

    const result = await matimoGetSkillSections({ name: 'flat-skill' });
    expect(result.success).toBe(true);
    expect(result.sections).toEqual([]);
    expect(result.total).toBe(0);
  });
});
