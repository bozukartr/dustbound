'use strict';
/* ==========================================================
   FRONTIER'S END — sinematikler (şimdilik yeni hayatın başındaki varışlar)
   Kütüphanesiz küçük bir WebGL çizici: düz gölgeli alçak poligon sahneler.
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

  /* ---------------- Mesh: aydınlatma kuruluşta vertex rengine işlenir ---------------- */
  class Mesh {
    constructor(L) { this.v = []; this.L = L; this.T = null; }
    shade(n, col) {
      const L = this.L, d = Math.max(0, V.dot(n, L.dir)), up = n[1] * 0.06;
      return [0, 1, 2].map(i => Math.min(1.2, col[i] * (L.ambC[i] * L.amb + L.sunC[i] * L.dif * d + up)));
    }
    face(pts, n, col) {
      if (typeof col === 'string') col = C(col);
      if (this.T) { pts = pts.map(p => M4.pt(this.T, p)); n = M4.dir(this.T, n); }
      const c = this.shade(n, col);
      for (let i = 1; i < pts.length - 1; i++) for (const p of [pts[0], pts[i], pts[i + 1]]) this.v.push(p[0], p[1], p[2], c[0], c[1], c[2]);
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
      return { buf, n: this.v.length / 6 };
    }
  }

  /* ---------------- Gölgelendiriciler ---------------- */
  const VS = `attribute vec3 aP; attribute vec3 aC; uniform mat4 uVP; uniform mat4 uM; uniform vec3 uCam; varying vec3 vC; varying float vD; varying float vY;
    void main(){ vec4 w = uM * vec4(aP, 1.0); vC = aC; vD = length(w.xyz - uCam); vY = w.y; gl_Position = uVP * w; }`;
  const DITHER = `float b2(vec2 a){ a = floor(a); return fract(a.x * 0.5 + a.y * a.y * 0.75); }
    float bay(vec2 a){ return b2(0.5 * a) * 0.25 + b2(a); }
    vec3 post(vec3 c){ float d = bay(gl_FragCoord.xy); return floor(c * 26.0 + d) / 26.0; }`;
  // sahne: renkler doğrusal olarak ara tampona yazılır (kademe son geçişte)
  const FS = `precision mediump float; varying vec3 vC; varying float vD; varying float vY; uniform vec3 uFog; uniform float uFogD; uniform float uFogH; uniform float uA;
    void main(){ float f = 1.0 - exp(-vD * uFogD); f *= clamp(1.0 - (vY - uFogH) * 0.012, 0.35, 1.0); gl_FragColor = vec4(mix(vC, uFog, clamp(f, 0.0, 1.0)), uA); }`;
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

  let gl = null, P = null, SP = null, PP = null, QP = null, skyBuf = null, ptBuf = null, fb = null, fbTex = null, blob = null;
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
  function mountain(m, x, z, r, h, col, snow) { m.cone(x, -2, z, r, h, 7, col, snow); }
  function mesa(m, x, z, w, d, h, R) {
    const cols = ['#a0482a', '#b85a32', '#8a3a24'];
    let y = 0, ww = w, dd = d;
    for (let k = 0; k < 3; k++) { const hh = h / 3; m.box(x, y, z, ww, hh, dd, cols[k % 3], '#c8703a'); y += hh; ww *= 0.9; dd *= 0.9; }
  }

  /* Karakter ve at: parçalar ayrı çizilir (bacaklar oynar) */
  function horseParts(L, col, look) {
    const body = new Mesh(L), leg = new Mesh(L);
    const d = shadeHex(col, -0.3);
    const lt = shadeHex(col, 0.1);
    body.box(0, 1.15, 0, 0.72, 0.78, 2.0, col);
    body.box(0, 1.08, 0.72, 0.78, 0.82, 0.62, lt);                              // göğüs
    body.box(0, 1.12, -0.72, 0.8, 0.84, 0.66, col);                             // sağrı
    body.box(0, 1.0, 0, 0.6, 0.2, 1.5, shadeHex(col, -0.12));                   // karın
    body.at(0, 1.55, 1.0, 0, () => { body.T = M4.mul(body.T, M4.rx(-0.75)); body.box(0, 0, 0, 0.4, 1.0, 0.52, col); });
    body.box(0, 2.05, 1.55, 0.34, 0.36, 0.72, col);
    body.box(0, 1.93, 1.95, 0.28, 0.28, 0.34, d);                               // burun
    for (const s of [-1, 1]) body.box(s * 0.11, 2.4, 1.28, 0.08, 0.18, 0.08, d); // kulaklar
    body.at(0, 1.72, -1.05, 0, () => { body.T = M4.mul(body.T, M4.rx(0.5)); body.box(0, -0.75, 0, 0.16, 0.8, 0.18, d); });   // kuyruk
    body.box(0, 1.9, 1.05, 0.1, 0.5, 0.7, d);           // yele
    body.box(0, 1.52, 0, 0.8, 0.06, 1.1, look && look.blanket || '#7a2a20');   // eyer örtüsü
    if (look) {
      body.box(0, 1.95, -0.1, 0.8, 0.12, 0.8, '#5a3a20');                       // eyer
      body.box(0, 2.05, 0.28, 0.1, 0.22, 0.1, '#3a2412');                       // eyer kaşı
      rider(body, look, 0, 2.02, -0.1, true);
      body.box(0, 2.12, 1.2, 0.03, 0.03, 1.1, '#2a1a10');                       // dizginler
    }
    leg.box(0, -1.05, 0, 0.18, 1.05, 0.22, d);
    leg.box(0, -1.1, 0, 0.22, 0.12, 0.26, '#1a1410');
    return { body: body.build(gl), leg: leg.build(gl) };
  }
  /* Oturan ya da ayakta bir kişi: gövde, kollar, baş, saç/sakal, şapka, boyunluk */
  function rider(m, look, x, y, z, seated) {
    const coat = look.coat, sk = look.skin, hc = look.hatCol, hair = look.hair;
    m.at(x, y, z, 0, () => {
      if (seated) for (const s of [-1, 1]) { m.box(s * 0.26, -0.05, 0.12, 0.16, 0.16, 0.5, look.pants); m.box(s * 0.36, -0.7, 0.3, 0.14, 0.7, 0.16, look.pants); m.box(s * 0.36, -0.78, 0.36, 0.16, 0.16, 0.26, '#1a120c'); }
      m.box(0, 0, 0, 0.44, 0.42, 0.3, look.pants);                               // kalça
      m.box(0, 0.35, 0, 0.5, 0.5, 0.32, coat);                                   // göğüs
      m.box(0, 0.36, 0.17, 0.16, 0.42, 0.02, look.shirt);                        // gömlek
      m.box(0, 0.8, 0.02, 0.24, 0.1, 0.24, '#8a2a20');                           // bandana
      for (const s of [-1, 1]) { m.box(s * 0.31, 0.42, 0.1, 0.13, 0.42, 0.14, coat); m.box(s * 0.26, 0.28, 0.32, 0.12, 0.12, 0.36, coat); m.box(s * 0.2, 0.28, 0.52, 0.1, 0.1, 0.1, sk); }
      m.box(0, 0.86, 0, 0.3, 0.32, 0.3, sk);                                     // baş
      m.box(0, 0.93, 0.15, 0.2, 0.05, 0.02, '#2a1a12');                          // gözler
      if (look.sex === 'f' && look.hairStyle !== 3) m.box(0, 0.74, -0.16, 0.34, 0.42, 0.1, hair);
      else m.box(0, 1.08, -0.02, 0.32, 0.1, 0.32, hair);
      if (look.beard > 0) m.box(0, 0.86, 0.15, 0.3, 0.14, 0.04, hair);
      if (look.hat && look.hat !== 'none') {
        const wide = look.hat === 'wide' ? 0.5 : look.hat === 'bowler' ? 0.3 : look.hat === 'flat' ? 0.24 : 0.42;
        m.cyl(0, 1.14, 0, wide, 0.04, 10, shadeHex(hc, -0.15));
        if (look.hat === 'bowler') m.cyl(0, 1.16, 0, 0.19, 0.2, 8, hc); else m.box(0, 1.16, 0, 0.3, look.hat === 'flat' ? 0.12 : 0.24, 0.3, hc);
        m.box(0, 1.17, 0, 0.31, 0.05, 0.31, '#2a1a10');
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
  function drawHorse(D, parts, x, y, z, ang, ph, gallop) {
    const bob = Math.abs(Math.sin(ph)) * (gallop ? 0.14 : 0.05);
    const base = M4.chain(M4.tr(x, y + bob, z), M4.ry(ang));
    D.push([blob, M4.chain(M4.tr(x, y + 0.06, z), M4.ry(ang), [1.1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 2.0, 0, 0, 0, 0, 1]), 0.28]);
    D.push([parts.body, base]);
    const legs = [[0.25, 0.8, 0], [-0.25, 0.8, Math.PI], [0.25, -0.8, Math.PI * (gallop ? 0.35 : 1)], [-0.25, -0.8, gallop ? Math.PI * 1.35 : 0]];
    for (const [lx, lz, o] of legs) D.push([parts.leg, M4.chain(base, M4.tr(lx, 1.05, lz), M4.rx(Math.sin(ph + o) * (gallop ? 0.75 : 0.35)))]);
  }

  /* ---------------- Sahneler ---------------- */
  const SCENES = {
    /* Çiftçi: sabah, altın ovalar, at arabası Harlow'a yaklaşır */
    farm(R, look) {
      const L = { dir: V.norm([0.5, 0.45, -0.75]), amb: 0.55, dif: 0.75, ambC: C('#b8c8e0'), sunC: C('#ffe8c0') };
      const m = new Mesh(L);
      const hf = (x, z) => { let h = Math.sin(x * 0.021) * Math.cos(z * 0.017) * 5 + Math.sin(x * 0.05 + z * 0.03) * 1.2; const road = Math.min(1, Math.abs(x) / 14); return h * road * flatW(x, z, -45, 45, -100, 28); };
      m.terrain(-260, -220, 260, 300, 5, hf, (x, z) => Math.abs(x) < 3.2 && z > -60 ? '#9a7c56' : hash2(x | 0, z | 0, 3) < 0.5 ? (Math.sin(x * 0.04) > 0.2 ? '#c8a858' : '#9aa04a') : (Math.sin(z * 0.05) > 0.3 ? '#b89c4c' : '#8a9a44'));
      for (let z = 30; z < 280; z += 7) for (const s of [-1, 1]) { m.box(s * 5.5, hf(s * 5.5, z), z, 0.18, 1.3, 0.18, '#6a4a2a'); m.box(s * 5.5, hf(s * 5.5, z) + 0.9, z + 3.5, 0.1, 0.12, 7, '#7a5a3a'); }
      for (let k = 0; k < 40; k++) { const x = R.range(-200, 200), z = R.range(-100, 280); if (Math.abs(x) < 16 || (Math.abs(x) < 40 && z < 30)) continue; tree(m, x, z, hf(x, z), R.range(0.9, 1.5), 'oak', R); }
      town(m, R, 0, -70, 18, { street: 6 });
      m.at(34, 0, -40, 0, () => { m.box(0, 0, 0, 0.8, 9, 0.8, '#8a7a64'); m.box(0, 9, 0.5, 5, 0.3, 0.2, '#d8d0c0'); m.box(0, 7.5, 0.5, 0.3, 3.3, 0.2, '#d8d0c0'); });
      for (let k = 0; k < 5; k++) mountain(m, -300 + k * 150, -420, 90, R.range(40, 70), '#8a98a8', '#e8ecf0');
      const S = { L, static: [m.build(gl)], sky: { top: '#5a8cc8', hor: '#f4dcae', sun: [0.5, 0.25, -0.75], sunC: '#fff2c8', sunR: 0.05 }, fog: '#e8d8b8', fogD: 0.0042 };
      const horse = horseParts(L, '#6a4a2e', null);
      const wagon = new Mesh(L);
      wagon.box(0, 0.9, 0, 1.9, 0.7, 3.4, '#7a5436'); wagon.box(0, 1.6, -0.2, 1.8, 0.1, 3.0, '#5a3a22');
      for (let k = 0; k < 6; k++) { const a0 = k / 6 * Math.PI, a1 = (k + 1) / 6 * Math.PI; wagon.face([[Math.cos(a0) * 1, 1.6 + Math.sin(a0) * 1.3, -1.5], [Math.cos(a1) * 1, 1.6 + Math.sin(a1) * 1.3, -1.5], [Math.cos(a1) * 1, 1.6 + Math.sin(a1) * 1.3, 1.1], [Math.cos(a0) * 1, 1.6 + Math.sin(a0) * 1.3, 1.1]], [Math.cos((a0 + a1) / 2), Math.sin((a0 + a1) / 2), 0], '#e8e0cc'); }
      wagon.box(0, 1.6, 1.4, 1.1, 0.5, 0.6, '#5a3a22');
      rider(wagon, look, 0, 1.95, 1.35, true);
      wagon.box(0, 0.8, 3.1, 0.1, 0.1, 2.8, '#4a3020');
      const wheel = new Mesh(L); wheel.cyl(-0.1, 0, 0, 0.62, 0.2, 10, '#5a3a22', 'x', '#8a6a44'); for (let k = 0; k < 4; k++) wheel.at(0, 0, 0, 0, () => { wheel.T = M4.mul(wheel.T, M4.rx(k * Math.PI / 4)); wheel.box(0.05, -0.6, 0, 0.08, 1.2, 0.08, '#3a2616'); });
      const WB = wagon.build(gl), WH = wheel.build(gl);
      S.dyn = (t, D) => {
        const z = 96 - t * 5.2, y = hf(0, z);
        drawHorse(D, horse, 0, y, z - 4.6, Math.PI, t * 7, false);
        const base = M4.chain(M4.tr(0, y, z), M4.ry(Math.PI));
        D.push([blob, M4.chain(M4.tr(0, y + 0.05, z), [1.6, 0, 0, 0, 0, 1, 0, 0, 0, 0, 2.6, 0, 0, 0, 0, 1]), 0.3]);
        D.push([WB, base]);
        for (const [wx, wz] of [[1.05, 1.1], [-1.05, 1.1], [1.05, -1.1], [-1.05, -1.1]]) D.push([WH, M4.chain(base, M4.tr(wx, 0.62, wz), M4.ry(wx > 0 ? 0 : Math.PI), M4.rx(t * 8.4))]);
        S.focus = [0, y + 1.5, z];
      };
      const zz = (t) => 96 - t * 5.2;
      S.shots = [
        // yakın: tekerlek hizasından sürücüye, yanında yürür gibi
        { d: 3.3, cam: (t, u) => { const z = zz(t), y = hf(0, z); return { e: [6.4 - u * 0.8, y + 1.9 + u * 0.3, z - 6.5 + u * 1.2], c: [0, y + 2.0, z - 1.8] }; } },
        // geniş: arkadan yükselen vinç çekimi, ovada kasaba belirir
        { d: DUR - 3.3, cam: (t, u) => { const z = zz(t), k = ease(u); return { e: V.lerp([-2.5, 3.2, z + 10], [-4.5, 10, z + 20], k), c: V.lerp([0, 2.2, z - 6], [0, 4, -20], ease(cl01(u * 1.3))) }; } },
      ];
      S.grade = { lift: [0.03, 0.02, 0], gain: [1.06, 1.0, 0.9], sat: 1.08, con: 1.06 };
      S.cloud = 0.42; S.cloudC = '#fff6e6';
      S.particles = (t, add) => { if (Math.random() < 0.6) add([R.range(-1, 1), hf(0, 96 - t * 5.2) + 0.2, 96 - t * 5.2 + 1.5], [0, 0.4, 1], [0.78, 0.66, 0.48, 0.5], 1.2, 1.4); };
      return S;
    },

    /* Göçmen: buharlı gemi Saint Clement limanına yanaşır */
    immigrant(R, look) {
      const L = { dir: V.norm([-0.4, 0.6, -0.6]), amb: 0.6, dif: 0.7, ambC: C('#c0d0e8'), sunC: C('#fff4e0') };
      const m = new Mesh(L);
      const hf = (x, z) => { const shore = -30 + Math.sin(x * 0.03) * 8; if (z >= shore) return -1.5 - (z - shore) * 0.05; const land = Math.min(2, (shore - z) * 0.22); return land + (Math.sin(x * 0.07) * 0.8 + Math.max(0, -z - 150) * 0.05) * flatW(x, z, -40, 30, -140, -40, 20); };
      m.terrain(-300, -260, 300, -10, 6, hf, (x, z) => hf(x, z) < 0.6 ? '#d8c890' : hash2(x | 0, z | 0, 4) < 0.5 ? '#7a9a50' : '#6a8a48');
      const wm = new Mesh(L);
      for (let z = -60; z < 400; z += 10) for (let x = -320; x < 320; x += 10) {
        const c = hash2(x, z, 9) < 0.15 ? '#5a8aa8' : '#3a6a8a';
        wm.face([[x, 0, z], [x, 0, z + 10], [x + 10, 0, z + 10], [x + 10, 0, z]], [0, 1, 0], c);
      }
      town(m, R, -6, -120, -44, { street: 7, gable: 0.2, y: 2 });
      // iskele
      m.box(10, 0.6, -10, 4, 0.3, 50, '#7a5a3a'); for (let z = -30; z < 16; z += 5) for (const s of [-1, 1]) m.box(10 + s * 1.9, -2, z, 0.3, 2.9, 0.3, '#4a3020');
      m.box(20, 0, -48, 10, 4, 7, '#6a6a60'); m.roof(20, 4, -48, 10, 1.5, 7, '#3a3a40');
      // deniz feneri
      m.cyl(-70, 0, -36, 2.2, 14, 10, '#e8e0d8'); m.cyl(-70, 5, -36, 2.3, 1.6, 10, '#b0302a', 'y', false); m.cyl(-70, 10, -36, 2.3, 1.6, 10, '#b0302a', 'y', false); m.cyl(-70, 14, -36, 1.4, 1.6, 8, '#f8e8a0'); m.cone(-70, 15.6, -36, 1.9, 1.8, 8, '#a02a20');
      for (let k = 0; k < 18; k++) { const x = R.range(-280, 280), z = R.range(-240, -60); if (Math.abs(x + 6) < 30 && z > -140) continue; tree(m, x, z, hf(x, z), R.range(1, 1.6), 'oak', R); }
      const ship = new Mesh(L);
      ship.box(0, 0, 0, 5.2, 2.6, 22, '#2a2a30', '#8a6a44'); ship.box(0, 0, 0, 5.3, 0.5, 22.1, '#8a2a20');
      ship.face([[-2.6, 0, 11], [2.6, 0, 11], [0, 0, 16]], [0, -1, 0], '#2a2a30'); ship.face([[-2.6, 2.6, 11], [0, 2.6, 16], [2.6, 2.6, 11]], [0, 1, 0], '#8a6a44');
      ship.face([[-2.6, 0, 11], [0, 0, 16], [0, 2.6, 16], [-2.6, 2.6, 11]], V.norm([-1, 0, 0.5]), '#2a2a30'); ship.face([[2.6, 0, 11], [2.6, 2.6, 11], [0, 2.6, 16], [0, 0, 16]], V.norm([1, 0, 0.5]), '#2a2a30');
      ship.box(0, 2.6, -2, 3.8, 2.2, 9, '#e8e0d0', '#c8b890'); ship.box(0, 4.8, -1, 2.8, 1.4, 5, '#e8e0d0', '#8a6a44');
      ship.cyl(0, 4.8, 1.5, 0.8, 5, 8, '#1a1a1a', 'y', '#101010'); ship.cyl(0, 4.8, -3.5, 0.8, 5, 8, '#1a1a1a', 'y', '#101010');
      ship.cyl(0, 8.5, 1.5, 0.82, 0.8, 8, '#b0302a', 'y', false); ship.cyl(0, 8.5, -3.5, 0.82, 0.8, 8, '#b0302a', 'y', false);
      ship.box(0, 2.6, 9, 0.2, 9, 0.2, '#5a3a22'); ship.box(0, 2.6, -9.5, 0.2, 8, 0.2, '#5a3a22');
      ship.at(1.2, 2.6, 6.5, 0, () => { for (const sx of [-0.12, 0.12]) ship.box(sx, 0, 0, 0.16, 0.8, 0.18, look.pants); rider(ship, look, 0, 0.8, 0, false); });
      for (let k = 0; k < 6; k++) ship.at(R.range(-1.8, 1.8), 2.6, R.range(-8, 8), 0, () => { const c = R.pick(['#3a3a4a', '#5a3a2a', '#2a3a2a', '#6a5a4a']); ship.box(0, 0, 0, 0.42, 0.7, 0.3, c); ship.box(0, 0.75, 0, 0.26, 0.26, 0.26, R.pick(['#f2d3b3', '#e0b48c'])); });
      const SB = ship.build(gl);
      const S = { L, static: [m.build(gl), wm.build(gl)], sky: { top: '#4a88c8', hor: '#dce8f0', sun: [-0.45, 0.55, -0.7], sunC: '#fffae8', sunR: 0.04 }, fog: '#d0dce4', fogD: 0.0036 };
      const shipPos = (t) => [6 - t * 0.5, 0, 78 - t * 6.2];
      S.dyn = (t, D) => { const [x, y, z] = shipPos(t); D.push([SB, M4.chain(M4.tr(x, y - 1.2 + Math.sin(t * 1.6) * 0.15, z), M4.ry(Math.PI + 0.05), M4.rz(Math.sin(t * 1.2) * 0.03))]); S.focus = [x, 4, z]; };
      S.shots = [
        // omuz üstünden: güvertedeki karakter ve karşıda liman
        { d: 3.4, cam: (t, u) => { const [x, , z] = shipPos(t), px = x - 1.2, pz = z - 6.5; return { e: [px - 3.0 + u * 0.3, 3.8 + Math.sin(t * 1.6) * 0.08, pz + 4.4 - u * 0.6], c: [px + 0.6 - u * 1.5, 2.8, pz - 18] }; } },
        // geniş: geminin yanından yükselerek limanı gösterir
        { d: DUR - 3.4, cam: (t, u) => { const [x, , z] = shipPos(t), k = ease(u); return { e: V.lerp([x + 16, 5, z + 20], [x + 24, 15, z + 4], k), c: V.lerp([x - 2, 4, z - 12], [-12, 5, -70], ease(cl01(u * 1.2))) }; } },
      ];
      S.grade = { lift: [0, 0.01, 0.03], gain: [0.98, 1.0, 1.05], sat: 0.95, con: 1.05 };
      S.cloud = 0.5; S.cloudC = '#ffffff';
      S.particles = (t, add) => {
        const [x, , z] = shipPos(t);
        if (Math.random() < 0.45) for (const fz of [-1.5, 3.5]) add([x + R.range(-0.3, 0.3), 9.6, z + fz], [R.range(-0.2, 0.2), 1.8, 1.4], [0.32, 0.32, 0.34, 0.6], 1.5, 2.6);
        if (Math.random() < 0.08) add([x + R.range(-30, 30), 12 + R.range(0, 6), z - R.range(10, 60)], [R.range(-2, 2), 0.3, R.range(-2, 2)], [0.95, 0.95, 0.95, 1], 0.7, 4);
      };
      return S;
    },

    /* Kanun kaçağı: gün batımı, kızıl çöl, dörtnala Dust Creek'e */
    outlaw(R, look) {
      const L = { dir: V.norm([0.15, 0.22, -1]), amb: 0.45, dif: 0.85, ambC: C('#8a70a0'), sunC: C('#ffb070') };
      const m = new Mesh(L);
      const hf = (x, z) => { const d = Math.sin(x * 0.03 + z * 0.01) * 2.4 + Math.sin(z * 0.045) * 1.2; return d * Math.min(1, Math.abs(x) / 12) * flatW(x, z, -40, 40, -95, 10); };
      m.terrain(-280, -240, 280, 300, 6, hf, (x, z) => Math.abs(x) < 2.6 && z > -50 ? '#b8784a' : hash2(x | 0, z | 0, 5) < 0.5 ? '#d08a52' : '#c07a48');
      for (let k = 0; k < 9; k++) { const s = k % 2 ? 1 : -1; mesa(m, s * R.range(60, 200), R.range(-300, 150), R.range(30, 70), R.range(25, 55), R.range(20, 45), R); }
      for (let k = 0; k < 45; k++) { const x = R.range(-160, 160), z = R.range(-60, 280); if (Math.abs(x) < 8) continue; tree(m, x, z, hf(x, z), R.range(0.8, 1.4), R.chance(0.6) ? 'saguaro' : 'dry', R); }
      for (let k = 0; k < 30; k++) { const x = R.range(-160, 160), z = R.range(-60, 280); if (Math.abs(x) < 6) continue; m.box(x, hf(x, z), z, R.range(0.6, 1.6), R.range(0.4, 1), R.range(0.6, 1.4), '#8a6048'); }
      town(m, R, 0, -64, 4, { street: 6, gable: 0.1, church: false });
      const horse = horseParts(L, '#3a2a1e', look);
      const S = { L, static: [m.build(gl)], sky: { top: '#2e2450', hor: '#f08a42', sun: [0.12, 0.08, -1], sunC: '#ffd070', sunR: 0.075 }, fog: '#d8784a', fogD: 0.0048 };
      const rz = (t) => 116 - t * 13.5;
      S.dyn = (t, D) => { const z = rz(t); drawHorse(D, horse, 0, hf(0, z), z, Math.PI, t * 15, true); S.focus = [0, 2.2, z]; };
      S.shots = [
        // alçak önden: dörtnala gelen atlı, arkasında batan güneş
        { d: 3.2, cam: (t, u) => { const z = rz(t); return { e: [3.6 - u * 1.2, 1.4 + u * 0.3, z - 9 + u * 2], c: [0, 2.1, z + 0.3] }; } },
        // arkadan: atlının ardından ufuktaki kasabaya
        { d: DUR - 3.2, cam: (t, u) => { const z = rz(t), k = ease(u); return { e: V.lerp([-2.2, 2.6, z + 7], [-4, 5.2, z + 13], k), c: V.lerp([0, 2.4, z - 4], [0, 2.8, -28], ease(cl01(u * 1.4))) }; } },
      ];
      S.grade = { lift: [0.06, 0.01, 0.05], gain: [1.12, 0.96, 0.84], sat: 1.15, con: 1.1 };
      S.cloud = 0.34; S.cloudC = '#f0a080';
      S.particles = (t, add) => { const z = rz(t); for (let k = 0; k < 2; k++) add([R.range(-0.6, 0.6), 0.2, z + 1 + R.range(0, 0.6)], [R.range(-1, 1), R.range(0.3, 1.2), R.range(2, 5)], [0.85, 0.55, 0.35, 0.7], 1.2, 1.6); };
      return S;
    },

    /* Demiryolu işçisi: tren Fort Redstone istasyonuna girer */
    rail(R, look) {
      const L = { dir: V.norm([-0.6, 0.55, -0.4]), amb: 0.55, dif: 0.75, ambC: C('#b0c0d8'), sunC: C('#fff0d0') };
      const m = new Mesh(L);
      const hf = (x, z) => (Math.sin(x * 0.02) * Math.cos(z * 0.02) * 4 + Math.sin(x * 0.06) * 0.8) * Math.min(1, Math.abs(x) / 30) * flatW(x, z, -85, 0, -75, 40);
      m.terrain(-280, -200, 280, 320, 6, hf, (x, z) => hash2(x | 0, z | 0, 6) < 0.5 ? '#b0a05a' : '#a0904e');
      for (let z = -120; z < 320; z += 1.2) m.box(0, 0.05, z, 2.8, 0.14, 0.35, '#5a3e26');
      for (const s of [-1, 1]) m.box(s * 0.75, 0.2, 100, 0.12, 0.14, 440, '#8a8a90');
      for (let z = -100; z < 320; z += 24) { m.box(4, 0, z, 0.25, 6, 0.25, '#5a3a22'); m.box(4, 5.4, z, 1.6, 0.15, 0.15, '#5a3a22'); }
      // istasyon
      m.box(-4.5, 0, 0, 4, 0.7, 36, '#7a5a3a'); m.at(-10, 0, 0, Math.PI / 2, () => { m.box(0, 0, 0, 16, 4.2, 7, '#7a6a50'); m.roof(0, 4.2, 0, 16, 1.6, 7, '#3a4a5a', 0.3); m.box(0, 2.5, 5.2, 18, 0.2, 3.4, '#3a4a5a'); m.box(0, 5.6, 3.6, 6, 0.9, 0.1, '#e0e0d0'); });
      town(m, R, -40, -40, 30, { street: 7 });
      for (let k = 0; k < 30; k++) { const x = R.range(-250, 250), z = R.range(-150, 300); if (Math.abs(x) < 12 || (x < -20 && x > -70 && z < 40)) continue; tree(m, x, z, hf(x, z), R.range(0.9, 1.4), R.chance(0.3) ? 'dry' : 'oak', R); }
      for (let k = 0; k < 6; k++) mountain(m, -350 + k * 140, -380, 100, R.range(50, 80), '#9aa0a8', '#eef0f2');
      const loco = new Mesh(L);
      loco.cyl(0, 1.9, -3, 1.05, 6.2, 10, '#2a2a2e', 'z', '#1a1a1a'); loco.box(0, 0.6, 0, 2.2, 0.9, 9, '#1a1a1e');
      loco.box(0, 0.9, -4.6, 2.5, 3.4, 3, '#6a2a22', '#3a1a16'); loco.box(0, 4.3, -4.6, 2.8, 0.2, 3.4, '#2a2a2e');
      loco.cyl(0, 2.8, 2.2, 0.35, 2.1, 8, '#2a2a2e'); loco.cone(0, 4.9, 2.2, 0.75, -0.9, 8, '#2a2a2e'); loco.box(0, 4.7, 2.2, 1.4, 0.3, 1.4, '#2a2a2e');
      loco.cyl(0, 2.9, -0.8, 0.5, 0.9, 8, '#c8a040'); loco.box(0, 2.3, 3.4, 0.6, 0.6, 0.3, '#e8e0a0');
      loco.face([[-1.2, 0.2, 4.5], [1.2, 0.2, 4.5], [0, 0.2, 6]], [0, -1, 0], '#8a2a20'); loco.face([[-1.2, 0.2, 4.5], [0, 0.2, 6], [0, 1.4, 4.6]], V.norm([-1, 0.5, 1]), '#8a2a20'); loco.face([[1.2, 0.2, 4.5], [0, 1.4, 4.6], [0, 0.2, 6]], V.norm([1, 0.5, 1]), '#8a2a20');
      for (const z of [-3, -0.8, 1.4]) for (const s of [-1, 1]) loco.cyl(s * 1.1 - (s < 0 ? 0.2 : 0), 0.75, z, 0.72, 0.2, 10, '#8a2a20', 'x', '#3a1a16');
      const car = new Mesh(L);
      car.box(0, 0.8, 0, 2.6, 2.6, 11, '#6a3a22', '#3a2a22'); car.roof(0, 3.4, 0, 2.6, 0.5, 11, '#3a2a22', 0.15);
      for (let z = -4; z <= 4; z += 1.6) for (const s of [-1, 1]) car.box(s * 1.31, 2.1, z, 0.05, 0.7, 0.9, '#e8d890');
      for (const z of [-3.5, 3.5]) for (const s of [-1, 1]) car.cyl(s * 1.1 - (s < 0 ? 0.2 : 0), 0.45, z, 0.45, 0.2, 8, '#2a2a2e', 'x');
      const tender = new Mesh(L); tender.box(0, 0.6, 0, 2.4, 2.2, 4.5, '#2a2a2e'); tender.box(0, 2.8, 0, 2.2, 0.5, 4.2, '#1a1410');
      const LB = loco.build(gl), CB = car.build(gl), TB = tender.build(gl);
      const S = { L, static: [m.build(gl)], sky: { top: '#5a8ec8', hor: '#e8e0c8', sun: [-0.5, 0.45, -0.6], sunC: '#fff4d8', sunR: 0.045 }, fog: '#e0d8c0', fogD: 0.004 };
      const tz = (t) => { const k = Math.min(1, t / DUR); return 150 - (1 - (1 - k) * (1 - k)) * 138; };
      S.dyn = (t, D) => {
        const z = tz(t); const y = 0.2;
        D.push([blob, M4.chain(M4.tr(0, 0.3, z + 18), [1.7, 0, 0, 0, 0, 1, 0, 0, 0, 0, 26, 0, 0, 0, 0, 1]), 0.25]);
        D.push([LB, M4.chain(M4.tr(0, y, z), M4.ry(Math.PI))]);
        D.push([TB, M4.tr(0, y, z + 8.2)]);
        for (let k = 0; k < 3; k++) D.push([CB, M4.tr(0, y, z + 15.5 + k * 12)]);
        S.focus = [0, 2.5, z];
      };
      S.shots = [
        // ray hizasından: lokomotif üstümüze doğru gelir, duman yükselir
        { d: 3.3, cam: (t, u) => { const z = tz(t); return { e: [-2.4, 1.0 + u * 0.4, 62 - u * 3], c: [0, 2.4, z] }; } },
        // peron: tren istasyona girerken kasabaya döner
        { d: DUR - 3.3, cam: (t, u) => { const z = tz(t), k = ease(u); return { e: V.lerp([9, 2.6, 52], [7, 6, 30], k), c: V.lerp([0, 2.6, z], [-14, 3, -4], ease(cl01((u - 0.25) * 1.5))) }; } },
      ];
      S.grade = { lift: [0.02, 0.02, 0.02], gain: [1.05, 1.0, 0.94], sat: 1.0, con: 1.06 };
      S.cloud = 0.45; S.cloudC = '#ffffff';
      S.particles = (t, add) => { const z = tz(t); if (Math.random() < 0.4) add([R.range(-0.2, 0.2), 5.2, z - 2.2], [R.range(-0.4, 0.4), 2.6, 2 + (1 - t / DUR) * 5], [0.82, 0.82, 0.8, 0.6], 1.3, 2.4); };
      return S;
    },

    /* Tuzakçı: sisli çam ormanı, dağlar, Cedar Falls'a iniş */
    trapper(R, look) {
      const L = { dir: V.norm([0.4, 0.5, -0.5]), amb: 0.62, dif: 0.55, ambC: C('#a8b8c8'), sunC: C('#f0f0e8') };
      const m = new Mesh(L);
      const hf = (x, z) => { const hill = Math.sin(x * 0.025) * 6 + Math.cos(z * 0.02) * 4 + Math.sin(x * 0.07 + z * 0.05) * 1.5; const trail = Math.min(1, Math.abs(x - Math.sin(z * 0.03) * 4) / 9); return hill * trail * flatW(x, z, -40, 45, -115, -20, 35); };
      const tx = (z) => Math.sin(z * 0.03) * 4;
      m.terrain(-240, -220, 240, 280, 5, hf, (x, z) => Math.abs(x - tx(z)) < 2.2 && z > -40 ? '#7a6a4a' : hash2(x | 0, z | 0, 7) < 0.5 ? '#4a6a3a' : '#3e5e34');
      for (let k = 0; k < 170; k++) { const x = R.range(-200, 200), z = R.range(-40, 270); if (Math.abs(x - tx(z)) < 6) continue; tree(m, x, z, hf(x, z), R.range(1.1, 2.1), 'pine', R); }
      for (let k = 0; k < 7; k++) mountain(m, -380 + k * 130, -300 - R.range(0, 80), R.range(90, 130), R.range(90, 130), '#6a7a88', '#eef2f6');
      town(m, R, 0, -90, -34, { street: 7, gable: 0.7, tower: false });
      m.at(26, 0, -60, 0, () => { m.box(0, 0, 0, 14, 6, 9, '#8a6a40'); m.roof(0, 6, 0, 14, 2.2, 9, '#4a3a22'); for (let k = 0; k < 5; k++) m.cyl(-9, 0.5 + k * 0.9, -3 + (k % 2) * 0.4, 0.45, 7, 7, '#7a5234', 'z', '#b08a5a'); });
      m.box(0, -0.8, 30, 90, 0.6, 7, '#4a7a90'); m.box(tx(30), 0.3, 30, 4, 0.3, 9, '#6a4a2a');
      const horse = horseParts(L, '#5a3b28', look);
      const S = { L, static: [m.build(gl)], sky: { top: '#7a8ea4', hor: '#d4dcdc', sun: [0.35, 0.4, -0.8], sunC: '#f4f4ec', sunR: 0.035 }, fog: '#c8d2d4', fogD: 0.0075, fogH: 6 };
      const pz = (t) => 78 - t * 4.4;
      S.dyn = (t, D) => { const z = pz(t), x = tx(z); drawHorse(D, horse, x, hf(x, z), z, Math.PI - Math.cos(z * 0.03) * 0.12, t * 6.5, false); S.focus = [x, 2, z]; };
      S.shots = [
        // ağaçların arasından yan: atlı sisli patikada ilerler
        { d: 3.4, cam: (t, u) => { const z = pz(t), x = tx(z); return { e: [x + 6.8 - u * 1.2, 2.6, z - 5.5 - u * 1.5], c: [x, 2.3, z + 0.2] }; } },
        // yükselen geniş: ormanın üstünden vadideki kasaba
        { d: DUR - 3.4, cam: (t, u) => { const z = pz(t), x = tx(z), k = ease(u); return { e: V.lerp([x + 1.2, 3, z + 7], [x - 6, 22, z + 22], k), c: V.lerp([x, 2.2, z - 6], [0, 2, -60], ease(cl01(u * 1.2))) }; } },
      ];
      S.grade = { lift: [0.03, 0.045, 0.05], gain: [0.95, 1.0, 1.02], sat: 0.86, con: 0.98 };
      S.cloud = 0.72; S.cloudC = '#c8d0d4';
      S.particles = (t, add) => { if (Math.random() < 0.5) add([R.range(-40, 40), R.range(4, 20), pz(t) - R.range(0, 60)], [R.range(-0.5, 0.5), -0.6, 0], [1, 1, 1, 0.9], 0.18, 6); };
      return S;
    },
  };

  /* ---------------- Oynatıcı ---------------- */
  let el = null;
  function overlay() {
    if (el) return el;
    el = document.createElement('div');
    el.id = 'cinema';
    el.innerHTML = `<div class="cn-frame"><canvas width="${RW}" height="${RH}"></canvas><div class="cn-bar t"></div><div class="cn-bar b"></div>
      <div class="cn-cap"><div class="cn-k"></div><div class="cn-n"></div><div class="cn-s"></div></div><div class="cn-fade"></div></div><div class="cn-skip"></div>`;
    document.body.appendChild(el);
    return el;
  }
  function fit() {
    const f = el.querySelector('.cn-frame'), sc = Math.min(innerWidth / RW, innerHeight / RH);
    f.style.width = Math.round(RW * sc) + 'px'; f.style.height = Math.round(RH * sc) + 'px';
  }
  const CAPS = {
    farm: [Tr('Harlow Ovaları'), Tr('Bir araba dolusu umutla...')], immigrant: [Tr('Saint Clement Limanı'), Tr('Yeni bir dünya, yeni bir hayat.')],
    outlaw: [Tr('Dust Creek'), Tr('Geçmişinden kaçılmaz. Ama denenebilir.')], rail: [Tr('Fort Redstone'), Tr('Rayların sonu, hikâyenin başı.')], trapper: [Tr('Cedar Falls'), Tr('Ormanın sesi arkada kaldı.')],
  };

  function play(bgId, opts = {}) {
    return new Promise((resolve) => {
      const mk = SCENES[bgId];
      if (!mk) { resolve(); return; }
      overlay(); fit();
      const cv = el.querySelector('canvas');
      try { if (!gl && !init(cv)) { resolve(); return; } } catch (e) { console.warn('Sinematik başlatılamadı', e); resolve(); return; }
      let S;
      try { S = mk(new RNG(opts.seed || 1890), opts.look || randomLook('m')); } catch (e) { console.warn(e); resolve(); return; }
      const town = TOWNS.find(t => t.id === (BACKGROUNDS.find(b => b.id === bgId) || {}).town);
      const cap = CAPS[bgId] || ['', ''];
      el.querySelector('.cn-k').textContent = Tr`Amerika, ${START_YEAR}`;
      el.querySelector('.cn-n').textContent = town ? town.n : cap[0];
      el.querySelector('.cn-s').textContent = cap[1];
      el.querySelector('.cn-skip').innerHTML = Tr`${Input.glyph('confirm')} Geç`;
      el.classList.remove('out'); el.classList.add('on');
      const fd = el.querySelector('.cn-fade'); fd.style.animation = 'none'; void fd.offsetWidth; fd.style.animation = '';
      const parts = [];
      const addP = (p, v, col, size, life) => { if (parts.length < 900) parts.push({ p: p.slice(), v, col, size, life, max: life }); };
      let t0 = performance.now(), last = t0, done = false, raf = 0;
      const finish = () => {
        if (done) return; done = true;
        cancelAnimationFrame(raf);
        window.removeEventListener('keydown', skip, true); window.removeEventListener('pointerdown', skip, true);
        el.classList.add('out');
        resolve();
        setTimeout(() => { el.classList.remove('on', 'out'); }, 700);
      };
      const skip = (e) => { if (performance.now() - t0 > 400) { if (e) { e.preventDefault(); e.stopImmediatePropagation(); } finish(); } };
      window.addEventListener('keydown', skip, true); window.addEventListener('pointerdown', skip, true);
      const sky = S.sky;
      // çekimler: sahne tek bir S.cam veriyorsa tek çekim sayılır
      const shots = S.shots || [{ d: DUR, cam: (t) => S.cam(t) }];
      const total = shots.reduce((a, sh) => a + sh.d, 0);
      const cut1 = shots.length > 1 ? shots[0].d : 0;
      const shotAt = (t) => { let a = 0; for (const sh of shots) { if (t < a + sh.d || sh === shots[shots.length - 1]) return sh.cam(t, cl01((t - a) / sh.d)); a += sh.d; } };
      const G = Object.assign({ lift: [0, 0, 0], gain: [1, 1, 1], sat: 1, con: 1 }, S.grade || {});
      fd.style.animationDuration = total + 's';
      const frame = (now) => {
        if (done) return;
        // opts.freeze: zamanı sabitler (kapak karesi ve testler için)
        const t = opts.freeze !== undefined ? opts.freeze : (now - t0) / 1000, dt = Math.min(0.05, (now - last) / 1000); last = now;
        if ((t > total && opts.freeze === undefined) || (Input.pad && (Input.padTap(PS.X) || Input.padTap(PS.O) || Input.padTap(PS.OPT)) && t > 0.4)) { finish(); return; }
        // başlık ikinci çekimde (geniş açı) belirir
        el.querySelector('.cn-cap').style.opacity = clamp((t - cut1 - 0.5) * 1.4, 0, 1) * clamp((total - t) * 2, 0, 1);
        const D = [];
        S.dyn(t, D);
        const cam = shotAt(t);
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
        // sahne: önce opak parçalar, sonra yarı saydam gölgeler
        gl.enable(gl.DEPTH_TEST);
        gl.useProgram(P.p);
        gl.uniformMatrix4fv(P.u.uVP, false, VP); gl.uniform3fv(P.u.uCam, cam.e); gl.uniform3fv(P.u.uFog, C(S.fog)); gl.uniform1f(P.u.uFogD, S.fogD); gl.uniform1f(P.u.uFogH, S.fogH || 0);
        const aP = P.a('aP'), aC = P.a('aC');
        gl.enableVertexAttribArray(aP); gl.enableVertexAttribArray(aC);
        const I = M4.id();
        const draw = (o, mm, al) => { gl.bindBuffer(gl.ARRAY_BUFFER, o.buf); gl.vertexAttribPointer(aP, 3, gl.FLOAT, false, 24, 0); gl.vertexAttribPointer(aC, 3, gl.FLOAT, false, 24, 12); gl.uniformMatrix4fv(P.u.uM, false, mm); gl.uniform1f(P.u.uA, al === undefined ? 1 : al); gl.drawArrays(gl.TRIANGLES, 0, o.n); };
        for (const o of S.static) draw(o, I);
        for (const [o, mm, al] of D) if (al === undefined) draw(o, mm);
        gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
        for (const [o, mm, al] of D) if (al !== undefined) draw(o, mm, al);
        gl.disable(gl.BLEND); gl.depthMask(true);
        gl.disableVertexAttribArray(aP); gl.disableVertexAttribArray(aC);
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
          const cutDip = cut1 ? 1 - 0.85 * Math.max(0, 1 - Math.abs(t - cut1) / 0.12) : 1;
          gl.uniform1f(QP.u.uTime, t); gl.uniform1f(QP.u.uFade, cutDip);
          gl.bindBuffer(gl.ARRAY_BUFFER, skyBuf);
          const qa = QP.a('aP'); gl.enableVertexAttribArray(qa); gl.vertexAttribPointer(qa, 2, gl.FLOAT, false, 0, 0);
          gl.drawArrays(gl.TRIANGLES, 0, 3);
          gl.disableVertexAttribArray(qa);
          gl.enable(gl.DEPTH_TEST);
        }
        raf = requestAnimationFrame(frame);
      };
      raf = requestAnimationFrame(frame);
    });
  }
  return { play, RW, RH, DUR };
})();
