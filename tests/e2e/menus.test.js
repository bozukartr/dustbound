'use strict';
/* Menüler: fareyle çıkış yolları (köşedeki ✕, tıklanabilir alt düğmeler ve tuş simgeleri, sağ tık), dükkân al / sat
   düzeni (sütunlar, eylem etiketi, ayrıntı paneli), bina menüsünün sırası, banka, at dükkânı ve terzi ekranları */
module.exports = {
  name: 'Menüler: çıkış yolları, dükkân düzeni, bina menüsü, banka',
  async run(t) {
    const p = await t.newGame();
    await p.evaluate(() => {
      UI.closeAll(); UI.el.help.classList.add('hidden'); TH.clearNpcs();
      G.clock = Math.floor(G.clock / 1440) * 1440 + 12 * 60;   // öğlen: dükkânlar açık
      window.BT = (type) => G.world.buildings.find(q => q.type === type && q.town === 'harlow' && !q.shut) || G.world.buildings.find(q => q.type === type && !q.shut);
      /* en üstteki pencerede bir öğenin ekrandaki ortası (gerçek fare tıklaması için) */
      window.XY = (sel) => { const e = UI.top().el.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
      window.ST = () => ({ depth: UI.stack.length, cls: UI.top() ? UI.top().el.className : '' });
      window.ROW = (re) => [...UI.top().el.querySelectorAll('.p-item')].find(n => re.test(n.querySelector('.pi-l').textContent));
      window.TXT = (n) => (n ? n.textContent.replace(/\s+/g, ' ').trim() : null);
    });
    /* oyun döngüsünün en az n kare ilerlemesini bekle: tıklama bir sonraki karede tuş basışı olarak işlenir; makine
       yüklüyken kareler yavaşlasa da sabit bir süre beklemek yerine karelerin gerçekten geçmesi beklenir */
    const frames = (n = 3) => p.evaluate((n) => new Promise((res) => { const f0 = UI.frame, t0 = performance.now(); const chk = () => (UI.frame >= f0 + n || performance.now() - t0 > 8000 ? res() : requestAnimationFrame(chk)); chk(); }), n);
    const click = async (xy, o) => { await p.mouse.click(xy[0], xy[1], o); await frames(); };
    const st = () => p.evaluate(() => ST());

    /* ---------------- çıkış yolları ---------------- */
    await t.step('panelin köşesinde ✕ durur: tıklanınca bir düzey geri, son pencerede oyuna dönülür', async () => {
      const r = await p.evaluate(async () => {
        UI.closeAll(); const b = BT('general'); TH.inside(b); UI.openBuilding(b);
        const root = UI.top(), rootBack = TXT(root.el.querySelector('.p-foot .pf-back > span:last-child')), rootX = !!root.el.querySelector(':scope > .p-close');
        TH.clickItem(/Alışveriş/);
        const m = UI.top();
        m.render(); await new Promise(res => setTimeout(res, 40));   // içerik yeniden kurulunca düğme geri gelir
        const x = m.el.querySelector(':scope > .p-close'), pr = m.el.getBoundingClientRect(), xr = x.getBoundingClientRect();
        return { ...ST(), rootBack, rootX, n: m.el.querySelectorAll('.p-close').length, back: TXT(m.el.querySelector('.p-foot .pf-back > span:last-child')), dx: xr.right - pr.right, dy: pr.top - xr.top, w: xr.width, title: x.title, xy: XY(':scope > .p-close') };
      });
      t.eq(r.depth, 2, 'dükkân bina menüsünün üstünde açılır'); t.ok(/trade/.test(r.cls), 'dükkân ekranı', r.cls);
      t.ok(r.rootX, 'bina menüsünde ✕ var'); t.eq(r.n, 1, 'yeniden çizimde tek düğme kalır');
      t.eq(r.rootBack, 'Kapat', 'ilk pencerenin düğmesi'); t.eq(r.back, 'Geri', 'üstüne açılan pencerenin düğmesi');
      t.ok(r.dx > 4 && r.dx < 20 && r.dy > 4 && r.dy < 20 && r.w >= 26, 'düğme panelin sağ üst köşesinin üstünde', r);
      t.eq(r.title, 'Kapat', 'ipucu');
      await click(r.xy);
      const a = await p.evaluate(() => ({ ...ST(), xy: XY(':scope > .p-close') }));
      t.eq(a.depth, 1, '✕ yalnızca en üstteki pencereyi kapatır'); t.ok(/building/.test(a.cls), 'bina menüsüne dönülür', a.cls);
      await click(a.xy);
      const z = await p.evaluate(() => ({ ...ST(), state: G.state, pause: !!document.querySelector('.panel.pause') }));
      t.eq(z.depth, 0, 'son pencere de kapanır'); t.ok(z.state === 'play' && !z.pause, 'duraklat menüsü açılmaz', z);
    });

    await t.step('alttaki tuş ipuçları düğmedir: onay seçili satırı çalıştırır, sekme tuşu sekme değiştirir, Kapat kapatır', async () => {
      await p.mouse.move(4, 4);
      const r = await p.evaluate(() => {
        UI.closeAll(); const P = G.player; P.money = 20; P.ammo.pistol = 0;
        UI.openShop('general');
        const m = UI.top(); m.setFocus(ROW(new RegExp(AMMO.pistol.n)), true);
        return { ok: TXT(m.el.querySelector('.p-foot .pf-btn[data-act="confirm"] > span:last-child')), btns: [...m.el.querySelectorAll('.p-foot .pf-btn')].map(b => b.dataset.act), key: !!m.el.querySelector('.p-foot .pf-btn[data-act="confirm"] .btn'), xy: XY('.p-foot .pf-btn[data-act="confirm"]'), m0: P.money, box: AMMO.pistol.box };
      });
      t.eq(r.ok, 'Satın Al', 'onay düğmesi seçili satırın eylemini yazar'); t.eq(r.btns, ['confirm', 'back'], 'alt düğmeler'); t.ok(r.key, 'düğmede tuş simgesi durur');
      await click(r.xy);
      const a = await p.evaluate(() => ({ ammo: G.player.ammo.pistol, money: G.player.money, tab: XY('.p-foot .pf-hint [data-act="tabR"]'), head: XY('.p-tabs [data-act="tabL"]') }));
      t.eq(a.ammo, r.box, 'onay düğmesi seçili satırı satın alır'); t.ok(a.money < r.m0, 'para düşer', a);
      await click(a.tab);
      t.eq(await p.evaluate(() => UI.top().tab), 1, 'alttaki sekme tuşu sekmeyi değiştirir');
      await click(a.head);
      t.eq(await p.evaluate(() => UI.top().tab), 0, 'üstteki sekme tuşu da tıklanır');
      await click(await p.evaluate(() => XY('.p-foot .pf-back')));
      t.eq((await st()).depth, 0, 'Kapat düğmesi pencereyi kapatır');
    });

    await t.step('sağ tık geri döner; basılı kalsa da pencere kapanınca nişana sızmaz', async () => {
      await p.evaluate(() => { UI.closeAll(); const b = BT('general'); TH.inside(b); UI.openBuilding(b); TH.clickItem(/Alışveriş/); });
      await frames();
      await click([640, 360], { button: 'right' });
      const a = await st();
      t.eq(a.depth, 1, 'sağ tık bir düzey geri döner'); t.ok(/building/.test(a.cls), 'bina menüsü', a.cls);
      await p.mouse.move(640, 300); await p.mouse.down({ button: 'right' }); await frames(5);
      const z = await p.evaluate(() => ({ ...ST(), aimKey: Input.binds.kb.aim, aim: Input.down('aim'), held: Input.mouse.b[2] }));
      await p.mouse.up({ button: 'right' });
      t.eq(z.depth, 0, 'son pencere de kapanır'); t.ok(z.aimKey.includes('Mouse2'), 'sağ tık nişan tuşu', z.aimKey); t.ok(!z.aim && !z.held, 'düğme basılı kalsa da nişan alınmaz', z);
    });

    await t.step('seçim yapmadan çıkılamayan pencerede ✕ ve Kapat yok, sağ tık çıkarmaz; duraklat menüsünde köşe düğmesi yok', async () => {
      const r = await p.evaluate(() => {
        UI.closeAll(); UI.menu({ title: 'Seç', cls: 'small', noClose: true, onBack: () => {}, items: [{ label: 'Bir', fn: () => UI.pop() }, { label: 'İki', fn: () => UI.pop() }] });
        const m = UI.top();
        return { x: !!m.el.querySelector('.p-close'), back: !!m.el.querySelector('.pf-back'), ok: !!m.el.querySelector('.pf-btn[data-act="confirm"]') };
      });
      t.ok(!r.x && !r.back && r.ok, 'yalnızca onay düğmesi', r);
      await frames();
      await click([640, 120], { button: 'right' });
      await p.keyboard.press('Escape'); await frames();
      t.eq((await st()).depth, 1, 'sağ tık ve Esc pencereyi kapatmaz');
      const q = await p.evaluate(() => { UI.closeAll(); UI.openPause(); const m = UI.top(); return { x: !!m.el.querySelector('.p-close'), back: TXT(m.el.querySelector('.pf-back > span:last-child')) }; });
      t.ok(!q.x, 'tam ekran duraklat menüsünde köşe düğmesi yok'); t.eq(q.back, 'Kapat', 'alt düğmesi var');
      await frames();
      await click([900, 120], { button: 'right' });
      t.eq((await st()).depth, 0, 'sağ tık duraklat menüsünü kapatır');
    });

    await t.step('oyun masası: ✕ var, tuş simgeleri tıklanır, sağ tık masadan kaldırmaz', async () => {
      const r = await p.evaluate(() => { UI.closeAll(); const P = G.player; P.money = 5; UI.openBlackjack(); return { x: !!UI.top().el.querySelector(':scope > .p-close'), keys: [...UI.top().el.querySelectorAll('.p-foot [data-act]')].map(n => n.dataset.act), deal: XY('.p-foot [data-act="confirm"]') }; });
      t.ok(r.x, 'köşede ✕'); t.eq(r.keys, ['confirm', 'back'], 'bahis aşamasının tuşları');
      await frames();
      await click([640, 360], { button: 'right' });
      t.eq((await st()).depth, 1, 'sağ tık masadan kaldırmaz');
      await click(r.deal);
      const a = await p.evaluate(() => ({ cards: UI.top().el.querySelectorAll('.bj-c .card').length, money: G.player.money, x: XY(':scope > .p-close') }));
      t.ok(a.cards >= 4 && a.money < 5, 'onay tuşuna tıklayınca kâğıt dağıtılır', a);
      const stand = await p.evaluate(() => XY('.p-foot [data-act="alt"]'));   // ilk el 21 değilse
      if (stand) await click(stand);   // Dur: el biter, yeniden bahis aşaması
      const c = await p.evaluate(() => ({ bet: !UI.top().el.querySelector('.p-foot [data-act="alt"]'), money: G.player.money, table: XY('.bj-table') }));
      t.ok(c.bet, 'Dur tuşuna tıklayınca el biter', c);
      await click(c.table);
      const d = await p.evaluate(() => ({ cards: UI.top().el.querySelectorAll('.bj-c .card').length, play: !!UI.top().el.querySelector('.p-foot [data-act="alt"]'), x: XY(':scope > .p-close') }));
      t.ok(d.play && d.cards >= 4, 'bahis aşamasında masaya tıklamak da dağıtır', d);
      await click(d.x);
      t.eq((await st()).depth, 0, '✕ masadan kaldırır');
    });

    await t.step('maymuncuk: ✕ pim denemeden kapatır; bilek güreşinde maç bitene dek çıkış yok', async () => {
      const r = await p.evaluate(() => {
        UI.closeAll(); const P = G.player, b = BT('general'); P.addItem('lockpick', 3, true);
        UI.openLockpick(b); window.LP = UI.top();
        return { n: P.count('lockpick'), x: XY(':scope > .p-close') };
      });
      await frames();
      await click(r.x);
      const a = await p.evaluate(() => ({ ...ST(), k: LP.lock.k, msg: LP.lock.msg, flash: LP.lock.flash > 0, n: G.player.count('lockpick') }));
      t.eq(a.depth, 0, '✕ pencereyi kapatır'); t.ok(a.k === 0 && !a.msg && !a.flash && a.n === r.n, '✕ pim itmez, maymuncuk harcanmaz', a);
      const w = await p.evaluate(() => { const P = G.player; P.money = 5; G.dailyTalk.arm = 0; UI.openArmWrestle(); return { x: !!UI.top().el.querySelector('.p-close') }; });
      t.ok(!w.x, 'maç sürerken ✕ yok');
      await frames(); await p.keyboard.press('Escape'); await frames();
      t.eq((await st()).depth, 1, 'maç sürerken Esc kaldırmaz');
      await p.evaluate(() => { const s = UI.top().arm; s.start = 0; s.pos = Math.max(s.pos, 0.93); });   // maçı hızlandır: rakip masaya yatırmak üzere
      await p.waitForFunction(() => UI.top() && !!UI.top().el.querySelector(':scope > .p-close'), null, { timeout: 15000 });
      await click(await p.evaluate(() => XY(':scope > .p-close')));
      t.eq((await st()).depth, 0, 'maç bitince ✕ gelir ve kapatır');
    });

    await t.step('tuş atarken basılan sağ tık atanır, pencereyi kapatmaz; haritada alttaki Kapat tuşu tıklanır', async () => {
      await p.evaluate(() => { UI.closeAll(); UI.openControls(0); const m = UI.top(), e = ROW(new RegExp('^' + GAME_ACTIONS.find(g => g.id === 'crouch').n)); m.setFocus(e, true); e.click(); });
      await frames();
      t.ok(await p.evaluate(() => !!Input.capture), 'tuş bekleniyor');
      await click([640, 360], { button: 'right' }); await frames();
      const a = await p.evaluate(() => { const o = { ...ST(), key: Input.binds.kb.crouch[0], cap: !!Input.capture }; Input.resetBinds('kb'); G.saveSettings(); UI.closeAll(); return o; });
      t.eq(a.key, 'Mouse2', 'sağ tık eyleme atanır'); t.ok(a.depth === 1 && /controls/.test(a.cls) && !a.cap, 'Tuş Atamaları açık kalır', a);
      await p.evaluate(() => UI.openMap());
      await frames(); await p.mouse.move(640, 300); await frames();
      const h = await p.evaluate(() => { const e = document.querySelector('#map-hint [data-act="back"]'); if (!e) return null; const r = e.getBoundingClientRect(); return { xy: [r.left + r.width / 2, r.top + r.height / 2], shown: UI.mapShown(), cur: getComputedStyle(e).cursor }; });
      t.ok(h && h.shown, 'harita açık, ipucunda Kapat tuşu var', h); t.eq(h.cur, 'pointer', 'tuş tıklanabilir görünür');
      await click(h.xy);
      t.ok(await p.evaluate(() => !UI.mapShown() && UI.stack.length === 0), 'harita kapanır');
    });

    /* ---------------- dükkân ---------------- */
    await t.step('dükkân: sütun başlığı, sende ve fiyat sütunları, paran yetmeyince kırmızı fiyat, odaktaki satırda eylem etiketi', async () => {
      await p.mouse.move(4, 4);
      const r = await p.evaluate(() => {
        UI.closeAll(); const P = G.player; P.money = 1; P.inv = {}; P.addItem('bread', 2, true);
        UI.openShop('general');
        const m = UI.top(), el = m.el, cap = [...el.querySelectorAll('.p-cap > span')];
        const row = ROW(new RegExp('^' + ITEMS.bread.n + '$')), dear = ROW(new RegExp('^' + ITEMS.binoculars.n + '$'));
        m.setFocus(row, true);
        const own = row.querySelector('.sh-own'), pr = row.querySelector('.sh-pr'), capR = cap.map(n => n.getBoundingClientRect());
        const side = el.querySelector('.p-side'), box = side.querySelector('.sd-box'), sr = side.getBoundingClientRect(), br = box.getBoundingClientRect();
        const chip = getComputedStyle(row, '::after'), plain = getComputedStyle(dear, '::after');
        return {
          cap: cap.map(TXT), ownX: Math.abs(own.getBoundingClientRect().right - capR[1].right), prX: Math.abs(pr.getBoundingClientRect().right - capR[2].right),
          own: TXT(own), pr: TXT(pr), prNo: pr.classList.contains('no'), dearNo: dear.querySelector('.sh-pr').classList.contains('no'), dearDis: dear.classList.contains('dis'),
          dearRed: getComputedStyle(dear.querySelector('.sh-pr')).color, prCol: getComputedStyle(ROW(new RegExp('^' + ITEMS.beans.n + '$')).querySelector('.sh-pr')).color,
          chip: chip.content, chipW: parseFloat(chip.width), plain: plain.content, ok: row.dataset.ok,
          pic: !!side.querySelector('.sd-pic svg, .sd-pic .ic'), name: TXT(side.querySelector('.ps-t')), tag: TXT(side.querySelector('.sd-tag')), eff: !!side.querySelector('.ps-e'),
          rows: [...box.querySelectorAll('.sd-row')].map(TXT), gap: sr.bottom - br.bottom, sideW: sr.width / el.getBoundingClientRect().width,
          price: ITEMS.bread.p * G.priceMul(true), cat: ITEM_CATS.find(c => c.id === ITEMS.bread.c).n, capN: P.cap('bread'),
        };
      });
      t.eq(r.cap, ['Eşya', 'Sende', 'Fiyat'], 'sütun başlıkları');
      t.ok(r.ownX < 3 && r.prX < 3, 'sayılar başlıklarının altında hizalı', r);
      t.eq(r.own, '2', 'sendeki sayı'); t.ok(!r.prNo, 'alabildiğin eşyanın fiyatı düz');
      t.ok(r.dearNo && !r.dearDis && r.dearRed !== r.prCol, 'paran yetmeyen eşyanın fiyatı kırmızı (satır kapalı değil)', r);
      t.ok(r.ok === 'Satın Al' && /Satın Al/.test(r.chip) && r.chipW > 30, 'odaktaki satırda eylem etiketi', r); t.ok(r.plain === 'none' || r.plain === 'normal', 'odakta olmayan satırda etiket yok', r.plain);
      t.ok(r.pic && r.name === 'Ekmek' && r.tag === r.cat && r.eff, 'ayrıntı: resim, ad, tür, etkiler', r);
      t.ok(/^Fiyat/.test(r.rows[0]) && r.rows[1] === `Sende2 / ${r.capN}`, 'ayrıntı kutusunda fiyat ve taşıma sınırı', r.rows);
      t.ok(r.gap >= 0 && r.gap < 24, 'fiyat kutusu ayrıntı panelinin dibinde', r.gap); t.ok(r.sideW > 0.3 && r.sideW < 0.45, 'ayrıntı paneli dar sütun', r.sideW);
    });

    await t.step('dükkân: satıra tıklamak satın alır; sayı, cüzdan ve ayrıntı güncellenir; sınırda ve parasızken nedeni yazar', async () => {
      await p.mouse.move(4, 4);
      const xy = await p.evaluate(() => {
        UI.closeAll(); const P = G.player; P.money = 1; P.inv = {}; P.addItem('bread', 2, true); UI.openShop('general');
        const r = ROW(new RegExp('^' + ITEMS.bread.n + '$')).getBoundingClientRect(); return [r.left + 80, r.top + r.height / 2];
      });
      const m0 = await p.evaluate(() => G.player.money);
      await click(xy);
      const a = await p.evaluate(() => {
        const P = G.player, el = UI.top().el, row = ROW(new RegExp('^' + ITEMS.bread.n + '$'));
        const out = { n: P.count('bread'), money: P.money, own: TXT(row.querySelector('.sh-own')), wallet: TXT(el.querySelector('.p-wallet b')), fm: fmtMoney(P.money), spent: el.querySelector('.p-wallet').classList.contains('spent'), rows: [...el.querySelectorAll('.sd-box .sd-row')].map(TXT), focus: TXT(UI.top().focusEl.querySelector('.pi-l')) };
        // taşıma sınırı
        P.inv.bread = P.cap('bread'); UI.top().render();
        const full = ROW(new RegExp('^' + ITEMS.bread.n + '$'));
        out.full = { dis: full.classList.contains('dis'), note: TXT(el.querySelector('.sd-note')), bad: !!el.querySelector('.sd-note.bad'), chip: getComputedStyle(full, '::after').content };
        // para yetmiyor
        P.inv.bread = 1; P.money = 0.01; UI.top().render();
        out.poor = { no: ROW(new RegExp('^' + ITEMS.bread.n + '$')).querySelector('.sh-pr').classList.contains('no'), note: TXT(el.querySelector('.sd-note')), bad: !!el.querySelector('.sd-note.bad'), rowNo: !!el.querySelector('.sd-box .sd-row.no') };
        return out;
      });
      t.eq(a.n, 3, 'bir ekmek alındı'); t.ok(a.money < m0, 'para düştü', a); t.eq(a.own, '3', 'satırdaki sayı güncellenir'); t.eq(a.focus, 'Ekmek', 'odak satırda kalır');
      t.ok(a.wallet === a.fm && a.spent, 'cüzdan güncellenir ve parlar', a); t.ok(/^Sende3 \//.test(a.rows[1]), 'ayrıntıdaki sayı güncellenir', a.rows);
      t.ok(a.full.dis && a.full.bad && a.full.note === 'Daha fazla taşıyamazsın.' && (a.full.chip === 'none' || a.full.chip === 'normal'), 'sınırda satır kapanır, nedeni yazar', a.full);
      t.ok(a.poor.no && a.poor.bad && a.poor.rowNo && a.poor.note === 'Yeterli paran yok.', 'parasızken nedeni yazar', a.poor);
      await p.evaluate(() => UI.closeAll());
    });

    await t.step('dükkân Sat sekmesi: türlerine göre başlıklar, toplu av satışı özeti, tek tek satış', async () => {
      await p.mouse.move(4, 4);
      const r = await p.evaluate(() => {
        UI.closeAll(); const P = G.player; P.money = 0; P.inv = {};
        for (const [id, n] of [['gold_nugget', 1], ['deer_hide', 3], ['bread', 2], ['wolf_pelt', 1], ['ginseng', 4]]) P.addItem(id, n, true);
        UI.openShop('general'); const m = UI.top(); m.tab = 1; m.focusEl = null; m.render(); m.focusFirst();
        const el = m.el, sp = (id) => G.sellPrice(id, 'general');
        const all = el.querySelector('.p-item.sh-all'); m.setFocus(all, true);
        const kids = [...el.querySelector('.p-list').children].filter(n => n.matches('.p-hdr, .p-item')).map(n => (n.matches('.p-hdr') ? '#' + TXT(n) : TXT(n.querySelector('.pi-l'))));
        const total = sp('deer_hide') * 3 + sp('wolf_pelt');
        return {
          kids, cats: ITEM_CATS.map(c => c.n), ok: all.dataset.ok, allOwn: TXT(all.querySelector('.sh-own')), allPr: TXT(all.querySelector('.sh-pr')), total: fmtMoney(total), tot: total,
          rows: [...el.querySelectorAll('.sd-box .sd-row')].map(TXT), sum: TXT(el.querySelector('.sd-box .sd-row.sum b')), foot: TXT(el.querySelector('.p-foot .pf-btn[data-act="confirm"] > span:last-child')),
          xy: (() => { const q = all.getBoundingClientRect(); return [q.left + 90, q.top + q.height / 2]; })(),
        };
      });
      const hdr = r.kids.filter(k => k[0] === '#').map(k => k.slice(1));
      t.eq(hdr, r.cats.filter(c => hdr.includes(c)), 'başlıklar eşya türlerinin sırasıyla'); t.eq(hdr.length, 4, 'dört tür: yiyecek, bitki, av ürünü, değerli', hdr);
      t.eq(r.kids[0], 'Tüm Av Ürünlerini Sat', 'toplu satış en üstte'); t.ok(r.kids.indexOf('#Av Ürünü') < r.kids.indexOf('Geyik Derisi') && r.kids.indexOf('Geyik Derisi') < r.kids.indexOf('Kurt Postu'), 'tür içinde ada göre', r.kids);
      t.eq(r.allOwn, '4', 'toplu satırda toplam adet'); t.eq(r.allPr, r.total, 'toplu satırda toplam değer'); t.ok(r.ok === 'Sat' && r.foot === 'Sat', 'eylem: Sat', r);
      t.ok(r.rows.length === 3 && /Geyik Derisi ×3/.test(r.rows[0]) && /Kurt Postu ×1/.test(r.rows[1]) && /^Toplam/.test(r.rows[2]) && r.sum === r.total, 'özet: satılacaklar ve toplam', r.rows);
      await click(r.xy);
      const a = await p.evaluate(() => {
        const P = G.player, el = UI.top().el, hide = ROW(/^Altın Parçası$/);
        UI.top().setFocus(hide, true);
        const out = { money: P.money, left: Object.keys(P.inv).filter(id => ITEMS[id].c === 'animal').length, all: !!el.querySelector('.sh-all'), rows: [...el.querySelectorAll('.sd-box .sd-row')].map(TXT) };
        UI.top().setFocus(ROW(/^Ginseng$/), true); out.multi = [...el.querySelectorAll('.sd-box .sd-row')].map(n => TXT(n.querySelector('span')));
        ROW(/^Ginseng$/).click(); out.gin = P.count('ginseng'); out.money2 = P.money; out.gp = G.sellPrice('ginseng', 'general');
        UI.closeAll(); return out;
      });
      t.near(a.money, r.tot, 0.011, 'av ürünlerinin toplamı ödenir'); t.eq(a.left, 0, 'av ürünleri satılır'); t.ok(!a.all, 'av ürünü kalmayınca toplu satış satırı kalkar');
      t.ok(/^Birim Fiyat/.test(a.rows[0]) && a.rows[1] === 'Sende1' && a.rows.length === 2, 'tek eşyada birim fiyat ve adet', a.rows);
      t.eq(a.multi, ['Birim Fiyat', 'Sende', 'Hepsinin Değeri'], 'birden çok varsa hepsinin değeri de yazar');
      t.eq(a.gin, 3, 'satıra tıklamak bir tane satar'); t.near(a.money2 - a.money, a.gp, 0.011, 'birim fiyat ödenir');
    });

    /* ---------------- bina menüsü ---------------- */
    await t.step('bina menüsü: önce hizmetler, sonra işletme, en altta kanunsuz işler; çıkış satırı yok', async () => {
      const r = await p.evaluate(() => {
        UI.closeAll(); const P = G.player; P.money = 5000;
        const list = () => [...UI.top().el.querySelector('.p-list').children].filter(n => n.matches('.p-hdr, .p-item')).map(n => (n.matches('.p-hdr') ? '#' + TXT(n) : TXT(n.querySelector('.pi-l'))));
        const b = G.world.buildings.find(q => q.type === 'general' && !q.shut && G.bizForSale(q) && !G.bizOf(q)) || BT('general');
        TH.inside(b); UI.openBuilding(b);
        const pub = list(), w = UI.top().el.getBoundingClientRect().width, danger = [...UI.top().el.querySelectorAll('.p-item.danger .pi-l')].map(TXT), forSale = G.bizForSale(b);
        UI.closeAll();
        const ch = BT('church'); TH.inside(ch); UI.openBuilding(ch); const plain = list(); UI.closeAll();
        if (forSale) G.buyBiz(b);
        TH.inside(b); UI.openBuilding(b); const mine = list(); UI.closeAll();
        return { pub, w, danger, plain, mine, forSale, owned: !!G.bizOf(b), all: [...pub, ...plain, ...mine] };
      });
      t.ok(r.forSale && r.owned, 'satılık bir genel mağaza bulundu ve alındı', r);
      t.eq(r.pub[0], '#Hizmetler', 'ilk bölüm hizmetler'); t.eq(r.pub[1], 'Alışveriş', 'ilk satır günlük iş');
      const hs = r.pub.filter(k => k[0] === '#');
      t.eq(hs, ['#Hizmetler', '#İşletme', '#Kanunsuz'], 'bölümlerin sırası');
      t.ok(r.pub.indexOf('Bu İşletmeyi Satın Al') > r.pub.indexOf('#İşletme') || r.pub.indexOf('Bu İşletmeyi Ucuza Satın Al') > r.pub.indexOf('#İşletme'), 'satın alma İşletme bölümünde', r.pub);
      t.eq(r.pub[r.pub.length - 1], 'Dükkanı Soy', 'soygun en altta'); t.eq(r.danger, ['Dükkanı Soy'], 'soygun kırmızı');
      t.ok(!r.all.some(k => /^(Çık|Kapat)$/.test(k)), 'çıkış satırı yok', r.all);
      t.ok(r.plain.length >= 2 && !r.plain.some(k => k[0] === '#'), 'tek bölümlü binada başlık yok', r.plain);
      t.ok(r.mine[0] === '#İşletmen' && r.mine.indexOf('#Hizmetler') > r.mine.indexOf('Toptan Mal Al') && r.mine.indexOf('Alışveriş') > r.mine.indexOf('#Hizmetler') && !r.mine.includes('#Kanunsuz') && !r.mine.includes('Dükkanı Soy') && !r.mine.includes('#İşletme'), 'kendi işletmende önce işletme kartı ve toptan mal, soygun yok', r.mine);
      t.ok(r.w > 560 && r.w <= 600, 'bina menüsü biraz geniş', r.w);
    });

    /* ---------------- banka ---------------- */
    await t.step('banka: yatırma ve çekme iki sütunda; hesap ve cüzdan başlıkta yan yana güncellenir', async () => {
      await p.mouse.move(4, 4);
      const r = await p.evaluate(() => {
        UI.closeAll(); const P = G.player; P.money = 75; G.bank = 0; UI.openBank();
        const el = UI.top().el, R = (n) => n.getBoundingClientRect();
        const hd = [...el.querySelectorAll('.p-hdr')], d1 = ROW(/^\$1[.,]00 Yatır$/), w1 = ROW(/^\$1[.,]00 Çek$/), all = ROW(/^Tümünü Yatır$/);
        const box = [...el.querySelectorAll('.p-purse .p-wallet')];
        return {
          hdr: hd.map(TXT), sameRow: Math.abs(R(hd[0]).top - R(hd[1]).top) < 2 && R(hd[0]).right <= R(hd[1]).left + 1,
          pair: !!d1 && !!w1 && Math.abs(R(d1).top - R(w1).top) < 2 && R(d1).right <= R(w1).left + 1, half: R(d1).width / R(el.querySelector('.p-list')).width,
          wDis: w1.classList.contains('dis'), dDis: d1.classList.contains('dis'), allR: TXT(all.querySelector('.pi-r')),
          box: box.map(n => [TXT(n.querySelector('span')), TXT(n.querySelector('b'))]), boxRow: box.length === 2 && Math.abs(R(box[0]).top - R(box[1]).top) < 3 && R(box[0]).right <= R(box[1]).left,
          over: R(el.querySelector('.p-title')).right > R(el.querySelector('.p-purse')).left || R(el.querySelector('.p-sub')).right > R(el.querySelector('.p-purse')).left,
          n: UI.top().el.querySelectorAll('.p-item').length, xy: (() => { const q = R(ROW(/^\$10[.,]00 Yatır$/)); return [q.left + 60, q.top + q.height / 2]; })(),
        };
      });
      t.eq(r.hdr, ['Para Yatır', 'Para Çek'], 'sütun başlıkları'); t.ok(r.sameRow && r.pair, 'yatırma solda, çekme sağda aynı hizada', r);
      t.ok(r.half > 0.4 && r.half <= 0.5, 'satır yarım genişlik', r.half); t.eq(r.n, 8, 'dörder satır');
      t.ok(r.wDis && !r.dDis, 'hesap boşken çekme kapalı'); t.ok(/75/.test(r.allR), 'Tümünü Yatır cüzdanı gösterir', r.allR);
      t.ok(r.box.length === 2 && r.box[0][0] === 'Hesap' && r.box[1][0] === 'Cüzdan' && /0/.test(r.box[0][1]) && /75/.test(r.box[1][1]) && r.boxRow, 'başlıkta hesap ve cüzdan yan yana', r.box);
      t.ok(!r.over, 'başlık ve açıklama kutuların altına girmez');
      await click(r.xy);
      const a = await p.evaluate(() => {
        const P = G.player, el = UI.top().el, box = [...el.querySelectorAll('.p-purse .p-wallet b')].map(TXT);
        const out = { bank: G.bank, money: P.money, box, fm: [fmtMoney(G.bank), fmtMoney(P.money)], wDis: ROW(/^\$10[.,]00 Çek$/).classList.contains('dis'), w50: ROW(/^\$50[.,]00 Çek$/).classList.contains('dis') };
        TH.feeds.length = 0; ROW(/^\$50[.,]00 Çek$/).click(); out.why = TH.feeds.slice(); out.bank2 = G.bank;
        TH.clickItem(/Tümünü Yatır/); out.all = [G.bank, P.money];
        TH.clickItem(/Tümünü Çek/); out.back = [G.bank, P.money];
        UI.closeAll(); return out;
      });
      t.ok(a.bank === 10 && a.money === 65, '10 dolar yatırıldı', a); t.eq(a.box, a.fm, 'hesap ve cüzdan kutuları güncellenir');
      t.ok(!a.wDis && a.w50, 'hesaptaki kadarı çekilebilir', a); t.ok(a.bank2 === 10 && a.why.some(s => /Hesabında bu kadar para yok/.test(s)), 'fazlası çekilemez, nedeni söylenir', a.why);
      t.eq(a.all, [75, 0], 'Tümünü Yatır'); t.eq(a.back, [0, 75], 'Tümünü Çek');
    });

    /* ---------------- at dükkânı, terzi ---------------- */
    await t.step('at dükkânı ve terzi: aynı ayrıntı düzeni; çubuklu nitelikler, gereken postlar, kırmızı ücret', async () => {
      await p.mouse.move(4, 4);
      const r = await p.evaluate(() => {
        UI.closeAll(); const P = G.player; P.money = 30; P.inv = {};
        const sb = BT('stable'); TH.inside(sb); UI.openHorseShop(sb);
        let el = UI.top().el;
        const prices = [...el.querySelectorAll('.p-item')].map(n => ({ n: TXT(n.querySelector('.pi-l')), no: n.querySelector('.sh-pr').classList.contains('no'), ok: n.dataset.ok }));
        const horse = { cls: UI.top().el.className, stats: [...el.querySelectorAll('.sd-stats .sd-st')].map(n => [TXT(n.querySelector('span')), !!n.querySelector('.statbar i')]), row: TXT(el.querySelector('.sd-box .sd-row span')), pic: !!el.querySelector('.sd-pic'), note: TXT(el.querySelector('.sd-note')) };
        const cheap = Object.values(HORSE_BREEDS).filter(B => B.p > 0).map(B => B.p * G.priceMul(true)).sort((a, b) => a - b)[0];
        UI.closeAll();
        const tb = G.world.buildings.find(x => x.type === 'tailor' && !x.shut); TH.inside(tb);
        const R = TAILOR.find(q => !ITEMS[q.id].legend) || TAILOR[0], need = Object.entries(R.need);
        P.money = R.fee + 10; for (const [id, n] of need) P.addItem(id, n, true);
        UI.openTailor(tb); el = UI.top().el;
        const row = ROW(new RegExp('^' + ITEMS[R.id].n + '$')); UI.top().setFocus(row, true);
        const ready = { cls: UI.top().el.className, dis: row.classList.contains('dis'), ok: row.dataset.ok, own: TXT(row.querySelector('.sh-own')), pr: TXT(row.querySelector('.sh-pr')), prNo: row.querySelector('.sh-pr').classList.contains('no'),
          mats: [...el.querySelectorAll('.sd-box .sd-row')].slice(0, need.length).map(n => [TXT(n.querySelector('b')), n.classList.contains('ok')]), labels: [...el.querySelectorAll('.sd-box .sd-row span')].map(TXT).slice(need.length), foot: TXT(el.querySelector('.p-foot .pf-btn[data-act="confirm"] > span:last-child')) };
        P.money = 0; P.removeItem(need[0][0], 1); UI.top().render();
        const row2 = ROW(new RegExp('^' + ITEMS[R.id].n + '$')); UI.top().setFocus(row2, true);
        const lack = { dis: row2.classList.contains('dis'), prNo: row2.querySelector('.sh-pr').classList.contains('no'), mat: [...el.querySelectorAll('.sd-box .sd-row')][0].classList.contains('no'), fee: !!el.querySelector('.sd-box .sd-row.no b'), bad: !!el.querySelector('.sd-note.bad') };
        UI.closeAll();
        return { prices, horse, cheap, ready, lack, need: need.map(([id, n]) => `${n} / ${n}`), fee: fmtMoney(R.fee), hours: G.orderHours(R) };
      });
      t.ok(/trade/.test(r.horse.cls) && r.horse.pic, 'at dükkânı dükkân düzeninde', r.horse);
      t.eq(r.horse.stats, [['Hız', true], ['Dayanıklılık', true], ['Sağlık', true]], 'çubuklu nitelikler'); t.eq(r.horse.row, 'Fiyat', 'fiyat kutusu');
      t.ok(r.prices.every(x => x.ok === 'Satın Al') && r.prices.some(x => x.no) && r.prices.every(x => x.no) === (r.cheap > 30), 'paran yetmeyen atların fiyatı kırmızı', r.prices);
      t.ok(/trade/.test(r.ready.cls) && !r.ready.dis && r.ready.ok === 'Sipariş Ver' && r.ready.foot === 'Sipariş Ver', 'terzi: sipariş verilebilir', r.ready);
      t.eq(r.ready.own, `${r.hours} sa`, 'satırda süre'); t.eq(r.ready.pr, r.fee, 'satırda ücret'); t.ok(!r.ready.prNo, 'paran yetiyorsa ücret düz');
      t.eq(r.ready.mats.map(m => m[0]), r.need, 'gereken postlar: elindeki / gereken'); t.ok(r.ready.mats.every(m => m[1]), 'postlar tamamsa yeşil');
      t.eq(r.ready.labels, ['Ücret', 'Süre'], 'ücret ve süre satırları');
      t.ok(r.lack.dis && r.lack.prNo && r.lack.mat && r.lack.fee && r.lack.bad, 'post ya da para eksikse kırmızı ve nedeni yazılı', r.lack);
    });

    await t.step('İngilizcede düğmeler çevrilir (Close / Back); dar pencerede ✕ panelin içinde, ekranın dışına taşmaz', async () => {
      const r = await p.evaluate(() => {
        UI.closeAll(); const l0 = I18N.lang; I18N.setLang('en');
        const b = BT('general'); TH.inside(b); UI.openBuilding(b);
        const root = TXT(UI.top().el.querySelector('.pf-back > span:last-child')), title = UI.top().el.querySelector('.p-close').title;
        TH.clickItem(/Shop/);
        const out = { root, title, back: TXT(UI.top().el.querySelector('.pf-back > span:last-child')), cap: [...UI.top().el.querySelectorAll('.p-cap > span')].map(TXT), depth: UI.stack.length };
        UI.closeAll(); I18N.setLang(l0); return out;
      });
      t.eq(r.depth, 2, 'dükkân açıldı'); t.eq([r.root, r.back, r.title], ['Close', 'Back', 'Close'], 'çıkış düğmeleri'); t.eq(r.cap, ['Item', 'Owned', 'Price'], 'sütun başlıkları');
      await p.setViewportSize({ width: 680, height: 560 });
      const n = await p.evaluate(() => {
        UI.openShop('general');
        const el = UI.top().el, x = el.querySelector(':scope > .p-close').getBoundingClientRect(), pr = el.getBoundingClientRect();
        const out = { inside: x.right <= pr.right && x.top >= pr.top, onScreen: x.left >= 0 && x.right <= innerWidth && x.top >= 0, sideUnder: el.querySelector('.p-side').getBoundingClientRect().top >= el.querySelector('.p-main').getBoundingClientRect().bottom - 1, wide: document.documentElement.scrollWidth <= innerWidth };
        UI.closeAll(); return out;
      });
      await p.setViewportSize({ width: 1280, height: 720 });
      t.ok(n.inside && n.onScreen, 'dar pencerede ✕ panelin içinde ve ekranda', n); t.ok(n.wide, 'yatay taşma yok', n);
    });
  },
};
