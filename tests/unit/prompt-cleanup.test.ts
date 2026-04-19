import { describe, it, expect } from 'vitest';
import { cleanPrompt } from '../../src/main/prompt-cleanup';

describe('cleanPrompt', () => {
  it('trims and collapses whitespace', () => {
    expect(cleanPrompt('  hello   world  ')).toBe('Hello world');
  });

  it('strips leading filler', () => {
    expect(cleanPrompt('um, fix the auth bug')).toBe('Fix the auth bug');
    expect(cleanPrompt('uh fix the auth bug')).toBe('Fix the auth bug');
    expect(cleanPrompt('so, fix the auth bug')).toBe('Fix the auth bug');
    expect(cleanPrompt('like fix the auth bug')).toBe('Fix the auth bug');
    expect(cleanPrompt('okay fix the auth bug')).toBe('Fix the auth bug');
  });

  it('does not strip filler mid-sentence', () => {
    expect(cleanPrompt('fix the bug, like the one in auth')).toBe(
      'Fix the bug, like the one in auth',
    );
  });

  it('capitalizes first letter', () => {
    expect(cleanPrompt('fix the bug')).toBe('Fix the bug');
  });

  it('substitutes "clawed code" → "Claude Code"', () => {
    expect(cleanPrompt('use clawed code to refactor')).toBe('Use Claude Code to refactor');
  });

  it('substitutes "git hub" → "GitHub"', () => {
    expect(cleanPrompt('push to git hub')).toBe('Push to GitHub');
  });

  it('substitutes typescript / javascript casing', () => {
    expect(cleanPrompt('rewrite in typescript')).toBe('Rewrite in TypeScript');
    expect(cleanPrompt('convert from javascript')).toBe('Convert from JavaScript');
  });

  it('preserves technical content (filenames, paths)', () => {
    expect(cleanPrompt('refactor src/main/ipc.ts to use the new pattern')).toBe(
      'Refactor src/main/ipc.ts to use the new pattern',
    );
  });

  it('handles empty input', () => {
    expect(cleanPrompt('')).toBe('');
    expect(cleanPrompt('   ')).toBe('');
  });
});
