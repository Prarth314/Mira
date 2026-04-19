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
      if (anthropicKey.trim()) await window.mira.keys.save('anthropic', anthropicKey.trim());
      if (openaiKey.trim()) await window.mira.keys.save('openai', openaiKey.trim());
      await window.mira.provider.set(provider);
      const status = await window.mira.keys.status();
      setKeyStatus(status);
      setAnthropicKey('');
      setOpenaiKey('');
      setMsg('Saved. Conversation history was cleared.');
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-zinc-900 border border-white/10 rounded-2xl w-[480px] max-w-[92vw] p-6 space-y-5 shadow-2xl"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-100">Settings</h2>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-200 text-xs px-2 py-1 rounded"
          >
            Close
          </button>
        </div>

        <Field label="Active provider">
          <div className="grid grid-cols-2 gap-2">
            {(['anthropic', 'openai'] as ProviderName[]).map((p) => (
              <button
                key={p}
                onClick={() => switchProvider(p)}
                className={`px-3 py-2 rounded-lg text-xs font-medium transition ${
                  provider === p
                    ? 'bg-blue-500/15 border border-blue-400/40 text-blue-200'
                    : 'bg-zinc-950/40 border border-white/5 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {p === 'anthropic' ? 'Claude (Anthropic)' : 'GPT (OpenAI)'}
                {keyStatus?.[p] ? ' • set' : ''}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-zinc-500 mt-2">
            Switching providers clears the current chat history.
          </p>
        </Field>

        <Field label={`Anthropic API key${keyStatus?.anthropic ? ' (saved)' : ''}`}>
          <input
            type="password"
            value={anthropicKey}
            onChange={(e) => setAnthropicKey(e.target.value)}
            placeholder="sk-ant-..."
            className="w-full bg-zinc-950/60 border border-white/10 rounded-lg px-3 py-2 text-[13px] font-mono text-zinc-200 focus:border-blue-400/40 focus:outline-none"
          />
        </Field>

        <Field label={`OpenAI API key${keyStatus?.openai ? ' (saved)' : ''}`}>
          <input
            type="password"
            value={openaiKey}
            onChange={(e) => setOpenaiKey(e.target.value)}
            placeholder="sk-..."
            className="w-full bg-zinc-950/60 border border-white/10 rounded-lg px-3 py-2 text-[13px] font-mono text-zinc-200 focus:border-blue-400/40 focus:outline-none"
          />
        </Field>

        {msg && <div className="text-xs text-blue-300">{msg}</div>}

        <button
          onClick={save}
          disabled={busy}
          className="w-full py-2.5 bg-blue-500/20 border border-blue-400/40 text-blue-100 rounded-lg text-[13px] font-medium hover:bg-blue-500/30 transition disabled:opacity-50"
        >
          {busy ? 'Saving…' : 'Save'}
        </button>

        <p className="text-[11px] text-zinc-500 text-center">
          Keys are encrypted at rest in your OS keychain.
        </p>
      </div>
    </div>
  );
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="space-y-1.5">
    <label className="text-[11px] font-medium text-zinc-400">{label}</label>
    {children}
  </div>
);

export default SettingsPanel;
