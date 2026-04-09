"""
``matimo mcp setup`` — generate MCP config for Claude Desktop / Cursor.

Mirrors: packages/cli/src/commands/mcp-setup.ts
"""
from __future__ import annotations

import json
import os
import re
import sys

_AUTH_PATTERNS = {"TOKEN", "SECRET", "KEY", "PASSWORD", "CREDENTIAL", "AUTH"}
_PLACEHOLDER_RE = re.compile(r"\{(\w+)\}")


def _is_auth_var(name: str) -> bool:
    upper = name.upper()
    return any(p in upper for p in _AUTH_PATTERNS)


def mcp_setup_command() -> None:
    print("\n🔨 Matimo MCP Setup\n")
    print("Scanning for installed tool packages…\n")

    try:
        from matimo.core.tool_loader import ToolLoader  # type: ignore[import-not-found]
    except ImportError:
        print("❌ matimo core not available. Install it first: pip install matimo", file=sys.stderr)
        sys.exit(1)

    try:
        loader = ToolLoader()
        tool_paths = loader.auto_discover_packages()

        if not tool_paths:
            print("No matimo-* tool packages found.")
            print("Install tools first: matimo install slack github\n")
            return

        tools = loader.load_tools_from_multiple_paths(tool_paths)
        print(f"Found {len(tools)} tools across {len(tool_paths)} package(s):\n")

        # Group by provider
        providers: dict[str, list[str]] = {}
        auth_vars: set[str] = set()

        for name, tool in tools.items():
            provider = name.split("_")[0] if "_" in name else name.split("-")[0] if "-" in name else "core"
            providers.setdefault(provider, []).append(name)

            # Extract auth placeholders
            exec_cfg = tool.execution
            raw = str(exec_cfg.model_dump()) if hasattr(exec_cfg, "model_dump") else str(exec_cfg)
            for m in _PLACEHOLDER_RE.finditer(raw):
                if _is_auth_var(m.group(1)):
                    auth_vars.add(m.group(1))

        for provider, tool_names in sorted(providers.items()):
            print(f"  📦 {provider} ({len(tool_names)} tools)")
            for tn in tool_names[:5]:
                print(f"     • {tn}")
            if len(tool_names) > 5:
                print(f"     … and {len(tool_names) - 5} more")

        print()

        # Display required env vars
        if auth_vars:
            print("🔐 Required environment variables:\n")
            for v in sorted(auth_vars):
                value = os.environ.get(v) or os.environ.get(f"MATIMO_{v}")
                status = "✅" if value else "❌"
                print(f"  {status} {v}")
            print()

        # Generate configs
        env_block = {v: os.environ.get(v) or os.environ.get(f"MATIMO_{v}") or "<your-token>" for v in sorted(auth_vars)}

        claude_config = {
            "mcpServers": {
                "matimo": {
                    "command": "matimo",
                    "args": ["mcp"],
                    "env": env_block,
                }
            }
        }

        print("📋 Claude Desktop config (paste into Settings → Developer → MCP Servers):\n")
        print(json.dumps(claude_config, indent=2))

        print("\n📋 Cursor config (paste into .cursor/mcp.json):\n")
        print(json.dumps(claude_config, indent=2))

        print("\n📋 HTTP mode (for remote hosting / Docker):\n")
        env_lines = "\n".join(f"  {v}=<your-token>" for v in sorted(auth_vars))
        print(f"{env_lines}")
        print("  MATIMO_MCP_TOKEN=<your-server-secret>")
        print("  matimo mcp --transport http --port 3000\n")

    except Exception as exc:
        print(f"❌ Setup failed: {exc}", file=sys.stderr)
        sys.exit(1)
