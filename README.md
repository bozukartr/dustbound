# DUSTBOUND

**Amerika, 1890.** 18 yaşındasın. Hedefin, 80 yaşına kadar hayatta kalmak.

Dustbound, Red Dead Redemption 2 ve GTA'dan esinlenen, tarayıcıda çalışan 2D açık dünya bir **hayatta kalma ve rol yapma** oyunudur. Görev yok, "oyun sonu" yok; oynadığın şey bir hayat. Avlan, çalış, keşfet, âşık ol, ev al, kanunla başın derde girsin, yaşlan.

## Çalıştırma

Kurulum ya da derleme adımı yok. İki yol var:

- `index.html` dosyasını tarayıcıda doğrudan aç, **ya da**
- klasörde basit bir sunucu başlat: `npx http-server .` (veya `python3 -m http.server`) ve `http://localhost:8080` adresine git.

Chrome, Edge ve Firefox'un güncel sürümleri desteklenir. PlayStation kolu (DualShock 4 / DualSense) USB ya da Bluetooth ile bağlanıp herhangi bir tuşa basınca algılanır ve ekrandaki tuş simgeleri PS simgelerine döner.

## Kontroller

| Eylem | PlayStation | Klavye / Fare |
|---|---|---|
| Hareket | Sol analog | W A S D |
| Nişan yönü | Sağ analog (L2 olmadan: kalçadan nişan, karakter o yöne döner) | Fare |
| Koş / Dörtnala | ✕ (basılı) | Shift |
| Etkileşim / Ata bin / İn | △ (basılı tut: seçenekler) | E |
| Nişan al | L2 | Sağ tık |
| Ateş et | R2 | Sol tık |
| Şarjör değiştir | □ | R |
| Yakın dövüş | ○ | F |
| Çömel / Gizlen | L3 | C |
| Dead Eye (nişan alırken) | R3 | Q |
| Silah / eşya çarkı | L1 (basılı) + sağ analog ile seç; R1 sayfa (Silahlar / Eşyalar); D-Pad ←/→ aynı türde değiştir; ✕ eşya kullan | Tab (basılı) + fare ile seç; Q/E sayfa; tekerlek ya da ←/→ aynı türde değiştir; sol tık eşya kullan |
| Hızlı iyileş / ye | R1 | T |
| Atı çağır (ıslık) | D-Pad ↑ | H |
| Fener | D-Pad ← | L |
| Çanta | D-Pad → | I |
| Kamp kur | D-Pad ↓ (basılı) | B (basılı) |
| Harita | Touchpad | M |
| Günlük | Share | J |
| Maske tak / çıkar | (boş — istersen ata) | V |
| Duraklat | Options | Esc / P |

Menülerde: ✕ / Enter seçer, ○ / Esc geri döner, L1-R1 / Q-E sekme değiştirir.

Tuşların hepsi **Ayarlar → Tuş Atamaları** ekranından değiştirilebilir. Klavye/fare ve PS kolu ayrı ayrı ayarlanır; bir tuşu başka bir eylemin tuşuna atarsan ikisi yer değiştirir. Atamalar tarayıcıda saklanır.

## Neler var?

