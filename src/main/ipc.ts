import { ipcMain, BrowserWindow } from 'electron';
import { Conversation } from './conversation';
import { createProvider } from '../providers';
import { getKey, setKey, status } from './keystore';
import { ACTUATE_TOOL } from '../types/provider';
import type { ProviderName, Provider, ChatResponse, Tool } from '../types/provider';
import { parseAction, type Action } from '../types/actions';
import { MiraError, isMiraError } from '../types/MiraError';
import { AudioBuffer } from './audio-buffer';
import { transcribePcm, downloadModel, modelStatus } from './stt';
import { speak as ttsSpeak, cancel as ttsCancel } from './tts';
import { runAction, type ActuatorResult } from './actuator';
import { readTelemetry } from './system-info';
import { hideOverlay } from './overlay-window';
import { getSettings, updateSettings } from './settings';
import {
  probePermissions,
  requestMicrophone,
  openSettingsForMicrophone,
  openSettingsForScreen,
} from './permissions';

const SYSTEM_PROMPT = `You are Mira, a voice front-end for AI-heavy developers using Cursor and Claude Code. Almost every utterance you receive is a coding instruction the user wants delivered to whatever dev tool is currently focused. Your default behavior is to wrap that instruction in {kind:"send_developer_prompt", prompt:"..."} — verbatim, with light cleanup of obvious filler ("um", "uh", "so") but PRESERVING all technical content (filenames, symbol names, library names, paths).

Action shapes (in order of likelihood):
- {kind:"send_developer_prompt", prompt:"..."} — DEFAULT. Send the cleaned prompt to the focused dev tool (Cursor / Claude Code / Warp / iTerm / VSCode).
- {kind:"launch_app", appName:"Calculator"} — open a macOS application by name. Only when the user explicitly asks to open something.
- {kind:"open_url", url:"https://..."} — open a web page. Only on explicit request, http(s) only.
- {kind:"set_volume", level:0..100} — system output volume.
- {kind:"describe_screen"} — when the user asks what's on screen.
- {kind:"speak", text:"..."} — speak a message without taking any other action.

Rules:
- Default to send_developer_prompt unless the user is clearly asking for system control.
- Pick exactly one action.
- DO NOT paraphrase the user's coding prompt — preserve their words and ordering. They wrote it that way for a reason.
- If the user says "open Cursor" they mean launch_app, not send_developer_prompt.
- If the user is mid-thought and the request is unclear, ask one short clarifying question instead.`;

type Selected = { name: ProviderName; provider: Provider } | null;

let selected: Selected = null;
const conversation = new Conversation();
const audio = new AudioBuffer();
let selectedProvider: ProviderName = 'anthropic';

async function ensureProvider(): Promise<Provider> {
  if (selected && selected.name === selectedProvider) return selected.provider;
  const apiKey = await getKey(selectedProvider);
  if (!apiKey) {
    throw new MiraError('key_missing', `API key for ${selectedProvider} is not configured`);
  }
  const provider = createProvider({ name: selectedProvider, apiKey });
  selected = { name: selectedProvider, provider };
  return provider;
}

function serializeError(e: unknown): { kind: string; message: string } {
  if (isMiraError(e)) return { kind: e.kind, message: e.message };
  return { kind: 'provider_server', message: e instanceof Error ? e.message : String(e) };
}

export type ValidatedActionResult = {
  toolCallId: string;
  action: Action | null;
  error?: string;
  actuator?: ActuatorResult;
};

export type ChatTurnResult =
  | {
      ok: true;
      response: ChatResponse;
      validatedActions: ValidatedActionResult[];
      transcript?: string;
    }
  | { ok: false; error: { kind: string; message: string }; transcript?: string };

async function runChatTurn(
  userText: string,
  imagesBuf?: Buffer[],
): Promise<ChatTurnResult> {
  try {
    const provider = await ensureProvider();
    conversation.addUserMessage(userText);
    const tools: Tool[] = [ACTUATE_TOOL];
    const response = await provider.chat({
      messages: conversation.snapshot(),
      tools,
      images: imagesBuf,
      systemPrompt: SYSTEM_PROMPT,
    });
    conversation.addAssistantMessage(response.text, response.toolCalls);

    const validatedActions: ValidatedActionResult[] = [];
    for (const tc of response.toolCalls) {
      const rawAction = (tc.input as { action?: unknown }).action;
      try {
        const action = parseAction(rawAction);
        // Auto-run all actions in v0.1; preview-chip mitigation lives in renderer for now.
        const actuator = await runAction(action);
        const resultText = actuator.ok
          ? actuator.message
          : `error: ${actuator.error.kind}: ${actuator.error.message}`;
        conversation.addToolResult(tc.id, resultText);
        validatedActions.push({ toolCallId: tc.id, action, actuator });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        conversation.addToolResult(tc.id, `error: ${message}`);
        validatedActions.push({ toolCallId: tc.id, action: null, error: message });
      }
    }
    return { ok: true, response, validatedActions };
  } catch (e) {
    return { ok: false, error: serializeError(e) };
  }
}

