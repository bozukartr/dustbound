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

  /* ---------------- Ekran kartı ----------------
     Tercih: auto (varsa güçlü kart), high (güçlü/harici), low (tasarruflu/tümleşik). Masaüstünde
     açılışta Chromium'a verilir (desktop/gpu.js), kart yeniden başlatınca değişir; tarayıcıda Melez
     çizimin WebGL bağlamı istenen güç tercihiyle yeniden kurulur (tarayıcı her zaman uymayabilir). */
  GPU_PREFS: ['auto', 'high', 'low'],
  /* Bu açılışta uygulanan tercih (yalnızca masaüstü) */
  get gpuLaunch() { const v = this.native && this.native.gpuLaunch; return this.GPU_PREFS.includes(v) ? v : null; },
  gpuSave(pref) { if (this.native && this.native.setGpu) { try { this.native.setGpu(pref); } catch (e) {} } },
  get canRelaunch() { return !!(this.native && this.native.relaunch); },
  relaunch() { if (this.canRelaunch) { try { this.native.relaunch(); } catch (e) {} } },
  gpuSoft: (s) => /swiftshader|llvmpipe|softpipe|software|basic render/i.test(s || ''),
  /* WebGL çizici dizgesinden okunur ad:
     "ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Laptop GPU (0x00002520) Direct3D11 vs_5_0 ps_5_0, D3D11)" → "NVIDIA GeForce RTX 3060 Laptop GPU" */
  gpuName(s) {
    s = String(s || '').trim();
    const m = /^ANGLE \((.*)\)$/.exec(s);
    if (m) {   // ANGLE (üretici, çizici, sürücü): parçaların içinde parantez ve virgül olabilir
      const parts = []; let depth = 0, cur = '';
      for (const ch of m[1]) { if (ch === '(') depth++; else if (ch === ')') depth--; if (ch === ',' && !depth) { parts.push(cur); cur = ''; } else cur += ch; }
      parts.push(cur);
      s = (parts[1] || parts[0]).trim();
    }
    s = s.replace(/^ANGLE Metal Renderer:\s*/i, '').replace(/^Vulkan [\d.]+ \((.*)\)$/, '$1');
    s = s.replace(/\((R|TM|C)\)/gi, '').replace(/\s+Direct3D\S*.*$/i, '').replace(/,? or similar$/i, '');
    // aygıt kimliği ve sürücü ayrıntısı: "(0x00002520)", "(radeonsi, renoir, LLVM …)", "(KBL GT2)"
    let prev; do { prev = s; s = s.replace(/\s*\([^()]*\)/g, ''); } while (s !== prev);
    s = s.replace(/^Mesa\s+/i, '').replace(/\s+/g, ' ').trim();
    if (/^AMD Custom GPU 0(405|932)$/i.test(s)) s = 'Steam Deck GPU';
    return s;
  },
  /* Seçenek düğmesine sığan kısa ad: "GeForce RTX 3060 Laptop", "Intel UHD 620", "Radeon RX 6600" */
  gpuShort(n) {
    const t = String(n || '').replace(/^(NVIDIA|AMD)\s+/i, '');
    let s = t.replace(/\s+GPU$/i, '').replace(/\s+Graphics\b/i, '').trim();
    if (!/\s/.test(s)) s = t;
    return s.length > 24 ? s.slice(0, 23) + '…' : s;
  },
  /* Şu an kullanılan kart: verilen güç tercihiyle kısa ömürlü bir WebGL bağlamına sorulur */
  gpuProbe(power) {
    try {
      const g = document.createElement('canvas').getContext('webgl', { powerPreference: power || 'default' });
      if (!g) return null;
      const x = g.getExtension('WEBGL_debug_renderer_info'), r = String(g.getParameter(x ? x.UNMASKED_RENDERER_WEBGL : g.RENDERER) || '');
      const lose = g.getExtension('WEBGL_lose_context'); if (lose) lose.loseContext();
      return r;
    } catch (e) { return null; }
  },
  /* Bulunan kartlar (rol: high güçlü, low tasarruflu, only tek kart) ve kullanılan kart.
     Masaüstünde Electron bütün kartları adlarıyla verir; tarayıcıda WebGPU'nun iki güç tercihindeki bağdaştırıcıları karşılaştırılır. */
  async gpuDetect(power) {
    const raw = this.gpuProbe(power);
    const r = { raw, active: raw ? this.gpuName(raw) : null, soft: !raw || this.gpuSoft(raw), cards: [], info: null };
    if (this.native && this.native.gpuInfo) {
      try { r.info = await Promise.race([this.native.gpuInfo(), new Promise(res => setTimeout(() => res(null), 8000))]); } catch (e) {}
      r.cards = this.gpuCards(r.info, r);
    } else r.cards = await this.gpuWebCards(r);
    return r;
  },
  GPU_VENDORS: { 0x10de: 'NVIDIA', 0x1002: 'AMD', 0x1022: 'AMD', 0x8086: 'Intel', 0x106b: 'Apple', 0x5143: 'Qualcomm', 0x13b5: 'ARM' },
  gpuCards(info, r) {
    const out = [];
    for (const d of (info && info.devices) || []) {
      const vendor = this.GPU_VENDORS[d.vendorId];
      if (!vendor) continue;   // yazılım ve sanal makine kartları listelenmez
      let name = this.gpuName(d.name);
      if (!name && d.active && r.active && !r.soft) name = r.active;
      const c = { id: d.vendorId + ':' + d.deviceId, vendor, name: name || vendor, short: name ? this.gpuShort(name) : vendor, active: !!d.active, pref: d.pref | 0, boot: !!d.boot };
      if (!out.some(x => x.id === c.id)) out.push(c);
    }
    this.gpuRoles(out);
    return out;
  },
  /* Hangi kart güçlü, hangisi tasarruflu: önce Chromium'un işareti (gpuPreference 3 güçlü, 2 tasarruflu),
     yoksa üreticiye ve ada göre; eşitlikte açılış ekranını süren kart (Linux boot_vga) tümleşiktir. */
  gpuRoles(L) {
    for (const c of L) c.role = null;
    if (L.length < 2) { if (L[0]) L[0].role = 'only'; return; }
    const hi = L.find(c => c.pref === 3), lo = L.find(c => c.pref === 2);
    if (hi && lo && hi !== lo) { hi.role = 'high'; lo.role = 'low'; return; }
    const pow = (c) => c.vendor === 'NVIDIA' ? 3 : c.vendor === 'AMD' ? (/\b(RX|R9|R7|Pro|FirePro|Vega (56|64)|VII)\b/.test(c.name) ? 3 : 2) : c.vendor === 'Intel' ? (/\bArc\b.*\b[AB]\d{3}/i.test(c.name) ? 3 : 1) : 1;
    const S = [...L].sort((a, b) => pow(b) - pow(a) || (a.boot ? 1 : 0) - (b.boot ? 1 : 0));
    const top = S[0], bot = S[S.length - 1];
    if (pow(top) > pow(bot) || (!top.boot && bot.boot)) { top.role = 'high'; bot.role = 'low'; }
  },
  async gpuWebCards(r) {
    if (typeof navigator === 'undefined' || !navigator.gpu) return [];
    const VN = { nvidia: 'NVIDIA', amd: 'AMD', intel: 'Intel', apple: 'Apple', qualcomm: 'Qualcomm', arm: 'ARM' }, cap = (s) => s ? s[0].toUpperCase() + s.slice(1) : '';
    const ask = async (p) => {
      try {
        const a = await navigator.gpu.requestAdapter({ powerPreference: p });
        if (!a || a.isFallbackAdapter) return null;
        const i = a.info || (a.requestAdapterInfo ? await a.requestAdapterInfo() : null) || {};
        const vendor = VN[String(i.vendor || '').toLowerCase()] || cap(i.vendor);
        const name = this.gpuName(i.description) || [vendor, cap(i.architecture)].filter(Boolean).join(' ');
        return name && !this.gpuSoft(name) ? { id: [i.vendor, i.architecture, i.device, i.description].join('|'), vendor, name, short: this.gpuShort(name) } : null;
      } catch (e) { return null; }
    };
    const [h, l] = await Promise.race([Promise.all([ask('high-performance'), ask('low-power')]), new Promise(res => setTimeout(() => res([null, null]), 2500))]);
    const L = h && l && h.id !== l.id ? [Object.assign(h, { role: 'high' }), Object.assign(l, { role: 'low' })] : h || l ? [Object.assign(h || l, { role: 'only' })] : [];
    for (const c of L) c.active = !!(r.active && c.vendor && r.active.toLowerCase().includes(c.vendor.toLowerCase()));
    return L;
  },
};
