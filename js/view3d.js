'use strict';
/* =====================================================================
   FRONTIER'S END — 3B ÇİZİM (Ayarlar > Grafik > Çizim Yöntemi: 3B)

   Oyunun dünyası WebGL2 ile 3B çizilir: js/gl3d.js çizici (G-tamponu, güneş gölgesi, oyunun 5 tonu, seçici
   dış hat), js/models3d.js insan, at, hayvan ve nesne modelleri, js/scene3d.js dünyadan sahne parçaları. Bu
   dosya oyunun birkaç fonksiyonunu sarar; 3B seçili değilse hepsi oyunun kendi yolunu izler.
     - Gerçek dik (ortografik) kamera; fare kendiliğinden bakış yönüdür: sağa-sola kamerayı oyuncunun çevresinde
       döndürür, ileri-geri nişanı oyuncunun önünden ekranın tepesine kadar taşır (nişan uzaklaşınca kamera öne
       kayar). İlk tuş ya da tıklama fareyi kilitler, Esc duraklat menüsünü açar; 3B oyunda imleç görünmez
     - Sahne akışlıdır: kameranın çevresindeki binalar, nesne blokları ve ray parçaları kare başına süre
       bütçesiyle kurulur, uzaklaşanlar atılır; zemin dokusu penceresi kamerayla kayar; dünya değişince (inşaat,
       gelişen kasaba, tahta perde) ilgili parça yeniden kurulur
     - Canlılar oyunun kendi çizim çağrılarından 3B modellere aktarılır; oyunun 2D çizimleri (mermi, parçacık,
       nişangâh, işaretler) 3B görüntüye yeniden izdüşürülür; duman, kuş, bayrak gibi efektler yükseklikleriyle
     - Yürüyüş ve kolun sağ çubuğu kameraya göre; radar kamerayla döner (js/ui.js, D3.radarRot)
   ===================================================================== */
