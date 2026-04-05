#!/usr/bin/env python3
"""
============================================================================
SKILLS DEMO — KNOWLEDGE LAYER
============================================================================

PATTERN: Skills as Reusable Knowledge Modules
────────────────────────────────────────────────────────────────────────────
Demonstrates how Skills (SKILL.md files with YAML frontmatter) provide
domain-specific knowledge that helps agents reason and make better decisions.

Skills are NOT tools — they're documentation that teaches the agent:
- What domain expertise exists (e.g., "data analysis", "DevOps", "security")
- How to approach complex problems
- Best practices and patterns
- When to use which tools

This allows you to organize knowledge separately from tool definitions.

SETUP:
────────────────────────────────────────────────────────────────────────────
  No API keys required. Uses skill discovery and display.

USAGE:
────────────────────────────────────────────────────────────────────────────
  uv run python skills/skills_demo.py

============================================================================
"""

import asyncio
from pathlib import Path
from dotenv import load_dotenv

from matimo import Matimo

load_dotenv(Path(__file__).parent.parent.parent / ".env")


# Sample skills manifest (normally discovered from disk)
SAMPLE_SKILLS = {
    "data-analysis": {
        "domain": "Data Processing",
        "description": "Statistical analysis and data transformation",
        "tools": ["search", "read", "execute"],
        "keywords": ["analytics", "statistics", "pandas", "numpy"],
        "expertise_level": "advanced",
    },
    "devops-deployment": {
        "domain": "Infrastructure",
        "description": "Deploy applications and manage infrastructure",
        "tools": ["execute", "web"],
        "keywords": ["docker", "kubernetes", "terraform", "ci/cd"],
        "expertise_level": "expert",
    },
    "security-scanning": {
        "domain": "Security",
        "description": "Security analysis and vulnerability detection",
        "tools": ["search", "execute"],
        "keywords": ["vulnerability", "scan", "audit", "compliance"],
        "expertise_level": "expert",
    },
    "web-scraping": {
        "domain": "Data Collection",
        "description": "Extract data from web pages",
        "tools": ["web", "search"],
        "keywords": ["scrape", "crawl", "html", "parse"],
        "expertise_level": "intermediate",
    },
}


def format_skill(skill_name: str, skill_info: dict) -> str:
    """Format skill information for display."""
    return f"""
{'─' * 60}
📚 SKILL: {skill_name}
Domain: {skill_info.get('domain')}
Expertise: {skill_info.get('expertise_level', 'N/A').upper()}
{'─' * 60}

Description:
  {skill_info.get('description')}

Related Tools:
{chr(10).join(f"  • {tool}" for tool in skill_info.get('tools', []))}

Keywords:
  {', '.join(skill_info.get('keywords', []))}
"""


async def main() -> None:
    print("\n╔════════════════════════════════════════════════════════╗")
    print("║     Skills Demo — Knowledge Layer Discovery           ║")
    print("╚════════════════════════════════════════════════════════╝\n")

    # ── Initialize Matimo ─────────────────────────────────────────────────────
    print("🚀  Initializing Matimo…")
    matimo = await Matimo.init(auto_discover=True)
    all_tools = matimo.list_tools()
    print(f"✅  Loaded {len(all_tools)} tools\n")

    # ── Display available skills ──────────────────────────────────────────────
    print("📋  Available Skills\n")
    for skill_name, skill_info in SAMPLE_SKILLS.items():
        print(format_skill(skill_name, skill_info))

    # ── Show skills by domain ─────────────────────────────────────────────────
    print("\n" + "=" * 60)
    print("🏷️  Skills Organized by Domain")
    print("=" * 60)

    domains = {}
    for skill_name, skill_info in SAMPLE_SKILLS.items():
        domain = skill_info.get("domain")
        if domain not in domains:
            domains[domain] = []
        domains[domain].append({
            "name": skill_name,
            "level": skill_info.get("expertise_level", "N/A"),
        })

    for domain, skills in sorted(domains.items()):
        print(f"\n📁  {domain}")
        for skill in skills:
            level_emoji = {
                "beginner": "🟡",
                "intermediate": "🟠",
                "advanced": "🔴",
                "expert": "🔴🔴",
            }.get(skill["level"], "⚪")
            print(f"   {level_emoji} {skill['name']}")

    # ── Show tool-to-skill mapping ────────────────────────────────────────────
    print("\n" + "=" * 60)
    print("🔧  Tools by Skill Support")
    print("=" * 60)

    tool_skills = {}
    for skill_name, skill_info in SAMPLE_SKILLS.items():
        for tool in skill_info.get("tools", []):
            if tool not in tool_skills:
                tool_skills[tool] = []
            tool_skills[tool].append(skill_name)

    for tool_name in sorted(tool_skills.keys()):
        skills = tool_skills[tool_name]
        print(f"\n🔨 {tool_name}")
        for skill in skills:
            print(f"   → {skill}")

    # ── Show potential workflow ───────────────────────────────────────────────
    print("\n" + "=" * 60)
    print("🚀  Example Workflow: Data Analysis Task")
    print("=" * 60)
    print("""
Task: "Analyze web traffic logs and identify suspicious IPs"

Agent Decision Process:
  1. User query understood: Data analysis + Security concern
  
  2. Skills discovered:
     • data-analysis (Statistical analysis)
     • security-scanning (Vulnerability detection)
  
  3. Skills recommend tools:
     • search (find log files)
     • read (load log data)
     • execute (run analysis scripts)
  
  4. Agent combines knowledge:
     • Use search to find relevant logs
     • Read log files
     • Execute security scanning scripts
     • Analyze patterns for suspicious activity
  
  5. Result: Comprehensive security analysis

Without skills, agent might miss that this is BOTH
a data analysis task AND a security task.
""")

    print("=" * 60)
    print("✨  Key Takeaways")
    print("=" * 60)
    print("""
✓ Skills provide domain-specific guidance
✓ Help agents understand tool purpose and context
✓ Enable better decision-making for complex tasks
✓ Organize knowledge separately from tool definitions
✓ Promote code reuse and consistency
✓ Make it easy to add new expertise areas
""")


if __name__ == "__main__":
    asyncio.run(main())
