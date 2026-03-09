/**
 * CLI command: matimo mcp setup
 *
 * Interactive config generator for MCP server.
 * Detects installed tools, scans for required auth env vars,
 * and outputs a ready-to-paste Claude Desktop / Cursor config.
 */

export async function mcpSetupCommand(): Promise<void> {
  console.info('\n🔨 Matimo MCP Setup\n');
  console.info('Scanning for installed tool packages...\n');

  try {
    // @ts-ignore - dynamic import of package resolved at runtime
    const { ToolLoader, extractAuthPlaceholders } = await import('@matimo/core');
    const loader = new ToolLoader();

    // Auto-discover installed packages
    const toolPaths = loader.autoDiscoverPackages();

    if (toolPaths.length === 0) {
      console.info('No @matimo/* tool packages found.');
      console.info('Install tools first: matimo install slack github\n');
      return;
    }

    // Load all tools
    const tools = loader.loadToolsFromMultiplePaths(toolPaths);

    console.info(`Found ${tools.size} tools across ${toolPaths.length} package(s):\n`);

    // Group tools by provider (extract from tool name prefix)
    const providers = new Map<string, string[]>();
    const authVars = new Set<string>();

    for (const [name, tool] of tools) {
      // Extract provider from tool name (e.g., "slack_send" → "slack")
      const provider = name.includes('_')
        ? name.split('_')[0]
        : name.includes('-')
          ? name.split('-')[0]
          : 'core';

      if (!providers.has(provider)) {
        providers.set(provider, []);
      }
      providers.get(provider)!.push(name);

      // Extract auth placeholders
      const placeholders = extractAuthPlaceholders(tool);
      for (const p of placeholders) {
        authVars.add(p);
      }
    }

    // Display providers and tools
    for (const [provider, toolNames] of providers) {
      console.info(`  📦 ${provider} (${toolNames.length} tools)`);
      for (const name of toolNames.slice(0, 5)) {
        console.info(`     • ${name}`);
      }
      if (toolNames.length > 5) {
        console.info(`     ... and ${toolNames.length - 5} more`);
      }
    }

    console.info('');

    // Display required env vars
    if (authVars.size > 0) {
      console.info('🔐 Required environment variables:\n');
      for (const v of authVars) {
        const value = process.env[v] || process.env[`MATIMO_${v}`];
        const status = value ? '✅' : '❌';
        console.info(`  ${status} ${v}`);
      }
      console.info('');
    }

    // Generate Claude Desktop config
    const envBlock: Record<string, string> = {};
    for (const v of authVars) {
      envBlock[v] = process.env[v] || '<your-token>';
    }

    const claudeConfig = {
      mcpServers: {
        matimo: {
          command: 'npx',
          args: ['matimo', 'mcp'],
          env: envBlock,
        },
      },
    };

    console.info('📋 Claude Desktop config (paste into Settings → Developer → MCP Servers):\n');
    console.info(JSON.stringify(claudeConfig, null, 2));

    // Generate Cursor config
    console.info('\n📋 Cursor config (paste into .cursor/mcp.json):\n');
    const cursorConfig = {
      mcpServers: {
        matimo: {
          command: 'npx',
          args: ['matimo', 'mcp'],
          env: envBlock,
        },
      },
    };
    console.info(JSON.stringify(cursorConfig, null, 2));

    // HTTP mode example
    console.info('\n📋 HTTP mode (for remote hosting / Docker):\n');
    const envExport = [...authVars].map((v) => `  ${v}=<your-token>`).join(' \\\n');
    console.info(`  ${envExport} \\`);
    console.info(`  MATIMO_MCP_TOKEN=<your-server-secret> \\`);
    console.info(`  npx matimo mcp --transport http --port 3000\n`);
  } catch (error) {
    console.error('❌ Setup failed:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
