'use strict';
/* Etkileşim belirteçleri (js/imarks.js): yaklaşılan şeyin üstünde birkaç saniyelik etiket, solma, yeniden görünme,
   ayar, atlıyken gizlenme, bina içinde yalnız aynı binanın eşyaları, yan yana aynı eylemin tek etiketi */
module.exports = {
  name: 'Etkileşim belirteçleri',
  async run(t) {
    const p = await t.newGame();
    const marks = () => p.evaluate(() => [...document.querySelectorAll('#imarks .imk.on')].map(e => e.textContent));
    const waitMark = (re, ms = 4000) => p.waitForFunction((src) => [...document.querySelectorAll('#imarks .imk.on')].some(e => new RegExp(src).test(e.textContent)), re.source, { timeout: ms });
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
    const near = () => p.evaluate((w) => { TH.goto(w.x + 70, w.y + 2); G.player.ang = Math.PI; }, well);

    await t.step('yaklaşınca kuyunun üstünde ad, tuş ve eylem belirir; birkaç saniye sonra solar', async () => {
      await away(); await t.sleep(700);
      await near();
      await waitMark(/Su İç/);
      const r = await p.evaluate(() => { const e = [...document.querySelectorAll('#imarks .imk.on')].find(e => /Su İç/.test(e.textContent)); const R = e.getBoundingClientRect(); return { txt: e.textContent, btn: !!e.querySelector('.btn'), w: R.width, h: R.height }; });
      t.ok(/Kuyu|Yalak|Pompa/i.test(r.txt) && r.btn, 'etikette adı ve tuşu var', r);
      t.ok(r.w > 30 && r.h > 18, 'etiket görünür boyutta', r);
      await t.sleep(IMARK_SHOW_MS + 900);
      t.ok(!(await marks()).some(x => /Su İç/.test(x)), 'birkaç saniye sonra soldu', await marks());
    });

    await t.step('yakında beklerken yeniden çıkmaz; uzaklaşıp dönünce yeniden belirir', async () => {
      await t.sleep(1500);
      t.ok(!(await marks()).some(x => /Su İç/.test(x)), 'beklerken yeniden çıkmadı');
      // bekleme süresini kısalt: uzaklaş, dön
      await p.evaluate(() => { IMARK.AGAIN = 1.5; IMARK.GONE = 0.6; });
      await away(); await t.sleep(1600);
      await near();
      await waitMark(/Su İç/);
      await p.evaluate(() => { IMARK.AGAIN = 10; IMARK.GONE = 2; });
    });

    await t.step('ayar kapalıyken, atlıyken ve nişan alırken belirteç yok', async () => {
      await away(); await t.sleep(400);
      await p.evaluate(() => { G.settings.imarks = false; InteractMarks.clear(); });
      await near(); await t.sleep(1200);
      t.eq((await marks()).length, 0, 'ayar kapalı: etiket yok');
      await p.evaluate(() => { G.settings.imarks = true; });
      await away(); await t.sleep(400);
      // atlı: atı yanına getirip bin
      await p.evaluate((w) => { InteractMarks.clear(); const P = G.player, h = G.horse; TH.goto(w.x + 70, w.y + 2); h.dead = false; h.x = P.x; h.y = P.y; P.mount(h, true); P.mountAnim = null; }, well);
      await t.sleep(1200);
      t.eq((await marks()).length, 0, 'atlıyken etiket yok');
      await p.evaluate(() => { G.player.dismount(); });
      await waitMark(/Su İç/);
      // nişan alınca görünen etiket hemen solar (nişan tuşu basılı, elde tabanca)
      await p.evaluate(() => { const P = G.player; P.giveWeapon('cattleman'); P.weapon = 'cattleman'; window.__d0 = Input.down; Input.down = function (a) { return a === 'aim' ? true : window.__d0.call(this, a); }; });
      await t.sleep(700);
      const aimed = await marks(), wasAim = await p.evaluate(() => G.player.aiming);
      await p.evaluate(() => { Input.down = window.__d0; G.player.weapon = 'fists'; });
      t.ok(wasAim, 'oyuncu nişan alıyordu');
      t.eq(aimed.length, 0, 'nişan alırken etiket yok');
    });

    await t.step('bina içinde yalnız aynı binanın eşyaları; yan yana aynı eylem tek etiket', async () => {
      await away(); await t.sleep(500);
      await p.evaluate(() => { InteractMarks.clear(); const b = G.world.buildings.find(b => b.town === 'harlow' && b.type === 'general'); TH.inside(b); G.player.ang = -Math.PI / 2; });
      await p.waitForFunction(() => document.querySelectorAll('#imarks .imk.on').length > 0, null, { timeout: 4000 });
      const r = await p.evaluate(() => {
        const W = G.world, P = G.player, pb = W.bid[(P.y >> 4) * WW + (P.x >> 4)];
        const st = [...InteractMarks.st.values()].filter(s => InteractMarks.live(s));
        const texts = [...document.querySelectorAll('#imarks .imk.on')].map(e => e.textContent);
        return { pb, out: st.filter(s => s.kd === 'in' ? W.bid[s.c.key] !== pb : W.indoorPx(s.c.x, s.c.y) !== W.indoorPx(P.x, P.y)).length, texts, n: st.length };
      });
      t.ok(r.pb >= 0, 'oyuncu binanın içinde', r);
      t.eq(r.out, 0, 'dışarıdaki ya da başka binadaki şeyin etiketi yok');
      const dup = r.texts.filter((x, i) => r.texts.indexOf(x) !== i);
      t.eq(dup, [], 'aynı etiket iki kez yok (ör. tezgâhın karoları)');
      t.ok(r.n <= 5, 'aynı anda en çok beş etiket', r);
    });

    await t.step('sağ alttaki istem değişmedi: en yakın şey ve eylemleri', async () => {
      await p.evaluate((w) => {
        const h = G.horse; if (h) { h.x += 600; h.y += 600; }
        // kuyunun hemen yanında boş bir yer (etkileşim menzili 22 px)
        for (const [dx, dy] of [[0, 16], [16, 0], [-16, 0], [0, -16], [12, 12], [-12, 12]]) if (!G.world.blocked(w.x + dx, w.y + dy, 4)) { TH.goto(w.x + dx, w.y + dy); G.player.ang = Math.atan2(-dy, -dx); break; }
      }, well);
      await t.sleep(300);
      const a = await p.evaluate(() => TH.actions());
      t.ok(a.length >= 2 && a.includes('Su İç'), 'istem kuyunun eylemlerini verir', a);
      const scan = await p.evaluate(() => { const c = G.findInteraction(IMARK.SCAN); return Array.isArray(c) && c.every(x => 'key' in x); });
      t.ok(scan, 'tarama kipi anahtarlı aday listesi döner');
    });
  },
};
const IMARK_SHOW_MS = 3200;
