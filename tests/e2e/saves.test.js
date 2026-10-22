'use strict';
/* Kayıt yuvaları, otomatik/manuel kayıt; eski biçimli kayıtlar (tek dünyadan önce) görünmez ve açılmaz */
module.exports = {
  name: 'Kayıt yuvaları ve eski kayıtlar',
  async run(t) {
    const p = await t.newGame();
    await t.step('otomatik ve manuel kayıt ayrı tutulur, istenen yüklenir', async () => {
      const r = await p.evaluate(async () => {
        G.player.money = 123.45; G.saveGame();          // manuel
        G.player.money = 999; G.saveGame(true);         // otomatik
        const L = G.slotList()[0];
        const out = { auto: !!L.auto, manual: !!L.manual, thumb: !!(L.manual && L.manual.thumb), place: L.manual && L.manual.place, latest: G.latestSave().kind };
        await G.loadGame(1, 'manual');
        out.loadedManual = G.player.money;
        await G.loadGame(1, 'auto');
        out.loadedAuto = G.player.money;
        return out;
      });
      t.ok(r.auto && r.manual, 'iki kayıt da olmalı', r);
      t.ok(r.thumb, 'yuva özetinde ekran görüntüsü olmalı');
      t.eq(r.latest, 'auto', 'en yeni kayıt');
      t.near(r.loadedManual, 123.45, 0.01, 'manuel kayıttaki para');
      t.near(r.loadedAuto, 999, 0.01, 'otomatik kayıttaki para');
    });
    await t.step('Kayıt Yükle ekranı yuvaları gösterir', async () => {
      await p.waitForFunction(() => G.state === 'play');
      await p.evaluate(() => UI.openSlots('load')); await t.sleep(300);
      const r = await p.evaluate(() => ({ cards: document.querySelectorAll('.sl-card').length, empty: document.querySelectorAll('.sl-card.empty').length, btns: document.querySelectorAll('.sl-btn.nav[data-act="load"]').length }));
      t.eq(r.cards, 3, 'yuva sayısı'); t.eq(r.empty, 2, 'boş yuva sayısı'); t.eq(r.btns, 2, 'yüklenebilir kayıt düğmesi');
      await p.evaluate(() => UI.closeAll());
    });
    await t.step('ana menüden 2. yuvaya yeni hayat', async () => {
      await p.evaluate(() => { G.saveGame(true); UI.closeAll(); UI.showMainMenu(); }); await t.sleep(400);
      const items = await p.evaluate(() => [...document.querySelectorAll('#mm-items .mm-item')].map(n => n.dataset.id));
      t.ok(items.includes('cont') && items.includes('load'), 'kayıt varken Devam Et ve Kayıt Yükle görünmeli', items);
      await p.evaluate(() => UI.openSlots('new')); await t.sleep(300);
      const focus = await p.evaluate(() => UI.top().focusEl && UI.top().focusEl.dataset.n);
      t.eq(focus, '2', 'yeni hayatta ilk boş yuva seçili gelmeli');
      await p.evaluate(() => document.querySelector('.sl-card[data-n="2"]').click()); await t.sleep(500);
      await p.evaluate(() => { for (let k = 0; k < 8 && document.querySelector('#cr-go'); k++) document.querySelector('#cr-go').click(); });
      await p.waitForFunction(() => G.state === 'play', null, { timeout: 150000 }); await t.sleep(500);
      const L = await p.evaluate(() => G.slotList().map(s => !!s.auto));
      t.eq(await p.evaluate(() => G.slot), 2, 'yeni hayat 2. yuvada');
      t.eq(L, [true, true, false], 'dolu yuvalar');
    });
    await t.step('Tek Hayat: ölünce yuva silinir', async () => {
      const L = await p.evaluate(() => { G.difficulty = 'hard'; G.saveGame(true); G.playerDied('test'); return G.slotList().map(s => !!(s.auto || s.manual)); });
      t.eq(L, [true, false, false], 'yalnız 1. yuva kalmalı');
    });
    await t.step('eski biçimli (4 öncesi) kayıt görünmez ve açılmaz; yuvası yeni hayata açık', async () => {
      const r = await p.evaluate(async () => {
        // 1. yuvanın iki kaydı da eski biçime çevrilir (yuva bilgisinde biçim yok, kayıtta v: 3)
        const M = G.slotMetaAll();
        for (const kind of ['auto', 'manual']) {
          const raw = Platform.get(slotKey(1, kind));
          if (!raw) continue;
          const d = JSON.parse(raw); d.v = 3; Platform.set(slotKey(1, kind), JSON.stringify(d));
          delete M[1][kind].v;
        }
        Platform.set(SLOT_META, JSON.stringify(M));
        TH.feeds.length = 0;
        const loaded = await G.loadGame(1, 'auto');
        return { list: G.slotList().map(s => !!(s.auto || s.manual)), has: G.hasSave(), free: G.freeSlot(), loaded, feed: TH.feeds.slice(-1)[0] || '' };
      });
      t.eq(r.list, [false, false, false], 'yuva boş görünür'); t.ok(!r.has, 'Devam Et yok');
      t.eq(r.free, 1, 'yeni hayat 1. yuvaya yazılabilir');
      t.ok(!r.loaded && /eski bir sürümüne ait/.test(r.feed), 'doğrudan yüklenmek istenince açılmaz, uyarı verir', r);
    });
  },
};
