'use strict';
/* ==========================================================
   FRONTIER'S END — oyun verileri: eşyalar, silahlar, hayvanlar,
   kasabalar, dükkanlar, başarımlar, geçmişler, isimler
   ========================================================== */

const START_YEAR = 1890;
const START_AGE = 18;
const GOAL_AGE = 80;

/* e: tüketim etkileri. raw: çiğse hastalık ihtimali. cook: pişince dönüşeceği eşya.
   gift: hediye değeri. max: yığın sınırı. */
const ITEMS = {
  // ---- Yiyecek & İçecek
  beans:        { n: 'Konserve Fasulye', c: 'food', p: 2.5, i: '🥫', e: { hunger: 32, health: 4 }, d: 'Yolun sadık dostu. Ucuz ve doyurucu.' },
  bread:        { n: 'Ekmek', c: 'food', p: 1, i: '🍞', e: { hunger: 18 }, d: 'Fırından yeni çıkmış taze bir somun.' },
  jerky:        { n: 'Kuru Et', c: 'food', p: 1.5, i: '🥓', e: { hunger: 15, stamina: 10 }, max: 15, d: 'Tuzlanmış ve kurutulmuş sığır eti.' },
  apple:        { n: 'Elma', c: 'food', p: 0.5, i: '🍎', e: { hunger: 8, thirst: 6 }, max: 20, d: 'Kıtır kıtır bir elma.' },
  berries:      { n: 'Yaban Mersini', c: 'food', p: 0.3, i: '🫐', e: { hunger: 5, thirst: 4 }, max: 30, d: 'Çalılardan toplanmış taze meyveler.' },
  peaches:      { n: 'Konserve Şeftali', c: 'food', p: 2, i: '🍑', e: { hunger: 20, thirst: 18 }, d: 'Şuruplu şeftali. Hem doyurur hem susuzluğu giderir.' },
  corn:         { n: 'Mısır', c: 'food', p: 0.6, i: '🌽', e: { hunger: 12 }, max: 15, d: 'Tarladan taze koçan.' },
  chocolate:    { n: 'Çikolata', c: 'food', p: 1.5, i: '🍫', e: { hunger: 8, stamina: 25 }, gift: 10, d: 'Doğu\'dan gelen lüks bir tatlı. Güzel bir hediye olur.' },
  raw_game:     { n: 'Çiğ Av Eti', c: 'food', p: 1, i: '🥩', e: { hunger: 12 }, raw: 0.35, cook: 'cooked_game', max: 15, d: 'Pişirilmeden yenirse hasta edebilir.' },
  cooked_game:  { n: 'Pişmiş Av Eti', c: 'food', p: 2, i: '🍖', e: { hunger: 36, health: 10 }, max: 15, d: 'Kamp ateşinde kızartılmış et.' },
  raw_big:      { n: 'Çiğ İri Et', c: 'food', p: 2, i: '🥩', e: { hunger: 18 }, raw: 0.4, cook: 'cooked_big', max: 10, d: 'Büyük av hayvanından kesilmiş et.' },
  cooked_big:   { n: 'Pişmiş Biftek', c: 'food', p: 4, i: '🍖', e: { hunger: 55, health: 20, stamina: 20 }, max: 10, d: 'Kalın, sulu bir biftek.' },
  raw_bird:     { n: 'Çiğ Kuş Eti', c: 'food', p: 0.8, i: '🍗', e: { hunger: 8 }, raw: 0.45, cook: 'cooked_bird', max: 15, d: 'Pişirmeden yeme.' },
  cooked_bird:  { n: 'Kızarmış Kuş', c: 'food', p: 1.6, i: '🍗', e: { hunger: 25, health: 6 }, max: 15, d: 'Nar gibi kızarmış kuş eti.' },
  raw_fish:     { n: 'Çiğ Balık', c: 'food', p: 1.2, i: '🐟', e: { hunger: 10 }, raw: 0.3, cook: 'cooked_fish', max: 15, d: 'Nehirden taze tutulmuş.' },
  cooked_fish:  { n: 'Pişmiş Balık', c: 'food', p: 2.2, i: '🐠', e: { hunger: 30, health: 12 }, max: 15, d: 'Közde pişmiş balık.' },
  stew:         { n: 'Güveç', c: 'food', p: 3, i: '🍲', e: { hunger: 60, thirst: 20, health: 25, warmth: 30 }, max: 5, d: 'Sıcacık, insanın içini ısıtan bir güveç.' },
  coffee:       { n: 'Kahve', c: 'food', p: 1, i: '☕', e: { thirst: 10, energy: 12, deadeye: 25, warmth: 15 }, d: 'Sabahların vazgeçilmezi. Odaklanmanı sağlar.' },
  beer:         { n: 'Bira', c: 'food', p: 0.5, i: '🍺', e: { thirst: 14, drunk: 14 }, d: 'Serin bir bira.' },
  whiskey:      { n: 'Viski', c: 'food', p: 2, i: '🥃', e: { thirst: 4, health: 10, drunk: 30, warmth: 20, deadeye: 10 }, d: 'Boğazı yakar, içini ısıtır.' },
  // ---- İlaç
  health_cure:  { n: 'Sağlık İksiri', c: 'med', p: 5, i: '🧪', e: { health: 60 }, d: 'Yaraları hızla sarar.' },
  stamina_tonic:{ n: 'Enerji Toniği', c: 'med', p: 3, i: '🍶', e: { stamina: 100, energy: 10 }, d: 'Yorgunluğu anında giderir.' },
  snake_oil:    { n: 'Yılan Yağı', c: 'med', p: 4, i: '🫙', e: { deadeye: 100, cure: 1 }, d: 'Şarlatanların meşhur iksiri. Şaşırtıcı biçimde işe yarıyor.' },
  antidote:     { n: 'Panzehir', c: 'med', p: 5, i: '💊', e: { poison: 1, health: 10 }, max: 5, d: 'Yılan zehrine karşı.' },
  bandage:      { n: 'Bandaj', c: 'med', p: 1.5, i: '🩹', e: { health: 25 }, d: 'Temiz bez sargı.' },
  herbal_tonic: { n: 'Bitki Toniği', c: 'med', p: 3, i: '🧉', e: { health: 35, cure: 1, energy: 5 }, d: 'Kendi yaptığın şifalı karışım.' },
  tobacco:      { n: 'Çiğneme Tütünü', c: 'med', p: 1, i: '🌿', e: { deadeye: 40 }, d: 'Dikkati keskinleştirir.' },
  cigarette:    { n: 'Sigara', c: 'med', p: 0.5, i: '🚬', e: { deadeye: 30, stamina: -5 }, max: 20, d: 'Bir nefes huzur.' },
  // ---- Bitkiler
  ginseng:      { n: 'Ginseng', c: 'herb', p: 1.2, i: '🌱', e: { stamina: 15 }, max: 30, d: 'Güç veren kök.' },
  yarrow:       { n: 'Civanperçemi', c: 'herb', p: 0.8, i: '🌼', e: { health: 8 }, max: 30, d: 'Yara iyileştirici çiçek.' },
  sage:         { n: 'Adaçayı', c: 'herb', p: 0.6, i: '🌿', e: { deadeye: 10 }, max: 30, d: 'Çölün kokulu otu.' },
  mint:         { n: 'Nane', c: 'herb', p: 0.5, i: '🍃', e: { thirst: 5, stamina: 5 }, max: 30, d: 'Serinletici yapraklar.' },
  oregano:      { n: 'Kekik', c: 'herb', p: 0.6, i: '🌿', e: { health: 4 }, max: 30, d: 'Yemeklere lezzet katar.' },
  milkweed:     { n: 'İpekotu', c: 'herb', p: 0.5, i: '🌾', e: { energy: 4 }, max: 30, d: 'Tonik yapımında kullanılır.' },
  mushroom:     { n: 'Mantar', c: 'herb', p: 0.7, i: '🍄', e: { hunger: 6 }, max: 30, d: 'Yenilebilir orman mantarı.' },
  wildflower:   { n: 'Kır Çiçeği', c: 'herb', p: 0.4, i: '💐', gift: 6, max: 30, d: 'Birine hediye etmek için ideal.' },
  // ---- Hayvansal ürünler
  rabbit_pelt:  { n: 'Tavşan Postu', c: 'animal', p: 1.5, i: '🐇', max: 30 },
  deer_hide:    { n: 'Geyik Derisi', c: 'animal', p: 4, i: '🦌', max: 20 },
  elk_hide:     { n: 'Kızıl Geyik Derisi', c: 'animal', p: 7, i: '🦌', max: 15 },
  prong_hide:   { n: 'Antilop Derisi', c: 'animal', p: 5, i: '🦌', max: 20 },
  wolf_pelt:    { n: 'Kurt Postu', c: 'animal', p: 8, i: '🐺', max: 20 },
  coyote_pelt:  { n: 'Çakal Postu', c: 'animal', p: 4, i: '🐕', max: 20 },
  fox_pelt:     { n: 'Tilki Postu', c: 'animal', p: 6, i: '🦊', max: 20 },
  bear_pelt:    { n: 'Ayı Postu', c: 'animal', p: 25, i: '🐻', max: 10 },
  bison_hide:   { n: 'Bizon Derisi', c: 'animal', p: 15, i: '🦬', max: 10 },
  cougar_pelt:  { n: 'Puma Postu', c: 'animal', p: 18, i: '🐆', max: 10 },
  boar_hide:    { n: 'Yaban Domuzu Derisi', c: 'animal', p: 5, i: '🐗', max: 20 },
  gator_skin:   { n: 'Timsah Derisi', c: 'animal', p: 20, i: '🐊', max: 10 },
  snake_skin:   { n: 'Yılan Derisi', c: 'animal', p: 3, i: '🐍', max: 20 },
  horse_hide:   { n: 'At Derisi', c: 'animal', p: 4, i: '🐴', max: 10 },
  feather:      { n: 'Tüy', c: 'animal', p: 0.3, i: '🪶', max: 60 },
  antler:       { n: 'Geyik Boynuzu', c: 'animal', p: 3, i: '🦌', max: 20 },
  // ---- Balıklar
  fish_perch:   { n: 'Levrek', c: 'food', p: 2, i: '🐟', e: { hunger: 10 }, raw: 0.3, cook: 'cooked_fish', max: 15, d: 'Küçük ama lezzetli.' },
  fish_bass:    { n: 'Karabalık', c: 'food', p: 3.5, i: '🐟', e: { hunger: 12 }, raw: 0.3, cook: 'cooked_fish', max: 15, d: 'Güzel bir av.' },
  fish_trout:   { n: 'Alabalık', c: 'food', p: 4, i: '🐟', e: { hunger: 12 }, raw: 0.3, cook: 'cooked_fish', max: 15, d: 'Soğuk suların balığı.' },
  fish_catfish: { n: 'Yayın Balığı', c: 'food', p: 5, i: '🐡', e: { hunger: 16 }, raw: 0.3, cook: 'cooked_fish', max: 10, d: 'Bataklıkların bıyıklı devi.' },
  fish_salmon:  { n: 'Somon', c: 'food', p: 6, i: '🐟', e: { hunger: 18 }, raw: 0.3, cook: 'cooked_fish', max: 10, d: 'Kuzeyin değerli balığı.' },
  fish_pike:    { n: 'Turna Balığı', c: 'food', p: 7, i: '🐟', e: { hunger: 18 }, raw: 0.3, cook: 'cooked_fish', max: 10, d: 'Dişli ve inatçı.' },
  // ---- Değerli
  gold_nugget:  { n: 'Altın Parçası', c: 'valuable', p: 12, i: '✨', max: 99, d: 'Nehir yatağından çıkan saf altın.' },
  silver_ore:   { n: 'Gümüş Cevheri', c: 'valuable', p: 5, i: '⚪', max: 50 },
  iron_ore:     { n: 'Demir Cevheri', c: 'valuable', p: 1.5, i: '🪨', max: 50 },
  gold_bar:     { n: 'Altın Külçe', c: 'valuable', p: 250, i: '🟨', max: 10, d: 'Bir servet.' },
  pocket_watch: { n: 'Cep Saati', c: 'valuable', p: 15, i: '⏱️', max: 20 },
  gold_ring:    { n: 'Altın Yüzük', c: 'valuable', p: 20, i: '💍', max: 20, gift: 25, d: 'Evlilik teklifi için de kullanılabilir.' },
  necklace:     { n: 'İnci Kolye', c: 'valuable', p: 18, i: '📿', max: 20, gift: 20 },
  meteorite:    { n: 'Göktaşı Parçası', c: 'valuable', p: 60, i: '☄️', max: 5, d: 'Gökten düşmüş bir taş. Koleksiyoncular bayılır.' },
  // ---- Koleksiyon
  arrowhead:    { n: 'Ok Ucu', c: 'collect', p: 4, i: '🔺', max: 50, d: 'Eski zamanlardan kalma yontulmuş taş.' },
  dino_bone:    { n: 'Dinozor Kemiği', c: 'collect', p: 10, i: '🦴', max: 30, d: 'Taşlaşmış kadim bir kemik.' },
  old_coin:     { n: 'Eski Sikke', c: 'collect', p: 6, i: '🪙', max: 50, d: 'İspanyol döneminden kalma bir sikke.' },
  cig_card:     { n: 'Sigara Kartı', c: 'collect', p: 2, i: '🃏', max: 50, d: 'Paketlerden çıkan koleksiyon kartı.' },
  // ---- Aletler
  bedroll:      { n: 'Uyku Tulumu', c: 'tool', p: 8, i: '🛏️', max: 1, d: 'Vahşi doğada kamp kurmanı sağlar.' },
  fishing_rod:  { n: 'Olta', c: 'tool', p: 6, i: '🎣', max: 1, d: 'Su kenarında balık tutmanı sağlar.' },
  gold_pan:     { n: 'Altın Eleği', c: 'tool', p: 5, i: '🥘', max: 1, d: 'Nehir yataklarında altın aramak için.' },
  pickaxe:      { n: 'Kazma', c: 'tool', p: 7, i: '⛏️', max: 1, d: 'Cevher kayalarını kazmak için.' },
  shovel:       { n: 'Kürek', c: 'tool', p: 5, i: '⚒️', max: 1, d: 'Hazine kazmak için.' },
  canteen:      { n: 'Matara', c: 'tool', p: 3, i: '🫗', max: 1, d: 'Su taşımanı sağlar. Kuyu ve nehirlerde doldur.' },
  lantern:      { n: 'Fener', c: 'tool', p: 4, i: '🏮', max: 1, d: 'Karanlıkta yolunu aydınlatır.' },
  hay:          { n: 'Saman', c: 'horse', p: 0.5, i: '🌾', max: 15, d: 'Atını besler, sağlığını ve dayanıklılığını yeniler.' },
  horse_brush:  { n: 'At Fırçası', c: 'tool', p: 2, i: '🧹', max: 1, d: 'Atını temizler, bağınızı güçlendirir.' },
  horse_reviver:{ n: 'At Diriltici', c: 'horse', p: 8, i: '💉', max: 5, d: 'Yaralı atını ayağa kaldırır.' },
  horse_tonic:  { n: 'At Toniği', c: 'horse', p: 3, i: '🍶', max: 10, d: 'Atının dayanıklılığını yeniler.' },
  harmonica:    { n: 'Mızıka', c: 'tool', p: 3, i: '🎵', max: 1, d: 'Kamp ateşinin başında çalınır. Ruhu dinlendirir.' },
  bait:         { n: 'Solucan Yem', c: 'tool', p: 0.3, i: '🪱', max: 30, d: 'Balıklar daha çabuk vurur.' },
  // ---- Belgeler
  treasure_map: { n: 'Hazine Haritası', c: 'doc', p: 0, i: '🗺️', max: 5, d: 'Kürekle işaretli yeri kaz.' },
  region_map:   { n: 'Bölge Haritası', c: 'doc', p: 3, i: '📜', max: 1, d: 'Satın alındığı kasabanın çevresini haritanda açar.', autoUse: true },
  // ---- Giysiler
  coat_duster:   { n: 'Uzun Palto', c: 'clothing', p: 18, i: '🧥', max: 1, coat: { warm: 5, col: '#6b5a44', len: 1 }, d: 'Toz ve rüzgara karşı. (+5°C)' },
  coat_sheep:    { n: 'Kuzu Postu Ceket', c: 'clothing', p: 35, i: '🧥', max: 1, coat: { warm: 11, col: '#8a6a4a', len: 0.6 }, d: 'Sıcak tutar. (+11°C)' },
  coat_fur:      { n: 'Kürk Manto', c: 'clothing', p: 60, i: '🧥', max: 1, coat: { warm: 18, col: '#4a3a2c', len: 0.9 }, d: 'Kuzeyin dondurucu soğuğu için. (+18°C)' },
  coat_poncho:   { n: 'Panço', c: 'clothing', p: 12, i: '🧣', max: 1, coat: { warm: 3, col: '#9a4a2a', len: 0.5, rain: 1 }, d: 'Yağmurdan korur. (+3°C)' },
  coat_linen:    { n: 'Keten Gömlek', c: 'clothing', p: 9, i: '👕', max: 1, coat: { warm: -5, col: '#d8cdb4', len: 0 }, d: 'Sıcak çölde serin tutar. (-5°C)' },
  hat_cowboy:    { n: 'Kovboy Şapkası', c: 'clothing', p: 6, i: '🤠', max: 1, hat: 'cowboy', d: 'Güneşten korur.' },
  hat_bowler:    { n: 'Melon Şapka', c: 'clothing', p: 8, i: '🎩', max: 1, hat: 'bowler' },
  hat_flat:      { n: 'Kasket', c: 'clothing', p: 4, i: '🧢', max: 1, hat: 'flat' },
  hat_wide:      { n: 'Geniş Kenarlı Şapka', c: 'clothing', p: 10, i: '👒', max: 1, hat: 'wide', d: 'Çölde hayat kurtarır.' },
  mask_bandana:  { n: 'Bandana', c: 'clothing', p: 2, i: '🎭', max: 1, mask: 'bandana', d: 'Yüzünün alt yarısını örter. Maskeliyken işlenen suçlar sana yazılmaz — ama maskeyi birileri görürken çıkarma.' },
  mask_sack:     { n: 'Çuval Maske', c: 'clothing', p: 1, i: '🎭', max: 1, mask: 'sack', d: 'Göz delikleri açılmış bir un çuvalı. Kimse yüzünü göremez; ama herkes sana bakar.' },
  // ---- Patlayıcı
  dynamite:      { n: 'Dinamit', c: 'ammo', p: 6, i: '🧨', max: 5, d: 'Atılabilir. Dikkatli kullan.' },
};
for (const k in ITEMS) { const it = ITEMS[k]; it.id = k; if (!it.max) it.max = 10; if (!it.d) it.d = ''; }

