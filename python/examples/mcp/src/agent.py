#!/usr/bin/env python3
"""
============================================================================
MATIMO MCP — LANGCHAIN AI AGENT (UNIFIED - STDIO / HTTP / MULTI)
============================================================================

PATTERN: True AI Agent with OpenAI + LangChain via MCP
─────────────────────────────────────────────────────────────────────────
This is a REAL AI agent that:
  1. Supports all MCP transports: stdio, HTTP, and multi-server
  2. Uses OpenAI LLM (GPT-4o-mini) to decide which tools to use
  3. Connects via langchain-mcp-adapters for tool discovery
  4. Executes tools autonomously through MCP protocol
  5. Processes results and responds naturally

Use this pattern when:
  ✅ Building agents that need flexible transport options
  ✅ Want to switch between stdio and HTTP without code changes
  ✅ Multi-server setups (merge tools from multiple MCP servers)
  ✅ CLI-driven agent with configurable options
  ✅ Reference implementation for production agents

SETUP:
─────────────────────────────────────────────────────────────────────────
  1. Create .env file:
       OPENAI_API_KEY=sk-xxxxxxxxxxxxx
       SLACK_BOT_TOKEN=xoxb-xxxxxxxxxxxxx
       GMAIL_ACCESS_TOKEN=ya29.xxxxxxxxxxxxx

  2. Install dependencies:
       uv sync  (from python/ directory)

USAGE:
─────────────────────────────────────────────────────────────────────────
  # Stdio — no server to start
  make mcp-agent -- --stdio
  uv run python mcp/agent.py -- --stdio

  # HTTP — connect to running server
  uv run python mcp/server_http.py &        # start server
  uv run python mcp/agent.py -- --http --token <token>

  # Multi-server — merge stdio + HTTP tools
  uv run python mcp/agent.py -- --multi --token <token>

WHAT IT DOES:
─────────────────────────────────────────────────────────────────────────
This unified agent demonstrates all three MCP transport modes:
  - stdio: Spawns matimo mcp as subprocess (simplest, no setup)
  - http: Connects to running MCP server (remote/shared scenarios)
  - multi: Connects to both, merges all tools (advanced)

Runs the same set of example tasks across whichever transport is chosen.

============================================================================
"""
from __future__ import annotations

import asyncio
import os
import sys
from pathlib import Path
from typing import Any, TypedDict

# ── Load .env ─────────────────────────────────────────────────────────────────
try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).parent.parent / ".env")
except ImportError:
    pass


# MCP auto-discovers every installed matimo-* provider package (150+ tools
# across the example workspace), but LangChain/OpenAI rejects requests with
# more than 128 bound tools. This demo's task only touches Slack, Gmail,
# GitHub, and database tools — keep those first, then fill any remaining
# budget with whatever else MCP exposed, capped at the API limit.
_OPENAI_TOOL_LIMIT = 128
_PRIORITY_PREFIXES = ("slack", "gmail", "github", "postgres")


def _cap_tools(tools: list[Any]) -> list[Any]:
    """Return at most _OPENAI_TOOL_LIMIT tools, keeping priority tools first."""
    if len(tools) <= _OPENAI_TOOL_LIMIT:
        return tools
    prioritized = [t for t in tools if t.name.startswith(_PRIORITY_PREFIXES)]
    rest = [t for t in tools if not t.name.startswith(_PRIORITY_PREFIXES)]
    return (prioritized + rest)[:_OPENAI_TOOL_LIMIT]


class Config(TypedDict):
    """Configuration for the agent."""
    transport: str  # 'stdio' | 'http' | 'multi'
    http_url: str
    bearer_token: str | None
    model: str


def parse_args() -> Config:
    """Parse command-line arguments."""
    args = sys.argv[1:]

    transport = os.getenv("MCP_TRANSPORT", "stdio")
    http_url = os.getenv("MCP_SERVER_URL", "http://localhost:3555/mcp")
    bearer_token = os.getenv("MCP_BEARER_TOKEN") or os.getenv("MATIMO_MCP_TOKEN")
    model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

    i = 0
    while i < len(args):
        arg = args[i]
        if arg == "--stdio":
            transport = "stdio"
        elif arg == "--http":
            transport = "http"
        elif arg == "--multi":
            transport = "multi"
        elif arg == "--url":
            i += 1
            if i < len(args):
                http_url = args[i]
        elif arg == "--token":
            i += 1
            if i < len(args):
                bearer_token = args[i]
        elif arg == "--model":
            i += 1
            if i < len(args):
                model = args[i]
        elif arg in ("--help", "-h"):
            print_help()
            sys.exit(0)
        i += 1

    return {
        "transport": transport,
        "http_url": http_url,
        "bearer_token": bearer_token,
        "model": model,
    }


def print_help() -> None:
    """Print help message."""
    print("""
Matimo MCP + LangChain Agent (Unified)

USAGE:
  uv run python mcp/agent.py [OPTIONS]
  make mcp-agent -- [OPTIONS]

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
  uv run python mcp/agent.py -- --stdio
  uv run python mcp/agent.py -- --http --token my-secret
  uv run python mcp/agent.py -- --multi

ENVIRONMENT VARIABLES:
  MCP_TRANSPORT       Transport type (stdio|http|multi)
  MCP_SERVER_URL      HTTP server URL (default: http://localhost:3555/mcp)
  MCP_BEARER_TOKEN    Bearer token for authentication
  MATIMO_MCP_TOKEN    Alternative bearer token env var
  OPENAI_MODEL        OpenAI model (default: gpt-4o-mini)
  OPENAI_API_KEY      Required for agent operation
  SLACK_BOT_TOKEN     For testing Slack tools
""")


