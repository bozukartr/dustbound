'use strict';
/* =====================================================================
   FRONTIER'S END — 3B TEST DEMOSU (oyun katmanı)

   Bu dosya ve demo3d/ klasörü yalnızca 3B test paketine girer (npm run build:demo3d). Oyunun kendi
   dosyalarında hiçbir değişiklik yoktur: 3B çizim, oyun yüklendikten sonra birkaç fonksiyonun etrafına
   sarılan katmanlarla eklenir.
     - Çiftçi Çocuğu geçmişiyle Harlow'da başlanır; hikâye, açılış sinematiği ve hoş geldin rehberi yok
     - Oyuncu kasabanın ortasındaki sınırlı bir alanda kalır (binalar alanın ya tam içinde ya tam dışında)
     - Dünya 3B çizilir; oyunun 2D arayüzü, fare nişanı ve işaretleri olduğu gibi üstüne oturur
     - Üçüncü şahıs kamera: karakterin arkasında, perspektif; fare kendiliğinden kamerayı yönetir (oyun sürerken basılan
       ilk tuş ya da tıklama fareyi kilitler, Esc bırakır). Sağa-sola sınırsız döner, yukarı-aşağı yerden göğe bakar;
       nişan alınca omzun üstüne yaklaşır. Nişan ekranın ortasındaki noktadır. Ufukta gök, güneş, ay, yıldız ve bulutlar;
       uzak sahne sise karışır. Fare hassasiyeti Ayarlar > Kontroller'de. Yürüyüş kameraya göre; 2D çizimler ve
       işaretler perspektif görüntüye yeniden yerleşir
     - F3: 3B ↔ 2D, [ ve ]: saati bir saat geri/ileri al
     - Kayıtlar ve ayarlar tam oyununkilerden ve demo paketinden ayrı tutulur
   ===================================================================== */
