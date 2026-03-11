#!/usr/bin/env node
/**
 * ============================================================================
 * MATIMO MCP - LANGCHAIN AI AGENT (UNIFIED - STDIO / HTTP / MULTI)
 * ============================================================================
 *
 * PATTERN: True AI Agent with OpenAI + LangChain via MCP
 * ─────────────────────────────────────────────────────────────────────────
 * This is a REAL AI agent that:
 * 1. Supports all MCP transports: stdio, HTTP, and multi-server
 * 2. Uses OpenAI LLM (GPT-4o-mini) to decide which tools to use
 * 3. Connects via @langchain/mcp-adapters for tool discovery
 * 4. Executes tools autonomously through MCP protocol
 * 5. Processes results and responds naturally
 *
 * Use this pattern when:
 * ✅ Building agents that need flexible transport options
 * ✅ Want to switch between stdio and HTTP without code changes
 * ✅ Multi-server setups (merge tools from multiple MCP servers)
 * ✅ CLI-driven agent with configurable options
 * ✅ Reference implementation for production agents
 *
 * SETUP:
 * ─────────────────────────────────────────────────────────────────────────
 * 1. Create .env file:
 *    OPENAI_API_KEY=sk-xxxxxxxxxxxxx
 *    SLACK_BOT_TOKEN=xoxb-xxxxxxxxxxxxx
 *    GMAIL_ACCESS_TOKEN=ya29.xxxxxxxxxxxxx
 *
 * 2. Install dependencies:
 *    npm install matimo @matimo/slack @matimo/gmail
 *    npm install @langchain/mcp-adapters @langchain/openai @langchain/langgraph @langchain/core
 *
 * USAGE:
 * ─────────────────────────────────────────────────────────────────────────
 *   # Stdio — no server to start
 *   pnpm agent -- --stdio
 *
 *   # HTTP — connect to running server
 *   npx matimo mcp --transport http --port 3555
 *   pnpm agent -- --http --token <token>
 *
 *   # Multi-server — merge stdio + HTTP tools
 *   pnpm agent -- --multi --token <token>
 *
 * WHAT IT DOES:
 * ─────────────────────────────────────────────────────────────────────────
 * This unified agent demonstrates all three MCP transport modes:
 * - stdio: Spawns matimo mcp as subprocess (simplest, no setup)
 * - HTTP: Connects to running MCP server (remote/shared scenarios)
 * - multi: Connects to both, merges all tools (advanced)
 *
 * Runs the same set of example tasks across whichever transport is chosen.
 *
 * ============================================================================
 */

import 'dotenv/config';
import { MultiServerMCPClient } from '@langchain/mcp-adapters';
import { ChatOpenAI } from '@langchain/openai';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { HumanMessage } from '@langchain/core/messages';

// ─────────────────────────────────────────────────────────────
// Environment Check
// ─────────────────────────────────────────────────────────────
if (!process.env.OPENAI_API_KEY) {
  console.error('ERROR: OPENAI_API_KEY environment variable is required.');
  console.error('Create a .env file or export it:');
  console.error('  export OPENAI_API_KEY=sk-xxxxxxxxxxxxx');
  process.exit(1);
}

// ─────────────────────────────────────────────────────────────
// Configuration Types
// ─────────────────────────────────────────────────────────────

interface Config {
  transport: 'stdio' | 'http' | 'multi';
  httpUrl: string;
  bearerToken?: string;
  model: string;
}

// ─────────────────────────────────────────────────────────────
// CLI Argument Parsing
// ─────────────────────────────────────────────────────────────

function parseArgs(): Config {
  const args = process.argv.slice(2);

  let transport: Config['transport'] =
    (process.env.MCP_TRANSPORT as Config['transport']) || 'stdio';
  let httpUrl = process.env.MCP_SERVER_URL || 'http://localhost:3555/mcp';
  let bearerToken = process.env.MCP_BEARER_TOKEN || process.env.MATIMO_MCP_TOKEN;
  let model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--stdio':
        transport = 'stdio';
        break;
      case '--http':
        transport = 'http';
        break;
      case '--multi':
        transport = 'multi';
        break;
      case '--url':
        httpUrl = args[++i];
        break;
      case '--token':
        bearerToken = args[++i];
        break;
      case '--model':
        model = args[++i];
        break;
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
    }
  }

  return { transport, httpUrl, bearerToken, model };
}

function printHelp(): void {
  console.info(`
Matimo MCP + LangChain Agent (Unified)

USAGE:
  pnpm agent -- [OPTIONS]

TRANSPORT OPTIONS:
  --stdio          Spawn matimo mcp as local subprocess (default)
  --http           Connect to running matimo MCP HTTP server
  --multi          Both stdio + HTTP simultaneously (tools merged)

HTTP OPTIONS:
  --url URL        MCP server URL (default: http://localhost:3555/mcp)
  --token TOKEN    Bearer token for authentication

GENERAL OPTIONS:
  --model MODEL    OpenAI model (default: gpt-4o-mini)
  -h, --help       Show this help message

EXAMPLES:
  pnpm agent -- --stdio
  pnpm agent -- --http --token my-secret
  pnpm agent -- --multi --token my-secret
`);
}

// ─────────────────────────────────────────────────────────────
// MCP Client Factory
// ─────────────────────────────────────────────────────────────

/** Build stdio config — spawns `matimo mcp` as a subprocess */
function buildStdioConfig() {
  return {
    transport: 'stdio' as const,
    command: 'npx',
    args: ['matimo', 'mcp'],
    env: {
      ...(process.env as Record<string, string>),
    },
    restart: {
      enabled: true,
      maxAttempts: 3,
      delayMs: 1000,
    },
  };
}

