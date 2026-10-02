'use strict';
/* Arayüz boyutu ayarı ve atların binalara girememesi */
module.exports = {
  name: 'Arayüz boyutu ve at-bina',
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
  },
};
