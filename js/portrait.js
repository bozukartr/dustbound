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
    for (let i = 0; i < n; i++) {
      const x = lerp(x0, x1, r()), y = lerp(y0, y1, r()), a = Math.PI / 2 + (x - 100) * 0.02 + (r() - 0.5) * 0.6;
      ctx.globalAlpha = al * (0.4 + r() * 0.6); ctx.lineWidth = 0.35 + r() * 0.35;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len); ctx.stroke();
    }
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
    this.castShadow(ctx, P);
    this.hairBack(ctx, P);
    if (hat === 'bonnet') this.bonnetBack(ctx, P);
    ctx.save(); ctx.translate(0, -7); this.body(ctx, P); ctx.restore();
    this.neck(ctx, P);
    this.head(ctx, P);
    this.face(ctx, P);
    this.beard(ctx, P);
    this.hairFront(ctx, P);
    this.braidsFront(ctx, P);
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

  /* ---------------- saç: arka kütle (gövdenin arkasında) ---------------- */
  hairBack(ctx, P) {
    const { hs, f, hair: h } = P;
    if (P.hat === 'bonnet') return;
    const cols = [this.sh(h, -0.45), this.sh(h, -0.25), this.sh(h, -0.1), h, this.sh(h, 0.18)];
    // uzun saç kütlesi
    let len = 0, wd = 0, wavy = 0;
    if (f) {
      if (hs === 1) { len = 204; wd = 46; } else if (hs === 4) { len = 206; wd = 54; wavy = 1; } else if (hs === 5) { len = 200; wd = 48; } else if (hs === 7) { len = 196; wd = 60; wavy = 2; } else if (hs === 0) { len = 142; wd = 42; }
    } else {
      if (hs === 1) { len = 176; wd = 46; } else if (hs === 4) { len = 150; wd = 48; wavy = 1; } else if (hs === 7) { len = 140; wd = 48; wavy = 2; }
    }
    if (len) {
      const path = () => {
        ctx.beginPath();
        ctx.moveTo(100 - wd, 100);
        ctx.bezierCurveTo(100 - wd + 2, 62, 100 - 30, 40, 100, 40);
        ctx.bezierCurveTo(100 + 30, 40, 100 + wd - 2, 62, 100 + wd, 100);
        if (wavy) { for (let y = 100; y < len - 10; y += 14) ctx.quadraticCurveTo(100 + wd + (wavy * 5 + 2), y + 7, 100 + wd + (y % 28 ? 2 : -2), y + 14); }
        else ctx.bezierCurveTo(100 + wd + 6, 130, 100 + wd + 4, len - 30, 100 + wd - 4, len - 4);
        const n = 9;
        for (let i = n; i >= 1; i--) { const x = lerp(100 - wd + 4, 100 + wd - 4, i / n); ctx.lineTo(x, len - 2 - Math.sin(i / n * Math.PI) * 4); ctx.lineTo(x - (wd / n), len + 6 + (i % 2) * 3); }
        if (wavy) { for (let y = len - 10; y > 100; y -= 14) ctx.quadraticCurveTo(100 - wd - (wavy * 5 + 2), y - 7, 100 - wd - (y % 28 ? 2 : -2), y - 14); }
        else ctx.bezierCurveTo(100 - wd + 4, len - 30, 100 - wd - 6, 130, 100 - wd, 100);
        ctx.closePath();
      };
      if (hs === 7) { this.ringlets(ctx, P, path, [100 - wd - 8, 50, 100 + wd + 8, len + 4], f ? 220 : 140, f ? 3.4 : 2.8, 13); }
      else this.fillClip(ctx, path, this.sh(h, -0.3), () => {
        for (const k of [-1, 1]) {
          const x = 100 + k * wd;
          this.strands(ctx, [[x - k * 14, 70], [x + k * 6, 110], [x + k * 2, len - 40], [x - k * 6, len + 6]], [[x - k * 30, 66], [x - k * 12, 120], [x - k * 14, len - 30], [x - k * 22, len + 6]], 40, cols, 1.6, 0.8, 11 + k, wavy ? 3 : 1.4);
        }
        this.soft(ctx, 100 - wd + 10, 140, 12, 50, this.sh(h, 0.25), 0.4);
        this.soft(ctx, 100, 140, wd - 10, 70, this.sh(h, -0.6), 0.55);
      });
    }
    // at kuyruğu (erkek), sıkı topuzun ense düğümü (kadın)
    if (!f && (hs === 2 || hs === 6)) {
      const tail = () => { ctx.beginPath(); ctx.moveTo(110, 112); ctx.bezierCurveTo(128, 128, 130, 160, 122, 182); ctx.lineTo(114, 180); ctx.bezierCurveTo(118, 156, 116, 134, 104, 120); ctx.closePath(); };
      if (hs === 2) this.fillClip(ctx, tail, this.sh(h, -0.25), () => this.strands(ctx, [[108, 114], [124, 130], [126, 160], [120, 184]], [[104, 120], [116, 136], [118, 160], [114, 182]], 16, cols, 1.2, 0.8, 21));
    }
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

  /* ---------------- sakal ---------------- */
  /* yanaklardan çeneye sakal kütlesi; top = başladığı yükseklik, len = çeneden aşağı uzunluk */
  beardShape(ctx, P, len, top, inner = 1) {
    const fw = P.fw, cy = P.cy, my = cy + 29;
    ctx.beginPath();
    ctx.moveTo(100 - fw + 0.4, cy + top);
    ctx.bezierCurveTo(100 - fw + 0.5, cy + 20, 100 - fw + 5, cy + 32, 100 - 17, cy + 39 + len * 0.45);
    const n = 12, x0 = 100 - 17, x1 = 100 + 17;
    for (let i = 1; i <= n; i++) { const t = i / n, x = lerp(x0, x1, t), yb = cy + 40 + len * (0.45 + 0.55 * Math.sin(t * Math.PI)); ctx.lineTo(x - (x1 - x0) / n / 2, yb + 2.6); ctx.lineTo(x, yb); }
    ctx.bezierCurveTo(100 + fw - 5, cy + 32, 100 + fw - 0.5, cy + 20, 100 + fw - 0.4, cy + top);
    if (inner) {
      ctx.lineTo(100 + fw - 3.5, cy + top + 1);
      ctx.bezierCurveTo(100 + fw - 9, cy + top + 12, 100 + 19, cy + 22, 100 + 12.5, my + 2);
      ctx.quadraticCurveTo(100, my + 7.5, 100 - 12.5, my + 2);
      ctx.bezierCurveTo(100 - 19, cy + 22, 100 - fw + 9, cy + top + 12, 100 - fw + 3.5, cy + top + 1);
    }
    ctx.closePath();
  },
  hairCols(h) { return [this.sh(h, -0.5), this.sh(h, -0.3), this.sh(h, -0.12), this.css(this.rgb(h)), this.sh(h, 0.2), this.sh(h, 0.38)]; },
  /* sakal kütlesini doldur, içine çeneye doğru akan teller çiz */
  beardMass(ctx, P, path, len, top, seed, dense = 1) {
    const h = P.hair, cy = P.cy, fw = P.fw, cols = this.hairCols(h);
    this.fillClip(ctx, path, this.sh(h, -0.15), () => {
      for (const k of [-1, 1]) this.strands(ctx, [[100 + k * (fw + 1), cy + top - 2], [100 + k * (fw - 1), cy + 18], [100 + k * 20, cy + 34], [100 + k * 7, cy + 44 + len]], [[100 + k * 8, cy + 28], [100 + k * 10, cy + 34], [100 + k * 6, cy + 40], [100 + k * 1, cy + 46 + len]], Math.round(70 * dense), cols, 1.1, 0.85, seed + k, 1.6);
      this.soft(ctx, 86, cy + 24, 12, 12, this.sh(h, 0.35), 0.4);
      this.soft(ctx, 116, cy + 32, 12, 22, this.sh(h, -0.55), 0.55);
      this.soft(ctx, 100, cy + 46 + len, 22, 8, this.sh(h, -0.5), 0.5);
    });
  },
  mustache(ctx, P, kind) {
    const h = P.hair, cy = P.cy, ny = cy + 18, my = cy + 29, cols = this.hairCols(h);
    const curl = kind === 'handle' ? 1 : kind === 'goat' ? 0.6 : 0.25;
    const path = () => {
      ctx.beginPath();
      for (const k of [1, -1]) {
        if (kind === 'walrus') {
          ctx.moveTo(100, ny + 3.4); ctx.bezierCurveTo(100 + k * 8, ny + 1.6, 100 + k * 15, ny + 4, 100 + k * 17, my + 3);
          ctx.quadraticCurveTo(100 + k * 17, my + 9, 100 + k * 13, my + 7); ctx.quadraticCurveTo(100 + k * 6, my + 4, 100, my + 2.4);
        } else {
          ctx.moveTo(100, ny + 4); ctx.bezierCurveTo(100 + k * 6, ny + 2.4, 100 + k * 13, ny + 4, 100 + k * 15, my - 1);
          ctx.quadraticCurveTo(100 + k * (17 + curl * 5), my + 1, 100 + k * (19 + curl * 4), my - 3 - curl * 5);
          ctx.quadraticCurveTo(100 + k * (21 + curl * 3), my + 3, 100 + k * 13, my + 2);
          ctx.quadraticCurveTo(100 + k * 6, my - 0.5, 100, my - 1.6);
        }
        ctx.closePath();
      }
    };
    this.fillClip(ctx, path, this.sh(h, -0.18), () => {
      for (const k of [-1, 1]) this.strands(ctx, [[100 + k * 1, ny + 3], [100 + k * 4, ny + 6], [100 + k * 9, my - 2], [100 + k * (kind === 'walrus' ? 13 : 16), my + (kind === 'walrus' ? 8 : 0)]], [[100 + k * 1, my - 1], [100 + k * 6, my - 1], [100 + k * 12, my + 1], [100 + k * (kind === 'walrus' ? 16 : 20), my + (kind === 'walrus' ? 6 : -4)]], 28, cols, 0.9, 0.9, 61 + k, 0.8);
      this.soft(ctx, 94, ny + 5, 6, 3, this.sh(h, 0.35), 0.5);
      this.soft(ctx, 108, my, 8, 3, this.sh(h, -0.45), 0.5);
    });
  },
  beard(ctx, P) {
    const L = P.look, b = L.beard | 0;
    if (P.f || !b) return;
    const bl = L.beardLen === undefined ? 1 : L.beardLen;
    if (bl <= 0.05) return;
    const h = P.hair, cy = P.cy, fw = P.fw, my = cy + 29, ny = cy + 18;
    const stubble = (al, n) => {
      const ar = () => this.beardShape(ctx, P, 0, 4);
      this.clip(ctx, ar, () => this.soft(ctx, 100, cy + 32, 32, 18, this.mix(P.skin, h, 0.6), al * 0.8));
      this.stipple(ctx, ar, n, this.sh(h, -0.2), al + 0.25, 71, [100 - fw, cy + 2, 100 + fw, cy + 46]);
      const lipA = () => { ctx.beginPath(); ctx.moveTo(89, ny + 4); ctx.quadraticCurveTo(100, ny + 2, 111, ny + 4); ctx.lineTo(112, my - 1); ctx.quadraticCurveTo(100, my - 3, 88, my - 1); ctx.closePath(); };
      this.clip(ctx, lipA, () => this.soft(ctx, 100, my - 4, 12, 6, this.mix(P.skin, h, 0.6), al * 0.8));
      this.stipple(ctx, lipA, n * 0.3, this.sh(h, -0.2), al + 0.25, 73, [88, ny + 2, 112, my]);
    };
    if (b === 3) stubble(0.3, 420);
    if (b === 4) { const len = 6 + bl * 18; this.beardMass(ctx, P, () => this.beardShape(ctx, P, len, 2), len, 2, 81, 1.2); }
    if (b === 8) { stubble(0.18, 200); const len = 1 + bl * 4; this.beardMass(ctx, P, () => this.beardShape(ctx, P, len, 6), len, 6, 83, 0.9); }
    if (b === 7) {
      // çene sakalı: kulaktan kulağa çene hattı boyunca bant, bıyıksız
      const len = 2 + bl * 5;
      const path = () => {
        ctx.beginPath(); ctx.moveTo(100 - fw + 0.4, cy - 6);
        ctx.bezierCurveTo(100 - fw + 0.5, cy + 20, 100 - fw + 5, cy + 32, 100 - 17, cy + 40 + len * 0.5);
        ctx.quadraticCurveTo(100, cy + 47 + len, 100 + 17, cy + 40 + len * 0.5);
        ctx.bezierCurveTo(100 + fw - 5, cy + 32, 100 + fw - 0.5, cy + 20, 100 + fw - 0.4, cy - 6);
        ctx.lineTo(100 + fw - 4.6, cy - 6);
        ctx.bezierCurveTo(100 + fw - 5, cy + 16, 100 + fw - 9.5, cy + 27, 100 + 14, cy + 35);
        ctx.quadraticCurveTo(100, cy + 41, 100 - 14, cy + 35);
        ctx.bezierCurveTo(100 - fw + 9.5, cy + 27, 100 - fw + 5, cy + 16, 100 - fw + 4.6, cy - 6);
        ctx.closePath();
      };
      this.beardMass(ctx, P, path, len, -6, 85, 0.8);
    }
    if (b === 5) {
      // favori: şakaktan yanaklara inen gür kütle, çene açık
      for (const k of [-1, 1]) {
        const path = () => { ctx.beginPath(); ctx.moveTo(100 + k * (fw + 0.4), cy - 12); ctx.lineTo(100 + k * (fw - 3.5), cy - 12); ctx.bezierCurveTo(100 + k * (fw - 5), cy + 8, 100 + k * (fw - 9), cy + 20, 100 + k * 17, my + 3); ctx.quadraticCurveTo(100 + k * 17, cy + 37, 100 + k * 22, cy + 38); ctx.bezierCurveTo(100 + k * (fw - 2), cy + 32, 100 + k * (fw + 1), cy + 18, 100 + k * (fw + 0.4), cy - 10); ctx.closePath(); };
        this.fillClip(ctx, path, this.sh(h, -0.15), () => {
          this.strands(ctx, [[100 + k * (fw - 1), cy - 12], [100 + k * (fw), cy + 6], [100 + k * (fw - 2), cy + 22], [100 + k * 22, cy + 38]], [[100 + k * (fw - 3.5), cy - 12], [100 + k * (fw - 5), cy + 8], [100 + k * (fw - 9), cy + 20], [100 + k * 17, my + 3]], 40, this.hairCols(h), 1, 0.85, 91 + k, 1.2);
          this.soft(ctx, 100 + k * (fw - 4), cy + 26, 8, 12, this.sh(h, k < 0 ? 0.25 : -0.5), 0.45);
        });
      }
      this.mustache(ctx, P, 'chops');
    }
    if (b === 2) {
      // keçi sakalı: dudak altı ve çene, sivri uç
      const len = 6 + bl * 10;
      const path = () => {
        ctx.beginPath(); ctx.moveTo(90, my + 6); ctx.quadraticCurveTo(100, my + 4, 110, my + 6);
        ctx.quadraticCurveTo(111, my + 12, 106, my + 10 + len * 0.7); ctx.quadraticCurveTo(102, my + 10 + len, 100, my + 12 + len); ctx.quadraticCurveTo(98, my + 10 + len, 94, my + 10 + len * 0.7); ctx.quadraticCurveTo(89, my + 12, 90, my + 6); ctx.closePath();
        ctx.moveTo(95.5, my + 3.6); ctx.quadraticCurveTo(100, my + 5, 104.5, my + 3.6); ctx.lineTo(103, my + 7); ctx.lineTo(97, my + 7); ctx.closePath();
      };
      this.fillClip(ctx, path, this.sh(h, -0.15), () => {
        this.strands(ctx, [[91, my + 5], [94, my + 10], [97, my + 10 + len * 0.6], [100, my + 12 + len]], [[109, my + 5], [106, my + 10], [103, my + 10 + len * 0.6], [100, my + 12 + len]], 34, this.hairCols(h), 0.9, 0.9, 95, 0.9);
        this.soft(ctx, 104, my + 12, 5, 6, this.sh(h, -0.45), 0.5);
      });
    }
    if (b === 1 || b === 2 || b === 4 || b === 8) this.mustache(ctx, P, b === 1 ? 'handle' : b === 2 ? 'goat' : 'full');
    if (b === 6) this.mustache(ctx, P, 'walrus');
  },

  /* ---------------- saç: ön kütle ---------------- */
  /* saç kütlesini boyar: taban, hacim gölgesi, iki kat tel, parlama bandı */
  hairPaint(ctx, P, path, guides, seed, o = {}) {
    const h = P.hair, cols = this.hairCols(h), dk = [cols[0], cols[1], cols[2]], lt = [cols[3], cols[4], cols[5]];
    this.fillClip(ctx, path, this.sh(h, -0.18), () => {
      ctx.fillStyle = this.lin(ctx, 60, 40, 140, 150, [[0, this.sh(h, 0.12, 0.7)], [0.5, this.sh(h, -0.05, 0)], [1, this.sh(h, -0.5, 0.8)]]); ctx.fillRect(0, 0, 200, 240);
      guides.forEach(([A, B, n], i) => this.strands(ctx, A, B, n, dk, 1.5, 0.45, seed + i * 7, o.jit || 1.4));
      guides.forEach(([A, B, n], i) => this.strands(ctx, A, B, Math.round(n * 1.2), lt, 0.55, 0.4, seed + 100 + i * 7, o.jit || 1.4));
      if (o.sheen) {
        const [x, y, rx, ry, al] = o.sheen;
        this.soft(ctx, x, y, rx, ry, this.sh(h, 0.4), (al || 0.5) * 0.6, o.sheenRot || 0);
        this.clip(ctx, () => { ctx.beginPath(); ctx.ellipse(x, y, rx * 0.9, ry * 0.9, o.sheenRot || 0, 0, TAU); }, () => guides.forEach(([A, B, n], i) => this.strands(ctx, A, B, n, [this.sh(h, 0.3), this.sh(h, 0.45)], 0.4, 0.45 * (al || 0.5), seed + 200 + i, o.jit || 1.4)));
      }
      if (o.ao) o.ao();
    });
  },
  /* bukleler: aşağı doğru küçük sarmal halkalar */
  ringlets(ctx, P, path, box, n, size, seed) {
    const h = P.hair, cols = this.hairCols(h), r = this.rng(seed), [x0, y0, x1, y1] = box;
    this.fillClip(ctx, path, this.sh(h, -0.3), () => {
      ctx.fillStyle = this.lin(ctx, x0, y0, x1, y1, [[0, this.sh(h, 0.05, 0.6)], [1, this.sh(h, -0.55, 0.8)]]); ctx.fillRect(0, 0, 200, 240);
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      for (let i = 0; i < n; i++) {
        const cx = lerp(x0, x1, r()), cyy = lerp(y0, y1, r()), sz = size * (0.7 + r() * 0.6), steps = 6 + (r() * 8 | 0), ph = r() * TAU;
        const lit = clamp(0.5 - (cx - 100) / 80 - (cyy - y0) / (y1 - y0) * 0.4, 0, 1);
        const spring = (dx, dy) => { ctx.beginPath(); for (let j = 0; j <= steps; j++) { const x = cx + dx + Math.sin(ph + j * 1.5) * sz * 0.55, y = cyy + dy + j * sz * 0.38; j ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke(); };
        ctx.strokeStyle = this.sh(h, -0.6); ctx.globalAlpha = 0.7; ctx.lineWidth = sz * 0.55; spring(0, 0);
        ctx.strokeStyle = this.mix(this.sh(h, -0.1), this.sh(h, 0.3), lit); ctx.globalAlpha = 0.55 + r() * 0.35; ctx.lineWidth = sz * 0.24; spring(-sz * 0.12, -sz * 0.1);
      }
      ctx.globalAlpha = 1;
      this.soft(ctx, 86, y0 + 10, 18, 10, this.sh(h, 0.35), 0.3);
    });
  },
  hairFront(ctx, P) {
    const { hs, f, hair: h, fw, cy, top, hl } = P;
    const hatClip = (fn) => { ctx.save(); if (P.hat) { ctx.beginPath(); ctx.rect(0, P.hatLine, 200, 240); ctx.clip(); } fn(); ctx.restore(); };
    // kazınmış saç (erkek): kafa derisine yakın kısa kıllar
    if (!f && hs === 3) {
      hatClip(() => {
        const ar = () => { ctx.beginPath(); ctx.moveTo(100 - fw - 1, cy - 2); ctx.quadraticCurveTo(100 - fw - 3, top - 4, 100, top - 2); ctx.quadraticCurveTo(100 + fw + 3, top - 4, 100 + fw + 1, cy - 2); ctx.lineTo(100 + fw - 3, cy - 8); ctx.quadraticCurveTo(100 + fw - 4, hl + 4, 100 + 10, hl); ctx.quadraticCurveTo(100, hl - 1.5, 100 - 10, hl); ctx.quadraticCurveTo(100 - fw + 4, hl + 4, 100 - fw + 3, cy - 8); ctx.closePath(); };
        this.clip(ctx, () => this.headPath(ctx, P), () => {
          ar(); ctx.fillStyle = this.mix(P.skin, h, 0.55, 0.8); ctx.fill();
          this.clip(ctx, ar, () => { ctx.fillStyle = this.lin(ctx, 0, hl - 4, 0, hl + 4, [[0, 'rgba(0,0,0,0)'], [1, this.mix(P.skin, P.skin, 0, 0.6)]]); ctx.fillRect(60, hl - 4, 80, 8); });
          this.stipple(ctx, ar, 1400, this.sh(h, -0.1), 0.65, 101, [100 - fw - 3, top - 4, 100 + fw + 3, cy], 0.9);
          this.soft(ctx, 88, top + 10, 14, 7, '#ffffff', 0.2);
        });
      });
      return;
    }
    // stile göre: hacim, ayrım çizgisi, yan uzunluk, geriye taranmış mı
    const SM = { vol: [4, 5, 2, 0, 7, 6, 6, 9, 2, 2], part: [86, 97, 100, 100, 92, 84, 100, 100, 100, 100], side: [8, 18, 4, 0, 14, 6, 3, 12, 4, 6] };
    const SF = { vol: [5, 4, 3, 2, 7, 6, 8, 10, 2, 3], part: [87, 100, 100, 100, 95, 84, 100, 100, 100, 100], side: [10, 10, 2, 0, 10, 8, 4, 10, 0, 6] };
    const S = f ? SF : SM, vol = S.vol[hs], part = S.part[hs], side = S.side[hs];
    const back = f ? [2, 3, 6, 8].includes(hs) : [2, 6, 8].includes(hs);
    const curly = hs === 7;
    const volR = !f && hs === 5 ? vol + 3 : vol, volL = !f && hs === 5 ? vol - 2 : vol;
    hatClip(() => {
      const outer = () => {
        if (curly) {
          // bukleli silüet: kafa çevresinde yarım daire kabarcıklar
          const R = fw + vol + 2, n = 13;
          ctx.moveTo(100 - fw - 2, cy + side * 0.5 - 2);
          for (let i = 0; i <= n; i++) { const a = Math.PI * (1.04 + i / n * 0.92), x = 100 + Math.cos(a) * R * 1.02, y = cy - 22 + Math.sin(a) * (cy - 22 - (top - vol - 4)); i ? ctx.quadraticCurveTo(x + Math.cos(a) * 5, y + Math.sin(a) * 5, x, y) : ctx.lineTo(x, y); }
          ctx.lineTo(100 + fw + 2, cy + side * 0.5 - 2); ctx.lineTo(100 + fw - 1.5, cy - 6);
          return;
        }
        ctx.moveTo(100 - fw - 2, cy + side * 0.5 - 2);
        ctx.bezierCurveTo(100 - fw - volL - 5, cy - 36, 100 - fw * 0.72, top - volL - 6, 100, top - Math.max(volL, volR) - 4);
        ctx.bezierCurveTo(100 + fw * 0.72, top - volR - 6, 100 + fw + volR + 5, cy - 36, 100 + fw + 2, cy + side * 0.5 - 2);
        ctx.lineTo(100 + fw - 1.5, cy - 6);
      };
      const mass = () => {
        ctx.beginPath(); outer();
        if (back) {
          // geri taranmış: alnı açık, yumuşak saç çizgisi (erkek arkaya taralıda sivri tepe)
          ctx.quadraticCurveTo(100 + fw - 3, hl + 4, 100 + 11, hl);
          if (!f && hs === 6) { ctx.quadraticCurveTo(103, hl - 0.5, 100, hl + 4); ctx.quadraticCurveTo(97, hl - 0.5, 100 - 11, hl); }
          else ctx.quadraticCurveTo(100, hl - 2.5, 100 - 11, hl);
          ctx.quadraticCurveTo(100 - fw + 3, hl + 4, 100 - fw + 1.5, cy - 6);
        } else if (!f && hs === 9) {
          // açık alın: şakaklarda geri çekilmiş M çizgisi
          ctx.quadraticCurveTo(100 + fw - 4, cy - 26, 100 + 17, hl + 3); ctx.quadraticCurveTo(100 + 7, hl - 3, 100, hl + 1); ctx.quadraticCurveTo(100 - 7, hl - 3, 100 - 17, hl + 3); ctx.quadraticCurveTo(100 - fw + 4, cy - 26, 100 - fw + 1.5, cy - 6);
        } else if (curly || (!f && hs === 4)) {
          // dalgalı/kıvırcık: alna düşen perçemler
          const n = curly ? 7 : 5, st = (fw * 2 - 6) / n;
          for (let i = 0; i < n; i++) { const x = 100 + fw - 3 - i * st; ctx.quadraticCurveTo(x - st / 2, hl + (curly ? 6 : 9) + (i % 2) * 2, x - st, hl + (i % 2 ? 0 : 2)); }
          ctx.lineTo(100 - fw + 1.5, cy - 6);
        } else if (f) {
          // kadın: ayrımdan iki yana kavis, alnı çerçeveler
          ctx.quadraticCurveTo(100 + fw - 2, hl + 6, part + 4, hl - 1); ctx.lineTo(part, hl + 1.5); ctx.lineTo(part - 4, hl - 1);
          ctx.quadraticCurveTo(100 - fw + 2, hl + 6, 100 - fw + 1.5, cy - 6);
        } else {
          // yandan ayrım: alnın üstünden sağa taranan perçem
          ctx.quadraticCurveTo(100 + fw - 2, hl + 2, part + 20, hl + 3);
          ctx.quadraticCurveTo(part + 6, hl + 1, part, hl - 2);
          ctx.quadraticCurveTo(part - 5, hl + 2, 100 - fw + 4, hl + 6);
          ctx.quadraticCurveTo(100 - fw + 1, cy - 14, 100 - fw + 1.5, cy - 6);
        }
        ctx.closePath();
      };
      if (curly) this.ringlets(ctx, P, mass, [100 - fw - vol - 2, top - vol - 4, 100 + fw + vol + 2, cy + side * 0.5], f ? 120 : 190, f ? 3.2 : 2.3, 117);
      else {
        let guides;
        if (back) guides = [[[[100 - fw, cy - 4], [100 - fw + 2, hl - 6], [100 - 18, top], [100 - 4, top - vol - 8]], [[100 - 4, hl + 1], [100 - 4, hl - 6], [100 - 2, top], [100, top - vol - 8]], 50], [[[100 + fw, cy - 4], [100 + fw - 2, hl - 6], [100 + 18, top], [100 + 4, top - vol - 8]], [[100 + 4, hl + 1], [100 + 4, hl - 6], [100 + 2, top], [100, top - vol - 8]], 50]];
        else guides = [
          [[[part, top - volL], [part - 10, top - volL + 2], [100 - fw - 5, cy - 38], [100 - fw - 1, cy + side * 0.5]], [[part, hl - 1], [part - 8, hl], [100 - fw + 3, hl + 6], [100 - fw + 2, cy - 6]], 45],
          [[[part, top - volR], [part + 14, top - volR + 1], [100 + fw + 5, cy - 38], [100 + fw + 1, cy + side * 0.5]], [[part, hl - 1], [part + 12, hl + 2], [100 + fw - 4, hl + 4], [100 + fw - 2, cy - 6]], 65],
        ];
        const shine = hs === 5 || hs === 6 || (!f && hs === 2);
        this.hairPaint(ctx, P, mass, guides, 121 + hs * 13, {
          sheen: [part < 96 ? part + 10 : 92, top + 6 - vol * 0.4, 18, 6, shine ? 0.75 : 0.45], sheenRot: -0.15, jit: hs === 4 ? 2.2 : 1.3,
          ao: () => { this.soft(ctx, 124, cy - 22, 12, 26, this.sh(h, -0.55), 0.55); this.soft(ctx, 100, hl + 1, 26, 3, this.sh(h, -0.5), 0.35); },
        });
      }
      // erkekte favoriler (kısa yan saç)
      if (!f && ![1, 4, 7].includes(hs)) {
        for (const k of [-1, 1]) {
          const sb = () => { ctx.beginPath(); ctx.moveTo(100 + k * (fw + 0.2), cy - 16); ctx.lineTo(100 + k * (fw - 4), cy - 16); ctx.quadraticCurveTo(100 + k * (fw - 3.4), cy - 4, 100 + k * (fw - 1.6), cy + 6); ctx.quadraticCurveTo(100 + k * (fw - 0.4), cy - 4, 100 + k * (fw + 0.2), cy - 16); ctx.closePath(); };
          this.fillClip(ctx, sb, this.sh(h, -0.2, 0.7), () => this.strands(ctx, [[100 + k * (fw - 4), cy - 14], [100 + k * (fw - 4), cy - 6], [100 + k * (fw - 3), cy + 2], [100 + k * (fw - 3), cy + 9]], [[100 + k * fw, cy - 14], [100 + k * fw, cy - 6], [100 + k * fw, cy + 2], [100 + k * fw, cy + 9]], 14, this.hairCols(h), 0.7, 0.8, 161 + k, 0.4));
        }
      }
      // yanlardan düşen tutamlar: kulağın üstünden, yüzün dış kenarında
      const locks = f ? ({ 0: cy + 32, 1: cy + 84, 4: cy + 86, 5: 0, 7: cy + 80, 9: 0 })[hs] : ({ 1: cy + 60, 4: cy + 28 })[hs];
      if (locks && P.hat !== 'bonnet') {
        const wv = hs === 4 || hs === 0 ? 1 : 0;
        for (const k of [-1, 1]) {
          const end = locks, xi = 100 + k * (fw - (f ? 6 : 1)), xo = 100 + k * (fw + (f ? 7 : 9));
          const lock = () => {
            ctx.beginPath(); ctx.moveTo(xi, cy - 26);
            ctx.bezierCurveTo(xo + k * 2, cy - 12, xo + k * (2 + wv * 5), cy + (end - cy) * 0.55, xo - k * (wv ? 0 : 2), end);
            ctx.quadraticCurveTo(xo - k * 4, end + 5, 100 + k * (fw - 2), end - 3);
            ctx.bezierCurveTo(100 + k * (fw - 3 - wv * 4), cy + (end - cy) * 0.55, 100 + k * (fw - 2), cy + 4, 100 + k * (fw - 3), cy - 10);
            ctx.closePath();
          };
          if (curly) { this.ringlets(ctx, P, lock, [Math.min(xi, xo) - 4, cy - 26, Math.max(xi, xo) + 4, end], 30, 3, 141 + k); continue; }
          this.hairPaint(ctx, P, lock, [[[[xi, cy - 26], [xo + k * 2, cy - 12], [xo + k * (2 + wv * 5), cy + (end - cy) * 0.55], [xo - k * 2, end + 2]], [[100 + k * (fw - 3), cy - 10], [100 + k * (fw - 2), cy + 4], [100 + k * (fw - 3 - wv * 4), cy + (end - cy) * 0.55], [100 + k * (fw - 2), end - 2]], 26]], 141 + k * 5, {
            jit: wv ? 2.4 : 1, ao: () => this.soft(ctx, xo, cy + 4, 4, 22, this.sh(h, k < 0 ? 0.35 : -0.4), 0.45),
          });
        }
      }
      // derin yan ayrım (kadın): bir yandan yüze ve omza düşen kalın tutam
      if (f && hs === 5) {
        const lock = () => { ctx.beginPath(); ctx.moveTo(part - 2, top - vol); ctx.bezierCurveTo(58, cy - 46, 60, cy - 6, 64, cy + 30); ctx.bezierCurveTo(66, cy + 60, 62, cy + 80, 68, cy + 98); ctx.lineTo(77, cy + 94); ctx.bezierCurveTo(75, cy + 60, 77, cy + 20, 75, cy - 4); ctx.quadraticCurveTo(80, cy - 26, part + 12, hl + 2); ctx.closePath(); };
        this.hairPaint(ctx, P, lock, [[[[part, top - vol], [58, cy - 42], [60, cy + 20], [68, cy + 98]], [[part + 12, hl + 2], [80, cy - 22], [77, cy + 20], [77, cy + 94]], 40]], 151, { sheen: [66, cy - 20, 6, 22, 0.5] });
      }
    });
    // topuzlar (şapkasızken)
    if (!P.hat && f && (hs === 2 || hs === 6)) {
      const r = hs === 6 ? 14 : 11.5, y = top - vol - (hs === 6 ? 8 : 5);
      const bun = () => { ctx.beginPath(); ctx.ellipse(100, y, r + 3, r, 0, 0, TAU); };
      this.fillClip(ctx, bun, this.sh(h, -0.2), () => {
        ctx.fillStyle = this.rad(ctx, 94, y - 5, 1, 100, y, r + 4, [[0, this.sh(h, 0.3)], [0.6, this.sh(h, -0.1)], [1, this.sh(h, -0.55)]]); ctx.fillRect(80, y - r - 4, 40, r * 2 + 8);
        // dıştan içe sarılan bükümler
        const cols = this.hairCols(h);
        for (let tw = 0; tw < 5; tw++) {
          const a0 = tw * TAU / 5;
          const A = [], B = [];
          for (let q = 0; q < 4; q++) { const a = a0 + q * 0.9, rr = (r + 2) * (1 - q * 0.22); A.push([100 + Math.cos(a) * rr * 1.15, y + Math.sin(a) * rr]); const b = a + 0.5, rb = rr * 0.75; B.push([100 + Math.cos(b) * rb * 1.15, y + Math.sin(b) * rb]); }
          this.strands(ctx, A, B, 14, cols, 0.7, 0.6, 181 + tw, 0.6);
          this.soft(ctx, 100 + Math.cos(a0 + 0.4) * r * 0.7, y + Math.sin(a0 + 0.4) * r * 0.6, 3, 5, this.sh(h, -0.55), 0.35, a0);
        }
        this.soft(ctx, 94, y - 5, 7, 4, this.sh(h, 0.45), 0.45);
      });
      // topuzun dibindeki tutam gölgesi
      this.soft(ctx, 100, y + r - 1, r, 2.4, this.sh(h, -0.6), 0.4);
    }
  },

  /* örgüler: omuzdan öne düşen (tek örgü, iki örgü, erkekte örgülü) */
  braidsFront(ctx, P) {
    const { hs, f, hair: h, cy } = P;
    const sides = hs === 8 ? [-1] : f && hs === 9 ? [-1, 1] : [];
    if (!sides.length) return;
    const cols = this.hairCols(h);
    for (const k of sides) {
      const x0 = 100 + k * (P.fw + 1), y0 = cy + 14, x1 = 100 + k * (f ? 38 : 35), y1 = cy + (f ? 108 : 96), n = 12;
      // örgünün başı: kulağın arkasından toplanan saç
      this.hairPaint(ctx, P, () => { ctx.beginPath(); ctx.moveTo(x0 - k * 5, cy - 6); ctx.quadraticCurveTo(x0 + k * 8, cy + 2, x0 + k * 5, y0 + 6); ctx.lineTo(x0 - k * 3, y0 + 8); ctx.quadraticCurveTo(x0 - k * 2, cy + 4, x0 - k * 5, cy - 6); ctx.closePath(); },
        [[[[x0 - k * 5, cy - 6], [x0 + k * 4, cy], [x0 + k * 5, y0], [x0 + k * 3, y0 + 8]], [[x0 - k * 4, cy - 2], [x0 - k * 2, cy + 4], [x0 - k * 1, y0], [x0 - k * 2, y0 + 8]], 14]], 301 + k);
      for (let i = 0; i < n; i++) {
        const t = i / (n - 1), x = lerp(x0, x1, t) + Math.sin(t * 2.6) * 2.4 * k, y = lerp(y0, y1, t), w = 6.6 - t * 2.4, seg = (y1 - y0) / (n - 1), s = i % 2 ? 1 : -1;
        const lobe = () => { ctx.beginPath(); ctx.ellipse(x + s * w * 0.24, y + seg * 0.5, w * 0.6, seg * 0.95, s * 0.62, 0, TAU); };
        this.fillClip(ctx, lobe, this.sh(h, -0.15), () => {
          ctx.fillStyle = this.lin(ctx, x - s * w, y, x + s * w, y + seg * 1.5, [[0, this.sh(h, 0.25)], [0.55, this.sh(h, -0.05)], [1, this.sh(h, -0.6)]]); ctx.fillRect(x - 10, y - 6, 20, seg * 2 + 10);
          this.strands(ctx, [[x - s * w * 0.6, y - seg * 0.4], [x - s * w * 0.2, y], [x + s * w * 0.3, y + seg * 0.7], [x + s * w * 0.7, y + seg * 1.3]], [[x - s * w * 0.1, y - seg * 0.6], [x + s * w * 0.3, y - seg * 0.2], [x + s * w * 0.8, y + seg * 0.4], [x + s * w * 1.1, y + seg]], 8, cols, 0.5, 0.7, 311 + i * 5 + k, 0.4);
        });
      }
      // uçta bağ ve püskül
      this.strands(ctx, [[x1 - 2.2, y1 + 6], [x1 - 2.6, y1 + 10], [x1 - 3, y1 + 13], [x1 - 3.6, y1 + 17]], [[x1 + 2.2, y1 + 6], [x1 + 2.6, y1 + 10], [x1 + 3, y1 + 13], [x1 + 3.6, y1 + 17]], 16, cols, 0.7, 0.9, 341 + k, 0.6);
      this.fillClip(ctx, () => { ctx.beginPath(); ctx.ellipse(x1, y1 + 5.4, 3.2, 1.8, 0, 0, TAU); }, '#7a2a24', () => this.soft(ctx, x1 - 1, y1 + 4.8, 1.6, 0.8, '#d07060', 0.8));
    }
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

Spr.portrait = (ctx, W, H, look, age) => PortraitArt.draw(ctx, W, H, look, age);
