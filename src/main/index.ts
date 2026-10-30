import {
  app,
  BrowserWindow,
  session,
  ipcMain,
  globalShortcut,
  Tray,
  Menu,
  nativeImage,
} from 'electron';
import path from 'node:path';
import { registerIpc } from './ipc';
import { toggleOverlay, destroyOverlay } from './overlay-window';
import { handle, isTrustedUrl, secureWindow, windowUrl } from './security';

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;
const isDev = process.env.NODE_ENV === 'development' && !app.isPackaged;

function showMainWindow(): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    const win = new BrowserWindow({
      width: 1180,
      height: 800,
      minWidth: 800,
      minHeight: 600,
      backgroundColor: '#09090b',
      title: 'Mira',
      titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        preload: path.join(app.getAppPath(), 'dist-electron', 'preload.cjs'),
      },
    });
    secureWindow(win, 'workspace');
    void win.loadURL(windowUrl('workspace'));
    if (isDev) win.webContents.openDevTools({ mode: 'detach' });
    win.on('close', (event) => {
      if (!isQuitting) {
        event.preventDefault();
        win.hide();
      }
    });
    win.on('closed', () => {
      if (mainWindow === win) mainWindow = null;
    });
    mainWindow = win;
  }
  mainWindow.show();
  mainWindow.focus();
}

function createTray(): void {
  const pixels = Buffer.alloc(16 * 16 * 4);
  for (let i = 0; i < pixels.length; i += 4) {
    pixels[i] = 167;
    pixels[i + 1] = 139;
    pixels[i + 2] = 250;
    pixels[i + 3] = 255;
  }
  tray = new Tray(nativeImage.createFromBitmap(pixels, { width: 16, height: 16 }));
  tray.setToolTip('Mira — voice workspace');
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Open Mira', click: showMainWindow },
      { label: 'Record voice', click: toggleOverlay },
      { type: 'separator' },
      { label: 'Quit Mira', click: () => app.quit() },
    ]),
  );
  tray.on('double-click', showMainWindow);
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (app.isReady()) showMainWindow();
  });
  void app.whenReady().then(() => {
    registerIpc();
    handle('mira:window:show', () => {
      showMainWindow();
      return { ok: true };
    });
    handle('mira:window:hide', () => {
      mainWindow?.hide();
      return { ok: true };
    });
    session.defaultSession.setPermissionCheckHandler(
      (wc, permission) => !!wc && isTrustedUrl(wc.id, wc.getURL()) && permission === 'media',
    );
    session.defaultSession.setPermissionRequestHandler((wc, permission, callback, details) => {
      callback(
        isTrustedUrl(wc.id, wc.getURL()) &&
          permission === 'media' &&
          'mediaTypes' in details &&
          details.mediaTypes?.every((type) => type === 'audio') === true,
      );
    });
    // Screen capture stays disabled until a user-controlled source picker ships.
    session.defaultSession.setDisplayMediaRequestHandler((_request, callback) => callback({}));
    showMainWindow();
    createTray();
    for (const [shortcut, action] of [
      ['CommandOrControl+Shift+Space', toggleOverlay],
      ['CommandOrControl+Shift+M', showMainWindow],
    ] as const) {
      if (!globalShortcut.register(shortcut, action))
        console.warn(`Shortcut unavailable: ${shortcut}`);
    }
  });
  app.on('activate', showMainWindow);
  app.on('window-all-closed', () => {
    /* Tray owns app lifetime. */
  });
  app.on('before-quit', () => {
    isQuitting = true;
    globalShortcut.unregisterAll();
    destroyOverlay();
    tray?.destroy();
  });
  ipcMain.on('window-minimize', (event) => {
    if (isTrustedUrl(event.sender.id, event.sender.getURL()))
      BrowserWindow.fromWebContents(event.sender)?.minimize();
  });
  ipcMain.on('window-close', (event) => {
    if (isTrustedUrl(event.sender.id, event.sender.getURL()))
      BrowserWindow.fromWebContents(event.sender)?.close();
  });
}
