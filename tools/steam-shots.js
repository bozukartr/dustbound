#!/usr/bin/env node
'use strict';
/* ==========================================================
   FRONTIER'S END — Steam mağaza ekran görüntüleri
     node tools/steam-shots.js                 → İngilizce, bütün sahneler
     node tools/steam-shots.js --lang tr       → Türkçe arayüzle
     node tools/steam-shots.js town poker      → yalnızca adı geçen sahneler
     node tools/steam-shots.js --out klasör    → çıktı klasörü (varsayılan steam/screenshots/<dil>)
     node tools/steam-shots.js --r3d           → deneme 3D çizicisiyle (js/r3d.js)
     node tools/steam-shots.js --both          → her sahne iki kez: <ad>_2d.png ve <ad>_3d.png (karşılaştırma)
   Her sahne gerçek oyunda kurulur: yer, saat, hava ve kişiler ayarlanır,
   oyun birkaç saniye akar, sonra 1920x1080 ekran görüntüsü alınır.
   Bildirimler, ipuçları ve başarım duyuruları çekimden önce gizlenir.
   ========================================================== */
const http = require('http'), fs = require('fs'), path = require('path');
const { loadPlaywright, sleep, pageHelpers } = require('../tests/lib');

const ROOT = path.join(__dirname, '..');
const argv = process.argv.slice(2);
const opt = { lang: 'en', out: null, only: [], r3d: false, both: false };
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--lang') opt.lang = argv[++i];
  else if (argv[i] === '--out') opt.out = argv[++i];
  else if (argv[i] === '--r3d') opt.r3d = true;
  else if (argv[i] === '--both') opt.both = true;
  else opt.only.push(argv[i]);
}
const OUT = opt.out || path.join(ROOT, 'steam', 'screenshots', opt.lang);
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.svg': 'image/svg+xml' };

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

