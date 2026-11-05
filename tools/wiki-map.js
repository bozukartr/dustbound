#!/usr/bin/env node
'use strict';
/* ==========================================================
   Çevrimiçi rehber (wiki, bozukartr/frontiersend) için çok yüksek çözünürlüklü dünya haritası.

   Oyunu başsız Chromium'da açar, sabit bir tohumla dünyayı oyunun kendi üreticisiyle kurar ve haritayı oyunun
   kendi harita çizimiyle (World.mapRegion: kâğıt dokusu, kıyı mürekkebi, eş yükselti çizgileri, binalar; üstüne
   yollar, patikalar, demiryolları, mil ızgarası ve bölge adları) döşemeler hâlinde çizer. En ayrıntılı düzeyde
   karo başına 4 piksel: 3072 karoluk dünya 12288 × 12288 piksel olur. Alttaki düzeyler aynı çizimle daha küçük
   ölçekte çizilir (çizgiler her ölçekte okunur kalır). Döşemeler 512 piksel kare WebP'dir.

   Kasabaların, önemli yerlerin, çiftliklerin, haydut kamplarının ve mülklerin adları resme basılmaz: wiki onları
   iki dilde, tıklanabilir işaretler olarak üstüne koyar (assets/data/map.js). Simgeler oyunun kendi simgeleridir.

   Dünya her yeni hayatta farklı üretilir: kasabaların ve mülklerin yeri aynıdır; önemli yerler, kamplar ve
   çiftlikler hep aynı bölgededir ama birkaç mil kayabilir; kıyının, göllerin, nehir kıvrımlarının ve yolların
   ayrıntısı değişir. Harita bu yüzden "örnek bir dünya"dır; wiki bunu sayfada söyler.

   Kullanım:
     node tools/wiki-map.js                      ../frontiersend'e yazar (assets/map/, assets/data/map.js)
     node tools/wiki-map.js --root <wiki klasörü>
     node tools/wiki-map.js --seed 1890 --scale 4 --quality 0.8
   ========================================================== */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { loadEn } = require('./wiki-export.js');

const ROOT = path.join(__dirname, '..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const WIKI = path.resolve(opt('root', path.join(ROOT, '..', 'frontiersend')));
const SEED = +opt('seed', 1890);
const SMAX = +opt('scale', 4);          // en ayrıntılı düzeyde karo başına piksel (2'nin kuvveti)
const QUALITY = +opt('quality', 0.8);   // WebP kalitesi
const TILE = 512;
const GEN_V = 1;                        // çizim yöntemi değişince artırılır

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg', '.mp4': 'video/mp4', '.webm': 'video/webm' };
function serve() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (p.endsWith('/')) p += 'index.html';
      const f = path.normalize(path.join(ROOT, p));
      if (!f.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
      fs.readFile(f, (err, data) => {
        if (err) { res.writeHead(404); res.end(); return; }
        res.writeHead(200, { 'Content-Type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream' });
        res.end(data);
      });
    });
    srv.listen(0, '127.0.0.1', () => resolve(srv));
  });
}

/* ---------- sayfada: dünya, işaretler, döşeme çizimi ----------
   Bu iki işlev oyunun sayfasında çalışır (page.evaluate); oyunun genel adlarını kullanır. */
