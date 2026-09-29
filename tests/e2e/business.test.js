'use strict';
/* İşletme satın alma, stok, kasa, toptan mal, yük arabası, arsaya inşaat */
module.exports = {
  name: 'İşletmeler',
  async run(t) {
    const p = await t.newGame();
    await p.evaluate(() => { G.player.money = 5000; window.TW = TH.town('stclement'); });
    await t.step('satılık işletme alınır, eski sahibi işletmeci kalır', async () => {
      const r = await p.evaluate(() => {
        const shop = TW.buildings.find(b => G.bizForSale(b) && BIZ[b.type].goods === 'dry') || TW.buildings.find(b => G.bizForSale(b) && BIZ[b.type].goods);
        window.SHOP = shop; const kr = G.keeperOf(shop), m0 = G.player.money, pr = G.bizPrice(shop);
        G.buyBiz(shop); const z = G.bizOf(shop);
        return { ok: !!z, paid: m0 - G.player.money, pr, mgr: z && z.mgr.name, keeper: kr && kr.name, word: z && G.bizStockWord(z), forSale: G.bizForSale(shop) };
      });
      t.ok(r.ok, 'işletme kaydı olmalı'); t.near(r.paid, r.pr, 0.01, 'fiyat ödenmeli');
      if (r.keeper) t.eq(r.mgr, r.keeper, 'eski sahibi işletmeci');
      t.ok(!r.forSale, 'artık satılık olmamalı'); t.eq(r.word, 'azalıyor', 'başlangıç stoğu yarım');
    });
    await t.step('yük arabası alınır, toptan mal arabaya yüklenir ve dükkâna boşaltılır', async () => {
      const r = await p.evaluate(() => {
        const st = TW.buildings.find(b => b.type === 'stable'); G.buyWagon(st);
        const z = G.bizOf(SHOP), g = BIZ[SHOP.type].goods;
        const sup = G.world.buildings.find(b => b !== SHOP && G.goodsAt(b).some(x => x.g === g));
        const it = G.goodsAt(sup).find(x => x.g === g);
        G.myWagon.x = sup.door.x + 20; G.myWagon.y = sup.door.y + 20;
        G.buyGoods(sup, g, it.p, 3);
        const loaded = G.myWagon.crates.length;
        z.stock = 0;
        G.myWagon.x = SHOP.door.x + 20; G.myWagon.y = SHOP.door.y + 20; G.player.x = SHOP.door.x; G.player.y = SHOP.door.y + 10;
        const avail = G.deliverables(SHOP).length; G.deliverGoods(SHOP);
        return { wagon: !!G.myWagon, loaded, avail, stock: z.stock, left: G.myWagon.crates.length };
      });
      t.ok(r.wagon, 'yük arabası olmalı'); t.eq(r.loaded, 3, 'arabaya 3 sandık'); t.eq(r.avail, 3, 'teslim edilebilir sandık'); t.eq(r.stock, 3, 'stok'); t.eq(r.left, 0, 'araba boşalmalı');
    });
    await t.step('omuzdaki sandık: yanlış mal kabul edilmez, doğru mal teslim edilir', async () => {
      const r = await p.evaluate(() => {
        const P = G.player, g = BIZ[SHOP.type].goods, wrong = g === 'flour' ? 'iron' : 'flour';
        P.x = SHOP.door.x; P.y = SHOP.door.y + 10; P.ang = -Math.PI / 2;
        P.carry = new Crate(0, 0, wrong); const w = G.carryInteraction().actions.map(a => a.n);
        P.carry = new Crate(0, 0, g); const it = G.carryInteraction(); const s0 = G.bizOf(SHOP).stock;
        it.actions[0].fn();
        return { wrongHasDeliver: w.some(x => /^Teslim Et/.test(x)), gained: G.bizOf(SHOP).stock - s0, carry: !!P.carry };
      });
      t.ok(!r.wrongHasDeliver, 'yanlış mal teslim edilememeli'); t.eq(r.gained, 1, 'stok 1 artmalı'); t.ok(!r.carry, 'omuz boşalmalı');
    });
    await t.step('günler geçince gelir kasada birikir, stok azalır; kasa alınır', async () => {
      const r = await p.evaluate(() => {
        const z = G.bizOf(SHOP); z.stock = BIZ[z.type].cap; const s0 = z.stock;
        G.advanceClock(1440 * 2);
        const cash = z.cash, stock = z.stock, m0 = G.player.money;
        G.bizCollect(z);
        return { cash, used: s0 - stock, got: G.player.money - m0, after: z.cash };
      });
      t.ok(r.cash > 1, 'kasada para birikmeli', r.cash); t.ok(r.used > 0, 'stok tükenmeli', r.used); t.near(r.got, r.cash, 0.01, 'kasa alınmalı'); t.eq(r.after, 0, 'kasa boşalmalı');
    });
    await t.step('arsaya inşaat: 3 gün sonra girilebilir bina ve işletmeci', async () => {
      const r = await p.evaluate(() => {
        const lot = TW.lots[0]; G.buyLot(lot);
        const types = G.lotTypes(lot), type = types.includes('saloon') ? 'saloon' : types[0];
        G.startBuild(lot, type); const site = G.lotBiz(lot).site;
        G.advanceClock(1440 * 4);
        const z = G.lotBiz(lot), b = G.bizBuilding(z);
        return { site, built: !z.site, type: b && b.type, want: type, enter: b && b.enter, staff: b && !!b.staff, lot: b && b.lot };
      });
      t.ok(r.site, 'önce şantiye'); t.ok(r.built, 'inşaat bitmeli'); t.eq(r.type, r.want, 'bina türü'); t.ok(r.enter && r.staff, 'girilebilir ve tezgâhlı olmalı', r);
    });
    await t.step('işletmeler, arsa ve araba kayıttan yüklenince korunur', async () => {
      const r = await p.evaluate(async () => {
        const before = G.biz.map(z => z.bid + ':' + z.type).join(',');
        G.player.carry = new Crate(0, 0, 'dry'); G.saveGame(true); await G.loadGame(G.slot, 'auto');
        const lot = TH.town('stclement').lots[0], z = G.lotBiz(lot), b = G.bizBuilding(z);
        return { before, after: G.biz.map(z => z.bid + ':' + z.type).join(','), built: b && b.lot, wagon: !!G.myWagon, carry: G.player.carry && G.player.carry.g };
      });
      t.eq(r.after, r.before, 'işletme listesi'); t.ok(r.built, 'arsadaki bina yeniden kurulmalı'); t.ok(r.wagon, 'araba'); t.eq(r.carry, 'dry', 'omuzdaki sandık');
    });
    await t.step('menüler: işletme paneli, toptan mal, satılık listesi, günlük', async () => {
      const r = await p.evaluate(() => {
        const z = G.biz[0]; UI.openBuilding(G.bizBuilding(z)); const panel = TH.menuLabels(); UI.closeAll();
        UI.openBizMarket(TH.town('stclement').buildings.find(b => b.type === 'county')); const market = TH.menuLabels().length; UI.closeAll();
        UI.openJournal(5); const jr = document.querySelectorAll('.jr-biz tr').length; UI.closeAll();
        return { panel, market, jr };
      });
      t.ok(r.panel.some(x => /Kasayı Al/.test(x)) && !r.panel.some(x => /Soy/.test(x)), 'kendi işletmende kasa var, soygun yok', r.panel);
      t.ok(r.market > 0, 'satılık işletme listesi'); t.ok(r.jr >= 3, 'günlükte işletme tablosu', r.jr);
    });
  },
};
