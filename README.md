# FRONTIER'S END

**Amerika, 1890.** 18 yaşındasın. Hedefin, 80 yaşına kadar hayatta kalmak.

Frontier's End, 2D açık dünya bir **hayatta kalma ve rol yapma** oyunudur. Görev yok, "oyun sonu" yok; oynadığın şey bir hayat. Avlan, çalış, keşfet, âşık ol, ev al, kanunla başın derde girsin, yaşlan.

## Çalıştırma

Kurulum ya da derleme adımı yok. İki yol var:

- `index.html` dosyasını tarayıcıda doğrudan aç, **ya da**
- klasörde basit bir sunucu başlat: `npx http-server .` (veya `python3 -m http.server`) ve `http://localhost:8080` adresine git.

**Masaüstü ve Steam:** `desktop/` klasöründe Electron + steamworks.js paketi var: `cd desktop && npm install && npm start`. Steam başarımları, bulut kayıt, Rich Presence, overlay, tam ekran ve kol simgeleri için bkz. [desktop/README.md](desktop/README.md).

Chrome, Edge ve Firefox'un güncel sürümleri desteklenir. PlayStation, Xbox ve Steam Deck kolları USB ya da Bluetooth ile bağlanıp herhangi bir tuşa basınca algılanır; ekrandaki tuş simgeleri bağlı kola göre değişir (Ayarlar > Kol Simgeleri ile elle de seçilebilir).

## Diller

Oyun **Türkçe** ve **İngilizce** oynanabilir. İlk açılışta tarayıcının dili Türkçeyse Türkçe, değilse İngilizce seçilir; Ayarlar > **Dil / Language** satırından istediğin an değiştirebilirsin (menüler anında yeni dile geçer). Dünya üretilirken verilen bina adları gibi birkaç metin, oyun yeniden yüklendiğinde yeni dile döner.

Nasıl çalışıyor:

- Kaynak dil Türkçe. Oyuncuya görünen her metin kodda Türkçe yazılır ve `Tr('…')` ya da `` Tr`… ${x} …` `` ile sarılır. Sözlükteki anahtar, bu Türkçe metnin kendisidir (gettext mantığı). Şablonlardaki `${…}` ifadeleri `{0}`, `{1}`… olur ve çeviride yerleri değiştirilebilir. `{0:day|days}` sayıya göre tekil/çoğul seçer.
- Eşya, silah, hayvan, yer, başarım ve replik gibi veri tabloları `js/data.js` içinde Türkçe kalır; dil seçilince sözlükle yerinde çevrilir.
- `lang/en.js` İngilizce sözlüktür (≈1.740 metin). Yeni bir dil eklemek için bu dosyayı kopyala (ör. `lang/de.js`), `I18N.add('de', …)` yap, değerleri çevir, dosyayı `index.html`'e ekle ve `js/i18n.js` içindeki `LANGS` listesine `['de', 'Deutsch']` yaz.
- **Denetleyici:** `node tools/i18n-check.js en` koddaki ve tablolardaki bütün anahtarları toplayıp dil dosyasıyla karşılaştırır: eksik, kullanılmayan, yer tutucusu uyuşmayan ve içinde Türkçe harf kalmış çevirileri listeler. `--skel` eksikleri dosyaya yapıştırılacak biçimde yazdırır. Bağımlılığı yoktur, yalnızca Node gerekir.
- **Oyun içi kontrol:** `index.html?i18ncheck` ile açınca çalışma sırasında çevirisi bulunamayan anahtarlar `I18N.miss`, ekranda görünen ve Türkçe harf içeren metinler `I18N.seen` kümesinde toplanır.

Eski adla (Dustbound) yapılmış kayıtlar ve ayarlar ilk açılışta yeni ada otomatik taşınır.

## Kontroller

