export type VoiceMode = 'dictate' | 'refine';
export type ContextAttachment = { path: string; content: string; sha256: string };
export type Destination = {
  name: string;
  bundleId: string | null;
  windowId?: string;
  processId?: number;
};
export type Draft = {
  id: string;
  original: string;
  prompt: string;
  mode: VoiceMode;
  destination: Destination | null;
  createdAt: string;
  delivery: 'prepared' | 'attempted' | 'copied' | 'failed';
  error?: string;
  context?: ContextAttachment[];
  terminology?: {
    projectName: string;
    suggestions: import('./vocabulary').TermSuggestion[];
  };
  reviewWarnings?: string[];
};
export type StudioState = {
  phase: 'idle' | 'recording' | 'transcribing' | 'preparing' | 'refining' | 'delivering';
  sessionId: string | null;
  draft: Draft | null;
  error: string | null;
  recordingMs?: number;
  notice?: string | null;
};
export interface StudioApi {
  state(): Promise<StudioState>;
  onState(callback: (state: StudioState) => void): () => void;
  start(mode: VoiceMode): Promise<{ id: string }>;
  chunk(id: string, data: ArrayBuffer): Promise<void>;
  finish(id: string): Promise<void>;
  cancel(id: string): Promise<void>;
  prepare(prompt: string, mode: VoiceMode): Promise<void>;
  refine(id: string): Promise<void>;
  edit(id: string, prompt: string): Promise<void>;
  correct(id: string, suggestionId: string, path: string, remember: boolean): Promise<void>;
  copy(id: string): Promise<void>;
  deliver(id: string): Promise<void>;
  discard(id: string): Promise<void>;
}