/* ---------------- sayfa içi sahne yardımcıları ---------------- */
function stageHelpers() {
  const css = document.createElement('style'); css.id = 'shot-css';
  css.textContent = '.shot-clean #toasts, .shot-clean #feed, .shot-clean #hud-help, .shot-clean #loc-title, .shot-clean #help, .shot-clean #fps, .shot-clean #prompts { display: none !important; } .shot-nohud #hud > *:not(#subtitle):not(#binoc) { visibility: hidden !important; } .shot-nohud #subtitle { visibility: visible; }';
  document.head.appendChild(css);
  // çekim sırasında ipucu ve duyuru çıkmasın
  G.hintOnce = () => {}; UI.help = () => {};
  // 1920x1080'de 3x piksel ölçeği: 640x360 oyun pikseli, sahne daha geniş görünür
  G.settings.zoom = 3; G.applySettings();
  window.SC = {
    reset() {
      UI.closeAll();
      if (G.binoc) G.binocOff();
      if (G.posse) { for (const e of G.posse.ents) e.remove = true; G.posse = null; }
      const P = G.player;
      if (P.riding) P.dismount(); P.mountAnim = null;
      if (G.horse) { G.horse.x = P.x + 900; G.horse.y = P.y; G.horse.spd = 0; }
      SC.zoom(3); G.weather.i = 0;
      P.aiming = false; P.deadeye = false; P.crouch = false; P.carry = null;
      Object.assign(P, { hp: P.maxHp, hunger: 90, thirst: 90, energy: 90, clean: 90, drunk: 0, sick: 0, poison: 0 });
      Object.assign(G.law, { level: 0, bounty: 0, maskBounty: 0 }); G.reports = [];
      Debug.opt.god = true; G.godMode = true;   // hata ayıklama paneli her karede godMode'u kendi ayarına eşitler
      document.body.classList.add('shot-clean');
      document.body.classList.remove('shot-nohud');
      G.cam.x = P.x; G.cam.y = P.y;
    },
    zoom(z) { if (G.settings.zoom !== z) { G.settings.zoom = z; G.applySettings(); } },
    hud(on) { document.body.classList.toggle('shot-nohud', !on); },
    time(h) { G.clock = Math.floor(G.clock / 1440) * 1440 + h * 60; },
    weather(type, i = 0) { G.weather = { type, t: 99999, i, cloud: type === 'clear' ? 0 : type === 'storm' ? 0.9 : type === 'rain' ? 0.8 : 0.5, fogI: type === 'fog' ? 1 : 0 }; },
    go(x, y) { TH.goto(x, y); G.cam.x = x; G.cam.y = y; },
    town(id) { return TH.town(id); },
    /* Verilen karo türünün yoğun olduğu, açık bir nokta */
    biome(types, near, maxR = 9000, pad = 3, townPad = 8) {
      const W = G.world, [nx, ny] = near || [G.player.x, G.player.y];
      let best = null, bd = 1e18;
      for (let ty = 8; ty < WH - 8; ty += 3) for (let tx = 8; tx < WW - 8; tx += 3) {
        const x = tx * TS + 8, y = ty * TS + 8, d = (x - nx) ** 2 + (y - ny) ** 2;
        if (d > maxR * maxR || d > bd) continue;
        if (W.townAt(x, y, townPad)) continue;
        let ok = true, n = 0;
        for (let dy = -pad; dy <= pad && ok; dy++) for (let dx = -pad; dx <= pad && ok; dx++) {
          const i = (ty + dy) * WW + tx + dx, t = W.tile[i];
          if (isWaterT(t)) ok = false; else if (types.includes(t)) n++;
        }
        if (!ok || n < (2 * pad + 1) ** 2 * 0.8 || W.blocked(x, y, 6)) continue;
        best = [x, y]; bd = d;
      }
      return best;
    },
    npc(dx, dy, role, o = {}) { const P = G.player; const n = new NPC(P.x + dx, P.y + dy, role, o); G.addEnt(n); return n; },
    animal(dx, dy, type) { const P = G.player; const a = new Animal(P.x + dx, P.y + dy, type); G.addEnt(a); return a; },
    ride() { const P = G.player, h = G.horse; if (!h) return; h.dead = false; h.hp = h.maxHp; h.x = P.x; h.y = P.y; h.spd = 0; P.mountAnim = null; if (!P.riding) P.mount(h, true); P.mountAnim = null; },
    screen(e) { return G.toScreen(e.x, e.y); },
  };
}

/* ---------------- sahneler ----------------
   Her sahne: { name, title (açıklama), async run(p, S) } — p Playwright sayfası */
