const { contextBridge, ipcRenderer } = require('electron');
function on(channel, callback) {
  const handler = (_event, data) => callback(data);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
}
contextBridge.exposeInMainWorld('mira', {
  desktop: { status: () => ipcRenderer.invoke('mira:desktop:status') },
  keys: {
    status: () => ipcRenderer.invoke('mira:keys:status'),
    save: (provider, key) => ipcRenderer.invoke('mira:keys:save', { provider, key }),
  },
  provider: {
    get: () => ipcRenderer.invoke('mira:provider:get'),
    set: (name) => ipcRenderer.invoke('mira:provider:set', { name }),
  },
  settings: {
    get: () => ipcRenderer.invoke('mira:settings:get'),
    update: (patch) => ipcRenderer.invoke('mira:settings:update', patch),
    reset: () => ipcRenderer.invoke('mira:settings:reset'),
  },
  permissions: {
    probe: () => ipcRenderer.invoke('mira:permissions:probe'),
    requestMic: () => ipcRenderer.invoke('mira:permissions:requestMic'),
    openSettings: (what) => ipcRenderer.invoke('mira:permissions:openSettings', { what }),
  },
  model: {
    status: () => ipcRenderer.invoke('mira:model:status'),
    download: () => ipcRenderer.invoke('mira:model:download'),
    cancel: () => ipcRenderer.invoke('mira:model:cancel'),
    onProgress: (callback) => on('mira:model:progress', callback),
  },
  window: {
    show: () => ipcRenderer.invoke('mira:window:show'),
    hide: () => ipcRenderer.invoke('mira:window:hide'),
  },
  overlay: {
    ready: () => ipcRenderer.invoke('mira:overlay:ready'),
    open: () => ipcRenderer.invoke('mira:overlay:open'),
    hide: () => ipcRenderer.invoke('mira:overlay:hide'),
    onShow: (callback) => on('mira:overlay:show', callback),
    onToggle: (callback) => on('mira:overlay:toggle', callback),
    onHide: (callback) => on('mira:overlay:hide', callback),
  },
  studio: {
    state: () => ipcRenderer.invoke('mira:studio:get'),
    onState: (callback) => on('mira:studio:state', callback),
    start: (mode) => ipcRenderer.invoke('mira:studio:start', mode),
    chunk: (id, data) => ipcRenderer.invoke('mira:studio:chunk', { id, data }),
    finish: (id) => ipcRenderer.invoke('mira:studio:finish', id),
    cancel: (id) => ipcRenderer.invoke('mira:studio:cancel', id),
    prepare: (prompt, mode) => ipcRenderer.invoke('mira:studio:prepare', { prompt, mode }),
    refine: (id) => ipcRenderer.invoke('mira:studio:refine', id),
    edit: (id, prompt) => ipcRenderer.invoke('mira:studio:edit', { id, prompt }),
    correct: (id, suggestionId, path, remember) =>
      ipcRenderer.invoke('mira:studio:correct', { id, suggestionId, path, remember }),
    copy: (id) => ipcRenderer.invoke('mira:studio:copy', id),
    deliver: (id) => ipcRenderer.invoke('mira:studio:deliver', id),
    discard: (id) => ipcRenderer.invoke('mira:studio:discard', id),
  },
  project: {
    status: () => ipcRenderer.invoke('mira:project:status'),
    refresh: () => ipcRenderer.invoke('mira:project:refresh'),
    vocabulary: (enabled) => ipcRenderer.invoke('mira:project:vocabulary', enabled),
    alias: (phrase, path) => ipcRenderer.invoke('mira:project:alias', { phrase, path }),
    connect: () => ipcRenderer.invoke('mira:project:connect'),
    search: (query) => ipcRenderer.invoke('mira:project:search', query),
    select: (paths) => ipcRenderer.invoke('mira:project:select', { paths }),
    disconnect: () => ipcRenderer.invoke('mira:project:disconnect'),
  },
  diagnostics: {
    get: () => ipcRenderer.invoke('mira:diagnostics:get'),
    copy: () => ipcRenderer.invoke('mira:diagnostics:copy'),
  },
});
