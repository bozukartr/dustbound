#!/usr/bin/env node
'use strict';
/* ==========================================================
   FRONTIER'S END — dil dosyası denetleyicisi (bağımlılıksız)

   Koddaki bütün Tr('…') / Tr`…` anahtarlarını ve veri tablolarındaki
   metinleri toplar, lang/<kod>.js ile karşılaştırır.

     node tools/i18n-check.js            → İngilizce için eksik/fazla anahtar raporu
     node tools/i18n-check.js de         → başka bir dil dosyası için
     node tools/i18n-check.js en --skel  → eksikleri dosyaya yapıştırılacak biçimde yazdır
   ========================================================== */
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
const code = process.argv[2] && !process.argv[2].startsWith('-') ? process.argv[2] : 'en';
const skel = process.argv.includes('--skel');

/* ---- 1) Koddaki Tr anahtarları: küçük bir JS tarayıcısı ---- */
const ESC = { n: '\n', t: '\t', r: '\r', b: '\b', f: '\f', v: '\v', 0: '\0' };
function scan(src, file, keys) {
  let i = 0;
  const cook = (s) => s.replace(/\\(u\{[0-9a-fA-F]+\}|u[0-9a-fA-F]{4}|x[0-9a-fA-F]{2}|\r?\n|.)/g, (m, e) =>
    e[0] === 'u' ? String.fromCodePoint(parseInt(e.replace(/[u{}]/g, ''), 16)) : e[0] === 'x' ? String.fromCharCode(parseInt(e.slice(1), 16)) : /^\r?\n$/.test(e) ? '' : ESC[e] !== undefined ? ESC[e] : e);
  const readString = (q) => { let s = ''; i++; while (i < src.length && src[i] !== q) { if (src[i] === '\\') { s += src[i] + src[i + 1]; i += 2; } else s += src[i++]; } i++; return cook(s); };
  // şablon: parçaları ve ifade sayısını döndürür; iç içe ifadeleri atlar
  const readTemplate = () => {
    const parts = []; let s = ''; i++;
    while (i < src.length && src[i] !== '`') {
      if (src[i] === '\\') { s += src[i] + src[i + 1]; i += 2; }
      else if (src[i] === '$' && src[i + 1] === '{') { parts.push(cook(s)); s = ''; i += 2; skipExpr(); }
      else s += src[i++];
    }
    i++; parts.push(cook(s));
    return parts;
  };
  const skipExpr = () => { let depth = 1; while (i < src.length && depth > 0) { const c = src[i]; if (c === '{') { depth++; i++; } else if (c === '}') { depth--; i++; } else step(); } };
  const prevSignificant = () => { let j = i - 1; while (j >= 0 && /\s/.test(src[j])) j--; return src[j] || ''; };
  const step = () => {
    const c = src[i], n = src[i + 1];
    if (c === '/' && n === '/') { while (i < src.length && src[i] !== '\n') i++; return; }
    if (c === '/' && n === '*') { i = src.indexOf('*/', i + 2) + 2; if (i < 2) i = src.length; return; }
    if (c === '\'' || c === '"') { readString(c); return; }
    if (c === '`') { readTemplate(); return; }
    if (c === '/' && /[=(,:;!&|?{}\[\n]|^$/.test(prevSignificant())) { // düzenli ifade
      i++; let cls = false; while (i < src.length) { const d = src[i]; if (d === '\\') { i += 2; continue; } if (d === '[') cls = true; else if (d === ']') cls = false; else if (d === '/' && !cls) break; i++; } i++;
      while (/[a-z]/.test(src[i] || '')) i++; return;
    }
    if (c === 'T' && n === 'r' && !/[\w$.]/.test(src[i - 1] || '')) {
      let j = i + 2; while (/\s/.test(src[j] || '')) j++;
      if (src[j] === '`') { i = j; const p = readTemplate(); keys.add(p.map((x, k) => (k ? '{' + (k - 1) + '}' : '') + x).join('')); return; }
      if (src[j] === '(') { let k = j + 1; while (/\s/.test(src[k] || '')) k++; if (src[k] === '\'' || src[k] === '"') { i = k; keys.add(readString(src[k])); return; } }
    }
    i++;
  };
  while (i < src.length) step();
}
const codeKeys = new Set();
for (const f of fs.readdirSync(path.join(ROOT, 'js'))) if (f.endsWith('.js') && f !== 'i18n.js') scan(fs.readFileSync(path.join(ROOT, 'js', f), 'utf8'), f, codeKeys);
// HTML: data-i18n="…", data-i18n-title="…" ve sayfa açıklaması
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
for (const m of html.matchAll(/data-i18n(?:-title)?="([^"]*)"/g)) codeKeys.add(m[1]);
for (const m of html.matchAll(/<meta name="description" content="([^"]*)"/g)) codeKeys.add(m[1]);

/* ---- 2) Veri tablolarındaki metinler: tabloları bir vm içinde yükle ---- */
const noop = () => {}, el = new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => '' : el), apply: () => el, construct: () => el });
const ctx = vm.createContext({ console, window: el, document: el, navigator: { language: 'tr' }, localStorage: { getItem: () => null, setItem: noop }, requestAnimationFrame: noop, performance: { now: () => 0 }, Audio: el, Image: el, AudioContext: el, setTimeout: noop });
const order = ['util', 'i18n', 'icons', 'data', 'input', 'audio', 'world', 'sprites', 'entities', 'systems', 'ui', 'cinema', 'fx'];
vm.runInContext(order.map(f => fs.readFileSync(path.join(ROOT, 'js', f + '.js'), 'utf8').replace(/^'use strict';/, '')).join('\n;\n') + '\n;globalThis.__T = I18N.TABLES();', ctx, { filename: 'game.js' });
const tableKeys = new Set();
const human = s => /[A-Za-zÇĞİÖŞÜçğıöşü]{2,}/.test(s) && !/^[a-z][A-Za-z0-9_@]*$/.test(s) && !/^#[0-9a-f]+$/i.test(s) && !/^[A-Z0-9_]+$/.test(s);
const walk = (o, d) => { if (!o || typeof o !== 'object' || d > 6) return; for (const k of Object.keys(o)) { const v = o[k]; if (typeof v === 'string') { if (human(v)) tableKeys.add(v); } else walk(v, d + 1); } };
for (const t of ctx.__T) walk(t, 0);

