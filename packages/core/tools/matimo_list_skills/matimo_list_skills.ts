import path from 'path';
import fs from 'fs';
import { getGlobalMatimoLogger, getGlobalMatimoInstance, SkillLoader } from '@matimo/core';

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
 * List all skills available in the current Matimo instance, or load from a specific directory.
 *
 * If skills_dir is provided, loads skills directly from that directory.
 * Otherwise, returns skills from the global MatimoInstance (which includes @matimo/*, core/skills, etc).
 *
 * Returns name, description, and optional frontmatter fields for each skill
 * following the Agent Skills specification.
 */
export default async function matimoListSkills(
  params: ListSkillsParams,
): Promise<ListSkillsResult> {
  const logger = getGlobalMatimoLogger();

  try {
    // If a specific directory is provided, load skills directly from it
    if (params.skills_dir) {
      const skillsDir = path.resolve(params.skills_dir);
      
      logger.debug('matimo_list_skills: attempting to load from directory', { path: skillsDir });
      
      if (!fs.existsSync(skillsDir)) {
        logger.warn('matimo_list_skills: skills_dir does not exist', { 
          path: skillsDir,
          cwd: process.cwd(),
          note: 'Ensure the path is correct relative to where the tool is executed. Use absolute paths for reliability.'
        });
        return { skills: [], total: 0 };
      }

      try {
        // Load skills directly from the specified directory
        const loader = new SkillLoader();
        const loadedSkills = loader.loadSkillsFromDirectory(skillsDir, 'user');
        
        if (!loadedSkills || loadedSkills.length === 0) {
          logger.warn('matimo_list_skills: no skills found in directory', { 
            path: skillsDir,
            note: 'Directory must contain subdirectories with SKILL.md files'
          });
          return { skills: [], total: 0 };
        }
        
        const skills: SkillSummary[] = loadedSkills.map((skill) => ({
          name: skill.name,
          description: skill.description,
          version: skill.version,
          license: skill.license,
          metadata: skill.metadata,
          source: skill.source,
        }));

        logger.debug('matimo_list_skills: loaded from directory', { 
          count: skills.length, 
          path: skillsDir,
          skills: skills.map(s => s.name)
        });
        return { skills, total: skills.length };
      } catch (dirErr) {
        logger.error('matimo_list_skills: error loading from directory', {
          path: skillsDir,
          error: (dirErr as Error).message,
          stack: (dirErr as Error).stack
        });
        return { skills: [], total: 0 };
      }
    }

    // Otherwise, use the global MatimoInstance
    const matimo = getGlobalMatimoInstance();
    if (!matimo) {
      logger.warn('matimo_list_skills: MatimoInstance not available and no skills_dir provided');
      return { skills: [], total: 0 };
    }

    // Get skills from the actual Matimo instance (includes auto-discovered @matimo/*/skills)
    const matimoSkills = matimo.listSkills();

    if (!matimoSkills || matimoSkills.length === 0) {
      logger.debug('matimo_list_skills: MatimoInstance returned no skills');
    }

    const skills: SkillSummary[] = matimoSkills;

    logger.debug('matimo_list_skills: retrieved from MatimoInstance', { 
      count: skills.length,
      skills: skills.map(s => s.name)
    });
    return { skills, total: skills.length };
  } catch (err) {
    logger.error('matimo_list_skills: failed to list skills', {
      error: (err as Error).message,
      stack: (err as Error).stack
    });
    return { skills: [], total: 0 };
  }
}