(() => {
  const { M4, C, Renderer, GPUMesh, Mesh, LineMesh, MAT, F, buildHuman, buildHorse, buildAnimal, animalSkel, animalPose, skelPose, HUMAN_SK, HORSE_SK, POSE, HPOSE, armPose, P3 } = D3;
  const DEG = Math.PI / 180;
  const PITCH = 38 * DEG;        // kamera eğimi (yerden yükseklik açısı)
  const LOOK_YAW = 0.0032;       // fare pikseli başına dönüş (radyan; hassasiyet ayarı ortadayken)
  const AIM_K = 0.9;             // fare pikseli başına nişan uzaklığı (birim)
  const AIM_MIN = 16, AIM_DEF = 110;   // nişan: oyuncudan en az uzaklık, açılıştaki uzaklık; en çok: ekranın tepesi
  const AHEAD = 0.13;            // oyuncu ekran merkezinin bu kadar (görüntü yüksekliği oranı) altında: önde daha çok yer
  const AIM_TOP = 0.12, P_LOW = 0.86;  // nişan ekranın tepesinden bu paydan yukarı çıkmaz; oyuncu bu çizgiden aşağı inmez
  const AIM_H = 11;              // nişan ve imleç bu yükseklikteki düzleme bakar (gövde hizası)
  const S = D3.state = { ok: true, scene: null, err: null, cap: [], pool: [], meshes: new Map(), skels: new Map(), ms: 0, frames: 0,
    yaw: 0, pitch: PITCH, aim: AIM_DEF, look: false, relock: false, vc: null, ahead: 1, la: null, wantLock: 0,
    cam: { c: 1, s: 0, st: Math.sin(PITCH), ct: Math.cos(PITCH), u: 0, w: 0, cx: 0, cy: 0, ox: 0, oy: 0, vw: 1, vh: 1, la: 0, ok: false } };
  // fare hassasiyeti (Ayarlar > Kontroller): 0..1, ortası 1×; çarpan 0,25× .. 4×
  const sensMul = () => { const v = +G.settings.d3Sens; return Math.pow(2, ((v >= 0 && v <= 1 ? v : 0.5) - 0.5) * 4); };
  // 3B seçili ve çizici çalışıyor; on3D: 3B kamera kuruldu (yürüyüş, nişan ve 2D katmanlar onun izdüşümüne göre)
  const want3D = () => G.settings.gfx === 2 && S.ok;
  const on3D = () => want3D() && S.cam.ok;
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const lerp = (a, b, t) => a + (b - a) * t;
  const mix3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

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
        // otomobil: gövdesi 3B; sürücü (2D'de tentenin altında gizli) ön koltukta oturur; oyuncu nişan alırken 2D çizim onu zaten verdi
        if (e.kind === 'wagon' && e.motor && e.bx !== undefined) {
          S.cap.push({ k: 'car', M: null, x: e.bx, y: e.by, ang: e.bang, col: e.body || '#16161a' });
          const st = e.seat, aimP = e.rider === P && (P.aiming || P.rsAim);
          const L = e.rider === P ? P.lookNow() : e.driver && e.driver.look;
          if (L && !aimP && !(e.rider === P && P.mountAnim)) S.cap.push({ k: 'h', M: null, x: st.x, y: st.y, ang: e.bang, look: L, st: { riding: true, car: true }, e });
        }
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
        else if (st.riding && (st.car || (c.e && c.e.motor))) { pose = POSE.sit(t, ph, 'table'); y = 2.4; }   // otomobilde koltukta, eller direksiyonda
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
      } else if (c.k === 'car') {
        const mesh = meshFor('car|' + c.col, () => { const m = new Mesh(6000); P3.car(m, c.col); return m; });
        const B = bones(); B.set(M4.mul(M4.translate(X, 0, Z), M4.rotY(-ang)), 0); next();
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
    // saloon kapısının yarım kanatları: içinden geçen itince sallanır (salınım oyunun kuralıyla, b.swing)
    for (const part of sc.bparts.values()) {
      const sw = part.swing;
      if (!sw || part.cut || !near(sw[0], sw[1], 20)) continue;
      const a = (part.b.swing && part.b.swing.a) || 0, w = sw[2];
      const mesh = meshFor('batwing|' + w, () => { const m = new Mesh(160); P3.batwing(m, w); return m; });
      for (const sg of [-1, 1]) {
        const B = bones(); B.set(M4.mul(M4.translate(sw[0] + sg * w - sc.OX, 0, sw[1] - sc.OZ), M4.rotY(sg < 0 ? -a : Math.PI + a)), 0); next();
        out.push({ mesh, bones: B });
      }
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

  /* ---------------- akışlı sahne ----------------
     Dünya 3072×3072 karo: sahne yalnızca kameranın çevresinde kurulur. Dünya 32×32 karoluk parçalara bölünür;
     görünen alanın (ve gölge payının) değdiği her parça için işler planlanır: parçadaki her bina (merkezine göre),
     16×16 karoluk nesne blokları ve parçanın ray dilimi. İşler kameraya yakından uzağa, karede birkaç
     milisaniyelik bütçeyle kurulur; görünen alanda hiç hazır iş yoksa (yeni oyun, kayıt, ışınlanma) bütçe büyür,
     dünya boş görünmez. Uzaklaşan parçaların işleri atılır. Zemin, kamerayı ortalayan 256×256 karoluk bir
     dokudan okunur; kamera 64 karo kayınca ya da zemin değişince doku yeniden kurulur. Dünya değişince
     (World.invalidateChunkAt, World.buildingDirty: inşaat, yıkım, gelişen kasaba, tahta perde) ilgili iş yeniden
     kurulur; yenisi hazır olana dek eskisi çizilir. Koordinatlar dünya pikseli (sahne kökü 0). */
  const CH = 32, BLK = 16, TWIN = 256, TSHIFT = 64;
  const SC = { world: null, jobs: new Map(), planned: new Map(), byChunk: null, nB: -1, terr: null, terrT: 0, terrStale: false, pal: null, dirty: new Map(), list: null, scene: null, stats: { built: 0, ms: 0 } };
  const ckey = (cx, cy) => cy * 4096 + cx;
  function dropJob(j) {
    if (j.part) j.part.mesh.dispose();
    if (j.mesh) j.mesh.dispose();
    j.part = j.mesh = null; j.ready = false;
  }
  function streamReset() {
    for (const j of SC.jobs.values()) dropJob(j);
    SC.jobs.clear(); SC.planned.clear(); SC.dirty.clear();
    SC.byChunk = null; SC.nB = -1; SC.list = null;
    if (SC.terr) { SC.terr.mesh.dispose(); D3.renderer.gl.deleteTexture(SC.terr.tex); SC.terr = null; }
    if (SC.wires) { SC.wires.dispose(); SC.wires = null; }
    SC.wireSig = null;
    SC.world = null;
  }
  function indexWorld(W) {
    const by = new Map();
    for (const b of W.buildings) { const k = ckey(Math.floor((b.x + b.w / 2) / CH), Math.floor((b.y + b.h / 2) / CH)); let a = by.get(k); if (!a) by.set(k, a = []); a.push(b); }
    SC.byChunk = by; SC.nB = W.buildings.length;
  }
  function addJob(key, kind, x, y, extra, ck) {
    if (SC.jobs.has(key)) return;
    SC.jobs.set(key, Object.assign({ key, kind, x, y, ck, ready: false, stale: false, part: null, mesh: null }, extra));
    SC.planned.get(ck).push(key);
    SC.list = null;
  }
  function plan(W, cx, cy) {
    const ck = ckey(cx, cy);
    if (SC.planned.has(ck)) return;
    SC.planned.set(ck, []);
    const x0 = cx * CH, y0 = cy * CH;
    for (const b of SC.byChunk.get(ck) || []) addJob('b' + b.id, 'b', (b.x + b.w / 2) * 16, (b.y + b.h / 2) * 16, { b }, ck);
    for (let by = 0; by < CH; by += BLK) for (let bx = 0; bx < CH; bx += BLK) addJob('o' + (x0 + bx) + ',' + (y0 + by), 'o', (x0 + bx + BLK / 2) * 16, (y0 + by + BLK / 2) * 16, { tx: x0 + bx, ty: y0 + by }, ck);
    if (W.rails && W.rails.length) addJob('r' + ck, 'r', (x0 + CH / 2) * 16, (y0 + CH / 2) * 16, { px: x0 * 16, py: y0 * 16 }, ck);
  }
  function unplan(ck) {
    for (const key of SC.planned.get(ck) || []) { const j = SC.jobs.get(key); if (j) { dropJob(j); SC.jobs.delete(key); } }
    SC.planned.delete(ck); SC.list = null;
  }
  function buildJob(gl, W, j) {
    const op = j.part, om = j.mesh;
    if (j.kind === 'b') j.part = D3.buildingPart(gl, W, j.b);
    else if (j.kind === 'o') {
      const r = D3.objectsPart(gl, W, j.tx, j.ty, j.tx + BLK, j.ty + BLK);
      j.mesh = r.mesh; j.fires = r.fires; j.leafy = r.leafy; j.herbs = r.herbs; j.arts = r.arts; j.steam = r.steam; j.regrow = r.regrow;
    }
    else j.mesh = D3.railsPart(gl, W, j.px, j.py, j.px + CH * 16, j.py + CH * 16);
    if (op && op !== j.part) op.mesh.dispose();
    if (om && om !== j.mesh) om.dispose();
    j.ready = true; j.stale = false; SC.list = null; SC.stats.built++;
  }
  // dünya değişti: değişen yerin nesne bloğu, ray parçası ve (içine değiyorsa) binası yeniden kurulur, zemin dokusu yenilenir
  if (typeof World !== 'undefined') {
    const inv = World.prototype.invalidateChunkAt;
    World.prototype.invalidateChunkAt = function (px, py, keepCover) {
      if (this === SC.world) { const k = Math.floor(px / 256) + ',' + Math.floor(py / 256); if (!SC.dirty.has(k)) SC.dirty.set(k, [px, py, null]); }
      return inv.call(this, px, py, keepCover);
    };
    // mevsim değişti: nesneler (kışın karlı yerde otlar, çit ve süslerin karı) yeniden kurulur
    const ss = World.prototype.setSeason;
    World.prototype.setSeason = function (...a) {
      const r = ss.apply(this, a);
      if (r !== false && this === SC.world) { for (const j of SC.jobs.values()) if (j.kind === 'o') j.stale = true; SC.terrStale = true; }
      return r;
    };
    const bd = World.prototype.buildingDirty;
    World.prototype.buildingDirty = function (b) {
      if (this === SC.world) SC.dirty.set('b' + b.id, [0, 0, b]);
      return bd.call(this, b);
    };
  }
  /* elektrik telleri (elektrik gelen kasabalar, js/devworld.js: W.wires[kasaba] = direklerin dipleri): direk traversindeki
     iki yalıtkan arasında iki sarkık tel, tek piksellik çizgi. Teller az olduğu için bütün dünyanınki tek ağda; kasaba
     elektriklenince (tel listesi değişince) yeniden kurulur */
  function wiresMesh(gl, W) {
    const WS = W.wires;
    let n = 0, sig = '';
    if (WS) for (const id in WS) { n += WS[id].length; sig += id + ':' + WS[id].length + ','; }
    if (SC.wireSig === sig && SC.wireW === WS) return SC.wires;
    if (SC.wires) SC.wires.dispose();
    SC.wires = null; SC.wireSig = sig; SC.wireW = WS;
    if (!n) return null;
    const m = new LineMesh(n * 44);
    m.set({ mat: MAT.SOLID, flags: F.NOSHADOW, param: 0, wind: 0, bone: 0 });
    const col = C('#1a1611');
    for (const id in WS) for (const [ax, ay, bx, by] of WS[id]) {
      const sag = clamp(Math.hypot(bx - ax, by - ay) * 0.05, 2, 7) * 1.4;
      const da = D3.poleDir(W, Math.floor(ax / 16), Math.floor(ay / 16)), db = D3.poleDir(W, Math.floor(bx / 16), Math.floor(by / 16));
      const f = da[0] * db[0] + da[1] * db[1] < 0 ? -1 : 1;   // iki ucun traversi ters yöndeyse teller çaprazlanmasın
      for (const [s, k] of [[-1, 1], [1, 1.25]]) m.sag([ax + da[0] * 5.5 * s, 33.6, ay + da[1] * 5.5 * s], [bx + db[0] * 5.5 * s * f, 33.6, by + db[1] * 5.5 * s * f], sag * k, col, 10);
    }
    return (SC.wires = new GPUMesh(gl, m, gl.LINES));
  }
  function applyDirty() {
    for (const [px, py, b] of SC.dirty.values()) {
      if (b) { const j = SC.jobs.get('b' + b.id); if (j) j.stale = true; continue; }
      const tx = Math.floor(px / 16), ty = Math.floor(py / 16);
      const oj = SC.jobs.get('o' + Math.floor(tx / BLK) * BLK + ',' + Math.floor(ty / BLK) * BLK); if (oj) oj.stale = true;
      const ck = ckey(Math.floor(tx / CH), Math.floor(ty / CH)), rj = SC.jobs.get('r' + ck); if (rj) rj.stale = true;
      for (const bb of (SC.byChunk && SC.byChunk.get(ck)) || []) if (tx >= bb.x - 2 && tx <= bb.x + bb.w + 2 && ty >= bb.y - 3 && ty <= bb.y + bb.h + 2) { const j = SC.jobs.get('b' + bb.id); if (j) j.stale = true; }
      SC.terrStale = true;
    }
    SC.dirty.clear();
  }
  function stream(g, mx, my, VR) {
    const W = g.world, gl = D3.renderer.gl, now = performance.now();
    if (SC.world !== W) { streamReset(); SC.world = W; if (!SC.pal) SC.pal = D3.palette(); }
    // bina eklendi ya da yıkıldı: dizin yeniden kurulur, planlı parçalara yeni binaların işi eklenir
    if (!SC.byChunk || SC.nB !== W.buildings.length) {
      indexWorld(W);
      const live = new Set(W.buildings);
      for (const [key, j] of [...SC.jobs]) if (j.kind === 'b' && !live.has(j.b)) { dropJob(j); SC.jobs.delete(key); const a = SC.planned.get(j.ck); if (a) a.splice(a.indexOf(key), 1); }
      for (const ck of SC.planned.keys()) for (const b of SC.byChunk.get(ck) || []) addJob('b' + b.id, 'b', (b.x + b.w / 2) * 16, (b.y + b.h / 2) * 16, { b }, ck);
      SC.list = null;
    }
    if (SC.dirty.size) applyDirty();
    // otlar: toplanan ot hemen kaybolur (bloğu yeniden kurulur); gün dönünce yeniden yeşeren otların blokları yenilenir
    const day = g.day;
    if (SC.day !== day) { if (SC.day !== undefined) for (const j of SC.jobs.values()) if (j.regrow) j.stale = true; SC.day = day; }
    for (const j of SC.jobs.values()) {
      if (!j.herbs || !j.herbs.length || j.stale || !j.ready) continue;
      for (const h of j.herbs) { const hv = W.harvested.get(h[2]); if (hv !== undefined && hv > day) { j.stale = true; break; } }
    }
    // görünen alan (gölge ve uzun nesneler için payla) değen parçalar planlanır, uzaklaşanlar atılır
    const R = VR + 320, P = CH * 16, NC = WW / CH;
    for (let cy = Math.floor((my - R) / P); cy <= Math.floor((my + R) / P); cy++) for (let cx = Math.floor((mx - R) / P); cx <= Math.floor((mx + R) / P); cx++) {
      if (cx < 0 || cy < 0 || cx >= NC || cy >= NC) continue;
      const nx = clamp(mx, cx * P, (cx + 1) * P), ny = clamp(my, cy * P, (cy + 1) * P);
      if ((nx - mx) ** 2 + (ny - my) ** 2 <= R * R) plan(W, cx, cy);
    }
    for (const ck of [...SC.planned.keys()]) {
      const cx = ck % 4096, cy = Math.floor(ck / 4096), nx = clamp(mx, cx * P, (cx + 1) * P), ny = clamp(my, cy * P, (cy + 1) * P);
      if ((nx - mx) ** 2 + (ny - my) ** 2 > (R + 640) ** 2) unplan(ck);
    }
    // kurulacak işler: yakından uzağa; görünen alanda hazır iş yoksa (dünya boş görünür) bütçe büyük
    const pend = [];
    let visReady = false;
    for (const j of SC.jobs.values()) {
      if (!j.ready || j.stale) pend.push(j);
      else if (!visReady && inV(j.x, j.y, mx, my, VR)) visReady = true;
    }
    if (pend.length) {
      pend.sort((a, b) => ((a.x - mx) ** 2 + (a.y - my) ** 2) - ((b.x - mx) ** 2 + (b.y - my) ** 2));
      const budget = visReady ? (pend.some(j => !j.ready && inV(j.x, j.y, mx, my, VR + 120)) ? 14 : 5) : 600;
      for (const j of pend) {
        if (performance.now() - now > budget) break;
        try { buildJob(gl, W, j); } catch (e) { j.ready = true; j.stale = false; if (!S.jobErr) { S.jobErr = true; console.warn('3B: sahne parçası kurulamadı', e); } }
      }
    }
    // zemin dokusu penceresi: kamera 64 karo kayınca ya da zemin değişince (en sık yarım saniyede bir) yeniden kurulur
    const ttx = Math.floor(mx / 16), tty = Math.floor(my / 16), T0 = SC.terr;
    if (!T0 || Math.abs(ttx - (T0.rect[0] + TWIN / 2)) > TSHIFT || Math.abs(tty - (T0.rect[1] + TWIN / 2)) > TSHIFT || (SC.terrStale && now - SC.terrT > 500)) {
      SC.terr = D3.terrainPart(gl, W, ttx - TWIN / 2, tty - TWIN / 2, TWIN, TWIN);
      SC.terrT = now; SC.terrStale = false;
      if (T0) { T0.mesh.dispose(); gl.deleteTexture(T0.tex); }
    }
    if (!SC.list) {
      const parts = [], bparts = new Map(), fires = [], leafy = [], herbs = [], arts = [], steam = [];
      for (const j of SC.jobs.values()) {
        if (!j.ready) continue;
        if (j.kind === 'b') { if (j.part) { parts.push(j.part); bparts.set(j.b.id, j.part); } }
        else if (j.mesh) parts.push({ mesh: j.mesh, rails: j.kind === 'r' });
        if (j.fires) for (const f of j.fires) fires.push(f);
        if (j.leafy) for (const q of j.leafy) leafy.push(q);
        if (j.herbs) for (const q of j.herbs) herbs.push(q);
        if (j.arts) for (const q of j.arts) arts.push(q);
        if (j.steam) for (const q of j.steam) steam.push(q);
      }
      SC.list = { parts, bparts, fires, leafy, herbs, arts, steam };
    }
    SC.stats.ms = performance.now() - now; SC.stats.jobs = SC.jobs.size; SC.stats.pend = pend.length;
    const sc = SC.scene || (SC.scene = { OX: 0, OZ: 0, lines: null });
    sc.parts = [SC.terr, ...SC.list.parts, ...(D3.extraParts || [])];
    sc.bparts = SC.list.bparts; sc.fires = SC.list.fires; sc.leafy = SC.list.leafy;
    sc.herbs = SC.list.herbs; sc.arts = SC.list.arts; sc.steam = SC.list.steam;
    sc.lines = wiresMesh(gl, W);
    sc.tiles = { tex: SC.terr.tex, rect: SC.terr.rect }; sc.pal = SC.pal;
    return (S.scene = sc);
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
    // kaplıca buharı (2D'deki sıklıkla)
    for (const q of sc.steam) if (near(q[0] + 8, q[1] + 8, 60) && Math.random() < dt * 18) g.parts.add('steam', q[0] + rnd(-40, 56), q[1] + rnd(-40, 56), rnd(-4, 4), -6, 2.5, 3);
  }
  const inV = (x, y, mx, my, R) => (x - mx) ** 2 + (y - my) ** 2 < R * R;
  // kazı yerinin parıltısı (toplanana dek) ve yakındaki otun ışıltısı (2D'deki gibi; yerde, görüntüdeki yerinde)
  function marks3D(c, g, sc, mx, my, VR) {
    const W = g.world, P = g.player, t = g.t, day = g.day;
    for (const a of sc.arts) {
      if (!inV(a[0], a[1], mx, my, VR) || W.harvested.get(a[2]) !== undefined) continue;
      const q = w2s(a[0], a[1], 1.5);
      Spr.sparkle(c, q[0], q[1], t + (a[2] % WW));
    }
    for (const h of sc.herbs) {
      if ((h[0] - P.x) ** 2 + (h[1] - P.y) ** 2 > 3600) continue;
      const hv = W.harvested.get(h[2]);
      if (hv !== undefined && hv > day) continue;
      const q = w2s(h[0], h[1], 0), r = 7 + Math.sin(t * 4);
      c.fillStyle = 'rgba(255,240,180,0.25)'; c.beginPath(); c.ellipse(q[0], q[1], r, r * S.cam.st, 0, 0, TAU2); c.fill();
    }
  }
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
  // ok (gövde hizasında uçar) ve atılan dinamit (havada yay çizer, gölgesi yerde)
  function projs3D(c, g) {
    for (const p of g.projs) {
      if (p.type === 'arrow') {
        const a = w2s(p.x, p.y, 10), b = w2s(p.x - Math.cos(p.ang) * 7, p.y - Math.sin(p.ang) * 7, 10);
        c.strokeStyle = '#6a4a2a'; c.lineWidth = 1; c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke();
        c.fillStyle = '#e8e0d0'; c.fillRect(b[0] - 1, b[1] - 1, 2, 2);
      } else if (p.type === 'dynamite') {
        const sh = w2s(p.x, p.y, 0), q = w2s(p.x, p.y, (p.z || 0) + 3);
        c.fillStyle = 'rgba(0,0,0,0.3)'; c.beginPath(); c.ellipse(sh[0], sh[1], 3, 3 * S.cam.st, 0, 0, TAU2); c.fill();
        c.save(); c.translate(q[0], q[1]); c.rotate(p.t * 12); c.fillStyle = '#b02a20'; c.fillRect(-3, -1, 6, 2.4); c.restore();
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
  /* 3B açılamadı (WebGL2 yok, tarayıcı ekran kartı yerine yazılımla çiziyor, bağlam koptu ya da çizim hatası): ayar
     Melez'e döner (o da açılamıyorsa oyun Klasik çizer), kaydedilir ve bildirilir. 3B yeniden seçilirse yine bildirilir. */
  function fallback(g, e) {
    console.warn('3B çizim açılamadı', e);
    S.ok = false; S.soft = !!(e && e.soft); S.err = String((e && e.message) || e);
    g.settings.gfx = 0;
    try { g.saveSettings(); } catch (x) {}
    const hy = g.hybridOn();
    try { UI.toast(Tr('3B çizim kapatıldı'), hy ? Tr('Ekran kartı 3B çizimi desteklemiyor; oyun Melez çizimle sürüyor.') : Tr('Ekran kartı 3B çizimi desteklemiyor; oyun Klasik çizimle sürüyor.'), 'warn'); } catch (x) {}
    g.resize();
  }
  const render = G.render;
  G.render = function (dt) {
    if (this.settings.gfx === 2 && !S.ok) {
      if (S.soft && window.__d3Soft) { S.ok = true; S.soft = false; }   // testler yazılım çizimini sonradan açtı
      else fallback(this, S.err || '3B çizim yok');
    }
    if (!want3D() || !this.world || !this.player) return render.call(this, dt);
    try {
      if (!D3.renderer) {
        D3.renderer = new Renderer();
        D3.renderer.cv.addEventListener('webglcontextlost', (e) => { e.preventDefault(); S.lost = true; });
      }
      if (S.lost) throw new Error('3B bağlamı koptu');
      draw(this, dt);
      if (this.binoc) this.binocDraw();
    } catch (e) {
      fallback(this, e);
      return render.call(this, dt);
    }
  };
  function draw(g, dt) {
    const t0 = performance.now();
    const ctx = g.ctx, P = g.player, Cm = g.cam, vw = g.vw, vh = g.vh;
    const x0 = Cm.ox, y0 = Cm.oy, x1 = x0 + vw, y1 = y0 + vh;
    const lw = g.canvas.width, lh = g.canvas.height, ds = lw / vw;
    S.x0 = x0; S.y0 = y0;
    // yeni dünya (yeni oyun, kayıt): sahne baştan kurulur; oyuna girişte fare kilidi bir kez kendiliğinden denenir
    if (S.world !== g.world) { S.world = g.world; S.autoTried = false; S.la = null; }
    camFrame(g);
    const K = S.cam;
    HY.beat();
    FX.beginFrame();
    // görünen alan: dönmüş ve derinliği uzamış zemin dikdörtgenini (ve kameraya yakın uzun canlıları) kapsayan çember
    const vis = [], mx = K.cx, my = K.cy, VR = Math.hypot(vw, vh / K.st) / 2 + 70;
    const sc = stream(g, mx, my, VR);
    const near = (e) => Math.abs(e.x - mx) < VR && Math.abs(e.y - my) < VR && (e.x - mx) ** 2 + (e.y - my) ** 2 < VR * VR;
    for (const e of g.ents) if (near(e) && !(e.rider === P) && !g.floorHid(e) && !Juice.lowerHid(e)) vis.push(e);
    if (P.riding) vis.push(P.riding);
    vis.push(P);
    for (const gh of Juice.ghosts || []) if (near(gh)) vis.push(gh);
    capture(g, vis, x0, y0);
    S.nearFn = (x, y, pad) => inV(x, y, mx, my, VR + pad);
    sceneFx(g, sc, dt || 1 / 60, S.nearFn);
    if (typeof Juice.drawAfterCovers === 'function') {
      const dc = S.dummy || (S.dummy = document.createElement('canvas').getContext('2d'));
      try { Juice.drawAfterCovers(dc, mx - VR, my - VR, mx + VR, my + VR, dt || 1 / 60); } catch (e) {}
    }
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
      // kement ve kementteki kişiye uzanan ip (ok ve dinamit aşağıda, yükseklikleriyle)
      RP.st.h = 9;
      const PJ = g.projs, keep = PJ.slice();
      try { g.projs = keep.filter(q => q.type !== 'arrow' && q.type !== 'dynamite'); g.drawProjs(RP.ctx); } finally { g.projs = PJ; }
      RP.st.h = 0;
    } finally { RP.end(); }
    ctx.restore();
    ctx.save(); ctx.setTransform(ds, 0, 0, ds, 0, 0);
    try { projs3D(ctx, g); } finally { ctx.restore(); }
    // parçacıklar: yerdeki noktaları ve yükseklikleriyle (ekran pikseliyle çizilir)
    ctx.save(); ctx.setTransform(ds, 0, 0, ds, 0, 0);
    try { parts3D(ctx, mx, my, VR); marks3D(ctx, g, sc, mx, my, VR); } finally { ctx.restore(); }
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
  // hikâye sinematiği oynarken (js/cinema.js, #cinema.on) fare kamerayı döndürmez, kilit bırakılır; bitince geri gelir
  const cineOn = () => { const e = document.getElementById('cinema'); return !!e && e.classList.contains('on') && !e.classList.contains('out'); };
  const playing = () => typeof G !== 'undefined' && G.state === 'play' && want3D() && !!G.world && !(UI.isModal && UI.isModal()) && !cineOn();
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
    if (D3.onLock) D3.onLock();
  });
  document.addEventListener('pointerlockerror', () => { S.look = false; S.relock = false; if (D3.onLock) D3.onLock(); });
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

  const uiUpdate = UI.update;
  UI.update = function (...a) {
    const r = uiUpdate.apply(this, a);
    // fare kilidi: menü, harita, konuşma ya da 2D'de bırakılır; yalnız oyun içi pencere kapanınca kendiliğinden geri gelir
    if (S.look && !playing()) {
      S.relock = G.state === 'play' && want3D();
      S.look = false;
      if (locked()) document.exitPointerLock();
    } else if (!S.look && S.lostN && !playing()) {
      S.relock = G.state === 'play' && want3D();
      S.lostN = 0;
    } else if (!S.look && playing() && !document.pointerLockElement && performance.now() - (S.lockReqT || 0) > 700
      && (S.relock || (S.wantLock && performance.now() - S.wantLock < 4000) || !S.autoTried)) {
      // pencere kapandı, tuşa basıldı ya da tıklandı (oyuna ilk girişte de bir kez denenir: yeni oyun tıklaması sayılabilir)
      S.relock = false; S.wantLock = 0; S.autoTried = true; lockNow();
    }
    if (!S.look && S.relock && (G.state !== 'play' || !want3D())) S.relock = false;
    cursorState();
    if (S.lostN && ++S.lostN > 4) {
      S.lostN = 0;
      if (playing() && !locked()) { S.relock = true; try { UI.openPause(); } catch (e) {} }
    }
    // 3B'ye ilk geçişte kontrollerin kısa hatırlatması (oturum başına bir kez)
    if (playing() && S.cam.ok && !S.hinted) { S.hinted = true; try { UI.feed(Tr('3B: fare bakış yönü ve nişan · Esc duraklatır')); } catch (e) {} }
    if (D3.onUiUpdate) D3.onUiUpdate();
    return r;
  };


  /* dünya arayüzü dışındaki bütün 2D katmanlarda (ayarlar, testler) kullanılanlar */
  Object.assign(D3, { w2s, s2w, lookBy, sensMul, AIM_H, AIM_MIN, LOOK_YAW, AIM_K, want3D, on3D, streamReset, stream: SC,
    radarRot: () => (on3D() ? S.yaw : 0) });
})();
