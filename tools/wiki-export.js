#!/usr/bin/env node
'use strict';
/* ==========================================================
   Oyun verisini çevrimiçi rehbere (wiki, bozukartr/frontiersend) aktarır.

   Wiki'deki veri sayfaları (eşyalar, silahlar, atlar, hayvanlar, dükkânlar, işletmeler, kasabalar,
   önemli yerler, başarımlar) ve makalelerdeki sayılar (fiyatlar, süreler, sınırlar) bu dosyadan üretilir;
   böylece oyunda bir değer değişince wiki de aynı değeri gösterir. Tek kaynak oyunun kendi tablolarıdır:
   js/data.js (çalıştırılarak), lang/en.js (İngilizce adlar) ve birkaç dosyadaki tek satırlık sabitler.
   Oyunun düzyazı açıklamaları (eşya, kasaba, yer tanımları) aktarılmaz: wiki kendi sade cümlelerini kurar.

   Kullanım:
     node tools/wiki-export.js                 ../frontiersend/assets/data/game.js dosyasını yazar
     node tools/wiki-export.js --out <dosya>   başka bir yere yazar
     node tools/wiki-export.js --check [dosya] dosya güncel değilse hata verir (test kullanır)
     node tools/wiki-export.js --stdout        çıktıyı ekrana yazar
   ========================================================== */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const DEFAULT_OUT = path.join(ROOT, '..', 'frontiersend', 'assets', 'data', 'game.js');

/* ---------- oyun verisi ---------- */
function loadData() {
  const Tr = (s, ...v) => Array.isArray(s) ? s.reduce((a, p, i) => a + p + (i < v.length ? v[i] : ''), '') : s;
  const ctx = { Tr, console, Math, JSON, Object, Array, Set, Map, String, Number };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  const names = ['ITEMS', 'AMMO', 'WEAPONS', 'ANIMALS', 'FISH_POOLS', 'HORSE_BREEDS', 'TOWNS', 'DEV_TIERS', 'TOWN_KINDS', 'TOWN_GROWTH',
    'BUILDINGS', 'JOBS', 'SHOPS', 'SVC', 'LANDMARKS', 'NOMADS', 'PROPERTIES', 'MANSION_PRICE', 'SERVANTS', 'CLUB_FEE', 'CARRIAGE_PRICE',
    'CARRIAGE_WAGE', 'BUILD_TIERS', 'HOME_TYPES', 'HOME_ADDONS', 'DEED_PRICE', 'HOME_FINE', 'GOODS', 'BIZ', 'WAGON_PRICE', 'WAGON_CAP',
    'BUILD_DAYS', 'CAR_PRICE', 'CAR_YEAR', 'SECTOR_LV', 'OIL', 'INF_LV', 'BRIBE', 'PAYROLL', 'GUARD_MAX', 'BANK', 'ACHIEVEMENTS', 'SKILLS',
    'BACKGROUNDS', 'DIFFICULTIES', 'LIFE_PACES', 'RECIPES', 'START_YEAR', 'START_AGE', 'DEV_END_YEAR'];
  vm.runInContext(read('js/data.js') + `\n;globalThis.__D = { ${names.join(', ')} };`, ctx, { filename: 'data.js' });
  return ctx.__D;
}

/* başka dosyalardaki sabitler: "const AD = değer;" (tek satır) ya da çok satırlı nesne */
function constOf(file, name) {
  const src = read(file);
  const i = src.search(new RegExp(`(^|\\n)const ${name} = `));
  if (i < 0) throw new Error(`${file}: ${name} bulunamadı`);
  let j = src.indexOf('=', i) + 1;
  // değerin sonu: en dıştaki ";" (parantez ve köşeli parantez dengeli)
  let depth = 0, k = j, inStr = null;
  for (; k < src.length; k++) {
    const ch = src[k];
    if (inStr) { if (ch === '\\') k++; else if (ch === inStr) inStr = null; continue; }
    if (ch === '"' || ch === "'" || ch === '`') { inStr = ch; continue; }
    if (ch === '/' && src[k + 1] === '/') { k = src.indexOf('\n', k); continue; }
    if ('{[('.includes(ch)) depth++;
    else if ('}])'.includes(ch)) depth--;
    else if ((ch === ';' || ch === ',') && depth === 0) break;
  }
  return vm.runInNewContext('(' + src.slice(j, k) + ')');
}

