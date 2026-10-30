import { app, ipcMain, type BrowserWindow, type IpcMainInvokeEvent } from 'electron';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { MiraError } from '../types/MiraError';

type Role = 'workspace' | 'overlay';
const windows = new Map<number, { role: Role; url: string }>();
export function windowRole(id: number): Role | undefined {
  return windows.get(id)?.role;
}

export function windowUrl(role: Role): string {
  const page = role === 'workspace' ? 'index.html' : 'overlay.html';
  return process.env.NODE_ENV === 'development' && !app.isPackaged
    ? `http://127.0.0.1:5173/${role === 'workspace' ? '' : page}`
    : pathToFileURL(path.join(app.getAppPath(), 'dist', page)).href;
}

export function secureWindow(win: BrowserWindow, role: Role): void {
  const id = win.webContents.id;
  const url = windowUrl(role);
  windows.set(id, { role, url });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (event, destination) => {
    if (destination !== url) event.preventDefault();
  });
  win.webContents.on('will-attach-webview', (event) => event.preventDefault());
  win.webContents.once('destroyed', () => windows.delete(id));
}

export function isTrustedUrl(id: number, url: string): boolean {
  return windows.get(id)?.url === url;
}

export function assertTrusted(
  event: IpcMainInvokeEvent,
  roles: Role[] = ['workspace', 'overlay'],
): void {
  const entry = windows.get(event.sender.id);
  if (
    !entry ||
    !roles.includes(entry.role) ||
    !event.senderFrame ||
    event.senderFrame !== event.sender.mainFrame ||
    event.senderFrame.url !== entry.url
  ) {
    throw new MiraError('permission_denied', 'Untrusted IPC sender');
  }
}

export function handle<Args extends unknown[]>(
  channel: string,
  listener: (event: IpcMainInvokeEvent, ...args: Args) => unknown,
  roles: Role[] = /mira:(keys:save|provider:set|settings:update|model:download|permissions:openSettings)/.test(
    channel,
  )
    ? ['workspace']
    : ['workspace', 'overlay'],
): void {
  ipcMain.handle(channel, (event, ...args: unknown[]) => {
    assertTrusted(event, roles);
    return listener(event, ...(args as Args));
  });
}
