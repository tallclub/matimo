/**
 * Search command - Search for available Matimo packages
 * Works for both end-users (searches installed packages) and contributors (searches repo packages)
 * matimo search slack
 */
import fs from 'fs';
import path from 'path';

export async function searchCommand(query: string): Promise<void> {
  if (!query) {
    console.error('❌ Error: Please specify a search query');
    console.info('\nUsage: matimo search <query>');
    console.info('Example: matimo search slack');
    process.exit(1);
  }

  interface PackageInfo {
    name: string;
    description: string;
    tools: number;
    status: 'available' | 'coming-soon';
  }

  const availablePackages: PackageInfo[] = [];

  // Determine search context: contributor (repo) or end-user (installed)
  // First, check if node_modules/@matimo exists (user project)
  const installedPackagesDir = path.resolve(process.cwd(), 'node_modules/@matimo');
  const hasInstalledPackages = fs.existsSync(installedPackagesDir);

  // Then check if we're in the Matimo repo by looking for pnpm-workspace.yaml
  const repoRoot = findRepoRoot(process.cwd());
  const isInRepo = repoRoot !== null;
  const repoPackagesDir = isInRepo ? path.resolve(repoRoot, 'packages') : null;

  let searchDir: string;
  let searchContext: 'repository' | 'installed';
  let skipDirs: string[] = [];

  // Priority: if in repo, search repo; else if installed packages exist, search those
  if (isInRepo && repoPackagesDir) {
    searchDir = repoPackagesDir;
    searchContext = 'repository';
    skipDirs = ['core', 'cli'];
  } else if (hasInstalledPackages) {
    searchDir = installedPackagesDir;
    searchContext = 'installed';
  } else {
    console.error('❌ Error: No Matimo packages found');
    console.info(
      'Either run this in the Matimo repository or install packages: npm install @matimo/slack'
    );
    process.exit(1);
  }

  try {
    const entries = fs.readdirSync(searchDir);

    for (const entry of entries) {
      // Skip internal packages in repo context
      if (skipDirs.includes(entry)) continue;

      const packagePath = path.join(searchDir, entry);
      const packageJsonPath = path.join(packagePath, 'package.json');

      if (!fs.existsSync(packageJsonPath)) continue;

      try {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

        // Count tools in the tools directory
        const toolsDir = path.join(packagePath, 'tools');
        let toolCount = 0;
        if (fs.existsSync(toolsDir)) {
          toolCount = fs.readdirSync(toolsDir).filter((f) => {
            const stat = fs.statSync(path.join(toolsDir, f));
            return stat.isDirectory();
          }).length;
        }

        // Extract package name (remove @matimo/ prefix)
        const pkgName = packageJson.name.replace('@matimo/', '');

        availablePackages.push({
          name: pkgName,
          description: packageJson.description || 'No description available',
          tools: toolCount,
          status: 'available',
        });
      } catch {
        // Skip packages with invalid package.json
        continue;
      }
    }
  } catch {
    if (searchContext === 'installed') {
      console.error('❌ Error: Could not discover installed packages');
      console.info('Make sure you have installed Matimo packages in node_modules/@matimo/');
    } else {
      console.error('❌ Error: Could not discover packages in repository');
      console.info('Make sure you have provider packages in packages/ directory');
    }
    process.exit(1);
  }

  // Sort packages by name
  availablePackages.sort((a, b) => a.name.localeCompare(b.name));

  if (availablePackages.length === 0) {
    if (searchContext === 'installed') {
      console.error('❌ Error: No packages found in node_modules/@matimo/');
      console.info('Install Matimo packages first: npm install @matimo/slack @matimo/gmail');
    } else {
      console.error('❌ Error: No packages found in repository');
      console.info('Make sure you have provider packages in packages/ directory');
    }
    process.exit(1);
  }

  const q = query.toLowerCase();
  const results = availablePackages.filter(
    (pkg) => pkg.name.includes(q) || pkg.description.toLowerCase().includes(q)
  );

  if (results.length === 0) {
    console.info(`❌ No packages found matching "${query}"`);
    console.info(`\n📦 Available Packages (from ${searchContext}):`);
    availablePackages.forEach((pkg) => {
      console.info(`  • @matimo/${pkg.name} (${pkg.tools} tools)`);
    });
    return;
  }

  console.info(`🔍 Search results for "${query}" (${searchContext}):\n`);

  for (const pkg of results) {
    const statusEmoji = pkg.status === 'available' ? '✅' : '🔜';
    const statusText = pkg.status === 'available' ? 'Available' : 'Coming Soon';
    console.info(`${statusEmoji} @matimo/${pkg.name} (${statusText})`);
    console.info(`   ${pkg.description}`);
    console.info(`   Tools: ${pkg.tools}`);

    if (pkg.status === 'available') {
      if (searchContext === 'installed') {
        console.info(`   Already installed in your project`);
      } else {
        console.info(`   Install: matimo install ${pkg.name}`);
      }
    } else {
      console.info(`   Install: Not yet available`);
    }
    console.info('');
  }

  console.info(`Total: ${results.length} package${results.length > 1 ? 's' : ''} found`);
}

/**
 * Find the Matimo repository root by looking for pnpm-workspace.yaml
 */
function findRepoRoot(startPath: string): string | null {
  let current = startPath;

  // Safety: don't go above filesystem root
  while (current !== path.dirname(current)) {
    if (fs.existsSync(path.join(current, 'pnpm-workspace.yaml'))) {
      return current;
    }
    current = path.dirname(current);
  }

  return null;
}
