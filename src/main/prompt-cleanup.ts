// Light prompt-cleanup pass. Whisper at base.en is good but not great on code
// jargon. This is intentionally minimal — extend with measured corrections
// from the spike, not guesses.

const SUBSTITUTIONS: Array<[RegExp, string]> = [
  [/\bclawed code\b/gi, 'Claude Code'],
  [/\bclawed\b/gi, 'Claude'],
  [/\bg p t\b/gi, 'GPT'],
  [/\bs t t\b/gi, 'STT'],
  [/\bt t s\b/gi, 'TTS'],
  [/\bp r\b/gi, 'PR'],
  [/\bnpm install\b/gi, 'npm install'],
  [/\bgit hub\b/gi, 'GitHub'],
  [/\bjavascript\b/gi, 'JavaScript'],
  [/\btypescript\b/gi, 'TypeScript'],
];

export function cleanPrompt(text: string): string {
  let out = text.trim();
  // Collapse multiple spaces (whisper sometimes inserts double spaces around punctuation)
  out = out.replace(/\s+/g, ' ');
  // Remove leading filler ("um, uh, so")
  out = out.replace(/^(um|uh|so|like|okay|ok|alright)[,\s]+/i, '');
  // Capitalize first letter
  if (out.length > 0) out = out[0].toUpperCase() + out.slice(1);
  // Apply substitutions
  for (const [pattern, replacement] of SUBSTITUTIONS) {
    out = out.replace(pattern, replacement);
  }
  return out;
}
