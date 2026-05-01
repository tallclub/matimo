import { execFileSync } from 'child_process';

export const BRU_MIN_VERSION_STR = '1.0.0';
const BRU_MIN_VERSION = [1, 0, 0] as const;

/**
 * Verify the Bruno CLI is installed and meets the minimum required version.
 *
 * - Throws if `bru` is not found in PATH (ENOENT).
 * - Throws if the installed version is below {@link BRU_MIN_VERSION_STR}.
 * - Skips silently if the version string cannot be parsed (graceful degradation).
 */
export function checkBruVersion(): void {
  let versionOutput: string;
  try {
    versionOutput = execFileSync('bru', ['--version'], { encoding: 'utf-8', stdio: 'pipe' });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(
        "Bruno CLI ('bru') is not installed or not in PATH. " +
          'Install it with: npm install -g @usebruno/cli',
      );
    }
    // Other error — skip version check (bru is installed but --version failed for another reason)
    return;
  }

  const match = versionOutput.trim().match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) return; // Unparseable output — skip check

  const installed: [number, number, number] = [
    parseInt(match[1], 10),
    parseInt(match[2], 10),
    parseInt(match[3], 10),
  ];

  const [iMaj, iMin, iPatch] = installed;
  const [minMaj, minMin, minPatch] = BRU_MIN_VERSION;

  const belowMin =
    iMaj < minMaj ||
    (iMaj === minMaj && iMin < minMin) ||
    (iMaj === minMaj && iMin === minMin && iPatch < minPatch);

  if (belowMin) {
    throw new Error(
      `Bruno CLI version ${versionOutput.trim()} is below the minimum required version ` +
        `${BRU_MIN_VERSION_STR}. Upgrade with: npm install -g @usebruno/cli`,
    );
  }
}
