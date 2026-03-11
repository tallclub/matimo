/**
 * Matimo MCP Server
 *
 * Exposes all Matimo tools via the Model Context Protocol.
 * Supports stdio (local/Claude Desktop) and HTTP (remote/Docker) transports.
 *
 * Architecture:
 *   Client → MCP Protocol → MCPServer → MatimoInstance.execute() → Tool APIs
 *   Secrets resolved via SecretResolverChain (env, dotenv, Vault, AWS SM)
 *   HTTP mode protected by Bearer token (MATIMO_MCP_TOKEN)
 */

import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import type * as Http from 'http';
import { MatimoInstance } from '../matimo-instance';
import { MatimoError, ErrorCode } from '../errors/matimo-error';
import { getGlobalMatimoLogger, setGlobalMatimoLogger } from '../logging';
import { createLogger } from '../logging/winston-logger';
import { toolToMcpRegistration, extractAuthPlaceholders } from './tool-converter';
import { createResolverChain, SecretResolverChain } from './secrets/resolver-chain';
import type { SecretResolverChainConfig } from './secrets/types';
import type { ToolDefinition } from '../core/schema';

// ─── Types ──────────────────────────────────────────────────────────────

export interface MCPServerOptions {
  /** Transport mode. Default: 'stdio' */
  transport?: 'stdio' | 'http';
  /** HTTP port. Default: 3000. Only used in HTTP mode. */
  port?: number;
  /** Allowlist of tool names. If set, only these tools are exposed. */
  tools?: string[];
  /** Denylist of tool names. Excluded from exposure. */
  excludeTools?: string[];
  /** Secret resolver chain config. Default: env-only. */
  secretResolver?: SecretResolverChainConfig;
  /** Bearer token for HTTP mode. Also reads MATIMO_MCP_TOKEN env var. If not set in HTTP mode, auto-generated. */
  mcpToken?: string;
  /** Tool paths to load. Passed to MatimoInstance.init(). */
  toolPaths?: string[];
  /** Auto-discover @matimo/* packages. Default: true */
  autoDiscover?: boolean;
  /** Enable HTTPS. Requires cert+key or use selfSigned. Default: false */
  https?: boolean;
  /** Path to TLS certificate file (PEM). Required if https=true and selfSigned=false. */
  certPath?: string;
  /** Path to TLS private key file (PEM). Required if https=true and selfSigned=false. */
  keyPath?: string;
  /** Auto-generate self-signed certificate. Default: false. Certs stored in .matimo/certs/ */
  selfSigned?: boolean;
}

// ─── Helpers ────────────────────────────────────────────────────────────

function getPackageVersion(): string {
  try {
    // Method 1: Use createRequire to find @matimo/core's package.json (works in all environments)
    try {
      const req =
        typeof require !== 'undefined'
          ? require
          : // @ts-ignore - import.meta only available in ESM context
            createRequire(eval('import.meta.url') as string);
      const pkgPath = req.resolve('@matimo/core/package.json');
      /* istanbul ignore next -- only reachable when @matimo/core/package.json is a proper export */
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
      /* istanbul ignore next */
      return pkg.version;
    } catch {
      // Fall through to directory walking
    }

    // Method 2: Walk up from current file location
    let currentDir: string;
    if (typeof __dirname !== 'undefined') {
      currentDir = __dirname;
    } else {
      // istanbul ignore next -- ESM path, unreachable in CJS/Jest
      try {
        const metaUrl: string = eval('import.meta.url') as string;
        currentDir = dirname(fileURLToPath(metaUrl));
      } catch {
        currentDir = process.cwd();
      }
    }

    let dir = currentDir;
    for (let i = 0; i < 6; i++) {
      try {
        const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf-8'));
        if (pkg.name === '@matimo/core') return pkg.version;
      } catch {
        // Continue walking up
      }
      dir = dirname(dir);
    }

    // Method 3: Fallback to well-known paths from cwd
    // istanbul ignore next -- only reachable if both require.resolve and directory walking fail
    const fallbackPaths = [
      join(process.cwd(), 'packages', 'core', 'package.json'),
      join(process.cwd(), 'node_modules', '@matimo', 'core', 'package.json'),
    ];
    for (const p of fallbackPaths) {
      try {
        const pkg = JSON.parse(readFileSync(p, 'utf-8'));
        if (pkg.name === '@matimo/core') return pkg.version;
      } catch {
        // Continue
      }
    }
  } catch {
    // Fallback
  }
  return '0.0.0';
}

