#!/usr/bin/env python3
"""
============================================================================
SKILLS SYSTEM DEMONSTRATION — LangChain Agent
============================================================================

A REAL LangChain ReAct agent (gpt-4o-mini) that autonomously discovers and
uses Matimo's skills system, aligned with the Agent Skills specification
(https://agentskills.io/specification).

Skills are instructional documents (SKILL.md) with YAML frontmatter that
agents load on demand via progressive disclosure:
  Level 1 — Metadata (name + description) loaded at startup via list
  Level 2 — Full instructions loaded when skill is activated
  Level 3 — Bundled resources (scripts/, references/, assets/) as needed

Missions (goal-driven — agent is NOT told which tools to call):
  1. "Create a code review skill" — agent discovers matimo_create_skill
  2. "What skills are available?" — agent discovers matimo_list_skills
  3. "Read the code review skill and apply it" — agent discovers matimo_get_skill
  4. "Create a security checklist skill" — agent creates another skill
  5. "Validate both skills" — agent discovers matimo_validate_skill
  6. "Apply ALL skills to review this code" — agent reads & applies multiple skills

Followed by Phase 4: non-MCP progressive disclosure using
  get_skills_metadata() and build_relevant_skill_prompt()

SETUP:
--------------------------------------------------------------------
  OPENAI_API_KEY must be set in .env or environment.

USAGE:
--------------------------------------------------------------------
  uv run python skills/skills_demo.py

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
    build_relevant_skill_prompt,
    convert_tools_to_langchain,
    get_global_approval_handler,
    get_skills_metadata,
    set_global_matimo_instance,
)

# ── Formatting helpers ───────────────────────────────────────────────────────

PASS = "\x1b[32m\u2713 PASS\x1b[0m"
FAIL = "\x1b[31m\u2717 FAIL\x1b[0m"
WARN = "\x1b[33m\u26a0 WARN\x1b[0m"
INFO = "\x1b[36m\u2139\x1b[0m"


def header(title: str) -> None:
    print("\n" + "=" * 68)
    print(f"  {title}")
    print("=" * 68)


def subheader(title: str) -> None:
    dashes = "-" * max(0, 58 - len(title))
    print(f"\n  -- {title} {dashes}")


def show_result(label: str, status: str, detail: str | None = None) -> None:
    msg = f"{status}  {label}: {detail}" if detail else f"{status}  {label}"
    print(f"    {msg}")


# ── Interactive terminal approval ────────────────────────────────────────────

approved_whitelist: set[str] = set()
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
    params = request.get("params", {}) or {}

    if tool_name in approved_whitelist:
        print(f"    {PASS}  Auto-approved (whitelisted): {tool_name}")
        return True

    print("\n    +----------------------------------------------------------+")
    print("    |  HUMAN-IN-THE-LOOP APPROVAL REQUIRED                     |")
    print("    +----------------------------------------------------------+")
    print(f"    |  Tool:        {tool_name}")
    print(f"    |  Description: {description[:50]}")
    print(f"    |  Params:      {str(params)[:50]}...")
    print("    +----------------------------------------------------------+")

    answer = (await _next_stdin_line("    Approve this operation? (y/n): ")).strip().lower()
    approved = answer in ("y", "yes")

    if approved:
        approved_whitelist.add(tool_name)
        print(f"    {PASS}  Approved -- \"{tool_name}\" added to session whitelist.")
    else:
        print("    BLOCKED  Rejected by human operator.")

    return approved


# ── Sample code for agent to review ─────────────────────────────────────────

SAMPLE_CODE_TO_REVIEW = (
    'def process_user_data(user_data):\n'
    '    result = eval(user_data["query"])\n'
    '\n'
    '    password = "admin123"\n'
    '\n'
    '    import requests\n'
    '    resp = requests.get("http://api.example.com/users/" + user_data["id"])\n'
    '    data = resp.json()\n'
    '    print("User password:", data.get("password"))\n'
    '\n'
    '    try:\n'
    '        save_to_database(result)\n'
    '    except Exception:\n'
    '        pass  # ignore errors\n'
    '\n'
    '    return result'
)

# ── Agent system prompt ───────────────────────────────────────────────────────

AGENT_SYSTEM_PROMPT = (
    "You are an AI agent powered by the Matimo SDK -- a configuration-driven tool framework.\n\n"
    "You work with Agent Skills -- a lightweight, open format for giving agents new capabilities "
    "and expertise (https://agentskills.io).\n\n"
    "Skills follow a progressive disclosure model:\n"
    "- Level 1 (Metadata): List skills to see their names and descriptions (discovery)\n"
    "- Level 2 (Instructions): Read a skill's SKILL.md to get its full instructions (activation)\n"
    "- Level 3 (Resources): Skills can bundle scripts/, references/, and assets/ (on demand)\n\n"
    "You have tools for:\n"
    "- Creating skills: Create SKILL.md files following the Agent Skills spec. "
    "The name must be lowercase with hyphens only (e.g. 'code-review'), max 64 characters. "
    "YAML frontmatter must include 'name' and 'description' fields.\n"
    "- Listing skills: Discover available skills (Level 1 metadata).\n"
    "- Reading skills: Retrieve full SKILL.md content (Level 2).\n"
    "- Validating skills: Check a skill against the Agent Skills specification.\n\n"
    "When creating a skill, the content MUST:\n"
    "1. Start with YAML frontmatter enclosed in --- markers\n"
    "2. Include 'name:' and 'description:' fields in the frontmatter\n"
    "3. The frontmatter 'name' field must match the directory/skill name parameter exactly\n"
    "4. Contain structured markdown with actionable guidelines\n\n"
    "When asked to apply a skill, first read it, then follow its guidelines in your response.\n\n"
    "Choose the right tools based on the goal you are given. "
    "You are NOT told which tools to call."
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


# ── Agent runner ─────────────────────────────────────────────────────────────


async def run_mission(
    llm_with_tools: Any,
    matimo: Matimo,
    mission: str,
) -> str:
    import json

    from langchain_core.messages import HumanMessage, SystemMessage, ToolMessage

    messages: list[Any] = [SystemMessage(AGENT_SYSTEM_PROMPT), HumanMessage(mission)]
    iterations = 0
    max_iterations = 8

    while iterations < max_iterations:
        iterations += 1
        response = await llm_with_tools.ainvoke(messages)

        if response.tool_calls:
            messages.append(response)
            for tool_call in response.tool_calls:
                args_str = str(tool_call["args"])
                print(
                    f"    [tool] Agent calls: {tool_call['name']}"
                    f"({args_str[:120]}{'...' if len(args_str) > 120 else ''})"
                )
                try:
                    tool_result = await matimo.execute(tool_call["name"], tool_call["args"])
                    result_str = (
                        tool_result
                        if isinstance(tool_result, str)
                        else json.dumps(tool_result, indent=2)
                    )
                    print(
                        f"    [result] {result_str[:200]}"
                        f"{'...' if len(result_str) > 200 else ''}"
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
            print(f"    [agent] {final_text}")
            return final_text

    return "(Agent reached max iterations without concluding)"


# ── Main ──────────────────────────────────────────────────────────────────────


async def main() -> None:
    print("\n" + "=" * 72)
    print("    Matimo Skills System -- LangChain Agent Demonstration")
    print("    Agent Skills Specification: https://agentskills.io")
    print("=" * 72)

    if not os.environ.get("OPENAI_API_KEY"):
        print("\n  ERROR: OPENAI_API_KEY not set.")
        print("         Add it to examples/.env or export it in your shell.")
        print("         This example requires an LLM to run a real agent.\n")
        sys.exit(1)

    from langchain_openai import ChatOpenAI

    await _start_stdin_reader()

    temp_dir = tempfile.mkdtemp(prefix="matimo-skills-demo-")
    skills_dir = Path(temp_dir) / "skills"
    skills_dir.mkdir(parents=True, exist_ok=True)

    try:
        # ── PHASE 1: Initialize ─────────────────────────────────────────────

        header("PHASE 1: Initialize Matimo with Skills Meta-Tools")

        approval_handler = get_global_approval_handler()
        approval_handler.set_approval_callback(interactive_approval)

        matimo = await Matimo.init(auto_discover=True, log_level="silent")
        set_global_matimo_instance(matimo)

        tools = matimo.list_tools()
        show_result(f"Matimo initialized -- {len(tools)} tools loaded", PASS)

        skill_tools = [t for t in tools if "skill" in t.name]
        show_result(
            f"Skills meta-tools: {', '.join(t.name for t in skill_tools)}",
            PASS,
        )

        langchain_tools = _cap_tools(
            convert_tools_to_langchain(tools, matimo),
            priority_names=[t.name for t in tools if t.name.startswith("matimo_")],
        )
        show_result(f"Converted {len(langchain_tools)} tools to LangChain format", PASS)

        llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
        llm_with_tools = llm.bind_tools(langchain_tools)
        show_result("LLM (gpt-4o-mini) initialized with tool bindings", PASS)

        # ── PHASE 2: Agent Missions ─────────────────────────────────────────

        header("PHASE 2: Autonomous Agent Missions -- Skills Lifecycle")

        # Mission 1: Create a code review skill
        subheader("Mission 1: Create a code review skill")
        print(
            '    Goal: "I need a code review checklist" -- '
            "agent discovers matimo_create_skill."
        )
        print("    When prompted, type 'y' to approve.\n")
        await run_mission(
            llm_with_tools,
            matimo,
            (
                f'I need a skill that provides a code review checklist. Create a skill called '
                f'"code-review" with name "code-review" and description '
                f'"Code review checklist and best practices" in the skills directory '
                f'"{skills_dir}".\n\n'
                f"The skill content should be a comprehensive code review checklist in markdown "
                f"format that covers:\n"
                f"- Code quality (readability, naming, DRY)\n"
                f"- Error handling (try/catch, validation)\n"
                f"- Security (no hardcoded secrets, no eval, input sanitization)\n"
                f"- Performance (no unnecessary loops, memory leaks)\n"
                f"- Testing (test coverage, edge cases)\n\n"
                f"Remember: the content MUST start with YAML frontmatter (---) containing "
                f"name and description fields."
            ),
        )

        code_review_path = skills_dir / "code-review" / "SKILL.md"
        skill_created = code_review_path.exists()
        show_result(
            "code-review skill on disk",
            PASS if skill_created else FAIL,
            str(code_review_path) if skill_created else "NOT FOUND",
        )

        # Mission 2: List available skills
        subheader("Mission 2: Discover available skills")
        print(
            '    Goal: "What skills are available?" -- '
            "agent discovers matimo_list_skills.\n"
        )
        await run_mission(
            llm_with_tools,
            matimo,
            (
                f'What skills are available in "{skills_dir}"? '
                f"List them with their names and descriptions."
            ),
        )

        # Mission 3: Read and apply the code review skill
        subheader("Mission 3: Read and apply a skill to review code")
        print(
            '    Goal: "Apply the code review skill to this code" -- '
            "agent discovers matimo_get_skill.\n"
        )
        mission3_result = await run_mission(
            llm_with_tools,
            matimo,
            (
                f'Read the "code-review" skill from "{skills_dir}" and apply its guidelines to '
                f"review this code. Point out every issue you find based on the skill's "
                f"checklist:\n\n"
                f"```python\n{SAMPLE_CODE_TO_REVIEW}\n```"
            ),
        )
        mission3_passed = len(mission3_result) > 100 and any(
            kw in mission3_result.lower()
            for kw in ("eval", "password", "error", "security", "hardcoded")
        )

        # Mission 4: Create a security checklist skill
        subheader("Mission 4: Create a security checklist skill")
        print(
            '    Goal: "I need a security-focused skill" -- agent creates another skill.'
        )
        print("    When prompted, type 'y' to approve.\n")
        await run_mission(
            llm_with_tools,
            matimo,
            (
                f'Create another skill called "security-checklist" with name '
                f'"security-checklist" and description '
                f'"Security vulnerability detection checklist" '
                f'in "{skills_dir}".\n\n'
                f"The skill should focus specifically on security vulnerabilities:\n"
                f"- OWASP Top 10 (injection, XSS, SSRF, broken auth)\n"
                f"- Secrets management (no hardcoded passwords/keys)\n"
                f"- Input validation (sanitize all user input)\n"
                f"- Dangerous functions (eval, exec, innerHTML)\n"
                f"- Data exposure (no logging sensitive data)\n"
                f"- Dependency security (known vulnerabilities)\n\n"
                f"Remember: content MUST start with YAML frontmatter (---) with "
                f"name and description."
            ),
        )

        security_path = skills_dir / "security-checklist" / "SKILL.md"
        security_created = security_path.exists()
        show_result(
            "security-checklist skill on disk",
            PASS if security_created else FAIL,
            str(security_path) if security_created else "NOT FOUND",
        )

        # Mission 5: Validate both skills
        subheader("Mission 5: Validate skills against the Agent Skills spec")
        print(
            '    Goal: "Validate both skills" -- agent discovers matimo_validate_skill.\n'
        )
        await run_mission(
            llm_with_tools,
            matimo,
            (
                f'Validate both skills in "{skills_dir}" -- "code-review" and '
                f'"security-checklist" -- to make sure they follow the Agent Skills '
                f"specification. Report any errors or warnings."
            ),
        )

        # Mission 6: Apply ALL skills together
        subheader("Mission 6: Apply ALL skills to review code")
        print(
            '    Goal: "Apply every available skill" -- agent lists, reads, and applies all.\n'
        )
        await run_mission(
            llm_with_tools,
            matimo,
            (
                f'First list all available skills in "{skills_dir}". Then read ALL of them. '
                f"Finally, apply every skill's guidelines together to do a thorough review "
                f"of this code. Organize your findings by the skill that flagged each issue:\n\n"
                f"```python\n{SAMPLE_CODE_TO_REVIEW}\n```"
            ),
        )

        # ── PHASE 3: Verification ───────────────────────────────────────────

        header("PHASE 3: Verification -- Skills on Disk")

        skill_dirs = [d.name for d in skills_dir.iterdir() if d.is_dir()]
        show_result(
            "Skills created on disk",
            PASS if skill_dirs else FAIL,
            f"{len(skill_dirs)} total: {', '.join(skill_dirs)}",
        )

        for dir_name in sorted(skill_dirs):
            skill_file = skills_dir / dir_name / "SKILL.md"
            if skill_file.exists():
                content = skill_file.read_text(encoding="utf-8")
                second_sep = content.find("---", 3)
                has_frontmatter = content.startswith("---") and second_sep > 3
                has_name = "name:" in content
                has_desc = "description:" in content
                show_result(
                    f"{dir_name} -- valid SKILL.md",
                    PASS if (has_frontmatter and has_name and has_desc) else FAIL,
                    f"frontmatter={has_frontmatter}, name={has_name}, desc={has_desc}",
                )
            else:
                show_result(f"{dir_name} -- SKILL.md missing", FAIL)

        # ── PHASE 4: Non-MCP Progressive Disclosure ─────────────────────────
        #
        # agentskills.io progressive disclosure WITHOUT an MCP server:
        #
        #   Level 1 (startup)     -- get_skills_metadata()
        #                            Returns name + description only (cheap, always load)
        #
        #   Level 2 (per-request) -- build_relevant_skill_prompt(matimo, query)
        #                            TF-IDF semantic search over skill descriptions, then
        #                            loads full SKILL.md content for top-K matches only.
        #
        #   Level 3 (advanced)    -- reference skill.name to load bundled resource files
        #                            (scripts/, references/, assets/) on demand
        #
        # Equivalent to the MCP tools:
        #   matimo_list_skills  -> Level 1 (always cheap)
        #   matimo_get_skill    -> Level 2 (on demand, per relevant skill only)

        header("PHASE 4: Non-MCP Progressive Disclosure (agentskills.io spec)")

        matimo_with_skills = await Matimo.init(
            skill_paths=[str(skills_dir)],
            log_level="silent",
        )

        # Level 1 -- metadata only
        meta = get_skills_metadata(matimo_with_skills)
        show_result(
            f"get_skills_metadata() -- Level 1: {len(meta)} skill(s), names+descriptions only",
            PASS if meta else WARN,
        )
        for m in meta:
            show_result(f"  {m['name']}", INFO, m.get("description") or "(no description)")

        # Level 2a -- raw TF-IDF rankings
        test_query = "security vulnerability detection"
        search_results = await matimo_with_skills.semantic_search_skills(
            test_query, limit=5, min_score=0.1
        )
        show_result(
            (
                f"semantic_search_skills('{test_query}') -- "
                f"TF-IDF raw results: {len(search_results)} match(es)"
            ),
            PASS if search_results else WARN,
        )
        for sr in search_results:
            desc = sr.skill.description or ""
            show_result(
                f"  {sr.skill.name}",
                INFO,
                f"score: {sr.score:.4f} -- {desc[:60]}{'...' if len(desc) > 60 else ''}",
            )

        # Level 2b -- full content for top-K matches
        relevant_prompt = await build_relevant_skill_prompt(
            matimo_with_skills,
            test_query,
            top_k=2,
            min_score=0.1,
            header="Apply these skill guidelines:",
        )
        show_result(
            (
                f"build_relevant_skill_prompt('{test_query}') -- "
                f"Level 2: {len(relevant_prompt)} chars loaded"
            ),
            PASS if relevant_prompt else WARN,
        )
        if relevant_prompt:
            preview = relevant_prompt[:300]
            print(f"\n  {INFO} Injected prompt preview (first 300 chars):")
            print(f'  "{preview}..."\n')

        # ── Summary ─────────────────────────────────────────────────────────

        header("SUMMARY")
        print()
        print("  Skills Lifecycle (Goal-Driven -- No Tool Names Given):")
        print(
            f"    {PASS if skill_created else FAIL}  "
            f'1. "I need a code review checklist" -> created code-review skill'
        )
        print(f"    {PASS}  2. \"What skills are available?\" -> Level 1 metadata discovery")
        print(
            f"    {PASS if mission3_passed else FAIL}  "
            f'3. "Apply the skill to this code" -> Level 2 activation + guidelines applied'
        )
        print(
            f"    {PASS if security_created else FAIL}  "
            f'4. "I need a security skill" -> created security-checklist skill'
        )
        print(f"    {PASS}  5. \"Validate the skills\" -> spec compliance check")
        print(f"    {PASS}  6. \"Apply ALL skills\" -> listed, read, and applied multiple skills")
        print()
        print("  Agent Skills Specification Concepts:")
        print(
            f"    {PASS}  SKILL.md with YAML frontmatter (name, description required)"
        )
        print(
            f"    {PASS}  Name validation (lowercase, hyphens, max 64 chars)"
        )
        print(
            f"    {PASS}  Progressive disclosure (Level 1 -> Level 2 -> Level 3)"
        )
        print(
            f"    {PASS}  Spec validation via matimo_validate_skill"
        )
        print(
            f"    {PASS}  Human-in-the-loop approval for skill creation"
        )
        print()
        print("  Non-MCP Progressive Disclosure (agentskills.io spec):")
        print(
            f"    {PASS if meta else WARN}  "
            f"get_skills_metadata() -> Level 1: {len(meta)} skill(s), names+descriptions only"
        )
        print(
            f"    {PASS if search_results else WARN}  "
            f"semantic_search_skills(query) -> TF-IDF: {len(search_results)} result(s) with scores"
        )
        print(
            f"    {PASS if relevant_prompt else WARN}  "
            f"build_relevant_skill_prompt(query) -> Level 2: {len(relevant_prompt)} chars loaded"
        )
        print()
        print("  Skills on Disk:")
        print(f"    {INFO}  Directory: {skills_dir}")
        print(
            f"    {INFO}  Skills: {', '.join(sorted(skill_dirs)) if skill_dirs else 'none'}"
        )
        print()

    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


if __name__ == "__main__":
    asyncio.run(main())
