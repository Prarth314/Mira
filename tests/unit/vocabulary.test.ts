import { describe, expect, it } from 'vitest';
import { suggestTerms } from '../../src/main/vocabulary';
import type { VocabularySnapshot } from '../../src/types/vocabulary';

const scope: VocabularySnapshot = {
  projectId: 'a'.repeat(64),
  name: 'demo',
  files: ['hooks/useStudio.ts', 'src/session.ts'],
  aliases: [],
};

describe('reviewable project vocabulary', () => {
  it('offers exact declaration spellings only from scoped files, including spelled acronyms', () => {
    const vocabulary = {
      ...scope,
      symbols: [
        { name: 'refreshSession', path: 'src/session.ts' },
        { name: 'sessionTTL', path: 'src/session.ts' },
        { name: 'fakeExternal', path: 'unselected.ts' },
      ],
    };
    const suggestions = suggestTerms(
      'Fix refresh session and session t t l, not fake external.',
      vocabulary,
    );
    expect(suggestions).toMatchObject([
      {
        phrase: 'refresh session',
        candidates: ['refreshSession'],
        source: 'symbol',
        symbolFiles: { refreshSession: ['src/session.ts'] },
      },
      { phrase: 'session t t l', candidates: ['sessionTTL'], source: 'symbol' },
    ]);
    expect(suggestTerms('Keep refreshSession and sessionTTL unchanged.', vocabulary)).toEqual([]);
  });

  it('keeps collisions between a filename and a declaration reviewable', () => {
    const vocabulary = {
      ...scope,
      files: ['refreshSession.ts'],
      symbols: [{ name: 'refreshSession', path: 'refreshSession.ts' }],
    };
    expect(suggestTerms('Fix refresh session.', vocabulary)[0]).toMatchObject({
      candidates: ['refreshSession', 'refreshSession.ts'],
      source: 'mixed',
    });
  });
  it('locates spoken camel-case filenames and spelled extensions without changing text', () => {
    const prompt = 'Fix use studio dot tee ess, but do not change 300.';
    const [suggestion] = suggestTerms(prompt, scope);
    expect(suggestion.phrase).toBe('use studio dot tee ess');
    expect(suggestion.candidates).toEqual(['hooks/useStudio.ts']);
    expect(prompt.slice(suggestion.start, suggestion.end)).toBe(suggestion.phrase);
    expect(prompt).toBe('Fix use studio dot tee ess, but do not change 300.');
  });

  it('keeps ambiguous basenames as explicit choices', () => {
    const suggestions = suggestTerms('Fix use studio.', {
      ...scope,
      files: ['a/useStudio.ts', 'b/useStudio.ts'],
    });
    expect(suggestions[0].candidates).toEqual(['a/useStudio.ts', 'b/useStudio.ts']);
  });

  it('does not suggest already exact filenames or infer arbitrary single-word names', () => {
    expect(suggestTerms('Fix hooks/useStudio.ts and session ownership.', scope)).toEqual([]);
    expect(suggestTerms('Use the studio tomorrow.', scope)).toEqual([]);
  });

  it('does not rewrite part of an exact filename even when a saved alias matches its stem', () => {
    const vocabulary = {
      ...scope,
      files: ['src/auth.ts'],
      aliases: [{ phrase: 'auth', path: 'src/auth.ts' }],
    };
    const prompt = 'Review auth.ts and src/auth.ts, not auth.';
    expect(suggestTerms(prompt, vocabulary)).toMatchObject([
      { phrase: 'auth', candidates: ['src/auth.ts'], start: prompt.lastIndexOf('auth') },
    ]);
  });

  it('supports explicit aliases only for eligible files in this project', () => {
    const vocabulary = {
      ...scope,
      aliases: [
        { phrase: 'the coordinator', path: 'src/session.ts' },
        { phrase: 'passwords', path: '.env' },
      ],
    };
    expect(suggestTerms('Fix the coordinator, not passwords.', vocabulary)).toMatchObject([
      { phrase: 'the coordinator', candidates: ['src/session.ts'], source: 'alias' },
    ]);
  });

  it('rejects crossing sentences, newlines and path boundaries', () => {
    for (const prompt of ['use. Studio', 'use\nstudio', 'use/studio'])
      expect(suggestTerms(prompt, scope)).toEqual([]);
  });

  it('handles repeated occurrences and invalidates IDs when draft text changes', () => {
    const before = suggestTerms('Fix use studio and use studio.', scope);
    expect(before).toHaveLength(2);
    expect(before[0].id).not.toBe(before[1].id);
    expect(suggestTerms('Now fix use studio.', scope)[0].id).not.toBe(before[0].id);
  });

  it('does not guess when more than eight files share a spoken name', () => {
    const files = Array.from({ length: 9 }, (_, i) => `${i}/useStudio.ts`);
    expect(suggestTerms('Fix use studio.', { ...scope, files })).toEqual([]);
  });

  it('uses an explicitly saved choice to disambiguate the same phrase next time', () => {
    const suggestions = suggestTerms('Fix use studio.', {
      ...scope,
      files: ['a/useStudio.ts', 'b/useStudio.ts'],
      aliases: [{ phrase: 'use studio', path: 'b/useStudio.ts' }],
    });
    expect(suggestions[0].candidates).toEqual(['b/useStudio.ts']);
    expect(suggestions[0].source).toBe('alias');
  });

  it('bounds suggestions and supports acronym, kebab and snake filename forms', () => {
    const vocabulary = {
      ...scope,
      files: ['HTTPClient.ts', 'refresh-session.ts', 'user_model.py'],
    };
    expect(
      suggestTerms('Fix HTTP client and refresh session and user model dot pie.', vocabulary),
    ).toHaveLength(3);
    expect(suggestTerms('use studio '.repeat(30), scope)).toHaveLength(20);
  });
});
