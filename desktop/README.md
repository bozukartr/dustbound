# Frontier's End — Masaüstü ve Steam sürümü

Oyun, tarayıcı sürümüyle aynı kaynaktan (depo kökündeki `index.html`, `js/`, `css/`, `lang/`, `audio/`, `fonts/`) **Electron** ile masaüstü uygulamasına paketlenir. Steam özellikleri **steamworks.js** ile ana süreçte çalışır; oyun sayfası `preload.js` üzerinden dar bir köprüyle (`window.native`) erişir. Oyun tarafındaki karşılığı `js/platform.js`'tir. Tarayıcıda köprü olmadığı için aynı kod web'de de çalışır.

## Hızlı başlangıç

```bash
cd desktop
npm install            # electron, electron-builder, steamworks.js
npm start              # oyunu masaüstü penceresinde aç (Steam açıksa Steam'e bağlanır)
npm run dev            # geliştirici modu: F12 geliştirici araçları
npm run dist:win       # Windows paketi → dist/win-unpacked/
npm run dist:linux     # Linux / Steam Deck paketi → dist/linux-unpacked/
npm run achievements   # steam/achievements.csv ve .md listesini yeniden üret
```

`npm start` ve `dist:*` önce `scripts/prepare.js` ile oyun dosyalarını `desktop/app/` içine kopyalar. Bu klasör ve `dist/` git'e girmez.

## Steam AppID

`package.json` içindeki `"steamAppId"` şu an **480**. Bu, Valve'ın herkese açık test uygulaması Spacewar. Steam açıkken oyun ona bağlanır; overlay (Shift+Tab) ve Steam kütüphanesi test edilebilir. Frontier's End başarımları 480'de tanımlı olmadığı için başarım testleri gerçek AppID ile yapılmalı.

Gerçek AppID alınca:
1. `package.json` → `"steamAppId": <AppID>`
2. `steam/scripts/*.vdf` içindeki `0000000` (AppID) ve `0000001` / `0000002` (depo kimlikleri) değerlerini değiştir.

Paketlenmiş sürüm Steam dışından açılırsa `restartAppIfNecessary` oyunu Steam üzerinden yeniden başlatır. Bu davranış 480'de ve geliştirici modunda kapalı.

## Neler bağlı?

| Özellik | Nasıl |
|---|---|
| **Başarımlar** | Oyunda bir başarım kazanılınca `ACH_<KİMLİK>` API adıyla Steam'e işlenir. Kayıt yüklenince daha önce kazanılanlar da eşitlenir. Liste: `steam/achievements.md` / `.csv`. Simgeler: `steam/achievement-icons/` (64×64 JPG; `ACH_X.jpg` kazanılmış, `ACH_X_locked.jpg` kilitli). Farklı boyut için `tools/steam-assets.html` sayfasını tarayıcıda aç. |
| **Bulut kayıt** | Kayıt ve ayarlar kullanıcı klasörüne JSON dosyası olarak yazılır: Windows `%APPDATA%\Frontier's End\saves\`, Linux `~/.config/Frontier's End/saves/`, macOS `~/Library/Application Support/Frontier's End/saves/`. Her yazım önce geçici dosyaya yapılır, bir önceki kayıt `.bak` olarak saklanır. |
| **Rich Presence** | Arkadaş listesinde "In the main menu" ya da "Age 34 · Harlow". Çeviri dosyaları: `steam/rich_presence_english.vdf`, `steam/rich_presence_turkish.vdf`. |
| **Overlay** | `electronEnableSteamOverlay()` ile Shift+Tab çalışır. Pencere odağı kaybedilince oyun duraklar. |
| **Dil** | İlk açılışta Steam'in oyun dili kullanılır (Türkçe ya da İngilizce). Sonra Ayarlar > Dil / Language. |
| **Pencere** | Varsayılan olarak tam ekran açılır; F11 ya da Ayarlar > Tam Ekran ile değişir ve tercih hatırlanır. Menülerde "Masaüstüne Çık". Pencere kapatılırken oyun kaydedilir. |
| **Kollar** | Xbox, PlayStation ve Steam Deck tuş simgeleri. Bağlı kola ya da Steam Deck'e göre otomatik seçilir; Ayarlar > Kol Simgeleri ile elle de seçilebilir. |

## Steamworks panelinde yapılacaklar

1. **Stats & Achievements:** `steam/achievements.csv` içindeki 40 başarımı API adları, İngilizce ve Türkçe ad/açıklamalarıyla gir. Simgeleri `steam/achievement-icons/` klasöründen yükle ve **Publish** et.
2. **Steam Cloud → Auto-Cloud:** Kotayı ayarla (örn. 10 MB, 20 dosya). Kök yolları ekle:
   - Windows: Root `WinAppDataRoaming`, Subdirectory `Frontier's End/saves`, Pattern `*.json`
   - Linux: Root `LinuxXdgConfigHome`, Subdirectory `Frontier's End/saves`, Pattern `*.json`
   - macOS: Root `MacAppSupport`, Subdirectory `Frontier's End/saves`, Pattern `*.json`
3. **Rich Presence:** Community > Rich Presence Localization bölümüne iki `.vdf` dosyasını yükle.
4. **Başlatma seçenekleri (Installation > General):** Windows `Frontier's End.exe`; Linux `frontiers-end` (yürütülebilir dosya adı `dist/linux-unpacked` içindekiyle aynı olmalı).
5. **SteamPipe yükleme:** `npm run dist:win` ve `npm run dist:linux`, ardından Steamworks SDK'daki steamcmd ile:
   ```
   steamcmd +login <kullanıcı> +run_app_build <depo>/desktop/steam/scripts/app_build.vdf +quit
   ```
6. **İçerik anketi / yapay zekâ beyanı:** Oyundaki müzikler (Suno, ücretli plan) ile yapay zekâ yardımıyla yazılmış metinler ve çeviri beyan edilmeli.

## Güvenlik notları

Oyun sayfası `contextIsolation` ve `sandbox` açıkken çalışır; Node erişimi yoktur. Sayfa başka bir adrese gidemez, dış bağlantılar sistem tarayıcısında açılır. `index.html` bir Content-Security-Policy ile yalnızca yerel dosyaları yükler. Fontlar `fonts/` içinde, lisansları `fonts/LICENSES/` altında.

## Bilinen eksikler

- Steam Deck'te karakter adı yazarken Steam'in ekran klavyesi otomatik açılmıyor. Kullanıcı Steam + X ile açabilir; ad rastgele de seçilebilir.
- macOS paketi imzasız. Mac için Apple Developer imzası ve notarization gerekir.
- Mağaza görselleri (kapsül resimleri, ekran görüntüleri, fragman) bu depoda yok.