| Eylem | Kol (PlayStation) | Klavye / Fare |
|---|---|---|
| Hareket | Sol analog | W A S D |
| Nişan yönü | Sağ analog (L2 olmadan: kalçadan nişan, karakter o yöne döner) | Fare |
| Koş / Dörtnala | ✕ (basılı) | Shift |
| Etkileşim / Ata bin / İn | △ (basılı tut: seçenekler) | E |
| Nişan al | L2 (en uygun hedefe kilitlenir; sağ analogu savurarak hedef değiştir) | Sağ tık |
| Ateş et | R2 | Sol tık |
| Şarjör değiştir | □ | R |
| Yakın dövüş | ○ | F |
| Çömel / Gizlen | L3 | C |
| Odak (nişan alırken) | R3 | Q |
| Silah / eşya çarkı | L1 (basılı) + sağ analog ile seç; R1 sayfa (Silahlar / Eşyalar); D-Pad ←/→ aynı türde değiştir; ✕ eşya kullan | Tab (basılı) + fare ile seç; Q/E sayfa; tekerlek ya da ←/→ aynı türde değiştir; sol tık eşya kullan |
| Hızlı iyileş / ye | R1 | T |
| Atı çağır (ıslık) | D-Pad ↑ | H |
| Fener | D-Pad ← | L |
| Çanta | D-Pad → | I |
| Kamp kur | D-Pad ↓ (basılı) | B (basılı) |
| Harita | Touchpad | M |
| Günlük | Share | J |
| Maske tak / çıkar | (boş — istersen ata) | V |
| Piksel ölçeği (yakınlaştır / uzaklaştır) | R3 (nişan almıyorken, döngü) | + / − |
| Duraklat | Options | Esc / P |

Menülerde: ✕ / Enter seçer, ○ / Esc geri döner, L1-R1 / Q-E sekme değiştirir.

Kolda nişan: sağ analog ölü bölge ve yumuşatmayla çalışır; nişangah hedefin üzerinden geçerken yavaşlar (sürtünme). L2 basınca baktığın yöndeki en uygun hedefe (önce düşmanlar, sonra saldıran hayvanlar, sonra av) kilitlenir; kilitliyken sağ analogu bir yöne savurunca o taraftaki hedefe geçer. Siviller yalnızca sağ analogla onlara doğru nişan alırsan hedeflenir. Nişanı sabit tuttukça dağılım daralır. **Ayarlar → Nişan Yardımı** (Kapalı / Hafif / Standart / Tam Kilit) ve **Nişan Hassasiyeti** ile ayarlanabilir.

Tuşların hepsi **Ayarlar → Tuş Atamaları** ekranından değiştirilebilir. Klavye/fare ve PS kolu ayrı ayrı ayarlanır; bir tuşu başka bir eylemin tuşuna atarsan ikisi yer değiştirir. Atamalar tarayıcıda saklanır.

## Neler var?

