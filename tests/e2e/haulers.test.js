'use strict';
/* Nakliyeciler: işe alma, sefer, yolda araba, baskın, kayıt */
module.exports = {
  name: 'Nakliyeciler',
  async run(t) {
    const p = await t.newGame();
    await t.step('nakliyeci tutulur, stoğu azalan işletmeye mal getirir', async () => {
      const r = await p.evaluate(() => {
        const W = G.world, tw = TH.town('longhorn');
        G.player.money = 3000; G.bank = 200;
        const shop = tw.buildings.find(b => G.bizForSale(b) && BIZ[b.type].goods) || W.buildings.find(b => G.bizForSale(b) && BIZ[b.type].goods);
        G.buyBiz(shop); const z = G.bizOf(shop); z.stock = 0.5;
        const c = G.haulCandidates(tw); const cand = c.find(x => x.trait !== 'coward') || c[0];
        G.hireHauler(cand, tw.buildings.find(b => b.type === 'stable'));
        const h = G.haulers[0]; G.advanceClock(31);
        const planned = h.state;
        let n = 0; for (; n < 400 && !(h.state === 'idle' && z.stock > 1); n++) { G.advanceClock(15); if (h.state === 'raid') { G.raids = []; h.state = 'toBiz'; } }
        return { cands: c.length, planned, stock: z.stock, bankSpent: G.bank < 200, mins: n * 15 };
      });
      t.ok(r.cands > 0, 'iş arayan olmalı'); t.eq(r.planned, 'toSrc', 'nakliyeci mal almaya çıkmalı');
      t.ok(r.stock > 1, 'stok artmalı', r); t.ok(r.bankSpent, 'mal parası bankadan ödenmeli');
    });
    await t.step('oyuncu yakındayken araba yolda görünür ve ilerler', async () => {
      const r = await p.evaluate(() => {
        const h = G.haulers[0], W = G.world, A = TH.town('harlow'), B = TH.town('carverjct');
        const shop = G.bizBuilding(G.biz[0]), wh = B.buildings.find(b => b.type === 'warehouse');
        h.tgt = shop.id; h.src = wh.id; h.g = BIZ[shop.type].goods; h.n = 4; h.trait = 'reliable';
        h.x = A.cx; h.y = A.cy; G.haulGo(h, 'toSrc', wh.door.x, wh.door.y + 10);
        h.ri = Math.floor(h.route.length * 0.4); h.x = h.route[h.ri][0]; h.y = h.route[h.ri][1];
        TH.goto(h.x + 40, h.y + 40); G.advanceClock(0.01);
        window.hx0 = h.x; return { pts: h.route.length, ent: !!h.ent };
      });
      t.ok(r.pts > 20, 'kasabalar arası rota', r.pts); t.ok(r.ent, 'araba yolda olmalı');
      await t.sleep(2500);
      const moved = await p.evaluate(() => { const h = G.haulers[0]; return { d: Math.abs(h.x - hx0) + Math.abs(h.ent ? 0 : 1), ent: !!h.ent, sync: h.ent && Math.abs(h.ent.x - h.x) < 2 }; });
      t.ok(moved.d > 10, 'araba ilerlemeli', moved); t.ok(moved.sync, 'dünyadaki araba rotayla eşleşmeli');
    });
    await t.step('baskına yetişilip haydutlar yenilirse yük kurtulur', async () => {
      const r = await p.evaluate(() => {
        const h = G.haulers[0]; h.cargo = ['dry', 'dry']; h.state = 'toBiz'; const b = G.world.buildings[h.tgt]; G.haulGo(h, 'toBiz', b.door.x, b.door.y);
        G.player.x += 3000; G.haulStartRaid(h); const R = G.raids[0];
        G.advanceClock(30); const waited = h.state;
        G.player.x = R.x + 200; G.player.y = R.y; G.advanceClock(1);
        const spawned = R.bandits.length; for (const bn of R.bandits) bn.hurt(9999, 'player', 'gun'); G.advanceClock(1);
        return { waited, spawned, left: G.raids.length, cargo: h.cargo.length, st: h.state };
      });
      t.eq(r.waited, 'raid', 'nakliyeci baskında beklemeli'); t.ok(r.spawned >= 1, 'haydutlar belirmeli'); t.eq(r.left, 0, 'baskın kapanmalı'); t.eq(r.cargo, 2, 'yük kurtulmalı');
    });
    await t.step('yetişilemeyen baskın kapanır; maaş ödenmezse nakliyeci bırakır', async () => {
      const r = await p.evaluate(() => {
        const h = G.haulers[0]; h.trait = 'fast'; h.cargo = ['dry']; h.state = 'toBiz'; G.player.x += 6000;
        const rr = Math.random; Math.random = () => 0.99; G.haulStartRaid(h); G.advanceClock(200); Math.random = rr;
        const after = { raids: G.raids.length, st: h.state, cargo: h.cargo.length };
        G.bank = 0; G.player.money = 0; G.haulDaily(); G.haulDaily();
        return { after, left: G.haulers.length };
      });
      t.eq(r.after.raids, 0, 'baskın zaman aşımıyla kapanmalı'); t.eq(r.after.cargo, 0, 'yük gitmeli'); t.eq(r.after.st, 'rest', 'nakliyeci yaralı dinlenmeli');
      t.eq(r.left, 0, 'iki gün maaş alamayan bırakmalı');
    });
    await t.step('nakliyeci kayıtla korunur', async () => {
      const r = await p.evaluate(async () => {
        G.player.money = 100; const tw = TH.town('longhorn'); G.hireHauler(G.haulCandidates(tw)[0], tw.buildings.find(b => b.type === 'stable'));
        const n = G.haulers.length; G.saveGame(true); await G.loadGame(G.slot, 'auto');
        return { n, after: G.haulers.length, name: G.haulers[0] && G.haulers[0].name };
      });
      t.eq(r.after, r.n, 'nakliyeci sayısı'); t.ok(r.name, 'ad korunmalı');
    });
  },
};
