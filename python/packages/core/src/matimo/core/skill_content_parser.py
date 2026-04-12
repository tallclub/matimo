"""
Skill Content Parser — Markdown heading-based section chunking.

Mirrors: packages/core/src/core/skill-content-parser.ts

Breaks skill bodies into structured sections so agents load only the parts
they need instead of dumping the entire SKILL.md into context.
"""
from __future__ import annotations

import math
import re
from dataclasses import dataclass, field

from matimo.core.models import SkillContentOptions, SkillSection


@dataclass
class ParsedSkillContent:
    """Result of parsing a skill body into sections."""

    preamble: str = ""
    preamble_tokens: int = 0
    sections: list[SkillSection] = field(default_factory=list)
    total_tokens: int = 0
    index: dict[str, SkillSection] = field(default_factory=dict)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_HEADING_RE = re.compile(r"^(#{1,6})\s+(.+)$")


def _parse_heading(line: str) -> tuple[int, str] | None:
    """Parse a Markdown ATX heading. Returns (level, text) or None."""
    if not line.startswith("#"):
        return None
    m = _HEADING_RE.match(line)
    if m is None:
        return None
    return len(m.group(1)), m.group(2).strip()


def _estimate_tokens(text: str) -> int:
    """Rough heuristic: 1 token ≈ 0.75 words for English text."""
    if not text:
        return 0
    word_count = len(text.split())
    return math.ceil(word_count / 0.75)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def parse_skill_sections(body: str) -> ParsedSkillContent:
    """
    Parse a Markdown skill body into a tree of sections.

    Lightweight heading-based parser that splits on ATX headings (``# …``).
    Handles fenced code blocks so that ``#`` inside code is not treated as a
    heading.
    """
    if not body or not body.strip():
        return ParsedSkillContent()

    lines = body.split("\n")
    index: dict[str, SkillSection] = {}

    # Gather raw segments
    segments: list[dict] = []
    current: dict | None = None
    preamble_lines: list[str] = []
    in_code_block = False

    for line in lines:
        stripped = line.lstrip()
        if stripped.startswith("```"):
            in_code_block = not in_code_block

        if not in_code_block:
            heading = _parse_heading(line)
            if heading is not None:
                if current is not None:
                    segments.append(current)
                current = {
                    "heading": heading[1],
                    "level": heading[0],
                    "content_lines": [],
                }
                continue

        if current is not None:
            current["content_lines"].append(line)
        else:
            preamble_lines.append(line)

    if current is not None:
        segments.append(current)

    preamble = "\n".join(preamble_lines).strip()
    preamble_tokens = _estimate_tokens(preamble)

    # Build tree from flat list using a stack
    top_sections: list[SkillSection] = []
    stack: list[SkillSection] = []

    for seg in segments:
        content = "\n".join(seg["content_lines"]).strip()
        section = SkillSection(
            heading=seg["heading"],
            level=seg["level"],
            content=content,
            token_estimate=_estimate_tokens(content) + _estimate_tokens(seg["heading"]),
            children=[],
            path=seg["heading"],
        )

        # Pop stack until we find a parent with a lower level
        while stack and stack[-1].level >= seg["level"]:
            stack.pop()

        if stack:
            parent = stack[-1]
            section.path = f"{parent.path}.{seg['heading']}"
            parent.children.append(section)
        else:
            top_sections.append(section)

        index[section.path.lower()] = section
        stack.append(section)

    # Calculate total tokens (recursive)
    def _total(s: SkillSection) -> int:
        return s.token_estimate + sum(_total(c) for c in s.children)

    total_tokens = preamble_tokens + sum(_total(s) for s in top_sections)

    return ParsedSkillContent(
        preamble=preamble,
        preamble_tokens=preamble_tokens,
        sections=top_sections,
        total_tokens=total_tokens,
        index=index,
    )


def extract_skill_content(
    parsed: ParsedSkillContent,
    options: SkillContentOptions | None = None,
) -> str:
    """
    Selectively extract content from a parsed skill body.

    Key function for context management — agents call this to get only the
    sections they need instead of the entire SKILL.md.
    """
    if options is None:
        options = SkillContentOptions()

    parts: list[str] = []
    current_tokens = 0

    def within_budget(additional: int) -> bool:
        if options.max_tokens is None:
            return True
        return current_tokens + additional <= options.max_tokens

    def render_section(section: SkillSection, depth: int) -> str:
        hashes = "#" * section.level
        result = f"{hashes} {section.heading}\n\n{section.content}"
        if options.max_depth is None or depth < options.max_depth:
            for child in section.children:
                result += "\n\n" + render_section(child, depth + 1)
        return result

    # Add preamble
    if options.include_preamble and parsed.preamble:
        tokens = parsed.preamble_tokens
        if within_budget(tokens):
            parts.append(parsed.preamble)
            current_tokens += tokens

    # If specific sections requested, find and include only those
    if options.sections:
        for requested in options.sections:
            lower = requested.lower()
            found = parsed.index.get(lower)
            if not found:
                # Partial match
                for key, section in parsed.index.items():
                    if lower in key:
                        found = section
                        break

            if found:
                rendered = render_section(found, 1)
                tokens = _estimate_tokens(rendered)
                if within_budget(tokens):
                    parts.append(rendered)
                    current_tokens += tokens
    else:
        # Include all sections
        for section in parsed.sections:
            rendered = render_section(section, 1)
            tokens = _estimate_tokens(rendered)
            if within_budget(tokens):
                parts.append(rendered)
                current_tokens += tokens
            else:
                break

    return "\n\n".join(parts)


def list_skill_sections(
    parsed: ParsedSkillContent,
) -> list[dict[str, object]]:
    """
    Get a flat list of all section headings with their token costs.
    Useful for agents to decide which sections to load.
    """
    result: list[dict[str, object]] = []

    def walk(section: SkillSection) -> None:
        result.append(
            {
                "path": section.path,
                "level": section.level,
                "token_estimate": section.token_estimate,
            }
        )
        for child in section.children:
            walk(child)

    for section in parsed.sections:
        walk(section)

    return result
