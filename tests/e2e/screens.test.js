'use strict';
/* Ekran boyutları: Steam Deck (1280×800), 4K (1920×1080 mantıksal, piksel yoğunluğu 2), geniş ekran (3440×1440) ve küçük
   pencere (1024×640). Ana menü, karakter ekranı, HUD, duraklatma, Günlük'ün bütün sekmeleri, harita, çanta ve dükkân
   pencereden taşmaz (kaydırılan ya da kırpılan kutuların içi sayılmaz); HUD'un köşe blokları birbirine binmez; ortadaki
   bildirim sol üstteki yardım kutusunun üstüne binmez (dar ekranda yardımın altına iner). */
const SIZES = [[1280, 800, 1, 'Steam Deck'], [1920, 1080, 2, '4K'], [3440, 1440, 1, 'geniş ekran'], [1024, 640, 1, 'küçük pencere']];
module.exports = {
  name: 'Ekran boyutları',
  timeout: 600000,
  async run(t) {
    for (const [w, h, dpr, tag] of SIZES) {
      await t.step(`${tag} (${w}×${h}${dpr > 1 ? ', yoğunluk ' + dpr : ''}): taşma ve çakışma yok`, async () => {
        const p = await t.page({ viewport: { width: w, height: h }, dpr });
        const helpers = () => p.evaluate(() => {
          // görünür olup kırpılmadan pencere dışına taşan öğeler
          window.overflow = (root) => {
            if (!root) return ['(pencere yok)'];
            const W = innerWidth, H = innerHeight, bad = [];
            const clipped = (el) => { for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) { const s = getComputedStyle(a); if (/(auto|scroll|hidden|clip)/.test(s.overflowX + ' ' + s.overflowY)) return true; } return false; };
            for (const el of [root, ...root.querySelectorAll('*')]) {
              const cs = getComputedStyle(el);
              if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) continue;
              const r = el.getBoundingClientRect();
              if (r.width < 2 || r.height < 2 || (r.left >= -1 && r.top >= -1 && r.right <= W + 1 && r.bottom <= H + 1)) continue;
              if (el !== root && clipped(el)) continue;
              bad.push(`${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''} [${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}×${Math.round(r.height)}] «${(el.innerText || '').trim().slice(0, 30).replace(/\s+/g, ' ')}»`);
            }
            return bad.slice(0, 6);
          };
          const vis = (e) => { if (!e || e.classList.contains('hidden')) return null; const cs = getComputedStyle(e), r = e.getBoundingClientRect(); return cs.display !== 'none' && cs.visibility !== 'hidden' && +cs.opacity > 0 && r.width > 2 && r.height > 2 ? r : null; };
          const hit = (a, b) => a && b && Math.min(a.right, b.right) - Math.max(a.left, b.left) > 4 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 4;
          // köşe blokları birbirine, bildirim yardım kutusuna binmez
          window.overlaps = () => {
            const ids = ['hud-help', 'hud-tr', 'hud-bl', 'hud-br'], R = ids.map(id => vis(document.getElementById(id))), out = [];
            for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) if (hit(R[i], R[j])) out.push(ids[i] + ' × ' + ids[j]);
            const toast = vis(document.querySelector('#toasts .toast'));
            if (hit(R[0], toast)) out.push('hud-help × bildirim');
            return out;
          };
        });
        await helpers();
        const r = { menu: await p.evaluate(() => overflow(document.getElementById('mainmenu'))) };
        await t.sleep(300); await p.keyboard.press('Enter'); await t.sleep(600);
        r.create = await p.evaluate(() => overflow(document.querySelector('.modal')));
        await t.newGame({ page: p });
        await helpers();
        // HUD dolu: yardım kutusu, başarım bildirimi, tehlike kartı, silah kartı
        await p.evaluate(() => {
          UI.closeAll(); const P = G.player; P.giveWeapon('cattleman', true); P.weapon = 'cattleman'; P.poison = 200; G.heatLoad = 1.4; G.hotness = 0.4;
          UI.help('<b>Yardım kutusu</b>: uzunca bir ipucu metni. Burada iki üç satır yazı olur ve kutu sol üst köşede durur.', 20);
          UI.toast('Başarım', 'Uzunca bir başarım açıklaması', 'ach'); UI.hudUpdate(); UI.dangerCard();
        });
        await t.sleep(500);
        r.hud = await p.evaluate(() => overflow(document.getElementById('hud')));
        r.overlap = await p.evaluate(() => overlaps());
        r.pause = await p.evaluate(() => { UI.openPause(); return overflow(UI.top() && UI.top().el); });
        r.journal = await p.evaluate(() => {
          const out = [];
          for (let k = 0; k <= 8; k++) { UI.closeAll(); UI.openJournal(k); const j = document.querySelector('.journal'), o = overflow(j); if (o.length) out.push(k + ': ' + o.join('; ')); }
          return out;
        });
        r.map = await p.evaluate(() => { UI.closeAll(); UI.openMap(); return overflow(document.getElementById('mapscreen')); });
        r.satchel = await p.evaluate(() => { UI.closeAll(); UI.openSatchel(); return overflow(UI.top() && UI.top().el); });
        r.shop = await p.evaluate(() => { UI.closeAll(); UI.openShop('general', 'Genel Mağaza'); return overflow(UI.top() && UI.top().el); });
        await p.evaluate(() => UI.closeAll());
        await p.context().close();
        t.eq(r, { menu: [], create: [], hud: [], overlap: [], pause: [], journal: [], map: [], satchel: [], shop: [] }, 'taşan ya da çakışan yok');
      });
    }
  },
};