const SCENES = [
  {
    name: '01_town', title: 'Kalabalık kasaba, öğleden sonra, at sırtında',
    async run(p) {
      await p.evaluate(() => {
        SC.reset(); SC.weather('clear'); SC.time(16.2);
        const t = SC.town('stclement'), s = G.world.buildings.find(b => b.town === t.id && b.type === 'saloon');
        SC.go(s.door.x - 30, s.door.y + 46); SC.ride(); G.player.riding.ang = 0.1;
        for (let k = 0; k < 8; k++) G.spawnTick();
      });
      await sleep(12000);
    },
  },
  {
    name: '02_saloon', title: 'Gece saloon içi: piyano, müşteriler, kart masası',
    async run(p) {
      await p.evaluate(() => {
        SC.reset(); SC.zoom(4); SC.weather('clear'); SC.time(21.5);
        const t = SC.town('stclement'), s = G.world.buildings.find(b => b.town === t.id && b.type === 'saloon');
        TH.inside(s); G.player.y -= 30; G.spawnTick(); G.townStaff(t);
      });
      await sleep(5000);
      await p.evaluate(() => G.townStaff(SC.town('stclement')));
      await sleep(4000);
    },
  },
  {
    name: '03_shootout', title: 'Kızıl kayalıklarda haydutlarla çatışma',
    async run(p) {
      await p.evaluate(() => {
        SC.reset(); SC.zoom(4); SC.weather('clear'); SC.time(17.2);
        const c = SC.town('dustcreek'), s = SC.biome([T.REDROCK, T.DESERT, T.DRY], [c.cx, c.cy + 600], 4000, 4, 20);
        SC.go(s[0], s[1]); TH.clearNpcs();
        const P = G.player; P.giveWeapon('schofield', true); P.weapon = 'schofield'; P.ammo.pistol = 99; P.clip.schofield = 6;
        window.BD = [[95, -35, 0], [120, 30, 1], [70, 60, 0], [140, -70, 1]].map(([dx, dy, m]) => { const n = SC.npc(dx, dy, 'bandit', { hostile: true, mounted: !!m, weapon: pick(['cattleman', 'repeater']) }); n.aggro = true; return n; });
      });
      await sleep(1400);
      for (const i of [0, 2]) {
        const t = await p.evaluate((i) => SC.screen(BD[i]), i);
        await p.mouse.move(t.x, t.y); await p.mouse.down({ button: 'right' }); await sleep(500);
        await p.mouse.click(t.x, t.y); await sleep(200);
      }
      const t = await p.evaluate(() => SC.screen(BD[1])); await p.mouse.move(t.x, t.y); await sleep(350);
      await p.mouse.click(t.x, t.y); await sleep(90);
    },
    async after(p) { await p.mouse.up({ button: 'right' }); await p.evaluate(() => { for (const e of G.ents) if (e.role === 'bandit') e.remove = true; }); },
  },
  {
    name: '04_hunt', title: 'Ormanda geyik avı, yay ile',
    async run(p) {
      await p.evaluate(() => {
        SC.reset(); SC.zoom(4); SC.weather('clear'); SC.time(9.2);
        const c = SC.town('cedarfalls'), s = SC.biome([T.GRASS, T.FOREST], [c.cx + 500, c.cy], 4000, 3, 20);
        SC.go(s[0], s[1]); TH.clearNpcs();
        const P = G.player; P.giveWeapon('bow', true); P.weapon = 'bow'; P.ammo.arrow = 20;
        window.DEER = [[95, -30], [118, -8], [105, 22], [135, 6], [80, 40]].map(([dx, dy]) => { const a = SC.animal(dx, dy, 'deer'); a.state = 'idle'; a.t = 30; return a; });
      });
      await sleep(900);
      const t = await p.evaluate(() => SC.screen(DEER[1]));
      await p.mouse.move(t.x, t.y); await p.mouse.down({ button: 'right' }); await sleep(1300);
    },
    async after(p) { await p.mouse.up({ button: 'right' }); await p.evaluate(() => { for (const e of G.ents) if (e.kind === 'animal') e.remove = true; }); },
  },
  {
    name: '05_snow', title: 'Karlı dağlarda kurt sürüsü',
    async run(p) {
      await p.evaluate(() => {
        SC.reset(); SC.zoom(4); SC.weather('rain', 0.7); SC.time(15.6);
        const c = SC.town('silverridge'), s = SC.biome([T.SNOW], [c.cx, c.cy], 8000, 6, 20);
        SC.go(s[0], s[1]); TH.clearNpcs();
        const P = G.player; P.giveWeapon('winchester', true); P.weapon = 'winchester'; P.ammo.repeater = 60; P.coat = 'coat_fur';
        window.WO = [[100, -40], [120, 10], [95, 50]].map(([dx, dy]) => { const a = SC.animal(dx, dy, 'wolf'); a.state = 'attack'; a.t = 20; return a; });
      });
      await sleep(700);
      const t = await p.evaluate(() => SC.screen(WO[1]));
      await p.mouse.move(t.x, t.y); await p.mouse.down({ button: 'right' }); await sleep(600);
      await p.mouse.click(t.x, t.y); await sleep(120);
    },
    async after(p) { await p.mouse.up({ button: 'right' }); await p.evaluate(() => { G.player.coat = null; for (const e of G.ents) if (e.kind === 'animal') e.remove = true; }); },
  },
  {
    name: '06_stagecoach', title: 'Çölde posta arabası, gün batımı',
    async run(p) {
      await p.evaluate(() => {
        SC.reset(); SC.weather('clear'); SC.time(18.8);
        const W = G.world, c = SC.town('dustcreek');
        let best = null, bd = 1e18;
        for (const r of W.roads) for (let i = 4; i < r.pts.length - 4; i++) {
          const [x, y] = r.pts[i]; if (W.townAt(x, y, 25)) continue;
          let rail = false; for (let dy = -12; dy <= 12 && !rail; dy++) for (let dx = -12; dx <= 12 && !rail; dx++) if (W.flags[((y >> 4) + dy) * WW + (x >> 4) + dx] & 2) rail = true;
          if (rail) continue;
          const t = W.tileAtPx(x, y + 80), d = (x - c.cx) ** 2 + (y - c.cy) ** 2;
          if ((t === T.DESERT || t === T.REDROCK) && d < bd) { bd = d; best = [r, i]; }
        }
        const [r, i] = best, [x, y] = r.pts[i];
        SC.go(x + 20, y + 60); TH.clearNpcs(); SC.ride();
        window.WG = new Wagon(r, Math.max(1, i - 4), 1, true); G.addEnt(WG);
      });
      await sleep(3500);
    },
  },
  {
    name: '07_train', title: 'Buharlı tren kırlarda',
    async run(p) {
      await p.evaluate(() => {
        SC.reset(); SC.weather('clear'); SC.time(10.5);
        window.TR = G.trains.find(t => t.spd > 20 && t.pos && t.pos.length) || G.trains.find(t => t.pos && t.pos.length);
        const [x, y] = TR.pos[2] || TR.pos[0]; SC.go(x, y + 80); TH.clearNpcs(); SC.ride();
      });
      for (let k = 0; k < 16; k++) { await sleep(200); await p.evaluate(() => { const [x, y] = TR.pos[2] || TR.pos[0]; const h = G.player.riding; if (h) { h.x = x - 10; h.y = y + 80; } G.player.x = x - 10; G.player.y = y + 80; }); }
    },
  },
  {
    name: '08_homestead', title: 'Kendi çiftlik evin: ahır, kuyu, bostan',
    async run(p) {
      await p.evaluate(() => {
        SC.reset(); SC.weather('clear'); SC.time(8.4);
        const tw = SC.town('harlow'); let best = null;
        for (let ty = 10; ty < WH - 30; ty += 4) for (let tx = 10; tx < WW - 30; tx += 4) {
          if (Math.abs(tx - tw.x) > 250 || Math.abs(ty - tw.y) > 250 || G.homeCheck(tx, ty)) continue;
          let grass = 0; for (let y = ty - 4; y < ty + HOME_FH + 4; y++) for (let x = tx - 6; x < tx + HOME_FW + 6; x++) grass += G.world.tile[y * WW + x] === T.GRASS;
          if (!best || grass > best[2]) best = [tx, ty, grass];
        }
        const P = G.player; P.money = 999; P.addItem('land_deed', 1, true); P.addItem('stakes', 1, true);
        SC.go((best[0] + 9) * TS, (best[1] + 9) * TS);
        G.homeStart(best[0], best[1], 'hs_house', true);
        const h = G.homes[G.homes.length - 1]; h.design = 0; h.work = h.need; G.homeProgress(h);
        for (const k of ['stable', 'well', 'garden']) G.homeAddon(h, k);
        for (const a of h.addons) a.work = a.need; G.homeProgress(h);
        const r = G.homeRect(h);
        SC.go((r.x + r.w / 2) * TS + 30, (r.y + r.h + 2.5) * TS); TH.clearNpcs();
        const hr = G.horse; hr.dead = false; hr.x = (h.tx + 3) * TS + 4; hr.y = (h.ty + 4) * TS + 10; hr.state = 'idle'; hr.spd = 0; hr.ang = Math.PI;
        window.HM = h;
      });
      await sleep(2500);
    },
  },
  {
    name: '09_hunters', title: 'Ödül avcıları seni sıkıştırdı',
    async run(p) {
      await p.evaluate(() => {
        SC.reset(); SC.zoom(4); SC.weather('clear'); SC.time(15.5);
        const c = SC.town('fortmercy'), s = SC.biome([T.DRY, T.GRASS], [c.cx + 1500, c.cy + 400], 4000, 4, 70);
        SC.go(s[0], s[1]); TH.clearNpcs();
        G.law.bounty = 180; G.law.hunterNext = G.clock - 1; G._huntChk = 0;
        const r = Math.random; Math.random = () => 0.001; G.hunterTick(0.016); Math.random = r;
        for (const e of G.posse.ents) { const a = Math.atan2(e.y - G.player.y, e.x - G.player.x); e.x = G.player.x + Math.cos(a) * 140; e.y = G.player.y + Math.sin(a) * 100; }
      });
      await p.waitForFunction(() => G.posse && G.posse.phase === 'standoff', null, { timeout: 30000 });
      await sleep(1000);
    },
    async after(p) { await p.evaluate(() => { if (G.posse) { for (const e of G.posse.ents) e.remove = true; G.posse = null; } G.law.bounty = 0; }); },
  },
  {
    name: '10_night', title: 'Fırtınalı gece, fener ve pencere ışıkları',
    async run(p) {
      await p.evaluate(() => {
        SC.reset(); SC.weather('storm', 1); SC.time(20.7);
        const t = SC.town('harlow'), b = G.world.buildings.find(x => x.town === t.id && x.type === 'saloon');
        SC.go(b.door.x + 10, b.door.y + 40);
        G.player.lantern = true;
      });
      await sleep(5000);
    },
    async after(p) { await p.evaluate(() => { G.player.lantern = false; }); },
  },
  {
    name: '11_poker', title: 'Saloonda beş kart poker',
    async run(p) {
      await p.evaluate(() => {
        SC.reset(); SC.zoom(4); SC.weather('clear'); SC.time(21);
        const t = SC.town('stclement'), s = G.world.buildings.find(b => b.town === t.id && b.type === 'saloon');
        TH.inside(s); G.player.y -= 30; G.townStaff(t); G.player.money = 24; G.achieved.gambler = true;
        Poker.speed = 30; UI.openPoker(s);
        const st = UI.top().poker; UI.top().pokerAct('deal');
        // oyuncunun eli: iki per (gerçek destedeki kartlarla değiştirilir)
        const want = [[1, 0], [1, 1], [12, 2], [12, 3], [7, 0]];
        st.seats[0].hand = want.map(([r, su]) => ({ r, s: su }));
      });
      for (let n = 0; n < 60; n++) {
        const s = await p.evaluate(() => { const st = UI.top().poker; return { ph: st.phase, turn: Poker.toAct(st) }; });
        if (s.ph === 'draw') break;
        if (s.turn === 0) await p.evaluate(() => UI.top().pokerAct('call'));
        await sleep(150);
      }
      await p.evaluate(() => { const st = UI.top().poker; if (st.phase === 'draw') { st.sel = new Set([4]); st.cursor = 4; } });
      await p.mouse.move(10, 10);
      await sleep(500);
    },
    async after(p) { await p.evaluate(() => UI.closeAll()); },
  },
  {
    name: '12_map', title: 'Parşömen harita',
    async run(p) {
      await p.evaluate(() => {
        SC.reset(); G.reveal.fill(1); G.rebuildFog(); for (const q of G.world.pois) G.discovered.add(q.id); for (const t of G.world.towns) G.visited.add(t.id);
        const t = SC.town('coyote'); SC.go(t.cx, t.cy + 30); UI.openMap();
      });
      await sleep(1500);
    },
    async after(p) { await p.evaluate(() => UI.closeAll()); await p.keyboard.press('Escape'); },
  },
  {
    name: '13_wheel', title: 'Silah çarkı',
    async run(p) {
      await p.evaluate(() => {
        SC.reset(); SC.weather('clear'); SC.time(13);
        const s = SC.biome([T.GRASS], [SC.town('coyote').cx + 900, SC.town('coyote').cy], 4000, 4, 20); SC.go(s[0], s[1]);
        const P = G.player; for (const w of ['knife', 'lasso', 'schofield', 'winchester', 'rifle', 'shotgun', 'bow']) P.giveWeapon(w, true); P.addItem('dynamite', 5, true); P.weapon = 'schofield';
      });
      await sleep(500);
      await p.mouse.move(1500, 470);
      await p.keyboard.down('Tab'); await sleep(300); await p.mouse.move(1520, 480); await sleep(700);
    },
    async after(p) { await p.keyboard.up('Tab'); },
  },
];

