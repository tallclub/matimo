#!/usr/bin/env python3
"""
============================================================================
MATIMO MCP — LANGCHAIN AI AGENT (HTTP TRANSPORT)
============================================================================

PATTERN: LangChain ReAct agent that discovers and calls Matimo tools
         via the Model Context Protocol (MCP) over HTTP transport.
─────────────────────────────────────────────────────────────────────────
What this does:
  1. Connects to a running MCP HTTP server (on configured URL)
  2. Uses langchain-mcp-adapters to load all tools from MCP
  3. Runs a LangChain ReAct agent (OpenAI GPT-4o-mini) that picks tools
  4. Validates all Slack tools end-to-end

Use this pattern when:
  ✅ Running a separate MCP server and want to connect an agent to it
  ✅ Testing agents against remote/shared MCP infrastructure
  ✅ Building production setups where server and agent run separately
  ✅ Testing HTTP(S) authentication and reconnection logic

SETUP:
─────────────────────────────────────────────────────────────────────────
  1. Create .env:
       OPENAI_API_KEY=sk-xxxxxxxxxxxxx
       SLACK_BOT_TOKEN=xoxb-xxxxxxxxxxxxx
       MCP_SERVER_URL=http://localhost:3555/mcp  # or your server URL
       MATIMO_MCP_TOKEN=matimo-dev-token         # auth token (optional)
       TEST_CHANNEL=C0000000000                  # optional

  2. Install deps:
       uv sync  (from python/ directory)

  3. Start the MCP HTTP server in another terminal:
       make mcp-server-http
       # or: uv run python mcp/server_http.py

USAGE:
─────────────────────────────────────────────────────────────────────────
  make mcp-agent-http                           (from examples/)
  uv run python mcp/agent_http.py               (from examples/)
  uv run python mcp/agent_http.py -- --channel=C0123456789

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


async def main() -> None:
    # ── Parse CLI args ────────────────────────────────────────────────────────
    args = sys.argv[1:]
    channel_id = os.getenv("TEST_CHANNEL", "")
    for arg in args:
        if arg.startswith("--channel="):
            channel_id = arg.split("=", 1)[1]

    print("\n╔════════════════════════════════════════════════════════╗")
    print("║     Matimo MCP AI Agent — HTTP Transport               ║")
    print("║     All Slack Tools Test                                ║")
    print("╚════════════════════════════════════════════════════════╝\n")

    # ── Guard: required env vars ──────────────────────────────────────────────
    if not os.getenv("OPENAI_API_KEY"):
        print("❌ Error: OPENAI_API_KEY not set in .env")
        sys.exit(1)
    if not os.getenv("SLACK_BOT_TOKEN"):
        print("❌ Error: SLACK_BOT_TOKEN not set in .env")
        sys.exit(1)

    # ── Configuration ──────────────────────────────────────────────────────────
    server_url = os.getenv("MCP_SERVER_URL", "http://localhost:3555/mcp")
    bearer_token = os.getenv("MCP_BEARER_TOKEN") or os.getenv("MATIMO_MCP_TOKEN")

    print(f"🤖 Using OpenAI (GPT-4o-mini) as the AI agent")
    print(f"🔌 Transport: HTTP → {server_url}")
    if bearer_token:
        print("🔑 Using bearer token authentication")
    print()

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

    # ── Start MCP client via HTTP ──────────────────────────────────────────────
    print("🚀 Initialising Matimo MCP (HTTP)...")
    print(f"   Server URL: {server_url}\n")

    headers = {}
    if bearer_token:
        headers["Authorization"] = f"Bearer {bearer_token}"

    async with MultiServerMCPClient(
        {
            "matimo": {
                "transport": "http",
                "url": server_url,
                "headers": headers,
                "reconnect": {"enabled": True, "max_attempts": 5, "delay_ms": 2000},
            }
        }
    ) as client:
        tools = client.get_tools()
        print(f"📦 Loaded {len(tools)} tools from Matimo MCP:\n")
        for t in tools:
            print(f"  • {t.name}")
        print()

        if not tools:
            print("❌ No tools loaded. Is the MCP server running at " + server_url + "?")
            sys.exit(1)

        slack_tools = [t for t in tools if t.name.startswith("slack")]
        print(f"💬 {len(slack_tools)} Slack tools available\n")

        # ── Build agent ───────────────────────────────────────────────────────
        print("🤖 Initialising OpenAI (GPT-4o-mini) LLM...")
        llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
        agent = create_react_agent(llm, tools)

        # ── Find a channel to use for all the tasks ────────────────────────────
        active_channel = channel_id
        if not active_channel:
            print("📋 Finding an available channel...")
            try:
                list_resp = await agent.ainvoke(
                    {
                        "messages": [
                            HumanMessage(
                                content="List all Slack channels and return just the first channel ID, nothing else."
                            )
                        ]
                    }
                )
                list_msg = list_resp["messages"][-1]
                import re
                match = re.search(r"C[A-Z0-9]{8,}", list_msg.content) if isinstance(
                    list_msg.content, str
                ) else None
                if match:
                    active_channel = match.group(0)
                    print(f"   Using channel: {active_channel}\n")
                else:
                    print("   ⚠️  Could not auto-detect channel. Set TEST_CHANNEL in .env\n")
            except Exception as e:
                print(f"   ⚠️  Channel detection failed: {e}\n")

        # ── Task prompt ───────────────────────────────────────────────────────
        channel_hint = f"Use channel {active_channel}." if active_channel else "Pick any available channel."
        task = f"""
You are testing the Matimo MCP Slack integration. {channel_hint}
Please perform these tasks in order and report the result of each:

1. List all available Slack channels (use slack_list_channels)
2. Create a test channel named "matimo-mcp-python-http-test" (use slack_create_channel)
3. Send the message "Hello from Matimo MCP Python (HTTP)! 🐍🔌" to that channel
4. Retrieve the last 3 messages from that channel
5. Add a 🎉 reaction to the message you just sent
6. Reply to that message with "This is a threaded reply from Matimo MCP (HTTP)"
7. Search for messages containing "Matimo MCP Python"
8. Look up the workspace's bot user info (use slack_get_user_info)
9. Send yourself a DM: "Matimo MCP Python (HTTP) test complete! ✅"

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