const ITEM_CATS = [
  { id: 'food', n: 'Yiyecek' }, { id: 'med', n: 'İlaç' }, { id: 'herb', n: 'Bitki' },
  { id: 'animal', n: 'Av Ürünü' }, { id: 'valuable', n: 'Değerli' }, { id: 'collect', n: 'Koleksiyon' },
  { id: 'tool', n: 'Alet' }, { id: 'horse', n: 'At' }, { id: 'doc', n: 'Belge' }, { id: 'clothing', n: 'Giysi' }, { id: 'ammo', n: 'Patlayıcı' },
];

/* Silahlar. slot: silah çarkındaki yeri. */
const AMMO = {
  pistol:  { n: 'Tabanca Mermisi', box: 12, p: 1.5, max: 96 },
  repeater:{ n: 'Karabina Mermisi', box: 12, p: 2, max: 96 },
  rifle:   { n: 'Tüfek Mermisi', box: 10, p: 3, max: 60 },
  shotgun: { n: 'Saçma Fişeği', box: 8, p: 2.5, max: 48 },
  arrow:   { n: 'Ok', box: 10, p: 1.5, max: 40 },
};
const WEAPONS = {
  fists:     { n: 'Yumruk', slot: 0, melee: true, dmg: 10, rate: 0.45, range: 14, i: '✊' },
  knife:     { n: 'Av Bıçağı', slot: 1, melee: true, dmg: 32, rate: 0.5, range: 16, i: '🔪', p: 5 },
  cattleman: { n: 'Drover Tabanca', slot: 2, ammo: 'pistol', dmg: 34, rate: 0.38, clip: 6, reload: 1.9, spread: 0.05, range: 260, i: '🔫', p: 55, kind: 'pistol' },
  schofield: { n: 'Schofield Tabanca', slot: 2, ammo: 'pistol', dmg: 42, rate: 0.3, clip: 6, reload: 1.5, spread: 0.04, range: 280, i: '🔫', p: 170, kind: 'pistol' },
  repeater:  { n: 'Karabina Tüfeği', slot: 3, ammo: 'repeater', dmg: 46, rate: 0.55, clip: 12, reload: 2.4, spread: 0.03, range: 340, i: '🔫', p: 120, kind: 'long' },
  winchester:{ n: 'Plainsman Tüfeği', slot: 3, ammo: 'repeater', dmg: 52, rate: 0.45, clip: 14, reload: 2.2, spread: 0.025, range: 360, i: '🔫', p: 260, kind: 'long' },
  rifle:     { n: 'Rolling Block Tüfek', slot: 4, ammo: 'rifle', dmg: 120, rate: 1.3, clip: 1, reload: 1.6, spread: 0.008, range: 560, i: '🎯', p: 240, kind: 'long', scope: true },
  shotgun:   { n: 'Çift Namlulu Av Tüfeği', slot: 5, ammo: 'shotgun', dmg: 22, pellets: 7, rate: 0.5, clip: 2, reload: 2.2, spread: 0.2, range: 150, i: '💥', p: 150, kind: 'long' },
  bow:       { n: 'Av Yayı', slot: 6, ammo: 'arrow', dmg: 75, rate: 0.9, clip: 1, reload: 0.5, spread: 0.02, range: 320, i: '🏹', p: 45, kind: 'bow', silent: true, projectile: true },
  dynamite:  { n: 'Dinamit', slot: 7, item: 'dynamite', dmg: 220, rate: 1.0, i: '🧨', throw: true },
};
const WHEEL_SLOTS = [
  { n: 'Silahsız', w: ['fists'] },
  { n: 'Bıçak', w: ['knife'] },
  { n: 'Tabanca', w: ['schofield', 'cattleman'] },
  { n: 'Karabina', w: ['winchester', 'repeater'] },
  { n: 'Uzun Tüfek', w: ['rifle'] },
  { n: 'Av Tüfeği', w: ['shotgun'] },
  { n: 'Yay', w: ['bow'] },
  { n: 'Atılabilir', w: ['dynamite'] },
];
/* Eşya çarkı (ikinci sayfa): her yuva bir kategori; yuvadaki eşyalar arasında ←/→ ile geçilir.
   '@' ile başlayanlar sanal eşyalardır (matara, fener, mızıka). */
