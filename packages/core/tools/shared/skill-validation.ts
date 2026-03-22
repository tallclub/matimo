/**
 * Shared validation utilities for Agent Skills — aligned with the official
 * Agent Skills specification (https://agentskills.io/specification).
 *
 * Covers: name rules, description rules, frontmatter parsing/validation,
 * and bundled resource discovery.
 */
import fs from 'fs';
import path from 'path';

// ── Name Validation ──────────────────────────────────────────────────────────

/** Spec: lowercase letters, numbers, hyphens only. */
const VALID_NAME_PATTERN = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;

/** Consecutive hyphens are not allowed. */
const CONSECUTIVE_HYPHENS = /--/;

/** Max length for skill name. */
const MAX_NAME_LENGTH = 64;

/** Max length for description. */
const MAX_DESCRIPTION_LENGTH = 1024;

/** Max length for compatibility field. */
const MAX_COMPATIBILITY_LENGTH = 500;

/** Path traversal detection — kept for defense-in-depth. */
const UNSAFE_NAME_PATTERN = /[/\\]|\.\.|[\x00-\x1f]/;

export interface NameValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate a skill name against the Agent Skills spec.
 *
 * Rules:
 * - 1–64 characters
 * - Lowercase letters, numbers, hyphens only
 * - Must not start or end with a hyphen
 * - Must not contain consecutive hyphens (--)
 * - Must not contain path traversal characters
 */
export function validateSkillName(name: string): NameValidationResult {
  if (!name || name.trim().length === 0) {
    return { valid: false, error: 'Skill name is required' };
  }

  if (UNSAFE_NAME_PATTERN.test(name)) {
    return { valid: false, error: 'Skill name contains invalid characters' };
  }

  if (name.length > MAX_NAME_LENGTH) {
    return { valid: false, error: `Skill name must be at most ${MAX_NAME_LENGTH} characters (got ${name.length})` };
  }

  if (!VALID_NAME_PATTERN.test(name)) {
    return {
      valid: false,
      error: 'Skill name must contain only lowercase letters, numbers, and hyphens, and must not start or end with a hyphen',
    };
  }

  if (CONSECUTIVE_HYPHENS.test(name)) {
    return { valid: false, error: 'Skill name must not contain consecutive hyphens (--)' };
  }

  return { valid: true };
}

// ── Frontmatter Parsing ──────────────────────────────────────────────────────

export interface SkillFrontmatter {
  name: string;
  description: string;
  license?: string;
  compatibility?: string;
  'allowed-tools'?: string | string[];
  metadata?: Record<string, string>;
}

export interface ParsedSkill {
  frontmatter: SkillFrontmatter;
  body: string;
  raw: string;
}

export interface ParseResult {
  success: boolean;
  error?: string;
  parsed?: ParsedSkill;
}

/**
 * Parse YAML frontmatter from SKILL.md content.
 *
 * Handles the spec's required fields (name, description) and optional fields
 * (license, compatibility, metadata, allowed-tools).
 */