/* sandık içerikleri (js/systems.js: openChest içindeki tablo) */
function chestPools() {
  const src = read('js/systems.js');
  const i = src.indexOf('const pool = {');
  const j = src.indexOf('}[loot]', i);
  if (i < 0 || j < 0) throw new Error('js/systems.js: sandık tablosu (const pool = {…}[loot]) bulunamadı');
  return vm.runInNewContext('(' + src.slice(i + 'const pool = '.length, j + 1) + ')');
}

/* önemli yer türü → sandık türü (js/world.js: yer yerleştirme switch'i) */
function landmarkChests(types) {
  const src = read('js/world.js');
  const start = src.indexOf("case 'crater':");
  if (start < 0) throw new Error("js/world.js: önemli yer yerleştirme (case 'crater':) bulunamadı");
  const out = {};
  const re = /case '([a-z]+)':/g;
  re.lastIndex = start;
  const marks = [];
  let m;
  while ((m = re.exec(src)) && marks.length < 60) { if (types.has(m[1]) && !(m[1] in out)) { out[m[1]] = null; marks.push([m[1], m.index]); } }
  marks.forEach(([t, at], n) => {
    const end = n + 1 < marks.length ? marks[n + 1][1] : src.indexOf('}', src.indexOf('default', at) > 0 ? src.indexOf('default', at) : at + 4000);
    const seg = src.slice(at, end);
    const c = seg.match(/addChest\([^)]*'([a-z]+)'\)/);
    out[t] = c ? c[1] : null;
  });
  for (const t of types) if (!(t in out)) throw new Error(`js/world.js: önemli yer türü bulunamadı: ${t}`);
  return out;
}

/* doğada toplananlar (js/world.js: HARVEST) ve cevher kayasından çıkanlar (js/systems.js: harvest) */
function gatherables() {
  const w = read('js/world.js');
  const i = w.indexOf('const HARVEST = {');
  const j = w.indexOf('};', i);
  if (i < 0 || j < 0) throw new Error('js/world.js: toplanabilirler tablosu (const HARVEST) bulunamadı');
  const gather = [...w.slice(i, j).matchAll(/item: '([a-z_]+)'/g)].map(m => m[1]).filter(x => x !== 'ore' && x !== 'artifact');
  const m = read('js/systems.js').match(/const item = r < [\d.]+ \? '([a-z_]+)' : r < [\d.]+ \? '([a-z_]+)' : '([a-z_]+)'/);
  if (!m) throw new Error('js/systems.js: cevher kayası çıktısı bulunamadı');
  return { gather, ore: [m[3], m[2], m[1]] };
}

/* ---------- İngilizce adlar ---------- */
function loadEn() {
  let dict = null, same = [];
  const ctx = { I18N: { add: (l, d) => { dict = d.t || d; same = d.same || []; } } };
  vm.createContext(ctx);
  vm.runInContext(read('lang/en.js'), ctx, { filename: 'en.js' });
  const missing = [];
  const en = (tr) => {
    if (tr == null) return tr;
    if (dict[tr] != null) return dict[tr];
    if (same.includes(tr)) return tr;
    missing.push(tr);
    return tr;
  };
  return { en, missing };
}

