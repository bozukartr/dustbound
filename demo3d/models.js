'use strict';
/* =====================================================================
   3B TEST DEMOSU — modeller: insan, at, hayvan, dış nesneler, iç mekân eşyaları
   Ölçüler önizlemeden (oyunun parça tanımlarından türetilmiş: omuz ±4.4, şapka tepesi ~27.6, at sırtı ~26).
   Yerel eksenler (canlılar): x ileri, y yukarı, z sağ. Kemikler dönme noktası etrafında döner.
   ===================================================================== */
(() => {
  const { V3, M4, C, mixc, shade, SHD, INK, MAT, F, SIDE, RNG, Mesh } = D3;
  const HEYE = C('#140c08'), BOOT = C('#3b2818'), LEATHER = C('#5c3c24'), GRIP = C('#2c2018'), BRASS = C('#c8a040'), IRON = C('#2e2e34');

  /* ---------------- iskeletler ---------------- */
  // insan: 0 kök, 1 kalça, 2 gövde, 3 baş, 4/5 sol kol üst/alt, 6/7 sağ kol, 8/9 sol bacak, 10/11 sağ bacak
  const HUMAN_SK = {
    n: 12,
    par: [-1, 0, 1, 2, 2, 4, 2, 6, 1, 8, 1, 10],
    piv: [[0, 0, 0], [0, 9.6, 0], [0, 10.4, 0], [0, 18.6, 0], [-0.1, 16.9, -4.1], [0.25, 13.2, -4.45], [-0.1, 16.9, 4.1], [0.25, 13.2, 4.45],
      [0, 9.4, -1.75], [0.25, 5.2, -1.8], [0, 9.4, 1.75], [0.25, 5.2, 1.8]],
  };
  // at: 0 kök, 1 gövde, 2 boyun, 3 baş, 4 kuyruk, 5-12 bacaklar (üst/alt)
  const HORSE_SK = {
    n: 13,
    par: [-1, 0, 1, 2, 1, 1, 5, 1, 7, 1, 9, 1, 11],
    piv: [[0, 0, 0], [0, 20, 0], [8.6, 23.6, 0], [14.6, 31.2, 0], [-11.8, 24.2, 0],
      [6.6, 18.8, -2.6], [6.9, 9.2, -2.6], [6.6, 18.8, 2.6], [6.9, 9.2, 2.6],
      [-7.6, 19.6, -2.7], [-8.5, 9.6, -2.7], [-7.6, 19.6, 2.7], [-8.5, 9.6, 2.7]],
  };
  function skelPose(sk, pose, rootM, out) {
    const W = new Array(sk.n);
    for (let i = 0; i < sk.n; i++) {
      const P = sk.piv[i], r = pose[i] || null, tr = pose.t && pose.t[i];
      let L = M4.translate(P[0] + (tr ? tr[0] : 0), P[1] + (tr ? tr[1] : 0), P[2] + (tr ? tr[2] : 0));
      if (r) { if (r[1]) L = M4.mul(L, M4.rotY(r[1])); if (r[2]) L = M4.mul(L, M4.rotZ(r[2])); if (r[0]) L = M4.mul(L, M4.rotX(r[0])); }
      L = M4.mul(L, M4.translate(-P[0], -P[1], -P[2]));
      W[i] = i === 0 ? M4.mul(rootM, L) : M4.mul(W[sk.par[i]], L);
      out.set(W[i], i * 16);
    }
    return W;
  }

  /* ---------------- insan ---------------- */
  const BRIM = { cowboy: 4.1, boss: 4.2, wide: 4.6, straw: 4.6, fedora: 3.7 };
  function buildHuman(L) {
    const m = new Mesh(6000);
    const skin = C(L.skin), coat = C(L.coat), pants = C(L.pants), shirt = C(L.shirt), hair = C(L.hair || '#3a2618');
    const armC = mixc(coat, SHD, 0.06);
    const B = (b, mat = MAT.CLOTH) => m.set({ bone: b, mat, flags: 0 });
    for (const sd of [-1, 1]) {
      B(sd < 0 ? 8 : 10);
      m.tube([0, 9.6, sd * 1.75], [0.25, 5.2, sd * 1.8], 1.3, 1.15, pants, { seg: 8 });
      B(sd < 0 ? 9 : 11);
      m.tube([0.25, 5.2, sd * 1.8], [0.05, 2.4, sd * 1.85], 1.15, 1.05, pants, { seg: 8 });
      B(sd < 0 ? 9 : 11, MAT.SOLID);
      m.tube([0.05, 0.9, sd * 1.85], [0.05, 3.3, sd * 1.85], 1.12, 1.12, BOOT, { seg: 8 });
      m.box(0.75, 0.75, sd * 1.85, 1.75, 0.75, 1.08, BOOT, { top: shade(BOOT, 0.08) });
    }
    B(1);
    m.ell(-0.1, 9.2, 0, 2.6, 2.2, 3.5, pants, { nu: 12, nv: 7 });
    B(1, MAT.SOLID);
    m.ell(-0.1, 10.0, 0, 2.9, 0.72, 3.8, LEATHER, { nu: 14, nv: 5 });
    m.box(2.85, 10.0, 0, 0.22, 0.5, 0.65, BRASS);
    if (L.gun) { m.box(-0.1, 8.5, 4.15, 1.15, 1.9, 0.55, LEATHER); m.box(-0.35, 10.7, 4.2, 0.55, 0.85, 0.45, GRIP); }
    if (L.coatLen) {
      B(1, MAT.CLOTH); m.set({ flags: F.TWOSIDED });
      const low = 12 - (4 + Math.min(1.4, L.coatLen) * 4.5);
      m.push(M4.scale(1, 1, 1.3));
      m.cyl(-0.3, low, 0, 3.3, 12 - low, shade(coat, -0.08), { seg: 14, r2: 2.75, a0: 0.5, a1: Math.PI * 2 - 0.5, top: false });
      m.pop(); m.set({ flags: 0 });
    }
    B(2);
    m.ell(-0.1, 13.9, 0, 2.75, 4.6, 4.0, coat, { nu: 16, nv: 10 });
    m.set({ mat: MAT.CLOTH });
    m.push(M4.mul(M4.translate(2.42, 15.0, 0), M4.rotZ(-0.32)));
    m.box(0, 0, 0, 0.32, 2.7, 0.62, shirt);
    m.pop();
    m.tube([-0.25, 16.8, -3.4], [-0.25, 16.8, 3.4], 1.6, 1.6, coat, { seg: 8 });
    if (L.badge) { B(2, MAT.SOLID); m.box(2.55, 15.2, -1.7, 0.25, 0.62, 0.62, C('#e0c050')); }
    if (L.backGun) { B(2, MAT.SOLID); m.push(M4.mul(M4.translate(-3.0, 14.5, 0), M4.rotX(0.75))); m.box(0, 0, 0, 0.5, 7.5, 0.6, C('#4a3020')); m.box(0, 5.5, 0, 0.3, 4, 0.3, IRON); m.pop(); }
    for (const sd of [-1, 1]) {
      B(sd < 0 ? 4 : 6);
      m.tube([-0.1, 16.9, sd * 4.1], [0.25, 13.2, sd * 4.45], 1.25, 1.08, armC, { seg: 8 });
      B(sd < 0 ? 5 : 7);
      m.tube([0.25, 13.2, sd * 4.45], [0.5, 10.1, sd * 4.55], 1.08, 0.98, armC, { seg: 8 });
      B(sd < 0 ? 5 : 7, MAT.SOLID);
      m.ell(0.6, 9.25, sd * 4.55, 0.95, 1.05, 0.85, skin, { nu: 8, nv: 6 });
    }
    if (L.rod) { B(7, MAT.SOLID); m.tube([0.6, 9.2, 4.55], [12, 16, 4.0], 0.3, 0.2, C('#6a4a28'), { seg: 4 }); }
    // boyun ve baş
    B(3, MAT.SOLID);
    m.tube([0, 17.4, 0], [0.12, 19.6, 0], 1.08, 1.0, skin, { seg: 8, caps: false });
    const hatOn = L.hat && L.hat !== 'none';
    const faceCol = (p, n) => (n[0] > 0.12 && p[1] < 23.1 - Math.abs(p[2]) * 0.12) || (n[0] > -0.35 && p[1] < 20.6) ? skin : hair;
    B(3, MAT.HAIR);
    m.ell(0.2, 21.75, 0, 2.4, 2.55, 2.3, faceCol, { nu: 14, nv: 10 });
    B(3, MAT.SOLID);
    for (const sd of [-1, 1]) {
      m.ell(0.2, 21.6, sd * 2.3, 0.55, 0.75, 0.35, skin, { nu: 6, nv: 4 });
      m.box(2.38, 22.25, sd * 0.85, 0.2, 0.3, 0.26, HEYE);
    }
    m.box(2.56, 21.45, 0, 0.36, 0.45, 0.33, shade(skin, -0.12));
    const bd = L.beard | 0, bc = shade(hair, -0.1);
    if (bd === 1 || bd === 6) m.box(2.45, 20.75, 0, 0.26, 0.3, bd === 6 ? 1.4 : 1.05, bc);
    else if (bd === 2 || bd === 7) { m.box(2.2, 19.6, 0, 0.5, 0.8, 0.7, bc); if (bd === 2) m.box(2.45, 20.75, 0, 0.26, 0.3, 1.0, bc); }
    else if (bd === 4 || bd === 8) { B(3, MAT.HAIR); m.ell(1.55, 20.1, 0, 1.25, bd === 4 ? 1.35 : 1.0, 1.85, bc, { nu: 10, nv: 6 }); }
    else if (bd === 5) for (const sd of [-1, 1]) m.box(0.9, 21.2, sd * 2.2, 0.6, 1.1, 0.3, bc);
    if (L.mask === 'bandana') { B(3, MAT.CLOTH); m.ell(1.6, 20.2, 0, 1.4, 1.3, 2.25, C('#a02a20'), { nu: 10, nv: 6 }); }
    else if (L.mask === 'sack') { B(3, MAT.CLOTH); m.ell(0.2, 22.0, 0, 2.7, 2.95, 2.6, C('#b8a070'), { nu: 12, nv: 8 }); }
    if (!hatOn && L.mask !== 'sack') { B(3, MAT.HAIR); m.ell(-0.25, 22.9, 0, 2.35, 1.6, 2.35, hair, { nu: 12, nv: 6, ymin: -0.2 }); }
    if (L.longHair) { B(3, MAT.HAIR); m.ell(-1.6, 19.9, 0, 1.6, L.fem ? 3.6 : 2.8, 2.45, hair, { nu: 10, nv: 7 }); }
    if (L.bun) { B(3, MAT.HAIR); m.ell(-1.2, 24.4, 0, 1.4, 1.3, 1.4, shade(hair, -0.1), { nu: 8, nv: 5 }); }
    if (hatOn) {
      const hc = C(L.hatCol || '#3a2a1e'), band = L.hat === 'straw' ? C('#8a3a2a') : mixc(hc, INK, 0.55);
      B(3, L.hat === 'straw' ? MAT.STRAW : MAT.SOLID);
      if (L.hat === 'bowler') {
        m.ell(-0.05, 25.0, 0, 2.6, 2.0, 2.5, hc, { nu: 14, nv: 7, ymin: 0 });
        brim(m, 2.4, 3.25, 24.9, hc, 0.25);
        m.cyl(-0.05, 24.95, 0, 2.62, 0.55, band, { seg: 14, top: false });
      } else if (L.hat === 'top') {
        brim(m, 2.3, 3.4, 24.8, hc, 0.4);
        m.cyl(-0.1, 24.8, 0, 2.35, 5.2, hc, { seg: 14, r2: 2.45 });
        m.cyl(-0.1, 24.85, 0, 2.4, 0.8, band, { seg: 14, top: false });
      } else if (L.hat === 'flat') {
        m.ell(-0.3, 24.4, 0, 2.7, 1.3, 2.6, hc, { nu: 12, nv: 5, ymin: 0 });
        m.box(2.3, 24.5, 0, 1.0, 0.2, 2.0, shade(hc, -0.2));
      } else if (L.hat === 'fur') {
        B(3, MAT.HAIR); m.cyl(-0.1, 23.9, 0, 2.7, 2.9, hc, { seg: 12, r2: 2.5, dome: 0.6 });
      } else if (L.hat === 'bonnet' || L.hat === 'cloche') {
        m.ell(-0.6, 23.6, 0, 3.0, 2.6, 2.75, hc, { nu: 12, nv: 7, ymin: -0.2 });
        if (L.hat === 'bonnet') m.ell(1.4, 23.2, 0, 0.8, 2.4, 2.9, shade(hc, 0.12), { nu: 8, nv: 5 });
      } else {
        const wide = BRIM[L.hat] || 4.1;
        brim(m, 2.3, wide, 24.55, hc, L.hat === 'fedora' ? 0.25 : 0.7);
        m.cyl(-0.1, 24.6, 0, 2.45, L.hat === 'boss' ? 3.6 : L.hat === 'fedora' ? 2.5 : 3.0, hc, { seg: 14, r2: 2.15, dome: -0.55 });
        m.cyl(-0.1, 24.6, 0, 2.5, 0.75, band, { seg: 14, r2: 2.42, top: false });
      }
    }
    return m;
  }
  function brim(m, r0, r1, y, col, curl) {
    const seg = 18;
    for (const side of [1, -1]) {
      const P = (u, v) => {
        const th = u * Math.PI * 2, r = r0 + (r1 - r0) * v, x = Math.cos(th) * r, z = Math.sin(th) * r * 0.96;
        return [x - 0.1, y + curl * Math.pow(Math.abs(z) / r1, 2) * v - 0.25 * Math.max(0, x / r1) * v + (side < 0 ? -0.35 : 0), z];
      };
      m.surf(seg, 2, P, col, [0, y + (side > 0 ? -10 : 10), 0]);
    }
    const P2 = (u, v) => {
      const th = u * Math.PI * 2, x = Math.cos(th) * r1, z = Math.sin(th) * r1 * 0.96;
      return [x - 0.1, y + curl * Math.pow(Math.abs(z) / r1, 2) - 0.25 * Math.max(0, x / r1) - 0.35 * v, z];
    };
    m.surf(seg, 1, P2, shade(col, 0.1), [0, y, 0]);
  }

  /* duruşlar: kemik başına [x, y, z] dönme (x yana açma, y burulma, z öne-arkaya); t: kemik ötelemesi */
  const POSE = {
    stand(t, ph = 0) {
      const b = Math.sin(t * 1.3 + ph) * 0.02;
      return { 2: [0, 0, b], 3: [0, Math.sin(t * 0.37 + ph) * 0.2, 0], 4: [0.05, 0, 0.02], 6: [-0.05, 0, 0.02], 5: [0, 0, 0.12], 7: [0, 0, 0.12] };
    },
    // w: oyunun adım evresi (radyan), mv: hız (0–1)
    walk(w, mv) {
      const s = Math.sin(w), c = Math.cos(w), k = Math.min(1, mv * 1.2);
      return {
        t: { 1: [0, (Math.abs(c) * 0.45 - 0.2) * k, 0] },
        2: [0, s * 0.08 * k, -0.04 * k], 3: [0, -s * 0.06 * k, 0.02],
        8: [0, 0, 0.5 * s * k], 9: [0, 0, (-0.75 * Math.max(0, -c) - 0.05) * k], 10: [0, 0, -0.5 * s * k], 11: [0, 0, (-0.75 * Math.max(0, c) - 0.05) * k],
        4: [0.06, 0, -0.42 * s * k], 5: [0, 0, 0.28], 6: [-0.06, 0, 0.42 * s * k], 7: [0, 0, 0.28],
      };
    },
    sit(t, ph = 0, arms = 'lap') {
      const p = {
        t: { 1: [-0.6, -4.0, 0] },
        2: [0, 0, 0.05 + Math.sin(t * 1.1 + ph) * 0.015], 3: [0, Math.sin(t * 0.3 + ph) * 0.2, 0.05],
        8: [0.08, 0, 1.52], 9: [0, 0, -1.5], 10: [-0.08, 0, 1.52], 11: [0, 0, -1.5],
      };
      if (arms === 'table') { p[4] = [0.15, 0, 0.75]; p[5] = [0, 0, 0.9]; p[6] = [-0.15, 0, 0.75]; p[7] = [0, 0, 0.9]; }
      else if (arms === 'drink') { const u = (Math.sin(t * 0.6 + ph) + 1) / 2, lift = u > 0.8 ? (u - 0.8) * 5 : 0; p[4] = [0.15, 0, 0.7]; p[5] = [0, 0, 0.9]; p[6] = [-0.1, 0, 0.7 + lift * 0.9]; p[7] = [0, 0, 0.9 + lift * 1.1]; }
      else if (arms === 'piano') { const k = Math.sin(t * 7 + ph) * 0.06, k2 = Math.sin(t * 6.1 + ph + 1) * 0.06; p[4] = [0.1, 0, 0.85 + k]; p[5] = [0.1, 0, 0.75]; p[6] = [-0.1, 0, 0.85 + k2]; p[7] = [-0.1, 0, 0.75]; }
      else { p[4] = [0.12, 0, 0.45]; p[5] = [0, 0, 0.6]; p[6] = [-0.12, 0, 0.45]; p[7] = [0, 0, 0.6]; }
      return p;
    },
    ride(t, mv = 0, ph = 0) {
      return {
        t: { 1: [0, Math.abs(Math.sin(t * 4.6 * Math.max(0.2, mv) + ph)) * 0.6 * mv, 0] },
        2: [0, 0, 0.06], 3: [0, 0, 0],
        8: [0.62, 0, 1.0], 9: [0, 0, -1.15], 10: [-0.62, 0, 1.0], 11: [0, 0, -1.15],
        4: [0.12, 0, 0.75], 5: [0, 0, 0.75], 6: [-0.12, 0, 0.75], 7: [0, 0, 0.75],
      };
    },
    kneel() {
      return { t: { 1: [-0.4, -3.6, 0] }, 2: [0, 0, 0.35], 3: [0, 0, 0.2], 8: [0, 0, 1.4], 9: [0, 0, -1.55], 10: [0, 0, -0.1], 11: [0, 0, -1.55], 4: [0.1, 0, 0.9], 5: [0, 0, 0.5], 6: [-0.1, 0, 1.0], 7: [0, 0, 0.6] };
    },
    lie() { return { 2: [0, 0, 0], 3: [0, 0.4, 0], 4: [0.25, 0, 0.1], 6: [-0.25, 0, 0.1], 5: [0, 0, 0.2], 7: [0, 0, 0.2] }; },
  };
  // kollar: nişan (silaha göre), yumruk, eylem (yeme/içme), doldurma
  function armPose(p, st) {
    const wk = st.wk;
    if (st.reload || st.act) { p[6] = [-0.1, 0, 0.9]; p[7] = [0, 0, 1.6]; p[4] = [0.1, 0, 0.7]; p[5] = [0, 0, 1.2]; return; }
    if (st.aim && (wk === 'long' || wk === 'bow' || wk === 'shotgun' || wk === 'rifle')) { p[4] = [0.35, 0, 1.45]; p[5] = [0, 0, 0.2]; p[6] = [-0.2, 0, 1.35]; p[7] = [0, 0, 0.5]; p[3] = [0, 0.15, 0]; return; }
    if (st.aim && (wk === 'fists' || wk === 'knife')) { const s3 = (st.swing || 0) > 0.2 ? 0.6 : 0; p[4] = [0.25, 0, 1.0]; p[5] = [0, 0, 1.0]; p[6] = [-0.15, 0, 1.0 + s3]; p[7] = [0, 0, 0.9 - s3]; return; }
    if (st.aim && (wk === 'throw' || wk === 'lasso')) { p[6] = [-0.4, 0, 2.6 - (st.swing || 0) * 2.2]; p[7] = [0, 0, 0.3]; return; }
    if (st.aim && wk) { p[6] = [-0.1, 0, 1.5]; p[7] = [0, 0, 0.05]; return; }
    if (st.hold === 'rod') { p[6] = [-0.1, 0, 0.9]; p[7] = [0, 0, 0.5]; }
  }

  /* ---------------- at ---------------- */
  function buildHorse(L) {
    const m = new Mesh(8000);
    const col = C(L.col || '#7a5434'), mane = C(L.mane || '#1a1410'), pts = mixc(col, [0.094, 0.055, 0.04], 0.62), muz = mixc(col, [0.14, 0.094, 0.07], 0.5), hoof = C('#2a2018');
    const B = (b, mat = MAT.SOLID) => m.set({ bone: b, mat, flags: 0 });
    B(1);
    m.ell(-0.6, 20.8, 0, 10.2, 5.2, 4.3, col, { nu: 18, nv: 10 });
    m.ell(6.0, 20.8, 0, 4.7, 5.7, 4.0, col, { nu: 14, nv: 9 });
    m.ell(-7.4, 21.6, 0, 5.3, 5.5, 4.55, col, { nu: 14, nv: 9 });
    m.ell(4.2, 24.6, 0, 3.0, 1.6, 2.2, col, { nu: 10, nv: 6 });
    B(2);
    m.tube([8.0, 22.6, 0], [14.0, 30.4, 0], 3.4, 2.3, col, { seg: 12 });
    B(2, MAT.HAIR);
    m.tube([7.0, 26.6, -0.75], [13.4, 33.0, -0.9], 1.0, 0.72, mane, { seg: 7 });
    B(3);
    m.ell(15.6, 31.7, 0, 2.5, 2.35, 1.95, col, { nu: 12, nv: 8 });
    const faceCol = (p, n) => (L.blaze && Math.abs(p[2]) < 0.55 && n[1] > -0.2 && p[0] < 19.6) ? C('#efe9dc') : p[0] > 18.6 ? muz : col;
    m.tube([16.1, 31.0, 0], [19.8, 27.7, 0], 1.95, 1.45, faceCol, { seg: 10 });
    m.ell(20.1, 27.25, 0, 1.35, 1.3, 1.38, muz, { nu: 10, nv: 6 });
    for (const sd of [-1, 1]) {
      m.box(20.95, 27.6, sd * 0.68, 0.2, 0.32, 0.28, C('#1a100a'));
      m.box(16.65, 32.05, sd * 1.82, 0.32, 0.28, 0.2, HEYE);
      m.cyl(15.0, 33.4, sd * 0.95, 0.68, 2.5, pts, { seg: 6, r2: 0.12 });
    }
    B(3, MAT.HAIR);
    m.ell(16.2, 33.15, 0, 1.15, 0.6, 0.95, mane, { nu: 8, nv: 5 });
    B(3);
    m.tube([18.6, 29.4, -1.5], [18.6, 29.4, 1.5], 0.25, 0.25, C('#2a1c12'), { seg: 4 });
    B(4, MAT.HAIR);
    m.tube([-11.6, 24.4, 0], [-13.6, 21.2, 0], 1.35, 1.15, mane, { seg: 8 });
    m.tube([-13.4, 21.6, 0], [-15.0, 11.8, 0], 1.7, 0.85, mane, { seg: 8 });
    const leg = (bu, bl, x, z, hind) => {
      B(bu);
      if (hind) { m.ell(-7.0, 17.6, z * 1.05, 3.4, 4.6, 1.7, col, { nu: 10, nv: 7 }); m.tube([x, 19.8, z], [x - 0.9, 9.6, z], 2.2, 1.25, col, { seg: 8 }); }
      else m.tube([x, 19.2, z], [x + 0.3, 9.2, z], 1.8, 1.15, col, { seg: 8 });
      B(bl);
      const bx = hind ? x - 0.9 : x + 0.3;
      m.tube([bx, hind ? 9.6 : 9.2, z], [bx - (hind ? -0.3 : 0.1), 2.6, z], 0.98, 0.86, pts, { seg: 7 });
      m.ell(bx + 0.1, 2.3, z, 1.05, 0.95, 0.95, pts, { nu: 8, nv: 5 });
      m.cyl(bx + 0.25, 0, z, 1.12, 1.75, hoof, { seg: 8, r2: 0.95 });
    };
    leg(5, 6, 6.6, -2.6, false); leg(7, 8, 6.6, 2.6, false);
    leg(9, 10, -7.6, -2.7, true); leg(11, 12, -7.6, 2.7, true);
    if (L.saddle) {
      const bl = C(L.blanket || '#8a2a20'), cream = C('#e6dcc4'), lc = C('#5a3820'), lh = C('#86603a');
      B(1, MAT.CLOTH); m.set({ flags: F.TWOSIDED });
      const P = (u, v) => { const ph = (v - 0.5) * 2 * 1.35, x = -3.8 + u * 8.4; return [x, 20.9 + 5.55 * Math.cos(ph), 4.6 * Math.sin(ph)]; };
      m.surf(10, 12, P, (p) => { const e = Math.abs(p[0] - 0.4) > 3.6 || Math.abs(Math.atan2(p[2], p[1] - 20.9)) > 1.18; const s = Math.abs(p[0] - 0.4) > 3.0 && !e; return e ? cream : s ? shade(bl, -0.3) : bl; }, [0.4, 20.9, 0], false);
      m.set({ flags: 0 });
      B(1);
      m.ell(0.3, 26.6, 0, 3.7, 1.05, 2.75, (p) => Math.hypot((p[0] - 0.3) / 3.7, p[2] / 2.75) < 0.62 ? lh : lc, { nu: 14, nv: 6 });
      m.cyl(3.55, 26.6, 0, 0.75, 1.8, lc, { seg: 8 });
      m.ell(3.65, 28.5, 0, 0.75, 0.42, 0.75, lh, { nu: 8, nv: 4 });
      m.box(-2.9, 27.6, 0, 0.6, 0.95, 2.25, lc);
      for (const sd of [-1, 1]) {
        m.box(0.4, 22.0, sd * 4.75, 0.45, 4.0, 0.16, lc);
        m.box(0.4, 17.5, sd * 4.85, 1.0, 0.55, 0.6, C('#3a2a1c'));
        if (L.bags) m.box(-5.4, 23.4, sd * 4.55, 1.6, 1.6, 0.75, C('#6a4424'));
      }
    }
    return m;
  }
  const HPOSE = {
    stand(t, ph = 0, nod = 0) {
      const sw = Math.sin(t * 0.9 + ph);
      return { 2: [0, 0, Math.sin(t * 0.5 + ph) * 0.03 - nod * 0.25], 3: [0, Math.sin(t * 0.33 + ph) * 0.12, 0], 4: [0.25 * Math.max(0, sw) * Math.sin(t * 6 + ph), 0, 0] };
    },
    graze(t, ph = 0) {
      return { 2: [0, Math.sin(t * 0.4 + ph) * 0.08, -0.95], 3: [0, 0, -0.55 + Math.sin(t * 2.2 + ph) * 0.06], 4: [Math.sin(t * 1.1 + ph) * 0.2, 0, 0], 5: [0, 0, 0.12], 6: [0, 0, -0.05] };
    },
    // p: oyunun adım evresi; mv: hız (1 dörtnala)
    walk(p, mv) {
      const P = {}, gal = mv > 0.7, a = Math.min(1, mv * 1.6) * (gal ? 1.35 : 1);
      P.t = { 1: [0, Math.sin(p * 2) * 0.35 * a, 0] };
      P[1] = [0, 0, Math.sin(p * 2) * 0.015 * a];
      P[2] = [0, 0, Math.sin(p * 2 + 0.6) * 0.06 * a];
      P[3] = [0, 0, Math.sin(p * 2 + 1.0) * 0.05 * a];
      P[4] = [Math.sin(p) * 0.16, 0, gal ? 0.3 : 0];
      const L = gal ? [[5, 6, 0, 1], [7, 8, 0.5, 1], [9, 10, Math.PI, -1], [11, 12, Math.PI + 0.5, -1]] : [[5, 6, 0, 1], [7, 8, Math.PI, 1], [9, 10, Math.PI * 0.6, -1], [11, 12, Math.PI * 1.6, -1]];
      for (const [bu, bl, off, fr] of L) {
        const s = Math.sin(p + off), c = Math.cos(p + off);
        P[bu] = [0, 0, 0.38 * s * a];
        const lift = Math.max(0, c) * a;
        P[bl] = [0, 0, fr > 0 ? -1.05 * lift : 0.75 * lift];
      }
      return P;
    },
    rear(k) { return { t: { 1: [0, 4 * k, 0] }, 1: [0, 0, 0.55 * k], 2: [0, 0, 0.2 * k], 5: [0, 0, 0.9 * k], 6: [0, 0, -1.4 * k], 7: [0, 0, 0.7 * k], 8: [0, 0, -1.2 * k], 9: [0, 0, -0.5 * k], 11: [0, 0, -0.5 * k] }; },
  };

  /* ---------------- hayvanlar ----------------
     Dört ayaklı genel model (uzunluk ve genişlik oyunun tanımından), kuş, yılan. Kemikler: 0 kök, 1 gövde, 2 baş, 3-6 bacaklar, 7 kuyruk */
  const ANIM_SK = { n: 8, par: [-1, 0, 1, 1, 1, 1, 1, 1], piv: null };
  function buildAnimal(d, type) {
    const m = new Mesh(3000);
    const col = C(d.col || '#8a7050'), col2 = C(d.col2 || '#d8c8a8');
    const L = d.len * 1.25, W = d.wid * 0.85;
    const B = (b, mat = MAT.SOLID) => m.set({ bone: b, mat, flags: 0 });
    if (d.shape === 'bird') {
      const h = L * 0.55;
      B(1); m.ell(0, h, 0, L * 0.5, L * 0.38, W * 0.55, col, { nu: 10, nv: 7 });
      B(7); m.ell(-L * 0.5, h + L * 0.18, 0, L * 0.22, L * 0.3, W * 0.3, shade(col, -0.1), { nu: 8, nv: 5 });
      B(2); m.ell(L * 0.42, h + L * 0.42, 0, L * 0.22, L * 0.22, L * 0.2, col, { nu: 8, nv: 6 });
      m.box(L * 0.66, h + L * 0.42, 0, L * 0.08, L * 0.05, L * 0.05, C('#d8a030'));
      m.box(L * 0.42, h + L * 0.66, 0, L * 0.12, L * 0.1, L * 0.04, col2);
      for (const [b, z] of [[3, -1], [4, 1]]) { B(b); m.tube([0, h - L * 0.2, z * W * 0.25], [0, 0.2, z * W * 0.25], 0.3, 0.25, C('#c89a40'), { seg: 4 }); }
      return m;
    }
    if (d.shape === 'snake') {
      B(1); for (let k = 0; k < 6; k++) m.ell(L * 0.4 - k * L * 0.16, 0.9, Math.sin(k * 1.3) * 1.6, L * 0.11, 0.9, 1.0, k % 2 ? col : col2, { nu: 8, nv: 5 });
      return m;
    }
    const legH = Math.max(2.4, L * (d.shape === 'small' ? 0.18 : 0.42)), bodyR = Math.max(1.6, W * 0.55), y = legH + bodyR * 0.8;
    B(1); m.ell(0, y, 0, L * 0.45, bodyR, W * 0.5, col, { nu: 14, nv: 8 });
    if (type === 'cow') { m.set({ mat: MAT.SOLID }); m.ell(-L * 0.1, y + bodyR * 0.3, W * 0.2, L * 0.16, bodyR * 0.75, W * 0.36, col2, { nu: 8, nv: 6 }); }
    B(2); m.ell(L * 0.52, y + bodyR * 0.45, 0, L * 0.17, bodyR * 0.62, W * 0.33, col, { nu: 10, nv: 7 });
    m.box(L * 0.66, y + bodyR * 0.3, 0, L * 0.06, bodyR * 0.3, W * 0.2, shade(col, -0.35));
    for (const sd of [-1, 1]) m.cyl(L * 0.48, y + bodyR * 1.0, sd * W * 0.2, Math.max(0.4, W * 0.08), Math.max(1.2, bodyR * 0.5), shade(col, -0.15), { seg: 5, r2: 0.1 });
    if (type === 'elk' || type === 'deer') for (const sd of [-1, 1]) m.tube([L * 0.5, y + bodyR * 1.1, sd * W * 0.15], [L * 0.42, y + bodyR * 2.6, sd * W * 0.55], 0.3, 0.2, C('#d8c8a8'), { seg: 4 });
    const legs = [[3, L * 0.3, -1], [4, L * 0.3, 1], [5, -L * 0.3, -1], [6, -L * 0.3, 1]];
    for (const [b, x, sd] of legs) { B(b); m.tube([x, y - bodyR * 0.3, sd * W * 0.3], [x, 0.4, sd * W * 0.3], Math.max(0.5, W * 0.13), Math.max(0.4, W * 0.1), shade(col, -0.12), { seg: 6 }); }
    B(7); m.tube([-L * 0.44, y + bodyR * 0.3, 0], [-L * 0.62, y - bodyR * 0.3, 0], Math.max(0.35, W * 0.08), 0.2, shade(col, -0.2), { seg: 5 });
    return m;
  }
  function animalSkel(d) {
    const L = d.len * 1.25, W = d.wid * 0.85;
    if (d.shape === 'bird') { const h = L * 0.55; return { n: 8, par: ANIM_SK.par, piv: [[0, 0, 0], [0, h, 0], [L * 0.35, h + L * 0.3, 0], [0, h - L * 0.2, -W * 0.25], [0, h - L * 0.2, W * 0.25], [0, 0, 0], [0, 0, 0], [-L * 0.45, h + L * 0.1, 0]] }; }
    const legH = Math.max(2.4, L * (d.shape === 'small' ? 0.18 : 0.42)), bodyR = Math.max(1.6, W * 0.55), y = legH + bodyR * 0.8;
    return { n: 8, par: ANIM_SK.par, piv: [[0, 0, 0], [0, y, 0], [L * 0.42, y + bodyR * 0.3, 0], [L * 0.3, y - bodyR * 0.3, -W * 0.3], [L * 0.3, y - bodyR * 0.3, W * 0.3], [-L * 0.3, y - bodyR * 0.3, -W * 0.3], [-L * 0.3, y - bodyR * 0.3, W * 0.3], [-L * 0.44, y + bodyR * 0.3, 0]] };
  }
  function animalPose(a, t) {
    const p = a.phase || 0, mv = a.dead ? 0 : Math.min(1, a.mv || 0), s = Math.sin(p * 2), P = {};
    if (mv > 0.05) {
      P[3] = [0, 0, 0.6 * s * mv]; P[4] = [0, 0, -0.6 * s * mv]; P[5] = [0, 0, -0.6 * s * mv]; P[6] = [0, 0, 0.6 * s * mv];
      P.t = { 1: [0, Math.abs(s) * 0.4 * mv, 0] };
    } else P[2] = [0, Math.sin(t * 0.4 + (a.id || 0)) * 0.3, Math.sin(t * 0.7) * 0.05 - 0.05];
    P[7] = [Math.sin(t * 2 + p) * 0.25, 0, 0];
    return P;
  }

  /* ---------------- dış nesneler ---------------- */
  const P3 = {};
  P3.oak = (m, x, y, z, s, rng, pal) => {
    const tr = C('#4e3826');
    m.set({ mat: MAT.SOLID, wind: 0, flags: 0, bone: 0 });
    m.tube([x, y - 1, z], [x + 0.6 * s, y + 15 * s, z - 0.4 * s], 2.2 * s, 1.5 * s, tr, { seg: 7 });
    m.tube([x + 0.4 * s, y + 10 * s, z], [x + 5 * s, y + 17 * s, z + 2 * s], 1.0 * s, 0.6 * s, tr, { seg: 5 });
    m.tube([x, y + 11 * s, z], [x - 4.5 * s, y + 18 * s, z - 1.5 * s], 0.9 * s, 0.55 * s, tr, { seg: 5 });
    const cols = pal || [C('#314d22'), C('#3f6129'), C('#557a35')];
    m.set({ mat: MAT.FOLIAGE, wind: 0.7, windBase: y + 12 * s, windH: 22 * s, flags: F.HOLE });
    const n = 6 + Math.floor(rng() * 3);
    const cy = y + 25 * s;
    m.ell(x, cy, z, 13 * s, 10 * s, 13 * s, cols[1], { nu: 14, nv: 9, amp: 0.13, fr: 2.4, seed: rng() * 50 });
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2 + rng() * 0.5, r = (7 + rng() * 4) * s, up = (rng() - 0.3) * 8 * s, rr = (6 + rng() * 3.5) * s, top = up > 2 * s;
      m.ell(x + Math.cos(a) * r, cy + up, z + Math.sin(a) * r, rr, rr * 0.85, rr, top ? cols[2] : (i % 3 === 0 ? cols[0] : cols[1]), { nu: 10, nv: 7, amp: 0.16, fr: 2.6, seed: rng() * 50 });
    }
    m.ell(x - 1 * s, cy + 9 * s, z - 1 * s, 7 * s, 5 * s, 7 * s, cols[2], { nu: 10, nv: 6, amp: 0.15, seed: rng() * 50 });
    m.set({ wind: 0, flags: 0 });
  };
  P3.pine = (m, x, y, z, s, rng) => {
    m.set({ mat: MAT.SOLID, wind: 0, flags: 0, bone: 0 });
    m.tube([x, y - 2, z], [x, y + 10 * s, z], 1.7 * s, 1.3 * s, C('#4a3322'), { seg: 6 });
    m.set({ mat: MAT.FOLIAGE, wind: 0.35, windBase: y + 6 * s, windH: 40 * s, flags: F.HOLE });
    const base = y + 6 * s, dark = C('#20361f'), mid = C('#2c4a28'), lt = C('#3a5d33');
    for (let i = 0; i < 4; i++) {
      const t = i / 3, r = (12 - t * 7) * s, y0 = base + i * 9 * s, hgt = 16 * s - t * 3 * s, spikes = 9 + i, ph = rng() * 6;
      const P = (u, v) => { const th = u * Math.PI * 2, rr = r * (1 - v) * (1 + 0.16 * Math.sin(th * spikes + ph)); return [x + Math.cos(th) * rr, y0 + v * hgt - (v < 0.05 ? 1.5 * s : 0), z + Math.sin(th) * rr]; };
      m.surf(18, 4, P, (p, n) => p[1] < y0 + hgt * 0.22 ? dark : (n[1] > 0.55 ? lt : mid), [x, y0 - 4 * s, z]);
    }
    m.set({ wind: 0, flags: 0 });
  };
  P3.dead = (m, x, y, z, s) => {
    const tr = C('#6a5a4a');
    m.set({ mat: MAT.SOLID, wind: 0, flags: 0, bone: 0 });
    m.tube([x, y - 1, z], [x + 1, y + 22 * s, z], 1.8 * s, 0.8 * s, tr, { seg: 6 });
    m.tube([x + 0.5, y + 12 * s, z], [x + 8 * s, y + 20 * s, z + 2], 0.8 * s, 0.3 * s, tr, { seg: 5 });
    m.tube([x + 0.5, y + 15 * s, z], [x - 7 * s, y + 23 * s, z - 2], 0.7 * s, 0.3 * s, tr, { seg: 5 });
  };
  P3.bush = (m, x, y, z, s, rng, cols) => {
    cols = cols || (rng() > 0.5 ? [C('#3a5a26'), C('#4a6e30'), C('#5e8440')] : [C('#40562a'), C('#506a34'), C('#688246')]);
    m.set({ mat: MAT.FOLIAGE, wind: 0.5, windBase: y, windH: 10 * s, flags: 0, bone: 0 });
    const n = 3 + Math.floor(rng() * 3);
    for (let i = 0; i < n; i++) {
      const a = rng() * 6.28, r = rng() * 4 * s, rr = (3.5 + rng() * 2.5) * s;
      m.ell(x + Math.cos(a) * r, y + rr * 0.6, z + Math.sin(a) * r, rr, rr * 0.8, rr, cols[i % 3], { nu: 9, nv: 6, amp: 0.18, seed: rng() * 40, ymin: -0.6 });
    }
    m.set({ wind: 0 });
  };
  P3.tuft = (m, x, y, z, rng, cols, hgt = 3.2) => {
    m.set({ mat: MAT.FOLIAGE, wind: 0.9, windBase: y, windH: hgt, flags: F.TWOSIDED | F.NOSHADOW, bone: 0 });
    const n = 3 + Math.floor(rng() * 3);
    for (let i = 0; i < n; i++) {
      const a = rng() * Math.PI, ox = (rng() - 0.5) * 2.4, oz = (rng() - 0.5) * 2.4, hh = hgt * (0.6 + rng() * 0.6), lean = (rng() - 0.5) * 1.6;
      const dx = Math.cos(a) * 0.55, dz = Math.sin(a) * 0.55, c = cols[Math.floor(rng() * cols.length)], nrm = [Math.sin(a), 0.3, -Math.cos(a)];
      m.tri([x + ox - dx, y - 0.3, z + oz - dz], [x + ox + dx, y - 0.3, z + oz + dz], [x + ox + lean, y + hh, z + oz + lean * 0.5], nrm, nrm, nrm, c);
    }
    m.set({ wind: 0, flags: 0 });
  };
  P3.rock = (m, x, y, z, r, rng, col) => {
    const c1 = C(col || '#77706a'), c2 = C('#948c84');
    m.set({ mat: MAT.STONE, wind: 0, flags: 0, bone: 0 });
    m.ell(x, y + r * 0.25, z, r, r * 0.72, r * (0.8 + rng() * 0.3), (p, n) => n[1] > 0.55 ? c2 : c1, { nu: 9, nv: 6, amp: 0.22, fr: 1.8, seed: rng() * 60, ymin: -0.5 });
  };
  P3.barrel = (m, x, y, z, r = 4, h = 10.5) => {
    m.set({ mat: MAT.PLANKV, wind: 0, flags: 0, bone: 0 });
    const wood = C('#6a4428'), hoop = C('#2e2a26');
    const P = (u, v) => { const th = u * Math.PI * 2, b = 1 + 0.12 * Math.sin(v * Math.PI); return [x + Math.cos(th) * r * b, y + v * h, z + Math.sin(th) * r * b]; };
    m.surf(12, 6, P, (p) => (Math.abs(p[1] - y - h * 0.18) < 0.6 || Math.abs(p[1] - y - h * 0.82) < 0.6) ? hoop : wood, [x, y + h / 2, z], true);
    m.set({ mat: MAT.SOLID });
    m.cyl(x, y + h - 0.2, z, r, 0.25, shade(wood, 0.1), { seg: 12 });
  };
  P3.crate = (m, x, y, z, s = 5, col = '#9a6e40') => {
    m.set({ mat: MAT.PLANKH, wind: 0, flags: 0, bone: 0 });
    const c = C(col);
    m.box(x, y + s, z, s, s, s, c, { top: shade(c, 0.08) });
    m.set({ mat: MAT.SOLID });
    m.box(x, y + s, z + s + 0.05, s, 0.5, 0.15, shade(c, -0.3));
    m.box(x, y + s, z + s + 0.05, 0.5, s, 0.15, shade(c, -0.3));
  };
  P3.haybale = (m, x, y, z, ang) => {
    m.set({ mat: MAT.STRAW, wind: 0, flags: 0, bone: 0 });
    m.push(M4.mul(M4.translate(x, y + 5.5, z), M4.mul(M4.rotY(-ang), M4.rotX(Math.PI / 2))));
    m.cyl(0, -6, 0, 5.8, 12, C('#c8a860'), { seg: 12, bottom: true, topCol: C('#b89850') });
    m.pop();
  };
  // sokak lambası (gaz): direk, cam fener (kendinden yanar, gece)
  P3.lamp = (m, x, y, z, el) => {
    const iron = C(el ? '#2e3834' : '#3a322c');
    m.set({ mat: MAT.SOLID, wind: 0, flags: 0, bone: 0 });
    m.cyl(x, y, z, 1.1, 1.0, iron, { seg: 8 });
    m.cyl(x, y, z, 0.55, el ? 30 : 20, iron, { seg: 6 });
    m.set({ mat: MAT.EMIT, flags: F.NOSHADOW });
    if (el) m.ell(x, y + 32, z, 2.4, 2.4, 2.4, C('#ece8da'), { nu: 10, nv: 7 });
    else m.cyl(x, y + 20.2, z, 1.5, 3.4, C('#f0d890'), { seg: 6, r2: 1.3 });
    m.set({ mat: MAT.SOLID, flags: 0 });
    if (!el) { m.cyl(x, y + 23.6, z, 1.9, 1.2, iron, { seg: 6, r2: 0.4 }); m.box(x, y + 19.9, z, 1.8, 0.3, 1.8, iron); }
  };
  P3.pole = (m, x, y, z) => {
    const wood = C('#5a4430'), ins = C('#86a898');
    m.set({ mat: MAT.SOLID, wind: 0, flags: 0, bone: 0 });
    m.tube([x, y - 1, z], [x, y + 36, z], 1.0, 0.8, wood, { seg: 6 });
    m.box(x, y + 32, z, 6.5, 0.6, 0.7, wood);
    m.box(x - 5.5, y + 33.2, z, 0.35, 0.6, 0.35, ins); m.box(x + 5.5, y + 33.2, z, 0.35, 0.6, 0.35, ins);
  };
  // çit: karo boyunca iki kat kalas ve uç direkleri; yön: 'h' doğu-batı, 'v' kuzey-güney
  P3.fence = (m, x, y, z, dir, endA, endB) => {
    const post = C('#5e4430'), rail = C('#7a5a38');
    m.set({ mat: MAT.SOLID, wind: 0, flags: 0, bone: 0 });
    const pts = dir === 'h' ? [[x - 8, z], [x + 8, z]] : [[x, z - 8], [x, z + 8]];
    if (endA) m.box(pts[0][0], y + 5.5, pts[0][1], 0.85, 6.5, 0.85, post, { top: shade(post, 0.1) });
    if (endB) m.box(pts[1][0], y + 5.5, pts[1][1], 0.85, 6.5, 0.85, post, { top: shade(post, 0.1) });
    m.box(x, y + 5.5, z, 0.85, 6.5, 0.85, post, { top: shade(post, 0.1) });
    m.set({ mat: MAT.PLANKH });
    for (const hh of [4.8, 9.2]) {
      if (dir === 'h') m.box(x, y + hh, z, 8, 0.7, 0.45, rail, { top: shade(rail, 0.12) });
      else m.box(x, y + hh, z, 0.45, 0.7, 8, rail, { top: shade(rail, 0.12) });
    }
  };
  P3.hitch = (m, x, y, z) => {
    m.set({ mat: MAT.SOLID, wind: 0, flags: 0, bone: 0 });
    const w = C('#5a3e26');
    m.box(x - 7.5, y + 4.5, z, 0.8, 4.5, 0.8, w); m.box(x + 7.5, y + 4.5, z, 0.8, 4.5, 0.8, w);
    m.set({ mat: MAT.PLANKH }); m.box(x, y + 8.6, z, 8.4, 0.7, 0.7, C('#7a5836'));
  };
  P3.trough = (m, x, y, z) => {
    m.set({ mat: MAT.PLANKH, wind: 0, flags: 0, bone: 0 });
    const w = C('#6a4a2c');
    m.box(x, y + 3.2, z - 2.8, 7.5, 3.2, 0.5, w); m.box(x, y + 3.2, z + 2.8, 7.5, 3.2, 0.5, w);
    m.box(x - 7.2, y + 3.2, z, 0.5, 3.2, 2.8, w); m.box(x + 7.2, y + 3.2, z, 0.5, 3.2, 2.8, w);
    m.set({ mat: MAT.SOLID }); m.box(x, y + 5.4, z, 6.8, 0.2, 2.4, C('#3e6a78'));
  };
  P3.well = (m, x, y, z) => {
    m.set({ mat: MAT.STONE, wind: 0, flags: 0, bone: 0 });
    m.cyl(x, y, z, 6, 6, C('#8a8278'), { seg: 14, topCol: C('#2a3a44') });
    m.set({ mat: MAT.SOLID });
    const w = C('#5a3e26');
    m.box(x - 5.5, y + 11, z, 0.7, 11, 0.7, w); m.box(x + 5.5, y + 11, z, 0.7, 11, 0.7, w);
    m.set({ mat: MAT.SHINGLE, flags: F.TWOSIDED });
    m.quad([x - 7.5, y + 19, z - 6], [x + 7.5, y + 19, z - 6], [x + 7.5, y + 24, z], [x - 7.5, y + 24, z], C('#5a3a2a'));
    m.quad([x - 7.5, y + 19, z + 6], [x + 7.5, y + 19, z + 6], [x + 7.5, y + 24, z], [x - 7.5, y + 24, z], C('#5a3a2a'));
    m.set({ mat: MAT.SOLID, flags: 0 }); m.tube([x - 5.5, y + 14, z], [x + 5.5, y + 14, z], 0.6, 0.6, C('#6a4a2c'), { seg: 5 });
  };
  P3.pump = (m, x, y, z) => {
    m.set({ mat: MAT.SOLID, wind: 0, flags: 0, bone: 0 });
    const ir = C('#3a3e44');
    m.cyl(x, y, z, 1.4, 10, ir, { seg: 8 }); m.box(x + 2.2, y + 7.5, z, 2, 0.5, 0.5, ir); m.tube([x - 0.5, y + 10.5, z], [x - 6, y + 13, z], 0.4, 0.4, ir, { seg: 4 });
    m.box(x + 2, y + 0.6, z + 3, 3, 0.6, 2.5, C('#6a4a2c'));
  };
  P3.board = (m, x, y, z) => {
    m.set({ mat: MAT.SOLID, wind: 0, flags: 0, bone: 0 });
    const w = C('#5a3e26');
    m.box(x - 6.5, y + 8, z, 0.7, 8, 0.7, w); m.box(x + 6.5, y + 8, z, 0.7, 8, 0.7, w);
    m.set({ mat: MAT.PLANKH }); m.box(x, y + 11, z, 7.4, 4.5, 0.5, C('#7a5a38'));
    m.set({ mat: MAT.SOLID });
    const rng = RNG(Math.round(x * 7 + z));
    for (let k = 0; k < 4; k++) m.box(x - 4.5 + k * 3 + rng(), y + 11 + (rng() - 0.5) * 3, z + 0.6, 1.2, 1.6, 0.1, C(['#e8dcc0', '#f0e8d0', '#d8c8a0'][k % 3]));
  };
  P3.bench = (m, x, y, z) => {
    m.set({ mat: MAT.PLANKH, wind: 0, flags: 0, bone: 0 });
    const w = C('#7a5434'), d = C('#5a3a22');
    m.box(x, y + 4.3, z, 7.5, 0.5, 2.4, w);
    m.box(x, y + 8, z - 2.3, 7.5, 2.4, 0.4, d);
    m.set({ mat: MAT.SOLID });
    for (const a of [-6.5, 6.5]) m.box(x + a, y + 2.1, z, 0.6, 2.1, 2.2, d);
  };
  P3.sign = (m, x, y, z, col) => {
    m.set({ mat: MAT.SOLID, wind: 0, flags: 0, bone: 0 });
    m.box(x, y + 7, z, 0.6, 7, 0.6, C('#5a3e26'));
    m.set({ mat: MAT.PLANKH }); m.box(x, y + 12, z + 0.6, 5.5, 3, 0.4, C(col || '#9a7a52'));
  };
  P3.crop = (m, x, y, z, rng) => {
    m.set({ mat: MAT.FOLIAGE, wind: 0.6, windBase: y, windH: 8, flags: F.NOSHADOW, bone: 0 });
    for (let k = 0; k < 4; k++) m.ell(x - 5 + k * 3.4, y + 3, z + (rng() - 0.5) * 3, 1.8, 3, 1.8, C(k % 2 ? '#6a8a3a' : '#7a9a44'), { nu: 6, nv: 4 });
    m.set({ wind: 0, flags: 0 });
  };
  // araba gövdesi: yük arabası açık kasa; posta arabası kapalı kabin (col: gövde rengi)
  P3.wagon = (m, x, y, z, ang, col, stage) => {
    m.set({ mat: MAT.PLANKH, wind: 0, flags: 0, bone: 0 });
    m.push(M4.mul(M4.translate(x, y, z), M4.rotY(-ang)));
    const w = C(col || '#7a5836'), d = shade(w, -0.28);
    m.box(0, 7, 0, 12, 1.0, 5.5, w);
    if (stage) {
      m.box(-1, 15, 0, 9, 7.2, 5.2, w, { top: shade(w, -0.35) });
      m.set({ mat: MAT.GLASS }); for (const sd of [-1, 1]) m.box(-1, 17, sd * 5.25, 4, 2.4, 0.1, C('#3a4a54'));
      m.set({ mat: MAT.SOLID }); m.box(-1, 22.6, 0, 9.6, 0.6, 5.8, C('#2a2420')); m.box(10, 11, 0, 2, 1.5, 4.5, d);
    } else {
      m.box(0, 9.5, -5.2, 12, 2.4, 0.4, d); m.box(0, 9.5, 5.2, 12, 2.4, 0.4, d); m.box(-11.7, 9.5, 0, 0.4, 2.4, 5.2, d); m.box(11.7, 9.5, 0, 0.4, 2.4, 5.2, d);
    }
    m.set({ mat: MAT.SOLID });
    for (const [wx, r] of [[-8, 5], [8, 4]]) for (const sd of [-1, 1]) {
      m.push(M4.mul(M4.translate(wx, r, sd * 6.2), M4.rotX(Math.PI / 2)));
      m.cyl(0, -0.5, 0, r, 1, C('#3a2a1a'), { seg: 12, bottom: true, topCol: C('#5a4028') });
      m.pop();
    }
    m.tube([12, 6, 0], [24, 5, 0], 0.5, 0.5, d, { seg: 4 });
    m.pop();
  };

  /* ---------------- tren ----------------
     Oyunun vagon çizimi (js/sprites.js trainCar) ölçüsünde: yerel x ileri (lokomotifin burnu +x), z yanlar, y yukarı;
     boy 28 (±14), en 12 (±6). Lokomotif: siyah kazan ve bantlar, önde baca ve buhar kubbesi, arkada kırmızı makinist
     kabini, önde kırmızı mahmuz ve fener; kömür vagonu; yeşil yolcu vagonu (sarı pencereler); kırmızı-kahve yük vagonu. */
  P3.trainCar = (m, kind) => {
    m.set({ mat: MAT.SOLID, wind: 0, flags: 0, bone: 0, param: 0 });
    const iron = C('#1e1c1c'), dark = C('#2e2a2a'), wheelC = C('#141212'), rim = C('#3a3030');
    // şasi ve tekerlekler (her yanda dört)
    m.box(0, 3.6, 0, 13.6, 0.7, 5.2, dark, { top: C('#3a3434') });
    for (const wx of [-10, -4.5, 4.5, 10]) for (const sd of [-1, 1]) {
      m.push(M4.mul(M4.translate(wx, 2.5, sd * 5.1), M4.rotX(Math.PI / 2)));
      m.cyl(0, -0.5, 0, 2.5, 1, wheelC, { seg: 10, bottom: true, topCol: rim });
      m.pop();
    }
    if (kind === 'loco') {
      const boiler = C('#24201f'), band = C('#c8a040'), red = C('#6a1a14');
      m.box(0, 4.6, 0, 14, 0.5, 6, iron);   // yürüme sahanlığı
      m.tube([-5, 10, 0], [12.6, 10, 0], 4.6, 4.6, boiler, { seg: 12, caps: false });
      m.push(M4.mul(M4.translate(12.6, 10, 0), M4.rotZ(-Math.PI / 2)));
      m.cyl(0, 0, 0, 4.7, 0.9, C('#141212'), { seg: 12, topCol: C('#2a2424') });
      m.pop();
      for (const bx of [-1.5, 3.5, 8.5]) m.tube([bx - 0.3, 10, 0], [bx + 0.3, 10, 0], 4.75, 4.75, band, { seg: 12, caps: false });
      m.cyl(9.5, 14, 0, 1.5, 6.5, iron, { seg: 10, r2: 2.4, topCol: C('#0a0808') });      // baca
      m.cyl(9.5, 20.5, 0, 2.4, 0.6, dark, { seg: 10 });
      m.ell(3.5, 14.6, 0, 1.9, 1.6, 1.9, C('#c8a040'), { nu: 10, nv: 6, ymin: 0 });      // buhar kubbesi
      // makinist kabini: kırmızı, koyu pencereler, siyah dam
      m.set({ mat: MAT.PLANKV });
      m.box(-9.5, 11.6, 0, 4.4, 6.6, 5.6, red, { top: red });
      m.set({ mat: MAT.SOLID });
      for (const sd of [-1, 1]) m.box(-9.5, 14.2, sd * 5.65, 2.6, 2.2, 0.1, C('#1a1414'));
      m.box(-9.5, 18.6, 0, 5.4, 0.55, 6.4, C('#1a1616'));
      // mahmuz (önde, kırmızı kama) ve fener
      const cw = C('#b0302a');
      m.tri([14, 5.0, -5.2], [14, 5.0, 5.2], [19, 1.0, 0], [0.62, 0.78, 0], null, null, cw);
      m.tri([14, 1.0, 5.2], [19, 1.0, 0], [14, 5.0, 5.2], [0.3, 0, 0.95], null, null, cw);
      m.tri([14, 1.0, -5.2], [14, 5.0, -5.2], [19, 1.0, 0], [0.3, 0, -0.95], null, null, cw);
      m.set({ mat: MAT.EMIT, flags: F.NOSHADOW }); m.box(13.9, 15.2, 0, 0.6, 1.2, 1.3, C('#f0e0a0'));
      m.set({ mat: MAT.SOLID, flags: 0 }); m.box(13.2, 15.2, 0, 0.8, 1.6, 1.7, C('#2a2420'));
    } else if (kind === 'tender') {
      m.set({ mat: MAT.PLANKV });
      m.box(0, 8.4, 0, 12, 4.4, 5.8, C('#2a2424'), { top: C('#2a2424') });
      m.set({ mat: MAT.STONE }); m.box(0, 12.9, 0, 10.6, 0.5, 4.6, C('#141010'));
      m.set({ mat: MAT.SOLID });
    } else {
      const fr = kind === 'freight', body = C(fr ? '#6a3a24' : '#3a4a3a'), roof = C(fr ? '#7a4a30' : '#4a5a48');
      m.set({ mat: fr ? MAT.PLANKV : MAT.PLANKH });
      m.box(0, 10.4, 0, 13, 6.2, 5.8, body, { top: roof });
      m.set({ mat: MAT.SOLID });
      m.box(0, 16.9, 0, 13.6, 0.45, 6.3, shade(roof, -0.2));
      if (!fr) {
        m.box(0, 17.8, 0, 9.5, 0.6, 3.2, roof);   // tepe penceresi sırası
        m.set({ mat: MAT.EMIT, flags: F.NOSHADOW });
        for (let k = 0; k < 4; k++) for (const sd of [-1, 1]) m.box(-9 + k * 6, 12.4, sd * 5.85, 1.5, 1.6, 0.1, C('#e8d890'));
        m.set({ mat: MAT.SOLID, flags: 0 });
        for (const ex of [-13.3, 13.3]) m.box(ex, 10.4, 0, 0.3, 5.2, 2.2, C('#2a3428'));   // uç kapıları
      } else {
        for (const sd of [-1, 1]) { m.box(0, 10.2, sd * 5.85, 4.2, 5.2, 0.12, C('#4a2616')); m.box(0, 10.2, sd * 5.95, 0.25, 5.2, 0.1, C('#2a160c')); }
      }
    }
  };
  /* bayrak kumaşı: direk yerel x = 0'da, kumaş +x yönünde uzanır; rüzgâr payı direkten uzaklaştıkça artar (F.CLOTH) */
  P3.flagCloth = (m, kind) => {
    const L = 9, H = 5.4, NX = 6, NY = 2;
    const cols = kind === 'law' ? [C('#a82a22'), C('#e8e0d0')] : [C('#2a4a7a'), C('#d8d0c0')];
    m.set({ mat: MAT.CLOTH, flags: F.CLOTH | F.TWOSIDED | F.ROOF, param: 0, windH: 0, bone: 0 });
    const n = [0, 0, 1];
    const v = (i, j, col) => { m.st.wind = Math.pow(i / NX, 0.8); m.vw([0.4 + L * i / NX, -H * j / NY, 0], n, col); };
    for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
      const col = kind === 'law' ? cols[(j + (i >> 1)) % 2] : (j === 0 && i < 3 ? cols[0] : cols[(i + j) % 2]);
      v(i, j, col); v(i + 1, j, col); v(i + 1, j + 1, col);
      v(i, j, col); v(i + 1, j + 1, col); v(i, j + 1, col);
    }
    m.set({ wind: 0, flags: 0, mat: MAT.SOLID });
  };
  /* saloon kapısının yarım kanadı: menteşe yerel x = 0, kanat +x yönünde (genişlik w) */
  P3.batwing = (m, w) => {
    const c = C('#5e3c22'), trimC = C('#b08858');
    m.set({ mat: MAT.PLANKV, wind: 0, flags: 0, bone: 0, param: 0 });
    m.box(w / 2, 13, 0, w / 2 - 0.15, 6, 0.35, c);
    m.set({ mat: MAT.SOLID });
    m.box(w / 2, 18.6, 0, w / 2 - 0.15, 0.45, 0.42, trimC); m.box(w / 2, 8.2, 0, w / 2 - 0.15, 0.4, 0.42, trimC);
  };
  /* yuvarlanan çalı: kuru dallardan top (merkez yerel 0, yarıçap r) */
  P3.tumble = (m, r) => {
    const rng = RNG(Math.round(r * 977));
    m.set({ mat: MAT.SOLID, wind: 0, flags: 0, bone: 0 });
    const cols = [C('#9a7a4a'), C('#8a6a3c'), C('#b08c58')];
    for (let k = 0; k < 14; k++) {
      const a1 = rng() * Math.PI * 2, b1 = (rng() - 0.5) * Math.PI, a2 = a1 + 1.2 + rng() * 2, b2 = (rng() - 0.5) * Math.PI;
      const P1 = [Math.cos(a1) * Math.cos(b1) * r, Math.sin(b1) * r, Math.sin(a1) * Math.cos(b1) * r];
      const P2 = [Math.cos(a2) * Math.cos(b2) * r * 0.85, Math.sin(b2) * r * 0.85, Math.sin(a2) * Math.cos(b2) * r * 0.85];
      m.tube(P1, P2, 0.28, 0.22, cols[k % 3], { seg: 3, caps: false });
    }
  };

  /* ---------------- iç mekân eşyaları ----------------
     (x, z): karonun merkezi; yer y = 0. o.back: arka duvar karosu; o.wallZ: arka duvarın iç yüzü */
  const FURN = {
    chair(m, x, z, ang, col = '#4a2e1a', seat = '#6a4428') {
      m.set({ mat: MAT.SOLID, flags: 0, bone: 0, wind: 0 });
      m.push(M4.mul(M4.translate(x, 0, z), M4.rotY(-ang)));
      const c = C(col), s = C(seat);
      for (const [lx, lz] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) m.box(lx, 2.0, lz, 0.4, 2.0, 0.4, c);
      m.box(0, 4.2, 0, 2.6, 0.45, 2.6, s, { top: shade(s, 0.08) });
      m.box(-2.3, 8.0, 0, 0.35, 3.6, 2.5, c);
      m.box(-2.3, 10.6, 0, 0.45, 0.6, 2.7, s);
      m.pop();
    },
    stool(m, x, z, h = 6.2) {
      m.set({ mat: MAT.SOLID, flags: 0, bone: 0 });
      m.cyl(x, 0, z, 0.6, h, C('#3a2416'), { seg: 6 });
      m.cyl(x, 0.6, z, 1.8, 0.4, C('#3a2416'), { seg: 8 });
      m.cyl(x, h, z, 2.5, 1.0, C('#6a4428'), { seg: 10, topCol: C('#7a5434') });
    },
    table(m, x, z, r = 6.5, felt = false, rng) {
      m.set({ mat: MAT.SOLID, flags: 0, bone: 0 });
      m.cyl(x, 0, z, 2.6, 0.6, C('#3a2416'), { seg: 8 });
      m.cyl(x, 0.6, z, 1.0, 8.4, C('#4a2e1a'), { seg: 6 });
      m.cyl(x, 8.9, z, r, 0.8, C('#4a2e1a'), { seg: 16, topCol: C('#6e4a2c') });
      if (felt) {
        m.set({ mat: MAT.CLOTH }); m.cyl(x, 9.7, z, r - 1.0, 0.08, C('#2e6a3a'), { seg: 16 }); m.set({ mat: MAT.SOLID });
        for (let i = 0; i < 6; i++) m.box(x + (rng() - 0.5) * 7, 9.85, z + (rng() - 0.5) * 7, 0.75, 0.08, 1.05, C('#f0ece0'));
        for (let i = 0; i < 4; i++) m.cyl(x + (rng() - 0.5) * 6, 9.8, z + (rng() - 0.5) * 6, 0.65, 0.5 + i % 3 * 0.3, C(['#c83030', '#3050c0', '#e8e0d0'][i % 3]), { seg: 6 });
      } else if (rng() < 0.7) {
        m.cyl(x - 1.5, 9.7, z - 1, 0.7, 1.8, C('#d8c070'), { seg: 6, topCol: C('#f0ece0') });
        if (rng() < 0.5) { m.cyl(x + 2, 9.7, z + 1, 0.75, 2.8, C('#3a5a2a'), { seg: 6 }); m.cyl(x + 2, 12.5, z + 1, 0.3, 1.3, C('#3a5a2a'), { seg: 4 }); }
      }
    },
    counter(m, x, z, kind, L, R, back) {
      // tezgâh: karo boyunca; komşu tezgâhla birleşir (uçta yan kapak)
      const top = kind === 'bar' ? C('#4a2a18') : kind === 'ticket' ? C('#6a5236') : C('#9a7048'), front = shade(top, -0.3);
      const x0 = x - 8, x1 = x + 8, h = kind === 'bar' ? 12.5 : 11;
      m.set({ mat: MAT.PLANKV, flags: 0, bone: 0 });
      m.box(x, h / 2, z, 8, h / 2, 4.5, front);
      m.set({ mat: MAT.SOLID });
      m.box(x, h + 0.5, z, 8, 0.55, 5.5, top, { top: shade(top, 0.12) });
      if (!L) m.box(x0 + 0.4, h / 2, z, 0.4, h / 2, 4.6, shade(front, -0.25));
      if (!R) m.box(x1 - 0.4, h / 2, z, 0.4, h / 2, 4.6, shade(front, -0.25));
      if (kind === 'bar') { m.box(x, 1.6, z + 6.4, 8, 0.35, 0.35, BRASS); m.box(x, h / 2, z + 4.55, 5.6, h / 2 - 2, 0.1, shade(front, 0.16)); }
      if (kind === 'ticket' || kind === 'bank') { for (let k = -6; k <= 6; k += 3) m.box(x + k, h + 5, z, 0.25, 4.5, 0.25, C('#c8b060')); m.box(x, h + 9.6, z, 8, 0.4, 0.4, C('#c8b060')); }
    },
    backbar(m, x, wallZ, rng) {
      // bar arkası (arka duvar): dolap, raf ve şişeler
      m.set({ mat: MAT.PLANKV, flags: 0, bone: 0 });
      const wood = C('#3a1e10');
      m.box(x, 6, wallZ + 3.5, 8, 6, 3.2, wood, { top: shade(wood, 0.15) });
      m.set({ mat: MAT.SOLID });
      for (const y of [18, 25]) {
        m.box(x, y, wallZ + 2.2, 8, 0.45, 2.0, C('#4a2a18'));
        for (let bx = x - 6.8; bx < x + 7; bx += 2.3) {
          const c = ['#6a3a1a', '#3a5a2a', '#8a7a4a', '#5a2a2a', '#c8b890', '#2a3a4a'][Math.floor(rng() * 6)], hh = 2.2 + rng() * 1.6;
          m.cyl(bx, y + 0.45, wallZ + 2.4, 0.75, hh, C(c), { seg: 5 }); m.cyl(bx, y + 0.45 + hh, wallZ + 2.4, 0.3, 1.1, C(c), { seg: 4 });
        }
      }
    },
    shelf(m, x, wallZ, rng, h = 26) {
      m.set({ mat: MAT.PLANKV, flags: 0, bone: 0 });
      const wood = C('#4a2e1a');
      m.box(x, h / 2, wallZ + 3, 7, h / 2, 3, wood);
      m.set({ mat: MAT.SOLID });
      const cols = ['#c8402c', '#e0c060', '#4a7aa8', '#6a9a4a', '#d8d0c0', '#8a5a2a'];
      for (let y = 3; y < h - 3; y += 6.5) {
        m.box(x, y, wallZ + 5.6, 6.4, 0.4, 0.5, shade(wood, 0.1));
        for (let bx = x - 5.2; bx < x + 5.5; bx += 2.6) { const hh = 2.5 + rng() * 2; m.box(bx, y + 0.4 + hh / 2, wallZ + 4.4, 1.0, hh / 2, 1.3, C(cols[Math.floor(rng() * cols.length)])); }
      }
    },
    bookcase(m, x, wallZ, rng) {
      m.set({ mat: MAT.PLANKV, flags: 0, bone: 0 });
      const wood = C('#4a2e1a'), h = 32;
      m.box(x, h / 2, wallZ + 3, 7, h / 2, 3, wood);
      m.set({ mat: MAT.SOLID });
      for (let y = 3; y < h - 4; y += 7) {
        m.box(x, y, wallZ + 5.6, 6.4, 0.4, 0.5, shade(wood, 0.1));
        for (let bx = x - 5.6; bx < x + 5.8; bx += 1.3 + rng() * 0.6) { const c = ['#7a2a2a', '#2a4a6a', '#5a4a2a', '#3a5a3a', '#6a5a4a', '#2a2a2a'][Math.floor(rng() * 6)], hh = 4 + rng() * 1.8; m.box(bx, y + 0.4 + hh / 2, wallZ + 4.6, 0.55, hh / 2, 1.5, C(c)); }
      }
    },
    piano(m, x, z) {
      m.set({ mat: MAT.SOLID, flags: 0, bone: 0 });
      const body = C('#2a1a12');
      m.box(x, 11, z - 3, 8, 11, 3.5, body, { top: C('#3e2a1c') });
      m.box(x, 10.3, z + 1.6, 8, 0.9, 2.2, body);
      m.box(x, 11.3, z + 1.4, 7.6, 0.15, 1.6, C('#f0ece0'));
      for (let k = -7; k < 7.5; k += 1.4) if (Math.round(k * 10) % 3 !== 0) m.box(x + k, 11.55, z + 1.0, 0.32, 0.18, 0.9, C('#1a1a1a'));
      m.box(x - 6.5, 1.2, z + 1, 1.2, 1.2, 1.6, body); m.box(x + 6.5, 1.2, z + 1, 1.2, 1.2, 1.6, body);
      m.cyl(x + 4, 22, z - 3, 0.9, 2.5, C('#e8d070'), { seg: 6 });
    },
    stove(m, x, z, pipeTop) {
      m.set({ mat: MAT.SOLID, flags: 0, bone: 0 });
      const iron = C('#222226');
      for (const [a, b] of [[-3.5, -3.5], [3.5, -3.5], [-3.5, 3.5], [3.5, 3.5]]) m.box(x + a, 1.2, z + b, 0.6, 1.2, 0.6, iron);
      m.box(x, 7, z, 5, 4.6, 5, iron, { top: C('#3a3a40') });
      m.box(x, 11.9, z, 5.4, 0.4, 5.4, C('#3a3a40'));
      m.set({ mat: MAT.FIRE, flags: F.NOSHADOW });
      m.box(x, 6.5, z + 5.05, 2.6, 1.8, 0.1, C('#e87020'));
      m.set({ mat: MAT.SOLID, flags: 0 });
      m.cyl(x - 1, 12.2, z - 1, 1.5, pipeTop - 12.2, C('#2e2e32'), { seg: 8 });
      m.cyl(x + 2.3, 12.3, z + 1.5, 1.2, 2.2, C('#5a3a2a'), { seg: 6 });
    },
    fireplace(m, x, wallZ) {
      m.set({ mat: MAT.STONE, flags: 0, bone: 0 });
      const st = C('#7a7068');
      m.box(x, 11, wallZ + 3, 9, 11, 3, st);
      m.box(x, 22.5, wallZ + 3.5, 10, 0.8, 4, C('#5a3e26'));
      m.set({ mat: MAT.SOLID }); m.box(x, 6, wallZ + 6.05, 5, 5, 0.1, C('#120a06'));
      m.set({ mat: MAT.FIRE, flags: F.NOSHADOW }); m.cyl(x, 1, wallZ + 4.5, 2.6, 4.5, C('#f0a030'), { seg: 7, r2: 0.3 });
      m.set({ flags: 0 });
    },
    forge(m, x, z) {
      m.set({ mat: MAT.BRICK, flags: 0, bone: 0 });
      m.box(x, 5, z, 7, 5, 6, C('#6a3a2a'));
      m.set({ mat: MAT.FIRE, flags: F.NOSHADOW }); m.box(x, 10.2, z, 4, 0.4, 3.5, C('#f07020'));
      m.set({ mat: MAT.SOLID, flags: 0 }); m.cyl(x, 10, z - 2, 3.5, 22, C('#2e2e32'), { seg: 8, r2: 1.6 });
    },
    anvil(m, x, z) {
      m.set({ mat: MAT.SOLID, flags: 0, bone: 0 });
      m.cyl(x, 0, z, 3, 5, C('#5a3e26'), { seg: 8 });
      m.box(x, 6.2, z, 4.5, 1.2, 1.8, C('#3a3a40')); m.box(x + 5.2, 6.6, z, 1.6, 0.6, 1.0, C('#3a3a40'));
    },
    bed(m, x, z, len, blanket) {
      // yatak: başı kuzeyde, iki karo boyu (z boyunca)
      m.set({ mat: MAT.SOLID, flags: 0, bone: 0 });
      const fr = C('#5a3a22');
      for (const [a, b] of [[-5.5, -len / 2 + 1], [5.5, -len / 2 + 1], [-5.5, len / 2 - 1], [5.5, len / 2 - 1]]) m.box(x + a, 2.5, z + b, 0.6, 2.5, 0.6, fr);
      m.box(x, 4.6, z, 6, 0.6, len / 2, fr);
      m.box(x, 8, z - len / 2 + 0.6, 6, 4, 0.6, C('#3a2416'));
      m.set({ mat: MAT.CLOTH });
      m.box(x, 5.8, z, 5.4, 0.7, len / 2 - 0.5, C('#e8e4d8'));
      m.box(x, 6.9, z - len / 2 + 3.8, 3.8, 0.6, 2.6, C('#f8f4ec'));
      m.box(x, 6.7, z + len * 0.1, 5.6, 0.45, len * 0.36, C(blanket));
    },
    pew(m, x, z, L, R) {
      m.set({ mat: MAT.SOLID, flags: 0, bone: 0 });
      const w = C('#7a5434'), d = C('#5a3a22');
      m.box(x, 4.3, z, 8, 0.5, 2.8, w);
      m.box(x, 8.5, z + 2.6, 8, 3.6, 0.45, d);
      if (!L) m.box(x - 7.4, 4.4, z, 0.6, 4.4, 2.8, d);
      if (!R) m.box(x + 7.4, 4.4, z, 0.6, 4.4, 2.8, d);
    },
    altar(m, x, z) {
      m.set({ mat: MAT.SOLID, flags: 0, bone: 0 });
      m.box(x + 8, 5, z, 14, 5, 4.5, C('#6a4a2c'));
      m.set({ mat: MAT.CLOTH }); m.box(x + 8, 10.3, z, 14.2, 0.4, 4.7, C('#f0ece0')); m.box(x + 8, 7, z + 4.75, 4, 3, 0.1, C('#f0ece0'));
      m.set({ mat: MAT.SOLID }); m.box(x + 8, 14, z - 1, 0.5, 3.5, 0.5, C('#c8a040')); m.box(x + 8, 15.5, z - 1, 2, 0.5, 0.5, C('#c8a040'));
      m.set({ mat: MAT.EMIT }); for (const a of [-1, 17]) m.cyl(x + a, 10.7, z, 0.5, 3, C('#f8f0d8'), { seg: 5 });
      m.set({ mat: MAT.SOLID });
    },
    lectern(m, x, z) {
      m.set({ mat: MAT.SOLID, flags: 0, bone: 0 });
      m.box(x, 6, z, 1.2, 6, 1.2, C('#5a3a22')); m.box(x, 12.5, z, 3.5, 0.8, 2.8, C('#6a4a2c'));
      m.box(x, 13.5, z, 2.4, 0.2, 1.8, C('#f0e8d0'));
    },
    organ(m, x, wallZ) {
      m.set({ mat: MAT.SOLID, flags: 0, bone: 0 });
      m.box(x, 9, wallZ + 4, 8, 9, 3, C('#3a2416'));
      for (let k = -6; k <= 6; k += 2) m.cyl(x + k, 18, wallZ + 3, 0.7, 8 + (6 - Math.abs(k)) * 1.2, C('#c8b070'), { seg: 6 });
      m.box(x, 10.5, wallZ + 7.4, 6, 0.3, 1.2, C('#f0ece0'));
    },
    desk(m, x0, x1, z, rng) {
      m.set({ mat: MAT.PLANKV, flags: 0, bone: 0 });
      const top = C('#6e4a2c'), front = C('#4a2e1a');
      m.box((x0 + x1) / 2, 5, z, (x1 - x0) / 2, 5, 4.5, front);
      m.set({ mat: MAT.SOLID });
      m.box((x0 + x1) / 2, 10.4, z, (x1 - x0) / 2 + 0.8, 0.5, 5.3, top, { top: shade(top, 0.1) });
      m.box(x0 + 5, 11, z, 2.6, 0.1, 3.0, C('#f0e8d0')); m.box(x0 + 10, 11, z - 1.5, 2.0, 0.1, 2.4, C('#e8dcc0'));
      m.cyl(x0 + 14, 10.9, z - 2, 0.7, 1.2, C('#1a1a1a'), { seg: 6 });
      m.set({ mat: MAT.EMIT }); m.cyl(x1 - 4, 10.9, z - 2, 1.0, 2.4, C('#ffd890'), { seg: 6 }); m.set({ mat: MAT.SOLID });
    },
    rack(m, x, wallZ) {
      m.set({ mat: MAT.SOLID, flags: 0, bone: 0 });
      const w = C('#4a2e1a');
      m.box(x, 22, wallZ + 1.2, 7.5, 1.0, 1.2, w); m.box(x, 6, wallZ + 1.2, 7.5, 1.0, 1.4, w);
      for (let k = -5; k <= 5; k += 3.4) { m.box(x + k, 14, wallZ + 2.2, 0.35, 8.5, 0.35, IRON); m.box(x + k, 7.5, wallZ + 2.4, 0.7, 3.5, 0.55, C('#6a4428')); }
    },
    cell(m, x, z, hz, vt) {
      m.set({ mat: MAT.SOLID, flags: 0, bone: 0 });
      const h = 26;
      if (hz || !vt) { for (let k = -7; k <= 7; k += 3) m.box(x + k, h / 2, z, 0.4, h / 2, 0.4, IRON); m.box(x, h - 0.6, z, 8, 0.6, 0.6, IRON); m.box(x, 1.2, z, 8, 0.5, 0.5, IRON); m.box(x, h * 0.55, z, 8, 0.5, 0.5, IRON); }
      if (vt) { for (let k = -7; k <= 7; k += 3) m.box(x, h / 2, z + k, 0.4, h / 2, 0.4, IRON); m.box(x, h - 0.6, z, 0.6, 0.6, 8, IRON); m.box(x, h * 0.55, z, 0.5, 0.5, 8, IRON); }
    },
    stall(m, x, z) {
      // ahır bölmesi: kuzey-güney uzanan yarım duvar ve direk
      m.set({ mat: MAT.PLANKV, flags: 0, bone: 0 });
      m.box(x, 6, z, 0.8, 6, 7.5, C('#6a4a2c'));
      m.set({ mat: MAT.SOLID }); m.box(x, 9, z - 7.5, 1.4, 9, 1.4, C('#5a3a1e'));
    },
    sofa(m, x, z, L, R, col = '#6a2a2a') {
      m.set({ mat: MAT.CLOTH, flags: 0, bone: 0 });
      const c = C(col);
      m.box(x, 3.2, z, 8, 2.2, 4.4, shade(c, -0.1));
      m.box(x, 5.8, z + 0.5, 8, 0.6, 3.6, c);
      m.box(x, 8.4, z - 3.6, 8, 3.4, 1.2, c);
      if (!L) m.box(x - 7.2, 6.2, z, 1.0, 2.6, 4.2, shade(c, -0.05));
      if (!R) m.box(x + 7.2, 6.2, z, 1.0, 2.6, 4.2, shade(c, -0.05));
    },
    armchair(m, x, z) {
      m.set({ mat: MAT.CLOTH, flags: 0, bone: 0 });
      const c = C('#5a3a5a');
      m.box(x, 3, z, 4.5, 2, 4.2, shade(c, -0.1)); m.box(x, 5.4, z + 0.6, 3.6, 0.6, 3.4, c); m.box(x, 8.6, z - 3.4, 4.5, 3.6, 1.0, c);
      for (const sd of [-1, 1]) m.box(x + sd * 4, 6, z, 0.9, 2.2, 4, shade(c, -0.05));
    },
    cabinet(m, x, wallZ, h = 18, col = '#5a3a22') {
      m.set({ mat: MAT.PLANKV, flags: 0, bone: 0 });
      const c = C(col);
      m.box(x, h / 2, wallZ + 3.5, 7, h / 2, 3.5, c, { top: shade(c, 0.12) });
      m.set({ mat: MAT.SOLID }); m.box(x, h / 2, wallZ + 7.05, 0.15, h / 2 - 1, 0.1, shade(c, -0.35));
      m.box(x - 1.2, h * 0.55, wallZ + 7.15, 0.3, 0.6, 0.2, BRASS); m.box(x + 1.2, h * 0.55, wallZ + 7.15, 0.3, 0.6, 0.2, BRASS);
    },
    clock(m, x, wallZ) {
      m.set({ mat: MAT.SOLID, flags: 0, bone: 0 });
      const c = C('#4a2a18');
      m.box(x, 13, wallZ + 2.5, 2.6, 13, 2.2, c); m.cyl(x, 22, wallZ + 4.8, 1.8, 0.2, C('#f0ece0'), { seg: 10 });
      m.box(x, 10, wallZ + 4.75, 0.6, 3, 0.1, BRASS);
    },
    washstand(m, x, wallZ) {
      m.set({ mat: MAT.SOLID, flags: 0, bone: 0 });
      m.box(x, 5, wallZ + 3, 4.5, 5, 3, C('#6a4a2c'));
      m.cyl(x, 10, wallZ + 3, 2.8, 1.4, C('#e8e8e0'), { seg: 10, topCol: C('#7aa8c0') });
      m.box(x, 18, wallZ + 0.6, 3.2, 4, 0.3, C('#9fb0b6'));
    },
    tub(m, x, z) {
      m.set({ mat: MAT.SOLID, flags: 0, bone: 0 });
      m.push(M4.mul(M4.translate(x, 0, z), M4.scale(1.6, 1, 1)));
      m.cyl(0, 0, 0, 5, 6, C('#9aa0a6'), { seg: 14, topCol: C('#7aa8c0') });
      m.pop();
    },
    mannequin(m, x, z, rng) {
      m.set({ mat: MAT.SOLID, flags: 0, bone: 0 });
      m.cyl(x, 0, z, 2, 0.6, C('#3a2416'), { seg: 8 }); m.cyl(x, 0.6, z, 0.4, 10, C('#3a2416'), { seg: 5 });
      m.set({ mat: MAT.CLOTH }); m.ell(x, 15, z, 2.6, 5, 3.6, C(['#5a4a3a', '#2e3a4a', '#6a3a2a', '#7a6078'][Math.floor(rng() * 4)]), { nu: 10, nv: 7 });
      m.set({ mat: MAT.SOLID }); m.ell(x, 21, z, 1.2, 1.4, 1.2, C('#d8c8a8'), { nu: 8, nv: 5 });
    },
    display(m, x, z) {
      m.set({ mat: MAT.SOLID, flags: 0, bone: 0 });
      m.box(x, 4.5, z, 7, 4.5, 4, C('#4a2e1a'));
      m.set({ mat: MAT.GLASS }); m.box(x, 10.5, z, 6.6, 1.6, 3.6, C('#9fb0b6'));
      m.set({ mat: MAT.SOLID }); m.box(x - 2, 9.4, z, 1.6, 0.4, 1.2, BRASS); m.box(x + 2.5, 9.4, z + 1, 1.2, 0.4, 0.8, C('#c8ccd0'));
    },
    sacks(m, x, z, rng) {
      m.set({ mat: MAT.CLOTH, flags: 0, bone: 0 });
      for (let k = 0; k < 3; k++) m.ell(x - 4 + k * 4 + rng(), 3.2, z + (rng() - 0.5) * 4, 2.6, 3.4, 2.4, C(k % 2 ? '#b8a070' : '#c8b080'), { nu: 8, nv: 6 });
      m.ell(x - 2, 8, z, 2.4, 2.8, 2.2, C('#b8a070'), { nu: 8, nv: 6 });
    },
    workbench(m, x, z, butcher) {
      m.set({ mat: MAT.PLANKH, flags: 0, bone: 0 });
      m.box(x, 5, z, 8, 5, 4.5, C('#5a3a22'));
      m.box(x, 10.4, z, 8.2, 0.5, 4.8, C('#8a6440'));
      m.set({ mat: MAT.SOLID });
      m.box(x - 3, 11.2, z, 3, 0.3, 0.8, C('#9a9ea4')); m.box(x + 3, 11.4, z - 1, 0.4, 0.6, 2, C('#6a4428'));
      if (butcher) m.ell(x - 1, 11.6, z + 1, 2.6, 1, 1.8, C('#a8382a'), { nu: 8, nv: 4 });
    },
    scale(m, x, z) {
      m.set({ mat: MAT.SOLID, flags: 0, bone: 0 });
      m.box(x, 2, z, 4, 2, 3, C('#3a3a40')); m.box(x, 8, z - 2, 0.5, 6, 0.5, C('#3a3a40'));
      m.cyl(x, 4.2, z, 3, 0.4, BRASS, { seg: 10 }); m.cyl(x, 14, z - 2, 2.2, 0.3, C('#f0ece0'), { seg: 10 });
    },
    telegraph(m, x, z) {
      m.set({ mat: MAT.SOLID, flags: 0, bone: 0 });
      m.box(x, 5, z, 6, 5, 4, C('#5a3a22')); m.box(x, 10.6, z, 6.3, 0.5, 4.3, C('#6e4a2c'));
      m.box(x - 2, 11.6, z, 2, 0.6, 1.4, BRASS); m.box(x + 2.5, 12, z - 1, 1.5, 1, 1.5, C('#2e2e34'));
    },
    saddle(m, x, z) {
      m.set({ mat: MAT.SOLID, flags: 0, bone: 0 });
      m.box(x, 4.5, z, 6, 4.5, 1, C('#5a3a22'));
      m.ell(x, 10.5, z, 4.5, 2, 3.2, C('#6a4428'), { nu: 10, nv: 6 });
      m.cyl(x + 3.5, 11, z, 0.6, 2, C('#5a3820'), { seg: 6 });
    },
    oven(m, x, wallZ) {
      m.set({ mat: MAT.BRICK, flags: 0, bone: 0 });
      m.box(x, 9, wallZ + 4, 8, 9, 4, C('#8a4a30'));
      m.set({ mat: MAT.SOLID }); m.box(x, 7, wallZ + 8.05, 3.5, 2.5, 0.1, C('#1a0e08'));
      m.set({ mat: MAT.FIRE, flags: F.NOSHADOW }); m.box(x, 5.4, wallZ + 8.1, 2.6, 0.8, 0.1, C('#f07020'));
      m.set({ flags: 0 });
    },
    plant(m, x, z, rng) {
      m.set({ mat: MAT.SOLID, flags: 0, bone: 0 });
      m.cyl(x, 0, z, 3.0, 5.5, C('#8a5a3a'), { seg: 10, r2: 3.6, topCol: C('#3a2a1c') });
      m.set({ mat: MAT.FOLIAGE, flags: F.TWOSIDED, wind: 0 });
      for (let i = 0; i < 9; i++) {
        const a = i / 9 * Math.PI * 2 + rng() * 0.4, L = 6 + rng() * 3, tip = [x + Math.cos(a) * L * 0.75, 6 + L * 0.9, z + Math.sin(a) * L * 0.75];
        const w = [Math.cos(a + 1.57) * 1.4, 0, Math.sin(a + 1.57) * 1.4];
        m.tri([x - w[0], 5.6, z - w[2]], [x + w[0], 5.6, z + w[2]], tip, [Math.cos(a), 0.6, Math.sin(a)], null, null, C(i % 2 ? '#3a6a2a' : '#4e8034'));
      }
      m.set({ flags: 0 });
    },
    coatrack(m, x, z) {
      m.set({ mat: MAT.SOLID, flags: 0, bone: 0 });
      m.cyl(x, 0, z, 2.6, 0.5, C('#3a2416'), { seg: 8 });
      m.cyl(x, 0, z, 0.55, 26, C('#4a2e1a'), { seg: 6 });
      for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; m.tube([x, 23, z], [x + Math.cos(a) * 3, 25, z + Math.sin(a) * 3], 0.3, 0.3, C('#4a2e1a'), { seg: 4 }); }
      m.cyl(x + 2.6, 22.5, z, 2.4, 0.3, C('#3a2a1e'), { seg: 10 }); m.cyl(x + 2.6, 22.8, z, 1.5, 2, C('#3a2a1e'), { seg: 10 });
      m.set({ mat: MAT.CLOTH }); m.box(x - 1.6, 17, z, 1.3, 6, 2.6, C('#5a4a3a'));
    },
    bchair(m, x, z) {
      m.set({ mat: MAT.SOLID, flags: 0, bone: 0 });
      m.cyl(x, 0, z, 3, 0.6, C('#c0c4c8'), { seg: 10 }); m.cyl(x, 0.6, z, 0.8, 4.4, C('#c0c4c8'), { seg: 6 });
      m.set({ mat: MAT.CLOTH }); m.box(x, 6, z + 0.5, 4.2, 1.2, 3.8, C('#8a2020')); m.box(x, 10.5, z - 3.4, 4.2, 4.5, 0.9, C('#6a1818'));
      m.set({ mat: MAT.SOLID }); for (const sd of [-1, 1]) m.box(x + sd * 4.6, 8, z + 0.5, 0.4, 0.4, 3.4, C('#c0c4c8'));
    },
    stairs(m, x, z, n) {
      // merdiven: güneyden kuzeye yükselir (n: basamak ızgarası karosu sırası)
      m.set({ mat: MAT.PLANKH, flags: 0, bone: 0 });
      const w = C('#6a4a2c');
      for (let k = 0; k < 4; k++) m.box(x, (n * 4 + k + 1) * 2.2 / 2, z + 6 - k * 4, 7, (n * 4 + k + 1) * 2.2 / 2, 2, shade(w, k % 2 ? 0 : 0.06));
    },
    wardrobe(m, x, wallZ) { FURN.cabinet(m, x, wallZ, 28, '#4a2e1a'); },
    dresser(m, x, wallZ) {
      FURN.cabinet(m, x, wallZ, 11, '#6a4a2c');
      m.set({ mat: MAT.SOLID }); m.box(x, 18, wallZ + 0.7, 4, 5, 0.3, C('#9fb0b6')); m.box(x, 18, wallZ + 0.5, 4.6, 5.6, 0.25, C('#4a2e1a'));
    },
    safe(m, x, wallZ) {
      m.set({ mat: MAT.SOLID, flags: 0, bone: 0 });
      m.box(x, 7, wallZ + 4, 6, 7, 4, C('#2e3238')); m.cyl(x, 8, wallZ + 8.1, 2.2, 0.3, C('#c8b060'), { seg: 10 });
    },
    generic(m, x, z, col = '#6a4a2c', h = 8) { m.set({ mat: MAT.SOLID, flags: 0, bone: 0 }); m.box(x, h / 2, z, 6, h / 2, 5, C(col), { top: shade(C(col), 0.1) }); },
  };

  Object.assign(D3, { HUMAN_SK, HORSE_SK, skelPose, buildHuman, POSE, armPose, buildHorse, HPOSE, buildAnimal, animalSkel, animalPose, P3, FURN });
})();
