/**
 * Skill Content Parser — Markdown AST-based section chunking
 *
 * Breaks skill bodies into structured sections so agents load only the parts
 * they need instead of dumping the entire SKILL.md into context.
 *
 * Uses lightweight heading-based parsing (no external Markdown AST library
 * needed) to produce a tree of sections with token-count estimates.
 */

/**
 * A single section of a skill body, parsed from Markdown headings.
 */
export interface SkillSection {
  /** Heading text (e.g., "Error Handling") */
  heading: string;
  /** Heading level (1-6) */
  level: number;
  /** Raw Markdown content under this heading (excluding sub-headings) */
  content: string;
  /** Approximate token count (words ÷ 0.75 — conservative estimate) */
  tokenEstimate: number;
  /** Nested sub-sections */
  children: SkillSection[];
  /** Dot-path for addressing (e.g., "Error Handling.Rate Limits") */
  path: string;
}

/**
 * Result of parsing a skill body into sections.
 */
export interface ParsedSkillContent {
  /** Top-level intro content before any heading */
  preamble: string;
  /** Token estimate for preamble */
  preambleTokens: number;
  /** All top-level sections (with nested children) */
  sections: SkillSection[];
  /** Total token estimate for the entire body */
  totalTokens: number;
  /** Flat index: heading path → section reference (for fast lookup) */
  index: Map<string, SkillSection>;
}

/**
 * Options for retrieving skill content with selective loading.
 */
export interface SkillContentOptions {
  /** Only return sections matching these heading paths (case-insensitive partial match) */
  sections?: string[];
  /** Maximum total tokens to return (truncates from the end) */
  maxTokens?: number;
  /** Include the preamble (default: true) */
  includePreamble?: boolean;
  /** Depth limit for section inclusion (1 = top-level only, 2 = include children, etc.) */
  maxDepth?: number;
}

// ─── Helper: Check if line is a Markdown heading using safe string operations ─────────
// Avoids regex to prevent ReDoS on malicious input with many spaces
function parseHeading(line: string): { level: number; heading: string } | null {
  if (!line.startsWith('#')) return null;

  let level = 0;
  for (let i = 0; i < Math.min(6, line.length); i++) {
    if (line[i] === '#') level++;
    else break;
  }

  if (level === 0 || level > 6) return null;

  // Check that after the hashes, there's whitespace
  if (level >= line.length || !/\s/.test(line[level])) return null;

  // Extract heading text after the hashes and skip leading whitespace
  const heading = line.substring(level).trimStart();
  return { level, heading };
}

/**
 * Estimate token count from text.
 * Rough heuristic: 1 token ≈ 0.75 words for English text.
 * Conservative to avoid under-counting.
 */
function estimateTokens(text: string): number {
  if (!text) return 0;
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  return Math.ceil(wordCount / 0.75);
}

/**
 * Parse a Markdown skill body into a tree of sections.
 *
 * This is a lightweight parser that splits on ATX headings (lines starting
 * with #). It does NOT handle:
 * - Setext headings (underline style)
 * - Headings inside code blocks (these are treated as content)
 *
 * For SKILL.md files (which follow a consistent format), this is sufficient.
 */
export function parseSkillSections(body: string): ParsedSkillContent {
  if (!body || body.trim().length === 0) {
    return {
      preamble: '',
      preambleTokens: 0,
      sections: [],
      totalTokens: 0,
      index: new Map(),
    };
  }

  const lines = body.split('\n');
  const index = new Map<string, SkillSection>();

  // Collect raw segments: [{heading, level, contentLines}]
  interface RawSegment {
    heading: string;
    level: number;
    contentLines: string[];
  }

  const segments: RawSegment[] = [];
  let currentSegment: RawSegment | null = null;
  const preambleLines: string[] = [];
  let inCodeBlock = false;

  for (const line of lines) {
    // Track fenced code blocks to avoid treating # inside them as headings
    if (line.trimStart().startsWith('```')) {
      inCodeBlock = !inCodeBlock;
    }

    if (!inCodeBlock) {
      const headingMatch = parseHeading(line);
      if (headingMatch) {
        // Flush previous segment
        if (currentSegment) {
          segments.push(currentSegment);
        }
        currentSegment = {
          heading: headingMatch.heading,
          level: headingMatch.level,
          contentLines: [],
        };
        continue;
      }
    }

    if (currentSegment) {
      currentSegment.contentLines.push(line);
    } else {
      preambleLines.push(line);
    }
  }

  // Flush last segment
  if (currentSegment) {
    segments.push(currentSegment);
  }

  const preamble = preambleLines.join('\n').trim();
  const preambleTokens = estimateTokens(preamble);

  // Build tree from flat list of segments using a stack
  const topSections: SkillSection[] = [];
  const stack: SkillSection[] = [];

  for (const seg of segments) {
    const content = seg.contentLines.join('\n').trim();
    const section: SkillSection = {
      heading: seg.heading,
      level: seg.level,
      content,
      tokenEstimate: estimateTokens(content) + estimateTokens(seg.heading),
      children: [],
      path: seg.heading,
    };

    // Pop stack until we find a parent with a lower level
    while (stack.length > 0 && stack[stack.length - 1].level >= seg.level) {
      stack.pop();
    }

    if (stack.length > 0) {
      const parent = stack[stack.length - 1];
      section.path = `${parent.path}.${seg.heading}`;
      parent.children.push(section);
    } else {
      topSections.push(section);
    }

    index.set(section.path.toLowerCase(), section);
    stack.push(section);
  }

  // Calculate total tokens (recursive)
  function totalTokensOf(section: SkillSection): number {
    return section.tokenEstimate + section.children.reduce((sum, c) => sum + totalTokensOf(c), 0);
  }

  const totalTokens = preambleTokens + topSections.reduce((sum, s) => sum + totalTokensOf(s), 0);

  return {
    preamble,
    preambleTokens,
    sections: topSections,
    totalTokens,
    index,
  };
}

