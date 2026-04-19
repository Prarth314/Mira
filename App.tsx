import React, { useEffect, useState, useRef, KeyboardEvent } from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, Settings, Mic, Send } from 'lucide-react';
import AudioVisualizer from './components/AudioVisualizer';
import Sidebar from './components/Sidebar';
import SettingsPanel from './components/SettingsPanel';
import { useVoiceLoop } from './hooks/useVoiceLoop';
import type { CommandLog } from './types';

const BOOT_STEPS = [
  'MOUNTING ROOT_FS...',
  'SYNCING IPC BRIDGE...',
  'PROVIDER REGISTRY ONLINE...',
  'ACTUATOR_READY.',
];

const App: React.FC = () => {
  const [isBooting, setIsBooting] = useState(true);
  const [bootLogs, setBootLogs] = useState<string[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const { messages, busy, send } = useVoiceLoop();

  useEffect(() => {
    let step = 0;
    const interval = setInterval(() => {
      if (step < BOOT_STEPS.length) {
        setBootLogs((prev) => [...prev, BOOT_STEPS[step]]);
        step++;
      } else {
        clearInterval(interval);
        setTimeout(() => setIsBooting(false), 600);
      }
    }, 250);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!isBooting) inputRef.current?.focus();
  }, [isBooting]);

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
        ? `▸ ${m.text}`
        : m.type === 'action'
        ? `⟶ ${m.text}`
        : m.type === 'error'
        ? `✕ ${m.text}`
        : m.text,
  }));

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey && draft.trim() && !busy) {
      e.preventDefault();
      const text = draft;
      setDraft('');
      void send(text);
    }
  }

  if (isBooting) {
    return (
      <div className="h-screen w-full bg-[#020617] flex items-center justify-center p-20 font-mono text-cyan-500 overflow-hidden relative">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="w-full max-w-md space-y-12 relative z-10"
        >
          <div className="flex flex-col items-center space-y-6">
            <div className="p-6 bg-cyan-500/10 rounded-[2.5rem] ring-1 ring-cyan-500/30 shadow-[0_0_40px_rgba(34,211,238,0.2)]">
              <ShieldCheck size={64} className="text-cyan-400 animate-pulse" />
            </div>
            <motion.div
              animate={{ letterSpacing: ['0.4em', '1.2em', '0.4em'], opacity: [0.6, 1, 0.6] }}
              transition={{ duration: 4, repeat: Infinity }}
              className="text-[16px] font-black uppercase text-cyan-400/90"
            >
              Mira
            </motion.div>
          </div>
          <div className="h-1.5 w-full bg-slate-900/50 overflow-hidden rounded-full border border-white/5">
            <motion.div
              animate={{ x: ['-100%', '100%'] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              className="h-full bg-gradient-to-r from-transparent via-cyan-400 to-transparent w-2/3"
            />
          </div>
          <div className="space-y-1 text-[10px] tracking-[0.3em] text-center uppercase opacity-50">
            {bootLogs.map((s, i) => (
              <div key={i}>{s}</div>
            ))}
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-[#020617] font-sans text-slate-200 overflow-hidden relative">
      <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      <header className="absolute top-0 left-0 w-full h-20 z-[100] flex justify-between items-center px-10 draggable bg-slate-900/40 backdrop-blur-2xl border-b border-white/5">
        <div className="flex items-center space-x-6 non-draggable">
          <div className="bg-cyan-500/10 p-3 rounded-2xl border border-cyan-500/30">
            <ShieldCheck size={20} className="text-cyan-400" />
          </div>
          <div className="flex flex-col -space-y-1">
            <span className="text-[12px] font-black tracking-[0.5em] uppercase text-slate-200">Mira</span>
            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">
              v0.1 dev
            </span>
          </div>
        </div>
        <div className="flex items-center space-x-3 non-draggable">
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.92 }}
            onClick={() => setSettingsOpen(true)}
            className="text-slate-500 hover:text-cyan-400 transition-all p-2.5 rounded-xl hover:bg-white/5"
            aria-label="Open settings"
          >
            <Settings size={18} />
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.92 }}
            onClick={() => window.electronAPI?.minimize()}
            className="text-slate-500 hover:text-white transition-all p-2.5 rounded-xl hover:bg-white/5"
            aria-label="Minimize"
          >
            <div className="w-4 h-0.5 bg-current rounded-full" />
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.92 }}
            onClick={() => window.electronAPI?.close()}
            className="text-slate-500 hover:text-red-400 transition-all p-2.5 rounded-xl hover:bg-red-500/10"
            aria-label="Close"
          >
            ✕
          </motion.button>
        </div>
      </header>

      <div className="flex-1 flex gap-8 p-8 pt-28 overflow-hidden relative z-10">
        <div className="w-[440px] flex flex-col gap-8 h-full overflow-hidden">
          <Sidebar logs={logs} />
        </div>

        <div className="flex-1 flex flex-col gap-6 h-full">
          <div className="flex-1 flex items-center justify-center">
            <div className="relative w-[450px] h-[450px]">
              <AudioVisualizer isActive={busy} analyser={null} />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <Mic size={32} className={busy ? 'text-cyan-400 animate-pulse' : 'text-slate-700'} />
              </div>
            </div>
          </div>

          <div className="bg-slate-900/40 backdrop-blur-2xl border border-white/10 rounded-3xl p-4 flex items-center gap-3">
            <input
              ref={inputRef}
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKey}
              disabled={busy}
              placeholder={busy ? 'thinking...' : 'type a command (voice in Phase 3)'}
              className="flex-1 bg-transparent text-sm font-mono text-slate-200 placeholder-slate-600 focus:outline-none px-3"
            />
            <button
              onClick={() => {
                const text = draft;
                setDraft('');
                void send(text);
              }}
              disabled={busy || !draft.trim()}
              className="bg-cyan-500/20 border border-cyan-400/40 text-cyan-300 rounded-xl p-2.5 hover:bg-cyan-500/30 transition disabled:opacity-30"
              aria-label="Send"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
