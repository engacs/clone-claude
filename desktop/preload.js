const { contextBridge, ipcRenderer } = require('electron');

// Expose safe APIs to the Admin UI frontend
contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  sendAction: (action, data) => ipcRenderer.send('action', { action, data }),
  onUpdate: (channel, callback) => ipcRenderer.on(channel, (event, ...args) => callback(...args))
});
