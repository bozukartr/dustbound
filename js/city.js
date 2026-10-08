'use strict';
/* ==========================================================
   FRONTIER'S END — planlı şehir: Saint Clement (dünya sürümü 4+)
   Kasabalar dağınık ve organik büyür; şehir ızgara planlıdır:
   - Ortadan doğu-batı uzanan ana cadde ve onu kesen kuzey-güney
     caddesi (geniş taşıt yolu, üç karo kaldırım, sokak ağaçları);
     aralarında sokaklar (dar taşıt yolu, iki karo kaldırım).
   - Taşıt yolu arnavut kaldırımı; iki yanında bordürlü taş kaldırım.
   - Binalar blok blok, cepheleri aynı hizada sokağa bakar; arkada
     bahçe ve avlu. Bir blok meydan, iki yer park.
   - İş yerleri kendi semtine yerleşir: ana caddede banka, otel,
     pazar ve saloon; güneyde ambar, liman deposu ve zanaatkârlar;
     kuzeyde evler, kilise ve arsalar.
   - Sokak ağı (kavşak düğümleri, şeritler) şehir trafiği için
     saklanır: faytonlar, yük arabaları ve atlı vatandaşlar sağ
     şeritten gider, kavşaklarda döner, kaldırım kenarında durur.
   Eski kayıtların dünyası (sürüm 2-3) eski kurallarla üretilir.
   ========================================================== */

/* Gündüz hedeflenen şehir trafiği (saat ve havayla azalır) */
const CITY_CARTS = 7, CITY_RIDERS = 6;
/* İş yerlerinin tercih ettiği semt: [sıra, sütun] — sıra 0 kuzey (evler), 1 ana cadde, 2 orta, 3 güney (istasyon yanı);
   sütun 0 batı … 3 doğu (kıyı) */
const CITY_ZONE = {
  market: [1, 1.6], bank: [1, 1.2], hotel: [1, 2], county: [1, 1.4], gambling: [1, 2.8], saloon: [1, 2.4], general: [1, 0.6],
  post: [2, 2], pharmacy: [2, 2.2], tailor: [2, 2.6], barber: [2, 2.4], cantina: [2, 2.8], sheriff: [2, 0.2], doctor: [2, 0.4], land: [2, 0.6],
  church: [0, 1.2], house: [0, 2], gunsmith: [3, 1], butcher: [3, 0.8], bakery: [3, 1.4], laundry: [3, 1.2], smith: [3, 0.4],
  stable: [3, 0], warehouse: [3, 3], brewery: [3, 2.4], docks: [3, 3], lot: [0, 0.4], park: [0, 2.8],
};
/* Yerleşim sırası: önce en iyi yerleri alacak binalar; arsalar, park ve evler en son */
const CITY_PRIO = ['market', 'bank', 'hotel', 'county', 'saloon', 'general', 'gambling', 'post', 'sheriff', 'doctor', 'church', 'land', 'pharmacy', 'tailor', 'barber', 'docks', 'warehouse', 'brewery', 'stable'];

