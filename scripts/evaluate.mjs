import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import { performance } from 'node:perf_hooks';
import { build } from 'esbuild';

const file = process.argv[2] ?? 'evaluation/corpus.v1.json';
if ((await stat(file)).size > 1_000_000) throw new Error('Corpus exceeds 1 MB');
const corpus = JSON.parse(await readFile(file, 'utf8'));
if (corpus.schemaVersion !== 1 || !Array.isArray(corpus.cases) || corpus.cases.length > 200)
  throw new Error('Unsupported corpus');
const bundle = await build({
  stdin: {
    contents:
      "export { suggestTerms } from './src/main/vocabulary.ts'; export { refinementLosses } from './src/main/refinement-policy.ts'; export { wordErrorRate, tokenPreservation } from './src/evaluation/metrics.ts';",
    resolveDir: process.cwd(),
  },
  bundle: true,
  platform: 'node',
  format: 'esm',
  write: false,
});
const domain = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`
);
const results = [];
const retained = (text, tokens) => {
  const { missing, ...counts } = domain.tokenPreservation(text, tokens);
  return { ...counts, missingCount: missing.length };
};
for (const entry of corpus.cases) {
  if (!/^[a-z0-9-]{1,80}$/.test(entry.id) || !['development', 'held-out'].includes(entry.split))
    throw new Error('Invalid corpus metadata');
  if (entry.source.kind !== 'synthetic-text') {
    results.push({
      id: entry.id,
      split: entry.split,
      status: 'not-measured',
      reason:
        'Requires consent/license review and recorded observations; no audio or provider call was made.',
    });
    continue;
  }
  if (
    typeof entry.observedTranscript !== 'string' ||
    entry.observedTranscript.length > 16000 ||
    typeof entry.referenceTranscript?.text !== 'string'
  )
    throw new Error('Invalid text fixture');
  const start = performance.now();
  const observed = entry.observedTranscript;
  const candidate = entry.proposedRefinement ?? observed;
  const losses = domain.refinementLosses(observed, candidate);
  const final = losses.length ? observed : candidate;
  const suggestions = domain.suggestTerms(observed, {
    projectId: 'synthetic',
    name: 'fixture',
    files: entry.files ?? [],
    aliases: [],
    symbols: entry.symbols ?? [],
  });
  const actual = suggestions
    .map((item) => ({ phrase: item.phrase, candidates: item.candidates }))
    .sort((a, b) => a.phrase.localeCompare(b.phrase));
  const expected = [...(entry.expectedSuggestions ?? [])].sort((a, b) =>
    a.phrase.localeCompare(b.phrase),
  );
  results.push({
    id: entry.id,
    split: entry.split,
    status: 'synthetic-policy-only',
    textPairWER: domain.wordErrorRate(entry.referenceTranscript.text, observed),
    technicalBefore: retained(observed, entry.expectedTokens ?? []),
    technicalAfter: retained(final, entry.expectedTokens ?? []),
    constraintIndicators: (entry.constraints ?? []).map((constraint) => ({
      id: constraint.id,
      markerRetained: constraint.requiredPhrases.every((phrase) =>
        final.toLowerCase().includes(phrase.toLowerCase()),
      ),
      semanticGrade: null,
    })),
    candidateSetCorrect: JSON.stringify(actual) === JSON.stringify(expected),
    abstained: suggestions.length === 0,
    fallback: losses.length > 0,
    fallbackExpected: entry.expectedFallback ?? false,
    policyMs: performance.now() - start,
    providerMs: null,
    transcriptionMs: null,
  });
}
const measured = results.filter((entry) => entry.status === 'synthetic-policy-only');
const report = {
  schemaVersion: 1,
  corpusVersion: corpus.version,
  kind: 'offline-synthetic-policy-evaluation',
  limitations: [
    'No audio inference, provider calls, API credits, real recordings, or independent human semantic grading.',
    'Text-pair WER measures authored fixture strings, not ASR accuracy. Held-out is a declared regression split, not proof against tuning leakage.',
  ],
  environment: {
    commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    worktreeDirty: !!execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim(),
    platform: process.platform,
    architecture: process.arch,
    node: process.version,
    logicalProcessors: os.availableParallelism(),
  },
  summary: {
    cases: results.length,
    measured: measured.length,
    unmeasured: results.length - measured.length,
    candidateSetCorrect: measured.filter((entry) => entry.candidateSetCorrect).length,
    fallbackChecksCorrect: measured.filter((entry) => entry.fallback === entry.fallbackExpected)
      .length,
    abstentions: measured.filter((entry) => entry.abstained).length,
    fallbacks: measured.filter((entry) => entry.fallback).length,
    policyErrors: 0,
    speechErrorRate: null,
    liveProviderErrorRate: null,
  },
  results,
};
await mkdir('test-results', { recursive: true });
await writeFile('test-results/evaluation.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ kind: report.kind, ...report.summary }));
if (
  report.summary.candidateSetCorrect !== measured.length ||
  report.summary.fallbackChecksCorrect !== measured.length
)
  process.exitCode = 1;
