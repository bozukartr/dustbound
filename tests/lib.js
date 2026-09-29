'use strict';
/* ==========================================================
   Test yardımcıları: Playwright yükleme, oyun başlatma,
   doğrulama fonksiyonları ve sayfa içi yardımcılar.
   ========================================================== */
const path = require('path');

/* Playwright: önce projenin kendi node_modules'u, yoksa global kurulum */
function loadPlaywright() {
  try { return require('playwright'); } catch (e) {}
  try {
    const root = require('child_process').execSync('npm root -g', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    return require(path.join(root, 'playwright'));
  } catch (e) {}
  throw new Error('Playwright bulunamadı. Önce "npm install" ve "npx playwright install chromium" çalıştır.');
}

class AssertionError extends Error {}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/* Sayfaya eklenen yardımcılar (oyun başladıktan sonra) */
function pageHelpers() {
  window.TH = {
    feeds: [],
    /* Kasaba dışında, etrafı açık, susuz bir yer bul */
    openSpot(cx, cy, pad = 90) {
      const W = G.world;
      cx = cx === undefined ? G.player.x : cx; cy = cy === undefined ? G.player.y : cy;
      for (let r = 200; r < 5000; r += 40) for (let k = 0; k < 24; k++) {
        const a = k / 24 * TAU, x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
        let ok = !W.townAt(x, y, 60);
        for (let dx = -pad; dx <= pad && ok; dx += 15) for (let dy = -pad; dy <= pad && ok; dy += 15) if (W.blocked(x + dx, y + dy, 4) || W.isWaterPx(x + dx, y + dy) || W.indoorPx(x + dx, y + dy)) ok = false;
        if (ok) return [x, y];
      }
      return null;
    },
    waterSpot() {
      const P = G.player, W = G.world;
      for (let r = 100; r < 8000; r += 32) for (let k = 0; k < 48; k++) { const a = k / 48 * TAU, x = P.x + Math.cos(a) * r, y = P.y + Math.sin(a) * r; if (W.tileAtPx(x, y) === T.WATER) return [x, y]; }
      return null;
    },
    goto(x, y) { const P = G.player; if (P.riding) P.dismount(); P.x = x; P.y = y; G.cam.x = x; G.cam.y = y; },
    clearNpcs() { for (const e of G.ents) if (e.kind === 'npc' || e.kind === 'animal') e.remove = true; G.ents = G.ents.filter(e => !e.remove); },
    /* Binanın içine, kapının hemen arkasına yerleş */
    inside(b) { let ix = b.door.x, iy = b.door.y; for (let k = 0; k < 40 && !G.world.buildingAtPx(ix, iy); k++) iy -= 2; TH.goto(ix, iy - 10); },
    town(id) { return G.world.towns.find(t => t.id === id); },
    menuLabels() { const m = UI.top(); return m ? [...m.el.querySelectorAll('.p-item .pi-l')].map(n => n.textContent) : []; },
    clickItem(re) { const m = UI.top(); const e = m && [...m.el.querySelectorAll('.p-item')].find(n => re.test(n.textContent)); if (!e) return false; e.click(); return true; },
    actions() { const it = G.findInteraction(); return it ? [it.label, ...it.actions.map(a => a.n)] : []; },
    act(re) { const it = G.findInteraction(); const a = it && it.actions.find(x => re.test(x.n)); if (!a) return false; a.fn(); return true; },
  };
  const f0 = UI.feed.bind(UI);
  UI.feed = (t, k) => { TH.feeds.push(String(t).replace(/<[^>]*>/g, '')); return f0(t, k); };
}

module.exports = { loadPlaywright, AssertionError, sleep, pageHelpers };