World.prototype.genCity = function (td, big) {
  const R = this.rng;
  const SW = 2, RW = 3, ASW = 3, ARW = 4, BW = 26, RD = 12, EXT = 8;
  // ---- plan (yerel karo): kuzey-güney sokaklar ve blok sütunları batıdan doğuya, sıralar ve doğu-batı sokaklar kuzeyden güneye
  const vst = [], cols = [], hst = [], rows = [];
  let W = 0, H = 0;
  for (const k of ['s', 'b', 's', 'b', 'a', 'b', 's', 'b', 's']) {
    if (k === 'b') { cols.push({ l: W, r: W + BW }); W += BW; continue; }
    const av = k === 'a', sw = av ? ASW : SW, rw = av ? ARW : RW;
    vst.push({ l: W, sw, rw, av, w: sw * 2 + rw }); W += sw * 2 + rw;
  }
  for (const k of ['r', 's', 'r', 'a', 'r', 's', 'r', 's']) {
    if (k === 'r') { rows.push({ t: H, f: H + RD }); H += RD; continue; }   // f: cephe hizası (önündeki sokağın ilk kaldırım sırası)
    const av = k === 'a', sw = av ? ASW : SW, rw = av ? ARW : RW;
    hst.push({ t: H, sw, rw, av, w: sw * 2 + rw }); H += sw * 2 + rw;
  }
  const XC = vst[2], AVE = hst[1];
  // iki caddenin kesiştiği yer şehrin haritadaki noktasına oturur; doğu kenarı denize taşmaz
  const cxT = Math.round(td.px * WW), cyT = Math.round(td.py * WH);
  let X0 = cxT - XC.l - (XC.w >> 1), Y0 = cyT - AVE.t - (AVE.w >> 1);
  let coast = Infinity;
  for (let y = Y0 - 6; y < Y0 + H + 16; y += 2) for (let x = cxT; x < X0 + W + 40; x++) {
    const t = this.t(x, y);
    if (t === T.DEEP || (t === T.WATER && this.t(x + 5, y) === T.DEEP)) { coast = Math.min(coast, x); break; }
  }
  if (X0 + W + 6 > coast) X0 -= Math.min(X0 + W + 6 - coast, 50);
  X0 = clamp(X0, 24, WW - W - 24); Y0 = clamp(Y0, 24, WH - H - 40);
  const town = { ...td, x: X0 - 3, y: Y0 - 3, w: W + 6, h: H + 6, cx: (X0 + XC.l + (XC.w >> 1)) * TS, cy: (Y0 + AVE.t + (AVE.w >> 1)) * TS,
    buildings: [], streetPts: [], hitch: [], gates: [], lots: [], rx: W >> 1, ry: H >> 1, modern: true, parks: [], plan: 'grid' };
  this.towns.push(town);
  const inR = (x, y, m) => x >= X0 - m && y >= Y0 - m && x < X0 + W + m && y < Y0 + H + m;
  // ---- zemin: kenarlar yumuşar; şehrin içi baştan çimen (avlular), üstüne sokaklar ve binalar gelir
  for (let y = town.y - 12; y < town.y + town.h + 22; y++) for (let x = town.x - 12; x < town.x + town.w + 12; x++) {
    if (!this.inb(x, y)) continue;
    const i = y * WW + x, t = this.tile[i];
    if (isCliffT(t)) this.tile[i] = T.ROCK;
    if (t === T.DEEP) this.tile[i] = T.WATER;
    this.flags[i] |= 1;
    if (inR(x, y, 3)) { this.obj[i] = 0; this.flags[i] |= 4; this.tile[i] = T.GRASS; }
  }
  // yerel doluluk ızgarası: 3 sokak, 2 bina/park/arsa, 5 süs ya da ayrılmış, 0 boş (avlu)
  const ox = town.x - 12, oy = town.y - 12, OW = town.w + 24, OH = town.h + 34, occ = new Uint8Array(OW * OH);
  const oget = (x, y) => (x < ox || y < oy || x >= ox + OW || y >= oy + OH) ? 9 : occ[(y - oy) * OW + (x - ox)];
  const oset = (x, y, v) => { if (x >= ox && y >= oy && x < ox + OW && y < oy + OH) occ[(y - oy) * OW + (x - ox)] = v; };
  const ground = (x, y) => { const i = y * WW + x; if (this.tile[i] !== T.COBBLE && this.tile[i] !== T.PLANK) this.tile[i] = T.PAVE; this.flags[i] |= 1 | 4; this.obj[i] = 0; };
  const paint = (lx, ly, t) => {
    const x = X0 + lx, y = Y0 + ly;
    if (!this.inb(x, y)) return;
    const i = y * WW + x; this.tile[i] = t; this.obj[i] = 0; this.flags[i] |= 1 | 4; oset(x, y, 3);
  };
  // ---- sokaklar: önce kaldırımlar, sonra taşıt yolları (kavşakta yol kesintisiz geçer, köşeler kaldırım kalır)
  const nsTop = hst[0].t + hst[0].sw, nsBot = hst[3].t + hst[3].sw + hst[3].rw;
  for (const s of hst) for (let lx = 0; lx < W; lx++) for (let k = 0; k < s.sw; k++) { paint(lx, s.t + k, T.PAVE); paint(lx, s.t + s.sw + s.rw + k, T.PAVE); }
  for (const v of vst) for (let ly = v === XC ? 0 : hst[0].t; ly < H; ly++) for (let k = 0; k < v.sw; k++) { paint(v.l + k, ly, T.PAVE); paint(v.l + v.sw + v.rw + k, ly, T.PAVE); }
  const road = (lx, ly) => paint(lx, ly, lx >= -3 && ly >= -3 && lx < W + 3 && ly < H + 3 ? T.COBBLE : T.ROAD);
  for (const s of hst) {
    const a = s === AVE ? -EXT : vst[0].l + vst[0].sw, b = s === AVE ? W + EXT : vst[4].l + vst[4].sw + vst[4].rw;
    for (let lx = a; lx < b; lx++) for (let k = 0; k < s.rw; k++) road(lx, s.t + s.sw + k);
  }
  for (const v of vst) for (let ly = v === XC ? -EXT : nsTop; ly < nsBot; ly++) for (let k = 0; k < v.rw; k++) road(v.l + v.sw + k, ly);
  // kapılar: ana caddenin iki ucu ve orta caddenin kuzey ucu (şehir sınırının dışında; yollar buradan bağlanır)
  const aveMid = AVE.t + AVE.sw + (AVE.rw >> 1), xcMid = XC.l + XC.sw + (XC.rw >> 1);
  town.gates.push({ x: X0 - EXT, y: Y0 + aveMid }, { x: X0 + xcMid, y: Y0 - EXT }, { x: X0 + W + EXT - 1, y: Y0 + aveMid });
  town.gateY = town.gates[0].y;

  // ---- bloklar: en kuzey sıra iki uzun blok (yalnız orta cadde böler), diğer sıralar dörder blok
  const blocks = [{ row: 0, col: 0.6, l: 0, r: XC.l }, { row: 0, col: 2.4, l: XC.l + XC.w, r: W }];
  for (let ri = 1; ri < rows.length; ri++) cols.forEach((c, ci) => blocks.push({ row: ri, col: ci, l: c.l, r: c.r }));
  for (const B of blocks) { B.t = rows[B.row].t; B.f = rows[B.row].f; B.items = []; B.fill = 0; B.street = hst[B.row]; }
  const blk = (row, col) => blocks.find(B => B.row === row && B.col === col);
  blk(2, 1).kind = 'plaza';   // ana caddenin güneyinde, iki caddenin köşesinde meydan
  blk(3, 0).kind = 'park';    // güneybatıda büyük park
  // yerleşecekler: binalar, arsalar (büyük dünya), kuzeyde mahalle parkı
  const queue = [...(td.rb || []), ...td.b, ...(big && td.xb ? td.xb : [])];
  const items = queue.map(type => ({ type, w: BUILDINGS[type].w, h: BUILDINGS[type].h }));
  if (big) for (let k = 0; k < { s: 1, m: 2, l: 3 }[td.sz]; k++) items.push(k === 0 && td.sz !== 's' ? { type: 'lot', w: 12, h: 9, k } : { type: 'lot', w: 10, h: 7, k });
  items.push({ type: 'park', w: 24, h: RD - 1, k: 1 });
  const rank = (it) => { const k = CITY_PRIO.indexOf(it.type); return it.type === 'house' ? 300 : it.type === 'park' ? 210 : it.type === 'lot' ? 200 : k < 0 ? 100 : k; };
  items.sort((a, b) => rank(a) - rank(b));
  // her biri kendi semtine en yakın, sığdığı bloğa (blok içinde aralarında en az bir karo)
  const assign = (it, gap) => {
    const z = CITY_ZONE[it.type] || [2, 1.5];
    let best = null, bs = Infinity;
    for (const B of blocks) {
      if (B.kind || it.h > RD) continue;
      if (B.fill + it.w + (B.items.length ? gap : 0) > B.r - B.l) continue;
      const sc = Math.abs(B.row - z[0]) * 3 + Math.abs(B.col - z[1]) + R.range(0, 0.5);
      if (sc < bs) { bs = sc; best = B; }
    }
    if (best) { best.fill += it.w + (best.items.length ? gap : 0); best.items.push(it); }
    return best;
  };
  for (const it of items) if (!assign(it, 1) && !assign(it, 0)) console.warn('Şehirde yer kalmadı:', it.type);

  // ---- blokları kur: cepheler hizada; kalan yer aralara ve iki uca paylaşılır
  const pave = (x, y) => { const i = y * WW + x; if (!(this.flags[i] & 8) && this.tile[i] === T.GRASS) { this.tile[i] = T.PAVE; this.flags[i] |= 1 | 4; } };
  for (const B of blocks) {
    if (B.kind === 'plaza') { this.cityPlaza(town, X0 + B.l, Y0 + B.t, B.r - B.l, RD, oset); continue; }
    if (B.kind === 'park') {
      const x = X0 + B.l + 1, y = Y0 + B.t + 1, w = B.r - B.l - 2, h = RD - 1;
      this.buildPark(x, y, w, h, 0, R, oget, oset, ground);
      town.parks.unshift({ x, y, w, h });   // çeşmeli büyük park ilk sırada
      continue;
    }
    const its = B.items, n = its.length;
    if (!n) continue;
    const span = B.r - B.l, tot = its.reduce((a, it) => a + it.w, 0), free = span - tot;
    const g = n > 1 ? clamp(Math.floor(free / (n + 1)), free >= n - 1 ? 1 : 0, 3) : 0;
    let x = B.l + Math.max(0, Math.floor((free - g * (n - 1)) / 2));
    let prev = null;
    for (const it of its) {
      const bx = X0 + x, by = Y0 + B.f - it.h;
      this.cityPut(town, it, bx, by, Y0 + B.t, R, oget, oset, ground);
      // iki bina arası taş döşeli dar geçit (kuzey sıra hariç: orada bahçe)
      if (prev && B.row > 0) for (let gx = prev.x + prev.w; gx < bx; gx++) for (let gy = Y0 + B.f - Math.min(prev.h, it.h); gy < Y0 + B.f; gy++) { pave(gx, gy); oset(gx, gy, 5); }
      prev = { x: bx, w: it.w, h: it.h };
      x += it.w + g;
    }
  }

  // ---- sokak lambaları ve cadde ağaçları: kaldırımın yol tarafındaki sırada, kapı önlerini kapatmadan
  const doors = new Set();
  for (const b of town.buildings) doors.add((b.y + b.h) * WW + b.x + (b.w >> 1));
  const nearDoor = (x, y) => { for (let dy = -2; dy <= 0; dy++) for (let dx = -1; dx <= 1; dx++) if (doors.has((y + dy) * WW + x + dx)) return true; return false; };
  const pz = blk(2, 1), byPlaza = (x, y) => x >= X0 + pz.l - 4 && x < X0 + pz.r + 4 && y >= Y0 + pz.t - 4 && y < Y0 + pz.f + 4;
  const free = (x, y) => { if (!this.inb(x, y) || byPlaza(x, y)) return false; const i = y * WW + x; return this.tile[i] === T.PAVE && !this.obj[i] && !(this.flags[i] & 8) && !nearDoor(x, y); };
  const lamp = (x, y) => { if (!free(x, y)) return false; this.obj[y * WW + x] = O.LAMP; oset(x, y, 5); this.lights.push({ x: x * TS + 8, y: y * TS + 2, r: 55, type: 'lamp' }); return true; };
  const tree = (x, y) => { if (!free(x, y)) return false; this.obj[y * WW + x] = R.chance(0.7) ? O.OAK : O.BIRCH; oset(x, y, 5); return true; };
  for (const s of hst) {
    const north = Y0 + s.t + s.sw - 1, south = Y0 + s.t + s.sw + s.rw;
    if (s.av) { for (let lx = 2, k = 0; lx < W - 1; lx += 4, k++) for (const y of [north, south]) (k % 2 ? tree : lamp)(X0 + lx + (y === south ? 2 : 0), y); }
    else for (let lx = 3; lx < W - 1; lx += 7) { lamp(X0 + lx, north); lamp(X0 + lx + 3, south); }
  }
  for (const v of vst) {
    const west = X0 + v.l + v.sw - 1, east = X0 + v.l + v.sw + v.rw, y0 = v === XC ? 2 : hst[0].t + 3;
    if (v.av) { for (let ly = y0, k = 0; ly < H - 1; ly += 4, k++) for (const x of [west, east]) (k % 2 ? tree : lamp)(x, Y0 + ly + (x === east ? 2 : 0)); }
    else for (let ly = y0; ly < H - 1; ly += 7) { lamp(west, Y0 + ly); lamp(east, Y0 + ly + 3); }
  }
  // cadde kaldırımlarında banklar
  for (const s of [AVE]) for (let lx = 6; lx < W - 6; lx += 13) {
    const x = X0 + lx, y = Y0 + s.t + s.sw + s.rw + 1;
    if (free(x, y)) { this.obj[y * WW + x] = O.BENCH; oset(x, y, 5); }
  }
  // avlularda ağaç ve çalı (binaya ve birbirine yapışmadan)
  const nT = Math.round(W * H * 0.0045);
  for (let k = 0, trees = 0; k < 900 && trees < nT; k++) {
    const x = X0 + R.int(0, W - 1), y = Y0 + R.int(0, H - 1), i = y * WW + x;
    if (oget(x, y) !== 0 || this.obj[i] || this.tile[i] !== T.GRASS) continue;
    let ok = true;
    for (let dy = -1; dy <= 1 && ok; dy++) for (let dx = -1; dx <= 1; dx++) { const j = i + dy * WW + dx; if (SOLID_O[this.obj[j]] || (this.flags[j] & 8) || oget(x + dx, y + dy) === 3) { ok = false; break; } }
    if (!ok) continue;
    this.obj[i] = R.chance(0.45) ? O.OAK : R.chance(0.5) ? O.BIRCH : O.BUSH; oset(x, y, 5); trees++;
  }
  // yayaların durup bekleyeceği yerler: kaldırımlar ve meydan
  const spot = (x, y) => { const i = y * WW + x; if (this.tile[i] === T.PAVE && !this.obj[i] && !(this.flags[i] & 8) && !nearDoor(x, y)) town.streetPts.push({ x: x * TS + 8, y: y * TS + 8 }); };
  for (const s of hst) for (let lx = 1; lx < W - 1; lx += 3) { spot(X0 + lx, Y0 + s.t + s.sw - 1); spot(X0 + lx + 1, Y0 + s.t + s.sw + s.rw); }
  for (const v of vst) for (let ly = v === XC ? 1 : hst[0].t + 1; ly < H - 1; ly += 3) { spot(X0 + v.l + v.sw - 1, Y0 + ly); spot(X0 + v.l + v.sw + v.rw, Y0 + ly + 1); }
  // ---- istasyon: güney kenarın altında, orta caddenin doğusunda; cadde geniş bir taş meydanla perona iner
  if (RAIL_LINES.filter(inWorld).some(l => l.includes(td.id))) {
    const def = BUILDINGS.station, sx = X0 + XC.l + XC.w + 2, sy = town.y + town.h + 2;
    this.flatten(sx - 4, sy - 2, def.w + 8, def.h + 6, T.TOWN, 4);
    for (let yy = sy - 2; yy < sy + def.h; yy++) for (let xx = sx - 4; xx < sx + def.w + 4; xx++) this.tile[yy * WW + xx] = T.PAVE;
    for (let yy = sy - 2; yy < sy + def.h + 4; yy++) for (let xx = sx - 4; xx < sx + def.w + 4; xx++) oset(xx, yy, 5);
    for (let yy = sy - 1; yy < sy + def.h + 1; yy++) for (let xx = sx - 1; xx <= sx + def.w; xx++) oset(xx, yy, 2);
    for (let yy = Y0 + H; yy < sy + def.h; yy++) for (let k = 0; k < XC.w; k++) { const xx = X0 + XC.l + k, i = yy * WW + xx; if (this.inb(xx, yy)) { this.tile[i] = T.PAVE; this.obj[i] = 0; this.flags[i] |= 1 | 4; } }
    const b = this.addBuilding('station', sx, sy, town);
    town.buildings.push(b);
    for (let xx = X0 + XC.l; xx < sx + def.w + 4; xx++) { const i = (sy + def.h) * WW + xx; this.tile[i] = T.PLANK; this.obj[i] = 0; this.flags[i] |= 1; }
    town.station = b;
    town.railPt = { x: sx + (def.w >> 1), y: sy + def.h + 2 };
  }
  // tabelalar: kapı yolunun kenarı
  for (const [g, dx, dy] of [[town.gates[0], 2, -3], [town.gates[1], 4, 2], [town.gates[2], -2, -3]]) {
    const gx = g.x + dx, gy = g.y + dy;
    if (this.inb(gx, gy) && !this.obj[gy * WW + gx] && this.tile[gy * WW + gx] !== T.ROAD && this.tile[gy * WW + gx] !== T.COBBLE) {
      this.signs.push({ x: gx * TS + 8, y: gy * TS + 8, town: town.id });
      this.obj[gy * WW + gx] = O.SIGN;
    }
  }

  // ---- şehir trafiği için sokak ağı (piksel): kavşak düğümleri ve şeritler
  const nodes = [], nodeAt = new Map();
  const node = (x, y, gate) => {
    const k = x * 65536 + y;
    let id = nodeAt.get(k);
    if (id === undefined) { id = nodes.length; nodes.push({ id, x, y, gate: !!gate, adj: [] }); nodeAt.set(k, id); }
    return id;
  };
  const link = (a, b, lane) => { nodes[a].adj.push({ n: b, lane }); nodes[b].adj.push({ n: a, lane }); };
  const midX = (v) => (X0 + v.l + v.sw) * TS + v.rw * 8, midY = (s) => (Y0 + s.t + s.sw) * TS + s.rw * 8;
  for (const s of hst) {
    const y = midY(s), ids = vst.map(v => node(midX(v), y));
    if (s === AVE) { ids.unshift(node((X0 - EXT) * TS + 8, y, true)); ids.push(node((X0 + W + EXT - 1) * TS + 8, y, true)); }
    for (let k = 0; k + 1 < ids.length; k++) link(ids[k], ids[k + 1], s.av ? 14 : 10);
  }
  for (const v of vst) {
    const x = midX(v), ids = hst.map(s => node(x, midY(s)));
    if (v === XC) ids.unshift(node(x, (Y0 - EXT) * TS + 8, true));
    for (let k = 0; k + 1 < ids.length; k++) link(ids[k], ids[k + 1], v.av ? 14 : 10);
  }
  town.net = { nodes };
  // dükkân önüne park eden yol arabaları kaldırım kenarındaki şeride durur
  for (const b of town.buildings) {
    const s = hst.find(q => Y0 + q.t === b.y + b.h);
    if (s) b.curbY = (Y0 + s.t + s.sw) * TS + 9;
  }
};

