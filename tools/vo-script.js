#!/usr/bin/env node
'use strict';
/* ==========================================================
   FRONTIER'S END — seslendirme senaryosu
   Hikâyedeki bütün diyalog satırlarını, konuşanı ve dosya anahtarıyla
   birlikte dil başına bir CSV olarak yazar:
     audio/vo/script_tr.csv, audio/vo/script_en.csv
   Seslendirilen her satır audio/vo/<dil>/<anahtar>.ogg (ya da .mp3) olarak
   kaydedilir; ardından bu araç yeniden çalıştırılınca audio/vo/manifest.json
   klasörde bulunan dosyalarla güncellenir. Anahtar, satırın o dildeki
   metninden üretilir (Audio_.voiceKey ile aynı FNV-1a özeti); metin
   değişirse anahtar da değişir ve eski kayıt kullanılmaz.
     node tools/vo-script.js
   ========================================================== */
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..'), VO = path.join(ROOT, 'audio', 'vo');
const key = (text) => { let h = 0x811c9dc5; for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(16).padStart(8, '0'); };
// hikâye dosyaları: quests.js (Sully) ve story_*.js; 'S' her dosyanın kendi akıl hocası, 'R' hedef kişi
const FILES = [['quests.js', { S: 'Dunham Sully', R: 'Kızıl Jack', F: 'Baba / Father' }]].concat(fs.readdirSync(path.join(ROOT, 'js')).filter(f => /^story_.+\.js$/.test(f)).map(f => [f, null]));
const MENTOR = { 'story_outlaw.js': { S: 'Hollis Crane', R: 'Silas Vance' }, 'story_rail.js': { S: 'Walt Boone', R: 'Cyrus Hale', D: 'Arabacı / Driver' }, 'story_immigrant.js': { S: 'Greta Halvorsen', R: 'Ambrose Pike', K: 'Anton', M: 'Madenci / Miner' }, 'story_trapper.js': { S: 'Elias Crowe', K: 'Abel (baba / father)', T: 'Kürk Tüccarı / Fur Trader', D: 'Doktor / Doctor' } };
const COMMON = { P: 'Oyuncu / Player', W: 'Şerif / Sheriff', B: 'Barmen / Bartender' };
// ['S', Tr('...')] biçimli satırlar (konuşan bir harf ya da doğrudan isim)
const re = /\[\s*'([A-Z][A-Za-z]*)'\s*,\s*Tr\(\s*(['"])((?:\\.|(?!\2).)*)\2\s*\)\s*\]/g;
const lines = [];
for (const [f, sp] of FILES) {
  const src = fs.readFileSync(path.join(ROOT, 'js', f), 'utf8'), who = Object.assign({}, COMMON, sp || MENTOR[f] || {});
  for (let m; (m = re.exec(src));) lines.push({ w: who[m[1]] || m[1], tr: m[3].replace(/\\(['"\\])/g, '$1') });
}
// İngilizce karşılıklar
const ctx = { I18N: { add: (code, o) => { ctx.dict = o.t || {}; } } };
vm.createContext(ctx);
try { vm.runInContext(fs.readFileSync(path.join(ROOT, 'lang', 'en.js'), 'utf8').replace(/^'use strict';/, ''), ctx); } catch (e) { console.warn('en.js okunamadı:', e.message); }
const en = ctx.dict || {};
fs.mkdirSync(VO, { recursive: true });
const csv = (v) => '"' + String(v).replace(/"/g, '""') + '"';
for (const lang of ['tr', 'en']) {
  const rows = ['key,speaker,text'];
  const seen = new Set();
  for (const l of lines) {
    const text = lang === 'tr' ? l.tr : en[l.tr];
    if (!text || seen.has(text)) continue;
    seen.add(text);
    rows.push([key(text), l.w, text].map(csv).join(','));
  }
  fs.writeFileSync(path.join(VO, `script_${lang}.csv`), rows.join('\n') + '\n');
  console.log(`audio/vo/script_${lang}.csv — ${rows.length - 1} satır`);
}
// klasördeki kayıtlardan manifest
const man = {};
for (const lang of fs.readdirSync(VO)) {
  const d = path.join(VO, lang);
  if (!fs.statSync(d).isDirectory()) continue;
  man[lang] = fs.readdirSync(d).filter(f => /^[0-9a-f]{8}\.(ogg|mp3)$/.test(f)).map(f => f.slice(0, 8));
}
fs.writeFileSync(path.join(VO, 'manifest.json'), JSON.stringify(man, null, 1) + '\n');
console.log('audio/vo/manifest.json —', Object.entries(man).map(([k, v]) => `${k}: ${v.length}`).join(', ') || 'kayıt yok');
