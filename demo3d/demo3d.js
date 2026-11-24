'use strict';
/* =====================================================================
   FRONTIER'S END — 3B TEST DEMOSU (oyun katmanı)

   Bu dosya ve demo3d/ klasörü yalnızca 3B test paketine girer (npm run build:demo3d). Oyunun kendi
   dosyalarında hiçbir değişiklik yoktur: 3B çizim, oyun yüklendikten sonra birkaç fonksiyonun etrafına
   sarılan katmanlarla eklenir.
     - Çiftçi Çocuğu geçmişiyle Harlow'da başlanır; hikâye, açılış sinematiği ve hoş geldin rehberi yok
     - Oyuncu kasabanın ortasındaki sınırlı bir alanda kalır (binalar alanın ya tam içinde ya tam dışında)
     - Dünya 3B çizilir; oyunun 2D arayüzü, fare nişanı ve işaretleri olduğu gibi üstüne oturur
     - Fare kendiliğinden bakış yönüdür (tıklamak gerekmez): sağa-sola kamerayı oyuncunun çevresinde döndürür, ileri-geri
       nişanı oyuncunun önünden ekranın tepesine kadar taşır (nişan uzaklaşınca kamera da öne kayar). İlk tuş ya da
       tıklama fareyi kilitler (sınırsız dönüş), Esc bırakır; 3B oyunda imleç görünmez. Yürüyüş kameraya göre; 2D
       çizimler ve işaretler eğik görüntüye yeniden yerleşir
     - F3: 3B ↔ 2D, [ ve ]: saati bir saat geri/ileri al
     - Kayıtlar ve ayarlar tam oyununkilerden ve demo paketinden ayrı tutulur
   ===================================================================== */
