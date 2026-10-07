'use strict';
/* Deneme 3D çizici (js/r3d.js): ayardan açılır, kasabada gündüz/gece ve bina içinde hatasız çizer,
   gece ışıkları toplar, kapatınca 2D çizime döner. */
module.exports = {
  name: '3D çizim (deneme)',
  async run(t) {
    const p = await t.newGame();
    const errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    const frames = () => p.evaluate(() => R3D.stat.frames);
    await p.evaluate(() => {
      UI.el.help.classList.add('hidden');
      const tw = G.world.towns[0], b = G.world.buildings.find(q => q.town === tw.id && q.type === 'saloon') || G.world.buildings.find(q => q.town === tw.id && q.enter);
      window.B = b;
      TH.goto(b.door.x, b.door.y + 40);
      G.clock = Math.floor(G.clock / 1440) * 1440 + 14 * 60;
    });

    await t.step('ayarlarda "3D Çizim (deneme)" satırı var', async () => {
      const ok = await p.evaluate(() => { UI.openSettings(2); const has = /3D/.test(document.querySelector('.panel.settings').textContent); UI.closeAll(); return has; });
      t.ok(ok, 'Görüntü sekmesinde');
    });

    await t.step('açılınca kasabayı 3D çizer: GL hatası yok, sahne boş değil, modeller kuruldu', async () => {
      await p.evaluate(() => { G.settings.r3d = true; });
      await t.sleep(2500);
      const f0 = await frames(); await t.sleep(800);
      const r = await p.evaluate(() => {
        const c = G.ctx.getImageData(0, 0, G.vw, G.vh).data; let s = 0, s2 = 0, n = 0;
        for (let i = 0; i < c.length; i += 16) { const v = (c[i] + c[i + 1] + c[i + 2]) / 3; s += v; s2 += v * v; n++; }
        const mean = s / n;
        return { stat: Object.assign({}, R3D.stat, { seg: null }), mean, sd: Math.sqrt(s2 / n - mean * mean), bld: !!(B._r3 && B._r3.n > 0) };
      });
      t.ok(r.stat.frames > f0, '3D kareler çiziliyor', r.stat.frames);
      t.eq(r.stat.err, '', 'GL hatası yok');
      t.ok(r.mean > 40 && r.sd > 8, 'gündüz sahnesi aydınlık ve ayrıntılı (düz renk değil)', r);
      t.ok(r.stat.tris > 2000 && r.stat.chunks > 0, 'zemin ve modeller çizildi', r.stat);
      t.ok(r.bld, 'binanın modeli kuruldu');
    });

    await t.step('gece fener ve pencere ışıkları toplanır; gündüz fenerler sönüktür', async () => {
      const day = await p.evaluate(() => R3D.stat.lights);
      await p.evaluate(() => { G.clock = Math.floor(G.clock / 1440) * 1440 + 22 * 60; });
      await t.sleep(1200);
      const r = await p.evaluate(() => ({ lights: R3D.stat.lights, err: R3D.stat.err }));
      t.ok(r.lights > day, 'gece daha çok ışık', { day, night: r.lights });
      t.eq(r.err, '', 'GL hatası yok');
    });

    await t.step('bina içinde (çatı kalkar, duvar alçalır) hatasız çizer', async () => {
      await p.evaluate(() => TH.inside(B));
      await t.sleep(1200);
      const r = await p.evaluate(() => ({ inside: G.insideB === B, err: R3D.stat.err, f: R3D.stat.frames }));
      await t.sleep(400);
      t.ok(r.inside, 'oyuncu içeride');
      t.ok(await frames() > r.f, 'çizim sürüyor');
      t.eq(r.err, '', 'GL hatası yok');
    });

    await t.step('kapatınca 2D çizime döner', async () => {
      await p.evaluate(() => { G.settings.r3d = false; });
      await t.sleep(300);
      const f0 = await frames(); await t.sleep(600);
      t.eq(await frames(), f0, '3D kare çizilmiyor');
      t.eq(errs.length, 0, 'sayfa hatası yok', errs);
    });
  },
};
