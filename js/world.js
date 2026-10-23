'use strict';
/* ==========================================================
   FRONTIER'S END — dünya üretimi, parça (chunk) önbelleği, harita
   ========================================================== */

const TS = 16;            // bir karonun piksel boyutu
// dünya boyutu (karo): tek dünya; boyut sabit olduğundan sık döngülerdeki indeks hesabı sabitle yapılır
const WW = 3072, WH = 3072;
const CHUNK = 32;         // chunk başına karo
const CPX = CHUNK * TS;   // chunk piksel boyutu
const CN = WW / CHUNK;    // bir kenardaki chunk sayısı (chunk anahtarı: cy * CN + cx)
const CG = 4;             // kaba ızgara hücresi (karo)
const CW = WW / CG, CHH = WH / CG;
const FW = WW / 4;        // keşif (sis) ızgarası: 4x4 karo başına bir hücre
const MAPT = 256;         // yakın harita parçasının kenarı (karo)

const T = { DEEP: 0, WATER: 1, SAND: 2, DESERT: 3, DRY: 4, GRASS: 5, FOREST: 6, SWAMP: 7, MUD: 8, ROCK: 9, CLIFF: 10, SNOW: 11, ROAD: 12, TOWN: 13, FARM: 14, BRIDGE: 15, REDROCK: 16, MESA: 17, SNOWCLIFF: 18, PLANK: 19, HOTWATER: 20, COBBLE: 21, PAVE: 22 };
const TNAME = Object.keys(T);
/* Biyom sayılmayan zeminler (yol, kasaba, köprü, tarla, su): baskın biyom hesabında atlanır */
const AREA_NEUTRAL = new Set([T.DEEP, T.WATER, T.ROAD, T.TOWN, T.FARM, T.BRIDGE, T.PLANK, T.HOTWATER, T.COBBLE, T.PAVE]);
/* Taş zemin (zengin şehrin arnavut kaldırımı ve kaldırım taşları) */
const isStoneT = t => t === T.COBBLE || t === T.PAVE;
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
  { c: '#8a847c', v: 9, map: '#8a7c6c' },                       // COBBLE (arnavut kaldırımı)
  { c: '#b8ac96', v: 5, map: '#a4967e' },                       // PAVE (kaldırım taşı)
];
const TPAL = TINFO.map(t => hexToRgb(t.c));
/* Mevsim paletleri */
const SNOWFACE = hexToRgb('#8d949c');   // karlı uçurumun dikey yüzü: kaya
const CLTOP = hexToRgb('#8e877c'), MESATOP = hexToRgb('#a2654a');   // yayla tepeleri (uçurum ve mesa): yüzden açık
const SNOWC = hexToRgb('#e6ebf0'), SNOWM = hexToRgb('#d2dae0'), SNOWCL = hexToRgb('#b8c0c8'), ICE = hexToRgb('#b6ccd6'), LEAF2 = hexToRgb('#b8702c');
const SNOWABLE = new Uint8Array(32), LEAFY = new Uint8Array(32);
const AUT = [], SUM = [];
const isCliffT = t => t === T.CLIFF || t === T.MESA || t === T.SNOWCLIFF;
[T.GRASS, T.DRY, T.FOREST, T.ROCK, T.FARM, T.SAND, T.MUD, T.TOWN, T.ROAD, T.CLIFF, T.SWAMP, T.DESERT, T.REDROCK, T.COBBLE, T.PAVE].forEach(t => (SNOWABLE[t] = 1));
[T.GRASS, T.DRY, T.FOREST, T.FARM].forEach(t => (LEAFY[t] = 1));
const SEAS_VIVID = { aut: { GRASS: '#94883e', DRY: '#b89a52', FOREST: '#6e5a2c', FARM: '#8a6c34' }, sum: { GRASS: '#7a9040', DRY: '#bca45a', FOREST: '#4a6630', FARM: '#7a6a30' } };
/* Doğal ton: gerçeğe yakın, daha az doygun zemin renkleri (zeytin yeşili çimen, kum beji çöl, gözü almayan kar) */
const TONE_NAT = {
  DEEP: '#2e4a5a', WATER: '#436e78', SAND: '#d3c398', DESERT: '#d0a674', DRY: '#a99c62', GRASS: '#68874a', FOREST: '#45633a', SWAMP: '#4b5839', MUD: '#665138',
  ROCK: '#878075', CLIFF: '#5d554c', SNOW: '#d8dde2', ROAD: '#957c5a', TOWN: '#a28a66', FARM: '#6b6236', REDROCK: '#ac6b48', MESA: '#824d36', SNOWCLIFF: '#abb2ba', HOTWATER: '#589498',
};
const SEAS_NAT = { aut: { GRASS: '#8e8446', DRY: '#b09856', FOREST: '#6a5934', FARM: '#826a38' }, sum: { GRASS: '#72894a', DRY: '#b2a05e', FOREST: '#4a6338', FARM: '#746834' } };
/* Görüntü tonu: zemin paletini (mevsim renkleriyle birlikte) doğal ya da canlı seçer; çizilmiş chunk'lar yenilenmeli */
function setTerrainTone(natural) {
  TINFO.forEach((t, i) => { TPAL[i] = hexToRgb(natural && TONE_NAT[TNAME[i]] ? TONE_NAT[TNAME[i]] : t.c); });
  const S = natural ? SEAS_NAT : SEAS_VIVID;
  for (const k in S.aut) AUT[T[k]] = hexToRgb(S.aut[k]);
  for (const k in S.sum) SUM[T[k]] = hexToRgb(S.sum[k]);
}
setTerrainTone(true);
const isWaterT = t => t === T.DEEP || t === T.WATER || t === T.HOTWATER;
const SNOW_LINE = 0.6; // kışın bu sıcaklığın altı karla kaplanır

/* Nesneler */
const O = {
  NONE: 0, PINE: 1, OAK: 2, DEAD: 3, CACTUS: 4, SAGUARO: 5, BUSH: 6, ROCK: 7, BOULDER: 8, CYPRESS: 9, BIRCH: 10, SNOWPINE: 11, DRYBUSH: 12, REED: 13, FLOWERS: 14, TUFT: 15, APPLE: 16,
  BERRY: 20, GINSENG: 21, YARROW: 22, SAGE: 23, MINT: 24, OREGANO: 25, MILKWEED: 26, MUSHROOM: 27, WFLOWER: 28, ORE: 29, CROP: 30, ARTIFACT: 31,
  FENCEH: 40, FENCEV: 41, CRATE: 42, BARREL: 43, LAMP: 44, WELL: 45, TROUGH: 46, GRAVE: 47, CAMPFIRE: 48, TENT: 49, HAY: 50, SIGN: 51, WINDMILL: 52, CHEST: 53, POLE: 54,
  RUINWALL: 55, BONES: 56, WAGON: 57, HITCH: 58, BENCH: 59, BIGBONES: 60, SEQUOIA: 61, ARCH: 62, STEAM: 63, GALLOWS: 64, CROSS: 65, BOARD: 66, PUMP: 67, SHIP: 68,
  // iç mekân eşyaları
  COUNTER: 70, BAR: 71, TABLE: 72, PIANO: 73, CARDTABLE: 74, BED: 75, STOVE: 76, DESK: 77, CELL: 78, PEW: 79, ALTAR: 80, SAFE: 81, TUB: 82, BCHAIR: 83,
  RACK: 84, WORKBENCH: 85, STALL: 86, TICKET: 87, SHELF: 88, CHAIR: 89, PLANT: 90, HOMECHEST: 91, IBLOCK: 92, MANNEQUIN: 93,
  // otel: zemin katta yukarı çıkan merdiven, üst katta aşağı inen merdiven boşluğu, oda kapısı, lobi kanepesi
  STAIRS: 98, STAIRSD: 99, RDOOR: 100, SOFA: 101,
  // iç mekân: oturma, depolama, ocaklar, oyun masaları, zanaat ve süs eşyaları (bilardo ve rulet iki karo: sağında IBLOCK)
  ARMCHAIR: 102, BOOKCASE: 103, GCLOCK: 104, FIREPLACE: 105, CABINET: 106, SACKS: 107, COATRACK: 108, BILLIARD: 109, FORGE: 110, ANVIL: 111,
  OVEN: 112, VAT: 113, WARDROBE: 114, WASHSTAND: 115, PALM: 116, LECTERN: 117, ORGAN: 118, ROULETTE: 119, SADDLE: 120, BUST: 121, DISPLAY: 122,
  LAMPSTAND: 123, STOOL: 124, DRESSER: 125, TELEGRAPH: 126, SCALE: 127,
  LOTSIGN: 69,
  // zengin şehir: park ve meydan süsleri
  FOUNTAIN: 94, HEDGE: 95, FLOWERBED: 96, STATUE: 97,
};
const isFurnO = o => (o >= 70 && o <= 93) || (o >= 98 && o <= 127);
const SOLID_O = new Uint8Array(128);
[O.PINE, O.OAK, O.DEAD, O.CACTUS, O.SAGUARO, O.BOULDER, O.CYPRESS, O.BIRCH, O.SNOWPINE, O.APPLE, O.FENCEH, O.FENCEV, O.CRATE, O.BARREL, O.LAMP, O.WELL, O.TROUGH, O.TENT, O.HAY,
  O.SIGN, O.WINDMILL, O.POLE, O.RUINWALL, O.WAGON, O.HITCH, O.BIGBONES, O.SEQUOIA, O.GALLOWS, O.BOARD, O.PUMP, O.SHIP, O.LOTSIGN,
  O.COUNTER, O.BAR, O.TABLE, O.PIANO, O.CARDTABLE, O.BED, O.STOVE, O.DESK, O.CELL, O.PEW, O.ALTAR, O.SAFE, O.TUB, O.BCHAIR, O.RACK, O.WORKBENCH, O.STALL, O.TICKET,
  O.SHELF, O.PLANT, O.HOMECHEST, O.IBLOCK, O.MANNEQUIN, O.FOUNTAIN, O.HEDGE, O.STATUE, O.SOFA].forEach(o => (SOLID_O[o] = 1));   // otel merdiveninde yürünür; oda kapısı kapalıyken duvar bandı olur (buildingSolid)
for (let o = O.ARMCHAIR; o <= O.SCALE; o++) if (o !== O.STOOL) SOLID_O[o] = 1;   // bar taburesinin üstünden geçilir (sandalye gibi)
/* Gövdesi ince olan nesneler: tam kare yerine gövde boyutunda yuvarlak çarpışır (solid = 5) */
const TRUNK_O = new Uint8Array(128);
[O.PINE, O.OAK, O.DEAD, O.CACTUS, O.CYPRESS, O.BIRCH, O.SNOWPINE, O.APPLE, O.LAMP, O.POLE, O.SIGN, O.SAGUARO].forEach(o => (TRUNK_O[o] = 1));
const TRUNK_R = 3.6, TRUNK_DY = 9;   // gövde yarıçapı ve karo içindeki dikey konumu
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
/* Otelin üst katı (yerel karo; otel 10x8). Merdiven boşlukları zemin kattaki merdivenlerle aynı sütunlarda (1 ve 8,
   satır 1-3); ortada koridor, arkada iki, önde iki oda. Oda duvarları karo kenarındaki ince bantlardır (wall: karo başına
   çarpışma maskesi: 1 üst, 2 alt, 4 sol, 8 sağ); kapı karosunun bandı yalnızca kapı kapalıyken eklenir (side).
   area: odanın kapladığı karolar [x0, y0, x1, y1] (yatağa yalnızca odanın içinden uzanılır).
   Merdivenlerde yürünür: iki katta da merdivenin şeridi yan duvarla korkuluk arasıdır (sol merdivende karo 0'ın duvar
   dışı ve karo 1, sağda karo 8 ve karo 9'un duvar dışı) ve şeride yalnızca güney ucundan girilir (G.hotelStairsTick). */
const HOTEL_UP = {
  w: 10, h: 8, stairs: [1, 8],
  rooms: [
    { door: [3, 2], side: 2, bed: [2, 1], chair: [4, 1], area: [2, 1, 4, 2] },
    { door: [6, 2], side: 2, bed: [7, 1], chair: [5, 1], area: [5, 1, 7, 2] },
    { door: [2, 5], side: 1, bed: [1, 5], shelf: [4, 5], chair: [4, 6], area: [0, 5, 4, 7] },
    { door: [7, 5], side: 1, bed: [8, 5], shelf: [5, 5], chair: [5, 6], area: [5, 5, 9, 7] },
  ],
  wall: [[2, 1, 4], [2, 2, 4], [4, 1, 8], [4, 2, 8], [5, 1, 4], [5, 2, 4], [7, 1, 8], [7, 2, 8],
    [2, 2, 2], [4, 2, 2], [5, 2, 2], [7, 2, 2],
    [0, 5, 1], [1, 5, 1], [3, 5, 1], [4, 5, 1], [5, 5, 1], [6, 5, 1], [8, 5, 1], [9, 5, 1],
    [4, 5, 8], [4, 6, 8], [4, 7, 8], [5, 5, 4], [5, 6, 4], [5, 7, 4]],
};
/* Saint Clement'teki malikanenin üst katı (14x10): iki arka köşede merdiven boşluğu; arkada çalışma odası ve banyo, ortada
   iki sıra koridor, önde yatak odası ve misafir odası. Odaların eşyaları sabittir (items: [x, y, INT_KEY]); öndeki odalarda
   eşyalar duvar bandının bir sıra altındadır (bandın üstüne taşıp koridorda duruyormuş gibi görünmesin). İçeri yalnızca
   sahibi girdiği için bütün kapılar açıktır. */
const MANSION_UP = {
  w: 14, h: 10, stairs: [1, 12],
  rooms: [
    { n: 'Çalışma Odası', door: [4, 3], side: 2, area: [2, 1, 6, 3], items: [[2, 1, 'D'], [3, 1, '='], [5, 1, 'k'], [6, 1, 'k'], [6, 2, 'a'], [2, 3, 'Q']], rug: [2.4, 1.9, 3.4, 1.4, 'g', '#2a3a4a'] },
    { n: 'Banyo', door: [9, 3], side: 2, area: [7, 1, 11, 3], items: [[7, 1, 'j'], [8, 1, 'E'], [10, 1, 'U'], [11, 3, 'g']], rug: [8.3, 2.1, 2.6, 1.1, 'r', '#3a5a6a'] },
    { n: 'Yatak Odası', door: [3, 6], side: 1, area: [0, 6, 6, 9], items: [[1, 7, 'B'], [1, 8, '|'], [2, 8, 'H'], [5, 7, 'd'], [6, 7, 'E'], [5, 9, 'g'], [6, 9, 'a']], rug: [2.4, 7.2, 3.2, 1.7, 'o', '#5a1a24'] },
    { n: 'Misafir Odası', door: [10, 6], side: 1, area: [7, 6, 13, 9], items: [[7, 7, 'j'], [8, 7, 'E'], [11, 7, 'Q'], [12, 7, 'B'], [12, 8, '|'], [7, 9, 'a'], [8, 9, 'g']], rug: [8.4, 7.2, 3.2, 1.6, 'o', '#1e3a4a'] },
  ],
  wall: [[2, 1, 4], [2, 2, 4], [2, 3, 4], [11, 1, 8], [11, 2, 8], [11, 3, 8], [6, 1, 8], [6, 2, 8], [6, 3, 8], [7, 1, 4], [7, 2, 4], [7, 3, 4],
    [2, 3, 2], [3, 3, 2], [5, 3, 2], [6, 3, 2], [7, 3, 2], [8, 3, 2], [10, 3, 2], [11, 3, 2],
    [0, 6, 1], [1, 6, 1], [2, 6, 1], [4, 6, 1], [5, 6, 1], [6, 6, 1], [7, 6, 1], [8, 6, 1], [9, 6, 1], [11, 6, 1], [12, 6, 1], [13, 6, 1],
    [6, 6, 8], [6, 7, 8], [6, 8, 8], [6, 9, 8], [7, 6, 4], [7, 7, 4], [7, 8, 4], [7, 9, 4]],
};
/* Kulübün üst katı (14x10): merdiven yalnızca sağ arka köşede; arkada kart odası (yüksek bahisli poker), önde bilardo
   odası. Kapılar üyelere açık. */
const CLUB_UP = {
  w: 14, h: 10, stairs: [12],
  rooms: [
    { n: 'Kart Odası', door: [5, 3], side: 2, area: [0, 1, 11, 3], items: [[1, 1, 'i'], [4, 1, 'q'], [7, 1, 'k'], [10, 1, 'G'], [3, 2, 'P'], [8, 2, 'P'], [1, 3, 'Q']], rug: [2.3, 1.7, 7.4, 1.6, 'o', '#2a3a2a'] },
    { n: 'Bilardo Odası', door: [6, 5], side: 1, area: [0, 5, 13, 9], items: [[1, 6, 'r'], [12, 6, 'r'], [3, 7, 'l'], [4, 7, '='], [9, 7, 'l'], [10, 7, '='], [1, 8, 'a'], [12, 8, 'a'], [6, 9, 'Q'], [1, 9, 'G'], [12, 9, 'G']] },
  ],
  wall: [[0, 3, 2], [1, 3, 2], [2, 3, 2], [3, 3, 2], [4, 3, 2], [6, 3, 2], [7, 3, 2], [8, 3, 2], [9, 3, 2], [10, 3, 2], [11, 3, 2],
    [0, 5, 1], [1, 5, 1], [2, 5, 1], [3, 5, 1], [4, 5, 1], [5, 5, 1], [7, 5, 1], [8, 5, 1], [9, 5, 1], [10, 5, 1], [11, 5, 1], [12, 5, 1], [13, 5, 1]],
};
/* Zemin kattaki ara duvarlar (yerel karo, maske üst katınkiyle aynı): kulüpte okuma odası salondan ayrılır, aradaki geçit açık */
const FLOOR0_WALL = { club: [[5, 1, 8], [5, 2, 8], [5, 3, 8], [5, 4, 8], [5, 5, 8], [5, 7, 8], [5, 8, 8], [5, 9, 8]] };
/* İki katlı yapılar: tür → üst kat planı (bina o boyda olmalı) */
const UPPER = { hotel: HOTEL_UP, mansion: MANSION_UP, club: CLUB_UP };
const upPlan = (b) => { const P = b && UPPER[b.type]; return P && b.w === P.w && b.h === P.h ? P : null; };
/* Binanın o anki katındaki iç duvar bantları: üst katta odaların duvarları, zemin katta (varsa) ara duvar */
const floorWalls = (b) => { const UP = upPlan(b); return !UP ? [] : b.floor === 1 ? UP.wall : FLOOR0_WALL[b.type] || []; };
/* Üst katın ön duvar pencereleri (yerel piksel x): öndeki her odanın ortasında, geniş odada iki */
const upWins = (b) => {
  const out = [];
  for (const R of upPlan(b).rooms) if (R.side === 1) { const a = R.area[0], z = R.area[2] + 1, n = Math.max(1, Math.floor((z - a) / 5)); for (let k = 0; k < n; k++) out.push((a + (k + 0.5) * (z - a) / n) * TS); }
  return out;
};
const isHotel2 = b => !!b && b.type === 'hotel' && b.w === 10 && b.h === 8;   // iki katlı otel (bütün oteller 10x8; üst kat planı bu boya göre)
/* Üst kattaki oda açık mı: otelde yalnızca kiralanan oda; malikanede ve kulüpte hepsi (içeri yalnızca sahibi ve üyeleri girer) */
const roomOpen = (b, k) => b.type !== 'hotel' || b.openRoom === k;
/* Üst katta kilitli odaların (dolu ya da kiralanmamış) içi görünmez: odanın döşemesi (duvar bantlarının arası) ve arka
   odalarda arka duvarın odaya bakan yüzü karanlık bir tavanla örtülür. Binaya göre yerel piksel dikdörtgenleri [x, y, w, h]. */
const hotelShut = (b) => {
  const out = [], UP = upPlan(b);
  if (!UP || b.floor !== 1) return out;
  UP.rooms.forEach((R, k) => {
    if (roomOpen(b, k)) return;
    const A = R.area, back = R.side === 2, x0 = A[0] * TS + 5, x1 = (A[2] + 1) * TS - 5, y0 = back ? TS : A[1] * TS + 6, y1 = (A[3] + 1) * TS - 4;
    out.push([x0, y0, x1 - x0, y1 - y0]);
    if (back) out.push([A[0] * TS, 2, (A[2] - A[0] + 1) * TS, TS - 2]);
  });
  return out;
};

/* ---- İç mekân planları ----
   Her bina türünün standart (std) ve zengin şehirdeki (rich, Saint Clement) tasarımları. Plan, iç alanın karakter
   haritasıdır: sütunlar yan duvarların arası (yerel x 1..W-2), satırlar arka duvarın altından başlar (yerel y 1..H-2);
   en öndeki sıra (H-1) ve kapı sütununun son iki sırası yürüyüş yolu olarak boş kalır. Birden çok plan varsa bina
   konumuna göre biri seçilir (oyuncu yapılarında b.design). at: tezgâhtaki kişinin kesirli yeri (yoksa '@'),
   rug: halılar [x, y, gen, boy (karo), desen (o: işlemeli, r: yolluk, g: geometrik, c: kilise halısı), renk].
   Masa ve kart masasının iki yanı sandalyedir (boş kalmalı); bar taburesi barın önündedir. */
