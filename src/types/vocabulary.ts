export type ProjectAlias = { phrase: string; path: string };
export type TermSuggestion = {
  id: string;
  start: number;
  end: number;
  phrase: string;
  candidates: string[];
  source: 'filename' | 'alias';
};
export type VocabularySnapshot = {
  projectId: string;
  name: string;
  files: string[];
  aliases: ProjectAlias[];
};
export type ProjectStatus = {
  project: { name: string; count: number } | null;
  selected: import('./studio').ContextAttachment[];
  vocabulary: { enabled: boolean; aliases: ProjectAlias[] };
};
