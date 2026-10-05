#!/usr/bin/env node
'use strict';
/* ==========================================================
   FRONTIER'S END — ses dosyaları
   audio/sfx/ klasörüne konan ses dosyalarını tarar ve oyunun okuduğu
   audio/sfx/manifest.json dosyasını yazar. Yanında audio/sfx/LISTE.md
   (hangi ad hangi olayda çalar, hangileri eklendi) güncellenir.

   Dosya adı: <ad>.<uzantı> ya da çeşitler için <ad>_01.<uzantı>, <ad>_02 …
   (uzantı: ogg, mp3, wav, m4a, flac, webm). Aynı adın birden çok çeşidi
   varsa oyun her seferinde farklı birini seçer. Dosyası olmayan ses
   eskisi gibi kodla üretilen sesle çalar.
     node tools/sfx-manifest.js
   ========================================================== */
const fs = require('fs'), path = require('path');
const SFX = path.join(__dirname, '..', 'audio', 'sfx');

/* ad: [ne zaman çalar, ayarlar]
   vol: ses düzeyi (0-1+), pitch: rastgele perde oynaması (±oran), rev: yankı payı,
   dist: duyulma mesafesi (piksel), bus: kanal (sfx, amb, ui), loop: döngü, max: aynı anda en fazla */
