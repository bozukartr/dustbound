'use strict';
/* =====================================================================
   3B TEST DEMOSU — çizici (yalnızca dist-demo3d paketine girer; oyunun dosyalarına dokunmaz)

   Önizlemedeki 3B piksel çizicinin oyuna uyarlanmış hâli. Görüntü oyunun kendi tuvaliyle aynı boyda,
   oyunun kamerasıyla çizilir. İzdüşüm "yer düzlemini koruyan" eğik bakıştır:
       ekran x = (X − x0) · ds,   ekran y = (Z − K·Y − y0) · ds
   (X doğu, Y yukarı, Z güney; 1 birim = oyunun 1 dünya pikseli). Yer 2D ile bire bir örtüştüğü için
   oyunun 2D arayüzü (adlar, çubuklar, mermiler, parçacıklar), fare nişanı ve DOM işaretleri hiç
   değişmeden 3B görüntünün üstüne oturur. Bu, K = ctg(θ) eğimli dik bir kameranın dikeyde 1/sin(θ)
   kadar gerilmiş hâline eşittir: derinlik (0, 1, K) yönündedir, ışık ve normaller dünyada doğrudur.

   Üç geçiş: güneş gölge haritası (görünen alana oturtulur), G-tamponu (renk + malzeme, normal + güneş),
   birleştirme (oyunun 5 tonlu rampası, Bayer titreşimi, seçici dış hat, iç çizgi, lambalar).
   Her şey tek ad alanında (D3): oyunun genel adlarıyla çakışmaz.
   ===================================================================== */