/* ---- 3) Dil dosyası ---- */
const file = path.join(ROOT, 'lang', code + '.js');
const lctx = vm.createContext({ I18N: { add: (c, p) => { lctx.__P = p; } } });
vm.runInContext(fs.readFileSync(file, 'utf8'), lctx, { filename: file });
const P = lctx.__P, dict = P.t || {}, same = new Set(P.same || []);

const TRC = /[çğıöşüÇĞİÖŞÜ]/;
const missCode = [...codeKeys].filter(k => !(k in dict) && !same.has(k) && /[A-Za-zÇĞİÖŞÜçğıöşü]{2,}/.test(k.replace(/\{\d+\}|<[^>]*>|&\w+;/g, '')));
const missTable = [...tableKeys].filter(k => !(k in dict) && !same.has(k) && !codeKeys.has(k));
const all = new Set([...codeKeys, ...tableKeys]);
const unused = Object.keys(dict).filter(k => !all.has(k));
// yer tutucu tutarlılığı
const ph = s => (s.match(/\{\d+\}/g) || []).sort().join(',');
const badPh = Object.keys(dict).filter(k => ph(k) !== ph(dict[k]));
const stillTr = Object.keys(dict).filter(k => TRC.test(dict[k]));

if (skel) {
  for (const k of [...missCode, ...missTable]) console.log(`    ${JSON.stringify(k)}: ${JSON.stringify(k)},`);
} else {
  const show = (t, a) => { console.log(`\n## ${t}: ${a.length}`); for (const k of a.slice(0, 400)) console.log('  ' + JSON.stringify(k)); };
  console.log(`lang/${code}.js — ${Object.keys(dict).length} çeviri; kodda ${codeKeys.size} anahtar, tablolarda ${tableKeys.size} metin`);
  show('Eksik (kod)', missCode);
  show('Eksik (veri tabloları)', missTable);
  show('Kullanılmayan', unused);
  show('Yer tutucu uyuşmazlığı', badPh);
  show('Çeviride Türkçe harf kalmış', stillTr);
  process.exitCode = missCode.length || missTable.length || badPh.length ? 1 : 0;
}
if (process.argv.includes('--dump')) fs.writeFileSync(process.argv[process.argv.indexOf('--dump') + 1], JSON.stringify([...missCode, ...missTable], null, 0));
