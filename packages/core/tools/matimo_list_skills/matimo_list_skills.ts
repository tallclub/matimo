import fs from 'fs';
import path from 'path';
import { getGlobalMatimoLogger } from '@matimo/core';
import { parseSkillContent } from '../shared/skill-validation';

interface ListSkillsParams {
  skills_dir?: string;
}

interface SkillSummary {
  name: string;
  description: string;
  path: string;
  license?: string;
  compatibility?: string;
  metadata?: Record<string, string>;
}

interface ListSkillsResult {
  skills: SkillSummary[];
  total: number;
}

/**
 * List all skills in a directory — Level 1 metadata discovery.
 *
 * Returns name, description, and optional frontmatter fields for each
 * skill following the Agent Skills specification.
 *
 * @see https://agentskills.io/specification
 */
export default async function matimoListSkills(
  params: ListSkillsParams,
): Promise<ListSkillsResult> {
  const logger = getGlobalMatimoLogger();
  const skillsDir = params.skills_dir || './matimo-tools/skills';

  const skills: SkillSummary[] = [];

  if (!fs.existsSync(skillsDir)) {
    return { skills: [], total: 0 };
  }

  const entries = fs.readdirSync(skillsDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const skillPath = path.join(skillsDir, entry.name, 'SKILL.md');
    if (!fs.existsSync(skillPath)) continue;

    try {
      const content = fs.readFileSync(skillPath, 'utf-8');
      const result = parseSkillContent(content);

      if (!result.success || !result.parsed) {
        logger.warn('matimo_list_skills: skill has invalid frontmatter', { dir: entry.name });
        continue;
      }

      const { frontmatter } = result.parsed;

      if (!frontmatter.name || !frontmatter.description) {
        logger.warn('matimo_list_skills: skill missing name or description in frontmatter', {
          dir: entry.name,
        });
        continue;
      }

      const summary: SkillSummary = {
        name: frontmatter.name,
        description: frontmatter.description,
        path: skillPath,
      };

      if (frontmatter.license) summary.license = frontmatter.license;
      if (frontmatter.compatibility) summary.compatibility = frontmatter.compatibility;
      if (frontmatter.metadata) summary.metadata = frontmatter.metadata;

      skills.push(summary);
    } catch (err) {
      logger.warn('matimo_list_skills: failed to read skill', {
        dir: entry.name,
        error: (err as Error).message,
      });
    }
  }

  return { skills, total: skills.length };
}
