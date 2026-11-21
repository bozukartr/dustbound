'use strict';
/* Yol gösterme (js/nav.js): yolları izleyen rota, ilerleme, sapınca yeniden hesaplama, görev rotası (kişisel hedeften
   ayrı), radarda kalan yol/süre ve dönüş, ekran kenarı oku, hıza göre radar yakınlaşması, harita ekranı */
module.exports = {
  name: 'Yol gösterme ve radar',
  async run(t) {
    const p = await t.newGame();
    await p.evaluate(() => { G.godMode = true; G.eventT = 1e9; G.hunterTick = () => {}; window.HOUR = (h) => { G.clock = Math.floor(G.clock / 1440) * 1440 + h * 60; }; HOUR(11); });
    const tick = () => p.evaluate(() => { Nav.tT = 0; Nav.tick(0); });

    await t.step('kişisel hedefin rotası yolları izler, kasabadan kapıdan çıkar', async () => {
      const r = await p.evaluate(() => {
        const a = TH.town('harlow'), b = G.world.towns.filter(t => t.id !== 'harlow').sort((x, y) => dist(x.cx, x.cy, a.cx, a.cy) - dist(y.cx, y.cy, a.cx, a.cy))[0];
        TH.goto(a.cx, a.cy);
        const t0 = performance.now();
        G.setWaypoint(b.cx, b.cy, b.n);
        const ms = performance.now() - t0, R = Nav.wp, W = G.world;
        // yol kesimindeki noktalar gerçekten yolun üstünde mi
        let off = 0;
        R.pts.forEach((q, i) => { if (R.seg[i] >= 0 && !Nav.nearRoad(q[0], q[1], 4)) off++; });
        const outside = R.seg.filter(s => s !== -2).length, road = R.seg.filter(s => s >= 0).length;
        return { ms: Math.round(ms), n: R.pts.length, road, outside, off, len: Math.round(R.len), straight: Math.round(dist(a.cx, a.cy, b.cx, b.cy)), gps: G.gps === R.pts, start: dist(R.pts[0][0], R.pts[0][1], G.player.x, G.player.y), end: dist(R.pts[R.pts.length - 1][0], R.pts[R.pts.length - 1][1], b.cx, b.cy) };
      });
      t.ok(r.n > 10 && r.gps, 'rota kuruldu (harita ekranı da aynı rotayı okur)', r);
      t.ok(r.road > r.outside * 0.5, 'kasaba dışının çoğu yolun üstünde', r);
      t.eq(r.off, 0, 'yol kesimindeki noktalar yolun üstünde');
      t.ok(r.len >= r.straight * 0.95 && r.len < r.straight * 2.2, 'uzunluk makul (kuş uçuşunun 2,2 katından az)', r);
      t.ok(r.start < 2 && r.end < 2, 'oyuncudan başlar, hedefte biter', r);
      t.ok(r.ms < 250, 'rota hızlı kurulur', r);
    });

    await t.step('rota boyunca ilerlerken rota aynı kalır, kalan yol azalır; sapınca yeniden kurulur', async () => {
      const a = await p.evaluate(() => { const R = Nav.wp, k = Math.floor(R.pts.length * 0.4), q = R.pts[k]; window.__R = R; window.__left0 = Nav.left(R); TH.goto(q[0] + 6, q[1] + 4); return { k }; });
      await tick();
      const b = await p.evaluate(() => ({ same: Nav.wp === window.__R, i: Nav.wp.i, left: Nav.left(Nav.wp), left0: window.__left0, done: Nav.wp.done }));
      t.ok(b.same, 'rotanın üstünde: yeniden hesaplanmadı');
      t.ok(b.i >= a.k - 2 && b.left < b.left0 * 0.75, 'ilerleme işlendi, kalan yol azaldı', { a, b });
      // rotadan uzağa sap (rotanın hiçbir yerine 400 px'ten yakın olmayan açık bir yer; rota kıvrılıp oraya yaklaşmasın):
      // süre dolunca yeni rota oyuncudan başlar
      const dv = await p.evaluate(() => {
        const R = Nav.wp, q = R.pts[R.i], far = (o) => o && R.pts.every(w => dist(w[0], w[1], o[0], o[1]) > 400);
        let s = null;
        for (const [dx, dy] of [[520, -520], [-520, 520], [520, 520], [-520, -520], [760, 0], [-760, 0], [0, 760], [0, -760], [1000, 0], [0, 1000]]) { const o = TH.openSpot(q[0] + dx, q[1] + dy, 20); if (far(o)) { s = o; break; } }
        if (s) { TH.goto(s[0], s[1]); R.t = G.t - 10; }
        return !!s;
      });
      t.ok(dv, 'rotadan uzak bir yer bulundu');
      await tick();
      const c = await p.evaluate(() => ({ same: Nav.wp === window.__R, start: dist(Nav.wp.pts[0][0], Nav.wp.pts[0][1], G.player.x, G.player.y) }));
      t.ok(!c.same && c.start < 2, 'saptı: yeni rota oyuncudan başlar', c);
    });

    await t.step('radar: rota çizilir, altında kalan yol ve süre yazar; hıza göre uzaklaşır', async () => {
      const r = await p.evaluate(() => {
        // radarın alt kısmındaki bilgi: rota çiziminden önce ve sonra o bölgedeki pikseller değişir
        const c = UI.rctx;
        UI.drawRadar();
        const info = c.getImageData(224 - 60, (112 + 100 - 25) * 2 - 10, 120, 20).data;
        let dark = 0; for (let i = 0; i < info.length; i += 4) if (info[i] < 60 && info[i + 1] < 45) dark++;
        const nt = Nav.nextTurn(Nav.wp);
        return { dark, turns: Nav.wp.turns.length, nt: nt && Math.round(nt.d), eta: Nav.fmtEta(Nav.etaMin(Nav.left(Nav.wp))) };
      });
      t.ok(r.dark > 200, 'kalan yol ve süre plakası çizildi', r);
      t.ok(/dk|sa/.test(r.eta), 'süre yazısı', r);
      // dörtnala: radar uzaklaşır (karo başına piksel azalır), oyuncunun oku merkezin gerisine kayar
      const z = await p.evaluate(async () => {
        const P = G.player, h = G.horse; h.dead = false; h.x = P.x; h.y = P.y; P.mount(h, true); P.mountAnim = null;
        const z0 = UI._rz;
        h.spd = 170; P.riding.spd = 170;
        for (let k = 0; k < 60; k++) { h.spd = 170; UI.drawRadar(); }
        const z1 = UI._rz, la = Math.hypot(UI._rla[0], UI._rla[1]);
        P.dismount();
        return { z0, z1, la };
      });
      t.ok(z.z1 < z.z0 - 0.3 && z.z1 > 1.1, 'dörtnala radar uzaklaştı', z);
      t.ok(z.la > 5, 'radar gidiş yönünde ileriyi gösterir', z);
    });

    await t.step('görev rotası kişisel hedeften ayrı: ikisi aynı anda, ayrı renkte', async () => {
      const r = await p.evaluate(() => {
        const P = G.player, q = TH.openSpot(P.x - 900, P.y + 700, 30);
        window.__q = { x: q[0], y: q[1] };
        G.questMark = () => window.__q; Object.defineProperty(G, 'storyOn', { get: () => true, configurable: true });
        Nav.tT = 0; Nav.tick(0);
        return { q: !!Nav.q && Nav.q.pts.length > 1, wp: !!Nav.wp, wpTgt: Nav.wp && [Nav.wp.tx, Nav.wp.ty], qTgt: Nav.q && [Nav.q.tx, Nav.q.ty], wpPt: G.waypoint && [G.waypoint.x, G.waypoint.y] };
      });
      t.ok(r.q && r.wp, 'iki rota birden', r);
      t.ok(r.wpTgt[0] === r.wpPt[0] && r.qTgt[0] !== r.wpPt[0], 'görev rotası kişisel hedefi değiştirmedi', r);
      // hedefe yaklaşınca görev rotası kalkar
      await p.evaluate(() => { TH.goto(window.__q.x + 40, window.__q.y); });
      await tick();
      t.ok(!(await p.evaluate(() => !!Nav.q)), 'görev hedefine yaklaşınca rota çizilmez');
      await p.evaluate(() => { const P = G.player; TH.goto(P.x + 900, P.y - 700); });
      await tick();
    });

    await t.step('hedef ekranın dışındaysa kenarda yön oku ve uzaklık; içindeyse ok yok', async () => {
      await p.waitForFunction(() => !!document.querySelector('.nava.wp:not(.off)'), null, { timeout: 4000 });
      const r = await p.evaluate(() => {
        const e = document.querySelector('.nava.wp'), R = e.getBoundingClientRect(), P = G.player, w = G.waypoint;
        const a = Math.atan2(w.y - P.y, w.x - P.x), b = Math.atan2(R.top + R.height / 2 - innerHeight / 2, R.left + R.width / 2 - innerWidth / 2);
        return { txt: e.textContent, da: Math.abs(angDiff(a, b)), inView: R.left >= 0 && R.right <= innerWidth && R.top >= 0 && R.bottom <= innerHeight, d: e.querySelector('path').getAttribute('d') };
      });
      t.ok(/mil|yarda/.test(r.txt), 'uzaklık yazar', r);
      t.ok(r.da < 0.35, 'ok hedefin yönünde (ekranın ortasına göre)', r);
      t.ok(r.inView, 'ok ekranın içinde', r);
      // hedefi ekranın içine al: ok kalkar
      await p.evaluate(() => { const w = G.waypoint; TH.goto(w.x - 60, w.y); });
      await t.sleep(400);
      t.ok(!(await p.evaluate(() => !!document.querySelector('.nava.wp:not(.off)'))), 'hedef ekrandayken ok yok');
    });

    await t.step('hedefe varınca kişisel hedef ve rotası kalkar', async () => {
      await p.evaluate(() => { const w = G.waypoint; TH.goto(w.x + 10, w.y + 10); });
      await p.waitForFunction(() => !G.waypoint && !Nav.wp, null, { timeout: 4000 });
    });

    await t.step('harita ekranı rotaları yolları izleyerek çizer; yol uzunluğu kartta', async () => {
      const r = await p.evaluate(async () => {
        const a = TH.town('harlow'), b = G.world.towns.find(t => t.id !== 'harlow' && dist(t.cx, t.cy, a.cx, a.cy) > 4000);
        TH.goto(a.cx, a.cy); G.setWaypoint(b.cx, b.cy, b.n);
        UI.openMap();
        await new Promise(r => setTimeout(r, 600));
        const card = document.getElementById('map-me').textContent;
        UI.closeAll();
        return { card, left: Math.round(Nav.left(Nav.wp)) };
      });
      t.ok(/Yol/.test(r.card), 'kartta yol uzunluğu ve süre', r);
    });
  },
};
