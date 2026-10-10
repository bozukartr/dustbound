'use strict';
/* Dünya önbelleği: kayıt yüklenince dünya sıfırdan üretilmez, önbellekten gelir ve taze üretilenle birebir aynıdır */
module.exports = {
  name: 'Dünya önbelleği',
  timeout: 240000,
  async run(t) {
    const p = await t.newGame();

    await t.step('yeni hayatın dünyası arka planda önbelleğe yazılır', async () => {
      const r = await p.evaluate(async () => { const ok = await WorldCache._saving; return { ok, last: WorldCache.last, key: WorldCache.key(G.seed) }; });
      t.ok(r.ok, 'önbelleğe yazıldı', r);
      t.eq(r.last.saved, r.key, 'kayıt anahtarı');
      t.ok(r.last.bytes > 100000 && r.last.bytes < 8e6, 'sıkıştırılmış boyut makul', r.last);
    });

    // önbellekten gelen dünya ile aynı tohumdan taze üretilen dünya: alanlar, paylaşılan başvurular, tablo bağları, harita
    // (dünya boyu değişecekse oyun açık olmayan ayrı bir sayfada)
    const compare = (pg, ww, wgen, seed) => pg.evaluate(async ({ ww, wgen, seed }) => {
      const keep = [WW, WGEN];
      setWorldSize(ww); WGEN = wgen;
      try {
        const A = new World(seed); await A.generate(() => {});
        if (seed !== G.seed || ww !== keep[0] || wgen !== keep[1]) { const ok = await WorldCache.save(A); if (!ok) return { err: 'yazılamadı' }; }
        const B = await WorldCache.load(seed, 0);
        if (!B) return { err: 'önbellekten gelmedi', last: WorldCache.last };
        const map = new Map(), bad = [];
        const same = (a, b, pth) => {
          if (bad.length > 5 || a === b) return;
          if (typeof a !== typeof b || typeof a !== 'object' || a === null || b === null) { if (!(Number.isNaN(a) && Number.isNaN(b))) bad.push(pth); return; }
          if (map.has(a)) { if (map.get(a) !== b) bad.push(pth + ' (paylaşım)'); return; }
          map.set(a, b);
          if (Object.getPrototypeOf(a) !== Object.getPrototypeOf(b)) { bad.push(pth + ' (tür)'); return; }
          // tipli diziler bayt bayt (NaN hücreler de birebir)
          if (ArrayBuffer.isView(a)) { const x = new Uint8Array(a.buffer, a.byteOffset, a.byteLength), y = new Uint8Array(b.buffer, b.byteOffset, b.byteLength); if (x.length !== y.length) bad.push(pth + ' (boy)'); else for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) { bad.push(pth + '[' + i + ']'); return; } return; }
          if (a instanceof Map || a instanceof Set) { const x = [...a.entries()], y = [...b.entries()]; if (x.length !== y.length) bad.push(pth + ' (boy)'); else x.forEach((e, i) => { same(e[0], y[i][0], pth); same(e[1], y[i][1], pth); }); return; }
          const ka = Object.keys(a), kb = Object.keys(b);
          if (ka.join() !== kb.join()) { bad.push(pth + ' (anahtar)'); return; }
          for (const k of ka) same(a[k], b[k], pth + '.' + k);
        };
        for (const k of Object.keys(A)) if (!['rng', 'chunks', 'jobs', 'mapCanvas'].includes(k)) same(A[k], B[k], 'W.' + k);
        const defs = A.buildings.every((b, i) => B.buildings[i].def === b.def && b.def === BUILDINGS[b.type]);
        const towns = A.towns.every((t, i) => ['b', 'xb', 'rb'].every(k => B.towns[i][k] === t[k]));
        const px = (w) => w.mapCanvas.getContext('2d').getImageData(0, 0, w.mapCanvas.width, w.mapCanvas.height).data;
        const ma = px(A), mb = px(B); let mdiff = 0; for (let i = 0; i < ma.length; i++) if (ma[i] !== mb[i]) mdiff++;
        return { objs: map.size, bad, keys: Object.keys(A).join() === Object.keys(B).join(), defs, towns, mdiff, last: WorldCache.last };
      } finally { setWorldSize(keep[0]); WGEN = keep[1]; }
    }, { ww, wgen, seed });

    await t.step('önbellekten gelen dünya, aynı tohumdan taze üretilenle birebir aynıdır', async () => {
      const r = await compare(p, await p.evaluate(() => WW), await p.evaluate(() => WGEN), await p.evaluate(() => G.seed));
      t.ok(!r.err, 'önbellekten geldi', r);
      t.ok(r.last.hit, 'önbellek isabeti', r.last);
      t.ok(r.objs > 5000, 'nesneler karşılaştırıldı', r.objs);
      t.eq(r.bad, [], 'alanlar ve paylaşılan başvurular aynı');
      t.ok(r.keys, 'alan sırası aynı');
      t.ok(r.defs && r.towns, 'bina tanımları ve kasaba listeleri genel tablolardaki nesneler', r);
      t.eq(r.mdiff, 0, 'harita resmi aynı');
    });

    await t.step('eski (1024, sürüm 1) dünya da önbellekten aynı gelir', async () => {
      const r = await compare(await t.page(), 1024, 1, 4242);
      t.ok(!r.err, 'önbellekten geldi', r);
      t.eq(r.bad, [], 'alanlar aynı');
      t.ok(r.keys && r.defs && r.towns, 'sıra ve tablo bağları', r);
      t.eq(r.mdiff, 0, 'harita resmi aynı');
    });

    await t.step('Devam Et: kayıt yüklenince dünya yeniden üretilmez, kaydın mevsimiyle açılır', async () => {
      await p.evaluate(() => { G.clock += 0; G.saveGame(); });
      await p.reload();
      await p.waitForFunction(() => typeof G !== 'undefined' && G.state === 'menu', null, { timeout: 60000 });
      // (üretimi saymak için World.prototype sarılmaz: önbellek özeti üretim kodunun metnini içerir)
      const r = await p.evaluate(async () => {
        const ok = await G.loadGame();
        return { ok, last: WorldCache.last, state: G.state, season: G.season, worldSeason: G.world.season, map: !!G.world.mapCanvas };
      });
      t.ok(r.ok && r.state === 'play', 'kayıt yüklendi', r);
      t.ok(r.last && r.last.hit === true, 'dünya üretilmedi, önbellekten geldi', r.last);
      t.eq(r.worldSeason, r.season, 'dünyanın mevsimi kaydınki');
      t.ok(r.map, 'harita hazır');
    });

    await t.step('dil değişince önbellek kullanılmaz, dünya yeniden üretilir', async () => {
      const r = await p.evaluate(async () => {
        const lang = I18N.lang, other = lang === 'tr' ? 'en' : 'tr';
        I18N.setLang(other);
        let miss = null;
        try {
          const load = WorldCache.load;
          WorldCache.load = async function (...a) { const w = await load.apply(this, a); miss = !w; return w; };
          await G.loadGame();
          WorldCache.load = load;
        } finally { I18N.setLang(lang); }
        const saved = await WorldCache._saving;
        return { miss, saved, key: WorldCache.last && WorldCache.last.saved, other, state: G.state };
      });
      t.eq(r.miss, true, 'başka dilde önbellek kullanılmadı, dünya yeniden üretildi');
      t.ok(r.saved && String(r.key).endsWith('_' + r.other), 'o dilin dünyası ayrıca önbelleğe yazıldı', r);
      t.ok(r.state === 'play', 'oyun açık', r);
    });
  },
};
