'use strict';
/* ==========================================================
   FRONTIER'S END — oyun içi 3D çizici (DENEME)
   Ayarlar → Görüntü → "3D Çizim (deneme)" ile açılır; kapalıyken oyun bugünkü 2D çizimle sürer.
   Kütüphanesiz WebGL1:
   - Kamera: eğik paralel izdüşüm. Zemin oyundaki gibi 1:1 eşlenir (dünya x,y → ekran x,y), yükseklik
     ekranda K kat yukarı kayar; böylece tıklama, nişan, arayüz ve çarpışma 2D ile aynı kalır.
   - Zemin: 2D'nin ürettiği zemin pikselleri (World.chunkGround) doku olarak yere serilir; izler, su
     halkaları, otlar gibi yer seviyesindeki 2D çizimler her kare ayrı bir katmandan zemine işlenir.
   - Binalar, ağaçlar, nesneler, insanlar, atlar, hayvanlar, arabalar ve tren alçak poligon modeldir.
   - Işık: güneş/ay yönü saate göre; gölge haritası (derinlik RGBA'ya paketli); fener, pencere, ateş
     ışıkları duvarda durur (binaların yükseklik haritası üstünde ışığa doğru yürünür).
   - İçerideyken binanın çatısı kalkar, duvarları alçalır; oyuncunun önünü kapatan duvar ve ağaçlar
     noktalı olarak delinir. Renkler kademelenip Bayer dither ile piksel görünümü korunur.
   ========================================================== */

