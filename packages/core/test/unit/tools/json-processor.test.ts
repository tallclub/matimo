import { jsonProcessor } from '../../../tools/json-processor/jsonProcessor';

describe('json_processor tool', () => {
  it('should extract value using path', async () => {
    const input = {
      json: '{"user": {"name": "Alice"}}',
      path: 'user.name',
    };

    const result = await jsonProcessor(input);

    expect(result).toBe('Alice');
  });

  it('should return full JSON if no path', async () => {
    const input = {
      json: '{"user": {"name": "Alice"}}',
    };

    const result = await jsonProcessor(input);

    expect(result).toEqual({
      user: { name: 'Alice' },
    });
  });

  it('should handle invalid JSON', async () => {
    const input = {
      json: '{invalid}',
    };

    await expect(jsonProcessor(input)).rejects.toThrow();
  });
});