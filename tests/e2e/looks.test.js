'use strict';
/* Döneme göre giyim (data.js LOOK_ERAS, randomLook): 1910'dan sonra erkeklerde fötr ve kasket, kadınlarda çan şapka;
   1935'ten sonra şapkasızlar çoğalır. Aynı tohum her dönemde aynı yüzü ve adı verir (yalnızca kıyafet değişir);
   kasaba sakinleri yıllar geçince adlarını ve yüzlerini korur. Yeni şapkalar iki çizicide ve portrede hatasız çizilir. */
module.exports = {
  name: 'Dönemine uygun kıyafetler',
  timeout: 300000,
  async run(t) {
    const p = await t.newGame();
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.evaluate(() => {
      UI.closeAll(); G.godMode = true; G.eventT = 1e9; G.travelT = 1e9;
      window.LK = {
        year(y) { G.clock = (y - START_YEAR) * G.dpy * 1440 + 12 * 60; },
        // şapkaların payı (cinsiyete göre, n görünümden)
        hats(y, n = 4000) { LK.year(y); const c = { m: {}, f: {} }; for (let i = 0; i < n; i++) { const sex = i % 2 ? 'f' : 'm', L = randomLook(sex); c[sex][L.hat] = (c[sex][L.hat] || 0) + 2 / n; } return c; },
        face(L) { return [L.sex, L.skin, L.hair, L.hairStyle, L.beard, L.eyes].join(','); },
      };
    });

    await t.step('1895: sınır modası; 1922: fötr, kasket, çan şapka; 1952: şapkasızlar çoğalır', async () => {
      const r = await p.evaluate(() => ({ a: LK.hats(1895), b: LK.hats(1922), c: LK.hats(1952) }));
      const none = (c) => ((c.m.none || 0) + (c.f.none || 0)) / 2;
      t.ok(!r.a.m.fedora && !r.a.f.cloche && r.a.m.cowboy > 0.12, '1895: fötr ve çan şapka yok, kovboy şapkası çok', r.a);
      t.ok(r.b.m.fedora > 0.2 && r.b.m.flat > 0.12 && r.b.f.cloche > 0.28 && (r.b.m.cowboy || 0) < r.a.m.cowboy * 0.7, '1922: fötr, kasket, çan şapka; kovboy şapkası azalır', r.b);
      t.ok(!r.b.m.top && !r.b.m.fur, '1922: silindir ve kürk başlık modası geçmiş', r.b.m);
      t.ok(none(r.c) > none(r.a) + 0.2 && r.c.m.fedora > 0.25, '1952: şapkasızlar çoğalır, fötr sürer', { a: none(r.a), c: none(r.c), fedora: r.c.m.fedora });
    });

    await t.step('aynı tohum her dönemde aynı yüzü verir, kıyafet değişir', async () => {
      const r = await p.evaluate(() => {
        const out = [];
        for (const y of [1895, 1922, 1952]) { LK.year(y); const R = new RNG(4242); const L = []; for (let i = 0; i < 20; i++) L.push(randomLook(i % 2 ? 'f' : 'm', R)); out.push({ face: L.map(LK.face), cloth: L.map(l => l.hat + l.coat + l.shirt).join('|'), next: R.next() }); }
        return out;
      });
      t.ok(r[0].face.join() === r[1].face.join() && r[1].face.join() === r[2].face.join(), 'yüzler aynı');
      t.ok(r[0].next === r[1].next && r[1].next === r[2].next, 'üretecin sırası değişmez (sonraki seçimler, adlar aynı)');
      t.ok(r[0].cloth !== r[1].cloth && r[1].cloth !== r[2].cloth, 'kıyafetler dönemine göre değişir');
    });

    await t.step('kasaba sakinleri yıllar geçince adını ve yüzünü korur, dönemin kıyafetini giyer', async () => {
      const r = await p.evaluate(() => {
        const T = TH.town('harlow');
        LK.year(1891); T._res = null; const a = G.residents(T).map(x => ({ id: x.id, name: x.name, face: LK.face(x.look), hat: x.look.hat }));
        LK.year(1940); T._res = null; const b = G.residents(T).map(x => ({ id: x.id, name: x.name, face: LK.face(x.look), hat: x.look.hat }));
        const same = a.filter(x => b.some(y => y.id === x.id && y.name === x.name && y.face === x.face)).length;
        return { n: a.length, same, hatsA: [...new Set(a.map(x => x.hat))], hatsB: [...new Set(b.map(x => x.hat))] };
      });
      t.ok(r.same >= Math.min(10, r.n - 2), 'eski sakinlerin adı ve yüzü aynı', r);
      t.ok(!r.hatsA.includes('fedora') && r.hatsB.includes('fedora'), '1891\'de fötr yok, 1940\'ta var', r);
    });

    await t.step('moda dönemi başlayınca durgun kasabanın sakinleri de dönemin kıyafetine geçer', async () => {
      const r = await p.evaluate(() => {
        const T = TH.town('millbrook') || G.world.towns[0], S = G.dev.towns[T.id], st = { tier: S.tier, prog: 0.1, ghost: false, pk: S.pk || S.tier };
        const s0 = TH.openSpot(300 * TS, 300 * TS) || [300 * TS, 300 * TS]; TH.goto(s0[0], s0[1]);
        LK.year(1909); T._res = null; const a = G.residents(T);
        LK.year(1910); G.devTownYear(T, 1910, st); const b = G.residents(T);   // 1910: yeni moda
        // kalan sakinler (gelişim gereği gidenler hariç) aynı ad ve yüzle kalır
        const both = a.filter(x => b.some(y => y.id === x.id)), same = both.filter(x => b.some(y => y.id === x.id && y.name === x.name && LK.face(y.look) === LK.face(x.look)));
        return { renewed: b !== a, hatsA: [...new Set(a.map(x => x.look.hat))], hatsB: [...new Set(b.map(x => x.look.hat))], both: both.length, same: same.length, n: a.length };
      });
      t.ok(r.renewed, '1910\'da sakin kayıtları yenilenir', r);
      t.ok(!r.hatsA.includes('fedora') && (r.hatsB.includes('fedora') || r.hatsB.includes('cloche')), 'yeni modanın şapkaları', r);
      t.ok(r.both >= r.n / 2 && r.same === r.both, 'kalan sakinlerin adı ve yüzü aynı', r);
    });

    await t.step('yeni şapkalar iki çizicide ve portrede hatasız çizilir', async () => {
      await p.evaluate(() => {
        LK.year(1928);
        const s = TH.openSpot(undefined, undefined, 150) || TH.openSpot(); TH.goto(s[0], s[1]); TH.clearNpcs();
        const P = G.player, R = new RNG(9);
        ['fedora', 'cloche', 'fedora', 'cloche'].forEach((h, i) => { const L = randomLook(i % 2 ? 'f' : 'm', R); L.hat = h; const n = new NPC(P.x - 40 + i * 26, P.y - 30, 'stranger', { state: 'static', look: L }); G.addEnt(n); });
        for (const h of ['fedora', 'cloche']) { const cv = document.createElement('canvas'); cv.width = 200; cv.height = 240; const L = randomLook(h === 'cloche' ? 'f' : 'm', R); L.hat = h; PortraitArt.draw(cv.getContext('2d'), 200, 240, L, 30); }
        window.__hySoft = true; G.settings.gfx = 0; G.applySettings();
      });
      await t.sleep(1500);
      await p.evaluate(() => { G.settings.gfx = 1; G.applySettings(); });
      await t.sleep(1000);
      t.eq(errs, [], 'sayfa hatası yok');
    });
  },
};
