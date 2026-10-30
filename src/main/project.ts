import { BrowserWindow, dialog } from 'electron';
import { handle } from './security';
import { ProjectIndex } from './project-index';
import { record, text } from './validation';
import { MiraError } from '../types/MiraError';
import type { ContextAttachment } from '../types/studio';

const index = new ProjectIndex();
let selected: ContextAttachment[] = [];
let project: { name: string; count: number } | null = null;
let connecting = false;

export function selectedContext(): ContextAttachment[] {
  return structuredClone(selected);
}
export function contextUnchanged(files: ContextAttachment[]): Promise<boolean> {
  return index.unchanged(files);
}

export function registerProject(): void {
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
        }
        return { project, selected };
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
  handle('mira:project:status', () => ({ project, selected }), ['workspace']);
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
      index.disconnect();
      project = null;
      selected = [];
    },
    ['workspace'],
  );
}
