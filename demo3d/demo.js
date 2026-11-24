'use strict';
/* =====================================================================
   FRONTIER'S END — 3B TEST PAKETİ (yalnızca npm run build:demo3d paketine girer)

   Oyunun 3B çizimi (js/view3d.js) oyunun kendisindedir; bu dosya test paketini sınırlı bir deneyime çevirir:
     - Çizim Yöntemi açılışta 3B; F3: 3B ↔ Melez, [ ve ]: saati bir saat geri/ileri al
     - Çiftçi Çocuğu geçmişiyle Harlow'da başlanır; hikâye, açılış sinematiği ve hoş geldin rehberi yok
     - Oyuncu kasabanın ortasındaki sınırlı bir alanda kalır (binalar alanın ya tam içinde ya tam dışında;
       tren istasyonu yakındaysa alan istasyonu ve önündeki demiryolunu da kapsar); sınırda alçak direkler
     - Kayıtlar ve ayarlar tam oyununkilerden ve demo paketinden ayrı tutulur
   ===================================================================== */
(() => {
  const S = D3.state, { C, Mesh, GPUMesh, MAT } = D3;
  const T_ = (tr, en) => (typeof I18N !== 'undefined' && I18N.lang === 'en' ? en : tr);
  const AREA_W = 62, AREA_H = 46;   // sınırlı alan (karo), binalara ve istasyona göre genişler ya da daralır
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

  /* ---------------- ayrı kayıt, Harlow başlangıcı, sinematiksiz, 3B açılış ---------------- */
  for (const k of ['get', 'set', 'remove']) { const f = Platform[k].bind(Platform); Platform[k] = (key, ...a) => f('d3_' + key, ...a); }
  for (let i = BACKGROUNDS.length - 1; i >= 0; i--) if (BACKGROUNDS[i].id !== 'farm') BACKGROUNDS.splice(i, 1);
  const newGame = G.newGame;
  G.newGame = function (profile) { S.area = null; S.skipWelcome = true; return newGame.call(this, Object.assign({}, profile, { bg: 'farm', story: false })); };
  const loadGame = G.loadGame;
  G.loadGame = function (...a) { S.area = null; return loadGame.apply(this, a); };
  const cinePlay = Cinema.play.bind(Cinema);
  Cinema.play = function (sc, o) { return BACKGROUNDS.some(b => b.id === sc) || sc === 'farm' ? Promise.resolve() : cinePlay(sc, o); };
  const openWelcome = UI.openWelcome;
  UI.openWelcome = function (cb, ...a) { if (S.skipWelcome) { S.skipWelcome = false; if (cb) setTimeout(cb, 0); return; } return openWelcome.call(this, cb, ...a); };
  const init = G.init;
  G.init = function (...a) { const r = init.apply(this, a); this.settings.gfx = 2; this.resize(); return r; };

  /* ---------------- sınırlı alan ----------------
     Kasaba merkezinde AREA_W × AREA_H karo; tren istasyonu yakındaysa alan istasyonu ve önündeki demiryolunu da kapsar
     (peron, raylar ve gelip geçen tren). Alanın kenarına değen bina, merkezi içerideyse alana katılır, dışarıdaysa alan
     onu dışarıda bırakacak kadar daralır (verandası ve bir karo payıyla). */
  function computeArea(W, town, P) {
    const cx = Math.round(town.cx / 16), cy = Math.round(town.cy / 16);
    const R = { x0: cx - (AREA_W >> 1), x1: cx + (AREA_W >> 1), y0: cy - (AREA_H >> 1), y1: cy + (AREA_H >> 1) };
    const gap = (b) => Math.max(0, R.x0 - (b.x + b.w), b.x - R.x1, R.y0 - (b.y + b.h), b.y - R.y1);
    const st = W.buildings.filter(b => b.type === 'station' && gap(b) <= 48).sort((a, b) => gap(a) - gap(b))[0];
    if (st && W.rails) {
      let best = null, bd = 30 * 16;
      for (const r of W.rails) for (const q of r) { const d = Math.hypot(q[0] - st.door.x, q[1] - st.door.y); if (d < bd) { bd = d; best = q; } }
      R.x0 = Math.min(R.x0, st.x - 2); R.x1 = Math.max(R.x1, st.x + st.w + 2); R.y0 = Math.min(R.y0, st.y - 2); R.y1 = Math.max(R.y1, st.y + st.h + 3);
      if (best) { const tx = Math.floor(best[0] / 16), ty = Math.floor(best[1] / 16); R.x0 = Math.min(R.x0, tx - 5); R.x1 = Math.max(R.x1, tx + 6); R.y0 = Math.min(R.y0, ty - 5); R.y1 = Math.max(R.y1, ty + 6); }
    }
    for (let it = 0; it < 8; it++) {
      let changed = false;
      for (const b of W.buildings) {
        const bx0 = b.x - 1, bx1 = b.x + b.w + 1, by0 = b.y - 1, by1 = b.y + b.h + 2;
        const inter = bx1 > R.x0 && bx0 < R.x1 && by1 > R.y0 && by0 < R.y1, inside = bx0 >= R.x0 && bx1 <= R.x1 && by0 >= R.y0 && by1 <= R.y1;
        if (!inter || inside) continue;
        const bcx = b.x + b.w / 2, bcy = b.y + b.h / 2;
        if (bcx >= R.x0 && bcx < R.x1 && bcy >= R.y0 && bcy < R.y1) { R.x0 = Math.min(R.x0, bx0); R.x1 = Math.max(R.x1, bx1); R.y0 = Math.min(R.y0, by0); R.y1 = Math.max(R.y1, by1); }
        else {
          // en az kayıpla dışarıda bırak
          const opts = [];
          if (bcx >= R.x1) opts.push(['x1', bx0, R.x1 - bx0]);
          if (bcx < R.x0) opts.push(['x0', bx1, bx1 - R.x0]);
          if (bcy >= R.y1) opts.push(['y1', by0, R.y1 - by0]);
          if (bcy < R.y0) opts.push(['y0', by1, by1 - R.y0]);
          opts.sort((a, c) => a[2] - c[2]);
          if (opts.length) R[opts[0][0]] = opts[0][1];
        }
        changed = true;
      }
      if (!changed) break;
    }
    // oyuncunun başladığı yer alanın içinde olsun
    const ptx = Math.floor(P.x / 16), pty = Math.floor(P.y / 16);
    R.x0 = Math.min(R.x0, ptx - 2); R.x1 = Math.max(R.x1, ptx + 3); R.y0 = Math.min(R.y0, pty - 2); R.y1 = Math.max(R.y1, pty + 3);
    return Object.assign(R, { px0: R.x0 * 16 + 6, px1: R.x1 * 16 - 6, py0: R.y0 * 16 + 6, py1: R.y1 * 16 - 6, town: town.id });
  }
  function setupArea(g) {
    const W = g.world, P = g.player;
    const town = W.towns.slice().sort((a, b) => Math.hypot(a.cx - P.x, a.cy - P.y) - Math.hypot(b.cx - P.x, b.cy - P.y))[0];
    if (!town) return;
    S.area = computeArea(W, town, P);
  }
  function clampToArea(g) {
    const P = g.player, A = S.area;
    if (!A || !P) return;
    let hit = false;
    for (const e of P.riding ? [P.riding, P] : [P]) {
      const nx = clamp(e.x, A.px0, A.px1), ny = clamp(e.y, A.py0, A.py1);
      if (nx !== e.x || ny !== e.y) { e.x = nx; e.y = ny; hit = true; }
    }
    if (hit && g.t - S.lastWarn > 5) { S.lastWarn = g.t; UI.feed(T_('Test alanının sınırı: 3B demo yalnızca bu bölgede oynanır.', 'Test area border: the 3D demo is played only in this area.')); }
  }
  const update = G.update;
  G.update = function (dt) {
    update.call(this, dt);
    if (this.state !== 'play' || !this.world || !this.player) return;
    if (!S.area || S.areaW !== this.world) { setupArea(this); S.areaW = this.world; }
    clampToArea(this);
  };

  // sınır direkleri sahneye ek parça olarak (alan değişince yeniden kurulur)
  D3.extraParts = [];
  let borderFor = null;
  D3.onUiUpdate = () => {
    if (S.area && D3.renderer && borderFor !== S.area) {
      for (const p of D3.extraParts) p.mesh.dispose();
      D3.extraParts = [{ mesh: borderMesh(G.world, S.area) }];
      borderFor = S.area;
    }
    const want = G.state === 'play' ? '' : 'none', on = G.settings.gfx === 2 && S.ok;
    if (!badgeEl || badgeEl.style.display !== want || badgeEl._on !== on || badgeEl._look !== S.look) { badge(); badgeEl._on = on; badgeEl._look = S.look; }
  };
  D3.onLock = () => badge();
  // alan sınırı: alçak direkler ve aralarında ip (bina ve dolu karolarda kesilir)
  function borderMesh(W, A) {
    const m = new Mesh(4096), post = C('#6a4a2c'), cap = C('#c8b070');
    const free = (px, py) => { const tx = Math.floor(px / 16), ty = Math.floor(py / 16); const i = ty * WW + tx; return !(W.flags[i] & 10) && !W.solid[i]; };   // bina ve demiryolu dışında
    const edge = [];
    const x0 = A.x0 * 16, x1 = A.x1 * 16, y0 = A.y0 * 16, y1 = A.y1 * 16;
    for (let x = x0; x <= x1; x += 32) edge.push([x, y0], [x, y1]);
    for (let y = y0 + 32; y < y1; y += 32) edge.push([x0, y], [x1, y]);
    m.set({ mat: MAT.SOLID, flags: 0, param: 0, bone: 0 });
    for (const [px, py] of edge) {
      if (!free(Math.min(px, x1 - 1), Math.min(py, y1 - 1))) continue;
      const X = px, Z = py;
      m.box(X, 4.5, Z, 0.8, 4.5, 0.8, post, { top: cap });
      m.box(X, 7.6, Z, 1.4, 0.35, 1.4, cap);
    }
    return new GPUMesh(D3.renderer.gl, m);
  }

  /* ---------------- tuşlar ve işaret ---------------- */
  function toggle() {
    G.settings.gfx = G.settings.gfx === 2 ? 0 : 2;
    G.resize();
    UI.feed(G.settings.gfx === 2 ? T_('3B çizim açık (F3: 2D)', '3D rendering on (F3: 2D)') : T_('2D çizim (F3: 3B)', '2D rendering (F3: 3D)'));
    badge();
  }
  window.addEventListener('keydown', (ev) => {
    if (typeof G === 'undefined' || G.state !== 'play') return;
    if (ev.code === 'F3') { ev.preventDefault(); ev.stopPropagation(); if (!ev.repeat) toggle(); }
    else if ((ev.code === 'BracketRight' || ev.code === 'BracketLeft') && !(UI.isModal && UI.isModal())) {
      ev.preventDefault();
      if (ev.code === 'BracketRight') G.advanceClock(60); else G.clock = Math.max(0, G.clock - 60);
      UI.feed(T_('Saat ', 'Time ') + G.timeStr());
    }
  }, true);
  let badgeEl = null;
  function badge() {
    if (!badgeEl) {
      badgeEl = document.createElement('div');
      badgeEl.id = 'd3-badge';
      badgeEl.style.cssText = 'position:fixed;left:50%;top:6px;transform:translateX(-50%);z-index:40;pointer-events:none;font:12px/1.4 var(--serif, serif);color:#f3e3bd;background:rgba(26,16,10,0.62);border:1px solid rgba(201,164,92,0.5);padding:2px 10px;letter-spacing:0.04em;white-space:nowrap';
      document.body.appendChild(badgeEl);
    }
    const kl = (c) => (typeof KEY_LABEL !== 'undefined' && KEY_LABEL[c]) || c;
    const cam = T_('Fare: bakış ve nişan', 'Mouse: look and aim') + '  ·  Esc: ' + T_('duraklat', 'pause');
    badgeEl.textContent = (G.settings.gfx === 2 && S.ok ? T_('3B TEST', '3D TEST') + '  ·  ' + cam : T_('2D', '2D'))
      + '  ·  F3 ' + T_('3B/2D', '3D/2D') + '  ·  ' + kl('BracketLeft') + ' ' + kl('BracketRight') + ' ' + T_('saat', 'time');
    badgeEl.style.display = G.state === 'play' ? '' : 'none';
  }
  /* ana menüde 3B TEST işareti */
  const showMainMenu = UI.showMainMenu;
  UI.showMainMenu = function (...a) {
    const r = showMainMenu.apply(this, a);
    const v = document.querySelector('#mm-foot .mm-ver'); if (v && !/3B|3D/.test(v.textContent)) v.textContent += T_(' · 3B TEST', ' · 3D TEST');
    const s = document.querySelector('#mainmenu .mm-sub');
    if (s && !document.getElementById('d3-tag')) s.insertAdjacentHTML('afterend', '<div id="d3-tag" class="mm-pre" style="margin-top:6px"></div>');
    const tag = document.getElementById('d3-tag'); if (tag) tag.textContent = T_('3B test demosu — Harlow kasabasında sınırlı alan', '3D test demo — a bounded area of Harlow');
    return r;
  };
})();
