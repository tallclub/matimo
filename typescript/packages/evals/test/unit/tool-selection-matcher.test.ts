import { TfIdfEmbeddingProvider } from '@matimo/core';
import {
  ToolSelectionMatcher,
  ToolCorpusEntry,
} from '../../src/tool-selection/tool-selection-matcher';

describe('ToolSelectionMatcher', () => {
  const corpus: ToolCorpusEntry[] = [
    {
      name: 'slack-get-user',
      description: 'Retrieve detailed information about a Slack user by ID.',
      parameterDescriptions: ['Slack user ID to lookup.'],
    },
    {
      name: 'slack-send-message',
      description: 'Send a message to a Slack channel or user.',
      parameterDescriptions: ['Channel ID to send the message to.', 'The message text to send.'],
    },
    {
      name: 'postgres-run-query',
      description: 'Execute a read-only SQL query against a Postgres database.',
      parameterDescriptions: ['The SQL query to run.'],
    },
  ];

  it('ranks the most relevant tool first for an unambiguous prompt', () => {
    const matcher = new ToolSelectionMatcher(corpus);
    const ranked = matcher.rank('Run a SQL query against the database');
    expect(ranked[0].name).toBe('postgres-run-query');
  });

  it('returns every tool in the corpus, sorted descending by score', () => {
    const matcher = new ToolSelectionMatcher(corpus);
    const ranked = matcher.rank('Send a Slack message to #general');
    expect(ranked).toHaveLength(corpus.length);
    for (let i = 1; i < ranked.length; i++) {
      expect(ranked[i - 1].score).toBeGreaterThanOrEqual(ranked[i].score);
    }
  });

  it('distinguishes near-duplicate tools by their distinguishing terms', () => {
    const matcher = new ToolSelectionMatcher(corpus);
    const ranked = matcher.rank('Look up a Slack user profile');
    expect(ranked[0].name).toBe('slack-get-user');
  });

  it('reuses @matimo/core TfIdfEmbeddingProvider rather than reimplementing TF-IDF', () => {
    const fitSpy = jest.spyOn(TfIdfEmbeddingProvider.prototype, 'fit');
    const embedSpy = jest.spyOn(TfIdfEmbeddingProvider.prototype, 'embedSync');

    const matcher = new ToolSelectionMatcher(corpus);
    matcher.rank('Send a Slack message');

    expect(fitSpy).toHaveBeenCalled();
    expect(embedSpy).toHaveBeenCalled();

    fitSpy.mockRestore();
    embedSpy.mockRestore();
  });

  it('handles an empty corpus without throwing', () => {
    const matcher = new ToolSelectionMatcher([]);
    expect(matcher.rank('anything')).toEqual([]);
  });
});