// ─── MCPServer ──────────────────────────────────────────────────────────

export class MCPServer {
  private readonly options: Required<
    Pick<MCPServerOptions, 'transport' | 'port' | 'autoDiscover' | 'https' | 'selfSigned'>
  > &
    MCPServerOptions;
  private matimo: MatimoInstance | null = null;
  private resolverChain: SecretResolverChain | null = null;
  private mcpServer: unknown = null;
  private httpServer: unknown = null;
  /** Filtered tools available for MCP registration */
  private filteredTools: ToolDefinition[] = [];
  /** The active bearer token (explicit, env, or auto-generated) */
  private activeToken: string | null = null;

  constructor(options: MCPServerOptions = {}) {
    this.options = {
      transport: options.transport ?? 'stdio',
      port: options.port ?? 3000,
      autoDiscover: options.autoDiscover ?? true,
      https: options.https ?? false,
      selfSigned: options.selfSigned ?? false,
      ...options,
    };
  }

  /** Get the active bearer token (available after start()) */
  getActiveToken(): string | null {
    return this.activeToken;
  }

  /**
   * Start the MCP server.
   *
   * 1. Initialize secret resolver chain
   * 2. Seed process.env with resolved secrets (for MatimoInstance compatibility)
   * 3. Initialize MatimoInstance with tools
   * 4. Register all tools on the MCP server
   * 5. Connect transport (stdio or HTTP)
   */
  async start(): Promise<void> {
    // Step 0: Suppress logging in stdio mode (JSON-RPC protocol requires clean stdout/stderr)
    if (this.options.transport === 'stdio') {
      setGlobalMatimoLogger(createLogger({ logLevel: 'silent', logFormat: 'simple' }));
    }

    const logger = getGlobalMatimoLogger();

    // Step 1: Build secret resolver chain
    this.resolverChain = createResolverChain(this.options.secretResolver);
    logger.info('Secret resolver chain initialized', {
      resolvers: this.resolverChain.getResolvers().map((r) => r.name),
    });

    // Step 1b: Eagerly load dotenv into process.env so that server config
    // values like MATIMO_MCP_TOKEN are available early (before tool registration).
    // seedEnvironmentSecrets() only resolves tool-specific auth placeholders,
    // so without this, .env-only config like MATIMO_MCP_TOKEN would be missed.
    await this.resolverChain.seedProcessEnv();

    // Step 2: Initialize Matimo
    // Pass logLevel: 'silent' in stdio mode to prevent MatimoInstance from
    // creating a non-silent logger that writes to stdout (corrupts JSON-RPC)
    this.matimo = await MatimoInstance.init({
      toolPaths: this.options.toolPaths,
      autoDiscover: this.options.autoDiscover,
      ...(this.options.transport === 'stdio' ? { logLevel: 'silent' as const } : {}),
    });

    // Re-set silent logger after init (MatimoInstance.init overwrites the global logger)
    if (this.options.transport === 'stdio') {
      setGlobalMatimoLogger(createLogger({ logLevel: 'silent', logFormat: 'simple' }));
    }

    // Step 3: Filter tools
    let tools = this.matimo.listTools();
    logger.debug(`MatimoInstance loaded ${tools.length} tools`);

    if (this.options.tools && this.options.tools.length > 0) {
      const allowSet = new Set(this.options.tools);
      tools = tools.filter((t) => allowSet.has(t.name));
    }

    if (this.options.excludeTools && this.options.excludeTools.length > 0) {
      const denySet = new Set(this.options.excludeTools);
      tools = tools.filter((t) => !denySet.has(t.name));
    }

    if (tools.length === 0) {
      logger.warn('No tools available after filtering. MCP server will have zero tools.');
    }

    // Step 4: Resolve auth placeholders for all tools and seed process.env
    await this.seedEnvironmentSecrets(tools);

    // Step 5: Store filtered tools for MCP server creation
    this.filteredTools = tools;

    // Step 6: Connect transport
    // Each transport method creates its own McpServer instance(s).
    // HTTP mode creates a new McpServer per session to support multiple concurrent clients.
    if (this.options.transport === 'stdio') {
      await this.connectStdio();
    } else {
      await this.connectHttp();
    }
  }

