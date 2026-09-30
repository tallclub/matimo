import { bearerTokenMatches } from '../../../src/mcp/mcp-server';

describe('bearerTokenMatches', () => {
  it('accepts the exact bearer header', () => {
    expect(bearerTokenMatches('Bearer s3cret', 's3cret')).toBe(true);
  });

  it.each([
    ['missing header', undefined],
    ['empty header', ''],
    ['wrong token', 'Bearer s3creT'],
    ['token prefix only', 'Bearer s3cr'],
    ['token with suffix', 'Bearer s3cret2'],
    ['no scheme', 's3cret'],
    ['other scheme', 'Basic s3cret'],
  ])('rejects %s', (_label, header) => {
    expect(bearerTokenMatches(header, 's3cret')).toBe(false);
  });
});
