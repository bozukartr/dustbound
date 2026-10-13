'use strict';
/* Karakter yaratma: adım adım bölümler, isim korunur, bakılmamış bölüm varsa başlanmaz */
module.exports = {
  name: 'Karakter yaratma',
  async run(t) {
    const p = await t.page({});
    const st = () => p.evaluate(() => ({
      tab: [...document.querySelectorAll('.cr-tab')].findIndex(n => n.classList.contains('on')),
      go: document.querySelector('#cr-go') && document.querySelector('#cr-go').textContent.trim(),
      name: document.querySelector('#cr-pn') && document.querySelector('#cr-pn').textContent,
      seen: [...document.querySelectorAll('.cr-tab')].map(n => n.classList.contains('seen')),
      state: G.state,
    }));
    await t.step('ekran açılınca isim yazılabilir, ana düğme bir sonraki bölüme götürür', async () => {
      await t.sleep(300); await p.keyboard.press('Enter'); await t.sleep(500);
      const r = await st();
      const focus = await p.evaluate(() => document.activeElement && document.activeElement.id);
      t.eq(r.tab, 0, 'Kimlik bölümü'); t.eq(focus, 'cr-name', 'isim kutusu odakta');
      t.ok(/Görünüm/.test(r.go) && !/Hayata/.test(r.go), 'ana düğme İleri: Görünüm', r.go);
      t.ok(await p.evaluate(() => !!document.querySelector('.cr-guide') && /Adım 1\/4/.test(document.querySelector('.cr-sec').textContent)), 'adım ve açıklama');
    });
    await t.step('isim yazıp iki kez Enter: oyun başlamaz, sıradaki bölüme geçer', async () => {
      await p.keyboard.press('Control+A'); await p.keyboard.type('Jesse <Callahan>');
      await p.keyboard.press('Enter'); await t.sleep(200); await p.keyboard.press('Enter'); await t.sleep(300);
      const r = await st();
      t.eq(r.state === 'play', false, 'oyun başlamadı');
      // isim kutusu odaktayken bölüm değişirse yazı modu kapanır
      const tf = await p.evaluate(() => { document.querySelectorAll('.cr-tab')[0].click(); const i = document.querySelector('#cr-name'); i.focus(); const a = Input.textFocus; document.querySelector('#cr-go').click(); return { a, b: Input.textFocus }; });
      t.ok(tf.a && !tf.b, 'bölüm değişince yazı modu kapanır', tf);
      t.eq(r.tab, 1, 'Görünüm bölümüne geçti'); t.ok(r.seen[0], 'Kimlik görüldü işareti');
    });
    await t.step('yazılan isim cinsiyet değişince ve Rastgele\'de korunur, zar yeni isim verir', async () => {
      const r = await p.evaluate(() => {
        document.querySelectorAll('.cr-tab')[0].click();
        const sex = [...document.querySelectorAll('.opt')].find(n => /Cinsiyet/.test(n.textContent)); sex.click();
        const a = document.querySelector('#cr-pn').textContent;
        document.querySelector('#cr-rand').click();
        const b = document.querySelector('#cr-pn').textContent;
        document.querySelector('#cr-rn').click();
        const c = document.querySelector('#cr-pn').textContent;
        return { a, b, c };
      });
      t.eq(r.a, 'Jesse <Callahan>', 'cinsiyet değişince isim kaldı'); t.eq(r.b, 'Jesse <Callahan>', 'Rastgele görünüm, isim kaldı');
      t.ok(r.c !== r.a, 'zar yeni isim verdi', r.c);
      await p.evaluate(() => { const i = document.querySelector('#cr-name'); i.value = 'Jesse <Callahan>'; i.dispatchEvent(new Event('input')); });
    });
    await t.step('bölüm atlanırsa Hayata Başla yerine sıradaki bölüm istenir; Esc bir önceki bölüme döner', async () => {
      const r = await p.evaluate(async () => {
        document.querySelectorAll('.cr-tab')[3].click();
        const lab = document.querySelector('#cr-go').textContent;
        document.querySelector('#cr-go').click();
        const after = [...document.querySelectorAll('.cr-tab')].findIndex(n => n.classList.contains('on'));
        return { lab, after };
      });
      t.ok(/Kıyafet|Görünüm/.test(r.lab) && !/Hayata/.test(r.lab), 'Sırada: bakılmamış bölüm', r.lab);
      t.ok(r.after === 1 || r.after === 2, 'bakılmamış bölüme götürdü', r.after);
      await p.evaluate(() => document.activeElement && document.activeElement.blur());
      await p.keyboard.press('Escape'); await t.sleep(250);
      const s1 = await st();
      t.eq(s1.tab, r.after - 1, 'Esc bir önceki bölüm'); t.ok(!!(await p.evaluate(() => document.querySelector('.create'))), 'ekran açık');
    });
    await t.step('başta şapkasız; Kıyafet adımından önce Rastgele şapka takmaz; pantolon satırı yok', async () => {
      const r = await p.evaluate(() => {
        const tab = i => document.querySelectorAll('.cr-tab')[i].click();
        const row = l => [...document.querySelectorAll('.opt')].find(x => x.querySelector('.cr-l').textContent === l);
        const hat = () => row('Şapka').querySelector('.v').textContent;
        tab(2);
        const out = { start: hat(), labels: [...document.querySelectorAll('.opt .cr-l')].map(n => n.textContent), guide: document.querySelector('.cr-guide').textContent, early: [], late: new Set() };
        // saç ve sakal seçilirken (Görünüm) Rastgele şapka takmaz
        for (let k = 0; k < 12; k++) { tab(1); document.querySelector('#cr-rand').click(); tab(2); out.early.push(hat()); }
        // Kıyafet adımında Rastgele şapkayı da seçer
        for (let k = 0; k < 20; k++) { document.querySelector('#cr-rand').click(); out.late.add(hat()); }
        // oyuna şapkasız başlasın
        for (let k = 0; k < 12 && hat() !== 'Şapkasız'; k++) row('Şapka').click();
        out.late = [...out.late]; out.end = hat();
        return out;
      });
      t.eq(r.start, 'Şapkasız', 'ekran açılınca şapkasız');
      t.ok(r.early.every(h => h === 'Şapkasız'), 'Kıyafet adımından önce Rastgele şapka takmaz', r.early);
      t.ok(r.late.some(h => h !== 'Şapkasız'), 'Kıyafet adımında Rastgele şapka da seçer', r.late);
      t.ok(!r.labels.includes('Pantolon') && r.labels.includes('Şapka') && r.labels.includes('Ceket') && r.labels.includes('Gömlek'), 'Kıyafet: pantolon satırı yok', r.labels);
      t.ok(!/pantolon/i.test(r.guide), 'açıklamada pantolon yok', r.guide);
      t.eq(r.end, 'Şapkasız', 'şapka satırından şapkasıza dönülür');
    });
    await t.step('bütün bölümler görülünce Hayata Başla; isim temizlenir, seçimler oyuna geçer', async () => {
      await p.evaluate(() => { document.querySelectorAll('.cr-tab')[3].click(); document.querySelectorAll('.cr-card')[3].click(); });
      for (let k = 0; k < 6 && (await st()).state !== 'play'; k++) { await p.evaluate(() => document.querySelector('#cr-go') && document.querySelector('#cr-go').click()); await t.sleep(150); }
      await p.waitForFunction(() => G.state === 'play', null, { timeout: 150000 });
      const r = await p.evaluate(() => ({ name: G.player.name, bg: G.background, want: BACKGROUNDS[3].id, tf: Input.textFocus, hat: G.player.look.hat, pants: LOOKS.pants.includes(G.player.look.pants) }));
      t.eq(r.tf, false, 'oyunda klavye yazı moduna takılı kalmaz');
      t.eq(r.hat, 'none', 'şapka seçilmedikçe şapkasız'); t.ok(r.pants, 'pantolon rengi yine var (seçilmeden)');
      t.eq(r.name, 'Jesse Callahan', 'isimde < > kalmaz'); t.eq(r.bg, r.want, 'seçilen geçmiş');
    });
  },
};