async def main() -> None:
    """Run the unified MCP agent."""
    config = parse_args()

    print("\n╔════════════════════════════════════════════════════════╗")
    print("║     Matimo MCP + LangChain AI Agent (Unified)          ║")
    print("║     All Available Tools Test                           ║")
    print("╚════════════════════════════════════════════════════════╝\n")

    # ── Guard: required env vars ──────────────────────────────────────────────
    if not os.getenv("OPENAI_API_KEY"):
        print("❌ Error: OPENAI_API_KEY not set in .env")
        print("   Create a .env file or export it:")
        print("   export OPENAI_API_KEY=sk-xxxxxxxxxxxxx")
        sys.exit(1)

    # ── Import MCP + LangChain ────────────────────────────────────────────────
    try:
        from langchain_mcp_adapters.client import MultiServerMCPClient  # type: ignore[import]
        from langchain_openai import ChatOpenAI  # type: ignore[import]
        from langgraph.prebuilt import create_react_agent  # type: ignore[import]
        from langchain_core.messages import HumanMessage  # type: ignore[import]
    except ImportError as exc:
        print(f"❌ Missing dependency: {exc}")
        print("Install with: uv sync")
        sys.exit(1)

    # ── Print configuration ────────────────────────────────────────────────────
    print(f"🚀 Configuration:")
    print(f"   Transport: {config['transport'].upper()}")
    print(f"   Model: {config['model']}")
    if config["transport"] in ("http", "multi"):
        print(f"   HTTP Server: {config['http_url']}")
        if config["bearer_token"]:
            print("   Authentication: Bearer token")
    print()

    # ── Build MCP client configuration ─────────────────────────────────────────
    mcp_servers = {}

    if config["transport"] in ("stdio", "multi"):
        # Add stdio server (direct Matimo subprocess)
        mcp_servers["matimo-stdio"] = {
            "command": "matimo",
            "args": ["mcp"],
            "transport": "stdio",
            "env": {**os.environ},  # pass all env vars
        }

    if config["transport"] in ("http", "multi"):
        # Add HTTP server
        headers = {}
        if config["bearer_token"]:
            headers["Authorization"] = f"Bearer {config['bearer_token']}"

        mcp_servers["matimo-http"] = {
            "transport": "http",
            "url": config["http_url"],
            "headers": headers or {},
            "reconnect": {"enabled": True, "max_attempts": 5, "delay_ms": 2000},
        }

    # ── Initialize MCP client ──────────────────────────────────────────────────
    print("🚀 Initialising Matimo MCP...")
    async with MultiServerMCPClient(mcp_servers) as client:
        tools = client.get_tools()
        print(f"📦 Loaded {len(tools)} tools from Matimo MCP:\n")

        # Group and display tools
        tool_groups: dict[str, list[str]] = {}
        for t in tools:
            prefix = t.name.split("_")[0] if "_" in t.name else "other"
            if prefix not in tool_groups:
                tool_groups[prefix] = []
            tool_groups[prefix].append(t.name)

        for prefix in sorted(tool_groups.keys()):
            names = tool_groups[prefix]
            print(f"  📌 {prefix} ({len(names)} tools)")
            for name in names[:3]:  # Show first 3
                print(f"     • {name}")
            if len(names) > 3:
                print(f"     • ... and {len(names) - 3} more")

        print()

        if not tools:
            print("❌ No tools loaded. Check your configuration and server status.")
            sys.exit(1)

        bound_tools = _cap_tools(tools)
        if len(bound_tools) < len(tools):
            print(
                f"⚠️  Capped to {len(bound_tools)} tools for the LLM (OpenAI's 128-tool "
                "limit; prioritized slack/gmail/github/postgres for this demo's task)\n"
            )

        # ── Build agent ───────────────────────────────────────────────────────
        print("🤖 Initialising OpenAI LLM...")
        llm = ChatOpenAI(model=config["model"], temperature=0)
        agent = create_react_agent(llm, bound_tools)

        # ── Task prompt ───────────────────────────────────────────────────────
        task = f"""
You have access to various tools for interacting with multiple services.
Please perform these tasks:

1. **Discovery**: List what tools are available to you
2. **Slack (if available)**:
   - List channels
   - Send a test message to #general or any channel
   - Read recent messages
3. **Gmail (if available)**:
   - List recent unread emails
   - Show one email subject and snippet
4. **GitHub (if available)**:
   - List repositories
   - Show recent activity
5. **Database Tools (if available)**:
   - Show database connection status
   - List available tables

For each service, attempt the operation and report:
 ✅ Success: What you found
 ⚠️  Skipped: Tool not available
 ❌ Error: What went wrong

Summarize at the end which services are working and which are missing.
"""
        print("🧠 Running agent tasks...\n")
        print("─" * 60)

        response = await agent.ainvoke({"messages": [HumanMessage(content=task)]})
        final = response["messages"][-1].content

        print("\n" + "─" * 60)
        print("\n✅ Agent complete. Summary:\n")
        print(final)

    print("\n" + "=" * 60)
    print("Agent session finished.\n")


if __name__ == "__main__":
    asyncio.run(main())
