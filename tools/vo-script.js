#!/usr/bin/env node
'use strict';
/* ==========================================================
   FRONTIER'S END — seslendirme senaryosu
   Yalnızca sinematik satırları seslendirilir: açılış sinematikleri
   (opening) ve bölüm sinematikleri (cine → lines). Oyun içi konuşmalar
   altyazıyla kalır. Bu araç o satırları hikâye, konuşan ve dosya adıyla
   dil başına bir CSV olarak yazar:
     audio/vo/script_tr.csv, audio/vo/script_en.csv
   ve seslendirme üreticisinin okuduğu listeyi:
     audio/vo/lines.json
   Her satır audio/vo/<dil>/<anahtar>.ogg (ve .mp3) olarak kaydedilir.
   Oyuncunun satırları iki kayıttır: <anahtar>.m (erkek oyuncu) ve
   <anahtar>.f (kadın oyuncu). Anahtar, satırın o dildeki metninden
   üretilir (Audio_.voiceKey ile aynı FNV-1a özeti); metin değişirse
   anahtar da değişir ve eski kayıt kullanılmaz. "okunuş" sütunu
   seslendirilecek metindir: oyuncunun adı ({ad}) okunmaz.
   Satırın oyunun dilinde kaydı yoksa İngilizce karşılığının kaydı çalar
   (şimdilik yalnızca İngilizce kayıtlar var; Türkçe oyunda da İngilizce ses).
   Araç yeniden çalıştırılınca audio/vo/manifest.json klasördeki
   kayıtlarla güncellenir.
     node tools/vo-script.js
   ========================================================== */
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..'), VO = path.join(ROOT, 'audio', 'vo');
const key = (text) => { let h = 0x811c9dc5; for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(16).padStart(8, '0'); };

// hikâyeler: dosya, ad ve konuşan harflerinin kimliği (harf yerine doğrudan isim de yazılabilir: 'Mick')
const STORIES = [
  ['quests.js', 'sully', "Sully'nin Senedi (Çiftçi Çocuğu)", { S: 'Dunham Sully', R: 'Kızıl Jack / Red Jack', F: 'Baba / Father' }],
  ['story_outlaw.js', 'outlaw', 'Kanun Kaçağı', { S: 'Hollis Crane', R: 'Silas Vance' }],
  ['story_rail.js', 'rail', 'Demiryolu İşçisi', { S: 'Walt Boone', R: 'Cyrus Hale', D: 'Arabacı / Driver' }],
  ['story_immigrant.js', 'immigrant', 'Göçmen', { S: 'Greta Halvorsen', R: 'Ambrose Pike', K: 'Anton', M: 'Madenci / Miner' }],
  ['story_trapper.js', 'trapper', 'Tuzakçı', { S: 'Elias Crowe', K: 'Abel (baba / father)', T: 'Kürk Tüccarı / Fur Trader', D: 'Doktor / Doctor' }],
];
const COMMON = { P: 'Oyuncu / Player', W: 'Şerif / Sheriff', B: 'Barmen / Bartender' };

