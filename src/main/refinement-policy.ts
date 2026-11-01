/** Conservative loss detection, not a guarantee of semantic equivalence. */
export function refinementLosses(original: string, candidate: string): string[] {
  const technical =
    original.match(
      /`[^`\n]+`|--[A-Za-z][A-Za-z0-9-]*(?:=[^\s,;]+)?|\b[A-Za-z_$][\w$]*(?:[A-Z][a-z\d]+|_[a-zA-Z\d]+)[\w$]*\b|(?:[\w@.-]+[/\\])+[\w@.-]+|\b[\w.-]+\.(?:tsx?|jsx?|json|py|rs|go|sql|md|ya?ml|toml|css|html)\b|(?<![\w])[+-]?\d+(?:\.\d+)*\b/g,
    ) ?? [];
  const losses = [...new Set(technical.map((value) => value.replace(/^`|`$/g, '')))].filter(
    (value) => !candidate.includes(value),
  );
  const negation = /\b(not|never|without|don['’]t|cannot|can['’]t|mustn['’]t)\b/i;
  if (negation.test(original) && !negation.test(candidate)) losses.push('negation');
  const preservation = /\b(unchanged|intact|as[- ]is|preserve|keep\s+(?:the\s+)?existing)\b/i;
  if (
    preservation.test(original) &&
    !preservation.test(candidate) &&
    !/\b(?:not|never|don['’]t)\s+(?:change|modify|alter|remove|replace)\b/i.test(candidate)
  )
    losses.push('preservation constraint');
  return losses;
}
