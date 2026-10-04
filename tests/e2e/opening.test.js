'use strict';
/* Açılış sinematikleri: beş geçmişin sahnesi hatasız çizilir (boş değil, gölge açık, GL hatası yok),
   hikâye açıkken akıl hocası ve satırlar, kapalıyken satırsız; yeni oyunda sinematik oynar, geçilir, hikâye başlar */
module.exports = {
  name: 'Açılış sinematikleri',
  timeout: 420000,
  async run(t) {
    const BGS = ['farm', 'outlaw', 'immigrant', 'rail', 'trapper'];
    const p = await t.page({ cine: true });
    // bir sahneyi verilen anda dondurup çiz, istatistikleri ve ekrandaki yazıları oku, sonra geç
    const shot = (bg, at, story) => p.evaluate(async ([bg, at, story]) => {
      const D = story ? STORIES[STORY_FOR_BG[bg]] : null, look = randomLook('f', new RNG(5));
      let tt = 0;
      const lines = D && D.opening ? D.opening().map(([w, x]) => { const o = { t: tt, d: 2.5, w, x, raw: x }; tt += 2.8; return o; }) : null;
      const pr = Cinema.play(bg, { look, seed: 77, freeze: at, story, sully: D && D.mentor.look, lines, probe: true });
      for (let k = 0; k < 3; k++) await new Promise(r => requestAnimationFrame(r));
      const st = Object.assign({}, Cinema.stat());
      const el = document.getElementById('cinema');
      const out = { st, line: el.querySelector('.cn-line').textContent, cap: el.querySelector('.cn-n').textContent, sub: el.querySelector('.cn-s').textContent, on: el.classList.contains('on') };
      await new Promise(r => setTimeout(r, 450));
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      await pr;
      return out;
    }, [bg, at, story]);

    for (const bg of BGS) {
      await t.step(`${bg}: üç çekimde çizilir, boş değil, gölge açık, hata yok`, async () => {
        const R = [];
        for (const at of [1.5, 7, 13.5]) R.push(await shot(bg, at, true));
        for (const r of R) {
          t.ok(r.on && r.st.frames >= 2, 'oynadı', r.st);
          t.eq(r.st.glErr, 0, 'GL hatası yok');
          t.ok(r.st.shadow, 'gölge haritası açık', r.st);
          t.ok(r.st.std > 12 && r.st.mean > 20 && r.st.mean < 235, 'görüntü boş ya da tek renk değil', r.st);
        }
        t.ok(R[0].st.dur >= 13, 'sahne en az 13 sn', R[0].st.dur);
        t.ok(R[0].line.length > 5, 'hikâye satırı altyazıda', R[0].line);
        t.ok(R[2].cap.length > 3 && R[2].sub.length > 5, 'son çekimde yer adı ve alt başlık', [R[2].cap, R[2].sub]);
      });
    }

    await t.step('hikâye kapalıyken satır yok, sahne yine çizilir', async () => {
      const r = await shot('outlaw', 2, false);
      t.ok(r.st.frames >= 2 && r.st.std > 12, 'çizildi', r.st); t.eq(r.st.lines, 0, 'satır yok'); t.eq(r.line, '', 'altyazı boş');
    });

    await t.step('İngilizcede yer adı ve alt başlık çevrilir', async () => {
      await p.evaluate(() => I18N.setLang('en'));
      const r = await shot('farm', 13.5, true);
      await p.evaluate(() => I18N.setLang('tr'));
      t.eq(r.cap, 'Harlow Plains', 'yer adı'); t.ok(!/[ğüşıöçİ]/.test(r.sub), 'alt başlık İngilizce', r.sub);
    });

    await t.step('yeni oyun: Çiftçi açılışı babanın sözüyle başlar, geçilince hikâye açılır', async () => {
      const q = await t.page({ cine: true, story: true });
      await t.sleep(300); await q.keyboard.press('Enter'); await t.sleep(400);
      await q.evaluate(() => { for (let k = 0; k < 8 && document.querySelector('#cr-go'); k++) document.querySelector('#cr-go').click(); });
      await q.waitForFunction(() => { const c = document.getElementById('cinema'); return c && c.classList.contains('on'); }, null, { timeout: 150000 });
      await q.waitForFunction(() => /baba|{ad}|Sully/i.test(document.querySelector('#cinema .cn-line').textContent) || document.querySelector('#cinema .cn-line').textContent.length > 10, null, { timeout: 20000 });
      const r = await q.evaluate(() => ({ line: document.querySelector('#cinema .cn-line').textContent, st: Cinema.stat() }));
      t.ok(r.st.scene === 'farm' && r.st.lines === 4, 'çiftçi sahnesi, dört satır', r.st);
      t.ok(/Baban/.test(r.line) && !/\{ad\}/.test(r.line), 'konuşan baba, isim yerleşti', r.line);
      await q.keyboard.press('Enter');
      await q.waitForFunction(() => G.state === 'play' && !document.getElementById('cinema').classList.contains('on'), null, { timeout: 20000 });
      await t.helpers(q);
      await q.evaluate(() => { const w = document.querySelector('.modal.welcome'); if (w) UI.closeAll(); });
      await q.waitForFunction(() => G.story && G.story.on && G.story.id === 'sully', null, { timeout: 20000 });
    });
  },
};
