import fs from 'fs';
import path from 'path';
import { getGlobalMatimoLogger, getGlobalMatimoInstance, ToolLoader } from '@matimo/core';
import { parseSkillContent, listBundledResources, type BundledResources } from '../shared/skill-validation';

interface GetSkillParams {
  name: string;
  skills_dir?: string;
  file?: string;
}

interface GetSkillResult {
  success: boolean;
  name?: string;
  description?: string;
  content?: string;
  path?: string;
  message: string;
  license?: string;
  compatibility?: string;
  metadata?: Record<string, string>;
  resources?: BundledResources;
}

/** Path traversal detection — defense-in-depth. */
const UNSAFE_NAME_PATTERN = /[/\\]|\.\.|[\x00-\x1f]/;

/**
 * Helper: Find skill directory using auto-discovery (like matimo_list_skills)
 */
function findSkillDir(skillName: string, explicitSkillsDir?: string): string | null {
  // Try explicit skills_dir first
  if (explicitSkillsDir) {
    const skillPath = path.join(explicitSkillsDir, skillName, 'SKILL.md');
    if (fs.existsSync(skillPath)) {
      return path.join(explicitSkillsDir, skillName);
    }
  }

  // Try MatimoInstance
  try {
    const matimo = getGlobalMatimoInstance();
    if (matimo) {
      const skills = matimo.listSkills();
      const found = skills?.find((s) => s.name === skillName);
      if (found) {
        const skillPath = (found as any)._path;
        if (skillPath && fs.existsSync(path.join(skillPath, 'SKILL.md'))) {
          return skillPath;
        }
      }
    }
  } catch {
    // Fall through
  }

  // Auto-discover from @matimo/* packages
  try {
    const toolLoader = new ToolLoader();
    const discoveredPaths = toolLoader.autoDiscoverPackages();
    for (const toolPath of discoveredPaths) {
      const pkgDir = path.dirname(toolPath);
      const skillPath = path.join(pkgDir, 'skills', skillName, 'SKILL.md');
      if (fs.existsSync(skillPath)) {
        return path.join(pkgDir, 'skills', skillName);
      }
    }
  } catch {
    // Fall through
  }

  return null;
}

/**
 * Read a skill's content by name — Level 2 activation (SKILL.md) or
 * Level 3 resource access (bundled file).
 *
 * When called without `file`, returns SKILL.md content + metadata + resource listing.
 * When called with `file`, returns the contents of that bundled resource file.
 *
 * Skills are discovered in this order (priority):
 * 1. Explicit skills_dir if provided
 * 2. Global MatimoInstance (if initialized)
 * 3. Auto-discovered @matimo/* packages
 *
 * @see https://agentskills.io/specification
 */
export default async function matimoGetSkill(
  params: GetSkillParams,
): Promise<GetSkillResult> {
  const logger = getGlobalMatimoLogger();

  if (!params.name || params.name.trim().length === 0) {
    return { success: false, message: 'Skill name is required' };
  }

  if (UNSAFE_NAME_PATTERN.test(params.name)) {
    return { success: false, message: 'Skill name contains invalid characters' };
  }

  // Find skill directory using auto-discovery
  const skillDir = findSkillDir(params.name, params.skills_dir);
  if (!skillDir) {
    return { success: false, message: `Skill "${params.name}" not found` };
  }

  const skillPath = path.join(skillDir, 'SKILL.md');

  // Level 3: Read a specific bundled resource file
  if (params.file) {
    // For file paths, allow forward slashes but reject path traversal
    if (/\.\.|\\/u.test(params.file) || /[\x00-\x1f]/.test(params.file)) {
      return { success: false, message: 'File path contains invalid characters' };
    }

    const resourcePath = path.join(skillDir, params.file);
    // Verify the resolved path stays within the skill directory
    const resolvedPath = path.resolve(resourcePath);
    const resolvedSkillDir = path.resolve(skillDir);
    if (!resolvedPath.startsWith(resolvedSkillDir + path.sep) && resolvedPath !== resolvedSkillDir) {
      return { success: false, message: 'File path escapes the skill directory' };
    }

    if (!fs.existsSync(resourcePath)) {
      return { success: false, message: `Resource file "${params.file}" not found in skill "${params.name}"` };
    }

    try {
      const fileContent = fs.readFileSync(resourcePath, 'utf-8');
      return {
        success: true,
        name: params.name,
        content: fileContent,
        path: resourcePath,
        message: `Resource file "${params.file}" retrieved successfully.`,
      };
    } catch (err) {
      return { success: false, message: `Failed to read resource file: ${(err as Error).message}` };
    }
  }

  // Level 2: Read SKILL.md + metadata + resource listing
  try {
    const rawContent = fs.readFileSync(skillPath, 'utf-8');
    const parseResult = parseSkillContent(rawContent);

    const result: GetSkillResult = {
      success: true,
      name: params.name,
      content: rawContent,
      path: skillPath,
      message: 'Skill retrieved successfully.',
    };

    if (parseResult.success && parseResult.parsed) {
      const { frontmatter } = parseResult.parsed;
      result.name = frontmatter.name || params.name;
      result.description = frontmatter.description || '';
      if (frontmatter.license) result.license = frontmatter.license;
      if (frontmatter.compatibility) result.compatibility = frontmatter.compatibility;
      if (frontmatter.metadata) result.metadata = frontmatter.metadata;
    }

    // List bundled resources (Level 3 discovery)
    result.resources = listBundledResources(skillDir);

    logger.info('matimo_get_skill: skill retrieved', {
      name: params.name,
      path: skillPath,
    });

    return result;
  } catch (err) {
    const errorMsg = (err as Error).message;
    logger.error('matimo_get_skill: failed to read skill', {
      name: params.name,
      error: errorMsg,
    });
    return { success: false, message: `Failed to read skill: ${errorMsg}` };
  }
}
