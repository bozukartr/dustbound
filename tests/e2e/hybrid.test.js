'use strict';
/* Melez çizim (js/hybrid.js): varsayılan açık, kanvas iki kat yoğun; kasabada gündüz/gece ve bina içinde
   hatasız çizer, gece ışıkları toplar, ayardan Klasik'e geçince eski 2D çizime döner. Ekran Kartı ayarı
   tarayıcıda WebGL bağlamını seçilen güç tercihiyle (güçlü / tasarruflu kart) yeniden kurar. Kamera yarım piksel
   ızgarasında kayar; yaklaşan binanın örtüsü görünmeden önce adım adım pişer. */
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

    await t.step('Ekran Kartı: tasarruflu kart seçilince WebGL bağlamı düşük güçle yeniden kurulur, melez sürer', async () => {
      const pow = () => p.evaluate(() => HY.canvas ? HY.canvas.getContext('webgl').getContextAttributes().powerPreference : null);
      t.eq(await pow(), 'high-performance', 'Otomatik: güçlü kart istenir');
      await p.evaluate(() => UI.openSettings(2)); await t.sleep(700);
      const r = await p.evaluate(() => ({ opts: [...document.querySelectorAll('.st-row[data-k="gpu"] .st-seg span')].map(n => n.textContent), active: UI.gpuDet && UI.gpuDet.active }));
      t.eq(r.opts.length, 3, 'Görüntü sekmesinde üç seçenekli Ekran Kartı satırı', r);
      t.ok(!!r.active, 'kullanılan kart algılandı', r);
      await p.evaluate(() => document.querySelector('.st-row[data-k="gpu"] [data-v="2"]').click()); await t.sleep(600);
      t.eq(await pow(), 'low-power', 'yeni bağlam tasarruflu kart için');
      t.ok(await p.evaluate(() => G.hybridOn() && G.ds === 2), 'melez açık kalır');
      const f0 = await frames(); await t.sleep(800);
      t.ok(await frames() > f0, 'melez yeni bağlamla çizmeyi sürdürür');
      await p.evaluate(() => { UI.closeAll(); G.settings.gpu = 0; G.applySettings(); }); await t.sleep(300);
      t.eq(await pow(), 'high-performance', "Otomatik'e dönünce güçlü kart yeniden istenir");
      t.eq(errs.length, 0, 'sayfa hatası yok', errs);
    });

    await t.step('kamera yarım piksel ızgarada kayar, oyuncu ekranda titremez', async () => {
      // binanın dışında, yakınlaşma sönmüş olmalı (içerideyken kamera binayı ortalar)
      await p.evaluate(() => { TH.goto(B.door.x, B.door.y + 40); TH.clearNpcs(); });
      const out = () => p.evaluate(() => !G.insideB && (!G.camZoom || (G.camZoom.z < 1.001 && G.camZoom.k < 0.001)));
      for (let k = 0; k < 50 && !(await out()); k++) await t.sleep(200);   // yazılım çiziminde kareler yavaş
      t.ok(await out(), 'dışarıda, yakınlaşma yok');
      const r = await p.evaluate(() => {
        const P = G.player, C = G.cam, x0 = P.x, y0 = P.y, dt = 1 / 60, v = 58;
        C.x = x0; C.y = y0;
        let prev = null, jumps = 0, off = 0, halves = 0, n = 0;
        for (let i = 0; i < 240; i++) {
          P.x += v * dt; G.updateCamera(dt);
          if (i < 90) continue;
          const scr = Math.round(P.x * 2) - C.ox * 2;   // oyuncunun tuvaldeki pikseli (iki kat yoğun)
          if (prev !== null && scr !== prev) jumps++;
          if (C.ox * 2 !== Math.round(C.ox * 2)) off++;
          if (C.ox % 1 !== 0) halves++;
          prev = scr; n++;
        }
        C.x = P.x = x0; C.y = P.y = y0; G.updateCamera(1 / 60);
        return { ds: G.ds, jumps, off, halves, n };
      });
      t.eq(r.ds, 2, 'melez (iki kat yoğun)');
      t.eq(r.off, 0, 'kamera yarım piksel ızgarasında');
      t.ok(r.halves > 10, 'zemin yarım piksel adımlarla da kayar', r);
      t.ok(r.jumps <= 2, 'oyuncu ekranda sıçramaz', r);
    });

    await t.step('yaklaşan binanın örtüsü görünmeden adım adım pişer; görününce hazır örtü kullanılır', async () => {
      const spot = await p.evaluate(() => {
        const W = G.world, bxp = B.x * TS, byp = B.y * TS;
        HY.flush();
        // binanın yanında, görüş alanının dışında ama önceden pişirme payının içinde, bina dışı bir yer
        for (const side of [-1, 1]) for (const dy of [B.h * TS / 2, B.h * TS + 30, -30, B.h * TS + 60, -60]) {
          const x = side < 0 ? bxp - 170 - G.vw / 2 : bxp + B.w * TS + 170 + G.vw / 2, y = byp + dy;
          if (!W.buildingAtPx(x, y) && !W.indoorPx(x, y) && !W.blocked(x, y, 4)) { TH.goto(x, y); TH.clearNpcs(); return [x, y]; }
        }
        return null;
      });
      t.ok(!!spot, 'binanın yanında boş yer bulundu');
      await t.sleep(700);   // birkaç kare: yaklaşan binalar sıraya girer
      const q = await p.evaluate(() => {
        const W = G.world, x0 = G.cam.ox, x1 = x0 + G.vw, y0 = G.cam.oy, y1 = y0 + G.vh, bxp = B.x * TS, byp = B.y * TS;
        const visible = !(bxp + B.w * TS + 50 < x0 || bxp - 50 > x1 || byp + B.h * TS + 30 < y0 || byp - 80 > y1);
        const queued = HY._coverQueued(B), fresh = !!(B._hy && B._hy.gen === W._hyGen);
        const left = HY._jobs(1e9);   // bekleyen bütün işler biter
        window.__hyB = B._hy;
        return { visible, queued, fresh, left, done: !!(B._hy && B._hy.gen === W._hyGen), inside: !!G.insideB };
      });
      t.ok(!q.visible && !q.inside, 'bina henüz görünmüyor', q);
      t.ok(q.queued || q.fresh, 'örtüsü sıraya girdi (ya da çoktan pişti)', q);
      t.ok(q.done, 'işler bitince örtü hazır', q);
      t.eq(q.left, { chunks: 0, covers: 0 }, 'bekleyen iş kalmadı');
      await p.evaluate(() => TH.goto(B.door.x, B.door.y + 40));
      await t.sleep(700);
      t.ok(await p.evaluate(() => B._hy === window.__hyB), 'görününce önceden pişen örtü kullanılır (yeniden pişmez)');
      t.eq(errs.length, 0, 'sayfa hatası yok', errs);
    });
  },
};
