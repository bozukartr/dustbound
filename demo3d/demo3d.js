'use strict';
/* =====================================================================
   FRONTIER'S END — 3B TEST DEMOSU (oyun katmanı)

   Bu dosya ve demo3d/ klasörü yalnızca 3B test paketine girer (npm run build:demo3d). Oyunun kendi
   dosyalarında hiçbir değişiklik yoktur: 3B çizim, oyun yüklendikten sonra birkaç fonksiyonun etrafına
   sarılan katmanlarla eklenir.
     - Çiftçi Çocuğu geçmişiyle Harlow'da başlanır; hikâye, açılış sinematiği ve hoş geldin rehberi yok
     - Oyuncu kasabanın ortasındaki sınırlı bir alanda kalır (binalar alanın ya tam içinde ya tam dışında)
     - Dünya 3B çizilir; oyunun 2D arayüzü, fare nişanı ve işaretleri olduğu gibi üstüne oturur
     - F3: 3B ↔ 2D, [ ve ]: saati bir saat geri/ileri al
     - Kayıtlar ve ayarlar tam oyununkilerden ve demo paketinden ayrı tutulur
   ===================================================================== */
(() => {
  const { M4, C, Renderer, GPUMesh, Mesh, LineMesh, MAT, F, buildHuman, buildHorse, buildAnimal, animalSkel, animalPose, skelPose, HUMAN_SK, HORSE_SK, POSE, HPOSE, armPose, P3 } = D3;
  const T_ = (tr, en) => (typeof I18N !== 'undefined' && I18N.lang === 'en' ? en : tr);
  const K = 0.8;                 // yükseklik ekranda K kat yukarı (eğim ~51°)
  const AREA_W = 62, AREA_H = 46;   // sınırlı alan (karo), binalara göre genişler ya da daralır
  const MARGIN = 22;             // alanın çevresinde 3B kurulan pay (karo)
  const S = D3.state = { on: true, ok: true, scene: null, area: null, err: null, cap: [], pool: [], meshes: new Map(), skels: new Map(), lastWarn: -99, ms: 0, frames: 0 };
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const lerp = (a, b, t) => a + (b - a) * t;
  const mix3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

  /* ---------------- ayrı kayıt, Harlow başlangıcı, sinematiksiz ---------------- */
  for (const k of ['get', 'set', 'remove']) { const f = Platform[k].bind(Platform); Platform[k] = (key, ...a) => f('d3_' + key, ...a); }
  for (let i = BACKGROUNDS.length - 1; i >= 0; i--) if (BACKGROUNDS[i].id !== 'farm') BACKGROUNDS.splice(i, 1);
  const reset = () => { S.scene = null; S.area = null; };
  const newGame = G.newGame;
  G.newGame = function (profile) { reset(); S.skipWelcome = true; return newGame.call(this, Object.assign({}, profile, { bg: 'farm', story: false })); };
  const loadGame = G.loadGame;
  G.loadGame = function (...a) { reset(); return loadGame.apply(this, a); };
  const cinePlay = Cinema.play.bind(Cinema);
  Cinema.play = function (sc, o) { return BACKGROUNDS.some(b => b.id === sc) || sc === 'farm' ? Promise.resolve() : cinePlay(sc, o); };
  const openWelcome = UI.openWelcome;
  UI.openWelcome = function (cb, ...a) { if (S.skipWelcome) { S.skipWelcome = false; if (cb) setTimeout(cb, 0); return; } return openWelcome.call(this, cb, ...a); };
  // 3B açıkken Melez kapalı: tuval dünya pikseli başına bir piksel (3B görüntü bu boyda çizilir)
  const hybridOn = G.hybridOn;
  G.hybridOn = function () { return S.on && S.ok ? false : hybridOn.call(this); };

  /* ---------------- sınırlı alan ----------------
     Kasaba merkezinde AREA_W × AREA_H karo; alanın kenarına değen bina, merkezi içerideyse alana katılır,
     dışarıdaysa alan onu dışarıda bırakacak kadar daralır (verandası ve bir karo payıyla). */
  function computeArea(W, town, P) {
    const cx = Math.round(town.cx / 16), cy = Math.round(town.cy / 16);
    const R = { x0: cx - (AREA_W >> 1), x1: cx + (AREA_W >> 1), y0: cy - (AREA_H >> 1), y1: cy + (AREA_H >> 1) };
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
    if (!S.area) setupArea(this);
    clampToArea(this);
  };

  /* ---------------- 2D kayıt bağlamı ----------------
     Varlıkların draw() çağrıları bu bağlama yapılır: insan, at ve hayvan çizimleri yakalanıp 3B'ye aktarılır,
     geri kalan her şey (ip, fener, tanık işareti, posta, silah) kaydedilir ve 3B görüntünün üstüne aynen çizilir. */
  const NOLOG = new Set(['getTransform', 'measureText', 'getImageData', 'isPointInPath', 'isPointInStroke', 'getLineDash', 'createLinearGradient', 'createRadialGradient', 'createConicGradient', 'createPattern', 'createImageData', 'getContextAttributes']);
  const rec = (() => {
    const cv = document.createElement('canvas'); cv.width = cv.height = 1;
    const real = cv.getContext('2d'), log = [];
    const proxy = new Proxy(real, {
      get(t, k) {
        const v = t[k];
        if (typeof v !== 'function') return v;
        if (NOLOG.has(k)) return v.bind(t);
        return (...a) => { log.push([k, a]); return v.apply(t, a); };
      },
      set(t, k, v) { log.push(['=', k, v]); t[k] = v; return true; },
    });
    return {
      ctx: proxy, log,
      begin(x0, y0) { log.length = 0; real.setTransform(1, 0, 0, 1, -x0, -y0); real.globalAlpha = 1; real.globalCompositeOperation = 'source-over'; },
      replay(ctx) {
        for (const L of log) { try { if (L[0] === '=') ctx[L[1]] = L[2]; else ctx[L[0]](...L[1]); } catch (e) { /* başka bağlamda geçersiz çağrı: atla */ } }
      },
    };
  })();
  const ORIG = {};
  function hook(on) {
    if (!on) { for (const k in ORIG) Spr[k] = ORIG[k]; return; }
    for (const k of ['human', 'horse', 'animal', 'motor', 'shadow']) ORIG[k] = Spr[k];
    Spr.human = (ctx, x, y, ang, look, st) => { S.cap.push({ k: 'h', M: ctx.getTransform(), x, y, ang, look, st: Object.assign({}, st), e: S.curEnt }); };
    Spr.horse = (ctx, x, y, ang, look, st) => { S.cap.push({ k: 'horse', M: ctx.getTransform(), x, y, ang, look, st: Object.assign({}, st), e: S.curEnt }); };
    Spr.animal = (ctx, a) => { S.cap.push({ k: 'animal', M: ctx.getTransform(), x: a.x, y: a.y, ang: a.ang, a, e: S.curEnt }); };
    Spr.motor = () => {};
    Spr.shadow = () => {};
  }
  function capture(g, vis, x0, y0) {
    const P = g.player, ctx = rec.ctx;
    rec.begin(x0, y0);
    S.cap.length = 0;
    hook(true);
    try {
      for (const e of vis) {
        if (e === P && P.riding) continue;
        S.curEnt = e;
        const mark = rec.log.length;
        try {
          if (e.rider === P) { e.draw(ctx); if (e.kind === 'horse' || P.mountAnim) { S.curEnt = P; P.draw(ctx); } }
          else if (e.child) { ctx.save(); ctx.translate(e.x, e.y); ctx.scale(0.7, 0.7); ctx.translate(-e.x, -e.y); e.draw(ctx); ctx.restore(); }
          else e.draw(ctx);
        } catch (err) { if (!S.drawErr) { S.drawErr = true; console.warn('3B: varlık çizimi', err); } }
        // araba: gövdesi 3B çizilir, 2D gövde çizimi atılır (atlar ve sürücü yakalandı)
        if (e.kind === 'wagon' && !e.motor && e.bx !== undefined) { rec.log.length = mark; S.cap.push({ k: 'wagon', M: null, x: e.bx, y: e.by, ang: e.bang, col: e.body, stage: e.stage, cab: e.cab }); }
      }
    } finally { hook(false); S.curEnt = null; }
  }

  /* ---------------- canlılar: yakalanan çizimlerden 3B aktörler ---------------- */
  const hatCol = (L) => (typeof hatColor === 'function' ? hatColor(L.hat, L.hatCol) : L.hatCol) || '#3a2a1e';
  function humanLook(L, st) {
    const fem = L.sex === 'f', hs = L.hairStyle | 0;
    return {
      skin: L.skin || '#e0b48c', hair: L.hairNow || L.hair || '#3a2618', hat: L.hat || 'none', hatCol: hatCol(L), coat: L.coat || '#5a4a3a', coatLen: L.coatLen || 0,
      shirt: L.shirt || '#d8cdb4', pants: L.pants || '#3a3024', beard: L.beard | 0, mask: L.mask || null, fem,
      longHair: fem ? [0, 1, 4, 5, 7].includes(hs) : [1, 4, 7].includes(hs), bun: fem && (hs === 2 || hs === 6),
      gun: !!st.hasGun, backGun: !!st.backGun, rod: st.hold === 'rod',
    };
  }
  // canlı ağları görünüşe göre önbellekte; uzun süre görünmeyenler atılır (kasabadan gelip geçenler birikmesin)
  function meshFor(key, make) {
    let m = S.meshes.get(key);
    if (!m) { m = new GPUMesh(D3.renderer.gl, make()); S.meshes.set(key, m); }
    m.used = S.frames;
    return m;
  }
  function sweepMeshes() {
    if (S.frames % 600 !== 0) return;
    for (const [k, m] of S.meshes) if (S.frames - m.used > 1800) { m.dispose(); S.meshes.delete(k); S.skels.delete(k); }
  }
  function actors(g, sc, t) {
    const out = [], P = g.player, W = g.world;
    let pi = 0;
    const bones = () => S.pool[pi] || (S.pool[pi] = new Float32Array(24 * 16)), next = () => pi++;
    for (const c of S.cap) {
      let wx = c.x, wy = c.y, scl = 1, rot = 0;
      if (c.M) { const M = c.M; wx = M.a * c.x + M.c * c.y + M.e + S.x0; wy = M.b * c.x + M.d * c.y + M.f + S.y0; scl = Math.hypot(M.a, M.b) || 1; rot = Math.atan2(M.b, M.a); }
      const X = wx - sc.OX, Z = wy - sc.OZ, ang = (c.ang || 0) + rot;
      if (c.k === 'h') {
        const st = c.st, L = humanLook(c.look || {}, st);
        const key = 'h|' + JSON.stringify(L);
        const mesh = meshFor(key, () => buildHuman(L));
        const ph = ((c.e && c.e.id) || 0) * 1.7;
        let pose, y = 0, lie = false;
        const carrier = c.e && c.e !== P && c.e.kind === 'horse' ? 'horse' : c.e === P && c.look !== P.look && c.look !== P.lookNow() ? 'player' : null;
        if (st.lying || st.dead) { pose = POSE.lie(); lie = true; }
        else if (st.riding) {
          const veh = c.e && (c.e.kind === 'wagon' || c.e.cab || c.e.stage);
          const mv = c.e && c.e.kind === 'horse' ? c.e.mv || 0 : c.e && c.e.mounted ? c.e.mv || 0 : P.riding ? P.riding.mv || 0 : 0;
          pose = POSE.ride(t, Math.min(1, mv), ph); y = veh ? 8.5 : 18.4;
        } else if (st.sit !== undefined) {
          const an = st.anim, arms = an === 'drink' ? 'drink' : an === 'piano' ? 'piano' : an === 'eat' || an === 'cards' || an === 'read' ? 'table' : 'lap';
          pose = POSE.sit(t, ph, arms);
          if (!st.chair) y = -4.2;
          else { const o = W.obj[(Math.floor(wy / 16)) * WW + Math.floor(wx / 16)]; y = o === O.STOOL ? 1.8 : o === O.SOFA ? 0.8 : 0; }
        } else if (st.kneel) pose = POSE.kneel();
        else if ((st.mv || 0) > 0.05) pose = POSE.walk(st.walk || 0, st.mv);
        else pose = POSE.stand(t, ph);
        if (!lie) armPose(pose, st);
        if (st.crouch && !lie) { pose.t = pose.t || {}; const t1 = pose.t[1] || [0, 0, 0]; pose.t[1] = [t1[0], t1[1] - 2.4, t1[2]]; pose[8] = [0, 0, 0.9]; pose[9] = [0, 0, -1.4]; pose[10] = [0, 0, 0.9]; pose[11] = [0, 0, -1.4]; pose[2] = [0, 0, 0.25]; }
        if (st.head && !lie) pose[3] = [0, -st.head, 0];
        let root;
        if (lie) {
          const h = carrier === 'horse' ? 21 : carrier === 'player' ? 14 : 2.6;
          root = M4.mul(M4.translate(X + Math.cos(ang) * 13 * scl, h * (carrier ? 1 : scl), Z + Math.sin(ang) * 13 * scl), M4.mul(M4.rotY(-ang), M4.mul(M4.rotZ(Math.PI / 2), M4.scale(scl, scl, scl))));
        } else root = M4.mul(M4.translate(X, y * scl, Z), M4.mul(M4.rotY(-ang), M4.scale(scl, scl, scl)));
        const B = bones(); skelPose(HUMAN_SK, pose, root, B); next();
        out.push({ mesh, bones: B });
      } else if (c.k === 'horse') {
        const st = c.st, L = c.look || {};
        const HL = { col: L.col || '#7a5434', mane: L.mane || '#1a1410', blaze: !!L.blaze, saddle: !!st.saddle, bags: !!st.bags, blanket: L.blanket || L.rug || '#8a2a20' };
        const mesh = meshFor('horse|' + JSON.stringify(HL), () => buildHorse(HL));
        const ph = ((c.e && c.e.id) || 0) * 2.3;
        let pose, root;
        if (st.dead) {
          pose = {};
          root = M4.mul(M4.translate(X, 0, Z), M4.mul(M4.rotY(-ang), M4.mul(M4.translate(0, 4.6, -21), M4.rotX(Math.PI / 2))));
        } else {
          if (st.rear > 0.05) pose = HPOSE.rear(st.rear);
          else if (st.graze) pose = HPOSE.graze(t, ph);
          else if ((st.mv || 0) > 0.05) pose = HPOSE.walk(st.phase || 0, st.mv);
          else pose = HPOSE.stand(t, ph, st.nod || 0);
          root = M4.mul(M4.translate(X, 0, Z), M4.rotY(-ang));
        }
        const B = bones(); skelPose(HORSE_SK, pose, root, B); next();
        out.push({ mesh, bones: B });
      } else if (c.k === 'animal') {
        const a = c.a, d = a.def || (typeof ANIMALS !== 'undefined' && ANIMALS[a.type]) || { len: 8, wid: 3, col: '#8a7050' };
        if (d.shape === 'horse') {
          // yabani at: at modeli, eyersiz
          const HL = { col: a.skinned ? '#9a3a2a' : d.col, mane: d.col2 || '#2a1c14', blaze: false, saddle: false, bags: false, blanket: '#8a2a20' };
          const mesh = meshFor('horse|' + JSON.stringify(HL), () => buildHorse(HL));
          const mv = a.dead ? 0 : Math.min(1, a.mv || 0);
          const pose = a.dead ? {} : mv > 0.05 ? HPOSE.walk(a.phase || 0, mv) : HPOSE.stand(t, (a.id || 0) * 1.3);
          const root = a.dead ? M4.mul(M4.translate(X, 0, Z), M4.mul(M4.rotY(-ang), M4.mul(M4.translate(0, 4.6, -21), M4.rotX(Math.PI / 2)))) : M4.mul(M4.translate(X, 0, Z), M4.rotY(-ang));
          const B = bones(); skelPose(HORSE_SK, pose, root, B); next();
          out.push({ mesh, bones: B });
          continue;
        }
        const col = a.skinned ? '#9a3a2a' : d.col, key = 'an|' + (a.type || '') + '|' + col + '|' + d.len + '|' + d.shape;
        const mesh = meshFor(key, () => buildAnimal(Object.assign({}, d, { col }), a.type));
        let sk = S.skels.get(key); if (!sk) { sk = animalSkel(d); S.skels.set(key, sk); }
        let root;
        if (a.dead) root = M4.mul(M4.translate(X, 0, Z), M4.mul(M4.rotY(-ang), M4.mul(M4.translate(0, d.wid * 0.45, 0), M4.mul(M4.rotX(Math.PI / 2), M4.scale(scl, scl, scl)))));
        else root = M4.mul(M4.translate(X, 0, Z), M4.mul(M4.rotY(-ang), M4.scale(scl, scl, scl)));
        const B = bones(); skelPose(sk, a.dead ? {} : animalPose(a, t), root, B); next();
        out.push({ mesh, bones: B });
      } else if (c.k === 'wagon') {
        const key = 'wagon|' + c.col + '|' + (c.stage ? 1 : 0) + (c.cab ? 1 : 0);
        const mesh = meshFor(key, () => { const m = new Mesh(4000); P3.wagon(m, 0, 0, 0, 0, c.col, c.stage); return m; });
        const B = bones(); B.set(M4.mul(M4.translate(X, 0, Z), M4.rotY(-ang)), 0); next();
        out.push({ mesh, bones: B });
      }
    }
    return out;
  }

  /* ---------------- ışık ve saat (js/hybrid.js sunState ve ışık kuralları) ---------------- */
  function sunState(g) {
    const h = g.hour, dl = clamp(g.daylight, 0, 1), cloud = (g.weather && g.weather.cloud) || 0, day = h > 5.2 && h < 20.3;
    const a = (h - 12) / 12 * Math.PI, e = day ? 0.36 + 0.52 * Math.sin(clamp((h - 5.2) / 15.1, 0, 1) * Math.PI) : 0.95, hz = Math.cos(e);
    let s = day ? [-Math.sin(a) * hz, (Math.cos(a) * 0.45 + 0.25) * hz, Math.sin(e)] : [0.3, 0.55, 0.78];
    const l = Math.hypot(s[0], s[1], s[2]); s = s.map(v => v / l);
    return { dir: s, day, e, cloud, dl, dark: (1 - dl) * 0.84 + cloud * 0.08 * dl };
  }
  const DAY = { sunCol: [1.0, 0.93, 0.8], sky: [0.84, 0.87, 0.95], ground: [0.92, 0.82, 0.66] };
  const DUSK = { sunCol: [1.0, 0.64, 0.4], sky: [0.62, 0.55, 0.82], ground: [0.7, 0.48, 0.4] };
  const NIGHT = { sunCol: [0.55, 0.66, 1.0], sky: [0.42, 0.52, 0.9], ground: [0.3, 0.3, 0.46] };
  function envOf(g, S0) {
    const h = g.hour, dl = S0.dl, day = S0.day;
    const fade = day ? clamp(Math.min(h - 5.2, 20.3 - h) / 0.8, 0, 1) : 0;
    const low = day ? clamp(1 - (S0.e - 0.36) / 0.45, 0, 1) : 0, k = 1 - S0.cloud * 0.65;
    const dd = { sunCol: mix3(DAY.sunCol, DUSK.sunCol, low), sky: mix3(DAY.sky, DUSK.sky, low), ground: mix3(DAY.ground, DUSK.ground, low) };
    const n = Math.pow(dl, 0.8);
    return {
      sunDir: [S0.dir[0], S0.dir[2], S0.dir[1]],
      sunCol: day ? dd.sunCol : NIGHT.sunCol, sky: mix3(NIGHT.sky, dd.sky, n), ground: mix3(NIGHT.ground, dd.ground, n),
      sunK: day ? 0.62 * fade * k * Math.max(0.3, dl) : 0.28 * (1 - dl),
      ambK: lerp(0.22, 0.33, dl) + S0.cloud * 0.05 * dl, nightMul: lerp(0.5, 1, n), night: S0.dark > 0.35, wind: 1,
    };
  }
  function lightsOf(g, sc, x0, y0, vw, vh, S0) {
    const out = [], W = g.world, P = g.player, night = S0.dark > 0.35, nk = clamp(S0.dark * 1.4, 0, 1), IB = g.insideB;
    const inView = (x, y, r) => x + r > x0 && x - r < x0 + vw && y + r > y0 - 40 && y - r < y0 + vh + 80;
    const add = (x, y, z, r, c, k, inner) => { if (k > 0.01 && inView(x, y, r)) out.push({ p: [x - sc.OX, z, y - sc.OZ], r, c, k, inner: inner ? 1 : 0, x, y }); };
    for (const L of W.lightsIn(x0, y0 - 40, x0 + vw, y0 + vh + 80)) {
      if (L.type === 'window') { if (night && Juice.windowLit(L)) add(L.x, L.y + 16, 9, L.r * 1.5, [1.0, 0.75, 0.42], 0.9 * nk); }
      else if (L.type === 'lamp') { if (night && !L.off) { if (L.el) add(L.x, L.y + 4, 30, 110, [0.94, 0.95, 1.0], 1.5 * nk); else add(L.x, L.y + 4, 21, 92 * Juice.flicker(L.x + L.y, g.t * 0.6, 0.035), [1.0, 0.72, 0.42], 1.5 * nk); } }
      else if (L.type === 'inner') { if (IB && IB.id === L.b) add(L.x, L.y, 30, L.r * 1.7, [1.0, 0.8, 0.52], night ? 1.25 : 0.32, true); }
      else if (L.type === 'hearth') { if (IB && IB.id === L.b) add(L.x, L.y + 8, 9, L.r * 1.4 * Juice.flicker(L.x + L.y * 0.3, g.t, 0.07), [1.0, 0.6, 0.3], night ? 1.1 : 0.4, true); }
      else if (L.type === 'fire') add(L.x, L.y, 8, L.r * 1.2 * Juice.flicker(L.x, g.t, 0.08), [1.0, 0.6, 0.28], 0.4 + nk);
      else if (L.type === 'beacon') { if (night) add(L.x, L.y, 76, L.r, [1.0, 0.92, 0.6], nk); }
    }
    for (const f of Juice.flashes || []) add(f.x, f.y, 14, 80, [1.0, 0.9, 0.6], Math.min(1.6, f.t * 14));
    if (P.lantern && P.has && P.has('lantern')) add(P.x + Math.cos(P.ang) * 6, P.y + Math.sin(P.ang) * 6, 16, 110, [1.0, 0.82, 0.52], 1.2 * Math.max(0.3, nk));
    if (g.fx && g.fx.muzzle > 0) add(P.x + Math.cos(P.aimAng || P.ang) * 10, P.y + Math.sin(P.aimAng || P.ang) * 10, 14, 90, [1.0, 0.9, 0.6], Math.min(1.6, g.fx.muzzle * 14));
    const cx = x0 + vw / 2, cy = y0 + vh / 2;
    out.sort((a, b) => (b.inner - a.inner) || ((a.x - cx) ** 2 + (a.y - cy) ** 2) - ((b.x - cx) ** 2 + (b.y - cy) ** 2));
    return out;
  }

  /* ---------------- bina kesiti ve gece pencereleri ---------------- */
  function buildingState(g, sc, night) {
    const P = g.player, IB = g.insideB;
    for (const part of sc.bparts.values()) {
      const b = part.b, bx = b.x * 16, by = b.y * 16, bw = b.w * 16;
      part.cut = !!(IB && IB.id === b.id);
      // oyuncu binanın arkasında (kuzeyinde) kalınca bina oyuncunun çevresinde delinir (2D'de çatı saydamlaşır)
      part.holeAll = !part.cut && P.x > bx - 8 && P.x < bx + bw + 8 && P.y > by - (b.def.tall ? 48 : 38) && P.y < by + 10;
      part.winLit = night && part.wins.some(L => Juice.windowLit(L));
    }
  }

  /* ---------------- sahne ---------------- */
  function sceneFor(g) {
    const W = g.world;
    if (S.scene && S.sceneN === W.buildings.length) return S.scene;
    if (S.scene) { for (const p of S.scene.parts) p.mesh.dispose(); D3.renderer.gl.deleteTexture(S.scene.tiles.tex); }
    const A = S.area, R = { x0: A.x0 - MARGIN, y0: A.y0 - MARGIN, x1: A.x1 + MARGIN, y1: A.y1 + MARGIN };
    const sc = D3.buildScene(D3.renderer.gl, W, R);
    sc.parts.push({ mesh: borderMesh(W, A, sc) });
    S.scene = sc; S.sceneN = W.buildings.length;
    return sc;
  }
  // alan sınırı: alçak direkler ve aralarında ip (bina ve dolu karolarda kesilir)
  function borderMesh(W, A, sc) {
    const m = new Mesh(4096), post = C('#6a4a2c'), cap = C('#c8b070');
    const free = (px, py) => { const tx = Math.floor(px / 16), ty = Math.floor(py / 16); const i = ty * WW + tx; return !(W.flags[i] & 8) && !W.solid[i]; };
    const edge = [];
    const x0 = A.x0 * 16, x1 = A.x1 * 16, y0 = A.y0 * 16, y1 = A.y1 * 16;
    for (let x = x0; x <= x1; x += 32) edge.push([x, y0], [x, y1]);
    for (let y = y0 + 32; y < y1; y += 32) edge.push([x0, y], [x1, y]);
    m.set({ mat: MAT.SOLID, flags: 0, param: 0, bone: 0 });
    for (const [px, py] of edge) {
      if (!free(Math.min(px, x1 - 1), Math.min(py, y1 - 1))) continue;
      const X = px - sc.OX, Z = py - sc.OZ;
      m.box(X, 4.5, Z, 0.8, 4.5, 0.8, post, { top: cap });
      m.box(X, 7.6, Z, 1.4, 0.35, 1.4, cap);
    }
    return new GPUMesh(D3.renderer.gl, m);
  }

  /* ---------------- çizim ---------------- */
  const render = G.render;
  G.render = function (dt) {
    if (!S.on || !S.ok || !this.world || !S.area || !this.player) return render.call(this, dt);
    try {
      if (!D3.renderer) D3.renderer = new Renderer();
      draw(this, dt);
    } catch (e) {
      console.error('3B çizim hatası', e);
      S.ok = false; S.err = String(e && e.message || e);
      try { UI.toast(T_('3B çizim kapatıldı', '3D rendering disabled'), T_('Ekran kartı 3B çizimi desteklemiyor; oyun 2D sürüyor.', 'The graphics card cannot run the 3D renderer; the game continues in 2D.'), 'warn'); } catch (x) {}
      this.resize();
      return render.call(this, dt);
    }
  };
  function draw(g, dt) {
    const t0 = performance.now();
    const ctx = g.ctx, P = g.player, Cm = g.cam, vw = g.vw, vh = g.vh;
    const x0 = Cm.ox, y0 = Cm.oy, x1 = x0 + vw, y1 = y0 + vh;
    const lw = g.canvas.width, lh = g.canvas.height, ds = lw / vw;
    S.x0 = x0; S.y0 = y0;
    HY.beat();
    FX.beginFrame();
    const sc = sceneFor(g);
    // varlıklar (oyunun kendi seçimi: görünenler, binicili at, oyuncu, giden/gelen at)
    const vis = [];
    for (const e of g.ents) if (e.x > x0 - 60 && e.x < x1 + 60 && e.y > y0 - 40 && e.y < y1 + 100 && !(e.rider === P) && !g.floorHid(e) && !Juice.lowerHid(e)) vis.push(e);
    if (P.riding) vis.push(P.riding);
    vis.push(P);
    for (const gh of Juice.ghosts || []) if (gh.x > x0 - 60 && gh.x < x1 + 60 && gh.y > y0 - 40 && gh.y < y1 + 100) vis.push(gh);
    capture(g, vis, x0, y0);
    const act = actors(g, sc, g.t);
    const S0 = sunState(g), env = envOf(g, S0);
    buildingState(g, sc, env.night);
    const lights = lightsOf(g, sc, x0, y0, vw, vh, S0);
    const IB = g.insideB, ip = IB && sc.bparts.get(IB.id);
    const indoor = ip ? [IB.x * 16 - sc.OX + 3, IB.y * 16 - sc.OZ + 12, (IB.x + IB.w) * 16 - sc.OX - 3, (IB.y + IB.h) * 16 - sc.OZ - 2, ip.Hw - 1] : null;
    const view = { x0: x0 - sc.OX, y0: y0 - sc.OZ, lw, lh, ds, K, indoor, hole: { p: [P.x - sc.OX, 13, P.y - sc.OZ], r: 22 } };
    D3.renderer.render(sc, view, act, lights, env, g.t);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(D3.renderer.cv, 0, 0);
    ctx.restore();
    // 2D: varlıkların ek çizimleri, mermiler, parçacıklar (dünya koordinatında)
    ctx.save();
    ctx.translate(-x0, -y0);
    rec.replay(ctx);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    g.drawProjs(ctx);
    g.parts.draw(ctx, x0, y0, x1, y1);
    ctx.restore();
    // oyunun üst katmanı: arayüz, hava, parıltı (2D ışık ve teller 3B'de)
    FX.glTint = true;
    const dw = g.drawWires;
    g.drawWires = () => {};
    try { g.renderTail(ctx, dt, x0, y0, x1, y1, [], false); } finally { g.drawWires = dw; }
    S.frames++;
    sweepMeshes();
    S.ms = S.ms * 0.9 + (performance.now() - t0) * 0.1;
  }

  /* ---------------- tuşlar ve işaret ---------------- */
  function toggle() {
    S.on = !S.on;
    G.resize();
    UI.feed(S.on ? T_('3B çizim açık (F3: 2D)', '3D rendering on (F3: 2D)') : T_('2D çizim (F3: 3B)', '2D rendering (F3: 3D)'));
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
    badgeEl.textContent = (S.on && S.ok ? T_('3B TEST', '3D TEST') : T_('2D', '2D')) + '  ·  F3 ' + T_('3B/2D', '3D/2D') + '  ·  [ ] ' + T_('saat', 'time');
    badgeEl.style.display = G.state === 'play' ? '' : 'none';
  }
  const uiUpdate = UI.update;
  UI.update = function (...a) {
    const r = uiUpdate.apply(this, a);
    const want = G.state === 'play' ? '' : 'none';
    if (!badgeEl || badgeEl.style.display !== want || badgeEl._on !== (S.on && S.ok)) { badge(); badgeEl._on = S.on && S.ok; }
    return r;
  };

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