/* ---------- dışa aktarılacak sade veri ---------- */
function build() {
  const D = loadData();
  const { en, missing } = loadEn();
  const nm = (s) => ({ tr: s, en: en(s) });
  const pick = (o, keys) => { const r = {}; for (const k of keys) if (o[k] !== undefined) r[k] = o[k]; return r; };

  const items = {};
  for (const [id, it] of Object.entries(D.ITEMS)) {
    const r = { n: nm(it.n), c: it.c, p: it.p, max: it.max || 10 };
    if (it.e && Object.keys(it.e).length) r.e = it.e;
    if (it.coat) r.warm = it.coat.warm;
    if (it.hat) r.hat = it.hat;
    if (it.mask) r.mask = it.mask;
    for (const k of ['big', 'raw', 'cook', 'gift']) if (it[k]) r[k] = it[k];
    items[id] = r;
  }
  const weapons = {};
  for (const [id, w] of Object.entries(D.WEAPONS)) {
    if (id === 'fists') continue;
    weapons[id] = Object.assign({ n: nm(w.n) }, pick(w, ['p', 'dmg', 'clip', 'pellets', 'ammo', 'kind', 'melee', 'silent', 'throw', 'lasso', 'scope', 'item', 'range']));
  }
  const ammo = {};
  for (const [id, a] of Object.entries(D.AMMO)) ammo[id] = { n: nm(a.n), p: a.p, box: a.box, max: a.max };
  const horses = {};
  for (const [id, h] of Object.entries(D.HORSE_BREEDS)) horses[id] = { n: nm(h.n), p: h.p, spd: h.spd, sta: h.sta, hp: h.hp };
  const animals = {};
  for (const [id, a] of Object.entries(D.ANIMALS)) {
    animals[id] = Object.assign({ n: nm(a.n) }, pick(a, ['beh', 'hp', 'dmg', 'venom', 'grp', 'night', 'pelt', 'meat', 'extra', 'owned', 'tame']),
      { b: Object.keys(a.b || {}).sort((x, y) => a.b[y] - a.b[x]) });
  }
  const shops = {};
  for (const [id, s] of Object.entries(D.SHOPS)) shops[id] = Object.assign({ n: nm(s.n) }, pick(s, ['sell', 'ammo', 'weapons', 'buy']));
  const buildings = {};
  for (const [id, b] of Object.entries(D.BUILDINGS)) buildings[id] = Object.assign({ n: nm(b.n) }, pick(b, ['svc', 'shop', 'work']));
  const towns = D.TOWNS.map(t => ({
    id: t.id, n: nm(t.n), sz: t.sz, kind: D.TOWN_GROWTH[t.id] || 'hub',
    b: [...new Set([...(t.b || []), ...(t.xb || []), ...(t.rb || [])])].filter(x => x !== 'house'),
  }));
  const townKinds = {};
  for (const [k, K] of Object.entries(D.TOWN_KINDS)) townKinds[k] = { n: nm(K.n), min: K.min, max: K.max, ghost: K.ghost || 0 };
  const pools = chestPools();
  const chestOf = landmarkChests(new Set(D.LANDMARKS.map(l => l.type)));
  const landmarks = D.LANDMARKS.map(l => {
    const key = chestOf[l.type];
    const r = { id: l.id, n: nm(l.n), type: l.type };
    if (key && pools[key]) r.chest = pools[key].map(([id]) => id).filter(id => D.ITEMS[id]);
    return r;
  });
  const { gather, ore } = gatherables();
  const nomads = D.NOMADS.map(n => ({ kind: n.kind, n: nm(n.n), shop: n.shop }));
  const recipes = D.RECIPES.map(r => Object.assign({ id: r.id, n: nm(r.n), need: r.need }, r.out ? { out: r.out } : {}, r.outAmmo ? { outAmmo: r.outAmmo } : {}));
  const achievements = D.ACHIEVEMENTS.filter(a => !/^story/.test(a.id)).map(a => Object.assign({ id: a.id, n: nm(a.n), d: nm(a.d) }, a.perk ? { perk: nm(a.perk) } : {}));
  const skills = {};
  for (const [id, s] of Object.entries(D.SKILLS)) skills[id] = { n: nm(s.n), d: nm(s.d) };
  const jobs = {};
  for (const [id, j] of Object.entries(D.JOBS)) {
    const where = Object.keys(D.BUILDINGS).find(b => D.BUILDINGS[b].work === id);
    if (!where) continue;   // hikâyeye özel işler (ör. ray döşeme) kasabada yoktur
    jobs[id] = Object.assign({ n: nm(j.n), at: where }, pick(j, ['hours', 'pay', 'skill', 'bonus']));
  }
  const biz = {};
  for (const [id, b] of Object.entries(D.BIZ)) biz[id] = Object.assign({ n: nm(D.BUILDINGS[id].n) }, pick(b, ['p', 'inc', 'goods', 'tier', 'cap']));
  const goods = {};
  for (const [id, g] of Object.entries(D.GOODS)) if (g.src && g.src.length) goods[id] = { n: nm(g.n), p: g.p, src: g.src };
  const props = Object.fromEntries(D.PROPERTIES.map(p => [p.id, { n: nm(p.n), p: p.p, income: p.income || 0 }]));
  const backgrounds = Object.fromEntries(D.BACKGROUNDS.map(b => [b.id, Object.assign({ n: nm(b.n), town: b.town, money: b.money },
    b.horse ? { horse: b.horse } : {}, b.bounty ? { bounty: b.bounty } : {})]));
  const home = {
    types: Object.fromEntries(Object.entries(D.HOME_TYPES).map(([k, h]) => [k, { n: nm(D.BUILDINGS[k].n), p: h.p, days: h.days }])),
    addons: Object.fromEntries(Object.entries(D.HOME_ADDONS).map(([k, h]) => [k, { n: nm(h.n), p: h.p, days: h.days }])),
    tiers: Object.fromEntries(Object.entries(D.BUILD_TIERS).map(([k, t]) => [k, { n: nm(t.n), k: t.k }])),
    deed: D.DEED_PRICE, fine: D.HOME_FINE,
  };
  const SURV = constOf('js/systems.js', 'SURV');
  const MIN_PER_SEC = constOf('js/systems.js', 'MIN_PER_SEC');
  const c = {
    START_YEAR: D.START_YEAR, START_AGE: D.START_AGE, DEV_END_YEAR: D.DEV_END_YEAR, MIN_PER_SEC,
    TRUCE_SEC: constOf('js/systems.js', 'TRUCE_SEC'), HUNTER_MIN: constOf('js/hunters.js', 'HUNTER_MIN'),
    HORSE_CAP: constOf('js/carry.js', 'HORSE_CAP'), MAP_PINS: constOf('js/ui.js', 'MAP_PINS'),
    CLUB_ANTES: constOf('js/poker.js', 'CLUB_ANTES'), BILLIARD_BETS: constOf('js/billiards.js', 'BILLIARD_BETS'),
    MANSION_PRICE: D.MANSION_PRICE, CLUB_FEE: D.CLUB_FEE, CARRIAGE_PRICE: D.CARRIAGE_PRICE, CARRIAGE_WAGE: D.CARRIAGE_WAGE,
    WAGON_PRICE: D.WAGON_PRICE, WAGON_CAP: D.WAGON_CAP, BUILD_DAYS: D.BUILD_DAYS, CAR_PRICE: D.CAR_PRICE, CAR_YEAR: D.CAR_YEAR,
    SERVANTS: Object.fromEntries(Object.entries(D.SERVANTS).map(([k, s]) => [k, { n: nm(s.n), wage: s.wage }])),
    SECTOR_LV: D.SECTOR_LV.map(L => ({ n: nm(L.n), min: L.min, inc: L.inc, goods: L.goods, offer: L.offer })),
    INF_LV: D.INF_LV.map(L => ({ n: nm(L.n), min: L.min })),
    GUARD_MAX: D.GUARD_MAX,
    PAYROLL: pick(D.PAYROLL, ['lv', 'sign', 'wage']),
    BRIBE: pick(D.BRIBE, ['reformYear', 'reform', 'taintYrs']),
    BANK: { honor: D.BANK.honor, runDays: D.BANK.runDays, rates: D.BANK.rates.map(r => r.r) },
    OIL: pick(D.OIL, ['year', 'fields', 'well', 'wellDays', 'ref', 'refDays', 'refYear', 'refMul']),
    LIFE_PACES: D.LIFE_PACES.map(p => ({ id: p.id, n: nm(p.n), dpy: p.dpy })),
    DEV_TIERS: D.DEV_TIERS.map(nm),
    SURV,
  };
  // hesaplanmış değerler (makalelerde doğrudan kullanılır)
  const range = (p) => [Math.round(p * D.BUILD_TIERS.eco.k), Math.round(p * D.BUILD_TIERS.lux.k)];
  const d = {
    hourSec: Math.round(60 / MIN_PER_SEC), dayMin: Math.round(1440 / MIN_PER_SEC / 60),
    poisonH: SURV.POISON_MIN / 60, poisonMoreH: SURV.POISON_MORE / 60, poisonMaxH: SURV.POISON_MAX / 60,
    poisonFloorPct: Math.round(SURV.POISON_FLOOR * 100), faintPct: Math.round(SURV.FAINT_HP * 100), faintWakePct: Math.round(SURV.FAINT_WAKE * 100),
    faintCdH: SURV.FAINT_CD / 60, stage2SlowPct: Math.round((1 - SURV.STAGE2_SPD) * 100),
    sectorIncPct: D.SECTOR_LV.slice(1).map(L => Math.round((L.inc - 1) * 100)),
    sectorGoodsPct: D.SECTOR_LV.slice(1).map(L => Math.round((1 - L.goods) * 100)),
    homeRange: Object.fromEntries(Object.entries(D.HOME_TYPES).map(([k, h]) => [k, range(h.p)])),
    tierPct: Object.fromEntries(Object.entries(D.BUILD_TIERS).map(([k, t]) => [k, t.k])),
  };
  const data = {
    items, weapons, ammo, horses, animals, fish: D.FISH_POOLS, shops, buildings, towns, townKinds, landmarks, nomads, recipes,
    achievements, skills, jobs, biz, goods, props, home, backgrounds, gather, ore, svc: D.SVC, c, d,
  };
  // her bağlantı geçerli mi (dükkânın sattığı eşya, hayvanın verdiği post, tarifin malzemesi…)
  const bad = [];
  const isItem = (id) => !!items[id];
  for (const [id, s] of Object.entries(shops)) {
    for (const x of s.sell || []) if (!isItem(x)) bad.push(`dükkân ${id}: eşya yok: ${x}`);
    for (const x of s.weapons || []) if (!weapons[x]) bad.push(`dükkân ${id}: silah yok: ${x}`);
    for (const x of s.ammo || []) if (!ammo[x]) bad.push(`dükkân ${id}: mermi yok: ${x}`);
  }
  for (const [id, a] of Object.entries(animals)) for (const k of ['pelt', 'meat', 'extra']) if (a[k] && !isItem(a[k][0])) bad.push(`hayvan ${id}: ${k} yok`);
  for (const r of recipes) for (const x of Object.keys(Object.assign({}, r.need, r.out))) if (!isItem(x)) bad.push(`tarif ${r.id}: eşya yok: ${x}`);
  for (const x of [...gather, ...ore]) if (!isItem(x)) bad.push(`toplanabilir eşya yok: ${x}`);
  if (missing.length) bad.push('İngilizce adı olmayanlar: ' + [...new Set(missing)].join(', '));
  if (bad.length) throw new Error('Wiki verisi tutarsız:\n  ' + bad.join('\n  '));

  const hash = crypto.createHash('sha1').update(JSON.stringify(data)).digest('hex').slice(0, 12);
  const version = constOf('js/ui.js', 'GAME_VERSION');
  return { data: Object.assign({ meta: { game: "Frontier's End", version, hash } }, data), version, hash };
}

