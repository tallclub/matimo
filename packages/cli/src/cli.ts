import { readFileSync } from 'fs';
import { join, basename } from 'path';
import { installCommand } from './commands/install.js';
import { listCommand } from './commands/list.js';
import { searchCommand } from './commands/search.js';
import { mcpCommand } from './commands/mcp.js';

function getPackageVersion(): string {
  try {
    const pkgPath = join(process.cwd(), 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    return pkg.version;
  } catch {
    return 'unknown';
  }
}

export function showHelp(): void {
  console.info(`
🔨 Matimo CLI - Tool Package Manager

Usage: matimo [command] [options]

Commands:
  install <tools...>    Install tool packages
                       Example: matimo install slack gmail
  
  list                  List installed Matimo tools
                       Example: matimo list
  
  search <query>        Search for available tools
                       Example: matimo search slack
  
  mcp                   Start MCP server (Model Context Protocol)
                       Example: matimo mcp
                       Example: matimo mcp --transport http --port 3000
  
  mcp setup             Generate config for Claude Desktop / Cursor
                       Example: matimo mcp setup
  
  help                  Show this help message
  
  version               Show version information

MCP Options:
  --transport <type>    Transport mode: stdio (default) or http
  --port <number>       HTTP port (default: 3000)
  --tools <list>        Comma-separated tool allowlist
  --exclude <list>      Comma-separated tool denylist
  --secrets <list>      Secret resolvers: env,dotenv,vault,aws
  --token <string>      Bearer token for HTTP mode
  --env-file <path>     Path to .env file

Examples:
  # Install new tools
  $ matimo install slack
  $ matimo install gmail stripe
  
  # List all installed tools
  $ matimo list
  
  # Search for tools
  $ matimo search email
  
  # Start MCP server for Claude Desktop
  $ matimo mcp
  
  # Start MCP HTTP server with auth
  $ MATIMO_MCP_TOKEN=secret matimo mcp --transport http
  
  # Generate Claude Desktop config
  $ matimo mcp setup

Documentation: https://github.com/tallclub/matimo#readme
Issues: https://github.com/tallclub/matimo/issues
`);
}

/**
 * Main CLI handler - parses commands and routes to appropriate handlers
 */
export async function main(cliArgs?: string[]): Promise<void> {
  const args = cliArgs || process.argv.slice(2);
  const command = args[0];
  const params = args.slice(1);

  if (!command) {
    showHelp();
    process.exit(0);
  }

  try {
    switch (command.toLowerCase()) {
      case 'install':
        await installCommand(params);
        break;
      case 'list':
        await listCommand();
        break;
      case 'search':
        await searchCommand(params[0] || '');
        break;
      case 'mcp':
        await mcpCommand(params);
        break;
      case 'help':
      case '-h':
      case '--help':
        showHelp();
        break;
      case 'version':
      case '-v':
      case '--version':
        console.info(`matimo-cli v${getPackageVersion()}`);
        break;
      default:
        console.error(`❌ Unknown command: ${command}`);
        console.info('\nRun "matimo help" for available commands');
        process.exit(1);
    }
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// Auto-execute when run directly (e.g., via tsx src/cli.ts or through bin.ts).
// bin.ts spawns: node <tsx-cli.mjs> <cli.js> ...args
// - When tsx shifts its own entry out of argv: process.argv[1] == cli.js
// - When tsx does NOT shift argv:              process.argv[2] == cli.js
// Checking both slots handles either tsx version. When imported as a module
// (tests, bin.ts import) neither slot contains 'cli.js'.
// Use basename() to normalise path separators (POSIX / and Windows \).
/* istanbul ignore next */
const toCliJs = (s: string) => basename(s).replace(/\.ts$/, '.js');
/* istanbul ignore next */
const isRunDirectly =
  toCliJs(process.argv[1] ?? '') === 'cli.js' || toCliJs(process.argv[2] ?? '') === 'cli.js';
/* istanbul ignore next */
if (isRunDirectly) {
  main().catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}
