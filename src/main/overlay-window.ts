import { app, BrowserWindow, screen } from 'electron';
import path from 'node:path';
import { secureWindow, windowUrl } from './security';

const WIDTH = 460;
const HEIGHT = 96;
const MARGIN_BOTTOM = 80;

let overlay: BrowserWindow | null = null;
let ready = false;
let pendingChannel: string | null = null;

function repositionToScreenCenter(win: BrowserWindow): void {
  const cursor = screen.getCursorScreenPoint();
  const display = screen.getDisplayNearestPoint(cursor);
  const { x, y, width, height } = display.workArea;
  const winX = Math.round(x + (width - WIDTH) / 2);
  const winY = Math.round(y + height - HEIGHT - MARGIN_BOTTOM);
  win.setBounds({ x: winX, y: winY, width: WIDTH, height: HEIGHT });
}

export function getOrCreateOverlay(): BrowserWindow {
  if (overlay && !overlay.isDestroyed()) return overlay;
  ready = false;
  pendingChannel = null;
  const win = new BrowserWindow({
    width: WIDTH,
    height: HEIGHT,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    hasShadow: false,
    focusable: false,
    backgroundColor: '#00000000',
    type: process.platform === 'darwin' ? 'panel' : undefined,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: path.join(app.getAppPath(), 'dist-electron', 'preload.cjs'),
      backgroundThrottling: false,
    },
  });
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.setAlwaysOnTop(true, 'screen-saver');

  secureWindow(win, 'overlay');
  void win.loadURL(windowUrl('overlay'));

  win.on('closed', () => {
    if (overlay === win) overlay = null;
  });

  overlay = win;
  return win;
}

export function showOverlay(autoRecord: boolean): void {
  const win = getOrCreateOverlay();
  repositionToScreenCenter(win);
  win.showInactive();
  sendWhenReady(win, autoRecord ? 'mira:overlay:show' : 'mira:overlay:hide');
}

export function toggleOverlay(): void {
  const win = getOrCreateOverlay();
  if (win.isVisible()) {
    if (!ready) {
      pendingChannel = null;
      win.hide();
      return;
    }
    win.webContents.send('mira:overlay:toggle');
  } else {
    repositionToScreenCenter(win);
    win.showInactive();
    sendWhenReady(win, 'mira:overlay:show');
  }
}

function sendWhenReady(win: BrowserWindow, channel: string): void {
  if (!ready) pendingChannel = channel;
  else win.webContents.send(channel);
}

export function markOverlayReady(sender: number): void {
  if (!overlay || overlay.isDestroyed() || overlay.webContents.id !== sender) return;
  ready = true;
  if (pendingChannel && overlay.isVisible()) overlay.webContents.send(pendingChannel);
  pendingChannel = null;
}

export function hideOverlay(): void {
  pendingChannel = null;
  if (overlay && !overlay.isDestroyed() && overlay.isVisible()) {
    overlay.hide();
  }
}

export function destroyOverlay(): void {
  if (overlay && !overlay.isDestroyed()) {
    overlay.destroy();
  }
  overlay = null;
}
