#!/usr/bin/env node
'use strict';
/* ==========================================================
   Steamworks'e girilecek başarım listesini üretir:
     steam/achievements.csv  (API adı, İngilizce/Türkçe ad ve açıklama)
     steam/achievements.md   (okunaklı tablo)
   API adları oyundaki kimliklerden türetilir: ACH_<KİMLİK>
   (js/platform.js → Platform.achApi ile aynı kural).
   ========================================================== */
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..', '..'), OUT = path.join(__dirname, '..', 'steam');

const ctx = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', 'data.js'), 'utf8') + ';this.__A = ACHIEVEMENTS;', ctx);
const lctx = vm.createContext({ I18N: { add: (c, p) => { lctx.__P = p; } } });
vm.runInContext(fs.readFileSync(path.join(ROOT, 'lang', 'en.js'), 'utf8'), lctx);
const EN = lctx.__P.t;
const en = (s) => (s && EN[s] !== undefined ? EN[s] : s || '');

const rows = ctx.__A.map(a => ({
  api: 'ACH_' + a.id.toUpperCase(),
  nameEn: en(a.n), descEn: en(a.d) + (a.perk ? ' ' + en(a.perk) + (/[.!?]$/.test(en(a.perk)) ? '' : '.') : ''),
  nameTr: a.n, descTr: a.d + (a.perk ? ' ' + a.perk + (/[.!?]$/.test(a.perk) ? '' : '.') : ''),
}));
const csv = (s) => '"' + String(s).replace(/"/g, '""') + '"';
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'achievements.csv'),
  ['api_name,name_english,description_english,name_turkish,description_turkish', ...rows.map(r => [r.api, r.nameEn, r.descEn, r.nameTr, r.descTr].map(csv).join(','))].join('\n') + '\n');
fs.writeFileSync(path.join(OUT, 'achievements.md'),
  `# Başarımlar (${rows.length})\n\nSteamworks > Stats & Achievements sayfasına bu API adlarıyla girilir. Simgeler: \`steam/achievement-icons/\` (<api>.png kazanılmış, <api>_locked.png kilitli).\n\n| API adı | English | Türkçe |\n|---|---|---|\n` +
  rows.map(r => `| \`${r.api}\` | **${r.nameEn}** — ${r.descEn} | **${r.nameTr}** — ${r.descTr} |`).join('\n') + '\n');
console.log(`${rows.length} başarım yazıldı → steam/achievements.csv, steam/achievements.md`);