/* her kayıt kendi satırında: küçük ve okunur farklar */
function serialize(data, version) {
  const lines = [];
  lines.push('/* OTOMATİK ÜRETİLDİ — elle düzenlemeyin.');
  lines.push(`   Kaynak: Frontier's End oyun verisi (sürüm ${version}), bozukartr/dustbound: node tools/wiki-export.js`);
  lines.push('   Wiki veri sayfalarını (eşya, silah, at, hayvan, dükkân, işletme, kasaba, yer, başarım) ve makalelerdeki');
  lines.push('   sayıları bu dosyadan üretir. Oyunda bir değer değişince aracı yeniden çalıştırın. */');
  lines.push('(function (root) {');
  lines.push("  'use strict';");
  lines.push('  const D = {');
  for (const [k, v] of Object.entries(data)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && Object.values(v).every(x => x && typeof x === 'object') && Object.keys(v).length > 3) {
      lines.push(`    ${JSON.stringify(k)}: {`);
      for (const [kk, vv] of Object.entries(v)) lines.push(`      ${JSON.stringify(kk)}: ${JSON.stringify(vv)},`);
      lines.push('    },');
    } else if (Array.isArray(v) && v.length > 3 && v.every(x => x && typeof x === 'object')) {
      lines.push(`    ${JSON.stringify(k)}: [`);
      for (const vv of v) lines.push(`      ${JSON.stringify(vv)},`);
      lines.push('    ],');
    } else lines.push(`    ${JSON.stringify(k)}: ${JSON.stringify(v)},`);
  }
  lines.push('  };');
  lines.push("  if (typeof module === 'object' && module.exports) module.exports = D;");
  lines.push('  else root.WIKI_GAME = D;');
  lines.push("})(typeof self !== 'undefined' ? self : this);");
  return lines.join('\n') + '\n';
}

