#!/usr/bin/env python3
"""
============================================================================
MATIMO MCP SERVER — STDIO TRANSPORT
============================================================================

PATTERN: MCP server exposing Matimo tools over stdio for Claude Desktop,
         Cursor, and any MCP-compatible client.
─────────────────────────────────────────────────────────────────────────
Run this as the `command` in your Claude Desktop mcp_servers config:

  {
    "mcpServers": {
      "matimo": {
        "command": "uv",
        "args": ["run", "python", "/path/to/mcp/server_stdio.py"],
        "env": { "SLACK_BOT_TOKEN": "xoxb-..." }
      }
    }
  }

Or run directly for testing:

  uv run python mcp/server_stdio.py

WHAT IT EXPOSES:
─────────────────────────────────────────────────────────────────────────
All tools auto-discovered from @matimo/* provider packages.
Add tool_paths to load your own YAML tool definitions too.

CREDENTIALS:
─────────────────────────────────────────────────────────────────────────
  • Reads from environment variables (SLACK_BOT_TOKEN, GITHUB_TOKEN, etc.)
  • Falls back to .env file in the working directory
  • Set env vars in Claude Desktop config (see above) or export in shell

DEPENDENCIES:
─────────────────────────────────────────────────────────────────────────
  uv add "matimo-core[mcp]"   # or: pip install "matimo-core[mcp]"

============================================================================
"""
from __future__ import annotations

import asyncio
import sys
from pathlib import Path


async def main() -> None:
    """Start the Matimo MCP stdio server."""
    try:
        from matimo import Matimo
        from matimo.mcp.server import MCPServer, MCPServerOptions
        from matimo.mcp.secrets import create_resolver_chain
    except ImportError as exc:
        print(
            f"[matimo-mcp] Import error: {exc}\n"
            "Install MCP support with:  pip install 'matimo-core[mcp]'",
            file=sys.stderr,
        )
        sys.exit(1)

    # Load .env if present
    env_file = Path(__file__).parent.parent / ".env"
    resolver = create_resolver_chain([
        {"type": "env"},
        {"type": "dotenv", "path": str(env_file)},
    ])

    # Auto-discover all installed matimo-* provider packages (entry_points)
    matimo = await Matimo.init(auto_discover=True)

    # Start the MCP server on stdio
    server = MCPServer(
        matimo,
        MCPServerOptions(
            transport="stdio",
            secret_resolver=resolver,
        ),
    )
    await server.start()


if __name__ == "__main__":
    asyncio.run(main())
