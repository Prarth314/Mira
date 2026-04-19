import { app, BrowserWindow, session, desktopCapturer, ipcMain, globalShortcut } from 'electron';
import path from 'node:path';
import { registerIpc } from './ipc';
import { hideOverlay, toggleOverlay, destroyOverlay } from './overlay-window';

const isDev = process.env.NODE_ENV === 'development';
const DEV_URL = 'http://localhost:5173';
const HOTKEY = 'Alt+Space'; // Option+Space on macOS

let mainWindow: BrowserWindow | null = null;
let isQuitting = false;

function createMainWindow(): BrowserWindow {
  if (mainWindow && !mainWindow.isDestroyed()) return mainWindow;
  const win = new BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 760,
    minHeight: 480,
    backgroundColor: '#09090b',
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, '..', '..', 'preload.js'),
    },
  });

  if (isDev) {
    void win.loadURL(DEV_URL);
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    void win.loadFile(path.join(__dirname, '..', '..', 'dist', 'index.html'));
  }

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
  return win;
}

function showMainWindow(): void {
  const win = createMainWindow();
  if (!win.isVisible()) win.show();
  win.focus();
}

void app.whenReady().then(() => {
  registerIpc();
  ipcMain.handle('mira:window:show', () => {
    showMainWindow();
    return { ok: true };
  });
  ipcMain.handle('mira:window:hide', () => {
    mainWindow?.hide();
    return { ok: true };
  });

  session.defaultSession.setDisplayMediaRequestHandler((_request, callback) => {
    void desktopCapturer.getSources({ types: ['screen', 'window'] }).then((sources) => {
      callback({ video: sources[0], audio: 'loopback' });
    });
  });
  session.defaultSession.setPermissionCheckHandler((_wc, permission) =>
    permission === 'media' || permission === 'mediaKeySystem',
  );
  session.defaultSession.setPermissionRequestHandler((_wc, _permission, callback) => {
    callback(true);
  });

  createMainWindow();

  const ok = globalShortcut.register(HOTKEY, () => {
    toggleOverlay();
  });
  if (!ok) {
    console.warn(`Failed to register global hotkey ${HOTKEY}`);
  }
});

app.on('window-all-closed', () => {
  // Keep app alive even when all windows are closed; the overlay + hotkey
  // need the process to stay running. Cmd+Q exits properly via before-quit.
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().filter((w) => !w.isDestroyed() && w.getTitle() !== 'Mira Overlay').length === 0) {
    createMainWindow();
  } else {
    showMainWindow();
  }
});

app.on('before-quit', () => {
  isQuitting = true;
  globalShortcut.unregisterAll();
  destroyOverlay();
});

ipcMain.on('window-minimize', () => BrowserWindow.getFocusedWindow()?.minimize());
ipcMain.on('window-close', () => BrowserWindow.getFocusedWindow()?.close());
