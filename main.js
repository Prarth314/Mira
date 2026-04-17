
const { app, BrowserWindow, session, desktopCapturer, ipcMain } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    backgroundColor: '#000000',
    frame: false, // Frameless for the Neural OS look
    titleBarStyle: 'hidden',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  win.loadFile('index.html');

  // Handle screen capture source selection for the Live API
  session.defaultSession.setDisplayMediaRequestHandler((request, callback) => {
    desktopCapturer.getSources({ types: ['screen', 'window'] }).then((sources) => {
      // Grant access to the first screen by default for the "actuator" experience
      callback({ video: sources[0], audio: 'loopback' });
    });
  });

  // Hardware Permissions
  session.defaultSession.setPermissionCheckHandler((webContents, permission) => {
    if (permission === 'mediaKeySystem' || permission === 'microphone' || permission === 'display-capture') {
      return true;
    }
    return false;
  });

  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    callback(true);
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// Window control handlers
ipcMain.on('window-minimize', () => BrowserWindow.getFocusedWindow()?.minimize());
ipcMain.on('window-close', () => BrowserWindow.getFocusedWindow()?.close());
