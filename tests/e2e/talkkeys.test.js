'use strict';
/* Kişiyle konuşma tuşları: E selam, Q (Odak tuşu, nişan almıyorken) kışkırt. Kışkırtma E'nin seçeneklerinde yok;
   kanun adamında ve at üstünde Q kışkırtmaz; nişan alırken Q Odak'tır */
module.exports = {
  name: 'Konuşma tuşları: E selam, Q kışkırt',
  async run(t) {
    const p = await t.newGame();
    await p.evaluate(() => {
      UI.closeAll(); G.godMode = true; G.eventT = 1e9; G.travelT = 1e9;
      window.KT = {
        // açık bir yerde, oyuncunun önüne (doğuya) kımıldamayan biri
        put(role, opts = {}) {
          const s = TH.openSpot(); TH.goto(s[0], s[1]); TH.clearNpcs();
          const P = G.player, n = new NPC(P.x + 16, P.y, role, Object.assign({ sex: 'f' }, opts));
          n.state = 'idle'; n.update = function () {}; G.addEnt(n); P.ang = 0; P.aiming = false;
          return n;
        },
        lines() { return [...document.querySelectorAll('#prompts .prompt')].map(e => e.textContent); },
      };
    });

    await t.step('yayayken kişinin önünde E Selamla, Q Kışkırt; Q ile kışkırtılır', async () => {
      await p.evaluate(() => { window.N = KT.put('town'); G.honor = 0; });
      await t.sleep(300);
      const r = await p.evaluate(() => ({ lines: KT.lines(), acts: G.findInteraction().actions.map(a => a.n) }));
      t.ok(r.acts.includes('Selamla') && r.acts.includes('Kışkırt'), 'eylemler', r.acts);
      t.ok(r.lines.some(l => /Selamla$/.test(l)) && r.lines.some(l => /^Q.*Kışkırt$/.test(l)), 'istemde E Selamla ve Q Kışkırt', r.lines);
      t.ok(!r.lines.some(l => /Seçenekler/.test(l)), 'başka seçenek yokken seçenekler satırı yok', r.lines);
      await p.keyboard.press('KeyQ'); await t.sleep(250);
      const q = await p.evaluate(() => ({ honor: G.honor, sub: (document.getElementById('subtitle') || {}).textContent || '', state: N.state, de: !!G.player.deadeye }));
      t.near(q.honor, -0.5, 0.001, 'kışkırtma onuru biraz düşürür');
      t.ok(/: /.test(q.sub) && !q.de, 'laf atılır ve karşılık gelir (altyazı), Odak açılmaz', q);
      t.ok(q.state === 'flee' || q.state === 'fightFist', 'kişi tepki verir', q.state);
    });

    await t.step('E basılı tutunca açılan seçeneklerde kışkırtma yok (atlı yolcu: Selamla, Attan İndir)', async () => {
      await p.evaluate(() => { window.N = KT.put('traveler', { mounted: true }); });
      await t.sleep(300);
      await p.keyboard.down('KeyE'); await t.sleep(600); await p.keyboard.up('KeyE'); await t.sleep(200);
      const labels = await p.evaluate(() => { const l = TH.menuLabels(); UI.closeAll(); return l; });
      t.ok(labels.includes('Selamla') && labels.includes('Attan İndir') && !labels.includes('Kışkırt'), 'menüde kışkırtma yok', labels);
    });

    await t.step('kanun adamında Q satırı yok, Q kışkırtmaz (Odak uyarısı)', async () => {
      await p.evaluate(() => { window.N = KT.put('law', { sex: 'm' }); G.honor = 0; TH.feeds.length = 0; });
      await t.sleep(300);
      const lines = await p.evaluate(() => KT.lines());
      t.ok(!lines.some(l => /Kışkırt/.test(l)), 'kışkırt satırı yok', lines);
      await p.keyboard.press('KeyQ'); await t.sleep(200);
      const r = await p.evaluate(() => ({ honor: G.honor, feeds: TH.feeds.slice() }));
      t.ok(r.honor === 0 && r.feeds.some(f => /Odak için önce nişan al/.test(f)), 'kışkırtma yok, Odak uyarısı', r);
    });

    await t.step('nişan alırken Q Odak açar, kışkırtmaz', async () => {
      await p.evaluate(() => { window.N = KT.put('town'); G.honor = 0; const P = G.player; P.giveWeapon('cattleman', true); P.weapon = 'cattleman'; P.clip.cattleman = 6; P.de = 100; });
      await p.mouse.move(900, 360); await p.mouse.down({ button: 'right' }); await t.sleep(300);
      await p.keyboard.press('KeyQ'); await t.sleep(200);
      const r = await p.evaluate(() => ({ de: !!G.player.deadeye, honor: G.honor }));
      await p.mouse.up({ button: 'right' }); await t.sleep(200);
      await p.evaluate(() => { G.player.deadeye = false; G.player.weapon = 'fists'; });
      t.ok(r.de && r.honor === 0, 'Odak açıldı, kışkırtma yok', r);
    });

    await t.step('at üstünde Q kışkırtmaz (selam basılı tutunca açılan seçeneklerde)', async () => {
      await p.evaluate(() => { window.N = KT.put('town'); G.honor = 0; const P = G.player, h = G.horse; h.dead = false; h.x = P.x; h.y = P.y; h.ang = 0; P.mount(h, true); h.spd = 0; P.ang = 0; });
      await t.sleep(300);
      const lines = await p.evaluate(() => KT.lines());
      await p.keyboard.press('KeyQ'); await t.sleep(200);
      const r = await p.evaluate(() => { const o = { honor: G.honor, riding: !!G.player.riding }; G.player.dismount(); return o; });
      t.ok(!lines.some(l => /Kışkırt/.test(l)) && lines.some(l => /Selamla: /.test(l)), 'istemde kışkırt yok, selam seçeneklerde', lines);
      t.ok(r.honor === 0 && r.riding, 'kışkırtma yok, attan inilmedi', r);
    });
  },
};