export function registerIpc(): void {
  ipcMain.handle('mira:keys:status', async () => status());

  ipcMain.handle('mira:keys:save', async (_e, payload: { provider: ProviderName; key: string }) => {
    try {
      await setKey(payload.provider, payload.key);
      selected = null;
      return { ok: true };
    } catch (e) {
      return { ok: false, error: serializeError(e) };
    }
  });

  ipcMain.handle('mira:provider:get', async () => ({ name: selectedProvider }));

  ipcMain.handle('mira:provider:set', async (_e, payload: { name: ProviderName }) => {
    selectedProvider = payload.name;
    selected = null;
    conversation.reset();
    return { ok: true };
  });

  ipcMain.handle('mira:conversation:reset', async () => {
    conversation.reset();
    return { ok: true };
  });

  ipcMain.handle(
    'mira:chat',
    async (
      _e,
      payload: { userText: string; images?: ArrayBuffer[] },
    ): Promise<ChatTurnResult> => {
      const imagesBuf = payload.images?.map((ab) => Buffer.from(ab));
      return runChatTurn(payload.userText, imagesBuf);
    },
  );

  ipcMain.handle('mira:voice:start', async () => {
    audio.reset();
    return { ok: true };
  });

  ipcMain.handle('mira:voice:chunk', async (_e, chunk: ArrayBuffer) => {
    audio.append(Buffer.from(chunk));
    return { ok: true };
  });

  ipcMain.handle('mira:voice:cancel', async () => {
    audio.reset();
    return { ok: true };
  });

  ipcMain.handle(
    'mira:voice:end',
    async (_e, payload?: { images?: ArrayBuffer[] }): Promise<ChatTurnResult> => {
      const pcm = audio.flush();
      if (pcm.length === 0) {
        return { ok: false, error: { kind: 'stt_failed', message: 'empty audio buffer' } };
      }
      let transcript = '';
      try {
        transcript = await transcribePcm(pcm);
      } catch (e) {
        return { ok: false, error: serializeError(e) };
      }
      if (!transcript) {
        return { ok: false, error: { kind: 'stt_failed', message: 'no speech detected' } };
      }
      const imagesBuf = payload?.images?.map((ab) => Buffer.from(ab));
      const result = await runChatTurn(transcript, imagesBuf);
      return { ...result, transcript };
    },
  );

  ipcMain.handle('mira:tts:cancel', async () => {
    ttsCancel();
    return { ok: true };
  });

  ipcMain.handle('mira:tts:speak', async (_e, payload: { text: string }) => {
    try {
      await ttsSpeak(payload.text);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: serializeError(e) };
    }
  });

  ipcMain.handle('mira:permissions:probe', async () => probePermissions());
  ipcMain.handle('mira:permissions:requestMic', async () => ({ granted: await requestMicrophone() }));
  ipcMain.handle('mira:permissions:openSettings', async (_e, payload: { what: 'mic' | 'screen' }) => {
    if (payload.what === 'mic') openSettingsForMicrophone();
    else openSettingsForScreen();
    return { ok: true };
  });

  ipcMain.handle('mira:telemetry:read', async () => {
    try {
      return { ok: true, data: await readTelemetry() };
    } catch (e) {
      return { ok: false, error: serializeError(e) };
    }
  });

  ipcMain.handle('mira:model:status', async () => modelStatus());

  ipcMain.handle('mira:model:download', async (e) => {
    const win = BrowserWindow.fromWebContents(e.sender);
    try {
      const path = await downloadModel((downloaded, total) => {
        win?.webContents.send('mira:model:progress', { downloaded, total });
      });
      return { ok: true, path };
    } catch (err) {
      return { ok: false, error: serializeError(err) };
    }
  });

  ipcMain.handle('mira:overlay:hide', () => {
    hideOverlay();
    return { ok: true };
  });

  ipcMain.handle('mira:settings:get', async () => getSettings());
  ipcMain.handle(
    'mira:settings:update',
    async (_e, patch: Parameters<typeof updateSettings>[0]) => updateSettings(patch),
  );
}
