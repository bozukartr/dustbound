'use strict';
/* ==========================================================
   FRONTIER'S END — prosedürel çizimler (üstten 3/4 görünüm)
   ========================================================== */

const NOPF = () => {};
const NOPCTX = new Proxy({}, { get: (t, k) => (k in t ? t[k] : NOPF), set: (t, k, v) => { t[k] = v; return true; } });
const SIGN_TEXT = {
  general: 'GENERAL', saloon: 'SALOON', sheriff: 'SHERIFF', doctor: 'DOCTOR', gunsmith: 'GUNS', butcher: 'BUTCHER', stable: 'STABLE',
  hotel: 'HOTEL', bank: 'BANK', station: 'STATION', land: 'LAND', barber: 'BARBER', tailor: 'TAILOR', fence: 'TRADER', mine: 'MINING CO',
  lumber: 'LUMBER', docks: 'DOCKS', ranch: 'RANCH', property: 'FOR SALE', cabin: 'FURS', hermit: '', church: '',
  bakery: 'BAKERY', smith: 'BLACKSMITH', pharmacy: 'DRUGS', laundry: 'LAUNDRY', gambling: 'GAMBLING HALL', brewery: 'BREWERY',
  mill: 'MILL', county: 'COUNTY', post: 'POST & TELEGRAPH', warehouse: 'WHOLESALE', cantina: 'CANTINA', market: 'MARKET',
  club: 'PRIVATE CLUB', mansion: '',
};

/* Zengin şehrin modern binaları: cephe taşları ve tente renkleri */
const MODERN_WALLS = [{ c: '#8a3e2e', brick: true }, { c: '#7a4a34', brick: true }, { c: '#964a36', brick: true }, { c: '#b8a27e', brick: false }, { c: '#c8c0b0', brick: false }, { c: '#a89a86', brick: false }];
const MODERN_TYPE_WALL = { bank: '#cfc6b4', county: '#c8c0ae', hotel: '#d4c8b0', sheriff: '#a8a090', doctor: '#d8d2c4', pharmacy: '#d8d2c4', mansion: '#ddd5c4', club: { c: '#6e3a2c', brick: true } };
/* Türün sabit cephesi (taş; kulüpte koyu tuğla), yoksa konuma göre seçilen palet */
const modernWall = (b, pal) => { const tw = MODERN_TYPE_WALL[b.type]; return tw ? { c: tw.c || tw, brick: !!tw.brick } : pal; };
const MODERN_AWN = ['#a83a2a', '#2e6a4a', '#2e4a7a', '#7a2a5a', '#a8782a'];
const MODERN_SHOP = new Set(['general', 'tailor', 'bakery', 'pharmacy', 'barber', 'butcher', 'gunsmith', 'saloon', 'gambling', 'laundry', 'brewery', 'fence']);
const MODERN_SKIP = new Set(['church', 'station', 'stable', 'barn', 'lighthouse', 'mineentrance', 'ruin', 'docks', 'warehouse', 'lot']);
/* Oyuncunun kurduğu (kademeli) yapının görünüm ayrıntıları türüne ve kademesine bağlıdır: menüdeki önizleme dünyadaki
   binayla aynı görünür; öbür yapılarda konuma göre seçilir. Lüks yapı tuğla ya da taş (modern) cepheli; modern cephesi
   olmayan türlerde (ahır) gelişmiş gibi boyalı. Ekonomik: boyasız, yıpranmış tahta; gelişmiş: boyalı, beyaz pervazlı. */
const typeSeed = (t) => { let n = 7; for (let i = 0; i < t.length; i++) n = (n * 31 + t.charCodeAt(i)) | 0; return n; };
const bHash = (b, s) => b.tier ? hash2(typeSeed(b.type), TIER_KEYS.indexOf(b.tier) + 1, s) : hash2(b.x, b.y, s);
const modernB = (b) => (richB(b) || (!b.tier && b.face === 3)) && !MODERN_SKIP.has(b.type);
const ADV_PAINT = ['#d8ccb0', '#a8b4a0', '#9aa8b8', '#c8b078', '#b8a0a0', '#e0d8c8'], ADV_ROOF = ['#6a2e24', '#3e4a52', '#4a5a3a', '#5a3a2a'];
/* Kasabaların gelişimiyle (js/devworld.js) değişen cephe, b.face: 0 yıpranmış tahta (ekonomik gibi), 2 boyalı ve pervazlı
   (gelişmiş gibi), 3 tuğla ya da taş (modernB); yok ya da 1: türün kendi rengi. Oyuncunun kurduğu yapıda kademe belirler. */
function bCol(b) {
  const d = b.def;
  if (!b.tier && b.face !== undefined) {
    if (b.face === 0) return { wall: mixHex(d.wall, '#7c7064', 0.6), roof: mixHex(d.roof, '#4a4440', 0.55), trim: null, worn: true };
    if (b.face >= 2) return { wall: ADV_PAINT[Math.floor(bHash(b, 61) * ADV_PAINT.length)], roof: ADV_ROOF[Math.floor(bHash(b, 62) * ADV_ROOF.length)], trim: '#ece6d8', worn: false };
  }
  if (b.tier === 'eco') return { wall: mixHex(d.wall, '#7c7064', 0.6), roof: mixHex(d.roof, '#4a4440', 0.55), trim: null, worn: true };
  if (b.tier === 'adv' || b.tier === 'lux') return { wall: ADV_PAINT[Math.floor(bHash(b, 61) * ADV_PAINT.length)], roof: ADV_ROOF[Math.floor(bHash(b, 62) * ADV_ROOF.length)], trim: '#ece6d8', worn: false };
  return { wall: d.wall, roof: d.roof, trim: null, worn: false };
}
/* Otelin döşeme, halı ve duvar kâğıdı renkleri (otel kendi çizimini korur); oyuncunun kurduğu otelde kademeye göre:
   ekonomik halısız, soluk tahta ve kâğıt; gelişmiş bal rengi tahta, lacivert halı; lüks koyu cilalı tahta, bordo ipek */
const HOTEL_LOOK = {
  std: { fl: '#6e4a32', rug: '#7a2a2a', wp: '#4e5e40' }, eco: { fl: '#5e5446', rug: null, wp: '#6a604c' },
  adv: { fl: '#7a5638', rug: '#2a4466', wp: '#3a5260' }, lux: { fl: '#4e2e1c', rug: '#6a1428', wp: '#5a1e2a' },
};
const hotelLook = (b) => HOTEL_LOOK[b.tier] || HOTEL_LOOK.std;
const AUTUMN_PAL = [['#7a3416', '#a84e1c', '#d07a2a'], ['#8a5a14', '#b88024', '#e0aa3a'], ['#6a3a1a', '#94501e', '#c07030'], ['#8a6a1a', '#b89424', '#e8c040']];

/* ---- İç mekân kaplamaları: iki çizicinin ortak deseni ----
   Döşeme, arka duvar bandı ve halılar piksel fonksiyonudur: binanın sol üst köşesine göre dünya pikseli (u, v; kesirli
   olabilir) alır, 0-1 arası rengi verir (dönen dizi geçicidir, hemen okunmalı). Klasik çizim 1x, melez çizim 2x örnekler;
   iki görünüm aynı tasarımı taşır. Saint Clement'teki binalar (b.modern) parke, mermer, çini, ipek duvar kâğıdı ve ahşap
   lambri ile döşenir. Otel kendi çizimini korur. */