export function parseSkillContent(content: string): ParseResult {
  if (!content || !content.startsWith('---')) {
    return { success: false, error: 'Skill content must start with YAML frontmatter (---)' };
  }

  const endIndex = content.indexOf('---', 3);
  if (endIndex === -1) {
    return { success: false, error: 'Skill content must have closing YAML frontmatter (---)' };
  }

  const frontmatterBlock = content.substring(3, endIndex).trim();
  const body = content.substring(endIndex + 3).trim();

  // Parse frontmatter lines
  const fields: Record<string, unknown> = {};
  let currentMetadata: Record<string, string> | null = null;
  let currentArray: string[] | null = null;
  let currentArrayKey: string | null = null;

  for (const line of frontmatterBlock.split('\n')) {
    // Detect array elements (prefixed with "- ")
    if (currentArray !== null && /^\s*- /.test(line)) {
      const item = line.trim().substring(2).trim();
      if (item) {
        currentArray.push(item.replace(/^["']|["']$/g, ''));
      }
      continue;
    }

    // Detect metadata sub-keys (indented with spaces under "metadata:")
    if (currentMetadata !== null && /^\s+\S/.test(line)) {
      const colonIndex = line.indexOf(':');
      if (colonIndex !== -1) {
        const key = line.substring(0, colonIndex).trim();
        const value = line.substring(colonIndex + 1).trim();
        if (key && value) {
          currentMetadata[key] = value.replace(/^["']|["']$/g, '');
        }
      }
      continue;
    }

    // Top-level keys
    currentMetadata = null;
    currentArray = null;
    currentArrayKey = null;
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;

    const key = line.substring(0, colonIndex).trim();
    const value = line.substring(colonIndex + 1).trim();

    if (key === 'metadata' && !value) {
      // Start collecting metadata sub-keys
      currentMetadata = {};
      fields['__metadata__'] = 'MAP';
      continue;
    }

    // Check for array start (value is empty, array items follow on next lines)
    if (key === 'allowed-tools' && !value) {
      currentArray = [];
      currentArrayKey = 'allowed-tools';
      continue;
    }

    if (key && value) {
      // Strip surrounding quotes (YAML style)
      fields[key] = value.replace(/^["']|["']$/g, '');
    }
  }

  // Store any pending array
  if (currentArray !== null && currentArrayKey) {
    fields[currentArrayKey] = currentArray;
  }

  // Build frontmatter object
  const frontmatter: SkillFrontmatter = {
    name: fields.name as string || '',
    description: fields.description as string || '',
  };

  if (fields.license) frontmatter.license = fields.license as string;
  if (fields.compatibility) frontmatter.compatibility = fields.compatibility as string;
  if (fields['allowed-tools']) {
    frontmatter['allowed-tools'] = Array.isArray(fields['allowed-tools'])
      ? (fields['allowed-tools'] as string[])
      : (fields['allowed-tools'] as string);
  }
  if (currentMetadata && Object.keys(currentMetadata).length > 0) {
    frontmatter.metadata = currentMetadata;
  }

  return {
    success: true,
    parsed: { frontmatter, body, raw: content },
  };
}

// ── Frontmatter Validation ───────────────────────────────────────────────────

export interface ValidationIssue {
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}

/**
 * Validate parsed frontmatter against the Agent Skills spec.
 *
 * Checks: name rules, description rules, optional field constraints,
 * and name/directory consistency (if directoryName provided).
 */
export function validateFrontmatter(
  frontmatter: SkillFrontmatter,
  directoryName?: string,
): ValidationResult {
  const issues: ValidationIssue[] = [];

  // Required: name
  if (!frontmatter.name) {
    issues.push({ field: 'name', message: 'YAML frontmatter must include a "name" field', severity: 'error' });
  } else {
    const nameResult = validateSkillName(frontmatter.name);
    if (!nameResult.valid) {
      issues.push({ field: 'name', message: nameResult.error!, severity: 'error' });
    }
  }

  // Required: description
  if (!frontmatter.description) {
    issues.push({ field: 'description', message: 'YAML frontmatter must include a "description" field', severity: 'error' });
  } else if (frontmatter.description.length > MAX_DESCRIPTION_LENGTH) {
    issues.push({
      field: 'description',
      message: `Description must be at most ${MAX_DESCRIPTION_LENGTH} characters (got ${frontmatter.description.length})`,
      severity: 'error',
    });
  }

  // Optional: compatibility
  if (frontmatter.compatibility && frontmatter.compatibility.length > MAX_COMPATIBILITY_LENGTH) {
    issues.push({
      field: 'compatibility',
      message: `Compatibility must be at most ${MAX_COMPATIBILITY_LENGTH} characters (got ${frontmatter.compatibility.length})`,
      severity: 'error',
    });
  }

  // name must match directory name (if provided)
  if (directoryName && frontmatter.name && frontmatter.name !== directoryName) {
    issues.push({
      field: 'name',
      message: `Skill name "${frontmatter.name}" must match its directory name "${directoryName}"`,
      severity: 'error',
    });
  }

  return {
    valid: issues.filter(i => i.severity === 'error').length === 0,
    issues,
  };
}

// ── Bundled Resources (Level 3) ──────────────────────────────────────────────

export interface BundledResources {
  scripts: string[];
  references: string[];
  assets: string[];
  other: string[];
}

/**
 * List bundled resources in a skill directory.
 *
 * The spec recognizes three standard subdirectories:
 * - scripts/   — executable code
 * - references/ — additional documentation
 * - assets/    — templates, resources
 *
 * Any other files (besides SKILL.md) are listed under "other".
 */
export function listBundledResources(skillDir: string): BundledResources {
  const resources: BundledResources = {
    scripts: [],
    references: [],
    assets: [],
    other: [],
  };

  if (!fs.existsSync(skillDir)) return resources;

  const KNOWN_DIRS: Record<string, keyof Pick<BundledResources, 'scripts' | 'references' | 'assets'>> = {
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
        // List files inside the known subdirectory
        const subDir = path.join(skillDir, entry.name);
        const subEntries = fs.readdirSync(subDir);
        for (const sub of subEntries) {
          resources[category].push(`${entry.name}/${sub}`);
        }
      } else {
        // Unknown directory — list contents under "other"
        const subDir = path.join(skillDir, entry.name);
        const subEntries = fs.readdirSync(subDir);
        for (const sub of subEntries) {
          resources.other.push(`${entry.name}/${sub}`);
        }
      }
    } else {
      // Top-level file (not SKILL.md)
      resources.other.push(entry.name);
    }
  }

  return resources;
}
