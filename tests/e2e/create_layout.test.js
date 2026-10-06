'use strict';
/* Karakter belgesi (ön yüz / arka yüz) düzeni: çok farklı rastgele karakterlerde, dört bölümde ve
   farklı ekran boyutlarında taşma, kesik/eksik metin, görünmeyen alan ya da değişen kart boyu olmamalı. */
const VIEWS = [[1280, 720], [960, 540], [1920, 1080], [1280, 800], [1024, 768], [2560, 1080]];
// isimler: kısa, en uzun (28), boşluksuz tek kelime, Türkçe harfler, tireli
const NAMES = ['Al Wu', 'Maximilian Bartholomew-Smith', 'Wolfeschlegelsteinhausenberg', 'İsmail Şükrü Çağlayanoğlu', 'Ğğ İı Şş Öö Üü Çç', 'Jo', 'Anne-Marie de la Fontaine', 'Ezekiel Montgomery Whitaker', 'Ike', 'Penelope Featherstonehaugh', 'Ömer Faruk Işıktaş', 'Wilhelmina Vanderbilt'];

/* sayfa içinde: görünen her metnin ekranda ve kesilmeden durduğunu, kartların taşmadığını ölçer */
function audit() {
  const C = document.querySelector('.create'), bad = [];
  const R = (n) => n.getBoundingClientRect();
  const W = innerWidth, H = innerHeight, E = 1.5;
  const vis = (n) => { const s = getComputedStyle(n); return n.getClientRects().length && s.visibility !== 'hidden' && s.display !== 'none' && +s.opacity !== 0; };
  const name = (n) => (n.id ? '#' + n.id : '.' + [...n.classList].join('.')) + ' "' + (n.value || n.textContent || '').trim().slice(0, 30) + '"';
  const texts = [...C.querySelectorAll('*')].filter(n => vis(n) && ([...n.childNodes].some(c => c.nodeType === 3 && c.textContent.trim()) || n.tagName === 'INPUT' || n.classList.contains('ic') || n.classList.contains('chip')));
  for (const n of texts) {
    const r = R(n);
    if (r.width < 1 || r.height < 1) { bad.push('boyutsuz ' + name(n)); continue; }
    if (r.left < -E || r.top < -E || r.right > W + E || r.bottom > H + E) bad.push('ekran dışında ' + name(n));
    // kırpan atalar: metin onların dışına taşmamalı
    for (let a = n.parentElement; a && a !== C.parentElement; a = a.parentElement) {
      const s = getComputedStyle(a);
      if (s.overflowX === 'visible' && s.overflowY === 'visible') continue;
      const q = R(a);
      if (r.left < q.left - E || r.right > q.right + E || r.top < q.top - E || r.bottom > q.bottom + E) { bad.push('kırpılmış ' + name(n) + ' ← ' + name(a)); break; }
    }
    // tek satıra sıkışmış (…) ya da kutusundan taşan metin
    if (n.tagName !== 'INPUT' && n.scrollWidth > n.clientWidth + 1 && getComputedStyle(n).overflowX !== 'visible') bad.push('kesik metin ' + name(n));
  }
  // kaydırma gerekmeden sığmalı
  for (const sel of ['.cr-left', '.cr-right', '.cr-under', '.cr-stage', '.cd-band', '.bk-band']) {
    const n = C.querySelector(sel); if (!n || !vis(n)) continue;
    if (n.scrollHeight > n.clientHeight + 1) bad.push(`taşma ${sel} ${n.scrollHeight}>${n.clientHeight}`);
    if (n.scrollWidth > n.clientWidth + 1) bad.push(`yatay taşma ${sel} ${n.scrollWidth}>${n.clientWidth}`);
  }
  // isim kutusunda yazılan isim sonuna dek görünmeli (kutu kaydırmasın)
  const inp = C.querySelector('#cr-name'); if (inp && inp.scrollWidth > inp.clientWidth + 1) bad.push('isim kutusuna sığmadı "' + inp.value + '"');
  // bölümler üst üste binmemeli
  const box = (sel) => { const n = C.querySelector(sel); return n && vis(n) ? R(n) : null; };
  const head = box('.cr-head'), st = box('.cr-stage'), lf = box('.cr-left'), rt = box('.cr-right'), sa = box('.cr-side.a');
  if (head && sa && sa.top < head.bottom - E) bad.push('başlık yan etiketle çakışıyor');
  // alt çubuğun düğmeleri ve tuş ipuçları kartlara değmemeli (eğik arka yüzün köşesi boşluğa taşabilir)
  for (const sel of ['.cr-btns', '.cr-keys']) {
    const f = box(sel); if (!f) continue;
    if (lf && lf.bottom > f.top + E) bad.push('ön yüz alt çubukla çakışıyor ' + sel);
    if (rt && rt.bottom > f.top + E) bad.push('arka yüz alt çubukla çakışıyor ' + sel);
  }
  if (st && rt && st.right > rt.left - E) bad.push('ön ve arka yüz çakışıyor');
  const fr = box('.cr-frame'), un = box('.cr-under');
  if (fr && un && fr.right > un.left + E) bad.push('portre imzayla çakışıyor');
  // damgalar yazının üstüne binmemeli
  const hit = (a, b) => a && b && a.left < b.right - E && b.left < a.right - E && a.top < b.bottom - E && b.top < a.bottom - E;
  for (const sel of ['.bk-stamp', '.bk-stamp2']) for (const o of ['.bk-d', '.cr-items', '.cr-facts', '.bk-band']) if (hit(box(sel), box(o))) bad.push(`damga ${sel} yazıyla çakışıyor ${o}`);
  const k = (sel) => { const r = box(sel); return r ? [r.left, r.top, r.width, r.height].map(v => Math.round(v * 2) / 2).join(',') : '-'; };
  return { bad, size: ['.cr-stage', '.cr-left', '.cr-right', '.cr-frame', '.cd-band', '.bk-band', '.cr-under', '.cr-head', '.cr-foot'].map(k).join(' | ') };
}