(async () => {
  const { chromium } = loadPlaywright();
  const srv = await serve();
  const url = `http://127.0.0.1:${srv.address().port}/`;
  const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, locale: opt.lang === 'tr' ? 'tr-TR' : 'en-US' });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => console.log('  sayfa hatası:', e.message));
  await p.addInitScript(() => { window.__testNoGuide = true; window.addEventListener('blur', (e) => { if (e.target === window) e.stopImmediatePropagation(); }, true); });
  await p.goto(url + 'index.html');
  await p.waitForFunction(() => typeof G !== 'undefined' && G.state === 'menu', null, { timeout: 30000 });
  fs.mkdirSync(OUT, { recursive: true });
  const list = SCENES.filter(s => !opt.only.length || opt.only.some(q => s.name.includes(q)));
  // ana menü ve karakter ekranı sahneleri oyun başlamadan
  for (const s of list.filter(s => s.pre)) { console.log('•', s.name); await s.run(p); await p.screenshot({ path: path.join(OUT, `${s.file || s.name}.png`) }); }
  await sleep(300);
  await p.keyboard.press('Enter'); await sleep(500);
  await p.evaluate(() => { for (let k = 0; k < 8 && document.querySelector('#cr-go'); k++) document.querySelector('#cr-go').click(); });
  await p.waitForFunction(() => G.state === 'play', null, { timeout: 150000 });
  await sleep(1500);
  await p.evaluate(pageHelpers); await p.evaluate(stageHelpers);
  if (opt.r3d) await p.evaluate(() => { G.settings.r3d = true; });
  await p.evaluate(() => { UI.toast = () => {}; for (const k of ['toasts', 'feed']) document.getElementById(k).innerHTML = ''; });
  for (const s of list.filter(s => !s.pre)) {
    console.log('•', s.name, '—', s.title);
    try {
      await s.run(p);
      await p.evaluate(() => { for (const k of ['toasts', 'feed']) document.getElementById(k).innerHTML = ''; });
      if (process.env.SHOT_DEBUG) console.log('  ', JSON.stringify(await p.evaluate(() => ({ grade: FX.g, hp: G.player.hp, max: G.player.maxHp, cold: G.coldness, hot: G.hotness }))));
      if (opt.both) {
        // aynı an iki çizimle: önce 2D, sonra 3D (oyun bu sırada durur)
        await p.evaluate(() => { G._upd = G.update; G.update = () => {}; G.settings.r3d = false; });
        await sleep(400);
        await p.screenshot({ path: path.join(OUT, `${s.file || s.name}_2d.png`) });
        await p.evaluate(() => { G.settings.r3d = true; });
        await sleep(2500);
        await p.screenshot({ path: path.join(OUT, `${s.file || s.name}_3d.png`) });
        await p.evaluate(() => { G.settings.r3d = false; G.update = G._upd; });
      } else await p.screenshot({ path: path.join(OUT, `${s.file || s.name}.png`) });
      if (s.after) await s.after(p);
    } catch (e) { console.log('  hata:', e.message.split('\n')[0]); }
  }
  await browser.close(); srv.close();
  console.log(`\n${list.length} sahne → ${path.relative(process.cwd(), OUT)}/`);
})().catch((e) => { console.error(e); process.exit(1); });
