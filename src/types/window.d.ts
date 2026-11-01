import type { ProviderName, ChatResponse } from './provider';
import type { Action } from './actions';
import type { StudioApi, ContextAttachment } from './studio';
import type { ProjectStatus } from './vocabulary';

export type ActuatorResult =
  { ok: true; message: string } | { ok: false; error: { kind: string; message: string } };

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

export type PermissionState = 'granted' | 'denied' | 'unknown' | 'restricted' | 'not-determined';

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
      studio: StudioApi;
      desktop: { status(): Promise<{ shortcuts: { record: boolean; workspace: boolean } }> };
      diagnostics: {
        get: () => Promise<Record<string, unknown>>;
        copy: () => Promise<void>;
      };
      project: {
        status: () => Promise<ProjectStatus>;
        refresh: () => Promise<ProjectStatus>;
        connect: () => Promise<ProjectStatus>;
        vocabulary: (enabled: boolean) => Promise<ProjectStatus>;
        alias: (phrase: string, path: string) => Promise<ProjectStatus>;
        search: (query: string) => Promise<string[]>;
        select: (paths: string[]) => Promise<ContextAttachment[]>;
        disconnect: () => Promise<void>;
      };
      window: {
        show: () => Promise<{ ok: boolean }>;
        hide: () => Promise<{ ok: boolean }>;
      };
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
        speak: (
          text: string,
        ) => Promise<{ ok: boolean; error?: { kind: string; message: string } }>;
        cancel: () => Promise<{ ok: boolean }>;
      };
      permissions: {
        probe: () => Promise<PermissionsReport>;
        requestMic: () => Promise<{ granted: boolean }>;
        openSettings: (what: 'mic' | 'screen') => Promise<{ ok: boolean }>;
      };
      telemetry: {
        read: () => Promise<
          { ok: true; data: Telemetry } | { ok: false; error: { kind: string; message: string } }
        >;
      };
      model: {
        status: () => Promise<{
          present: boolean;
          path: string;
          sha256: string;
          runtimeAvailable: boolean;
          downloading: boolean;
        }>;
        cancel: () => Promise<{ ok: boolean }>;
        download: () => Promise<
          { ok: true; path: string } | { ok: false; error: { kind: string; message: string } }
        >;
        onProgress: (cb: (data: { downloaded: number; total: number }) => void) => () => void;
      };
      window: {
        show: () => Promise<{ ok: boolean }>;
        hide: () => Promise<{ ok: boolean }>;
      };
      overlay: {
        ready: () => Promise<void>;
        open: () => Promise<void>;
        hide: () => Promise<{ ok: boolean }>;
        onShow: (cb: () => void) => () => void;
        onHide: (cb: () => void) => () => void;
        onToggle: (cb: () => void) => () => void;
      };
      settings: {
        reset: () => Promise<unknown>;
        get: () => Promise<{
          defaultProvider: ProviderName;
          autoSend: boolean;
          showAdvancedProviders: boolean;
          microphoneId: string;
        }>;
        update: (
          patch: Partial<{
            defaultProvider: ProviderName;
            autoSend: boolean;
            showAdvancedProviders: boolean;
            microphoneId: string;
          }>,
        ) => Promise<{
          defaultProvider: ProviderName;
          autoSend: boolean;
          showAdvancedProviders: boolean;
          microphoneId: string;
        }>;
      };
    };
  }
}

export {};
