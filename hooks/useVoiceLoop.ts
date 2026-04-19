import { useCallback, useState } from 'react';
import type { Action } from '../src/types/actions';
import type { ChatResult } from '../src/types/window';

export type LoopMessage = {
  id: number;
  type: 'user' | 'assistant' | 'system' | 'action' | 'error';
  text: string;
  action?: Action;
};

let _id = 0;
const nextId = () => ++_id;

export function useVoiceLoop() {
  const [messages, setMessages] = useState<LoopMessage[]>([]);
  const [busy, setBusy] = useState(false);

  const append = useCallback((m: Omit<LoopMessage, 'id'>) => {
    setMessages((prev) => [...prev.slice(-100), { id: nextId(), ...m }]);
  }, []);

  const send = useCallback(
    async (text: string) => {
      if (!text.trim()) return;
      const api = window.mira;
      if (!api) {
        append({ type: 'error', text: 'IPC bridge not available — Mira not running inside Electron?' });
        return;
      }
      append({ type: 'user', text });
      setBusy(true);
      let result: ChatResult;
      try {
        result = await api.chat(text);
      } catch (e) {
        append({ type: 'error', text: `IPC error: ${e instanceof Error ? e.message : String(e)}` });
        setBusy(false);
        return;
      }
      if (!result.ok) {
        append({ type: 'error', text: `${result.error.kind}: ${result.error.message}` });
        setBusy(false);
        return;
      }
      if (result.response.text) append({ type: 'assistant', text: result.response.text });
      for (const v of result.validatedActions) {
        if (v.action) {
          append({
            type: 'action',
            text: describe(v.action),
            action: v.action,
          });
        } else {
          append({ type: 'error', text: `invalid action: ${v.error ?? 'unknown'}` });
        }
      }
      setBusy(false);
    },
    [append],
  );

  const reset = useCallback(async () => {
    await window.mira?.conversation.reset();
    setMessages([]);
  }, []);

  return { messages, busy, send, reset };
}

function describe(a: Action): string {
  switch (a.kind) {
    case 'launch_app':
      return `launch app: ${a.appName}`;
    case 'open_url':
      return `open url: ${a.url}`;
    case 'set_volume':
      return `set volume to ${a.level}%`;
    case 'describe_screen':
      return `describe what's on screen`;
    case 'speak':
      return `speak: ${a.text}`;
  }
}
