import { describe, expect, it, vi } from 'vitest';
import type { BrowserWindow, IpcMainInvokeEvent } from 'electron';
const mock = vi.hoisted(() => ({ handlers: new Map<string, (...args: unknown[]) => unknown>() }));
vi.mock('electron', () => ({
  app: { isPackaged: true, getAppPath: () => '/synthetic-mira' },
  ipcMain: {
    handle: (name: string, fn: (...args: unknown[]) => unknown) => mock.handlers.set(name, fn),
  },
}));
import { assertTrusted, handle, secureWindow, windowUrl } from '../../src/main/security';

function window(id: number, role: 'workspace' | 'overlay') {
  const events = new Map<string, (...args: unknown[]) => void>();
  let open: () => { action: string };
  const win = {
    webContents: {
      id,
      setWindowOpenHandler: (fn: typeof open) => {
        open = fn;
      },
      on: (name: string, fn: (...args: unknown[]) => void) => events.set(name, fn),
      once: (name: string, fn: (...args: unknown[]) => void) => events.set(name, fn),
    },
  };
  secureWindow(win as unknown as BrowserWindow, role);
  const frame = { url: windowUrl(role) };
  const event = {
    sender: { id, mainFrame: frame },
    senderFrame: frame,
  } as unknown as IpcMainInvokeEvent;
  return { event, events, open: () => open() };
}
describe('actual privileged IPC and navigation policy', () => {
  it('rejects unregistered windows, child frames, remote URLs and wrong roles', () => {
    const { event } = window(10, 'workspace');
    expect(() => assertTrusted(event, ['workspace'])).not.toThrow();
    expect(() =>
      assertTrusted({
        ...event,
        senderFrame: { url: windowUrl('workspace') },
      } as IpcMainInvokeEvent),
    ).toThrow();
    expect(() =>
      assertTrusted({ ...event, sender: { ...event.sender, id: 999 } } as IpcMainInvokeEvent),
    ).toThrow();
    expect(() => assertTrusted(event, ['overlay'])).toThrow();
    (event.senderFrame as unknown as { url: string }).url = 'https://example.invalid';
    expect(() => assertTrusted(event)).toThrow();
  });
  it('wraps real registered handlers and blocks overlay key writes', () => {
    const workspace = window(20, 'workspace');
    const overlay = window(21, 'overlay');
    const action = vi.fn();
    handle('mira:keys:save', action);
    expect(() => mock.handlers.get('mira:keys:save')!(overlay.event)).toThrow();
    mock.handlers.get('mira:keys:save')!(workspace.event);
    expect(action).toHaveBeenCalledTimes(1);
  });
  it('denies popups, webviews and external navigation and unregisters destroyed windows', () => {
    const target = window(30, 'workspace');
    const preventDefault = vi.fn();
    expect(target.open()).toEqual({ action: 'deny' });
    target.events.get('will-navigate')!({ preventDefault }, 'https://example.invalid');
    target.events.get('will-attach-webview')!({ preventDefault });
    expect(preventDefault).toHaveBeenCalledTimes(2);
    target.events.get('destroyed')!();
    expect(() => assertTrusted(target.event)).toThrow();
  });
});