const D3 = window.D3 = window.D3 || {};
(() => {
  /* ---------------- matematik ---------------- */
  const V3 = {
    sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
    add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
    mul: (a, s) => [a[0] * s, a[1] * s, a[2] * s],
    dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
    cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
    len: (a) => Math.hypot(a[0], a[1], a[2]),
    norm: (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
    lerp: (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t],
  };
  const M4 = {
    ident() { const m = new Float32Array(16); m[0] = m[5] = m[10] = m[15] = 1; return m; },
    mul(a, b, o = new Float32Array(16)) {
      for (let c = 0; c < 4; c++) {
        const b0 = b[c * 4], b1 = b[c * 4 + 1], b2 = b[c * 4 + 2], b3 = b[c * 4 + 3];
        o[c * 4] = a[0] * b0 + a[4] * b1 + a[8] * b2 + a[12] * b3;
        o[c * 4 + 1] = a[1] * b0 + a[5] * b1 + a[9] * b2 + a[13] * b3;
        o[c * 4 + 2] = a[2] * b0 + a[6] * b1 + a[10] * b2 + a[14] * b3;
        o[c * 4 + 3] = a[3] * b0 + a[7] * b1 + a[11] * b2 + a[15] * b3;
      }
      return o;
    },
    ortho(l, r, b, t, n, f) {
      const m = new Float32Array(16);
      m[0] = 2 / (r - l); m[5] = 2 / (t - b); m[10] = -2 / (f - n);
      m[12] = -(r + l) / (r - l); m[13] = -(t + b) / (t - b); m[14] = -(f + n) / (f - n); m[15] = 1;
      return m;
    },
    lookAt(eye, at, up) {
      const z = V3.norm(V3.sub(eye, at)), x = V3.norm(V3.cross(up, z)), y = V3.cross(z, x);
      const m = new Float32Array(16);
      m[0] = x[0]; m[4] = x[1]; m[8] = x[2];
      m[1] = y[0]; m[5] = y[1]; m[9] = y[2];
      m[2] = z[0]; m[6] = z[1]; m[10] = z[2];
      m[12] = -V3.dot(x, eye); m[13] = -V3.dot(y, eye); m[14] = -V3.dot(z, eye); m[15] = 1;
      return m;
    },
    translate(x, y, z) { const m = M4.ident(); m[12] = x; m[13] = y; m[14] = z; return m; },
    scale(x, y, z) { const m = M4.ident(); m[0] = x; m[5] = y; m[10] = z; return m; },
    rotX(a) { const m = M4.ident(), c = Math.cos(a), s = Math.sin(a); m[5] = c; m[6] = s; m[9] = -s; m[10] = c; return m; },
    rotY(a) { const m = M4.ident(), c = Math.cos(a), s = Math.sin(a); m[0] = c; m[2] = -s; m[8] = s; m[10] = c; return m; },
    rotZ(a) { const m = M4.ident(), c = Math.cos(a), s = Math.sin(a); m[0] = c; m[1] = s; m[4] = -s; m[5] = c; return m; },
    invert(m) {
      const o = new Float32Array(16);
      const a00 = m[0], a01 = m[1], a02 = m[2], a03 = m[3], a10 = m[4], a11 = m[5], a12 = m[6], a13 = m[7];
      const a20 = m[8], a21 = m[9], a22 = m[10], a23 = m[11], a30 = m[12], a31 = m[13], a32 = m[14], a33 = m[15];
      const b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10, b02 = a00 * a13 - a03 * a10, b03 = a01 * a12 - a02 * a11;
      const b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12, b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30;
      const b08 = a20 * a33 - a23 * a30, b09 = a21 * a32 - a22 * a31, b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
      let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
      if (!det) return M4.ident();
      det = 1 / det;
      o[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det; o[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
      o[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det; o[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
      o[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det; o[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
      o[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det; o[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
      o[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det; o[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
      o[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det; o[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
      o[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det; o[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
      o[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det; o[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;
      return o;
    },
    xform(m, p) { return [m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]]; },
    xdir(m, p) { return [m[0] * p[0] + m[4] * p[1] + m[8] * p[2], m[1] * p[0] + m[5] * p[1] + m[9] * p[2], m[2] * p[0] + m[6] * p[1] + m[10] * p[2]]; },
  };

  /* ---------------- renk ---------------- */
  const hexRgb = (h) => { let x = h.slice(1); if (x.length === 3) x = x[0] + x[0] + x[1] + x[1] + x[2] + x[2]; const n = parseInt(x, 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };
  const C = (h) => typeof h === 'string' ? hexRgb(h) : h;
  const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const shade = (c, k) => k < 0 ? [c[0] * (1 + k), c[1] * (1 + k), c[2] * (1 + k)] : [c[0] + (1 - c[0]) * k, c[1] + (1 - c[1]) * k, c[2] + (1 - c[2]) * k];
  // oyunun ton sabitleri (js/hybrid.js): gölge mora, ışık sıcak sarıya, mürekkep koyu kahve
  const SHD = [46 / 255, 36 / 255, 66 / 255], HIL = [1, 244 / 255, 210 / 255], INK = [16 / 255, 10 / 255, 8 / 255];

  /* ---------------- malzemeler ve bayraklar ---------------- */
  const MAT = {
    SOLID: 0, FOLIAGE: 1, WATER: 2, EMIT: 3, TERRAIN: 4, PLANKH: 5, PLANKV: 6, SHINGLE: 7, LOG: 8, FLOOR: 9,
    PAPER: 10, GLASS: 11, STRATA: 12, CLOTH: 13, HAIR: 14, FIRE: 15, STONE: 16, CHECK: 17, PLASTER: 18, BRICK: 19, STRAW: 20,
  };
  // aux.z: CUT kesitte kameraya bakan duvar alçalır; HIDECUT kesitte gizlenir (süs); ROOF kesitte gizlenir ama gölge düşürür;
  // HOLE oyuncunun önünü kapatınca oyuncunun çevresinde delinir (taç, saçak)
  const F = { CUT: 1, HIDECUT: 2, ROOF: 4, NOSHADOW: 8, NOOUTLINE: 16, TWOSIDED: 32, HOLE: 64 };
  const SIDE = { e: 0, s: 0.25, w: 0.5, n: 0.75 };   // dış yön açısı / 2π (kesit için)

  /* ---------------- gürültü (JS) ---------------- */
  function hash3(x, y, z) { let h = (x * 374761393 + y * 668265263 + z * 1442695041) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
  function noise3(x, y, z) {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), xf = x - xi, yf = y - yi, zf = z - zi;
    const s = (t) => t * t * (3 - 2 * t), u = s(xf), v = s(yf), w = s(zf);
    const L = (a, b, t) => a + (b - a) * t;
    const h = (i, j, k) => hash3(xi + i, yi + j, zi + k);
    return L(L(L(h(0, 0, 0), h(1, 0, 0), u), L(h(0, 1, 0), h(1, 1, 0), u), v), L(L(h(0, 0, 1), h(1, 0, 1), u), L(h(0, 1, 1), h(1, 1, 1), u), v), w);
  }
  function RNG(seed) { let s = seed >>> 0 || 1; return () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  /* ---------------- geometri kurucu ----------------
     Köşeler doğrudan 32 baytlık düzene yazılır: konum 3f, normal 3f, renk 4u8 (a = malzeme), ek 4u8 (kemik, rüzgâr,
     bayrak, parametre). Dönüşüm yığını: döndürme + öteleme (+ ölçek); normaller aynı matrisle döner. */
  class Mesh {
    constructor(cap = 8192) {
      this.cap = cap; this.buf = new ArrayBuffer(cap * 32);
      this.f32 = new Float32Array(this.buf); this.u8 = new Uint8Array(this.buf);
      this.count = 0;
      this.st = { mat: 0, bone: 0, wind: 0, windBase: 0, windH: 0, flags: 0, param: 0 };
      this.M = M4.ident(); this.stack = [];
      this.bb = [1e9, 1e9, 1e9, -1e9, -1e9, -1e9];
    }
    grow() {
      const nb = new ArrayBuffer(this.cap * 2 * 32);
      new Uint8Array(nb).set(this.u8);
      this.buf = nb; this.cap *= 2; this.f32 = new Float32Array(nb); this.u8 = new Uint8Array(nb);
    }
    set(o) { Object.assign(this.st, o); return this; }
    push(m) { this.stack.push(this.M); this.M = M4.mul(this.M, m); return this; }
    pop() { this.M = this.stack.pop(); return this; }
    vw(p, n, c) {
      if (this.count >= this.cap) this.grow();
      const i = this.count++, f = i * 8, b = i * 32, st = this.st, bb = this.bb;
      this.f32[f] = p[0]; this.f32[f + 1] = p[1]; this.f32[f + 2] = p[2];
      this.f32[f + 3] = n[0]; this.f32[f + 4] = n[1]; this.f32[f + 5] = n[2];
      if (p[0] < bb[0]) bb[0] = p[0]; if (p[1] < bb[1]) bb[1] = p[1]; if (p[2] < bb[2]) bb[2] = p[2];
      if (p[0] > bb[3]) bb[3] = p[0]; if (p[1] > bb[4]) bb[4] = p[1]; if (p[2] > bb[5]) bb[5] = p[2];
      const u = this.u8;
      u[b + 24] = Math.max(0, Math.min(255, Math.round(c[0] * 255)));
      u[b + 25] = Math.max(0, Math.min(255, Math.round(c[1] * 255)));
      u[b + 26] = Math.max(0, Math.min(255, Math.round(c[2] * 255)));
      u[b + 27] = c[3] !== undefined ? c[3] : st.mat;
      u[b + 28] = st.bone;
      let w = st.wind;
      if (w && st.windH > 0) w *= Math.max(0, Math.min(1, (p[1] - st.windBase) / st.windH));
      u[b + 29] = Math.round(Math.max(0, Math.min(1, w)) * 255);
      u[b + 30] = st.flags;
      u[b + 31] = Math.round(Math.max(0, Math.min(1, st.param)) * 255);
    }
    // yerel üçgen: dönüşüm uygulanır, sargı normale göre düzeltilir
    tri(a, b, c, na, nb, nc, ca, cb, cc) {
      const M = this.M;
      const A = M4.xform(M, a), B = M4.xform(M, b), Cc = M4.xform(M, c);
      const NA = V3.norm(M4.xdir(M, na)), NB = V3.norm(M4.xdir(M, nb || na)), NC = V3.norm(M4.xdir(M, nc || na));
      const fn = V3.cross(V3.sub(B, A), V3.sub(Cc, A));
      const avg = [NA[0] + NB[0] + NC[0], NA[1] + NB[1] + NC[1], NA[2] + NB[2] + NC[2]];
      const cb2 = cb || ca, cc2 = cc || ca;
      if (V3.dot(fn, avg) < 0) { this.vw(A, NA, ca); this.vw(Cc, NC, cc2); this.vw(B, NB, cb2); }
      else { this.vw(A, NA, ca); this.vw(B, NB, cb2); this.vw(Cc, NC, cc2); }
    }
    quad(a, b, c, d, col, n) {
      const nn = n || V3.norm(V3.cross(V3.sub(b, a), V3.sub(d, a)));
      this.tri(a, b, c, nn, nn, nn, col); this.tri(a, c, d, nn, nn, nn, col);
    }
    /* kutu: merkez ve yarı boyutlar; col tek renk ya da {top, side, bottom, s, n, e, w}; skip: atlanacak yüzler */
    box(cx, cy, cz, sx, sy, sz, col, o = {}) {
      const x0 = cx - sx, x1 = cx + sx, y0 = cy - sy, y1 = cy + sy, z0 = cz - sz, z1 = cz + sz;
      const top = o.top || col, side = o.side || col, bot = o.bottom || side;
      const faces = [
        [[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1], [0, 1, 0], top, 'top'],
        [[x0, y0, z1], [x1, y0, z1], [x1, y0, z0], [x0, y0, z0], [0, -1, 0], bot, 'bottom'],
        [[x0, y0, z1], [x0, y1, z1], [x1, y1, z1], [x1, y0, z1], [0, 0, 1], o.s || side, 's'],
        [[x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z0], [0, 0, -1], o.n || side, 'n'],
        [[x1, y0, z1], [x1, y1, z1], [x1, y1, z0], [x1, y0, z0], [1, 0, 0], o.e || side, 'e'],
        [[x0, y0, z0], [x0, y1, z0], [x0, y1, z1], [x0, y0, z1], [-1, 0, 0], o.w || side, 'w'],
      ];
      for (const [a, b, c, d, n, cl, name] of faces) {
        if (o.skip && o.skip.includes(name)) continue;
        this.quad(a, b, c, d, cl, n);
      }
    }
    /* parametrik yüzey: P(u, v) -> yerel konum; normaller merkezden dışa */
    surf(nu, nv, P, col, center, closedU = true) {
      const pts = [];
      for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) pts.push(P(i / nu, j / nv));
      const at = (i, j) => {
        if (closedU) { i = ((i % nu) + nu) % nu; } else i = Math.max(0, Math.min(nu, i));
        j = Math.max(0, Math.min(nv, j));
        return pts[j * (nu + 1) + i];
      };
      const nor = [];
      for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
        const du = V3.sub(at(i + 1, j), at(i - 1, j)), dv = V3.sub(at(i, j + 1), at(i, j - 1));
        let n = V3.cross(dv, du);
        const p = at(i, j);
        if (V3.len(n) < 1e-6) n = V3.sub(p, center);
        n = V3.norm(n);
        if (V3.dot(n, V3.sub(p, center)) < 0) n = V3.mul(n, -1);
        nor.push(n);
      }
      const cf = typeof col === 'function' ? col : () => col;
      const cols = pts.map((p, k) => cf(p, nor[k]));
      for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
        const k00 = j * (nu + 1) + i, k10 = k00 + 1, k01 = k00 + nu + 1, k11 = k01 + 1;
        const a = pts[k00], b = pts[k10], c = pts[k11], d = pts[k01];
        if (V3.len(V3.cross(V3.sub(b, a), V3.sub(c, a))) > 1e-9) this.tri(a, b, c, nor[k00], nor[k10], nor[k11], cols[k00], cols[k10], cols[k11]);
        if (V3.len(V3.cross(V3.sub(c, a), V3.sub(d, a))) > 1e-9) this.tri(a, c, d, nor[k00], nor[k11], nor[k01], cols[k00], cols[k11], cols[k01]);
      }
    }
    /* elipsoit (isteğe bağlı gürültülü yarıçap: taç öbekleri, kaya); ymin: alttan kesme */
    ell(cx, cy, cz, rx, ry, rz, col, o = {}) {
      const nu = o.nu || 14, nv = o.nv || 9, amp = o.amp || 0, fr = o.fr || 2.3, seed = o.seed || 0;
      const ymin = o.ymin !== undefined ? o.ymin : -1;
      const P = (u, v) => {
        const th = u * Math.PI * 2, yy = ymin + (1 - ymin) * v, sv = Math.sqrt(Math.max(0, 1 - yy * yy));
        const x = Math.cos(th) * sv, y = yy, z = Math.sin(th) * sv;
        let r = 1;
        if (amp) r += (noise3(x * fr + seed, y * fr + seed * 1.7, z * fr - seed) - 0.5) * 2 * amp;
        return [cx + x * rx * r, cy + y * ry * r, cz + z * rz * r];
      };
      this.surf(nu, nv, P, col, [cx, cy, cz]);
    }
    /* iki nokta arasında boru (yarıçap r1 -> r2), uçlarda isteğe bağlı küre kapak */
    tube(a, b, r1, r2, col, o = {}) {
      const seg = o.seg || 8;
      const d = V3.sub(b, a), L = V3.len(d), ax = V3.norm(d);
      const ref = Math.abs(ax[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
      const u = V3.norm(V3.cross(ax, ref)), w = V3.cross(ax, u);
      const ring = (t, r) => { const out = []; for (let i = 0; i <= seg; i++) { const th = i / seg * Math.PI * 2; out.push(V3.add(V3.add(a, V3.mul(ax, L * t)), V3.add(V3.mul(u, Math.cos(th) * r), V3.mul(w, Math.sin(th) * r)))); } return out; };
      const r0 = ring(0, r1), r1g = ring(1, r2);
      const cf = typeof col === 'function' ? col : () => col;
      const sl = (r1 - r2) / L;
      for (let i = 0; i < seg; i++) {
        const th0 = i / seg * Math.PI * 2, th1 = (i + 1) / seg * Math.PI * 2;
        const n0 = V3.norm(V3.add(V3.add(V3.mul(u, Math.cos(th0)), V3.mul(w, Math.sin(th0))), V3.mul(ax, sl)));
        const n1 = V3.norm(V3.add(V3.add(V3.mul(u, Math.cos(th1)), V3.mul(w, Math.sin(th1))), V3.mul(ax, sl)));
        const c0 = cf(r0[i], n0, 0), c1 = cf(r1g[i], n0, 1);
        this.tri(r0[i], r0[i + 1], r1g[i + 1], n0, n1, n1, c0, c0, c1);
        this.tri(r0[i], r1g[i + 1], r1g[i], n0, n1, n0, c0, c1, c1);
      }
      if (o.caps !== false) {
        for (const [cen, r, dir] of [[a, r1, -1], [b, r2, 1]]) {
          if (r <= 0.01) continue;
          const axd = V3.mul(ax, dir);
          const P = (uu, vv) => {
            const th = uu * Math.PI * 2, ph = vv * Math.PI / 2;
            return V3.add(cen, V3.add(V3.mul(axd, Math.sin(ph) * r), V3.add(V3.mul(u, Math.cos(th) * Math.cos(ph) * r), V3.mul(w, Math.sin(th) * Math.cos(ph) * r))));
          };
          this.surf(seg, 3, P, (p, n) => cf(p, n, 0), cen);
        }
      }
    }
    /* dikey silindir / kesik koni: taban y=cy, yükseklik h */
    cyl(cx, cy, cz, r, h, col, o = {}) {
      const seg = o.seg || 10, r2 = o.r2 !== undefined ? o.r2 : r;
      const a0 = o.a0 || 0, a1 = o.a1 !== undefined ? o.a1 : Math.PI * 2;
      const cf = typeof col === 'function' ? col : () => col;
      const sl = (r - r2) / h;
      for (let i = 0; i < seg; i++) {
        const t0 = a0 + (a1 - a0) * i / seg, t1 = a0 + (a1 - a0) * (i + 1) / seg;
        const p00 = [cx + Math.cos(t0) * r, cy, cz + Math.sin(t0) * r], p10 = [cx + Math.cos(t1) * r, cy, cz + Math.sin(t1) * r];
        const p01 = [cx + Math.cos(t0) * r2, cy + h, cz + Math.sin(t0) * r2], p11 = [cx + Math.cos(t1) * r2, cy + h, cz + Math.sin(t1) * r2];
        const n0 = V3.norm([Math.cos(t0), sl, Math.sin(t0)]), n1 = V3.norm([Math.cos(t1), sl, Math.sin(t1)]);
        const c = cf((t0 + t1) / 2, i);
        this.tri(p00, p10, p11, n0, n1, n1, c);
        if (r2 > 0.001) this.tri(p00, p11, p01, n0, n1, n0, c);
        if (o.top !== false && r2 > 0.001) this.tri([cx, cy + h + (o.dome || 0), cz], p01, p11, [0, 1, 0], [0, 1, 0], [0, 1, 0], o.topCol || c);
        if (o.bottom) this.tri([cx, cy, cz], p10, p00, [0, -1, 0], [0, -1, 0], [0, -1, 0], c);
      }
    }
    bytes() { return new Uint8Array(this.buf, 0, this.count * 32); }
  }
  /* çizgi ağı: teller (tek piksel) */
  class LineMesh extends Mesh {
    line(a, b, col) { this.vw(a, [0, 1, 0], col); this.vw(b, [0, 1, 0], col); }
    sag(a, b, sagAmt, col, seg = 10) {
      let prev = a;
      for (let i = 1; i <= seg; i++) {
        const t = i / seg, p = V3.lerp(a, b, t);
        p[1] -= Math.sin(t * Math.PI) * sagAmt;
        this.line(prev, p, col); prev = p;
      }
    }
  }

  /* ---------------- gölgelendiriciler ---------------- */
  const NOISE_GLSL = `
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0-2.0*f);
  float a = hash12(i), b = hash12(i+vec2(1,0)), c = hash12(i+vec2(0,1)), d = hash12(i+vec2(1,1));
  return mix(mix(a,b,u.x), mix(c,d,u.x), u.y); }
const float BAY[16] = float[16](0.,8.,2.,10.,12.,4.,14.,6.,3.,11.,1.,9.,15.,7.,13.,5.);
float bayer(vec2 q){ ivec2 i = ivec2(mod(floor(q), 4.0)); return (BAY[i.y*4+i.x] + 0.5) / 16.0; }
vec3 shade3(vec3 c, float k){ return k < 0.0 ? c * (1.0 + k) : c + (1.0 - c) * k; }
`;

  const VS_MAIN = `#version 300 es
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNor;
layout(location=2) in vec4 aCol;
layout(location=3) in vec4 aAux;
uniform mat4 uVP, uLVP;
uniform mat4 uBones[24];
uniform float uTime, uCutOn, uCutH, uShadowPass, uWind;
out vec3 vPos; out vec3 vNor; out vec4 vCol; out vec4 vAux; out vec4 vLS;
void main(){
  int bi = int(aAux.x * 255.0 + 0.5);
  mat4 B = uBones[bi];
  vec4 wp = B * vec4(aPos, 1.0);
  vec3 n = mat3(B) * aNor;
  int fl = int(aAux.z * 255.0 + 0.5);
  float w = aAux.y * uWind;
  if (w > 0.0) {
    float ph = uTime * 1.6 + wp.x * 0.045 + wp.z * 0.037;
    wp.x += (sin(ph) + 0.4 * sin(ph * 2.3 + 1.7)) * w * 0.7;
    wp.z += cos(ph * 0.83) * w * 0.45;
  }
  bool hide = false;
  if (uShadowPass > 0.5) {
    if ((fl & 8) != 0) hide = true;
  } else if (uCutOn > 0.5) {
    if ((fl & 4) != 0) hide = true;
    if ((fl & 3) != 0) {
      // kameraya (güneye) bakan duvar ve süs: kesitte alçalır ya da gizlenir
      float a = aAux.w * 6.2831853;
      bool faces = sin(a) > 0.25;
      if (faces) {
        if ((fl & 2) != 0) hide = true;
        else wp.y = min(wp.y, uCutH);
      }
    }
  }
  vPos = wp.xyz; vNor = n; vCol = aCol; vAux = aAux;
  vLS = uLVP * vec4(wp.xyz + normalize(n) * 0.8, 1.0);
  gl_Position = hide ? vec4(2.0, 2.0, 2.0, 1.0) : (uShadowPass > 0.5 ? uLVP : uVP) * wp;
}`;

  const FS_SHADOW = `#version 300 es
precision highp float;
out vec4 o;
void main(){ o = vec4(1.0); }`;

  /* zemin: karo sınıfı dokusundan (R: karo türü) her sınıfın kendi rampası; sınırlar gürültüyle kırık */
  const FS_GBUF = `#version 300 es
precision highp float;
precision highp int;
in vec3 vPos; in vec3 vNor; in vec4 vCol; in vec4 vAux; in vec4 vLS;
uniform highp sampler2D uShadow;
uniform highp sampler2D uTiles;
uniform vec4 uTileRect;      // x0, z0 (yerel birim), genişlik, yükseklik (karo)
uniform vec3 uSunDir;
uniform float uTime, uCell, uNight, uWinLit;
uniform vec3 uTB[25];        // karo türlerinin taban rengi (oyunun doğal tonu)
uniform vec3 uGrass[6];
uniform vec3 uWaterR[6];
uniform vec4 uInRect;        // oyuncunun içinde olduğu bina (yerel x0, z0, x1, z1); z1 < z0 ise yok
uniform float uInH;
uniform vec3 uHole;          // oyuncunun ekran konumu (piksel) ve derinliği: önündeki taç ve saçak delinir
uniform float uHoleR, uHoleAll;
layout(location=0) out vec4 oAlb;
layout(location=1) out vec4 oNor;
${NOISE_GLSL}
float shadowVis(){
  vec3 p = vLS.xyz / vLS.w * 0.5 + 0.5;
  if (p.x < 0.0 || p.x > 1.0 || p.y < 0.0 || p.y > 1.0 || p.z > 1.0) return 1.0;
  float d = texture(uShadow, p.xy).r;
  return p.z - 0.0006 > d ? 0.0 : 1.0;
}
int tileAt(vec2 q){
  vec2 t = floor(q / 16.0) - uTileRect.xy;
  if (t.x < 0.0 || t.y < 0.0 || t.x >= uTileRect.z || t.y >= uTileRect.w) return 5;
  return int(texelFetch(uTiles, ivec2(t), 0).r * 255.0 + 0.5);
}
bool isWater(int t){ return t == 0 || t == 1 || t == 20; }
vec3 ramp(vec3 c, float k){ return k < 0.0 ? mix(c, vec3(0.16, 0.12, 0.09), -k) : mix(c, vec3(0.96, 0.92, 0.8), k); }
// karo sınırını kır: örnek noktası gürültüyle birkaç piksel kayar (aynı kayma su ve zeminde)
int tileJit(vec3 p){
  vec2 q = floor(p.xz / uCell) * uCell;
  vec2 j = vec2(vnoise(q * 0.21 + 11.0), vnoise(q * 0.21 + 37.0)) - 0.5;
  return tileAt(q + j * 7.0 + (bayer(p.xz / uCell) - 0.5) * 1.5);
}
vec3 terrain(vec3 p, vec3 n, int t, out float matOut){
  vec2 q = floor(p.xz / uCell) * uCell;
  float b = bayer(p.xz / uCell);
  float n1 = vnoise(q * 0.031), n2 = vnoise(q * 0.12 + 7.3), n3 = vnoise(q * 0.45 + 3.1);
  matOut = 4.0;
  vec3 base = uTB[t];
  vec3 col = base;
  if (t == 5 || t == 6 || t == 7) {            // çimen, orman, bataklık: 6 tonlu rampa, öbekler ve tutamlar
    float g = 0.5 + (n1 - 0.5) * 0.75 + (n2 - 0.5) * 0.6 + (n3 - 0.5) * 0.55;
    int gi = int(clamp(g * 4.2 + 0.4 + (b - 0.5) * 0.45, 0.0, 5.0));
    col = uGrass[gi] * (base / uTB[5]);
  } else if (t == 4 || t == 3 || t == 2) {     // kuru ot, çöl, kum: dört ton
    float g = n3 * 0.6 + n2 * 0.4 + (b - 0.5) * 0.35;
    col = ramp(base, g < 0.3 ? -0.2 : g < 0.5 ? -0.07 : g < 0.72 ? 0.0 : 0.12);
    if (t == 4 && n1 > 0.62 && n3 > 0.55) col = mix(col, uGrass[2], 0.6);
  } else if (t == 13 || t == 12 || t == 23) {  // kasaba toprağı, yol, çakıl: sıkışmış toprak, iz, çakıl taşı
    float g = n2 * 0.55 + n3 * 0.45 + (b - 0.5) * 0.3;
    col = ramp(base, g < 0.32 ? -0.16 : g < 0.62 ? 0.0 : 0.1);
    if (n3 > 0.8 && b > 0.55) col = ramp(base, 0.22);
    if (hash12(floor(q / 2.0)) > 0.985) col = ramp(base, -0.3);
  } else if (t == 19) {                        // tahta döşeme (veranda)
    float row = floor(p.x / 3.0);
    float seam = step(0.86, fract(p.x / 3.0));
    float jn = step(0.96, fract((p.z + hash12(vec2(row, 1.0)) * 20.0) / 20.0));
    float tone = hash12(vec2(row, floor((p.z + hash12(vec2(row, 1.0)) * 20.0) / 20.0)));
    col = seam + jn > 0.5 ? ramp(base, -0.32) : tone > 0.7 ? ramp(base, 0.07) : tone < 0.25 ? ramp(base, -0.08) : base;
    matOut = 9.0;
  } else if (t == 14) {                        // tarla: sürülmüş sıralar
    float r = fract(p.z / 5.0 + n1 * 0.15);
    col = r < 0.4 ? ramp(base, -0.18) : r > 0.8 ? ramp(base, 0.08) : base;
  } else if (t == 9 || t == 10 || t == 16 || t == 17) {   // kaya
    float g = n3 * 0.7 + n2 * 0.3 + (b - 0.5) * 0.3;
    col = ramp(base, g < 0.35 ? -0.18 : g > 0.7 ? 0.12 : 0.0);
    matOut = 12.0;
  } else if (t == 21 || t == 22) {             // arnavut kaldırımı, taş döşeme
    vec2 c = fract(p.xz / vec2(t == 21 ? 4.0 : 8.0, t == 21 ? 4.0 : 5.0) + vec2(0.0, 0.5 * step(0.5, fract(p.z / 10.0))));
    float jn = step(0.85, max(c.x, c.y));
    col = jn > 0.5 ? ramp(base, -0.25) : ramp(base, (hash12(floor(p.xz / 4.0)) - 0.5) * 0.12);
  } else if (t == 8) {
    col = ramp(base, n3 > 0.6 ? 0.06 : n3 < 0.3 ? -0.1 : 0.0);
  }
  return col;
}
// su derinliği: komşu karolardan kıyıya uzaklık (yaklaşık)
float waterDepth(vec2 q){
  float d = 1.0;
  for (int i = 0; i < 8; i++) {
    float a = float(i) * 0.785398, r = 9.0;
    if (!isWater(tileAt(q + vec2(cos(a), sin(a)) * r))) d = min(d, 0.12);
    if (!isWater(tileAt(q + vec2(cos(a), sin(a)) * 20.0))) d = min(d, 0.45);
  }
  return d;
}
vec3 waterCol(vec3 p, out float glint){
  vec2 q = floor(p.xz / uCell) * uCell;
  float b = bayer(p.xz / uCell);
  float t = uTime;
  glint = 0.0;
  float d = clamp(waterDepth(q) + (vnoise(q * 0.08) - 0.5) * 0.2, 0.0, 1.0);
  int wi = int(clamp(d * 5.2 + (b - 0.5) * 0.9, 0.0, 5.0));
  vec3 col = uWaterR[wi];
  if (d < 0.42) {
    float c1 = sin(q.x * 0.21 + t * 1.1 + sin(q.y * 0.17 + t * 0.7) * 1.5);
    float c2 = sin(q.y * 0.23 - t * 0.9 + sin(q.x * 0.19 - t * 0.6) * 1.5);
    if (abs(c1 + c2) < 0.16 * (1.0 - d * 2.0)) col = mix(col, vec3(0.78, 0.92, 0.86), 0.5);
  }
  float dash = vnoise(vec2(q.x * 0.09 - t * 0.6, q.y * 0.5));
  if (dash > 0.78 && d > 0.2) col = mix(col, uWaterR[0], 0.55);
  float wave = 0.05 + 0.045 * sin(t * 0.9 + vnoise(q * 0.05) * 6.0);
  if (d < wave) col = vec3(0.91, 0.95, 0.92);
  float gk = hash12(floor(q / 2.0) + floor(t * 2.5));
  if (gk > 0.985 && d > 0.15) glint = 1.0;
  return col;
}
void main(){
  int fl = int(vAux.z * 255.0 + 0.5);
  if (((fl & 64) != 0 || uHoleAll > 0.5) && uHoleR > 0.0) {
    // oyuncunun önündeki taç ve saçak: oyuncu çevresinde delik (kenarı titreşimli)
    float dd = length(gl_FragCoord.xy - uHole.xy) / uHoleR + (bayer(gl_FragCoord.xy) - 0.5) * 0.16;
    if (dd < 1.0 && gl_FragCoord.z < uHole.z) discard;
  }
  vec3 n = normalize(vNor);
  if (!gl_FrontFacing) n = -n;
  float mat = floor(vCol.a * 255.0 + 0.5);
  vec3 alb = vCol.rgb;
  float glint = 0.0;
  vec3 ap = vPos;
  if (mat == 4.0) {
    int tt = tileJit(vPos);
    if (isWater(tt)) { alb = waterCol(vPos, glint); mat = 2.0; n = vec3(0.0, 1.0, 0.0); }
    else alb = terrain(vPos, n, tt, mat);
  } else if (mat == 5.0) {            // yatay tahta (dış cephe)
    float r = fract(ap.y / 3.0);
    float seam = step(0.86, r);
    float tone = vnoise(vec2(floor(ap.y / 3.0) * 7.1, (ap.x + ap.z) * 0.08));
    alb = seam > 0.5 ? shade3(alb, -0.32) : (tone > 0.62 ? shade3(alb, 0.07) : tone < 0.3 ? shade3(alb, -0.08) : alb);
  } else if (mat == 6.0) {            // dikey tahta
    float u = abs(n.x) > abs(n.z) ? ap.z : ap.x;
    float r = fract(u / 3.4);
    float tone = vnoise(vec2(floor(u / 3.4) * 5.3, ap.y * 0.05));
    alb = step(0.88, r) > 0.5 ? shade3(alb, -0.3) : (tone > 0.6 ? shade3(alb, 0.06) : tone < 0.3 ? shade3(alb, -0.07) : alb);
  } else if (mat == 7.0) {            // çatı şindırası: sıralar eğim yönünde (düz çatıda da), derzler sıra boyunca
    bool zs = abs(n.z) >= abs(n.x);
    float along = zs ? ap.x : ap.z, down = zs ? ap.z : ap.x;
    float row = floor(down / 2.6);
    float u = along + mod(row, 2.0) * 1.6;
    float edge = step(0.82, fract(down / 2.6));
    float joint = step(0.9, fract(u / 3.2));
    float tone = hash12(vec2(floor(u / 3.2), row));
    alb = edge + joint > 0.5 ? shade3(alb, -0.3) : (tone > 0.75 ? shade3(alb, 0.08) : tone < 0.22 ? shade3(alb, -0.1) : alb);
  } else if (mat == 8.0) {            // kütük duvar
    float r = fract(ap.y / 3.6);
    float rr = abs(r - 0.5) * 2.0;
    alb = rr > 0.82 ? shade3(alb, -0.42) : rr > 0.6 ? shade3(alb, -0.12) : (r < 0.35 ? shade3(alb, 0.08) : alb);
  } else if (mat == 9.0) {            // döşeme tahtası (doğu-batı uzanır)
    float row = floor(ap.z / 3.0);
    float off = hash12(vec2(row, 3.0)) * 24.0;
    float seam = step(0.88, fract(ap.z / 3.0));
    float joint = step(0.965, fract((ap.x + off) / 24.0));
    float tone = hash12(vec2(row, floor((ap.x + off) / 24.0)));
    alb = seam + joint > 0.5 ? shade3(alb, -0.28) : (tone > 0.7 ? shade3(alb, 0.07) : tone < 0.25 ? shade3(alb, -0.07) : alb);
  } else if (mat == 10.0) {           // duvar kâğıdı: dikey şerit ve süs, altta lambri
    float u = abs(n.x) > abs(n.z) ? ap.z : ap.x;
    float s = fract(u / 5.0);
    float dots = step(0.5, fract(ap.y / 4.0)) * step(0.4, s) * step(s, 0.6);
    alb = s < 0.12 ? shade3(alb, -0.18) : (dots > 0.5 ? shade3(alb, 0.16) : alb);
    if (ap.y < 7.0) alb = shade3(vec3(0.29, 0.17, 0.1), ap.y > 6.2 ? 0.15 : 0.0);
  } else if (mat == 11.0) {           // cam: gündüz gök yansıması, gece (yanıyorsa) sıcak ışık
    float u = abs(n.x) > abs(n.z) ? ap.z : ap.x;
    float s = fract((u + ap.y) / 7.0);
    alb = mix(vec3(0.2, 0.27, 0.32), vec3(0.52, 0.63, 0.7), step(0.8, s));
    if (uNight > 0.5 && uWinLit > 0.5) { alb = vec3(1.0, 0.78, 0.42); mat = 3.0; }
  } else if (mat == 13.0) {           // kumaş
    float t = vnoise(ap.xz * 0.6 + ap.y * 0.3);
    alb = t > 0.7 ? shade3(alb, 0.06) : t < 0.25 ? shade3(alb, -0.06) : alb;
  } else if (mat == 14.0) {           // saç teli
    float t = sin((ap.y + (ap.x + ap.z) * 0.3) * 3.0 + vnoise(ap.xz * 2.0) * 3.0);
    alb = t > 0.6 ? shade3(alb, 0.12) : t < -0.6 ? shade3(alb, -0.15) : alb;
  } else if (mat == 15.0) {           // ateş: titrek, kendinden yanan
    float f = vnoise(vec2(ap.x * 0.8 + ap.z * 0.8, ap.y * 0.9 - uTime * 6.0));
    alb = f > 0.6 ? vec3(1.0, 0.86, 0.45) : f > 0.35 ? vec3(0.98, 0.55, 0.16) : vec3(0.8, 0.26, 0.08);
  } else if (mat == 16.0) {           // taş
    float t = vnoise(ap.xz * 0.35 + ap.y * 0.35);
    float t2 = hash12(floor(ap.xz / 1.5) + floor(ap.y / 1.5));
    alb = t > 0.66 ? shade3(alb, 0.1) : t < 0.3 ? shade3(alb, -0.12) : alb;
    if (t2 > 0.93) alb = shade3(alb, -0.2);
  } else if (mat == 17.0) {           // karo döşeme (dama)
    vec2 c = floor(ap.xz / 4.0);
    alb = mod(c.x + c.y, 2.0) < 1.0 ? alb : shade3(alb, -0.42);
  } else if (mat == 18.0) {           // sıva: hafif lekeli
    float t = vnoise(ap.xz * 0.2 + ap.y * 0.25);
    alb = t > 0.72 ? shade3(alb, 0.05) : t < 0.22 ? shade3(alb, -0.06) : alb;
    if (ap.y < 5.5) alb = shade3(alb, -0.32);
  } else if (mat == 19.0) {           // tuğla
    float u = abs(n.x) > abs(n.z) ? ap.z : ap.x;
    float row = floor(ap.y / 3.0);
    float jn = step(0.82, fract(ap.y / 3.0)) + step(0.9, fract((u + mod(row, 2.0) * 3.0) / 6.0));
    alb = jn > 0.5 ? mix(alb, vec3(0.72, 0.66, 0.56), 0.55) : shade3(alb, (hash12(vec2(floor((u + mod(row, 2.0) * 3.0) / 6.0), row)) - 0.5) * 0.14);
  } else if (mat == 20.0) {           // saman döşeme
    float t = sin(ap.x * 1.7 + vnoise(ap.xz * 0.5) * 6.0) * cos(ap.z * 1.3);
    alb = t > 0.5 ? shade3(alb, 0.1) : t < -0.5 ? shade3(alb, -0.12) : alb;
  }
  float sun = max(dot(n, uSunDir), 0.0);
  if (mat == 1.0) sun = clamp(dot(n, uSunDir) * 0.55 + 0.45, 0.0, 1.0);
  sun *= shadowVis();
  bool indoor = vPos.x > uInRect.x && vPos.x < uInRect.z && vPos.z > uInRect.y && vPos.z < uInRect.w && vPos.y < uInH;
  oAlb = vec4(alb, mat / 255.0);
  oNor = vec4(n * 0.5 + 0.5, indoor ? sun * 0.49 : 0.51 + sun * 0.49);
  if (glint > 0.5) oAlb.a = 21.0 / 255.0;
  if ((fl & 16) != 0) oAlb.a = 22.0 / 255.0;
}`;

  const VS_FULL = `#version 300 es
const vec2 P[3] = vec2[3](vec2(-1,-1), vec2(3,-1), vec2(-1,3));
void main(){ gl_Position = vec4(P[gl_VertexID], 0.0, 1.0); }`;

  const NL = 24;
  const FS_COMP = `#version 300 es
precision highp float;
precision highp int;
uniform sampler2D uAlb, uNor;
uniform highp sampler2D uDep;
uniform mat4 uInvVP;
uniform vec2 uRes;
uniform float uNear, uFar, uTime, uNightMul, uOutline, uPx;
uniform vec3 uSunCol, uSky, uGround, uBg;
uniform float uSunK, uAmbK;
uniform int uNL;
uniform vec4 uLP[${NL}];   // xyz konum, w yarıçap
uniform vec4 uLC[${NL}];   // rgb renk, a şiddet
out vec4 o;
const vec3 SHD = vec3(46.0, 36.0, 66.0) / 255.0, HIL = vec3(255.0, 244.0, 210.0) / 255.0, INK = vec3(16.0, 10.0, 8.0) / 255.0;
const float BAY[16] = float[16](0.,8.,2.,10.,12.,4.,14.,6.,3.,11.,1.,9.,15.,7.,13.,5.);
float lum(vec3 c){ return dot(c, vec3(0.3, 0.59, 0.11)); }
// oyunun toneTo'su (js/hybrid.js): 0 en koyu, 2 kendisi, 4 en açık; ink > 0 ise mürekkep karışır
vec3 toneTo(vec3 c, int k, float ink){
  float l = lum(c);
  if (k < 2) {
    float t = k == 1 ? 0.16 : 0.42;
    vec3 r = mix(c, SHD, t);
    float l2 = lum(r), lim = l * (k == 1 ? 0.93 : 0.8);
    if (l2 > lim) r *= l2 > 0.0 ? lim / l2 : 0.0;
    c = r;
  } else if (k > 2) {
    float t = (k == 3 ? 0.2 : 0.42) * (0.55 + 0.45 * min(1.0, l * 1.6));
    c = mix(c, HIL, t);
  }
  return mix(c, INK, ink);
}
int matAt(ivec2 p){ return int(texelFetch(uAlb, p, 0).a * 255.0 + 0.5); }
vec3 worldAt(ivec2 p, float dz){
  vec2 ndc = (vec2(p) + 0.5) / uRes * 2.0 - 1.0;
  vec4 w = uInvVP * vec4(ndc, dz * 2.0 - 1.0, 1.0);
  return w.xyz / w.w;
}
void lightAt(ivec2 p, out float L, out vec3 tint, out float lampAmt){
  vec4 N = texelFetch(uNor, p, 0);
  vec3 n = normalize(N.rgb * 2.0 - 1.0);
  bool indoor = N.a < 0.5;
  float sun = indoor ? N.a / 0.49 : (N.a - 0.51) / 0.49;
  float dz = texelFetch(uDep, p, 0).r;
  vec3 wp = worldAt(p, dz);
  float hemi = n.y * 0.5 + 0.5;
  float amb = uAmbK * (0.35 + 0.65 * hemi) * (indoor ? 0.55 : 1.0);
  vec3 E = mix(uGround, uSky, hemi) * amb + uSunCol * sun * uSunK;
  float Ln = amb + sun * uSunK;
  float Ll = 0.0; vec3 El = vec3(0.0);
  for (int i = 0; i < ${NL}; i++) {
    if (i >= uNL) break;
    vec3 d = uLP[i].xyz - wp;
    float dist = length(d);
    float a = clamp(1.0 - dist / uLP[i].w, 0.0, 1.0);
    if (a <= 0.0) continue;
    a *= a;
    float ndl = max(dot(n, d / max(dist, 0.001)), 0.0) * 0.75 + 0.25;
    float v = a * ndl * uLC[i].a;
    Ll += v; El += uLC[i].rgb * v;
  }
  L = Ln + Ll;
  vec3 Et = E + El;
  float le = max(lum(Et), 0.001);
  tint = mix(vec3(1.0), Et / le, 0.55);
  lampAmt = clamp(Ll * 1.6, 0.0, 1.0);
}
vec3 shade(ivec2 p, int mat, vec3 alb, int kf, float ink){
  float L; vec3 tint; float lamp;
  lightAt(p, L, tint, lamp);
  if (mat == 3 || mat == 15) return kf >= 0 ? toneTo(alb, 1, 0.2) : alb;   // kendinden yanan
  if (mat == 21) return vec3(1.0, 0.98, 0.9);                               // su pırıltısı
  float bay = (BAY[(p.y & 3) * 4 + (p.x & 3)] + 0.5) / 16.0;
  float Ld = L + (bay - 0.5) * 0.05;
  int k = kf >= 0 ? kf : (Ld < 0.12 ? 0 : Ld < 0.36 ? 1 : Ld < 0.72 ? 2 : Ld < 0.88 ? 3 : 4);
  return toneTo(alb, k, ink) * tint * mix(uNightMul, 1.0, lamp);
}
void main(){
  ivec2 p = ivec2(gl_FragCoord.xy);
  ivec2 hi = ivec2(uRes) - 1;
  float dz = texelFetch(uDep, p, 0).r;
  vec4 A = texelFetch(uAlb, p, 0);
  int mat = int(A.a * 255.0 + 0.5);
  bool bg = dz >= 1.0;
  float d0 = uNear + dz * (uFar - uNear);
  bool tp = mat == 4 || mat == 12;
  float best = 1e9; ivec2 bq = p; bool inner = false;
  if (uOutline > 0.5) {
    ivec2 off[4] = ivec2[4](ivec2(1, 0), ivec2(-1, 0), ivec2(0, 1), ivec2(0, -1));
    for (int i = 0; i < 4; i++) {
      ivec2 q = clamp(p + off[i], ivec2(0), hi), r = clamp(p - off[i], ivec2(0), hi);
      float dqr = texelFetch(uDep, q, 0).r;
      if (dqr >= 1.0) continue;
      float dq = uNear + dqr * (uFar - uNear);
      int mq = matAt(q);
      bool tq = mq == 4 || mq == 12;
      if (mq == 2 || mq == 21 || mq == 22) continue;
      if (bg) { if (!tq && dq < best) { best = dq; bq = q; } continue; }
      float dr = uNear + texelFetch(uDep, r, 0).r * (uFar - uNear);
      float second = (dq - d0) - (d0 - dr);          // düzlemde ~0: eğimli yüzey çizgi almaz
      float thr = ((tq && tp) ? 9.0 : 3.2) * uPx;
      if (dq < d0 - thr && second < -thr && dq < best) { best = dq; bq = q; }
      if (!tp && !tq && mat != 2 && mat != 21 && dq > d0 + 1.6 * uPx && second > 1.6 * uPx && dq < d0 + thr) inner = true;
    }
  }
  if (best < 1e8) {
    vec4 Aq = texelFetch(uAlb, bq, 0);
    int mq = int(Aq.a * 255.0 + 0.5);
    o = vec4(shade(bq, mq, Aq.rgb, 0, 0.55), 1.0);
    return;
  }
  if (bg) { o = vec4(uBg, 1.0); return; }
  if (mat == 22) { o = vec4(shade(p, 0, A.rgb, 1, 0.0), 1.0); return; }
  if (inner) { o = vec4(shade(p, mat, A.rgb, 0, 0.35), 1.0); return; }
  o = vec4(shade(p, mat, A.rgb, -1, 0.0), 1.0);
}`;

  /* ---------------- GL yardımcıları ---------------- */
  function compile(gl, type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('3B gölgelendirici derlenemedi: ' + gl.getShaderInfoLog(s));
    return s;
  }
  function program(gl, vs, fs) {
    const p = gl.createProgram();
    gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs));
    gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('3B program bağlanamadı: ' + gl.getProgramInfoLog(p));
    const U = {};
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) {
      const info = gl.getActiveUniform(p, i);
      U[info.name.replace(/\[0\]$/, '')] = gl.getUniformLocation(p, info.name);
    }
    return { p, U };
  }
  function tex(gl, w, h, ifmt, fmt, type, filter = gl.NEAREST, data = null) {
    const t = gl.createTexture();
    gl.activeTexture(gl.TEXTURE5);
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, ifmt, w, h, 0, fmt, type, data);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, null);
    return t;
  }

  /* ---------------- GPU ağı ---------------- */
  class GPUMesh {
    constructor(gl, mesh, mode) {
      this.gl = gl; this.mode = mode || gl.TRIANGLES;
      this.count = mesh.count;
      this.bb = mesh.bb.slice();
      this.vao = gl.createVertexArray();
      gl.bindVertexArray(this.vao);
      this.buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
      gl.bufferData(gl.ARRAY_BUFFER, mesh.bytes(), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 32, 0);
      gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 32, 12);
      gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 4, gl.UNSIGNED_BYTE, true, 32, 24);
      gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 4, gl.UNSIGNED_BYTE, true, 32, 28);
      gl.bindVertexArray(null);
    }
    draw() { const gl = this.gl; gl.bindVertexArray(this.vao); gl.drawArrays(this.mode, 0, this.count); }
    dispose() { this.gl.deleteBuffer(this.buf); this.gl.deleteVertexArray(this.vao); }
  }

  /* ---------------- çizici ----------------
     scene: { parts: [{ mesh: GPUMesh, cut, cutH, winLit }], lines: GPUMesh, tiles: {tex, rect}, pal }
     view:  { x0, y0 (yerel birim, ekranın sol üstü), lw, lh (piksel), ds (dünya pikseli başına piksel), K, hole }
     actors: [{ mesh: GPUMesh, bones: Float32Array }]   lights: [{p, r, c, k}]   env: güneş ve ortam */
  class Renderer {
    constructor() {
      this.cv = document.createElement('canvas');
      this.cv.width = 2; this.cv.height = 2;
      const gl = this.cv.getContext('webgl2', { antialias: false, alpha: false, depth: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
      if (!gl) throw new Error('WebGL2 yok');
      this.gl = gl;
      this.pMain = program(gl, VS_MAIN, FS_GBUF);
      this.pShadow = program(gl, VS_MAIN, FS_SHADOW);
      this.pComp = program(gl, VS_FULL, FS_COMP);
      this.emptyVao = gl.createVertexArray();
      this.SH = 2048;
      this.shadowTex = tex(gl, this.SH, this.SH, gl.DEPTH_COMPONENT24, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT);
      this.shadowFB = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadowFB);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, this.shadowTex, 0);
      gl.drawBuffers([gl.NONE]); gl.readBuffer(gl.NONE);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      this.lowW = 0; this.lowH = 0;
      this.identBones = new Float32Array(24 * 16);
      for (let i = 0; i < 24; i++) this.identBones.set(M4.ident(), i * 16);
      this.stats = { ms: 0, draws: 0 };
      this.lp = new Float32Array(NL * 4); this.lc = new Float32Array(NL * 4);
    }
    resizeLow(w, h) {
      if (w === this.lowW && h === this.lowH) return;
      const gl = this.gl;
      this.lowW = w; this.lowH = h;
      this.cv.width = w; this.cv.height = h;
      for (const t of [this.tAlb, this.tNor, this.tDep]) if (t) gl.deleteTexture(t);
      this.tAlb = tex(gl, w, h, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE);
      this.tNor = tex(gl, w, h, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE);
      this.tDep = tex(gl, w, h, gl.DEPTH_COMPONENT24, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT);
      if (!this.gFB) this.gFB = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.gFB);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.tAlb, 0);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, this.tNor, 0);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, this.tDep, 0);
      gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }
    tileTexture(bytes, w, h) {
      const gl = this.gl;
      return tex(gl, w, h, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, gl.NEAREST, bytes);
    }
    /* eğik izdüşüm matrisi: yer bire bir, yükseklik ekranda K kadar yukarı, derinlik (0, 1, K) yönünde */
    viewProj(v) {
      const K = v.K, s = Math.hypot(1, K), ax = 2 * v.ds / v.lw, ay = 2 * v.ds / v.lh;
      const dc = (K * (v.y0 + v.lh / v.ds / 2)) / s, dr = this.DR;
      const m = new Float32Array(16);
      m[0] = ax;
      m[5] = ay * K; m[6] = -1 / (s * dr);
      m[9] = -ay; m[10] = -K / (s * dr);
      m[12] = -ax * v.x0 - 1; m[13] = 1 + ay * v.y0; m[14] = dc / dr; m[15] = 1;
      return m;
    }
    /* noktanın (yerel birim) ekran pikseli ve pencere derinliği */
    project(VP, p) {
      const c = M4.xform(VP, p);
      return [(c[0] * 0.5 + 0.5) * this.lowW, (c[1] * 0.5 + 0.5) * this.lowH, c[2] * 0.5 + 0.5];
    }
    render(scene, view, actors, lights, env, t) {
      const gl = this.gl;
      const t0 = performance.now();
      const lw = view.lw, lh = view.lh;
      this.resizeLow(lw, lh);
      this.DR = 1400;
      const VP = this.viewProj(view);
      this.VP = VP;
      // görünen dünya dikdörtgeni (yerel birim) ve ayıklama
      const vx0 = view.x0, vx1 = view.x0 + lw / view.ds, vy0 = view.y0, vy1 = view.y0 + lh / view.ds;
      const visible = (bb, pad) => bb[3] > vx0 - pad && bb[0] < vx1 + pad && bb[5] - view.K * bb[1] > vy0 - pad && bb[2] - view.K * bb[4] < vy1 + pad;
      // güneş: gölge kutusu görünen alanı (ve gölgesi içeri düşebilecek uzun nesneleri) kapsar, texel ızgarasına oturur
      const sd = V3.norm(env.sunDir);
      const cx = (vx0 + vx1) / 2, cz = (vy0 + vy1) / 2 + 30;
      const R = Math.max(vx1 - vx0, vy1 - vy0) * 0.62 + 150;
      const lup = Math.abs(sd[1]) > 0.98 ? [0, 0, -1] : [0, 1, 0];
      let LV = M4.lookAt(V3.add([cx, 0, cz], V3.mul(sd, R * 2)), [cx, 0, cz], lup);
      const texel = 2 * R / this.SH;
      const lc = M4.xform(LV, [cx, 0, cz]);
      const snap = M4.translate(Math.round(lc[0] / texel) * texel - lc[0], Math.round(lc[1] / texel) * texel - lc[1], 0);
      LV = M4.mul(snap, LV);
      const LP = M4.ortho(-R, R, -R, R, 1, R * 4);
      const LVP = M4.mul(LP, LV);
      let draws = 0;
      const drawParts = (pr, shadowPass) => {
        const U = pr.U;
        gl.uniformMatrix4fv(U.uBones, false, this.identBones);
        for (const P of scene.parts) {
          if (!visible(P.mesh.bb, shadowPass ? R * 0.9 : 8)) continue;
          gl.uniform1f(U.uCutOn, P.cut ? 1 : 0);
          gl.uniform1f(U.uCutH, P.cutH || 6);
          if (U.uWinLit) gl.uniform1f(U.uWinLit, P.winLit ? 1 : 0);
          if (U.uHoleAll) gl.uniform1f(U.uHoleAll, P.holeAll ? 1 : 0);
          P.mesh.draw(); draws++;
        }
        gl.uniform1f(U.uCutOn, 0);
        if (U.uHoleAll) gl.uniform1f(U.uHoleAll, 0);
        for (const a of actors) {
          gl.uniformMatrix4fv(U.uBones, false, a.bones);
          a.mesh.draw(); draws++;
        }
        gl.uniformMatrix4fv(U.uBones, false, this.identBones);
      };
      const common = (pr, shadowPass) => {
        const U = pr.U;
        gl.uniformMatrix4fv(U.uVP, false, VP);
        gl.uniformMatrix4fv(U.uLVP, false, LVP);
        gl.uniform1f(U.uTime, t);
        gl.uniform1f(U.uWind, env.wind === undefined ? 1 : env.wind);
        gl.uniform1f(U.uShadowPass, shadowPass ? 1 : 0);
      };
      // 1) gölge
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadowFB);
      gl.viewport(0, 0, this.SH, this.SH);
      gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.depthMask(true);
      gl.disable(gl.CULL_FACE);
      gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(1.5, 2.0);
      gl.clear(gl.DEPTH_BUFFER_BIT);
      for (let i = 0; i < 3; i++) { gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, null); }
      gl.useProgram(this.pShadow.p);
      common(this.pShadow, true);
      if (env.sunK > 0.01) drawParts(this.pShadow, true);
      gl.disable(gl.POLYGON_OFFSET_FILL);
      // 2) G-tamponu
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.gFB);
      gl.viewport(0, 0, lw, lh);
      gl.clearBufferfv(gl.COLOR, 0, [0, 0, 0, 0]);
      gl.clearBufferfv(gl.COLOR, 1, [0.5, 1, 0.5, 0.51]);
      gl.clearDepth(1); gl.clear(gl.DEPTH_BUFFER_BIT);
      const pm = this.pMain, U = pm.U;
      gl.useProgram(pm.p);
      common(pm, false);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.shadowTex); gl.uniform1i(U.uShadow, 0);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, scene.tiles.tex); gl.uniform1i(U.uTiles, 1);
      gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, null);
      const tr = scene.tiles.rect;
      gl.uniform4f(U.uTileRect, tr[0], tr[1], tr[2], tr[3]);
      gl.uniform3fv(U.uSunDir, sd);
      gl.uniform1f(U.uCell, 1 / view.ds);
      gl.uniform1f(U.uNight, env.night ? 1 : 0);
      gl.uniform3fv(U.uTB, scene.pal.tb);
      gl.uniform3fv(U.uGrass, scene.pal.grass);
      gl.uniform3fv(U.uWaterR, scene.pal.water);
      const ir = view.indoor;
      if (ir) { gl.uniform4f(U.uInRect, ir[0], ir[1], ir[2], ir[3]); gl.uniform1f(U.uInH, ir[4]); }
      else { gl.uniform4f(U.uInRect, 0, 1, 0, -1); gl.uniform1f(U.uInH, 0); }
      const hole = view.hole;
      if (hole) {
        const hp = this.project(VP, hole.p);
        gl.uniform3f(U.uHole, hp[0], hp[1], hp[2]);
        gl.uniform1f(U.uHoleR, hole.r * view.ds);
      } else gl.uniform1f(U.uHoleR, 0);
      drawParts(pm, false);
      if (scene.lines) { gl.uniform1f(U.uCutOn, 0); scene.lines.draw(); draws++; }
      // 3) birleştirme: doğrudan tuvale
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, lw, lh);
      gl.disable(gl.DEPTH_TEST);
      const pc = this.pComp, UC = pc.U;
      gl.useProgram(pc.p);
      gl.bindVertexArray(this.emptyVao);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.tAlb); gl.uniform1i(UC.uAlb, 0);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.tNor); gl.uniform1i(UC.uNor, 1);
      gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, this.tDep); gl.uniform1i(UC.uDep, 2);
      gl.uniformMatrix4fv(UC.uInvVP, false, M4.invert(VP));
      gl.uniform2f(UC.uRes, lw, lh);
      gl.uniform1f(UC.uNear, 0); gl.uniform1f(UC.uFar, 2 * this.DR);
      gl.uniform1f(UC.uPx, 1 / view.ds);
      gl.uniform1f(UC.uTime, t);
      gl.uniform1f(UC.uNightMul, env.nightMul);
      gl.uniform1f(UC.uOutline, env.outline === false ? 0 : 1);
      gl.uniform3fv(UC.uSunCol, env.sunCol);
      gl.uniform3fv(UC.uSky, env.sky);
      gl.uniform3fv(UC.uGround, env.ground);
      gl.uniform3fv(UC.uBg, [0.08, 0.07, 0.07]);
      gl.uniform1f(UC.uSunK, env.sunK);
      gl.uniform1f(UC.uAmbK, env.ambK);
      const n = Math.min(NL, lights.length), lp = this.lp, lcol = this.lc;
      for (let i = 0; i < n; i++) {
        const L = lights[i];
        lp[i * 4] = L.p[0]; lp[i * 4 + 1] = L.p[1]; lp[i * 4 + 2] = L.p[2]; lp[i * 4 + 3] = L.r;
        lcol[i * 4] = L.c[0]; lcol[i * 4 + 1] = L.c[1]; lcol[i * 4 + 2] = L.c[2]; lcol[i * 4 + 3] = L.k;
      }
      gl.uniform1i(UC.uNL, n);
      gl.uniform4fv(UC.uLP, lp); gl.uniform4fv(UC.uLC, lcol);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      for (let i = 0; i < 3; i++) { gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, null); }
      this.stats.ms = performance.now() - t0;
      this.stats.draws = draws;
    }
  }

  Object.assign(D3, { V3, M4, C, hexRgb, mixc, shade, SHD, HIL, INK, MAT, F, SIDE, hash3, noise3, RNG, Mesh, LineMesh, GPUMesh, Renderer });
})();
