'use strict';
/* Hata ayıklama paneli: Ctrl+Alt+C, şifre, kilitlenme */
module.exports = {
  name: 'Hata ayıklama paneli',
  async run(t) {
    const p = await t.newGame();
    const combo = async () => { await p.keyboard.down('Control'); await p.keyboard.down('Alt'); await p.keyboard.press('KeyC'); await p.keyboard.up('Alt'); await p.keyboard.up('Control'); await t.sleep(250); };
    await t.step('kısayol şifre sorar; yanlış şifre açmaz, oyuncu yürümez', async () => {
      await combo();
      t.ok(await p.evaluate(() => !!Debug.pin && !Debug.open), 'şifre penceresi açılmalı');
      const x0 = await p.evaluate(() => G.player.x);
      await p.keyboard.type('1234'); await t.sleep(900);
      t.ok(await p.evaluate(() => !Debug.open), 'yanlış şifreyle açılmamalı');
      t.ok(await p.evaluate((x0) => G.player.x === x0, x0), 'şifre yazarken oyuncu yürümemeli');
    });
    await t.step('doğru şifre paneli açar, sonra şifresiz açılır', async () => {
      for (const d of '4620') await p.click(`#dbg-pin button[data-k="${d}"]`);
      await t.sleep(500);
      t.ok(await p.evaluate(() => Debug.open && !Debug.pin), 'panel açılmalı');
      t.ok(await p.evaluate(() => !G.debugUsed), 'yalnız paneli açmak kaydı hileli saymamalı');
      await combo(); await combo();
      t.ok(await p.evaluate(() => Debug.open && !Debug.pin), 'yeniden şifresiz açılmalı');
      await combo();
    });
    await t.step('3 hatalı denemede 30 sn kilit; Esc kapatır', async () => {
      await p.evaluate(() => { if (Debug.open) Debug.toggle(); if (Debug.pin) Debug.closePin(); Debug.unlocked = false; Debug.fails = 0; });
      await combo();
      for (let k = 0; k < 3; k++) { await p.keyboard.type('0000'); await t.sleep(900); }
      await combo();
      t.ok(await p.evaluate(() => !Debug.pin && !Debug.open && Debug.lockUntil > performance.now()), 'kilitlenmeli');
      await p.evaluate(() => { Debug.lockUntil = 0; }); await combo(); await t.sleep(150);
      await p.keyboard.press('Escape'); await t.sleep(200);
      t.ok(await p.evaluate(() => !Debug.pin && G.state === 'play' && !UI.isModal()), 'Esc şifre penceresini kapatmalı');
    });
  },
};
