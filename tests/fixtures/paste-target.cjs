const { app, BrowserWindow } = require('electron');
app.whenReady().then(() => {
  const window = new BrowserWindow({
    width: 600,
    height: 220,
    title: 'Mira controlled paste fixture',
    webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true },
  });
  window.loadURL(
    'data:text/html,<title>Mira controlled paste fixture</title><label for="target">Controlled paste target</label><textarea id="target" autofocus rows="5" cols="60"></textarea>',
  );
});
app.on('window-all-closed', () => app.quit());
