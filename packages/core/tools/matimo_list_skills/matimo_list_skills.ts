import { getGlobalMatimoLogger, getGlobalMatimoInstance } from '@matimo/core';

interface ListSkillsParams {
  skills_dir?: string;
}

interface SkillSummary {
  name: string;
  description: string;
  version?: string;
  license?: string;
  metadata?: Record<string, string>;
  source: 'builtin' | 'user' | 'catalog';
}

interface ListSkillsResult {
  skills: SkillSummary[];
  total: number;
}

/**
 * List all skills available in the current Matimo instance.
 *
 * Returns name, description, and optional frontmatter fields for each
 * skill following the Agent Skills specification.
 *
 * Note: Queries the global MatimoInstance for authoritative skill list.
 * This includes skills from @matimo/*, core/skills, and user-created skills.
 */
export default async function matimoListSkills(
  _params: ListSkillsParams,
): Promise<ListSkillsResult> {
  const logger = getGlobalMatimoLogger();

  try {
    const matimo = getGlobalMatimoInstance();
    if (!matimo) {
      logger.warn('matimo_list_skills: MatimoInstance not available, cannot list skills');
      return { skills: [], total: 0 };
    }

    // Get skills from the actual Matimo instance
    const matimoSkills = matimo.listSkills();

    const skills: SkillSummary[] = matimoSkills;

    logger.debug('matimo_list_skills: retrieved from MatimoInstance', { count: skills.length });
    return { skills, total: skills.length };
  } catch (err) {
    logger.error('matimo_list_skills: failed to list skills', {
      error: (err as Error).message,
    });
    return { skills: [], total: 0 };
  }
}