**Dünya**
- 1024×1024 karelik prosedürel dünya: karlı zirveler, çam ormanları, geniş ovalar, kızıl kanyonlar, çöl, bataklık ve okyanus kıyısı.
- 8 kasaba (Harlow, Saint Clement, Dust Creek, Silver Ridge, Cedar Falls, Cypress Bend, Fort Redstone, Coyote Springs); mağaza, saloon, şerif, doktor, silahçı, kasap, ahır, otel, banka, kilise, berber, terzi ve daha fazlası.
- Kasabalar ızgara değil: kavisli bir ana cadde, farklı açılarla ayrılan yan sokaklar, caddeden farklı uzaklıkta duran binalar, kapılardan caddeye uzanan patikalar, meydan, bahçeli evler ve sokak lambaları. Her dünyada farklı bir düzen çıkar.
- **Binaların içi var.** Kapıdan yürüyerek girersin; çatı ve cephe soluklaşır, içerisi görünür. Tezgahın arkasında çalışan, saloonda bar, piyano, kart ve yemek masaları, şerif ofisinde nezarethane, kilisede sıralar ve sunak, otelde yataklar ve küvet, bankada vezne ve kasa var. Hizmetler bu eşyaların başında alınır.
- Dükkanlar gece kapanır ve kapıları kilitlenir (kapı kırılabilir). Evler kilitlidir; kapıyı çalabilir ya da kırıp içeri girebilirsin (haneye tecavüz sayılır, evi aramak haftada bir şey kazandırır). Harabeler aranabilir, terk edilmiş maden galerilerine fenerle girilebilir, deniz fenerine tırmanınca kıyı haritası açılır. Her binanın kapı önü dünya üretilirken engellerden temizlenir. Atlar ve hayvanlar binalara giremez. Kasabalılar akşam evlerine girer, sabah çıkar; saloon akşamları kalabalıklaşır, piyanist çalar.
- **Göçebe kampları**: tüccar kervanları, sığırtmaçlar, altın arayıcıları, kürkçüler ve seyyar bir kumpanya kasabaların dışında kamp kurar. Takas yapabilir, ateş başında dinlenip hikâye dinleyebilirsin. Her kamp 5–10 yılda bir başka bir yere göç eder.
- Kasabaları bağlayan yollar, köprüler ve istasyonlar arasında gidip gelen **trenler** (bilet alıp seyahat edebilirsin).
- 25 keşfedilecek önemli yer: göktaşı krateri, bin yıllık sekoya, hayalet kasaba, terk edilmiş maden, sıcak kaynaklar, dinozor kemikleri, karaya oturmuş gemi, gözetleme tepeleri. Bunlara haydut kampları, çiftlikler ve satılık mülkler eklenir.
- Gezdikçe açılan parşömen harita, GPS rotası ve radar.
- Ağaçlar, kaktüsler ve direkler yalnızca gövdeleriyle çarpışır; bir engele çarpınca karakter, at ve NPC'ler durmak yerine etrafından akıcı biçimde kayarak devam eder.
- Gece-gündüz döngüsü, yağmur, fırtına, kar, kum fırtınası ve sis.
- **Canlı görsel efektler**: Ortak bir rüzgâr yönü bulut gölgelerini, baca ve kamp ateşi dumanını, yağmuru, otları ve sazlıkları etkiler. Çalılar, otlar, çiçekler ve ekinler rüzgârda salınır, yanlarından geçince eğilir. Sonbaharda ağaçlardan yaprak düşer. Kasaba bacaları sabah ve akşam, soğukta ise gün boyu tüter. Kum, çöl, çamur ve karda ayak ve toynak izleri kalır; seyrek ve silik tutulur, yarım dakikada solar (kasaba sokaklarında iz kalmaz). Suda yürürken ve yağmurda su yüzeyinde halkalar oluşur, kıyıya ince dalgalar vurur. Soğukta oyuncunun, atların ve NPC'lerin nefesi buhar olur.
- **Silah efektleri**: Mermi değdiği yüzeye göre tepki verir: suda sıçrama ve halka, ahşapta kıymık, kayada kıvılcım, toprakta, kumda ya da karda o zeminin renginde toz. Iskalanan mermiler nişan noktasının biraz ötesinde yere saplanır; üstüne ateş edilirken etrafında toz kalktığını görürsün. Namlu dumanı havada asılı kalıp rüzgârla dağılır. Kollu tüfekler her atışta kovan fırlatır, tabanca ve av tüfeği dolumda boş kovanları döker.
- **Renk ve ekran efektleri**: Gün doğumu ve batımında altın saat, alacakaranlıkta mavi saat, çölde sıcak, yağmurda soğuk ve soluk, karda buz mavisi, bataklıkta yeşilimsi tonlar yumuşak geçişlerle uygulanır. Sağlık azaldıkça renkler çekilir ve kalp atışıyla ekran kenarı kızarır (kalp sesi duyulur). Sarhoşken görüntü çift görünür ve sallanır. Ayazda ekran kenarları buz tutar. Odak modu sepya tonuna, film grenine ve çiziklere bürünür.
- Ayarlar > **Görsel Efektler**: *Tam* ya da *Sade*. Sade modda bitki salınımı, bulut gölgeleri, yapraklar ve izler kapanır; renk ve durum efektleri kalır.
- **Mevsimler görünür**: kışın soğuk bölgeler, çatılar ve ağaçlar karla kaplanır, göller donar, yapraklı ağaçlar çıplak kalır; sonbaharda yapraklar sararır; yazın otlar kurur. Harita da mevsime göre değişir.

