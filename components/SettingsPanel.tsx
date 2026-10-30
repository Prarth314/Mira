import React, { useEffect, useRef, useState } from 'react';
import { KeyRound, ShieldCheck, X } from 'lucide-react';
import type { ProviderName } from '../src/types/provider';

export default function SettingsPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [keys, setKeys] = useState<Record<ProviderName, boolean>>({
    anthropic: false,
    openai: false,
  });
  const [provider, setProvider] = useState<ProviderName>('anthropic');
  const [anthropicKey, setAnthropicKey] = useState('');
  const [openaiKey, setOpenaiKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [diagnostics, setDiagnostics] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    if (!open) return;
    const modal = dialog.current;
    modal?.showModal();
    let current = true;
    void (async () => {
      try {
        if (!window.mira) throw new Error('Open the desktop app to change settings.');
        const [status, settings] = await Promise.all([
          window.mira.keys.status(),
          window.mira.settings.get(),
        ]);
        if (current) {
          setKeys(status);
          setProvider(settings.defaultProvider);
        }
      } catch {
        if (current)
          setMessage('Could not load settings. Secure storage or preferences may be unavailable.');
      }
    })();
    return () => {
      current = false;
      modal?.close();
      setAnthropicKey('');
      setOpenaiKey('');
      setMessage('');
      setDiagnostics(null);
    };
  }, [open]);

  async function saveKey(name: ProviderName, key: string) {
    const result = await window.mira!.keys.save(name, key);
    if (!result.ok) throw new Error(result.error?.message ?? 'Could not update secure storage.');
  }
  async function perform(action: () => Promise<void>) {
    setBusy(true);
    setMessage('');
    try {
      await action();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not save settings.');
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    if (!window.mira) return;
    if (anthropicKey.trim()) await saveKey('anthropic', anthropicKey.trim());
    if (openaiKey.trim()) await saveKey('openai', openaiKey.trim());
    await window.mira.settings.update({ defaultProvider: provider, autoSend: false });
    setKeys(await window.mira.keys.status());
    setAnthropicKey('');
    setOpenaiKey('');
    setMessage('Saved. Local dictation remains available without a provider key.');
  }
  async function remove(name: ProviderName) {
    await saveKey(name, '');
    setKeys(await window.mira!.keys.status());
    setMessage(`${name === 'anthropic' ? 'Anthropic' : 'OpenAI'} key removed from secure storage.`);
  }
  if (!open) return null;

  return (
    <dialog
      ref={dialog}
      className="settings-dialog"
      aria-labelledby="settings-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      <div className="settings-heading">
        <div>
          <div className="eyebrow">MAKE IT YOURS</div>
          <h2 id="settings-title">Workspace settings</h2>
        </div>
        <button
          aria-label="Close settings"
          className="icon-button"
          disabled={busy}
          onClick={onClose}
        >
          <X size={18} />
        </button>
      </div>
      <p className="settings-description">
        Dictation stays local. Refinement sends only your instruction to the provider you choose.
        Attached project files are not sent for refinement.
      </p>
      <label htmlFor="provider" className="settings-label">
        Refinement provider
      </label>
      <select
        id="provider"
        value={provider}
        onChange={(event) => setProvider(event.target.value as ProviderName)}
        disabled={busy}
      >
        <option value="anthropic">Claude · Anthropic</option>
        <option value="openai">GPT · OpenAI</option>
      </select>
      <div className="settings-field">
        <label htmlFor="anthropic-key" className="settings-label">
          <KeyRound size={13} /> Anthropic API key {keys.anthropic && <span>Saved</span>}
        </label>
        <input
          id="anthropic-key"
          type="password"
          autoComplete="off"
          spellCheck={false}
          value={anthropicKey}
          onChange={(event) => setAnthropicKey(event.target.value)}
          placeholder={keys.anthropic ? 'Paste a key to replace the saved key' : 'sk-ant-…'}
          disabled={busy}
        />
        {keys.anthropic && (
          <button
            className="text-button"
            disabled={busy}
            onClick={() => {
              void perform(() => remove('anthropic'));
            }}
          >
            Remove Anthropic key
          </button>
        )}
      </div>
      <div className="settings-field">
        <label htmlFor="openai-key" className="settings-label">
          <KeyRound size={13} /> OpenAI API key {keys.openai && <span>Saved</span>}
        </label>
        <input
          id="openai-key"
          type="password"
          autoComplete="off"
          spellCheck={false}
          value={openaiKey}
          onChange={(event) => setOpenaiKey(event.target.value)}
          placeholder={keys.openai ? 'Paste a key to replace the saved key' : 'sk-…'}
          disabled={busy}
        />
        {keys.openai && (
          <button
            className="text-button"
            disabled={busy}
            onClick={() => {
              void perform(() => remove('openai'));
            }}
          >
            Remove OpenAI key
          </button>
        )}
      </div>
      <div className="settings-privacy">
        <ShieldCheck size={17} />
        <p>
          Keys use OS-backed encrypted storage. Drafts and project indexes stay in memory. No
          transcript history is written to disk.
        </p>
      </div>
      <p role="status" className="settings-message">
        {message}
      </p>
      <button
        className="primary-button settings-save"
        disabled={busy || !window.mira}
        onClick={() => {
          void perform(save);
        }}
      >
        {busy ? 'Saving…' : 'Save'}
      </button>
      <details className="settings-recovery">
        <summary>Recovery & diagnostics</summary>
        <p>
          Reset preferences to their defaults without deleting saved provider keys. Your previous
          preferences are backed up.
        </p>
        <button
          className="secondary-button"
          disabled={busy || !window.mira}
          onClick={() => {
            void perform(async () => {
              await window.mira!.settings.reset();
              setProvider('anthropic');
              setMessage('Preferences reset. Provider keys were preserved.');
            });
          }}
        >
          Reset preferences
        </button>
        <button
          className="secondary-button"
          disabled={busy || !window.mira}
          onClick={() => {
            void perform(async () => {
              setDiagnostics(await window.mira!.diagnostics.get());
            });
          }}
        >
          View diagnostics
        </button>
        {diagnostics && (
          <>
            <p>
              This report contains app, OS, memory and speech-setup information. It excludes
              transcripts, keys, project paths and file contents.
            </p>
            <pre tabIndex={0}>{JSON.stringify(diagnostics, null, 2)}</pre>
            <button
              className="secondary-button"
              onClick={() => {
                void perform(async () => {
                  await window.mira!.diagnostics.copy();
                  setMessage('Diagnostic report copied. Review it before sharing.');
                });
              }}
            >
              Copy diagnostic report
            </button>
          </>
        )}
      </details>
    </dialog>
  );
}
