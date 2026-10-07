'use strict';
/* Yollar, raylar ve yapılar: çiftlik, mülk, kamp ve simgesel yerler yolun ve rayın üstüne kurulmaz;
   eski dünyalarda içinden yol/ray geçen yapının çevresinden hat dolaştırılır (nokta sayıları, binalar ve yerler
   değişmez, kayıtlar bozulmaz); dışarıdaki araba bina içindeki oyuncuyu engel saymaz. */

/* sayfa içinde: yapıların (kasaba dışı binalar ve çiftlik alanı) içinden geçen yol/ray parçaları */
function crossings(w, withSpurs) {
  const rects = [];
  for (const b of w.buildings) if (!b.town) rects.push({ n: b.name, r: [b.x * TS, b.y * TS, (b.x + b.w) * TS, (b.y + b.h) * TS] });
  for (const p of w.pois) if (p.kind === 'farm') rects.push({ n: p.n + ' (tarla)', r: [(p.tx - 10) * TS, (p.ty + 2) * TS, (p.tx + 12) * TS, (p.ty + 9) * TS] });
  const segs = [];
  for (const r of w.roads) if (withSpurs || !r.spur) segs.push({ k: r.spur ? 'patika' : 'yol', pts: r.pts });
  for (const l of w.lines) segs.push({ k: 'ray', pts: l.pts });
  const out = [];
  for (const { n, r } of rects) for (const s of segs) {
    let hit = false;
    for (let i = 0; i < s.pts.length - 1 && !hit; i++) {
      const [ax, ay] = s.pts[i], [bx, by] = s.pts[i + 1], m = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / 3));
      for (let k = 0; k <= m; k++) { const x = ax + (bx - ax) * k / m, y = ay + (by - ay) * k / m; if (x > r[0] && x < r[2] && y > r[1] && y < r[3]) { hit = true; break; } }
    }
    if (hit) out.push(s.k + ' → ' + n);
  }
  return out;
}

