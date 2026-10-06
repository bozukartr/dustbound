#!/usr/bin/env node
'use strict';
/* ==========================================================
   FRONTIER'S END — test çalıştırıcı
     npm test                    → bütün testler
     npm test -- carry law       → adında "carry" ya da "law" geçen dosyalar
     npm test -- --jobs 2        → aynı anda en fazla 2 dosya
     npm test -- --headed        → tarayıcıyı görünür aç
     npm test -- --list          → test dosyalarını listele
   Her test dosyası tests/e2e/*.test.js altında durur ve şunu dışa aktarır:
     { name, timeout?, async run(t) }
   t: page(), newGame(), step(), ok(), eq(), near(), sleep()
   Oyun sayfası bağımlılıksız küçük bir statik sunucudan açılır.
   Başarısız adımların ekran görüntüleri tests/output/ altına yazılır.
   ========================================================== */
const http = require('http'), fs = require('fs'), path = require('path'), os = require('os');
const { loadPlaywright, AssertionError, sleep, pageHelpers } = require('./lib');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(__dirname, 'output');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.mp4': 'video/mp4', '.webm': 'video/webm' };

/* ---------------- argümanlar ---------------- */
const argv = process.argv.slice(2);
const opt = { jobs: Math.max(1, Math.min(3, Math.floor(os.cpus().length / 2))), headed: false, list: false, filters: [] };
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--jobs' || a === '-j') opt.jobs = Math.max(1, +argv[++i] || 1);
  else if (a === '--headed') opt.headed = true;
  else if (a === '--list') opt.list = true;
  else opt.filters.push(a.toLowerCase());
}

/* ---------------- statik sunucu ---------------- */
function serve() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (p.endsWith('/')) p += 'index.html';
      const f = path.normalize(path.join(ROOT, p));
      if (!f.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
      fs.readFile(f, (err, data) => {
        if (err) { res.writeHead(404); res.end(); return; }
        res.writeHead(200, { 'Content-Type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
        res.end(data);
      });
    });
    srv.listen(0, '127.0.0.1', () => resolve(srv));
  });
}

/* ---------------- bir test dosyasını çalıştır ---------------- */
async function runFile(file, browser, url) {
  const mod = require(file);
  const base = path.basename(file, '.test.js');
  const res = { file: base, name: mod.name || base, steps: [], errors: [], t0: Date.now() };
  const contexts = [];
  const pageErrors = new Map();
  const t = {
    url,
    sleep,
    /* Yeni tarayıcı bağlamı: temiz localStorage, varsayılan Türkçe */
    async page(o = {}) {
      const ctx = await browser.newContext({ locale: o.locale || 'tr-TR', viewport: o.viewport || { width: 1280, height: 720 } });
      contexts.push(ctx);
      const p = await ctx.newPage();
      p.on('pageerror', (e) => { const k = e.message; if (!pageErrors.has(k)) pageErrors.set(k, (e.stack || '').split('\n').slice(0, 3).join(' | ')); });
      // Paralel sayfalar birbirinin odağını çalar; oyun odak kaybında duraklatma menüsünü
      // açtığı için testlerde pencere "blur" olayı yok sayılır.
      await p.addInitScript(() => { window.addEventListener('blur', (e) => { if (e.target === window) e.stopImmediatePropagation(); }, true); });
      // hoş geldin rehberi yalnızca onu sınayan testte açılır
      if (!o.guide) await p.addInitScript(() => { window.__testNoGuide = true; });
      // hikâyeli başlangıç ve sinematikleri yalnızca onları sınayan testler açar
      if (!o.story) await p.addInitScript(() => { window.__testNoStory = true; });
      if (!o.cine) await p.addInitScript(() => { window.__testNoCine = true; });
      if (!o.intro) await p.addInitScript(() => { window.__testNoIntro = true; });
      // ses örneklerini yalnızca ses testi yükler (öbür testler prosedürel sesle hızlı kalır)
      if (!o.sfx) await p.addInitScript(() => { window.__testNoSfx = true; });
      // ana menü arka plan videosunu yalnızca onu sınayan test açar
      if (!o.menuvid) await p.addInitScript(() => { window.__testNoMenuVid = true; });
      if (o.init) await p.addInitScript(o.init);
      await p.goto(url + (o.path || 'index.html'));   // path: başka bir sayfa (ör. demo paketi)
      // wait: false → menüyü bekleme (açılış videosu testi)
      await p.waitForFunction((w) => typeof G !== 'undefined' && (!w || G.state === 'menu'), o.wait !== false, { timeout: 30000 });
      return p;
    },
    /* Ana menüden yeni hayat başlat (karakter ekranında varsayılanlarla) */
    async newGame(o = {}) {
      const p = o.page || await t.page(o);
      await sleep(300);
      await p.keyboard.press('Enter'); await sleep(400);
      // karakter ekranı adım adım: her bölümde İleri, sonunda Hayata Başla
      await p.evaluate(() => { for (let k = 0; k < 8 && document.querySelector('#cr-go'); k++) document.querySelector('#cr-go').click(); });
      await p.waitForFunction(() => G.state === 'play', null, { timeout: 150000 });
      await sleep(600);
      await p.evaluate(pageHelpers);
      await p.evaluate(() => { UI.el.help.classList.add('hidden'); });
      return p;
    },
    /* Oyun başladıktan sonra sayfa içi yardımcıları (TH) ekle */
    async helpers(p) { await p.evaluate(pageHelpers); },
    async step(name, fn, { page } = {}) {
      const s0 = Date.now();
      try {
        await fn();
        res.steps.push({ name, ok: true, ms: Date.now() - s0 });
      } catch (e) {
        const msg = e instanceof AssertionError ? e.message : (e && e.stack ? e.stack.split('\n').slice(0, 3).join('\n      ') : String(e));
        res.steps.push({ name, ok: false, ms: Date.now() - s0, msg });
        const pg = page || t.lastPage;
        if (pg) { try { fs.mkdirSync(OUT, { recursive: true }); await pg.screenshot({ path: path.join(OUT, `${base}-${res.steps.length}.png`) }); } catch (x) {} }
      }
    },
    ok(cond, msg, detail) { if (!cond) throw new AssertionError(msg + (detail !== undefined ? ' — ' + JSON.stringify(detail) : '')); },
    eq(a, b, msg) { if (JSON.stringify(a) !== JSON.stringify(b)) throw new AssertionError(`${msg}: beklenen ${JSON.stringify(b)}, gelen ${JSON.stringify(a)}`); },
    near(a, b, tol, msg) { if (!(Math.abs(a - b) <= tol)) throw new AssertionError(`${msg}: beklenen ${b}±${tol}, gelen ${a}`); },
  };
  // son açılan sayfayı hata ekran görüntüsü için hatırla
  const origPage = t.page;
  t.page = async (o) => { const p = await origPage(o); t.lastPage = p; return p; };
  const timeout = mod.timeout || 240000;
  let timer;
  try {
    await Promise.race([
      mod.run(t),
      new Promise((_, rej) => { timer = setTimeout(() => rej(new Error(`zaman aşımı (${timeout / 1000} sn)`)), timeout); }),
    ]);
  } catch (e) {
    res.steps.push({ name: 'dosya', ok: false, ms: 0, msg: e && e.stack ? e.stack.split('\n').slice(0, 3).join('\n      ') : String(e) });
  } finally { clearTimeout(timer); }
  for (const [k, st] of pageErrors) res.errors.push(k + (st ? '\n        ' + st : ''));
  for (const c of contexts) { try { await c.close(); } catch (e) {} }
  res.ms = Date.now() - res.t0;
  return res;
}