function main() {
  const args = process.argv.slice(2);
  const { data, version, hash } = build();
  const text = serialize(data, version);
  if (args.includes('--stdout')) { process.stdout.write(text); return; }
  const at = (flag) => { const i = args.indexOf(flag); return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? path.resolve(args[i + 1]) : null; };
  if (args.includes('--check')) {
    const f = at('--check') || DEFAULT_OUT;
    if (!fs.existsSync(f)) { console.error(`Wiki verisi bulunamadı: ${f}`); process.exit(2); }
    if (fs.readFileSync(f, 'utf8') !== text) {
      console.error(`Wiki verisi eski (oyun verisi ${hash}). Yenilemek için: node tools/wiki-export.js${f === DEFAULT_OUT ? '' : ' --out ' + f}`);
      process.exit(1);
    }
    console.log(`Wiki verisi güncel (${hash}).`);
    return;
  }
  const out = at('--out') || DEFAULT_OUT;
  if (!fs.existsSync(path.dirname(out))) { console.error(`Klasör yok: ${path.dirname(out)} (frontiersend deposunu oyunun yanına klonlayın ya da --out verin)`); process.exit(2); }
  fs.writeFileSync(out, text);
  console.log(`Wiki verisi yazıldı: ${out} (${(text.length / 1024).toFixed(1)} KB, oyun verisi ${hash})`);
}

if (require.main === module) {
  try { main(); } catch (e) { console.error(e.message); process.exit(1); }
}
module.exports = { build, serialize };