**Hayatta kalma ve hayat**
- Açlık, susuzluk, uyku, temizlik, vücut ısısı, hastalık, zehirlenme ve sarhoşluk.
- **Yaşlanma**: 18 yaşında başlarsın. 30'lardan sonra dayanıklılık, 50'lerden sonra sağlık azalır; saçın ağarır. Yaşlanma hızı seçilebilir.
- Otellerde, kendi evinde ya da kamp kurup uyuyabilirsin. Kamp kurmak için bir Uyku Tulumu (genel mağaza) gerekir; kasabadan uzakta kamp tuşunu basılı tut. Kamp ateşinde yemek pişirip tonik ve ok yapabilirsin.
- Madenlerde, kerestecide, limanda ve çiftliklerde çalışarak para kazanırsın. Mülk satın alabilir, bankaya para yatırabilirsin.
- Her kasabada tanışabileceğin biri yaşar. Onunla ilişki kurup evlenebilir, çocuk sahibi olabilirsin.

**Başlangıç**
- Karakter oluşturma ekranı dört bölümden oluşur: Kimlik, Görünüm, Kıyafet, Hikâye. Ortada çerçeveli portre, sağda seçilen geçmişin kartı (başlangıç kasabası, para, at, yetenekler, eşyalar) görünür.
- Yeni bir hayat, seçilen geçmişe özel kısa bir **3D varış sinematiğiyle** başlar: Harlow'a at arabasıyla, Saint Clement'e buharlı gemiyle, Dust Creek'e gün batımında dörtnala, Fort Redstone'a trenle, Cedar Falls'a sisli ormandan. Sinematikler aynı piksel sanat görünümünü korur (düşük çözünürlük, renk kademesi, dither) ve bir tuşla geçilebilir.

**Etkileşim ve eşyalar**
- İki sayfalı çark: **Silahlar** ve **Eşyalar** (yiyecek, içecek, ilaç, tütün, bitkiler, at eşyaları, kit, giysi). Aynı yuvadaki silah ya da eşyalar arasında geçilebilir; eşyalar çarktan doğrudan kullanılır.
- 90'dan fazla eşya: yiyecekler, ilaçlar, bitkiler, postlar, balıklar, değerli eşyalar, koleksiyonlar, aletler ve giysiler.
- Avcılık ve deri yüzme, bitki toplama, balık tutma (mini oyun), altın eleme, cevher kazma, hazine haritaları.
- Silahlar: bıçak, kement, iki tabanca, iki karabina, uzun tüfek, av tüfeği, yay ve dinamit. Bir de zamanı yavaşlatan **Odak** modu.
- **Kement ve bağlama**: Kementle yakaladığın kişiyi yaklaşıp etkileşim tuşunu basılı tutarak bağlarsın. Uzaklaşırsan (at sırtında da) onu peşinden sürüklersin; ateş tuşu ipi bırakır. Yumrukla yere serilen biri ölmez, bayılır. Ödül avının hedefi ağır yaralanınca çoğunlukla yere yığılır; o da bağlanabilir. Bağlı kişi bir süre sonra iplerinden kurtulur.
- **Taşıma**: Cesetleri, bağlı ya da baygın kişileri, leşleri ve büyük postları **omzuna alabilir** (leş ve cesette ikincil eylem: şarjör tuşu), atının yanındayken **eyere yükleyebilirsin**. Eyer 4 birim taşır (kişi ve iri leş 2, post ve küçük leş 1). Omuzda yükle koşamaz, silah kullanamazsın; yüklü at biraz yavaşlar. Yükler kayda geçer.
- **Postlar**: Geyik, kızıl geyik, antilop, bizon, ayı, puma, yaban domuzu ve timsah postları çantaya sığmaz; yüzdükten sonra omzunda ya da eyerde taşınır. Ayı, bizon ve timsah gibi iri hayvanların leşi taşınamaz, önce derisi yüzülür. Postları ve leşleri kasap, tuzakçı ya da genel mağazanın içinde sat; atın kapıdaysa eyerdekiler de satılır. Bütün leş, parça parça satmaktan biraz daha iyi fiyat getirir.
- NPC'lerle selamlaşma (günün saatine, havaya, role ve tanışıklığa göre değişen 100'ü aşkın replik), kışkırtma, soygun; yol olayları (yaralı yolcular, soygunlar, pusu, kırık arabalar, seyyar satıcılar); ödül ilanları.
- Yirmi Bir (blackjack), bilek güreşi, hızlı çekiş düellosu, söylenti dinleme, gazete okuma, kamp ateşinde mızıka çalma.
- Atlar: satın alma, yabani at evcilleştirme, bağ seviyesi, ıslıkla çağırma.

