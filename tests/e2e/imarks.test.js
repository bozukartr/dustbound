'use strict';
/* Etkileşim belirteçleri (js/imarks.js): yaklaşılan şeyin üstünde birkaç saniyelik sade tuş simgesi, solma, yeniden
   görünme; önündeki şeyin (odak) simgesi genişleyip eylemin adını gösterir. Ayar, atlıyken ve nişan alırken gizlenme,
   bina içinde yalnız aynı binanın eşyaları, yan yana aynı eylemin tek simgesi */
module.exports = {
  name: 'Etkileşim belirteçleri',
  async run(t) {
    const p = await t.newGame();
    // kuyunun (karo sırası anahtarlı) belirteci görünüyor mu; odaktaki belirtecin yazısı
    const wellMark = (w) => p.evaluate((w) => { const s = InteractMarks.st.get((w.y >> 4) * WW + (w.x >> 4)); return !!(s && s.el && s.el.classList.contains('on')); }, w);
    const waitWell = (w) => p.waitForFunction((w) => { const s = InteractMarks.st.get((w.y >> 4) * WW + (w.x >> 4)); return !!(s && s.el && s.el.classList.contains('on')); }, w, { timeout: 4000 });
    const shown = () => p.evaluate(() => [...document.querySelectorAll('#imarks .imk.on')].length);
    const focusTxt = () => p.evaluate(() => { const e = document.querySelector('#imarks .imk.on.f'); return e ? e.textContent : null; });
    // kasabanın kuyusu ya da yalağı, çevresi boş bir yer
    const well = await p.evaluate(() => {
      G.godMode = true; G.eventT = 1e9; G.hunterTick = () => {};
      const t = TH.town('harlow'), W = G.world;
      let best = null;
      for (let ty = (t.cy - 700) >> 4; ty < (t.cy + 700) >> 4; ty++) for (let tx = (t.cx - 700) >> 4; tx < (t.cx + 700) >> 4; tx++) {
        const o = W.obj[ty * WW + tx];
        if (o !== O.WELL && o !== O.PUMP && o !== O.TROUGH) continue;
        const x = tx * TS + 8, y = ty * TS + 8;
        if (W.indoorPx(x, y) || W.blocked(x + 70, y, 6)) continue;
        if (!best || dist(x, y, t.cx, t.cy) < dist(best.x, best.y, t.cx, t.cy)) best = { x, y };
      }
      return best;
    });
    t.ok(well, 'kasabada kuyu ya da yalak var');
    const away = () => p.evaluate((w) => { TH.goto(w.x + 900, w.y + 900); }, well);
    const near = () => p.evaluate((w) => { TH.goto(w.x + 70, w.y + 2); G.player.ang = Math.PI / 2; }, well);
    // kuyunun hemen yanı (etkileşim menzili 22 px), yüzü kuyuya dönük: odak
    const atWell = () => p.evaluate((w) => {
      const h = G.horse; if (h && dist(h.x, h.y, w.x, w.y) < 120) { h.x += 600; h.y += 600; }
      for (const [dx, dy] of [[0, 16], [16, 0], [-16, 0], [0, -16], [12, 12], [-12, 12]]) if (!G.world.blocked(w.x + dx, w.y + dy, 4)) { TH.goto(w.x + dx, w.y + dy); G.player.ang = Math.atan2(-dy, -dx); return true; }
      return false;
    }, well);

    await t.step('yaklaşınca kuyunun üstünde sade tuş simgesi belirir; birkaç saniye sonra solar', async () => {
      await away(); await t.sleep(700);
      await near();
      await waitWell(well);
      const r = await p.evaluate((w) => { const s = InteractMarks.st.get((w.y >> 4) * WW + (w.x >> 4)), e = s.el, R = e.getBoundingClientRect(); return { btn: !!e.querySelector('.btn'), txt: e.querySelector('i').textContent, focus: e.classList.contains('f'), w: R.width, h: R.height }; }, well);
      t.ok(r.btn && !r.focus && r.txt === '', 'yalnız tuş simgesi (yazı yok)', r);
      t.ok(r.w > 10 && r.w < 40 && r.h > 10, 'küçük simge', r);
      await t.sleep(3200 + 900);
      t.ok(!(await wellMark(well)), 'birkaç saniye sonra soldu');
    });

    await t.step('yakında beklerken yeniden çıkmaz; uzaklaşıp dönünce yeniden belirir', async () => {
      await t.sleep(1500);
      t.ok(!(await wellMark(well)), 'beklerken yeniden çıkmadı');
      // bekleme süresini kısalt: uzaklaş, dön
      await p.evaluate(() => { IMARK.AGAIN = 1.5; IMARK.GONE = 0.6; });
      await away(); await t.sleep(1600);
      await near();
      await waitWell(well);
      await p.evaluate(() => { IMARK.AGAIN = 10; IMARK.GONE = 2; });
    });

    await t.step('önündeki şeyin simgesi genişler, eylemin adını gösterir; odak sürdükçe kalır', async () => {
      t.ok(await atWell(), 'kuyunun yanında boş yer var');
      await p.waitForFunction(() => !!document.querySelector('#imarks .imk.on.f'), null, { timeout: 4000 });
      const a = await focusTxt(), prompt = await p.evaluate(() => TH.actions());
      t.ok(a && prompt.length >= 2 && a.includes(prompt[1]), 'odaktaki simge istemin ilk eylemini yazar', { a, prompt });
      await t.sleep(4200);
      t.ok(await focusTxt(), 'odak sürdükçe görünür (süreyle solmaz)');
      await near(); await t.sleep(900);
      t.eq(await focusTxt(), null, 'odak bitince genişleyen simge kalkar');
    });

    await t.step('ayar kapalıyken, atlıyken ve nişan alırken belirteç yok', async () => {
      await away(); await t.sleep(400);
      await p.evaluate(() => { G.settings.imarks = false; InteractMarks.clear(); });
      await near(); await t.sleep(1200);
      t.eq(await shown(), 0, 'ayar kapalı: simge yok');
      await atWell(); await t.sleep(600);
      t.eq(await shown(), 0, 'ayar kapalı: odakta da yok');
      await p.evaluate(() => { G.settings.imarks = true; });
      await away(); await t.sleep(400);
      // atlı: atı yanına getirip bin
      await p.evaluate((w) => { InteractMarks.clear(); const P = G.player, h = G.horse; TH.goto(w.x + 70, w.y + 2); h.dead = false; h.x = P.x; h.y = P.y; P.mount(h, true); P.mountAnim = null; }, well);
      await t.sleep(1200);
      t.eq(await shown(), 0, 'atlıyken simge yok');
      await p.evaluate(() => { G.player.dismount(); });
      await waitWell(well);
      // nişan alınca görünen simge hemen solar (nişan tuşu basılı, elde tabanca)
      await p.evaluate(() => { const P = G.player; P.giveWeapon('cattleman'); P.weapon = 'cattleman'; window.__d0 = Input.down; Input.down = function (a) { return a === 'aim' ? true : window.__d0.call(this, a); }; });
      await t.sleep(700);
      const aimed = await shown(), wasAim = await p.evaluate(() => G.player.aiming);
      await p.evaluate(() => { Input.down = window.__d0; G.player.weapon = 'fists'; });
      t.ok(wasAim, 'oyuncu nişan alıyordu');
      t.eq(aimed, 0, 'nişan alırken simge yok');
    });

    await t.step('bina içinde yalnız aynı binanın eşyaları; yan yana aynı eylem tek simge', async () => {
      await away(); await t.sleep(500);
      await p.evaluate(() => { InteractMarks.clear(); const b = G.world.buildings.find(b => b.town === 'harlow' && b.type === 'general'); TH.inside(b); G.player.ang = -Math.PI / 2; });
      await p.waitForFunction(() => document.querySelectorAll('#imarks .imk.on').length > 0, null, { timeout: 4000 });
      const r = await p.evaluate(() => {
        const W = G.world, P = G.player, pb = W.bid[(P.y >> 4) * WW + (P.x >> 4)];
        const st = [...InteractMarks.st.values()].filter(s => s.el && s.el.classList.contains('on'));
        const acts = st.map(s => s.act + '@' + Math.round(s.c.x / 56) + ',' + Math.round(s.c.y / 56));
        return { pb, out: st.filter(s => s.kd === 'in' ? W.bid[s.c.key] !== pb : W.indoorPx(s.c.x, s.c.y) !== W.indoorPx(P.x, P.y)).length, acts, n: st.filter(s => !s.el.classList.contains('f')).length };
      });
      t.ok(r.pb >= 0, 'oyuncu binanın içinde', r);
      t.eq(r.out, 0, 'dışarıdaki ya da başka binadaki şeyin simgesi yok');
      const dup = r.acts.filter((x, i) => r.acts.indexOf(x) !== i);
      t.eq(dup, [], 'aynı eylem yan yana iki kez yok (ör. tezgâhın karoları)');
      t.ok(r.n <= 5, 'aynı anda en çok beş simge', r);
    });

    await t.step('sağ alttaki istem değişmedi; tarama kipi anahtarlı aday listesi döner', async () => {
      await atWell(); await t.sleep(300);
      const a = await p.evaluate(() => TH.actions());
      t.ok(a.length >= 2 && a.includes('Su İç'), 'istem kuyunun eylemlerini verir', a);
      const scan = await p.evaluate(() => { const c = G.findInteraction(IMARK.SCAN); return Array.isArray(c) && c.every(x => 'key' in x); });
      t.ok(scan, 'tarama kipi anahtarlı aday listesi döner');
    });
  },
};
