'use strict';
/* ==========================================================
   FRONTIER'S END — oyun sayfasına açılan dar köprü (window.native)
   Oyun tarafında js/platform.js bunu kullanır; tarayıcıda yoktur.
   ========================================================== */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('native', {
  platform: process.platform,
  store: {
    get: (key) => ipcRenderer.sendSync('store:get', key),
    set: (key, value) => ipcRenderer.sendSync('store:set', key, value),
    remove: (key) => ipcRenderer.sendSync('store:remove', key),
  },
  steamInfo: () => ipcRenderer.sendSync('steam:info'),
  achievement: (api) => ipcRenderer.send('steam:achievement', api),
  presence: (key, value) => ipcRenderer.send('steam:presence', key, value),
  isFullscreen: () => ipcRenderer.sendSync('win:isFullscreen'),
  setFullscreen: (on) => ipcRenderer.send('win:fullscreen', on),
  quit: () => ipcRenderer.send('app:quit'),
  onClosing: (cb) => ipcRenderer.on('app:closing', () => cb()),
});
