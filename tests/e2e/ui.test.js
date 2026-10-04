'use strict';
/* Arayüz yenilemesi: ana menü kartı, HUD gösterge kümesi (çakışma yok), radar kadranı, duyuru kuyruğu,
   yardım süresi, hava rozeti, mermi pipleri, mesafe biçimi, duraklatma kayıt defteri, harita, yükleme, ölüm */
module.exports = {
  name: 'Arayüz yenilemesi',
  async run(t) {
    const p = await t.newGame();

    await t.step('HUD gösterge kümesi: madalyonlar, at, durum ve ihtiyaçlar birbirine binmez', async () => {
      const r = await p.evaluate(() => {
        UI.closeAll();
        const P = G.player, h = G.horse; h.x = P.x + 20; h.y = P.y; P.crouch = true; G.coldness = 0.3; UI.hudUpdate();
        const ids = ['radar', 'core-hp', 'core-sta', 'core-de', 'core-hhp', 'core-hsta', 'status-icons', 'needs'];
        const R = ids.map(id => { const b = document.getElementById(id).getBoundingClientRect(); return { id, l: b.left, t: b.top, r: b.right, b: b.bottom }; });
        const hit = [];
        for (let i = 0; i < R.length; i++) for (let j = i + 1; j < R.length; j++) {
          const a = R[i], c = R[j];
          // madalyonlar daire: kutu kesişimini biraz pay bırakarak ölç
          if (a.l < c.r - 3 && c.l < a.r - 3 && a.t < c.b - 3 && c.t < a.b - 3) {
            if (a.id === 'radar' && c.id.startsWith('core')) { const cx = (c.l + c.r) / 2, cy = (c.t + c.b) / 2, rx = (a.l + a.r) / 2, ry = (a.t + a.b) / 2; if (Math.hypot(cx - rx, cy - ry) > (a.r - a.l) / 2 + (c.r - c.l) / 2 - 3) continue; }
            hit.push(a.id + '×' + c.id);
          }
        }
        P.crouch = false; G.coldness = 0;
        return { hit, horse: !document.getElementById('horse-cores').classList.contains('hidden'), st: document.querySelectorAll('#status-icons span').length, radar: [document.getElementById('radar').width, document.getElementById('radar').getBoundingClientRect().width] };
      });
      t.eq(r.hit, [], 'çakışma yok');
      t.ok(r.horse && r.st >= 2, 'at madalyonları ve durum rozetleri görünür', r);
      t.ok(r.radar[0] >= r.radar[1] * 1.8, 'radar iki kat çözünürlükte çizilir', r.radar);
    });

    await t.step('genişletilmiş HUD: madalyonlar yayı izler, bilgi paneli açılır', async () => {
      const a = await p.evaluate(() => document.getElementById('core-hp').getBoundingClientRect().left);
      await p.evaluate(() => UI.expandHud());
      await t.sleep(700);
      const r = await p.evaluate(() => ({ x: document.getElementById('hud').classList.contains('hud-x'), l: document.getElementById('core-hp').getBoundingClientRect().left, info: document.getElementById('hud-xinfo').textContent.length }));
      t.ok(r.x && r.l > a + 20 && r.info > 10, 'genişledi', { a, r });
      await p.evaluate(() => UI.expandHud());
    });

    await t.step('sağ üst: hava rozeti ve sıcaklık; soğukta mavi', async () => {
      const r = await p.evaluate(() => {
        G.coldness = 0.4; UI.hudUpdate();
        const e = document.getElementById('hud-env'), cold = e.classList.contains('cold'), txt = e.textContent, svg = !!e.querySelector('svg');
        G.coldness = 0; UI.hudUpdate();
        return { cold, txt, svg, after: e.classList.contains('cold') };
      });
      t.ok(r.svg && /°/.test(r.txt), 'simge ve derece', r); t.ok(r.cold && !r.after, 'soğukta işaretlenir', r);
    });

    await t.step('silah kartı: şarjördeki fişekler pip olarak', async () => {
      const r = await p.evaluate(() => {
        const P = G.player; P.giveWeapon('cattleman', true); P.weapon = 'cattleman'; P.clip.cattleman = 4; P.ammo.pistol = 12; UI.hudUpdate();
        const pips = [...document.querySelectorAll('#w-pips i')];
        const out = { n: pips.length, full: pips.filter(i => !i.classList.contains('e')).length, ammo: document.getElementById('w-ammo').textContent };
        P.weapon = 'fists'; UI.hudUpdate(); out.fist = document.querySelectorAll('#w-pips i').length;
        return out;
      });
      t.eq([r.n, r.full], [6, 4], 'altı yuva, dördü dolu'); t.ok(/4/.test(r.ammo) && /12/.test(r.ammo), 'sayı', r.ammo); t.eq(r.fist, 0, 'yumrukta pip yok');
    });

    await t.step('duyurular sıraya girer: ekranda en fazla iki, aynısı tekrarlanmaz', async () => {
      const r = await p.evaluate(() => {
        UI.toastQ = []; UI.el.toasts.innerHTML = '';
        UI.toast('A', 'a', 'ach'); UI.toast('B', 'b', 'ok'); UI.toast('C', 'c', 'ok'); UI.toast('C', 'c', 'ok'); UI.toast('D', 'd', 'ok');
        return { live: document.querySelectorAll('#toasts .toast:not(.out)').length, q: UI.toastQ.map(x => x.title) };
      });
      t.eq(r.live, 2, 'iki pankart'); t.eq(r.q, ['C', 'D'], 'kuyrukta sıradakiler, tekrar yok');
      await p.waitForFunction(() => [...document.querySelectorAll('#toasts .toast:not(.out) .t-t')].some(e => e.textContent === 'C'), null, { timeout: 9000 });
    });

    await t.step('yardım kartı kalan süreyi gösterir; mesafe biçimi', async () => {
      const r = await p.evaluate(() => { UI.help('Deneme', 4); const h = document.getElementById('hud-help'); return { tick: h.classList.contains('tick'), dur: h.style.getPropertyValue('--dur'), d1: fmtDist(100), d2: fmtDist(1006), d3: fmtDist(6000) }; });
      t.ok(r.tick && r.dur === '4s', 'süre çizgisi', r);
      t.eq(r.d1, '350 yarda', 'kısa mesafe yarda'); t.eq(r.d2, '2,0 mil', 'mil (Türkçe ondalık)'); t.eq(r.d3, '12 mil', 'uzak');
    });

    await t.step('duraklatma: tam ekran, kayıt defteri kartı, oyun bulanıklaşır', async () => {
      const r = await p.evaluate(() => {
        UI.closeAll(); UI.openPause();
        const el = UI.top().el, card = el.querySelector('.pz-card');
        const out = { pause: el.classList.contains('pause'), title: el.querySelector('.p-title').textContent, card: !!card, name: card && card.textContent.includes(G.player.name), img: !!(card && card.querySelector('.pz-frame img')), rows: card ? card.querySelectorAll('.pz-row').length : 0, paused: document.body.classList.contains('paused'), w: el.getBoundingClientRect().width, vw: innerWidth };
        UI.closeAll(); out.after = document.body.classList.contains('paused');
        return out;
      });
      t.ok(r.pause && r.title === 'Duraklatıldı', 'duraklatma', r); t.ok(r.card && r.name && r.img && r.rows >= 6, 'kart: isim, portre, satırlar', r);
      t.ok(r.paused && !r.after, 'arka plan bulanıklığı açılır ve kapanır', r); t.ok(r.w >= r.vw - 2, 'tam ekran', r);
    });

    await t.step('harita: çerçeve, konum kartı, dokulu keşfedilmemiş alan', async () => {
      const r = await p.evaluate(async () => {
        UI.closeAll(); UI.openMap();
        await new Promise(res => setTimeout(res, 700));
        const me = document.getElementById('map-me'), L = UI.fogLayer;
        const out = { me: me.textContent, legend: document.querySelectorAll('#map-legend .ml-i').length, layer: !!(L && L.width > 0), frame: !!document.getElementById('map-frame') };
        UI.closeAll(); return out;
      });
      t.ok(/Konumun/.test(r.me) && r.me.length > 20, 'konum kartı', r.me); t.eq(r.legend, 15, 'açıklamalar'); t.ok(r.layer && r.frame, 'sis katmanı ve çerçeve', r);
    });

    await t.step('yükleme ekranı: atlı ilerlemeyle birlikte gider', async () => {
      const r = await p.evaluate(() => { UI.showLoading(true); UI.loading('...', 0.5); const out = { left: document.getElementById('ld-rider').style.left, svg: !!document.querySelector('#ld-rider svg'), tip: document.getElementById('ld-tip').textContent }; UI.showLoading(false); return out; });
      t.eq(r.left, '50%', 'atlı yarı yolda'); t.ok(r.svg && r.tip.length > 5 && !/^İpucu:/.test(r.tip), 'ipucu başlıksız', r);
    });

    await t.step('ölüm ekranı oyunu griye çevirir, kapanınca geri gelir', async () => {
      const r = await p.evaluate(() => { G.deathCause = 'Kurşun'; UI.showDeath(); const on = document.body.classList.contains('dying'); UI.closeAll(); return { on, off: !document.body.classList.contains('dying') }; });
      t.ok(r.on && r.off, 'gri katman', r);
    });

    await t.step('ana menü: süslü başlık, sürüm, son hayat kartı', async () => {
      await p.evaluate(() => { G.saveGame(true); UI.closeAll(); UI.showMainMenu(); });
      await t.sleep(400);
      const r = await p.evaluate(() => ({ items: [...document.querySelectorAll('#mm-items .mm-item')].map(n => n.dataset.id), card: !document.getElementById('mm-card').classList.contains('hidden'), name: document.querySelector('#mm-card .mmc-n').textContent, ver: document.querySelector('#mm-foot .mm-ver').textContent }));
      t.eq(r.items.slice(0, 3), ['cont', 'load', 'new'], 'menü'); t.ok(r.card && r.name.length > 3, 'son hayat kartı', r); t.ok(/^v\d/.test(r.ver), 'sürüm', r.ver);
    });
  },
};
