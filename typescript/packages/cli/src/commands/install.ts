import { execFileSync } from 'child_process';

/**
 * Install command - Install a specific tool package
 * matimo install slack gmail stripe
 */
export async function installCommand(toolNames: string[]): Promise<void> {
  if (!toolNames || toolNames.length === 0) {
    console.error('❌ Error: Please specify at least one tool to install');
    console.info('\nUsage: matimo install [tool1] [tool2] [tool3]...');
    console.info('Example: matimo install slack gmail stripe');
    process.exit(1);
  }

  const packages = toolNames.map((name) => `@matimo/${name}`);

  try {
    console.info(`📦 Installing ${packages.join(', ')}...`);

    // Run npm install for the packages without invoking a shell
    execFileSync('npm', ['install', ...packages], { stdio: 'inherit' });

    console.info('\n✅ Installation complete!');
    console.info('\nNext steps:');
    console.info('1. Import and initialize Matimo with auto-discovery (Recommended):');
    console.info('   const matimo = await MatimoInstance.init({ autoDiscover: true });');
    console.info('\n2. Or explicitly load the tools (ESM):');
    console.info(`   import { createRequire } from 'module';
   const require = createRequire(import.meta.url);
   const matimo = await MatimoInstance.init({
     toolPaths: [
       require.resolve('@matimo/slack/tools'),
       require.resolve('@matimo/gmail/tools'),
     ]
   });`);
    console.info('\n3. Or use file URLs (Alternative ESM approach):');
    console.info(`   import { fileURLToPath } from 'url';
   import path from 'path';
   const __dirname = path.dirname(fileURLToPath(import.meta.url));
   const matimo = await MatimoInstance.init({
     toolPaths: [
       path.join(__dirname, 'node_modules/@matimo/slack/tools'),
       path.join(__dirname, 'node_modules/@matimo/gmail/tools'),
     ]
   });`);
    console.info('\n📖 For more info: https://github.com/tallclub/matimo#readme');
  } catch (error) {
    console.error(
      '❌ Installation failed:',
      error instanceof Error ? error.message : String(error)
    );
    process.exit(1);
  }
}