const DRINKS = ['coffee', 'beer', 'whiskey'];
const ITEM_SLOTS = [
  { n: 'Yiyecek', g: 'meat', f: (id, it) => it.c === 'food' && !DRINKS.includes(id) },
  { n: 'İçecek', g: 'drop', v: ['@canteen'], f: (id) => DRINKS.includes(id) },
  { n: 'İlaç & Tonik', g: 'heart', f: (id, it) => it.c === 'med' && id !== 'tobacco' && id !== 'cigarette' },
  { n: 'Tütün', g: 'steam', f: (id) => id === 'cigarette' || id === 'tobacco' },
  { n: 'Bitkiler', g: 'wheat', f: (id, it) => it.c === 'herb' && !!it.e },
  { n: 'At', g: 'horse', f: (id, it) => it.c === 'horse' },
  { n: 'Kit', g: 'lamp', v: ['@lantern', '@harmonica'], f: (id) => id === 'treasure_map' || id === 'region_map' },
  { n: 'Giysi', g: 'mask', f: (id, it) => it.c === 'clothing' },
];

/* Hayvanlar. b: biyom ağırlıkları. beh: flee | hostile | skittish | passive */
const ANIMALS = {
  rabbit:   { n: 'Tavşan', hp: 10, spd: 95, len: 4, wid: 3, col: '#8a7560', col2: '#d8cfc0', beh: 'flee', sense: 70, pelt: ['rabbit_pelt', 1], meat: ['raw_game', 1], xp: 4, b: { GRASS: 3, DRY: 3, FOREST: 2, DESERT: 1, SNOW: 1.5 }, grp: [1, 1], shape: 'small' },
  deer:     { n: 'Geyik', hp: 45, spd: 92, len: 12, wid: 5, col: '#9a7048', col2: '#e8dcc8', beh: 'flee', sense: 120, pelt: ['deer_hide', 1], meat: ['raw_game', 2], extra: ['antler', 0.5], xp: 12, b: { FOREST: 4, GRASS: 2 }, grp: [1, 3], antler: 1 },
  elk:      { n: 'Kızıl Geyik', hp: 100, spd: 88, len: 15, wid: 6, col: '#7a5236', col2: '#c8a878', beh: 'flee', sense: 130, pelt: ['elk_hide', 1], meat: ['raw_big', 2], extra: ['antler', 0.8], xp: 20, b: { FOREST: 1, ROCK: 2, SNOW: 1.5 }, grp: [1, 3], antler: 2 },
  pronghorn:{ n: 'Antilop', hp: 40, spd: 110, len: 11, wid: 4.5, col: '#c89a60', col2: '#f0e8d8', beh: 'flee', sense: 140, pelt: ['prong_hide', 1], meat: ['raw_game', 2], xp: 12, b: { DRY: 3, DESERT: 1 }, grp: [2, 4] },
  bison:    { n: 'Bizon', hp: 240, spd: 72, len: 20, wid: 9, col: '#4a3322', col2: '#2a1c12', beh: 'flee', sense: 90, pelt: ['bison_hide', 1], meat: ['raw_big', 4], xp: 30, b: { DRY: 2.5, GRASS: 1 }, grp: [3, 6], hump: 1 },
  wolf:     { n: 'Kurt', hp: 60, spd: 110, len: 11, wid: 4, col: '#7d7d7d', col2: '#bdbdbd', beh: 'hostile', dmg: 12, aggro: 140, sense: 180, pelt: ['wolf_pelt', 1], meat: ['raw_game', 1], xp: 18, b: { FOREST: 0.7, SNOW: 2, ROCK: 0.8 }, grp: [2, 3], night: 3 },
  coyote:   { n: 'Çakal', hp: 35, spd: 105, len: 9, wid: 3.5, col: '#a08260', col2: '#d8c8a8', beh: 'skittish', dmg: 7, aggro: 60, sense: 130, pelt: ['coyote_pelt', 1], meat: ['raw_game', 1], xp: 8, b: { DESERT: 2, DRY: 2, REDROCK: 1.5 }, grp: [1, 3], night: 1.8 },
  fox:      { n: 'Tilki', hp: 25, spd: 105, len: 8, wid: 3, col: '#c0602a', col2: '#f0e0d0', beh: 'flee', sense: 110, pelt: ['fox_pelt', 1], meat: ['raw_game', 1], xp: 8, b: { FOREST: 1.5, GRASS: 1, SNOW: 1 }, grp: [1, 1] },
  bear:     { n: 'Boz Ayı', hp: 320, spd: 98, len: 17, wid: 10, col: '#4a3020', col2: '#6a4a32', beh: 'hostile', dmg: 34, aggro: 110, sense: 150, pelt: ['bear_pelt', 1], meat: ['raw_big', 4], xp: 45, b: { FOREST: 0.8, SNOW: 0.8, ROCK: 0.4 }, grp: [1, 1], bear: 1 },
  cougar:   { n: 'Puma', hp: 120, spd: 125, len: 13, wid: 4.5, col: '#b8905c', col2: '#e0c8a0', beh: 'hostile', dmg: 24, aggro: 150, sense: 200, pelt: ['cougar_pelt', 1], meat: ['raw_game', 2], xp: 35, b: { ROCK: 1.6, REDROCK: 1, FOREST: 0.3 }, grp: [1, 1], tail: 1 },
  boar:     { n: 'Yaban Domuzu', hp: 75, spd: 90, len: 11, wid: 6, col: '#3e3028', col2: '#5e4a3e', beh: 'hostile', dmg: 14, aggro: 80, sense: 120, pelt: ['boar_hide', 1], meat: ['raw_game', 2], xp: 14, b: { SWAMP: 2, FOREST: 0.8 }, grp: [1, 2] },
  gator:    { n: 'Timsah', hp: 180, spd: 70, len: 22, wid: 5, col: '#4a5a36', col2: '#6a7a4a', beh: 'hostile', dmg: 30, aggro: 75, sense: 90, pelt: ['gator_skin', 1], meat: ['raw_big', 2], xp: 35, b: { SWAMP: 2.5 }, grp: [1, 1], shape: 'gator' },
  snake:    { n: 'Çıngıraklı Yılan', hp: 8, spd: 35, len: 12, wid: 2, col: '#8a7048', col2: '#4a3a24', beh: 'hostile', dmg: 6, venom: 1, aggro: 38, sense: 60, pelt: ['snake_skin', 1], xp: 6, b: { DESERT: 2, REDROCK: 2, DRY: 0.8, SWAMP: 0.8 }, grp: [1, 1], shape: 'snake' },
  turkey:   { n: 'Yaban Hindisi', hp: 14, spd: 70, len: 6, wid: 4, col: '#4a3a30', col2: '#a03020', beh: 'flee', sense: 90, pelt: ['feather', 4], meat: ['raw_bird', 1], xp: 5, b: { FOREST: 2, GRASS: 1.2 }, grp: [2, 4], shape: 'bird' },
  whorse:   { n: 'Yabani At', hp: 130, spd: 135, len: 18, wid: 6, col: '#8a5a34', col2: '#2a1c14', beh: 'flee', sense: 150, pelt: ['horse_hide', 1], meat: ['raw_big', 2], xp: 10, b: { DRY: 1.2, GRASS: 0.8 }, grp: [2, 4], shape: 'horse', tame: 1 },
  cow:      { n: 'İnek', hp: 120, spd: 40, len: 16, wid: 7, col: '#e8e0d8', col2: '#2a2420', beh: 'passive', sense: 40, pelt: ['deer_hide', 1], meat: ['raw_big', 3], xp: 2, b: {}, grp: [1, 1], owned: 1 },
  chicken:  { n: 'Tavuk', hp: 6, spd: 50, len: 4, wid: 3, col: '#e8e4dc', col2: '#c83020', beh: 'flee', sense: 50, pelt: ['feather', 2], meat: ['raw_bird', 1], xp: 1, b: {}, grp: [1, 1], shape: 'bird', owned: 1 },
};

