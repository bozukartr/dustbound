'use strict';
/* Görev konuşmaları: Enter/Boşluk ya da (önünde etkileşim yokken) etkileşim tuşuyla satır geçilir, basılı tutunca
   konuşmanın tamamı geçilir ve sıradaki hedef hemen gelir. Konuşma sürerken görev satırında "…" değil sıradaki hedef
   görünür; bu sırada yapılanlar o hedefte sayılır. */
module.exports = {
  name: 'Görev konuşmasını geçme',
  async run(t) {
    const p = await t.newGame({ story: true });
    const S = () => p.evaluate(() => { const s = G.story; return { ch: s.ch, st: s.st, n: s.n, wait: s.wait, talking: G.storyTalking(), q: s.talkQ ? s.talkQ.length : -1 }; });
    const hud = () => p.evaluate(() => { const o = document.querySelector('#hud-quest .hq-o'); return { txt: o ? o.textContent : '', done: !!(o && o.classList.contains('done')), all: document.getElementById('hud-quest').textContent }; });
    await p.waitForFunction(() => G.story && G.story.ch === 0 && G.story.st === 0 && !G.story.wait && !G.storyTalking(), null, { timeout: 30000 });
    await p.evaluate(() => UI.el.help.classList.add('hidden'));

    await t.step('Sully ile konuşurken görev satırında sıradaki hedef görünür ("…" değil, üstü çizili değil)', async () => {
      const ok = await p.evaluate(() => { const e = G.sullyEnt(); const a = G.sullyActions(e).find(x => x.n === Tr('Konuş')); if (!a) return false; a.fn(); return true; });
      t.ok(ok, 'Konuş seçeneği');
      await t.sleep(300);
      const s = await S(), h = await hud();
      const next = await p.evaluate(() => G.qCh().steps[1].t.call(G, G.story));
      t.ok(s.wait && s.talking && s.st === 0, 'konuşma sürüyor, adım henüz bitmedi', s);
      t.ok(h.txt.includes(next) && !h.done && !/…/.test(h.txt), 'sıradaki hedef görünüyor', h);
      t.eq(await p.evaluate(() => G.sullyActions(G.sullyEnt()).length), 0, 'konuşma sürerken Sully ile etkileşim yok (tuş konuşmayı geçer)');
      t.ok(await p.evaluate(() => /Geç/.test(document.getElementById('subtitle').textContent)), 'altyazıda geçme ipucu');
    });

    await t.step('Enter\'a dokununca satır geçer (beklemeden)', async () => {
      const q0 = (await S()).q;
      await p.keyboard.press('Enter'); await t.sleep(150);
      const q1 = (await S()).q;
      t.eq(q1, q0 - 1, 'bir satır geçti');
    });

    await t.step('konuşma sürerken yapılan iş (selamlaşma) sıradaki hedefte sayılır; basılı tutunca konuşmanın hepsi geçer, hedef hemen gelir', async () => {
      // konuşma bitmeden bir kasabalıyı selamla
      await p.evaluate(() => { const P = G.player; const e = G.ents.filter(e => e.kind === 'npc' && !e.quest && !e.dead && !e.hostile && e.role !== 'law').sort((a, b) => dist(a.x, a.y, P.x, P.y) - dist(b.x, b.y, P.x, P.y))[0]; G.greet(e); });
      const t0 = Date.now();
      await p.keyboard.down('Enter'); await t.sleep(900); await p.keyboard.up('Enter');
      await p.waitForFunction(() => G.story.st === 1 && !G.story.wait, null, { timeout: 4000 });
      const s = await S(), h = await hud();
      t.ok(Date.now() - t0 < 3000, 'beklemeden sıradaki adım', Date.now() - t0);
      t.eq(s.n, 1, 'konuşma sırasındaki selamlaşma sayıldı');
      t.ok(!h.done && /selamla/i.test(h.txt), 'görev satırı yeni hedef', h);
    });

    await t.step('önünde etkileşim yokken etkileşim tuşu (E) da satırı geçer', async () => {
      await p.evaluate(() => {
        // oyuncuyu boş bir yere al ve Sully'ye kısa bir konuşma söylet
        const s = TH.openSpot(); TH.goto(s[0], s[1]); TH.clearNpcs();
        G.qSay([['S', Tr('Bir.')], ['S', Tr('İki.')], ['S', Tr('Üç.')]]);
      });
      await t.sleep(400);
      const r0 = await p.evaluate(() => ({ q: G.story.talkQ.length, it: !!UI.curInteract }));
      await p.keyboard.press('KeyE'); await t.sleep(150);
      const q1 = await p.evaluate(() => G.story.talkQ ? G.story.talkQ.length : 0);
      t.ok(!r0.it, 'önünde etkileşim yok', r0);
      t.eq(q1, r0.q - 1, 'E ile bir satır geçti');
      await p.keyboard.down('KeyE'); await t.sleep(900); await p.keyboard.up('KeyE');
      t.ok(await p.evaluate(() => !G.storyTalking()), 'basılı tutunca konuşma bitti');
    });

    await t.step('bölüm başı konuşmasında görev satırı "…" yerine bölümün ilk hedefini gösterir', async () => {
      await p.evaluate(() => { G.story.wait = false; G.qChapter(2); });
      await t.sleep(250);
      const s = await S(), h = await hud();
      const first = await p.evaluate(() => G.storyDef().chapters[2].steps[0].t.call(G, G.story));
      t.ok(s.ch === 2 && s.st === -1 && s.talking, 'bölüm 3 açılış konuşması sürüyor', s);
      t.ok(h.txt.includes(first) && !/…/.test(h.txt), 'ilk hedef görünüyor', h);
      await p.keyboard.down('Space'); await t.sleep(900); await p.keyboard.up('Space');
      await p.waitForFunction(() => G.story.ch === 2 && G.story.st === 0 && !G.story.wait, null, { timeout: 4000 });
      t.ok(true, 'Boşluk ile geçildi, ilk adım başladı');
    });
  },
};
