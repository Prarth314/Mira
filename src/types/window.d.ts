import type { ProviderName, ChatResponse } from './provider';
import type { Action } from './actions';

export type ActuatorResult =
  | { ok: true; message: string }
  | { ok: false; error: { kind: string; message: string } };

export type ValidatedActionResult = {
  toolCallId: string;
  action: Action | null;
  error?: string;
  actuator?: ActuatorResult;
};

export type ChatResult =
  | {
      ok: true;
      response: ChatResponse;
      validatedActions: ValidatedActionResult[];
      transcript?: string;
    }
  | { ok: false; error: { kind: string; message: string }; transcript?: string };

export type Telemetry = {
  cpuLoad: number;
  memUsedGB: number;
  memTotalGB: number;
  battery: number | null;
};

export type PermissionState =
  | 'granted'
  | 'denied'
  | 'unknown'
  | 'restricted'
  | 'not-determined';

export type PermissionsReport = {
  microphone: PermissionState;
  screen: PermissionState;
  platform: NodeJS.Platform;
};

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
      voice: {
        start: () => Promise<{ ok: boolean }>;
        chunk: (buf: ArrayBuffer) => Promise<{ ok: boolean }>;
        end: (images?: ArrayBuffer[]) => Promise<ChatResult>;
        cancel: () => Promise<{ ok: boolean }>;
      };
      tts: {
        speak: (text: string) => Promise<{ ok: boolean; error?: { kind: string; message: string } }>;
        cancel: () => Promise<{ ok: boolean }>;
      };
      permissions: {
        probe: () => Promise<PermissionsReport>;
        requestMic: () => Promise<{ granted: boolean }>;
        openSettings: (what: 'mic' | 'screen') => Promise<{ ok: boolean }>;
      };
      telemetry: {
        read: () => Promise<{ ok: true; data: Telemetry } | { ok: false; error: { kind: string; message: string } }>;
      };
      model: {
        status: () => Promise<{ present: boolean; path: string; sha256: string }>;
        download: () => Promise<{ ok: true; path: string } | { ok: false; error: { kind: string; message: string } }>;
        onProgress: (cb: (data: { downloaded: number; total: number }) => void) => () => void;
      };
    };
  }
}

export {};
