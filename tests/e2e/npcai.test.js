'use strict';
/* NPC yapay zekâsı. Aşama 0: kasaba dışında yol bulma (WildPath) — kayaların, uçurumların etrafından dolanma, ulaşılamayan
   hedefte en yakın noktaya gitme, dünya değişince saklanan karoların yenilenmesi, maliyet; hata ayıklama görünümü. */
module.exports = {
  name: 'NPC yapay zekâsı: kasaba dışında yol bulma',
  async run(t) {
    const p = await t.newGame();
    await p.evaluate(() => {
      UI.closeAll(); UI.el.help.classList.add('hidden'); G.eventT = 1e9; G.travelT = 1e9; G.hunterTick = () => {};
      G.clock = Math.floor(G.clock / 1440) * 1440 + 12 * 60;
      /* dünyada rastgele örnekleyerek kenarı 2*half px olan, engelsiz, susuz, kasabasız kare bir alanın ortası. Her çağrı
         başka bir tohumla başka bir yer verir (önceki adımın kayaları, suyu orada kalır) */
      window.OPEN = (half = 210) => {
        OPEN.n = (OPEN.n || 0) + 1;
        const W = G.world, R = new RNG(7 + OPEN.n * 101), n = Math.ceil(half / 16);
        for (let k = 0; k < 600; k++) {
          // karo merkezine hizalı; kaya, harabe duvarı, bina, uçurum, su ve iç mekân olmayan bir kare
          const tx = Math.floor(R.range(2000, WW * TS - 2000) / TS), ty = Math.floor(R.range(2000, WH * TS - 2000) / TS), cx = tx * TS + 8, cy = ty * TS + 8;
          if (W.townAt(cx, cy, 80)) continue;
          let ok = true;
          for (let dy = -n; dy <= n && ok; dy++) for (let dx = -n; dx <= n && ok; dx++) {
            const i = (ty + dy) * WW + tx + dx, o = W.obj[i], x = cx + dx * 16, y = cy + dy * 16;
            if ((W.flags[i] & 8) || o === O.BOULDER || o === O.RUINWALL || isCliffT(W.tile[i]) || W.isWaterPx(x, y) || W.indoorPx(x, y)) ok = false;
          }
          if (!ok) continue;
          // küçük nesneler (çalı, taş, ağaç) temizlenir: görüş ve rota testi belirlenimli olsun
          for (let dy = -n; dy <= n; dy++) for (let dx = -n; dx <= n; dx++) if (W.obj[(ty + dy) * WW + tx + dx]) W.setObj(tx + dx, ty + dy, 0);
          W.refreshArea(tx - n - 1, ty - n - 1, tx + n + 1, ty + n + 1);
          for (let dy = -n; dy <= n && ok; dy++) for (let dx = -n; dx <= n && ok; dx++) if (W.blocked(cx + dx * 16, cy + dy * 16, 5)) ok = false;
          if (ok) return [cx, cy];
        }
        return null;
      };
      /* geniş açık bir yerde, oyuncunun 6 karo doğusuna 17 karoluk kaya duvarı (iki ucu açık); oyuncu duvarın batısında */
      window.WALL = () => {
        const W = G.world; TH.clearNpcs();
        const s = OPEN(), sx = s[0] >> 4, sy = s[1] >> 4;
        for (let ty = sy - 8; ty <= sy + 8; ty++) W.setObj(sx + 6, ty, O.BOULDER);
        W.refreshArea(sx + 4, sy - 10, sx + 8, sy + 10);
        TH.goto(sx * 16 + 8, sy * 16 + 8); G.godMode = true;
        return { sx, sy, east: [(sx + 12) * 16 + 8, sy * 16 + 8] };
      };
      window.WAIT = (ms) => new Promise(res => setTimeout(res, ms));
    });

    await t.step('yaya haydut kaya duvarının ucundan dolanıp oyuncuyu görür', async () => {
      const r = await p.evaluate(async () => {
        const w = WALL(), P = G.player;
        const b = new NPC(w.east[0], w.east[1], 'bandit', { hostile: true, home: { x: w.east[0], y: w.east[1], r: 10 } }); b.aggro = true; b.say = () => {}; G.addEnt(b);
        const los0 = G.los(b.x, b.y, P.x, P.y);
        let first = -1, minX = Infinity;
        for (let i = 0; i < 40; i++) { await WAIT(250); P.hp = P.maxHp; minX = Math.min(minX, b.x - P.x); if (G.los(b.x, b.y, P.x, P.y)) { first = (i + 1) * 0.25; break; } }
        const out = { los0, first, partial: !!(b.nav && b.nav.partial), dead: b.dead };
        b.remove = true; return out;
      });
      t.ok(!r.los0, 'başta duvar görüşü kesiyor', r);
      t.ok(r.first > 0 && r.first <= 6, 'en geç 6 saniyede duvarın ucundan dolanıp görür', r);
    });

    await t.step('atlı haydut da duvarın etrafından dolanır', async () => {
      const r = await p.evaluate(async () => {
        const w = WALL(), P = G.player;
        const b = new NPC(w.east[0], w.east[1], 'bandit', { hostile: true, mounted: true, home: { x: w.east[0], y: w.east[1], r: 10 } }); b.aggro = true; b.say = () => {}; G.addEnt(b);
        let first = -1;
        for (let i = 0; i < 48; i++) { await WAIT(250); P.hp = P.maxHp; if (G.los(b.x, b.y, P.x, P.y)) { first = (i + 1) * 0.25; break; } }
        const out = { first, mounted: !!b.mounted };
        b.remove = true; return out;
      });
      t.ok(r.mounted, 'atlı kaldı', r);
      t.ok(r.first > 0 && r.first <= 9, 'en geç 9 saniyede dolanır', r);
    });

    await t.step('tutuklamaya gelen kanun adamı duvarın etrafından yanına gelir', async () => {
      const r = await p.evaluate(async () => {
        const w = WALL(), P = G.player, L = G.law;
        G.godMode = true;
        const n = new NPC(w.east[0], w.east[1], 'law', { hostile: true, weapon: 'cattleman' }); n.say = () => {}; G.addEnt(n);
        L.level = 1; L.resist = false; L.lastX = P.x; L.lastY = P.y; L.unseen = 0; L.spawnT = 1e9; L.bounty = Math.max(L.bounty, 5);
        let near = -1, minD = Infinity;
        for (let i = 0; i < 48; i++) { await WAIT(250); P.hp = P.maxHp; L.unseen = 0; L.fleeT = 0; L.arrestT = 0; const d = dist(n.x, n.y, P.x, P.y); minD = Math.min(minD, d); if (d < 100) { near = (i + 1) * 0.25; break; } }
        const out = { near, minD: Math.round(minD), canArrest: G.canArrest() };
        L.level = 0; L.bounty = 0; n.remove = true; return out;
      });
      t.ok(r.canArrest, 'tutuklama koşulu', r);
      t.ok(r.near > 0 && r.near <= 12, 'en geç 12 saniyede 100 px yakınına gelir (teslim olunabilecek mesafe)', r);
    });

    await t.step('ulaşılamayan hedef (adadaki oyuncu): rota suyun kıyısında biter', async () => {
      const r = await p.evaluate(() => {
        const W = G.world; TH.clearNpcs();
        const s = OPEN(), sx = s[0] >> 4, sy = s[1] >> 4;
        // oyuncunun çevresine 3 karo kalınlığında su halkası (iç yarıçap 4 karo)
        for (let dy = -8; dy <= 8; dy++) for (let dx = -8; dx <= 8; dx++) { const d = Math.hypot(dx, dy); if (d >= 4 && d < 7) { const i = (sy + dy) * WW + sx + dx; W.tile[i] = T.WATER; W.obj[i] = 0; } }
        W.refreshArea(sx - 9, sy - 9, sx + 9, sy + 9);
        const px = sx * 16 + 8, py = sy * 16 + 8, ax = px + 200, ay = py;
        const R = WildPath.find(ax, ay, px, py, 4.2);
        const end = R && R[R.length - 1], dEnd = end ? Math.round(dist(end[0], end[1], px, py)) : -1;
        const wet = R ? R.some(q => W.isWaterPx(q[0], q[1])) : true;
        return { ok: !!R, partial: !!(R && R.partial), dEnd, wet };
      });
      t.ok(r.ok && r.partial, 'kısmi rota döner', r);
      t.ok(r.dEnd >= 96 && r.dEnd <= 140, 'rota suyun dış kıyısında biter (hedefe en yakın kuru yer)', r);
      t.ok(!r.wet, 'rota suya girmez', r);
    });

    await t.step('dünya değişince saklanan karolar yenilenir; düz yol açıksa arama yapılmaz', async () => {
      const r = await p.evaluate(() => {
        const W = G.world; TH.clearNpcs();
        const s = OPEN(), sx = s[0] >> 4, sy = s[1] >> 4, ax = sx * 16 + 8, ay = sy * 16 + 8, bx = ax + 160, by = ay;
        const R1 = WildPath.find(ax, ay, bx, by, 4.2), v1 = W.pathVer;
        for (let ty = sy - 6; ty <= sy + 6; ty++) W.setObj(sx + 5, ty, O.BOULDER);
        W.refreshArea(sx + 3, sy - 8, sx + 7, sy + 8);
        const R2 = WildPath.find(ax, ay, bx, by, 4.2);
        const crosses = R2 && TownPath.walkable([ax, ay], R2[0], 4.6) && R2.every((q, i) => i === 0 || TownPath.walkable(R2[i - 1], q, 4.6));
        return { straight: R1 && R1.length === 1, ver: W.pathVer > v1, detour: R2 && R2.length > 1, walkable: !!crosses };
      });
      t.ok(r.straight, 'düz yol açıkken tek nokta', r);
      t.ok(r.ver, 'çarpışma değişince sürüm artar', r);
      t.ok(r.detour && r.walkable, 'yeni kayalar rotaya girer; rotanın bütün parçaları yürünebilir', r);
    });

    await t.step('maliyet: ilk arama ve önbellekten arama; kare bütçesine yazılır', async () => {
      const r = await p.evaluate(() => {
        const w = WALL(), P = G.player, ax = w.east[0], ay = w.east[1];
        WildPath.chunks[0].clear(); WildPath.cache.clear();
        TownPath.spentF = -1; TownPath.spent = 0;
        let t0 = performance.now(); const R1 = WildPath.find(ax, ay, P.x, P.y, 4.2); const cold = performance.now() - t0;
        const spent = TownPath.spent;
        WildPath.cache.clear();
        t0 = performance.now(); const R2 = WildPath.find(ax, ay, P.x, P.y, 4.2); const warm = performance.now() - t0;
        t0 = performance.now(); for (let k = 0; k < 20; k++) WildPath.find(ax, ay, P.x, P.y, 4.2); const cached = (performance.now() - t0) / 20;
        return { cold: +cold.toFixed(2), warm: +warm.toFixed(2), cached: +cached.toFixed(3), spent: +spent.toFixed(2), len: R1 && R1.length, same: JSON.stringify(R1) === JSON.stringify(R2) };
      });
      t.ok(r.len > 1 && r.same, 'aynı rota', r);
      t.ok(r.spent > 0, 'harcanan süre kare bütçesine yazılır', r);
      t.ok(r.cold < 40 && r.warm < 8 && r.cached < 2, 'ilk arama < 40 ms, saklı karolarla < 8 ms, saklı rota < 2 ms', r);
    });

    await t.step('hata ayıklama: çatışma ve yol bulma görünümü hatasız çizer', async () => {
      const r = await p.evaluate(async () => {
        const w = WALL(), P = G.player;
        const b = new NPC(w.east[0], w.east[1], 'bandit', { hostile: true, home: { x: w.east[0], y: w.east[1], r: 10 } }); b.aggro = true; b.say = () => {}; G.addEnt(b);
        Debug.opt.ovCombat = true;
        await WAIT(1200);
        const on = !!(Debug.ov && Debug.ov._on), route = !!(b.nav && b.nav.route);
        Debug.opt.ovCombat = false; b.remove = true; G.godMode = false;
        return { on, route };
      });
      t.ok(r.on, 'katman çizildi', r);
    });
  },
};
