const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  minimize: () => ipcRenderer.send('window-minimize'),
  close: () => ipcRenderer.send('window-close'),
});

contextBridge.exposeInMainWorld('mira', {
  keys: {
    status: () => ipcRenderer.invoke('mira:keys:status'),
    save: (provider, key) => ipcRenderer.invoke('mira:keys:save', { provider, key }),
  },
  provider: {
    get: () => ipcRenderer.invoke('mira:provider:get'),
    set: (name) => ipcRenderer.invoke('mira:provider:set', { name }),
  },
  conversation: {
    reset: () => ipcRenderer.invoke('mira:conversation:reset'),
  },
  chat: (userText, images) => ipcRenderer.invoke('mira:chat', { userText, images }),
});
