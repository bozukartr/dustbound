'use strict';
/* ==========================================================
   DUSTBOUND — dünya üretimi, parça (chunk) önbelleği, harita
   ========================================================== */

const TS = 16;            // bir karonun piksel boyutu
const WW = 1024, WH = 1024; // dünya boyutu (karo)
const CHUNK = 32;         // chunk başına karo
const CPX = CHUNK * TS;   // chunk piksel boyutu
const CG = 4;             // kaba ızgara hücresi (karo)
const CW = WW / CG, CHH = WH / CG;

const T = { DEEP: 0, WATER: 1, SAND: 2, DESERT: 3, DRY: 4, GRASS: 5, FOREST: 6, SWAMP: 7, MUD: 8, ROCK: 9, CLIFF: 10, SNOW: 11, ROAD: 12, TOWN: 13, FARM: 14, BRIDGE: 15, REDROCK: 16, MESA: 17, SNOWCLIFF: 18, PLANK: 19, HOTWATER: 20 };
const TNAME = Object.keys(T);
const TINFO = [
  { c: '#2c4b5e', v: 5, solid: 1, map: '#98aca8' },            // DEEP
  { c: '#41707c', v: 5, slow: 0.55, map: '#aebdb2', water: 1 }, // WATER
  { c: '#d9c690', v: 9, map: '#e8dab2' },                       // SAND
  { c: '#d7a868', v: 11, map: '#e4c898' },                      // DESERT
  { c: '#ae9f5a', v: 13, map: '#dcd0a2' },                      // DRY
  { c: '#6c8c44', v: 13, map: '#cdd0a0' },                      // GRASS
  { c: '#46652f', v: 12, map: '#b3b98c' },                      // FOREST
  { c: '#4c5934', v: 12, slow: 0.8, map: '#a8ad8c' },           // SWAMP
  { c: '#6a5236', v: 9, slow: 0.75, map: '#c0b090' },           // MUD
  { c: '#8b8072', v: 13, map: '#b4aa9a', rock: 1 },          // ROCK
  { c: '#5f564c', v: 14, solid: 1, map: '#9a8870', cliff: 1 },  // CLIFF
  { c: '#e2e7ec', v: 7, slow: 0.85, map: '#f2efe6' },           // SNOW
  { c: '#9a7c56', v: 7, map: '#7a5a3a' },                       // ROAD
  { c: '#a78b62', v: 8, map: '#8a6a4a' },                       // TOWN
  { c: '#6e6232', v: 9, map: '#d4c47e' },                       // FARM
  { c: '#77573a', v: 4, map: '#6a4a2a' },                       // BRIDGE
  { c: '#b6693f', v: 13, map: '#dcaa84' },                      // REDROCK
  { c: '#87462c', v: 14, solid: 1, map: '#b27a5a', cliff: 1 },  // MESA
  { c: '#b4bcc6', v: 9, solid: 1, map: '#d6d4cc', cliff: 1 },   // SNOWCLIFF
  { c: '#86663f', v: 4, map: '#8a6a4a' },                       // PLANK
  { c: '#5a9aa0', v: 5, slow: 0.6, map: '#b8ccc4', water: 1 },  // HOTWATER
];
const TPAL = TINFO.map(t => hexToRgb(t.c));
const isCliffT = t => t === T.CLIFF || t === T.MESA || t === T.SNOWCLIFF;
const isWaterT = t => t === T.DEEP || t === T.WATER || t === T.HOTWATER;

/* Nesneler */
const O = {
  NONE: 0, PINE: 1, OAK: 2, DEAD: 3, CACTUS: 4, SAGUARO: 5, BUSH: 6, ROCK: 7, BOULDER: 8, CYPRESS: 9, BIRCH: 10, SNOWPINE: 11, DRYBUSH: 12, REED: 13, FLOWERS: 14, TUFT: 15, APPLE: 16,
  BERRY: 20, GINSENG: 21, YARROW: 22, SAGE: 23, MINT: 24, OREGANO: 25, MILKWEED: 26, MUSHROOM: 27, WFLOWER: 28, ORE: 29, CROP: 30, ARTIFACT: 31,
  FENCEH: 40, FENCEV: 41, CRATE: 42, BARREL: 43, LAMP: 44, WELL: 45, TROUGH: 46, GRAVE: 47, CAMPFIRE: 48, TENT: 49, HAY: 50, SIGN: 51, WINDMILL: 52, CHEST: 53, POLE: 54,
  RUINWALL: 55, BONES: 56, WAGON: 57, HITCH: 58, BENCH: 59, BIGBONES: 60, SEQUOIA: 61, ARCH: 62, STEAM: 63, GALLOWS: 64, CROSS: 65, BOARD: 66, PUMP: 67, SHIP: 68,
};
const SOLID_O = new Uint8Array(80);
[O.PINE, O.OAK, O.DEAD, O.CACTUS, O.SAGUARO, O.BOULDER, O.CYPRESS, O.BIRCH, O.SNOWPINE, O.APPLE, O.FENCEH, O.FENCEV, O.CRATE, O.BARREL, O.LAMP, O.WELL, O.TROUGH, O.TENT, O.HAY,
  O.SIGN, O.WINDMILL, O.POLE, O.RUINWALL, O.WAGON, O.HITCH, O.BIGBONES, O.SEQUOIA, O.GALLOWS, O.BOARD, O.PUMP, O.SHIP].forEach(o => (SOLID_O[o] = 1));
/* Toplanabilirler: eşya, adet aralığı, yenilenme (gün), alet */
const HARVEST = {
  [O.BERRY]: { item: 'berries', n: [2, 4], re: 2, label: 'Yaban Mersini Topla' },
  [O.GINSENG]: { item: 'ginseng', n: [1, 2], re: 3, label: 'Ginseng Topla' },
  [O.YARROW]: { item: 'yarrow', n: [1, 2], re: 2, label: 'Civanperçemi Topla' },
  [O.SAGE]: { item: 'sage', n: [1, 2], re: 2, label: 'Adaçayı Topla' },
  [O.MINT]: { item: 'mint', n: [1, 2], re: 2, label: 'Nane Topla' },
  [O.OREGANO]: { item: 'oregano', n: [1, 2], re: 2, label: 'Kekik Topla' },
  [O.MILKWEED]: { item: 'milkweed', n: [1, 2], re: 2, label: 'İpekotu Topla' },
  [O.MUSHROOM]: { item: 'mushroom', n: [1, 3], re: 2, label: 'Mantar Topla' },
  [O.WFLOWER]: { item: 'wildflower', n: [1, 2], re: 2, label: 'Çiçek Topla' },
  [O.APPLE]: { item: 'apple', n: [2, 4], re: 3, label: 'Elma Topla' },
  [O.CROP]: { item: 'corn', n: [1, 2], re: 4, label: 'Mısır Topla' },
  [O.ORE]: { item: 'ore', n: [1, 2], re: 5, label: 'Cevher Kaz', tool: 'pickaxe' },
  [O.ARTIFACT]: { item: 'artifact', n: [1, 1], re: 9999, label: 'İncele' },
};
const isHerbO = o => o >= 20 && o <= 28;

class World {
  constructor(seed) {
    this.seed = seed | 0;
    const N = WW * WH;
    this.tile = new Uint8Array(N);
    this.obj = new Uint8Array(N);
    this.solid = new Uint8Array(N);
    this.flags = new Uint8Array(N);   // 1: nesne yok, 2: ray, 4: kasaba, 8: bina
    this.heat = new Uint8Array(N);
    this.elev = new Uint8Array(N);
    this.buildings = [];
    this.bmap = new Int16Array(CW * CHH).fill(-1); // kaba hücre -> bina (etkileşim araması için değil, çizim için)
    this.towns = [];
    this.pois = [];
    this.roads = [];
    this.rails = [];
    this.lines = [];
    this.lights = [];     // statik ışıklar {x,y,r,type}
    this.chests = new Map(); // idx -> {loot}
    this.signs = [];
    this.cost = null;
    this.chunks = new Map();
    this.jobs = new Map();
    this.mapCanvas = null;
    this.harvested = new Map(); // idx -> gün
  }
  idx(x, y) { return y * WW + x; }
  inb(x, y) { return x >= 0 && y >= 0 && x < WW && y < WH; }
  t(x, y) { return (x < 0 || y < 0 || x >= WW || y >= WH) ? T.DEEP : this.tile[y * WW + x]; }
  tileAtPx(px, py) { return this.t(px >> 4, py >> 4); }
  isSolidPx(px, py) {
    const x = px >> 4, y = py >> 4;
    if (x < 0 || y < 0 || x >= WW || y >= WH) return true;
    return this.solid[y * WW + x] !== 0;
  }
  blocked(px, py, r) {
    return this.isSolidPx(px - r, py - r) || this.isSolidPx(px + r, py - r) || this.isSolidPx(px - r, py + r) || this.isSolidPx(px + r, py + r);
  }
  isWaterPx(px, py) { return isWaterT(this.tileAtPx(px, py)); }
  biomeAt(px, py) { return TNAME[this.tileAtPx(px, py)]; }
  /* Kasaba/yol vb. için arka plan biyomu */
  climateAt(px, py) {
    const x = clamp(px >> 4, 0, WW - 1), y = clamp(py >> 4, 0, WH - 1);
    return this.heat[y * WW + x] / 255;
  }
  regionAt(px, py) {
    const nx = px / (WW * TS), ny = py / (WH * TS);
    let best = null, bd = 1e9;
    for (const r of REGIONS) { const d = dist2(nx, ny, r.x, r.y); if (d < bd) { bd = d; best = r; } }
    return best.n;
  }
  townAt(px, py, margin = 0) {
    const tx = px / TS, ty = py / TS;
    for (const t of this.towns) if (tx >= t.x - margin && ty >= t.y - margin && tx < t.x + t.w + margin && ty < t.y + t.h + margin) return t;
    return null;
  }
  nearWater(px, py, r) {
    const x0 = (px - r) >> 4, x1 = (px + r) >> 4, y0 = (py - r) >> 4, y1 = (py + r) >> 4;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (isWaterT(this.t(x, y))) return true;
    return false;
  }