  /**
   * Resolve all auth-related secrets for tools and seed them into process.env.
   * This ensures MatimoInstance.injectAuthParameters() can find them.
   */
  private async seedEnvironmentSecrets(tools: ToolDefinition[]): Promise<void> {
    if (!this.resolverChain) return;

    const logger = getGlobalMatimoLogger();

    // Collect all unique auth placeholders across all tools
    const allPlaceholders = new Set<string>();
    for (const tool of tools) {
      const placeholders = extractAuthPlaceholders(tool);
      for (const p of placeholders) {
        allPlaceholders.add(p);
      }
    }

    if (allPlaceholders.size === 0) return;

    logger.debug('Resolving auth secrets for tools', {
      placeholderCount: allPlaceholders.size,
    });

    // Resolve all at once (efficient for batch-capable resolvers)
    const resolved = await this.resolverChain.resolveAll([...allPlaceholders]);

    // Seed into process.env (only if not already set)
    let seeded = 0;
    for (const [key, value] of Object.entries(resolved)) {
      if (!process.env[key]) {
        process.env[key] = value;
        seeded++;
      }
      // Also set MATIMO_ prefixed if not present
      if (!process.env[`MATIMO_${key}`]) {
        process.env[`MATIMO_${key}`] = value;
        seeded++;
      }
    }

    logger.debug('Auth secrets seeded into environment', {
      resolved: Object.keys(resolved).length,
      seeded,
    });
  }

  /**
   * Create a new McpServer instance with all filtered tools registered.
   * Each call returns a fresh server — used per-session in HTTP mode.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async createMcpServerWithTools(): Promise<any> {
    // @ts-ignore - wildcard export subpath resolves at runtime via bundler moduleResolution
    const { McpServer } = await import('@modelcontextprotocol/sdk/server/mcp');
    const logger = getGlobalMatimoLogger();
    const matimo = this.matimo!;
    const version = getPackageVersion();

    const server = new McpServer({ name: 'matimo', version });

    let registeredCount = 0;
    for (const tool of this.filteredTools) {
      try {
        const registration = toolToMcpRegistration(tool);

        server.registerTool(
          tool.name,
          {
            title: registration.title,
            description: registration.description,
            inputSchema: registration.inputSchema,
          },
          async (args: Record<string, unknown>) => {
            try {
              logger.debug(`MCP tool call: ${tool.name}`, {
                toolName: tool.name,
                argCount: Object.keys(args).length,
              });

              if (tool.requires_approval) {
                const approved = args._matimo_approved;
                if (!approved) {
                  throw new MatimoError(
                    `Tool '${tool.name}' requires approval. This is a destructive operation. Re-invoke with parameter _matimo_approved: true to confirm execution.`,
                    ErrorCode.EXECUTION_FAILED
                  );
                }
              }

              const result = await matimo.execute(tool.name, args);

              return {
                content: [
                  {
                    type: 'text' as const,
                    text: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
                  },
                ],
              };
            } catch (error) {
              logger.error(`MCP tool call failed: ${tool.name}`, {
                toolName: tool.name,
                error: error instanceof Error ? error.message : String(error),
              });

              return {
                content: [
                  {
                    type: 'text' as const,
                    text: `Error: ${error instanceof Error ? error.message : String(error)}`,
                  },
                ],
                isError: true,
              };
            }
          }
        );
        registeredCount++;
      } catch (regError) {
        logger.error(`Failed to register tool '${tool.name}'`, {
          toolName: tool.name,
          error: regError instanceof Error ? regError.message : String(regError),
        });
      }
    }

    logger.debug(`Registered ${registeredCount}/${this.filteredTools.length} tools on MCP server`);
    return server;
  }

  /**
   * Connect via stdio transport (for Claude Desktop, Cursor, etc.)
   */
  private async connectStdio(): Promise<void> {
    // @ts-ignore - wildcard export subpath
    const { StdioServerTransport } = await import('@modelcontextprotocol/sdk/server/stdio');

    const server = await this.createMcpServerWithTools();
    this.mcpServer = server;

    const transport = new StdioServerTransport();
    await server.connect(transport);

    const logger = getGlobalMatimoLogger();
    logger.info('Matimo MCP server started (stdio)', {
      transport: 'stdio',
      tools: this.filteredTools.length,
    });
  }

