'use strict';
/* Çeviri anahtarları ve oyun içi dil değiştirme */
const { execFileSync } = require('child_process');
const path = require('path');
module.exports = {
  name: 'Diller',
  async run(t) {
    await t.step('İngilizce çeviride eksik ya da uyuşmayan anahtar yok', async () => {
      const out = execFileSync(process.execPath, [path.join(__dirname, '..', '..', 'tools', 'i18n-check.js'), 'en'], { encoding: 'utf8' });
      const num = (h) => { const m = out.match(new RegExp('## ' + h + '[^:]*: (\\d+)')); return m ? +m[1] : -1; };
      t.eq(num('Eksik \\(kod\\)'), 0, 'kodda çevrilmemiş metin');
      t.eq(num('Eksik \\(veri tabloları\\)'), 0, 'veri tablolarında çevrilmemiş metin');
      t.eq(num('Yer tutucu uyuşmazlığı'), 0, 'yer tutucu uyuşmazlığı');
      t.eq(num('Çeviride Türkçe harf kalmış'), 0, 'çeviride Türkçe harf');
    });
    const p = await t.page();
    await t.step('Türkçe tarayıcıda oyun Türkçe açılır', async () => {
      const r = await p.evaluate(() => ({ lang: I18N.lang, mm: document.querySelector('#mm-items .mm-n').textContent }));
      t.eq(r.lang, 'tr', 'dil'); t.eq(r.mm, 'Yeni Hayat', 'menü metni');
    });
    await t.step('Ayarlardan İngilizceye geçilir, menüler ve veri tabloları değişir, ayar kalıcıdır', async () => {
      await p.evaluate(() => UI.openSettings(0, 'lang')); await t.sleep(200);
      await p.evaluate(() => document.querySelector('.st-row[data-k="lang"] [data-v="en"]').click()); await t.sleep(400);
      const r = await p.evaluate(() => ({ lang: I18N.lang, mm: document.querySelector('#mm-items .mm-n').textContent, beans: ITEMS.beans.n, open: UI.top() && UI.top().el.classList.contains('settings') }));
      t.eq(r.lang, 'en', 'dil'); t.eq(r.mm, 'New Life', 'menü metni'); t.eq(r.beans, 'Canned Beans', 'eşya adı'); t.ok(r.open, 'ayarlar açık kalmalı');
      await p.reload(); await p.waitForFunction(() => typeof G !== 'undefined' && G.state === 'menu');
      t.eq(await p.evaluate(() => I18N.lang), 'en', 'yeniden açılışta dil korunmalı');
    });
    await t.step('oyun içinde dil değişince duraklatma menüsü yeni dilde', async () => {
      await t.newGame({ page: p });
      await p.evaluate(() => { UI.openPause(); UI.openSettings(0, 'lang'); document.querySelector('.st-row[data-k="lang"] [data-v="tr"]').click(); }); await t.sleep(400);
      const titles = await p.evaluate(() => UI.stack.map(m => (m.el.querySelector('.p-title') || {}).textContent));
      t.eq(titles, ['Duraklatıldı', 'Ayarlar'], 'açık pencereler Türkçe');
    });
  },
};
