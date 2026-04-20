const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  minimize: () => ipcRenderer.send('window-minimize'),
  close: () => ipcRenderer.send('window-close'),
});

function on(channel, cb) {
  const handler = (_e, data) => cb(data);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
}

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
  voice: {
    start: () => ipcRenderer.invoke('mira:voice:start'),
    chunk: (buf) => ipcRenderer.invoke('mira:voice:chunk', buf),
    end: (images) => ipcRenderer.invoke('mira:voice:end', { images }),
    cancel: () => ipcRenderer.invoke('mira:voice:cancel'),
  },
  tts: {
    speak: (text) => ipcRenderer.invoke('mira:tts:speak', { text }),
    cancel: () => ipcRenderer.invoke('mira:tts:cancel'),
  },
  permissions: {
    probe: () => ipcRenderer.invoke('mira:permissions:probe'),
    requestMic: () => ipcRenderer.invoke('mira:permissions:requestMic'),
    openSettings: (what) => ipcRenderer.invoke('mira:permissions:openSettings', { what }),
  },
  telemetry: {
    read: () => ipcRenderer.invoke('mira:telemetry:read'),
  },
  model: {
    status: () => ipcRenderer.invoke('mira:model:status'),
    download: () => ipcRenderer.invoke('mira:model:download'),
    onProgress: (cb) => on('mira:model:progress', cb),
  },
  window: {
    show: () => ipcRenderer.invoke('mira:window:show'),
    hide: () => ipcRenderer.invoke('mira:window:hide'),
  },
  overlay: {
    hide: () => ipcRenderer.invoke('mira:overlay:hide'),
    onShow: (cb) => on('mira:overlay:show', cb),
    onHide: (cb) => on('mira:overlay:hide', cb),
    onToggle: (cb) => on('mira:overlay:toggle', cb),
  },
  settings: {
    get: () => ipcRenderer.invoke('mira:settings:get'),
    update: (patch) => ipcRenderer.invoke('mira:settings:update', patch),
  },
});
