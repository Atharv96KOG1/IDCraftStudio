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
