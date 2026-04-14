"""
``matimo mcp`` — start the Matimo MCP server.

Mirrors: packages/cli/src/commands/mcp.ts
"""
from __future__ import annotations

import signal
import sys
from dataclasses import dataclass


@dataclass
class McpArgs:
    transport: str = "stdio"
    port: int = 3000
    tools: list[str] | None = None
    exclude_tools: list[str] | None = None
    secrets: list[str] | None = None
    env_file: str | None = None
    vault_path: str | None = None
    aws_secret_id: str | None = None
    token: str | None = None
    tool_paths: list[str] | None = None
    skill_paths: list[str] | None = None
    https: bool = False
    self_signed: bool = False
    cert_path: str | None = None
    key_path: str | None = None


def _parse_args(params: list[str]) -> McpArgs:
    args = McpArgs()
    i = 0

    def require_value(flag: str) -> str:
        nonlocal i
        if i + 1 >= len(params) or params[i + 1].startswith("-"):
            print(f"❌ {flag} requires a value", file=sys.stderr)
            sys.exit(1)
        i += 1
        return params[i]

    while i < len(params):
        flag = params[i]
        match flag:
            case "--transport" | "-t":
                val = require_value("--transport")
                if val not in ("stdio", "http"):
                    print('❌ --transport must be "stdio" or "http"', file=sys.stderr)
                    sys.exit(1)
                args.transport = val
            case "--port" | "-p":
                val = require_value("--port")
                try:
                    args.port = int(val)
                except ValueError:
                    print("❌ --port must be a number", file=sys.stderr)
                    sys.exit(1)
            case "--tools":
                args.tools = [s.strip() for s in require_value("--tools").split(",")]
            case "--exclude":
                args.exclude_tools = [s.strip() for s in require_value("--exclude").split(",")]
            case "--secrets":
                args.secrets = [s.strip() for s in require_value("--secrets").split(",")]
            case "--env-file":
                args.env_file = require_value("--env-file")
            case "--vault-path":
                args.vault_path = require_value("--vault-path")
            case "--aws-secret-id":
                args.aws_secret_id = require_value("--aws-secret-id")
            case "--token":
                args.token = require_value("--token")
            case "--tool-paths":
                args.tool_paths = [s.strip() for s in require_value("--tool-paths").split(",")]
            case "--skill-paths":
                args.skill_paths = [s.strip() for s in require_value("--skill-paths").split(",")]
            case "--https":
                args.https = True
            case "--self-signed":
                args.https = True
                args.self_signed = True
            case "--cert":
                args.cert_path = require_value("--cert")
                args.https = True
            case "--key":
                args.key_path = require_value("--key")
                args.https = True
            case "setup":
                pass  # handled separately
            case _:
                if flag.startswith("-"):
                    print(f"❌ Unknown flag: {flag}", file=sys.stderr)
                    sys.exit(1)
        i += 1

    return args


def _build_resolver_config(args: McpArgs) -> object:
    """Build a SecretResolverChain from CLI args."""
    from matimo.mcp.secrets import (
        EnvSecretResolver,
        DotenvSecretResolver,
        VaultSecretResolver,
        AwsSecretsManagerResolver,
        SecretResolverChain,
    )
    
    secret_types = args.secrets or ["env", "dotenv"]
    resolvers: list[object] = []
    
    for t in secret_types:
        match t:
            case "env":
                resolvers.append(EnvSecretResolver())
            case "dotenv":
                resolvers.append(DotenvSecretResolver(path=args.env_file or ".env"))
            case "vault":
                if args.vault_path:
                    resolvers.append(VaultSecretResolver(secret_path=args.vault_path))
            case "aws":
                if args.aws_secret_id:
                    resolvers.append(AwsSecretsManagerResolver(secret_id=args.aws_secret_id))
            case _:
                print("❌ Unknown secret resolver type. Use: env, dotenv, vault, aws", file=sys.stderr)
                sys.exit(1)
    
    # Return None if no resolvers (let MCP server handle it) or a chain if we have resolvers
    return SecretResolverChain(resolvers) if resolvers else None


def mcp_command(params: list[str]) -> None:
    # Handle 'setup' subcommand
    if params and params[0] == "setup":
        from matimo_cli.commands.mcp_setup import mcp_setup_command
        mcp_setup_command()
        return

    import asyncio
    asyncio.run(_mcp_command_async(params))


async def _mcp_command_async(params: list[str]) -> None:
    """Async implementation of the MCP server command."""
    import os
    import sysconfig
    
    args = _parse_args(params)

    try:
        from matimo import Matimo
        from matimo.mcp import MCPServer, MCPServerOptions  # type: ignore[import-not-found]
    except ImportError as e:
        print("❌ matimo MCP server module not available.", file=sys.stderr)
        print("   Make sure matimo is installed: pip install matimo", file=sys.stderr)
        print(f"   Import error: {e}", file=sys.stderr)
        sys.exit(1)

    # Discover all matimo_* packages if no tool paths provided
    tool_paths = args.tool_paths or []
    if not tool_paths:
        site_packages = sysconfig.get_path("purelib")
        if site_packages and os.path.exists(site_packages):
            for entry in os.listdir(site_packages):
                if entry.startswith("matimo_") and not entry.endswith(".dist-info"):
                    pkg_tools = os.path.join(site_packages, entry, "tools")
                    if os.path.exists(pkg_tools):
                        tool_paths.append(pkg_tools)

    # Initialize Matimo with the given tool paths
    matimo = await Matimo.init(
        tool_paths=tool_paths if tool_paths else None,
        skill_paths=args.skill_paths,
        auto_discover=True,
    )

    # Create MCP server options
    options = MCPServerOptions(
        transport=args.transport,
        port=args.port,
        tools=args.tools,
        exclude_tools=args.exclude_tools,
        secret_resolver=_build_resolver_config(args),
        mcp_token=args.token,
        tool_paths=tool_paths if tool_paths else None,
        skill_paths=args.skill_paths,
        auto_discover=True,
    )

    # Create MCP server
    server = MCPServer(matimo, options)

    def _shutdown(signum: int, frame: object) -> None:
        if args.transport == "stdio":
            sys.stderr.write("\nShutting down Matimo MCP server…\n")
        else:
            print("\nShutting down Matimo MCP server…")
        sys.exit(0)

    signal.signal(signal.SIGINT, _shutdown)
    signal.signal(signal.SIGTERM, _shutdown)

    try:
        await server.start()

        if args.transport == "http":
            protocol = "https" if args.https else "http"
            url = f"{protocol}://localhost:{args.port}/mcp"
            print(f"\n🚀 Matimo MCP server running at {url}")
            if args.https:
                print("🔒 HTTPS enabled")
            print("\n   Press Ctrl+C to stop\n")
    except Exception as exc:
        print(f"❌ Failed to start MCP server: {exc}", file=sys.stderr)
        sys.exit(1)