(() => {
  const { M4, C, Renderer, GPUMesh, Mesh, LineMesh, MAT, F, buildHuman, buildHorse, buildAnimal, animalSkel, animalPose, skelPose, HUMAN_SK, HORSE_SK, POSE, HPOSE, armPose, P3 } = D3;
  const T_ = (tr, en) => (typeof I18N !== 'undefined' && I18N.lang === 'en' ? en : tr);
  const DEG = Math.PI / 180;
  const PITCH = 38 * DEG;        // kamera eğimi (yerden yükseklik açısı)
  const LOOK_YAW = 0.0032;       // fare pikseli başına dönüş (radyan; hassasiyet ayarı ortadayken)
  const AIM_K = 0.9;             // fare pikseli başına nişan uzaklığı (birim)
  const AIM_MIN = 16, AIM_DEF = 110;   // nişan: oyuncudan en az uzaklık, açılıştaki uzaklık; en çok: ekranın tepesi
  const AHEAD = 0.13;            // oyuncu ekran merkezinin bu kadar (görüntü yüksekliği oranı) altında: önde daha çok yer
  const AIM_TOP = 0.12, P_LOW = 0.86;  // nişan ekranın tepesinden bu paydan yukarı çıkmaz; oyuncu bu çizgiden aşağı inmez
  const AIM_H = 11;              // nişan ve imleç bu yükseklikteki düzleme bakar (gövde hizası)
  const AREA_W = 62, AREA_H = 46;   // sınırlı alan (karo), binalara göre genişler ya da daralır
  const MARGIN = 46;             // alanın çevresinde nesneleriyle kurulan pay (karo): uzağa nişan alınınca görüş öne uzanır
  const S = D3.state = { on: true, ok: true, scene: null, area: null, err: null, cap: [], pool: [], meshes: new Map(), skels: new Map(), lastWarn: -99, ms: 0, frames: 0,
    yaw: 0, pitch: PITCH, aim: AIM_DEF, look: false, relock: false, vc: null, ahead: 1, la: null, wantLock: 0,
    cam: { c: 1, s: 0, st: Math.sin(PITCH), ct: Math.cos(PITCH), u: 0, w: 0, cx: 0, cy: 0, ox: 0, oy: 0, vw: 1, vh: 1, la: 0, ok: false } };
  // fare hassasiyeti (Ayarlar > Kontroller): 0..1, ortası 1×; çarpan 0,25× .. 4×
  if (G.settings.d3Sens === undefined) G.settings.d3Sens = 0.5;
  const sensMul = () => { const v = +G.settings.d3Sens; return Math.pow(2, ((v >= 0 && v <= 1 ? v : 0.5) - 0.5) * 4); };
  // 3B kamera etkin mi: yürüyüş, nişan ve 2D katmanlar onun izdüşümüne göre yerleşir
  const on3D = () => S.on && S.ok && !!S.area && S.cam.ok;
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const lerp = (a, b, t) => a + (b - a) * t;
  const mix3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

  /* ---------------- ayrı kayıt, Harlow başlangıcı, sinematiksiz ---------------- */
  for (const k of ['get', 'set', 'remove']) { const f = Platform[k].bind(Platform); Platform[k] = (key, ...a) => f('d3_' + key, ...a); }
  for (let i = BACKGROUNDS.length - 1; i >= 0; i--) if (BACKGROUNDS[i].id !== 'farm') BACKGROUNDS.splice(i, 1);
  const reset = () => { S.scene = null; S.area = null; S.autoTried = false; S.la = null; };
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
      mark(e) { log.push(['@', e]); },
      // onMark: hangi varlığın ekleri çiziliyor (dönen kamerada ekler o varlıkla birlikte kayar)
      replay(ctx, onMark) {
        for (const L of log) {
          if (L[0] === '@') { if (onMark) onMark(L[1]); continue; }
          try { if (L[0] === '=') ctx[L[1]] = L[2]; else ctx[L[0]](...L[1]); } catch (e) { /* başka bağlamda geçersiz çağrı: atla */ }
        }
      },
    };
  })();
  /* ---------------- 3B kamera ----------------
     Gerçek dik kamera: yaw fareyle sağa-sola, eğim sabit (PITCH). Görüntü merkezi oyunun kamerasının merkezinden
     (oyuncuyu izler; atta önden bakış, nişanda öne kayma, iç mekânda binanın ortası, sarsıntı) kameranın baktığı yöne
     doğru önden bakış payı kadar ileridedir: oyuncu ekranın biraz altında kalır, nişan uzaklaştıkça pay büyür.
     Merkez ekran pikseline oturur: kamera yürürken zemin titremez.
       ekran x = vw/2 + c·x − s·y − u,  ekran y = vh/2 + (s·x + c·y)·sinθ − w − h·cosθ   (x, y dünya; h yükseklik) */
  let camT = 0;
  /* önden bakış payı ve nişan: nişan ekranın tepesine yaklaşınca kamera öne kayar (oyuncu ekranın altına iner); oyuncu
     alt çizgiye inince nişan daha uzağa gidemez. İçeride (kamera binaya oturur) ve dürbünde kamera kaymaz. */
  function camFrame(g) {
    const K = S.cam, vw = g.vw, vh = g.vh, ds = g.canvas.width / vw, P = g.player;
    const now = performance.now(), dt = camT ? Math.min(0.1, (now - camT) / 1000) : 0;
    camT = now;
    const c = Math.cos(S.yaw), s = Math.sin(S.yaw), st = Math.sin(S.pitch), ct = Math.cos(S.pitch);
    const fx = -s, fy = -c;                                   // kameranın baktığı yön (zeminde)
    S.ahead += ((g.insideB || g.binoc ? 0 : 1) - S.ahead) * Math.min(1, dt * 4);
    const bx = g.cam.ox + vw / 2, by = g.cam.oy + vh / 2;
    const off = (P.x - bx) * fx + (P.y - by) * fy;            // oyuncunun oyun kamerasına göre ileri payı
    const up = (AIM_TOP - 0.5) * -vh / st, low = (P_LOW - 0.5) * vh / st;   // merkezden tepe payı ve alt çizgi (birim)
    const laHi = (off + low) * S.ahead;
    S.aim = clamp(S.aim, AIM_MIN, Math.max(AIM_MIN, (laHi - off) + up));
    let want = Math.min(laHi, Math.max(AHEAD * vh / st * S.ahead, off + S.aim - up));
    S.la = S.la === null || !dt ? want : S.la + (want - S.la) * Math.min(1, dt * 7);
    const la = S.la;
    const cx = bx + fx * la, cy = by + fy * la;
    Object.assign(K, { c, s, st, ct, la, vw, vh, ox: g.cam.ox, oy: g.cam.oy, fx, fy });
    K.u = Math.round((c * cx - s * cy) * ds) / ds;
    K.w = Math.round((s * cx + c * cy) * st * ds) / ds;
    // piksele oturmuş merkez (dünya)
    const b = K.w / st;
    K.cx = c * K.u + s * b; K.cy = -s * K.u + c * b;
    K.ok = true;
  }
  // dünya (x, y zemin; h yükseklik) → görüntü pikseli
  const w2s = (x, y, h) => { const K = S.cam; return [K.vw / 2 + K.c * x - K.s * y - K.u, K.vh / 2 + (K.s * x + K.c * y) * K.st - K.w - (h || 0) * K.ct]; };
  // görüntü pikseli → h yüksekliğindeki düzlemde dünya noktası
  const s2w = (sx, sy, h) => { const K = S.cam, a = sx - K.vw / 2 + K.u, b = (sy - K.vh / 2 + K.w + (h || 0) * K.ct) / K.st; return [K.c * a + K.s * b, -K.s * a + K.c * b]; };
  // oyunun düz 2D tuval noktası (oyun kamerasına göre) → 3B görüntü pikseli
  const flat2s = (fx, fy, h) => w2s(S.cam.ox + fx, S.cam.oy + fy, h);

  /* ---------------- yeniden izdüşüren 2D bağlam ----------------
     Oyunun dünya koordinatlı 2D çizimleri (mermi, parçacık, nişangâh, varlık ekleri) bu bağlamdan geçer: her çağrının
     dayanak noktası (düz 2D tuvaldeki yeri) 3B görüntüdeki yerine taşınır, şekil oraya kaydırılır (yazı ve simgeler dik
     ve aynı boyda kalır); çizgi noktaları tek tek taşınır (mermi izi doğru yöne bakar). st.base verilirse (bir varlığın
     ayak noktası) bütün çağrılar onunla kayar: başın üstündeki işaret yine başın üstünde. st.h ya da base[2]: dayanak
     noktasının yerden yüksekliği (mermi ve nişangâh gövde hizasında). */
  const RP = (() => {
    const sh = document.createElement('canvas').getContext('2d');   // oyunun dönüşüm yığını (gölge)
    let real = null;
    const st = { base: null, h: 0, snap: false };
    const place = (x, y) => {
      const M = sh.getTransform();
      let sx, sy, h = st.h;
      if (st.base) { sx = st.base[0]; sy = st.base[1]; h = st.base[2] || 0; } else { sx = M.a * x + M.c * y + M.e; sy = M.b * x + M.d * y + M.f; }
      const q = flat2s(sx, sy, h);
      // snap: dayanak piksel merkezine oturur (nişangâh ve işaretler yarım piksel payıyla çizildiğinden keskin kalır)
      if (st.snap) { q[0] = Math.floor(q[0]) + 0.5; q[1] = Math.floor(q[1]) + 0.5; }
      real.setTransform(M.a, M.b, M.c, M.d, M.e + q[0] - sx, M.f + q[1] - sy);
    };
    const XF = new Set(['translate', 'rotate', 'scale', 'transform', 'setTransform', 'resetTransform']);
    const PT = { moveTo: 0, lineTo: 0, quadraticCurveTo: 2, bezierCurveTo: 4, arcTo: 2, arc: 0, ellipse: 0, fillText: 1, strokeText: 1 };
    const RECT = new Set(['rect', 'roundRect', 'fillRect', 'strokeRect', 'clearRect']);
    const ctx = new Proxy({}, {
      get(_, k) {
        const v = real[k];
        if (typeof v !== 'function') return v;
        if (k === 'save' || k === 'restore') return () => { sh[k](); real[k](); };
        if (XF.has(k)) return (...a) => { sh[k](...a); };
        if (k === 'getTransform') return () => sh.getTransform();
        if (k in PT) return (...a) => { const i = PT[k]; place(a[i], a[i + 1]); return v.apply(real, a); };
        if (RECT.has(k)) return (...a) => { place(a[0] + (a[2] || 0) / 2, a[1] + (a[3] || 0) / 2); return v.apply(real, a); };
        if (k === 'drawImage') return (...a) => {
          const n = a.length, im = a[0];
          if (n === 3) place(a[1] + (im.width || 0) / 2, a[2] + (im.height || 0) / 2);
          else if (n === 5) place(a[1] + a[3] / 2, a[2] + a[4] / 2);
          else place(a[5] + a[7] / 2, a[6] + a[8] / 2);
          return v.apply(real, a);
        };
        return v.bind(real);
      },
      set(_, k, val) { real[k] = val; return true; },
    });
    return {
      ctx, st,
      // c: gerçek 2D bağlam (oyunun dönüşümüyle: dünya − oyun kamerası)
      begin(c) { real = c; sh.setTransform(c.getTransform()); st.base = null; st.h = 0; st.snap = false; },
      end() { if (real) real.setTransform(sh.getTransform()); real = null; st.base = null; st.h = 0; st.snap = false; },
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
        rec.mark(e);
        const mark = rec.log.length;
        try {
          if (e.rider === P) { e.draw(ctx); if (e.kind === 'horse' || P.mountAnim) { S.curEnt = P; P.draw(ctx); } }
          else if (e.child) { ctx.save(); ctx.translate(e.x, e.y); ctx.scale(0.7, 0.7); ctx.translate(-e.x, -e.y); e.draw(ctx); ctx.restore(); }
          else e.draw(ctx);
        } catch (err) { if (!S.drawErr) { S.drawErr = true; console.warn('3B: varlık çizimi', err); } }
        // araba: gövdesi 3B çizilir, 2D gövde çizimi atılır (atlar ve sürücü yakalandı)
        if (e.kind === 'wagon' && !e.motor && e.bx !== undefined) { rec.log.length = mark; S.cap.push({ k: 'wagon', M: null, x: e.bx, y: e.by, ang: e.bang, col: e.body, stage: e.stage, cab: e.cab }); }
      }
      rec.mark(null);
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
    const near = S.nearFn || (() => true);
    // trenler: vagonlar oyunun ray üzerindeki konumlarından (lokomotif gidiş yönünde önde)
    for (const tr of g.trains || []) for (let i = 0; i < tr.pos.length; i++) {
      const q = tr.pos[i], kind = tr.cars[i];
      if (!q || !near(q[0], q[1], 30)) continue;
      const mesh = meshFor('train|' + kind, () => { const m = new Mesh(9000); P3.trainCar(m, kind); return m; });
      const B = bones(); B.set(M4.mul(M4.translate(q[0] - sc.OX, 0, q[1] - sc.OZ), M4.rotY(-q[2])), 0); next();
      out.push({ mesh, bones: B });
    }
    // çatı bayrakları: kumaş rüzgârın estiği yöne döner (direk binanın parçası)
    const wa = FX.wind && FX.wind.a !== undefined ? FX.wind.a : 0;
    for (const part of sc.bparts.values()) {
      const f = part.flag;
      if (!f || part.cut || !near(f[0], f[1], 40)) continue;
      const mesh = meshFor('flag|' + f[3], () => { const m = new Mesh(256); P3.flagCloth(m, f[3]); return m; });
      const B = bones(); B.set(M4.mul(M4.translate(f[0] - sc.OX, f[2], f[1] - sc.OZ), M4.rotY(-wa)), 0); next();
      out.push({ mesh, bones: B });
    }
    // yuvarlanan çalılar (kurak yerde rüzgârla gelir)
    for (const q of (g.amb && g.amb.tumbles) || []) {
      if (!near(q.x, q.y, 10)) continue;
      const r = Math.round(q.r * 2) / 2, hop = Math.abs(Math.sin(q.bt)) * 3;
      const mesh = meshFor('tumble|' + r, () => { const m = new Mesh(2400); P3.tumble(m, r); return m; });
      const B = bones(); B.set(M4.mul(M4.translate(q.x - sc.OX, r + hop, q.y - sc.OZ), M4.rotZ(-q.rot)), 0); next();
      out.push({ mesh, bones: B });
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
  // mx, my: görüntü merkezi (dünya), VR: görünen alanın yarıçapı
  function lightsOf(g, sc, mx, my, VR, S0) {
    const out = [], W = g.world, P = g.player, night = S0.dark > 0.35, nk = clamp(S0.dark * 1.4, 0, 1), IB = g.insideB;
    const inView = (x, y, r) => (x - mx) ** 2 + (y - my) ** 2 < (VR + r) ** 2;
    const add = (x, y, z, r, c, k, inner) => { if (k > 0.01 && inView(x, y, r)) out.push({ p: [x - sc.OX, z, y - sc.OZ], r, c, k, inner: inner ? 1 : 0, x, y }); };
    for (const L of W.lightsIn(mx - VR, my - VR, mx + VR, my + VR)) {
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
    out.sort((a, b) => (b.inner - a.inner) || ((a.x - mx) ** 2 + (a.y - my) ** 2) - ((b.x - mx) ** 2 + (b.y - my) ** 2));
    return out;
  }

  /* ---------------- bina kesiti ve gece pencereleri ---------------- */
  function buildingState(g, sc, night) {
    const P = g.player, IB = g.insideB;
    for (const part of sc.bparts.values()) {
      const b = part.b, bx = b.x * 16, by = b.y * 16, bw = b.w * 16;
      part.cut = !!(IB && IB.id === b.id);
      // bina oyuncunun önüne geçerse (kamera hangi yönde olursa olsun) oyuncunun çevresinde delinir: delik yalnızca
      // ekranda oyuncunun çevresinde ve oyuncudan kameraya yakın parçaları atar (2D'de çatı saydamlaşır)
      part.holeAll = !part.cut && Math.abs(P.x - (bx + bw / 2)) < bw / 2 + 90 && Math.abs(P.y - (by + b.h * 8)) < b.h * 8 + 90;
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
    // kamp ateşleri (duman ve kıvılcım) ve sonbaharda yaprak döken ağaçlar: 2D'de zemin çiziminde üretilirler
    sc.fires = []; sc.leafy = [];
    for (let ty = R.y0; ty < R.y1; ty++) for (let tx = R.x0; tx < R.x1; tx++) {
      const o = W.obj[ty * WW + tx];
      if (o === O.CAMPFIRE) sc.fires.push([tx * 16 + 8, ty * 16 + 8]);
      else if (o === O.OAK || o === O.APPLE || o === O.BIRCH) sc.leafy.push([tx * 16 + 8, ty * 16 - 4, hash2(tx, ty, 78)]);
    }
    S.scene = sc; S.sceneN = W.buildings.length;
    return sc;
  }
  // alan sınırı: alçak direkler ve aralarında ip (bina ve dolu karolarda kesilir)
  function borderMesh(W, A, sc) {
    const m = new Mesh(4096), post = C('#6a4a2c'), cap = C('#c8b070');
    const free = (px, py) => { const tx = Math.floor(px / 16), ty = Math.floor(py / 16); const i = ty * WW + tx; return !(W.flags[i] & 10) && !W.solid[i]; };   // bina ve demiryolu dışında
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

  /* ---------------- yükseklikli efektler ----------------
     2D'de yükseklik ekranda yukarı kaymayla çizilir: duman, buhar, kıvılcım ve nefes y'de "yukarı" gider, kuşlar ve
     bayraklar yerdeki noktalarının üstünde durur. 3B'de her biri yerdeki noktası ve yerden yüksekliğiyle izdüşürülür:
     parçacığın doğduğu yükseklik (h0) ve yükselme hızı (rv) kaydedilir, yükselme ayrıca toplanır (ry). */
  const PH = { smoke: 9, steam: 1, dust: 1, breath: 14, ember: 4, flash: 10, ring: 0, spark: 6, blood: 8, debris: 3, feather: 6, splash: 0, tracer: 10, text: 22 };
  const RISE_ALL = { steam: 1, ember: 1 };
  const TRAIN_SMOKE = { h: 21, dy: 6, rise: -12 };
  if (typeof Particles !== 'undefined') {
    const padd = Particles.prototype.add, pupd = Particles.prototype.update;
    Particles.prototype.add = function (type, x, y, vx, vy, ...a) {
      const p = padd.call(this, type, x, y, vx, vy, ...a);
      if (p) {
        const c = S.pctx;
        p.h0 = c ? c.h : (PH[type] || 0); p.dy0 = c ? c.dy : (type === 'ember' ? 4 : 0);
        p.rv = c && c.rise !== undefined ? c.rise : RISE_ALL[type] ? vy : 0; p.ry = 0;
      }
      return p;
    };
    // yükselme payı oyunun hız güncellemesiyle aynı sırada toplanır (önce konum, sonra hız)
    Particles.prototype.update = function (dt) {
      const L = this.list;
      for (let i = 0; i < L.length; i++) {
        const p = L[i], ty = p.type;
        if (p.rv === undefined) continue;
        if (ty === 'smoke' || ty === 'steam') { p.ry += p.rv * dt; p.rv = p.rv * 0.98 - 6 * dt; }
        else if (ty === 'breath') { p.ry += p.rv * dt; p.rv = p.rv * 0.94 - 3 * dt; }
        else if (ty === 'ember') { p.ry += p.rv * dt; p.rv -= 10 * dt; }
      }
      return pupd.call(this, dt);
    };
  }
  if (typeof Train !== 'undefined') {
    const tu = Train.prototype.update;
    Train.prototype.update = function (dt) { S.pctx = TRAIN_SMOKE; try { return tu.call(this, dt); } finally { S.pctx = null; } };
  }
  // baca ve kamp dumanı (FX.smoke): yükselme hızı üstel söner; doğduğu yer ve yükseklik kaydedilir
  {
    const fpuff = FX.puff;
    FX.puff = function (x, y, vx, vy, ...a) {
      const n = this.smoke.length, r = fpuff.call(this, x, y, vx, vy, ...a);
      if (this.smoke.length > n) { const p = this.smoke[this.smoke.length - 1], c = S.fctx; p.ys = y; p.vy0 = vy; p.gy = y + (c ? c.dy : 0); p.h0 = c ? c.h : 0; }
      return r;
    };
    const fireSmoke = FX.fireSmoke;
    FX.fireSmoke = function (...a) { S.fctx = { dy: 5, h: 7 }; try { return fireSmoke.apply(this, a); } finally { S.fctx = null; } };
    // 3B'de bacalar: ocaklı binaların gerçek bacasının tepesinden (oyunun sabah, akşam ve soğuk kuralıyla)
    const chimneys = FX.chimneys;
    FX.chimneys = function (dt, ...a) {
      if (!on3D() || !S.scene) return chimneys.call(this, dt, ...a);
      const h = G.hour, IB = G.insideB, morning = h >= 5.5 && h < 10, evening = h >= 17 && h < 23, coldK = this.temp < 8;
      const rate = G.settings.smoke ? 2.6 : 1.3, K = S.cam;
      for (const part of S.scene.bparts.values()) {
        const ch = part.chimney, b = part.b;
        if (!ch || b.def.ruin || b === IB || b.shut) continue;
        if ((ch[0] - K.cx) ** 2 + (ch[1] - K.cy) ** 2 > 640 * 640) continue;
        const k = hash2(b.x, b.y, 11);
        const on = coldK ? k < 0.9 : (morning || evening) ? k < 0.72 : h >= 23 || h < 5.5 ? k < 0.15 : k < 0.3;
        if (!on || Math.random() > rate * dt) continue;
        S.fctx = { dy: 0, h: ch[2] };
        try { this.puff(ch[0] + rnd(-0.8, 0.8), ch[1], rnd(-1.5, 1.5), rnd(-8, -6), 1.3, rnd(1.9, 2.5), rnd(3.2, 4.2), 0.34, '212,208,204'); } finally { S.fctx = null; }
      }
    };
  }
  // kamp ateşleri (kıvılcım ve duman kaynağı) ve sonbahar yaprakları: 2D'de zemin çiziminde üretilir, 3B'de burada
  function sceneFx(g, sc, dt, near) {
    for (const f of sc.fires) {
      if (!near(f[0], f[1], 20)) continue;
      if (Math.random() < dt * 6) g.parts.add('ember', f[0], f[1] - 4, 0, -10, 1, 1);
      FX.fireSource(f[0], f[1]);
    }
    if (g.world.season === 2 && g.settings.ambient) for (const q of sc.leafy) if (near(q[0], q[1], 0)) FX.leafTree(q[0], q[1], q[2]);
  }
  const inV = (x, y, mx, my, R) => (x - mx) ** 2 + (y - my) ** 2 < R * R;
  // parçacıklar: oyunun 2D çizimiyle aynı biçimler, yerdeki noktasının üstünde yüksekliğiyle
  function parts3D(c, mx, my, VR) {
    const L = G.parts.list;
    for (let i = 0; i < L.length; i++) {
      const p = L[i], ry = p.ry || 0, gx = p.x, gy = p.y - ry + (p.dy0 || 0);
      if (!inV(gx, gy, mx, my, VR + 40)) continue;
      const a = p.life / p.max;
      let h = (p.h0 || 0) - ry;
      if (p.type === 'chip' || p.type === 'drop' || p.type === 'bile' || p.type === 'casing') h = p.z;
      else if (p.type === 'blood' || p.type === 'feather') h = (p.h0 || 6) * a;
      const q = w2s(gx, gy, h), X = q[0], Y = q[1];
      switch (p.type) {
        case 'smoke': c.fillStyle = `rgba(${p.col || '200,200,200'},${a * 0.35})`; c.beginPath(); c.arc(X, Y, p.size, 0, TAU2); c.fill(); break;
        case 'steam': c.fillStyle = `rgba(240,240,240,${a * 0.25})`; c.beginPath(); c.arc(X, Y, p.size, 0, TAU2); c.fill(); break;
        case 'dust': c.fillStyle = `rgba(${p.col || '170,140,100'},${a * 0.35})`; c.beginPath(); c.arc(X, Y, p.size, 0, TAU2); c.fill(); break;
        case 'blood': c.fillStyle = `rgba(140,10,10,${Math.min(1, a * 2)})`; c.fillRect(X - p.size / 2, Y - p.size / 2, p.size, p.size); break;
        case 'spark': c.fillStyle = `rgba(255,220,120,${a})`; c.fillRect(X, Y, 1.2, 1.2); break;
        case 'ember': c.fillStyle = `rgba(255,${120 + a * 100 | 0},40,${a})`; c.fillRect(X, Y, 1, 1); break;
        case 'debris': c.fillStyle = p.col || '#6a5a4a'; c.globalAlpha = a; c.fillRect(X, Y, p.size, p.size); c.globalAlpha = 1; break;
        case 'feather': c.fillStyle = p.col || '#e8e0d0'; c.globalAlpha = a; c.fillRect(X, Y, 2, 1); c.globalAlpha = 1; break;
        case 'splash': c.strokeStyle = `rgba(200,230,240,${a})`; c.lineWidth = 1; c.beginPath(); c.ellipse(X, Y, p.size * (1.5 - a), p.size * (1.5 - a) * S.cam.st, 0, 0, TAU2); c.stroke(); break;
        case 'flash': c.fillStyle = `rgba(255,230,150,${a})`; c.beginPath(); c.arc(X, Y, p.size * (0.5 + a), 0, TAU2); c.fill(); break;
        case 'ring': c.strokeStyle = `rgba(255,200,120,${a})`; c.lineWidth = 2; c.beginPath(); c.ellipse(X, Y, p.size * (1.2 - a), p.size * (1.2 - a) * S.cam.st, 0, 0, TAU2); c.stroke(); break;
        case 'tracer': { const e = w2s(p.x2, p.y2, h); c.strokeStyle = `rgba(255,240,190,${a * 0.9})`; c.lineWidth = 1; c.beginPath(); c.moveTo(X, Y); c.lineTo(e[0], e[1]); c.stroke(); break; }
        case 'breath': c.fillStyle = `rgba(236,241,248,${a * 0.3})`; c.beginPath(); c.arc(X, Y, p.size, 0, TAU2); c.fill(); break;
        case 'chip': c.fillStyle = p.col; c.globalAlpha = Math.min(1, a * 3); c.fillRect(X, Y, p.size, p.size); c.globalAlpha = 1; break;
        case 'drop': c.fillStyle = `rgba(210,232,244,${a})`; c.fillRect(X, Y, 1, 1); break;
        case 'bile': c.fillStyle = `rgba(148,166,52,${Math.min(0.9, a * 1.8)})`; c.fillRect(X, Y, p.size, p.size); break;
        case 'casing': c.fillStyle = p.col; c.globalAlpha = Math.min(1, a * 4); c.fillRect(X, Y, p.size, 1); c.globalAlpha = 1; break;
        case 'text': c.fillStyle = p.col; c.globalAlpha = Math.min(1, a * 2); c.font = '7px monospace'; c.textAlign = 'center'; c.fillText(p.size, X, Y); c.globalAlpha = 1; break;
      }
    }
  }
  // baca ve kamp dumanı, düşen yapraklar
  function fxHigh3D(c, mx, my, VR) {
    for (const p of FX.smoke) {
      const age = p.max - p.life, k = p.life / p.max, a = p.a * Math.min(1, (1 - k) * 5) * Math.sqrt(k);
      if (a < 0.005) continue;
      let gy = p.y, h = 0;
      if (p.vy0 !== undefined) { const ry = p.vy0 * (1 - Math.exp(-0.25 * age)) / 0.25; gy = p.gy + (p.y - p.ys - ry); h = p.h0 - ry; }
      if (!inV(p.x, gy, mx, my, VR + 40)) continue;
      const q = w2s(p.x, gy, h);
      c.fillStyle = `rgba(${p.col},${a})`; c.beginPath(); c.arc(q[0], q[1], p.s, 0, TAU2); c.fill();
    }
    for (const q of FX.leaves) {
      if (q.z <= 0 || !inV(q.x, q.y, mx, my, VR)) continue;
      const f = Math.abs(Math.sin(q.ph)), sh = w2s(q.x, q.y, 0), l = w2s(q.x, q.y, q.z);
      c.fillStyle = 'rgba(0,0,0,0.12)'; c.fillRect(sh[0], sh[1], 1, 1);
      c.fillStyle = q.c; c.fillRect(l[0], l[1], 0.6 + f * 1.2, 1);
    }
  }
  // toz şeytanları: dönen toz halkaları yerden yükselir (bayrak ve çamaşır 3B sahnede)
  function juiceHigh3D(c, mx, my, VR) {
    const W = G.world, t = G.t, st = S.cam.st;
    for (const d of Juice.devils || []) {
      if (!inV(d.x, d.y, mx, my, VR + 60)) continue;
      const fade = Math.min(1, d.t / 4, (d.life - d.t) / 4);
      const col = (typeof DUST_C !== 'undefined' && DUST_C[W.tileAtPx(d.x, d.y)]) || '190,160,120';
      const g0 = w2s(d.x, d.y, 0);
      c.fillStyle = `rgba(${col},${0.18 * fade})`; c.beginPath(); c.ellipse(g0[0], g0[1], 7, 7 * st, 0, 0, TAU2); c.fill();
      for (let i = 0; i < 16; i++) {
        const z = i / 16, r = 2 + z * 7, a = t * 7 + i * 0.8, sway = Math.sin(t * 1.3 + z * 3) * z * 4;
        const q = w2s(d.x + Math.cos(a) * r + sway, d.y + Math.sin(a) * r, z * d.h);
        c.fillStyle = `rgba(${col},${(0.22 - z * 0.12) * fade})`;
        c.beginPath(); c.arc(q[0], q[1], 1.6 + z * 2.4, 0, TAU2); c.fill();
      }
    }
  }
  // kuş sürüleri: 2D'de yerdeki noktalarının (gölgeleri) 36 px yukarısında; 3B'de 60 birim yükseklikte
  function birds3D(c, mx, my, VR) {
    for (const q of G.amb.birds) {
      const gx = q.x, gy = q.y + 36;
      if (!inV(gx, gy, mx, my, VR + 80)) continue;
      const sh = w2s(gx + 14, gy + 6, 0), b = w2s(gx, gy, 60), f = Math.sin(q.ph) * 2;
      c.fillStyle = 'rgba(0,0,0,0.15)'; c.fillRect(sh[0], sh[1], 2, 1);
      c.strokeStyle = '#1a1614'; c.lineWidth = 0.9;
      c.beginPath(); c.moveTo(b[0] - 3, b[1] - f); c.lineTo(b[0], b[1]); c.lineTo(b[0] + 3, b[1] - f); c.stroke();
    }
  }
  // ateş böcekleri (iki tür): yerden biraz yukarıda
  function flies3D(c, mx, my, VR) {
    c.globalCompositeOperation = 'lighter';
    for (const q of G.amb.flies) {
      const a = Math.max(0, Math.sin(q.t * 3 + q.life)) * Math.min(1, q.life - q.t);
      if (a <= 0.05 || !inV(q.x, q.y, mx, my, VR)) continue;
      const s2 = w2s(q.x, q.y, 5);
      c.fillStyle = `rgba(200,255,120,${a * 0.25})`; c.beginPath(); c.arc(s2[0], s2[1], 3, 0, TAU2); c.fill();
      c.fillStyle = `rgba(240,255,180,${a})`; c.fillRect(s2[0] - 0.5, s2[1] - 0.5, 1, 1);
    }
    c.globalCompositeOperation = 'source-over';
  }
  function glow3D(c, mx, my, VR) {
    const F = Juice.flies;
    if (!F || !F.length || !G.glowSpr) return;
    c.globalCompositeOperation = 'lighter';
    for (const f of F) {
      const b = Math.max(0, Math.sin(f.ph)) ** 3;
      if (b < 0.05 || !inV(f.x, f.y, mx, my, VR)) continue;
      const q = w2s(f.x, f.y, 6);
      c.globalAlpha = b * 0.5; c.drawImage(G.glowSpr, q[0] - 4, q[1] - 4, 8, 8);
      c.globalAlpha = b; c.fillStyle = '#e8ff90'; c.fillRect(q[0], q[1], 1, 1);
    }
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
  }

  /* ---------------- zemin izleri ve bulut gölgesi ----------------
     Oyunun kendi 2D zemin çizimleri (ayak/toynak izi, kardaki iz, sudaki halka, yere düşen yaprak, ıslak zemin ve
     birikinti, dinamit yanığı, yere düşen şapka, şahin gölgesi) görünen alanın çevresindeki 1024 px'lik bir tuvale
     dünya koordinatıyla çizilir; 3B zemin bu dokudan okur (binaların ve canlıların arkasında kalan iz görünmez).
     Saniyede ~15 kez ya da pencere kayınca yenilenir. */
  const DEC = { N: 1024, cv: null, ctx: null, x0: NaN, y0: NaN, t: 0 };
  function decals(g, sc, mx, my) {
    const N = DEC.N;
    if (!DEC.cv) { DEC.cv = document.createElement('canvas'); DEC.cv.width = DEC.cv.height = N; DEC.ctx = DEC.cv.getContext('2d'); }
    const x0 = Math.round(mx / 64) * 64 - N / 2, y0 = Math.round(my / 64) * 64 - N / 2, now = performance.now();
    if (x0 === DEC.x0 && y0 === DEC.y0 && now - DEC.t < 66) return [x0 - sc.OX, y0 - sc.OZ, N, N];
    DEC.t = now; DEC.x0 = x0; DEC.y0 = y0;
    const c = DEC.ctx, C = g.cam, sv = [C.ox, C.oy, g.vw, g.vh];
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, N, N);
    c.setTransform(1, 0, 0, 1, -x0, -y0);
    try {
      // FX.drawGround penceresini oyunun kamerasından alır: çizim süresince kamera bu tuvali gösterir
      C.ox = x0 + 10; C.oy = y0 + 10; g.vw = N - 20; g.vh = N - 20;
      FX.drawGround(c);
      Juice.drawGround(c, x0, y0, x0 + N, y0 + N);
    } catch (e) { if (!S.decErr) { S.decErr = true; console.warn('3B: zemin izleri', e); } }
    finally { C.ox = sv[0]; C.oy = sv[1]; g.vw = sv[2]; g.vh = sv[3]; c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; }
    D3.renderer.decalUpload(DEC.cv);
    return [x0 - sc.OX, y0 - sc.OZ, N, N];
  }
  // bulut gölgesi: oyunun bulut ayarı, gün ışığı, örtü ve sisiyle (FX.drawClouds) aynı güç; desen rüzgârla kayar
  function cloudOf(g, sc) {
    if (!g.settings.clouds || g.insideB || (typeof PERF_OFF !== 'undefined' && PERF_OFF.clouds)) return null;
    const dl = g.daylight;
    if (dl < 0.3) return null;
    const cover = (g.weather && g.weather.cloud) || 0, env = g.envCache || {};
    const alpha = 0.2 * clamp((dl - 0.3) / 0.4, 0, 1) * (1 - clamp((cover - 0.45) / 0.4, 0, 1) * 0.85) * (1 - (env.fog || 0) * 0.8);
    if (alpha < 0.03) return null;
    return [FX.cloudOff.x - sc.OX, FX.cloudOff.y - sc.OZ, alpha / 0.2 * 0.55, clamp(0.28 + cover * 0.45, 0, 1)];
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
    camFrame(g);
    const K = S.cam;
    HY.beat();
    FX.beginFrame();
    const sc = sceneFor(g);
    // görünen alan: dönmüş ve derinliği uzamış zemin dikdörtgenini (ve kameraya yakın uzun canlıları) kapsayan çember
    const vis = [], mx = K.cx, my = K.cy, VR = Math.hypot(vw, vh / K.st) / 2 + 70;
    const near = (e) => Math.abs(e.x - mx) < VR && Math.abs(e.y - my) < VR && (e.x - mx) ** 2 + (e.y - my) ** 2 < VR * VR;
    for (const e of g.ents) if (near(e) && !(e.rider === P) && !g.floorHid(e) && !Juice.lowerHid(e)) vis.push(e);
    if (P.riding) vis.push(P.riding);
    vis.push(P);
    for (const gh of Juice.ghosts || []) if (near(gh)) vis.push(gh);
    capture(g, vis, x0, y0);
    S.nearFn = (x, y, pad) => inV(x, y, mx, my, VR + pad);
    sceneFx(g, sc, dt || 1 / 60, S.nearFn);
    const act = actors(g, sc, g.t);
    const S0 = sunState(g), env = envOf(g, S0);
    buildingState(g, sc, env.night);
    const lights = lightsOf(g, sc, mx, my, VR - 10, S0);
    const IB = g.insideB, ip = IB && sc.bparts.get(IB.id);
    const indoor = ip ? [IB.x * 16 - sc.OX + 3, IB.y * 16 - sc.OZ + 12, (IB.x + IB.w) * 16 - sc.OX - 3, (IB.y + IB.h) * 16 - sc.OZ - 2, ip.Hw - 1] : null;
    // çiziciye kamera yerel birimle (sahne kökü OX, OZ)
    const cam = { c: K.c, s: K.s, st: K.st, ct: K.ct, u: K.u - (K.c * sc.OX - K.s * sc.OZ), w: K.w - (K.s * sc.OX + K.c * sc.OZ) * K.st, cx: K.cx - sc.OX, cz: K.cy - sc.OZ };
    cam.zc = K.s * cam.cx + K.c * cam.cz;
    // ton titreşiminin kayması: kamera bir piksel kayınca desen de kayar (gl_FragCoord y aşağıdan yukarı)
    const m4 = (v) => ((Math.round(v * ds) % 4) + 4) % 4;
    cam.px = m4(K.u); cam.py = m4(-K.w);
    const view = { lw, lh, ds, cam, indoor, hole: { p: [P.x - sc.OX, 13, P.y - sc.OZ], r: 22 }, decal: decals(g, sc, mx, my), cloud: cloudOf(g, sc) };
    S.view = view;
    D3.renderer.render(sc, view, act, lights, env, g.t);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(D3.renderer.cv, 0, 0);
    ctx.restore();
    // 2D: varlıkların ek çizimleri, mermiler (gövde hizasında), parçacıklar; dünya koordinatından 3B görüntüye izdüşürülür
    ctx.save();
    ctx.translate(-x0, -y0);
    RP.begin(ctx);
    try {
      rec.replay(RP.ctx, (e) => { RP.st.base = e ? [e.x - x0, e.y - y0] : null; });
      RP.st.base = null;
      RP.ctx.globalAlpha = 1; RP.ctx.globalCompositeOperation = 'source-over';
      RP.st.h = 10;
      g.drawProjs(RP.ctx);
      RP.st.h = 0;
    } finally { RP.end(); }
    ctx.restore();
    // parçacıklar: yerdeki noktaları ve yükseklikleriyle (ekran pikseliyle çizilir)
    ctx.save(); ctx.setTransform(ds, 0, 0, ds, 0, 0);
    try { parts3D(ctx, mx, my, VR); } finally { ctx.restore(); }
    // oyunun üst katmanı: arayüz, hava (2D ışık, parıltı ve teller 3B'de). Dünyaya bağlı çizimler yeniden izdüşüren
    // bağlamla, nişangâh ve işaretler dayanak noktasıyla çizilir; ekran efektleri olduğu gibi
    FX.glTint = true;
    const swaps = [];
    const swap = (obj, k, fn) => { swaps.push([obj, k, obj[k]]); obj[k] = fn; };
    const scr = (fn) => function (c) { c.save(); c.setTransform(ds, 0, 0, ds, 0, 0); try { fn(c, mx, my, VR); } finally { c.restore(); } };
    swap(g, 'drawWires', () => {});
    swap(FX, 'drawHigh', scr(fxHigh3D));
    swap(Juice, 'drawHigh', scr(juiceHigh3D));
    swap(g, 'drawBirds', scr(birds3D));
    swap(g, 'drawFlies', scr(flies3D));
    swap(FX, 'drawClouds', () => {});
    swap(g, 'drawWorldUI', function (c, dt2) { worldUI(this, c, dt2); });
    swap(Juice, 'drawGlow', scr(glow3D));
    try { g.renderTail(ctx, dt, x0, y0, x1, y1, [], false); } finally { for (let i = swaps.length - 1; i >= 0; i--) { const [o, k, f] = swaps[i]; o[k] = f; } }
    S.frames++;
    sweepMeshes();
    S.ms = S.ms * 0.9 + (performance.now() - t0) * 0.1;
  }

  /* ---------------- fareyle bakış ----------------
     Fare kendiliğinden bakış yönüdür: 3B oyun sürerken her fare hareketi kamerayı döndürür (sağa-sola) ve nişanı
     uzaklaştırıp yaklaştırır (ileri-geri); tıklamak gerekmez. İmleç 3B oyunda görünmez. Tarayıcı fareyi yalnızca bir
     tuş ya da tıklamadan sonra kilitler: ilk tuş ya da tıklama (oyuna da gider) fareyi kilitler, kilitliyken dönüş
     sınırsızdır (imleç ekran kenarına dayanmaz). Esc kilidi bırakır; menü, harita ya da konuşma açılınca kilit bırakılır,
     kapanınca geri gelir. Silah çarkı açıkken fare çarka gider (ortadan başlayan sanal imleç). */
  const TAU2 = Math.PI * 2;
  const playing = () => typeof G !== 'undefined' && G.state === 'play' && S.on && S.ok && !!S.area && !(UI.isModal && UI.isModal());
  const locked = () => !!G.canvas && document.pointerLockElement === G.canvas;
  function lookBy(dx, dy) {
    const k = sensMul();
    S.yaw -= dx * LOOK_YAW * k;
    if (S.yaw > Math.PI) S.yaw -= TAU2; else if (S.yaw <= -Math.PI) S.yaw += TAU2;
    S.aim = Math.max(AIM_MIN, S.aim - dy * AIM_K * k);   // üst sınır kamera karesinde (ekranın tepesi)
  }
  function lockNow() {
    S.lockReqT = performance.now();
    try { const r = G.canvas.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (e) {}
  }
  function vcStart() { S.vc = [innerWidth / 2, innerHeight / 2]; Input.mouse.x = S.vc[0]; Input.mouse.y = S.vc[1]; }
  // kilit isteği: tuş ya da tıklama (bir sonraki karede; o tuş bir pencere açtıysa istenmez)
  window.addEventListener('keydown', (ev) => { if (!locked() && ev.code !== 'Escape' && !ev.repeat) S.wantLock = performance.now(); }, true);
  window.addEventListener('mousedown', (ev) => { if (!locked() && ev.target === G.canvas) S.wantLock = performance.now(); }, true);
  window.addEventListener('mousemove', (ev) => {
    const lk = locked();
    if (!lk && !(playing() && S.cam.ok && !(ev.target && /^(INPUT|SELECT|TEXTAREA|BUTTON)$/.test(ev.target.tagName)))) return;
    const dx = ev.movementX || 0, dy = ev.movementY || 0;
    if (Math.abs(dx) > 400 || Math.abs(dy) > 400) return;   // bazı sistemlerde kilit anında görülen sıçrama
    if (lk) {
      // imleç kilitliyken oyunun fare konumu (değişmeyen clientX) yazılmasın
      ev.stopPropagation();
      Input.device = 'kb';
      if (G.wheelOpen) {
        Input.mouse.moved = true;
        if (!S.vc) vcStart();
        S.vc[0] = clamp(S.vc[0] + dx, 0, innerWidth); S.vc[1] = clamp(S.vc[1] + dy, 0, innerHeight);
        Input.mouse.x = S.vc[0]; Input.mouse.y = S.vc[1];
        return;
      }
      S.vc = null;
    }
    if (playing() && !G.wheelOpen) lookBy(dx, dy);
  }, true);
  document.addEventListener('pointerlockchange', () => {
    const was = S.look;
    S.look = locked();
    if (S.look) { S.relock = false; S.wantLock = 0; }
    // kilidi oyuncu bıraktı (Esc ya da pencere değişti): oyun birkaç kare içinde bir pencere açmazsa duraklat menüsü
    // açılır (imleç orada görünür); menü kapanınca kilit geri gelir
    else if (was) S.lostN = 1;
    S.vc = null;
    badge();
  });
  document.addEventListener('pointerlockerror', () => { S.look = false; S.relock = false; badge(); });
  if (typeof UI.openWheel === 'function') {
    const openWheel = UI.openWheel;
    UI.openWheel = function (...a) { if (locked()) vcStart(); return openWheel.apply(this, a); };
  }
  // dürbün: kameranın baktığı yöne, nişan uzaklığına göre (ileri itince daha uzağa) bakar
  if (typeof G.binocUpdate === 'function') {
    const binocUpdate = G.binocUpdate;
    G.binocUpdate = function (dt) {
      const r = binocUpdate.call(this, dt);
      const B = this.binoc;
      if (B && on3D() && Input.device === 'kb') {
        const K = S.cam, RB = typeof BINOC_R !== 'undefined' ? BINOC_R : 420, d = clamp(S.aim * 1.6, 40, RB);
        B.x = K.fx * d; B.y = K.fy * d; B.mouse = false;
        this.player.ang = Math.atan2(B.y, B.x);
      }
      return r;
    };
  }
  // 3B oyunda imleç görünmez (nişan işareti onun yerinde); pencere, menü ve 2D'de görünür
  let cursorOff = false;
  function cursorState() {
    const off = playing() && S.cam.ok && !(G.wheelOpen && !locked());
    if (off === cursorOff || !G.canvas) return;
    cursorOff = off; G.canvas.style.cursor = off ? 'none' : '';
  }

  /* yürüyüş kameraya göre: W ekranda yukarı, yani kameranın baktığı yön (atta ve arabada sürüş zaten atın yönüne göre) */
  const rotVec = (v, a) => { const c = Math.cos(a), s = Math.sin(a); return Object.assign({}, v, { x: v.x * c - v.y * s, y: v.x * s + v.y * c }); };
  const updFoot = Player.prototype.updateFoot;
  Player.prototype.updateFoot = function (dt, mv, ...a) {
    if (on3D() && this === G.player && mv && mv.m > 0) mv = rotVec(mv, -S.yaw);
    return updFoot.call(this, dt, mv, ...a);
  };
  /* nişan: kameranın baktığı yönde, nişan uzaklığında (fare ileri-geri). Oyunun hesabına bu noktanın düz 2D konumu
     verilir (oyun uzaklığı silahın menziliyle sınırlar). Kolda sağ çubuk kameraya göre döner. */
  const updAim = Player.prototype.updateAim;
  Player.prototype.updateAim = function (dt, mv) {
    if (!on3D() || this !== G.player) return updAim.call(this, dt, mv);
    const I = Input, m = I.mouse, ox = m.x, oy = m.y, av = I.aimVec, K = S.cam;
    const r = G.canvasRect(), k = r.width / G.vw;
    const wx = this.x + K.fx * S.aim, wy = this.y + K.fy * S.aim;
    m.x = r.left + (wx - G.cam.ox) * k; m.y = r.top + (wy - G.cam.oy) * k;
    I.aimVec = function () { return rotVec(av.call(this), -S.yaw); };
    try { return updAim.call(this, dt, mv); } finally { m.x = ox; m.y = oy; I.aimVec = av; }
  };

  /* dünya arayüzü (G.drawWorldUI'nin 3B kamera hâli): nişangâh ve kilit köşeleri gövde hizasında, etkileşim ve hikâye
     işaretleri hedefin başının üstünde, yapı önizlemesi zemindeki eğik dikdörtgen */
  function worldUI(g, c, dt) {
    const P = g.player, x0 = g.cam.ox, y0 = g.cam.oy, K = S.cam;
    RP.begin(c);
    RP.st.snap = true;
    const X = RP.ctx, base = (x, y, h) => { RP.st.base = x === null ? null : [x - x0, y - y0, h || 0]; };
    // imleç görünmediğinden nişan işaretleri bir piksellik koyu payla çizilir (açık zeminde de seçilir); önce bütün
    // paylar, sonra işaretler (paylar üst üste binip koyulaşmasın)
    const marks = (col, R) => {
      X.fillStyle = 'rgba(20,12,8,0.45)';
      for (const r of R) X.fillRect(r[0] - 1, r[1] - 1, r[2] + 2, r[3] + 2);
      X.fillStyle = col;
      for (const r of R) X.fillRect(r[0], r[1], r[2], r[3]);
    };
    const onView = (x, y, pad) => { const q = w2s(x, y); return q[0] > -pad && q[0] < K.vw + pad && q[1] > -pad && q[1] < K.vh + pad; };
    try {
      const it = UI.curInteract;
      if (it && !it.riding) {
        const bb = Math.sin(g.t * 5) * 1.5;
        base(it.x, it.y);
        X.fillStyle = 'rgba(255,255,255,0.9)';
        X.beginPath(); X.moveTo(it.x - 3, it.y - 16 + bb); X.lineTo(it.x + 3, it.y - 16 + bb); X.lineTo(it.x, it.y - 12 + bb); X.fill();
        base(null);
      }
      // imleç yok: nişan alınmıyorsa bakılan nokta küçük bir artıyla (oyunun soluk noktası yerine); nişan alınca oyunun
      // dağılım çizgileri aynı noktada
      const mouseAim = Input.device === 'kb' && g.state === 'play' && !UI.isModal();
      const lookDot = mouseAim && !(P.aiming || P.rsAim);
      if (lookDot) {
        const lx = P.x + K.fx * S.aim, ly = P.y + K.fy * S.aim;
        base(lx, ly, AIM_H);
        marks('rgba(255,248,230,0.85)', [[lx - 0.5, ly - 0.5, 1, 1], [lx - 3.5, ly - 0.5, 2, 1], [lx + 1.5, ly - 0.5, 2, 1], [lx - 0.5, ly - 3.5, 1, 2], [lx - 0.5, ly + 1.5, 1, 2]]);
        base(null);
      }
      if (P.aiming || (P.rsAim && P.isArmed) || (!lookDot && Input.device === 'kb' && P.isArmed && g.state === 'play' && !UI.isModal())) {
        const d = mouseAim ? S.aim : (P.aiming || P.rsAim) ? P.aimDist : Math.min(P.aimDist, 60);
        const rx = mouseAim ? P.x + K.fx * d : P.x + Math.cos(P.aimAng) * d, ry = mouseAim ? P.y + K.fy * d : P.y + Math.sin(P.aimAng) * d;
        const far = mouseAim && P.W && P.W.range && d > P.W.range + 4;   // menzil dışı: mermi oraya ulaşmaz
        let enemy = false;
        for (const e of g.ents) if (!e.dead && (e.kind === 'animal' || e.kind === 'npc') && (e.x - rx) ** 2 + (e.y - ry) ** 2 < 64) { enemy = true; break; }
        const L = P.lockTarget;
        if (L && !L.dead && (P.aiming || P.rsAim)) {
          const hostile = P.targetClass(L) >= 2.5, r = (L.r || 4) + 4 + Math.sin(g.t * 8) * 0.6;
          base(L.x, L.y, AIM_H);
          X.fillStyle = hostile ? '#ff4a3a' : 'rgba(255,255,255,0.95)';
          for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { X.fillRect(L.x + sx * r - (sx > 0 ? 2 : 0), L.y + sy * r - (sy > 0 ? 0.6 : 0), 2.6, 0.9); X.fillRect(L.x + sx * r - (sx > 0 ? 0.6 : 0), L.y + sy * r - (sy > 0 ? 2 : 0), 0.9, 2.6); }
          enemy = hostile;
        }
        base(rx, ry, AIM_H);
        // menzil dışında soluk
        const col = P.deadeye ? '#e03020' : enemy ? '#ff5040' : 'rgba(255,255,255,0.92)';
        X.fillStyle = col;
        if (far) X.globalAlpha = 0.7;
        if (P.aiming || P.rsAim) {
          const sp = Math.round(P.W && P.W.spread ? P.W.spread * d * (P.deadeye ? 0.2 : 1) * (P.aiming ? 1 : 1.7) * (1 - 0.45 * clamp((P.aimSteady || 0) / 0.7, 0, 1)) + 2 : 3);
          marks(col, [[rx - 0.5, ry - 0.5, 1, 1], [rx - sp - 2.5, ry - 0.5, 2, 1], [rx + sp + 0.5, ry - 0.5, 2, 1], [rx - 0.5, ry - sp - 2.5, 1, 2], [rx - 0.5, ry + sp + 0.5, 1, 2]]);
          if (P.weapon === 'dynamite') {
            // dinamit en çok 140 birim atılır: çember düşeceği yerde, zeminde
            base(null); X.globalAlpha = 1;
            const dd = Math.min(P.aimDist, 140), ex = P.x + Math.cos(P.aimAng) * dd, ey = P.y + Math.sin(P.aimAng) * dd;
            X.strokeStyle = 'rgba(255,200,100,0.6)'; X.lineWidth = 1; X.beginPath();
            for (let k = 0; k <= 24; k++) { const a = k / 24 * TAU2; X[k ? 'lineTo' : 'moveTo'](ex + Math.cos(a) * 20, ey + Math.sin(a) * 20); }
            X.stroke();
          }
        } else { X.globalAlpha = far ? 0.35 : 0.5; X.fillRect(rx - 0.5, ry - 0.5, 1, 1); }
        X.globalAlpha = 1;
        base(null);
      }
      const HP = g.homePreview;
      if (HP) {
        if (HP.t !== undefined && (HP.t -= dt) <= 0) g.homePreview = null;
        X.strokeStyle = HP.bad ? 'rgba(230,80,60,0.9)' : 'rgba(240,220,140,0.9)'; X.lineWidth = 1; X.setLineDash([3, 2]);
        const ax = HP.tx * TS + 0.5, ay = HP.ty * TS + 0.5, bx = ax + HOME_FW * TS - 1, by = ay + HOME_FH * TS - 1;
        X.beginPath(); X.moveTo(ax, ay); X.lineTo(bx, ay); X.lineTo(bx, by); X.lineTo(ax, by); X.closePath(); X.stroke(); X.setLineDash([]);
      }
      const qm = g.questMark && g.questMark();
      if (qm && !g.storyTalking() && onView(qm.x, qm.y, 10)) {
        const bb = Math.sin(g.t * 4) * 1.5, y = qm.y - (qm.kind ? 20 : 12) + bb;
        base(qm.x, qm.y);
        X.fillStyle = 'rgba(0,0,0,0.5)'; X.beginPath(); X.moveTo(qm.x, y - 5); X.lineTo(qm.x + 4.5, y); X.lineTo(qm.x, y + 5); X.lineTo(qm.x - 4.5, y); X.fill();
        X.fillStyle = '#f0c040'; X.beginPath(); X.moveTo(qm.x, y - 4); X.lineTo(qm.x + 3.5, y); X.lineTo(qm.x, y + 4); X.lineTo(qm.x - 3.5, y); X.fill();
        base(null);
      }
      const wp = g.waypoint;
      if (wp && onView(wp.x, wp.y, 0)) {
        base(wp.x, wp.y);
        X.fillStyle = '#e8c860'; X.beginPath(); X.moveTo(wp.x, wp.y); X.lineTo(wp.x - 4, wp.y - 8); X.lineTo(wp.x + 4, wp.y - 8); X.fill();
        base(null);
      }
    } finally { RP.end(); }
  }

  /* DOM işaretleri (etkileşim belirteci, fark edilme işareti, konuşma balonu): modül konumunu düz 2D'ye göre yazar;
     3B'de her işaret, bağlı olduğu varlığın ayak noktasının görüntüdeki yerine kaydırılır (başın üstündeki pay korunur).
     Modül bir karede konumu yeniden yazmadıysa son kaydırma tekrar uygulanmaz. */
  function shiftEl(el, bx, by) {
    if (!el) return;
    const cur = el.style.transform;
    const orig = el._d3 && cur === el._d3.out ? el._d3.orig : cur;
    const m = /translate\(([-\d.]+)px, ([-\d.]+)px\)/.exec(orig);
    if (!m) return;
    const r = G.canvasRect(), k = r.width / G.vw, fx = bx - G.cam.ox, fy = by - G.cam.oy;
    const [rx, ry] = w2s(bx, by);
    const out = orig.replace(m[0], `translate(${(+m[1] + (rx - fx) * k).toFixed(1)}px, ${(+m[2] + (ry - fy) * k).toFixed(1)}px)`);
    el._d3 = { orig, out };
    if (cur !== out) el.style.transform = out;
  }
  const after = (obj, k, fn) => { if (!obj || typeof obj[k] !== 'function') return; const o = obj[k]; obj[k] = function (...a) { const r = o.apply(this, a); try { if (on3D()) fn.call(this); } catch (e) {} return r; }; };
  if (typeof InteractMarks !== 'undefined') after(InteractMarks, 'update', function () {
    for (const sm of this.st.values()) {
      if (!sm.el) continue;
      const kk = sm.c && sm.c.key;
      const [bx, by] = kk && kk.kind ? [kk.x, kk.y] : kk && kk.door ? [kk.door.x, kk.door.y] : [sm.c.x, sm.c.y];
      shiftEl(sm.el, bx, by);
    }
  });
  if (typeof AwareMarks !== 'undefined') after(AwareMarks, 'update', function () { for (const [e, mk] of this.map) shiftEl(mk.el, e.x, e.y); });
  if (typeof Bubbles !== 'undefined') after(Bubbles, 'update', function () { for (const bl of this.list) shiftEl(bl.el, bl.e.x, bl.e.y); });
  // ekran kenarı okları: hedef noktaları kısa süre 3B görüntüdeki yerlerine (düz 2D karşılığına) konur, ok o yöne bakar
  if (typeof Nav !== 'undefined' && typeof Nav.edge === 'function') {
    const edge = Nav.edge;
    Nav.edge = function (...a) {
      if (!on3D()) return edge.apply(this, a);
      const keep = [];
      const put = (o, kx, ky) => { if (!o || o[kx] === undefined || o[kx] === null) return; keep.push([o, kx, ky, o[kx], o[ky]]); const q = w2s(o[kx], o[ky]); o[kx] = G.cam.ox + q[0]; o[ky] = G.cam.oy + q[1]; };
      put(G.waypoint, 'x', 'y');
      if (this.q) { put(this.q, 'tx', 'ty'); put(this.q, 'tx2', 'ty2'); }
      try { return edge.apply(this, a); } finally { for (const [o, kx, ky, vx, vy] of keep) { o[kx] = vx; o[ky] = vy; } }
    };
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
    const kl = (c) => (typeof KEY_LABEL !== 'undefined' && KEY_LABEL[c]) || c;
    const cam = T_('Fare: bakış ve nişan', 'Mouse: look and aim') + '  ·  Esc: ' + T_('duraklat', 'pause');
    badgeEl.textContent = (S.on && S.ok ? T_('3B TEST', '3D TEST') + '  ·  ' + cam : T_('2D', '2D'))
      + '  ·  F3 ' + T_('3B/2D', '3D/2D') + '  ·  ' + kl('BracketLeft') + ' ' + kl('BracketRight') + ' ' + T_('saat', 'time');
    badgeEl.style.display = G.state === 'play' ? '' : 'none';
  }
  const uiUpdate = UI.update;
  UI.update = function (...a) {
    const r = uiUpdate.apply(this, a);
    // fare kilidi: menü, harita, konuşma ya da 2D'de bırakılır; yalnız oyun içi pencere kapanınca kendiliğinden geri gelir
    if (S.look && !playing()) {
      S.relock = G.state === 'play' && S.on && S.ok;
      S.look = false;
      if (locked()) document.exitPointerLock();
    } else if (!S.look && S.lostN && !playing()) {
      S.relock = G.state === 'play' && S.on && S.ok;
      S.lostN = 0;
    } else if (!S.look && playing() && !document.pointerLockElement && performance.now() - (S.lockReqT || 0) > 700
      && (S.relock || (S.wantLock && performance.now() - S.wantLock < 4000) || !S.autoTried)) {
      // pencere kapandı, tuşa basıldı ya da tıklandı (oyuna ilk girişte de bir kez denenir: yeni oyun tıklaması sayılabilir)
      S.relock = false; S.wantLock = 0; S.autoTried = true; lockNow();
    }
    if (!S.look && S.relock && (G.state !== 'play' || !S.on)) S.relock = false;
    cursorState();
    if (S.lostN && ++S.lostN > 4) {
      S.lostN = 0;
      if (playing() && !locked()) { S.relock = true; try { UI.openPause(); } catch (e) {} }
    }
    const want = G.state === 'play' ? '' : 'none';
    if (!badgeEl || badgeEl.style.display !== want || badgeEl._on !== (S.on && S.ok) || badgeEl._look !== S.look) { badge(); badgeEl._on = S.on && S.ok; badgeEl._look = S.look; }
    return r;
  };

  Object.assign(D3, { w2s, s2w, lookBy, sensMul, AIM_H, AIM_MIN, LOOK_YAW, AIM_K, radarRot: () => (on3D() ? S.yaw : 0) });

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
