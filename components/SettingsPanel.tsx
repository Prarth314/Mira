import React, { useEffect, useState } from 'react';
import type { ProviderName } from '../src/types/provider';

type Props = {
  open: boolean;
  onClose: () => void;
};

const SettingsPanel: React.FC<Props> = ({ open, onClose }) => {
  const [keyStatus, setKeyStatus] = useState<Record<ProviderName, boolean> | null>(null);
  const [provider, setProvider] = useState<ProviderName>('anthropic');
  const [anthropicKey, setAnthropicKey] = useState('');
  const [openaiKey, setOpenaiKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !window.mira) return;
    void window.mira.keys.status().then(setKeyStatus);
    void window.mira.provider.get().then(({ name }) => setProvider(name));
  }, [open]);

  if (!open) return null;

  async function save() {
    if (!window.mira) return;
    setBusy(true);
    setMsg(null);
    try {
      if (anthropicKey.trim())
        await window.mira.keys.save('anthropic', anthropicKey.trim());
      if (openaiKey.trim()) await window.mira.keys.save('openai', openaiKey.trim());
      await window.mira.provider.set(provider);
      const status = await window.mira.keys.status();
      setKeyStatus(status);
      setAnthropicKey('');
      setOpenaiKey('');
      setMsg('Saved. Conversation history cleared.');
    } catch (e) {
      setMsg(`Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  async function switchProvider(name: ProviderName) {
    setProvider(name);
    if (window.mira) await window.mira.provider.set(name);
  }

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="glass-panel rounded-3xl p-10 w-[520px] max-w-[90vw] space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-black uppercase tracking-[0.4em] text-cyan-400">Settings</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-xs uppercase tracking-widest"
          >
            close
          </button>
        </div>

        <section className="space-y-3">
          <label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
            Active provider
          </label>
          <div className="flex gap-2">
            {(['anthropic', 'openai'] as ProviderName[]).map((p) => (
              <button
                key={p}
                onClick={() => switchProvider(p)}
                className={`flex-1 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition ${
                  provider === p
                    ? 'bg-cyan-500/20 border border-cyan-400/40 text-cyan-300'
                    : 'bg-slate-900/40 border border-white/5 text-slate-500 hover:text-slate-300'
                }`}
              >
                {p}
                {keyStatus?.[p] ? ' ✓' : ''}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-slate-500">
            Switching providers clears the current chat history.
          </p>
        </section>

        <section className="space-y-3">
          <label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
            Anthropic API key {keyStatus?.anthropic ? '(saved)' : '(not set)'}
          </label>
          <input
            type="password"
            value={anthropicKey}
            onChange={(e) => setAnthropicKey(e.target.value)}
            placeholder="sk-ant-..."
            className="w-full bg-slate-950/60 border border-white/10 rounded-xl px-4 py-2 text-sm font-mono text-slate-200 focus:border-cyan-500/40 focus:outline-none"
          />
        </section>

        <section className="space-y-3">
          <label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
            OpenAI API key {keyStatus?.openai ? '(saved)' : '(not set)'}
          </label>
          <input
            type="password"
            value={openaiKey}
            onChange={(e) => setOpenaiKey(e.target.value)}
            placeholder="sk-..."
            className="w-full bg-slate-950/60 border border-white/10 rounded-xl px-4 py-2 text-sm font-mono text-slate-200 focus:border-cyan-500/40 focus:outline-none"
          />
        </section>

        {msg && <div className="text-xs text-cyan-300 font-mono">{msg}</div>}

        <button
          onClick={save}
          disabled={busy}
          className="w-full py-3 bg-cyan-500/20 border border-cyan-400/40 text-cyan-300 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-cyan-500/30 transition disabled:opacity-50"
        >
          {busy ? 'saving...' : 'save'}
        </button>

        <p className="text-[10px] text-slate-500 text-center">
          Keys are encrypted at rest using your OS keychain (Electron safeStorage).
        </p>
      </div>
    </div>
  );
};

export default SettingsPanel;
