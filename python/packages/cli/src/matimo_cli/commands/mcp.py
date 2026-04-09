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


def _build_resolver_config(args: McpArgs) -> dict:
    secret_types = args.secrets or ["env", "dotenv"]
    resolvers = []
    for t in secret_types:
        match t:
            case "env":
                resolvers.append({"type": "env"})
            case "dotenv":
                resolvers.append({"type": "dotenv", "path": args.env_file})
            case "vault":
                resolvers.append({"type": "vault", "secret_path": args.vault_path})
            case "aws":
                resolvers.append({"type": "aws", "secret_id": args.aws_secret_id})
            case _:
                print(f"❌ Unknown secret resolver: {t}. Use: env, dotenv, vault, aws", file=sys.stderr)
                sys.exit(1)
    return {"resolvers": resolvers}


def mcp_command(params: list[str]) -> None:
    # Handle 'setup' subcommand
    if params and params[0] == "setup":
        from matimo_cli.commands.mcp_setup import mcp_setup_command
        mcp_setup_command()
        return

    args = _parse_args(params)

    try:
        from matimo.mcp import MCPServer  # type: ignore[import-not-found]
    except ImportError:
        print("❌ matimo MCP server module not available.", file=sys.stderr)
        print("   Make sure matimo is installed: pip install matimo", file=sys.stderr)
        sys.exit(1)

    server = MCPServer(
        transport=args.transport,
        port=args.port,
        tools=args.tools,
        exclude_tools=args.exclude_tools,
        secret_resolver=_build_resolver_config(args),
        mcp_token=args.token,
        tool_paths=args.tool_paths,
        skill_paths=args.skill_paths,
        auto_discover=True,
    )

    def _shutdown(signum: int, frame: object) -> None:
        if args.transport == "stdio":
            sys.stderr.write("\nShutting down Matimo MCP server…\n")
        else:
            print("\nShutting down Matimo MCP server…")
        server.stop()
        sys.exit(0)

    signal.signal(signal.SIGINT, _shutdown)
    signal.signal(signal.SIGTERM, _shutdown)

    try:
        server.start()

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