const HORSE_BREEDS = {
  nag:        { n: 'Yaşlı Kısrak', p: 0, spd: 0.86, sta: 85, hp: 90, cols: ['#6b4a2e', '#7a6a5a'] },
  morgan:     { n: 'Morgan', p: 55, spd: 0.95, sta: 100, hp: 110, cols: ['#5a3b24', '#2b1d14', '#8a6040'] },
  tennessee:  { n: 'Tennessee Walker', p: 110, spd: 1.0, sta: 110, hp: 115, cols: ['#8a5a34', '#c8a070', '#3a2a1e'] },
  mustang:    { n: 'Mustang', p: 150, spd: 1.06, sta: 125, hp: 120, cols: ['#8a5a34', '#b07a48', '#2a1c14', '#d8c0a0'] },
  shire:      { n: 'Shire', p: 190, spd: 0.92, sta: 170, hp: 190, cols: ['#1e1612', '#6a4a30'] },
  standardbred:{ n: 'Standardbred', p: 270, spd: 1.13, sta: 135, hp: 125, cols: ['#3a2418', '#1a1410', '#7a4a2a'] },
  arabian:    { n: 'Arap Atı', p: 1100, spd: 1.25, sta: 155, hp: 135, cols: ['#ece8e0', '#1a1612', '#9a9088'] },
};
const HORSE_NAMES = ['Boz', 'Rüzgar', 'Kömür', 'Duman', 'Yıldız', 'Tarçın', 'Kasırga', 'Pamuk', 'Şimşek', 'Bulut', 'Ceviz', 'Kara', 'Sultan', 'Fırtına', 'Toprak'];

/* ---- Kasabalar ---- */
const TOWNS = [
  { id: 'harlow',     n: 'Harlow',         px: 0.52, py: 0.40, sz: 'm', desc: 'Ovanın kalbi. Sığırcılar ve demiryolu işçileriyle dolu.',
    b: ['general', 'saloon', 'sheriff', 'doctor', 'gunsmith', 'butcher', 'stable', 'hotel', 'church', 'land', 'barber', 'tailor', 'house', 'house', 'house'] },
  { id: 'stclement',  n: 'Saint Clement',  px: 0.86, py: 0.55, sz: 'l', desc: 'Doğu kıyısının parıldayan şehri. Bankalar, tiyatrolar ve fırsatlar.',
    b: ['general', 'saloon', 'sheriff', 'doctor', 'gunsmith', 'butcher', 'stable', 'hotel', 'bank', 'church', 'land', 'barber', 'tailor', 'docks', 'saloon', 'house', 'house', 'house', 'house', 'house', 'house'] },
  { id: 'dustcreek',  n: 'Dust Creek',     px: 0.24, py: 0.80, sz: 's', desc: 'Çölün ortasında kavrulmuş bir kasaba. Kanun burada zayıf.',
    b: ['general', 'saloon', 'sheriff', 'stable', 'butcher', 'fence', 'doctor', 'house', 'house'] },
  { id: 'silverridge',n: 'Silver Ridge',   px: 0.24, py: 0.24, sz: 's', desc: 'Dağların arasında bir maden kasabası. Gümüş ve toz.',
    b: ['general', 'saloon', 'mine', 'doctor', 'hotel', 'sheriff', 'gunsmith', 'house', 'house'] },
  { id: 'cedarfalls', n: 'Cedar Falls',    px: 0.64, py: 0.15, sz: 's', desc: 'Kuzey ormanlarında keresteci kasabası.',
    b: ['general', 'saloon', 'lumber', 'butcher', 'doctor', 'hotel', 'stable', 'sheriff', 'tailor', 'house'] },
  { id: 'bayounoir',  n: 'Cypress Bend',     px: 0.72, py: 0.84, sz: 's', desc: 'Sisli bataklığın kıyısında nemli ve gizemli bir yer.',
    b: ['general', 'saloon', 'butcher', 'fence', 'doctor', 'hotel', 'stable', 'docks', 'house'] },
  { id: 'fortmercy',  n: 'Fort Redstone',     px: 0.38, py: 0.56, sz: 's', desc: 'Ordu karakolu ve etrafında büyüyen küçük yerleşim.',
    b: ['general', 'gunsmith', 'doctor', 'sheriff', 'stable', 'saloon', 'ranch', 'house'] },
  { id: 'coyote',     n: 'Coyote Springs', px: 0.53, py: 0.71, sz: 's', desc: 'Kaynak suyunun etrafında kurulmuş bir mola yeri.',
    b: ['general', 'saloon', 'stable', 'butcher', 'sheriff', 'hotel', 'land', 'house'] },
];
/* Demiryolu hatları (istasyon sırası) */
const RAIL_LINES = [
  ['stclement', 'harlow', 'fortmercy', 'silverridge'],
  ['harlow', 'coyote', 'dustcreek'],
];

const REGIONS = [
  { n: 'Frostcrown', x: 0.35, y: 0.04 },
  { n: 'Ironpeak Range', x: 0.14, y: 0.26 },
  { n: 'Pinewood', x: 0.66, y: 0.18 },
  { n: 'Big Sky Plains', x: 0.52, y: 0.44 },
  { n: 'Sundown Desert', x: 0.2, y: 0.78 },
  { n: 'Red Canyon', x: 0.42, y: 0.88 },
  { n: 'Lowland Bayou', x: 0.74, y: 0.84 },
  { n: 'Eastmoor Coast', x: 0.86, y: 0.45 },
  { n: 'Dry Mesa', x: 0.3, y: 0.58 },
];

/* ---- Binalar ---- */
const BUILDINGS = {
  general:  { n: 'Genel Mağaza', w: 10, h: 7, wall: '#8a6a48', roof: '#5b3a29', sign: '#c9a45c', svc: ['shop', 'news', 'rob'], shop: 'general' },
  saloon:   { n: 'Saloon', w: 12, h: 9, wall: '#7a4f33', roof: '#46291c', sign: '#b3261e', svc: ['meal', 'shop', 'blackjack', 'arm', 'rumor', 'rob'], shop: 'saloon', tall: 1 },
  sheriff:  { n: 'Şerif Ofisi', w: 9, h: 7, wall: '#9a8a70', roof: '#4a3a2a', sign: '#d8c080', svc: ['bounty', 'board'] },
  doctor:   { n: 'Doktor', w: 8, h: 7, wall: '#d8d0c0', roof: '#5a4a40', sign: '#e8e8e8', svc: ['heal', 'shop'], shop: 'doctor' },
  gunsmith: { n: 'Silahçı', w: 8, h: 6, wall: '#6a5a4a', roof: '#3a2e24', sign: '#909090', svc: ['shop', 'rob'], shop: 'gunsmith' },
  butcher:  { n: 'Kasap & Tuzakçı', w: 8, h: 6, wall: '#8a5040', roof: '#4a2a20', sign: '#a04030', svc: ['shop'], shop: 'butcher' },
  stable:   { n: 'Ahır', w: 11, h: 7, wall: '#9a6a3a', roof: '#6a3a22', sign: '#c08040', svc: ['horses', 'shop', 'horsecare'], shop: 'stable', stable: 1 },
  hotel:    { n: 'Otel', w: 10, h: 8, wall: '#a07a5a', roof: '#5a3a2a', sign: '#e0c080', svc: ['room', 'bath'], tall: 1 },
  bank:     { n: 'Banka', w: 10, h: 8, wall: '#8a4a3a', roof: '#3a2a24', sign: '#d8b040', svc: ['bank', 'robbank'], brick: 1, tall: 1 },
  station:  { n: 'Tren İstasyonu', w: 11, h: 6, wall: '#7a6a50', roof: '#3a4a5a', sign: '#e0e0d0', svc: ['train'] },
  church:   { n: 'Kilise', w: 8, h: 10, wall: '#e8e0d0', roof: '#5a4a44', sign: '#ffffff', svc: ['donate', 'pray'], church: 1 },
  land:     { n: 'Tapu Dairesi', w: 7, h: 6, wall: '#9a8a6a', roof: '#4a4030', sign: '#80a060', svc: ['property'] },
  barber:   { n: 'Berber', w: 7, h: 6, wall: '#c0b0a0', roof: '#6a3030', sign: '#d04040', svc: ['barber'] },
  tailor:   { n: 'Terzi', w: 8, h: 6, wall: '#a09080', roof: '#4a3a4a', sign: '#a080c0', svc: ['shop'], shop: 'tailor' },
  fence:    { n: 'Kaçakçı', w: 7, h: 6, wall: '#5a4a3a', roof: '#2a2420', sign: '#606060', svc: ['shop'], shop: 'fence' },
  mine:     { n: 'Maden Ofisi', w: 8, h: 6, wall: '#6a6058', roof: '#3a3430', sign: '#a0a0a0', svc: ['work', 'shop'], shop: 'mine', work: 'mine' },
  lumber:   { n: 'Kereste Fabrikası', w: 11, h: 7, wall: '#8a6a40', roof: '#4a3a22', sign: '#c0a060', svc: ['work'], work: 'lumber' },
  docks:    { n: 'Liman Deposu', w: 10, h: 6, wall: '#6a6a60', roof: '#3a3a40', sign: '#6080a0', svc: ['work', 'shop'], shop: 'docks', work: 'docks' },
  ranch:    { n: 'Çiftlik Evi', w: 8, h: 6, wall: '#a07850', roof: '#6a4030', sign: '#c0a070', svc: ['work'], work: 'ranch' },
  barn:     { n: 'Ambar', w: 8, h: 7, wall: '#8a2a20', roof: '#4a2a22', sign: '#8a2a20', svc: [] },
  house:    { n: 'Ev', lock: 1, w: 6, h: 6, wall: '#9a8060', roof: '#5a4030', svc: [] },
  property: { n: 'Satılık Mülk', w: 7, h: 6, wall: '#a08a6a', roof: '#4a3a2a', sign: '#80a060', svc: ['home'] },
  ruin:     { n: 'Harabe', w: 6, h: 5, wall: '#5a4a3a', roof: '#2a2420', svc: [], ruin: 1, noInt: 1 },
  cabin:    { n: 'Kulübe', w: 6, h: 5, wall: '#6a4a2a', roof: '#3a2a1a', sign: '#a08050', svc: ['shop'], shop: 'trapper' },
  hermit:   { n: 'Münzevi Kulübesi', noInt: 1, w: 5, h: 4, wall: '#5a4a32', roof: '#3a3022', svc: ['shop', 'rumor'], shop: 'hermit' },
  lighthouse:{ n: 'Deniz Feneri', w: 4, h: 4, wall: '#e8e0d8', roof: '#a02a20', svc: [], light: 1, noInt: 1 },
  mineentrance:{ n: 'Maden Girişi', w: 5, h: 3, wall: '#3a3028', roof: '#2a2420', svc: [], mine: 1, noInt: 1 },
};

