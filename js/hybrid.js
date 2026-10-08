'use strict';
/* ==========================================================
   FRONTIER'S END — melez çizim (varsayılan grafik)
   Düz 2D bakış korunur; dünya iki kat piksel yoğunluğuyla çizilir ve her piksel iki tuvale yazılır:
     renk (FC) ve geometri (FG: kırmızı = yükseklik×3, yeşil/mavi = yüzey normali; 255/255 gece yanan cam,
     254/255 hep yanan ateş). Statik dünya (zemin, nesneler, iç mekânlar) 256 pikselik parçalarda bir kez
     pişirilir; bina cepheleri ve çatıları bina başına ayrı tuvaldedir (içeri girince soluklaşır).
   Son geçiş WebGL'dedir: yükseklik haritasında güneşe doğru yürünerek gölge, köşelerde ortam gölgesi,
   duvarda duran nokta ışıklar (fener, pencere, iç mekân), pencerelerden içeri vuran güneş, gece yanan
   camlar, parlama ve Bayer dither ile piksel kademesi. Ardından bugünkü 2D üst katmanlar çizilir.
   WebGL yoksa ya da Ayarlar > Grafik > Klasik seçiliyse oyun eski 2D çizimle sürer.
   ========================================================== */
const HY = (() => {
  const S = 2;                 // dünya pikseli başına tuval pikseli
  const HC = 256, HB = HC * S; // pişirme parçası (dünya px) ve tampon boyu
  const UP = [0, 0, 1], SOUTH = [0, 1, 0];
  const E_WIN = 1, E_FIRE = 2;

  /* ---------------- renk yardımcıları ---------------- */
  const CC = new Map();
  const rgb = (h) => {
    let c = CC.get(h);
    if (!c) {
      if (h[0] === 'r') { const m = h.match(/[\d.]+/g); c = [m[0] / 255, m[1] / 255, m[2] / 255]; }
      else { let x = h.slice(1); if (x.length === 3) x = x[0] + x[0] + x[1] + x[1] + x[2] + x[2]; const n = parseInt(x, 16); c = [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; }
      CC.set(h, c);
    }
    return c;
  };
  const sh = (c, k) => k < 0 ? [c[0] * (1 + k), c[1] * (1 + k), c[2] * (1 + k)] : [c[0] + (1 - c[0]) * k, c[1] + (1 - c[1]) * k, c[2] + (1 - c[2]) * k];
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const hex = (c) => '#' + c.map(v => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, '0')).join('');
  const hs = (x, y, s = 0) => { let h = (x * 374761393 + y * 668265263 + s * 1442695041) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  const clamp01 = (v) => v < 0 ? 0 : v > 1 ? 1 : v;

  /* ---------------- raster hedefi ----------------
     TG: { c, g (Uint8ClampedArray RGBA), w, h, ox, oy (dünya kökeni), o: üst katman {c, g} ya da null }
     LAYER: 0 alt, 1 üst, 2 kendiliğinden (yükseklik > 6 üst katmana) */
  let TG = null, LAYER = 0;
  const bx = (wx) => Math.round((wx - TG.ox) * S), by = (wy) => Math.round((wy - TG.oy) * S);
  const wyOf = (y) => TG.oy + (y + 0.5) / S, wxOf = (x) => TG.ox + (x + 0.5) / S;
  function put(x, y, c, h, n, em) {
    if (x < 0 || y < 0 || x >= TG.w || y >= TG.h) return;
    const over = TG.o && (LAYER === 1 || (LAYER === 2 && h > 6));
    const tc = over ? TG.o.c : TG.c, tg = over ? TG.o.g : TG.g, i = (y * TG.w + x) * 4;
    tc[i] = c[0] * 255; tc[i + 1] = c[1] * 255; tc[i + 2] = c[2] * 255; tc[i + 3] = 255;
    tg[i] = h * 3; tg[i + 3] = 255;
    if (em) { tg[i + 1] = em === E_WIN ? 255 : 254; tg[i + 2] = 255; }
    else { tg[i + 1] = (n[0] * 0.5 + 0.5) * 249; tg[i + 2] = (n[1] * 0.5 + 0.5) * 249; }
  }
  function rect(x0, y0, w, h, c, ht, n = UP, em = 0) {
    // hedefin dışına düşen pikseller hiç hesaplanmaz (put onları zaten atar): parça sınırına taşan bina yarı yarıya ucuzlar
    const ya = y0 < 0 ? y0 + Math.ceil(-y0) : y0, yb = Math.min(y0 + h, TG.h), xa = x0 < 0 ? x0 + Math.ceil(-x0) : x0, xb = Math.min(x0 + w, TG.w);
    for (let y = ya; y < yb; y++) for (let x = xa; x < xb; x++) {
      const cc = typeof c === 'function' ? c(x, y) : c;
      if (!cc) continue;
      put(x, y, cc, typeof ht === 'function' ? ht(x, y) : ht, n, typeof em === 'function' ? em(x, y) : em);
    }
  }
  const facadeH = (baseW) => (x, y) => Math.max(0, baseW - wyOf(y));     // dikey yüz: tabandan yukarı yükselir
  // 2D çizimi geçici tuvale iki kat ölçekte çizip keskin kenarlı piksellere çevirir; step verilirse satır satır adım verir
  function* stampSteps(draw, ox, oy, w, h, hFn, n, filter, step) {
    const cw = Math.ceil(w * S), chh = Math.ceil(h * S), cv = makeCanvas(cw, chh), g = cv.getContext('2d', { willReadFrequently: true });
    g.scale(S, S); g.translate(-ox, -oy); draw(g);
    const d = g.getImageData(0, 0, cw, chh).data, x0 = bx(ox), y0 = by(oy);
    for (let y = 0; y < chh; y++) {
      for (let x = 0; x < cw; x++) {
        const k = (y * cw + x) * 4; if (d[k + 3] < 150) continue;
        const c = [d[k] / 255, d[k + 1] / 255, d[k + 2] / 255]; if (filter && !filter(c)) continue;
        put(x0 + x, y0 + y, c, hFn(x0 + x, y0 + y), typeof n === 'function' ? n(x0 + x, y0 + y) : n, 0);
      }
      if (step) yield* step();
    }
  }
  function stamp(draw, ox, oy, w, h, hFn, n, filter) { for (const _ of stampSteps(draw, ox, oy, w, h, hFn, n, filter)); }
  function signText(txt, x0, y0, w, h, bg, fg, baseW) {
    rect(x0, y0, w, h, (x, y) => (x === x0 || x === x0 + w - 1 || y === y0 || y === y0 + h - 1) ? sh(bg, -0.45) : bg, facadeH(baseW), SOUTH);
    const fc = signText.c || (signText.c = makeCanvas(256, 32)), c = fc.getContext('2d', { willReadFrequently: true });
    c.clearRect(0, 0, 256, 32); c.font = 'bold 12px monospace'; c.textBaseline = 'middle'; c.textAlign = 'center'; c.fillStyle = '#fff';
    c.fillText(txt, 128, 16);
    const d = c.getImageData(0, 0, 256, 32).data, tw = c.measureText(txt).width, sx0 = Math.round(128 - tw / 2), ox = x0 + Math.round((w - tw) / 2), oy = y0 + Math.round(h / 2) - 16;
    for (let y = 0; y < 32; y++) for (let x = Math.max(0, sx0 - 1); x < Math.min(256, sx0 + tw + 1); x++) if (d[(y * 256 + x) * 4 + 3] > 120) {
      const X = ox + x - sx0, Y = oy + y; if (X < x0 + 1 || X >= x0 + w - 1 || Y < y0 + 1 || Y >= y0 + h - 1 || X < 0 || Y < 0 || X >= TG.w || Y >= TG.h) continue;
      const i = (Y * TG.w + X) * 4, tc = TG.c; tc[i] = fg[0] * 255; tc[i + 1] = fg[1] * 255; tc[i + 2] = fg[2] * 255;
    }
  }

  /* Pişirme adım adım: bir adım ~1.5 ms'yi geçince sıra kareye döner (144 Hz'de bir kare ~7 ms). Dönüşte çizim hedefi
     yeniden kurulur, araya giren eşzamanlı pişirme (görünür parça, bina örtüsü) onu değiştirmiş olabilir. */
  function pacer(tg) {
    let t0 = performance.now();
    return function* (force) {
      if (!force && performance.now() - t0 < 1.5) return;
      yield 0; if (tg) { TG = tg; LAYER = 0; } t0 = performance.now();
    };
  }
  // büyük dikdörtgen 16 satırlık şeritler hâlinde: sonuç aynı, şeritlerin arasına adım girer
  function* bands(x0, y0, w, h, c, ht, n, step) {
    for (let y = y0; y < y0 + h; y += 16) { rect(x0, y, w, Math.min(16, y0 + h - y), c, ht, n); yield* step(); }
  }

  /* ---------------- zemin (parça) ---------------- */
  function* ground(W, ox, oy, base) {
    const M = 16, ww = HC + 2 * M, img = new Uint8ClampedArray(ww * ww * 4), cls = new Int16Array(ww * ww);
    yield* W.groundPixels(ox - M, oy - M, ww, ww, img, cls);
    const at = (x, y) => (Math.max(0, Math.min(ww - 1, y)) * ww + Math.max(0, Math.min(ww - 1, x))), step = pacer(null);
    for (let y = 0; y < HB; y++) {
      for (let x = 0; x < HB; x++) {
        const gx = M + x / S, gy = M + y / S, sx = Math.floor(gx), sy = Math.floor(gy), qx = (x & 1), qy = (y & 1);
        const p = at(sx, sy), A = at(sx, sy - 1), Bq = at(sx + 1, sy), Cq = at(sx - 1, sy), D = at(sx, sy + 1);
        let src = p;
        // EPX (Scale2x): sınıf eşitliğine göre köşe pikseli komşudan → merdiven kenarlar yumuşar
        if (!qx && !qy && cls[Cq] === cls[A] && cls[Cq] !== cls[D] && cls[A] !== cls[Bq]) src = A;
        else if (qx && !qy && cls[A] === cls[Bq] && cls[A] !== cls[Cq] && cls[Bq] !== cls[D]) src = Bq;
        else if (!qx && qy && cls[D] === cls[Cq] && cls[D] !== cls[Bq] && cls[Cq] !== cls[A]) src = Cq;
        else if (qx && qy && cls[Bq] === cls[D] && cls[Bq] !== cls[A] && cls[D] !== cls[Cq]) src = D;
        const t = cls[src];
        let r = img[src * 4], g = img[src * 4 + 1], b = img[src * 4 + 2];
        const wx = ox + x / S, wy = oy + y / S, n = hs(Math.round(wx * 2), Math.round(wy * 2), 5);
        let k = 0;
        if (t === T.GRASS || t === T.FOREST) {
          const bl = hs(Math.floor(wx * 2), Math.floor(wy * 2 / 3), 11);
          if (bl > 0.82) k = 0.12; else if (bl < 0.16) k = -0.14;
          if (n > 0.985) k = 0.25;
        } else if (t === T.TOWN || t === T.ROAD || t === T.DRY || t === T.DESERT || t === T.SAND) {
          if (n > 0.97) k = 0.16; else if (n < 0.03) k = -0.2;
          const pb = hs(Math.floor(wx / 1.5), Math.floor(wy / 1.5), 7);
          if (pb > 0.992) k = -0.25; else if (pb > 0.985) k = 0.22;
          if (t === T.ROAD && hs(Math.floor(wx / 6), Math.floor(wy / 3), 9) > 0.8 && n > 0.5) k -= 0.06;
        } else if (t === T.PLANK) {
          const pl = Math.floor(wx / 5), u = wx - pl * 5, sv = Math.floor(wy + hs(pl, 0, 3) * 16), seam = (sv & 15) === 15;
          const c = sh(rgb('#7a5a3a'), (hs(pl, sv >> 4, 4) - 0.5) * 0.18); r = c[0] * 255; g = c[1] * 255; b = c[2] * 255;
          if (u < 0.5) k = -0.42; else if (seam) k = -0.35;
          else if (Math.abs(u - 1) < 0.3 && ((Math.floor(wy * 2) % 32) === 3)) k = -0.3;
          else if (hs(Math.floor(wx * 2), Math.floor(wy / 2), 12) > 0.8) k = 0.07;
        } else if (t !== T.WATER && t !== T.DEEP) { if (n > 0.975) k = 0.1; else if (n < 0.025) k = -0.12; }
        // çimen kenarı: toprağa taşan ot uçları
        if (t !== T.GRASS && t !== T.PLANK && t !== T.WATER && t !== T.DEEP) { const gi = at(Math.floor(gx), Math.floor(gy - 1)); if (cls[gi] === T.GRASS && n > 0.45) { r = r * 0.15 + img[gi * 4] * 0.85; g = g * 0.15 + img[gi * 4 + 1] * 0.85; b = b * 0.15 + img[gi * 4 + 2] * 0.85; } }
        if (k < 0) { r *= 1 + k; g *= 1 + k; b *= 1 + k; } else if (k > 0) { r += (255 - r) * k; g += (255 - g) * k; b += (255 - b) * k; }
        const i = (y * HB + x) * 4;
        base.c[i] = r; base.c[i + 1] = g; base.c[i + 2] = b; base.c[i + 3] = 255;
        base.g[i] = 0; base.g[i + 1] = 124.5; base.g[i + 2] = 124.5; base.g[i + 3] = 255;
      }
      yield* step();
    }
  }

  /* ---------------- ağaçlar ve nesneler ---------------- */
  const AUT = typeof AUTUMN_PAL !== 'undefined' ? AUTUMN_PAL : [['#7a3416', '#a84e1c', '#d07a2a']];
  const SNOW = rgb('#eef2f6');
  // yaprak taç: kümelenmiş tümsekler, her yaprak lekesi farklı ton, tümsek normali; cy taç merkezi (ekran)
  function canopy(x, cy, baseY, r, cols, h, snowy, lumps = 6) {
    const blobs = [];
    for (let k = 0; k < lumps; k++) { const a = k / lumps * TAU + h * 6, rr = r * (0.55 + 0.2 * Math.sin(k * 2.1 + h * 9)); blobs.push([x + Math.cos(a) * r * 0.45, cy + Math.sin(a) * r * 0.4, rr]); }
    blobs.push([x, cy, r * 0.7]); blobs.push([x - r * 0.22, cy - r * 0.3, r * 0.42]);
    const c1 = rgb(cols[0]), c2 = rgb(cols[1]), c3 = rgb(cols[2]);
    for (let yy = by(cy - r * 1.2); yy <= by(cy + r * 1.1); yy++) for (let xx = bx(x - r * 1.2); xx <= bx(x + r * 1.2); xx++) {
      const wx = wxOf(xx), wy = wyOf(yy);
      let best = -1, bn = null;
      for (const [bx0, by0, br] of blobs) { const dx = (wx - bx0) / br, dy = (wy - by0) / br, d = dx * dx + dy * dy; if (d > 1) continue; const z = Math.sqrt(1 - d) * br + (by0 < cy ? 1 : 0); if (z > best) { best = z; bn = [dx, dy, Math.sqrt(1 - d)]; } }
      if (best < 0) continue;
      const lf = hs(Math.floor(wx * 1.4), Math.floor(wy * 1.6), 21 + (h * 100 | 0));
      const lit = -bn[0] * 0.5 - bn[1] * 0.6 + bn[2] * 0.4;
      let c = lit > 0.55 ? c3 : lit > 0.05 ? c2 : c1;
      if (lf > 0.86) c = sh(c, 0.14); else if (lf < 0.12) c = sh(c, -0.22);
      if (snowy && bn[1] < -0.2 && lf > 0.3) c = SNOW;
      const l = Math.hypot(bn[0], bn[1], bn[2] * 1.3);
      put(xx, yy, c, Math.max(7, baseY - wy) + best * 0.4, [bn[0] / l, bn[1] / l, bn[2] * 1.3 / l], 0);
    }
  }
  function trunk(x, y0w, y1w, w, col) {
    const c = rgb(col);
    rect(bx(x - w / 2), by(y0w), Math.max(2, Math.round(w * S)), by(y1w) - by(y0w), (xx) => xx === bx(x - w / 2) ? sh(c, 0.18) : (xx - bx(x - w / 2)) % 3 === 2 ? sh(c, -0.2) : c, facadeH(y1w), SOUTH);
  }
  function pine(x, cy, baseY, r, cols, h, snowy) {
    for (let layer = 0; layer < 3; layer++) {
      const rr = r * (1 - layer * 0.28), ly = cy - layer * 2.2, col = rgb(cols[layer]);
      for (let yy = by(ly - rr); yy <= by(ly + rr); yy++) for (let xx = bx(x - rr); xx <= bx(x + rr); xx++) {
        const dx = wxOf(xx) - x, dy = (wyOf(yy) - ly) / 0.92, a = Math.atan2(dy, dx) - (h * 3 + layer);
        const m = 0.5 + 0.5 * Math.cos(a * 9);                    // dokuz uçlu yıldız
        const R = rr * (0.62 + 0.38 * m), d = Math.hypot(dx, dy) / R;
        if (d > 1) continue;
        const nz = Math.sqrt(1 - d * d * 0.8), lit = -dx / rr * 0.5 - dy / rr * 0.6 + nz * 0.3;
        let c = lit > 0.35 ? sh(col, 0.14) : lit < -0.3 ? sh(col, -0.2) : col;
        if (hs(xx, yy, 33) > 0.9) c = sh(c, -0.15);
        if (snowy && (dy < -rr * 0.15 || lit > 0.2) && hs(xx >> 1, yy >> 1, 4 + layer) > 0.3) c = lit > 0.35 ? SNOW : sh(SNOW, -0.12);
        put(xx, yy, c, Math.max(7, baseY - wyOf(yy)) + nz * 3 + layer * 2, [dx / rr * 0.7, dy / rr * 0.7, nz], 0);
      }
    }
  }
  // elle çizilen nesneler; true dönmezse 2D çizimi keskinleştirilerek kullanılır
  function object(o, x, y, hh, W, tx, ty) {
    const P = bx, Q = by, season = W.season, snowy = season === 3 && W.snowyTile(tx, ty);
    switch (o) {
      case O.PINE: case O.SNOWPINE: {
        const r = 7 + hh * 3.5; LAYER = 2;
        trunk(x, y - 5, y + 3, 2.4, '#4a3322');
        pine(x, y - 7, y + 3, r, ['#20361f', '#2c4a28', '#3a5d33'], hh, o === O.SNOWPINE || snowy);
        return true;
      }
      case O.OAK: case O.APPLE: case O.BIRCH: {
        const birch = o === O.BIRCH, r = birch ? 6 + hh * 3 : 8 + hh * 3.5; LAYER = 2;
        trunk(x, y - 6, y + 3, birch ? 2.4 : 3.2, birch ? '#e8e4d8' : '#4e3826');
        if (W.bareTree(tx, ty)) return false;
        let cs = birch ? ['#4a6a2a', '#5e8436', '#7a9e48'] : season === 1 ? ['#2e4a1e', '#3c5c26', '#4f7030'] : ['#314d22', '#3f6129', '#557a35'];
        if (season === 2) cs = birch ? ['#b8902a', '#d8b040', '#f0d060'] : AUT[Math.floor(hh * AUT.length)];
        canopy(x, y - 8, y + 3, r, cs, hh, snowy, birch ? 5 : 6);
        if (o === O.APPLE && season !== 3) for (let k = 0; k < 7; k++) { const a = k * 1.9 + hh * 7; rect(P(x + Math.cos(a) * r * 0.55) - 1, Q(y - 8 + Math.sin(a) * r * 0.5) - 1, 3, 3, (xx, yy) => (xx + yy) % 3 ? rgb('#c0302a') : rgb('#e85a4a'), 16, UP); }
        return true;
      }
      case O.CYPRESS: {
        const r = 8 + hh * 3; LAYER = 2;
        trunk(x, y - 6, y + 1, 3.4, '#5a4a3a');
        canopy(x, y - 8, y + 2, r, ['#2e3a22', '#3a4a2a', '#4d5e36'], hh, snowy, 7);
        return true;
      }
      case O.SEQUOIA: {
        LAYER = 2;
        trunk(x, y - 16, y + 2, 14, '#7a4028');
        canopy(x, y - 26, y + 6, 30, ['#1f3a1c', '#2a4a24', '#3a5e30'], hh, snowy, 9);
        return true;
      }
      case O.BUSH: {
        LAYER = 0;
        const c = season === 2 ? (hh > 0.5 ? ['#7a4a1e', '#9a6026', '#b87a30'] : ['#6a5a26', '#8a7230', '#a88a3a']) : season === 3 ? ['#4a4a36', '#5a5a42', '#6a6a50'] : hh > 0.5 ? ['#3a5a26', '#4a6e30', '#5e8440'] : ['#40562a', '#506a34', '#688246'];
        canopy(x, y - 1, y + 3, 5.2, c, hh, snowy, 5);
        return true;
      }
      case O.LAMP: {
        LAYER = 0; rect(P(x - 1), Q(y - 10), 4, Q(y + 2) - Q(y - 10), (xx) => xx === P(x - 1) ? rgb('#4a4440') : rgb('#1e1a18'), facadeH(y + 2), SOUTH);
        LAYER = 1;
        rect(P(x - 3), Q(y - 17), 12, 16, (xx, yy) => { const u = xx - P(x - 3), v = yy - Q(y - 17); if (v < 3 || v > 13 || u < 2 || u > 9) return rgb('#1e1a18'); return mix(rgb('#e8e0c0'), rgb('#9aa8a8'), v / 14); }, facadeH(y + 2), SOUTH, (xx, yy) => { const u = xx - P(x - 3), v = yy - Q(y - 17); return v >= 3 && v <= 13 && u >= 2 && u <= 9 ? E_WIN : 0; });
        rect(P(x - 3.5), Q(y - 18), 14, 2, rgb('#2a2622'), 21, UP);
        return true;
      }
      case O.HITCH: {
        LAYER = 0;
        for (const px of [x - 8, x + 6.5]) rect(P(px), Q(y - 6), 3, Q(y + 2) - Q(y - 6), (xx) => xx === P(px) ? rgb('#7a5838') : rgb('#4a3220'), facadeH(y + 2), SOUTH);
        rect(P(x - 8), Q(y - 7), P(x + 8) - P(x - 8), 3, (xx, yy) => yy === Q(y - 7) ? rgb('#9a7650') : rgb('#6a4a2e'), 8, SOUTH);
        return true;
      }
      case O.TROUGH: {
        LAYER = 0;
        rect(P(x - 10), Q(y - 4), 40, 8, (xx, yy) => { const u = xx - P(x - 10), v = yy - Q(y - 4); if (u < 3 || u > 36 || v < 2) return rgb('#7a5636'); const w = mix(rgb('#4a7a8a'), rgb('#2a4a5a'), v / 8); return (u + v * 3) % 11 === 0 ? sh(w, 0.4) : w; }, 5, UP);
        rect(P(x - 10), Q(y), 40, 6, (xx) => (xx - P(x - 10)) % 8 === 7 ? rgb('#4a3220') : rgb('#6a4a2e'), facadeH(y + 3), SOUTH);
        return true;
      }
      case O.BENCH: {
        LAYER = 0;
        rect(P(x - 8), Q(y - 6), 32, 4, (xx, yy) => yy === Q(y - 6) ? rgb('#7a5838') : rgb('#5a3e26'), facadeH(y), SOUTH);
        rect(P(x - 8), Q(y - 3), 32, 6, (xx, yy) => (yy - Q(y - 3)) % 3 === 2 ? rgb('#5a3e26') : rgb('#8a6640'), 4, UP);
        rect(P(x - 7), Q(y), 3, 4, rgb('#3a2818'), facadeH(y + 2), SOUTH); rect(P(x + 6), Q(y), 3, 4, rgb('#3a2818'), facadeH(y + 2), SOUTH);
        return true;
      }
      case O.CRATE: {
        LAYER = 0;
        rect(P(x - 5), Q(y - 6), 20, 6, (xx, yy) => { const u = xx - P(x - 5), v = yy - Q(y - 6); return u < 2 || u > 17 || v < 1 ? rgb('#7a5a34') : (u + v) % 9 === 0 ? rgb('#7a5a34') : rgb('#b08a56'); }, 8, UP);
        rect(P(x - 5), Q(y), 20, 8, (xx, yy) => { const u = xx - P(x - 5), v = yy - Q(y); return u < 2 || u > 17 || v > 6 || Math.abs(u - v * 2.4) < 1.5 ? rgb('#5a4226') : rgb('#8a6a40'); }, facadeH(y + 4), SOUTH);
        return true;
      }
      case O.BARREL: {
        LAYER = 0;
        for (let yy = -4; yy <= 4; yy++) for (let xx = -8; xx <= 8; xx++) { const d = Math.hypot(xx / 8, yy / 4); if (d > 1) continue; put(P(x) + xx, Q(y - 6) + yy, d > 0.8 ? rgb('#5a3a20') : d > 0.5 ? rgb('#946640') : rgb('#7a5230'), 10, UP, 0); }
        rect(P(x - 4), Q(y - 6), 16, Q(y + 3) - Q(y - 6), (xx, yy) => { const v = yy - Q(y - 6), u = xx - P(x - 4); if (v === 6 || v === 7 || v === 14 || v === 15) return rgb('#3e3e40'); return u < 3 ? rgb('#8a5e36') : u > 12 ? rgb('#5a3a20') : u % 4 === 0 ? rgb('#6a4628') : rgb('#7a5230'); }, facadeH(y + 3), SOUTH);
        return true;
      }
      case O.WELL: {
        LAYER = 0;
        for (let yy = -14; yy <= 14; yy++) for (let xx = -14; xx <= 14; xx++) { const r = Math.hypot(xx, yy * 1.05); if (r > 13.5) continue; const c = r > 9 ? (hs(Math.floor(Math.atan2(yy, xx) * 4), Math.floor(r / 3), 2) > 0.5 ? rgb('#8a847a') : rgb('#6e6860')) : r > 7.5 ? rgb('#4a4640') : mix(rgb('#2e4450'), rgb('#101a20'), r / 8); put(P(x) + xx, Q(y) + yy, c, r > 7.5 ? 6 : 1, UP, 0); }
        LAYER = 1;
        for (const px of [x - 6, x + 4.5]) rect(P(px), Q(y - 14), 3, Q(y - 1) - Q(y - 14), rgb('#5a3e26'), facadeH(y + 11), SOUTH);
        for (let k = 0; k < 16; k++) { const half = Math.round(k * 18 / 16); rect(P(x) - half, Q(y - 20) + k, half * 2, 1, (xx) => (xx + k) % 5 === 0 ? rgb('#4a2a18') : xx < P(x) ? rgb('#7a4428') : rgb('#5a3420'), 20 - k * 0.3, [0, 0.4, 0.9]); }
        return true;
      }
      case O.PUMP: {
        LAYER = 0;
        rect(P(x - 2), Q(y - 8), 8, 20, (xx) => xx - P(x - 2) < 2 ? rgb('#6a7078') : rgb('#3a4048'), facadeH(y + 2), SOUTH);
        rect(P(x + 2), Q(y - 6), 8, 3, rgb('#3a4048'), 8, SOUTH);
        for (let k = 0; k < 8; k++) put(P(x - 2) - k, Q(y - 8) - Math.round(k * 0.75), rgb('#2a2e34'), 11, UP, 0);
        return true;
      }
      case O.BOARD: {
        LAYER = 2;
        for (const px of [x - 5, x + 3.6]) rect(P(px), Q(y - 10), 3, Q(y + 2) - Q(y - 10), rgb('#4a3422'), facadeH(y + 2), SOUTH);
        rect(P(x - 6), Q(y - 17), 24, 18, (xx, yy) => { const u = xx - P(x - 6), v = yy - Q(y - 17); if (u < 1 || u > 22 || v < 1 || v > 16) return rgb('#4a3020'); if (u > 2 && u < 10 && v > 2 && v < 12) return (v % 2 && u > 3 && u < 9) ? rgb('#8a8070') : rgb('#e8dcc0'); if (u > 11 && u < 20 && v > 4 && v < 15) return (v % 2 && u > 12 && u < 19) ? rgb('#8a8070') : rgb('#d8ccb0'); return rgb('#6a4a2e'); }, facadeH(y + 2), SOUTH);
        return true;
      }
      case O.FENCEH: {
        LAYER = 0;
        rect(P(x - 1), Q(y - 5), 4, Q(y + 1.5) - Q(y - 5), (xx) => xx === P(x - 1) ? rgb('#7a5838') : rgb('#4a3220'), facadeH(y + 1.5), SOUTH);
        for (const [ry, c] of [[y - 3.6, '#8a6a46'], [y - 0.6, '#6a4a2e']]) rect(P(x - 8), Q(ry), P(x + 8) - P(x - 8), 3, (xx, yy) => yy === Q(ry) ? sh(rgb(c), 0.2) : rgb(c), facadeH(y + 1.5), SOUTH);
        return true;
      }
      case O.FENCEV: {
        LAYER = 0;
        for (const [rx, c] of [[x - 1.5, '#8a6a46'], [x + 1, '#6a4a2e']]) rect(P(rx), Q(y - 8), 3, P(16), rgb(c), 3, UP);
        rect(P(x - 1.5), Q(y - 4), 5, 9, (xx) => xx === P(x - 1.5) ? rgb('#7a5838') : rgb('#4a3220'), facadeH(y + 1), SOUTH);
        return true;
      }
      case O.ROCK: case O.BOULDER: {
        LAYER = 0;
        const r = o === O.ROCK ? 2.5 + hh * 2 : 6 + hh * 3, ry = r * 0.8, cy = y - (o === O.BOULDER ? 1 : 0), base = rgb(o === O.ROCK ? '#8a8278' : '#77706a');
        for (let yy = by(cy - ry); yy <= by(cy + ry); yy++) for (let xx = bx(x - r); xx <= bx(x + r); xx++) {
          const dx = (wxOf(xx) - x) / r, dy = (wyOf(yy) - cy) / ry, a = Math.atan2(dy, dx), wob = 1 + 0.12 * Math.sin(a * 5 + hh * 9), d = Math.hypot(dx, dy) / wob;
          if (d > 1) continue;
          const nz = Math.sqrt(1 - d * d), facet = Math.floor((a + Math.PI) / (TAU / 7));
          let c = sh(base, (hs(facet, Math.floor(d * 2), 3) - 0.5) * 0.2 + (-dx * 0.25 - dy * 0.3 + nz * 0.1));
          if (hs(xx, yy, 8) > 0.93) c = sh(c, -0.18);
          if (snowy && dy < -0.1) c = SNOW;
          put(xx, yy, c, nz * r * 1.1, [dx * 0.8, dy * 0.8, nz], 0);
        }
        return true;
      }
      case O.TUFT: {
        LAYER = 0; if (snowy) return true;
        const gc = season === 2 ? ['#6e5020', '#a88a40'] : season === 3 ? ['#504632', '#7a6a4a'] : ['#3e5a24', '#8aa850'];
        for (let k = 0; k < 7; k++) { const sx = P(x - 3) + k * 2, len = 3 + Math.round(hs(k, x, 3) * 3); for (let v = 0; v < len; v++) put(sx + (v > 2 ? (k % 2 ? 1 : -1) : 0), Q(y + 2) - v, v === len - 1 ? rgb(gc[1]) : rgb(gc[0]), v * 0.5, UP, 0); }
        return true;
      }
    }
    return false;
  }
  // 2D nesne çizimi yedek: alt (g) ve üst (o) katmanlar ayrı ayrı keskinleştirilir
  function objectFallback(o, x, y, hh, W) {
    const ox = x - 48, oy = y - 70, w = 96, h = 86, base = y + 3;
    const hF = (xx, yy) => Math.max(0, Math.min(60, base - wyOf(yy)));
    LAYER = 0; stamp((g) => Spr.object(g, NOPCTX, o, x, y, hh, W), ox, oy, w, h, hF, (xx, yy) => (hF(xx, yy) > 2 ? SOUTH : UP));
    LAYER = 1; stamp((g) => Spr.object(NOPCTX, g, o, x, y, hh, W), ox, oy, w, h, (xx, yy) => Math.max(7, hF(xx, yy)), [0, 0.3, 0.95]);
    LAYER = 0;
  }

  /* ---------------- binalar: cephe + çatı (bina başına örtü tuvali) ---------------- */
  const WESTERN_SKIP = new Set(['station', 'barn', 'hermit', 'cabin', 'house', 'property', 'ranch']);
  function windowGlass(x0, y0, w, hh, id, k, framed, lit) {
    rect(x0, y0, w, hh, (x, y) => {
      const u = x - x0, v = y - y0;
      if (u === 0 || u === w - 1 || v === 0 || v === hh - 1) return rgb('#2e2014');
      if (u === 1 || u === w - 2 || v === 1 || v === hh - 2) return framed;
      if (u === (w >> 1) - 1 || u === (w >> 1) || v === (hh >> 1) - 1) return sh(framed, -0.06);
      const sky = mix(rgb('#9ab8cc'), rgb('#2c3e52'), Math.min(1, v / (hh * 0.55) + u * 0.03));
      if ((u + v) % 7 === 0 && v < hh / 2) return sh(sky, 0.35);
      if (hs(id, k, 9) > 0.5 && (u < 4 || u > w - 5) && v > 2) return rgb('#8a3a2a');
      return sky;
    }, facadeH(TG.base), SOUTH, (x, y) => { const u = x - x0, v = y - y0; return lit && u > 1 && u < w - 2 && v > 1 && v < hh - 2 && !(u === (w >> 1) - 1 || u === (w >> 1) || v === (hh >> 1) - 1) ? E_WIN : 0; });
  }
  function* western(b, W, step) {
    const d = b.def, X = b.x * TS, Y = b.y * TS, Wd = b.w * TS, Hd = b.h * TS, base = Y + Hd, id = b.id;
    const FW = d.tall ? 30 : 22, wy = base - FW, h = hash2(b.x, b.y, 5);
    const wall = rgb(d.wall), roof = rgb(d.roof), snowy = W.season === 3 && W.snowyTile(b.x + (b.w >> 1), b.y + (b.h >> 1));
    const xL = bx(X), xR = bx(X + Wd), yTop = by(wy), yBase = by(base);
    TG.base = base;
    // ön cephe: dikey tahtalar, ton farkı, damar, süpürgelik, korniş
    yield* bands(xL, yTop, xR - xL, yBase - yTop, (x, y) => {
      const pl = Math.floor((x - xL) / 7), u = (x - xL) % 7, k = (hs(pl, id, 1) - 0.5) * 0.14;
      let c = sh(wall, k);
      if (u === 6) c = sh(wall, -0.38); else if (u === 0) c = sh(c, 0.08);
      if (hs(x, Math.floor(y / 3), id) > 0.93) c = sh(c, -0.1);
      if (y >= yBase - 4) c = sh(wall, -0.32);
      if (y < yTop + 3) c = sh(wall, y === yTop ? 0.2 : -0.12);
      return c;
    }, facadeH(base), SOUTH, step);
    // kapı
    const dx = bx(b.door.x), barn = b.type === 'stable' || b.type === 'barn';
    if (barn) {
      const w = 40, x0 = dx - w / 2, y0 = yBase - 32;
      rect(x0, y0, w, 32, (x) => { const u = (x - x0) % 8, c = rgb('#5a3a22'); return u === 7 ? sh(c, -0.4) : sh(c, (hs(Math.floor((x - x0) / 8), 3, id) - 0.5) * 0.15); }, facadeH(base), SOUTH);
      for (let k = 0; k <= 32; k++) { const a = Math.round(k * w / 32 / 2); for (const xx of [x0 + a, x0 + w / 2 - 1 - a, x0 + w / 2 + a, x0 + w - 1 - a]) put(xx, y0 + k, rgb('#c8b090'), base - wyOf(y0 + k), SOUTH, 0); }
      rect(x0 - 2, y0 - 2, w + 4, 2, rgb('#3a2616'), facadeH(base), SOUTH);
    } else {
      const x0 = dx - 9, y0 = yBase - 29, swing = b.type === 'saloon' || b.type === 'cantina' || b.type === 'gambling';
      rect(x0 - 1, y0 - 2, 20, 31, rgb('#3a2414'), facadeH(base), SOUTH);
      rect(x0 + 1, y0, 16, 29, (x, y) => {
        if (swing) { const inner = rgb('#1a120c'); if (y < y0 + 8 || y > y0 + 22) return inner; const c = rgb('#8a6038'); return (x === x0 + 8) ? inner : (y % 3 === 0 ? sh(c, -0.25) : sh(c, x < x0 + 9 ? 0.05 : -0.05)); }
        const c = rgb('#6a4628'), u = x - x0 - 1, v = y - y0;
        if (u === 0 || u === 15 || v === 0 || v === 13 || v === 28) return sh(c, -0.3);
        if ((u === 3 || u === 12) && v > 2 && v < 26 && v !== 13) return sh(c, -0.18);
        return sh(c, v < 13 ? 0.04 : -0.02);
      }, facadeH(base), SOUTH);
      if (!swing) { put(x0 + 13, y0 + 15, rgb('#e0b040'), base - wyOf(y0 + 15), SOUTH, 0); put(x0 + 13, y0 + 16, rgb('#a07820'), base - wyOf(y0 + 16), SOUTH, 0); }
    }
    yield* step();
    // pencereler (gece içeriden yanar; bazı evlerin ışığı kapalıdır)
    const nWin = Math.max(1, Math.floor(b.w / 3)), lit = b.type === 'saloon' || b.type === 'hotel' || b.type === 'sheriff' || hs(id, 7, 3) > 0.3;
    const rows = d.tall ? [wy + FW - 16, wy + 3] : [wy + FW - 16];
    for (let k = 0; k < nWin; k++) {
      const cxw = X + (k + 0.5) * Wd / nWin;
      if (Math.abs(cxw - b.door.x) < 10) continue;
      for (const ry of rows) { const x0 = bx(cxw - 4), y0 = by(ry); windowGlass(x0, y0, 16, 18, id, k, rgb('#e0d4b8'), lit); rect(x0 - 1, y0 + 18, 18, 2, rgb('#c8b898'), facadeH(base), SOUTH); }
      yield* step();
    }
    // veranda: ince saçak ve direkler
    if (!d.ruin && b.type !== 'station' && b.type !== 'barn' && b.type !== 'hermit') {
      const y0 = by(base - 3), yb = by(base + 2);
      rect(bx(X - 1), y0, bx(X + Wd + 1) - bx(X - 1), yb - y0, (x, y) => { const v = y - y0, c = snowy ? SNOW : sh(roof, -0.08); return v === yb - y0 - 1 ? sh(c, -0.4) : (x % 6 === 0 ? sh(c, -0.18) : sh(c, v < 3 ? 0.1 : 0)); }, 15, [0, 0.5, 0.86]);
      for (const px of [X + 1, X + Wd - 2.6]) rect(bx(px), yb, 3, by(base + 14) - yb, (x) => x === bx(px) ? rgb('#5a4028') : rgb('#3e2a18'), facadeH(base + 14), SOUTH);
    }
    yield* step();
    yield* roofGable(X, Y, Wd, wy, FW, roof, id, h, snowy, b.type !== 'station', step);
    yield* step();
    // sahte cephe ve tabela
    const txt = b.type === 'property' ? (b.owned ? 'HOME' : 'FOR SALE') : SIGN_TEXT[b.type];
    if (!d.church && !WESTERN_SKIP.has(b.type) && !d.ruin) {
      const fh = 12 + (d.tall ? 6 : 0), top = wy - fh;
      rect(xL, by(top), xR - xL, yTop - by(top), (x, y) => {
        const wyy = wyOf(y), side = x < bx(X + Wd * 0.2) || x >= bx(X + Wd * 0.8);
        if (side && wyy < top + 4) return null;
        const pl = Math.floor((x - xL) / 7), u = (x - xL) % 7; let c = sh(wall, (hs(pl, id, 1) - 0.5) * 0.14 + 0.03);
        if (u === 6) c = sh(wall, -0.38);
        const capY = side ? top + 4 : top;
        if (wyy < capY + 1.5) c = sh(wall, 0.3); else if (wyy < capY + 3) c = sh(wall, -0.3);
        return c;
      }, facadeH(base), SOUTH);
      if (txt) { const sw = Math.min(Wd - 8, txt.length * 4.6 + 6); signText(txt, bx(X + Wd / 2 - sw / 2), by(top + 1), Math.round(sw * S), 18, rgb(d.sign || '#c9a45c'), rgb('#1a120c'), base); }
    } else if (txt) { const sw = txt.length * 4.6 + 6; signText(txt, bx(X + Wd / 2 - sw / 2), by(wy - 9), Math.round(sw * S), 16, rgb(d.sign || '#c9a45c'), rgb('#1a120c'), base); }
    yield* step();
    if (d.church) {
      const cx = X + Wd / 2, ry0 = Y - 8;
      rect(bx(cx - 7), by(ry0 - 26), 28, 60, (x) => (x - bx(cx - 7)) % 6 === 5 ? rgb('#c8c0b0') : rgb('#ece6da'), facadeH(ry0 + 30 + FW), SOUTH);
      for (let k = 0; k < 32; k++) { const half = Math.round(k * 18 / 32); rect(bx(cx) - half, by(ry0 - 42) + k, half * 2, 1, (x) => x < bx(cx) ? rgb('#5a4a44') : rgb('#3a2e2a'), 70 - k, [0, 0.5, 0.86]); }
      windowGlass(bx(cx - 3), by(ry0 - 18), 12, 16, id, 99, rgb('#c8c0b0'), false);
      rect(bx(cx - 0.8), by(ry0 - 50), 3, 18, rgb('#d8c080'), 76, SOUTH); rect(bx(cx - 3), by(ry0 - 47), 12, 3, rgb('#d8c080'), 76, SOUTH);
    }
    if (b.type === 'station') {
      rect(bx(X - 30), by(base - 2), bx(X + Wd + 30) - bx(X - 30), 12, (x, y) => (y - by(base - 2)) < 2 ? rgb('#5a6a7a') : ((x >> 2) % 3 === 0 ? rgb('#2e3a46') : rgb('#3a4a5a')), 14, [0, 0.5, 0.86]);
      for (let xx = X - 28; xx < X + Wd + 30; xx += 24) rect(bx(xx), by(base + 3), 4, by(base + 15) - by(base + 3), rgb('#4a3422'), facadeH(base + 15), SOUTH);
    }
    if (b.type === 'property' && !b.owned) { rect(bx(X + Wd + 4), by(base - 2), 3, 20, rgb('#5a3e26'), facadeH(base + 8), SOUTH); rect(bx(X + Wd), by(base - 8), 20, 12, (x, y) => (y === by(base - 8) ? rgb('#c8b888') : rgb('#e0d0a0')), 10, SOUTH); }
  }
  // beşik çatı: kaydırmalı kiremit sıraları, ton farkı, mahya, saçak gölgesi, yosun
  function* roofGable(X, Y, Wd, wy, FW, roof, id, h, snowy, chimney, step) {
    const ry0 = Y - 8, xr0 = bx(X - 2), xr1 = bx(X + Wd + 2), yr0 = by(ry0), yr1 = by(wy), ym = (yr0 + yr1) / 2;
    for (let y = yr0; y < yr1; y++) {
      const north = y < ym, nn = north ? [0, -0.5, 0.87] : [0, 0.5, 0.87], ht = FW + 10 * (1 - Math.abs((y - ym) / ((yr1 - yr0) / 2)));
      for (let x = xr0; x < xr1; x++) {
        const row = Math.floor((y - yr0) / 4), off = (row % 2) * 4, col = Math.floor((x - xr0 + off) / 8), v = (y - yr0) % 4, u = (x - xr0 + off) % 8;
        let c = sh(roof, north ? 0.06 : -0.06);
        c = sh(c, (hs(col, row, id) - 0.5) * 0.16);
        if (v === 3) c = sh(c, -0.28); else if (v === 0) c = sh(c, 0.08);
        if (u === 0 && v < 3) c = sh(c, -0.16);
        if (Math.abs(y - ym) < 2) c = sh(roof, 0.28);
        if (y >= yr1 - 2) c = sh(roof, -0.45);
        if (x < xr0 + 2 || x >= xr1 - 2) c = sh(c, -0.22);
        if (snowy && y < yr1 - 3 && hs(x >> 2, y >> 1, 3) > 0.12) c = sh(SNOW, (hs(x, y, 4) - 0.5) * 0.06);
        else if (hs(x >> 1, y >> 1, id + 3) > 0.985) c = mix(c, rgb('#6a7a48'), 0.4);
        put(x, y, c, ht, nn, 0);
      }
      yield* step();
    }
    if (chimney && h > 0.3) {
      const cx = bx(X + Wd * (0.2 + h * 0.5)), cy = by(ry0 + 2);
      rect(cx, cy, 10, 18, (x, y) => { const v = y - cy; if (v < 3) return rgb('#2a2220'); return ((v >> 1) % 2 && (x - cx) % 4 === 0) || (v % 3 === 0) ? rgb('#4a3430') : rgb('#7a4a3e'); }, FW + 18, [0, 0.3, 0.95]);
    }
  }
  // zengin şehrin binaları: tuğla ya da kesme taş, iki kat, kornişler, beyaz çerçeveli pencereler, tente, düz çatı
  function* modern(b, W, step) {
    const d = b.def, X = b.x * TS, Y = b.y * TS, Wd = b.w * TS, Hd = b.h * TS, base = Y + Hd, id = b.id, h = hash2(b.x, b.y, 5);
    const FW = d.tall ? 40 : 32, wy = base - FW, mid = wy + FW - 19;
    const pal = MODERN_WALLS[Math.floor(hash2(b.x, b.y, 7) * MODERN_WALLS.length)], wall = rgb(MODERN_TYPE_WALL[b.type] || pal.c), brick = MODERN_TYPE_WALL[b.type] ? false : pal.brick;
    const snowy = W.season === 3 && W.snowyTile(b.x + (b.w >> 1), b.y + (b.h >> 1)), xL = bx(X), xR = bx(X + Wd), yTop = by(wy), yBase = by(base), trim = rgb('#e4dccb');
    TG.base = base;
    yield* bands(xL, yTop, xR - xL, yBase - yTop, (x, y) => {
      const u = (x - xL) / S, v = (y - yTop) / S;
      let c = sh(wall, (hs(Math.floor(u / (brick ? 3 : 5)) + (Math.floor(v / (brick ? 1.5 : 2.5)) % 2) * 7, Math.floor(v / (brick ? 1.5 : 2.5)), id) - 0.5) * 0.12);
      if (brick) { const row = Math.floor(v / 1.5), uu = u + (row % 2) * 1.5; if (v % 1.5 < 0.5 || uu % 3 < 0.5) c = sh(wall, -0.24); }
      else { const row = Math.floor(v / 2.5), uu = u + (row % 2) * 2.5; if (v % 2.5 < 0.5 || uu % 5 < 0.5) c = sh(wall, -0.14); }
      const wyy = wyOf(y);
      if ((wyy >= mid && wyy < mid + 2) || wyy < wy + 3) c = wyy < wy + 1 || (wyy >= mid && wyy < mid + 0.6) ? sh(trim, 0.1) : trim;
      if (wyy >= mid + 2 && wyy < mid + 3) c = sh(wall, -0.35);
      if (wyy >= base - 3) c = rgb('#6a645c');
      return c;
    }, facadeH(base), SOUTH, step);
    // kapı: çift kanat, camlı tepe penceresi
    const dx = b.door.x;
    rect(bx(dx - 6), by(base - 17), 24, by(base) - by(base - 17), (x, y) => {
      const u = (x - bx(dx - 6)) / S, v = (y - by(base - 17)) / S;
      if (u < 1 || u > 11 || v < 2) return trim;
      if (v < 4.5) return mix(rgb('#9ac0d8'), rgb('#4a6a80'), (v - 2) / 2.5);
      if (Math.abs(u - 6) < 0.5) return rgb('#1a120c');
      return (u < 2 || u > 10 || (v > 6 && v < 7)) ? rgb('#3a2414') : (v > 9.5 && v < 10.5 && Math.abs(u - 6) < 1.4) ? rgb('#d8b850') : rgb('#4a2e1c');
    }, facadeH(base), SOUTH);
    yield* step();
    // pencereler: üstte kemerli dar, altta vitrin
    const shop = MODERN_SHOP.has(b.type), nWin = Math.max(2, Math.floor(b.w / 2.5)), lit = hs(id, 7, 3) > 0.25 || b.type === 'hotel';
    for (let k = 0; k < nWin; k++) {
      const cx = X + (k + 0.5) * Wd / nWin;
      const x0 = bx(cx - 3.5), y0 = by(wy + 5), w = 14, hh = 22;
      rect(x0, y0, w, hh, (x, y) => { const u = x - x0, v = y - y0; const arch = v < 4 && Math.hypot(u - 6.5, 4 - v) > 6.8; if (arch) return null; if (u < 2 || u > 11 || v > 19) return trim; if (u === 6 || u === 7) return trim; const sky = mix(rgb('#9ab8cc'), rgb('#26384a'), Math.min(1, v / 12 + u * 0.03)); return (u + v) % 6 === 0 && v < 10 ? sh(sky, 0.3) : sky; }, facadeH(base), SOUTH, (x, y) => { const u = x - x0, v = y - y0; return lit && u >= 2 && u <= 11 && v <= 19 && u !== 6 && u !== 7 && !(v < 4 && Math.hypot(u - 6.5, 4 - v) > 6.8) ? E_WIN : 0; });
      if (Math.abs(cx - dx) < 11) continue;
      if (shop) {
        const sx0 = bx(cx - 6), sy0 = by(base - 15), sw = 24, shh = 22;
        rect(sx0, sy0, sw, shh, (x, y) => { const u = x - sx0, v = y - sy0; if (u < 2 || u > 21 || v < 2 || v > 19) return trim; if (u === 11 || u === 12) return trim; if (v > 13 && v < 18 && (u % 6 === 3 || u % 6 === 4)) return rgb(['#c8a040', '#a0402a', '#d8d0c0'][(k + (u / 6 | 0)) % 3]); const sky = mix(rgb('#a8c4d4'), rgb('#2a3e52'), Math.min(1, v / 14 + u * 0.02)); return (u - v) % 7 === 0 && v < 10 ? sh(sky, 0.3) : sky; }, facadeH(base), SOUTH, (x, y) => { const u = x - sx0, v = y - sy0; return lit && u >= 2 && u <= 21 && v >= 2 && v <= 13 && u !== 11 && u !== 12 ? E_WIN : 0; });
      } else windowGlass(bx(cx - 3.5), by(base - 15), 14, 20, id, k + 10, trim, lit);
      yield* step();
    }
    yield* step();
    // tente ya da saçak
    if (shop) {
      const ac = rgb(MODERN_AWN[Math.floor(h * MODERN_AWN.length)]), ay = base - 18, y0 = by(ay);
      rect(bx(X - 1), y0, bx(X + Wd + 1) - bx(X - 1), 14, (x, y) => { const k = Math.floor((x - bx(X - 1)) / 8), v = y - y0, u = (x - bx(X - 1)) % 8; const c = snowy && v < 4 ? SNOW : k % 2 ? rgb('#efe8da') : ac; if (v >= 10) return Math.hypot(u - 3.5, v - 10) < 4 ? sh(c, -0.1) : null; return v === 9 ? sh(c, -0.3) : sh(c, v < 2 ? 0.12 : 0); }, 22, [0, 0.55, 0.83]);
    } else rect(bx(X - 1), by(base - 3), bx(X + Wd + 1) - bx(X - 1), 6, rgb('#5a5650'), 14, [0, 0.5, 0.86]);
    // düz çatı: katran kaplama, açık renk korkuluk, tuğla baca
    const ry0 = Y - 8, xr0 = bx(X - 2), xr1 = bx(X + Wd + 2), yr0 = by(ry0), yr1 = yTop;
    yield* step();
    yield* bands(xr0, yr0, xr1 - xr0, yr1 - yr0, (x, y) => {
      const u = (x - xr0) / S, v = (y - yr0) / S, e = Math.min(u, v, (xr1 - x) / S, (yr1 - y) / S);
      if (e < 2.5) return e < 0.6 ? rgb('#e8e0d0') : rgb('#d4ccbb');
      if (snowy) return sh(SNOW, (hs(x >> 1, y >> 1, 2) - 0.5) * 0.05);
      let c = sh(rgb('#4e5058'), (hs(Math.floor(u / 2), Math.floor(v / 2), id) - 0.5) * 0.08);
      if (v % 6 < 0.5) c = sh(c, -0.18);
      return c;
    }, (x, y) => { const e = Math.min((x - xr0) / S, (y - yr0) / S, (xr1 - x) / S, (yr1 - y) / S); return e < 2.5 ? FW + 3 : FW; }, UP, step);
    const chx = bx(X + Wd * (0.18 + h * 0.6));
    rect(chx, by(ry0 + 3), 14, 22, (x, y) => (y - by(ry0 + 3)) < 4 ? rgb('#3a2420') : (((y >> 1) + ((x >> 2) % 2)) % 2 ? rgb('#7a3e2e') : rgb('#6a3426')), FW + 12, [0, 0.3, 0.95]);
    if (d.tall) rect(bx(X + Wd / 2 - 10), by(ry0 - 6), 40, 14, (x, y) => (y - by(ry0 - 6) < 3 || y - by(ry0 - 6) > 11) ? trim : rgb('#4e5058'), FW + 6, SOUTH);
    // tabela: kapının üstünde koyu levha
    const txt = b.type === 'property' ? (b.owned ? 'HOME' : 'FOR SALE') : SIGN_TEXT[b.type];
    if (txt) { const sw = Math.min(Wd - 6, txt.length * 4.6 + 8); signText(txt, bx(X + Wd / 2 - sw / 2), by(mid - 9), Math.round(sw * S), 16, rgb('#1e2a24'), rgb('#ead490'), base); }
  }
  /* Bina örtüsü (cephe, çatı, tabela): büyük bir bina 15-60 ms sürer. Görüş alanına yaklaşan binanınki kare bütçesinden
     adım adım önceden pişer (coverJobs); pişmemişken görünürse kalanı hemen bitirilir. */
  const coverJobs = new Map();
  function* coverGen(b, W) {
    const X = b.x * TS, Y = b.y * TS, Wd = b.w * TS, Hd = b.h * TS, gen = W._hyGen;
    const ox = X - 44, oy = Y - 64, w = (Wd + 88) * S, h = (Hd + 84) * S;
    const tc = new Uint8ClampedArray(w * h * 4), tg = new Uint8ClampedArray(w * h * 4);
    const T = { c: tc, g: tg, w, h, ox, oy, o: null }, step = pacer(T);
    TG = T; LAYER = 0;
    const d = b.def, special = b.type === 'mineentrance' || b.type === 'lighthouse' || b.type === 'market' || d.ruin || b.stage !== undefined && b.stage < 1;
    if (special) {
      // seyrek yapılar: 2D çizimi keskinleştirilir (cephe dikey, üst kısım çatı)
      const base = Y + Hd, hF = (x, y) => Math.max(0, Math.min(40, base - wyOf(y)));
      yield* stampSteps((g) => Spr.building(g, g, b, W), ox, oy, w / S, h / S, hF, (x, y) => (wyOf(y) < base - (d.tall ? 30 : 22) ? [0, 0.4, 0.9] : SOUTH), null, step);
    } else if (b.modern && !MODERN_SKIP.has(b.type)) yield* modern(b, W, step);
    else yield* western(b, W, step);
    yield* step(true);
    TG = null;
    const mk = (arr) => { const cv = makeCanvas(w, h); cv.getContext('2d').putImageData(new ImageData(arr, w, h), 0, 0); return cv; };
    return { c: mk(tc), g: mk(tg), x: ox, y: oy, gen };
  }
  function cover(b, W) {
    if (b._hy && b._hy.gen === W._hyGen) return b._hy;
    const j = coverJobs.get(b) || { gen: coverGen(b, W), spent: 0 }; coverJobs.delete(b);
    const t0 = performance.now();
    let r; do { r = j.gen.next(); } while (!r.done);
    TG = null; learn('cover', j.spent + performance.now() - t0);
    return (b._hy = r.value);
  }

  /* ---------------- iç mekân (parçaya pişer) ---------------- */
  const FLOOR = { saloon: '#5e4028', church: '#9a7a52', doctor: '#a08a6a', sheriff: '#6e5a40', station: '#6a5a44', bank: '#8a7a64', hotel: '#6e4a32', stable: '#8a7250', barn: '#8a7250', lumber: '#8a6a44', docks: '#6a6258' };
  const WALLP = { saloon: '#6a2a24', hotel: '#4e5e40', bank: '#2e4234', church: '#e8e0d0', doctor: '#d8d0c0', sheriff: '#8a7a60', station: '#6a5e4a', barber: '#b8a890', tailor: '#7a6078', land: '#8a7a5a' };
  const RUG = { hotel: '#7a2a2a', sheriff: '#5a3a2a', bank: '#2a4a3a', land: '#4a3a5a', doctor: '#3a5a6a', property: '#7a4a2a', house: '#6a3a2a', saloon: '#4a2418', ranch: '#6a4a2a' };
  // adım adım: büyük bir saloonun döşemesi tek seferde ~20 ms sürer
  function* interiorBase(b, tg, step) {
    const X = b.x * TS, Y = b.y * TS, Wd = b.w * TS, Hd = b.h * TS, t = b.type, id = b.id;
    const fl = rgb(FLOOR[t] || '#7a5a3a'), x0 = bx(X), y0 = by(Y), x1 = bx(X + Wd), y1 = by(Y + Hd), dxs = bx(b.door.x);
    LAYER = 0;
    const floor = t === 'stable' || t === 'barn' ? (x, y) => { const r = hs(x >> 1, y, id); return r > 0.8 ? rgb('#c8a860') : r > 0.6 ? rgb('#a88a50') : sh(fl, (hs(x >> 2, y >> 2, 3) - 0.5) * 0.1); }
      : t === 'bank' ? (x, y) => { const u = (wxOf(x) - X), v = (wyOf(y) - Y); const c = ((Math.floor(u / 8) + Math.floor(v / 8)) % 2) ? rgb('#c8b89a') : fl; return (u % 8 < 0.5 || v % 8 < 0.5) ? sh(c, -0.25) : sh(c, (hs(Math.floor(u / 8), Math.floor(v / 8), 2) - 0.5) * 0.08); }
      // döşeme: yatay tahtalar, kaydırmalı ekler, damar, çivi, kapı önünde aşınma
      : (x, y) => {
        const wx = wxOf(x), wy = wyOf(y), row = Math.floor((wy - Y) / 5), v = (wy - Y) - row * 5;
        const off = (row * 11) % 23, seg = Math.floor((wx - X + off) / 23), u = (wx - X + off) - seg * 23;
        let c = sh(fl, (hs(row, seg, id) - 0.5) * 0.2);
        if (v < 0.5) c = sh(fl, -0.4); else if (u < 0.5) c = sh(fl, -0.32);
        else { const gr = Math.sin((wx * 0.9 + hs(row, seg, 3) * 40) * 0.7 + v * 0.3); if (gr > 0.85) c = sh(c, -0.08); else if (gr < -0.9) c = sh(c, 0.06); }
        if (Math.abs(u - 1.5) < 0.4 && Math.abs(v - 2.5) < 0.4) c = sh(c, -0.45);
        const dd = Math.hypot(wx - b.door.x, (wy - Y - Hd) * 1.6); if (dd < 22) c = sh(c, 0.1 * (1 - dd / 22));
        return c;
      };
    // döşeme şerit şerit; hedefin dışındaki şeritler atlanır
    for (let y = Math.max(y0, 0); y < Math.min(y1, tg.h); y += 16) { rect(x0, y, x1 - x0, Math.min(16, y1 - y), floor, 0, UP); yield* step(); }
    const rug = RUG[t];
    if (rug) {
      const rw = Math.min(Wd - 40, 64), rh = Math.min(Hd - 40, 34), rx = X + Wd / 2 - rw / 2 + (t === 'saloon' ? 20 : 0), ry = Y + Hd / 2 - rh / 2 + 6, rc = rgb(rug);
      rect(bx(rx), by(ry), Math.round(rw * S), Math.round(rh * S), (x, y) => {
        const u = (x - bx(rx)) / S, v = (y - by(ry)) / S, e = Math.min(u, v, rw - u, rh - v);
        if (e < 1) return sh(rc, -0.25);
        if (e < 3.2 && e > 2.2) return sh(rc, 0.45);
        if (e < 5 && ((Math.floor(u) + Math.floor(v)) % 3 === 0)) return sh(rc, 0.25);
        const dm = Math.abs(((u - rw / 2) % 8 + 8) % 8 - 4) + Math.abs(((v - rh / 2) % 8 + 8) % 8 - 4);
        return dm < 1.2 ? sh(rc, 0.3) : dm < 2 ? sh(rc, -0.12) : rc;
      }, 0.3, UP);
      for (let x = bx(rx); x < bx(rx + rw); x += 2) { put(x, by(ry) - 1, sh(rc, 0.4), 0.2, UP, 0); put(x, by(ry + rh), sh(rc, 0.4), 0.2, UP, 0); }
      yield* step();
    }
    if (t === 'church') rect(bx(X + Wd / 2 - 6), by(Y + 26), 24, by(Y + Hd - 4) - by(Y + 26), (x) => (x === bx(X + Wd / 2 - 6) || x === bx(X + Wd / 2 + 6) - 1) ? rgb('#c8a040') : sh(rgb('#8a2020'), (hs(x >> 1, 0, 2) - 0.5) * 0.08), 0.3, UP);
    // arka duvar: desenli kâğıt, lambri, kiriş
    const wp = rgb(WALLP[t] || hex(sh(rgb(b.def.wall), -0.05)));
    rect(x0, y0, x1 - x0, by(Y + 16) - y0, (x, y) => {
      const u = wxOf(x) - X, v = wyOf(y) - Y;
      if (v < 2) return rgb('#1e140c');
      if (v >= 11) { const q = u % 12; let c = sh(wp, -0.3); if (q < 0.6 || v < 11.6 || v > 15.4) c = sh(wp, -0.48); else if (q > 2 && q < 10 && v > 12.4 && v < 14.6) c = sh(wp, -0.22); return c; }
      const dm = Math.abs(((u % 6) + 6) % 6 - 3) + Math.abs(((v - 2) % 6 + 6) % 6 - 3);
      let c = wp; if (dm < 0.9) c = sh(wp, t === 'church' || t === 'doctor' ? -0.1 : 0.22); else if (Math.abs(dm - 2.4) < 0.3) c = sh(wp, -0.12);
      if (v > 10 && v < 11) c = sh(wp, -0.4);
      return c;
    }, facadeH(Y + 16), SOUTH);
    yield* step();
    stamp((g) => Spr.wallDecor(g, b, X, Y, Wd), X, Y, Wd, 16, facadeH(Y + 16), SOUTH, (c) => !(Math.abs(c[0] - wp[0]) < 0.06 && Math.abs(c[1] - wp[1]) < 0.06 && Math.abs(c[2] - wp[2]) < 0.06));
    yield* step();
    // yan ve ön duvarların tepesi (kesit), kapı eşiği, pencere camları
    const wd = rgb('#3a2818');
    const wallTop = (x, y) => { const wx = wxOf(x), wy = wyOf(y); const inner = (wx > X + 4 && wx < X + 5) || (wx > X + Wd - 5 && wx < X + Wd - 4) || (wy > Y + Hd - 4 && wy < Y + Hd - 3); return inner ? sh(wd, 0.35) : (Math.floor(wy / 3) % 2 ? wd : sh(wd, -0.12)); };
    rect(x0, y0, bx(X + 5) - x0, y1 - y0, wallTop, 20, UP);
    rect(bx(X + Wd - 5), y0, x1 - bx(X + Wd - 5), y1 - y0, wallTop, 20, UP);
    rect(x0, by(Y + Hd - 4), dxs - 16 - x0, y1 - by(Y + Hd - 4), wallTop, 20, UP);
    rect(dxs + 16, by(Y + Hd - 4), x1 - dxs - 16, y1 - by(Y + Hd - 4), wallTop, 20, UP);
    rect(dxs - 16, by(Y + Hd - 3), 32, by(Y + Hd) - by(Y + Hd - 3), (x) => ((x >> 1) % 4 === 0 ? rgb('#6a4a2c') : rgb('#8a6a44')), 0.5, UP);
    const nWin = Math.max(1, Math.floor(b.w / 3));
    for (let k = 0; k < nWin; k++) { const cx = X + (k + 0.5) * Wd / nWin; if (Math.abs(cx - b.door.x) < 14) continue; rect(bx(cx - 5), by(Y + Hd - 4), 20, by(Y + Hd - 1) - by(Y + Hd - 4), (x, y) => (y === by(Y + Hd - 4) ? rgb('#c8e0f0') : rgb('#7a9ab0')), 8, UP); }
    if (b.h >= 6) for (const sx of [X + 1, X + Wd - 4]) rect(bx(sx), by(Y + Hd / 2 - 4), 6, 16, rgb('#8ab0c8'), 8, UP);
  }
  function furniture(o, cx, cy, i, b, W) {
    const h = hash2(cx >> 4, cy >> 4, 17), same = (dd) => W.obj[i + dd] === o;
    const top = (x0, y0, w, hh, c, ht, em) => rect(bx(x0), by(y0), Math.round(w * S), by(y0 + hh) - by(y0), c, ht, UP, em || 0);
    const front = (x0, y0, w, hh, c, base, em) => rect(bx(x0), by(y0), Math.round(w * S), by(y0 + hh) - by(y0), c, facadeH(base), SOUTH, em || 0);
    const wood = (base, x, y, k = 4) => sh(rgb(base), ((hs(Math.floor(x / k), Math.floor(y / 9), 5) - 0.5) * 0.16) + (Math.sin(x * 0.9 + y * 0.05) > 0.9 ? -0.08 : 0));
    LAYER = 0;
    switch (o) {
      case O.BAR: case O.COUNTER: case O.TICKET: {
        const tc = o === O.BAR ? '#5a3220' : o === O.TICKET ? '#6a5236' : b.type === 'bank' ? '#5a3a22' : '#9a7048', dark = hex(sh(rgb(tc), -0.28)), edge = sh(rgb(tc), -0.45);
        front(cx - 8, cy + 1, 16, 7, (x, y) => { const u = (x - bx(cx - 8)) / S; const c = wood(dark, x, y); return (u % 8 < 0.7) ? sh(c, -0.35) : (o === O.BAR && y >= by(cy + 5) && y < by(cy + 6)) ? rgb('#d8b048') : c; }, cy + 8);
        top(cx - 8, cy - 5, 16, 6, (x, y) => { const c = wood(tc, x, y, 8); return y < by(cy - 4.5) ? sh(c, 0.3) : c; }, 10);
        if (!same(-1)) front(cx - 8, cy - 5, 1.5, 13, edge, cy + 8);
        if (!same(1)) front(cx + 6.5, cy - 5, 1.5, 13, edge, cy + 8);
        if (o === O.BAR) {
          if (h < 0.5) top(cx - 3 + h * 6, cy - 3.5, 2, 2.5, (x, y) => (x + y) % 3 ? rgb('#d8e4ea') : rgb('#a8bcc8'), 11);
          if (h > 0.6) front(cx + 2, cy - 7, 2, 5, (x, y) => y < by(cy - 6) ? rgb('#c8a040') : rgb('#5a2a14'), cy - 2);
          if (h > 0.3 && h < 0.45) top(cx - 6, cy - 3, 3, 2, rgb('#e0c060'), 11);
        } else if (b.type === 'bank' || o === O.TICKET) { for (let x = cx - 7; x < cx + 8; x += 3) front(x, cy - 12, 0.8, 8, rgb('#c8b060'), cy - 4); front(cx - 8, cy - 12, 16, 1, rgb('#c8b060'), cy - 4); }
        else if (h < 0.3) top(cx - 3, cy - 4, 5, 4, rgb('#c8b890'), 12);
        return;
      }
      case O.TABLE: case O.CARDTABLE: {
        const chair = (x, flip) => { top(x - 2.5, cy - 1, 5, 4, (xx, yy) => wood('#6a4428', xx, yy), 5); front(x - 2.5, cy + 3, 5, 2, rgb('#3a2416'), cy + 5); front(x - 2.5 + (flip ? 4 : 0), cy - 5, 1, 4, rgb('#4a2e1a'), cy - 1); };
        chair(cx - 11, false); chair(cx + 11, true);
        const RS = 13;
        for (let yy = -RS; yy <= RS; yy++) for (let xx = -RS; xx <= RS; xx++) {
          const dd = Math.hypot(xx, yy) / RS; if (dd > 1) continue;
          let c;
          if (o === O.CARDTABLE) c = dd > 0.86 ? rgb('#4a2e1a') : sh(rgb('#2e6a3a'), (hs(xx, yy, 4) - 0.5) * 0.08);
          else { c = dd > 0.88 ? rgb('#4a2e1a') : wood('#7a5232', xx + 100, yy + 100, 3); if (dd > 0.8 && dd <= 0.88) c = sh(c, 0.18); }
          put(bx(cx) + xx, by(cy - 1) + yy, c, 8, UP, 0);
        }
        for (let yy = 0; yy < 4; yy++) for (let xx = -12; xx <= 12; xx++) put(bx(cx) + xx, by(cy - 1) + Math.round(RS * Math.sqrt(1 - (xx / RS) ** 2)) + yy, rgb('#2e1c10'), 7, SOUTH, 0);
        if (o === O.CARDTABLE) { for (const [qx, qy] of [[-3, -2], [1, -1], [-1, 2]]) top(cx + qx, cy - 1 + qy, 2, 2.6, (xx, yy) => (yy === by(cy - 1 + qy)) ? rgb('#c83030') : rgb('#f4f0e4'), 8.3); top(cx + 3, cy - 4, 1.6, 1.6, rgb('#c83030'), 8.4); top(cx - 4.6, cy, 1.6, 1.6, rgb('#3050c0'), 8.4); }
        else { if (h < 0.6) top(cx - 2.5, cy - 3, 2, 2.6, (xx, yy) => yy < by(cy - 2.4) ? rgb('#f4f0e4') : rgb('#d8a840'), 9.5); if (h > 0.4) top(cx + 1.5, cy - 4, 1.6, 3.6, rgb('#4a2a14'), 11); }
        // masada gaz lambası: gece yanar
        if (hs(cx, cy, 9) > 0.45) top(cx - 0.8, cy - 1.8, 1.6, 1.6, rgb('#f8e8b0'), 12, E_WIN);
        return;
      }
      case O.PIANO: {
        top(cx - 8, cy - 7, 16, 6, (x, y) => { const c = wood('#2e1c12', x, y, 16); return y < by(cy - 6.4) ? sh(c, 0.35) : c; }, 16);
        front(cx - 8, cy - 1, 16, 2, rgb('#1e120c'), cy + 1);
        top(cx - 7, cy + 1, 14, 3, (x) => ((x - bx(cx - 7)) % 4 === 0 ? rgb('#1a1a1a') : rgb('#f2eee2')), 9);
        front(cx - 8, cy + 4, 16, 3, rgb('#2a1a12'), cy + 7);
        top(cx + 4, cy - 10, 1.5, 3, rgb('#f0d880'), 18, E_WIN);
        return;
      }
      case O.STOVE: {
        top(cx - 5, cy - 5, 10, 4, (x, y) => (x + y) % 5 === 0 ? rgb('#4a4a50') : rgb('#2e2e34'), 10);
        front(cx - 5, cy - 1, 10, 6, (x, y) => { const v = (y - by(cy - 1)) / S; return v > 1.5 && v < 4 && Math.abs(x - bx(cx)) < 3 * S ? rgb('#ff8a30') : rgb('#1e1e22'); }, cy + 5, (x, y) => { const v = (y - by(cy - 1)) / S; return v > 1.5 && v < 4 && Math.abs(x - bx(cx)) < 3 * S ? E_FIRE : 0; });
        front(cx - 1.5, cy - 16, 3, 11, (x) => x === bx(cx - 1.5) ? rgb('#5a5a5e') : rgb('#34343a'), cy + 11);
        return;
      }
      case O.SHELF: {
        front(cx - 7, cy - 7, 14, 13, (x, y) => {
          const u = (x - bx(cx - 7)) / S, v = (y - by(cy - 7)) / S; if (u < 1 || u > 13 || v < 0.8) return rgb('#4a2e1a');
          const r = Math.floor((v - 0.8) / 4), rv = (v - 0.8) - r * 4; if (rv > 3.2) return rgb('#6a4428');
          const k = Math.floor((u - 1) / 3), cols = ['#c8402c', '#e0c060', '#4a7aa8', '#6a9a4a', '#d8d0c0', '#8a5a2a'];
          const hc = hs(i, r * 4 + k, 5); if (rv < (1 - hc) * 1.2) return rgb('#2a1a10');
          const c = rgb(cols[Math.floor(hc * cols.length)]); return (u - 1) % 3 > 2.2 ? rgb('#2a1a10') : ((u - 1) % 3 < 0.6 ? sh(c, 0.25) : c);
        }, cy + 6);
        return;
      }
    }
    stamp((g) => Spr.furn(g, o, cx, cy, W, i, b, h), cx - 16, cy - 16, 40, 32, (x, y) => Math.max(0, (by(cy + 6) - y) / S), SOUTH, (c) => c[0] + c[1] + c[2] > 0.05);
  }
  // iç mekân: döşeme, duvar, mobilya (büyük bir saloon tek adımda onlarca ms sürerdi)
  function* interior(b, W, tg) {
    const step = pacer(tg);
    TG = tg; yield* interiorBase(b, tg, step);
    for (let ly = 1; ly < b.h; ly++) {
      for (let lx = 0; lx < b.w; lx++) {
        const tx = b.x + lx, ty = b.y + ly, i = ty * WW + tx, o = W.obj[i]; if (!o) continue;
        const cx = tx * TS + 8, cy = ty * TS + 8;
        if (isFurnO(o)) furniture(o, cx, cy, i, b, W);
        else if (!object(o, cx, cy, hash2(tx, ty, 77), W, tx, ty)) objectFallback(o, cx, cy, hash2(tx, ty, 77), W);
        LAYER = 0;
        yield* step();
      }
    }
  }

  /* ---------------- parça pişirme ---------------- */
  function* bake(W, cx, cy) {
    const ox = cx * HC, oy = cy * HC, n = HB * HB * 4;
    const base = { c: new Uint8ClampedArray(n), g: new Uint8ClampedArray(n) }, over = { c: new Uint8ClampedArray(n), g: new Uint8ClampedArray(n) };
    yield* ground(W, ox, oy, base);
    // raylar ve yassı süsler (ot, çiçek, ekin, kemik...) 2D çizimle, iki kat ölçekte
    const cv = makeCanvas(HB, HB), gc = cv.getContext('2d', { willReadFrequently: true });
    gc.putImageData(new ImageData(base.c, HB, HB), 0, 0);
    let step = pacer(null);
    yield* step(true);
    // 2D çizim tuvalde birikir, asıl maliyet okumada ödenir: 1 piksellik okuma birikeni o adımda çizdirir
    const flushDraw = () => gc.getImageData(0, 0, 1, 1);
    gc.save(); gc.scale(S, S); gc.translate(-ox, -oy);
    for (const r of W.rails) W.drawRail(gc, r, ox - 128, oy - 128);
    flushDraw(); yield* step();
    const tx0 = (ox >> 4) - 3, ty0 = (oy >> 4) - 3, tx1 = ((ox + HC) >> 4) + 3, ty1 = ((oy + HC) >> 4) + 4;
    const tall = [];
    for (let ty = ty0; ty < ty1; ty++) {
      let drawn = false;
      for (let tx = tx0; tx < tx1; tx++) {
        if (!W.inb(tx, ty)) continue;
        const i = ty * WW + tx, o = W.obj[i];
        if (!o || isHerbO(o) || o === O.ARTIFACT || (W.flags[i] & 16)) continue;
        if (o === O.TUFT || o === O.FLOWERS || o === O.REED || o === O.CROP || o === O.DRYBUSH || o === O.BONES || o === O.CAMPFIRE || o === O.FLOWERBED || o === O.BIGBONES) { if (o !== O.TUFT) { Spr.object(gc, gc, o, tx * TS + 8, ty * TS + 8, hash2(tx, ty, 77), W); drawn = true; } else tall.push([ty, tx, o]); }
        else tall.push([ty, tx, o]);
      }
      if (drawn) flushDraw();
      yield* step();
    }
    gc.restore();
    yield* step(true);
    base.c.set(gc.getImageData(0, 0, HB, HB).data);
    yield* step(true);
    // çizim hedefi her adımda yeniden kurulur: araya eşzamanlı başka bir pişirme (görünür parça, bina örtüsü) girebilir
    const tg = { c: base.c, g: base.g, w: HB, h: HB, ox, oy, o: over };
    // iç mekânlar (döşeme, duvar, mobilya): içeri girince cephe kalkar, bunlar görünür
    for (const b of W.buildings) {
      if (!b.enter) continue;
      const X = b.x * TS, Y = b.y * TS;
      if (X + b.w * TS < ox || X > ox + HC || Y + b.h * TS < oy || Y > oy + HC) continue;
      tg.o = null; yield* interior(b, W, tg); tg.o = over;
      yield 0;
    }
    // nesneler: kuzeyden güneye
    tall.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    step = pacer(tg);
    for (const [ty, tx, o] of tall) {
      const x = tx * TS + 8, y = ty * TS + 8, hh = hash2(tx, ty, 77);
      TG = tg; LAYER = 0;
      if (!object(o, x, y, hh, W, tx, ty)) objectFallback(o, x, y, hh, W);
      yield* step();
    }
    LAYER = 0; TG = null;
    const mk = (arr) => { const c = makeCanvas(HB, HB); c.getContext('2d').putImageData(new ImageData(arr, HB, HB), 0, 0); return c; };
    const bc = mk(base.c); yield 0;
    const bg = mk(base.g); yield 0;
    // üst katman boşsa (ağaçsız, çatısız parça) tuval açılmaz: bellek yarıya iner
    let any = false; for (let i = 3; i < n; i += 4) if (over.c[i]) { any = true; break; }
    const oc = any ? mk(over.c) : null; if (any) yield 0;
    return { bc, bg, oc, og: any ? mk(over.g) : null, used: 0 };
  }
  const chunks = new Map(), jobs = new Map();
  let world = null;
  function chunk(W, cx, cy, sync) {
    const key = cy * 1024 + cx;
    let c = chunks.get(key);
    if (c) { c.used = performance.now(); return c; }
    let j = jobs.get(key);
    if (!sync) { if (!j) jobs.set(key, { gen: bake(W, cx, cy), spent: 0 }); return null; }
    if (!j) j = { gen: bake(W, cx, cy), spent: 0 };
    const t0 = performance.now();
    let r; do { r = j.gen.next(); } while (!r.done);
    jobs.delete(key); learn('chunk', j.spent + performance.now() - t0);
    return store(key, r.value);
  }
  function store(key, c) {
    c.used = performance.now(); chunks.set(key, c);
    if (chunks.size > 28) { let ok = -1, ot = Infinity; for (const [k, v] of chunks) if (v.used < ot) { ot = v.used; ok = k; } chunks.delete(ok); }
    return c;
  }
  /* Arka plan işleri (parça ve bina örtüsü pişirme). Ortalama süreleri biten işlerden ölçülür. */
  const cost = { chunk: 60, cover: 15 };
  const learn = (kind, ms) => { cost[kind] += (ms - cost[kind]) * 0.25; };
  // bekleyen işler, görünür olacakları sıraya göre: [görüş alanına uzaklık (piksel), tür, anahtar, iş]
  function queue(x0, y0, x1, y1) {
    const gap = (ax, ay, bx2, by2) => Math.max(0, ax - x1, x0 - bx2, ay - y1, y0 - by2), q = [];
    for (const [k, j] of jobs) { const cx = k % 1024, cy = (k - cx) / 1024; q.push([gap(cx * HC, cy * HC, (cx + 1) * HC, (cy + 1) * HC), 'chunk', k, j]); }
    for (const [b, j] of coverJobs) { const X = b.x * TS, Y = b.y * TS; q.push([gap(X - 50, Y - 80, X + b.w * TS + 50, Y + b.h * TS + 30), 'cover', b, j]); }
    return q.sort((a, b) => a[0] - b[0]);
  }
  /* Bütçe: kare aralığının küçük bir payı (base). Görüş alanına yaklaşan bir iş bu payla yetişmeyecekse (görününce tek
     seferde pişer, kare donar: yavaş cihazda dörtnala giderken), kalan işi görünür olana kadarki karelere yayılır;
     en çok bir kare süresi. */
  let camV = 0, camLX = null, camLY = null;
  function jobBudget(q, base, C, dt, fm) {
    if (camLX !== null && dt > 0) camV += (Math.min(2000, Math.hypot(C.x - camLX, C.y - camLY) / dt) - camV) * 0.2;
    camLX = C.x; camLY = C.y;
    const step = Math.max(0.25, camV * fm / 1000);   // kameranın kare başına ilerlediği piksel
    let need = 0, acc = 0;
    for (const [d, kind, , j] of q) { acc += Math.max(cost[kind] * 0.25, cost[kind] - j.spent); need = Math.max(need, acc / Math.max(1, d / step)); }
    return Math.max(base, Math.min(need, fm));
  }
  function runJobs(ms, q) {
    const t0 = performance.now();
    for (const [, kind, k, j] of q) {
      const map = kind === 'chunk' ? jobs : coverJobs;
      if (map.get(k) !== j) continue;   // bu arada eşzamanlı bitirildi
      while (true) {
        const ts = performance.now(), r = j.gen.next(); j.spent += performance.now() - ts;
        if (r.done) {
          map.delete(k); learn(kind, j.spent);
          if (kind === 'chunk') store(k, r.value); else { k._hy = r.value; TG = null; }
          break;
        }
        if (performance.now() - t0 > ms) return;
      }
      if (performance.now() - t0 > ms) return;
    }
  }
  function flush(W) {
    chunks.clear(); jobs.clear(); coverJobs.clear();
    if (W) { W._hyGen = (W._hyGen || 0) + 1; }
    SPR.clear();
  }

  /* ---------------- canlılar: şekil değerlendirici, önbellekli sprite ---------------- */
  // parça: { e: [cx, cy, rx, ry] elips | c: [x0, y0, x1, y1, r] kapsül, col, h, dome } (yerel: x ileri, y sağ)
  function sprite(parts, ang, outline = true) {
    let R = 0; for (const p of parts) { const q = p.e ? Math.hypot(p.e[0], p.e[1]) + Math.max(p.e[2], p.e[3]) : Math.max(Math.hypot(p.c[0], p.c[1]), Math.hypot(p.c[2], p.c[3])) + p.c[4]; R = Math.max(R, q); }
    const half = Math.ceil((R + 1.5) * S), size = half * 2, ca = Math.cos(ang), sa = Math.sin(ang);
    const cv = makeCanvas(size, size), g = cv.getContext('2d'), img = g.createImageData(size, size), d = img.data, mask = new Uint8Array(size * size);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const wx = (x + 0.5 - half) / S, wy = (y + 0.5 - half) / S, lx = wx * ca + wy * sa, ly = -wx * sa + wy * ca;
      let best = null, bh = -1, bn = null;
      for (const p of parts) {
        let dd, nx, ny;
        if (p.e) { const [ex, ey, rx, ry] = p.e; const ux = (lx - ex) / rx, uy = (ly - ey) / ry; dd = ux * ux + uy * uy; if (dd > 1) continue; nx = ux; ny = uy; }
        else { const [ax, ay, bx2, by2, r] = p.c; const vx = bx2 - ax, vy = by2 - ay, t = clamp01(((lx - ax) * vx + (ly - ay) * vy) / (vx * vx + vy * vy || 1)); const qx = lx - ax - vx * t, qy = ly - ay - vy * t; dd = (qx * qx + qy * qy) / (r * r); if (dd > 1) continue; nx = qx / r; ny = qy / r; }
        const hh = p.h - (p.dome || 0) * dd;
        if (hh > bh) { bh = hh; best = p; bn = [nx * ca - ny * sa, nx * sa + ny * ca, Math.sqrt(Math.max(0.05, 1 - Math.min(1, dd)))]; }
      }
      if (!best) continue;
      let c = typeof best.col === 'function' ? best.col(lx, ly) : best.col;
      // sabit üst-sol ışıkla hacim (dünya ışığı sonra GPU'da eklenir)
      const lit = -bn[0] * 0.35 - bn[1] * 0.45 + bn[2] * 0.25;
      c = sh(c, lit > 0.25 ? 0.1 : lit < -0.15 ? -0.16 : 0);
      const i = (y * size + x) * 4; d[i] = c[0] * 255; d[i + 1] = c[1] * 255; d[i + 2] = c[2] * 255; d[i + 3] = 255; mask[y * size + x] = 1;
    }
    if (outline) for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      if (mask[y * size + x]) continue;
      if ((x > 0 && mask[y * size + x - 1]) || (x < size - 1 && mask[y * size + x + 1]) || (y > 0 && mask[(y - 1) * size + x]) || (y < size - 1 && mask[(y + 1) * size + x])) { const i = (y * size + x) * 4; d[i] = 26; d[i + 1] = 18; d[i + 2] = 12; d[i + 3] = 150; }
    }
    g.putImageData(img, 0, 0);
    return { c: cv, h: half };
  }
  function humanParts(L, st) {
    const coat = rgb(L.coat), pants = rgb(L.pants), skin = rgb(L.skin), shirt = rgb(L.shirt), hair = rgb(L.hairNow || L.hair), boot = rgb('#231710');
    const mv = st.riding ? 0 : st.mv, sw = Math.sin(st.walk || 0) * 2.8 * mv, P = [];
    if (st.lying) {
      P.push({ e: [0, 0, 5.5, 3.2], col: coat, h: 4, dome: 2 }); P.push({ c: [-4, -1.4, -9, -1.4, 0.9], col: pants, h: 3 }); P.push({ c: [-4, 1.4, -9, 1.4, 0.9], col: pants, h: 3 });
      P.push({ e: [5.5, 0, 2.6, 2.6], col: L.hat === 'none' ? hair : skin, h: 5, dome: 1.5 });
      if (st.tied) { P.push({ e: [-7.6, 0, 0.6, 2.8], col: rgb('#c8a870'), h: 3.5 }); P.push({ e: [-0.6, 0, 0.6, 3.5], col: rgb('#c8a870'), h: 4.5 }); }
      return P;
    }
    if (!st.riding) { P.push({ e: [0.5 + sw, -2.2, 2.2, 1.3], col: (x) => x > 1.6 + sw ? boot : pants, h: 6, dome: 2 }); P.push({ e: [0.5 - sw, 2.2, 2.2, 1.3], col: (x) => x > 1.6 - sw ? boot : pants, h: 6, dome: 2 }); }
    if (L.coatLen) P.push({ e: [-2.2, 0, 2.6 + L.coatLen * 1.6, 4.6], col: sh(coat, -0.15), h: 14, dome: 3 });
    P.push({ e: [0, 0, 3.4, 5.3], col: (x, y) => (Math.abs(y) < 0.4 && x > 0) ? sh(coat, -0.25) : coat, h: 20, dome: 5 });
    P.push({ e: [1.9, 0, 1.3, 1.9], col: shirt, h: 20.5, dome: 1 });
    if (st.backGun) P.push({ c: [-4, -4, -1, 5, 0.7], col: rgb('#3a2618'), h: 21 });
    if (st.aim) {
      const lng = st.wk === 'long', bow = st.wk === 'bow';
      P.push({ c: [0, -4.2, lng ? 7 : 6.5, lng ? -0.5 : -0.2, 1.15], col: coat, h: 19, dome: 1 }); P.push({ c: [0, 4.2, lng ? 3 : 6.5, lng ? 1.5 : 0.3, 1.15], col: coat, h: 19, dome: 1 });
      P.push({ e: [lng ? 7.2 : 6.8, 0.1, 1.3, 1.3], col: skin, h: 19.5, dome: 0.5 });
      if (bow) P.push({ c: [8, -5.5, 8, 5.5, 0.6], col: rgb('#6a4a28'), h: 19.8 });
      else P.push({ c: [lng ? 4 : 7, 0, lng ? 15 : 12, 0, 0.75], col: rgb('#2a2a2e'), h: 19.8 });
    } else if (st.riding) {
      P.push({ e: [3.5, -3.3, 1.5, 1.5], col: coat, h: 18, dome: 1 }); P.push({ e: [3.5, 3.3, 1.5, 1.5], col: coat, h: 18, dome: 1 });
      P.push({ e: [5, -2.5, 1.1, 1.1], col: skin, h: 18.4 }); P.push({ e: [5, 2.5, 1.1, 1.1], col: skin, h: 18.4 });
    } else {
      const swg = st.swing || 0;
      P.push({ e: [-sw * 0.7, -4.9, 1.8, 1.7], col: coat, h: 17, dome: 2 }); P.push({ e: [sw * 0.7 + swg * 4, 4.9 - swg * 2, 1.8, 1.7], col: coat, h: 17, dome: 2 });
      P.push({ e: [-sw * 0.7 + 1.2, -5.1, 1, 1], col: skin, h: 17.2, dome: 1 }); P.push({ e: [sw * 0.7 + 1.2 + swg * 4, 5.1 - swg * 2, 1, 1], col: skin, h: 17.2, dome: 1 });
      if (st.hasGun) P.push({ e: [-0.5, 4.4, 1.5, 0.8], col: rgb('#2a1c14'), h: 20.6 });
      if (st.hold === 'crate') P.push({ e: [5.5, 0, 2.8, 3.6], col: rgb('#9a6e40'), h: 21 });
    }
    if (L.mask === 'sack') P.push({ e: [0, 0, 3.2, 3.2], col: rgb('#c8a870'), h: 27, dome: 2 });
    else if (L.hat && L.hat !== 'none') {
      const Sx = LOOKS.hatShape[L.hat] || LOOKS.hatShape.cowboy, hc = rgb(hatColor(L.hat, L.hatCol));
      if (L.hat === 'bonnet') { P.push({ e: [-0.8, 0, 3.6, 3.3], col: hc, h: 27, dome: 2 }); P.push({ e: [1.4, 0, 1.3, 2.9], col: sh(hc, 0.18), h: 27.5 }); }
      else {
        P.push({ e: [0.2, 0, Sx.br, Sx.br * 0.95], col: (x, y) => Math.hypot(x - 0.2, y) > Sx.br - 0.6 ? sh(hc, -0.22) : hc, h: 26, dome: 0.6 });
        P.push({ e: [-0.2, 0, 2.6, 2.4], col: (x, y) => Math.abs(Math.hypot(x + 0.2, y) - 2.2) < 0.35 ? rgb('#2a1a10') : (L.hat === 'cowboy' || L.hat === 'wide' || L.hat === 'straw') && Math.abs(y) < 0.45 ? sh(hc, 0.22) : sh(hc, -0.12), h: L.hat === 'top' ? 31 : 29, dome: 2.5 });
      }
    } else {
      P.push({ e: [1.9, 0, 1.3, 1.9], col: L.mask === 'bandana' ? rgb('#a8281f') : skin, h: 25, dome: 1 });
      P.push({ e: [-0.3, 0, 2.9, 2.9], col: (x, y) => ((Math.floor((x + y * 0.4) * 2.5) % 2) ? sh(hair, 0.12) : hair), h: 27, dome: 2.5 });
    }
    return P;
  }
  function horseParts(L, st) {
    const c = rgb(L.col), mane = rgb(L.mane || '#1a1410'), lc = sh(c, -0.35), p = st.phase || 0, m = st.mv, P = [];
    if (st.dead) { P.push({ e: [0, 0, 10, 5], col: c, h: 6, dome: 3 }); P.push({ e: [11, 2, 4, 2], col: c, h: 5 }); for (let k = 0; k < 4; k++) P.push({ c: [-6 + k * 4, 4, -6 + k * 4, 9, 0.8], col: lc, h: 3 }); return P; }
    for (const [lx, ly, ph] of [[6, -3.4, 0], [6, 3.4, Math.PI], [-6, -3.4, Math.PI * 0.6], [-6, 3.4, Math.PI * 1.6]]) P.push({ e: [lx + Math.sin(p + ph) * 3.2 * m, ly, 2, 1.3], col: lc, h: 5, dome: 2 });
    P.push({ c: [-9.5, 0, -15, Math.sin(p) * 1.5 * m, 1.3], col: mane, h: 12, dome: 1 });
    P.push({ e: [0, 0, 10.5, 4.6], col: (x, y) => y < -1.8 ? sh(c, 0.12) : c, h: 16, dome: 4 });
    const nk = st.graze ? 2 : 0;
    P.push({ e: [8.6, 0, 4.2, 2.7], col: c, h: 17, dome: 2 });
    P.push({ e: [12.8 + nk, 0, 3.6, 2], col: c, h: 16.5 - nk * 3, dome: 1.5 });
    P.push({ e: [15.4 + nk, 0, 1.6, 1.6], col: sh(c, -0.25), h: 16 - nk * 3, dome: 1 });
    if (L.blaze) P.push({ c: [12 + nk, 0, 16 + nk, 0, 0.5], col: rgb('#f0ece4'), h: 16.8 - nk * 3 });
    P.push({ c: [4.5, 0, 11, 0, 0.9], col: mane, h: 17.5, dome: 0.5 });
    P.push({ e: [10.3, -1.6, 0.8, 0.6], col: sh(c, -0.2), h: 18 }); P.push({ e: [10.3, 1.6, 0.8, 0.6], col: sh(c, -0.2), h: 18 });
    if (st.saddle) {
      P.push({ e: [-0.5, 0, 4.6, 4.8], col: rgb(L.blanket || '#8a2a20'), h: 17, dome: 0.5 }); P.push({ e: [-0.5, 0, 3.6, 3.6], col: (x, y) => Math.hypot(x + 0.5, y) > 3 ? rgb('#3a2412') : rgb('#6a4424'), h: 18.5, dome: 1 });
      if (st.bags) { P.push({ e: [-5.5, -4.6, 1.6, 1.2], col: rgb('#6a4424'), h: 17.5 }); P.push({ e: [-5.5, 4.6, 1.6, 1.2], col: rgb('#6a4424'), h: 17.5 }); }
    }
    return P;
  }
  function animalParts(a) {
    const d = a.def, c = rgb(a.skinned ? '#9a3a2a' : d.col), c2 = rgb(d.col2 || d.col), Ln = d.len, Wd = d.wid, p = a.phase || 0, m = a.dead ? 0 : Math.min(1, a.mv || 0), P = [];
    if (d.shape === 'snake') { for (let k = 0; k < 6; k++) P.push({ e: [Ln * 0.45 - k * Ln * 0.18, Math.sin(p + k) * 1.5, Ln * 0.12, Wd * 0.5], col: k % 2 ? c : c2, h: 1.5 }); return P; }
    if (d.shape === 'bird') { P.push({ e: [0, 0, Ln * 0.5, Wd * 0.5], col: c, h: 6, dome: 2 }); P.push({ e: [Ln * 0.5, 0, 1.4, 1.3], col: c, h: 7.5, dome: 1 }); P.push({ e: [Ln * 0.52, 0, 0.7, 0.45], col: c2, h: 8.2 }); P.push({ e: [Ln * 0.82, 0, 0.6, 0.4], col: rgb('#e0a030'), h: 7.6 }); P.push({ e: [-Ln * 0.45, 0, 1.2, Wd * 0.35], col: sh(c, -0.2), h: 6.5 }); return P; }
    if (d.shape === 'gator') { P.push({ e: [0, 0, Ln * 0.42, Wd * 0.5], col: c, h: 3, dome: 1 }); P.push({ e: [Ln * 0.42, 0, Ln * 0.18, Wd * 0.3], col: c, h: 2.5 }); P.push({ c: [-Ln * 0.35, 0, -Ln * 0.7, Math.sin(p) * 2, Wd * 0.2], col: c, h: 2 }); for (const s of [-1, 1]) P.push({ e: [Ln * 0.18, s * Wd * 0.55, 1.4, 0.9], col: c2, h: 1.5 }); return P; }
    for (const [lx, ly, ph] of [[Ln * 0.3, -Wd * 0.38, 0], [Ln * 0.3, Wd * 0.38, Math.PI], [-Ln * 0.3, -Wd * 0.38, Math.PI * 0.6], [-Ln * 0.3, Wd * 0.38, Math.PI * 1.6]]) P.push({ e: [lx + Math.sin(p + ph) * Ln * 0.12 * m, ly, Math.max(1, Ln * 0.1), Math.max(0.8, Wd * 0.18)], col: sh(c, -0.3), h: 3, dome: 1 });
    P.push({ e: [0, 0, Ln * 0.5, Wd * 0.5], col: (x, y) => y > Wd * 0.25 ? c2 : c, h: Wd + 4, dome: Wd * 0.5 });
    if (d.hump) P.push({ e: [Ln * 0.18, 0, Ln * 0.22, Wd * 0.4], col: sh(c, -0.12), h: Wd + 5.5, dome: 1.5 });
    P.push({ e: [Ln * 0.5, 0, Math.max(1.4, Ln * 0.16), Math.max(1.2, Wd * 0.3)], col: c, h: Wd + 4.5, dome: 1 });
    P.push({ e: [Ln * 0.62, 0, Math.max(0.8, Ln * 0.07), Math.max(0.8, Wd * 0.18)], col: sh(c, -0.25), h: Wd + 4 });
    if (d.antler) for (const s of [-1, 1]) P.push({ c: [Ln * 0.45, s * 1, Ln * 0.3, s * (3 + d.antler * 1.5), 0.45], col: rgb('#d8c8a8'), h: Wd + 6 });
    if (d.tail || !d.bear) P.push({ c: [-Ln * 0.48, 0, -Ln * (d.tail ? 0.85 : 0.6), Math.sin(p) * m, Math.max(0.5, Wd * 0.12)], col: c, h: Wd + 3 });
    return P;
  }
  // önbellek: görünüm nesnesi → (açı/adım/duruş anahtarı → sprite)
  const SPR = new Map();
  let sprCount = 0;
  function cached(owner, kind, ang, key, mk) {
    let m = SPR.get(owner); if (!m) { m = new Map(); SPR.set(owner, m); }
    const ab = Math.round(((ang % TAU) + TAU) % TAU / TAU * 32) % 32, k = kind + ab + key;
    let s = m.get(k);
    if (!s) { if (sprCount > 6000) { SPR.clear(); sprCount = 0; m = new Map(); SPR.set(owner, m); } s = sprite(mk(), ab / 32 * TAU); m.set(k, s); sprCount++; }
    return s;
  }
  const walkKey = (phase, mv) => mv < 0.08 ? 'i' : 'w' + (Math.round(((phase % TAU) + TAU) % TAU / TAU * 8) % 8) + (mv > 0.6 ? 'f' : 's');
  const phaseOf = (key) => key[0] === 'i' ? 0 : (+key[1]) / 8 * TAU;

  /* ---------------- WebGL ışık geçişi ---------------- */
  const NL = 16, NW = 8;
  const VS = `attribute vec2 aP; varying vec2 vU; void main(){ vU = aP * 0.5 + 0.5; gl_Position = vec4(aP, 0.0, 1.0); }`;
  const HP = `#ifdef GL_FRAGMENT_PRECISION_HIGH
    precision highp float;
    #else
    precision mediump float;
    #endif
    `;
  const LFS = `${HP}
    varying vec2 vU; uniform sampler2D uC; uniform sampler2D uG; uniform vec2 uRes; uniform vec2 uOrg;
    uniform vec3 uSun; uniform vec3 uSunC; uniform vec3 uAmb; uniform float uNight; uniform float uDay;
    uniform vec4 uLP[${NL}]; uniform vec4 uLC[${NL}];
    uniform vec4 uIn; uniform vec4 uWin[${NW}]; uniform float uInAmb;
    uniform sampler2D uS; uniform vec2 uSRes;
    vec4 geo(vec2 p){ return texture2D(uG, p / uRes); }
    float hgt(vec2 p){ return texture2D(uG, p / uRes).r * 85.0; }
    // yarım çözünürlüklü gölge: dört komşu, yüksekliği bu piksele yakın olanlar ağır basar (duvar dibi kenarı keskin kalır)
    float shadowAt(vec2 st0, float hr){
      vec2 st = st0 * uSRes - 0.5, b = floor(st), f = st - b, i0 = (b + 0.5) / uSRes, d = 1.0 / uSRes;
      vec4 a = texture2D(uS, i0), c = texture2D(uS, i0 + vec2(d.x, 0.0)), e = texture2D(uS, i0 + vec2(0.0, d.y)), g = texture2D(uS, i0 + d);
      float wa = (1.0 - f.x) * (1.0 - f.y) / (0.004 + abs(a.g - hr)), wc = f.x * (1.0 - f.y) / (0.004 + abs(c.g - hr));
      float we = (1.0 - f.x) * f.y / (0.004 + abs(e.g - hr)), wg = f.x * f.y / (0.004 + abs(g.g - hr));
      return (a.r * wa + c.r * wc + e.r * we + g.r * wg) / (wa + wc + we + wg);
    }
    void main(){
      vec2 p = vec2(vU.x * uRes.x, (1.0 - vU.y) * uRes.y);
      vec2 uv = vec2(vU.x, 1.0 - vU.y);
      vec3 col = texture2D(uC, uv).rgb; vec4 G = texture2D(uG, uv);
      float h = G.r * 85.0;
      bool emW = G.g > 0.998 && G.b > 0.998, emF = G.g > 0.992 && G.g < 0.998 && G.b > 0.998;
      vec3 n = vec3(0.0, 1.0, 0.0);
      if (!emW && !emF) { n.x = G.g * 255.0 / 249.0 * 2.0 - 1.0; n.y = G.b * 255.0 / 249.0 * 2.0 - 1.0; n.z = sqrt(max(0.0, 1.0 - n.x * n.x - n.y * n.y)); }
      vec2 w = uOrg + p / 2.0;            // pikselin dünya (ekran) konumu
      float ndl = max(dot(n, uSun), 0.0);
      // güneş/ay gölgesi: ayrı geçişte yarım çözünürlükte hesaplanır (SHFS)
      float sh = ndl > 0.0 ? shadowAt(vU, G.r) : 1.0;
      // köşelerde ortam gölgesi
      float occ = 0.0;
      for (int k = 0; k < 8; k++) {
        float a = float(k) * 0.785398; vec2 o = vec2(cos(a), sin(a));
        float d1 = hgt(p + o * 6.0) - h, d2 = hgt(p + o * 12.0) - h;
        occ += clamp(d1 / 12.0, 0.0, 1.0) + clamp(d2 / 12.0, 0.0, 1.0) * 0.5;
      }
      float ao = max(0.55, 1.0 - occ * 0.07);
      // iç mekân: çatı altı, güneş yalnızca pencere ve kapıdan
      float ak = 1.0, sk = sh;
      bool inB = uIn.z > 0.0 && w.x > uIn.x - 3.0 && w.x < uIn.x + uIn.z + 3.0 && w.y > uIn.y - 3.0 && w.y < uIn.y + uIn.w + 3.0;
      if (uIn.z > 0.0 && w.x > uIn.x && w.x < uIn.x + uIn.z && w.y > uIn.y && w.y < uIn.y + uIn.w) {
        ak = uInAmb; sk = 0.0;
        if (uDay > 0.0 && h < 1.5) {
          float z = (uIn.y + uIn.w - w.y) / (uSun.y / max(uSun.z, 0.05)), xw = w.x + z * uSun.x / max(uSun.z, 0.05);
          for (int k = 0; k < ${NW}; k++) { vec4 W = uWin[k]; if (W.y > W.x && z >= W.z && z <= W.w && xw >= W.x && xw <= W.y) { sk = 1.25; } }
        }
      }
      vec3 lit = uAmb * ak * ao * (0.85 + 0.15 * n.z) + uSunC * ndl * sk;
      // nokta ışıklar: duvarda durur (iç mekânda mobilya da keser)
      vec3 P3 = vec3(w.x, w.y + h, h);
      for (int i = 0; i < ${NL}; i++) {
        vec4 L = uLP[i]; if (L.w <= 0.0 || (uLC[i].w > 0.5 && !inB)) continue;   // iç ışık binadan dışarı taşmaz
        vec3 d = vec3(L.x, L.y, L.z) - P3; float dd = dot(d, d); if (dd > L.w * L.w) continue;
        float dl = sqrt(dd) + 0.001, a = 1.0 - dd / (L.w * L.w); a *= a;
        float nd = max(dot(n, d / dl), 0.0) * 0.75 + 0.25;
        vec2 ls = (vec2(L.x, L.y - L.z) - uOrg) * 2.0;
        float ok = 1.0;
        for (int q = 1; q < 14; q++) {
          float t = float(q) / 16.0; vec2 s = mix(p, ls, t);
          float hq = hgt(s);
          if (hq > h + (L.z - h) * t + 4.0 && hq > (uLC[i].w > 0.5 ? 0.0 : 22.0)) { ok = uLC[i].w > 0.5 ? 0.35 : 0.0; break; }
        }
        lit += uLC[i].rgb * a * nd * ok;
      }
      vec3 c = col * lit;
      if (emW) c = mix(col * lit, mix(vec3(1.0, 0.82, 0.5), vec3(1.0, 0.62, 0.3), clamp(1.0 - dot(col, vec3(0.33)), 0.0, 1.0)) * 1.35, uNight);
      if (emF) c = col * 1.25 + vec3(0.25, 0.1, 0.0);
      gl_FragColor = vec4(c, 1.0);
    }`;
  const SHFS = `${HP}
    varying vec2 vU; uniform sampler2D uG; uniform vec2 uRes; uniform vec3 uSun; uniform float uShQ;
    float hgt(vec2 p){ return texture2D(uG, p / uRes).r * 85.0; }
    void main(){
      vec2 p = floor(vec2(vU.x * uRes.x, (1.0 - vU.y) * uRes.y)) + 0.5;   // iki kat yoğun tuvalde 2x2 bloğun bir pikseli
      vec4 G = texture2D(uG, p / uRes);
      float h = G.r * 85.0;
      bool em = G.g > 0.992 && G.b > 0.998;
      vec3 n = vec3(0.0, 1.0, 0.0);
      if (!em) { n.x = G.g * 255.0 / 249.0 * 2.0 - 1.0; n.y = G.b * 255.0 / 249.0 * 2.0 - 1.0; n.z = sqrt(max(0.0, 1.0 - n.x * n.x - n.y * n.y)); }
      float sh = 1.0;
      if (dot(n, uSun) > 0.0) {
        vec2 u = vec2(-uSun.x / uSun.z, -uSun.y / uSun.z + 1.0) * 2.0;
        vec2 side = normalize(vec2(-u.y, u.x));
        float hit = 0.0;
        for (int s = 0; s < 2; s++) {
          vec2 q0 = p + side * (float(s) - 0.5);
          for (int i = 1; i <= 48; i++) {
            float d = float(i) * 1.4 * uShQ;
            vec2 q = q0 - u * d;
            if (q.x < 0.0 || q.y < 0.0 || q.x >= uRes.x || q.y >= uRes.y) break;
            float hq = hgt(q);
            if (hq >= h + d && hq < h + d + 7.0) { hit += 0.5; break; }
          }
        }
        sh = 1.0 - hit;
      }
      gl_FragColor = vec4(sh, G.r, 0.0, 1.0);   // gölge ve yükseklik (ana geçişte komşu seçimi için)
    }`;
  const BFS = `${HP} varying vec2 vU; uniform sampler2D uT; uniform vec2 uDir; uniform float uThr;
    void main(){ vec3 s = vec3(0.0); float wsum = 0.0;
      for (int i = -4; i <= 4; i++) { float w = exp(-float(i * i) / 8.0); vec3 c = texture2D(uT, vU + uDir * float(i)).rgb; s += max(c - uThr, 0.0) * w; wsum += w; }
      gl_FragColor = vec4(s / wsum, 1.0); }`;
  const FFS = `${HP} varying vec2 vU; uniform sampler2D uL; uniform sampler2D uB; uniform float uBloom;
    float b2(vec2 a){ a = floor(a); return fract(a.x * 0.5 + a.y * a.y * 0.75); }
    float bay(vec2 a){ return b2(0.5 * a) * 0.25 + b2(a); }
    void main(){ vec3 c = texture2D(uL, vU).rgb + texture2D(uB, vU).rgb * uBloom;
      // omuz: parlak yüzeyler (kar, kum) patlamasın, dokusu kalsın
      c *= 1.04; vec3 hi = max(c - 0.75, 0.0); c = min(c, 0.75) + 0.25 * (1.0 - exp(-hi / 0.25));
      float dz = bay(gl_FragCoord.xy); gl_FragColor = vec4(floor(clamp(c, 0.0, 1.0) * 44.0 + dz) / 44.0, 1.0); }`;
  let gl = null, glc = null, failed = false, PL = null, PS = null, PB = null, PF = null, quad = null, texC = null, texG = null, rtL = null, rtS = null, rtA = null, rtB = null, RW = 0, RH = 0, lastVr = '';
  function compile(fs) {
    const mk = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
    const p = gl.createProgram(); gl.attachShader(p, mk(gl.VERTEX_SHADER, VS)); gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs)); gl.bindAttribLocation(p, 0, 'aP'); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const nm = gl.getActiveUniform(p, i).name; u[nm.replace(/\[0\]$/, '')] = gl.getUniformLocation(p, nm); }
    return { p, u };
  }
  function tex(w, h, linear) {
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    if (w) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    const f = linear ? gl.LINEAR : gl.NEAREST;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, f); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, f);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }
  function rt(w, h, linear, old) {
    if (old) { gl.deleteFramebuffer(old.fb); gl.deleteTexture(old.t); }
    const t = tex(w, h, linear), fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { fb, t, w, h };
  }
  // ekran kartı yoksa (yazılım çizimi) ışık geçişi kare başına yüzlerce ms sürer: klasik çizime kalınır.
  // window.__hySoft = true yazılımda da açar (testler ve ekran görüntüsü aracı için).
  let soft = false;
  function init() {
    if (soft && window.__hySoft) { soft = false; failed = false; }
    if (gl || failed) return !!gl;
    try {
      const cv = glc = document.createElement('canvas');
      // ekran kartı tercihi (Ayarlar → Görüntü → Ekran Kartı): tasarruflu seçildiyse tümleşik kart istenir
      gl = glc.getContext('webgl', { antialias: false, alpha: false, depth: false, preserveDrawingBuffer: false, powerPreference: G.gpuPower ? G.gpuPower() : 'high-performance', failIfMajorPerformanceCaveat: !window.__hySoft });
      if (!gl) { soft = !window.__hySoft && !!document.createElement('canvas').getContext('webgl'); throw new Error(soft ? 'yazılım çizimi' : 'WebGL yok'); }
      const ri = gl.getExtension('WEBGL_debug_renderer_info');
      if (!window.__hySoft && ri && /swiftshader|llvmpipe|softpipe|software|basic render/i.test(gl.getParameter(ri.UNMASKED_RENDERER_WEBGL))) { gl = null; soft = true; throw new Error('yazılım çizimi'); }
      PL = compile(LFS); PS = compile(SHFS); PB = compile(BFS); PF = compile(FFS);
      quad = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, quad); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
      texC = tex(0, 0, false); texG = tex(0, 0, false);
      glc.addEventListener('webglcontextlost', (e) => { e.preventDefault(); if (glc === cv) { failed = true; gl = null; } });   // bilerek bırakılan eski bağlam sayılmaz
      return true;
    } catch (e) {
      console.warn('Melez çizim açılamadı, klasik çizim kullanılacak:', e);
      failed = true; gl = null; return false;
    }
  }
  function draw(prog) { gl.useProgram(prog.p); gl.bindBuffer(gl.ARRAY_BUFFER, quad); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0); gl.drawArrays(gl.TRIANGLES, 0, 6); }

  /* ---------------- ışık durumu ---------------- */
  function sunState(G) {
    const h = G.hour, dl = clamp(G.daylight, 0, 1), cloud = (G.weather && G.weather.cloud) || 0, day = h > 5.2 && h < 20.3;
    const fade = day ? clamp(Math.min(h - 5.2, 20.3 - h) / 0.8, 0, 1) : 0;   // gün doğumu ve batımında güneş yumuşakça girer/çıkar
    // sabah doğudan, öğle güneyden (cepheler aydınlık), akşam batıdan; gölgeler yukarı ve yana düşer
    const a = (h - 12) / 12 * Math.PI, e = day ? 0.36 + 0.52 * Math.sin(clamp((h - 5.2) / 15.1, 0, 1) * Math.PI) : 0.95, hz = Math.cos(e);
    let s = day ? [-Math.sin(a) * hz, (Math.cos(a) * 0.45 + 0.25) * hz, Math.sin(e)] : [0.3, 0.55, 0.78];
    const l = Math.hypot(s[0], s[1], s[2]); s = s.map(v => v / l);
    const low = day ? clamp(1 - (e - 0.36) / 0.45, 0, 1) : 0, k = 1 - cloud * 0.65;
    const sunC = day ? [0.5 * dl * k * fade, (0.46 - 0.08 * low) * dl * k * fade, (0.38 - 0.16 * low) * dl * k * fade] : [0.11 * (1 - dl), 0.13 * (1 - dl), 0.22 * (1 - dl)];
    const amb = [lerp(0.13, 0.68, dl) + cloud * 0.06 * dl, lerp(0.15, 0.68, dl) + cloud * 0.06 * dl, lerp(0.25, 0.72, dl) + cloud * 0.06 * dl];
    return { dir: s, sunC, amb, dark: (1 - dl) * 0.84 + cloud * 0.08 * dl, day: day && dl > 0.3 };
  }
  function lights(G, x0, y0, vw, vh, fires, S0) {
    const out = [], W = G.world, P = G.player, night = S0.dark > 0.35, nk = clamp(S0.dark * 1.4, 0, 1);
    const inView = (x, y, r) => x + r > x0 && x - r < x0 + vw && y + r > y0 - 40 && y - r < y0 + vh + 60;
    const add = (x, y, z, r, c, k, inner) => { if (k > 0.01 && inView(x, y, r)) out.push({ x, y, z, r, c, k, inner: inner ? 1 : 0 }); };
    const IB = G.insideB;
    for (const L of W.lights) {
      if (L.type === 'window') { if (night && Juice.windowLit(L) && !IB) add(L.x, L.y + 22, 6, L.r * 1.35, [1.0, 0.75, 0.42], 1.0 * nk); }
      else if (L.type === 'lamp') { if (night) add(L.x, L.y + 6, 14, 84 * Juice.flicker(L.x + L.y, G.t * 0.6, 0.035), [1.0, 0.72, 0.42], 1.7 * nk); }
      else if (L.type === 'inner') { if (IB && IB.id === L.b) add(L.x, L.y, 30, L.r * 1.5, [1.0, 0.8, 0.52], night ? 1.5 : 0.2, true); }
      else if (L.type === 'fire') add(L.x, L.y, 8, L.r * 1.2 * Juice.flicker(L.x, G.t, 0.08), [1.0, 0.6, 0.28], 0.4 + nk);
      else if (L.type === 'beacon') { if (night) add(L.x, L.y, 76, L.r, [1.0, 0.92, 0.6], nk); }
    }
    for (const [x, y] of fires) add(x, y, 8, 86 * Juice.flicker(x * 0.37 + y, G.t, 0.07), [1.0, 0.6, 0.28], 0.4 + nk);
    if (G.camp) add(G.camp.x, G.camp.y, 8, 96 * Juice.flicker(3.1, G.t, 0.07), [1.0, 0.6, 0.28], 0.4 + nk);
    for (const f of Juice.flashes) add(f.x, f.y, 14, 80, [1.0, 0.9, 0.6], Math.min(1.6, f.t * 14));
    if (G.nomads) for (const c of G.nomads) if (c.spawned) add(c.x, c.y, 8, 100, [1.0, 0.6, 0.28], 0.4 + nk);
    if (P.lantern && P.has('lantern')) add(P.x + Math.cos(P.ang) * 6, P.y + Math.sin(P.ang) * 6, 16, 110, [1.0, 0.82, 0.52], 1.2 * Math.max(0.3, nk));
    else if (night && !IB) add(P.x, P.y, 18, 40, [0.75, 0.78, 0.95], 0.5 * nk);
    if (G.fx.muzzle > 0) add(P.x + Math.cos(P.aimAng || P.ang) * 10, P.y + Math.sin(P.aimAng || P.ang) * 10, 14, 90, [1.0, 0.9, 0.6], Math.min(1.6, G.fx.muzzle * 14));
    for (const tr of G.trains) if (tr.pos[0] && night) { const [x, y, a] = tr.pos[0]; add(x + Math.cos(a) * 40, y + Math.sin(a) * 40, 10, 80, [1.0, 0.95, 0.8], 0.9); }
    const cx = x0 + vw / 2, cy = y0 + vh / 2;
    out.sort((a, b) => (b.inner - a.inner) || dist2(a.x, a.y, cx, cy) - dist2(b.x, b.y, cx, cy));
    return out.slice(0, NL);
  }

  /* ---------------- kare ---------------- */
  let FC = null, FG = null, fc = null, fg = null, TO = null, TOG = null, to = null, tog = null;
  const stat = { frames: 0, ms: 0, built: 0, seg: {} };
  const seg = (k, t) => { stat.seg[k] = (stat.seg[k] || 0) * 0.9 + t * 0.1; };
  function frameCanvas(w, h) {
    if (FC && FC.width === w && FC.height === h) return;
    FC = makeCanvas(w, h); FG = makeCanvas(w, h); TO = makeCanvas(w, h); TOG = makeCanvas(w, h);
    fc = FC.getContext('2d'); fg = FG.getContext('2d'); to = TO.getContext('2d'); tog = TOG.getContext('2d');
    for (const c of [fc, fg, to, tog]) c.imageSmoothingEnabled = false;
  }
  // canlının gölgesi: güneşin tersine uzayan yumuşak şerit (dikey bir sütunun gölgesi)
  function creatureShadow(c, x, y, rx, ry, h, sd, k) {
    if (k < 0.02) return;
    c.fillStyle = `rgba(0,0,0,${0.075 * k})`;
    for (let z = 0; z <= h; z += 2) { const s = z < h * 0.6 ? 1 : 0.75; c.beginPath(); c.ellipse(x + sd[0] * z, y + sd[1] * z, rx * s, ry * s, 0, 0, TAU); c.fill(); }
  }
  function render(G, dt) {
    if (!init()) return false;
    const t0 = performance.now();
    const W = G.world, P = G.player, C = G.cam, vw = G.vw, vh = G.vh, x0 = C.ox, y0 = C.oy, x1 = x0 + vw, y1 = y0 + vh, w2 = vw * S, h2 = vh * S;
    if (world !== W) { flush(W); world = W; }
    if (W._hySeason !== W.season || W._hyFx !== G.settings.fxq) { if (W._hySeason !== undefined) flush(W); W._hySeason = W.season; W._hyFx = G.settings.fxq; }
    if (W.hyDirty && W.hyDirty.length) { for (const [px, py] of W.hyDirty) { chunks.delete(Math.floor(py / HC) * 1024 + Math.floor(px / HC)); const b = W.buildingAtPx(px, py); if (b) { b._hy = null; coverJobs.delete(b); } } W.hyDirty.length = 0; }
    frameCanvas(w2, h2);
    const S0 = sunState(G), sd = [-S0.dir[0] / S0.dir[2], -S0.dir[1] / S0.dir[2]];

    /* 1) parçalar: alt katman */
    fc.setTransform(1, 0, 0, 1, 0, 0); fg.setTransform(1, 0, 0, 1, 0, 0);
    fc.fillStyle = '#2c4b5e'; fc.fillRect(0, 0, w2, h2); fg.fillStyle = 'rgb(0,124,124)'; fg.fillRect(0, 0, w2, h2);
    const NC = Math.ceil(WW * TS / HC), vis = [];
    const ccx0 = Math.floor(x0 / HC), ccy0 = Math.floor(y0 / HC), ccx1 = Math.floor(x1 / HC), ccy1 = Math.floor(y1 / HC);
    for (let cy = ccy0; cy <= ccy1; cy++) for (let cx = ccx0; cx <= ccx1; cx++) {
      if (cx < 0 || cy < 0 || cx >= NC || cy >= NC) continue;
      const c = chunk(W, cx, cy, true), dx = (cx * HC - x0) * S, dy = (cy * HC - y0) * S;
      vis.push([c, dx, dy]);
      fc.drawImage(c.bc, dx, dy); fg.drawImage(c.bg, dx, dy);
    }
    // ileride gerekecek parçalar (hareket yönünde bir halka)
    for (let cy = ccy0 - 1; cy <= ccy1 + 1; cy++) for (let cx = ccx0 - 1; cx <= ccx1 + 1; cx++) if (cx >= 0 && cy >= 0 && cx < NC && cy < NC) chunk(W, cx, cy, false);
    const t1 = performance.now(); seg('parçalar', t1 - t0);

    /* 2) zemin katmanı (2D): izler, köpük, otlar, yerdeki eşyalar */
    fc.setTransform(S, 0, 0, S, -x0 * S, -y0 * S);
    FX.beginFrame();
    FX.drawGround(fc);
    Juice.drawGround(fc, x0, y0, x1, y1);
    const fires = [], tile = W.tile, obj = W.obj, day = G.day, t = G.t, fxFull = FX.full;
    const tx0 = Math.max(0, (x0 >> 4) - 1), ty0 = Math.max(0, (y0 >> 4) - 1), tx1 = Math.min(WW - 1, (x1 >> 4) + 1), ty1 = Math.min(WH - 1, (y1 >> 4) + 1);
    for (let ty = ty0; ty <= ty1; ty++) {
      const row = ty * WW;
      for (let tx = tx0; tx <= tx1; tx++) {
        if (tile[row + tx] === T.WATER) { FX.foam(fc, tx, ty, t); if (fxFull) Juice.water(fc, tx, ty, t); }
        const o = obj[row + tx];
        if (!o) continue;
        if (o >= 20 && o <= 28) {
          if (W.season === 3 && W.snowyTile(tx, ty)) continue;
          const hv = W.harvested.get(row + tx);
          if (hv !== undefined && hv > day) continue;
          Spr.herb(fc, o, tx * TS + 8, ty * TS + 10, t, dist2(tx * TS + 8, ty * TS + 8, P.x, P.y) < 60 * 60);
        } else if (o === O.ARTIFACT) { if (W.harvested.get(row + tx) === undefined) Spr.sparkle(fc, tx * TS + 8, ty * TS + 8, t + tx); }
        else if (o === O.CAMPFIRE) { fires.push([tx * TS + 8, ty * TS + 8]); if (Math.random() < dt * 6) G.parts.add('ember', tx * TS + 8, ty * TS + 4, 0, -10, 1, 1); FX.fireSource(tx * TS + 8, ty * TS + 8); }
        else if (o === O.STEAM) { if (Math.random() < dt * 18) G.parts.add('steam', tx * TS + rnd(-40, 56), ty * TS + rnd(-40, 56), rnd(-4, 4), -6, 2.5, 3); }
      }
    }
    for (const L of G.lostItems) Spr.sparkle(fc, L.x, L.y, t * 1.3);
    if (G.treasure && P.has('treasure_map') && dist2(G.treasure.x, G.treasure.y, P.x, P.y) < 120 * 120) { fc.fillStyle = 'rgba(90,60,30,0.6)'; fc.beginPath(); fc.ellipse(G.treasure.x, G.treasure.y, 6, 4, 0, 0, TAU); fc.fill(); }
    for (const ev of G.events) if (ev.wagon && dist2(ev.wagon.x, ev.wagon.y, P.x, P.y) < 800 * 800) Spr.object(fc, fc, O.WAGON, ev.wagon.x - 6, ev.wagon.y, 0.9, W);
    for (const tr of G.trains) tr.draw(fc, x0, y0, x1, y1);
    G.drawTumbles(fc);

    /* 3) canlılar: güneşe göre gölge, sonra sprite */
    const vis2 = [];
    for (const e of G.ents) if (e.x > x0 - 40 && e.x < x1 + 40 && e.y > y0 - 40 && e.y < y1 + 40 && !(e.rider === P)) vis2.push(e);
    if (P.riding) vis2.push(P.riding);
    vis2.push(P);
    const flat = (e) => e.dead || e.bound || e.kind === 'pelt' || e.kind === 'crate' ? -20 : 0;
    vis2.sort((a, b) => (a.y + flat(a)) - (b.y + flat(b)));
    const shk = (S0.day ? 1 : 0.35) * (G.insideB ? 0.4 : 1);
    const blit = (s, x, y) => fc.drawImage(s.c, x - s.h / S, y - s.h / S, s.c.width / S, s.c.height / S);
    const human = (x, y, ang, L, st, owner, z = 0, sc = 1) => {
      const wk = st.walkKey || walkKey(st.walk || 0, Math.min(1, st.mv || 0));
      const key = wk + (st.aim ? 'a' + st.wk : '') + (st.riding ? 'r' : '') + (st.crouch ? 'c' : '') + (st.lying ? 'l' + (st.tied ? 't' : '') : '') + (st.hasGun ? 'g' : '') + (st.backGun ? 'b' : '') + (st.hold || '') + (st.swing > 0.2 ? 's' : '');
      const s = cached(L, 'h', ang, key, () => humanParts(L, Object.assign({}, st, { walk: phaseOf(wk), mv: wk[0] === 'i' ? 0 : wk[2] === 'f' ? 1 : 0.5, swing: st.swing > 0.2 ? 1 : 0 })));
      if (sc !== 1) { fc.save(); fc.translate(x, y - z); fc.scale(sc, sc); fc.drawImage(s.c, -s.h / S, -s.h / S, s.c.width / S, s.c.height / S); fc.restore(); }
      else blit(s, x, y - z);
    };
    const horse = (x, y, ang, L, st) => {
      const wk = walkKey(st.phase || 0, Math.min(1, st.mv || 0)), key = wk + (st.saddle ? 's' : '') + (st.bags ? 'b' : '') + (st.graze ? 'g' : '') + (st.dead ? 'd' : '');
      blit(cached(L, 'H', ang, key, () => horseParts(L, Object.assign({}, st, { phase: phaseOf(wk), mv: wk[0] === 'i' ? 0 : wk[2] === 'f' ? 1 : 0.5 }))), x, y);
    };
    // her varlık kamerayla aynı yarım piksel ızgarasına oturur: kayarken titremez
    let sdx = 0, sdy = 0;
    for (const e of vis2) {
      if (e === P && P.riding) continue;
      const nx = Math.round(e.x * S) / S - e.x, ny = Math.round(e.y * S) / S - e.y;
      fc.translate(nx - sdx, ny - sdy); sdx = nx; sdy = ny;
      if (e === P) {
        if (P.mountAnim) { const A = P.mountAnim, k = Math.min(1, A.t / A.dur), hop = Math.sin(k * Math.PI) * (A.on ? 6 : 5), seated = A.on ? k > 0.7 : k < 0.3; human(P.x, P.y, P.ang, P.lookNow(), seated ? { riding: true } : { walk: P.phase, mv: 0.5 }, P, hop); continue; }
        creatureShadow(fc, P.x, P.y, 2.8, 2.4, 22, sd, shk);
        human(P.x, P.y, P.ang, P.lookNow(), { walk: P.phase, mv: Math.min(1, P.mv), aim: P.aiming || P.swing > 0.2, wk: P.aimKind(), crouch: P.crouch, swing: P.swing, hasGun: P.weapons.has('cattleman') || P.weapons.has('schofield'), backGun: P.weapons.has('repeater') || P.weapons.has('winchester') || P.weapons.has('rifle') || P.weapons.has('shotgun') }, P);
        if (P.carry) Spr.carried(fc, P.carry, P.x - Math.cos(P.ang) * 0.8, P.y - Math.sin(P.ang) * 0.8, P.ang + Math.PI / 2, P.carry.kind === 'pelt' ? 0.9 : 0.8);
        continue;
      }
      if (e.rider === P && e.kind === 'horse') {
        creatureShadow(fc, e.x, e.y, 6, 4, 26, sd, shk);
        horse(e.x, e.y, e.ang, e.look, { phase: e.phase, mv: e.mv, saddle: true, bags: e.owner === 'player' });
        if (!P.mountAnim) human(P.x - Math.cos(e.ang), P.y - Math.sin(e.ang), P.ang, P.lookNow(), { riding: true, aim: P.aiming, wk: P.aimKind() }, P, 0);
        else { const A = P.mountAnim, k = Math.min(1, A.t / A.dur), hop = Math.sin(k * Math.PI) * (A.on ? 6 : 5), seated = A.on ? k > 0.7 : k < 0.3; human(P.x, P.y, P.ang, P.lookNow(), seated ? { riding: true } : { walk: P.phase, mv: 0.5 }, P, hop); }
        continue;
      }
      if (e.kind === 'npc') {
        if (e.mounted && !e.dead) { creatureShadow(fc, e.x, e.y, 6, 4, 26, sd, shk); horse(e.x, e.y, e.hAng === undefined ? e.ang : e.hAng, e.mounted, { phase: e.phase, mv: e.mv, saddle: true }); human(e.x, e.y, e.ang, e.look, { riding: true, aim: e.hostile && e.aggro !== false, wk: e.weapon ? WEAPONS[e.weapon].kind : null }, e); continue; }
        const sc = e.child ? 0.7 : 1;
        if (e.dead || e.state === 'hurt' || e.bound) {
          if (e.dead && !e.inWater) { const pk = Math.min(1, (e.deadT || 0) / 6), r = 3 + 6 * pk; fc.fillStyle = `rgba(${130 - 62 * pk | 0},10,10,${(0.5 + 0.2 * pk) * (1 - 0.7 * Juice.soak(e))})`; fc.beginPath(); fc.ellipse(e.x + 2, e.y + 2, r * 1.1, r * 0.66, 0, 0, TAU); fc.fill(); }
          human(e.x, e.y, e.ang, e.look, { lying: true, tied: e.state === 'tied' }, e, 0, sc);
          continue;
        }
        creatureShadow(fc, e.x, e.y, 2.8 * sc, 2.4 * sc, 22 * sc, sd, shk);
        human(e.x, e.y, e.ang, e.look, { walk: e.phase, mv: Math.min(1, e.mv), crouch: e.state === 'cower' || e.state === 'sit' || e.state === 'sleep' || e.held, aim: (e.hostile && (e.aggro || e.isLaw) && !!e.weapon) || e.state === 'robbing', wk: e.weapon ? WEAPONS[e.weapon].kind : (e.state === 'fightFist' ? 'fists' : null), swing: e.swing > 0 ? e.swing : 0, hasGun: !!e.weapon, hold: e.state === 'flee' || e.state === 'report' ? null : e.carry2 }, e, 0, sc);
        if (e.witness && !e.dead) { const bob = Math.sin(G.t * 6) * 0.8; fc.fillStyle = 'rgba(20,12,6,0.8)'; fc.fillRect(e.x - 1.6, e.y - 15 + bob, 3.2, 8.4); fc.fillStyle = e.held ? '#f0e0b0' : '#f0a030'; fc.fillRect(e.x - 0.8, e.y - 14.2 + bob, 1.6, 4.2); fc.fillRect(e.x - 0.8, e.y - 9.2 + bob, 1.6, 1.6); }
        continue;
      }
      if (e.kind === 'horse') { if (!e.dead) creatureShadow(fc, e.x, e.y, 6, 4, 18, sd, shk); horse(e.x, e.y, e.ang, e.look, { phase: e.phase, mv: e.mv, saddle: e.saddle, dead: e.dead, graze: e.graze && !e.rider, bags: e.owner === 'player' }); continue; }
      if (e.kind === 'animal') {
        if (e.hide) continue;
        if (e.def.shape === 'horse') { horse(e.x, e.y, e.ang, { col: e.def.col, mane: e.def.col2 }, { phase: e.phase, mv: e.mv, dead: e.dead }); continue; }
        if (e.dead) { e.draw(fc); continue; }
        if (e.bound) { e.draw(fc); continue; }
        creatureShadow(fc, e.x, e.y, e.def.len * 0.35, e.def.wid * 0.4, e.def.wid + 4, sd, shk);
        const wk = walkKey(e.phase || 0, Math.min(1, e.mv || 0));
        blit(cached(e.def, 'A' + (e.skinned ? 's' : ''), e.ang, wk, () => animalParts({ def: e.def, skinned: e.skinned, phase: phaseOf(wk), mv: wk[0] === 'i' ? 0 : 1 })), e.x, e.y);
        continue;
      }
      e.draw(fc);   // araba, sandık, post, kamp, dekor: 2D çizim
    }
    fc.translate(-sdx, -sdy);
    G.drawProjs(fc);
    G.parts.draw(fc, x0, y0, x1, y1);
    const t2 = performance.now(); seg('canlılar', t2 - t1);

    /* 4) üst katman (ağaç taçları, fener başları) ve bina örtüleri */
    fc.setTransform(1, 0, 0, 1, 0, 0);
    const under = G.playerUnderCanopy();
    if (under) {
      to.clearRect(0, 0, w2, h2); tog.clearRect(0, 0, w2, h2);
      for (const [c, dx, dy] of vis) if (c.oc) { to.drawImage(c.oc, dx, dy); tog.drawImage(c.og, dx, dy); }
      const px = (P.x - x0) * S, py = (P.y - y0 - 4) * S;
      for (const c of [to, tog]) { c.globalCompositeOperation = 'destination-out'; c.drawImage(G.holeSpr, px - 68, py - 68, 136, 136); c.globalCompositeOperation = 'source-over'; }
      fc.drawImage(TO, 0, 0); fg.drawImage(TOG, 0, 0);
    } else for (const [c, dx, dy] of vis) if (c.oc) { fc.drawImage(c.oc, dx, dy); fg.drawImage(c.og, dx, dy); }
    const IB = G.insideB, k = Math.min(1, dt * 7);
    for (const b of W.buildings) {
      const bxp = b.x * TS, byp = b.y * TS, bw = b.w * TS, bh = b.h * TS;
      if (bxp + bw + 50 < x0 || bxp - 50 > x1 || byp + bh + 30 < y0 || byp - 80 > y1) {
        // yakında görünecek bina: örtüsü kare bütçesinden önceden pişer
        if (!(bxp + bw + 50 + HC < x0 || bxp - 50 - HC > x1 || byp + bh + 30 + HC < y0 || byp - 80 - HC > y1) && !(b._hy && b._hy.gen === W._hyGen) && !coverJobs.has(b)) coverJobs.set(b, { gen: coverGen(b, W), spent: 0 });
        continue;
      }
      let target = 1;
      if (b === IB) target = 0;
      else if (P.x > bxp - 6 && P.x < bxp + bw + 6 && P.y > byp - 34 && P.y < byp + bh - (b.def.tall ? 30 : 22)) target = 0.4;
      b.coverA = b.coverA === undefined ? target : b.coverA + (target - b.coverA) * k;
      if (b.coverA < 0.02) continue;
      const cv = cover(b, W);
      fc.globalAlpha = b.coverA; fg.globalAlpha = b.coverA > 0.5 ? 1 : 0;
      fc.drawImage(cv.c, (cv.x - x0) * S, (cv.y - y0) * S); if (fg.globalAlpha) fg.drawImage(cv.g, (cv.x - x0) * S, (cv.y - y0) * S);
    }
    fc.globalAlpha = 1; fg.globalAlpha = 1;
    fc.setTransform(S, 0, 0, S, -x0 * S, -y0 * S);
    Juice.drawAfterCovers(fc, x0, y0, x1, y1, dt);
    fc.setTransform(1, 0, 0, 1, 0, 0);
    const t3 = performance.now(); seg('üst katman', t3 - t2);

    /* 5) WebGL ışık */
    if (glc.width !== w2 || glc.height !== h2) { glc.width = w2; glc.height = h2; }
    if (RW !== w2 || RH !== h2) { RW = w2; RH = h2; lastVr = ''; rtL = rt(w2, h2, true, rtL); rtS = rt(w2 >> 1, h2 >> 1, false, rtS); rtA = rt(w2 >> 2, h2 >> 2, true, rtA); rtB = rt(w2 >> 2, h2 >> 2, true, rtB); }
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texC); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, FC);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, texG); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, FG);
    // görünür alan: tuvalin kenar payı yalnızca dörtnala uzaklaşınca görünür, iç mekânda yakınlaşınca daha da azı;
    // ışık ve gölge geçişleri yalnızca görünen kısma (parlama için birkaç piksel payla) çizilir
    const scis = (k) => { if (vr) { gl.enable(gl.SCISSOR_TEST); gl.scissor(Math.floor(vr[0] / k), Math.floor(vr[1] / k), Math.ceil(vr[2] / k), Math.ceil(vr[3] / k)); } else gl.disable(gl.SCISSOR_TEST); };
    let vr = null;
    if (!FX.drunkCss && G.scale > 0) {
      const zo = G.camZoom && G.camZoom.out > 0 ? G.camZoom.out : 1, hw = innerWidth / (2 * G.scale * zo), hh = innerHeight / (2 * G.scale * zo), m = 8;
      const X0 = Math.max(0, Math.floor((vw / 2 - hw) * S - m)), X1 = Math.min(w2, Math.ceil((vw / 2 + hw) * S + m));
      const Y0 = Math.max(0, Math.floor((vh / 2 - hh) * S - m)), Y1 = Math.min(h2, Math.ceil((vh / 2 + hh) * S + m));
      if (X1 > X0 && Y1 > Y0 && (X1 - X0) * (Y1 - Y0) < w2 * h2) vr = [X0, h2 - Y1, X1 - X0, Y1 - Y0];   // GL'de y aşağıdan yukarı
    }
    stat.lit = vr ? +(vr[2] * vr[3] / (w2 * h2)).toFixed(3) : 1;
    // görünür alan değişince ışık tamponunun dışı karartılır: parlama bulanıklığı kenarda eski görüntüden beslenmez
    const vk = vr ? vr.join(',') : 'hepsi';
    if (vk !== lastVr) { lastVr = vk; gl.bindFramebuffer(gl.FRAMEBUFFER, rtL.fb); gl.disable(gl.SCISSOR_TEST); gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT); }
    // güneş/ay gölgesi: dünya çözünürlüğünde (iki kat yoğun tuvalin yarısı), ana geçiş yüksekliğe duyarlı büyütür
    gl.bindFramebuffer(gl.FRAMEBUFFER, rtS.fb); gl.viewport(0, 0, rtS.w, rtS.h); scis(2);
    gl.useProgram(PS.p);
    gl.uniform1i(PS.u.uG, 1); gl.uniform2f(PS.u.uRes, w2, h2); gl.uniform3fv(PS.u.uSun, S0.dir); gl.uniform1f(PS.u.uShQ, G.settings.fxq ? 1.6 : 1);
    draw(PS);
    gl.bindFramebuffer(gl.FRAMEBUFFER, rtL.fb); gl.viewport(0, 0, w2, h2); scis(1);
    const u = PL.u; gl.useProgram(PL.p);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, rtS.t);
    gl.uniform1i(u.uC, 0); gl.uniform1i(u.uG, 1); gl.uniform1i(u.uS, 2); gl.uniform2f(u.uSRes, rtS.w, rtS.h); gl.uniform2f(u.uRes, w2, h2); gl.uniform2f(u.uOrg, x0, y0);
    gl.uniform3fv(u.uSun, S0.dir); gl.uniform3fv(u.uSunC, S0.sunC); gl.uniform3fv(u.uAmb, S0.amb);
    gl.uniform1f(u.uNight, clamp((S0.dark - 0.3) * 2.5, 0, 1)); gl.uniform1f(u.uDay, S0.day ? 1 : 0);
    const Ls = lights(G, x0, y0, vw, vh, fires, S0), LP = new Float32Array(NL * 4), LC = new Float32Array(NL * 4);
    Ls.forEach((L, i) => { LP.set([L.x, L.y, L.z, L.r], i * 4); LC.set([L.c[0] * L.k, L.c[1] * L.k, L.c[2] * L.k, L.inner], i * 4); });
    gl.uniform4fv(u.uLP, LP); gl.uniform4fv(u.uLC, LC);
    const WN = new Float32Array(NW * 4);
    if (IB) {
      gl.uniform4f(u.uIn, IB.x * TS, IB.y * TS, IB.w * TS, IB.h * TS); gl.uniform1f(u.uInAmb, S0.dark > 0.35 ? 1.9 : 0.95);
      const nW = Math.max(1, Math.floor(IB.w / 3)); let k2 = 0;
      for (let q = 0; q < nW && k2 < NW - 1; q++) { const cx = IB.x * TS + (q + 0.5) * IB.w * TS / nW; if (Math.abs(cx - IB.door.x) >= 14) WN.set([cx - 5, cx + 5, 4, 16], (k2++) * 4); }
      WN.set([IB.door.x - 8, IB.door.x + 8, 0, 14], k2 * 4);
    } else { gl.uniform4f(u.uIn, 0, 0, 0, 0); gl.uniform1f(u.uInAmb, 1); }
    gl.uniform4fv(u.uWin, WN);
    draw(PL);
    gl.disable(gl.SCISSOR_TEST);
    // parlama: dörtte bir çözünürlükte yatay + dikey bulanıklık
    gl.bindFramebuffer(gl.FRAMEBUFFER, rtA.fb); gl.viewport(0, 0, rtA.w, rtA.h);
    gl.useProgram(PB.p); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, rtL.t); gl.uniform1i(PB.u.uT, 0); gl.uniform2f(PB.u.uDir, 2.5 / rtA.w, 0); gl.uniform1f(PB.u.uThr, 1.15 - S0.dark * 0.4); draw(PB);   // gündüz yalnızca çok parlak (ışıyan) yerler parlar
    gl.bindFramebuffer(gl.FRAMEBUFFER, rtB.fb);
    gl.bindTexture(gl.TEXTURE_2D, rtA.t); gl.uniform2f(PB.u.uDir, 0, 2.5 / rtA.h); gl.uniform1f(PB.u.uThr, 0); draw(PB);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, w2, h2);
    gl.useProgram(PF.p); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, rtL.t); gl.uniform1i(PF.u.uL, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, rtB.t); gl.uniform1i(PF.u.uB, 1); gl.uniform1f(PF.u.uBloom, 0.9 + S0.dark * 0.8);
    draw(PF);
    if (gl.isContextLost && gl.isContextLost()) return false;
    const t4 = performance.now(); seg('ışık (GPU komutları)', t4 - t3);

    /* 6) ekrana: ışıklı görüntü, sonra 2D üst katmanlar (alev, kuşlar, bulutlar, arayüz, hava, renk tonu) */
    const ctx = G.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(glc, 0, 0);
    const t5 = performance.now(); seg('GPU bekleme', t5 - t4);
    ctx.setTransform(S, 0, 0, S, 0, 0);
    ctx.save(); ctx.translate(-x0, -y0);
    for (const [x, y] of fires) Spr.fire(ctx, x, y, t);
    ctx.restore();
    G.renderTail(ctx, dt, x0, y0, x1, y1, fires, false);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    // arka plan işleri: kare aralığına göre pay (60 Hz'de ~6, 144 Hz'de ~2.4 ms), yetişmeyecek işe ek süre
    const fm = G.frameMs || 16.7, base = Math.max(0.75, Math.min(6, fm * 0.35) - (performance.now() - t0) * 0.3), q = queue(x0, y0, x1, y1);
    runJobs(jobBudget(q, base, C, dt, fm), q);
    seg('2D üst katman', performance.now() - t5);
    stat.frames++; stat.ms = stat.ms * 0.95 + (performance.now() - t0) * 0.05; stat.lights = Ls.length; stat.chunks = chunks.size;
    return true;
  }

  /* Bağlamı bırak: sonraki available() yeni güç tercihiyle (ekran kartı değişti) baştan kurar */
  function reset() {
    try { const x = gl && gl.getExtension('WEBGL_lose_context'); if (x) x.loseContext(); } catch (e) {}
    gl = null; glc = null; failed = false; soft = false;
    PL = PS = PB = PF = null; quad = texC = texG = null; rtL = rtS = rtA = rtB = null; RW = RH = 0; lastVr = '';
  }

  return {
    render, stat, reset, flush: (W) => flush(W || world),
    // testler için: bir noktanın parçasını ve bir binanın örtüsünü hemen pişir; bekleyen işleri yürüt, örtü sırada mı
    _bake(W, x, y) { return chunk(W, Math.floor(x / HC), Math.floor(y / HC), true); }, _cover(b, W) { return cover(b, W); },
    _jobs(ms) { runJobs(ms, queue(-1e9, -1e9, 1e9, 1e9)); return { chunks: jobs.size, covers: coverJobs.size }; }, _coverQueued(b) { return coverJobs.has(b); },
    get _cost() { return { ...cost, v: camV }; },
    available() { return init(); },
    get canvas() { return glc; },
  };
})();
