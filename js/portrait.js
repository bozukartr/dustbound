'use strict';
/* ==========================================================
   FRONTIER'S END — karakter portresi
   Sade vektör illüstrasyon: düz renk alanları, yumuşak gölgeler,
   sol üstten ışık. Karakter oluşturma ekranı, günlük ve efsane
   (ölüm) ekranı kullanır. Koordinatlar 200×240'lık bir alanda;
   tuval boyutuna ölçeklenir.
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
  lin(ctx, x0, y0, x1, y1, stops) { const g = ctx.createLinearGradient(x0, y0, x1, y1); for (const [o, c] of stops) g.addColorStop(o, c); return g; },
  rad(ctx, x0, y0, r0, x1, y1, r1, stops) { const g = ctx.createRadialGradient(x0, y0, r0, x1, y1, r1); for (const [o, c] of stops) g.addColorStop(o, c); return g; },
  ell(ctx, x, y, rx, ry, fill, rot = 0) { ctx.fillStyle = fill; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, TAU); ctx.fill(); },
  /* kenarı yumuşak eliptik ışık/gölge lekesi */
  soft(ctx, x, y, rx, ry, col, al) {
    ctx.save(); ctx.translate(x, y); ctx.scale(1, ry / rx);
    ctx.fillStyle = this.rad(ctx, 0, 0, 0, 0, 0, rx, [[0, this.mix(col, col, 0, al)], [1, this.mix(col, col, 0, 0)]]);
    ctx.fillRect(-rx, -rx, rx * 2, rx * 2); ctx.restore();
  },
  /* yolu doldurur, sonra aynı yolun içine kırpılıp fn çizer (gölge ve ışık şekil dışına taşmaz) */
  fillClip(ctx, path, fill, fn) { path(); ctx.fillStyle = fill; ctx.fill(); if (fn) { ctx.save(); path(); ctx.clip(); fn(); ctx.restore(); } },

  /* ---------------- ana çizim ---------------- */
  draw(ctx, W, H, look, age) {
    ctx.save();
    ctx.clearRect(0, 0, W, H);
    ctx.scale(W / 200, H / 240);
    const f = look.sex === 'f';
    const grey = clamp((age - 42) / 30, 0, 1);
    const P = {
      look, age, f, grey,
      hair: grey > 0 ? this.mix(look.hair, '#d8d4cc', grey) : this.css(this.rgb(look.hair)),
      aging: clamp((age - 35) / 45, 0, 1),
      skin: this.css(this.rgb(look.skin)),
      hat: look.hat && look.hat !== 'none' ? look.hat : null,
      fw: f ? 29 : 32, cy: 106,
    };
    this.backdrop(ctx, P);
    ctx.save();
    ctx.translate(100, 133); ctx.scale(1.3, 1.3); ctx.translate(-100, -112);
    this.hairBack(ctx, P);
    ctx.save(); ctx.translate(0, -7); this.body(ctx, P); ctx.restore();
    this.neck(ctx, P);
    this.head(ctx, P);
    this.face(ctx, P);
    this.beard(ctx, P);
    this.hairFront(ctx, P);
    this.hatDraw(ctx, P);
    ctx.restore();
    // hafif köşe kararması
    ctx.fillStyle = this.rad(ctx, 100, 118, 90, 100, 118, 170, [[0, 'rgba(60,40,20,0)'], [1, 'rgba(60,40,20,0.28)']]);
    ctx.fillRect(0, 0, 200, 240);
    ctx.restore();
  },

  backdrop(ctx, P) {
    ctx.fillStyle = this.rad(ctx, 90, 80, 10, 100, 120, 170, [[0, '#f4ecdf'], [0.6, '#e6dac6'], [1, '#c9b89c']]);
    ctx.fillRect(0, 0, 200, 240);
    this.soft(ctx, 114, 220, 120, 60, '#8a7050', 0.3);
  },

  /* Uzun saç, topuz ve kadın saçının arka kısmı (gövdenin arkasında) */
  hairBack(ctx, P) {
    const hs = P.look.hairStyle, h = P.hair;
    const long = hs === 1 || (P.f && hs === 4);
    if (hs === 2) {
      if (P.f) { this.ell(ctx, 100, 51, 18, 14, this.sh(h, -0.25)); this.ell(ctx, 97, 48, 14, 10, h); this.soft(ctx, 94, 45, 7, 4, this.sh(h, 0.35), 0.6); }
      else { ctx.fillStyle = this.sh(h, -0.2); ctx.beginPath(); ctx.moveTo(116, 120); ctx.quadraticCurveTo(128, 150, 120, 178); ctx.lineTo(112, 176); ctx.quadraticCurveTo(118, 150, 108, 122); ctx.fill(); }
      return;
    }
    if (!long) return;
    const len = P.f ? 196 : 176, wd = hs === 4 ? 54 : 48;
    const path = () => {
      ctx.beginPath();
      ctx.moveTo(100 - wd, 96);
      if (hs === 4) { for (let y = 100; y < len; y += 12) ctx.quadraticCurveTo(100 - wd - 8, y + 6, 100 - wd + (y > len - 30 ? 10 : 0), y + 12); }
      else ctx.quadraticCurveTo(100 - wd - 6, 150, 100 - wd + 6, len);
      ctx.quadraticCurveTo(100, len + 10, 100 + wd - 6, len);
      if (hs === 4) { for (let y = len; y > 100; y -= 12) ctx.quadraticCurveTo(100 + wd + 8, y - 6, 100 + wd, y - 12); }
      else ctx.quadraticCurveTo(100 + wd + 6, 150, 100 + wd, 96);
      ctx.quadraticCurveTo(100, 40, 100 - wd, 96);
      ctx.closePath();
    };
    this.fillClip(ctx, path, this.sh(h, -0.18), () => {
      this.soft(ctx, 100 - wd + 12, 140, 12, 50, this.sh(h, 0.2), 0.6);
      this.soft(ctx, 100 + wd - 8, 150, 14, 60, this.sh(h, -0.35), 0.6);
    });
  },

  /* Gövde: palto, yelek, gömlek yakası, bandana ya da kravat */
  body(ctx, P) {
    const L = P.look, coat = L.coat, shirt = L.shirt, f = P.f;
    const duster = (L.coatLen || 0) > 0.3;
    const torso = () => { ctx.beginPath(); ctx.moveTo(4, 240); ctx.bezierCurveTo(8, 196, 26, 176, 70, 166); ctx.lineTo(130, 166); ctx.bezierCurveTo(174, 176, 192, 196, 196, 240); ctx.closePath(); };
    this.fillClip(ctx, torso, this.css(this.rgb(coat)), () => {
      this.soft(ctx, 34, 196, 40, 50, this.sh(coat, 0.18), 0.7);
      this.soft(ctx, 176, 214, 40, 60, this.sh(coat, -0.4), 0.7);
    });
    // gömlek
    ctx.fillStyle = this.lin(ctx, 80, 0, 124, 0, [[0, this.sh(shirt, 0.1)], [1, this.sh(shirt, -0.15)]]);
    ctx.beginPath(); ctx.moveTo(78, 240); ctx.lineTo(82, 160); ctx.lineTo(118, 160); ctx.lineTo(122, 240); ctx.fill();
    if (f) {
      // yüksek yakalı bluz, fırfır ve broş
      ctx.fillStyle = this.sh(shirt, 0.06);
      ctx.beginPath(); ctx.moveTo(86, 150); ctx.quadraticCurveTo(100, 156, 114, 150); ctx.lineTo(116, 168); ctx.quadraticCurveTo(100, 174, 84, 168); ctx.fill();
      ctx.strokeStyle = this.sh(shirt, -0.22, 0.8); ctx.lineWidth = 1;
      for (let k = 0; k < 6; k++) { ctx.beginPath(); ctx.arc(88 + k * 5, 170, 3, 0, Math.PI); ctx.stroke(); }
      for (let y = 180; y < 238; y += 10) { ctx.beginPath(); ctx.moveTo(94, y); ctx.quadraticCurveTo(100, y + 5, 106, y); ctx.stroke(); }
      this.ell(ctx, 100, 172, 4.4, 5.2, '#b08a34'); this.ell(ctx, 100, 172, 2.8, 3.4, '#7a2230'); this.ell(ctx, 99, 170.8, 1, 1.2, 'rgba(255,255,255,0.75)');
    } else {
      // yelek
      const vest = this.mix(L.pants, coat, 0.4);
      for (const k of [-1, 1]) {
        ctx.fillStyle = k < 0 ? this.sh(vest, 0.05) : this.sh(vest, -0.25);
        ctx.beginPath(); ctx.moveTo(100 + k * 20, 240); ctx.lineTo(100 + k * 17, 172); ctx.lineTo(100 + k * 4, 204); ctx.lineTo(100 + k * 4, 240); ctx.fill();
      }
      // gömlek yakası
      for (const k of [-1, 1]) {
        ctx.fillStyle = k < 0 ? this.sh(shirt, 0.14) : this.sh(shirt, -0.08);
        ctx.beginPath(); ctx.moveTo(100 + k * 15, 154); ctx.lineTo(100 + k * 2, 170); ctx.lineTo(100 + k * 9, 184); ctx.lineTo(100 + k * 19, 164); ctx.closePath(); ctx.fill();
      }
      if (P.hat === 'cowboy' || P.hat === 'wide' || !P.hat) {
        // bandana: boyna sarılı, önde düğüm ve iki sarkan uç
        const bc = L.shirt === '#b04a3a' ? '#2e4a6a' : '#8a3028';
        ctx.fillStyle = this.sh(bc, -0.1);
        ctx.beginPath(); ctx.moveTo(84, 158); ctx.quadraticCurveTo(100, 170, 116, 158); ctx.lineTo(114, 166); ctx.quadraticCurveTo(100, 178, 86, 166); ctx.closePath(); ctx.fill();
        ctx.fillStyle = bc;
        ctx.beginPath(); ctx.moveTo(92, 170); ctx.lineTo(108, 170); ctx.lineTo(100, 196); ctx.closePath(); ctx.fill();
        ctx.fillStyle = this.sh(bc, -0.25);
        ctx.beginPath(); ctx.moveTo(99, 176); ctx.quadraticCurveTo(93, 196, 88, 214); ctx.lineTo(95, 212); ctx.quadraticCurveTo(98, 196, 101, 178); ctx.fill();
        ctx.beginPath(); ctx.moveTo(101, 176); ctx.quadraticCurveTo(107, 196, 113, 212); ctx.lineTo(106, 214); ctx.quadraticCurveTo(102, 196, 99, 178); ctx.fill();
        this.ell(ctx, 100, 174, 5, 4.4, this.sh(bc, -0.15)); this.soft(ctx, 98.5, 172.5, 2.5, 2, this.sh(bc, 0.3), 0.8);
      } else {
        ctx.strokeStyle = '#1a1210'; ctx.lineWidth = 1.8;
        ctx.beginPath(); ctx.moveTo(100, 172); ctx.lineTo(97, 200); ctx.moveTo(100, 172); ctx.lineTo(103, 200); ctx.stroke();
        this.ell(ctx, 100, 172, 3.4, 2.4, '#1a1210');
      }
    }
    // palto yakaları
    for (const k of [-1, 1]) {
      ctx.fillStyle = k < 0 ? this.sh(coat, 0.14) : this.sh(coat, -0.3);
      ctx.beginPath(); ctx.moveTo(100 + k * 18, 158); ctx.lineTo(100 + k * (duster ? 44 : 34), 172); ctx.lineTo(100 + k * (duster ? 32 : 26), 184); ctx.lineTo(100 + k * 30, 190);
      ctx.lineTo(100 + k * 22, 240); ctx.lineTo(100 + k * 20, 240); ctx.lineTo(100 + k * 15, 198); ctx.closePath(); ctx.fill();
    }
    this.ell(ctx, 128, 214, 2, 2, this.sh(coat, -0.5)); this.ell(ctx, 128, 230, 2, 2, this.sh(coat, -0.5));
  },

  neck(ctx, P) {
    const s = P.skin;
    ctx.fillStyle = this.sh(s, -0.08);
    ctx.beginPath(); ctx.moveTo(86, 128); ctx.lineTo(114, 128); ctx.lineTo(115, 154); ctx.quadraticCurveTo(100, 160, 85, 154); ctx.fill();
    this.soft(ctx, 102, 136, 16, 10, this.sh(s, -0.45), 0.6);
  },

  /* Baş şekli: erkekte köşeli çene, kadında yumuşak */
  headPath(ctx, P) {
    const fw = P.fw, cy = P.cy, f = P.f;
    ctx.beginPath();
    ctx.moveTo(100, cy - 44);
    ctx.bezierCurveTo(100 + fw * 0.8, cy - 44, 100 + fw + 2, cy - 26, 100 + fw, cy - 4);
    if (f) { ctx.bezierCurveTo(100 + fw, cy + 16, 100 + fw * 0.7, cy + 34, 100 + 8, cy + 40); ctx.quadraticCurveTo(100, cy + 44, 100 - 8, cy + 40); ctx.bezierCurveTo(100 - fw * 0.7, cy + 34, 100 - fw, cy + 16, 100 - fw, cy - 4); }
    else { ctx.bezierCurveTo(100 + fw, cy + 14, 100 + fw - 2, cy + 26, 100 + fw - 8, cy + 32); ctx.quadraticCurveTo(100 + 14, cy + 42, 100 + 9, cy + 43); ctx.lineTo(100 - 9, cy + 43); ctx.quadraticCurveTo(100 - 14, cy + 42, 100 - fw + 8, cy + 32); ctx.bezierCurveTo(100 - fw + 2, cy + 26, 100 - fw, cy + 14, 100 - fw, cy - 4); }
    ctx.bezierCurveTo(100 - fw - 2, cy - 26, 100 - fw * 0.8, cy - 44, 100, cy - 44);
    ctx.closePath();
  },
  head(ctx, P) {
    const s = P.skin, fw = P.fw, cy = P.cy;
    for (const k of [-1, 1]) {
      const x = 100 + k * (fw + 1);
      this.ell(ctx, x, cy + 4, 6.5, 11, k < 0 ? s : this.sh(s, -0.12));
      this.ell(ctx, x + k * 0.8, cy + 4, 3.4, 7, this.sh(s, -0.22));
      this.ell(ctx, x - k * 0.4, cy + 3, 2.4, 5.4, k < 0 ? s : this.sh(s, -0.12));
    }
    this.fillClip(ctx, () => this.headPath(ctx, P), s, () => {
      this.soft(ctx, 100 + fw * 0.95, cy + 6, 20, 46, this.sh(s, -0.3), 0.55);
      this.soft(ctx, 86, cy - 26, 22, 12, this.sh(s, 0.25), 0.45);
      for (const k of [-1, 1]) this.soft(ctx, 100 + k * 19, cy + 14, 10, 7, '#d8705a', P.f ? 0.28 : 0.18);
      this.soft(ctx, 100, cy + 44, 30, 8, this.sh(s, -0.4), 0.35);
    });
  },

  face(ctx, P) {
    const s = P.skin, cy = P.cy, f = P.f, L = P.look;
    const eyeY = cy - 3, ex = 13;
    const brow = P.grey > 0.5 ? this.mix(P.hair, '#8a8278', 0.3) : this.sh(P.hair, -0.3);
    for (const k of [-1, 1]) this.soft(ctx, 100 + k * ex, eyeY - 2, 11, 6, this.sh(s, -0.3), 0.35);
    for (const k of [-1, 1]) {
      const x = 100 + k * ex;
      // göz akı (badem biçimli)
      const eye = () => { ctx.beginPath(); ctx.moveTo(x - 7, eyeY + 0.5); ctx.quadraticCurveTo(x - 1, eyeY - (f ? 5.6 : 5), x + 7, eyeY); ctx.quadraticCurveTo(x, eyeY + 3.4, x - 7, eyeY + 0.5); ctx.closePath(); };
      this.fillClip(ctx, eye, '#f7f2ea', () => {
        const ir = this.rgb(L.eyes || '#3a2a1a');
        ctx.fillStyle = this.rad(ctx, x + 0.4, eyeY + 0.6, 0.4, x + 0.4, eyeY, 3.8, [[0, this.css(ir.map(v => Math.min(255, v * 1.5)))], [1, this.css(ir.map(v => v * 0.6))]]);
        ctx.beginPath(); ctx.arc(x + 0.4, eyeY - 0.3, 3.7, 0, TAU); ctx.fill();
        this.ell(ctx, x + 0.4, eyeY - 0.3, 1.6, 1.6, '#120c08');
        this.ell(ctx, x, eyeY - 4.2, 9, 2.2, 'rgba(0,0,0,0.18)');
      });
      this.ell(ctx, x - 0.9, eyeY - 1.4, 1, 1, '#ffffff');
      // üst kapak: kalın koyu çizgi
      ctx.strokeStyle = '#2a1a12'; ctx.lineWidth = f ? 1.8 : 1.4; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x - 7.4, eyeY + 0.6); ctx.quadraticCurveTo(x - 1, eyeY - (f ? 6 : 5.4), x + 7.4, eyeY + 0.2); ctx.stroke();
      if (f) { ctx.lineWidth = 1.1; ctx.beginPath(); ctx.moveTo(x + k * 6.6, eyeY - 1); ctx.lineTo(x + k * 8.6, eyeY - 2.8); ctx.stroke(); }
      ctx.strokeStyle = this.sh(s, -0.3, 0.7); ctx.lineWidth = 0.9;
      ctx.beginPath(); ctx.moveTo(x - 6, eyeY - 6.8); ctx.quadraticCurveTo(x, eyeY - 9, x + 6, eyeY - 6.8); ctx.stroke();
      // kaş: kalın, düz, içte dolgun
      ctx.fillStyle = brow;
      const by = eyeY - (f ? 11.5 : 10.5), th = f ? 2.2 : 3.6;
      ctx.beginPath();
      ctx.moveTo(x - k * 8.5, by + 1);
      ctx.quadraticCurveTo(x, by - 3 - (f ? 1 : 0), x + k * 9.5, by + 0.6);
      ctx.lineTo(x + k * 9.5, by + 1.6);
      ctx.quadraticCurveTo(x, by - 2.6 + th, x - k * 8.5, by + 1 + th);
      ctx.closePath(); ctx.fill();
    }
    // burun: yuvarlak uç, yumuşak gölge, delikler
    const ny = cy + 17;
    this.soft(ctx, 105, (eyeY + ny) / 2 + 3, 3.4, 11, this.sh(s, -0.35), 0.35);
    this.soft(ctx, 100, ny + 1, 9, 6, this.sh(s, -0.35), 0.5);
    this.ell(ctx, 100, ny - 1.5, f ? 4.6 : 5.6, f ? 4 : 4.6, this.sh(s, 0.04));
    this.soft(ctx, 98.2, ny - 3, 2.6, 1.8, '#ffffff', 0.45);
    this.ell(ctx, 96, ny + 1.8, 2.1, 1.1, this.sh(s, -0.5)); this.ell(ctx, 104, ny + 1.8, 2.1, 1.1, this.sh(s, -0.55));
    // ağız
    const my = cy + 28, mw = f ? 9 : 10;
    const lip = f ? this.mix(s, '#b04a48', 0.5) : this.mix(s, '#a05a4a', 0.25);
    ctx.fillStyle = this.sh(lip, -0.1);
    ctx.beginPath(); ctx.moveTo(100 - mw, my); ctx.quadraticCurveTo(100 - 4, my - (f ? 3.6 : 2.8), 100, my - 1.6); ctx.quadraticCurveTo(100 + 4, my - (f ? 3.6 : 2.8), 100 + mw, my); ctx.quadraticCurveTo(100, my + 1, 100 - mw, my); ctx.fill();
    ctx.fillStyle = lip;
    ctx.beginPath(); ctx.moveTo(100 - mw + 1, my + 0.4); ctx.quadraticCurveTo(100, my + (f ? 6 : 4.8), 100 + mw - 1, my + 0.4); ctx.quadraticCurveTo(100, my + 1.2, 100 - mw + 1, my + 0.4); ctx.fill();
    this.soft(ctx, 98, my + 2.4, 3, 1, '#ffffff', 0.3);
    ctx.strokeStyle = this.sh(lip, -0.5); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(100 - mw, my); ctx.quadraticCurveTo(100, my + 1.3, 100 + mw, my); ctx.stroke();
    this.soft(ctx, 100, my + 8, 6, 2.4, this.sh(s, -0.3), 0.4);
    // yaşlılık çizgileri
    const a = P.aging;
    if (a > 0) {
      ctx.strokeStyle = `rgba(90,50,30,${0.14 + a * 0.3})`; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(87, cy - 24); ctx.quadraticCurveTo(100, cy - 26, 113, cy - 24); ctx.stroke();
      if (a > 0.3) { ctx.beginPath(); ctx.moveTo(89, cy - 29); ctx.quadraticCurveTo(100, cy - 31, 111, cy - 29); ctx.stroke(); }
      ctx.beginPath(); ctx.moveTo(93, ny + 4); ctx.quadraticCurveTo(88, my, 90, my + 6); ctx.moveTo(107, ny + 4); ctx.quadraticCurveTo(112, my, 110, my + 6); ctx.stroke();
      for (const k of [-1, 1]) { const x = 100 + k * 21; ctx.beginPath(); ctx.moveTo(x, eyeY - 1); ctx.lineTo(x + k * 4, eyeY - 3); ctx.moveTo(x, eyeY + 1); ctx.lineTo(x + k * 4, eyeY + 2); ctx.stroke(); }
    }
  },

  /* Zikzak kenarlı sakal kütlesi: yanaklardan çeneye, ağız açıklığıyla */
  beardShape(ctx, P, len, top) {
    const fw = P.fw, cy = P.cy, my = cy + 28;
    ctx.beginPath();
    ctx.moveTo(100 - fw + 0.5, cy + top);
    ctx.bezierCurveTo(100 - fw + 1, cy + 22, 100 - fw + 6, cy + 30, 100 - 18, cy + 38 + len * 0.5);
    // alt kenar: dişli
    const n = 11, x0 = 100 - 18, x1 = 100 + 18;
    for (let i = 1; i <= n; i++) {
      const t = i / n, x = lerp(x0, x1, t), yb = cy + 38 + len * (0.5 + 0.5 * Math.sin(t * Math.PI));
      ctx.lineTo(x - (x1 - x0) / n / 2, yb + 3.5); ctx.lineTo(x, yb);
    }
    ctx.bezierCurveTo(100 + fw - 6, cy + 30, 100 + fw - 1, cy + 22, 100 + fw - 0.5, cy + top);
    // iç kenar: yanaktan ağız çevresine
    ctx.lineTo(100 + fw - 3, cy + top + 1);
    ctx.bezierCurveTo(100 + fw - 8, cy + top + 12, 100 + 20, cy + 24, 100 + 12, my + 2);
    ctx.quadraticCurveTo(100, my + 7, 100 - 12, my + 2);
    ctx.bezierCurveTo(100 - 20, cy + 24, 100 - fw + 8, cy + top + 12, 100 - fw + 3, cy + top + 1);
    ctx.closePath();
  },
  beard(ctx, P) {
    const L = P.look, b = L.beard;
    if (P.f || !b) return;
    const bl = L.beardLen === undefined ? 1 : L.beardLen;
    if (bl <= 0.05) return;
    const h = P.hair, cy = P.cy, my = cy + 28, ny = cy + 17;
    if (b === 3) {
      // kirli sakal: çene boyunca yarı saydam gölge
      this.fillClip(ctx, () => this.beardShape(ctx, P, 0, 6), this.sh(h, -0.05, 0.28), () => this.soft(ctx, 100, cy + 40, 26, 10, this.sh(h, -0.2), 0.3));
      ctx.fillStyle = this.sh(h, -0.05, 0.22);
      ctx.beginPath(); ctx.moveTo(90, ny + 5); ctx.quadraticCurveTo(100, ny + 3, 110, ny + 5); ctx.lineTo(111, my - 1); ctx.quadraticCurveTo(100, my - 3, 89, my - 1); ctx.closePath(); ctx.fill();
    }
    if (b === 4) {
      const len = 4 + bl * 16;
      this.fillClip(ctx, () => this.beardShape(ctx, P, len, 4), this.css(this.rgb(h)), () => {
        this.soft(ctx, 86, cy + 22, 14, 12, this.sh(h, 0.25), 0.45);
        this.soft(ctx, 114, cy + 34, 14, 24, this.sh(h, -0.4), 0.55);
        this.soft(ctx, 100, cy + 50 + len, 26, 10, this.sh(h, -0.35), 0.5);
      });
    }
    if (b === 2) {
      // keçi sakalı: dudak altı ve çene, dişli uç
      const len = 5 + bl * 9;
      ctx.fillStyle = h;
      ctx.beginPath(); ctx.moveTo(95, my + 4); ctx.quadraticCurveTo(100, my + 5.5, 105, my + 4); ctx.lineTo(103, my + 7); ctx.lineTo(97, my + 7); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(91, my + 9);
      ctx.quadraticCurveTo(100, my + 7, 109, my + 9);
      ctx.lineTo(107, my + 9 + len * 0.7); ctx.lineTo(104, my + 9 + len * 0.6); ctx.lineTo(102, my + 9 + len); ctx.lineTo(100, my + 9 + len * 0.75); ctx.lineTo(98, my + 9 + len); ctx.lineTo(96, my + 9 + len * 0.6); ctx.lineTo(93, my + 9 + len * 0.7);
      ctx.closePath(); ctx.fill();
      this.soft(ctx, 103, my + 12, 4, 5, this.sh(h, -0.4), 0.5);
    }
    if (b === 1 || b === 2 || b === 4) {
      // bıyık: kalın, uçları yukarı kıvrık (burma bıyık)
      const curl = b === 1 ? 1 : b === 2 ? 0.7 : 0.35;
      const path = () => {
        ctx.beginPath();
        for (const k of [1, -1]) {
          ctx.moveTo(100, ny + 4);
          ctx.bezierCurveTo(100 + k * 6, ny + 2, 100 + k * 13, ny + 4, 100 + k * 15, my - 1);
          ctx.quadraticCurveTo(100 + k * (17 + curl * 5), my + 1, 100 + k * (19 + curl * 4), my - 3 - curl * 5);
          ctx.quadraticCurveTo(100 + k * (21 + curl * 3), my + 3, 100 + k * 13, my + 2);
          ctx.quadraticCurveTo(100 + k * 6, my - 0.5, 100, my - 1.6);
          ctx.closePath();
        }
      };
      this.fillClip(ctx, path, this.sh(h, -0.08), () => {
        this.soft(ctx, 94, ny + 5, 6, 3, this.sh(h, 0.3), 0.6);
        this.soft(ctx, 108, my, 8, 3, this.sh(h, -0.35), 0.5);
      });
    }
  },

  hairFront(ctx, P) {
    const hs = P.look.hairStyle, h = P.hair, fw = P.fw, cy = P.cy;
    const top = cy - 44;
    if (hs === 3) {
      // kazınmış: kafa derisine yakın, çok kısa saç gölgesi
      ctx.save(); this.headPath(ctx, P); ctx.clip();
      ctx.fillStyle = this.lin(ctx, 0, top, 0, cy - 22, [[0, this.mix(P.skin, h, 0.45, 0.6)], [0.85, this.mix(P.skin, h, 0.35, 0.35)], [1, this.mix(P.skin, h, 0.3, 0)]]);
      ctx.beginPath(); ctx.moveTo(100 - fw - 4, cy - 4); ctx.quadraticCurveTo(100 - fw, top - 6, 100, top - 2); ctx.quadraticCurveTo(100 + fw, top - 6, 100 + fw + 4, cy - 4); ctx.lineTo(100 + fw - 4, cy - 12); ctx.quadraticCurveTo(100, cy - 30, 100 - fw + 4, cy - 12); ctx.closePath(); ctx.fill();
      this.soft(ctx, 88, top + 8, 16, 7, '#ffffff', 0.25);
      ctx.restore();
      return;
    }
    ctx.save();
    if (P.hat) { ctx.beginPath(); ctx.rect(0, cy - (P.hat === 'flat' ? 30 : 32), 200, 200); ctx.clip(); }
    const vol = hs === 4 ? 8 : hs === 1 ? 5 : 3;
    const hairline = P.f ? cy - 26 : cy - 28;
    const mass = () => {
      ctx.beginPath();
      ctx.moveTo(100 - fw - 3, cy + (hs === 1 || P.f ? 14 : 2));
      ctx.bezierCurveTo(100 - fw - vol - 4, cy - 30, 100 - fw * 0.7, top - vol - 6, 100, top - vol - 5);
      ctx.bezierCurveTo(100 + fw * 0.7, top - vol - 6, 100 + fw + vol + 4, cy - 30, 100 + fw + 3, cy + (hs === 1 || P.f ? 14 : 2));
      ctx.lineTo(100 + fw - 1, cy - 4);
      if (P.f) { ctx.quadraticCurveTo(100 + fw - 4, hairline - 4, 100 + 6, hairline - 6); ctx.quadraticCurveTo(100 - 8, hairline + 2, 100 - fw + 2, cy - 4); }
      else if (hs === 4) { const st = (fw * 2 - 6) / 5; for (let i = 0; i < 5; i++) { const x = 100 + fw - 3 - i * st; ctx.quadraticCurveTo(x - st / 2, hairline + 7, x - st, hairline); } ctx.lineTo(100 - fw + 1, cy - 4); }
      else { ctx.quadraticCurveTo(100 + fw - 2, hairline, 100 + 14, hairline - 2); ctx.quadraticCurveTo(100 - 6, hairline - 6, 100 - 12, hairline + 1); ctx.quadraticCurveTo(100 - fw + 2, hairline + 2, 100 - fw + 1, cy - 4); }
      ctx.closePath();
    };
    this.fillClip(ctx, mass, this.css(this.rgb(h)), () => {
      this.soft(ctx, 86, top + 2, 22, 9, this.sh(h, 0.35), 0.55);
      this.soft(ctx, 120, cy - 20, 16, 24, this.sh(h, -0.35), 0.5);
      ctx.strokeStyle = this.sh(h, -0.3, 0.6); ctx.lineWidth = 1;
      for (let i = 0; i < 5; i++) { const x = 84 + i * 8; ctx.beginPath(); ctx.moveTo(x, top - 2); ctx.quadraticCurveTo(x + 6, top + 6, x + 10, hairline + 4); ctx.stroke(); }
    });
    if (!P.f && hs !== 1) {
      ctx.fillStyle = this.css(this.rgb(h));
      for (const k of [-1, 1]) { ctx.beginPath(); ctx.moveTo(100 + k * (fw + 0.5), cy - 10); ctx.lineTo(100 + k * (fw - 3.4), cy - 10); ctx.lineTo(100 + k * (fw - 2.6), cy + 9); ctx.lineTo(100 + k * (fw + 0.5), cy + 9); ctx.fill(); }
    }
    ctx.restore();
    // uzun saç: omuza düşen lüleler
    if (hs === 1 || (P.f && hs !== 2)) {
      for (const k of [-1, 1]) {
        const x = 100 + k * (fw + 2);
        const lock = () => {
          ctx.beginPath(); ctx.moveTo(x - k * 7, cy - 14);
          if (hs === 4) { ctx.bezierCurveTo(x + k * 12, cy + 10, x - k * 2, cy + 30, x + k * 9, cy + 52); ctx.quadraticCurveTo(x + k * 15, cy + 66, x + k * 4, cy + 74); ctx.bezierCurveTo(x - k * 6, cy + 50, x + k * 1, cy + 26, x - k * 6, cy + 10); }
          else { ctx.bezierCurveTo(x + k * 12, cy + 6, x + k * 14, cy + 40, x + k * 9, cy + (P.f ? 76 : 62)); ctx.quadraticCurveTo(x + k * 4, cy + (P.f ? 80 : 66), x - k * 2, cy + (P.f ? 70 : 58)); ctx.bezierCurveTo(x + k * 2, cy + 36, x - k * 1, cy + 12, x - k * 9, cy); }
          ctx.closePath();
        };
        this.fillClip(ctx, lock, this.css(this.rgb(h)), () => {
          this.soft(ctx, x - k * 3, cy + 16, 5, 26, this.sh(h, 0.3), 0.55);
          this.soft(ctx, x + k * 6, cy + 50, 6, 26, this.sh(h, -0.35), 0.55);
        });
      }
    }
    if (P.f && hs === 2) {
      ctx.strokeStyle = this.sh(h, -0.3, 0.55); ctx.lineWidth = 1;
      for (let i = 0; i < 5; i++) for (const k of [-1, 1]) { const y = cy - 18 + i * 4; ctx.beginPath(); ctx.moveTo(100 + k * (fw - 2), y + 12); ctx.quadraticCurveTo(100 + k * (fw - 6), y, 100 + k * 6, top + i * 2); ctx.stroke(); }
    }
  },

  /* Şapkalar: kovboy (tepe çukurları, iki yanı kalkık geniş kenar), geniş kenar, melon, kasket */
  hatDraw(ctx, P) {
    const L = P.look, t = P.hat;
    if (!t) return;
    const hc = L.hatCol, cy = P.cy;
    const band = '#b89468';
    // alna düşen gölge
    ctx.save(); this.headPath(ctx, P); ctx.clip();
    ctx.fillStyle = this.lin(ctx, 0, cy - 36, 0, cy - 14, [[0, 'rgba(40,20,10,0.5)'], [1, 'rgba(40,20,10,0)']]);
    ctx.fillRect(60, cy - 44, 80, 34);
    ctx.restore();
    if (t === 'cowboy' || t === 'wide') {
      const bw = t === 'wide' ? 78 : 70, by = cy - 30, ch = t === 'wide' ? 36 : 46;
      ctx.fillStyle = this.sh(hc, -0.3);
      ctx.beginPath(); ctx.ellipse(100, by - 4, bw - 6, 14, 0, Math.PI, 0); ctx.fill();
      const crown = () => {
        ctx.beginPath();
        ctx.moveTo(68, by);
        if (t === 'cowboy') { ctx.bezierCurveTo(66, by - ch * 0.55, 76, by - ch, 90, by - ch + 1); ctx.quadraticCurveTo(100, by - ch + 7, 110, by - ch + 1); ctx.bezierCurveTo(124, by - ch, 134, by - ch * 0.55, 132, by); }
        else { ctx.bezierCurveTo(68, by - ch * 0.85, 76, by - ch, 100, by - ch); ctx.bezierCurveTo(124, by - ch, 132, by - ch * 0.85, 132, by); }
        ctx.closePath();
      };
      this.fillClip(ctx, crown, this.css(this.rgb(hc)), () => {
        this.soft(ctx, 84, by - ch * 0.6, 14, 22, this.sh(hc, 0.2), 0.6);
        this.soft(ctx, 124, by - ch * 0.4, 12, 26, this.sh(hc, -0.35), 0.6);
        if (t === 'cowboy') { this.soft(ctx, 100, by - ch + 6, 10, 5, this.sh(hc, -0.4), 0.7); this.soft(ctx, 80, by - ch * 0.5, 4, 10, this.sh(hc, -0.3), 0.55); this.soft(ctx, 120, by - ch * 0.5, 4, 10, this.sh(hc, -0.45), 0.55); }
        ctx.fillStyle = band; ctx.fillRect(60, by - 11, 80, 6);
        ctx.fillStyle = this.sh(band, -0.25); ctx.fillRect(60, by - 6, 80, 1.2);
      });
      const up = t === 'cowboy' ? 16 : 5;
      const brim = () => {
        ctx.beginPath();
        ctx.moveTo(100 - bw, by - up);
        ctx.bezierCurveTo(100 - bw - 4, by - up + 12, 100 - bw * 0.7, by + 6, 100 - bw * 0.4, by + 4);
        ctx.quadraticCurveTo(100, by + 10, 100 + bw * 0.4, by + 4);
        ctx.bezierCurveTo(100 + bw * 0.7, by + 6, 100 + bw + 4, by - up + 12, 100 + bw, by - up);
        ctx.bezierCurveTo(100 + bw - 4, by - 2, 100 + bw * 0.6, by - 6, 100, by - 5);
        ctx.bezierCurveTo(100 - bw * 0.6, by - 6, 100 - bw + 4, by - 2, 100 - bw, by - up);
        ctx.closePath();
      };
      this.fillClip(ctx, brim, this.css(this.rgb(hc)), () => {
        this.soft(ctx, 100 - bw * 0.6, by - 2, bw * 0.35, 8, this.sh(hc, 0.18), 0.6);
        this.soft(ctx, 100, by + 6, bw * 0.5, 5, this.sh(hc, -0.4), 0.7);
        this.soft(ctx, 100 + bw * 0.75, by - 2, bw * 0.25, 8, this.sh(hc, -0.3), 0.6);
      });
    } else if (t === 'bowler') {
      const by = cy - 30;
      this.fillClip(ctx, () => { ctx.beginPath(); ctx.moveTo(67, by); ctx.bezierCurveTo(64, by - 46, 136, by - 46, 133, by); ctx.closePath(); }, this.css(this.rgb(hc)), () => {
        this.soft(ctx, 86, by - 24, 16, 12, this.sh(hc, 0.3), 0.6);
        this.soft(ctx, 124, by - 12, 12, 18, this.sh(hc, -0.4), 0.6);
        ctx.fillStyle = this.sh(hc, -0.45); ctx.fillRect(60, by - 8, 80, 6);
      });
      this.fillClip(ctx, () => { ctx.beginPath(); ctx.moveTo(54, by - 3); ctx.quadraticCurveTo(100, by + 14, 146, by - 3); ctx.quadraticCurveTo(100, by + 4, 54, by - 3); ctx.closePath(); }, this.sh(hc, -0.15));
    } else if (t === 'flat') {
      const by = cy - 30;
      this.fillClip(ctx, () => { ctx.beginPath(); ctx.moveTo(62, by + 2); ctx.bezierCurveTo(58, by - 34, 142, by - 34, 138, by + 2); ctx.quadraticCurveTo(100, by + 6, 62, by + 2); ctx.closePath(); }, this.css(this.rgb(hc)), () => {
        this.soft(ctx, 86, by - 18, 18, 10, this.sh(hc, 0.25), 0.6);
        this.soft(ctx, 126, by - 6, 14, 14, this.sh(hc, -0.4), 0.6);
        ctx.strokeStyle = this.sh(hc, -0.3, 0.7); ctx.lineWidth = 1;
        for (const k of [-1, 1]) { ctx.beginPath(); ctx.moveTo(100, by - 25); ctx.quadraticCurveTo(100 + k * 22, by - 18, 100 + k * 36, by); ctx.stroke(); }
      });
      this.ell(ctx, 100, by - 26, 3, 1.8, this.sh(hc, -0.3));
      this.fillClip(ctx, () => { ctx.beginPath(); ctx.moveTo(72, by + 1); ctx.quadraticCurveTo(100, by + 15, 128, by + 1); ctx.quadraticCurveTo(100, by + 6, 72, by + 1); ctx.closePath(); }, this.sh(hc, -0.3));
    }
  },
};

Spr.portrait = (ctx, W, H, look, age) => PortraitArt.draw(ctx, W, H, look, age);
