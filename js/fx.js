'use strict';
/* ==========================================================
   DUSTBOUND — görsel efektler
   Rüzgâr, bulut gölgeleri, baca/kamp dumanı, ayak/toynak izleri,
   yüzeye göre isabet efektleri, salınan bitki örtüsü, sonbahar
   yaprakları, su halkaları ve kıyı köpüğü, soğukta nefes buharı,
   renk derecelendirme ve durum efektleri (düşük sağlık, sarhoşluk,
   ayaz, Dead Eye).
   Ayarlar > Efektler: 0 = Tam, 1 = Sade (salınım/bulut/yaprak kapalı)
   ========================================================== */

/* Rüzgârda salınan, dinamik çizilen küçük bitkiler: tür → [salınım genliği, taban ofseti] */
const SWAY_O = { [O.TUFT]: [1, 2], [O.REED]: [1, 3], [O.FLOWERS]: [0.6, 1], [O.CROP]: [0.75, 5], [O.BUSH]: [0.32, 3] };
/* İz tutan yumuşak zeminler: tile → iz rengi (rgb) */
const TRACK_C = { [T.SAND]: '96,70,40', [T.DESERT]: '110,66,34', [T.MUD]: '40,28,16', [T.SNOW]: '84,104,136' };
const SNOW_TRACK = '84,104,136';
/* Mermi isabetinde kalkan toz rengi */
const DUST_C = { [T.SAND]: '214,190,140', [T.DESERT]: '206,160,108', [T.DRY]: '180,154,110', [T.REDROCK]: '176,104,70', [T.MESA]: '176,104,70', [T.SNOW]: '240,244,250', [T.MUD]: '96,76,52', [T.SWAMP]: '96,90,60', [T.FARM]: '130,100,66', [T.ROAD]: '170,146,108', [T.TOWN]: '168,142,104' };
const LEAF_C = ['#b86a24', '#c89032', '#9a4a1e', '#d0a040', '#a85a20'];

