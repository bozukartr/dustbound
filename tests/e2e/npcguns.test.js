'use strict';
/* NPC silahları: şarjör kapasitesi kadar atar, sonra doldurur (doldururken ateş etmez), yedek şarjörü bitince kaçar;
   görüş duvarı atlamaz; bina içindeki oyuncuyu dışarıdan göremeyen NPC ateş etmez, son gördüğü yere gider. */
module.exports = {
  name: 'NPC silahları ve görüş',
  async run(t) {
    const p = await t.newGame();
    await p.evaluate(() => {
      G.godMode = true;
      const s = TH.openSpot(); TH.goto(s[0], s[1]); TH.clearNpcs();
      if (G.horse) { G.horse.x = s[0] + 400; G.horse.y = s[1]; }
      // atış sayacı: NPC'nin fireRay çağrıları
      window.SHOTS = new Map();
      const fr = G.fireRay.bind(G);
      window.RELOAD_SHOTS = 0; window.BLIND_SHOTS = 0;
      G.fireRay = function (ox, oy, ang, range, dmg, owner, opts) {
        if (owner && owner.kind === 'npc') {
          SHOTS.set(owner, (SHOTS.get(owner) || 0) + 1);
          if (owner.reloadT > 0) RELOAD_SHOTS++;
          if (!G.los(owner.x, owner.y, G.player.x, G.player.y)) BLIND_SHOTS++;   // görmeden atış
        }
        return fr(ox, oy, ang, range, dmg, owner, opts);
      };
      window.wait = (ms) => new Promise(r => setTimeout(r, ms));
    });

    await t.step('haydut şarjörü (6) bitince doldurur, doldururken ateş etmez; dolunca yedek şarjör azalır', async () => {
      const r = await p.evaluate(async () => {
        TH.clearNpcs();
        const P = G.player, n = new NPC(P.x + 90, P.y, 'bandit', { hostile: true, weapon: 'cattleman' }); n.aggro = true; G.addEnt(n);
        const fast = setInterval(() => { if (!(n.reloadT > 0)) n.cool = Math.min(n.cool, 0); }, 30);
        let maxShots = 0, sawReload = false, shotsDuringReload = 0, spare0;
        for (let k = 0; k < 200 && !sawReload; k++) { await wait(30); if (spare0 === undefined && n.mag !== undefined) spare0 = n.spare; if (n.reloadT > 0) sawReload = true; }
        const atReload = SHOTS.get(n) || 0;
        RELOAD_SHOTS = 0;
        clearInterval(fast);
        while (n.reloadT > 0) { n.cool = 0; await wait(25); }
        shotsDuringReload = RELOAD_SHOTS;
        maxShots = atReload;
        // dolum biter bitmez ateş etmiş olabilir: şarjördeki ile atılanın toplamı 6
        const after = { mag: n.mag + ((SHOTS.get(n) || 0) - atReload - shotsDuringReload), spare: n.spare };
        n.remove = true;
        return { maxShots, sawReload, shotsDuringReload, spare0, after };
      });
      t.ok(r.sawReload, 'şarjör değiştirdi', r);
      t.eq(r.maxShots, 6, 'şarjör değiştirmeden önce 6 el ateş etti');
      t.ok(r.shotsDuringReload <= 0, 'doldururken ateş etmedi', r);
      t.ok(r.after.mag === 6 && r.after.spare === r.spare0 - 1, 'şarjör doldu, yedek azaldı', r);
    });

    await t.step('yedek şarjörü biten haydut son mermiden sonra ateş etmez, kaçar', async () => {
      const r = await p.evaluate(async () => {
        TH.clearNpcs();
        const P = G.player, n = new NPC(P.x + 90, P.y, 'bandit', { hostile: true, weapon: 'cattleman' }); n.aggro = true; G.addEnt(n);
        n.ammoInit(); n.mag = 2; n.spare = 0;
        const fast = setInterval(() => { n.cool = Math.min(n.cool, 0); }, 30);
        await wait(1200);
        const shots = SHOTS.get(n) || 0, d0 = dist(n.x, n.y, P.x, P.y);
        await wait(1500);
        clearInterval(fast);
        const out = { shots, later: SHOTS.get(n) || 0, dry: !!n.dry, d0, d1: dist(n.x, n.y, P.x, P.y) };
        n.remove = true;
        return out;
      });
      t.eq(r.shots, 2, 'kalan 2 mermiyi attı');
      t.eq(r.later, 2, 'mermisi bitince bir daha ateş etmedi');
      t.ok(r.dry && r.d1 > r.d0 + 20, 'mermisi bitti, uzaklaştı', r);
    });

    await t.step('görüş duvarı atlamaz: dışarıdan bina içine çizgi, kapıdan geçmiyorsa görmez', async () => {
      const r = await p.evaluate(() => {
        const W = G.world;
        let lines = 0, bad = 0;
        const blocks = (x1, y1, x2, y2) => {   // 1 px adımla gerçek duvar denetimi
          const d = dist(x1, y1, x2, y2);
          for (let k = 1; k < d; k++) {
            const x = lerp(x1, x2, k / d), y = lerp(y1, y2, k / d), i = (y >> 4) * WW + (x >> 4), sv = W.solid[i];
            if (sv >= 16 && W.isSolidPx(x, y)) return true;
            if (sv === 1 && (W.flags[i] & 8) && !isFurnO(W.obj[i])) return true;
            if (sv === 3 && !W.doorOpen(i)) return true;
          }
          return false;
        };
        const R = new RNG(99);
        for (const b of W.buildings.filter(q => q.enter).slice(0, 40)) {
          for (let k = 0; k < 12; k++) {
            const ix = (b.x + 1 + R.range(0, b.w - 2)) * TS, iy = (b.y + 1.5 + R.range(0, b.h - 2.5)) * TS;
            const side = R.int(0, 2);
            const ox = side === 0 ? (b.x - 2) * TS : side === 1 ? (b.x + b.w + 2) * TS : (b.x + R.range(0, b.w)) * TS;
            const oy = side === 2 ? (b.y + b.h + 2) * TS : (b.y + R.range(1, b.h)) * TS;
            if (W.indoorPx(ox, oy) || !W.indoorPx(ix, iy)) continue;
            lines++;
            if (G.los(ox, oy, ix, iy) && blocks(ox, oy, ix, iy)) bad++;
          }
        }
        return { lines, bad };
      });
      t.ok(r.lines > 100, 'yeterince çizgi denendi', r.lines);
      t.eq(r.bad, 0, 'duvarın ardını gören çizgi yok');
    });

    await t.step('bina içindeki oyuncuya dışarıdan ateş edilmez; NPC son gördüğü yere (kapının önüne) gider ve bekler', async () => {
      const r = await p.evaluate(async () => {
        TH.clearNpcs();
        const W = G.world, P = G.player;
        G.godMode = true;
        const b = W.buildings.find(q => q.enter && q.town && q.w >= 7 && q.h >= 6 && G.doorOpen(q) && !W.blocked(q.door.x + 70, q.door.y + 40, 6) && !W.indoorPx(q.door.x + 70, q.door.y + 40));
        // önce oyuncu kapının önünde, haydut onu görüyor
        P.x = b.door.x; P.y = b.door.y + 14;
        const n = new NPC(b.door.x + 70, b.door.y + 40, 'bandit', { hostile: true, weapon: 'cattleman' }); n.aggro = true; G.addEnt(n);
        await wait(500);
        // oyuncu içeri girer ve kapı kapanır: içerisi dışarıdan hiçbir yerden görünmez
        const fn = W.doorFn; W.doorFn = (q) => q === b ? false : fn(q);
        P.x = (b.x + 1.5) * TS; P.y = (b.y + 1.6) * TS;
        const inside = W.indoorPx(P.x, P.y), los = G.los(n.x, n.y, P.x, P.y);
        await wait(300);
        const shots0 = SHOTS.get(n) || 0;
        await wait(3000);
        const out = { inside, los, lkp: n.lkp && { x: n.lkp.x, y: n.lkp.y }, sees: n.sees, shots: (SHOTS.get(n) || 0) - shots0,
          toDoor: dist(n.x, n.y, b.door.x, b.door.y), player: { x: P.x, y: P.y } };
        W.doorFn = fn;
        n.remove = true;
        return out;
      });
      t.ok(r.inside && !r.los, 'oyuncu içeride, dışarıdan görünmüyor', r);
      t.ok(!r.sees, 'NPC oyuncuyu görmüyor', r);
      t.eq(r.shots, 0, 'içerideki oyuncuya ateş etmedi');
      t.ok(r.lkp && Math.hypot(r.lkp.x - r.player.x, r.lkp.y - r.player.y) > 30, 'oyuncunun içerideki yerini bilmiyor (son gördüğü yer kapının önü)', r);
      t.ok(r.toDoor < 70, 'kapının önüne gelip bekliyor', r.toDoor);
    });

    await t.step('kapı açıkken de NPC yalnızca görebildiğine ateş eder (bütün çatışmalarda görmeden atış yok)', async () => {
      const r = await p.evaluate(async () => {
        TH.clearNpcs();
        const W = G.world, P = G.player;
        const b = W.buildings.find(q => q.enter && q.town && q.w >= 7 && q.h >= 6 && G.doorOpen(q) && !W.blocked(q.door.x - 60, q.door.y + 50, 6) && !W.indoorPx(q.door.x - 60, q.door.y + 50));
        P.x = b.door.x; P.y = b.door.y + 14;
        const n = new NPC(b.door.x - 60, b.door.y + 50, 'bandit', { hostile: true, weapon: 'repeater' }); n.aggro = true; G.addEnt(n);
        const fast = setInterval(() => { n.cool = Math.min(n.cool, 0.05); }, 40);
        await wait(600);
        // içeri gir, odada gezin: kapı çizgisine girip çıkar
        for (let k = 0; k < 16; k++) { P.x = (b.x + 1.5 + (k % 4) * (b.w - 3) / 3) * TS; P.y = (b.y + 1.6 + ((k >> 2) % 3) * (b.h - 3) / 2) * TS; await wait(180); }
        clearInterval(fast);
        n.remove = true;
        return { total: SHOTS.get(n) || 0, blind: BLIND_SHOTS };
      });
      t.ok(r.total > 0, 'görebildiğinde ateş etti', r);
      t.eq(r.blind, 0, 'görmeden atılan mermi yok');
    });
  },
};