/* Şehre bir bina, arsa ya da mahalle parkı koy (cephe sokağa bakar) */
World.prototype.cityPut = function (town, it, bx, by, top, R, oget, oset, ground) {
  const reserve = (w, h) => {
    for (let yy = by - 1; yy <= by + h; yy++) for (let xx = bx - 1; xx <= bx + w; xx++) if (oget(xx, yy) !== 3) oset(xx, yy, 2);
  };
  if (it.type === 'park') {
    reserve(it.w, it.h);
    this.buildPark(bx, by, it.w, it.h, it.k, R, oget, oset, ground);
    town.parks.push({ x: bx, y: by, w: it.w, h: it.h });
    return;
  }
  if (it.type === 'lot') {
    // arka ve yanlar çitli, ön (kaldırım) açık; içi kuru toprak ve ot
    reserve(it.w, it.h);
    for (let yy = by; yy < by + it.h; yy++) for (let xx = bx; xx < bx + it.w; xx++) {
      const i = yy * WW + xx;
      this.flags[i] |= 1 | 4; this.obj[i] = 0;
      if (yy === by) { this.obj[i] = O.FENCEH; continue; }
      if (xx === bx || xx === bx + it.w - 1) { this.obj[i] = yy < by + it.h - 1 ? O.FENCEV : 0; continue; }
      this.tile[i] = R.chance(0.6) ? T.DRY : T.TOWN;
      this.obj[i] = R.chance(0.1) ? (R.chance(0.5) ? O.TUFT : O.DRYBUSH) : 0;
    }
    const sx = bx + 2, sy = by + it.h - 1;
    this.obj[sy * WW + sx] = O.LOTSIGN;
    const price = Math.round({ s: 110, m: 190, l: 300 }[town.sz] * (it.w * it.h) / 70 / 5) * 5;
    const lot = { id: town.id + ':' + it.k, town: town.id, x: bx, y: by, w: it.w, h: it.h, price, sign: sy * WW + sx };
    town.lots.push(lot); this.lots.push(lot);
    return;
  }
  const def = BUILDINGS[it.type];
  reserve(def.w, def.h);
  const b = this.addBuilding(it.type, bx, by, town);
  town.buildings.push(b);
  const put = (x, y, o) => { const i = y * WW + x; if (this.inb(x, y) && !this.obj[i] && !(this.flags[i] & 8) && oget(x, y) !== 3) { this.obj[i] = o; oset(x, y, 5); return true; } return false; };
  // at bağlama direği kaldırımda, binanın yanında
  if (['saloon', 'general', 'sheriff', 'hotel', 'cantina', 'gambling', 'warehouse'].includes(it.type)) {
    const hx = R.chance(0.5) ? bx - 1 : bx + def.w, hy = by + def.h, i = hy * WW + hx;
    if (this.inb(hx, hy) && !this.obj[i] && !(this.flags[i] & 8) && this.tile[i] === T.PAVE) { this.obj[i] = O.HITCH; town.hitch.push({ x: hx * TS + 8, y: hy * TS + 14 }); }
  }
  if (it.type === 'sheriff') put(bx + def.w, by + def.h - 1, O.BOARD);
  if (it.type === 'warehouse' || it.type === 'brewery' || it.type === 'docks') { put(bx - 1, by + def.h - 1, O.CRATE); put(bx + def.w, by + def.h - 1, O.BARREL); }
  // arka avlu: evlerde çitli bostan, dükkânlarda birkaç fıçı ya da sandık
  const yard = by - top;
  if (it.type === 'house' && yard >= 5) {
    const gy0 = by - 5, gy1 = by - 2;
    for (let yy = gy0; yy <= gy1; yy++) for (let xx = bx; xx < bx + def.w; xx++) {
      const i = yy * WW + xx; oset(xx, yy, 2);
      if (yy === gy0) { this.obj[i] = O.FENCEH; this.flags[i] |= 1; continue; }
      if (xx === bx || xx === bx + def.w - 1) { this.obj[i] = O.FENCEV; this.flags[i] |= 1; continue; }
      this.tile[i] = T.FARM; this.flags[i] |= 1; this.obj[i] = (xx % 2 === 0 && yy < gy1) ? O.CROP : 0;
    }
  } else if (yard >= 2 && R.chance(0.5)) put(bx + R.int(0, def.w - 1), by - 1, R.pick([O.BARREL, O.CRATE, O.BARREL]));
};

