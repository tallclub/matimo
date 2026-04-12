#!/usr/bin/env python3
"""
============================================================================
META-TOOLS INTEGRATION FLOW -- LangChain Agent
============================================================================

A REAL LangChain ReAct agent (gpt-4o-mini) that demonstrates the complete
tool lifecycle with Matimo meta-tools:
  1. Agent creates a new tool  (matimo_create_tool)
  2. Doctor validates the YAML (matimo_doctor)
  3. Policy engine enforces security rules (automatic)
  4. If safe -> human approves via matimo_review
  5. If unsafe -> agent learns why and tries again
  6. Matimo reloads the registry (matimo_reload_tools)
  7. Agent uses the newly approved tool

This is NOT a mock -- it is a real agent making real decisions based on
actual policy enforcement and human feedback.

Missions (goal-driven -- agent is NOT told which tools to call):
  1. "Create a safe HTTP GET tool" -> agent creates, validates, approves, reloads
  2. "Create a shell command tool" -> policy rejects -> agent learns limits
  3. "Create a file reader tool"   -> policy blocks / human rejects
  4. "Build working tools"         -> agent learns from failures, creates 2 safe tools
  5. "List and use created tools"  -> discovers matimo_list_user_tools, executes one

SETUP:
--------------------------------------------------------------------
  OPENAI_API_KEY must be set in .env or environment.

USAGE:
--------------------------------------------------------------------
  uv run python meta_flow/meta_tools_integration.py

============================================================================
"""
from __future__ import annotations

import asyncio
import os
import shutil
import sys
import tempfile
from pathlib import Path
from typing import Any

from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent.parent / ".env")

from matimo import (  # noqa: E402
    Matimo,
    convert_tools_to_langchain,
    get_global_approval_handler,
    get_skills_metadata,
    set_global_matimo_instance,
)
from matimo.policy.types import PolicyConfig  # noqa: E402

# ── Formatting helpers ───────────────────────────────────────────────────────

PASS = "\x1b[32m\u2713 PASS\x1b[0m"
FAIL = "\x1b[31m\u2717 FAIL\x1b[0m"
WARN = "\x1b[33m\u26a0 WARN\x1b[0m"
INFO = "\x1b[36m\u2139\x1b[0m"


def header(title: str) -> None:
    print("\n" + "=" * 72)
    print(f"  {title}")
    print("=" * 72)


def subheader(title: str) -> None:
    dashes = "-" * max(0, 62 - len(title))
    print(f"\n  -- {title} {dashes}")


def show_result(label: str, status: str, detail: str | None = None) -> None:
    msg = f"{status}  {label}: {detail}" if detail else f"{status}  {label}"
    print(f"    {msg}")


# ── Interactive approval ─────────────────────────────────────────────────────

_stdin_line_queue: asyncio.Queue[str] = asyncio.Queue()
_stdin_reader_started = False


async def _start_stdin_reader() -> None:
    global _stdin_reader_started
    if _stdin_reader_started:
        return
    _stdin_reader_started = True

    import threading

    loop = asyncio.get_event_loop()

    def _read() -> None:
        for line in sys.stdin:
            asyncio.run_coroutine_threadsafe(
                _stdin_line_queue.put(line.rstrip("\n")), loop
            )

    threading.Thread(target=_read, daemon=True).start()


async def _next_stdin_line(prompt: str) -> str:
    sys.stdout.write(prompt)
    sys.stdout.flush()
    try:
        return await asyncio.wait_for(_stdin_line_queue.get(), timeout=120)
    except asyncio.TimeoutError:
        return "n"


async def interactive_approval(request: dict[str, Any]) -> bool:
    tool_name = request.get("tool_name", "")
    description = str(request.get("description", "N/A") or "N/A")

    print("\n    +----------------------------------------------------------+")
    print("    |  HUMAN APPROVAL REQUIRED (via matimo review)             |")
    print("    +----------------------------------------------------------+")
    print(f"    |  Tool: {tool_name}")
    print(f"    |  Desc: {description[:50]}")
    print("    +----------------------------------------------------------+")

    answer = (await _next_stdin_line("    Approve? (y/n): ")).strip().lower()
    approved = answer in ("y", "yes")

    if approved:
        print(f"    {PASS}  Approved by human operator.\n")
    else:
        print(f"    {FAIL}  Rejected by human operator.\n")

    return approved


