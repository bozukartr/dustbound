'use strict';
/* İlk oyunda sinematikten sonra açılan hoş geldin rehberi */
module.exports = {
  name: 'Hoş geldin rehberi',
  async run(t) {
    const p = await t.page({ guide: true });
    await t.step('ilk oyunda rehber kendiliğinden açılır', async () => {
      await t.sleep(300);
      await p.keyboard.press('Enter'); await t.sleep(400); await p.keyboard.press('Enter');
      await p.waitForFunction(() => G.state === 'play', null, { timeout: 150000 });
      await p.waitForFunction(() => !!document.querySelector('.panel.welcome'), null, { timeout: 8000 });
      const r = await p.evaluate(() => ({ title: document.querySelector('.wl-title').textContent, dots: document.querySelectorAll('.wl-dots i').length, portrait: !!document.querySelector('#wl-portrait') }));
      t.ok(/Hoş Geldin/.test(r.title), 'ilk sayfa karşılama', r);
      t.ok(r.dots >= 5, 'birkaç sayfa', r.dots); t.ok(r.portrait, 'karakterin portresi');
    });
    await t.step('sayfalar arasında gezilir, son sayfada maceraya başlanır', async () => {
      const titles = [];
      for (let k = 0; k < 10; k++) {
        const tt = await p.evaluate(() => { const e = document.querySelector('.wl-title'); return e && e.textContent; });
        if (!tt) break;
        titles.push(tt);
        await p.keyboard.press('ArrowRight'); await t.sleep(250);
        if (await p.evaluate(() => !!document.querySelector('[data-act="done"]'))) { titles.push(await p.evaluate(() => document.querySelector('.wl-title').textContent)); break; }
      }
      t.ok(new Set(titles).size >= 5, 'farklı sayfalar', titles);
      await p.click('[data-act="done"]'); await t.sleep(300);
      const r = await p.evaluate(() => ({ open: !!document.querySelector('.panel.welcome'), seen: JSON.parse(localStorage.getItem('frontiersend_settings_v1')).guideSeen, modal: UI.isModal() }));
      t.ok(!r.open && !r.modal, 'rehber kapanır, oyun sürer', r);
      t.eq(r.seen, true, 'bir daha kendiliğinden açılmaz');
    });
    await t.step('duraklat menüsünden yeniden açılır', async () => {
      await p.evaluate(() => UI.openPause()); await t.sleep(200);
      await p.evaluate(() => { const e = [...UI.top().el.querySelectorAll('.p-item')].find(x => /Rehber/.test(x.textContent)); e.click(); });
      await t.sleep(300);
      t.ok(await p.evaluate(() => !!document.querySelector('.panel.welcome')), 'Rehber düğmesiyle açılır');
      await p.keyboard.press('Escape'); await t.sleep(250);
      t.ok(await p.evaluate(() => !document.querySelector('.panel.welcome')), 'Esc ile kapanır');
    });
  },
};
