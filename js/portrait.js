'use strict';
/* ==========================================================
   FRONTIER'S END — karakter portresi
   Boyanmış stüdyo portresi: sol üstten sıcak ana ışık, sağdan serin
   dolgu, katmanlı form gölgeleri, tel tel saç ve sakal, keçe/hasır/
   kürk/kumaş dokuları. Karakter oluşturma ekranı, günlük ve efsane
   (ölüm) ekranı kullanır. Koordinatlar 200×240'lık bir alanda; tuval
   boyutuna ölçeklenir. Rastgelelik sabit tohumludur: aynı görünüm her
   seferinde aynı çizilir.
   ========================================================== */

const PortraitArt = {
  /* ---------------- renk yardımcıları ([r,g,b] dizileri) ---------------- */
  rgb(c) {
    if (Array.isArray(c)) return c;
    if (c[0] === '#') return hexToRgb(c);
    const m = c.match(/\d+/g);
    return m ? [+m[0], +m[1], +m[2]] : [128, 128, 128];
  },
  css(a, al = 1) { return al >= 1 ? `rgb(${a[0] | 0},${a[1] | 0},${a[2] | 0})` : `rgba(${a[0] | 0},${a[1] | 0},${a[2] | 0},${al})`; },
  sh(c, f, al) { const a = this.rgb(c); const m = v => clamp(f < 0 ? v * (1 + f) : v + (255 - v) * f, 0, 255); return this.css([m(a[0]), m(a[1]), m(a[2])], al); },
  /* saç ve sakal için parlatma: rengi beyaza karıştırmadan yükseltir (kahverengi gri görünmesin) */
  hi(c, f, al) { const a = this.rgb(c); const m = v => clamp(v * (1 + f * 1.3) + (255 - v) * f * 0.22, 0, 255); return this.css([m(a[0]), m(a[1]), m(a[2])], al); },
  mix(c1, c2, t, al) { const a = this.rgb(c1), b = this.rgb(c2); return this.css([lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)], al); },
  lum(c) { const a = this.rgb(c); return (a[0] * 0.3 + a[1] * 0.59 + a[2] * 0.11) / 255; },
  lin(ctx, x0, y0, x1, y1, stops) { const g = ctx.createLinearGradient(x0, y0, x1, y1); for (const [o, c] of stops) g.addColorStop(o, c); return g; },
  rad(ctx, x0, y0, r0, x1, y1, r1, stops) { const g = ctx.createRadialGradient(x0, y0, r0, x1, y1, r1); for (const [o, c] of stops) g.addColorStop(o, c); return g; },
  ell(ctx, x, y, rx, ry, fill, rot = 0) { ctx.fillStyle = fill; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, TAU); ctx.fill(); },
  /* kenarı yumuşak eliptik ışık/gölge lekesi */
  soft(ctx, x, y, rx, ry, col, al, rot = 0) {
    if (rx <= 0 || ry <= 0) return;
    ctx.save(); ctx.translate(x, y); if (rot) ctx.rotate(rot); ctx.scale(1, ry / rx);
    ctx.fillStyle = this.rad(ctx, 0, 0, 0, 0, 0, rx, [[0, this.mix(col, col, 0, al)], [1, this.mix(col, col, 0, 0)]]);
    ctx.fillRect(-rx, -rx, rx * 2, rx * 2); ctx.restore();
  },
  /* yolu doldurur, sonra aynı yolun içine kırpılıp fn çizer (gölge ve ışık şekil dışına taşmaz) */
  fillClip(ctx, path, fill, fn) { path(); ctx.fillStyle = fill; ctx.fill(); if (fn) { ctx.save(); path(); ctx.clip(); fn(); ctx.restore(); } },
  clip(ctx, path, fn) { ctx.save(); path(); ctx.clip(); fn(); ctx.restore(); },
  /* sabit tohumlu rastgele (mulberry32) */
  rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; },
  /* ince kumaş/boya dokusu: bir kez üretilen gürültü deseni */
  grain(ctx) {
    if (!this._grain) {
      const c = document.createElement('canvas'); c.width = c.height = 96;
      const g = c.getContext('2d'), d = g.createImageData(96, 96), r = this.rng(7);
      for (let i = 0; i < d.data.length; i += 4) { const v = 128 + (r() - 0.5) * 120; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
      g.putImageData(d, 0, 0); this._grain = c;
    }
    return ctx.createPattern(this._grain, 'repeat');
  },
  texture(ctx, path, al, mode = 'overlay') {
    ctx.save(); path(); ctx.clip();
    ctx.globalCompositeOperation = mode; ctx.globalAlpha = al;
    ctx.save(); ctx.scale(0.5, 0.5); ctx.fillStyle = this.grain(ctx); ctx.fillRect(0, 0, 400, 480); ctx.restore();
    ctx.restore();
  },
  /* İki kılavuz eğri (kübik bezier, 4 nokta) arasında tel tel çizgiler: saç, sakal, kürk */
  strands(ctx, A, B, n, cols, w, al, seed, jit = 1.2) {
    const r = this.rng(seed);
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (let i = 0; i < n; i++) {
      const t = clamp((i + r()) / n, 0, 1), j = () => (r() - 0.5) * jit;
      const p = A.map((a, k) => [lerp(a[0], B[k][0], t) + (k ? j() : j() * 0.4), lerp(a[1], B[k][1], t) + (k ? j() : j() * 0.4)]);
      ctx.strokeStyle = cols[(r() * cols.length) | 0];
      ctx.globalAlpha = al * (0.55 + r() * 0.45);
      ctx.lineWidth = w * (0.55 + r() * 0.8);
      ctx.beginPath(); ctx.moveTo(p[0][0], p[0][1]); ctx.bezierCurveTo(p[1][0], p[1][1], p[2][0], p[2][1], p[3][0], p[3][1]); ctx.stroke();
    }
    ctx.restore();
  },
  /* kısa kıl/sakal noktaları (kirli sakal, kazınmış saç) */
  stipple(ctx, path, n, col, al, seed, box, len = 1.1) {
    const r = this.rng(seed), [x0, y0, x1, y1] = box;
    ctx.save(); path(); ctx.clip(); ctx.strokeStyle = col; ctx.lineCap = 'round';
    const B = [new Path2D(), new Path2D(), new Path2D()];
    for (let i = 0; i < n; i++) {
      const x = lerp(x0, x1, r()), y = lerp(y0, y1, r()), a = Math.PI / 2 + (x - 100) * 0.02 + (r() - 0.5) * 0.6, p = B[(r() * 3) | 0];
      p.moveTo(x, y); p.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
    }
    B.forEach((p, i) => { ctx.globalAlpha = al * [0.45, 0.7, 0.95][i]; ctx.lineWidth = [0.4, 0.52, 0.64][i]; ctx.stroke(p); });
    ctx.restore();
  },

  /* ---------------- ana çizim ---------------- */
  draw(ctx, W, H, look, age) {
    ctx.save();
    ctx.clearRect(0, 0, W, H);
    ctx.scale(W / 200, H / 240);
    const f = look.sex === 'f';
    const grey = clamp((age - 42) / 30, 0, 1);
    const hat = look.hat && look.hat !== 'none' && LOOKS.hatN[look.hat] ? look.hat : null;
    const hs = clamp(look.hairStyle | 0, 0, LOOKS.hairStyle.length - 1);
    const P = {
      look, age, f, grey, hs, hat,
      hair: grey > 0 ? this.mix(look.hair, '#d8d4cc', grey) : this.css(this.rgb(look.hair)),
      aging: clamp((age - 35) / 45, 0, 1),
      skin: this.css(this.rgb(look.skin)),
      fw: f ? 31 : 33.5, cy: 106,
      top: 106 - 57,                                  // kafatası tepesi
      hl: f ? 106 - 38 : hs === 9 ? 106 - 47 : 106 - 40,   // saç çizgisi
      by: 106 - 39,                                   // şapka bandının alt kenarı
    };
    // şapkanın alnı kestiği çizgi (saç bunun üstünde gizlenir)
    P.hatLine = hat === 'bonnet' ? P.by - 6 : P.by;
    P.dark = this.lum(P.skin) < 0.42;
    this.backdrop(ctx, P);
    ctx.save();
    ctx.translate(100, 141); ctx.scale(1.22, 1.22); ctx.translate(-100, -112);
    P.S = this.style(P);
    // katman sırası: arkadaki saç → gövde → yüzün arkasından öne düşen saç ve örgüler → baş ve yüz
    // → sakal → alındaki saç ve favoriler → şapka (saç yüzün içinden çıkmaz, kenarından dolanır)
    this.castShadow(ctx, P);
    this.hairBehind(ctx, P);
    if (hat === 'bonnet') this.bonnetBack(ctx, P);
    ctx.save(); ctx.translate(0, -7); this.body(ctx, P); ctx.restore();
    this.neck(ctx, P);
    this.hairFall(ctx, P);
    this.head(ctx, P);
    this.face(ctx, P);
    this.beard(ctx, P);
    this.hairCap(ctx, P);
    this.hatDraw(ctx, P);
    ctx.restore();
    // köşe kararması ve ince boya dokusu
    ctx.fillStyle = this.rad(ctx, 96, 112, 70, 100, 120, 175, [[0, 'rgba(50,32,16,0)'], [1, 'rgba(50,32,16,0.38)']]);
    ctx.fillRect(0, 0, 200, 240);
    this.texture(ctx, () => { ctx.beginPath(); ctx.rect(0, 0, 200, 240); }, 0.06);
    ctx.restore();
  },

  /* Stüdyo fonu: boyanmış, lekeli tuval */
  backdrop(ctx, P) {
    ctx.fillStyle = this.rad(ctx, 70, 70, 10, 100, 110, 180, [[0, '#efe3cc'], [0.5, '#ddcbaa'], [1, '#a88e68']]);
    ctx.fillRect(0, 0, 200, 240);
    const r = this.rng(31);
    for (let i = 0; i < 14; i++) this.soft(ctx, r() * 200, r() * 240, 20 + r() * 40, 14 + r() * 30, r() < 0.5 ? '#fff6e4' : '#8a6c48', 0.12 + r() * 0.1, r() * 3);
    this.soft(ctx, 150, 120, 60, 110, '#6a5032', 0.22);
  },
  /* başın ve omuzların fona düşen yumuşak gölgesi (sağa) */
  castShadow(ctx, P) {
    this.soft(ctx, 118, 108, 48, 60, '#3a2814', 0.22);
    this.soft(ctx, 128, 200, 90, 50, '#3a2814', 0.2);
  },

  /* ---------------- gövde ---------------- */
  body(ctx, P) {
    const L = P.look, coat = L.coat, shirt = L.shirt, f = P.f;
    const duster = (L.coatLen || 0) > 0.3;
    const torso = () => { ctx.beginPath(); ctx.moveTo(2, 240); ctx.bezierCurveTo(4, 198, 22, 176, 66, 165); ctx.quadraticCurveTo(100, 158, 134, 165); ctx.bezierCurveTo(178, 176, 196, 198, 198, 240); ctx.closePath(); };
    // ceket: ışık soldan, kıvrımlar ve omuz dikişleri
    this.fillClip(ctx, torso, this.css(this.rgb(coat)), () => {
      ctx.fillStyle = this.lin(ctx, 0, 0, 200, 0, [[0, this.sh(coat, 0.16)], [0.45, this.sh(coat, 0.02)], [1, this.sh(coat, -0.42)]]);
      ctx.fillRect(0, 150, 200, 100);
      this.soft(ctx, 40, 186, 34, 16, this.sh(coat, 0.28), 0.5, -0.4);
      this.soft(ctx, 166, 190, 30, 18, this.sh(coat, -0.5), 0.5, 0.4);
      // kol kıvrımları
      ctx.strokeStyle = this.sh(coat, -0.35, 0.55); ctx.lineWidth = 1.1;
      ctx.beginPath(); ctx.moveTo(24, 214); ctx.quadraticCurveTo(34, 206, 30, 196); ctx.moveTo(176, 214); ctx.quadraticCurveTo(166, 206, 170, 196);
      ctx.moveTo(14, 230); ctx.quadraticCurveTo(26, 222, 22, 210); ctx.stroke();
      ctx.strokeStyle = this.sh(coat, 0.25, 0.35);
      ctx.beginPath(); ctx.moveTo(26, 216); ctx.quadraticCurveTo(36, 208, 32, 197); ctx.stroke();
      // omuz dikişi
      ctx.setLineDash([1.4, 1.6]); ctx.strokeStyle = this.sh(coat, -0.3, 0.5); ctx.lineWidth = 0.6;
      ctx.beginPath(); ctx.moveTo(48, 172); ctx.quadraticCurveTo(40, 190, 42, 210); ctx.moveTo(152, 172); ctx.quadraticCurveTo(160, 190, 158, 210); ctx.stroke();
      ctx.setLineDash([]);
    });
    this.texture(ctx, torso, 0.12);
    // gömlek
    const shirtP = () => { ctx.beginPath(); ctx.moveTo(76, 240); ctx.lineTo(80, 158); ctx.lineTo(120, 158); ctx.lineTo(124, 240); ctx.closePath(); };
    this.fillClip(ctx, shirtP, this.sh(shirt, 0), () => {
      ctx.fillStyle = this.lin(ctx, 80, 0, 124, 0, [[0, this.sh(shirt, 0.14)], [0.6, this.sh(shirt, -0.05)], [1, this.sh(shirt, -0.3)]]); ctx.fillRect(70, 150, 60, 100);
      this.soft(ctx, 100, 166, 16, 8, this.sh(shirt, -0.5), 0.5);
    });
    if (f) {
      // yüksek yakalı bluz, dantel kenar, pliler ve kameo broş
      ctx.strokeStyle = this.sh(shirt, -0.25, 0.6); ctx.lineWidth = 0.7;
      for (let x = 86; x <= 114; x += 4) { ctx.beginPath(); ctx.moveTo(x, 178); ctx.quadraticCurveTo(x + (x - 100) * 0.05, 210, x + (x - 100) * 0.12, 240); ctx.stroke(); }
      const col = () => { ctx.beginPath(); ctx.moveTo(85, 148); ctx.quadraticCurveTo(100, 154, 115, 148); ctx.lineTo(117, 168); ctx.quadraticCurveTo(100, 175, 83, 168); ctx.closePath(); };
      this.fillClip(ctx, col, this.sh(shirt, 0.08), () => {
        ctx.fillStyle = this.lin(ctx, 83, 0, 117, 0, [[0, this.sh(shirt, 0.2)], [1, this.sh(shirt, -0.25)]]); ctx.fillRect(80, 145, 40, 32);
        ctx.strokeStyle = this.sh(shirt, -0.2, 0.5); ctx.lineWidth = 0.5;
        for (let y = 152; y < 168; y += 3) { ctx.beginPath(); ctx.moveTo(84, y + 2); ctx.quadraticCurveTo(100, y + 7, 116, y + 2); ctx.stroke(); }
      });
      ctx.strokeStyle = this.sh(shirt, -0.3, 0.75); ctx.lineWidth = 0.8;
      for (let k = 0; k < 9; k++) { ctx.beginPath(); ctx.arc(84.5 + k * 4, 169.5, 2.1, 0.1, Math.PI - 0.1); ctx.stroke(); }
      this.ell(ctx, 100, 172, 5.2, 6.2, '#9a7a30'); this.ell(ctx, 100, 172, 4, 5, '#c8a050');
      this.ell(ctx, 100, 172, 3.2, 4.1, '#e8dcc8'); this.ell(ctx, 100.4, 171.6, 1.6, 2.6, '#c8b8a0');
      this.soft(ctx, 98.6, 170, 1.4, 1.6, '#ffffff', 0.8);
    } else {
      // yelek: düğmeler, cep, saat zinciri
      const vest = this.mix(L.pants, coat, 0.35);
      for (const k of [-1, 1]) {
        const vp = () => { ctx.beginPath(); ctx.moveTo(100 + k * 21, 240); ctx.lineTo(100 + k * 17, 170); ctx.lineTo(100 + k * 3, 200); ctx.lineTo(100 + k * 3.5, 240); ctx.closePath(); };
        this.fillClip(ctx, vp, k < 0 ? this.sh(vest, 0.06) : this.sh(vest, -0.22), () => {
          ctx.fillStyle = this.lin(ctx, 100 + k * 20, 0, 100, 0, [[0, this.sh(vest, k < 0 ? 0.12 : -0.35)], [1, this.sh(vest, k < 0 ? -0.05 : -0.15)]]); ctx.fillRect(78, 165, 44, 80);
        });
        this.texture(ctx, vp, 0.16);
      }
      for (let y = 206; y < 240; y += 9) { this.ell(ctx, 104.5, y, 1.5, 1.5, this.sh(vest, -0.55)); this.ell(ctx, 104.1, y - 0.4, 0.6, 0.6, this.sh(vest, 0.3)); }
      ctx.strokeStyle = '#c8a050'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(104, 215); ctx.quadraticCurveTo(110, 224, 116, 218); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,240,200,0.6)'; ctx.lineWidth = 0.3; ctx.stroke();
      // gömlek yakası
      for (const k of [-1, 1]) {
        const cp = () => { ctx.beginPath(); ctx.moveTo(100 + k * 15, 152); ctx.lineTo(100 + k * 2, 169); ctx.lineTo(100 + k * 10, 186); ctx.lineTo(100 + k * 20, 164); ctx.closePath(); };
        this.fillClip(ctx, cp, k < 0 ? this.sh(shirt, 0.16) : this.sh(shirt, -0.12), () => this.soft(ctx, 100 + k * 6, 170, 6, 10, this.sh(shirt, -0.35), 0.5));
        ctx.strokeStyle = this.sh(shirt, -0.35, 0.6); ctx.lineWidth = 0.5; cp(); ctx.stroke();
      }
      if (P.hat === 'cowboy' || P.hat === 'wide' || P.hat === 'boss' || P.hat === 'straw' || P.hat === 'fur' || !P.hat) {
        // bandana: boyna sarılı, önde düğüm, sarkan uçlar, desen
        const bc = L.shirt === '#b04a3a' ? '#2e4a6a' : '#8a3028';
        const band = () => { ctx.beginPath(); ctx.moveTo(83, 156); ctx.quadraticCurveTo(100, 170, 117, 156); ctx.lineTo(115, 166); ctx.quadraticCurveTo(100, 180, 85, 166); ctx.closePath(); };
        this.fillClip(ctx, band, this.sh(bc, -0.08), () => { ctx.fillStyle = this.lin(ctx, 84, 0, 116, 0, [[0, this.sh(bc, 0.12)], [1, this.sh(bc, -0.35)]]); ctx.fillRect(80, 150, 40, 32); });
        const tri = () => { ctx.beginPath(); ctx.moveTo(91, 170); ctx.lineTo(109, 170); ctx.quadraticCurveTo(103, 186, 100, 198); ctx.quadraticCurveTo(97, 186, 91, 170); ctx.closePath(); };
        this.fillClip(ctx, tri, bc, () => {
          this.soft(ctx, 104, 182, 6, 12, this.sh(bc, -0.4), 0.6);
          ctx.fillStyle = 'rgba(240,230,210,0.45)';
          for (const [x, y] of [[95, 174], [100, 178], [105, 174], [98, 186], [102, 186], [100, 192]]) { ctx.beginPath(); ctx.arc(x, y, 0.8, 0, TAU); ctx.fill(); }
        });
        for (const k of [-1, 1]) {
          ctx.fillStyle = this.sh(bc, k < 0 ? -0.1 : -0.3);
          ctx.beginPath(); ctx.moveTo(100 - k, 176); ctx.quadraticCurveTo(100 + k * 6, 196, 100 + k * 12, 212); ctx.lineTo(100 + k * 5, 214); ctx.quadraticCurveTo(100 + k * 2, 196, 100 + k, 178); ctx.fill();
        }
        this.ell(ctx, 100, 174, 5.2, 4.4, this.sh(bc, -0.18)); this.soft(ctx, 98.5, 172.5, 2.6, 2, this.sh(bc, 0.35), 0.8);
      } else if (P.hat === 'top' || P.hat === 'bowler') {
        // kravat: geniş, düğümlü, iğneli
        const tc = '#2a1e28';
        this.fillClip(ctx, () => { ctx.beginPath(); ctx.moveTo(95, 166); ctx.lineTo(105, 166); ctx.lineTo(108, 196); ctx.lineTo(100, 202); ctx.lineTo(92, 196); ctx.closePath(); }, tc, () => {
          ctx.fillStyle = this.lin(ctx, 92, 0, 108, 0, [[0, 'rgba(255,255,255,0.12)'], [1, 'rgba(0,0,0,0.3)']]); ctx.fillRect(90, 160, 20, 44);
          ctx.strokeStyle = 'rgba(160,120,140,0.25)'; ctx.lineWidth = 0.5;
          for (let y = 170; y < 202; y += 3) { ctx.beginPath(); ctx.moveTo(92, y + 2); ctx.lineTo(108, y - 2); ctx.stroke(); }
        });
        this.ell(ctx, 100, 167, 4.2, 3.2, '#1a1218'); this.ell(ctx, 100, 182, 1, 1, '#e8d8a0');
      } else {
        // ince bağ kravat
        ctx.strokeStyle = '#1a1210'; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(100, 172); ctx.quadraticCurveTo(98, 186, 96.5, 200); ctx.moveTo(100, 172); ctx.quadraticCurveTo(102, 186, 103.5, 200); ctx.stroke();
        this.ell(ctx, 100, 172, 3.6, 2.6, '#c0a060'); this.ell(ctx, 100, 172, 2.2, 1.6, '#7a2a24');
      }
    }
    // palto yakaları: çentikli, kenar dikişli
    for (const k of [-1, 1]) {
      const lp = () => {
        ctx.beginPath(); ctx.moveTo(100 + k * 18, 156); ctx.lineTo(100 + k * (duster ? 44 : 35), 171); ctx.lineTo(100 + k * (duster ? 34 : 28), 181);
        ctx.lineTo(100 + k * (duster ? 40 : 32), 187); ctx.lineTo(100 + k * 23, 240); ctx.lineTo(100 + k * 20.5, 240); ctx.lineTo(100 + k * 15, 196); ctx.closePath();
      };
      this.fillClip(ctx, lp, k < 0 ? this.sh(coat, 0.12) : this.sh(coat, -0.32), () => {
        ctx.fillStyle = this.lin(ctx, 100 + k * 15, 0, 100 + k * 40, 0, [[0, this.sh(coat, k < 0 ? 0.24 : -0.45)], [1, this.sh(coat, k < 0 ? 0.04 : -0.2)]]); ctx.fillRect(55, 150, 90, 92);
        this.soft(ctx, 100 + k * 26, 200, 6, 30, this.sh(coat, -0.5), 0.4);
      });
      ctx.strokeStyle = this.sh(coat, -0.55, 0.7); ctx.lineWidth = 0.6; lp(); ctx.stroke();
      ctx.setLineDash([1, 1.4]); ctx.strokeStyle = this.sh(coat, 0.3, 0.45); ctx.lineWidth = 0.4;
      ctx.beginPath(); ctx.moveTo(100 + k * 20, 160); ctx.lineTo(100 + k * (duster ? 41 : 32), 172); ctx.stroke(); ctx.setLineDash([]);
    }
    for (const y of [214, 232]) { this.ell(ctx, 128, y, 2.3, 2.3, this.sh(coat, -0.55)); this.ell(ctx, 127.4, y - 0.6, 0.9, 0.9, this.sh(coat, 0.25)); }
  },

  neck(ctx, P) {
    const s = P.skin;
    const np = () => { ctx.beginPath(); ctx.moveTo(85, 126); ctx.lineTo(115, 126); ctx.quadraticCurveTo(114, 142, 117, 154); ctx.quadraticCurveTo(100, 162, 83, 154); ctx.quadraticCurveTo(86, 142, 85, 126); ctx.closePath(); };
    this.fillClip(ctx, np, this.sh(s, -0.06), () => {
      ctx.fillStyle = this.lin(ctx, 84, 0, 116, 0, [[0, this.sh(s, 0.05)], [0.5, this.sh(s, -0.08)], [1, this.sh(s, -0.4)]]); ctx.fillRect(80, 120, 40, 44);
      this.soft(ctx, 101, 134, 18, 9, this.sh(s, -0.55), 0.7);   // çene gölgesi
      ctx.strokeStyle = this.sh(s, -0.3, 0.35); ctx.lineWidth = 0.8;
      for (const k of [-1, 1]) { ctx.beginPath(); ctx.moveTo(100 + k * 12, 132); ctx.quadraticCurveTo(100 + k * 8, 146, 100 + k * 3, 155); ctx.stroke(); }
      if (!P.f) this.soft(ctx, 100, 145, 3, 4, this.sh(s, 0.2), 0.5);
    });
  },

  /* Baş şekli: alın, şakak, elmacık, çene (erkekte köşeli, kadında yumuşak) */
  headPath(ctx, P) {
    const fw = P.fw, cy = P.cy, f = P.f;
    ctx.beginPath();
    ctx.moveTo(100, cy - 57);
    ctx.bezierCurveTo(100 + fw * 0.8, cy - 57, 100 + fw + 1.5, cy - 38, 100 + fw - 1, cy - 14);
    ctx.quadraticCurveTo(100 + fw + 0.6, cy - 4, 100 + fw, cy + 2);
    if (f) { ctx.bezierCurveTo(100 + fw - 1, cy + 18, 100 + fw * 0.66, cy + 33, 100 + 9, cy + 39); ctx.quadraticCurveTo(100, cy + 43, 100 - 9, cy + 39); ctx.bezierCurveTo(100 - fw * 0.66, cy + 33, 100 - fw + 1, cy + 18, 100 - fw, cy + 2); }
    else { ctx.bezierCurveTo(100 + fw - 0.5, cy + 16, 100 + fw - 3, cy + 26, 100 + fw - 9, cy + 33); ctx.quadraticCurveTo(100 + 15, cy + 43, 100 + 9, cy + 44); ctx.lineTo(100 - 9, cy + 44); ctx.quadraticCurveTo(100 - 15, cy + 43, 100 - fw + 9, cy + 33); ctx.bezierCurveTo(100 - fw + 3, cy + 26, 100 - fw + 0.5, cy + 16, 100 - fw, cy + 2); }
    ctx.quadraticCurveTo(100 - fw - 0.6, cy - 4, 100 - fw + 1, cy - 14);
    ctx.bezierCurveTo(100 - fw - 1.5, cy - 38, 100 - fw * 0.8, cy - 57, 100, cy - 57);
    ctx.closePath();
  },
  ear(ctx, P, k) {
    const s = P.skin, fw = P.fw, cy = P.cy, x = 100 + k * (fw + 0.5), lit = k < 0;
    const ep = () => { ctx.beginPath(); ctx.moveTo(x - k * 2, cy - 8); ctx.bezierCurveTo(x + k * 7, cy - 12, x + k * 9, cy + 2, x + k * 5, cy + 12); ctx.quadraticCurveTo(x + k * 2, cy + 18, x - k * 2, cy + 15); ctx.closePath(); };
    this.fillClip(ctx, ep, lit ? this.sh(s, 0.02) : this.sh(s, -0.2), () => {
      this.soft(ctx, x + k * 3.4, cy + 2, 2.6, 5.4, this.sh(s, -0.35), 0.45);
      ctx.strokeStyle = this.sh(s, lit ? 0.18 : -0.05, 0.8); ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(x + k * 1, cy - 8); ctx.bezierCurveTo(x + k * 7, cy - 9, x + k * 7.6, cy + 2, x + k * 4.2, cy + 10); ctx.stroke();
      this.soft(ctx, x + k * 2.2, cy + 12, 2.4, 2.6, '#d07060', 0.3);
    });
  },
  head(ctx, P) {
    const s = P.skin, fw = P.fw, cy = P.cy;
    for (const k of [-1, 1]) this.ear(ctx, P, k);
    this.fillClip(ctx, () => this.headPath(ctx, P), s, () => {
      // form gölgesi (sağ), şakaklar, elmacık ışığı, alın ışığı
      ctx.fillStyle = this.lin(ctx, 100 - fw, 0, 100 + fw, 0, [[0, this.sh(s, 0.1, 0.6)], [0.42, this.sh(s, 0, 0)], [0.72, this.sh(s, -0.18, 0.4)], [1, this.sh(s, -0.5, 0.85)]]);
      ctx.fillRect(60, cy - 60, 80, 110);
      ctx.fillStyle = this.lin(ctx, 0, cy - 58, 0, cy + 44, [[0, this.sh(s, 0.12, 0.3)], [0.5, this.sh(s, 0, 0)], [1, this.sh(s, -0.35, 0.45)]]);
      ctx.fillRect(60, cy - 60, 80, 110);
      for (const k of [-1, 1]) this.soft(ctx, 100 + k * (fw - 3), cy - 18, 6, 14, this.sh(s, -0.32), 0.45);
      this.soft(ctx, 90, cy - 36, 18, 11, this.sh(s, 0.3), 0.55);
      for (const k of [-1, 1]) this.soft(ctx, 100 + k * 19, cy + 18, 7, 12, this.sh(s, -0.3), k < 0 ? 0.2 : 0.4, k * -0.5);   // elmacık altı çukuru
      this.soft(ctx, 82, cy + 6, 9, 6, this.sh(s, 0.22), 0.5);        // sol elmacık ışığı
      this.soft(ctx, 117, cy + 8, 7, 11, this.sh(s, -0.4), 0.45);       // sağ yanak altı
      for (const k of [-1, 1]) this.soft(ctx, 100 + k * 18, cy + 13, 9, 6, '#d4705c', P.f ? 0.2 : 0.09);
      this.soft(ctx, 100, cy + 37, 8, 4, this.sh(s, 0.18), 0.5);        // çene ışığı
      // erkekte traş gölgesi (sakal yoksa da hafif)
      if (!P.f) this.soft(ctx, 100, cy + 30, 26, 14, this.mix(s, P.hair, 0.45), P.look.beard ? 0.12 : 0.18);
      // sol kenar ışığı (rim)
      ctx.strokeStyle = this.sh(s, 0.4, 0.35); ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(100 - fw + 1.2, cy - 18); ctx.quadraticCurveTo(100 - fw + 0.4, cy + 4, 100 - fw + 3, cy + 22); ctx.stroke();
    });
    this.texture(ctx, () => this.headPath(ctx, P), 0.05, 'soft-light');
  },

  /* ---------------- yüz ---------------- */
  face(ctx, P) {
    const s = P.skin, cy = P.cy, f = P.f, L = P.look;
    const eyeY = cy - 2, ex = 13.2;
    const brow = P.grey > 0.5 ? this.mix(P.hair, '#8a8278', 0.3) : this.sh(P.hair, P.dark ? -0.15 : -0.25);
    // göz çukurları ve kaş kemiği
    for (const k of [-1, 1]) { this.soft(ctx, 100 + k * ex, eyeY - 1.5, 11, 6.5, this.sh(s, -0.4), k < 0 ? 0.3 : 0.45); this.soft(ctx, 100 + k * (ex + 1), eyeY - 11, 9, 3, this.sh(s, 0.25), k < 0 ? 0.4 : 0.15); }
    this.soft(ctx, 100, eyeY - 2, 3.4, 6, this.sh(s, 0.18), 0.4);   // burun kökü ışığı
    for (const k of [-1, 1]) {
      const x = 100 + k * ex, hw = 6.6;
      const top = f ? 4.3 : 3.7, bot = f ? 2.6 : 2.3;
      const eye = () => { ctx.beginPath(); ctx.moveTo(x - k * hw, eyeY + 0.6); ctx.bezierCurveTo(x - k * 3.6, eyeY - top, x + k * 2.6, eyeY - top - 0.5, x + k * (hw + 0.4), eyeY - 0.6); ctx.bezierCurveTo(x + k * 3.6, eyeY + bot, x - k * 2.6, eyeY + bot + 0.6, x - k * hw, eyeY + 0.6); ctx.closePath(); };
      this.fillClip(ctx, eye, this.mix('#efe6da', s, 0.12), () => {
        this.soft(ctx, x + k * 5.6, eyeY - 0.2, 3.6, 3, this.sh(s, -0.35), 0.55); this.soft(ctx, x - k * 5.8, eyeY + 0.6, 2, 1.8, '#d08478', 0.65);
        const ir = this.rgb(L.eyes || '#3a2a1a'), ix = x + k * 0.2, iy = eyeY + 0.1, R = 3.4;
        ctx.fillStyle = this.rad(ctx, ix - 0.4, iy + 1, 0.2, ix, iy, R, [[0, this.css(ir.map(v => Math.min(255, v * 1.35 + 12)))], [0.6, this.css(ir)], [1, this.css(ir.map(v => v * 0.42))]]);
        ctx.beginPath(); ctx.arc(ix, iy, R, 0, TAU); ctx.fill();
        ctx.strokeStyle = this.css(ir.map(v => Math.min(255, v * 1.3 + 10)), 0.45); ctx.lineWidth = 0.25;
        for (let a = 0; a < TAU; a += TAU / 16) { ctx.beginPath(); ctx.moveTo(ix + Math.cos(a) * 1.4, iy + Math.sin(a) * 1.4); ctx.lineTo(ix + Math.cos(a) * 3, iy + Math.sin(a) * 3); ctx.stroke(); }
        this.ell(ctx, ix, iy, 1.35, 1.35, '#0c0705');
        // üst kapağın gölgesi
        ctx.fillStyle = this.lin(ctx, 0, eyeY - top, 0, eyeY + 1.2, [[0, 'rgba(36,18,8,0.7)'], [1, 'rgba(36,18,8,0)']]); ctx.fillRect(x - 9, eyeY - 7, 18, 8.5);
      });
      this.ell(ctx, x + k * 0.2 - 1.1, eyeY - 1.1, 0.85, 0.75, 'rgba(255,255,255,0.92)');
      this.ell(ctx, x + k * 0.2 + 1.1, eyeY + 1.3, 0.4, 0.3, 'rgba(255,255,255,0.45)');
      // üst kapak çizgisi, kirpikler
      ctx.strokeStyle = '#22120a'; ctx.lineCap = 'round'; ctx.lineWidth = f ? 1.5 : 1.15;
      ctx.beginPath(); ctx.moveTo(x - k * (hw + 0.3), eyeY + 0.7); ctx.bezierCurveTo(x - k * 3.6, eyeY - top - 0.3, x + k * 2.6, eyeY - top - 0.8, x + k * (hw + 0.8), eyeY - 0.3); ctx.stroke();
      if (f) { ctx.lineWidth = 0.55; for (let i = 0; i < 5; i++) { const t = 0.5 + i * 0.11, px = x + k * lerp(-hw, hw, t), py = eyeY - top * (1 - Math.pow(Math.abs(t - 0.45) * 1.8, 2)) - 0.5; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + k * (0.8 + i * 0.35), py - 1.4 + i * 0.15); ctx.stroke(); } }
      // kapak katı
      ctx.strokeStyle = this.sh(s, -0.38, 0.7); ctx.lineWidth = 0.7;
      ctx.beginPath(); ctx.moveTo(x - k * 5, eyeY - top - 1.6); ctx.quadraticCurveTo(x + k * 0.5, eyeY - top - 3.4, x + k * 6.4, eyeY - top + 0.2); ctx.stroke();
      this.soft(ctx, x + k * 0.5, eyeY - top - 1.2, 5.6, 1.4, this.sh(s, 0.15), 0.4);
      // alt kapak ve göz altı
      ctx.strokeStyle = this.sh(s, -0.28, 0.5); ctx.lineWidth = 0.5;
      ctx.beginPath(); ctx.moveTo(x - k * 4.6, eyeY + bot + 0.4); ctx.quadraticCurveTo(x + k * 0.6, eyeY + bot + 1.6, x + k * 6, eyeY + 0.8); ctx.stroke();
      this.soft(ctx, x, eyeY + bot + 2.6, 5, 1.4, this.sh(s, -0.3), 0.3);
      // kaş: iç uçta yukarı, gövdede dışa doğru yatık kıllar
      const by = eyeY - (f ? 12.2 : 10.6), th = f ? 1.7 : 2.7, bx0 = x - k * 7.8, bx1 = x + k * 9.6, arch = f ? 3.6 : 2.4;
      const yAt = (t) => by + 1.2 - Math.sin(Math.min(1, t * 1.25) * Math.PI * 0.75) * arch + t * 0.6;
      const bp = () => { ctx.beginPath(); ctx.moveTo(bx0, yAt(0) + th); for (let i = 0; i <= 10; i++) { const t = i / 10; ctx.lineTo(lerp(bx0, bx1, t), yAt(t) - th * (1 - t * 0.7) * 0.5); } for (let i = 10; i >= 0; i--) { const t = i / 10; ctx.lineTo(lerp(bx0, bx1, t), yAt(t) + th * (1 - t * 0.75)); } ctx.closePath(); };
      bp(); ctx.fillStyle = this.mix(brow, s, 0.45, 0.75); ctx.fill();
      const rb = this.rng(41 + k);
      ctx.strokeStyle = brow; ctx.lineCap = 'round';
      for (let i = 0; i < 46; i++) {
        const t = rb(), px = lerp(bx0, bx1, t), py = yAt(t) + (rb() - 0.3) * th * (1 - t * 0.6);
        const ang = t < 0.22 ? -Math.PI / 2 + k * 0.55 : (k > 0 ? -0.18 + t * 0.35 : Math.PI + 0.18 - t * 0.35);
        const ln = t < 0.22 ? 1.6 : 2.4 - t;
        ctx.globalAlpha = 0.35 + rb() * 0.55; ctx.lineWidth = 0.3 + rb() * 0.3;
        ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + Math.cos(ang) * ln, py + Math.sin(ang) * ln); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    // burun: köprü ışığı, yan düzlem gölgesi, kanatlar, uç, delikler
    const ny = cy + 18;
    this.soft(ctx, 98.8, eyeY + 9, 1.6, 10, this.sh(s, 0.38), 0.55);
    this.soft(ctx, 105.2, eyeY + 11, 3, 12, this.sh(s, -0.42), 0.5);
    this.soft(ctx, 100, ny + 3.2, 9, 3.4, this.sh(s, -0.55), 0.55);
    this.ell(ctx, 100, ny - 1, f ? 3.8 : 4.6, f ? 3.3 : 3.9, this.sh(s, 0.02));
    this.soft(ctx, 103, ny, 3, 3, this.sh(s, -0.3), 0.5);
    for (const k of [-1, 1]) {
      const wx = 100 + k * (f ? 4.2 : 5);
      ctx.fillStyle = k < 0 ? this.sh(s, -0.06) : this.sh(s, -0.22);
      ctx.beginPath(); ctx.ellipse(wx, ny + 0.6, f ? 2.3 : 2.7, f ? 2.2 : 2.5, k * 0.4, 0, TAU); ctx.fill();
      ctx.strokeStyle = this.sh(s, -0.45, 0.6); ctx.lineWidth = 0.6;
      ctx.beginPath(); ctx.arc(wx, ny + 0.6, f ? 2.3 : 2.7, k < 0 ? Math.PI * 0.6 : -Math.PI * 0.1, k < 0 ? Math.PI * 1.2 : Math.PI * 0.4); ctx.stroke();
    }
    this.soft(ctx, 98.6, ny - 2.4, 2, 1.3, '#ffffff', 0.5);
    for (const k of [-1, 1]) { ctx.fillStyle = this.sh(s, k < 0 ? -0.6 : -0.66); ctx.beginPath(); ctx.ellipse(100 + k * 2.6, ny + 2.2, 1.6, 0.8, k * -0.3, 0, TAU); ctx.fill(); }
    // burun-dudak çizgisi ve filtrum
    for (const k of [-1, 1]) this.soft(ctx, 100 + k * 10, ny + 6, 2.4, 6, this.sh(s, -0.3), (0.12 + P.aging * 0.3) * (k < 0 ? 0.7 : 1), k * -0.4);
    if (P.aging > 0.2) { ctx.strokeStyle = this.sh(s, -0.35, P.aging * 0.4); ctx.lineWidth = 0.8; for (const k of [-1, 1]) { ctx.beginPath(); ctx.moveTo(100 + k * 7.4, ny + 2.4); ctx.quadraticCurveTo(100 + k * 11.5, ny + 8, 100 + k * 11.5, cy + 31); ctx.stroke(); } }
    this.soft(ctx, 100, ny + 6.4, 2, 2.6, this.sh(s, -0.3), 0.35);
    for (const k of [-1, 1]) this.soft(ctx, 100 + k * 2, ny + 6.4, 0.8, 2.4, this.sh(s, 0.2), 0.35);
    // ağız
    const my = cy + 29, mw = f ? 8.4 : 9.4;
    const lip = f ? this.mix(s, '#b04650', 0.42) : this.mix(s, '#9a5848', 0.24);
    const up = () => { ctx.beginPath(); ctx.moveTo(100 - mw, my); ctx.quadraticCurveTo(100 - 5, my - (f ? 3.4 : 2.4), 100 - 1.4, my - 2.2); ctx.quadraticCurveTo(100, my - 1.5, 100 + 1.4, my - 2.2); ctx.quadraticCurveTo(100 + 5, my - (f ? 3.4 : 2.4), 100 + mw, my); ctx.quadraticCurveTo(100, my + 0.8, 100 - mw, my); ctx.closePath(); };
    this.fillClip(ctx, up, this.sh(lip, -0.2), () => this.soft(ctx, 106, my, 6, 3, this.sh(lip, -0.4), 0.5));
    const lo = () => { ctx.beginPath(); ctx.moveTo(100 - mw + 1, my + 0.3); ctx.quadraticCurveTo(100, my + (f ? 5.6 : 4), 100 + mw - 1, my + 0.3); ctx.quadraticCurveTo(100, my + 1.2, 100 - mw + 1, my + 0.3); ctx.closePath(); };
    this.fillClip(ctx, lo, this.sh(lip, -0.02), () => { this.soft(ctx, 97.6, my + 2.3, 3.4, 1.1, '#ffffff', f ? 0.4 : 0.2); this.soft(ctx, 106, my + 2.4, 4, 2.2, this.sh(lip, -0.35), 0.5); });
    ctx.strokeStyle = this.sh(lip, -0.62); ctx.lineWidth = 0.85; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(100 - mw, my); ctx.quadraticCurveTo(100 - 3, my + 1, 100, my + 0.5); ctx.quadraticCurveTo(100 + 3, my + 1, 100 + mw, my); ctx.stroke();
    for (const k of [-1, 1]) this.soft(ctx, 100 + k * (mw + 0.6), my + 0.4, 1.5, 1.3, this.sh(s, -0.45), 0.55);
    this.soft(ctx, 100, my + 7.6, 5, 1.8, this.sh(s, -0.38), f ? 0.3 : 0.45);   // dudak altı gölgesi
    if (!f) this.soft(ctx, 100, cy + 38, 3.4, 2.2, this.sh(s, -0.25), 0.3);   // çene ortası
    // yaşlılık çizgileri
    const a = P.aging;
    if (a > 0) {
      ctx.strokeStyle = `rgba(90,50,30,${0.14 + a * 0.3})`; ctx.lineWidth = 0.9;
      ctx.beginPath(); ctx.moveTo(87, cy - 27); ctx.quadraticCurveTo(100, cy - 29, 113, cy - 27); ctx.stroke();
      if (a > 0.3) { ctx.beginPath(); ctx.moveTo(89, cy - 33); ctx.quadraticCurveTo(100, cy - 35, 111, cy - 33); ctx.stroke(); }
      for (const k of [-1, 1]) { const x = 100 + k * 21; ctx.beginPath(); ctx.moveTo(x, eyeY - 1); ctx.lineTo(x + k * 4, eyeY - 3); ctx.moveTo(x, eyeY + 1); ctx.lineTo(x + k * 4, eyeY + 2); ctx.stroke(); }
    }
  },

  /* ---------------- geometri: eğri, örnekleme, yüz kenarı, katman ---------------- */
  /* Catmull-Rom: noktalardan geçen yumuşak yol */
  spline(ctx, pts, closed = true) {
    const n = pts.length, g = (i) => (closed ? pts[(i + n) % n] : pts[clamp(i, 0, n - 1)]);
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 0; i < (closed ? n : n - 1); i++) {
      const p0 = g(i - 1), p1 = g(i), p2 = g(i + 1), p3 = g(i + 2);
      ctx.bezierCurveTo(p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6, p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6, p2[0], p2[1]);
    }
    if (closed) ctx.closePath();
  },
  /* açık Catmull-Rom eğrisini yay uzunluğuna göre n eşit noktaya böler */
  sample(pts, n) {
    const m = pts.length, g = (i) => pts[clamp(i, 0, m - 1)], d = [];
    for (let i = 0; i < m - 1; i++) {
      const p0 = g(i - 1), p1 = g(i), p2 = g(i + 1), p3 = g(i + 2);
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6], c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      for (let k = 0; k < 10; k++) { const t = k / 10, u = 1 - t; d.push([u * u * u * p1[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * p2[0], u * u * u * p1[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * p2[1]]); }
    }
    d.push(pts[m - 1]);
    const len = [0];
    for (let i = 1; i < d.length; i++) len.push(len[i - 1] + Math.hypot(d[i][0] - d[i - 1][0], d[i][1] - d[i - 1][1]));
    const L = len[len.length - 1] || 1, out = [];
    let j = 0;
    for (let i = 0; i < n; i++) {
      const s = L * i / Math.max(1, n - 1);
      while (j < len.length - 2 && len[j + 1] < s) j++;
      const t = clamp((s - len[j]) / Math.max(1e-6, len[j + 1] - len[j]), 0, 1);
      out.push([lerp(d[j][0], d[j + 1][0], t), lerp(d[j][1], d[j + 1][1], t)]);
    }
    return out;
  },
  /* yüz çevresinin sağ yarısı (tepeden çeneye), headPath ile aynı eğriler */
  faceEdge(P) {
    if (P._edge) return P._edge;
    const fw = P.fw, cy = P.cy, pts = [[100, cy - 57]];
    const cub = (a, b, c, d, n) => { for (let i = 1; i <= n; i++) { const t = i / n, u = 1 - t; pts.push([u * u * u * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * c[0] + t * t * t * d[0], u * u * u * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * c[1] + t * t * t * d[1]]); } };
    const quad = (a, b, c, n) => { for (let i = 1; i <= n; i++) { const t = i / n, u = 1 - t; pts.push([u * u * a[0] + 2 * u * t * b[0] + t * t * c[0], u * u * a[1] + 2 * u * t * b[1] + t * t * c[1]]); } };
    cub([100, cy - 57], [100 + fw * 0.8, cy - 57], [100 + fw + 1.5, cy - 38], [100 + fw - 1, cy - 14], 20);
    quad([100 + fw - 1, cy - 14], [100 + fw + 0.6, cy - 4], [100 + fw, cy + 2], 8);
    if (P.f) cub([100 + fw, cy + 2], [100 + fw - 1, cy + 18], [100 + fw * 0.66, cy + 33], [109, cy + 39], 16);
    else { cub([100 + fw, cy + 2], [100 + fw - 0.5, cy + 16], [100 + fw - 3, cy + 26], [100 + fw - 9, cy + 33], 14); quad([100 + fw - 9, cy + 33], [115, cy + 43], [109, cy + 44], 6); }
    return (P._edge = pts);
  },
  /* verilen yükseklikte yüz kenarının merkeze uzaklığı */
  ex(P, y) {
    const e = this.faceEdge(P);
    if (y <= e[0][1]) return 0;
    for (let i = 1; i < e.length; i++) if (e[i][1] >= y) { const a = e[i - 1], b = e[i]; return lerp(a[0], b[0], (y - a[1]) / Math.max(1e-6, b[1] - a[1])) - 100; }
    return e[e.length - 1][0] - 100;
  },
  /* ayrı katmanda çiz; feather verilirse kenarları o yolun bulanık maskesiyle yumuşatılır */
  layer(ctx, draw, feather, r = 0.8) {
    this._lp = this._lp || [];
    const d = (this._ld = (this._ld || 0) + 1), c = ctx.canvas;
    const L = this._lp[d] || (this._lp[d] = document.createElement('canvas'));
    if (L.width !== c.width || L.height !== c.height) { L.width = c.width; L.height = c.height; }
    const g = L.getContext('2d'), M = ctx.getTransform();
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; g.filter = 'none';
    g.clearRect(0, 0, L.width, L.height);
    g.save(); g.setTransform(M);
    try {
      draw(g);
      g.restore(); g.save(); g.setTransform(M);
      if (feather) {
        // kenarı yumuşat: yolun çevresini kademeli olarak sil (bulanıklık filtresinden çok daha hızlı)
        g.save(); g.globalCompositeOperation = 'destination-out'; g.lineJoin = 'round'; g.strokeStyle = '#000';
        feather(g);
        for (const [w, a] of [[r * 2.4, 0.28], [r * 1.5, 0.32], [r * 0.7, 0.4]]) { g.globalAlpha = a; g.lineWidth = w; g.stroke(); }
        g.restore();
      }
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.drawImage(L, 0, 0); ctx.restore();
    } finally { g.restore(); this._ld = d - 1; }
  },
  inPath(g, x, y) { const p = g.getTransform().transformPoint(new DOMPoint(x, y)); return g.isPointInPath(p.x, p.y); },

  /* ---------------- saç ---------------- */
  /* stiller — side: short (kulak önünde favori), back (kulağın üstünden geriye), cover (kulakları ve
     yüzün kenarını örter), sweep (bir yana derin ayrım); vol/vs: tepe ve yan hacmi; part: ayrım (yoksa
     geriye taranmış); fall: omza sarkan uzunluk */
  HS: {
    m: [
      { side: 'short', vol: 5, vs: 2, part: 87, sb: 2 },                            // Kısa
      { side: 'cover', vol: 5, vs: 3, part: 97, fall: 58 },                          // Uzun
      { side: 'short', vol: 3, vs: 1, part: null, sb: 0, tail: 1, shine: 1 },       // Toplu
      { side: 'short', vol: 0, vs: 0, part: null, sb: 0, buzz: 1 },                 // Kazınmış
      { side: 'cover', vol: 8, vs: 5, part: 89, fall: 28, wavy: 1 },                // Dalgalı
      { side: 'short', vol: 9, vs: 2, part: 84, sb: 0, quiff: 1, shine: 1 },       // Yana Taralı
      { side: 'short', vol: 6, vs: 1, part: null, sb: 0, peak: 1, shine: 1 },      // Arkaya Taralı
      { side: 'short', vol: 9, vs: 5, part: 100, sb: 2, curly: 1, fringe: 1 },     // Kıvırcık
      { side: 'short', vol: 3, vs: 1, part: null, sb: 0, braid: [-1] },            // Örgülü
      { side: 'short', vol: 3, vs: 1, part: 90, sb: 0, recede: 1 },                // Açık Alın
    ],
    f: [
      { side: 'cover', vol: 6, vs: 6, part: 88, fall: 30 },                          // Kısa (küt)
      { side: 'cover', vol: 4, vs: 3, part: 100, fall: 88 },                         // Uzun
      { side: 'back', vol: 4, vs: 2, part: 100, bun: 1 },                            // Topuz
      { side: 'back', vol: 2, vs: 1, part: 100 },                                    // Sıkı Toplu
      { side: 'cover', vol: 7, vs: 6, part: 95, fall: 90, wavy: 1 },                // Dalgalı
      { side: 'sweep', vol: 7, vs: 4, part: 84, fall: 94 },                          // Yana Taralı
      { side: 'back', vol: 12, vs: 7, part: null, bun: 1, pomp: 1 },                // Kabarık Topuz
      { side: 'cover', vol: 11, vs: 9, part: 100, fall: 76, curly: 1 },             // Kıvırcık
      { side: 'back', vol: 3, vs: 2, part: 100, braid: [-1] },                       // Tek Örgü
      { side: 'back', vol: 3, vs: 2, part: 100, braid: [-1, 1] },                   // İki Örgü
    ],
  },
  style(P) {
    const S = Object.assign({}, this.HS[P.f ? 'f' : 'm'][P.hs]);
    if (P.hat === 'bonnet') { S.side = 'back'; S.fall = 0; S.bun = 0; S.curly = 0; S.vol = Math.min(S.vol, 3); }
    if (P.hat && P.hat !== 'bonnet') S.bun = 0;
    return S;
  },
  hairCols(h) { return [this.sh(h, -0.5), this.sh(h, -0.3), this.sh(h, -0.12), this.css(this.rgb(h)), this.hi(h, 0.2), this.hi(h, 0.38)]; },

  /* başın üstündeki saç (alın, şakak, favori): iç kenar yüzün çizgisini izler */
  capGeo(P, S) {
    const { cy, fw, top, hl, f } = P, V = S.vol, Vs = S.vs, ex = (y) => this.ex(P, y), X = (k, d) => 100 + k * d;
    const TY = f ? cy - 21 : S.recede ? cy - 31 : cy - 23;
    const side = (k) => {
      const mode = S.side === 'sweep' ? (k > 0 ? 'cover' : 'back') : S.side, deep = S.side === 'sweep' && k > 0 ? 3 : 0;
      if (mode === 'short') {
        const sb = cy + (S.sb || 0);
        return { inner: [[X(k, ex(sb) - 0.2), sb], [X(k, ex(sb - 3) - 2.4), sb - 3], [X(k, ex(cy - 10) - 3.4), cy - 10], [X(k, ex(TY) - 3.8), TY]],
          outer: [[X(k, fw + 1.5 + Vs), cy - 30], [X(k, fw + 1 + Vs * 0.6), cy - 15], [X(k, ex(sb) + 0.9), sb]] };
      }
      if (mode === 'back') return { inner: [[X(k, ex(cy - 8) + 0.6), cy - 8], [X(k, ex(cy - 13) - 2.2), cy - 13], [X(k, ex(TY) - 3.4), TY]],
        outer: [[X(k, fw + 1.5 + Vs), cy - 30], [X(k, fw + 1.2 + Vs * 0.4), cy - 17], [X(k, ex(cy - 9) + 3.2), cy - 9]] };
      // cover: kulakları ve yüzün kenarını örter, sonra çenenin dışından dolanıp omza iner (tek parça)
      const F = cy + Math.max(S.fall || 0, 20), w = S.wavy ? 2.4 : 0, ox = fw + 8 + Vs * 0.85;
      const top3 = [[X(k, ex(cy + 5) - 2.8 - deep * 0.4), cy + 5], [X(k, ex(cy - 8) - 3.4 - deep * 0.6), cy - 8], [X(k, ex(cy - 20) - 4.6 - deep), cy - 20]];
      const inner = F > cy + 46 ? [[X(k, 18), F - 6], [X(k, 17.5), cy + 50], [X(k, ex(cy + 36) + 0.8), cy + 36], [X(k, ex(cy + 26) + 0.4), cy + 26], [X(k, ex(cy + 16) - 1.2), cy + 16], ...top3]
        : [[X(k, ex(F - 3) + 0.4), F - 3], [X(k, ex(cy + 15) - 1.2), cy + 15], ...top3];
      const outer = [[X(k, fw + 2 + Vs), cy - 30], [X(k, fw + 5 + Vs), cy - 12], [X(k, fw + 8 + Vs), cy + 4]];
      for (let y = cy + 18, i = 0; y < F - 8; y += 14, i++) outer.push([X(k, ox + 1 + Math.min(3, (y - cy) / 20) + (i % 2 ? w : -w)), y]);
      outer.push([X(k, ox + 2.5), F - 3], [X(k, ox - 0.5), F + 2.5], [X(k, ox - 4.5), F - 1], [X(k, ox - 8), F + 3.5], [X(k, ox - 11.5), F]);
      return { inner, outer };
    };
    const R = side(1), Lf = side(-1), px = S.part == null ? 100 : S.part;
    // alındaki saç çizgisi, sağ şakaktan sol şakağa
    let front;
    if (S.recede) front = [[X(1, 19), cy - 47], [X(1, 9), cy - 43.6], [100, cy - 42.6], [X(-1, 9), cy - 43.6], [X(-1, 19), cy - 47]];
    else if (S.fringe) front = [[X(1, 19), hl + 5], [X(1, 12), hl + 8], [X(1, 5), hl + 6.5], [X(-1, 2), hl + 8.6], [X(-1, 9), hl + 6.6], [X(-1, 17), hl + 6]];
    else if (!f) front = S.peak ? [[X(1, 17), hl + 2.4], [X(1, 6), hl + 0.4], [100, hl + 3.8], [X(-1, 6), hl + 0.4], [X(-1, 17), hl + 2.4]]
      : [[X(1, 17), hl + 2.6], [X(1, 7), hl + 0.6], [100, hl + 0.8], [X(-1, 7), hl + 0.6], [X(-1, 17), hl + 2.6]];
    else if (S.side === 'cover') front = [[X(1, 13) + (px - 100) * 0.4, hl + 6.5], [px + 5, hl + 1.8], [px, hl + 0.4], [px - 5, hl + 1.8], [X(-1, 13) + (px - 100) * 0.4, hl + 6.5]];
    else if (S.side === 'sweep') front = [[X(1, 15), hl + 8.5], [X(1, 4), hl + 4], [px + 5, hl + 1], [px, hl], [px - 4, hl + 0.8], [X(-1, ex(cy - 30) - 6), cy - 31]];
    else front = [[X(1, ex(cy - 30) - 6), cy - 31], [X(1, 14), hl + 2.4], [X(1, 6), hl + 0.5], [100, hl + 0.2], [X(-1, 6), hl + 0.5], [X(-1, 14), hl + 2.4], [X(-1, ex(cy - 30) - 6), cy - 31]];
    // tepe: hacim (yana taralıda sağ taraf kabarık)
    const vr = S.quiff ? 1.2 : 0.92, vl = S.quiff ? 0.72 : 0.92, tx = S.quiff ? 4 : 0;
    const crown = [[X(-1, fw * 0.8 + Vs * 0.6), top + 7 - V * 0.6], [X(-1, fw * 0.42), top - V * vl - 0.5], [100 + tx, top - V - 2.5], [X(1, fw * 0.42), top - V * vr - 0.5], [X(1, fw * 0.8 + Vs * 0.6), top + 7 - V * 0.6]];
    const inner = [...R.inner, ...front, ...Lf.inner.slice().reverse()], outer = [...Lf.outer.slice().reverse(), ...crown, ...R.outer];
    const all = [...inner, ...outer];
    return { R, L: Lf, front, crown, inner, outer, px, path: (g) => { g.beginPath(); this.spline(g, all); } };
  },
  /* saç akış çizgileri: ayrımdan iki yana yelpaze ya da saç çizgisinden tepeye (geriye taranmış) */
  capFlows(P, S, G, r) {
    const { top, fw, hl } = P, V = S.vol, px = G.px, N = 60 + V * 4;
    const wave = S.wavy ? 1.6 : 0;
    if (S.part == null) {
      const A = this.sample(G.inner, N), B = this.sample(G.outer.slice().reverse(), N);
      return A.map((p, i) => {
        const q = B[i], j = (r() - 0.5) * 1.6, mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2, ox = (mx - 100) * 0.08;
        return this.sample([[p[0] + j * 0.3, p[1]], [mx + ox + j, my - 1.5], [q[0] + j, q[1]]], 12);
      });
    }
    const rA = [[px, hl + 0.6], ...G.front.filter(p => p[0] > px + 1).reverse(), ...G.R.inner.slice().reverse()];
    const rB = [[px + 1, top - V - 2.2], ...G.crown.filter(p => p[0] > px + 3), ...G.R.outer];
    const lA = [[px, hl + 0.6], ...G.front.filter(p => p[0] < px - 1), ...G.L.inner.slice().reverse()];
    const lB = [[px - 1, top - V - 2.2], ...G.crown.filter(p => p[0] < px - 3).reverse(), ...G.L.outer];
    const wr = 100 + fw - px, wl = px - (100 - fw), nr = Math.round(N * wr / (wr + wl));
    const m = (S.fall || 0) > 40 ? 24 : 16;
    return [...this.fan(rA, rB, nr, r, wave, m), ...this.fan(lA, lB, N - nr, r, wave, m)];
  },
  /* iki kılavuz arasında n akış çizgisi (wave: dalgalı saç) */
  fan(A, B, n, r, wave = 0, m = 16) {
    const a = this.sample(A, m), b = this.sample(B, m), out = [];
    for (let i = 0; i < n; i++) {
      const t = clamp((i + r() * 0.9) / n, 0, 1), ph = r() * TAU;
      let line = a.map((p, k) => [lerp(p[0], b[k][0], t), lerp(p[1], b[k][1], t)]);
      if (wave) line = line.map((p, k) => {
        const q = line[Math.max(0, k - 1)], s = line[Math.min(m - 1, k + 1)], dx = s[0] - q[0], dy = s[1] - q[1], d = Math.hypot(dx, dy) || 1, w = Math.sin(ph * 0.2 + k * 0.85) * wave * Math.min(1, k / 3);
        return [p[0] - dy / d * w, p[1] + dx / d * w];
      });
      out.push(line);
    }
    return out;
  },
  /* tutam: kökte ince, ortada dolgun, uca doğru sivrilen şerit; gölge kenarı ve orta parıltı */
  clump(g, line, w, col, hi, shd) {
    const n = line.length, Lp = [], Rp = [];
    for (let i = 0; i < n; i++) {
      const a = line[Math.max(0, i - 1)], b = line[Math.min(n - 1, i + 1)];
      let dx = b[0] - a[0], dy = b[1] - a[1]; const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d;
      const t = i / (n - 1), hw = w * Math.min(1, 0.45 + t * 2.4) * (1 - Math.pow(t, 1.7) * 0.88);
      Lp.push([line[i][0] - dy * hw, line[i][1] + dx * hw]); Rp.push([line[i][0] + dy * hw, line[i][1] - dx * hw]);
    }
    g.fillStyle = col; g.beginPath(); g.moveTo(Lp[0][0], Lp[0][1]);
    for (const p of Lp) g.lineTo(p[0], p[1]);
    for (let i = n - 1; i >= 0; i--) g.lineTo(Rp[i][0], Rp[i][1]);
    g.closePath(); g.fill();
    g.lineCap = 'round'; g.lineJoin = 'round';
    g.strokeStyle = shd; g.lineWidth = w * 0.3; g.globalAlpha = 0.4;
    g.beginPath(); Rp.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.stroke();
    g.strokeStyle = hi; g.lineWidth = w * 0.32; g.globalAlpha = 0.38;
    g.beginPath(); line.forEach((p, i) => { const x = lerp(p[0], Lp[i][0], 0.4), y = lerp(p[1], Lp[i][1], 0.4); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke();
    g.globalAlpha = 1;
  },
  /* saç kütlesi: koyu taban, hacim, tutamlar, ince teller, başın eğrisini izleyen parlama */
  paintHair(g, P, path, lines, o = {}) {
    const h = P.hair, r = this.rng(o.seed || 7);
    path(g); g.fillStyle = this.sh(h, -0.42); g.fill();
    g.save(); path(g); g.clip();
    g.fillStyle = this.lin(g, 66, P.top - 12, 136, P.cy + 34, [[0, this.hi(h, 0.06, 0.55)], [0.5, this.sh(h, -0.15, 0.2)], [1, this.sh(h, -0.6, 0.7)]]);
    g.fillRect(0, 0, 200, 260);
    const lit = (x, y) => clamp(0.68 - (x - 94) / 64 - (y - P.top) / 170, 0, 1);
    for (const line of lines) {
      const mp = line[(line.length / 2) | 0], v = clamp(lit(mp[0], mp[1]) * 0.8 + (r() - 0.5) * 0.4, 0, 1);
      this.clump(g, line, (o.w || 2.2) * (0.7 + r() * 0.6), this.mix(this.sh(h, -0.34), this.hi(h, 0.14), v), this.mix(h, this.hi(h, 0.42), v), this.sh(h, -0.62));
    }
    // ince teller (açık ve koyu gruplar halinde tek seferde)
    g.lineCap = 'round'; g.lineJoin = 'round';
    const TB = new Map();
    for (const line of lines) {
      const L = lit(line[0][0], line[0][1]);
      for (let s = 0; s < 2; s++) {
        const off = (r() - 0.5) * 1.8, key = r() < 0.45 + L * 0.35 ? 1 + Math.min(2, (L * 3) | 0) : 0;
        let p = TB.get(key); if (!p) TB.set(key, (p = new Path2D()));
        line.forEach((q, i) => {
          const a = line[Math.max(0, i - 1)], b = line[Math.min(line.length - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1, x = q[0] - dy / d * off, y = q[1] + dx / d * off;
          i ? p.lineTo(x, y) : p.moveTo(x, y);
        });
      }
    }
    for (const [key, p] of TB) { g.strokeStyle = key ? this.hi(h, 0.22 + key * 0.07) : this.sh(h, -0.5); g.globalAlpha = 0.26; g.lineWidth = 0.34; g.stroke(p); }
    g.globalAlpha = 1;
    // parlama bandı: başın kubbesini izleyen yay, ışık tarafında daha güçlü
    if (o.sheen) {
      const [cx, cyy, rx, ry, al] = o.sheen;
      g.save(); g.beginPath(); g.ellipse(cx, cyy, rx, ry, 0, 0, TAU); g.ellipse(cx, cyy, rx * 0.8, ry * 0.8, 0, 0, TAU); g.clip('evenodd');
      g.beginPath(); g.rect(0, 0, 200, P.cy - 24); g.clip();   // yalnızca tepede, yanlara inmesin
      g.fillStyle = this.lin(g, cx - rx, 0, cx + rx * 0.6, 0, [[0, 'rgba(0,0,0,0)'], [0.35, 'rgba(0,0,0,1)'], [0.7, 'rgba(0,0,0,1)'], [1, 'rgba(0,0,0,0)']]);
      const SB = [new Path2D(), new Path2D(), new Path2D()];
      for (const line of lines) {
        const m2 = line[(line.length / 2) | 0], w = clamp(1.15 - Math.abs(m2[0] - (cx - rx * 0.25)) / rx, 0, 1) * (0.4 + r() * 0.6), p = SB[Math.min(2, (w * 3) | 0)];
        line.forEach((q, i) => (i ? p.lineTo(q[0], q[1]) : p.moveTo(q[0], q[1])));
      }
      SB.forEach((p, i) => { g.strokeStyle = this.hi(h, 0.38 + i * 0.06); g.globalAlpha = al * [0.2, 0.45, 0.75][i]; g.lineWidth = 0.75; g.stroke(p); });
      g.globalAlpha = 1;
      g.restore();
    }
    if (o.ao) o.ao(g);
    g.restore();
  },
  /* bukle: aşağı doğru üst üste binen küçük halkalar; üst solda parıltı, alt sağda gölge */
  coil(g, P, x, y, s, ph, k, lit) {
    const h = P.hair;
    for (let j = 0; j < k; j++) {
      const cx = x + Math.sin(ph + j * 1.5) * s * 0.3, yy = y + j * s * 0.66;
      g.fillStyle = this.mix(this.sh(h, -0.42), this.sh(h, -0.02), lit * 0.85);
      g.beginPath(); g.ellipse(cx, yy, s * 0.62, s * 0.48, 0.35, 0, TAU); g.fill();
      g.strokeStyle = this.mix(this.sh(h, 0), this.hi(h, 0.42), lit); g.lineWidth = s * 0.2; g.globalAlpha = 0.85;
      g.beginPath(); g.ellipse(cx, yy, s * 0.42, s * 0.3, 0.35, Math.PI * 1.05, Math.PI * 1.8); g.stroke();
      g.strokeStyle = this.sh(h, -0.65); g.lineWidth = s * 0.16; g.globalAlpha = 0.55;
      g.beginPath(); g.ellipse(cx, yy, s * 0.56, s * 0.42, 0.35, Math.PI * 0.05, Math.PI * 0.85); g.stroke();
      g.globalAlpha = 1;
    }
  },
  /* spiral bukle (tirbuşon): aynı yöne eğik, üst üste binen halkalar; uca doğru incelir */
  ringlet(g, P, x, y, len, w, lean, lit0) {
    const h = P.hair, step = w * 0.6, n = Math.max(2, Math.round(len / step));
    for (let j = 0; j < n; j++) {
      const t = j / n, ww = w * (1 - t * 0.45), cx = x + Math.sin(j * 0.7) * w * 0.12 + lean * j * step * 0.25, yy = y + j * step, lit = clamp(lit0 - t * 0.25, 0, 1);
      g.fillStyle = this.sh(h, -0.66); g.beginPath(); g.ellipse(cx + ww * 0.08, yy + step * 0.12, ww * 0.62, step * 0.85, -0.55, 0, TAU); g.fill();
      g.fillStyle = this.mix(this.sh(h, -0.4), h, lit); g.beginPath(); g.ellipse(cx, yy, ww * 0.56, step * 0.76, -0.55, 0, TAU); g.fill();
      g.fillStyle = this.mix(this.sh(h, -0.12), this.hi(h, 0.3), lit); g.beginPath(); g.ellipse(cx - ww * 0.12, yy - step * 0.18, ww * 0.34, step * 0.42, -0.55, 0, TAU); g.fill();
      g.strokeStyle = this.hi(h, 0.12 + lit * 0.35); g.globalAlpha = 0.55; g.lineWidth = ww * 0.11;
      g.beginPath(); g.ellipse(cx, yy, ww * 0.42, step * 0.56, -0.55, Math.PI * 0.95, Math.PI * 1.55); g.stroke();
      g.globalAlpha = 1;
    }
  },
  /* bir bölgeyi yukarıdan sarkan buklelerle doldur */
  paintRinglets(g, P, path, box, w, seed, y1) {
    const h = P.hair, r = this.rng(seed), [x0, y0, x1, yb] = box;
    path(g); g.fillStyle = this.sh(h, -0.55); g.fill();
    const cols = [];
    for (let x = x0 + w * 0.4; x < x1; x += w * 0.72) for (let y = y0; y < yb - w; y += w * 3.2) cols.push([x + (r() - 0.5) * w * 0.4, y + (r() - 0.5) * w]);
    path(g);
    const ok = cols.filter(([x, y]) => this.inPath(g, x, y + w));
    g.save(); path(g); g.clip();
    for (const [x, y] of ok) this.ringlet(g, P, x, y, Math.min((y1 || yb) - y, w * (4 + r() * 3)), w * (0.85 + r() * 0.3), (x - 100) / 60, clamp(0.66 - (x - 94) / 64 - (y - P.top) / 170, 0, 1));
    g.restore();
  },
  paintCurls(g, P, path, box, size, seed) {
    const h = P.hair, r = this.rng(seed), [x0, y0, x1, y1] = box, n = Math.round((x1 - x0) * (y1 - y0) / (size * size * 0.9));
    path(g); g.fillStyle = this.sh(h, -0.5); g.fill();
    path(g);
    const pts = [];
    for (let i = 0; i < n * 4 && pts.length < n; i++) { const x = lerp(x0, x1, r()), y = lerp(y0, y1, r()); if (this.inPath(g, x, y)) pts.push([x, y, size * (0.75 + r() * 0.5), r() * TAU, 2 + ((r() * 3) | 0)]); }
    pts.sort((a, b) => a[1] - b[1]);
    for (const [x, y, s, ph, k] of pts) this.coil(g, P, x, y, s, ph, k, clamp(0.66 - (x - 94) / 64 - (y - P.top) / 170, 0, 1));
  },
  /* omza sarkan saç (yüzün arkasından çıkar, omzun önüne düşer) */
  fallGeo(P, S, k) {
    const { cy, fw } = P, Vs = S.vs, X = (d) => 100 + k * d, ex = (y) => this.ex(P, y), F = cy + S.fall, w = S.wavy ? 2.4 : 0, ox = fw + 8 + Vs * 0.85;
    const outer = [[X(fw + 4 + Vs), cy - 12], [X(fw + 8 + Vs), cy + 4]];
    for (let y = cy + 18, i = 0; y < F - 8; y += 14, i++) outer.push([X(ox + 1 + Math.min(3, (y - cy) / 20) + (i % 2 ? w : -w)), y]);
    outer.push([X(ox + 2.5), F - 3]);
    const tips = [[X(ox - 0.5), F + 2.5], [X(ox - 4.5), F - 1], [X(ox - 8), F + 3.5], [X(ox - 11.5), F]];
    const inner = F > cy + 46 ? [[X(18), F - 6], [X(17), cy + 50], [X(ex(cy + 34) - 2.5), cy + 34], [X(ex(cy + 14) - 4), cy + 14], [X(fw - 7), cy - 10]]
      : [[X(ex(F - 2) - 3), F - 3], [X(ex(cy + 10) - 4), cy + 10], [X(fw - 7), cy - 10]];
    const pts = [...outer, ...tips, ...inner];
    return { A: [...outer, tips[0]], B: [...inner].reverse().concat([tips[tips.length - 1]]), path: (g) => { g.beginPath(); this.spline(g, pts); } };
  },
  /* gövdenin arkasında kalan uzun saç ve at kuyruğu */
  hairBehind(ctx, P) {
    const S = P.S, h = P.hair, cy = P.cy, fw = P.fw;
    if ((S.fall || 0) >= 50) {
      const W = fw + 6 + S.vs * 0.6, B = cy + Math.min(S.fall, 72);
      const path = (g) => { g.beginPath(); this.spline(g, [[100 - W, cy - 18], [100 - W - 2, cy + 20], [100 - W + 2, B], [100, B + 4], [100 + W - 2, B], [100 + W + 2, cy + 20], [100 + W, cy - 18], [100 + W * 0.6, cy - 52], [100, cy - 60], [100 - W * 0.6, cy - 52]]); };
      this.layer(ctx, (g) => {
        if (S.curly) { this.paintRinglets(g, P, path, [100 - W - 4, cy - 40, 100 + W + 4, B + 4], 6.5, 13); return; }
        this.paintHair(g, P, path, this.fan([[100 - W, cy - 30], [100 - W - 2, cy + 20], [100 - W + 2, B]], [[100 + W, cy - 30], [100 + W + 2, cy + 20], [100 + W - 2, B]], 30, this.rng(17)), { seed: 19 });
        g.fillStyle = 'rgba(20,10,4,0.35)'; path(g); g.fill();
      }, path, 0.8);
    }
    if (S.tail && !P.f) {
      const path = (g) => { g.beginPath(); this.spline(g, [[108, cy + 4], [124, cy + 24], [126, cy + 56], [121, cy + 76], [115, cy + 74], [118, cy + 50], [114, cy + 26], [104, cy + 12]]); };
      this.layer(ctx, (g) => this.paintHair(g, P, path, this.fan([[108, cy + 4], [124, cy + 26], [125, cy + 58], [121, cy + 76]], [[104, cy + 12], [114, cy + 28], [117, cy + 52], [115, cy + 74]], 12, this.rng(21)), { seed: 23, w: 1.6 }), path, 0.6);
    }
  },
  /* yüzün arkasından öne düşen saç, ense toplaması ve örgüler (baştan önce çizilir) */
  hairFall(ctx, P) {
    const S = P.S, cy = P.cy, fw = P.fw;
    if (S.fall) {
      const sides = S.side === 'sweep' ? [1] : [-1, 1];
      for (const k of sides) {
        const G = this.fallGeo(P, S, k);
        this.layer(ctx, (g) => {
          if (S.curly) { const xs = [100 + k * 14, 100 + k * (fw + 14 + S.vs)].sort((a, b) => a - b); this.paintRinglets(g, P, G.path, [xs[0], cy - 14, xs[1], cy + S.fall + 4], 6.2, 31 + k); return; }
          this.paintHair(g, P, G.path, this.fan(G.A, G.B, 30, this.rng(33 + k), S.wavy ? 2 : 0), { seed: 35 + k, w: 2.4 });
        }, S.curly ? null : G.path, 0.7);
      }
    }
    if (S.braid) for (const k of S.braid) this.braid(ctx, P, k);
  },
  /* örgü: kulağın arkasından başlar, omzun önüne düşer; üst üste binen eğik düğümler */
  braid(ctx, P, k) {
    const { hair: h, cy, fw, f } = P, cols = this.hairCols(h);
    const x0 = 100 + k * (fw - 3), y0 = cy + 6, x1 = 100 + k * (f ? 38 : 35), y1 = cy + (f ? 110 : 98), n = 13;
    this.layer(ctx, (g) => {
      // örgünün altındaki koyu gövde (düğümler arasında boşluk kalmasın)
      g.strokeStyle = this.sh(h, -0.55); g.lineCap = 'round'; g.lineJoin = 'round';
      for (let i = 0; i < n - 1; i++) { const t = i / (n - 1), t2 = (i + 1) / (n - 1); g.lineWidth = 6.8 - t * 3; g.beginPath(); g.moveTo(lerp(x0, x1, t) + Math.sin(t * 2.6) * 2.4 * k, lerp(y0, y1, t) + 3); g.lineTo(lerp(x0, x1, t2) + Math.sin(t2 * 2.6) * 2.4 * k, lerp(y0, y1, t2) + 3); g.stroke(); }
      for (let i = 0; i < n; i++) {
        const t = i / (n - 1), x = lerp(x0, x1, t) + Math.sin(t * 2.6) * 2.4 * k, y = lerp(y0, y1, t), w = 8.4 - t * 3.2, seg = (y1 - y0) / (n - 1), s = i % 2 ? 1 : -1;
        const lobe = () => { g.beginPath(); g.ellipse(x + s * w * 0.24, y + seg * 0.5, w * 0.6, seg * 0.95, s * 0.62, 0, TAU); };
        this.fillClip(g, lobe, this.sh(h, -0.15), () => {
          g.fillStyle = this.lin(g, x - s * w, y, x + s * w, y + seg * 1.5, [[0, this.hi(h, 0.25)], [0.55, this.sh(h, -0.05)], [1, this.sh(h, -0.6)]]); g.fillRect(x - 10, y - 6, 20, seg * 2 + 10);
          this.strands(g, [[x - s * w * 0.6, y - seg * 0.4], [x - s * w * 0.2, y], [x + s * w * 0.3, y + seg * 0.7], [x + s * w * 0.7, y + seg * 1.3]], [[x - s * w * 0.1, y - seg * 0.6], [x + s * w * 0.3, y - seg * 0.2], [x + s * w * 0.8, y + seg * 0.4], [x + s * w * 1.1, y + seg]], 9, cols, 0.45, 0.7, 311 + i * 5 + k, 0.4);
        });
      }
      // uçta bağ ve püskül
      this.strands(g, [[x1 - 2.2, y1 + 6], [x1 - 2.6, y1 + 10], [x1 - 3, y1 + 13], [x1 - 3.6, y1 + 17]], [[x1 + 2.2, y1 + 6], [x1 + 2.6, y1 + 10], [x1 + 3, y1 + 13], [x1 + 3.6, y1 + 17]], 18, cols, 0.6, 0.9, 341 + k, 0.6);
      this.fillClip(g, () => { g.beginPath(); g.ellipse(x1, y1 + 5.4, 3.2, 1.8, 0, 0, TAU); }, '#7a2a24', () => this.soft(g, x1 - 1, y1 + 4.8, 1.6, 0.8, '#d07060', 0.8));
    });
  },
  /* başın üstündeki saç: alın, şakak ve favori; topuz; saç çizgisinde ince tüyler */
  hairCap(ctx, P) {
    const S = P.S, { hair: h, cy, fw, top } = P, G = this.capGeo(P, S), V = S.vol;
    const hatClip = (g) => { if (P.hat) { g.beginPath(); g.rect(0, P.hatLine, 200, 300); g.clip(); } };
    if (S.buzz) {
      this.layer(ctx, (g) => {
        hatClip(g);
        G.path(g); g.fillStyle = this.mix(P.skin, h, 0.55, 0.8); g.fill();
        this.stipple(g, () => G.path(g), 1500, this.sh(h, -0.1), 0.65, 101, [100 - fw - 3, top - 4, 100 + fw + 3, cy + 2], 0.9);
        this.clip(g, () => G.path(g), () => this.soft(g, 88, top + 10, 14, 7, '#ffffff', 0.2));
      }, G.path, 0.6);
      return;
    }
    const r = this.rng(121 + P.hs * 13);
    this.layer(ctx, (g) => {
      hatClip(g);
      if (S.curly && !P.f) { this.paintCurls(g, P, G.path, [100 - fw - V - 4, top - V - 6, 100 + fw + V + 4, cy + 4], 2.5, 117); return; }
      const lines = this.capFlows(P, S.curly ? Object.assign({}, S, { wavy: 1.6 }) : S, G, r);
      this.paintHair(g, P, G.path, lines, {
        seed: 131 + P.hs, w: S.side === 'short' ? 1.9 : 2.3,
        sheen: [100, cy - 16, fw + S.vs + 3, (cy - 16) - (top - V - 3), S.shine ? 0.95 : 0.6],
        ao: (g2) => { this.soft(g2, 126, cy - 18, 12, 26, this.sh(h, -0.6), 0.45); if (S.pomp) this.soft(g2, 100, P.hl - 2, 24, 4, this.sh(h, -0.6), 0.5); },
      });
      // ayrım çizgisi
      if (S.part != null) {
        const px = G.px;
        g.lineCap = 'round';
        g.strokeStyle = this.sh(h, -0.6); g.globalAlpha = 0.35; g.lineWidth = 0.7;
        g.beginPath(); g.moveTo(px, P.hl + 0.8); g.quadraticCurveTo(px + (px - 100) * 0.1 - 0.6, P.hl - 9, px + (px - 100) * 0.14, top - V * 0.2); g.stroke();
        g.strokeStyle = this.mix(P.skin, h, 0.35); g.globalAlpha = 0.22; g.lineWidth = 0.3; g.stroke();
        g.globalAlpha = 1;
      }
      if (S.curly) {
        // yanlarda, yüzün kenarının dışında sarkan spiral bukleler
        G.path(g);
        const rr2 = this.rng(171), F = cy + S.fall, pts = [];
        for (const k of [-1, 1]) for (let x = fw + 1; x < fw + 16 + S.vs; x += 4.6) for (let y = cy - 22; y < F - 14; y += 15) pts.push([100 + k * (x + (rr2() - 0.5) * 2), y + (rr2() - 0.5) * 5, k]);
        const ok = pts.filter(([x, y]) => this.inPath(g, x, y + 4));
        g.save(); G.path(g); g.clip();
        for (const [x, y, k] of ok) this.ringlet(g, P, x, y, Math.min(F - y, 24 + rr2() * 20), 5.6 + rr2() * 1.4, k * 0.25, k < 0 ? 0.65 : 0.25);
        g.restore();
      }
    }, S.curly && !P.f ? null : G.path, 0.65);
    // saç çizgisinde ince tüyler ve tepede kabaran teller (sert vektör kenarını kırar)
    if (!S.curly) {
      const rr = this.rng(151 + P.hs), edge = this.sample(G.front, 30), crown = this.sample(G.crown, 24);
      ctx.save(); if (P.hat) { ctx.beginPath(); ctx.rect(0, P.hatLine, 200, 300); ctx.clip(); }
      ctx.lineCap = 'round';
      for (const [x, y] of edge) { const a = Math.PI / 2 + (x - 100) * 0.03 + (rr() - 0.5) * 0.6, l = 0.8 + rr() * 1.4; ctx.strokeStyle = this.sh(h, -0.2); ctx.globalAlpha = 0.18 + rr() * 0.22; ctx.lineWidth = 0.25 + rr() * 0.2; ctx.beginPath(); ctx.moveTo(x, y - 0.6); ctx.lineTo(x + Math.cos(a) * l, y - 0.6 + Math.sin(a) * l); ctx.stroke(); }
      for (const [x, y] of crown) { if (rr() < 0.5) continue; const a = -Math.PI / 2 + (x - 100) * 0.04 + (rr() - 0.5) * 1.2, l = 1.5 + rr() * 2.5; ctx.strokeStyle = this.hi(h, 0.1); ctx.globalAlpha = 0.15 + rr() * 0.2; ctx.lineWidth = 0.25; ctx.beginPath(); ctx.moveTo(x, y + 1); ctx.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + 1, y + 1 + Math.sin(a) * l * 0.5, x + Math.cos(a) * l, y + 1 + Math.sin(a) * l); ctx.stroke(); }
      ctx.restore();
    }
    // topuz (şapkasızken)
    if (S.bun) {
      const rr = S.pomp ? 14 : 11.5, y = top - V - (S.pomp ? 8 : 5);
      const bun = (g) => { g.beginPath(); g.ellipse(100, y, rr + 3, rr, 0, 0, TAU); };
      this.soft(ctx, 100, y + rr - 1, rr, 2.4, this.sh(h, -0.6), 0.4);
      this.layer(ctx, (g) => {
        this.fillClip(g, () => bun(g), this.sh(h, -0.2), () => {
          g.fillStyle = this.rad(g, 94, y - 5, 1, 100, y, rr + 4, [[0, this.hi(h, 0.3)], [0.6, this.sh(h, -0.1)], [1, this.sh(h, -0.55)]]); g.fillRect(80, y - rr - 4, 40, rr * 2 + 8);
          const cols = this.hairCols(h);
          for (let tw = 0; tw < 5; tw++) {
            const a0 = tw * TAU / 5, A = [], B = [];
            for (let q = 0; q < 4; q++) { const a = a0 + q * 0.9, rad = (rr + 2) * (1 - q * 0.22); A.push([100 + Math.cos(a) * rad * 1.15, y + Math.sin(a) * rad]); const b = a + 0.5, rb = rad * 0.75; B.push([100 + Math.cos(b) * rb * 1.15, y + Math.sin(b) * rb]); }
            this.strands(g, A, B, 14, cols, 0.7, 0.6, 181 + tw, 0.6);
            this.soft(g, 100 + Math.cos(a0 + 0.4) * rr * 0.7, y + Math.sin(a0 + 0.4) * rr * 0.6, 3, 5, this.sh(h, -0.55), 0.35, a0);
          }
          this.soft(g, 94, y - 5, 7, 4, this.hi(h, 0.45), 0.45);
        });
      }, bun, 0.5);
    }
  },

  /* ---------------- sakal ---------------- */
  /* sakal: yumuşak kenarlı taban ve kıl yönünde kısa teller (uzun sakalda ayrıca tutamlar) */
  beardPaint(g, P, path, o) {
    const h = P.hair, r = this.rng(o.seed), cols = this.hairCols(h), [x0, y0, x1, y1] = o.box, base = o.base == null ? 0.9 : o.base;
    path(g); g.fillStyle = this.sh(h, -0.32, base); g.fill();
    g.save(); path(g); g.clip();
    if (o.shade !== false) { this.soft(g, 85, P.cy + 20, 14, 14, this.hi(h, 0.3), 0.3); this.soft(g, 118, P.cy + 30, 14, 24, this.sh(h, -0.6), 0.4); }
    if (o.lines) for (const line of o.lines(r)) { const mp = line[(line.length / 2) | 0], v = clamp(0.65 - (mp[0] - 94) / 50 + (r() - 0.5) * 0.4, 0, 1); this.clump(g, line, 1.6 + r() * 1.1, this.mix(this.sh(h, -0.35), this.hi(h, 0.12), v), this.mix(h, this.hi(h, 0.4), v), this.sh(h, -0.62)); }
    // kıllar renk, saydamlık ve kalınlık gruplarına toplanıp tek seferde çizilir (binlerce ayrı çizim yerine)
    const n = Math.round((x1 - x0) * (y1 - y0) * (o.dens || 1.2)), B = new Map();
    for (let i = 0; i < n; i++) {
      const x = lerp(x0, x1, r()), y = lerp(y0, y1, r()), a = o.dir(x, y) + (r() - 0.5) * 0.6, l = (o.len || 2.6) * (0.55 + r() * 0.8), b = (r() - 0.5) * l * 0.6;
      const L = clamp(0.62 - (x - 96) / 50 - (y - y0) / Math.max(10, y1 - y0) * 0.35, 0, 1);
      const key = clamp(Math.round(L * 3.4 + r() * 2.2 - 0.4), 0, 5) * 6 + ((r() * 3) | 0) * 2 + (r() < 0.5 ? 0 : 1);
      let p = B.get(key); if (!p) B.set(key, (p = new Path2D()));
      const x2 = x + Math.cos(a) * l, y2 = y + Math.sin(a) * l;
      p.moveTo(x, y); p.quadraticCurveTo((x + x2) / 2 - Math.sin(a) * b, (y + y2) / 2 + Math.cos(a) * b, x2, y2);
    }
    g.lineCap = 'round';
    for (const [key, p] of B) {
      g.strokeStyle = cols[(key / 6) | 0]; g.globalAlpha = (o.al || 0.75) * [0.55, 0.75, 0.95][((key % 6) / 2) | 0]; g.lineWidth = (o.lw || 0.42) * (key % 2 ? 1.15 : 0.8);
      g.stroke(p);
    }
    g.globalAlpha = 1;
    g.restore();
  },
  beard(ctx, P) {
    const L = P.look, b = L.beard | 0;
    if (P.f || !b) return;
    const bl = L.beardLen === undefined ? 1 : L.beardLen;
    if (bl <= 0.05) return;
    const { cy, fw } = P, ex = (y) => this.ex(P, y), X = (k, d) => 100 + k * d, m = ([x, y]) => [200 - x, y];
    const ny = cy + 18, my = cy + 29;
    const path = (...ps) => (g) => { g.beginPath(); for (const pts of ps) this.spline(g, pts); };
    // kıl yönü: yanakta aşağı ve çeneye doğru, bıyıkta ortadan dışa
    const dir = (x, y) => Math.PI / 2 + clamp((x - 100) / 26, -1, 1) * (y < cy + 12 ? 0.18 : 0.42);
    const mdir = (x) => (x >= 100 ? 0.55 : Math.PI - 0.55);
    const draw = (pf, o, fr = 0.9) => this.layer(ctx, (g) => this.beardPaint(g, P, pf, o), pf, fr);
    // tam sakal bölgesi: favoriden çene altına; üst sınır elmacıktan ağız köşesine
    const full = (Lx, out) => {
      const R = [[X(1, ex(cy - 2) - 3.4), cy - 2], [X(1, ex(cy - 2) + 0.5), cy - 2], [X(1, ex(cy + 12) + out), cy + 12], [X(1, ex(cy + 24) + out), cy + 24], [X(1, ex(cy + 32) + out * 0.9), cy + 32], [X(1, 12 + out * 0.5), cy + 42.5 + Lx * 0.5], [X(1, 5), cy + 45.5 + Lx * 0.92]];
      const In = [[X(1, ex(cy + 8) - 5.6), cy + 8], [X(1, 20.5), cy + 19.5], [X(1, 15.8), cy + 27.4], [X(1, 12.4), cy + 31.6], [X(1, 6.5), cy + 33.8]];
      return [...R, [100, cy + 46.5 + Lx], ...R.slice().reverse().map(m), ...In.map(m), [100, cy + 34.4], ...In.slice().reverse()];
    };
    const must = (kind) => {
      const side = (k) => {
        if (kind === 'walrus') return [[X(k, 0.5), ny + 3], [X(k, 8), ny + 1.6], [X(k, 15), ny + 4.6], [X(k, 17.6), my + 4], [X(k, 15.6), my + 8.4], [X(k, 10), my + 6.2], [X(k, 4), my + 4.6], [X(k, 0.5), my + 4.2]];
        if (kind === 'handle' || kind === 'goat') { const c = kind === 'handle' ? 1 : 0.55; return [[X(k, 0.5), ny + 3.6], [X(k, 6), ny + 2.8], [X(k, 12), ny + 5], [X(k, 15), my - 0.4], [X(k, 17.5 + c), my - 0.6], [X(k, 19.5 + c * 2), my - 2.5 - c * 4], [X(k, 20.8 + c * 1.6), my - 1.6 - c * 1.6], [X(k, 18.6), my + 1.8], [X(k, 13), my + 1.6], [X(k, 6), my - 0.6], [X(k, 0.5), my - 1.2]]; }
        return [[X(k, 0.5), ny + 3.4], [X(k, 7), ny + 2.8], [X(k, 13), ny + 5.4], [X(k, 15.6), my + 0.6], [X(k, kind === 'chops' ? 16.5 : 15.4), my + (kind === 'chops' ? 5 : 3.6)], [X(k, 12.5), my + 2], [X(k, 6), my - 0.2], [X(k, 0.5), my - 0.9]];
      };
      const pf = path(side(1), side(-1));
      draw(pf, { seed: 61, box: [100 - 25, ny, 100 + 25, my + 10], dir: (x) => mdir(x), len: kind === 'walrus' ? 3 : 2.2, dens: 2.4, lw: 0.4, al: 0.85 }, 0.45);
    };
    if (b === 3) {
      // kirli sakal: hafif renk ve sık, çok kısa kıllar; kenarları iyice yumuşak
      const lip = [[100, ny + 3.2], [X(1, 7), ny + 2.6], [X(1, 13), ny + 5.2], [X(1, 15), my - 0.6], [X(1, 12), my - 1.6], [X(1, 5), my - 2.2], [100, my - 1.8], [X(-1, 5), my - 2.2], [X(-1, 12), my - 1.6], [X(-1, 15), my - 0.6], [X(-1, 13), ny + 5.2], [X(-1, 7), ny + 2.6]];
      draw(path(full(0, 0.3), lip), { seed: 71, box: [100 - fw - 2, cy - 4, 100 + fw + 2, cy + 48], dir, len: 0.9, dens: 3, lw: 0.3, al: 0.55, base: 0.16, shade: false }, 1.6);
    }
    if (b === 4 || b === 8) {
      const Lx = b === 4 ? 5 + bl * 18 : 1 + bl * 3, out = b === 4 ? 1.8 : 0.8;
      draw(path(full(Lx, out)), {
        seed: 81 + b, box: [100 - fw - 3, cy - 4, 100 + fw + 3, cy + 48 + Lx], dir, len: b === 4 ? 3 : 1.7, dens: b === 4 ? 1.1 : 1.8,
        lines: b === 4 ? (r) => { const out2 = []; for (let i = 0; i < 26; i++) { const t = i / 25, sx = lerp(100 - 26, 100 + 26, t) + (r() - 0.5) * 2, ex2 = lerp(100 - 10, 100 + 10, t) + (r() - 0.5) * 3; out2.push(this.sample([[sx, cy + 26 + Math.abs(t - 0.5) * 8], [lerp(sx, ex2, 0.5) + (sx - 100) * 0.12, cy + 38 + Lx * 0.4], [ex2, cy + 44 + Lx * (0.9 - Math.abs(t - 0.5) * 0.5)]], 10)); } return out2; } : null,
      });
      must('full');
    }
    if (b === 5) {
      // favori: kulak önünden yanağa yayılan gür sakal, ağız köşesinde bıyığa bağlanır; çene açık
      const chop = (k) => [[X(k, ex(cy - 14) - 3.4), cy - 14], [X(k, ex(cy - 14) + 0.5), cy - 14], [X(k, ex(cy + 4) + 1.1), cy + 4], [X(k, ex(cy + 20) + 1.4), cy + 20], [X(k, ex(cy + 30) + 1.2), cy + 30], [X(k, 21), cy + 38.6], [X(k, 16.6), cy + 35], [X(k, 15.2), cy + 30.6], [X(k, 18.6), cy + 22], [X(k, ex(cy + 6) - 8), cy + 6], [X(k, ex(cy - 6) - 3.8), cy - 6]];
      draw(path(chop(1), chop(-1)), { seed: 91, box: [100 - fw - 3, cy - 16, 100 + fw + 3, cy + 42], dir, len: 2.6, dens: 1.4 });
      must('chops');
    }
    if (b === 7) {
      // çene sakalı: favoriden çene altına ince bant, bıyıksız
      const Lx = bl * 2;
      const O = [[X(1, ex(cy - 4) + 0.6), cy - 4], [X(1, ex(cy + 12) + 1), cy + 12], [X(1, ex(cy + 26) + 1), cy + 26], [X(1, 15), cy + 43 + Lx * 0.6], [X(1, 5), cy + 45.6 + Lx]];
      const I = [[X(1, ex(cy - 4) - 3.2), cy - 4], [X(1, ex(cy + 12) - 4.4), cy + 12], [X(1, ex(cy + 26) - 5.6), cy + 26], [X(1, 13), cy + 38.6], [X(1, 5), cy + 40.4]];
      draw(path([...O, [100, cy + 46 + Lx], ...O.slice().reverse().map(m), ...I.map(m), [100, cy + 40.8], ...I.slice().reverse()]), { seed: 85, box: [100 - fw - 2, cy - 6, 100 + fw + 2, cy + 48 + Lx], dir, len: 2, dens: 1.7 }, 0.7);
    }
    if (b === 2) {
      // keçi sakalı: dudak altı ve çene, sivri uç
      const Lx = 3 + bl * 9, R = [[X(1, 2.4), cy + 33.6], [X(1, 8), cy + 34.6], [X(1, 11), cy + 37.6], [X(1, 9.5), cy + 42 + Lx * 0.45], [X(1, 3.6), cy + 45.5 + Lx * 0.9]];
      draw(path([...R, [100, cy + 47 + Lx], ...R.slice().reverse().map(m)]), { seed: 95, box: [100 - 13, cy + 32, 100 + 13, cy + 48 + Lx], dir: () => Math.PI / 2, len: 2.4, dens: 2 }, 0.6);
      must('goat');
    }
    if (b === 1) must('handle');
    if (b === 6) must('walrus');
  },

  /* ---------------- şapkalar ---------------- */
  /* keçe dokusu ve kenar biyesi olan geniş kenar */
  brim(ctx, P, bw, by, up, hc, opts = {}) {
    const path = () => {
      ctx.beginPath();
      ctx.moveTo(100 - bw, by - up);
      ctx.bezierCurveTo(100 - bw - 3, by - up + 10, 100 - bw * 0.7, by + 6, 100 - bw * 0.4, by + 4.5);
      ctx.quadraticCurveTo(100, by + (opts.dip || 10), 100 + bw * 0.4, by + 4.5);
      ctx.bezierCurveTo(100 + bw * 0.7, by + 6, 100 + bw + 3, by - up + 10, 100 + bw, by - up);
      ctx.bezierCurveTo(100 + bw - 4, by - 2, 100 + bw * 0.6, by - 6, 100, by - 5);
      ctx.bezierCurveTo(100 - bw * 0.6, by - 6, 100 - bw + 4, by - 2, 100 - bw, by - up);
      ctx.closePath();
    };
    this.fillClip(ctx, path, this.css(this.rgb(hc)), () => {
      ctx.fillStyle = this.lin(ctx, 100 - bw, 0, 100 + bw, 0, [[0, this.sh(hc, 0.2)], [0.45, this.sh(hc, 0.02)], [1, this.sh(hc, -0.45)]]); ctx.fillRect(10, by - 30, 180, 50);
      this.soft(ctx, 100, by + 5, bw * 0.55, 4, this.sh(hc, -0.55), 0.7);   // alt yüzey gölgesi
      if (opts.fn) opts.fn(path);
    });
    if (opts.tex !== false) this.texture(ctx, path, 0.2);
    // kenar biyesi
    ctx.strokeStyle = this.sh(hc, opts.bind || -0.35, 0.9); ctx.lineWidth = 0.9; path(); ctx.stroke();
    return path;
  },
  /* tepe (taç) yolunu doldurup keçe gölgeleriyle boyar */
  crown(ctx, P, path, hc, shade) {
    this.fillClip(ctx, path, this.css(this.rgb(hc)), () => {
      ctx.fillStyle = this.lin(ctx, 66, 0, 134, 0, [[0, this.sh(hc, 0.22)], [0.4, this.sh(hc, 0.04)], [1, this.sh(hc, -0.5)]]); ctx.fillRect(50, 0, 100, 120);
      if (shade) shade();
    });
    this.texture(ctx, path, 0.2);
  },
  hatBand(ctx, x0, x1, y, h, col, buckle) {
    ctx.fillStyle = this.lin(ctx, x0, 0, x1, 0, [[0, this.sh(col, 0.15)], [1, this.sh(col, -0.45)]]); ctx.fillRect(x0, y, x1 - x0, h);
    ctx.fillStyle = this.sh(col, -0.5); ctx.fillRect(x0, y + h - 0.8, x1 - x0, 0.8);
    if (buckle) { ctx.strokeStyle = '#c8a860'; ctx.lineWidth = 0.8; ctx.strokeRect(x0 + 10, y + 0.6, 4, h - 1.2); }
  },
  /* kenar altına düşen alın gölgesi */
  hatShadow(ctx, P, depth = 14) {
    const cy = P.cy;
    this.clip(ctx, () => this.headPath(ctx, P), () => {
      ctx.fillStyle = this.lin(ctx, 0, P.hatLine - 4, 0, P.hatLine + depth, [[0, 'rgba(30,14,6,0.6)'], [1, 'rgba(30,14,6,0)']]);
      ctx.fillRect(60, P.hatLine - 6, 80, depth + 12);
    });
  },
  hatDraw(ctx, P) {
    const L = P.look, t = P.hat;
    if (!t) return;
    const hc = L.hatCol || '#3a2a1e', cy = P.cy, by = P.by;
    if (t === 'cowboy' || t === 'wide' || t === 'boss' || t === 'straw') {
      this.hatShadow(ctx, P, t === 'wide' || t === 'straw' ? 20 : 15);
      const straw = t === 'straw', col = straw ? this.mix('#d8bc78', hc, 0.15) : hc;
      const bw = t === 'wide' ? 80 : t === 'straw' ? 74 : t === 'boss' ? 68 : 70, ch = t === 'wide' ? 34 : t === 'straw' ? 30 : t === 'boss' ? 48 : 44;
      // arka kenar (tepenin arkasında görünen)
      this.ell(ctx, 100, by - 5, bw - 8, 13, this.sh(col, -0.4));
      const crownP = () => {
        ctx.beginPath(); ctx.moveTo(67, by);
        if (t === 'cowboy') { ctx.bezierCurveTo(64, by - ch * 0.55, 74, by - ch, 89, by - ch + 1); ctx.quadraticCurveTo(100, by - ch + 8, 111, by - ch + 1); ctx.bezierCurveTo(126, by - ch, 136, by - ch * 0.55, 133, by); }
        else if (t === 'boss') { ctx.bezierCurveTo(66, by - ch * 0.7, 72, by - ch, 100, by - ch); ctx.bezierCurveTo(128, by - ch, 134, by - ch * 0.7, 133, by); }
        else if (straw) { ctx.bezierCurveTo(68, by - ch * 0.9, 78, by - ch, 92, by - ch + 1); ctx.quadraticCurveTo(100, by - ch + 5, 108, by - ch + 1); ctx.bezierCurveTo(122, by - ch, 132, by - ch * 0.9, 133, by); }
        else { ctx.bezierCurveTo(68, by - ch * 0.85, 76, by - ch, 100, by - ch); ctx.bezierCurveTo(124, by - ch, 132, by - ch * 0.85, 133, by); }
        ctx.closePath();
      };
      this.crown(ctx, P, crownP, col, () => {
        if (t === 'cowboy') {
          // çatı çukuru ve yan tutam izleri
          this.soft(ctx, 100, by - ch + 7, 11, 5, this.sh(col, -0.5), 0.75);
          this.soft(ctx, 100, by - ch + 3, 13, 2, this.sh(col, 0.3), 0.4);
          this.soft(ctx, 81, by - ch * 0.5, 4, 11, this.sh(col, -0.35), 0.6); this.soft(ctx, 119, by - ch * 0.5, 4, 11, this.sh(col, -0.5), 0.6);
          this.soft(ctx, 77, by - ch * 0.5, 3, 10, this.sh(col, 0.3), 0.4);
        }
        if (straw) {
          // hasır örgüsü
          ctx.strokeStyle = this.sh(col, -0.35, 0.5); ctx.lineWidth = 0.6;
          for (let y = by - ch; y < by; y += 2.6) { ctx.beginPath(); ctx.moveTo(60, y); ctx.lineTo(140, y + 1); ctx.stroke(); }
          ctx.strokeStyle = this.sh(col, 0.3, 0.35);
          for (let x = 62; x < 140; x += 3) { ctx.beginPath(); ctx.moveTo(x, by - ch); ctx.lineTo(x + 1, by); ctx.stroke(); }
        }
        this.soft(ctx, 83, by - ch * 0.62, 12, 20, this.sh(col, 0.25), 0.5);
      });
      const band = straw ? (this.lum(hc) > 0.6 ? '#3a2a1e' : hc) : t === 'boss' ? this.sh(hc, -0.45) : '#b89468';
      this.clip(ctx, crownP, () => this.hatBand(ctx, 60, 140, by - 10, straw ? 6 : 5.5, band, t === 'cowboy'));
      const up = t === 'cowboy' ? 15 : t === 'boss' ? 2 : t === 'straw' ? 4 : 4;
      this.brim(ctx, P, bw, by, up, col, {
        dip: t === 'boss' ? 6 : 10, tex: !straw,
        fn: straw ? () => {
          ctx.strokeStyle = this.sh(col, -0.35, 0.45); ctx.lineWidth = 0.6;
          for (let r = 0; r < 7; r++) { ctx.beginPath(); ctx.ellipse(100, by + 1, 40 + r * 5, 6 + r * 0.8, 0, 0, TAU); ctx.stroke(); }
          ctx.strokeStyle = this.sh(col, 0.3, 0.3);
          for (let a = 0; a < TAU; a += 0.09) { ctx.beginPath(); ctx.moveTo(100 + Math.cos(a) * 34, by + 1 + Math.sin(a) * 5); ctx.lineTo(100 + Math.cos(a) * 80, by + 1 + Math.sin(a) * 12); ctx.stroke(); }
        } : null,
      });
    } else if (t === 'bowler') {
      this.hatShadow(ctx, P, 12);
      this.ell(ctx, 100, by - 3, 42, 7, this.sh(hc, -0.4));
      const crownP = () => { ctx.beginPath(); ctx.moveTo(67, by); ctx.bezierCurveTo(63, by - 48, 137, by - 48, 133, by); ctx.closePath(); };
      this.crown(ctx, P, crownP, hc, () => { this.soft(ctx, 86, by - 26, 12, 9, this.sh(hc, 0.45), 0.7); this.soft(ctx, 82, by - 22, 3, 6, '#ffffff', 0.25); });
      this.clip(ctx, crownP, () => this.hatBand(ctx, 60, 140, by - 8, 6, this.sh(hc, -0.55), false));
      // yanları kıvrık dar kenar
      const bp = () => { ctx.beginPath(); ctx.moveTo(52, by - 7); ctx.quadraticCurveTo(54, by + 1, 70, by + 3); ctx.quadraticCurveTo(100, by + 12, 130, by + 3); ctx.quadraticCurveTo(146, by + 1, 148, by - 7); ctx.quadraticCurveTo(140, by - 1, 130, by - 2); ctx.quadraticCurveTo(100, by + 3, 70, by - 2); ctx.quadraticCurveTo(60, by - 1, 52, by - 7); ctx.closePath(); };
      this.fillClip(ctx, bp, this.sh(hc, -0.1), () => { ctx.fillStyle = this.lin(ctx, 52, 0, 148, 0, [[0, this.sh(hc, 0.2)], [1, this.sh(hc, -0.5)]]); ctx.fillRect(50, by - 10, 100, 24); });
      ctx.strokeStyle = this.sh(hc, -0.6, 0.8); ctx.lineWidth = 0.7; bp(); ctx.stroke();
    } else if (t === 'top') {
      this.hatShadow(ctx, P, 12);
      this.ell(ctx, 100, by - 3, 44, 7, this.sh(hc, -0.4));
      const crownP = () => { ctx.beginPath(); ctx.moveTo(70, by); ctx.lineTo(67, by - 58); ctx.quadraticCurveTo(100, by - 64, 133, by - 58); ctx.lineTo(130, by); ctx.quadraticCurveTo(100, by + 3, 70, by); ctx.closePath(); };
      this.crown(ctx, P, crownP, hc, () => {
        // ipek parlaklığı: dikey parlak şeritler
        this.soft(ctx, 82, by - 30, 4, 30, this.sh(hc, 0.6), 0.65); this.soft(ctx, 90, by - 30, 2, 28, this.sh(hc, 0.4), 0.4); this.soft(ctx, 122, by - 30, 6, 30, this.sh(hc, -0.6), 0.6);
      });
      this.ell(ctx, 100, by - 59, 33, 4.6, this.sh(hc, -0.1)); this.soft(ctx, 92, by - 60, 14, 2.2, this.sh(hc, 0.4), 0.6);
      this.clip(ctx, crownP, () => this.hatBand(ctx, 60, 140, by - 10, 8, this.sh(hc, -0.6), false));
      const bp = () => { ctx.beginPath(); ctx.moveTo(54, by - 6); ctx.quadraticCurveTo(56, by + 2, 72, by + 3); ctx.quadraticCurveTo(100, by + 10, 128, by + 3); ctx.quadraticCurveTo(144, by + 2, 146, by - 6); ctx.quadraticCurveTo(138, by - 1, 128, by - 2); ctx.quadraticCurveTo(100, by + 2, 72, by - 2); ctx.quadraticCurveTo(62, by - 1, 54, by - 6); ctx.closePath(); };
      this.fillClip(ctx, bp, this.sh(hc, -0.15), () => { ctx.fillStyle = this.lin(ctx, 54, 0, 146, 0, [[0, this.sh(hc, 0.25)], [1, this.sh(hc, -0.5)]]); ctx.fillRect(50, by - 10, 100, 24); });
    } else if (t === 'flat') {
      // kasket: sekiz parçalı tepe, düğme, siper
      this.hatShadow(ctx, P, 12);
      const cp = () => { ctx.beginPath(); ctx.moveTo(61, by + 2); ctx.bezierCurveTo(54, by - 30, 92, by - 36, 108, by - 33); ctx.bezierCurveTo(140, by - 30, 148, by - 10, 139, by + 2); ctx.quadraticCurveTo(100, by + 6, 61, by + 2); ctx.closePath(); };
      this.crown(ctx, P, cp, hc, () => {
        ctx.strokeStyle = this.sh(hc, -0.4, 0.7); ctx.lineWidth = 0.8;
        for (const k of [-1, -0.4, 0.4, 1]) { ctx.beginPath(); ctx.moveTo(102, by - 31); ctx.quadraticCurveTo(102 + k * 22, by - 22, 100 + k * 38, by + 1); ctx.stroke(); }
        ctx.strokeStyle = this.sh(hc, 0.25, 0.35); ctx.lineWidth = 0.5;
        for (const k of [-1, -0.4, 0.4, 1]) { ctx.beginPath(); ctx.moveTo(103, by - 31); ctx.quadraticCurveTo(103 + k * 22, by - 22, 101 + k * 38, by + 1); ctx.stroke(); }
        // tüvit dokusu
        const r = this.rng(211); ctx.lineWidth = 0.4;
        for (let i = 0; i < 160; i++) { const x = 58 + r() * 84, y = by - 34 + r() * 38; ctx.strokeStyle = r() < 0.5 ? this.sh(hc, 0.3, 0.3) : this.sh(hc, -0.4, 0.3); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 1.2, y + 1.2); ctx.stroke(); }
      });
      this.ell(ctx, 102, by - 32, 3.4, 2, this.sh(hc, -0.35)); this.soft(ctx, 101, by - 32.6, 1.6, 0.8, this.sh(hc, 0.4), 0.7);
      const vp = () => { ctx.beginPath(); ctx.moveTo(70, by + 1); ctx.quadraticCurveTo(100, by + 17, 130, by + 1); ctx.quadraticCurveTo(100, by + 6, 70, by + 1); ctx.closePath(); };
      this.fillClip(ctx, vp, this.sh(hc, -0.3), () => this.soft(ctx, 92, by + 7, 14, 3, this.sh(hc, 0.2), 0.5));
    } else if (t === 'fur') {
      // kürk başlık: baştan sona kürk, kulakların üstüne inen yuvarlak kulaklıklar
      this.hatShadow(ctx, P, 10);
      const fc = this.mix(hc, '#7a5a3a', 0.45), fcols = this.hairCols(fc);
      const fur = (path, box, n, seed, dir = -1) => this.fillClip(ctx, path, this.sh(fc, -0.25), () => {
        const r = this.rng(seed), [x0, y0, x1, y1] = box; ctx.lineCap = 'round';
        for (let i = 0; i < n; i++) { const x = lerp(x0, x1, r()), y = lerp(y0, y1, r()), a = dir * Math.PI / 2 + (x - 100) * 0.02 + (r() - 0.5) * 1.1, l = 2.4 + r() * 2.6; ctx.strokeStyle = fcols[(r() * 6) | 0]; ctx.globalAlpha = 0.55 + r() * 0.45; ctx.lineWidth = 0.5 + r() * 0.7; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.stroke(); }
        ctx.globalAlpha = 1;
        ctx.fillStyle = this.lin(ctx, x0, y0, x1, y1, [[0, 'rgba(255,236,210,0.16)'], [1, 'rgba(0,0,0,0.42)']]); ctx.fillRect(x0 - 4, y0 - 4, x1 - x0 + 8, y1 - y0 + 8);
      });
      for (const k of [-1, 1]) {
        const ep = () => { ctx.beginPath(); ctx.moveTo(100 + k * (P.fw - 4), by - 2); ctx.quadraticCurveTo(100 + k * (P.fw + 9), by + 4, 100 + k * (P.fw + 8), by + 30); ctx.quadraticCurveTo(100 + k * (P.fw + 6), by + 42, 100 + k * (P.fw - 1), by + 40); ctx.quadraticCurveTo(100 + k * (P.fw - 4), by + 20, 100 + k * (P.fw - 4), by - 2); ctx.closePath(); };
        fur(ep, [100 + k * (P.fw - 6) - (k > 0 ? 0 : 14), by - 4, 100 + k * (P.fw - 6) + (k > 0 ? 14 : 0), by + 42], 150, 221 + k, 1);
      }
      const cp = () => { ctx.beginPath(); ctx.moveTo(64, by + 2); ctx.bezierCurveTo(58, by - 46, 142, by - 46, 136, by + 2); ctx.quadraticCurveTo(100, by + 7, 64, by + 2); ctx.closePath(); };
      fur(cp, [58, by - 38, 142, by + 6], 520, 231);
      ctx.strokeStyle = this.sh(fc, -0.5, 0.5); ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(66, by - 8); ctx.quadraticCurveTo(100, by - 2, 134, by - 8); ctx.stroke();
    } else if (t === 'bonnet') {
      // önden yüzü çerçeveleyen kumaş bone: fırfırlı kenar, çene altında bağlanan kurdele
      const bc = hc;
      const bp = () => { ctx.beginPath(); ctx.moveTo(64, cy + 22); ctx.bezierCurveTo(50, cy - 10, 56, cy - 72, 100, cy - 74); ctx.bezierCurveTo(144, cy - 72, 150, cy - 10, 136, cy + 22); ctx.quadraticCurveTo(128, cy + 8, 126, cy - 10); ctx.bezierCurveTo(125, cy - 56, 75, cy - 56, 74, cy - 10); ctx.quadraticCurveTo(72, cy + 8, 64, cy + 22); ctx.closePath(); };
      this.fillClip(ctx, bp, this.css(this.rgb(bc)), () => {
        ctx.fillStyle = this.lin(ctx, 56, 0, 144, 0, [[0, this.sh(bc, 0.25)], [0.5, this.sh(bc, 0.02)], [1, this.sh(bc, -0.45)]]); ctx.fillRect(50, cy - 70, 100, 100);
        ctx.strokeStyle = this.sh(bc, -0.3, 0.6); ctx.lineWidth = 0.8;
        for (let i = 0; i < 7; i++) { ctx.beginPath(); ctx.moveTo(70 - i * 1.6, cy + 10 - i * 2); ctx.bezierCurveTo(68 - i * 2, cy - 44 - i * 2.4, 132 + i * 2, cy - 44 - i * 2.4, 130 + i * 1.6, cy + 10 - i * 2); ctx.stroke(); }
        this.soft(ctx, 100, cy - 40, 26, 10, this.sh(bc, -0.55), 0.5);
      });
      this.texture(ctx, bp, 0.2);
      // fırfır
      ctx.strokeStyle = this.sh(bc, 0.35, 0.9); ctx.lineWidth = 1.4;
      ctx.beginPath(); for (let a = 0; a <= 1.001; a += 0.04) { const x = lerp(74, 126, a), y = cy - 10 - Math.sin(a * Math.PI) * 34 + (Math.round(a * 25) % 2) * 1.2; a ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke();
      // kurdele
      for (const k of [-1, 1]) { ctx.strokeStyle = this.sh(bc, k < 0 ? 0.1 : -0.25); ctx.lineWidth = 2.6; ctx.beginPath(); ctx.moveTo(100 + k * 32, cy + 18); ctx.quadraticCurveTo(100 + k * 18, cy + 44, 100 + k * 4, cy + 48); ctx.stroke(); }
      this.ell(ctx, 100, cy + 48, 4, 3, this.sh(bc, -0.2));
      for (const k of [-1, 1]) { ctx.fillStyle = this.sh(bc, k < 0 ? 0.05 : -0.3); ctx.beginPath(); ctx.moveTo(100, cy + 48); ctx.quadraticCurveTo(100 + k * 10, cy + 54, 100 + k * 8, cy + 66); ctx.lineTo(100 + k * 3, cy + 64); ctx.quadraticCurveTo(100 + k * 4, cy + 54, 100, cy + 50); ctx.fill(); }
    }
  },
  /* bonenin başın arkasında kalan kısmı ve ense kumaşı */
  bonnetBack(ctx, P) {
    const bc = P.look.hatCol || '#c0a880', cy = P.cy;
    this.fillClip(ctx, () => { ctx.beginPath(); ctx.moveTo(60, cy + 20); ctx.bezierCurveTo(48, cy - 30, 68, cy - 76, 100, cy - 76); ctx.bezierCurveTo(132, cy - 76, 152, cy - 30, 140, cy + 20); ctx.quadraticCurveTo(150, cy + 40, 146, cy + 58); ctx.quadraticCurveTo(100, cy + 64, 54, cy + 58); ctx.quadraticCurveTo(50, cy + 40, 60, cy + 20); ctx.closePath(); }, this.sh(bc, -0.3), () => {
      ctx.strokeStyle = this.sh(bc, -0.5, 0.5); ctx.lineWidth = 0.8;
      for (let x = 58; x < 146; x += 6) { ctx.beginPath(); ctx.moveTo(x, cy + 24); ctx.quadraticCurveTo(x + 2, cy + 44, x - 1, cy + 60); ctx.stroke(); }
    });
  },
};

/* Aynı görünüm, yaş ve boyut yeniden istenince (günlük, duraklatma, efsane ekranı) hazır kopya kullanılır */
const PortraitCache = { list: [], max: 8 };
Spr.portrait = (ctx, W, H, look, age) => {
  const key = JSON.stringify([look, age | 0, W, H]);
  let hit = PortraitCache.list.find(e => e.key === key);
  if (!hit) {
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    PortraitArt.draw(c.getContext('2d'), W, H, look, age);
    hit = { key, c }; PortraitCache.list.unshift(hit);
    if (PortraitCache.list.length > PortraitCache.max) PortraitCache.list.pop();
  }
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, W, H); ctx.drawImage(hit.c, 0, 0); ctx.restore();
};
