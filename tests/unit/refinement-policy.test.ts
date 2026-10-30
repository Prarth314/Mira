import { describe, it, expect } from 'vitest';
import { refinementLosses } from '../../src/main/refinement-policy';

describe('conservative refinement checks', () => {
  it.each([
    [
      'Update `src/auth.ts` without changing refreshSession.',
      'Update auth.',
      ['src/auth.ts', 'refreshSession', 'negation'],
    ],
    ['Keep session_ttl at 300.', 'Keep session_ttl at 30.', ['300']],
    ['Never delete existing tests.', 'Delete existing tests.', ['negation']],
  ])('retains originals when details are lost: %s', (original, candidate, missing) => {
    expect(refinementLosses(original, candidate)).toEqual(expect.arrayContaining(missing));
  });
  it('allows filler cleanup that preserves technical details', () => {
    expect(
      refinementLosses(
        'Um update auth.ts, but do not change sessionTTL from 300.',
        'Update auth.ts, but do not change sessionTTL from 300.',
      ),
    ).toEqual([]);
  });
});
