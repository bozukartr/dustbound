'use strict';
/* Hata ayıklama paneli: Ctrl+Alt+C, şifre, kilitlenme */
module.exports = {
  name: 'Hata ayıklama paneli',
  async run(t) {
    const p = await t.newGame();
    // gerçek şifre depoda hiçbir yerde düz yazılmaz: test kendi geçici şifresini kurar
    const PIN = '8642';
    await p.evaluate((pin) => { Debug.PIN_HASH = Debug.pinHash(pin); }, PIN);
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
      for (const d of PIN) await p.click(`#dbg-pin button[data-k="${d}"]`);
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
    await t.step('darboğaz ölçümü: her aşama sırayla kapatılır, sonuç yazılır, hepsi geri açılır', async () => {
      const errs = [];
      p.on('pageerror', (e) => errs.push(e.message));
      const r = await p.evaluate(async () => {
        // melez çizim (yazılım çiziminde de) açık: aşamaların çoğu melez çizimin içinde
        window.__hySoft = true; G.settings.gfx = 0; G.applySettings(); G.resize();
        if (Debug.pin) Debug.closePin();
        Debug.unlocked = true; if (!Debug.open) Debug.toggle();
        Debug.tab = 'perf'; Debug.renderTab();
        // her aşama ölçüm sırasında gerçekten kapanıyor mu: her karenin başında bakılır
        const seen = {}, keys = Debug.BENCH().map(s => s[0]);
        let stop = false;
        const spy = () => { for (const k of keys) if (PERF_OFF[k] || (k === 'hud' && document.body.classList.contains('dbg-nohud'))) seen[k] = 1; if (!stop) requestAnimationFrame(spy); };
        requestAnimationFrame(spy);
        await Debug.bench({ settle: 40, win: 120 });
        stop = true;
        return { ds: G.ds, txt: Debug.benchTxt, shown: document.querySelector('#dbg-bench').textContent, rows: document.querySelectorAll('#dbg-bench .dbg-r').length, seen: Object.keys(seen).length, n: keys.length, left: Object.keys(PERF_OFF).length, nohud: document.body.classList.contains('dbg-nohud'), names: Debug.BENCH().map(s => s[1]) };
      });
      t.eq(r.ds, 2, 'melez çizimle ölçüldü');
      t.eq(r.seen, r.n, 'her aşama ölçüm sırasında kapandı', r);
      t.eq(r.left, 0, 'ölçümden sonra bütün aşamalar açık');
      t.ok(!r.nohud, 'arayüz geri geldi');
      t.ok(r.names.every(n => r.txt.includes(n) && r.shown.includes(n)) && /FPS/.test(r.txt) && r.rows === r.n + 1, 'sonuç her aşamayı yazar ve panelde satır satır görünür', r);
      t.eq(errs.length, 0, 'sayfa hatası yok', errs);
    });
  },
};