const R3D = (() => {
  const K = 0.6;                       // 1 px yükseklik ekranda 0.6 px yukarı
  const VN = 12;                       // köşe: konum(3) normal(3) renk(3) uv(2) bayrak(1)
  const F_ROOF = 1, F_WIN = 2, F_TEX = 4, F_SEE = 8, F_SWAY = 16, F_PLANK = 32, F_BRICK = 64;
  const NL = 12;                       // en fazla nokta ışık
  const HM_RES = 0.5;                  // yükseklik haritası: dünya pikseli başına doku pikseli

  /* ---------------- renk ve vektör yardımcıları ---------------- */
  const CC = new Map();
  const col = (h) => {
    let c = CC.get(h);
    if (!c) {
      if (h[0] === 'r') { const v = h.match(/[\d.]+/g).map(Number); c = [v[0] / 255, v[1] / 255, v[2] / 255]; }   // shadeHex/mixHex 'rgb(...)' döndürür
      else { let x = h.slice(1); if (x.length === 3) x = x[0] + x[0] + x[1] + x[1] + x[2] + x[2]; const n = parseInt(x, 16); c = [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; }
      CC.set(h, c);
    }
    return c;
  };
  const sh = (h, k) => shadeHex(h, k);
  const nrm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
  const crs = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const dt3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

  /* ---------------- mat4 (sütun öncelikli) ---------------- */
  const M4 = {
    mul(a, b) {
      const r = new Float32Array(16);
      for (let c = 0; c < 4; c++) for (let rr = 0; rr < 4; rr++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + rr] * b[c * 4 + k]; r[c * 4 + rr] = s; }
      return r;
    },
    ortho(l, r, b, t, n, f) { return new Float32Array([2 / (r - l), 0, 0, 0, 0, 2 / (t - b), 0, 0, 0, 0, -2 / (f - n), 0, -(r + l) / (r - l), -(t + b) / (t - b), -(f + n) / (f - n), 1]); },
    look(e, c, u) {
      const z = nrm([e[0] - c[0], e[1] - c[1], e[2] - c[2]]), x = nrm(crs(u, z)), y = crs(z, x);
      return new Float32Array([x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -dt3(x, e), -dt3(y, e), -dt3(z, e), 1]);
    },
    pt(m, p) { return [m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]]; },
  };

  /* ---------------- model kurucu ----------------
     Yerel çerçeve: x ileri (bakış yönü), y sağ, z yukarı. Dönüşüm yığını: 3x3 (dönme × tekdüze ölçek) + öteleme. */
  class MB {
    constructor(cap = 8192) { this.a = new Float32Array(cap * VN); this.n = 0; this.m = [1, 0, 0, 0, 1, 0, 0, 0, 1]; this.t = [0, 0, 0]; this.st = []; this.f = 0; }
    reset() { this.n = 0; this.m = [1, 0, 0, 0, 1, 0, 0, 0, 1]; this.t = [0, 0, 0]; this.st.length = 0; this.f = 0; return this; }
    push() { this.st.push([this.m.slice(), this.t.slice(), this.f]); return this; }
    pop() { const s = this.st.pop(); this.m = s[0]; this.t = s[1]; this.f = s[2]; return this; }
    tr(x, y, z) { const m = this.m; this.t = [this.t[0] + m[0] * x + m[1] * y + m[2] * z, this.t[1] + m[3] * x + m[4] * y + m[5] * z, this.t[2] + m[6] * x + m[7] * y + m[8] * z]; return this; }
    _r(r) { const m = this.m, o = new Array(9); for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) o[i * 3 + j] = m[i * 3] * r[j] + m[i * 3 + 1] * r[3 + j] + m[i * 3 + 2] * r[6 + j]; this.m = o; return this; }
    rz(a) { const c = Math.cos(a), s = Math.sin(a); return this._r([c, -s, 0, s, c, 0, 0, 0, 1]); }
    ry(a) { const c = Math.cos(a), s = Math.sin(a); return this._r([c, 0, s, 0, 1, 0, -s, 0, c]); }
    rx(a) { const c = Math.cos(a), s = Math.sin(a); return this._r([1, 0, 0, 0, c, -s, 0, s, c]); }
    sc(k) { return this._r([k, 0, 0, 0, k, 0, 0, 0, k]); }
    grow() { const b = new Float32Array(this.a.length * 2); b.set(this.a); this.a = b; }
    /* üçgen: yerel köşeler, yerel normal */
    tri(p0, p1, p2, n, c, f, uv) {
      if ((this.n + 3) * VN > this.a.length) this.grow();
      const m = this.m, t = this.t, a = this.a, fl = (f || 0) | this.f;
      let nx = m[0] * n[0] + m[1] * n[1] + m[2] * n[2], ny = m[3] * n[0] + m[4] * n[1] + m[5] * n[2], nz = m[6] * n[0] + m[7] * n[1] + m[8] * n[2];
      const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
      const P = [p0, p1, p2];
      for (let i = 0; i < 3; i++) {
        const p = P[i], o = this.n * VN;
        a[o] = t[0] + m[0] * p[0] + m[1] * p[1] + m[2] * p[2];
        a[o + 1] = t[1] + m[3] * p[0] + m[4] * p[1] + m[5] * p[2];
        a[o + 2] = t[2] + m[6] * p[0] + m[7] * p[1] + m[8] * p[2];
        a[o + 3] = nx; a[o + 4] = ny; a[o + 5] = nz;
        a[o + 6] = c[0]; a[o + 7] = c[1]; a[o + 8] = c[2];
        a[o + 9] = uv ? uv[i * 2] : 0; a[o + 10] = uv ? uv[i * 2 + 1] : 0; a[o + 11] = fl;
        this.n++;
      }
    }
    quad(p0, p1, p2, p3, n, c, f, uv) {
      if (typeof c === 'string') c = col(c);
      this.tri(p0, p1, p2, n, c, f, uv && [uv[0], uv[1], uv[2], uv[3], uv[4], uv[5]]);
      this.tri(p0, p2, p3, n, c, f, uv && [uv[0], uv[1], uv[4], uv[5], uv[6], uv[7]]);
      return this;
    }
    /* dışbükey çokgen; normal köşelerden, out verilirse dışa bakacak şekilde çevrilir */
    poly(pts, c, f, out) {
      if (typeof c === 'string') c = col(c);
      let n = nrm(crs([pts[1][0] - pts[0][0], pts[1][1] - pts[0][1], pts[1][2] - pts[0][2]], [pts[2][0] - pts[0][0], pts[2][1] - pts[0][1], pts[2][2] - pts[0][2]]));
      if (out && dt3(n, out) < 0) n = [-n[0], -n[1], -n[2]];
      for (let i = 1; i < pts.length - 1; i++) this.tri(pts[0], pts[i], pts[i + 1], n, c, f);
      return this;
    }
    /* kutu: tabanı (x,y,z) merkezli, w (x) × d (y) × h (z); alt yüz çizilmez */
    box(x, y, z, w, d, h, c, f, top) {
      if (typeof c === 'string') c = col(c);
      const tc = top ? (typeof top === 'string' ? col(top) : top) : c;
      const x0 = x - w / 2, x1 = x + w / 2, y0 = y - d / 2, y1 = y + d / 2, z0 = z, z1 = z + h;
      this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1], tc, f);
      this.quad([x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1], [0, 1, 0], c, f);
      this.quad([x1, y0, z0], [x0, y0, z0], [x0, y0, z1], [x1, y0, z1], [0, -1, 0], c, f);
      this.quad([x1, y1, z0], [x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [1, 0, 0], c, f);
      this.quad([x0, y0, z0], [x0, y1, z0], [x0, y1, z1], [x0, y0, z1], [-1, 0, 0], c, f);
      return this;
    }
    cyl(x, y, z, r, h, n, c, f, top) {
      if (typeof c === 'string') c = col(c);
      const tc = top ? (typeof top === 'string' ? col(top) : top) : c;
      for (let i = 0; i < n; i++) {
        const a0 = i / n * TAU, a1 = (i + 1) / n * TAU, am = (a0 + a1) / 2;
        const p0 = [x + Math.cos(a0) * r, y + Math.sin(a0) * r], p1 = [x + Math.cos(a1) * r, y + Math.sin(a1) * r];
        this.quad([p1[0], p1[1], z], [p0[0], p0[1], z], [p0[0], p0[1], z + h], [p1[0], p1[1], z + h], [Math.cos(am), Math.sin(am), 0], c, f);
        this.tri([x, y, z + h], [p0[0], p0[1], z + h], [p1[0], p1[1], z + h], [0, 0, 1], tc, f);
      }
      return this;
    }
    cone(x, y, z, r, h, n, c, f, rot = 0) {
      if (typeof c === 'string') c = col(c);
      for (let i = 0; i < n; i++) {
        const a0 = i / n * TAU + rot, a1 = (i + 1) / n * TAU + rot, am = (a0 + a1) / 2;
        const p0 = [x + Math.cos(a0) * r, y + Math.sin(a0) * r, z], p1 = [x + Math.cos(a1) * r, y + Math.sin(a1) * r, z];
        this.tri(p1, p0, [x, y, z + h], nrm([Math.cos(am) * h, Math.sin(am) * h, r]), c, f);
        this.tri(p0, p1, [x, y, z], [0, 0, -1], c, f);
      }
      return this;
    }
    /* yontulmuş taç / kaya: ortada halka, üstte ve altta uç (yüzlü gölgelenir) */
    gem(x, y, z, r, up, down, n, c, f, rot = 0, sq = 1) {
      if (typeof c === 'string') c = col(c);
      const ring = [];
      for (let i = 0; i < n; i++) { const a = i / n * TAU + rot, rr = r * (0.86 + 0.14 * Math.sin(i * 2.7 + rot * 3)); ring.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr * sq, z]); }
      const T = [x, y, z + up], B = [x, y, z - down];
      for (let i = 0; i < n; i++) {
        const a = ring[i], b = ring[(i + 1) % n];
        // üst yarıyı iki kat: halka ile tepe arasında daralan ikinci halka
        const k = 0.55, a2 = [a[0] + (T[0] - a[0]) * k, a[1] + (T[1] - a[1]) * k, z + up * 0.62], b2 = [b[0] + (T[0] - b[0]) * k, b[1] + (T[1] - b[1]) * k, z + up * 0.62];
        a2[0] = x + (a[0] - x) * 0.72; a2[1] = y + (a[1] - y) * 0.72; b2[0] = x + (b[0] - x) * 0.72; b2[1] = y + (b[1] - y) * 0.72;
        const ox = (a[0] + b[0]) / 2 - x, oy = (a[1] + b[1]) / 2 - y;
        this.poly([a, b, b2, a2], c, f, [ox, oy, r * 0.4]);
        this.poly([a2, b2, T], c, f, [ox, oy, r]);
        if (down > 0) this.poly([b, a, B], sh2(c, -0.12), f, [ox, oy, -r]);
      }
      return this;
    }
    /* beşik çatı: mahya x boyunca; (x0,y0)-(x1,y1) saçak dikdörtgeni, z saçak yüksekliği, h mahya yüksekliği */
    gable(x0, y0, x1, y1, z, h, c, endC, f) {
      const ym = (y0 + y1) / 2;
      this.poly([[x0, y1, z], [x1, y1, z], [x1, ym, z + h], [x0, ym, z + h]], c, f, [0, 1, 1]);
      this.poly([[x1, y0, z], [x0, y0, z], [x0, ym, z + h], [x1, ym, z + h]], typeof c === 'string' ? sh(c, -0.1) : c, f, [0, -1, 1]);
      this.poly([[x0, y0, z], [x0, y1, z], [x0, ym, z + h]], endC, f, [-1, 0, 0]);
      this.poly([[x1, y1, z], [x1, y0, z], [x1, ym, z + h]], endC, f, [1, 0, 0]);
      return this;
    }
  }
  const sh2 = (c, k) => (typeof c === 'string' ? col(sh(c, k)) : [Math.min(1, c[0] * (1 + k)), Math.min(1, c[1] * (1 + k)), Math.min(1, c[2] * (1 + k))]);

  /* ---------------- gölgelendiriciler ---------------- */
  const HP = `#ifdef GL_FRAGMENT_PRECISION_HIGH
    precision highp float;
    #else
    precision mediump float;
    #endif
    `;
  const BIT = `float bit(float f, float b){ return mod(floor(f / b), 2.0); }`;
  const PACK = `vec4 pack(float d){ vec4 e = fract(d * vec4(1.0, 255.0, 65025.0, 16581375.0)); e -= e.yzww * vec4(1.0 / 255.0, 1.0 / 255.0, 1.0 / 255.0, 0.0); return e; }
    float unpack(vec4 c){ return dot(c, vec4(1.0, 1.0 / 255.0, 1.0 / 65025.0, 1.0 / 16581375.0)); }`;
  const DITHER = `float b2(vec2 a){ a = floor(a); return fract(a.x * 0.5 + a.y * a.y * 0.75); }
    float bay(vec2 a){ return b2(0.5 * a) * 0.25 + b2(a); }`;
  // ortak köşe dönüşümü: içerideyken binanın çatısı gizlenir, duvarları kesilir; taçlar rüzgârda salınır
  const VCOMMON = `attribute vec3 aP; attribute vec3 aN; attribute vec3 aC; attribute vec3 aU;
    uniform float uCut; uniform float uT; uniform float uWind; ${BIT}
    vec3 place(out float hide){ vec3 p = aP; hide = 0.0; float f = aU.z;
      if (uCut > 0.0) { if (bit(f, 1.0) > 0.5) hide = 1.0; p.z = min(p.z, uCut); }
      if (bit(f, 16.0) > 0.5) { float k = max(p.z - 6.0, 0.0) * 0.035 * uWind; p.x += sin(uT * 1.7 + aP.x * 0.07 + aP.y * 0.05) * k; p.y += cos(uT * 1.3 + aP.y * 0.06) * k * 0.5; }
      return p; }`;
  const VS = `${VCOMMON} uniform mat4 uVP;
    varying vec3 vW; varying vec3 vN; varying vec3 vC; varying vec2 vUV; varying float vF; varying float vD;
    void main(){ float hide; vec3 p = place(hide); if (hide > 0.5) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
      vW = p; vN = aN; vC = aC; vUV = aU.xy; vF = aU.z; vD = p.y * ${K.toFixed(3)} + p.z; gl_Position = uVP * vec4(p, 1.0); }`;
  const FS = `${HP} ${PACK} ${DITHER} ${BIT}
    varying vec3 vW; varying vec3 vN; varying vec3 vC; varying vec2 vUV; varying float vF; varying float vD;
    uniform sampler2D uTex; uniform float uGround; uniform sampler2D uOv; uniform vec2 uRes;
    uniform sampler2D uSh; uniform mat4 uLVP; uniform float uShOn; uniform float uShT; uniform float uShB;
    uniform sampler2D uHM; uniform vec4 uHR;
    uniform vec3 uSunD; uniform vec3 uSunC; uniform vec3 uAmb; uniform vec3 uWinC;
    uniform vec4 uLP[${NL}]; uniform vec3 uLC[${NL}];
    uniform vec3 uSee; uniform float uSeeD; uniform float uLv;
    float shadowAt(vec3 w){ vec4 q = uLVP * vec4(w, 1.0); vec3 p = q.xyz * 0.5 + 0.5;
      if (p.x < 0.0 || p.y < 0.0 || p.x > 1.0 || p.y > 1.0 || p.z > 1.0) return 1.0;
      float s = 0.0, z = p.z - uShB;
      s += step(z, unpack(texture2D(uSh, p.xy + vec2(-0.5, -0.5) * uShT)));
      s += step(z, unpack(texture2D(uSh, p.xy + vec2(0.5, -0.5) * uShT)));
      s += step(z, unpack(texture2D(uSh, p.xy + vec2(-0.5, 0.5) * uShT)));
      s += step(z, unpack(texture2D(uSh, p.xy + vec2(0.5, 0.5) * uShT)));
      return s * 0.25; }
    float occ(vec3 p, vec3 l){ for (int k = 1; k < 16; k++) { vec3 q = mix(p, l, float(k) / 16.0); vec2 uv = (q.xy - uHR.xy) / uHR.zw;
        if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) continue; if (texture2D(uHM, uv).r * 255.0 > q.z + 0.5) return 0.0; } return 1.0; }
    void main(){ float f = floor(vF + 0.5);
      if (uSee.z > 0.0 && bit(f, 8.0) > 0.5) { vec2 d = gl_FragCoord.xy - uSee.xy; if (dot(d, d) < uSee.z * uSee.z && vD > uSeeD + 2.0 && bay(gl_FragCoord.xy) < 0.72) discard; }
      vec3 alb = vC;
      if (uGround > 0.5) { alb = texture2D(uTex, vUV).rgb; vec4 ov = texture2D(uOv, vec2(gl_FragCoord.x / uRes.x, 1.0 - gl_FragCoord.y / uRes.y)); alb = mix(alb, ov.rgb, ov.a); }
      else if (bit(f, 4.0) > 0.5) alb = texture2D(uTex, vUV).rgb;
      vec3 n = normalize(vN);
      // malzeme: tahta duvar, tuğla, çatı kiremidi (dünya koordinatından, piksel ızgarasına oturur)
      if (uGround < 0.5 && abs(n.z) < 0.5) {
        float u = abs(n.y) > abs(n.x) ? vW.x : vW.y;
        if (bit(f, 32.0) > 0.5) alb *= 1.0 - 0.14 * step(fract(u / 4.0), 0.2) - 0.05 * step(0.5, fract(u / 8.0 + 0.13));
        else if (bit(f, 64.0) > 0.5) { float row = floor(vW.z / 4.0); float uu = u + mod(row, 2.0) * 4.0; alb *= 1.0 - 0.17 * max(step(fract(vW.z / 4.0), 0.22), step(fract(uu / 8.0), 0.11)); }
      } else if (uGround < 0.5 && bit(f, 1.0) > 0.5 && n.z >= 0.97) {
        alb *= 1.0 - 0.1 * step(fract(vW.y / 6.0), 0.16) + 0.05 * (fract(sin(floor(vW.x / 3.0) * 7.1 + floor(vW.y / 3.0) * 31.7) * 917.3) - 0.5);
      } else if (uGround < 0.5 && bit(f, 1.0) > 0.5 && n.z > 0.2 && n.z < 0.97) {
        float row = floor(vW.z / 2.4); float uu = vW.x + mod(row, 2.0) * 3.5;
        alb *= 1.0 - 0.24 * max(step(fract(vW.z / 2.4), 0.3), step(fract(uu / 7.0), 0.14) * 0.75) + 0.1 * (fract(sin(row * 12.9 + floor(uu / 7.0) * 78.2) * 437.5) - 0.5);
      }
      float s = uShOn > 0.5 ? shadowAt(vW + n * 1.2) : 1.0;
      vec3 lit = uAmb * (0.92 + 0.08 * n.z) + uSunC * max(dot(n, uSunD), 0.0) * s;
      for (int i = 0; i < ${NL}; i++) { vec4 L = uLP[i]; if (L.w <= 0.0) continue; vec3 d = L.xyz - vW; float dd = dot(d, d); float r2 = L.w * L.w; if (dd >= r2) continue;
        float a = 1.0 - dd / r2; a *= a; float nd = max(dot(n, d * inversesqrt(dd + 0.01)), 0.0) * 0.7 + 0.3;
        lit += uLC[i] * a * nd * occ(vW + n * 1.5, L.xyz); }
      vec3 c = alb * lit;
      if (bit(f, 2.0) > 0.5) c += uWinC;
      float dz = bay(gl_FragCoord.xy);
      gl_FragColor = vec4(floor(clamp(c, 0.0, 1.0) * uLv + dz) / uLv, 1.0); }`;
  // gölge haritası: ışığın gördüğü derinlik
  const DVS = `${VCOMMON} uniform mat4 uLVP; void main(){ float hide; vec3 p = place(hide); gl_Position = uLVP * vec4(p, 1.0); }`;
  const DFS = `${HP} ${PACK} void main(){ gl_FragColor = pack(gl_FragCoord.z); }`;
  // yükseklik haritası: tepeden bakışta duvar yükseklikleri (çatı hariç) → nokta ışıklar duvarda durur
  const HVS = `${VCOMMON} uniform mat4 uHVP; varying float vZ;
    void main(){ float hide; vec3 p = place(hide); if (bit(aU.z, 1.0) > 0.5) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; } vZ = p.z; gl_Position = uHVP * vec4(p, 1.0); }`;
  const HFS = `${HP} varying float vZ; void main(){ gl_FragColor = vec4(clamp(vZ / 255.0, 0.0, 1.0), 0.0, 0.0, 1.0); }`;

  /* ---------------- durum ---------------- */
  let gl = null, cv = null, failed = false, PRG = null, DP = null, HPg = null;
  let W0 = 0, H0 = 0, ov = null, octx = null, ovTex = null, atlas = null, atlasTex = null, atlasN = 0;
  let shT = null, shSize = 0, hmT = null, hmW = 0, hmH = 0, blankTex = null;
  let dynBuf = null, world = null;
  const chunks = new Map();            // cy*64+cx → { tex, buf, n, quad, used }
  const dyn = new MB(32768), tmp = new MB(16384);
  const stat = { frames: 0, ms: 0, tris: 0, chunks: 0, built: 0, err: '', seg: {} };
  const seg = (k, t) => { stat.seg[k] = (stat.seg[k] || 0) * 0.9 + t * 0.1; };

  function compile(vs, fs) {
    const mk = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
    const p = gl.createProgram(); gl.attachShader(p, mk(gl.VERTEX_SHADER, vs)); gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs));
    gl.bindAttribLocation(p, 0, 'aP'); gl.bindAttribLocation(p, 1, 'aN'); gl.bindAttribLocation(p, 2, 'aC'); gl.bindAttribLocation(p, 3, 'aU');
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const nm = gl.getActiveUniform(p, i).name; u[nm.replace(/\[0\]$/, '')] = gl.getUniformLocation(p, nm); }
    return { p, u };
  }
  function tex2d(w, h, nearest = true, src = null) {
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    if (src) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    const f = nearest ? gl.NEAREST : gl.LINEAR;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, f); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, f);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }
  function target(w, h, old) {
    if (old) { gl.deleteFramebuffer(old.fb); gl.deleteTexture(old.tex); gl.deleteRenderbuffer(old.rb); }
    const tex = tex2d(w, h, true);
    const rb = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, rb); gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, w, h);
    const fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, rb);
    const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return ok ? { fb, tex, rb } : null;
  }
  function init() {
    if (gl || failed) return !!gl;
    try {
      cv = document.createElement('canvas');
      gl = cv.getContext('webgl', { antialias: false, alpha: false, depth: true, preserveDrawingBuffer: false, powerPreference: 'high-performance' });
      if (!gl) throw new Error('WebGL yok');
      PRG = compile(VS, FS); DP = compile(DVS, DFS); HPg = compile(HVS, HFS);
      dynBuf = gl.createBuffer();
      blankTex = tex2d(1, 1, true);
      ov = makeCanvas(16, 16); octx = ov.getContext('2d');
      ovTex = tex2d(16, 16, true);
      atlas = makeCanvas(1024, 1024); atlasTex = tex2d(1024, 1024, true, atlas); atlasN = 0;
      return true;
    } catch (e) {
      console.warn('3D çizici açılamadı:', e);
      stat.err = String(e && e.message || e); failed = true; gl = null;
      return false;
    }
  }
  function sizeTo(w, h) {
    if (W0 === w && H0 === h) return;
    W0 = w; H0 = h; cv.width = w; cv.height = h;
    ov.width = w; ov.height = h;
  }
  /* dünya değişince (yeni oyun, mevsim, efekt ayarı) önbellek boşalır */
  function flush() {
    if (!gl) return;
    for (const c of chunks.values()) dropChunk(c);
    chunks.clear();
    if (world) for (const b of world.buildings) if (b._r3) { gl.deleteBuffer(b._r3.buf); b._r3 = null; }
    atlasN = 0; atlas.getContext('2d').clearRect(0, 0, 1024, 1024);
  }
  function dropChunk(c) { if (c.tex) gl.deleteTexture(c.tex); if (c.buf) gl.deleteBuffer(c.buf); if (c.quad) gl.deleteBuffer(c.quad); }
  function upload(mb, usage) {
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, mb.a.subarray(0, mb.n * VN), usage || gl.STATIC_DRAW);
    return { buf, n: mb.n };
  }

  /* ---------------- tabela dokusu (atlas) ---------------- */
  /* Tabela: yazı genişliği kadar hücre; doku pikseli = dünya pikseli (yazı ezilmez) → [u0, v0, u1, v1, genişlik] */
  function signUV(txt, bg, fg = '#1a120c') {
    const cw = 128, chh = 16, cols = 8, i = atlasN++;
    if (i >= cols * 64) return null;
    const x = (i % cols) * cw, y = Math.floor(i / cols) * chh, c = atlas.getContext('2d');
    c.font = 'bold 10px monospace';
    const w = Math.min(cw, Math.ceil(c.measureText(txt).width) + 8);
    c.fillStyle = bg; c.fillRect(x, y, w, chh);
    c.fillStyle = 'rgba(0,0,0,0.3)'; c.fillRect(x, y + chh - 2, w, 2); c.fillRect(x, y, w, 1);
    c.fillStyle = fg; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(txt, x + w / 2, y + chh / 2);
    gl.bindTexture(gl.TEXTURE_2D, atlasTex); gl.texSubImage2D(gl.TEXTURE_2D, 0, x, y, gl.RGBA, gl.UNSIGNED_BYTE, c.getImageData(x, y, cw, chh));
    return [x / 1024, y / 1024, (x + w) / 1024, (y + chh) / 1024, w];
  }

  /* ---------------- nesne modelleri ---------------- */
  const AUT = AUTUMN_PAL;
  const MODEL = new Set([O.PINE, O.SNOWPINE, O.OAK, O.APPLE, O.BIRCH, O.CYPRESS, O.DEAD, O.SEQUOIA, O.CACTUS, O.SAGUARO, O.BUSH, O.ROCK, O.BOULDER,
    O.FENCEH, O.FENCEV, O.CRATE, O.BARREL, O.LAMP, O.WELL, O.PUMP, O.TROUGH, O.GRAVE, O.CROSS, O.TENT, O.HAY, O.SIGN, O.CHEST, O.POLE, O.RUINWALL,
    O.HEDGE, O.FOUNTAIN, O.STATUE, O.BENCH, O.HITCH, O.WAGON, O.GALLOWS, O.LOTSIGN, O.BOARD, O.WINDMILL, O.ORE]);
  const SNOW = '#e8eef4';
  function canopy(m, x, y, z, r, cs, h, f) {
    m.gem(x, y, z, r, r * 0.85, r * 0.45, 7, cs[0], f, h * 6);
    m.gem(x + r * 0.28, y - r * 0.18, z + r * 0.42, r * 0.66, r * 0.6, r * 0.2, 6, cs[1], f, h * 9);
    m.gem(x - r * 0.32, y + r * 0.22, z + r * 0.22, r * 0.55, r * 0.5, r * 0.2, 6, cs[2], f, h * 4);
  }
  function object(m, o, x, y, h, W, tx, ty) {
    const season = W.season, snowy = season === 3 && W.snowyTile(tx, ty), S = F_SEE, SW = F_SEE | F_SWAY;
    switch (o) {
      case O.PINE: case O.SNOWPINE: {
        const r = 7 + h * 3.5, sn = o === O.SNOWPINE || snowy;
        m.box(x, y, 0, 2.6, 2.6, 8, '#4a3322', S);
        const cs = ['#20361f', '#2c4a28', '#3a5d33'];
        for (let k = 0; k < 3; k++) { const rr = r * (1 - k * 0.27), z = 5 + k * r * 0.62; m.cone(x, y, z, rr, rr * 1.25, 7, sn && k === 2 ? SNOW : cs[k], SW, h * 3 + k); if (sn && k < 2) m.cone(x, y, z + rr * 0.75, rr * 0.45, rr * 0.5, 7, SNOW, SW, h * 3 + k); }
        break;
      }
      case O.OAK: case O.APPLE: case O.BIRCH: {
        const birch = o === O.BIRCH, r = birch ? 6 + h * 3 : 8 + h * 3.5;
        m.box(x, y, 0, birch ? 2.4 : 3.2, birch ? 2.4 : 3.2, 10, birch ? '#e8e4d8' : '#4e3826', S);
        if (W.bareTree(tx, ty)) {
          const bc = birch ? '#d8d4c8' : '#4e3826';
          for (let k = 0; k < 6; k++) { m.push().tr(x, y, 9).rz(k / 6 * TAU + h * 5).ry(0.85).box(0, 0, 0, 1.4, 1.4, r * 0.9, bc, S); if (snowy) m.box(0, 0, r * 0.9, 1.6, 1.6, 0.8, SNOW, S); m.pop(); }
          break;
        }
        let cs = birch ? ['#4a6a2a', '#5e8436', '#7a9e48'] : season === 1 ? ['#2e4a1e', '#3c5c26', '#4f7030'] : ['#314d22', '#3f6129', '#557a35'];
        if (season === 2) cs = birch ? ['#b8902a', '#d8b040', '#f0d060'] : AUT[Math.floor(h * AUT.length)];
        if (snowy) cs = [cs[0], cs[1], SNOW];
        canopy(m, x, y, 10 + r * 0.45, r, cs, h, SW);
        if (o === O.APPLE && season !== 3) for (let k = 0; k < 6; k++) { const a = k * 1.9 + h * 7; m.box(x + Math.cos(a) * r * 0.7, y + Math.sin(a) * r * 0.6, 10 + r * 0.6 + (k % 3) * 2, 1.6, 1.6, 1.6, '#c0302a', SW); }
        break;
      }
      case O.CYPRESS: {
        const r = 8 + h * 3;
        m.cyl(x, y, 0, 2.2, 8, 6, '#5a4a3a', S);
        m.gem(x, y, 8 + r * 0.5, r * 0.75, r * 1.1, r * 0.4, 7, '#3a4a2a', SW, h * 4);
        m.gem(x + 1, y - 1, 8 + r * 1.1, r * 0.5, r * 0.7, 0, 6, '#4d5e36', SW, h * 7);
        break;
      }
      case O.DEAD: {
        m.box(x, y, 0, 2.4, 2.4, 13, '#5a4a3a', S);
        for (let k = 0; k < 4; k++) m.push().tr(x, y, 8 + k * 1.5).rz(k * 1.7 + h * 4).ry(0.9).box(0, 0, 0, 1.2, 1.2, 7, '#5a4838', S).pop();
        break;
      }
      case O.SEQUOIA: {
        m.cyl(x, y, 0, 8, 46, 8, '#7a4028', S, '#6a3822');
        canopy(m, x, y, 50, 30, ['#1f3a1c', '#2a4a24', '#3a5e30'], h, SW);
        break;
      }
      case O.CACTUS: {
        m.box(x, y, 0, 3.6, 3.6, 10, '#4a7a3a', S, '#5e9048');
        if (h > 0.4) { m.box(x + 2.8, y, 4, 2.4, 2, 2, '#4a7a3a', S); m.box(x + 3.6, y, 4, 2, 2, 5, '#4a7a3a', S); }
        if (h > 0.7) m.box(x, y, 10, 1.6, 1.6, 1.2, '#e0a0c0', S);
        break;
      }
      case O.SAGUARO: {
        m.cyl(x, y, 0, 2.7, 26, 7, '#3e6e32', S, '#58904a');
        m.box(x - 4.5, y, 9, 5, 2.8, 2.8, '#3e6e32', S); m.cyl(x - 6.5, y, 9, 1.6, 9, 6, '#3e6e32', S, '#58904a');
        m.box(x + 4.2, y, 12, 4.5, 2.8, 2.8, '#3e6e32', S); m.cyl(x + 6, y, 12, 1.6, 7, 6, '#3e6e32', S, '#58904a');
        break;
      }
      case O.BUSH: {
        const c = season === 2 ? (h > 0.5 ? ['#7a4a1e', '#9a6026'] : ['#6a5a26', '#8a7230']) : season === 3 ? ['#4a4a36', '#5a5a42'] : h > 0.5 ? ['#3a5a26', '#4a6e30'] : ['#40562a', '#506a34'];
        m.gem(x - 1.5, y, 3, 5.5, 4.5, 3, 7, c[0], SW, h * 5);
        m.gem(x + 2, y - 1, 4.5, 4, 3.5, 1, 6, c[1], SW, h * 8);
        if (snowy) m.gem(x, y, 7, 3.5, 1.5, 0, 6, SNOW, SW);
        break;
      }
      case O.ROCK: { const r = 2.5 + h * 2; m.gem(x, y, 0, r, r * 0.9, 0, 6, '#8a8278', 0, h * 5); break; }
      case O.BOULDER: { const r = 6 + h * 3; m.gem(x, y, 0.5, r, r * 1.05, 0.5, 7, '#77706a', S, h * 5); if (snowy) m.gem(x, y, r * 0.75, r * 0.6, r * 0.35, 0, 6, SNOW, S); break; }
      case O.ORE: { m.gem(x, y, 0, 5.5, 5, 0, 6, '#6a625c', 0, h * 3); m.box(x - 1.5, y, 3, 1.4, 1.4, 1.4, h > 0.7 ? '#e0c050' : '#c8d0d8'); m.box(x + 1.5, y + 1, 2, 1.4, 1.4, 1.4, h > 0.7 ? '#e0c050' : '#c8d0d8'); break; }
      case O.FENCEH: { m.box(x, y, 0, 2, 2, 10, '#5a3e26', S); m.box(x, y, 3.5, 16, 1.4, 1.6, '#6a4a2e', S); m.box(x, y, 7.5, 16, 1.4, 1.6, '#7a5a3a', S); break; }
      case O.FENCEV: { m.box(x, y, 0, 2, 2, 10, '#5a3e26', S); m.box(x, y, 3.5, 1.4, 16, 1.6, '#6a4a2e', S); m.box(x, y, 7.5, 1.4, 16, 1.6, '#7a5a3a', S); break; }
      case O.CRATE: { m.box(x, y, 0, 10, 10, 9, '#8a6a40', S, '#a8844f'); m.box(x, y + 5.1, 1, 10, 0.4, 1.2, '#5a4226', S); m.box(x, y + 5.1, 7, 10, 0.4, 1.2, '#5a4226', S); break; }
      case O.BARREL: { m.cyl(x, y, 0, 4, 10, 8, '#7a5230', S, '#946640'); m.cyl(x, y, 2.5, 4.2, 1, 8, '#4a4a4a', S); m.cyl(x, y, 7, 4.2, 1, 8, '#4a4a4a', S); break; }
      case O.LAMP: { m.box(x, y, 0, 1.8, 1.8, 24, '#2a2622', S); m.box(x, y, 24, 4.4, 4.4, 5, '#f0d890', S | F_WIN); m.box(x, y, 29, 5.4, 5.4, 1.4, '#2a2622', S); break; }
      case O.WELL: {
        m.cyl(x, y, 0, 6.5, 6, 10, '#7a746a', S, '#1e2a30');
        m.box(x - 5.5, y, 0, 1.6, 1.6, 18, '#5a3e26', S); m.box(x + 5.5, y, 0, 1.6, 1.6, 18, '#5a3e26', S);
        m.gable(x - 9, y - 5, x + 9, y + 5, 17, 6, '#6a3a24', '#5a3e26', S);
        break;
      }
      case O.PUMP: { m.box(x, y, 0, 4, 4, 11, '#3a4048', S, '#5a6068'); m.box(x + 3.5, y, 7, 4, 1.5, 1.5, '#3a4048', S); m.push().tr(x - 2, y, 10).ry(-0.9).box(0, 0, 0, 1.2, 1.2, 6, '#2a2e34', S).pop(); break; }
      case O.TROUGH: { m.box(x, y, 0, 20, 7, 5, '#6a4a2e', S, '#3e6a78'); break; }
      case O.GRAVE: { m.box(x, y - 1, 0, 6, 2, 8, '#8a8680', S, '#a29e98'); break; }
      case O.CROSS: { m.box(x, y, 0, 1.6, 1.6, 11, '#6a4a2e', S); m.box(x, y, 7, 6.5, 1.4, 1.5, '#6a4a2e', S); break; }
      case O.TENT: { m.gable(x - 8, y - 7, x + 8, y + 7, 0, 13, '#c8b890', '#a89870', S); m.box(x + 8.05, y, 0, 0.2, 3.5, 7, '#2a2016', S); break; }
      case O.HAY: { m.box(x, y, 0, 14, 8, 8, '#c8a850', S, '#e0c068'); break; }
      case O.SIGN: { m.box(x, y, 0, 1.6, 1.6, 16, '#5a3e26', S); m.box(x + 1, y, 12, 13, 1, 4, '#9a7650', S); m.box(x - 1, y, 7, 13, 1, 4, '#8a6a46', S); break; }
      case O.CHEST: { m.box(x, y, 0, 10, 7, 6, '#6a4424', S, '#84582e'); m.box(x, y + 3.6, 3, 2, 0.4, 2, '#c8a040', S); break; }
      case O.POLE: { m.box(x, y, 0, 1.8, 1.8, 34, '#5a4430', S); m.box(x, y, 30, 11, 1.4, 1.4, '#5a4430', S); break; }
      case O.RUINWALL: { m.box(x, y, 0, 16, 4, 8 + h * 10, h > 0.5 ? '#8a7a64' : '#7a6a58', S, '#a8987e'); break; }
      case O.HEDGE: { m.box(x, y, 0, 16, 8, 10, '#2e4a24', S, '#3e6230'); for (let k = 0; k < 3; k++) m.gem(x - 5 + k * 5, y, 10, 3, 2, 0, 5, snowy ? SNOW : '#3e6230', S, k + h); break; }
      case O.FOUNTAIN: { m.cyl(x, y, 0, 12, 4, 12, '#8a847a', S, '#3e6a80'); m.cyl(x, y, 0, 2, 13, 6, '#a8a196', S); m.cyl(x, y, 12, 4.5, 1.6, 8, '#b8b2a8', S, '#4e7a90'); break; }
      case O.STATUE: { m.box(x, y, 0, 12, 8, 4, '#8a847a', S, '#a8a196'); m.box(x, y, 4, 8, 6, 10, '#9a948a', S); m.push().tr(x, y, 14).box(0, 0, 0, 3.6, 4.4, 11, '#4e6a5a', S).box(0, 0, 11, 3.4, 3.4, 3.6, '#5a7a68', S).box(2.5, 1.5, 7, 6, 1.4, 1.4, '#4e6a5a', S).pop(); break; }
      case O.BENCH: { m.box(x, y, 3, 16, 4, 1.4, '#7a5836', S); m.box(x, y - 2, 3, 16, 1, 5, '#5a3e26', S); m.box(x - 6, y, 0, 1.4, 3.6, 3, '#4a3222', S); m.box(x + 6, y, 0, 1.4, 3.6, 3, '#4a3222', S); break; }
      case O.HITCH: { m.box(x - 7, y, 0, 1.6, 1.6, 9, '#5a3e26', S); m.box(x + 7, y, 0, 1.6, 1.6, 9, '#5a3e26', S); m.box(x, y, 8, 16, 1.6, 1.6, '#7a5836', S); break; }
      case O.WAGON: {
        m.push().tr(x + 6, y, 0).rz(h * 0.4 - 0.2);
        m.box(0, 0, 4, 24, 11, 5, '#7a5836', S, '#6a4a2e');
        for (const [wx, wy] of [[-8, -6.5], [8, -6.5], [-8, 6.5], [8, 6.5]]) m.box(wx, wy, 0, 7, 1.4, 7, '#3a2a1a', S);
        m.pop();
        break;
      }
      case O.GALLOWS: { m.box(x, y, 0, 20, 12, 6, '#6a4a2e', S); m.box(x - 7, y, 6, 2, 2, 22, '#4a3422', S); m.box(x, y, 26, 16, 2, 2, '#4a3422', S); m.box(x + 5, y, 17, 0.8, 0.8, 9, '#a89060', S); break; }
      case O.LOTSIGN: case O.BOARD: {
        m.box(x - 4, y, 0, 1.4, 1.4, 12, '#4a3422', S); m.box(x + 4, y, 0, 1.4, 1.4, 12, '#4a3422', S);
        m.box(x, y + 0.2, 10, 13, 1, 9, o === O.LOTSIGN ? '#e8dcc0' : '#6a4a2e', S);
        if (o === O.LOTSIGN) m.box(x, y + 0.8, 16, 13, 0.4, 2.4, '#b3261e', S); else { m.box(x - 2.5, y + 0.8, 12, 4, 0.4, 5, '#e0d4b0', S); m.box(x + 2.5, y + 0.8, 13, 4, 0.4, 5, '#e0d4b0', S); }
        break;
      }
      case O.WINDMILL: {
        for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) m.push().tr(x + a * 6, y + b * 6, 0).rx(b * 0.18).ry(-a * 0.18).box(0, 0, 0, 1.4, 1.4, 34, '#5a4a3a', S).pop();
        m.box(x, y + 1, 34, 4, 5, 4, '#4a4440', S);
        for (let k = 0; k < 8; k++) m.push().tr(x, y + 4, 36).rx(Math.PI / 2).rz(k / 8 * TAU + h).box(0, 5.5, 0, 2.4, 11, 0.4, '#8a8680', S).pop();
        break;
      }
    }
  }

  /* ---------------- binalar ---------------- */
  const WESTERN_SKIP = new Set(['station', 'barn', 'hermit', 'cabin', 'house', 'property', 'ranch']);
  function building(m, b, W) {
    const d = b.def, X = b.x * TS, Y = b.y * TS, Wd = b.w * TS, Hd = b.h * TS, S = Y + Hd, h = hash2(b.x, b.y, 5), t = 3;
    const SE = F_SEE, RF = F_ROOF | F_SEE;
    const snowy = W.season === 3 && W.snowyTile(b.x + (b.w >> 1), b.y + (b.h >> 1));
    if (b.type === 'mineentrance') {
      m.gem(X + Wd / 2, Y + Hd * 0.45, 0, Wd * 0.55, 30, 0, 8, b.cave ? '#4a443e' : '#5a4a3a', SE, h, Hd / Wd);
      m.box(X + Wd / 2, S - 2, 0, Wd * 0.45, 2, 14, '#0a0806', SE);
      if (!b.cave) { m.box(X + Wd * 0.25, S - 1, 0, 3, 3, 16, '#6a4a2e', SE); m.box(X + Wd * 0.75, S - 1, 0, 3, 3, 16, '#6a4a2e', SE); m.box(X + Wd / 2, S - 1, 15, Wd * 0.56, 3, 3, '#6a4a2e', SE); }
      return;
    }
    if (b.type === 'lighthouse') {
      const cx = X + Wd / 2, cy = Y + Hd / 2;
      m.cyl(cx, cy, 0, Wd * 0.3, 70, 10, '#e8e0d8', SE); m.cyl(cx, cy, 20, Wd * 0.31, 8, 10, '#b0302a', SE); m.cyl(cx, cy, 44, Wd * 0.31, 8, 10, '#b0302a', SE);
      m.cyl(cx, cy, 70, Wd * 0.26, 10, 10, '#f8e8a0', SE | F_WIN); m.cone(cx, cy, 80, Wd * 0.32, 12, 10, '#a02a20', SE);
      return;
    }
    if (b.type === 'market') {
      const n = 4, sw = Wd / n, awn = ['#a83a2a', '#2e6a4a', '#2e4a7a', '#a8782a'];
      for (let k = 0; k < n; k++) {
        const sx = X + k * sw + 3, w = sw - 6;
        m.box(sx + 1, Y + 8, 0, 1.5, 1.5, 26, '#4a3422', SE); m.box(sx + w - 1, Y + 8, 0, 1.5, 1.5, 26, '#4a3422', SE);
        m.box(sx + 1, S - 4, 0, 1.5, 1.5, 22, '#4a3422', SE); m.box(sx + w - 1, S - 4, 0, 1.5, 1.5, 22, '#4a3422', SE);
        m.box(sx + w / 2, S - 16, 0, w, 10, 9, '#6a4a2c', SE, '#8a6440');
        for (let q = 0; q < w / 4; q++) m.poly([[sx + q * 4, Y + 4, 27], [sx + q * 4 + 4, Y + 4, 27], [sx + q * 4 + 4, S - 2, 22], [sx + q * 4, S - 2, 22]], snowy ? SNOW : q % 2 ? '#efe8da' : awn[k], RF, [0, 0, 1]);
      }
      return;
    }
    const modern = b.modern && !MODERN_SKIP.has(b.type);
    const tall = d.tall || modern;
    const Hw = modern ? (d.tall ? 66 : 54) : tall ? 58 : 40;
    let wallC = d.ruin ? '#5a4c3c' : d.wall, roofC = d.roof, brick = d.brick;
    if (modern) { const pal = MODERN_WALLS[Math.floor(hash2(b.x, b.y, 7) * MODERN_WALLS.length)]; wallC = MODERN_TYPE_WALL[b.type] || pal.c; brick = MODERN_TYPE_WALL[b.type] ? false : pal.brick; }
    const trim = sh(wallC, -0.28);
    // duvarlar (kalın kutular: yükseklik haritasında görünür)
    if (d.ruin) {
      for (let k = 0; k < b.w; k++) {
        const hh = 8 + hash2(b.x + k, b.y, 3) * 26;
        m.box(X + k * TS + 8, Y + t / 2, 0, TS, t, hh, wallC, SE); m.box(X + k * TS + 8, S - t / 2, 0, TS, t, hh * 0.7, wallC, SE);
      }
      for (let k = 0; k < b.h; k++) { const hh = 8 + hash2(b.x, b.y + k, 4) * 22; m.box(X + t / 2, Y + k * TS + 8, 0, t, TS, hh, wallC, SE); m.box(X + Wd - t / 2, Y + k * TS + 8, 0, t, TS, hh * 0.8, wallC, SE); }
      return;
    }
    const WF = SE | (brick ? F_BRICK : modern ? 0 : F_PLANK);
    m.box(X + Wd / 2, Y + t / 2, 0, Wd, t, Hw, wallC, WF);
    m.box(X + Wd / 2, S - t / 2, 0, Wd, t, Hw, wallC, WF);
    m.box(X + t / 2, Y + Hd / 2, 0, t, Hd - 2 * t, Hw, wallC, WF);
    m.box(X + Wd - t / 2, Y + Hd / 2, 0, t, Hd - 2 * t, Hw, wallC, WF);
    // köşe dikmeleri, süpürgelik, cephe şeritleri (tahta ya da tuğla izlenimi)
    for (const cx of [X + 1.5, X + Wd - 1.5]) m.box(cx, S - 1.5, 0, 3.4, 3.4, Hw, trim, SE);
    m.box(X + Wd / 2, S + 0.2, 0, Wd, 0.6, 3, trim, SE);
    if (modern) { m.box(X + Wd / 2, S + 0.6, Hw * 0.5, Wd, 1.6, 2, '#e4dccb', SE); m.box(X + Wd / 2, S + 0.6, Hw - 3, Wd + 2, 2, 3, '#e4dccb', SE); m.box(X + Wd / 2, S + 0.4, 0, Wd, 1, 3, '#6a645c', SE); }
    // kapı
    const dx = b.door.x, barn = b.type === 'stable' || b.type === 'barn';
    m.box(dx, S + 0.4, 0, barn ? 20 : 10, 1, barn ? 26 : 22, barn ? '#2a1e14' : '#3a2616', SE);
    if (!barn) { m.box(dx, S + 0.9, 1, 8, 0.4, 19, '#5a3e26', SE); m.box(dx + 2.5, S + 1.2, 10, 1, 0.4, 1, '#c8a040', SE); }
    // pencereler (gece yanar)
    const nWin = Math.max(1, Math.floor(b.w / 3)), rows = tall ? [9, Hw * 0.5 + 10] : [9];
    for (let k = 0; k < nWin; k++) {
      const cx = X + (k + 0.5) * Wd / nWin;
      if (Math.abs(cx - dx) < 12) continue;
      for (const z of rows) { m.box(cx, S + 0.4, z, 10, 1, 13, modern ? '#e8e0d0' : '#3a2a1c', SE); m.box(cx, S + 0.9, z + 1.5, 7, 0.6, 10, '#27394a', SE | F_WIN); }
    }
    // tente: pencerelerin üstünde dar, eğik şerit (derin veranda çatısı cepheyi ve kapıyı örterdi)
    if (b.type !== 'station' && b.type !== 'barn' && b.type !== 'hermit') {
      const pz = 26, ac = snowy ? SNOW : modern ? MODERN_AWN[Math.floor(h * 5)] : sh(roofC, -0.1);
      for (let xx = X - 1, q = 0; xx < X + Wd + 1; xx += 4, q++) m.poly([[xx, S, pz + 3], [Math.min(X + Wd + 1, xx + 4), S, pz + 3], [Math.min(X + Wd + 1, xx + 4), S + 6, pz - 1], [xx, S + 6, pz - 1]], modern && !snowy && q % 2 ? '#efe8da' : ac, RF, [0, 1, 1]);
    }
    // çatı
    const ov = 4;
    if (modern) {
      // düz çatı: katran kaplama, açık renk korkuluk, tuğla baca
      m.box(X + Wd / 2, Y + Hd / 2, Hw, Wd + 2, Hd + 2, 1.5, '#4e5058', RF, snowy ? SNOW : '#4e5058');
      for (const [bx, by, bw, bd] of [[X + Wd / 2, Y, Wd + 4, 3], [X + Wd / 2, S, Wd + 4, 3], [X, Y + Hd / 2, 3, Hd], [X + Wd, Y + Hd / 2, 3, Hd]]) m.box(bx, by, Hw, bw, bd, 5, '#d4ccbb', RF);
      m.box(X + Wd * (0.18 + h * 0.6), Y + Hd * 0.3, Hw, 6, 6, 14, '#7a3e2e', RF, '#3a2420');
    } else {
      const rh = Math.min(30, Hd * 0.32);
      m.gable(X - ov, Y - ov, X + Wd + ov, S + ov, Hw, rh, snowy ? SNOW : roofC, wallC, RF);
      // mahya ve saçak çizgisi
      m.box(X + Wd / 2, (Y + S) / 2, Hw + rh - 0.6, Wd + 2 * ov, 1.6, 1.2, snowy ? '#d6dee6' : sh(roofC, 0.25), RF);
      if (h > 0.3 && b.type !== 'station') m.box(X + Wd * (0.2 + h * 0.5), Y + Hd * 0.35, Hw + rh * 0.4, 5, 5, rh * 0.75, '#5a4a44', RF, '#2a2220');
    }
    // sahte cephe ve tabela
    const txt = b.type === 'property' ? (b.owned ? 'HOME' : 'FOR SALE') : SIGN_TEXT[b.type];
    const western = !d.church && !WESTERN_SKIP.has(b.type) && !modern;
    if (western) {
      const fh = tall ? 30 : 24;
      m.box(X + Wd / 2, S - t / 2, Hw, Wd, t + 0.6, fh - 6, wallC, RF);
      m.box(X + Wd / 2, S - t / 2, Hw + fh - 6, Wd * 0.6, t + 0.6, 6, wallC, RF);
      m.box(X + Wd / 2, S + 0.3, Hw + fh - 7, Wd, 0.8, 1.2, trim, RF);
    }
    if (txt) {
      const uv = modern ? signUV(txt, '#1e2a24', '#ead490') : signUV(txt, d.sign || '#c9a45c');
      if (uv) {
        // tabela biraz geriye yatık: üstten bakan kamerada yazı ezilmesin
        const sw = Math.min(Wd - 4, uv[4]), z0 = western ? Hw + (tall ? 8 : 5) : modern ? Hw - 18 : Hw - 15, z1 = z0 + 14, y = S + 1.4, lean = 7;
        m.box(X + Wd / 2, y + lean / 2, z0 - 1, sw + 2, lean + 1, 1, '#3a2818', western || modern ? RF : SE);   // tabelanın alt pervazı
        m.quad([X + Wd / 2 - sw / 2, y + lean, z0], [X + Wd / 2 + sw / 2, y + lean, z0], [X + Wd / 2 + sw / 2, y, z1], [X + Wd / 2 - sw / 2, y, z1], nrm([0, 14, lean]), [1, 1, 1], (western || modern ? RF : SE) | F_TEX,
          [uv[0], uv[3], uv[2], uv[3], uv[2], uv[1], uv[0], uv[1]]);
      }
    }
    if (d.church) {
      const cx = X + Wd / 2, rh = Math.min(30, Hd * 0.32);
      m.box(cx, S - 8, Hw, 14, 14, rh + 18, '#e8e0d0', RF);
      m.cone(cx, S - 8, Hw + rh + 18, 10, 18, 4, '#4a3a34', RF, Math.PI / 4);
      m.box(cx, S - 8, Hw + rh + 36, 1.6, 1.6, 9, '#d8c080', RF); m.box(cx, S - 8, Hw + rh + 41, 6, 1.4, 1.4, '#d8c080', RF);
    }
    if (b.type === 'station') {
      m.box(X + Wd / 2, S + 6, 0, Wd + 60, 14, 3, '#6a5a48', SE, '#8a7660');
      for (let xx = X - 26; xx < X + Wd + 30; xx += 24) m.box(xx, S + 11, 3, 1.8, 1.8, 26, '#4a3422', SE);
      m.poly([[X - 30, S - 2, 32], [X + Wd + 30, S - 2, 32], [X + Wd + 30, S + 14, 28], [X - 30, S + 14, 28]], snowy ? SNOW : '#3a4a5a', RF, [0, 0, 1]);
    }
  }
  function buildingMesh(b) {
    if (b._r3 && b._r3.season === world.season) return b._r3;
    if (b._r3) gl.deleteBuffer(b._r3.buf);
    tmp.reset(); building(tmp, b, world);
    const r = upload(tmp); r.season = world.season;
    // gece pencere ışığının yanıp yanmadığı: binanın pencere ışıklarından biri
    r.win = world.lights.find(L => L.type === 'window' && L.b === b.id) || null;
    b._r3 = r;
    return r;
  }

  /* ---------------- chunk: zemin dokusu + nesne modelleri ---------------- */
  function buildChunk(cx, cy) {
    const W = world, ox = cx * CPX, oy = cy * CPX;
    const g = makeCanvas(CPX, CPX), gc = g.getContext('2d');
    const gen = W.chunkGround(cx, cy, gc); while (!gen.next().done);
    gc.save(); gc.translate(-ox, -oy);
    for (const r of W.rails) W.drawRail(gc, r, ox, oy);
    tmp.reset();
    const tx0 = cx * CHUNK, ty0 = cy * CHUNK, tx1 = tx0 + CHUNK, ty1 = ty0 + CHUNK;
    for (let ty = ty0 - 3; ty < ty1 + 3; ty++) for (let tx = tx0 - 3; tx < tx1 + 3; tx++) {
      if (!W.inb(tx, ty)) continue;
      const i = ty * WW + tx, ob = W.obj[i];
      if (!ob || isHerbO(ob) || ob === O.ARTIFACT || (W.flags[i] & 16) || ob === O.CAMPFIRE) continue;
      const own = tx >= tx0 && tx < tx1 && ty >= ty0 && ty < ty1;
      if (MODEL.has(ob)) { if (own) object(tmp, ob, tx * TS + 8, ty * TS + 8, hash2(tx, ty, 77), W, tx, ty); }
      else Spr.object(gc, gc, ob, tx * TS + 8, ty * TS + 8, hash2(tx, ty, 77), W);   // yassı süsler zemine işlenir
    }
    // kamp ateşinin taşları zemine, alevi her kare
    for (let ty = ty0; ty < ty1; ty++) for (let tx = tx0; tx < tx1; tx++) if (W.obj[ty * WW + tx] === O.CAMPFIRE) Spr.object(gc, gc, O.CAMPFIRE, tx * TS + 8, ty * TS + 8, 0, W);
    for (const b of W.buildings) {
      const bx = b.x * TS, by = b.y * TS;
      if (bx + b.w * TS + 40 < ox || bx - 40 > ox + CPX || by + b.h * TS + 40 < oy || by - 60 > oy + CPX) continue;
      if (b.enter) Spr.interior(gc, b, W);
      else if (b.type === 'market') Spr.market(gc, NOPCTX, b, W);
    }
    gc.restore();
    const c = { tex: tex2d(CPX, CPX, true, g), buf: null, n: 0, used: 0 };
    if (tmp.n) { const u = upload(tmp); c.buf = u.buf; c.n = u.n; }
    // zemin dörtgeni
    tmp.reset();
    tmp.quad([ox, oy, 0], [ox + CPX, oy, 0], [ox + CPX, oy + CPX, 0], [ox, oy + CPX, 0], [0, 0, 1], [1, 1, 1], 0, [0, 0, 1, 0, 1, 1, 0, 1]);
    c.quad = upload(tmp).buf;
    stat.built++;
    return c;
  }
  function chunk(cx, cy, sync) {
    const key = cy * 64 + cx;
    let c = chunks.get(key);
    if (!c) {
      if (!sync) return null;
      c = buildChunk(cx, cy); chunks.set(key, c);
      if (chunks.size > 40) { let ok = -1, ot = Infinity; for (const [k, v] of chunks) if (v.used < ot && k !== key) { ot = v.used; ok = k; } dropChunk(chunks.get(ok)); chunks.delete(ok); }
    }
    c.used = performance.now();
    return c;
  }

  /* ---------------- canlılar ---------------- */
  function human(m, x, y, z, ang, L, st, scale = 1) {
    m.push().tr(x, y, z).rz(ang);
    if (scale !== 1) m.sc(scale);
    if (st.dead || st.lying) {
      if (st.dead && !st.noPool) { const pk = st.pool === undefined ? 1 : st.pool, r = 3 + 6 * pk; m.push().rz(-ang); for (let i = 0; i < 10; i++) m.tri([0, 0, 0.3], [Math.cos(i / 10 * TAU) * r * 1.1, Math.sin(i / 10 * TAU) * r * 0.8, 0.3], [Math.cos((i + 1) / 10 * TAU) * r * 1.1, Math.sin((i + 1) / 10 * TAU) * r * 0.8, 0.3], [0, 0, 1], col(pk > 0.5 ? '#5a0a0a' : '#7a1010')); m.pop(); }
      m.tr(-13, 0, 3).ry(Math.PI / 2);
      st = { tied: st.tied };
    }
    const cr = st.crouch ? 0.82 : 1, mv = st.riding ? 0 : Math.min(1, st.mv || 0), sw = Math.sin(st.walk || 0) * mv;
    const coat = L.coat, pants = L.pants, skin = L.skin;
    // bacaklar
    for (const s of [-1, 1]) {
      m.push().tr(0, s * 2, 12 * cr);
      if (st.riding) m.rx(s * 0.85).ry(-0.9); else m.ry(sw * 0.55 * s);
      m.box(0, 0, -12 * cr, 3, 2.8, 12 * cr, pants);
      m.box(0.6, 0, -12 * cr, 4.2, 3, 2.4, '#231710');
      if (st.tied) m.box(0, 0, -9, 3.4, 3.2, 1, '#c8a870');
      m.pop();
    }
    if (L.coatLen) m.box(-1, 0, (12 - 4 * L.coatLen) * cr, 4.4, 8.4, (4 + 4 * L.coatLen) * cr, sh(coat, -0.12));
    // gövde
    m.box(0, 0, 11.5 * cr, 4.6, 8, 10.5 * cr, coat);
    m.box(2.35, 0, 15 * cr, 0.4, 3, 6.5 * cr, L.shirt);
    m.box(0, 0, 11.5 * cr, 4.8, 8.2, 1.2, '#2a1c14');
    if (st.backGun) m.push().tr(-2.8, 0, 10).rx(0.55).box(0, 0, 0, 1.2, 1.4, 13, '#3a2618').pop();
    // kollar
    const aim = st.aim && st.wk;
    for (const s of [-1, 1]) {
      m.push().tr(0, s * 5, 21.5 * cr);
      if (aim && (st.wk === 'long' || st.wk === 'bow' || s > 0 || st.wk === 'fists')) {
        m.rz(-s * (st.wk === 'long' ? 0.35 : 0.25)).ry(Math.PI / 2 - 0.08);
        m.box(0, 0, 0, 2.4, 2.4, 8.5, coat); m.box(0, 0, 8.5, 2.2, 2.2, 1.8, skin);
        if (s > 0 && st.wk === 'long') m.box(-0.5, 0, 5, 1.8, 1.4, 14, '#2a2a2e');
        else if (s > 0 && st.wk === 'pistol') m.box(0, 0, 9.5, 1.6, 1.4, 5, '#2a2a2e');
        else if (s > 0 && st.wk === 'knife') m.box(0, 0, 10, 0.8, 1, 4, '#c8ccd0');
        else if (s < 0 && st.wk === 'bow') m.box(0, 0, 10, 1, 12, 1, '#6a4a28');
      } else if (st.riding) {
        m.ry(Math.PI / 2 - 0.6); m.box(0, 0, 0, 2.3, 2.3, 8, coat); m.box(0, 0, 8, 2, 2, 1.6, skin);
      } else if (st.hold === 'crate') {
        m.ry(Math.PI / 2 - 0.3); m.box(0, 0, 0, 2.3, 2.3, 7, coat); if (s > 0) m.box(-1, -5, 6, 6, 7, 6, '#9a6e40');
      } else {
        m.ry(-sw * 0.6 * s + (st.swing && s > 0 ? -1.4 * st.swing : 0));
        m.box(0, 0, -9 * cr, 2.3, 2.3, 9 * cr, coat); m.box(0, 0, -10.6 * cr, 2, 2, 1.6, skin);
        if (st.hasGun && s > 0) m.box(0, 1.3, -7, 1.4, 1, 3, '#2a1c14');
      }
      m.pop();
    }
    // baş
    m.push().tr(0, 0, 22 * cr);
    if (st.head) m.rz(st.head);
    m.box(0.3, 0, 0, 4.6, 4.8, 5.2, skin);
    m.box(2.65, -1.2, 2.6, 0.2, 0.8, 0.8, '#1a120c'); m.box(2.65, 1.2, 2.6, 0.2, 0.8, 0.8, '#1a120c');
    const hc = L.hairNow || L.hair;
    if (L.mask === 'bandana') m.box(1.2, 0, 0.3, 3.2, 5.2, 2.3, '#a8281f');
    if (L.mask === 'sack') m.box(0.3, 0, -0.2, 5.2, 5.4, 6, '#c8a870');
    else if (L.beard) m.box(1.8, 0, -0.4, 1.4, 4.2, 2.2 * (L.beardLen || 0.6) + 0.6, hc);
    if (L.hat && L.hat !== 'none' && L.mask !== 'sack') {
      const S = LOOKS.hatShape[L.hat] || LOOKS.hatShape.cowboy, c = hatColor(L.hat, L.hatCol), k = 1 + (st.hatK || 0) * 0.3;
      if (L.hat === 'bonnet') { m.box(-0.4, 0, 1.5, 5.6, 6, 5, c); m.box(2.4, 0, 1.5, 0.6, 6.4, 5.2, sh(c, 0.18)); }
      else {
        m.box(0, 0, 4.6 + (st.hatK || 0) * 2, S.br * 1.9 * k, S.br * 1.9 * k, 0.9, c);
        m.box(-0.2, 0, 5.4 + (st.hatK || 0) * 2, 5, 5, L.hat === 'top' ? 6 : L.hat === 'flat' ? 1.8 : 3.4, sh(c, -0.22), 0, sh(c, -0.1));
      }
    } else if (L.mask !== 'sack') {
      m.box(-0.4, 0, 3.4, 5.2, 5.2, 2.4, hc);
      m.box(-2.2, 0, 0, 1.2, 5.2, 4.4, hc);
      if (L.sex === 'f' && L.hairStyle !== 9) m.box(-2.6, 0, -2.5, 1.4, 4, 4, hc);
    }
    m.pop();
    m.pop();
  }
  function horse(m, x, y, ang, L, st) {
    m.push().tr(x, y, 0).rz(ang);
    if (st.dead) { m.tr(0, 0, 4.5).rx(Math.PI / 2); }
    const p = st.phase || 0, mv = st.dead ? 0 : Math.min(1, st.mv || 0), c = L.col, lc = sh(c, -0.3);
    for (const [lx, ly, ph] of [[7.5, -2.8, 0], [7.5, 2.8, Math.PI], [-7.5, -2.8, Math.PI * 0.6], [-7.5, 2.8, Math.PI * 1.6]]) {
      m.push().tr(lx, ly, 12).ry(Math.sin(p + ph) * 0.55 * mv);
      m.box(0, 0, -12, 2.6, 2.4, 12, lc); m.box(0.2, 0, -12, 2.8, 2.6, 1.8, '#1a1410');
      m.pop();
    }
    m.box(0, 0, 10.5, 20, 8.2, 8.5, c, 0, sh(c, 0.08));
    m.box(9.2, 0, 11.5, 3.5, 7.4, 7.5, c);
    m.box(-9.5, 0, 11.8, 2, 7.6, 6.8, sh(c, -0.05));
    // boyun ve baş
    const graze = st.graze ? 1 : 0;
    m.push().tr(10, 0, 16).ry(graze ? 1.9 : 0.62);
    m.box(0, 0, 0, 4.4, 3.8, 10, c); m.box(-2, 0, 1, 1.2, 1.8, 9.5, L.mane);
    m.tr(0.5, 0, 9.5).ry(graze ? -0.2 : 1.05);
    m.box(0, 0, -1, 3.8, 3.4, 8.5, c); if (L.blaze) m.box(1.95, 0, 0, 0.3, 1.2, 7, '#f0ece4');
    m.box(-1.2, -1.2, -1.5, 1, 0.8, 2, sh(c, -0.2)); m.box(-1.2, 1.2, -1.5, 1, 0.8, 2, sh(c, -0.2));
    m.pop();
    // kuyruk
    m.push().tr(-10.8, 0, 17).ry(0.45 + Math.sin(p * 0.5) * 0.15 * mv).box(0, 0, -10, 2.2, 1.6, 10, L.mane).pop();
    if (st.saddle) {
      m.box(-0.5, 0, 18.8, 9, 9.2, 0.7, L.blanket || '#8a2a20');
      m.box(-0.5, 0, 19.3, 7, 7, 1.8, '#5a3a20'); m.box(2.6, 0, 19.3, 1.6, 1.6, 3, '#3a2412');
      if (st.bags) { m.box(-5.5, -5, 13, 4, 1.6, 4, '#6a4424'); m.box(-5.5, 5, 13, 4, 1.6, 4, '#6a4424'); }
    }
    m.pop();
  }
  function animal(m, a) {
    const d = a.def, Ln = d.len, Wd = d.wid, c = a.skinned ? '#9a3a2a' : d.col, c2 = d.col2;
    if (d.shape === 'horse') { horse(m, a.x, a.y, a.ang, { col: c, mane: c2 }, { phase: a.phase, mv: a.mv, dead: a.dead }); return; }
    m.push().tr(a.x, a.y, 0).rz(a.ang);
    if (a.dead && d.shape !== 'snake' && d.shape !== 'gator') m.tr(0, 0, Wd * 0.5).rx(Math.PI / 2);
    const p = a.phase || 0, mv = a.dead ? 0 : Math.min(1, a.mv || 0);
    if (d.shape === 'snake') { for (let k = 0; k < 6; k++) m.box(Ln * 0.45 - k * Ln * 0.18, Math.sin(p + k) * 1.5, 0, Ln * 0.2, Wd, 1.4, k % 2 ? c : c2); m.pop(); return; }
    if (d.shape === 'gator') { m.box(0, 0, 0, Ln * 0.7, Wd, 3, c, 0, c2); m.box(Ln * 0.42, 0, 0, Ln * 0.25, Wd * 0.6, 2.2, c); m.box(-Ln * 0.45, 0, 0, Ln * 0.3, Wd * 0.4, 1.8, c); m.pop(); return; }
    if (d.shape === 'bird') {
      m.box(0, 0, 2.5, Ln * 0.8, Wd * 0.8, Wd * 0.8, c); m.box(Ln * 0.45, 0, 4 + Wd * 0.4, 2, 2, 2.4, c); m.box(Ln * 0.6, 0, 4.6 + Wd * 0.4, 1.2, 0.8, 0.8, '#d8a030');
      m.box(Ln * 0.5, 0, 6.4 + Wd * 0.4, 1, 0.6, 1, c2); m.box(-Ln * 0.4, 0, 3, 1.5, Wd * 0.7, 3, sh(c, -0.15));
      m.box(0, -1, 0, 0.6, 0.6, 2.5, '#d8a030'); m.box(0, 1, 0, 0.6, 0.6, 2.5, '#d8a030');
      m.pop(); return;
    }
    if (d.shape === 'small') {
      const hop = Math.abs(Math.sin(p)) * 2 * mv;
      m.box(0, 0, 0.8 + hop, Ln * 0.9, Wd, Wd * 0.9, c); m.box(Ln * 0.45, 0, 1.5 + hop, 2, 2, 2, c); m.box(Ln * 0.4, -0.6, 3.5 + hop, 0.6, 0.6, 2.8, c); m.box(Ln * 0.4, 0.6, 3.5 + hop, 0.6, 0.6, 2.8, c);
      m.box(-Ln * 0.48, 0, 1.6 + hop, 1.2, 1.2, 1.2, c2);
      m.pop(); return;
    }
    const lh = Math.max(3, Ln * 0.42), bh = Wd * 0.95, bl = Ln * 0.82;
    for (const [lx, ly, ph] of [[bl * 0.36, -Wd * 0.3, 0], [bl * 0.36, Wd * 0.3, Math.PI], [-bl * 0.36, -Wd * 0.3, Math.PI * 0.6], [-bl * 0.36, Wd * 0.3, Math.PI * 1.6]]) {
      m.push().tr(lx, ly, lh).ry(Math.sin(p + ph) * 0.5 * mv).box(0, 0, -lh, Math.max(1.2, Wd * 0.25), Math.max(1.2, Wd * 0.22), lh, sh(c, -0.25)).pop();
    }
    m.box(0, 0, lh, bl, Wd, bh, c, 0, sh(c, 0.06));
    m.box(0, 0, lh - 0.2, bl * 0.8, Wd * 0.8, 0.6, c2);
    if (d.hump) m.box(bl * 0.2, 0, lh + bh, bl * 0.4, Wd * 0.8, bh * 0.4, sh(c, -0.1));
    const hz = lh + bh * 0.75, hl = Math.max(2.5, Ln * 0.22);
    m.box(bl * 0.5 + hl * 0.3, 0, hz, hl, Math.max(2, Wd * 0.55), Math.max(2, bh * 0.6), c);
    m.box(bl * 0.5 + hl * 0.9, 0, hz, hl * 0.5, Math.max(1.6, Wd * 0.4), Math.max(1.4, bh * 0.4), sh(c, -0.1));
    if (d.antler) for (const s of [-1, 1]) m.push().tr(bl * 0.5 + hl * 0.2, s * 1.2, hz + bh * 0.6).rx(s * 0.5).box(0, 0, 0, 0.8, 0.8, 4 + d.antler * 2, '#d8c8a8').box(0, 0, 3 + d.antler, 2.6, 0.8, 0.8, '#d8c8a8').pop();
    if (d.tail || d.bear !== 1) m.push().tr(-bl * 0.5, 0, lh + bh * 0.7).ry(-0.8).box(0, 0, 0, 1.2, 1.2, d.tail ? Ln * 0.4 : 2.5, c).pop();
    m.pop();
  }
  function wagon(m, w) {
    const P = G.player;
    m.push().tr(w.bx, w.by, 0).rz(w.bang);
    for (const [wx, wy] of [[-7, -6.5], [-7, 6.5], [6, -6.5], [6, 6.5]]) m.push().tr(wx, wy, 4).rx(Math.PI / 2).cyl(0, 0, -0.8, 4, 1.6, 8, '#2a1c10').pop();
    if (w.stage) {
      m.box(-0.5, 0, 6, 19, 11, 13, w.body, 0, sh(w.body, 0.2));
      m.box(-0.5, -5.6, 11, 12, 0.4, 5, '#2a2a30', 0); m.box(-0.5, 5.6, 11, 12, 0.4, 5, '#2a2a30', 0);
      m.box(-9.7, 0, 6, 0.6, 11.2, 13, '#c8a040');
      if (w.cargo) { m.box(-3, 0, 19, 9, 6, 3, '#5a3a20'); m.box(1, 0, 19, 3, 4.8, 2.4, '#6a2a1a'); }
    } else {
      m.box(-1, 0, 5, 18, 10, 5, w.body, 0, sh(w.body, -0.25));
      if (w.mine || w.hauler) (w.crates || []).forEach((g, k) => m.box(-6.5 + (k >> 1) * 3.8, (k & 1) ? 2 : -2, 10, 3.4, 3.4, 3, GOODS[g] && GOODS[g].look === 'barrel' ? '#7a5230' : GOODS[g] && GOODS[g].look === 'sack' ? '#c8b088' : '#9a6e40'));
      else { m.box(-3, 0, 10, 14, 10.6, 5, '#e8e0cc'); m.box(-3, 0, 15, 12, 7, 2.4, '#e8e0cc'); for (let k = -9; k <= 3; k += 4) m.box(k, 0, 10, 0.6, 11, 7, '#c8bca4'); }
    }
    m.pop();
    const fx = w.bx + Math.cos(w.bang) * 9, fy = w.by + Math.sin(w.bang) * 9, tx = w.x + Math.cos(w.ang) * 4, ty = w.y + Math.sin(w.ang) * 4;
    m.push().tr(fx, fy, 7).rz(Math.atan2(ty - fy, tx - fx)).box(Math.hypot(tx - fx, ty - fy) / 2, 0, 0, Math.hypot(tx - fx, ty - fy), 1.2, 1.2, '#3a2616').pop();
    const c = Math.cos(w.ang), s = Math.sin(w.ang);
    for (const k of [-1, 1]) horse(m, w.x - s * k * 4.2, w.y + c * k * 4.2, w.ang, { col: w.hc[k < 0 ? 0 : 1], mane: '#1a1410' }, { phase: (w.phase || 0) + (k > 0 ? 1.5 : 0), mv: w.mv });
    const st = w.seat;
    if (st) {
      if (w.rider === P && !P.mountAnim) human(m, st.x, st.y, 9, P.aiming || P.rsAim ? P.ang : w.bang, P.lookNow(), { riding: true, aim: P.aiming, wk: P.aimKind() });
      else if (w.driver) human(m, st.x, st.y, 9, w.bang, w.driver.look, { riding: true });
    }
  }
  function trainCar(m, x, y, a, kind) {
    m.push().tr(x, y, 0).rz(a);
    for (const wx of [-8, 8]) m.box(wx, 0, 0, 5, 11, 4, '#141212');
    if (kind === 'loco') {
      m.box(-0.5, 0, 4, 29, 11, 3, '#1e1c1c');
      m.push().tr(4, 0, 12).ry(Math.PI / 2).cyl(0, 0, -10, 5, 20, 10, '#2e2a2a').pop();
      m.box(-9.5, 0, 6, 10, 13, 16, '#6a1a14', 0, '#2a2020');
      m.box(10, 0, 16, 3.4, 3.4, 9, '#141212'); m.box(10, 0, 25, 5, 5, 1.6, '#141212');
      m.box(15, 0, 9, 1.2, 4, 3, '#f0e0a0', F_WIN); m.box(17, 0, 3, 3, 11, 3, '#b0302a');
    } else if (kind === 'tender') { m.box(0, 0, 4, 24, 12, 11, '#2a2424', 0, '#141010'); }
    else {
      const fr = kind === 'freight', cc = fr ? '#6a3a24' : '#3a4a3a';
      m.box(0, 0, 4, 26, 12, 16, cc, 0, sh(cc, 0.15));
      if (!fr) for (let k = 0; k < 4; k++) { m.box(-9 + k * 6, -6.1, 12, 3, 0.4, 4, '#e8d890', F_WIN); m.box(-9 + k * 6, 6.1, 12, 3, 0.4, 4, '#e8d890', F_WIN); }
    }
    m.pop();
  }
  /* görünen canlıların modelleri (her kare); modelsizler 2D zemin katmanına */
  function buildDyn(G, x0, y0, x1, y1, flat) {
    const m = dyn.reset(), P = G.player;
    const inV = (e, mg = 60) => e.x > x0 - mg && e.x < x1 + mg && e.y > y0 - mg && e.y < y1 + mg + 40;
    for (const e of G.ents) {
      if (!inV(e) || e === P) continue;
      if (e.rider === P && e.kind === 'horse') continue;
      if (e.kind === 'npc') npc(m, e);
      else if (e.kind === 'horse') horse(m, e.x, e.y, e.ang, e.look, { phase: e.phase, mv: e.mv, saddle: e.saddle, dead: e.dead, graze: e.graze && !e.rider, bags: e.owner === 'player' });
      else if (e.kind === 'animal') { if (!e.hide) animal(m, e); }
      else if (e.kind === 'wagon') wagon(m, e);
      else flat.push(e);
    }
    // oyuncu ve atı
    if (P.riding && P.riding.kind === 'horse') {
      const h = P.riding;
      horse(m, h.x, h.y, h.ang, h.look, { phase: h.phase, mv: h.mv, saddle: true, bags: h.owner === 'player' });
      if (!P.mountAnim) human(m, P.x - Math.cos(h.ang) * 1, P.y - Math.sin(h.ang) * 1, 9, P.ang, P.lookNow(), { riding: true, aim: P.aiming, wk: P.aimKind() });
    }
    if (P.mountAnim) {
      const A = P.mountAnim, k = Math.min(1, A.t / A.dur), hop = Math.sin(k * Math.PI) * (A.on ? 6 : 5);
      human(m, P.x, P.y, hop + (A.on ? k * 9 : (1 - k) * 9), P.ang, P.lookNow(), (A.on ? k > 0.7 : k < 0.3) ? { riding: true } : { walk: P.phase, mv: 0.5 });
    } else if (!P.riding) {
      human(m, P.x, P.y, 0, P.ang, P.lookNow(), {
        walk: P.phase, mv: Math.min(1, P.mv), aim: P.aiming || P.swing > 0.2, wk: P.aimKind(), crouch: P.crouch, swing: P.swing, head: P.idleA || 0, hatK: P.hatK || 0,
        hasGun: P.weapons.has('cattleman') || P.weapons.has('schofield'), backGun: P.weapons.has('repeater') || P.weapons.has('winchester') || P.weapons.has('rifle') || P.weapons.has('shotgun'),
      });
      if (P.carry) m.push().tr(P.x, P.y, 21).rz(P.ang).box(-0.5, 0, 0, 5, 12, 4, P.carry.kind === 'pelt' ? (P.carry.col || '#8a6a40') : P.carry.kind === 'npc' ? (P.carry.look ? P.carry.look.coat : '#5a4a3a') : '#7a5a3a').pop();
    }
    for (const tr of G.trains) for (let i = 0; i < tr.pos.length; i++) { const [x, y, a] = tr.pos[i]; if (x > x0 - 60 && x < x1 + 60 && y > y0 - 60 && y < y1 + 100) trainCar(m, x, y, a, tr.cars[i]); }
    for (const ev of G.events) if (ev.wagon && dist2(ev.wagon.x, ev.wagon.y, P.x, P.y) < 800 * 800) object(m, O.WAGON, ev.wagon.x - 6, ev.wagon.y, 0.9, G.world, ev.wagon.x >> 4, ev.wagon.y >> 4);
    return m;
  }
  function npc(m, e) {
    if (e.mounted && !e.dead) {
      horse(m, e.x, e.y, e.hAng === undefined ? e.ang : e.hAng, e.mounted, { phase: e.phase, mv: e.mv, saddle: true });
      human(m, e.x, e.y, 9, e.ang, e.look, { riding: true, aim: e.hostile && e.aggro !== false, wk: e.weapon ? WEAPONS[e.weapon].kind : null });
      return;
    }
    const sc = e.child ? 0.7 : 1;
    if (e.state === 'hurt' && !e.dead) { human(m, e.x, e.y, 0, e.ang, e.look, { dead: true, noPool: true }, sc); return; }
    if (e.bound) { human(m, e.x, e.y, 0, e.ang, e.look, { lying: true, tied: e.state === 'tied' }, sc); return; }
    human(m, e.x, e.y, 0, e.ang, e.look, {
      walk: e.phase, mv: Math.min(1, e.mv), dead: e.dead, noPool: e.inWater, pool: e.dead ? Math.min(1, (e.deadT || 0) / 6) : 0,
      crouch: e.state === 'cower' || e.state === 'sit' || e.state === 'sleep' || e.held,
      aim: (e.hostile && (e.aggro || e.isLaw) && !!e.weapon) || e.state === 'robbing', wk: e.weapon ? WEAPONS[e.weapon].kind : (e.state === 'fightFist' ? 'fists' : null),
      swing: e.swing > 0 ? e.swing : 0, hasGun: !!e.weapon, hold: e.state === 'flee' || e.state === 'report' ? null : e.carry2,
      head: e.lookAt != null && !e.dead ? clamp(angDiff(e.ang, e.lookAt), -1.2, 1.2) : 0,
    }, sc);
  }

  /* ---------------- ışık ---------------- */
  function sunState(G) {
    const h = G.hour, dl = clamp(G.daylight, 0, 1), env = G.envCache || {}, cloud = (G.weather && G.weather.cloud) || env.cloud || 0;
    const day = h > 5.6 && h < 18.6;
    // 2D'deki gibi gölgeler güneye (ekranda aşağı) düşer; sabah batıya, akşam doğuya uzar
    const sa = (h - 12) / 12 * Math.PI, e = day ? 0.3 + 0.8 * Math.sin(clamp((h - 5.6) / 13, 0, 1) * Math.PI) : 1.0;
    const hz = Math.cos(e);
    const dir = nrm(day ? [-Math.sin(sa) * hz, 0.7 * hz, Math.sin(e)] : [0.35, 0.45, 0.8]);
    const low = day ? clamp(1 - (e - 0.3) / 0.5, 0, 1) : 0;
    const k = (1 - cloud * 0.6);
    const sunC = day ? [0.55 * dl * k, (0.52 - 0.1 * low) * dl * k, (0.46 - 0.2 * low) * dl * k] : [0.07 * (1 - dl), 0.09 * (1 - dl), 0.16 * (1 - dl)];
    const amb = [lerp(0.09, 0.6, dl) + cloud * 0.06 * dl, lerp(0.11, 0.62, dl) + cloud * 0.06 * dl, lerp(0.21, 0.66, dl) + cloud * 0.06 * dl];
    return { dir, sunC, amb, dark: (1 - dl) * 0.84 + cloud * 0.08 * dl };
  }
  const LCOL = { lamp: [1.0, 0.74, 0.42], window: [1.0, 0.8, 0.5], inner: [1.0, 0.86, 0.64], fire: [1.0, 0.6, 0.28], beacon: [1.0, 0.92, 0.6], flash: [1.0, 0.9, 0.6], lantern: [1.0, 0.82, 0.52], train: [1.0, 0.95, 0.8], player: [0.7, 0.75, 0.9] };
  function lights(G, x0, y0, vw, vh, fires, dark) {
    const out = [], W = G.world, P = G.player, night = dark > 0.35;
    const inView = (x, y, r) => x + r > x0 && x - r < x0 + vw && y + r > y0 - 40 && y - r < y0 + vh + 60;
    const nk = clamp(dark * 1.4, 0, 1);
    const add = (x, y, z, r, type, k) => { if (k > 0.01 && inView(x, y, r)) out.push({ x, y, z, r, c: LCOL[type], k }); };
    for (const L of W.lights) {
      if (L.type === 'window') { if (night && Juice.windowLit(L)) add(L.x, L.y + 14, 16, L.r * 1.5, 'window', 1.15 * nk); }
      else if (L.type === 'lamp') { if (night) add(L.x, L.y + 6, 27, 66 * Juice.flicker(L.x + L.y, G.t * 0.6, 0.035), 'lamp', 1.2 * nk); }
      else if (L.type === 'inner') { if (G.insideB && G.insideB.id === L.b) add(L.x, L.y, 30, L.r * 1.3, 'inner', 0.55 + 0.5 * nk); }
      else if (L.type === 'fire') add(L.x, L.y, 8, L.r * 1.1 * Juice.flicker(L.x, G.t, 0.08), 'fire', 0.5 + nk);
      else if (L.type === 'beacon') { if (night) add(L.x, L.y, 76, L.r, 'beacon', nk); }
    }
    for (const [x, y] of fires) add(x, y, 8, 84 * Juice.flicker(x * 0.37 + y, G.t, 0.07), 'fire', 0.5 + nk);
    if (G.camp) add(G.camp.x, G.camp.y, 8, 94 * Juice.flicker(3.1, G.t, 0.07), 'fire', 0.5 + nk);
    for (const f of Juice.flashes) add(f.x, f.y, 14, 80, 'flash', Math.min(1.6, f.t * 14));
    if (G.nomads) for (const c of G.nomads) if (c.spawned) add(c.x, c.y, 8, 100, 'fire', 0.5 + nk);
    if (P.lantern && P.has('lantern')) add(P.x + Math.cos(P.ang) * 6, P.y + Math.sin(P.ang) * 6, 16, 110, 'lantern', 1.1);
    else if (night) add(P.x, P.y, 20, 34, 'player', 0.35 * nk);
    if (G.fx.muzzle > 0) add(P.x + Math.cos(P.aimAng || P.ang) * 10, P.y + Math.sin(P.aimAng || P.ang) * 10, 14, 90, 'flash', Math.min(1.6, G.fx.muzzle * 14));
    for (const tr of G.trains) if (tr.pos[0] && night) { const [x, y, a] = tr.pos[0]; add(x + Math.cos(a) * 40, y + Math.sin(a) * 40, 10, 80, 'train', 0.9); }
    const cx = x0 + vw / 2, cy = y0 + vh / 2;
    out.sort((a, b) => dist2(a.x, a.y, cx, cy) - dist2(b.x, b.y, cx, cy));
    return out.slice(0, NL);
  }

  /* ---------------- çizim ---------------- */
  function attribs() {
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, VN * 4, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, VN * 4, 12);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 3, gl.FLOAT, false, VN * 4, 24);
    gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 3, gl.FLOAT, false, VN * 4, 36);
  }
  function drawBuf(buf, n) { if (!n) return; gl.bindBuffer(gl.ARRAY_BUFFER, buf); attribs(); gl.drawArrays(gl.TRIANGLES, 0, n); stat.tris += n / 3; }

  function render(G, dt) {
    if (!init()) return false;
    const t0 = performance.now();
    const W = G.world, P = G.player, C = G.cam, vw = G.vw, vh = G.vh, x0 = C.ox, y0 = C.oy, x1 = x0 + vw, y1 = y0 + vh;
    if (world !== W) { flush(); world = W; }
    if (G._r3dFxq !== G.settings.fxq || G._r3dSeason !== W.season) { if (G._r3dSeason !== undefined) flush(); G._r3dFxq = G.settings.fxq; G._r3dSeason = W.season; }
    sizeTo(vw, vh);
    stat.tris = 0;
    const ctx = G.ctx, low = G.settings.fxq === 1;
    FX.beginFrame();

    /* --- 1) zemin katmanı (2D): izler, köpük, otlar, yerdeki eşyalar --- */
    const oc = octx, fires = [], flat = [];
    oc.clearRect(0, 0, vw, vh);
    oc.save(); oc.translate(-x0, -y0);
    FX.drawGround(oc);
    Juice.drawGround(oc, x0, y0, x1, y1);
    const tx0 = Math.max(0, (x0 >> 4) - 1), ty0 = Math.max(0, (y0 >> 4) - 1), tx1 = Math.min(WW - 1, (x1 >> 4) + 1), ty1 = Math.min(WH - 1, (y1 >> 4) + 3);
    const tile = W.tile, obj = W.obj, flags = W.flags, day = G.day, t = G.t, fxFull = FX.full;
    for (let ty = ty0; ty <= ty1; ty++) {
      const row = ty * WW;
      for (let tx = tx0; tx <= tx1; tx++) {
        if (tile[row + tx] === T.WATER) { FX.foam(oc, tx, ty, t); if (fxFull) Juice.water(oc, tx, ty, t); }
        const o = obj[row + tx];
        if (!o) continue;
        if (o >= 20 && o <= 28) {
          if (W.season === 3 && W.snowyTile(tx, ty)) continue;
          const hv = W.harvested.get(row + tx);
          if (hv !== undefined && hv > day) continue;
          Spr.herb(oc, o, tx * TS + 8, ty * TS + 10, t, dist2(tx * TS + 8, ty * TS + 8, P.x, P.y) < 60 * 60);
        } else if (o === O.ARTIFACT) { if (W.harvested.get(row + tx) === undefined) Spr.sparkle(oc, tx * TS + 8, ty * TS + 8, t + tx); }
        else if (o === O.CAMPFIRE) { fires.push([tx * TS + 8, ty * TS + 8]); if (Math.random() < 0.1) G.parts.add('ember', tx * TS + 8, ty * TS + 4, 0, -10, 1, 1); FX.fireSource(tx * TS + 8, ty * TS + 8); }
        else if (o === O.STEAM) { if (Math.random() < 0.3) G.parts.add('steam', tx * TS + rnd(-40, 56), ty * TS + rnd(-40, 56), rnd(-4, 4), -6, 2.5, 3); }
      }
    }
    for (const L of G.lostItems) Spr.sparkle(oc, L.x, L.y, t * 1.3);
    if (G.treasure && P.has('treasure_map') && dist2(G.treasure.x, G.treasure.y, P.x, P.y) < 120 * 120) { oc.fillStyle = 'rgba(90,60,30,0.6)'; oc.beginPath(); oc.ellipse(G.treasure.x, G.treasure.y, 6, 4, 0, 0, TAU); oc.fill(); }
    const m = buildDyn(G, x0, y0, x1, y1, flat);
    for (const e of flat) e.draw(oc);
    oc.restore();
    gl.bindTexture(gl.TEXTURE_2D, ovTex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, ov);
    const t1 = performance.now(); seg('zemin2d+modeller', t1 - t0);

    /* --- 2) görünen chunk'lar ve binalar --- */
    const SM = 280;   // gölge düşürenler için kenar payı
    const cx0 = Math.floor((x0 - SM) / CPX), cy0 = Math.floor((y0 - SM) / CPX), cx1 = Math.floor((x1 + SM) / CPX), cy1 = Math.floor((y1 + SM) / CPX), NC = WW / CHUNK;
    const vis = [], near = [];
    for (let cy = Math.max(0, cy0); cy <= Math.min(NC - 1, cy1); cy++) for (let cx = Math.max(0, cx0); cx <= Math.min(NC - 1, cx1); cx++) {
      const inView = cx * CPX < x1 + 64 && (cx + 1) * CPX > x0 - 64 && cy * CPX < y1 + 160 && (cy + 1) * CPX > y0 - 64;
      const c = chunk(cx, cy, inView);
      if (c) (inView ? vis : near).push(c);
      else near.push(null);
    }
    // ileride lazım olacak bir chunk'ı arka planda hazırla (kare başına en çok bir tane)
    if (performance.now() - t0 < 8) for (let cy = Math.max(0, cy0); cy <= Math.min(NC - 1, cy1); cy++) { let done = false; for (let cx = Math.max(0, cx0); cx <= Math.min(NC - 1, cx1); cx++) if (!chunks.has(cy * 64 + cx)) { chunk(cx, cy, true); done = true; break; } if (done) break; }
    const blds = [];
    for (const b of W.buildings) {
      const bx = b.x * TS, by = b.y * TS;
      if (bx + b.w * TS + SM < x0 || bx - SM > x1 || by + b.h * TS + SM < y0 || by - SM > y1 + 120) continue;
      blds.push(b);
    }
    for (const b of blds) buildingMesh(b);
    stat.chunks = vis.length;

    /* --- 3) güneş/ay gölgesi --- */
    const S = sunState(G);
    const want = low ? 1024 : 2048;
    if (shSize !== want) { shT = target(want, want, shT); shSize = shT ? want : 0; }
    const ctr = [x0 + vw / 2, y0 + vh / 2, 0];
    const LV = M4.look([ctr[0] + S.dir[0] * 1500, ctr[1] + S.dir[1] * 1500, S.dir[2] * 1500], ctr, Math.abs(S.dir[2]) > 0.99 ? [0, -1, 0] : [0, 0, 1]);
    let lx0 = Infinity, lx1 = -Infinity, ly0 = Infinity, ly1 = -Infinity, lz0 = Infinity, lz1 = -Infinity;
    for (const X of [x0 - 40, x1 + 40]) for (const Y of [y0 - 40, y1 + 120]) for (const Z of [0, 60]) { const q = M4.pt(LV, [X, Y, Z]); lx0 = Math.min(lx0, q[0]); lx1 = Math.max(lx1, q[0]); ly0 = Math.min(ly0, q[1]); ly1 = Math.max(ly1, q[1]); }
    for (const X of [x0 - SM, x1 + SM]) for (const Y of [y0 - SM, y1 + SM]) for (const Z of [0, 160]) { const q = M4.pt(LV, [X, Y, Z]); lz0 = Math.min(lz0, q[2]); lz1 = Math.max(lz1, q[2]); }
    const LVP = M4.mul(M4.ortho(lx0, lx1, ly0, ly1, -lz1 - 10, -lz0 + 10), LV);
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LESS); gl.disable(gl.BLEND); gl.disable(gl.CULL_FACE);
    if (dyn.n) { gl.bindBuffer(gl.ARRAY_BUFFER, dynBuf); gl.bufferData(gl.ARRAY_BUFFER, dyn.a.subarray(0, dyn.n * VN), gl.DYNAMIC_DRAW); }
    const wind = low ? 0 : 1 + (FX.wind ? Math.min(2, Math.abs(FX.wind.x || 0) * 0.05) : 0);
    if (shT) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, shT.fb); gl.viewport(0, 0, shSize, shSize);
      gl.clearColor(1, 1, 1, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.useProgram(DP.p); gl.uniformMatrix4fv(DP.u.uLVP, false, LVP); gl.uniform1f(DP.u.uT, t); gl.uniform1f(DP.u.uWind, wind); gl.uniform1f(DP.u.uCut, 0);
      for (const c of vis.concat(near)) if (c && c.buf) drawBuf(c.buf, c.n);
      for (const b of blds) drawBuf(b._r3.buf, b._r3.n);   // içeride de çatı gölge düşürür: oda loş kalır
      if (dyn.n) drawBuf(dynBuf, dyn.n);
    }

    /* --- 4) duvar yükseklik haritası (nokta ışıklar için) --- */
    const hx = x0 - 140, hy = y0 - 140, hw = vw + 280, hh = vh + 320;
    const hmw = Math.ceil(hw * HM_RES), hmh = Math.ceil(hh * HM_RES);
    if (hmW !== hmw || hmH !== hmh) { hmT = target(hmw, hmh, hmT); hmW = hmT ? hmw : 0; hmH = hmT ? hmh : 0; }
    if (hmT) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, hmT.fb); gl.viewport(0, 0, hmW, hmH);
      gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.useProgram(HPg.p);
      gl.uniformMatrix4fv(HPg.u.uHVP, false, new Float32Array([2 / hw, 0, 0, 0, 0, 2 / hh, 0, 0, 0, 0, -2 / 256, 0, -2 * hx / hw - 1, -2 * hy / hh - 1, 1, 1]));
      gl.uniform1f(HPg.u.uCut, 0); gl.uniform1f(HPg.u.uT, t); gl.uniform1f(HPg.u.uWind, 0);
      for (const b of blds) drawBuf(b._r3.buf, b._r3.n);
    }

    /* --- 5) sahne --- */
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, vw, vh);
    gl.clearColor(0.17, 0.29, 0.37, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    const u = PRG.u; gl.useProgram(PRG.p);
    const cmin = (y0 - 600) * K - 50, cmax = (y1 + 900) * K + 700, D = cmax - cmin;
    gl.uniformMatrix4fv(u.uVP, false, new Float32Array([2 / vw, 0, 0, 0, 0, -2 / vh, -2 * K / D, 0, 0, 2 * K / vh, -2 / D, 0, -2 * x0 / vw - 1, 2 * y0 / vh + 1, 2 * cmin / D + 1, 1]));
    gl.uniformMatrix4fv(u.uLVP, false, LVP);
    gl.uniform1f(u.uShOn, shT ? 1 : 0); gl.uniform1f(u.uShT, 1 / (shSize || 1));
    gl.uniform1f(u.uShB, 2.2 / Math.max(1, lz1 - lz0 + 20));
    gl.uniform4f(u.uHR, hx, hy, hw, hh);
    gl.uniform3fv(u.uSunD, S.dir); gl.uniform3fv(u.uSunC, S.sunC); gl.uniform3fv(u.uAmb, S.amb);
    gl.uniform2f(u.uRes, vw, vh); gl.uniform1f(u.uT, t); gl.uniform1f(u.uWind, wind); gl.uniform1f(u.uCut, 0); gl.uniform1f(u.uLv, 30);
    const Ls = lights(G, x0, y0, vw, vh, fires, S.dark), LP = new Float32Array(NL * 4), LC = new Float32Array(NL * 3);
    Ls.forEach((L, i) => { LP.set([L.x, L.y, L.z, L.r], i * 4); LC.set([L.c[0] * L.k, L.c[1] * L.k, L.c[2] * L.k], i * 3); });
    gl.uniform4fv(u.uLP, LP); gl.uniform3fv(u.uLC, LC);
    stat.lights = Ls.length;
    // görüş deliği: oyuncunun önünü kapatan duvar/ağaç noktalı delinir
    const pz = P.riding ? 26 : 14;
    gl.uniform3f(u.uSee, P.x - x0, vh - (P.y - pz * K - y0), G.insideB ? 0 : 30); gl.uniform1f(u.uSeeD, P.y * K + pz);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, ovTex); gl.uniform1i(u.uOv, 1);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, shT ? shT.tex : blankTex); gl.uniform1i(u.uSh, 2);
    gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, hmT ? hmT.tex : blankTex); gl.uniform1i(u.uHM, 3);
    gl.uniform1i(u.uTex, 0);
    // pencereler gece yanar
    const winC = S.dark > 0.35 ? clamp((S.dark - 0.35) * 2.5, 0, 1) : 0;
    // zemin
    gl.uniform1f(u.uGround, 1); gl.uniform3f(u.uWinC, 0, 0, 0);
    gl.activeTexture(gl.TEXTURE0);
    for (const c of vis) { gl.bindTexture(gl.TEXTURE_2D, c.tex); drawBuf(c.quad, 6); }
    gl.uniform1f(u.uGround, 0);
    gl.bindTexture(gl.TEXTURE_2D, atlasTex);
    gl.uniform3f(u.uWinC, 0.95 * winC, 0.7 * winC, 0.36 * winC);
    for (const c of vis) if (c.buf) drawBuf(c.buf, c.n);
    for (const b of blds) {
      const lit = winC > 0 && (!b._r3.win || Juice.windowLit(b._r3.win));
      gl.uniform3f(u.uWinC, lit ? 0.95 * winC : 0, lit ? 0.7 * winC : 0, lit ? 0.36 * winC : 0);
      gl.uniform1f(u.uCut, b === G.insideB ? 12 : 0);
      drawBuf(b._r3.buf, b._r3.n);
    }
    gl.uniform1f(u.uCut, 0);
    gl.uniform3f(u.uWinC, 0.95 * winC, 0.75 * winC, 0.45 * winC);
    gl.uniform3f(u.uSee, 0, 0, 0);
    if (dyn.n) drawBuf(dynBuf, dyn.n);

    /* --- 6) 2D tuvale aktar, üst katmanlar 2D --- */
    const t2 = performance.now(); seg('gl komutları (CPU)', t2 - t1);
    ctx.drawImage(cv, 0, 0);
    const t3 = performance.now(); seg('GPU bekleme', t3 - t2);
    // ışık kaynaklarında hafif parlama (fener başı, ateş, pencere)
    if (S.dark > 0.2) {
      ctx.globalCompositeOperation = 'lighter';
      for (const L of Ls) {
        if (L.c === LCOL.player || L.c === LCOL.inner) continue;
        const r = L.c === LCOL.window ? 10 : L.c === LCOL.fire ? 22 : 14, sx = L.x - x0, sy = L.y - (L.c === LCOL.window ? 12 : L.z) * K - y0;
        ctx.globalAlpha = Math.min(0.75, L.k * 0.5 * Math.min(1, S.dark * 1.4));
        ctx.drawImage(G.glowSpr, sx - r, sy - r, r * 2, r * 2);
      }
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    }
    ctx.save(); ctx.translate(-x0, -y0);
    for (const [x, y] of fires) Spr.fire(ctx, x, y, t);
    G.drawTumbles(ctx);
    G.drawProjs(ctx);
    G.parts.draw(ctx, x0, y0, x1, y1);
    ctx.restore();
    G.renderTail(ctx, dt, x0, y0, x1, y1, fires, false);
    seg('2D üst katman', performance.now() - t3);
    stat.frames++; stat.ms = stat.ms * 0.95 + (performance.now() - t0) * 0.05;
    const ge = gl.getError(); if (ge) stat.err = 'gl ' + ge;
    return true;
  }

  return {
    render, flush, stat,
    available() { return init(); },
    get canvas() { return cv; },
  };
})();
