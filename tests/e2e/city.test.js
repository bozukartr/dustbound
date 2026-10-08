'use strict';
/* Zengin şehir (Saint Clement): ızgara planlı şehir (cadde, sokak, bordürlü kaldırım, hizalı cepheler), parklar, pazar yeri,
   modern binalar; fayton, yük arabası ve atlı vatandaş trafiği; eski kayıtların dünyası değişmez */
module.exports = {
  name: 'Zengin şehir',
  timeout: 300000,
  async run(t) {
    const p = await t.newGame();
    await t.step('Saint Clement: arnavut kaldırımı sokaklar, taş kaldırım, iki park, pazar yeri, modern binalar', async () => {
      const r = await p.evaluate(() => {
        const T0 = G.world.towns.find(x => x.id === 'stclement'), W = G.world;
        let cob = 0, pave = 0, road = 0;
        for (let y = T0.y; y < T0.y + T0.h; y++) for (let x = T0.x; x < T0.x + T0.w; x++) { const t = W.tile[y * WW + x]; if (t === T.COBBLE) cob++; else if (t === T.PAVE) pave++; else if (t === T.ROAD) road++; }
        const objs = (k) => { let n = 0; for (const pk of T0.parks) for (let y = pk.y; y < pk.y + pk.h; y++) for (let x = pk.x; x < pk.x + pk.w; x++) if (W.obj[y * WW + x] === k) n++; return n; };
        const B = T0.buildings, need = [...T0.b, ...(T0.xb || [])];
        const missing = need.filter(ty => !B.some(b => b.type === ty));
        const other = G.world.towns.find(x => x.id === 'harlow');
        return { wgen: WGEN, cob, pave, road, parks: T0.parks.length, fountain: objs(O.FOUNTAIN), hedge: objs(O.HEDGE), flowers: objs(O.FLOWERBED), market: B.filter(b => b.type === 'market').length,
          modern: B.filter(b => b.modern).length, total: B.length, missing, harlowModern: other.buildings.some(b => b.modern), harlowCob: (() => { let n = 0; for (let y = other.y; y < other.y + other.h; y++) for (let x = other.x; x < other.x + other.w; x++) if (W.tile[y * WW + x] === T.COBBLE) n++; return n; })() };
      });
      t.ok(r.wgen >= 2, 'yeni dünya sürümü zengin şehri kurar', r.wgen);
      t.ok(r.cob > 300 && r.road === 0, 'sokaklar arnavut kaldırımı', r);
      t.ok(r.pave > 2000, 'kaldırımlar taş döşeli', r.pave);
      t.eq(r.parks, 2, 'iki park'); t.ok(r.fountain >= 1 && r.hedge > 20 && r.flowers > 2, 'parkta çeşme, çit ve çiçek', r);
      t.eq(r.market, 1, 'pazar yeri'); t.eq(r.modern, r.total, 'bütün binalar modern'); t.eq(r.missing, [], 'kasabanın bütün binaları yerleşti');
      t.ok(!r.harlowModern && r.harlowCob === 0, 'öbür kasabalar eski hâlinde');
    });

    await t.step('ızgara plan: cephesi hizalı sıralar, kaldırıma açılan kapılar, cadde ve sokak kesitleri', async () => {
      const r = await p.evaluate(() => {
        const T0 = TH.town('stclement'), W = G.world, N = T0.net.nodes;
        const fronts = new Set(), bad = [];
        let n = 0, doorOk = 0;
        for (const b of T0.buildings) {
          if (b.type === 'station') continue;
          n++; fronts.add(b.y + b.h);
          const x = b.x + (b.w >> 1), y = b.y + b.h, below = [1, 2, 3].map(k => W.tile[(y + k) * WW + x]);
          if (W.tile[y * WW + x] === T.PAVE && below.includes(T.COBBLE)) doorOk++; else bad.push(b.type);
        }
        // kenar ortasından dik kesit: kaldırım (p) - taşıt yolu (c) - kaldırım
        const sections = [];
        for (const a of N) for (const e of a.adj) {
          const b = N[e.n]; if (e.n < a.id || a.gate || b.gate) continue;
          const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, horiz = Math.abs(b.x - a.x) > Math.abs(b.y - a.y);
          let str = '';
          for (let k = -6; k <= 6; k++) {
            const tx = horiz ? (mx / 16) | 0 : ((mx / 16) | 0) + k, ty = horiz ? ((my / 16) | 0) + k : (my / 16) | 0, tt = W.tile[ty * WW + tx];
            str += tt === T.COBBLE ? 'c' : tt === T.PAVE ? 'p' : 'x';
          }
          sections.push({ av: e.lane > 12, ok: (e.lane > 12 ? /p{3}c{4}p{3}/ : /p{2}c{3}p{2}/).test(str), str });
        }
        return { plan: T0.plan, n, doorOk, bad, rows: fronts.size, nodes: N.length, gates: N.filter(q => q.gate).length, cross: N.filter(q => q.adj.length === 4).length,
          av: sections.filter(q => q.av).length, st: sections.filter(q => !q.av).length, badSec: sections.filter(q => !q.ok).map(q => q.str),
          lamps: W.lights.filter(l => l.type === 'lamp' && W.townAt(l.x, l.y) === T0).length, spawnOk: W.tileAtPx(T0.spawn.x, T0.spawn.y) === T.PAVE && !W.blocked(T0.spawn.x, T0.spawn.y, 5) };
      });
      t.eq(r.plan, 'grid', 'şehir ızgara planlı');
      t.eq(r.rows, 4, 'binalar dört sırada; aynı sokağa bakanların cephesi aynı hizada');
      t.eq(r.doorOk, r.n, 'her kapı kaldırıma açılır, önünde taşıt yolu', r.bad);
      t.ok(r.nodes >= 20 && r.gates === 3 && r.cross >= 6, 'sokak ağı: kavşaklar ve üç kapı', r);
      t.ok(r.av >= 6 && r.st >= 12, 'ana cadde ve sokaklar', r);
      t.eq(r.badSec, [], 'cadde 3+4+3, sokak 2+3+2 karo (kaldırım, taşıt yolu, kaldırım)');
      t.ok(r.lamps > 60, 'sokak lambaları', r.lamps);
      t.ok(r.spawnOk, 'meydanda doğma yeri açık');
    });

    await t.step('yaya kaldırımdan, araba taşıt yolundan yol bulur', async () => {
      const r = await p.evaluate(() => {
        const T0 = TH.town('stclement'), W = G.world;
        // aynı sokağa bakan, en uzak iki bina
        const rows = {};
        for (const b of T0.buildings) if (b.type !== 'station') (rows[b.y + b.h] = rows[b.y + b.h] || []).push(b);
        const row = Object.values(rows).sort((a, b) => b.length - a.length)[0].sort((a, b) => a.x - b.x);
        const A = row[0], B = row[row.length - 1];
        const frac = (path, tt) => { let n = 0, k = 0; for (let i = 1; i < path.length; i++) { const [ax, ay] = path[i - 1], [bx, by] = path[i], m = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / 8)); for (let j = 0; j < m; j++) { const x = ax + (bx - ax) * j / m, y = ay + (by - ay) * j / m; n++; if (W.tileAtPx(x, y) === tt) k++; } } return n ? k / n : 0; };
        const foot = TownPath.find(T0, A.door.x, A.door.y + 10, B.door.x, B.door.y + 10);
        const cart = TownPath.find(T0, A.door.x, A.curbY + 6, B.door.x, B.curbY + 6, 6);
        return { d: Math.round(Math.abs(B.door.x - A.door.x)), foot: foot && frac(foot, T.PAVE), cart: cart && frac(cart, T.COBBLE) };
      });
      t.ok(r.d > 300, 'iki bina birbirinden uzak', r.d);
      t.ok(r.foot > 0.75, 'yaya yolu çoğunlukla kaldırımda', r);
      t.ok(r.cart > 0.75, 'araba yolu çoğunlukla taşıt yolunda', r);
    });

    await t.step('şehir trafiği: fayton, yük arabası ve atlılar sağ şeritte; takılmadan dolaşır; gece seyrelir', async () => {
      await p.evaluate(() => {
        const T0 = TH.town('stclement'), N = T0.net.nodes;
        G.clock = Math.floor(G.clock / 1440) * 1440 + 11 * 60; G.weather = { type: 'clear', t: 99999, i: 0, cloud: 0, fogI: 0 };
        const c = N.reduce((a, q) => !q.gate && dist2(q.x, q.y, T0.cx, T0.cy) < dist2(a.x, a.y, T0.cx, T0.cy) ? q : a);
        TH.goto(c.x + 70, c.y - 60); UI.closeAll();
      });
      const S = [];
      for (let k = 0; k < 16; k++) {
        await t.sleep(1000);
        S.push(await p.evaluate(() => {
          const W = G.world, out = [];
          for (const e of G.ents) if (!e.remove && e.city && (e.kind === 'wagon' || e.cityRide)) {
            const tt = W.tileAtPx(e.x, e.y), d = e.kind === 'wagon' ? e.ang : (e.hAng === undefined ? e.ang : e.hAng);
            out.push({ id: e.id, k: e.kind === 'wagon' ? (e.cab ? 'cab' : 'cart') : 'rider', x: e.x, y: e.y, road: tt === T.COBBLE || tt === T.ROAD, park: e.parkT > 0, name: e.name });
          }
          return out;
        }));
      }
      const all = S.flat(), last = S[S.length - 1];
      const ids = {}; for (const s of S) for (const e of s) (ids[e.id] = ids[e.id] || []).push(e);
      const moved = Object.values(ids).filter(L => L.length >= 8).map(L => Math.hypot(L[L.length - 1].x - L[0].x, L[L.length - 1].y - L[0].y) > 20 || L.some(q => q.park));
      const want = await p.evaluate(() => { const d = G.cityWant(); G.clock = Math.floor(G.clock / 1440) * 1440 + 3 * 60; const n = G.cityWant(); G.clock = Math.floor(G.clock / 1440) * 1440 + 11 * 60; return { d, n }; });
      t.ok(last.filter(e => e.k !== 'rider').length >= 4, 'şehirde araba trafiği', last.length);
      t.ok(last.filter(e => e.k === 'rider').length >= 3, 'şehirde atlı vatandaşlar', last.length);
      t.ok(all.some(e => e.k === 'cab' && e.name === 'Fayton'), 'faytonlar dolaşır');
      const carts = all.filter(e => e.k !== 'rider'), riders = all.filter(e => e.k === 'rider');
      t.ok(carts.filter(e => e.road).length / carts.length > 0.97, 'arabalar taşıt yolunda kalır', carts.length);
      t.ok(riders.filter(e => e.road).length / riders.length > 0.9, 'atlılar taşıt yolunda kalır', riders.length);
      t.ok(moved.length >= 4 && moved.filter(Boolean).length >= moved.length - 1, 'takılan yok', moved);
      t.ok(want.n.carts < want.d.carts && want.n.riders < want.d.riders, 'gece şehir seyrelir', want);
      const skip = await p.evaluate(() => G.ents.filter(e => !e.remove && e.city).every(e => G.skipEnt(e)));
      t.ok(skip, 'şehir trafiği kayda yazılmaz (her açılışta yeniden kurulur)');
    });

    await t.step('pazarda seçkin mallar %25 pahalı; peynir doyurur', async () => {
      const r = await p.evaluate(() => {
        const b = G.world.buildings.find(x => x.type === 'market'), P = G.player;
        if (G.hour < 8 || G.hour > 20) G.advanceClock(((10 - G.hour + 24) % 24) * 60);
        TH.goto(b.door.x, b.door.y + 10); P.money = 50; P.hunger = 20;
        const acts = TH.actions();
        UI.openBuilding(b); const labels = TH.menuLabels(); UI.closeAll();
        UI.openShop(b.def.shop);
        const items = TH.menuLabels(), names = {}; for (const id of ['oysters', 'cheese', 'pastry', 'fine_coffee', 'champagne', 'cigar', 'perfume']) names[id] = items.some(x => x.includes(ITEMS[id].n));
        const m0 = P.money; const ok = TH.clickItem(new RegExp(ITEMS.cheese.n)); const paid = m0 - P.money;
        UI.closeAll();
        const h0 = P.hunger; G.consume('cheese');
        return { acts, labels, items, names, ok, paid, expect: ITEMS.cheese.p * G.priceMul(true) * 1.25, fed: P.hunger - h0 };
      });
      t.ok(r.acts.some(a => /Gir/.test(a)), 'pazara girilir', r.acts);
      t.ok(r.labels.some(a => /Alışveriş/.test(a)), 'alışveriş menüsü', r.labels);
      t.ok(Object.values(r.names).every(Boolean), 'pazarda seçkin mallar', r.names);
      t.ok(r.ok && Math.abs(r.paid - r.expect) < 0.011, 'fiyat %25 yüksek', r);
      t.ok(r.fed > 25, 'peynir doyurur', r.fed);
    });

    await t.step('park çeşmesinden su içilir', async () => {
      const r = await p.evaluate(() => {
        const W = G.world, T0 = W.towns.find(x => x.id === 'stclement'), pk = T0.parks[0];
        let f = null; for (let y = pk.y; y < pk.y + pk.h && !f; y++) for (let x = pk.x; x < pk.x + pk.w; x++) if (W.obj[y * WW + x] === O.FOUNTAIN) { f = [x, y]; break; }
        TH.goto(f[0] * 16 + 8, (f[1] + 1) * 16 + 10); G.player.thirst = 20;
        const acts = TH.actions(); TH.act(/Su İç/);
        return { acts, thirst: G.player.thirst };
      });
      t.ok(r.acts.some(a => /Çeşme/.test(a)) && r.acts.some(a => /Su İç/.test(a)), 'çeşme eylemleri', r.acts);
      t.ok(r.thirst > 20, 'susuzluk gider', r.thirst);
    });

    await t.step('eski kayıtların dünyası (sürüm 1) değişmez; kayıt sürümü korur', async () => {
      const r = await p.evaluate(async () => {
        WGEN = 1;
        const w = new World(G.seed); await w.generate(() => {});
        WGEN = WGEN_NEW;
        const T0 = w.towns.find(x => x.id === 'stclement');
        let cob = 0; for (let i = 0; i < w.tile.length; i++) if (w.tile[i] === T.COBBLE || w.tile[i] === T.PAVE) cob++;
        return { cob, market: T0.buildings.some(b => b.type === 'market'), modern: w.buildings.some(b => b.modern), parks: T0.parks.length };
      });
      t.eq(r, { cob: 0, market: false, modern: false, parks: 0 }, 'eski sürümde zengin şehir eklentileri yok');
      const r3 = await p.evaluate(async () => {
        WGEN = 3;
        const w = new World(G.seed); await w.generate(() => {});
        WGEN = WGEN_NEW;
        const T0 = w.towns.find(x => x.id === 'stclement');
        return { plan: T0.plan || null, net: !!T0.net, parks: T0.parks.length, market: T0.buildings.some(b => b.type === 'market') };
      });
      t.eq(r3, { plan: null, net: false, parks: 2, market: true }, 'sürüm 3 kayıtları eski (organik) zengin şehri korur');
      await p.evaluate(async () => { G.saveGame(true); await G.loadGame(); });
      await p.waitForFunction(() => G.state === 'play', null, { timeout: 60000 });
      t.eq(await p.evaluate(() => WGEN), await p.evaluate(() => WGEN_NEW), 'yüklemede dünya sürümü korunur');
      t.ok(await p.evaluate(() => G.world.buildings.some(b => b.type === 'market')), 'yüklenen dünyada pazar var');
    });
  },
};
