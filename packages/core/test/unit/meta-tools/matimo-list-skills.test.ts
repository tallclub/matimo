import matimoListSkills from '../../../tools/matimo_list_skills/matimo_list_skills';
import { getGlobalMatimoInstance } from '@matimo/core';

jest.mock('@matimo/core', () => {
  const actual = jest.requireActual('@matimo/core');
  return {
    ...actual,
    getGlobalMatimoInstance: jest.fn(),
    getGlobalMatimoLogger: () => ({
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    }),
  };
});

const mockGetInstance = getGlobalMatimoInstance as jest.MockedFunction<
  typeof getGlobalMatimoInstance
>;

describe('matimo_list_skills', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should list skills from MatimoInstance', async () => {
    mockGetInstance.mockReturnValue({
      listSkills: () => [
        {
          name: 'code-review',
          description: 'Guidelines for reviewing code',
          source: 'builtin' as const,
        },
        {
          name: 'testing',
          description: 'Best practices for writing tests',
          source: 'builtin' as const,
        },
      ],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const result = await matimoListSkills({});
    expect(result.total).toBe(2);
    expect(result.skills.map((s) => s.name).sort()).toEqual(['code-review', 'testing']);
  });

  it('should include description and source for each skill', async () => {
    mockGetInstance.mockReturnValue({
      listSkills: () => [
        { name: 'my-skill', description: 'A helpful skill', source: 'user' as const },
      ],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const result = await matimoListSkills({});
    expect(result.skills[0].name).toBe('my-skill');
    expect(result.skills[0].description).toBe('A helpful skill');
    expect(result.skills[0].source).toBe('user');
  });

  it('should return optional frontmatter fields (license, version)', async () => {
    mockGetInstance.mockReturnValue({
      listSkills: () => [
        {
          name: 'pdf-processing',
          description: 'Extract PDF text and fill forms',
          license: 'Apache-2.0',
          version: '1.0.0',
          source: 'builtin' as const,
        },
      ],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const result = await matimoListSkills({});
    expect(result.skills[0].license).toBe('Apache-2.0');
    expect(result.skills[0].version).toBe('1.0.0');
  });

  it('should return metadata from skills', async () => {
    mockGetInstance.mockReturnValue({
      listSkills: () => [
        {
          name: 'versioned-skill',
          description: 'A skill with metadata',
          metadata: { author: 'matimo-team', version: '2.0' },
          source: 'builtin' as const,
        },
      ],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const result = await matimoListSkills({});
    expect(result.skills[0].metadata).toEqual({
      author: 'matimo-team',
      version: '2.0',
    });
  });

  it('should return empty list when no MatimoInstance is available', async () => {
    mockGetInstance.mockReturnValue(null as unknown as ReturnType<typeof getGlobalMatimoInstance>);

    const result = await matimoListSkills({});
    expect(result.skills).toHaveLength(0);
    expect(result.total).toBe(0);
  });

  it('should return empty list when listSkills returns empty', async () => {
    mockGetInstance.mockReturnValue({
      listSkills: () => [],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const result = await matimoListSkills({});
    expect(result.skills).toBeInstanceOf(Array);
    expect(result.total).toBe(0);
  });

  it('should handle listSkills throwing an error', async () => {
    mockGetInstance.mockReturnValue({
      listSkills: () => {
        throw new Error('Registry corrupted');
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const result = await matimoListSkills({});
    expect(result.skills).toHaveLength(0);
    expect(result.total).toBe(0);
  });

  it('should include skills from multiple sources', async () => {
    mockGetInstance.mockReturnValue({
      listSkills: () => [
        { name: 'core-skill', description: 'Built-in', source: 'builtin' as const },
        { name: 'user-skill', description: 'User created', source: 'user' as const },
        { name: 'catalog-skill', description: 'From catalog', source: 'catalog' as const },
      ],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const result = await matimoListSkills({});
    expect(result.total).toBe(3);
    expect(result.skills.map((s) => s.source)).toEqual(['builtin', 'user', 'catalog']);
  });

  it('should load skills from a directory when skills_dir is provided', async () => {
    const skillsDir = `${__dirname}/../../../tools/matimo_list_skills`;
    const result = await matimoListSkills({ skills_dir: skillsDir });
    // This test verifies the directory loading path works
    // The actual result depends on what SKILL.md files exist
    expect(result).toHaveProperty('skills');
    expect(result).toHaveProperty('total');
    expect(Array.isArray(result.skills)).toBe(true);
  });

  it('should return empty list when skills_dir does not exist', async () => {
    const nonExistentDir = '/non/existent/path/to/skills';
    const result = await matimoListSkills({ skills_dir: nonExistentDir });
    expect(result.skills).toHaveLength(0);
    expect(result.total).toBe(0);
  });
});
