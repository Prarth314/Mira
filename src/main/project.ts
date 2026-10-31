import { app, BrowserWindow, dialog } from 'electron';
import path from 'node:path';
import { handle } from './security';
import { ProjectIndex } from './project-index';
import { record, text } from './validation';
import { MiraError } from '../types/MiraError';
import type { ContextAttachment } from '../types/studio';
import type { ProjectAlias, VocabularySnapshot } from '../types/vocabulary';
import { ProjectAliasStore } from './project-aliases';

const index = new ProjectIndex();
let selected: ContextAttachment[] = [];
let project: { name: string; count: number } | null = null;
let connecting = false;
let enabled = false;
let aliases: ProjectAlias[] = [];
let generation = 0;
let store: ProjectAliasStore;

function status() {
  return { project, selected, vocabulary: { enabled, aliases } };
}

export function projectVocabulary(): VocabularySnapshot | null {
  const scope = index.vocabulary();
  return enabled && project && scope
    ? { ...scope, name: project.name, aliases: structuredClone(aliases) }
    : null;
}

export async function rememberAlias(
  projectId: string,
  phrase: string,
  file: string,
): Promise<void> {
  const scope = projectVocabulary();
  if (!scope || scope.projectId !== projectId || !scope.files.includes(file))
    throw new MiraError('action_invalid', 'Reconnect the original project and enable vocabulary.');
  const currentGeneration = generation;
  const saved = await store.set(projectId, { phrase, path: file });
  if (generation === currentGeneration) aliases = saved;
}

export function selectedContext(): ContextAttachment[] {
  return structuredClone(selected);
}
export function contextUnchanged(files: ContextAttachment[]): Promise<boolean> {
  return index.unchanged(files);
}

export function registerProject(): void {
  store = new ProjectAliasStore(path.join(app.getPath('userData'), 'project-vocabulary'));
  handle(
    'mira:project:connect',
    async (event) => {
      if (connecting) throw new MiraError('action_invalid', 'Project selection is already open');
      const win = BrowserWindow.fromWebContents(event.sender);
      if (!win) throw new MiraError('action_invalid', 'Workspace unavailable');
      connecting = true;
      try {
        const result = await dialog.showOpenDialog(win, {
          title: 'Connect a local project',
          properties: ['openDirectory'],
        });
        if (!result.canceled && result.filePaths[0]) {
          project = await index.connect(result.filePaths[0]);
          selected = [];
          enabled = false;
          aliases = [];
          generation++;
        }
        return status();
      } finally {
        connecting = false;
      }
    },
    ['workspace'],
  );
  handle(
    'mira:project:search',
    (_event, query: unknown) => index.search(text(query, 'Search', 200, true)),
    ['workspace'],
  );
  handle('mira:project:status', status, ['workspace']);
  handle(
    'mira:project:vocabulary',
    async (_event, value: unknown) => {
      if (typeof value !== 'boolean' || !project || connecting)
        throw new MiraError('action_invalid', 'Connect a project before enabling vocabulary.');
      const currentGeneration = ++generation;
      enabled = false;
      if (value) {
        const saved = await store.read(index.vocabulary()!.projectId);
        if (generation !== currentGeneration)
          throw new MiraError('action_invalid', 'Project changed while loading vocabulary.');
        aliases = saved;
        enabled = true;
      }
      return status();
    },
    ['workspace'],
  );
  handle(
    'mira:project:alias',
    async (_event, payload: unknown) => {
      const value = record(payload);
      const scope = projectVocabulary();
      if (!scope) throw new MiraError('action_invalid', 'Enable project vocabulary first.');
      const phrase = text(value.phrase, 'Spoken phrase', 100);
      const file = text(value.path, 'Project file', 1024, true);
      const currentGeneration = generation;
      if (file && !scope.files.includes(file))
        throw new MiraError('action_invalid', 'Choose an indexed project file.');
      const saved = file
        ? await store.set(scope.projectId, { phrase, path: file })
        : await store.remove(scope.projectId, phrase);
      if (generation === currentGeneration) aliases = saved;
      return status();
    },
    ['workspace'],
  );
  handle(
    'mira:project:select',
    async (_event, payload: unknown) => {
      const files = record(payload).paths;
      if (!Array.isArray(files) || !files.every((file) => typeof file === 'string'))
        throw new MiraError('action_invalid', 'Invalid file selection');
      selected = await index.attach(files);
      return selected;
    },
    ['workspace'],
  );
  handle(
    'mira:project:disconnect',
    () => {
      generation++;
      enabled = false;
      aliases = [];
      index.disconnect();
      project = null;
      selected = [];
    },
    ['workspace'],
  );
}
