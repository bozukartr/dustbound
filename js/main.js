'use strict';
/* ==========================================================
   DUSTBOUND — başlatıcı
   ========================================================== */
window.addEventListener('load', () => {
  Input.init();
  UI.init();
  G.resetState();
  G.init();
  UI.showMainMenu();
  // ilk kullanıcı etkileşiminde ses bağlamını aç
  const unlock = () => { Audio_.unlock(); window.removeEventListener('pointerdown', unlock); };
  window.addEventListener('pointerdown', unlock);
});
