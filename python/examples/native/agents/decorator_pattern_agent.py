"""
Matimo Decorator Pattern — AI Agent with @tool Decorators.
Mirrors: typescript/examples/tools/agents/decorator-pattern-agent.ts

The agent receives a prompt, uses OpenAI to decide which tool to use,
then executes it via @tool-decorated methods.

Run:
    cd python
    OPENAI_API_KEY=sk-... uv run python examples/native/agents/decorator_pattern_agent.py
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
from matimo.decorators import tool, set_global_matimo_instance


class DecoratorPatternAgent:
    """
    Decorator Pattern Agent — @tool decorators intercept method calls
    and execute the corresponding Matimo tool automatically.
    """

    def __init__(self, matimo: Matimo, llm: ChatOpenAI) -> None:
        self._matimo = matimo
        self._llm = llm

    @tool("calculator")
    async def calculate(self, operation: str, a: float, b: float) -> Any:
        # Decorator intercepts → matimo.execute('calculator', {operation, a, b})
        ...

    @tool("echo-tool")
    async def echo(self, message: str) -> Any:
        # Decorator intercepts → matimo.execute('echo-tool', {message})
        ...

    @tool("http-client")
    async def fetch(self, method: str, url: str) -> Any:
        # Decorator intercepts → matimo.execute('http-client', {method, url})
        ...

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
        tool_specs = "\n\n".join(
            "{name}: {desc}\n    Parameters: {params}".format(
                name=s["function"]["name"],
                desc=s["function"]["description"],
                params="; ".join(
                    "{k} ({t}){enum} - {d}".format(
                        k=k,
                        t=v.get("type", ""),
                        enum=f" - valid values: [{', '.join(v['enum'])}]" if v.get("enum") else "",
                        d=v.get("description", ""),
                    )
                    for k, v in s["function"]["parameters"]["properties"].items()
                ),
            )
            for s in tool_schemas
        )

        messages = [
            SystemMessage(
                content=(
                    "You are an AI assistant with access to tools. "
                    "Based on the user's request, decide which tool to use and extract the EXACT required parameters. "
                    "IMPORTANT: Use exact parameter names and enum values as specified. "
                    'Respond ONLY with valid JSON: {"tool": "<tool_name>", "parameters": {<exact_params>}}'
                )
            ),
            HumanMessage(content=f'User request: "{prompt}"\n\nAvailable tools:\n{tool_specs}'),
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
                await self._execute_via_decorator(tool_name, tool_params)
            else:
                print("\n⚠️  No tool call detected in response")
                print(f"Response: {str(content)[:200]}")

        except Exception as exc:
            print(f"\n❌ Error: {exc}")

    # Tool name → (method name, positional arg order)
    _TOOL_METHOD_MAP: dict[str, tuple[str, list[str]]] = {
        "calculator": ("calculate", ["operation", "a", "b"]),
        "echo-tool": ("echo", ["message"]),
        "http-client": ("fetch", ["method", "url"]),
    }

    async def _execute_via_decorator(self, tool_name: str, params: dict[str, Any]) -> None:
        # Normalise calculator operands array → a, b
        if tool_name == "calculator" and isinstance(params.get("operands"), list):
            a, b = params["operands"][0], params["operands"][1]
            params = {"operation": params.get("operation"), "a": a, "b": b}

        print(f"\n🔧 Using tool: {tool_name}")
        print(f"   Parameters: {json.dumps(params)}")

        mapping = self._TOOL_METHOD_MAP.get(tool_name)
        if not mapping:
            print(f"\n❌ Tool '{tool_name}' not in agent's API")
            print(f"Available tools: {', '.join(self._TOOL_METHOD_MAP)}")
            return

        method_name, arg_order = mapping
        method = getattr(self, method_name, None)
        if not callable(method):
            print(f"\n❌ Method '{method_name}' not found")
            return

        # Pass params in the order the method signature expects
        args = [params.get(k) for k in arg_order]

        try:
            result = await method(*args)

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
    print("║   Matimo Decorator Pattern - True AI Agent             ║")
    print("║   (AI decides which tool to use based on prompt)       ║")
    print("╚════════════════════════════════════════════════════════╝\n")

    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        print("❌ Error: OPENAI_API_KEY not set")
        sys.exit(1)

    print("🚀 Initializing Matimo...")
    matimo = await Matimo.init(auto_discover=True)

    # Register global instance so @tool decorators can resolve it
    set_global_matimo_instance(matimo)

    tools = matimo.list_tools()
    print(f"📦 Loaded {len(tools)} tools:\n")
    for t in tools:
        print(f"  • {t.name}")
        print(f"    {t.description}\n")

    print("🤖 Initializing OpenAI LLM (gpt-4o-mini)...\n")
    llm = ChatOpenAI(model="gpt-4o-mini", temperature=0, api_key=api_key)

    agent = DecoratorPatternAgent(matimo, llm)

    prompts = [
        "🧮 What is 42 plus 8?",
        '🔊 Echo the message: "Decorator pattern is elegant and powerful!"',
        "🌐 Fetch the GitHub user profile for octocat using HTTP GET",
    ]

    print("🧪 Testing AI Agent with 3 Different Prompts")
    print("═" * 60)

    for prompt in prompts:
        await agent.process(prompt)
        print("\n" + "─" * 60)

    print("\n✅ Decorator pattern AI agent test complete!\n")


if __name__ == "__main__":
    asyncio.run(main())
