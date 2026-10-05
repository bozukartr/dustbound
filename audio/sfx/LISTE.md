# Ses dosyaları

Bu klasöre aşağıdaki adlarla ses dosyası koy, sonra `node tools/sfx-manifest.js` çalıştır.
Çeşit için `_01`, `_02` … ekle (örneğin `gun_pistol_01.ogg`, `gun_pistol_02.ogg`). Uzantı: ogg, mp3, wav, m4a, flac, webm.
Dosyası olmayan ses, oyunun kodla ürettiği eski sesle çalar. Döngülerin başı ve sonu kesintisiz birleşmeli.

| Ad | Ne zaman çalar | Dosya |
|---|---|---|
| `gun_pistol` | Tabanca atışı (oyuncu ve NPC) | 4 |
| `gun_repeater` | Tüfek (repeater) atışı; yoksa tabanca sesi | 2 |
| `gun_rifle` | Uzun namlulu tüfek atışı | 3 |
| `gun_shotgun` | Pompalı / av tüfeği atışı | 3 |
| `gun_bow` | Yay ile ok atışı | 2 |
| `reload_pistol` | Tabanca doldurma | 2 |
| `reload_repeater` | Tüfek doldurma | 2 |
| `reload_shotgun` | Pompalı doldurma | 2 |
| `explosion` | Dinamit patlaması | 3 |
| `ricochet` | Kurşunun taşa sekmesi | 2 |
| `hit_flesh` | Kurşun ya da bıçağın bedene isabeti | 4 |
| `hit_dirt` | Kurşunun toprağa saplanması | 4 |
| `hit_wood` | Kurşunun tahtaya / duvara isabeti | 4 |
| `punch` | Yumruk ve dipçik vuruşu | 4 |
| `thud` | Düşme, çarpma, ağır bir şeyin yere inmesi | 3 |
| `step_dirt` | Ayak sesi: toprak (başka zeminin dosyası yoksa bu çalar) | 6 |
| `step_grass` | Ayak sesi: çimen | 5 |
| `step_sand` | Ayak sesi: kum | 6 |
| `step_stone` | Ayak sesi: taş | 5 |
| `step_wood` | Ayak sesi: tahta (bina içi dahil) | 5 |
| `step_mud` | Ayak sesi: çamur | 6 |
| `step_snow` | Ayak sesi: kar | 5 |
| `step_water` | Ayak sesi: sığ su | 6 |
| `hoof_dirt` | Toynak sesi: toprak (başka zeminin dosyası yoksa bu çalar) | 8 |
| `hoof_grass` | Toynak sesi: çimen | 8 |
| `hoof_sand` | Toynak sesi: kum | 6 |
| `hoof_stone` | Toynak sesi: taş | 8 |
| `hoof_wood` | Toynak sesi: tahta (bina içi dahil) | 5 |
| `hoof_mud` | Toynak sesi: çamur | 6 |
| `hoof_snow` | Toynak sesi: kar | 5 |
| `hoof_water` | Toynak sesi: sığ su | 6 |
| `horse_neigh` | At kişnemesi (ıslıkla çağırma, şahlanma) | 2 |
| `whistle` | Oyuncunun atını ıslıkla çağırması | 2 |
| `growl` | Kurt / çakal hırlaması | 2 |
| `growl_bear` | Ayı kükremesi | 2 |
| `cougar` | Puma hırlaması | 2 |
| `wolf_howl` | Gece uzaktan kurt uluması | 1 |
| `coyote_howl` | Gece uzaktan çakal uluması | 2 |
| `bird` | Gündüz kuş cıvıltısı (tekil, ara ara) | 3 |
| `owl` | Gece baykuş | 2 |
| `hawk` | Gündüz kırda şahin çığlığı | 2 |
| `thunder` | Fırtınada gök gürültüsü | 3 |
| `train_whistle` | Tren düdüğü | 1 |
| `amb_wind` | Döngü: rüzgâr | 1 |
| `amb_wind_strong` | Döngü: sert rüzgâr, fırtına | 1 |
| `amb_rain` | Döngü: yağmur | 1 |
| `amb_fire` | Döngü: kamp ateşi çıtırtısı | 1 |
| `amb_river` | Döngü: nehir, akan su | 1 |
| `amb_crickets` | Döngü: gece cırcır böcekleri | 1 |
| `amb_crowd` | Döngü: kasaba uğultusu (gündüz) | 1 |
| `door_open` | Bina kapısından girip çıkma | 4 |
| `saloon_door` | Saloon / kantina yaylı kapısı | 2 |
| `drink` | İçme (matara, viski, su, ilaç) | 2 |
| `eat` | Yemek yeme | 2 |
| `lasso` | Kement fırlatma (ayrıca yakın dövüşte savurma) | 2 |
| `rope` | İple bağlama | 1 |
| `skin` | Hayvan yüzme | 3 |
| `coins` | Para alıp verme | 2 |
| `ui_move` | Menüde gezinme | 2 |
| `ui_ok` | Menüde seçme / onay | 2 |
| `ui_back` | Menüden geri / kapatma | 2 |
| `ui_error` | Olmaz / hata | 2 |
| `ui_pick` | Eşya alma | 2 |
| `chime` | Bildirim, başarı | 1 |
| `discover` | Yeni yer keşfi | 1 |
