'use strict';
/* Devam Et: dünya kaldığı gibi geri gelir (NPC'ler, hayvanlar, cesetler, arabalar, yerdeki eşyalar) */
module.exports = {
  name: 'Kaldığı yerden devam',
  timeout: 300000,
  async run(t) {
    const p = await t.newGame();
    let before;
    await t.step('kayıt anındaki dünya saklanır', async () => {
      before = await p.evaluate(() => {
        UI.closeAll(); G.godMode = true;
        const tw = TH.town('harlow'); TH.goto(tw.spawn.x, tw.spawn.y);
        G.clock = Math.floor(G.clock / 1440) * 1440 + 1440 + 11 * 60;
        for (let f = 0; f < 30 * 8; f++) G.update(1 / 30);
        const P = G.player;
        // yere ceset, post, sandık; yanına bir geyik ve kasabanın girişine bir araba
        const dead = new NPC(P.x + 30, P.y + 20, 'traveler', { name: 'Ölü Adam' }); dead.dead = true; dead.hp = 0; dead.state = 'dead'; dead.deadT = 12; G.addEnt(dead);
        G.addEnt(new Pelt(P.x - 25, P.y + 15, 'deer_hide', 2));
        G.addEnt(new Crate(P.x - 10, P.y + 30, Object.keys(GOODS)[0]));
        const deer = new Animal(P.x + 60, P.y - 40, 'deer'); deer.dead = true; deer.hp = 0; deer.state = 'dead'; G.addEnt(deer);
        const road = G.world.roads.filter(r => !r.spur && r.pts.length > 10)[0];
        const w = new Wagon(road, 5, 1, true); G.addEnt(w);
        const snap = () => G.ents.filter(e => !G.skipEnt(e)).map(e => ({ k: e.kind, name: e.kind === 'pelt' ? e.id : (e.name || e.type || e.g), x: e.x, y: e.y, dead: !!e.dead, res: e.res ? e.res.id : null, state: e.state }));
        G.saveGame(true);
        return { list: snap(), P: [P.x, P.y], clock: G.clock };
      });
      t.ok(before.list.filter(e => e.k === 'npc').length > 10, 'kasabada NPC var', before.list.length);
    });
    await t.step('Devam Et ile aynı yerde, aynı kişiler ve aynı durumlar', async () => {
      await p.evaluate(() => { UI.closeAll(); G.state = 'menu'; G.ents = []; return G.loadGame(); });
      await p.waitForFunction(() => G.state === 'play', null, { timeout: 120000 });
      const after = await p.evaluate(() => G.ents.filter(e => !G.skipEnt(e)).map(e => ({ k: e.kind, name: e.kind === 'pelt' ? e.id : (e.name || e.type || e.g), x: e.x, y: e.y, dead: !!e.dead, res: e.res ? e.res.id : null })));
      const near = (a) => after.find(b => b.k === a.k && b.name === a.name && Math.hypot(b.x - a.x, b.y - a.y) < 2);
      const lost = before.list.filter(a => !near(a));
      t.ok(lost.length <= Math.ceil(before.list.length * 0.05), 'varlıkların neredeyse hepsi yerinde', { total: before.list.length, lost: lost.slice(0, 8) });
      const res = before.list.filter(a => a.k === 'npc' && a.res);
      t.ok(res.every(a => after.some(b => b.res === a.res && Math.hypot(b.x - a.x, b.y - a.y) < 2)), 'kasaba sakinleri kayıtlarına bağlı');
      for (const [k, n] of [['npc', 'Ölü Adam'], ['animal', 'deer'], ['pelt', 'deer_hide'], ['wagon', null]]) t.ok(after.some(b => b.k === k && (!n || b.name === n)), `${k} geri geldi`);
      t.ok(after.find(b => b.name === 'Ölü Adam').dead, 'ceset ceset olarak kalır');
      const dup = after.filter(b => b.res).map(b => b.res);
      t.eq(dup.length, new Set(dup).size, 'aynı sakin iki kez doğmaz');
    });
    await t.step('birkaç saniye sonra da kopya doğmaz, kasaba yaşamaya devam eder', async () => {
      await t.sleep(3000);
      const r = await p.evaluate(() => {
        const ids = G.ents.filter(e => e.kind === 'npc' && e.res && !e.remove).map(e => e.res.id);
        const law = G.ents.filter(e => e.kind === 'npc' && e.role === 'law' && !e.remove).length;
        return { ids: ids.length, uniq: new Set(ids).size, law, moving: G.ents.filter(e => e.kind === 'npc' && e.res && e.mv > 0.1).length };
      });
      t.eq(r.ids, r.uniq, 'kopya sakin yok');
      t.ok(r.law <= 3, 'kanun adamları ikiye katlanmaz', r.law);
    });
    await t.step('sekme kapanırken (pagehide) kaldığı yer kaydedilir', async () => {
      const r = await p.evaluate(async () => {
        const k = G.latestSave(), t0 = k.meta.savedAt;
        await new Promise(res => setTimeout(res, 20));
        G.player.x += 3;
        window.dispatchEvent(new Event('pagehide'));
        const k2 = G.latestSave();
        const d = JSON.parse(Platform.get(slotKey(k2.n, k2.kind)) || 'null');
        return { newer: k2.meta.savedAt > t0, px: d && Math.abs(d.player.x - G.player.x) < 0.01, ents: d && d.world && d.world.ents.length };
      });
      t.ok(r.newer, 'kayıt yenilendi', r); t.ok(r.px, 'son konum kayıtta', r); t.ok(r.ents > 10, 'dünya anlık görüntüsü kayıtta', r);
    });
  },
};
