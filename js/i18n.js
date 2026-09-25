'use strict';
/* ==========================================================
   FRONTIER'S END — çok dil desteği (i18n)

   Kaynak dil Türkçe. Oyuncuya görünen metinler kodda Türkçe yazılır
   ve Tr ile sarılır; lang/<kod>.js dosyaları "Türkçe → hedef dil"
   sözlükleridir (gettext mantığı: anahtar, kaynak metnin kendisidir).

     Tr('Mermin kalmadı!')
     Tr`Başına +${x} ödül kondu`     anahtar: 'Başına +{0} ödül kondu'
     Tr('{0} kuşanıldı', ad)          yer tutucular sözlükte yeniden sıralanabilir
     çeviride {0:day|days}            sayıya göre tekil/çoğul seçer

   Aynı Türkçe metin farklı yerlerde farklı çevrilecekse bağlam öneki
   kullanılır: Tr('@ayar|Açık'). Türkçe gösterimde önek atılır.

   Veri tabloları (eşyalar, silahlar, replikler…) kodda Türkçe kalır;
   dil seçildiğinde sözlükle yerinde çevrilir, Türkçeye dönünce geri alınır.
   HTML'deki sabit metinler data-i18n (metin) ve data-i18n-title (ipucu)
   öznitelikleriyle çevrilir.
   ========================================================== */
const I18N = {
  lang: 'tr',
  LANGS: [['tr', 'Türkçe'], ['en', 'English']],
  packs: {},
  dict: null,          // etkin sözlük (Türkçe için null)
  miss: null,          // test/geliştirme: çevirisi bulunmayan anahtarlar (Set)
  _keys: new WeakMap(),
  _orig: [],           // tablo çevirisinde değiştirilen [nesne, anahtar, özgün değer]

  add(code, pack) { this.packs[code] = pack; },
  /* Kayıtlı ayar → tarayıcı dili → İngilizce */
  detect() {
    try {
      const s = JSON.parse(localStorage.getItem('frontiersend_settings_v1') || 'null');
      if (s && s.lang && (s.lang === 'tr' || this.packs[s.lang])) return s.lang;
    } catch (e) {}
    const nav = (navigator.languages && navigator.languages[0]) || navigator.language || 'en';
    return /^tr\b/i.test(nav) ? 'tr' : 'en';
  },
  setLang(code) {
    if (code !== 'tr' && !this.packs[code]) code = 'tr';
    this.lang = code;
    this.dict = code === 'tr' ? null : this.packs[code].t;
    if (typeof document !== 'undefined') document.documentElement.lang = code;
    this.localizeTables();
    this.localizeDom();
  },
  /* Anahtarı çevir; yoksa Türkçe kaynağı döndür (bağlam önekini atarak) */
  look(key) {
    if (this.dict) {
      const v = this.dict[key];
      if (v !== undefined) return v;
      if (this.miss) this.miss.add(key);
    }
    if (key.charCodeAt(0) === 64 /* @ */) { const b = key.indexOf('|'); if (b > 0) return key.slice(b + 1); }
    return key;
  },

  /* ---- Veri tabloları ---- */
  TABLES: () => [
    ITEMS, ITEM_CATS, AMMO, WEAPONS, WHEEL_SLOTS, ITEM_SLOTS, ANIMALS, HORSE_BREEDS, HORSE_NAMES, TOWNS, REGIONS,
    BUILDINGS, JOBS, SHOPS, LANDMARKS, NOMADS, CAMPS, FARMS, PROPERTIES, ACHIEVEMENTS, SKILLS, BACKGROUNDS,
    DIFFICULTIES, LIFE_PACES, LOOKS, GREETS, LINES, HEADLINES, SEASONS, RECIPES, HARVEST,
    GAME_ACTIONS, KEY_LABEL, MOUSE_LABEL, PAD_NAME, TIPS,
  ],
  localizeTables() {
    for (const [o, k, v] of this._orig) o[k] = v;
    this._orig.length = 0;
    if (!this.dict) return;
    const D = this.dict, seen = new Set();
    const walk = (o, depth) => {
      if (!o || typeof o !== 'object' || seen.has(o) || depth > 6) return;
      seen.add(o);
      for (const k of Object.keys(o)) {
        const v = o[k];
        if (typeof v === 'string') { const t = D[v]; if (t !== undefined && t !== v) { this._orig.push([o, k, v]); o[k] = t; } }
        else if (v && typeof v === 'object') walk(v, depth + 1);
      }
    };
    for (const t of this.TABLES()) walk(t, 0);
  },
  /* ---- Sabit HTML metinleri ---- */
  localizeDom(root) {
    if (typeof document === 'undefined') return;
    const R = root || document;
    R.querySelectorAll('[data-i18n]').forEach(n => { n.textContent = Tr(n.dataset.i18n); });
    R.querySelectorAll('[data-i18n-title]').forEach(n => { n.title = Tr(n.dataset.i18nTitle); });
    if (!root) {
      const d = document.querySelector('meta[name=description]');
      if (d) { d.dataset.src = d.dataset.src || d.content; d.content = Tr(d.dataset.src); }
    }
  },
};

/* Çeviri: düz metin (Tr('…', a, b)) ya da etiketli şablon (Tr`… ${a} …`) */
function Tr(s, ...a) {
  let key;
  if (Array.isArray(s)) {
    key = I18N._keys.get(s);
    if (key === undefined) {
      key = s[0];
      for (let i = 1; i < s.length; i++) key += '{' + (i - 1) + '}' + s[i];
      I18N._keys.set(s, key);
    }
  } else key = s;
  const out = I18N.look(key);
  if (!a.length) return out;
  // {0:tekil|çoğul} → sayıya göre biçim (İngilizce "1 day / 2 days" gibi)
  return out.replace(/\{(\d+):([^|}]*)\|([^}]*)\}/g, (m, i, one, many) => (+a[i] === 1 ? one : many))
    .replace(/\{(\d+)\}/g, (m, i) => (a[i] !== undefined ? a[i] : m));
}

/* Geliştirme: index.html?i18ncheck → çevirisi eksik anahtarları (I18N.miss) ve
   ekranda Türkçe harf içeren metinleri (I18N.seen) topla. */
if (typeof location !== 'undefined' && /[?&]i18ncheck/.test(location.search)) {
  I18N.miss = new Set(); I18N.seen = new Set();
  const TRC = /[çğıöşüÇĞİÖŞÜ]/;
  const scan = (n) => {
    if (n.nodeType === 3) { const t = n.textContent.trim(); if (t && TRC.test(t) && I18N.lang !== 'tr') I18N.seen.add(t.slice(0, 140)); return; }
    if (n.nodeType === 1) { if (n.title && TRC.test(n.title) && I18N.lang !== 'tr') I18N.seen.add('title: ' + n.title); for (const c of n.childNodes) scan(c); }
  };
  new MutationObserver(ms => { for (const m of ms) { if (m.type === 'characterData') scan(m.target); else m.addedNodes.forEach(scan); } })
    .observe(document.documentElement, { subtree: true, childList: true, characterData: true });
}
