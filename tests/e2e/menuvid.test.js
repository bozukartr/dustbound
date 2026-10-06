'use strict';
/* Ana menü arka plan videosu (video/menu.mp4 ya da menu.webm):
   - menü açılınca sessiz ve döngülü oynar; çizilen sahne hiç görünmez (video yavaş yüklense de ilk karesi hemen görünür)
   - döngü dikişsiz: dosya bitip başa dönerken görüntü sıçramaz (CapCut kapanış kartı kesildi)
   - menüden çıkınca durur, menüye dönünce yeniden oynar
   - dosya açılamazsa çizilen piksel sahne kalır */
module.exports = {
  name: 'Ana menü videosu',
  timeout: 240000,
  async run(t) {
    const fs = require('fs'), path = require('path');
    const dir = path.join(__dirname, '..', '..', 'video');

    await t.step('dosyalar var ve küçük (mp4 + webm yedeği)', async () => {
      const mp4 = fs.statSync(path.join(dir, 'menu.mp4')).size, webm = fs.statSync(path.join(dir, 'menu.webm')).size;
      t.ok(mp4 > 200000 && mp4 < 4e6 && webm > 100000 && webm < 2e6, 'boyutlar makul', { mp4, webm });
    });

    const p = await t.page({ menuvid: true });
    const drawSpy = () => p.evaluate(async () => {
      const c = UI.bgctx, f = c.fillRect; let n = 0;
      c.fillRect = function () { n++; return f.apply(this, arguments); };
      await new Promise(r => setTimeout(r, 500));
      c.fillRect = f;
      return n;
    });

    await t.step('menüde sessiz döngü olarak oynar; oynarken çizilen sahne çizilmez', async () => {
      await p.waitForFunction(() => { const v = document.getElementById('menuvid'); return v.classList.contains('on') && v.currentTime > 0.5; }, null, { timeout: 20000 });
      const r = await p.evaluate(() => { const v = document.getElementById('menuvid'); return { muted: v.muted, loop: v.loop, w: v.videoWidth, h: v.videoHeight, dur: v.duration, src: v.currentSrc.split('/').pop(), op: getComputedStyle(v).objectFit }; });
      t.ok(r.muted && r.loop, 'sessiz ve döngülü', r);
      t.ok(r.w >= 1280 && r.h >= 720 && r.op === 'cover', 'ekranı dolduran yüksek çözünürlük', r);
      t.ok(r.dur > 8 && r.dur < 12, 'kapanış kartı kesilmiş kısa döngü', r);
      t.eq(await drawSpy(), 0, 'çizilen sahne durdu');
      // kayıt varken son hayat kartı sahneyi (sağ alt: ateş ve kovboy) kapatmaz, sağ üste çıkar
      const card = await p.evaluate(() => { G.saveInfo = () => ({ name: 'Deneme', age: 30, money: 100, bg: 'farmer', place: '', year: 1891, playtime: 60 }); UI.showMainMenu(); const b = document.getElementById('mm-card').getBoundingClientRect(), rg = document.createRange(); rg.selectNodeContents(document.querySelector('.mm-title h1')); const tt = rg.getBoundingClientRect(); return { left: b.left, bottom: b.bottom, h: innerHeight, titleR: tt.right }; });
      t.ok(card.bottom < card.h * 0.3 && card.left > card.titleR, 'son hayat kartı sağ üst köşede, başlığa değmiyor', card);
    });

    await t.step('döngü dikişsiz: başa dönüşte görüntü sıçramaz, siyah kapanış kartı yok', async () => {
      // oynayan videonun her sunulan karesi okunur; başa dönüş anındaki fark sıradan kare geçişleriyle karşılaştırılır
      const r = await p.evaluate(() => new Promise((done) => {
        const v = document.getElementById('menuvid'), c = document.createElement('canvas');
        c.width = 160; c.height = 90; const g = c.getContext('2d', { willReadFrequently: true });
        let prev = null, prevT = -1, wrap = null, dark = 255; const diffs = [];
        const t0 = performance.now();
        v.playbackRate = 2;
        const cb = (now, md) => {
          g.drawImage(v, 0, 0, 160, 90);
          const px = g.getImageData(0, 0, 160, 90).data;
          let b = 0; for (let i = 0; i < px.length; i += 4) b += px[i] + px[i + 1] + px[i + 2];
          dark = Math.min(dark, b / (px.length / 4) / 3);
          if (prev) {
            let s = 0; for (let i = 0; i < px.length; i += 4) s += Math.abs(px[i] - prev[i]) + Math.abs(px[i + 1] - prev[i + 1]) + Math.abs(px[i + 2] - prev[i + 2]);
            const d = s / (px.length / 4) / 3;
            if (md.mediaTime < prevT) wrap = d; else diffs.push(d);
          }
          prev = px; prevT = md.mediaTime;
          if ((wrap !== null && diffs.length > 20) || performance.now() - t0 > 20000) { v.playbackRate = 1; diffs.sort((a, b) => a - b); done({ wrap, n: diffs.length, med: diffs[diffs.length >> 1], p95: diffs[Math.floor(diffs.length * 0.95)], max: diffs[diffs.length - 1], dark }); }
          else v.requestVideoFrameCallback(cb);
        };
        v.requestVideoFrameCallback(cb);
      }));
      t.ok(r.wrap !== null && r.n > 20, 'başa dönüş görüldü', r);
      t.ok(r.max > 0, 'kareler gerçekten okundu', r);
      // kesilmemiş kayıtta başa dönüş farkı ≈ 15 (kapanış kartından sahneye); dikişsiz döngüde kare geçişi düzeyinde (< 2)
      t.ok(r.wrap < 2 && r.wrap < r.max * 3, 'başa dönüş, sıradan bir kare geçişi kadar küçük', r);
      t.ok(r.dark > 8, 'siyah kapanış kartı yok', r);
    });

    await t.step('menüden çıkınca durur, menüye dönünce yeniden oynar', async () => {
      await p.keyboard.press('Enter');
      await p.waitForFunction(() => document.getElementById('mainmenu').classList.contains('hidden'), null, { timeout: 5000 });
      await t.sleep(300);
      t.ok(await p.evaluate(() => document.getElementById('menuvid').paused), 'karakter ekranında video durdu');
      await p.evaluate(() => UI.showMainMenu());
      await p.waitForFunction(() => { const v = document.getElementById('menuvid'); return !v.paused && v.classList.contains('on'); }, null, { timeout: 5000 });
      t.ok(true, 'menüde yeniden oynuyor');
    });

    await t.step('video yavaş yüklense de menü doğrudan videonun ilk karesiyle açılır (önce çizilen sahne görünmez)', async () => {
      const q = await t.page({ menuvid: true, before: async (pg) => {
        await pg.route(/video\/menu\.(mp4|webm)/, async (route) => { await new Promise(r => setTimeout(r, 3000)); await route.continue(); });
      } });
      const r = await q.evaluate(async () => {
        const v = document.getElementById('menuvid'), c = UI.bgctx, f = c.fillRect; let n = 0;
        c.fillRect = function () { n++; return f.apply(this, arguments); };
        await new Promise(r => setTimeout(r, 600));
        c.fillRect = f;
        const img = new Image(); img.src = v.poster; await img.decode().catch(() => {});
        return { draws: n, shown: getComputedStyle(v).display !== 'none', playing: v.classList.contains('on'), poster: v.poster.split('/').pop(), posterW: img.naturalWidth };
      });
      t.ok(!r.playing, 'video henüz yüklenmedi (yavaş ağ)', r);
      t.eq(r.draws, 0, 'çizilen sahne çizilmedi');
      t.ok(r.shown && r.poster === 'menu.jpg' && r.posterW >= 1280, 'videonun ilk karesi görünüyor', r);
      await q.waitForFunction(() => document.getElementById('menuvid').classList.contains('on'), null, { timeout: 20000 });
      t.ok(true, 'video yüklenince oynamaya başladı');
    });

    await t.step('dosya açılamazsa çizilen piksel sahne kalır', async () => {
      const q = await t.page({ menuvid: true, init: () => { window.__menuVidSrc = ['video/yok.mp4', 'video/yok.webm']; } });
      await q.waitForFunction(() => UI._mvFail, null, { timeout: 10000 });
      const r = await q.evaluate(() => ({ on: document.getElementById('menuvid').classList.contains('on') }));
      t.ok(!r.on, 'video görünmez', r);
      const n = await q.evaluate(async () => { const c = UI.bgctx, f = c.fillRect; let n = 0; c.fillRect = function () { n++; return f.apply(this, arguments); }; await new Promise(r => setTimeout(r, 500)); c.fillRect = f; return n; });
      t.ok(n > 10, 'çizilen sahne çiziliyor', n);
    });
  },
};
