/**
 * Tool validation script
 * Validates all YAML tool definitions against schema
 */

import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { fileURLToPath } from 'url';
import { validateToolDefinition, validateProviderDefinition } from '../packages/core/src/core/schema';

// ESM compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PACKAGES_DIR = path.join(__dirname, '../packages');

/**
 * Validate a single tool YAML file
 * @param filePath - Path to the tool YAML file
 * @returns true if valid, false otherwise
 */
function validateToolFile(filePath: string): boolean {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const parsed = yaml.load(content);

    // Determine type and validate with appropriate Zod schema
    const type = (parsed as any)?.type;

    if (type === 'provider') {
      validateProviderDefinition(parsed);
      console.log(`✅ ${filePath} (provider)`);
    } else {
      validateToolDefinition(parsed);
      console.log(`✅ ${filePath} (tool)`);
    }

    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`❌ ${filePath}: ${errorMessage}`);
    return false;
  }
}

/**
 * Validate all tools in all packages
 */
function validateTools(): void {
  console.log('Validating tools...\n');

  if (!fs.existsSync(PACKAGES_DIR)) {
    console.log('Packages directory not found');
    process.exit(0);
  }

  let valid = 0;
  let invalid = 0;
  let skipped = 0;

  /**
   * Recursively find and validate all definition.yaml files
   */
  function walkDirectory(dir: string): void {
    const items = fs.readdirSync(dir);

    items.forEach((item) => {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        // Check if this directory has definition.yaml
        const definitionFile = path.join(fullPath, 'definition.yaml');
        if (fs.existsSync(definitionFile)) {
          const result = validateToolFile(definitionFile);
          if (result) {
            valid++;
          } else {
            invalid++;
          }
        }

        // Always recursively check subdirectories, regardless of whether
        // this directory has definition.yaml (to handle nested structures)
        walkDirectory(fullPath);
      }
    });
  }

  // Check tools in each package
  const packageItems = fs.readdirSync(PACKAGES_DIR);
  packageItems.forEach((packageName) => {
    const packagePath = path.join(PACKAGES_DIR, packageName);
    const stat = fs.statSync(packagePath);
    if (stat.isDirectory()) {
      const toolsPath = path.join(packagePath, 'tools');
      if (fs.existsSync(toolsPath)) {
        walkDirectory(toolsPath);
      }
    }
  });

  console.log(`\nResults: ${valid} valid, ${invalid} invalid, ${skipped} skipped (no definition.yaml)`);
  process.exit(invalid > 0 ? 1 : 0);
}

validateTools();

export { validateToolFile };