/* İş türleri */
const JOBS = {
  mine:   { n: 'Madende Çalış', hours: 5, pay: [6, 11], energy: 28, hunger: 18, thirst: 20, skill: 'strength', xp: 20, bonus: [['iron_ore', 0.5], ['silver_ore', 0.25]], desc: 'Kazma sallayarak cevher çıkar.' },
  lumber: { n: 'Kereste Kes', hours: 4, pay: [5, 9], energy: 24, hunger: 15, thirst: 15, skill: 'strength', xp: 18, desc: 'Tomrukları testere ile biç.' },
  docks:  { n: 'Limanda Yük Taşı', hours: 4, pay: [5, 10], energy: 22, hunger: 14, thirst: 16, skill: 'strength', xp: 16, desc: 'Gemilerden sandık indir.' },
  ranch:  { n: 'Çiftlikte Çalış', hours: 4, pay: [4, 8], energy: 18, hunger: 14, thirst: 16, skill: 'survival', xp: 16, bonus: [['corn', 0.6], ['apple', 0.4]], desc: 'Saman balyala, hayvanları besle.' },
};

/* Dükkan stokları ve alım oranları */
const SHOPS = {
  general: { n: 'Genel Mağaza', sell: ['beans', 'bread', 'jerky', 'peaches', 'corn', 'coffee', 'chocolate', 'health_cure', 'stamina_tonic', 'bandage', 'tobacco', 'cigarette', 'canteen', 'bedroll', 'fishing_rod', 'bait', 'gold_pan', 'pickaxe', 'shovel', 'lantern', 'hay', 'horse_brush', 'horse_tonic', 'region_map', 'wildflower', 'harmonica', 'mask_bandana'],
             ammo: ['pistol', 'repeater'], buy: { food: 0.5, herb: 0.6, valuable: 0.5, animal: 0.35, collect: 0.5, tool: 0.4, clothing: 0.4, horse: 0.4 } },
  saloon:  { n: 'Bar', sell: ['beer', 'whiskey', 'stew', 'coffee', 'cigarette', 'bread'], buy: {} },
  doctor:  { n: 'Doktor', sell: ['health_cure', 'bandage', 'antidote', 'snake_oil', 'stamina_tonic', 'herbal_tonic'], buy: { herb: 1.0, med: 0.5 } },
  gunsmith:{ n: 'Silahçı', weapons: ['knife', 'cattleman', 'schofield', 'repeater', 'winchester', 'rifle', 'shotgun', 'bow'], ammo: ['pistol', 'repeater', 'rifle', 'shotgun', 'arrow'], sell: ['dynamite'], buy: {} },
  butcher: { n: 'Kasap', sell: ['cooked_game', 'cooked_big', 'jerky', 'raw_game', 'bait'], buy: { animal: 1.0, food: 0.7 } },
  tailor:  { n: 'Terzi', sell: ['coat_duster', 'coat_sheep', 'coat_fur', 'coat_poncho', 'coat_linen', 'hat_cowboy', 'hat_bowler', 'hat_flat', 'hat_wide', 'mask_bandana'], buy: { clothing: 0.5 } },
  fence:   { n: 'Kaçakçı', sell: ['dynamite', 'snake_oil', 'whiskey', 'tobacco', 'mask_bandana', 'mask_sack'], buy: { valuable: 1.0, collect: 0.9, clothing: 0.6 } },
  nomad_traders: { n: 'Kervan', sell: ['coffee', 'tobacco', 'snake_oil', 'bandage', 'harmonica', 'lantern', 'mask_bandana', 'canteen', 'bedroll', 'chocolate', 'whiskey'], buy: { animal: 0.7, valuable: 0.75, collect: 1.1, herb: 0.6 } },
  nomad_drovers: { n: 'Sığırtmaçlar', sell: ['cooked_big', 'jerky', 'coffee', 'beans', 'hay', 'horse_tonic', 'horse_brush'], buy: { food: 0.6, animal: 0.6 } },
  nomad_prospectors: { n: 'Arayıcılar', sell: ['gold_pan', 'pickaxe', 'shovel', 'lantern', 'coffee', 'beans', 'dynamite'], buy: { valuable: 0.95 } },
  nomad_trappers: { n: 'Kürkçüler', sell: ['bait', 'jerky', 'coat_fur', 'coat_sheep', 'stamina_tonic', 'bandage'], buy: { animal: 1.05, herb: 0.7 } },
  stable:  { n: 'Ahır', sell: ['hay', 'horse_brush', 'horse_reviver', 'horse_tonic'], buy: { horse: 0.5 } },
  mine:    { n: 'Maden Deposu', sell: ['pickaxe', 'gold_pan', 'lantern', 'coffee', 'beans'], buy: { valuable: 0.85 } },
  docks:   { n: 'Liman Tüccarı', sell: ['fishing_rod', 'bait', 'whiskey', 'peaches', 'beans'], buy: { food: 0.8, animal: 0.6 } },
  trapper: { n: 'Tuzakçı', sell: ['coat_fur', 'coat_sheep', 'jerky', 'bait'], ammo: ['arrow'], buy: { animal: 1.15, food: 0.6 } },
  hermit:  { n: 'Münzevi', sell: ['herbal_tonic', 'snake_oil', 'antidote', 'mushroom', 'treasure_map'], buy: { herb: 1.2, collect: 1.0 } },
  peddler: { n: 'Seyyar Satıcı', sell: ['snake_oil', 'chocolate', 'whiskey', 'bandage', 'gold_ring', 'necklace', 'cig_card'], ammo: ['pistol'], buy: { valuable: 0.7, collect: 0.8, animal: 0.5 } },
};

/* ---- Önemli yerler ---- */
const LANDMARKS = [
  { id: 'crater',   n: 'Göktaşı Krateri',          type: 'crater',     near: [0.33, 0.9],  bio: ['DESERT', 'REDROCK', 'DRY'], desc: 'Gökten düşen bir ateş topunun izi.' },
  { id: 'sequoia',  n: 'Yaşlı Dev',                type: 'sequoia',    near: [0.74, 0.26], bio: ['FOREST'], desc: 'Bin yıllık dev bir sekoya.' },
  { id: 'mission',  n: 'San Lucia Misyon Harabesi', type: 'ruins',     near: [0.13, 0.68], bio: ['DESERT', 'DRY', 'REDROCK'], desc: 'İspanyol rahiplerin terk ettiği misyon.' },
  { id: 'ghost',    n: 'Hollow Rock',              type: 'ghost',      near: [0.4, 0.84],  bio: ['DESERT', 'DRY', 'REDROCK'], desc: 'Salgından sonra terk edilmiş hayalet kasaba.' },
  { id: 'oldmine',  n: 'Terk Edilmiş Maden',       type: 'mine',       near: [0.3, 0.38],  bio: ['ROCK', 'DRY', 'GRASS'], desc: 'Çökmüş galerileriyle eski bir gümüş madeni.' },
  { id: 'hotspring',n: 'Sıcak Kaynaklar',          type: 'hotspring',  near: [0.4, 0.1],   bio: ['SNOW', 'ROCK', 'FOREST'], desc: 'Karların ortasında buharı tüten şifalı sular.' },
  { id: 'dino',     n: 'Kemik Vadisi',             type: 'dino',       near: [0.1, 0.9],   bio: ['REDROCK', 'DESERT'], desc: 'Devasa kemiklerin gömülü olduğu vadi.' },
  { id: 'hanging',  n: 'Darağacı Tepesi',          type: 'hanging',    near: [0.44, 0.33], bio: ['DRY', 'GRASS'], desc: 'Kanunun sert yüzü.' },
  { id: 'wreck',    n: 'Devrilmiş Posta Arabası',  type: 'wreck',      near: [0.62, 0.52], bio: ['GRASS', 'DRY', 'FOREST'], desc: 'Soyulmuş ve terk edilmiş.' },
  { id: 'lighthouse',n: 'Gull Point Feneri',        type: 'lighthouse', near: [0.92, 0.3],  coast: 1, desc: 'Doğu kıyısını gözleyen yalnız fener.' },
  { id: 'hermit',   n: 'Münzevinin Kulübesi',      type: 'hermit',     near: [0.5, 0.12],  bio: ['FOREST', 'SNOW'], desc: 'Tuhaf bir yaşlı adam burada tek başına yaşıyor.' },
  { id: 'trapper',  n: 'Tuzakçı Kulübesi',         type: 'trapper',    near: [0.8, 0.2],   bio: ['FOREST', 'GRASS'], desc: 'Kürk ticareti yapan bir tuzakçı.' },
  { id: 'battle',   n: 'Eski Savaş Alanı',         type: 'battlefield',near: [0.66, 0.63], bio: ['GRASS', 'DRY', 'FOREST'], desc: 'İç Savaş\'ın unutulmuş mezarları.' },
  { id: 'fortruin', n: 'Yıkık Sterling Kalesi',     type: 'fortruin',   near: [0.07, 0.46], bio: ['DRY', 'ROCK', 'GRASS', 'DESERT'], desc: 'Terk edilmiş eski bir süvari kalesi.' },
  { id: 'windmill', n: 'Yalnız Değirmen',          type: 'windmill',   near: [0.58, 0.3],  bio: ['GRASS', 'DRY'], desc: 'Rüzgarla gıcırdayan terk edilmiş değirmen.' },
  { id: 'oasis',    n: 'Serap Vahası',             type: 'oasis',      near: [0.17, 0.6],  bio: ['DESERT', 'DRY'], desc: 'Çölün ortasında berrak bir su gözü.' },
  { id: 'look1',    n: 'Kartal Tepesi',            type: 'lookout',    near: [0.3, 0.28],  bio: ['ROCK', 'GRASS', 'DRY', 'FOREST'], desc: 'Buradan bütün ova görünüyor.' },
  { id: 'look2',    n: 'Gün Batımı Kayalığı',      type: 'lookout',    near: [0.45, 0.72], bio: ['DRY', 'DESERT', 'REDROCK', 'GRASS'], desc: 'Çölün en güzel manzarası.' },
  { id: 'look3',    n: 'Sisli Zirve',              type: 'lookout',    near: [0.78, 0.08], bio: ['FOREST', 'SNOW', 'ROCK'], desc: 'Kuzey ormanlarının tepesi.' },
  { id: 'look4',    n: 'Timsah Gözü',              type: 'lookout',    near: [0.64, 0.9],  bio: ['SWAMP', 'GRASS', 'FOREST'], desc: 'Bataklığın üzerinde yükselen bir tepe.' },
  { id: 'cave',     n: 'Ayı İni',                  type: 'cave',       near: [0.56, 0.2],  bio: ['FOREST', 'ROCK'], desc: 'Kemiklerle dolu karanlık bir mağara ağzı.' },
  { id: 'witch',    n: 'Cadının Kulübesi',         type: 'hermit',     near: [0.84, 0.9],  bio: ['SWAMP', 'FOREST', 'GRASS'], desc: 'Bataklığın derinliklerinde bir şifacı yaşar.' },
  { id: 'graves',   n: 'Unutulmuş Mezarlık',       type: 'graveyard',  near: [0.7, 0.4],   bio: ['GRASS', 'FOREST', 'DRY'], desc: 'Adı sanı silinmiş mezarlar.' },
  { id: 'ship',     n: 'Karaya Oturmuş Gemi',      type: 'shipwreck',  near: [0.92, 0.72], coast: 1, desc: 'Fırtınada karaya vurmuş bir ticaret gemisi.' },
  { id: 'totemrock',n: 'Kızıl Kemer',              type: 'arch',       near: [0.3, 0.7],   bio: ['REDROCK', 'DESERT', 'DRY'], desc: 'Rüzgarın oyduğu dev bir taş kemer.' },
];
/* Göçebe kamplar: 5-10 yılda bir başka yere göç ederler */
const NOMADS = [
  { kind: 'traders', n: 'Gezgin Tüccar Kervanı', bio: ['GRASS', 'DRY'], shop: 'nomad_traders', desc: 'Batıyı dolaşan bir tüccar kervanı. Her şeyden biraz satarlar.' },
  { kind: 'drovers', n: 'Sığırtmaç Kampı', bio: ['GRASS', 'DRY'], shop: 'nomad_drovers', desc: 'Sürülerini kuzeydeki pazarlara süren kovboylar.' },
  { kind: 'prospectors', n: 'Altın Arayıcıları', bio: ['ROCK', 'FOREST', 'DRY', 'SNOW'], shop: 'nomad_prospectors', desc: 'Şanslarını dere yataklarında arayan maden arayıcıları.' },
  { kind: 'traders', n: 'Seyyar Kumpanya', bio: ['DRY', 'DESERT', 'GRASS'], shop: 'nomad_traders', desc: 'Kasaba kasaba dolaşan oyuncular, çalgıcılar ve şarlatanlar.' },
  { kind: 'trappers', n: 'Kürkçü Kampı', bio: ['FOREST', 'SNOW', 'SWAMP'], shop: 'nomad_trappers', desc: 'Ormanlarda tuzak kuran avcılar. Post alır, malzeme satarlar.' },
];
const CAMPS = [
  { n: 'Kızıl Çakallar Kampı', near: [0.3, 0.68] },
  { n: 'O\'Malley Çetesi', near: [0.6, 0.25] },
  { n: 'Kaçakçı Sığınağı', near: [0.8, 0.76] },
  { n: 'Kanyon Haydutları', near: [0.18, 0.86] },
  { n: 'Dağ Adamları', near: [0.16, 0.36] },
  { n: 'Lemon Çetesi', near: [0.46, 0.5] },
];
const FARMS = [
  { n: 'Miller Çiftliği', near: [0.47, 0.44] },
  { n: 'Hayes Ranch', near: [0.58, 0.47] },
  { n: 'Bright Çiftliği', near: [0.44, 0.62] },
  { n: 'Carver Ranch', near: [0.72, 0.5] },
  { n: 'Dawson Çiftliği', near: [0.62, 0.62] },
  { n: 'Ölü Adam Çiftliği', near: [0.33, 0.48] },
  { n: 'Whitaker Ranch', near: [0.7, 0.3] },
];
const PROPERTIES = [
  { id: 'shack',  n: 'Bataklık Barakası', p: 180, near: [0.68, 0.78], perks: 'Ucuz bir sığınak. Uyku ve kayıt.', income: 0 },
  { id: 'cabin',  n: 'Göl Kıyısı Kulübe', p: 420, near: [0.6, 0.2], perks: 'Ormanın içinde huzurlu bir kulübe.', income: 0 },
  { id: 'ranch',  n: 'Harlow Çiftliği', p: 1400, near: [0.5, 0.47], perks: 'Günlük $6 gelir getiren küçük bir çiftlik.', income: 6 },
  { id: 'estate', n: 'Clement Konağı', p: 4200, near: [0.82, 0.52], perks: 'Lüks konak. Günlük $15 kira geliri.', income: 15 },
];