  /* ------------------------------------------------------ */
  async generate(progress) {
    const step = async (msg, pct) => { progress && progress(msg, pct); await new Promise(r => setTimeout(r, 0)); };
    this.rng = new RNG(this.seed * 7 + 13);
    await step('Topraklar şekilleniyor...', 0.05);
    this.genTerrain();
    await step('Nehirler akıyor...', 0.2);
    this.genRivers();
    await step('Kasabalar kuruluyor...', 0.3);
    this.genTowns();
    this.buildCost();
    await step('Yollar açılıyor...', 0.4);
    this.genRoads();
    await step('Raylar döşeniyor...', 0.5);
    this.genRails();
    await step('Keşfedilecek yerler saklanıyor...', 0.6);
    this.genPOIs();
    await step('Ormanlar büyüyor...', 0.72);
    this.genObjects();
    this.computeSolid();
    await step('Harita çiziliyor...', 0.85);
    this.buildMapImage();
    await step('Hazır.', 1);
  }

  genTerrain() {
    const s = this.seed;
    const n1 = new Noise(s + 1), n2 = new Noise(s + 2), n3 = new Noise(s + 3), n4 = new Noise(s + 4), n5 = new Noise(s + 5);
    const tile = this.tile, heatA = this.heat, elevA = this.elev;
    for (let y = 0; y < WH; y++) {
      const ny = y / WH;
      const coastX = 0.915 + (n4.fbm(ny * 5, 0.5, 3) - 0.5) * 0.09;
      const ridgeX = 0.15 + (n4.fbm(ny * 2.2, 7.7, 3) - 0.5) * 0.16;
      for (let x = 0; x < WW; x++) {
        const nx = x / WW;
        const i = y * WW + x;
        const e = n1.fbm(nx * 7, ny * 7, 5);
        const m = n2.fbm(nx * 5 + 3, ny * 5, 4);
        const tt = n3.fbm(nx * 4, ny * 4 + 9, 3);
        // okyanus / körfez
        const gulfY = 0.94 + (n4.v(nx * 7, 3.3) - 0.5) * 0.06;
        const coastD = Math.max(nx - coastX, (nx > 0.58 ? ny - gulfY : -1) * 1.0);
        // dağlar
        let ridge = Math.max(0, 1 - Math.abs(nx - ridgeX) * 7.5) * clamp((0.92 - ny) * 4, 0, 1);
        ridge = ridge * ridge * (3 - 2 * ridge);
        const north = Math.max(0, 1 - ny * 7);
        const hills = Math.max(0, n5.fbm(nx * 3 + 11, ny * 3, 3) - 0.6) * 2.2;
        const mount = ridge * (0.55 + 1.2 * (e - 0.5)) + north * (0.2 + 0.9 * (e - 0.3)) + hills * (e - 0.2);
        const h = e * 0.55 + mount * 0.85;
        let heat = ny * 1.05 + (tt - 0.5) * 0.35 - mount * 0.2 + 0.02;
        let moist = nx * 0.85 + (m - 0.5) * 0.75 - 0.12 + clamp((0.42 - ny) * 1.3, 0, 0.35);
        const swampy = clamp((ny - 0.7) * 5, 0, 1) * clamp((nx - 0.57) * 6, 0, 1);
        moist += swampy * 0.45;
        moist -= clamp((0.35 - nx) * 1.2, 0, 0.3) * clamp((ny - 0.45) * 3, 0, 1);
        heatA[i] = clamp(heat, 0, 1) * 255;
        elevA[i] = clamp(h, 0, 1) * 255;
        let t;
        if (coastD > 0.004) t = T.DEEP;
        else if (coastD > 0) t = T.WATER;
        else if (coastD > -0.004 && h < 0.7) t = T.SAND;
        else if (h > 0.84) t = heat < 0.3 ? T.SNOWCLIFF : T.CLIFF;
        else if (h > 0.72) t = heat < 0.22 ? T.SNOW : T.ROCK;
        else if (heat < 0.16) t = T.SNOW;
        else if (heat > 0.6 && moist < 0.42) {
          const mesa = n5.fbm(nx * 22, ny * 22, 3);
          if (heat > 0.7 && mesa > 0.68) t = T.MESA;
          else if (mesa > 0.58 || (heat > 0.78 && mesa > 0.5)) t = T.REDROCK;
          else t = T.DESERT;
        }
        else if (heat > 0.64 && moist > 0.72) t = (n2.v(nx * 90, ny * 90) > 0.72) ? T.WATER : (n3.v(nx * 60, ny * 60) > 0.75 ? T.MUD : T.SWAMP);
        else if (moist > 0.6) t = T.FOREST;
        else if (moist > 0.4) t = T.GRASS;
        else t = T.DRY;
        // göller
        if (t !== T.DEEP && t !== T.WATER && !isCliffT(t) && t !== T.DESERT && t !== T.MESA && t !== T.REDROCK && e < 0.305 && mount < 0.12) {
          t = e < 0.285 ? T.DEEP : T.WATER;
        }
        tile[i] = t;
      }
    }
    // göl kıyıları: derin suya komşu karalar sığ su / kum
    const copy = tile.slice();
    for (let y = 1; y < WH - 1; y++) for (let x = 1; x < WW - 1; x++) {
      const i = y * WW + x, t = copy[i];
      if (t === T.DEEP) {
        if (copy[i - 1] > T.WATER || copy[i + 1] > T.WATER || copy[i - WW] > T.WATER || copy[i + WW] > T.WATER) tile[i] = T.WATER;
      }
    }
  }