**Kanun ve onur**
- **Tanıklar**: Suçunu gören biri önce en yakın kanun adamına ya da şerif ofisine koşar. Ulaşamadan onu durdurursan (silah doğrultup tehdit ederek, rüşvet vererek ya da daha kötüsüyle) suç kayda geçmez. Kanun adamlarının gözü önünde işlenen suçlar ve dükkan/banka soygunları anında bildirilir.
- **Maske ve kılık**: Bandana ya da çuval maske takarak işlediğin suçlar sana değil, "maskeli bir yabancıya" yazılır. Kimse görmeden maskeni çıkarırsan izini kaybederler; biri görürse kimliğin açığa çıkar ve ödül senin adına geçer. Maskeyi takarken görülürsen de maske işe yaramaz. Kanun, suç anındaki şapkanı ve paltonu hatırlar: kıyafet değiştirirsen kasabalarda tanınman zorlaşır. Dükkanlar maskeli müşteriye hizmet etmez (kaçakçı hariç).
- Tavuk ya da inek öldürmek gibi küçük kabahatler kovalamaca başlatmaz, yalnızca para cezası yazılır.
- Soyulan bir dükkânın kasası boşalır ve ancak 3 gün sonra dolar; bankanın kasası 7 günde yenilenir. Dükkânlarda satılan eşyalar en ucuz alış fiyatının altında satılır, al-sat döngüsüyle para basılamaz. Bilek güreşi günde 3 kez oynanabilir.
- **Teslim olma ve tutuklanma**: Düşük aranma seviyesinde (1–2 yıldız) kanun adamları önce silah doğrultup yaklaşır ve teslim olmanı ister; ateş etmezler. Yanlarında etkileşim tuşunu basılı tutarak teslim olursun: ya ödülü ceza olarak ödersin ya da ödüle göre 1–7 gün hapis yatarsın. Ateş edersen, kanun adamına silah doğrultursan, kaçarsan ya da uyarılara rağmen teslim olmazsan ateş açarlar. Cinayet ve kanun adamına saldırı ise doğrudan çatışma başlatır.
- Aranma seviyesi, arama alanı ve peşine düşen kanun adamları. Ödülünü şerif ofisinde ödeyebilirsin.
- **Ödül avı ve teslim**: İlan panosundan alınan hedef ölünce ödül kendiliğinden verilmez; kişiyi şerif ofisine getirmen gerekir. Canlı teslim tam ödülü, ceset yarısını getirir. Haydutları da teslim edebilirsin (canlı $15, ceset $5). Omzundakini ofisin içinde, eyerdekini ofis kapısında at sırtında ya da şerifin masasında teslim edersin.
- **Kanıt**: Öldürdüğün masum birinin cesedi kanıttır. Biri cesedi bulduğunda sen yakındaysan suç sana yazılır ve tanık şerife koşar; uzaktaysan iz kalmaz. Ceset ya da bağlı biriyle görülmek de suçtur. Cesedi ıssız bir yere taşıyabilir, suya atabilir ya da kürekle gömebilirsin. Bağlanan tanık haber veremez.
- Onur sistemi fiyatları ve insanların sana nasıl davrandığını etkiler.

