'use strict';
/* ==========================================================
   FRONTIER'S END — demo sürümü
   Bu dosya yalnızca demo paketine girer (tools/build-demo.js). Oyunun kendi
   dosyalarında hiçbir değişiklik yoktur: sınırlar, oyun yüklendikten sonra
   birkaç fonksiyonun etrafına sarılan küçük katmanlarla eklenir. Depodaki
   tam oyun bu dosyayı hiç yüklemez.
     - Yalnızca Çiftçi Çocuğu, hikâyeli başlangıç hep açık
     - Sully'nin Senedi'nin ilk sekiz bölümü; dokuzuncu bölüm (kamp ve Kızıl Jack finali) başlarken demo biter
     - Hikâye bırakılırsa sekizinci, sürerse on altıncı oyun gününün sonunda demo biter
     - Kayıtlar ve ayarlar tam oyununkilerden ayrı tutulur
   ========================================================== */
(() => {
  const DEMO = { lastCh: 8, freeDays: 8, days: 16, url: '' };
  window.DEMO = DEMO;
  const T = (tr, en) => (typeof I18N !== 'undefined' && I18N.lang === 'en' ? en : tr);

  /* ayrı kayıt ve ayarlar: tam oyunun kayıtlarıyla karışmaz */
  for (const k of ['get', 'set', 'remove']) { const f = Platform[k].bind(Platform); Platform[k] = (key, ...a) => f('demo_' + key, ...a); }

  /* yalnızca Çiftçi Çocuğu */
  for (let i = BACKGROUNDS.length - 1; i >= 0; i--) if (BACKGROUNDS[i].id !== 'farm') BACKGROUNDS.splice(i, 1);
  const newGame = G.newGame;
  G.newGame = function (profile) { return newGame.call(this, Object.assign({}, profile, { bg: 'farm', story: true })); };

  /* sınırlar: dokuzuncu bölümün başı ya da gün sınırı */
  let ended = false;
  const qChapter = G.qChapter;
  G.qChapter = function (i) {
    const S = this.story;
    if (i >= DEMO.lastCh && S && (S.id || 'sully') === 'sully') {
      // kayıt dokuzuncu bölümün başında dursun: yeniden yüklenince demo sonu yine açılır
      S.ch = i; S.st = -1; S.wait = true;
      demoEnd(); return;
    }
    return qChapter.call(this, i);
  };
  const update = G.update;
  G.update = function (dt) {
    if (ended) { this.state = 'demo'; return; }   // kayıt yüklenirken oyun yeniden açılmasın
    update.call(this, dt);
    const S = this.story, day = Math.floor(this.clock / 1440);
    if (this.state === 'play' && day >= (S && S.on && !S.done ? DEMO.days : DEMO.freeDays)) demoEnd();
  };

  function demoEnd() {
    if (ended) return;
    ended = true;
    if (G.state === 'play') try { G.saveGame(true); } catch (e) {}   // kayıt yüklenirken yazma
    G.state = 'demo';
    try { UI.closeAll(); } catch (e) {}
    const el = document.createElement('div');
    el.id = 'demo-end';
    el.setAttribute('style', 'position:fixed;inset:0;z-index:500;display:flex;align-items:center;justify-content:center;background:radial-gradient(ellipse at center, rgba(40,26,14,0.92), rgba(10,7,4,0.97));color:#efe2c4;text-align:center;font-family:inherit');
    el.innerHTML = `<div style="max-width:620px;padding:32px">
      <div style="letter-spacing:0.3em;font-size:14px;color:#c9a45c">${T('DEMO SONU', 'END OF DEMO')}</div>
      <h1 style="font-size:44px;margin:14px 0 18px">Frontier's End</h1>
      <p style="font-size:18px;line-height:1.55;margin:0 0 10px">${T('Sully\'nin Senedi burada bitmiyor: tapuyu çalan çete hâlâ dışarıda.', 'Sully\'s Deed doesn\'t end here: the gang that stole the deed is still out there.')}</p>
      <p style="font-size:16px;line-height:1.55;opacity:0.85;margin:0 0 26px">${T('Tam sürümde beş geçmiş, beş hikâye, on üç kasaba ve 80 yaşına kadar süren bir hayat seni bekliyor.', 'The full game has five backgrounds, five stories, thirteen towns and a whole life to live until 80.')}</p>
      <div style="display:flex;gap:14px;justify-content:center;flex-wrap:wrap">
        ${DEMO.url ? `<a id="demo-follow" href="${DEMO.url}" target="_blank" rel="noopener" style="padding:12px 22px;border:1px solid #c9a45c;color:#f3e3bd;text-decoration:none">${T('Tam Sürümü Takip Et', 'Follow the Full Game')}</a>` : ''}
        <button id="demo-menu" style="padding:12px 22px;border:1px solid #8a6a48;background:#2a1c12;color:#f3e3bd;font:inherit;cursor:pointer">${Input.glyph('confirm')} ${T('Ana Menü', 'Main Menu')}</button>
      </div>
      <p style="font-size:13px;opacity:0.6;margin-top:22px">${T('Oynadığın için teşekkürler.', 'Thanks for playing.')}</p></div>`;
    document.body.appendChild(el);
    el.querySelector('#demo-menu').onclick = () => { el.remove(); ended = false; G.state = 'menu'; UI.closeAll(); UI.showMainMenu(); };
  }
  DEMO.end = demoEnd;
  // klavye ve oyun kolu: Onayla ya da Geri ana menüye döner
  const uiUpdate = UI.update;
  UI.update = function (...a) {
    const b = ended && document.getElementById('demo-menu');
    if (b && (Input.pressed('confirm') || Input.pressed('back'))) { Input.consume('confirm'); Input.consume('back'); b.click(); return; }
    return uiUpdate.apply(this, a);
  };

  /* ana menüde DEMO işareti */
  const showMainMenu = UI.showMainMenu;
  UI.showMainMenu = function (...a) {
    const r = showMainMenu.apply(this, a);
    const v = document.querySelector('#mm-foot .mm-ver'); if (v && !/DEMO/.test(v.textContent)) v.textContent += ' · DEMO';
    const s = document.querySelector('#mainmenu .mm-sub');
    if (s && !document.getElementById('demo-tag')) s.insertAdjacentHTML('afterend', '<div id="demo-tag" class="mm-pre" style="margin-top:6px"></div>');
    const tag = document.getElementById('demo-tag'); if (tag) tag.textContent = T('Demo — Çiftçi Çocuğu, ilk sekiz bölüm', 'Demo — Farm Kid, first eight chapters');
    return r;
  };
})();
