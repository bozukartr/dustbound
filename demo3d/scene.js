'use strict';
/* =====================================================================
   3B TEST DEMOSU — oyun dünyasından durağan sahne
   Bölge (karo dikdörtgeni) içindeki zemin, binalar (duvarlar oyunun çarpışma düzenine oturur: arka duvar
   ilk karo sırası, yan duvarlar 5 px, ön duvar 4 px, kapı karosu açık), iç mekân eşyaları (world.obj),
   dış nesneler ve statik ışıklar. Yerel koordinat: X = px − OX, Z = py − OZ (sayılar küçük kalır).
   ===================================================================== */
(() => {
  const { M4, C, shade, mixc, INK, MAT, F, SIDE, RNG, Mesh, GPUMesh, P3, FURN } = D3;

  /* iç mekân tarzı (js/sprites.js içindeki STD tablosunun kopyası): [zemin, duvar] */
  const STD = {
    general: [['plank', '#7a5a3a'], ['paper', '#7e6044']], saloon: [['plank', '#5e4028'], ['paper', '#6a2a24']], sheriff: [['plank', '#6e5a40'], ['plankv', '#8a7a60']],
    doctor: [['plank', '#a08a6a'], ['plaster', '#d8d0c0']], gunsmith: [['plank', '#6a4a30'], ['plankv', '#5e4e3e']], butcher: [['plank', '#8a6a4a'], ['plaster', '#bfae94']],
    stable: [['straw', '#8a7250'], ['plankv', '#7a5a38']], barn: [['straw', '#8a7250'], ['plankv', '#7a2e22']], bank: [['checker', '#8a7a64'], ['paper', '#2e4234']],
    station: [['plank', '#6a5a44'], ['paper', '#6a5e4a']], church: [['plank', '#9a7a52'], ['plaster', '#e8e0d0']], land: [['plank', '#7a5a3a'], ['paper', '#8a7a5a']],
    barber: [['hex', '#dcd6c8'], ['paper', '#b8a890']], tailor: [['plank', '#7a5a3a'], ['paper', '#7a6078']], fence: [['plank', '#4e3a28'], ['plankv', '#4a3a2a']],
    mine: [['plank', '#6a5a48'], ['plankv', '#5a5048']], lumber: [['plank', '#8a6a44'], ['plankv', '#7a5a34']], docks: [['plank', '#6a6258'], ['plankv', '#5a5a54']],
    ranch: [['plank', '#7a5a3a'], ['log', '#7a5434']], house: [['plank', '#7a5a3a'], ['paper', '#8a7058']], property: [['plank', '#7a5a3a'], ['log', '#7a5434']],
    cabin: [['plank', '#5a4430'], ['log', '#5a3a1e']], hs_shack: [['plank', '#6a5038'], ['plankv', '#6a4a2e']], hs_cabin: [['plank', '#6e5236'], ['log', '#6a4424']],
    hs_house: [['plank', '#7a5a3a'], ['paper', '#9a8262']], bakery: [['brick', '#9a5a3a'], ['plaster', '#d8c8a8']], smith: [['stone', '#5a5550'], ['brick', '#6a3a2a']],
    pharmacy: [['hex', '#e8e4da'], ['paper', '#3a5a4a']], laundry: [['plank', '#7a6c5c'], ['plaster', '#c8c8c0']], gambling: [['plank', '#4a3020'], ['paper', '#5a1a1a']],
    brewery: [['brick', '#7a4a30'], ['brick', '#7a4a30']], mill: [['plank', '#9a8060'], ['plankv', '#8a7050']], county: [['plank', '#6e5232'], ['paper', '#8a8468']],
    post: [['plank', '#7a5a3a'], ['paper', '#5a6a70']], warehouse: [['plank', '#7a6a50'], ['plankv', '#6a5a48']], cantina: [['hex', '#9e5a3c'], ['plaster', '#d8b888']],
    hotel: [['plank', '#7a5434'], ['paper', '#6a4a3a']],
  };
  const FLOORMAT = { plank: MAT.FLOOR, straw: MAT.STRAW, checker: MAT.CHECK, hex: MAT.CHECK, brick: MAT.STONE, stone: MAT.STONE, parquet: MAT.FLOOR, ttile: MAT.CHECK, wide: MAT.FLOOR };
  const WALLMAT = { paper: MAT.PAPER, plaster: MAT.PLASTER, plankv: MAT.PLANKV, log: MAT.LOG, brick: MAT.BRICK, stripe: MAT.PAPER, damask: MAT.PAPER, panel: MAT.PLANKV };
  // yalancı cepheli dükkânlar (geri kalanlar beşik çatılı)
  const GABLE = new Set(['house', 'church', 'stable', 'barn', 'cabin', 'ranch', 'hs_shack', 'hs_cabin', 'hs_house', 'property', 'ruin', 'hermit', 'mill', 'lumber', 'warehouse', 'docks', 'mine']);
  const GABLE_Z = new Set(['church', 'stable', 'barn', 'mill']);   // alınlığı sokağa bakan
  const LOGW = new Set(['cabin', 'hs_cabin', 'ranch']);
  const BACKWALL_O = new Set([O.SHELF, O.BOOKCASE, O.CABINET, O.WARDROBE, O.DRESSER, O.GCLOCK, O.FIREPLACE, O.OVEN, O.ORGAN, O.RACK, O.WASHSTAND, O.SAFE]);
  const HEARTHS = new Set([O.FIREPLACE, O.STOVE, O.FORGE, O.OVEN]);

  /* ---------------- bina ---------------- */
  function building(b, W, OX, OZ) {
    const m = new Mesh(24000);
    const d = b.def, type = b.type, rng = RNG(b.x * 977 + b.y * 131 + 7);
    const X0 = b.x * 16 - OX, Z0 = b.y * 16 - OZ, Wd = b.w * 16, Hd = b.h * 16, X1 = X0 + Wd, Z1 = Z0 + Hd;
    const gable = GABLE.has(type), gz = GABLE_Z.has(type);
    const Hw = d.tall ? 52 : type === 'house' || type.startsWith('hs_') ? 34 : type === 'church' ? 44 : 38;
    const wallC = C(d.wall || '#8a6a48'), roofC = C(d.roof || '#4a3424'), trim = mixc(wallC, C('#e8dcc0'), 0.55);
    const extMat = d.brick ? MAT.BRICK : LOGW.has(type) ? MAT.LOG : type === 'stable' || type === 'barn' ? MAT.PLANKV : type === 'church' || type === 'doctor' ? MAT.PLASTER : MAT.PLANKH;
    const S = STD[type] || [['plank', '#7a5a3a'], ['paper', '#8a7058']];
    const flMat = FLOORMAT[S[0][0]] || MAT.FLOOR, flC = C(S[0][1]);
    const inMat = WALLMAT[S[1][0]] || MAT.PAPER, inC = C(S[1][1]);
    const capC = shade(wallC, -0.55);
    const enter = b.enter;
    // temel ve iç döşeme
    m.set({ mat: MAT.STONE, flags: 0, param: 0, wind: 0, bone: 0 });
    m.box(X0 + Wd / 2, -0.4, Z0 + Hd / 2, Wd / 2 + 0.6, 0.6, Hd / 2 + 0.6, C('#6a645c'));
    if (enter) { m.set({ mat: flMat }); m.box(X0 + Wd / 2, 0.2, Z0 + 15 + (Hd - 19) / 2, Wd / 2 - 5, 0.2, (Hd - 19) / 2, flC); }
    // duvar parçası: [u0,u1] boyunca, dış ve iç kat ayrı malzeme
    const wallBox = (x0, x1, z0, z1, y0, y1, mat, col, flags, param, top) => {
      if (x1 - x0 < 0.05 || z1 - z0 < 0.05 || y1 - y0 < 0.05) return;
      m.set({ mat, flags, param });
      m.box((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, (x1 - x0) / 2, (y1 - y0) / 2, (z1 - z0) / 2, col, { top: top || capC });
    };
    // arka duvar: ilk karo sırası (çarpışmada dolu); içi oda tarafında
    wallBox(X0, X1, Z0 + 0.5, Z0 + 12, 0, Hw, extMat, wallC, 0, SIDE.n);
    wallBox(X0 + 5, X1 - 5, Z0 + 12, Z0 + 15.5, 0, Hw, enter ? inMat : extMat, enter ? inC : wallC, 0, SIDE.n);
    // yan duvarlar (5 px)
    wallBox(X0, X0 + 3, Z0, Z1, 0, Hw, extMat, wallC, 0, SIDE.w);
    wallBox(X0 + 3, X0 + 5, Z0 + 12, Z1 - 4, 0, Hw, enter ? inMat : extMat, enter ? inC : wallC, 0, SIDE.w);
    wallBox(X1 - 3, X1, Z0, Z1, 0, Hw, extMat, wallC, 0, SIDE.e);
    wallBox(X1 - 5, X1 - 3, Z0 + 12, Z1 - 4, 0, Hw, enter ? inMat : extMat, enter ? inC : wallC, 0, SIDE.e);
    // ön duvar: kapı ve pencere açıklıkları; kesitte alçalır
    const dx = b.door.x - OX, DW = type === 'stable' || type === 'barn' ? 9 : 7, DH = type === 'stable' || type === 'barn' ? 30 : 27;
    const nWin = Math.max(1, Math.floor(b.w / 3)), wins = [];
    for (let k = 0; k < nWin; k++) { const cx = X0 + (k + 0.5) * Wd / nWin; if (Math.abs(cx - dx) >= 10) wins.push(cx); }
    const ops = [{ u0: dx - DW, u1: dx + DW, y0: 0, y1: DH, door: true }];
    const WY0 = 11, WY1 = 25, WW2 = 5;
    for (const cx of wins) { ops.push({ u0: cx - WW2, u1: cx + WW2, y0: WY0, y1: WY1 }); if (d.tall) ops.push({ u0: cx - WW2, u1: cx + WW2, y0: 33, y1: 45 }); }
    const cuts = [X0, X1];
    for (const o of ops) cuts.push(o.u0, o.u1);
    cuts.sort((a, c) => a - c);
    for (let i = 1; i < cuts.length; i++) {
      const u0 = cuts[i - 1], u1 = cuts[i];
      if (u1 - u0 < 0.05) continue;
      const um = (u0 + u1) / 2, hit = ops.filter(o => o.u0 <= um && o.u1 >= um).sort((a, c) => a.y0 - c.y0);
      const spans = [];
      let y = 0;
      for (const o of hit) { if (o.y0 > y) spans.push([y, o.y0]); y = Math.max(y, o.y1); }
      if (y < Hw) spans.push([y, Hw]);
      for (const [ya, yb] of spans) {
        wallBox(u0, u1, Z1 - 2, Z1, ya, yb, extMat, wallC, F.CUT, SIDE.s);
        wallBox(Math.max(u0, X0 + 5), Math.min(u1, X1 - 5), Z1 - 4, Z1 - 2, ya, yb, enter ? inMat : extMat, enter ? inC : wallC, F.CUT, SIDE.s);
      }
    }
    // pencereler: cam, çerçeve, pervaz (kesitte gizlenir)
    for (const o of ops) {
      if (o.door) continue;
      const cx = (o.u0 + o.u1) / 2, hw = (o.u1 - o.u0) / 2, fy = (o.y0 + o.y1) / 2, fh = (o.y1 - o.y0) / 2;
      m.set({ mat: MAT.GLASS, flags: F.HIDECUT | F.NOSHADOW, param: SIDE.s });
      m.box(cx, fy, Z1 - 2, hw, fh, 0.2, C('#3a4a54'));
      m.set({ mat: MAT.SOLID, flags: F.HIDECUT, param: SIDE.s });
      m.box(cx, o.y1 + 0.5, Z1 + 0.3, hw + 1.0, 0.6, 0.35, trim);
      m.box(cx, o.y0 - 0.4, Z1 + 0.3, hw + 1.0, 0.5, 0.35, trim);
      m.box(cx - hw - 0.5, fy, Z1 + 0.3, 0.5, fh + 0.5, 0.35, trim);
      m.box(cx + hw + 0.5, fy, Z1 + 0.3, 0.5, fh + 0.5, 0.35, trim);
      m.box(cx, o.y0 - 0.8, Z1 + 0.9, hw + 1.4, 0.4, 1.0, trim);
      m.box(cx, fy, Z1 - 1.6, 0.28, fh, 0.15, trim); m.box(cx, fy, Z1 - 1.6, hw, 0.28, 0.15, trim);
    }
    // kapı: kasa ve içe açık kanat (saloon: yarım kanatlı)
    m.set({ mat: MAT.SOLID, flags: F.HIDECUT, param: SIDE.s });
    m.box(dx, DH + 0.7, Z1 + 0.3, DW + 1.2, 0.7, 0.4, trim);
    m.box(dx - DW - 0.6, DH / 2, Z1 + 0.3, 0.6, DH / 2, 0.4, trim); m.box(dx + DW + 0.6, DH / 2, Z1 + 0.3, 0.6, DH / 2, 0.4, trim);
    m.set({ mat: MAT.PLANKV, flags: F.HIDECUT, param: SIDE.s });
    const dc = C(type === 'stable' || type === 'barn' ? '#5a3a22' : '#5a3e26');
    if (type === 'saloon' || type === 'cantina' || type === 'gambling') {
      for (const sg of [-1, 1]) m.box(dx + sg * DW / 2, 13, Z1 - 1, DW / 2 - 0.2, 6, 0.35, dc);
    } else if (type === 'stable' || type === 'barn') {
      for (const sg of [-1, 1]) { m.push(M4.mul(M4.translate(dx + sg * DW, 0, Z1 - 1), M4.rotY(sg * 1.3))); m.box(-sg * DW / 2, DH / 2, 0, DW / 2, DH / 2, 0.5, dc); m.pop(); }
    } else {
      m.push(M4.mul(M4.translate(dx - DW, 0, Z1 - 3), M4.rotY(-1.25)));
      m.box(DW, (DH - 0.5) / 2, 0, DW, (DH - 0.5) / 2, 0.45, dc); m.pop();
    }
    // veranda: döşeme, direkler, saçak (oyuncu altındayken delinir)
    const porch = !d.ruin && type !== 'station' && type !== 'barn' && type !== 'hermit';
    m.set({ mat: MAT.FLOOR, flags: 0, param: 0 });
    m.box(X0 + Wd / 2, 0.45, Z1 + 8, Wd / 2, 0.45, 8, C(b.modern ? '#a89c88' : '#86663f'));
    if (porch) {
      // dar saçak: kapı ve pencerelerin üstünde kalır (yukarıdan bakışta cepheyi örtmez); uçlarda ince direk
      const top = Math.min(Hw - 1, type === 'stable' ? DH + 5 : 34), PH = top - 2, AD = 6.5;
      const posts = b.w >= 10 ? 3 : 2;
      for (let i = 0; i < posts; i++) {
        const x = X0 + 1.5 + i * (Wd - 3) / (posts - 1);
        m.set({ mat: MAT.SOLID, flags: F.HIDECUT, param: SIDE.s });
        m.box(x, PH / 2, Z1 + AD - 0.8, 0.7, PH / 2, 0.7, C('#4a3422'));
      }
      m.set({ mat: MAT.SHINGLE, flags: F.HIDECUT | F.HOLE | F.TWOSIDED, param: SIDE.s });
      const ac = shade(roofC, -0.05);
      m.quad([X0 - 1, PH, Z1 + AD], [X1 + 1, PH, Z1 + AD], [X1 + 1, top, Z1], [X0 - 1, top, Z1], ac);
      m.set({ mat: MAT.SOLID }); m.box(X0 + Wd / 2, PH - 0.4, Z1 + AD, Wd / 2 + 1, 0.6, 0.35, shade(ac, -0.3));
    }
    // çatı (kesitte gizlenir, gölge düşürür) ve alınlıklar
    const ov = 3;
    m.set({ mat: MAT.SHINGLE, flags: F.ROOF | F.TWOSIDED, param: 0 });
    if (!gable) {
      // yalancı cepheli dükkân: kuzeye hafif eğik düz çatı
      m.quad([X0 - 1, Hw + 1, Z1], [X1 + 1, Hw + 1, Z1], [X1 + 1, Hw - 3, Z0 - ov], [X0 - 1, Hw - 3, Z0 - ov], roofC);
    } else if (!gz) {
      const rise = 0.5 * Hd / 2, ym = Z0 + Hd / 2, e = ov * 0.5;
      m.quad([X0 - ov, Hw - e, Z1 + ov], [X1 + ov, Hw - e, Z1 + ov], [X1 + ov, Hw + rise, ym], [X0 - ov, Hw + rise, ym], roofC);
      m.quad([X1 + ov, Hw - e, Z0 - ov], [X0 - ov, Hw - e, Z0 - ov], [X0 - ov, Hw + rise, ym], [X1 + ov, Hw + rise, ym], roofC);
      m.set({ mat: MAT.SOLID }); m.box(X0 + Wd / 2, Hw + rise + 0.3, ym, Wd / 2 + ov, 0.6, 0.9, shade(roofC, -0.25));
      m.set({ mat: extMat, flags: F.ROOF });
      m.tri([X0, Hw, Z0], [X0, Hw, Z1], [X0, Hw + rise - 0.5, ym], [-1, 0, 0], null, null, wallC);
      m.tri([X1, Hw, Z0], [X1, Hw, Z1], [X1, Hw + rise - 0.5, ym], [1, 0, 0], null, null, wallC);
    } else {
      const rise = (type === 'church' ? 0.95 : 0.6) * Wd / 2, xm = X0 + Wd / 2, e = ov * 0.5;
      m.quad([X0 - ov, Hw - e, Z0 - ov], [X0 - ov, Hw - e, Z1 + ov], [xm, Hw + rise, Z1 + ov], [xm, Hw + rise, Z0 - ov], roofC);
      m.quad([X1 + ov, Hw - e, Z1 + ov], [X1 + ov, Hw - e, Z0 - ov], [xm, Hw + rise, Z0 - ov], [xm, Hw + rise, Z1 + ov], roofC);
      m.set({ mat: MAT.SOLID }); m.box(xm, Hw + rise + 0.3, Z0 + Hd / 2, 0.9, 0.6, Hd / 2 + ov, shade(roofC, -0.25));
      m.set({ mat: extMat, flags: F.ROOF, param: SIDE.s });
      m.tri([X0, Hw, Z1], [X1, Hw, Z1], [xm, Hw + rise - 0.5, Z1], [0, 0, 1], null, null, wallC);
      m.set({ param: SIDE.n });
      m.tri([X0, Hw, Z0], [X1, Hw, Z0], [xm, Hw + rise - 0.5, Z0], [0, 0, -1], null, null, wallC);
      if (type === 'stable' || type === 'barn') {   // samanlık kapağı
        m.set({ mat: MAT.PLANKV, flags: F.ROOF, param: SIDE.s }); m.box(xm, Hw + rise * 0.4, Z1 + 0.6, 5, 5.5, 0.4, C('#3a2416'));
      }
      if (type === 'church') {
        // çan kulesi: ön alınlığın üstünde, sivri külah ve haç
        const tz = Z1 - 10, ty = Hw + rise * 0.55;
        m.set({ mat: MAT.PLASTER, flags: F.ROOF, param: SIDE.s }); m.box(xm, ty + 10, tz, 7, 11, 7, wallC, { top: capC });
        m.set({ mat: MAT.SOLID }); m.box(xm, ty + 14, tz + 7.05, 3, 4, 0.1, C('#1a1410'));
        m.set({ mat: MAT.SHINGLE, flags: F.ROOF | F.TWOSIDED }); m.cyl(xm, ty + 21, tz, 8.5, 22, roofC, { seg: 4, r2: 0.2, a0: Math.PI / 4, a1: Math.PI / 4 + Math.PI * 2, top: false });
        m.set({ mat: MAT.SOLID, flags: F.ROOF }); m.box(xm, ty + 46, tz, 0.5, 4, 0.5, C('#e0d8c0')); m.box(xm, ty + 47, tz, 2.4, 0.5, 0.5, C('#e0d8c0'));
      }
    }
    // yalancı cephe ve tabela
    if (!gable) {
      const FF = d.tall ? 10 : 13, yt = Hw + FF;
      m.set({ mat: extMat, flags: F.HIDECUT, param: SIDE.s });
      m.box(X0 + Wd / 2, (Hw + yt) / 2, Z1 - 1.2, Wd / 2 + 1.5, FF / 2 + 0.6, 1.2, wallC, { top: capC });
      m.set({ mat: MAT.SOLID });
      m.box(X0 + Wd / 2, yt + 0.8, Z1 - 0.8, Wd / 2 + 2.6, 0.9, 2.2, shade(wallC, -0.32));
      m.box(X0 + Wd / 2, Hw + 0.4, Z1 + 0.6, Wd / 2 + 1.5, 0.5, 0.8, shade(wallC, -0.25));
    }
    if (d.sign) {
      const sc = C(d.sign), sy = gable ? (type === 'stable' || type === 'barn' ? DH + 5 : Hw - 6) : Hw + (d.tall ? 4.5 : 6.5), sw = gable ? Math.min(Wd * 0.3, 22) : Wd * 0.32, sh = gable ? 3.6 : (d.tall ? 4 : 5);
      if (type !== 'church' && type !== 'house') {
        m.set({ mat: MAT.SOLID, flags: F.HIDECUT, param: SIDE.s });
        m.box(X0 + Wd / 2, sy, Z1 + 0.5, sw, sh, 0.45, mixc(sc, C('#3a2a1a'), 0.15));
        m.box(X0 + Wd / 2, sy, Z1 + 0.75, sw - 1, sh - 1, 0.35, sc);
        const ink = mixc(sc, INK, 0.75), nl = Math.max(4, Math.round(sw / 3.6));
        for (let k = 0; k < nl; k++) m.box(X0 + Wd / 2 - sw + 2.4 + k * (2 * sw - 4.8) / Math.max(1, nl - 1), sy, Z1 + 1.15, 0.8 + rng() * 0.5, sh * 0.42, 0.12, ink);
      }
    }
    // baca: ocaklı yapıda arka duvarda
    let hearthX = null;
    for (let ly = 1; ly < b.h - 1 && hearthX === null; ly++) for (let lx = 1; lx < b.w - 1; lx++) { if (HEARTHS.has(W.obj[(b.y + ly) * WW + b.x + lx])) { hearthX = X0 + lx * 16 + 8; break; } }
    if (hearthX !== null) {
      const top = Hw + (gable && !gz ? 0.5 * Hd / 2 : gz ? 10 : 4) + 9;
      m.set({ mat: MAT.STONE, flags: F.ROOF, param: 0 });
      m.box(hearthX, top / 2, Z0 + 6, 3.4, top / 2, 3.4, C('#6a5a4c'));
      m.set({ mat: MAT.SOLID }); m.box(hearthX, top + 0.4, Z0 + 6, 4, 0.6, 4, C('#4a3e34'));
    }
    if (enter) interior(m, b, W, OX, OZ, Hw, rng);
    return { m, Hw };
  }

  /* ---------------- iç mekân ---------------- */
  function interior(m, b, W, OX, OZ, Hw, rng) {
    const X0 = b.x * 16 - OX, Z0 = b.y * 16 - OZ, wallZ = Z0 + 15.5;
    const at = (lx, ly) => (lx < 0 || ly < 0 || lx >= b.w || ly >= b.h) ? -1 : W.obj[(b.y + ly) * WW + b.x + lx];
    const busyX = [];
    const blanket = ['#8a2a2a', '#2a4a6a', '#6a5a2a', '#4a6a3a'];
    let barX0 = 1e9, barX1 = -1e9, barRow = 99;
    for (let ly = 1; ly < b.h - 1; ly++) for (let lx = 1; lx < b.w - 1; lx++) {
      const o = at(lx, ly);
      if (!o) continue;
      const x = X0 + lx * 16 + 8, z = Z0 + ly * 16 + 8, back = ly === 1 && BACKWALL_O.has(o), wz = back ? wallZ : z - 6;
      if (back) busyX.push(x);
      const L = at(lx - 1, ly) === o, R = at(lx + 1, ly) === o;
      switch (o) {
        case O.COUNTER: FURN.counter(m, x, z, b.type === 'bank' ? 'bank' : 'counter', L, R); break;
        case O.BAR: FURN.counter(m, x, z, 'bar', L, R); barX0 = Math.min(barX0, x); barX1 = Math.max(barX1, x); barRow = Math.min(barRow, ly); break;
        case O.TICKET: FURN.counter(m, x, z, 'ticket', L, R); break;
        case O.TABLE: case O.CARDTABLE: {
          FURN.table(m, x, z, 6.5, o === O.CARDTABLE, rng);
          const room = (xx) => xx >= 1 && xx <= b.w - 2 && !at(xx, ly) && !(xx === b.w >> 1 && ly >= b.h - 3);
          if (room(lx - 1)) FURN.chair(m, x - 11, z, 0);
          if (room(lx + 1)) FURN.chair(m, x + 11, z, Math.PI);
          break;
        }
        case O.CHAIR: FURN.chair(m, x, z, at(lx, ly - 1) === O.DESK || at(lx - 1, ly - 1) === O.DESK ? -Math.PI / 2 : Math.PI / 2); break;
        case O.STOOL: FURN.stool(m, x, z); break;
        case O.PIANO: FURN.piano(m, x, z); break;
        case O.BED: FURN.bed(m, x, z + 8, 28, blanket[Math.floor(rng() * blanket.length)]); break;
        case O.STOVE: FURN.stove(m, x, z, Hw - 1); break;
        case O.DESK: FURN.desk(m, x - 7, x + 22, z, rng); break;
        case O.CELL: FURN.cell(m, x, z, L || R, at(lx, ly - 1) === o || at(lx, ly + 1) === o); break;
        case O.PEW: FURN.pew(m, x, z, L, R); break;
        case O.ALTAR: FURN.altar(m, x - 6, z); break;
        case O.LECTERN: FURN.lectern(m, x, z); break;
        case O.ORGAN: FURN.organ(m, x, wz); break;
        case O.SAFE: FURN.safe(m, x, wz); break;
        case O.TUB: FURN.tub(m, x, z); break;
        case O.BCHAIR: FURN.bchair(m, x, z); break;
        case O.RACK: FURN.rack(m, x, wz); break;
        case O.WORKBENCH: FURN.workbench(m, x, z, b.type === 'butcher'); break;
        case O.STALL: FURN.stall(m, x, z); break;
        case O.SHELF: FURN.shelf(m, x, wz, rng); break;
        case O.BOOKCASE: FURN.bookcase(m, x, wz, rng); break;
        case O.CABINET: FURN.cabinet(m, x, wz); break;
        case O.WARDROBE: FURN.wardrobe(m, x, wz); break;
        case O.DRESSER: FURN.dresser(m, x, wz); break;
        case O.GCLOCK: FURN.clock(m, x, wz); break;
        case O.FIREPLACE: FURN.fireplace(m, x, wz); break;
        case O.OVEN: FURN.oven(m, x, wz); break;
        case O.WASHSTAND: FURN.washstand(m, x, wz); break;
        case O.FORGE: FURN.forge(m, x, z); break;
        case O.ANVIL: FURN.anvil(m, x, z); break;
        case O.PLANT: case O.PALM: FURN.plant(m, x, z, rng); break;
        case O.COATRACK: FURN.coatrack(m, x, z); break;
        case O.SOFA: FURN.sofa(m, x, z, L, R); break;
        case O.ARMCHAIR: FURN.armchair(m, x, z); break;
        case O.MANNEQUIN: FURN.mannequin(m, x, z, rng); break;
        case O.DISPLAY: FURN.display(m, x, z); break;
        case O.SACKS: FURN.sacks(m, x, z, rng); break;
        case O.SCALE: FURN.scale(m, x, z); break;
        case O.TELEGRAPH: FURN.telegraph(m, x, z); break;
        case O.SADDLE: FURN.saddle(m, x, z); break;
        case O.STAIRS: { let n = 0; while (at(lx, ly - 1 - n) === O.STAIRS) n++; FURN.stairs(m, x, z, 2 - Math.min(2, n)); break; }
        case O.IBLOCK: case O.STAIRSD: case O.RDOOR: case O.HOMECHEST: break;
        case O.BILLIARD: FURN.generic(m, x + 8, z, '#2e6a3a', 9); break;
        case O.ROULETTE: FURN.generic(m, x + 8, z, '#3a1a12', 9); break;
        case O.LAMPSTAND: m.set({ mat: MAT.SOLID }); m.cyl(x, 0, z, 0.5, 14, C('#3a3a3a'), { seg: 5 }); m.set({ mat: MAT.EMIT }); m.cyl(x, 14, z, 2, 3, C('#ffd890'), { seg: 6, r2: 1 }); break;
        default: FURN.generic(m, x, z);
      }
    }
    // bar arkası: barın üstündeki arka duvarda raflar ve şişeler
    if (barRow <= 3) for (let x = barX0; x <= barX1; x += 16) FURN.backbar(m, x, wallZ, rng);
    // arka duvar süsleri: çerçeveler ve aplik (boş yerlerde)
    const frames = Math.max(1, Math.floor(b.w / 4));
    for (let k = 0; k < frames; k++) {
      const x = X0 + (k + 0.5 + (rng() - 0.5) * 0.3) * b.w * 16 / frames;
      if (x < X0 + 14 || x > X0 + b.w * 16 - 14 || busyX.some(q => Math.abs(q - x) < 14) || (barRow <= 3 && x > barX0 - 10 && x < barX1 + 10)) continue;
      const fc = C(['#6a5a3a', '#5a6a4a', '#4a5a6a', '#7a4a3a'][Math.floor(rng() * 4)]), w = 3.5 + rng() * 2, h = 3 + rng() * 1.6, y = 19 + rng() * 4;
      m.set({ mat: MAT.SOLID, flags: 0, param: 0 });
      m.box(x, y, wallZ + 0.3, w, h, 0.3, C('#3a2416'));
      m.box(x, y, wallZ + 0.55, w - 0.8, h - 0.8, 0.2, fc);
    }
  }

  /* ---------------- dış nesneler ---------------- */
  const OAKP = [C('#314d22'), C('#3f6129'), C('#557a35')], BIRCHP = [C('#4a6a2a'), C('#5e8436'), C('#7a9e48')], APPLEP = [C('#2e4a22'), C('#3e6028'), C('#527a32')];
  function objects(W, tx0, ty0, tx1, ty1, OX, OZ, out, lights) {
    const rng = RNG(tx0 * 31 + ty0 * 17 + 3);
    const isF = (x, y, o) => x >= 0 && y >= 0 && x < WW && y < WH && W.obj[y * WW + x] === o;
    for (let ty = ty0; ty < ty1; ty++) for (let tx = tx0; tx < tx1; tx++) {
      if (tx < 0 || ty < 0 || tx >= WW || ty >= WH) continue;
      const i = ty * WW + tx, o = W.obj[i];
      if (!o || (W.flags[i] & 8)) continue;
      const x = tx * 16 + 8 - OX, z = ty * 16 + 8 - OZ, y = 0;
      const m = out;
      switch (o) {
        case O.OAK: P3.oak(m, x, y, z + 3, 0.85, rng, OAKP); break;
        case O.APPLE: P3.oak(m, x, y, z + 3, 0.75, rng, APPLEP); break;
        case O.BIRCH: P3.oak(m, x, y, z + 3, 0.7, rng, BIRCHP); break;
        case O.PINE: case O.SNOWPINE: case O.CYPRESS: P3.pine(m, x, y, z + 3, 0.85, rng); break;
        case O.SEQUOIA: P3.pine(m, x, y, z + 3, 1.3, rng); break;
        case O.DEAD: P3.dead(m, x, y, z + 3, 0.9); break;
        case O.BUSH: P3.bush(m, x, y, z, 1.0, rng); break;
        case O.DRYBUSH: P3.bush(m, x, y, z, 0.8, rng, [C('#6a6a3a'), C('#7a7442'), C('#8a8250')]); break;
        case O.TUFT: case O.REED: P3.tuft(m, x, y, z, rng, [C('#4a6a2a'), C('#5e8436'), C('#6a8a3a')], o === O.REED ? 7 : 3.4); break;
        case O.FLOWERS: case O.WFLOWER: P3.tuft(m, x, y, z, rng, [C('#c8a040'), C('#b84a6a'), C('#e8e0d0'), C('#5e8436')], 3); break;
        case O.ROCK: P3.rock(m, x, y, z, 4, rng); break;
        case O.BOULDER: P3.rock(m, x, y, z, 8, rng); break;
        case O.CACTUS: case O.SAGUARO: { m.set({ mat: MAT.FOLIAGE, flags: 0, wind: 0, bone: 0 }); const h = o === O.SAGUARO ? 30 : 12; m.cyl(x, y, z, 2.4, h, C('#4a6a3a'), { seg: 8, dome: 1.5 }); if (o === O.SAGUARO) { m.tube([x, y + 14, z], [x + 6, y + 16, z], 1.6, 1.6, C('#4a6a3a'), { seg: 6 }); m.tube([x + 6, y + 16, z], [x + 6, y + 24, z], 1.6, 1.6, C('#4a6a3a'), { seg: 6 }); } break; }
        case O.FENCEH: P3.fence(m, x, y, z, 'h', !isF(tx - 1, ty, o), !isF(tx + 1, ty, o)); break;
        case O.FENCEV: P3.fence(m, x, y, z, 'v', !isF(tx, ty - 1, o), !isF(tx, ty + 1, o)); break;
        case O.CRATE: P3.crate(m, x, y, z, 5); break;
        case O.BARREL: P3.barrel(m, x, y, z, 4.2, 11); break;
        case O.LAMP: P3.lamp(m, x, y, z, false); break;
        case O.ELAMP: P3.lamp(m, x, y, z, true); break;
        case O.WELL: P3.well(m, x, y, z); break;
        case O.TROUGH: P3.trough(m, x, y, z); break;
        case O.PUMP: P3.pump(m, x, y, z); break;
        case O.HAY: P3.haybale(m, x, y, z, 0); break;
        case O.SIGN: case O.LOTSIGN: P3.sign(m, x, y, z, o === O.LOTSIGN ? '#c8b070' : '#9a7a52'); break;
        case O.POLE: case O.UPOLE: P3.pole(m, x, y, z); break;
        case O.HITCH: P3.hitch(m, x, y, z); break;
        case O.BENCH: P3.bench(m, x, y, z); break;
        case O.BOARD: P3.board(m, x, y, z); break;
        case O.CROP: P3.crop(m, x, y, z, rng); break;
        case O.WAGON: P3.wagon(m, x + 6, y, z, 0.2); break;
        case O.CAMPFIRE: {
          m.set({ mat: MAT.STONE, flags: 0, wind: 0, bone: 0 });
          for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; m.ell(x + Math.cos(a) * 5, y + 0.6, z + Math.sin(a) * 5, 1.5, 1.1, 1.3, C('#7a746c'), { nu: 6, nv: 4 }); }
          m.set({ mat: MAT.FIRE, flags: F.NOSHADOW }); m.cyl(x, y + 1, z, 2.6, 5.5, C('#f0a030'), { seg: 7, r2: 0.3 }); m.set({ flags: 0 });
          break;
        }
        case O.GRAVE: case O.CROSS: m.set({ mat: MAT.SOLID, flags: 0 }); m.box(x, y + 6, z, 0.7, 6, 0.6, C('#6a5a48')); m.box(x, y + 9, z, 3, 0.6, 0.6, C('#6a5a48')); break;
        case O.TENT: m.set({ mat: MAT.CLOTH, flags: F.TWOSIDED }); m.cyl(x, y, z, 9, 14, C('#d8ccb0'), { seg: 4, r2: 0.2, a0: Math.PI / 4, a1: Math.PI / 4 + Math.PI * 2 }); m.set({ flags: 0 }); break;
        case O.RUINWALL: m.set({ mat: MAT.STONE, flags: 0 }); m.box(x, y + 5, z, 8, 5 + rng() * 3, 2.5, C('#8a7a64')); break;
        case O.CHEST: m.set({ mat: MAT.PLANKH, flags: 0 }); m.box(x, y + 3, z, 5, 3, 3.5, C('#6a4428')); m.set({ mat: MAT.SOLID }); m.box(x, y + 3, z + 3.55, 1, 1, 0.1, BRASSC); break;
        case O.WINDMILL: {
          m.set({ mat: MAT.SOLID, flags: 0 }); m.tube([x, y, z], [x, y + 46, z], 2.5, 1.2, C('#6a5a48'), { seg: 6 });
          for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; m.tube([x, y + 46, z + 2], [x + Math.cos(a) * 12, y + 46 + Math.sin(a) * 12, z + 2], 0.6, 0.3, C('#c8c0b0'), { seg: 4 }); }
          break;
        }
        default:
          if (o >= 20 && o <= 28) P3.tuft(m, x, y, z, rng, [C('#5e8436'), C('#7a9a44'), C('#c8a040')], 3);
      }
    }
  }
  const BRASSC = C('#c8a040');

  /* ---------------- zemin dokusu ---------------- */
  function tileTex(W, tx0, ty0, w, h) {
    const bytes = new Uint8Array(w * h * 4);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const gx = tx0 + x, gy = ty0 + y, o = (y * w + x) * 4;
      const t = gx < 0 || gy < 0 || gx >= WW || gy >= WH ? T.GRASS : W.tile[gy * WW + gx];
      bytes[o] = t; bytes[o + 1] = 0; bytes[o + 2] = 0; bytes[o + 3] = 255;
    }
    return bytes;
  }
  // karo türlerinin taban rengi: oyunun doğal tonu (TONE_NAT), yoksa TINFO rengi
  function palette() {
    const tb = new Float32Array(25 * 3);
    const names = Object.keys(T);
    for (const k of names) {
      const i = T[k];
      if (i >= 25) continue;
      const hex = (typeof TONE_NAT !== 'undefined' && TONE_NAT[k]) || (TINFO[i] && TINFO[i].c) || '#68874a';
      tb.set(C(hex), i * 3);
    }
    const h = (s) => C(s).map(v => v * 255);
    const mx = (a, b, t) => a.map((v, i) => (v + (b[i] - v) * t) / 255);
    const G = h('#68874a'), GD = [36, 54, 31], GL = [184, 196, 106];
    const grass = [mx(G, GD, 0.55), mx(G, GD, 0.32), mx(G, GD, 0.1), mx(G, GL, 0.12), mx(G, GL, 0.28), mx(G, GL, 0.45)];
    const Wt = h('#436e78'), DEEP = h('#2e4a5a'), S0 = [134, 201, 182];
    const water = [mx(Wt, S0, 0.78), mx(Wt, S0, 0.52), mx(Wt, S0, 0.26), mx(Wt, Wt, 0), mx(Wt, DEEP, 0.5), mx(DEEP, DEEP, 0)];
    return { tb, grass: new Float32Array(grass.flat()), water: new Float32Array(water.flat()) };
  }

  /* ---------------- sahne ----------------
     R: bölge (karo) {x0, y0, x1, y1}: binalar ve nesneler; zemin dokusu bunun G karo ötesine dek */
  function build(gl, W, R) {
    const t0 = performance.now();
    const OX = R.x0 * 16, OZ = R.y0 * 16, G = 40;
    const parts = [], bparts = new Map();
    // zemin: tek dörtgen (renk gölgelendiricide karo dokusundan)
    const gm = new Mesh(16);
    gm.set({ mat: MAT.TERRAIN, flags: 0, param: 0 });
    const gx0 = -G * 16, gz0 = -G * 16, gx1 = (R.x1 - R.x0 + G) * 16, gz1 = (R.y1 - R.y0 + G) * 16;
    gm.quad([gx0, 0, gz0], [gx1, 0, gz0], [gx1, 0, gz1], [gx0, 0, gz1], [0.4, 0.5, 0.3], [0, 1, 0]);
    parts.push({ mesh: new GPUMesh(gl, gm), ground: true });
    // binalar: bölgeye değen her bina bütün olarak
    for (const b of W.buildings) {
      if (b.x + b.w < R.x0 || b.x > R.x1 || b.y + b.h + 1 < R.y0 || b.y > R.y1) continue;
      const { m, Hw } = building(b, W, OX, OZ);
      const P = { mesh: new GPUMesh(gl, m), b, Hw, cut: false, cutH: 6, winLit: false, wins: W.lights.filter(L => L.type === 'window' && L.b === b.id) };
      parts.push(P); bparts.set(b.id, P);
    }
    // dış nesneler: 16×16 karoluk parçalar (görünmeyen parça çizilmez)
    for (let cy = R.y0; cy < R.y1; cy += 16) for (let cx = R.x0; cx < R.x1; cx += 16) {
      const m = new Mesh(8192);
      objects(W, cx, cy, Math.min(R.x1, cx + 16), Math.min(R.y1, cy + 16), OX, OZ, m);
      if (m.count) parts.push({ mesh: new GPUMesh(gl, m) });
    }
    const tw = R.x1 - R.x0 + 2 * G, th = R.y1 - R.y0 + 2 * G;
    const tex = D3.renderer.tileTexture(tileTex(W, R.x0 - G, R.y0 - G, tw, th), tw, th);
    // karo dokusunun yerel karo ızgarasındaki köşesi: yerel (0,0) = bölgenin köşesi
    const scene = { parts, bparts, OX, OZ, R, tiles: { tex, rect: [-G, -G, tw, th] }, pal: palette(), lines: null, ms: 0 };
    scene.ms = performance.now() - t0;
    return scene;
  }

  Object.assign(D3, { buildScene: build, STD });
})();
