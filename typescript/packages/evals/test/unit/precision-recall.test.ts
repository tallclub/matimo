import { scoreCase, aggregateScores } from '../../src/scoring/precision-recall';
import { RankedTool } from '../../src/tool-selection/tool-selection-matcher';

const ranked: RankedTool[] = [
  { name: 'tool-a', score: 0.9 },
  { name: 'tool-b', score: 0.5 },
  { name: 'tool-c', score: 0.1 },
];

describe('scoreCase', () => {
  it('is a precision hit when the expected tool ranks first', () => {
    const score = scoreCase('prompt', 'tool-a', ranked);
    expect(score.rank).toBe(1);
    expect(score.precisionHit).toBe(true);
    expect(score.recallHit).toBe(true);
  });

  it('is not a precision hit, but is a recall hit within a wider top_k', () => {
    const score = scoreCase('prompt', 'tool-b', ranked, 2);
    expect(score.rank).toBe(2);
    expect(score.precisionHit).toBe(false);
    expect(score.recallHit).toBe(true);
  });

  it('misses recall entirely when the expected tool falls outside top_k', () => {
    const score = scoreCase('prompt', 'tool-c', ranked, 2);
    expect(score.rank).toBe(3);
    expect(score.recallHit).toBe(false);
  });

  it('reports rank -1 when the expected tool is absent from the ranking', () => {
    const score = scoreCase('prompt', 'tool-z', ranked);
    expect(score.rank).toBe(-1);
    expect(score.precisionHit).toBe(false);
    expect(score.recallHit).toBe(false);
  });

  it('defaults top_k to 1 (strict top-1)', () => {
    const score = scoreCase('prompt', 'tool-b', ranked);
    expect(score.topK).toBe(1);
    expect(score.recallHit).toBe(false);
  });
});

describe('aggregateScores', () => {
  it('computes precision and recall rates across cases', () => {
    const scores = [
      scoreCase('p1', 'tool-a', ranked),
      scoreCase('p2', 'tool-b', ranked, 2),
      scoreCase('p3', 'tool-c', ranked, 2),
    ];
    const aggregate = aggregateScores(scores);
    expect(aggregate.total).toBe(3);
    expect(aggregate.precisionHits).toBe(1);
    expect(aggregate.recallHits).toBe(2);
    expect(aggregate.precision).toBeCloseTo(1 / 3);
    expect(aggregate.recall).toBeCloseTo(2 / 3);
    expect(aggregate.failures).toHaveLength(1);
    expect(aggregate.failures[0].expectedTool).toBe('tool-c');
  });

  it('treats an empty set of scores as a full pass', () => {
    const aggregate = aggregateScores([]);
    expect(aggregate.total).toBe(0);
    expect(aggregate.precision).toBe(1);
    expect(aggregate.recall).toBe(1);
    expect(aggregate.failures).toEqual([]);
  });
});
