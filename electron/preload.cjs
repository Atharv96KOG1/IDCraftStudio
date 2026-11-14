// Exposes a small, fixed API to the page. The page gets no Node.js access.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('idcraft', {
  license: {
    status: () => ipcRenderer.invoke('license:status'),
    activate: (key) => ipcRenderer.invoke('license:activate', String(key)),
    deactivate: () => ipcRenderer.invoke('license:deactivate'),
  },
  copyText: (text) => ipcRenderer.invoke('clipboard:write', String(text)),
  version: () => ipcRenderer.invoke('app:version'),
  files: {
    save: (sub, name, data) => ipcRenderer.invoke('files:save', String(sub), String(name), data),
    openFolder: (sub) => ipcRenderer.invoke('files:openFolder', String(sub)),
    reveal: (file) => ipcRenderer.invoke('files:reveal', String(file)),
    baseDir: () => ipcRenderer.invoke('files:baseDir'),
    chooseBaseDir: () => ipcRenderer.invoke('files:chooseBaseDir'),
    list: (sub, ext) => ipcRenderer.invoke('files:list', String(sub), ext ? String(ext) : ''),
    read: (file) => ipcRenderer.invoke('files:read', String(file)),
  },
  onFlush: (save) => {
    ipcRenderer.on('app:flush', async () => {
      try {
        await save();
      } finally {
        ipcRenderer.invoke('app:flushed');
      }
    });
  },
});
