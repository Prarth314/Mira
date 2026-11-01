/** Text-pair metric only. Callers must identify whether text came from real ASR. */
export function wordErrorRate(reference: string, observed: string) {
  const words = (value: string) => value.toLowerCase().match(/[\p{L}\p{N}_]+/gu) ?? [];
  const expected = words(reference);
  const actual = words(observed);
  let previous = Array.from({ length: actual.length + 1 }, (_, index) => index);
  for (let i = 1; i <= expected.length; i++) {
    const row = [i];
    for (let j = 1; j <= actual.length; j++)
      row[j] = Math.min(
        row[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + (expected[i - 1] === actual[j - 1] ? 0 : 1),
      );
    previous = row;
  }
  const edits = previous[actual.length];
  return {
    edits,
    referenceWords: expected.length,
    rate: expected.length ? edits / expected.length : actual.length ? null : 0,
  };
}

export function tokenPreservation(text: string, tokens: string[]) {
  const present = tokens.filter((token) => {
    const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(?<![A-Za-z0-9_$])${escaped}(?![A-Za-z0-9_$])`).test(text);
  });
  return {
    retained: present.length,
    total: tokens.length,
    missing: tokens.filter((token) => !present.includes(token)),
    rate: tokens.length ? present.length / tokens.length : null,
  };
}

export function distribution(values: number[]) {
  if (!values.length) return { count: 0, min: null, median: null, p95: null, max: null };
  const sorted = [...values].sort((a, b) => a - b);
  return {
    count: sorted.length,
    min: sorted[0],
    median:
      sorted.length % 2
        ? sorted[(sorted.length - 1) / 2]
        : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2,
    p95: sorted.length >= 20 ? sorted[Math.ceil(sorted.length * 0.95) - 1] : null,
    max: sorted[sorted.length - 1],
  };
}
