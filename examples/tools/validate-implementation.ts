#!/usr/bin/env node
/**
 * Matimo Implementation Validator
 *
 * Runs all implementation examples with auto-approval and produces
 * a comprehensive validation report.
 *
 * Usage:
 *   npx tsx validate-implementation.ts [--skip-policy] [--skip-skills] [--skip-meta-tools]
 *
 * Examples:
 *   npx tsx validate-implementation.ts                    # Run all validations
 *   npx tsx validate-implementation.ts --skip-policy      # Skip policy demo
 *   npx tsx validate-implementation.ts --quiet            # Suppress console output
 */

import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { config as loadDotenv } from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env from examples/tools/ root so spawned child processes inherit all env vars
loadDotenv({ path: path.join(__dirname, '.env') });

interface ValidationResult {
  name: string;
  status: 'PASS' | 'FAIL' | 'SKIPPED';
  duration: number;
  errorMsg?: string;
  output?: string;
}

const results: ValidationResult[] = [];
const args = process.argv.slice(2);
const skipPolicy = args.includes('--skip-policy');
const skipSkills = args.includes('--skip-skills');
const skipMetaTools = args.includes('--skip-meta-tools');
const quiet = args.includes('--quiet');

function log(msg: string): void {
  if (!quiet) console.info(msg);
}

function header(title: string): void {
  log('\n' + '═'.repeat(70));
  log(`  ${title}`);
  log('═'.repeat(70));
}

/**
 * Run a demo script with auto-approval inputs
 */
async function runDemoWithAutoApproval(
  demoPath: string,
  demoName: string,
  autoApprovals: number
): Promise<ValidationResult> {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const approvalInputs = Array(autoApprovals).fill('y').join('\n');

    log(`\n⏱️  Running ${demoName}...`);

    const child = spawn('npx', ['tsx', demoPath], {
      cwd: path.dirname(demoPath),
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    // Feed approval inputs to stdin
    child.stdin.write(approvalInputs + '\n');
    child.stdin.end();

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data: Buffer) => {
      stdout += data.toString();
      if (!quiet) process.stdout.write(data);
    });

    child.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
      if (!quiet) process.stderr.write(data);
    });

    child.on('close', (code: number | null) => {
      const duration = Date.now() - startTime;
      const result: ValidationResult = {
        name: demoName,
        status: code === 0 ? 'PASS' : 'FAIL',
        duration,
        output: stdout,
      };

      if (code !== 0) {
        result.errorMsg = stderr || `Exit code: ${code}`;
      }

      resolve(result);
    });

    child.on('error', (err: Error) => {
      const duration = Date.now() - startTime;
      resolve({
        name: demoName,
        status: 'FAIL',
        duration,
        errorMsg: err.message,
      });
    });
  });
}

async function main(): Promise<void> {
  header('Matimo Implementation Validation');

  log('\nValidating:');
  if (!skipPolicy) log('  ✓ Policy Engine (matimo policy enforcement)');
  if (!skipSkills) log('  ✓ Skills System (SKILL.md creation and validation)');
  if (!skipMetaTools) log('  ✓ Meta-Tools (doctor, review, reload)');

  const examplesDir = __dirname;

  // Policy Demo
  if (!skipPolicy) {
    log('\n' + '─'.repeat(70));
    const policyDemo = path.join(examplesDir, 'policy', 'policy-demo.ts');
    if (fs.existsSync(policyDemo)) {
      const result = await runDemoWithAutoApproval(policyDemo, 'Policy-Demo', 5);
      results.push(result);
      log(`  ${result.status === 'PASS' ? '✅' : '❌'} ${result.name} (${result.duration}ms)`);
    } else {
      results.push({ name: 'Policy-Demo', status: 'SKIPPED', duration: 0 });
      log(`  ⊘ Policy-Demo (file not found)`);
    }
  } else {
    results.push({ name: 'Policy-Demo', status: 'SKIPPED', duration: 0 });
    log('\n  ⊘ Policy-Demo (skipped)');
  }

  // Skills Demo
  if (!skipSkills) {
    log('─'.repeat(70));
    const skillsDemo = path.join(examplesDir, 'skills', 'skills-demo.ts');
    if (fs.existsSync(skillsDemo)) {
      const result = await runDemoWithAutoApproval(skillsDemo, 'Skills-Demo', 3);
      results.push(result);
      log(`  ${result.status === 'PASS' ? '✅' : '❌'} ${result.name} (${result.duration}ms)`);
    } else {
      results.push({ name: 'Skills-Demo', status: 'SKIPPED', duration: 0 });
      log(`  ⊘ Skills-Demo (file not found)`);
    }
  } else {
    results.push({ name: 'Skills-Demo', status: 'SKIPPED', duration: 0 });
    log('\n  ⊘ Skills-Demo (skipped)');
  }

  // Meta-Tools Integration
  if (!skipMetaTools) {
    log('─'.repeat(70));
    const metaFlow = path.join(examplesDir, 'meta-flow', 'meta-tools-integration.ts');
    if (fs.existsSync(metaFlow)) {
      const result = await runDemoWithAutoApproval(metaFlow, 'Meta-Tools', 6);
      results.push(result);
      log(`  ${result.status === 'PASS' ? '✅' : '❌'} ${result.name} (${result.duration}ms)`);
    } else {
      results.push({ name: 'Meta-Tools', status: 'SKIPPED', duration: 0 });
      log(`  ⊘ Meta-Tools (file not found)`);
    }
  } else {
    results.push({ name: 'Meta-Tools', status: 'SKIPPED', duration: 0 });
    log('\n  ⊘ Meta-Tools (skipped)');
  }

  // Summary
  header('VALIDATION SUMMARY');

  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = results.filter((r) => r.status === 'FAIL').length;
  const skipped = results.filter((r) => r.status === 'SKIPPED').length;
  const totalTime = results.reduce((sum, r) => sum + r.duration, 0);

  log('\nResults:');
  for (const result of results) {
    const icon = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '⊘';
    log(`  ${icon}  ${result.name.padEnd(25)} ${result.status.padEnd(8)} (${result.duration}ms)`);
    if (result.errorMsg) {
      log(`      Error: ${result.errorMsg}`);
    }
  }

  log(`\nSummary:`);
  log(`  Passed:  ${passed}`);
  log(`  Failed:  ${failed}`);
  log(`  Skipped: ${skipped}`);
  log(`  Total:   ${results.length}`);
  log(`  Time:    ${(totalTime / 1000).toFixed(2)}s`);

  // Exit with error if any failed
  const exitCode = failed > 0 ? 1 : 0;
  log(`\n${exitCode === 0 ? '✅ All validations passed' : '❌ Some validations failed'}\n`);
  process.exit(exitCode);
}

main().catch((err) => {
  console.error('Validation error:', err);
  process.exit(1);
});
