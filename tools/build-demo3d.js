#!/usr/bin/env node
'use strict';
/* ==========================================================
   FRONTIER'S END — 3B test demosu (tarayıcıda oynanır)

     npm run build:demo3d   → dist-demo3d/ klasörü ve dist-demo3d.zip

   Oyunun kendi dosyalarına dokunmaz: tam oyunu dist-demo3d/ altına kopyalar ve demo3d/ katmanını
   (3B çizici, modeller, sahne kurucu, oyun katmanı) main.js'ten hemen önce ekler. Depodaki oyun,
   masaüstü sürümü, demo paketi ve testler bu betikten etkilenmez.
     - Hikâye kapalı olduğundan seslendirme kayıtları pakete girmez
     - Geliştirici araçları (debug.js) pakete girmez; saat [ ve ] tuşlarıyla değişir
     - Kod küçültülmez: test sürümüdür
   ========================================================== */
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const ROOT = path.join(__dirname, '..'), OUT = path.join(ROOT, 'dist-demo3d'), ZIP = path.join(ROOT, 'dist-demo3d.zip');
const LAYER = ['gl.js', 'models.js', 'scene.js', 'demo3d.js'];
const DROP_JS = ['debug.js'];
const fail = (m) => { console.error('3B test paketi: ' + m); process.exit(1); };

/* ---- 1) kopya ---- */
fs.rmSync(OUT, { recursive: true, force: true });
fs.rmSync(ZIP, { force: true });
fs.mkdirSync(OUT, { recursive: true });
for (const it of ['index.html', 'css', 'js', 'lang', 'audio', 'fonts', 'video', 'LICENSE']) if (fs.existsSync(path.join(ROOT, it))) fs.cpSync(path.join(ROOT, it), path.join(OUT, it), { recursive: true });
for (const f of DROP_JS) fs.rmSync(path.join(OUT, 'js', f));
// seslendirme: hikâye kapalı, kayıtlar girmez (satır listesi boş; kaynaklar kalır)
{
  const VO = path.join(OUT, 'audio', 'vo');
  if (fs.existsSync(VO)) {
    const man = JSON.parse(fs.readFileSync(path.join(VO, 'manifest.json'), 'utf8'));
    for (const lang of Object.keys(man)) { man[lang] = []; fs.rmSync(path.join(VO, lang), { recursive: true, force: true }); }
    for (const f of fs.readdirSync(VO)) if (f.endsWith('.csv') || f === 'lines.json') fs.rmSync(path.join(VO, f));
    fs.writeFileSync(path.join(VO, 'manifest.json'), JSON.stringify(man));
  }
}
if (fs.existsSync(path.join(OUT, 'video'))) for (const f of fs.readdirSync(path.join(OUT, 'video'))) if (!/\.(mp4|webm)$/i.test(f)) fs.rmSync(path.join(OUT, 'video', f), { recursive: true });
fs.mkdirSync(path.join(OUT, 'demo3d'));
for (const f of LAYER) {
  if (!fs.existsSync(path.join(ROOT, 'demo3d', f))) fail(`demo3d/${f} bulunamadı`);
  fs.copyFileSync(path.join(ROOT, 'demo3d', f), path.join(OUT, 'demo3d', f));
}

/* ---- 2) index.html: geliştirici aracı çıkar, 3B katmanı main.js'ten hemen önce yüklenir ---- */
let html = fs.readFileSync(path.join(OUT, 'index.html'), 'utf8');
for (const f of DROP_JS) {
  const tag = new RegExp(`[ \\t]*<script src="js/${f.replace('.', '\\.')}"></script>\\r?\\n`);
  if (!tag.test(html)) fail(`index.html içinde ${f} bulunamadı`);
  html = html.replace(tag, '');
}
if (!html.includes('<script src="js/main.js"></script>')) fail('index.html içinde main.js bulunamadı');
html = html.replace('<script src="js/main.js"></script>', LAYER.map(f => `<script src="demo3d/${f}"></script>`).join('\n  ') + '\n  <script src="js/main.js"></script>');
html = html.replace(/<title>([^<]*)<\/title>/, (m, t) => `<title>${t} — 3D Test</title>`);
fs.writeFileSync(path.join(OUT, 'index.html'), html);

/* ---- 3) sözdizimi denetimi ve zip ---- */
for (const f of LAYER) { try { execFileSync(process.execPath, ['--check', path.join(OUT, 'demo3d', f)], { stdio: 'pipe' }); } catch (e) { fail(`demo3d/${f} sözdizimi hatası\n` + (e.stderr || '')); } }
try { execFileSync('zip', ['-qr9X', ZIP, '.'], { cwd: OUT, stdio: 'pipe' }); }
catch (e) { fail('zip oluşturulamadı (zip aracı kurulu mu?)\n' + (e.stderr || '')); }
const mb = (fs.statSync(ZIP).size / 1048576).toFixed(1);
console.log(`3B test paketi hazır: dist-demo3d/ ve dist-demo3d.zip (${mb} MB)`);
