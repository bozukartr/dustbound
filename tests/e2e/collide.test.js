'use strict';
/* Çarpışma ve sıkışma:
   - Ahırın önünde satın alınan ya da getirtilen otomobil, yük arabası, at ve özel fayton gövdesinin tamamı boş bir yerde
     durur (lamba, elektrik direği, çit, bağlama direği, başka araç yok) ve sürülüp çıkılabilir; yıllar geçip kasabaya
     elektrik gelince de. Yolculuk sonrası at ve binicisinden ayrılan at da boş bir yerde durur.
   - Islıkla çağrılan at önündeki engelin (duvar, bina) etrafından dolaşıp gelir; oyuncu bir binanın içindeyse kapının
     yanında bekler.
   - Park etmiş araba, at ve oyuncunun altına sonradan bir direk ya da fıçı gelirse en yakın boş yere alınırlar. */
module.exports = {
  name: 'Çarpışma ve sıkışma',
  timeout: 300000,
  async run(t) {
    const p = await t.newGame();
    // bütün ahırların önündeki yerler, istasyon ve postanelerin önünde yolculuk sonrası atın yeri
    const spots = () => p.evaluate(() => {
      const W = G.world, bad = [];
      const drive = (x, y, ang, car) => {
        const w = car ? Wagon.ownedCar(x, y, ang) : Wagon.owned(x, y, ang);
        let best = 0;
        for (const dir of [1, -1]) { const ox = w.x, oy = w.y; for (let s = 0; s < 15; s++) w.move(Math.cos(ang) * 2 * dir, Math.sin(ang) * 2 * dir); best = Math.max(best, dist(ox, oy, w.x, w.y)); w.x = ox; w.y = oy; w._slide = 0; }
        return best;
      };
      let n = 0;
      for (const b of W.buildings) {
        if (!b.door) continue;
        if (b.type === 'stable') {
          n++;
          const c = G.vehSpot(b, true, -1), wg = G.vehSpot(b, false, 1), h = G.horseSpot(b), cb = G.curbSpot(b);
          const r = { town: b.town, car: G.vehFree(c.x, c.y, c.ang, true) && drive(c.x, c.y, c.ang, true) >= 20, wagon: G.vehFree(wg.x, wg.y, wg.ang, false) && drive(wg.x, wg.y, wg.ang, false) >= 20,
            coach: G.vehFree(cb.x, cb.y, cb.ang || 0, false), horse: G.horseFree(h.x, h.y, h.ang) };
          if (!r.car || !r.wagon || !r.coach || !r.horse) bad.push(r);
        }
        if (b.type === 'station' || b.type === 'post') {
          const o = {};
          G.horseBeside(o, b.door.x, b.door.y + 12);
          if (!G.horseFree(o.x, o.y, o.ang)) bad.push({ town: b.town, type: b.type, beside: false });
        }
      }
      return { year: G.year, n, bad };
    });
    await t.step('ahırın önünde araç, at ve fayton yeri boş ve sürülebilir; yolculuk sonrası at boş yerde', async () => {
      const r = await spots();
      t.ok(r.n >= 8, 'ahırlar bulundu', r.n);
      t.eq(r.bad, [], 'hepsi boş');
    });
    await t.step('25 yıl sonra (elektrik direkleri ve lambalar dikilince) de aynı yerler boş', async () => {
      await p.evaluate(() => { G.advanceClock(25 * G.dpy * 1440); G.devFlush(true); });
      const r = await spots();
      t.ok(r.year >= 1914, 'yıllar geçti', r.year);
      t.eq(r.bad, [], 'hepsi boş');
    });
    await t.step('binicisinden ayrılan at duvarın içine düşmez', async () => {
      const r = await p.evaluate(() => {
        const W = G.world, out = [];
        // binanın batı duvarının hemen dibindeki binici: eski sabit yer (+6 px) duvarın içindeydi
        for (const b of W.buildings.slice(0, 60)) {
          const x = b.x * TS - 7, y = (b.y + 1) * TS + 8;
          if (W.blocked(x, y, 4) || W.indoorPx(x, y)) continue;
          const f = G.horseDrop(x, y, 0);
          out.push(G.horseFree(f[0], f[1], 0) || (f[0] === x && f[1] === y));
        }
        return { n: out.length, ok: out.filter(Boolean).length };
      });
      t.ok(r.n > 10 && r.ok === r.n, 'at boş bir yerde', r);
    });

    await t.step('çağrılan at araya konan duvarın etrafından dolaşıp gelir (kır)', async () => {
      const r = await p.evaluate(async () => {
        const W = G.world, P = G.player, sp = TH.openSpot(P.x, P.y, 150);
        TH.goto(sp[0], sp[1] + 80);
        const h = G.horse; h.x = sp[0]; h.y = sp[1] - 90; h.ang = Math.PI / 2; h.state = 'idle'; h.spd = 0;
        // 15 karoluk yatay duvar oyuncuyla atın arasında: dümdüz yürüyen at duvara dayanıp kalırdı
        const ty = ((sp[1] - 8) >> 4), tx0 = (sp[0] >> 4) - 7, walls = [];
        for (let x = tx0; x <= tx0 + 14; x++) { const i = ty * WW + x; walls.push([i, W.solid[i]]); W.solid[i] = 1; }
        W.pathVer++;
        G._whistleT = -99; G.whistle();
        const t0 = performance.now();
        while (performance.now() - t0 < 25000 && h.state === 'come') await new Promise(r => setTimeout(r, 100));
        const out = { d: Math.round(dist(h.x, h.y, P.x, P.y)), state: h.state, secs: +((performance.now() - t0) / 1000).toFixed(1) };
        for (const [i, v] of walls) W.solid[i] = v;
        W.pathVer++;
        return out;
      });
      t.ok(r.d < 40 && r.state === 'idle', 'at oyuncuya geldi', r);
    });
    await t.step('çağrılan at binanın arkasından dolaşıp gelir (kasaba)', async () => {
      const r = await p.evaluate(async () => {
        const W = G.world, P = G.player, h = G.horse;
        let pick = null;
        for (const tw of W.towns) {
          if (tw.ghost) continue;
          for (const b of tw.buildings) {
            if (!b.door || b.w < 5) continue;
            const bx = b.door.x, by = b.y * TS - 26;
            if (G.horseFree(bx, by, -Math.PI / 2) && !W.blocked(bx, b.door.y + 18, 5)) { pick = { b, bx, by }; break; }
          }
          if (pick) break;
        }
        if (!pick) return { skip: true };
        TH.goto(pick.b.door.x, pick.b.door.y + 18);
        h.x = pick.bx; h.y = pick.by; h.ang = Math.PI / 2; h.state = 'idle'; h.spd = 0;
        G._whistleT = -99; G.whistle();
        const t0 = performance.now();
        while (performance.now() - t0 < 25000 && h.state === 'come') await new Promise(r => setTimeout(r, 100));
        return { d: Math.round(dist(h.x, h.y, P.x, P.y)), state: h.state, secs: +((performance.now() - t0) / 1000).toFixed(1), type: pick.b.type };
      });
      t.ok(!r.skip, 'arkası açık bir bina bulundu', r);
      t.ok(r.d < 40 && r.state === 'idle', 'at oyuncuya geldi', r);
    });
    await t.step('oyuncu binanın içindeyken çağrılan at kapının yanına gelip bekler', async () => {
      const r = await p.evaluate(async () => {
        const W = G.world, h = G.horse;
        const b = W.buildings.find(b => b.type === 'saloon' && b.door);
        TH.inside(b);
        const sp = TH.openSpot(b.door.x, b.door.y, 60) || [b.door.x + 300, b.door.y + 200];
        h.x = sp[0]; h.y = sp[1]; h.state = 'idle'; h.spd = 0;
        G._whistleT = -99; G.whistle();
        const t0 = performance.now();
        while (performance.now() - t0 < 30000 && h.state === 'come') await new Promise(r => setTimeout(r, 100));
        return { state: h.state, toDoor: Math.round(dist(h.x, h.y, b.door.x, b.door.y)), indoor: W.indoorPx(h.x, h.y), free: G.horseFree(h.x, h.y, h.ang, h) };
      });
      t.ok(r.state === 'idle' && r.toDoor < 70 && !r.indoor && r.free, 'at kapının yanında bekliyor', r);
    });

    await t.step('park etmiş arabanın, atın ve oyuncunun altına direk ya da fıçı gelince en yakın boş yere alınırlar', async () => {
      const r = await p.evaluate(async () => {
        const W = G.world, P = G.player;
        const b = W.buildings.find(x => x.type === 'stable' && x.town === (W.townAt(P.x, P.y, 20) || W.towns[0]).id) || W.buildings.find(x => x.type === 'stable');
        TH.goto(b.door.x, b.door.y + 14);
        P.money = 99999;
        G.buyCar(b);
        const car = G.myCar, h = G.horse;
        h.x = b.door.x + 60; h.y = b.door.y + 60; h.state = 'idle';
        const put = (x, y, o) => { const tx = x >> 4, ty = y >> 4; W.obj[ty * WW + tx] = o; W.refreshArea(tx, ty, tx, ty); return [tx * TS + 8, ty * TS + TRUNK_DY]; };
        // elektrik direği arabanın ön noktasına ve atın gövdesine (ince gövde: yuvarlak çarpışır), fıçı oyuncunun yerine
        const pc = put(car.x, car.y, O.UPOLE); car.x = pc[0]; car.y = pc[1] + 1; car.bx = undefined; car.trail(true);
        const ph = put(h.x, h.y, O.UPOLE); h.x = ph[0]; h.y = ph[1] + 1;
        TH.goto(P.x + 40, P.y + 30); put(P.x, P.y, O.BARREL);
        const before = { car: W.blocked(car.x, car.y, car.r), horse: W.blocked(h.x, h.y, h.r), player: W.blocked(P.x, P.y, P.r) };
        await new Promise(r => setTimeout(r, 2600));
        const after = { car: W.blocked(car.x, car.y, car.r), carFree: G.vehFree(car.x, car.y, car.ang, true, car), horse: W.blocked(h.x, h.y, h.r), player: W.blocked(P.x, P.y, P.r) };
        return { before, after };
      });
      t.ok(r.before.car && r.before.horse && r.before.player, 'üçü de gömülüydü', r.before);
      t.ok(!r.after.car && r.after.carFree && !r.after.horse && !r.after.player, 'üçü de boş yerde', r.after);
    });
  },
};