/* global World, TS, WW, WH, TOWNS, PICON, GLYPHS, REGIONS, G, __WM */
async function pageSetup({ seed, smax, tile, levels }) {
  const w = new World(seed);
  await w.generate();
  window.__WM = { w, smax, tile, levels };
  await document.fonts.load('italic 40px "IM Fell English"');
  // çizgilerin döşeme döşeme ayıklanması için sınır kutuları (karo)
  const box = (pts) => { let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity; for (const [x, y] of pts) { a = Math.min(a, x); b = Math.min(b, y); c = Math.max(c, x); d = Math.max(d, y); } return [a / TS, b / TS, c / TS, d / TS]; };
  __WM.roads = w.roads.map(r => ({ pts: r.pts, spur: !!r.spur, bb: box(r.pts) }));
  __WM.lines = w.lines.map(l => ({ pts: l.pts, bb: box(l.pts) }));
  const ICON = { town: null, camp: 'tent', farm: 'wheat', property: 'house' };
  const marks = [];
  for (const t of w.towns) marks.push({ id: t.id, kind: 'town', n: t.n, x: t.cx / TS, y: t.cy / TS, sz: t.sz || (TOWNS.find(d => d.id === t.id) || {}).sz });
  for (const p of w.pois) {
    if (!['landmark', 'camp', 'farm', 'property'].includes(p.kind)) continue;
    marks.push({ id: p.id, kind: p.kind, type: p.type, prop: p.prop, n: p.n, x: p.x / TS, y: p.y / TS, icon: p.kind === 'landmark' ? PICON[p.type] : ICON[p.kind] });
  }
  // simgeler: oyunun çizgi simgeleri, koyu rozetin üstünde açık renk
  const icons = {};
  for (const m of marks) if (m.icon && !icons[m.icon] && GLYPHS[m.icon]) icons[m.icon] = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">${GLYPHS[m.icon]('#f0e4c8')}</svg>`;
  return { world: WW, marks, icons, regions: REGIONS.map(r => ({ n: r.n, x: r.x * WW, y: r.y * WH })), roads: w.roads.length, lines: w.lines.length };
}

async function pageTile({ z, tx, ty, q }) {
  const { w, smax, tile, levels } = __WM;
  const Z = levels - 1, S = smax / 2 ** (Z - z);           // bu düzeyde karo başına piksel
  const L = Math.round(WW * S);                            // düzeyin kenarı (piksel)
  const cw = Math.min(tile, L - tx * tile), chh = Math.min(tile, L - ty * tile);
  const c = document.createElement('canvas'); c.width = cw; c.height = chh;
  const g = c.getContext('2d');
  const wx0 = tx * tile / S, wy0 = ty * tile / S;          // döşemenin sol üst köşesi (karo)
  if (S >= 1) {
    // oyunun harita çizimi, karo başına SxS piksel (kıyı uzaklığı bölgenin çevresiyle hesaplandığından dikişsiz)
    const job = w.mapRegion(wx0, wy0, cw / S, chh / S, S);
    let r; do r = job.next(); while (!r.done);
    g.putImageData(r.value, 0, 0);
  } else {
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    g.drawImage(w.mapCanvas, wx0, wy0, cw / S, chh / S, 0, 0, cw, chh);
  }
  // oyunun haritasıyla aynı çizgiler (UI.drawMapStatic), ölçeğe göre kalınlık
  const X = (px) => (px / TS - wx0) * S, Y = (py) => (py / TS - wy0) * S;
  const vis = (bb) => bb[2] >= wx0 - 4 && bb[0] <= wx0 + cw / S + 4 && bb[3] >= wy0 - 4 && bb[1] <= wy0 + chh / S + 4;
  const st = S < 1 ? 4 : S < 2.5 ? 2 : 1;
  const poly = (pts) => { g.beginPath(); for (let k = 0; k < pts.length; k += st) { const x = X(pts[k][0]), y = Y(pts[k][1]); k ? g.lineTo(x, y) : g.moveTo(x, y); } const e = pts[pts.length - 1]; g.lineTo(X(e[0]), Y(e[1])); g.stroke(); };
  // mil ızgarası (iki milde bir; uzaktan dört)
  const gstep = S * 62.8 < 46 ? 125.6 : 62.8;
  g.strokeStyle = 'rgba(96,62,30,0.13)'; g.lineWidth = 1; g.beginPath();
  for (let gx = Math.ceil(wx0 / gstep) * gstep; gx < wx0 + cw / S; gx += gstep) { const x = Math.round((gx - wx0) * S) + 0.5; g.moveTo(x, 0); g.lineTo(x, chh); }
  for (let gy = Math.ceil(wy0 / gstep) * gstep; gy < wy0 + chh / S; gy += gstep) { const y = Math.round((gy - wy0) * S) + 0.5; g.moveTo(0, y); g.lineTo(cw, y); }
  g.stroke();
  g.lineCap = 'round'; g.lineJoin = 'round';
  const rw = Math.min(7, Math.max(S < 1 ? 1 : 1.8, S * 1.5));
  for (const r of __WM.roads) {
    if (!vis(r.bb)) continue;
    if (r.spur) { if (S < 0.5) continue; g.strokeStyle = 'rgba(92,62,36,0.8)'; g.lineWidth = rw * 0.45; g.setLineDash([rw * 1.2, rw]); poly(r.pts); g.setLineDash([]); continue; }
    g.strokeStyle = 'rgba(80,52,30,0.9)'; g.lineWidth = rw; poly(r.pts);
    g.strokeStyle = 'rgba(226,204,160,0.95)'; g.lineWidth = rw * 0.45; poly(r.pts);
  }
  for (const l of __WM.lines) {
    if (!vis(l.bb)) continue;
    g.strokeStyle = 'rgba(28,22,18,0.9)'; g.lineWidth = Math.max(S < 1 ? 0.8 : 1.2, S * 0.5); poly(l.pts);
    if (S >= 0.5) { g.lineWidth = Math.max(4, S * 2); g.setLineDash([1.2, Math.max(4, S * 3)]); poly(l.pts); g.setLineDash([]); }
  }
  // bölge adları (oyunda iki dilde de aynı özel adlar): aralıklı italik, kâğıt rengi kenarla
  const fs = S >= 1 ? 16 + S * 4 : Math.max(8, 20 * S + 6);
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `italic ${Math.round(fs)}px "IM Fell English", serif`;
  for (const r of REGIONS) {
    const x = (r.x * WW - wx0) * S, y = (r.y * WH - wy0) * S;
    if (x < -600 || y < -60 || x > cw + 600 || y > chh + 60) continue;
    const txt = r.n.toUpperCase().split('').join(' ');
    g.lineWidth = 3; g.strokeStyle = 'rgba(232,218,184,0.45)'; g.strokeText(txt, x, y);
    g.fillStyle = 'rgba(60,40,20,0.5)'; g.fillText(txt, x, y);
  }
  return { url: c.toDataURL('image/webp', q), w: cw, h: chh };
}

