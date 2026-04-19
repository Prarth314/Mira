import React, { useEffect, useState, useRef, KeyboardEvent } from 'react';
import { Settings, Mic, Send, Trash2 } from 'lucide-react';
import AudioVisualizer from './components/AudioVisualizer';
import Sidebar from './components/Sidebar';
import SettingsPanel from './components/SettingsPanel';
import PermissionsBanner from './components/PermissionsBanner';
import { useVoiceLoop } from './hooks/useVoiceLoop';
import { useTelemetry } from './hooks/useTelemetry';
import { usePermissions } from './hooks/usePermissions';
import type { CommandLog } from './types';

const STATE_LABELS: Record<string, string> = {
  idle: 'Hold ⌥Space anywhere to talk',
  recording: 'Listening…',
  thinking: 'Thinking…',
  speaking: 'Speaking…',
};

const App: React.FC = () => {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const { messages, state, analyser, sendText, reset } = useVoiceLoop();
  const telemetry = useTelemetry(2500);
  const { report: perms, requestMic, openSettings } = usePermissions();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const logs: CommandLog[] = messages.map((m) => ({
    timestamp: new Date(),
    type: ({
      user: 'user',
      assistant: 'ai',
      action: 'system',
      error: 'system',
      system: 'system',
    } as const)[m.type],
    message:
      m.type === 'user'
        ? m.text
        : m.type === 'action'
        ? m.text
        : m.type === 'error'
        ? `Error: ${m.text}`
        : m.text,
  }));

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey && draft.trim() && state === 'idle') {
      e.preventDefault();
      const text = draft;
      setDraft('');
      void sendText(text);
    }
  }

  return (
    <div className="flex h-screen w-full bg-zinc-950 text-zinc-200 overflow-hidden">
      <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      <header className="absolute top-0 left-0 w-full h-11 z-40 flex justify-between items-center px-4 draggable bg-zinc-950/80 border-b border-white/5">
        <div className="flex items-center gap-3 non-draggable pl-16">
          <span className="text-[13px] font-semibold text-zinc-100">Mira</span>
          <span className="text-[11px] text-zinc-500">{STATE_LABELS[state]}</span>
        </div>
        <div className="flex items-center gap-1 non-draggable">
          <button
            onClick={reset}
            className="text-zinc-500 hover:text-zinc-200 transition p-1.5 rounded-md hover:bg-white/5"
            aria-label="Clear conversation"
            title="Clear conversation"
          >
            <Trash2 size={14} />
          </button>
          <button
            onClick={() => setSettingsOpen(true)}
            className="text-zinc-500 hover:text-zinc-200 transition p-1.5 rounded-md hover:bg-white/5"
            aria-label="Settings"
            title="Settings"
          >
            <Settings size={14} />
          </button>
        </div>
      </header>

      <main className="flex-1 grid grid-cols-[1fr_360px] gap-6 p-6 pt-16 overflow-hidden">
        <section className="flex flex-col gap-4 min-w-0">
          <PermissionsBanner
            report={perms}
            onRequestMic={requestMic}
            onOpenSettings={openSettings}
          />

          <div className="flex-1 flex flex-col items-center justify-center gap-6 min-h-0">
            <div className="w-full max-w-md">
              <AudioVisualizer isActive={state === 'recording'} analyser={analyser} />
            </div>
            <div className="flex items-center gap-3 text-zinc-500 text-[12px]">
              <Mic
                size={14}
                className={
                  state === 'recording'
                    ? 'text-blue-400'
                    : state === 'thinking'
                    ? 'text-amber-400'
                    : state === 'speaking'
                    ? 'text-emerald-400'
                    : 'text-zinc-600'
                }
              />
              <span>{STATE_LABELS[state]}</span>
            </div>
          </div>

          <div className="bg-zinc-900/50 border border-white/5 rounded-xl px-3 py-2 flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKey}
              disabled={state !== 'idle'}
              placeholder={
                state === 'idle'
                  ? 'Type a command, or hold ⌥Space anywhere'
                  : STATE_LABELS[state]
              }
              className="flex-1 bg-transparent text-[13px] text-zinc-100 placeholder-zinc-600 focus:outline-none px-2 py-1.5"
            />
            <button
              onClick={() => {
                const text = draft;
                setDraft('');
                void sendText(text);
              }}
              disabled={state !== 'idle' || !draft.trim()}
              className="text-zinc-400 hover:text-blue-300 disabled:opacity-30 p-1.5 rounded-md hover:bg-white/5"
              aria-label="Send"
            >
              <Send size={14} />
            </button>
          </div>
        </section>

        <Sidebar logs={logs} telemetry={telemetry} />
      </main>
    </div>
  );
};

export default App;
