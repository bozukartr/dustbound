'use strict';
/* Kamera: binaya girince yumuşak yakınlaşma, çıkınca uzaklaşma; yakınken fareyle nişan */
module.exports = {
  name: 'Kamera yakınlaşması',
  async run(t) {
    const p = await t.newGame();
    const z = () => p.evaluate(() => ({ z: G.camZoom ? G.camZoom.z : 1, tf: G.canvas.style.transform, inside: !!G.insideB, cx: G.cam.x, cy: G.cam.y }));
    await t.step('dışarıda yakınlaşma yok', async () => {
      await p.evaluate(() => {
        G.clock = Math.floor(G.clock / 1440) * 1440 + 12 * 60;
        const b = G.world.buildings.find(x => x.type === 'general' && x.town === 'harlow'); window.GB = b;
        TH.goto(b.door.x, b.door.y + 26); TH.clearNpcs(); G.player.ang = -Math.PI / 2;
      });
      await t.sleep(900);
      const r = await z();
      t.near(r.z, 1, 0.001, 'ölçek'); t.eq(r.tf, '', 'dönüşüm yok'); t.ok(!r.inside, 'dışarıda');
    });
    await t.step('yürüyerek girince kamera yumuşakça binaya yaklaşır ve binayı ortalar', async () => {
      await p.keyboard.down('KeyW');
      const samples = [];
      for (let k = 0; k < 14; k++) { await t.sleep(90); samples.push((await z()).z); }
      await p.keyboard.up('KeyW');
      await t.sleep(1000);
      const r = await p.evaluate(() => {
        const b = GB, Z = G.camZoom, bw = b.w * TS * Z.z, bh = (b.h + 1) * TS * Z.z;
        return { z: Z.z, inside: G.insideB === b, dx: Math.abs(G.cam.x - (b.x + b.w / 2) * TS), dy: Math.abs(G.cam.y - (b.y + b.h / 2) * TS), fillW: bw / G.vw, fillH: bh / G.vh, tf: G.canvas.style.transform, expect: G.zoomFor(b) };
      });
      t.ok(r.inside, 'içeride');
      t.ok(r.z > 1.2, 'yakınlaşmış olmalı', r.z); t.near(r.z, r.expect, 0.001, 'hedef ölçek');
      t.ok(/scale/.test(r.tf), 'tuval ölçeklenmeli');
      t.ok(Math.max(r.fillW, r.fillH) < 0.95 && Math.max(r.fillW, r.fillH) > 0.6, 'bina ekranı doldurmamalı ama büyük görünmeli', r);
      t.ok(r.dx < 12 && r.dy < 12, 'bina ortalanmalı', r);
      // geçiş kademeli olmalı: ara değerler görülmeli ve artarak gitmeli
      const mid = samples.filter(v => v > 1.02 && v < r.z - 0.02);
      t.ok(mid.length >= 2, 'yumuşak geçiş (ara değerler)', samples);
      t.ok(samples.every((v, i) => i === 0 || v >= samples[i - 1] - 1e-6), 'geçiş geri dönmemeli', samples);
    });
    await t.step('yakınken fareyle nişan doğru yöne bakar', async () => {
      await p.evaluate(() => { const P = G.player; P.giveWeapon('cattleman', true); P.weapon = 'cattleman'; });
      const pt = await p.evaluate(() => {
        const P = G.player, r = G.canvas.getBoundingClientRect(), k = r.width / G.canvas.width;
        // oyuncunun 40 piksel sağındaki noktanın ekran konumu
        return { x: r.left + (P.x + 40 - G.cam.ox) * k, y: r.top + (P.y - G.cam.oy) * k };
      });
      await p.mouse.move(pt.x, pt.y); await t.sleep(250);
      const a = await p.evaluate(() => G.player.aimAng);
      t.near(a, 0, 0.12, 'sağa nişan');
    });
    await t.step('sarhoşken içeride hem sallantı hem yakınlaşma birlikte uygulanır', async () => {
      await p.evaluate(() => { G.player.drunk = 90; });
      await t.sleep(2500);
      const r = await p.evaluate(() => ({ tf: G.canvas.style.transform, z: G.camZoom.z }));
      t.ok(/scale\(1\.[2-9]/.test(r.tf) && /rotate/.test(r.tf), 'yakınlaşma ve dönme birlikte', r);
      await p.evaluate(() => { G.player.drunk = 0; FX.g.drunk = 0; });
      await t.sleep(400);
      t.ok(/^scale\(/.test(await p.evaluate(() => G.canvas.style.transform)), 'ayılınca yalnızca yakınlaşma kalır');
    });
    await t.step('çıkınca kamera aynı yumuşaklıkla uzaklaşır', async () => {
      await p.evaluate(() => { const P = G.player; P.x = GB.door.x; P.y = GB.door.y - 18; P.ang = Math.PI / 2; });
      await p.keyboard.down('KeyS');
      const samples = [];
      for (let k = 0; k < 14; k++) { await t.sleep(90); samples.push((await z()).z); }
      await p.keyboard.up('KeyS');
      await t.sleep(1000);
      const r = await z();
      t.ok(!r.inside, 'dışarıda'); t.near(r.z, 1, 0.001, 'ölçek 1'); t.eq(r.tf, '', 'dönüşüm kalktı');
      t.ok(samples.some(v => v > 1.02 && v < 1.9), 'kademeli uzaklaşma', samples);
    });
  },
};
