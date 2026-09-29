'use strict';
/* Açılış, karakter oluşturma, dünya üretimi, temel kontroller */
module.exports = {
  name: 'Açılış, yeni oyun ve dünya',
  async run(t) {
    const p = await t.page();
    await t.step('ana menü: kayıt yokken Devam Et görünmez', async () => {
      const items = await p.evaluate(() => [...document.querySelectorAll('#mm-items .mm-item')].map(n => n.dataset.id));
      t.ok(items.includes('new') && items.includes('set'), 'ana menüde Yeni Hayat ve Ayarlar olmalı', items);
      t.ok(!items.includes('cont') && !items.includes('load'), 'kayıt yokken Devam Et / Kayıt Yükle olmamalı', items);
    });
    await t.step('karakter ekranı açılır, oyun başlar', async () => {
      await p.keyboard.press('Enter'); await t.sleep(500);
      t.ok(await p.evaluate(() => !!document.querySelector('.create')), 'karakter oluşturma ekranı açılmalı');
      await t.newGame({ page: p });
      const s = await p.evaluate(() => ({ state: G.state, slot: G.slot, town: G.curTown, hud: !document.getElementById('hud').classList.contains('hidden') }));
      t.eq(s.state, 'play', 'oyun durumu');
      t.eq(s.slot, 1, 'ilk hayat 1. yuvaya yazılır');
      t.ok(s.hud, 'HUD görünür olmalı');
    });
    await t.step('dünya: 13 kasaba, eksiksiz binalar, istasyonlar, arsalar', async () => {
      const r = await p.evaluate(() => {
        const W = G.world, out = { ww: WW, towns: W.towns.length, missing: [], noStation: [], lots: W.lots.length };
        for (const tw of W.towns) {
          const have = tw.buildings.map(b => b.type);
          for (const x of [...tw.b, ...(tw.xb || [])]) { const i = have.indexOf(x); if (i >= 0) have.splice(i, 1); else out.missing.push(tw.id + ':' + x); }
          if (RAIL_LINES.filter(inWorld).some(l => l.includes(tw.id)) && !tw.station) out.noStation.push(tw.id);
        }
        return out;
      });
      t.eq(r.ww, 1536, 'yeni oyun dünya boyutu');
      t.eq(r.towns, 13, 'kasaba sayısı');
      t.eq(r.missing, [], 'eksik bina olmamalı');
      t.eq(r.noStation, [], 'raylı her kasabada istasyon olmalı');
      t.ok(r.lots >= 10, 'kasabalarda satılık arsalar olmalı', r.lots);
    });
    await t.step('yeni bina türlerinin içine girilir, tezgâhta biri çalışır', async () => {
      const r = await p.evaluate(() => {
        const out = [];
        G.clock = Math.floor(G.clock / 1440) * 1440 + 11 * 60;
        for (const type of ['bakery', 'smith', 'pharmacy', 'laundry', 'gambling', 'brewery', 'mill', 'county', 'post', 'warehouse', 'cantina']) {
          const b = G.world.buildings.find(x => x.type === type);
          if (!b) { out.push(type + ': yok'); continue; }
          const tw = G.world.towns.find(x => x.id === b.town);
          TH.inside(b); G.spawnTick(); G.townStaff(tw);
          if (G.world.buildingAtPx(G.player.x, G.player.y) !== b) out.push(type + ': içine girilemedi');
          else if (!b.enter) out.push(type + ': iç mekân yok');
          else if (!b.staffNpc) out.push(type + ': çalışan yok');
        }
        return out;
      });
      t.eq(r, [], 'bütün yeni binalar girilebilir ve personelli olmalı');
    });
    await t.step('klavye ile yürüme', async () => {
      await p.evaluate(() => { const s = TH.openSpot(); TH.goto(s[0], s[1]); });
      await t.sleep(300);
      const x0 = await p.evaluate(() => G.player.x);
      await p.keyboard.down('KeyD'); await t.sleep(700); await p.keyboard.up('KeyD');
      const dx = await p.evaluate((x0) => G.player.x - x0, x0);
      t.ok(dx > 20, 'oyuncu sağa yürümeli', dx);
    });
    await t.step('duraklatma menüsü ve harita açılıp kapanır', async () => {
      await p.keyboard.press('Escape'); await t.sleep(300);
      t.ok(await p.evaluate(() => UI.isModal() && UI.top().el.classList.contains('pause')), 'Esc duraklatma menüsünü açmalı');
      await p.keyboard.press('Escape'); await t.sleep(300);
      t.ok(await p.evaluate(() => !UI.isModal()), 'Esc menüyü kapatmalı');
      await p.keyboard.press('KeyM'); await t.sleep(500);
      t.ok(await p.evaluate(() => !document.getElementById('mapscreen').classList.contains('hidden')), 'M haritayı açmalı');
      await p.keyboard.press('Escape'); await t.sleep(300);
      t.ok(await p.evaluate(() => document.getElementById('mapscreen').classList.contains('hidden')), 'Esc haritayı kapatmalı');
    });
  },
};
