import {
  parseSkillSections,
  extractSkillContent,
  listSkillSections,
} from '../../../src/core/skill-content-parser';

describe('SkillContentParser', () => {
  // ─── parseSkillSections ───────────────────────────────────────────────

  describe('parseSkillSections', () => {
    it('should return empty structure for empty input', () => {
      const result = parseSkillSections('');
      expect(result.preamble).toBe('');
      expect(result.sections).toHaveLength(0);
      expect(result.totalTokens).toBe(0);
    });

    it('should capture preamble before first heading', () => {
      const body = `This is intro text before any heading.

It has multiple paragraphs.

# First Section

Content here.`;

      const result = parseSkillSections(body);
      expect(result.preamble).toContain('This is intro text');
      expect(result.preamble).toContain('multiple paragraphs');
      expect(result.preambleTokens).toBeGreaterThan(0);
      expect(result.sections).toHaveLength(1);
      expect(result.sections[0].heading).toBe('First Section');
    });

    it('should parse top-level sections', () => {
      const body = `# Overview

This is the overview.

# Getting Started

How to get started.

# Advanced Usage

Advanced topics here.`;

      const result = parseSkillSections(body);
      expect(result.sections).toHaveLength(3);
      expect(result.sections[0].heading).toBe('Overview');
      expect(result.sections[1].heading).toBe('Getting Started');
      expect(result.sections[2].heading).toBe('Advanced Usage');
    });

    it('should build nested section hierarchy', () => {
      const body = `# Parent

Parent content.

## Child A

Child A content.

### Grandchild

Grandchild content.

## Child B

Child B content.`;

      const result = parseSkillSections(body);
      expect(result.sections).toHaveLength(1);

      const parent = result.sections[0];
      expect(parent.heading).toBe('Parent');
      expect(parent.children).toHaveLength(2);
      expect(parent.children[0].heading).toBe('Child A');
      expect(parent.children[0].children).toHaveLength(1);
      expect(parent.children[0].children[0].heading).toBe('Grandchild');
      expect(parent.children[1].heading).toBe('Child B');
    });

    it('should build dot-path addresses for nested sections', () => {
      const body = `# Error Handling

## Rate Limits

Rate limit info.

## Timeouts

Timeout info.`;

      const result = parseSkillSections(body);
      expect(result.index.has('error handling')).toBe(true);
      expect(result.index.has('error handling.rate limits')).toBe(true);
      expect(result.index.has('error handling.timeouts')).toBe(true);
    });

    it('should estimate tokens for each section', () => {
      const body = `# Section One

This has some content with words in it.

# Section Two

Short.`;

      const result = parseSkillSections(body);
      expect(result.sections[0].tokenEstimate).toBeGreaterThan(result.sections[1].tokenEstimate);
      expect(result.totalTokens).toBeGreaterThan(0);
    });

    it('should not treat # inside code blocks as headings', () => {
      const body = `# Real Heading

Some text.

\`\`\`bash
# This is a comment, not a heading
echo "hello"
\`\`\`

More text.`;

      const result = parseSkillSections(body);
      expect(result.sections).toHaveLength(1);
      expect(result.sections[0].heading).toBe('Real Heading');
      expect(result.sections[0].content).toContain('# This is a comment');
    });

    it('should handle multiple heading levels correctly', () => {
      const body = `# H1

## H2

### H3

#### H4

# Another H1`;

      const result = parseSkillSections(body);
      expect(result.sections).toHaveLength(2);
      expect(result.sections[0].heading).toBe('H1');
      expect(result.sections[0].level).toBe(1);
      expect(result.sections[0].children[0].heading).toBe('H2');
      expect(result.sections[0].children[0].level).toBe(2);
      expect(result.sections[1].heading).toBe('Another H1');
    });
  });

  // ─── extractSkillContent ─────────────────────────────────────────────

  describe('extractSkillContent', () => {
    const body = `Intro text here.

# Overview

Overview content.

# Error Handling

## Rate Limits

Rate limit details with many words to test token limits.

## Retries

Retry strategy info.

# Examples

Example code here.`;

    it('should return all content with default options', () => {
      const parsed = parseSkillSections(body);
      const result = extractSkillContent(parsed);
      expect(result).toContain('Intro text here');
      expect(result).toContain('Overview content');
      expect(result).toContain('Error Handling');
      expect(result).toContain('Examples');
    });

    it('should filter to specific sections', () => {
      const parsed = parseSkillSections(body);
      const result = extractSkillContent(parsed, {
        sections: ['Error Handling'],
      });
      expect(result).toContain('Error Handling');
      expect(result).toContain('Rate Limits');
      expect(result).not.toContain('Overview content');
      expect(result).not.toContain('Example code');
    });

    it('should exclude preamble when requested', () => {
      const parsed = parseSkillSections(body);
      const result = extractSkillContent(parsed, { includePreamble: false });
      expect(result).not.toContain('Intro text here');
      expect(result).toContain('Overview content');
    });

    it('should respect maxDepth', () => {
      const parsed = parseSkillSections(body);
      const result = extractSkillContent(parsed, {
        sections: ['Error Handling'],
        maxDepth: 1,
      });
      expect(result).toContain('Error Handling');
      // Children should not be rendered separately (only their parent's direct content)
      // but the content under Error Handling that is NOT under a sub-heading should be included
    });

    it('should respect maxTokens budget', () => {
      const parsed = parseSkillSections(body);
      const full = extractSkillContent(parsed);
      const limited = extractSkillContent(parsed, { maxTokens: 10 });
      expect(limited.length).toBeLessThan(full.length);
    });

    it('should use partial matching for section names', () => {
      const parsed = parseSkillSections(body);
      const result = extractSkillContent(parsed, {
        sections: ['rate limits'],
      });
      expect(result).toContain('Rate limit details');
    });
  });

  // ─── listSkillSections ────────────────────────────────────────────────

  describe('listSkillSections', () => {
    it('should return flat list of all sections with paths', () => {
      const body = `# Overview

Content.

# Error Handling

## Rate Limits

Details.

## Retries

Info.`;

      const parsed = parseSkillSections(body);
      const sections = listSkillSections(parsed);

      expect(sections).toHaveLength(4);
      expect(sections[0]).toEqual(expect.objectContaining({ path: 'Overview', level: 1 }));
      expect(sections[1]).toEqual(expect.objectContaining({ path: 'Error Handling', level: 1 }));
      expect(sections[2]).toEqual(
        expect.objectContaining({ path: 'Error Handling.Rate Limits', level: 2 })
      );
      expect(sections[3]).toEqual(
        expect.objectContaining({ path: 'Error Handling.Retries', level: 2 })
      );
    });

    it('should include token estimates', () => {
      const body = `# Section

Some content with several words in it for token estimation.`;

      const parsed = parseSkillSections(body);
      const sections = listSkillSections(parsed);
      expect(sections[0].tokenEstimate).toBeGreaterThan(0);
    });
  });
});