# ── Agent system prompt ───────────────────────────────────────────────────────

AGENT_SYSTEM_PROMPT = (
    "You are an expert Matimo agent orchestrating a tool creation and approval workflow.\n\n"
    "You have these meta-tools:\n"
    "1. matimo_doctor -- Validate a YAML tool definition against schema and policies\n"
    "   - Input: YAML string\n"
    "   - Output: Validation report (errors, warnings, or 'valid')\n"
    "   - Use this BEFORE submitting tools for approval\n\n"
    "2. matimo_create_tool -- Create a new tool YAML file on disk (draft status)\n"
    "   - Input: toolName, yaml_content (complete YAML string), target_dir\n"
    "   - Output: { success, message, ... }\n"
    "   - After creation, must be approved via matimo_review before use\n\n"
    "3. matimo_review -- Approve a tool for production (human-in-the-loop)\n"
    "   - Input: toolName, target_dir\n"
    "   - Output: Approval status or error if human rejects\n"
    "   - After approval, you must reload the registry\n\n"
    "4. matimo_reload_tools -- Reload the tool registry after changes\n"
    "   - Input: target_dir\n"
    "   - Output: Refreshed tool list\n"
    "   - Call this after approving a tool to make it available\n\n"
    "5. matimo_list_user_tools -- List all tools in a directory\n"
    "   - Input: target_dir\n"
    "   - Output: Array of tool metadata\n\n"
    "REQUIRED YAML STRUCTURE:\n"
    "Every tool MUST have these fields:\n"
    "```yaml\n"
    "name: tool_name_here\n"
    "version: \"1.0.0\"\n"
    "description: \"What this tool does\"\n"
    "parameters:\n"
    "  param_name:\n"
    "    type: string\n"
    "    required: true\n"
    "    description: \"What this parameter does\"\n"
    "execution:\n"
    "  type: http\n"
    "  method: GET\n"
    "  url: \"https://api.domain.com/endpoint\"\n"
    "```\n\n"
    "Example valid tool:\n"
    "```yaml\n"
    "name: github_user_lookup\n"
    "version: \"1.0.0\"\n"
    "description: Look up a GitHub user by username\n"
    "parameters:\n"
    "  username:\n"
    "    type: string\n"
    "    required: true\n"
    "    description: GitHub username to look up\n"
    "execution:\n"
    "  type: http\n"
    "  method: GET\n"
    "  url: \"https://api.github.com/users/{username}\"\n"
    "```\n\n"
    "Your policy constraints (enforced by matimo_doctor):\n"
    "- HTTP GET/POST to allowed public APIs only\n"
    "- No shell commands (command type blocked)\n"
    "- No arbitrary code execution (function type blocked)\n"
    "- No SSRF attacks (internal IPs blocked)\n"
    "- No reserved namespace hijacking (matimo_* blocked)\n\n"
    "Strategy:\n"
    "1. Understand the requirements\n"
    "2. Generate complete YAML with name, version, description, parameters, and execution\n"
    "3. Validate with matimo_doctor -- if errors, read them and revise YAML\n"
    "4. Create with matimo_create_tool when validation passes\n"
    "5. Review with matimo_review (human approves or rejects)\n"
    "6. Reload with matimo_reload_tools\n"
    "7. Use the tool in the next mission\n\n"
    "IMPORTANT:\n"
    "- Always include version, description, and execution fields -- never omit them\n"
    "- Parameters and execution fields are always required\n"
    "- You are NOT told which tools to call -- discover them from the descriptions above."
)


# OpenAI caps tool arrays at 128 entries per request.
_OPENAI_TOOL_LIMIT = 128


def _cap_tools(lc_tools: list[Any], priority_names: list[str] | None = None) -> list[Any]:
    """Return at most _OPENAI_TOOL_LIMIT tools, keeping priority tools first."""
    if len(lc_tools) <= _OPENAI_TOOL_LIMIT:
        return lc_tools
    if not priority_names:
        return lc_tools[:_OPENAI_TOOL_LIMIT]
    priority_set = set(priority_names)
    prioritised = [t for t in lc_tools if t.name in priority_set]
    rest = [t for t in lc_tools if t.name not in priority_set]
    return (prioritised + rest)[:_OPENAI_TOOL_LIMIT]


