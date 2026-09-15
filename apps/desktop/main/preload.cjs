const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('zoraDesktop', {
  platform: process.platform,
  shell: 'electron',
});