module.exports = {
  name: 'Yollar, raylar ve yapılar',
  async run(t) {
    const p = await t.page({});
    await p.evaluate(crossings.toString().replace(/^function crossings/, 'window.__cross = function'));
    // dünyayı sayfada üret (oyun başlamadan, menüde)
    await p.evaluate(() => {
      window.__gen = async (seed, wgen, size, pass = true) => {
        setWorldSize(size); WGEN = wgen;
        const keep = World.prototype.routeAroundBuildings;
        if (!pass) World.prototype.routeAroundBuildings = function () {};
        try { const w = new World(seed); await w.generate(null); return w; } finally { World.prototype.routeAroundBuildings = keep; }
      };
    });

    await t.step('yeni dünyalarda çiftlik, mülk, kamp ve simgesel yerler yolun ve rayın üstüne kurulmaz', async () => {
      const r = await p.evaluate(async () => {
        const out = [];
        for (const seed of [11, 22, 33]) {
          const w = await __gen(seed, WGEN_NEW, WORLD_NEW);
          out.push({ seed, x: __cross(w, true), farms: w.pois.filter(q => q.kind === 'farm').length });
        }
        return out;
      });
      for (const s of r) t.eq(s.x.length, 0, `tohum ${s.seed}: içinden yol/ray/patika geçen yapı yok`, s.x);
      t.ok(r.every(s => s.farms >= 10), 'bütün çiftlikler kuruldu', r.map(s => s.farms));
    });

    await t.step('eski dünyalar: hat yapının çevresinden dolaşır; binalar, yerler ve nokta sayıları aynı kalır', async () => {
      const r = await p.evaluate(async () => {
        const out = [];
        for (const seed of [1, 2]) {
          const a = await __gen(seed, 2, WORLD_NEW, false), b = await __gen(seed, 2, WORLD_NEW, true);
          const same = {
            buildings: a.buildings.length === b.buildings.length && a.buildings.every((q, i) => { const o = b.buildings[i]; return o.id === q.id && o.type === q.type && o.x === q.x && o.y === q.y && o.w === q.w && o.h === q.h; }),
            pois: a.pois.length === b.pois.length && a.pois.every((q, i) => b.pois[i].pid === q.pid && b.pois[i].tx === q.tx && b.pois[i].ty === q.ty),
            roads: a.roads.length === b.roads.length && a.roads.every((q, i) => b.roads[i].pts.length === q.pts.length && !!b.roads[i].spur === !!q.spur),
            lines: a.lines.length === b.lines.length && a.lines.every((q, i) => b.lines[i].pts.length === q.pts.length && b.lines[i].stops.every((s, k) => s.i === q.stops[k].i)),
          };
          // istasyon mesafeleri yeni hatta göre yeniden hesaplandı, sıralı
          const mono = b.lines.every(l => l.stops.every((s, k) => k === 0 || s.d > l.stops[k - 1].d) && Math.abs(l.len - l.cum[l.cum.length - 1]) < 1e-6);
          out.push({ seed, before: __cross(a, false), after: __cross(b, false), same, mono });
        }
        return out;
      });
      for (const s of r) {
        t.ok(s.before.length > 0, `tohum ${s.seed}: düzeltmesiz dünyada yapının içinden geçen hat vardı`, s.before);
        t.eq(s.after.length, 0, `tohum ${s.seed}: düzeltmeyle hiçbiri kalmadı`, s.after);
        t.ok(s.same.buildings && s.same.pois && s.same.roads && s.same.lines, `tohum ${s.seed}: binalar, yerler, yol ve ray nokta sayıları aynı (kayıtlar bozulmaz)`, s.same);
        t.ok(s.mono, `tohum ${s.seed}: istasyon mesafeleri tutarlı`);
      }
    });

    const g = await t.newGame();
    await t.step('yeni hayatta hiçbir çiftliğin ya da yapının içinden yol veya ray geçmez', async () => {
      await g.evaluate(crossings.toString().replace(/^function crossings/, 'window.__cross = function'));
      const r = await g.evaluate(() => ({ wgen: WGEN, newGen: WGEN_NEW, all: __cross(G.world, true) }));
      t.eq(r.wgen, r.newGen, 'yeni hayat yeni kurallarla');
      t.eq(r.all.length, 0, 'hiçbir yapının içinden hat geçmiyor', r.all);
    });

    await t.step('dışarıdaki araba bina içindeki oyuncuyu engel saymaz, dışarıdakini sayar', async () => {
      const r = await g.evaluate(() => {
        const W = G.world, P = G.player;
        TH.clearNpcs();
        const b = W.buildings.find(q => q.enter && q.town && q.w >= 7 && q.h >= 6 && !W.indoorPx(q.door.x, q.door.y + 30));
        // oyuncu binanın içinde, kapıya yakın; araba kapının dışında, yüzü binaya dönük
        P.x = b.door.x; P.y = b.door.y - 24;
        const wg = new Wagon(null, 0, 1, false, { x: b.door.x, y: b.door.y + 4, ang: -Math.PI / 2 });
        G.addEnt(wg);
        const inside = { indoor: W.indoorPx(P.x, P.y), wagonOut: !W.indoorPx(wg.x, wg.y), o: wg.scanAhead().o === P };
        // aynı dizilim açık arazide: oyuncu engel sayılır
        const s = TH.openSpot();
        P.x = s[0]; P.y = s[1] - 24; wg.x = s[0]; wg.y = s[1] + 4; wg.trail(true);
        const out = { o: wg.scanAhead().o === P };
        wg.remove = true;
        return { inside, out };
      });
      t.ok(r.inside.indoor && r.inside.wagonOut, 'oyuncu içeride, araba dışarıda', r.inside);
      t.ok(!r.inside.o, 'duvarın ardındaki oyuncu engel sayılmadı', r.inside);
      t.ok(r.out.o, 'açık arazide önündeki oyuncu engel', r.out);
    });
  },
};
