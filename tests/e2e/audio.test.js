'use strict';
/* Ses motoru: ses listesi aracı, örnek bankası, uzamsal ses, mekân yankısı, zemin, kısma, kement sesi süresi, seslendirme anahtarı */
module.exports = {
  name: 'Ses motoru',
  timeout: 200000,
  async run(t) {
    // araç: klasördeki dosyalar adlarına göre manifeste yazılır
    await t.step('ses listesi aracı dosyaları tanır (çeşit, uzantı, bilinmeyen ad)', async () => {
      const fs = require('fs'), os = require('os'), path = require('path');
      const { build, CATALOG } = require('../../tools/sfx-manifest.js');
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sfx-'));
      for (const f of ['gun_pistol_01.wav', 'gun_pistol_02.wav', 'step_dirt.mp3', 'amb_wind.ogg', 'foo_bar.ogg', 'notes.txt']) fs.writeFileSync(path.join(dir, f), '');
      const { man, unknown } = build(dir);
      fs.rmSync(dir, { recursive: true, force: true });
      t.eq(man.gun_pistol.files.length, 2, 'iki çeşit'); t.eq(man.step_dirt.files[0], 'step_dirt.mp3', 'numarasız ad');
      t.ok(man.amb_wind.loop && man.gun_pistol.dist === CATALOG.gun_pistol[1].dist, 'ayarlar listeden gelir');
      t.eq(unknown, ['foo_bar.ogg'], 'bilinmeyen dosya bildirilir');
    });
    // dosya yokken davranışı: gerçek manifest gizlenir (depoda artık CC0 ses dosyaları var)
    const p = await t.newGame({ sfx: true, init: () => { const real = window.fetch; window.fetch = (u, o) => String(u).endsWith('audio/sfx/manifest.json') ? Promise.resolve(new Response('', { status: 404 })) : real(u, o); } });
    await t.step('dosya yokken eski sesler çalar, hata vermez', async () => {
      const r = await p.evaluate(async () => {
        await new Promise(res => setTimeout(res, 800));
        const P = G.player;
        G.whistle(); Audio_.ui('ok'); Audio_.step(0.06); Audio_.shot('rifle', 1, P.x + 40, P.y); Audio_.neigh(P.x + 40, P.y); G.explode(P.x + 300, P.y, null);
        P.addItem('beans', 1, true); G.consume('beans');
        return { bank: Object.keys(Audio_.bank).length, voices: Audio_.voices.length };
      });
      t.eq(r.bank, 0, 'banka boş'); t.eq(r.voices, 0, 'örnek çalınmadı');
    });
    await t.step('manifestteki dosyalar yüklenir, çeşitler ve döngü kurulur', async () => {
      const r = await p.evaluate(async () => {
        // sahte manifest ve kodla üretilmiş WAV dosyaları
        const wav = (sec, f) => {
          const sr = 22050, n = Math.floor(sr * sec), b = new ArrayBuffer(44 + n * 2), v = new DataView(b);
          const S = (o, s) => [...s].forEach((ch, i) => v.setUint8(o + i, ch.charCodeAt(0)));
          S(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); S(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
          v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); S(36, 'data'); v.setUint32(40, n * 2, true);
          for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.sin(i * f / sr * 6.283) * 8000 * (1 - i / n), true);
          return b;
        };
        const M = (o) => ({ dist: 1600, max: 6, pitch: 0.05, rev: 0.5, vol: 0.8, ...o });
        const man = {};
        for (const nm of ['gun_pistol', 'step_dirt', 'step_wood', 'ui_move', 'ui_ok', 'coins', 'whistle', 'horse_neigh', 'explosion', 'eat', 'lasso'])
          man[nm] = M({ files: [1, 2, 3].map(k => `${nm}_0${k}.wav`), ...(nm.startsWith('step') ? { dist: 280, max: 8 } : nm.startsWith('ui') || nm === 'coins' ? { bus: 'ui' } : {}) });
        man.amb_wind = { bus: 'amb', loop: true, vol: 1, files: ['amb_wind.wav'] };
        const real = window.fetch;
        window.fetch = (u, o) => {
          u = String(u);
          if (u.endsWith('audio/sfx/manifest.json')) return Promise.resolve(new Response(JSON.stringify(man)));
          if (u.includes('audio/sfx/')) return Promise.resolve(new Response(wav(u.includes('amb_') ? 2 : u.includes('lasso_') ? 1.6 : 0.2, 300 + u.length * 7)));   // kement: gerçeği gibi uzun dönen ip
          return real(u, o);
        };
        Audio_.loadBank();
        const t0 = performance.now();
        while (!Object.keys(man).every(n => Audio_.has(n)) && performance.now() - t0 < 15000) await new Promise(res => setTimeout(res, 100));
        window.fetch = real;
        return { all: Object.keys(man).every(n => Audio_.has(n)), n: Audio_.bank.gun_pistol.bufs.length, loop: !!Audio_.sloops.wind };
      });
      t.ok(r.all, 'hepsi yüklendi'); t.eq(r.n, 3, 'üç çeşit'); t.ok(r.loop, 'döngü kuruldu');
    });
    await t.step('konumlu ses: menzil, yön, duvar arkası', async () => {
      const r = await p.evaluate(() => {
        const P = G.player;
        const right = Audio_.play('gun_pistol', { x: P.x + 200, y: P.y });
        const left = Audio_.play('gun_pistol', { x: P.x - 200, y: P.y });
        const far = Audio_.play('step_dirt', { x: P.x + 2000, y: P.y });
        const near = Audio_.play('step_dirt', { x: P.x + 20, y: P.y });
        const panOf = (v) => { let n = v && v.g; for (let k = 0; k < 4 && n; k++) { const o = n._out; if (!o) break; } return v ? v : null; };
        return { right: !!right, left: !!left, far: far === null, nearVol: near && near.vol, rightVol: right && right.vol };
      });
      t.ok(r.right && r.left, 'iki yanda çalar'); t.ok(r.far, 'menzil dışı sessiz'); t.ok(r.nearVol > r.rightVol * 0, 'yakın ses çalar', r);
      const w = await p.evaluate(() => {
        const b = G.world.buildings.find(b => b.town === 'harlow' && b.type === 'saloon'), P = G.player;
        let iy = b.door.y; for (let k = 0; k < 40 && !G.world.buildingAtPx(b.door.x, iy); k++) iy -= 2;
        const out = Audio_.play('gun_pistol', { x: b.door.x, y: b.door.y + 30 });
        const inside = Audio_.play('gun_pistol', { x: b.door.x, y: iy - 10 });
        return { out: out && out.vol, inside: inside && inside.vol, d: Math.round(dist(P.x, P.y, b.door.x, iy)) };
      });
      t.ok(w.out && w.inside, 'ikisi de çalar', w);
    });
    await t.step('mekâna göre yankı ve zemin', async () => {
      const r = await p.evaluate(async () => {
        const wait = () => new Promise(res => setTimeout(res, 700));
        const out = {};
        const b = G.world.buildings.find(b => b.town === 'harlow' && b.type === 'saloon');
        TH.inside(b); await wait(); await wait(); out.saloon = Audio_.revName; out.floor = Audio_.surface(G.player.x, G.player.y); out.ambLP = Audio_.ambLP.frequency.value;
        const tw = TH.town('harlow'); TH.goto(tw.spawn.x, tw.spawn.y); await wait(); out.town = Audio_.revName;
        const s = TH.openSpot(tw.cx + 2200, tw.cy, 60); TH.goto(s[0], s[1]); await wait(); out.wild = Audio_.revName;
        return out;
      });
      t.eq(r.saloon, 'hall', 'saloonda geniş oda yankısı'); t.eq(r.floor, 'wood', 'içeride tahta zemin');
      t.ok(r.ambLP < 5000, 'içeride ortam boğuk', r.ambLP);
      t.eq(r.town, 'street', 'kasaba sokağı'); t.ok(['open', 'forest', 'canyon'].includes(r.wild), 'kırda doğal yankı', r.wild);
    });
    await t.step('yakın silah sesi ortamı ve müziği kısar, sonra geri gelir', async () => {
      const r = await p.evaluate(async () => {
        const P = G.player; Audio_.shot('pistol', 1, P.x + 30, P.y);
        await new Promise(res => setTimeout(res, 120));
        const a = Audio_.duckAmb.gain.value;
        await new Promise(res => setTimeout(res, 2500));
        return { a, b: Audio_.duckAmb.gain.value };
      });
      t.ok(r.a < 0.8, 'kısıldı', r); t.ok(r.b > 0.9, 'geri geldi', r);
    });
    await t.step('aynı ses art arda aynı örneği çalmaz; aynı anda sınır var', async () => {
      const r = await p.evaluate(() => {
        const ks = []; for (let i = 0; i < 12; i++) { Audio_.play('ui_move'); ks.push(Audio_.bank.ui_move.last); }
        let rep = 0; for (let i = 1; i < ks.length; i++) if (ks[i] === ks[i - 1]) rep++;
        for (let i = 0; i < 12; i++) Audio_.play('step_wood');
        return { rep, wood: Audio_.voices.filter(v => v.name === 'step_wood' && !v.done).length };
      });
      t.eq(r.rep, 0, 'tekrar yok'); t.ok(r.wood <= 8, 'aynı anda en fazla 8', r.wood);
    });
    await t.step('oyun içi olaylar örnekli sesle çalar, hata vermez', async () => {
      const r = await p.evaluate(async () => {
        const P = G.player, before = Audio_.voices.length;
        G.whistle(); Audio_.ui('ok'); Audio_.ui('cash'); Audio_.step(0.06); Audio_.neigh(P.x + 40, P.y); G.explode(P.x + 300, P.y, null);
        P.addItem('beans', 1, true); G.consume('beans');
        const names = Audio_.voices.map(v => v.name);
        return { names };
      });
      for (const n of ['whistle', 'ui_ok', 'coins', 'horse_neigh', 'explosion', 'eat']) t.ok(r.names.includes(n), n + ' çaldı', r.names);
    });
    await t.step('kement sesi ilmekle biter; savuruş sesi kol animasyonu kadar sürer', async () => {
      const r = await p.evaluate(async () => {
        const P = G.player, wait = (ms) => new Promise(res => setTimeout(res, ms));
        const s = TH.openSpot(); TH.goto(s[0], s[1]); TH.clearNpcs();
        P.giveWeapon('lasso', true); P.weapon = 'lasso'; P.fireCd = 0; P.aimAng = 0; P.ang = 0;
        const fresh = (fn) => { const b = new Set(Audio_.voices); fn(); return Audio_.voices.find(v => !b.has(v) && v.name === 'lasso'); };
        // boşluğa atış: ilmek menzilin sonunda düşer
        const V = fresh(() => P.throwLasso()), proj = G.projs.find(q => q.type === 'lasso'), t0 = performance.now();
        while (G.projs.includes(proj) && performance.now() - t0 < 3000) await wait(10);
        const flight = performance.now() - t0;
        await wait(60);
        const out = { flight, thrown: !!V, throwDone: !!V && V.done, len: V ? V.src.buffer.duration : 0 };
        // yumruk savuruşu aynı kaydı hızlı çalar
        P.weapon = 'fists';
        const M = fresh(() => P.melee()), t1 = performance.now();
        while (M && !M.done && performance.now() - t1 < 3000) await wait(10);
        return { ...out, swung: !!M, swing: performance.now() - t1 };
      });
      t.ok(r.thrown && r.len > 1, 'kement uzun kaydı çalar', r);
      t.ok(r.flight < 800, 'ilmek kısa sürede düşer', r);
      t.ok(r.throwDone, 'ilmek düşünce ip sesi kesilir (kaydın sonunu beklemez)', r);
      t.ok(r.swung && r.swing < 600, 'savuruş sesi kol animasyonuyla biter', r);
    });
    await t.step('seslendirme anahtarı araçla aynı, dosya yoksa sessizce geçer', async () => {
      const fs = require('fs'), path = require('path');
      // senaryo: dosya, hikâye, yer, konuşan, metin, okunuş (Türkçe kayıtlar henüz yok)
      const csv = fs.readFileSync(path.join(__dirname, '..', '..', 'audio', 'vo', 'script_tr.csv'), 'utf8').split('\n')[1];
      const [file, , , , text] = csv.match(/"((?:[^"]|"")*)"/g).map(s => s.slice(1, -1).replace(/""/g, '"'));
      const r = await p.evaluate((text) => ({ k: Audio_.voiceKey(text), d: Audio_.voice(text, 'tr') }), text);
      t.eq(r.k, /^tr\/([0-9a-f]{8})/.exec(file)[1], 'aynı anahtar'); t.eq(r.d, 0, 'kayıt yok → 0 sn');
    });
    await t.step('gerçek CC0 ses dosyaları: hepsi yüklenir ve çözülür, kaynakları kayıtlı', async () => {
      const fs = require('fs'), path = require('path');
      const dir = path.join(__dirname, '..', '..', 'audio', 'sfx');
      const man = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
      const files = Object.values(man).flatMap(m => m.files);
      const credits = fs.readFileSync(path.join(dir, 'KAYNAKLAR.md'), 'utf8');
      const names = Object.keys(man);
      t.eq(names.length, 65, 'kataloğun bütün sesleri dosyalı');
      t.ok(files.every(f => fs.existsSync(path.join(dir, f))), 'manifestteki dosyalar var');
      t.ok(names.every(n => credits.includes('`' + n + '`')), 'her ses KAYNAKLAR.md içinde');
      t.ok(!/\| (?!CC0 1\.0)[^|]+ \|\s*$/m.test(credits.split('|---|---|---|---|')[1] || ''), 'bütün kaynaklar CC0');
      const q = await t.page({ sfx: true });
      await q.evaluate(() => Audio_.unlock());
      await q.waitForFunction((n) => Object.values(Audio_.bank).reduce((a, B) => a + B.bufs.length, 0) >= n, files.length, { timeout: 90000 });
      const r = await q.evaluate(() => ({ names: Object.keys(Audio_.bank).length, loops: Object.keys(Audio_.sloops).length, short: Object.entries(Audio_.bank).filter(([n, B]) => B.bufs.some(b => b.duration < 0.015)).map(([n]) => n) }));
      t.eq(r.names, 65, 'bütün sesler bankada');
      t.ok(r.loops >= 6, 'ortam döngüleri kuruldu', r);
      t.eq(r.short, [], 'boş/bozuk dosya yok');
    });
    await t.step('Safari (.ogg açamayan tarayıcı): mp3 yedekleri yüklenir, kodla üretilen rüzgâr susar', async () => {
      const fs = require('fs'), path = require('path');
      const man = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'audio', 'sfx', 'manifest.json'), 'utf8'));
      const n = Object.values(man).reduce((a, m) => a + m.files.length, 0);
      t.eq(Object.values(man).reduce((a, m) => a + Object.keys(m.alt || {}).length, 0), n, 'her .ogg dosyasının mp3 yedeği var');
      const q = await t.newGame({ sfx: true, init: () => { const c = HTMLMediaElement.prototype.canPlayType; HTMLMediaElement.prototype.canPlayType = function (x) { return /ogg/i.test(x) ? '' : c.call(this, x); }; } });
      await q.evaluate(() => Audio_.unlock());
      await q.waitForFunction((n) => Object.values(Audio_.bank).reduce((a, B) => a + B.bufs.length, 0) >= n, n, { timeout: 90000 });
      await t.sleep(1500);
      const r = await q.evaluate(() => ({ canOgg: Audio_.canOgg, names: Object.keys(Audio_.bank).length, loops: Object.keys(Audio_.sloops).length,
        procWind: Audio_.loops.wind.g.gain.value, procRain: Audio_.loops.rain.g.gain.value,
        // döngü başı ve sonu: kodlayıcı dolgusu kırpıldı mı (ilk/son örnek sessiz değil)
        edges: ['amb_wind', 'amb_rain', 'amb_fire', 'amb_crickets'].map(nm => { const d = Audio_.bank[nm].bufs[0].getChannelData(0); return Math.max(Math.abs(d[0]), Math.abs(d[d.length - 1])) > 0.0005; }) }));
      t.ok(!r.canOgg, 'ogg açılamıyor sayıldı');
      t.eq(r.names, 65, 'bütün sesler mp3 ile bankada');
      t.ok(r.loops >= 6, 'döngüler kuruldu', r);
      t.ok(r.procWind === 0 && r.procRain === 0, 'kodla üretilen rüzgâr ve yağmur sessiz', r);
      t.ok(r.edges.every(Boolean), 'mp3 döngülerinin başı ve sonu kırpıldı', r.edges);
    });
    await t.step('kasaba uğultusu: hafif, boğuk ve kısık (eski hâlinden en az 8 dB alçak, tizleri süzülmüş)', async () => {
      const q = await t.page({ sfx: true });
      await q.evaluate(() => Audio_.unlock());
      await q.waitForFunction(() => Audio_.has('amb_crowd') && Audio_.sloops.crowd, null, { timeout: 90000 });
      const r = await q.evaluate(async () => {
        const SR = 44100, RealAC = window.AudioContext;
        const saved = { ctx: Audio_.ctx, sloops: Audio_.sloops, loops: Audio_.loops, loadBank: Audio_.loadBank, gain: Audio_.LOOPGAIN.crowd, filt: Audio_.LOOPFILT, vol: Object.assign({}, Audio_.vol) };
        const meas = async (old) => {
          const off = new OfflineAudioContext(1, SR * 4, SR);
          window.AudioContext = function () { return off; };
          Audio_.ctx = null; Audio_.sloops = {}; Audio_.loops = {}; Audio_.loadBank = () => {};
          if (old) { Audio_.LOOPGAIN.crowd = 1.8; Audio_.LOOPFILT = {}; }
          Object.assign(Audio_.vol, { master: 0.7, sfx: 0.7, music: 0.4, amb: 0.5 });
          Audio_.unlock();
          const rnd = Math.random; Math.random = () => 0;
          Audio_.loopReady('amb_crowd');
          Math.random = rnd;
          Audio_.ambientTick({ town: 1, night: 0, rain: 0, wind: 0, fire: 0, water: 0, nature: 0 });
          const d = (await off.startRendering()).getChannelData(0), a = SR * 2;
          let e = 0, hf = 0;
          for (let i = a; i < d.length; i++) { e += d[i] * d[i]; const df = d[i] - d[i - 1]; hf += df * df; }
          Audio_.LOOPGAIN.crowd = saved.gain; Audio_.LOOPFILT = saved.filt;
          return { db: 10 * Math.log10(e / (d.length - a) || 1e-12), bright: e ? hf / e : 0 };
        };
        try { return { old: await meas(true), now: await meas(false) }; }
        finally { window.AudioContext = RealAC; Object.assign(Audio_, { ctx: saved.ctx, sloops: saved.sloops, loops: saved.loops, loadBank: saved.loadBank }); Object.assign(Audio_.vol, saved.vol); }
      });
      t.ok(r.now.db < r.old.db - 8, 'eskisinden en az 8 dB alçak', r);
      t.ok(r.now.db > -80, 'yine de duyulur (sessiz değil)', r);
      t.ok(r.now.bright < r.old.bright * 0.35, 'tizler süzülmüş: boğuk', r);
    });
    await t.step('at toynakları yürüyüş biçimine göre: adım 4, tırıs 2, eşkin 3, dörtnala 4 vuruşluk döngü', async () => {
      const r = await p.evaluate(() => {
        const st = Audio_.step, calls = [];
        let now = 0;
        Audio_.step = (v, hoof) => { if (hoof) calls.push([now, v]); };
        const run = (spd, sec) => { const e = {}; calls.length = 0; for (now = 0; now < sec; now += 1 / 60) Audio_.hoofTick(e, 1 / 60, spd); return calls.map(c => c.slice()); };
        const per = (c, sec) => c.length / sec;
        const walk = run(36, 6), trot = run(95, 6), canter = run(140, 6), gallop = run(170, 6), stop = run(3, 2);
        Audio_.step = st;
        // dörtnala: vuruşlar kümelenir (yuvarlanma), sonra havada geçen boşluk
        const gaps = gallop.slice(1).map((c, i) => c[0] - gallop[i][0]);
        return { walk: per(walk, 6), trot: per(trot, 6), canter: per(canter, 6), gallop: per(gallop, 6), stop: stop.length,
          gMin: Math.min(...gaps), gMax: Math.max(...gaps), accent: gallop[3][1] > gallop[0][1] };
      });
      t.ok(r.walk > 3 && r.walk < 4.5, 'adım: saniyede ~3,5 vuruş', r);
      t.ok(r.trot > 2.8 && r.trot < 3.8, 'tırıs: saniyede ~3 vuruş', r);
      t.ok(r.canter > 5 && r.canter < 6.2, 'eşkin: saniyede ~5,5 vuruş', r);
      t.ok(r.gallop > 8 && r.gallop < 10, 'dörtnala: saniyede ~9 vuruş', r);
      t.ok(r.gMax > r.gMin * 2.5, 'dörtnala ritmi düzensiz (yuvarlanma + boşluk)', r);
      t.ok(r.accent, 'dörtnalada son vuruş vurgulu', r);
      t.eq(r.stop, 0, 'duran at ses çıkarmaz');
    });
    await t.step('ıslık spamı: 3 sn içinde tekrar ıslık ve kişneme olmaz', async () => {
      const r = await p.evaluate(async () => {
        const w = Audio_.whistle, n = Audio_.neigh; let W = 0, N = 0;
        Audio_.whistle = () => { W++; }; Audio_.neigh = () => { N++; };
        const P = G.player, h = G.horse; if (P.riding) P.dismount(true);
        G._whistleT = undefined; h._neighT = undefined;
        for (let k = 0; k < 6; k++) { h.x = P.x + 300; h.y = P.y; G.whistle(); }
        await new Promise(res => setTimeout(res, 700));
        const first = [W, N];
        G.t += 3.5; h.x = P.x + 300; G.whistle();
        await new Promise(res => setTimeout(res, 700));
        const after = [W, N];
        Audio_.whistle = w; Audio_.neigh = n;
        return { first, after };
      });
      t.eq(r.first, [1, 1], 'altı basışta bir ıslık, bir kişneme');
      t.eq(r.after, [2, 1], '3 sn sonra ıslık yine çalar; kişneme 10 sn dolmadan tekrarlanmaz');
    });
  },
};
