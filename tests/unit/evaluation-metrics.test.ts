import { describe, expect, it } from 'vitest';
import { wordErrorRate, tokenPreservation, distribution } from '../../src/evaluation/metrics';
describe('explicit evaluation metrics', () => {
  it('counts substitutions, insertions and deletions with stated punctuation normalization', () => {
    expect(wordErrorRate('Keep the file unchanged.', 'keep file changed')).toEqual({
      edits: 2,
      referenceWords: 4,
      rate: 0.5,
    });
    expect(wordErrorRate('', 'noise')).toEqual({ edits: 1, referenceWords: 0, rate: null });
    expect(wordErrorRate('', '')).toMatchObject({ rate: 0 });
  });
  it('matches technical tokens case-sensitively at identifier boundaries', () => {
    expect(
      tokenPreservation('Keep sessionTTL at 3000 in src/auth.ts.', [
        'sessionTTL',
        '300',
        'src/auth.ts',
        'SessionTTL',
      ]),
    ).toEqual({ retained: 2, total: 4, missing: ['300', 'SessionTTL'], rate: 0.5 });
  });
  it('does not imply a meaningful tail percentile from a handful of samples', () => {
    expect(distribution([3, 1, 2])).toMatchObject({ count: 3, median: 2, p95: null });
    expect(distribution(Array.from({ length: 20 }, (_, i) => i + 1)).p95).toBe(19);
  });
});