**Gelişim**
- 7 yetenek (nişancılık, avcılık, hayatta kalma, binicilik, ticaret, karizma, güç). Yaptıkça gelişirler.
- 40 başarım. Çoğu kalıcı bir **kazanım (perk)** verir: daha iyi post fiyatları, soğuğa dayanıklılık, daha yavaş tükenen odak gibi.

**Oyun modları**
- *Hikaye*: ölürsen doktor seni kurtarır; biraz para ve kalıcı sağlık kaybedersin.
- *Tek Hayat*: ölüm kalıcıdır, kayıt silinir.

Oyun, uyuduğunda ve her yeni günde otomatik kaydedilir (tarayıcının `localStorage` alanına).

## Teknik

- Saf HTML, CSS ve JavaScript. Hiçbir kütüphane ve varlık dosyası yok; bütün grafik ve sesler kodla üretiliyor.
- Arayüzdeki bütün ikonlar (eşyalar, silahlar, radar ve harita işaretleri, PS tuşları) koddan üretilen SVG'lerdir.
- Dünya, 512 piksellik parçalar (chunk) halinde önceden çizilip önbelleğe alınır. Yeni parçalar kare başına küçük bir zaman bütçesiyle arka planda hazırlanır, bu yüzden hareket ederken takılma olmaz.
- Oyun düşük çözünürlüklü bir tuvale çizilip piksel ölçeklemeyle büyütülür. Bu hem piksel sanat görünümü verir hem de akıcı FPS sağlar.
- Efektler ve ortam sesleri WebAudio ile prosedürel olarak üretilir. Ana tema ve saloon piyanosu `audio/` klasöründeki sıkıştırılmış mp3 dosyalarından akışla çalınır (belleğe tamamen açılmaz). Ana tema menüde ve keşif sırasında aralıklarla, Karplus-Strong gitarıyla çalan prosedürel müzikle dönüşümlü çalar.
- Saloon piyanosu üç parça arasından rastgele seçilir. İçeride tam sesle duyulur; dışarıda kapıya yaklaştıkça yavaşça yükselir, duvar arkasından boğuk gelir. Piyano duyulurken ana tema kısılır.

```
index.html
css/style.css
js/util.js      yardımcılar, RNG, gürültü
js/platform.js  platform katmanı: kayıt, Steam başarımları, rich presence, tam ekran, çıkış
fonts/          yerel fontlar ve lisansları
desktop/        Electron + Steam masaüstü paketi
js/i18n.js      çok dil desteği: Tr(), dil seçimi, tablo ve HTML çevirisi
lang/en.js      İngilizce sözlük
tools/i18n-check.js  eksik/fazla çeviri denetleyicisi (node)
js/icons.js     SVG ikon seti (eşya, silah, glif, PS tuşları)
js/data.js      eşyalar, silahlar, hayvanlar, kasabalar, başarımlar
js/input.js     klavye, fare ve oyun kolu (PlayStation, Xbox, Steam Deck simgeleri)
js/audio.js     prosedürel ses, müzik ve mp3 akışı
audio/          ana tema ve saloon piyanosu (mp3)
js/world.js     dünya üretimi, chunk render, harita
js/sprites.js   karakter, hayvan, at, bina ve nesne çizimleri
js/entities.js  oyuncu, at, hayvan, NPC, tren, parçacıklar
js/systems.js   zaman, hava, hayatta kalma, kanun, doğma, etkileşim
js/ui.js        HUD, radar, harita, menüler, mini oyunlar
js/cinema.js    kasabaya varış sinematikleri (kütüphanesiz WebGL)
js/fx.js        görsel efektler: rüzgâr, bulut gölgesi, duman, iz, isabet, salınım, su, renk derecelendirme
js/game.js      oyun döngüsü, kamera, render, ışık, kayıt
js/main.js      başlatıcı
```
