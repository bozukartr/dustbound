'use strict';
/* Ödül avcıları: çıkış koşulları, yaklaşma, parayla kurtulma, çatışma, teslim olma */
module.exports = {
  name: 'Ödül avcıları',
  async run(t) {
    const p = await t.newGame();
    const setup = (bounty) => p.evaluate((bounty) => {
      UI.closeAll(); if (G.posse) { for (const e of G.posse.ents) e.remove = true; G.posse = null; }
      const tw = TH.town('harlow'), s = TH.openSpot(tw.cx + 1400, tw.cy + 300, 120); TH.goto(s[0], s[1]); TH.clearNpcs();
      Object.assign(G.law, { level: 0, bounty, maskBounty: 0, hunterNext: G.clock - 1 }); G.reports = [];
      const P = G.player; P.hp = P.maxHp; P.money = 200; G.godMode = true;
      // olasılık zarını hileyle at: ilk kontrolde grup çıksın
      G._huntChk = 0; const r = Math.random; Math.random = () => 0.001; G.hunterTick(0.016); Math.random = r;
      return G.posse ? { n: G.posse.ents.length, phase: G.posse.phase } : null;
    }, bounty);
    await t.step('ödül düşükse ya da kasabadaysan avcı çıkmaz', async () => {
      t.eq(await setup(10), null, 'düşük ödülde grup çıkmamalı');
      const inTown = await p.evaluate(() => { const tw = TH.town('harlow'); TH.goto(tw.spawn.x, tw.spawn.y); Object.assign(G.law, { bounty: 100, hunterNext: G.clock - 1 }); G._huntChk = 0; const r = Math.random; Math.random = () => 0.001; G.hunterTick(0.016); Math.random = r; return !!G.posse; });
      t.ok(!inTown, 'kasabada grup çıkmamalı');
    });
    await t.step('ödül yüksekken kasaba dışında grup çıkar, yaklaşıp seslenir', async () => {
      const r = await setup(80);
      t.ok(r, 'grup çıkmalı'); t.eq(r.n, 3, '80$ ödülde 3 avcı'); t.eq(r.phase, 'approach', 'önce yaklaşırlar');
      await p.waitForFunction(() => G.posse && G.posse.phase === 'standoff', null, { timeout: 30000 });
      const s = await p.evaluate(() => { const L = G.posse.ents[0]; return { d: dist(L.x, L.y, G.player.x, G.player.y), hostile: G.posse.ents.some(e => e.hostile), acts: TH.actions() }; });
      t.ok(s.d < 140, 'lider yanına gelmeli', s.d); t.ok(!s.hostile, 'bekleyişte ateş etmezler');
      await p.evaluate(() => { const L = G.posse.ents[0]; G.player.x = L.x - 14; G.player.y = L.y; G.player.ang = 0; });
      const acts = await p.evaluate(() => TH.actions());
      t.ok(acts.some(a => /Teslim Ol/.test(a)) && acts.some(a => /Parayla Kurtul/.test(a)), 'teslim ve para seçenekleri', acts);
    });
    await t.step('parayla kurtulunca giderler, ödül başında kalır', async () => {
      const r = await p.evaluate(() => { const m0 = G.player.money; const a = G.hunterActions(G.posse.ents[0]).find(x => /Parayla Kurtul/.test(x.n)); const ok = !!a; if (a) a.fn(); return { ok, paid: m0 - G.player.money, phase: G.posse && G.posse.phase, bounty: G.law.bounty }; });
      t.ok(r.ok, 'seçenek çalışmalı'); t.near(r.paid, 48, 0.01, 'ödülün %60\'ı'); t.eq(r.phase, 'leave', 'grup ayrılmalı'); t.eq(r.bounty, 80, 'ödül başında kalmalı');
      await p.evaluate(() => { G.player.x += 2000; }); await t.sleep(400);
      t.ok(await p.evaluate(() => !G.posse), 'uzaklaşınca grup kaybolmalı');
    });
    await t.step('onlara nişan alınca ateş açarlar; öldürmek suç değildir', async () => {
      await setup(200);
      await p.waitForFunction(() => G.posse && G.posse.phase === 'standoff', null, { timeout: 30000 });
      const n = await p.evaluate(() => G.posse.ents.length);
      t.eq(n, 4, '200$ ödülde 4 avcı');
      // gerçek girdiyle: fareyi liderin üstüne getir, sağ tuşla nişan al
      const sc = await p.evaluate(() => { const P = G.player; P.giveWeapon('cattleman', true); P.weapon = 'cattleman'; const L = G.posse.ents[0]; return { x: (L.x - G.cam.ox) * G.scale, y: (L.y - G.cam.oy) * G.scale }; });
      await p.mouse.move(sc.x, sc.y); await p.mouse.down({ button: 'right' });
      await p.waitForFunction(() => G.posse && G.posse.phase === 'fight', null, { timeout: 8000 }).finally(() => p.mouse.up({ button: 'right' }));
      t.ok(await p.evaluate(() => G.posse.ents.every(e => e.hostile && e.aggro)), 'hepsi düşman olmalı');
      const r = await p.evaluate(() => { for (const e of G.posse.ents) e.hurt(9999, 'player', 'gun'); G.hunterTick(0.016); return { posse: !!G.posse, lvl: G.law.level, bounty: G.law.bounty, beaten: G.stats.huntersBeaten }; });
      t.ok(!r.posse, 'grup bitmeli'); t.eq(r.lvl, 0, 'aranma başlamamalı'); t.eq(r.bounty, 200, 'ödül artmamalı'); t.eq(r.beaten, 1, 'istatistik');
    });
    await t.step('teslim olunca tutuklama menüsü; ceza ödenince grup gider', async () => {
      await setup(40);
      await p.waitForFunction(() => G.posse && G.posse.phase === 'standoff', null, { timeout: 30000 });
      await p.evaluate(() => { G.hunterActions(G.posse.ents[0]).find(x => /Teslim Ol/.test(x.n)).fn(); });
      await t.sleep(300);
      t.ok(await p.evaluate(() => TH.menuLabels().some(x => /Cezayı Öde/.test(x))), 'tutuklama menüsü açılmalı');
      await p.evaluate(() => TH.clickItem(/Cezayı/)); await t.sleep(300);
      const r = await p.evaluate(() => ({ bounty: G.law.bounty, phase: G.posse && G.posse.phase }));
      t.eq(r.bounty, 0, 'ödül silinmeli'); t.eq(r.phase, 'leave', 'grup ayrılmalı');
    });
    await t.step('bekleyiş süresi dolunca çatışma başlar', async () => {
      await setup(60);
      await p.waitForFunction(() => G.posse && G.posse.phase === 'standoff', null, { timeout: 30000 });
      await p.evaluate(() => { G.posse.warnT = 0.2; });
      await p.waitForFunction(() => G.posse && G.posse.phase === 'fight', null, { timeout: 5000 });
    });
  },
};
