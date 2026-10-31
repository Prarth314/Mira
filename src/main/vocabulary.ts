import { createHash } from 'node:crypto';
import type { TermSuggestion, VocabularySnapshot } from '../types/vocabulary';

export function normalizePhrase(value: string): string {
  return (value.toLowerCase().match(/[a-z0-9_$]+/g) ?? []).join(' ');
}

function spokenName(value: string): string {
  return value
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]/g, ' ');
}

const EXTENSIONS: Record<string, string[]> = {
  ts: ['t s', 'tee ess'],
  tsx: ['t s x', 'tee ess ex'],
  js: ['j s', 'jay ess'],
  jsx: ['j s x', 'jay ess ex'],
  py: ['p y', 'pie'],
  md: ['m d', 'markdown'],
  json: ['j son', 'jay son'],
  css: ['c s s', 'see ess ess'],
  html: ['h t m l'],
};

/** Exact spoken forms only. No fuzzy guessing or unreviewed replacements. */
export function suggestTerms(prompt: string, vocabulary: VocabularySnapshot): TermSuggestion[] {
  const phrases = new Map<string, { paths: Set<string>; source: 'filename' | 'alias' }>();
  function add(phrase: string, file: string, source: 'filename' | 'alias') {
    const normalized = normalizePhrase(phrase);
    const count = normalized.split(' ').length;
    if (!normalized || count > 12 || (count < 2 && source === 'filename')) return;
    const existing = phrases.get(normalized);
    if (source === 'alias') {
      phrases.set(normalized, { paths: new Set([file]), source });
    } else if (existing) {
      existing.paths.add(file);
    } else phrases.set(normalized, { paths: new Set([file]), source });
  }
  const files = new Set(vocabulary.files);
  for (const file of files) {
    const basename = file.split('/').pop()!;
    const dot = basename.lastIndexOf('.');
    if (dot < 1) continue;
    const stem = spokenName(basename.slice(0, dot));
    const extension = basename.slice(dot + 1).toLowerCase();
    add(stem, file, 'filename');
    for (const suffix of [extension, ...(EXTENSIONS[extension] ?? [])]) {
      add(`${stem} dot ${suffix}`, file, 'filename');
      add(`${stem} ${suffix}`, file, 'filename');
    }
  }
  for (const alias of vocabulary.aliases) {
    if (files.has(alias.path)) add(alias.phrase, alias.path, 'alias');
  }
  const tokens = [...prompt.matchAll(/[A-Za-z0-9_$]+/g)];
  const basenames = new Set(vocabulary.files.map((file) => file.split('/').pop()!));
  const exactReferences = [...prompt.matchAll(/[A-Za-z0-9_$@-]+(?:[./\\][A-Za-z0-9_$@-]+)+/g)]
    .filter((match) => basenames.has(match[0].split(/[/\\]/).pop()!))
    .map((match) => ({ start: match.index!, end: match.index! + match[0].length }));
  const result: TermSuggestion[] = [];
  for (let i = 0; i < tokens.length && result.length < 20; i++) {
    for (let length = Math.min(12, tokens.length - i); length >= 1; length--) {
      const endToken = tokens[i + length - 1];
      const start = tokens[i].index!;
      const end = endToken.index! + endToken[0].length;
      const phrase = prompt.slice(start, end);
      if (exactReferences.some((range) => start < range.end && end > range.start)) continue;
      // Never match across a sentence, newline, path separator, or code fence.
      if (!/^[A-Za-z0-9_$ .'-]+$/.test(phrase) || /[.!?]\s/.test(phrase)) continue;
      const match = phrases.get(normalizePhrase(phrase));
      if (!match || match.paths.size > 8) continue;
      const candidates = [...match.paths].sort();
      if (candidates.some((file) => file === phrase || file.split('/').pop() === phrase)) break;
      result.push({
        id: createHash('sha256')
          .update(JSON.stringify([prompt, start, end, candidates]))
          .digest('hex'),
        start,
        end,
        phrase,
        candidates,
        source: match.source,
      });
      i += length - 1;
      break;
    }
  }
  return result;
}
