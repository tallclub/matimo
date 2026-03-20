/**
 * Skill Loader — loads and validates skills from multiple sources
 *
 * Implements agentskills.io specification with proper YAML parsing and Zod validation.
 *
 * @see https://agentskills.io/specification
 */

import fs from 'fs';
import path from 'path';
import YAML from 'js-yaml';
import { z } from 'zod';
import { SkillDefinition, SkillFrontmatter, ParsedSkill, BundledResources } from './types';
import { parseSkillSections } from './skill-content-parser';
import { getGlobalMatimoLogger } from '../logging';
import { MatimoError, ErrorCode } from '../errors/matimo-error';

// ─── Name Validation ─────────────────────────────────────────────────────────

const VALID_NAME_PATTERN = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;
const CONSECUTIVE_HYPHENS = /--/;
const MAX_NAME_LENGTH = 64;

function validateSkillName(name: string): { valid: boolean; error?: string } {
  if (!name || name.trim().length === 0) {
    return { valid: false, error: 'Skill name is required' };
  }

  if (name.length > MAX_NAME_LENGTH) {
    return {
      valid: false,
      error: `Skill name must be at most ${MAX_NAME_LENGTH} characters`,
    };
  }

  if (!VALID_NAME_PATTERN.test(name)) {
    return {
      valid: false,
      error:
        'Skill name must contain only lowercase letters, numbers, and hyphens, and must not start or end with a hyphen',
    };
  }

  if (CONSECUTIVE_HYPHENS.test(name)) {
    return { valid: false, error: 'Skill name must not contain consecutive hyphens' };
  }

  return { valid: true };
}

// ─── YAML Parser & Validation ──────────────────────────────────────────────

/**
 * Parser schema for skill frontmatter (using Zod for runtime validation)
 */
const FrontmatterSchema = z.object({
  name: z.string().min(1, 'name is required'),
  description: z.string().min(1, 'description is required').max(1024),
  version: z.string().optional(),
  license: z.string().optional(),
  compatibility: z.string().max(500).optional(),
  'allowed-tools': z.union([z.string(), z.array(z.string())]).optional(),
  metadata: z.record(z.string(), z.string()).optional(),
});

/**
 * Parse YAML frontmatter from SKILL.md content
 */
export function parseSkillContent(content: string): ParsedSkill & { error?: string } {
  if (!content || !content.startsWith('---')) {
    return {
      error: 'Skill content must start with YAML frontmatter (---)',
      frontmatter: { name: '', description: '' },
      body: '',
      raw: content,
    };
  }

  const endIndex = content.indexOf('---', 3);
  if (endIndex === -1) {
    return {
      error: 'Skill content must have closing YAML frontmatter (---)',
      frontmatter: { name: '', description: '' },
      body: '',
      raw: content,
    };
  }

  const frontmatterBlock = content.substring(3, endIndex).trim();
  const body = content.substring(endIndex + 3).trim();

  let parsed: Record<string, unknown>;
  try {
    parsed = (YAML.load(frontmatterBlock) as Record<string, unknown>) || {};
  } catch (e) {
    return {
      error: `Failed to parse YAML frontmatter: ${(e as Error).message}`,
      frontmatter: { name: '', description: '' },
      body,
      raw: content,
    };
  }

  // Normalize allowed-tools: convert space-delimited string to array
  if (parsed['allowed-tools'] && typeof parsed['allowed-tools'] === 'string') {
    parsed['allowed-tools'] = parsed['allowed-tools'].split(/\s+/);
  }

  // Validate with Zod
  const validationResult = FrontmatterSchema.safeParse(parsed);
  if (!validationResult.success) {
    const errors = validationResult.error.issues
      .map((e: z.ZodIssue) => `${e.path.join('.')}: ${e.message}`)
      .join('; ');
    return {
      error: `Frontmatter validation failed: ${errors}`,
      frontmatter: { name: '', description: '' },
      body,
      raw: content,
    };
  }

  const frontmatter: SkillFrontmatter = {
    name: validationResult.data.name,
    description: validationResult.data.description,
    version: validationResult.data.version,
    license: validationResult.data.license,
    compatibility: validationResult.data.compatibility,
    'allowed-tools': validationResult.data['allowed-tools'] as string[] | undefined,
    metadata: validationResult.data.metadata,
  };

  // Parse body into structured sections for selective context loading
  const parsedContent = parseSkillSections(body);

  return {
    frontmatter,
    body,
    raw: content,
    sections: parsedContent.sections,
    totalTokens: parsedContent.totalTokens,
  };
}

// ─── Bundled Resources Discovery ───────────────────────────────────────────

function listBundledResources(skillDir: string): BundledResources {
  const resources: BundledResources = {
    scripts: [],
    references: [],
    assets: [],
    other: [],
  };

  if (!fs.existsSync(skillDir)) return resources;

  const KNOWN_DIRS: Record<string, keyof Omit<BundledResources, 'other'>> = {
    scripts: 'scripts',
    references: 'references',
    assets: 'assets',
  };

  const entries = fs.readdirSync(skillDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === 'SKILL.md') continue;

    if (entry.isDirectory()) {
      const category = KNOWN_DIRS[entry.name];
      if (category) {
        const subDir = path.join(skillDir, entry.name);
        const subEntries = fs.readdirSync(subDir);
        for (const sub of subEntries) {
          resources[category].push(`${entry.name}/${sub}`);
        }
      } else {
        const subDir = path.join(skillDir, entry.name);
        const subEntries = fs.readdirSync(subDir);
        for (const sub of subEntries) {
          resources.other.push(`${entry.name}/${sub}`);
        }
      }
    } else {
      resources.other.push(entry.name);
    }
  }

  return resources;
}

