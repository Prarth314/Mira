/** Conservative loss detection, not a guarantee of semantic equivalence. */
export function refinementLosses(original: string, candidate: string): string[] {
  const technical = original.match(
    /`[^`\n]+`|\b[A-Za-z_$][\w$]*(?:[A-Z][a-z\d]+|_[a-zA-Z\d]+)[\w$]*\b|(?:[\w@.-]+[/\\])+[\w@.-]+|\b[\w.-]+\.(?:tsx?|jsx?|json|py|rs|go|sql|md|ya?ml|toml|css|html)\b|\b\d+(?:\.\d+)?\b/g,
  ) ?? [];
  const losses = [...new Set(technical.map((value) => value.replace(/^`|`$/g, '')))]
    .filter((value) => !candidate.includes(value));
  const negation = /\b(not|never|without|don't|cannot|can't|mustn't)\b/i;
  if (negation.test(original) && !negation.test(candidate)) losses.push('negation');
  return losses;
}
