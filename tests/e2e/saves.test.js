'use strict';
/* Kayıt yuvaları, otomatik/manuel kayıt, eski kayıt taşıma ve eski (1024) dünya */
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
      await p.evaluate(() => document.querySelector('#cr-go').click());
      await p.waitForFunction(() => G.state === 'play', null, { timeout: 150000 }); await t.sleep(500);
      const L = await p.evaluate(() => G.slotList().map(s => !!s.auto));
      t.eq(await p.evaluate(() => G.slot), 2, 'yeni hayat 2. yuvada');
      t.eq(L, [true, true, false], 'dolu yuvalar');
    });
    await t.step('Tek Hayat: ölünce yuva silinir', async () => {
      const L = await p.evaluate(() => { G.difficulty = 'hard'; G.saveGame(true); G.playerDied('test'); return G.slotList().map(s => !!(s.auto || s.manual)); });
      t.eq(L, [true, false, false], 'yalnız 1. yuva kalmalı');
    });
    await t.step('eski tek kayıt 1. yuvaya taşınır', async () => {
      await p.evaluate(() => { const d = JSON.parse(Platform.get(slotKey(1, 'auto'))); localStorage.clear(); localStorage.setItem('frontiersend_save_v1', JSON.stringify(d)); });
      await p.reload(); await p.waitForFunction(() => typeof G !== 'undefined' && G.state === 'menu');
      const r = await p.evaluate(() => ({ list: G.slotList().map(s => !!s.auto), old: localStorage.getItem('frontiersend_save_v1') }));
      t.eq(r.list, [true, false, false], 'taşınan kayıt 1. yuvada');
      t.eq(r.old, null, 'eski anahtar silinmeli');
    });
    await t.step('eski (v2, 1024 karelik) kayıt eski dünyada açılır', async () => {
      const r = await p.evaluate(async () => {
        const d = JSON.parse(Platform.get(slotKey(1, 'auto')));
        d.v = 2; delete d.ww; d.reveal = btoa(String.fromCharCode(...new Uint8Array(8192)));
        d.player.x = 500 * 16; d.player.y = 480 * 16; delete d.biz; delete d.haul;
        Platform.set(slotKey(1, 'auto'), JSON.stringify(d));
        await G.loadGame(1, 'auto');
        return { ww: WW, fw: FW, towns: G.world.towns.length, lots: G.world.lots.length, reveal: G.reveal.length, state: G.state };
      });
      t.eq(r.ww, 1024, 'eski dünya boyutu'); t.eq(r.towns, 8, 'eski dünyada 8 kasaba'); t.eq(r.lots, 0, 'eski dünyada arsa yok'); t.eq(r.reveal, 65536, 'keşif haritası boyutu');
    });
    await t.step('1890 fiyat reformu öncesi (v1) kayıtta paralar ölçeklenir', async () => {
      const r = await p.evaluate(async () => {
        G.player.money = 100; G.bank = 200; G.law.bounty = 40; G.saveGame(true);
        const d = JSON.parse(Platform.get(slotKey(G.slot, 'auto'))); d.v = 1; Platform.set(slotKey(G.slot, 'auto'), JSON.stringify(d));
        await G.loadGame(G.slot, 'auto');
        return [G.player.money, G.bank, G.law.bounty];
      });
      t.eq(r.map(v => Math.round(v)), [30, 60, 20], 'para, banka ve ödül yeni ölçekte');
    });
  },
};