  carveCircle(cx, cy, r, fn) {
    const r2 = r * r;
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++)
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        if (!this.inb(x, y)) continue;
        const d2 = (x - cx) * (x - cx) + (y - cy) * (y - cy);
        if (d2 <= r2) fn(x, y, Math.sqrt(d2), y * WW + x);
      }
  }

  genRivers() {
    const nz = new Noise(this.seed + 99);
    const rivers = [
      { pts: [[0.5, 0.0], [0.585, 0.3], [0.62, 0.55], [0.66, 0.76], [0.7, 1.0]], w0: 2, w1: 4.2, deep: true },
      { pts: [[0.2, 0.3], [0.34, 0.36], [0.45, 0.46], [0.6, 0.46]], w0: 1.2, w1: 2.4 },
      { pts: [[0.14, 0.44], [0.24, 0.6], [0.31, 0.74], [0.44, 0.9], [0.5, 1.0]], w0: 1.2, w1: 2.2 },
      { pts: [[0.76, 0.03], [0.72, 0.2], [0.59, 0.33]], w0: 1.2, w1: 2.2 },
      { pts: [[0.76, 0.3], [0.86, 0.38], [0.95, 0.4]], w0: 1, w1: 2 },
    ];
    this.riverPaths = [];
    rivers.forEach((rv, ri) => {
      const pts = rv.pts.map(p => [p[0] * WW, p[1] * WH]);
      let x = pts[0][0], y = pts[0][1];
      let dir = Math.atan2(pts[1][1] - y, pts[1][0] - x);
      let total = 0; for (let k = 1; k < pts.length; k++) total += dist(pts[k - 1][0], pts[k - 1][1], pts[k][0], pts[k][1]);
      let travelled = 0, target = 1, steps = 0;
      const path = [];
      while (target < pts.length && steps < 6000) {
        steps++;
        const [tx, ty] = pts[target];
        if (dist(x, y, tx, ty) < 6) { target++; continue; }
        const want = Math.atan2(ty - y, tx - x) + (nz.fbm(steps * 0.012, ri * 10, 3) - 0.5) * 2.6;
        dir = turnTo(dir, want, 0.08);
        x += Math.cos(dir); y += Math.sin(dir); travelled++;
        const w = lerp(rv.w0, rv.w1, clamp(travelled / total, 0, 1));
        if (steps % 3 === 0) path.push([x, y, w]);
        this.carveCircle(x, y, w + 2.2, (cx, cy, d, i) => {
          const t = this.tile[i];
          if (d <= w) {
            if (rv.deep && d < w - 1.6) this.tile[i] = T.DEEP;
            else if (t !== T.DEEP) this.tile[i] = T.WATER;
          } else if (isCliffT(t)) this.tile[i] = T.ROCK;
          else if ((t === T.DESERT || t === T.REDROCK) && d < w + 1.5) this.tile[i] = T.SAND;
          else if (t === T.DRY && d < w + 1.2) this.tile[i] = T.GRASS;
        });
      }
      this.riverPaths.push(path);
    });
  }

  /* ---- Kasabalar ---- */
  flatten(x0, y0, w, h, t = T.TOWN, mark = 4) {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
      if (!this.inb(x, y)) continue;
      const i = y * WW + x;
      this.tile[i] = t; this.obj[i] = 0; this.flags[i] |= 1 | mark;
    }
  }
  addBuilding(type, x, y, town, name, extra) {
    const def = BUILDINGS[type];
    const w = (extra && extra.w) || def.w, h = (extra && extra.h) || def.h;
    const b = { id: this.buildings.length, type, x, y, w, h, town: town ? town.id : null, name: name || (town ? town.n + ' ' + def.n : def.n), def };
    b.door = { x: (x + Math.floor(w / 2)) * TS + TS / 2, y: (y + h) * TS + 6 };
    if (extra) Object.assign(b, extra);
    this.buildings.push(b);
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) {
      if (!this.inb(xx, yy)) continue;
      const i = yy * WW + xx;
      this.flags[i] |= 8 | 1; this.obj[i] = 0;
      if (this.tile[i] === T.DEEP || this.tile[i] === T.WATER) this.tile[i] = T.TOWN;
    }
    // veranda
    for (let xx = x; xx < x + w; xx++) if (this.inb(xx, y + h)) { const i = (y + h) * WW + xx; if (!(this.flags[i] & 8)) { this.tile[i] = T.PLANK; this.flags[i] |= 1; this.obj[i] = 0; } }
    // pencereler -> gece ışıkları
    if (!def.ruin && type !== 'mineentrance') {
      const n = Math.max(1, Math.floor(w / 3));
      for (let k = 0; k < n; k++) this.lights.push({ x: (x + (k + 0.5) * w / n) * TS, y: (y + h) * TS - 8, r: 34, type: 'window', b: b.id });
    }
    if (def.light) this.lights.push({ x: (x + w / 2) * TS, y: y * TS - 10, r: 160, type: 'beacon' });
    return b;
  }
  genTowns() {
    const SZ = { s: [54, 26], m: [58, 38], l: [74, 50] };
    for (const td of TOWNS) {
      const [w, h] = SZ[td.sz];
      const cx = Math.round(td.px * WW), cy = Math.round(td.py * WH);
      const x0 = cx - (w >> 1), y0 = cy - (h >> 1);
      const town = { ...td, x: x0, y: y0, w, h, cx: cx * TS, cy: cy * TS, buildings: [] };
      this.towns.push(town);
      // çevreyi yumuşat
      for (let y = y0 - 8; y < y0 + h + 14; y++) for (let x = x0 - 8; x < x0 + w + 8; x++) {
        if (!this.inb(x, y)) continue;
        const i = y * WW + x, t = this.tile[i];
        if (isCliffT(t)) this.tile[i] = T.ROCK;
        if (t === T.DEEP) this.tile[i] = T.WATER;
        this.flags[i] |= 1;
      }
      this.flatten(x0, y0, w, h);
      // Sokaklar: satırlar
      const BH = 9, ST = 3;
      const rows = Math.floor((h - 1) / (BH + ST));
      const vx = cx - 1; // dikey cadde
      const queue = td.b.slice();
      town.streets = [];
      for (let r = 0; r < rows; r++) {
        const ry = y0 + 1 + r * (BH + ST);
        const sy = ry + BH; // cadde satırı
        for (let yy = sy; yy < sy + ST; yy++) for (let xx = x0; xx < x0 + w; xx++) this.tile[yy * WW + xx] = T.ROAD;
        town.streets.push(sy);
        let x = x0 + 2;
        while (x < x0 + w - 3) {
          if (x + 1 >= vx - 1 && x <= vx + 3) { x = vx + 4; continue; }
          const type = queue.length ? queue[0] : null;
          if (!type) break;
          const def = BUILDINGS[type];
          const lim = (x < vx) ? vx - 2 : x0 + w - 2;
          if (x + def.w > lim) { if (x < vx) { x = vx + 4; continue; } else break; }
          queue.shift();
          const b = this.addBuilding(type, x, sy - def.h - 1, town);
          town.buildings.push(b);
          // yan dekor
          if (this.rng.chance(0.5) && x + def.w + 1 < lim) this.obj[(sy - 2) * WW + x + def.w] = this.rng.chance(0.5) ? O.BARREL : O.CRATE;
          if (type === 'saloon' || type === 'general' || type === 'sheriff') {
            this.obj[sy * WW + x] = O.HITCH;
            town.hitch = town.hitch || []; town.hitch.push({ x: x * TS + 8, y: sy * TS + 14 });
          }
          if (type === 'sheriff') this.obj[(sy) * WW + x + def.w] = O.BOARD;
          x += def.w + (this.rng.chance(0.5) ? 1 : 2);
        }
      }
      for (let yy = y0 - 4; yy < y0 + h + 4; yy++) for (let xx = vx; xx < vx + 3; xx++) { const i = yy * WW + xx; if (!(this.flags[i] & 8)) { this.tile[i] = T.ROAD; this.flags[i] |= 1; this.obj[i] = 0; } }
      town.gateY = town.streets[town.streets.length - 1] + 1;
      for (let yy = town.gateY - 1; yy <= town.gateY + 1; yy++) for (let xx = x0 - 5; xx < x0 + w + 5; xx++) { const i = yy * WW + xx; if (!(this.flags[i] & 8)) { this.tile[i] = T.ROAD; this.flags[i] |= 1; this.obj[i] = 0; } }
      // lambalar ve kuyu
      for (const sy of town.streets) {
        for (let xx = x0 + 1; xx < x0 + w - 1; xx += 9) {
          const i = (sy + 2) * WW + xx;
          if (this.tile[i] === T.ROAD && !(this.flags[i] & 8) && !this.obj[i] && Math.abs(xx - vx - 1) > 2) {
            this.obj[i] = O.LAMP; this.lights.push({ x: xx * TS + 8, y: (sy + 2) * TS + 2, r: 55, type: 'lamp' });
          }
        }
      }
      const wy = town.streets[0] + 2;
      this.obj[wy * WW + vx + 4] = O.PUMP;
      this.obj[wy * WW + vx - 2] = O.TROUGH;
      this.obj[wy * WW + vx + 6] = O.BENCH;
      town.gates = [
        { x: x0 - 4, y: town.gateY }, { x: x0 + w + 3, y: town.gateY },
        { x: vx + 1, y: y0 - 4 }, { x: vx + 1, y: y0 + h + 3 },
      ];
      town.vx = vx;
      // istasyon
      if (RAIL_LINES.some(l => l.includes(td.id))) {
        const sx = vx - 13, sy = y0 + h + 2;
        this.flatten(sx - 3, sy - 2, 18, 11, T.TOWN, 0);
        for (let yy = y0 + h; yy < sy + 6; yy++) for (let xx = vx; xx < vx + 3; xx++) this.tile[yy * WW + xx] = T.ROAD;
        const b = this.addBuilding('station', sx, sy, town);
        town.buildings.push(b);
        for (let xx = sx - 3; xx < sx + 15; xx++) { const i = (sy + 5) * WW + xx; this.tile[i] = T.PLANK; this.flags[i] |= 1; }
        town.station = b;
        town.railPt = { x: sx + 5, y: sy + 7 };
        for (let yy = sy + 6; yy < sy + 12; yy++) for (let xx = vx; xx < vx + 3; xx++) { const i = yy * WW + xx; this.tile[i] = T.ROAD; this.flags[i] |= 1; }
        town.gates[3] = { x: vx + 1, y: sy + 12 };
      }
      // tabelalar
      this.signs.push({ x: (x0 - 3) * TS + 8, y: (town.gateY + 2) * TS + 8, town: town.id });
      this.obj[(town.gateY + 2) * WW + x0 - 3] = O.SIGN;
      this.signs.push({ x: (x0 + w + 2) * TS + 8, y: (town.gateY + 2) * TS + 8, town: town.id });
      this.obj[(town.gateY + 2) * WW + x0 + w + 2] = O.SIGN;
    }
  }

  /* ---- Kaba maliyet ızgarası (A*) ---- */
  buildCost() {
    const C = new Float32Array(CW * CHH);
    const TC = [30, 9, 2.2, 2.4, 2, 2, 3, 4, 4, 5, 70, 4, 0.6, 1.5, 3, 1, 3, 70, 70, 1, 12];
    for (let cy = 0; cy < CHH; cy++) for (let cx = 0; cx < CW; cx++) {
      let c = 0, mx = 0;
      for (let y = 0; y < CG; y++) for (let x = 0; x < CG; x++) {
        const i = (cy * CG + y) * WW + cx * CG + x;
        const v = TC[this.tile[i]];
        c += v; if (v > mx) mx = v;
        if (this.flags[i] & 8) mx = 1e6;
      }
      C[cy * CW + cx] = Math.max(c / 16, mx * 0.6);
    }
    for (const t of this.towns) {
      for (let y = t.y; y < t.y + t.h; y++) for (let x = t.x; x < t.x + t.w; x++) {
        const c = ((y / CG) | 0) * CW + ((x / CG) | 0);
        if (c >= 0 && c < C.length) C[c] = 1e6;
      }
    }
    this.cost = C;
  }
  astar(sx, sy, tx, ty, costFn) {
    // koordinatlar kaba hücre
    const N = CW * CHH;
    const g = new Float32Array(N).fill(Infinity);
    const came = new Int32Array(N).fill(-1);
    const closed = new Uint8Array(N);
    const heap = new Heap();
    const s = sy * CW + sx, goal = ty * CW + tx;
    g[s] = 0; heap.push(s, 0);
    const DX = [1, -1, 0, 0, 1, 1, -1, -1], DY = [0, 0, 1, -1, 1, -1, 1, -1];
    let iter = 0;
    while (heap.size && iter++ < 200000) {
      const cur = heap.pop();
      if (cur === goal) break;
      if (closed[cur]) continue;
      closed[cur] = 1;
      const cx = cur % CW, cy = (cur / CW) | 0;
      for (let k = 0; k < 8; k++) {
        const nx = cx + DX[k], ny = cy + DY[k];
        if (nx < 0 || ny < 0 || nx >= CW || ny >= CHH) continue;
        const ni = ny * CW + nx;
        if (closed[ni]) continue;
        let c = costFn(ni, nx, ny);
        if (ni === goal) c = Math.min(c, 2);
        if (c >= 1e5) continue;
        const ng = g[cur] + c * (k > 3 ? 1.414 : 1);
        if (ng < g[ni]) {
          g[ni] = ng; came[ni] = cur;
          heap.push(ni, ng + Math.hypot(nx - tx, ny - ty) * 0.6);
        }
      }
    }
    if (came[goal] < 0 && goal !== s) return null;
    const path = [];
    let c = goal;
    while (c >= 0) { path.push([(c % CW) * CG + CG / 2, ((c / CW) | 0) * CG + CG / 2]); if (c === s) break; c = came[c]; }
    return path.reverse();
  }
  static chaikin(pts, it = 2) {
    let p = pts;
    for (let k = 0; k < it; k++) {
      const q = [p[0]];
      for (let i = 0; i < p.length - 1; i++) {
        const [ax, ay] = p[i], [bx, by] = p[i + 1];
        q.push([ax * 0.75 + bx * 0.25, ay * 0.75 + by * 0.25], [ax * 0.25 + bx * 0.75, ay * 0.25 + by * 0.75]);
      }
      q.push(p[p.length - 1]);
      p = q;
    }
    return p;
  }
  rasterRoad(pts, r, kind) {
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
      const L = Math.max(1, Math.ceil(dist(ax, ay, bx, by) * 2));
      for (let s = 0; s <= L; s++) {
        const x = lerp(ax, bx, s / L), y = lerp(ay, by, s / L);
        this.carveCircle(x, y, r + 2.2, (tx, ty, d, idx) => {
          const t = this.tile[idx];
          if (this.flags[idx] & 8) return;
          if (d <= r) {
            if (kind === 'rail') {
              this.flags[idx] |= 2 | 1;
              if (isWaterT(t)) this.tile[idx] = T.BRIDGE;
              else if (isCliffT(t)) this.tile[idx] = T.ROCK;
            } else {
              if (isWaterT(t) || t === T.BRIDGE) this.tile[idx] = T.BRIDGE;
              else if (t !== T.TOWN && t !== T.PLANK) this.tile[idx] = T.ROAD;
              this.flags[idx] |= 1;
            }
          } else {
            if (isCliffT(t)) this.tile[idx] = T.ROCK;
            this.flags[idx] |= 1;
          }
        });
      }
    }
  }
  genRoads() {
    const towns = this.towns;
    // MST + ekstra kenarlar
    const edges = [];
    for (let i = 0; i < towns.length; i++) for (let j = i + 1; j < towns.length; j++)
      edges.push([dist(towns[i].cx, towns[i].cy, towns[j].cx, towns[j].cy), i, j]);
    edges.sort((a, b) => a[0] - b[0]);
    const parent = towns.map((_, i) => i);
    const find = i => (parent[i] === i ? i : (parent[i] = find(parent[i])));
    const chosen = [];
    for (const e of edges) { const a = find(e[1]), b = find(e[2]); if (a !== b) { parent[a] = b; chosen.push(e); } }
    let extra = 0;
    for (const e of edges) { if (extra >= 3) break; if (!chosen.includes(e) && e[0] < WW * TS * 0.42) { chosen.push(e); extra++; } }
    const C = this.cost;
    for (const [, i, j] of chosen) {
      const A = towns[i], B = towns[j];
      const ga = this.bestGate(A, B), gb = this.bestGate(B, A);
      const sx = clamp((ga.x / CG) | 0, 0, CW - 1), sy = clamp((ga.y / CG) | 0, 0, CHH - 1);
      const tx = clamp((gb.x / CG) | 0, 0, CW - 1), ty = clamp((gb.y / CG) | 0, 0, CHH - 1);
      const path = this.astar(sx, sy, tx, ty, ni => C[ni]);
      if (!path) continue;
      path.unshift([ga.x, ga.y]); path.push([gb.x, gb.y]);
      const sm = World.chaikin(path, 2);
      this.rasterRoad(sm, 1.1, 'road');
      for (const p of path) { const ci = ((p[1] / CG) | 0) * CW + ((p[0] / CG) | 0); if (C[ci] < 1e5) C[ci] = 0.6; }
      this.roads.push({ a: A.id, b: B.id, pts: sm.map(p => [p[0] * TS + 8, p[1] * TS + 8]) });
      // kasaba içine bağla (kapıdan caddeye)
    }
  }
  bestGate(A, B) {
    let best = A.gates[0], bd = 1e18;
    for (const g of A.gates) { const d = dist2(g.x * TS, g.y * TS, B.cx, B.cy); if (d < bd) { bd = d; best = g; } }
    return best;
  }
  genRails() {
    const C = this.cost;
    for (const line of RAIL_LINES) {
      const all = [];
      const stops = [];
      for (let k = 0; k < line.length - 1; k++) {
        const A = this.towns.find(t => t.id === line[k]), B = this.towns.find(t => t.id === line[k + 1]);
        const sx = (A.railPt.x / CG) | 0, sy = (A.railPt.y / CG) | 0, tx = (B.railPt.x / CG) | 0, ty = (B.railPt.y / CG) | 0;
        const path = this.astar(sx, sy, tx, ty, (ni) => {
          const c = C[ni];
          if (c >= 1e5) return c;
          return c < 1 ? 3 : c * 1.3 + 1.5;
        });
        if (!path) continue;
        path[0] = [A.railPt.x, A.railPt.y]; path[path.length - 1] = [B.railPt.x, B.railPt.y];
        path.unshift([A.railPt.x - 6, A.railPt.y]);
        path.push([B.railPt.x + 6, B.railPt.y]);
        const sm = World.chaikin(path, 3);
        this.rasterRoad(sm, 0.6, 'rail');
        if (!all.length) stops.push({ town: A.id, i: 0 });
        for (const p of sm) all.push([p[0] * TS + 8, p[1] * TS + 8]);
        stops.push({ town: B.id, i: all.length - 1 });
      }
      // kümülatif uzunluk
      const cum = [0];
      for (let i = 1; i < all.length; i++) cum.push(cum[i - 1] + dist(all[i - 1][0], all[i - 1][1], all[i][0], all[i][1]));
      for (const s of stops) s.d = cum[s.i];
      this.lines.push({ pts: all, cum, stops, len: cum[cum.length - 1] });
      this.rails.push(all);
    }
  }

  /* ---- Önemli yerler ---- */
  findSpot(near, bio, opts = {}) {
    const cx = Math.round(near[0] * WW), cy = Math.round(near[1] * WH);
    const minD = opts.minD || 30;
    const ok = (x, y) => {
      if (x < 12 || y < 12 || x >= WW - 12 || y >= WH - 12) return false;
      const t = this.tile[y * WW + x];
      if (opts.coast) {
        if (isWaterT(t) || isCliffT(t)) return false;
        let w = 0;
        for (let k = 3; k <= 9; k += 3) if (this.t(x + k, y) === T.DEEP || this.t(x + k, y) === T.WATER) w++;
        if (!w) return false;
      } else if (bio && !bio.includes(TNAME[t])) return false;
      if (isWaterT(t) || isCliffT(t) || t === T.ROAD || t === T.TOWN || t === T.PLANK || t === T.BRIDGE) return false;
      for (const tw of this.towns) if (x > tw.x - 25 && x < tw.x + tw.w + 25 && y > tw.y - 25 && y < tw.y + tw.h + 30) return false;
      for (const p of this.pois) if (dist2(x, y, p.tx, p.ty) < minD * minD) return false;
      let bad = 0;
      for (let yy = -6; yy <= 6; yy += 2) for (let xx = -6; xx <= 6; xx += 2) {
        const tt = this.t(x + xx, y + yy);
        if (isCliffT(tt) || tt === T.DEEP || (this.flags[(y + yy) * WW + x + xx] & 14)) bad++;
      }
      return bad < 3;
    };
    for (let r = 0; r < 110; r += 2) {
      const n = Math.max(1, Math.round(r * 1.5));
      for (let k = 0; k < n; k++) {
        const a = (k / n) * TAU + r;
        const x = Math.round(cx + Math.cos(a) * r), y = Math.round(cy + Math.sin(a) * r);
        if (ok(x, y)) return [x, y];
      }
    }
    return [cx, cy];
  }
  addPOI(p) {
    p.x = p.tx * TS + 8; p.y = p.ty * TS + 8;
    p.pid = this.pois.length;
    this.pois.push(p);
    return p;
  }
  setObj(x, y, o) { if (this.inb(x, y)) { const i = y * WW + x; if (!(this.flags[i] & 8)) { this.obj[i] = o; this.flags[i] |= 1; } } }
  clearArea(cx, cy, r, ground) {
    this.carveCircle(cx, cy, r, (x, y, d, i) => {
      this.obj[i] = 0; this.flags[i] |= 1;
      const t = this.tile[i];
      if (isCliffT(t) || t === T.DEEP) this.tile[i] = T.ROCK;
      if (ground !== undefined && d < r - 1.5) this.tile[i] = ground;
    });
  }
  addChest(x, y, loot) { this.setObj(x, y, O.CHEST); this.chests.set(y * WW + x, { loot }); }
  genPOIs() {
    const R = this.rng;
    for (const L of LANDMARKS) {
      const [x, y] = this.findSpot(L.near, L.bio, { coast: L.coast });
      const p = this.addPOI({ id: L.id, n: L.n, type: L.type, desc: L.desc, tx: x, ty: y, kind: 'landmark' });
      this.stampLandmark(p, R);
    }
    for (const C of CAMPS) {
      const [x, y] = this.findSpot(C.near, null, { minD: 25 });
      const p = this.addPOI({ id: 'camp_' + this.pois.length, n: C.n, type: 'camp', tx: x, ty: y, kind: 'camp', desc: 'Haydut kampı. Dikkatli ol.' });
      this.clearArea(x, y, 7, T.MUD);
      this.setObj(x, y, O.CAMPFIRE); this.lights.push({ x: p.x, y: p.y, r: 70, type: 'fire' });
      for (let k = 0; k < 4; k++) { const a = k / 4 * TAU + 0.4; this.setObj(Math.round(x + Math.cos(a) * 4), Math.round(y + Math.sin(a) * 4), O.TENT); }
      this.setObj(x + 2, y - 5, O.CRATE); this.setObj(x - 5, y + 2, O.BARREL);
      this.addChest(x + 1, y + 3, 'camp');
    }
    for (const F of FARMS) {
      const [x, y] = this.findSpot(F.near, ['GRASS', 'DRY', 'FOREST'], { minD: 22 });
      const p = this.addPOI({ id: 'farm_' + this.pois.length, n: F.n, type: 'farm', tx: x, ty: y, kind: 'farm', desc: 'Burada iş bulabilirsin.' });
      this.clearArea(x, y, 12, T.DRY);
      this.flatten(x - 12, y - 6, 26, 16, T.DRY, 0);
      const b = this.addBuilding('ranch', x - 11, y - 6, null, F.n);
      this.addBuilding('barn', x - 3, y - 7, null, F.n + ' Ambarı');
      p.building = b.id;
      for (let yy = y + 2; yy < y + 9; yy++) for (let xx = x - 10; xx < x + 12; xx++) {
        const i = yy * WW + xx; this.tile[i] = T.FARM; this.flags[i] |= 1;
        if (xx > x - 10 && xx < x + 11 && yy > y + 2 && yy < y + 8 && (xx % 2 === 0)) this.obj[i] = O.CROP;
      }
      for (let xx = x - 11; xx <= x + 12; xx++) { this.setObj(xx, y + 1, O.FENCEH); this.setObj(xx, y + 9, O.FENCEH); }
      for (let yy = y + 2; yy < y + 9; yy++) { this.setObj(x - 11, yy, O.FENCEV); this.setObj(x + 12, yy, O.FENCEV); }
      this.setObj(x - 11, y + 5, 0);
      this.setObj(x + 6, y - 3, O.WELL); this.setObj(x + 8, y - 1, O.HAY); this.setObj(x + 9, y - 3, O.HAY); this.setObj(x + 11, y - 2, O.TROUGH);
      this.connectToRoad(x - 8, y + 11);
    }
    for (const P of PROPERTIES) {
      const [x, y] = this.findSpot(P.near, ['GRASS', 'DRY', 'FOREST', 'SWAMP', 'SAND'], { minD: 18 });
      const p = this.addPOI({ id: 'prop_' + P.id, n: P.n, type: 'property', tx: x, ty: y, kind: 'property', prop: P.id, desc: P.perks });
      this.clearArea(x, y, 8);
      this.flatten(x - 5, y - 4, 12, 10, T.DRY, 0);
      const b = this.addBuilding('property', x - 3, y - 4, null, P.n, { prop: P.id });
      p.building = b.id;
      this.setObj(x + 5, y + 3, O.WELL);
      for (let xx = x - 5; xx <= x + 6; xx++) this.setObj(xx, y + 5, xx === x ? 0 : O.FENCEH);
      this.connectToRoad(x, y + 6);
    }
  }
  connectToRoad(x, y) {
    // en yakın yol noktasına kısa bir patika
    let best = null, bd = 1e18;
    for (const r of this.roads) for (let k = 0; k < r.pts.length; k += 3) {
      const d = dist2(r.pts[k][0] / TS, r.pts[k][1] / TS, x, y);
      if (d < bd) { bd = d; best = r.pts[k]; }
    }
    if (!best || bd > 110 * 110) return;
    const C = this.cost;
    const path = this.astar(clamp((x / CG) | 0, 0, CW - 1), clamp((y / CG) | 0, 0, CHH - 1), (best[0] / TS / CG) | 0, (best[1] / TS / CG) | 0, ni => C[ni] >= 1e5 ? 1e6 : C[ni]);
    if (!path) return;
    path.unshift([x, y]);
    const sm = World.chaikin(path, 2);
    this.rasterRoad(sm, 0.8, 'road');
    this.roads.push({ spur: true, pts: sm.map(p => [p[0] * TS + 8, p[1] * TS + 8]) });
  }
  stampLandmark(p, R) {
    const x = p.tx, y = p.ty;
    switch (p.type) {
      case 'crater':
        this.carveCircle(x, y, 11, (tx, ty, d, i) => { this.obj[i] = 0; this.flags[i] |= 1; this.tile[i] = d > 8 ? T.REDROCK : T.SAND; });
        this.addChest(x, y, 'crater');
        break;
      case 'sequoia':
        this.clearArea(x, y, 6);
        this.setObj(x, y, O.SEQUOIA);
        for (let k = 0; k < 6; k++) this.setObj(x + R.int(-5, 5), y + R.int(3, 6), R.chance(0.5) ? O.MUSHROOM : O.GINSENG);
        this.addChest(x + 2, y + 2, 'nature');
        break;
      case 'ruins':
        this.clearArea(x, y, 9, T.TOWN);
        for (let k = -5; k <= 5; k++) {
          if (R.chance(0.75)) this.setObj(x + k, y - 5, O.RUINWALL);
          if (R.chance(0.6) && Math.abs(k) > 1) this.setObj(x + k, y + 5, O.RUINWALL);
          if (R.chance(0.7)) this.setObj(x - 5, y + k, O.RUINWALL);
          if (R.chance(0.7)) this.setObj(x + 5, y + k, O.RUINWALL);
        }
        this.setObj(x, y - 3, O.CROSS); this.addChest(x + 2, y - 2, 'ruins'); this.setObj(x - 2, y + 1, O.ARTIFACT);
        break;
      case 'ghost':
        this.clearArea(x, y, 12, T.DRY);
        for (let yy = y - 1; yy <= y + 1; yy++) for (let xx = x - 12; xx <= x + 12; xx++) this.tile[yy * WW + xx] = T.ROAD;
        this.addBuilding('ruin', x - 11, y - 7, null, 'Hollow Rock Saloon');
        this.addBuilding('ruin', x - 3, y - 7, null, 'Hollow Rock Mağazası');
        this.addBuilding('ruin', x + 5, y - 7, null, 'Hollow Rock Oteli');
        this.addBuilding('ruin', x - 7, y + 3, null, 'Ev', { w: 5, h: 4 });
        for (let k = 0; k < 5; k++) this.setObj(x + 4 + k * 2, y + 5, O.GRAVE);
        this.addChest(x, y + 4, 'ghost');
        break;
      case 'mine':
        this.clearArea(x, y, 8, T.ROCK);
        this.carveCircle(x, y - 9, 6, (tx, ty, d, i) => { if (ty < y - 6) { this.tile[i] = T.CLIFF; this.obj[i] = 0; } });
        this.addBuilding('mineentrance', x - 2, y - 6, null, 'Terk Edilmiş Maden');
        for (let k = 0; k < 9; k++) this.setObj(x + R.int(-7, 7), y + R.int(0, 6), O.ORE);
        this.setObj(x + 4, y - 2, O.CRATE); this.setObj(x - 5, y - 2, O.WAGON); this.addChest(x + 3, y + 3, 'mine');
        break;
      case 'hotspring':
        this.clearArea(x, y, 7, T.ROCK);
        this.carveCircle(x, y, 4, (tx, ty, d, i) => { this.tile[i] = T.HOTWATER; this.obj[i] = 0; });
        for (let k = 0; k < 10; k++) { const a = k / 10 * TAU; this.setObj(Math.round(x + Math.cos(a) * 6), Math.round(y + Math.sin(a) * 6), k % 3 ? O.ROCK : O.BOULDER); }
        this.setObj(x, y, O.STEAM);
        break;
      case 'dino':
        this.clearArea(x, y, 8, T.REDROCK);
        this.setObj(x, y, O.BIGBONES); this.setObj(x - 4, y + 2, O.BONES); this.setObj(x + 4, y - 2, O.BONES);
        this.addChest(x + 2, y + 3, 'dino');
        break;
      case 'hanging':
        this.clearArea(x, y, 6);
        this.setObj(x, y, O.GALLOWS); this.setObj(x - 3, y + 3, O.GRAVE); this.setObj(x - 1, y + 3, O.GRAVE); this.setObj(x + 3, y - 2, O.DEAD);
        break;
      case 'wreck':
        this.clearArea(x, y, 5);
        this.setObj(x, y, O.WAGON); this.setObj(x + 2, y + 1, O.CRATE); this.setObj(x - 2, y + 2, O.BARREL); this.setObj(x - 3, y - 1, O.BONES);
        this.addChest(x + 1, y - 2, 'wreck');
        break;
      case 'lighthouse':
        this.clearArea(x, y, 5, T.ROCK);
        this.addBuilding('lighthouse', x - 2, y - 3, null, p.n);
        this.addChest(x + 3, y + 2, 'coast');
        break;
      case 'hermit':
        this.clearArea(x, y, 6);
        this.addBuilding('hermit', x - 2, y - 3, null, p.n);
        this.setObj(x + 3, y + 3, O.CAMPFIRE); this.lights.push({ x: (x + 3) * TS + 8, y: (y + 3) * TS + 8, r: 60, type: 'fire' });
        this.setObj(x - 3, y + 3, O.BARREL);
        break;
      case 'trapper':
        this.clearArea(x, y, 6);
        this.addBuilding('cabin', x - 3, y - 3, null, p.n);
        this.setObj(x + 4, y + 3, O.CAMPFIRE); this.lights.push({ x: (x + 4) * TS + 8, y: (y + 3) * TS + 8, r: 60, type: 'fire' });
        this.setObj(x - 3, y + 3, O.CRATE); this.setObj(x - 4, y + 3, O.HAY);
        break;
      case 'battlefield':
        this.clearArea(x, y, 9, T.GRASS);
        for (let yy = -3; yy <= 3; yy += 2) for (let xx = -6; xx <= 6; xx += 2) if (R.chance(0.8)) this.setObj(x + xx, y + yy, O.CROSS);
        this.setObj(x + 8, y, O.WAGON); this.addChest(x - 8, y + 1, 'battle');
        break;
      case 'fortruin':
        this.clearArea(x, y, 11, T.DRY);
        for (let k = -8; k <= 8; k++) {
          if (R.chance(0.8)) this.setObj(x + k, y - 8, O.RUINWALL);
          if (R.chance(0.7) && Math.abs(k) > 2) this.setObj(x + k, y + 8, O.RUINWALL);
          if (R.chance(0.8)) this.setObj(x - 8, y + k, O.RUINWALL);
          if (R.chance(0.8)) this.setObj(x + 8, y + k, O.RUINWALL);
        }
        this.addBuilding('ruin', x - 5, y - 6, null, 'Yıkık Kışla', { w: 7, h: 4 });
        this.setObj(x + 3, y + 2, O.WAGON); this.addChest(x + 4, y - 4, 'battle');
        break;
      case 'windmill':
        this.clearArea(x, y, 6, T.GRASS);
        this.setObj(x, y, O.WINDMILL); this.setObj(x + 3, y + 1, O.WELL); this.setObj(x - 3, y + 2, O.TROUGH);
        this.addChest(x - 2, y - 2, 'farm');
        break;
      case 'oasis':
        this.clearArea(x, y, 9, T.GRASS);
        this.carveCircle(x, y, 4.5, (tx, ty, d, i) => { this.tile[i] = d < 2.5 ? T.DEEP : T.WATER; this.obj[i] = 0; });
        for (let k = 0; k < 8; k++) { const a = k / 8 * TAU; this.setObj(Math.round(x + Math.cos(a) * 7), Math.round(y + Math.sin(a) * 7), k % 2 ? O.OAK : O.BUSH); }
        this.setObj(x + 6, y + 3, O.MINT); this.setObj(x - 6, y - 2, O.YARROW);
        break;
      case 'lookout':
        this.clearArea(x, y, 5, T.ROCK);
        for (let k = 0; k < 8; k++) { const a = k / 8 * TAU; this.setObj(Math.round(x + Math.cos(a) * 5), Math.round(y + Math.sin(a) * 5), O.BOULDER); }
        this.setObj(x + 5, y, 0); this.setObj(x - 5, y, 0);
        break;
      case 'cave':
        this.clearArea(x, y, 7, T.ROCK);
        this.carveCircle(x, y - 6, 5, (tx, ty, d, i) => { if (ty <= y - 4) { this.tile[i] = T.CLIFF; this.obj[i] = 0; } });
        this.addBuilding('mineentrance', x - 2, y - 4, null, 'Ayı İni', { w: 5, h: 2, cave: 1 });
        this.setObj(x - 2, y + 1, O.BONES); this.setObj(x + 2, y, O.BONES);
        this.addChest(x + 3, y - 1, 'cave');
        break;
      case 'graveyard':
        this.clearArea(x, y, 8, T.GRASS);
        for (let k = -6; k <= 6; k++) { this.setObj(x + k, y - 5, O.FENCEH); if (k !== 0) this.setObj(x + k, y + 5, O.FENCEH); }
        for (let k = -4; k <= 4; k++) { this.setObj(x - 6, y + k, O.FENCEV); this.setObj(x + 6, y + k, O.FENCEV); }
        for (let yy = -3; yy <= 3; yy += 2) for (let xx = -4; xx <= 4; xx += 2) this.setObj(x + xx, y + yy, R.chance(0.5) ? O.GRAVE : O.CROSS);
        this.setObj(x, y + 3, 0); this.addChest(x + 4, y + 3, 'grave');
        break;
      case 'shipwreck':
        this.clearArea(x, y, 6, T.SAND);
        this.setObj(x, y, O.SHIP); this.setObj(x - 3, y + 3, O.CRATE); this.setObj(x - 4, y + 2, O.BARREL);
        this.addChest(x + 2, y + 3, 'ship');
        break;
      case 'arch':
        this.clearArea(x, y, 7, T.REDROCK);
        this.setObj(x, y, O.ARCH); this.setObj(x + 3, y + 3, O.ARTIFACT);
        break;
    }
  }

  /* ---- Bitki örtüsü ---- */
  genObjects() {
    const s = this.seed;
    const tile = this.tile, obj = this.obj, flags = this.flags;
    const dens = new Noise(s + 77);
    // yol kenarlarına boşluk (flag 1 zaten)
    for (let y = 1; y < WH - 1; y++) {
      for (let x = 1; x < WW - 1; x++) {
        const i = y * WW + x;
        if (flags[i] & 1 || obj[i]) continue;
        const t = tile[i];
        const h = hash2(x, y, s), h2 = hash2(x, y, s + 5);
        const d = dens.v(x * 0.05, y * 0.05);
        let o = 0;
        switch (t) {
          case T.FOREST:
            if (h < 0.1 + d * 0.28) o = (y / WH < 0.25 || h2 < 0.55) ? O.PINE : (h2 < 0.85 ? O.OAK : O.BIRCH);
            else if (h < 0.43) o = O.BUSH;
            else if (h < 0.455) o = O.TUFT;
            else if (h < 0.465) o = pick6(h2, [O.GINSENG, O.MUSHROOM, O.BERRY, O.YARROW, O.MILKWEED, O.WFLOWER]);
            else if (h < 0.47) o = O.ROCK;
            break;
          case T.GRASS:
            if (h < 0.012 + d * 0.05) o = h2 < 0.08 ? O.APPLE : O.OAK;
            else if (h < 0.08) o = O.BUSH;
            else if (h < 0.14) o = O.TUFT;
            else if (h < 0.17) o = O.FLOWERS;
            else if (h < 0.178) o = pick6(h2, [O.YARROW, O.MINT, O.OREGANO, O.BERRY, O.WFLOWER, O.MILKWEED]);
            else if (h < 0.184) o = O.ROCK;
            break;
          case T.DRY:
            if (h < 0.006) o = O.DEAD;
            else if (h < 0.004 + d * 0.012) o = O.OAK;
            else if (h < 0.05) o = O.DRYBUSH;
            else if (h < 0.1) o = O.TUFT;
            else if (h < 0.11) o = O.ROCK;
            else if (h < 0.114) o = h2 < 0.5 ? O.SAGE : O.OREGANO;
            else if (h < 0.1145) o = O.ARTIFACT;
            break;
          case T.DESERT:
            if (h < 0.012) o = O.SAGUARO;
            else if (h < 0.03) o = O.CACTUS;
            else if (h < 0.06) o = O.DRYBUSH;
            else if (h < 0.075) o = O.ROCK;
            else if (h < 0.078) o = O.BOULDER;
            else if (h < 0.081) o = O.SAGE;
            else if (h < 0.0815) o = O.BONES;
            else if (h < 0.082) o = O.ARTIFACT;
            break;
          case T.REDROCK:
            if (h < 0.04) o = O.ROCK;
            else if (h < 0.06) o = O.BOULDER;
            else if (h < 0.08) o = O.DRYBUSH;
            else if (h < 0.09) o = O.CACTUS;
            else if (h < 0.0905) o = O.ARTIFACT;
            break;
          case T.SWAMP:
            if (h < 0.08 + d * 0.12) o = O.CYPRESS;
            else if (h < 0.26) o = O.REED;
            else if (h < 0.32) o = O.BUSH;
            else if (h < 0.335) o = pick6(h2, [O.MUSHROOM, O.MILKWEED, O.YARROW, O.MINT, O.BERRY, O.WFLOWER]);
            break;
          case T.SNOW:
            if (h < 0.05 + d * 0.16) o = O.SNOWPINE;
            else if (h < 0.24) o = O.ROCK;
            else if (h < 0.245) o = O.GINSENG;
            break;
          case T.ROCK:
            if (h < 0.03) o = O.BOULDER;
            else if (h < 0.09) o = O.ROCK;
            else if (h < 0.1) o = O.ORE;
            else if (h < 0.14 && y / WH < 0.5) o = O.PINE;
            else if (h < 0.15) o = O.DRYBUSH;
            break;
          case T.SAND:
            if (h < 0.02) o = O.ROCK;
            else if (h < 0.03) o = O.DRYBUSH;
            break;
          case T.WATER:
            if (h < 0.05 && (tile[i - 1] > T.WATER || tile[i + 1] > T.WATER)) o = O.REED;
            break;
        }
        if (o) {
          // ağaçlar arası boşluk
          if (SOLID_O[o] && (SOLID_O[obj[i - 1]] || SOLID_O[obj[i - WW]] || SOLID_O[obj[i - WW - 1]] || SOLID_O[obj[i - WW + 1]])) continue;
          obj[i] = o;
        }
      }
    }
    // telgraf direkleri demiryolu boyunca
    for (const r of this.rails) {
      for (let k = 0; k < r.length; k += 9) {
        const [px, py] = r[k];
        const nx = (px >> 4) + 2, ny = (py >> 4) - 2;
        if (this.inb(nx, ny) && !(this.flags[ny * WW + nx] & 10) && !isWaterT(this.t(nx, ny))) this.obj[ny * WW + nx] = O.POLE;
      }
    }
    function pick6(h, arr) { return arr[Math.floor(h * arr.length) % arr.length]; }
  }
  computeSolid() {
    const N = WW * WH;
    for (let i = 0; i < N; i++) {
      this.solid[i] = (TINFO[this.tile[i]].solid || SOLID_O[this.obj[i]] || (this.flags[i] & 8)) ? 1 : 0;
    }
    // sekoya ve kemer daha büyük
    for (let i = 0; i < N; i++) {
      const o = this.obj[i];
      if (o === O.SEQUOIA || o === O.WINDMILL) { for (let y = -1; y <= 1; y++) for (let x = -1; x <= 1; x++) this.solid[i + y * WW + x] = 1; }
      if (o === O.SHIP) { for (let x = -3; x <= 3; x++) this.solid[i + x] = 1; }
      if (o === O.ARCH) { this.solid[i - 3] = this.solid[i + 3] = this.solid[i - 2] = this.solid[i + 2] = 1; this.solid[i] = 0; }
      if (o === O.WAGON) { this.solid[i + 1] = 1; }
    }
  }

  /* ---- Parşömen harita görüntüsü ---- */
  buildMapImage() {
    const c = makeCanvas(WW, WH), ctx = c.getContext('2d');
    const img = ctx.createImageData(WW, WH), d = img.data;
    const MC = TINFO.map(t => hexToRgb(t.map));
    for (let y = 0; y < WH; y++) for (let x = 0; x < WW; x++) {
      const i = y * WW + x, t = this.tile[i];
      let [r, g, b] = MC[t];
      const e0 = this.elev[i], e1 = this.elev[Math.min(WW * WH - 1, i + WW + 1)];
      let sh = (e0 - e1) * 1.6;
      if (isCliffT(t) && ((x + y) % 3 === 0)) sh -= 34;
      if (t === T.ROCK && ((x - y) % 4 === 0)) sh -= 16;
      const o = this.obj[i];
      if (o && SOLID_O[o] && o < 20) sh -= 22;
      if (this.flags[i] & 2) { r = 40; g = 30; b = 22; sh = ((x + y) & 1) ? 0 : 50; }
      if (this.flags[i] & 8) { r = 70; g = 46; b = 30; sh = 0; }
      const n = (hash2(x, y, 3) - 0.5) * 10;
      const k = i * 4;
      d[k] = clamp(r + sh + n, 0, 255); d[k + 1] = clamp(g + sh + n, 0, 255); d[k + 2] = clamp(b + sh * 0.8 + n, 0, 255); d[k + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    this.mapCanvas = c;
  }

  /* ======================================================
     CHUNK RENDER
     ====================================================== */
  static initTables(seed) {
    const P = 128;
    World.JX = new Int8Array(P * P); World.JY = new Int8Array(P * P); World.DET = new Float32Array(P * P);
    const nx = new Noise(seed + 501, 16), ny = new Noise(seed + 502, 16), nd = new Noise(seed + 503, 64);
    for (let y = 0; y < P; y++) for (let x = 0; x < P; x++) {
      const k = y * P + x;
      World.JX[k] = Math.round((nx.fbm(x / 8, y / 8, 2) - 0.5) * 16);
      World.JY[k] = Math.round((ny.fbm(x / 8, y / 8, 2) - 0.5) * 16);
      World.DET[k] = (nd.v(x / 2, y / 2) - 0.5) * 1.4 + (hash2(x, y, 9) - 0.5) * 0.8;
    }
  }
  getChunk(cx, cy, sync) {
    const key = cy * 64 + cx;
    let c = this.chunks.get(key);
    if (c) { c.used = performance.now(); return c; }
    if (!sync) { this.requestChunk(cx, cy); return null; }
    let job = this.jobs.get(key);
    if (!job) job = { gen: this.chunkJob(cx, cy) };
    let r;
    do { r = job.gen.next(); } while (!r.done);
    this.jobs.delete(key);
    return this.storeChunk(key, r.value);
  }
  requestChunk(cx, cy) {
    if (cx < 0 || cy < 0 || cx >= WW / CHUNK || cy >= WH / CHUNK) return;
    const key = cy * 64 + cx;
    if (this.chunks.has(key) || this.jobs.has(key)) return;
    this.jobs.set(key, { gen: this.chunkJob(cx, cy) });
  }
  storeChunk(key, c) {
    c.used = performance.now();
    this.chunks.set(key, c);
    if (this.chunks.size > 36) {
      let oldK = -1, oldT = Infinity;
      for (const [k, v] of this.chunks) if (v.used < oldT) { oldT = v.used; oldK = k; }
      this.chunks.delete(oldK);
    }
    return c;
  }
  runJobs(budget) {
    const t0 = performance.now();
    for (const [k, j] of this.jobs) {
      while (true) {
        const r = j.gen.next();
        if (r.done) { this.jobs.delete(k); this.storeChunk(k, r.value); break; }
        if (performance.now() - t0 > budget) return;
      }
      if (performance.now() - t0 > budget) return;
    }
  }
  invalidateChunkAt(px, py) {
    const cx = Math.floor(px / CPX), cy = Math.floor(py / CPX);
    this.chunks.delete(cy * 64 + cx);
    this.jobs.delete(cy * 64 + cx);
  }
  renderChunk(cx, cy) {
    const g = this.chunkJob(cx, cy);
    let r; do { r = g.next(); } while (!r.done);
    return r.value;
  }
  *chunkJob(cx, cy) {
    const g = makeCanvas(CPX, CPX), gc = g.getContext('2d');
    const img = gc.createImageData(CPX, CPX), d = img.data;
    const ox = cx * CPX, oy = cy * CPX;
    const tile = this.tile, JX = World.JX, JY = World.JY, DET = World.DET;
    const TV = World.TV || (World.TV = new Float32Array(TINFO.map(t => t.v)));
    const MAXP = WW * TS - 1;
    const CL = World.CLF || (World.CLF = new Uint8Array(TINFO.map(t => (t.cliff ? 1 : 0))));
    const WA = World.WAF || (World.WAF = new Uint8Array(TINFO.map((t, i) => (i === T.WATER || i === T.DEEP || i === T.HOTWATER || i === T.BRIDGE ? 1 : 0))));
    // karo düzeyinde: üstünde uçurum var mı?
    const TW = CHUNK + 4;
    const nearCliff = new Uint8Array(TW * TW);
    for (let ty = 0; ty < TW; ty++) for (let tx = 0; tx < TW; tx++) {
      const wx = cx * CHUNK + tx - 2, wy = cy * CHUNK + ty - 2;
      let f = 0;
      for (let yy = -1; yy <= 1 && !f; yy++) for (let xx = -1; xx <= 1; xx++) if (CL[this.t(wx + xx, wy + yy)]) { f = 1; break; }
      nearCliff[ty * TW + tx] = f;
    }
    const tAt = (sx, sy) => {
      if (sx < 0) sx = 0; else if (sx > MAXP) sx = MAXP;
      if (sy < 0) sy = 0; else if (sy > MAXP) sy = MAXP;
      return tile[(sy >> 4) * WW + (sx >> 4)];
    };
    for (let py = 0; py < CPX; py++) {
      const wy = oy + py;
      const ky = (wy & 127) << 7;
      const rowT = (wy >> 4) * WW;
      const ncRow = (((wy >> 4) - cy * CHUNK) + 2) * TW;
      for (let px = 0; px < CPX; px++) {
        const wx = ox + px;
        const k = (wx & 127) + ky;
        const base = tile[rowT + (wx >> 4)];
        let t = base;
        if (base !== T.BRIDGE && base !== T.PLANK) {
          let sx = wx + JX[k], sy = wy + JY[k];
          if (sx < 0) sx = 0; else if (sx > MAXP) sx = MAXP;
          if (sy < 0) sy = 0; else if (sy > MAXP) sy = MAXP;
          t = tile[(sy >> 4) * WW + (sx >> 4)];
          if (t === T.BRIDGE || t === T.PLANK) t = base;
        }
        const col = TPAL[t];
        let v = DET[k] * TV[t];
        let mul = 1;
        if (nearCliff[ncRow + ((wx >> 4) - cx * CHUNK) + 2]) {
          if (CL[t]) {
            if (!CL[tAt(wx + (JX[k] >> 1), wy + 7)]) { mul = 0.72; if ((wx * 3 + (wy >> 1)) % 5 === 0) v -= 10; }
            else if (!CL[tAt(wx, wy - 5)]) v += 16;
          } else if (CL[tAt(wx - 3, wy - 9)]) mul = 0.7;
        }
        if (WA[t]) {
          if (t !== T.BRIDGE) {
            if (!WA[tAt(wx, wy - 4)]) mul *= 0.8;
            else if (((wy * 2 + (wx >> 2) + ((wx * 7) >> 5)) % 11) === 0) v += 10;
          } else { if ((wy & 3) === 0) mul = 0.7; const m = wx & 15; if (m === 0 || m === 15) mul = 0.55; }
        } else if (t === T.FARM) { if ((wy & 3) === 0) mul = 0.8; }
        else if (t === T.PLANK) { if (wx % 5 === 0) mul = 0.75; if ((wy & 15) === 15) mul = 0.6; }
        else if (t === T.ROAD) { if ((wx + wy * 3) % 9 === 0) v -= 8; }
        const i = (py * CPX + px) << 2;
        d[i] = (col[0] + v) * mul;
        d[i + 1] = (col[1] + v) * mul;
        d[i + 2] = (col[2] + v * 0.8) * mul;
        d[i + 3] = 255;
      }
      if ((py & 63) === 63) yield 0;
    }
    gc.putImageData(img, 0, 0);
    yield 0;
    const o = makeCanvas(CPX, CPX), oc = o.getContext('2d');
    gc.save(); oc.save();
    gc.translate(-ox, -oy); oc.translate(-ox, -oy);
    for (const r of this.rails) this.drawRail(gc, r, ox, oy);
    const tx0 = cx * CHUNK - 3, ty0 = cy * CHUNK - 3, tx1 = tx0 + CHUNK + 6, ty1 = ty0 + CHUNK + 6;
    for (let ty = ty0; ty < ty1; ty++) {
      for (let tx = tx0; tx < tx1; tx++) {
        if (!this.inb(tx, ty)) continue;
        const ob = this.obj[ty * WW + tx];
        if (ob && !isHerbO(ob) && ob !== O.ARTIFACT) Spr.object(gc, oc, ob, tx * TS + 8, ty * TS + 8, hash2(tx, ty, 77), this);
      }
      if ((ty & 15) === 0) yield 0;
    }
    for (const b of this.buildings) {
      const bx = b.x * TS, by = b.y * TS;
      if (bx + b.w * TS + 40 < ox || bx - 40 > ox + CPX || by + b.h * TS + 40 < oy || by - 60 > oy + CPX) continue;
      Spr.building(gc, oc, b);
    }
    gc.restore(); oc.restore();
    return { g, o };
  }
  drawRail(ctx, r, ox, oy) {
    const x0 = ox - 20, y0 = oy - 20, x1 = ox + CPX + 20, y1 = oy + CPX + 20;
    ctx.lineCap = 'butt';
    for (let i = 0; i < r.length - 1; i++) {
      const [ax, ay] = r[i], [bx, by] = r[i + 1];
      if (Math.max(ax, bx) < x0 || Math.min(ax, bx) > x1 || Math.max(ay, by) < y0 || Math.min(ay, by) > y1) continue;
      const L = dist(ax, ay, bx, by), ux = (bx - ax) / L, uy = (by - ay) / L, nx = -uy, ny = ux;
      ctx.strokeStyle = '#4a3522'; ctx.lineWidth = 2;
      const cnt = Math.floor(L / 4);
      ctx.beginPath();
      for (let s = 0; s <= cnt; s++) {
        const px = ax + ux * s * 4, py = ay + uy * s * 4;
        ctx.moveTo(px + nx * 5, py + ny * 5); ctx.lineTo(px - nx * 5, py - ny * 5);
      }
      ctx.stroke();
    }
    for (const off of [-3, 3]) {
      ctx.strokeStyle = '#7d7d80'; ctx.lineWidth = 1.2;
      ctx.beginPath();
      let started = false;
      for (let i = 0; i < r.length; i++) {
        const [ax, ay] = r[i];
        const [bx, by] = r[Math.min(i + 1, r.length - 1)];
        const [cx, cy] = r[Math.max(i - 1, 0)];
        const L = Math.hypot(bx - cx, by - cy) || 1;
        const nx = -(by - cy) / L, ny = (bx - cx) / L;
        const px = ax + nx * off, py = ay + ny * off;
        if (px < x0 - 40 || px > x1 + 40 || py < y0 - 40 || py > y1 + 40) { started = false; continue; }
        if (!started) { ctx.moveTo(px, py); started = true; } else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
  }
}