# ── Mission runner ────────────────────────────────────────────────────────────


async def run_mission(
    llm_with_tools: Any,
    matimo: Matimo,
    mission: str,
    context: str | None = None,
    system_prompt: str = AGENT_SYSTEM_PROMPT,
) -> dict[str, Any]:
    import json

    from langchain_core.messages import HumanMessage, SystemMessage, ToolMessage

    tools_created: list[str] = []
    human_content = f"{context}\n\nGoal: {mission}" if context else mission
    messages: list[Any] = [SystemMessage(system_prompt), HumanMessage(human_content)]
    iterations = 0
    max_iterations = 12

    while iterations < max_iterations:
        iterations += 1
        response = await llm_with_tools.ainvoke(messages)

        if response.tool_calls:
            messages.append(response)
            for tool_call in response.tool_calls:
                args_str = json.dumps(tool_call["args"]).replace("\n", " ")
                print(
                    f"\n    [tool] Agent: {tool_call['name']}"
                    f"({args_str[:100]}{'...' if len(args_str) > 100 else ''})"
                )
                try:
                    tool_result = await matimo.execute(
                        tool_call["name"], tool_call["args"]
                    )
                    result_str = (
                        tool_result
                        if isinstance(tool_result, str)
                        else json.dumps(tool_result, indent=2)
                    )

                    # Track created tools
                    if tool_call["name"] == "matimo_create_tool":
                        created_name: str | None = None
                        args = tool_call.get("args") or {}
                        if isinstance(args, dict) and "name" in args:
                            created_name = str(args["name"])
                        if (
                            not created_name
                            and isinstance(tool_result, dict)
                            and "name" in tool_result
                        ):
                            created_name = str(tool_result["name"])
                        if created_name:
                            tools_created.append(created_name)

                    print(
                        f"    [result] {result_str[:250].replace(chr(10), ' ')}"
                        f"{'...' if len(result_str) > 250 else ''}"
                    )
                    messages.append(
                        ToolMessage(
                            tool_call_id=tool_call.get("id", ""),
                            content=result_str,
                            name=tool_call["name"],
                        )
                    )
                except Exception as exc:
                    error_msg = str(exc)
                    print(f"    [error] {error_msg[:200]}")
                    messages.append(
                        ToolMessage(
                            tool_call_id=tool_call.get("id", ""),
                            content=f"Error: {error_msg}",
                            name=tool_call["name"],
                        )
                    )
        else:
            final_text = (
                response.content
                if isinstance(response.content, str)
                else str(response.content)
            )
            print(f"\n    [agent] {final_text}")
            return {"result": final_text, "tools_created": tools_created}

    return {"result": "(Agent reached max iterations)", "tools_created": tools_created}


# ── Main ──────────────────────────────────────────────────────────────────────


