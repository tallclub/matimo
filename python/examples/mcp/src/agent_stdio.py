#!/usr/bin/env python3
"""
============================================================================
MATIMO MCP — LANGCHAIN AI AGENT (STDIO TRANSPORT)
============================================================================

PATTERN: LangChain ReAct agent that discovers and calls Matimo tools
         via the Model Context Protocol (MCP) over stdio transport.
─────────────────────────────────────────────────────────────────────────
What this does:
  1. Spawns `server_stdio.py` as a subprocess (no separate server needed)
  2. Uses langchain-mcp-adapters to load all tools from MCP
  3. Runs a LangChain ReAct agent (OpenAI GPT-4o-mini) that picks tools
  4. Validates all Slack tools end-to-end

Use this pattern when:
  ✅ You want a true AI agent running tools via MCP protocol
  ✅ Testing that your MCP server exposes all expected tools
  ✅ Verifying a Claude Desktop-compatible tool setup locally

SETUP:
─────────────────────────────────────────────────────────────────────────
  1. Create .env:
       OPENAI_API_KEY=sk-xxxxxxxxxxxxx
       SLACK_BOT_TOKEN=xoxb-xxxxxxxxxxxxx
       TEST_CHANNEL=C0000000000       # optional

  2. Install deps:
       uv sync  (from python/ directory)
       # or: pip install "matimo-core[mcp]" langchain-mcp-adapters langchain-openai

USAGE:
─────────────────────────────────────────────────────────────────────────
  make mcp-agent-stdio                          (from examples/)
  uv run python mcp/agent_stdio.py              (from examples/)
  uv run python mcp/agent_stdio.py -- --channel=C0123456789

SLACK TOOLS TESTED (in order):
─────────────────────────────────────────────────────────────────────────
  1. slack_list_channels         — list workspace channels
  2. slack_create_channel        — create a new channel
  3. slack_send_channel_message  — send a message
  4. slack_get_channel_history   — read recent messages
  5. slack_add_reaction          — add emoji reaction
  6. slack_get_reactions         — read reactions
  7. slack_reply_to_message      — threaded reply
  8. slack_get_thread_replies    — read thread
  9. slack_search_messages       — search history
 10. slack_get_user_info         — look up a user
 11. slack_set_channel_topic     — update topic
 12. slack_send_dm               — send direct message

============================================================================
"""
from __future__ import annotations

import asyncio
import os
import sys
from pathlib import Path

# ── Load .env ─────────────────────────────────────────────────────────────────
try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).parent.parent / ".env")
except ImportError:
    pass

# ── Guard: required env vars ──────────────────────────────────────────────────
if not os.getenv("OPENAI_API_KEY"):
    print("❌ Error: OPENAI_API_KEY not set in .env")
    sys.exit(1)
if not os.getenv("SLACK_BOT_TOKEN"):
    print("❌ Error: SLACK_BOT_TOKEN not set in .env")
    sys.exit(1)


async def main() -> None:
    # ── Parse CLI args ────────────────────────────────────────────────────────
    args = sys.argv[1:]
    channel_id = os.getenv("TEST_CHANNEL", "")
    for arg in args:
        if arg.startswith("--channel="):
            channel_id = arg.split("=", 1)[1]

    print("\n╔════════════════════════════════════════════════════════╗")
    print("║     Matimo MCP AI Agent — Stdio Transport               ║")
    print("║     All Slack Tools Test                                ║")
    print("╚════════════════════════════════════════════════════════╝\n")

    # ── Import MCP + LangChain ────────────────────────────────────────────────
    try:
        from langchain_mcp_adapters.client import MultiServerMCPClient  # type: ignore[import]
        from langchain_openai import ChatOpenAI  # type: ignore[import]
        from langgraph.prebuilt import create_react_agent  # type: ignore[import]
        from langchain_core.messages import HumanMessage  # type: ignore[import]
    except ImportError as exc:
        print(f"❌ Missing dependency: {exc}")
        print("Install with:  pip install langchain-mcp-adapters langchain-openai langgraph")
        sys.exit(1)

    # ── Start MCP client via stdio ────────────────────────────────────────────
    server_script = str(Path(__file__).parent / "server_stdio.py")
    print("🚀 Initialising Matimo MCP (stdio)...")
    print(f"   Server script: {server_script}\n")

    async with MultiServerMCPClient(
        {
            "matimo": {
                "command": "python",
                "args": [server_script],
                "transport": "stdio",
                "env": {**os.environ},   # pass all env vars (incl. SLACK_BOT_TOKEN)
            }
        }
    ) as client:
        tools = client.get_tools()
        print(f"📦 Loaded {len(tools)} tools from Matimo MCP:\n")
        for t in tools:
            print(f"  • {t.name}")
        print()

        if not tools:
            print("❌ No tools loaded. Is server_stdio.py working correctly?")
            sys.exit(1)

        slack_tools = [t for t in tools if t.name.startswith("slack")]
        print(f"💬 {len(slack_tools)} Slack tools available\n")

        # ── Build agent ───────────────────────────────────────────────────────
        print("🤖 Initialising OpenAI (GPT-4o-mini) LLM...")
        llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
        agent = create_react_agent(llm, tools)

        # ── Task prompt ───────────────────────────────────────────────────────
        channel_hint = f"Use channel {channel_id}." if channel_id else "Pick any available channel."
        task = f"""
You are testing the Matimo MCP Slack integration. {channel_hint}
Please perform these tasks in order and report the result of each:

1. List all available Slack channels (use slack_list_channels)
2. Create a test channel named "matimo-mcp-python-test" (use slack_create_channel)
3. Send the message "Hello from Matimo MCP Python! 🐍" to that channel
4. Retrieve the last 3 messages from that channel
5. Add a 🎉 reaction to the message you just sent
6. Reply to that message with "This is a threaded reply from Matimo MCP"
7. Search for messages containing "Matimo MCP Python"
8. Look up the workspace's bot user info (use slack_get_user_info)
9. Send yourself a DM: "Matimo MCP Python test complete! ✅"

After each step, confirm what happened. If a step fails, note the error and continue.
Report a final summary of all steps (pass/fail).
"""
        print("🧠 Running agent tasks...\n")
        print("─" * 60)

        response = await agent.ainvoke({"messages": [HumanMessage(content=task)]})
        final = response["messages"][-1].content

        print("\n" + "─" * 60)
        print("\n✅ Agent complete. Final summary:\n")
        print(final)


if __name__ == "__main__":
    asyncio.run(main())