/**
 * Selectively extract content from a parsed skill body.
 *
 * This is the key function for context management — instead of dumping the
 * entire SKILL.md into the LLM's context window, agents call this to get
 * only the sections they need.
 *
 * @example
 * // Get only the error handling section
 * extractSkillContent(parsed, { sections: ['Error Handling'] })
 *
 * @example
 * // Get top-level overview only (no sub-sections), max 500 tokens
 * extractSkillContent(parsed, { maxDepth: 1, maxTokens: 500 })
 */
export function extractSkillContent(
  parsed: ParsedSkillContent,
  options: SkillContentOptions = {}
): string {
  const { sections: requestedSections, maxTokens, includePreamble = true, maxDepth } = options;

  const parts: string[] = [];
  let currentTokens = 0;

  // Helper: check if we've exceeded the token budget
  function withinBudget(additional: number): boolean {
    if (maxTokens === undefined) return true;
    return currentTokens + additional <= maxTokens;
  }

  // Helper: render a section to Markdown
  function renderSection(section: SkillSection, depth: number): string {
    const hashes = '#'.repeat(section.level);
    let result = `${hashes} ${section.heading}\n\n${section.content}`;

    if (maxDepth === undefined || depth < maxDepth) {
      for (const child of section.children) {
        result += '\n\n' + renderSection(child, depth + 1);
      }
    }

    return result;
  }

  // Add preamble
  if (includePreamble && parsed.preamble) {
    const tokens = parsed.preambleTokens;
    if (withinBudget(tokens)) {
      parts.push(parsed.preamble);
      currentTokens += tokens;
    }
  }

  // If specific sections requested, find and include only those
  if (requestedSections && requestedSections.length > 0) {
    for (const requested of requestedSections) {
      const lower = requested.toLowerCase();

      // Try exact match first, then partial match
      let found = parsed.index.get(lower);
      if (!found) {
        // Partial match: find first section whose path contains the query
        for (const [key, section] of parsed.index) {
          if (key.includes(lower)) {
            found = section;
            break;
          }
        }
      }

      if (found) {
        const rendered = renderSection(found, 1);
        const tokens = estimateTokens(rendered);
        if (withinBudget(tokens)) {
          parts.push(rendered);
          currentTokens += tokens;
        }
      }
    }
  } else {
    // Include all sections (respecting maxDepth and maxTokens)
    for (const section of parsed.sections) {
      const rendered = renderSection(section, 1);
      const tokens = estimateTokens(rendered);
      if (withinBudget(tokens)) {
        parts.push(rendered);
        currentTokens += tokens;
      } else {
        break; // Stop adding sections once we exceed budget
      }
    }
  }

  return parts.join('\n\n');
}

/**
 * Get a flat list of all section headings with their token costs.
 * Useful for agents to decide which sections to load.
 */
export function listSkillSections(
  parsed: ParsedSkillContent
): Array<{ path: string; level: number; tokenEstimate: number }> {
  const result: Array<{ path: string; level: number; tokenEstimate: number }> = [];

  function walk(section: SkillSection): void {
    result.push({
      path: section.path,
      level: section.level,
      tokenEstimate: section.tokenEstimate,
    });
    for (const child of section.children) {
      walk(child);
    }
  }

  for (const section of parsed.sections) {
    walk(section);
  }

  return result;
}