/** Build HTTP config — connects to a running Matimo MCP server */
function buildHttpConfig(url: string, token?: string) {
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Only disable TLS certificate validation when explicitly opted in via MCP_INSECURE=true.
  // Never set this automatically — it disables certificate checks for the entire Node process.
  if (process.env.MCP_INSECURE === 'true' && url.startsWith('https')) {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    console.warn(
      '⚠️  MCP_INSECURE=true: TLS certificate validation disabled.\n' +
        '   Only use this in local development with self-signed certs.\n'
    );
  }

  return {
    transport: 'http' as const,
    url,
    headers,
    reconnect: {
      enabled: true,
      maxAttempts: 5,
      delayMs: 2000,
    },
  };
}

/** Create a MultiServerMCPClient based on the chosen transport */
function createMcpClient(config: Config): MultiServerMCPClient {
  const mcpServers: Record<
    string,
    ReturnType<typeof buildStdioConfig> | ReturnType<typeof buildHttpConfig>
  > = {};

  switch (config.transport) {
    case 'stdio':
      mcpServers['matimo'] = buildStdioConfig();
      break;

    case 'http':
      mcpServers['matimo'] = buildHttpConfig(config.httpUrl, config.bearerToken);
      break;

    case 'multi':
      // Both transports — tools from all servers are merged
      mcpServers['matimo-stdio'] = buildStdioConfig();
      mcpServers['matimo-http'] = buildHttpConfig(config.httpUrl, config.bearerToken);
      break;
  }

  return new MultiServerMCPClient({
    throwOnLoadError: true,
    onConnectionError: config.transport === 'multi' ? 'ignore' : 'throw',
    prefixToolNameWithServerName: config.transport === 'multi',
    mcpServers,
  });
}

// ─────────────────────────────────────────────────────────────
// Example Tasks — same tasks run regardless of transport
// ─────────────────────────────────────────────────────────────

const userRequests = [
  // Task 1: Calculator — tests core tools
  'Use the calculator tool to compute 42 * 58. Return just the numeric result.',

  // Task 2: Slack — tests provider tool integration
  'List all Slack channels I have access to. Return just the channel names.',

  // Task 3: Gmail — tests another provider
  'List my recent Gmail messages. Return the subject lines.',
];

// ─────────────────────────────────────────────────────────────
// Main Agent Function
// ─────────────────────────────────────────────────────────────

async function runUnifiedAgent(): Promise<void> {
  const config = parseArgs();

  const transportLabels = {
    stdio: 'Stdio (local subprocess)',
    http: 'Streamable HTTP (remote server)',
    multi: 'Multi-server (stdio + HTTP merged)',
  };

  console.info('\n' + '='.repeat(60));
  console.info('  MATIMO MCP — UNIFIED LANGCHAIN AGENT');
  console.info(`  Transport: ${transportLabels[config.transport]}`);
  if (config.transport === 'http' || config.transport === 'multi') {
    console.info(`  Server:    ${config.httpUrl}`);
    console.info(`  Auth:      ${config.bearerToken ? 'Bearer token' : 'None'}`);
  }
  console.info('='.repeat(60) + '\n');

  // ── Step 1: Connect to MCP ──────────────────────────────────────────
  console.info(`Connecting via ${config.transport}...\n`);
  const client = createMcpClient(config);

  try {
    // ── Step 2: Load tools ────────────────────────────────────────────
    const tools = await client.getTools();
    console.info(`Loaded ${tools.length} tools from MCP:\n`);
    tools.forEach((t) => console.info(`  - ${t.name}`));
    console.info();

    if (tools.length === 0) {
      console.error('No tools loaded — check your installation.');
      process.exit(1);
    }

    // ── Step 3: Create LangChain ReAct agent ──────────────────────────
    const llm = new ChatOpenAI({
      model: config.model,
      temperature: 0,
    });

    const agent = createReactAgent({ llm, tools });

    // ── Step 4: Run example tasks ─────────────────────────────────────
    let successCount = 0;

    for (let i = 0; i < userRequests.length; i++) {
      const task = userRequests[i];

      console.info('-'.repeat(60));
      console.info(`Task ${i + 1}/${userRequests.length}: ${task}`);
      console.info('-'.repeat(60));

      try {
        const result = await agent.invoke({
          messages: [new HumanMessage(task)],
        });

        const lastMessage = result.messages[result.messages.length - 1];
        console.info('\nAgent Response:');
        console.info(lastMessage.content);
        console.info();
        successCount++;
      } catch (taskError) {
        console.error(
          `\nTask ${i + 1} failed:`,
          taskError instanceof Error ? taskError.message : taskError
        );
        console.info();
      }
    }

    // ── Summary ───────────────────────────────────────────────────────
    console.info('='.repeat(60));
    console.info('  RESULTS SUMMARY');
    console.info('='.repeat(60));
    console.info(`  Transport:  ${transportLabels[config.transport]}`);
    console.info(`  Tools:      ${tools.length} loaded`);
    console.info(`  Tasks:      ${successCount}/${userRequests.length} succeeded`);
    console.info('='.repeat(60));
    console.info();
    console.info('Key features demonstrated:');
    console.info('  - Flexible transport selection (stdio / HTTP / multi)');
    console.info('  - CLI-driven configuration (--stdio, --http, --multi)');
    console.info('  - Auto-discovery of all installed @matimo/* tools');
    console.info('  - OpenAI function calling via LangChain ReAct agent');
    console.info('  - Bearer token authentication for HTTP transport');
    console.info();
  } finally {
    await client.close();
  }
}

// ─────────────────────────────────────────────────────────────
// Run
// ─────────────────────────────────────────────────────────────

runUnifiedAgent().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
