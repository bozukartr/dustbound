'use strict';
/* ==========================================================
   FRONTIER'S END — açılış sinematikleri
   Her geçmişin yeni hayatı bir açılış sahnesiyle başlar; sahne o geçmişin
   hikâyesinin ilk bölümüne bağlanır:
     Çiftçi Çocuğu  — bankanın el koyduğu çiftlik, doğuya giden aile, Harlow yolu
     Kanun Kaçağı   — saklı kampta şafak, ateşin başında Hollis
     Göçmen         — gemi Saint Clement'a yanaşır, iskelede Greta
     Demiryolu      — ray kampında sabah düdüğü, Boone; Fort Redstone'a gelen tren
     Tuzakçı        — karlı ormanda boş kulübe, Cedar Falls'a iniş
   Hikâye açıkken (opts.story) akıl hocası görünür ve konuşma satırları
   oynar; kapalıyken aynı sahne sessiz oynar. Çizici: cinema.js (güneş
   gölgesi, ateş ışığı, su, film geçişi, piksel kademesi).
   ========================================================== */
(() => {
  const K = Cinema.kit, { M4, V, C, ease, cl01, flatW, Mesh } = K;
  const LIGHT = (dir, amb, dif, ambC, sunC) => ({ dir: V.norm(dir), amb, dif, ambC: C(ambC), sunC: C(sunC) });
  const GLOW = { dir: [0, 1, 0], amb: 1, dif: 0, ambC: [1.25, 1.2, 1.1], sunC: [0, 0, 0] };
  const SC = (x, y, z) => new Float32Array([x, 0, 0, 0, 0, y, 0, 0, 0, 0, z, 0, 0, 0, 0, 1]);
  /* t0–t1 arasında 0→1 yumuşak geçiş */
  const kk = (t, t0, t1) => ease(cl01((t - t0) / (t1 - t0)));
  /* yumuşak değer gürültüsü: zemin renkleri damalı değil, lekeler hâlinde geçiş yapar */
  const vn = (x, z, sd) => { const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi, u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
    const a = hash2(xi, zi, sd), b = hash2(xi + 1, zi, sd), c = hash2(xi, zi + 1, sd), d = hash2(xi + 1, zi + 1, sd); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; };
  const fbm = (x, z, sd = 7) => vn(x, z, sd) * 0.6 + vn(x * 2.3, z * 2.3, sd + 1) * 0.28 + vn(x * 5.1, z * 5.1, sd + 2) * 0.12;
  /* zemin rengi: renk dizisi boyunca gürültüyle kayar, üstüne küçük titreşim */
  const ground = (cols, sc = 0.03, sd = 7) => { const P = cols.map(C); return (x, z) => { const f = cl01((fbm(x * sc, z * sc, sd) - 0.2) / 0.6) * (P.length - 1), i = Math.min(P.length - 2, Math.floor(f)), k = f - i, j = (hash2(x | 0, z | 0, sd) - 0.5) * 0.04;
    return [0, 1, 2].map(n => P[i][n] + (P[i + 1][n] - P[i][n]) * k + j); }; };

  /* ---------------- kişiler ---------------- */
  /* yürüyen kişi: gövde ve iki bacak ayrı (bacaklar kalçadan sallanır) */
  function walker(L, look, arms) {
    const b = new Mesh(L); K.rider(b, look, 0, 0.85, 0, false, arms);
    const lg = new Mesh(L); lg.box(0, -0.85, 0, 0.16, 0.85, 0.2, look.pants); lg.box(0, -0.85, 0.05, 0.18, 0.12, 0.3, '#1a120c');
    return { body: K.build(b), leg: K.build(lg) };
  }
  function drawWalker(D, P, x, y, z, ang, ph, amt) {
    const base = M4.chain(M4.tr(x, y + Math.abs(Math.sin(ph)) * 0.04 * amt, z), M4.ry(ang));
    D.push([K.blob(), M4.chain(M4.tr(x, y + 0.03, z), M4.ry(ang), SC(0.45, 1, 0.35)), 0.2]);
    D.push([P.body, base]);
    for (const s of [-1, 1]) D.push([P.leg, M4.chain(base, M4.tr(s * 0.12, 0.85, 0), M4.rx(Math.sin(ph + (s > 0 ? 0 : Math.PI)) * 0.5 * amt))]);
  }
  /* ayakta duran (sabit) */
  function stand(m, look, x, y, z, ry, arms) {
    m.at(x, y, z, ry, () => { for (const s of [-1, 1]) { m.box(s * 0.12, 0, 0, 0.16, 0.85, 0.2, look.pants); m.box(s * 0.12, 0, 0.05, 0.18, 0.12, 0.3, '#1a120c'); } K.rider(m, look, 0, 0.85, 0, false, arms); });
  }
  /* kütük ya da sandık üstünde oturan */
  function sit(m, look, x, y, z, ry, arms) {
    m.at(x, y, z, ry, () => {
      for (const s of [-1, 1]) { m.box(s * 0.12, 0.42, 0.18, 0.17, 0.17, 0.46, look.pants); m.box(s * 0.12, 0, 0.38, 0.16, 0.46, 0.18, look.pants); m.box(s * 0.12, 0, 0.44, 0.18, 0.12, 0.3, '#1a120c'); }
      K.rider(m, look, 0, 0.42, 0, false, arms || 'reins');
    });
  }
  /* sallanan kol (el sallama): omuzdan döner */
  function armMesh(L, look) { const a = new Mesh(L); a.box(0, -0.32, 0, 0.13, 0.34, 0.15, look.coat); a.box(0, -0.62, 0, 0.12, 0.3, 0.14, shadeHex(look.coat, -0.16)); a.box(0, -0.74, 0, 0.1, 0.12, 0.1, look.skin); return K.build(a); }
  /* ailenin görünüşü: oyuncunun ten ve saç renginden, yaşlanmış */
  function kinLook(look, sex, R) {
    const k = randomLook(sex, R);
    k.skin = look.skin; k.eyes = look.eyes;
    k.hair = sex === 'm' ? shadeHex(look.hair, 0.25) : look.hair;
    if (sex === 'm') { k.beard = 3; k.beardLen = 0.6; k.hat = 'wide'; k.hatCol = '#5a4a38'; k.coat = '#4a4238'; }
    else { k.hat = 'none'; k.hairStyle = 1; k.coat = '#5a4a5a'; k.shirt = '#d8d0c0'; k.scarf = '#6a5a7a'; }
    return k;
  }

  /* ---------------- yapılar ve eşyalar ---------------- */
  function campfire(m, g, x, y, z) {
    for (let k = 0; k < 9; k++) { const a = k / 9 * TAU; m.box(x + Math.cos(a) * 0.85, y, z + Math.sin(a) * 0.85, 0.34, 0.24, 0.3, k % 2 ? '#6a6a64' : '#5a5a56'); }
    for (let k = 0; k < 3; k++) m.at(x, y + 0.08, z, k * 1.05, () => m.box(0, 0, 0, 0.16, 0.16, 1.2, '#3a2416'));
    g.box(x, y + 0.04, z, 0.9, 0.06, 0.9, '#c84a18');
    g.cone(x, y + 0.1, z, 0.34, 0.62, 5, '#ff7a20', '#ffd060'); g.cone(x + 0.12, y + 0.1, z - 0.08, 0.2, 0.45, 5, '#ffa030', '#fff0a0'); g.cone(x - 0.14, y + 0.1, z + 0.06, 0.18, 0.36, 5, '#ff9028', '#ffe080');
  }
  const fireP = (R, add, x, y, z, k = 1) => {
    if (Math.random() < 0.9 * k) add([x + R.range(-0.22, 0.22), y + 0.35, z + R.range(-0.22, 0.22)], [R.range(-0.2, 0.2), R.range(1.1, 2), R.range(-0.2, 0.2)], [1, R.range(0.5, 0.8), 0.2, 0.9], 0.45, 0.5);
    if (Math.random() < 0.25 * k) add([x, y + 0.9, z], [R.range(-0.3, 0.3), R.range(0.6, 1.2), R.range(-0.3, 0.3)], [1, 0.75, 0.3, 1], -1.5, 2);
    if (Math.random() < 0.35 * k) add([x + R.range(-0.1, 0.1), y + 1.1, z], [R.range(-0.15, 0.15) + 0.25, R.range(0.9, 1.3), R.range(-0.15, 0.15)], [0.42, 0.4, 0.42, 0.42], 1.0, 4);
  };
  function tent(m, x, y, z, ry, col, open) {
    m.at(x, y, z, ry, () => {
      m.face([[-1.3, 0, 1.4], [0, 1.7, 1.4], [0, 1.7, -1.4], [-1.3, 0, -1.4]], V.norm([-1.7, 1.3, 0]), col);
      m.face([[0, 1.7, 1.4], [1.3, 0, 1.4], [1.3, 0, -1.4], [0, 1.7, -1.4]], V.norm([1.7, 1.3, 0]), shadeHex(col, -0.1));
      m.face([[1.3, 0, -1.4], [-1.3, 0, -1.4], [0, 1.7, -1.4]], [0, 0, -1], shadeHex(col, -0.18));
      m.face([[-1.3, 0, 1.4], [1.3, 0, 1.4], [0, 1.7, 1.4]], [0, 0, 1], open ? '#1e140c' : shadeHex(col, -0.05));
      if (open) m.face([[0, 1.7, 1.42], [0.75, 0, 1.42], [0.2, 0, 1.9]], [0.3, 0.2, 1], shadeHex(col, 0.04));
      m.box(0, 0, 1.55, 0.06, 1.85, 0.06, '#5a3a22'); m.box(0, 0, -1.55, 0.06, 1.85, 0.06, '#5a3a22');
    });
  }
  function bedroll(m, x, y, z, ry, col) { m.at(x, y, z, ry, () => { m.box(0, 0, 0, 0.8, 0.18, 2, col); m.box(0, 0.05, -0.85, 0.7, 0.2, 0.32, '#d8c8a8'); m.box(0, 0.17, 0.15, 0.78, 0.04, 0.04, '#3a2414'); }); }
  function crate(m, x, y, z, ry, s, col) { m.at(x, y, z, ry, () => { m.box(0, 0, 0, s, s, s, col || '#8a6a40'); m.box(0, s * 0.45, s / 2 + 0.005, s, 0.06, 0.01, shadeHex(col || '#8a6a40', -0.2)); m.box(s / 2 + 0.005, s * 0.45, 0, 0.01, 0.06, s, shadeHex(col || '#8a6a40', -0.2)); }); }
  function barrel(m, x, y, z, col) { m.cyl(x, y, z, 0.38, 0.95, 9, col || '#7a5432', 'y', '#5a3a22'); for (const h of [0.15, 0.78]) m.cyl(x, y + h, z, 0.4, 0.06, 9, '#3a3a3a', 'y', false); }
  function deadTree(m, R, x, y, z, s) {
    const c = '#5a4a3a';
    m.box(x, y, z, 0.35 * s, 3 * s, 0.35 * s, c);
    for (let k = 0; k < 5; k++) m.at(x, y + (1.6 + k * 0.35) * s, z, R.range(0, TAU), () => { m.T = M4.mul(m.T, M4.rz(R.range(0.5, 1.1))); m.box(0, 0, 0, 0.12 * s, R.range(0.9, 1.6) * s, 0.12 * s, c); });
  }
  /* kar yüklü çam: dallarda beyaz örtü */
  function snowPine(m, x, y, z, s) {
    m.box(x, y, z, 0.4 * s, 1.4 * s, 0.4 * s, '#4a3020');
    for (const [yy, r, h] of [[1, 2, 3.2], [2.8, 1.5, 2.6], [4.4, 1, 2]]) { m.cone(x, y + yy * s, z, r * s, h * s, 7, '#2a4232'); m.cone(x, y + (yy + h * 0.45) * s, z, r * 0.62 * s, h * 0.5 * s, 7, '#e8eef4'); }
  }
  /* kütük kulübe: üst üste yatay kütükler, kar örtülü çatı */
  function logCabin(m, R, x, y, z, ry, w, d, h, snow) {
    m.at(x, y, z, ry, () => {
      const lc = ['#6a4a30', '#5e4229', '#735036'];
      for (let k = 0; k < h / 0.36; k++) { const yy = k * 0.36 + 0.18, c = lc[k % 3];
        m.cyl(-w / 2 - 0.2, yy, d / 2, 0.19, w + 0.4, 7, c, 'x', '#b08a5a'); m.cyl(-w / 2 - 0.2, yy, -d / 2, 0.19, w + 0.4, 7, c, 'x', '#b08a5a');
        m.cyl(w / 2, yy + 0.18, -d / 2 - 0.2, 0.19, d + 0.4, 7, c, 'z', '#b08a5a'); m.cyl(-w / 2, yy + 0.18, -d / 2 - 0.2, 0.19, d + 0.4, 7, c, 'z', '#b08a5a'); }
      m.box(0, 0, 0, w - 0.2, h, d - 0.2, '#4a3422');
      m.roof(0, h, 0, w + 0.6, 1.8, d, snow ? '#e4eaf0' : '#5a4030', 0.6);
      m.box(0, 0.05, d / 2 + 0.06, 1.0, 1.95, 0.08, '#3a2616');                            // kapı
      m.box(-w / 4 - 0.4, 1.0, d / 2 + 0.06, 0.8, 0.7, 0.06, '#2a3a44');                    // pencere (içi karanlık)
      m.box(w / 2 - 0.9, 0, -d / 2 + 0.6, 0.9, h + 2.4, 0.9, '#6a6260');                   // taş baca
      if (snow) m.box(w / 2 - 0.9, h + 2.4, -d / 2 + 0.6, 1.0, 0.18, 1.0, '#eef2f6');
      m.box(0, 0, d / 2 + 1.1, w + 0.6, 0.2, 2, '#5a4430');                                // sundurma
    });
  }
  /* üstü örtülü yük arabası (aile arabası) */
  function wagonMesh(L, look2) {
    const w = new Mesh(L);
    w.box(0, 0.9, 0, 1.9, 0.7, 3.4, '#7a5436'); w.box(0, 1.6, -0.2, 1.8, 0.1, 3.0, '#5a3a22');
    for (let k = 0; k < 6; k++) { const a0 = k / 6 * Math.PI, a1 = (k + 1) / 6 * Math.PI; w.face([[Math.cos(a0), 1.6 + Math.sin(a0) * 1.3, -1.5], [Math.cos(a1), 1.6 + Math.sin(a1) * 1.3, -1.5], [Math.cos(a1), 1.6 + Math.sin(a1) * 1.3, 1.1], [Math.cos(a0), 1.6 + Math.sin(a0) * 1.3, 1.1]], [Math.cos((a0 + a1) / 2), Math.sin((a0 + a1) / 2), 0], k % 2 ? '#e8e0cc' : '#ddd4bc'); }
    for (const zz of [-1.5, 1.1]) for (let k = 0; k < 6; k++) { const a0 = k / 6 * Math.PI, a1 = (k + 1) / 6 * Math.PI; w.face([[0, 1.6, zz], [Math.cos(a0), 1.6 + Math.sin(a0) * 1.3, zz], [Math.cos(a1), 1.6 + Math.sin(a1) * 1.3, zz]], [0, 0, zz > 0 ? 1 : -1], zz > 0 ? '#2a1e14' : '#d0c8b0'); }
    w.box(0, 1.6, 1.4, 1.5, 0.5, 0.6, '#5a3a22');
    w.box(-0.8, 1.4, -1.6, 0.5, 0.5, 0.5, '#8a6a40'); w.cyl(0.75, 1.4, -1.7, 0.25, 0.6, 8, '#6a4a2a');      // arkada sandık, fıçı
    w.box(0, 0.8, 3.1, 0.1, 0.1, 2.8, '#4a3020');
    if (look2) for (const [lk, sx] of look2) K.rider(w, lk, sx, 1.95, 1.35, true);
    return w;
  }
  function wheelMesh(L) { const wh = new Mesh(L); wh.cyl(-0.1, 0, 0, 0.62, 0.2, 12, '#5a3a22', 'x', '#8a6a44'); for (let k = 0; k < 4; k++) wh.at(0, 0, 0, 0, () => { wh.T = M4.mul(wh.T, M4.rx(k * Math.PI / 4)); wh.box(0.05, -0.6, 0, 0.08, 1.2, 0.08, '#3a2616'); }); return wh; }
  function drawWagon(D, WB, WH, HP, x, y, z, ang, t, speed) {
    const base = M4.chain(M4.tr(x, y, z), M4.ry(ang));
    D.push([K.blob(), M4.chain(M4.tr(x, y + 0.05, z), M4.ry(ang), SC(1.6, 1, 2.6)), 0.3]);
    D.push([WB, base]);
    for (const [wx, wz] of [[1.05, 1.1], [-1.05, 1.1], [1.05, -1.1], [-1.05, -1.1]]) D.push([WH, M4.chain(base, M4.tr(wx, 0.62, wz), M4.ry(wx > 0 ? 0 : Math.PI), M4.rx(t * speed * 1.6 * (wx > 0 ? 1 : -1)))]);
    const fx = Math.sin(ang), fz = Math.cos(ang);
    for (const s of [-1, 1]) { const ox = Math.cos(ang) * s * 0.55, oz = -Math.sin(ang) * s * 0.55; K.drawHorse(D, HP, x + fx * 4.6 + ox, y, z + fz * 4.6 + oz, ang, t * speed * 2.4 + (s > 0 ? 0 : 1.3), false); }
  }
  /* martı: iki kanat çırpar */
  function gullParts(L) { const b = new Mesh(L), w = new Mesh(L); b.box(0, 0, 0, 0.14, 0.12, 0.5, '#f4f4f0'); b.box(0, 0.02, 0.28, 0.05, 0.04, 0.1, '#e0a030'); w.box(0.35, 0, 0, 0.7, 0.03, 0.22, '#e8e8e4'); w.box(0.68, 0, -0.02, 0.1, 0.03, 0.18, '#2a2a2a'); return { b: K.build(b), w: K.build(w) }; }
  function drawGull(D, G, x, y, z, ang, t) { const base = M4.chain(M4.tr(x, y, z), M4.ry(ang)), f = Math.sin(t * 9) * 0.6; D.push([G.b, base]); D.push([G.w, M4.chain(base, M4.rz(f))]); D.push([G.w, M4.chain(base, M4.ry(Math.PI), M4.rz(f))]); }

  /* ortak gök/ışık kurulumu */
  function scene(L, sky, fog, fogD, extra) { return Object.assign({ L, static: [], sky, fog, fogD }, extra || {}); }
  function done(S, meshes) { for (const m of meshes) if (m && m.v.length) S.static.push(K.build(m)); return S; }

  /* =================== Çiftçi Çocuğu: kaybedilen toprak =================== */
  Cinema.addScene('farm', (R, look, o) => {
    o = o || {};
    const L = LIGHT([0.9, 0.24, 0.22], 0.52, 0.85, '#a8b0d0', '#ffc890');
    const m = new Mesh(L), g = new Mesh(GLOW);
    const RZ = 16;   // yol: x ekseni boyunca
    const hf = (x, z) => { const h = Math.sin(x * 0.018) * Math.cos(z * 0.021) * 6 + Math.sin(x * 0.05 + z * 0.03) * 1.4 + Math.max(0, -z - 80) * 0.05; return h * Math.min(1, Math.abs(z - RZ) / 16) * flatW(x, z, -40, 46, -34, 30, 30); };
    const field = (x, z) => x > 9 && x < 44 && z > -30 && z < 8;
    const plains = ground(['#9a8a4a', '#b0965a', '#c4a466', '#b89c5c', '#a89a58']);
    m.terrain(-330, -260, 330, 280, 5, hf, (x, z) => {
      if (Math.abs(z - RZ) < 2.4) return hash2(x | 0, 1, 2) < 0.5 ? '#9a7c56' : '#93764f';
      if (field(x, z)) return ((x * 0.6) | 0) % 2 ? '#7a5a3a' : '#8a6844';
      return plains(x, z);
    });
    // kurumuş mısır tarlası
    for (let x = 10; x < 43; x += 1.5) for (let z = -29; z < 7; z += 1.1) {
      if (hash2(x * 10 | 0, z * 10 | 0, 3) < 0.25) continue;
      const xx = x + R.range(-0.2, 0.2), zz = z + R.range(-0.2, 0.2), h = R.range(0.5, 1.5), lean = R.range(-0.35, 0.35);
      m.at(xx, hf(xx, zz), zz, R.range(0, TAU), () => { m.T = M4.mul(m.T, M4.rz(lean)); m.box(0, 0, 0, 0.06, h, 0.06, '#b8a060'); m.face([[0, h * 0.6, 0], [0.45, h * 0.35, 0.05], [0.05, h * 0.5, 0]], [0, 0, 1], '#a89050'); });
    }
    // ev: kapısına tahta çakılmış, bacası sönük
    m.at(-6, 0, 0, 0, () => {
      m.box(0, 0, 0, 8.5, 3.4, 6, '#9a8a70'); m.roof(0, 3.4, 0, 8.5, 2, 6, '#5a4a40', 0.5);
      for (let k = 0; k < 9; k++) m.box(-4.2 + k * 1.05, 0, 3.01, 0.04, 3.4, 0.02, '#8a7a62');
      m.box(0, 0, 4.2, 8.5, 0.22, 2.2, '#7a6a52'); m.box(0, 2.9, 4.3, 8.9, 0.18, 2.5, '#5a4a40');
      for (const sx of [-4, -1.3, 1.3, 4]) m.box(sx, 0, 5.2, 0.2, 2.9, 0.2, '#5a4a3a');
      m.box(0, 0.2, 3.05, 1.1, 2.1, 0.08, '#3a2c20');
      for (const r of [0.5, -0.5]) m.at(0, 1.25, 3.12, 0, () => { m.T = M4.mul(m.T, M4.rz(r)); m.box(0, 0, 0, 1.5, 0.14, 0.05, '#a89070'); });   // çapraz tahtalar
      for (const sx of [-2.6, 2.6]) { m.box(sx, 1.2, 3.04, 1.2, 1.0, 0.06, '#2a3038'); m.box(sx, 1.55, 3.1, 1.3, 0.14, 0.04, '#a89070'); m.box(sx, 1.25, 3.1, 1.3, 0.14, 0.04, '#a89070'); }
      m.box(3.2, 0, -1.4, 0.9, 6, 0.9, '#6a5a4a');
      m.box(-3, 0.25, 5.4, 1.4, 0.45, 0.6, '#6a5a44');                                     // verandada sandık
    });
    // ahır: kapısı açık, içi boş
    m.at(-21, 0, -7, 0.12, () => { m.box(0, 0, 0, 7, 5, 9, '#7a3a2a'); m.roof(0, 5, 0, 7, 2.6, 9, '#4a2e26', 0.4); m.box(0, 0, 4.52, 3, 3.6, 0.06, '#140c08'); m.at(1.6, 0, 4.6, 0, () => { m.T = M4.mul(m.T, M4.ry(-1.1)); m.box(0.75, 0, 0, 1.5, 3.6, 0.1, '#6a2a20'); }); });
    // yel değirmeni: kanatlar duruyor
    m.at(13, 0, -12, 0, () => { for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) m.at(a * 0.55, 0, b * 0.55, 0, () => { m.T = M4.mul(m.T, M4.rz(-a * 0.05), M4.rx(b * 0.05)); m.box(0, 0, 0, 0.16, 9.2, 0.16, '#7a6a54'); });
      m.box(0, 9, 0.3, 0.4, 0.4, 0.7, '#5a4a3a'); m.box(0, 9.1, -1.1, 0.06, 0.9, 1.6, '#c8c0b0');
      for (let k = 0; k < 8; k++) m.at(0, 9.2, 0.75, 0, () => { m.T = M4.mul(m.T, M4.rz(k * Math.PI / 4 + 0.2)); m.box(0, 0, 0, 0.35, 2.4, 0.05, k === 3 ? '#8a8270' : '#d0c8b8'); }); });
    // kuru yalak, el arabası, boş kümes
    m.box(-1.5, 0, 9, 2.4, 0.6, 0.8, '#6a5440'); m.box(-1.5, 0.45, 9, 2.2, 0.08, 0.6, '#5a4a38');
    m.at(-12, 0, 8, 0.6, () => { m.box(0, 0.35, 0, 0.9, 0.35, 1.3, '#6a5a44'); m.cyl(-0.05, 0.25, 0.8, 0.25, 0.1, 8, '#4a3a2a', 'x'); m.box(-0.3, 0.3, -1, 0.06, 0.06, 0.9, '#4a3a2a'); m.box(0.3, 0.3, -1, 0.06, 0.06, 0.9, '#4a3a2a'); });
    m.at(5, 0, 2, -0.3, () => { m.box(0, 0.4, 0, 2.6, 1.4, 2, '#8a7a5a'); m.roof(0, 1.8, 0, 2.6, 0.7, 2, '#5a4a3a', 0.2); m.box(0.6, 0.45, 1.01, 0.5, 0.5, 0.02, '#140c08'); });
    // yol boyunca çit; kapı aralık, direğinde bankanın ilanı
    for (let x = -36; x <= 40; x += 2.2) { if (x > 1 && x < 6) continue; const y = hf(x, 13); m.box(x, y, 13, 0.16, 1.2, 0.16, '#6a5038'); if (!(x > -1 && x < 6)) m.box(x + 1.1, y + 0.85, 13, 2.2, 0.1, 0.08, '#7a5a3a'); m.box(x + 1.1, y + 0.45, 13, 2.2, 0.1, 0.08, '#7a5a3a'); }
    for (const gx of [1.8, 5.2]) m.box(gx, 0, 13, 0.24, 1.75, 0.24, '#5a4030');
    m.at(1.9, 0, 13, 0, () => { m.T = M4.mul(m.T, M4.ry(0.9)); for (const yy of [0.35, 0.75, 1.15]) m.box(0, yy, 1.5, 0.08, 0.12, 3.0, '#8a6a48'); m.box(0, 0.3, 2.9, 0.1, 1.0, 0.1, '#6a5038'); });
    // ilan kâğıdı: doğuya bakan yüzde, sabah güneşinde
    m.box(5.34, 0.78, 13, 0.02, 0.58, 0.44, '#efe6cc');
    for (let k = 0; k < 6; k++) m.box(5.355, 1.24 - k * 0.07, 13 + (k === 0 ? 0 : 0.02), 0.01, 0.025, k === 0 ? 0.3 : 0.34 - (k % 2) * 0.08, '#3a3028');
    m.cyl(5.355, 0.92, 12.9, 0.05, 0.01, 8, '#a8281e', 'x'); m.box(5.36, 1.33, 13, 0.02, 0.04, 0.04, '#8a8a8a');      // mühür, çivi
    for (let k = 0; k < 5; k++) m.box(5.4, 0.62 - k * 0.07, 13.24, 0.06, 0.05, 0.07, '#6a6a70');                        // zincir
    m.box(5.42, 0.26, 13.24, 0.12, 0.14, 0.1, '#5a5a60');                                                               // asma kilit
    deadTree(m, R, 9, hf(9, 18.5), 18.5, 1.3);
    // uzak: Harlow batıda, yolun sonunda; çevrede ağaç, dağ
    m.at(-150, hf(-150, RZ), RZ, Math.PI / 2, () => K.town(m, R, 0, -22, 26, { street: 6, gable: 0.4, tower: false }));
    for (let k = 0; k < 40; k++) { const x = R.range(-300, 300), z = R.range(-240, 260); if ((Math.abs(z - RZ) < 10) || (x > -45 && x < 50 && z > -40 && z < 30) || (x < -120 && x > -190 && Math.abs(z - RZ) < 40)) continue; K.tree(m, x, z, hf(x, z), R.range(0.9, 1.5), R.chance(0.5) ? 'dry' : 'oak', R); }
    for (let k = 0; k < 7; k++) K.mountain(m, -420 + k * 140 + R.range(-30, 30), -320 - R.range(0, 90), R.range(90, 130), R.range(45, 80), '#8a90a0', '#e8ecf0');
    K.tufts(m, R, 900, -40, -10, 40, 30, hf, ['#b8a060', '#a89450', '#c8b070', '#8a8a48'], (x, z) => Math.abs(z - RZ) < 2.6 || field(x, z) || (x > -11 && x < -1 && z > -4 && z < 6), 1.1);
    for (let k = 0; k < 14; k++) { const x = R.range(-40, 40), z = R.range(21, 42); K.rock(m, R, x, hf(x, z), z, R.range(0.3, 0.8), '#8a7a62'); }
    const S = scene(L, { top: '#4a6ea8', hor: '#f8c890', sun: [0.95, 0.12, 0.25], sunC: '#ffe0a8', sunR: 0.06 }, '#e8c8a0', 0.0042, { fogH: 3, shadowC: [0, 0, 6], shadowR: 70, shadowN: 22 });
    S.grade = { lift: [0.04, 0.02, 0.01], gain: [1.08, 1.0, 0.9], sat: 1.04, con: 1.08 };
    S.cloud = 0.4; S.cloudC = '#ffe0c8';
    done(S, [m, g]);
    // aile, araba, atlar; oyuncu ve atı
    const fa = kinLook(look, 'm', R), mo = kinLook(look, 'f', R);
    const WB = K.build(wagonMesh(L, [[fa, 0.42], [mo, -0.42]])), WH = K.build(wheelMesh(L)), WHP = K.horseParts(L, '#5a4030', null);
    const arm = armMesh(L, mo);
    const PW = walker(L, look), hcol = o.horseCol || '#6a4a2e';
    const HP = K.horseParts(L, hcol, null), HR = K.horseParts(L, hcol, look);
    const wx = (t) => 8 + Math.max(0, t - 3.2) * 2.3;
    const T1 = 4.4, T2 = 10.2;
    const px = (t) => 1.8 - Math.max(0, t - T2) * 3.4;
    S.dyn = (t, D) => {
      const x = wx(t);
      drawWagon(D, WB, WH, WHP, x, hf(x, RZ + 1), RZ + 1, Math.PI / 2, t, t > 3.2 ? 1 : 0);
      // anne el sallar (arabanın solunda, oyuncuya dönük)
      if (t > 5.4) D.push([arm, M4.chain(M4.tr(x + 1.35, hf(x, RZ + 1) + 1.95 + 0.72, RZ + 1 - 0.42 - 0.3), M4.ry(Math.PI / 2), M4.rz(-0.15), M4.rx(-2.5 + Math.sin(t * 6) * 0.35))]);
      if (t < T2) { drawWalker(D, PW, 3.6, 0, 14.6, Math.PI / 2 - 0.15, 0, 0); K.drawHorse(D, HP, 0.6, 0, 15.6, Math.PI / 2 + 0.3, t * 0.4, false); S.focus = t < T1 ? [5.2, 1, 13] : [4, 1, 15]; }
      else { const p = px(t); K.drawHorse(D, HR, p, hf(p, RZ), RZ - 0.3, -Math.PI / 2, (t - T2) * 7, false); S.focus = [p, 1, RZ]; }
    };
    S.shots = [
      // yakın: kapı direğindeki banka ilanı, zincir ve kilit
      { d: T1, cam: (t, u) => ({ e: [6.9 - u * 0.5, 1.1 + u * 0.08, 13.7 - u * 0.25], c: [5.3, 0.95, 13.02], shake: 0.006 }) },
      // omuz üstünden: aile arabası doğan güneşe doğru gider
      { d: T2 - T1, cam: (t, u) => { const x = wx(t); return { e: [0.9 + u * 0.4, 1.9, 15.9 + u * 0.2], c: [Math.min(x, 30), 1.6, RZ + 0.4], shake: 0.01 }; } },
      // geniş: oyuncu batıya, Harlow'a sürer; vinç yükselip boş çiftliği ve ovayı gösterir
      { d: 6.2, cam: (t, u) => { const p = px(t), k = ease(u); return { e: V.lerp([p - 7.5, 1.5, RZ + 3.6], [p + 8, 7, RZ + 12], k), c: V.lerp([p + 0.4, 1.9, RZ], [p - 30, -1, RZ - 2], ease(cl01((u - 0.3) / 0.7))) }; } },
    ];
    S.capAt = T2 + 0.8; S.lineAt = 0.9;
    S.cap = { n: Tr('Harlow Ovaları'), s: Tr('Toprak gitti. Ova kaldı.') };
    S.particles = (t, add) => {
      if (Math.random() < 0.5) add([R.range(-6, 12), R.range(0.3, 2.5), R.range(10, 20)], [R.range(0.3, 0.8), R.range(-0.05, 0.1), R.range(-0.1, 0.1)], [1, 0.92, 0.75, 0.5], -1, 3);   // güneşte uçuşan toz
      if (t > 3.2) { const x = wx(t); if (Math.random() < 0.7) add([x - 1.6 + R.range(-0.6, 0.6), 0.2, RZ + 1 + R.range(-0.8, 0.8)], [R.range(-1.2, -0.3), R.range(0.2, 0.7), R.range(-0.3, 0.3)], [0.82, 0.68, 0.5, 0.55], 1.4, 1.8); }
      if (t > T2) { const p = px(t); if (Math.random() < 0.6) add([p + 0.8, 0.2, RZ + R.range(-0.4, 0.4)], [R.range(0.5, 1.5), R.range(0.2, 0.6), R.range(-0.3, 0.3)], [0.82, 0.68, 0.5, 0.5], 1.1, 1.4); }
    };
    return S;
  });

  /* =================== Kanun Kaçağı: saklı kampta şafak =================== */
  Cinema.addScene('outlaw', (R, look, o) => {
    o = o || {};
    const L = LIGHT([0.92, 0.2, -0.3], 0.52, 0.9, '#9a88b0', '#ffb070');
    const m = new Mesh(L), g = new Mesh(GLOW);
    // kaya cebi: kamp çukurda, doğuya (güneşe ve kasabaya) açık
    const hf = (x, z) => { const r = Math.hypot(x, z), a = Math.atan2(z, x), open = Math.max(0, Math.cos(a)) ** 3;
      const wall = Math.max(0, r - 16) * 0.55 * (1 - open * 0.92); return Math.min(wall, 14) + (Math.sin(x * 0.04 + z * 0.03) * 2 + Math.sin(z * 0.07) * 0.8) * flatW(x, z, -14, 14, -14, 14, 20); };
    const sand = ground(['#a85a38', '#c0703f', '#cc8048', '#b86a40', '#d08a52'], 0.035, 21);
    m.terrain(-300, -260, 340, 260, 5, hf, (x, z) => hf(x, z) > 5 ? (hash2(x | 0, z | 0, 3) < 0.5 ? '#9a4a30' : '#a85634') : sand(x, z));
    // kaya duvarları ve sütunlar
    for (let k = 0; k < 8; k++) { const a = R.range(1.2, TAU - 1.2), r = R.range(10, 14), x = Math.cos(a) * r, z = Math.sin(a) * r, sz = R.range(0.8, 1.6); K.rock(m, R, x, hf(x, z), z, sz, R.pick(['#b8603a', '#a85634', '#c0703f'])); }
    for (let k = 0; k < 9; k++) { const s = k % 2 ? 1 : -1; K.mesa(m, R.range(-260, 120), s * R.range(70, 220), R.range(30, 70), R.range(25, 55), R.range(18, 40), R); }
    for (let k = 0; k < 40; k++) { const x = R.range(-150, 260), z = R.range(-200, 200); if (Math.hypot(x, z) < 20) continue; K.tree(m, x, z, hf(x, z), R.range(0.8, 1.4), R.chance(0.6) ? 'saguaro' : 'dry', R); }
    K.tufts(m, R, 500, -24, -24, 40, 24, hf, ['#8a7a48', '#9a8a50', '#7a6a40'], (x, z) => Math.hypot(x, z) < 3.2, 0.9);
    // kamp
    campfire(m, g, 0, 0, 0);
    m.cyl(0.55, 0.1, -0.35, 0.17, 0.42, 8, '#4a4a50', 'y', '#3a3a40'); m.box(0.8, 0.3, -0.35, 0.22, 0.05, 0.05, '#4a4a50'); m.box(0.55, 0.55, -0.35, 0.05, 0.08, 0.05, '#2a2a2a');   // cezve
    for (const [x, z] of [[-0.9, 0.9], [0.95, 0.75]]) m.cyl(x, 0.05, z, 0.07, 0.13, 6, '#7a7a80', 'y', '#2a2016');
    m.at(-1.75, 0, 0.2, Math.PI / 2, () => m.box(0, 0, 0, 0.55, 0.42, 2.2, '#5a3a22'));                // kütük
    if (o.story) sit(m, o.sully || randomLook('m', R), -1.75, 0, 0.2, Math.PI / 2, 'cup');
    tent(m, -3.4, 0, -4.2, 0.5, '#b8a888', true);
    bedroll(m, -1.4, 0.02, 3.6, 0.3, '#3a4a5a');                                                            // Vance'in boş yatağı
    m.at(-2.6, 0.05, 3.4, 0.4, () => { m.box(0, 0, 0, 0.7, 0.35, 0.9, '#5a3a20'); m.box(0, 0.35, -0.35, 0.5, 0.18, 0.15, '#4a2e18'); });   // yerde eyer
    m.at(4.2, 0, -5.2, 0, () => { m.T = M4.mul(m.T, M4.rz(0.25)); m.box(0, 0, 0, 0.08, 1.15, 0.06, '#3a2a1a'); m.box(0, 0.75, 0, 0.06, 0.4, 0.05, '#4a4a50'); });  // kayaya dayalı tüfek
    crate(m, 2.6, 0, -2.4, 0.3, 0.6, '#7a5a38'); crate(m, 2.9, 0.6, -2.3, 0.6, 0.45, '#6a4a30');
    for (const x of [5.5, 10]) m.box(x, 0, -3.5, 0.16, 1.4, 0.16, '#5a3a22');
    m.box(7.75, 1.2, -3.5, 4.5, 0.04, 0.04, '#8a7a5a');                                                      // at ipi
    // uzakta, gün doğumunun önünde Dust Creek
    m.at(210, hf(210, -40), -40, -Math.PI / 2, () => K.town(m, R, 0, -24, 24, { street: 6, gable: 0.1, church: false }));
    const S = scene(L, { top: '#3a3a6a', hor: '#f4a060', sun: [0.95, 0.1, -0.3], sunC: '#ffd890', sunR: 0.065 }, '#e09a70', 0.0046, { fogH: 2, shadowC: [0, 0, 0], shadowR: 60, shadowN: 14 });
    S.grade = { lift: [0.05, 0.02, 0.05], gain: [1.1, 0.97, 0.88], sat: 1.1, con: 1.08 };
    S.cloud = 0.36; S.cloudC = '#f8b090';
    done(S, [m, g]);
    S.lights = [{ p: [0, 0.8, 0], c: '#ff8a3a', i: 1.0, r: 6, flick: true }];
    S.shadowK = 0.8;
    // oyuncu: yatakta doğrulur (gövde kalçadan döner); bacaklar battaniyenin altında
    const PX = 1.7, PZ = 2.4, fa = Math.atan2(-PX, -PZ);
    const tm = new Mesh(L); K.rider(tm, look, 0, 0, 0, false); const TB = K.build(tm);
    const bm = new Mesh(L); bm.box(0, 0, 0.55, 0.82, 0.22, 1.6, '#6a2a20'); bm.box(0, 0.02, -0.45, 0.8, 0.2, 0.5, '#5a2018'); bm.box(0, 0.04, -1.0, 0.7, 0.2, 0.34, '#d8c8a8'); const BB = K.build(bm);
    const hc = o.horseCol || '#8a5a3a', H1 = K.horseParts(L, hc, null), H2 = K.horseParts(L, '#5a4a3a', null);
    const T1 = 4.6, T2 = 9.4, up = (t) => kk(t, 5.2, 7.6);
    S.dyn = (t, D) => {
      const base = M4.chain(M4.tr(PX, 0, PZ), M4.ry(fa));
      D.push([BB, base]);
      const a = -Math.PI / 2 + up(t) * (Math.PI / 2 - 0.18);
      D.push([TB, M4.chain(base, M4.tr(0, 0.16, 0.1), M4.rx(a))]);
      K.drawHorse(D, H1, 6.6, 0, -4.4, 0.25 + Math.sin(t * 0.3) * 0.05, 0.3, false);
      K.drawHorse(D, H2, 9.1, 0, -4.6, -0.2, 1.4, false);
      S.focus = t < T2 ? [0.6, 0.8, 1.0] : [1, 1, 0];
    };
    const n = [Math.cos(fa), 0, -Math.sin(fa)], f = [Math.sin(fa), 0, Math.cos(fa)];
    S.shots = [
      // yerden, ateşin ve cezvenin hizasından; arkada Hollis (ya da boş kütük)
      { d: T1, cam: (t, u) => ({ e: [3.7 - u * 0.4, 1.3 + u * 0.08, -2.1 + u * 0.25], c: [-1.5, 0.95, 0.25], shake: 0.006 }) },
      // yanından: oyuncu uyku tulumunda doğrulur
      { d: T2 - T1, cam: (t, u) => ({ e: [PX + n[0] * 3.2 + f[0] * 0.6, 0.95 + u * 0.15, PZ + n[2] * 3.2 + f[2] * 0.6], c: [PX - f[0] * 0.1, 0.45 + up(t) * 0.4, PZ - f[2] * 0.1], shake: 0.008 }) },
      // vinç: kamp kaya cebinde, ötede gün doğumunda Dust Creek
      { d: 6, cam: (t, u) => { const k = ease(u); return { e: V.lerp([PX - f[0] * 2.6 + 0.6, 1.7, PZ - f[2] * 2.6 + 1.2], [-8.5, 6, 8.5], k), c: V.lerp([0, 0.9, 0], [30, -2.5, -6], ease(cl01((u - 0.25) / 0.75))) }; } },
    ];
    S.capAt = T2 + 0.7; S.lineAt = 1.0;
    S.cap = { n: Tr('Saklı Kamp'), s: Tr('Geçmişinden kaçılmaz. Ama denenebilir.') };
    S.particles = (t, add) => {
      fireP(R, add, 0, 0, 0, 1.2);
      if (Math.random() < 0.5) add([0.55 + R.range(-0.04, 0.04), 0.62, -0.35], [R.range(-0.1, 0.1), 0.6, 0.05], [0.92, 0.92, 0.95, 0.35], 0.35, 1.6);   // cezveden buhar
      if (Math.random() < 0.25) add([R.range(-10, 20), R.range(0.3, 3), R.range(-12, 12)], [R.range(0.2, 0.6), 0.05, 0], [1, 0.85, 0.7, 0.4], -1, 3);
    };
    return S;
  });

  /* =================== Göçmen: gemi Saint Clement'a yanaşır =================== */
  function shipMesh(L, look, R) {
    const sh = new Mesh(L), H = '#26262c';
    sh.box(0, 0, 0, 5.2, 2.6, 22, H, '#8a6a44'); sh.box(0, 0, 0, 5.3, 0.55, 22.1, '#8a2a20');
    sh.face([[-2.6, 0, 11], [2.6, 0, 11], [0, 0, 16]], [0, -1, 0], H); sh.face([[-2.6, 2.6, 11], [0, 2.6, 16], [2.6, 2.6, 11]], [0, 1, 0], '#8a6a44');
    sh.face([[-2.6, 0, 11], [0, 0, 16], [0, 2.6, 16], [-2.6, 2.6, 11]], V.norm([-1, 0, 0.5]), H); sh.face([[2.6, 0, 11], [2.6, 2.6, 11], [0, 2.6, 16], [0, 0, 16]], V.norm([1, 0, 0.5]), H);
    for (let k = -9; k <= 9; k += 1.6) for (const s2 of [-1, 1]) sh.cyl(s2 * 2.62, 1.6, k, 0.16, 0.04, 8, '#c8c0a8', 'x', '#2a2a30');   // lomboz
    for (const s2 of [-1, 1]) { sh.box(s2 * 2.5, 2.6, 0, 0.06, 0.8, 21, '#d8d0c0'); for (let k = -10; k <= 10; k += 1.2) sh.box(s2 * 2.5, 2.6, k, 0.08, 0.8, 0.08, '#d8d0c0'); }   // korkuluk
    sh.box(0, 2.6, -2, 3.8, 2.2, 9, '#e8e0d0', '#c8b890'); sh.box(0, 4.8, -1, 2.8, 1.4, 5, '#e8e0d0', '#8a6a44');
    for (let k = -5.5; k <= 1.5; k += 1.4) for (const s2 of [-1, 1]) sh.box(s2 * 1.91, 3.6, k, 0.02, 0.6, 0.8, '#3a4a5a');
    for (const z of [1.5, -3.5]) { sh.cyl(0, 4.8, z, 0.8, 5, 10, '#1a1a1a', 'y', '#101010'); sh.cyl(0, 8.5, z, 0.83, 0.8, 10, '#b0302a', 'y', false); }
    sh.box(0, 2.6, 9, 0.2, 9, 0.2, '#5a3a22'); sh.box(0, 2.6, -9.5, 0.2, 8, 0.2, '#5a3a22'); sh.box(0, 8, 9, 3, 0.12, 0.12, '#5a3a22');
    for (const s2 of [-1, 1]) sh.box(s2 * 1.4, 2.6, 9, 0.04, 6.5, 0.04, '#3a3a30');
    for (let k = 0; k < 7; k++) sh.at(R.range(-1.8, 1.8), 2.6, R.range(4, 9), R.range(0, TAU), () => { const c = R.pick(['#3a3a4a', '#5a3a2a', '#2a3a2a', '#6a5a4a']); sh.box(0, 0, 0, 0.4, 0.75, 0.28, c); sh.box(0, 0.78, 0, 0.26, 0.26, 0.26, R.pick(['#f2d3b3', '#e0b48c', '#c8956a'])); sh.box(0, 1.02, 0, 0.32, 0.08, 0.32, R.pick(['#2a2a2a', '#5a4a3a'])); });
    for (let k = 0; k < 5; k++) crate(sh, R.range(-1.6, 1.6), 2.6, R.range(-9, -6.5), R.range(0, 1), R.range(0.5, 0.8), '#8a6a40');
    return sh;
  }
  function boatMesh(L, col) { const b = new Mesh(L); b.box(0, -0.3, 0, 1.4, 0.7, 4, col); b.face([[-0.7, 0.4, 2], [0.7, 0.4, 2], [0, 0.4, 2.9]], [0, 1, 0], '#8a6a44'); b.face([[-0.7, -0.3, 2], [0, -0.3, 2.9], [0, 0.4, 2.9], [-0.7, 0.4, 2]], V.norm([-1, 0, 0.6]), col); b.face([[0.7, -0.3, 2], [0.7, 0.4, 2], [0, 0.4, 2.9], [0, -0.3, 2.9]], V.norm([1, 0, 0.6]), col); b.box(0, 0.4, 0, 0.12, 4, 0.12, '#5a3a22'); return b; }
  Cinema.addScene('immigrant', (R, look, o) => {
    o = o || {};
    const L = LIGHT([0.45, 0.55, 0.7], 0.58, 0.72, '#b8c8e0', '#fff0d8');
    const m = new Mesh(L), g = new Mesh(GLOW);
    const SH = -18;   // kıyı çizgisi
    const hf = (x, z) => { const sh = SH + Math.sin(x * 0.04) * 4; if (z > sh) return -2 - (z - sh) * 0.08; const d = sh - z; return Math.min(1.2, d * 0.3) + Math.max(0, d - 14) * 0.18 * (1 + Math.sin(x * 0.03) * 0.3) + Math.sin(x * 0.07 + z * 0.05) * 0.6 * Math.min(1, d / 10); };
    const grass = ground(['#6a8a48', '#7a9a50', '#86a458', '#70904a'], 0.04, 31);
    m.terrain(-300, -260, 300, -4, 4, hf, (x, z) => { const y = hf(x, z); return y < 0.4 ? '#c8b888' : y < 1.3 && z > SH - 6 ? '#b8a878' : grass(x, z); });
    // iskele: kıyıdan denize, kazıklar üstünde
    const PY = 1.0;
    m.box(0, PY - 0.25, 6, 4.4, 0.25, 50, '#8a6a48'); for (let z = -18; z < 31; z += 0.9) m.box(0, PY - 0.02, z, 4.4, 0.03, 0.05, '#6a4e34');
    for (let z = -16; z < 31; z += 4) for (const sx of [-2.1, 2.1]) { m.cyl(sx, -3, z, 0.18, PY + 2.6, 7, '#4a3424'); m.cyl(sx, PY, z, 0.2, 0.5, 7, '#3a2a1c', 'y', '#5a4434'); }
    for (const z of [2, 10, 18, 26]) m.cyl(2.0, PY, z, 0.16, 0.45, 7, '#2a2a2a', 'y', '#3a3a3a');                                 // babalar
    crate(m, -1.2, PY, -6, 0.2, 0.9); crate(m, -1.4, PY + 0.9, -5.9, 0.6, 0.6); crate(m, -0.9, PY, -4.9, 0.1, 0.7, '#7a5a3a'); barrel(m, 1.2, PY, -2, '#6a4a2a'); barrel(m, 1.4, PY, -1.1);
    for (let k = 0; k < 6; k++) m.box(-1.5 + R.range(-0.3, 0.3), PY, 2 + k * 0.7, 0.6, 0.35, 0.5, '#c8b890');                     // çuvallar
    // vinç direği
    m.at(-1.6, PY, 20, 0, () => { m.box(0, 0, 0, 0.3, 6, 0.3, '#5a3a22'); m.at(0, 5.6, 0, 0, () => { m.T = M4.mul(m.T, M4.rz(-1.1)); m.box(0, 0, 0, 0.2, 5, 0.2, '#6a4a2a'); }); m.box(2.8, 1.6, 0, 0.03, 3.4, 0.03, '#2a2a2a'); crate(m, 2.8, 1.0, 0, 0.3, 0.7); });
    // liman binaları ve tepedeki kasaba; Greta'nın pansiyonu iskelenin başında
    m.at(-12, hf(-12, -30), -30, 0, () => { m.box(0, 0, 0, 9, 7.6, 7, '#d8c8a8'); m.roof(0, 7.6, 0, 9, 2.4, 7, '#5a3a32', 0.4); m.box(0, 0, 3.6, 9.2, 0.25, 2.2, '#7a6a52'); m.box(0, 3.0, 3.7, 9.4, 0.2, 2.4, '#5a3a32');
      for (const sx of [-3, 0, 3]) for (const yy of [1.2, 4.2]) m.box(sx, yy, 3.51, 1.1, 1.3, 0.06, '#3a4a5a'); m.box(0, 0.2, 3.52, 1.2, 2.2, 0.06, '#4a2e1e');
      m.box(0, 6.2, 3.56, 5.4, 0.9, 0.08, '#2a3a4a'); m.box(0, 6.25, 3.6, 4.8, 0.7, 0.02, '#e8dcb8');
      for (let k = 0; k < 7; k++) m.box(-2.0 + k * 0.62, 6.5, 3.62, 0.36, 0.3, 0.01, '#2a2a3a'); });
    m.at(14, hf(14, -26), -26, 0, () => { m.box(0, 0, 0, 12, 5, 8, '#8a7a6a'); m.roof(0, 5, 0, 12, 2, 8, '#4a4a50', 0.3); m.box(0, 0, 4.02, 4, 3.6, 0.06, '#2a2016'); });   // ambar
    m.at(-6, hf(-6, -70), -70, 0, () => K.town(m, R, 0, -10, 40, { street: 7, gable: 0.4, tower: false }));
    // deniz feneri ve kayalık
    m.at(-58, 0, -14, 0, () => { for (let k = 0; k < 6; k++) K.rock(m, R, R.range(-4, 4), -1.2, R.range(-3, 3), R.range(1.5, 2.6), '#7a7a74'); m.cyl(0, 0.5, 0, 2.1, 14, 12, '#e8e0d8'); m.cyl(0, 5.5, 0, 2.15, 1.5, 12, '#b0302a', 'y', false); m.cyl(0, 10.5, 0, 2.15, 1.5, 12, '#b0302a', 'y', false); m.cyl(0, 14.5, 0, 1.4, 1.6, 10, '#3a3a3a'); m.cone(0, 16.1, 0, 1.9, 1.8, 10, '#a02a20'); });
    g.cyl(-58, 15.0, -14, 1.2, 1.0, 10, '#ffe8a0');
    for (let k = 0; k < 30; k++) { const x = R.range(-280, 280), z = R.range(-240, -50); if (Math.abs(x + 6) < 34 && z > -130) continue; K.tree(m, x, z, hf(x, z), R.range(1, 1.7), 'oak', R); }
    for (let k = 0; k < 5; k++) K.mountain(m, -380 + k * 170 + R.range(-30, 30), -330 - R.range(0, 60), R.range(100, 140), R.range(50, 85), '#7a8a98', '#eef2f4');
    K.tufts(m, R, 300, -60, -60, 60, -16, hf, ['#5a7a3a', '#6a8a44', '#7a9a50'], (x, z) => hf(x, z) < 0.6 || (Math.abs(x + 12) < 6 && Math.abs(z + 30) < 6), 1);
    const S = scene(L, { top: '#3a7ac0', hor: '#d8e8f0', sun: [0.45, 0.5, 0.75], sunC: '#fff8e8', sunR: 0.045 }, '#c8d8e4', 0.0032, { shadowC: [0, 0, 0], shadowR: 80, shadowN: 26 });
    S.water = { x0: -500, x1: 500, z0: -40, z1: 600, y: 0, deep: '#1a4458' };
    S.grade = { lift: [0, 0.01, 0.03], gain: [1.0, 1.0, 1.04], sat: 1.02, con: 1.05 };
    S.cloud = 0.48; S.cloudC = '#ffffff';
    done(S, [m, g]);
    const SB = K.build(shipMesh(L, look, R));
    // güvertede oyuncu, elinde mektup
    const pm = new Mesh(L); pm.at(0, 0, 0, 0, () => { for (const s2 of [-1, 1]) pm.box(s2 * 0.12, 0, 0, 0.16, 0.85, 0.2, look.pants); K.rider(pm, look, 0, 0.85, 0, false, 'reins'); pm.box(0, 1.2, 0.5, 0.3, 0.38, 0.02, '#efe6cc'); for (let k = 0; k < 4; k++) pm.box(0, 1.33 - k * 0.07, 0.512, 0.22, 0.02, 0.005, '#3a3a5a'); });
    const PB = K.build(pm), PW = walker(L, look);
    const gr = o.story ? walker(L, o.sully || randomLook('f', R)) : null;
    const workers = [0, 1, 2].map(() => walker(L, randomLook('m', R)));
    const boats = ['#5a6a7a', '#7a4a3a', '#4a5a4a'].map(c => K.build(boatMesh(L, c)));
    const GU = gullParts(L);
    const sz = (t) => 14 + 62 * Math.pow(1 - cl01(t / 9.2), 2), SX = 6.4;
    const T1 = 4.6, T2 = 9.4;
    const DY = 1.35, W0 = T2 + 0.4, W1 = W0 + 1.5, W2 = W1 + 3.4;
    const walkP = (t) => { if (t < W1) { const k = cl01((t - W0) / (W1 - W0)); return [SX - 1.9 - k * 2.5, DY + (PY - DY) * k + 0.02, 14]; } const k = cl01((t - W1) / (W2 - W1)); return [SX - 4.4 - k * 0.3, PY, 14 - k * 8.4]; };
    const plank = new Mesh(L); plank.at(SX - 3.15, (DY + PY) / 2 + 0.02, 14, 0, () => { plank.T = M4.mul(plank.T, M4.rz(Math.atan2(DY - PY, 2.5))); plank.box(0, 0, 0, 2.7, 0.08, 1.0, '#7a5a3a'); for (const s2 of [-0.5, 0.5]) plank.box(0, 0.08, s2, 2.7, 0.5, 0.04, '#5a3a22'); });
    const PLB = K.build(plank);
    S.dyn = (t, D) => {
      const z = sz(t), bob = Math.sin(t * 1.4) * 0.12;
      const sm = M4.chain(M4.tr(SX, -1.25 + bob, z), M4.ry(Math.PI), M4.rz(Math.sin(t * 1.1) * 0.02));
      D.push([SB, sm]);
      if (t < T2) D.push([PB, M4.chain(sm, M4.tr(1.9, 2.6, -3), M4.ry(-Math.PI / 2 - 0.35))]);
      else { const p = walkP(t), w = t > W0 && t < W2; drawWalker(D, PW, p[0], p[1], p[2], t < W1 ? -Math.PI / 2 : Math.PI, t * 7, w ? 1 : 0); }
      if (t > 8.8) D.push([PLB, M4.tr(0, 0, sz(t) - 14)]);
      if (gr) drawWalker(D, gr, 0.9, PY, 3.6, t < T2 ? Math.PI / 2 + 0.6 : 0.25, 0, 0);
      drawWalker(D, workers[0], 1.4 - Math.sin(t * 0.35) * 1.2, PY, 16 + Math.cos(t * 0.35) * 3, Math.cos(t * 0.35) > 0 ? Math.PI : 0, t * 6.5, 1);
      drawWalker(D, workers[1], -1.0, PY, -3 + ((t * 1.1) % 9), 0, t * 6.5, 1);
      drawWalker(D, workers[2], 1.1, PY, 24, -Math.PI / 2, 0, 0);
      [[-9, 22], [-13, 30], [12, 36]].forEach(([x, z], i) => D.push([boats[i], M4.chain(M4.tr(x, -0.05 + Math.sin(t * 1.3 + i) * 0.1, z), M4.ry(0.3 * i), M4.rz(Math.sin(t * 1.1 + i * 2) * 0.05))]));
      for (let k = 0; k < 5; k++) { const a = t * (0.25 + k * 0.05) + k * 1.3, r = 9 + k * 3; drawGull(D, GU, SX + Math.cos(a) * r, 9 + k * 1.3 + Math.sin(t + k) * 0.6, z - 4 + Math.sin(a) * r * 0.7, a + Math.PI, t + k); }
      S.focus = t < T1 ? [SX - 1.9, 2, z + 3] : t < T2 ? [SX - 2, 2, z] : walkP(t);
    };
    S.shots = [
      // güverteden omuz üstünden: elde mektup, karşıda liman ve tepedeki kasaba
      { d: T1, cam: (t, u) => { const z = sz(t); return { e: [SX - 2.25, 3.2 + Math.sin(t * 1.4) * 0.12, z + 5.6 - u * 0.4], c: [SX - 9, 2.4, z - 16 + u * 3], shake: 0.012 }; } },
      // iskeleden yan: gemi yanaşır, bacalardan duman; iskelede bekleyen kadın
      { d: T2 - T1, cam: (t, u) => { const z = sz(t); return { e: [-3.5 - u * 1.5, 2.6, 2 + u * 1.5], c: [SX * 0.6, 3, Math.max(z, 14) + 2] }; } },
      // iskelede alçaktan: oyuncu iskele tahtasından iner; vinç yükselir, pansiyon ve kasaba
      { d: 6.2, cam: (t, u) => { const p = walkP(t), k = ease(cl01((u - 0.45) / 0.55)); return { e: V.lerp([-1.1, PY + 1.7, -0.8], [5, 10, 9], k), c: V.lerp([p[0], p[1] + 1.1, p[2]], [-10, 4, -32], k) }; } },
    ];
    S.capAt = T2 + 0.8; S.lineAt = 0.8;
    S.cap = { s: Tr('Yeni bir dünya, yeni bir hayat.') };
    S.particles = (t, add) => {
      const z = sz(t);
      if (Math.random() < 0.55) for (const fz of [-1.5, 3.5]) add([SX + R.range(-0.3, 0.3), 9.6 - 1.25, z + fz], [R.range(-0.3, 0.3) + 0.4, 1.9, R.range(0.2, 0.8)], [0.28, 0.28, 0.3, 0.6], 1.6, 3);
      if (t > 3 && t < 3.6 && Math.random() < 0.9) add([SX, 8.2, z - 1], [R.range(-0.3, 0.3), 3.2, 0], [0.96, 0.96, 0.96, 0.7], 0.9, 1.4);      // düdük buharı
      if (z > 15 && Math.random() < 0.7) add([SX + R.range(-2.4, 2.4), 0.05, z - 15 + R.range(-1, 1)], [R.range(-1.5, 1.5), 0.2, 0], [0.95, 0.97, 1, 0.75], 0.7, 1.2);   // pruva köpüğü
    };
    return S;
  });

  /* =================== Demiryolu İşçisi: ray kampında sabah düdüğü =================== */
  function locoParts(L, g) {
    const lo = new Mesh(L);
    lo.cyl(0, 1.9, -3, 1.05, 6.2, 12, '#2a2a2e', 'z', '#1a1a1a'); lo.box(0, 0.6, 0, 2.2, 0.9, 9, '#1a1a1e');
    for (const z of [-1.6, 0.6, 2.4]) lo.cyl(0, 1.9, z, 1.08, 0.12, 12, '#a08040', 'z', false);                 // pirinç bantlar
    lo.box(0, 0.9, -4.6, 2.5, 3.4, 3, '#6a2a22', '#3a1a16'); lo.box(0, 4.3, -4.6, 2.8, 0.2, 3.4, '#2a2a2e');
    for (const s of [-1, 1]) lo.box(s * 1.26, 2.6, -4.2, 0.03, 0.9, 1.1, '#2a2a30');
    lo.cyl(0, 2.8, 2.2, 0.35, 2.1, 10, '#2a2a2e'); lo.cone(0, 4.9, 2.2, 0.75, -0.9, 10, '#2a2a2e'); lo.box(0, 4.7, 2.2, 1.4, 0.3, 1.4, '#2a2a2e');
    lo.cyl(0, 2.9, -0.8, 0.5, 0.9, 10, '#c8a040');
    lo.cyl(0, 4.5, -3.3, 0.09, 0.45, 8, '#d0a848', 'y', '#806020');                                               // düdük
    lo.box(0, 2.3, 3.4, 0.6, 0.6, 0.3, '#2a2a2e'); if (g) g.box(0, 2.35, 3.56, 0.4, 0.4, 0.02, '#fff0b0');           // fener
    lo.face([[-1.2, 0.2, 4.5], [1.2, 0.2, 4.5], [0, 0.2, 6]], [0, -1, 0], '#8a2a20'); lo.face([[-1.2, 0.2, 4.5], [0, 0.2, 6], [0, 1.4, 4.6]], V.norm([-1, 0.5, 1]), '#8a2a20'); lo.face([[1.2, 0.2, 4.5], [0, 1.4, 4.6], [0, 0.2, 6]], V.norm([1, 0.5, 1]), '#8a2a20');
    for (const z of [-3, -0.8, 1.4]) for (const s of [-1, 1]) lo.cyl(s * 1.1 - (s < 0 ? 0.2 : 0), 0.75, z, 0.72, 0.2, 12, '#8a2a20', 'x', '#3a1a16');
    lo.box(0, 1.0, 0, 2.3, 0.08, 7.5, '#3a3a3a');
    return lo;
  }
  function carMesh(L, kind) {
    const c = new Mesh(L);
    if (kind === 'flat') { c.box(0, 0.8, 0, 2.6, 0.3, 11, '#5a3e26'); for (let k = 0; k < 5; k++) c.box(R0(k) * 0.6, 1.1 + (k % 2) * 0.16, 0, 0.16, 0.16, 10, '#8a8a90'); for (let k = 0; k < 8; k++) c.box(0.6, 1.1, -4.4 + k * 1.2, 1.0, 0.18, 0.3, '#5a3e26'); }
    else { c.box(0, 0.8, 0, 2.6, 2.6, 11, kind === 'pass' ? '#3a5a3a' : '#6a3a22', '#3a2a22'); c.roof(0, 3.4, 0, 2.6, 0.5, 11, '#3a2a22', 0.15); for (let z = -4; z <= 4; z += 1.6) for (const s of [-1, 1]) c.box(s * 1.31, 2.1, z, 0.05, 0.7, 0.9, '#e8d890'); for (const z of [-5.6, 5.6]) c.box(0, 0.8, z, 2.0, 0.1, 0.6, '#3a2a22'); }
    for (const z of [-3.5, 3.5]) for (const s of [-1, 1]) c.cyl(s * 1.1 - (s < 0 ? 0.2 : 0), 0.45, z, 0.45, 0.2, 10, '#2a2a2e', 'x');
    return c;
  }
  const R0 = (k) => (k % 3) - 1;
  Cinema.addScene('rail', (R, look, o) => {
    o = o || {};
    const L = LIGHT([-0.88, 0.22, -0.4], 0.52, 0.85, '#a0a8c8', '#ffc898');
    const m = new Mesh(L), g = new Mesh(GLOW);
    const RE = -12, TZ = 170;   // ray başı; Fort Redstone istasyonu
    const hf = (x, z) => (Math.sin(x * 0.02) * Math.cos(z * 0.02) * 4 + Math.sin(x * 0.06 + z * 0.02) * 1) * Math.min(1, Math.abs(x) / 26) * flatW(x, z, -50, 40, -40, 30, 30) * flatW(x, z, -60, 12, TZ - 50, TZ + 70, 30);
    const prairie = ground(['#9a9048', '#b0a05a', '#a89a50', '#bcaa64', '#8a8a44'], 0.03, 41);
    m.terrain(-280, -220, 280, 380, 5, hf, (x, z) => Math.abs(x) < 2.2 && z > RE - 12 ? '#8a7a5a' : prairie(x, z));
    // ray yolu: traversler, raylar (ray başında biter), ötesi tesviye edilmiş toprak
    for (let z = RE - 8; z < 380; z += 1.15) m.box(0, 0.05, z, 2.8, 0.14, 0.32, z < RE ? '#7a5a36' : '#5a3e26');
    for (const s of [-1, 1]) m.box(s * 0.75, 0.19, (RE + 380) / 2, 0.12, 0.14, 380 - RE, '#8a8a92');
    for (let k = 0; k < 6; k++) m.box(-3.2 + (k % 2) * 0.2, 0.05 + k * 0.16, RE - 2, 0.16, 0.16, 9, '#8a8a92');                     // istif ray
    for (let k = 0; k < 5; k++) for (let j = 0; j < 3; j++) m.box(3.4 + j * 0.34, 0.05 + k * 0.16, RE - 3, 0.32, 0.16, 2.8, '#6a4a2e');   // istif travers
    m.at(-1.5, 0, RE - 6, 0.3, () => { m.box(0, 0.5, 0, 1.4, 0.15, 2.2, '#5a4a3a'); for (const z of [-0.8, 0.8]) for (const s2 of [-0.6, 0.6]) m.cyl(s2, 0.3, z, 0.3, 0.08, 8, '#3a3a3a', 'x'); m.box(0, 0.65, 0, 0.1, 0.9, 0.1, '#4a3a2a'); m.box(0, 1.5, 0, 1.4, 0.08, 0.08, '#4a3a2a'); });   // el arabası
    for (let z = 40; z < 380; z += 26) { m.box(4.2, 0, z, 0.25, 6, 0.25, '#5a3a22'); m.box(4.2, 5.4, z, 1.6, 0.15, 0.15, '#5a3a22'); }    // telgraf direkleri
    // kamp: çadırlar, ateş, masa, kazan
    for (const [x, z, a] of [[9, -2, 0.3], [12.5, -5.5, -0.2], [15.5, -1.5, 0.5]]) tent(m, x, 0, z, a, R.pick(['#c8b890', '#b8a880', '#d0c4a0']), true);
    campfire(m, g, 11.2, 0, 2.2);
    m.box(10.2, 0.0, 2.2, 0.1, 1.5, 0.1, '#3a2a1a'); m.box(12.2, 0, 2.2, 0.1, 1.5, 0.1, '#3a2a1a'); m.box(11.2, 1.45, 2.2, 2.1, 0.06, 0.06, '#3a2a1a'); m.cyl(11.2, 0.8, 2.2, 0.32, 0.45, 9, '#2a2a2a', 'y', '#3a2a1a');
    m.at(14, 0, 3.5, 0.2, () => { m.box(0, 0.75, 0, 2.4, 0.08, 1, '#7a5a3a'); for (const [a, b] of [[-1, -0.4], [1, -0.4], [-1, 0.4], [1, 0.4]]) m.box(a, 0, b, 0.1, 0.75, 0.1, '#5a3a22'); m.cyl(-0.6, 0.8, 0, 0.1, 0.12, 6, '#7a7a80'); m.cyl(0.3, 0.8, 0.1, 0.1, 0.12, 6, '#7a7a80'); });
    bedroll(m, 8.6, 0.02, 2.6, 1.2, '#5a3a2a'); barrel(m, 6.5, 0, -5.5, '#6a4a2a'); crate(m, 7.2, 0, -6.5, 0.3, 0.8);
    m.at(16, 0, 6, 0, () => { for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) m.box(a * 1.4, 0, b * 1.4, 0.3, 6, 0.3, '#5a3a22'); m.cyl(0, 6, 0, 2.2, 2.4, 12, '#7a5a3a', 'y', '#6a4a2a'); m.cone(0, 8.4, 0, 2.4, 1.1, 12, '#5a4030'); });   // su deposu
    // Fort Redstone: istasyon, peron, kasaba
    m.box(-4.4, 0, TZ, 4, 0.7, 40, '#7a5a3a');
    m.at(-10, 0, TZ, Math.PI / 2, () => { m.box(0, 0, 0, 16, 4.2, 7, '#7a6a50'); m.roof(0, 4.2, 0, 16, 1.6, 7, '#3a4a5a', 0.3); m.box(0, 2.5, 5.2, 18, 0.2, 3.4, '#3a4a5a'); for (const sx of [-7.5, -2.5, 2.5, 7.5]) m.box(sx, 0, 6.6, 0.18, 2.5, 0.18, '#4a3a2a'); m.box(0, 5.6, 3.6, 6, 0.9, 0.1, '#e0e0d0'); m.box(0, 0.2, 3.52, 1.2, 2.2, 0.06, '#3a2a1a'); });
    for (let k = 0; k < 4; k++) barrel(m, -3.2, 0.7, TZ - 12 + k * 0.8, '#6a4a2a');
    m.at(-40, 0, TZ, 0, () => K.town(m, R, 0, -30, 40, { street: 7 }));
    for (let k = 0; k < 30; k++) { const x = R.range(-250, 250), z = R.range(-200, 360); if (Math.abs(x) < 14 || (x < -15 && x > -75 && Math.abs(z - TZ) < 60) || (x > 4 && x < 22 && z > -12 && z < 12)) continue; K.tree(m, x, z, hf(x, z), R.range(0.9, 1.4), R.chance(0.4) ? 'dry' : 'oak', R); }
    for (let k = 0; k < 6; k++) K.mountain(m, -420 + k * 160, -360 - R.range(0, 80), R.range(110, 150), R.range(60, 95), '#8a92a0', '#eef0f2');
    K.tufts(m, R, 700, -20, -30, 30, 30, hf, ['#a89a50', '#b8aa60', '#8a8a44'], (x, z) => Math.abs(x) < 2.4 || (x > 9.5 && x < 13 && Math.abs(z - 2.2) < 1.6), 1);
    const S = scene(L, { top: '#4a68a0', hor: '#f0c8a0', sun: [-0.9, 0.12, -0.4], sunC: '#ffe0b0', sunR: 0.06 }, '#e0c8b0', 0.0045, { fogH: 3, shadowC: [6, 0, 0], shadowR: 70, shadowN: 20 });
    S.grade = { lift: [0.04, 0.02, 0.03], gain: [1.06, 0.99, 0.92], sat: 1.0, con: 1.07 };
    S.cloud = 0.42; S.cloudC = '#ffd8c0';
    done(S, [m, g]);
    S.lights = [{ p: [11.2, 0.9, 2.2], c: '#ff8a3a', i: 1.0, r: 6, flick: true }];
    const lg = new Mesh(GLOW), LB = K.build(locoParts(L, lg)), LG = K.build(lg), TB = K.build((() => { const t = new Mesh(L); t.box(0, 0.6, 0, 2.4, 2.2, 4.5, '#2a2a2e'); t.box(0, 2.8, 0, 2.2, 0.5, 4.2, '#1a1410'); return t; })());
    const FB = K.build(carMesh(L, 'flat')), PB = K.build(carMesh(L, 'pass')), BB = K.build(carMesh(L, 'box'));
    // ekip: Boone (ön planda, saat elinde), uyanan işçiler
    const boone = walker(L, o.story && o.sully ? o.sully : randomLook('m', R)), crew = [0, 1, 2].map(() => randomLook('m', R));
    const cm = new Mesh(L); stand(cm, crew[1], 13.6, 0, -0.6, -2.2, 'cup'); sit(cm, crew[2], 10.0, 0, 2.6, 1.2); const CB = K.build(cm);
    const mt = new Mesh(L); K.rider(mt, crew[0], 0, 0, 0, false); const MT = K.build(mt);
    const PW = walker(L, look);
    const LZ = 16, tz = (t) => TZ + 5 + 70 * Math.pow(1 - cl01((t - 8.6) / 5.4), 2);
    const T1 = 4.4, T2 = 9.2, up = (t) => kk(t, 5.4, 7.4);
    const step = (t) => cl01((t - 13.3) / 1.4);
    S.dyn = (t, D) => {
      // iş treni ray başında bekler
      D.push([LB, M4.chain(M4.tr(0, 0.2, LZ), M4.ry(Math.PI))]); D.push([LG, M4.chain(M4.tr(0, 0.2, LZ), M4.ry(Math.PI))]);
      D.push([TB, M4.tr(0, 0.2, LZ + 8.2)]); D.push([FB, M4.tr(0, 0.2, LZ + 15.5)]); D.push([FB, M4.tr(0, 0.2, LZ + 27)]);
      D.push([CB, M4.id()]);
      D.push([MT, M4.chain(M4.tr(8.6, 0.2, 2.6), M4.ry(1.2), M4.rx(-Math.PI / 2 + up(t) * (Math.PI / 2 - 0.2)))]);   // Mick yatağında doğrulur
      drawWalker(D, boone, 7.4, 0, -1.2, -0.9, 0, 0);
      // yolcu treni Fort Redstone'a girer; oyuncu vagondan perona iner
      const z = tz(t);
      D.push([LB, M4.chain(M4.tr(0, 0.2, z), M4.ry(Math.PI))]); D.push([LG, M4.chain(M4.tr(0, 0.2, z), M4.ry(Math.PI))]);
      D.push([TB, M4.tr(0, 0.2, z + 8.2)]); D.push([PB, M4.tr(0, 0.2, z + 15.5)]); D.push([BB, M4.tr(0, 0.2, z + 27)]);
      if (t > T2) { const k = step(t); drawWalker(D, PW, -1.45 - k * 1.6, 1.2 - k * 0.5, z + 10.2 - k * 0.4, -Math.PI / 2 - 0.3, t * 7, k > 0 && k < 1 ? 1 : 0); }
      S.focus = t < T1 ? [0, 3, LZ + 3] : t < T2 ? [9, 1, 0] : [-2, 1, z + 10];
    };
    S.shots = [
      // düdüğün dibinden: gün doğumunda buhar fışkırır
      { d: T1, cam: (t, u) => ({ e: [3.4 - u * 0.3, 4.4 + u * 0.15, LZ - 1.2 + u * 0.4], c: [0, 5.0, LZ + 3.3], shake: 0.01 }) },
      // kamp: Boone saatine bakar, ekip uyanır
      { d: T2 - T1, cam: (t, u) => ({ e: [4.4 - u * 0.4, 1.65, 1.6 + u * 0.3], c: [9.8, 1.1, 0.2], shake: 0.008 }) },
      // Fort Redstone: yolcu treni yanaşır, oyuncu iner; vinç kasabaya döner
      { d: 6.4, cam: (t, u) => { const z = tz(t), k = ease(cl01((u - 0.6) / 0.4)); return { e: V.lerp([-3.4, 2.1, TZ - 7], [8, 15, TZ - 16], k), c: V.lerp([-1.2, 1.8, z + 9], [-40, 2, TZ + 12], k) }; } },
    ];
    S.capAt = T2 + 0.8; S.lineAt = 0.6;
    S.cap = { s: Tr('Rayların sonu, hikâyenin başı.') };
    S.particles = (t, add) => {
      const wh = (t > 0.6 && t < 2.4) || (t > 3.0 && t < 3.7);
      if (wh) for (let k = 0; k < 3; k++) add([R.range(-0.05, 0.05), 4.95, LZ + 3.3], [R.range(-0.4, 0.4), R.range(4, 6), R.range(-0.3, 0.3)], [0.97, 0.97, 0.97, 0.85], 0.55, 1.1);
      if (Math.random() < 0.3) add([R.range(-0.2, 0.2), 5.2, LZ - 2.2], [R.range(-0.3, 0.3) + 0.3, 1.4, 0], [0.5, 0.5, 0.52, 0.5], 1.4, 3.5);
      fireP(R, add, 11.2, 0, 2.2, 0.8);
      const z = tz(t); if (t > 7 && Math.random() < 0.5) add([R.range(-0.2, 0.2), 5.2, z - 2.2], [R.range(-0.3, 0.3), 2.2, 1 + (z - TZ) * 0.05], [0.82, 0.82, 0.8, 0.6], 1.4, 2.6);
    };
    return S;
  });

  /* =================== Tuzakçı: karlı ormanda boş kulübe =================== */
  Cinema.addScene('trapper', (R, look, o) => {
    o = o || {};
    const L = LIGHT([0.35, 0.62, 0.55], 0.66, 0.42, '#b8c4d4', '#f4f0e8');
    const m = new Mesh(L);
    // açıklık kulübenin önünde; arazi güneydoğuya, vadideki kasabaya doğru iner
    const hf = (x, z) => (Math.sin(x * 0.05) * Math.cos(z * 0.04) * 2.2 + Math.sin(x * 0.11 + z * 0.07) * 0.6) * flatW(x, z, -12, 10, -8, 10, 14) - Math.max(0, z - 16) * 0.16 - Math.max(0, z - 90) * 0.12;
    const snow = ground(['#d0d8e4', '#dce4ee', '#e8eef4', '#f0f4f8'], 0.05, 51);
    const trail = (x, z) => z < 2 && Math.abs(z + 2 - (x + 8) * 0.15) < 1.2 && x < -6;
    m.terrain(-260, -220, 260, 320, 4, hf, (x, z) => trail(x, z) ? '#c4ccd8' : snow(x, z));
    logCabin(m, R, 0, 0, 0, 0, 7, 5.5, 2.9, true);
    // duvarda kapanlar, gergide boş post çerçevesi, kar örtülü odun yığını, kızak
    for (const [x, y] of [[-2.0, 1.9], [-1.4, 2.0], [2.2, 1.9]]) { m.cyl(x, y, 2.96, 0.2, 0.04, 8, '#3a3a3a', 'z', false); m.box(x, y + 0.2, 2.97, 0.03, 0.4, 0.02, '#4a4a4a'); }
    m.at(2.6, 0, 3.6, -0.2, () => { m.T = M4.mul(m.T, M4.rx(-0.25)); for (const sx of [-0.6, 0.6]) m.box(sx, 0, 0, 0.08, 1.8, 0.08, '#6a5038'); for (const yy of [0.2, 1.7]) m.box(0, yy, 0, 1.3, 0.07, 0.07, '#6a5038'); for (let k = 0; k < 5; k++) m.box(-0.5 + k * 0.25, 0.25, 0, 0.02, 1.4, 0.02, '#8a7a60'); });
    m.at(-4.6, 0, 1.2, 0.1, () => { for (let r = 0; r < 4; r++) for (let k = 0; k < 6 - r; k++) m.cyl(-1.2 + k * 0.45 + r * 0.22, 0.2 + r * 0.38, -0.9, 0.2, 1.8, 7, '#6a4a30', 'z', '#b08a5a'); m.box(0, 1.65, 0, 2.6, 0.16, 1.9, '#eef2f6'); });
    m.at(-2.5, 0, 6, 0.7, () => { m.box(0, 0.25, 0, 0.9, 0.08, 2.2, '#7a5a3a'); for (const sx of [-0.4, 0.4]) m.box(sx, 0, 0, 0.06, 0.25, 2.4, '#5a3a22'); m.box(0, 0.33, 0.2, 0.8, 0.12, 1.4, '#eef2f6'); });
    m.box(-0.2, 0, 3.15, 1.6, 0.3, 0.9, '#eef2f6');                                                               // kapı önü kar birikintisi
    // çam ormanı (kar yüklü); açıklık ve iz boş kalır
    for (let k = 0; k < 230; k++) { const x = R.range(-200, 200), z = R.range(-200, 120); if (Math.hypot(x, z - 2) < 14 || trail(x, z) || (x > -1 && x < 12 && z > 4 && z < 100)) continue; snowPine(m, x, hf(x, z), z, R.range(1.0, 2.2)); }
    for (let k = 0; k < 7; k++) K.mountain(m, -420 + k * 140, -300 - R.range(0, 80), R.range(100, 140), R.range(90, 130), '#6a7a88', '#eef2f6');
    // vadide Cedar Falls: kasaba, nehir, bacalardan duman
    const VY = hf(26, 112);
    m.at(26, VY, 112, 0.2, () => K.town(m, R, 0, -30, 30, { street: 7, gable: 0.8, tower: false }));
    m.box(26, VY - 0.8, 150, 260, 0.6, 9, '#5a7a90');
    K.tufts(m, R, 200, -14, -6, 14, 14, hf, ['#8a9070', '#a0a088'], (x, z) => Math.abs(x) < 4.5 && Math.abs(z) < 4, 0.7);
    const S = scene(L, { top: '#8a9aac', hor: '#d8dfe4', sun: [0.35, 0.55, 0.55], sunC: '#f4f4ee', sunR: 0.03 }, '#c8d2da', 0.0056, { fogH: 4, shadowC: [0, 0, 4], shadowR: 60, shadowN: 18 });
    S.grade = { lift: [0.02, 0.03, 0.05], gain: [0.96, 1.0, 1.04], sat: 0.84, con: 1.04 };
    S.cloud = 0.78; S.cloudC = '#c8d0d6'; S.shadowK = 0.65;
    done(S, [m]);
    const PW = walker(L, look), hc = o.horseCol || '#5a3b28', HP = K.horseParts(L, hc, null), HR = K.horseParts(L, hc, look);
    const T1 = 4.6, T2 = 9.4;
    const rp = (t) => { const k = cl01((t - T2) / 6); return [3 + k * 4, 0, 8 + k * 34]; };
    S.dyn = (t, D) => {
      if (t < T2) { drawWalker(D, PW, -7.2, hf(-7.2, 3.6), 3.6, -Math.PI / 2 - 0.25, 0, 0); K.drawHorse(D, HP, 4.2, 0, 6.2, -0.4, t * 0.4, false); S.focus = t < T1 ? [0, 1.5, 3] : [-7, 1, 3]; }
      else { const p = rp(t); K.drawHorse(D, HR, p[0], hf(p[0], p[2]), p[2], 0.12, (t - T2) * 6, false); S.focus = [p[0], 1, p[2]]; }
    };
    S.shots = [
      // kulübenin önünde yavaş kayan çekim: duvarda kapanlar, boş post gergisi, kapalı kapı; baca sönük
      { d: T1, cam: (t, u) => { const k = ease(u); return { e: [-5.5 + k * 6.5, 1.9 + k * 0.4, 9.6 - k * 0.6], c: [-2.0 + k * 3.6, 1.9 + k * 1.4, 2.6], shake: 0.006 }; } },
      // açıklığın kıyısında oyuncu, babasının gittiği karla kapanmış iz
      { d: T2 - T1, cam: (t, u) => ({ e: [-4.4 + u * 0.3, 1.8, 5.4], c: [-22, 1.4, -0.5 - u * 0.5], shake: 0.008 }) },
      // atla vadiye iniş; vinç kasabayı ve dumanı gösterir
      { d: 6, cam: (t, u) => { const p = rp(t), k = ease(u); return { e: V.lerp([p[0] - 2.4, hf(p[0], p[2]) + 2.4, p[2] - 6.5], [p[0] - 8, hf(p[0], p[2]) + 13, p[2] - 18], k), c: V.lerp([p[0], hf(p[0], p[2]) + 1.8, p[2] + 2], [26, VY, 112], ease(cl01((u - 0.2) / 0.8))) }; } },
    ];
    S.capAt = T2 + 0.8; S.lineAt = 1.0;
    S.cap = { s: Tr('Ocak soğudu. İz karla kapandı.') };
    S.particles = (t, add) => {
      const c = t < T2 ? [0, 0, 3] : rp(t);
      for (let k = 0; k < 7; k++) add([c[0] + R.range(-22, 22), hf(c[0], c[2]) + R.range(3, 12), c[2] + R.range(-22, 14)], [R.range(-0.3, 0.3) + 0.25, R.range(-1.4, -0.8), R.range(-0.2, 0.2)], [1, 1, 1, 0.95], -R.range(1.2, 2.2), 9);
      if (Math.random() < 0.08) add([-7.2 + R.range(-0.05, 0.05), 1.85, 3.4], [-0.25, 0.15, 0], [0.95, 0.96, 1, 0.45], 0.35, 1.2);   // nefes
      if (Math.random() < 0.15) for (let k = 0; k < 3; k++) add([26 + R.range(-20, 20), VY + 8, 112 + R.range(-25, 25)], [0.4, 1.2, 0], [0.7, 0.72, 0.75, 0.45], 3, 6);   // kasaba dumanı
    };
    return S;
  });
})();
