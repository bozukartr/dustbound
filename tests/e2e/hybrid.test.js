'use strict';
/* Melez çizim (js/hybrid.js): varsayılan açık, kanvas iki kat yoğun; kasabada gündüz/gece ve bina içinde
   hatasız çizer, gece ışıkları toplar, ayardan Klasik'e geçince eski 2D çizime döner. */
module.exports = {
  name: 'Melez çizim',
  async run(t) {
    const p = await t.newGame();
    const errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    const frames = () => p.evaluate(() => HY.stat.frames);
    const look = () => p.evaluate(() => {
      const c = G.ctx.getImageData(0, 0, G.canvas.width, G.canvas.height).data; let s = 0, s2 = 0, n = 0;
      for (let i = 0; i < c.length; i += 16) { const v = (c[i] + c[i + 1] + c[i + 2]) / 3; s += v; s2 += v * v; n++; }
      const mean = s / n; return { mean, sd: Math.sqrt(s2 / n - mean * mean) };
    });
    await p.evaluate(() => {
      UI.el.help.classList.add('hidden');
      const tw = G.world.towns[0], b = G.world.buildings.find(q => q.town === tw.id && q.type === 'saloon') || G.world.buildings.find(q => q.town === tw.id && q.enter);
      window.B = b;
      TH.goto(b.door.x, b.door.y + 40);
      G.clock = Math.floor(G.clock / 1440) * 1440 + 14 * 60;
      G.weather = { type: 'clear', t: 99999, i: 0, cloud: 0, fogI: 0 };
    });

    await t.step('ekran kartı yokken (yazılım çizimi) Klasik çizime kalır', async () => {
      const r = await p.evaluate(() => ({ soft: !document.createElement('canvas').getContext('webgl', { failIfMajorPerformanceCaveat: true }), ds: G.ds, on: G.hybridOn() }));
      if (r.soft) { t.eq(r.ds, 1, 'yoğunluk 1'); t.ok(!r.on, 'melez kapalı'); }
      // testin geri kalanı için yazılımda da aç
      await p.evaluate(() => { window.__hySoft = true; G.applySettings(); });
      t.ok(await p.evaluate(() => G.hybridOn()), 'zorlanınca melez açılır');
    });

    await t.step('ayarlarda Grafik satırı var; varsayılan Melez', async () => {
      const r = await p.evaluate(() => { UI.openSettings(2); const has = /Grafik|Graphics/.test(document.querySelector('.panel.settings').textContent); UI.closeAll(); return { has, gfx: G.settings.gfx }; });
      t.ok(r.has, 'Görüntü sekmesinde');
      t.eq(r.gfx, 0, 'varsayılan Melez');
    });

    await t.step('kasabayı iki kat piksel yoğunluğuyla çizer, bina örtüsü ve parçalar pişer', async () => {
      await t.sleep(2500);
      const f0 = await frames(); await t.sleep(800);
      const r = await p.evaluate(() => ({ ds: G.ds, cw: G.canvas.width, vw: G.vw, f: HY.stat.frames, chunks: HY.stat.chunks, cover: !!(B._hy && B._hy.c) }));
      t.ok(r.f > f0, 'melez kareler çiziliyor', r.f);
      t.eq(r.ds, 2, 'yoğunluk 2');
      t.eq(r.cw, r.vw * 2, 'kanvas genişliği iki kat');
      t.ok(r.chunks > 0, 'zemin parçaları pişti', r.chunks);
      t.ok(r.cover, 'binanın örtüsü pişti');
      const l = await look();
      t.ok(l.mean > 40 && l.sd > 8, 'gündüz sahnesi aydınlık ve ayrıntılı (düz renk değil)', l);
    });

    await t.step('gece fener ve pencere ışıkları toplanır; sahne kararır', async () => {
      const day = await p.evaluate(() => HY.stat.lights);
      const ld = await look();
      await p.evaluate(() => { G.clock = Math.floor(G.clock / 1440) * 1440 + 22 * 60; });
      await t.sleep(1500);
      const night = await p.evaluate(() => HY.stat.lights), ln = await look();
      t.ok(night > day, 'gece daha çok ışık', { day, night });
      t.ok(ln.mean < ld.mean, 'gece daha karanlık', { day: ld.mean, night: ln.mean });
    });

    await t.step('bina içinde (iç mekân pişer) hatasız çizer', async () => {
      await p.evaluate(() => TH.inside(B));
      await t.sleep(1500);
      const r = await p.evaluate(() => ({ inside: G.insideB === B, f: HY.stat.frames }));
      await t.sleep(500);
      t.ok(r.inside, 'oyuncu içeride');
      t.ok(await frames() > r.f, 'çizim sürüyor');
      const l = await look();
      t.ok(l.sd > 8, 'iç mekân ayrıntılı', l);
    });

    await t.step('fare ile nişan ve ekran dönüşümü yoğunluktan etkilenmez', async () => {
      const r = await p.evaluate(() => { const P = G.player, s = G.toScreen(P.x, P.y), r = G.canvas.getBoundingClientRect(); return { sx: s.x, sy: s.y, w: r.width, h: r.height }; });
      t.ok(r.sx > r.w * 0.3 && r.sx < r.w * 0.7 && r.sy > r.h * 0.3 && r.sy < r.h * 0.7, 'oyuncu ekranın ortasında', r);
    });

    await t.step('Klasik seçilince eski 2D çizime döner, Melez seçilince geri gelir', async () => {
      await p.evaluate(() => { G.settings.gfx = 1; G.applySettings(); });
      await t.sleep(300);
      const f0 = await frames(); await t.sleep(600);
      const r = await p.evaluate(() => ({ ds: G.ds, cw: G.canvas.width, vw: G.vw }));
      t.eq(await frames(), f0, 'melez kare çizilmiyor');
      t.eq(r.ds, 1, 'yoğunluk 1');
      t.eq(r.cw, r.vw, 'kanvas tek kat');
      await p.evaluate(() => { G.settings.gfx = 0; G.applySettings(); });
      await t.sleep(800);
      t.ok(await frames() > f0, 'melez yeniden çiziyor');
      t.eq(errs.length, 0, 'sayfa hatası yok', errs);
    });
  },
};