/* kaynak koddan bir bloğu (parantez, köşeli ya da süslü) dizgileri ve yorumları atlayarak çıkar */
function blockAt(src, i) {
  let depth = 0;
  for (let k = i; k < src.length; k++) {
    const ch = src[k];
    if (ch === '"' || ch === "'" || ch === '`') { const q = ch; k++; while (k < src.length && src[k] !== q) { if (src[k] === '\\') k++; k++; } continue; }
    if (ch === '/' && src[k + 1] === '/') { k = src.indexOf('\n', k); if (k < 0) break; continue; }
    if (ch === '/' && src[k + 1] === '*') { k = src.indexOf('*/', k) + 1; continue; }
    if ('([{'.includes(ch)) depth++;
    else if (')]}'.includes(ch)) { depth--; if (depth === 0) return src.slice(i, k + 1); }
  }
  return '';
}
// ['S', Tr('...')] biçimli satırlar
const LINE = /\[\s*'([A-Z][A-Za-z]*)'\s*,\s*Tr\(\s*(['"])((?:\\.|(?!\2).)*)\2\s*\)\s*\]/g;
const lines = [];
for (const [f, id, title, who] of STORIES) {
  const src = fs.readFileSync(path.join(ROOT, 'js', f), 'utf8'), names = Object.assign({}, COMMON, who);
  const blocks = [];
  for (const m of src.matchAll(/opening:\s*\(\)\s*=>\s*\[/g)) blocks.push(['açılış', blockAt(src, m.index + m[0].length - 1)]);
  let n = 0;
  for (const m of src.matchAll(/cine:\s*\(\)\s*=>\s*\(\{|cine\(\)\s*\{/g)) {
    const b = blockAt(src, m.index + m[0].length - 1), li = b.search(/lines:\s*\[/);
    if (li >= 0) { const s2 = b.slice(li); blocks.push([`sinematik ${++n}`, blockAt(s2, s2.indexOf('['))]); }
  }
  for (const [where, b] of blocks) for (const m of b.matchAll(LINE)) lines.push({ story: id, title, where, w: m[1], name: names[m[1]] || m[1], tr: m[3].replace(/\\(['"\\])/g, '$1') });
}

// İngilizce karşılıklar
const ctx = { I18N: { add: (code, o) => { ctx.dict = o.t || {}; } } };
vm.createContext(ctx);
try { vm.runInContext(fs.readFileSync(path.join(ROOT, 'lang', 'en.js'), 'utf8').replace(/^'use strict';/, ''), ctx); } catch (e) { console.warn('en.js okunamadı:', e.message); }
const en = ctx.dict || {};

// okunuş: oyuncunun adı okunmaz ("Sevgili {ad}." → "Sevgili kardeşim.", ", {ad}." → ".")
const reading = (t, lang) => t.replace(/Sevgili \{ad\}/g, 'Sevgili kardeşim').replace(/Dear \{ad\}/g, 'My dear')
  .replace(/,\s*\{ad\}/g, '').replace(/\{ad\},?\s*/g, '').replace(/\s+([.,!?])/g, '$1').trim();

fs.mkdirSync(VO, { recursive: true });
const csv = (v) => '"' + String(v).replace(/"/g, '""') + '"';
const list = [];
for (const lang of ['tr', 'en']) {
  const rows = ['dosya,hikaye,yer,konusan,metin,okunus'];
  const seen = new Set();
  for (const l of lines) {
    const text = lang === 'tr' ? l.tr : en[l.tr];
    if (!text) { console.warn(`çevirisi yok (${l.story}): ${l.tr}`); continue; }
    const k = key(text);
    if (seen.has(k)) continue;
    seen.add(k);
    const read = reading(text, lang);
    // oyuncunun satırı: erkek ve kadın oyuncu için iki kayıt
    const vars = l.w === 'P' ? [['.m', ' (erkek oyuncu / male player)'], ['.f', ' (kadın oyuncu / female player)']] : [['', '']];
    for (const [v, note] of vars) {
      rows.push([`${lang}/${k}${v}.ogg`, l.title, l.where, l.name + note, text, read].map(csv).join(','));
      list.push({ lang, key: k + v, story: l.story, where: l.where, w: l.w, sex: v ? v.slice(1) : null, name: l.name, text, read });
    }
  }
  fs.writeFileSync(path.join(VO, `script_${lang}.csv`), rows.join('\n') + '\n');
  console.log(`audio/vo/script_${lang}.csv — ${rows.length - 1} kayıt`);
}
fs.writeFileSync(path.join(VO, 'lines.json'), JSON.stringify(list, null, 1) + '\n');

// klasördeki kayıtlardan manifest
const man = {};
for (const lang of fs.readdirSync(VO)) {
  const d = path.join(VO, lang);
  if (!fs.statSync(d).isDirectory()) continue;
  man[lang] = [...new Set(fs.readdirSync(d).map(f => /^([0-9a-f]{8}(?:\.[mf])?)\.(ogg|mp3)$/.exec(f)).filter(Boolean).map(m => m[1]))].sort();
}
fs.writeFileSync(path.join(VO, 'manifest.json'), JSON.stringify(man, null, 1) + '\n');
console.log('audio/vo/manifest.json —', Object.entries(man).map(([k, v]) => `${k}: ${v.length}`).join(', ') || 'kayıt yok');
