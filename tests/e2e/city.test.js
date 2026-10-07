'use strict';
/* Zengin şehir (Saint Clement): taş sokaklar, parklar, pazar yeri, modern binalar; eski kayıtların dünyası değişmez */
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
      await p.evaluate(async () => { G.saveGame(true); await G.loadGame(); });
      await p.waitForFunction(() => G.state === 'play', null, { timeout: 60000 });
      t.eq(await p.evaluate(() => WGEN), await p.evaluate(() => WGEN_NEW), 'yüklemede dünya sürümü korunur');
      t.ok(await p.evaluate(() => G.world.buildings.some(b => b.type === 'market')), 'yüklenen dünyada pazar var');
    });
  },
};
