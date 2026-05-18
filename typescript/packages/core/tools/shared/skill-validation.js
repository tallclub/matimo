/**
 * Shared validation utilities for Agent Skills — aligned with the official
 * Agent Skills specification (https://agentskills.io/specification).
 *
 * Covers: name rules, description rules, frontmatter parsing/validation,
 * and bundled resource discovery.
 */
import fs from 'fs';
import path from 'path';

// Name validation
const VALID_NAME_PATTERN = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;
const CONSECUTIVE_HYPHENS = /--/;
const MAX_NAME_LENGTH = 64;
const MAX_DESCRIPTION_LENGTH = 1024;
const MAX_COMPATIBILITY_LENGTH = 500;
const UNSAFE_NAME_PATTERN = /[/\\]|\.\.|[\x00-\x1f]/;

export function validateSkillName(name) {
  if (!name || name.trim().length === 0) {
    return { valid: false, error: 'Skill name is required' };
  }

  if (UNSAFE_NAME_PATTERN.test(name)) {
    return { valid: false, error: 'Skill name contains invalid characters' };
  }

  if (name.length > MAX_NAME_LENGTH) {
    return {
      valid: false,
      error: `Skill name must be at most ${MAX_NAME_LENGTH} characters (got ${name.length})`,
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
    return { valid: false, error: 'Skill name must not contain consecutive hyphens (--)' };
  }

  return { valid: true };
}

export function parseSkillContent(content) {
  if (!content || !content.startsWith('---')) {
    return { success: false, error: 'Skill content must start with YAML frontmatter (---)' };
  }

  const endIndex = content.indexOf('---', 3);
  if (endIndex === -1) {
    return { success: false, error: 'Skill content must have closing YAML frontmatter (---)' };
  }

  const frontmatterBlock = content.substring(3, endIndex).trim();
  const body = content.substring(endIndex + 3).trim();

  const fields = {};
  let currentMetadata = null;
  let currentArray = null;
  let currentArrayKey = null;

  for (const line of frontmatterBlock.split('\n')) {
    if (currentArray !== null && /^\s*- /.test(line)) {
      const item = line.trim().substring(2).trim();
      if (item) {
        currentArray.push(item.replace(/^["']|["']$/g, ''));
      }
      continue;
    }

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

    currentMetadata = null;
    currentArray = null;
    currentArrayKey = null;
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;

    const key = line.substring(0, colonIndex).trim();
    const value = line.substring(colonIndex + 1).trim();

    if (key === 'metadata' && !value) {
      currentMetadata = {};
      fields.__metadata__ = 'MAP';
      continue;
    }

    if (key === 'allowed-tools' && !value) {
      currentArray = [];
      currentArrayKey = 'allowed-tools';
      continue;
    }

    if (key && value) {
      fields[key] = value.replace(/^["']|["']$/g, '');
    }
  }

  if (currentArray !== null && currentArrayKey) {
    fields[currentArrayKey] = currentArray;
  }

  const frontmatter = {
    name: fields.name || '',
    description: fields.description || '',
  };

  if (fields.license) frontmatter.license = fields.license;
  if (fields.compatibility) frontmatter.compatibility = fields.compatibility;
  if (fields['allowed-tools']) {
    frontmatter['allowed-tools'] = Array.isArray(fields['allowed-tools'])
      ? fields['allowed-tools']
      : fields['allowed-tools'];
  }
  if (currentMetadata && Object.keys(currentMetadata).length > 0) {
    frontmatter.metadata = currentMetadata;
  }

  return {
    success: true,
    parsed: { frontmatter, body, raw: content },
  };
}

export function validateFrontmatter(frontmatter, directoryName) {
  const issues = [];

  if (!frontmatter.name) {
    issues.push({
      field: 'name',
      message: 'YAML frontmatter must include a "name" field',
      severity: 'error',
    });
  } else {
    const nameResult = validateSkillName(frontmatter.name);
    if (!nameResult.valid) {
      issues.push({ field: 'name', message: nameResult.error, severity: 'error' });
    }
  }

  if (!frontmatter.description) {
    issues.push({
      field: 'description',
      message: 'YAML frontmatter must include a "description" field',
      severity: 'error',
    });
  } else if (frontmatter.description.length > MAX_DESCRIPTION_LENGTH) {
    issues.push({
      field: 'description',
      message: `Description must be at most ${MAX_DESCRIPTION_LENGTH} characters (got ${frontmatter.description.length})`,
      severity: 'error',
    });
  }

  if (frontmatter.compatibility && frontmatter.compatibility.length > MAX_COMPATIBILITY_LENGTH) {
    issues.push({
      field: 'compatibility',
      message: `Compatibility must be at most ${MAX_COMPATIBILITY_LENGTH} characters (got ${frontmatter.compatibility.length})`,
      severity: 'error',
    });
  }

  if (directoryName && frontmatter.name && frontmatter.name !== directoryName) {
    issues.push({
      field: 'name',
      message: `Skill name "${frontmatter.name}" must match its directory name "${directoryName}"`,
      severity: 'error',
    });
  }

  return {
    valid: issues.filter((i) => i.severity === 'error').length === 0,
    issues,
  };
}

export function listBundledResources(skillDir) {
  const resources = {
    scripts: [],
    references: [],
    assets: [],
    other: [],
  };

  if (!fs.existsSync(skillDir)) return resources;

  const KNOWN_DIRS = {
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