(() => {
  const { M4, C, Renderer, GPUMesh, Mesh, LineMesh, MAT, F, buildHuman, buildHorse, buildAnimal, animalSkel, animalPose, skelPose, HUMAN_SK, HORSE_SK, POSE, HPOSE, armPose, P3 } = D3;
  const T_ = (tr, en) => (typeof I18N !== 'undefined' && I18N.lang === 'en' ? en : tr);
  const DEG = Math.PI / 180;
  // eğim: kameranın hedefin üstündeki açısı (artı: yukarıdan aşağı bakar, eksi: aşağıdan göğe bakar)
  const P_MIN = -38 * DEG, P_MAX = 82 * DEG, P_DEF = 11 * DEG;
  const CAM = {
    dist: 78, distAim: 44, distRide: 104, distIn: 132,     // hedefe uzaklık: yürürken, nişanda, binekte, iç mekânda
    h: 24, hRide: 40, hIn: 16,                              // hedefin yerden yüksekliği (omuz hizası)
    fov: 52 * DEG, fovAim: 40 * DEG, fovBinoc: 12 * DEG,    // dikey görüş açısı
    shoulder: 10,                                           // nişanda kamera omzun üstüne (sağa) kayar
    pitchIn: 54 * DEG,                                      // iç mekânda en az eğim: kesitli odaya yukarıdan
    near: 2, far: 3600, fog: [330, 1400],                   // yakın/uzak düzlem; sis başlangıcı ve tam sis
  };
  const LOOK = 0.0025;           // fare pikseli başına dönüş (radyan; hassasiyet ayarı ortadayken)
  const AIM_H = 11;              // nişan ışını bu yükseklikteki düzleme değer (gövde hizası)
  const AREA_W = 62, AREA_H = 46;   // sınırlı alan (karo), binalara göre genişler ya da daralır
  const MARGIN = 46;             // alanın çevresinde nesneleriyle kurulan pay (karo); ötesinde zemin sise dek uzanır
  const S = D3.state = { on: true, ok: true, scene: null, area: null, err: null, cap: [], pool: [], meshes: new Map(), skels: new Map(), lastWarn: -99, ms: 0, frames: 0,
    yaw: 0, pitch: P_DEF, look: false, relock: false, vc: null, dist: CAM.dist, inK: 0, aimK: 0, binK: 0, rideK: 0, lastLook: 0, wantLock: false,
    cam: { ok: false } };
  // fare hassasiyeti: ayar 0..1 (ortası 1×), çarpan 0,25× .. 4×
  if (G.settings.d3Sens === undefined) G.settings.d3Sens = 0.5;
  const sensMul = () => Math.pow(2, (clampS(G.settings.d3Sens, 0, 1) - 0.5) * 4);
  function clampS(v, a, b) { v = +v; return !(v >= a) ? (v > b ? b : a) : v > b ? b : v; }
  // 3B kamera etkin mi: yürüyüş, nişan ve 2D katmanlar onun izdüşümüne göre yerleşir
  const on3D = () => S.on && S.ok && !!S.area && S.cam.ok;
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const lerp = (a, b, t) => a + (b - a) * t;
  const mix3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

  /* ---------------- ayrı kayıt, Harlow başlangıcı, sinematiksiz ---------------- */
  for (const k of ['get', 'set', 'remove']) { const f = Platform[k].bind(Platform); Platform[k] = (key, ...a) => f('d3_' + key, ...a); }
  for (let i = BACKGROUNDS.length - 1; i >= 0; i--) if (BACKGROUNDS[i].id !== 'farm') BACKGROUNDS.splice(i, 1);
  const reset = () => { S.scene = null; S.area = null; S.autoTried = false; };
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
  /* ---------------- 3B kamera: üçüncü şahıs ----------------
     Kamera karakterin arkasında, omuz hizasındaki bir hedefe bakar. Fare sağa-sola kamerayı karakterin çevresinde
     sınırsız döndürür, ileri-geri eğer (yukarıdan yere bakıştan aşağıdan göğe bakışa). Nişan alınca omzun üstüne yaklaşır
     ve görüş daralır; binekte uzaklaşıp yükselir; içeride kesitli odaya yukarıdan bakar; dürbünde göz hizasından bakar
     ve görüş çok daralır.
     Kamerayla hedef arasına bina girerse kamera binanın önüne çekilir; yerin altına inmez. */
  let camT = 0;
  const angWrap = (a) => { while (a > Math.PI) a -= Math.PI * 2; while (a <= -Math.PI) a += Math.PI * 2; return a; };
  // hedeften d yönünde (birim) en çok dist uzaklıkta, araya giren ilk binanın uzaklığı (içinde bulunulan bina sayılmaz)
  function camHit(g, sc, T, d, dist) {
    let best = dist;
    if (!sc) return best;
    const IB = g.insideB;
    for (const part of sc.bparts.values()) {
      const b = part.b;
      if (IB && IB.id === b.id) continue;
      const lo = [b.x * 16 - 1, 0, b.y * 16 - 1], hi = [(b.x + b.w) * 16 + 1, (part.Hw || 30) + 24, (b.y + b.h) * 16 + 1];
      let t0 = 0, t1 = best, ok = true;
      for (let i = 0; i < 3 && ok; i++) {
        if (Math.abs(d[i]) < 1e-6) { if (T[i] < lo[i] || T[i] > hi[i]) ok = false; continue; }
        let a = (lo[i] - T[i]) / d[i], c = (hi[i] - T[i]) / d[i];
        if (a > c) { const x = a; a = c; c = x; }
        if (a > t0) t0 = a; if (c < t1) t1 = c;
        if (t0 > t1) ok = false;
      }
      if (ok && t0 > 0 && t0 < best) best = t0;
    }
    return best;
  }
  const n3 = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
  function camFrame(g, sc) {
    const K = S.cam, P = g.player, vw = g.vw, vh = g.vh;
    const now = performance.now(), dt = camT ? Math.min(0.1, (now - camT) / 1000) : 0;
    camT = now;
    const ease = (cur, tgt, rate) => cur + (tgt - cur) * (1 - Math.exp(-dt * rate));
    const ride = P.riding;
    S.inK = ease(S.inK, g.insideB ? 1 : 0, 5);
    S.aimK = ease(S.aimK, P.aiming || P.rsAim ? 1 : 0, 10);
    S.binK = ease(S.binK, g.binoc ? 1 : 0, 6);
    S.rideK = ease(S.rideK, ride ? 1 : 0, 4);
    // binekte fare bir süre oynamazsa kamera yavaşça gidilen yönün arkasına döner
    if (ride && now - S.lastLook > 1600 && (ride.spd || 0) > 25) {
      const a = ride.ang + (ride.back ? Math.PI : 0), want = Math.atan2(-Math.cos(a), -Math.sin(a));
      S.yaw = angWrap(S.yaw + angWrap(want - S.yaw) * (1 - Math.exp(-dt * 1.2)));
    }
    const pitch = Math.max(S.pitch, lerp(P_MIN, CAM.pitchIn, S.inK));
    // dürbünde göz hizasından bakılır (uzaklık sıfıra iner, karakter gizlenir)
    const dist = lerp(lerp(lerp(lerp(CAM.dist, CAM.distRide, S.rideK), CAM.distAim, S.aimK), CAM.distIn, S.inK), 0, S.binK);
    const hT = lerp(lerp(CAM.h, CAM.hRide, S.rideK), CAM.hIn, S.inK);
    const fov = lerp(lerp(CAM.fov, CAM.fovAim, S.aimK), CAM.fovBinoc, S.binK);
    const c = Math.cos(S.yaw), s = Math.sin(S.yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    const f2 = [-s, -c], r2 = [c, -s];                     // zeminde ileri ve sağ (dünya x, y)
    const sh = CAM.shoulder * S.aimK * (1 - S.inK);
    // sarsıntı: atış tepmesi ve patlama hedefi biraz oynatır
    let jx = 0, jy = 0;
    if (g.settings.shake && g.fx) { const k = (g.fx.shake || 0) * 0.5; jx = (Math.random() * 2 - 1) * k + (g.fx.kx || 0) * 0.6; jy = (Math.random() * 2 - 1) * k + (g.fx.ky || 0) * 0.6; }
    const T = [P.x + r2[0] * sh + jx, hT, P.y + r2[1] * sh + jy];   // hedef (dünya x, yükseklik, dünya y)
    const back = [-f2[0] * cp, sp, -f2[1] * cp];            // hedeften kameraya birim yön
    const hit = camHit(g, sc, T, back, dist);
    const want = Math.max(Math.min(5, dist), Math.min(dist, hit - 3));
    S.dist = !dt ? want : want < S.dist ? ease(S.dist, want, 24) : ease(S.dist, want, 3.5);
    const E = [T[0] + back[0] * S.dist, Math.max(3, T[1] + back[1] * S.dist), T[2] + back[2] * S.dist];
    const F = S.dist > 1 ? n3([T[0] - E[0], T[1] - E[1], T[2] - E[2]]) : [-back[0], -back[1], -back[2]];
    const R = n3([-F[2], 0, F[0]]);
    const U = [R[1] * F[2] - R[2] * F[1], R[2] * F[0] - R[0] * F[2], R[0] * F[1] - R[1] * F[0]];
    const tanY = Math.tan(fov / 2);
    Object.assign(K, { E, T, F, R, U, f2, r2, fov, tanY, fpx: vh / 2 / tanY, vw, vh, near: CAM.near, far: CAM.far, pitch, ox: g.cam.ox, oy: g.cam.oy, ok: true });
  }
  // dünya (x, y zemin; h yükseklik) → [görüntü x, y, derinlik, birim başına piksel]; kameranın arkasındaysa null
  const w2s = (x, y, h) => {
    const K = S.cam;
    if (!K.ok) return null;
    const dx = x - K.E[0], dy = (h || 0) - K.E[1], dz = y - K.E[2];
    const z = dx * K.F[0] + dy * K.F[1] + dz * K.F[2];
    if (z < K.near) return null;
    const kk = K.fpx / z;
    return [K.vw / 2 + (dx * K.R[0] + dy * K.R[1] + dz * K.R[2]) * kk, K.vh / 2 - (dx * K.U[0] + dy * K.U[1] + dz * K.U[2]) * kk, z, kk];
  };
  // görüntü noktasından giden ışının yönü (birim değil: ileri bileşeni 1)
  const rayOf = (sx, sy) => {
    const K = S.cam, a = (sx - K.vw / 2) / K.fpx, b = -(sy - K.vh / 2) / K.fpx;
    return [K.F[0] + K.R[0] * a + K.U[0] * b, K.F[1] + K.R[1] * a + K.U[1] * b, K.F[2] + K.R[2] * a + K.U[2] * b];
  };
  // görüntü noktası → h yüksekliğindeki düzlemde dünya noktası [x, y]; ışın düzleme inmiyorsa null
  const s2w = (sx, sy, h) => {
    const K = S.cam;
    if (!K.ok) return null;
    const d = rayOf(sx, sy);
    if (Math.abs(d[1]) < 1e-6) return null;
    const t = ((h || 0) - K.E[1]) / d[1];
    if (t <= 0) return null;
    return [K.E[0] + d[0] * t, K.E[2] + d[2] * t];
  };
  // görüntü noktasından giden ışının değdiği ilk canlı (dikey silindir: insan yarıçapı 6, boy 0..30)
  function rayEnt(g, sx, sy) {
    const K = S.cam, P = g.player, d = n3(rayOf(sx, sy));
    const hh = d[0] * d[0] + d[2] * d[2];
    if (hh < 1e-9) return null;
    let best = null, bt = 1e9;
    for (const e of g.ents) {
      if (e === P || e === P.riding || e.dead || e.remove || !(e.kind === 'npc' || e.kind === 'animal' || e.kind === 'horse')) continue;
      const ox = e.x - K.E[0], oz = e.y - K.E[2];
      const t = (ox * d[0] + oz * d[2]) / hh;
      if (t <= 0 || t >= bt) continue;
      const qx = K.E[0] + d[0] * t - e.x, qz = K.E[2] + d[2] * t - e.y, qy = K.E[1] + d[1] * t;
      const r = e.kind === 'npc' ? 6 : (e.r || 6) + 3;
      if (qx * qx + qz * qz < r * r && qy > -2 && qy < (e.kind === 'horse' ? 36 : 30)) { best = e; bt = t; }
    }
    return best;
  }
  // oyunun düz 2D tuval noktası (oyun kamerasına göre) → 3B görüntü
  const flat2s = (fx, fy, h) => w2s(S.cam.ox + fx, S.cam.oy + fy, h);

  /* ---------------- yeniden izdüşüren 2D bağlam ----------------
     Oyunun dünya koordinatlı 2D çizimleri (mermi, parçacık, nişangâh, varlık ekleri) bu bağlamdan geçer: her çağrının
     dayanak noktası (düz 2D tuvaldeki yeri) perspektif görüntüdeki yerine taşınır, şekil oraya kaydırılır; st.scale açıksa
     şekil o uzaklıktaki boyuna büyür ya da küçülür (yakındaki duman büyük, uzaktaki küçük), kapalıysa ekranda aynı
     boyda kalır (arayüz işaretleri). Çizgi noktaları tek tek taşınır. st.base verilirse (bir varlığın ayak noktası)
     bütün çağrılar onunla kayar: başın üstündeki işaret yine başın üstünde. st.h ya da base[2]: dayanak noktasının
     yerden yüksekliği. Kameranın arkasında kalan çizim ekran dışına atılır. */
  const RP = (() => {
    const sh = document.createElement('canvas').getContext('2d');   // oyunun dönüşüm yığını (gölge)
    let real = null;
    const st = { base: null, h: 0, scale: true };
    const place = (x, y) => {
      const M = sh.getTransform();
      let sx, sy, h = st.h;
      if (st.base) { sx = st.base[0]; sy = st.base[1]; h = st.base[2] || 0; } else { sx = M.a * x + M.c * y + M.e; sy = M.b * x + M.d * y + M.f; }
      const q = flat2s(sx, sy, h);
      if (!q) { real.setTransform(1, 0, 0, 1, -1e5, -1e5); return; }
      const k = st.scale ? Math.min(q[3], 12) : 1;
      real.setTransform(M.a * k, M.b * k, M.c * k, M.d * k, k * (M.e - sx) + q[0], k * (M.f - sy) + q[1]);
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
      // c: gerçek 2D bağlam (oyunun dönüşümüyle: dünya − oyun kamerası); scale: uzaklıkla boyut
      begin(c, scale = true, h = 0) { real = c; sh.setTransform(c.getTransform()); st.base = null; st.h = h; st.scale = scale; },
      end() { if (real) real.setTransform(sh.getTransform()); real = null; st.base = null; st.h = 0; st.scale = true; },
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
        out.push({ mesh, bones: B, self: c.e === P });
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
        out.push({ mesh, bones: B, self: !!(c.e && c.e === P.riding) });
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
        out.push({ mesh, bones: B, self: !!(P.riding && P.riding.kind === 'wagon') });
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
  // görünen gök: tepe ve ufuk rengi (gündüz, gün batımı, gece)
  const SKY = {
    day: { top: [0.36, 0.55, 0.84], hor: [0.82, 0.83, 0.78] },
    dusk: { top: [0.3, 0.31, 0.58], hor: [0.95, 0.64, 0.45] },
    night: { top: [0.025, 0.04, 0.1], hor: [0.075, 0.095, 0.17] },
  };
  const grey3 = (c) => { const l = c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11; return [l, l, l]; };
  function envOf(g, S0) {
    const h = g.hour, dl = S0.dl, day = S0.day;
    const fade = day ? clamp(Math.min(h - 5.2, 20.3 - h) / 0.8, 0, 1) : 0;
    const low = day ? clamp(1 - (S0.e - 0.36) / 0.45, 0, 1) : 0, k = 1 - S0.cloud * 0.65;
    const dd = { sunCol: mix3(DAY.sunCol, DUSK.sunCol, low), sky: mix3(DAY.sky, DUSK.sky, low), ground: mix3(DAY.ground, DUSK.ground, low) };
    const n = Math.pow(dl, 0.8), cl = S0.cloud;
    let skyTop = mix3(SKY.night.top, mix3(SKY.day.top, SKY.dusk.top, low), n), skyHor = mix3(SKY.night.hor, mix3(SKY.day.hor, SKY.dusk.hor, low), n);
    skyTop = mix3(skyTop, grey3(skyTop), cl * 0.7); skyHor = mix3(skyHor, grey3(skyHor), cl * 0.5);
    return {
      skyTop, skyHor, sunGlow: day ? dd.sunCol.map(v => v * 0.55 * fade * (1 - cl * 0.7)) : [0.06, 0.075, 0.11],
      cloudCol: mix3(mix3([0.13, 0.15, 0.22], [0.86, 0.6, 0.5], low * (day ? fade : 0)), mix3([0.97, 0.96, 0.93], [1.0, 0.8, 0.66], low), n).map(v => v * (1 - cl * 0.3)),
      stars: clamp(1 - n * 1.8, 0, 1) * (1 - cl), cloud: 0.3 + cl * 0.7, moon: day ? 0 : 1,
      sunDir: [S0.dir[0], S0.dir[2], S0.dir[1]],
      sunCol: day ? dd.sunCol : NIGHT.sunCol, sky: mix3(NIGHT.sky, dd.sky, n), ground: mix3(NIGHT.ground, dd.ground, n),
      sunK: day ? 0.62 * fade * k * Math.max(0.3, dl) : 0.28 * (1 - dl),
      ambK: lerp(0.22, 0.33, dl) + S0.cloud * 0.05 * dl, nightMul: lerp(0.5, 1, n), night: S0.dark > 0.35, wind: 1,
    };
  }
  // adaylar kameranın önündeki geniş alandan; ışığı (yarıçapıyla) görüntüye düşmeyenler elenir, oyuncuya yakın olan önce
  function lightsOf(g, sc, S0) {
    const out = [], W = g.world, P = g.player, night = S0.dark > 0.35, nk = clamp(S0.dark * 1.4, 0, 1), IB = g.insideB, K = S.cam;
    const mx = P.x + K.f2[0] * 260, my = P.y + K.f2[1] * 260, VR = 760;
    const inView = (x, y, z, r) => {
      const q = w2s(x, y, z);
      if (!q) return Math.hypot(x - K.E[0], y - K.E[2]) < r;
      const m = r * q[3];
      return q[2] < CAM.fog[1] + r && q[0] > -m && q[0] < K.vw + m && q[1] > -m && q[1] < K.vh + m;
    };
    const add = (x, y, z, r, c, k, inner) => { if (k > 0.01 && inView(x, y, z, r)) out.push({ p: [x - sc.OX, z, y - sc.OZ], r, c, k, inner: inner ? 1 : 0, x, y }); };
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
    out.sort((a, b) => (b.inner - a.inner) || ((a.x - P.x) ** 2 + (a.y - P.y) ** 2) - ((b.x - P.x) ** 2 + (b.y - P.y) ** 2));
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
    camFrame(g, sc);
    const K = S.cam;
    // görünen canlılar: kameranın önünde, boyuyla görüntüye düşen ve tam sisin berisinde kalanlar
    const seen = (e) => { const q = w2s(e.x, e.y, 14); if (!q || q[2] > CAM.fog[1]) return false; const m = 32 * q[3] + 6; return q[0] > -m && q[0] < vw + m && q[1] > -m && q[1] < vh + m * 1.5; };
    const vis = [];
    for (const e of g.ents) if (seen(e) && !(e.rider === P) && !g.floorHid(e) && !Juice.lowerHid(e)) vis.push(e);
    if (P.riding) vis.push(P.riding);
    vis.push(P);
    for (const gh of Juice.ghosts || []) if (seen(gh)) vis.push(gh);
    capture(g, vis, x0, y0);
    let act = actors(g, sc, g.t);
    if (S.binK > 0.5) act = act.filter(a => !a.self);
    const S0 = sunState(g), env = envOf(g, S0);
    buildingState(g, sc, env.night);
    const lights = lightsOf(g, sc, S0);
    const IB = g.insideB, ip = IB && sc.bparts.get(IB.id);
    const indoor = ip ? [IB.x * 16 - sc.OX + 3, IB.y * 16 - sc.OZ + 12, (IB.x + IB.w) * 16 - sc.OX - 3, (IB.y + IB.h) * 16 - sc.OZ - 2, ip.Hw - 1] : null;
    // çiziciye kamera yerel birimle (sahne kökü OX, OZ). Gölge kutusu kameranın önündeki zemini kapsar; merkezi
    // 32 birimlik ızgarada durur (yürürken gölge haritası kıpırdamaz)
    const SR = 430, gx = Math.round((P.x + K.f2[0] * SR * 0.42 - sc.OX) / 32) * 32, gz = Math.round((P.y + K.f2[1] * SR * 0.42 - sc.OZ) / 32) * 32;
    const cam = { eye: [K.E[0] - sc.OX, K.E[1], K.E[2] - sc.OZ], at: [K.T[0] - sc.OX, K.T[1], K.T[2] - sc.OZ], fov: K.fov, near: K.near, far: K.far, yaw: S.yaw, sx: gx, sz: gz, sr: SR, fog: CAM.fog };
    // oyuncunun önündeki taç, saçak ve yakın bina oyuncunun çevresinde delinir (yarıçap uzaklığa göre)
    const hp = w2s(P.x, P.y, 13);
    const view = { lw, lh, ds, cam, indoor, hole: { p: [P.x - sc.OX, 13, P.y - sc.OZ], rpx: hp ? clamp(17 * hp[3], 14, 120) : 0 } };
    D3.renderer.render(sc, view, act, lights, env, g.t);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(D3.renderer.cv, 0, 0);
    ctx.restore();
    // 2D: varlıkların ek çizimleri, mermiler (gövde hizasında), parçacıklar; perspektif görüntüye izdüşürülür ve
    // uzaklıkla büyüyüp küçülür
    const AR = [P.x - 900, P.y - 900, P.x + 900, P.y + 900];
    ctx.save();
    ctx.translate(-x0, -y0);
    RP.begin(ctx, true);
    try {
      rec.replay(RP.ctx, (e) => { RP.st.base = e ? [e.x - x0, e.y - y0, 6] : null; });
      RP.st.base = null;
      RP.ctx.globalAlpha = 1; RP.ctx.globalCompositeOperation = 'source-over';
      RP.st.h = 10;
      g.drawProjs(RP.ctx);
      RP.st.h = 0;
      g.parts.draw(RP.ctx, AR[0], AR[1], AR[2], AR[3]);
    } finally { RP.end(); }
    ctx.restore();
    // oyunun üst katmanı: arayüz, hava (2D ışık, parıltı, teller ve yer bulut gölgeleri 3B'de: gök ve sis). Dünyaya
    // bağlı çizimler yeniden izdüşüren bağlamla, nişangâh ve işaretler dayanak noktasıyla; ekran efektleri olduğu gibi
    FX.glTint = true;
    const swaps = [];
    const swap = (obj, k, fn) => { swaps.push([obj, k, obj[k]]); obj[k] = fn; };
    const viaRP = (orig, o) => function (c, ...a) { RP.begin(c, true, o.h || 0); try { return orig.call(this, RP.ctx, ...(o.area ? AR : a)); } finally { RP.end(); } };
    swap(g, 'drawWires', () => {});
    swap(FX, 'drawHigh', viaRP(FX.drawHigh, { h: 4 }));
    swap(Juice, 'drawHigh', viaRP(Juice.drawHigh, { area: true }));
    swap(g, 'drawBirds', viaRP(g.drawBirds, { h: 70 }));
    swap(g, 'drawFlies', viaRP(g.drawFlies, { h: 8 }));
    swap(FX, 'drawClouds', () => {});
    swap(g, 'drawWorldUI', function (c, dt2) { worldUI(this, c, dt2); });
    swap(Juice, 'drawGlow', () => {});
    try { g.renderTail(ctx, dt, x0, y0, x1, y1, [], false); } finally { for (let i = swaps.length - 1; i >= 0; i--) { const [o, k, f] = swaps[i]; o[k] = f; } }
    S.frames++;
    sweepMeshes();
    S.ms = S.ms * 0.9 + (performance.now() - t0) * 0.1;
  }

  /* ---------------- fareyle bakış ----------------
     Fare kendiliğinden kamerayı yönetir: 3B oyun sürerken basılan bir tuş ya da tıklama fareyi kilitler (tarayıcı kilidi
     yalnızca kullanıcı hareketiyle verir; tuş ve tıklama oyuna da gider, kilit bir sonraki karede istenir: o tuş bir
     pencere açtıysa istenmez). Esc kilidi bırakır; menü, harita ya da konuşma açılınca bırakılır, kapanınca geri gelir.
     Silah çarkı açıkken fare çarka gider (ortadan başlayan sanal imleç); dürbün kameranın baktığı yere bakar. */
  const TAU2 = Math.PI * 2;
  const playing = () => typeof G !== 'undefined' && G.state === 'play' && S.on && S.ok && !!S.area && !(UI.isModal && UI.isModal());
  const locked = () => !!G.canvas && document.pointerLockElement === G.canvas;
  function lookBy(dx, dy) {
    const k = LOOK * sensMul();
    S.yaw = angWrap(S.yaw - dx * k);
    S.pitch = clamp(S.pitch + dy * k, P_MIN, P_MAX);
    S.lastLook = performance.now();
  }
  function lockNow() {
    S.lockReqT = performance.now();
    try { const r = G.canvas.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (e) {}
  }
  function vcStart() { S.vc = [innerWidth / 2, innerHeight / 2]; Input.mouse.x = S.vc[0]; Input.mouse.y = S.vc[1]; }
  window.addEventListener('keydown', (ev) => { if (!locked() && ev.code !== 'Escape' && ev.code !== 'F3' && !ev.repeat) S.wantLock = performance.now(); }, true);
  window.addEventListener('mousedown', (ev) => { if (!locked() && ev.target === G.canvas) S.wantLock = performance.now(); }, true);
  window.addEventListener('mousemove', (ev) => {
    if (!locked()) return;
    // imleç kilitliyken oyunun fare konumu (değişmeyen clientX) yazılmasın
    ev.stopPropagation();
    const dx = ev.movementX || 0, dy = ev.movementY || 0;
    if (Math.abs(dx) > 400 || Math.abs(dy) > 400) return;   // bazı sistemlerde kilit anında görülen sıçrama
    Input.device = 'kb';
    if (G.wheelOpen) {
      Input.mouse.moved = true;
      if (!S.vc) vcStart();
      S.vc[0] = clamp(S.vc[0] + dx, 0, innerWidth); S.vc[1] = clamp(S.vc[1] + dy, 0, innerHeight);
      Input.mouse.x = S.vc[0]; Input.mouse.y = S.vc[1];
    } else {
      S.vc = null;
      if (playing()) lookBy(dx, dy);
    }
  }, true);
  document.addEventListener('pointerlockchange', () => {
    const was = S.look;
    S.look = locked();
    if (S.look) { S.relock = false; S.wantLock = 0; }
    else if (was) S.lostN = 1;   // Esc: oyun birkaç kare içinde duraklat menüsünü açarsa menü kapanınca kilit geri gelir
    S.vc = null;
    badge();
  });
  document.addEventListener('pointerlockerror', () => { S.look = false; S.relock = false; badge(); });
  if (typeof UI.openWheel === 'function') {
    const openWheel = UI.openWheel;
    UI.openWheel = function (...a) { if (locked()) vcStart(); return openWheel.apply(this, a); };
  }
  // dürbün: görüş daralır (kamera), bakılan yer kameranın ortasından giden ışının yere değdiği nokta
  if (typeof G.binocUpdate === 'function') {
    const binocUpdate = G.binocUpdate;
    G.binocUpdate = function (dt) {
      const r = binocUpdate.call(this, dt);
      const B = this.binoc;
      if (B && on3D()) {
        const K = S.cam, P = this.player, RB = typeof BINOC_R !== 'undefined' ? BINOC_R : 600;
        const q = s2w(K.vw / 2, K.vh / 2, 0);
        let ox = q ? q[0] - P.x : K.f2[0] * RB, oy = q ? q[1] - P.y : K.f2[1] * RB;
        const d = Math.hypot(ox, oy);
        if (d > RB) { ox *= RB / d; oy *= RB / d; }
        B.x = ox; B.y = oy; B.mouse = false;
        P.ang = Math.atan2(oy, ox) || P.ang;
      }
      return r;
    };
  }

  /* yürüyüş kameraya göre: W ekranda yukarı, yani kameranın baktığı yön (atta ve arabada sürüş zaten atın yönüne göre) */
  const rotVec = (v, a) => { const c = Math.cos(a), s = Math.sin(a); return Object.assign({}, v, { x: v.x * c - v.y * s, y: v.x * s + v.y * c }); };
  const updFoot = Player.prototype.updateFoot;
  Player.prototype.updateFoot = function (dt, mv, ...a) {
    if (on3D() && this === G.player && mv && mv.m > 0) mv = rotVec(mv, -S.yaw);
    return updFoot.call(this, dt, mv, ...a);
  };
  /* nişan: fare kilitliyken ekranın ortasından, değilken imleçten giden ışın. Işın bir canlıya değerse nişan onadır;
     değmezse gövde hizasındaki düzleme değdiği yere (aşağı bakınca yakına, ufka bakınca uzağa; uzaklığı oyun silahın
     menziliyle sınırlar); göğe bakıyorsa baktığı yönde silahın menzili kadar öteye. Oyunun hesabına bu noktanın düz 2D konumu verilir. Kolun sağ çubuğu da kameraya
     göre döner. */
  const updAim = Player.prototype.updateAim;
  Player.prototype.updateAim = function (dt, mv) {
    if (!on3D() || this !== G.player || !S.cam.ok) return updAim.call(this, dt, mv);
    const I = Input, m = I.mouse, ox = m.x, oy = m.y, av = I.aimVec, K = S.cam;
    const r = G.canvasRect(), k = r.width / G.vw;
    const sx = S.look ? K.vw / 2 : (ox - r.left) / k, sy = S.look ? K.vh / 2 : (oy - r.top) / k;
    const range = (this.W && this.W.range) || 200, e = rayEnt(G, sx, sy);
    let wx, wy;
    if (e) { wx = e.x; wy = e.y; }
    else {
      // yere değdiği nokta (uzaklığı oyun silahın menziliyle sınırlar); ışın göğe bakıyorsa baktığı yönde menzil kadar
      const q = s2w(sx, sy, AIM_H);
      if (q) { wx = q[0]; wy = q[1]; }
      else { const d = rayOf(sx, sy), l = Math.hypot(d[0], d[2]) || 1; wx = this.x + d[0] / l * range; wy = this.y + d[2] / l * range; }
    }
    S.aimEnt = e;
    m.x = r.left + (wx - G.cam.ox) * k; m.y = r.top + (wy - G.cam.oy) * k;
    I.aimVec = function () { return rotVec(av.call(this), -S.yaw); };
    try { return updAim.call(this, dt, mv); } finally { m.x = ox; m.y = oy; I.aimVec = av; }
  };

  /* dünya arayüzü (G.drawWorldUI'nin 3B hâli): fare kilitliyken nişangâh ekranın ortasında (nişan alırken oyunun
     dağılım çizgileriyle, değilken küçük nokta; ışın bir canlıya değiyorsa kırmızı); kilit yokken nişan noktasının
     görüntüdeki yerinde. Etkileşim ve hikâye işaretleri hedefin başının üstünde, ekranda sabit boyda; yapı önizlemesi
     zemindeki dikdörtgen. */
  function worldUI(g, c, dt) {
    const P = g.player, x0 = g.cam.ox, y0 = g.cam.oy, K = S.cam;
    if (!K.ok) return;
    const headH = (e) => (e && (e.kind === 'npc' || e.kind === 'horse' || e.kind === 'animal') ? 30 : 12);
    const aimNow = P.aiming || P.rsAim, play = g.state === 'play' && !UI.isModal();
    const spreadPx = (d) => {
      if (!(P.W && P.W.spread)) return 3;
      const sp = P.W.spread * d * (P.deadeye ? 0.2 : 1) * (P.aiming ? 1 : 1.7) * (1 - 0.45 * clamp((P.aimSteady || 0) / 0.7, 0, 1)) + 2;
      const q = w2s(P.x + Math.cos(P.aimAng) * d, P.y + Math.sin(P.aimAng) * d, AIM_H);
      return clamp(sp * (q ? q[3] : 1), 3, 60);
    };
    RP.begin(c, false);
    const X = RP.ctx, base = (x, y, h) => { RP.st.base = x === null ? null : [x - x0, y - y0, h || 0]; };
    try {
      const it = UI.curInteract;
      if (it && !it.riding) {
        const bb = Math.sin(g.t * 5) * 1.5;
        base(it.x, it.y, headH(it));
        X.fillStyle = 'rgba(255,255,255,0.9)';
        X.beginPath(); X.moveTo(it.x - 3, it.y - 8 + bb); X.lineTo(it.x + 3, it.y - 8 + bb); X.lineTo(it.x, it.y - 4 + bb); X.fill();
        base(null);
      }
      const L = P.lockTarget;
      let enemy = false;
      if (L && !L.dead && aimNow) {
        const hostile = P.targetClass(L) >= 2.5, q = w2s(L.x, L.y, 14), r = ((L.r || 4) + 4) * (q ? Math.min(q[3], 4) : 1) + Math.sin(g.t * 8) * 0.6;
        base(L.x, L.y, 14);
        X.fillStyle = hostile ? '#ff4a3a' : 'rgba(255,255,255,0.95)';
        for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { X.fillRect(L.x + sx * r - (sx > 0 ? 2 : 0), L.y + sy * r - (sy > 0 ? 0.6 : 0), 2.6, 0.9); X.fillRect(L.x + sx * r - (sx > 0 ? 0.6 : 0), L.y + sy * r - (sy > 0 ? 2 : 0), 0.9, 2.6); }
        enemy = hostile;
        base(null);
      }
      if (S.look && play) {
        // ekranın ortası (oyunun dönüşümünden bağımsız, düz ekran pikseli)
        const ae = S.aimEnt;
        if (ae && !ae.dead && P.targetClass(ae) >= 1.5) enemy = true;
        c.save(); c.setTransform(1, 0, 0, 1, 0, 0);
        const cx = Math.floor(K.vw / 2), cy = Math.floor(K.vh / 2), col = P.deadeye ? '#e03020' : enemy ? '#ff5040' : 'rgba(255,248,230,0.92)';
        if (aimNow && P.isArmed) {
          const sp = Math.round(spreadPx(P.aimDist));
          c.fillStyle = 'rgba(20,12,8,0.5)';
          c.fillRect(cx - sp - 3, cy - 1, 4, 3); c.fillRect(cx + sp - 1, cy - 1, 4, 3); c.fillRect(cx - 1, cy - sp - 3, 3, 4); c.fillRect(cx - 1, cy + sp - 1, 3, 4);
          c.fillStyle = col;
          c.fillRect(cx, cy, 1, 1);
          c.fillRect(cx - sp - 2, cy, 2, 1); c.fillRect(cx + sp, cy, 2, 1); c.fillRect(cx, cy - sp - 2, 1, 2); c.fillRect(cx, cy + sp, 1, 2);
        } else {
          c.fillStyle = 'rgba(20,12,8,0.5)'; c.fillRect(cx - 1, cy - 1, 3, 3);
          c.fillStyle = col; c.fillRect(cx, cy, 1, 1);
        }
        c.restore();
        if (aimNow && P.weapon === 'dynamite') {
          const rx = P.x + Math.cos(P.aimAng) * P.aimDist, ry = P.y + Math.sin(P.aimAng) * P.aimDist;
          X.strokeStyle = 'rgba(255,200,100,0.6)'; X.beginPath(); for (let k = 0; k <= 24; k++) { const a = k / 24 * TAU2; X[k ? 'lineTo' : 'moveTo'](rx + Math.cos(a) * 20, ry + Math.sin(a) * 20); } X.stroke();
        }
      } else if (aimNow || (Input.device === 'kb' && P.isArmed && play)) {
        const d = aimNow ? P.aimDist : Math.min(P.aimDist, 60);
        const rx = P.x + Math.cos(P.aimAng) * d, ry = P.y + Math.sin(P.aimAng) * d;
        for (const e of g.ents) if (!e.dead && (e.kind === 'animal' || e.kind === 'npc') && (e.x - rx) ** 2 + (e.y - ry) ** 2 < 64) { enemy = true; break; }
        base(rx, ry, AIM_H);
        X.fillStyle = P.deadeye ? '#e03020' : enemy ? '#ff5040' : 'rgba(255,255,255,0.9)';
        if (aimNow) {
          const sp = spreadPx(d);
          X.fillRect(rx - 0.5, ry - 0.5, 1, 1);
          X.fillRect(rx - sp - 2, ry - 0.5, 2, 1); X.fillRect(rx + sp, ry - 0.5, 2, 1);
          X.fillRect(rx - 0.5, ry - sp - 2, 1, 2); X.fillRect(rx - 0.5, ry + sp, 1, 2);
        } else { X.globalAlpha = 0.5; X.fillRect(rx - 0.5, ry - 0.5, 1, 1); X.globalAlpha = 1; }
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
      if (qm && !g.storyTalking() && w2s(qm.x, qm.y, 30)) {
        const bb = Math.sin(g.t * 4) * 1.5, y = qm.y - 6 + bb;
        base(qm.x, qm.y, qm.kind ? 34 : 14);
        X.fillStyle = 'rgba(0,0,0,0.5)'; X.beginPath(); X.moveTo(qm.x, y - 5); X.lineTo(qm.x + 4.5, y); X.lineTo(qm.x, y + 5); X.lineTo(qm.x - 4.5, y); X.fill();
        X.fillStyle = '#f0c040'; X.beginPath(); X.moveTo(qm.x, y - 4); X.lineTo(qm.x + 3.5, y); X.lineTo(qm.x, y + 4); X.lineTo(qm.x - 3.5, y); X.fill();
        base(null);
      }
      const wp = g.waypoint;
      if (wp && w2s(wp.x, wp.y, 0)) {
        base(wp.x, wp.y, 0);
        X.fillStyle = '#e8c860'; X.beginPath(); X.moveTo(wp.x, wp.y); X.lineTo(wp.x - 4, wp.y - 8); X.lineTo(wp.x + 4, wp.y - 8); X.fill();
        base(null);
      }
    } finally { RP.end(); }
  }

  /* DOM işaretleri (etkileşim belirteci, fark edilme işareti, konuşma balonu): modül konumunu düz 2D'ye göre yazar;
     3B'de her işaret, bağlı olduğu varlığın ayak noktasının görüntüdeki yerine kaydırılır (başın üstündeki pay korunur).
     Modül bir karede konumu yeniden yazmadıysa son kaydırma tekrar uygulanmaz. */
  // h: dayanak yüksekliği (canlıda baş hizası); kameranın arkasındaki işaret ekran dışına atılır
  function shiftEl(el, bx, by, h) {
    if (!el) return;
    const cur = el.style.transform;
    const orig = el._d3 && cur === el._d3.out ? el._d3.orig : cur;
    const m = /translate\(([-\d.]+)px, ([-\d.]+)px\)/.exec(orig);
    if (!m) return;
    const r = G.canvasRect(), k = r.width / G.vw, fx = bx - G.cam.ox, fy = by - G.cam.oy;
    const q = w2s(bx, by, h || 0);
    const out = q ? orig.replace(m[0], `translate(${(+m[1] + (q[0] - fx) * k).toFixed(1)}px, ${(+m[2] + (q[1] - fy) * k).toFixed(1)}px)`) : orig.replace(m[0], 'translate(-9999px, -9999px)');
    el._d3 = { orig, out };
    if (cur !== out) el.style.transform = out;
  }
  const after = (obj, k, fn) => { if (!obj || typeof obj[k] !== 'function') return; const o = obj[k]; obj[k] = function (...a) { const r = o.apply(this, a); try { if (on3D()) fn.call(this); } catch (e) {} return r; }; };
  if (typeof InteractMarks !== 'undefined') after(InteractMarks, 'update', function () {
    for (const sm of this.st.values()) {
      if (!sm.el) continue;
      const kk = sm.c && sm.c.key;
      const [bx, by, h] = kk && kk.kind ? [kk.x, kk.y, kk.kind === 'npc' || kk.kind === 'horse' || kk.kind === 'animal' ? 30 : 12] : kk && kk.door ? [kk.door.x, kk.door.y, 20] : [sm.c.x, sm.c.y, 12];
      shiftEl(sm.el, bx, by, h);
    }
  });
  if (typeof AwareMarks !== 'undefined') after(AwareMarks, 'update', function () { for (const [e, mk] of this.map) shiftEl(mk.el, e.x, e.y, 30); });
  if (typeof Bubbles !== 'undefined') after(Bubbles, 'update', function () { for (const bl of this.list) shiftEl(bl.el, bl.e.x, bl.e.y, 30); });
  // ekran kenarı okları: hedef noktaları kısa süre 3B görüntüdeki yerlerine (düz 2D karşılığına) konur, ok o yöne bakar;
  // ekran dışındaki ya da kameranın arkasındaki hedef, kameraya göre yönünde ekranın çok dışına konur
  if (typeof Nav !== 'undefined' && typeof Nav.edge === 'function') {
    const edge = Nav.edge;
    Nav.edge = function (...a) {
      if (!on3D()) return edge.apply(this, a);
      const keep = [];
      const K = S.cam;
      const put = (o, kx, ky) => {
        if (!o || o[kx] === undefined || o[kx] === null) return;
        keep.push([o, kx, ky, o[kx], o[ky]]);
        const tx = o[kx], ty = o[ky], q = w2s(tx, ty, 0);
        let vx, vy;
        if (q && q[0] >= 0 && q[0] <= K.vw && q[1] >= 0 && q[1] <= K.vh) { vx = q[0]; vy = q[1]; }
        else {
          const dx = tx - K.E[0], dz = ty - K.E[2], rx = dx * K.r2[0] + dz * K.r2[1], fz = dx * K.f2[0] + dz * K.f2[1], l = Math.hypot(rx, fz) || 1;
          vx = K.vw / 2 + rx / l * (K.vw + K.vh); vy = K.vh / 2 - fz / l * (K.vw + K.vh);
        }
        o[kx] = G.cam.ox + vx; o[ky] = G.cam.oy + vy;
      };
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
    const cam = S.look ? T_('Fare: kamera  ·  Esc: imleç', 'Mouse: camera  ·  Esc: cursor') : T_('Fareyle kamera: bir tuşa bas ya da tıkla', 'Mouse camera: press a key or click');
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
    if (S.lostN && ++S.lostN > 4) S.lostN = 0;
    const want = G.state === 'play' ? '' : 'none';
    if (!badgeEl || badgeEl.style.display !== want || badgeEl._on !== (S.on && S.ok) || badgeEl._look !== S.look) { badge(); badgeEl._on = S.on && S.ok; badgeEl._look = S.look; }
    return r;
  };

  Object.assign(D3, { w2s, s2w, lookBy, sensMul, P_MIN, P_MAX, AIM_H, CAM });

  /* ayarlar: Kontroller sekmesindeki "Fare Hassasiyeti (3B Kamera)" kaydırıcısı paket betiğinde (tools/build-demo3d.js)
     paketteki js/ui.js kopyasına eklenir (sayfanın güvenlik politikası çalışma anında kod kurmaya izin vermez). Değer
     G.settings.d3Sens: %0-100, %50 = 1×. */

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