module.exports = {
  name: 'Karakter belgesi düzeni',
  async run(t) {
    const open = async (locale) => {
      const q = await t.page({ locale });
      await t.sleep(300); await q.keyboard.press('Enter');
      await q.waitForFunction(() => document.querySelector('.create'));
      await q.evaluate(() => document.activeElement && document.activeElement.blur());
      await q.evaluate(audit.toString().replace(/^function audit/, 'window.__audit = function'));
      await q.evaluate(() => document.fonts.ready);
      return q;
    };
    let p = await open('tr-TR');

    await t.step('yazı tipleri yüklü; Türkçe harfler (İ ş ğ) belgenin kendi yazı tipleriyle çizilir', async () => {
      const r = await p.evaluate(async () => {
        await document.fonts.ready;
        const fams = ['Old Standard TT', 'Playfair Display', 'Playfair Display SC', 'Pinyon Script'];
        const faces = [...document.fonts].filter(f => fams.includes(f.family.replace(/["']/g, '')));
        // latin-ext dilimleri (Ğ ş İ) yüklenmiş olmalı
        const ext = fams.filter(fm => faces.some(f => f.family.replace(/["']/g, '') === fm && f.status === 'loaded' && /U\+100-|U\+0100-/i.test(f.unicodeRange)));
        return { status: document.fonts.status, ext, used: getComputedStyle(document.querySelector('.cd-band')).fontFamily };
      });
      t.eq(r.status, 'loaded', 'yazı tipleri yüklendi');
      t.eq(r.ext.length, 4, 'dört yazı tipinin Türkçe dilimi yüklü', r.ext);
      t.ok(/Playfair/.test(r.used), 'başlık bandı belge yazı tipinde', r.used);
    });

    const chars = async (lang) => {
      const seen = {}, fails = [];
      for (const [w, h] of VIEWS) {
        await p.setViewportSize({ width: w, height: h });
        await t.sleep(120);
        for (let i = 0; i < NAMES.length; i++) {
          const spec = await p.evaluate(([i, nm]) => {
            const tab = (k) => document.querySelectorAll('.cr-tab')[k].click();
            tab(0);
            // cinsiyet, görünüm, isim
            const sex = [...document.querySelectorAll('.opt')].find(n => n.querySelector('.cr-l').textContent === Tr('Cinsiyet'));
            if (i % 2) sex.click();
            document.querySelector('#cr-rand').click();
            const inp = document.querySelector('#cr-name'); inp.value = nm; inp.dispatchEvent(new Event('input'));
            // geçmiş, zorluk, yaşlanma, hikâye: her karakterde farklı
            tab(3);
            document.querySelectorAll('.cr-card')[i % BACKGROUNDS.length].click();
            const opt = (k) => [...document.querySelectorAll('.opt')][k];
            for (let a = 0; a < i % 2; a++) opt(1).click();
            for (let a = 0; a < i % 3; a++) opt(2).click();
            if (i % 4 === 3) opt(3).click();
            return document.querySelector('#cr-pn').textContent + ' / ' + document.querySelector('.bk-f b').textContent;
          }, [i, NAMES[i]]);
          for (const tb of [0, 1, 2, 3]) {
            await p.evaluate((tb) => { document.querySelectorAll('.cr-tab')[tb].click(); document.activeElement && document.activeElement.blur(); }, tb);
            const r = await p.evaluate(() => window.__audit());
            const key = `${w}x${h}`;
            if (r.bad.length) fails.push(`${lang} ${key} karakter ${i + 1} (${spec}) bölüm ${tb + 1}: ${r.bad.join('; ')}`);
            (seen[key] = seen[key] || new Set()).add(r.size);
          }
        }
      }
      return { seen, fails };
    };

    await t.step(`${NAMES.length} farklı rastgele karakter × 4 bölüm × ${VIEWS.length} ekran boyutu: taşma, kesik metin, çakışma yok`, async () => {
      const r = await chars('tr');
      if (r.fails.length) console.log([...new Set(r.fails.map(f => f.replace(/ karakter \d+ \([^)]*\)/, '')))].slice(0, 40).join('\n'));
      t.eq(r.fails.length, 0, 'sorunsuz', r.fails.slice(0, 12));
      const moved = Object.entries(r.seen).filter(([, s]) => s.size !== 1).map(([k, s]) => k + ': ' + [...s].join('  //  '));
      t.eq(moved.length, 0, 'kart boyutları karakterden ve bölümden bağımsız', moved.slice(0, 3));
      await p.setViewportSize({ width: 1280, height: 720 });
    });

    await t.step('İngilizce metinlerle de aynı denetim', async () => {
      p = await open('en-US');
      t.eq(await p.evaluate(() => I18N.lang), 'en', 'İngilizce');
      const r = await chars('en');
      if (r.fails.length) console.log([...new Set(r.fails.map(f => f.replace(/ karakter \d+ \([^)]*\)/, '')))].slice(0, 40).join('\n'));
      t.eq(r.fails.length, 0, 'sorunsuz', r.fails.slice(0, 12));
      const moved = Object.entries(r.seen).filter(([, s]) => s.size !== 1).map(([k, s]) => k + ': ' + [...s].join('  //  '));
      t.eq(moved.length, 0, 'kart boyutları sabit', moved.slice(0, 3));
    });
  },
};