const STEP = { dist: 280, max: 8, pitch: 0.08, rev: 0.2, vol: 0.32 };
const HOOF = { dist: 420, max: 10, pitch: 0.07, rev: 0.2, vol: 0.3 };
const LOOP = { bus: 'amb', loop: true, vol: 1 };
const SURF = { dirt: 'toprak', grass: 'çimen', sand: 'kum', stone: 'taş', wood: 'tahta (bina içi dahil)', mud: 'çamur', snow: 'kar', water: 'sığ su' };
const CATALOG = {
  gun_pistol: ['Tabanca atışı (oyuncu ve NPC)', { dist: 1600, max: 6, pitch: 0.05, rev: 0.9, vol: 0.9 }],
  gun_repeater: ['Tüfek (repeater) atışı; yoksa tabanca sesi', { dist: 1700, max: 6, pitch: 0.04, rev: 0.9, vol: 0.82 }],
  gun_rifle: ['Uzun namlulu tüfek atışı', { dist: 2200, max: 4, pitch: 0.03, rev: 1, vol: 0.71 }],
  gun_shotgun: ['Pompalı / av tüfeği atışı', { dist: 1600, max: 4, pitch: 0.04, rev: 0.9, vol: 0.85 }],
  gun_bow: ['Yay ile ok atışı', { dist: 500, pitch: 0.06, rev: 0.3, vol: 0.46 }],
  reload_pistol: ['Tabanca doldurma', { dist: 300, pitch: 0.03, rev: 0.15, vol: 0.5 }],
  reload_repeater: ['Tüfek doldurma', { dist: 300, pitch: 0.04, rev: 0.15, vol: 0.5 }],
  reload_shotgun: ['Pompalı doldurma', { dist: 300, pitch: 0.03, rev: 0.15, vol: 0.5 }],
  explosion: ['Dinamit patlaması', { dist: 2600, max: 3, pitch: 0.06, rev: 1, vol: 1 }],
  ricochet: ['Kurşunun taşa sekmesi', { dist: 600, pitch: 0.08, rev: 0.5, vol: 0.53 }],
  hit_flesh: ['Kurşun ya da bıçağın bedene isabeti', { dist: 500, pitch: 0.1, rev: 0.2, vol: 0.55 }],
  hit_dirt: ['Kurşunun toprağa saplanması', { dist: 500, pitch: 0.1, rev: 0.2, vol: 0.4 }],
  hit_wood: ['Kurşunun tahtaya / duvara isabeti', { dist: 500, pitch: 0.1, rev: 0.3, vol: 0.45 }],
  punch: ['Yumruk ve dipçik vuruşu', { dist: 500, pitch: 0.08, rev: 0.2, vol: 0.41 }],
  thud: ['Düşme, çarpma, ağır bir şeyin yere inmesi', { dist: 400, pitch: 0.1, rev: 0.2, vol: 0.33 }],
  ...Object.fromEntries(Object.entries(SURF).map(([k, v]) => ['step_' + k, ['Ayak sesi: ' + v + (k === 'dirt' ? ' (başka zeminin dosyası yoksa bu çalar)' : ''), STEP]])),
  ...Object.fromEntries(Object.entries(SURF).map(([k, v]) => ['hoof_' + k, ['Toynak sesi: ' + v + (k === 'dirt' ? ' (başka zeminin dosyası yoksa bu çalar)' : ''), HOOF]])),
  horse_neigh: ['At kişnemesi (ıslıkla çağırma, şahlanma)', { dist: 900, pitch: 0.06, rev: 0.6, vol: 0.37 }],
  whistle: ['Oyuncunun atını ıslıkla çağırması', { dist: 900, pitch: 0.03, rev: 0.5, vol: 0.4 }],
  growl: ['Kurt / çakal hırlaması', { dist: 600, pitch: 0.08, rev: 0.4, vol: 0.42 }],
  growl_bear: ['Ayı kükremesi', { dist: 800, pitch: 0.06, rev: 0.4, vol: 0.51 }],
  cougar: ['Puma hırlaması', { dist: 700, pitch: 0.06, rev: 0.4, vol: 0.6 }],
  wolf_howl: ['Gece uzaktan kurt uluması', { bus: 'amb', dist: 3000, pitch: 0.05, rev: 1, vol: 0.45 }],
  coyote_howl: ['Gece uzaktan çakal uluması', { bus: 'amb', dist: 3000, pitch: 0.06, rev: 1, vol: 0.4 }],
  bird: ['Gündüz kuş cıvıltısı (tekil, ara ara)', { bus: 'amb', dist: 900, pitch: 0.08, rev: 0.4, vol: 0.4 }],
  owl: ['Gece baykuş', { bus: 'amb', dist: 1500, pitch: 0.05, rev: 0.8, vol: 0.3 }],
  hawk: ['Gündüz kırda şahin çığlığı', { bus: 'amb', dist: 2500, pitch: 0.05, rev: 0.9, vol: 0.3 }],
  thunder: ['Fırtınada gök gürültüsü', { bus: 'amb', pitch: 0.08, rev: 0.3, vol: 0.63 }],
  train_whistle: ['Tren düdüğü', { bus: 'amb', dist: 4000, pitch: 0.02, rev: 0.9, vol: 0.4 }],
  amb_wind: ['Döngü: rüzgâr', LOOP],
  amb_wind_strong: ['Döngü: sert rüzgâr, fırtına', LOOP],
  amb_rain: ['Döngü: yağmur', LOOP],
  amb_fire: ['Döngü: kamp ateşi çıtırtısı', LOOP],
  amb_river: ['Döngü: nehir, akan su', LOOP],
  amb_crickets: ['Döngü: gece cırcır böcekleri', LOOP],
  amb_crowd: ['Döngü: kasaba uğultusu (gündüz)', LOOP],
  door_open: ['Bina kapısından girip çıkma', { dist: 350, pitch: 0.06, rev: 0.3, vol: 0.36 }],
  saloon_door: ['Saloon / kantina yaylı kapısı', { dist: 400, pitch: 0.05, rev: 0.3, vol: 0.36 }],
  drink: ['İçme (matara, viski, su, ilaç)', { dist: 200, pitch: 0.06, rev: 0.1, vol: 0.45 }],
  eat: ['Yemek yeme', { dist: 200, pitch: 0.06, rev: 0.1, vol: 0.45 }],
  lasso: ['Kement fırlatma (ayrıca yakın dövüşte savurma)', { dist: 400, pitch: 0.06, rev: 0.2, vol: 0.5 }],
  rope: ['İple bağlama', { dist: 300, pitch: 0.05, rev: 0.1, vol: 0.45 }],
  skin: ['Hayvan yüzme', { dist: 300, pitch: 0.06, rev: 0.1, vol: 0.45 }],
  coins: ['Para alıp verme', { bus: 'ui', pitch: 0.06, rev: 0.1, vol: 0.45 }],
  ui_move: ['Menüde gezinme', { bus: 'ui', pitch: 0.03, rev: 0, vol: 0.6 }],
  ui_ok: ['Menüde seçme / onay', { bus: 'ui', pitch: 0, rev: 0, vol: 0.59 }],
  ui_back: ['Menüden geri / kapatma', { bus: 'ui', pitch: 0, rev: 0, vol: 0.4 }],
  ui_error: ['Olmaz / hata', { bus: 'ui', pitch: 0.03, rev: 0, vol: 0.48 }],
  ui_pick: ['Eşya alma', { bus: 'ui', pitch: 0.05, rev: 0, vol: 0.38 }],
  chime: ['Bildirim, başarı', { bus: 'ui', pitch: 0, rev: 0, vol: 0.42 }],
  discover: ['Yeni yer keşfi', { bus: 'ui', pitch: 0, rev: 0, vol: 0.44 }],
};
const EXT = ['ogg', 'mp3', 'wav', 'm4a', 'flac', 'webm'];

