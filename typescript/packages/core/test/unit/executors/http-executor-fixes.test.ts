/**
 * Test: Verify HttpExecutor fixes for Issues #32 and placeholder handling
 */

import { HttpExecutor } from '../../../src/executors/http-executor';
import { MatimoError } from '../../../src/errors/matimo-error';

describe('HttpExecutor - Fixed Placeholder Handling', () => {
  const executor = new HttpExecutor();

  describe('Issue #32: Unfilled placeholders', () => {
    it('should skip unfilled placeholder "{missing}"', () => {
      // When a parameter is not provided, it should be skipped entirely
      const result = executor['templateObject']({ field: '{missing}' }, {});
      expect(result).toEqual({});
    });

    it('should include JSON parameter "{json_data}"', () => {
      // A parameter that looks like JSON should NOT be treated as unfilled placeholder
      const result = executor['templateObject'](
        { payload: '{data}' },
        { data: '{"key": "value"}' }
      );
      expect(result).toEqual({ payload: '{"key": "value"}' });
    });

    it('should include values with embedded placeholders like "prefix_{value}"', () => {
      // Partial placeholders should not be filtered
      const result = executor['templateObject']({ text: 'prefix_{suffix}' }, { suffix: 'end' });
      expect(result).toEqual({ text: 'prefix_end' });
    });

    it('should handle code snippet parameter', () => {
      // Code with {braces} should not be skipped
      const result = executor['templateObject'](
        { code: '{script}' },
        { script: 'function() { return true; }' }
      );
      expect(result).toEqual({ code: 'function() { return true; }' });
    });
  });

  describe('Nested optional objects', () => {
    it('should skip purely optional nested object with all unfilled placeholders', () => {
      const result = executor['templateObject'](
        {
          filter: {
            value: '{filter_type}',
            other_value: '{other}',
          },
        },
        {}
      );
      expect(result).toEqual({});
    });

    it('should partially fill nested object when some values are static', () => {
      // The "property" field is static, so the filter object is not empty
      const result = executor['templateObject'](
        {
          filter: {
            property: 'object',
            value: '{filter_type}',
          },
        },
        {}
      );
      expect(result).toEqual({
        filter: {
          property: 'object',
        },
      });
    });

    it('should handle multiple optional nested objects', () => {
      const result = executor['templateObject'](
        {
          filter: { value: '{filter_type}' },
          sort: { direction: '{sort_dir}' },
          page_size: '{page_size}',
        },
        { filter_type: 'page', page_size: 10 }
      );
      // sort should be skipped, filter and page_size should be included
      expect(result).toEqual({
        filter: { value: 'page' },
        page_size: '10',
      });
    });
  });

  describe('URL parameter validation', () => {
    it('should throw on missing required URL parameter', () => {
      expect(() => {
        executor['validateUrlParameters']('https://api.example.com/users/{user_id}', {});
      }).toThrow(MatimoError);
    });

    it('should pass when URL parameter provided', () => {
      expect(() => {
        executor['validateUrlParameters']('https://api.example.com/users/{user_id}', {
          user_id: '123',
        });
      }).not.toThrow();
    });

    it('should allow empty string as valid parameter value', () => {
      expect(() => {
        executor['validateUrlParameters']('https://api.example.com/search/{query}', { query: '' });
      }).not.toThrow();
    });

    it('should allow 0 as valid parameter value', () => {
      expect(() => {
        executor['validateUrlParameters']('https://api.example.com/page/{page_num}', {
          page_num: 0,
        });
      }).not.toThrow();
    });

    it('should allow false as valid parameter value', () => {
      expect(() => {
        executor['validateUrlParameters']('https://api.example.com/resource/{active}', {
          active: false,
        });
      }).not.toThrow();
    });
  });

  describe('Edge cases', () => {
    it('should handle  mixed valid and invalid placeholders', () => {
      const result = executor['templateObject'](
        {
          title: '{title}',
          status: '{status}',
          data: '{payload}',
        },
        { title: 'My Page', payload: '{"raw": "json"}' }
      );
      expect(result).toEqual({
        title: 'My Page',
        data: '{"raw": "json"}',
      });
    });

    it('should filter arrays with unfilled placeholders', () => {
      const result = executor['templateObject'](
        {
          items: ['{item1}', '{item2}', 'static_value'],
        },
        { item1: 'value1' }
      );
      expect(result).toEqual({
        items: ['value1', 'static_value'],
      });
    });

    it('should skip empty array after filtering', () => {
      const result = executor['templateObject'](
        {
          items: ['{item1}', '{item2}'],
        },
        {}
      );
      expect(result).toEqual({});
    });
  });
});