/* Meydan: taş döşeli blok; ortada heykel ve çiçek tarhları, köşelerde ağaç, kenarda bank ve fener */
World.prototype.cityPlaza = function (town, x0, y0, w, h, oset) {
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) { const i = y * WW + x; this.tile[i] = T.PAVE; this.obj[i] = 0; this.flags[i] |= 1 | 4; oset(x, y, 5); }
  const mx = x0 + (w >> 1), my = y0 + (h >> 1) - 1;
  const put = (x, y, o) => { this.obj[y * WW + x] = o; };
  put(mx, my, O.STATUE);
  for (const [dx, dy] of [[-2, -1], [2, -1], [-2, 1], [2, 1], [-1, -2], [1, -2]]) put(mx + dx, my + dy, O.FLOWERBED);
  for (const [dx, dy] of [[-5, 0], [5, 0], [0, -4]]) put(mx + dx, my + dy, O.BENCH);
  for (const [x, y] of [[x0 + 2, y0 + 2], [x0 + w - 3, y0 + 2], [x0 + 2, y0 + h - 3], [x0 + w - 3, y0 + h - 3], [x0 + 2, my], [x0 + w - 3, my], [mx - 4, y0 + 1], [mx + 4, y0 + 1]]) put(x, y, O.OAK);
  for (const [x, y] of [[mx - 3, y0 + h - 3], [mx + 3, y0 + h - 3]]) put(x, y, O.BENCH);
  for (const [x, y] of [[x0 + 6, y0 + 1], [x0 + w - 7, y0 + 1], [x0 + 6, y0 + h - 2], [x0 + w - 7, y0 + h - 2]]) { put(x, y, O.LAMP); this.lights.push({ x: x * TS + 8, y: y * TS + 2, r: 55, type: 'lamp' }); }
  town.plaza = { x: mx, y: my, ang: 0 };
  town.spawn = { x: mx * TS + 8, y: (my + 3) * TS + 8 };
};