/* ---------------- rapor ---------------- */
function report(r) {
  const failed = r.steps.filter(s => !s.ok).length + (r.errors.length ? 1 : 0);
  const lines = [`${failed ? '\x1b[31m✗' : '\x1b[32m✓'}\x1b[0m ${r.file} — ${r.name} \x1b[2m(${(r.ms / 1000).toFixed(1)} sn)\x1b[0m`];
  for (const s of r.steps) lines.push(`    ${s.ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${s.name} \x1b[2m${(s.ms / 1000).toFixed(1)} sn\x1b[0m${s.ok ? '' : '\n      \x1b[31m' + s.msg + '\x1b[0m'}`);
  if (r.errors.length) lines.push(`    \x1b[31m✗ sayfa hataları (${r.errors.length}):\n      ${r.errors.join('\n      ')}\x1b[0m`);
  console.log(lines.join('\n'));
  return failed;
}

(async () => {
  let files = fs.readdirSync(path.join(__dirname, 'e2e')).filter(f => f.endsWith('.test.js')).sort();
  if (opt.filters.length) files = files.filter(f => opt.filters.some(q => f.toLowerCase().includes(q)));
  if (opt.list) { for (const f of files) console.log(f, '—', require(path.join(__dirname, 'e2e', f)).name); return; }
  if (!files.length) { console.log('Eşleşen test yok.'); process.exit(1); }
  const { chromium } = loadPlaywright();
  const srv = await serve();
  const url = `http://127.0.0.1:${srv.address().port}/`;
  const browser = await chromium.launch({ headless: !opt.headed });
  console.log(`\x1b[1mFrontier's End testleri\x1b[0m — ${files.length} dosya, aynı anda ${opt.jobs}\n`);
  const t0 = Date.now();
  const queue = files.map(f => path.join(__dirname, 'e2e', f));
  const results = [];
  let failed = 0;
  await Promise.all(Array.from({ length: Math.min(opt.jobs, queue.length) }, async () => {
    while (queue.length) {
      const f = queue.shift();
      const r = await runFile(f, browser, url);
      results.push(r);
      failed += report(r) ? 1 : 0;
    }
  }));
  await browser.close();
  srv.close();
  const steps = results.reduce((a, r) => a + r.steps.length, 0), bad = results.reduce((a, r) => a + r.steps.filter(s => !s.ok).length + (r.errors.length ? 1 : 0), 0);
  console.log(`\n${failed ? '\x1b[31m' : '\x1b[32m'}${results.length - failed}/${results.length} dosya, ${steps - bad}/${steps} adım başarılı\x1b[0m — ${((Date.now() - t0) / 1000).toFixed(0)} sn`);
  if (failed) console.log(`Başarısız adımların ekran görüntüleri: ${path.relative(process.cwd(), OUT)}/`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
