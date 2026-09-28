'use strict';
/* Fiyatlar, dükkân/banka soygunu tekrarı, al-sat açığı, günlük sınırlar */
module.exports = {
  name: 'Ekonomi ve açık kapatma',
  async run(t) {
    const p = await t.newGame();
    await t.step('para biçimi (sent ve dolar)', async () => {
      const r = await p.evaluate(() => [0.05, 0.25, 0.999, 1, 14, 1800, 0].map(fmtMoney));
      t.eq(r, ['5¢', '25¢', '$1.00', '$1.00', '$14.00', '$1800.00', '$0.00'], 'fmtMoney');
    });
    await t.step('mağazada 1890 fiyatları', async () => {
      await p.evaluate(() => UI.openShop('general', 'Genel Mağaza')); await t.sleep(300);
      const rows = await p.evaluate(() => [...document.querySelectorAll('.p-item')].map(n => n.textContent.replace(/\s+/g, ' ').trim()));
      t.ok(rows.some(r => /Ekmek.*5¢/.test(r)), 'ekmek 5¢ olmalı', rows.slice(0, 6));
      await p.evaluate(() => UI.closeAll());
    });
    await t.step('aynı dükkân ve banka art arda soyulamaz', async () => {
      const r = await p.evaluate(() => {
        const P = G.player, W = G.world;
        const yes = () => { const m = UI.top(); const b = m && [...m.el.querySelectorAll('.p-item')].find(n => /Evet|Soy|Boşalt/.test(n.textContent)); if (b) b.click(); };
        const store = W.buildings.find(b => b.type === 'general');
        let m0 = P.money; UI.robStore(store, true); yes(); const g1 = P.money - m0;
        m0 = P.money; UI.robStore(store, true); yes(); const g2 = P.money - m0;
        G.clock += 3 * 1440; G.law.level = 0; UI.closeAll(); m0 = P.money; UI.robStore(store, false); yes(); const g3 = P.money - m0;
        const bank = W.buildings.find(b => b.type === 'bank');
        P.giveWeapon('schofield', true); P.weapon = 'schofield'; G.law.level = 0; UI.closeAll();
        m0 = P.money; UI.robBank(bank); yes(); const b1 = P.money - m0;
        m0 = P.money; UI.robBank(bank); yes(); const b2 = P.money - m0;
        UI.closeAll();
        return { g1, g2, g3, b1, b2 };
      });
      t.ok(r.g1 > 0, 'ilk dükkân soygunu para vermeli', r); t.eq(r.g2, 0, 'hemen ikinci soygun boş'); t.ok(r.g3 > 0, 'günler sonra kasa yine dolu', r);
      t.ok(r.b1 > 0, 'ilk banka soygunu', r); t.eq(r.b2, 0, 'ikinci banka soygunu boş');
    });
    await t.step('satış fiyatı hiçbir yerde alış fiyatını geçmez (al-sat açığı yok)', async () => {
      const bad = await p.evaluate(() => { const out = []; for (const id of PURCHASABLE) { let best = 0; for (const s in SHOPS) best = Math.max(best, G.sellPrice(id, s)); if (ITEMS[id].p > 0 && best >= ITEMS[id].p * 0.65) out.push(id); } return out; });
      t.eq(bad, [], 'al-sat açığı olan eşya');
    });
    await t.step('bilek güreşi günlük sınırı, ev ve harabe tekrar aranamaz', async () => {
      const r = await p.evaluate(() => {
        const P = G.player, W = G.world; P.money = 100; let opened = 0;
        for (let i = 0; i < 5; i++) { const n0 = UI.stack.length; UI.openArmWrestle(); if (UI.stack.length > n0) { opened++; UI.pop(); } }
        const house = W.buildings.find(b => b.type === 'house' && b.enter);
        G.breakDoor(house); const open = G.doorOpen(house);
        let m0 = P.money; G.searchHouse(house); const h1 = P.money - m0; m0 = P.money; G.searchHouse(house); const h2 = P.money - m0;
        return { opened, open, h1, h2 };
      });
      t.ok(r.opened <= 3, 'günde en fazla 3 bilek güreşi', r.opened); t.ok(r.open, 'kırılan kapı açık kalmalı'); t.eq(r.h2, 0, 'ev ikinci kez aranınca boş');
    });
    await t.step('soyulan dükkânlar kayda geçer', async () => {
      const n = await p.evaluate(() => { G.saveGame(true); return Object.keys(JSON.parse(Platform.get(slotKey(G.slot, 'auto'))).robbed || {}).length; });
      t.ok(n > 0, 'kayıtta soyulan yerler olmalı', n);
    });
  },
};
