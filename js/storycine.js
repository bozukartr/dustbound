'use strict';
/* ==========================================================
   FRONTIER'S END — hikâye sinematikleri (Sully'nin Senedi)
   Bölüm geçişlerinde oynayan kısa 3D sahneler: varış sinematikleriyle
   aynı alçak poligon çizici, aynı post işlem ve piksel kademesi.
   Sahneler oyuncunun başladığı yerin doğasına göre (ova, kıyı, çöl,
   kurak bozkır, orman) renk ve bitki değiştirir; günün saati de
   (gündüz, akşam, gece, şafak) ışığı, göğü ve sisi belirler.
   ========================================================== */

(() => {
  const K = Cinema.kit, { M4, V, C, ease, cl01, flatW, Mesh } = K;

  const ENV = {
    plains: { g: ['#9aa04a', '#b89c4c', '#8a9a44', '#c8a858'], road: '#9a7c56', far: 'mountain', mc: ['#8a98a8', '#e8ecf0'] },
    coast:  { g: ['#7a9a50', '#6a8a48', '#86a458', '#70904a'], road: '#9a8a66', far: 'mountain', mc: ['#8a9aa8', '#eef2f4'] },
    desert: { g: ['#d08a52', '#c07a48', '#c89060', '#b87048'], road: '#b8784a', far: 'mesa' },
    dry:    { g: ['#b0a05a', '#a0904e', '#b8a868', '#98884a'], road: '#9a7c56', far: 'mountain', mc: ['#9aa0a8', '#eef0f2'] },
    forest: { g: ['#4a6a3a', '#3e5e34', '#56703e', '#46663a'], road: '#7a6a4a', far: 'mountain', mc: ['#6a7a88', '#eef2f6'] },
  };
  const treeKind = (env, R) => env === 'desert' ? (R.chance(0.6) ? 'saguaro' : 'dry') : env === 'forest' ? 'pine' : env === 'dry' ? (R.chance(0.45) ? 'dry' : 'oak') : 'oak';
  const TOD = {
    day:   { L: { dir: [0.5, 0.55, -0.6], amb: 0.55, dif: 0.75, ambC: '#b8c8e0', sunC: '#ffe8c0' }, sky: { top: '#5a8cc8', hor: '#f0dcb0', sun: [0.5, 0.3, -0.75], sunC: '#fff2c8', sunR: 0.045 }, fog: '#e4d8bc', fogD: 0.0042,
             grade: { lift: [0.02, 0.02, 0], gain: [1.05, 1, 0.92], sat: 1.05, con: 1.05 }, cloud: 0.45, cloudC: '#fff6e6' },
    dusk:  { L: { dir: [-0.2, 0.2, -1], amb: 0.42, dif: 0.85, ambC: '#8a70a0', sunC: '#ffa860' }, sky: { top: '#3a3060', hor: '#f09050', sun: [-0.15, 0.07, -1], sunC: '#ffc070', sunR: 0.07 }, fog: '#c87850', fogD: 0.005,
             grade: { lift: [0.05, 0.01, 0.05], gain: [1.1, 0.95, 0.86], sat: 1.12, con: 1.1 }, cloud: 0.38, cloudC: '#f09a80' },
    night: { L: { dir: [0.3, 0.6, 0.5], amb: 0.34, dif: 0.38, ambC: '#4a5a8a', sunC: '#a8b8e0' }, sky: { top: '#070a1c', hor: '#1e2848', sun: [0.35, 0.45, -0.75], sunC: '#e8ecff', sunR: 0.022 }, fog: '#141c30', fogD: 0.0065,
             grade: { lift: [0, 0.01, 0.04], gain: [0.85, 0.9, 1.06], sat: 0.82, con: 1.08 }, cloud: 0.22, cloudC: '#3a4a6a', stars: true },
    dawn:  { L: { dir: [0.6, 0.22, -0.7], amb: 0.5, dif: 0.7, ambC: '#a8a0c0', sunC: '#ffc8a0' }, sky: { top: '#4a6aa0', hor: '#f8c8a0', sun: [0.6, 0.08, -0.75], sunC: '#ffe0b0', sunR: 0.06 }, fog: '#e0c0b0', fogD: 0.0055, fogH: 4,
             grade: { lift: [0.04, 0.02, 0.04], gain: [1.06, 0.98, 0.95], sat: 0.98, con: 1.04 }, cloud: 0.5, cloudC: '#f8d0c0' },
  };
  const def = (o, R) => Object.assign({ env: 'plains', sully: randomLook('m', R), jack: randomLook('m', R) }, o || {});
  const light = (T) => ({ dir: V.norm(T.L.dir), amb: T.L.amb, dif: T.L.dif, ambC: C(T.L.ambC), sunC: C(T.L.sunC) });
  /* ışıktan etkilenmeyen parlak parçalar (fener, pencere, ateş) */
  const GLOW = { dir: [0, 1, 0], amb: 1, dif: 0, ambC: [1.25, 1.2, 1.1], sunC: [0, 0, 0] };

  /* Sahnenin ortak kurulumu: zemin, uzak dağlar, ağaçlar, gök */
  function base(R, opts, tod, hf, area, avoid) {
    const T = TOD[tod], E = ENV[opts.env] || ENV.plains, L = light(T);
    const m = new Mesh(L);
    const [x0, z0, x1, z1] = area;
    m.terrain(x0, z0, x1, z1, 5, hf, (x, z) => { const k = (hash2(x | 0, z | 0, 11) < 0.5 ? 0 : 1) + (Math.sin(x * 0.04 + z * 0.03) > 0.25 ? 2 : 0); return E.g[k]; });
    if (E.far === 'mesa') for (let k = 0; k < 8; k++) { const s = k % 2 ? 1 : -1; K.mesa(m, s * R.range(70, 220), R.range(-320, -120), R.range(30, 70), R.range(25, 55), R.range(20, 45), R); }
    else for (let k = 0; k < 6; k++) K.mountain(m, -360 + k * 140 + R.range(-30, 30), -360 - R.range(0, 80), R.range(80, 120), R.range(50, 95), E.mc[0], E.mc[1]);
    const nT = opts.env === 'forest' ? 120 : opts.env === 'desert' ? 50 : 45;
    for (let k = 0; k < nT; k++) {
      const x = R.range(x0 + 10, x1 - 10), z = R.range(z0 + 10, z1 - 10);
      if (avoid && avoid(x, z)) continue;
      K.tree(m, x, z, hf(x, z), R.range(0.9, opts.env === 'forest' ? 2 : 1.5), treeKind(opts.env, R), R);
    }
    const S = { L, m, E, T, static: [], sky: Object.assign({}, T.sky), fog: T.fog, fogD: T.fogD, fogH: T.fogH || 0, grade: T.grade, cloud: T.cloud, cloudC: T.cloudC };
    return S;
  }
  function finish(S, extra) { S.static.unshift(K.build(S.m)); if (extra) for (const e of extra) S.static.push(K.build(e)); return S; }
  /* yıldızlar: sabit piksel boyutlu uzak noktalar (bir kez eklenir) */
  function stars(S, R, add) {
    if (S._stars) return; S._stars = true;
    for (let k = 0; k < 160; k++) { const a = R.range(0, TAU), e = R.range(0.12, 1.2), r = 620; add([Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r * 0.8 + 40, Math.sin(a) * Math.cos(e) * r], [0, 0, 0], [0.95, 0.95, 1, R.range(0.5, 1)], -R.range(1, 2.2), 1e9); }
  }

  /* Ayakta ya da oturan biri (rider gövdesi + bacaklar) */
  function figure(m, look, x, y, z, ry, pose) {
    m.at(x, y, z, ry, () => {
      if (pose === 'sit') { K.rider(m, look, 0, 0.5, 0, true); return; }
      for (const s of [-1, 1]) { m.box(s * 0.13, 0, 0, 0.17, 0.85, 0.2, look.pants); m.box(s * 0.13, 0, 0.05, 0.19, 0.12, 0.3, '#1a120c'); }
      K.rider(m, look, 0, 0.85, 0, false);
    });
  }
  /* iki ağa (gölgeli + parlayan) aynı dönüşümle çizim */
  function at2(m, g, x, y, z, ry, fn) { m.at(x, y, z, ry, () => { const o = g.T; g.T = m.T; fn(); g.T = o; }); }
  /* geceleyin fener ya da ateş ışığında kalan kişiler */
  const warm = (amb) => ({ dir: V.norm([0.25, 0.55, 0.8]), amb: amb || 0.5, dif: 0.65, ambC: C('#7080b0'), sunC: C('#ffc080') });
  /* Çiftlik: ev ve verandası, ambar, kümes, çit, yel değirmeni, kuyu */
  function ranch(m, g, R, x, y, z, ry, night) {
    at2(m, g, x, y, z, ry, () => {
      m.box(0, 0, 0, 9, 3.6, 6.5, '#a07850'); m.roof(0, 3.6, 0, 9, 2, 6.5, '#6a4030', 0.5);
      m.box(0, 0, 4.6, 9, 0.25, 2.6, '#7a5a3a');                                   // veranda
      m.box(0, 3.0, 4.7, 9.4, 0.2, 2.9, '#5a3a22');
      for (const sx of [-4.2, -1.4, 1.4, 4.2]) m.box(sx, 0, 5.8, 0.2, 3.0, 0.2, '#4a3422');
      m.box(0, 0.2, 3.27, 1.1, 2.1, 0.1, '#2a1c12');
      const w = night ? g : m; w.box(-2.6, 1.2, 3.28, 1.2, 1.0, 0.06, night ? '#ffc870' : '#6a8aa0'); w.box(2.6, 1.2, 3.28, 1.2, 1.0, 0.06, night ? '#ffb860' : '#6a8aa0');
      m.box(3.4, 0, -1.5, 0.9, 6, 0.9, '#6a5a4a');                                  // baca
      // ambar
      m.at(-13, 0, -3, 0.15, () => { m.box(0, 0, 0, 7, 5, 9, '#8a2a20'); m.roof(0, 5, 0, 7, 2.6, 9, '#4a2a22', 0.4); m.box(0, 0, 4.55, 3, 3.6, 0.1, '#5a1a14'); m.box(0, 0, 4.6, 0.15, 3.6, 0.1, '#d8d0c0'); });
      // kümes
      m.at(9, 0, 6, -0.3, () => { m.box(0, 0.4, 0, 2.6, 1.4, 2, '#9a7a50'); m.roof(0, 1.8, 0, 2.6, 0.7, 2, '#5a3a22', 0.2); for (const [a, b] of [[-1.2, -0.9], [1.2, -0.9], [-1.2, 0.9], [1.2, 0.9]]) m.box(a, 0, b, 0.15, 0.4, 0.15, '#4a3422'); });
      // yel değirmeni
      m.at(14, 0, -6, 0, () => { for (const [a, b] of [[-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]]) m.box(a * 0.6, 0, b * 0.6, 0.18, 9, 0.18, '#7a6a54'); m.box(0, 9, 0.3, 0.4, 0.4, 0.6, '#5a4a3a');
        for (let k = 0; k < 8; k++) m.at(0, 9.2, 0.7, 0, () => { m.T = M4.mul(m.T, M4.rz(k * Math.PI / 4)); m.box(0, 0, 0, 0.35, 2.4, 0.06, '#d8d0c0'); }); });
      m.cyl(-5, 0, 8, 0.9, 0.9, 8, '#8a8070', 'y', '#2a3a4a');                    // kuyu
      m.box(-5, 0.9, 8, 0.12, 1.6, 0.12, '#5a3a22'); m.box(-5, 2.4, 8, 1.6, 0.15, 0.15, '#5a3a22');
      // çit
      for (let k = -9; k <= 9; k++) { m.box(k * 2, 0, 12, 0.18, 1.2, 0.18, '#6a4a2a'); if (k < 9) m.box(k * 2 + 1, 0.85, 12, 2, 0.12, 0.1, '#7a5a3a'); }
    });
  }
  function chickenMesh(L) { const c = new Mesh(L); c.box(0, 0.15, 0, 0.3, 0.3, 0.42, '#efe8dc'); c.box(0, 0.38, 0.2, 0.18, 0.2, 0.18, '#efe8dc'); c.box(0, 0.5, 0.22, 0.06, 0.08, 0.12, '#c8302a'); c.box(0, 0.36, 0.33, 0.06, 0.05, 0.08, '#e0a030'); return c; }
  /* dört ayaklı küçük yırtıcı (çakal): at parçaları gibi gövde + bacak */
  function coyoteParts(L) {
    const b = new Mesh(L), leg = new Mesh(L), col = '#a08260', d = '#7a6040';
    b.box(0, 0.55, 0, 0.36, 0.38, 1.0, col); b.box(0, 0.75, 0.62, 0.3, 0.3, 0.36, col); b.box(0, 0.7, 0.92, 0.14, 0.14, 0.3, d);
    for (const s of [-1, 1]) b.box(s * 0.09, 1.0, 0.56, 0.07, 0.16, 0.07, d);
    b.at(0, 0.66, -0.52, 0, () => { b.T = M4.mul(b.T, M4.rx(0.9)); b.box(0, -0.45, 0, 0.12, 0.5, 0.12, d); });
    leg.box(0, -0.5, 0, 0.09, 0.5, 0.1, d);
    return { body: K.build(b), leg: K.build(leg) };
  }
  function drawBeast(D, P, x, y, z, ang, ph, run) {
    const base = M4.chain(M4.tr(x, y + Math.abs(Math.sin(ph)) * (run ? 0.08 : 0.02), z), M4.ry(ang));
    D.push([K.blob(), M4.chain(M4.tr(x, y + 0.04, z), M4.ry(ang), [0.45, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0.9, 0, 0, 0, 0, 1]), 0.25]);
    D.push([P.body, base]);
    for (const [lx, lz, o] of [[0.12, 0.38, 0], [-0.12, 0.38, Math.PI], [0.12, -0.38, Math.PI], [-0.12, -0.38, 0]]) D.push([P.leg, M4.chain(base, M4.tr(lx, 0.5, lz), M4.rx(Math.sin(ph + o) * (run ? 0.8 : 0.3)))]);
  }
  function campfire(m, g, x, y, z) {
    for (let k = 0; k < 8; k++) { const a = k / 8 * TAU; m.box(x + Math.cos(a) * 0.9, y, z + Math.sin(a) * 0.9, 0.35, 0.25, 0.35, '#6a6a64'); }
    for (let k = 0; k < 3; k++) m.at(x, y + 0.1, z, k * 1.05, () => m.box(0, 0, 0, 0.18, 0.18, 1.3, '#4a3020'));
    g.cone(x, y + 0.1, z, 0.45, 0.9, 5, '#ff9a30', '#ffe080');
  }
  function tent(m, x, y, z, ry, col) {
    m.at(x, y, z, ry, () => {
      m.face([[-1.3, 0, 1.4], [0, 1.7, 1.4], [0, 1.7, -1.4], [-1.3, 0, -1.4]], V.norm([-1.7, 1.3, 0]), col);
      m.face([[0, 1.7, 1.4], [1.3, 0, 1.4], [1.3, 0, -1.4], [0, 1.7, -1.4]], V.norm([1.7, 1.3, 0]), shadeHex(col, -0.12));
      m.face([[1.3, 0, -1.4], [-1.3, 0, -1.4], [0, 1.7, -1.4]], [0, 0, -1], shadeHex(col, -0.2));
      m.face([[-1.3, 0, 1.4], [1.3, 0, 1.4], [0, 1.7, 1.4]], [0, 0, 1], '#2a1c12');
    });
  }
  const fireParts = (R, add, x, y, z, k = 1) => {
    if (Math.random() < 0.9 * k) add([x + R.range(-0.25, 0.25), y + 0.4, z + R.range(-0.25, 0.25)], [R.range(-0.2, 0.2), R.range(1.2, 2.2), R.range(-0.2, 0.2)], [1, R.range(0.5, 0.8), 0.2, 0.9], 0.5, 0.5);
    if (Math.random() < 0.25 * k) add([x, y + 1, z], [R.range(-0.3, 0.3), R.range(0.6, 1.2), R.range(-0.3, 0.3)], [1, 0.7, 0.3, 1], -1.5, 2.2);
    if (Math.random() < 0.3 * k) add([x, y + 1.2, z], [R.range(-0.2, 0.2), 1.2, R.range(-0.2, 0.2)], [0.25, 0.24, 0.26, 0.5], 1.2, 3);
  };

  /* ---------- Bölüm 3: çiftliğe giden yol (gündüz, iki atlı) ---------- */
  Cinema.addScene('q_ride', (R, look, o) => {
    o = def(o, R);
    const trail = (z) => Math.sin(z * 0.04) * 3;
    const hf = (x, z) => (Math.sin(x * 0.03) * Math.cos(z * 0.025) * 5 + Math.sin(x * 0.07 + z * 0.04) * 1.2 + Math.max(0, -z - 60) * 0.06) * Math.min(1, Math.abs(x - trail(z)) / 10) * flatW(x, z, -25, 25, -110, -75, 25);
    const S = base(R, o, 'day', hf, [-240, -220, 240, 200], (x, z) => Math.abs(x - trail(z)) < 7 || (Math.abs(x) < 35 && z < -60 && z > -120));
    const E = S.E, m = S.m, g = new Mesh(GLOW);
    for (let z = -80; z < 190; z += 2) { const x = trail(z); m.box(x, hf(x, z) + 0.02, z, 3.2, 0.05, 2.2, E.road); }
    const ry = hf(0, -92);
    ranch(m, g, R, 0, ry, -92, 0, false);
    finish(S, [g]);
    const hp = K.horseParts(S.L, o.horseCol || '#6a4a2e', look), hs = K.horseParts(S.L, '#3a2a20', o.sully);
    const pz = (t) => 46 - t * 2.7, sz = (t) => pz(t) - 2.2;
    S.dyn = (t, D) => {
      const z1 = pz(t), x1 = trail(z1) - 1.3, z2 = sz(t), x2 = trail(z2) + 1.4;
      K.drawHorse(D, hp, x1, hf(x1, z1), z1, Math.PI, t * 6.2, false);
      K.drawHorse(D, hs, x2, hf(x2, z2), z2, Math.PI, t * 6.2 + 1.3, false);
      S.focus = [0, 2, z1];
    };
    S.shots = [
      { d: 5.2, cam: (t, u) => { const z = pz(t), x = trail(z), y = hf(x, z); return { e: [x + 8.5 - u * 1.2, y + 3.1, z - 8 + u * 1.5], c: [x + 0.2, y + 2.2, z - 1] }; } },
      { d: 4.6, cam: (t, u) => { const z = pz(t), x = trail(z), y = hf(x, z); return { e: [x + 1 - u * 0.6, y + 1.6, z - 10 + u * 1.5], c: [x, y + 2.3, z] }; } },
      { d: 5.6, cam: (t, u) => { const z = pz(t), x = trail(z), k = ease(u); return { e: V.lerp([x - 2.5, hf(x, z) + 3.2, z + 8], [x - 7, hf(x, z) + 13, z + 19], k), c: V.lerp([x, hf(x, z) + 2.4, z - 6], [0, ry + 3, -92], ease(cl01(u * 1.3))) }; } },
    ];
    S.capAt = 0.4; S.capEnd = 3.6;
    S.particles = (t, add) => { if (Math.random() < 0.4) { const z = pz(t); add([trail(z) + R.range(-1.5, 1.5), hf(0, z) + 0.2, z + 1.4], [0, 0.3, 0.8], [0.75, 0.64, 0.48, 0.45], 1.1, 1.3); } };
    return S;
  });

  /* ---------- Bölüm 4: akşam, kümese sokulan çakallar ---------- */
  Cinema.addScene('q_coyote', (R, look, o) => {
    o = def(o, R);
    const hf = (x, z) => (Math.sin(x * 0.025) * Math.cos(z * 0.03) * 4 + Math.sin(x * 0.06 + z * 0.05)) * flatW(x, z, -30, 30, -20, 25, 25);
    const S = base(R, o, 'dusk', hf, [-220, -240, 220, 160], (x, z) => Math.abs(x) < 40 && z > -30 && z < 40);
    const m = S.m, g = new Mesh(GLOW);
    ranch(m, g, R, 0, 0, 0, 0, true);
    g.box(-3.2, 2.2, 5.6, 0.25, 0.35, 0.25, '#ffd080');                               // verandadaki fener
    finish(S, [g]);
    const cp = coyoteParts(S.L), ch = K.build(chickenMesh(S.L));
    const sm = new Mesh(S.L); figure(sm, o.sully, -2.4, 0.25, 5.2, 1.3, 'stand'); const SB = K.build(sm);
    const pm = new Mesh(S.L); figure(pm, look, 1.2, 0.25, 4.9, 1.4, 'stand'); const PB = K.build(pm);
    const hens = []; for (let k = 0; k < 6; k++) hens.push([9 + R.range(-2.5, 2.5), 8 + R.range(-1, 2.5), R.range(0, TAU)]);
    const coy = [[30, 26, 0], [36, 18, 1.4], [26, 34, 2.6]];
    const cpos = (c, t) => { const k = Math.min(1, t / 11); return [c[0] + (12 - c[0]) * k * 0.75 + Math.sin(t * 0.7 + c[2]) * 0.6, c[1] + (10 - c[1]) * k * 0.75]; };
    S.dyn = (t, D) => {
      D.push([SB, M4.id()]); D.push([PB, M4.id()]);
      for (const [x, z, a] of hens) { const s = t > 7 ? 1 : 0; D.push([ch, M4.chain(M4.tr(x + Math.sin(t * 3 + a) * 0.2 * s, Math.abs(Math.sin(t * 9 + a)) * 0.1 * s, z), M4.ry(a + t * s))]); }
      for (const c of coy) { const [x, z] = cpos(c, t), a = Math.atan2(12 - x, 10 - z); drawBeast(D, cp, x, hf(x, z), z, a, t * 7 + c[2], false); }
      S.focus = [10, 1, 10];
    };
    S.shots = [
      { d: 4.6, cam: (t, u) => ({ e: [-1 + u * 1.2, 2.4, 13 - u * 1.5], c: [-1.5, 2, 4.5] }) },
      { d: 4.4, cam: (t, u) => { const [x, z] = cpos(coy[0], t); return { e: [x + 3.5, 0.9, z + 4.5 - u], c: [x - 2, 0.7, z - 3] }; } },
      { d: 5, cam: (t, u) => { const k = ease(u); return { e: V.lerp([2, 3, 18], [-6, 8, 24], k), c: V.lerp([9, 1, 8], [14, 1, 14], k) }; } },
    ];
    S.capAt = 0.4; S.capEnd = 3.6;
    S.particles = (t, add) => { if (Math.random() < 0.06) add([R.range(-30, 30), R.range(1, 4), R.range(-10, 30)], [0, 0.2, 0], [0.9, 0.95, 0.5, 0.8], -1.2, 2); };
    return S;
  });

  /* ---------- Bölüm 6: gece, verandada itiraf ---------- */
  Cinema.addScene('q_porch', (R, look, o) => {
    o = def(o, R);
    const hf = (x, z) => (Math.sin(x * 0.025) * Math.cos(z * 0.03) * 4) * flatW(x, z, -30, 30, -20, 25, 25);
    const S = base(R, o, 'night', hf, [-220, -240, 220, 160], (x, z) => Math.abs(x) < 40 && z > -30 && z < 40);
    const m = S.m, g = new Mesh(GLOW);
    ranch(m, g, R, 0, 0, 0, 0, true);
    g.box(0.2, 1.05, 5.0, 0.22, 0.32, 0.22, '#ffd080');
    m.box(0.2, 0.25, 5.0, 0.8, 0.8, 0.6, '#5a3a22');                                      // sandık-masa
    for (const sx of [-1.4, 1.6]) { m.box(sx, 0.25, 4.9, 0.8, 0.5, 0.8, '#6a4a2a'); m.box(sx, 0.75, 4.45, 0.8, 0.9, 0.12, '#6a4a2a'); }
    const f = new Mesh(warm(0.55));
    figure(f, o.sully, -1.4, 0.3, 4.95, 0.15, 'sit');
    figure(f, look, 1.6, 0.3, 4.95, -0.25, 'sit');
    finish(S, [g, f]);
    S.dyn = (t, D) => { S.focus = [0, 1.5, 5]; };
    S.shots = [
      { d: 5, cam: (t, u) => { const k = ease(u); return { e: V.lerp([0, 5, 30], [0, 3, 18], k), c: [0, 1.6, 4] }; } },
      { d: 5, cam: (t, u) => ({ e: [-4.2 + u * 0.4, 1.9, 9.5 - u * 0.5], c: [-1.2, 1.5, 5] }) },
      { d: 5, cam: (t, u) => ({ e: [4.8 - u * 0.4, 1.9, 9.2], c: [1.4, 1.5, 5] }) },
    ];
    S.capAt = 0.4; S.capEnd = 3.6;
    S.particles = (t, add) => {
      stars(S, R, add);
      if (Math.random() < 0.08) add([R.range(-14, 14), R.range(0.5, 2.5), R.range(6, 16)], [R.range(-0.2, 0.2), R.range(-0.1, 0.2), 0], [0.9, 1, 0.5, 0.9], -1.4, 2.5);
    };
    return S;
  });

  /* ---------- Bölüm 7: sabah, kasabanın ana caddesine iki atlı girer ---------- */
  Cinema.addScene('q_town', (R, look, o) => {
    o = def(o, R);
    const hf = (x, z) => (Math.sin(x * 0.03) * Math.cos(z * 0.02) * 4) * Math.min(1, Math.abs(x) / 12) * flatW(x, z, -40, 40, -80, 40);
    const S = base(R, o, 'day', hf, [-240, -200, 240, 220], (x, z) => Math.abs(x) < 50 && z < 60);
    const m = S.m;
    K.town(m, R, 0, -70, 30, { street: 6, gable: o.env === 'forest' ? 0.7 : 0.25, church: o.env !== 'desert' });
    for (let z = -80; z < 200; z += 2) m.box(0, 0.02, z, 6, 0.05, 2.2, S.E.road);
    // sokakta birkaç kişi
    for (let k = 0; k < 7; k++) { const L = randomLook(R.chance(0.5) ? 'm' : 'f', R); figure(m, L, R.pick([-4.6, 4.6]) + R.range(-0.4, 0.4), 0, R.range(-60, 20), R.range(0, TAU), 'stand'); }
    finish(S);
    const hp = K.horseParts(S.L, o.horseCol || '#6a4a2e', look), hs = K.horseParts(S.L, '#3a2a20', o.sully);
    const pz = (t) => 64 - t * 2.9;
    S.dyn = (t, D) => { const z = pz(t); K.drawHorse(D, hp, -1.1, 0, z, Math.PI, t * 6.4, false); K.drawHorse(D, hs, 1.2, 0, z - 1.6, Math.PI, t * 6.4 + 1, false); S.focus = [0, 2, z]; };
    S.shots = [
      { d: 5, cam: (t, u) => { const z = pz(t); return { e: [0.4, 1.3, z - 12 + u * 2], c: [0, 2.2, z] }; } },
      { d: 5, cam: (t, u) => { const z = pz(t); return { e: [4.6, 2.7, z - 2.5], c: [0.6, 2.4, z - 1] }; } },
      { d: 5, cam: (t, u) => { const z = pz(t), k = ease(u); return { e: V.lerp([-2, 3, z + 7], [-3, 9, z + 16], k), c: V.lerp([0, 2.3, z - 6], [0, 3, -40], k) }; } },
    ];
    S.capAt = 0.4; S.capEnd = 3.6;
    return S;
  });

  /* ---------- Bölüm 8: gece, saloonun ışıkları ---------- */
  Cinema.addScene('q_saloon', (R, look, o) => {
    o = def(o, R);
    const hf = (x, z) => (Math.sin(x * 0.03) * Math.cos(z * 0.02) * 4) * Math.min(1, Math.abs(x) / 12) * flatW(x, z, -40, 40, -80, 40);
    const S = base(R, o, 'night', hf, [-240, -200, 240, 200], (x, z) => Math.abs(x) < 50 && z < 60);
    const m = S.m, g = new Mesh(GLOW);
    K.town(m, R, 0, -60, 10, { street: 6, gable: 0.2, church: false, tower: false });
    for (let z = -70; z < 120; z += 2) m.box(0, 0.02, z, 6, 0.05, 2.2, S.E.road);
    // saloon: yan sokakta, cepheye bakar
    at2(m, g, 12, 0, 22, -Math.PI / 2, () => {
      m.box(0, 0, 0, 12, 6, 9, '#7a4f33'); m.box(0, 0, 4.6, 12, 8.2, 0.3, '#86593a');
      m.box(0, 3.4, 5.6, 12.4, 0.2, 2.2, '#46291c'); m.box(0, 0, 5.6, 12, 0.22, 2.2, '#6a4a2e');
      for (const sx of [-5.8, -2, 2, 5.8]) m.box(sx, 0, 6.6, 0.2, 3.4, 0.2, '#3a2416');
      g.box(0, 6.4, 4.8, 5, 0.9, 0.08, '#d84a30');
      for (const sx of [-4, 4]) g.box(sx, 1.2, 4.78, 2, 1.4, 0.06, '#ffc060');
      g.box(0, 0.2, 4.78, 1.6, 2.2, 0.06, '#ffb050');
      g.box(0, 4.4, 4.78, 1.4, 1.2, 0.06, '#ffd080'); g.box(-4, 4.4, 4.78, 1.4, 1.2, 0.06, '#f0a050');
    });
    // verandada sızmış bir sarhoş, bağlı atlar
    figure(m, randomLook('m', R), 6.6, 0.22, 19.5, -Math.PI / 2, 'sit');
    finish(S, [g]);
    const hp = K.horseParts(S.L, o.horseCol || '#6a4a2e', null), hs = K.horseParts(S.L, '#3a2a20', null);
    const pm = new Mesh(warm(0.5)); figure(pm, look, 0, 0, 0, 0, 'stand'); const PB = K.build(pm);
    const sm = new Mesh(warm(0.5)); figure(sm, o.sully, 0, 0, 0, 0, 'stand'); const SB = K.build(sm);
    const wz = (t) => 44 - Math.min(t, 11) * 1.7;
    S.dyn = (t, D) => {
      K.drawHorse(D, hp, 3.4, 0, 25, Math.PI / 2, 0.4, false); K.drawHorse(D, hs, 3.4, 0, 27.5, Math.PI / 2, 1.8, false);
      const z = wz(t), sw = Math.sin(t * 6) * 0.05;
      D.push([PB, M4.chain(M4.tr(-0.9, sw, z), M4.ry(Math.PI))]); D.push([SB, M4.chain(M4.tr(0.9, -sw, z - 0.3), M4.ry(Math.PI))]);
      S.focus = [0, 1.6, z];
    };
    S.shots = [
      { d: 5.2, cam: (t, u) => { const k = ease(u); return { e: V.lerp([-5, 7, 40], [-4, 3.5, 32], k), c: [10, 3, 22] }; } },
      { d: 5, cam: (t, u) => { const z = wz(t); return { e: [-3.6, 1.8, z - 5], c: [0, 1.6, z] }; } },
      { d: 5, cam: (t, u) => { const z = wz(t); return { e: [-2.2, 2.1, z + 5 - u], c: [9, 2.4, 22] }; } },
    ];
    S.capAt = 0.4; S.capEnd = 3.6;
    S.particles = (t, add) => { stars(S, R, add); if (Math.random() < 0.3) add([13 + R.range(-0.3, 0.3), 9, 18], [R.range(-0.2, 0.2), 1, 0], [0.3, 0.3, 0.34, 0.5], 1, 2.5); };
    return S;
  });

  /* ---------- Bölüm 9: kamp ateşi başında ---------- */
  Cinema.addScene('q_fire', (R, look, o) => {
    o = def(o, R);
    const hf = (x, z) => (Math.sin(x * 0.04) * Math.cos(z * 0.03) * 5 + Math.sin(x * 0.09 + z * 0.06) * 1.4) * flatW(x, z, -10, 10, -10, 10, 18);
    const S = base(R, o, 'night', hf, [-200, -200, 200, 200], (x, z) => Math.abs(x) < 14 && Math.abs(z) < 14);
    const m = S.m, g = new Mesh(GLOW);
    S.L.dir = V.norm([-0.4, 0.5, 0.6]); S.L.sunC = C('#ff9a50'); S.L.dif = 0.55;
    campfire(m, g, 0, 0, 0);
    m.at(-2.2, 0, 0.4, 0.2, () => m.box(0, 0, 0, 0.6, 0.5, 2.4, '#5a3a22'));
    m.at(2.3, 0, -0.3, -0.3, () => m.box(0, 0, 0, 0.6, 0.5, 2.4, '#5a3a22'));
    const f = new Mesh({ dir: V.norm([0, 0.5, 0.2]), amb: 0.45, dif: 0.2, ambC: C('#ffb070'), sunC: C('#ffc080') });
    figure(f, o.sully, -2.2, 0.0, 0.4, Math.PI / 2 + 0.2, 'sit');
    figure(f, look, 2.3, 0.0, -0.3, -Math.PI / 2 - 0.3, 'sit');
    m.at(1.4, 0, 2.6, 0.3, () => { m.box(0, 0, 0, 2, 0.25, 0.9, '#6a2a20'); m.box(0.8, 0.2, 0, 0.4, 0.2, 0.8, '#d8c8a8'); });   // uyku tulumu
    finish(S, [g, f]);
    const hp = K.horseParts(S.L, o.horseCol || '#6a4a2e', null), hs = K.horseParts(S.L, '#3a2a20', null);
    S.dyn = (t, D) => { K.drawHorse(D, hp, -6, hf(-6, -5), -5, 0.6, 0.3, false); K.drawHorse(D, hs, -7.5, hf(-7.5, -3), -3, 0.9, 1.2, false); S.focus = [0, 1, 0]; };
    S.shots = [
      { d: 5, cam: (t, u) => { const a = 0.6 + u * 0.5; return { e: [Math.cos(a) * 9, 3.2, Math.sin(a) * 9], c: [0, 0.8, 0] }; } },
      { d: 5, cam: (t, u) => ({ e: [1.8, 1.4, 3.2 - u * 0.3], c: [-2.2, 1.2, 0.3] }) },
      { d: 5, cam: (t, u) => ({ e: [-1.6, 1.4, 3.0 - u * 0.3], c: [2.3, 1.2, -0.3] }) },
    ];
    S.capAt = 0.4; S.capEnd = 3.6;
    S.lights = [{ p: [0, 0.8, 0], c: '#ff8a3a', i: 1.1, r: 7, flick: true }];
    S.particles = (t, add) => { stars(S, R, add); fireParts(R, add, 0, 0, 0, 1.6); };
    return S;
  });

  /* ---------- Bölüm 10: şafak, sırttan haydut kampı ---------- */
  Cinema.addScene('q_dawn', (R, look, o) => {
    o = def(o, R);
    const hf = (x, z) => { const ridge = Math.max(0, 1 - Math.abs(z - 40) / 14) * 7; return (Math.sin(x * 0.03) * Math.cos(z * 0.025) * 4 + Math.sin(x * 0.08) * 1.2) * flatW(x, z, -14, 14, -14, 14, 20) + ridge; };
    const S = base(R, o, 'dawn', hf, [-220, -220, 220, 200], (x, z) => (Math.abs(x) < 18 && Math.abs(z) < 18) || (Math.abs(x) < 8 && Math.abs(z - 42) < 6));
    const m = S.m, g = new Mesh(GLOW);
    campfire(m, g, 0, 0, 0);
    for (let k = 0; k < 4; k++) { const a = k / 4 * TAU + 0.4; tent(m, Math.cos(a) * 7, 0, Math.sin(a) * 7, -a + Math.PI / 2, R.pick(['#c8b890', '#a89870', '#8a7a5a'])); }
    m.box(3, 0, -6, 1.2, 1, 1.2, '#7a5a3a'); m.cyl(-6, 0, 3, 0.55, 1.2, 8, '#6a4a2a', 'y', '#4a3020');
    const bl = o.bandits || [randomLook('m', R), randomLook('m', R), randomLook('m', R)];
    m.at(-2.4, 0, 1.2, 0, () => m.box(0, 0, 0, 1.8, 0.3, 0.7, '#5a4a3a')); figure(m, bl[0], -2.4, -0.1, 1.2, 0.3, 'sit');        // nöbetçi, uyukluyor
    m.at(2.6, 0, 2.4, 0.4, () => { m.box(0, 0, 0, 0.9, 0.3, 2, '#5a2a20'); });                                                   // uyuyan biri
    figure(m, o.jack, 1.6, 0, -2.4, Math.PI * 0.9, 'stand');                                                                     // Kızıl Jack
    // sırttaki iki gözcü (oyuncu ve Sully), yüzüstü uzanmış
    finish(S, [g]);
    const lie = (look2) => { const lm = new Mesh(S.L); lm.at(0, 0, 0, 0, () => { lm.T = M4.mul(lm.T, M4.rx(Math.PI / 2 - 0.25)); K.rider(lm, look2, 0, 0, 0, false); lm.box(-0.12, -0.85, 0, 0.17, 0.85, 0.2, look2.pants); lm.box(0.12, -0.85, 0, 0.17, 0.85, 0.2, look2.pants); }); return K.build(lm); };
    const PL = lie(look), SL = lie(o.sully);
    const ry = hf(0, 40) + 0.3;
    S.dyn = (t, D) => { D.push([PL, M4.chain(M4.tr(-0.8, ry, 41.5), M4.ry(Math.PI))]); D.push([SL, M4.chain(M4.tr(0.9, ry, 41.8), M4.ry(Math.PI))]); S.focus = [0, 1, 0]; };
    S.shots = [
      { d: 5, cam: (t, u) => { const k = ease(u); return { e: V.lerp([0, ry + 1.4, 46], [0, ry + 1.8, 44], k), c: V.lerp([0, ry + 0.5, 30], [0, 0.8, 0], k) }; } },
      { d: 5, cam: (t, u) => ({ e: [-9 + u * 1.5, 1.2, 8], c: [0.6, 1.2, -1] }) },
      { d: 5, cam: (t, u) => ({ e: [0.3 - u * 0.3, 1.7, -6.4 + u * 0.6], c: [1.6, 1.65, -2.4] }) },
    ];
    S.capAt = 0.4; S.capEnd = 3.6;
    S.lights = [{ p: [0, 0.8, 0], c: '#ff8a3a', i: 0.8, r: 6, flick: true }];
    S.particles = (t, add) => { fireParts(R, add, 0, 0, 0, 0.5); if (Math.random() < 0.12) add([R.range(-60, 60), R.range(0.5, 3), R.range(-60, 30)], [0.4, 0, 0], [0.95, 0.9, 0.85, 0.35], 6, 6); };
    return S;
  });

  /* ---------- Final: gün batımında çiftlik, senet yerinde ---------- */
  Cinema.addScene('q_finale', (R, look, o) => {
    o = def(o, R);
    const hf = (x, z) => (Math.sin(x * 0.025) * Math.cos(z * 0.03) * 4 + Math.sin(x * 0.06 + z * 0.05)) * flatW(x, z, -30, 30, -20, 25, 25);
    const S = base(R, o, 'dusk', hf, [-240, -260, 240, 180], (x, z) => Math.abs(x) < 40 && z > -30 && z < 40);
    const m = S.m, g = new Mesh(GLOW);
    S.sky.sun = [0.1, 0.06, -1]; S.L.dir = V.norm([0.35, 0.35, 1]); S.L.ambC = C('#a888a8');
    ranch(m, g, R, 0, 0, 0, 0, false);
    figure(m, o.sully, -1.0, 0.25, 5.4, 0.15, 'stand');
    figure(m, look, 1.0, 0.25, 5.3, -0.15, 'stand');
    m.box(-0.62, 1.25, 5.75, 0.36, 0.46, 0.03, '#efe4c8');                                 // tapu kâğıdı
    finish(S, [g]);
    const hens = K.build(chickenMesh(S.L)), hp = K.horseParts(S.L, o.horseCol || '#6a4a2e', null);
    S.dyn = (t, D) => { for (let k = 0; k < 4; k++) D.push([hens, M4.chain(M4.tr(7 + k * 0.9, 0, 9 + Math.sin(k * 2) * 0.8), M4.ry(k + t * 0.4))]); K.drawHorse(D, hp, -7, 0, 14, 0.3, t * 0.5, false); S.focus = [0, 1.6, 5]; };
    S.shots = [
      { d: 5, cam: (t, u) => ({ e: [0.2, 1.7, 11 - u * 1.5], c: [0, 1.6, 5.4] }) },
      { d: 5, cam: (t, u) => ({ e: [-3.4, 1.8, 9.4], c: [-0.8, 1.6, 5.4] }) },
      { d: 6, cam: (t, u) => { const k = ease(u); return { e: V.lerp([2, 3, 16], [-8, 16, 34], k), c: V.lerp([0, 1.8, 5], [0, 3, -40], ease(cl01(u * 1.2))) }; } },
    ];
    S.capAt = 0.4; S.capEnd = 3.6;
    S.particles = (t, add) => { if (Math.random() < 0.3) add([R.range(-2, 2) + 3.4, 6.6, -1.5], [R.range(-0.2, 0.2), 0.9, 0], [0.35, 0.33, 0.33, 0.45], 1, 2.5); };
    return S;
  });
})();
