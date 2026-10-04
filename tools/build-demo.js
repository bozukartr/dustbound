#!/usr/bin/env node
'use strict';
/* ==========================================================
   FRONTIER'S END — demo paketi (itch.io, tarayıcıda oynanır)

     npm run build:demo   → dist-demo/ klasörü ve dist-demo.zip

   Oyunun kendi dosyalarına dokunmaz: tam oyunu dist-demo/ altına kopyalar,
   kopyayı küçültür ve demo/demo.js katmanını ekler. Depodaki oyun, masaüstü
   sürümü ve testler bu betikten etkilenmez.
     - Öbür dört geçmişin hikâye dosyaları, açılış sahneleri ve çevirileri pakete girmez
     - Geliştirici araçları (debug.js) ve seslendirme metin tabloları pakete girmez
     - Kod küçültülür (terser); okunabilir kaynak pakette yer almaz
   ========================================================== */
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const ROOT = path.join(__dirname, '..'), OUT = path.join(ROOT, 'dist-demo'), ZIP = path.join(ROOT, 'dist-demo.zip');
const DROP_JS = ['story_outlaw.js', 'story_immigrant.js', 'story_rail.js', 'story_trapper.js', 'debug.js'];
const fail = (m) => { console.error('demo paketi: ' + m); process.exit(1); };

/* ---- 1) kopya ---- */
fs.rmSync(OUT, { recursive: true, force: true });
fs.rmSync(ZIP, { force: true });
fs.mkdirSync(OUT, { recursive: true });
for (const it of ['index.html', 'css', 'js', 'lang', 'audio', 'fonts']) fs.cpSync(path.join(ROOT, it), path.join(OUT, it), { recursive: true });
for (const f of DROP_JS) fs.rmSync(path.join(OUT, 'js', f));
for (const f of fs.readdirSync(path.join(OUT, 'audio', 'vo'))) if (f.endsWith('.csv')) fs.rmSync(path.join(OUT, 'audio', 'vo', f));
fs.mkdirSync(path.join(OUT, 'demo'));
fs.copyFileSync(path.join(ROOT, 'demo', 'demo.js'), path.join(OUT, 'demo', 'demo.js'));

/* ---- 2) index.html: çıkarılan betikler gider, demo katmanı main.js'ten hemen önce yüklenir ---- */
let html = fs.readFileSync(path.join(OUT, 'index.html'), 'utf8');
for (const f of DROP_JS) {
  const tag = new RegExp(`[ \\t]*<script src="js/${f.replace('.', '\\.')}"></script>\\r?\\n`);
  if (!tag.test(html)) fail(`index.html içinde ${f} bulunamadı`);
  html = html.replace(tag, '');
}
if (!html.includes('<script src="js/main.js"></script>')) fail('index.html içinde main.js bulunamadı');
html = html.replace('<script src="js/main.js"></script>', '<script src="demo/demo.js"></script>\n  <script src="js/main.js"></script>');
html = html.replace(/<title>([^<]*)<\/title>/, (m, t) => `<title>${t} — Demo</title>`);
fs.writeFileSync(path.join(OUT, 'index.html'), html);

/* ---- 3) açılış sahneleri: yalnızca Çiftçi Çocuğu kalır ---- */
const ocp = path.join(OUT, 'js', 'opencine.js');
let oc = fs.readFileSync(ocp, 'utf8');
const cut = oc.indexOf('  /* =================== Kanun Kaçağı'), tail = oc.lastIndexOf('})();');
if (cut < 0 || tail < cut) fail('opencine.js bölüm başlıkları bulunamadı');
oc = oc.slice(0, cut) + oc.slice(tail);
fs.writeFileSync(ocp, oc);

/* ---- 4) çeviriler: yalnızca demoda kalan kodun kullandığı anahtarlar ---- */
const tmp = path.join(OUT, '.unused.json');
const check = (extra) => { try { return execFileSync(process.execPath, [path.join(__dirname, 'i18n-check.js'), 'en', ...extra], { env: Object.assign({}, process.env, { FE_ROOT: OUT }), encoding: 'utf8' }); } catch (e) { fail('çeviri denetimi başarısız\n' + (e.stdout || '') + (e.stderr || '')); } };
check(['--unused', tmp]);
const unused = new Set(JSON.parse(fs.readFileSync(tmp, 'utf8')));
fs.rmSync(tmp);
const enp = path.join(OUT, 'lang', 'en.js');
let dropped = 0;
const en = fs.readFileSync(enp, 'utf8').split('\n').filter(line => {
  const m = line.match(/^ {4}("(?:[^"\\]|\\.)*"): /);
  if (m && unused.has(JSON.parse(m[1]))) { dropped++; return false; }
  return true;
});
fs.writeFileSync(enp, en.join('\n'));
if (dropped !== unused.size) fail(`çeviri dosyasından ${unused.size} anahtar yerine ${dropped} anahtar silindi`);
const after = check([]);
if (!/## Eksik \(kod\): 0[\s\S]*## Eksik \(veri tabloları\): 0[\s\S]*## Kullanılmayan: 0/.test(after)) fail('çeviri denetimi temiz değil\n' + after);

/* ---- 5) küçültme: yerel adlar kısalır, açıklamalar silinir; genel adlar ve özellikler aynı kalır ---- */
const { minify } = require('terser');
(async () => {
  const files = [];
  for (const d of ['js', 'lang', 'demo']) for (const f of fs.readdirSync(path.join(OUT, d))) if (f.endsWith('.js')) files.push(path.join(OUT, d, f));
  let before = 0, size = 0;
  for (const f of files) {
    const src = fs.readFileSync(f, 'utf8');
    const r = await minify(src, { ecma: 2020, compress: { passes: 2 }, mangle: true, toplevel: false, format: { comments: false } }).catch(e => fail(`${path.relative(OUT, f)}: ${e.message}`));
    fs.writeFileSync(f, r.code);
    before += src.length; size += r.code.length;
  }
  /* ---- 6) zip: index.html arşivin kökünde (itch.io bunu ister) ---- */
  execFileSync('zip', ['-qr9X', ZIP, '.', '-x', '.*'], { cwd: OUT });
  const kb = (n) => (n / 1024).toFixed(0) + ' KB';
  console.log(`demo paketi hazır: dist-demo/ ve dist-demo.zip (${kb(fs.statSync(ZIP).size)})`);
  console.log(`  çıkarılan: ${DROP_JS.join(', ')}, öbür açılış sahneleri, ${dropped} çeviri`);
  console.log(`  kod: ${kb(before)} → ${kb(size)}`);
})();
