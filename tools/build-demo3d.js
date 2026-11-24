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
     - Ayarlar > Kontroller'e 3B kameranın fare hassasiyeti satırı eklenir, radar 3B kamerayla döner (paketteki
       js/ui.js kopyasında)
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

/* ---- 3) ayarlar: Kontroller sekmesine 3B kameranın fare hassasiyeti (yalnızca paketteki kopyada) ---- */
{
  const f = path.join(OUT, 'js', 'ui.js');
  let ui = fs.readFileSync(f, 'utf8');
  const rowAt = "['aimSens', Tr('Nişan Hassasiyeti (Kol)'), 'opt', Tr('Sağ analogla nişan alırken dönüş hızı.')],";
  const defAt = 'aimAssist: 2, aimSens: 1,';
  if (ui.split(rowAt).length !== 2 || ui.split(defAt).length !== 2) fail('js/ui.js içinde Kontroller ayar satırı bulunamadı');
  const row = "\n        ['d3Sens', (I18N.lang === 'en' ? 'Mouse Sensitivity (3D Camera)' : 'Fare Hassasiyeti (3B Kamera)'), 'vol', (I18N.lang === 'en' ? 'How fast the mouse turns the 3D camera and moves the aim forward and back. 50% is normal; lower is slower, higher is faster (up to four times).' : 'Farenin 3B kamerayı döndürme ve nişanı ileri-geri taşıma hızı. %50 normaldir; azaltınca daha yavaş, artırınca daha hızlı (dört katına kadar).')],";
  ui = ui.replace(rowAt, rowAt + row).replace(defAt, defAt + ' d3Sens: 0.5,');
  // radar 3B kamerayla birlikte döner: kameranın baktığı yön yukarıda; harita katmanı (zemin, yollar, sis, rotalar)
  // döner, simgeler yeni yerlerinde dik kalır, oyuncu oku ve yön harfleri dönüşe uyar (D3.radarRot: 2D'de 0)
  const RADAR = [
    ['    c.imageSmoothingEnabled = z < 1.6;\n    const span = 2 * R / z;',
      '    const rot = typeof D3 !== \'undefined\' && D3.radarRot ? D3.radarRot() : 0, rc = Math.cos(rot), rs = Math.sin(rot);\n    c.save(); c.translate(C, C); c.rotate(rot); c.translate(-C, -C);\n    c.imageSmoothingEnabled = z < 1.6;\n    const span = 2 * R / z;'],
    ['    const RP = [0, 0], toR = (wx, wy) => { RP[0] = C + (wx / TS - tx) * z; RP[1] = C + (wy / TS - ty) * z; return RP; };',
      '    const RP = [0, 0], toR0 = (wx, wy) => { RP[0] = C + (wx / TS - tx) * z; RP[1] = C + (wy / TS - ty) * z; return RP; };\n    const toR = (wx, wy) => { const dx = (wx / TS - tx) * z, dy = (wy / TS - ty) * z; RP[0] = C + rc * dx - rs * dy; RP[1] = C + rs * dx + rc * dy; return RP; };'],
    ['      const lp = toR(G.law.lastX, G.law.lastY), lx = lp[0], ly = lp[1];', '      const lp = toR0(G.law.lastX, G.law.lastY), lx = lp[0], ly = lp[1];'],
    ['    Nav.radar(c, toR, C, R, G.t);', '    Nav.radar(c, toR0, C, R, G.t);\n    c.restore();'],
    ['    c.translate(pp[0], pp[1]); c.rotate(P.riding ? P.riding.ang : P.ang);', '    c.translate(pp[0], pp[1]); c.rotate((P.riding ? P.riding.ang : P.ang) + rot);'],
    ['      if (d % 90 === 0) continue;', '      if (d % 90 === 0 && typeof D3 === \'undefined\') continue;'],
    ['    lt.forEach((t, i) => {\n      const a = i * Math.PI / 2 - Math.PI / 2, x = C + Math.cos(a) * (R + 5.6), y = C + Math.sin(a) * (R + 5.6);',
      '    if (typeof D3 === \'undefined\') lt.forEach((t, i) => {\n      const a = i * Math.PI / 2 - Math.PI / 2, x = C + Math.cos(a) * (R + 5.6), y = C + Math.sin(a) * (R + 5.6);'],
    ['    c.drawImage(this.bezelArt(C, R), 0, 0, 224, 224);',
      '    c.drawImage(this.bezelArt(C, R), 0, 0, 224, 224);\n' +
      '    if (typeof D3 !== \'undefined\') {\n' +
      '      const rot = D3.radarRot ? D3.radarRot() : 0, lt = [Tr(\'@pusula|K\'), Tr(\'@pusula|D\'), Tr(\'@pusula|G\'), Tr(\'@pusula|B\')];\n' +
      '      c.font = \'bold 9px "IM Fell English SC", serif\'; c.textAlign = \'center\'; c.textBaseline = \'middle\';\n' +
      '      lt.forEach((t, i) => {\n' +
      '        const a = i * Math.PI / 2 - Math.PI / 2 + rot, x = C + Math.cos(a) * (R + 5.6), y = C + Math.sin(a) * (R + 5.6);\n' +
      '        c.fillStyle = i === 0 ? \'#8e1b12\' : \'#1d150e\'; c.beginPath(); c.arc(x, y, 5.6, 0, TAU); c.fill();\n' +
      '        if (i === 0) { c.strokeStyle = \'rgba(240,212,135,0.9)\'; c.lineWidth = 0.8; c.stroke(); }\n' +
      '        c.fillStyle = i === 0 ? \'#fff3d6\' : \'rgba(236,216,172,0.92)\'; c.fillText(t, x, y + 0.4);\n' +
      '      });\n' +
      '    }'],
  ];
  for (const [a, b] of RADAR) {
    if (ui.split(a).length !== 2) fail('js/ui.js içinde radar satırı bulunamadı: ' + a.slice(0, 60));
    ui = ui.replace(a, () => b);
  }
  fs.writeFileSync(f, ui);
}

/* ---- 4) sözdizimi denetimi ve zip ---- */
for (const f of [...LAYER.map(x => 'demo3d/' + x), 'js/ui.js']) { try { execFileSync(process.execPath, ['--check', path.join(OUT, f)], { stdio: 'pipe' }); } catch (e) { fail(`${f} sözdizimi hatası\n` + (e.stderr || '')); } }
try { execFileSync('zip', ['-qr9X', ZIP, '.'], { cwd: OUT, stdio: 'pipe' }); }
catch (e) { fail('zip oluşturulamadı (zip aracı kurulu mu?)\n' + (e.stderr || '')); }
const mb = (fs.statSync(ZIP).size / 1048576).toFixed(1);
console.log(`3B test paketi hazır: dist-demo3d/ ve dist-demo3d.zip (${mb} MB)`);
