'use strict';
/* ==========================================================
   FRONTIER'S END — platform katmanı

   Oyun aynı kodla hem tarayıcıda hem masaüstünde (Electron + Steam)
   çalışır. Masaüstü sürümünde desktop/preload.js, window.native
   köprüsünü tanımlar; tarayıcıda bu köprü yoktur ve her şey web
   karşılığına düşer:

     kayıt/ayar      → masaüstü: kullanıcı klasöründe JSON dosyaları
                       (Steam Auto-Cloud bu klasörü eşitler)
                       web: localStorage
     başarımlar      → Steam başarımları (ACH_<KİMLİK>), web'de yok
     rich presence   → Steam arkadaş listesinde "18 yaşında · Harlow"
     çıkış/tam ekran → pencereyi kapat / tam ekran; web'de Fullscreen API
     dil             → Steam istemcisinin oyun dili
     ekran klavyesi  → Steam Deck'te yazı kutusu odaklanınca Steam klavyesi
   ========================================================== */
const Platform = {
  native: (typeof window !== 'undefined' && window.native) || null,
  info: null,

  get desktop() { return !!this.native; },
  get steam() { return !!(this.native && this.steamInfo().enabled); },
  steamInfo() {
    if (!this.native) return { enabled: false };
    if (!this.info) { try { this.info = this.native.steamInfo() || { enabled: false }; } catch (e) { this.info = { enabled: false }; } }
    return this.info;
  },
  /* Steam Deck üzerinde mi (kol simgeleri ve varsayılanlar için) */
  get deck() { return !!this.steamInfo().deck; },

  /* ---------------- Kalıcı depolama (senkron) ---------------- */
  get(key) {
    if (this.native) { try { return this.native.store.get(key); } catch (e) { return null; } }
    try { return localStorage.getItem(key); } catch (e) { return null; }
  },
  /* Hata fırlatabilir: çağıran "Kayıt başarısız" diyebilsin */
  set(key, value) {
    if (this.native) { if (!this.native.store.set(key, value)) throw new Error('disk'); return; }
    localStorage.setItem(key, value);
  },
  remove(key) {
    if (this.native) { try { this.native.store.remove(key); } catch (e) {} return; }
    try { localStorage.removeItem(key); } catch (e) {}
  },

  /* ---------------- Steam ---------------- */
  achApi: (id) => 'ACH_' + id.toUpperCase(),
  achievement(id) {
    if (!this.steam) return;
    try { this.native.achievement(this.achApi(id)); } catch (e) {}
  },
  /* Kayıt yüklenince oyunda kazanılmış başarımları Steam'e de işle (çevrimdışı oynanmışsa) */
  syncAchievements(achieved) {
    if (!this.steam || !achieved) return;
    for (const id in achieved) this.achievement(id);
  },
  _pres: {},
  presence(key, value) {
    if (!this.steam) return;
    const v = value == null ? '' : String(value);
    if (this._pres[key] === v) return;
    this._pres[key] = v;
    try { this.native.presence(key, v); } catch (e) {}
  },
  /* Steam'in oyun dili → oyunun dil kodu */
  language() {
    const l = this.steamInfo().lang;
    if (!l) return null;
    return l === 'turkish' ? 'tr' : 'en';
  },

  /* ---------------- Pencere ---------------- */
  get canQuit() { return this.desktop; },
  quit() { if (this.native) this.native.quit(); },
  isFullscreen() {
    if (this.native) { try { return !!this.native.isFullscreen(); } catch (e) { return false; } }
    return !!document.fullscreenElement;
  },
  setFullscreen(on) {
    if (this.native) { try { this.native.setFullscreen(!!on); } catch (e) {} return; }
    try {
      if (on && !document.fullscreenElement) {
        const p = document.documentElement.requestFullscreen({ navigationUI: 'hide' });
        if (p && p.then) p.then(() => this.lockEsc()).catch(() => {});
      } else if (!on && document.fullscreenElement) { this.leaving = true; this.unlockEsc(); document.exitFullscreen(); }
    } catch (e) {}
  },
  toggleFullscreen() { this.setFullscreen(!this.isFullscreen()); },
  /* Tarayıcıda Esc tam ekrandan çıkarır; menüden Esc ile çıkarken tam ekran gitmesin diye
     (Chromium) Esc oyuna yönlendirilir: tam ekrandan çıkmak için Esc basılı tutulur. */
  lockEsc() { try { if (navigator.keyboard && navigator.keyboard.lock) navigator.keyboard.lock(['Escape']).catch(() => {}); } catch (e) {} },
  unlockEsc() { try { if (navigator.keyboard && navigator.keyboard.unlock) navigator.keyboard.unlock(); } catch (e) {} },
  /* Steam Deck / Big Picture: bir yazı kutusu odaklanınca Steam'in ekran klavyesini kutunun yanında aç */
  watchKeyboard() {
    if (!this.native || !this.native.keyboard) return;
    document.addEventListener('focusin', (e) => {
      const el = e.target;
      if (!this.steam || !el || el.tagName !== 'INPUT' || !/^(text|search|)$/.test(el.type || '')) return;
      if (!this.deck && !(typeof Input !== 'undefined' && Input.device === 'pad')) return;
      const r = el.getBoundingClientRect(), k = window.devicePixelRatio || 1;
      try { this.native.keyboard(Math.round(r.left * k), Math.round(r.top * k), Math.round(r.width * k), Math.round(r.height * k)); } catch (err) {}
    });
  },
  /* Tam ekran tercihi kalıcıdır: tarayıcı kendiliğinden çıkarırsa (Esc) ilk tıklama ya da tuşta geri döner */
  watchFullscreen(want) {
    if (this.native) { if (want()) this.setFullscreen(true); return; }
    let pending = false;
    const again = () => { if (!pending) return; pending = false; if (want() && !this.isFullscreen()) this.setFullscreen(true); };
    document.addEventListener('fullscreenchange', () => {
      if (document.fullscreenElement) { this.lockEsc(); return; }
      if (this.leaving) { this.leaving = false; return; }
      if (want()) pending = true;
    });
    window.addEventListener('pointerdown', again, true);
    window.addEventListener('keydown', (e) => { if (e.code !== 'Escape' && e.code !== 'F11') again(); }, true);
    // açılışta tercih açıksa ilk etkileşimde tam ekrana geç (tarayıcı kullanıcı hareketi ister)
    if (want()) pending = true;
  },
};
