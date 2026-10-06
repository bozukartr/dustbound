'use strict';
/* Demiryolu güvenliği: trenle kimse üst üste geçmez, herkes yaklaşan trenden kaçınır.
   - raydaki yaya ve hayvan kenara çekilir, sağ kalır; rayı geçmek üzere olan yaya tren geçene kadar bekler
   - at arabası geçitten önce durur, tren geçince karşıya geçer
   - rayda duran araba görünce tren fren yapıp önünde durur, yol açılınca devam eder
   - duran trenin vagonları katıdır: kimse içinden geçemez
   - yoldaki hayvan arabadan ürküp kenara kaçar, araba onu ezmez */
module.exports = {
  name: 'Demiryolu güvenliği',
  timeout: 300000,
  async run(t) {
    const p = await t.newGame();
    // sahne: bir treni durakları uzak, iki yanı açık bir hat kesimine koy; hattın 200 px ilerisi olay yeri
    const setup = (k = 0) => p.evaluate((k) => {
      UI.closeAll(); G.godMode = true;
      const W = G.world, clear = (x, y) => !W.blocked(x, y, 6) && !W.indoorPx(x, y) && ![T.WATER, T.DEEP].includes(W.tileAtPx(x, y));
      for (const tr of G.trains) {
        const L = tr.line;
        for (let s = 400 + k * 250; s < L.len - 600; s += 40) {
          if (L.stops.some(st => Math.abs(st.d - s) < 500)) continue;
          const [x, y, a] = tr.at(s + 220), nx = -Math.sin(a), ny = Math.cos(a);
          let ok = true;
          for (let o = -90; o <= 90 && ok; o += 10) for (let f = -40; f <= 40 && ok; f += 20) ok = clear(x + nx * o + Math.cos(a) * f, y + ny * o + Math.sin(a) * f);
          if (!ok || W.townAt(x, y, 4)) continue;
          // sahnedeki eski varlıkları temizle (yalnızca bu sahnenin çevresi)
          for (const e of G.ents) if (e.kind !== 'horse' && dist(e.x, e.y, x, y) < 400) e.remove = true;
          G.ents = G.ents.filter(e => !e.remove);
          for (const o of G.trains) if (o !== tr) { o.wait = 9999; o.spd = 0; }
          tr.s = s; tr.dir = 1; tr.wait = 0; tr.spd = 70;
          TH.goto(x + nx * 120, y + ny * 120);
          G.horse.x = G.player.x + 30; G.horse.y = G.player.y;
          window.__R = { tr, x, y, a, nx, ny, s };
          return { ok: true, x: Math.round(x), y: Math.round(y) };
        }
      }
      return { ok: false };
    }, k);
    // her karede trenin gövdesine (vagon ekseninden 9 px) giren varlıkları say
    const hook = `window.inBody = (e, r) => G.trains.some(tr => tr.pos.some(([x, y]) => dist2(x, y, e.x, e.y) < (r + 9) * (r + 9)));`;

    await t.step('raydaki yaya ve geyik yaklaşan trenden kenara çekilir, sağ kalır', async () => {
      const s = await setup(0);
      t.ok(s.ok, 'sahne kuruldu', s);
      const r = await p.evaluate((hook) => {
        eval(hook);
        const R = window.__R;
        const n = G.addEnt(new NPC(R.x, R.y, 'traveler', { name: 'Raydaki Adam' }));
        const d = G.addEnt(new Animal(R.x + Math.cos(R.a) * 30, R.y + Math.sin(R.a) * 30, 'deer'));
        d.state = 'idle'; d.t = 99;
        let overlapN = 0, overlapD = 0, minEta = 99;
        for (let f = 0; f < 30 * 8; f++) {
          G.update(1 / 30);
          if (!n.dead && inBody(n, n.r)) overlapN++;
          if (!d.dead && inBody(d, d.r)) overlapD++;
        }
        const off = (e) => Math.abs((e.x - R.x) * R.nx + (e.y - R.y) * R.ny);
        return { npcDead: n.dead, deerDead: d.dead, overlapN, overlapD, npcOff: Math.round(off(n)), deerOff: Math.round(off(d)), passed: R.tr.s > R.s + 220 + 6 * R.tr.gap };
      }, hook);
      t.ok(r.passed, 'tren olay yerinden geçti', r);
      t.ok(!r.npcDead && !r.deerDead, 'yaya ve geyik sağ', r);
      t.eq([r.overlapN, r.overlapD], [0, 0], 'kimse trenin gövdesiyle üst üste gelmedi');
    });

    await t.step('rayı geçmek üzere olan yaya tren geçene kadar bekler, sonra yoluna devam eder', async () => {
      const s = await setup(1);
      t.ok(s.ok, 'sahne kuruldu', s);
      const r = await p.evaluate((hook) => {
        eval(hook);
        const R = window.__R;
        // yaya rayın 40 px yanında, raya dik yürüyor; yolu rayın öbür yanına
        const n = G.addEnt(new NPC(R.x + R.nx * 40, R.y + R.ny * 40, 'traveler', { name: 'Yolcu' }));
        n.path = [[R.x - R.nx * 70, R.y - R.ny * 70]]; n.pi = 0; n.ang = Math.atan2(-R.ny, -R.nx);
        let overlap = 0, waited = 0, crossed = false;
        for (let f = 0; f < 30 * 14; f++) {
          G.update(1 / 30);
          if (n.dead) break;
          if (inBody(n, n.r)) overlap++;
          if (n.railT > 0 && n.mv === 0) waited++;
          const side = (n.x - R.x) * R.nx + (n.y - R.y) * R.ny;
          if (side < -20 || n.remove) { crossed = true; break; }
        }
        return { dead: n.dead, overlap, waited: Math.round(waited / 30 * 10) / 10, crossed };
      }, hook);
      t.ok(!r.dead && r.overlap === 0, 'yaya trenle üst üste gelmedi', r);
      t.ok(r.waited > 0.5, 'rayın kenarında bekledi', r);
      t.ok(r.crossed, 'tren geçince karşıya geçti', r);
    });

    await t.step('at arabası geçitten önce durur, tren geçince karşıya geçer', async () => {
      const s = await setup(2);
      t.ok(s.ok, 'sahne kuruldu', s);
      const r = await p.evaluate(() => {
        const R = window.__R;
        const w = G.addEnt(new Wagon(null, 0, 1, false, { x: R.x + R.nx * 70, y: R.y + R.ny * 70, ang: Math.atan2(-R.ny, -R.nx) }));
        w.path = [[w.x, w.y], [R.x - R.nx * 140, R.y - R.ny * 140]]; w.pi = 0; w.dir = 1;
        let overlap = 0, minD = 99, stoppedNear = 0, crossed = false;
        for (let f = 0; f < 30 * 18; f++) {
          G.update(1 / 30);
          for (const tr of G.trains) for (const [cx, cy, cr] of w.circles()) for (const [tx, ty] of tr.circles || []) if (dist2(cx, cy, tx, ty) < (cr + 6) * (cr + 6)) overlap++;
          const side = (w.x - R.x) * R.nx + (w.y - R.y) * R.ny;
          if (R.tr.s < R.s + 220 + 6 * R.tr.gap && w.spd < 1 && side > 0) { stoppedNear++; minD = Math.min(minD, side); }
          if ((w.bx - R.x) * R.nx + (w.by - R.y) * R.ny < -25) { crossed = true; break; }
        }
        return { overlap, stopped: Math.round(stoppedNear / 30 * 10) / 10, minD: Math.round(minD), crossed, trainSpd: Math.round(R.tr.spd) };
      });
      t.eq(r.overlap, 0, 'araba trenle üst üste gelmedi');
      t.ok(r.stopped > 0.5 && r.minD > 15, 'geçitten önce, rayın kenarında durdu', r);
      t.ok(r.crossed, 'tren geçince karşıya geçti', r);
    });

    await t.step('rayda duran araba: tren düdük çalıp önünde durur, araba çekilince devam eder', async () => {
      const s = await setup(0);
      t.ok(s.ok, 'sahne kuruldu', s);
      const r = await p.evaluate(() => {
        const R = window.__R;
        // sürücüsüz araba rayın üstünde, raya dik duruyor
        const w = G.addEnt(Wagon.owned(R.x, R.y, R.a + Math.PI / 2));
        let overlap = 0, minGap = 1e9;
        // yoldan gelen başka arabalar bu sahneyi bozmasın
        const solo = () => { for (const o of G.ents) if (o.kind === 'wagon' && o !== w) o.remove = true; };
        for (let f = 0; f < 30 * 10; f++) {
          solo(); G.update(1 / 30);
          for (const [cx, cy, cr] of w.circles()) for (const [tx, ty] of R.tr.circles || []) { const g = Math.hypot(cx - tx, cy - ty) - cr - 6; if (g < 0) overlap++; minGap = Math.min(minGap, g); }
        }
        const stopped = R.tr.spd < 1;
        // araba çekilir: tren yeniden hızlanır
        w.remove = true;
        for (let f = 0; f < 30 * 6; f++) { solo(); G.update(1 / 30); }
        return { overlap, minGap: Math.round(minGap), stopped, after: Math.round(R.tr.spd) };
      });
      t.eq(r.overlap, 0, 'tren arabaya çarpmadı');
      t.ok(r.stopped && r.minGap >= 0, 'tren arabanın önünde durdu', r);
      t.ok(r.after > 20, 'yol açılınca tren devam etti', r);
    });

    await t.step('duran trenin vagonları katıdır: oyuncu ve hayvan içinden geçemez', async () => {
      const r = await p.evaluate(() => {
        const R = window.__R, tr = R.tr;
        tr.wait = 9999; tr.spd = 0;
        for (let f = 0; f < 3; f++) G.update(1 / 30);
        const [cx, cy, a] = tr.pos[2], nx = -Math.sin(a), ny = Math.cos(a);
        const d = G.addEnt(new Animal(cx + nx * 22, cy + ny * 22, 'deer'));
        let into = 0;
        for (let f = 0; f < 60; f++) { d.ang = Math.atan2(-ny, -nx); d.move(-nx * 2, -ny * 2); if (G.trainBlock(d.x, d.y, d.r - 0.5)) into++; }
        const P = G.player; P.x = cx + nx * 22; P.y = cy + ny * 22;
        let pin = 0;
        for (let f = 0; f < 60; f++) { P.move(-nx * 2, -ny * 2); if (G.trainBlock(P.x, P.y, P.r - 0.5)) pin++; }
        const near = Math.hypot(d.x - cx, d.y - cy), pnear = Math.hypot(P.x - cx, P.y - cy);
        tr.wait = 1;
        return { into, pin, near: Math.round(near), pnear: Math.round(pnear) };
      });
      t.eq([r.into, r.pin], [0, 0], 'vagonun içine girilmedi');
      t.ok(r.near < 40 && r.pnear < 40, 'vagona dayanıp kaldılar (ya da yanından kaydılar)', r);
    });

    await t.step('yoldaki hayvan arabadan ürküp kenara kaçar, araba onu ezmez', async () => {
      const s = await setup(1);
      t.ok(s.ok, 'sahne kuruldu', s);
      const r = await p.evaluate(() => {
        const R = window.__R;
        R.tr.wait = 9999; R.tr.spd = 0;   // tren bu sahnede yok sayılır
        // araba rayla paralel, 60 px yanında; önünde bir geyik
        const ox = R.x + R.nx * 60, oy = R.y + R.ny * 60, fa = R.a;
        const w = G.addEnt(new Wagon(null, 0, 1, false, { x: ox - Math.cos(fa) * 60, y: oy - Math.sin(fa) * 60, ang: fa }));
        w.path = [[w.x, w.y], [ox + Math.cos(fa) * 200, oy + Math.sin(fa) * 200]]; w.pi = 0; w.dir = 1;
        const d = G.addEnt(new Animal(ox, oy, 'deer'));
        d.state = 'idle'; d.t = 99; G.player.x = R.x - R.nx * 150; G.player.y = R.y - R.ny * 150;
        let overlap = 0, fled = false;
        for (let f = 0; f < 30 * 8; f++) {
          G.update(1 / 30);
          for (const [cx, cy, cr] of w.circles()) if (Math.hypot(cx - d.x, cy - d.y) < cr + d.r - 1) overlap++;
          if (d.state === 'flee') fled = true;
        }
        R.tr.wait = 1;
        return { overlap, fled, dead: d.dead, moved: Math.round(Math.hypot(w.x - (ox - Math.cos(fa) * 60), w.y - (oy - Math.sin(fa) * 60))) };
      });
      t.ok(r.fled && !r.dead, 'geyik ürküp kaçtı', r);
      t.eq(r.overlap, 0, 'araba geyiğin üstünden geçmedi');
      t.ok(r.moved > 60, 'araba yoluna devam etti', r);
    });
  },
};