/* ---- Başarımlar (perk içerir) ---- */
const ACHIEVEMENTS = [
  { id: 'begin',     n: 'Yeni Bir Hayat',        d: 'Batıda yeni bir hayata başla.', perk: '' },
  { id: 'hunt1',     n: 'İlk Av',                d: 'İlk hayvanını avla.', perk: 'Deri yüzünce +1 et şansı', s: 'animals', v: 1 },
  { id: 'hunt25',    n: 'Avcı',                  d: '25 hayvan avla.', perk: 'Post satış fiyatları +%15', s: 'animals', v: 25 },
  { id: 'hunt100',   n: 'Vahşi Batı\'nın Avcısı', d: '100 hayvan avla.', perk: 'Hayvanlar seni %30 daha geç fark eder', s: 'animals', v: 100 },
  { id: 'bear',      n: 'Ayı Boğuşan',           d: 'Bir boz ayı avla.', perk: 'Maksimum sağlık +15', s: 'bears', v: 1 },
  { id: 'explore5',  n: 'Meraklı Gezgin',        d: '5 yer keşfet.', perk: 'Harita açılma yarıçapı +%35', s: 'discoveries', v: 5 },
  { id: 'explore20', n: 'Kaşif',                 d: '20 yer keşfet.', perk: 'Yakındaki keşfedilmemiş yerler haritada "?" olarak görünür', s: 'discoveries', v: 20 },
  { id: 'towns',     n: 'Bütün Kasabalar',       d: '8 kasabanın hepsini ziyaret et.', perk: 'Tren biletleri %50 indirimli', s: 'towns', v: 8 },
  { id: 'rider',     n: 'Eyer Yarası',           d: 'At sırtında 15 mil yol git.', perk: 'Atın dörtnalda %25 daha az yorulur', s: 'rideMiles', v: 15 },
  { id: 'walker',    n: 'Tabanvay',              d: 'Yaya olarak 8 mil yürü.', perk: 'Maksimum dayanıklılık +%15', s: 'walkMiles', v: 8 },
  { id: 'eater',     n: 'Demir Mide',            d: '60 kez yemek ye.', perk: 'Yiyecekler %20 daha fazla doyurur, çiğ et daha az hasta eder', s: 'eaten', v: 60 },
  { id: 'herbs',     n: 'Şifacı',                d: '50 bitki topla.', perk: 'Bitki toplarken 2 kat verim şansı', s: 'herbs', v: 50 },
  { id: 'fisher',    n: 'Oltanın Ustası',        d: '20 balık tut.', perk: 'Balıklar daha çabuk vurur', s: 'fish', v: 20 },
  { id: 'longshot',  n: 'Keskin Nişancı',        d: '10 hedefi 25 metreden uzaktan vur.', perk: 'Odak %25 daha yavaş tükenir', s: 'longKills', v: 10 },
  { id: 'gunslinger',n: 'Silahşör',              d: '25 haydut öldür.', perk: 'Şarjör değiştirme %25 hızlı', s: 'bandits', v: 25 },
  { id: 'rich',      n: 'Cebi Dolu',             d: 'Cebinde $1000 biriktir.', perk: 'Dükkanlarda %10 indirim', s: 'maxCash', v: 1000 },
  { id: 'tycoon',    n: 'Baron',                 d: 'Toplam $10.000 kazan.', perk: 'Mülk gelirleri %50 artar', s: 'earned', v: 10000 },
  { id: 'worker',    n: 'Alın Teri',             d: '10 vardiya çalış.', perk: 'İş ücretleri %25 artar', s: 'shifts', v: 10 },
  { id: 'samaritan', n: 'İyi Samiriyeli',        d: '5 yabancıya yardım et.', perk: 'Onur kazanımı 1.5 kat', s: 'helped', v: 5 },
  { id: 'outlaw',    n: 'Kanun Kaçağı',          d: 'Başına $250 ödül konsun.', perk: 'Kanun seni daha çabuk kaybeder', s: 'maxBounty', v: 250 },
  { id: 'saint',     n: 'Aziz',                  d: 'Onurunu 80\'e çıkar.', perk: 'Doktor hizmetleri yarı fiyat', s: 'maxHonor', v: 80 },
  { id: 'devil',     n: 'Şeytanın Ta Kendisi',   d: 'Onurunu -80\'e düşür.', perk: 'Soygunlardan 2 kat kazanç', s: 'minHonor', v: 80 },
  { id: 'home',      n: 'Ev Sahibi',             d: 'Bir mülk satın al.', perk: 'Evde uyumak tüm çekirdekleri doldurur', s: 'properties', v: 1 },
  { id: 'married',   n: 'Mutlu Yuva',            d: 'Evlen.', perk: 'Sağlık yenilenmesi +%25', s: 'married', v: 1 },
  { id: 'parent',    n: 'Soy Ağacı',             d: 'Bir çocuğun olsun.', perk: 'Aile seni motive eder: yaşlanma etkileri azalır', s: 'children', v: 1 },
  { id: 'gambler',   n: 'Kumarbaz',              d: '10 el Yirmi Bir kazan.', perk: 'Kumarda şansın artar', s: 'bjWins', v: 10 },
  { id: 'arm',       n: 'Demir Bilek',           d: '5 bilek güreşi kazan.', perk: 'Yakın dövüş hasarı +%30', s: 'armWins', v: 5 },
  { id: 'desert',    n: 'Çöl Faresi',            d: 'Çölde toplam 24 saat geçir.', perk: 'Sıcağa dayanım +6°C', s: 'hoursDesert', v: 24 },
  { id: 'cold',      n: 'Kutup Kurdu',           d: 'Soğuk bölgelerde toplam 24 saat geçir.', perk: 'Soğuğa dayanım +6°C', s: 'hoursCold', v: 24 },
  { id: 'gold',      n: 'Altına Hücum',          d: '10 altın parçası bul.', perk: 'Altın eleme verimi 2 kat', s: 'nuggets', v: 10 },
  { id: 'collector', n: 'Koleksiyoncu',          d: '12 koleksiyon eşyası bul.', perk: 'Sandıklardan daha değerli ganimet', s: 'collectibles', v: 12 },
  { id: 'tamer',     n: 'At Fısıldayan',         d: 'Yabani bir atı evcilleştir.', perk: 'Atınla bağın 2 kat hızlı gelişir', s: 'tamed', v: 1 },
  { id: 'camper',    n: 'Kamp Ateşi',            d: '10 kez kamp kur.', perk: 'Kamp ateşinde pişen yemekler +%30 besleyici', s: 'camps', v: 10 },
  { id: 'treasure',  n: 'Hazine Avcısı',         d: 'Gömülü bir hazine bul.', perk: '', s: 'treasures', v: 1 },
  { id: 'train',     n: 'Demir At',              d: 'Trenle 5 kez seyahat et.', perk: '', s: 'trainRides', v: 5 },
  { id: 'deadeye',   n: 'Keskin Göz',           d: 'Odak modunu 20 kez kullan.', perk: 'Odak çekirdeği daha yavaş azalır', s: 'deadeyes', v: 20 },
  { id: 'age30',     n: 'Olgunluk',              d: '30 yaşına gir.', perk: 'Tüm yetenek deneyimleri +%10', s: 'age', v: 30 },
  { id: 'age50',     n: 'Yarım Asır',            d: '50 yaşına gir.', perk: 'Tecrübe: dükkanlarda ek %5 indirim', s: 'age', v: 50 },
  { id: 'age65',     n: 'Ak Sakallı',            d: '65 yaşına gir.', perk: 'Yaşlılığın getirdiği halsizlik yavaşlar', s: 'age', v: 65 },
  { id: 'age80',     n: 'Ölümsüz Efsane',        d: '80 yaşına kadar hayatta kal.', perk: 'Hayat hedefine ulaştın!', s: 'age', v: 80 },
];

