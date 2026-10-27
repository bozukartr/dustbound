'use strict';
/* Arayüz yenilemesi: ana menü kartı, HUD gösterge kümesi (çakışma yok), radar kadranı, duyuru kuyruğu,
   yardım süresi, hava rozeti, mermi pipleri, mesafe biçimi, duraklatma kayıt defteri, harita, yükleme, ölüm */
module.exports = {
  name: 'Arayüz yenilemesi',
  async run(t) {
    const p = await t.newGame();

    await t.step('HUD gösterge kümesi: madalyonlar, at, durum ve ihtiyaç halkaları kadranın yayında, birbirine binmez, küme derli toplu', async () => {
      const r = await p.evaluate(() => {
        UI.closeAll();
        const P = G.player, h = G.horse; h.x = P.x + 20; h.y = P.y; P.crouch = true; G.coldness = 0.3; G.settings.meters = 1; UI.hudUpdate();
        const sats = ['core-hp', 'core-sta', 'core-de', 'core-hhp', 'core-hsta', 'need-hunger', 'need-thirst', 'need-energy', 'need-clean'];
        const ids = ['radar', ...sats, 'status-icons'];
        const R = ids.map(id => { const b = document.getElementById(id).getBoundingClientRect(); return { id, l: b.left, t: b.top, r: b.right, b: b.bottom }; });
        const hit = [];
        const ra = R[0], rx = (ra.l + ra.r) / 2, ry = (ra.t + ra.b) / 2, rr = (ra.r - ra.l) / 2;
        for (let i = 0; i < R.length; i++) for (let j = i + 1; j < R.length; j++) {
          const a = R[i], c = R[j];
          // madalyonlar daire: kutu kesişimini biraz pay bırakarak ölç
          if (a.l < c.r - 3 && c.l < a.r - 3 && a.t < c.b - 3 && c.t < a.b - 3) {
            if (a.id === 'radar' && sats.includes(c.id)) { const cx = (c.l + c.r) / 2, cy = (c.t + c.b) / 2; if (Math.hypot(cx - rx, cy - ry) > rr + (c.r - c.l) / 2 - 3) continue; }
            hit.push(a.id + '×' + c.id);
          }
        }
        // her madalyon kadranın kenarına yakın: merkeze uzaklığı, kadran ve kendi yarıçapının toplamını en çok 12 piksel aşar
        const far = R.slice(1, 1 + sats.length).filter(c => Math.hypot((c.l + c.r) / 2 - rx, (c.t + c.b) / 2 - ry) - rr - (c.r - c.l) / 2 > 12).map(c => c.id);
        // kümenin kapladığı alan
        const all = R.filter(c => c.r > c.l), box = { w: Math.max(...all.map(c => c.r)) - Math.min(...all.map(c => c.l)), h: Math.max(...all.map(c => c.b)) - Math.min(...all.map(c => c.t)) };
        P.crouch = false; G.coldness = 0; G.settings.meters = 0;
        return { hit, far, box, hs: +getComputedStyle(document.documentElement).getPropertyValue('--hs'), horse: !document.getElementById('horse-cores').classList.contains('hidden'), st: document.querySelectorAll('#status-icons span').length, radar: [document.getElementById('radar').width, document.getElementById('radar').getBoundingClientRect().width] };
      });
      t.eq(r.hit, [], 'çakışma yok');
      t.eq(r.far, [], 'madalyonlar kadranın yayında');
      t.ok(r.box.w / r.hs < 340 && r.box.h / r.hs < 265, 'küme derli toplu', r.box);
      t.ok(r.horse && r.st >= 2, 'at madalyonları ve durum rozetleri görünür', r);
      t.ok(r.radar[0] >= r.radar[1] * 1.8, 'radar iki kat çözünürlükte çizilir', r.radar);
    });

    await t.step('genişletilmiş HUD: madalyonlar ve ihtiyaç halkaları yayı izler, bilgi paneli (adla) açılır', async () => {
      const pos = () => p.evaluate(() => ['core-hp', 'need-clean'].map(id => document.getElementById(id).getBoundingClientRect().left));
      const a = await pos();
      await p.evaluate(() => UI.expandHud());
      await t.sleep(700);
      const l = await pos();
      const r = await p.evaluate(() => ({ x: document.getElementById('hud').classList.contains('hud-x'), info: document.getElementById('hud-xinfo').textContent, name: G.player.name }));
      t.ok(r.x && l[0] > a[0] + 20 && l[1] > a[1] + 20 && r.info.length > 10, 'genişledi', { a, l, r });
      t.ok(r.info.includes(r.name) && /yaşında/.test(r.info), 'bilgi panelinde ad ve yaş', r.info);
      await p.evaluate(() => UI.expandHud());
    });

    await t.step('sağ üst: para ve saat gün kadranının solunda, altında tarih ve yaş; kadranda hava simgesi saate göre döner, ortada sıcaklık, soğukta mavi', async () => {
      const r = await p.evaluate(() => {
        UI.hudUpdate();
        const b = id => document.getElementById(id).getBoundingClientRect();
        const money = b('hud-money'), time = b('hud-time'), dial = b('hud-env');
        const stack = money.bottom <= time.top + 2 && Math.abs(money.right - time.right) < 2 && time.right < dial.left;
        const sub = document.getElementById('hud-sub').textContent, below = b('hud-sub').top >= Math.max(dial.bottom, time.bottom) - 2;
        // hava simgesi kadranın merkezine göre: öğlen üstte, akşam altıda sağda, gece yarısı altta, sabah altıda solda
        const c0 = G.clock, day = Math.floor(c0 / 1440) * 1440, cx = (dial.left + dial.right) / 2, cy = (dial.top + dial.bottom) / 2;
        const orb = {};
        for (const h of [12, 18, 0, 6]) { G.clock = day + h * 60; UI.hudUpdate(); const o = document.querySelector('#hud-env .dl-orb').getBoundingClientRect(); orb[h] = [Math.round((o.left + o.right) / 2 - cx), Math.round((o.top + o.bottom) / 2 - cy)]; }
        G.clock = c0;
        G.coldness = 0.4; UI.hudUpdate();
        const e = document.getElementById('hud-env'), cold = e.classList.contains('cold'), txt = e.textContent, svg = !!e.querySelector('.dl-orb svg');
        G.coldness = 0; UI.hudUpdate();
        return { stack, sub, below, date: G.dateStr(), name: G.player.name, orb, cold, txt, svg, after: e.classList.contains('cold') };
      });
      t.ok(r.stack, 'para saatin üstünde, ikisi kadranın solunda', r);
      t.ok(r.below && r.sub.includes(r.date) && /\d+ yaşında/.test(r.sub) && !r.sub.includes(r.name), 'alt satırda tarih ve yaş (ad yok)', r);
      const o = r.orb;
      t.ok(o[12][1] < -12 && Math.abs(o[12][0]) < 3 && o[18][0] > 12 && Math.abs(o[18][1]) < 3 && o[0][1] > 12 && o[6][0] < -12, 'hava simgesi saate göre halkada döner', o);
      t.ok(r.svg && /\d+°/.test(r.txt), 'simge ve derece', r); t.ok(r.cold && !r.after, 'soğukta işaretlenir', r);
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

    await t.step('istemler başlığıyla tek panelde: tuşlar bir sütunda, eylem adları aynı hizada başlar', async () => {
      await p.evaluate(() => {
        UI.closeAll(); G.eventT = 1e9; G.travelT = 1e9;
        const s = TH.openSpot(); TH.goto(s[0], s[1]); TH.clearNpcs();
        const P = G.player, n = new NPC(P.x + 16, P.y, 'town', { sex: 'f' });
        n.state = 'idle'; n.update = function () {}; G.addEnt(n); P.ang = 0; P.aiming = false;
        P.giveWeapon('cattleman', true); P.weapon = 'cattleman'; P.clip.cattleman = 6;
      });
      await t.sleep(400);
      const r = await p.evaluate(() => {
        const box = document.getElementById('prompts').getBoundingClientRect();
        const rows = [...document.querySelectorAll('#prompts .prompt')].map(e => { const k = e.querySelector('.btn').getBoundingClientRect(), s = e.querySelector('span:last-child').getBoundingClientRect(); return { k: Math.round(k.right), s: Math.round(s.left), in: s.right <= box.right + 1 && k.left >= box.left - 1, txt: e.textContent }; });
        const title = document.querySelector('#prompts .prompt-title').getBoundingClientRect();
        return { rows, panel: getComputedStyle(document.getElementById('prompts')).backgroundImage !== 'none', titleTop: title.top <= Math.min(...[...document.querySelectorAll('#prompts .prompt')].map(e => e.getBoundingClientRect().top)) };
      });
      t.ok(r.rows.length >= 2 && r.panel && r.titleTop, 'başlık üstte, satırlar tek panelde', r);
      t.ok(new Set(r.rows.map(x => x.s)).size === 1 && new Set(r.rows.map(x => x.k)).size === 1 && r.rows.every(x => x.in), 'tuşların sağ kenarı ve eylem adlarının sol kenarı hizalı', r.rows);
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
