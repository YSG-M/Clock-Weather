'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktop', {
  setAlwaysOnTop: (on) => ipcRenderer.send('set-always-on-top', !!on),
  openExternal: (url) => ipcRenderer.send('open-external', String(url)),
});
