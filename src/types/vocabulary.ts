export type ProjectAlias = { phrase: string; path: string };
export type ProjectSymbol = { name: string; path: string };
export type TermSuggestion = {
  id: string;
  start: number;
  end: number;
  phrase: string;
  candidates: string[];
  source: 'filename' | 'alias' | 'symbol' | 'mixed';
  symbolFiles?: Record<string, string[]>;
};
export type VocabularySnapshot = {
  projectId: string;
  name: string;
  files: string[];
  aliases: ProjectAlias[];
  symbols?: ProjectSymbol[];
};
export type ProjectStatus = {
  project: { name: string; count: number } | null;
  selected: import('./studio').ContextAttachment[];
  vocabulary: { enabled: boolean; aliases: ProjectAlias[]; symbolCount: number };
};
