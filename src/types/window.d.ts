import type { ProviderName, ChatResponse } from './provider';
import type { Action } from './actions';

export type ChatResult =
  | {
      ok: true;
      response: ChatResponse;
      validatedActions: Array<{
        toolCallId: string;
        action: Action | null;
        error?: string;
      }>;
    }
  | { ok: false; error: { kind: string; message: string } };

declare global {
  interface Window {
    electronAPI?: {
      minimize: () => void;
      close: () => void;
    };
    mira?: {
      keys: {
        status: () => Promise<Record<ProviderName, boolean>>;
        save: (
          provider: ProviderName,
          key: string,
        ) => Promise<{ ok: boolean; error?: { kind: string; message: string } }>;
      };
      provider: {
        get: () => Promise<{ name: ProviderName }>;
        set: (name: ProviderName) => Promise<{ ok: boolean }>;
      };
      conversation: {
        reset: () => Promise<{ ok: boolean }>;
      };
      chat: (userText: string, images?: ArrayBuffer[]) => Promise<ChatResult>;
    };
  }
}

export {};
