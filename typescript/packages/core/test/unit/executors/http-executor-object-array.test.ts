/**
 * Test: Verify object/array parameter embedding in HTTP executor
 * This test validates that structured parameters are properly embedded in request bodies
 * as JSON objects/arrays, not stringified
 */

import { HttpExecutor } from '../../../src/executors/http-executor';

describe('HttpExecutor - Object/Array Parameter Embedding', () => {
  const executor = new HttpExecutor();

  describe('Direct object embedding in body', () => {
    it('should embed object parameters directly without stringifying', () => {
      const result = executor['templateObject'](
        { parent: '{parent}', data: 'static' },
        { parent: { database_id: '123abc', type: 'database' } },
        { parent: { type: 'object' } }
      );

      expect(result.parent).toEqual({ database_id: '123abc', type: 'database' });
      expect(typeof result.parent).toBe('object');
      expect(typeof result.parent).not.toBe('string');
    });
  });

  describe('Direct array embedding in body', () => {
    it('should embed array parameters directly without stringifying', () => {
      const result = executor['templateObject'](
        { items: '{items}' },
        {
          items: [
            { type: 'text', content: 'Hello' },
            { type: 'text', content: 'World' },
          ],
        },
        { items: { type: 'array' } }
      );

      expect(Array.isArray(result.items)).toBe(true);
      expect(result.items).toEqual([
        { type: 'text', content: 'Hello' },
        { type: 'text', content: 'World' },
      ]);
      expect(typeof result.items).not.toBe('string');
    });
  });

  describe('Mixed types in complex structure', () => {
    it('should handle object, array, and string together', () => {
      const result = executor['templateObject'](
        {
          parent: '{parent}',
          children: '{children}',
          title: '{title}',
        },
        {
          parent: { page_id: 'abc123' },
          children: [{ block: 'para', text: 'content' }],
          title: 'My Page',
        },
        {
          parent: { type: 'object' },
          children: { type: 'array' },
          title: { type: 'string' },
        }
      );

      // Object should be embedded
      expect(typeof result.parent).toBe('object');
      expect(result.parent).toEqual({ page_id: 'abc123' });

      // Array should be embedded
      expect(Array.isArray(result.children)).toBe(true);
      expect(result.children).toEqual([{ block: 'para', text: 'content' }]);

      // String should be string
      expect(typeof result.title).toBe('string');
      expect(result.title).toBe('My Page');
    });
  });

  describe('Notion API use case', () => {
    it('should properly format notion_create_page request', () => {
      const notionBody = {
        parent: '{parent}',
        properties: '{properties}',
        icon: '{icon}',
        children: '{children}',
        markdown: '{markdown}',
      };

      const notionParams = {
        parent: { database_id: 'db123' },
        properties: undefined, // Optional
        icon: { type: 'emoji', emoji: '🔧' },
        children: [{ object: 'block', type: 'paragraph' }],
        markdown: '# Title',
      };

      const notionParamDefs = {
        parent: { type: 'object' },
        properties: { type: 'object' },
        icon: { type: 'object' },
        children: { type: 'array' },
        markdown: { type: 'string' },
      };

      const result = executor['templateObject'](notionBody, notionParams, notionParamDefs);

      // Should have parent directly as object
      expect(typeof result.parent).toBe('object');
      expect((result.parent as Record<string, unknown>).database_id).toBe('db123');

      // Should have icon directly as object
      expect(typeof result.icon).toBe('object');
      expect((result.icon as Record<string, unknown>).type).toBe('emoji');
      expect((result.icon as Record<string, unknown>).emoji).toBe('🔧');

      // Should have children directly as array
      expect(Array.isArray(result.children)).toBe(true);
      expect((result.children as Record<string, unknown>[])[0].type).toBe('paragraph');

      // Should have markdown as string
      expect(typeof result.markdown).toBe('string');
      expect(result.markdown).toBe('# Title');

      // Stringified check - should NOT be strings
      expect(JSON.stringify(result.parent)).not.toBe('"[object Object]"');
      expect(JSON.stringify(result.children)).not.toBe('"[object Object]"');
    });
  });

  describe('Edge case: when paramDefinitions is missing', () => {
    it('should fallback to string templating if paramDefinitions not provided', () => {
      const result = executor['templateObject'](
        { parent: '{parent}' },
        { parent: { database_id: '123' } }
        // No paramDefinitions provided
      );

      // Without paramDefinitions, it should stringify because it doesn't know the type
      // This is a limitation/bug scenario
      expect(typeof result.parent).toBe('string');
    });
  });

  describe('Edge case: null object handling', () => {
    it('should not embed null, skip the field instead', () => {
      const result = executor['templateObject'](
        { parent: '{parent}', other: 'value' },
        { parent: null },
        { parent: { type: 'object' } }
      );

      // null should not be embedded
      expect(result.parent).toBeUndefined();
      expect(result.other).toBe('value');
    });
  });
});
