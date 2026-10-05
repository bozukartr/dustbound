'use strict';
/* Karakter portresi ve görünüm seçenekleri: her saç stili (iki cinsiyet), sakal ve şapka hatasız çizilir ve
   portreyi gerçekten değiştirir; kadın saç adları ayrı, bone yalnızca kadınlarda; yeni şapkayla başlayan
   oyuncunun envanterinde şapkası olur; kuşbakışı ve 3D çizim yeni değerlerle hata vermez; berber listesi */
module.exports = {
  name: 'Portre ve görünüm seçenekleri',
  timeout: 300000,
  async run(t) {
    const errInit = () => { window.__errs = []; const ce = console.error; console.error = (...a) => { window.__errs.push(String(a[0] && a[0].stack || a[0]).slice(0, 300)); ce(...a); }; };
    const p = await t.page({ init: errInit });

    await t.step('her seçenek hatasız çizilir ve portreyi değiştirir', async () => {
      const r = await p.evaluate(() => {
        const base = { sex: 'm', skin: '#e0b48c', hair: '#3a2618', hairStyle: 0, beard: 0, beardLen: 1, hat: 'none', hatCol: '#6a5038', coat: '#5a4a3a', shirt: '#d8cdb4', pants: '#3a3024', eyes: '#4a6a8a', coatLen: 0 };
        const c = document.createElement('canvas'); c.width = 200; c.height = 240; const g = c.getContext('2d');
        const sig = (lk) => { Spr.portrait(g, 200, 240, lk, 18); const d = g.getImageData(0, 0, 200, 240).data; let h = 0, sum = 0; for (let i = 0; i < d.length; i += 16) { h = (h * 31 + d[i] + d[i + 1] * 3 + d[i + 2] * 7) >>> 0; sum += d[i]; } return { h, mean: sum / (d.length / 16) }; };
        const out = { same: [], blank: [], n: 0 };
        const check = (name, list) => {
          const sigs = list.map(sig); out.n += sigs.length;
          sigs.forEach((s, i) => { if (s.mean < 20 || s.mean > 245) out.blank.push(name + i); for (let j = 0; j < i; j++) if (sigs[j].h === s.h) out.same.push(`${name}${j}=${i}`); });
        };
        check('erkek saç ', LOOKS.hairStyle.map((_, i) => Object.assign({}, base, { hairStyle: i })));
        check('kadın saç ', LOOKS.hairStyleF.map((_, i) => Object.assign({}, base, { sex: 'f', hairStyle: i })));
        check('sakal ', LOOKS.beard.map((_, i) => Object.assign({}, base, { beard: i })));
        check('şapka ', LOOKS.hat.map(h => Object.assign({}, base, { sex: 'f', hat: h })));
        // yaş: yaşlı portre gençten farklı (ağaran saç, çizgiler)
        if (sig(Object.assign({}, base, { beard: 4 })).h === (() => { Spr.portrait(g, 200, 240, Object.assign({}, base, { beard: 4 }), 70); const d = g.getImageData(0, 0, 200, 240).data; let h = 0; for (let i = 0; i < d.length; i += 16) h = (h * 31 + d[i] + d[i + 1] * 3 + d[i + 2] * 7) >>> 0; return h; })()) out.same.push('yaş');
        // aynı görünüm iki kez aynı çizilir (sabit tohum)
        const a1 = sig(Object.assign({}, base, { hairStyle: 7, beard: 3 })), a2 = sig(Object.assign({}, base, { hairStyle: 7, beard: 3 }));
        out.stable = a1.h === a2.h;
        out.errs = window.__errs;
        return out;
      });
      t.ok(r.n >= 38, 'bütün seçenekler çizildi', r.n);
      t.eq(r.blank, [], 'boş ya da tek renk portre yok');
      t.eq(r.same, [], 'her seçenek portreyi değiştirir');
      t.ok(r.stable, 'aynı görünüm her seferinde aynı çizilir');
      t.eq(r.errs, [], 'konsol hatası yok');
    });

    await t.step('karakter ekranı: kadın saç adları, bone yalnızca kadında, cinsiyet değişince bone düşer', async () => {
      await t.sleep(300); await p.keyboard.press('Enter'); await t.sleep(500);
      const r = await p.evaluate(() => {
        const rowsAt = (tab) => { document.querySelectorAll('.cr-tab')[tab].click(); return [...document.querySelectorAll('.cr-row.opt')]; };
        const find = (tab, re) => rowsAt(tab).find(n => re.test(n.querySelector('.cr-l').textContent));
        const setSex = (sx) => { for (let i = 0; i < 2 && !(sx === 'f' ? /Kadın/ : /Erkek/).test(find(0, /Cinsiyet/).textContent); i++) find(0, /Cinsiyet/)._lr(1); };
        const cycle = (tab, re, n) => { const seen = []; for (let i = 0; i < n; i++) { const row = find(tab, re); seen.push(row.querySelector('.v').textContent.trim()); row._lr(1); } return seen; };
        setSex('f');
        const fHair = cycle(1, /Saç Stili/, LOOKS.hairStyle.length), fHats = cycle(2, /^Şapka$/, LOOKS.hat.length);
        // bone seçiliyken erkeğe geç
        while (!/Bone/.test(find(2, /^Şapka$/).textContent)) find(2, /^Şapka$/)._lr(1);
        setSex('m');
        const afterHat = find(2, /^Şapka$/).querySelector('.v').textContent.trim();
        const mHair = cycle(1, /Saç Stili/, LOOKS.hairStyle.length), mHats = cycle(2, /^Şapka$/, LOOKS.hat.length), mBeard = cycle(1, /Sakal/, LOOKS.beard.length);
        return { fHair, fHats, mHair, mHats, mBeard, afterHat };
      });
      t.ok(r.fHair.includes('Topuz') && r.fHair.includes('İki Örgü') && !r.fHair.includes('Kazınmış'), 'kadın saç adları', r.fHair);
      t.eq(new Set(r.fHair).size, 10, 'kadında 10 saç stili');
      t.ok(r.mHair.includes('Kazınmış') && r.mHair.includes('Açık Alın') && new Set(r.mHair).size === 10, 'erkekte 10 saç stili', r.mHair);
      t.eq(new Set(r.mBeard).size, 9, 'erkekte 9 sakal seçeneği');
      t.ok(r.fHats.includes('Bone') && new Set(r.fHats).size === 10, 'kadında bone dahil 10 şapka seçeneği', r.fHats);
      t.ok(!r.mHats.includes('Bone') && new Set(r.mHats).size === 9, 'erkekte bone yok', r.mHats);
      t.ok(r.afterHat !== 'Bone', 'erkeğe geçince bone düşer', r.afterHat);
    });

    await t.step('yeni şapkayla başlayan oyuncunun envanterinde şapkası olur; kuşbakışı ve 3D çizim hatasız', async () => {
      const q = await t.newGame({ init: errInit });
      const r = await q.evaluate(async () => {
        const P = G.player, out = { inv: [], icons: [], errs: [] };
        for (const h of ['boss', 'straw', 'top', 'fur', 'bonnet']) {
          out.inv.push(!!ITEMS['hat_' + h] && ITEMS['hat_' + h].hat === h);
          out.icons.push(/<svg/.test(Icons.item('hat_' + h)));
        }
        // her şapka ve saç stiliyle bir kare çiz (kuşbakışı)
        const c = document.createElement('canvas'), g = c.getContext('2d');
        for (const hat of LOOKS.hat) for (let hs = 0; hs < 10; hs++) for (const sex of ['m', 'f']) Spr.human(g, 0, 0, 0, Object.assign({}, P.look, { hat, hairStyle: hs, sex, beard: sex === 'm' ? hs % 9 : 0 }), {});
        // şapka giy/çıkar: yeni şapka eşyası
        P.inv.hat_top = 1; G.equipClothing('hat_top'); out.worn = P.look.hat;
        // 3D: her şapkayla sinematik karakteri kur
        const K = Cinema.kit, L = { dir: [0, 1, 0], amb: 1, dif: 0.5, ambC: [1, 1, 1], sunC: [1, 1, 1] };
        out.k3 = 0;
        for (const hat of LOOKS.hat) for (const b of [0, 3, 5, 6, 7]) { const lk = Object.assign({}, P.look, { hat, beard: b, hairStyle: b }); try { K.rider(new K.Mesh(L), lk); out.k3++; } catch (e) { out.errs.push(hat + b + ': ' + e.message); } }
        out.errs.push(...window.__errs); out.nHat = LOOKS.hat.length;
        return out;
      });
      t.eq(r.inv, [true, true, true, true, true], 'yeni şapka eşyaları tanımlı');
      t.eq(r.icons, [true, true, true, true, true], 'yeni şapka simgeleri');
      t.eq(r.worn, 'top', 'silindir şapka giyildi');
      t.ok(r.k3 === r.nHat * 5, '3D karakter her şapkayla kuruldu', r.k3);
      t.eq(r.errs, [], 'hata yok');
    });

    await t.step('başlangıç şapkası envantere girer (kadın, bone)', async () => {
      const q = await t.page({ init: errInit });
      await t.sleep(300); await q.keyboard.press('Enter'); await t.sleep(400);
      await q.evaluate(() => {
        const find = (tab, re) => { document.querySelectorAll('.cr-tab')[tab].click(); return [...document.querySelectorAll('.cr-row.opt')].find(n => re.test(n.querySelector('.cr-l').textContent)); };
        for (let i = 0; i < 2 && !/Kadın/.test(find(0, /Cinsiyet/).textContent); i++) find(0, /Cinsiyet/)._lr(1);
        while (!/Bone/.test(find(2, /^Şapka$/).textContent)) find(2, /^Şapka$/)._lr(1);
        document.querySelectorAll('.cr-tab')[0].click();
        for (let k = 0; k < 8 && document.querySelector('#cr-go'); k++) document.querySelector('#cr-go').click();
      });
      await q.waitForFunction(() => G.state === 'play', null, { timeout: 150000 });
      const r = await q.evaluate(() => ({ hat: G.player.look.hat, inv: G.player.inv.hat_bonnet | 0, errs: window.__errs }));
      t.eq(r.hat, 'bonnet', 'bone takılı'); t.eq(r.inv, 1, 'bone envanterde'); t.eq(r.errs, [], 'konsol hatası yok');
    });
  },
};
