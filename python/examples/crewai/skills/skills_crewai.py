#!/usr/bin/env python3
"""
============================================================================
SKILLS SYSTEM — CREWAI CREW
============================================================================

PATTERN: CrewAI Crew with skill-aware backstory + skill meta-tools
────────────────────────────────────────────────────────────────────────────
Demonstrates the CrewAI-side skill helpers added in
matimo.integrations.crewai (mirroring the LangChain equivalents):

  - get_skills_metadata()        — Level 1: names + descriptions, no I/O
  - build_relevant_skill_prompt() — Level 2: TF-IDF semantic search, injects
                                     the top-matching skill(s) into the
                                     agent's backstory before the crew runs

...and the 3 new skill meta-tools — matimo_search_skills,
matimo_get_skill_sections, matimo_get_skill_content — bound to the agent as
CrewAI tools via convert_tools_to_crewai(), so the agent can *also*
autonomously search/inspect/load skills mid-task instead of relying only on
the backstory injection done up front.

Skills here are registered directly via matimo.register_skill() (Phase 1's
"storage can be anywhere" API — see docs/skills/SKILLS.md's "Pluggable
Skill Storage" section) rather than read from disk, so the example needs no
temp directory and no matimo_create_skill call.

Use this pattern when:
  ✅ You want a CrewAI agent whose backstory carries pre-loaded domain
     knowledge (Level 2) instead of discovering it fresh via tool calls
  ✅ You also want the agent free to search for *other* skills at runtime
  ✅ Skills live in your own storage (DB, API, ...) and are pushed in
     directly rather than read from Matimo's default skill directories

SETUP:
────────────────────────────────────────────────────────────────────────────
  Set in .env:
    OPENAI_API_KEY=sk-…

USAGE:
────────────────────────────────────────────────────────────────────────────
  make skills-crewai
  # or with a custom task:
  uv run python skills/skills_crewai.py "How should I handle Slack rate limits?"

============================================================================
"""

import asyncio
import os
import sys
from pathlib import Path

from crewai import Agent, Crew, Process, Task
from dotenv import load_dotenv

from matimo import Matimo, SkillDefinition, set_global_matimo_instance
from matimo.integrations.crewai import (
    build_relevant_skill_prompt,
    convert_tools_to_crewai,
    get_skills_metadata,
)

load_dotenv(Path(__file__).parent.parent.parent / ".env")

DEFAULT_TASK = (
    "I'm about to call a rate-limited API repeatedly. Using matimo_search_skills, find "
    "the skill most relevant to that concern, inspect its sections with "
    "matimo_get_skill_sections, then load the most relevant section with "
    "matimo_get_skill_content and summarize the guidance in 2-3 sentences."
)

# Pre-authored skills pushed straight into the running instance — the same
# "storage can be anywhere" pattern documented for Postgres/S3/Mongo in
# docs/skills/SKILLS.md, using plain in-memory data here to keep the example
# self-contained.
SEED_SKILLS = [
    SkillDefinition(
        name="api-rate-limiting",
        description="Guidance for handling API rate limits and retries safely.",
        body=(
            "# API Rate Limiting\n\n"
            "## Key Guidance\n"
            "- Respect `Retry-After` headers when a 429 is returned.\n"
            "- Use exponential backoff with jitter between retries.\n"
            "- Cache responses where possible to reduce call volume.\n"
            "- Never retry indefinitely — cap attempts and surface a clear error.\n"
        ),
    ),
    SkillDefinition(
        name="error-handling",
        description="Guidance for structured error handling and logging.",
        body=(
            "# Error Handling\n\n"
            "## Key Guidance\n"
            "- Never swallow exceptions silently.\n"
            "- Log enough context to reproduce the failure.\n"
            "- Fail fast on programmer errors, retry on transient ones.\n"
        ),
    ),
]


async def run(task: str) -> None:
    print("\n╔════════════════════════════════════════════════════════╗")
    print("║     Skills System — CrewAI Crew                        ║")
    print("╚════════════════════════════════════════════════════════╝\n")

    if not os.environ.get("OPENAI_API_KEY"):
        print("❌  OpenAI API key (OPENAI_API_KEY) not set in .env")
        sys.exit(1)

    # ── 1. Initialise Matimo and register skills directly (no filesystem) ────
    print("🚀  Initialising Matimo…")
    matimo = await Matimo.init(auto_discover=True, log_level="silent")
    matimo.register_skills(SEED_SKILLS)

    # matimo_search_skills / matimo_get_skill_sections / matimo_get_skill_content
    # resolve their Matimo instance via get_global_matimo_instance() rather than
    # whichever instance convert_tools_to_crewai() was called with below — see
    # examples/native/skills/skills_demo.py for the same requirement.
    set_global_matimo_instance(matimo)

    meta = get_skills_metadata(matimo)
    print(f"✅  {len(meta)} skill(s) registered: {', '.join(m['name'] for m in meta)}\n")

    # ── 2. Level 2 — inject the most relevant skill into the agent's backstory ─
    skill_context = await build_relevant_skill_prompt(
        matimo, task, top_k=1, min_score=0.1
    )
    print(f"📚  Skill context injected into backstory ({len(skill_context)} chars)\n")

    # ── 3. Bind the 3 new skill meta-tools so the agent can search/inspect/load
    #       skills itself, on top of the backstory injection above ────────────
    skill_tools = [
        t
        for t in matimo.list_tools()
        if t.name
        in ("matimo_search_skills", "matimo_get_skill_sections", "matimo_get_skill_content")
    ]
    crewai_tools = convert_tools_to_crewai(skill_tools, matimo)
    print(f"🔧  {len(crewai_tools)} skill meta-tools ready: {[t.name for t in crewai_tools]}\n")

    # ── 4. Build Agent + Task + Crew ─────────────────────────────────────────
    base_backstory = (
        "You are a careful engineering assistant who always checks for relevant "
        "internal guidance before answering, and prefers looking things up over guessing."
    )
    agent = Agent(
        role="Skills Research Assistant",
        goal="Ground every answer in the most relevant available skill guidance.",
        backstory=f"{base_backstory}\n\n{skill_context}" if skill_context else base_backstory,
        llm="gpt-4o-mini",
        tools=crewai_tools,
        verbose=True,
    )

    crew_task = Task(
        description=task,
        agent=agent,
        expected_output="A short summary of the relevant skill's guidance.",
    )

    crew = Crew(
        agents=[agent],
        tasks=[crew_task],
        process=Process.sequential,
        verbose=True,
    )

    # ── 5. Run crew (kickoff is synchronous — wrap in executor) ───────────────
    print(f"🎯  Task: {task}\n")
    print("─" * 60)

    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(None, crew.kickoff)

    print("\n" + "─" * 60)
    print(f"\n✨  Crew result:\n{result}\n")


def main() -> None:
    task = " ".join(sys.argv[1:]) if len(sys.argv) > 1 else DEFAULT_TASK
    asyncio.run(run(task))


if __name__ == "__main__":
    main()