const SKILLS = {
  shooting: { n: 'Nişancılık', d: 'İsabet ve odak süresi' },
  hunting:  { n: 'Avcılık', d: 'Post kalitesi ve gizlilik' },
  survival: { n: 'Hayatta Kalma', d: 'Açlık, susuzluk ve ısıya dayanım' },
  riding:   { n: 'Binicilik', d: 'At hızı ve dayanıklılığı' },
  trade:    { n: 'Ticaret', d: 'Alım-satım fiyatları' },
  charisma: { n: 'Karizma', d: 'İlişkiler ve onur kazanımı' },
  strength: { n: 'Güç', d: 'Yakın dövüş ve iş verimi' },
};

const BACKGROUNDS = [
  { id: 'farm', n: 'Çiftçi Çocuğu', d: 'Harlow ovalarında büyüdün. Toprağı ve hayvanları bilirsin.', town: 'harlow', money: 18,
    skills: { survival: 2, riding: 1 }, items: { bread: 3, beans: 2, apple: 4, canteen: 1 }, weapons: ['knife', 'cattleman'], ammo: { pistol: 24 }, horse: 'nag' },
  { id: 'immigrant', n: 'Göçmen', d: 'Okyanusu aşıp Saint Clement limanına ayak bastın. Cebinde biraz para, kafanda hayaller.', town: 'stclement', money: 45,
    skills: { trade: 2, charisma: 2 }, items: { bread: 2, chocolate: 1, canteen: 1, pocket_watch: 1 }, weapons: ['knife'], ammo: {}, horse: null },
  { id: 'outlaw', n: 'Kanun Kaçağı', d: 'Genç yaşta yanlış insanlarla takıldın. Başında küçük bir ödül var.', town: 'dustcreek', money: 30, bounty: 45,
    skills: { shooting: 2, riding: 1 }, items: { jerky: 3, whiskey: 1, canteen: 1, tobacco: 2 }, weapons: ['knife', 'cattleman', 'repeater'], ammo: { pistol: 30, repeater: 24 }, horse: 'mustang', honor: -15 },
  { id: 'rail', n: 'Demiryolu İşçisi', d: 'Rayların döşenmesinde ter döktün. Güçlüsün ve yorulmazsın.', town: 'fortmercy', money: 28,
    skills: { strength: 3 }, items: { beans: 3, coffee: 2, canteen: 1, pickaxe: 1 }, weapons: ['knife', 'cattleman'], ammo: { pistol: 18 }, horse: null },
  { id: 'trapper', n: 'Tuzakçı', d: 'Kuzey ormanlarında avcı bir babanın yanında yetiştin.', town: 'cedarfalls', money: 12,
    skills: { hunting: 3, survival: 1 }, items: { jerky: 4, canteen: 1, bedroll: 1, coat_sheep: 1 }, weapons: ['knife', 'bow'], ammo: { arrow: 20 }, horse: 'morgan' },
];

const DIFFICULTIES = [
  { id: 'story', n: 'Hikaye', d: 'Ölürsen doktor seni kurtarır ama paranın bir kısmını ve sağlığından bir parça kaybedersin.' },
  { id: 'hard',  n: 'Tek Hayat', d: 'Ölüm kalıcıdır. Kayıt silinir. Gerçek hayatta kalma.' },
];
const LIFE_PACES = [
  { id: 'slow',   n: 'Yavaş', d: 'Bir yıl 10 oyun günü sürer.', dpy: 10 },
  { id: 'normal', n: 'Normal', d: 'Bir yıl 6 oyun günü sürer.', dpy: 6 },
  { id: 'fast',   n: 'Hızlı', d: 'Bir yıl 3 oyun günü sürer.', dpy: 3 },
];

/* Görünüm seçenekleri */
const LOOKS = {
  skin: ['#f2d3b3', '#e0b48c', '#c8956a', '#a8734c', '#7a5236', '#5a3a26'],
  hair: ['#1a1410', '#3a2618', '#6a4424', '#a0682c', '#c89a58', '#8a3a1a', '#e0d0a0'],
  hairStyle: ['Kısa', 'Uzun', 'Toplu', 'Kazınmış', 'Dalgalı'],
  beard: ['Yok', 'Bıyık', 'Keçi Sakalı', 'Kirli Sakal', 'Gür Sakal'],
  hat: ['cowboy', 'bowler', 'flat', 'wide', 'none'],
  hatN: { cowboy: 'Kovboy', bowler: 'Melon', flat: 'Kasket', wide: 'Geniş Kenar', none: 'Şapkasız' },
  hatCol: ['#3a2a1e', '#6a5038', '#1a1614', '#8a7a64', '#c0a880', '#4a3a3a'],
  coat: ['#5a4a3a', '#2e3a4a', '#6a3a2a', '#3a4a32', '#7a6a58', '#4a2a3a', '#2a2622'],
  shirt: ['#d8cdb4', '#8a9ab0', '#b04a3a', '#e8e4dc', '#6a7a5a'],
  pants: ['#3a3024', '#2a2a30', '#5a4a3a', '#4a3a2e'],
  eyes: ['#3a2a1a', '#4a6a8a', '#5a7a4a', '#6a5030'],
};

const NAMES = {
  m: ['John', 'Arthur', 'William', 'Samuel', 'Thomas', 'Jesse', 'Wyatt', 'Levi', 'Eli', 'Jacob', 'Henry', 'Charles', 'Amos', 'Silas', 'Caleb', 'Virgil', 'Clay', 'Hosea', 'Otis', 'Walter', 'Isaac', 'Frank', 'Hank', 'Buck', 'Jeb', 'Luther', 'Ezra', 'Morgan'],
  f: ['Sadie', 'Abigail', 'Mary', 'Clara', 'Martha', 'Annie', 'Eliza', 'Grace', 'Rose', 'Hattie', 'Lillian', 'Molly', 'Josephine', 'Tilly', 'Emma', 'Ruth', 'Belle', 'Cora', 'Ida', 'Nellie', 'Olive', 'Pearl', 'Etta', 'Ada'],
  last: ['Hollister', 'Callahan', 'Pruitt', 'Hayes', 'Whitmore', 'Brandt', 'Tolliver', 'Kincaid', 'Harper', 'Bennett', 'Carver', 'Dawson', 'Holloway', 'McCoy', 'Pritchard', 'Quinn', 'Reyes', 'Sawyer', 'Tanner', 'Walsh', 'Barlow', 'Colter', 'Ramsey', 'Boone', 'Cassidy', 'Fletcher', 'Garrett', 'Lockhart'],
};

