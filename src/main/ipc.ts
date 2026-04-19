import { ipcMain } from 'electron';
import { Conversation } from './conversation';
import { createProvider } from '../providers';
import { getKey, setKey, status } from './keystore';
import { ACTUATE_TOOL } from '../types/provider';
import type { ProviderName, Provider, ChatResponse, Tool } from '../types/provider';
import { parseAction } from '../types/actions';
import { MiraError, isMiraError } from '../types/MiraError';

const SYSTEM_PROMPT = `You are Mira, a desktop voice actuator. The user speaks; you respond by calling the actuate tool with exactly one typed action, OR by replying in plain text if no action is appropriate.

Action shapes:
- {kind:"launch_app", appName:"Calculator"} — open a macOS application by name.
- {kind:"open_url", url:"https://..."} — open a web page in the default browser. Only http(s) allowed.
- {kind:"set_volume", level:0..100} — set system output volume.
- {kind:"describe_screen"} — when the user asks what is on screen, request a screenshot and describe it.
- {kind:"speak", text:"..."} — speak a message without taking any other action.

Be terse. Pick exactly one action. If unclear, ask one short clarifying question instead.`;

type Selected = { name: ProviderName; provider: Provider } | null;

let selected: Selected = null;
const conversation = new Conversation();
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
    ): Promise<{
      ok: true;
      response: ChatResponse;
      validatedActions: Array<{ toolCallId: string; action: ReturnType<typeof parseAction> | null; error?: string }>;
    } | { ok: false; error: { kind: string; message: string } }> => {
      try {
        const provider = await ensureProvider();
        conversation.addUserMessage(payload.userText);
        const tools: Tool[] = [ACTUATE_TOOL];
        const images = payload.images?.map((ab) => Buffer.from(ab));
        const response = await provider.chat({
          messages: conversation.snapshot(),
          tools,
          images,
          systemPrompt: SYSTEM_PROMPT,
        });
        conversation.addAssistantMessage(response.text, response.toolCalls);

        const validatedActions = response.toolCalls.map((tc) => {
          const rawAction = (tc.input as { action?: unknown }).action;
          try {
            return { toolCallId: tc.id, action: parseAction(rawAction) };
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            return { toolCallId: tc.id, action: null, error: msg };
          }
        });

        return { ok: true, response, validatedActions };
      } catch (e) {
        return { ok: false, error: serializeError(e) };
      }
    },
  );
}