  /**
   * Connect via HTTP/HTTPS transport with Bearer token auth.
   * Creates a new McpServer + transport per session to support multiple concurrent clients.
   * Auto-generates a bearer token if none is provided.
   */
  private async connectHttp(): Promise<void> {
    const http = await import('http');
    const { StreamableHTTPServerTransport } = (await import(
      // @ts-expect-error - optional peer dependency subpath not typed
      '@modelcontextprotocol/sdk/server/streamableHttp'
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    )) as any;
    const { randomUUID } = await import('crypto');
    const { isInitializeRequest } = (await import(
      // @ts-expect-error - optional peer dependency subpath not typed
      '@modelcontextprotocol/sdk/types'
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    )) as any;

    const logger = getGlobalMatimoLogger();

    // Resolve bearer token: explicit > env > auto-generate
    let mcpToken = this.options.mcpToken ?? process.env.MATIMO_MCP_TOKEN;
    let tokenAutoGenerated = false;
    if (!mcpToken) {
      mcpToken = randomUUID();
      tokenAutoGenerated = true;
      logger.info('Auto-generated bearer token for HTTP mode');
    }
    this.activeToken = mcpToken;

    // Determine protocol (HTTP vs HTTPS)
    const useHttps = this.options.https || this.options.selfSigned || !!this.options.certPath;
    const protocol = useHttps ? 'https' : 'http';

    // Track active sessions: sessionId → { transport, server }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sessions = new Map<string, { transport: any; server: any }>();

    const requestHandler = async (req: Http.IncomingMessage, res: Http.ServerResponse) => {
      // CORS headers
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Mcp-Session-Id');
      res.setHeader('Access-Control-Expose-Headers', 'Mcp-Session-Id');

      // Handle CORS preflight
      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }

      // Health check (no auth required)
      if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', tools: this.filteredTools.length }));
        return;
      }

