'use strict';
/* Arayüz boyutu ayarı, atların binalara girememesi, dükkânda cüzdan, harita açıklamalarından işaretleme */
module.exports = {
  name: 'Arayüz boyutu, at-bina, cüzdan, harita açıklamaları',
  async run(t) {
    const p = await t.newGame();
    await t.step('arayüz boyutu ayarı HUD köşelerini ölçekler ve kaydedilir', async () => {
      const r = await p.evaluate(() => {
        const get = () => ({ hs: +getComputedStyle(document.documentElement).getPropertyValue('--hs'), tr: document.getElementById('hud-tr').getBoundingClientRect().width, bl: document.getElementById('hud-bl').getBoundingClientRect().height });
        G.settings.hudScale = 2; G.applySettings(); const a = get();
        G.settings.hudScale = 0; G.applySettings(); const s = get();
        G.settings.hudScale = 3; G.applySettings(); G.saveSettings(); const b = get();
        return { a, s, b, saved: JSON.parse(localStorage.getItem('frontiersend_settings_v1')).hudScale, opt: (() => { UI.openSettings(2); const ok = [...document.querySelectorAll('.st-row')].some(e => e.dataset.k === 'hudScale'); UI.closeAll(); return ok; })() };
      });
      t.ok(r.s.hs < r.a.hs && r.b.hs > r.a.hs, 'ölçek değişir', r);
      t.ok(r.s.bl < r.a.bl && r.b.bl > r.a.bl, 'sol alt göstergeler küçülür/büyür', r);
      t.ok(r.b.tr > r.a.tr, 'sağ üst büyür', r);
      t.eq(r.saved, 3, 'kaydedildi'); t.ok(r.opt, 'Ayarlar > Görüntü satırı');
      await p.evaluate(() => { G.settings.hudScale = 2; G.applySettings(); G.saveSettings(); });
    });
    await t.step('binilen at kapıdan içeri giremez, başı bile uzanmaz', async () => {
      const r = await p.evaluate(() => {
        const out = [];
        for (const b of G.world.buildings.filter(b => b.town === 'harlow' && b.def.svc && b.def.svc.length).slice(0, 6)) {
          const P = G.player, h = G.horse; UI.closeAll();
          if (P.riding) { P.dismount(); P.mountAnim = null; }
          h.x = b.door.x; h.y = b.door.y + 40; h.spd = 0; P.x = h.x; P.y = h.y; P.mount(h, true); P.mountAnim = null;
          let worst = 0;
          for (let k = 0; k < 80; k++) {
            h.ang = Math.atan2(b.door.y - 40 - h.y, b.door.x - h.x); h.move(Math.cos(h.ang) * 2.5, Math.sin(h.ang) * 2.5);
            if (G.world.indoorPx(h.x, h.y)) worst = 2; else if (G.world.indoorPx(h.x + Math.cos(h.ang) * 10, h.y + Math.sin(h.ang) * 10)) worst = Math.max(worst, 1);
          }
          out.push(worst);
        }
        G.player.dismount(); G.player.mountAnim = null;
        return out;
      });
      t.ok(r.length >= 4 && r.every(v => v === 0), 'hiçbir kapıda içeri uzanmaz', r);
    });
    await t.step('bina içinde kalmış at kapının dışına çıkarılır', async () => {
      const r = await p.evaluate(async () => {
        const b = G.world.buildings.find(b => b.town === 'harlow' && b.type === 'general'), h = G.horse;
        let iy = b.door.y; for (let k = 0; k < 40 && !G.world.indoorPx(b.door.x, iy); k++) iy -= 2;
        h.x = b.door.x; h.y = iy - 8; h.state = 'idle'; h.inT = 0;
        await new Promise(res => setTimeout(res, 800));
        return { inside: G.world.indoorPx(h.x, h.y), d: Math.round(dist(h.x, h.y, b.door.x, b.door.y)) };
      });
      t.ok(!r.inside && r.d < 80, 'dışarı, kapının önüne', r);
    });
    await t.step('dükkânda cüzdan sağ üstte büyük görünür, alışverişte güncellenir', async () => {
      const r = await p.evaluate(async () => {
        UI.closeAll(); const P = G.player; P.money = 50;
        UI.openShop('general');
        const panel = document.querySelector('.panel.shop'), w = panel.querySelector('.p-wallet');
        const pr = panel.getBoundingClientRect(), wr = w.getBoundingClientRect(), fs = parseFloat(getComputedStyle(w.querySelector('b')).fontSize);
        const before = w.querySelector('b').textContent;
        const item = [...panel.querySelectorAll('.p-item')].find(n => !n.classList.contains('dis'));
        item.click(); await new Promise(res => setTimeout(res, 50));
        const w2 = document.querySelector('.panel.shop .p-wallet');
        const out = { right: pr.right - wr.right, top: wr.top - pr.top, fs, before, after: w2.querySelector('b').textContent, spent: w2.classList.contains('spent'), money: fmtMoney(P.money), sub: !!panel.querySelector('.p-sub') };
        UI.closeAll(); return out;
      });
      t.ok(r.right < 40 && r.top < 60, 'sağ üst köşede', r); t.ok(r.fs >= 26, 'büyük yazı', r.fs);
      t.ok(/50/.test(r.before), 'cüzdandaki para gösterilir', r.before);
      t.ok(r.after !== r.before && r.after === r.money && r.spent, 'alınca güncellenir ve parlar', r);
    });
    await t.step('harita açıklamasından tür seçince en yakın yer işaretlenir, yeniden seçince sıradaki', async () => {
      const r = await p.evaluate(() => {
        UI.closeAll(); G.setWaypoint(null);
        const P = G.player, tw = TH.town('harlow'); TH.goto(tw.spawn.x, tw.spawn.y); G.visited.add('harlow');
        UI.openMap();
        const rows = [...document.querySelectorAll('#map-legend .ml-i')];
        const idx = (re) => rows.findIndex(n => re.test(n.textContent));
        const saloons = UI.mapLegendTargets('glass');
        rows[idx(/Saloon/)].click();
        const w1 = G.waypoint && { ...G.waypoint }, on = rows[idx(/Saloon/)].classList.contains('on');
        rows[idx(/Saloon/)].click();
        const w2 = G.waypoint && { ...G.waypoint };
        const sb = G.world.buildings.filter(b => b.type === 'saloon' || b.type === 'cantina' || b.type === 'gambling');
        const nearest = saloons[0];
        [...G.rumored].forEach(id => G.discovered.has(id) || G.rumored.delete(id));
        G.setWaypoint(null); rows[idx(/Söylenti/)].click();
        const none = G.waypoint;
        const cam = { cx: UI.map.cx * TS, cy: UI.map.cy * TS };
        UI.closeAll();
        return { n: saloons.length, w1, w2, on, nearest, none, isDoor: sb.some(b => w1 && b.door.x === w1.x && b.door.y === w1.y), sorted: saloons.every((s, i) => !i || dist(P.x, P.y, s.x, s.y) >= dist(P.x, P.y, saloons[i - 1].x, saloons[i - 1].y)) };
      });
      t.ok(r.n >= 1 && r.isDoor && r.w1.x === r.nearest.x && r.w1.y === r.nearest.y, 'en yakın saloon kapısı işaretlenir', r);
      t.ok(r.on, 'seçili satır vurgulanır'); t.ok(r.sorted, 'yakından uzağa sıralı');
      if (r.n > 1) t.ok(r.w2.x !== r.w1.x || r.w2.y !== r.w1.y, 'ikinci seçim sıradakine geçer', r);
      t.eq(r.none, null, 'bilinen yer yoksa işaret konmaz');
    });
  },
};
