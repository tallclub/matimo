#!/usr/bin/env node
/**
 * Matimo CLI entry point
 *
 * This is the npm bin target — compiled to dist/bin.js.
 * All command routing (install, list, search, mcp, etc.) is handled by cli.ts.
 *
 * Uses tsx to register ESM hooks so extensionless imports in @matimo/core work
 * correctly. This is required because @matimo/core compiles TypeScript with
 * "moduleResolution": "bundler" which omits .js extensions in the output.
 *
 * Tool discovery works automatically via ToolLoader.getNodeModulesPath():
 *   1. Walks up from process.cwd() to find node_modules/@matimo/*
 *   2. Falls back to __dirname-based discovery (for Claude Desktop where cwd='/')
 *
 * Users run:
 *   npx matimo mcp                         # stdio mode
 *   npx matimo mcp --transport http        # http mode
 *   npx matimo install slack gmail         # install providers
 *   npx matimo list                        # list installed tools
 */
import { spawn } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Resolve tsx from this package's dependencies
const require = createRequire(import.meta.url);
let tsxBin: string;
try {
  const tsxPkgPath = require.resolve('tsx/package.json');
  tsxBin = join(dirname(tsxPkgPath), 'dist', 'cli.mjs');
} catch {
  tsxBin = 'tsx';
}

const cliScript = join(__dirname, 'cli.js');
const child = spawn(process.execPath, [tsxBin, cliScript, ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: process.env,
});

child.on('error', (error: Error) => {
  console.error('❌ Failed to start Matimo CLI. Make sure tsx is installed.');
  console.error('   Run: npm install tsx');
  console.error('   Error:', error.message);
  process.exit(1);
});

child.on('exit', (code: number | null) => process.exit(code || 0));
