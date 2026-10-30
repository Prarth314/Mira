import React, { useEffect, useState } from 'react';
import { ArrowUpRight, AudioLines, Check, Copy, Keyboard, Loader2, Mic, Settings, ShieldCheck, Sparkles, Square, Trash2, X } from 'lucide-react';
import SettingsPanel from './components/SettingsPanel';
import AudioVisualizer from './components/AudioVisualizer';
import { useStudio } from './hooks/useStudio';
import type { VoiceMode } from './src/types/studio';

const App: React.FC = () => {
  const studio = useStudio();
  const { state } = studio;
  const api = window.mira;
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mode, setMode] = useState<VoiceMode>('dictate');
  const [input, setInput] = useState('');
  const [review, setReview] = useState('');
  const [busy, setBusy] = useState(false);
  const [model, setModel] = useState<{ present: boolean; runtimeAvailable: boolean } | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const draft = state.draft;
  const active = state.phase !== 'idle';

  useEffect(() => { setReview(draft?.prompt ?? ''); }, [draft?.id, draft?.prompt]);
  useEffect(() => {
    if (!api) return;
    void api.model.status().then(setModel).catch(() => studio.setError('Could not inspect speech setup.'));
    return api.model.onProgress(({ downloaded, total }) => setProgress(Math.min(100, Math.round(downloaded / total * 100))));
    // The desktop bridge is stable throughout this window's lifetime.
  }, [api]);

  async function perform(operation: () => Promise<unknown>) {
    setBusy(true);
    studio.setError(null);
    try { await operation(); }
    catch (e) { studio.setError(e instanceof Error ? e.message : 'Operation failed. Your draft is preserved.'); }
    finally { setBusy(false); }
  }
  async function saveAnd(action: 'copy' | 'deliver') {
    if (!draft || !api) return;
    await api.studio.edit(draft.id, review);
    await api.studio[action](draft.id);
  }
  async function download() {
    if (!api) return;
    setProgress(0);
    try {
      const result = await api.model.download();
      if (!result.ok) throw new Error(result.error.message);
      setModel(await api.model.status());
    } finally { setProgress(null); }
  }

  return (
    <div className="mira-shell">
      <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <aside className="mira-sidebar">
        <a href="#workspace" className="mira-brand" aria-label="Mira workspace"><span className="brand-mark"><AudioLines size={22} /></span>mira<span className="text-violet-400">.</span></a>
        <div className="sidebar-caption">YOUR WORKSPACE</div>
        <a className="nav-item nav-active" href="#workspace"><Mic size={16} /> Voice studio <span className="tiny-tag">BETA</span></a>
        <button className="nav-item" aria-label="Open provider settings" onClick={() => setSettingsOpen(true)}><Settings size={16} /> Settings</button>
        <div className="sidebar-bottom">
          <div className="privacy-card"><ShieldCheck size={18} className="text-emerald-300" /><strong>Local by default</strong><p>Dictation runs on your device. Refinement uses your selected provider.</p></div>
          <div className="shortcut-label"><Keyboard size={14} /> Ctrl / Cmd + Shift + Space</div>
          <p className="text-xs text-zinc-600 mt-3">Development preview · v0.1</p>
        </div>
      </aside>
      <main id="workspace" className="mira-workspace">
        <header className="workspace-header"><div className="flex items-center gap-2 text-xs text-zinc-500"><span className="status-dot" /> YOUR IDEAS, IN MOTION</div><button className="icon-button" aria-label="Settings" onClick={() => setSettingsOpen(true)}><Settings size={18} /></button></header>
        <section className="workspace-content">
          <div className="intro"><div className="eyebrow">A LITTLE LESS TYPING. A LITTLE MORE FLOW.</div><h1>Think it. <span>Speak it.</span><br />Keep building.</h1><p>A clear path from your next idea to your next instruction.</p></div>
          {!api && <div role="alert" className="notice">Open Mira in the desktop application to record and prepare prompts.</div>}
          {(studio.error || state.error) && <div role="alert" className="notice">{studio.error || state.error}</div>}
          <div className="studio-grid">
            <section className="surface capture-card" aria-label="Capture an instruction">
              <div className="card-heading"><span className="eyebrow">01 / CAPTURE</span><span className="subtle-pill">{mode === 'dictate' ? 'On device' : 'Cloud refinement'}</span></div>
              <div className="mode-switch" role="group" aria-label="Processing mode">
                <button className={mode === 'dictate' ? 'selected' : ''} disabled={active} onClick={() => setMode('dictate')}><AudioLines size={15} /> Dictate</button>
                <button className={mode === 'refine' ? 'selected' : ''} disabled={active} onClick={() => setMode('refine')}><Sparkles size={15} /> Refine</button>
              </div>
              <p className="mode-description">{mode === 'dictate' ? 'Your words, preserved. No provider key needed.' : 'Clean up your instruction with your chosen cloud provider. Review before delivery.'}</p>
              <div className={`recording-stage ${state.phase === 'recording' ? 'is-recording' : ''}`}>
                <div className="recording-orbit"><AudioVisualizer isActive={state.phase === 'recording'} analyser={studio.analyser} /></div>
                <strong aria-live="polite">{studio.starting ? 'Connecting microphone…' : state.phase === 'recording' ? 'A good idea starts here.' : state.phase === 'transcribing' ? 'Finding your words…' : state.phase === 'refining' ? 'Preparing your instruction…' : 'Make room for your next idea.'}</strong>
                <span>{active ? 'You stay in control. Cancel any time before delivery.' : 'Start recording, or type an instruction below.'}</span>
                <div className="flex gap-3 mt-6">
                  <button className="primary-button" disabled={!api || busy || studio.starting || (active && !studio.ownsSession) || (active && state.phase !== 'recording')} onClick={() => { void (state.phase === 'recording' ? studio.finish() : studio.start(mode)); }}>
                    {studio.starting ? <Loader2 size={16} className="animate-spin" /> : state.phase === 'recording' ? <Square size={14} /> : <Mic size={16} />}{state.phase === 'recording' ? 'Finish recording' : 'Start recording'}
                  </button>
                  {active && studio.ownsSession && <button className="secondary-button" onClick={() => { void studio.cancel(); }}><X size={14} /> Cancel</button>}
                </div>
              </div>
              <div className="typed-input"><label htmlFor="instruction" className="text-xs text-zinc-500">Prefer to type?</label><textarea id="instruction" value={input} onChange={(event) => setInput(event.target.value)} placeholder="Describe what you want to build…" maxLength={16000} disabled={active || busy} rows={3} /><button className="text-button" disabled={!api || !input.trim() || active || busy} onClick={() => { void perform(() => api!.studio.prepare(input, mode)); }}>Prepare instruction <ArrowUpRight size={15} /></button></div>
            </section>
            <section className="surface review-card" aria-label="Review your prompt">
              <div className="card-heading"><span className="eyebrow">02 / REVIEW & DELIVER</span>{draft && <span className="subtle-pill">{draft.delivery}</span>}</div>
              {draft ? <>
                <div className="destination"><span className="status-dot" /><div><strong>{draft.destination?.name ?? 'Manual delivery'}</strong><p>{draft.destination ? 'Captured when recording started. Paste targets the focused input.' : 'Copy your prompt into the tool of your choice.'}</p></div></div>
                <label className="sr-only" htmlFor="review">Prepared prompt</label><textarea id="review" className="review-editor" value={review} onChange={(event) => setReview(event.target.value)} maxLength={16000} disabled={active || busy} />
                {draft.mode === 'refine' && <details className="original-transcript"><summary>View original instruction</summary><p>{draft.original}</p></details>}
                <p className="delivery-note" aria-live="polite">{draft.error ?? (draft.delivery === 'attempted' ? 'Paste attempted. Check the destination; automatic receipt cannot be verified.' : draft.delivery === 'copied' ? 'Copied. Paste it wherever you are working.' : 'Nothing is sent until you choose an action.')}</p>
                <div className="review-actions"><button className="secondary-button" disabled={!review.trim() || active || busy} onClick={() => { void perform(() => saveAnd('copy')); }}><Copy size={15} /> Copy prompt</button>{draft.destination && <button className="primary-button" disabled={!review.trim() || active || busy || draft.delivery === 'attempted'} onClick={() => { void perform(() => saveAnd('deliver')); }}><ArrowUpRight size={15} /> Paste to {draft.destination.name}</button>}<button className="icon-button" aria-label="Discard draft" disabled={active || busy} onClick={() => { void perform(() => api!.studio.discard(draft.id)); }}><Trash2 size={16} /></button></div>
              </> : <div className="empty-review"><div className="empty-icon"><Sparkles size={28} /></div><h2>Your next instruction<br />starts with a thought.</h2><p>Capture it on the left. Review it here.<br />Send it when it feels right.</p><div className="empty-check"><Check size={14} /> You choose what leaves this workspace.</div></div>}
            </section>
          </div>
          <footer className="workspace-footer"><span><ShieldCheck size={14} /> Drafts stay in memory. No transcript history is saved.</span><span>Built for the space between thought and action.</span></footer>
          {model && !model.present && <div className="setup-strip"><div><strong>Set up local speech</strong><p>Download the verified English model (~148 MB). Typed instructions work immediately.</p></div><button className="secondary-button" disabled={busy || active || progress !== null} onClick={() => { void perform(download); }}>{progress !== null ? `Downloading ${progress}%` : 'Download model'}</button>{progress !== null && <button className="secondary-button" onClick={() => { void api?.model.cancel(); }}>Cancel download</button>}</div>}
        </section>
      </main>
    </div>
  );
};
export default App;
