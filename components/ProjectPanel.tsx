import React, { useEffect, useState } from 'react';
import { FolderOpen, Link2, X, FileText } from 'lucide-react';
import type { ContextAttachment } from '../src/types/studio';

export default function ProjectPanel({ disabled, onError }: { disabled: boolean; onError: (message: string) => void }) {
  const api = window.mira?.project;
  const [project, setProject] = useState<{ name: string; count: number } | null>(null);
  const [query, setQuery] = useState('');
  const [files, setFiles] = useState<string[]>([]);
  const [selected, setSelected] = useState<ContextAttachment[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!api) return;
    void api.status().then((result) => { setProject(result.project); setSelected(result.selected); }).catch(() => onError('Could not inspect project connection.'));
  }, [api, onError]);
  useEffect(() => {
    if (!api || !project) return;
    const timer = setTimeout(() => { void api.search(query).then(setFiles).catch(() => onError('Project search unavailable.')); }, 200);
    return () => clearTimeout(timer);
  }, [api, project, query, onError]);

  async function connect() {
    if (!api) return;
    setBusy(true);
    try { const result = await api.connect(); setProject(result.project); setSelected(result.selected); }
    catch { onError('Could not connect that folder. Select an accessible local project.'); }
    finally { setBusy(false); }
  }
  async function toggle(file: string) {
    if (!api) return;
    setBusy(true);
    try {
      const paths = selected.map((item) => item.path);
      setSelected(await api.select(paths.includes(file) ? paths.filter((path) => path !== file) : [...paths, file]));
    } catch (e) { onError(e instanceof Error ? e.message : 'Could not attach file.'); }
    finally { setBusy(false); }
  }

  return <section className="project-panel" aria-label="Project context">
    <div className="flex items-center justify-between gap-4"><div className="flex items-center gap-3"><FolderOpen size={18} className="text-violet-300" /><div><strong>{project ? project.name : 'Bring the right context.'}</strong><p>{project ? `${project.count} eligible files · local filename index · select up to 3 files` : 'Connect a folder to explicitly attach project files to your next draft.'}</p></div></div>
      {project ? <button className="icon-button" aria-label="Disconnect project" disabled={disabled || busy} onClick={() => { void api?.disconnect().then(() => { setProject(null); setSelected([]); setFiles([]); }); }}><X size={15} /></button> : <button className="secondary-button" disabled={!api || disabled || busy} onClick={() => { void connect(); }}><Link2 size={14} />{busy ? 'Indexing…' : 'Connect project'}</button>}
    </div>
    {project && <details className="context-browser"><summary>{selected.length ? `${selected.length} file${selected.length > 1 ? 's' : ''} selected for the next draft` : 'Choose files to attach'}</summary><input aria-label="Search project files" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search filenames…" maxLength={200} disabled={disabled || busy} /><div className="file-list">{files.map((file) => <label key={file}><input type="checkbox" checked={selected.some((item) => item.path === file)} disabled={disabled || busy || (selected.length >= 3 && !selected.some((item) => item.path === file))} onChange={() => { void toggle(file); }} /><FileText size={13} /><span>{file}</span></label>)}</div><p className="context-note">Selected snapshots are included when you copy or paste a draft. Cloud refinement processes only your spoken or typed instruction. Ignored, hidden and common credential files are excluded; review file contents before sharing.</p>{selected.map((file) => <details key={file.path}><summary>Preview {file.path}</summary><pre tabIndex={0}>{file.content}</pre></details>)}</details>}
  </section>;
}
