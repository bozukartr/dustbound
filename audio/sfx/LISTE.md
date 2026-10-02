# Ses dosyaları

Bu klasöre aşağıdaki adlarla ses dosyası koy, sonra `node tools/sfx-manifest.js` çalıştır.
Çeşit için `_01`, `_02` … ekle (örneğin `gun_pistol_01.ogg`, `gun_pistol_02.ogg`). Uzantı: ogg, mp3, wav, m4a, flac, webm.
Dosyası olmayan ses, oyunun kodla ürettiği eski sesle çalar. Döngülerin başı ve sonu kesintisiz birleşmeli.

| Ad | Ne zaman çalar | Dosya |
|---|---|---|
| `gun_pistol` | Tabanca atışı (oyuncu ve NPC) | – |
| `gun_repeater` | Tüfek (repeater) atışı; yoksa tabanca sesi | – |
| `gun_rifle` | Uzun namlulu tüfek atışı | – |
| `gun_shotgun` | Pompalı / av tüfeği atışı | – |
| `gun_bow` | Yay ile ok atışı | – |
| `reload_pistol` | Tabanca doldurma | – |
| `reload_repeater` | Tüfek doldurma | – |
| `reload_shotgun` | Pompalı doldurma | – |
| `explosion` | Dinamit patlaması | – |
| `ricochet` | Kurşunun taşa sekmesi | – |
| `hit_flesh` | Kurşun ya da bıçağın bedene isabeti | – |
| `hit_dirt` | Kurşunun toprağa saplanması | – |
| `hit_wood` | Kurşunun tahtaya / duvara isabeti | – |
| `punch` | Yumruk ve dipçik vuruşu | – |
| `thud` | Düşme, çarpma, ağır bir şeyin yere inmesi | – |
| `step_dirt` | Ayak sesi: toprak (başka zeminin dosyası yoksa bu çalar) | – |
| `step_grass` | Ayak sesi: çimen | – |
| `step_sand` | Ayak sesi: kum | – |
| `step_stone` | Ayak sesi: taş | – |
| `step_wood` | Ayak sesi: tahta (bina içi dahil) | – |
| `step_mud` | Ayak sesi: çamur | – |
| `step_snow` | Ayak sesi: kar | – |
| `step_water` | Ayak sesi: sığ su | – |
| `hoof_dirt` | Toynak sesi: toprak (başka zeminin dosyası yoksa bu çalar) | – |
| `hoof_grass` | Toynak sesi: çimen | – |
| `hoof_sand` | Toynak sesi: kum | – |
| `hoof_stone` | Toynak sesi: taş | – |
| `hoof_wood` | Toynak sesi: tahta (bina içi dahil) | – |
| `hoof_mud` | Toynak sesi: çamur | – |
| `hoof_snow` | Toynak sesi: kar | – |
| `hoof_water` | Toynak sesi: sığ su | – |
| `horse_neigh` | At kişnemesi (ıslıkla çağırma, şahlanma) | – |
| `whistle` | Oyuncunun atını ıslıkla çağırması | – |
| `growl` | Kurt / çakal hırlaması | – |
| `growl_bear` | Ayı kükremesi | – |
| `cougar` | Puma hırlaması | – |
| `wolf_howl` | Gece uzaktan kurt uluması | – |
| `coyote_howl` | Gece uzaktan çakal uluması | – |
| `bird` | Gündüz kuş cıvıltısı (tekil, ara ara) | – |
| `owl` | Gece baykuş | – |
| `hawk` | Gündüz kırda şahin çığlığı | – |
| `thunder` | Fırtınada gök gürültüsü | – |
| `train_whistle` | Tren düdüğü | – |
| `amb_wind` | Döngü: rüzgâr | – |
| `amb_wind_strong` | Döngü: sert rüzgâr, fırtına | – |
| `amb_rain` | Döngü: yağmur | – |
| `amb_fire` | Döngü: kamp ateşi çıtırtısı | – |
| `amb_river` | Döngü: nehir, akan su | – |
| `amb_crickets` | Döngü: gece cırcır böcekleri | – |
| `amb_crowd` | Döngü: kasaba uğultusu (gündüz) | – |
| `door_open` | Bina kapısından girip çıkma | – |
| `saloon_door` | Saloon / kantina yaylı kapısı | – |
| `drink` | İçme (matara, viski, su, ilaç) | – |
| `eat` | Yemek yeme | – |
| `lasso` | Kement fırlatma (ayrıca yakın dövüşte savurma) | – |
| `rope` | İple bağlama | – |
| `skin` | Hayvan yüzme | – |
| `coins` | Para alıp verme | – |
| `ui_move` | Menüde gezinme | – |
| `ui_ok` | Menüde seçme / onay | – |
| `ui_back` | Menüden geri / kapatma | – |
| `ui_error` | Olmaz / hata | – |
| `ui_pick` | Eşya alma | – |
| `chime` | Bildirim, başarı | – |
| `discover` | Yeni yer keşfi | – |