async def main() -> None:
    print("\n" + "=" * 72)
    print("  Matimo Meta-Tools Integration Flow")
    print("  Tool Creation -> Policy Validation -> Human Approval -> Usage")
    print("=" * 72)

    if not os.environ.get("OPENAI_API_KEY"):
        print("\n  ERROR: OPENAI_API_KEY not set.")
        print("         Add it to examples/.env or export it in your shell.\n")
        sys.exit(1)

    from langchain_openai import ChatOpenAI

    await _start_stdin_reader()

    temp_dir = tempfile.mkdtemp(prefix="matimo-meta-flow-")
    tools_dir = Path(temp_dir) / "tools"
    tools_dir.mkdir(parents=True, exist_ok=True)

    try:
        # ── PHASE 1: Setup ───────────────────────────────────────────────────

        header("PHASE 1: Setup")

        approval_handler = get_global_approval_handler()
        approval_handler.set_approval_callback(interactive_approval)

        matimo = await Matimo.init(
            auto_discover=True,
            tool_paths=[str(tools_dir)],
            log_level="silent",
            untrusted_paths=[str(tools_dir)],
            policy_config=PolicyConfig(),  # Enable policy engine
        )
        set_global_matimo_instance(matimo)

        tools = matimo.list_tools()
        show_result(
            "Matimo meta-tools loaded",
            PASS,
            f"{len(tools)} tools (policy: {'enabled' if matimo.has_policy() else 'disabled'})",
        )

        meta_tools = [t for t in tools if t.name.startswith("matimo_")]
        show_result(
            "Meta-tools available",
            PASS,
            ", ".join(t.name for t in meta_tools),
        )

        langchain_tools = _cap_tools(
            convert_tools_to_langchain(tools, matimo),
            priority_names=[t.name for t in tools if t.name.startswith("matimo_")],
        )
        llm = ChatOpenAI(model="gpt-4o-mini", temperature=0, timeout=30)
        llm_with_tools = llm.bind_tools(langchain_tools)
        show_result("LangChain agent initialized", PASS, "gpt-4o-mini with meta-tools")

        # Inject Level 1 skill metadata (name + description only).
        # agentskills.io progressive disclosure:
        #   Level 1 at startup  -- get_skills_metadata() = cheap name+description block
        #   Level 2 per-request -- build_relevant_skill_prompt(matimo, query) loads full
        #                          SKILL.md content only for semantically relevant skills
        skills_meta = get_skills_metadata(matimo)
        if skills_meta:
            skills_block = "Available skills:\n" + "\n".join(
                f"  - {s['name']}: {s.get('description', '')}" for s in skills_meta
            )
            agent_system_prompt = f"{AGENT_SYSTEM_PROMPT}\n\n{skills_block}"
            show_result("Skill metadata (Level 1) injected into system prompt", PASS)
        else:
            agent_system_prompt = AGENT_SYSTEM_PROMPT

        print(f"\n    {INFO} Tools directory: {tools_dir}")
        print(f"    {INFO} When prompted, type 'y' to approve tools\n")

        # ── PHASE 2: Missions ────────────────────────────────────────────────

        header("PHASE 2: Missions (Agent-Driven Tool Lifecycle)")

        mission_results: list[dict[str, Any]] = []

        # Mission 1: Safe HTTP tool
        subheader("Mission 1: Create a safe HTTP GET tool")
        print('    Goal: "Create a weather tool that calls a safe API"\n')
        m1 = await run_mission(
            llm_with_tools,
            matimo,
            (
                "Create a tool to fetch weather data from api.weatherapi.com. "
                "Use HTTP GET method. Name it \"weather_fetch\". Include parameters for city. "
                "After creating and validating, submit it for approval (matimo_review) "
                "and then reload the tools registry."
            ),
            context=f"Tools directory: {tools_dir}",
            system_prompt=agent_system_prompt,
        )
        mission_results.append(
            {
                "mission": "Safe HTTP Tool",
                "success": len(m1["tools_created"]) > 0,
                "tools_created": m1["tools_created"],
            }
        )

        # Mission 2: Shell command (will fail policy)
        subheader("Mission 2: Attempt to create a shell command tool")
        print('    Goal: "Create a tool that executes shell commands"\n')
        m2 = await run_mission(
            llm_with_tools,
            matimo,
            (
                'Create a tool that can execute arbitrary shell commands. Name it "shell_exec". '
                "Use command execution type with bash. "
                "Validate it first with matimo_doctor to see what happens."
            ),
            context=(
                f"Tools directory: {tools_dir}\n\n"
                "Note: If this fails, that is the policy engine blocking unsafe tool types. "
                "Learn what it rejects and why."
            ),
            system_prompt=agent_system_prompt,
        )
        mission_results.append(
            {
                "mission": "Shell Command (blocked)",
                "success": False,
                "tools_created": m2["tools_created"],
            }
        )

        # Mission 3: File reader (will fail policy)
        subheader("Mission 3: Attempt to create a file reader tool")
        print('    Goal: "Create a tool to read files from disk"\n')
        m3 = await run_mission(
            llm_with_tools,
            matimo,
            (
                'Try to create a tool that reads files using the "cat" command. '
                'Name it "file_reader". '
                "Validate it with matimo_doctor first. See what happens."
            ),
            context=(
                f"Tools directory: {tools_dir}\n\n"
                "This will test policy enforcement on dangerous operation types."
            ),
            system_prompt=agent_system_prompt,
        )
        mission_results.append(
            {
                "mission": "File Reader (blocked)",
                "success": False,
                "tools_created": m3["tools_created"],
            }
        )

        # Mission 4: Create safe tools (learning from failures)
        subheader("Mission 4: Create working tools by learning from failures")
        print('    Goal: "Build tools that pass policy and get human approval"\n')
        m4 = await run_mission(
            llm_with_tools,
            matimo,
            (
                "Now create safe tools that will actually work. Create two tools:\n"
                '1. "user_lookup" - fetch user data from jsonplaceholder.typicode.com '
                "using HTTP GET\n"
                '2. "github_stars" - fetch GitHub repository star count using '
                "api.github.com/repos endpoint\n\n"
                "For each:\n"
                "1. Generate YAML\n"
                "2. Validate with matimo_doctor\n"
                "3. Create with matimo_create_tool\n"
                "4. Review with matimo_review (I will approve)\n"
                "5. Reload with matimo_reload_tools\n\n"
                "Be thorough and complete each step."
            ),
            context=f"Tools directory: {tools_dir}",
            system_prompt=agent_system_prompt,
        )
        mission_results.append(
            {
                "mission": "Safe Tool Creation",
                "success": len(m4["tools_created"]) >= 2,
                "tools_created": m4["tools_created"],
            }
        )

        # Mission 5: List and use created tools
        subheader("Mission 5: List all user tools and execute one")
        print('    Goal: "Show all created tools and use them"\n')
        m5 = await run_mission(
            llm_with_tools,
            matimo,
            (
                "Use matimo_list_user_tools to list all tools in the tools directory. "
                "Then pick one of the tools we just created and execute it with "
                "appropriate parameters."
            ),
            context=f"Tools directory: {tools_dir}",
            system_prompt=agent_system_prompt,
        )
        mission_results.append(
            {
                "mission": "List & Execute Tools",
                "success": True,
                "tools_created": m5["tools_created"],
            }
        )

        # ── PHASE 3: Verification ────────────────────────────────────────────

        header("PHASE 3: Verification & Summary")

        # Check what was created on disk
        tool_dirs = [d.name for d in tools_dir.iterdir() if d.is_dir()]
        show_result(
            "Tools created on disk",
            PASS if tool_dirs else WARN,
            f"{len(tool_dirs)} tool(s)",
        )
        for dir_name in sorted(tool_dirs):
            def_file = tools_dir / dir_name / "definition.yaml"
            show_result(
                f"  {dir_name}/definition.yaml",
                PASS if def_file.exists() else FAIL,
            )

        # Mission results
        print("\n  Mission Results:")
        for mr in mission_results:
            status = PASS if mr["success"] else WARN
            print(f"    {status}  {mr['mission']}")
            if mr["tools_created"]:
                print(f"       Created: {', '.join(mr['tools_created'])}")

        # Summary
        total_created = sum(len(mr["tools_created"]) for mr in mission_results)
        success_count = sum(1 for mr in mission_results if mr["success"])

        print("\n  Summary:")
        print(f"    {INFO}  Missions: {len(mission_results)}")
        print(f"    {INFO}  Successful: {success_count}")
        print(f"    {INFO}  Tools created: {total_created}")
        print(f"    {INFO}  Policy blocks enforced: {3 - success_count}")
        print(f"    {INFO}  Human approval invoked: ~{total_created} times")

        print("\n  Concepts Demonstrated:")
        print(f"    {PASS}  Real LangChain agent making autonomous decisions")
        print(f"    {PASS}  Policy engine validating tool definitions (PolicyConfig)")
        print(f"    {PASS}  Agent learning from policy rejections")
        print(f"    {PASS}  Human-in-the-loop approval workflow (HITL)")
        print(f"    {PASS}  Tool registry reloading after approval")
        print(f"    {PASS}  Tool execution after approval")
        print()

    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


if __name__ == "__main__":
    asyncio.run(main())
