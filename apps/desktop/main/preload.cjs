const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('zoraDesktop', {
  downloadMedia: (url, name) => ipcRenderer.invoke('zora:download-media', {url, name}),
  update: action => ipcRenderer.invoke('zora:update', action),
  mediaStartup: retry => ipcRenderer.invoke('zora:media-startup', Boolean(retry)),
  chooseVoice: () => ipcRenderer.invoke('zora:choose-voice'),
  network: value => ipcRenderer.invoke('zora:network', value),
  installVCRuntime: () => ipcRenderer.invoke('zora:install-vcredist'),
  platform: process.platform,
  shell: 'electron',
});
