'use strict';
/* Kanun kaçağı başlangıcı: kasabada değil saklı kampta başlar, kanun adamları tanımaz */
module.exports = {
  name: 'Kanun kaçağı başlangıcı',
  async run(t) {
    const p = await t.page({ story: true });
    await t.step('karakter ekranında Kanun Kaçağı: başlangıç saklı kamp; hikâye kapalı da seçilebilir', async () => {
      await t.sleep(300); await p.keyboard.press('Enter'); await t.sleep(500);
      const r = await p.evaluate(() => {
        document.querySelectorAll('.cr-tab')[3].click();
        const card = [...document.querySelectorAll('.cr-card')].find(n => n.dataset.bg === 'outlaw'); card.click();
        const facts = document.querySelector('.cr-facts').textContent;
        const row = () => [...document.querySelectorAll('.opt')].find(n => /Hikâyeli/.test(n.textContent));
        const on = row().textContent; row().click();
        return { facts, on, story: row().textContent };
      });
      t.ok(/Saklı Kamp/.test(r.facts), 'başlangıç: saklı kamp', r.facts);
      t.ok(/Açık/.test(r.on), 'kanun kaçağının hikâyesi var', r.on); t.ok(/Kapalı/.test(r.story), 'hikâye kapatıldı', r.story);
      await p.evaluate(() => { for (let k = 0; k < 8 && document.querySelector('#cr-go'); k++) document.querySelector('#cr-go').click(); });
      await p.waitForFunction(() => G.state === 'play', null, { timeout: 150000 });
      await t.sleep(600); await t.helpers(p);
    });
    await t.step('saklı kampta başlar: kasaba dışı, ateş yanıyor, haritada işaretli, bandana ve tulum var', async () => {
      const r = await p.evaluate(() => {
        const P = G.player, W = G.world, H = G.hideout, tw = W.towns.find(t => t.id === 'dustcreek');
        return {
          bg: G.background, hid: !!H, inTown: !!W.townAt(P.x, P.y, 20), dTown: Math.round(dist(P.x, P.y, tw.cx, tw.cy)),
          camp: !!(G.camp && dist(G.camp.x, G.camp.y, P.x, P.y) < 60), poi: W.pois.some(q => q.id === 'hideout') && G.discovered.has('hideout'),
          bounty: G.law.bounty, mask: P.has('mask_bandana'), bed: P.has('bedroll'), horse: !!(G.horse && dist(G.horse.x, G.horse.y, P.x, P.y) < 80),
          campNear: W.pois.filter(q => q.kind === 'camp').reduce((m, q) => Math.min(m, dist(q.x, q.y, P.x, P.y)), 1e9), story: G.story,
        };
      });
      t.eq(r.bg, 'outlaw', 'kanun kaçağı'); t.ok(r.hid && !r.inTown && r.dTown > 900, 'kasabanın dışında', r);
      t.ok(r.camp, 'kamp ateşi yanında'); t.ok(r.poi, 'haritada Saklı Kamp');
      t.eq(r.bounty, 20, 'ödül duruyor'); t.ok(r.mask && r.bed, 'bandana ve uyku tulumu');
      t.ok(r.horse, 'atı yanında'); t.ok(r.campNear > 1200, 'haydut kamplarından uzak', r.campNear);
      t.eq(r.story, null, 'hikâye kapalı: kampta yine başlar');
    });
    await t.step('kampta beklerken kimse tanımaz; kasabada bandanayla da tanınmaz', async () => {
      const r = await p.evaluate(async () => {
        await new Promise(res => setTimeout(res, 3000));
        const atCamp = G.law.level;
        const tw = TH.town('dustcreek'); TH.goto(tw.spawn.x, tw.spawn.y); TH.clearNpcs();
        G.toggleMask('mask_bandana');
        const law = new NPC(G.player.x + 30, G.player.y, 'law', {}); law.state = 'static'; G.addEnt(law);
        await new Promise(res => setTimeout(res, 8000));
        return { atCamp, masked: G.player.masked, inTown: G.law.level };
      });
      t.eq(r.atCamp, 0, 'kampta aranma yok'); t.ok(r.masked, 'bandana takılı'); t.eq(r.inTown, 0, 'bandanayla kasabada tanınmadı');
    });
    await t.step('kayıt ve yüklemede saklı kamp yerinde kalır', async () => {
      const before = await p.evaluate(() => ({ x: G.hideout.x, y: G.hideout.y }));
      await p.evaluate(async () => { G.saveGame(true); await G.loadGame(); });
      await p.waitForFunction(() => G.state === 'play', null, { timeout: 60000 });
      const r = await p.evaluate(() => ({ h: G.hideout, poi: G.world.pois.filter(q => q.id === 'hideout').length, camp: !!G.camp && dist(G.camp.x, G.camp.y, G.hideout.x, G.hideout.y) < 30 }));
      t.ok(r.h && r.h.x === before.x && r.h.y === before.y, 'aynı yer', r); t.eq(r.poi, 1, 'tek işaret'); t.ok(r.camp, 'ateş yeniden yanar');
    });
  },
};
