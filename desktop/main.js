'use strict';
/* ==========================================================
   FRONTIER'S END — masaüstü (Electron) ana süreci

   - Oyunu app/ klasöründen (scripts/prepare.js ile kopyalanır) açar.
   - Steamworks (steamworks.js) yalnızca bu süreçte çalışır; oyun
     sayfası preload.js üzerinden dar bir köprüyle erişir.
   - Kayıtlar kullanıcı klasörüne JSON dosyası olarak yazılır
     (Windows: %APPDATA%/Frontier's End/saves). Steam Auto-Cloud bu
     klasörü eşitleyecek şekilde ayarlanır (desktop/README.md).
   ========================================================== */
const { app, BrowserWindow, ipcMain, Menu, shell } = require('electron');
const path = require('path');
const fs = require('fs');

const PKG = require('./package.json');
const DEV = process.argv.includes('--dev') || !app.isPackaged;
const APP_ID = Number(process.env.STEAM_APP_ID || PKG.steamAppId || 0);

app.setName(PKG.productName);

/* ---------------- Steam ---------------- */
let steam = null, steamworks = null;
try {
  steamworks = require('steamworks.js');
  // Paketlenmiş sürüm Steam dışından açılırsa Steam üzerinden yeniden başlat
  if (!DEV && APP_ID && APP_ID !== 480 && steamworks.restartAppIfNecessary(APP_ID)) { app.exit(0); }
  steam = steamworks.init(APP_ID || undefined);
} catch (e) {
  console.warn('[steam] kapalı:', e && e.message);
  steam = null;
}
if (steam) {
  // Steam arayüzünün (Shift+Tab) Electron penceresinde çizilebilmesi için
  try { steamworks.electronEnableSteamOverlay(); } catch (e) { console.warn('[steam] overlay:', e.message); }
}
const steamCall = (fn, fallback) => { if (!steam) return fallback; try { return fn(); } catch (e) { console.warn('[steam]', e.message); return fallback; } };

/* ---------------- Kayıt dosyaları ---------------- */
const SAVE_DIR = path.join(app.getPath('userData'), 'saves');
const DESK_CFG = path.join(app.getPath('userData'), 'desktop.json');
fs.mkdirSync(SAVE_DIR, { recursive: true });
const fileOf = (key) => path.join(SAVE_DIR, String(key).replace(/[^a-z0-9_.-]/gi, '_') + '.json');
function readStore(key) {
  for (const f of [fileOf(key), fileOf(key) + '.bak']) {
    try { const s = fs.readFileSync(f, 'utf8'); if (s) return s; } catch (e) {}
  }
  return null;
}
/* Güvenli yazım: önce geçici dosya, sonra yeniden adlandır; bir önceki sürüm .bak olarak kalır */
function writeStore(key, value) {
  const f = fileOf(key), tmp = f + '.tmp';
  try {
    fs.writeFileSync(tmp, value, 'utf8');
    if (fs.existsSync(f)) fs.copyFileSync(f, f + '.bak');
    fs.renameSync(tmp, f);
    return true;
  } catch (e) { console.error('[store]', e); return false; }
}
function removeStore(key) { for (const f of [fileOf(key), fileOf(key) + '.bak']) { try { fs.unlinkSync(f); } catch (e) {} } }

let deskCfg = { fullscreen: true };
try { Object.assign(deskCfg, JSON.parse(fs.readFileSync(DESK_CFG, 'utf8'))); } catch (e) {}
const saveDeskCfg = () => { try { fs.writeFileSync(DESK_CFG, JSON.stringify(deskCfg)); } catch (e) {} };

/* ---------------- Pencere ---------------- */
let win = null, allowClose = false;
function createWindow() {
  win = new BrowserWindow({
    width: 1280, height: 720, minWidth: 960, minHeight: 540,
    fullscreen: !!deskCfg.fullscreen,
    backgroundColor: '#0b0806',
    title: PKG.productName,
    icon: path.join(__dirname, 'build', 'icon.png'),
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
      devTools: DEV,
    },
  });
  Menu.setApplicationMenu(null);
  win.once('ready-to-show', () => win.show());
  win.loadFile(path.join(__dirname, 'app', 'index.html'));
  // dış bağlantılar sistem tarayıcısında açılsın, oyun sayfası başka yere gitmesin
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https:/.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e) => e.preventDefault());
  if (DEV) win.webContents.on('before-input-event', (e, input) => { if (input.type === 'keyDown' && input.key === 'F12') win.webContents.toggleDevTools(); });
  win.on('enter-full-screen', () => { deskCfg.fullscreen = true; saveDeskCfg(); });
  win.on('leave-full-screen', () => { deskCfg.fullscreen = false; saveDeskCfg(); });
  // Kapatılırken oyuna kaydetme fırsatı ver; oyun hazır değilse ya da cevap vermezse yine kapan
  win.on('close', (e) => {
    if (allowClose) return;
    e.preventDefault();
    allowClose = true;
    try { win.webContents.send('app:closing'); } catch (err) { app.quit(); }
    setTimeout(() => app.quit(), 1500);
  });
  win.on('closed', () => { win = null; });
}

/* ---------------- Köprü (preload.js) ---------------- */
ipcMain.on('store:get', (e, key) => { e.returnValue = readStore(key); });
ipcMain.on('store:set', (e, key, value) => { e.returnValue = writeStore(key, value); });
ipcMain.on('store:remove', (e, key) => { removeStore(key); e.returnValue = true; });
ipcMain.on('steam:info', (e) => {
  e.returnValue = steam ? {
    enabled: true,
    appId: steamCall(() => steam.utils.getAppId(), APP_ID),
    lang: steamCall(() => steam.apps.currentGameLanguage(), null),
    deck: steamCall(() => steam.utils.isSteamRunningOnSteamDeck(), false),
    name: steamCall(() => steam.localplayer.getName(), ''),
  } : { enabled: false };
});
ipcMain.on('steam:achievement', (e, api) => { steamCall(() => { if (!steam.achievement.isActivated(api)) steam.achievement.activate(api); }); });
ipcMain.on('steam:presence', (e, key, value) => { steamCall(() => steam.localplayer.setRichPresence(key, value || null)); });
ipcMain.on('win:isFullscreen', (e) => { e.returnValue = !!(win && win.isFullScreen()); });
ipcMain.on('win:fullscreen', (e, on) => { if (win) win.setFullScreen(!!on); });
ipcMain.on('app:quit', () => { allowClose = true; app.quit(); });

/* ---------------- Yaşam döngüsü ---------------- */
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
  app.whenReady().then(createWindow);
  app.on('window-all-closed', () => app.quit());
}
