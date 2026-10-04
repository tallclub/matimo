#!/usr/bin/env python3
"""
============================================================================
SKILLS FROM ANYWHERE — register, mount, select and observe skills
============================================================================

Skills don't have to live next to your code:
  1. register_skill()          — push a skill fetched from a database or API
  2. add_skill_path() + reload_skills() — mount another directory at runtime
  3. get_skill_sections() / get_skill_content(SkillContentOptions(sections=...))
                               — load only the part of a skill a task needs
  4. build_skill_prompt_context() — pick the skills relevant to a request and
                               format them for a system prompt
  5. default_skill_write_dir + the `skill:created` event — decide where an
     agent's new skills are written, and hear about each one

No API keys needed. Mirrors skills-registry-demo.ts.

USAGE:
  uv run python native/skills/skills_registry_demo.py
============================================================================
"""

from __future__ import annotations

import asyncio
import shutil
import tempfile
from pathlib import Path
from typing import Any

from matimo import (
    ApprovalRequest,
    Matimo,
    SkillContentOptions,
    SkillDefinition,
    set_global_matimo_instance,
)

# A skill as it might come back from your own storage.
REFUND_SKILL = SkillDefinition(
    name="refund-policy",
    description="How to decide and issue customer refunds within policy limits.",
    body="""# Refund policy

## Eligibility
Refund within 30 days of purchase when the item is unused.

## Limits
Agents may refund up to 200 USD. Anything above needs a manager.

## Issuing the refund
Always refund to the original payment method and log the ticket id.
""",
    source="user",
)

SHIPPING_SKILL_MD = """---
name: shipping-delays
description: What to tell customers when an order ships late.
---
# Shipping delays

## Apologise and give a date
Apologise once, then give the new delivery date from the carrier.

## Compensation
Offer free shipping on the next order for delays over five days.
"""

NEW_SKILL_MD = """---
name: escalation-contacts
description: Who to escalate billing, legal and security issues to.
---
# Escalation contacts

## Billing
billing-oncall@example.com
"""


async def approve(request: ApprovalRequest) -> bool:
    """matimo_create_skill declares requires_approval: true."""
    print(f"   🔒 approving {request.tool_name}")
    return True


def on_event(event: dict[str, Any]) -> None:
    if event["type"] == "skill:created":
        print(f"   📣 skill:created {event['skill_name']} (source: {event['source']})")


async def main() -> None:
    work_dir = Path(tempfile.mkdtemp(prefix="matimo-skills-"))
    mounted_dir = work_dir / "mounted"
    (mounted_dir / "shipping-delays").mkdir(parents=True)
    (mounted_dir / "shipping-delays" / "SKILL.md").write_text(SHIPPING_SKILL_MD)
    write_dir = work_dir / "agent-skills"

    try:
        matimo = await Matimo.init(
            auto_discover=True,
            log_level="silent",
            default_skill_write_dir=str(write_dir),
            on_event=on_event,
            on_approval=approve,
        )
        # Meta-tools such as matimo_create_skill act on the global instance.
        set_global_matimo_instance(matimo)

        print("\n1. register_skill(): a skill from your own storage")
        matimo.register_skill(REFUND_SKILL)
        print(f"   registered: {matimo.get_skill('refund-policy').name}")  # type: ignore[union-attr]

        print("\n2. add_skill_path() + reload_skills(): mount a directory at runtime")
        matimo.add_skill_path(str(mounted_dir))
        reloaded = await matimo.reload_skills()
        # loaded/removed count names added and dropped; registered skills are dropped.
        print(
            f"   reload_skills() → {reloaded}, {len(matimo.list_skills())} skills now"
        )
        print(
            f"   shipping-delays loaded: {matimo.get_skill('shipping-delays') is not None}"
        )
        # reload_skills() re-reads skill paths only; registered skills are pushed again.
        matimo.register_skill(REFUND_SKILL)

        print("\n3. Load only what the task needs")
        for section in matimo.get_skill_sections("refund-policy") or []:
            print(f"   § {section['path']} (~{section['token_estimate']} tokens)")
        limits = matimo.get_skill_content(
            "refund-policy",
            SkillContentOptions(sections=["Limits"], include_preamble=False),
        )
        print(f"   Limits section only:\n{limits}\n")

        print("4. build_skill_prompt_context(): relevant skills for a request")
        # TF-IDF matching: the request should share words with the skill.
        context = await matimo.build_skill_prompt_context(
            "Can I refund this customer 150 USD, or is that over the limit?", top_k=1
        )
        print("\n".join(context.split("\n")[:6]))

        print("\n5. An agent creates a skill: default_skill_write_dir + skill:created")
        await matimo.execute(
            "matimo_create_skill",
            {"name": "escalation-contacts", "content": NEW_SKILL_MD},
        )
        print(f"   written to: {write_dir.relative_to(work_dir)}/")
        print(f"   files: {', '.join(sorted(p.name for p in write_dir.iterdir()))}\n")
    finally:
        shutil.rmtree(work_dir, ignore_errors=True)


if __name__ == "__main__":
    asyncio.run(main())
