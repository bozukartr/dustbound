#!/usr/bin/env node
'use strict';
/* Oyun dosyalarını (depo kökü) desktop/app/ içine kopyalar. Electron bu kopyayı açar;
   böylece tarayıcı sürümü ve masaüstü sürümü aynı kaynaktan çıkar. */
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..'), OUT = path.join(__dirname, '..', 'app');
const ITEMS = ['index.html', 'css', 'js', 'lang', 'audio', 'fonts'];
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
let n = 0;
for (const it of ITEMS) {
  const src = path.join(ROOT, it);
  if (!fs.existsSync(src)) { console.warn('atlandı (yok):', it); continue; }
  fs.cpSync(src, path.join(OUT, it), { recursive: true });
  n++;
}
console.log(`app/ hazır (${n} öğe kopyalandı)`);