const INT_KEY = {
  C: O.COUNTER, R: O.BAR, K: O.TICKET, T: O.TABLE, P: O.CARDTABLE, p: O.PIANO, B: O.BED, S: O.STOVE, D: O.DESK, X: O.CELL, w: O.PEW, A: O.ALTAR,
  $: O.SAFE, U: O.TUB, Y: O.BCHAIR, r: O.RACK, W: O.WORKBENCH, L: O.STALL, s: O.SHELF, c: O.CHAIR, g: O.PLANT, H: O.HOMECHEST, M: O.MANNEQUIN,
  o: O.SOFA, a: O.ARMCHAIR, k: O.BOOKCASE, q: O.GCLOCK, F: O.FIREPLACE, i: O.CABINET, n: O.SACKS, h: O.COATRACK, l: O.BILLIARD, f: O.FORGE,
  v: O.ANVIL, O: O.OVEN, V: O.VAT, d: O.WARDROBE, j: O.WASHSTAND, G: O.PALM, y: O.LECTERN, z: O.ORGAN, e: O.ROULETTE, t: O.SADDLE, u: O.BUST,
  m: O.DISPLAY, Q: O.LAMPSTAND, 1: O.STOOL, E: O.DRESSER, '#': O.TELEGRAPH, '%': O.SCALE, x: O.CRATE, b: O.BARREL, Z: O.HAY, '~': O.TROUGH,
  '|': O.IBLOCK, '=': O.IBLOCK,
};
const INT_PLANS = {
  general: {
    std: [
      { m: ['s...@.%s', '.CCCCCC.', '........', 'n.m..cSc', 'xn.....b'], rug: [[2, 3.05, 6, 0.9, 'r', '#6a3a2a']] },
      { m: ['s@s..%ss', 'CCC.....', '.....s.s', 'n.m..s.s', 'xb.....n'], rug: [[1.2, 3.1, 3.4, 1.7, 'g', '#7a4a2a']] },
    ],
    rich: [{ m: ['i.s.@.si', '.CCCCCC.', '........', 'G.m..m.G', 'i.Q...Qi'], rug: [[2.6, 3.15, 4.8, 2.1, 'o', '#6a2430']] }],
  },
  saloon: {
    std: [
      { m: ['b.@......p', 'RRRRR.....', '1.1.1.....', '.......P.S', '.T........', '.......T..', 'g.T......g'], rug: [[5.6, 3.3, 4.6, 1.5, 'o', '#4a2418']] },
      { m: ['p......@.b', '.....RRRRR', '.....1.1.1', 'S.P.......', '........T.', '..T.......', 'g......T.g'], rug: [[1.4, 3.3, 3.4, 1.5, 'g', '#5a2a1a']] },
    ],
    rich: [
      { m: ['b.@...F..p', 'RRRRR.....', '1.1.1.....', '......l=..', '.T........', '.......P..', 'G.T......G'], rug: [[5.7, 3.25, 4.2, 1.6, 'o', '#5a1a24'], [5.9, 5.3, 3.8, 1.5, 'o', '#2a3a4a']] },
      { m: ['p..F...@.b', '.....RRRRR', '.....1.1.1', '..l=......', '........T.', '..P.......', 'G......T.G'], rug: [[1.4, 3.25, 4.2, 1.6, 'o', '#5a1a24'], [1.3, 5.3, 3.8, 1.5, 'o', '#2a3a4a']] },
    ],
  },
  sheriff: {
    std: [{ m: ['k@.rX.B', '.D=.X.|', 'bc..XXX', '.......', 'hww...S'], rug: [[1.2, 3.1, 3.2, 1.6, 'g', '#5a3a2a']] }],
    rich: [{ m: ['k@.kX.B', '.D=.X.|', 'qc..XXX', '.......', 'aaQ...S'], rug: [[1.1, 2.9, 3.4, 1.9, 'o', '#3a2430']] }],
  },
  doctor: {
    std: [{ m: ['i@s.jk', 'CCC..B', '.....|', 'cc....', 'g....i'], rug: [[1.2, 3.2, 2.6, 1.5, 'p', '#3a5a6a']] }],
    rich: [{ m: ['i@i.kk', 'CCC..B', 'j....|', 'aa....', 'G.Q..i'], rug: [[1, 3.15, 3.4, 1.9, 'o', '#2a4a5a']] }],
  },
  gunsmith: {
    std: [{ m: ['Wr.@.r', '.CCCC.', 'm....r', 'x....b'], rug: [[2, 3.05, 4, 0.9, 'r', '#5a3a24']] }],
    rich: [{ m: ['Wk.@.r', '.CCCC.', 'm....m', 'Q....G'], rug: [[1.9, 3.05, 4.2, 1.6, 'o', '#3a2a3a']] }],
  },
  butcher: {
    std: [{ m: ['W.@.%b', '.CCCC.', 'b....x', 'x....n'] }],
    rich: [{ m: ['W.@.%i', '.CCCC.', 'm....m', 'b....g'] }],
  },
  stable: {
    std: [{ m: ['ZL~.L.ZL.', '.L..L..L.', '.......@.', 'tt....CC.', 'b.n...x.b'] }],
    rich: [{ m: ['ZL~.L.~LZ', '.L..L..L.', '.......@.', 'tt.t..CC.', 'g.n...i.g'] }],
  },
  bank: {
    std: [{ m: ['D=.q...$', '...@....', '.CCCCCC.', '........', 'ww.....g', 'g......h'], rug: [[2.2, 4.1, 5.6, 1.6, 'p', '#2a4a3a']] }],
    rich: [{ m: ['D=.q.k.$', '...@....', '.CCCCCC.', '........', 'oo.....u', 'G..Q...G'], rug: [[2.4, 4.1, 5.2, 2.2, 'o', '#1e3a2e']] }],
  },
  station: {
    std: [{ m: ['i@.q....S', 'KKK..www.', '.........', 'xx...www.'], rug: [[5.6, 3.1, 4.2, 0.85, 'r', '#4a3a2a']] }],
    rich: [{ m: ['i@.q...GS', 'KKK..www.', '.........', 'xx...wwwG'], rug: [[5.6, 3.1, 4.2, 0.85, 'r', '#3a2430']] }],
  },
  church: {
    std: [{ m: ['z.A=.g', '....y.', '......', 'ww..ww', '......', 'ww..ww', '......', 'ww..ww'], at: [3.5, 2.1], rug: [[3.625, 1.625, 0.75, 8.1, 'c', '#8a2020']] }],
    rich: [{ m: ['z.A=.G', '.....y', 'u....u', 'ww..ww', '......', 'ww..ww', '......', 'ww..ww'], at: [3.5, 2.1], rug: [[3.5, 1.6, 1, 8.15, 'c', '#7a1420']] }],
  },
  land: {
    std: [{ m: ['@.k.s', 'D=...', '.c..i', 'g...h'], rug: [[1.1, 2.9, 3.2, 1.5, 'g', '#4a3a5a']] }],
    rich: [{ m: ['@.kqk', 'D=...', '.c..a', 'G...Q'], rug: [[1, 2.85, 3.6, 1.8, 'o', '#3a2a4a']] }],
  },
  barber: {
    std: [{ m: ['jE.Sj', 'Y@..Y', '.....', 'cc..h'], rug: [[1.6, 2.9, 3.8, 0.9, 'r', '#6a2a2a']] }],
    rich: [{ m: ['jE.ij', 'Y@..Y', '.....', 'aa..G'], rug: [[1.4, 2.85, 4.2, 1.3, 'o', '#5a1a24']] }],
  },
  tailor: {
    std: [{ m: ['s@.EMs', 'CCC...', '.....M', 'M....W'], rug: [[1.2, 3.1, 4.4, 1.5, 'g', '#5a3a5a']] }],
    rich: [{ m: ['i@.iMi', 'CCC...', '.....M', 'M.a.oo'], rug: [[1.1, 2.95, 4.6, 1.8, 'o', '#4a2440']] }],
  },
  fence: { std: [{ m: ['@.xbx', 'CC.xb', '....x', 'nb..x'] }] },
  mine: { std: [{ m: ['r@.%rx', 'CCC...', '.....x', 'b....n'] }] },
  lumber: { std: [{ m: ['rk....D=s', '.WWW.....', '.........', 'xx.....xb', 'xxn....xb'], at: [8, 2.2] }] },
  docks: {
    std: [{ m: ['xxn...@s', 'xb...CC.', 'n......b', 'xx....xb'] }],
    rich: [{ m: ['xxnk..@s', 'xb...CC.', 'n......b', 'xx.%..xb'], rug: [[2.4, 3.05, 4.6, 0.9, 'r', '#2a3a4a']] }],
  },
  ranch: { std: [{ m: ['S.D=.B', '.....|', '.T....', 'r....d'], at: [4, 2.2], rug: [[1.2, 2.6, 3.6, 1.7, 'g', '#6a4a2a']] }] },
  barn: { std: [{ m: ['ZZ.~.Z', 'Z...LZ', '....L.', 't.....', 'b.n..x'] }] },
  house: {
    std: [
      { m: ['B.SE', '|..T', 'j..a', 'd..g'], rug: [[1.3, 2.8, 3.3, 1.7, 'g', '#6a3a2a']] },
      { m: ['Sd.B', 'T..|', 'a..j', 'E..g'], rug: [[1.4, 2.8, 3.2, 1.7, 'g', '#4a3a5a']] },
      { m: ['BEFB', '|..|', 'T..a', 'c..g'], rug: [[1.5, 2.6, 3, 1.8, 'p', '#5a3a24']] },
    ],
    rich: [
      { m: ['B.FE', '|...', 'a..a', 'G..Q'], rug: [[1.2, 2.5, 3.6, 2, 'o', '#5a1a24']] },
      { m: ['kF.B', '...|', 'a..d', 'Q..G'], rug: [[1.2, 2.5, 3.4, 2, 'o', '#1e3a4a']] },
      { m: ['BqEB', '|..|', 'oo.a', 'G..p'], rug: [[1.1, 2.6, 3.8, 1.9, 'o', '#3a2a4a']] },
    ],
  },
  property: { std: [{ m: ['B.H.S', '|.T..', 'd...a', 'g...E'], rug: [[1.6, 2.7, 3.6, 1.8, 'g', '#7a4a2a']] }] },
  cabin: { std: [{ m: ['@.rS', 'CC..', 'x..b'] }] },
  hs_shack: {
    std: [
      { m: ['B.bH', '|...', 'j..c'] },
      { m: ['Hx.B', '...|', 'c..j'] },
      { m: ['H.ns', 'B...', '|..g'] },
    ],
  },
  hs_cabin: {
    std: [
      { m: ['BH.dS', '|....', 'a...T', 'g...j'], rug: [[1.6, 2.6, 2.8, 1.6, 'g', '#6a3a2a']] },
      { m: ['Ss.HB', '....|', 'T...a', 'j...g'], rug: [[1.6, 2.6, 2.8, 1.6, 'g', '#4a3a5a']] },
      { m: ['H.ksS', 'B....', '|...T', 'j...c'], rug: [[1.8, 2.3, 2.6, 1.8, 'p', '#5a3a24']] },
    ],
  },
  hs_house: {
    std: [
      { m: ['BBH.dES', '||.....', '.....T.', 'a......', 'g.....U'], rug: [[2.4, 2.6, 3.4, 2, 'g', '#6a3a2a']] },
      { m: ['Ss.dHBB', '.....||', '.T.....', '......a', 'Uj....g'], rug: [[2.2, 2.6, 3.6, 2, 'g', '#4a3a5a']] },
      { m: ['H.dS.Es', '....T..', 'B.....B', '|.....|', '.Uj...g'], rug: [[2.3, 3.1, 3.4, 1.9, 'p', '#5a3a24']] },
    ],
  },
  bakery: {
    std: [{ m: ['O.s@Wn', '.CCCC.', '.....n', 's.T..b'] }],
    rich: [{ m: ['O.i@Wn', '.CCCC.', '.....m', 'm.T..T'], rug: [[1.9, 3.05, 4.2, 0.9, 'r', '#5a3a24']] }],
  },
  smith: { std: [{ m: ['fb.W.rr', '.v...@.', '....CC.', 'nx....b'] }] },
  pharmacy: {
    std: [{ m: ['i@s.i', 'CCC..', '....s', 'g...m'], rug: [[1.1, 3.05, 3.4, 0.9, 'r', '#2a4a4a']] }],
    rich: [{ m: ['i@i.i', 'CCC..', '....i', 'G...m'], rug: [[1, 3, 3.6, 1.3, 'o', '#1e3a3a']] }],
  },
  laundry: {
    std: [{ m: ['@.S.UU', 'CC....', 'n...U.', 'xb...b'] }],
    rich: [{ m: ['@.S.UU', 'CC....', 'j...U.', 'Gb...j'] }],
  },
  gambling: {
    std: [{ m: ['b@.....gp', 'RRR......', '1.1..e=..', '.P.....P.', '.........', '.P.....P.'], rug: [[4.6, 2.6, 3.6, 2, 'o', '#3a1418']] }],
    rich: [{ m: ['b@..F..Gp', 'RRR......', '1.1..e=..', '.P.....P.', '.........', 'Ql=...l=Q'], rug: [[4.5, 2.55, 3.8, 2.1, 'o', '#4a1420'], [1.2, 3.6, 2.8, 1.8, 'o', '#1e2a3a'], [6.8, 3.6, 2.8, 1.8, 'o', '#1e2a3a']] }],
  },
  brewery: {
    std: [{ m: ['D=..V.V.V', '.........', '.....bbbb', 'nn.......', 'x......bb', 'xx.....W.'], at: [1.5, 2.2] }],
    rich: [{ m: ['D=.kV.V.V', '.........', '.....bbbb', 'nn.......', 'x......bb', 'xx.%...W.'], at: [1.5, 2.2] }],
  },
  mill: { std: [{ m: ['nn.%@.', 'n..CC.', '......', 'nn...x', 'Zb...x'] }] },
  county: {
    std: [{ m: ['..k.q.k$', 'D=...D=.', '........', '........', 'www..www', 'g......g'], at: [1.5, 1], rug: [[2.1, 3.1, 5.8, 1.7, 'p', '#3a3a5a']] }],
    rich: [{ m: ['..k.q.k$', 'D=...D=.', '........', 'u......u', 'www..www', 'G..Q...G'], at: [1.5, 1], rug: [[2.1, 3, 5.8, 1.9, 'o', '#2a2a4a']] }],
  },
  post: {
    std: [{ m: ['#@.n.s', 'CCCC..', '.....%', 'cc...x'], rug: [[1.1, 3.05, 4.4, 0.9, 'r', '#3a4a5a']] }],
    rich: [{ m: ['#@.n.i', 'CCCC..', '.....%', 'aG...x'], rug: [[1, 3, 4.6, 1.3, 'o', '#2a3a4a']] }],
  },
  warehouse: {
    std: [{ m: ['xxx.nn.xxx', 'bbb.nn.bbb', '..........', 'xx......@.', 'xn.....CC.', 'xx..%....b'] }],
    rich: [{ m: ['xxx.nn.xxx', 'bbb.nn.bbb', '..........', 'xx......@.', 'xn..k..CC.', 'xx..%..q.b'] }],
  },
  cantina: { std: [{ m: ['b@...b.g', 'RRR.....', '1.1.....', '......T.', '.T......', 'g.....P.'], rug: [[1.2, 4.1, 3.6, 1.6, 'g', '#a04a2a'], [5.4, 3.2, 3.4, 1.4, 'g', '#2a6a6a']] }] },
  /* Malikanenin zemin katı tek büyük salon: arkada şömine karşısında kanepe ve koltuklar, piyano, iki köşede merdiven;
     önde iki yemek masası, solda mutfak köşesi (ocak, kiler). Üst kat MANSION_UP. Yalnızca zengin şehirde: plan rich. */
  mansion: { rich: [{ m: ['..kq..F..p..', '............', '...a.ooo.a..', '............', '.Q........Q.', '..T......T..', 'Si...Q..Q..G', 'nb.......g.G'],
    rug: [[4.1, 2.1, 5.8, 2.8, 'o', '#5a1a24'], [1.8, 5.5, 3.4, 1.6, 'g', '#2a3a4a'], [8.8, 5.5, 3.4, 1.6, 'g', '#2a3a4a'], [6.15, 6.4, 1.7, 2.5, 'r', '#4a2418']] }] },
  /* Kulübün zemin katı: solda okuma odası (kitaplıklar, okuma masası, gazete kürsüsü), sağda puro ve konyak salonu (bar,
     şömine, koltuklar); aradaki duvarda geçit (FLOOR0_WALL). Merdiven sağ arka köşede; üst kat CLUB_UP. Plan rich. */
  club: { rich: [{ m: ['kk.kki@..F..', '.....RRR....', '.a.a.1.1....', '............', '.T......T...', '............', 'Q....a...a.G', 'y..g.....g.G'],
    rug: [[1.2, 2.4, 3.6, 3.2, 'g', '#2a3a2a'], [6.5, 4.4, 5, 2.2, 'o', '#3a1418']] }] },
};
/* ---- İnşa kademeleri: oyuncunun kendi kurduğu ev ve işletmelerin hazır tasarımları ----
   Satın alınan hazır yapılarda kullanılmaz. Her yapı türü için Ekonomik (eco), Normal (std), Gelişmiş (adv) ve Lüks (lux)
   planı vardır; plan biçimi INT_PLANS ile aynıdır. Kademe işlevi değiştirmez: türün işlevsel eşyaları (yatak, sandık,
   ocak, küvet, tezgâh, bar, kart masası...) her kademede bulunur, kademe eşya çeşidini, süsü, halıları, döşeme ve duvar
   kaplamasını (IntDeco) ve dış cepheyi belirler. Kurallar: kapı sütununun son iki sırası boş; tezgâhın arkasındaki kişiye
   ('@') ve her işlevsel eşyaya kapıdan yürünerek ulaşılır; masa ve kart masasının iki yanı boş (sandalyeler), iki masanın
   sandalyeleri aynı karoya düşmez ve kapı yoluna taşmaz; piyanonun önü (piyanist) boş. */
const TIER_PLANS = {
  hs_shack: {
    eco: { m: ['B.xH', '|...', 'b..n'] },
    std: { m: ['BH.j', '|...', 'c...'], rug: [[2.1, 2.1, 2.8, 1.6, 'g', '#6a3a2a']] },
    adv: { m: ['B.Hk', '|...', 'a..g'], rug: [[2, 2, 3, 1.8, 'p', '#5a3a24']] },
    lux: { m: ['BqHj', '|...', 'aQ.G'], rug: [[2, 2.05, 3, 1.8, 'o', '#5a1a24']] },
  },
  hs_cabin: {
    eco: { m: ['B.HxS', '|....', 'b....', 'n...x'] },
    std: { m: ['BH.cS', '|..T.', '.....', 'j...g'], rug: [[2.6, 1.6, 2.8, 1.6, 'g', '#6a3a2a']] },
    adv: { m: ['BHkdS', '|..T.', '.....', 'a...j'], rug: [[2.4, 1.6, 3, 1.7, 'p', '#5a3a24']] },
    lux: { m: ['BHFqS', '|..T.', 'a....', 'Go.aQ'], rug: [[1.6, 1.6, 3.8, 2.6, 'o', '#5a1a24']] },
  },
  hs_house: {
    eco: { m: ['BB.H.xS', '||.....', '..x....', 'b.....U', 'n......'] },
    std: { m: ['BdH..ES', '|......', 'B..T...', '|.....U', 'g.....j'], rug: [[2.6, 2.6, 3.8, 1.8, 'g', '#6a3a2a']] },
    adv: { m: ['BkH.dES', '|......', 'B..T.a.', '|.....U', 'a....jg'], rug: [[2.4, 2.5, 4.2, 2, 'p', '#5a3a24'], [2.2, 4.6, 2.4, 1.2, 'r', '#3a4a5a']] },
    lux: { m: ['BqHFdES', '|......', 'B..T...', '|a...aU', 'G.Q..jG'], rug: [[2.3, 2.3, 4.4, 2.4, 'o', '#5a1a24'], [2.6, 4.4, 3.8, 1.4, 'o', '#1e3a4a']] },
  },
  barber: {
    eco: { m: ['j...x', 'Y@..Y', '.....', 'c...b'] },
    std: { m: ['jE.sj', 'Y@..Y', '.....', 'cc.hc'], rug: [[1.6, 2.9, 3.8, 0.9, 'r', '#6a2a2a']] },
    adv: { m: ['jEqsj', 'Y@..Y', '.....', 'aa.hg'], rug: [[1.4, 2.85, 4.2, 1.3, 'g', '#5a2a3a']] },
    lux: { m: ['jEqij', 'Y@..Y', 'G...G', 'aa.Qa'], rug: [[1.4, 2.85, 4.2, 1.3, 'o', '#5a1a24']] },
  },
  laundry: {
    eco: { m: ['U.S..@', '....CC', 'U.....', 'xb...n'] },
    std: { m: ['UUS..@', '....CC', 'U.....', 'n.h..b'], rug: [[1.4, 3.1, 3.6, 0.9, 'r', '#3a5a6a']] },
    adv: { m: ['UjS..@', '....CC', 'U....U', 'cc..jg'], rug: [[1.6, 3.05, 3.6, 1.3, 'g', '#3a5a6a']] },
    lux: { m: ['UjU..@', '....CC', 'U...iG', 'aa..jG'], rug: [[1.6, 3.05, 3.4, 1.4, 'o', '#2a4a5a']] },
  },
  bakery: {
    eco: { m: ['O..@..', '.CCCC.', 'n.....', 'b....x'] },
    std: { m: ['OOs@..', '.CCCC.', '.T....', 's...nb'], rug: [[1.2, 3.1, 2.6, 1.6, 'g', '#7a4a2a']] },
    adv: { m: ['OOW@..', '.CCCC.', '.T....', 'm...mg'], rug: [[1.2, 3.1, 2.6, 1.6, 'p', '#5a3a24'], [3.6, 3.05, 2.8, 0.9, 'r', '#6a3a2a']] },
    lux: { m: ['OOW@..', '.CCCC.', '.T....', 'm.Q.mG'], rug: [[1.2, 3.05, 2.6, 1.7, 'o', '#5a1a24'], [3.6, 3.05, 2.8, 0.95, 'o', '#3a2a4a']] },
  },
  butcher: {
    eco: { m: ['W.@...', '.CCCC.', 'b.....', 'x...xn'] },
    std: { m: ['..@%Wr', '..CCCC', 'x.....', 'xb...n'], rug: [[1.2, 3.05, 4.6, 0.9, 'r', '#5a3a24']] },
    adv: { m: ['r.@%Wi', '..CCCC', 'm.....', 'm....b'], rug: [[2.1, 3.05, 4.6, 1.3, 'g', '#5a2a2a']] },
    lux: { m: ['i.@%Wi', '..CCCC', 'm....m', 'mQ...G'], rug: [[2.1, 3.05, 4.4, 1.6, 'o', '#5a1a24']] },
  },
  tailor: {
    eco: { m: ['x@..Es', 'CCC...', '.....M', 'b....W'] },
    std: { m: ['s@..ME', 'CCC...', 'M....M', 'h....W'], rug: [[1.2, 3.1, 4.4, 0.9, 'r', '#5a3a5a']] },
    adv: { m: ['k@..ME', 'CCC...', 'M....M', 'a.a..W'], rug: [[2.1, 3.05, 4, 1.6, 'g', '#5a3a5a']] },
    lux: { m: ['i@..Mi', 'CCC...', 'M...QM', 'oo..aG'], rug: [[1.1, 3.05, 4.8, 1.9, 'o', '#4a2440']] },
  },
  mill: {
    eco: { m: ['n.@..n', '.CC..n', '......', 'nn...x', 'Zb...x'] },
    std: { m: ['nn%.@.', 'n..CC.', '......', 'nnx..x', 'Zb...b'] },
    adv: { m: ['nnW@.s', 'n.CC..', '......', 'nnx...', 'Zb...b'], rug: [[2.4, 3.05, 3.4, 0.9, 'r', '#5a4a2a']] },
    lux: { m: ['nnW@.k', 'n.CC..', 'G....G', 'nnx..%', 'ZbQ..b'], rug: [[2.4, 3.05, 3.4, 1.4, 'o', '#3a2a24']] },
  },
  smith: {
    eco: { m: ['f.vW..r', '.....@.', '....CC.', 'nx.....'] },
    std: { m: ['fv.Wb.r', '.....@.', '....CC.', 'nxb...x'] },
    adv: { m: ['fvbWrr.', '.....@.', 'x...CC.', 'nb....b'], rug: [[1.2, 4.05, 3.4, 0.9, 'r', '#4a3a2a']] },
    lux: { m: ['fvbWrri', '.....@.', 'm...CC.', 'G....tQ'], rug: [[1.6, 3.05, 3.6, 1.6, 'o', '#3a2a24']] },
  },
  pharmacy: {
    eco: { m: ['x@..i', 'CCC..', '....b', 'n...x'] },
    std: { m: ['i@..s', 'CCC..', 's...s', 'c...m'], rug: [[1.1, 3.05, 3.4, 0.9, 'r', '#2a4a4a']] },
    adv: { m: ['i@..k', 'CCC..', 'a...m', 'g...m'], rug: [[1.9, 3.05, 2.6, 1.6, 'g', '#2a4a4a']] },
    lux: { m: ['i@..q', 'CCC..', 'i...m', 'aQ..G'], rug: [[1.9, 3, 2.6, 1.9, 'o', '#1e3a3a']] },
  },
  cantina: {
    eco: { m: ['b@...b.n', 'RRR.....', '1.1.....', '.....T..', '.T......', '......P.'] },
    std: { m: ['b@..p..g', 'RRR.....', '1.1.....', '.T....T.', '........', 'g.P....g'], rug: [[1.2, 3.6, 3.4, 1.8, 'g', '#a04a2a'], [5.6, 3.6, 3.2, 1.8, 'g', '#2a6a6a']] },
    adv: { m: ['b@..Fpqg', 'RRR.....', '1.1.....', '.T...T..', '......P.', 'a.P....g'], rug: [[1.2, 3.6, 3.4, 1.8, 'g', '#a04a2a'], [5, 3.6, 3.4, 2.6, 'g', '#2a6a6a']] },
    lux: { m: ['b@..Fp.G', 'RRR.....', '1.1.....', '.T..l=..', '......P.', 'G.P...QG'], rug: [[1.2, 3.6, 3.4, 1.8, 'o', '#a04a2a'], [4.6, 3.5, 3.8, 2.8, 'o', '#2a3a4a'], [2.2, 5.6, 2.6, 1.2, 'o', '#5a1a24']] },
  },
  stable: {
    eco: { m: ['ZL~.L..L.', '.L..L..L.', '.......@.', 't.....CC.', 'b.n....xb'] },
    std: { m: ['ZL~.L.ZL~', '.L..L..L.', '.......@.', 'tt....CC.', 'b.n....xb'] },
    adv: { m: ['ZL~.L~ZL~', '.L..L..L.', 't......@.', 'tt....CC.', 'b.n...h.b'], rug: [[6.4, 4.05, 3.2, 0.9, 'r', '#6a4a2a']] },
    lux: { m: ['ZL~.L~ZL~', '.L..L..L.', 'G......@.', 'tt.t..CC.', 'G.nQ..i.G'], rug: [[6.4, 4.05, 3.2, 1.3, 'o', '#5a2a24']] },
  },
  general: {
    eco: { m: ['s..@...x', '.CCCCC..', '........', 'n......b', 'xn......'] },
    std: { m: ['ss%@...s', '.CCCCC..', '........', 'n.m...ss', 'xb......'], rug: [[2, 3.05, 5, 0.9, 'r', '#6a3a2a']] },
    adv: { m: ['ss.@..ks', '.CCCC.%.', '........', 'm.m...ss', 'g.....xb'], rug: [[2, 3.05, 5, 1.3, 'g', '#7a4a2a']] },
    lux: { m: ['iq.@..ki', '.CCCC.%.', '........', 'm.m..m.G', 'G.Q...Qi'], rug: [[2, 3.05, 5.6, 1.9, 'o', '#6a2430']] },
  },
  saloon: {
    eco: { m: ['b.@....b.p', 'RRRRR.....', '1.1.1.....', '........P.', '.T........', '.......T..', 'b........b'] },
    std: { m: ['bb@...S..p', 'RRRRR.....', '1.1.1.....', '..T....P..', '..........', '.T.....T..', 'g........g'], rug: [[6.6, 3.4, 3.8, 1.6, 'o', '#4a2418']] },
    adv: { m: ['bb@...qF.p', 'RRRRR.....', '1.1.1.....', '.T....l=..', '..........', '..P....T..', 'g.......ag'], rug: [[6.4, 3.3, 3.6, 1.6, 'o', '#4a2418'], [1.2, 5.4, 3.6, 1.6, 'g', '#2a3a4a']] },
    lux: { m: ['bb@...GqFp', 'RRRRR.....', '1.1.1.....', '.P....l=..', '..........', '..P....T..', 'G.Q.....QG'], rug: [[6.3, 3.2, 3.8, 1.8, 'o', '#5a1a24'], [1.1, 3.2, 2.8, 1.6, 'o', '#2a3a4a'], [1.6, 5.4, 3.4, 1.8, 'o', '#5a1a24'], [6.6, 5.4, 3.4, 1.8, 'o', '#2a3a4a']] },
  },
  gambling: {
    eco: { m: ['b@......p', 'RRR......', '1.1......', '.P...e=..', '.........', '.P.....P.'] },
    std: { m: ['b@..qS.gp', 'RRR......', '1.1......', '.P..e=.P.', '.........', '.P.....P.'], rug: [[4.4, 3.3, 3.4, 1.6, 'o', '#3a1418']] },
    adv: { m: ['b@..qF.Gp', 'RRR......', '1.1......', '.P..e=.P.', '.....l=..', '.P.....P.'], rug: [[4.4, 3.3, 3.4, 1.6, 'o', '#3a1418'], [5.4, 4.6, 3.4, 1.6, 'o', '#1e2a3a']] },
    lux: { m: ['b@..qFGQp', 'RRR......', '1.1.....G', '.P..e=.P.', '.....l=..', '.P.....P.'], rug: [[4.3, 3.2, 3.6, 1.8, 'o', '#4a1420'], [5.3, 4.5, 3.6, 1.8, 'o', '#1e2a3a'], [1.1, 3.4, 2.8, 3.4, 'o', '#4a1420']] },
  },
  brewery: {
    eco: { m: ['D=..V...V', '.........', '.....bbb.', 'nn.......', 'x.......b', 'xx.....W.'], at: [1.5, 2.2] },
    std: { m: ['D=.V.V.V.', '.........', '.....bbbb', 'nn.......', 'xx.....bb', 'x.....W..'], at: [1.5, 2.2] },
    adv: { m: ['D=.V.V.Vk', '.........', '.....bbbb', 'nn.....%.', 'xx.....bb', 'x..h..W..'], at: [1.5, 2.2], rug: [[1, 2.4, 2.6, 1.4, 'g', '#5a3a24']] },
    lux: { m: ['D=qV.V.Vk', '.........', 'G....bbbb', 'nn.....%.', 'xx.Q...bb', 'x.....W.G'], at: [1.5, 2.2], rug: [[1, 2.4, 2.8, 1.5, 'o', '#3a2a24']] },
  },
};
/* Otel (iki katlı): merdivenler, resepsiyon ve oda düzeni sabit; kademe lobinin eşyalarını [yerel x, y, INT_KEY] ve üst
   kattaki kiralık odanın sandalye/raf yerindeki eşyayı belirler */
