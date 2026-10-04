'use strict';
/* ==========================================================
   FRONTIER'S END — sinematik çizici (açılışlar: opencine.js, hikâye: storycine.js)
   Kütüphanesiz küçük bir WebGL çizici: düz gölgeli alçak poligon sahneler,
   iki kademeli güneş gölgesi (gölge haritası), ateş/fener nokta ışıkları ve
   dalgalı, gökyüzünü yansıtan su.
   Sahne önce ara tampona çizilir, sonra ikinci geçişte parlama, güneş
   huzmeleri, sahneye özel renk tonu, vinyet ve film greni eklenir; en sonda
   renk kademesi + Bayer dither ile oyunun piksel sanat görünümü korunur.
   Her sahne birden çok çekimden (shots) oluşur; oyun içi sinematikler de
   Cinema.play(sahne, { look, seed }) ile aynı oynatıcıyı kullanabilir.
   ========================================================== */

const Cinema = (() => {
  const RW = 640, RH = 360;

  /* ---------------- mat4 (sütun öncelikli) ---------------- */
  const M4 = {
    id: () => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]),
    mul(a, b) {
      const r = new Float32Array(16);
      for (let c = 0; c < 4; c++) for (let rr = 0; rr < 4; rr++) {
        let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + rr] * b[c * 4 + k];
        r[c * 4 + rr] = s;
      }
      return r;
    },
    persp(fov, asp, n, f) { const t = 1 / Math.tan(fov / 2); return new Float32Array([t / asp, 0, 0, 0, 0, t, 0, 0, 0, 0, (f + n) / (n - f), -1, 0, 0, 2 * f * n / (n - f), 0]); },
    look(e, c, up = [0, 1, 0]) {
      let f = V.norm(V.sub(c, e)), s = V.norm(V.cross(f, up)), u = V.cross(s, f);
      return new Float32Array([s[0], u[0], -f[0], 0, s[1], u[1], -f[1], 0, s[2], u[2], -f[2], 0, -V.dot(s, e), -V.dot(u, e), V.dot(f, e), 1]);
    },
    ortho(l, r, b, t, n, f) { return new Float32Array([2 / (r - l), 0, 0, 0, 0, 2 / (t - b), 0, 0, 0, 0, -2 / (f - n), 0, -(r + l) / (r - l), -(t + b) / (t - b), -(f + n) / (f - n), 1]); },
    tr: (x, y, z) => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1]),
    ry: (a) => { const c = Math.cos(a), s = Math.sin(a); return new Float32Array([c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]); },
    rx: (a) => { const c = Math.cos(a), s = Math.sin(a); return new Float32Array([1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1]); },
    rz: (a) => { const c = Math.cos(a), s = Math.sin(a); return new Float32Array([c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]); },
    chain(...ms) { return ms.reduce((a, b) => M4.mul(a, b)); },
    pt(m, p) { return [m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]]; },
    dir(m, p) { return V.norm([m[0] * p[0] + m[4] * p[1] + m[8] * p[2], m[1] * p[0] + m[5] * p[1] + m[9] * p[2], m[2] * p[0] + m[6] * p[1] + m[10] * p[2]]); },
  };
  const V = {
    sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
    add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
    dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
    cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
    norm: (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
    lerp: (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t],
  };
  const C = (h) => { const [r, g, b] = hexToRgb(h); return [r / 255, g / 255, b / 255]; };
  const ease = (t) => t * t * (3 - 2 * t);
  const DUR = 7.8;                 // varış sinematiklerinin toplam süresi
  const cl01 = (v) => Math.max(0, Math.min(1, v));
  /* Kasaba alanında zemini düzleştiren ağırlık (0 = düz) */
  const flatW = (x, z, x0, x1, z0, z1, fall = 30) => { const dx = Math.max(x0 - x, 0, x - x1), dz = Math.max(z0 - z, 0, z - z1); return Math.min(1, Math.hypot(dx, dz) / fall); };

  /* ---------------- Mesh: aydınlatma kuruluşta vertex rengine işlenir ----------------
     Köşe başına 15 sayı: konum, aydınlık renk, bu rengin güneşten gelen payı (gölgede
     düşülür), ham renk ve normal (ateş/fener ışığı için). Işıktan etkilenmeyen parlak
     ağlarda (dif = 0) normal sıfırdır: gölge de nokta ışık da onlara işlemez. */
  const VSZ = 15;
  class Mesh {
    constructor(L) { this.v = []; this.L = L; this.T = null; this.emit = !L.dif && L.amb >= 1; }
    shade(n, col) {
      const L = this.L, d = Math.max(0, V.dot(n, L.dir)), up = n[1] * 0.06;
      return [0, 1, 2].map(i => Math.min(1.2, col[i] * (L.ambC[i] * L.amb + L.sunC[i] * L.dif * d + up)));
    }
    face(pts, n, col) {
      if (typeof col === 'string') col = C(col);
      if (this.T) { pts = pts.map(p => M4.pt(this.T, p)); n = M4.dir(this.T, n); }
      const L = this.L, d = Math.max(0, V.dot(n, L.dir)), up = n[1] * 0.06, c = [], s = [];
      for (let i = 0; i < 3; i++) { const a = col[i] * (L.ambC[i] * L.amb + up), lit = Math.min(1.2, a + col[i] * L.sunC[i] * L.dif * d); c.push(lit); s.push(Math.max(0, lit - Math.min(1.2, Math.max(0, a)))); }
      const nn = this.emit ? [0, 0, 0] : n;
      for (let i = 1; i < pts.length - 1; i++) for (const p of [pts[0], pts[i], pts[i + 1]]) this.v.push(p[0], p[1], p[2], c[0], c[1], c[2], s[0], s[1], s[2], col[0], col[1], col[2], nn[0], nn[1], nn[2]);
    }
    tri(a, b, c, col, up) {
      let n = V.norm(V.cross(V.sub(b, a), V.sub(c, a)));
      if (up && n[1] < 0) n = [-n[0], -n[1], -n[2]];
      this.face([a, b, c], n, col);
    }
    at(x, y, z, ry, fn) { const old = this.T; const m = M4.chain(M4.tr(x, y, z), M4.ry(ry || 0)); this.T = old ? M4.mul(old, m) : m; fn(); this.T = old; }
    box(x, y, z, w, h, d, col, top) {
      const x0 = x - w / 2, x1 = x + w / 2, y0 = y, y1 = y + h, z0 = z - d / 2, z1 = z + d / 2;
      this.face([[x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0]], [0, 1, 0], top || col);
      this.face([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], [0, 0, 1], col);
      this.face([[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]], [0, 0, -1], col);
      this.face([[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]], [1, 0, 0], col);
      this.face([[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], [-1, 0, 0], col);
      this.face([[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], [0, -1, 0], col);
    }
    /* Beşik çatı: mahya z ekseni boyunca */
    roof(x, y, z, w, h, d, col, o = 0.4) {
      const x0 = x - w / 2 - o, x1 = x + w / 2 + o, z0 = z - d / 2 - o, z1 = z + d / 2 + o, yt = y + h;
      const nl = V.norm([-h, w / 2, 0]), nr = V.norm([h, w / 2, 0]);
      this.face([[x0, y, z1], [x, yt, z1], [x, yt, z0], [x0, y, z0]], nl, col);
      this.face([[x, yt, z1], [x1, y, z1], [x1, y, z0], [x, yt, z0]], nr, col);
      const g = typeof col === 'string' ? shadeHex(col, -0.25) : col;
      this.face([[x0, y, z1], [x1, y, z1], [x, yt, z1]], [0, 0, 1], g);
      this.face([[x1, y, z0], [x0, y, z0], [x, yt, z0]], [0, 0, -1], g);
    }
    /* Silindir: eksen 'y' (dikey) ya da 'x' / 'z' */
    cyl(x, y, z, r, h, n, col, axis = 'y', cap) {
      const P = (a, t) => { const c = Math.cos(a) * r, s = Math.sin(a) * r; return axis === 'y' ? [x + c, y + t, z + s] : axis === 'x' ? [x + t, y + c, z + s] : [x + c, y + s, z + t]; };
      const N = (a) => { const c = Math.cos(a), s = Math.sin(a); return axis === 'y' ? [c, 0, s] : axis === 'x' ? [0, c, s] : [c, s, 0]; };
      for (let i = 0; i < n; i++) {
        const a0 = i / n * TAU, a1 = (i + 1) / n * TAU, am = (a0 + a1) / 2;
        this.face([P(a0, 0), P(a1, 0), P(a1, h), P(a0, h)], N(am), col);
        if (cap !== false) {
          const c0 = axis === 'y' ? [x, y + h, z] : axis === 'x' ? [x + h, y, z] : [x, y, z + h];
          const c1 = axis === 'y' ? [x, y, z] : axis === 'x' ? [x, y, z] : [x, y, z];
          const an = axis === 'y' ? [0, 1, 0] : axis === 'x' ? [1, 0, 0] : [0, 0, 1];
          this.face([c0, P(a0, h), P(a1, h)], an, cap || col);
          this.face([c1, P(a1, 0), P(a0, 0)], an.map(v => -v), cap || col);
        }
      }
    }
    cone(x, y, z, r, h, n, col, tipCol) {
      for (let i = 0; i < n; i++) {
        const a0 = i / n * TAU, a1 = (i + 1) / n * TAU, am = (a0 + a1) / 2;
        const p0 = [x + Math.cos(a0) * r, y, z + Math.sin(a0) * r], p1 = [x + Math.cos(a1) * r, y, z + Math.sin(a1) * r], t = [x, y + h, z];
        const nn = V.norm([Math.cos(am) * h, r, Math.sin(am) * h]);
        if (tipCol) {
          const k = 0.55, q0 = V.lerp(p0, t, k), q1 = V.lerp(p1, t, k);
          this.face([p0, p1, q1, q0], nn, col); this.face([q0, q1, t], nn, tipCol);
        } else this.face([p0, p1, t], nn, col);
      }
    }
    terrain(x0, z0, x1, z1, step, hf, cf) {
      for (let z = z0; z < z1; z += step) for (let x = x0; x < x1; x += step) {
        const a = [x, hf(x, z), z], b = [x + step, hf(x + step, z), z], c = [x + step, hf(x + step, z + step), z + step], d = [x, hf(x, z + step), z + step];
        const col = cf(x + step / 2, z + step / 2);
        this.tri(a, d, c, col, true); this.tri(a, c, b, col, true);
      }
    }
    build(gl) {
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.v), gl.STATIC_DRAW);
      return { buf, n: this.v.length / VSZ, emit: this.emit };
    }
  }

  /* ---------------- Gölgelendiriciler ---------------- */
  const HP = `#ifdef GL_FRAGMENT_PRECISION_HIGH
    precision highp float;
    #else
    precision mediump float;
    #endif
    `;
  const VS = `attribute vec3 aP; attribute vec3 aC; attribute vec3 aS; attribute vec3 aA; attribute vec3 aN; uniform mat4 uVP; uniform mat4 uM; uniform vec3 uCam;
    varying vec3 vC; varying vec3 vS; varying vec3 vA; varying vec3 vN; varying vec3 vW; varying float vD;
    void main(){ vec4 w = uM * vec4(aP, 1.0); vC = aC; vS = aS; vA = aA; vec3 n = (uM * vec4(aN, 0.0)).xyz; vN = dot(n, n) > 0.01 ? normalize(n) : vec3(0.0);
      vW = w.xyz; vD = length(w.xyz - uCam); gl_Position = uVP * w; }`;
  // gölge haritası: derinlik RGBA'ya paketlenir (WebGL1'de derinlik dokusu eklentisi gerekmesin)
  const PACK = `vec4 pack(float d){ vec4 e = fract(d * vec4(1.0, 255.0, 65025.0, 16581375.0)); e -= e.yzww * vec4(1.0 / 255.0, 1.0 / 255.0, 1.0 / 255.0, 0.0); return e; }
    float unpack(vec4 c){ return dot(c, vec4(1.0, 1.0 / 255.0, 1.0 / 65025.0, 1.0 / 16581375.0)); }`;
  const DVS = `attribute vec3 aP; uniform mat4 uLVP; uniform mat4 uM; void main(){ gl_Position = uLVP * uM * vec4(aP, 1.0); }`;
  const DFS = `${HP} ${PACK} void main(){ gl_FragColor = pack(gl_FragCoord.z); }`;
  const NL = 4;   // en fazla nokta ışık (ateş, fener, pencere)
  const DITHER = `float b2(vec2 a){ a = floor(a); return fract(a.x * 0.5 + a.y * a.y * 0.75); }
    float bay(vec2 a){ return b2(0.5 * a) * 0.25 + b2(a); }
    vec3 post(vec3 c){ float d = bay(gl_FragCoord.xy); return floor(c * 26.0 + d) / 26.0; }`;
  // sahne: renkler doğrusal olarak ara tampona yazılır (kademe son geçişte)
  // sahne: güneş gölgesi (iki kademe, 3x3 süzme), nokta ışıklar, yükseklik sisi
  const FS = `${HP} ${PACK}
    varying vec3 vC; varying vec3 vS; varying vec3 vA; varying vec3 vN; varying vec3 vW; varying float vD;
    uniform vec3 uFog; uniform float uFogD; uniform float uFogH; uniform float uA;
    uniform sampler2D uSh0; uniform sampler2D uSh1; uniform mat4 uLV0; uniform mat4 uLV1; uniform vec2 uNO; uniform float uTex; uniform float uShOn; uniform float uShK;
    uniform vec4 uLP[${NL}]; uniform vec3 uLC[${NL}];
    float shd(sampler2D t, vec3 w, mat4 M){ vec4 q = M * vec4(w, 1.0); vec3 p = q.xyz * 0.5 + 0.5;
      if (p.x < 0.003 || p.y < 0.003 || p.x > 0.997 || p.y > 0.997 || p.z > 0.999) return -1.0;
      float s = 0.0; for (int i = -1; i <= 1; i++) for (int j = -1; j <= 1; j++) s += step(p.z - 0.0007, unpack(texture2D(t, p.xy + vec2(float(i), float(j)) * uTex)));
      return s / 9.0; }
    void main(){ vec3 c = vC;
      if (uShOn > 0.5 && vS.r + vS.g + vS.b > 0.003) { float s = shd(uSh0, vW + vN * uNO.x, uLV0); if (s < 0.0) s = shd(uSh1, vW + vN * uNO.y, uLV1); if (s < 0.0) s = 1.0; c -= vS * (1.0 - s) * uShK; }
      if (vN.x != 0.0 || vN.y != 0.0 || vN.z != 0.0) for (int i = 0; i < ${NL}; i++) { float r = uLP[i].w; if (r > 0.0) { vec3 d = uLP[i].xyz - vW; float dd = dot(d, d); float a = clamp(1.0 - dd / (r * r), 0.0, 1.0); a *= a;
        c += vA * uLC[i] * a * (max(dot(vN, d * inversesqrt(dd + 0.0001)), 0.0) * 0.8 + 0.2); } }
      float f = 1.0 - exp(-vD * uFogD); f *= clamp(1.0 - (vW.y - uFogH) * 0.012, 0.35, 1.0); gl_FragColor = vec4(mix(c, uFog, clamp(f, 0.0, 1.0)), uA); }`;
  // su: dalga normalleri, gökyüzü yansıması (Fresnel), güneş parıltısı, sis
  const WVS = `attribute vec3 aP; uniform mat4 uVP; varying vec3 vW; void main(){ vW = aP; gl_Position = uVP * vec4(aP, 1.0); }`;
  const WFS = `${HP} varying vec3 vW; uniform vec3 uCam; uniform float uT; uniform vec3 uSunD; uniform vec3 uSunC; uniform vec3 uSkyH; uniform vec3 uSkyT; uniform vec3 uDeep; uniform vec3 uFog; uniform float uFogD; uniform float uCalm;
    vec2 wv(vec2 p, vec2 d, float f, float a, float sp){ float ph = dot(p, d) * f + uT * sp; return d * cos(ph) * f * a; }
    void main(){ vec2 p = vW.xz; vec2 g = wv(p, vec2(0.8, 0.6), 0.35, 0.22, 1.3) + wv(p, vec2(-0.5, 0.86), 0.62, 0.12, 1.9) + wv(p, vec2(0.17, -0.98), 1.3, 0.05, 2.7) + wv(p, vec2(-0.93, -0.37), 2.4, 0.025, 3.6);
      vec3 n = normalize(vec3(-g.x * uCalm, 1.0, -g.y * uCalm)); vec3 v = normalize(uCam - vW); float fr = pow(1.0 - max(dot(n, v), 0.0), 4.0);
      vec3 r = reflect(-v, n); vec3 sky = mix(uSkyH, uSkyT, clamp(r.y * 2.2, 0.0, 1.0));
      vec3 c = mix(uDeep, sky, 0.18 + 0.8 * fr) + uSunC * pow(max(dot(r, uSunD), 0.0), 140.0) * 2.2;
      float dd = length(uCam - vW); float f = 1.0 - exp(-dd * uFogD); gl_FragColor = vec4(mix(c, uFog, clamp(f, 0.0, 1.0)), 1.0); }`;
  const SVS = `attribute vec2 aP; varying vec2 vU; void main(){ vU = aP; gl_Position = vec4(aP, 0.999, 1.0); }`;
  // gökyüzü: ufuk degradesi, güneş halesi ve kameranın yönüne bağlı akan bulutlar
  const SFS = `precision mediump float; varying vec2 vU; uniform vec3 uTop; uniform vec3 uHor; uniform float uHorY; uniform vec2 uSun; uniform vec3 uSunC; uniform float uSunR;
    uniform float uTime; uniform float uYaw; uniform float uCloud; uniform vec3 uCloudC;
    float hsh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float nse(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hsh(i), hsh(i + vec2(1.0, 0.0)), f.x), mix(hsh(i + vec2(0.0, 1.0)), hsh(i + vec2(1.0, 1.0)), f.x), f.y); }
    float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { v += a * nse(p); p *= 2.03; a *= 0.5; } return v; }
    void main(){ float h = vU.y - uHorY; float t = clamp(h / (1.0 - uHorY), 0.0, 1.0); vec3 c = mix(uHor, uTop, pow(t, 0.7));
      vec2 d = (vU - uSun) * vec2(${(RW / RH).toFixed(3)}, 1.0); float r = length(d);
      c = mix(c, uSunC, smoothstep(uSunR * 6.0, 0.0, r) * 0.45);
      if (uCloud > 0.0 && h > 0.0) {
        vec2 cp = vec2((vU.x * 0.9 + uYaw * 1.6) / (h + 0.28), 1.0 / (h + 0.1)) * 1.4 + vec2(uTime * 0.035, 0.0);
        float n = fbm(cp); float cl = smoothstep(1.0 - uCloud, 1.0 - uCloud + 0.28, n) * smoothstep(0.0, 0.1, h);
        float lit = 0.75 + 0.35 * smoothstep(0.9, 0.0, r) + (n - 0.5) * 0.4;
        c = mix(c, mix(uCloudC * lit, uSunC, smoothstep(0.35, 0.0, r) * 0.6), cl * 0.9);
      }
      if (r < uSunR) c = mix(uSunC, vec3(1.0), 0.35);
      gl_FragColor = vec4(c, 1.0); }`;
  // son geçiş: parlama, güneş huzmesi, renk tonu, vinyet, gren, piksel kademesi
  const QFS = `precision mediump float; varying vec2 vU; uniform sampler2D uT; uniform vec2 uSun; uniform float uSunVis; uniform vec3 uSunC;
    uniform vec3 uLift; uniform vec3 uGain; uniform float uSat; uniform float uCon; uniform float uTime; uniform float uFade;
    ${DITHER}
    void main(){ vec2 uv = vU * 0.5 + 0.5; vec2 px = vec2(${(1 / RW).toFixed(6)}, ${(1 / RH).toFixed(6)});
      vec3 c = texture2D(uT, uv).rgb;
      vec3 b = vec3(0.0);
      for (int i = 0; i < 8; i++) { float a = float(i) * 0.785; vec2 o = vec2(cos(a), sin(a)) * px;
        b += max(texture2D(uT, uv + o * 3.0).rgb - 0.7, 0.0) + max(texture2D(uT, uv + o * 7.0).rgb - 0.7, 0.0) * 0.7; }
      c += b * 0.12;
      if (uSunVis > 0.0) { vec2 sp = uSun * 0.5 + 0.5; vec2 st = (sp - uv) / 18.0; vec2 p = uv; float acc = 0.0, w = 1.0;
        for (int i = 0; i < 18; i++) { p += st; vec3 s = texture2D(uT, p).rgb; acc += max(dot(s, vec3(0.333)) - 0.72, 0.0) * w; w *= 0.9; }
        c += uSunC * acc * uSunVis * 0.32; }
      c = c * uGain + uLift * (1.0 - c);
      float l = dot(c, vec3(0.299, 0.587, 0.114)); c = mix(vec3(l), c, uSat); c = (c - 0.5) * uCon + 0.5;
      vec2 q = (uv - 0.5) * vec2(1.15, 1.35); c *= 1.0 - dot(q, q) * 0.85;
      float n = fract(sin(dot(gl_FragCoord.xy + fract(uTime * 7.3) * 91.0, vec2(12.9898, 78.233))) * 43758.5453); c += (n - 0.5) * 0.04;
      gl_FragColor = vec4(post(clamp(c * uFade, 0.0, 1.0)), 1.0); }`;
  const PVS = `attribute vec3 aP; attribute vec4 aC; attribute float aS; uniform mat4 uVP; varying vec4 vC;
    void main(){ vec4 p = uVP * vec4(aP, 1.0); gl_Position = p; gl_PointSize = min(aS < 0.0 ? -aS : aS * ${RH.toFixed(1)} / max(p.w, 0.3), 22.0); vC = aC; }`;
  const PFS = `precision mediump float; varying vec4 vC; ${DITHER}
    void main(){ vec2 q = gl_PointCoord - 0.5; float e = 1.0 - smoothstep(0.2, 0.5, length(q)); if (vC.a * e < bay(gl_FragCoord.xy) * 0.94 + 0.03) discard; gl_FragColor = vec4(vC.rgb, 1.0); }`;

  let gl = null, P = null, SP = null, PP = null, QP = null, DP = null, WP = null, skyBuf = null, ptBuf = null, wBuf = null, fb = null, fbTex = null, blob = null;
  let SM = 0, stat = null, playId = 0; const shadow = [];   // gölge kademeleri: [{ fb, tex }] (0: yakın, her kare; 1: uzak, sahne başına bir kez)
  function shadowTargets(size) {
    if (SM === size) return true;
    for (const s of shadow) { gl.deleteFramebuffer(s.fb); gl.deleteTexture(s.tex); }
    shadow.length = 0; SM = 0;
    for (let k = 0; k < 2; k++) {
      const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, size, size, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      for (const [a, b] of [[gl.TEXTURE_MIN_FILTER, gl.NEAREST], [gl.TEXTURE_MAG_FILTER, gl.NEAREST], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, a, b);
      const rb = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, rb); gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, size, size);
      const f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0); gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, rb);
      const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      if (!ok) { gl.deleteFramebuffer(f); gl.deleteTexture(tex); return false; }
      shadow.push({ fb: f, tex });
    }
    SM = size; return true;
  }
  function compile(vs, fs) {
    const mk = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
    const p = gl.createProgram(); gl.attachShader(p, mk(gl.VERTEX_SHADER, vs)); gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const nm = gl.getActiveUniform(p, i).name; u[nm] = gl.getUniformLocation(p, nm); }
    return { p, u, a: (nm) => gl.getAttribLocation(p, nm) };
  }
  function init(canvas) {
    gl = canvas.getContext('webgl', { antialias: false, preserveDrawingBuffer: false }) || canvas.getContext('experimental-webgl');
    if (!gl) return false;
    P = compile(VS, FS); SP = compile(SVS, SFS); PP = compile(PVS, PFS); QP = compile(SVS, QFS);
    try { DP = compile(DVS, DFS); WP = compile(WVS, WFS); } catch (e) { console.warn('Gölge/su gölgelendiricisi derlenemedi', e); DP = WP = null; }
    wBuf = gl.createBuffer();
    skyBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, skyBuf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    ptBuf = gl.createBuffer();
    // ara tampon (renk dokusu + derinlik)
    fbTex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, fbTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, RW, RH, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const rb = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, rb); gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, RW, RH);
    fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, fbTex, 0);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, rb);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) { gl.bindFramebuffer(gl.FRAMEBUFFER, null); fb = null; }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    // yumuşak zemin gölgesi: merkezi koyu, kenarı açık halkalar (yarı saydam çizilir)
    const bm = new Mesh({ dir: [0, 1, 0], amb: 1, dif: 0, ambC: [0, 0, 0], sunC: [0, 0, 0] });
    for (const r of [1, 0.75, 0.5]) for (let i = 0; i < 16; i++) { const a0 = i / 16 * TAU, a1 = (i + 1) / 16 * TAU; bm.face([[0, 0, 0], [Math.cos(a1) * r, 0, Math.sin(a1) * r], [Math.cos(a0) * r, 0, Math.sin(a0) * r]], [0, 1, 0], [0, 0, 0]); }
    blob = bm.build(gl);
    return true;
  }

  /* ---------------- Ortak sahne parçaları ---------------- */
  const BCOL = Object.values(BUILDINGS).filter(b => !b.ruin && b.wall).map(b => [b.wall, b.roof]);
  function building(m, R, w, d, h, style) {
    const [wall, roofC] = R.pick(BCOL);
    m.box(0, 0, 0, w, h, d, wall);
    if (style === 'gable') m.roof(0, h, 0, w, 1.8, d, roofC);
    else {
      m.box(0, h, -0.4, w + 0.3, 0.3, d, roofC);
      m.box(0, 0, d / 2 + 0.1, w, h + 1.6 + R.range(0, 1.2), 0.3, shadeHex(wall, 0.05));   // sahte cephe
      m.box(0, h * 0.72, d / 2 + 1.3, w + 0.2, 0.18, 2.4, roofC);                               // tente
      for (const sx of [-w / 2 + 0.2, w / 2 - 0.2]) m.box(sx, 0, d / 2 + 2.3, 0.18, h * 0.72, 0.18, '#4a3422');
      m.box(0, 0, d / 2 + 1.2, w, 0.2, 2.4, '#7a5a3a');                                          // veranda
      m.box(0, h + 0.6, d / 2 + 0.28, Math.min(w - 0.8, 3.4), 0.7, 0.08, R.pick(['#c9a45c', '#e0d8c0', '#b3261e', '#d8c080']));
    }
    m.box(0, 0.2, d / 2 + 0.3, 1.1, 2.1, 0.1, '#2a1c12');
    for (const sx of [-w / 3, w / 3]) m.box(sx, 1.3, d / 2 + 0.3, 1.1, 1.0, 0.1, '#6a8aa0');
  }
  /* Sokak boyunca iki sıra bina: sokak z ekseni üzerinde, x=cx */
  function town(m, R, cx, z0, z1, opts = {}) {
    const by = opts.y || 0;
    if (by) { const old = m.T; m.T = old ? M4.mul(old, M4.tr(0, by, 0)) : M4.tr(0, by, 0); town(m, R, cx, z0, z1, Object.assign({}, opts, { y: 0 })); m.T = old; return; }
    for (const side of [-1, 1]) {
      let z = z0;
      while (z < z1) {
        const w = R.range(6, 9), d = R.range(7, 10), h = R.range(3.6, 5.4);
        const gable = R.chance(opts.gable || 0.3);
        m.at(cx + side * (opts.street || 7) + side * d / 2, 0, z + w / 2, side > 0 ? -Math.PI / 2 : Math.PI / 2, () => building(m, R, w, d, h, gable ? 'gable' : ''));
        z += w + R.range(1.5, 4);
      }
    }
    if (opts.church !== false) {
      m.at(cx - 20, 0, z0 - 14, Math.PI / 2, () => { m.box(0, 0, 0, 7, 5, 11, '#e8e0d0'); m.roof(0, 5, 0, 7, 3, 11, '#5a4a44'); m.box(0, 0, 6, 2.6, 10, 2.6, '#e8e0d0'); m.cone(0, 10, 6, 1.9, 4, 4, '#5a4a44'); m.box(0, 14, 6, 0.15, 1.4, 0.15, '#d8c080'); m.box(0, 14.8, 6, 0.8, 0.15, 0.15, '#d8c080'); });
    }
    if (opts.tower !== false) {
      m.at(cx + 17, 0, z0 - 6, 0, () => { for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) m.box(a * 1.4, 0, b * 1.4, 0.25, 7, 0.25, '#5a3a22'); m.cyl(0, 7, 0, 2.2, 2.6, 10, '#7a5a3a', 'y', '#6a4a2a'); m.cone(0, 9.6, 0, 2.4, 1.2, 10, '#5a4030'); });
    }
  }
  function tree(m, x, z, y, s, kind, R) {
    if (kind === 'pine') { m.box(x, y, z, 0.4 * s, 1.4 * s, 0.4 * s, '#4a3020'); m.cone(x, y + 1 * s, z, 2 * s, 3.2 * s, 6, '#2e4a2a'); m.cone(x, y + 2.8 * s, z, 1.5 * s, 2.6 * s, 6, '#35553a'); m.cone(x, y + 4.4 * s, z, 1 * s, 2 * s, 6, '#3e6040'); return; }
    if (kind === 'saguaro') { m.cyl(x, y, z, 0.35 * s, 4.2 * s, 6, '#4a7a3a'); m.cyl(x + 0.6 * s, y + 1.6 * s, z, 0.24 * s, 1.8 * s, 5, '#4a7a3a'); m.box(x + 0.3 * s, y + 1.5 * s, z, 0.7 * s, 0.4 * s, 0.4 * s, '#4a7a3a'); m.cyl(x - 0.6 * s, y + 2.2 * s, z, 0.22 * s, 1.4 * s, 5, '#4a7a3a'); m.box(x - 0.3 * s, y + 2.1 * s, z, 0.7 * s, 0.4 * s, 0.4 * s, '#4a7a3a'); return; }
    m.box(x, y, z, 0.5 * s, 2.2 * s, 0.5 * s, '#5a3e26');
    const g = kind === 'dry' ? '#8a8a4a' : '#4e7a36';
    m.box(x, y + 2 * s, z, 3 * s, 2 * s, 3 * s, g); m.box(x + 0.5 * s, y + 3.4 * s, z - 0.3 * s, 2 * s, 1.4 * s, 2 * s, shadeHex(g, 0.1)); m.box(x - 0.8 * s, y + 2.6 * s, z + 0.6 * s, 1.6 * s, 1.2 * s, 1.6 * s, shadeHex(g, -0.08));
  }
  /* Dağ: halka halka gürültülü yükseklik; sırtlar, yamaç tonları, tepede kar */
  function mountain(m, x, z, r, h, col, snow) {
    const RN = 7, SG = 18, seed = (x * 7 + z * 13) | 0;
    const H = (i, j) => { if (i === 0) return h; const rho = i / RN, a = j / SG * TAU; const n = hash2(seed + i * 3, j % SG, 5) - 0.5, ridge = Math.abs(Math.sin(a * 2.5 + seed)) * 0.18;
      return h * Math.pow(1 - rho, 1.25) * (1 + n * 0.35 * rho + ridge * (1 - rho)) - 2 * rho; };
    const P = (i, j) => { const rho = i / RN, a = j / SG * TAU, w = 1 + (hash2(seed + j % SG, i, 9) - 0.5) * 0.25 * (i ? 1 : 0); return [x + Math.cos(a) * r * rho * w, H(i, j), z + Math.sin(a) * r * rho * w]; };
    const dk = shadeHex(col, -0.12), lt = shadeHex(col, 0.08);
    for (let i = 0; i < RN; i++) for (let j = 0; j < SG; j++) {
      const a = P(i, j), b = P(i, j + 1), c = P(i + 1, j + 1), d = P(i + 1, j);
      const hy = (a[1] + c[1]) / 2, cc = snow && hy > h * 0.62 ? snow : snow && hy > h * 0.5 && hash2(i, j, seed) < 0.5 ? snow : hash2(seed, i * 31 + j, 3) < 0.33 ? dk : hash2(seed, i * 31 + j, 4) < 0.5 ? lt : col;
      if (i === 0) m.tri(a, c, d, cc, true); else { m.tri(a, b, c, cc, true); m.tri(a, c, d, cc, true); }
    }
  }
  /* Ot öbekleri: yere dik ince yapraklar (zemin gibi gölgelenir) */
  function tufts(m, R, n, x0, z0, x1, z1, hf, cols, avoid, size = 1) {
    for (let k = 0; k < n; k++) {
      const x = R.range(x0, x1), z = R.range(z0, z1); if (avoid && avoid(x, z)) continue;
      const y = hf(x, z), col = R.pick(cols), s = size * R.range(0.6, 1.3);
      for (let b = 0; b < 4; b++) { const a = R.range(0, TAU), lx = Math.cos(a) * 0.12 * s, lz = Math.sin(a) * 0.12 * s, tx = R.range(-0.25, 0.25) * s, tz = R.range(-0.25, 0.25) * s;
        m.face([[x - lx, y, z - lz], [x + lx, y, z + lz], [x + tx, y + R.range(0.35, 0.75) * s, z + tz]], [0, 1, 0], col); }
    }
  }
  /* Kaya: iç içe döndürülmüş birkaç blok */
  function rock(m, R, x, y, z, s, col) {
    for (let k = 0; k < 3; k++) m.at(x + R.range(-0.4, 0.4) * s, y - 0.1 * s, z + R.range(-0.4, 0.4) * s, R.range(0, TAU), () => { m.T = M4.mul(m.T, M4.rx(R.range(-0.25, 0.25))); m.box(0, 0, 0, R.range(0.6, 1.2) * s, R.range(0.4, 0.9) * s, R.range(0.6, 1.1) * s, shadeHex(col, R.range(-0.08, 0.08))); });
  }
  function mesa(m, x, z, w, d, h, R) {
    const cols = ['#a0482a', '#b85a32', '#8a3a24'];
    let y = 0, ww = w, dd = d;
    for (let k = 0; k < 3; k++) { const hh = h / 3; m.box(x, y, z, ww, hh, dd, cols[k % 3], '#c8703a'); y += hh; ww *= 0.9; dd *= 0.9; }
  }

  /* Karakter ve at: parçalar ayrı çizilir (bacaklar oynar) */
  function horseParts(L, col, look) {
    const body = new Mesh(L), leg = new Mesh(L);
    const d = shadeHex(col, -0.3), lt = shadeHex(col, 0.08), mane = look && look.mane || shadeHex(col, -0.45);
    // gövde: göğüs, karın, sağrı; üst hat yumuşak kademeli
    body.box(0, 0.9, 0, 0.68, 0.6, 1.5, col);
    body.box(0, 1.12, 0, 0.74, 0.42, 1.86, col);
    body.box(0, 1.5, -0.05, 0.6, 0.1, 1.5, shadeHex(col, 0.04));
    body.box(0, 0.98, 0.78, 0.66, 0.62, 0.5, lt);                                   // göğüs
    body.box(0, 0.92, 0.98, 0.5, 0.5, 0.2, lt);
    body.box(0, 1.0, -0.74, 0.8, 0.66, 0.66, col);                                  // sağrı
    body.box(0, 1.62, -0.78, 0.6, 0.1, 0.5, col);
    body.box(0, 0.82, 0.02, 0.54, 0.1, 1.2, shadeHex(col, -0.12));                  // karın
    // boyun iki parça, başa doğru incelir
    body.at(0, 1.38, 0.92, 0, () => { body.T = M4.mul(body.T, M4.rx(0.72)); body.box(0, 0, 0, 0.44, 0.62, 0.56, col); body.box(0, 0.5, 0.02, 0.36, 0.5, 0.44, col); });
    // baş: alına doğru geniş, buruna doğru dar, hafif aşağı bakar
    body.at(0, 2.18, 1.4, 0, () => {
      body.T = M4.mul(body.T, M4.rx(-0.95));
      body.box(0, -0.42, 0, 0.32, 0.42, 0.4, col);
      body.box(0, -0.72, 0.02, 0.26, 0.32, 0.32, col);
      body.box(0, -0.86, 0.03, 0.24, 0.16, 0.3, d);                                 // burun
      for (const s of [-1, 1]) { body.box(s * 0.165, -0.3, 0.06, 0.02, 0.07, 0.08, '#140c08'); body.box(s * 0.1, -0.02, -0.08, 0.07, 0.2, 0.07, d); }   // gözler, kulaklar
      body.box(0, -0.2, 0.2, 0.06, 0.18, 0.02, shadeHex(col, 0.35));               // alın akıtması
    });
    // yele: boyun boyunca tutam tutam
    for (let k = 0; k < 7; k++) { const u = k / 6; body.box(0, 1.6 + u * 0.62, 0.74 + u * 0.56, 0.1, 0.34 - u * 0.08, 0.16, mane); }
    // kuyruk: kökten aşağı akan iki parça
    body.at(0, 1.62, -1.1, 0, () => { body.T = M4.mul(body.T, M4.rx(0.35)); body.box(0, -0.42, 0, 0.18, 0.46, 0.18, mane); body.box(0, -1.0, -0.04, 0.22, 0.6, 0.16, mane); });
    body.box(0, 1.52, 0, 0.8, 0.06, 1.1, look && look.blanket || '#7a2a20');       // eyer örtüsü
    if (look) {
      body.box(0, 1.56, -0.1, 0.62, 0.12, 0.8, '#5a3a20');                          // eyer
      body.box(0, 1.68, -0.42, 0.5, 0.12, 0.12, '#4a2e18');
      body.box(0, 1.66, 0.27, 0.12, 0.22, 0.1, '#3a2412');                          // eyer kaşı
      for (const s of [-1, 1]) { body.box(s * 0.36, 0.95, 0.12, 0.03, 0.62, 0.05, '#3a2412'); body.box(s * 0.36, 0.9, 0.12, 0.08, 0.06, 0.16, '#6a6a6a'); }   // üzengi
      rider(body, look, 0, 1.72, -0.1, true);
      body.box(0, 1.98, 0.95, 0.4, 0.03, 0.03, '#2a1a10');                          // dizginler
      for (const s of [-1, 1]) body.at(s * 0.2, 1.98, 0.95, 0, () => { body.T = M4.mul(body.T, M4.rx(-0.25)); body.box(0, 0, 0, 0.02, 0.02, 0.8, '#2a1a10'); });
    }
    // bacak: kalın üst, ince incik, toynak (eklem tepede)
    leg.box(0, -0.5, 0, 0.22, 0.5, 0.26, col);
    leg.box(0, -0.95, 0, 0.13, 0.48, 0.15, d);
    leg.box(0, -1.1, 0.01, 0.18, 0.14, 0.22, '#1a1410');
    return { body: body.build(gl), leg: leg.build(gl) };
  }
  /* Oturan ya da ayakta bir kişi: kalça, bel, göğüs, kollar, eller, yüz, saç/sakal, şapka */
  function rider(m, look, x, y, z, seated, arms) {
    const coat = look.coat, sk = look.skin, hc = look.hatCol, hair = look.hair, dk = shadeHex(coat, -0.16), boot = '#24160e', skd = shadeHex(sk, -0.12);
    m.at(x, y, z, 0, () => {
      if (seated) for (const s of [-1, 1]) {
        m.box(s * 0.13, -0.04, 0.14, 0.18, 0.2, 0.46, look.pants);                // uyluk
        m.box(s * 0.32, -0.62, 0.3, 0.16, 0.62, 0.18, look.pants);               // baldır (eyerin iki yanında)
        m.box(s * 0.32, -0.74, 0.36, 0.18, 0.16, 0.3, boot);
      }
      m.box(0, 0, 0, 0.44, 0.28, 0.27, look.pants);                               // kalça
      m.box(0, 0.24, 0, 0.46, 0.08, 0.29, '#3a2414'); m.box(0, 0.245, 0.15, 0.08, 0.06, 0.02, '#c8a040');   // kemer, toka
      if (!seated) m.box(0.27, 0.02, 0.02, 0.09, 0.26, 0.12, '#4a2e18');         // kılıf
      m.box(0, 0.3, 0, 0.44, 0.24, 0.27, coat);                                   // bel
      m.box(0, 0.52, 0, 0.52, 0.28, 0.3, coat);                                   // göğüs
      m.box(0, 0.36, 0.141, 0.12, 0.44, 0.02, look.shirt);                        // gömlek
      for (const s of [-1, 1]) m.box(s * 0.09, 0.5, 0.152, 0.06, 0.3, 0.01, dk); // yakalar
      const cl = look.coatLen || 0;
      if (cl > 0.5) { if (seated) m.box(0, -0.22, -0.14, 0.46, 0.5, 0.05, coat); else { const h = 0.48 * cl; m.box(0, -h, -0.1, 0.47, h, 0.08, coat); for (const s of [-1, 1]) m.box(s * 0.215, -h, 0.02, 0.05, h, 0.22, coat); } }
      for (const s of [-1, 1]) {
        m.box(s * 0.29, 0.68, 0, 0.14, 0.12, 0.28, coat);                         // omuz
        m.box(s * 0.33, 0.4, 0.01, 0.13, 0.32, 0.15, coat);                       // üst kol
        if (seated || arms === 'reins') { m.box(s * 0.27, 0.34, 0.2, 0.12, 0.12, 0.32, dk); m.box(s * 0.22, 0.32, 0.4, 0.1, 0.11, 0.1, sk); }
        else if (arms === 'cup' && s > 0) { m.box(0.27, 0.36, 0.18, 0.12, 0.12, 0.28, dk); m.box(0.22, 0.38, 0.34, 0.1, 0.11, 0.1, sk); m.cyl(0.16, 0.38, 0.38, 0.06, 0.12, 6, '#6a6a70'); }
        else { m.box(s * 0.34, 0.12, 0.03, 0.12, 0.3, 0.14, dk); m.box(s * 0.34, 0.01, 0.04, 0.1, 0.12, 0.1, sk); }
      }
      m.box(0, 0.8, 0, 0.14, 0.08, 0.14, sk);                                     // boyun
      m.box(0, 0.77, 0.03, 0.24, 0.08, 0.22, look.scarf || '#8a2a20');            // boyunluk
      m.box(0, 0.86, 0, 0.28, 0.32, 0.28, sk);                                    // baş
      m.box(0, 0.95, 0.155, 0.06, 0.08, 0.05, skd);                               // burun
      for (const s of [-1, 1]) {
        m.box(s * 0.065, 1.02, 0.141, 0.05, 0.035, 0.01, '#1e140e');              // gözler
        m.box(s * 0.065, 1.065, 0.142, 0.075, 0.022, 0.01, shadeHex(hair, -0.2)); // kaşlar
        m.box(s * 0.147, 0.98, 0, 0.03, 0.08, 0.06, skd);                         // kulaklar
      }
      m.box(0, 0.905, 0.142, 0.09, 0.02, 0.01, shadeHex(sk, -0.32));             // ağız
      if (look.sex === 'f' && look.hairStyle !== 3) { m.box(0, 0.72, -0.12, 0.34, 0.46, 0.12, hair); for (const s of [-1, 1]) m.box(s * 0.155, 0.84, 0.0, 0.04, 0.3, 0.22, hair); }
      m.box(0, 0.98, -0.045, 0.3, 0.24, 0.22, hair);                              // ense ve yanlar
      m.box(0, 1.16, 0.005, 0.3, 0.06, 0.29, hair);                               // tepe
      if (look.beard > 0) {
        const bl = 0.08 + (look.beardLen || 0.4) * 0.12;
        m.box(0, 0.94, 0.15, 0.13, 0.03, 0.02, hair);                             // bıyık
        if (look.beard > 1) m.box(0, 0.88 - bl + 0.06, 0.12, 0.26, bl, 0.06, hair);
      }
      if (look.hat && look.hat !== 'none') {
        const wide = look.hat === 'wide' ? 0.5 : look.hat === 'bowler' ? 0.3 : look.hat === 'flat' ? 0.24 : 0.42, br = shadeHex(hc, -0.12);
        m.cyl(0, 1.13, 0, wide, 0.035, 12, br);
        if (look.hat === 'cowboy') for (const s of [-1, 1]) m.box(s * (wide - 0.06), 1.15, 0, 0.1, 0.05, wide * 1.3, br);   // kenarları kalkık
        if (look.hat === 'bowler') m.cyl(0, 1.16, 0, 0.19, 0.2, 10, hc);
        else if (look.hat === 'flat') m.box(0, 1.16, 0, 0.3, 0.12, 0.3, hc);
        else { m.box(0, 1.16, 0, 0.31, 0.12, 0.31, hc); m.box(0, 1.28, 0, 0.27, 0.08, 0.28, hc); if (look.hat === 'cowboy') m.box(0, 1.33, 0, 0.07, 0.04, 0.22, shadeHex(hc, -0.25)); }
        m.box(0, 1.165, 0, 0.31, 0.05, 0.31, '#2a1a10');                          // şerit
      }
    });
  }
  function personParts(L, look) {
    const b = new Mesh(L), leg = new Mesh(L);
    b.box(0, 0.9, 0, 0.5, 0.75, 0.3, look.coat); b.box(0, 1.65, 0, 0.3, 0.3, 0.3, look.skin);
    if (look.hat && look.hat !== 'none') { b.cyl(0, 1.92, 0, 0.36, 0.05, 8, look.hatCol); b.box(0, 1.95, 0, 0.28, 0.2, 0.28, look.hatCol); }
    for (const s of [-1, 1]) b.box(s * 0.33, 0.95, 0, 0.12, 0.65, 0.14, look.coat);
    b.box(0.1, 0.9, -0.22, 0.45, 0.55, 0.2, '#6a5a3a');           // sırt çantası
    leg.box(0, -0.9, 0, 0.16, 0.9, 0.18, look.pants);
    return { body: b.build(gl), leg: leg.build(gl) };
  }
  function drawHorse(D, parts, x, y, z, ang, ph, gallop, sc) {
    const bob = Math.abs(Math.sin(ph)) * (gallop ? 0.14 : 0.05) * (sc || 1);
    let base = M4.chain(M4.tr(x, y + bob, z), M4.ry(ang));
    if (sc) base = M4.mul(base, new Float32Array([sc, 0, 0, 0, 0, sc, 0, 0, 0, 0, sc, 0, 0, 0, 0, 1]));
    D.push([blob, M4.chain(M4.tr(x, y + 0.06, z), M4.ry(ang), [1.1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 2.0, 0, 0, 0, 0, 1]), 0.28]);
    D.push([parts.body, base]);
    const legs = [[0.25, 0.8, 0], [-0.25, 0.8, Math.PI], [0.25, -0.8, Math.PI * (gallop ? 0.35 : 1)], [-0.25, -0.8, gallop ? Math.PI * 1.35 : 0]];
    for (const [lx, lz, o] of legs) D.push([parts.leg, M4.chain(base, M4.tr(lx, 1.05, lz), M4.rx(Math.sin(ph + o) * (gallop ? 0.75 : 0.35)))]);
  }

  /* ---------------- Sahneler ----------------
     Açılış sinematikleri opencine.js'te, hikâye sinematikleri storycine.js'te
     addScene ile eklenir. */
  const SCENES = {};

  /* ---------------- Oynatıcı ---------------- */
  let el = null;
  function overlay() {
    if (el) return el;
    el = document.createElement('div');
    el.id = 'cinema';
    el.innerHTML = `<div class="cn-frame"><canvas width="${RW}" height="${RH}"></canvas><div class="cn-bar t"></div><div class="cn-bar b"></div>
      <div class="cn-cap"><div class="cn-k"></div><div class="cn-n"></div><div class="cn-s"></div></div><div class="cn-line"></div><div class="cn-fade"></div></div><div class="cn-skip"></div>`;
    document.body.appendChild(el);
    return el;
  }
  function fit() {
    const f = el.querySelector('.cn-frame'), sc = Math.min(innerWidth / RW, innerHeight / RH);
    f.style.width = Math.round(RW * sc) + 'px'; f.style.height = Math.round(RH * sc) + 'px';
  }

  function play(bgId, opts = {}) {
    return new Promise((resolve) => {
      const mk = SCENES[bgId];
      if (!mk) { resolve(); return; }
      overlay(); fit();
      const cv = el.querySelector('canvas');
      try { if (!gl && !init(cv)) { resolve(); return; } } catch (e) { console.warn('Sinematik başlatılamadı', e); resolve(); return; }
      let S;
      try { S = mk(new RNG(opts.seed || 1890), opts.look || randomLook('m'), opts); } catch (e) { console.warn(e); resolve(); return; }
      const town = TOWNS.find(t => t.id === (BACKGROUNDS.find(b => b.id === bgId) || {}).town);
      // hikâye sahneleri kendi başlığını (bölüm adı) ve konuşma satırlarını verir
      const oc = opts.cap || S.cap || {};
      el.querySelector('.cn-k').textContent = oc.k !== undefined ? oc.k : Tr`Amerika, ${START_YEAR}`;
      el.querySelector('.cn-n').textContent = oc.n !== undefined ? oc.n : town ? town.n : '';
      el.querySelector('.cn-s').textContent = oc.s !== undefined ? oc.s : '';
      const lineEl = el.querySelector('.cn-line');
      // açılış satırları sahnenin istediği anda başlar (S.lineAt); süre satırlara yetmezse çekimler uzar
      let lines = opts.lines || [];
      if (lines.length && S.lineAt !== undefined && opts.dur === undefined) {
        const sh = S.lineAt - lines[0].t; lines = lines.map(l => Object.assign({}, l, { t: l.t + sh }));
        const end = lines[lines.length - 1]; opts = Object.assign({}, opts, { dur: end.t + end.d + 1.2 });
      }
      let curLine = null;
      lineEl.innerHTML = '';
      el.querySelector('.cn-skip').innerHTML = Tr`${Input.glyph('confirm')} Geç`;
      el.classList.remove('out'); el.classList.add('on');
      const fd = el.querySelector('.cn-fade'); fd.style.animation = 'none'; void fd.offsetWidth; fd.style.animation = '';
      const parts = [];
      const addP = (p, v, col, size, life) => { if (parts.length < 900) parts.push({ p: p.slice(), v, col, size, life, max: life }); };
      let t0 = performance.now(), last = t0, done = false, raf = 0; const myId = ++playId;
      const finish = () => {
        if (done) return; done = true;
        cancelAnimationFrame(raf);
        window.removeEventListener('keydown', skip, true); window.removeEventListener('pointerdown', skip, true);
        el.classList.add('out');
        resolve();
        // hemen ardından başka bir sinematik başladıysa onun katmanı kapatılmaz
        setTimeout(() => { if (playId === myId) el.classList.remove('on', 'out'); }, 700);
      };
      const skip = (e) => { if (performance.now() - t0 > 400) { if (e) { e.preventDefault(); e.stopImmediatePropagation(); } finish(); } };
      window.addEventListener('keydown', skip, true); window.addEventListener('pointerdown', skip, true);
      const sky = S.sky;
      // çekimler: sahne tek bir S.cam veriyorsa tek çekim sayılır
      let shots = S.shots || [{ d: DUR, cam: (t) => S.cam(t) }];
      // konuşma satırları sahneden uzun sürerse çekimler orantılı uzatılır
      const base = shots.reduce((a, sh) => a + sh.d, 0);
      if (opts.dur && opts.dur > base) shots = shots.map(sh => Object.assign({}, sh, { d: sh.d * opts.dur / base }));
      const total = shots.reduce((a, sh) => a + sh.d, 0);
      stat = { scene: bgId, frames: 0, glErr: 0, shadow: false, lines: lines.length, dur: total };
      const cut1 = shots.length > 1 ? shots[0].d : 0;
      const cuts = []; { let a = 0; for (const sh of shots.slice(0, -1)) cuts.push(a += sh.d); }
      const capAt = opts.capAt !== undefined ? opts.capAt : S.capAt !== undefined ? S.capAt : cut1 + 0.5, capEnd = S.capEnd || total;
      const shotAt = (t) => { let a = 0; for (const sh of shots) { if (t < a + sh.d || sh === shots[shots.length - 1]) return sh.cam(t, cl01((t - a) / sh.d)); a += sh.d; } };
      const G = Object.assign({ lift: [0, 0, 0], gain: [1, 1, 1], sat: 1, con: 1 }, S.grade || {});
      // gölge: düşük grafik ayarında küçük harita; sahne kapatabilir (S.shadow === false)
      const lowQ = typeof window !== 'undefined' && window.G && G.settings && G.settings.fxq;
      const shadowOn = !!(DP && S.shadow !== false && shadowTargets(lowQ ? 1024 : 2048));
      const nearH = S.shadowN || 26, farH = S.shadowR || 240, LD = V.norm(S.L.dir);
      let farM = null;
      // ışığın bakışından dik izdüşüm; merkez doku hücresine oturtulur (kamera kayarken gölge titremesin)
      const lightMat = (c, h) => {
        const up = Math.abs(LD[1]) > 0.95 ? [0, 0, 1] : [0, 1, 0];
        let view = M4.look(V.add(c, LD.map(v => v * 400)), c, up);
        const q = M4.pt(view, c), tx = h * 2 / SM;
        view = M4.mul(M4.tr(-(q[0] - Math.round(q[0] / tx) * tx), -(q[1] - Math.round(q[1] / tx) * tx), 0), view);
        return M4.mul(M4.ortho(-h, h, -h, h, 1, 900), view);
      };
      const shadowPass = (k, M, dyn) => {
        gl.bindFramebuffer(gl.FRAMEBUFFER, shadow[k].fb); gl.viewport(0, 0, SM, SM);
        gl.clearColor(1, 1, 1, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); gl.enable(gl.DEPTH_TEST);
        gl.useProgram(DP.p); gl.uniformMatrix4fv(DP.u.uLVP, false, M);
        const a = DP.a('aP'); gl.enableVertexAttribArray(a);
        const I = M4.id();
        const dd = (o, mm) => { if (o.emit) return; gl.bindBuffer(gl.ARRAY_BUFFER, o.buf); gl.vertexAttribPointer(a, 3, gl.FLOAT, false, VSZ * 4, 0); gl.uniformMatrix4fv(DP.u.uM, false, mm); gl.drawArrays(gl.TRIANGLES, 0, o.n); };
        for (const o of S.static) dd(o, I);
        if (dyn) for (const [o, mm, al] of dyn) if (al === undefined) dd(o, mm);
        gl.disableVertexAttribArray(a);
      };
      fd.style.animationDuration = total + 's';
      const frame = (now) => {
        if (done) return;
        // opts.freeze: zamanı sabitler (kapak karesi ve testler için)
        const t = opts.freeze !== undefined ? opts.freeze : (now - t0) / 1000, dt = Math.min(0.05, (now - last) / 1000); last = now;
        if ((t > total && opts.freeze === undefined) || (Input.pad && (Input.padTap(PS.X) || Input.padTap(PS.O) || Input.padTap(PS.OPT)) && t > 0.4)) { finish(); return; }
        // başlık ikinci çekimde (geniş açı) belirir
        el.querySelector('.cn-cap').style.opacity = clamp((t - capAt) * 1.4, 0, 1) * clamp((Math.min(total, capEnd) - t) * 2, 0, 1);
        // altyazı: alttaki siyah şeritte konuşan kişinin adı ve sözü
        const ln = lines.find(l => t >= l.t && t < l.t + l.d) || null;
        if (ln !== curLine) { curLine = ln; if (ln && opts.onLine) try { opts.onLine(ln); } catch (e) {} lineEl.innerHTML = ln ? `<span class="cl-n ${ln.self ? 'self' : ''}">${escapeHtml(ln.w)}</span> ${escapeHtml(ln.x)}` : ''; lineEl.classList.toggle('on', !!ln); }
        const D = [];
        S.dyn(t, D);
        const cam = shotAt(t);
        if (cam.shake) { const k = cam.shake; cam.e = [cam.e[0] + (Math.sin(t * 1.7) + Math.sin(t * 2.9) * 0.5) * k, cam.e[1] + Math.sin(t * 2.3 + 1) * k * 0.7, cam.e[2] + Math.sin(t * 1.3 + 2) * k]; }
        // yakın gölge kademesi: özneyi izler (dinamik parçalar dahil), her kare yeniden çizilir
        let nearM = null;
        if (shadowOn) {
          if (!farM) { farM = lightMat(S.shadowC || [0, 0, 0], farH); shadowPass(1, farM, null); }
          nearM = lightMat(S.focus || cam.c, nearH); shadowPass(0, nearM, D);
        }
        const proj = M4.persp(0.9, RW / RH, 0.4, 900), view = M4.look(cam.e, cam.c), VP = M4.mul(proj, view);
        gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
        gl.viewport(0, 0, RW, RH);
        gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        // gökyüzü: ufuk çizgisi ve güneş ekran konumu
        const fwd = V.norm([cam.c[0] - cam.e[0], 0, cam.c[2] - cam.e[2]]);
        const far = V.add(cam.e, fwd.map(v => v * 800));
        const hq = M4.pt(VP, far); const hw = VP[3] * far[0] + VP[7] * far[1] + VP[11] * far[2] + VP[15];
        const sd = V.norm(sky.sun), sp = V.add(cam.e, sd.map(v => v * 800)), sq = M4.pt(VP, sp), sw = VP[3] * sp[0] + VP[7] * sp[1] + VP[11] * sp[2] + VP[15];
        const sunX = sw > 0 ? sq[0] / sw : 9, sunY = sw > 0 ? sq[1] / sw : 9;
        gl.disable(gl.DEPTH_TEST);
        gl.useProgram(SP.p);
        gl.bindBuffer(gl.ARRAY_BUFFER, skyBuf);
        const sa = SP.a('aP'); gl.enableVertexAttribArray(sa); gl.vertexAttribPointer(sa, 2, gl.FLOAT, false, 0, 0);
        gl.uniform3fv(SP.u.uTop, C(sky.top)); gl.uniform3fv(SP.u.uHor, C(sky.hor)); gl.uniform1f(SP.u.uHorY, hq[1] / hw - 0.02);
        gl.uniform2f(SP.u.uSun, sunX, sunY); gl.uniform3fv(SP.u.uSunC, C(sky.sunC)); gl.uniform1f(SP.u.uSunR, sky.sunR);
        gl.uniform1f(SP.u.uTime, t); gl.uniform1f(SP.u.uYaw, Math.atan2(fwd[0], -fwd[2])); gl.uniform1f(SP.u.uCloud, S.cloud || 0); gl.uniform3fv(SP.u.uCloudC, C(S.cloudC || '#ffffff'));
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        gl.disableVertexAttribArray(sa);
        // sahne: önce opak parçalar, sonra su, en son yarı saydam gölgeler
        gl.enable(gl.DEPTH_TEST);
        gl.useProgram(P.p);
        gl.uniformMatrix4fv(P.u.uVP, false, VP); gl.uniform3fv(P.u.uCam, cam.e); gl.uniform3fv(P.u.uFog, C(S.fog)); gl.uniform1f(P.u.uFogD, S.fogD); gl.uniform1f(P.u.uFogH, S.fogH || 0);
        // gölge kademeleri
        const shOn = shadowOn && nearM ? 1 : 0;
        gl.uniform1f(P.u.uShOn, shOn); gl.uniform1f(P.u.uShK, S.shadowK !== undefined ? S.shadowK : 0.92);
        if (shOn) {
          gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, shadow[0].tex); gl.uniform1i(P.u.uSh0, 1);
          gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, shadow[1].tex); gl.uniform1i(P.u.uSh1, 2);
          gl.activeTexture(gl.TEXTURE0);
          gl.uniformMatrix4fv(P.u.uLV0, false, nearM); gl.uniformMatrix4fv(P.u.uLV1, false, farM);
          gl.uniform2f(P.u.uNO, nearH * 2 / SM * 1.6, farH * 2 / SM * 1.6); gl.uniform1f(P.u.uTex, 1 / SM);
        }
        // nokta ışıklar (ateş titrer)
        const LPa = new Float32Array(NL * 4), LCa = new Float32Array(NL * 3);
        const lights = typeof S.lights === 'function' ? S.lights(t) : S.lights || [];
        lights.slice(0, NL).forEach((l, i) => {
          const fl = l.flick ? 0.82 + 0.1 * Math.sin(t * 13 + i * 3) + 0.08 * Math.sin(t * 29.7 + i) : 1, col = C(l.c);
          LPa.set([l.p[0], l.p[1], l.p[2], l.r], i * 4); LCa.set(col.map(v => v * l.i * fl), i * 3);
        });
        gl.uniform4fv(P.u['uLP[0]'], LPa); gl.uniform3fv(P.u['uLC[0]'], LCa);
        const aP = P.a('aP'), aC = P.a('aC'), aS = P.a('aS'), aA = P.a('aA'), aN = P.a('aN'), AT = [aP, aC, aS, aA, aN];
        for (const a of AT) gl.enableVertexAttribArray(a);
        const I = M4.id();
        const draw = (o, mm, al) => { gl.bindBuffer(gl.ARRAY_BUFFER, o.buf); for (let k = 0; k < 5; k++) gl.vertexAttribPointer(AT[k], 3, gl.FLOAT, false, VSZ * 4, k * 12); gl.uniformMatrix4fv(P.u.uM, false, mm); gl.uniform1f(P.u.uA, al === undefined ? 1 : al); gl.drawArrays(gl.TRIANGLES, 0, o.n); };
        for (const o of S.static) draw(o, I);
        for (const [o, mm, al] of D) if (al === undefined) draw(o, mm);
        for (const a of AT) gl.disableVertexAttribArray(a);
        if (S.water && WP) {
          const Wt = S.water;
          gl.useProgram(WP.p);
          gl.uniformMatrix4fv(WP.u.uVP, false, VP); gl.uniform3fv(WP.u.uCam, cam.e); gl.uniform1f(WP.u.uT, t);
          gl.uniform3fv(WP.u.uSunD, V.norm(sky.sun)); gl.uniform3fv(WP.u.uSunC, C(sky.sunC)); gl.uniform3fv(WP.u.uSkyH, C(sky.hor)); gl.uniform3fv(WP.u.uSkyT, C(sky.top));
          gl.uniform3fv(WP.u.uDeep, C(Wt.deep || '#1e4a5e')); gl.uniform3fv(WP.u.uFog, C(S.fog)); gl.uniform1f(WP.u.uFogD, S.fogD); gl.uniform1f(WP.u.uCalm, Wt.calm || 1);
          gl.bindBuffer(gl.ARRAY_BUFFER, wBuf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([Wt.x0, Wt.y, Wt.z0, Wt.x1, Wt.y, Wt.z0, Wt.x1, Wt.y, Wt.z1, Wt.x0, Wt.y, Wt.z0, Wt.x1, Wt.y, Wt.z1, Wt.x0, Wt.y, Wt.z1]), gl.DYNAMIC_DRAW);
          const wa = WP.a('aP'); gl.enableVertexAttribArray(wa); gl.vertexAttribPointer(wa, 3, gl.FLOAT, false, 0, 0);
          gl.drawArrays(gl.TRIANGLES, 0, 6); gl.disableVertexAttribArray(wa);
          gl.useProgram(P.p);
        }
        for (const a of AT) gl.enableVertexAttribArray(a);
        gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
        gl.uniform1f(P.u.uShOn, 0);
        for (const [o, mm, al] of D) if (al !== undefined) draw(o, mm, al);
        gl.disable(gl.BLEND); gl.depthMask(true);
        for (const a of AT) gl.disableVertexAttribArray(a);
        // parçacıklar
        if (S.particles) S.particles(t, addP);
        const arr = [];
        for (let i = parts.length - 1; i >= 0; i--) {
          const q = parts[i]; q.life -= dt;
          if (q.life <= 0) { parts.splice(i, 1); continue; }
          q.p[0] += q.v[0] * dt; q.p[1] += q.v[1] * dt; q.p[2] += q.v[2] * dt;
          const a = q.life / q.max;
          arr.push(q.p[0], q.p[1], q.p[2], q.col[0], q.col[1], q.col[2], q.col[3] * a, q.size * (1.6 - a * 0.6));
        }
        if (arr.length) {
          gl.useProgram(PP.p); gl.depthMask(false);
          gl.uniformMatrix4fv(PP.u.uVP, false, VP);
          gl.bindBuffer(gl.ARRAY_BUFFER, ptBuf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(arr), gl.DYNAMIC_DRAW);
          const a0 = PP.a('aP'), a1 = PP.a('aC'), a2 = PP.a('aS');
          gl.enableVertexAttribArray(a0); gl.enableVertexAttribArray(a1); gl.enableVertexAttribArray(a2);
          gl.vertexAttribPointer(a0, 3, gl.FLOAT, false, 32, 0); gl.vertexAttribPointer(a1, 4, gl.FLOAT, false, 32, 12); gl.vertexAttribPointer(a2, 1, gl.FLOAT, false, 32, 28);
          gl.drawArrays(gl.POINTS, 0, arr.length / 8);
          gl.disableVertexAttribArray(a0); gl.disableVertexAttribArray(a1); gl.disableVertexAttribArray(a2);
          gl.depthMask(true);
        }
        // son geçiş: ara tampondan ekrana
        if (fb) {
          gl.bindFramebuffer(gl.FRAMEBUFFER, null);
          gl.viewport(0, 0, RW, RH);
          gl.disable(gl.DEPTH_TEST);
          gl.useProgram(QP.p);
          gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, fbTex); gl.uniform1i(QP.u.uT, 0);
          const sunOn = sw > 0 && Math.abs(sunX) < 1.3 && Math.abs(sunY) < 1.3 ? 1 : 0;
          gl.uniform2f(QP.u.uSun, sunX, sunY); gl.uniform1f(QP.u.uSunVis, sunOn); gl.uniform3fv(QP.u.uSunC, C(sky.sunC));
          gl.uniform3fv(QP.u.uLift, G.lift); gl.uniform3fv(QP.u.uGain, G.gain); gl.uniform1f(QP.u.uSat, G.sat); gl.uniform1f(QP.u.uCon, G.con);
          // çekim geçişinde kısa bir kararma, başta ve sonda yumuşak açılış/kapanış
          let cutDip = 1; for (const c of cuts) cutDip = Math.min(cutDip, 1 - 0.85 * Math.max(0, 1 - Math.abs(t - c) / 0.12));
          gl.uniform1f(QP.u.uTime, t); gl.uniform1f(QP.u.uFade, cutDip);
          gl.bindBuffer(gl.ARRAY_BUFFER, skyBuf);
          const qa = QP.a('aP'); gl.enableVertexAttribArray(qa); gl.vertexAttribPointer(qa, 2, gl.FLOAT, false, 0, 0);
          gl.drawArrays(gl.TRIANGLES, 0, 3);
          gl.disableVertexAttribArray(qa);
          gl.enable(gl.DEPTH_TEST);
        }
        // test ve hata ayıklama: kare sayısı, GL hatası, gölge durumu, ekrandan örnek pikseller
        stat.frames++; stat.shadow = !!nearM; stat.t = t; const ge = gl.getError(); if (ge) stat.glErr = ge;
        if (opts.probe) { const px = new Uint8Array(4); let sum = 0, sq = 0, n = 0; for (let y = 1; y < 9; y++) for (let x = 1; x < 16; x++) { gl.readPixels(Math.floor(RW * x / 16), Math.floor(RH * y / 9), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); const l = px[0] * 0.3 + px[1] * 0.59 + px[2] * 0.11; sum += l; sq += l * l; n++; } stat.mean = sum / n; stat.std = Math.sqrt(Math.max(0, sq / n - (sum / n) ** 2)); }
        raf = requestAnimationFrame(frame);
      };
      raf = requestAnimationFrame(frame);
    });
  }
  /* Başka dosyalardaki sahneler (hikâye sinematikleri) aynı yapı taşlarını kullanır */
  const kit = {
    M4, V, C, ease, cl01, flatW, Mesh, building, town, tree, mountain, mesa, horseParts, rider, personParts, drawHorse, tufts, rock,
    build: (m) => m.build(gl), blob: () => blob,
  };
  function addScene(id, fn) { SCENES[id] = fn; }
  return { play, addScene, kit, has: (id) => !!SCENES[id], stat: () => stat, RW, RH, DUR };
})();