**Dünya**
- 1024×1024 karelik prosedürel dünya: karlı zirveler, çam ormanları, geniş ovalar, kızıl kanyonlar, çöl, bataklık ve okyanus kıyısı.
- 8 kasaba (Harlow, Saint Clement, Dust Creek, Silver Ridge, Cedar Falls, Bayou Noir, Fort Mercy, Coyote Springs); mağaza, saloon, şerif, doktor, silahçı, kasap, ahır, otel, banka, kilise, berber, terzi ve daha fazlası.
- Kasabalar ızgara değil: kavisli bir ana cadde, farklı açılarla ayrılan yan sokaklar, caddeden farklı uzaklıkta duran binalar, kapılardan caddeye uzanan patikalar, meydan, bahçeli evler ve sokak lambaları. Her dünyada farklı bir düzen çıkar.
- **Binaların içi var.** Kapıdan yürüyerek girersin; çatı ve cephe soluklaşır, içerisi görünür. Tezgahın arkasında çalışan, saloonda bar, piyano, kart ve yemek masaları, şerif ofisinde nezarethane, kilisede sıralar ve sunak, otelde yataklar ve küvet, bankada vezne ve kasa var. Hizmetler bu eşyaların başında alınır.
- Dükkanlar gece kapanır ve kapıları kilitlenir (kapı kırılabilir). Evler kilitlidir. Atlar ve hayvanlar binalara giremez. Kasabalılar akşam evlerine girer, sabah çıkar; saloon akşamları kalabalıklaşır, piyanist çalar.
- **Göçebe kampları**: tüccar kervanları, sığırtmaçlar, altın arayıcıları, kürkçüler ve seyyar bir kumpanya kasabaların dışında kamp kurar. Takas yapabilir, ateş başında dinlenip hikâye dinleyebilirsin. Her kamp 5–10 yılda bir başka bir yere göç eder.
- Kasabaları bağlayan yollar, köprüler ve istasyonlar arasında gidip gelen **trenler** (bilet alıp seyahat edebilirsin).
- 25 keşfedilecek önemli yer: göktaşı krateri, bin yıllık sekoya, hayalet kasaba, terk edilmiş maden, sıcak kaynaklar, dinozor kemikleri, karaya oturmuş gemi, gözetleme tepeleri. Bunlara haydut kampları, çiftlikler ve satılık mülkler eklenir.
- Gezdikçe açılan parşömen harita, GPS rotası ve RDR2 tarzı radar.
- Gece-gündüz döngüsü, yağmur, fırtına, kar, kum fırtınası ve sis.
- **Mevsimler görünür**: kışın soğuk bölgeler, çatılar ve ağaçlar karla kaplanır, göller donar, yapraklı ağaçlar çıplak kalır; sonbaharda yapraklar sararır; yazın otlar kurur. Harita da mevsime göre değişir.

**Hayatta kalma ve hayat**
- Açlık, susuzluk, uyku, temizlik, vücut ısısı, hastalık, zehirlenme ve sarhoşluk.
- **Yaşlanma**: 18 yaşında başlarsın. 30'lardan sonra dayanıklılık, 50'lerden sonra sağlık azalır; saçın ağarır. Yaşlanma hızı seçilebilir.
- Otellerde, kendi evinde ya da kamp kurup uyuyabilirsin. Kamp kurmak için bir Uyku Tulumu (genel mağaza) gerekir; kasabadan uzakta kamp tuşunu basılı tut. Kamp ateşinde yemek pişirip tonik ve ok yapabilirsin.
- Madenlerde, kerestecide, limanda ve çiftliklerde çalışarak para kazanırsın. Mülk satın alabilir, bankaya para yatırabilirsin.
- Her kasabada tanışabileceğin biri yaşar. Onunla ilişki kurup evlenebilir, çocuk sahibi olabilirsin.

**Başlangıç**
- Karakter oluşturma ekranı dört bölümden oluşur: Kimlik, Görünüm, Kıyafet, Hikâye. Ortada çerçeveli portre, sağda seçilen geçmişin kartı (başlangıç kasabası, para, at, yetenekler, eşyalar) görünür.
- Yeni bir hayat, seçilen geçmişe özel kısa bir **3D varış sinematiğiyle** başlar: Harlow'a at arabasıyla, Saint Clement'e buharlı gemiyle, Dust Creek'e gün batımında dörtnala, Fort Mercy'ye trenle, Cedar Falls'a sisli ormandan. Sinematikler aynı piksel sanat görünümünü korur (düşük çözünürlük, renk kademesi, dither) ve bir tuşla geçilebilir.