function build(dir = SFX) {
  fs.mkdirSync(dir, { recursive: true });
  const all = fs.readdirSync(dir).filter(f => EXT.includes(f.split('.').pop().toLowerCase())).sort();
  // aynı adlı .ogg ve .mp3 tek çeşittir: .ogg asıl, .mp3 onu açamayan tarayıcının (Safari) yedeği
  const has = new Set(all);
  const files = all.filter(f => !(/\.mp3$/i.test(f) && has.has(f.replace(/\.mp3$/i, '.ogg'))));
  const man = {}, unknown = [];
  for (const f of files) {
    const base = f.slice(0, f.lastIndexOf('.'));
    const name = CATALOG[base] ? base : base.replace(/_\d+$/, '');
    if (!CATALOG[name]) { unknown.push(f); continue; }
    const M = man[name] || (man[name] = { ...CATALOG[name][1], files: [] });
    M.files.push(f);
    const mp3 = base + '.mp3';
    if (/\.ogg$/i.test(f) && has.has(mp3)) (M.alt || (M.alt = {}))[f] = mp3;
  }
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(man, null, 1) + '\n');
  const md = ['# Ses dosyaları', '',
    'Bu klasöre aşağıdaki adlarla ses dosyası koy, sonra `node tools/sfx-manifest.js` çalıştır.',
    'Çeşit için `_01`, `_02` … ekle (örneğin `gun_pistol_01.ogg`, `gun_pistol_02.ogg`). Uzantı: ' + EXT.join(', ') + '.',
    'Dosyası olmayan ses, oyunun kodla ürettiği eski sesle çalar. Döngülerin başı ve sonu kesintisiz birleşmeli.', '',
    '| Ad | Ne zaman çalar | Dosya |', '|---|---|---|',
    ...Object.entries(CATALOG).map(([k, [d]]) => `| \`${k}\` | ${d} | ${man[k] ? man[k].files.length : '–'} |`), ''];
  fs.writeFileSync(path.join(dir, 'LISTE.md'), md.join('\n'));
  return { man, unknown };
}

if (require.main === module) {
  const { man, unknown } = build();
  const n = Object.values(man).reduce((a, m) => a + m.files.length, 0);
  console.log(`${Object.keys(man).length}/${Object.keys(CATALOG).length} ses, ${n} dosya`);
  if (unknown.length) console.warn('Tanınmayan dosyalar (adı listede yok):\n  ' + unknown.join('\n  '));
}
module.exports = { CATALOG, build };