const IntDeco = (() => {
  const CC = new Map();
  const rgb = (h) => { let c = CC.get(h); if (!c) { const v = hexToRgb(h); CC.set(h, c = [v[0] / 255, v[1] / 255, v[2] / 255]); } return c; };
  const TMP = []; for (let i = 0; i < 16; i++) TMP.push([0, 0, 0]);
  let ti = 0;
  const sh = (c, k) => {
    const o = TMP[ti = (ti + 1) & 15];
    if (k < 0) { o[0] = c[0] * (1 + k); o[1] = c[1] * (1 + k); o[2] = c[2] * (1 + k); }
    else { o[0] = c[0] + (1 - c[0]) * k; o[1] = c[1] + (1 - c[1]) * k; o[2] = c[2] + (1 - c[2]) * k; }
    return o;
  };
  const mx = (a, b, t) => { const o = TMP[ti = (ti + 1) & 15]; o[0] = a[0] + (b[0] - a[0]) * t; o[1] = a[1] + (b[1] - a[1]) * t; o[2] = a[2] + (b[2] - a[2]) * t; return o; };
  const hs = (x, y, s) => hash2(x | 0, y | 0, s);
  const fr = (x) => x - Math.floor(x);
  /* Bina türüne göre kaplama: [döşeme, renk1, renk2], [duvar, renk]. Döşeme: plank (tahta), wide (geniş cilalı tahta),
     parquet (örgü parke), checker (dama), marble (mermer), hex (sekizgen beyaz çini), stone (taş),
     brick (tuğla örgü), ttile (pişmiş toprak), straw (saman). Duvar: paper (desenli kâğıt), stripe (çizgili), damask
     (işlemeli kâğıt), plaster (sıva), plankv (dikey tahta), log (kütük), brick (tuğla), panel (ahşap lambri), tile (çini) */
  const STD = {
    general: [['plank', '#7a5a3a'], ['paper', '#7e6044']], saloon: [['plank', '#5e4028'], ['paper', '#6a2a24']], sheriff: [['plank', '#6e5a40'], ['plankv', '#8a7a60']],
    doctor: [['plank', '#a08a6a'], ['plaster', '#d8d0c0']], gunsmith: [['plank', '#6a4a30'], ['plankv', '#5e4e3e']], butcher: [['plank', '#8a6a4a', 'saw'], ['plaster', '#bfae94']],
    stable: [['straw', '#8a7250'], ['plankv', '#7a5a38']], barn: [['straw', '#8a7250'], ['plankv', '#7a2e22']], bank: [['checker', '#8a7a64', '#c8b89a'], ['paper', '#2e4234']],
    station: [['plank', '#6a5a44'], ['paper', '#6a5e4a']], church: [['plank', '#9a7a52'], ['plaster', '#e8e0d0']], land: [['plank', '#7a5a3a'], ['paper', '#8a7a5a']],
    barber: [['hex', '#dcd6c8', '#2a2a2a'], ['paper', '#b8a890']], tailor: [['plank', '#7a5a3a'], ['stripe', '#7a6078']], fence: [['plank', '#4e3a28'], ['plankv', '#4a3a2a']],
    mine: [['plank', '#6a5a48', 'saw'], ['plankv', '#5a5048']], lumber: [['plank', '#8a6a44', 'saw'], ['plankv', '#7a5a34']], docks: [['plank', '#6a6258'], ['plankv', '#5a5a54']],
    ranch: [['plank', '#7a5a3a'], ['log', '#7a5434']], house: [['plank', '#7a5a3a'], ['paper', '#8a7058']], property: [['plank', '#7a5a3a'], ['log', '#7a5434']],
    cabin: [['plank', '#5a4430'], ['log', '#5a3a1e']], hs_shack: [['plank', '#6a5038'], ['plankv', '#6a4a2e']], hs_cabin: [['plank', '#6e5236'], ['log', '#6a4424']],
    hs_house: [['plank', '#7a5a3a'], ['paper', '#9a8262']], bakery: [['brick', '#9a5a3a'], ['plaster', '#d8c8a8']], smith: [['stone', '#5a5550'], ['brick', '#6a3a2a']],
    pharmacy: [['hex', '#e8e4da', '#2a3a3a'], ['paper', '#3a5a4a']], laundry: [['plank', '#7a6c5c'], ['plaster', '#c8c8c0']], gambling: [['plank', '#4a3020'], ['paper', '#5a1a1a']],
    brewery: [['brick', '#7a4a30'], ['brick', '#7a4a30']], mill: [['plank', '#9a8060', 'saw'], ['plankv', '#8a7050']], county: [['plank', '#6e5232'], ['paper', '#8a8468']],
    post: [['plank', '#7a5a3a'], ['paper', '#5a6a70']], warehouse: [['wide', '#7a6a50'], ['plankv', '#6a5a48']], cantina: [['ttile', '#9e5a3c'], ['plaster', '#d8b888']],
    mansion: [['parquet', '#7a4a2a'], ['damask', '#2e3a4e']], club: [['parquet', '#5a3420'], ['panel', '#4a2e1c']],
  };
  /* Kademe kaplamaları (oyuncunun kurduğu yapı): eco, adv, lux; Normal kademe türün standart kaplamasıdır */
  const TIER = {
    hs_shack: { eco: [['plank', '#5a4632'], ['plankv', '#5a4230']], adv: [['wide', '#7a5a3a'], ['paper', '#8a7a5a']], lux: [['parquet', '#7a5030'], ['panel', '#5a3a24']] },
    hs_cabin: { eco: [['plank', '#5a4430'], ['log', '#5a3e24']], adv: [['wide', '#7a5a3a'], ['log', '#7a5434']], lux: [['parquet', '#7a5030'], ['panel', '#5a3a24']] },
    hs_house: { eco: [['plank', '#6a5038'], ['plankv', '#6a4e36']], adv: [['wide', '#7a5a3a'], ['stripe', '#7a6a50']], lux: [['parquet', '#7a5030'], ['damask', '#3a4a5a']] },
    barber: { eco: [['plank', '#6a5440'], ['plaster', '#b8a890']], adv: [['checker', '#33302c', '#d8d0c0'], ['stripe', '#c8b8a0']], lux: [['marble', '#e6e0d4', '#5a2a2a'], ['damask', '#5a1a24']] },
    laundry: { eco: [['plank', '#6a5e50'], ['plaster', '#b8b8b0']], adv: [['hex', '#e4e2da', '#3a5a6a'], ['tile', '#d0d8d8']], lux: [['marble', '#e6e0d4', '#3a5a6a'], ['tile', '#dce4e4']] },
    bakery: { eco: [['plank', '#7a5a3a'], ['plaster', '#c8b898']], adv: [['brick', '#9a5a3a'], ['tile', '#e8e0d0']], lux: [['checker', '#a85a3a', '#ece0c8'], ['stripe', '#c8a868']] },
    butcher: { eco: [['plank', '#6a4e36', 'saw'], ['plankv', '#6a5040']], adv: [['hex', '#e4e2da', '#7a2a2a'], ['plaster', '#cfc0a8']], lux: [['hex', '#ecebe4', '#7a2a2a'], ['tile', '#dcdcd4']] },
    tailor: { eco: [['plank', '#6a5038'], ['plankv', '#6a5444']], adv: [['wide', '#7a5a3a'], ['stripe', '#7a6078']], lux: [['parquet', '#8a5a32'], ['damask', '#6a3a5a']] },
    mill: { eco: [['plank', '#8a7050', 'saw'], ['plankv', '#7a6448']], adv: [['wide', '#9a8060'], ['plankv', '#8a7050']], lux: [['wide', '#8a6a44'], ['panel', '#6a4a2e']] },
    smith: { eco: [['stone', '#4e4a46'], ['plankv', '#4e4238']], adv: [['stone', '#5e5954'], ['brick', '#7a4030']], lux: [['stone', '#6a645c'], ['brick', '#8a4a34']] },
    pharmacy: { eco: [['plank', '#7a6a54'], ['plaster', '#c8c4b4']], adv: [['hex', '#e8e4da', '#2a4a4a'], ['stripe', '#4a6a5a']], lux: [['marble', '#ecebe4', '#1e3a3a'], ['damask', '#2a4a3e']] },
    cantina: { eco: [['plank', '#7a5a3a'], ['plaster', '#c8a878']], adv: [['ttile', '#a85e3e'], ['plaster', '#e0c090']], lux: [['ttile', '#b0603e'], ['tile', '#d8c8a8']] },
    stable: { eco: [['straw', '#7a6448'], ['plankv', '#6a4a30']], adv: [['stone', '#7a7268', 'straw'], ['plankv', '#8a6a44']], lux: [['stone', '#8a8276', 'straw'], ['brick', '#7a4030']] },
    general: { eco: [['plank', '#6a4e32'], ['plankv', '#6a5440']], adv: [['wide', '#7a5a3a'], ['paper', '#5a6a4a']], lux: [['parquet', '#8a5a32'], ['stripe', '#2e4a3e']] },
    saloon: { eco: [['plank', '#4e3622'], ['plankv', '#5a4030']], adv: [['wide', '#5a3a22'], ['paper', '#5a2a24']], lux: [['wide', '#4a2a18'], ['damask', '#5a1420']] },
    brewery: { eco: [['plank', '#6a4a30'], ['plankv', '#5e4430']], adv: [['brick', '#7a4a30'], ['brick', '#7a4a30']], lux: [['checker', '#5a3a24', '#c8b090'], ['panel', '#4a2e1c']] },
    gambling: { eco: [['plank', '#4a3020'], ['plankv', '#4a3424']], adv: [['wide', '#3a2014'], ['paper', '#5a1a1a']], lux: [['wide', '#3a2014'], ['damask', '#4a1018']] },
  };
  const RICH = {
    general: [['parquet', '#8a5a32'], ['stripe', '#2e4a3e']], saloon: [['wide', '#4a2a18'], ['damask', '#5a1420']], sheriff: [['parquet', '#7a5030'], ['panel', '#5a3a24']],
    doctor: [['hex', '#ecebe4', '#2a4a5a'], ['stripe', '#b8c8c0']], gunsmith: [['parquet', '#6a4228'], ['panel', '#4a2e1c']], butcher: [['hex', '#ecebe4', '#7a2a2a'], ['tile', '#dcdcd4']],
    stable: [['stone', '#7a7268', 'straw'], ['brick', '#7a4030']], bank: [['marble', '#e6e0d4', '#2e4a3e'], ['panel', '#3a2414']], station: [['marble', '#d8d0c0', '#6a3a2a'], ['stripe', '#4a5a4a']],
    church: [['marble', '#e4e0d8', '#8a8478'], ['plaster', '#efe8da']], land: [['parquet', '#7a5030'], ['panel', '#4a3020']], barber: [['checker', '#33302c', '#e6e0d4'], ['stripe', '#d8ccb8']],
    tailor: [['parquet', '#8a5a32'], ['damask', '#6a3a5a']], docks: [['wide', '#6a6258'], ['panel', '#4a3a2a']], house: [['parquet', '#7a5030'], ['damask', '#3a4a5a']],
    bakery: [['checker', '#a85a3a', '#ece0c8'], ['tile', '#e8e0d0']], pharmacy: [['hex', '#ecebe4', '#1e3a3a'], ['stripe', '#3a5a4a']], gambling: [['wide', '#3a2014'], ['damask', '#4a1018']],
    post: [['parquet', '#7a5030'], ['stripe', '#4a5a6a']], county: [['marble', '#dcd4c4', '#5a5040'], ['panel', '#4a3420']], laundry: [['hex', '#ecebe4', '#3a5a6a'], ['tile', '#d8e0e0']],
    warehouse: [['wide', '#6e6048'], ['brick', '#6a3a2a']], brewery: [['brick', '#7a4a30'], ['brick', '#6a3424']],
    mansion: [['parquet', '#7a4a2a'], ['damask', '#2e3a4e']], club: [['parquet', '#5a3420'], ['panel', '#4a2e1c']],
  };
  const HOUSE_RICH = ['#3a4a5a', '#5a2a3a', '#2e4a3e'];
  const cache = new WeakMap(), cacheUp = new WeakMap();
  /* İki katlı yapının (malikane, kulüp) üst katı kendi halılarıyla ayrı bir kaplamadır; döşeme ve duvar zemin katla aynı */
  function style(b) {
    const UPP = typeof upPlan !== 'undefined' ? upPlan(b) : null, up = !!UPP && b.floor === 1, C = up ? cacheUp : cache;
    let st = C.get(b);
    if (st) return st;
    const t = b.type, tk = b.tier && TIER[t] && TIER[t][b.tier], rich = b.tier ? b.tier === 'lux' : !!b.modern && !!RICH[t];
    const S = tk || (rich && !b.tier ? RICH[t] : STD[t]) || [['plank', '#7a5a3a'], ['paper', shadeHex(b.def.wall, -0.05)]];
    const plan = typeof planOfB !== 'undefined' ? planOfB(b) : null;
    let wc = S[1][1];
    if (rich && (t === 'house')) wc = HOUSE_RICH[Math.floor(hash2(b.x, b.y, 7) * 3)];
    st = {
      fl: S[0][0], c1: rgb(S[0][1]), c2: rgb(S[0][2] && S[0][2][0] === '#' ? S[0][2] : S[0][1]), dust: S[0][2] === 'saw', straw: S[0][2] === 'straw',
      wl: S[1][0], wc: rgb(wc), rich, trim: rgb(rich ? '#c8a050' : '#3a2416'), id: b.id, w: b.w * TS, h: b.h * TS, dx: up ? -999 : b.door.x - b.x * TS,
      rugs: ((up ? UPP.rooms.filter(R => R.rug).map(R => R.rug) : plan && plan.rug) || []).map(r => ({ x: r[0] * TS, y: r[1] * TS, w: r[2] * TS, h: r[3] * TS, k: r[4], c: rgb(r[5]), a: rgb(r[4] === 'c' ? '#c8a040' : rich ? '#c8a050' : '#d8c8a0') })),
    };
    C.set(b, st);
    return st;
  }
  /* ---- döşeme ---- */
  function floor(st, u, v) {
    const c1 = st.c1, c2 = st.c2;
    let c, k = 0;
    switch (st.fl) {
      case 'plank': case 'wide': {
        const ph = st.fl === 'wide' ? 8 : 5, sl = st.fl === 'wide' ? 37 : 23, row = Math.floor(v / ph), pv = v - row * ph;
        const off = (row * 11) % sl, seg = Math.floor((u + off) / sl), pu = u + off - seg * sl;
        k = (hs(row, seg, st.id) - 0.5) * (st.fl === 'wide' ? 0.12 : 0.2);
        if (pv < 0.5) k = -0.4; else if (pu < 0.5) k = -0.32;
        else {
          const gr = Math.sin((u * 0.9 + hs(row, seg, 3) * 40) * 0.7 + pv * 0.3);
          if (gr > 0.85) k -= 0.08; else if (gr < -0.9) k += 0.06;
          if (st.fl === 'wide' && pv > 1 && pv < 2) k += 0.1;   // cilanın parıltısı
          if (Math.abs(pu - 1.5) < 0.45 && Math.abs(pv - ph / 2) < 0.45) k = -0.45;   // çivi
        }
        c = c1;
        break;
      }
      case 'parquet': case 'brick': {
        // örgü: 8 piksellik karelerde iki yönlü dörder lata (tuğlada ikişer tuğla); kenar boyunca bordür
        const brick = st.fl === 'brick', q = 8, sx = Math.floor(u / q), sy = Math.floor(v / q), fu = u - sx * q, fv = v - sy * q, hor = (sx + sy) % 2 === 0;
        const n = brick ? 2 : 4, a = hor ? fv : fu, b = hor ? fu : fv, lane = Math.floor(a / (q / n)), la = a - lane * (q / n);
        const bord = !brick && (u < 20 || u > st.w - 20 || v > st.h - 12);
        c = c1; k = (hs(sx * 4 + lane, sy, st.id + 5) - 0.5) * 0.22 + (hor ? 0.04 : -0.04);
        if (brick) { if (la < 0.7 || b < 0.7) { c = rgb('#8a8070'); k = -0.25; } else if (la > 3) k -= 0.06; }
        else if (la < 0.45 || b < 0.45) k = -0.38;
        else if (Math.sin(b * 1.7 + hs(sx, sy * 3 + lane, 9) * 6) > 0.9) k -= 0.07;
        if (bord) { c = sh(c1, -0.22); k = (fr(v / 5) < 0.12 ? -0.3 : 0) + (hs(Math.floor(v / 5), Math.floor(u / 23), 4) - 0.5) * 0.1; }
        break;
      }
      case 'checker': {
        const q = 8, sx = Math.floor(u / q), sy = Math.floor(v / q), fu = u - sx * q, fv = v - sy * q;
        c = (sx + sy) % 2 ? c2 : c1; k = (hs(sx, sy, 2) - 0.5) * 0.08;
        if (fu < 0.5 || fv < 0.5) k -= 0.22;
        else if (fu < 1.4 && fv < 1.4) k += 0.06;
        break;
      }
      case 'marble': {
        const q = 16, sx = Math.floor(u / q), sy = Math.floor(v / q), fu = u - sx * q, fv = v - sy * q, dark = (sx + sy) % 2;
        c = dark ? c2 : c1;
        const vein = Math.sin(u * 0.47 + v * 0.29 + Math.sin(v * 0.37 + u * 0.11 + sx * 1.7) * 1.5 + hs(sx, sy, 6) * 6);
        k = (hs(sx, sy, 3) - 0.5) * 0.06 + (vein > 0.975 ? (dark ? 0.12 : -0.1) : vein > 0.91 ? (dark ? 0.04 : -0.035) : 0);
        if (fu < 0.5 || fv < 0.5) k = -0.2;
        else if (fu < 2 && fv < 2 && fu + fv < 2.6) k += 0.12;   // cila
        break;
      }
      case 'hex': {
        // sekizgen ve nokta: beyaz sekizgenlerin köşelerinde koyu küçük kareler
        const q = 6, sx = Math.floor(u / q), sy = Math.floor(v / q), fu = u - sx * q, fv = v - sy * q, eu = Math.min(fu, q - fu), ev = Math.min(fv, q - fv);
        if (eu + ev < 1.6) { c = c2; k = (hs(sx, sy, 4) - 0.5) * 0.1; }
        else if (eu < 0.35 || ev < 0.35 || Math.abs(eu + ev - 1.6) < 0.3) { c = c1; k = -0.2; }
        else { c = c1; k = (hs(sx, sy, 5) - 0.5) * 0.05 + (fu < 2 && fv < 2 ? 0.04 : 0); }
        break;
      }
      case 'stone': {
        // düzensiz kesme taş: kaydırılmış ızgaradaki en yakın iki merkez arası derz olur (her taş kendi tonunda)
        const q = 7, gx = Math.floor(u / q), gy = Math.floor(v / q);
        let d1 = 1e9, d2 = 1e9, id = 0;
        for (let yy = gy - 1; yy <= gy + 1; yy++) for (let xx = gx - 1; xx <= gx + 1; xx++) {
          const px = (xx + 0.15 + hs(xx, yy, st.id) * 0.7) * q, py = (yy + 0.15 + hs(xx, yy, st.id + 9) * 0.7) * q, d = (u - px) * (u - px) + (v - py) * (v - py);
          if (d < d1) { d2 = d1; d1 = d; id = xx * 7919 + yy; } else if (d < d2) d2 = d;
        }
        const e = Math.sqrt(d2) - Math.sqrt(d1);
        c = c1; k = (hs(id, 0, 3) - 0.5) * 0.3 + (hs(Math.floor(u), Math.floor(v), 8) > 0.9 ? -0.06 : 0);
        if (e < 0.7) k = -0.45; else if (e < 1.4) k += 0.07;
        if (st.straw && hs(Math.floor(u * 0.7), Math.floor(v * 2), 5) > 0.93) { c = rgb('#c8a860'); k = 0; }
        break;
      }
      case 'ttile': {
        const q = 8, sx = Math.floor(u / q), sy = Math.floor(v / q), fu = u - sx * q, fv = v - sy * q;
        c = c1; k = (hs(sx, sy, 2) - 0.5) * 0.22;
        if (fu < 0.7 || fv < 0.7) { c = rgb('#c8b8a0'); k = -0.1; }
        else if (hs(Math.floor(u), Math.floor(v), 9) > 0.95) k -= 0.12;
        else if (fu < 2 && fv < 2) k += 0.07;
        break;
      }
      case 'straw': default: {
        const r = hs(Math.floor(u * 0.5), Math.floor(v), st.id);
        c = r > 0.8 ? rgb('#c8a860') : r > 0.6 ? rgb('#a88a50') : c1;
        k = c === c1 ? (hs(Math.floor(u / 4), Math.floor(v / 4), 3) - 0.5) * 0.1 : 0;
        break;
      }
    }
    if (st.dust && hs(Math.floor(u * 1.3), Math.floor(v * 1.3), 11) > 0.94) k += 0.22;   // talaş, un tozu
    // kapı önünde aşınma
    const dd = Math.hypot(u - st.dx, (v - st.h) * 1.6);
    if (dd < 22) k += 0.08 * (1 - dd / 22);
    return sh(c, k);
  }
  /* ---- arka duvar bandı (v: 0-16) ---- */
  function wall(st, u, v) {
    const c = st.wc;
    if (v < 2) return rgb('#1e140c');
    if (st.rich && v < 3.2) return sh(st.trim, v < 2.6 ? 0.1 : -0.25);   // tavan pervazı
    const solid = st.wl === 'plankv' || st.wl === 'log' || st.wl === 'brick' || st.wl === 'tile';
    if (!solid && v >= 11) {
      // ahşap lambri: dikey çıtalar, ortası çökük pano
      const q = u % 12, wn = st.rich ? rgb('#4a2a18') : sh(c, -0.3);
      if (st.rich && v < 11.8) return sh(st.trim, -0.1);   // lambri pervazı
      let k = 0; if (q < 0.6 || v < 11.6 || v > 15.4) k = -0.3; else if (q > 2 && q < 10 && v > 12.4 && v < 14.6) k = 0.1;
      return sh(st.rich ? wn : c, st.rich ? k : -0.3 + k * 0.6);
    }
    if (v >= 15.2) return sh(c, -0.5);   // süpürgelik
    switch (st.wl) {
      case 'plankv': { const q = Math.floor(u / 4), f = u - q * 4; let k = (hs(q, 0, st.id) - 0.5) * 0.18; if (f < 0.6) k = -0.4; else if (Math.sin(v * 1.3 + q * 2.1) > 0.92) k -= 0.08; return sh(c, k); }
      case 'log': { const rw = 3, r = Math.floor((v - 2) / rw), f = (v - 2) - r * rw; let k = 0.12 - Math.abs(f - 1.4) * 0.12 + (hs(r, Math.floor(u / 29), st.id) - 0.5) * 0.12; if (f < 0.45) return rgb('#b8a888'); return sh(c, k); }
      case 'brick': { const r = Math.floor((v - 2) / 3), f = (v - 2) - r * 3, off = r % 2 ? 3 : 0, bq = Math.floor((u + off) / 6), bu = u + off - bq * 6; if (f < 0.6 || bu < 0.6) return rgb('#8a7e6e'); return sh(c, (hs(bq, r, st.id) - 0.5) * 0.24 + (f > 2.2 ? -0.08 : 0)); }
      case 'tile': { const q = 4, sx = Math.floor(u / q), sy = Math.floor((v - 2) / q), fu = u - sx * q, fv = v - 2 - sy * q; if (fu < 0.5 || fv < 0.5) return sh(c, -0.18); return sh(c, (fu < 1.4 && fv < 1.4 ? 0.12 : 0) + (hs(sx, sy, 3) - 0.5) * 0.05); }
      case 'plaster': { const n = hs(Math.floor(u / 3), Math.floor(v / 2), st.id); return sh(c, (n - 0.5) * 0.06 + (v > 10 ? -0.05 : 0)); }
      case 'stripe': { const q = u % 6; let k = q < 3 ? 0.1 : -0.04; if (Math.abs(q - 3) < 0.35) k = st.rich ? 0.25 : -0.12; if (st.rich && Math.abs(q - 3) < 0.35) return mx(c, st.trim, 0.55); return sh(c, k); }
      case 'damask': {
        const pu = ((u % 8) + 8) % 8 - 4, pv = ((v - 2) % 8 + 8) % 8 - 4, d = Math.abs(pu) + Math.abs(pv) * 0.8;
        if (d < 1) return mx(c, st.trim, 0.45);
        if (Math.abs(d - 2.6) < 0.35) return sh(c, 0.16);
        return sh(c, (Math.abs(pu) < 0.3 || Math.abs(pv) < 0.3) && d > 3.2 ? 0.07 : 0);
      }
      case 'panel': { const q = u % 10, k = (q < 0.7 || v < 3.8 || v > 10.4) ? -0.25 : (q < 1.6 || v < 4.6) ? 0.12 : (q > 9 || v > 9.6) ? -0.12 : (Math.sin(u * 0.8 + v * 0.2) > 0.9 ? -0.05 : 0); return sh(c, k); }
      case 'paper': default: {
        const dm = Math.abs(((u % 6) + 6) % 6 - 3) + Math.abs(((v - 2) % 6 + 6) % 6 - 3);
        let k = 0; if (dm < 0.9) k = 0.22; else if (Math.abs(dm - 2.4) < 0.3) k = -0.12;
        if (v > 10 && v < 11) k = -0.4;
        return sh(c, k);
      }
    }
  }
  /* ---- halı: (u, v) halının içindeyse renk, değilse null ---- */
  function rugAt(st, r, u, v) {
    let x = u - r.x, y = v - r.y;
    const long = r.w >= r.h, L = long ? r.w : r.h, S = long ? r.h : r.w;
    if (!long) { const t = x; x = y; y = t; }   // uzun kenar x boyunca
    if (y < 0 || y >= S) return null;
    if (x < -2 || x >= L + 2) return null;
    if (x < 0 || x >= L) {
      // saçak: kısa kenarlarda açık renkli ipler
      if (r.k === 'c' || y < 1 || y > S - 1) return null;
      return (Math.floor(y) % 2 === 0) ? sh(r.a, -0.1) : null;
    }
    const e = Math.min(x, y, L - x, S - y), c = r.c, a = r.a;
    switch (r.k) {
      case 'c': return (e < 0.8) ? a : sh(c, (hs(Math.floor(x / 2), 0, 2) - 0.5) * 0.08);
      case 'r': {
        if (e < 0.8) return sh(c, -0.35);
        const yy = Math.abs(y - S / 2) / (S / 2);
        if (yy > 0.62 && yy < 0.78) return sh(a, -0.15);
        if (yy < 0.3 && Math.abs(((x % 8) + 8) % 8 - 4) + yy * 6 < 1.8) return sh(a, -0.05);
        return sh(c, ((Math.floor(x) + Math.floor(y)) % 5 === 0) ? -0.08 : 0);
      }
      case 'g': {
        if (e < 0.8) return sh(c, -0.4);
        const band = Math.floor(x / 6), bx = x - band * 6, cy = Math.abs(y - S / 2);
        if (Math.abs(bx - 3) + cy * 0.6 < 2.2 && band % 2 === 0) return a;
        if (e < 2.2) return sh(a, -0.35);
        if (Math.abs(((x + y * 0.8) % 4 + 4) % 4 - 2) < 0.5 && band % 2) return sh(c, 0.22);
        return sh(c, band % 2 ? 0.06 : 0);
      }
      case 'p': {
        if (e < 1) return sh(c, -0.25);
        if (e > 2.2 && e < 3.2) return sh(c, 0.45);
        if (e < 5 && ((Math.floor(x) + Math.floor(y)) % 3 === 0)) return sh(c, 0.25);
        return sh(c, (Math.floor(x) + Math.floor(y * 2)) % 7 === 0 ? -0.06 : 0);
      }
      case 'o': default: {
        // işlemeli halı: koyu dış çizgi, açık bordür bandı (yinelenen motif), iç alan ve ortada madalyon
        if (e < 0.8) return sh(c, -0.45);
        if (e < 3.4) { const m = Math.abs(((x + y) % 4 + 4) % 4 - 2); return e > 1.4 && e < 2.8 && m < 0.7 ? sh(c, -0.2) : sh(a, -0.12 + (e < 1.4 ? -0.1 : 0)); }
        if (e < 4) return sh(c, -0.3);
        const cx = x - L / 2, cy = y - S / 2, md = Math.abs(cx) / (L * 0.24) + Math.abs(cy) / (S * 0.32);
        if (md < 1) return md < 0.35 ? sh(a, 0.05) : Math.abs(md - 0.7) < 0.12 ? sh(a, -0.2) : sh(c, 0.18);
        const cm = Math.min(Math.hypot(x - 4, y - 4), Math.hypot(L - 4 - x, y - 4), Math.hypot(x - 4, S - 4 - y), Math.hypot(L - 4 - x, S - 4 - y));
        if (cm < 2.2) return sh(a, -0.25);
        const dm = Math.abs(((cx % 6) + 6) % 6 - 3) + Math.abs(((cy % 6) + 6) % 6 - 3);
        return dm < 0.8 ? sh(c, 0.12) : sh(c, (hs(Math.floor(x), Math.floor(y), 3) - 0.5) * 0.05);
      }
    }
  }
  function rug(st, u, v) {
    let out = null;
    for (const r of st.rugs) { const c = rugAt(st, r, u, v); if (c) out = c; }
    return out;
  }
  /* Klasik çizim: döşeme + halılar + arka duvar bandı 1x tuvale (son birkaç bina önbellekte) */
  const LRU = new Map();
  function canvas(b) {
    const st = style(b), key = st;   // binanın her katının kaplaması ayrı
    let cv = LRU.get(key);
    if (cv) { LRU.delete(key); LRU.set(key, cv); return cv; }
    const w = st.w, h = st.h;
    cv = makeCanvas(w, h);
    const g = cv.getContext('2d'), img = g.createImageData(w, h), d = img.data;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const u = x + 0.5, v = y + 0.5, c = v < 16 ? wall(st, u, v) : (rug(st, u, v) || floor(st, u, v)), k = (y * w + x) * 4;
      d[k] = c[0] * 255; d[k + 1] = c[1] * 255; d[k + 2] = c[2] * 255; d[k + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    LRU.set(key, cv);
    if (LRU.size > 6) LRU.delete(LRU.keys().next().value);
    return cv;
  }
  /* Duvar lambası (aplik) sayısı: zengin binalarda ve saloonlarda arka duvarda iki ya da üç; yerleri duvar süsleri
     çizilirken boş kalan aralıklardan seçilir (b._sc), melez çizimde camları gece yanar */
  function sconces(b) {
    const t = b.type;
    if (t === 'hotel' || t === 'stable' || t === 'barn' || t === 'warehouse' || t === 'docks' || t === 'church') return 0;
    if (!richB(b) && b.tier !== 'adv' && t !== 'saloon' && t !== 'gambling' && t !== 'cantina') return 0;   // gelişmiş kademede de aplik
    return b.w >= 10 ? 3 : 2;
  }
  return { style, floor, wall, rug, rugAt, canvas, sconces, rgb };
})();

/* Toplanabilir bitkilerin renkleri (sap, çiçek/meyve): bir kez kurulur, her karede yeniden yaratılmaz */
const HERB_COLS = {
  [O.BERRY]: ['#3a5a26', '#3048a0'], [O.GINSENG]: ['#4a7a2e', '#c03020'], [O.YARROW]: ['#5a7a3a', '#f0f0e0'], [O.SAGE]: ['#8aa080', '#b0c0a8'],
  [O.MINT]: ['#3a8a3a', '#6ac06a'], [O.OREGANO]: ['#5a7a3a', '#b080c0'], [O.MILKWEED]: ['#6a8a4a', '#f0d0e0'], [O.MUSHROOM]: ['#e8dcc8', '#a03a2a'], [O.WFLOWER]: ['#4a7a2e', '#e8c040'],
}, HERB_COL0 = ['#5a7a3a', '#fff'];
const Spr = {
  ell(ctx, x, y, rx, ry, col, rot = 0) { ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, TAU); ctx.fill(); },
  circ(ctx, x, y, r, col) { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); },
  shadow(ctx, x, y, rx, ry, a = 0.28) { ctx.fillStyle = `rgba(0,0,0,${a})`; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU); ctx.fill(); },
  line(ctx, x1, y1, x2, y2, col, w = 1) { ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); },

  /* ---------- Ağaç taçları ---------- */
  canopy(ctx, x, y, r, c1, c2, c3, h, lumps = 6) {
    for (let k = 0; k < lumps; k++) {
      const a = k / lumps * TAU + h * 6;
      const rr = r * (0.55 + 0.2 * Math.sin(k * 2.1 + h * 9));
      this.circ(ctx, x + Math.cos(a) * r * 0.45, y + Math.sin(a) * r * 0.4, rr, c1);
    }
    this.circ(ctx, x, y, r * 0.7, c2);
    for (let k = 0; k < 3; k++) this.circ(ctx, x - r * 0.25 + k * 1.5, y - r * 0.3 - k, r * (0.32 - k * 0.07), c3);
  },
  pine(ctx, x, y, r, c1, c2, c3, h, snow) {
    for (let layer = 0; layer < 3; layer++) {
      const rr = r * (1 - layer * 0.28);
      const cy = y - layer * 2.2;
      ctx.fillStyle = layer === 0 ? c1 : layer === 1 ? c2 : c3;
      ctx.beginPath();
      const pts = 9;
      for (let k = 0; k <= pts * 2; k++) {
        const a = k / (pts * 2) * TAU + h * 3 + layer;
        const rad = k % 2 === 0 ? rr : rr * 0.62;
        const px = x + Math.cos(a) * rad, py = cy + Math.sin(a) * rad * 0.92;
        k ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      }
      ctx.fill();
      if (snow) {
        ctx.fillStyle = 'rgba(240,244,250,0.85)';
        for (let k = 0; k < 4; k++) { const a = k * 1.7 + h * 5 + layer; this.circ(ctx, x + Math.cos(a) * rr * 0.5, cy + Math.sin(a) * rr * 0.45 - 1, rr * 0.22, 'rgba(236,242,248,0.9)'); }
      }
    }
  },

  bare(o, x, y, r, col, h, snowy) {
    o.strokeStyle = col; o.lineWidth = 1.3; o.lineCap = 'round';
    for (let k = 0; k < 7; k++) {
      const a = k / 7 * TAU + h * 5, l = r * (0.6 + 0.3 * Math.sin(k * 3.1 + h * 7));
      const ex = x + Math.cos(a) * l, ey = y + Math.sin(a) * l * 0.85;
      o.beginPath(); o.moveTo(x, y); o.lineTo(ex, ey); o.stroke();
      o.beginPath(); o.moveTo(x + (ex - x) * 0.6, y + (ey - y) * 0.6); o.lineTo(ex + Math.cos(a + 0.8) * 3, ey + Math.sin(a + 0.8) * 3); o.stroke();
      if (snowy) { o.fillStyle = 'rgba(240,244,248,0.9)'; o.fillRect(ex - 1, ey - 1, 2, 1.2); }
    }
    o.lineCap = 'butt';
  },
  object(g, o, type, x, y, h, world) {
    const tx = x >> 4, ty = y >> 4;
    const season = world ? world.season : 0;
    const snowy = season === 3 && world.snowyTile(tx, ty);
    switch (type) {
      case O.PINE: case O.SNOWPINE: {
        const r = 7 + h * 3.5;
        this.shadow(g, x + 5, y + 3, r * 0.95, r * 0.55, 0.3);
        g.fillStyle = '#4a3322'; g.fillRect(x - 1.2, y - 5, 2.4, 8);
        this.pine(o, x, y - 7, r, '#20361f', '#2c4a28', '#3a5d33', h, type === O.SNOWPINE || snowy);
        break;
      }
      case O.OAK: case O.APPLE: {
        const r = 8 + h * 3.5;
        this.shadow(g, x + 5, y + 3, r, r * 0.6, 0.3);
        g.fillStyle = '#4e3826'; g.fillRect(x - 1.6, y - 6, 3.2, 9);
        if (world && world.bareTree(tx, ty)) { this.bare(o, x, y - 7, r, '#4e3826', h, snowy); break; }
        if (season === 2) { const pal = AUTUMN_PAL[Math.floor(h * AUTUMN_PAL.length)]; this.canopy(o, x, y - 8, r, pal[0], pal[1], pal[2], h); break; }
        this.canopy(o, x, y - 8, r, season === 1 ? '#2e4a1e' : '#314d22', season === 1 ? '#3c5c26' : '#3f6129', season === 1 ? '#4f7030' : '#557a35', h);
        if (type === O.APPLE) for (let k = 0; k < 7; k++) { const a = k * 1.9 + h * 7; this.circ(o, x + Math.cos(a) * r * 0.55, y - 8 + Math.sin(a) * r * 0.5, 1.1, '#c0302a'); }
        break;
      }
      case O.BIRCH: {
        const r = 6 + h * 3;
        this.shadow(g, x + 4, y + 3, r, r * 0.55, 0.26);
        g.fillStyle = '#e8e4d8'; g.fillRect(x - 1.2, y - 6, 2.4, 9);
        g.fillStyle = '#2a2420'; g.fillRect(x - 1.2, y - 3, 1.2, 0.8); g.fillRect(x, y, 1.2, 0.8);
        if (world && world.bareTree(tx, ty)) { this.bare(o, x, y - 7, r, '#d8d4c8', h, snowy); break; }
        if (season === 2) this.canopy(o, x, y - 8, r, '#b8902a', '#d8b040', '#f0d060', h, 5);
        else this.canopy(o, x, y - 8, r, '#4a6a2a', '#5e8436', '#7a9e48', h, 5);
        break;
      }
      case O.CYPRESS: {
        const r = 8 + h * 3;
        this.shadow(g, x + 4, y + 3, r, r * 0.6, 0.3);
        g.fillStyle = '#5a4a3a'; g.beginPath(); g.ellipse(x, y + 1, 3.2, 2.2, 0, 0, TAU); g.fill(); g.fillRect(x - 1.8, y - 6, 3.6, 7);
        this.canopy(o, x, y - 8, r, '#2e3a22', '#3a4a2a', '#4d5e36', h, 7);
        o.strokeStyle = 'rgba(150,160,130,0.7)'; o.lineWidth = 1;
        for (let k = 0; k < 6; k++) { const px = x - r * 0.7 + k * r * 0.28; o.beginPath(); o.moveTo(px, y - 8 + (k % 2) * 2); o.lineTo(px + 0.5, y - 1 + (k % 3)); o.stroke(); }
        break;
      }
      case O.DEAD: {
        this.shadow(g, x + 3, y + 3, 5, 2.5, 0.2);
        g.fillStyle = '#5a4a3a'; g.fillRect(x - 1.2, y - 8, 2.4, 11);
        o.strokeStyle = '#5a4838'; o.lineWidth = 1.2;
        for (let k = 0; k < 5; k++) { const a = -Math.PI / 2 + (k - 2) * 0.5 + h; o.beginPath(); o.moveTo(x, y - 7); o.lineTo(x + Math.cos(a) * 8, y - 7 + Math.sin(a) * 7); o.stroke(); }
        break;
      }
      case O.CACTUS: {
        this.shadow(g, x + 2, y + 2, 4, 2, 0.22);
        g.fillStyle = '#4a7a3a'; g.fillRect(x - 1.8, y - 7, 3.6, 9);
        g.fillStyle = '#5e9048'; g.fillRect(x - 0.6, y - 7, 1.2, 9);
        if (h > 0.4) { g.fillStyle = '#4a7a3a'; g.fillRect(x + 1.8, y - 4, 2.5, 1.8); g.fillRect(x + 3, y - 7, 1.8, 3.5); }
        if (h > 0.7) this.circ(g, x, y - 7.5, 1.2, '#e0a0c0');
        break;
      }
      case O.SAGUARO: {
        this.shadow(g, x + 4, y + 3, 5, 2.5, 0.25);
        g.fillStyle = '#3e6e32'; g.fillRect(x - 2.5, y - 5, 5, 8);
        o.fillStyle = '#3e6e32'; o.fillRect(x - 2.5, y - 20, 5, 15.5);
        o.beginPath(); o.arc(x, y - 20, 2.5, Math.PI, 0); o.fill();
        o.fillRect(x - 7, y - 11, 4.5, 2.5); o.fillRect(x - 7, y - 16, 2.5, 6);
        o.fillRect(x + 2.5, y - 9, 4, 2.5); o.fillRect(x + 4.5, y - 15, 2.5, 7);
        o.fillStyle = '#58904a'; o.fillRect(x - 0.8, y - 20, 1.4, 15);
        break;
      }
      case O.BUSH: {
        this.shadow(g, x + 2, y + 3, 6, 3, 0.2);
        const c = season === 2 ? (h > 0.5 ? ['#7a4a1e', '#9a6026', '#b87a30'] : ['#6a5a26', '#8a7230', '#a88a3a']) : season === 3 ? ['#4a4a36', '#5a5a42', '#6a6a50'] : h > 0.5 ? ['#3a5a26', '#4a6e30', '#5e8440'] : ['#40562a', '#506a34', '#688246'];
        this.circ(g, x - 2.5, y, 3.8, c[0]); this.circ(g, x + 2.5, y + 0.5, 3.6, c[0]); this.circ(g, x, y - 2, 4, c[1]); this.circ(g, x - 1, y - 3, 2, c[2]);
        if (snowy) { this.ell(g, x - 0.5, y - 3.5, 4, 2, '#eef2f6'); this.ell(g, x + 2.5, y - 1, 2, 1, '#e2e8ee'); }
        break;
      }
      case O.DRYBUSH: {
        g.strokeStyle = h > 0.5 ? '#8a7446' : '#7a6a48'; g.lineWidth = 1;
        for (let k = 0; k < 7; k++) { const a = k / 7 * TAU + h; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * 4.5, y + Math.sin(a) * 3.5); g.stroke(); }
        this.circ(g, x, y, 2, '#8e7a4e');
        break;
      }
      case O.ROCK: {
        const r = 2.5 + h * 2;
        this.ell(g, x + 1, y + 1.5, r + 0.5, r * 0.7, 'rgba(0,0,0,0.25)');
        this.ell(g, x, y, r, r * 0.75, '#8a8278'); this.ell(g, x - 0.8, y - 0.8, r * 0.55, r * 0.4, '#a8a096');
        break;
      }
      case O.BOULDER: {
        const r = 6 + h * 3;
        this.ell(g, x + 2, y + 3, r + 1, r * 0.6, 'rgba(0,0,0,0.3)');
        this.ell(g, x, y - 1, r, r * 0.8, '#77706a'); this.ell(g, x - 1.5, y - 3, r * 0.6, r * 0.45, '#948c84'); this.ell(g, x + 2, y + 1, r * 0.4, r * 0.25, '#5e5852');
        break;
      }
      case O.REED: {
        g.strokeStyle = '#6a7a3a'; g.lineWidth = 1;
        for (let k = 0; k < 5; k++) { const dx = (k - 2) * 1.6 + h; g.beginPath(); g.moveTo(x + dx, y + 3); g.lineTo(x + dx + (k % 2 ? 1 : -1), y - 5 - k % 3); g.stroke(); }
        this.circ(g, x + h, y - 5, 0.9, '#5a4028');
        break;
      }
      case O.FLOWERS: {
        if (snowy || season === 2 || season === 3) break;
        const cols = ['#e8d040', '#c060c0', '#f0f0f0', '#e05a3a', '#7090e0'];
        for (let k = 0; k < 5; k++) { const a = k * 2.3 + h * 9; this.circ(g, x + Math.cos(a) * 4, y + Math.sin(a) * 3, 0.9, cols[(k + Math.floor(h * 5)) % 5]); }
        break;
      }
      case O.TUFT: {
        if (snowy) break;
        g.strokeStyle = season === 2 ? 'rgba(110,80,30,0.6)' : season === 3 ? 'rgba(80,70,50,0.5)' : 'rgba(40,60,20,0.55)'; g.lineWidth = 1;
        for (let k = 0; k < 4; k++) { g.beginPath(); g.moveTo(x - 3 + k * 2, y + 2); g.lineTo(x - 3 + k * 2 + (k - 1.5) * 0.8, y - 2); g.stroke(); }
        break;
      }
      case O.ORE: {
        this.ell(g, x + 1, y + 2, 6, 3.5, 'rgba(0,0,0,0.3)');
        this.ell(g, x, y, 5.5, 4.2, '#6a625c'); this.ell(g, x - 1, y - 1, 3.5, 2.5, '#827a72');
        g.fillStyle = h > 0.7 ? '#e0c050' : '#c8d0d8';
        g.fillRect(x - 2, y - 1, 1.2, 1.2); g.fillRect(x + 1, y, 1.2, 1.2); g.fillRect(x, y - 2.5, 1, 1);
        break;
      }
      case O.CROP: {
        if (season === 3) { g.strokeStyle = snowy ? '#a8a090' : '#7a6a40'; g.lineWidth = 1; for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(x - 4 + k * 4, y + 5); g.lineTo(x - 4 + k * 4, y + 2); g.stroke(); } break; }
        if (season === 2) { g.strokeStyle = '#a8883a'; g.lineWidth = 1.2; for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(x - 4 + k * 4, y + 5); g.lineTo(x - 4 + k * 4, y - 6); g.stroke(); } g.fillStyle = '#e0c050'; g.fillRect(x - 5, y - 3, 1.6, 3); g.fillRect(x + 3, y - 4, 1.6, 3); break; }
        g.strokeStyle = '#5a7a2a'; g.lineWidth = 1.2;
        for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(x - 4 + k * 4, y + 5); g.lineTo(x - 4 + k * 4, y - 6); g.stroke(); }
        g.fillStyle = '#d8c050'; g.fillRect(x - 5, y - 3, 1.6, 3); g.fillRect(x + 3, y - 4, 1.6, 3);
        g.fillStyle = '#7a9a3a'; g.fillRect(x - 2, y - 7, 3, 1);
        break;
      }
      case O.FENCEH: {
        this.line(g, x - 8, y + 1.5, x + 8, y + 1.5, 'rgba(0,0,0,0.25)', 1.5);
        this.line(g, x - 8, y - 3, x + 8, y - 3, '#7a5a3a', 1.3); this.line(g, x - 8, y, x + 8, y, '#6a4a2e', 1.3);
        g.fillStyle = '#5a3e26'; g.fillRect(x - 1, y - 5, 2, 6.5);
        break;
      }
      case O.FENCEV: {
        this.line(g, x - 1, y - 8, x - 1, y + 8, '#7a5a3a', 1.3); this.line(g, x + 1.5, y - 8, x + 1.5, y + 8, '#6a4a2e', 1);
        g.fillStyle = '#5a3e26'; g.fillRect(x - 1.5, y - 3, 3, 4);
        break;
      }
      case O.CRATE: {
        g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(x - 3, y - 1, 9, 7);
        g.fillStyle = '#8a6a40'; g.fillRect(x - 5, y - 6, 10, 10);
        g.fillStyle = '#a8844f'; g.fillRect(x - 5, y - 6, 10, 3);
        g.strokeStyle = '#5a4226'; g.lineWidth = 1; g.strokeRect(x - 4.5, y - 5.5, 9, 9);
        this.line(g, x - 4.5, y + 3.5, x + 4.5, y - 3, '#5a4226', 1);
        break;
      }
      case O.BARREL: {
        this.ell(g, x + 1.5, y + 3, 5, 2.5, 'rgba(0,0,0,0.3)');
        g.fillStyle = '#7a5230'; g.fillRect(x - 4, y - 6, 8, 9);
        this.ell(g, x, y - 6, 4, 2, '#946640'); this.ell(g, x, y + 3, 4, 1.5, '#6a4628');
        g.fillStyle = '#4a4a4a'; g.fillRect(x - 4, y - 3, 8, 1); g.fillRect(x - 4, y + 1, 8, 1);
        break;
      }
      case O.LAMP: {
        this.shadow(g, x + 3, y + 2, 3, 1.5, 0.25);
        g.fillStyle = '#2a2622'; g.fillRect(x - 0.8, y - 10, 1.6, 12);
        o.fillStyle = '#2a2622'; o.fillRect(x - 2.5, y - 16, 5, 6);
        o.fillStyle = '#f0d890'; o.fillRect(x - 1.5, y - 15, 3, 4);
        break;
      }
      case O.ELAMP: {
        // elektrikli sokak lambası: döküm ayak, ince yüksek direk, tepede süt camı küre
        this.shadow(g, x + 3, y + 2, 3.4, 1.6, 0.25);
        g.fillStyle = '#1c2420'; g.fillRect(x - 1.8, y - 2, 3.6, 4);
        g.fillStyle = '#26302b'; g.fillRect(x - 0.8, y - 10, 1.6, 10);
        o.fillStyle = '#26302b'; o.fillRect(x - 0.8, y - 19, 1.6, 9); o.fillRect(x - 1.7, y - 20, 3.4, 1.4);
        this.circ(o, x, y - 22.4, 2.7, '#ece8da'); this.circ(o, x - 0.7, y - 23.2, 1.2, '#fffdf4');
        break;
      }
      case O.UPOLE: {
        // elektrik direği: katranlı ağaç direk, traversin uçlarında cam izolatörler (teller: G.drawWires)
        this.shadow(g, x + 5, y + 2, 3, 1.4, 0.2);
        g.fillStyle = '#4a3828'; g.fillRect(x - 1, y - 6, 2, 8);
        o.fillStyle = '#4a3828'; o.fillRect(x - 1, y - 31, 2, 25); o.fillStyle = '#5c4632'; o.fillRect(x - 1, y - 31, 0.8, 25);
        o.fillStyle = '#5a4430'; o.fillRect(x - 6, y - 27, 12, 1.6);
        o.fillStyle = '#86a898'; o.fillRect(x - 5.2, y - 28.6, 1.4, 1.6); o.fillRect(x + 3.8, y - 28.6, 1.4, 1.6);
        break;
      }
      case O.WELL: {
        this.shadow(g, x + 3, y + 3, 8, 4, 0.3);
        this.circ(g, x, y, 6.5, '#7a746a'); this.circ(g, x, y, 4.5, '#1e2a30'); this.circ(g, x, y, 3.5, '#2e4450');
        o.fillStyle = '#5a3e26'; o.fillRect(x - 6, y - 14, 1.5, 12); o.fillRect(x + 4.5, y - 14, 1.5, 12);
        o.fillStyle = '#6a3a24'; o.beginPath(); o.moveTo(x - 9, y - 12); o.lineTo(x, y - 19); o.lineTo(x + 9, y - 12); o.closePath(); o.fill();
        break;
      }
      case O.PUMP: {
        this.shadow(g, x + 2, y + 2, 4, 2, 0.25);
        g.fillStyle = '#3a4048'; g.fillRect(x - 2, y - 8, 4, 10); g.fillRect(x + 2, y - 6, 4, 1.5);
        g.fillStyle = '#5a6068'; g.fillRect(x - 1, y - 9, 2, 2);
        this.line(g, x - 2, y - 8, x - 6, y - 11, '#2a2e34', 1.2);
        break;
      }
      case O.TROUGH: {
        g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(x - 8, y - 1, 18, 6);
        g.fillStyle = '#6a4a2e'; g.fillRect(x - 10, y - 4, 20, 7);
        g.fillStyle = '#3e6a78'; g.fillRect(x - 8.5, y - 2.5, 17, 4);
        break;
      }
      case O.GRAVE: {
        this.ell(g, x, y + 2, 3.5, 5, '#6a5a42');
        g.fillStyle = '#8a8680'; g.fillRect(x - 3, y - 7, 6, 5); this.ell(g, x, y - 7, 3, 1.5, '#8a8680');
        g.fillStyle = '#6a6660'; g.fillRect(x - 2, y - 5, 4, 0.8);
        break;
      }
      case O.CROSS: {
        this.ell(g, x, y + 2, 3, 4.5, '#6a5a42');
        g.fillStyle = '#6a4a2e'; g.fillRect(x - 0.8, y - 8, 1.6, 9); g.fillRect(x - 3, y - 6, 6, 1.4);
        break;
      }
      case O.CAMPFIRE: {
        for (let k = 0; k < 8; k++) { const a = k / 8 * TAU; this.circ(g, x + Math.cos(a) * 4.5, y + Math.sin(a) * 3.5, 1.5, '#6a6660'); }
        this.circ(g, x, y, 3.2, '#1a1612');
        this.line(g, x - 3, y - 1, x + 3, y + 1, '#4a3222', 1.8); this.line(g, x - 3, y + 1, x + 3, y - 1, '#4a3222', 1.8);
        break;
      }
      case O.TENT: {
        this.shadow(g, x + 3, y + 4, 9, 4, 0.28);
        g.fillStyle = '#c8b890'; g.beginPath(); g.moveTo(x - 8, y + 5); g.lineTo(x, y - 7); g.lineTo(x + 8, y + 5); g.closePath(); g.fill();
        g.fillStyle = '#a89870'; g.beginPath(); g.moveTo(x, y - 7); g.lineTo(x + 8, y + 5); g.lineTo(x + 2, y + 5); g.closePath(); g.fill();
        g.fillStyle = '#2a2016'; g.beginPath(); g.moveTo(x - 2, y + 5); g.lineTo(x, y - 1); g.lineTo(x + 2, y + 5); g.closePath(); g.fill();
        break;
      }
      case O.HAY: {
        g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(x - 5, y - 1, 13, 6);
        g.fillStyle = '#c8a850'; g.fillRect(x - 7, y - 5, 14, 8);
        g.fillStyle = '#e0c068'; g.fillRect(x - 7, y - 5, 14, 3);
        g.fillStyle = '#8a6a30'; g.fillRect(x - 3, y - 5, 1, 8); g.fillRect(x + 3, y - 5, 1, 8);
        break;
      }
      case O.SIGN: {
        this.shadow(g, x + 2, y + 2, 3, 1.5, 0.25);
        g.fillStyle = '#5a3e26'; g.fillRect(x - 0.8, y - 10, 1.6, 12);
        o.fillStyle = '#9a7650'; o.beginPath(); o.moveTo(x - 7, y - 13); o.lineTo(x + 5, y - 13); o.lineTo(x + 8, y - 11); o.lineTo(x + 5, y - 9); o.lineTo(x - 7, y - 9); o.fill();
        o.beginPath(); o.moveTo(x + 7, y - 8); o.lineTo(x - 5, y - 8); o.lineTo(x - 8, y - 6); o.lineTo(x - 5, y - 4); o.lineTo(x + 7, y - 4); o.fill();
        break;
      }
      case O.WINDMILL: {
        this.shadow(g, x + 6, y + 6, 12, 5, 0.3);
        g.strokeStyle = '#5a4a3a'; g.lineWidth = 1.5;
        g.beginPath(); g.moveTo(x - 7, y + 6); g.lineTo(x - 2, y - 14); g.moveTo(x + 7, y + 6); g.lineTo(x + 2, y - 14); g.moveTo(x - 5, y - 2); g.lineTo(x + 5, y - 2); g.moveTo(x - 6, y + 3); g.lineTo(x + 6, y + 3); g.stroke();
        o.strokeStyle = '#8a8680'; o.lineWidth = 2;
        for (let k = 0; k < 8; k++) { const a = k / 8 * TAU + h; o.beginPath(); o.moveTo(x, y - 22); o.lineTo(x + Math.cos(a) * 11, y - 22 + Math.sin(a) * 11); o.stroke(); }
        this.circ(o, x, y - 22, 2, '#4a4440');
        break;
      }
      case O.CHEST: {
        g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(x - 4, y - 1, 10, 5);
        g.fillStyle = '#6a4424'; g.fillRect(x - 5, y - 4, 10, 7);
        g.fillStyle = '#84582e'; g.fillRect(x - 5, y - 5, 10, 3);
        g.fillStyle = '#c8a040'; g.fillRect(x - 5, y - 2.5, 10, 1); g.fillRect(x - 1, y - 3, 2, 2.5);
        break;
      }
      case O.POLE: {
        this.shadow(g, x + 4, y + 2, 3, 1.4, 0.2);
        g.fillStyle = '#5a4430'; g.fillRect(x - 0.8, y - 6, 1.6, 8);
        o.fillStyle = '#5a4430'; o.fillRect(x - 0.8, y - 22, 1.6, 16); o.fillRect(x - 5, y - 20, 10, 1.4);
        break;
      }
      case O.RUINWALL: {
        g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(x - 6, y, 14, 6);
        g.fillStyle = h > 0.5 ? '#8a7a64' : '#7a6a58'; g.fillRect(x - 8, y - 4 - h * 5, 16, 9 + h * 5);
        g.fillStyle = '#a8987e'; g.fillRect(x - 8, y - 4 - h * 5, 16, 2);
        g.fillStyle = '#5e5242'; g.fillRect(x - 4, y - 1, 5, 1); g.fillRect(x + 2, y + 2, 5, 1);
        break;
      }
      case O.BONES: {
        g.strokeStyle = '#e8e0d0'; g.lineWidth = 1.2;
        for (let k = 0; k < 4; k++) { g.beginPath(); g.arc(x + (k - 1.5) * 2, y, 3, Math.PI * 1.1, Math.PI * 1.9); g.stroke(); }
        this.circ(g, x + 5, y + 1, 1.8, '#e8e0d0');
        break;
      }
      case O.BIGBONES: {
        g.strokeStyle = '#e4dccb'; g.lineWidth = 2;
        g.beginPath(); g.moveTo(x - 26, y); g.quadraticCurveTo(x, y - 6, x + 22, y + 2); g.stroke();
        g.lineWidth = 1.5;
        for (let k = 0; k < 8; k++) { const px = x - 16 + k * 4.5; g.beginPath(); g.arc(px, y - 1, 7 - Math.abs(k - 3.5), Math.PI * 0.1, Math.PI * 0.9); g.stroke(); g.beginPath(); g.arc(px, y - 1, 7 - Math.abs(k - 3.5), Math.PI * 1.1, Math.PI * 1.9); g.stroke(); }
        this.ell(g, x + 26, y + 2, 6, 4, '#e4dccb'); this.circ(g, x + 27, y + 1, 1.2, '#3a3028');
        break;
      }
      case O.WAGON: {
        this.shadow(g, x + 6, y + 5, 14, 5, 0.3);
        g.save(); g.translate(x + 6, y); g.rotate(h * 0.4 - 0.2);
        g.fillStyle = '#7a5836'; g.fillRect(-12, -6, 24, 11);
        g.fillStyle = '#5a3e24'; g.fillRect(-12, -6, 24, 2); g.fillRect(-12, 3, 24, 2);
        g.fillStyle = '#3a2a1a'; g.fillRect(-9, -9, 5, 3); g.fillRect(4, 6, 5, 3); g.fillRect(-9, 6, 5, 3);
        g.restore();
        break;
      }
      case O.HITCH: {
        this.shadow(g, x + 2, y + 3, 9, 2, 0.2);
        g.fillStyle = '#5a3e26'; g.fillRect(x - 8, y - 6, 1.6, 8); g.fillRect(x + 6.5, y - 6, 1.6, 8);
        g.fillStyle = '#7a5836'; g.fillRect(x - 8, y - 6, 16, 1.6);
        break;
      }
      case O.HEDGE: {
        // budanmış çit: koyu yeşil, üstü yuvarlak tümsekli
        this.shadow(g, x + 3, y + 5, 9, 3, 0.25);
        o.fillStyle = '#2e4a24'; o.fillRect(x - 8, y - 9, 16, 14);
        o.fillStyle = '#3e6230'; for (let k = 0; k < 4; k++) this.circ(o, x - 6 + k * 4, y - 8 + ((k + Math.floor(h * 4)) % 2), 3, '#3e6230');
        o.fillStyle = '#527a3c'; for (let k = 0; k < 4; k++) o.fillRect(x - 7 + k * 4, y - 10 + (k % 2), 2, 1);
        if (snowy) { o.fillStyle = 'rgba(236,241,246,0.9)'; o.fillRect(x - 8, y - 11, 16, 3); }
        break;
      }
      case O.FLOWERBED: {
        this.ell(g, x, y + 1, 7, 4.5, '#4a3220'); this.ell(g, x, y + 0.5, 6, 3.6, '#5a3e26');
        if (snowy || season === 3) break;
        const cols = season === 2 ? ['#c87a2a', '#a85a20', '#e0aa3a'] : ['#e04a5a', '#f0d040', '#f0f0f0', '#b060d0', '#f08a3a'];
        for (let k = 0; k < 9; k++) { const a = k * 2.4 + h * 7, r = 1.5 + (k % 3) * 1.5; this.circ(g, x + Math.cos(a) * r * 1.4, y + Math.sin(a) * r * 0.8, 1.1, cols[(k + Math.floor(h * 5)) % cols.length]); }
        g.fillStyle = 'rgba(60,110,40,0.7)'; for (let k = 0; k < 6; k++) g.fillRect(x - 5 + k * 2, y + 2 + (k % 2), 1, 1.5);
        break;
      }
      case O.FOUNTAIN: {
        // taş havuz, içinde su, ortada kademeli sütun
        this.shadow(g, x + 3, y + 4, 12, 5, 0.3);
        this.ell(g, x, y + 1, 12, 7.5, '#8a847a'); this.ell(g, x, y, 11, 6.6, '#b4ada2'); this.ell(g, x, y + 0.6, 9, 5.2, '#3e6a80');
        g.fillStyle = 'rgba(200,230,240,0.45)'; g.fillRect(x - 6, y - 1, 3, 1); g.fillRect(x + 3, y + 2, 3, 1);
        o.fillStyle = '#a8a196'; o.fillRect(x - 1.5, y - 10, 3, 11); this.ell(o, x, y - 10, 4.5, 2, '#b8b2a8'); this.ell(o, x, y - 10.5, 3.2, 1.3, '#4e7a90');
        o.fillStyle = 'rgba(210,235,245,0.75)'; o.fillRect(x - 0.5, y - 15, 1, 5); this.circ(o, x - 2.5, y - 8, 0.7, 'rgba(210,235,245,0.75)'); this.circ(o, x + 2.5, y - 8, 0.7, 'rgba(210,235,245,0.75)');
        if (snowy) { o.fillStyle = 'rgba(236,241,246,0.9)'; this.ell(o, x, y - 10, 4.5, 1.6, 'rgba(236,241,246,0.9)'); }
        break;
      }
      case O.STATUE: {
        // kaide üstünde bronz bir figür (elini ileri uzatmış kurucu)
        this.shadow(g, x + 3, y + 3, 7, 3, 0.3);
        g.fillStyle = '#8a847a'; g.fillRect(x - 6, y - 3, 12, 6); g.fillStyle = '#a8a196'; g.fillRect(x - 6, y - 4, 12, 2);
        o.fillStyle = '#9a948a'; o.fillRect(x - 4, y - 12, 8, 9); o.fillStyle = '#b4ada2'; o.fillRect(x - 4.5, y - 13, 9, 2);
        o.fillStyle = '#4e6a5a'; o.fillRect(x - 2, y - 24, 4, 11); this.circ(o, x, y - 26, 2.2, '#5a7a68'); o.fillRect(x + 1.5, y - 22, 5, 1.5); o.fillStyle = '#6a8a78'; o.fillRect(x - 2, y - 24, 1, 10);
        if (snowy) { o.fillStyle = 'rgba(236,241,246,0.9)'; o.fillRect(x - 4.5, y - 14, 9, 1.5); this.circ(o, x, y - 27.5, 1.2, 'rgba(236,241,246,0.9)'); }
        break;
      }
      case O.BENCH: {
        g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(x - 6, y + 1, 14, 4);
        g.fillStyle = '#7a5836'; g.fillRect(x - 8, y - 3, 16, 4); g.fillStyle = '#5a3e26'; g.fillRect(x - 8, y - 6, 16, 2);
        break;
      }
      case O.SEQUOIA: {
        this.shadow(g, x + 12, y + 8, 32, 18, 0.35);
        this.ell(g, x, y, 9, 7, '#6a3822'); this.ell(g, x - 2, y - 1, 5, 4, '#8a4a2c');
        g.fillStyle = '#7a4028'; g.fillRect(x - 7, y - 16, 14, 16);
        this.canopy(o, x, y - 26, 30, '#1f3a1c', '#2a4a24', '#3a5e30', h, 9);
        break;
      }
      case O.ARCH: {
        this.shadow(g, x + 6, y + 6, 44, 8, 0.3);
        g.fillStyle = '#9a4a2c'; g.fillRect(x - 46, y - 18, 14, 22); g.fillRect(x + 32, y - 18, 14, 22);
        o.fillStyle = '#a8563a'; o.beginPath(); o.moveTo(x - 46, y - 16); o.quadraticCurveTo(x, y - 62, x + 46, y - 16); o.lineTo(x + 32, y - 16); o.quadraticCurveTo(x, y - 44, x - 32, y - 16); o.closePath(); o.fill();
        o.fillStyle = '#c0704e'; o.beginPath(); o.moveTo(x - 44, y - 20); o.quadraticCurveTo(x, y - 60, x + 44, y - 20); o.lineTo(x + 40, y - 20); o.quadraticCurveTo(x, y - 55, x - 40, y - 20); o.closePath(); o.fill();
        break;
      }
      case O.GALLOWS: {
        this.shadow(g, x + 4, y + 4, 12, 6, 0.3);
        g.fillStyle = '#6a4a2e'; g.fillRect(x - 10, y - 6, 20, 12);
        g.fillStyle = '#5a3e24'; for (let k = 0; k < 5; k++) g.fillRect(x - 10, y - 6 + k * 2.6, 20, 0.6);
        o.fillStyle = '#4a3422'; o.fillRect(x - 8, y - 26, 2, 22); o.fillRect(x - 8, y - 26, 16, 2);
        o.strokeStyle = '#a89060'; o.lineWidth = 0.8; o.beginPath(); o.moveTo(x + 5, y - 24); o.lineTo(x + 5, y - 14); o.stroke();
        o.beginPath(); o.arc(x + 5, y - 12.5, 1.6, 0, TAU); o.stroke();
        break;
      }
      case O.LOTSIGN: {
        this.shadow(g, x + 2, y + 2, 5, 1.5, 0.25);
        g.fillStyle = '#4a3422'; g.fillRect(x - 0.8, y - 8, 1.6, 10);
        o.fillStyle = '#3a2818'; o.fillRect(x - 7, y - 17, 14, 10);
        o.fillStyle = '#e8dcc0'; o.fillRect(x - 6, y - 16, 12, 8);
        o.fillStyle = '#b3261e'; o.fillRect(x - 6, y - 16, 12, 2.4);
        o.fillStyle = '#2a6a2a'; o.font = 'bold 6px serif'; o.textAlign = 'center'; o.textBaseline = 'middle'; o.fillText('$', x, y - 10.5);
        break;
      }
      case O.BOARD: {
        this.shadow(g, x + 2, y + 2, 6, 1.5, 0.25);
        g.fillStyle = '#4a3422'; g.fillRect(x - 5, y - 10, 1.4, 12); g.fillRect(x + 3.6, y - 10, 1.4, 12);
        o.fillStyle = '#6a4a2e'; o.fillRect(x - 6, y - 17, 12, 9);
        o.fillStyle = '#e0d4b0'; o.fillRect(x - 5, y - 16, 4, 5); o.fillRect(x, y - 15, 4, 5);
        break;
      }
      case O.SHIP: {
        this.shadow(g, x + 6, y + 6, 36, 10, 0.3);
        g.save(); g.translate(x, y); g.rotate(-0.15);
        g.fillStyle = '#5a3e26'; g.beginPath(); g.moveTo(-36, 0); g.quadraticCurveTo(-30, -12, 0, -12); g.lineTo(28, -8); g.lineTo(38, 0); g.lineTo(28, 8); g.lineTo(0, 12); g.quadraticCurveTo(-30, 12, -36, 0); g.fill();
        g.fillStyle = '#7a5836'; g.fillRect(-26, -7, 50, 14);
        g.fillStyle = '#3a2818'; for (let k = 0; k < 8; k++) g.fillRect(-24 + k * 6, -7, 1, 14);
        g.fillStyle = '#2a1c12'; g.fillRect(-6, -3, 9, 7);
        g.restore();
        o.fillStyle = '#4a3422'; o.save(); o.translate(x, y); o.rotate(0.5); o.fillRect(-2, -32, 3, 30); o.restore();
        break;
      }
    }
  },

  /* Dinamik çizilen toplanabilir bitkiler */
  herb(ctx, type, x, y, t, glow) {
    const cols = HERB_COLS[type] || HERB_COL0;
    if (glow) { ctx.fillStyle = 'rgba(255,240,180,0.25)'; ctx.beginPath(); ctx.arc(x, y, 7 + Math.sin(t * 4) * 1, 0, TAU); ctx.fill(); }
    if (type === O.MUSHROOM) {
      ctx.fillStyle = cols[0]; ctx.fillRect(x - 0.8, y - 1, 1.6, 3);
      this.ell(ctx, x, y - 1.5, 3, 2, cols[1]); ctx.fillStyle = '#fff'; ctx.fillRect(x - 1, y - 2.5, 0.8, 0.8);
      return;
    }
    if (type === O.BERRY) {
      this.circ(ctx, x - 2, y, 3.2, cols[0]); this.circ(ctx, x + 2, y, 3.2, cols[0]); this.circ(ctx, x, y - 2, 3.2, '#4a6a30');
      for (let k = 0; k < 6; k++) this.circ(ctx, x + Math.cos(k * 1.2) * 2.5, y - 1 + Math.sin(k * 1.2) * 2, 0.9, cols[1]);
      return;
    }
    ctx.strokeStyle = cols[0]; ctx.lineWidth = 1;
    for (let k = 0; k < 5; k++) { const a = -Math.PI / 2 + (k - 2) * 0.45; ctx.beginPath(); ctx.moveTo(x, y + 2); ctx.lineTo(x + Math.cos(a) * 4.5, y + 2 + Math.sin(a) * 5); ctx.stroke(); }
    for (let k = 0; k < 3; k++) { ctx.fillStyle = cols[1]; ctx.fillRect(x - 2.5 + k * 2, y - 3 - (k % 2), 1.5, 1.5); }
  },
  sparkle(ctx, x, y, t) {
    const a = 0.5 + Math.sin(t * 5) * 0.4;
    ctx.fillStyle = `rgba(255,240,190,${a})`;
    ctx.fillRect(x - 0.5, y - 3, 1, 6); ctx.fillRect(x - 3, y - 0.5, 6, 1);
  },
  fire(ctx, x, y, t, s = 1) {
    for (let k = 0; k < 5; k++) {
      const f = Math.sin(t * 13 + k * 2.1);
      ctx.fillStyle = k < 2 ? '#e05a1a' : k < 4 ? '#f0a030' : '#fff0a0';
      ctx.beginPath();
      ctx.ellipse(x + (k - 2) * 1.2 * s + f * 0.5, y - 2 * s - (k % 3) * s, (2.4 - k * 0.35) * s, (3.4 + f) * s, 0, 0, TAU);
      ctx.fill();
    }
  },

  /* ---------- Binalar ---------- */
  /* Bina zemini (gölge, iç mekân, veranda direkleri) chunk'a çizilir */
  buildingGround(g, b, world) {
    this.building(g, NOPCTX, b, world);
    if (b.enter) this.interior(g, b, world);
  },
  /* Cephe + çatı: bina başına önbelleğe alınan ayrı tuval (içerideyken soluklaşır) */
  cover(b, world) {
    if (b.cover) return b.cover;
    const X = b.x * TS - 40, Y = b.y * TS - 70;
    const c = makeCanvas(b.w * TS + 80, b.h * TS + 96), ctx = c.getContext('2d');
    ctx.translate(-X, -Y);
    this.building(NOPCTX, ctx, b, world);
    b.cover = { c, x: X, y: Y };
    return b.cover;
  },
  /* ---------- İç mekân ---------- */
  interior(g, b, world) {
    const X = b.x * TS, Y = b.y * TS, W = b.w * TS, H = b.h * TS, t = b.type;
    const up = !!upPlan(b) && b.floor === 1;
    if (t === 'hotel') this.hotelBase(g, b, X, Y, W, H, up);
    else {
      // döşeme, halılar ve arka duvar ortak desenden (IntDeco); duvarın döşemeye düşen gölgesi
      g.drawImage(IntDeco.canvas(b), X, Y);
      g.fillStyle = 'rgba(0,0,0,0.2)'; g.fillRect(X, Y + 16, W, 3);
    }
    this.wallDecor(g, b, X, Y, W, world);
    this.interiorShell(g, b, X, Y, W, H, up, world);
  },
  /* İnşa menüsündeki kademe önizlemesi: yapının dışı (cephe, çatı) ve içi (döşeme, duvar, eşyalar). Yapı, gerçek dünyaya
     dokunmayan sahte bir dünyada (kendi eşya dizisi, karsız) döşenip çizilir; tür, kademe ve çizici başına bir kez. Melez
     çizimde ikisi de melez çiziciden gelir (ışıksız renk katmanı, iki kat çözünürlük). ew/iw: dünya pikseli genişlikleri. */
  tierPreview(type, tier) {
    const hy = G.hybridOn(), key = type + '/' + tier + (hy ? '/h' : ''), P = this._tierPrev || (this._tierPrev = new Map());
    let r = P.get(key);
    if (r) return r;
    const def = BUILDINGS[type], x = 4, y = 6, w = def.w, h = def.h, X = x * TS, Y = y * TS, Wd = w * TS, Hd = h * TS;
    const fw = Object.create(G.world);
    fw.obj = new Uint8Array((y + h + 2) * WW); fw.lights = []; fw.season = 0; fw.snowyTile = () => false;
    const b = { id: -1, type, x, y, w, h, def, tier, town: null, name: def.n, modern: 0, enter: true, door: { x: (x + (w >> 1)) * TS + TS / 2, y: (y + h) * TS + 6 } };
    fw.furnish(b);
    // saydam kenarları kırp
    const crop = (cv, s) => {
      const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
      let x0 = cv.width, y0 = cv.height, x1 = -1, y1 = -1;
      for (let yy = 0; yy < cv.height; yy++) for (let xx = 0; xx < cv.width; xx++) if (d[(yy * cv.width + xx) * 4 + 3] > 8) { if (xx < x0) x0 = xx; if (xx > x1) x1 = xx; if (yy < y0) y0 = yy; if (yy > y1) y1 = yy; }
      if (x1 < 0) { x0 = y0 = 0; x1 = cv.width - 1; y1 = cv.height - 1; }
      const c = makeCanvas(x1 - x0 + 1, y1 - y0 + 1);
      c.getContext('2d').drawImage(cv, -x0, -y0);
      return { url: c.toDataURL(), w: c.width / s };
    };
    let ext, int, s = 1;
    if (hy) { const p = HY.preview(b, fw); ext = p.ext; int = p.int; s = 2; }
    else {
      // dış: zemin katmanı (gölge, veranda direkleri) altta, örtü (cephe, çatı, tabela) üstte
      ext = makeCanvas(Wd + 24, Hd + 76);
      const eo = makeCanvas(Wd + 24, Hd + 76), g = ext.getContext('2d'), o = eo.getContext('2d');
      g.translate(12 - X, 56 - Y); o.translate(12 - X, 56 - Y);
      this.building(g, o, b, fw);
      g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(eo, 0, 0);
      int = makeCanvas(Wd + 8, Hd + 24);
      const gi = int.getContext('2d');
      gi.translate(4 - X, 20 - Y);
      this.interior(gi, b, fw);
    }
    const e = crop(ext, s), n = crop(int, s);
    r = { ext: e.url, ew: e.w, int: n.url, iw: n.w };
    P.set(key, r);
    if (P.size > 16) P.delete(P.keys().next().value);
    return r;
  },
  /* Otelin zemini ve arka duvarı (otel kendi çizimini korur): tahta döşeme, ortada halı (üst katta koridor boyunca
     uzun yolluk), desenli duvar kâğıdı ve lambri */
  hotelBase(g, b, X, Y, W, H, up) {
    const L = hotelLook(b);
    g.fillStyle = L.fl; g.fillRect(X, Y, W, H);
    g.fillStyle = 'rgba(0,0,0,0.22)';
    for (let yy = Y + 4; yy < Y + H; yy += 5) {
      g.fillRect(X, yy, W, 1);
      const off = ((yy - Y) / 5 | 0) * 11 % 23;
      for (let xx = X + off; xx < X + W; xx += 23) g.fillRect(xx, yy - 4, 1, 4);
    }
    g.fillStyle = 'rgba(255,240,210,0.05)'; for (let yy = Y + 2; yy < Y + H; yy += 10) g.fillRect(X, yy, W, 2);
    const rug = L.rug;
    if (rug) {
      const rw = up ? W - 48 : Math.min(W - 40, 64), rh = up ? 20 : Math.min(H - 40, 34), rx = X + W / 2 - rw / 2, ry = up ? Y + 54 : Y + H / 2 - rh / 2 + 6;
      g.fillStyle = rug; g.fillRect(rx, ry, rw, rh);
      g.strokeStyle = shadeHex(rug, 0.35); g.lineWidth = 1; g.strokeRect(rx + 2.5, ry + 2.5, rw - 5, rh - 5);
      g.fillStyle = 'rgba(0,0,0,0.12)'; for (let k = 0; k < rw; k += 4) g.fillRect(rx + k, ry + rh, 2, 2);
    }
    const WP = L.wp;
    g.fillStyle = WP; g.fillRect(X, Y, W, 16);
    g.fillStyle = 'rgba(255,230,180,0.08)'; for (let xx = X + 2; xx < X + W; xx += 5) g.fillRect(xx, Y, 2, 12);
    g.fillStyle = shadeHex(WP, -0.22); g.fillRect(X, Y + 11, W, 5);
    g.fillStyle = shadeHex(WP, -0.2); g.fillRect(X, Y + 11, W, 1);
    g.fillStyle = '#1e140c'; g.fillRect(X, Y, W, 2);
    g.fillStyle = 'rgba(0,0,0,0.2)'; g.fillRect(X, Y + 16, W, 3);
  },
  /* Yan ve ön duvarlar, pencereler, otelin kilitli odaları ve eşyalar */
  interiorShell(g, b, X, Y, W, H, up, world) {
    // yan duvarlar ve ön duvar
    const WD = '#3a2818';
    g.fillStyle = WD; g.fillRect(X, Y, 5, H); g.fillRect(X + W - 5, Y, 5, H);
    g.fillStyle = 'rgba(255,220,170,0.12)'; g.fillRect(X + 4, Y + 2, 1, H - 2); g.fillRect(X + W - 5, Y + 2, 1, H - 2);
    g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(X + 5, Y + 16, 3, H - 20); g.fillRect(X + W - 8, Y + 16, 3, H - 20);
    const dx = b.door.x;
    if (up) { g.fillStyle = WD; g.fillRect(X, Y + H - 4, W, 4); }   // üst katta kapı yok
    else {
      g.fillStyle = WD; g.fillRect(X, Y + H - 4, dx - 8 - X, 4); g.fillRect(dx + 8, Y + H - 4, X + W - dx - 8, 4);
      g.fillStyle = '#8a6a44'; g.fillRect(dx - 8, Y + H - 3, 16, 3);
    }
    // iç duvarlar: üst katın oda duvarları ya da zemin kattaki ara duvar (karo kenarındaki ince bantlar; kapılar ayrı çizilir)
    for (const [lx, ly, v] of floorWalls(b)) {
      const x = X + lx * TS, y = Y + ly * TS, r = v === 1 ? [x, y, 16, 6] : v === 2 ? [x, y + 12, 16, 4] : v === 4 ? [x, y, 5, 16] : [x + 11, y, 5, 16];
      g.fillStyle = WD; g.fillRect(r[0], r[1], r[2], r[3]);
      g.fillStyle = 'rgba(255,220,170,0.14)'; if (v <= 2) g.fillRect(r[0], r[1], r[2], 1); else g.fillRect(v === 4 ? r[0] + r[2] - 1 : r[0], r[1], 1, r[3]);
      g.fillStyle = 'rgba(0,0,0,0.16)'; if (v <= 2) g.fillRect(r[0], r[1] + r[3], r[2], 2);
    }
    // ön duvar pencereleri (üst katta öndeki odaların ortasında)
    const nWin = Math.max(1, Math.floor(b.w / 3));
    const wins = up ? upWins(b).map(x => X + x) : Array.from({ length: nWin }, (_, k) => X + (k + 0.5) * W / nWin);
    for (const cx of wins) { if (!up && Math.abs(cx - dx) < 14) continue; g.fillStyle = '#8ab0c8'; g.fillRect(cx - 4, Y + H - 4, 8, 3); g.fillStyle = 'rgba(200,230,255,0.12)'; g.fillRect(cx - 5, Y + H - 16, 10, 12); }
    // yan pencereler
    if (b.h >= 6) { g.fillStyle = '#8ab0c8'; g.fillRect(X + 1, Y + H / 2 - 4, 3, 8); g.fillRect(X + W - 4, Y + H / 2 - 4, 3, 8); }
    // otelin üst katı: kilitli odaların içi görünmez, üstleri karanlık bir tavanla örtülü (kapılar üstüne çizilir)
    for (const [x, y, w, h] of hotelShut(b)) for (let yy = Y + y; yy < Y + y + h; yy += 3) {
      g.fillStyle = Math.floor((yy - Y) / 6) % 2 ? '#1c130d' : '#181009'; g.fillRect(X + x, yy, w, Math.min(3, Y + y + h - yy));
    }
    // eşyalar
    for (let ly = 1; ly < b.h; ly++) for (let lx = 0; lx < b.w; lx++) {
      const tx = b.x + lx, ty = b.y + ly, i = ty * WW + tx, o = world.obj[i];
      if (!o) continue;
      const cx = tx * TS + 8, cy = ty * TS + 8;
      if (isFurnO(o)) this.furn(g, o, cx, cy, world, i, b, hash2(tx, ty, 17));
      else Spr.object(g, g, o, cx, cy, hash2(tx, ty, 77), world);
    }
  },
  /* Arka duvarın süsleri: bina türüne göre raflar, tablolar, aynalar, afişler, aletler; zengin şehirde yaldızlı
     çerçeveler ve aplikler. Önünde uzun eşya (dolap, saat, şömine...) duran yerlere süs konmaz. */
  wallDecor(g, b, X, Y, W, world) {
    const t = b.type, h = (k) => b.tier ? bHash(b, 29 + k) : hash2(b.x * 3 + k, b.y, 29), rich = richB(b);
    const TALL = new Set([O.BOOKCASE, O.GCLOCK, O.WARDROBE, O.CABINET, O.FIREPLACE, O.PALM, O.ORGAN, O.OVEN, O.FORGE, O.DRESSER, O.LAMPSTAND]);
    const objAt = (x) => world ? world.obj[(b.y + 1) * WW + Math.floor(x / TS)] : 0;
    const free = (x, r = 5) => !world || (!TALL.has(objAt(x - r)) && !TALL.has(objAt(x + r)) && x - r > X + 5 && x + r < X + W - 5);
    const used = [], use = (a, z) => used.push([a, z]), busy = (a, z) => used.some(([p, q]) => a < q && z > p);
    const spot = (x, r = 5) => { for (const d of [0, 6, -6, 12, -12, 18, -18]) if (free(x + d, r) && !busy(x + d - r, x + d + r)) return x + d; return null; };
    const gold = rich ? '#c8a040' : '#8a6a30';
    const win = (x) => { g.fillStyle = '#3a2a1c'; g.fillRect(x - 5, Y + 2, 10, 9); g.fillStyle = '#8ab0c8'; g.fillRect(x - 4, Y + 3, 8, 7); g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(x - 4, Y + 3, 3, 7); g.fillStyle = '#3a2a1c'; g.fillRect(x - 0.5, Y + 3, 1, 7); g.fillRect(x - 4, Y + 6, 8, 0.8); if (rich) { g.fillStyle = '#7a2a30'; g.fillRect(x - 6, Y + 2, 2, 9); g.fillRect(x + 4, Y + 2, 2, 9); } };
    const shelf = (x0, x1, jars) => {
      use(x0, x1);
      g.fillStyle = rich ? '#3a2014' : '#4a3020'; g.fillRect(x0, Y + 5, x1 - x0, 1.5); g.fillRect(x0, Y + 10, x1 - x0, 1.5);
      const cols = jars ? ['#7aa0a8', '#c8a060', '#a8c0a0', '#d8d0c0', '#b07050'] : ['#c8402c', '#e0c060', '#4a7aa8', '#6a9a4a', '#d8d0c0', '#8a5a2a', '#b070a0'];
      for (let x = x0 + 1; x < x1 - 2; x += 3) for (const [y0, k] of [[Y + 2, 1], [Y + 7, 7]]) {
        const c = cols[Math.floor(h(x + k) * cols.length)], hh = 2.4 + h(x + k + 3) * 0.8;
        g.fillStyle = c; g.fillRect(x, y0 + 3 - hh, 2, hh);
        if (jars) { g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(x, y0 + 3 - hh, 0.6, hh); g.fillStyle = '#5a4a3a'; g.fillRect(x, y0 + 2.4 - hh, 2, 0.7); }
      }
      if (rich) { g.fillStyle = gold; g.fillRect(x0, Y + 5, x1 - x0, 0.5); g.fillRect(x0, Y + 10, x1 - x0, 0.5); }
    };
    const poster = (x) => { use(x - 3, x + 3); g.fillStyle = '#e8dcb8'; g.fillRect(x - 3, Y + 2, 6, 8); g.fillStyle = '#3a2a1c'; g.fillRect(x - 2, Y + 3, 4, 1); g.fillRect(x - 1.5, Y + 5, 3, 3); g.fillRect(x - 2, Y + 8.5, 4, 0.8); g.fillStyle = 'rgba(0,0,0,0.2)'; g.fillRect(x + 3, Y + 3, 0.6, 7.6); };
    // manzara tablosu: gökyüzü, tepeler, ova (zenginde yaldızlı çerçeve)
    const frame = (x, col, w = 10) => {
      g.fillStyle = gold; g.fillRect(x - w / 2, Y + 2, w, 8); g.fillStyle = col; g.fillRect(x - w / 2 + 1, Y + 3, w - 2, 6);
      g.fillStyle = shadeHex(col, 0.35); g.fillRect(x - w / 2 + 1, Y + 3, w - 2, 2);
      g.fillStyle = shadeHex(col, -0.3); g.beginPath(); g.moveTo(x - w / 2 + 1, Y + 7); g.lineTo(x - 1, Y + 5); g.lineTo(x + 2, Y + 6.5); g.lineTo(x + w / 2 - 1, Y + 5.5); g.lineTo(x + w / 2 - 1, Y + 9); g.lineTo(x - w / 2 + 1, Y + 9); g.fill();
      if (rich) { g.fillStyle = '#f0d070'; g.fillRect(x - w / 2, Y + 2, w, 0.6); }
    };
    // portre: koyu zemin önünde omuz ve baş silueti
    const portrait = (x) => { g.fillStyle = gold; g.fillRect(x - 4, Y + 1.5, 8, 9.5); g.fillStyle = '#2a2420'; g.fillRect(x - 3, Y + 2.5, 6, 7.5); g.fillStyle = '#4a3a30'; g.fillRect(x - 2.5, Y + 7, 5, 3); this.circ(g, x, Y + 5.2, 1.6, '#c8a088'); g.fillStyle = '#3a2a20'; g.fillRect(x - 1.6, Y + 3.4, 3.2, 1); };
    const mirror = (x, w) => { g.fillStyle = gold; g.fillRect(x - w / 2 - 1, Y + 1.5, w + 2, 9.5); g.fillStyle = '#9ab4c0'; g.fillRect(x - w / 2, Y + 2.5, w, 7.5); g.fillStyle = 'rgba(255,255,255,0.35)'; for (let k = 0; k < w - 2; k += 5) g.fillRect(x - w / 2 + 1 + k, Y + 3, 1.2, 6.5); g.fillStyle = 'rgba(40,60,70,0.25)'; g.fillRect(x - w / 2, Y + 8, w, 2); };
    const clock = (x) => { this.circ(g, x, Y + 6, 4, gold); this.circ(g, x, Y + 6, 3, '#f0ead8'); g.fillStyle = '#1a1a1a'; g.fillRect(x - 0.4, Y + 3.5, 0.8, 2.5); g.fillRect(x, Y + 5.6, 2, 0.8); };
    const antlers = (x) => {
      g.fillStyle = '#5a3a22'; g.fillRect(x - 2.5, Y + 6, 5, 4); g.fillStyle = '#8a6a48'; g.fillRect(x - 1.5, Y + 6.5, 3, 2);
      g.strokeStyle = '#d8c8a8'; g.lineWidth = 0.9; g.beginPath();
      for (const s of [-1, 1]) { g.moveTo(x + s, Y + 6.5); g.lineTo(x + s * 4, Y + 3); g.lineTo(x + s * 6, Y + 2); g.moveTo(x + s * 2.8, Y + 4.5); g.lineTo(x + s * 2.5, Y + 2); g.moveTo(x + s * 4.6, Y + 2.6); g.lineTo(x + s * 4.6, Y + 1.2); }
      g.stroke();
    };
    const sconce = (x) => { g.fillStyle = '#6a5a3a'; g.fillRect(x - 0.5, Y + 6, 1, 4); g.fillStyle = gold; g.fillRect(x - 2, Y + 9, 4, 1); g.fillStyle = 'rgba(240,230,200,0.85)'; g.fillRect(x - 1.5, Y + 4, 3, 5); g.fillStyle = '#ffd070'; g.fillRect(x - 0.5, Y + 5.5, 1, 2); };
    const rifles = (x0, x1) => { use(x0 - 1, x1); for (let x = x0; x < x1; x += 6) { g.fillStyle = '#2a2a2e'; g.fillRect(x, Y + 2, 1.5, 9); g.fillStyle = '#6a4428'; g.fillRect(x - 0.5, Y + 7, 2.5, 4); } };
    const hooks = (x0, x1) => { use(x0 - 2, x1); for (let x = x0; x < x1; x += 6) { g.fillStyle = '#6a6a6a'; g.fillRect(x, Y + 2, 1, 2); this.ell(g, x + 0.5, Y + 6.5, 2, 3, h(x) < 0.5 ? '#9a3a2a' : '#b8584a'); g.fillStyle = 'rgba(255,230,220,0.3)'; g.fillRect(x - 0.5, Y + 5, 1, 2); } };
    const pelt = (x) => { g.strokeStyle = '#5a3a1e'; g.lineWidth = 0.8; g.strokeRect(x - 4, Y + 1.5, 8, 9); this.ell(g, x, Y + 6, 3.2, 4, h(x) < 0.5 ? '#7a5434' : '#9a7a54'); this.ell(g, x, Y + 6, 1.8, 2.6, h(x) < 0.5 ? '#9a7450' : '#b89a74'); };
    const map = (x, w) => { g.fillStyle = '#5a3a22'; g.fillRect(x - w / 2 - 0.5, Y + 1.5, w + 1, 9.5); g.fillStyle = '#d8c8a0'; g.fillRect(x - w / 2, Y + 2, w, 8.5); g.strokeStyle = '#8a6a48'; g.lineWidth = 0.5; g.beginPath(); for (let k = 0; k < 3; k++) { g.moveTo(x - w / 2 + 1, Y + 3.5 + k * 2.4); g.lineTo(x + w / 2 - 1, Y + 4.5 + k * 2.4 - h(k) * 1.6); } g.stroke(); g.strokeStyle = '#4a7a9a'; g.lineWidth = 0.7; g.beginPath(); g.moveTo(x - w / 2 + 2, Y + 9.5); g.quadraticCurveTo(x, Y + 3, x + w / 2 - 2, Y + 7); g.stroke(); g.fillStyle = '#a03a2a'; g.fillRect(x + w * 0.15, Y + 5, 1, 1); };
    const board = (x, w, col = '#2e3a30') => { g.fillStyle = '#5a3a22'; g.fillRect(x - w / 2 - 1, Y + 1.5, w + 2, 9.5); g.fillStyle = col; g.fillRect(x - w / 2, Y + 2.5, w, 7.5); g.fillStyle = 'rgba(240,236,220,0.75)'; for (let k = 0; k < 3; k++) g.fillRect(x - w / 2 + 1.5, Y + 4 + k * 2, (w - 3) * (0.5 + h(x + k) * 0.5), 0.6); };
    const diploma = (x) => { g.fillStyle = '#3a2416'; g.fillRect(x - 3.5, Y + 2.5, 7, 6); g.fillStyle = '#f0ead8'; g.fillRect(x - 2.8, Y + 3.2, 5.6, 4.6); g.fillStyle = '#6a5a4a'; g.fillRect(x - 2, Y + 4, 4, 0.5); g.fillRect(x - 2, Y + 5.2, 3, 0.5); g.fillStyle = '#b02a2a'; g.fillRect(x + 1, Y + 6.2, 1.2, 1.2); };
    const chart = (x) => { g.fillStyle = '#f4f0e8'; g.fillRect(x - 3, Y + 1.5, 6, 9); g.fillStyle = '#1a1a1a'; for (let k = 0; k < 4; k++) g.fillRect(x - 2.2 + k * 0.4, Y + 2.5 + k * 2, 4.4 - k * 0.8, 1.1 - k * 0.15); };
    const shoes = (x0, x1) => { use(x0 - 2, x1); g.strokeStyle = '#6a6a6e'; g.lineWidth = 0.9; for (let x = x0; x < x1; x += 7) { g.beginPath(); g.arc(x, Y + 5 + (h(x) < 0.5 ? 0 : 3), 2, 0.3, Math.PI - 0.3, true); g.stroke(); } };
    const tools = (x0, x1) => {
      use(x0 - 3, x1);
      for (let x = x0; x < x1; x += 9) {
        const k = Math.floor(h(x) * 3);
        if (k === 0) { g.fillStyle = '#9aa0a6'; g.beginPath(); g.moveTo(x - 3, Y + 3); g.lineTo(x + 3, Y + 3); g.lineTo(x + 3, Y + 6); g.lineTo(x - 3, Y + 4.4); g.fill(); g.fillStyle = '#6a4428'; g.fillRect(x + 3, Y + 2.6, 1.6, 3.6); }
        else if (k === 1) { g.fillStyle = '#6a4428'; g.fillRect(x - 0.5, Y + 3, 1, 8); g.fillStyle = '#5a5a5e'; g.fillRect(x - 2, Y + 2.5, 4, 2); }
        else { g.strokeStyle = '#4a4a4e'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(x - 1.5, Y + 2.5); g.lineTo(x + 1, Y + 10); g.moveTo(x + 1.5, Y + 2.5); g.lineTo(x - 1, Y + 10); g.stroke(); }
      }
    };
    const pigeon = (x0, x1) => { use(x0, x1); g.fillStyle = '#4a3020'; g.fillRect(x0, Y + 2, x1 - x0, 9); for (let x = x0 + 1; x < x1 - 2; x += 3.5) for (let y = Y + 2.8; y < Y + 10; y += 2.6) { g.fillStyle = '#2a1a10'; g.fillRect(x, y, 2.8, 2); if (h(x * 3 + y) < 0.6) { g.fillStyle = h(x + y) < 0.5 ? '#e8e0c8' : '#d8c8a0'; g.fillRect(x + 0.3, y + 0.6, 2.2, 1.2); } } };
    const clothes = (x0, x1) => { use(x0, x1); g.strokeStyle = '#d8d0c0'; g.lineWidth = 0.5; g.beginPath(); g.moveTo(x0, Y + 3); g.lineTo(x1, Y + 3); g.stroke(); for (let x = x0 + 3; x < x1 - 4; x += 8) { const c = ['#e8e4dc', '#9ab0c8', '#c8b8a0', '#e0d0d0'][Math.floor(h(x) * 4)]; g.fillStyle = c; g.fillRect(x - 2.5, Y + 3, 5, 5); g.fillRect(x - 3.5, Y + 3, 1.5, 2.5); g.fillRect(x + 2, Y + 3, 1.5, 2.5); g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(x - 2.5, Y + 6.5, 5, 1.5); } };
    const ristra = (x) => { g.fillStyle = '#6a5a3a'; g.fillRect(x - 0.3, Y + 1.5, 0.6, 2); for (let k = 0; k < 4; k++) { this.ell(g, x - 0.8, Y + 4 + k * 1.8, 1.1, 0.9, '#b02a1a'); this.ell(g, x + 0.9, Y + 4.8 + k * 1.8, 1.1, 0.9, '#c8381e'); } };
    const plate = (x, c) => { this.circ(g, x, Y + 6, 2.6, '#e8e0d0'); this.circ(g, x, Y + 6, 1.8, c); this.circ(g, x, Y + 6, 0.8, '#e8e0d0'); };
    const wheel = (x) => { g.strokeStyle = '#6a4428'; g.lineWidth = 1; g.beginPath(); g.arc(x, Y + 6, 3.5, 0, TAU); g.stroke(); g.beginPath(); for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; g.moveTo(x + Math.cos(a) * 1, Y + 6 + Math.sin(a) * 1); g.lineTo(x + Math.cos(a) * 5, Y + 6 + Math.sin(a) * 5); } g.stroke(); this.circ(g, x, Y + 6, 1, '#8a6440'); };
    const ring = (x) => { g.strokeStyle = '#d8d0c8'; g.lineWidth = 2; g.beginPath(); g.arc(x, Y + 6, 3, 0, TAU); g.stroke(); g.strokeStyle = '#c83a2a'; g.lineWidth = 2; for (let k = 0; k < 4; k++) { g.beginPath(); g.arc(x, Y + 6, 3, k * Math.PI / 2, k * Math.PI / 2 + 0.5); g.stroke(); } };
    const pans = (x0, x1) => { use(x0 - 3, x1); for (let x = x0; x < x1; x += 6) { g.fillStyle = '#5a4a3a'; g.fillRect(x - 0.3, Y + 2, 0.6, 2); this.circ(g, x, Y + 6.5, 2.4, '#b8683a'); this.circ(g, x - 0.6, Y + 6, 1.2, '#d8905a'); g.fillStyle = '#6a3a1e'; g.fillRect(x - 0.4, Y + 3.2, 0.8, 1.4); } };
    const bottles = (x0, x1) => {
      // bar arkası: aynanın iki yanında şişe rafları
      use(x0, x1);
      const mw = Math.min(26, (x1 - x0) * 0.42), mx = (x0 + x1) / 2;
      mirror(mx, mw);
      for (const [a, c] of [[x0, mx - mw / 2 - 2], [mx + mw / 2 + 2, x1]]) {
        if (c - a < 4) continue;
        g.fillStyle = '#4a2a18'; g.fillRect(a, Y + 6, c - a, 1.2); g.fillRect(a, Y + 10.5, c - a, 1.2);
        for (let x = a + 0.5; x < c - 1.5; x += 2.2) for (const y0 of [Y + 6, Y + 10.5]) { const k = h(x * 7 + y0); g.fillStyle = ['#6a3a1a', '#3a5a2a', '#8a7a4a', '#5a2a2a', '#c8b890'][Math.floor(k * 5)]; g.fillRect(x, y0 - 3.4 + k, 1.4, 3.4 - k); g.fillRect(x + 0.3, y0 - 4.4 + k, 0.8, 1); }
      }
    };
    const stained = (x) => { g.fillStyle = '#3a2a1c'; g.fillRect(x - 4, Y + 1, 8, 10); const c = ['#c83a3a', '#3a6ac8', '#e0c040', '#3a9a5a']; for (let k = 0; k < 4; k++) { g.fillStyle = c[(k + Math.floor(x)) % 4]; g.fillRect(x - 3 + (k % 2) * 3, Y + 2 + (k >> 1) * 4, 3, 4); } g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(x - 3, Y + 2, 1, 8); };
    const cross = (x) => { g.fillStyle = rich ? '#e0b848' : '#c8a040'; g.fillRect(x - 0.8, Y + 2, 1.6, 9); g.fillRect(x - 3, Y + 4, 6, 1.6); };
    // yerleştirme yardımcıları: önü boşsa çiz
    const at = (fn, x, r = 5) => { const s = spot(x, r); if (s !== null) { use(s - r, s + r); fn(s); } return s; };
    const x0 = X + 8, x1 = X + W - 8;
    // barın duvardaki genişliği (bar arkası rafları ve ayna onun üstüne)
    const barSpan = () => { let a = null, z = null; if (world) for (let lx = 1; lx < b.w - 1; lx++) if (world.obj[(b.y + 2) * WW + b.x + lx] === O.BAR) { if (a === null) a = lx; z = lx; } return a === null ? null : [X + a * TS + 2, X + (z + 1) * TS - 2]; };
    switch (t) {
      case 'general': shelf(x0, x1, rich); break;
      case 'fence': shelf(x0, X + W * 0.6); at(pelt, X + W * 0.78); break;
      case 'mine': tools(x0, X + W * 0.45); at((x) => map(x, 14), X + W * 0.72, 8); break;
      case 'cabin': at(pelt, X + W * 0.3); at(pelt, X + W * 0.5); shelf(X + W * 0.62, x1); break;
      case 'doctor': shelf(x0, X + W * 0.42, true); at(diploma, X + W * 0.55); at(chart, X + W * 0.66); at(win, X + W * 0.84); if (rich) at(portrait, X + W * 0.48); break;
      case 'pharmacy': shelf(x0, x1, true); break;
      case 'gunsmith': rifles(x0, x1); if (rich) at(antlers, X + W * 0.5, 7); break;
      case 'butcher': hooks(x0, X + W * 0.62); at(pelt, X + W * 0.74); at(pelt, X + W * 0.88); break;
      case 'saloon': case 'gambling': case 'cantina': {
        const bs = barSpan();
        if (bs && t !== 'cantina') bottles(bs[0], bs[1]); else if (bs) shelf(bs[0], bs[1]);
        const rest = bs ? (bs[0] - X > W / 2 ? [x0, bs[0] - 6] : [bs[1] + 6, x1]) : [x0, x1];
        const n = Math.max(1, Math.floor((rest[1] - rest[0]) / 26));
        for (let k = 0; k < n; k++) {
          const x = rest[0] + (k + 0.5) * (rest[1] - rest[0]) / n;
          if (t === 'cantina') { at(ristra, x - 6); at((xx) => plate(xx, ['#2a6a8a', '#c86a2a', '#3a8a5a'][k % 3]), x + 2); at(ristra, x + 9); }
          else if (k % 2 === 0) at(antlers, x, 7); else at((xx) => frame(xx, ['#6a7a5a', '#7a6a4a', '#5a6a7a'][k % 3], 12), x, 7);
        }
        break;
      }
      case 'sheriff': for (const f of [0.3, 0.38, 0.46]) at(poster, X + W * f, 3); at((x) => map(x, 12), X + W * 0.62, 7); at(win, X + W * 0.8); if (rich) at(portrait, X + W * 0.45); else at(clock, X + W * 0.45, 4); break;
      case 'church': {
        const cx = X + W / 2; cross(cx);
        for (const x of rich ? [X + W * 0.14, X + W * 0.3, X + W * 0.7, X + W * 0.86] : [X + W * 0.2, X + W * 0.8]) at(stained, x);
        break;
      }
      case 'bank': at((x) => frame(x, '#5a4a3a', 12), X + W * 0.28, 7); at(clock, X + W * 0.5, 4); at((x) => frame(x, '#3a5a4a', 12), X + W * 0.72, 7); if (rich) { at(portrait, X + W * 0.14); at(portrait, X + W * 0.86); } break;
      case 'county': at(portrait, X + W * 0.15); at((x) => map(x, 16), X + W * 0.38, 9); at(clock, X + W * 0.6, 4); at(portrait, X + W * 0.8); break;
      case 'station': at((x) => { g.fillStyle = '#1a1a1a'; g.fillRect(x - 13, Y + 2, 26, 9); g.fillStyle = '#d8d0c0'; for (let k = 0; k < 3; k++) g.fillRect(x - 11, Y + 4 + k * 2.4, 22 * (0.6 + h(k) * 0.4), 0.8); }, X + W * 0.68, 14); at(clock, X + W * 0.46, 4); at(poster, X + W * 0.24, 3); break;
      case 'land': at((x) => map(x, 22), X + W * 0.5, 12); at(diploma, X + W * 0.18); if (rich) at(portrait, X + W * 0.84); else at(win, X + W * 0.84); break;
      case 'barber': { for (const x of [X + 24, X + W - 24]) { g.fillStyle = gold; g.fillRect(x - 6, Y + 1, 12, 10); g.fillStyle = '#a8c0c8'; g.fillRect(x - 5, Y + 2, 10, 8); g.fillStyle = 'rgba(255,255,255,0.3)'; g.fillRect(x - 4, Y + 2.5, 1.5, 7); } g.fillStyle = '#e8e0d0'; g.fillRect(X + W / 2 - 1, Y + 1, 2, 10); g.fillStyle = '#c83030'; for (let k = 0; k < 4; k++) g.fillRect(X + W / 2 - 1, Y + 2 + k * 2.5, 2, 1); break; }
      case 'tailor': { for (let x = x0; x < X + W * 0.55; x += 5) { g.fillStyle = ['#6a2a4a', '#2a4a6a', '#8a6a2a', '#3a5a3a', '#7a3a2a'][Math.floor(h(x) * 5)]; g.fillRect(x, Y + 2, 4, 9); g.fillStyle = 'rgba(255,255,255,0.15)'; g.fillRect(x, Y + 2, 1, 9); } at((x) => mirror(x, 8), X + W * 0.68, 6); at(win, X + W - 16); break; }
      case 'stable': case 'barn': { for (let x = x0 + 4; x < x1; x += 14) { g.strokeStyle = '#6a6a6a'; g.lineWidth = 1; g.beginPath(); g.arc(x, Y + 6, 2.5, 0.3, Math.PI - 0.3, true); g.stroke(); } g.fillStyle = '#5a3a1a'; g.fillRect(X + W * 0.4, Y + 3, 10, 2); shoes(X + W * 0.62, X + W * 0.8); break; }
      case 'smith': tools(x0, X + W * 0.5); shoes(X + W * 0.56, x1); break;
      case 'lumber': tools(x0, X + W * 0.4); at(win, X + W * 0.55); at((x) => board(x, 12), X + W * 0.75, 8); break;
      case 'docks': at(wheel, X + W * 0.25, 6); at(ring, X + W * 0.42); at((x) => board(x, 12, '#3a3a3a'), X + W * 0.6, 8); at(win, X + W * 0.82); break;
      case 'ranch': at(antlers, X + W * 0.3, 7); at(win, X + W * 0.5); rifles(X + W * 0.68, X + W * 0.8); break;
      case 'bakery': at((x) => board(x, 14), X + W * 0.3, 8); pans(X + W * 0.52, X + W * 0.72); at(win, X + W * 0.86); break;
      case 'laundry': clothes(x0, X + W * 0.7); at(win, X + W * 0.84); break;
      case 'brewery': at((x) => board(x, 16, '#3a2a1a'), X + W * 0.4, 9); at(win, X + W * 0.62); at(win, X + W * 0.82); break;
      case 'mill': at(win, X + W * 0.3); tools(X + W * 0.45, X + W * 0.62); at(win, X + W * 0.78); break;
      case 'post': pigeon(x0, X + W * 0.42); at(clock, X + W * 0.55, 4); at((x) => board(x, 12, '#4a3a2a'), X + W * 0.76, 8); break;
      case 'warehouse': at((x) => board(x, 16, '#3a2a1a'), X + W * 0.3, 9); at(win, X + W * 0.55); tools(X + W * 0.68, X + W * 0.86); break;
      case 'mansion':
        // zemin kat: merdivenlerin arasında portreler, manzara ve pencere (şömine, saat ve kitaplığın önü boş); üst kat:
        // çalışma odasında pencere ve harita, banyoda ayna ve pencere
        if (b.floor === 1) { at(win, X + 40); at((x) => map(x, 12), X + 80, 7); at((x) => mirror(x, 8), X + 120, 6); at(win, X + 168); }
        else { at(portrait, X + 40); at((x) => frame(x, '#5a6a4a', 12), X + 96, 7); at(win, X + 144); at(portrait, X + 184); }
        break;
      case 'club': {
        // zemin kat: okuma odasında portre, salonda barın arkasında şişeler, şöminenin yanında av tablosu; üst kat: kart odasında
        // portre, tablo ve pencere
        if (b.floor === 1) { at(portrait, X + 40); at((x) => frame(x, '#2a3a2a', 14), X + 96, 8); at(win, X + 136); break; }
        const bs = barSpan();
        if (bs) bottles(bs[0] + 12, bs[1]);
        at(portrait, X + 56); at((x) => frame(x, '#3a4a3a', 12), X + 184, 7);
        break;
      }
      case 'hotel': {
        // otel eski pencere ve tablo çizimini korur
        const win0 = (x) => { g.fillStyle = '#3a2a1c'; g.fillRect(x - 5, Y + 2, 10, 9); g.fillStyle = '#8ab0c8'; g.fillRect(x - 4, Y + 3, 8, 7); g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(x - 4, Y + 3, 3, 7); g.fillStyle = '#3a2a1c'; g.fillRect(x - 0.5, Y + 3, 1, 7); };
        const frame0 = (x, col) => { g.fillStyle = '#8a6a30'; g.fillRect(x - 5, Y + 2, 10, 8); g.fillStyle = col; g.fillRect(x - 4, Y + 3, 8, 6); g.fillStyle = 'rgba(255,255,255,0.15)'; g.fillRect(x - 4, Y + 3, 8, 2); };
        if (isHotel2(b) && b.floor === 1) { win0(X + 56); win0(X + W - 56); frame0(X + 40, '#5a6a4a'); frame0(X + W - 40, '#6a4a5a'); break; }   // üst kat: arka odaların pencereleri, yatakların üstünde tablo
        // zemin kat: resepsiyonun arkasında, ortada anahtar panosu; iki yanda tablo
        const kc = isHotel2(b) ? X + W / 2 : X + 22;
        if (isHotel2(b)) { g.fillStyle = '#4a3020'; g.fillRect(kc - 14, Y + 2, 28, 10); g.fillStyle = '#6a4a2a'; g.fillRect(kc - 13, Y + 3, 26, 8); }
        for (let k = 0; k < 8; k++) { g.fillStyle = isHotel2(b) ? '#3a2416' : '#6a4a2a'; g.fillRect(kc - 12 + k * 3, Y + 4 + (k % 2) * 3, 2, 2); g.fillStyle = '#c8a040'; g.fillRect(kc - 11.5 + k * 3, Y + 6 + (k % 2) * 3, 1, 1.5); }
        if (isHotel2(b)) { frame0(X + 40, '#6a5a3a'); frame0(X + W - 40, '#5a6a4a'); } else { frame0(X + W * 0.5, '#6a5a3a'); win0(X + W * 0.8); }
        break;
      }
      case 'house': case 'property': case 'hs_shack': case 'hs_cabin': case 'hs_house': default:
        at(win, X + W * 0.3);
        if (b.w >= 7) at((x) => frame(x, ['#5a6a4a', '#6a5a4a', '#4a5a6a'][Math.floor(h(5) * 3)]), X + W * 0.7);
        if (rich) { at((x) => mirror(x, 8), X + W * 0.52, 6); at(portrait, X + W * 0.84); }
        else if (b.w >= 8) at(clock, X + W * 0.52, 4);
        break;
    }
    // aplikler: zengin binalarda (ve saloonlarda) süslerin arasındaki boşluklara duvar lambası
    const n = IntDeco.sconces(b), sc = [];
    for (let k = 0; k < n; k++) {
      const want = X + W * (k + 1) / (n + 1), span = W / (n + 1) / 2;
      for (let d = 0; d <= span; d += 2) { const x = [want + d, want - d].find(q => free(q, 3) && !busy(q - 4, q + 4)); if (x !== undefined) { use(x - 4, x + 4); sc.push(Math.round(x)); sconce(Math.round(x)); break; } }
    }
    b._sc = sc;
  },
  furn(g, o, cx, cy, world, i, b, h) {
    const same = (d) => world.obj[i + d] === o;
    const t = b.type, rich = richB(b) && t !== 'hotel';   // zengin şehir ya da lüks kademe (otel kendi eşyasını korur)
    switch (o) {
      case O.COUNTER: case O.BAR: case O.TICKET: {
        // zengin şehirde: mermer tezgâh üstü ve maun ön yüz (bar koyu maun, pirinç ayaklık)
        const top = o === O.BAR ? (rich ? '#3a1a0e' : '#4a2a18') : o === O.TICKET ? '#6a5236' : rich ? '#d8d2c8' : t === 'bank' ? '#5a3a22' : '#9a7048';
        const fr = rich && o !== O.TICKET ? (o === O.BAR ? '#2e140a' : '#4a2416') : shadeHex(top, -0.3);
        g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(cx - 8, cy + 5, 16, 3);
        g.fillStyle = fr; g.fillRect(cx - 8, cy + 1, 16, 6);
        if (rich && o !== O.TICKET) { g.fillStyle = shadeHex(fr, 0.18); g.fillRect(cx - 6, cy + 2.5, 5, 3); g.fillRect(cx + 1, cy + 2.5, 5, 3); g.fillStyle = shadeHex(fr, -0.3); g.fillRect(cx - 6, cy + 5, 5, 0.6); g.fillRect(cx + 1, cy + 5, 5, 0.6); }
        g.fillStyle = top; g.fillRect(cx - 8, cy - 5, 16, 7);
        if (rich && o === O.COUNTER) { g.fillStyle = 'rgba(120,110,100,0.35)'; g.fillRect(cx - 7 + h * 6, cy - 3.5, 5, 0.5); g.fillRect(cx - 2 + h * 4, cy - 1.5, 4, 0.5); }
        g.fillStyle = shadeHex(top, 0.2); g.fillRect(cx - 8, cy - 5, 16, 1);
        const edge = rich && o !== O.TICKET ? shadeHex(fr, -0.3) : shadeHex(top, -0.45);
        if (!same(-1)) { g.fillStyle = edge; g.fillRect(cx - 8, cy - 5, 1.5, 12); }
        if (!same(1)) { g.fillStyle = edge; g.fillRect(cx + 6.5, cy - 5, 1.5, 12); }
        if (o === O.BAR) { g.fillStyle = '#c8a040'; g.fillRect(cx - 8, cy + 5, 16, 1); if (h < 0.5) { g.fillStyle = 'rgba(220,230,240,0.8)'; g.fillRect(cx - 3 + h * 6, cy - 3, 2, 3); } if (h > 0.6) { g.fillStyle = '#5a2a14'; g.fillRect(cx + 2, cy - 5, 2, 4); } }
        else if (t === 'bank' || o === O.TICKET) { g.fillStyle = rich ? '#d8b850' : '#c8b060'; for (let x = cx - 7; x < cx + 8; x += 3) g.fillRect(x, cy - 12, 0.8, 8); g.fillRect(cx - 8, cy - 12, 16, 1); }
        else if (h < 0.25) { g.fillStyle = '#c8b890'; g.fillRect(cx - 3, cy - 4, 5, 4); g.fillStyle = '#e0d0a0'; g.fillRect(cx - 2, cy - 5, 3, 1); }
        else if (h < 0.45) { g.fillStyle = '#8a8a8a'; g.fillRect(cx - 4, cy - 3, 6, 1); g.fillRect(cx - 1.5, cy - 5, 1, 3); g.fillStyle = '#c8a040'; g.fillRect(cx - 5, cy - 4, 2, 1); g.fillRect(cx + 1, cy - 4, 2, 1); }
        else if (h < 0.6) { g.fillStyle = 'rgba(200,220,230,0.8)'; g.fillRect(cx + 1, cy - 5, 4, 4); g.fillStyle = '#c84030'; g.fillRect(cx + 2, cy - 3, 2, 2); }
        break;
      }
      case O.TABLE: case O.CARDTABLE: {
        // iki yandaki sandalye: yan karo odanın içinde, boş ve kapı yolunda değilse (zenginde döşemeli)
        const lx = (i % WW) - b.x, ly = Math.floor(i / WW) - b.y;
        const room = (x) => x >= 1 && x <= b.w - 2 && !world.obj[i + x - lx] && !(x === b.w >> 1 && ly >= b.h - 3);
        const chair = (x) => { g.fillStyle = '#4a2e1a'; g.fillRect(x - 2.5, cy - 2, 5, 5); g.fillStyle = rich ? '#7a2430' : '#6a4428'; g.fillRect(x - 2.5, cy - 2, 5, rich ? 2.5 : 1); };
        if (room(lx - 1)) chair(cx - 11);
        if (room(lx + 1)) chair(cx + 11);
        this.ell(g, cx + 1, cy + 3, 7, 3, 'rgba(0,0,0,0.25)');
        if (o === O.CARDTABLE) {
          this.circ(g, cx, cy, 7, rich ? '#c8a040' : '#4a2e1a'); this.circ(g, cx, cy, 6, rich ? '#1e5a34' : '#2e6a3a');
          g.fillStyle = '#f0ece0'; g.fillRect(cx - 3, cy - 2, 2, 3); g.fillRect(cx + 1, cy - 1, 2, 3); g.fillRect(cx - 1, cy + 2, 2, 2);
          g.fillStyle = '#c83030'; g.fillRect(cx + 3, cy - 3, 1.5, 1.5); g.fillStyle = '#3050c0'; g.fillRect(cx - 4.5, cy + 1, 1.5, 1.5);
        } else if (rich) {
          // beyaz örtülü masa, ortada vazo ve mum
          this.circ(g, cx, cy, 6.6, '#d8d2c4'); this.circ(g, cx, cy - 0.5, 6, '#f4f0e8');
          g.fillStyle = 'rgba(200,190,170,0.6)'; for (let k = 0; k < 12; k++) { const a = k / 12 * TAU; g.fillRect(cx + Math.cos(a) * 6.2 - 0.4, cy + Math.sin(a) * 6.2 - 0.4, 0.8, 0.8); }
          this.circ(g, cx - 1.5, cy - 1, 1.3, '#4a6a8a'); this.circ(g, cx - 1.5, cy - 2.2, 1.2, '#c83a4a'); this.circ(g, cx - 0.6, cy - 2.6, 0.8, '#e8a0b0');
          g.fillStyle = '#f4ecd8'; g.fillRect(cx + 1.6, cy - 3.5, 1, 2.6); g.fillStyle = '#ffc860'; g.fillRect(cx + 1.6, cy - 4.3, 1, 0.8);
        } else {
          this.circ(g, cx, cy, 6, '#4a2e1a'); this.circ(g, cx, cy - 0.5, 5.2, '#6e4a2c');
          g.fillStyle = 'rgba(255,230,190,0.15)'; g.fillRect(cx - 3, cy - 4, 5, 1);
          if (h < 0.6) { g.fillStyle = '#d8c070'; g.fillRect(cx - 2, cy - 2, 2, 2.5); g.fillStyle = '#f0ece0'; g.fillRect(cx - 2, cy - 2.5, 2, 0.8); }
          if (h > 0.4) { g.fillStyle = '#4a2a14'; g.fillRect(cx + 1.5, cy - 3, 1.5, 3.5); }
        }
        break;
      }
      case O.PIANO: {
        g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(cx - 8, cy + 5, 16, 2);
        g.fillStyle = '#2a1a12'; g.fillRect(cx - 8, cy - 7, 16, 12); g.fillStyle = '#3e2a1c'; g.fillRect(cx - 7, cy - 6, 14, 3);
        g.fillStyle = '#f0ece0'; g.fillRect(cx - 7, cy + 1, 14, 3); g.fillStyle = '#1a1a1a'; for (let x = cx - 6; x < cx + 7; x += 2) g.fillRect(x, cy + 1, 1, 1.8);
        g.fillStyle = '#e8d070'; g.fillRect(cx + 4, cy - 9, 1.5, 3);
        break;
      }
      case O.BED: {
        const bl = rich ? ['#7a2430', '#2e4a6a', '#5a3a6a'][Math.floor(h * 3)] : ['#8a2a2a', '#2a4a6a', '#6a5a2a', '#4a6a3a'][Math.floor(h * 4)];
        g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(cx - 5, cy - 5, 13, 23);
        g.fillStyle = '#5a3a22'; g.fillRect(cx - 7, cy - 7, 13, 23);
        g.fillStyle = '#e8e4d8'; g.fillRect(cx - 6, cy - 6, 11, 21);
        g.fillStyle = '#f8f4ec'; g.fillRect(cx - 5, cy - 5, 9, 4);
        g.fillStyle = bl; g.fillRect(cx - 6, cy + 1, 11, 14); g.fillStyle = shadeHex(bl, 0.2); g.fillRect(cx - 6, cy + 1, 11, 1.5);
        g.fillStyle = '#3a2416'; g.fillRect(cx - 7, cy - 8, 13, 2);
        if (rich) { g.fillStyle = '#c8a040'; g.fillRect(cx - 7, cy - 9, 13, 1); g.fillRect(cx - 7, cy - 9, 1, 3); g.fillRect(cx + 5, cy - 9, 1, 3); for (let x = cx - 5; x < cx + 5; x += 2.5) g.fillRect(x, cy - 8.5, 0.6, 2); g.fillStyle = shadeHex(bl, -0.2); for (let x = cx - 5; x < cx + 5; x += 2.5) g.fillRect(x, cy + 3, 1, 1); }
        break;
      }
      case O.STOVE: {
        this.ell(g, cx + 1, cy + 5, 6, 2, 'rgba(0,0,0,0.3)');
        g.fillStyle = '#3a3a3a'; g.fillRect(cx - 1.5, cy - 14, 3, 10);
        g.fillStyle = '#222226'; g.fillRect(cx - 5, cy - 5, 10, 10); g.fillStyle = '#3a3a40'; g.fillRect(cx - 5, cy - 5, 10, 2);
        g.fillStyle = '#e87020'; g.fillRect(cx - 3, cy + 1, 6, 2); g.fillStyle = '#ffc060'; g.fillRect(cx - 1, cy + 1, 2, 1);
        if (rich) { g.fillStyle = '#c8ccd0'; g.fillRect(cx - 5, cy - 5, 10, 0.6); g.fillRect(cx - 5.5, cy + 4, 11, 1); g.fillRect(cx - 1.5, cy - 9, 3, 0.6); }   // nikel süsler
        g.fillStyle = '#5a3a2a'; g.fillRect(cx + 2, cy - 7, 2.4, 2); g.fillStyle = '#3a2416'; g.fillRect(cx + 4.2, cy - 6.6, 1, 0.6);   // cezve
        break;
      }
      case O.DESK: {
        g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(cx - 7, cy + 4, 29, 3);
        g.fillStyle = rich ? '#3a1c10' : '#4a2e1a'; g.fillRect(cx - 7, cy - 1, 29, 6);
        g.fillStyle = rich ? '#5a2e1a' : '#6e4a2c'; g.fillRect(cx - 7, cy - 6, 29, 7); g.fillStyle = 'rgba(255,230,190,0.15)'; g.fillRect(cx - 7, cy - 6, 29, 1);
        if (rich) { g.fillStyle = '#2e5a3a'; g.fillRect(cx - 5, cy - 5, 25, 5); g.fillStyle = '#c8a040'; g.fillRect(cx - 5, cy - 5, 25, 0.4); g.fillRect(cx - 5, cy - 0.4, 25, 0.4); g.fillStyle = shadeHex('#3a1c10', 0.15); g.fillRect(cx - 4, cy + 1, 7, 2.5); g.fillRect(cx + 12, cy + 1, 7, 2.5); }
        g.fillStyle = '#f0e8d0'; g.fillRect(cx - 3, cy - 5, 6, 4); g.fillRect(cx + 4, cy - 4, 4, 3);
        g.fillStyle = '#1a1a1a'; g.fillRect(cx + 10, cy - 4, 2, 2);
        g.fillStyle = '#e8d070'; this.circ(g, cx + 16, cy - 3, 1.8, '#e8d070'); g.fillStyle = '#6a6a6a'; g.fillRect(cx + 15.5, cy - 2, 1, 2);
        break;
      }
      case O.CELL: {
        const hz = same(-1) || same(1), vt = same(-WW) || same(WW);
        g.fillStyle = '#2e2e34';
        if (hz || !vt) { g.fillRect(cx - 8, cy - 10, 16, 1.5); g.fillRect(cx - 8, cy + 4, 16, 1.5); for (let x = cx - 7; x < cx + 8; x += 3) g.fillRect(x, cy - 10, 1, 15); }
        if (vt) { g.fillRect(cx - 1, cy - 8, 2, 16); for (let y = cy - 7; y < cy + 8; y += 3) g.fillRect(cx - 2, y, 4, 1); }
        break;
      }
      case O.PEW: {
        g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(cx - 8, cy + 3, 16, 2);
        g.fillStyle = rich ? '#3e2214' : '#5a3a22'; g.fillRect(cx - 8, cy - 5, 16, 3);
        g.fillStyle = rich ? '#5a3420' : '#7a5434'; g.fillRect(cx - 8, cy - 2, 16, 5);
        if (rich) { g.fillStyle = '#7a1a24'; g.fillRect(cx - 8, cy - 1.5, 16, 2.5); g.fillStyle = '#9a2a34'; g.fillRect(cx - 8, cy - 1.5, 16, 0.6); }
        if (!same(-1)) { g.fillStyle = '#3a2416'; g.fillRect(cx - 8, cy - 5, 1.5, 8); }
        if (!same(1)) { g.fillStyle = '#3a2416'; g.fillRect(cx + 6.5, cy - 5, 1.5, 8); }
        break;
      }
      case O.ALTAR: {
        g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(cx - 6, cy + 5, 28, 2);
        g.fillStyle = '#6a4a2c'; g.fillRect(cx - 6, cy - 4, 28, 9); g.fillStyle = '#f0ece0'; g.fillRect(cx - 6, cy - 5, 28, 6);
        g.fillStyle = '#c8a040'; g.fillRect(cx - 6, cy, 28, 1); g.fillRect(cx + 7, cy - 4, 1, 4); g.fillRect(cx + 5.5, cy - 3, 4, 1);
        g.fillStyle = '#f8f0d8'; g.fillRect(cx - 3, cy - 8, 1.5, 4); g.fillRect(cx + 17, cy - 8, 1.5, 4); g.fillStyle = '#ffc060'; g.fillRect(cx - 3, cy - 9, 1.5, 1); g.fillRect(cx + 17, cy - 9, 1.5, 1);
        break;
      }
      case O.SAFE: {
        g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(cx - 5, cy + 5, 13, 2);
        g.fillStyle = '#2e3238'; g.fillRect(cx - 6, cy - 7, 12, 13); g.fillStyle = '#44484e'; g.fillRect(cx - 5, cy - 6, 10, 11);
        this.circ(g, cx, cy - 1, 2.5, '#c8b060'); this.circ(g, cx, cy - 1, 1, '#2e3238'); g.fillStyle = '#c8b060'; g.fillRect(cx + 3, cy - 2, 1.5, 3);
        break;
      }
      case O.TUB: {
        this.ell(g, cx + 1, cy + 3, 8, 4, 'rgba(0,0,0,0.25)');
        this.ell(g, cx, cy + 1, 7.5, 5, '#9aa0a6'); this.ell(g, cx, cy + 0.5, 6, 3.6, '#7aa8c0'); g.fillStyle = 'rgba(255,255,255,0.4)'; g.fillRect(cx - 3, cy - 1, 3, 1);
        break;
      }
      case O.BCHAIR: {
        this.ell(g, cx, cy + 4, 5, 2, 'rgba(0,0,0,0.3)');
        g.fillStyle = '#c0c4c8'; g.fillRect(cx - 1, cy + 1, 2, 4);
        g.fillStyle = '#6a1818'; g.fillRect(cx - 4.5, cy - 7, 9, 4); g.fillStyle = '#8a2020'; g.fillRect(cx - 4.5, cy - 3, 9, 6);
        g.fillStyle = '#c0c4c8'; g.fillRect(cx - 5.5, cy - 3, 1, 5); g.fillRect(cx + 4.5, cy - 3, 1, 5);
        break;
      }
      case O.RACK: {
        g.fillStyle = '#4a2e1a'; g.fillRect(cx - 7, cy - 8, 14, 2); g.fillRect(cx - 7, cy + 3, 14, 2);
        for (let x = cx - 5; x < cx + 6; x += 3.5) { g.fillStyle = '#2a2a2e'; g.fillRect(x, cy - 9, 1.2, 10); g.fillStyle = '#6a4428'; g.fillRect(x - 0.4, cy, 2, 5); }
        break;
      }
      case O.WORKBENCH: {
        g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(cx - 8, cy + 4, 16, 3);
        g.fillStyle = '#5a3a22'; g.fillRect(cx - 8, cy, 16, 5); g.fillStyle = '#8a6440'; g.fillRect(cx - 8, cy - 5, 16, 6);
        g.fillStyle = '#9a9ea4'; g.fillRect(cx - 5, cy - 3, 6, 1.5); g.fillStyle = '#6a4428'; g.fillRect(cx + 2, cy - 4, 1.5, 4); g.fillStyle = '#5a5a5a'; g.fillRect(cx + 1, cy - 4.5, 3.5, 1.5);
        if (b.type === 'butcher') { this.ell(g, cx - 1, cy - 2, 3, 2, '#a8382a'); }
        break;
      }
      case O.STALL: {
        this.ell(g, cx, cy + 2, 7, 5, 'rgba(200,168,96,0.5)');
        g.fillStyle = '#5a3a1e'; g.fillRect(cx - 1.5, cy - 8, 3, 16); g.fillStyle = '#7a5430'; g.fillRect(cx - 1.5, cy - 8, 1, 16);
        g.fillStyle = '#4a2e18'; g.fillRect(cx - 2.5, cy - 9, 5, 2);
        break;
      }
      case O.SHELF: {
        g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(cx - 6, cy + 5, 14, 2);
        g.fillStyle = rich ? '#3a2014' : '#4a2e1a'; g.fillRect(cx - 7, cy - 7, 14, 13);
        if (rich) { g.fillStyle = '#c8a040'; g.fillRect(cx - 7, cy - 7.5, 14, 0.6); }
        const cols = ['#c8402c', '#e0c060', '#4a7aa8', '#6a9a4a', '#d8d0c0', '#8a5a2a'];
        for (let r = 0; r < 3; r++) { g.fillStyle = '#6a4428'; g.fillRect(cx - 6, cy - 6 + r * 4 + 3, 12, 1); for (let k = 0; k < 4; k++) { g.fillStyle = cols[Math.floor(hash2(i, r * 4 + k, 5) * cols.length)]; g.fillRect(cx - 5.5 + k * 3, cy - 6 + r * 4, 2, 3); } }
        break;
      }
      case O.CHAIR: { g.fillStyle = '#4a2e1a'; g.fillRect(cx - 3, cy - 5, 6, 2); g.fillStyle = '#6a4428'; g.fillRect(cx - 3, cy - 3, 6, 6); break; }
      case O.PLANT: {
        if (rich) { g.fillStyle = '#e8e4dc'; g.fillRect(cx - 3.2, cy + 1, 6.4, 5); g.fillStyle = '#3a5a9a'; g.fillRect(cx - 3.2, cy + 2.6, 6.4, 1); g.fillRect(cx - 1, cy + 4, 2, 1); g.fillStyle = '#d8d4cc'; g.fillRect(cx - 3.6, cy + 1, 7.2, 1.2); }
        else { g.fillStyle = '#8a4a2a'; g.fillRect(cx - 3, cy + 1, 6, 5); g.fillStyle = '#6a3a1e'; g.fillRect(cx - 3.5, cy + 1, 7, 1.5); }
        for (let k = 0; k < 6; k++) { const a = k / 6 * TAU + h; this.ell(g, cx + Math.cos(a) * 3, cy - 2 + Math.sin(a) * 2.5, 2.4, 1.2, k % 2 ? '#4a7a3a' : '#5a8a44', a); }
        break;
      }
      case O.HOMECHEST: {
        g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(cx - 5, cy + 4, 12, 2);
        g.fillStyle = '#6a4428'; g.fillRect(cx - 6, cy - 4, 12, 9); g.fillStyle = '#8a5a34'; g.fillRect(cx - 6, cy - 4, 12, 3);
        g.fillStyle = '#3a2a18'; g.fillRect(cx - 4, cy - 4, 1.5, 9); g.fillRect(cx + 2.5, cy - 4, 1.5, 9); g.fillStyle = '#c8a040'; g.fillRect(cx - 1, cy - 1, 2, 2);
        break;
      }
      case O.MANNEQUIN: {
        g.fillStyle = '#5a3a22'; g.fillRect(cx - 0.5, cy, 1, 6); g.fillRect(cx - 3, cy + 5, 6, 1);
        const c = ['#6a2a4a', '#2a4a6a', '#8a6a2a', '#3a5a3a'][Math.floor(h * 4)];
        this.ell(g, cx, cy - 2, 4, 3.5, c); this.ell(g, cx, cy - 6, 2.2, 1.5, '#d8c8a8');
        break;
      }
      /* ---- iç mekânı zenginleştiren eşyalar ---- */
      case O.ARMCHAIR: {
        // koltuk: arkalığı duvara (kuzeye), oturağı güneye bakar; zenginde kadife ve pirinç çiviler
        const fab = rich ? ['#7a2430', '#2e5a44', '#5a3a6a'][Math.floor(h * 3)] : ['#6a4428', '#5a3a2a', '#7a5a3a'][Math.floor(h * 3)];
        const dk = shadeHex(fab, -0.38), lt = shadeHex(fab, 0.2);
        this.ell(g, cx + 1, cy + 6.5, 7, 2, 'rgba(0,0,0,0.3)');
        g.fillStyle = dk; g.fillRect(cx - 6, cy - 8.5, 12, 6.5);
        g.fillStyle = fab; g.fillRect(cx - 5, cy - 8, 10, 5);
        g.fillStyle = lt; g.fillRect(cx - 5, cy - 8, 10, 1);
        g.fillStyle = fab; g.fillRect(cx - 5, cy - 3, 10, 6);
        g.fillStyle = lt; g.fillRect(cx - 5, cy - 3, 10, 0.8);
        g.fillStyle = dk; g.fillRect(cx - 7, cy - 5, 2.5, 9); g.fillRect(cx + 4.5, cy - 5, 2.5, 9);
        g.fillStyle = lt; g.fillRect(cx - 7, cy - 5, 2.5, 1); g.fillRect(cx + 4.5, cy - 5, 2.5, 1);
        g.fillStyle = shadeHex(fab, -0.5); g.fillRect(cx - 6, cy + 3, 12, 2);
        g.fillStyle = '#2a1a10'; g.fillRect(cx - 6, cy + 5, 1.5, 1.5); g.fillRect(cx + 4.5, cy + 5, 1.5, 1.5);
        if (rich) { g.fillStyle = '#d8b050'; for (let x = cx - 4.5; x < cx + 5; x += 2) g.fillRect(x, cy - 8.4, 0.6, 0.6); g.fillStyle = shadeHex(fab, -0.25); for (const [x, y] of [[-2.5, -6], [0, -5], [2.5, -6]]) g.fillRect(cx + x, cy + y, 0.8, 0.8); }
        break;
      }
      case O.BOOKCASE: {
        const wd = rich ? '#3a2014' : '#4a2e1a';
        g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(cx - 6, cy + 5, 14, 2.5);
        g.fillStyle = wd; g.fillRect(cx - 7, cy - 14, 14, 20);
        g.fillStyle = shadeHex(wd, 0.18); g.fillRect(cx - 7.5, cy - 15.5, 15, 1.8);
        const cols = ['#7a2a22', '#2a4a3a', '#5a3a1e', '#2a3a5a', '#8a6a2a', '#4a2a3a', '#6a5a3a'];
        for (let r = 0; r < 4; r++) {
          const y0 = cy - 13 + r * 4.4;
          g.fillStyle = shadeHex(wd, -0.4); g.fillRect(cx - 6, y0, 12, 3.8);
          let x = cx - 6;
          while (x < cx + 5.6) {
            const k = hash2(i, r * 31 + Math.round(x * 3), 7), bw = k < 0.3 ? 1.6 : 1.1, bh = 2.5 + k * 1.2;
            if (k > 0.92) { x += 1.3; continue; }
            g.fillStyle = cols[Math.floor(k * 997) % cols.length]; g.fillRect(x, y0 + 3.8 - bh, bw, bh);
            if (rich || k > 0.6) { g.fillStyle = '#d8b860'; g.fillRect(x, y0 + 4.4 - bh, bw, 0.4); }
            x += bw + 0.2;
          }
          g.fillStyle = shadeHex(wd, 0.12); g.fillRect(cx - 6.5, y0 + 3.8, 13, 0.7);
        }
        g.fillStyle = shadeHex(wd, -0.2); g.fillRect(cx - 7, cy + 4.6, 14, 1.6);
        break;
      }
      case O.GCLOCK: {
        // ayaklı saat: tepede kadran, gövdede camın ardında sarkaç
        const wd = rich ? '#4a2414' : '#5a3a22', lt = shadeHex(wd, 0.22);
        g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(cx - 3, cy + 5, 8, 2);
        g.fillStyle = wd; g.fillRect(cx - 4, cy - 15, 8, 7.5);
        g.fillStyle = lt; g.fillRect(cx - 4.5, cy - 15.5, 9, 1.2);
        this.circ(g, cx, cy - 11, 2.8, rich ? '#d8b050' : '#a88a40'); this.circ(g, cx, cy - 11, 2.2, '#f0ead8');
        g.fillStyle = '#1a1a1a'; g.fillRect(cx - 0.3, cy - 12.6, 0.6, 1.7); g.fillRect(cx, cy - 11.2, 1.3, 0.5);
        g.fillStyle = wd; g.fillRect(cx - 3, cy - 7.5, 6, 10);
        g.fillStyle = '#2a1a10'; g.fillRect(cx - 2, cy - 6.5, 4, 7.5);
        g.fillStyle = '#c8a040'; g.fillRect(cx - 0.3, cy - 6.3, 0.6, 5); this.circ(g, cx, cy - 1, 1.2, '#d8b050');
        g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(cx - 2, cy - 6.5, 0.8, 7.5);
        g.fillStyle = wd; g.fillRect(cx - 3.8, cy + 2.5, 7.6, 3.5);
        g.fillStyle = lt; g.fillRect(cx - 3.8, cy + 2.5, 7.6, 0.7);
        break;
      }
      case O.FIREPLACE: {
        // şömine: taş (zenginde mermer) gövde, pervaz rafında mumlar, kemerli ağızda ateş
        const st = rich ? '#d8d0c4' : '#7a6a5a', dk = shadeHex(st, -0.35), lt = shadeHex(st, 0.18), mant = rich ? '#4a2a18' : '#5a3a22';
        g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(cx - 8, cy + 5.5, 16, 2);
        g.fillStyle = rich ? '#8a8078' : '#5a5048'; g.fillRect(cx - 8, cy + 3, 16, 3);
        g.fillStyle = st; g.fillRect(cx - 8, cy - 12, 16, 15.5);
        if (!rich) { g.fillStyle = dk; for (let y = cy - 9, r = 0; y < cy + 3; y += 3, r++) { g.fillRect(cx - 8, y, 16, 0.5); for (let x = cx - 8 + (r % 2 ? 2 : 0); x < cx + 8; x += 4) g.fillRect(x, y - 3, 0.5, 3); } }
        else { g.fillStyle = 'rgba(120,110,100,0.35)'; g.fillRect(cx - 6, cy - 9, 5, 0.5); g.fillRect(cx + 2, cy - 7, 4, 0.5); g.fillRect(cx - 7, cy - 4, 2, 0.5); }
        g.fillStyle = mant; g.fillRect(cx - 9, cy - 12.5, 18, 2);
        g.fillStyle = shadeHex(mant, 0.25); g.fillRect(cx - 9, cy - 12.5, 18, 0.6);
        g.fillStyle = '#f0e8d0'; g.fillRect(cx - 6.5, cy - 15, 1, 2.5); g.fillRect(cx + 5.5, cy - 15, 1, 2.5);
        g.fillStyle = '#ffc860'; g.fillRect(cx - 6.5, cy - 15.8, 1, 0.8); g.fillRect(cx + 5.5, cy - 15.8, 1, 0.8);
        if (rich) { this.circ(g, cx, cy - 14, 1.6, '#d8b050'); this.circ(g, cx, cy - 14, 1, '#f0ead8'); }
        else { g.fillStyle = '#8a7a6a'; g.fillRect(cx - 1.5, cy - 15, 3, 2.5); g.fillStyle = '#a89a8a'; g.fillRect(cx - 1.5, cy - 15, 3, 0.6); }
        g.fillStyle = '#1a120c'; g.fillRect(cx - 5, cy - 7, 10, 10); this.ell(g, cx, cy - 7, 5, 2.2, '#1a120c');
        g.fillStyle = '#3a2a1e'; g.fillRect(cx - 4, cy + 1.5, 8, 1.5);
        this.ell(g, cx, cy, 3.6, 2.6, '#c84a14'); this.ell(g, cx, cy - 0.8, 2.6, 2.4, '#f08a24'); this.ell(g, cx, cy - 1.2, 1.4, 1.8, '#ffd870');
        if (rich) { g.fillStyle = '#c8a040'; g.fillRect(cx - 6, cy + 2.8, 12, 0.8); for (let x = cx - 5; x <= cx + 5; x += 2) g.fillRect(x, cy + 1.2, 0.5, 1.6); }
        g.fillStyle = lt; g.fillRect(cx - 8, cy - 10.5, 1, 13.5); g.fillStyle = dk; g.fillRect(cx + 7, cy - 10.5, 1, 13.5);
        break;
      }
      case O.CABINET: {
        // camlı dolap: içindekiler bina türüne göre (şişe, kumaş, silah, kavanoz)
        const wd = rich ? '#3a2014' : '#5a3a22';
        g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(cx - 6, cy + 5, 14, 2.5);
        g.fillStyle = wd; g.fillRect(cx - 7, cy - 13.5, 14, 19.5);
        g.fillStyle = shadeHex(wd, 0.2); g.fillRect(cx - 7.5, cy - 15, 15, 1.6);
        g.fillStyle = '#8aa0a6'; g.fillRect(cx - 6, cy - 12.5, 5.5, 13); g.fillRect(cx + 0.5, cy - 12.5, 5.5, 13);
        const kind = t === 'pharmacy' || t === 'doctor' ? 'b' : t === 'tailor' ? 'f' : t === 'gunsmith' ? 'g' : 'j';
        for (let r = 0; r < 3; r++) {
          const y0 = cy - 12.5 + r * 4.4;
          g.fillStyle = shadeHex(wd, 0.1); g.fillRect(cx - 6, y0 + 3.8, 12, 0.6);
          for (let k = 0; k < 4; k++) {
            const x = cx - 5.5 + k * 3 + (k > 1 ? 0.5 : 0), q = hash2(i, r * 4 + k, 3);
            if (kind === 'b') { g.fillStyle = ['#8a3a2a', '#3a6a5a', '#a88a3a', '#4a4a8a'][Math.floor(q * 4)]; g.fillRect(x, y0 + 1.2, 1.6, 2.6); g.fillRect(x + 0.4, y0 + 0.4, 0.8, 0.8); }
            else if (kind === 'f') { g.fillStyle = ['#6a2a4a', '#2a4a6a', '#8a6a2a', '#e8e0d0'][Math.floor(q * 4)]; g.fillRect(x - 0.3, y0 + 2, 2.4, 1.8); }
            else if (kind === 'g') { g.fillStyle = '#2a2a2e'; g.fillRect(x - 0.5, y0 + 2.2, 2.6, 0.8); g.fillStyle = '#6a4428'; g.fillRect(x + 1.2, y0 + 2.2, 0.9, 1.6); }
            else { g.fillStyle = ['#e8e0d0', '#c8a060', '#d8c8e0', '#a8c8b0'][Math.floor(q * 4)]; g.fillRect(x, y0 + 1.6, 1.8, 2.2); g.fillStyle = rich ? '#c8a040' : '#8a7a6a'; g.fillRect(x, y0 + 1.3, 1.8, 0.5); }
          }
        }
        g.fillStyle = 'rgba(255,255,255,0.3)'; g.fillRect(cx - 5.6, cy - 12.2, 0.9, 12.4); g.fillRect(cx + 0.9, cy - 12.2, 0.9, 12.4);
        g.fillStyle = wd; g.fillRect(cx - 0.5, cy - 13, 1, 14);
        g.fillStyle = shadeHex(wd, -0.2); g.fillRect(cx - 7, cy + 1.5, 14, 4.5);
        g.fillStyle = rich ? '#d8b050' : '#a88a50'; g.fillRect(cx - 1.8, cy + 3, 1, 1); g.fillRect(cx + 0.8, cy + 3, 1, 1);
        break;
      }
      case O.SACKS: {
        this.ell(g, cx + 1, cy + 5, 7.5, 2.4, 'rgba(0,0,0,0.28)');
        const c = t === 'mill' || t === 'bakery' ? '#d8ccb0' : t === 'post' ? '#8a8a70' : '#b89a6a';
        const sack = (x, y, sc) => {
          this.ell(g, x, y + 1, 3.6 * sc, 4 * sc, shadeHex(c, -0.25)); this.ell(g, x - 0.4, y + 0.4, 3.2 * sc, 3.6 * sc, c);
          g.fillStyle = shadeHex(c, -0.35); g.fillRect(x - 1.2 * sc, y - 4 * sc, 2.4 * sc, 1.4 * sc);
          g.fillStyle = '#8a6a3a'; g.fillRect(x - 1.4 * sc, y - 2.8 * sc, 2.8 * sc, 0.6);
          g.fillStyle = 'rgba(90,60,30,0.45)'; g.fillRect(x - 1.6 * sc, y + 0.5, 3.2 * sc, 0.6); g.fillRect(x - 0.3, y - 0.6, 0.6, 2.4);
        };
        sack(cx - 3.5, cy + 1, 1); sack(cx + 3.5, cy + 1.5, 1); sack(cx, cy - 3, 0.95);
        break;
      }
      case O.COATRACK: {
        this.ell(g, cx, cy + 5, 4, 1.6, 'rgba(0,0,0,0.3)');
        g.fillStyle = '#3a2416'; g.fillRect(cx - 3.5, cy + 4, 7, 1); g.fillRect(cx - 0.6, cy - 13, 1.2, 17.5); g.fillRect(cx - 3, cy - 12, 6, 0.8);
        g.fillStyle = '#5a3a22'; g.fillRect(cx - 0.2, cy - 13, 0.4, 17);
        const c = ['#3a3a40', '#5a3a2a', '#2a3a4a'][Math.floor(h * 3)];
        g.fillStyle = c; g.beginPath(); g.moveTo(cx - 2.5, cy - 11.5); g.lineTo(cx - 4.5, cy - 2); g.lineTo(cx - 0.8, cy - 2); g.lineTo(cx - 0.8, cy - 11.5); g.fill();
        g.fillStyle = shadeHex(c, 0.15); g.fillRect(cx - 2.5, cy - 11.5, 1.6, 1);
        this.ell(g, cx + 1.5, cy - 13.5, 3.2, 1.2, '#4a3220'); g.fillStyle = '#5a3e28'; g.fillRect(cx + 0.2, cy - 15.6, 2.6, 2.2); g.fillStyle = '#2a1a10'; g.fillRect(cx + 0.2, cy - 14, 2.6, 0.5);
        break;
      }
      case O.BILLIARD: case O.ROULETTE: {
        // iki karoluk oyun masası (sağdaki karo IBLOCK)
        const x0 = cx - 7, x1 = cx + 23, y0 = cy - 6, y1 = cy + 5, wd = o === O.ROULETTE ? '#5a3a22' : rich ? '#4a2010' : '#5a3a22';
        g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(x0 + 1, y1 + 1, x1 - x0, 2.5);
        g.fillStyle = shadeHex(wd, -0.3); g.fillRect(x0, y1 - 1, x1 - x0, 3.5);
        g.fillStyle = '#2a1a10'; g.fillRect(x0 + 1, y1 + 2.5, 2, 1.5); g.fillRect(x1 - 3, y1 + 2.5, 2, 1.5); g.fillRect((x0 + x1) / 2 - 1, y1 + 2.5, 2, 1.5);
        g.fillStyle = wd; g.fillRect(x0, y0, x1 - x0, y1 - y0);
        g.fillStyle = shadeHex(wd, 0.2); g.fillRect(x0, y0, x1 - x0, 0.8);
        if (o === O.BILLIARD) {
          g.fillStyle = rich ? '#1e6a44' : '#2a6a3a'; g.fillRect(x0 + 2, y0 + 2, x1 - x0 - 4, y1 - y0 - 4);
          g.fillStyle = 'rgba(255,255,255,0.06)'; g.fillRect(x0 + 2, y0 + 2, x1 - x0 - 4, 2);
          for (const [x, y] of [[x0 + 2, y0 + 2], [(x0 + x1) / 2, y0 + 1.8], [x1 - 2, y0 + 2], [x0 + 2, y1 - 2], [(x0 + x1) / 2, y1 - 1.8], [x1 - 2, y1 - 2]]) this.circ(g, x, y, 1.2, '#0e0a08');
          const balls = ['#f4f0e4', '#e0c030', '#2a4aa8', '#c83030', '#6a2a8a', '#e07020', '#1e1e1e'];
          for (let k = 0; k < 7; k++) this.circ(g, x0 + 5 + hash2(i, k, 5) * (x1 - x0 - 10), y0 + 3.5 + hash2(i, k, 6) * (y1 - y0 - 7), 0.9, balls[k]);
          g.strokeStyle = '#c8a070'; g.lineWidth = 0.7; g.beginPath(); g.moveTo(x0 + 4, y1 - 3); g.lineTo(x0 + 17, y0 + 4); g.stroke();
          if (rich) { g.fillStyle = '#c8a040'; g.fillRect(x0, y0 + 2, 0.6, y1 - y0 - 4); g.fillRect(x1 - 0.6, y0 + 2, 0.6, y1 - y0 - 4); }
        } else {
          g.fillStyle = '#1e5a34'; g.fillRect(x0 + 1.5, y0 + 1.5, x1 - x0 - 3, y1 - y0 - 3);
          const wx = x0 + 6.5, wy = (y0 + y1) / 2;
          this.circ(g, wx, wy, 5, '#4a2a18'); this.circ(g, wx, wy, 4.2, '#2a1a10');
          for (let k = 0; k < 16; k++) { g.fillStyle = k === 0 ? '#2a8a3a' : k % 2 ? '#b82020' : '#141414'; g.beginPath(); g.moveTo(wx, wy); g.arc(wx, wy, 4, k * TAU / 16, (k + 1) * TAU / 16); g.fill(); }
          this.circ(g, wx, wy, 2.2, '#8a6a3a'); this.circ(g, wx, wy, 0.9, '#d8b050'); this.circ(g, wx + 2.9, wy - 1.2, 0.6, '#f4f0e4');
          for (let r = 0; r < 3; r++) for (let q = 0; q < 6; q++) { g.fillStyle = (r + q) % 2 ? '#b82020' : '#141414'; g.fillRect(x0 + 13 + q * 2.6, y0 + 2.5 + r * 2.2, 2.1, 1.7); }
          g.strokeStyle = 'rgba(240,236,220,0.7)'; g.lineWidth = 0.4; g.strokeRect(x0 + 12.6, y0 + 2.2, 16, 6.8);
          for (let k = 0; k < 4; k++) this.circ(g, x0 + 14 + hash2(i, k, 2) * 13, y0 + 3 + hash2(i, k, 3) * 5, 0.7, ['#e8e0d0', '#c83030', '#3050c0', '#e0c040'][k]);
        }
        break;
      }
      case O.FORGE: {
        // demirci ocağı: tuğla ocak, kor yatağı, duvara giden davlumbaz, yanda körük
        g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(cx - 8, cy + 5, 16, 2);
        g.fillStyle = '#3a3634'; g.beginPath(); g.moveTo(cx - 6, cy - 6); g.lineTo(cx + 6, cy - 6); g.lineTo(cx + 3, cy - 13); g.lineTo(cx - 3, cy - 13); g.fill();
        g.fillStyle = '#2a2624'; g.fillRect(cx - 2.5, cy - 16, 5, 3.5);
        g.fillStyle = '#7a3a26'; g.fillRect(cx - 8, cy - 6, 16, 11);
        g.fillStyle = '#5a2a1a'; for (let y = cy - 6, r = 0; y < cy + 5; y += 2.5, r++) { g.fillRect(cx - 8, y, 16, 0.5); for (let x = cx - 8 + (r % 2 ? 2 : 0); x < cx + 8; x += 4) g.fillRect(x, y, 0.5, 2.5); }
        g.fillStyle = '#2a1a14'; g.fillRect(cx - 5.5, cy - 4.5, 11, 5);
        this.ell(g, cx, cy - 2, 4.6, 1.8, '#a83a12'); this.ell(g, cx - 0.5, cy - 2.2, 3, 1.2, '#f07a22'); this.ell(g, cx - 0.5, cy - 2.4, 1.4, 0.7, '#ffd060');
        for (let k = 0; k < 5; k++) { g.fillStyle = '#3a2a24'; g.fillRect(cx - 4 + hash2(i, k, 2) * 8, cy - 3.6 + hash2(i, k, 3) * 2.4, 1.2, 0.8); }
        g.fillStyle = '#5a3a22'; g.beginPath(); g.moveTo(cx + 4, cy + 2); g.lineTo(cx + 9, cy + 0.5); g.lineTo(cx + 9, cy + 4.5); g.fill();
        g.fillStyle = '#3a2416'; g.fillRect(cx + 7.5, cy + 0.5, 1, 4);
        break;
      }
      case O.ANVIL: {
        this.ell(g, cx, cy + 5, 6, 2, 'rgba(0,0,0,0.3)');
        this.ell(g, cx, cy + 4, 4.5, 2, '#4a3220'); g.fillStyle = '#6a4a2e'; g.fillRect(cx - 4.5, cy - 1, 9, 5); this.ell(g, cx, cy - 1, 4.5, 2, '#8a6a46');
        g.strokeStyle = '#6a4e30'; g.lineWidth = 0.4; g.beginPath(); g.arc(cx, cy - 1, 2.6, 0, TAU); g.stroke();
        g.fillStyle = '#2a2a2e'; g.fillRect(cx - 2, cy - 4, 4, 3);
        g.fillStyle = '#3a3a40'; g.beginPath(); g.moveTo(cx - 5.5, cy - 7); g.lineTo(cx + 4, cy - 7); g.lineTo(cx + 4, cy - 4.5); g.lineTo(cx - 2, cy - 4.5); g.closePath(); g.fill();
        g.beginPath(); g.moveTo(cx - 5.5, cy - 7); g.lineTo(cx - 8, cy - 6); g.lineTo(cx - 5, cy - 5.2); g.fill();
        g.fillStyle = '#6a6a72'; g.fillRect(cx - 5, cy - 7, 9, 0.8);
        g.fillStyle = '#6a4428'; g.fillRect(cx + 1, cy - 9.5, 0.9, 4); g.fillStyle = '#4a4a50'; g.fillRect(cx - 0.2, cy - 10, 3.2, 1.4);
        break;
      }
      case O.OVEN: {
        // ekmek fırını: tuğla kubbe, kemerli ağızda kor, yanda fırın küreği
        g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(cx - 8, cy + 5, 16, 2);
        g.fillStyle = '#2a2624'; g.fillRect(cx - 2, cy - 16, 4, 4);
        this.ell(g, cx, cy - 6, 8, 7, '#9a5a3a');
        g.fillStyle = '#9a5a3a'; g.fillRect(cx - 8, cy - 6, 16, 11);
        g.fillStyle = '#7a3e26'; for (let y = cy - 11; y < cy + 5; y += 2.5) { const w = y < cy - 6 ? Math.sqrt(Math.max(0, 1 - ((y - cy + 6) / 7) ** 2)) * 8 : 8; g.fillRect(cx - w, y, w * 2, 0.5); }
        this.ell(g, cx - 2, cy - 10, 3, 1.4, 'rgba(255,220,180,0.18)');
        g.fillStyle = '#1a100a'; g.fillRect(cx - 4, cy - 3, 8, 6); this.ell(g, cx, cy - 3, 4, 2.2, '#1a100a');
        this.ell(g, cx, cy + 1.5, 3, 1.2, '#c84a14'); this.ell(g, cx, cy + 1.2, 1.8, 0.8, '#f0a030');
        g.fillStyle = '#c8b090'; g.fillRect(cx - 7, cy + 3.5, 14, 1.5);
        g.fillStyle = '#8a6a40'; g.fillRect(cx + 5.5, cy - 9, 0.9, 11); this.ell(g, cx + 6, cy + 2.5, 1.6, 1, '#a88050');
        break;
      }
      case O.VAT: {
        // bakır mayşe kazanı: kubbe kapak, duvara giden boru, perçinli kuşak, musluk
        this.ell(g, cx + 1, cy + 5.5, 7.5, 2.4, 'rgba(0,0,0,0.3)');
        g.fillStyle = '#8a4a26'; g.fillRect(cx - 7, cy - 4, 14, 8.5); this.ell(g, cx, cy + 4.5, 7, 2, '#7a3e20');
        g.fillStyle = '#c8783a'; g.fillRect(cx - 5.5, cy - 4, 3, 8.5); g.fillStyle = 'rgba(255,220,180,0.35)'; g.fillRect(cx - 4.5, cy - 4, 1, 8);
        this.ell(g, cx, cy - 4, 7, 3, '#b0683a'); this.ell(g, cx, cy - 4.6, 5, 2.2, '#c8803e'); this.ell(g, cx - 1.5, cy - 5.2, 2, 0.8, 'rgba(255,230,190,0.45)');
        g.fillStyle = '#a8602e'; g.fillRect(cx - 0.8, cy - 13, 1.6, 8); g.fillRect(cx - 0.8, cy - 13, 5, 1.6);
        g.fillStyle = '#5a2e14'; g.fillRect(cx - 7, cy, 14, 0.8); g.fillStyle = '#e0a060'; for (let x = cx - 6; x < cx + 7; x += 2.4) g.fillRect(x, cy - 0.2, 0.6, 0.6);
        g.fillStyle = '#c8a040'; g.fillRect(cx + 5, cy + 1.5, 3, 1); g.fillRect(cx + 7.2, cy + 1.5, 0.8, 2);
        break;
      }
      case O.WARDROBE: {
        const wd = rich ? '#4a2414' : ['#6a4428', '#5a3a22', '#7a5032'][Math.floor(h * 3)], lt = shadeHex(wd, 0.2), dk = shadeHex(wd, -0.3);
        g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(cx - 6, cy + 5, 14, 2.5);
        g.fillStyle = wd; g.fillRect(cx - 7, cy - 14, 14, 20);
        g.fillStyle = lt; g.fillRect(cx - 7.5, cy - 15.5, 15, 1.8);
        g.fillStyle = dk; g.fillRect(cx - 0.4, cy - 13, 0.8, 16);
        g.strokeStyle = dk; g.lineWidth = 0.6;
        for (const x of [cx - 6, cx + 1]) { g.strokeRect(x + 0.5, cy - 12.5, 4, 6.5); g.strokeRect(x + 0.5, cy - 5, 4, 7); }
        g.fillStyle = rich ? '#d8b050' : '#a88a50'; g.fillRect(cx - 1.6, cy - 5, 0.8, 1.6); g.fillRect(cx + 0.8, cy - 5, 0.8, 1.6);
        g.fillStyle = dk; g.fillRect(cx - 7, cy + 3, 14, 3);
        g.fillStyle = lt; g.fillRect(cx - 7, cy + 3, 14, 0.6);
        break;
      }
      case O.WASHSTAND: {
        // lavabo dolabı: leğen, sürahi, havlu (zenginde mermer tabla)
        const wd = rich ? '#4a2a18' : '#6a4a2e';
        g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(cx - 5, cy + 5, 12, 2);
        g.fillStyle = shadeHex(wd, -0.3); g.fillRect(cx - 6, cy - 1, 12, 6.5);
        g.fillStyle = rich ? '#e8e4dc' : wd; g.fillRect(cx - 6, cy - 4, 12, 3.5);
        g.fillStyle = shadeHex(rich ? '#e8e4dc' : wd, 0.15); g.fillRect(cx - 6, cy - 4, 12, 0.6);
        this.ell(g, cx - 1.5, cy - 2.4, 3.6, 1.6, '#f0ece4'); this.ell(g, cx - 1.5, cy - 2.4, 2.6, 1, '#9ab8c8');
        g.fillStyle = '#e8e4dc'; g.fillRect(cx + 2.8, cy - 6.5, 2.4, 4); g.fillRect(cx + 2.4, cy - 7, 1.2, 0.8); g.fillStyle = '#5a7aa0'; g.fillRect(cx + 2.8, cy - 5.2, 2.4, 0.6);
        g.fillStyle = '#e8e0d0'; g.fillRect(cx - 6.5, cy - 1, 1.2, 4); g.fillStyle = '#b84040'; g.fillRect(cx - 6.5, cy + 1.5, 1.2, 0.5);
        g.fillStyle = rich ? '#c8a040' : '#3a2416'; g.fillRect(cx - 0.6, cy + 1.5, 1.2, 1);
        break;
      }
      case O.PALM: {
        this.ell(g, cx + 1, cy + 6, 5, 1.8, 'rgba(0,0,0,0.3)');
        const pot = rich ? '#c8a040' : '#8a4a2a';
        g.fillStyle = shadeHex(pot, -0.25); g.beginPath(); g.moveTo(cx - 4.5, cy); g.lineTo(cx + 4.5, cy); g.lineTo(cx + 3.2, cy + 6); g.lineTo(cx - 3.2, cy + 6); g.fill();
        g.fillStyle = pot; g.fillRect(cx - 4.8, cy - 0.5, 9.6, 1.6); g.fillStyle = shadeHex(pot, 0.3); g.fillRect(cx - 4.8, cy - 0.5, 9.6, 0.5);
        g.fillStyle = '#6a5030'; g.fillRect(cx - 0.6, cy - 6, 1.2, 6);
        for (let k = 0; k < 9; k++) {
          const a = -Math.PI / 2 + (k - 4) * 0.42 + (h - 0.5) * 0.2, L = 8 + (k % 2) * 2, ex = cx + Math.cos(a) * L, ey = cy - 6 + Math.sin(a) * L * 0.85, my = Math.min(ey, cy - 6) - 2.5;
          for (const [c, w] of [[k % 2 ? '#3a6a2a' : '#4a7a32', 1.6], ['#5a8a3a', 0.5]]) { g.strokeStyle = c; g.lineWidth = w; g.beginPath(); g.moveTo(cx, cy - 6); g.quadraticCurveTo((cx + ex) / 2, my, ex, ey + 1.5); g.stroke(); }
        }
        break;
      }
      case O.LECTERN: {
        this.ell(g, cx, cy + 5.5, 4.5, 1.6, 'rgba(0,0,0,0.3)');
        const wd = rich ? '#4a2414' : '#5a3a22';
        g.fillStyle = shadeHex(wd, -0.2); g.fillRect(cx - 4, cy + 3.5, 8, 2);
        g.fillStyle = wd; g.fillRect(cx - 1.5, cy - 2, 3, 6);
        g.fillStyle = shadeHex(wd, 0.15); g.fillRect(cx - 1.5, cy - 2, 0.8, 6);
        g.fillStyle = wd; g.beginPath(); g.moveTo(cx - 5.5, cy - 6.5); g.lineTo(cx + 5.5, cy - 6.5); g.lineTo(cx + 6, cy - 2); g.lineTo(cx - 6, cy - 2); g.fill();
        g.fillStyle = '#f4f0e4'; g.fillRect(cx - 4.5, cy - 6, 4.3, 3.4); g.fillRect(cx + 0.2, cy - 6, 4.3, 3.4);
        g.fillStyle = '#8a7a6a'; for (let k = 0; k < 3; k++) { g.fillRect(cx - 4, cy - 5.3 + k, 3.4, 0.35); g.fillRect(cx + 0.7, cy - 5.3 + k, 3.4, 0.35); }
        g.fillStyle = '#a02020'; g.fillRect(cx - 0.3, cy - 6, 0.6, 4.5);
        if (rich) { g.fillStyle = '#c8a040'; g.fillRect(cx - 6, cy - 2.2, 12, 0.6); }
        break;
      }
      case O.ORGAN: {
        // org: gövdenin üstünde yaldızlı borular, klavye, pedal kasası
        g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(cx - 8, cy + 5, 16, 2);
        const wd = '#3a2416';
        for (let k = 0; k < 7; k++) { const x = cx - 6.5 + k * 2.1, hh = 9 - Math.abs(3 - k) * 0.9; g.fillStyle = rich ? '#d8b860' : '#b8a070'; g.fillRect(x, cy - 7 - hh, 1.5, hh); g.fillStyle = 'rgba(255,255,255,0.3)'; g.fillRect(x, cy - 7 - hh, 0.5, hh); g.fillStyle = '#2a1a10'; g.fillRect(x + 0.3, cy - 9, 0.9, 0.7); }
        g.fillStyle = wd; g.fillRect(cx - 8, cy - 7, 16, 8);
        g.fillStyle = shadeHex(wd, 0.2); g.fillRect(cx - 8, cy - 7, 16, 0.8);
        g.fillStyle = rich ? '#c8a040' : '#8a6a30'; g.fillRect(cx - 7, cy - 5.5, 14, 0.6);
        g.fillStyle = '#f0ece0'; g.fillRect(cx - 7, cy + 1, 14, 2.5); g.fillStyle = '#1a1a1a'; for (let x = cx - 6; x < cx + 7; x += 2) g.fillRect(x, cy + 1, 1, 1.5);
        g.fillStyle = shadeHex(wd, -0.25); g.fillRect(cx - 8, cy + 3.5, 16, 3);
        g.fillStyle = '#2a1a10'; g.fillRect(cx - 4, cy + 4.5, 3, 1.2); g.fillRect(cx + 1, cy + 4.5, 3, 1.2);
        break;
      }
      case O.SADDLE: {
        // sehpada eyer ve battaniye
        this.ell(g, cx, cy + 5.5, 6.5, 1.8, 'rgba(0,0,0,0.3)');
        g.fillStyle = '#5a3a22'; g.fillRect(cx - 6, cy + 1, 1.2, 5); g.fillRect(cx + 4.8, cy + 1, 1.2, 5); g.fillRect(cx - 6, cy - 1, 12, 2);
        const bl = ['#8a2a2a', '#2a4a7a', '#7a6a2a'][Math.floor(h * 3)];
        g.fillStyle = bl; g.fillRect(cx - 6.5, cy - 4, 13, 5); g.fillStyle = '#e8d8b0'; g.fillRect(cx - 6.5, cy - 2, 13, 0.8); g.fillStyle = shadeHex(bl, -0.3); g.fillRect(cx - 6.5, cy + 0.4, 13, 0.6);
        g.fillStyle = '#6a3e1e'; g.beginPath(); g.moveTo(cx - 5, cy - 3); g.quadraticCurveTo(cx, cy - 6, cx + 5, cy - 3); g.lineTo(cx + 4, cy - 1); g.quadraticCurveTo(cx, cy - 3, cx - 4, cy - 1); g.fill();
        g.fillStyle = '#8a5a30'; g.fillRect(cx - 2.5, cy - 4.6, 5, 1.6);
        g.fillStyle = '#4a2a14'; g.fillRect(cx + 3, cy - 6.5, 1.2, 2.5); this.circ(g, cx + 3.6, cy - 6.8, 1, '#5a3418');
        g.fillStyle = '#4a2a14'; g.fillRect(cx - 0.6, cy - 1.5, 1.2, 4); g.fillStyle = '#9a9aa0'; g.fillRect(cx - 1.2, cy + 2.4, 2.4, 0.8);
        break;
      }
      case O.BUST: {
        // kaidede mermer büst
        this.ell(g, cx, cy + 5.5, 4, 1.5, 'rgba(0,0,0,0.3)');
        const m = '#e4e0d8', d = '#a8a49c';
        g.fillStyle = d; g.fillRect(cx - 3.2, cy + 3.5, 6.4, 2);
        g.fillStyle = m; g.fillRect(cx - 2.4, cy - 3, 4.8, 6.5);
        g.fillStyle = d; g.fillRect(cx + 1, cy - 3, 1.4, 6.5); g.fillRect(cx - 3, cy - 3.6, 6, 1);
        this.ell(g, cx, cy - 5.4, 3.6, 1.8, m); this.ell(g, cx + 0.8, cy - 5.2, 2, 1.2, d);
        this.ell(g, cx, cy - 9, 2.1, 2.6, m); g.fillStyle = d; g.fillRect(cx + 0.9, cy - 10, 1, 2.6); g.fillRect(cx - 1.4, cy - 11.4, 2.8, 0.8);
        break;
      }
      case O.DISPLAY: {
        // alçak vitrin: cam üstün altında bina türüne göre mallar
        const wd = rich ? '#3a2014' : '#5a3a22';
        g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(cx - 6, cy + 5, 14, 2.4);
        g.fillStyle = shadeHex(wd, -0.25); g.fillRect(cx - 7, cy + 0.5, 14, 5);
        g.fillStyle = wd; g.fillRect(cx - 7, cy - 6, 14, 7);
        g.fillStyle = '#a8bcc0'; g.fillRect(cx - 6, cy - 5, 12, 5);
        for (let k = 0; k < 5; k++) {
          const x = cx - 5 + k * 2.3, y = cy - 4 + hash2(i, k, 4) * 2.5, q = hash2(i, k, 5);
          if (t === 'gunsmith') { g.fillStyle = '#2a2a2e'; g.fillRect(x - 0.5, y, 2.4, 0.8); g.fillStyle = '#6a4428'; g.fillRect(x + 1.2, y, 0.8, 1.6); }
          else if (t === 'tailor') { g.fillStyle = ['#c8a040', '#e8e0d0', '#6a2a4a'][Math.floor(q * 3)]; g.fillRect(x, y, 1.6, 1.2); }
          else if (t === 'bakery') this.ell(g, x + 0.8, y + 0.8, 1, 0.8, ['#c87a3a', '#e8c890', '#6a3a1e'][Math.floor(q * 3)]);
          else if (t === 'butcher') this.ell(g, x + 0.8, y + 0.8, 1.1, 0.8, q < 0.5 ? '#b84a3a' : '#d88a7a');
          else if (t === 'pharmacy' || t === 'doctor') { g.fillStyle = ['#8a3a2a', '#3a6a5a', '#a88a3a'][Math.floor(q * 3)]; g.fillRect(x, y - 0.6, 1.2, 2); }
          else this.circ(g, x + 0.8, y + 0.8, 0.7, ['#e0c040', '#c83030', '#3a7ac8', '#e8e0d0'][Math.floor(q * 4)]);
        }
        g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.moveTo(cx - 6, cy - 0.5); g.lineTo(cx - 2, cy - 5); g.lineTo(cx - 0.5, cy - 5); g.lineTo(cx - 4.5, cy - 0.5); g.fill();
        g.fillStyle = shadeHex(wd, 0.2); g.fillRect(cx - 7, cy - 6, 14, 0.6);
        if (rich) { g.fillStyle = '#c8a040'; g.fillRect(cx - 7, cy + 0.5, 14, 0.5); }
        break;
      }
      case O.LAMPSTAND: {
        // ayaklı lamba: pirinç direk, püsküllü abajur (melez çizimde gece yanar)
        this.ell(g, cx, cy + 5.5, 3.5, 1.3, 'rgba(0,0,0,0.3)');
        const br = '#b89040', sc = ['#e8c890', '#d8a878', '#c8a0a0'][Math.floor(h * 3)];
        this.ell(g, cx, cy + 4.5, 2.6, 1, shadeHex(br, -0.2));
        g.fillStyle = br; g.fillRect(cx - 0.5, cy - 8, 1, 12.5); g.fillStyle = shadeHex(br, 0.3); g.fillRect(cx - 0.5, cy - 8, 0.4, 12);
        g.fillStyle = sc; g.beginPath(); g.moveTo(cx - 2.5, cy - 14); g.lineTo(cx + 2.5, cy - 14); g.lineTo(cx + 4.5, cy - 8.5); g.lineTo(cx - 4.5, cy - 8.5); g.fill();
        g.fillStyle = 'rgba(255,240,200,0.5)'; g.fillRect(cx - 1.5, cy - 13.5, 1.2, 4.5);
        g.fillStyle = shadeHex(sc, -0.3); for (let x = cx - 4.5; x <= cx + 4.3; x += 1.2) g.fillRect(x, cy - 8.5, 0.6, 1);
        break;
      }
      case O.STOOL: {
        // bar taburesi: barın hemen önünde
        const y = cy - 3;
        this.ell(g, cx, y + 4, 3, 1.2, 'rgba(0,0,0,0.3)');
        g.fillStyle = '#3a2416'; g.fillRect(cx - 2.5, y, 0.8, 4); g.fillRect(cx + 1.7, y, 0.8, 4);
        g.fillStyle = '#2a1a10'; g.fillRect(cx - 2.2, y + 2.2, 4.4, 0.5);
        this.ell(g, cx, y - 0.5, 3, 1.6, rich ? '#7a2430' : '#5a3a22'); this.ell(g, cx - 0.5, y - 0.9, 1.6, 0.8, rich ? '#9a3440' : '#7a5434');
        break;
      }
      case O.DRESSER: {
        // aynalı konsol: üç çekmece, üstünde tarak ve şişe
        const wd = rich ? '#4a2414' : ['#6a4428', '#7a5032'][Math.floor(h * 2)], lt = shadeHex(wd, 0.2), dk = shadeHex(wd, -0.3);
        g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(cx - 6, cy + 5, 14, 2.2);
        g.fillStyle = dk; g.fillRect(cx - 0.6, cy - 7, 1.2, 2); this.ell(g, cx, cy - 10, 4.2, 4, rich ? '#c8a040' : lt); this.ell(g, cx, cy - 10, 3.4, 3.2, '#9ab4c0');
        g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(cx - 2, cy - 12, 0.9, 4);
        g.fillStyle = wd; g.fillRect(cx - 7, cy - 5, 14, 11);
        g.fillStyle = lt; g.fillRect(cx - 7.4, cy - 5.5, 14.8, 1.2);
        for (let k = 0; k < 3; k++) { const y = cy - 3.4 + k * 3; g.fillStyle = dk; g.fillRect(cx - 6, y + 2.4, 12, 0.5); g.fillStyle = rich ? '#d8b050' : '#a88a50'; g.fillRect(cx - 3.5, y + 1, 1, 0.8); g.fillRect(cx + 2.5, y + 1, 1, 0.8); }
        g.fillStyle = '#e8e0d0'; g.fillRect(cx + 3.5, cy - 7.5, 1.2, 2); g.fillStyle = '#7a5aa0'; g.fillRect(cx - 5, cy - 7, 1.4, 1.6);
        break;
      }
      case O.TELEGRAPH: {
        // telgraf masası: manipülatör, alıcı, pil kavanozları, kâğıt şerit; duvara giden tel
        g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(cx - 6, cy + 5, 13, 2);
        g.fillStyle = '#4a2e1a'; g.fillRect(cx - 7, cy - 1, 14, 6);
        g.fillStyle = '#6e4a2c'; g.fillRect(cx - 7, cy - 5, 14, 4.5); g.fillStyle = 'rgba(255,230,190,0.15)'; g.fillRect(cx - 7, cy - 5, 14, 0.6);
        g.fillStyle = '#2a2a2e'; g.fillRect(cx - 5, cy - 3.6, 4, 1.4); g.fillStyle = '#c8a040'; g.fillRect(cx - 4.4, cy - 4.2, 2.6, 0.7); this.circ(g, cx - 1.6, cy - 4.4, 0.6, '#1a1a1a');
        g.fillStyle = '#c8a040'; g.fillRect(cx + 0.5, cy - 4.6, 2.4, 2.2); g.fillStyle = '#5a3a22'; g.fillRect(cx + 0.3, cy - 2.6, 2.8, 0.6);
        for (const x of [cx + 4, cx + 5.6]) { g.fillStyle = 'rgba(180,210,220,0.85)'; g.fillRect(x, cy - 6, 1.3, 2.6); g.fillStyle = '#4a4a4e'; g.fillRect(x, cy - 6.4, 1.3, 0.5); }
        g.fillStyle = '#f0ead8'; g.fillRect(cx - 6.5, cy - 1.6, 5, 0.9);
        g.strokeStyle = '#5a5a5e'; g.lineWidth = 0.4; g.beginPath(); g.moveTo(cx + 1.7, cy - 4.6); g.lineTo(cx + 1.7, cy - 12); g.stroke();
        break;
      }
      case O.SCALE: {
        // baskül: demir platform, dikme, pirinç kantar kolu
        this.ell(g, cx + 0.5, cy + 5, 6, 1.8, 'rgba(0,0,0,0.3)');
        g.fillStyle = '#3a3a40'; g.fillRect(cx - 5.5, cy + 0.5, 11, 4);
        g.fillStyle = '#5a5a62'; g.fillRect(cx - 5.5, cy - 1.5, 11, 2.4);
        g.fillStyle = '#7a7a82'; g.fillRect(cx - 5, cy - 1.2, 10, 0.5);
        g.fillStyle = '#2a2a30'; g.fillRect(cx + 3.2, cy - 11, 1.4, 10);
        g.fillStyle = '#c8a040'; g.fillRect(cx - 3.5, cy - 11.5, 8.5, 1); this.ell(g, cx - 2, cy - 11, 0.9, 1, '#2a2a30');
        g.fillStyle = '#8a8a90'; g.fillRect(cx + 4.8, cy - 11.5, 0.6, 3);
        if (h > 0.4) { g.fillStyle = '#b89a6a'; g.fillRect(cx - 3, cy - 4, 4, 3); g.fillStyle = '#8a6a3a'; g.fillRect(cx - 3, cy - 4, 4, 0.6); }
        break;
      }
      case O.STAIRS: case O.STAIRSD: {
        // otel merdiveni (kuzey-güney): dış kenarı yan duvara dayanır, iç kenarda korkuluk. Zemin katta kuzeye doğru
        // yükselir (basamaklar açılır), üst katta boşluğun içinde aşağı iner (kuzeye doğru kararır)
        const lx = (i % WW) - b.x, left = lx < b.w / 2, down = o === O.STAIRSD;
        let p = 0, n = 1;
        for (let q = i - WW; world.obj[q] === o; q -= WW) { p++; n++; }
        for (let q = i + WW; world.obj[q] === o; q += WW) n++;
        const x0 = left ? cx - 19 : cx - 8, x1 = left ? cx + 8 : cx + 19, w = x1 - x0;
        for (let j = 0; j < 4; j++) {
          const u = (p * 4 + j) / (n * 4 - 1), k = down ? -0.6 * (1 - u) : 0.26 * (1 - u) - 0.1;
          g.fillStyle = shadeHex('#8a6440', k); g.fillRect(x0, cy - 8 + j * 4, w, 3);
          g.fillStyle = shadeHex('#4a3020', down ? k * 0.6 : 0); g.fillRect(x0, cy - 5 + j * 4, w, 1);
        }
        if (down && !same(-WW)) { g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillRect(x0, cy - 8, w, 4); }   // boşluğun dibi
        const rx = left ? x1 - 2 : x0;
        g.fillStyle = '#3a2416'; g.fillRect(rx, cy - 8, 2, 16);
        g.fillStyle = '#5a3a22'; for (let y = cy - 7; y < cy + 8; y += 4) g.fillRect(left ? rx - 1.5 : rx + 2, y, 1.5, 1);
        if (!same(WW)) { g.fillStyle = '#2a1a10'; g.fillRect(rx - 0.5, cy + 3, 3, 5); g.fillStyle = '#c8a040'; g.fillRect(rx, cy + 3, 2, 1); }   // merdiven başındaki dikme
        break;
      }
      case O.SOFA: {
        // lobi kanepesi: kuzeye bakar, arkalığı güneyde; uçlarda kolçak
        const fab = '#6a2a30', dk = shadeHex(fab, -0.38);
        g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(cx - 8, cy + 7, 16, 2);
        g.fillStyle = dk; g.fillRect(cx - 8, cy + 1, 16, 6);
        g.fillStyle = fab; g.fillRect(cx - 8, cy - 5, 16, 7);
        g.fillStyle = shadeHex(fab, 0.2); g.fillRect(cx - 8, cy - 5, 16, 1);
        g.fillStyle = shadeHex(fab, -0.18); g.fillRect(cx - 0.5, cy - 5, 1, 7);
        if (!same(-1)) { g.fillStyle = dk; g.fillRect(cx - 8, cy - 6, 3, 13); g.fillStyle = shadeHex(fab, 0.1); g.fillRect(cx - 8, cy - 6, 3, 1); }
        if (!same(1)) { g.fillStyle = dk; g.fillRect(cx + 5, cy - 6, 3, 13); g.fillStyle = shadeHex(fab, 0.1); g.fillRect(cx + 5, cy - 6, 3, 1); }
        break;
      }
      case O.RDOOR: {
        // üst kattaki oda kapısı: duvar bandının yerinde; kapalıyken kanat, açıkken odaya doğru açılmış kanat. Otelde
        // koridor yanında pirinç levhada oda numarası
        const lx = (i % WW) - b.x, ly = Math.floor(i / WW) - b.y, UP = upPlan(b);
        const k = UP ? UP.rooms.findIndex(R => R.door[0] === lx && R.door[1] === ly) : -1;
        if (k < 0) break;
        const R = UP.rooms[k], open = roomOpen(b, k), back = R.side === 2;
        const wy = back ? cy + 4 : cy - 8, wh = back ? 4 : 6;
        g.fillStyle = '#2a1a10'; g.fillRect(cx - 8, wy - 1, 2, wh + 2); g.fillRect(cx + 6, wy - 1, 2, wh + 2);
        if (open) {
          g.fillStyle = 'rgba(255,230,180,0.22)'; g.fillRect(cx - 6, wy, 12, wh);
          g.fillStyle = '#7a5032'; g.fillRect(cx - 6, back ? wy - 11 : wy + wh, 3, 12);
          g.fillStyle = '#5a3820'; g.fillRect(cx - 4, back ? wy - 11 : wy + wh, 1, 12);
        } else {
          g.fillStyle = '#7a5032'; g.fillRect(cx - 6, wy, 12, wh);
          g.fillStyle = '#5a3820'; g.fillRect(cx - 6, wy + wh - 1, 12, 1); g.fillRect(cx - 0.5, wy, 1, wh);
          g.fillStyle = '#c8a040'; g.fillRect(cx + 3, wy + (wh >> 1), 1, 1);
        }
        if (b.type !== 'hotel') break;
        const DIG = ['010110010010111', '111001111100111', '111001111001111', '101101111001001'][k];
        const py = back ? wy + wh + 1 : wy - 8;
        g.fillStyle = '#2a1a10'; g.fillRect(cx - 4, py - 1, 7, 9); g.fillStyle = '#c8a040'; g.fillRect(cx - 3, py, 5, 7);
        g.fillStyle = '#3a2416'; for (let q = 0; q < 15; q++) if (DIG[q] === '1') g.fillRect(cx - 2 + (q % 3), py + 1 + Math.floor(q / 3), 1, 1);
        break;
      }
    }
  },
  building(g, o, b, world) {
    const d = b.def, X = b.x * TS, Y = b.y * TS, W = b.w * TS, H = b.h * TS;
    const tall = d.tall ? 30 : 22;
    const FW = b.type === 'mineentrance' ? 14 : tall;
    const wy = Y + H - FW;
    const h = bHash(b, 5), C = bCol(b);
    const wall = C.wall, roof = C.roof;
    // gölge
    g.fillStyle = 'rgba(0,0,0,0.32)'; g.fillRect(X + 6, Y + 4, W, H);
    if (b.type === 'mineentrance') {
      g.fillStyle = b.cave ? '#3a342e' : '#4a3a2a'; g.fillRect(X, wy, W, FW);
      this.ell(g, X + W / 2, Y + H - 2, W * 0.32, FW * 0.75, '#0a0806');
      if (!b.cave) { g.fillStyle = '#6a4a2e'; g.fillRect(X + W * 0.15, wy, 3, FW); g.fillRect(X + W * 0.85 - 3, wy, 3, FW); g.fillRect(X + W * 0.12, wy, W * 0.76, 3); }
      return;
    }
    if (b.type === 'lighthouse') {
      this.ell(g, X + W / 2 + 4, Y + H, W * 0.5, 6, 'rgba(0,0,0,0.3)');
      g.fillStyle = '#e8e0d8'; g.fillRect(X + W * 0.2, Y + H - 34, W * 0.6, 34);
      g.fillStyle = '#b0302a'; g.fillRect(X + W * 0.2, Y + H - 24, W * 0.6, 6); g.fillRect(X + W * 0.2, Y + H - 12, W * 0.6, 5);
      g.fillStyle = '#2a2420'; g.fillRect(X + W / 2 - 3, Y + H - 10, 6, 10);
      o.fillStyle = '#e8e0d8'; o.fillRect(X + W * 0.24, Y - 20, W * 0.52, H - 12);
      o.fillStyle = '#b0302a'; o.fillRect(X + W * 0.24, Y - 4, W * 0.52, 6);
      o.fillStyle = '#2a2420'; o.fillRect(X + W * 0.2, Y - 30, W * 0.6, 10);
      o.fillStyle = '#f8e8a0'; o.fillRect(X + W * 0.28, Y - 28, W * 0.44, 6);
      o.fillStyle = '#a02a20'; o.beginPath(); o.moveTo(X + W * 0.18, Y - 30); o.lineTo(X + W / 2, Y - 40); o.lineTo(X + W * 0.82, Y - 30); o.fill();
      return;
    }
    if (b.type === 'market') { this.market(g, o, b, world); return; }
    if (modernB(b)) { this.modernBuilding(g, o, b, world); return; }
    const f = b.enter ? o : g;
    // Ön cephe
    const wallC = b.def.ruin ? '#5a4c3c' : wall;
    f.fillStyle = wallC; f.fillRect(X, wy, W, FW);
    if (d.brick) {
      f.fillStyle = 'rgba(0,0,0,0.18)';
      for (let yy = wy; yy < Y + H; yy += 3) for (let xx = X + ((yy / 3) % 2) * 3; xx < X + W; xx += 6) f.fillRect(xx, yy, 1, 3);
      for (let yy = wy; yy < Y + H; yy += 3) f.fillRect(X, yy, W, 0.6);
    } else {
      f.fillStyle = 'rgba(0,0,0,0.16)';
      for (let xx = X + 2; xx < X + W; xx += 4) f.fillRect(xx, wy, 1, FW);
      f.fillStyle = 'rgba(255,255,255,0.08)'; f.fillRect(X, wy, W, 2);
      // ekonomik: boyasız tahtanın kimi yeri koyu, kimi yeri yamalı
      if (C.worn) for (let xx = X; xx < X + W; xx += 4) { const q = hash2(xx, b.y, 41); if (q > 0.72) { f.fillStyle = q > 0.9 ? 'rgba(255,240,210,0.08)' : 'rgba(0,0,0,0.16)'; f.fillRect(xx, wy + (q * 9 | 0), 4, FW - (q * 9 | 0)); } }
    }
    // gelişmiş: köşe pervazları ve korniş beyaz
    if (C.trim) { f.fillStyle = C.trim; f.fillRect(X, wy, 2, FW); f.fillRect(X + W - 2, wy, 2, FW); f.fillRect(X, wy, W, 1.5); }
    f.fillStyle = 'rgba(0,0,0,0.35)'; f.fillRect(X, Y + H - 2, W, 2);
    // kapı
    const dx = b.door.x;
    if (b.type === 'stable' || b.type === 'barn') {
      f.fillStyle = '#2a1e14'; f.fillRect(dx - 10, Y + H - 16, 20, 16);
      f.strokeStyle = '#c8b090'; f.lineWidth = 1; f.beginPath(); f.moveTo(dx - 10, Y + H - 16); f.lineTo(dx + 10, Y + H); f.moveTo(dx + 10, Y + H - 16); f.lineTo(dx - 10, Y + H); f.stroke();
    } else if (b.type === 'station') {
      f.fillStyle = '#2a2016'; f.fillRect(dx - 5, Y + H - 14, 10, 14);
    } else {
      f.fillStyle = '#2a1c12'; f.fillRect(dx - 4, Y + H - 14, 8, 14);
      if (b.type === 'saloon' || b.type === 'cantina' || b.type === 'gambling') { /* yarım kanatlı kapılar Juice.drawAfterCovers'ta, salınarak çizilir */ }
      else { f.fillStyle = '#5a3e26'; f.fillRect(dx - 3, Y + H - 13, 6, 12); f.fillStyle = '#c8a040'; f.fillRect(dx + 1.5, Y + H - 7, 1, 1); }
    }
    if (b.shut) { if (b.type === 'stable' || b.type === 'barn') this.boards(f, dx - 10, Y + H - 16, 20, 16, true); else this.boards(f, dx - 4, Y + H - 14, 8, 14, true); }
    // pencereler
    const nWin = Math.max(1, Math.floor(b.w / 3));
    for (let k = 0; k < nWin; k++) {
      const cx = X + (k + 0.5) * W / nWin;
      if (Math.abs(cx - dx) < 10) continue;
      f.fillStyle = '#3a2a1c'; f.fillRect(cx - 4, wy + FW - 16, 8, 9);
      f.fillStyle = b.def.ruin ? '#101010' : '#27394a'; f.fillRect(cx - 3, wy + FW - 15, 6, 7);
      f.fillStyle = 'rgba(200,220,240,0.25)'; f.fillRect(cx - 3, wy + FW - 15, 2, 7);
      if (d.tall) { f.fillStyle = '#3a2a1c'; f.fillRect(cx - 4, wy + 3, 8, 7); f.fillStyle = '#27394a'; f.fillRect(cx - 3, wy + 4, 6, 5); }
      if (b.shut) { this.boards(f, cx - 4, wy + FW - 16, 8, 9); if (d.tall) this.boards(f, cx - 4, wy + 3, 8, 7); }
    }
    // veranda direkleri & tente
    if (!b.def.ruin && b.type !== 'station' && b.type !== 'barn' && b.type !== 'hermit') {
      o.fillStyle = shadeHex(roof, -0.1); o.fillRect(X - 1, Y + H - 3, W + 2, 5);
      o.fillStyle = 'rgba(0,0,0,0.2)'; o.fillRect(X - 1, Y + H + 1, W + 2, 1);
      g.fillStyle = '#4a3422'; g.fillRect(X + 1, Y + H, 1.6, 14); g.fillRect(X + W - 2.6, Y + H, 1.6, 14);
    }
    // Çatı
    const ry0 = Y - 8, rh = wy - ry0;
    if (b.def.ruin) {
      o.fillStyle = shadeHex(roof, -0.1);
      for (let k = 0; k < b.w; k++) if (hash2(b.x + k, b.y, 3) > 0.4) o.fillRect(X + k * TS, ry0 + hash2(k, b.y, 1) * 8, TS - 2, rh - hash2(k, b.y, 2) * 16);
      o.fillStyle = '#3a3024'; o.fillRect(X, wy - 4, W, 4);
    } else {
      o.fillStyle = shadeHex(roof, 0.08); o.fillRect(X - 2, ry0, W + 4, rh / 2);
      o.fillStyle = shadeHex(roof, -0.12); o.fillRect(X - 2, ry0 + rh / 2, W + 4, rh / 2);
      o.fillStyle = 'rgba(0,0,0,0.18)';
      for (let yy = ry0 + 3; yy < ry0 + rh; yy += 4) o.fillRect(X - 2, yy, W + 4, 1);
      for (let yy = ry0; yy < ry0 + rh; yy += 4) for (let xx = X + ((yy / 4) % 2) * 3; xx < X + W; xx += 7) o.fillRect(xx, yy, 1, 4);
      o.fillStyle = shadeHex(roof, 0.25); o.fillRect(X - 2, ry0 + rh / 2 - 1, W + 4, 2);
      o.fillStyle = 'rgba(0,0,0,0.3)'; o.fillRect(X - 2, ry0 + rh - 2, W + 4, 2);
      // kar örtüsü
      if (world && world.snowyTile(b.x + (b.w >> 1), b.y + (b.h >> 1))) {
        o.fillStyle = 'rgba(236,241,246,0.92)'; o.fillRect(X - 2, ry0, W + 4, rh * 0.62);
        o.fillStyle = 'rgba(214,222,230,0.9)';
        for (let xx = X - 2; xx < X + W + 2; xx += 4) o.fillRect(xx, ry0 + rh * 0.62, 4, 1 + hash2(xx, b.y, 9) * 3);
      }
      // baca
      if (h > 0.3 && b.type !== 'station') { o.fillStyle = '#5a4a44'; o.fillRect(X + W * (0.2 + h * 0.5), ry0 + 2, 5, 9); o.fillStyle = '#2a2220'; o.fillRect(X + W * (0.2 + h * 0.5), ry0 + 2, 5, 2); }
    }
    // sahte cephe (western tarzı)
    if (!d.church && b.type !== 'station' && b.type !== 'barn' && b.type !== 'hermit' && b.type !== 'cabin' && !b.def.ruin && b.type !== 'house' && b.type !== 'property' && b.type !== 'ranch') {
      const fh = 12 + (d.tall ? 6 : 0);
      o.fillStyle = wallC;
      o.beginPath(); o.moveTo(X, wy); o.lineTo(X, wy - fh + 4); o.lineTo(X + W * 0.2, wy - fh + 4); o.lineTo(X + W * 0.2, wy - fh); o.lineTo(X + W * 0.8, wy - fh); o.lineTo(X + W * 0.8, wy - fh + 4); o.lineTo(X + W, wy - fh + 4); o.lineTo(X + W, wy); o.fill();
      o.fillStyle = 'rgba(0,0,0,0.15)'; for (let xx = X + 2; xx < X + W; xx += 4) o.fillRect(xx, wy - fh, 1, fh);
      o.fillStyle = shadeHex(wallC, -0.35); o.fillRect(X, wy - fh + 3, W, 1);
      if (C.trim) { o.fillStyle = C.trim; o.fillRect(X + W * 0.2, wy - fh, W * 0.6, 1.5); o.fillRect(X, wy - fh + 4, W * 0.2, 1.5); o.fillRect(X + W * 0.8, wy - fh + 4, W * 0.2, 1.5); }
      const txt = SIGN_TEXT[b.type];
      if (txt) {
        const sw = Math.min(W - 8, txt.length * 4.6 + 6);
        o.fillStyle = d.sign || '#c9a45c'; o.fillRect(X + W / 2 - sw / 2, wy - fh + 1, sw, 8);
        o.fillStyle = '#1a120c'; o.font = 'bold 7px monospace'; o.textAlign = 'center'; o.textBaseline = 'middle';
        o.fillText(txt, X + W / 2, wy - fh + 5.2);
      }
    } else if (SIGN_TEXT[b.type]) {
      const txt = b.type === 'property' ? (b.owned ? 'HOME' : 'FOR SALE') : SIGN_TEXT[b.type];
      const sw = txt.length * 4.6 + 6;
      o.fillStyle = d.sign || '#c9a45c'; o.fillRect(X + W / 2 - sw / 2, wy - 9, sw, 8);
      o.fillStyle = '#1a120c'; o.font = 'bold 7px monospace'; o.textAlign = 'center'; o.textBaseline = 'middle';
      o.fillText(txt, X + W / 2, wy - 4.8);
    }
    if (d.church) {
      const cx = X + W / 2;
      o.fillStyle = '#e8e0d0'; o.fillRect(cx - 7, ry0 - 26, 14, 30);
      o.fillStyle = '#4a3a34'; o.beginPath(); o.moveTo(cx - 9, ry0 - 26); o.lineTo(cx, ry0 - 42); o.lineTo(cx + 9, ry0 - 26); o.fill();
      o.fillStyle = '#2a2420'; o.fillRect(cx - 3, ry0 - 18, 6, 8);
      o.fillStyle = '#d8c080'; o.fillRect(cx - 0.8, ry0 - 50, 1.6, 9); o.fillRect(cx - 3, ry0 - 47, 6, 1.6);
    }
    if (b.type === 'station') {
      o.fillStyle = '#3a4a5a'; o.fillRect(X - 30, Y + H - 2, W + 60, 6);
      o.fillStyle = 'rgba(0,0,0,0.25)'; o.fillRect(X - 30, Y + H + 4, W + 60, 2);
      g.fillStyle = '#4a3422'; for (let xx = X - 28; xx < X + W + 30; xx += 24) g.fillRect(xx, Y + H + 3, 2, 12);
    }
    if (b.type === 'property' && !b.owned) {
      g.fillStyle = '#5a3e26'; g.fillRect(X + W + 4, Y + H - 2, 1.5, 10);
      g.fillStyle = '#e0d0a0'; g.fillRect(X + W, Y + H - 8, 10, 6);
    }
  },

  /* Tahta perde (gerileyen kasabada kapanan bina): kapı ya da pencere boşluğu karanlık, aralıklı yatay tahtalar, üstünde
     çapraz bir tahta (kapıda iki çapraz: X) */
  boards(f, x, y, w, h, door) {
    f.fillStyle = '#140e0a'; f.fillRect(x, y, w, h);
    for (let yy = y + 0.6, k = 0; yy < y + h - 1.2; yy += 3.6, k++) {
      f.fillStyle = k % 2 ? '#6e5034' : '#82623f'; f.fillRect(x - 1, yy, w + 2, 2.3);
      f.fillStyle = 'rgba(0,0,0,0.35)'; f.fillRect(x - 1, yy + 1.9, w + 2, 0.5);
    }
    f.save(); f.lineWidth = 2.2; f.lineCap = 'butt';
    for (const s of door ? [1, -1] : [(x * 7 + y) % 2 ? 1 : -1]) {
      f.strokeStyle = '#3a2a1a'; f.beginPath(); f.moveTo(s > 0 ? x : x + w, y + 0.8); f.lineTo(s > 0 ? x + w : x, y + h - 0.2); f.stroke();
      f.strokeStyle = '#94724c'; f.lineWidth = 1.5; f.beginPath(); f.moveTo(s > 0 ? x : x + w, y + 0.5); f.lineTo(s > 0 ? x + w : x, y + h - 0.5); f.stroke(); f.lineWidth = 2.2;
    }
    f.restore();
  },

  /* ---------- Zengin şehrin binaları ----------
     Tuğla ya da kesme taş cephe, iki kat, kornişler, beyaz çerçeveli pencereler, çizgili tente,
     düz çatı ve korkuluk; tabela kapının üstünde koyu levha. */
  modernBuilding(g, o, b, world) {
    const d = b.def, X = b.x * TS, Y = b.y * TS, W = b.w * TS, H = b.h * TS;
    const FW = d.tall ? 40 : 32, wy = Y + H - FW, h = bHash(b, 5);
    const pal = MODERN_WALLS[Math.floor(bHash(b, 7) * MODERN_WALLS.length)];
    const MW = modernWall(b, pal), wallC = MW.c, brick = MW.brick;
    const f = b.enter ? o : g;
    g.fillStyle = 'rgba(0,0,0,0.32)'; g.fillRect(X + 6, Y + 4, W, H);
    // cephe ve dokusu
    f.fillStyle = wallC; f.fillRect(X, wy, W, FW);
    if (brick) {
      f.fillStyle = 'rgba(0,0,0,0.2)';
      for (let yy = wy; yy < Y + H; yy += 3) { f.fillRect(X, yy, W, 0.7); for (let xx = X + (((yy - wy) / 3) % 2) * 3; xx < X + W; xx += 6) f.fillRect(xx, yy, 0.8, 3); }
    } else {
      f.fillStyle = 'rgba(0,0,0,0.13)';
      for (let yy = wy; yy < Y + H; yy += 5) { f.fillRect(X, yy, W, 0.7); for (let xx = X + (((yy - wy) / 5) % 2) * 5; xx < X + W; xx += 10) f.fillRect(xx, yy, 0.7, 5); }
    }
    // kat arası ve üst korniş, alt kaide
    const mid = wy + FW - 19;
    f.fillStyle = '#e4dccb'; f.fillRect(X, mid, W, 2); f.fillRect(X - 1, wy, W + 2, 3);
    f.fillStyle = 'rgba(0,0,0,0.25)'; f.fillRect(X, mid + 2, W, 1); f.fillRect(X - 1, wy + 3, W + 2, 1);
    f.fillStyle = '#6a645c'; f.fillRect(X, Y + H - 3, W, 3);
    // kapı: çift kanat, üstünde camlı tepe penceresi
    const dx = b.door.x;
    f.fillStyle = '#e4dccb'; f.fillRect(dx - 6, Y + H - 17, 12, 17);
    f.fillStyle = '#2a1a12'; f.fillRect(dx - 5, Y + H - 15, 10, 15);
    f.fillStyle = '#4a2e1c'; f.fillRect(dx - 4.5, Y + H - 11, 4, 10); f.fillRect(dx + 0.5, Y + H - 11, 4, 10);
    f.fillStyle = '#7aa0b8'; f.fillRect(dx - 4.5, Y + H - 14.5, 9, 2.5);
    f.fillStyle = '#d8b850'; f.fillRect(dx - 1, Y + H - 6, 0.8, 1); f.fillRect(dx + 0.4, Y + H - 6, 0.8, 1);
    if (b.shut) this.boards(f, dx - 5, Y + H - 15, 10, 15, true);
    // pencereler: altta geniş vitrinler, üstte kemerli dar pencereler
    const shop = MODERN_SHOP.has(b.type), nWin = Math.max(2, Math.floor(b.w / 2.5));
    for (let k = 0; k < nWin; k++) {
      const cx = X + (k + 0.5) * W / nWin;
      // üst kat
      f.fillStyle = '#e4dccb'; f.fillRect(cx - 3.5, wy + 5, 7, 11);
      f.fillStyle = '#26384a'; f.fillRect(cx - 2.5, wy + 7, 5, 8); this.ell(f, cx, wy + 7, 2.5, 1.6, '#26384a');
      f.fillStyle = 'rgba(200,225,245,0.3)'; f.fillRect(cx - 2.5, wy + 7, 1.5, 8);
      f.fillStyle = '#e4dccb'; f.fillRect(cx - 0.4, wy + 7, 0.8, 8); f.fillRect(cx - 4, wy + 15.5, 8, 1.2);
      if (d.tall) { f.fillStyle = '#26384a'; f.fillRect(cx - 2.5, mid - 6, 5, 4); f.fillStyle = '#e4dccb'; f.fillRect(cx - 3, mid - 2, 6, 1); }
      // zemin kat
      if (Math.abs(cx - dx) < 11) continue;
      if (shop) {
        f.fillStyle = '#e4dccb'; f.fillRect(cx - 6, Y + H - 15, 12, 11);
        f.fillStyle = '#2a3e52'; f.fillRect(cx - 5, Y + H - 14, 10, 9);
        f.fillStyle = 'rgba(200,225,245,0.28)'; f.fillRect(cx - 5, Y + H - 14, 3, 9);
        f.fillStyle = '#e4dccb'; f.fillRect(cx - 0.4, Y + H - 14, 0.8, 9);
        // vitrinde mallar
        for (let q = 0; q < 3; q++) this.circ(f, cx - 3 + q * 3, Y + H - 6.5, 1, ['#c8a040', '#a0402a', '#d8d0c0'][(q + k) % 3]);
        if (b.shut) this.boards(f, cx - 5, Y + H - 14, 10, 9);
      } else {
        f.fillStyle = '#e4dccb'; f.fillRect(cx - 3.5, Y + H - 15, 7, 10);
        f.fillStyle = '#26384a'; f.fillRect(cx - 2.5, Y + H - 14, 5, 8);
        f.fillStyle = 'rgba(200,225,245,0.3)'; f.fillRect(cx - 2.5, Y + H - 14, 1.5, 8);
        if (b.shut) this.boards(f, cx - 2.5, Y + H - 14, 5, 8);
      }
    }
    // çizgili tente (dükkânlar) ya da düz saçak
    if (shop) {
      const ac = MODERN_AWN[Math.floor(h * MODERN_AWN.length)], ay = Y + H - 18;
      for (let xx = X - 1, k = 0; xx < X + W + 1; xx += 4, k++) { o.fillStyle = k % 2 ? '#efe8da' : ac; o.fillRect(xx, ay, Math.min(4, X + W + 1 - xx), 5); }
      o.fillStyle = 'rgba(0,0,0,0.18)'; o.fillRect(X - 1, ay + 4, W + 2, 1);
      for (let xx = X - 1, k = 0; xx < X + W + 1; xx += 4, k++) { o.fillStyle = k % 2 ? '#efe8da' : ac; o.beginPath(); o.arc(xx + 2, ay + 5, 2, 0, Math.PI); o.fill(); }
    } else {
      o.fillStyle = '#5a5650'; o.fillRect(X - 1, Y + H - 3, W + 2, 3);
    }
    // düz çatı, korkuluk ve baca
    const ry0 = Y - 8, rh = wy - ry0;
    o.fillStyle = '#4e5058'; o.fillRect(X - 2, ry0, W + 4, rh);
    o.fillStyle = 'rgba(0,0,0,0.12)'; for (let yy = ry0 + 5; yy < ry0 + rh; yy += 6) o.fillRect(X, yy, W, 1);
    o.fillStyle = '#d4ccbb'; o.fillRect(X - 2, ry0, W + 4, 2.5); o.fillRect(X - 2, ry0, 2.5, rh); o.fillRect(X + W - 0.5, ry0, 2.5, rh); o.fillRect(X - 2, ry0 + rh - 3, W + 4, 3);
    o.fillStyle = 'rgba(0,0,0,0.3)'; o.fillRect(X - 2, ry0 + rh, W + 4, 1);
    if (world && world.snowyTile(b.x + (b.w >> 1), b.y + (b.h >> 1))) { o.fillStyle = 'rgba(236,241,246,0.9)'; o.fillRect(X + 1, ry0 + 3, W - 2, rh - 6); }
    const chx = X + W * (0.18 + h * 0.6);
    o.fillStyle = '#7a3e2e'; o.fillRect(chx, ry0 + 4, 6, 10); o.fillStyle = '#3a2420'; o.fillRect(chx - 0.5, ry0 + 3, 7, 2);
    if (d.tall) { o.fillStyle = '#e4dccb'; o.fillRect(X + W / 2 - 10, ry0 - 6, 20, 7); o.fillStyle = '#4e5058'; o.fillRect(X + W / 2 - 8, ry0 - 4, 16, 4); }
    // tabela: kapının üstünde, kat arası kornişin altında koyu levha
    const txt = b.type === 'property' ? (b.owned ? 'HOME' : 'FOR SALE') : SIGN_TEXT[b.type];
    if (txt) {
      const sw = Math.min(W - 6, txt.length * 4.6 + 8);
      o.fillStyle = '#1e2a24'; o.fillRect(X + W / 2 - sw / 2, mid - 9, sw, 8);
      o.fillStyle = '#c8a850'; o.fillRect(X + W / 2 - sw / 2, mid - 9, sw, 0.8); o.fillRect(X + W / 2 - sw / 2, mid - 1.8, sw, 0.8);
      o.fillStyle = '#ead490'; o.font = 'bold 7px monospace'; o.textAlign = 'center'; o.textBaseline = 'middle';
      o.fillText(txt, X + W / 2, mid - 4.8);
    }
    if (b.type === 'property' && !b.owned) { g.fillStyle = '#5a3e26'; g.fillRect(X + W + 4, Y + H - 2, 1.5, 10); g.fillStyle = '#e0d0a0'; g.fillRect(X + W, Y + H - 8, 10, 6); }
    this.estateFront(o, b, wy);
  },
  /* Malikanenin iki kat yüksekliğindeki revaklı girişi (dört beyaz sütun, saçak, çatıya taşan üçgen alınlık, basamaklar) ve
     kulübün kapı saçağı ile iki yanındaki pirinç fenerler. Melez çizici de bu 2D çizimi keskinleştirerek kullanır. */
  estateFront(o, b, wy) {
    const Y = b.y * TS, H = b.h * TS, dx = b.door.x, top = wy + 3;
    if (b.type === 'mansion') {
      o.fillStyle = '#cfc8b8'; o.fillRect(dx - 18, Y + H - 1, 36, 3); o.fillStyle = '#bab2a2'; o.fillRect(dx - 15, Y + H + 2, 30, 2.5);
      o.fillStyle = 'rgba(0,0,0,0.18)'; o.fillRect(dx - 18, Y + H + 1.6, 36, 0.6);
      for (const cx of [dx - 21, dx - 12, dx + 12, dx + 21]) {
        o.fillStyle = 'rgba(0,0,0,0.2)'; o.fillRect(cx + 1.5, top + 5, 2.5, Y + H - top - 6);
        o.fillStyle = '#efe9dc'; o.fillRect(cx - 1.5, top + 4, 3, Y + H - top - 5);
        o.fillStyle = '#d4ccbc'; o.fillRect(cx + 0.6, top + 4, 0.9, Y + H - top - 5);
        o.fillStyle = '#f6f2e8'; o.fillRect(cx - 2.5, top + 3, 5, 1.6); o.fillRect(cx - 2.5, Y + H - 2.5, 5, 1.6);
      }
      o.fillStyle = '#e8e2d4'; o.fillRect(dx - 25, top, 50, 3.5);
      o.fillStyle = 'rgba(0,0,0,0.25)'; o.fillRect(dx - 25, top + 3.5, 50, 1);
      o.fillStyle = '#ece6d8'; o.beginPath(); o.moveTo(dx - 27, top + 0.5); o.lineTo(dx, top - 11); o.lineTo(dx + 27, top + 0.5); o.fill();
      o.fillStyle = '#d6cebe'; o.beginPath(); o.moveTo(dx - 21, top - 0.5); o.lineTo(dx, top - 8.5); o.lineTo(dx + 21, top - 0.5); o.fill();
      o.fillStyle = '#c8a040'; this.circ(o, dx, top - 3.5, 1.6, '#c8a040'); o.fillRect(dx - 3.5, top - 3.8, 7, 0.6);
    } else if (b.type === 'club') {
      o.fillStyle = '#1e3a2a'; o.fillRect(dx - 11, Y + H - 20, 22, 3.5);
      o.fillStyle = '#2e5a3e'; o.fillRect(dx - 11, Y + H - 20, 22, 1);
      o.fillStyle = '#c8a040'; o.fillRect(dx - 11, Y + H - 17, 22, 0.8);
      for (const lx of [dx - 10, dx + 10]) { o.fillStyle = '#2a2a2a'; o.fillRect(lx - 0.5, Y + H - 16, 1, 3); o.fillStyle = '#c8a040'; o.fillRect(lx - 1.5, Y + H - 13, 3, 4); o.fillStyle = '#ffe8a0'; o.fillRect(lx - 1, Y + H - 12.5, 2, 2.5); }
    }
  },
  /* Açık hava pazarı: tenteli tezgâhlar, sandıklarda mallar, ortada kemerli tabela */
  market(g, o, b, world) {
    const X = b.x * TS, Y = b.y * TS, W = b.w * TS, H = b.h * TS;
    g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(X + 4, Y + 4, W, H);
    g.fillStyle = '#b8ac96'; g.fillRect(X, Y, W, H);
    g.fillStyle = 'rgba(0,0,0,0.1)'; for (let yy = Y; yy < Y + H; yy += 8) g.fillRect(X, yy, W, 0.8);
    const n = 4, sw = W / n, goods = [['#c03a2a', '#d84a3a', '#a02a20'], ['#e8c850', '#d8b040', '#f0d870'], ['#8aa8b8', '#a8c0cc', '#6a8898'], ['#e06a8a', '#f0e070', '#b070d0']];
    const awn = ['#a83a2a', '#2e6a4a', '#2e4a7a', '#a8782a'];
    for (let k = 0; k < n; k++) {
      const sx = X + k * sw + 3, w = sw - 6;
      // tezgâh ve mallar
      g.fillStyle = '#6a4a2c'; g.fillRect(sx, Y + H - 22, w, 10); g.fillStyle = '#8a6440'; g.fillRect(sx, Y + H - 22, w, 2);
      for (let q = 0; q < 8; q++) this.circ(g, sx + 4 + (q % 4) * (w - 8) / 3, Y + H - 18 + (q >> 2) * 4, 1.6, goods[k][q % 3]);
      g.fillStyle = '#7a5434'; g.fillRect(sx + 2, Y + H - 10, 7, 6); g.fillRect(sx + w - 9, Y + H - 10, 7, 6);
      this.circ(g, sx + 5.5, Y + H - 10, 1.4, goods[k][1]); this.circ(g, sx + w - 5.5, Y + H - 10, 1.4, goods[k][0]);
      // direkler ve çizgili tente
      g.fillStyle = '#4a3422'; g.fillRect(sx, Y + 6, 1.5, H - 8); g.fillRect(sx + w - 1.5, Y + 6, 1.5, H - 8);
      for (let xx = sx - 2, q = 0; xx < sx + w + 2; xx += 4, q++) { o.fillStyle = q % 2 ? '#efe8da' : awn[k]; o.fillRect(xx, Y - 4, Math.min(4, sx + w + 2 - xx), H - 20); }
      o.fillStyle = 'rgba(0,0,0,0.16)'; for (let yy = Y; yy < Y + H - 24; yy += 6) o.fillRect(sx - 2, yy, w + 4, 1);
      for (let xx = sx - 2, q = 0; xx < sx + w + 2; xx += 4, q++) { o.fillStyle = q % 2 ? '#efe8da' : awn[k]; o.beginPath(); o.arc(xx + 2, Y + H - 24, 2, 0, Math.PI); o.fill(); }
      if (world && world.snowyTile(b.x + (b.w >> 1), b.y + (b.h >> 1))) { o.fillStyle = 'rgba(236,241,246,0.85)'; o.fillRect(sx - 2, Y - 4, w + 4, 6); }
    }
    // ortada kemerli tabela
    const cx = X + W / 2;
    o.fillStyle = '#4a3422'; o.fillRect(cx - 22, Y - 14, 2, 14); o.fillRect(cx + 20, Y - 14, 2, 14);
    o.fillStyle = '#1e2a24'; o.fillRect(cx - 21, Y - 18, 42, 9);
    o.fillStyle = '#c8a850'; o.fillRect(cx - 21, Y - 18, 42, 1);
    o.fillStyle = '#ead490'; o.font = 'bold 7px monospace'; o.textAlign = 'center'; o.textBaseline = 'middle'; o.fillText('MARKET', cx, Y - 13.4);
  },

  /* ---------- İnsan ---------- */
  human(ctx, x, y, ang, look, st) {
    ctx.save();
    ctx.translate(x, y);
    if (st.dead || st.lying) {
      // yerde yatan beden: ölü (kan gölü), yaralı ya da bağlı
      if (st.dead && !st.noPool) {
        // kan gölü yavaşça yayılır ve koyulaşır; kumda zamanla toprağa emilir
        const pk = st.pool === undefined ? 1 : st.pool, r = 3 + 6 * pk;
        this.ell(ctx, 2, 2, r * 1.1, r * 0.66, `rgba(${130 - 62 * pk | 0},10,10,${(0.5 + 0.2 * pk) * (1 - 0.7 * (st.soak || 0))})`);
      }
      else if (!st.noPool) this.shadow(ctx, 0, 1.5, 7, 3.4, 0.22);
      ctx.rotate(ang);
      this.ell(ctx, 0, 0, 5.5, 3.2, look.coat);
      ctx.fillStyle = look.pants; ctx.fillRect(-9, -2.4, 5, 1.8); ctx.fillRect(-9, 0.6, 5, 1.8);
      this.circ(ctx, 5.5, 0, 2.6, look.hat === 'none' ? look.hair : look.skin);
      if (st.tied) {
        // el ve ayak bileklerinde ip
        ctx.fillStyle = '#c8a870';
        ctx.fillRect(-8.2, -2.8, 1.2, 5.6); ctx.fillRect(-1.2, -3.5, 1.2, 7);
        ctx.fillStyle = '#8a6a3a'; ctx.fillRect(-8.2, -0.3, 1.2, 0.6); ctx.fillRect(-1.2, -0.3, 1.2, 0.6);
      }
      if (st.wriggle) { ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(6.5 + Math.sin(st.wriggle * 20), -0.4, 1.2, 0.8); }
      ctx.restore();
      return;
    }
    const [sdx, sl] = Juice.sun(6);
    this.shadow(ctx, 1 + sdx, 2.5, 6 * sl, 3.8, 0.3);
    ctx.rotate(ang);
    const cr = st.crouch ? 0.88 : 1;
    ctx.scale(cr, cr);
    // yürürken omuzlar adımla salınır: çocuk sekerek, sarhoş sendeleyerek, bastonlu yaşlı ağır ağır
    const mvk = st.riding ? 0 : Math.min(1, st.mv || 0), gs = st.gait;
    if (mvk > 0.05) {
      const ph = st.walk || 0;
      ctx.rotate(Math.sin(ph) * 0.06 * mvk * (gs === 'drunk' ? 3.5 : gs === 'kid' ? 1.5 : gs === 'cane' ? 1.4 : 1));
      if (gs === 'kid') { const b = 1 + Math.abs(Math.sin(ph)) * 0.06 * mvk; ctx.scale(b, b); }
      else if (gs === 'drunk') ctx.translate(0, Math.sin(ph * 0.5) * 1.3 * mvk);
    }
    if (st.anim === 'laugh') { const q = 1 + Math.abs(Math.sin((st.animT || 0) * 16)) * 0.05; ctx.scale(q, q); }
    const sw = Math.sin(st.walk || 0) * 2.8 * (st.mv || 0);
    if (!st.riding) {
      ctx.fillStyle = look.pants;
      ctx.fillRect(-1.5 + sw, -3.4, 4, 2.3); ctx.fillRect(-1.5 - sw, 1.1, 4, 2.3);
      ctx.fillStyle = '#231710';
      ctx.fillRect(2 + sw, -3.4, 1.6, 2.3); ctx.fillRect(2 - sw, 1.1, 1.6, 2.3);
    }
    // palto eteği
    if (look.coatLen) { ctx.fillStyle = shadeHex(look.coat, -0.12); ctx.beginPath(); ctx.ellipse(-2.2, 0, 2.6 + look.coatLen * 1.6, 4.6, 0, 0, TAU); ctx.fill(); }
    if (st.backGun) { ctx.strokeStyle = '#3a2618'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(-4, -4); ctx.lineTo(-1, 5); ctx.stroke(); }
    // gövde
    this.ell(ctx, 0, 0, 3.4, 5.3, look.coat);
    ctx.fillStyle = look.shirt; ctx.beginPath(); ctx.ellipse(1.8, 0, 1.3, 1.9, 0, 0, TAU); ctx.fill();
    const wk = st.wk;
    if (st.aim && wk) {
      ctx.strokeStyle = look.coat; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
      if (wk === 'long') {
        ctx.beginPath(); ctx.moveTo(0, -4.2); ctx.lineTo(7, -0.5); ctx.moveTo(0, 4.2); ctx.lineTo(3, 1.5); ctx.stroke();
        ctx.fillStyle = '#3a2618'; ctx.fillRect(-1, -0.2, 8, 2.4);
        ctx.fillStyle = '#2a2a2e'; ctx.fillRect(6, 0.2, 9, 1.4);
        this.circ(ctx, 7.2, -0.3, 1.2, look.skin); this.circ(ctx, 3.2, 1.6, 1.2, look.skin);
      } else if (wk === 'bow') {
        ctx.beginPath(); ctx.moveTo(0, -4.2); ctx.lineTo(8, 0); ctx.moveTo(0, 4.2); ctx.lineTo(2, 0.5); ctx.stroke();
        ctx.strokeStyle = '#6a4a28'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(6, 0, 6, -1.1, 1.1); ctx.stroke();
        ctx.strokeStyle = '#d8d0c0'; ctx.lineWidth = 0.5; ctx.beginPath(); ctx.moveTo(8.7, -5.3); ctx.lineTo(2 - (st.draw || 0) * 2, 0); ctx.lineTo(8.7, 5.3); ctx.stroke();
        this.circ(ctx, 8, 0, 1.2, look.skin);
      } else if (wk === 'throw') {
        ctx.beginPath(); ctx.moveTo(0, 4.2); ctx.lineTo(-2, 7); ctx.stroke();
        this.circ(ctx, -2, 7, 1.2, look.skin); ctx.fillStyle = '#c03020'; ctx.fillRect(-3, 7, 3, 1.4);
      } else if (wk === 'knife' || wk === 'fists') {
        ctx.beginPath(); ctx.moveTo(0, -4.2); ctx.lineTo(4 + (st.swing || 0) * 3, -2); ctx.moveTo(0, 4.2); ctx.lineTo(4, 2.5); ctx.stroke();
        this.circ(ctx, 4.5 + (st.swing || 0) * 3, -2, 1.3, look.skin); this.circ(ctx, 4.5, 2.5, 1.3, look.skin);
        if (wk === 'knife') { ctx.fillStyle = '#c8ccd0'; ctx.fillRect(5 + (st.swing || 0) * 3, -2.6, 4, 1); }
      } else {
        ctx.beginPath(); ctx.moveTo(0, -4.2); ctx.lineTo(6.5, 0); ctx.moveTo(0, 4.2); ctx.lineTo(6.5, 0.4); ctx.stroke();
        this.circ(ctx, 6.8, 0.2, 1.4, look.skin);
        ctx.fillStyle = '#2a2a2e'; ctx.fillRect(7, -0.5, 5, 1.5); ctx.fillStyle = '#5a3e26'; ctx.fillRect(6, 0.4, 2, 1.5);
      }
      ctx.lineCap = 'butt';
    } else if (st.riding) {
      this.circ(ctx, 3.5, -3.3, 1.5, look.coat); this.circ(ctx, 3.5, 3.3, 1.5, look.coat);
      this.circ(ctx, 5, -2.5, 1.1, look.skin); this.circ(ctx, 5, 2.5, 1.1, look.skin);
    } else if (st.swing) {
      ctx.strokeStyle = look.coat; ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.moveTo(0, 4.2); ctx.lineTo(5 + st.swing * 3, 1); ctx.stroke();
      this.circ(ctx, 5.5 + st.swing * 3, 1, 1.4, look.skin);
      if (wk === 'knife') { ctx.fillStyle = '#c8ccd0'; ctx.fillRect(6 + st.swing * 3, 0.5, 4, 1); }
      this.circ(ctx, -sw * 0.7, -4.8, 1.6, look.coat);
    } else if (st.hold === 'crate') {
      // iki eliyle önünde sandık taşır
      this.circ(ctx, 2, -4.2, 1.6, look.coat); this.circ(ctx, 2, 4.2, 1.6, look.coat);
      ctx.fillStyle = '#6a4626'; ctx.fillRect(3.4, -3.6, 5.4, 7.2);
      ctx.fillStyle = '#9a6e40'; ctx.fillRect(3.8, -3.2, 4.6, 6.4);
      ctx.fillStyle = '#6a4626'; ctx.fillRect(3.8, -0.4, 4.6, 0.8); ctx.fillRect(5.8, -3.2, 0.7, 6.4);
      this.circ(ctx, 3.6, -3.8, 1, look.skin); this.circ(ctx, 3.6, 3.8, 1, look.skin);
    } else if (st.anim && this.gesture(ctx, look, st, sw, 0)) {
      // jest çizildi
    } else if (gs === 'cane' && !st.hold) {
      // baston: sol kol sallanır, sağ el önde bastona dayanır
      this.circ(ctx, -sw * 0.7, -4.8, 1.7, look.coat); this.circ(ctx, -sw * 0.7 + 0.8, -5.2, 1, look.skin);
      const tip = 6.2 + Math.max(0, sw) * 0.6;
      ctx.strokeStyle = '#4a3220'; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.moveTo(3, 5.2); ctx.lineTo(tip, 6.2); ctx.stroke();
      this.circ(ctx, 1.6, 4.9, 1.6, look.coat); this.circ(ctx, 3, 5.2, 1, look.skin);
    } else {
      this.circ(ctx, -sw * 0.7, -4.8, 1.7, look.coat); this.circ(ctx, sw * 0.7, 4.8, 1.7, look.coat);
      this.circ(ctx, -sw * 0.7 + 0.8, -5.2, 1, look.skin); this.circ(ctx, sw * 0.7 + 0.8, 5.2, 1, look.skin);
      if (st.hasGun) { ctx.fillStyle = '#2a1c14'; ctx.fillRect(-1, 3.8, 3, 1.6); }
      if (st.hold === 'broom') {
        const k = Math.sin((st.walk || 0) * 0.5) * 1.5;
        ctx.strokeStyle = '#8a6a44'; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.moveTo(sw * 0.7 + 0.8, 5.2); ctx.lineTo(9, 7 + k); ctx.stroke();
        ctx.fillStyle = '#c8a860'; ctx.beginPath(); ctx.ellipse(9.6, 7.2 + k, 1.4, 2.4, 0.5, 0, TAU); ctx.fill();
      } else if (st.hold === 'paper') {
        ctx.fillStyle = '#d8d0bc'; ctx.fillRect(-2.2, 4.4, 4.6, 2.6);
        ctx.fillStyle = '#8a8478'; ctx.fillRect(-1.8, 5.2, 3.8, 0.4); ctx.fillRect(-1.8, 6, 3.8, 0.4);
      }
    }
    // kafa (boşta etrafa bakarken gövdeden bağımsız döner)
    if (st.head) ctx.rotate(st.head);
    const hc = look.hairNow || look.hair;
    const mk = look.mask;
    if (mk === 'bandana') {
      ctx.fillStyle = '#a8281f'; ctx.beginPath(); ctx.moveTo(1, -2.7); ctx.lineTo(1, 2.7); ctx.lineTo(6.2, 0); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#e8d8c0'; ctx.fillRect(4.6, -0.4, 0.8, 0.8);
    } else if (mk === 'sack') {
      this.ell(ctx, -4.4, 0, 1.8, 1.1, '#b89860'); ctx.fillStyle = '#6a4a28'; ctx.fillRect(-3.6, -1.4, 0.7, 2.8);
    }
    if (mk !== 'sack') this.hairTop(ctx, look, hc);
    if (mk === 'sack') { this.circ(ctx, 0, 0, 3.4, '#8a6a3a'); this.circ(ctx, 0, 0, 3, '#c8a870'); ctx.fillStyle = '#9a7a48'; ctx.fillRect(-2, -0.3, 1.2, 0.6); ctx.fillRect(-0.4, -2.2, 0.6, 1.2); ctx.fillStyle = '#1a1008'; ctx.fillRect(1.6, -1.7, 1.2, 1.1); ctx.fillRect(1.6, 0.6, 1.2, 1.1); }
    if (look.hat && look.hat !== 'none') {
      this.hatTop(ctx, look.hat, look.hatCol, st.hatK || 0);
      if ((st.hatK || 0) > 0.15) this.circ(ctx, 2.4, -3.2, 1.1, look.skin);   // şapkayı düzelten el
    } else if (mk !== 'sack') {
      if (look.hairStyle === 7) for (let i = 0; i < 7; i++) { const a = i / 7 * TAU; this.circ(ctx, Math.cos(a) * 2.6 - 0.3, Math.sin(a) * 2.6, 1.1, shadeHex(hc, i % 2 ? -0.2 : 0.05)); }   // kıvırcık
      this.circ(ctx, 0, 0, look.hairStyle === 7 ? 3.1 : 2.9, hc);
      if (look.hairStyle === 9 && look.sex !== 'f') this.ell(ctx, 1.2, 0, 1.3, 1.6, shadeHex(look.skin, -0.05));   // açık alın
      if (look.sex === 'f' && (look.hairStyle === 2 || look.hairStyle === 6)) { this.circ(ctx, -0.3, 0, look.hairStyle === 6 ? 1.7 : 1.4, shadeHex(hc, -0.25)); this.circ(ctx, -0.6, -0.4, 0.6, shadeHex(hc, 0.2)); }   // topuz
      this.ell(ctx, 1.9, 0, 1.2, 1.9, look.skin);
      if (mk === 'bandana') { this.ell(ctx, 2.2, 0, 1, 2.1, '#a8281f'); ctx.fillStyle = '#e8d8c0'; ctx.fillRect(2.4, -1, 0.6, 0.6); ctx.fillRect(2.4, 0.6, 0.6, 0.6); }
    }
    if (st.anim && !st.hold) this.gesture(ctx, look, st, sw, 1);   // yüze götürülen el, şapkadaki el
    ctx.restore();
  },
  /* Başın arkasında/omuzda kalan saç (üstten): uzun saç, at kuyruğu, ense topuzu, örgüler */
  hairTop(ctx, look, hc) {
    const hs = look.hairStyle | 0, f = look.sex === 'f';
    const long = f ? [0, 1, 4, 5, 7].includes(hs) : [1, 4, 7].includes(hs);
    if (long) this.ell(ctx, f ? -2.6 : -2.2, 0, f ? 2.3 : 1.9, f ? 2.6 : 2.4, hc);
    if (!f && hs === 2) this.ell(ctx, -3.4, 0, 1.3, 0.8, shadeHex(hc, -0.15));                 // at kuyruğu
    if (f && hs === 3) this.circ(ctx, -3, 0, 1.3, shadeHex(hc, -0.15));                        // ense topuzu
    const br = hs === 8 ? [-1] : f && hs === 9 ? [-1, 1] : [];                                    // örgüler omuzdan öne
    for (const k of br) for (let i = 0; i < 3; i++) this.circ(ctx, -1.6 + i * 1.3, k * (2.4 + i * 0.5), 0.75, shadeHex(hc, i % 2 ? -0.2 : 0));
  },
  /* Şapka, üstten: kenar, tepe, kasket siperi, kovboy çatısı. k = şapkayı düzeltme jesti (0–1) */
  hatTop(ctx, hat, col, k = 0) {
    const S = LOOKS.hatShape[hat] || LOOKS.hatShape.cowboy, c = hatColor(hat, col), br = S.br * (1 + k * 0.14);
    if (hat === 'bonnet') {
      this.ell(ctx, -0.8, 0, 3.6, 3.3, c); this.ell(ctx, 1.4, 0, 1.3, 2.9, shadeHex(c, 0.18)); this.ell(ctx, -1.4, 0, 2, 2.2, shadeHex(c, -0.2));
      return;
    }
    if (hat === 'cloche') {
      // çan şapka: dar kenar, başa oturan yuvarlak tepe, yanda kurdele fiyonku
      this.ell(ctx, 0.3 + k * 0.8, 0, br, br * 0.95, shadeHex(c, -0.18)); this.ell(ctx, -0.2, 0, 3, 2.85, c); this.ell(ctx, -0.8, -0.7, 1.3, 1.1, shadeHex(c, 0.22));
      ctx.fillStyle = shadeHex(c, -0.42); ctx.fillRect(-0.6, 2.1, 1.8, 1);
      return;
    }
    this.ell(ctx, k * 0.8, 0, br, br * 0.95, c);
    if (hat === 'flat') this.ell(ctx, 2.6, 0, 2, 2.6, shadeHex(c, -0.2));
    if (hat === 'fur') { this.ell(ctx, -0.2, 0, 3, 2.9, shadeHex(c, 0.12)); for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; this.circ(ctx, Math.cos(a) * 2.9, Math.sin(a) * 2.8, 0.7, shadeHex(c, i % 2 ? -0.25 : 0.2)); } return; }
    if (hat === 'top') { this.ell(ctx, -0.2, 0, 2.5, 2.4, shadeHex(c, 0.1)); this.ell(ctx, -0.6, -0.5, 1, 0.9, shadeHex(c, 0.35)); return; }
    this.ell(ctx, -0.2, 0, 2.7, 2.5, shadeHex(c, -0.28));
    if (hat === 'cowboy' || hat === 'wide' || hat === 'straw') { ctx.fillStyle = shadeHex(c, 0.25); ctx.fillRect(-0.8, -2.4, 1, 4.8); }
    if (hat === 'straw') { ctx.strokeStyle = shadeHex(c, -0.25); ctx.lineWidth = 0.3; ctx.beginPath(); ctx.ellipse(0, 0, br * 0.75, br * 0.72, 0, 0, TAU); ctx.stroke(); }
    if (hat === 'fedora') { ctx.fillStyle = shadeHex(c, -0.55); ctx.fillRect(-1.6, -0.35, 2.8, 0.7); }   // fötrün boyuna tepe çukuru
  },
  /* NPC jestleri, üstten görünüş (gövde çerçevesi: x ileri, y sağ).
     layer 0: kollar ve eldekiler (true dönerse varsayılan kollar çizilmez); layer 1: başın üstünde kalanlar */
  gesture(ctx, look, st, sw, layer) {
    const k = st.anim, t = st.animT || 0, C = look.coat, S = look.skin;
    if (st.hold || st.aim || st.riding) return false;
    const arm = (sd, hx, hy, ex, ey) => {
      ctx.strokeStyle = C; ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(0, sd * 4); if (ex !== undefined) ctx.lineTo(ex, ey); ctx.lineTo(hx, hy); ctx.stroke();
      ctx.lineCap = 'butt'; ctx.lineJoin = 'miter';
      this.circ(ctx, hx, hy, 1.1, S);
    };
    const down = (sd) => { this.circ(ctx, sd * sw * 0.7, sd * 4.8, 1.7, C); this.circ(ctx, sd * sw * 0.7 + 0.8, sd * 5.2, 1, S); };
    const cyc = (per, up) => { const u = t % per; return u < up ? Math.sin(u / up * Math.PI) : 0; };
    switch (k) {
      case 'smoke': {
        // önce kibritle yakar, sonra ara ara ağzına götürür; ucu kor gibi yanar
        if (t < 1.3) {
          if (layer === 1) { this.circ(ctx, 4.6, -0.8, 1.1, S); this.circ(ctx, 4.6, 0.8, 1.1, S); if (Math.sin(t * 40) > -0.3) { ctx.fillStyle = '#ffd060'; ctx.fillRect(5.3, -0.4, 0.9, 0.9); } }
          else { arm(-1, 4.6, -0.8); arm(1, 4.6, 0.8); }
          return true;
        }
        const r = cyc(6, 1.3), hx = 2.2 + r * 2.4, hy = 4.6 - r * 3.6;
        if (layer === 0) { down(-1); if (r < 0.35) arm(1, hx, hy); return true; }
        if (r >= 0.35) arm(1, hx, hy);
        ctx.fillStyle = '#e8e0d0'; ctx.fillRect(hx + 0.6, hy - 0.3, 1.6, 0.6);
        ctx.fillStyle = r > 0.8 ? '#ffb040' : '#d0602a'; ctx.fillRect(hx + 2.1, hy - 0.35, 0.7, 0.7);
        return true;
      }
      case 'drink': {
        const r = cyc(6.5, 1.5), hx = 1.4 + r * 3, hy = 5.4 - r * 4.6;
        if (layer === 0) { down(-1); if (r < 0.35) { arm(1, hx, hy); ctx.fillStyle = '#6a4a2a'; ctx.fillRect(hx - 0.4, hy - 0.9, 2.4, 1.8); } return true; }
        if (r >= 0.35) { arm(1, hx, hy); ctx.fillStyle = '#6a4a2a'; ctx.fillRect(hx + 0.3, hy - 0.8, 2.6, 1.6); ctx.fillStyle = '#c8a040'; ctx.fillRect(hx + 2.7, hy - 0.4, 0.6, 0.8); }
        return true;
      }
      case 'watch':
        if (layer === 1) return true;
        arm(-1, 5.4, -1.2); arm(1, 5.4, 1.2);
        this.circ(ctx, 6.3, 0, 1.3, '#d8b048'); this.circ(ctx, 6.3, 0, 0.8, '#f4ecd8');
        ctx.strokeStyle = '#c8a040'; ctx.lineWidth = 0.4; ctx.beginPath(); ctx.moveTo(6.3, 0); ctx.lineTo(2.5, 1.5); ctx.stroke();
        return true;
      case 'wave': if (layer === 0) { down(-1); arm(1, 4 + Math.sin(t * 13) * 1.1, 7.6, 1.5, 6.4); } return true;
      case 'cross':
        if (layer === 1) return true;
        arm(-1, 5.2, 2.2, 2.5, -4.6); arm(1, 5.2, -2.2, 2.5, 4.6);
        ctx.fillStyle = C; ctx.fillRect(4.4, -3, 1.8, 6);
        return true;
      case 'hips': if (layer === 0) { arm(-1, -1.4, -5.4, 0.8, -7.6); arm(1, -1.4, 5.4, 0.8, 7.6); } return true;
      case 'scratch':
        if (layer === 0) { down(-1); return true; }
        arm(1, -0.4 + Math.sin(t * 18) * 0.6, 3.2);
        return true;
      case 'stretch': { if (layer === 1) return true; const q = 0.85 + 0.15 * Math.sin(t * 2.2); arm(-1, 1.4, -9.8 * q); arm(1, 1.4, 9.8 * q); return true; }
      case 'shrug': if (layer === 0) { arm(-1, 3.6, -7.6, 0.8, -6.8); arm(1, 3.6, 7.6, 0.8, 6.8); } return true;
      case 'point': if (layer === 0) { down(-1); arm(1, 10.5, 2.6); } return true;
      case 'gesture':
        if (layer === 1) return true;
        arm(1, 5.4 + Math.sin(t * 6.3) * 1.3, 3.4 + Math.cos(t * 4.1) * 1.1);
        arm(-1, 5 + Math.sin(t * 4.7 + 1.3) * 1.1, -3.3 + Math.sin(t * 3.1) * 0.8);
        return true;
      case 'laugh': if (layer === 0) { arm(-1, 4.8, -1.7); arm(1, 4.8, 1.7); } return true;
      case 'fan':
        if (layer === 0) { down(-1); return true; }
        arm(1, 5.2, 1.4 + Math.sin(t * 14) * 1.6);
        return true;
      case 'rub': if (layer === 0) { const j = Math.sin(t * 18) * 0.5; arm(-1, 5.3, -0.9 + j); arm(1, 5.3, 0.9 + j); } return true;
      case 'read':
        if (layer === 1) return true;
        arm(-1, 5.4, -2.9); arm(1, 5.4, 2.9);
        ctx.fillStyle = '#d8d0bc'; ctx.fillRect(5.2, -3.6, 2.6, 7.2);
        ctx.fillStyle = '#8a8478'; ctx.fillRect(5.6, -3, 1.8, 0.4); ctx.fillRect(5.6, -1.6, 1.8, 0.4); ctx.fillRect(5.6, 0.2, 1.8, 0.4); ctx.fillRect(5.6, 1.8, 1.8, 0.4);
        return true;
      case 'tie': if (layer === 0) { arm(-1, 6.2, -1.3 + Math.sin(t * 9) * 0.4); arm(1, 6.2, 1.3); } return true;
      case 'hurry':
        if (layer === 0) return true;
        arm(-1, 0.6, -3.5); arm(1, 0.6, 3.5);
        return true;
      case 'pat': if (layer === 0) { down(-1); arm(1, 7.4 + Math.sin(t * 7) * 0.9, 1.8); } return true;
      case 'nod': return false;
    }
    return false;
  },

  /* ---------- Taşınan yük: post, ceset, leş ---------- */
  /* Katlanmış post (yerde ya da sırtta) */
  pelt(ctx, x, y, ang, col, big) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
    const w = big ? 7 : 5, h = big ? 4.6 : 3.4;
    this.ell(ctx, 0.8, 1.2, w, h, 'rgba(0,0,0,0.22)');
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(-w, -h * 0.6); ctx.quadraticCurveTo(0, -h * 1.2, w, -h * 0.6); ctx.lineTo(w * 0.9, h * 0.7); ctx.quadraticCurveTo(0, h * 1.1, -w * 0.9, h * 0.7); ctx.closePath(); ctx.fill();
    ctx.fillStyle = shadeHex(col, 0.18); ctx.fillRect(-w * 0.7, -h * 0.35, w * 1.4, h * 0.3);
    ctx.fillStyle = shadeHex(col, -0.3); ctx.fillRect(-w * 0.9, h * 0.25, w * 1.8, 0.8);
    ctx.fillStyle = '#c8a870'; ctx.fillRect(-w * 0.35, -h, 1, h * 2); ctx.fillRect(w * 0.3, -h, 1, h * 2);
    ctx.restore();
  },
  /* Yere düşmüş silah (üstten): x ekseni boyunca yatar, namlu +x yönünde. Ara ara namluda kısa bir parıltı
     görünür (yerdeki silah gözden kaçmasın); parıltının zamanı konuma göre kayar, yan yana iki silah aynı anda parlamaz. */
  gunDrop(ctx, x, y, ang, w, t = 0) {
    const W = WEAPONS[w] || {};
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
    const wood = '#5a3a22', woodL = '#7a5634', iron = '#2a2a2e';
    let gx = 0, gl = 0;   // parıltının başladığı yer ve uzunluğu (namlunun üst kenarı)
    if (w === 'knife') {
      this.ell(ctx, 0.4, 0.9, 4.6, 1.3, 'rgba(0,0,0,0.22)');
      ctx.fillStyle = '#3a2618'; ctx.fillRect(-4.2, -0.8, 3.2, 1.6);
      ctx.fillStyle = '#8a8a90'; ctx.fillRect(-1.2, -1.2, 0.8, 2.4);
      ctx.fillStyle = '#c8ccd0'; ctx.beginPath(); ctx.moveTo(-0.4, -0.8); ctx.lineTo(4, -0.5); ctx.lineTo(4.7, 0.2); ctx.lineTo(-0.4, 0.8); ctx.closePath(); ctx.fill();
      gx = 0.4; gl = 2.6;
    } else if (W.kind === 'bow') {
      this.ell(ctx, 0.5, 0.8, 2.6, 5.4, 'rgba(0,0,0,0.2)');
      ctx.strokeStyle = '#6a4a28'; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.arc(-3.2, 0, 6, -1.05, 1.05); ctx.stroke();
      ctx.strokeStyle = '#d8d0c0'; ctx.lineWidth = 0.5; ctx.beginPath(); ctx.moveTo(-0.1, -5.2); ctx.lineTo(-0.1, 5.2); ctx.stroke();
      ctx.fillStyle = '#3a2618'; ctx.fillRect(2, -0.9, 0.9, 1.8);
    } else if (W.kind === 'long') {
      const brl = w === 'rifle' ? 8.6 : w === 'winchester' ? 7.2 : w === 'shotgun' ? 6 : 6.6;
      this.ell(ctx, 0.6, 1.1, 5.4 + brl * 0.5, 1.9, 'rgba(0,0,0,0.22)');
      // dipçik
      ctx.fillStyle = wood; ctx.beginPath(); ctx.moveTo(-8.2, -1.5); ctx.lineTo(-2, -0.8); ctx.lineTo(-2, 0.9); ctx.lineTo(-8.2, 1.7); ctx.closePath(); ctx.fill();
      ctx.fillStyle = woodL; ctx.fillRect(-7.6, -1.1, 5, 0.6);
      ctx.fillStyle = '#1e1610'; ctx.fillRect(-8.4, -1.5, 0.7, 3.2);
      // mekanizma: Plainsman pirinç, öbürleri çelik
      ctx.fillStyle = w === 'winchester' ? '#b0903e' : '#4a4a52'; ctx.fillRect(-2.3, -1, 3.3, 2);
      if (w === 'shotgun') {
        // çift namlu
        ctx.fillStyle = iron; ctx.fillRect(1, -1, brl, 0.9); ctx.fillRect(1, 0.15, brl, 0.9);
        ctx.fillStyle = '#4a4a52'; ctx.fillRect(1, -0.1, brl, 0.25);
      } else {
        ctx.fillStyle = iron; ctx.fillRect(1, -0.5, brl, 1);
        ctx.fillStyle = woodL; ctx.fillRect(1, -0.7, Math.min(3.4, brl * 0.45), 1.4);   // ön kundak
      }
      if (w === 'repeater' || w === 'winchester') { ctx.strokeStyle = '#3a3a40'; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.arc(-1.2, 1.9, 0.9, 0, TAU); ctx.stroke(); }   // tetik kolu
      gx = 1.4 + brl * 0.4; gl = 1.8;
    } else {
      // tabanca: kabza, gövde ve topaç, namlu; Schofield nikel kaplama
      this.ell(ctx, 0.2, 1.1, 4.6, 1.8, 'rgba(0,0,0,0.22)');
      ctx.fillStyle = wood; ctx.beginPath(); ctx.moveTo(-1.5, -0.6); ctx.lineTo(-3.5, -0.3); ctx.lineTo(-3.9, 2.1); ctx.lineTo(-2.3, 2.4); ctx.closePath(); ctx.fill();
      ctx.fillStyle = woodL; ctx.fillRect(-3.3, 0.2, 0.8, 1.6);
      const st = w === 'schofield' ? '#9a9aa2' : '#4a4a52';
      ctx.fillStyle = st; ctx.fillRect(-1.9, -1.1, 2.7, 2);
      this.circ(ctx, -0.5, -0.1, 1.05, shadeHex(st, -0.25));
      ctx.fillStyle = iron; ctx.fillRect(0.6, -0.65, 3.6, 0.95);
      ctx.fillStyle = st; ctx.fillRect(3.9, -0.9, 0.4, 0.4);
      gx = 1; gl = 2.2;
    }
    // parıltı: ~3,4 sn'de bir, çeyrek saniye
    if (gl && ((t + x * 0.013 + y * 0.007) % 3.4) < 0.24) { ctx.fillStyle = 'rgba(255,248,226,0.9)'; ctx.fillRect(gx, -0.75, gl, 0.4); }
    ctx.restore();
  },
  /* Omuzda ya da eyerde taşınan varlık. (x, y) çizim merkezi, rot uzun eksenin açısı */
  /* Toptan mal: sandık, fıçı, çuval ya da balya (x, y merkez; üstten görünüş) */
  goods(ctx, x, y, g, sc = 1) {
    const G_ = GOODS[g], look = G_ ? G_.look : 'crate';
    ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc);
    ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.fillRect(-4, -2, 10, 7);
    if (look === 'barrel') {
      this.circ(ctx, 0, 0, 4.6, '#6a4424'); this.circ(ctx, 0, 0, 3.6, '#8a5a30');
      ctx.strokeStyle = '#3a2a1a'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.arc(0, 0, 4.6, 0, TAU); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, 2.2, 0, TAU); ctx.stroke();
    } else if (look === 'sack') {
      ctx.fillStyle = '#c8b48a'; ctx.beginPath(); ctx.ellipse(0, 0.5, 4.6, 3.6, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#a8946a'; ctx.fillRect(-1, -4, 2, 2);
      ctx.fillStyle = '#e0cfa4'; ctx.beginPath(); ctx.ellipse(-1.2, -0.5, 2.2, 1.4, 0, 0, TAU); ctx.fill();
    } else if (look === 'ties') {
      // travers demeti: üst üste iki kalın kalas
      for (let k = 0; k < 2; k++) { ctx.fillStyle = k ? '#7a5634' : '#6a4a2c'; ctx.fillRect(-6, 1 - k * 3.2, 12, 3); ctx.fillStyle = '#9a7448'; ctx.fillRect(-6, 1 - k * 3.2, 12, 0.9); }
      ctx.fillStyle = '#3a2a1a'; ctx.fillRect(-3, -2.4, 0.8, 6.4); ctx.fillRect(2.4, -2.4, 0.8, 6.4);
    } else if (look === 'bale') {
      ctx.fillStyle = '#8a6a8a'; ctx.fillRect(-4.5, -3, 9, 6); ctx.fillStyle = '#a888a8'; ctx.fillRect(-4.5, -3, 9, 1.6);
      ctx.fillStyle = '#4a3a2a'; ctx.fillRect(-2, -3, 0.8, 6); ctx.fillRect(1.6, -3, 0.8, 6);
    } else {
      ctx.fillStyle = '#7a5434'; ctx.fillRect(-4.5, -4, 9, 8); ctx.fillStyle = '#9a7048'; ctx.fillRect(-4.5, -4, 9, 1.8);
      ctx.strokeStyle = '#4a3020'; ctx.lineWidth = 0.7; ctx.strokeRect(-4.5, -4, 9, 8); ctx.beginPath(); ctx.moveTo(-4.5, -4); ctx.lineTo(4.5, 4); ctx.stroke();
      if (g === 'meds') { ctx.fillStyle = '#c02a20'; ctx.fillRect(-1, -2.4, 2, 5); ctx.fillRect(-2.5, -0.9, 5, 2); }
    }
    ctx.restore();
  },
  carried(ctx, e, x, y, rot, sc = 1) {
    if (e.kind === 'crate') { this.goods(ctx, x, y, e.g, sc * 1.25); return; }
    ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc);
    if (e.kind === 'npc') this.human(ctx, 0, 0, rot, e.look, { dead: e.dead, lying: true, tied: e.state === 'tied', noPool: true });
    else if (e.kind === 'pelt') this.pelt(ctx, 0, 0, rot, e.col, e.big);
    else if (e.kind === 'animal') {
      const o = { def: e.def, x: 0, y: 0, ang: rot, dead: true, noPool: true, phase: 0, mv: 0, male: e.male, look: e.look, skinned: false };
      this.animal(ctx, o);
    }
    ctx.restore();
  },
  /* Kement ipi: iki nokta arasında hafif sarkan çizgi */
  rope(ctx, x0, y0, x1, y1, slack) {
    const mx = (x0 + x1) / 2, my = (y0 + y1) / 2 + slack;
    ctx.strokeStyle = 'rgba(40,26,14,0.55)'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(x0, y0 + 0.6); ctx.quadraticCurveTo(mx, my + 0.6, x1, y1 + 0.6); ctx.stroke();
    ctx.strokeStyle = '#c8a870'; ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(mx, my, x1, y1); ctx.stroke();
  },

  /* ---------- At ---------- */
  horse(ctx, x, y, ang, look, st) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
    if (st.dead) {
      this.ell(ctx, 0, 3, 13, 7, 'rgba(110,10,10,0.5)');
      this.ell(ctx, 0, 0, 10, 5, look.col); this.ell(ctx, 11, 2, 4, 2, look.col);
      ctx.fillStyle = shadeHex(look.col, -0.3); for (let k = 0; k < 4; k++) ctx.fillRect(-6 + k * 4, 4, 1.6, 6);
      ctx.restore(); return;
    }
    { const [sdx, sl] = Juice.sun(12); ctx.save(); ctx.rotate(-ang); ctx.translate(sdx, 0); ctx.rotate(ang); this.ell(ctx, 2, 2.5, 13 * (0.8 + 0.2 * sl), 6, 'rgba(0,0,0,0.28)'); ctx.restore(); }
    // şahlanma: ön taraf yükselir (üstten bakınca kısalıp genişler), ön ayaklar havada
    const rk = st.rear || 0;
    if (rk) { ctx.translate(-9, 0); ctx.scale(1 + 0.08 * rk, 1 + 0.2 * rk); ctx.translate(9 + 2 * rk, 0); }
    const p = st.phase || 0, m = Math.min(1, st.mv || 0);
    const lc = shadeHex(look.col, -0.35);
    const legs = [[6, -3.4, 0], [6, 3.4, Math.PI], [-6, -3.4, Math.PI * 0.6], [-6, 3.4, Math.PI * 1.6]];
    for (const [lx, ly, ph] of legs) { const o = Math.sin(p + ph) * 3.2 * m + (lx > 0 ? rk * (2.5 + Math.sin(G.t * 18 + ly) * 1.2) : 0); this.ell(ctx, lx + o, ly, 2, 1.3, lc); ctx.fillStyle = '#1a1410'; ctx.fillRect(lx + o + 1.2, ly - 0.8, 1, 1.6); }
    ctx.strokeStyle = look.mane; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-9.5, 0); ctx.quadraticCurveTo(-13, Math.sin(p * 0.5) * 2 * m, -15, Math.sin(p) * 1.5 * m); ctx.stroke();
    this.ell(ctx, 0, 0, 10.5, 4.6, look.col);
    this.ell(ctx, -1, -1.2, 7, 1.8, shadeHex(look.col, 0.12));
    const nk = st.graze ? 0.5 : 0, hy = st.nod || 0;   // hy: baş sallama (yana)
    this.ell(ctx, 8.6, hy * 0.3, 4.2, 2.7, look.col);
    this.ell(ctx, 12.8 + nk * 2, hy, 3.6, 2, look.col);
    this.ell(ctx, 15.4 + nk * 2, hy * 1.2, 1.5, 1.6, shadeHex(look.col, -0.2));
    if (look.blaze) { ctx.fillStyle = '#f0ece4'; ctx.fillRect(12 + nk * 2, -0.5 + hy, 4, 1); }
    ctx.fillStyle = shadeHex(look.col, -0.2);
    ctx.beginPath(); ctx.moveTo(10.5, -1.2); ctx.lineTo(9.8, -3); ctx.lineTo(11.4, -1.6); ctx.fill();
    ctx.beginPath(); ctx.moveTo(10.5, 1.2); ctx.lineTo(9.8, 3); ctx.lineTo(11.4, 1.6); ctx.fill();
    ctx.strokeStyle = look.mane; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(4.5, 0); ctx.lineTo(11, 0); ctx.stroke();
    ctx.lineCap = 'butt';
    if (st.saddle) {
      ctx.fillStyle = look.blanket || '#8a2a20'; ctx.fillRect(-4.5, -4.6, 8, 9.2);
      ctx.fillStyle = '#5a3a20'; ctx.beginPath(); ctx.ellipse(-0.5, 0, 3.6, 3.8, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#3a2412'; ctx.fillRect(2.4, -0.8, 1.6, 1.6);
      if (st.bags) { ctx.fillStyle = '#6a4424'; ctx.fillRect(-7, -5.6, 3, 2); ctx.fillRect(-7, 3.6, 3, 2); }
    }
    ctx.restore();
  },

  /* ---------- Hayvanlar ---------- */
  animal(ctx, a) {
    const d = a.def, x = a.x, y = a.y;
    ctx.save(); ctx.translate(x, y); ctx.rotate(a.ang);
    const L = d.len, Wd = d.wid, c = d.col, c2 = d.col2;
    const p = a.phase || 0, m = a.dead ? 0 : Math.min(1, a.mv || 0);
    if (a.dead) {
      const pk = Math.min(1, (a.deadT || 0) / 5) * 0.6 + 0.4;
      if (!a.noPool) this.ell(ctx, 0, L * 0.1, L * 0.55 * pk, Wd * 0.9 * pk, `rgba(${125 - 50 * pk | 0},10,10,${0.5 * (1 - 0.7 * Juice.soak(a))})`);
    } else { const [sdx, sl] = Juice.sun(L * 0.5); ctx.save(); ctx.rotate(-a.ang); ctx.translate(sdx, 0); ctx.rotate(a.ang); this.ell(ctx, 1, 2, L * 0.55 * (0.85 + 0.15 * sl), Wd * 0.75, 'rgba(0,0,0,0.25)'); ctx.restore(); }
    const bodyC = a.skinned ? '#9a3a2a' : c;
    if (d.shape === 'snake') {
      ctx.strokeStyle = bodyC; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
      ctx.beginPath();
      for (let k = 0; k <= 10; k++) { const px = 6 - k * 1.6, py = Math.sin(p * 1.5 + k * 0.9) * 2.2 * (k / 10 + 0.3); k ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
      ctx.stroke(); ctx.strokeStyle = c2; ctx.lineWidth = 0.8; ctx.stroke();
      this.ell(ctx, 7, Math.sin(p * 1.5) * 0.6, 1.8, 1.3, bodyC);
      ctx.lineCap = 'butt'; ctx.restore(); return;
    }
    if (d.shape === 'gator') {
      ctx.fillStyle = bodyC;
      ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(8, -2.6); ctx.lineTo(-2, -4.5); ctx.lineTo(-10, -2); ctx.lineTo(-20 + Math.sin(p) * 1, Math.sin(p) * 2.5); ctx.lineTo(-10, 2); ctx.lineTo(-2, 4.5); ctx.lineTo(8, 2.6); ctx.closePath(); ctx.fill();
      ctx.fillStyle = c2; for (let k = 0; k < 6; k++) ctx.fillRect(-10 + k * 3.5, -0.6, 2, 1.2);
      const lo = Math.sin(p) * 2 * m;
      ctx.fillStyle = bodyC; ctx.fillRect(3 + lo, -7, 2, 3); ctx.fillRect(3 - lo, 4, 2, 3); ctx.fillRect(-6 - lo, -7, 2, 3); ctx.fillRect(-6 + lo, 4, 2, 3);
      this.circ(ctx, 9, -1.8, 0.7, '#e0d040'); this.circ(ctx, 9, 1.8, 0.7, '#e0d040');
      ctx.restore(); return;
    }
    if (d.shape === 'bird') {
      const lo = Math.sin(p * 1.4) * 1.5 * m;
      ctx.fillStyle = '#a07030'; ctx.fillRect(-1 + lo, -1.8, 2, 0.8); ctx.fillRect(-1 - lo, 1, 2, 0.8);
      this.ell(ctx, -2.5, 0, 2.6, Wd * 0.85, shadeHex(bodyC, -0.15));
      this.ell(ctx, 0, 0, L * 0.5, Wd * 0.62, bodyC);
      this.circ(ctx, L * 0.55, 0, 1.4, a.def === ANIMALS.chicken ? '#f0ece4' : '#6a4a3a');
      ctx.fillStyle = c2; ctx.fillRect(L * 0.55 + 0.6, -0.5, 1.5, 1);
      ctx.restore(); return;
    }
    if (d.shape === 'horse') {
      ctx.restore();
      this.horse(ctx, x, y, a.ang, { col: a.look ? a.look.col : c, mane: c2 }, { phase: p, mv: m, dead: a.dead });
      return;
    }
    if (d.shape === 'small') {
      this.ell(ctx, 0, 0, L * 0.6, Wd * 0.6, bodyC);
      this.ell(ctx, -L * 0.45, 0, 1.2, 1.2, c2);
      ctx.fillStyle = shadeHex(c, -0.2); ctx.fillRect(L * 0.1, -1.6, 2.6, 0.9); ctx.fillRect(L * 0.1, 0.7, 2.6, 0.9);
      this.circ(ctx, L * 0.45, 0, 1.4, bodyC);
      ctx.restore(); return;
    }
    // genel dört ayaklı
    const leg = shadeHex(c, -0.35);
    const lx = L * 0.32, ly = Wd * 0.42;
    for (const [px, py, ph] of [[lx, -ly, 0], [lx, ly, Math.PI], [-lx, -ly, Math.PI * 0.6], [-lx, ly, Math.PI * 1.6]]) {
      const o = Math.sin(p + ph) * L * 0.15 * m;
      this.ell(ctx, px + o, py, 1.6 * Wd / 5 + 0.6, 1.1, leg);
    }
    // kuyruk
    ctx.strokeStyle = d.tail ? c : (d.beh === 'hostile' || d === ANIMALS.fox || d === ANIMALS.coyote ? c : c2);
    ctx.lineWidth = (d === ANIMALS.fox || d === ANIMALS.wolf || d === ANIMALS.coyote) ? 2.4 : 1.2;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-L * 0.45, 0); ctx.lineTo(-L * 0.45 - (d.tail ? 8 : d.bear ? 1 : 4), Math.sin(p * 0.7) * (d.tail ? 2.5 : 1)); ctx.stroke();
    ctx.lineCap = 'butt';
    if (d === ANIMALS.fox) this.circ(ctx, -L * 0.45 - 4, Math.sin(p * 0.7), 1, '#f0e8e0');
    // gövde
    this.ell(ctx, 0, 0, L * 0.5, Wd * 0.5, bodyC);
    if (d.hump) this.ell(ctx, L * 0.15, 0, L * 0.3, Wd * 0.55, a.skinned ? bodyC : c2);
    if (!a.skinned) { ctx.fillStyle = shadeHex(c, 0.15); ctx.beginPath(); ctx.ellipse(-L * 0.05, 0, L * 0.35, Wd * 0.18, 0, 0, TAU); ctx.fill(); }
    if (d === ANIMALS.deer || d === ANIMALS.pronghorn || d === ANIMALS.elk) this.ell(ctx, -L * 0.45, 0, 1.4, 1.6, c2);
    // baş
    const hx = L * 0.5 + (d.bear ? 1.5 : 2.5), hr = d.bear ? Wd * 0.34 : Wd * 0.28;
    this.ell(ctx, hx - 1.5, 0, 2.5, hr * 0.8, bodyC);
    this.ell(ctx, hx, 0, hr * 1.3, hr, bodyC);
    this.ell(ctx, hx + hr * 1.1, 0, hr * 0.6, hr * 0.55, shadeHex(c, -0.25));
    ctx.fillStyle = shadeHex(c, -0.2);
    ctx.fillRect(hx - 1.5, -hr - 1, 1.6, 1.6); ctx.fillRect(hx - 1.5, hr - 0.6, 1.6, 1.6);
    if (d.antler && a.male) {
      ctx.strokeStyle = '#d8c8a0'; ctx.lineWidth = 0.9;
      const s = d.antler === 2 ? 1.5 : 1;
      for (const sg of [-1, 1]) {
        ctx.beginPath(); ctx.moveTo(hx - 1, sg * 1.5); ctx.lineTo(hx - 4 * s, sg * 6 * s); ctx.moveTo(hx - 2.5 * s, sg * 4 * s); ctx.lineTo(hx + 0.5, sg * 5.5 * s); ctx.moveTo(hx - 3.5 * s, sg * 5.3 * s); ctx.lineTo(hx - 6 * s, sg * 4 * s); ctx.stroke();
      }
    }
    if (d === ANIMALS.boar) { ctx.fillStyle = '#f0e8d8'; ctx.fillRect(hx + 1, -1.8, 1.5, 0.7); ctx.fillRect(hx + 1, 1.1, 1.5, 0.7); }
    if (d === ANIMALS.bison) { ctx.fillStyle = '#d8d0c0'; ctx.fillRect(hx - 1, -hr - 1.6, 1, 1.6); ctx.fillRect(hx - 1, hr, 1, 1.6); }
    if (d === ANIMALS.cow && !a.skinned) { this.circ(ctx, -2, -1, 1.8, c2); this.circ(ctx, 3, 1.5, 1.4, c2); }
    ctx.restore();
  },

  /* ---------- Tren ---------- */
  trainCar(ctx, x, y, ang, kind, t) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(-13, -4, 30, 13);
    if (kind === 'loco') {
      ctx.fillStyle = '#1e1c1c'; ctx.fillRect(-14, -6, 28, 12);
      ctx.fillStyle = '#2e2a2a'; ctx.fillRect(-4, -5, 17, 10);
      ctx.fillStyle = '#3a3434'; for (let k = 0; k < 3; k++) ctx.fillRect(-2 + k * 5, -5, 1, 10);
      ctx.fillStyle = '#6a1a14'; ctx.fillRect(-14, -6.5, 9, 13);
      ctx.fillStyle = '#2a2020'; ctx.fillRect(-13, -5, 7, 10);
      this.circ(ctx, 9, 0, 3, '#141212'); this.circ(ctx, 9, 0, 1.8, '#3a3030');
      ctx.fillStyle = '#b0302a'; ctx.beginPath(); ctx.moveTo(14, -6); ctx.lineTo(19, 0); ctx.lineTo(14, 6); ctx.fill();
      ctx.fillStyle = '#f0e0a0'; ctx.fillRect(13, -1.5, 2, 3);
      ctx.fillStyle = '#c8a040'; ctx.fillRect(1, -1, 5, 2);
    } else if (kind === 'tender') {
      ctx.fillStyle = '#2a2424'; ctx.fillRect(-12, -6, 24, 12);
      ctx.fillStyle = '#141010'; ctx.fillRect(-10, -4.5, 20, 9);
    } else {
      ctx.fillStyle = kind === 'freight' ? '#6a3a24' : '#3a4a3a'; ctx.fillRect(-13, -6, 26, 12);
      ctx.fillStyle = kind === 'freight' ? '#7a4a30' : '#4a5a48'; ctx.fillRect(-13, -6, 26, 4);
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(-13, 0, 26, 1);
      if (kind !== 'freight') { ctx.fillStyle = '#e8d890'; for (let k = 0; k < 4; k++) { ctx.fillRect(-10 + k * 6, -6.8, 3, 1); ctx.fillRect(-10 + k * 6, 5.8, 3, 1); } }
    }
    ctx.restore();
  },

  /* ---------- Otomobil (kuşbakışı; gövde çerçevesi: orta 0,0, x ileri, y sağ) ----------
     Tek tip: siyah, tenteli gezinti otomobili. Tekerlekler köşelerde, ön dingilin hemen üstünde pirinç radyatör ve iki
     yanında pirinç fenerler; iki yanı açıkta kalan uzun ince kaput, gövdeden taşan çamurluklar, aralarında basamaklar;
     sürücü tentenin altındadır. w.steer ön tekerleklerin dönüşü */
  motor(ctx, w) {
    const FA = 9.2, RA = -CAR_DIM.ra;   // ön ve arka dingil
    const blk = w.body || '#16161a', gloss = '#50505c', brass = '#c8a040', tire = '#0d0c0b';
    const R = (x, y, ww, hh, col) => { ctx.fillStyle = col; ctx.fillRect(x, y, ww, hh); };
    const rr = (x, y, ww, hh, r, col) => { ctx.fillStyle = col; ctx.beginPath(); ctx.roundRect(x, y, ww, hh, r); ctx.fill(); };
    this.shadow(ctx, 0.8, 1.6, CAR_DIM.len / 2 + 0.4, CAR_DIM.w / 2 + 0.6, 0.24);
    for (const sy of [-1, 1]) {
      const Y = (a, b) => Math.min(sy * a, sy * b);   // |y| a..b aralığının üst kenarı
      // ince, yüksek tekerlekler; dış yarıları çamurluğun dışında kalır. Ön tekerlekler direksiyonla döner (w.steer):
      // dönük ön lastik çamurluğun yanından eğik taşar
      for (const ax of [FA, RA]) {
        const front = ax === FA;
        ctx.save(); ctx.translate(ax, sy * (front ? 5.75 : 5.5)); if (front) ctx.rotate(w.steer || 0);
        R(-3, -0.65, 6, 1.3, tire); R(-0.5, -0.65, 1, 1.3, '#3a342c');
        ctx.restore();
      }
      // basamak (kaburgalı) ve çamurluklar
      R(-5.4, Y(4, 5.3), 11.2, 1.3, '#4a443a'); R(-5.4, Y(4.95, 5.3), 11.2, 0.35, '#8c8678');
      ctx.fillStyle = '#36312a'; for (let x = -4.8; x < 5.6; x += 1.6) ctx.fillRect(x, Y(4, 4.95), 0.6, 0.95);
      rr(5.6, Y(3.9, 5.3), 7.2, 1.4, 0.7, blk); R(6.4, Y(4.4, 4.8), 5.6, 0.4, gloss);
      rr(-12.2, Y(3.9, 5.5), 7.2, 1.6, 0.8, blk); R(-11.4, Y(4.5, 4.9), 5.6, 0.4, gloss);
    }
    // gövde ve kaputa daralan ön panel
    rr(-13, -4, 15.8, 8, 1.3, blk);
    ctx.fillStyle = blk; ctx.beginPath(); ctx.moveTo(2.6, -4); ctx.lineTo(4.6, -2); ctx.lineTo(4.6, 2); ctx.lineTo(2.6, 4); ctx.fill();
    // uzun, ince kaput: ortada parlak menteşe sırtı
    rr(4.4, -2, 6.2, 4, 0.4, '#202027'); R(4.6, -0.5, 5.8, 1, '#5c5c6a');
    // pirinç radyatör (ortada kapak) ve iki yanında pirinç fenerler
    rr(10.4, -2, 1.4, 4, 0.4, brass); R(10.5, -1.8, 1.1, 0.6, '#f2d878'); this.circ(ctx, 11.1, 0, 0.55, '#efe0a0');
    for (const sy of [-1, 1]) { this.circ(ctx, 11.7, sy * 3.5, 0.95, '#b8892e'); this.circ(ctx, 12.1, sy * 3.5, 0.5, '#f6eed6'); }
    // ön cam ve kumaş tente (dört kemerli)
    R(2.2, -3.9, 0.9, 7.8, '#aabec6');
    rr(-11.4, -4.2, 13.6, 8.4, 1.3, '#2b2825');
    ctx.fillStyle = '#433e37'; for (const x of [-9.6, -6.4, -3.2, 0]) ctx.fillRect(x, -4.1, 0.9, 8.2);
    R(-11.4, -3.7, 0.9, 7.4, '#1e1c19');
    // arka lamba (solda)
    this.circ(ctx, -13, -3, 0.6, '#b8402a');
  },
  /* Portre: js/portrait.js */
};