/* ================= ŞEHİR TRAFİĞİ (G nesnesine eklenir) =================
   Faytonlar ve yük arabaları Wagon sınıfıyla, atlı vatandaşlar atlı NPC olarak
   sokak ağında dolaşır: sağ şeritten gider, kavşakta döner, bazen kaldırım
   kenarında durur. Oyuncu şehre yaklaşınca görüş alanının dışından doğar,
   uzaklaşınca kaybolur; kayda yazılmaz (her açılışta yeniden kurulur). */
const CitySystems = {
  /* saat ve havaya göre hedef sayılar */
  cityWant() {
    const h = this.hour, env = this.envCache || {};
    const k = h >= 7 && h < 20 ? 1 : h >= 20 && h < 23 ? 0.55 : h >= 5 && h < 7 ? 0.45 : 0.15;
    const wet = clamp((env.rain || 0) + (env.snow || 0), 0, 1);
    return { carts: Math.round(CITY_CARTS * k * (1 - wet * 0.3)), riders: Math.round(CITY_RIDERS * k * (1 - wet * 0.5)) };
  },
  cityTick(t) {
    if (!t.net) return;
    const P = this.player;
    if (P.x < (t.x - 40) * TS || P.x > (t.x + t.w + 40) * TS || P.y < (t.y - 40) * TS || P.y > (t.y + t.h + 40) * TS) return;
    const want = this.cityWant();
    let carts = 0, riders = 0;
    for (const e of this.ents) {
      if (e.remove || e.city !== t.id) continue;
      if (e.kind === 'wagon' && e.driver) carts++;
      else if (e.kind === 'npc' && e.cityRide && !e.dead) riders++;
    }
    if (carts < want.carts && chance(0.5)) this.citySpawn(t, 'cart');
    if (riders < want.riders && chance(0.5)) this.citySpawn(t, 'rider');
  },
  /* görüş alanı dışında bir kavşak (yoksa bir şehir kapısı) */
  citySpawnNode(t) {
    const P = this.player, N = t.net.nodes, cands = [];
    for (const n of N) {
      const d2 = dist2(n.x, n.y, P.x, P.y);
      if (d2 < 280 * 280 || d2 > 950 * 950 || this.onScreen(n.x, n.y, 40)) continue;
      if (this.ents.some(o => !o.remove && (o.kind === 'wagon' || o.cityRide) && dist2(o.x, o.y, n.x, n.y) < 70 * 70)) continue;
      cands.push(n);
    }
    return cands.length ? pick(cands) : null;
  },
  citySpawn(t, kind) {
    const n0 = this.citySpawnNode(t);
    if (!n0) return;
    const seq = this.cityRoute(t, n0.id, -1, rndi(5, 9));
    if (seq.length < 2) return;
    if (kind === 'cart') {
      const cab = chance(0.65), pts = this.cityPts(t, seq, 0, true), a = Math.atan2(pts[1][1] - pts[0][1], pts[1][0] - pts[0][0]);
      const w = new Wagon(null, 0, 1, false, { x: pts[0][0], y: pts[0][1], ang: a });
      w.city = t.id; w.route = pts; w.ri = 1; w.leg = 'city'; w.cnode = seq[seq.length - 1]; w.cprev = seq[seq.length - 2];
      if (cab) {
        w.cab = true; w.cargo = false; w.max = rnd(32, 37); w.name = Tr('Fayton');
        w.body = pick(['#1e2a22', '#2a1e1e', '#1a1a22', '#3a2a1e']); w.hc = [pick(HORSE_BREEDS.standardbred.cols), pick(HORSE_BREEDS.standardbred.cols)];
      } else w.max = rnd(26, 30);
      this.addEnt(w);
    } else {
      const pts = this.cityPts(t, seq, 3, false), a = Math.atan2(pts[1][1] - pts[0][1], pts[1][0] - pts[0][0]);
      const r = new NPC(pts[0][0], pts[0][1], 'town', { mounted: true, look: randomLook(chance(0.8) ? 'm' : 'f'), money: rnd(0.5, 4) });
      r.town = t.id; r.city = t.id; r.cityRide = true; r.cpts = pts; r.cpi = 1; r.cnode = seq[seq.length - 1]; r.cprev = seq[seq.length - 2];
      r.ang = r.hAng = a; r.cspd = rnd(42, 52);
      this.addEnt(r);
    }
  },
  /* sokak ağında rastgele bir rota (düğüm dizisi): geri dönmez, çoğunlukla düz gider, kapıda biter */
  cityRoute(t, start, from, n) {
    const N = t.net.nodes, seq = [start];
    let cur = start, prev = from;
    for (let k = 0; k < n; k++) {
      const opts = N[cur].adj.filter(a => a.n !== prev);
      if (!opts.length) break;
      let next = null;
      if (prev >= 0 && chance(0.55)) {
        const dx = N[cur].x - N[prev].x, dy = N[cur].y - N[prev].y;
        next = opts.find(a => Math.abs((N[a.n].x - N[cur].x) * dy - (N[a.n].y - N[cur].y) * dx) < 1 && (N[a.n].x - N[cur].x) * dx + (N[a.n].y - N[cur].y) * dy > 0);
      }
      next = next || pick(opts);
      prev = cur; cur = next.n; seq.push(cur);
      if (N[cur].gate) break;
    }
    return seq;
  },
  /* düğüm dizisinden şerit noktaları: düz gidişte sağ şeridin ekseni, dönüşte iki şeridin kesişimi.
     extra: şeridi kaldırıma doğru kaydırır; stops: bazı kenarların ortasında kaldırım kenarında durak */
  cityPts(t, seq, extra, stops, from = -1) {
    const N = t.net.nodes, pts = [];
    const lane = (a, b) => { const q = N[a].adj.find(o => o.n === b); return (q ? q.lane : 10) + extra; };
    const dir = (a, b) => { const dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy) || 1; return [dx / l, dy / l]; };
    for (let i = 0; i < seq.length; i++) {
      const n = N[seq[i]];
      const pi = i > 0 ? seq[i - 1] : from;   // devam eden rotada ilk düğüme geliş yönü
      const din = pi >= 0 ? dir(N[pi], n) : null, dout = i < seq.length - 1 ? dir(n, N[seq[i + 1]]) : null;
      let x = n.x, y = n.y;
      if (din) { const L = lane(pi, seq[i]); x -= din[1] * L; y += din[0] * L; }
      if (dout && (!din || din[0] * dout[0] + din[1] * dout[1] < 0.9)) { const L = lane(seq[i], seq[i + 1]); x -= dout[1] * L; y += dout[0] * L; }
      if (stops && din && pts.length && chance(0.14)) {
        // önceki noktayla bu nokta arasında kaldırım kenarı durağı (kısa kenarda değil)
        const [px, py] = pts[pts.length - 1];
        if (Math.hypot(x - px, y - py) > 150) pts.push([(px + x) / 2 - din[1] * 7, (py + y) / 2 + din[0] * 7, 0, 's']);
      }
      pts.push([x, y, 0]);
    }
    // kapıda biten rota yolun üstünde biraz daha uzar (araba şehirden çıkıp gider)
    const last = N[seq[seq.length - 1]];
    if (last.gate && seq.length > 1) { const d = dir(N[seq[seq.length - 2]], last), [lx, ly] = pts[pts.length - 1]; pts.push([lx + d[0] * 260, ly + d[1] * 260, 0]); }
    return pts;
  },
  /* rota bitti: uzaktaysa ya da şehirden çıkıp gözden kaybolduysa kaybolur, değilse yeni rota */
  cityNext(e) {
    const t = this.world.towns.find(q => q.id === e.city), P = this.player;
    if (!t || !t.net || dist2(e.x, e.y, P.x, P.y) > 1000 * 1000) { e.remove = true; return false; }
    const N = t.net.nodes, cart = e.kind === 'wagon';
    if (N[e.cnode].gate) {
      if (!this.onScreen(e.x, e.y, 60)) { e.remove = true; return false; }
      // hâlâ görünüyor: yolda biraz daha ilerler
      const a = cart ? e.ang : (e.hAng === undefined ? e.ang : e.hAng), p = [e.x + Math.cos(a) * 200, e.y + Math.sin(a) * 200, 0];
      if (cart) { e.route = [[e.x, e.y, 0], p]; e.ri = 1; } else { e.cpts = [p]; e.cpi = 0; }
      return true;
    }
    // akşam ve gece şehir seyrelir: hedeften fazlaysa, görünmüyorsa yoluna gider
    if (!this.onScreen(e.x, e.y, 60)) {
      const want = this.cityWant();
      let n = 0;
      for (const o of this.ents) if (!o.remove && o.city === t.id && (cart ? o.kind === 'wagon' && o.driver : o.cityRide)) n++;
      if (n > (cart ? want.carts : want.riders)) { e.remove = true; return false; }
    }
    const seq = this.cityRoute(t, e.cnode, e.cprev, rndi(4, 8));
    if (seq.length < 2) { e.remove = true; return false; }
    const pts = this.cityPts(t, seq, cart ? 0 : 3, cart, e.cprev);
    if (e.kind === 'wagon') { e.route = [[e.x, e.y, 0], ...pts]; e.ri = 1; } else { e.cpts = pts; e.cpi = 0; }
    e.cnode = seq[seq.length - 1]; e.cprev = seq[seq.length - 2];
    return true;
  },
  /* atlı vatandaş: şeridini izler; önünde araba, atlı ya da yaya varsa yavaşlar, duran bir şeyi soldan geçer */
  cityRideStep(e, dt) {
    if (!e.mounted) { e.cityRide = false; return; }
    let pt = e.cpts && e.cpts[e.cpi];
    if (!pt) { if (!this.cityNext(e)) return; pt = e.cpts[e.cpi]; }
    const prev = e.cpts[e.cpi - 1];
    const sa = prev ? Math.atan2(pt[1] - prev[1], pt[0] - prev[0]) : Math.atan2(pt[1] - e.y, pt[0] - e.x);
    e.passT = (e.passT || 0) - dt;
    const side = e.passT > 0 ? 16 : 0, tx = pt[0] + Math.sin(sa) * side, ty = pt[1] - Math.cos(sa) * side;
    const a = Math.atan2(ty - e.y, tx - e.x), c = Math.cos(e.hAng === undefined ? e.ang : e.hAng), s = Math.sin(e.hAng === undefined ? e.ang : e.hAng);
    // öndeki engel (araba gövdesi, at, yaya, oyuncu)
    let near = 99, still = false;
    const chk = (x, y, r, o) => { const dx = x - e.x, dy = y - e.y, f = dx * c + dy * s; if (f < 2 || f > 34) return; if (Math.abs(-dx * s + dy * c) > r + 5) return; if (f < near) { near = f; still = (o.spd !== undefined ? o.spd : o.mv * 50 || 0) < 4; } };
    const P = this.player;
    for (const o of this.ents) {
      if (o === e || o.remove || o.hide || Math.abs(o.x - e.x) > 50 || Math.abs(o.y - e.y) > 50) continue;
      if (o.kind === 'wagon') { chk(o.x, o.y, 5.5, o); chk(o.bx, o.by, 7, o); }
      else if ((o.kind === 'npc' || o.kind === 'horse') && !o.dead) chk(o.x, o.y, o.mounted || o.kind === 'horse' ? 6 : 3, o);
    }
    if (!P.riding || P.riding.kind === 'horse') chk(P.x, P.y, P.riding ? 6 : 3, { mv: P.riding ? (P.riding.spd || 0) / 50 : 1 });
    let sp = e.cspd || 46;
    if (near < 34) sp *= clamp((near - 12) / 22, 0, 1);
    if (sp < 3) { e.blockT = (e.blockT || 0) + dt; if (e.blockT > (still ? 1.2 : 3.5)) { e.passT = 3; e.blockT = 0; } } else e.blockT = 0;
    e.ang = turnTo(e.ang, a, dt * 3);
    if (sp > 1) e.walk(dt, sp); else { e.mv = 0; e.wspd = 0; }
    const d2 = dist2(e.x, e.y, pt[0], pt[1]), behind = (pt[0] - e.x) * Math.cos(e.ang) + (pt[1] - e.y) * Math.sin(e.ang) < 0;
    if (d2 < 14 * 14 || (behind && d2 < 36 * 36)) e.cpi++;
    if (e.stuck > 2.5 && !this.onScreen(e.x, e.y, 30)) { e.x = pt[0]; e.y = pt[1]; e.stuck = 0; }
  },
};
