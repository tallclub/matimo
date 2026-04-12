import * as fs from 'fs';
import * as path from 'path';

/**
 * doctor command — diagnose Matimo setup and report actionable issues.
 * matimo doctor
 */

interface Issue {
  severity: 'error' | 'warn' | 'info';
  message: string;
}

const issues: Issue[] = [];

function check(
  label: string,
  pass: boolean,
  message: string,
  severity: 'error' | 'warn' = 'error'
): void {
  const icon = pass ? '✅' : severity === 'error' ? '❌' : '⚠️ ';
  console.info(`  ${icon} ${label}`);
  if (!pass) {
    issues.push({ severity, message });
    console.info(`     ${message}`);
  }
}

function findNodeModules(): string | null {
  let dir = process.cwd();
  for (let i = 0; i < 10; i++) {
    const candidate = path.join(dir, 'node_modules');
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

async function loadMatimoCoreExport<T>(exportName: string): Promise<T | null> {
  try {
    // Dynamic import works in both ESM (built CLI) and CJS (ts-jest test transform)
    const core = (await import('@matimo/core')) as Record<string, unknown>;
    return (core[exportName] as T) ?? null;
  } catch {
    return null;
  }
}

export async function doctorCommand(): Promise<void> {
  // Ensure issues do not accumulate across multiple invocations
  issues.length = 0;
  console.info('\n🩺 Matimo Doctor — Checking your setup...\n');

  // ─── 1. Node.js version ────────────────────────────────────────────────
  console.info('Node.js:');
  const nodeVersion = process.versions.node;
  const [major] = nodeVersion.split('.').map(Number);
  check(
    `Node.js v${nodeVersion}`,
    major >= 18,
    `Node.js 18+ required. You are running ${nodeVersion}. Upgrade: https://nodejs.org`
  );
  console.info('');

  // ─── 2. @matimo/* packages ─────────────────────────────────────────────
  const nodeModulesPath = findNodeModules();
  console.info('@matimo/* packages:');

  if (!nodeModulesPath) {
    check('node_modules', false, 'node_modules not found. Run "pnpm install" or "npm install".');
    console.info('');
  } else {
    const matimoScope = path.join(nodeModulesPath, '@matimo');
    const hasScope = fs.existsSync(matimoScope);

    if (!hasScope) {
      check(
        '@matimo scope',
        false,
        'No @matimo/* packages installed. Run "matimo install slack" to get started.',
        'warn'
      );
    } else {
      const packages = fs.readdirSync(matimoScope).filter((d) => !d.startsWith('.'));

      if (packages.length === 0) {
        check(
          '@matimo scope',
          false,
          'No @matimo/* packages installed. Run "matimo install slack" to get started.',
          'warn'
        );
      } else {
        for (const pkg of packages) {
          const pkgDir = path.join(matimoScope, pkg);
          const pkgJsonPath = path.join(pkgDir, 'package.json');

          if (!fs.existsSync(pkgJsonPath)) continue;

          console.info(`  📦 @matimo/${pkg}`);

          // Check env vars for auth placeholders
          const toolsDir = path.join(pkgDir, 'tools');
          if (fs.existsSync(toolsDir)) {
            const toolDirs = fs.readdirSync(toolsDir).filter((d) => {
              return fs.existsSync(path.join(toolsDir, d, 'definition.yaml'));
            });

            const missingEnv: string[] = [];
            const seenVars = new Set<string>();

            for (const toolName of toolDirs) {
              const yamlPath = path.join(toolsDir, toolName, 'definition.yaml');
              const content = fs.readFileSync(yamlPath, 'utf-8');

              // Scan for {ENV_VAR_NAME} placeholders in headers/URLs
              const placeholderRegex = /\{(\w+)\}/g;
              let match;
              while ((match = placeholderRegex.exec(content)) !== null) {
                const name = match[1];
                if (isAuthVar(name) && !seenVars.has(name)) {
                  seenVars.add(name);
                  if (!process.env[name]) {
                    missingEnv.push(name);
                  }
                }
              }
            }

            if (missingEnv.length > 0) {
              issues.push({
                severity: 'error',
                message: `@matimo/${pkg}: missing env vars: ${missingEnv.join(', ')}`,
              });
              for (const v of missingEnv) {
                console.info(`     ❌ Missing env var: ${v}`);
              }
            } else {
              console.info(`     ✅ All required env vars are set`);
            }

            // Validate YAML schemas
            let yamlErrors = 0;
            const validateToolDefinition =
              await loadMatimoCoreExport<(t: unknown) => unknown>('validateToolDefinition');

            if (validateToolDefinition) {
              const yaml = await import('js-yaml');
              for (const toolName of toolDirs) {
                const yamlPath = path.join(toolsDir, toolName, 'definition.yaml');
                try {
                  const parsed = yaml.load(fs.readFileSync(yamlPath, 'utf-8'));
                  validateToolDefinition(parsed);
                } catch (err) {
                  yamlErrors++;
                  issues.push({
                    severity: 'error',
                    message: `@matimo/${pkg}/${toolName}: YAML invalid — ${(err as Error).message}`,
                  });
                  console.info(`     ❌ ${toolName}: invalid YAML`);
                  console.info(`        ${(err as Error).message.split('\n')[0]}`);
                }
              }
              if (yamlErrors === 0 && toolDirs.length > 0) {
                console.info(`     ✅ ${toolDirs.length} tool YAML(s) valid`);
              }
            }
          }
          console.info('');
        }
      }
    }
  }

  // ─── 3. MATIMO_APPROVAL_SECRET ─────────────────────────────────────────
  console.info('Policy / Approval:');
  const hasApprovalSecret = !!process.env.MATIMO_APPROVAL_SECRET;
  check(
    'MATIMO_APPROVAL_SECRET',
    hasApprovalSecret,
    'MATIMO_APPROVAL_SECRET is not set. Agent-created tool approvals will use a random secret (not persistent across restarts). Set it in your .env file.',
    'warn'
  );
  console.info('');

  // ─── 4. Summary ────────────────────────────────────────────────────────
  const errors = issues.filter((i) => i.severity === 'error');
  const warnings = issues.filter((i) => i.severity === 'warn');

  console.info('─'.repeat(60));
  if (errors.length === 0 && warnings.length === 0) {
    console.info('\n✅ Matimo is ready! No issues found.\n');
  } else {
    if (errors.length > 0) {
      console.info(`\n❌ ${errors.length} error(s) found — fix before using Matimo:\n`);
      errors.forEach((e, i) => console.info(`  ${i + 1}. ${e.message}`));
      console.info('');
    }
    if (warnings.length > 0) {
      console.info(`⚠️  ${warnings.length} warning(s):\n`);
      warnings.forEach((w, i) => console.info(`  ${i + 1}. ${w.message}`));
      console.info('');
    }
  }

  if (errors.length > 0) process.exit(1);
}

/** Heuristic: is this placeholder likely an auth/secret env var? */
function isAuthVar(name: string): boolean {
  const upper = name.toUpperCase();
  return (
    upper.includes('TOKEN') ||
    upper.includes('SECRET') ||
    upper.includes('KEY') ||
    upper.includes('PASSWORD') ||
    upper.includes('CREDENTIAL') ||
    upper.includes('AUTH')
  );
}
