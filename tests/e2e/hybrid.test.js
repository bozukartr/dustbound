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

    await t.step('ekrandaki ışıklar hücrelerden seçilir: tüm listeyle aynı sonuç, sonradan eklenen ışık hemen görünür', async () => {
      const r = await p.evaluate(() => {
        const W = G.world; let rs = 7; const rnd = () => (rs = (rs * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
        let bad = 0, seen = 0;
        for (let k = 0; k < 600; k++) {
          const tw = W.towns[k % W.towns.length], vw = [461, 922][k % 2], vh = Math.round(vw * 9 / 16);
          const x0 = tw.cx + (rnd() - 0.5) * 1600 - vw / 2, y0 = tw.cy + (rnd() - 0.5) * 1600 - vh / 2;
          // tüketicilerin en geniş payı: Klasik yarıçap, Melez 1,5 kat yarıçap ve 22 px kayma ya da fener 93 px, ıslak zemin 60 px
          const need = (L) => { const e = Math.max(L.r * 1.5 + 22, 93); return L.x + e > x0 && L.x - e < x0 + vw && L.y + e > y0 - 40 && L.y - e < y0 + vh + 60; };
          const a = W.lights.filter(need), b = W.lightsIn(x0, y0 - 40, x0 + vw, y0 + vh + 60).filter(need);
          if (a.length !== b.length || a.some((L, i) => L !== b[i])) bad++;
          seen += a.length;
        }
        const P = G.player, L = { x: P.x + 4, y: P.y + 4, r: 34, type: 'window', b: -1 };
        W.lights.push(L);
        const added = W.lightsIn(P.x - 100, P.y - 100, P.x + 100, P.y + 100).includes(L);
        W.lights.pop();
        const gone = !W.lightsIn(P.x - 100, P.y - 100, P.x + 100, P.y + 100).includes(L);
        return { bad, seen, added, gone };
      });
      t.eq(r.bad, 0, 'hücrelerden seçilen ışıklar tüm listeyle aynı');
      t.ok(r.seen > 100, 'taramada ışık görüldü', r);
      t.ok(r.added && r.gone, 'eklenen ışık hemen görünür, çıkarılınca kaybolur', r);
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

    await t.step('yeniden kullanılan tampon ve tuvallerle pişen parça ve bina örtüsü ilk pişenle piksel piksel aynı', async () => {
      const r = await p.evaluate(async () => {
        const W = G.world, frame = () => new Promise(res => requestAnimationFrame(() => res()));
        const h = (cv) => { if (!cv) return 0; const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; let x = 2166136261 >>> 0; for (let i = 0; i < d.length; i++) { x ^= d[i]; x = Math.imul(x, 16777619) >>> 0; } return x; };
        const sig = (c) => [h(c.bc), h(c.bg), h(c.oc), h(c.og)].join('/'), csig = (c) => h(c.c) + '/' + h(c.g);
        HY.flush();
        const x = B.x * TS + 8, y = B.y * TS + 8;   // iç mekânı, nesneleri ve bina zemini olan parça
        const first = sig(HY._bake(W, x, y));
        B._hy = null; const cov1 = csig(HY._cover(B, W));
        // başka parçalar ve örtüler pişer, önbellek taşar: atılan parçaların tuvalleri ve ara tamponlar havuza döner
        for (let k = 0; k < 40; k++) HY._bake(W, x + ((k % 8) - 4) * 256, y + (Math.floor(k / 8) - 2) * 256);
        for (const b of W.buildings.filter(q => q.town === B.town).slice(0, 12)) { b._hy = null; HY._cover(b, W); }
        await frame(); await frame();
        HY.flush();   // önbellek boşalır, havuzdakiler kalır
        const second = sig(HY._bake(W, x, y));
        B._hy = null; const cov2 = csig(HY._cover(B, W));
        return { first, second, cov1, cov2 };
      });
      t.eq(r.second, r.first, 'parça aynı (alt ve üst katman, renk ve geometri)');
      t.eq(r.cov2, r.cov1, 'bina örtüsü aynı');
    });

    await t.step('küçük piksel ölçeğinde (büyük görünüm) önbellek görünen parçaları ve halkasını tutar: aynı parçalar yeniden pişmez', async () => {
      const r = await p.evaluate(async () => {
        const frame = () => new Promise(res => requestAnimationFrame(() => res()));
        const z0 = G.settings.zoom; G.settings.zoom = 2; G.resize();
        try {
          // görünen alan 4x3 parçaya değsin: halkasıyla 6x5 = 30 parça (eski sabit önbellek 28 parçaydı)
          const s = TH.openSpot(), P = G.player, at = (v, m, half) => Math.floor((v - half) / 256) * 256 + m + half;
          TH.clearNpcs(); P.x = at(s[0], 180, G.vw / 2); P.y = at(s[1], 200, G.vh / 2); G.cam.x = P.x; G.cam.y = P.y;
          for (let k = 0; k < 6; k++) { await frame(); HY._jobs(1e9); }
          const C = G.cam, cols = Math.floor((C.ox + G.vw) / 256) - Math.floor(C.ox / 256) + 1, rows = Math.floor((C.oy + G.vh) / 256) - Math.floor(C.oy / 256) + 1;
          const sync0 = HY.stat.sync; let queued = 0;
          for (let k = 0; k < 15; k++) { await frame(); queued = Math.max(queued, HY._queued().chunks); HY._jobs(1e9); }
          return { cols, rows, queued, sync: HY.stat.sync - sync0, q: HY._queued() };
        } finally { G.settings.zoom = z0; G.resize(); }
      });
      t.ok(r.cols === 4 && r.rows === 3, 'görünen alan 4x3 parça', r);
      t.eq(r.queued, 0, 'yerinde dururken yeni parça işi açılmaz (atılıp yeniden pişen parça yok)');
      t.eq(r.sync, 0, 'görünen parça tek seferde yeniden pişmez');
      t.ok(r.q.cached >= 30 && r.q.cap >= 32, 'önbellek halkayı alacak kadar büyüdü', r.q);
    });

    await t.step('yükseklik tamponu dururken hiç, yürürken yalnız kenar payı aşılınca yeniden çizilir; taç altında yalnız delik yamanır', async () => {
      const r = await p.evaluate(async () => {
        const frame = () => new Promise(res => requestAnimationFrame(() => res()));
        const W = G.world, s = TH.openSpot(), P = G.player, n = () => [HY.stat.fg, HY.stat.fgp];
        TH.clearNpcs(); P.x = s[0]; P.y = s[1]; G.cam.x = P.x; G.cam.y = P.y;
        for (let k = 0; k < 8; k++) { await frame(); HY._jobs(1e9); }
        const a = n();
        for (let k = 0; k < 30; k++) await frame();
        const b = n(), x0 = P.x;
        for (let k = 0; k < 60; k++) { P.x += 2; await frame(); HY._jobs(1e9); }
        const c = n(), open = { still: b[0] - a[0], stillPatch: b[1] - a[1], walk: c[0] - b[0], moved: P.x - x0 };
        // ağacın hemen üstüne: oyuncu tacın altında, yürürken delik onunla kayar
        let tp = null;
        for (let r = 2; r < 160 && !tp; r++) for (let k = 0; k < 24 && !tp; k++) {
          const q = k / 24 * TAU, x = (P.x >> 4) + Math.round(Math.cos(q) * r), y = (P.y >> 4) + Math.round(Math.sin(q) * r);
          if (!W.inb(x, y) || W.townAt(x * TS, y * TS, 60)) continue;
          const o = W.obj[y * WW + x];
          if ((o === O.OAK || o === O.PINE) && !W.blocked(x * TS + 8, y * TS - 6, 3) && !W.blocked(x * TS + 24, y * TS - 6, 3)) tp = [x * TS + 8, y * TS - 6];
        }
        if (!tp) return { open, tree: null };
        TH.clearNpcs(); P.x = tp[0]; P.y = tp[1]; G.cam.x = P.x; G.cam.y = P.y;
        for (let k = 0; k < 8; k++) { await frame(); HY._jobs(1e9); }
        const d = n(); let under = 0;
        for (let k = 0; k < 16; k++) { P.x += 1; await frame(); if (G.playerUnderCanopy()) under++; HY._jobs(1e9); }
        const e = n();
        return { open, tree: { under, full: e[0] - d[0], patch: e[1] - d[1] } };
      });
      t.eq(r.open.still + r.open.stillPatch, 0, 'dururken yeniden çizilmez');
      t.ok(r.open.walk >= 1 && r.open.walk <= 8, '120 piksel yürüyüşte birkaç kez (her karede değil)', r.open);
      t.ok(r.tree, 'yakında ağaç var', r);
      t.ok(r.tree.under >= 8, 'oyuncu tacın altında yürüdü', r.tree);
      t.ok(r.tree.patch >= r.tree.under - 2 && r.tree.full <= 2, 'tacın altında yürürken her karede yalnız delik yamanır, tampon bütünüyle yeniden çizilmez', r.tree);
      t.eq(errs.length, 0, 'sayfa hatası yok', errs);
    });

    await t.step('renk tonları melezde son ışık geçişinde: 2D karışım geçişi çizilmez, ton görüntüye uygulanır', async () => {
      const r = await p.evaluate(async () => {
        const frame = () => new Promise(res => requestAnimationFrame(() => res()));
        // akşam mavisi tam güçte (hedef her karede zorlanır)
        const grade = FX.grade, tint = FX.tint;
        let calls = 0;
        FX.grade = function (dt) { grade.call(this, dt); this.g.blue = 1; this.g.gold = 0; };
        FX.tint = function (...a) { calls++; return tint.apply(this, a); };
        const blue = () => { const w = G.canvas.width, h = G.canvas.height, d = G.ctx.getImageData(w / 2 - 60, h / 2 - 60, 120, 120).data; let s = 0; for (let i = 0; i < d.length; i += 4) s += d[i + 2] - d[i]; return s / (d.length / 4); };
        try {
          for (let k = 0; k < 4; k++) await frame();
          const n = FX.tints().length, on = blue(), c1 = calls;
          PERF_OFF.tints = true;
          for (let k = 0; k < 3; k++) await frame();
          const off = blue();
          return { ds: G.ds, n, calls: c1, on, off };
        } finally { FX.grade = grade; FX.tint = tint; delete PERF_OFF.tints; }
      });
      t.eq(r.ds, 2, 'melez çizim');
      t.ok(r.n >= 1, 'ton etkin', r);
      t.eq(r.calls, 0, '2D ton geçişi çizilmedi');
      t.ok(r.on > r.off + 4, 'mavi ton görüntüye uygulandı', r);
      t.eq(errs.length, 0, 'sayfa hatası yok', errs);
    });

    await t.step('köşe karartması melezde son ışık geçişinde (sayfadaki katman gizli); klasikte sayfadaki katman', async () => {
      const frames = (n) => p.evaluate(async (n) => { for (let k = 0; k < n; k++) await new Promise(r => requestAnimationFrame(r)); }, n);
      const st = () => p.evaluate(() => ({ ds: G.ds, gl: document.body.classList.contains('glvig'), div: getComputedStyle(document.querySelector('#fx-vignette')).display }));
      await frames(3);
      const a = await st();
      await p.evaluate(() => { G.settings.gfx = 1; G.applySettings(); G.resize(); });
      await frames(3);
      const b = await st();
      await p.evaluate(() => { G.settings.gfx = 0; G.applySettings(); G.resize(); });
      await frames(3);
      const c = await st();
      t.ok(a.ds === 2 && a.gl && a.div === 'none', 'melezde katman gizli', a);
      t.ok(b.ds === 1 && !b.gl && b.div !== 'none', 'klasikte katman görünür', b);
      t.ok(c.ds === 2 && c.gl && c.div === 'none', 'meleze dönünce yine gizli', c);
      t.eq(errs.length, 0, 'sayfa hatası yok', errs);
    });

    await t.step('renk derecelendirmesi her çizimde tam bir kez güncellenir (melez ve klasik)', async () => {
      const r = await p.evaluate(() => {
        const gr = FX.grade, out = {};
        let n = 0;
        FX.grade = function (dt) { n++; return gr.call(this, dt); };
        try {
          for (const gfx of [0, 1]) {
            G.settings.gfx = gfx; G.applySettings(); G.resize(); G.render(1 / 60);
            n = 0; for (let k = 0; k < 10; k++) G.render(1 / 60);
            out[G.ds === 2 ? 'melez' : 'klasik'] = n;
          }
        } finally { FX.grade = gr; G.settings.gfx = 0; G.applySettings(); G.resize(); }
        return out;
      });
      t.eq(r.melez, 10, 'melez: 10 çizimde 10 güncelleme', r);
      t.eq(r.klasik, 10, 'klasik: 10 çizimde 10 güncelleme', r);
    });
  },
};
