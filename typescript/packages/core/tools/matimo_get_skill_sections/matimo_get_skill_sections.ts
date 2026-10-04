import { getGlobalMatimoInstance, getGlobalMatimoLogger } from '@matimo/core';

interface GetSkillSectionsParams {
  name: string;
}

interface SkillSectionInfo {
  path: string;
  level: number;
  tokenEstimate: number;
}

interface GetSkillSectionsResult {
  success: boolean;
  name: string;
  sections: SkillSectionInfo[];
  total: number;
  message: string;
}

/**
 * List a skill's sections and their token costs — thin wrapper around
 * `MatimoInstance.getSkillSections()`, exposed as an agent-callable
 * meta-tool for progressive-disclosure Level 2.5.
 *
 * @see https://agentskills.io/specification
 */
export default async function matimoGetSkillSections(
  params: GetSkillSectionsParams,
): Promise<GetSkillSectionsResult> {
  const logger = getGlobalMatimoLogger();
  const name = (params.name ?? '').trim();

  if (!name) {
    return { success: false, name, sections: [], total: 0, message: 'Skill name is required' };
  }

  let instance: ReturnType<typeof getGlobalMatimoInstance> | null;
  try {
    instance = getGlobalMatimoInstance();
  } catch {
    instance = null;
  }

  if (!instance) {
    return {
      success: false,
      name,
      sections: [],
      total: 0,
      message:
        'No active Matimo instance found. Section inventory requires an initialized MatimoInstance.',
    };
  }

  const sections = instance.getSkillSections(name);
  if (sections === null) {
    return { success: false, name, sections: [], total: 0, message: `Skill "${name}" not found` };
  }

  logger.debug('matimo_get_skill_sections: retrieved', { name, count: sections.length });

  return {
    success: true,
    name,
    sections,
    total: sections.length,
    message: `Found ${sections.length} section(s) for skill "${name}".`,
  };
}
