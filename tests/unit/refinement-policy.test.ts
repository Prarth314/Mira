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
    ['Use --dry-run for version 2.4.1.', 'Use version 2.4.1.', ['--dry-run']],
    ['Use version 2.4.1 and port 8080.', 'Use version 2.4.2 and port 8080.', ['2.4.1']],
    ['Keep sessionTTL unchanged.', 'Change sessionTTL.', ['preservation constraint']],
    ['Don’t delete tests.', 'Delete tests.', ['negation']],
    ['Set the offset to -300.', 'Set the offset to 300.', ['-300']],
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
  it('accepts a familiar equivalent preservation marker without claiming semantic proof', () => {
    expect(refinementLosses('Keep sessionTTL unchanged.', 'Do not modify sessionTTL.')).toEqual([]);
  });
});