const FX = {
  wind: { a: 0.3, s: 0.25, x: 0.25, y: 0, gust: 0, gustT: 5, gustTo: 0 },
  tracks: [], smoke: [], leaves: [], ripples: [], srcs: [], movers: [], scratches: [],
  cloudOff: { x: 0, y: 0 },
  g: { gold: 0, blue: 0, desert: 0, rain: 0, cold: 0, swamp: 0, hurt: 0, drunk: 0, frost: 0, de: 0 },
  temp: 20, tempT: 0, hb: 0, dub: false, grainT: 0, grainI: 0, drunkCss: false,

  get full() { return !G.settings.fxq; },
  /* Chunk'a gömülmeyip her karede salınarak çizilen nesne mi? */
  dyn(o) { return !G.settings.fxq && SWAY_O[o] !== undefined; },

  init() {
    // yumuşak bulut gölgesi dokusu: gauss lekelerinin toplamı, kenarlara doğru sıfıra iner
    const CW = 160, CH = 104, c = this.cloudTex = makeCanvas(CW, CH), cc = c.getContext('2d');
    const img = cc.createImageData(CW, CH), dd = img.data, R = mulberry32(7), blobs = [];
    for (let i = 0; i < 8; i++) blobs.push([CW * (0.3 + R() * 0.4), CH * (0.32 + R() * 0.36), 14 + R() * 16]);
    for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) {
      let v = 0;
      for (const [bx, by, r] of blobs) { const dx = (x - bx) / r, dy = (y - by) / r; v += Math.exp(-(dx * dx + dy * dy)); }
      const ex = Math.min(x, CW - 1 - x) / (CW * 0.2), ey = Math.min(y, CH - 1 - y) / (CH * 0.2);
      v = Math.min(1, v * 0.8) * Math.min(1, ex) * Math.min(1, ey);
      const i = (y * CW + x) * 4;
      dd[i] = 16; dd[i + 1] = 20; dd[i + 2] = 36; dd[i + 3] = v * v * (3 - 2 * v) * 255;
    }
    cc.putImageData(img, 0, 0);
    // vinyet dokuları
    const vig = (col0, col1, inner) => {
      const v = makeCanvas(128, 128), vc = v.getContext('2d');
      const gr = vc.createRadialGradient(64, 64, 64 * inner, 64, 64, 91);
      gr.addColorStop(0, col0); gr.addColorStop(1, col1);
      vc.fillStyle = gr; vc.fillRect(0, 0, 128, 128);
      return v;
    };
    this.vigRed = vig('rgba(120,0,0,0)', 'rgba(110,4,0,0.95)', 0.42);
    this.vigDark = vig('rgba(20,10,0,0)', 'rgba(20,10,0,0.9)', 0.35);
    // film greni
    this.grain = [];
    for (let k = 0; k < 4; k++) {
      const n = makeCanvas(96, 96), nc = n.getContext('2d'), img = nc.createImageData(96, 96), d = img.data;
      for (let i = 0; i < d.length; i += 4) {
        const r = Math.random();
        if (r < 0.2) { d[i] = d[i + 1] = d[i + 2] = 255; d[i + 3] = 40 + Math.random() * 70; }
        else if (r < 0.42) { d[i] = d[i + 1] = d[i + 2] = 0; d[i + 3] = 50 + Math.random() * 90; }
      }
      nc.putImageData(img, 0, 0);
      this.grain.push(n);
    }
    this.frostC = null;
  },
  reset() {
    this.tracks.length = 0; this.smoke.length = 0; this.leaves.length = 0; this.ripples.length = 0; this.srcs.length = 0; this.scratches.length = 0;
    for (const k in this.g) this.g[k] = 0;
    this.gradeInit = false;
  },

  /* ---------------- Güncelleme ---------------- */
  update(dt, rdt) {
    const P = G.player, W = G.world;
    if (!P || !W) return;
    const w = this.wind, Wt = G.weather || {};
    // rüzgâr: yavaşça dönen yön + hava durumuna bağlı güç + ara sıra esinti
    w.gustT -= dt;
    if (w.gustT <= 0) { w.gustT = rnd(4, 12); w.gustTo = rnd(0.1, 0.45); }
    w.gustTo = Math.max(0, w.gustTo - dt * 0.12);
    w.gust = lerp(w.gust, w.gustTo, Math.min(1, dt * 1.5));
    w.a = 0.25 + Math.sin(G.t * 0.011) * 0.9 + Math.sin(G.t * 0.043) * 0.2;
    w.s = 0.18 + (Wt.i || 0) * 0.45 + (Wt.type === 'storm' ? 0.35 : 0) + w.gust;
    w.x = Math.cos(w.a) * w.s; w.y = Math.sin(w.a) * w.s * 0.5;
    const cs = 9 + w.s * 16;
    this.cloudOff.x += Math.cos(w.a) * cs * dt; this.cloudOff.y += Math.sin(w.a) * cs * 0.5 * dt;
    // sıcaklık (nefes buharı ve ayaz için)
    this.tempT -= rdt;
    if (this.tempT <= 0) { this.tempT = 0.5; this.temp = G.ambientTemp(P.x, P.y); }
    const x0 = G.cam.ox - 30, y0 = G.cam.oy - 30, x1 = x0 + G.vw + 60, y1 = y0 + G.vh + 60;
    const inView = e => e.x > x0 && e.x < x1 && e.y > y0 && e.y < y1;
    // hareket edenler: izler, su halkaları, nefes
    const cold = clamp((5 - this.temp) / 7, 0, 1);
    const env = G.envCache || {};
    for (const e of G.ents) {
      if (e.dead || e.remove || !inView(e)) continue;
      if (e === P) { if (!P.riding) this.mover(e, 'foot', dt, cold); }
      else if (e.kind === 'horse') this.mover(e, 'hoof', dt, cold);
      else if (e.kind === 'npc') this.mover(e, 'foot', dt, cold);
      else if (e.kind === 'animal' && e.r >= 5) this.mover(e, 'paw', dt, 0);
    }
    if (!G.ents.includes(P) && !P.riding) this.mover(P, 'foot', dt, cold);
    if (P.riding && !G.ents.includes(P.riding)) this.mover(P.riding, 'hoof', dt, cold);
    // izler solar
    for (let i = this.tracks.length - 1; i >= 0; i--) { const t = this.tracks[i]; t.life -= dt; if (t.life <= 0) this.tracks.splice(i, 1); }
    // yağmur damlası halkaları (su yüzeyinde)
    if (env.rain > 0.1 && !G.insideB) {
      let n = env.rain * dt * (this.full ? 150 : 60);
      while (n > 0) {
        if (n >= 1 || Math.random() < n) {
          const x = x0 + Math.random() * (x1 - x0), y = y0 + Math.random() * (y1 - y0);
          if (W.isWaterPx(x, y) && !(W.flags[(y >> 4) * WW + (x >> 4)] & 2)) this.ripple(x, y, 0.5, 3.2, 0.6);
        }
        n -= 1;
      }
    }
    for (let i = this.ripples.length - 1; i >= 0; i--) { const r = this.ripples[i]; r.life -= dt; if (r.life <= 0) this.ripples.splice(i, 1); }
    // duman kaynakları (kamp ateşleri) + bacalar
    const srcs = this.srcs;
    for (let i = 0; i < srcs.length; i += 2) this.fireSmoke(srcs[i], srcs[i + 1], dt);
    srcs.length = 0;
    this.chimneys(dt, x0 - 40, y0 - 30, x1 + 40, y1 + 140);
    const S = this.smoke, wx = w.x * 18, wy = w.y * 10;
    for (let i = S.length - 1; i >= 0; i--) {
      const p = S[i];
      p.life -= dt;
      if (p.life <= 0) { S[i] = S[S.length - 1]; S.pop(); continue; }
      const age = 1 - p.life / p.max;
      p.x += (p.vx + wx * (0.3 + age)) * dt; p.y += (p.vy + wy * age) * dt;
      p.vy *= 1 - dt * 0.25; p.vx *= 1 - dt * 0.5;
      p.s += p.g * dt;
    }
    // sonbahar yaprakları
    const L = this.leaves;
    for (let i = L.length - 1; i >= 0; i--) {
      const q = L[i];
      if (q.z > 0) {
        q.ph += dt * q.fs;
        q.z -= q.vz * dt;
        q.x += (w.x * 22 + Math.sin(q.ph) * 7) * dt; q.y += (w.y * 12 + Math.cos(q.ph * 0.7) * 2) * dt;
        if (q.z <= 0) { q.z = 0; if (W.isWaterPx(q.x, q.y)) { this.ripple(q.x, q.y, 0.3, 2, 0.5); q.life = 0; } }
      } else q.life -= dt;
      if (q.life <= 0 || q.x < x0 - 200 || q.x > x1 + 200 || q.y < y0 - 200 || q.y > y1 + 200) L.splice(i, 1);
    }
    // ekran kaydırma çizikleri (Dead Eye)
    for (let i = this.scratches.length - 1; i >= 0; i--) { this.scratches[i].t -= rdt; if (this.scratches[i].t <= 0) this.scratches.splice(i, 1); }
  },
  /* Bir varlığın adımları: iz bırak, suda halka, soğukta nefes */
  mover(e, kind, dt, cold) {
    const W = G.world;
    const k = e._fx || (e._fx = { x: e.x, y: e.y, s: 1, rp: 0, br: Math.random() * 2, mx: e.x, my: e.y });
    const dx = e.x - k.mx, dy = e.y - k.my, moved = dx * dx + dy * dy > 0.01 * dt * 60;
    const spd = Math.hypot(dx, dy) / Math.max(dt, 1e-4);
    k.mx = e.x; k.my = e.y;
    // su halkaları
    if (W.isWaterPx(e.x, e.y) && !(W.flags[(e.y >> 4) * WW + (e.x >> 4)] & 2)) {
      k.rp -= dt;
      if (k.rp <= 0) {
        const big = kind === 'hoof';
        k.rp = moved ? (big ? 0.2 : 0.28) : 1.4;
        this.ripple(e.x + rnd(-1, 1), e.y + (big ? 2 : 1), 2, moved ? (big ? 13 : 9) : 7, moved ? 1 : 1.5);
        if (moved && spd > 50 && Math.random() < 0.6) G.parts.add('splash', e.x + rnd(-3, 3), e.y + rnd(-2, 2), 0, 0, 0.35, 2);
      }
    } else if (this.full) this.trackStep(e, k, kind);
    // nefes buharı
    if (cold > 0 && !W.indoorPx(e.x, e.y) && !(e === G.player && G.insideB)) {
      k.br -= dt * (spd > 70 ? 2 : 1);
      if (k.br <= 0) {
        k.br = rnd(2.1, 2.9);
        if (Math.random() < cold) this.breath(e, kind === 'hoof');
      }
    }
  },
  trackStep(e, k, kind) {
    const sp = kind === 'hoof' ? 11 : kind === 'paw' ? 8 : 7;
    const dx = e.x - k.x, dy = e.y - k.y, d2 = dx * dx + dy * dy;
    if (d2 < sp * sp) return;
    k.x = e.x; k.y = e.y;
    if (d2 > 50 * 50) return;   // ışınlanma / yeniden doğma
    k.s = -k.s;
    const c = this.softAt(e.x, e.y);
    if (!c) return;
    const a = Math.atan2(dy, dx), nx = -Math.sin(a), ny = Math.cos(a);
    const off = kind === 'hoof' ? 2.6 : 1.3, fwd = kind === 'hoof' ? (k.s > 0 ? 4 : -4) : 0;
    this.addTrack(e.x + nx * off * k.s + Math.cos(a) * fwd, e.y + ny * off * k.s + Math.sin(a) * fwd + 1, a, kind, c);
  },
  softAt(x, y) {
    const W = G.world, tx = x >> 4, ty = y >> 4;
    if (!W.inb(tx, ty)) return null;
    const i = ty * WW + tx;
    if (W.flags[i] & (4 | 8 | 16 | 2)) return null;   // kasaba sokakları, binalar, raylar: iz yok (kalabalık görünmesin)
    const t = W.tile[i];
    if (W.season === 3 && SNOWABLE[t] && W.snowyTile(tx, ty)) return SNOW_TRACK;
    return TRACK_C[t] || null;
  },
  addTrack(x, y, a, kind, c) {
    const T_ = this.tracks;
    if (T_.length >= 72) T_.shift();
    T_.push({ x, y, a, kind, c, life: 34, snow: c === SNOW_TRACK });
  },
  ripple(x, y, r0, r1, life) {
    if (this.ripples.length >= 90) this.ripples.shift();
    this.ripples.push({ x, y, r0, r1, life, max: life });
  },
  breath(e, horse) {
    const a = horse ? e.ang : (e.ang || 0);
    const d = horse ? 15 : 4;
    const x = e.x + Math.cos(a) * d, y = e.y + Math.sin(a) * d * 0.8 - (horse ? 1 : 2);
    const n = horse ? 3 : 2;
    for (let i = 0; i < n; i++) {
      const p = G.parts.add('breath', x + rnd(-0.6, 0.6), y + rnd(-0.6, 0.6), Math.cos(a) * rnd(7, 13), Math.sin(a) * rnd(4, 8) - 2, rnd(0.9, 1.4), horse ? 1.2 : 0.8);
      if (p) p.life -= i * 0.12;
    }
  },
  /* Kamp ateşi duman sütunu (render/Prop tarafından her karede kaydedilir) */
  fireSource(x, y) { if (this.srcs.length < 48) this.srcs.push(x, y); },
  fireSmoke(x, y, dt) {
    const rate = this.full ? 6 : 3;
    if (Math.random() < rate * dt) this.puff(x + rnd(-1.5, 1.5), y - 5, rnd(-2, 2), rnd(-13, -10), 1.2, rnd(2.6, 3.4), rnd(3.2, 4.4), 0.32, '176,170,164');
  },
  puff(x, y, vx, vy, s, g, life, a, col) {
    if (this.smoke.length >= 320) return;
    this.smoke.push({ x, y, vx, vy, s, g, life, max: life, a, col });
  },
  /* Bacalar: sabah ve akşam, soğukta her zaman tüter */
  chimneys(dt, x0, y0, x1, y1) {
    const W = G.world, h = G.hour, IB = G.insideB;
    const morning = h >= 5.5 && h < 10, evening = h >= 17 && h < 23;
    const coldK = this.temp < 8;
    const rate = this.full ? 2.6 : 1.3;
    for (const b of W.buildings) {
      const X = b.x * TS, Y = b.y * TS;
      if (X > x1 || X + b.w * TS < x0 || Y > y1 || Y < y0) continue;
      if (b.def.ruin || b.type === 'station' || b === IB) continue;
      const hh = hash2(b.x, b.y, 5);
      if (hh <= 0.3) continue;
      const k = hash2(b.x, b.y, 11);
      const on = coldK ? k < 0.9 : (morning || evening) ? k < 0.72 : h >= 23 || h < 5.5 ? k < 0.15 : k < 0.3;
      if (!on || Math.random() > rate * dt) continue;
      const cx = X + b.w * TS * (0.2 + hh * 0.5) + 2.5, cy = Y - 7;
      this.puff(cx + rnd(-0.8, 0.8), cy, rnd(-1.5, 1.5), rnd(-8, -6), 1.3, rnd(1.9, 2.5), rnd(3.2, 4.2), 0.34, '212,208,204');
    }
  },
  /* Sonbaharda ağaçtan kopan yaprak (render döngüsünden) */
  leafTree(x, y, h) {
    if (this.leaves.length >= 60 || Math.random() > 0.0035 * (1 + this.wind.gust * 3)) return;
    this.leaves.push({ x: x + rnd(-7, 7), y: y + rnd(-2, 6), z: rnd(10, 18), vz: rnd(4, 7), ph: Math.random() * TAU, fs: rnd(3, 5), c: LEAF_C[(h * 5) | 0], life: rnd(5, 8) });
  },

  /* ---------------- Silah efektleri ---------------- */
  /* Mermi isabeti: yüzeye göre su sıçraması, kıymık, kıvılcım ya da toz */
  impact(x, y, ang) {
    const W = G.world, tx = x >> 4, ty = y >> 4, P = G.parts;
    if (!W.inb(tx, ty)) return;
    const i = ty * WW + tx, t = W.tile[i], o = W.obj[i];
    const bx = -Math.cos(ang), by = -Math.sin(ang);
    const chip = (col, n, sp, up) => { for (let k = 0; k < n; k++) { const p = P.add('chip', x, y, bx * rnd(4, sp) + rnd(-12, 12), by * rnd(4, sp) + rnd(-12, 12), rnd(0.8, 1.6), Math.random() < 0.3 ? 1.4 : 1, col); if (p) p.vz = rnd(up * 0.5, up); } };
    const dust = (col, n, s) => { for (let k = 0; k < n; k++) P.add('dust', x + rnd(-1, 1), y + rnd(-1, 1), bx * rnd(4, 14) + rnd(-5, 5), by * rnd(4, 14) + rnd(-8, 2), rnd(0.6, 1), s, col); };
    if (isWaterT(t) && !(W.flags[i] & 2) && t !== T.BRIDGE) {
      P.add('splash', x, y, 0, 0, 0.5, 3); this.ripple(x, y, 1, 7, 0.9);
      for (let k = 0; k < 5; k++) { const p = P.add('drop', x, y, rnd(-14, 14), rnd(-8, 8), 1, 1); if (p) p.vz = rnd(40, 80); }
      return;
    }
    const wood = (W.flags[i] & 8) || t === T.BRIDGE || t === T.PLANK || o === O.CRATE || o === O.BARREL || o === O.WAGON || o === O.FENCEH || o === O.FENCEV ||
      o === O.PINE || o === O.OAK || o === O.BIRCH || o === O.APPLE || o === O.CYPRESS || o === O.DEAD || o === O.SNOWPINE || o === O.SEQUOIA;
    if (wood) { chip(Math.random() < 0.5 ? '#a07a4a' : '#6e4e2e', 4, 30, 50); dust('150,124,92', 1, 1.2); return; }
    const rock = isCliffT(t) || t === T.ROCK || o === O.BOULDER || o === O.ROCK || o === O.ORE || o === O.RUINWALL;
    if (rock) {
      for (let k = 0; k < 3; k++) P.add('spark', x, y, bx * rnd(20, 60) + rnd(-25, 25), by * rnd(20, 60) + rnd(-25, 25), 0.18, 1);
      chip('#8a847c', 2, 24, 40); dust('160,154,146', 2, 1.3);
      return;
    }
    const snow = W.season === 3 && SNOWABLE[t] && W.snowyTile(tx, ty);
    const c = snow ? '240,244,250' : DUST_C[t] || '124,104,72';
    // toz zeminden bir ton açık, parçalar koyu: aynı renkte kalıp kaybolmasınlar
    const lt = snow ? c : c.split(',').map(v => Math.min(255, v * 1.12 + 18) | 0).join(','), dk = c.split(',').map(v => v * 0.6 | 0).join(',');
    dust(lt, snow ? 3 : 3, 1.5);
    chip(snow ? '#e8eef4' : t === T.GRASS || t === T.FOREST ? (Math.random() < 0.5 ? '#4e6a30' : '#6a5a3e') : `rgb(${dk})`, 3, 22, 45);
  },
  /* Namlu dumanı: birkaç puf, rüzgârla sürüklenir */
  gunSmoke(x, y, a, long) {
    const n = long ? 4 : 3;
    for (let i = 0; i < n; i++) {
      const d = 1 + i * 2.5, s = rnd(6, 16) * (1 - i * 0.15);
      G.parts.add('smoke', x + Math.cos(a) * d, y + Math.sin(a) * d, Math.cos(a) * s + rnd(-3, 3), Math.sin(a) * s + rnd(-3, 3), rnd(1.3, 2.1), 1.3 + i * 0.3, '222,218,210');
    }
  },
  /* Boş kovan: sağ yana fırlar, zıplar, yerde bir süre kalır */
  casing(x, y, a, shell) {
    const side = a + Math.PI / 2 + rnd(-0.3, 0.3), s = rnd(22, 36);
    const p = G.parts.add('casing', x, y, Math.cos(side) * s - Math.cos(a) * 5, Math.sin(side) * s - Math.sin(a) * 5, rnd(5, 7), shell ? 2 : 1.4, shell ? '#a8342a' : '#d8b050');
    if (p) p.vz = rnd(40, 60);
  },

  /* ---------------- Çizim ---------------- */
  /* Kare başında: bitkileri eğen varlıkların listesi */
  beginFrame() {
    const M = this.movers; M.length = 0;
    const P = G.player, C = G.cam, x0 = C.ox - 20, y0 = C.oy - 20, x1 = x0 + G.vw + 40, y1 = y0 + G.vh + 40;
    for (const e of G.ents) {
      if (e.dead || e.kind === 'prop' || e.kind === 'camp' || e.x < x0 || e.x > x1 || e.y < y0 || e.y > y1) continue;
      M.push(e.x, e.y, e.kind === 'horse' ? 11 : (e.r || 4) + 5);
    }
    if (!G.ents.includes(P)) M.push(P.x, P.y, 9);
    if (P.riding && !G.ents.includes(P.riding)) M.push(P.riding.x, P.riding.y, 11);
  },
  /* Zemin katmanı: izler, su halkaları, yere düşmüş yapraklar (varlıklardan önce) */
  drawGround(ctx) {
    const C = G.cam, x0 = C.ox - 10, y0 = C.oy - 10, x1 = x0 + G.vw + 20, y1 = y0 + G.vh + 20;
    for (const t of this.tracks) {
      if (t.x < x0 || t.x > x1 || t.y < y0 || t.y > y1) continue;
      // tam piksele oturt: kesirli koordinat izi bulanıklaştırıp yok eder
      const a = (t.snow ? 0.34 : 0.26) * Math.min(1, t.life / 12, (34 - t.life) * 4);
      ctx.fillStyle = `rgba(${t.c},${a})`;
      const px = Math.round(t.x), py = Math.round(t.y);
      if (t.kind === 'hoof') ctx.fillRect(px - 1, py, 2, 1);
      else ctx.fillRect(px, py, 1, 1);
    }
    ctx.lineWidth = 0.8;
    for (const r of this.ripples) {
      if (r.x < x0 || r.x > x1 || r.y < y0 || r.y > y1) continue;
      const k = 1 - r.life / r.max, rr = r.r0 + (r.r1 - r.r0) * Math.sqrt(k);
      ctx.strokeStyle = `rgba(222,236,244,${(1 - k) * 0.5})`;
      ctx.beginPath(); ctx.ellipse(r.x, r.y, rr, rr * 0.55, 0, 0, TAU); ctx.stroke();
    }
    for (const q of this.leaves) {
      if (q.z > 0) continue;
      ctx.globalAlpha = Math.min(1, q.life / 2) * 0.9;
      ctx.fillStyle = q.c; ctx.fillRect(Math.round(q.x), Math.round(q.y), 2, 1);
    }
    ctx.globalAlpha = 1;
  },
  /* Kıyı köpüğü: karaya komşu su karolarında kenara vuran ince dalgalar */
  foam(ctx, tx, ty, t) {
    const W = G.world, tl = W.tile;
    const land = (x, y) => { const v = W.t(x, y); return !isWaterT(v) && v !== T.BRIDGE; };
    const n = land(tx, ty - 1), s = land(tx, ty + 1), w = land(tx - 1, ty), e = land(tx + 1, ty);
    if (!(n || s || w || e)) return;
    const X = tx * TS, Y = ty * TS, ph = hash2(tx, ty, 13) * TAU;
    const wave = Math.sin(t * 1.3 + ph), d = 1.6 + wave * 1.1, a = 0.2 + (wave * 0.5 + 0.5) * 0.18;
    ctx.fillStyle = `rgba(236,244,248,${a})`;
    const o1 = (hash2(tx, ty, 14) * 5) | 0, len = 5 + (hash2(tx, ty, 15) * 4 | 0);
    if (n) { ctx.fillRect(X + o1, Y + d, len, 1); ctx.fillRect(X + o1 + len + 2, Y + d + 1, 4, 1); }
    if (s) { ctx.fillRect(X + o1 + 1, Y + TS - 1 - d, len, 1); }
    if (w) { ctx.fillRect(X + d, Y + o1, 1, len); ctx.fillRect(X + d + 1, Y + o1 + len + 2, 1, 3); }
    if (e) { ctx.fillRect(X + TS - 1 - d, Y + o1 + 2, 1, len); }
  },
  /* Rüzgârda salınan, yanından geçilince eğilen bitki */
  sway(ctx, o, x, y, h) {
    const cfg = SWAY_O[o], w = this.wind, t = G.t;
    const ph = h * TAU + x * 0.045 + y * 0.03;
    let k = Math.sin(t * (1.4 + w.s * 1.6) + ph) * (0.05 + w.s * 0.16) + Math.sin(t * 3.1 + ph * 1.7) * 0.03 * (0.4 + w.s) + w.x * 0.14;
    const M = this.movers, base = y + cfg[1];
    for (let i = 0; i < M.length; i += 3) {
      const dx = x - M[i], dy = base - M[i + 1], r = M[i + 2];
      if (dx > r || dx < -r || dy > r * 0.8 || dy < -r * 0.8) continue;
      k += (dx >= 0 ? 1 : -1) * 0.55 * (1 - Math.abs(dx) / r) * (1 - Math.abs(dy) / (r * 0.8));
    }
    k = clamp(k * cfg[0], -0.75, 0.75);
    ctx.save();
    ctx.transform(1, 0, -k, 1, k * base, 0);
    Spr.object(ctx, ctx, o, x, y, h, G.world);
    ctx.restore();
  },
  /* Yüksek katman: bacalar/kamp dumanı ve düşen yapraklar (çatıların ve ağaçların üstünde) */
  drawHigh(ctx) {
    const C = G.cam, x0 = C.ox - 20, y0 = C.oy - 20, x1 = x0 + G.vw + 40, y1 = y0 + G.vh + 40;
    for (const p of this.smoke) {
      if (p.x < x0 || p.x > x1 || p.y < y0 || p.y > y1) continue;
      const k = p.life / p.max, a = p.a * Math.min(1, (1 - k) * 5) * Math.sqrt(k);
      ctx.fillStyle = `rgba(${p.col},${a})`;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.s, 0, TAU); ctx.fill();
    }
    for (const q of this.leaves) {
      if (q.z <= 0) continue;
      const f = Math.abs(Math.sin(q.ph));
      ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(q.x + q.z * 0.25, q.y + 1, 1, 1);
      ctx.fillStyle = q.c; ctx.fillRect(q.x, q.y - q.z, 0.6 + f * 1.2, 1);
    }
  },
  /* Rüzgârla kayan bulut gölgeleri (açık/parçalı havada gündüz) */
  drawClouds(ctx) {
    if (!this.full || G.insideB) return;
    const dl = G.daylight;
    if (dl < 0.3) return;
    const cover = (G.weather && G.weather.cloud) || 0, env = G.envCache || {};
    const alpha = 0.2 * clamp((dl - 0.3) / 0.4, 0, 1) * (1 - clamp((cover - 0.45) / 0.4, 0, 1) * 0.85) * (1 - (env.fog || 0) * 0.8);
    if (alpha < 0.03) return;
    const S = 300, ox = this.cloudOff.x, oy = this.cloudOff.y, C = G.cam, vw = G.vw, vh = G.vh;
    const dens = 0.28 + cover * 0.45;
    const cx0 = Math.floor((C.ox - ox - S * 1.2) / S), cx1 = Math.floor((C.ox - ox + vw + S * 0.5) / S);
    const cy0 = Math.floor((C.oy - oy - S * 1.2) / S), cy1 = Math.floor((C.oy - oy + vh + S * 0.5) / S);
    ctx.globalAlpha = alpha;
    for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
      if (hash2(cx, cy, 901) > dens) continue;
      const sz = S * (0.9 + hash2(cx, cy, 902) * 0.9);
      const sx = cx * S + hash2(cx, cy, 903) * S * 0.5 + ox - C.ox, sy = cy * S + hash2(cx, cy, 904) * S * 0.5 + oy - C.oy;
      if (sx + sz < 0 || sx > vw || sy + sz * 0.66 < 0 || sy > vh) continue;
      ctx.drawImage(this.cloudTex, sx, sy, sz, sz * 0.66);
    }
    ctx.globalAlpha = 1;
  },

  /* ---------------- Ekran geçişleri ---------------- */
  tint(ctx, op, col, a) {
    if (a < 0.01) return;
    ctx.globalCompositeOperation = op; ctx.globalAlpha = Math.min(1, a);
    ctx.fillStyle = col; ctx.fillRect(0, 0, G.vw, G.vh);
  },
  /* Renk derecelendirme + durum efektleri; ışıklandırmadan sonra çağrılır */
  post(ctx, dt) {
    const P = G.player, W = G.world, g = this.g, vw = G.vw, vh = G.vh, h = G.hour;
    const env = G.envCache || {};
    const biome = W.tileAtPx(P.x, P.y);
    const out = G.insideB ? 0.25 : 1;
    // hedefler
    let gold = 0, blue = 0;
    if (h > 5 && h < 8) gold = 1 - Math.abs(h - 6.4) / 1.6;
    if (h > 17.6 && h < 21.4) gold = 1 - Math.abs(h - 19.5) / 1.9;
    if (h > 20 && h < 23) blue = 1 - Math.abs(h - 21.4) / 1.6;
    if (h > 3.8 && h < 6.2) blue = 1 - Math.abs(h - 5) / 1.2;
    gold = clamp(gold, 0, 1) * (1 - (env.rain || 0) * 0.7) * (1 - (G.weather.cloud || 0) * 0.5);
    const dl = G.daylight;
    const tg = {
      gold: gold * out,
      blue: clamp(blue, 0, 1) * out,
      desert: (biome === T.DESERT || biome === T.REDROCK || biome === T.MESA ? 1 : biome === T.DRY || biome === T.SAND ? 0.45 : 0) * dl * out * (1 - (env.rain || 0)),
      rain: clamp((env.rain || 0) * 1.2 + (env.storm ? 0.3 : 0), 0, 1) * (G.insideB ? 0.35 : 1),
      cold: clamp((biome === T.SNOW || biome === T.SNOWCLIFF ? 0.8 : 0) + (env.snow || 0) * 0.6 + (W.season === 3 && W.snowyTile(P.x >> 4, P.y >> 4) ? 0.5 : 0), 0, 1) * out,
      swamp: (biome === T.SWAMP ? 1 : biome === T.MUD ? 0.5 : 0) * out,
      hurt: G.state === 'play' || G.state === 'dead' ? clamp((0.42 - P.hp / P.maxHp) / 0.3, 0, 1) : 0,
      drunk: clamp((P.drunk - 22) / 55, 0, 1),
      frost: G.insideB ? 0 : clamp(G.coldness * 1.4 - 0.1, 0, 1),
      de: P.deadeye ? 1 : 0,
    };
    if (G.state === 'dead') tg.hurt = 1;
    const rate = { gold: 0.5, blue: 0.5, desert: 0.7, rain: 0.5, cold: 0.6, swamp: 0.6, hurt: 1.6, drunk: 0.8, frost: 0.35, de: 6 };
    if (!this.gradeInit) { this.gradeInit = true; for (const k in tg) g[k] = tg[k]; }
    else for (const k in tg) g[k] += (tg[k] - g[k]) * Math.min(1, dt * rate[k]);

    // --- renk derecelendirme (zaman / hava / biyom)
    this.tint(ctx, 'soft-light', '#ff8a3a', g.gold * 0.5);
    this.tint(ctx, 'source-over', 'rgb(255,128,48)', g.gold * 0.06);
    this.tint(ctx, 'soft-light', '#3450a8', g.blue * 0.5);
    this.tint(ctx, 'soft-light', '#ffb060', g.desert * 0.34);
    this.tint(ctx, 'saturation', '#808080', g.rain * 0.4);
    this.tint(ctx, 'soft-light', '#5a78a4', g.rain * 0.32);
    this.tint(ctx, 'soft-light', '#a8ccff', g.cold * 0.36);
    this.tint(ctx, 'soft-light', '#6e8a50', g.swamp * 0.34);
    // --- sarhoşluk: çift görme + sıcak renk kayması
    if (g.drunk > 0.02) {
      const d = g.drunk, t = G.t;
      this.tint(ctx, 'soft-light', '#ffc070', d * 0.3);
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 0.26 * d;
      ctx.drawImage(G.canvas, Math.sin(t * 1.3) * 2.6 * d, Math.cos(t * 0.9) * 1.6 * d);
    }
    // --- ayaz: kenarlarda buz kristalleri
    if (g.frost > 0.02) {
      this.tint(ctx, 'soft-light', '#b8d4ff', g.frost * 0.25);
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = g.frost * 0.9;
      ctx.drawImage(this.frost(vw, vh), 0, 0);
    }
    // --- düşük sağlık: renk çekilir, kalp atışıyla nabız gibi atan kırmızı kenar
    if (g.hurt > 0.02) {
      const k = g.hurt;
      this.tint(ctx, 'saturation', '#808080', k * 0.7);
      const bpm = 64 + k * 56;
      this.hb += dt * bpm / 60;
      if (this.hb >= 1) { this.hb -= 1; this.dub = false; if (G.state === 'play' && k > 0.2) Audio_.heart(0.18 + k * 0.3); }
      if (!this.dub && this.hb > 0.2) { this.dub = true; if (G.state === 'play' && k > 0.2) Audio_.heart(0.1 + k * 0.18, true); }
      const ph = this.hb, gs = v => Math.exp(-(v * v)), pulse = Math.max(gs((ph - 0.02) / 0.07), 0.7 * gs((ph - 0.22) / 0.07));
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = Math.min(1, k * (0.4 + pulse * 0.45));
      ctx.drawImage(this.vigRed, 0, 0, vw, vh);
    } else this.hb = 0;
    // --- Dead Eye: sepya (CSS) + koyu kenar + film greni + çizikler
    if (g.de > 0.02) {
      const k = g.de;
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = k * 0.55;
      ctx.drawImage(this.vigDark, 0, 0, vw, vh);
      this.grainT -= dt;
      if (this.grainT <= 0) { this.grainT = 1 / 20; this.grainI = (this.grainI + 1 + (Math.random() * 2 | 0)) % this.grain.length; this.gox = Math.random() * 96 | 0; this.goy = Math.random() * 96 | 0; if (Math.random() < 0.3) this.scratches.push({ x: Math.random() * vw | 0, t: rnd(0.08, 0.25), a: rnd(0.15, 0.35) }); }
      ctx.globalAlpha = k * 0.38; ctx.globalCompositeOperation = 'overlay';
      const gr = this.grain[this.grainI];
      for (let y = -this.goy; y < vh; y += 96) for (let x = -this.gox; x < vw; x += 96) ctx.drawImage(gr, x, y);
      ctx.globalCompositeOperation = 'source-over';
      for (const s of this.scratches) { ctx.globalAlpha = s.a * k; ctx.fillStyle = '#f0e0c0'; ctx.fillRect(s.x, 0, 1, vh); }
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    // sarhoşken tuvalin hafifçe dönmesi (CSS dönüşümü; sadece gerektiğinde yazılır)
    const cs = G.canvas.style;
    if (g.drunk > 0.02) {
      const d = g.drunk, t = G.t;
      cs.transform = `rotate(${(Math.sin(t * 0.7) * 1.1 * d).toFixed(3)}deg) scale(${(1 + 0.035 * d).toFixed(4)}) translate(${(Math.sin(t * 0.45) * 0.6 * d).toFixed(2)}%, 0)`;
      this.drunkCss = true;
    } else if (this.drunkCss) this.clearCss();
  },
  clearCss() { G.canvas.style.transform = ''; this.drunkCss = false; },
  /* Ayaz dokusu: ekran boyutuna göre bir kez üretilir */
  frost(vw, vh) {
    if (this.frostC && this.frostC.width === vw && this.frostC.height === vh) return this.frostC;
    const c = this.frostC = makeCanvas(vw, vh), x = c.getContext('2d');
    const R = mulberry32(99);
    const gr = x.createRadialGradient(vw / 2, vh / 2, Math.min(vw, vh) * 0.3, vw / 2, vh / 2, Math.hypot(vw, vh) * 0.55);
    gr.addColorStop(0, 'rgba(220,236,252,0)'); gr.addColorStop(0.7, 'rgba(220,236,252,0.18)'); gr.addColorStop(1, 'rgba(232,242,255,0.6)');
    x.fillStyle = gr; x.fillRect(0, 0, vw, vh);
    x.lineCap = 'round';
    const branch = (px, py, a, len, depth) => {
      const ex = px + Math.cos(a) * len, ey = py + Math.sin(a) * len;
      x.strokeStyle = `rgba(240,248,255,${0.25 + depth * 0.12})`; x.lineWidth = depth > 1 ? 1 : 0.7;
      x.beginPath(); x.moveTo(px, py); x.lineTo(ex, ey); x.stroke();
      if (depth > 0) {
        const n = 2 + (R() * 2 | 0);
        for (let i = 1; i <= n; i++) { const f = i / (n + 1); branch(px + (ex - px) * f, py + (ey - py) * f, a + (R() < 0.5 ? 1 : -1) * (0.6 + R() * 0.5), len * 0.45, depth - 1); }
      }
    };
    const N = Math.round((vw + vh) / 4);
    for (let i = 0; i < N; i++) {
      const side = R() * 4 | 0, dd = Math.pow(R(), 2.2) * Math.min(vw, vh) * 0.2;
      let px, py;
      if (side === 0) { px = R() * vw; py = dd; } else if (side === 1) { px = R() * vw; py = vh - dd; } else if (side === 2) { px = dd; py = R() * vh; } else { px = vw - dd; py = R() * vh; }
      const a = Math.atan2(vh / 2 - py, vw / 2 - px) + (R() - 0.5) * 2.2;
      branch(px, py, a, 4 + R() * 9 * (1 - dd / (Math.min(vw, vh) * 0.2)), 2);
    }
    return c;
  },
};