**Etkileşim ve eşyalar**
- RDR2 tarzı iki sayfalı çark: **Silahlar** ve **Eşyalar** (yiyecek, içecek, ilaç, tütün, bitkiler, at eşyaları, kit, giysi). Aynı yuvadaki silah ya da eşyalar arasında geçilebilir; eşyalar çarktan doğrudan kullanılır.
- 90'dan fazla eşya: yiyecekler, ilaçlar, bitkiler, postlar, balıklar, değerli eşyalar, koleksiyonlar, aletler ve giysiler.
- Avcılık ve deri yüzme, bitki toplama, balık tutma (mini oyun), altın eleme, cevher kazma, hazine haritaları.
- Silahlar: bıçak, iki tabanca, iki karabina, uzun tüfek, av tüfeği, yay ve dinamit. Bir de Dead Eye.
- NPC'lerle selamlaşma, kışkırtma, soygun; yol olayları (yaralı yolcular, soygunlar, pusu, kırık arabalar, seyyar satıcılar); ödül ilanları.
- Yirmi Bir (blackjack), bilek güreşi, hızlı çekiş düellosu, söylenti dinleme, gazete okuma, kamp ateşinde mızıka çalma.
- Atlar: satın alma, yabani at evcilleştirme, bağ seviyesi, ıslıkla çağırma.

**Kanun ve onur**
- **Tanıklar**: Suçunu gören biri önce en yakın kanun adamına ya da şerif ofisine koşar. Ulaşamadan onu durdurursan (silah doğrultup tehdit ederek, rüşvet vererek ya da daha kötüsüyle) suç kayda geçmez. Kanun adamlarının gözü önünde işlenen suçlar ve dükkan/banka soygunları anında bildirilir.
- **Maske ve kılık**: Bandana ya da çuval maske takarak işlediğin suçlar sana değil, "maskeli bir yabancıya" yazılır. Kimse görmeden maskeni çıkarırsan izini kaybederler; biri görürse kimliğin açığa çıkar ve ödül senin adına geçer. Maskeyi takarken görülürsen de maske işe yaramaz. Kanun, suç anındaki şapkanı ve paltonu hatırlar: kıyafet değiştirirsen kasabalarda tanınman zorlaşır. Dükkanlar maskeli müşteriye hizmet etmez (kaçakçı hariç).
- Tavuk ya da inek öldürmek gibi küçük kabahatler kovalamaca başlatmaz, yalnızca para cezası yazılır.
- Aranma seviyesi, arama alanı ve peşine düşen kanun adamları. Ödülünü şerif ofisinde ödeyebilirsin.
- Onur sistemi fiyatları ve insanların sana nasıl davrandığını etkiler.

**Gelişim**
- 7 yetenek (nişancılık, avcılık, hayatta kalma, binicilik, ticaret, karizma, güç). Yaptıkça gelişirler.
- 40 başarım. Çoğu kalıcı bir **kazanım (perk)** verir: daha iyi post fiyatları, soğuğa dayanıklılık, daha yavaş tükenen Dead Eye gibi.

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
js/icons.js     SVG ikon seti (eşya, silah, glif, PS tuşları)
js/data.js      eşyalar, silahlar, hayvanlar, kasabalar, başarımlar
js/input.js     klavye, fare ve PlayStation kolu
js/audio.js     prosedürel ses, müzik ve mp3 akışı
audio/          ana tema ve saloon piyanosu (mp3)
js/world.js     dünya üretimi, chunk render, harita
js/sprites.js   karakter, hayvan, at, bina ve nesne çizimleri
js/entities.js  oyuncu, at, hayvan, NPC, tren, parçacıklar
js/systems.js   zaman, hava, hayatta kalma, kanun, doğma, etkileşim
js/ui.js        HUD, radar, harita, menüler, mini oyunlar
js/cinema.js    kasabaya varış sinematikleri (kütüphanesiz WebGL)
js/game.js      oyun döngüsü, kamera, render, ışık, kayıt
js/main.js      başlatıcı
```
