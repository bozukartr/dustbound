'use strict';
/* Grafik ayarları (Ayarlar → Grafik, js/fx.js GFX): bölüm başlıklı sekme, hazır seviyeler (Düşük, Orta, Yüksek, Ultra, Özel),
   eski "Görsel Efektler: Sade" ayarının Orta'ya taşınması, Klasik'te yalnızca Melez'de etkili ayarların soluk görünmesi;
   her ayarın gerçek etkisi (parçacık, hava, bulut, renk derecelendirmesi, salınan bitkiler, duman, ayak izleri, çevre
   ayrıntıları, köşe karartması, parlaklık), Melez'de gölge ve ortam gölgesi geçişi, ışık sayısı, parlama, yarım
   çözünürlük ve kare hızı sınırı. */
module.exports = {
  name: 'Grafik ayarları',
  async run(t) {
    const p = await t.page();
    const errs = [];
    p.on('pageerror', (e) => errs.push(e.message));

    await t.step('eski "Görsel Efektler: Sade" ayarı Orta seviyeye taşınır; yeni kayıtta Yüksek', async () => {
      t.eq(await p.evaluate(() => [G.settings.gfxPreset, 'fxq' in G.settings]), [2, false], 'varsayılan Yüksek, eski anahtar yok');
      await p.evaluate(() => {
        const s = JSON.parse(localStorage.getItem('frontiersend_settings_v1') || '{}');
        for (const k of GFX_KEYS) delete s[k];
        delete s.gfxPreset; s.fxq = 1;
        localStorage.setItem('frontiersend_settings_v1', JSON.stringify(s));
      });
      await p.reload(); await p.waitForFunction(() => typeof G !== 'undefined' && G.state === 'menu');
      const r = await p.evaluate(() => ({ preset: G.settings.gfxPreset, fxq: 'fxq' in G.settings, orta: GFX_KEYS.every(k => G.settings[k] === GFX_PRESETS[1][k]) }));
      t.eq(r.preset, 1, 'Orta'); t.ok(!r.fxq, 'eski anahtar silinir'); t.ok(r.orta, 'değerler Orta seviyenin değerleri', r);
      await p.evaluate(() => { GFX.apply(G.settings, 2); G.saveSettings(); });
    });

    await t.step('Grafik sekmesi: bölüm başlıkları, satırlar, Melez etiketleri; varsayılan Yüksek', async () => {
      const r = await p.evaluate(() => {
        UI.openSettings(3);
        const el = document.querySelector('.panel.settings');
        const o = {
          tab: document.querySelector('.st-tabs .tab.on').textContent,
          keys: [...el.querySelectorAll('.st-row')].map(n => n.dataset.k),
          hdr: [...el.querySelectorAll('.st-hdr')].map(n => n.textContent),
          tags: [...el.querySelectorAll('.st-row .st-tag')].map(n => n.closest('.st-row').dataset.k),
          preset: el.querySelector('.st-row[data-k="gfxPreset"] .st-seg span.on').textContent,
          shown: getComputedStyle(el.querySelector('.st-hdr')).display !== 'none',
          disp: [...document.querySelectorAll('.panel.settings')].length,
        };
        UI.closeAll();
        UI.openSettings(2);
        o.disp2 = [...document.querySelectorAll('.st-row')].map(n => n.dataset.k);
        UI.closeAll();
        return o;
      });
      t.ok(/Grafik/.test(r.tab), 'Grafik sekmesi', r.tab);
      t.eq(r.keys, ['gfxPreset', 'gfx', 'hyRes', 'fpsCap', 'gpu', 'shadows', 'ao', 'lightN', 'lightOcc', 'bloom', 'clouds', 'weather', 'parts', 'tracks', 'smoke', 'sway', 'ambient', 'grade', 'vignette', 'tone', 'bright'], 'satırlar');
      t.eq(r.hdr.length, 4, 'dört bölüm başlığı', r.hdr);
      t.ok(r.shown, 'başlıklar görünür');
      t.eq(r.tags, ['hyRes', 'ao', 'lightOcc'], 'yalnızca Melez\'de etkili ayarların etiketi');
      t.eq(r.preset, 'Yüksek', 'hazır ayar Yüksek');
      t.ok(!r.disp2.includes('gfx') && !r.disp2.includes('fxq') && r.disp2.includes('zoom'), 'Görüntü sekmesinde grafik satırları kalmadı', r.disp2);
    });

    await t.step('hazır seviye bütün ayarları kurar; tek ayar değişince Özel olur; Özel değerleri korur; Alt Yüksek\'e döndürür', async () => {
      const vals = () => p.evaluate(() => Object.assign({ preset: G.settings.gfxPreset }, ...GFX_KEYS.map(k => ({ [k]: G.settings[k] }))));
      await p.evaluate(() => UI.openSettings(3, 'gfxPreset')); await t.sleep(150);
      await p.click('.st-row[data-k="gfxPreset"] [data-v="0"]'); await t.sleep(100);
      const low = await vals(), P0 = await p.evaluate(() => GFX_PRESETS[0]);
      t.eq(low.preset, 0, 'Düşük'); for (const k in P0) t.eq(low[k], P0[k], 'Düşük: ' + k);
      await p.click('.st-row[data-k="bloom"] .st-tog'); await t.sleep(100);
      const cus = await vals();
      t.eq([cus.preset, cus.bloom, cus.shadows], [4, 1, 0], 'parlama açılınca seviye Özel');
      t.eq(await p.evaluate(() => document.querySelector('.st-row[data-k="gfxPreset"] .st-seg span.on').textContent), 'Özel', 'satırda Özel seçili');
      await p.click('.st-row[data-k="gfxPreset"] [data-v="4"]'); await t.sleep(100);
      const cus2 = await vals();
      t.eq([cus2.preset, cus2.bloom, cus2.shadows], [4, 1, 0], 'Özel seçmek değerleri değiştirmez');
      await p.click('.st-row[data-k="gfxPreset"] [data-v="3"]'); await t.sleep(100);
      const ul = await vals();
      t.eq([ul.preset, ul.shadows, ul.parts, ul.hyRes], [3, 3, 2, 0], 'Ultra: ince gölge, çok parçacık, tam çözünürlük');
      // klavye: Ultra'dan sağa Düşük'e döner (Özel atlanır), soldan Ultra'ya
      await p.evaluate(() => UI.top().setFocus(document.querySelector('.st-row[data-k="gfxPreset"]'), true));
      await p.keyboard.press('ArrowRight'); await t.sleep(100);
      const wrap = await vals();
      await p.keyboard.press('ArrowLeft'); await t.sleep(100);
      const back = await vals();
      t.eq([wrap.preset, wrap.shadows, back.preset, back.shadows], [0, 0, 3, 3], 'klavyeyle dört seviye arasında döner');
      await p.keyboard.press('KeyX'); await t.sleep(150);
      const hi = await vals();
      t.eq([hi.preset, hi.shadows, hi.parts, hi.bloom], [2, 2, 1, 1], 'Alt: sekme varsayılana (Yüksek)');
      await p.keyboard.press('Escape'); await t.sleep(150);
      t.eq(await p.evaluate(() => JSON.parse(localStorage.getItem('frontiersend_settings_v1')).gfxPreset), 2, 'kaydedilir');
    });

    await t.step('Klasik çizimde yalnızca Melez\'de etkili satırlar soluk; yan panel söyler', async () => {
      const r = await p.evaluate(() => {
        window.__hySoft = true; G.settings.gfx = 0; G.applySettings();
        UI.openSettings(3, 'hyRes');
        const mel = { dim: [...document.querySelectorAll('.st-row.st-dim')].map(n => n.dataset.k), side: document.querySelector('.st-side').innerText };
        UI.closeAll();
        G.settings.gfx = 1; G.applySettings();
        UI.openSettings(3, 'hyRes');
        const kla = { dim: [...document.querySelectorAll('.st-row.st-dim')].map(n => n.dataset.k), side: document.querySelector('.st-side').innerText };
        UI.closeAll();
        G.settings.gfx = 0; G.applySettings();
        return { mel, kla };
      });
      t.eq(r.mel.dim, [], 'Melez\'de soluk satır yok');
      t.ok(/yalnızca Melez/i.test(r.mel.side), 'Melez\'de de not var', r.mel.side);
      t.eq(r.kla.dim, ['hyRes', 'ao', 'lightOcc'], 'Klasik\'te üç satır soluk');
      t.ok(/şu an Klasik/i.test(r.kla.side), 'yan panel Klasik\'te etkisiz olduğunu söyler', r.kla.side);
    });

    // oyun adımları yeni sayfada (varsayılan ayarlar: Yüksek)
    const g = await t.newGame();
    g.on('pageerror', (e) => errs.push(e.message));
    await g.evaluate(() => {
      window.__hySoft = false; GFX.apply(G.settings, 2); G.settings.gfx = 1; G.applySettings(); TH.clearNpcs();
      const b = G.world.buildings.find(q => q.town === G.world.towns[0].id && q.type === 'saloon');
      window.GB = b; TH.goto(b.door.x + 10, b.door.y + 26);
    });
    await t.sleep(500);

    await t.step('efekt ayarları gerçekten etkiler: parçacık, hava, bulut, derecelendirme, bitkiler, duman, iz, çevre, köşe, parlaklık', async () => {
      const r = await g.evaluate(() => {
        const S = G.settings, W = G.world, P = G.player, o = {};
        // sayan sahte tuval: çizim çağrıları
        const count = (fn) => { let n = 0; const ctx = new Proxy({}, { get: (_, k) => (k === 'moveTo' || k === 'fillRect' || k === 'drawImage') ? () => { n++; } : () => {}, set: () => true }); fn(ctx); return n; };
        // parçacıklar: doğma oranı ve en çok
        const burst = (lv) => { S.parts = lv; G.parts.list.length = 0; for (let i = 0; i < 3000; i++) G.parts.add('dust', P.x, P.y, 0, 0, 9, 1); const n = G.parts.list.length; G.parts.add('tracer', P.x, P.y, 0, 0, 1, 1); const tr = G.parts.list.length > n || n >= GFX.PARTS[lv][1]; G.parts.list.length = 0; return [n, tr]; };
        o.parts = [burst(0), burst(1), burst(2)];
        S.parts = 1;
        // hava: yağmur çizgileri (yoğunluk)
        const env0 = G.envCache;
        G.envCache = { rain: 1, snow: 0, dust: 0, fog: 0, cloud: 0 };
        S.weather = 1; const w1 = count(c => G.drawWeather(c, 0.016));
        S.weather = 0; const w0 = count(c => G.drawWeather(c, 0.016));
        S.weather = 1; o.weather = [w0, w1];
        G.envCache = env0;
        // bulut gölgeleri: öğlen, parçalı bulutlu
        const ck = G.clock, wt = G.weather;
        G.clock = Math.floor(G.clock / 1440) * 1440 + 12 * 60; G.weather = { type: 'cloudy', t: 999, i: 0.3, cloud: 0.5, fogI: 0 };
        const fog = (G.envCache || {}).fog; if (G.envCache) G.envCache.fog = 0;
        S.clouds = 1; const c1 = count(c => FX.drawClouds(c)); S.clouds = 0; const c0 = count(c => FX.drawClouds(c)); S.clouds = 1;
        o.clouds = [c0, c1];
        G.clock = ck; G.weather = wt; if (G.envCache) G.envCache.fog = fog;
        // renk derecelendirmesi: ortam tonları gider, durum tonları kalır
        const g0 = Object.assign({}, FX.g); FX.g.gold = 1; FX.g.hurt = 1;
        S.grade = 1; const q1 = FX.tints(); S.grade = 0; const q0 = FX.tints(); S.grade = 1;
        o.grade = [q0.filter(x => x[0] === 0).length, q1.filter(x => x[0] === 0).length, q0.filter(x => x[0] === 4).length];
        Object.assign(FX.g, g0);
        // salınan bitkiler
        S.sway = 0; const d0 = FX.dyn(O.TUFT); S.sway = 1; o.sway = [d0, FX.dyn(O.TUFT)];
        // duman: kamp ateşi
        const smoke = (lv) => { S.smoke = lv; FX.smoke.length = 0; for (let i = 0; i < 400; i++) FX.fireSmoke(P.x, P.y, 0.05); const n = FX.smoke.length; FX.smoke.length = 0; return n; };
        o.smoke = [smoke(0), smoke(1)];
        // ayak izleri: yumuşak zeminde yürüyen sahte varlık
        let soft = null;
        for (let ty = 8; ty < WH - 8 && !soft; ty += 7) for (let tx = 8; tx < WW - 16 && !soft; tx += 7) {
          const x = tx * TS + 8, y = ty * TS + 8;
          if (FX.softAt(x, y) && FX.softAt(x + 100, y) && !W.isWaterPx(x, y) && !W.isWaterPx(x + 100, y)) soft = [x, y];
        }
        const walk = (lv) => { S.tracks = lv; FX.tracks.length = 0; FX.snowTracks.length = 0; const e = { x: soft[0], y: soft[1] }; for (let i = 0; i < 60; i++) { e.x += 1.6; FX.mover(e, 'foot', 0.016, 0); } return FX.tracks.length + FX.snowTracks.length; };
        o.tracks = soft ? [walk(0), walk(1)] : null;
        S.tracks = 1;
        // çevre ayrıntıları: yaz gecesi çayırda ateş böcekleri
        let grass = null;
        for (let r = 1; r < 300 && !grass; r++) for (let a = 0; a < 16 && !grass; a++) {
          const x = P.x + Math.cos(a / 16 * TAU) * r * 16, y = P.y + Math.sin(a / 16 * TAU) * r * 16;
          if (W.areaTile(x, y) === T.GRASS && !W.townAt(x, y, 4)) grass = [x, y];
        }
        if (grass) {
          const px = P.x, py = P.y, sea = W.season, env1 = G.envCache;
          P.x = grass[0]; P.y = grass[1]; W.season = 1; G.clock = Math.floor(G.clock / 1440) * 1440 + 23 * 60; G.envCache = { rain: 0, snow: 0, dust: 0, fog: 0, cloud: 0 };
          const fl = (lv) => { S.ambient = lv; Juice.flies.length = 0; Juice.update(0.016); return Juice.flies.length; };
          o.ambient = [fl(0), fl(1)];
          Juice.flies.length = 0; S.ambient = 1; P.x = px; P.y = py; W.season = sea; G.clock = ck; G.envCache = env1;
        } else o.ambient = null;
        // köşe karartması ve parlaklık (Klasik: sayfa katmanı ve CSS süzgeci)
        S.vignette = 0; S.bright = 0; G.applySettings();
        o.vig0 = document.body.classList.contains('novig'); o.bri0 = getComputedStyle(document.documentElement).getPropertyValue('--bri').trim();
        S.vignette = 1; S.bright = 2; G.applySettings();
        o.vig1 = document.body.classList.contains('novig'); o.bri1 = getComputedStyle(document.documentElement).getPropertyValue('--bri').trim();
        o.filter = getComputedStyle(G.canvas).filter;
        return o;
      });
      const [p0, p1, p2] = r.parts;
      t.ok(p0[0] > 150 && p0[0] <= 321, 'Az: parçacıkların %40\'ı doğar, en çok 320', p0);
      t.ok(p1[0] === 701, 'Normal: en çok 700', p1);
      t.ok(p2[0] === 1401, 'Çok: en çok 1400', p2);
      t.ok(p0[1], 'mermi izi Az\'da da çizilir');
      t.ok(r.weather[1] > 0 && Math.abs(r.weather[0] / r.weather[1] - 0.4) < 0.05, 'hava: Az yağmur damlalarının %40\'ı', r.weather);
      t.ok(r.clouds[1] > 0 && r.clouds[0] === 0, 'bulut gölgeleri kapanır', r.clouds);
      t.ok(r.grade[1] > 0 && r.grade[0] === 0 && r.grade[2] > 0, 'derecelendirme kapanınca ortam tonları gider, düşük sağlık tonu kalır', r.grade);
      t.eq(r.sway, [false, true], 'salınan bitkiler');
      t.ok(r.smoke[1] > r.smoke[0] * 1.5 && r.smoke[0] > 0, 'duman: Az daha seyrek', r.smoke);
      t.ok(r.tracks && r.tracks[1] > 3 && r.tracks[0] === 0, 'ayak izleri kapanır', r.tracks);
      t.ok(r.ambient && r.ambient[1] > 0 && r.ambient[0] === 0, 'çevre ayrıntıları: yaz gecesi ateş böcekleri', r.ambient);
      t.ok(r.vig0 && !r.vig1, 'köşe karartması katmanı gizlenir');
      t.eq([r.bri0, r.bri1], ['0.8', '1'], 'parlaklık çarpanı');
      t.ok(/brightness\(1\)/.test(r.filter), 'Klasik tuvalin süzgecinde parlaklık', r.filter);
      t.eq(errs, [], 'sayfada hata yok');
    });

    await t.step('kare hızı sınırı: 30 seçilince saniyede yarı kadar kare çizilir', async () => {
      const rate = (cap) => g.evaluate((cap) => new Promise(res => { G.settings.fpsCap = cap; const f0 = G.fno; setTimeout(() => res(G.fno - f0), 1500); }), cap);
      await rate(0);
      const free = await rate(0), c30 = await rate(4), c60 = await rate(3);
      await g.evaluate(() => { G.settings.fpsCap = 0; });
      t.ok(free > 60, 'sınırsız', free);
      t.ok(Math.abs(c30 / free - 0.5) < 0.12, '30: yarısı', { free, c30 });
      t.ok(Math.abs(c60 / free - 1) < 0.12, '60 Hz ekranda 60: değişmez', { free, c60 });
    });

    await t.step('Melez: gölge ve ortam gölgesi geçişi, ışık sayısı, parlama, köşe karartması ayara göre', async () => {
      await g.evaluate(() => { window.__hySoft = true; G.settings.gfx = 0; G.applySettings(); G.clock = Math.floor(G.clock / 1440) * 1440 + 22 * 60; G.weather = { type: 'clear', t: 99999, i: 0, cloud: 0, fogI: 0 }; TH.goto(GB.door.x + 10, GB.door.y + 26); });
      await t.sleep(1500);
      const at = async (set) => { await g.evaluate((set) => { Object.assign(G.settings, set); G.settings.gfxPreset = GFX.presetOf(G.settings); G.applySettings(); }, set); await t.sleep(700); return g.evaluate(() => Object.assign({}, { lights: HY.stat.lights, sh: HY.stat.sh, bloom: HY.stat.bloom, vig: HY.stat.vig, D: HY.stat.D, hy: G.hy, ds: G.ds })); };
      const many = await at({ lightN: 2 }), few = await at({ lightN: 0 });
      t.ok(many.lights > 6, 'gece kasabada 6\'dan çok ışık', many);
      t.ok(few.lights <= 6, 'Az: en çok 6 ışık', few);
      const off = await at({ lightN: 2, shadows: 0, ao: 0 }), aoOnly = await at({ ao: 1 }), lo = await at({ shadows: 1 }), ul = await at({ shadows: 3 });
      t.eq([off.sh, aoOnly.sh, lo.sh, ul.sh], [-1, 0, 1, 3], 'gölge geçişi: ikisi kapalıyken yok, yalnız ortam gölgesi, düşük, ultra');
      const nb = await at({ shadows: 2, bloom: 0, vignette: 0 }), yb = await at({ bloom: 1, vignette: 1 });
      t.eq([nb.bloom, nb.vig, yb.bloom, yb.vig], [false, false, true, true], 'parlama ve köşe karartması');
      t.eq(errs, [], 'sayfada hata yok');
    });

    await t.step('Melez parlaklık: görüntü parlaklaşır', async () => {
      const lum = async (b) => { await g.evaluate((b) => { G.settings.bright = b; G.applySettings(); G.clock = Math.floor(G.clock / 1440) * 1440 + 13 * 60; }, b); await t.sleep(700); return g.evaluate(() => { const c = G.ctx.getImageData(0, 0, G.canvas.width, G.canvas.height).data; let s = 0, n = 0; for (let i = 0; i < c.length; i += 64) { s += c[i] + c[i + 1] + c[i + 2]; n++; } return s / n / 3; }); };
      const dark = await lum(0), norm = await lum(2), bright = await lum(4);
      await g.evaluate(() => { G.settings.bright = 2; G.applySettings(); });
      t.ok(dark < norm - 5 && bright > norm + 5, 'parlaklık sırası', { dark, norm, bright });
    });

    await t.step('Melez yarım çözünürlük: tuval dünya pikseli başına 1, kamera tam piksel; aynı sahne çizilir', async () => {
      const shot = () => g.evaluate(() => { const c = G.ctx.getImageData(0, 0, G.canvas.width, G.canvas.height).data; let s = 0, n = 0; for (let i = 0; i < c.length; i += 16) { s += c[i] + c[i + 1] + c[i + 2]; n++; } return { mean: s / n / 3, cw: G.canvas.width, vw: G.vw, ds: G.ds, hy: G.hy, D: HY.stat.D, f: HY.stat.frames }; });
      const full = await shot();
      await g.evaluate(() => { G.settings.hyRes = 1; G.settings.gfxPreset = GFX.presetOf(G.settings); G.applySettings(); });
      await t.sleep(1200);
      const half = await shot();
      await t.sleep(400);
      const half2 = await shot();
      const cam = await g.evaluate(() => { const P = G.player, out = []; for (let i = 0; i < 20; i++) { P.x += 0.37; G.updateCamera(1 / 60); out.push(G.cam.ox); } return out.every(v => Math.abs(v - Math.round(v)) < 1e-9); });
      await g.evaluate(() => { G.settings.hyRes = 0; G.settings.gfxPreset = GFX.presetOf(G.settings); G.applySettings(); });
      await t.sleep(800);
      const back = await shot();
      t.eq([full.ds, full.D, full.cw === full.vw * 2], [2, 2, true], 'tam: iki kat yoğun');
      t.eq([half.ds, half.D, half.cw === half.vw, half.hy], [1, 1, true, true], 'yarım: tek kat, melez açık');
      t.ok(half2.f > half.f, 'yarımda kareler çizilir');
      t.ok(Math.abs(half.mean - full.mean) < full.mean * 0.12, 'aynı sahne (ortalama parlaklık yakın)', { full: full.mean, half: half.mean });
      t.ok(cam, 'kamera tam piksel ızgarasında');
      t.eq([back.ds, back.D], [2, 2], 'tama dönülür');
      t.eq(errs, [], 'sayfada hata yok');
    });
  },
};
