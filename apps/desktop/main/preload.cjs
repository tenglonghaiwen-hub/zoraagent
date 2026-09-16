const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('zoraDesktop', {
  downloadMedia: (url, name) => ipcRenderer.invoke('zora:download-media', {url, name}),
  platform: process.platform,
  shell: 'electron',
});
