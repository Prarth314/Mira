import { BrowserWindow, screen } from 'electron';
import path from 'node:path';

const WIDTH = 460;
const HEIGHT = 96;
const MARGIN_BOTTOM = 80;

let overlay: BrowserWindow | null = null;

function urlOrFile(): string | { file: string } {
  const isDev = process.env.NODE_ENV === 'development';
  if (isDev) return 'http://localhost:5173/overlay.html';
  return { file: path.join(__dirname, '..', '..', 'dist', 'overlay.html') };
}

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
      preload: path.join(__dirname, '..', '..', 'preload.js'),
      backgroundThrottling: false,
    },
  });
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.setAlwaysOnTop(true, 'screen-saver');

  const dest = urlOrFile();
  if (typeof dest === 'string') void win.loadURL(dest);
  else void win.loadFile(dest.file);

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
  win.webContents.send(autoRecord ? 'mira:overlay:show' : 'mira:overlay:hide');
}

export function toggleOverlay(): void {
  const win = getOrCreateOverlay();
  if (win.isVisible()) {
    win.webContents.send('mira:overlay:toggle');
  } else {
    repositionToScreenCenter(win);
    win.showInactive();
    win.webContents.send('mira:overlay:show');
  }
}

export function hideOverlay(): void {
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
