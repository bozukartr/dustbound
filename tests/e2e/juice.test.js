'use strict';
/* His efektleri: isabet duraklaması, savrulma ve uçan şapka, dinamit izi, dörtnala uzaklaşma,
   şahlanma, boşta animasyon, gece sönen pencereler, yuvarlanan para sayacı, kardaki silik ayak izleri */
module.exports = {
  name: 'His efektleri (juice)',
  async run(t) {
    const p = await t.newGame();
    const setup = () => p.evaluate(() => {
      UI.closeAll(); const tw = TH.town('harlow'), s = TH.openSpot(tw.cx + 1400, tw.cy + 300, 120);
      TH.goto(s[0], s[1]); TH.clearNpcs(); G.godMode = true; G.clock = Math.floor(G.clock / 1440) * 1440 + 12 * 60;
      const P = G.player; P.hp = P.maxHp; if (P.riding) { P.dismount(); P.mountAnim = null; }
    });
    await t.step('öldürücü vuruşta duraklama, ceset savrulur, şapka uçar', async () => {
      await setup();
      const r = await p.evaluate(() => {
        const P = G.player, n = new NPC(P.x + 40, P.y, 'traveler', {}); G.addEnt(n);
        n.look = Object.assign({}, n.look, { hat: 'cowboy', hatCol: '#5a3a20' }); n.hp = 1; n.state = 'static';
        window.JN = n; window.JX = n.x; Juice.hats.length = 0;
        G.fireRay(P.x, P.y, 0, 300, 50, P, { weapon: 'cattleman' });
        return { dead: n.dead, hs: G.hitStopT, kb: !!n.kb, hats: Juice.hats.length, hat: n.look.hat };
      });
      t.ok(r.dead, 'ölmeli'); t.ok(r.hs > 0.03, 'mikro duraklama', r.hs); t.ok(r.kb, 'savrulma başlamalı');
      t.eq(r.hats, 1, 'şapka uçmalı'); t.eq(r.hat, 'none', 'şapka başından düşmeli');
      await p.waitForFunction(() => Juice.hats[0] && Juice.hats[0].z === 0 && !JN.kb, null, { timeout: 4000 }).catch(() => {});
      const s = await p.evaluate(() => ({ hs: G.hitStopT, dx: JN.x - JX, kb: !!JN.kb, z: Juice.hats[0].z, hx: Juice.hats[0].x - JX }));
      t.ok(s.hs <= 0, 'duraklama biter'); t.ok(s.dx > 3, 'ceset vuruş yönünde kaymalı', s.dx); t.ok(!s.kb, 'kayma durur');
      t.eq(s.z, 0, 'şapka yere düşer'); t.ok(s.hx > 0, 'şapka ileri uçar', s.hx);
    });
    await t.step('dinamit yanık izi, şok dalgası ve kamera tepmesi bırakır', async () => {
      await setup();
      const r = await p.evaluate(() => {
        const P = G.player; Juice.decals.length = 0; G.fx.kx = 0;
        G.explode(P.x + 120, P.y + 10, null);
        return { dec: Juice.decals.length, bl: Juice.blasts.length, kx: G.fx.kx, sway: Juice.swayPush(P.x + 150, P.y + 10) };
      });
      t.eq(r.dec, 1, 'yanık izi'); t.eq(r.bl, 1, 'şok dalgası'); t.ok(r.kx < -0.5, 'kamera patlamadan uzağa tepmeli', r.kx);
      await t.sleep(300);
      t.ok(await p.evaluate(() => Math.abs(Juice.swayPush(G.player.x + 150, G.player.y + 10)) > 0), 'bitkiler dışarı eğilmeli');
    });
    await t.step('dörtnala giderken kamera uzaklaşır, durunca geri gelir', async () => {
      await setup();
      await p.evaluate(() => { const P = G.player, h = G.horse; h.x = P.x; h.y = P.y; h.ang = 0; h.state = 'idle'; h.dead = false; h.sta = h.maxSta; P.mount(h, true); P.ang = 0; });
      await p.keyboard.down('ShiftLeft'); await p.keyboard.down('KeyD');
      await t.sleep(2600);
      const g = await p.evaluate(() => ({ sz: G.camZoom.sz, spd: G.player.riding.spd, tf: G.canvas.style.transform }));
      await p.keyboard.up('KeyD'); await p.keyboard.up('ShiftLeft');
      t.ok(g.spd > 130, 'dörtnal', g.spd); t.ok(g.sz < 0.96, 'kamera uzaklaşmalı', g); t.ok(/scale\(0\.9/.test(g.tf), 'tuval küçülmeli', g.tf);
      await t.sleep(2500);
      const s = await p.evaluate(() => ({ sz: G.camZoom.sz, tf: G.canvas.style.transform }));
      t.ok(s.sz > 0.995, 'durunca geri yakınlaşır', s); t.eq(s.tf, '', 'dönüşüm kalkar');
    });
    await t.step('şahlanan at bir süre dinlemez, sonra toparlanır', async () => {
      const r = await p.evaluate(() => { const h = G.player.riding; h.rearT = 0; Juice.rear(h); return { t: h.rearT }; });
      t.ok(r.t > 0.5, 'şahlanma başlar');
      await p.keyboard.down('KeyD'); await t.sleep(350);
      const m = await p.evaluate(() => { const h = G.player.riding; return { spd: h.spd, k: Juice.rearK(h) }; });
      t.eq(m.spd, 0, 'şahlanırken ilerlemez'); t.ok(m.k > 0.3, 'ön taraf havada', m.k);
      await t.sleep(1200);
      const e = await p.evaluate(() => ({ rt: G.player.riding.rearT, spd: G.player.riding.spd }));
      await p.keyboard.up('KeyD');
      t.eq(e.rt, 0, 'şahlanma biter'); t.ok(e.spd > 10, 'yeniden yürür', e.spd);
      await p.evaluate(() => { G.player.dismount(); G.player.mountAnim = null; });
    });
    await t.step('boşta duran oyuncu etrafa bakar ya da şapkasını düzeltir', async () => {
      await setup();
      const r = await p.evaluate(async () => {
        const P = G.player; P.fireCd = -5; P._idle = { t: 0, next: 0.05, act: null, a: 0, base: 0 };
        let seen = 0;
        for (let k = 0; k < 20; k++) { await new Promise(res => setTimeout(res, 50)); if (Math.abs(P.idleA || 0) > 0.05 || (P.hatK || 0) > 0.05) seen++; }
        return seen;
      });
      t.ok(r > 0, 'boşta animasyon oynamalı', r);
    });
    await t.step('gece ilerledikçe ev pencereleri söner, saloon açık kalır', async () => {
      const r = await p.evaluate(() => {
        const W = G.world, day = Math.floor(G.clock / 1440) * 1440, count = (h) => {
          G.clock = day + h * 60;
          let house = 0, lit = 0, sal = 0, salLit = 0;
          for (const L of W.lights) {
            if (L.type !== 'window') continue;
            const b = W.buildings[L.b]; if (!b) continue;
            if (b.type === 'saloon') { sal++; if (Juice.windowLit(L)) salLit++; } else if (b.type === 'house') { house++; if (Juice.windowLit(L)) lit++; }
          }
          return { house, lit, sal, salLit };
        };
        return { eve: count(20), late: count(23.4), deep: count(3) };
      });
      t.ok(r.eve.house > 5 && r.eve.lit === r.eve.house, 'akşam hepsi yanar', r.eve);
      t.ok(r.late.lit > 0 && r.late.lit < r.late.house, 'gece yarısına doğru bir kısmı söner', r.late);
      t.eq(r.deep.lit, 0, 'gece yarısından sonra evler karanlık');
      t.ok(r.deep.sal > 0 && r.deep.salLit === r.deep.sal, 'saloon açık kalır', r.deep);
    });
    await t.step('para sayacı yeni değere yuvarlanarak ulaşır', async () => {
      await setup();
      await p.evaluate(() => { G.player.money = 10; });
      await t.sleep(600);
      const r = await p.evaluate(async () => {
        G.player.money = 60;
        const el = document.getElementById('hud-money'), seen = [];
        for (let k = 0; k < 8; k++) { await new Promise(res => setTimeout(res, 60)); seen.push([el.textContent, el.classList.contains('gain')]); }
        await new Promise(res => setTimeout(res, 1500));
        return { seen, end: el.textContent, gain: el.classList.contains('gain') };
      });
      const mid = r.seen.filter(([s]) => s !== '$10.00' && s !== '$60.00');
      t.ok(mid.length >= 2, 'ara değerler görünmeli', r.seen); t.ok(r.seen.some(([, g]) => g), 'artışta yeşil parlar');
      t.eq(r.end, '$60.00', 'sonunda gerçek değer'); t.ok(!r.gain, 'parlama söner');
    });
    await t.step('karda yöne dönük, silik ayak izi kalır; yağan kar izleri doldurur', async () => {
      const found = await p.evaluate(() => {
        // yürüyüş şeridi (3x10 karo) baştan sona açık kar olan bir yer
        UI.closeAll(); const W = G.world; let best = null;
        const clean = (tx, ty) => { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 8; dx++) { const i = (ty + dy) * WW + tx + dx; if (W.tile[i] !== T.SNOW || W.obj[i] || W.flags[i]) return false; } return true; };
        for (let ty = 12; ty < WH - 12 && !best; ty += 2) for (let tx = 12; tx < WW - 20 && !best; tx += 2) if (clean(tx, ty) && !W.townAt(tx * TS, ty * TS, 12)) best = [tx * TS + 8, ty * TS + 8];
        if (!best) return false;
        TH.goto(best[0], best[1]); TH.clearNpcs();
        G.clock = Math.floor(G.clock / 1440) * 1440 + 12 * 60; G.weather = { type: 'clear', t: 99999, i: 0, cloud: 0, fogI: 0 };
        G.envCache = G.localWeather(G.player.x, G.player.y);
        FX.tracks.length = 0; FX.snowTracks.length = 0;
        return true;
      });
      t.ok(found, 'açık karlı bir şerit bulundu');
      await t.sleep(300);
      await p.keyboard.down('KeyD'); await t.sleep(1500); await p.keyboard.up('KeyD');
      const r = await p.evaluate(() => {
        const L = FX.snowTracks, line = (a, ds) => {
          // izin dolu pikselleri: yatay yürüyüşte tek satır, dikeyde tek sütun
          const c = FX.printSpr('foot', a, ds).c, d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data, xs = new Set(), ys = new Set();
          for (let i = 3; i < d.length; i += 4) if (d[i] > 200) { xs.add((i >> 2) % c.width); ys.add(Math.floor((i >> 2) / c.width)); }
          return [xs.size, ys.size];
        };
        const out = { n: L.length, kinds: [...new Set(L.map(q => q.kind))], plain: FX.tracks.length, right: L.every(q => Math.abs(Math.cos(q.a)) > 0.9), h1: line(0, 1), v1: line(Math.PI / 2, 1), h2: line(0, 2) };
        // aynı kare izsiz ve izli çizilir; iz merkezindeki pikselin kararması ölçülür
        for (const q of L) q.life = 60;
        const ds = G.ds || 1, cw = G.canvas.width, snap = ds === 1 ? Math.floor : Math.round, px = (q) => [snap(q.x * ds) - G.cam.ox * ds, snap(q.y * ds) - G.cam.oy * ds];
        const keep = L.splice(0); G.render(0); const a = G.ctx.getImageData(0, 0, cw, G.canvas.height).data;
        L.push(...keep); G.render(0); const b = G.ctx.getImageData(0, 0, cw, G.canvas.height).data;
        const diffs = [];
        for (const q of L) { const [x, y] = px(q); if (x < 0 || y < 0 || x >= cw || y >= G.canvas.height) continue; const i = (y * cw + x) * 4; diffs.push((a[i] + a[i + 1] + a[i + 2] - b[i] - b[i + 1] - b[i + 2]) / 3); }
        diffs.sort((u, v) => u - v); out.dark = diffs[diffs.length >> 1]; out.nd = diffs.length;
        // kar yağarken izler hızla dolar
        const q = L[L.length - 1]; out.l0 = q.life; out.t0 = G.t; G.envCache.snow = 1;
        return out;
      });
      t.ok(r.n >= 3, 'karda yürüyünce iz kalır', r.n);
      t.eq(r.kinds, ['foot'], 'yaya izi çizme izidir');
      t.eq(r.plain, 0, 'kar izi düz iz listesine düşmez');
      t.ok(r.right, 'izler yürüyüş yönüne döner (sağa)', r);
      t.ok(r.h1[1] === 1 && r.h1[0] >= 2, 'klasikte yatay iz tek piksel enli çizgi', r.h1);
      t.ok(r.v1[0] === 1 && r.v1[1] >= 2, 'klasikte dikey iz tek piksel enli çizgi', r.v1);
      t.ok(r.h2[0] >= 4 && r.h2[1] === 2, 'melezde iz iki kat ince ayrıntılı (iki piksel en)', r.h2);
      t.ok(r.nd >= 3 && r.dark > 4 && r.dark < 45, 'iz görünür ama silik (karda hafif kararma)', r);
      await t.sleep(700);
      const f = await p.evaluate(({ l0, t0 }) => { const q = FX.snowTracks[FX.snowTracks.length - 1]; return { dl: l0 - q.life, dt: G.t - t0 }; }, r);
      t.ok(f.dt > 0.1 && f.dl > f.dt * 2.5, 'yağan kar izi birkaç kat hızlı doldurur', f);
    });
  },
};
