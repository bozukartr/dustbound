'use strict';
/* Açılış videosu: her açılışta ana menüden önce oynar; tuşla geçilir ve basılan tuş menüye sızmaz;
   sonuna kadar oynayınca menü kendiliğinden açılır; dosya yoksa menü doğrudan açılır; tarayıcı sesli
   oynatmayı engellerse "Başlamak için bir tuşa bas" ekranı çıkar, tuşla video başlar.
   Deneme videosu tarayıcıda MediaRecorder ile üretilir (gerçek dosya video/intro.mp4). */
module.exports = {
  name: 'Açılış videosu',
  timeout: 240000,
  async run(t) {
    // 1) deneme videosu üret (5 sn, hareketli tuval)
    const gen = await t.page({});
    const b64 = await gen.evaluate(async () => {
      const c = document.createElement('canvas'); c.width = 320; c.height = 180; const g = c.getContext('2d');
      const rec = new MediaRecorder(c.captureStream(30), { mimeType: 'video/webm' }), parts = [];
      rec.ondataavailable = (e) => parts.push(e.data);
      const done = new Promise(r => (rec.onstop = r));
      rec.start(100);
      const t0 = performance.now();
      await new Promise(res => { const f = () => { const k = (performance.now() - t0) / 5000; g.fillStyle = `hsl(${k * 300},60%,40%)`; g.fillRect(0, 0, 320, 180); g.fillStyle = '#fff'; g.fillRect(k * 300, 80, 20, 20); if (k < 1) requestAnimationFrame(f); else res(); }; f(); });
      rec.stop(); await done;
      const buf = await new Blob(parts, { type: 'video/webm' }).arrayBuffer();
      let s = ''; const u = new Uint8Array(buf); for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]);
      return btoa(s);
    });
    t.ok(b64.length > 1000, 'deneme videosu üretildi', b64.length);
    const withVideo = (extra) => `(() => { const s = atob(${JSON.stringify(b64)}), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); window.__introSrc = URL.createObjectURL(new Blob([u], { type: 'video/webm' })); ${extra || ''} })();`;
    const open = async (init) => {
      const p = await t.page({ intro: true, init, wait: false });
      return p;
    };

    await t.step('açılışta video oynar, tuşla geçilir, tuş menüye sızmaz', async () => {
      const p = await open(withVideo());
      await p.waitForFunction(() => { const v = document.querySelector('#intro video'); return v && v.currentTime > 0.1; }, null, { timeout: 20000 });
      const r0 = await p.evaluate(() => ({ state: G.state, menu: !document.getElementById('mainmenu').classList.contains('hidden') }));
      t.ok(r0.state !== 'menu' && !r0.menu, 'video oynarken menü kapalı', r0);
      await p.keyboard.press('Enter');
      await p.waitForFunction(() => G.state === 'menu' && !document.getElementById('intro'), null, { timeout: 5000 });
      await t.sleep(400);
      t.ok(await p.evaluate(() => !document.querySelector('.modal.create')), 'Enter karakter ekranını açmadı (geçme tuşu menüye sızmadı)');
    });

    await t.step('video bitince menü kendiliğinden açılır', async () => {
      const p = await open(withVideo());
      await p.waitForFunction(() => document.querySelector('#intro video'), null, { timeout: 10000 });
      await p.waitForFunction(() => G.state === 'menu' && !document.getElementById('intro'), null, { timeout: 15000 });
      t.ok(true, 'menü açıldı');
    });

    await t.step('tarayıcı sesli oynatmayı engellerse önce "bir tuşa bas" ekranı', async () => {
      const p = await open(withVideo(`const pl = HTMLMediaElement.prototype.play; let n = 0; HTMLMediaElement.prototype.play = function () { if (n++ === 0) return Promise.reject(new DOMException('engel', 'NotAllowedError')); return pl.call(this); };`));
      await p.waitForFunction(() => document.getElementById('intro-gate'), null, { timeout: 10000 });
      t.ok(/Başlamak için bir tuşa bas/.test(await p.evaluate(() => document.getElementById('intro-gate').textContent)), 'başlama ekranı yazısı');
      await p.keyboard.press('Space');
      await p.waitForFunction(() => { const v = document.querySelector('#intro video'); return v && v.currentTime > 0.3 && !document.getElementById('intro-gate'); }, null, { timeout: 10000 });
      await p.keyboard.press('Escape');
      await p.waitForFunction(() => G.state === 'menu' && !document.getElementById('intro'), null, { timeout: 5000 });
    });

    await t.step('video dosyası yoksa menü doğrudan açılır', async () => {
      const p = await open(`window.__introSrc = 'video/yok.mp4';`);
      await p.waitForFunction(() => G.state === 'menu' && !document.getElementById('intro'), null, { timeout: 10000 });
      t.ok(true, 'menü açıldı');
    });
  },
};
