'use strict';
/* ==========================================================
   FRONTIER'S END — başlatıcı
   ========================================================== */
window.addEventListener('load', () => {
  I18N.setLang(I18N.detect());
  Input.init();
  UI.init();
  G.resetState();
  G.init();
  UI.showMainMenu();
  // F11: tam ekran (tarayıcıda ve masaüstünde)
  window.addEventListener('keydown', (e) => { if (e.code === 'F11') { e.preventDefault(); Platform.toggleFullscreen(); } });
  // pencere odağı kaybedince (Alt+Tab, Steam arayüzü) oyunu duraklat
  window.addEventListener('blur', () => { if (G.state === 'play' && !UI.isModal()) UI.openPause(); });
  // masaüstü: pencere kapatılırken oyunu kaydet
  if (Platform.native && Platform.native.onClosing) Platform.native.onClosing(() => {
    try { if (G.state === 'play') G.saveGame(true); } catch (e) {}
    Platform.quit();
  });
  // ilk kullanıcı etkileşiminde ses bağlamını aç
  const unlock = () => { Audio_.unlock(); window.removeEventListener('pointerdown', unlock); };
  window.addEventListener('pointerdown', unlock);
});
