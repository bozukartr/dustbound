'use strict';
/* Ana menüdeki Wiki düğmesi: köşede durur, menüyle çakışmaz, oyunun diliyle rehberi açar,
   fareyle ve yön tuşlarıyla seçilir; Platform.openUrl yalnız https bağlantılarını açar */
module.exports = {
  name: 'Ana menü Wiki düğmesi',
  async run(t) {
    const p = await t.page();
    // pencere açma isteği yakalanır (testte gerçek bir sekme açılmaz)
    const spy = () => p.evaluate(() => { window.__opened = []; window.open = (u, w, f) => { window.__opened.push([u, w, f]); return null; }; });
    // text: true → kutunun değil yazının kendi sınırı (başlık bloğu satır boyu uzanır)
    const rect = (sel, text) => p.evaluate(([s, tx]) => { const e = document.querySelector(s); if (!e) return null; let b = e.getBoundingClientRect(); if (tx) { const r = document.createRange(); r.selectNodeContents(e); b = r.getBoundingClientRect(); } return { l: b.left, t: b.top, r: b.right, b: b.bottom, w: innerWidth, h: innerHeight }; }, [sel, !!text]);
    // giriş animasyonu bitsin (düğme menüden biraz sonra belirir)
    const settled = () => p.waitForFunction(() => document.getElementById('mm-wiki').getAnimations().every(a => a.playState === 'finished'), null, { timeout: 5000 }).catch(() => {});
    const hit = (a, b) => a && b && a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;

    await t.step('düğme sağ üst köşede, logo (SVG amblem ve WIKI kurdelesi), menüyle çakışmıyor', async () => {
      await settled();
      const w = await rect('#mm-wiki');
      t.ok(w && w.r <= w.w && w.l > w.w * 0.75 && w.t < w.h * 0.2, 'sağ üst köşede', w);
      t.ok(w.r - w.l >= 60, 'okunur büyüklükte', w);
      const r = await p.evaluate(() => { const e = document.getElementById('mm-wiki'); return { svg: !!e.querySelector('svg circle') && !!e.querySelector('svg path'), text: e.querySelector('svg text').textContent, label: e.getAttribute('aria-label'), nav: e.classList.contains('nav') }; });
      t.ok(r.svg, 'SVG amblem');
      t.eq(r.text, 'WIKI', 'kurdele yazısı');
      t.eq(r.label, 'Oyun Rehberi (Wiki)', 'erişilebilir ad');
      t.ok(r.nav, 'menüde yön tuşlarıyla seçilebilir');
      const items = await rect('#mm-items'), title = await rect('.mm-title h1', true);
      t.ok(!hit(w, items) && !hit(w, title), 'menü öğelerine ve başlığa değmez', { w, items, title });
      // kayıt varken son hayat kartıyla da çakışmaz (sahte kayıt bilgisi yalnız ölçüm için)
      const card = await p.evaluate(() => { const si = G.saveInfo; G.saveInfo = () => ({ name: 'Deneme', age: 30, money: 100, bg: 'farm', place: '', year: 1891, playtime: 60 }); UI.showMainMenu(); const b = document.getElementById('mm-card').getBoundingClientRect(); G.saveInfo = si; UI.showMainMenu(); return { l: b.left, t: b.top, r: b.right, b: b.bottom }; });
      t.ok(!hit(await rect('#mm-wiki'), card), 'son hayat kartına değmez', card);
    });

    await t.step('tıklanınca rehber oyunun diliyle açılır, düğme açıldığını söyler', async () => {
      await spy();
      await settled();
      await p.hover('#mm-wiki');
      await t.sleep(350);
      t.eq(await p.evaluate(() => getComputedStyle(document.querySelector('.mm-wiki-tip')).opacity), '1', 'üzerine gelince adı görünür');
      await p.click('#mm-wiki');
      const r = await p.evaluate(() => ({ opened: window.__opened, tip: document.querySelector('.mm-wiki-tip').textContent, state: G.state }));
      t.eq(r.opened.length, 1, 'bir kez açılır');
      t.eq(r.opened[0][0], 'https://bozukartr.github.io/frontiersend/?lang=tr', 'Türkçe rehber');
      t.eq(r.opened[0][1], '_blank', 'yeni pencere / dış tarayıcı');
      t.eq(r.tip, 'Rehber tarayıcında açıldı', 'bildirim');
      t.eq(r.state, 'menu', 'oyun ana menüde kalır');
    });

    await t.step('yön tuşlarıyla seçilip Enter ile açılır', async () => {
      await spy();
      await p.evaluate(() => UI.top().focusFirst());
      await p.mouse.move(5, 5);
      await p.keyboard.press('ArrowRight');
      await t.sleep(120);
      t.ok(await p.evaluate(() => document.getElementById('mm-wiki').classList.contains('focus')), 'sağ tuşuyla düğmeye geçilir');
      await p.keyboard.press('Enter');
      await t.sleep(150);
      t.eq(await p.evaluate(() => window.__opened.length), 1, 'Enter ile açılır');
      await p.keyboard.press('ArrowLeft');
      await t.sleep(120);
      t.ok(await p.evaluate(() => document.querySelector('#mm-items .mm-item.focus') !== null), 'sol tuşuyla menüye dönülür');
    });

    await t.step('İngilizcede düğmenin adı ve rehberin dili değişir', async () => {
      await p.evaluate(() => UI.openSettings(0, 'lang')); await t.sleep(200);
      await p.evaluate(() => document.querySelector('.st-row[data-k="lang"] [data-v="en"]').click()); await t.sleep(300);
      await p.evaluate(() => UI.closeAll()); await p.evaluate(() => UI.showMainMenu()); await t.sleep(200);
      await spy();
      t.eq(await p.evaluate(() => document.getElementById('mm-wiki').getAttribute('aria-label')), 'Game Guide (Wiki)', 'İngilizce ad');
      await p.click('#mm-wiki');
      const r = await p.evaluate(() => ({ url: window.__opened[0] && window.__opened[0][0], tip: document.querySelector('.mm-wiki-tip').textContent }));
      t.eq(r.url, 'https://bozukartr.github.io/frontiersend/?lang=en', 'İngilizce rehber');
      t.eq(r.tip, 'The guide opened in your browser', 'İngilizce bildirim');
      await p.evaluate(() => { UI.openSettings(0, 'lang'); document.querySelector('.st-row[data-k="lang"] [data-v="tr"]').click(); UI.closeAll(); UI.showMainMenu(); });
    });

    await t.step('Platform.openUrl yalnız https bağlantısı açar', async () => {
      await spy();
      const r = await p.evaluate(() => [Platform.openUrl('javascript:alert(1)'), Platform.openUrl('http://example.com'), Platform.openUrl('file:///etc/passwd'), Platform.openUrl('https://bozukartr.github.io/frontiersend/'), window.__opened.length]);
      t.eq(r, [false, false, false, true, 1], 'yalnız https');
    });
  },
};
