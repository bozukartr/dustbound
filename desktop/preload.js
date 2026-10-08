'use strict';
/* ==========================================================
   FRONTIER'S END — oyun sayfasına açılan dar köprü (window.native)
   Oyun tarafında js/platform.js bunu kullanır; tarayıcıda yoktur.
   ========================================================== */
const { contextBridge, ipcRenderer } = require('electron');
// ana süreçten gelen açılış bilgileri (--fe-ad=değer)
const arg = (k) => { const a = process.argv.find(x => x.startsWith(`--fe-${k}=`)); return a ? a.slice(k.length + 6) : null; };

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
  keyboard: (x, y, w, h) => ipcRenderer.send('steam:keyboard', x, y, w, h),
  isFullscreen: () => ipcRenderer.sendSync('win:isFullscreen'),
  setFullscreen: (on) => ipcRenderer.send('win:fullscreen', on),
  quit: () => ipcRenderer.send('app:quit'),
  relaunch: () => ipcRenderer.send('app:relaunch'),
  onClosing: (cb) => ipcRenderer.on('app:closing', () => cb()),
  // ekran kartı: bu açılışta uygulanan tercih (auto | high | low), bulunan kartlar, yeni tercih (yeniden başlatınca)
  gpuLaunch: arg('gpu') || 'auto',
  gpuInfo: () => ipcRenderer.invoke('gpu:info'),
  setGpu: (pref) => ipcRenderer.send('gpu:set', pref),
});
