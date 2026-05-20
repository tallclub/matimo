import fs from 'fs';
import path from 'path';
import { getGlobalMatimoLogger } from '@matimo/core';
import {
  parseSkillContent,
  validateFrontmatter,
  listBundledResources,
} from '../shared/skill-validation.js';

interface ValidationIssue {
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

interface BundledResources {
  scripts: string[];
  references: string[];
  assets: string[];
  other: string[];
}

interface ValidateSkillParams {
  /** Name of the skill directory to validate. */
  name: string;
  /** Directory containing skills (default ./matimo-tools/skills). */
  skills_dir?: string;
}

interface ValidateSkillResult {
  valid: boolean;
  name: string;
  issues: ValidationIssue[];
  structure: {
    has_skill_md: boolean;
    resources: BundledResources;
  };
  message: string;
}

/**
 * Validate an existing skill against the Agent Skills specification.
 *
 * Checks:
 * - SKILL.md exists
 * - YAML frontmatter is present and valid
 * - Name follows spec rules (lowercase, hyphens, max 64 chars)
 * - Name matches directory name
 * - Description is present and within limits
 * - Optional fields follow constraints
 * - Lists bundled resources for review
 *
 * @see https://agentskills.io/specification
 */
export default async function matimoValidateSkill(
  params: ValidateSkillParams,
): Promise<ValidateSkillResult> {
  const logger = getGlobalMatimoLogger();
  const skillsDir = params.skills_dir || './matimo-tools/skills';

  const failResult = (message: string, issues: ValidationIssue[] = []): ValidateSkillResult => ({
    valid: false,
    name: params.name || '',
    issues,
    structure: { has_skill_md: false, resources: { scripts: [], references: [], assets: [], other: [] } },
    message,
  });

  if (!params.name || params.name.trim().length === 0) {
    return failResult('Skill name is required');
  }

  const skillDir = path.join(skillsDir, params.name);
  const skillPath = path.join(skillDir, 'SKILL.md');

  // Check directory exists
  if (!fs.existsSync(skillDir)) {
    return failResult(`Skill directory not found: ${skillDir}`);
  }

  // Check SKILL.md exists
  if (!fs.existsSync(skillPath)) {
    return failResult(`SKILL.md not found in ${skillDir}`, [
      { field: 'SKILL.md', message: 'Required SKILL.md file is missing', severity: 'error' },
    ]);
  }

  // Parse content
  const content = fs.readFileSync(skillPath, 'utf-8');
  const parseResult = parseSkillContent(content);

  if (!parseResult.success) {
    return failResult(parseResult.error!, [
      { field: 'frontmatter', message: parseResult.error!, severity: 'error' },
    ]);
  }

  const { frontmatter, body } = parseResult.parsed!;

  // Validate frontmatter (with directory name matching)
  const fmResult = validateFrontmatter(frontmatter, params.name);

  // Add warnings for best practices
  const allIssues = [...fmResult.issues];

  // Warn if body is empty
  if (!body || body.trim().length === 0) {
    allIssues.push({
      field: 'body',
      message: 'SKILL.md has no instructions body — add content after the frontmatter',
      severity: 'warning',
    });
  }

  // Warn if body is too long (spec recommends < 5000 tokens ≈ < 500 lines)
  const lineCount = body.split('\n').length;
  if (lineCount > 500) {
    allIssues.push({
      field: 'body',
      message: `SKILL.md body has ${lineCount} lines — spec recommends < 500 lines. Consider splitting into referenced files.`,
      severity: 'warning',
    });
  }

  // List bundled resources
  const resources = listBundledResources(skillDir);

  const valid = allIssues.filter(i => i.severity === 'error').length === 0;

  logger.info('matimo_validate_skill: validation complete', {
    name: params.name,
    valid,
    issueCount: allIssues.length,
  });

  return {
    valid,
    name: params.name,
    issues: allIssues,
    structure: {
      has_skill_md: true,
      resources,
    },
    message: valid
      ? `Skill "${params.name}" is valid per the Agent Skills specification.`
      : `Skill "${params.name}" has ${allIssues.filter(i => i.severity === 'error').length} error(s).`,
  };
}
