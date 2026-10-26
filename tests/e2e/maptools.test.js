'use strict';
/* Harita araçları: açıklamadaki türü gizleyip gösterme (ayarda saklanır), adlandırılmış işaretler (Shift+tık;
   listede ve haritada görünür, tıklayınca hedef olur, sağ tıkla silinir, kayıtta saklanır), konum kartında hedefe
   yol uzunluğu ve tahmini süre */
module.exports = {
  name: 'Harita araçları',
  timeout: 240000,
  async run(t) {
    const p = await t.newGame();
    await p.evaluate(() => {
      UI.closeAll(); G.eventT = 1e9; G.travelT = 1e9;
      const tw = TH.town('harlow'); TH.goto(tw.spawn.x, tw.spawn.y); G.visited.add('harlow');
      window.MP = {
        // haritanın durağan katmanında çizilen simgelerin adları
        icons() {
          const names = [], im0 = Icons.img;
          Icons.img = function (n, ...a) { names.push(n); return im0.call(this, n, ...a); };
          try { const c = document.createElement('canvas'); c.width = innerWidth; c.height = innerHeight; UI.drawMapStatic(c.getContext('2d'), innerWidth, innerHeight); } finally { Icons.img = im0; }
          return names;
        },
        list() { return [...document.querySelectorAll('#map-pins .mp-i em')].map(e => e.textContent); },
      };
    });

    await t.step('açıklamadaki göz türü haritada gizler ve gösterir; tercih saklanır, hedef konmaz', async () => {
      const r = await p.evaluate(() => {
        G.setWaypoint(null);
        const tw = TH.town('harlow');
        UI.openMap(); UI.map.zoom = 2.4; UI.map.cx = tw.cx / TS; UI.map.cy = tw.cy / TS;
        const n0 = MP.icons().filter(n => n === 'glass').length;
        const row = [...document.querySelectorAll('#map-legend .ml-i')].find(n => n.dataset.k === 'glass');
        row.querySelector('.ml-eye').click();
        const hidden = { off: row.classList.contains('off'), set: (G.settings.mapHide || []).includes('glass'), saved: (JSON.parse(Platform.get(SET_KEY) || '{}').mapHide || []).includes('glass'), n: MP.icons().filter(n => n === 'glass').length, wp: !!G.waypoint };
        row.querySelector('.ml-eye').click();
        const back = { off: row.classList.contains('off'), n: MP.icons().filter(n => n === 'glass').length };
        const eyes = document.querySelectorAll('#map-legend .ml-eye').length, rows = document.querySelectorAll('#map-legend .ml-i').length;
        UI.closeAll();
        return { n0, hidden, back, eyes, rows };
      });
      t.ok(r.n0 >= 1, 'saloon simgesi çizilir', r);
      t.ok(r.hidden.off && r.hidden.set && r.hidden.saved && r.hidden.n === 0, 'göz: saloon gizlenir, ayar saklanır', r.hidden);
      t.ok(!r.hidden.wp, 'göze tıklamak hedef koymaz');
      t.ok(!r.back.off && r.back.n === r.n0, 'yeniden tıklayınca görünür', r.back);
      t.eq(r.eyes, r.rows - 1, 'hedef dışındaki her türün gözü var');
    });

    await t.step('Shift+tık ile adlı işaret konur; listede ve haritada görünür, tıklayınca adıyla hedef, sağ tıkla silinir', async () => {
      await p.evaluate(() => { G.setWaypoint(null); G.pins = []; UI.openMap(); UI.map.zoom = 2; UI.map.cx = G.player.x / TS; UI.map.cy = G.player.y / TS; UI.mapDirty = true; });
      await t.sleep(300);
      await p.keyboard.down('Shift'); await p.mouse.click(760, 300); await p.keyboard.up('Shift'); await t.sleep(250);
      const ask = await p.evaluate(() => ({ title: UI.top() ? UI.top().el.querySelector('.p-title').textContent : '', val: (document.querySelector('.ask-in') || {}).value, focus: !!document.activeElement && document.activeElement.classList.contains('ask-in') }));
      t.ok(/İşaretin Adı/.test(ask.title) && ask.val === 'İşaret 1' && ask.focus, 'ad sorulur, önerilen ad yazılı ve kutu odakta', ask);
      await p.keyboard.type('Geyik yatağı'); await p.keyboard.press('Enter'); await t.sleep(250);
      const r = await p.evaluate(() => ({ pins: G.pins.map(x => x.n), list: MP.list(), map: !document.getElementById('mapscreen').classList.contains('hidden'), typing: Input.textFocus, drawn: MP.icons().includes('pin') }));
      t.eq(r.pins, ['Geyik yatağı'], 'işaret kondu');
      t.ok(r.list.length === 1 && r.list[0] === 'Geyik yatağı' && r.map && !r.typing && r.drawn, 'listede ve haritada görünür, harita açık kalır', r);
      await p.mouse.click(760, 300); await t.sleep(700);
      const wp = await p.evaluate(() => ({ n: G.waypoint && G.waypoint.n, card: document.getElementById('map-me').textContent }));
      t.eq(wp.n, 'Geyik yatağı', 'işarete tıklayınca adıyla hedef olur');
      t.ok(/Hedef: Geyik yatağı/.test(wp.card) && /Yol \d/.test(wp.card) && /~\d/.test(wp.card), 'konum kartı hedefe yol ve tahmini süre yazar', wp.card);
      await p.mouse.click(760, 300, { button: 'right' }); await t.sleep(250);
      const d = await p.evaluate(() => ({ pins: G.pins.length, list: MP.list().length, empty: !!document.querySelector('#map-pins .mp-e'), wp: !!G.waypoint }));
      t.ok(d.pins === 0 && d.list === 0 && d.empty, 'sağ tıkla işaret silinir, liste boş ipucunu gösterir', d);
      t.ok(d.wp, 'işaret silinirken hedef kalır');
    });

    await t.step('Q harita işareti koymaz; önerilen adla işaret kayıtta saklanır, yükleyince geri gelir', async () => {
      await p.mouse.move(600, 420);
      await p.keyboard.press('KeyQ'); await t.sleep(250);
      t.ok(await p.evaluate(() => !document.querySelector('.ask-in') && G.pins.length === 0), 'Q ile işaret sorulmaz');
      await p.keyboard.down('Shift'); await p.mouse.click(600, 420); await p.keyboard.up('Shift'); await t.sleep(250);
      await p.keyboard.press('Enter'); await t.sleep(250);
      t.eq(await p.evaluate(() => G.pins.map(x => x.n)), ['İşaret 1'], 'önerilen adla işaret');
      await p.evaluate(() => { UI.closeAll(); G.saveGame(true); });
      await p.evaluate(() => { G.state = 'menu'; G.ents = []; G.pins = []; return G.loadGame(); });
      await p.waitForFunction(() => G.state === 'play', null, { timeout: 120000 });
      const after = await p.evaluate(() => (G.pins || []).map(x => x.n));
      t.eq(after, ['İşaret 1'], 'yükleyince işaretler geri gelir');
    });
  },
};
