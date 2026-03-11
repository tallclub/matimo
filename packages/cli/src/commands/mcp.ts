/**
 * CLI command: matimo mcp
 *
 * Starts the Matimo MCP server with configurable transport and options.
 *
 * Usage:
 *   matimo mcp                                    # stdio mode (default)
 *   matimo mcp --transport http --port 3000       # HTTP mode
 *   matimo mcp --tools slack,github               # only these tools
 *   matimo mcp --exclude postgres                 # exclude these tools
 *   matimo mcp --secrets env,vault                # secret resolver chain
 *   matimo mcp --token my-secret                  # HTTP bearer token
 *   matimo mcp --tool-paths /path/to/tools       # custom tool paths
 */

interface McpArgs {
  transport: 'stdio' | 'http';
  port: number;
  tools?: string[];
  excludeTools?: string[];
  secrets?: string[];
  envFile?: string;
  vaultPath?: string;
  awsSecretId?: string;
  token?: string;
  toolPaths?: string[];
  https?: boolean;
  selfSigned?: boolean;
  certPath?: string;
  keyPath?: string;
}

function parseArgs(params: string[]): McpArgs {
  const args: McpArgs = {
    transport: 'stdio',
    port: 3000,
  };

  /** Assert that a value-consuming flag was given an argument, not another flag or end-of-input. */
  const requireValue = (flag: string, value: string | undefined): string => {
    if (!value || value.startsWith('-')) {
      console.error(`❌ ${flag} requires a value`);
      process.exit(1);
    }
    return value;
  };

  for (let i = 0; i < params.length; i++) {
    const flag = params[i];
    const next = params[i + 1];

    switch (flag) {
      case '--transport':
      case '-t':
        if (next === 'stdio' || next === 'http') {
          args.transport = next;
          i++;
        } else {
          console.error('❌ --transport must be "stdio" or "http"');
          process.exit(1);
        }
        break;

      case '--port':
      case '-p':
        args.port = parseInt(next, 10);
        if (isNaN(args.port)) {
          console.error('❌ --port must be a number');
          process.exit(1);
        }
        i++;
        break;

      case '--tools':
        args.tools = requireValue('--tools', next)
          .split(',')
          .map((s) => s.trim());
        i++;
        break;

      case '--exclude':
        args.excludeTools = requireValue('--exclude', next)
          .split(',')
          .map((s) => s.trim());
        i++;
        break;

      case '--secrets':
        args.secrets = requireValue('--secrets', next)
          .split(',')
          .map((s) => s.trim());
        i++;
        break;

      case '--env-file':
        args.envFile = requireValue('--env-file', next);
        i++;
        break;

      case '--vault-path':
        args.vaultPath = requireValue('--vault-path', next);
        i++;
        break;

      case '--aws-secret-id':
        args.awsSecretId = requireValue('--aws-secret-id', next);
        i++;
        break;

      case '--token':
        args.token = requireValue('--token', next);
        i++;
        break;

      case '--tool-paths':
        args.toolPaths = requireValue('--tool-paths', next)
          .split(',')
          .map((s) => s.trim());
        i++;
        break;

      case '--https':
        args.https = true;
        break;

      case '--self-signed':
        args.https = true;
        args.selfSigned = true;
        break;

      case '--cert':
        args.certPath = requireValue('--cert', next);
        args.https = true;
        i++;
        break;

      case '--key':
        args.keyPath = requireValue('--key', next);
        args.https = true;
        i++;
        break;

      case 'setup':
        // Handled separately in cli.ts
        break;

      default:
        if (flag.startsWith('-')) {
          console.error(`❌ Unknown flag: ${flag}`);
          process.exit(1);
        }
    }
  }

  return args;
}

function buildResolverConfig(args: McpArgs) {
  const secretTypes = args.secrets ?? ['env', 'dotenv'];

  const resolvers = secretTypes.map((type) => {
    switch (type) {
      case 'env':
        return { type: 'env' as const };
      case 'dotenv':
        return { type: 'dotenv' as const, path: args.envFile };
      case 'vault':
        return { type: 'vault' as const, secretPath: args.vaultPath };
      case 'aws':
        return { type: 'aws' as const, secretId: args.awsSecretId };
      default:
        console.error(`❌ Unknown secret resolver: ${type}. Use: env, dotenv, vault, aws`);
        process.exit(1);
    }
  });

  return { resolvers };
}

export async function mcpCommand(params: string[]): Promise<void> {
  // Check for 'setup' subcommand
  if (params[0] === 'setup') {
    const { mcpSetupCommand } = await import('./mcp-setup.js');
    await mcpSetupCommand();
    return;
  }

  const args = parseArgs(params);

  // Lazy-import core MCP server
  // @ts-ignore - dynamic import of package resolved at runtime
  const { MCPServer } = await import('@matimo/core');

  const server = new MCPServer({
    transport: args.transport,
    port: args.port,
    tools: args.tools,
    excludeTools: args.excludeTools,
    secretResolver: buildResolverConfig(args),
    mcpToken: args.token,
    toolPaths: args.toolPaths,
    autoDiscover: true,
    https: args.https,
    selfSigned: args.selfSigned,
    certPath: args.certPath,
    keyPath: args.keyPath,
  });

  // Graceful shutdown
  const shutdown = async () => {
    // Only log to stderr in stdio mode (stdout is JSON-RPC)
    if (args.transport === 'stdio') {
      process.stderr.write('\nShutting down Matimo MCP server...\n');
    } else {
      console.info('\nShutting down Matimo MCP server...');
    }
    await server.stop();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  try {
    await server.start();

    if (args.transport === 'http') {
      const protocol = args.https ? 'https' : 'http';
      const url = `${protocol}://localhost:${args.port}/mcp`;
      const token = server.getActiveToken();

      console.info('');
      console.info(`🚀 Matimo MCP server running at ${url}`);

      if (args.https) {
        if (args.selfSigned || (!args.certPath && !args.keyPath)) {
          console.info('🔒 HTTPS enabled (self-signed certificate)');
          console.info(
            '   ⚠️  Clients may need to disable cert verification for self-signed certs'
          );
        } else {
          console.info('🔒 HTTPS enabled');
        }
      }

      if (token) {
        const isAutoGenerated = !args.token && !process.env.MATIMO_MCP_TOKEN;
        console.info('');
        console.info(`🔐 Bearer Token${isAutoGenerated ? ' (auto-generated)' : ''}:`);
        console.info(`   ${token}`);
        console.info('');
        console.info('   Connect your MCP client:');
        console.info(`   url: ${url}`);
        console.info(`   Authorization: Bearer ${token}`);

        if (isAutoGenerated) {
          console.info('');
          console.info('   To use a fixed token, set MATIMO_MCP_TOKEN or use --token <value>');
        }
      }

      console.info('');
      console.info('   Press Ctrl+C to stop');
      console.info('');
    }
  } catch (error) {
    console.error(
      '❌ Failed to start MCP server:',
      error instanceof Error ? error.message : String(error)
    );
    process.exit(1);
  }
}
