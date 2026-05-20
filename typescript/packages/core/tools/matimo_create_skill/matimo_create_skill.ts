import fs from 'fs';
import path from 'path';
import { getGlobalMatimoLogger } from '@matimo/core';
import {
  validateSkillName,
  parseSkillContent,
  validateFrontmatter,
} from '../shared/skill-validation.js';

interface CreateSkillParams {
  name: string;
  content: string;
  target_dir?: string;
}

interface CreateSkillResult {
  success: boolean;
  path?: string;
  message: string;
}

/**
 * Create a new skill following the Agent Skills specification.
 *
 * Validates the name (lowercase, hyphens, max 64 chars), ensures frontmatter
 * has required fields (name, description), and enforces that the frontmatter
 * name matches the directory name.
 *
 * @see https://agentskills.io/specification
 */
export default async function matimoCreateSkill(
  params: CreateSkillParams,
): Promise<CreateSkillResult> {
  const logger = getGlobalMatimoLogger();
  const targetDir = params.target_dir || './matimo-tools/skills';

  // Step 1: Validate the skill name against Agent Skills spec
  const nameResult = validateSkillName(params.name);
  if (!nameResult.valid) {
    return { success: false, message: nameResult.error! };
  }

  // Step 2: Parse and validate frontmatter
  const parseResult = parseSkillContent(params.content);
  if (!parseResult.success) {
    return { success: false, message: parseResult.error! };
  }

  const { frontmatter } = parseResult.parsed!;

  // Step 3: Validate frontmatter fields + name must match directory
  const fmResult = validateFrontmatter(frontmatter, params.name);
  if (!fmResult.valid) {
    const firstError = fmResult.issues.find(i => i.severity === 'error');
    return { success: false, message: firstError!.message };
  }

  // Step 4: Write to disk
  const skillDirPath = path.resolve(targetDir, params.name);
  fs.mkdirSync(skillDirPath, { recursive: true });

  const filePath = path.join(skillDirPath, 'SKILL.md');
  fs.writeFileSync(filePath, params.content, 'utf-8');

  logger.info('matimo_create_skill: skill created', {
    name: params.name,
    path: filePath,
  });

  return {
    success: true,
    path: filePath,
    message: `Skill "${params.name}" created successfully.`,
  };
}
