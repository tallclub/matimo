"""
Matimo Factory Pattern — AI Agent with Tool Decision Making.
Mirrors: typescript/examples/tools/agents/factory-pattern-agent.ts

The agent receives a prompt, uses OpenAI to decide which tool to use,
then executes that tool via Matimo.

Run:
    cd python
    OPENAI_API_KEY=sk-... uv run python examples/native/agents/factory_pattern_agent.py
"""
from __future__ import annotations

import asyncio
import json
import os
import re
import sys
from typing import Any

from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage

from matimo import Matimo


class FactoryPatternAgent:
    """
    Factory Pattern Agent — uses OpenAI to decide which tool to call,
    then executes it via matimo.execute().
    """

    def __init__(self, matimo: Matimo, llm: ChatOpenAI) -> None:
        self._matimo = matimo
        self._llm = llm

    def _get_tool_schemas(self) -> list[dict]:
        """Build OpenAI function schemas from Matimo tool definitions."""
        return [
            {
                "type": "function",
                "function": {
                    "name": t.name,
                    "description": t.description,
                    "parameters": {
                        "type": "object",
                        "properties": {
                            param_name: {
                                "type": param.type.value if hasattr(param.type, "value") else param.type,
                                "description": param.description or "",
                                **({"enum": param.enum} if param.enum else {}),
                            }
                            for param_name, param in (t.parameters or {}).items()
                        },
                        "required": [
                            name for name, p in (t.parameters or {}).items() if p.required
                        ],
                    },
                },
            }
            for t in self._matimo.list_tools()
        ]

    async def process(self, prompt: str) -> None:
        print(f'\n❓ Prompt: "{prompt}"')

        tool_schemas = self._get_tool_schemas()
        tool_summary = ", ".join(
            f"{s['function']['name']}: {s['function']['description']}"
            for s in tool_schemas
        )

        messages = [
            SystemMessage(
                content=(
                    "You are an AI assistant with access to tools. "
                    "Based on the user's request, decide which tool to use and extract the required parameters. "
                    'Respond with JSON: {"tool": "<tool_name>", "parameters": {...}}'
                )
            ),
            HumanMessage(
                content=(
                    f"User request: {prompt}\n\n"
                    f"Available tools: {tool_summary}\n\n"
                    'Respond with JSON: {"tool": "<tool_name>", "parameters": {...}}'
                )
            ),
        ]

        try:
            response = await self._llm.ainvoke(messages)
            content = response.content

            tool_name: str | None = None
            tool_params: dict | None = None

            if isinstance(content, str):
                try:
                    parsed = json.loads(content)
                    tool_name = parsed.get("tool") or parsed.get("function", {}).get("name")
                    tool_params = parsed.get("parameters") or parsed.get("function", {}).get("parameters") or parsed
                except json.JSONDecodeError:
                    match = re.search(r'\{[^{}]*"tool"[^{}]*\}', content)
                    if match:
                        try:
                            parsed = json.loads(match.group())
                            tool_name = parsed.get("tool")
                            tool_params = parsed.get("parameters")
                        except json.JSONDecodeError:
                            pass

            if tool_name and tool_params is not None:
                await self._execute_tool(tool_name, tool_params)
            else:
                print("\n⚠️  No tool call detected in response")
                print(f"Response: {str(content)[:200]}")

        except Exception as exc:
            print(f"\n❌ Error: {exc}")

    async def _execute_tool(self, tool_name: str, params: dict[str, Any]) -> None:
        tool = self._matimo.get_tool(tool_name)
        if not tool:
            print(f"\n❌ Tool '{tool_name}' not found")
            return

        # Calculator: normalise operands array → a, b
        if tool_name == "calculator" and isinstance(params.get("operands"), list):
            a, b = params["operands"][0], params["operands"][1]
            params = {"operation": params.get("operation"), "a": a, "b": b}

        print(f"\n🔧 Using tool: {tool_name}")
        print(f"   Parameters: {json.dumps(params)}")

        try:
            result = await self._matimo.execute(tool_name, params)

            if isinstance(result, dict):
                if "stdout" in result:
                    try:
                        print("\n✅ Result:", json.loads(result["stdout"]))
                    except (json.JSONDecodeError, TypeError):
                        print("\n✅ Result:", result["stdout"])
                elif "data" in result:
                    data_str = json.dumps(result["data"])[:200]
                    print(f"\n✅ Result (HTTP {result.get('status_code', '?')}): {data_str}")
                else:
                    print("\n✅ Result:", result)
            else:
                print("\n✅ Result:", result)

        except Exception as exc:
            print(f"\n❌ Tool Error: {exc}")


async def main() -> None:
    print("\n╔════════════════════════════════════════════════════════╗")
    print("║   Matimo Factory Pattern - True AI Agent               ║")
    print("║   (AI decides which tool to use based on prompt)       ║")
    print("╚════════════════════════════════════════════════════════╝\n")

    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        print("❌ Error: OPENAI_API_KEY not set")
        sys.exit(1)

    print("🚀 Initializing Matimo...")
    matimo = await Matimo.init(auto_discover=True)

    tools = matimo.list_tools()
    print(f"📦 Loaded {len(tools)} tools:\n")
    for t in tools:
        print(f"  • {t.name}")
        print(f"    {t.description}\n")

    print("🤖 Initializing OpenAI LLM (gpt-4o-mini)...\n")
    llm = ChatOpenAI(model="gpt-4o-mini", temperature=0, api_key=api_key)

    agent = FactoryPatternAgent(matimo, llm)

    prompts = [
        "🧮 What is 42 plus 8?",
        '🔊 Echo the message: "Factory pattern works perfectly!"',
        "🌐 Fetch the GitHub user profile for octocat using HTTP GET",
    ]

    print("🧪 Testing AI Agent with 3 Different Prompts")
    print("═" * 60)

    for prompt in prompts:
        await agent.process(prompt)
        print("\n" + "─" * 60)

    print("\n✅ Factory pattern AI agent test complete!\n")


if __name__ == "__main__":
    asyncio.run(main())