      // Bearer token auth (always enabled in HTTP mode)
      const authHeader = req.headers.authorization;
      if (!authHeader || authHeader !== `Bearer ${mcpToken}`) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Unauthorized' }));
        return;
      }

      // MCP endpoint
      if (req.url === '/mcp' || req.url === '/') {
        // Parse request body for POST requests
        let body: unknown;
        if (req.method === 'POST') {
          try {
            body = await new Promise<unknown>((resolve, reject) => {
              let data = '';
              req.on('data', (chunk: string) => {
                data += chunk;
              });
              req.on('end', () => {
                try {
                  resolve(JSON.parse(data));
                } catch {
                  reject(new Error('Invalid JSON'));
                }
              });
              req.on('error', reject);
            });
          } catch (parseErr) {
            const message = parseErr instanceof Error ? parseErr.message : 'Invalid request body';
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(
              JSON.stringify({
                jsonrpc: '2.0',
                error: { code: -32700, message },
                id: null,
              })
            );
            return;
          }
        }

        const sessionId = req.headers['mcp-session-id'] as string | undefined;

        // Route to existing session
        if (sessionId && sessions.has(sessionId)) {
          const session = sessions.get(sessionId)!;
          await session.transport.handleRequest(req, res, body);
          return;
        }

        // DELETE for unknown session
        if (req.method === 'DELETE') {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Session not found' }));
          return;
        }

        // GET for SSE stream without session
        if (req.method === 'GET') {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid or missing session ID' }));
          return;
        }

        // Only create new session for initialization requests (official MCP pattern)
        if (!isInitializeRequest(body)) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              jsonrpc: '2.0',
              error: { code: -32000, message: 'Bad Request: No valid session ID provided' },
              id: null,
            })
          );
          return;
        }

        // New session: create a fresh McpServer + transport.
        // Declare mcpServer before constructing the transport so the onsessioninitialized
        // closure captures the variable reference rather than an uninitialized binding (TDZ).
        // eslint-disable-next-line prefer-const
        let mcpServer: Awaited<ReturnType<typeof this.createMcpServerWithTools>>;

        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (sid: string) => {
            sessions.set(sid, { transport, server: mcpServer });
            logger.debug(`New MCP session: ${sid}`);
          },
        });

        // Clean up session when transport closes
        transport.onclose = () => {
          const sid = transport.sessionId;
          if (sid && sessions.has(sid)) {
            sessions.delete(sid);
            logger.debug(`MCP session closed: ${sid}`);
          }
        };

        mcpServer = await this.createMcpServerWithTools();
        await mcpServer.connect(transport);

        // Handle the initialization request
        await transport.handleRequest(req, res, body);
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found. Use /mcp for MCP protocol.' }));
      }
    };

    // Create HTTP or HTTPS server
    let httpServer: Http.Server;
    if (useHttps) {
      const tlsOptions = await this.getTlsOptions();
      const https = await import('https');
      httpServer = https.createServer(tlsOptions, requestHandler);
    } else {
      httpServer = http.createServer(requestHandler);
    }

    this.httpServer = httpServer;

    const url = `${protocol}://localhost:${this.options.port}/mcp`;

    await new Promise<void>((resolve) => {
      httpServer.listen(this.options.port, () => {
        logger.info(`Matimo MCP server started (${protocol.toUpperCase()})`, {
          transport: protocol,
          port: this.options.port,
          tools: this.filteredTools.length,
          authenticated: true,
          tokenAutoGenerated,
          url,
        });
        resolve();
      });
    });
  }

  /**
   * Get TLS options for HTTPS mode.
   * Supports user-provided certs or auto-generated self-signed certs.
   */
  private async getTlsOptions(): Promise<{ cert: string; key: string }> {
    // User-provided certificates
    if (this.options.certPath && this.options.keyPath) {
      if (!existsSync(this.options.certPath)) {
        throw new MatimoError(
          `TLS certificate not found: ${this.options.certPath}`,
          ErrorCode.EXECUTION_FAILED
        );
      }
      if (!existsSync(this.options.keyPath)) {
        throw new MatimoError(
          `TLS private key not found: ${this.options.keyPath}`,
          ErrorCode.EXECUTION_FAILED
        );
      }
      return {
        cert: readFileSync(this.options.certPath, 'utf-8'),
        key: readFileSync(this.options.keyPath, 'utf-8'),
      };
    }

    // Self-signed certificate generation
    return this.generateSelfSignedCert();
  }

  /**
   * Generate a self-signed TLS certificate using Node.js crypto.
   * Certs are cached in .matimo/certs/ for reuse across restarts.
   */
  private async generateSelfSignedCert(): Promise<{ cert: string; key: string }> {
    const certsDir = join(process.cwd(), '.matimo', 'certs');
    const certFile = join(certsDir, 'server.crt');
    const keyFile = join(certsDir, 'server.key');

    // Return cached certs if they exist
    if (existsSync(certFile) && existsSync(keyFile)) {
      const logger = getGlobalMatimoLogger();
      logger.info('Using cached self-signed certificate from .matimo/certs/');
      return {
        cert: readFileSync(certFile, 'utf-8'),
        key: readFileSync(keyFile, 'utf-8'),
      };
    }

    // Generate new self-signed cert using Node.js crypto
    const { generateKeyPairSync } = await import('crypto');

    const logger = getGlobalMatimoLogger();
    logger.info('Generating self-signed TLS certificate...');

    // Generate RSA key pair
    const { privateKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
    });

    // Build self-signed X.509 certificate using forge-free ASN.1
    // For simplicity, use openssl via child_process if available, otherwise fallback
    const keyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }) as string;
    const certPem = await this.createSelfSignedCertViaCli(keyPem);

    // Save to .matimo/certs/
    mkdirSync(certsDir, { recursive: true });
    writeFileSync(certFile, certPem, { mode: 0o644 });
    writeFileSync(keyFile, keyPem, { mode: 0o600 });

    logger.info('Self-signed certificate saved to .matimo/certs/');

    return { cert: certPem, key: keyPem };
  }

  /**
   * Create a self-signed certificate using openssl CLI.
   * Throws if openssl is unavailable or fails — provide --cert and --key paths as an alternative.
   */
  // istanbul ignore next -- requires openssl CLI; covered by integration tests
  private async createSelfSignedCertViaCli(keyPem: string): Promise<string> {
    const { execFileSync } = await import('child_process');
    const { tmpdir } = await import('os');
    const { randomBytes } = await import('crypto');

    const tmpKey = join(tmpdir(), `matimo-key-${randomBytes(4).toString('hex')}.pem`);
    const tmpCert = join(tmpdir(), `matimo-cert-${randomBytes(4).toString('hex')}.pem`);

    try {
      writeFileSync(tmpKey, keyPem, { mode: 0o600 });

      // Use execFileSync with an args array to avoid shell-specific redirection (e.g. 2>/dev/null)
      // which is POSIX-only. stderr is suppressed via stdio: 'pipe'.
      execFileSync(
        'openssl',
        [
          'req',
          '-new',
          '-x509',
          '-key',
          tmpKey,
          '-out',
          tmpCert,
          '-days',
          '365',
          '-subj',
          '/CN=localhost/O=Matimo MCP Server',
          '-addext',
          'subjectAltName=DNS:localhost,IP:127.0.0.1',
        ],
        { stdio: 'pipe' }
      );

      const cert = readFileSync(tmpCert, 'utf-8');
      return cert;
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      throw new MatimoError(
        `Failed to generate self-signed certificate: ${reason}. Install openssl or provide --cert and --key paths.`,
        ErrorCode.EXECUTION_FAILED
      );
    } finally {
      // Clean up temp files
      try {
        const { unlinkSync } = await import('fs');
        unlinkSync(tmpKey);
        unlinkSync(tmpCert);
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  /**
   * Gracefully stop the MCP server.
   */
  async stop(): Promise<void> {
    const logger = getGlobalMatimoLogger();

    // Close MCP server
    if (this.mcpServer) {
      const server = this.mcpServer as { close?: () => Promise<void> };
      if (server.close) {
        await server.close();
      }
      this.mcpServer = null;
    }

    // Close HTTP server.
    // Proactively drain keep-alive and SSE connections so close() can complete.
    // closeIdleConnections() (Node ≥ 18.2) ends idle keep-alive sockets; if active
    // SSE streams are still open, closeAllConnections() (Node ≥ 18.2) forces them
    // closed so the callback is guaranteed to fire.
    if (this.httpServer) {
      const server = this.httpServer as Http.Server & {
        closeAllConnections?: () => void;
        closeIdleConnections?: () => void;
      };
      if (typeof server.closeIdleConnections === 'function') {
        server.closeIdleConnections();
      }
      if (typeof server.closeAllConnections === 'function') {
        server.closeAllConnections();
      }
      await new Promise<void>((resolve, reject) => {
        server.close((err?: Error) => {
          if (err) {
            return reject(err);
          }
          resolve();
        });
      });
      this.httpServer = null;
    }

    // Dispose secret resolvers (flush caches, close connections)
    if (this.resolverChain) {
      await this.resolverChain.dispose();
      this.resolverChain = null;
    }

    this.matimo = null;
    logger.info('Matimo MCP server stopped');
  }

  /** Get the MatimoInstance (for testing) */
  getMatimoInstance(): MatimoInstance | null {
    return this.matimo;
  }
}

/**
 * Factory function to create and start an MCP server.
 * Convenience for one-liner usage.
 */
export async function createMCPServer(options?: MCPServerOptions): Promise<MCPServer> {
  const server = new MCPServer(options);
  await server.start();
  return server;
}
