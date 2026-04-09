import path from 'path';
import fs from 'fs';
import { getGlobalMatimoLogger, getGlobalMatimoInstance, extractSkillMetadata, ToolLoader } from '@matimo/core';

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
 * Helper: Load SKILL.md files from a directory and extract metadata.
 */
function loadSkillsFromPath(
  skillsPath: string,
  source: 'builtin' | 'user',
  logger: ReturnType<typeof getGlobalMatimoLogger>,
): SkillSummary[] {
  const skills: SkillSummary[] = [];

  if (!fs.existsSync(skillsPath)) return skills;

  try {
    const entries = fs.readdirSync(skillsPath, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const skillFilePath = path.join(skillsPath, entry.name, 'SKILL.md');
      if (!fs.existsSync(skillFilePath)) continue;

      try {
        const content = fs.readFileSync(skillFilePath, 'utf-8');
        const result = extractSkillMetadata(content, source);
        if (result.success && result.metadata) {
          skills.push(result.metadata);
        }
      } catch (err) {
        logger.debug('matimo_list_skills: failed to extract metadata', {
          skill: entry.name,
          error: (err as Error).message,
        });
      }
    }
  } catch (err) {
    logger.debug('matimo_list_skills: failed to read directory', {
      path: skillsPath,
      error: (err as Error).message,
    });
  }

  return skills;
}



/**
 * List all skills available in the current Matimo instance.
 *
 * Skills are discovered in this order (priority):
 * 1. Global MatimoInstance (if initialized) — includes auto-discovered @matimo/* skills
 * 2. Auto-discover from @matimo/* packages in node_modules (like tools do)
 * 3. Explicit skills_dir if provided
 *
 * Returns METADATA ONLY: name, description, license, version, metadata, source.
 * Full body content is available via matimo_get_skill when explicitly requested.
 *
 * Uses lightweight YAML-only extraction (no body/sections parsing) for efficiency.
 * This avoids the overhead of parsing skill markdown sections and keeps responses small.
 */
export default async function matimoListSkills(
  params: ListSkillsParams,
): Promise<ListSkillsResult> {
  const logger = getGlobalMatimoLogger();
  const allSkills = new Map<string, SkillSummary>();

  try {
    // Try global MatimoInstance first
    try {
      const matimo = getGlobalMatimoInstance();
      if (matimo) {
        const matimoSkills = matimo.listSkills();
        if (matimoSkills?.length > 0) {
          logger.debug('matimo_list_skills: from MatimoInstance', { count: matimoSkills.length });
          matimoSkills.forEach((s) => allSkills.set(s.name, s));
          return { skills: Array.from(allSkills.values()), total: allSkills.size };
        }
      }
    } catch (err) {
      logger.debug('matimo_list_skills: MatimoInstance unavailable', {
        error: (err as Error).message,
      });
    }

    // Auto-discover from @matimo/* packages
    try {
      const toolLoader = new ToolLoader();
      const discoveredPaths = toolLoader.autoDiscoverPackages();

      for (const toolPath of discoveredPaths) {
        const pkgDir = path.dirname(toolPath);
        const skillsPath = path.join(pkgDir, 'skills');
        const discovered = loadSkillsFromPath(skillsPath, 'builtin', logger);
        discovered.forEach((s) => allSkills.set(s.name, s));
      }
    } catch (err) {
      logger.debug('matimo_list_skills: auto-discovery failed', {
        error: (err as Error).message,
      });
    }

    // Load from explicit skills_dir if provided
    if (params.skills_dir) {
      const skillsDir = path.resolve(params.skills_dir);
      const discovered = loadSkillsFromPath(skillsDir, 'user', logger);
      discovered.forEach((s) => allSkills.set(s.name, s));
    }

    const results = Array.from(allSkills.values());
    logger.debug('matimo_list_skills: complete', { total: results.length });
    return { skills: results, total: results.length };
  } catch (err) {
    logger.error('matimo_list_skills: failed', {
      error: (err as Error).message,
    });
    return { skills: [], total: 0 };
  }
}
