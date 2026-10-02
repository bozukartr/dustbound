'use strict';
/* Kasaba hayatı, at arabaları, hayvanlar ve su, göçebeler, mevsimler */
module.exports = {
  name: 'Kasaba hayatı ve dünya sistemleri',
  timeout: 300000,
  async run(t) {
    const p = await t.newGame();
    await p.evaluate(() => { G.godMode = true; });
    await t.step('kasaba sakinleri, dükkân sahibi ve fikre göre fiyat', async () => {
      const r = await p.evaluate(() => {
        const tw = TH.town('harlow'); TH.goto(tw.spawn.x, tw.spawn.y); G.spawnTick();
        const R = G.residents(tw), b = tw.buildings.find(x => x.type === 'general'), kr = G.keeperOf(b);
        G.insideB = b; const base = G.priceMul(true); G.mem(kr).op = 100; const love = G.priceMul(true); G.mem(kr).op = -100; const hate = G.priceMul(true); G.mem(kr).op = 0; G.insideB = null;
        return { res: R.length, keeper: !!kr, base, love, hate };
      });
      t.ok(r.res >= 30, 'orta kasabada kalıcı sakinler', r.res); t.ok(r.keeper, 'genel mağazanın sahibi olmalı');
      t.ok(r.love < r.base && r.hate > r.base, 'seven indirim, nefret eden zam yapar', r);
    });
    await t.step('ölen sakinin yerine günler sonra biri gelir', async () => {
      const r = await p.evaluate(() => {
        const tw = TH.town('harlow'), e = G.ents.find(x => x.res && !x.staffOf && !x.dead && !x.remove);
        if (!e) return { err: 'sakin yok' };
        const id = e.res.id; e.hurt(999, 'npc'); G.townTick(tw);
        const dead = G.resMem[id] && G.resMem[id].dead !== undefined;
        G.clock += 3 * 1440 + 60; tw._res = null;
        return { dead, repl: !!G.residents(tw).find(x => x.id === id + 'n') };
      });
      t.ok(!r.err, r.err); t.ok(r.dead, 'ölüm hafızaya yazılmalı'); t.ok(r.repl, 'yerine yeni sakin gelmeli');
    });
    await t.step('at arabası: sürücü kementle indirilir, araba sürülür, yükü aranır', async () => {
      const r = await p.evaluate(async () => {
        const P = G.player, road = G.world.roads.find(x => !x.spur && x.pts.length > 60), i = 30;
        TH.goto(road.pts[i][0] + 30, road.pts[i][1] + 30);
        const w = new Wagon(road, i, 1, false); G.addEnt(w);
        G.lassoHit(w.throwDriver()); const drv = P.rope; P.rope = null; drv.recover();
        await new Promise(res => setTimeout(res, 1500));
        const stopped = w.spd < 2;
        G.driveWagon(w); const riding = P.riding === w;
        window.W0 = w; window.WX0 = [w.x, w.y];
        return { stopped, riding };
      });
      // yük altında kare hızı düşebilir: araba yeterince ilerleyene kadar (en çok 5 sn) sür
      await p.keyboard.down('KeyD');
      for (let n = 0; n < 50 && await p.evaluate(() => dist(W0.x, W0.y, WX0[0], WX0[1]) < 30); n++) await t.sleep(100);
      await p.keyboard.up('KeyD');
      Object.assign(r, await p.evaluate(() => {
        const P = G.player, w = W0, moved = dist(w.x, w.y, WX0[0], WX0[1]);
        const m0 = P.money; G.lootWagon(w); const gain = P.money - m0; P.dismount();
        return { moved, gain, law: G.law.level };
      }));
      t.ok(r.stopped, 'sürücüsüz araba durmalı'); t.ok(r.riding, 'araba sürülmeli'); t.ok(r.moved > 20, 'araba ilerlemeli', r.moved);
      t.ok(r.gain > 0, 'yük aranınca para');
      await p.evaluate(() => { Object.assign(G.law, { level: 0, bounty: 0 }); G.reports = []; });
    });
    await t.step('hayvan kementlenir ve bağlanır; ayı çabuk kurtulur', async () => {
      const r = await p.evaluate(async () => {
        const s = TH.openSpot(); TH.goto(s[0], s[1]); const P = G.player;
        P.giveWeapon('lasso', true); P.weapon = 'lasso';
        const d = new Animal(s[0] + 60, s[1], 'deer'); G.addEnt(d); P.ang = 0; P.aimAng = 0; P.throwLasso();
        await new Promise(res => setTimeout(res, 800));
        const s1 = d.state; G.hogtieAnimal(d); const s2 = d.state;
        const bear = new Animal(G.player.x - 30, G.player.y, 'bear'); G.addEnt(bear); G.player.weapon = 'lasso'; G.lassoAnimal(bear);
        await new Promise(res => setTimeout(res, 3000)); const bs = bear.state; bear.remove = true;
        return { s1, s2, bs };
      });
      t.eq(r.s1, 'lassoed', 'geyik kementlenmeli'); t.eq(r.s2, 'tied', 'geyik bağlanmalı'); t.ok(r.bs !== 'lassoed', 'ayı kemenden kurtulmalı', r.bs);
    });
    await t.step('suda bağlı kişi boğulur, ceset batar; ödül hedefi batmaz', async () => {
      const r = await p.evaluate(async () => {
        const w = TH.waterSpot(); if (!w) return { err: 'su yok' };
        const [x, y] = w; TH.goto(x + 40, y + 40);
        const n = new NPC(x, y, 'traveler', {}); G.addEnt(n); n.state = 'tied'; n.tieT = 999; n.assaulted = true;
        const t0 = performance.now(); while (performance.now() - t0 < 14000 && !n.remove) await new Promise(res => setTimeout(res, 250));
        const q = new NPC(x - 4, y, 'target', {}); q.bountyId = 'bt9'; G.activeBounty = { id: 'bt9', reward: 20 }; G.addEnt(q); q.hurt(9999, 'player', 'gun');
        await new Promise(res => setTimeout(res, 1800));
        const out = { drowned: n.dead, sunk: n.remove, targetFloats: !q.remove };
        q.remove = true; G.activeBounty = null; return out;
      });
      t.ok(!r.err, r.err); t.ok(r.drowned && r.sunk, 'bağlı kişi boğulup batmalı', r); t.ok(r.targetFloats, 'ödül hedefi batmamalı');
    });
    await t.step('göçebe kampları kurulur, yıllar sonra göç eder', async () => {
      const r = await p.evaluate(() => {
        const c = G.nomads[0]; TH.goto(c.x + 20, c.y + 70); G.spawnTick();
        const spawned = c.spawned && c.ents.length > 0;
        const before = G.nomads.map(n => Math.round(n.x) + ',' + Math.round(n.y)).join('|');
        G.clock += 1440 * G.dpy * 11; G.spawnTick();
        const after = G.nomads.map(n => Math.round(n.x) + ',' + Math.round(n.y)).join('|');
        return { n: G.nomads.length, spawned, moved: before !== after };
      });
      t.ok(r.n >= 4, 'göçebe kampları', r.n); t.ok(r.spawned, 'yakındaki kamp kurulmalı'); t.ok(r.moved, 'kamplar göç etmeli');
    });
    await t.step('mevsim değişince dünya ve harita yeni mevsimle çizilir', async () => {
      const r = await p.evaluate(() => {
        const dpy = G.dpy, out = [];
        for (const s of [3, 2, 0]) {
          G.clock = (Math.floor(G.day / dpy) * dpy + Math.floor(s * dpy / 4 + 0.6)) * 1440 + 11 * 60; G.onNewDay(G.day);
          out.push([G.season, G.world.season]);
          G.world.renderChunk(10, 10);
        }
        return out;
      });
      t.eq(r, [[3, 3], [2, 2], [0, 0]], 'oyun ve dünya mevsimi');
    });
    await t.step('küçük bir zemin lekesi havayı ve ekran rengini değiştirmez, geniş çölde toz fırtınası olur', async () => {
      const r = await p.evaluate(() => {
        const W = G.world, P = G.player;
        // sıcak ama çöl olmayan bir kasaba (eski kodda leke burada kum fırtınası açardı)
        const tw = W.towns.find(t => W.climateAt(t.spawn.x, t.spawn.y) > 0.55 && W.areaTile(t.spawn.x, t.spawn.y) !== T.DESERT && W.areaTile(t.spawn.x, t.spawn.y) !== T.REDROCK && W.areaTile(t.spawn.x, t.spawn.y) !== T.MESA);
        TH.goto(tw.spawn.x, tw.spawn.y);
        // oyuncunun altına 3x3 karoluk bir çöl lekesi koy
        const tx = P.x >> 4, ty = P.y >> 4, old = [];
        for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) { const k = (ty + j) * WW + tx + i; old.push([k, W.tile[k]]); W.tile[k] = T.DESERT; }
        W._areaC = null;
        const saved = { ...G.weather };
        Object.assign(G.weather, { type: 'storm', i: 1 });
        const patch = { tile: W.tileAtPx(P.x, P.y), area: W.areaTile(P.x, P.y), env: G.localWeather(P.x, P.y) };
        for (const [k, v] of old) W.tile[k] = v;
        W._areaC = null;
        // geniş çöl: çevresi de çöl olan, sıcak bir nokta
        let desert = null;
        for (let k = 0; k < 4000 && !desert; k++) {
          const x = rnd(200, WW * TS - 200), y = rnd(200, WH * TS - 200);
          if (W.tileAtPx(x, y) === T.DESERT && W.areaTile(x, y) === T.DESERT && W.climateAt(x, y) > 0.55) desert = G.localWeather(x, y);
        }
        Object.assign(G.weather, saved);
        return { patch, desert, town: tw.n };
      });
      t.eq(r.patch.tile, 3, 'leke karosu çöl');
      t.ok(r.patch.area !== 3, 'çevrenin baskın zemini çöl değil', r.patch);
      t.ok(r.patch.env.dust === 0 && r.patch.env.rain > 0.5, 'lekede kum fırtınası değil yağmur', r.patch.env);
      t.ok(r.desert && r.desert.dust > 0.5, 'geniş çölde toz fırtınası', r.desert);
    });
  },
};
