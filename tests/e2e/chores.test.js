'use strict';
/* Sully, Bölüm 6: çiftlik işleri. Ambarın önünde iki merdiven (Çatıyı Onar), samanlığın yanında üç balya (ambarın
   kapısına taşınır), güney çitinde iki kırık direk (Direği Çak). Her iş zaman alır, yorar; ambar kapısına bırakılan balya
   bir kez sayılır, başka yere bırakılan sayılmaz; kaybolan balya oyuncu uzaktayken yeniden belirir; yedi işin hepsi bitince
   adım biter ve iş başına ödenir */
module.exports = {
  name: 'Çiftlik işleri',
  timeout: 240000,
  async run(t) {
    const p = await t.newGame({ story: true });
    await p.evaluate(() => { window.__storyFast = true; G.godMode = true; G.eventT = 1e9; G.hunterTick = () => {}; });
    await p.waitForFunction(() => G.story && G.story.ch === 0 && G.story.st >= 0, null, { timeout: 15000 });
    const hay = () => p.evaluate(() => G.ents.filter(e => e.kind === 'crate' && e.g === 'hay' && !e.remove).map(e => ({ x: e.x, y: e.y, c: !!e.counted })));

    await t.step('iş adımı: iki merdiven, iki kırık direk, üç balya yerinde; işaret en yakın işte', async () => {
      await p.evaluate(() => {
        const S = G.story; S.talkQ = null; S.talkCb = null; UI.closeAll();
        S.ch = 5; S.st = 0; S.wait = false; S.n = 0; delete S.chores;
        G.clock = Math.floor(G.clock / 1440) * 1440 + 8 * 60;
        const R = S.ranch; TH.goto(R.x + 10, R.y + 30); G.sullyGo(R.x + 6, R.y - 4);
        G.qNext();
      });
      await p.waitForFunction(() => G.ents.filter(e => e.chKey && !e.remove).length >= 4 && G.ents.filter(e => e.kind === 'crate' && e.g === 'hay').length >= 3, null, { timeout: 8000 });
      const r = await p.evaluate(() => {
        const S = G.story, C = G.choreSpots(S), P = G.player, m = G.questMark();
        const props = G.ents.filter(e => e.chKey && !e.remove).map(e => ({ t: e.type, d: Math.round(Math.min(dist(e.x, e.y, C.barn.door.x, C.barn.door.y), 999)) }));
        const near = G.ents.filter(e => e.chKey && !e.remove).sort((a, b) => dist(a.x, a.y, P.x, P.y) - dist(b.x, b.y, P.x, P.y))[0];
        const bales = G.ents.filter(e => e.kind === 'crate' && e.g === 'hay');
        return { st: S.st, ev: G.qStep().ev, n: G.qStep().n, props, mark: !!m, early: G.sullyActions(G.sullyEnt()).some(a => /Günü Bitir/.test(a.n)), haystack: Math.round(Math.max(...bales.map(b => dist(b.x, b.y, C.hay[0][0], C.hay[0][1])))), inside: bales.some(b => G.world.indoorPx(b.x, b.y)) || G.ents.some(e => e.chKey && G.world.indoorPx(e.x, e.y)) };
      });
      t.ok(r.st === 1 && r.ev === 'chore' && r.n === 7, 'iş adımı: yedi iş', r);
      t.eq(r.props.filter(x => x.t === 'ladder').length, 2, 'iki merdiven');
      t.eq(r.props.filter(x => x.t === 'fencebroken').length, 2, 'iki kırık direk');
      t.ok(r.props.filter(x => x.t === 'ladder').every(x => x.d < 90), 'merdivenler ambarın önünde', r.props);
      t.ok(r.haystack < 80 && !r.inside, 'balyalar samanlıkta, hiçbir şey bina içinde değil', r);
      t.ok(r.mark && !r.early, 'işaret var; günü bitirmek için henüz erken', r);
    });

    await t.step('merdivende Çatıyı Onar: basılı tutulur, zaman alır, yorar, merdiven kalkar', async () => {
      const r = await p.evaluate(() => {
        const S = G.story, P = G.player, e = G.ents.find(x => x.chKey === 'roof0');
        TH.goto(e.x, e.y + 12);
        const it = G.findInteraction(), a = it && it.actions[0];
        const c0 = G.clock, en0 = P.energy;
        G.storyPropActions(e)[0].fn();
        return { name: a && a.n, hold: a && a.hold, dt: G.clock - c0, en: Math.round((en0 - P.energy) * 10) / 10, gone: e.remove, n: S.n };
      });
      t.ok(r.name === 'Çatıyı Onar' && r.hold >= 2, 'istemde basılı tutmalı Çatıyı Onar', r);
      t.ok(r.dt >= 25 && r.en > 2 && r.gone && r.n === 1, 'zaman geçti, yoruldun, iş sayıldı', r);
    });

    await t.step('balya: omza al, işaret ambar kapısını gösterir; başka yere bırakılan sayılmaz, kapıya bırakılan bir kez sayılır', async () => {
      const r = await p.evaluate(() => {
        const S = G.story, C = G.choreSpots(S), b = G.ents.find(e => e.kind === 'crate' && e.g === 'hay' && !e.counted);
        TH.goto(b.x + 6, b.y); G.pickUp(b);
        const m = G.questMark();
        return { carry: !!G.player.carry && G.player.carry.g === 'hay', mark: m && Math.round(dist(m.x, m.y, C.drop.x, C.drop.y)) };
      });
      t.ok(r.carry && r.mark === 0, 'omzunda; işaret ambar kapısında', r);
      // samanlığın yanına bırak: sayılmaz
      await p.evaluate(() => { const C = G.choreSpots(G.story); TH.goto(C.hay[0][0] + 30, C.hay[0][1] + 20); G.dropCarry(); });
      await t.sleep(700);
      t.eq(await p.evaluate(() => G.story.n), 1, 'başka yere bırakılan balya sayılmadı');
      // ambar kapısına bırak
      await p.evaluate(() => { const b = G.ents.filter(e => e.kind === 'crate' && e.g === 'hay' && !e.counted).sort((a, c) => dist(a.x, a.y, G.player.x, G.player.y) - dist(c.x, c.y, G.player.x, G.player.y))[0]; TH.goto(b.x + 6, b.y); G.pickUp(b); const C = G.choreSpots(G.story); TH.goto(C.drop.x, C.drop.y); G.dropCarry(); });
      await p.waitForFunction(() => G.story.n === 2, null, { timeout: 3000 });
      // aynı balyayı kaldırıp yeniden bırakmak ikinci kez sayılmaz
      await p.evaluate(() => { const C = G.choreSpots(G.story), b = G.ents.find(e => e.kind === 'crate' && e.g === 'hay' && e.counted); TH.goto(b.x + 6, b.y); G.pickUp(b); TH.goto(C.drop.x + 8, C.drop.y + 4); G.dropCarry(); });
      await t.sleep(800);
      const q = await p.evaluate(() => ({ n: G.story.n, hay: G.story.chores.hay }));
      t.ok(q.n === 2 && q.hay === 1, 'bir kez sayıldı', q);
    });

    await t.step('kaybolan balya oyuncu uzaktayken samanlıkta yeniden belirir', async () => {
      const r = await p.evaluate(() => { const b = G.ents.find(e => e.kind === 'crate' && e.g === 'hay' && !e.counted); b.remove = true; G.ents = G.ents.filter(e => !e.remove); const C = G.choreSpots(G.story); TH.goto(C.hay[0][0] + 400, C.hay[0][1] + 300); return G.ents.filter(e => e.kind === 'crate' && e.g === 'hay' && !e.counted).length; });
      t.eq(r, 1, 'bir balya eksildi');
      await p.waitForFunction(() => G.ents.filter(e => e.kind === 'crate' && e.g === 'hay' && !e.counted && !e.remove).length === 2, null, { timeout: 3000 });
    });

    await t.step('yedi işin hepsi bitince adım biter, iş başına ödenir; merdivenler ve direkler kalkar', async () => {
      const m0 = await p.evaluate(() => G.player.money);
      await p.evaluate(() => {
        const C = G.choreSpots(G.story);
        for (const e of G.ents.filter(x => x.chKey && !x.remove)) G.storyPropActions(e)[0].fn();
        for (const b of G.ents.filter(e => e.kind === 'crate' && e.g === 'hay' && !e.counted && !e.remove)) { TH.goto(b.x + 6, b.y); G.pickUp(b); TH.goto(C.drop.x + rnd(-10, 10), C.drop.y + rnd(-6, 6)); G.dropCarry(); }
      });
      await p.waitForFunction(() => G.story.ch === 6 || (G.story.ch === 5 && G.story.st > 1), null, { timeout: 20000 });
      const r = await p.evaluate(() => ({ paid: G.story.choresPaid, props: G.ents.filter(e => e.chKey && !e.remove).length }));
      const m1 = await p.evaluate(() => G.player.money);
      t.eq(r.paid, 7, 'yedi iş ödendi');
      t.ok(Math.abs(m1 - m0 - 7 * 0.25) < 0.011, 'iş başına çeyrek dolar', m1 - m0);
      t.eq(r.props, 0, 'merdivenler ve direkler kalktı');
    });
  },
};
