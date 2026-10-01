'use strict';
/* Ayarlar ekranı ve tuş atamaları */
module.exports = {
  name: 'Ayarlar ve tuş atamaları',
  async run(t) {
    const p = await t.page();
    await t.step('sekmeler ve denetimler ayarları değiştirir', async () => {
      await p.evaluate(() => UI.openSettings(1)); await t.sleep(200);
      // ses kaydırıcısı: tıklanan yere atlar, sürüklenince izler
      const tr = await p.evaluate(() => { const r = document.querySelector('.st-row[data-k="music"] .st-sl-track').getBoundingClientRect(); return { x: r.left, y: r.top + r.height / 2, w: r.width }; });
      await p.mouse.click(tr.x + tr.w * 0.7, tr.y); await t.sleep(100);
      t.near(await p.evaluate(() => G.settings.music), 0.7, 0.001, 'kaydırıcıya tıklama');
      await p.mouse.move(tr.x + tr.w * 0.7, tr.y); await p.mouse.down(); await p.mouse.move(tr.x + tr.w * 0.5, tr.y, { steps: 4 }); await p.mouse.move(tr.x + tr.w * 0.3, tr.y, { steps: 4 }); await p.mouse.up(); await t.sleep(100);
      t.near(await p.evaluate(() => G.settings.music), 0.3, 0.001, 'kaydırıcıyı sürükleme');
      t.eq(await p.evaluate(() => document.querySelector('.st-row[data-k="music"] .st-num').textContent), '30', 'değer yazısı güncellenir');
      await p.evaluate(() => { const r = document.querySelector('.st-row[data-k="master"]'); UI.top().setFocus(r, true); });
      const m0 = await p.evaluate(() => G.settings.master);
      await p.keyboard.press('ArrowRight'); await t.sleep(150);
      t.near(await p.evaluate(() => G.settings.master), Math.min(1, m0 + 0.05), 0.001, 'sağ ok sesi artırır');
      await p.keyboard.press('KeyE'); await t.sleep(200);
      t.eq(await p.evaluate(() => document.querySelector('.st-tabs .tab.on').dataset.tab), '2', 'E sonraki sekmeye geçer');
      await p.evaluate(() => document.querySelector('.st-row[data-k="fxq"] [data-v="1"]').click());
      t.eq(await p.evaluate(() => G.settings.fxq), 1, 'görsel efektler: Sade');
      await p.keyboard.press('KeyX'); await t.sleep(200);
      t.eq(await p.evaluate(() => G.settings.fxq), 0, 'Alt tuşu sekmeyi varsayılana döndürür');
      const side = await p.evaluate(() => document.querySelector('.st-side .ps-t').textContent);
      t.ok(side.length > 2, 'yan panelde açıklama olmalı');
      await p.keyboard.press('Escape'); await t.sleep(200);
      const saved = await p.evaluate(() => JSON.parse(localStorage.getItem('frontiersend_settings_v1')).music);
      t.near(saved, 0.3, 0.001, 'ayarlar kapanınca kaydedilir');
    });
    await t.step('Kaydet ve Kapat düğmesi; tam ekran tercihi kaydedilir', async () => {
      await p.evaluate(() => UI.openSettings(1)); await t.sleep(200);
      const btns = await p.evaluate(() => [...document.querySelectorAll('.st-btn')].map(b => b.textContent));
      t.ok(btns.some(b => /Kaydet ve Kapat/.test(b)) && btns.some(b => /Varsayılan/.test(b)), 'düğmeler görünür', btns);
      await p.evaluate(() => { G.settings.music = 0.45; });
      await p.click('.st-btn[data-act="close"]'); await t.sleep(200);
      t.ok(await p.evaluate(() => !document.querySelector('.panel.settings')), 'ayarlar kapanır');
      t.near(await p.evaluate(() => JSON.parse(localStorage.getItem('frontiersend_settings_v1')).music), 0.45, 0.001, 'kapatınca kaydedilir');
      // tam ekran tercihi (tarayıcı izin vermese de tercih saklanır)
      await p.evaluate(() => UI.openSettings(2)); await t.sleep(200);
      await p.click('.st-row[data-k="fullscreen"] .st-tog'); await t.sleep(400);
      t.eq(await p.evaluate(() => JSON.parse(localStorage.getItem('frontiersend_settings_v1')).fullscreen), true, 'tercih kaydedilir');
      await p.evaluate(() => G.setFullscreenPref(false)); await p.keyboard.press('Escape'); await t.sleep(200);
    });
    await t.step('klavye tuşu atama, takas ve iptal', async () => {
      await p.evaluate(() => UI.openControls(0)); await t.sleep(200);
      const pick = (re) => p.evaluate((src) => { const m = UI.top(); const e = [...m.el.querySelectorAll('.p-item')].find(x => new RegExp(src).test(x.textContent)); m.setFocus(e); e.click(); }, re);
      await pick('Etkileşim'); await t.sleep(150);
      t.ok(await p.evaluate(() => !!Input.capture), 'tuş bekleme moduna girmeli');
      await p.keyboard.press('KeyG'); await t.sleep(150);
      t.eq(await p.evaluate(() => Input.binds.kb.interact[0]), 'KeyG', 'etkileşim G olmalı');
      await pick('Etkileşim'); await t.sleep(150); await p.keyboard.press('KeyR'); await t.sleep(150);
      const sw = await p.evaluate(() => ({ i: Input.binds.kb.interact[0], r: Input.binds.kb.reload[0] }));
      t.eq(sw.i, 'KeyR', 'etkileşim R'); t.eq(sw.r, 'KeyG', 'şarjör G ile takas edilmeli');
      const l0 = await p.evaluate(() => JSON.stringify(Input.binds.kb.lantern));
      await pick('Fener'); await t.sleep(150); await p.keyboard.press('Escape'); await t.sleep(150);
      t.eq(await p.evaluate(() => JSON.stringify(Input.binds.kb.lantern)), l0, 'Esc atamayı iptal eder');
      await p.evaluate(() => G.saveSettings());
      await p.reload(); await p.waitForFunction(() => typeof G !== 'undefined' && G.state === 'menu');
      t.eq(await p.evaluate(() => Input.binds.kb.interact[0]), 'KeyR', 'atama yeniden açılışta korunur');
      await p.evaluate(() => { Input.resetBinds('kb'); G.saveSettings(); });
      t.eq(await p.evaluate(() => Input.binds.kb.interact[0]), 'KeyE', 'varsayılana dönüş');
    });
  },
};