(async () => {
  if (!fs.existsSync(path.join(WIKI, 'assets'))) { console.error(`Wiki deposu bulunamadı: ${WIKI} (--root <klasör>)`); process.exit(2); }
  if (!(SMAX >= 1 && Number.isInteger(Math.log2(SMAX)))) { console.error('--scale 1, 2, 4 ya da 8 olmalı'); process.exit(2); }
  let chromium;
  try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require('playwright-core')); }
  const t0 = Date.now();
  const srv = await serve();
  const url = `http://127.0.0.1:${srv.address().port}/`;
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 800, height: 600 }, locale: 'tr-TR' });   // adlar oyunun kaynak dilinde (Türkçe) toplanır, İngilizceleri sözlükten
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => Object.assign(window, { __testNoGuide: true, __testNoStory: true, __testNoCine: true, __testNoIntro: true, __testNoSfx: true, __testNoMenuVid: true }));
  await page.goto(url + 'index.html');
  await page.waitForFunction(() => typeof G !== 'undefined' && G.state === 'menu', null, { timeout: 60000 });

  // düzeyler: en küçüğü tek döşemeye sığana kadar yarıya
  let levels = 1;
  while (3072 * SMAX / 2 ** (levels - 1) > TILE) levels++;
  const info = await page.evaluate(pageSetup, { seed: SEED, smax: SMAX, tile: TILE, levels });
  console.log(`dünya üretildi (tohum ${SEED}): ${info.marks.length} işaret, ${info.roads} yol, ${info.lines} demiryolu hattı`);

  const OUT = path.join(WIKI, 'assets', 'map');
  fs.rmSync(OUT, { recursive: true, force: true });
  let bytes = 0, n = 0;
  const sizes = [];
  for (let z = 0; z < levels; z++) {
    const L = Math.round(3072 * SMAX / 2 ** (levels - 1 - z));
    const nt = Math.ceil(L / TILE);
    sizes.push(L);
    fs.mkdirSync(path.join(OUT, String(z)), { recursive: true });
    for (let ty = 0; ty < nt; ty++) for (let tx = 0; tx < nt; tx++) {
      const r = await page.evaluate(pageTile, { z, tx, ty, q: QUALITY });
      const buf = Buffer.from(r.url.slice(r.url.indexOf(',') + 1), 'base64');
      if (!/^data:image\/webp/.test(r.url)) throw new Error('tarayıcı WebP üretmedi');
      fs.writeFileSync(path.join(OUT, String(z), `${tx}-${ty}.webp`), buf);
      bytes += buf.length; n++;
    }
    console.log(`  düzey ${z}: ${L} px, ${nt}×${nt} döşeme`);
  }

  // işaretler: iki dilde adlar (oyunun İngilizce sözlüğünden), wiki sayfası bağlantıları
  const { en, missing } = loadEn();
  const nm = (s) => ({ tr: s, en: en(s) });
  const LINK = { town: (m) => 'town-' + m.id, landmark: (m) => 'place-' + m.id, property: () => 'property', farm: () => 'jobs', camp: () => 'bounty' };
  const r1 = (v) => Math.round(v * 10) / 10;
  const marks = info.marks.map(m => Object.assign({ id: m.id, kind: m.kind, n: nm(m.n), x: r1(m.x), y: r1(m.y), link: LINK[m.kind](m) },
    m.icon ? { icon: m.icon } : {}, m.sz ? { sz: m.sz } : {}));
  const regions = info.regions.map(r => ({ n: nm(r.n), x: r1(r.x), y: r1(r.y) }));
  const unknown = [...new Set(missing)];
  if (unknown.length) console.log('  İngilizce adı olmayanlar (Türkçesi kullanıldı):', unknown.join(', '));
  const version = (fs.readFileSync(path.join(ROOT, 'js', 'ui.js'), 'utf8').match(/const GAME_VERSION = '([^']+)'/) || [])[1] || '';
  const data = {
    meta: { game: "Frontier's End", version, seed: SEED, gen: GEN_V },
    world: info.world,                                   // dünyanın kenarı (karo); işaret konumları karo cinsinden
    tiles: { size: TILE, levels, scale: SMAX, sizes, ext: 'webp', path: 'assets/map' },
    icons: info.icons, regions, marks,
  };
  const lines = [
    "/* OTOMATİK ÜRETİLDİ — elle düzenlemeyin.",
    `   Kaynak: Frontier's End (sürüm ${version}), bozukartr/dustbound: node tools/wiki-map.js (tohum ${SEED})`,
    '   Dünya haritasının döşeme bilgisi (assets/map/<düzey>/<x>-<y>.webp) ve üstündeki işaretler. */',
    '(function (root) {',
    "  'use strict';",
    '  const D = {',
  ];
  for (const [k, v] of Object.entries(data)) {
    if (Array.isArray(v) && v.length > 3) { lines.push(`    ${JSON.stringify(k)}: [`); for (const x of v) lines.push(`      ${JSON.stringify(x)},`); lines.push('    ],'); }
    else if (k === 'icons') { lines.push('    "icons": {'); for (const [a, b] of Object.entries(v)) lines.push(`      ${JSON.stringify(a)}: ${JSON.stringify(b)},`); lines.push('    },'); }
    else lines.push(`    ${JSON.stringify(k)}: ${JSON.stringify(v)},`);
  }
  lines.push('  };', "  if (typeof module === 'object' && module.exports) module.exports = D;", '  else root.WIKI_MAP = D;', "})(typeof self !== 'undefined' ? self : this);", '');
  fs.writeFileSync(path.join(WIKI, 'assets', 'data', 'map.js'), lines.join('\n'));
  await browser.close();
  srv.close();
  if (errors.length) { console.error('Sayfa hataları:\n  ' + errors.join('\n  ')); process.exit(1); }
  console.log(`Harita yazıldı: ${OUT} (${n} döşeme, ${(bytes / 1048576).toFixed(1)} MB, en büyük düzey ${sizes[sizes.length - 1]} px) ve assets/data/map.js — ${((Date.now() - t0) / 1000).toFixed(0)} sn`);
})().catch((e) => { console.error(e); process.exit(1); });