const HOTEL_TIER = {
  eco: { lobby: [[3, 1, 'x'], [6, 1, 'b'], [2, 5, 'T'], [7, 5, 'T'], [2, 6, 'c'], [7, 6, 'c'], [1, 6, 'b'], [8, 6, 'n']], room: { chair: 'c', shelf: 'x' } },
  std: { lobby: [[3, 1, 's'], [6, 1, 's'], [2, 5, 'T'], [7, 5, 'T'], [2, 6, 'o'], [3, 6, 'o'], [6, 6, 'o'], [7, 6, 'o'], [1, 6, 'g'], [8, 6, 'g']], room: { chair: 'c', shelf: 's' } },
  adv: { lobby: [[3, 1, 'k'], [6, 1, 'q'], [2, 5, 'T'], [7, 5, 'T'], [2, 6, 'o'], [3, 6, 'o'], [6, 6, 'o'], [7, 6, 'o'], [1, 6, 'G'], [8, 6, 'G']], room: { chair: 'c', shelf: 'E' } },
  lux: { lobby: [[3, 1, 'q'], [6, 1, 'k'], [2, 5, 'T'], [7, 5, 'T'], [2, 6, 'o'], [3, 6, 'o'], [6, 6, 'o'], [7, 6, 'o'], [1, 6, 'G'], [8, 6, 'G'], [4, 6, 'Q']], room: { chair: 'a', shelf: 'j' } },
};
/* Binanın kullandığı iç plan (eşya düzeni ve halılar): oyuncunun kurduğu yapıda kademe planı, öbürlerinde b.lay */
function planOfB(b) {
  const tp = b.tier && TIER_PLANS[b.type];
  if (tp) return tp[b.tier] || null;
  const pl = INT_PLANS[b.type], lay = b.lay || 's0', tier = pl && (lay[0] === 'r' ? pl.rich : pl.std);
  return tier ? tier[+lay.slice(1)] || null : null;
}
/* Zengin görünüm (yaldızlı süs, mermer tezgâh, aplikler): kademeli yapıda yalnızca Lüks, öbürlerinde zengin şehir */
const richB = (b) => b.tier ? b.tier === 'lux' : !!b.modern;

/* Ateşli eşyalar (şömine, ocak, fırın): içerideyken titreyen sıcak ışık verir */
const HEARTH_O = { [O.FIREPLACE]: 62, [O.FORGE]: 70, [O.OVEN]: 56 };

