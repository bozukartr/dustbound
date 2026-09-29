'use strict';
/* Ayarlar ekranı ve tuş atamaları */
module.exports = {
  name: 'Ayarlar ve tuş atamaları',
  async run(t) {
    const p = await t.page();
    await t.step('sekmeler ve denetimler ayarları değiştirir', async () => {
      await p.evaluate(() => UI.openSettings(1)); await t.sleep(200);
      await p.evaluate(() => document.querySelector('.st-row[data-k="music"] [data-i="2"]').click());
      t.near(await p.evaluate(() => G.settings.music), 0.3, 0.001, 'ses göstergesine tıklama');
      await p.evaluate(() => { const r = document.querySelector('.st-row[data-k="master"]'); UI.top().setFocus(r, true); });
      const m0 = await p.evaluate(() => G.settings.master);
      await p.keyboard.press('ArrowRight'); await t.sleep(150);
      t.near(await p.evaluate(() => G.settings.master), Math.min(1, m0 + 0.1), 0.001, 'sağ ok sesi artırır');
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
