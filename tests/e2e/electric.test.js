'use strict';
/* Elektrik (js/devworld.js): kasabaya basamağına göre (şehre 1902'de, köye 1938'de) elektrik gelir. Sokağın kuzey ya da
   batı kıyısındaki kaldırıma aralıklı ağaç direkler dikilir, direkler binanın üstünden geçmeyen tellerle bağlanır; gaz
   lambaları beyaz ışıklı, titremeyen elektrikli lambaya döner, sonradan dikilen lambalar da elektriklidir; lambacı gaz
   lambası kalmayınca lamba yakmaz. Hayalet kasabaya elektrik gelmez. Kayıt ve yüklemede direkler, lambalar ve teller
   aynı kurulur; iki çizici de hatasız çizer. */
module.exports = {
  name: 'Elektrik: direkler, teller, elektrikli lambalar',
  timeout: 600000,
  async run(t) {
    const p = await t.newGame();
    const errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    await p.evaluate(() => {
      UI.closeAll(); G.godMode = true; G.eventT = 1e9; G.travelT = 1e9;
      window.__far = () => { const s = TH.openSpot(300 * TS, 300 * TS) || [300 * TS, 300 * TS]; TH.goto(s[0], s[1]); };
      window.__to = (y1) => { __far(); for (let y = G.dev.y + 1; y <= y1; y++) { G.devYear(y); G.devFlush(true); } };
      // kasabanın elektrik durumu
      window.__E = (T) => {
        const W = G.world, poles = [], lamps = [], elamps = [];
        for (let y = T.y - 3; y < T.y + T.h + 3; y++) for (let x = T.x - 3; x < T.x + T.w + 3; x++) {
          if (!W.inb(x, y)) continue;
          const o = W.obj[y * WW + x];
          if (o === O.UPOLE) poles.push([x, y]); else if (o === O.LAMP) lamps.push([x, y]); else if (o === O.ELAMP) elamps.push([x, y]);
        }
        const x0 = T.x * TS, y0 = T.y * TS, x1 = (T.x + T.w) * TS, y1 = (T.y + T.h) * TS;
        const L = W.lights.filter(l => l.type === 'lamp' && l.x >= x0 - 48 && l.x <= x1 + 48 && l.y >= y0 - 48 && l.y <= y1 + 48);
        return { id: T.id, tier: G.dev.towns[T.id].tier, ghost: !!G.dev.towns[T.id].ghost, elec: !!(G.dev.elec && G.dev.elec[T.id]), poles, lamps: lamps.length, elamps: elamps.length,
          wires: ((W.wires || {})[T.id] || []).length, elLights: L.filter(l => l.el).length, gasLights: L.filter(l => !l.el).length };
      };
    });

    await t.step('1890\'da hiçbir kasabada elektrik yok', async () => {
      const r = await p.evaluate(() => G.world.towns.map(T => __E(T)));
      t.ok(r.every(e => !e.elec && !e.poles.length && !e.elamps && !e.wires), 'direk, tel, elektrikli lamba yok', r.filter(e => e.elec || e.poles.length));
    });

    await t.step('büyük kasabalara erken, küçüklere geç gelir; gaz lambaları elektrikli olur, direkler tellerle bağlanır', async () => {
      const r = await p.evaluate(() => { __to(1912); return { y: G.dev.y, E: G.world.towns.map(T => __E(T)) }; });
      const on = r.E.filter(e => e.elec), off = r.E.filter(e => !e.elec);
      t.ok(on.length >= 1, '1912\'de en az bir kasabada elektrik var', r.E.map(e => [e.id, e.tier, e.elec]));
      t.ok(on.every(e => e.tier >= 3), 'erken gelen kasabalar büyük kasabalar', on.map(e => [e.id, e.tier]));
      t.ok(off.every(e => !e.poles.length && !e.elamps && !e.wires), 'elektriksiz kasabada direk ve elektrikli lamba yok');
      for (const e of on) {
        t.ok(e.poles.length >= 3 && e.wires >= e.poles.length / 2, `${e.id}: direkler ve teller`, { poles: e.poles.length, wires: e.wires });
        t.ok(e.lamps === 0 && e.gasLights === 0 && e.elamps === e.elLights, `${e.id}: bütün lambalar elektrikli`, e);
      }
    });

    await t.step('direkler kaldırımda, kapı önünde değil; teller bina üstünden geçmez; lambacı gaz lambası bulamaz', async () => {
      const r = await p.evaluate(() => {
        const W = G.world, bad = [], doorBad = [], over = [], lampsLeft = [];
        for (const T of W.towns) {
          if (!G.dev.elec[T.id]) continue;
          const st = new Set(T._dv.st);
          for (let y = T.y - 3; y < T.y + T.h + 3; y++) for (let x = T.x - 3; x < T.x + T.w + 3; x++) {
            const i = y * WW + x;
            if (!W.inb(x, y) || W.obj[i] !== O.UPOLE) continue;
            if (st.has(i) || (W.flags[i] & 8)) bad.push([T.id, x, y]);
            if (T.buildings.some(b => Math.abs(b.doorI % WW - x) <= 1 && y >= b.y + b.h && y <= b.y + b.h + 1)) doorBad.push([T.id, x, y]);
          }
          for (const [ax, ay, bx, by] of W.wires[T.id]) for (let k = 1; k < 20; k++) {
            const x = Math.floor((ax + (bx - ax) * k / 20) / TS), y = Math.floor((ay + (by - ay) * k / 20) / TS);
            if (W.flags[y * WW + x] & 8) { over.push([T.id, x, y]); break; }
          }
          if (G.townLamps(T).length) lampsLeft.push(T.id);
        }
        return { bad, doorBad, over, lampsLeft };
      });
      t.eq(r.bad, [], 'direk sokakta ya da binada değil');
      t.eq(r.doorBad, [], 'direk kapının önünü kapatmaz');
      t.eq(r.over, [], 'tel binanın üstünden geçmez');
      t.eq(r.lampsLeft, [], 'elektrikli kasabada yakılacak gaz lambası kalmaz');
    });

    await t.step('1940\'ta hayalet olmayan her kasabada elektrik; sonradan dikilen lambalar elektrikli', async () => {
      const r = await p.evaluate(() => {
        __to(1940);
        const E = G.world.towns.map(T => __E(T));
        // elektrikten sonraki lamba kayıtları elektrikli lamba dikmiş olmalı
        const late = [];
        for (const T of G.world.towns) {
          const ops = G.dev.ops.filter(op => op[1] === T.id), ei = ops.findIndex(op => op[0] === 'e');
          if (ei < 0) continue;
          for (const op of ops.slice(ei + 1)) if (op[0] === 'l') for (const i of op[2]) late.push(G.world.obj[i]);
        }
        return { E, gasLate: late.filter(o => o === O.LAMP).length, elLate: late.filter(o => o === O.ELAMP).length };
      });
      const live = r.E.filter(e => !e.ghost);
      t.ok(live.length && live.every(e => e.elec), 'hayalet olmayan her kasabada elektrik', r.E.map(e => [e.id, e.tier, e.ghost, e.elec]));
      t.ok(r.E.filter(e => e.ghost).every(e => !e.elec || e.poles.length), 'hayalet kasaba elektriksiz (ya da önceden gelmişse direkleri durur)');
      t.ok(r.gasLate === 0 && r.elLate > 0, 'sonradan dikilen lambalar elektrikli', { gas: r.gasLate, el: r.elLate });
    });

    await t.step('kayıt ve yükleme: direkler, lambalar, ışıklar ve teller aynı kurulur', async () => {
      const H = () => p.evaluate(() => {
        const W = G.world;
        let h = 0x811c9dc5;
        for (let i = 0; i < W.obj.length; i++) h = Math.imul(h ^ W.obj[i], 16777619);
        const L = W.lights.filter(l => l.type === 'lamp').map(l => [l.x, l.y, l.el ? 1 : 0, l.r].join(',')).sort().join(';');
        const Wr = Object.keys(W.wires || {}).sort().map(k => k + ':' + W.wires[k].map(s => s.join(',')).join('|')).join(';');
        return { h: h >>> 0, L, Wr, elec: Object.keys(G.dev.elec).sort().join(',') };
      });
      await p.evaluate(() => G.saveGame());
      const before = await H();
      await p.evaluate(async () => { await G.loadGame(G.slot, 'manual'); });
      const after = await H();
      t.eq(after.elec, before.elec, 'elektrikli kasabalar');
      t.eq(after.h, before.h, 'nesneler (direkler, lambalar)');
      t.eq(after.L, before.L, 'lamba ışıkları');
      t.eq(after.Wr, before.Wr, 'teller');
    });

    await t.step('iki çizici de gece elektrikli kasabayı hatasız çizer', async () => {
      const id = await p.evaluate(() => {
        const W = G.world, T = W.towns.filter(T => G.dev.elec[T.id] && (W.wires[T.id] || []).length).sort((a, b) => W.wires[b.id].length - W.wires[a.id].length)[0];
        const [ax, ay, bx, by] = W.wires[T.id][0];
        TH.goto((ax + bx) / 2, (ay + by) / 2 + 40); UI.closeAll();
        G.clock = Math.floor(G.clock / 1440) * 1440 + 22 * 60; G.weather.type = 'clear';
        window.__hySoft = true;
        return T.id;
      });
      for (const gfx of [0, 1]) {
        await p.evaluate((gfx) => { G.settings.gfx = gfx; G.applySettings(); }, gfx);
        await t.sleep(1800);
        await p.screenshot({ path: `tests/output/electric_${gfx ? '2d' : 'hybrid'}.png` });
      }
      t.eq(errs, [], 'sayfa hatası yok (' + id + ')');
    });
  },
};
