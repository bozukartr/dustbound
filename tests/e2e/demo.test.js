'use strict';
/* Demo paketi (npm run build:demo): paket kurulur, tarayıcıda hatasız açılır; yalnızca Çiftçi Çocuğu
   ve Sully'nin hikâyesi var, öbür hikâyeler ve geliştirici araçları pakette yok; açılış sinematiği oynar,
   kayıtlar ayrı tutulur; beşinci bölüm başlarken ya da gün sınırında demo biter, kayıt yeniden
   yüklenince de biter. Depodaki tam oyun bu testten etkilenmez. */
const path = require('path'), fs = require('fs'), { execFileSync } = require('child_process');
const ROOT = path.join(__dirname, '..', '..');
module.exports = {
  name: 'Demo paketi',
  timeout: 420000,
  async run(t) {
    const errInit = () => { window.__errs = []; const ce = console.error; console.error = (...a) => { window.__errs.push(String(a[0] && a[0].stack || a[0]).slice(0, 300)); ce(...a); }; };
    const open = (o = {}) => t.page(Object.assign({ path: 'dist-demo/index.html', init: errInit }, o));
    const start = async (p) => {
      await t.sleep(300); await p.keyboard.press('Enter'); await t.sleep(400);
      await p.evaluate(() => { for (let k = 0; k < 8 && document.querySelector('#cr-go'); k++) document.querySelector('#cr-go').click(); });
    };
    const ended = (p) => p.waitForFunction(() => { const e = document.getElementById('demo-end'); return e && G.state === 'demo'; }, null, { timeout: 15000 });

    await t.step('paket kurulur: öbür hikâyeler, geliştirici aracı ve okunabilir kaynak yok', async () => {
      execFileSync(process.execPath, [path.join(ROOT, 'tools', 'build-demo.js')], { cwd: ROOT, stdio: 'pipe' });
      const D = path.join(ROOT, 'dist-demo');
      t.ok(fs.existsSync(path.join(ROOT, 'dist-demo.zip')), 'zip hazır');
      const js = fs.readdirSync(path.join(D, 'js'));
      t.eq(js.filter(f => /^story_|^debug/.test(f)), [], 'hikâye ve geliştirici dosyaları yok');
      const html = fs.readFileSync(path.join(D, 'index.html'), 'utf8');
      t.ok(!/story_|debug\.js/.test(html) && /demo\/demo\.js[\s\S]*js\/main\.js/.test(html), 'index.html betikleri', html.match(/<script[^>]*>/g));
      const all = ['js', 'lang', 'demo'].flatMap(d => fs.readdirSync(path.join(D, d)).map(f => fs.readFileSync(path.join(D, d, f), 'utf8'))).join('\n');
      for (const w of ['GRETA_LOOK', 'Greta', 'Vance', 'Elias', 'Kanun Kaçağı: saklı', 'Debug']) t.ok(!all.includes(w), `pakette "${w}" yok`);
      const q = fs.readFileSync(path.join(D, 'js', 'quests.js'), 'utf8');
      t.ok(!/\/\*|\n {2}/.test(q.slice(0, 4000)), 'kod küçültülmüş');
      // depodaki oyun dosyaları yerinde
      for (const f of ['story_outlaw.js', 'story_immigrant.js', 'story_rail.js', 'story_trapper.js', 'debug.js']) t.ok(fs.existsSync(path.join(ROOT, 'js', f)), `tam oyunda ${f} duruyor`);
    });

    await t.step('ana menü: DEMO işareti, yalnızca Çiftçi Çocuğu ve Sully', async () => {
      const p = await open();
      const r = await p.evaluate(() => ({ bgs: BACKGROUNDS.map(b => b.id), stories: Object.keys(STORIES), dbg: typeof Debug, ver: document.querySelector('.mm-ver').textContent, tag: (document.getElementById('demo-tag') || {}).textContent, errs: window.__errs }));
      t.eq(r.bgs, ['farm'], 'geçmiş'); t.eq(r.stories, ['sully'], 'hikâye'); t.eq(r.dbg, 'undefined', 'geliştirici aracı yok');
      t.ok(/DEMO/.test(r.ver) && /Çiftçi Çocuğu/.test(r.tag), 'menüde demo işareti', r);
      await p.evaluate(() => { I18N.setLang('en'); UI.showMainMenu(); });
      t.ok(/Farm Kid/.test(await p.evaluate(() => document.getElementById('demo-tag').textContent)), 'İngilizce demo işareti');
      t.eq(r.errs, [], 'konsol hatası yok');
    });

    await t.step('yeni oyun: Çiftçi açılışı oynar, hikâye başlar, kayıtlar ayrı', async () => {
      const p = await open({ cine: true, story: true });
      await start(p);
      await p.waitForFunction(() => { const c = document.getElementById('cinema'); return c && c.classList.contains('on'); }, null, { timeout: 150000 });
      const st = await p.evaluate(() => Cinema.stat());
      t.ok(st.scene === 'farm' && st.lines === 4, 'çiftçi açılışı, dört satır', st);
      await p.keyboard.press('Enter');
      await p.waitForFunction(() => G.state === 'play' && !document.getElementById('cinema').classList.contains('on'), null, { timeout: 20000 });
      await t.helpers(p);
      await p.evaluate(() => { const w = document.querySelector('.modal.welcome'); if (w) UI.closeAll(); });
      await p.waitForFunction(() => G.story && G.story.on && G.story.id === 'sully', null, { timeout: 20000 });
      const r = await p.evaluate(() => { G.saveGame(true); return { bg: G.background, keys: Object.keys(localStorage), errs: window.__errs }; });
      t.eq(r.bg, 'farm', 'geçmiş');
      t.ok(r.keys.length > 0 && r.keys.every(k => k.startsWith('demo_')), 'bütün kayıt anahtarları demo_ ile başlar', r.keys);
      t.eq(r.errs, [], 'konsol hatası yok');

      // dördüncü bölüm biter, beşinci başlarken demo sonu
      await p.evaluate(() => G.qChapter(3));
      t.ok(await p.evaluate(() => G.story.ch === 3 && !document.getElementById('demo-end')), 'dördüncü bölüm oynanır');
      await p.evaluate(() => G.qChapter(4));
      await ended(p);
      const e = await p.evaluate(() => ({ txt: document.getElementById('demo-end').textContent, ch: G.story.ch }));
      t.ok(/DEMO SONU/.test(e.txt) && e.ch === 4, 'demo sonu ekranı', e);
      await t.sleep(500);
      t.eq(await p.evaluate(() => G.state), 'demo', 'oyun durdu');
      // ana menüye dön, devam et: kayıt yeniden yüklenince demo yine biter
      await p.keyboard.press('Enter');   // klavye/oyun koluyla da çıkılır
      await p.waitForFunction(() => G.state === 'menu' && !document.getElementById('demo-end'), null, { timeout: 10000 });
      await p.click('.mm-item[data-id="cont"]');
      await ended(p);
      t.eq(await p.evaluate(() => window.__errs), [], 'konsol hatası yok');
    });

    await t.step('hikâye bırakılırsa üçüncü günün sonunda demo biter', async () => {
      const p = await open({ story: true });
      await start(p);
      await p.waitForFunction(() => G.state === 'play' && G.story && G.story.on, null, { timeout: 150000 });
      await p.evaluate(() => { G.clock = 2 * 1440 + 23 * 60; });
      await t.sleep(600);
      t.eq(await p.evaluate(() => G.state), 'play', 'üçüncü gün sürerken oyun açık');
      await p.evaluate(() => { G.story.on = false; G.clock = 3 * 1440 + 1; });
      await ended(p);
      t.eq(await p.evaluate(() => window.__errs), [], 'konsol hatası yok');
    });
  },
};
