import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';

/**
 * Version of the installed @matimo/cli package.
 * Resolved relative to this file (not cwd), so it reports the CLI's own version
 * rather than the version of whichever project the CLI is run from.
 * Works from both src/ and dist/ (package.json is one level up).
 */
/* istanbul ignore next */
export function getPackageVersion(): string {
  try {
    const pkgPath = fileURLToPath(new URL('../package.json', import.meta.url));
    return JSON.parse(readFileSync(pkgPath, 'utf8')).version ?? 'unknown';
  } catch {
    return 'unknown';
  }
}
