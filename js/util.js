'use strict';
/* ==========================================================
   FRONTIER'S END — yardımcı fonksiyonlar, RNG, gürültü, heap
   ========================================================== */

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = t => t * t * (3 - 2 * t);
const dist2 = (ax, ay, bx, by) => { const dx = bx - ax, dy = by - ay; return dx * dx + dy * dy; };
const dist = (ax, ay, bx, by) => Math.sqrt(dist2(ax, ay, bx, by));
function angDiff(a, b) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU; else if (d < -Math.PI) d += TAU;
  return d;
}
function turnTo(a, target, maxStep) { return a + clamp(angDiff(a, target), -maxStep, maxStep); }
const rnd = (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
const rndi = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const chance = p => Math.random() < p;

function hash2(x, y, s) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul((s | 0) + 1, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

class RNG {
  constructor(seed) { this.f = mulberry32(seed >>> 0); }
  next() { return this.f(); }
  range(a, b) { return a + (b - a) * this.f(); }
  int(a, b) { return Math.floor(a + (b - a + 1) * this.f()); }
  pick(a) { return a[Math.floor(this.f() * a.length)]; }
  chance(p) { return this.f() < p; }
}

/* Değer gürültüsü (value noise). period>0 ise döşenebilir. */
class Noise {
  constructor(seed, period = 0) { this.s = seed | 0; this.p = period; }
  v(x, y) {
    let xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), w = yf * yf * (3 - 2 * yf);
    let x1 = xi + 1, y1 = yi + 1;
    if (this.p) {
      const p = this.p;
      xi = ((xi % p) + p) % p; yi = ((yi % p) + p) % p;
      x1 = ((x1 % p) + p) % p; y1 = ((y1 % p) + p) % p;
    }
    const a = hash2(xi, yi, this.s), b = hash2(x1, yi, this.s);
    const c = hash2(xi, y1, this.s), d = hash2(x1, y1, this.s);
    return a + (b - a) * u + (c - a) * w + (a - b - c + d) * u * w;
  }
  fbm(x, y, oct = 4) {
    let s = 0, amp = 0.5, f = 1, n = 0;
    for (let i = 0; i < oct; i++) { s += this.v(x * f, y * f) * amp; n += amp; amp *= 0.5; f *= 2.03; }
    return s / n;
  }
  /* Bir satırın fbm'i: out[i] = fbm(xs[i], y, oct) ile birebir aynı değerler (aynı aritmetik, aynı toplama sırası).
     y'ye bağlı kısım oktav başına bir kez hesaplanır; ardışık noktalar aynı kafes hücresinde kaldıkça köşe karmaları
     yeniden hesaplanmaz, sağdaki komşu hücreye geçince sağ köşeler sola kayar. oct = 1 iken sonuç v ile aynıdır.
     out ve xs Float64Array olmalı (Float32 toplamı yuvarlar). */
  row(out, xs, y, oct = 4) {
    const n = out.length, s = this.s, p = this.p, wrap = (a) => ((a % p) + p) % p;
    out.fill(0);
    let amp = 0.5, f = 1, nrm = 0;
    for (let o = 0; o < oct; o++) {
      const Y = y * f, yi = Math.floor(Y), yf = Y - yi, w = yf * yf * (3 - 2 * yf);
      const y0 = p ? wrap(yi) : yi, y1 = p ? wrap(yi + 1) : yi + 1;
      let cx = NaN, a = 0, b = 0, c = 0, d = 0;
      for (let i = 0; i < n; i++) {
        const X = xs[i] * f, xi = Math.floor(X);
        if (xi !== cx) {
          const x1 = p ? wrap(xi + 1) : xi + 1;
          if (xi === cx + 1) { a = b; c = d; } else { const x0 = p ? wrap(xi) : xi; a = hash2(x0, y0, s); c = hash2(x0, y1, s); }
          b = hash2(x1, y0, s); d = hash2(x1, y1, s); cx = xi;
        }
        const xf = X - xi, u = xf * xf * (3 - 2 * xf);
        out[i] += (a + (b - a) * u + (c - a) * w + (a - b - c + d) * u * w) * amp;
      }
      nrm += amp; amp *= 0.5; f *= 2.03;
    }
    for (let i = 0; i < n; i++) out[i] /= nrm;
    return out;
  }
}

/* Minimum ikili yığın (A* için) */
class Heap {
  constructor() { this.k = []; this.p = []; }
  get size() { return this.k.length; }
  push(key, pri) {
    const k = this.k, p = this.p;
    let i = k.length; k.push(key); p.push(pri);
    while (i > 0) {
      const par = (i - 1) >> 1;
      if (p[par] <= pri) break;
      k[i] = k[par]; p[i] = p[par]; i = par;
    }
    k[i] = key; p[i] = pri;
  }
  pop() {
    const k = this.k, p = this.p;
    const top = k[0];
    const lk = k.pop(), lp = p.pop();
    if (k.length) {
      let i = 0; const n = k.length;
      while (true) {
        let l = 2 * i + 1, r = l + 1, m = i, mp = lp;
        if (l < n && p[l] < mp) { m = l; mp = p[l]; }
        if (r < n && p[r] < mp) { m = r; mp = p[r]; }
        if (m === i) break;
        k[i] = k[m]; p[i] = p[m]; i = m;
      }
      k[i] = lk; p[i] = lp;
    }
    return top;
  }
}

/* 1890 doları: bir doların altındaki tutarlar sent olarak (25¢), üstü $1.50 biçiminde */
const fmtMoney = v => { const c = Math.round(v * 100); return Math.abs(c) < 100 && c !== 0 ? c + '¢' : '$' + (c / 100).toFixed(2); };
const fmtRange = (a, b) => '$' + Math.round(a) + '–' + Math.round(b);   // fiyat aralığı, tam dolar ($23–60)
/* Dünya uzaklığı (piksel; 1 piksel ≈ 3.2 m, haritadaki ölçekle aynı): kısa mesafe yarda, uzun mesafe mil */
const fmtDist = px => {
  const mi = px / 502.8;
  if (mi < 0.2) return Tr`${Math.max(10, Math.round(px * 3.5 / 10) * 10)} yarda`;
  const v = mi < 10 ? mi.toFixed(1) : String(Math.round(mi));
  return Tr`${typeof I18N !== 'undefined' && I18N.lang === 'tr' ? v.replace('.', ',') : v} mil`;
};
const pad2 = n => (n < 10 ? '0' : '') + n;
/* Gerçek süre: 42 sn, 3 dk 05 sn, 1 sa 12 dk */
const fmtSec = s => {
  s = Math.max(0, Math.ceil(s));
  if (s < 60) return Tr`${s} sn`;
  const m = Math.floor(s / 60);
  return m < 60 ? Tr`${m} dk ${pad2(s % 60)} sn` : Tr`${Math.floor(m / 60)} sa ${pad2(m % 60)} dk`;
};
/* Yön (ekranda y aşağı = güney): "kuzeydoğuda" gibi */
const dirWord = (dx, dy) => [Tr('doğuda'), Tr('güneydoğuda'), Tr('güneyde'), Tr('güneybatıda'), Tr('batıda'), Tr('kuzeybatıda'), Tr('kuzeyde'), Tr('kuzeydoğuda')][((Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) % 8) + 8) % 8];
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
}
/* Darboğaz ölçümü (js/debug.js bench): ölçüm sırasında kapatılan çizim aşamaları. Oyunda her zaman boştur. */
const PERF_OFF = {};
function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}
function hexToRgb(h) {
  // shadeHex çıktısı ("rgb(r,g,b)") da kabul edilir; yoksa koyulaştırılmış renkler siyaha düşer
  if (h.charCodeAt(0) === 114) { const m = h.match(/\d+/g); return [+m[0], +m[1], +m[2]]; }
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
/* Koyulaştır/açıklaştır. Sonuç renk ve orana göre önbelleklenir (her karede aynı renkler istenir); en çok 4096 kayıt */
const SHADE_C = new Map();
let SHADE_N = 0;
function shadeHex(h, f) {
  let m = SHADE_C.get(h);
  if (m === undefined) SHADE_C.set(h, m = new Map());
  let out = m.get(f);
  if (out === undefined) {
    const [r, g, b] = hexToRgb(h);
    const k = v => clamp(Math.round(f < 0 ? v * (1 + f) : v + (255 - v) * f), 0, 255);
    out = `rgb(${k(r)},${k(g)},${k(b)})`;
    if (++SHADE_N > 4096) { SHADE_C.clear(); SHADE_N = 1; SHADE_C.set(h, m = new Map()); }
    m.set(f, out);
  }
  return out;
}
function mixHex(a, b, t) {
  const A = hexToRgb(a), B = hexToRgb(b);
  return `rgb(${Math.round(lerp(A[0], B[0], t))},${Math.round(lerp(A[1], B[1], t))},${Math.round(lerp(A[2], B[2], t))})`;
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
/* Nokta-doğru parçası mesafesi */
function segDist2(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const l2 = dx * dx + dy * dy || 1;
  const t = clamp(((px - ax) * dx + (py - ay) * dy) / l2, 0, 1);
  return dist2(px, py, ax + dx * t, ay + dy * t);
}
/* Işın-çember kesişimi: ışın başlangıcından çembere mesafe veya -1 */
function rayCircle(ox, oy, dx, dy, cx, cy, r) {
  const fx = ox - cx, fy = oy - cy;
  const b = fx * dx + fy * dy;
  const c = fx * fx + fy * fy - r * r;
  const disc = b * b - c;
  if (disc < 0) return -1;
  const t = -b - Math.sqrt(disc);
  if (t >= 0) return t;
  return c < 0 ? 0 : -1;
}