class World {
  constructor(seed) {
    this.seed = seed | 0;
    const N = WW * WH;
    this.tile = new Uint8Array(N);
    this.obj = new Uint8Array(N);
    this.solid = new Uint8Array(N);
    this.flags = new Uint8Array(N);   // 1: nesne yok, 2: ray, 4: kasaba, 8: bina, 16: iç mekân
    this.bid = new Int16Array(N).fill(-1); // karo -> bina
    this.dyn = [];   // hareketli engeller (göçebe çadırları) {x0,y0,x1,y1}
    this.heat = new Uint8Array(N);
    this.elev = new Uint8Array(N);
    this.buildings = [];
    this.bcell = new Uint8Array(CW * CHH);  // kaba hücre: 1 bina ya da çiftlik alanı (patikalar bunların etrafından dolanır)
    this.towns = [];
    this.pois = [];
    this.roads = [];
    this.rails = [];
    this.lines = [];
    this.lights = [];     // statik ışıklar {x,y,r,type}
    this.chests = new Map(); // idx -> {loot}
    this.signs = [];
    this.lots = [];
    this.cost = null;
    this.chunks = new Map();
    this.jobs = new Map();
    this.mapCanvas = null;
    this.harvested = new Map(); // idx -> gün
    this.season = 0;
  }
  idx(x, y) { return y * WW + x; }
  /* ---- Mevsimler ---- */
  /* Chunk önbelleğini boşalt (efekt kalitesi değişince) */
  refreshChunks() { this.chunks.clear(); this.jobs.clear(); if (typeof HY !== 'undefined') HY.flush(this); }
  setSeason(season, force) {
    if (this.season === season && !force) return false;
    this.season = season;
    this.chunks.clear(); this.jobs.clear();
    for (const b of this.buildings) b.cover = null;
    this.buildMapImage(true);
    return true;
  }
  /* Kış karı: sıcaklık haritasına göre (0 = yok, >0 = karlı), kenarlar gürültüyle yumuşak */
  snowAmt(i, n = 0) {
    if (this.season !== 3) return 0;
    return (SNOW_LINE - this.heat[i] / 255) * 7 + n;
  }
  snowyTile(tx, ty) {
    if (this.season !== 3 || !this.inb(tx, ty)) return false;
    return this.snowAmt(ty * WW + tx, (hash2(tx, ty, 71) - 0.5) * 0.8) > 0.25;
  }
  /* Yaprak döken ağaçların kışın çıplak kalıp kalmadığı */
  bareTree(tx, ty) { return this.season === 3 && this.inb(tx, ty) && this.heat[ty * WW + tx] / 255 < 0.7; }
  inb(x, y) { return x >= 0 && y >= 0 && x < WW && y < WH; }
  t(x, y) { return (x < 0 || y < 0 || x >= WW || y >= WH) ? T.DEEP : this.tile[y * WW + x]; }
  tileAtPx(px, py) { return this.t(px >> 4, py >> 4); }
  /* solid: 0 boş, 1 dolu, 3 kapı, 5 ağaç gövdesi (yuvarlak), 16+maske kısmi duvar (1 üst, 2 alt, 4 sol, 8 sağ bant) */
  isSolidPx(px, py) {
    const x = px >> 4, y = py >> 4;
    if (x < 0 || y < 0 || x >= WW || y >= WH) return true;
    const i = y * WW + x, s = this.solid[i];
    if (s < 2) return s === 1;
    if (s === 3) return !this.doorOpen(i);
    if (s === 5) { const dx = (px & 15) - 8, dy = (py & 15) - TRUNK_DY; return dx * dx + dy * dy < TRUNK_R * TRUNK_R; }
    const lx = px & 15, ly = py & 15;
    return ((s & 1) && ly < 6) || ((s & 2) && ly >= 12) || ((s & 4) && lx < 5) || ((s & 8) && lx >= 11);
  }
  doorOpen(i) { return this.doorFn ? this.doorFn(this.buildings[this.bid[i]]) : true; }
  indoorPx(px, py) { const x = px >> 4, y = py >> 4; return x >= 0 && y >= 0 && x < WW && y < WH && (this.flags[y * WW + x] & 16) !== 0; }
  buildingAtPx(px, py) {
    const x = px >> 4, y = py >> 4;
    if (x < 0 || y < 0 || x >= WW || y >= WH) return null;
    const i = y * WW + x;
    return (this.flags[i] & 16) ? this.buildings[this.bid[i]] : null;
  }
  blocked(px, py, r) {
    const D = this.dyn;
    if (D.length) for (let k = 0; k < D.length; k++) { const d = D[k]; if (px + r > d.x0 && px - r < d.x1 && py + r > d.y0 && py - r < d.y1) return true; }
    // köşe örneklemesi (gövde karoları hariç: onlar aşağıda daire–daire testiyle)
    const sp = (x, y) => { const s = this.solid[(y >> 4) * WW + (x >> 4)]; return s !== 5 && this.isSolidPx(x, y); };
    if (sp(px - r, py - r) || sp(px + r, py - r) || sp(px - r, py + r) || sp(px + r, py + r)) return true;
    // ağaç gövdeleri: köşe örneklemesi ince gövdeyi kaçırabilir, daire–daire testi yap
    const tx0 = (px - r - 4) >> 4, tx1 = (px + r + 4) >> 4, ty0 = (py - r - 12) >> 4, ty1 = (py + r) >> 4;
    const rr = (r + TRUNK_R) * (r + TRUNK_R);
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      if (tx < 0 || ty < 0 || tx >= WW || ty >= WH || this.solid[ty * WW + tx] !== 5) continue;
      const dx = px - (tx * TS + 8), dy = py - (ty * TS + TRUNK_DY);
      if (dx * dx + dy * dy < rr) return true;
    }
    return false;
  }
  isWaterPx(px, py) { return isWaterT(this.tileAtPx(px, py)); }
  biomeAt(px, py) { return TNAME[this.tileAtPx(px, py)]; }
  /* Çevrenin zemin karışımı: ±512 piksellik alandaki (yakını daha ağır) doğal zeminlerin oranları (toplamı 1)
     ve en çok görülen zemin. Hava, sıcaklık ve ekran rengi bunu kullanır; böylece kasabadaki
     küçük bir kum ya da kar lekesi havayı değiştirmez, bölge sınırlarında da geçiş yumuşak olur.
     64 piksellik hücre başına önbellekli. */
  areaInfo(px, py) {
    const key = (px >> 6) * 100003 + (py >> 6), C = this._areaC || (this._areaC = { key: null, mix: new Float32Array(TNAME.length), t: 0 });
    if (C.key === key) return C;
    const n = C.mix; n.fill(0);
    let sum = 0;
    // iki halka: yakın çevre (±256) ve daha geniş çevre (±512); kasaba ortasında da doğal zemin bulunur
    let nat = 0;
    const ring = (st) => { for (let j = -4; j <= 4; j++) for (let i = -4; i <= 4; i++) {
      if (st > 64 && Math.abs(i) <= 2 && Math.abs(j) <= 2) continue;
      const t = this.tileAtPx(px + i * st, py + j * st), w = i === 0 && j === 0 ? 2 : 1;
      if (!AREA_NEUTRAL.has(t)) { n[t] += w; sum += w; if (i || j) nat += w; } else sum += w * 0.35;   // nötr zemin oranları biraz seyreltir
    } };
    ring(64); ring(128);
    // baştan sona taş döşeli büyük şehir: iki halkada da doğal zemin yoksa daha geniş çevreye bak (ayak altındaki leke tek başına belirlemesin)
    if (nat < 3) ring(256);
    // çevre hâlâ nötrse (taş döşeli kıyı şehri) ayak altındaki tek leke bölgeyi belirlemez
    const t0 = this.tileAtPx(px, py);
    if (nat < 3 && !AREA_NEUTRAL.has(t0)) { n[t0] = Math.max(0, n[t0] - 2); sum -= 1.3; }
    let best = -1, bn = 0;
    for (let t = 0; t < n.length; t++) if (n[t] > bn) { bn = n[t]; best = t; }
    for (let t = 0; t < n.length; t++) n[t] /= sum;
    if (best < 0) best = AREA_NEUTRAL.has(t0) ? t0 : T.TOWN;
    C.key = key; C.t = best;
    return C;
  }
  areaTile(px, py) { return this.areaInfo(px, py).t; }
  /* Verilen zeminlerin alandaki toplam oranı (0-1) */
  areaFrac(px, py, ...ts) { const m = this.areaInfo(px, py).mix; let f = 0; for (const t of ts) f += m[t]; return f; }
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
  /* ---------------- kabartma: yumuşak yükselti ve eğim ----------------
     Yükselti karo başına tutulur (0-255). Oyunda 3x3 yumuşatılır, karo merkezleri arasında çift doğrusal değişir;
     eğim (birim/piksel) de karo merkezlerinde hesaplanıp aynı biçimde değişir: yamaç ışığında karo sınırı görünmez. */
  elevS(tx, ty) {
    const E = this.elev, mx = WW - 1, my = WH - 1;
    let s = 0;
    for (let j = -1; j <= 1; j++) {
      const y = ty + j, row = (y < 0 ? 0 : y > my ? my : y) * WW;
      for (let i = -1; i <= 1; i++) { const x = tx + i; s += E[row + (x < 0 ? 0 : x > mx ? mx : x)] * (i ? (j ? 1 : 2) : (j ? 2 : 4)); }
    }
    return s / 16;
  }
  /* Bir bölgenin karo ızgarası (tx0, ty0'dan tw x th karo): yumuşak yükselti E, eğim GX, GY */
  reliefGrid(tx0, ty0, tw, th) {
    const W2 = tw + 2, S = new Float32Array(W2 * (th + 2)), N = tw * th, E = new Float32Array(N), GX = new Float32Array(N), GY = new Float32Array(N);
    for (let j = 0; j < th + 2; j++) for (let i = 0; i < W2; i++) S[j * W2 + i] = this.elevS(tx0 + i - 1, ty0 + j - 1);
    for (let j = 0; j < th; j++) for (let i = 0; i < tw; i++) {
      const c = (j + 1) * W2 + i + 1, k = j * tw + i;
      E[k] = S[c]; GX[k] = (S[c + 1] - S[c - 1]) / (2 * TS); GY[k] = (S[c + W2] - S[c - W2]) / (2 * TS);
    }
    return { tx0, ty0, tw, th, E, GX, GY };
  }
  /* Tek bir noktanın yükseltisi ve eğimi (oynanış: yokuş, yükseklik); dizi açmaz, sonucu out'a yazar */
  reliefPt(px, py, out) {
    const fx = px / TS - 0.5, fy = py / TS - 0.5, tx = Math.floor(fx), ty = Math.floor(fy), u = fx - tx, v = fy - ty;
    out[0] = out[1] = out[2] = 0;
    for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) {
      const w = (i ? u : 1 - u) * (j ? v : 1 - v), x = tx + i, y = ty + j;
      out[0] += this.elevS(x, y) * w;
      out[1] += (this.elevS(x + 1, y) - this.elevS(x - 1, y)) / (2 * TS) * w;
      out[2] += (this.elevS(x, y + 1) - this.elevS(x, y - 1)) / (2 * TS) * w;
    }
    return out;
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
    await step(Tr('Topraklar şekilleniyor...'), 0.05);
    this.genTerrain();
    await step(Tr('Nehirler akıyor...'), 0.2);
    this.genRivers();
    await step(Tr('Kasabalar kuruluyor...'), 0.3);
    this.genTowns();
    this.buildCost();
    await step(Tr('Yollar açılıyor...'), 0.4);
    this.genRoads();
    await step(Tr('Raylar döşeniyor...'), 0.5);
    this.genRails();
    await step(Tr('Keşfedilecek yerler saklanıyor...'), 0.6);
    this.genPOIs();
    this.routeAroundBuildings();
    await step(Tr('Ormanlar büyüyor...'), 0.72);
    this.genObjects();
    this.clearDoorways();
    this.computeSolid();
    await step(Tr('Harita çiziliyor...'), 0.85);
    this.buildMapImage();
    await step(Tr('Hazır.'), 1);
  }

  genTerrain() {
    const s = this.seed;
    const n1 = new Noise(s + 1), n2 = new Noise(s + 2), n3 = new Noise(s + 3), n4 = new Noise(s + 4), n5 = new Noise(s + 5);
    const tile = this.tile, heatA = this.heat, elevA = this.elev;
    // büyük coğrafya (kıyı, sıradağ, iklim) dünyaya oranlı; göl, tepe, orman gibi ayrıntılar karo ölçeğinde
    // (k: ayrıntı gürültülerinin 1024 karoluk taban ölçeğe göre sıklığı)
    const k = WW / 1024;
    // gürültüler satır satır (Noise.row, fbm ile aynı değerler); x'e bağlı girdiler ve körfez kıyısı bir kez hesaplanır
    const row = () => new Float64Array(WW);
    const XE = row(), XM = row(), XT = row(), XH = row(), GULF = row(), E = row(), M = row(), TT = row(), HL = row();
    for (let x = 0; x < WW; x++) {
      const nx = x / WW;
      XE[x] = nx * 7 * k; XM[x] = nx * 5 * k + 3; XT[x] = nx * 4 * k; XH[x] = nx * 3 * k + 11;
      GULF[x] = 0.94 + (n4.v(nx * 7 * k, 3.3) - 0.5) * 0.06 / Math.sqrt(k);
    }
    for (let y = 0; y < WH; y++) {
      const ny = y / WH;
      const coastX = 0.915 + (n4.fbm(ny * 5 * k, 0.5, 3) - 0.5) * 0.09 / Math.sqrt(k);
      const ridgeX = 0.15 + (n4.fbm(ny * 2.2, 7.7, 3) - 0.5) * 0.16;
      n1.row(E, XE, ny * 7 * k, 5); n2.row(M, XM, ny * 5 * k, 4); n3.row(TT, XT, ny * 4 * k + 9, 3); n5.row(HL, XH, ny * 3 * k, 3);
      for (let x = 0; x < WW; x++) {
        const nx = x / WW;
        const i = y * WW + x;
        const e = E[x], m = M[x], tt = TT[x];
        // okyanus / körfez
        const gulfY = GULF[x];
        const coastD = Math.max(nx - coastX, (nx > 0.58 ? ny - gulfY : -1) * 1.0);
        // dağlar
        let ridge = Math.max(0, 1 - Math.abs(nx - ridgeX) * 7.5) * clamp((0.92 - ny) * 4, 0, 1);
        ridge = ridge * ridge * (3 - 2 * ridge);
        const north = Math.max(0, 1 - ny * 7);
        const hills = Math.max(0, HL[x] - 0.6) * 2.2;
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
          const mesa = n5.fbm(nx * 22 * k, ny * 22 * k, 3);
          if (heat > 0.7 && mesa > 0.68) t = T.MESA;
          else if (mesa > 0.58 || (heat > 0.78 && mesa > 0.5)) t = T.REDROCK;
          else t = T.DESERT;
        }
        else if (heat > 0.64 && moist > 0.72) t = (n2.v(nx * 90 * k, ny * 90 * k) > 0.72) ? T.WATER : (n3.v(nx * 60 * k, ny * 60 * k) > 0.75 ? T.MUD : T.SWAMP);
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
      while (target < pts.length && steps < 4 * WW) {
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
  /* Zengin şehrin parkı: çevresi çit, içi çimen; ortada çeşme, kaldırım taşından çapraz yollar,
     köşelerde ağaç, tarhlarda çiçek, yol kenarında bank ve fener. Ön (alt) kenarın ortası giriştir. */
  buildPark(bx, by, w, h, k, R, oget, oset, ground) {
    for (let yy = by - 1; yy <= by + h + 1; yy++) for (let xx = bx - 1; xx <= bx + w; xx++) {
      if (oget(xx, yy) === 3) continue;
      if (yy <= by + h) { oset(xx, yy, 2); ground(xx, yy); } else if (oget(xx, yy) !== 5) oset(xx, yy, 5);
    }
    const mx = bx + (w >> 1), my = by + (h >> 1);
    for (let yy = by; yy < by + h; yy++) for (let xx = bx; xx < bx + w; xx++) {
      const i = yy * WW + xx, edgeX = xx === bx || xx === bx + w - 1, edgeY = yy === by || yy === by + h - 1;
      this.flags[i] |= 1 | 4; this.obj[i] = 0;
      const gate = yy === by + h - 1 && Math.abs(xx - mx) <= 1;
      if ((edgeX || edgeY) && !gate) { this.tile[i] = T.GRASS; this.obj[i] = O.HEDGE; continue; }
      const path = Math.abs(xx - mx) <= 0 || yy === my;
      this.tile[i] = path || gate ? T.PAVE : T.GRASS;
    }
    // çeşme (ortada) ya da ikinci parkta heykel
    this.obj[my * WW + mx] = k === 0 ? O.FOUNTAIN : O.STATUE;
    // köşelerde ağaçlar, tarhlarda çiçekler
    const inner = [[bx + 2, by + 2], [bx + w - 3, by + 2], [bx + 2, by + h - 3], [bx + w - 3, by + h - 3]];
    for (const [x, y] of inner) if (!this.obj[y * WW + x] && this.tile[y * WW + x] === T.GRASS) this.obj[y * WW + x] = R.chance(0.5) ? O.OAK : O.BIRCH;
    for (let yy = by + 1; yy < by + h - 1; yy++) for (let xx = bx + 1; xx < bx + w - 1; xx++) {
      const i = yy * WW + xx;
      if (this.obj[i] || this.tile[i] !== T.GRASS) continue;
      const nearPath = Math.abs(xx - mx) === 1 || Math.abs(yy - my) === 1;
      if (nearPath && (xx + yy) % 3 === 0) this.obj[i] = O.FLOWERBED;
    }
    // yol kenarında banklar ve fenerler
    const put = (x, y, o) => { const i = y * WW + x; if (this.inb(x, y) && !this.obj[i] && this.tile[i] === T.GRASS) { this.obj[i] = o; return true; } return false; };
    put(mx - 2, my - 1, O.BENCH); put(mx + 2, my + 1, O.BENCH);
    for (const [x, y] of [[mx - 1, by + 1], [mx + 1, by + h - 2], [bx + 1, my - 1], [bx + w - 2, my + 1]]) if (put(x, y, O.LAMP)) this.lights.push({ x: x * TS + 8, y: y * TS + 2, r: 55, type: 'lamp' });
  }
  addBuilding(type, x, y, town, name, extra) {
    const def = BUILDINGS[type];
    const w = (extra && extra.w) || def.w, h = (extra && extra.h) || def.h;
    const b = { id: this.buildings.length, type, x, y, w, h, town: town ? town.id : null, name: name || (town ? town.n + ' ' + def.n : def.n), def };
    b.door = { x: (x + Math.floor(w / 2)) * TS + TS / 2, y: (y + h) * TS + 6 };
    if (town && town.modern) b.modern = 1;   // zengin şehrin tuğla ve taş cepheli binaları
    if (extra) Object.assign(b, extra);
    if (b.tier) b.modern = 0;   // oyuncunun kurduğu yapının görünümünü şehir değil, seçtiği kademe belirler
    b.enter = !def.noInt && w >= 5 && h >= 5;
    b.doorI = (y + h - 1) * WW + x + Math.floor(w / 2);
    this.buildings.push(b);
    this.markCells(x - 1, y - 1, x + w, y + h + 1, 1);
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) {
      if (!this.inb(xx, yy)) continue;
      const i = yy * WW + xx;
      this.flags[i] |= 8 | 1 | (b.enter ? 16 : 0); this.obj[i] = 0; this.bid[i] = b.id;
      if (this.tile[i] === T.DEEP || this.tile[i] === T.WATER) this.tile[i] = T.TOWN;
    }
    // veranda
    for (let xx = x; xx < x + w; xx++) if (this.inb(xx, y + h)) { const i = (y + h) * WW + xx; if (!(this.flags[i] & 8)) { this.tile[i] = richB(b) ? T.PAVE : T.PLANK; this.flags[i] |= 1; this.obj[i] = 0; } }   // zengin şehirde (ve lüks yapının önünde) taş kaldırım
    // pencereler -> gece ışıkları
    if (!def.ruin && type !== 'mineentrance') {
      const n = Math.max(1, Math.floor(w / 3));
      for (let k = 0; k < n; k++) this.lights.push({ x: (x + (k + 0.5) * w / n) * TS, y: (y + h) * TS - 8, r: 34, type: 'window', b: b.id });
    }
    if (def.light) this.lights.push({ x: (x + w / 2) * TS, y: y * TS - 10, r: 160, type: 'beacon' });
    if (b.enter) {
      const nl = w >= 10 ? 2 : 1;
      for (let k = 0; k < nl; k++) this.lights.push({ x: (x + (k + 0.5) * w / nl) * TS, y: (y + h * 0.45) * TS, r: Math.max(w / nl, h) * TS * 0.62, type: 'inner', b: b.id });
      this.furnish(b);
    }
    return b;
  }
  /* ---- Arsalar: oyun sırasında şantiye ve bina ---- */
  lotClear(lot) {
    for (let yy = lot.y; yy < lot.y + lot.h; yy++) for (let xx = lot.x; xx < lot.x + lot.w; xx++) {
      const i = yy * WW + xx;
      if (this.obj[i] !== O.LOTSIGN || !lot.keepSign) this.obj[i] = 0;
      if (this.tile[i] === T.DRY) this.tile[i] = T.TOWN;
    }
  }
  /* Satın alınmış, üzerinde inşaat süren arsa: tabela kalır, içeride kereste ve malzeme */
  lotSite(lot) {
    lot.keepSign = true; this.lotClear(lot); lot.keepSign = false;
    const put = (lx, ly, o) => { const i = (lot.y + ly) * WW + lot.x + lx; if (!this.obj[i]) this.obj[i] = o; };
    for (let lx = 0; lx < lot.w; lx++) put(lx, 0, O.FENCEH);
    put(1, 2, O.CRATE); put(2, 2, O.CRATE); put(lot.w - 3, 2, O.HAY); put(lot.w - 2, 3, O.BARREL); put(3, lot.h - 3, O.RUINWALL); put(lot.w - 4, lot.h - 3, O.RUINWALL);
    this.lotRefresh(lot);
  }
  /* Arsaya bina kur: bina arsanın ön kenarına oturur, ortalanır */
  buildOnLot(lot, type, tier) {
    const def = BUILDINGS[type], town = this.towns.find(t => t.id === lot.town);
    this.lotClear(lot);
    const bx = lot.x + ((lot.w - def.w) >> 1), by = lot.y + lot.h - def.h;
    const b = this.addBuilding(type, bx, by, town, undefined, tier ? { lot: lot.id, tier } : { lot: lot.id });
    town.buildings.push(b);
    lot.built = b;
    this.lotRefresh(lot);
    return b;
  }
  lotRefresh(lot) {
    const x0 = lot.x - 2, y0 = lot.y - 2, x1 = lot.x + lot.w + 2, y1 = lot.y + lot.h + 3;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      if (!this.inb(x, y)) continue;
      const i = y * WW + x;
      this.solid[i] = (TINFO[this.tile[i]].solid || SOLID_O[this.obj[i]] || (this.flags[i] & 8)) ? 1 : 0;
      if (this.solid[i] && TRUNK_O[this.obj[i]] && !TINFO[this.tile[i]].solid && !(this.flags[i] & 8)) this.solid[i] = 5;
    }
    if (lot.built && lot.built.enter) this.buildingSolid(lot.built);
    const t = this.towns.find(tw => tw.id === lot.town);
    if (t) t._grid = null;
    this.refreshChunks();
  }
  /* İç mekân yerleşimi: yerel karo koordinatları (0,0 sol üst; üst sıra arka duvar). Otelin kendi iki katlı planı
     vardır; diğer binalar INT_PLANS haritasından döşenir (zengin şehirde rich planı) */
  furnish(b) {
    const W = b.w, H = b.h, D = W >> 1, F = H - 2;
    const put = (lx, ly, o) => { if (lx < 1 || lx > W - 2 || ly < 1 || ly > F) return; const i = (b.y + ly) * WW + b.x + lx; this.obj[i] = o; };
    const row = (ly, x0, x1, o) => { for (let lx = x0; lx <= x1; lx++) put(lx, ly, o); };
    const bed = (lx, ly) => { put(lx, ly, O.BED); put(lx, ly + 1, O.IBLOCK); };
    const at = (lx, ly) => ({ x: (b.x + lx) * TS + 8, y: (b.y + ly) * TS + 8 });
    b.staff = null; b.seats = [];
    if (b.type === 'hotel') {
      if (isHotel2(b)) {
        // lobi: resepsiyon girişin karşısında, binanın tam ortasında; iki arka köşede üst kata merdiven; önde iki oturma köşesi
        // (oyuncunun kurduğu otelde lobinin eşyaları kademeye göre)
        for (let ly = 1; ly <= 3; ly++) { put(1, ly, O.STAIRS); put(W - 2, ly, O.STAIRS); }
        row(2, 3, W - 4, O.COUNTER); b.staff = at(W / 2 - 0.5, 1);
        const HT = b.tier && HOTEL_TIER[b.tier];
        if (HT) for (const [lx, ly, ch] of HT.lobby) put(lx, ly, INT_KEY[ch]);
        else {
          put(3, 1, O.SHELF); put(W - 4, 1, O.SHELF);
          put(2, F - 1, O.TABLE); put(W - 3, F - 1, O.TABLE);
          put(2, F, O.SOFA); put(3, F, O.SOFA); put(W - 4, F, O.SOFA); put(W - 3, F, O.SOFA);
          put(1, F, O.PLANT); put(W - 2, F, O.PLANT);
        }
      } else { row(3, 1, 3, O.COUNTER); b.staff = at(2, 2); bed(W - 3, 1); bed(W - 2, 1); put(D - 1, 1, O.TUB); put(W - 2, F, O.PLANT); put(1, F, O.CHAIR); }
    } else {
      // iki katlı yapıların (malikane, kulüp) zemin katında arka köşelerde yukarı çıkan merdiven
      const UP = upPlan(b);
      if (UP) for (let ly = 1; ly <= 3; ly++) for (const lx of UP.stairs) put(lx, ly, O.STAIRS);
      // oyuncunun kurduğu yapı: seçtiği kademenin planı; öbürleri: türün planlarından biri (zengin şehirde zengin plan)
      let plan = b.tier && TIER_PLANS[b.type] ? TIER_PLANS[b.type][b.tier] : null;
      if (!plan) {
        const pl = INT_PLANS[b.type], tier = pl && (b.modern && pl.rich ? pl.rich : pl.std);
        if (tier) {
          const k = b.design !== undefined ? b.design % tier.length : Math.floor(hash2(b.x, b.y, 53) * tier.length);
          plan = tier[k]; b.lay = (tier === pl.std ? 's' : 'r') + k;
        }
      }
      if (plan) {
        plan.m.forEach((line, r) => {
          for (let c = 0; c < line.length; c++) {
            const ch = line[c], lx = c + 1, ly = r + 1;
            if (ch === '.') continue;
            if (ch === '@') { b.staff = at(lx, ly); continue; }
            const o = INT_KEY[ch];
            if (o === undefined) continue;
            put(lx, ly, o);
            // masa ve kart masası: iki yanda sandalye (oturan sakin masaya döner); bar taburesi bara (kuzeye) bakar
            if (o === O.TABLE || o === O.CARDTABLE) b.seats.push({ ...at(lx - 0.72, ly), ang: 0 }, { ...at(lx + 0.72, ly), ang: Math.PI });
            else if (o === O.STOOL) b.seats.push({ ...at(lx, ly - 0.3), ang: -Math.PI / 2 });
            else if (o === O.PIANO) b.piano = at(lx, ly + 1);
            if (HEARTH_O[o]) this.lights.push({ x: (b.x + lx) * TS + 8, y: (b.y + ly) * TS + 6, r: HEARTH_O[o], type: 'hearth', b: b.id });
          }
        });
        if (plan.at) b.staff = at(plan.at[0], plan.at[1]);
      }
    }
    // kapı ve kapı önü açık kalsın
    for (let ly = 2; ly <= H - 1; ly++) { const i = (b.y + ly) * WW + b.x + D; if (ly >= F - 1 && this.obj[i] !== O.COUNTER) this.obj[i] = 0; }
  }

  genTowns() {
    const RAD = { s: 36, m: 48, l: 62 };   // kasabanın yarıçapı (karo)
    const nz = new Noise(this.seed + 911), nz2 = new Noise(this.seed + 912);
    const R = this.rng;
    // polyline üzerinde t (0..1) konumundaki nokta ve yön
    const pointAt = (pts, t) => {
      const L = [0];
      for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + dist(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]));
      const s = clamp(t, 0, 1) * L[L.length - 1];
      let i = 1; while (i < L.length - 1 && L[i] < s) i++;
      const f = (s - L[i - 1]) / (L[i] - L[i - 1] || 1);
      const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
      return { x: lerp(ax, bx, f), y: lerp(ay, by, f), ang: Math.atan2(by - ay, bx - ax) };
    };
    for (const td of TOWNS) {
      // zengin şehir (Saint Clement) ızgara planlıdır: js/city.js
      if (td.rich) { this.genCity(td); continue; }
      const RT = T.ROAD, GT = T.TOWN;
      const rx = RAD[td.sz], ry = Math.round(rx * 0.74);
      const cx = Math.round(td.px * WW), cy = Math.round(td.py * WH);
      const x0 = cx - rx - 3, y0 = cy - ry - 3, w = (rx + 3) * 2, h = (ry + 3) * 2;
      const town = { ...td, x: x0, y: y0, w, h, cx: cx * TS, cy: cy * TS, buildings: [], streetPts: [], hitch: [], gates: [], rx, ry, modern: false, parks: [] };
      this.towns.push(town);
      const inside = (x, y, m = 0) => { const dx = (x - cx) / (rx + m), dy = (y - cy) / (ry + m); return dx * dx + dy * dy + (nz.v(x * 0.07, y * 0.07) - 0.5) * 0.4 < 1; };
      // zemin hazırlığı: yumuşat, kasaba içindeki su/kaya/orman temizlenir
      for (let y = y0 - 12; y < y0 + h + 22; y++) for (let x = x0 - 12; x < x0 + w + 12; x++) {
        if (!this.inb(x, y)) continue;
        const i = y * WW + x, t = this.tile[i];
        if (isCliffT(t)) this.tile[i] = T.ROCK;
        if (t === T.DEEP) this.tile[i] = T.WATER;
        this.flags[i] |= 1;
        if (inside(x, y, 3)) {
          this.obj[i] = 0; this.flags[i] |= 4;
          const tt = this.tile[i];
          if (isWaterT(tt) || tt === T.ROCK || tt === T.SWAMP || tt === T.MUD || tt === T.BRIDGE) this.tile[i] = GT;
          else if (tt === T.FOREST) this.tile[i] = T.GRASS;
          if (inside(x, y, -4) && nz2.v(x * 0.11, y * 0.11) < 0.42) this.tile[i] = GT;
        }
      }
      // yerel doluluk ızgarası: 3 yol, 1 yol kenarı, 2 bina, 5 patika/ayrılmış
      const ox = x0 - 12, oy = y0 - 12, OW = w + 24, OH = h + 34;
      const occ = new Uint8Array(OW * OH);
      const oget = (x, y) => (x < ox || y < oy || x >= ox + OW || y >= oy + OH) ? 9 : occ[(y - oy) * OW + (x - ox)];
      const oset = (x, y, v) => { if (x >= ox && y >= oy && x < ox + OW && y < oy + OH) occ[(y - oy) * OW + (x - ox)] = v; };
      const ground = (x, y) => { const i = y * WW + x; if (this.tile[i] !== T.ROAD && this.tile[i] !== T.PLANK && this.tile[i] !== RT) this.tile[i] = GT; this.flags[i] |= 1 | 4; this.obj[i] = 0; };
      // ---- sokaklar ----
      const ang = (R.chance(0.5) ? 0 : Math.PI) + R.range(-0.55, 0.55);
      const L = rx * 0.95;
      const core = [];
      for (let k = -2; k <= 2; k++) {
        const off = Math.abs(k) === 2 ? R.range(-2, 2) : R.range(-ry * 0.22, ry * 0.22);
        core.push([cx + Math.cos(ang) * L * k / 2 - Math.sin(ang) * off, cy + Math.sin(ang) * L * k / 2 * 0.85 + Math.cos(ang) * off]);
      }
      // uçları kasaba sınırının dışına uzat (kapılar)
      const extend = (a, b) => {
        const d = Math.atan2(b[1] - a[1], b[0] - a[0]);
        const out = [];
        let x = b[0], y = b[1];
        for (let s = 0; s < 80; s++) { x += Math.cos(d) * 2; y += Math.sin(d) * 2; out.push([x, y]); if (x < x0 - 3 || x > x0 + w + 2 || y < y0 - 3 || y > y0 + h + 2) break; }
        return out;
      };
      const mainPts = [...extend(core[1], core[0]).reverse(), ...core, ...extend(core[3], core[4])];
      const streets = [{ pts: World.chaikin(mainPts, 3), r: 1.55, main: true }];
      const mainS = streets[0].pts;
      town.gates.push({ x: Math.round(mainS[0][0]), y: Math.round(mainS[0][1]) }, { x: Math.round(mainS[mainS.length - 1][0]), y: Math.round(mainS[mainS.length - 1][1]) });
      const nSide = { s: 2, m: 3, l: 5 }[td.sz];
      for (let k = 0; k < nSide; k++) {
        const t = 0.22 + 0.56 * (k + 0.5) / nSide + R.range(-0.06, 0.06);
        const p = pointAt(core, t);
        const side = (k % 2 ? 1 : -1) * (R.chance(0.15) ? -1 : 1);
        let a = p.ang + side * (Math.PI / 2 + R.range(-0.5, 0.5));
        const len = R.range(ry * 0.55, ry * 1.05);
        const pts = [[p.x, p.y]];
        let x = p.x, y = p.y;
        for (let s = 0; s < 4; s++) {
          a += R.range(-0.3, 0.3);
          x += Math.cos(a) * len / 4; y += Math.sin(a) * len / 4;
          if (!inside(Math.round(x), Math.round(y), -2)) break;
          pts.push([x, y]);
        }
        if (pts.length > 2) streets.push({ pts: World.chaikin(pts, 2), r: 1.05 });
      }
      // arka sokak: iki yan sokağın uçlarını bağla (büyük kasabalar)
      if (td.sz !== 's' && streets.length > 3) {
        const a = streets[1].pts, b = streets[3].pts;
        const pa = a[a.length - 1], pb = b[b.length - 1];
        if (dist(pa[0], pa[1], pb[0], pb[1]) < rx * 1.3) {
          const mid = [(pa[0] + pb[0]) / 2 + R.range(-3, 3), (pa[1] + pb[1]) / 2 + R.range(-3, 3)];
          if (inside(Math.round(mid[0]), Math.round(mid[1]), -1)) streets.push({ pts: World.chaikin([pa, mid, pb], 2), r: 0.9 });
        }
      }
      // meydan
      const plaza = pointAt(core, 0.5 + R.range(-0.08, 0.08));
      town.plaza = plaza;
      for (const st of streets) {
        const P = st.pts;
        for (let i = 0; i < P.length - 1; i++) {
          const [ax, ay] = P[i], [bx, by] = P[i + 1];
          const n = Math.max(1, Math.ceil(dist(ax, ay, bx, by) * 2));
          for (let s = 0; s <= n; s++) {
            const x = lerp(ax, bx, s / n), y = lerp(ay, by, s / n);
            this.carveCircle(x, y, st.r + 2.4, (tx, ty, d, idx) => {
              if (d <= st.r) { this.tile[idx] = RT; this.flags[idx] |= 1 | 4; this.obj[idx] = 0; oset(tx, ty, 3); }
              else {
                if (d <= st.r + 1 && oget(tx, ty) === 0) oset(tx, ty, 1);
                if (d <= st.r + 1.2 + nz2.v(tx * 0.3, ty * 0.3) && this.tile[idx] !== RT) ground(tx, ty);
              }
            });
          }
        }
        for (let s = 0; s < 1; s += 0.04) { const p = pointAt(P, s); if (inside(Math.round(p.x), Math.round(p.y), 1)) town.streetPts.push({ x: p.x * TS + 8, y: p.y * TS + 8 }); }
      }
      this.carveCircle(plaza.x, plaza.y, 4.2, (tx, ty, d, idx) => { if (d < 3.6) { this.tile[idx] = RT; this.flags[idx] |= 1 | 4; this.obj[idx] = 0; oset(tx, ty, 3); } else { ground(tx, ty); if (oget(tx, ty) === 0) oset(tx, ty, 1); } });
      town.spawn = { x: plaza.x * TS + 8, y: (plaza.y + 2) * TS + 8 };
      // ---- binalar ----
      const fits = (bx, by, bw, bh, relax = 0) => {
        for (let yy = by - 1; yy <= by + bh + 1; yy++) for (let xx = bx - 1; xx <= bx + bw; xx++) {
          const v = oget(xx, yy);
          if (yy >= by + bh) { if (v === 2 || v === 9 || v === 5) return false; if (yy === by + bh && v === 3) return false; continue; }
          if (v !== 0) return false;
          if (!inside(xx, yy, 1 + relax)) return false;
        }
        return true;
      };
      const place = (type, pull, def = BUILDINGS[type]) => {
        const bw = def.w, bh = def.h;
        let best = null, bs = 1e9;
        for (let k = 0; k < 320; k++) {
          const relax = k > 220 ? 3 : 0;
          const st = R.chance(0.5) ? streets[0] : R.pick(streets);
          const p = pointAt(st.pts, R.range(0.03, 0.97));
          const side = R.chance(0.5) ? 1 : -1;
          const nx = -Math.sin(p.ang) * side, ny = Math.cos(p.ang) * side;
          const ext = Math.abs(nx) * (bw / 2 + 0.5) + Math.abs(ny) * (bh / 2 + (ny < 0 ? 1.5 : 0.5));
          const d = st.r + 1.2 + ext + R.range(0, 2.4) * (type === 'house' || type === 'church' ? 1.8 : 1);
          const bx = Math.round(p.x + nx * d - bw / 2), by = Math.round(p.y + ny * d - bh / 2);
          if (!fits(bx, by, bw, bh, relax)) continue;
          const sc = dist(bx + bw / 2, by + bh / 2, cx, cy) * pull + (ny > 0.35 ? 14 : 0) + R.range(0, 8);
          if (sc < bs) { bs = sc; best = { bx, by }; }
        }
        // yedek: sokaktan bağımsız, kasaba içinde boş bir yer (patikayla bağlanır)
        for (let k = 0; k < 400 && !best; k++) {
          const bx = Math.round(cx + R.range(-rx, rx) - bw / 2), by = Math.round(cy + R.range(-ry, ry) - bh / 2);
          if (fits(bx, by, bw, bh, 5)) best = { bx, by };
        }
        return best;
      };
      // kapıdan en yakın yola patika (BFS)
      const pathFrom = (sx, sy) => {
        const N = OW * OH, prev = new Int32Array(N).fill(-2);
        const s0 = (sy - oy) * OW + (sx - ox);
        if (s0 < 0 || s0 >= N) return;
        const q = [s0]; prev[s0] = -1;
        let end = -1;
        for (let qi = 0; qi < q.length && qi < 6000; qi++) {
          const c = q[qi], x = c % OW, y = (c / OW) | 0;
          if (occ[c] === 3) { end = c; break; }
          const dirs = R.chance(0.5) ? [[0, 1], [1, 0], [0, -1], [-1, 0]] : [[1, 0], [0, 1], [-1, 0], [0, -1]];
          for (const [dx, dy] of dirs) {
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= OW || ny >= OH) continue;
            const ni = ny * OW + nx;
            if (prev[ni] !== -2 || occ[ni] === 2) continue;
            const wi = (ny + oy) * WW + nx + ox;
            if (isWaterT(this.tile[wi]) && occ[ni] !== 3) continue;
            prev[ni] = c; q.push(ni);
          }
        }
        if (end < 0) return;
        for (let c = prev[end]; c >= 0; c = prev[c]) {
          const x = c % OW + ox, y = ((c / OW) | 0) + oy;
          if (occ[c] !== 3) { ground(x, y); if (occ[c] !== 2) occ[c] = 5; }
        }
      };
      const queue = [...td.b, ...(td.xb || [])];
      queue.sort((a, b) => (a === 'house') - (b === 'house'));
      queue.forEach((type, qi) => {
        const pull = type === 'house' ? 0.25 : type === 'church' ? 0.5 : 1.6 - qi * 0.08;
        const spot = place(type, Math.max(0.4, pull));
        if (!spot) return;
        const { bx, by } = spot, def = BUILDINGS[type];
        for (let yy = by - 1; yy <= by + def.h + 1; yy++) for (let xx = bx - 1; xx <= bx + def.w; xx++) {
          if (oget(xx, yy) === 3) continue;
          if (yy <= by + def.h) { oset(xx, yy, 2); ground(xx, yy); } else if (oget(xx, yy) !== 5) oset(xx, yy, 5);
        }
        const b = this.addBuilding(type, bx, by, town);
        town.buildings.push(b);
        pathFrom(bx + (def.w >> 1), by + def.h + 1);
        // bina yanı dekor
        const put = (x, y, o) => { if (this.inb(x, y) && !this.obj[y * WW + x] && !(this.flags[y * WW + x] & 8) && oget(x, y) !== 3) { this.obj[y * WW + x] = o; return true; } return false; };
        if (type === 'saloon' || type === 'general' || type === 'sheriff' || type === 'hotel' || type === 'cantina' || type === 'gambling' || type === 'warehouse') {
          const hx = R.chance(0.5) ? bx - 1 : bx + def.w, hy = by + def.h;
          if (put(hx, hy, O.HITCH)) town.hitch.push({ x: hx * TS + 8, y: hy * TS + 14 });
        }
        if (type === 'sheriff') put(bx + def.w, by + def.h - 1, O.BOARD);
        if (type === 'mill') { for (const [dx, dy] of [[def.w + 2, 1], [-3, 1], [def.w + 2, 4]]) if (put(bx + dx, by + dy, O.WINDMILL)) break; }
        if (type === 'warehouse' || type === 'brewery') { put(bx - 1, by + def.h - 1, O.CRATE); put(bx + def.w, by + def.h - 1, O.BARREL); }
        if (R.chance(0.55)) put(R.chance(0.5) ? bx - 1 : bx + def.w, by + def.h - 2, R.pick([O.BARREL, O.CRATE, O.BARREL]));
        // evlerin arkasında bahçe
        if (type === 'house' && R.chance(0.55)) {
          const gy0 = by - 5, gy1 = by - 2;
          let ok = true;
          for (let yy = gy0 - 1; yy <= gy1; yy++) for (let xx = bx - 1; xx <= bx + def.w; xx++) if (oget(xx, yy) !== 0 && oget(xx, yy) !== 1) ok = false;
          if (ok) {
            for (let yy = gy0; yy <= gy1; yy++) for (let xx = bx; xx < bx + def.w; xx++) {
              const i = yy * WW + xx; oset(xx, yy, 2);
              if (yy === gy0) { this.obj[i] = O.FENCEH; this.flags[i] |= 1; continue; }
              if (xx === bx || xx === bx + def.w - 1) { this.obj[i] = O.FENCEV; this.flags[i] |= 1; continue; }
              this.tile[i] = T.FARM; this.flags[i] |= 1; this.obj[i] = (xx % 2 === 0 && yy < gy1) ? O.CROP : 0;
            }
          }
        }
      });
      // ---- satılık arsalar: ileride işletme kurulacak boş parseller ----
      town.lots = [];
      const nLots = { s: 1, m: 2, l: 3 }[td.sz];
      for (let k = 0; k < nLots; k++) {
        const def = k === 0 && td.sz !== 's' ? { w: 12, h: 9 } : { w: 10, h: 7 };
        const spot = place('lot', 1.2, def);
        if (!spot) continue;
        const { bx, by } = spot;
        for (let yy = by - 1; yy <= by + def.h + 1; yy++) for (let xx = bx - 1; xx <= bx + def.w; xx++) {
          if (oget(xx, yy) === 3) continue;
          if (yy <= by + def.h) { oset(xx, yy, 2); ground(xx, yy); } else if (oget(xx, yy) !== 5) oset(xx, yy, 5);
        }
        // arka ve yanlar çitli, ön (sokak) açık; içi kuru toprak ve ot
        for (let yy = by; yy < by + def.h; yy++) for (let xx = bx; xx < bx + def.w; xx++) {
          const i = yy * WW + xx;
          this.flags[i] |= 1 | 4;
          if (yy === by) { this.obj[i] = O.FENCEH; continue; }
          if (xx === bx || xx === bx + def.w - 1) { this.obj[i] = yy < by + def.h - 1 ? O.FENCEV : 0; continue; }
          this.tile[i] = R.chance(0.6) ? T.DRY : T.TOWN;
          this.obj[i] = R.chance(0.1) ? (R.chance(0.5) ? O.TUFT : O.DRYBUSH) : 0;
        }
        const sx = bx + 2, sy = by + def.h - 1;
        this.obj[sy * WW + sx] = O.LOTSIGN;
        const price = Math.round({ s: 110, m: 190, l: 300 }[td.sz] * (def.w * def.h) / 70 / 5) * 5;
        const lot = { id: town.id + ':' + k, town: town.id, x: bx, y: by, w: def.w, h: def.h, price, sign: sy * WW + sx };
        town.lots.push(lot); this.lots.push(lot);
        pathFrom(bx + (def.w >> 1), by + def.h + 1);
      }
      // ---- meydan ve sokak lambaları ----
      const putFree = (x, y, o) => {
        const v = oget(x, y);
        if ((v === 0 || v === 1) && !this.obj[y * WW + x] && !(this.flags[y * WW + x] & 8)) { this.obj[y * WW + x] = o; oset(x, y, 5); return true; }
        return false;
      };
      const pa = Math.atan2(Math.sin(plaza.ang), Math.cos(plaza.ang));
      const around = (d, a) => [Math.round(plaza.x + Math.cos(a) * d), Math.round(plaza.y + Math.sin(a) * d)];
      let placed = 0;
      for (let k = 0; k < 24 && placed < 4; k++) {
        const [x, y] = around(4.8 + (k % 3) * 0.6, pa + Math.PI / 2 + k * 0.9);
        const o = [O.PUMP, O.TROUGH, O.BENCH, O.WELL][placed];
        if (putFree(x, y, o)) placed++;
      }
      for (const st of streets) {
        const P = st.pts;
        let side = 1;
        for (let s = 0.05; s < 1; s += 7 / Math.max(10, P.length * 0.8)) {
          const p = pointAt(P, s);
          const d = st.r + 1.4;
          const x = Math.round(p.x - Math.sin(p.ang) * d * side), y = Math.round(p.y + Math.cos(p.ang) * d * side);
          side = -side;
          if (!inside(x, y, 0)) continue;
          if (putFree(x, y, O.LAMP)) this.lights.push({ x: x * TS + 8, y: y * TS + 2, r: 55, type: 'lamp' });
        }
      }
      // ağaçlar ve çalılar
      const n = Math.round(rx * ry * 0.012);
      let trees = 0;
      for (let k = 0; k < 400 && trees < n; k++) {
        const x = Math.round(cx + R.range(-rx, rx)), y = Math.round(cy + R.range(-ry, ry));
        if (!inside(x, y, 1) || oget(x, y) !== 0) continue;
        const i = y * WW + x, t = this.tile[i];
        if (SOLID_O[this.obj[i - 1]] || SOLID_O[this.obj[i + 1]] || SOLID_O[this.obj[i - WW]] || SOLID_O[this.obj[i + WW]]) continue;
        const o = t === T.SNOW ? O.SNOWPINE : t === T.DESERT || t === T.SAND ? (R.chance(0.5) ? O.CACTUS : O.DRYBUSH) : t === T.REDROCK ? O.DRYBUSH : t === T.DRY ? (R.chance(0.4) ? O.DEAD : O.DRYBUSH) : (R.chance(0.35) ? O.OAK : R.chance(0.5) ? O.BUSH : O.TUFT);
        this.obj[i] = o; oset(x, y, 5); trees++;
      }
      // ---- istasyon ----
      if (RAIL_LINES.some(l => l.includes(td.id))) {
        const def = BUILDINGS.station;
        const sx = cx - (def.w >> 1) + R.int(-6, 6), sy = y0 + h + 2;
        this.flatten(sx - 4, sy - 2, def.w + 8, def.h + 6, T.TOWN, 4);
        for (let yy = sy - 2; yy < sy + def.h + 4; yy++) for (let xx = sx - 4; xx < sx + def.w + 4; xx++) oset(xx, yy, 5);
        for (let yy = sy - 1; yy < sy + def.h + 1; yy++) for (let xx = sx - 1; xx <= sx + def.w; xx++) oset(xx, yy, 2);
        const b = this.addBuilding('station', sx, sy, town);
        town.buildings.push(b);
        for (let xx = sx - 4; xx < sx + def.w + 4; xx++) { const i = (sy + def.h) * WW + xx; this.tile[i] = T.PLANK; this.flags[i] |= 1; }
        town.station = b;
        town.railPt = { x: sx + (def.w >> 1), y: sy + def.h + 2 };
        // istasyona patika: platformun yanından kasabaya
        oset(sx - 2, sy + def.h, 0);
        pathFrom(sx - 2, sy + def.h - 1);
      }
      // tabelalar (kapı yolunun kenarı)
      for (const g of town.gates) {
        const gx = g.x + (g.x < cx ? 2 : -2), gy = g.y + 2;
        if (this.inb(gx, gy) && !this.obj[gy * WW + gx] && this.tile[gy * WW + gx] !== T.ROAD) {
          this.signs.push({ x: gx * TS + 8, y: gy * TS + 8, town: town.id });
          this.obj[gy * WW + gx] = O.SIGN;
        }
      }
      town.gateY = town.gates[0].y;
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
  /* A* kaba ızgarada (koordinatlar kaba hücre). Arama dizileri bir kez ayrılır (bütün dünyalar için ortak; arama
     kesintisiz biter); her aramada sıfırdan açıp doldurmak yerine arama numarasıyla (seen: g ve came geçerli,
     shut: kapalı) geçersiz sayılır. */
  astar(sx, sy, tx, ty, costFn) {
    const N = CW * CHH;
    const S = World.AS || (World.AS = { g: new Float32Array(N), came: new Int32Array(N), seen: new Uint32Array(N), shut: new Uint32Array(N), id: 0 });
    const id = ++S.id, g = S.g, came = S.came, seen = S.seen, shut = S.shut;
    const heap = new Heap();
    const s = sy * CW + sx, goal = ty * CW + tx;
    g[s] = 0; came[s] = -1; seen[s] = id; heap.push(s, 0);
    const DX = [1, -1, 0, 0, 1, 1, -1, -1], DY = [0, 0, 1, -1, 1, -1, 1, -1];
    let iter = 0;
    while (heap.size && iter++ < N) {   // ulaşılamayan hedefte en çok ızgara kadar adım
      const cur = heap.pop();
      if (cur === goal) break;
      if (shut[cur] === id) continue;
      shut[cur] = id;
      const cx = cur % CW, cy = (cur / CW) | 0;
      for (let k = 0; k < 8; k++) {
        const nx = cx + DX[k], ny = cy + DY[k];
        if (nx < 0 || ny < 0 || nx >= CW || ny >= CHH) continue;
        const ni = ny * CW + nx;
        if (shut[ni] === id) continue;
        let c = costFn(ni, nx, ny);
        if (ni === goal) c = Math.min(c, 2);
        if (c >= 1e5) continue;
        const ng = g[cur] + c * (k > 3 ? 1.414 : 1);
        if (ng < (seen[ni] === id ? g[ni] : Infinity)) {   // görülmemiş hücre sonsuz uzakta (maliyeti NaN olan hücreye girilmez)
          seen[ni] = id; g[ni] = ng; came[ni] = cur;
          heap.push(ni, ng + Math.hypot(nx - tx, ny - ty) * 0.6);
        }
      }
    }
    if (seen[goal] !== id) return null;
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
              else if (t !== T.TOWN && t !== T.PLANK && !isStoneT(t)) this.tile[idx] = T.ROAD;
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
      if (isWaterT(t) || isCliffT(t) || t === T.ROAD || t === T.TOWN || t === T.PLANK || t === T.BRIDGE || isStoneT(t)) return false;
      for (const tw of this.towns) if (x > tw.x - 25 && x < tw.x + tw.w + 25 && y > tw.y - 25 && y < tw.y + tw.h + 30) return false;
      for (const p of this.pois) if (dist2(x, y, p.tx, p.ty) < minD * minD) return false;
      let bad = 0;
      for (let yy = -6; yy <= 6; yy += 2) for (let xx = -6; xx <= 6; xx += 2) {
        const tt = this.t(x + xx, y + yy);
        if (isCliffT(tt) || tt === T.DEEP || (this.flags[(y + yy) * WW + x + xx] & 14)) bad++;
      }
      return bad < 3 && (!foot || this.footClear(x, y, foot));
    };
    // önce yapının bütün alanı boş olan bir yer aranır; bulunamazsa yalnız merkezi boş bir yer
    let foot = opts.foot;
    for (let pass = 0; pass < (foot ? 2 : 1); pass++) {
      for (let r = 0; r < 110; r += 2) {
        const n = Math.max(1, Math.round(r * 1.5));
        for (let k = 0; k < n; k++) {
          const a = (k / n) * TAU + r;
          const x = Math.round(cx + Math.cos(a) * r), y = Math.round(cy + Math.sin(a) * r);
          if (ok(x, y)) return [x, y];
        }
      }
      foot = null;
    }
    return [cx, cy];
  }
  /* Yapının kaplayacağı alan [dx0, dy0, dx1, dy1] (karo): yol, köprü, ray, kasaba, bina ve tarla yok */
  footClear(x, y, f) {
    for (let yy = y + f[1]; yy <= y + f[3]; yy++) for (let xx = x + f[0]; xx <= x + f[2]; xx++) {
      if (!this.inb(xx, yy)) return false;
      const i = yy * WW + xx, t = this.tile[i];
      if (t === T.ROAD || t === T.BRIDGE || t === T.TOWN || t === T.PLANK || t === T.FARM || isStoneT(t) || (this.flags[i] & 14)) return false;
    }
    return true;
  }
  /* kaba hücre işareti (karo dikdörtgeni) */
  markCells(x0, y0, x1, y1, v) {
    for (let cy = Math.max(0, Math.floor(y0 / CG)); cy <= Math.min(CHH - 1, Math.floor(y1 / CG)); cy++)
      for (let cx = Math.max(0, Math.floor(x0 / CG)); cx <= Math.min(CW - 1, Math.floor(x1 / CG)); cx++) this.bcell[cy * CW + cx] = v;
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
      if (this.flags[i] & 8) return;   // önceden kurulmuş binanın içi (eşyaları) silinmez
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
      const [x, y] = this.findSpot(L.near, L.bio, { coast: L.coast, foot: [-12, -12, 12, 12] });
      const p = this.addPOI({ id: L.id, n: L.n, type: L.type, desc: L.desc, tx: x, ty: y, kind: 'landmark' });
      this.stampLandmark(p, R);
    }
    for (const C of CAMPS) {
      const [x, y] = this.findSpot(C.near, null, { minD: 25, foot: [-9, -9, 9, 9] });
      const p = this.addPOI({ id: 'camp_' + this.pois.length, n: C.n, type: 'camp', tx: x, ty: y, kind: 'camp', desc: Tr('Haydut kampı. Dikkatli ol.') });
      this.clearArea(x, y, 7, T.MUD);
      this.setObj(x, y, O.CAMPFIRE); this.lights.push({ x: p.x, y: p.y, r: 70, type: 'fire' });
      for (let k = 0; k < 4; k++) { const a = k / 4 * TAU + 0.4; this.setObj(Math.round(x + Math.cos(a) * 4), Math.round(y + Math.sin(a) * 4), O.TENT); }
      this.setObj(x + 2, y - 5, O.CRATE); this.setObj(x - 5, y + 2, O.BARREL);
      this.addChest(x + 1, y + 3, 'camp');
    }
    for (const F of FARMS) {
      const [x, y] = this.findSpot(F.near, ['GRASS', 'DRY', 'FOREST'], { minD: 22, foot: [-14, -10, 15, 12] });
      const p = this.addPOI({ id: 'farm_' + this.pois.length, n: F.n, type: 'farm', tx: x, ty: y, kind: 'farm', desc: Tr('Burada iş bulabilirsin.') });
      this.clearArea(x, y, 12, T.DRY);
      this.flatten(x - 12, y - 6, 26, 16, T.DRY, 0);
      const b = this.addBuilding('ranch', x - 11, y - 6, null, F.n);
      this.addBuilding('barn', x - 3, y - 7, null, Tr('{0} Ambarı', F.n));
      p.building = b.id;
      for (let yy = y + 2; yy < y + 9; yy++) for (let xx = x - 10; xx < x + 12; xx++) {
        const i = yy * WW + xx; this.tile[i] = T.FARM; this.flags[i] |= 1;
        if (xx > x - 10 && xx < x + 11 && yy > y + 2 && yy < y + 8 && (xx % 2 === 0)) this.obj[i] = O.CROP;
      }
      for (let xx = x - 11; xx <= x + 12; xx++) { this.setObj(xx, y + 1, O.FENCEH); this.setObj(xx, y + 9, O.FENCEH); }
      for (let yy = y + 2; yy < y + 9; yy++) { this.setObj(x - 11, yy, O.FENCEV); this.setObj(x + 12, yy, O.FENCEV); }
      this.setObj(x - 11, y + 5, 0);
      this.setObj(x + 6, y - 3, O.WELL); this.setObj(x + 8, y - 1, O.HAY); this.setObj(x + 9, y - 3, O.HAY); this.setObj(x + 11, y - 2, O.TROUGH);
      this.markCells(x - 12, y - 8, x + 13, y + 10, 1);   // çiftliğin bütün alanı (tarla ve çit dahil): patikalar etrafından dolanır
      this.connectToRoad(x - 8, y + 11);
    }
    for (const P of PROPERTIES) {
      const [x, y] = this.findSpot(P.near, ['GRASS', 'DRY', 'FOREST', 'SWAMP', 'SAND'], { minD: 18, foot: [-8, -7, 9, 8] });
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
  /* Yolların ve rayların içinden geçtiği kasaba dışı yapılar (çiftlik, mülk, maden girişi...): hat yapının
     çevresinden yumuşak bir kavisle dolaştırılır. Noktaların sayısı değişmez (kayıtlardaki yol indeksleri korunur),
     yalnızca yerleri kayar. Yapılar zaten yoldan ve raydan uzak kurulur; bu adım yalnızca güvencedir. */
  routeAroundBuildings() {
    const obs = [];
    const fp = (x0, y0, x1, y1) => obs.push([x0 * TS, y0 * TS, x1 * TS, y1 * TS]);
    for (const p of this.pois) {
      if (p.kind === 'farm') fp(p.tx - 12, p.ty - 8, p.tx + 14, p.ty + 11);
      else if (p.kind === 'property') fp(p.tx - 6, p.ty - 5, p.tx + 8, p.ty + 7);
    }
    for (const b of this.buildings) if (!b.town) fp(b.x, b.y, b.x + b.w, b.y + b.h + 1);
    // yedek rota (A*) için kapalı kaba hücreler: engel, su, köprü, uçurum, kasaba ve bina
    const blocked = new Uint8Array(CW * CHH), PX = CG * TS;
    for (const o of obs) for (let cy = Math.max(0, Math.floor((o[1] - 16) / PX)); cy <= Math.min(CHH - 1, Math.floor((o[3] + 16) / PX)); cy++)
      for (let cx = Math.max(0, Math.floor((o[0] - 16) / PX)); cx <= Math.min(CW - 1, Math.floor((o[2] + 16) / PX)); cx++) blocked[cy * CW + cx] = 1;
    for (let cy = 0; cy < CHH; cy++) for (let cx = 0; cx < CW; cx++) {
      if (blocked[cy * CW + cx]) continue;
      let rl = 0;
      for (let y = 0; y < CG && blocked[cy * CW + cx] !== 1; y++) for (let x = 0; x < CG; x++) {
        const i = (cy * CG + y) * WW + cx * CG + x, t = this.tile[i];
        if (isWaterT(t) || t === T.BRIDGE || isCliffT(t) || (this.flags[i] & 12)) { blocked[cy * CW + cx] = 1; break; }
        if (this.flags[i] & 2) rl = 1;
      }
      if (rl && !blocked[cy * CW + cx]) blocked[cy * CW + cx] = 2;   // ray geçen hücre: kapalı değil, yalnızca pahalı
    }
    for (const r of this.roads) if (!r.spur) this.routeAround(r.pts, obs, 14, false, blocked);
    for (const l of this.lines) {
      if (!this.routeAround(l.pts, obs, 12, true, blocked)) continue;
      l.cum = [0];
      for (let i = 1; i < l.pts.length; i++) l.cum.push(l.cum[i - 1] + dist(l.pts[i - 1][0], l.pts[i - 1][1], l.pts[i][0], l.pts[i][1]));
      l.len = l.cum[l.cum.length - 1];
      for (const s of l.stops) s.d = l.cum[s.i];
    }
  }
  routeAround(pts, obs, M, rail, blocked) {
    const n = pts.length;
    if (n < 8) return false;
    const R = obs.map(o => [o[0] - M, o[1] - M, o[2] + M, o[3] + M]);
    // doğru parçası dikdörtgene giriyor mu (4 px aralıkla örnekleyerek)
    const segHit = (a, b, r) => {
      if (Math.max(a[0], b[0]) < r[0] || Math.min(a[0], b[0]) > r[2] || Math.max(a[1], b[1]) < r[1] || Math.min(a[1], b[1]) > r[3]) return false;
      const k = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 4));
      for (let j = 0; j <= k; j++) { const x = a[0] + (b[0] - a[0]) * j / k, y = a[1] + (b[1] - a[1]) * j / k; if (x > r[0] && x < r[2] && y > r[1] && y < r[3]) return true; }
      return false;
    };
    // dikdörtgenin içindeki bir noktanın u yönünde dışarı çıkması için gereken yol
    const exitD = (x, y, ux, uy, r) => {
      if (!(x > r[0] && x < r[2] && y > r[1] && y < r[3])) return 0;
      const tx = ux > 1e-6 ? (r[2] - x) / ux : ux < -1e-6 ? (x - r[0]) / -ux : Infinity;
      const ty = uy > 1e-6 ? (r[3] - y) / uy : uy < -1e-6 ? (y - r[1]) / -uy : Infinity;
      return Math.min(tx, ty);
    };
    const sm = t => t * t * (3 - 2 * t);
    // hattın değişmemesi gereken noktaları: köprü, su ve kasaba (kavis bunlara uzanmaz)
    const fixed = pts.map(p => { const x = p[0] >> 4, y = p[1] >> 4; if (!this.inb(x, y)) return true; const i = y * WW + x, t = this.tile[i]; return isWaterT(t) || t === T.BRIDGE || !!(this.flags[i] & 4); });
    const tryBulge = (cum, a, b, r, sg, extra, pad) => {
      const pa = pts[Math.max(0, a - 3)], pb = pts[Math.min(n - 1, b + 3)];
      let dx = pb[0] - pa[0], dy = pb[1] - pa[1];
      const L = Math.hypot(dx, dy) || 1; dx /= L; dy /= L;
      const ux = -dy * sg, uy = dx * sg;
      let D = 0;
      for (let k = a; k < b; k++) {
        const A = pts[k], B = pts[k + 1], m = Math.max(1, Math.ceil(dist(A[0], A[1], B[0], B[1]) / 4));
        for (let j = 0; j <= m; j++) D = Math.max(D, exitD(A[0] + (B[0] - A[0]) * j / m, A[1] + (B[1] - A[1]) * j / m, ux, uy, r));
      }
      D += 6 + extra;
      if (D > 520) return null;
      const sA = cum[a] - pad, sB = cum[b] + pad;
      // iki yandaki geçiş uzunluğu ayrı ayrı: köprüye, kasabaya ya da hattın ucuna varmadan biter
      let fa = 0, fb = n - 1;
      for (let k = a; k >= 0; k--) if (fixed[k] || k === 0) { fa = k; break; }
      for (let k = b; k < n; k++) if (fixed[k] || k === n - 1) { fb = k; break; }
      if (cum[fa] + 8 > sA || cum[fb] - 8 < sB) return null;
      const want = clamp(D * 2.5, 80, 360), minL = Math.max(40, D * 0.6);
      const La = Math.min(want, sA - cum[fa] - 8), Lb = Math.min(want, cum[fb] - 8 - sB);
      if (La < minL || Lb < minL) return null;
      const P2 = pts.map(p => p.slice());
      let k0 = -1, k1 = -1;
      for (let k = 1; k < n - 1; k++) {
        const s = cum[k];
        const w = s >= sA && s <= sB ? 1 : s > sA - La && s < sA ? sm((s - sA + La) / La) : s > sB && s < sB + Lb ? sm((sB + Lb - s) / Lb) : 0;
        if (w <= 0) continue;
        P2[k][0] += ux * D * w; P2[k][1] += uy * D * w;
        if (k0 < 0) k0 = k; k1 = k;
      }
      if (k0 < 0) return null;
      k0 = Math.max(0, k0 - 1); k1 = Math.min(n - 1, k1 + 1);
      return valid(P2, k0, k1) ? { D, P2, k0, k1 } : null;
    };
    // yeni hattın denetimi: hiçbir engele, suya, köprüye, uçuruma, tarlaya, kasabaya ya da binaya girmez
    const valid = (P2, k0, k1) => {
      for (let k = k0; k < k1; k++) {
        for (const rr of R) if (segHit(P2[k], P2[k + 1], rr)) return false;
        const A = P2[k], B = P2[k + 1], m = Math.max(1, Math.ceil(dist(A[0], A[1], B[0], B[1]) / 8));
        for (let j = 0; j <= m; j++) {
          const x = (A[0] + (B[0] - A[0]) * j / m) >> 4, y = (A[1] + (B[1] - A[1]) * j / m) >> 4;
          if (!this.inb(x, y)) return false;
          const i = y * WW + x, t = this.tile[i];
          if (isCliffT(t) || isWaterT(t) || t === T.BRIDGE || t === T.FARM || (this.flags[i] & 12)) return false;
        }
      }
      return true;
    };
    const outside = (p) => !R.some(r => p[0] > r[0] && p[0] < r[2] && p[1] > r[1] && p[1] < r[3]);
    const detour = (cum, a, b) => {
      if (!blocked) return null;
      for (const span of [200, 360, 560]) {
        // giriş ve çıkış noktaları: engelin dışında, köprüye/kasabaya varmadan
        let i0 = a, i1 = b;
        while (i0 > 1 && !fixed[i0 - 1] && cum[a] - cum[i0] < span) i0--;
        while (i1 < n - 2 && !fixed[i1 + 1] && cum[i1] - cum[b] < span) i1++;
        while (i0 > 1 && !fixed[i0 - 1] && !outside(pts[i0])) i0--;
        while (i1 < n - 2 && !fixed[i1 + 1] && !outside(pts[i1])) i1++;
        if (!outside(pts[i0]) || !outside(pts[i1]) || i1 - i0 < 4) continue;
        const cell = (p) => [clamp(((p[0] - 8) / TS / CG) | 0, 0, CW - 1), clamp(((p[1] - 8) / TS / CG) | 0, 0, CHH - 1)];
        // giriş ve çıkışta hat eski yönünde biraz devam eder: birleşme yerinde sert kırılma olmaz
        const lead = (k, kb, sgn) => { const A = pts[k], B = pts[kb]; const L = dist(A[0], A[1], B[0], B[1]) || 1; return [A[0] + (A[0] - B[0]) / L * 40 * sgn, A[1] + (A[1] - B[1]) / L * 40 * sgn]; };
        let L0 = lead(i0, Math.max(0, i0 - 2), 1), L1 = lead(i1, Math.min(n - 1, i1 + 2), 1);
        const cl0 = cell(L0), cl1 = cell(L1);
        if (blocked[cl0[1] * CW + cl0[0]] === 1 || !outside(L0)) L0 = null;
        if (blocked[cl1[1] * CW + cl1[0]] === 1 || !outside(L1)) L1 = null;
        const [sx, sy] = cell(L0 || pts[i0]), [tx, ty] = cell(L1 || pts[i1]);
        const si = sy * CW + sx, gi = ty * CW + tx;
        // ray yolun üstüne, yol rayın üstüne binmesin (yeni hatlar ayrı koridordan)
        const path = this.astar(sx, sy, tx, ty, (ni) => ni === si || ni === gi ? 1 : blocked[ni] === 1 ? 1e6 : 1 + Math.min(this.cost[ni], 20) * 0.1 + (rail ? (this.cost[ni] < 1 ? 2 : 0) : (blocked[ni] === 2 ? 2 : 0)));
        if (!path || path.length < 2) continue;
        const raw = [pts[i0].slice(), ...(L0 ? [L0] : []), ...path.slice(1, -1).map(t => [t[0] * TS + 8, t[1] * TS + 8]), ...(L1 ? [L1] : []), pts[i1].slice()];
        const sm2 = World.chaikin(raw, rail ? 3 : 2);
        // aynı nokta sayısına yeniden örnekle (uçlar aynı kalır)
        const c2 = [0];
        for (let i = 1; i < sm2.length; i++) c2.push(c2[i - 1] + dist(sm2[i - 1][0], sm2[i - 1][1], sm2[i][0], sm2[i][1]));
        const cnt = i1 - i0, total = c2[c2.length - 1];
        if (total / cnt > 40 && span < 560) continue;   // noktalar çok seyrek: daha geniş bir parça dene
        const P2 = pts.map(p => p.slice());
        let j = 0;
        for (let k = 1; k < cnt; k++) {
          const d = total * k / cnt;
          while (j < c2.length - 2 && c2[j + 1] < d) j++;
          const f = (d - c2[j]) / Math.max(1e-6, c2[j + 1] - c2[j]);
          P2[i0 + k] = [lerp(sm2[j][0], sm2[j + 1][0], f), lerp(sm2[j][1], sm2[j + 1][1], f)];
        }
        if (valid(P2, i0, i1)) return { D: total, P2, k0: i0, k1: i1 };
      }
      return null;
    };
    const skip = new Set();
    let changed = false;
    for (let it = 0; it < 24; it++) {
      let hi = -1, hq = -1;
      for (let i = 0; i < n - 1 && hi < 0; i++) for (let q = 0; q < R.length; q++) if (!skip.has(q) && segHit(pts[i], pts[i + 1], R[q])) { hi = i; hq = q; break; }
      if (hi < 0) break;
      const r = R[hq];
      let b = hi + 1;
      while (b < n - 1 && segHit(pts[b], pts[b + 1], r)) b++;
      const cum = [0];
      for (let i = 1; i < n; i++) cum.push(cum[i - 1] + dist(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]));
      let best = null;
      for (const [extra, pad] of [[0, 24], [16, 48], [40, 90], [80, 140], [120, 200]]) {
        for (const sg of [1, -1]) { const t = tryBulge(cum, hi, b, r, sg, extra, pad); if (t && (!best || t.D < best.D)) best = t; }
        if (best) break;
      }
      if (!best) best = detour(cum, hi, b);
      if (!best) { skip.add(hq); continue; }
      // eski ray karolarının işareti kalkar; yeni hat karolara işlenir
      if (rail) for (let k = best.k0; k <= best.k1; k++) this.carveCircle((pts[k][0] - 8) / TS, (pts[k][1] - 8) / TS, 1.6, (tx, ty, d, i) => { this.flags[i] &= ~2; });
      for (let k = best.k0; k <= best.k1; k++) { pts[k][0] = best.P2[k][0]; pts[k][1] = best.P2[k][1]; }
      this.rasterRoad(pts.slice(best.k0, best.k1 + 1).map(p => [(p[0] - 8) / TS, (p[1] - 8) / TS]), rail ? 0.6 : 1.1, rail ? 'rail' : 'road');
      changed = true;
    }
    return changed;
  }
  connectToRoad(x, y) {
    // en yakın yol noktasına kısa bir patika
    let best = null, bd = 1e18;
    for (const r of this.roads) for (let k = 0; k < r.pts.length; k += 3) {
      const d = dist2(r.pts[k][0] / TS, r.pts[k][1] / TS, x, y);
      if (d < bd) { bd = d; best = r.pts[k]; }
    }
    if (!best || bd > 300 * 300) return;
    const C = this.cost;
    const B = this.bcell;
    const path = this.astar(clamp((x / CG) | 0, 0, CW - 1), clamp((y / CG) | 0, 0, CHH - 1), (best[0] / TS / CG) | 0, (best[1] / TS / CG) | 0,
      ni => C[ni] >= 1e5 || (B && B[ni]) ? 1e6 : C[ni]);
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
        this.addBuilding('ruin', x - 11, y - 7, null, Tr('Hollow Rock Saloon'));
        this.addBuilding('ruin', x - 3, y - 7, null, Tr('Hollow Rock Mağazası'));
        this.addBuilding('ruin', x + 5, y - 7, null, Tr('Hollow Rock Oteli'));
        this.addBuilding('ruin', x - 7, y + 3, null, Tr('Ev'), { w: 5, h: 4 });
        for (let k = 0; k < 5; k++) this.setObj(x + 4 + k * 2, y + 5, O.GRAVE);
        this.addChest(x, y + 4, 'ghost');
        break;
      case 'mine':
        this.clearArea(x, y, 8, T.ROCK);
        this.carveCircle(x, y - 9, 6, (tx, ty, d, i) => { if (ty < y - 6) { this.tile[i] = T.CLIFF; this.obj[i] = 0; } });
        this.addBuilding('mineentrance', x - 2, y - 6, null, Tr('Terk Edilmiş Maden'));
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
        this.addBuilding('ruin', x - 5, y - 6, null, Tr('Yıkık Kışla'), { w: 7, h: 4 });
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
        this.addBuilding('mineentrance', x - 2, y - 4, null, Tr('Ayı İni'), { w: 5, h: 2, cave: 1 });
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
  /* Her binanın kapı önündeki iki karoyu engellerden (direk, çit, ağaç, kaya, fıçı…) temizle:
     kapıya her zaman dışarıdan yürünerek ulaşılabilsin. Çitte kapıya bakan bir geçit açılır. */
  clearDoorways() {
    for (const b of this.buildings) {
      const dx = b.x + Math.floor(b.w / 2);
      for (let k = 0; k < 2; k++) for (let ox = -1; ox <= 1; ox++) {
        const x = dx + ox, y = b.y + b.h + k;
        if (!this.inb(x, y)) continue;
        const i = y * WW + x;
        if (this.flags[i] & 8) continue;                       // başka bir binanın içi
        const o = this.obj[i];
        if (o && SOLID_O[o] && (ox === 0 || !(o === O.FENCEH || o === O.FENCEV))) this.obj[i] = 0;
        if (isCliffT(this.tile[i]) || this.tile[i] === T.DEEP) this.tile[i] = T.DRY;
      }
    }
  }
  computeSolid() {
    const N = WW * WH;
    for (let i = 0; i < N; i++) {
      this.solid[i] = (TINFO[this.tile[i]].solid || SOLID_O[this.obj[i]] || (this.flags[i] & 8)) ? 1 : 0;
      if (this.solid[i] && TRUNK_O[this.obj[i]] && !TINFO[this.tile[i]].solid && !(this.flags[i] & 8)) this.solid[i] = 5;
    }
    // sekoya ve kemer daha büyük
    for (let i = 0; i < N; i++) {
      const o = this.obj[i];
      if (o === O.SEQUOIA || o === O.WINDMILL) { for (let y = -1; y <= 1; y++) for (let x = -1; x <= 1; x++) this.solid[i + y * WW + x] = 1; }
      if (o === O.SHIP) { for (let x = -3; x <= 3; x++) this.solid[i + x] = 1; }
      if (o === O.ARCH) { this.solid[i - 3] = this.solid[i + 3] = this.solid[i - 2] = this.solid[i + 2] = 1; this.solid[i] = 0; }
      if (o === O.WAGON) { this.solid[i + 1] = 1; }
    }
    for (const b of this.buildings) if (b.enter) this.buildingSolid(b);
  }
  buildingSolid(b) {
    const UP = upPlan(b), upF = !!UP && b.floor === 1, mask = upF ? b.upMask : this.wallMask0(b);
    const rL = UP && UP.stairs.includes(1), rR = UP && UP.stairs.includes(b.w - 2);
    for (let ly = 0; ly < b.h; ly++) for (let lx = 0; lx < b.w; lx++) {
      const i = (b.y + ly) * WW + b.x + lx;
      if (ly === 0 || SOLID_O[this.obj[i]]) { this.solid[i] = 1; continue; }
      if (i === b.doorI && !upF) { this.solid[i] = 3; continue; }   // üst katta kapının yeri duvardır
      let m = 0;
      if (lx === 0) m |= 4;
      if (lx === b.w - 1) m |= 8;
      if (ly === b.h - 1) m |= 2;
      if (UP && ly >= 1 && ly <= 3) { if (lx === 2 && rL) m |= 4; if (lx === b.w - 3 && rR) m |= 8; }   // merdiven korkuluğu: merdivene yalnızca güney ucundan girilir (iki katta da)
      if (mask) m |= mask[ly * b.w + lx];
      this.solid[i] = m ? 16 | m : 0;
    }
  }
  /* Zemin kattaki ara duvarların çarpışma maskesi (kulüp); yoksa null */
  wallMask0(b) {
    const L = FLOOR0_WALL[b.type];
    if (!L || !upPlan(b)) return null;
    if (!b.mask0) { const m = b.mask0 = new Uint8Array(b.w * b.h); for (const [lx, ly, v] of L) m[ly * b.w + lx] |= v; }
    return b.mask0;
  }
  /* İki katlı yapı (otel, malikane, kulüp): kat değişince binanın iç mekân nesneleri ve çarpışması o katınkiyle değişir; çizim önbellekleri
     (2D ve melez) yalnızca binanın parçalarında yenilenir, bina örtüsü korunur. Zemin katın nesneleri ilk değişimde
     kopyalanır (dünya önbelleği üretimden hemen sonra alındığı için bu kopyalar ona girmez). open: kapısı açık oda
     (kiralanan), yoksa -1. Üst katta eşyalar yalnızca açık odadadır; kilitli odaların içi boştur ve örtülür (hotelShut). */
  setFloor(b, lv, open = -1) {
    const UP = upPlan(b);
    if (!UP) return false;
    const n = b.w * b.h, at = (k) => (b.y + Math.floor(k / b.w)) * WW + b.x + k % b.w;
    if (!b.fl0) { b.fl0 = new Uint8Array(n); for (let k = 0; k < n; k++) b.fl0[k] = this.obj[at(k)]; }
    if (lv) {
      const o = b.fl1 || (b.fl1 = new Uint8Array(n)), put = (lx, ly, v) => { o[ly * b.w + lx] = v; };
      o.fill(0);
      for (let ly = 1; ly <= 3; ly++) for (const lx of UP.stairs) put(lx, ly, O.STAIRSD);
      UP.rooms.forEach((R, k) => {
        put(R.door[0], R.door[1], O.RDOOR);
        if (R.items) { for (const [lx, ly, ch] of R.items) put(lx, ly, INT_KEY[ch]); return; }   // malikane ve kulüp: odalar hep döşeli
        if (k !== open) return;
        put(R.bed[0], R.bed[1], O.BED); put(R.bed[0], R.bed[1] + 1, O.IBLOCK);
        const RT = b.tier && HOTEL_TIER[b.tier] ? HOTEL_TIER[b.tier].room : null;   // oyuncunun otelinde oda eşyası kademeye göre
        if (R.chair) put(R.chair[0], R.chair[1], RT ? INT_KEY[RT.chair] : O.CHAIR);
        if (R.shelf) put(R.shelf[0], R.shelf[1], RT ? INT_KEY[RT.shelf] : O.SHELF);
      });
    }
    b.floor = lv ? 1 : 0; b.openRoom = lv ? open : -1;
    if (lv) {
      const m = b.upMask = new Uint8Array(n);
      for (const [lx, ly, v] of UP.wall) m[ly * b.w + lx] |= v;
      UP.rooms.forEach((R, k) => { if (!roomOpen(b, k)) m[R.door[1] * b.w + R.door[0]] |= R.side; });
    } else b.upMask = null;
    const src = lv ? b.fl1 : b.fl0;
    for (let k = 0; k < n; k++) this.obj[at(k)] = src[k];
    this.buildingSolid(b);
    const x0 = b.x * TS, y0 = b.y * TS, x1 = (b.x + b.w) * TS - 1, y1 = (b.y + b.h) * TS - 1;
    for (const [px, py] of [[x0, y0], [x1, y0], [x0, y1], [x1, y1]]) this.invalidateChunkAt(px, py, true);
    const t = this.towns.find(q => q.id === b.town);
    if (t) t._grid = null;   // kasabanın yol bulma ızgarası yeniden kurulsun
    return true;
  }

  /* ---- Parşömen harita görüntüsü ----
     Eski bir arazi haritası gibi: kuzeybatıdan ışıkla tepe gölgelendirmesi, eş yükselti çizgileri, kıyı boyunca
     taranmış su çizgileri, orman noktalamaları, kum ve çöl beneklenmesi, kâğıt dokusu. Yollar, demiryolu ve yazılar
     haritada vektörel olarak ayrıca çizilir. Bütün dünya karo başına bir piksel (mapCanvas); yakından bakan harita
     ekranı ve radar için MAPT karoluk parçalar karo başına 2x2 piksel ayrıca çizilir (mapTile). */
  buildMapImage(async) {
    const tok = this._mapTok = {}, job = this.mapRegion(0, 0, WW, WH, 1);
    this._mapD = null;   // yakın parçalar yeni duruma (mevsim, yeni yapı) göre yeniden çizilir
    const done = (img) => { const c = makeCanvas(WW, WH); c.getContext('2d').putImageData(img, 0, 0); this.mapCanvas = c; };
    if (!async || !this.mapCanvas) { let r; do r = job.next(); while (!r.done); done(r.value); return; }
    // oyun sırasında (mevsim değişimi, yeni yapı): parça parça çiz, bitene kadar eski harita görünür
    const step = () => {
      if (this._mapTok !== tok) return;
      const t0 = performance.now();
      let r;
      do r = job.next(); while (!r.done && performance.now() - t0 < 6);
      if (r.done) done(r.value); else setTimeout(step, 0);
    };
    setTimeout(step, 0);
  }
  /* Harita resminin bir bölgesi: karo dikdörtgeni [x0, x0 + w) × [y0, y0 + h), karo başına SxS piksel. Üreteç: ara
     adımlarda durur (parça parça çizilebilsin), sonunda ImageData döner. Kıyıya uzaklık bölgenin 8 karoluk çevresiyle
     birlikte hesaplanır; en çok 6 olduğundan bölgenin içinde bütün dünya üzerinden hesaplanmışıyla aynıdır. */
  *mapRegion(x0, y0, w, h, S) {
    const MW = w * S, img = new ImageData(MW, h * S), d = img.data;
    const MC = World.MAPC || (World.MAPC = TINFO.map(t => hexToRgb(t.map)));
    const E = this.elev, tile = this.tile, flags = this.flags, obj = this.obj;
    // su karelerinin kıyıya uzaklığı (0: kıyı, en fazla 6) — iki geçişli yaklaşık mesafe
    const X0 = Math.max(0, x0 - 8), Y0 = Math.max(0, y0 - 8), X1 = Math.min(WW, x0 + w + 8), Y1 = Math.min(WH, y0 + h + 8), RW = X1 - X0;
    const sd = new Uint8Array(RW * (Y1 - Y0));
    for (let y = Y0; y < Y1; y++) for (let x = X0; x < X1; x++) sd[(y - Y0) * RW + x - X0] = isWaterT(tile[y * WW + x]) ? 6 : 0;
    for (let y = Math.max(1, Y0 + 1); y < Math.min(WH - 1, Y1); y++) {
      for (let x = Math.max(1, X0 + 1); x < Math.min(WW - 1, X1); x++) { const l = (y - Y0) * RW + x - X0; if (sd[l]) sd[l] = Math.min(sd[l], sd[l - 1] + 1, sd[l - RW] + 1); }
      if ((y & 255) === 0) yield;
    }
    for (let y = Math.min(WH - 2, Y1 - 2); y >= Math.max(1, Y0); y--) {
      for (let x = Math.min(WW - 2, X1 - 2); x >= Math.max(1, X0); x--) { const l = (y - Y0) * RW + x - X0; if (sd[l]) sd[l] = Math.min(sd[l], sd[l + 1] + 1, sd[l + RW] + 1); }
      if ((y & 255) === 0) yield;
    }
    // kâğıt lekeleri (düşük frekanslı gürültü), satır satır
    const nz = new Noise(this.seed + 901), XA = new Float64Array(w), XB = new Float64Array(w), PA = new Float64Array(w), PB = new Float64Array(w);
    for (let x = 0; x < w; x++) { XA[x] = (x0 + x) / 46; XB[x] = (x0 + x) / 9 + 50; }
    const CT = 9;   // eş yükselti aralığı
    const ev = (x, y) => E[(y < 0 ? 0 : y >= WH ? WH - 1 : y) * WW + (x < 0 ? 0 : x >= WW ? WW - 1 : x)];
    const winter = this.season === 3, autumn = this.season === 2;
    const hsh = (a, b, k) => { let h = (a * 374761393 + b * 668265263 + k * 1442695041) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
    // karo karo: karonun SxS pikselinin ortak değerleri bir kez hesaplanır, pikseller soldan sağa ve yukarıdan aşağı
    // aynı sırayla işlenir (d bir Uint8ClampedArray olduğundan değerler yazılırken 0..255 aralığına sınırlanır)
    for (let y = y0; y < y0 + h; y++) {
      nz.row(PA, XA, y / 46, 1); nz.row(PB, XB, y / 9, 1);
      const edgeY = y === 0 || y === WH - 1, ly = (y - Y0) * RW - X0;
      for (let x = x0; x < x0 + w; x++) {
        const i = y * WW + x, l = ly + x, t = tile[i], mc = MC[t];
        let r0 = mc[0], g0 = mc[1], b0 = mc[2];
        if (t === T.TOWN || t === T.ROAD || t === T.BRIDGE || t === T.PLANK || isStoneT(t)) { r0 = 196; g0 = 172; b0 = 132; }   // yollar vektörel çizilir
        if (winter && SNOWABLE[t] && this.snowAmt(i, (hash2(x, y, 71) - 0.5) * 0.8) > 0.25) { r0 = 238; g0 = 236; b0 = 230; }
        else if (autumn && LEAFY[t]) { r0 += 14; g0 -= 4; b0 -= 16; }
        // tepe gölgesi ve eş yükselti geçişleri (1: sağa, 2: aşağı); komşular yalnız dünyanın kenarında sınırlanır
        let eR, eL, eD, eU;
        if (edgeY || x === 0 || x === WW - 1) { eR = ev(x + 1, y); eL = ev(x - 1, y); eD = ev(x, y + 1); eU = ev(x, y - 1); }
        else { eR = E[i + 1]; eL = E[i - 1]; eD = E[i + WW]; eU = E[i - WW]; }
        const sh0 = clamp(-((eR - eL) + (eD - eU)) * 2.2, -46, 30) | 0, e0 = (E[i] / CT) | 0;
        const cf = (e0 !== ((eR / CT) | 0) ? 1 : 0) | (e0 !== ((eD / CT) | 0) ? 2 : 0);
        const water = sd[l] > 0, k = sd[l], fl = flags[i], pa = ((PA[x - x0] - 0.5) * 22 + (PB[x - x0] - 0.5) * 6) | 0;
        const cliff = isCliffT(t), rock = t === T.ROCK || t === T.REDROCK, sand = t === T.DESERT || t === T.SAND || t === T.DRY;
        const dot = (t === T.FOREST || t === T.SWAMP) && hsh(x, y, 5) < 0.34, o = obj[i], solidO = o && SOLID_O[o] && o < 20 && t !== T.FOREST;
        const cL = x > 0 && sd[l - 1] === 1, cR = x < WW - 1 && sd[l + 1] === 1, cU = sd[l - RW] === 1, cD = sd[l + RW] === 1;
        for (let q = 0; q < S * S; q++) {
          const sx = q % S, sy = (q / S) | 0, X = S * x + sx, Y = S * y + sy;
          let r = r0, g = g0, b = b0, sh = 0;
          if (!water) {
            // tepe gölgelendirmesi: kuzeybatıdan ışık
            sh = sh0;
            // eş yükselti çizgisi (karonun sağ ve alt pikseli)
            if ((sx === S - 1 && (cf & 1)) || (sy === S - 1 && (cf & 2))) { r = r * 0.8 + 16; g = g * 0.78 + 8; b = b * 0.76; sh -= 6; }
            if (cliff && ((X + Y) % 3 === 0)) sh -= 34;                 // yamaç taraması
            if (rock && ((X - Y) % 5 === 0)) sh -= 14;
            if (sand && hsh(X, Y, 17) < 0.05) sh -= 26;   // kum beneği
            if (dot && !sx && !sy) { r -= 46; g -= 38; b -= 40; }   // ağaç noktası
            else if (dot && sx && sy) sh -= 18;                     // gölgesi
            if (solidO) sh -= 16;
            // kıyı çizgisi: suya bakan kara kenarı mürekkeple
            if ((cL && !sx) || (cR && sx === S - 1) || (cU && !sy) || (cD && sy === S - 1)) { r = 70; g = 84; b = 88; sh = 0; }
          } else {
            // su: derine gittikçe koyulaşır, kıyıya paralel tarama çizgileri
            r -= k * 5; g -= k * 3; b -= k * 1;
            if (k <= 3 && ((Y + k * 3) % 5 === 0)) { r -= 18; g -= 12; b -= 6; }
            if (t === T.DEEP) { r -= 8; g -= 4; }
          }
          if (fl & 2) { r = 40; g = 30; b = 22; sh = ((x + y) & 1) ? 0 : 50; }
          if (fl & 8) { r = 82; g = 56; b = 36; sh = (sx || sy) ? 0 : 14; }   // binalar
          const n = pa + (hsh(X, Y, 3) - 0.5) * 7;
          const k4 = ((Y - y0 * S) * MW + X - x0 * S) * 4;
          // hafif sepya kâğıt tonu
          r = r + sh + n; g = g + sh + n; b = b + sh * 0.8 + n;
          d[k4] = r * 0.94 + 18; d[k4 + 1] = g * 0.92 + 12; d[k4 + 2] = b * 0.86 + 4; d[k4 + 3] = 255;
        }
      }
      if (((y - y0) & 15) === 15) yield;
    }
    return img;
  }
  /* Yakın harita parçası (MAPT karoluk kare, karo başına 2x2 piksel): hazırsa kanvası döner; değilse çizimi sıraya
     girer (mapWork çizer) ve null döner. Bir saniyedir istenmeyen sıradaki parça atılır (haritada hızla kaydırınca). */
  mapTile(tx, ty) {
    const D = this._mapD || (this._mapD = { tiles: new Map(), jobs: new Map() }), k = ty * 64 + tx, now = performance.now();
    const c = D.tiles.get(k);
    if (c) { c.used = now; return c; }
    const j = D.jobs.get(k);
    if (j) j.t = now; else D.jobs.set(k, { gen: this.mapRegion(tx * MAPT, ty * MAPT, Math.min(MAPT, WW - tx * MAPT), Math.min(MAPT, WH - ty * MAPT), 2), t: now });
    return null;
  }
  /* Sıradaki yakın harita parçalarını süre bütçesi (ms) içinde çizer; en çok 40 parça tutulur (en uzun süre
     kullanılmayan atılır). Bir parça bittiyse true döner. */
  mapWork(budget) {
    const D = this._mapD;
    if (!D || !D.jobs.size) return false;
    const t0 = performance.now();
    let any = false;
    for (const [k, j] of D.jobs) {
      if (t0 - j.t > 1000) { D.jobs.delete(k); continue; }
      let r;
      do r = j.gen.next(); while (!r.done && performance.now() - t0 < budget);
      if (!r.done) break;
      D.jobs.delete(k);
      const c = makeCanvas(r.value.width, r.value.height);
      c.getContext('2d').putImageData(r.value, 0, 0);
      c.used = performance.now();
      D.tiles.set(k, c); any = true;
      if (D.tiles.size > 40) { let old = -1, ot = Infinity; for (const [q, v] of D.tiles) if (v.used < ot) { ot = v.used; old = q; } D.tiles.delete(old); }
      if (performance.now() - t0 >= budget) break;
    }
    return any;
  }
  /* Harita resmini çiz: dünyadaki karo dikdörtgeni [wx0, wx1) × [wy0, wy1), hedefte (dx, dy) köşesinden karo başına
     sc pikselle; dünyanın dışında kalan kısım çizilmez. near: hazır yakın parçalar genel resmin üstüne çizilir
     (hazır olmayanlar sıraya girer). */
  drawMapRect(ctx, wx0, wy0, wx1, wy1, dx, dy, sc, near) {
    const ax = Math.max(0, wx0), ay = Math.max(0, wy0), bx = Math.min(WW, wx1), by = Math.min(WH, wy1);
    if (bx <= ax || by <= ay) return;
    const X = (x) => dx + (x - wx0) * sc, Y = (y) => dy + (y - wy0) * sc;
    ctx.drawImage(this.mapCanvas, ax, ay, bx - ax, by - ay, X(ax), Y(ay), (bx - ax) * sc, (by - ay) * sc);
    if (!near) return;
    for (let ty = Math.floor(ay / MAPT); ty * MAPT < by; ty++) for (let tx = Math.floor(ax / MAPT); tx * MAPT < bx; tx++) {
      const c = this.mapTile(tx, ty);
      if (!c) continue;
      const qx = Math.max(ax, tx * MAPT), qy = Math.max(ay, ty * MAPT), rx = Math.min(bx, (tx + 1) * MAPT), ry = Math.min(by, (ty + 1) * MAPT);
      ctx.drawImage(c, (qx - tx * MAPT) * 2, (qy - ty * MAPT) * 2, (rx - qx) * 2, (ry - qy) * 2, X(qx), Y(qy), (rx - qx) * sc, (ry - qy) * sc);
    }
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
    const key = cy * CN + cx;
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
    if (cx < 0 || cy < 0 || cx >= CN || cy >= CN) return;
    const key = cy * CN + cx;
    if (this.chunks.has(key) || this.jobs.has(key)) return;
    this.jobs.set(key, { gen: this.chunkJob(cx, cy) });
  }
  /* Gereken parça alanı (görünen + ön halka, parça koordinatında): önbellek bu alanı her zaman tutar, sığa ona göre
     büyür; yer gerekince alana en uzak parça atılır. Sabit 36 parça küçük piksel ölçeğinde halkayı almıyor, görünen
     parçalar atılıp yeniden pişiyordu. */
  chunkNeed(x0, y0, x1, y1) {
    const N = this._need || (this._need = [0, 0, 0, 0]);
    N[0] = x0; N[1] = y0; N[2] = x1; N[3] = y1;
    this._cap = Math.max(36, (x1 - x0 + 1) * (y1 - y0 + 1) + 2);
  }
  storeChunk(key, c) {
    c.used = performance.now();
    this.chunks.set(key, c);
    if (this.chunks.size > (this._cap || 36)) {
      const N = this._need;
      let oldK = -1, oldD = -1, oldT = Infinity;
      for (const [k, v] of this.chunks) {
        const kx = k % CN, ky = (k - kx) / CN, d = N ? Math.max(0, kx - N[2], N[0] - kx) + Math.max(0, ky - N[3], N[1] - ky) : 0;
        if (d > oldD || (d === oldD && v.used < oldT)) { oldD = d; oldT = v.used; oldK = k; }
      }
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
  invalidateChunkAt(px, py, keepCover) {
    const cx = Math.floor(px / CPX), cy = Math.floor(py / CPX);
    this.chunks.delete(cy * CN + cx);
    this.jobs.delete(cy * CN + cx);
    if (typeof G !== 'undefined' && G.ds === 2) (this.hyDirty || (this.hyDirty = [])).push([px, py, keepCover ? 1 : 0]);   // melez çizimin parçası da yenilenir (keepCover: bina örtüsü değişmedi)
  }
  /* Dikdörtgene değen statik ışıklar: her ışık bir kez, etki alanının (yarıçapın 1,5 katı, en az 90, artı 30 px)
     değdiği 128 px'lik hücrelere yazılır; her karede yalnızca dikdörtgenin hücrelerine bakılır. Sıra ana listedekiyle
     aynıdır. Kamera aynı hücrelerde kaldıkça önceki sonuç kullanılır; ışık eklenince (inşa) hücreler yeniden kurulur. */
  lightsIn(x0, y0, x1, y1) {
    const Ls = this.lights, C = 128;
    if (this._lN !== Ls.length) {
      const B = this._lB = new Map();
      for (let i = 0; i < Ls.length; i++) {
        const L = Ls[i], e = Math.max(L.r * 1.5, 90) + 30;
        for (let cy = Math.floor((L.y - e) / C); cy <= Math.floor((L.y + e) / C); cy++)
          for (let cx = Math.floor((L.x - e) / C); cx <= Math.floor((L.x + e) / C); cx++) {
            const k = (cy + 8) * 4096 + cx + 8;
            let a = B.get(k); if (!a) B.set(k, a = []);
            a.push(i);
          }
      }
      this._lN = Ls.length; this._lS = new Uint32Array(Ls.length); this._lT = 0; this._lI = new Int32Array(Ls.length); this._lQ = new Map();
    }
    const cx0 = Math.floor(x0 / C), cy0 = Math.floor(y0 / C), cx1 = Math.floor(x1 / C), cy1 = Math.floor(y1 / C);
    const qk = (((cy0 + 8) * 4096 + cx0 + 8) * 4096 + cx1 - cx0) * 4096 + cy1 - cy0;
    let O = this._lQ.get(qk);
    if (O) return O;
    const S = this._lS, I = this._lI;
    if (++this._lT > 0xfffffff0) { S.fill(0); this._lT = 1; }
    const t = this._lT;
    let n = 0;
    for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
      const a = this._lB.get((cy + 8) * 4096 + cx + 8);
      if (a) for (let j = 0; j < a.length; j++) { const i = a[j]; if (S[i] !== t) { S[i] = t; I[n++] = i; } }
    }
    const s = I.subarray(0, n).sort();
    O = new Array(n);
    for (let j = 0; j < n; j++) O[j] = Ls[s[j]];
    if (this._lQ.size >= 8) this._lQ.clear();
    this._lQ.set(qk, O);
    return O;
  }
  renderChunk(cx, cy) {
    const g = this.chunkJob(cx, cy);
    let r; do { r = g.next(); } while (!r.done);
    return r.value;
  }
  *chunkJob(cx, cy) {
    const g = makeCanvas(CPX, CPX), gc = g.getContext('2d');
    yield* this.chunkGround(cx, cy, gc);
    const ox = cx * CPX, oy = cy * CPX;
    const o = makeCanvas(CPX, CPX), oc = o.getContext('2d');
    gc.save(); oc.save();
    gc.translate(-ox, -oy); oc.translate(-ox, -oy);
    for (const r of this.rails) this.drawRail(gc, r, ox, oy);
    const tx0 = cx * CHUNK - 3, ty0 = cy * CHUNK - 3, tx1 = tx0 + CHUNK + 6, ty1 = ty0 + CHUNK + 6;
    let tY = performance.now();
    for (let ty = ty0; ty < ty1; ty++) {
      for (let tx = tx0; tx < tx1; tx++) {
        if (!this.inb(tx, ty)) continue;
        const ob = this.obj[ty * WW + tx];
        if (ob && !isHerbO(ob) && ob !== O.ARTIFACT && !(this.flags[ty * WW + tx] & 16) && !FX.dyn(ob)) {
          Spr.object(gc, oc, ob, tx * TS + 8, ty * TS + 8, hash2(tx, ty, 77), this);
          // süreye her nesneden sonra bakılır: sık ormanda tek bir karo satırı bile birkaç ms sürebilir
          if (performance.now() - tY > World.STEP) { yield 0; tY = performance.now(); }
        }
      }
    }
    for (const b of this.buildings) {
      const bx = b.x * TS, by = b.y * TS;
      if (bx + b.w * TS + 40 < ox || bx - 40 > ox + CPX || by + b.h * TS + 40 < oy || by - 60 > oy + CPX) continue;
      Spr.buildingGround(gc, b, this);
    }
    gc.restore(); oc.restore();
    return { g, o };
  }
  *chunkGround(cx, cy, gc) {
    // 1 MB'lık piksel dizisi her parçada yeniden açılmaz (yürürken sık çöp toplama); groundPixels her pikseli yazar,
    // putImageData veriyi kopyalar. Yarıda kalan pişirmenin dizisi havuza dönmez, çöpe gider.
    const pool = World.IMGP || (World.IMGP = []), img = pool.pop() || gc.createImageData(CPX, CPX);
    yield* this.groundPixels(cx * CPX, cy * CPX, CPX, CPX, img.data, null);
    gc.putImageData(img, 0, 0);
    if (pool.length < 3) pool.push(img);
    yield 0;
  }
  /* Zemin pikselleri (karo rengi, gürültü, kenar titreşimi, mevsim, kabartma) bir dikdörtgen için: 2D chunk'lar ve
     melez çizici (js/hybrid.js) kullanır. ox, oy karo sınırında olmalı. cls verilirse her pikselin (titreşimli) karo
     türü yazılır. rel verilirse (melez) her piksel için yüzey normali ve yüksekliği yazılır: [nx, ny, yükseklik];
     ışık ve gölgeyi melez çizici güneşe göre hesaplar. Klasik çizimde ışık kuzeybatıdan sabit gelir ve renge pişer.
     Kabartma: uçurumun güney kenarı CFACE piksel boyunda dikey kaya yüzüdür (katmanlar, çatlaklar, üst kenarda ışık,
     dibinde gölge), yaylanın yan ve kuzey kenarları belirgindir; yamaçlar yükselti eğimine göre ışık alır (dağda daha
     belirgin), kayalık yükseklerde kesik kesik teras çizgileri vardır; yükseldikçe renk hafifçe açılır ve soğur. */
  *groundPixels(ox, oy, PW, PH, d, cls, rel) {
    const tx0 = ox >> 4, ty0 = oy >> 4;
    const tile = this.tile, JX = World.JX, JY = World.JY, DET = World.DET, heat = this.heat, season = this.season;
    const TV = World.TV || (World.TV = new Float32Array(TINFO.map(t => t.v)));
    const MAXP = WW * TS - 1;
    const CL = World.CLF || (World.CLF = new Uint8Array(TINFO.map(t => (t.cliff ? 1 : 0))));
    const WA = World.WAF || (World.WAF = new Uint8Array(TINFO.map((t, i) => (i === T.WATER || i === T.DEEP || i === T.HOTWATER || i === T.BRIDGE ? 1 : 0))));
    // karo düzeyinde: üstünde uçurum var mı?
    const TW = (PW >> 4) + 4, TH = (PH >> 4) + 4;
    const nearCliff = new Uint8Array(TW * TH);
    for (let ty = 0; ty < TH; ty++) for (let tx = 0; tx < TW; tx++) {
      const wx = tx0 + tx - 2, wy = ty0 + ty - 2;
      let f = 0;
      for (let yy = -1; yy <= 1 && !f; yy++) for (let xx = -1; xx <= 1; xx++) if (CL[this.t(wx + xx, wy + yy)]) { f = 1; break; }
      nearCliff[ty * TW + tx] = f;
    }
    const tAt = (sx, sy) => {
      if (sx < 0) sx = 0; else if (sx > MAXP) sx = MAXP;
      if (sy < 0) sy = 0; else if (sy > MAXP) sy = MAXP;
      return tile[(sy >> 4) * WW + (sx >> 4)];
    };
    // kabartma: bölgenin yükselti ızgarası; doğal zemin (yamaç ışığı alır) ve teras çizilebilen zemin
    const HY = !!rel, RG = this.reliefGrid(tx0 - 2, ty0 - 2, (PW >> 4) + 5, (PH >> 4) + 5);
    const NAT = World.NATF || (World.NATF = new Uint8Array(TINFO.map((t, i) => (i === T.WATER || i === T.DEEP || i === T.HOTWATER || i === T.BRIDGE || i === T.PLANK || i === T.TOWN || i === T.COBBLE || i === T.PAVE ? 0 : 1))));
    const TER = World.TERF || (World.TERF = new Uint8Array(TINFO.map((t, i) => (i === T.ROCK || i === T.REDROCK || i === T.SNOW ? 1 : 0))));
    const CFACE = World.CFACE, TSTEP = 5, LX = -0.5, LY = -0.58, LZ = 0.64;
    // sinüs tablosu (1024 adım bir tur): katman ve teras dalgaları pikselde Math.sin çağırmaz
    const SIN = World.SIN || (World.SIN = Float32Array.from({ length: 1024 }, (_, i) => Math.sin(i * Math.PI / 512)));
    // karo merkezlerinde yüzey normali (yükseldikçe abartılı eğim) ve klasik çizimin kuzeybatı ışığı; pikselde ara değer
    const RN = RG.E.length, GNX = new Float32Array(RN), GNY = new Float32Array(RN), GSH = new Float32Array(RN);
    for (let i = 0; i < RN; i++) {
      const el = RG.E[i], K = 4 + 7 * (el < 150 ? 0 : el > 205 ? 1 : (el - 150) / 55), gx = RG.GX[i] * K, gy = RG.GY[i] * K, l = 1 / Math.sqrt(gx * gx + gy * gy + 1);
      const sh = 1 + (-gx * l * LX - gy * l * LY + l * LZ - LZ) * 1.5;
      GNX[i] = -gx * l; GNY[i] = -gy * l; GSH[i] = sh < 0.74 ? 0.74 : sh > 1.22 ? 1.22 : sh;
    }
    let tY = performance.now();
    // uçurum maskesi parça başına bir kez (yüz, kenar ve gölge denetimleri için kenar payıyla); uçuruma uzak karolar 0.
    // Karo merkezleri arasında çift doğrusal (titreşimli örnekle): köşeler yuvarlanır, karo karo basamaklı çapraz kenar
    // tek parça eğimli bir duvar olur (çarpışma karoda kalır, görüntü en çok birkaç piksel sapar).
    // MT: kenar karolarında maskenin istediği sınıftan en ağır köşenin karo türü (piksel o türün rengini alır), başka yerde 255.
    // RUN: pikselden güneye kesintisiz uçurum boyu (kendisi dahil): dikey yüzün dibine uzaklık.
    const MX = 8, MY = 16, MW = PW + 2 * MX, MH = PH + MY + CFACE + 4;
    let anyNC = 0;
    for (let i = 0; i < nearCliff.length; i++) if (nearCliff[i]) { anyNC = 1; break; }
    const MK = anyNC ? new Uint8Array(MW * MH) : null, MT = anyNC ? new Uint8Array(MW * MH).fill(255) : null, RUN = anyNC ? new Uint8Array(MW * MH) : null;
    if (MK) {
      // maskenin karoları (bir karo kenar payıyla, dünya dışı derin su) yerel ızgarada
      const mtx0 = (ox - MX) >> 4, mty0 = (oy - MY) >> 4, mtx1 = (ox - MX + MW - 1) >> 4, mty1 = (oy - MY + MH - 1) >> 4;
      const lx0 = mtx0 - 1, ly0 = mty0 - 1, LW = mtx1 - mtx0 + 3, LT = new Uint8Array(LW * (mty1 - mty0 + 3));
      for (let j = 0; j < mty1 - mty0 + 3; j++) for (let i = 0; i < LW; i++) { const x = lx0 + i, y = ly0 + j; LT[j * LW + i] = (x < 0 || y < 0 || x >= WW || y >= WH) ? T.DEEP : tile[y * WW + x]; }
      // karo karo: çevresi (3x3) tek türse bütün karo o değeri alır, piksel piksel hesap yalnız kenar karolarında
      for (let ty = mty0; ty <= mty1; ty++) {
        for (let tx = mtx0; tx <= mtx1; tx++) {
          const li = (ty - ly0) * LW + (tx - lx0), c0 = CL[LT[li]];
          let uni = 1;
          if (nearCliff[((ty - ty0) + 2) * TW + (tx - tx0) + 2]) for (let j = -1; j <= 1 && uni; j++) for (let i = -1; i <= 1; i++) if (CL[LT[li + j * LW + i]] !== c0) { uni = 0; break; }
          const x0 = Math.max(0, tx * TS - ox + MX), x1 = Math.min(MW, tx * TS + TS - ox + MX), y0 = Math.max(0, ty * TS - oy + MY), y1 = Math.min(MH, ty * TS + TS - oy + MY);
          if (uni) { if (c0) for (let y = y0; y < y1; y++) MK.fill(1, y * MW + x0, y * MW + x1); continue; }   // uçuruma uzak karo hep zemin
          for (let y = y0; y < y1; y++) {
            const sy = oy - MY + y, ky = (sy & 127) << 7;
            for (let x = x0; x < x1; x++) {
              const sx = ox - MX + x, kk = (sx & 127) + ky;
              const fx = (sx + JX[kk] * 0.5) * 0.0625 - 0.5, fy = (sy + JY[kk] * 0.5) * 0.0625 - 0.5, ix = Math.floor(fx), iy = Math.floor(fy), u = fx - ix, w = fy - iy;
              const la = (iy - ly0) * LW + (ix - lx0), ta = LT[la], tb = LT[la + 1], tc = LT[la + LW], td = LT[la + LW + 1];
              const a = CL[ta], b = CL[tb], c = CL[tc], e = CL[td], mi = y * MW + x;
              if (a === b && b === c && c === e) { MK[mi] = a; MT[mi] = ta; continue; }
              const wa = (1 - u) * (1 - w), wb = u * (1 - w), wc = (1 - u) * w, wd = u * w;
              const m = a * wa + b * wb + c * wc + e * wd > 0.5 ? 1 : 0;
              let bw = -1, bt = ta;
              if (a === m && wa > bw) { bw = wa; bt = ta; }
              if (b === m && wb > bw) { bw = wb; bt = tb; }
              if (c === m && wc > bw) { bw = wc; bt = tc; }
              if (e === m && wd > bw) bt = td;
              MK[mi] = m; MT[mi] = bt;
            }
          }
        }
        if (performance.now() - tY > World.STEP) { yield 0; tY = performance.now(); }
      }
      for (let y = MH - 1, i = MH * MW - 1; y >= 0; y--) for (let x = MW - 1; x >= 0; x--, i--) RUN[i] = MK[i] ? (y === MH - 1 ? 1 : RUN[i + MW] < 255 ? RUN[i + MW] + 1 : 255) : 0;
    }
    // yükselti ızgarası satır satır: karo sütunları için düşey ara değer satırda bir kez, pikselde yalnız yatay.
    // Izgara iki karo erken başlar: piksel (px, py) ızgarada (px + 24) / 16, (py + 24) / 16 noktasıdır (karo merkezi 0.5)
    const RTW = RG.tw, rowE = new Float32Array(RTW), rowX = new Float32Array(RTW), rowY = new Float32Array(RTW);
    const rowNX = new Float32Array(RTW), rowNY = new Float32Array(RTW), rowSH = new Float32Array(RTW);
    let tSg = 1e9, tFl = 0, tOn = false;   // teras parçası önbelleği
    for (let py = 0; py < PH; py++) {
      const wy = oy + py;
      const ky = (wy & 127) << 7;
      const rowT = (wy >> 4) * WW;
      const ncRow = (((wy >> 4) - ty0) + 2) * TW;
      const mrow = (py + MY) * MW + MX;
      {
        const v = ((py + 24) & 15) * 0.0625, a = ((py + 24) >> 4) * RTW, b = a + RTW;
        for (let i = 0; i < RTW; i++) {
          rowE[i] = RG.E[a + i] + (RG.E[b + i] - RG.E[a + i]) * v; rowX[i] = RG.GX[a + i] + (RG.GX[b + i] - RG.GX[a + i]) * v; rowY[i] = RG.GY[a + i] + (RG.GY[b + i] - RG.GY[a + i]) * v;
          rowNX[i] = GNX[a + i] + (GNX[b + i] - GNX[a + i]) * v; rowNY[i] = GNY[a + i] + (GNY[b + i] - GNY[a + i]) * v; rowSH[i] = GSH[a + i] + (GSH[b + i] - GSH[a + i]) * v;
        }
      }
      for (let px = 0; px < PW; px++) {
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
          else if (base === T.COBBLE || base === T.PAVE || t === T.COBBLE || t === T.PAVE) t = base;   // taş döşemenin kenarı düz (bordür, çimen sınırı)
        }
        const nc = nearCliff[ncRow + ((wx >> 4) - tx0) + 2];
        const mb = mrow + px;   // maskede bu piksel
        if (nc && base !== T.BRIDGE && base !== T.PLANK && base !== T.COBBLE && base !== T.PAVE && MK[mb] !== CL[t] && MT[mb] !== 255) t = MT[mb];
        let col = TPAL[t];
        let v = DET[k] * TV[t];
        let mul = 1;
        if (season) {
          if (season === 3) {
            const ti = base === t ? rowT + (wx >> 4) : (Math.min(MAXP, Math.max(0, wy + JY[k])) >> 4) * WW + (Math.min(MAXP, Math.max(0, wx + JX[k])) >> 4);
            const sn = (SNOW_LINE - heat[ti] / 255) * 7 + DET[k] * 0.35;
            if (sn > 0.25 && SNOWABLE[t]) {
              if (t === T.ROAD || t === T.TOWN || isStoneT(t)) { if (sn > 0.25 + (DET[k] + 0.7) * 0.45) col = SNOWC; }
              else if (CL[t]) { if (DET[k] > -0.2) col = SNOWCL; }
              else col = sn > 0.4 ? SNOWC : SNOWM;
              if (col === SNOWC || col === SNOWM || col === SNOWCL) v = DET[k] * 6;
            } else if (sn > 0.9 && (t === T.WATER || t === T.DEEP)) { col = ICE; v = DET[k] * 5; }
          } else if (season === 2 && LEAFY[t]) {
            if (t === T.FOREST && DET[k] > 0.72) col = LEAF2; else col = AUT[t];
          } else if (season === 1 && LEAFY[t]) col = SUM[t];
        }
        // ---- kabartma: yükselti, eğimden yüzey normali (yükseldikçe abartılı) ----
        const ri0 = (px + 24) >> 4, ru = ((px + 24) & 15) * 0.0625, nat = NAT[t];
        const el = rowE[ri0] + (rowE[ri0 + 1] - rowE[ri0]) * ru;
        let fnx = 0, fny = 0, fh = 0, kind = 0;   // kind: 0 yamaç, 1 uçurum yüzü, 2 yayla kenarı, 3 teras
        if (HY && nat) { fnx = rowNX[ri0] + (rowNX[ri0 + 1] - rowNX[ri0]) * ru; fny = rowNY[ri0] + (rowNY[ri0 + 1] - rowNY[ri0]) * ru; }   // klasikte normal yerine hazır ışık (rowSH)
        if (nc) {
          if (CL[t]) {
            // güneyde uçuruma ait olmayan ilk piksel: dikey yüzün dibine uzaklık (yüzden uzunsa yaylanın üstü)
            const dn = RUN[mb] <= CFACE ? RUN[mb] : 0;
            if (dn) {
              // dikey kaya yüzü (dipte 0, üst kenarda 1): dalgalı yatay katmanlar, dikey çatlaklar, üst kenarda ışık, dipte gölge
              const fy = (dn - 1) / (CFACE - 1), band = Math.floor((wy + SIN[(wx * 34 + (wx >> 5) * 163) & 1023] * 1.6) / 3);
              if (t === T.SNOWCLIFF || col === SNOWCL) { if (fy < 0.8 && hash2(wx, wy >> 2, 7) > 0.18) col = SNOWFACE; }   // karlı yüz: kaya, yer yer kar
              mul = HY ? 0.8 + 0.14 * fy : 0.56 + 0.26 * fy;
              v += (band & 1 ? -8 : 7) * (t === T.MESA ? 1.6 : 1) + (t === T.MESA && band % 3 === 0 ? 7 : 0);
              const ck = hash2(wx, 917, 5);
              fnx = 0;
              if (ck > 0.85 && ((wy * 3 + wx * 7) % 13) < 9) { v -= 13; fnx = ck > 0.93 ? 0.22 : -0.22; }
              if (dn >= CFACE - 1) v += HY ? 10 : 18;
              if (dn <= 2) mul *= 0.88;
              fny = 0.96; fh = CFACE * fy; kind = 1;
            } else {
              // yaylanın üstü: çevresindeki kayadan açık (koyu tepe çukur gibi görünürdü); batı kenarı ışık alır, doğu
              // kenarı gölgede, kuzey kenarında ince ışık
              if (col !== SNOWC && col !== SNOWM && col !== SNOWCL) col = t === T.MESA ? MESATOP : t === T.CLIFF ? CLTOP : col;
              fh = CFACE;
              if (!MK[mb - 2]) { v += HY ? 4 : 12; fnx = -0.7; fny = 0; kind = 2; }
              else if (!MK[mb + 2]) { v -= HY ? 4 : 14; fnx = 0.7; fny = 0; kind = 2; }
              else if (!MK[mb - 2 * MW]) { v += HY ? 4 : 10; fnx = 0; fny = -0.45; kind = 2; }
            }
          } else {
            if (HY) { if (MK[mb - 3 * MW]) mul = 0.86; }   // uçurumun dibi: melezde güneş gölgesi canlı hesaplanır
            else if (MK[mb - 6 * MW - 3]) mul = 0.72; else if (MK[mb - 12 * MW - 6]) mul = 0.85;   // klasik: güneş kuzeybatıdan
            // yaylanın arka ve yan kenarının dibi: zemin tarafında ince koyu çizgi (yayla yükselir)
            if (MK[mb + 2 * MW] || MK[mb - 2] || MK[mb + 2]) mul *= HY ? 0.9 : 0.8;
          }
        }
        // teras çizgileri: kayalık yüksekte, belli yükselti aralıklarında kesik kesik basamak (yüzü yokuş aşağı bakar)
        if (TER[t] && !CL[t] && el > 158) {
          const gx = rowX[ri0] + (rowX[ri0 + 1] - rowX[ri0]) * ru, gy = rowY[ri0] + (rowY[ri0 + 1] - rowY[ri0]) * ru, g = Math.sqrt(gx * gx + gy * gy);
          if (g > 0.045) {
            const q = (el + SIN[(wx * 15 + wy * 8) & 1023] * 1.3 + DET[k] * 0.5) * (1 / TSTEP), fl = Math.floor(q), fr = q - fl, ig = TSTEP / g, dd = (1 - fr) * ig;
            // yalnız basamağın yüzü ve üstündeki ince ışık şeridi (pikselin çoğu ikisinde de değil: hash'e hiç bakılmaz)
            if (dd < 2.4 || fr * ig < 1) {
              const sg = Math.floor((wx + wy * 0.6) / 9);
              if (sg !== tSg || fl !== tFl) { tSg = sg; tFl = fl; tOn = hash2(sg, fl, 61) > 0.45; }   // kesik basamak: komşu pikseller aynı parçada
              if (tOn) {
                const w = (el > 183 ? 1 : (el - 158) / 25) * (g > 0.075 ? 1 : (g - 0.045) / 0.03);
                if (dd < 2.4) { mul *= 1 - (HY ? 0.06 : 0.14) * w * (dd < 1.2 ? 1 : 0.6); fnx = -gx / g * 0.7; fny = -gy / g * 0.7; kind = 3; }   // basamağın yüzü
                else v += (HY ? 2 : 3) * w;                                                                                                      // üstünde ince ışık
              }
            }
          }
        }
        if (WA[t]) {
          if (t !== T.BRIDGE) {
            if (!WA[tAt(wx, wy - 4)]) mul *= 0.8;
            else if (((wy * 2 + (wx >> 2) + ((wx * 7) >> 5)) % 11) === 0) v += 10;
          } else { if ((wy & 3) === 0) mul = 0.7; const m = wx & 15; if (m === 0 || m === 15) mul = 0.55; }
        } else if (t === T.FARM) { if ((wy & 3) === 0) mul = 0.8; }
        else if (t === T.PLANK) { if (wx % 5 === 0) mul = 0.75; if ((wy & 15) === 15) mul = 0.6; }
        else if (t === T.ROAD) { if ((wx + wy * 3) % 9 === 0) v -= 8; }
        else if (t === T.COBBLE) {
          // arnavut kaldırımı: sıra sıra kaydırılmış küçük taşlar, aralarında koyu derz
          const row = (wy / 3) | 0, cxs = wx + (row & 1) * 2;
          if (wy % 3 === 0 || cxs % 4 === 0) mul = 0.74;
          else { v = (hash2(cxs >> 2, row, 23) - 0.5) * 22 + DET[k] * 3; if (wy % 3 === 1 && cxs % 4 === 1) v += 9; }
          // bordür ve oluk: kaldırımın kenarına bakan taşlar koyu, kuzeydeki kaldırımın bordür yüzü gölgeli
          const lx = wx & 15, ly = wy & 15, ti = rowT + (wx >> 4);
          if ((ly <= 1 && tile[ti - WW] === T.PAVE) || (lx <= 0 && tile[ti - 1] === T.PAVE) || (lx >= 15 && tile[ti + 1] === T.PAVE)) mul = 0.66;
          else if (ly >= 15 && tile[ti + WW] === T.PAVE) mul = 0.72;
        } else if (t === T.PAVE) {
          // kaldırım taşı: büyük kare levhalar
          const sx = (wx + (((wy >> 3) & 1) << 2)) & 7;
          if ((wy & 7) === 0 || sx === 0) mul = 0.84;
          else v = (hash2((wx + (((wy >> 3) & 1) << 2)) >> 3, wy >> 3, 29) - 0.5) * 10 + DET[k] * 2;
          // bordür: taşıt yoluna bakan kenarda iki piksellik açık renkli kesme taş
          const lx = wx & 15, ly = wy & 15, ti = rowT + (wx >> 4);
          if ((ly >= 14 && tile[ti + WW] === T.COBBLE) || (ly <= 1 && tile[ti - WW] === T.COBBLE) || (lx >= 14 && tile[ti + 1] === T.COBBLE) || (lx <= 1 && tile[ti - 1] === T.COBBLE)) { mul = 1; v = 15 + DET[k] * 2; }
        }
        // klasik: yamaçlar kuzeybatıdan gelen sabit ışıkla gölgelenir (melezde güneşe göre canlı). Teras basamağı ve yayla
        // kenarı da bulunduğu yamacın ışığını alır (yoksa gölgeli yamaçta basamak çevresinden açık kalıp parlak çizgi olurdu);
        // dikey uçurum yüzünün ışığı kendi hesabındadır
        if (!HY && nat && kind !== 1) mul *= rowSH[ri0] + (rowSH[ri0 + 1] - rowSH[ri0]) * ru;
        if (cls) cls[py * PW + px] = t;
        const i = (py * PW + px) << 2;
        let cr = (col[0] + v) * mul, cg = (col[1] + v) * mul, cb = (col[2] + v * 0.8) * mul;
        // yükseklik tonu: yükseldikçe hafifçe açılır ve soğur (hava perspektifi), alçak ovalar biraz koyu
        if (nat) {
          if (el > 160) { const a = (el > 220 ? 1 : (el - 160) / 60) * 0.1; cr += (196 - cr) * a; cg += (204 - cg) * a; cb += (216 - cb) * a; }
          else if (el < 80) { const a = 1 - (80 - el) / 80 * 0.07; cr *= a; cg *= a; cb *= a; }
        }
        d[i] = cr; d[i + 1] = cg; d[i + 2] = cb;
        d[i + 3] = 255;
        if (rel) { const ri = (py * PW + px) * 3; rel[ri] = fnx; rel[ri + 1] = fny; rel[ri + 2] = fh; }
      }
      // adım süresi dolunca (World.STEP) sıra kareye döner: yüksek tazelemede de kare bütçesini aşmaz
      if (performance.now() - tY > World.STEP) { yield 0; tY = performance.now(); }
    }
  }
  drawRail(ctx, r, ox, oy) {
    const x0 = ox - 20, y0 = oy - 20, x1 = ox + CPX + 20, y1 = oy + CPX + 20;
    // ray 64 noktalık dilimlere bölünür, dilimlerin sınır kutusu bir kez hesaplanır: pencereye girmeyen dilim hiç taranmaz
    // (her parça için binlerce ray noktası taranıyordu)
    const R = 64, bb = r.bb || (r.bb = World.railBoxes(r, R));
    const hit = (k, m) => !(bb[k * 4 + 2] < x0 - m || bb[k * 4] > x1 + m || bb[k * 4 + 3] < y0 - m || bb[k * 4 + 1] > y1 + m);
    ctx.lineCap = 'butt';
    for (let k = 0; k * R < r.length - 1; k++) {
      if (!hit(k, 0)) continue;
      for (let i = k * R; i < Math.min((k + 1) * R, r.length - 1); i++) {
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
    }
    for (const off of [-3, 3]) {
      ctx.strokeStyle = '#7d7d80'; ctx.lineWidth = 1.2;
      ctx.beginPath();
      let started = false;
      for (let k = 0; k * R < r.length; k++) {
        if (!hit(k, 43)) { started = false; continue; }   // dilimin bütün noktaları pencere payının dışında
        for (let i = k * R; i < Math.min((k + 1) * R, r.length); i++) {
          const [ax, ay] = r[i];
          const [bx, by] = r[Math.min(i + 1, r.length - 1)];
          const [cx, cy] = r[Math.max(i - 1, 0)];
          const L = Math.hypot(bx - cx, by - cy) || 1;
          const nx = -(by - cy) / L, ny = (bx - cx) / L;
          const px = ax + nx * off, py = ay + ny * off;
          if (px < x0 - 40 || px > x1 + 40 || py < y0 - 40 || py > y1 + 40) { started = false; continue; }
          if (!started) { ctx.moveTo(px, py); started = true; } else ctx.lineTo(px, py);
        }
      }
      ctx.stroke();
    }
  }
  // ray dilimlerinin sınır kutuları [minx, miny, maxx, maxy]; dilim bir sonraki dilimin ilk noktasını da kapsar
  static railBoxes(r, R) {
    const bb = [];
    for (let k = 0; k * R < r.length; k++) {
      let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
      for (let i = k * R; i <= Math.min((k + 1) * R, r.length - 1); i++) { const [x, y] = r[i]; if (x < a) a = x; if (y < b) b = y; if (x > c) c = x; if (y > d) d = y; }
      bb.push(a, b, c, d);
    }
    return bb;
  }
}
/* Pişirme adımının uzunluğu (ms): parça pişirme bu süre dolunca sırayı kareye bırakır. Kare bütçesi en çok bu kadar aşılır;
   144 Hz'de bir kare ~7 ms. */
World.STEP = 0.75;
World.CFACE = 14;   // uçurumun dikey kaya yüzünün boyu (piksel); melezde yaylanın yüksekliği
// yokuş (yükselti birimi/piksel, gidiş yönünde): bunun altı düz sayılır, SLOPE_STEEP dik yamaçtır (en çok etki)
// ölçüm: kayalıkta eğimin ortancası ~0.065, %90'ı 0.13'ün altında; ovada ortanca ~0.045
const SLOPE_FLAT = 0.03, SLOPE_STEEP = 0.15;

/* ==========================================================
   Dünya önbelleği: kayıt yüklenince dünya sıfırdan üretilmez.
   Üretilen dünya (kayıt uygulanmadan önceki hâli) IndexedDB'ye sıkıştırılıp yazılır; masaüstünde
   de tarayıcı deposunda durur, Steam bulutuna gitmez. Kayıt anahtarı tohum ve dildir (üretimde
   bazı adlar o anki dile çevrilir). Kayıtla birlikte üretim kodunun
   ve kullandığı tabloların özeti de saklanır: oyun güncellenince eski kayıt kullanılmaz, dünya
   yeniden üretilip yazılır. Harita resmi saklanmaz; yüklemede kaydın mevsimiyle çizilir.
   En son kullanılan birkaç dünya tutulur. window.__noWorldCache önbelleği kapatır.
   ========================================================== */
const WorldCache = {
  DB: 'frontiersend_worlds', V: 2, MAX: 4,
  last: null,   // son okuma/yazma özeti (testler ve hata ayıklama için)
  _db: null,
  ok() {
    try { return typeof indexedDB !== 'undefined' && typeof structuredClone === 'function' && !window.__noWorldCache; } catch (e) { return false; }
  },
  key(seed) { return seed + '_' + (typeof I18N !== 'undefined' ? I18N.lang : 'tr'); },
  /* Üretim kodu ve tablolarının özeti: biri değişince önbellekteki dünya geçersiz olur */
  fp() {
    const lang = typeof I18N !== 'undefined' ? I18N.lang : 'tr', id = lang;
    if (this._fp && this._fpId === id) return this._fp;
    const parts = [this.V, WW, WH, lang, String(World)];
    for (const k of Object.getOwnPropertyNames(World.prototype)) { const d = Object.getOwnPropertyDescriptor(World.prototype, k); parts.push(k, String(d.value || d.get || '')); }
    for (const f of [Noise, RNG, mulberry32, hash2, clamp, lerp, dist, dist2, turnTo, angDiff, hexToRgb, shadeHex, mixHex, segDist2, isWaterT, isCliffT, isStoneT, isHotel2, upPlan, roomOpen]) parts.push(String(f));
    parts.push(JSON.stringify([T, O, TINFO, SOLID_O, TRUNK_O, TRUNK_R, TRUNK_DY, SNOWABLE, LEAFY, [...AREA_NEUTRAL], HARVEST, SNOW_LINE, CHUNK, CG,
      BUILDINGS, TOWNS, RAIL_LINES, REGIONS, LANDMARKS, CAMPS, FARMS, PROPERTIES, UPPER, FLOOR0_WALL, INT_KEY, INT_PLANS, HEARTH_O, typeof CITY_ZONE !== 'undefined' ? [CITY_ZONE, CITY_PRIO, CITY_CARTS, CITY_RIDERS, MANSION_GARDEN] : null]));
    const s = parts.join('\u0001');
    let h1 = 0x811c9dc5, h2 = 0x9e3779b9;
    for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); h1 = Math.imul(h1 ^ c, 16777619); h2 = Math.imul(h2 ^ c, 0x5bd1e995); h2 ^= h2 >>> 15; }
    this._fpId = id;
    return this._fp = (h1 >>> 0).toString(36) + '.' + (h2 >>> 0).toString(36) + '.' + s.length;
  },
  open() {
    if (!this._db) this._db = new Promise((res, rej) => {
      const q = indexedDB.open(this.DB, 1);
      q.onupgradeneeded = () => q.result.createObjectStore('w');
      q.onsuccess = () => res(q.result);
      q.onerror = () => rej(q.error);
      q.onblocked = () => rej(new Error('IndexedDB engellendi'));
    }).catch((e) => { this._db = null; throw e; });
    return this._db;
  },
  /* Tek işlem: fn(depo, sonuç) — sonuç(v) işlemin döndüreceği değeri verir */
  async tx(mode, fn) {
    const db = await this.open();
    return new Promise((res, rej) => {
      const t = db.transaction('w', mode); let out;
      fn(t.objectStore('w'), (v) => { out = v; });
      t.oncomplete = () => res(out); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error || new Error('işlem iptal'));
    });
  },
  /* Sıkıştırılmış veri: deflate (bozulmaya karşı sağlama toplamı içerir) */
  async pipe(u8, S) { return new Uint8Array(await new Response(new Blob([u8]).stream().pipeThrough(new S('deflate'))).arrayBuffer()); },
  /* Üretimden hemen sonraki dünyanın kopyası (eşzamanlı; oyun dünyayı değiştirmeden önce alınır).
     Tipli diziler tek tampona, geri kalanı yapılandırılmış kopyayla. Bina tanımları ve kasaba
     tanımının listeleri genel tablolardandır: kopyada hangi tabloya ait oldukları yazılır, geri
     yüklemede aynı nesneye bağlanır. Başka bir genel tabloya başvuru varsa dünya önbelleğe alınmaz. */
  snapshot(w) {
    const SKIP = new Set(['mapCanvas', 'rng', 'chunks', 'jobs', 'doorFn']), order = Object.keys(w), src = {}, arrays = [];
    let bytes = 0;
    for (const k of order) {
      const v = w[k];
      if (SKIP.has(k) || k[0] === '_') continue;
      if (ArrayBuffer.isView(v)) { arrays.push([k, v]); bytes += Math.ceil(v.byteLength / 8) * 8; } else src[k] = v;
    }
    const defKey = new Map(Object.entries(BUILDINGS).map(([k, d]) => [d, k]));
    const defs = w.buildings.map(b => (b.def === undefined ? null : defKey.has(b.def) ? defKey.get(b.def) : false));
    if (defs.includes(false)) return null;
    const links = [], allowed = new Set(defKey.keys());
    w.towns.forEach((t, i) => {
      const td = TOWNS.find(d => d.id === t.id);
      if (td) for (const k of Object.keys(td)) if (td[k] && typeof td[k] === 'object' && t[k] === td[k]) { links.push([i, k]); allowed.add(td[k]); }
    });
    // genel tablolara giden başka başvuru var mı
    const tables = new Set(), seen = new Set();
    const walkT = (o, d) => { if (!o || typeof o !== 'object' || tables.has(o) || d > 8) return; tables.add(o); for (const k of Object.keys(o)) walkT(o[k], d + 1); };
    for (const t of I18N.TABLES()) walkT(t, 0);
    const st = [src];
    while (st.length) {
      const o = st.pop();
      if (!o || typeof o !== 'object' || seen.has(o) || ArrayBuffer.isView(o)) continue;
      seen.add(o);
      if (tables.has(o)) { if (allowed.has(o)) continue; return null; }
      if (o instanceof Map) { for (const [a, b] of o) st.push(a, b); continue; }
      if (o instanceof Set) { for (const a of o) st.push(a); continue; }
      for (const k of Object.keys(o)) st.push(o[k]);
    }
    const buf = new Uint8Array(bytes), ta = [];
    let off = 0;
    for (const [k, v] of arrays) { buf.set(new Uint8Array(v.buffer, v.byteOffset, v.byteLength), off); ta.push([k, v.constructor.name, v.length, off]); off += Math.ceil(v.byteLength / 8) * 8; }
    return { order, ta, buf, plain: structuredClone(src), defs, links };
  },
  /* Üretilen dünyayı arka planda yaz (oyunu bekletmez) */
  save(w) {
    if (!this.ok()) return null;
    let snap = null;
    try { snap = this.snapshot(w); } catch (e) { console.warn('dünya önbelleğe alınamadı', e); }
    if (!snap) return null;
    const key = this.key(w.seed), fp = this.fp(), t0 = performance.now();
    return this._saving = (async () => {
      const z = typeof CompressionStream !== 'undefined';
      const data = z ? await this.pipe(snap.buf, CompressionStream) : snap.buf;
      const rec = { v: this.V, fp, seed: w.seed, z, order: snap.order, ta: snap.ta, data, plain: snap.plain, defs: snap.defs, links: snap.links };
      await this.tx('readwrite', (s) => {
        s.put(rec, key);
        const q = s.get('_lru');
        q.onsuccess = () => {
          const L = q.result || {};
          L[key] = { t: Date.now(), fp };
          const keep = Object.keys(L).filter(k => L[k].fp === fp).sort((a, b) => L[b].t - L[a].t).slice(0, this.MAX);
          for (const k of Object.keys(L)) if (!keep.includes(k)) { s.delete(k); delete L[k]; }
          s.put(L, '_lru');
        };
      });
      this.last = { saved: key, saveMs: Math.round(performance.now() - t0), bytes: data.byteLength };
      return true;
    })().catch((e) => { console.warn('dünya önbelleği yazılamadı', e); return false; });
  },
  /* Önbellekteki dünya: yoksa ya da geçersizse null. Harita verilen mevsimle çizilir. */
  async load(seed, season, progress) {
    if (!this.ok()) return null;
    const t0 = performance.now(), key = this.key(seed), fp = this.fp();
    let rec = null;
    try { rec = await this.tx('readonly', (s, set) => { const q = s.get(key); q.onsuccess = () => set(q.result); }); } catch (e) { rec = null; }
    if (!rec || rec.v !== this.V || rec.fp !== fp || rec.seed !== seed) { this.last = { hit: false, key }; return null; }
    const t1 = performance.now();
    try {
      const raw = rec.z ? await this.pipe(rec.data, DecompressionStream) : rec.data, A = {}, t2 = performance.now();
      for (const [k, C, n, off] of rec.ta) A[k] = new globalThis[C](raw.buffer, raw.byteOffset + off, n);   // açılan tamponun üzerinde (8 bayt hizalı)
      const w = Object.create(World.prototype), P = rec.plain;
      for (const k of rec.order) {
        if (k in A) w[k] = A[k];
        else if (k === 'rng') w.rng = new RNG(seed * 7 + 13);   // yalnızca üretimde kullanılır
        else if (k === 'chunks' || k === 'jobs') w[k] = new Map();
        else if (k === 'mapCanvas') w.mapCanvas = null;
        else if (k in P) w[k] = P[k];
      }
      rec.defs.forEach((d, i) => { if (d !== null) w.buildings[i].def = BUILDINGS[d]; });
      for (const [i, k] of rec.links) w.towns[i][k] = TOWNS.find(d => d.id === w.towns[i].id)[k];
      const t3 = performance.now();
      if (progress) { progress(Tr('Harita çiziliyor...'), 0.85); await new Promise(r => setTimeout(r, 0)); }
      w.season = season || 0;
      const t4 = performance.now();
      w.buildMapImage();
      const t5 = performance.now();
      this.last = { hit: true, key, ms: Math.round(t5 - t0), read: Math.round(t1 - t0), unzip: Math.round(t2 - t1), build: Math.round(t3 - t2), map: Math.round(t5 - t4) };
      this.tx('readwrite', (s) => { const q = s.get('_lru'); q.onsuccess = () => { const L = q.result || {}; L[key] = { t: Date.now(), fp }; s.put(L, '_lru'); }; }).catch(() => {});
      return w;
    } catch (e) {
      console.warn('dünya önbelleği okunamadı', e);
      this.last = { hit: false, key, err: String(e) };
      this.tx('readwrite', (s) => s.delete(key)).catch(() => {});
      return null;
    }
  },
};