/* NPC konuşmaları */
/* Selamlaşmalar: günün saatine, havaya, role ve tanışıklığa göre. {ad} = oyuncunun adı, {kasaba} = bulunulan yer */
const GREETS = {
  morning: ['Günaydın.', 'Günaydın, yabancı.', 'Hayırlı sabahlar.', 'Erkencisin bakıyorum.', 'Sabahın köründe nereye böyle?', 'Günaydın. Kahveni içtin mi?',
    'Horozlar bile yeni uyandı.', 'Güzel bir sabah, değil mi?', 'Sabah sabah yollara düşmüşsün.', 'Günaydın dostum, gün sana güzel geçsin.', 'Sabah ayazı insanın kemiğine işliyor.', 'Hayırlı işler.'],
  day: ['İyi günler.', 'Tünaydın.', 'Merhaba, yabancı.', 'Nasılsın dostum?', 'Güneş tepede, gölge bul kendine.', 'Selam.', 'Öğle sıcağında ne geziyorsun?',
    'Allah\'a emanet.', 'İyi günler, bayım.', 'Yolun açık olsun.', 'Hava bugün güzel, değil mi?', 'Başın belada değildir umarım.', 'Hoş geldin.', 'Buralarda yeni misin?'],
  evening: ['İyi akşamlar.', 'Akşamın hayrolsun.', 'Güneş batıyor, yakında karanlık basar.', 'İyi akşamlar, yabancı.', 'Günün yorgunluğu yüzünden okunuyor.',
    'Akşam yemeğine geç kalma.', 'Saloonda bu akşam kalabalık olur.', 'Hava serinledi nihayet.', 'Akşam ezanı gibi sessiz her yer.', 'İyi akşamlar dostum, yolun açık olsun.'],
  night: ['İyi geceler.', 'Bu saatte ne işin var dışarıda?', 'Gece yarısı yollarda dolaşılmaz, yabancı.', 'Hayırlı geceler.', 'Uykun yok mu senin?',
    'Karanlıkta kimseye güvenme.', 'Kurtlar uluyor, dikkatli ol.', 'Geç oldu. Evine git.', 'Fenerin var mı? Yollar zifiri karanlık.', 'Şşşt, herkes uyuyor.'],
  rain: ['Bu yağmur hiç dinmeyecek galiba.', 'Sırılsıklam olmuşsun.', 'Toprak susamıştı, iyi oldu bu yağmur.', 'Çamurda dikkat et, atın kayar.', 'Şemsiyen yok mu senin?'],
  snow: ['Kemiklerime kadar dondum.', 'Kalın giyin, bu soğuk adam öldürür.', 'Kar yolları kapatacak yakında.', 'Ateşin başından ayrılmamalı bu havada.'],
  hot: ['Bu sıcak insanı öldürür.', 'Suyun var mı yanında? Bol iç.', 'Güneş kafamı kaynatıyor.', 'Gölge bul kendine, yabancı.'],
  known: ['Yine sen, {ad}!', 'Ooo {ad}, hoş geldin!', 'Seni görmek ne güzel, {ad}.', 'Nasıl gidiyor {ad}? Uzun zaman oldu.', '{ad}! Sağ salim dönmüşsün.', 'Bizim {ad} geldi!'],
  again: ['Az önce selamlaşmıştık ya.', 'Evet, evet, merhaba yine.', 'Hâlâ buradasın demek.', 'Bir şey mi istiyorsun?', 'Bugün ikinci kez görüyorum seni.'],
  law: ['Başını beladan uzak tut, evlat.', 'Gözüm üzerinde, yabancı.', 'Kasabamda sorun istemem.', 'Silahını kılıfında tut.', 'Kanun burada benim.', 'Sakin bir gün. Öyle kalsın.'],
  clerk: ['Hoş geldiniz! Neye bakmıştınız?', 'Buyurun, bir şey mi lazım?', 'Taze mallar geldi bugün.', 'Veresiye yok, baştan söyleyeyim.', 'Rahatınıza bakın, acele yok.'],
  nomad: ['Ateşimize hoş geldin.', 'Yolcu yolunda gerek.', 'Uzun yoldan mı geliyorsun?', 'Kervanımız her yıl başka yerde.', 'Otur biraz, hikâye anlat.'],
  traveler: ['Yolun açık olsun.', 'Bu yollarda haydut çok, dikkat et.', 'Kasabaya daha ne kadar var?', 'Atın yorgun görünüyor.', 'Selam, yolcu.'],
  farmer: ['Ekinler bu yıl iyi.', 'Toprak insanı yorar ama doyurur.', 'Çitlerime dikkat et, yabancı.', 'İnekleri korkutma sakın.'],
  reply: {
    morning: ['Günaydın.', 'Hayırlı sabahlar.', 'Günaydın, dostum.', 'Sabah şerifleriniz hayrolsun.'],
    day: ['İyi günler.', 'Merhaba.', 'Nasıl gidiyor?', 'Selam dostum.', 'Tünaydın.'],
    evening: ['İyi akşamlar.', 'Akşamınız hayrolsun.', 'İyi akşamlar, dostum.'],
    night: ['İyi geceler.', 'Hayırlı geceler.', 'Geç oldu, biliyorum.'],
  },
};
const LINES = {
  greet: ['İyi günler.', 'Selam, yabancı.', 'Hava bugün güzel, değil mi?', 'Hoş geldin.', 'Nasılsın dostum?', 'Merhaba.', 'Allah\'a emanet.', 'Başın belada değildir umarım.'],
  greetLow: ['Senin gibilerden uzak dururum.', 'Ne bakıyorsun?', 'Yoluna git.', 'Kanun kaçağı...', 'Sana güvenmiyorum.'],
  greetHigh: ['Seni tanıyorum! İyi bir insansın.', 'Sizin gibi insanlar bu kasabayı güzelleştiriyor.', 'Şapkamı çıkarıyorum efendim.'],
  antag: ['Ne dedin sen?!', 'Kendine dikkat et!', 'Beni kızdırma!', 'Sen kim oluyorsun?', 'Bunu ödeyeceksin!'],
  flee: ['İmdat!', 'Şerif! Şerif!', 'Yapma, yalvarırım!', 'Kaçın!'],
  robbed: ['Al, al! Hepsi bu!', 'Lütfen canımı bağışla!', 'Tamam, tamam, sakin ol...'],
  dirty: ['Uff, bu koku ne?', 'Bir banyo yapsan fena olmaz.', 'Leş gibi kokuyorsun.'],
  drunk: ['Sarhoş musun sen?', 'Git de ayıl biraz.'],
  law: ['Dur! Kanun adına!', 'Silahını bırak!', 'Teslim ol!', 'Ateş serbest!'],
  arrest: ['Eller yukarı!', 'Kanun adına tutuklusun!', 'Silahını bırak ve teslim ol!', 'Yavaş ol, kimse ölmek zorunda değil.', 'Dur olduğun yerde!', 'Teslim ol, cezanı öde, herkes evine gitsin.'],
  witness: ['Şerif! Şerif!', 'Yardım edin! Kanuna haber verin!', 'Gördüm! Her şeyi gördüm!', 'Şerifi çağırın!', 'Kanun nerede?!'],
  witnessHold: ['Ateş etme! Lütfen!', 'Tamam, tamam! Durdum!', 'Beni vurma!'],
  silenced: ['Tamam! Kimseye bir şey söylemeyeceğim!', 'Hiçbir şey görmedim, yemin ederim!', 'Ağzımı açmam, söz!'],
  bribed: ['Ne gördüğümü unuttum bile.', 'Bu para iyi gelir... Ben bir şey görmedim.', 'Sen hiç burada değildin, dostum.'],
  maskLaw: ['Maskeni çıkar, yabancı!', 'O bez yüzünde ne arıyor? Çıkar onu!', 'Kasabada maskeli dolaşmak yasak, bilesin.'],
  maskTown: ['Neden maskelisin?', 'Tanrım, bir haydut!', 'Maskeli biri... Uzak dur benden.', 'Yüzünü neden saklıyorsun?'],
  reported: ['Şerif, adamı gördüm! Tarif edeyim...', 'Şu tarafa kaçtı, şerif!'],
  bandit: ['Öldürün şunu!', 'Parasını alın!', 'Bu yoldan sağ çıkamayacaksın!', 'Sıkın!'],
  rumor: [
    'Kuzeydeki dağlarda sıcak sular varmış, yaşlıların ağrılarına iyi gelirmiş.',
    'Çölde gökten bir taş düşmüş diyorlar. Göktaşı parçaları servet değerindeymiş.',
    'Bataklıkta bir cadı yaşarmış; iksirleri ölüyü bile diriltirmiş.',
    'Doğu kıyısında bir gemi karaya oturmuş. Yükünü kimse almamış.',
    'Kanyonda devasa kemikler bulunmuş. Ejderha kemiği diyenler var.',
    'Terk edilmiş madende hala gümüş varmış ama içeri girenler geri dönmemiş.',
    'Hollow Rock\'ta salgın herkesi silip süpürmüş. Geceleri ışıklar görünürmüş.',
    'Nehirlerde altın eleyenler iyi para kazanıyor. Dağ derelerini dene.',
    'Kurtlar geceleri kuzey ormanlarında sürü halinde avlanır. Dikkatli ol.',
    'Harlow\'daki tapu dairesinde satılık bir çiftlik var diyorlar.',
    'Şeriflerin panosunda yeni ödül ilanları var.',
  ],
};

const HEADLINES = [
  ['DEMİRYOLU BATIYA UZANIYOR', 'Yeni hat Silver Ridge dağlarını aşarak madencilere umut oldu. Yatırımcılar Saint Clement borsasında bayram ediyor.'],
  ['KANYONDA TREN SOYGUNU', 'Maskeli haydutlar posta vagonunu boşalttı. Şerif, ele başının Kızıl Çakallar çetesinden olduğunu düşünüyor.'],
  ['ALTIN BULUNDU!', 'Dağ derelerinde altın eleyen bir göçmen, bir haftada bir yıllık kazancı kadar altın buldu. Nehirlere akın başladı.'],
  ['KURAKLIK SIĞIRCILARI VURDU', 'Big Sky ovalarında otlaklar kurudu. Sığır fiyatları düşerken kasaplar et fiyatlarını artırdı.'],
  ['GÖKTEN ATEŞ DÜŞTÜ', 'Sundown çölünde çobanlar gece yarısı gökyüzünü yaran bir ateş topu gördüklerini anlatıyor.'],
  ['ELEKTRİK SAINT CLEMENT\'TE', 'Şehrin ana caddesi ilk kez elektrik lambalarıyla aydınlatıldı. Kasabalılar bu mucizeyi görmek için saatlerce yürüdü.'],
  ['BATAKLIKTA KAYIP AVCI', 'Cypress Bend yakınlarında kaybolan tuzakçıdan hâlâ haber yok. Yerliler timsahlardan şüpheleniyor.'],
  ['KURT SÜRÜLERİ ÇOĞALDI', 'Cedar Falls keresteciler birliği, gece ormana girilmemesi konusunda uyardı.'],
  ['SİRK KASABAYA GELİYOR', 'Profesör Harriet\'in gezici gösterisi bu yaz Harlow\'a uğrayacak. Fil ve ateş yutan adam bekleniyor!'],
  ['YENİ ŞERİF ATANDI', 'Dust Creek\'e atanan yeni şerif, kasabayı kanunsuzlardan temizleyeceğine yemin etti.'],
  ['DOKTORDAN UYARI', 'Çiğ et ve bataklık suyu dizanteriye yol açıyor. Suyu kaynatın, eti iyi pişirin.'],
  ['ARAZİ SATIŞLARI PATLADI', 'Hükümetin yeni çiftçi yasasıyla ovadaki araziler hızla sahiplerini buluyor.'],
];
const SEASONS = ['İlkbahar', 'Yaz', 'Sonbahar', 'Kış'];
const SEASON_TEMP = [0, 8, -2, -12];

/* Kamp tarifleri */
const RECIPES = [
  { id: 'cook_game', n: 'Av Eti Pişir', need: { raw_game: 1 }, out: { cooked_game: 1 } },
  { id: 'cook_big', n: 'Biftek Pişir', need: { raw_big: 1 }, out: { cooked_big: 1 } },
  { id: 'cook_bird', n: 'Kuş Eti Pişir', need: { raw_bird: 1 }, out: { cooked_bird: 1 } },
  { id: 'cook_fish', n: 'Balık Pişir', need: { raw_fish: 1 }, out: { cooked_fish: 1 }, anyFish: true },
  { id: 'stew', n: 'Güveç Yap', need: { raw_game: 1, corn: 1, oregano: 1 }, out: { stew: 1 } },
  { id: 'coffee', n: 'Kahve Demle', need: { mint: 1, sage: 1 }, out: { coffee: 1 } },
  { id: 'herbal', n: 'Bitki Toniği', need: { ginseng: 1, yarrow: 2 }, out: { herbal_tonic: 1 } },
  { id: 'stamina', n: 'Enerji Toniği', need: { ginseng: 1, mint: 1, milkweed: 1 }, out: { stamina_tonic: 1 } },
  { id: 'bandage', n: 'Bandaj Hazırla', need: { yarrow: 1, milkweed: 1 }, out: { bandage: 1 } },
  { id: 'antidote', n: 'Panzehir', need: { snake_skin: 1, sage: 2 }, out: { antidote: 1 } },
  { id: 'arrows', n: 'Ok Yap (x5)', need: { feather: 3 }, outAmmo: { arrow: 5 } },
];