// ─── SkillLoader ──────────────────────────────────────────────────────────

/**
 * SkillLoader reads and validates skills from directories
 */
export class SkillLoader {
  private logger = getGlobalMatimoLogger();

  /**
   * Load all skills from a directory
   */
  loadSkillsFromDirectory(
    skillsDir: string,
    source: 'builtin' | 'user' | 'catalog' = 'user'
  ): SkillDefinition[] {
    const skills: SkillDefinition[] = [];

    if (!fs.existsSync(skillsDir)) {
      return skills;
    }

    const entries = fs.readdirSync(skillsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const skillPath = path.join(skillsDir, entry.name, 'SKILL.md');
      if (!fs.existsSync(skillPath)) continue;

      try {
        this.logger.debug('SkillLoader: attempting to load skill', {
          name: entry.name,
          skillPath,
        });
        const skill = this.loadSkill(entry.name, skillsDir, source);
        if (skill) {
          skills.push(skill);
          this.logger.debug('SkillLoader: successfully loaded skill', {
            name: skill.name,
          });
        } else {
          this.logger.warn('SkillLoader: loadSkill returned null', {
            name: entry.name,
          });
        }
      } catch (err) {
        this.logger.error('SkillLoader: failed to load skill', {
          dir: entry.name,
          error: (err as Error).message,
          stack: (err as Error).stack,
          skillsDir,
        });
      }
    }

    return skills;
  }

  /**
   * Load a single skill by name
   */
  loadSkill(
    name: string,
    skillsDir: string,
    source: 'builtin' | 'user' | 'catalog' = 'user'
  ): SkillDefinition | null {
    // Validate name
    const nameValidation = validateSkillName(name);
    if (!nameValidation.valid) {
      throw new MatimoError(
        `Invalid skill name: ${nameValidation.error}`,
        ErrorCode.INVALID_SCHEMA
      );
    }

    const skillDir = path.join(skillsDir, name);
    const skillPath = path.join(skillDir, 'SKILL.md');

    if (!fs.existsSync(skillPath)) {
      throw new MatimoError(`Skill not found: ${skillPath}`, ErrorCode.TOOL_NOT_FOUND);
    }

    const content = fs.readFileSync(skillPath, 'utf-8');
    const parsed = parseSkillContent(content);

    if (parsed.error) {
      throw new MatimoError(`Failed to parse skill: ${parsed.error}`, ErrorCode.INVALID_SCHEMA);
    }

    const { frontmatter } = parsed;

    // Verify frontmatter name matches directory name
    if (frontmatter.name !== name) {
      throw new MatimoError(
        `Skill name "${frontmatter.name}" must match directory name "${name}"`,
        ErrorCode.INVALID_SCHEMA
      );
    }

    const resources = listBundledResources(skillDir);

    const skill: SkillDefinition = {
      name: frontmatter.name,
      description: frontmatter.description,
      version: frontmatter.version,
      license: frontmatter.license,
      compatibility: frontmatter.compatibility,
      allowedTools: frontmatter['allowed-tools'] as string[] | undefined,
      metadata: frontmatter.metadata,
      body: parsed.body,
      sections: parsed.sections,
      totalTokens: parsed.totalTokens,
      resources,
      source,
      _path: skillDir,
    };

    return skill;
  }

  /**
   * Load a skill resource file (scripts/, references/, assets/)
   */
  loadSkillResource(skillName: string, skillsDir: string, resourcePath: string): string {
    // Validate resource path (prevent traversal)
    if (/\.\.|\\/u.test(resourcePath) || /[\x00-\x1f]/.test(resourcePath)) {
      throw new MatimoError('Resource path contains invalid characters', ErrorCode.INVALID_SCHEMA);
    }

    const skillDir = path.join(skillsDir, skillName);
    const resourceFullPath = path.join(skillDir, resourcePath);

    // Verify path stays within skill directory
    const resolvedPath = path.resolve(resourceFullPath);
    const resolvedSkillDir = path.resolve(skillDir);
    if (
      !resolvedPath.startsWith(resolvedSkillDir + path.sep) &&
      resolvedPath !== resolvedSkillDir
    ) {
      throw new MatimoError('Resource path escapes the skill directory', ErrorCode.INVALID_SCHEMA);
    }

    if (!fs.existsSync(resourceFullPath)) {
      throw new MatimoError(`Resource file not found: ${resourcePath}`, ErrorCode.TOOL_NOT_FOUND);
    }

    try {
      return fs.readFileSync(resourceFullPath, 'utf-8');
    } catch (err) {
      throw new MatimoError(
        `Failed to read resource file: ${(err as Error).message}`,
        ErrorCode.EXECUTION_FAILED
      );
    }
  }
}
