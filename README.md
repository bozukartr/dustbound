# FRONTIER'S END

**Amerika, 1890.** 18 yaşındasın. Hedefin, 80 yaşına kadar hayatta kalmak.

Frontier's End, 2D açık dünya bir **hayatta kalma ve rol yapma** oyunudur. Sabit bir "oyun sonu" yok; oynadığın şey bir hayat. İstersen kısa, hikâyeli bir başlangıçla öğrenerek girersin. Avlan, çalış, keşfet, âşık ol, ev al, kanunla başın derde girsin, yaşlan.

## Çalıştırma

Kurulum ya da derleme adımı yok. İki yol var:

- `index.html` dosyasını tarayıcıda doğrudan aç, **ya da**
- klasörde basit bir sunucu başlat: `npx http-server .` (veya `python3 -m http.server`) ve `http://localhost:8080` adresine git.

**Masaüstü ve Steam:** `desktop/` klasöründe Electron + steamworks.js paketi var: `cd desktop && npm install && npm start`. Steam başarımları, bulut kayıt, Rich Presence, overlay, tam ekran ve kol simgeleri için bkz. [desktop/README.md](desktop/README.md).

Chrome, Edge ve Firefox'un güncel sürümleri desteklenir. PlayStation, Xbox ve Steam Deck kolları USB ya da Bluetooth ile bağlanıp herhangi bir tuşa basınca algılanır; ekrandaki tuş simgeleri bağlı kola göre değişir (Ayarlar > Kol Simgeleri ile elle de seçilebilir).

## Diller

Oyun **Türkçe** ve **İngilizce** oynanabilir. İlk açılışta tarayıcının dili Türkçeyse Türkçe, değilse İngilizce seçilir; Ayarlar > **Dil / Language** satırından istediğin an değiştirebilirsin (menüler anında yeni dile geçer). Dünya üretilirken verilen bina adları gibi birkaç metin, oyun yeniden yüklendiğinde yeni dile döner.

**Yeni hayat:** Her yeni hayatta varış sinematiğinden sonra kısa, sayfalı bir **hoş geldin rehberi** açılır: amaç, hayatta kalma, dolaşma ve etkileşim, para kazanma, kasaba hayatı ve kısayollar. Sayfalar ◀ ▶ ile gezilir, "Atla" ya da "Maceraya Başla!" ile kapanır; hikâyeli başlangıç açıksa rehber kapanınca Sully'nin ilk bölümü başlar. Son sayfadaki **"Yeni hayatlarda bu rehberi gösterme"** ya da Ayarlar → Genel → **Yeni Hayatta Rehber** ile kapatılabilir. İstendiğinde Duraklat menüsünden (**Rehber**) ya da Günlük → Rehber sekmesinden yeniden açılır.

**Hikâyeli başlangıç — Sully'nin Senedi:** Karakter ekranının Hikâye sekmesindeki **Hikâyeli Başlangıç** (varsayılan açık) oyunu on bölümlük, oynayarak öğreten bir hikâyeyle başlatır. Çiftçi Çocuğu Harlow ovalarında büyümüştür; iki kurak yazın borcu yüzünden banka ailenin toprağına el koymuş, ailesi doğudaki akrabalarının yanına gitmiş, o ise ovada kalmıştır. Kasabada babasının eski komşusu, yaşlı çiftçi **Dunham Sully**'den iş ister; Sully'nin çiftliğinin tapusu da yolda Kızıl Jack'in çetesi tarafından çalınmıştır. Bölümler: *Tanıdık Yüzler* (Sully'den iş isteme, selamlaşma, mağaza), *Karnını Doyur* (alışveriş, yemek, matara), *Sully'nin Çiftliği* (ıslık, ata binme, rota), *Kümesteki Çakallar* (nişan, ateş, av, deri yüzme), *Kasabın Terazisi* (satış), *Alın Teri* (gece itirafı, çiftlikte çalışma), *Kanunun Kapısı* (banka, şerif, ilan panosu), *Saloon Söylentileri* (içki, söylenti, kampın yeri), *Ateş Başında* (kamp, pişirme, sabaha kadar uyku), *Kızıl Jack* (dürbün, gizlenme, odak, kement, bağlama, tapuyu alma, şerife teslim). Hikâye motoru geçmişten bağımsızdır: beş geçmişin her biri kendi on bölümlük hikâyesiyle başlar (akıl hocası, hedef kişi, bölümler ve sinematikler hikâye tanımından okunur). Sully'nin Senedi Çiftçi Çocuğu'nun hikâyesidir; hikâye kimliği taşımayan eski kayıtlar da onunla sürer.

**Kanun Kaçağı — Son İş:** Çetenin saklı kampında uyanırsın. Yaşlı tetikçi **Hollis Crane** artık bırakmak istiyor; lider **Silas Vance** son bir büyük iş peşinde. Bölümler: *Kampta Sabah* (pişirme, yemek, şarjör), *Mustang* (ıslık, fırçalama, dörtnala), *Çetenin Sofrası* (av, deri), *Yüzünü Sakla* (bandana, kasabaya tanınmadan girip maskesiz alışveriş, tanınırsan kaçış), *Kirli Para* (kaçakçıya mücevher, terziden yeni şapka ya da palto: eşkâl değiştirme), *Posta Arabası* (pusu, maske, sürücüyü kementle indirip posta çantasını arama; Hollis kimsenin ölmesini istemez), *Peşimizde* (kanunu atlatma), *Ödül Avcıları* (avcılarla pazarlık, teslim ya da çatışma), *İhanet* (Vance avcıları sana yollamış, Hollis'i kaçırmış: dürbünle gözetle, gizlice yaklaş, iplerini kes), *Seçim* (Vance'i yakalayıp şerife teslim et ve sicilin temizlensin ya da şerife gidip kendin teslim ol: ceza öde ya da hapis yat). Kampta çetenin dost üyeleri (Dutch, Pete, sonra Vance) ateşin başında oturur; tanık olmaz, kanuna koşmaz. Bitince Hollis batıya gider ve tabancasını sana bırakır.

**Göçmen — Ağabeyin Mektupları:** Saint Clement limanına ayak basarsın. İki yıl önce gelen ağabeyin **Anton**'un mektupları dört ay önce kesilmiştir; mektuplarında adı geçen pansiyoncu **Greta Halvorsen** seni iskelede karşılar. Bölümler: *Liman* (tanışma, selamlaşma, pansiyonda ilk gece), *İlk Yevmiye* (limanda yük taşıma), *Pazarlık* (Greta'nın şeftalilerini en iyi fiyata satma, yol için uyku tulumu), *Telgraf* (postanede memura sorma, geri dönen son mektup), *İlk At* (ahırdan at alma; paran yetmezse Greta tamamlar), *Posta Arabasıyla* (maden kasabasına posta arabası, tren ya da atla yolculuk), *Maden Kasabası* (madende çalışma, fener, terk edilmiş galeride Anton'un çetelesi), *Şirket Dükkânı* (şirket dükkânının sahibi **Ambrose Pike** ile yüzleşme, Greta'nın maymuncuğuyla Pike'ın evinde sahte borç defterini bulma, defteri şerife gösterme), *Hak Gaspçıları* (dürbünle kampı gözetleme, bağlı ağabeyini kurtarma), *Yeni Başlangıç* (eski galeriye kaçan Pike'ı yakalama, borç senetlerini alma, şerife teslim, şirket dükkânının tapusunu alma). Anton hikâyenin ikinci yol arkadaşıdır: senin ten, saç ve göz rengini taşır, konuşmalarda kendi adıyla konuşur. Sonunda dükkân senin işletmen olur, işletmecisi Anton'dur; Greta Saint Clement'taki pansiyonuna döner.

**Demiryolu İşçisi — Raylar ve Toz:** Fort Redstone dışındaki ray kampında ustabaşı **Walt Boone**'un ekibine katılırsın; işçilerin maaşı her ay biraz daha "kayboluyor". Bölümler: *Ray Kampı* (Boone'la kampa yürüme, **Ray Döşe** işi, kampta yemek), *Kazma ve Dinamit* (raya düşen kayaları kazmayla kırma, büyük kayayı dinamitle patlatma; dinamit biterse Boone bir tane daha verir), *Tren Bileti* (trenle maaş memuru **Cyrus Hale**'in kasabasına gidip mektubu verme), *Kereste* (kesim yerinden iki travers demetini omuzda ya da atla kampa taşıma), *Maaş Günü* (eksik maaş, bankaya yatırma ve faiz), *Kayıp Sandık* (soyulan maaş arabası, yaralı arabacıyı dinleme, saloonda söylenti), *Yük Arabası* (şirketin yük arabasıyla mağazadan erzak sandığı getirme), *Şirketin Adamı* (nal izlerini sürme, sığınağı dürbünle gözetleme), *Kanyon* (sığınağa baskın, siper ve odak, Hale'i yakalama, maaş sandığını alma), *Şerif Masası* (Hale'i teslim, Boone'la veda). Ray kampı haritada işaretlidir; çadırlar, ateş ve ekip (Mick, Sven, Tomas) oyuncu yakınken belirir. Sonunda yük arabası oyuncunun olur ve Boone kampta kalır; orada her zaman **Ray Döşe** işi vardır.

**Tuzakçı — Babamın Tuzakları:** Baban altı hafta önce kuzey ormanlarındaki tuzak hattına gitmiş ve dönmemiştir. Eski dostu, az konuşan yaşlı tuzakçı **Elias Crowe** seni Cedar Falls'ta bekler. Bölümler: *İz* (Elias'ın kampına yürüme, çömelerek geyik izlerini okuma; ayaktayken iz okunmaz), *Yay* (sürüye sessizce yaklaşma, geyiği **yayla** avlama; tüfekle vurulan sayılmaz, deri yüzme), *Post Ticareti* (postu Cedar Falls kasabına satma, babanın son izini tüccardan öğrenme), *Kış Geliyor* (terziden kürk manto alıp giyme, kuzeyin karlı ormanına sürme, kamp kurma ve ateşte et pişirme), *Kurt Sürüsü* (gece kampı saran üç kurdu püskürtme, sabaha kadar uyuma), *Gözetleme Tepesi* (tepeye çıkıp haritanın geniş bir kısmını açma, dürbünle ormanda parlayan mağarayı bulma), *Mağara* (fenerle Ayı İni'ne inme, babanın bıçağı ve notu), *Babanın Kulübesi* (kulübede üç ipucunu inceleme: günlük, kırık kapan, pençe izleri), *Boz Ayı* (iri pençe izlerini vadiye sürme, efsanevi boz ayı **Yaşlı Kral**'ı avlama, yaralı babayı bulma), *Eve Dönüş* (yarayı sarma, babayı omza alıp atın eyerine yükleme, Cedar Falls doktoruna yetiştirme). Elias'ın kampı haritada işaretlidir; babanın kulübesi mağaradaki nottan sonra haritaya düşer. Yaralı baba bağlanamaz, soyulamaz, vurulamaz; eyerdeyken kayıtta korunur. Sonunda baban Elias'ın kampında iyileşir, onunla sohbet edebilirsin.
- Bölüm geçişleri açılış sinematikleriyle aynı 3D çiziciyle oynar (yolculuk, akşam çakallar, verandada itiraf, kasaba sabahı, saloon gecesi, kamp ateşi, şafakta haydut kampı, gün batımında final). Sahneler başladığın yerin doğasına (ova, kıyı, çöl, kurak bozkır, orman) göre değişir; konuşmalar altyazıyla alttaki siyah şeritte akar, herhangi bir tuşla geçilir.
- Konuşmalar oyun içinde de sürer: söz bir kez, alttaki altyazıda tam olarak yazılır; konuşanın başının üstünde yalnızca üç noktalı bir "konuşuyor" işareti belirir (kasabalıların kendi aralarındaki kısa laflar baloncukta kalır). Sully yürür, ata biner, seni bekler, uzaktaysa görünmeden yerini alır.
- Sağ üstte bölüm adı ve hedef görünür; hedef dünyada altın elmasla, radarda ve haritada yıldızla işaretlenir, uzaksa rota çizilir. İpuçları doğru tuşları gösterir.
- Görevler serbest oyunu kilitlemez; Günlük → **Görevler** sekmesi ilerlemeyi gösterir, hikâye oradan bırakılabilir. Kayıtta kalınan adım saklanır; Jack'i canlı teslim etmek daha çok ödül getirir. Sonunda Sully'nin eski tüfeği, para, onur ve **Sully'nin Senedi** başarımı; Sully çiftliğinde kalır, uğrayıp sohbet edebilir ve çalışabilirsin.

**Kaldığın yerden devam:** Kayıt, çevredeki dünyanın anlık görüntüsünü de saklar. "Devam Et" dediğinde her şey kaldığın gibi gelir:
- kasaba sakinleri, kanun adamları, yolcular, haydutlar ve çiftçiler (durumları ve kasaba kayıtlarıyla, saloonda oturanlar sandalyelerinde),
- av ve çiftlik hayvanları, bağlı atlar, yoldaki ve park etmiş arabalar,
- yerdeki cesetler, postlar ve sandıklar, uçmuş şapkalar ve dinamit izleri.

Tezgâhtaki esnaf, piyanist, göçebeler, ödül hedefi, aile ve yol olayları kaydedilmez; bunları kendi sistemleri yeniden yerleştirir. Tarayıcı sekmesi kapanırken ya da arka plana geçerken (masaüstünde pencere kapanırken) oyun otomatik kaydedilir.

**Ayarlar:** Ses ayarları sürüklenebilir pirinç kaydırıcılardır (%5 adımlarla, ◀ ▶ ile de). Alt kısımda **Kaydet ve Kapat** ile **Sekmeyi Varsayılana Döndür** düğmeleri vardır. **Tam Ekran** tercihi kaydedilir. Tarayıcıda Esc, menüleri kapatır ama tam ekrandan çıkarmaz (Chromium'da tam ekrandan çıkmak için Esc basılı tutulur). Başka bir tarayıcı Esc ile tam ekrandan çıkarırsa oyun, ilk tıklama ya da tuşta tam ekrana geri döner. F11 de tercihi değiştirir.

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
- 1536×1536 karelik prosedürel dünya: karlı zirveler, çam ormanları, geniş ovalar, kızıl kanyonlar, çöl, bataklık ve okyanus kıyısı. (Bu sürümden önce başlanmış kayıtlar eski 1024×1024 dünyada, değişmeden devam eder.)
- 13 kasaba (Harlow, Saint Clement, Dust Creek, Silver Ridge, Cedar Falls, Cypress Bend, Fort Redstone, Coyote Springs, Carver Junction, Brine Cove, Longhorn, San Rafael, Millbrook); mağaza, saloon, şerif, doktor, silahçı, kasap, ahır, otel, banka, kilise, berber, terzi ve daha fazlası. Her kasabanın kendine özgü bir karakteri vardır: demiryolu kavşağı, balıkçı limanı, sığır kasabası, sınır kasabası, çiftçi köyü.
- **Saint Clement, en zengin şehir**: Diğer kasabalardan daha geniştir. Sokakları arnavut kaldırımı, kaldırımları ve meydanı taş döşelidir; ayak sesi taşta çıkar. Binalar tuğla ya da kesme taş cepheli, iki katlı, kornişli, beyaz çerçeveli pencereli ve düz çatılıdır; dükkânların önünde çizgili tenteler, kapının üstünde koyu levha tabelalar vardır. İki park bulunur: çitle çevrili çimen, taş yollar, çiçek tarhları, ağaçlar, banklar, fenerler; birinin ortasında çeşme (su içilir, matara doldurulur, bozuk para atıp dilek tutulur), ötekinde heykel. Sokak lambaları daha sıktır, meydanda heykel ve çiçek tarhı durur. Meydana yakın bir **pazar yeri** tenteli tezgâhlarda seçkin mallar satar: istiridye, olgun peynir, kremalı pasta, ithal kahve, şampanya, puro ve parfüm. Fiyatlar başka yerlerden %25 yüksektir, ama mallar daha güçlüdür (ithal kahve odağı çok doldurur, şampanya ve parfüm iyi hediyedir); pazar yiyecek ve otu da iyi fiyata alır. Bu düzen yeni dünyalarda kurulur; eski kayıtların dünyası olduğu gibi kalır.
- Yeni binalar (hepsi içine girilebilir, tezgâhında biri çalışır): fırın, demirci, eczane, çamaşırhane, kumarhane, bira imalathanesi, değirmen, ilçe binası, posta ve telgraf ofisi, toptancı ambarı ve cantina. İmalathanede ve değirmende gündelik iş bulunur; ilçe binasında tapu işleri görülür.
- **Satılık arsalar**: Kasabalarda çitle çevrili, tabelalı boş parseller vardır (haritada yakınlaşınca "$" ile görünür). Tabelada boyutu ve fiyatı yazar; ileride bu arsalara kendi işletmeni kurabileceksin.
- **İşletmeler**: Kasabalardaki dükkânların bir kısmı satılıktır (fırın, berber, çamaşırhane, kasap, terzi, değirmen, demirci, eczane, cantina, ahır, genel mağaza, saloon, otel, bira imalathanesi, kumarhane). Tezgâhta sahibine ya da ilçe binası/tapu dairesinde satın alırsın; eski sahibi işletmeci olarak kalır. Kasada durman gerekmez: işletmeci (dürüst, çalışkan ya da şüpheli) işi yürütür, gelir her gün kasada birikir, uğrayıp alırsın ya da %10 kesintiyle doğrudan bankaya aktarılmasını seçersin.
- **Mal taşıma**: Çoğu işletme mal tüketir (erzak, içki, un, arpa, yem, et, kumaş, demir, ilaç). Stok rakamla değil "dolu / azalıyor / boş" diye görünür; boşalınca işletme gelirinin yalnız %30'unu kazanır. Malı toptancı ambarından, limandan, değirmenden, imalathaneden, madenden ya da çiftlikten sandık sandık alırsın; omzunda 1, atında 2, ahırdan alınan **yük arabasında** 8 sandık taşınır. Kasap dükkânına avladığın hayvanın leşini de götürebilirsin. Değirmen ya da bira imalathanesi senin olursa ondan aldığın mal ucuzlar ve beslediği işletmelerin geliri %20 artar.
- **Arsaya inşaat**: Satın aldığın boş arsaya sığan herhangi bir işletmeyi 3 günde yaptırırsın; bina gerçekten kasabada yükselir, içine girilir, tezgâhında işletmecin durur.
- **Nakliyeciler**: Ahırdan ya da posta ofisinden en fazla 4 nakliyeci tutabilirsin (peşin $10 artı günlük maaş). Güvenilir olan fırtınada bile yola çıkar ve haydutlara direnir, hızlı olan daha sık sefer yapar ama mola verir, korkak olan ucuzdur ama haydut görünce yükü bırakıp kaçar. Nakliyeci stoğu azalan işletmeni seçer, malı en uygun toptancıdan ya da üreticiden alır (parası önce bankadan, sonra işletme kasalarından) ve götürür. Yakınındaysan arabası yolda gerçekten görünür; durumunu sorabilirsin. Kasaba dışında haydut baskınına uğrayabilir: haber gelir, yer haritada kırmızıyla işaretlenir. Yetişip haydutları dağıtırsan yük ve adamın kurtulur; yetişemezsen yük gidebilir, adamın bir gün yaralı yatar. Maaşı iki gün ödenmezse işi bırakır.
- Günlüğün **İşlerim** sekmesi bütün işletmelerini, stoklarını, kasalarını ve getirmen gereken malları gösterir. Haritada işletmelerin altın, arsalar "$" ile işaretlenir.
- **Posta arabası**: Ahırdan ya da posta ofisinden bilet alıp tren geçmeyen kasabalara da gidebilirsin. Gittiğin kasabalara ve yakındaki komşu kasabalara sefer vardır; trenden yavaş ve pahalıdır, bazen yolda tekerlek kırılır ve geç varırsın.
- Kasabalar ızgara değil: kavisli bir ana cadde, farklı açılarla ayrılan yan sokaklar, caddeden farklı uzaklıkta duran binalar, kapılardan caddeye uzanan patikalar, meydan, bahçeli evler ve sokak lambaları. Her dünyada farklı bir düzen çıkar.
- **Binaların içi var.** Kapıdan yürüyerek girersin; çatı ve cephe soluklaşır, içerisi görünür. Tezgahın arkasında çalışan, saloonda bar, piyano, kart ve yemek masaları, şerif ofisinde nezarethane, kilisede sıralar ve sunak, otelde yataklar ve küvet, bankada vezne ve kasa var. Hizmetler bu eşyaların başında alınır.
- **İç mekân kamerası**: Bir binaya girince kamera yumuşak bir geçişle binaya yaklaşır ve binayı ortalar; bina ekranın büyük kısmını kaplar ama tamamını değil (küçük evlerde daha çok, büyük saloonda daha az yakınlaşır). Çıkınca aynı yumuşaklıkla geri uzaklaşır.
- **His efektleri (juice)**, gerçekçiliği bozmadan:
  - *Çatışma:* öldürücü isabette çok kısa bir duraklama, silaha göre yönlü geri tepme ve kamera tepmesi, vuruş yönüne savrulup kan izi bırakarak kayan ceset, uçup yere düşen şapka, gecede ortamı bir anlığına aydınlatan NPC namlu ışığı, yavaşça yayılıp koyulaşan ve kuma çekilip solan kan gölü. Dinamit: şok dalgası, kalıcı yanık izi, dışa savrulan toprak parçaları, uzun süren toz bulutu ve dışa eğilen bitkiler.
  - *At ve hareket:* dörtnalda nal başına geride kalan toz, suda sıçrayan damlalar; dörtnala hızlanınca kamera hafifçe uzaklaşır; dörtnaldan sert durunca ya da bir yere çarpınca at şahlanır (kısa süre dinlemez, binici geriye yaslanır). Boşta duran oyuncu etrafa bakar ya da şapkasını düzeltir; at başını sallar, toynağıyla eşinir.
  - *Çevre:* kurak arazide öğleden sonra toz şeytanları, güneşin saatine göre dönüp uzayan gölgeler, yağmurdan sonra ıslak zemin ve gece lamba ışığını yansıtan su birikintileri, suda parıltılar ve sıçrayan balıklar, rüzgârla sürüklenen kamp ateşi közleri ve titreyen ateş ışığı, açık arazide süzülen şahin gölgesi, yaz gecelerinde ateş böcekleri. (Yuvarlanan diken çalıları zaten vardı.)
  - *Kasaba:* içinden geçilince sallanan saloon kapıları, rüzgârda dalgalanan bayraklar ve çamaşır ipleri, gece ilerledikçe tek tek sönen ev pencereleri (saloon, otel, şerif ve istasyon açık kalır), titreyen lambalar.
  - *Arayüz:* para sayacı yeni değere tıkırdayarak yuvarlanır (artışta yeşil, azalışta kırmızı parlar), poker masasında fişler oturandan pota ve pottan kazanana kayar, vurulunca ekran kenarında hasar yönü göstergesi, doldururken dönen tambur.
  - Ayarlar'da *Ekran Sarsıntısı* kapalıysa duraklama ve tepmeler de kapanır.
- Dükkanlar gece kapanır ve kapıları kilitlenir (kapı kırılabilir). İçerideyken kapanış saati gelirse kapıdan rahatça çıkabilirsin; kapı yalnızca dışarıdan girişe kapanır. Evler kilitlidir; kapıyı çalabilir ya da kırıp içeri girebilirsin (haneye tecavüz sayılır, evi aramak haftada bir şey kazandırır). Harabeler aranabilir, terk edilmiş maden galerilerine fenerle girilebilir, deniz fenerine tırmanınca kıyı haritası açılır. Her binanın kapı önü dünya üretilirken engellerden temizlenir. Atlar ve hayvanlar binalara giremez; binilen atın başı bile kapıdan içeri uzanmaz (gövdenin burnu ve sağrısı da denetlenir), bir at bir şekilde içeride kalırsa kapının önüne çıkarılır. Saloon akşamları kalabalıklaşır, piyanist çalar.
- **Kasaba hayatı**: Her kasabanın kalıcı sakinleri vardır (büyük kasabada 56, ortada 38, küçükte 22 kişi); adları, yüzleri, meslekleri, evleri ve iş yerleri dünya tohumundan hep aynı üretilir. Dükkân sahibi sabah evinden çıkıp dükkânına yürür ve tezgâhın arkasına geçer, kapanışta evine döner. Hamallar sandık taşır, lambacı sabah sokak süpürür ve akşam lambaları dolaşır, gazeteci çocuk manşet bağırır, ev hanımları dükkân dükkân alışveriş yapar, çocuklar sabah okula (kiliseye) gider ve öğleden sonra oynar, emekliler banklarda oturur, madenci ve oduncular gün boyu kasaba dışında çalışır, akşam saloona uğrar. Pazar sabahı kasaba kiliseye gider; yağmurda, fırtınada ve kum fırtınasında insanlar kapalı yerlere sığınır. Sakinler kasaba içinde yol bularak (A*) binaların etrafından dolaşır; binaya giren kişi görünmez olur ve programı değişince kapıdan çıkar. Oyuncudan uzaktakiler seyrek güncellenir, böylece kalabalık kasabalar akıcı kalır.
- **Hafıza ve sohbet**: Sakinler seni hatırlar. Selamlaştıkça ısınırlar; soyduğun, saldırdığın, tehdit ettiğin ya da gözü önünde suç işlediğin kişiler sana soğur. Seni seven dükkân sahibi %10'a kadar indirim yapar, nefret eden zam yapar; seni seven komşu bazen suçunu görmezden gelir, nefret eden seni görünce uzaklaşır. Sokakta karşılaşan sakinler havaya, mevsime ve senin ününe göre sohbet eder (konuşma baloncukları). Ölen bir sakinin yerine birkaç gün sonra kasabaya yeni biri gelir. Yaklaşınca adı ve mesleği görünür.
- **NPC aklı**:
  - *Yol bulma:* Sakinler, şerifler ve diğer NPC'ler kasabada A* rotasıyla binaların etrafından dolaşır. Rota gövde genişliği hesaba katılarak sadeleştirilir, köşeler kesilmez.
  - *Takılma:* Takılan NPC önce yeniden rota çizer, sonra en yakın boş yere çıkıp devam eder, olmazsa hedefini değiştirir. Duvara doğru yürüyüp kalma yok.
  - *Kalabalık:* Kalabalıkta birbirinden, oyuncudan, atlardan ve arabalardan kaçınırlar. Karşılaşınca sağdan geçerler, önleri kapalıysa kısa süre beklerler.
  - *Tepkiler:*
    - Dörtnala gelen atlıdan yana sıçrayıp söylenirler.
    - Silah doğrultulan sivil ellerini kaldırır.
    - Ceset gören durur, bakar, bağırır.
    - Yağmurda adımlarını sıklaştırırlar.
    - Yanlarından geçene başlarını çevirip bakarlar.
    - Üstlerine yürüyene çıkışırlar.
  - *Mizaç:* Her sakinin bir mizacı vardır (şakacı, huysuz, utangaç, dedikoducu, dindar, sakin). Adın yanında görünür; ne kadar konuşacağını ve takılacağını belirler.
- **Doğal yürüyüş**:
  - Herkes kendi hızında ve rota çizgisinin biraz yanından yürür; uzun düz yollar hafifçe kavislenir, köşeler kavisle dönülür.
  - Kalkışta hızlanıp varışta yavaşlarlar, yönleri hafifçe salınır, gezerken arada durup bakınırlar.
  - Yürüyüş stilleri: yaşlılar bastonla, çocuklar sekerek, gece saloondan çıkan serseri sendeleyerek ("Hık!") yürür; yağmurda şapkasını tutarak acele ederler.
- **Hareket çeşitliliği**:
  - Beklerken ya da otururken: sigara (önce kibritle yakar, ara ara ağzına götürür, dumanı üfler), mataradan içme, cep saatine bakma, kol kavuşturma, eller belde durma, kafa kaşıma, gerinme (sabahları), omuz silkme, işaret etme, ayakkabı bağlama, gazete okuma (bankta), sıcakta yelpazelenme, soğukta el ovuşturma.
  - Sohbette konuşan el kol oynatır, soru sorarken omuz silker, dinleyen bazen kollarını kavuşturur, sonunda biri güler.
  - Selamlaşırken el sallar ya da şapkasına dokunur.
  - Hangi hareketin seçileceği kişiye (sigara içen, içkici, yaşlı, çocuk), saate ve havaya göre değişir.
- **Selamlaşma**:
  - Sakin seni el sallayıp selamlar ve karşılık bekler. **Selamla** ile karşılık verirsen sevinir ve seni biraz daha sever.
  - Karşılık vermezsen mizacına göre bozulur: huysuz "Kaba herif!" der, dindar öğüt verir, utangaç sessizce üzülür, dedikoducu yanındakine dert yanar. Seni birkaç gün unutmaz ve laf atar.
  - Sakinler yolda karşılaşınca birbirini adıyla selamlar.
- **Araba sürücüleri**:
  - Dükkân önüne park eden yük arabasının sürücüsü iner, sandıkları tek tek dükkâna taşır, sonra atlarının yanında bekler: sigara yakar, gerinir, saatine bakar, atını okşar, yoldan geçenle sohbet eder.
  - Vakit gelince arabasına döner ve "Deh! Hadi kızlar!" diye yola çıkar.
  - Posta arabasından yolcular iner ve otele, saloona ya da istasyona yürür.
  - Sürücü dışarıdayken araba çalınırsa ya da sürücü öldürülürse tepki verir; araba sürücüsüz kalır.
  - Arabalar dükkânın önüne cepheye paralel park eder.
- **Sakinlerin sohbetleri**:
  - Sakinler kendi aralarında satır satır konuşur; yakındaysan baloncuklar görünür, üçüncü biri de katılabilir.
  - Konu saate (sabah kahvesi, akşam saloonu, gece), havaya, pazar vaazına, mesleğe (hamal, madenci, emekli, çocuklar) ve senin ününe göre seçilir.
  - Kasabada yakın zamanda olanlar da konuşulur: silah sesleri, sokaktaki ceset, dörtnala geçen atlı, soygun, şerife teslim edilen ceset, senin aldığın dükkân.
  - Sohbette kasabadan başka sakinlerin adları geçer.
- **Sataşma**:
  - Sakinler sana laf atar: kirliysen, sarhoşsan, yaralıysan, kesen doluysa, dörtnala geçiyorsan, maskeliysen, aranıyorsan, silah doğrultuyorsan, omzunda ceset varsa, gece sokaktaysan, yağmurda ıslanıyorsan, bugün onu üçüncü kez görüyorsan.
  - Seni seven dostça takılır. Çocuklar "Kovboy! Nişan göster!" der, emekliler öğüt verir.
  - Laf atıldıktan hemen sonra **Karşılık Ver** seçeneği çıkar. Şakadan anlayan güler ve seni biraz daha sever, huysuz bozulur.
- **Arabalar**:
  - Yük ve posta arabaları yolun sağından gider. Öndeki arabanın hızına uyar, karşıdan gelene sağa çekilerek yol verir, park etmiş arabayı sollar.
  - Yoldaki yayaya seslenir, yaya kenara çekilir.
  - Kasabada dükkân önlerindeki ayrı park yerlerine park ederler; iki araba asla üst üste binmez.
- **Yol trafiği**: Kasabalar arası yollarda yük arabaları ve posta arabaları gider. Kasabaya varan araba mağazanın ya da otelin önünde bir süre durur, sonra geri döner. Önüne çıkarsan durup bağırırlar. Sürücüyü vurabilir, kementle çekebilir ya da araba dururken zorla indirebilirsin; sürücüsüz arabayı at gibi sürer, yükünü ya da posta çantasını arayabilirsin (at hırsızlığı ve soygun sayılır). Araba bir tır dorsesi gibi hareket eder: önce atlar döner, gövde çeki okundan arkadan izler; ön tekerlekler dönüşe göre kırılır.
- **Göçebe kampları**: tüccar kervanları, sığırtmaçlar, altın arayıcıları, kürkçüler ve seyyar bir kumpanya kasabaların dışında kamp kurar. Takas yapabilir, ateş başında dinlenip hikâye dinleyebilirsin. Her kamp 5–10 yılda bir başka bir yere göç eder.
- Kasabaları bağlayan yollar, köprüler ve istasyonlar arasında gidip gelen **trenler** (bilet alıp seyahat edebilirsin).
- 25 keşfedilecek önemli yer: göktaşı krateri, bin yıllık sekoya, hayalet kasaba, terk edilmiş maden, sıcak kaynaklar, dinozor kemikleri, karaya oturmuş gemi, gözetleme tepeleri. Bunlara haydut kampları, çiftlikler ve satılık mülkler eklenir.
- Gezdikçe açılan harita, GPS rotası ve radar. Harita eski bir arazi haritası gibi çizilir: tepe gölgelendirmesi, eş yükselti çizgileri, kıyı boyunca taranmış su, orman ve kum dokusu, çift çizgili yollar, traversli demiryolu, kâğıt etiketli kasaba adları, pusula gülü ve mil ölçeği. Soldaki açıklamalarda bir türe tıklayınca (oyun kolunda yön tuşu ↑↓ ile gezip ✕) o türün bilinen en yakın yeri işaretlenir ve harita oraya kayar; aynı türü yeniden seçmek bir sonrakine geçer.
- **Genişletilmiş radar**: Kamp tuşuna (kolda D-pad ↓) kısa bas: radar birkaç saniyeliğine büyür ve çok daha geniş bir alanı kasaba adlarıyla gösterir; yanında konum, hava durumu, sıcaklık, onur ve bütün göstergelerin sayısal değerleri açılır. Tekrar basınca kapanır, basılı tutmak kamp kurar.
- Ağaçlar, kaktüsler ve direkler yalnızca gövdeleriyle çarpışır; bir engele çarpınca karakter, at ve NPC'ler durmak yerine etrafından akıcı biçimde kayarak devam eder.
- Gece-gündüz döngüsü, yağmur, fırtına, kar, kum fırtınası ve sis. Hava, sıcaklık ve ekranın renk tonu oyuncunun bastığı tek karoya değil, çevresindeki zeminlerin karışımına göre belirlenir: kasabadaki küçük bir kum ya da kar lekesinin üstüne basmak havayı değiştirmez, bölge sınırlarında yağmur kara ya da toza, sıcaklık da yavaş yavaş döner. Yerel hava değişince (fırtına başlayınca, bölge değiştirince) yağmur, kar, toz ve sis birkaç saniyede yumuşakça gelip gider; hissedilen sıcaklık da ani değil, giderek değişir.
- **Canlı görsel efektler**: Ortak bir rüzgâr yönü bulut gölgelerini, baca ve kamp ateşi dumanını, yağmuru, otları ve sazlıkları etkiler. Çalılar, otlar, çiçekler ve ekinler rüzgârda salınır, yanlarından geçince eğilir. Sonbaharda ağaçlardan yaprak düşer. Kasaba bacaları sabah ve akşam, soğukta ise gün boyu tüter. Kum, çöl, çamur ve karda ayak ve toynak izleri kalır; seyrek ve silik tutulur, yarım dakikada solar (kasaba sokaklarında iz kalmaz). Suda yürürken ve yağmurda su yüzeyinde halkalar oluşur, kıyıya ince dalgalar vurur. Soğukta oyuncunun, atların ve NPC'lerin nefesi buhar olur.
- **Silah efektleri**: Mermi değdiği yüzeye göre tepki verir: suda sıçrama ve halka, ahşapta kıymık, kayada kıvılcım, toprakta, kumda ya da karda o zeminin renginde toz. Iskalanan mermiler nişan noktasının biraz ötesinde yere saplanır; üstüne ateş edilirken etrafında toz kalktığını görürsün. Namlu dumanı havada asılı kalıp rüzgârla dağılır. Kollu tüfekler her atışta kovan fırlatır, tabanca ve av tüfeği dolumda boş kovanları döker.
- **Renk ve ekran efektleri**: Gün doğumu ve batımında altın saat, alacakaranlıkta mavi saat, çölde sıcak, yağmurda soğuk ve soluk, karda buz mavisi, bataklıkta yeşilimsi tonlar yumuşak geçişlerle uygulanır. Sağlık azaldıkça renkler çekilir ve kalp atışıyla ekran kenarı kızarır (kalp sesi duyulur). Sarhoşken görüntü çift görünür ve sallanır. Ayazda ekran kenarları buz tutar. Odak modu sepya tonuna, film grenine ve çiziklere bürünür.
- **Arayüz tasarımı**: Bütün pencereler ortak bir dil kullanır: dokulu koyu deri zemin, ince pirinç iç çerçeve ve köşe gönyeleri, başlık altında baklavalı süs çizgisi, altı pirinç çizgili sekmeler, solunda parlayan pirinç şerit ve arkasında solan kan kırmızısıyla odaklanan satırlar, daktilo tuşu gibi tuş simgeleri. Pencereler hafifçe büyüyerek açılır, arkadaki oyun kararır.
- **HUD**: Sol altta pirinç kadranlı radar: deri bandında derece çentikleri ve yön harfleri vardır; görev hedefi, harita işareti, ödül hedefi, atın ve yük araban radarın dışında kalınca bandın üstünde doğru yönde görünür. Radar gece mürekkep mavisine kararır, oyuncunun önünde bakış konisi vardır ve iki kat çözünürlükte çizilir. Sağlık, dayanıklılık ve odak madalyonları kadranın sağ üst yayında, atın madalyonları sol yayında durur; açlık, susuzluk, uyku ve temizlik sağ altta, durum rozetleri onların üstündedir; genişletilmiş radarda madalyonlar yayı izleyerek açılır. Sağ üstte paranın altında hava rozeti (güneş, ay, bulut, yağmur, kar ve hissedilen sıcaklık; üşürken mavi, sıcakta turuncu yanar), saat ve tarih; aranırken duvara çivilenmiş küçük bir afiş; görev izleyicide hedefe kalan mesafe (yarda ya da mil). Sağ altta silah kartı şarjördeki fişekleri dolu ve boş yuvalarla gösterir; etkileşim istemleri pirinç kenarlı şeritlerdir. Duyurular sıraya girer (ekranda en fazla iki, aynısı tekrarlanmaz), yardım kartının altındaki çizgi kalan süreyi gösterir, altyazının arkasında okunurluk için yumuşak bir bant vardır.
- **Harita ekranı**: Deri çerçeveli, köşeleri pirinç gönyeli bir masa haritası. Üstte kurdeleli kâğıt etikette imlecin altındaki yer, solda koyu rozetli açıklama kartı, sol altta konum kartı (yer, bölge, hava, saat, süren hedef ve uzaklığı), sağ altta pusula gülü ve mil ölçeği. Keşfedilmemiş yerler taranmış eski kâğıt gibi çizilir ve açılan bölgelerin kıyısına mürekkep gölgesi düşer; haritada iki milde bir ızgara, nabız gibi atan oyuncu ve görev işaretleri vardır.
- **Ana menü ve ekranlar**: Ana menü piksel gün batımının üstünde film greni, altın yaldızlı başlık, sırayla kayarak gelen menü ve odaktaki satırda pirinç baklava ile açılır; kayıt varsa sağda son hayatın kartı (ekran görüntüsü, isim, yaş, yer, oynama süresi) durur, altta sürüm yazar. Yükleme ekranında ilerleme bir ray gibi dolar ve üstünde dörtnala bir atlı ilerler, ipucu ayrı bir kutuda yazar. Duraklatma menüsü tam ekrandır: oyun arkada bulanıklaşıp sepyaya döner, solda simgeli menü, sağda karakterin kayıt defteri kartı (portre, onur ve hayat hedefi çubukları, konum, zaman, hava, para ve banka, at, oynama süresi, süren hedef ve uzaklığı). Ölünce oyun griye döner, "ÖLDÜN" yazısı mürekkep gibi belirir.
- Ayarlar > Görüntü > **Arayüz Boyutu**: %80 – %140. Sağlık halkaları ve radar (sol alt), para/saat/hedef (sağ üst), silah ve etkileşim (sağ alt), yardım ve bildirimler (sol üst), duyurular ve altyazı kendi köşelerine sabit kalarak büyür ya da küçülür. Büyük ekranlarda temel boyut zaten biraz büyüktür; kısa ekranlarda göstergeler birbirine binmesin diye ölçek sınırlanır. Haritadaki bina simgeleri de okunaklı olsun diye biraz büyütüldü.
- Dükkân, bina, banka, bilet ve inşaat pencerelerinde cüzdandaki para sağ üstte büyük yazılır; alışverişte para azalınca kırmızı, artınca yeşil parlar.
- Ayarlar > **Görüntü Tonu**: *Doğal* (varsayılan) ya da *Canlı*. Doğal tonda zemin renkleri gerçeğe yakındır (zeytin yeşili çimen, sıcak kum rengi çöl, gözü almayan kar), doygunluk ve kontrast hafifçe düşüktür, çöldeki turuncu tonlama yarıya iner; uzun oyunda gözü yormaz. Canlı, eski doygun ve parlak görünümdür.
- **Yumuşak hareket**: Hiçbir şey bir anda hızlanmaz ya da durmaz. Yaya kalkışta yumuşakça hızlanır, koşuya geçerken ağırlaşarak hızlanır, durunca kısa bir yavaşlamayla durur, yön değiştirirken gövdesi hafifçe süzülür. At S eğrisiyle hızlanır (ivme de yavaş yavaş açılır) ve yumuşakça yavaşlar. NPC'ler yürümeye sıfırdan başlar, atlılar daha ağır kalkar; hayvanlar gezinirken ağır ağır kalkıp durur, kaçarken birkaç sıçrayışta hızlanır.
- Ayarlar > **Görsel Efektler**: *Tam* ya da *Sade*. Sade modda bitki salınımı, bulut gölgeleri, yapraklar ve izler kapanır; renk ve durum efektleri kalır.
- **Mevsimler görünür**: kışın soğuk bölgeler, çatılar ve ağaçlar karla kaplanır, göller donar, yapraklı ağaçlar çıplak kalır; sonbaharda yapraklar sararır; yazın otlar kurur. Harita da mevsime göre değişir.

**Hayatta kalma ve hayat**
- Açlık, susuzluk, uyku, temizlik, vücut ısısı, hastalık, zehirlenme ve sarhoşluk.
- **Yaşlanma**: 18 yaşında başlarsın. 30'lardan sonra dayanıklılık, 50'lerden sonra sağlık azalır; saçın ağarır. Yaşlanma hızı seçilebilir.
- Otellerde, kendi evinde ya da kamp kurup uyuyabilirsin. Kamp kurmak için bir Uyku Tulumu (genel mağaza) gerekir; kasabadan uzakta kamp tuşunu basılı tut. Kamp ateşinde yemek pişirip tonik ve ok yapabilirsin. Ateşin ısısı mesafeyle azalır ve hissedilen sıcaklık yavaşça değişir: ateşe yaklaşınca birkaç saniyede ısınır, uzaklaşınca yavaş yavaş soğursun.
- **Kendi yapın**: Genel mağaza ya da toptancıdan **Arazi Kazıkları** alıp kasabalardan uzak, boş bir araziye çakarsın. Her yere kurulamaz: kasabalara, yollara, demiryoluna, suya ve bataklığa, kayalık ve kumlu zemine, önemli yerlere, göçebe kamplarına ve diğer yapılarına yakın yerler reddedilir; çok sık ağaçlık araziler de uygun değildir. Kazık çakınca arazinin sınırı yerde görünür.
  - Yalnızca konaklama yapıları vardır: **Baraka** ($30, 3 gün; yatak ve sandık), **Kütük Kulübe** ($80, 5 gün; ocak da var), **Çiftlik Evi** ($200, 8 gün; iki yatak ve küvet de var). İç düzen her yapı için üç tasarımdan rastgele biridir.
  - **Tapulu ya da kaçak**: Tapu dairesi ya da ilçe binasından Arazi Tapusu ($25) alırsan yapın yasaldır. Tapusuz (kaçak) da kurabilirsin; ama her gün ihbar edilme ihtimali vardır (kasabaya yakınsa daha yüksek). İhbar edilirse 3 gün içinde tapu dairesinde tapuya bağlamazsan (tapu + ceza) yapın mühürlenir: kapısı kilitlenir, yatağını ve sandığını kullanamazsın. Tapuya bağlayınca mühür kalkar.
  - İnşaat günler sürer, şantiye her gün kendiliğinden ilerler ve gözle görülür biçimde yükselir. Tabeladan şantiyede çalışırsan (günde en çok iki kez, ikişer saat) iş hızlanır.
  - Biten yapına **ahır** ($25; yemlikte atın doyar ve dinlenir), **kuyu** ($15) ve **bostan** ($10; mısır yetişir) eklenebilir. Bu ekler tek başına kurulamaz. Yapıların haritada işaretlidir ve kayıtla korunur.
- **İlaçlar**: Doktor ve eczanede, kısmen seyyar satıcı, kervan ve münzevide satılır. Etkileri süreli olanlar HUD'da simgeyle görünür ve kayıtla korunur.
  - **Kinin**: hastalığı iyileştirir ve bir gün boyunca hastalık kapmanı önler (kirli su, çiğ et).
  - **Laudanum**: 3 saat alınan hasarı %40 azaltır; başını döndürür ve uykunu getirir.
  - **Kas Merhemi**: 2 saat koşarken dayanıklılık çok daha yavaş tükenir, daha çabuk dolar.
  - **Koklatma Tuzu**: sarhoşluğu anında giderir, uykuyu açar.
  - **Sarsaparilla**: susuzluğu giderir, 3 saat sıcakta vücudu serin tutar.
- **Dürbün** (genel mağaza, silahçı, kervan): Eşya çarkından ya da çantadan kullanılır. Durup fareyle, yön tuşlarıyla ya da çubukla 420 piksele kadar uzağa bakarsın. Görüşteki hayvanların ve dikkat çeken insanların adları yazar (aranan hedefler ve haydutlar kırmızı). Uzakta gördüğün yerler haritada işaretlenir, baktığın yerin haritası açılır. Esc, sağ tık ya da hasar almak dürbünü indirir; at sırtında kullanılamaz.
- **Maymuncuk** (kaçakçı, seyyar satıcı): Kilitli evlerin ve gece kapalı dükkânların kapısında "Maymuncukla Aç" seçeneği çıkar. Gösterge yeşil bölgedeyken basarak pimleri yerine oturtursun (ev 3, dükkân 4, banka 5 pim). Kapıyı kırmanın aksine ses çıkarmaz; ıskalarsan kilit tıkırdar ve maymuncuk kırılabilir. Görülürsen yine suçtur.
- Madenlerde, kerestecide, limanda ve çiftliklerde çalışarak para kazanırsın. Mülk satın alabilir, bankaya para yatırabilirsin.
- Her kasabada tanışabileceğin biri yaşar. Onunla ilişki kurup evlenebilir, çocuk sahibi olabilirsin.

**Başlangıç**
- **Kanun Kaçağı** kasabada değil, çetenin kasaba dışındaki **Saklı Kamp**ında başlar (hikâye açık ya da kapalı): kamp ateşi yanar, haritada işaretlidir, kayıtla korunur; yer haydut kamplarından, kasabalardan ve sudan uzak seçilir. Başında 20$ ödül olduğu için kasabada kanun adamları yüzünü tanır; çantasında bir **Bandana** ve uyku tulumuyla başlar, kasabaya maskeyle girmesi ya da şerife teslim olup cezasını ödemesi gerekir.
- Karakter oluşturma ekranı dört bölümden oluşur ve adım adım ilerler: Kimlik, Görünüm, Kıyafet, Hikâye. Her bölümde kısa bir açıklama ve adım çubuğu vardır; ana düğme "İleri: …" diyerek sıradaki bölüme geçer, **Hayata Başla** yalnızca dört bölüm de görüldükten sonra çıkar (bakılmamış bölüm varsa düğme "Sırada: …" der ve oraya götürür). Görülen bölümlerin başlığında ✓ çıkar, görülmeyenlerin numarası yanıp söner. Esc bir önceki bölüme döner. Klavyeyle açılınca isim kutusu hazırdır: yaz, Enter ile bitir. Oyuncunun yazdığı isim cinsiyet değişince ya da Rastgele'ye basınca korunur (zar simgesi yeni isim verir); isimden < > & " işaretleri temizlenir. Ortada çerçeveli portre, sağda seçilen geçmişin kartı (başlangıç kasabası, para, at, yetenekler, eşyalar) görünür. Ekran çözünürlüğe göre ölçeklenir; 1080p ve üstünde yazılar ve portre büyür.
- **Portre**: sade vektör illüstrasyon (düz renkler, yumuşak gölgeler). Saç modelleri (kısa, uzun, toplu, kazınmış, dalgalı), burma bıyık, keçi sakalı, kirli ve gür sakal (dişli kenarlı), dört şapka türü, palto yakası, yelek, düğümlü bandana ya da ince kravat, kadınlarda yüksek yakalı bluz ve broş. Yaşlandıkça saç ağarır, yüzde çizgiler belirir.
- Yeni bir hayat, seçilen geçmişe özel bir **3D açılış sinematiğiyle** başlar; her açılış o geçmişin hikâyesinin ilk bölümüne bağlanır (üç çekim, yaklaşık 15 saniye, bir tuşla geçilir):
  - **Çiftçi Çocuğu — Kaybedilen Toprak:** gün doğumunda bankanın el koyduğu çiftlik; kapı direğinde zincir, kilit ve banka ilanı, kurumuş mısır tarlası, duran yel değirmeni. Aile arabası doğuya, güneşe doğru gider; oyuncu atına binip batıya, Harlow'a sürer.
  - **Kanun Kaçağı — Saklı Kamp:** kızıl kaya cebinde şafak; ateşin başında cezvesiyle Hollis, uyku tulumunda doğrulan oyuncu, bağlı atlar, uzakta gün doğumunun önünde Dust Creek.
  - **Göçmen — Saint Clement:** buharlı gemi limana yanaşır; güvertede elinde ağabeyinin mektubu, martılar, iskelede işçiler ve bekleyen Greta; oyuncu iskele tahtasından iner, tepede pansiyon ve kasaba.
  - **Demiryolu İşçisi — Ray Kampı:** ray başında iş treninin sabah düdüğü, uyanan ekip ve saatine bakan Boone; ardından yolcu treni Fort Redstone istasyonuna girer, oyuncu perona iner.
  - **Tuzakçı — Boş Kulübe:** karlı ormanda bacası sönük kütük kulübe, duvarda kapanlar, boş post gergisi, babanın karla kapanmış izi; oyuncu atla vadideki Cedar Falls'a iner.
  - Hikâye açıkken akıl hocası sahnede görünür ve açılış satırları oynar (altyazı ve seslendirme anahtarıyla); kapalıyken sahne satırsız oynar.
  - Çizici: iki kademeli **güneş gölgesi** (gölge haritası; yakın kademe özneyi izler, uzak kademe sahne başına bir kez çizilir), titreyen **ateş ve fener ışığı**, dalgalı ve gökyüzünü yansıtan **su**, gürültülü dağlar, ot öbekleri ve kayalar, ayrıntılı insan (yüz, eller, kemer, çizme) ve at (boyun, yele, iki parçalı bacak) modelleri, çekim geçişlerinde kararma, el kamerası sarsıntısı, akan bulutlar, güneş huzmesi, renk tonu, vinyet ve gren. Oyunun piksel görünümü (renk kademesi, dither) korunur; düşük grafik ayarında gölge haritası küçülür.

**Etkileşim ve eşyalar**
- İki sayfalı çark: **Silahlar** ve **Eşyalar** (yiyecek, içecek, ilaç, tütün, bitkiler, at eşyaları, kit, giysi). Aynı yuvadaki silah ya da eşyalar arasında geçilebilir; eşyalar çarktan doğrudan kullanılır.
- 90'dan fazla eşya: yiyecekler, ilaçlar, bitkiler, postlar, balıklar, değerli eşyalar, koleksiyonlar, aletler ve giysiler.
- Avcılık ve deri yüzme, bitki toplama, balık tutma (mini oyun), altın eleme, cevher kazma, hazine haritaları.
- Silahlar: bıçak, kement, iki tabanca, iki karabina, uzun tüfek, av tüfeği, yay ve dinamit. Bir de zamanı yavaşlatan **Odak** modu.
- **Kement ve bağlama**: Kementle yakaladığın kişiyi yaklaşıp etkileşim tuşunu basılı tutarak bağlarsın. Uzaklaşırsan (at sırtında da) onu peşinden sürüklersin; ateş tuşu ipi bırakır. Yumrukla yere serilen biri ölmez, bayılır. Ödül avının hedefi ağır yaralanınca çoğunlukla yere yığılır; o da bağlanabilir. Bağlı kişi bir süre sonra iplerinden kurtulur. Kement hayvanlarda da işe yarar: küçük ve orta boy hayvanlar bağlanıp omuza alınabilir ya da kesilebilir, yabani at kementteyken çok daha kolay evcilleşir, ayı gibi iri hayvanlar ipi hemen koparır. Atlı birini kementle ya da yanına gelip "Attan İndir" ile eyerden çekebilir, atını çalabilirsin.
- **Su**: Bağlı ya da baygın biri (ve bağlı hayvan) suda birkaç saniyede boğulur. Suda ölen ya da suya bırakılan ceset kan bırakmadan dibe batar, kanıt ortadan kalkar; yalnızca ödül hedefi batmaz, yüzer.
- **Taşıma**: Cesetleri, bağlı ya da baygın kişileri, leşleri ve büyük postları **omzuna alabilir** (leş ve cesette ikincil eylem: şarjör tuşu), atının yanındayken **eyere yükleyebilirsin**. Eyer 4 birim taşır (kişi ve iri leş 2, post ve küçük leş 1). Omuzda yükle koşamaz, silah kullanamazsın; yüklü at biraz yavaşlar. Yükler kayda geçer.
- **Postlar**: Geyik, kızıl geyik, antilop, bizon, ayı, puma, yaban domuzu ve timsah postları çantaya sığmaz; yüzdükten sonra omzunda ya da eyerde taşınır. Ayı, bizon ve timsah gibi iri hayvanların leşi taşınamaz, önce derisi yüzülür. Postları ve leşleri kasap, tuzakçı ya da genel mağazanın içinde sat; atın kapıdaysa eyerdekiler de satılır. Bütün leş, parça parça satmaktan biraz daha iyi fiyat getirir.
- NPC'lerle selamlaşma (günün saatine, havaya, role ve tanışıklığa göre değişen 100'ü aşkın replik), kışkırtma, soygun; yol olayları (yaralı yolcular, soygunlar, pusu, kırık arabalar, seyyar satıcılar); ödül ilanları.
- **Poker** (beş kart çekmeli): Saloon, kumarhane ve cantinadaki kart masasında üç rakiple oynanır. Herkes giriş parası koyar (5¢, 10¢ ya da 25¢), bir bahis turu, en fazla 3 kart değiştirme, ikinci bahis turu ve el gösterme. Sabit limitlidir (bahis ilk turda 2, ikinci turda 4 giriş parası; turda en fazla 3 bahis). Rakiplerin her birinin kendi oyun tarzı vardır (temkinli, gevşek, blöfçü); paraları günlüktür, masayı boşaltırsan ertesi gün yeni oyuncular gelir. Kumarbaz yeteneği rakiplerin yüzünü okumanı sağlar.
- Yirmi Bir (blackjack), bilek güreşi, hızlı çekiş düellosu, söylenti dinleme, gazete okuma, kamp ateşinde mızıka çalma.
- Atlar: satın alma, yabani at evcilleştirme, bağ seviyesi, ıslıkla çağırma. Ata ve arabaya binerken ve inerken kısa bir sıçrama animasyonu oynar. Atlı NPC'lerin (kanun adamları dahil) atları yan yan kaymaz: at hep burnunun yönüne gider, sınırlı hızla döner; binici çatışmada oyuncunun çevresinde geniş daireler çizerken silahını ayrıca çevirir.
- **Kolla nişan**: L2'ye basınca en uygun hedefe kilitlenir (basış anında görünmüyorsa kısa bir süre aramaya devam eder). Kilit hareketli hedefi birebir izler, atış tam hedefe gider ve hedefi takip etmek nişan oturmasını bozmaz. Sağ analogu hafifçe oynatmak kilidi bozmaz; savurmak yandaki hedefe geçirir, bilerek başka yöne itmek kısa bir süre sonra kilidi bırakır. Hedef ölürse ya da düşerse L2 basılıyken sıradaki düşmana geçer.

**Kanun ve onur**
- **Tanıklar**: Suçunu gören biri önce en yakın kanun adamına ya da şerif ofisine koşar. Ulaşamadan onu durdurursan (silah doğrultup tehdit ederek, rüşvet vererek ya da daha kötüsüyle) suç kayda geçmez. Kanun adamlarının gözü önünde işlenen suçlar ve dükkan/banka soygunları anında bildirilir.
- **Maske ve kılık**: Bandana ya da çuval maske takarak işlediğin suçlar sana değil, "maskeli bir yabancıya" yazılır. Kimse görmeden maskeni çıkarırsan izini kaybederler; biri görürse kimliğin açığa çıkar ve ödül senin adına geçer. Maskeyi takarken görülürsen de maske işe yaramaz. Kanun, suç anındaki şapkanı ve paltonu hatırlar: kıyafet değiştirirsen kasabalarda tanınman zorlaşır. Dükkanlar maskeli müşteriye hizmet etmez (kaçakçı hariç).
- Tavuk ya da inek öldürmek gibi küçük kabahatler kovalamaca başlatmaz, yalnızca para cezası yazılır.
- Soyulan bir dükkânın kasası boşalır ve ancak 3 gün sonra dolar; bankanın kasası 7 günde yenilenir. Dükkânlarda satılan eşyalar en ucuz alış fiyatının altında satılır, al-sat döngüsüyle para basılamaz. Bilek güreşi günde 3 kez oynanabilir.
- **Teslim olma ve tutuklanma**: Düşük aranma seviyesinde (1–2 yıldız) kanun adamları önce silah doğrultup yaklaşır ve teslim olmanı ister; ateş etmezler. Yanlarında etkileşim tuşunu basılı tutarak teslim olursun: ya ödülü ceza olarak ödersin ya da ödüle göre 1–7 gün hapis yatarsın. Ateş edersen, kanun adamına silah doğrultursan, kaçarsan ya da uyarılara rağmen teslim olmazsan ateş açarlar. Cinayet ve kanun adamına saldırı ise doğrudan çatışma başlatır. Dörtnala giderken bir kanun adamına ya da kasabalıya çarpmak ilk iki seferde yalnızca uyarıdır (kişi kenara itilir, hasar ve suç yok); üçüncü çarpma saldırı sayılır. İki dakika çarpmazsan sayaç sıfırlanır.
- Aranma seviyesi, arama alanı ve peşine düşen kanun adamları. Ödülünü şerif ofisinde ödeyebilirsin.
- **Ödül avı ve teslim**: İlan panosundan alınan hedef ölünce ödül kendiliğinden verilmez; kişiyi şerif ofisine getirmen gerekir. Canlı teslim tam ödülü, ceset yarısını getirir. Haydutları da teslim edebilirsin (canlı $5, ceset $2). Omzundakini ofisin içinde, eyerdekini ofis kapısında at sırtında ya da şerifin masasında teslim edersin.
- **Ödül avcıları**: Başında $20 ya da daha fazla ödül varken, kanun peşini bıraksa bile kasaba dışında zaman zaman 2–4 kişilik ödül avcısı grupları çıkar; ödül büyüdükçe daha sık ve daha kalabalık gelirler. Önce yaklaşıp seslenir ve bir süre beklerler: yanlarına gidip teslim olabilir (tutuklanma menüsü açılır) ya da ödülün yaklaşık %60'ını verip kurtulabilirsin (ödül başında kalır). Kaçarsan, onlara nişan alırsan ya da süre dolarsa ateş açarlar. Onları vurmak suç değildir. Grup, oyuncuya giden düz yolu açık bir noktadan çıkar; arada nehir ya da kaya kalıp takılmazlar.
- **Kanıt**: Öldürdüğün masum birinin cesedi kanıttır. Biri cesedi bulduğunda sen yakındaysan suç sana yazılır ve tanık şerife koşar; uzaktaysan iz kalmaz. Ceset ya da bağlı biriyle görülmek de suçtur. Cesedi ıssız bir yere taşıyabilir, suya atabilir ya da kürekle gömebilirsin. Bağlanan tanık haber veremez.
- Onur sistemi fiyatları ve insanların sana nasıl davrandığını etkiler.

**Ekonomi (1890 doları)**
- Fiyatlar 1890'ların batısına göre ayarlanmıştır: ekmek 5¢, kahve 10¢, bir kadeh viski 10¢, saloonda yemek 25¢, otel odası 50¢, tıraş 15¢, gazete 5¢; tabanca $14–17, Winchester $25; at $35–450; baraka $45, göl kıyısı kulübe $160, çiftlik $600, konak $1.800. Bir vardiya (madende, kereste fabrikasında, limanda, çiftlikte) günlük işçi ücreti kadar, $1–3 kazandırır. Oyunda bir gün bir yılın onda biri ile üçte biri arasında bir zamanı temsil ettiği için mülkler bir ömür içinde alınabilecek biçimde ölçeklenmiştir.
- Bir dolardan küçük tutarlar sent olarak gösterilir. Eski kayıtlar yüklenirken para, banka hesabı ve ödüller yeni ölçeğe çevrilir.

**Gelişim**
- 7 yetenek (nişancılık, avcılık, hayatta kalma, binicilik, ticaret, karizma, güç). Yaptıkça gelişirler.
- 40 başarım. Çoğu kalıcı bir **kazanım (perk)** verir: daha iyi post fiyatları, soğuğa dayanıklılık, daha yavaş tükenen odak gibi.

**Oyun modları**
- *Hikaye*: ölürsen doktor seni kurtarır; biraz para ve kalıcı sağlık kaybedersin.
- *Tek Hayat*: ölüm kalıcıdır, kayıt silinir.

**Kayıt yuvaları**: 3 yuva vardır; her yuva ayrı bir hayattır. Her yuvada bir otomatik, bir manuel kayıt tutulur. Otomatik kayıt her yeni günde, uyuyunca ve oyun sırasında 4 dakikada bir (aranmıyorsan) alınır; manuel kaydı duraklatma menüsünden, çantadan ya da evindeki yataktan alırsın. "Kayıt Yükle" ekranı her yuvanın küçük ekran görüntüsünü, karakterin adını, yaşını, geçmişini, zorluğunu, bulunduğu yeri, yılı, parasını ve oynama süresini gösterir; iki kayıttan istediğini yükleyebilir ya da yuvayı silebilirsin. "Devam Et" en yeni kaydı açar. Yeni hayat başlarken yuva seçilir; dolu bir yuva seçilirse onay istenir. *Tek Hayat* zorluğunda yalnız otomatik kayıt tutulur ve ölünce o yuva silinir. Eski tek kayıt ilk açılışta 1. yuvaya taşınır. Kayıtlar tarayıcıda `localStorage`'a, masaüstü sürümünde kayıt klasörüne yazılır.

## Hata ayıklama modu

Oyun içindeyken **Ctrl + Alt + C** sağda sürüklenebilir bir hata ayıklama paneli açar (tekrar basınca kapanır). Panel 4 haneli bir şifre ister; şifre oturum başına bir kez sorulur, klavyeyle ya da ekrandaki tuş takımıyla girilir. Üç hatalı denemeden sonra 30 saniye beklemek gerekir. Şifre kaynak kodda düz yazılmaz, yalnızca özeti tutulur. Üstte FPS, kare, güncelleme ve çizim süreleri ile son 180 karenin grafiği görünür. Sekmeler:

- **Genel**: konum (piksel, karo, chunk, zemin, yükselti, bölge, bina), saat, tarih, hava, sıcaklık, varlık sayıları, parçacıklar, chunk önbelleği, aranma, tanıklar, onur, dünya tohumu, bellek; kaydet/yükle.
- **Oyuncu**: ölümsüzlük, sınırsız mermi, sınırsız dayanıklılık ve odak, duvarlardan geçme, kanunun görmemesi, hareket hızı çarpanı; can ve ihtiyaçları doldurma, para, onur, bütün silahlar, yetenekler, istenen eşyayı verme, at ve aranma işlemleri.
- **Dünya**: saat kaydırıcısı, saat/gün/mevsim atlama, oyun hızı (×0,25–×8), saati dondurma, hava seçimi, haritayı açma, bütün yerleri keşfetme, kasabalara/yerlere/hedefe ışınlanma, Alt + tık ile ışınlanma.
- **Oluştur**: kasabalı, gezgin, haydut, kanun adamı (atlı ya da yaya), her tür hayvan, yük ve posta arabası, sahipsiz at; düşmanları öldürme, ceset ve hayvan temizleme.
- **Katmanlar**: çarpışma çemberleri, engel karoları, chunk ve karo ızgarası, NPC etiketleri (durum, plan, can), sakinlerin A* rotaları, araba rotaları, kanun arama alanı ve tanık hedefleri, nişan konisi ve etkileşim hedefi, arayüzü gizleme. Katmanlar ekranın tam çözünürlüğünde çizilir.
- **Kasaba**: seçilen kasabanın sakinleri; meslek, plan, nerede oldukları ve oyuncu hakkındaki fikirleri. Satıra tıklayınca o kişiye ışınlanırsın.
- **Günlük**: yakalanan hatalar, uyarılar ve oyun bildirimleri; süzme, temizleme, kopyalama.

Bilgi ve katman araçları kaydı etkilemez. Hile sayılan bir şey kullanılırsa kayıt işaretlenir ve o kayıtta başarımlar kapanır.

## Ses

Ses motoru (`js/audio.js`) WebAudio üzerinde bir miks masası gibi çalışır:

- **Kanallar:** efekt, ortam, müzik, arayüz ve konuşma ayrı kanallardan geçer. Hepsi bir yapıştırıcı kompresörden ve sonda bir limiterden çıkar, böylece çatışmada ses patlamaz.
- **Konumlu ses:** silah, adım, toynak, hayvan ve patlama sesleri kaynağın yerinden duyulur. Uzaklaştıkça kısılır ve tizleri kaybolur, sağ ve sol kulağa dağılır. Başka bir binanın içindeki ses duvar arkasından boğuk gelir.
- **Mekâna göre yankı:** açık arazi, kasaba sokağı, kanyon, orman, oda, salon (saloon, otel, banka) ve mağara için ayrı yankılar vardır. Yer değişince yankı yumuşakça geçer. İçerideyken dışarının ortam sesi boğuklaşır.
- **Zemin:** adım ve toynak sesi, basılan zemine göre seçilir: toprak, çimen, kum, taş, tahta (bina içi de), çamur, kar ve su. Yakındaki NPC'lerin, atların ve arabaların adımları da duyulur.
- **Çeşitlilik:** bir sesin birden çok dosyası varsa aynı dosya art arda çalmaz; perde ve ses düzeyi hafifçe değişir. Aynı anda çalan aynı sesin bir sınırı vardır.
- **Kısma (ducking):** yakın bir silah sesi ya da patlama, ortamı ve müziği bir an kısar. Konuşma sırasında ortam ve müzik alçalır.

**Ses dosyaları** `audio/sfx/` klasörüne tek tek eklenir. Hangi adın hangi olayda çaldığı `audio/sfx/LISTE.md` içindedir (örneğin `gun_pistol`, `step_wood`, `horse_neigh`, `amb_rain`). Dosyayı bu adla koy, sonra listeyi yenile:

```
node tools/sfx-manifest.js   # audio/sfx/manifest.json ve LISTE.md
```

- Uzantı: ogg, mp3, wav, m4a, flac ya da webm.
- Bir sesin birden çok çeşidi için `_01`, `_02` … ekle (`gun_pistol_01.ogg`, `gun_pistol_02.ogg`). Oyun her seferinde başka birini seçer.
- Dosyası olmayan ses, oyunun kodla ürettiği eski sesle çalar. Zemin adımlarında o zeminin dosyası yoksa `step_dirt` / `hoof_dirt` çalar.
- Ses düzeyi, perde oynaması, yankı payı, duyulma mesafesi ve eşzamanlı sınır `tools/sfx-manifest.js` içindeki listededir.
- Döngülerin (`amb_…`) başı ve sonu kesintisiz birleşmelidir.

**Seslendirme (ileride):** hikâye diyalogları seslendirmeye hazırdır. Her replik, o dildeki metninin özetinden (FNV-1a) türeyen bir anahtarla bulunur:

```
node tools/vo-script.js     # audio/vo/script_tr.csv ve script_en.csv: anahtar, konuşan, metin
```

Kayıtlar `audio/vo/<dil>/<anahtar>.ogg` (ya da `.mp3`) olarak konur ve araç yeniden çalıştırılır, `audio/vo/manifest.json` güncellenir. Kaydı olan replik konuşma kanalından çalar, altyazı kayıt süresince ekranda kalır, ortam ve müzik kısılır. Kaydı olmayan replik eskisi gibi sessiz altyazıyla geçer. Metin değişirse anahtar da değişir; senaryoyu yeniden almak eski kayıtların hangilerinin geçersiz kaldığını gösterir.

## Testler

Oyunun ana sistemleri gerçek tarayıcıda uçtan uca sınanır (Playwright, başsız Chromium):

```
npm install                      # ilk seferde: Playwright
npx playwright install chromium  # ilk seferde: tarayıcı
npm test                         # bütün testler (~3 dk)
npm test -- carry law            # adında "carry" ya da "law" geçen test dosyaları
npm test -- --jobs 1 --headed    # tek tek, tarayıcı görünür
npm test -- --list               # test dosyalarını listele
```

Test çalıştırıcı (`tests/run.js`) oyunu bağımlılıksız küçük bir sunucudan açar, her dosyayı temiz bir tarayıcı bağlamında (boş kayıt, Türkçe) çalıştırır ve her adımı doğrular; sayfada yakalanmamış bir JavaScript hatası olursa dosya başarısız sayılır. Başarısız adımların ekran görüntüleri `tests/output/` altına yazılır.

| Dosya | Kapsam |
|---|---|
| `camera` | iç mekân yakınlaşması: yumuşak geçiş, binayı ortalama, doluluk oranı, yakınken fareyle nişan, çıkınca uzaklaşma |
| `juice` | his efektleri: isabet duraklaması, savrulma ve uçan şapka, dinamit izi ve şok dalgası, dörtnala uzaklaşma, şahlanma, boşta animasyon, sönen pencereler, para sayacı |
| `npclife` | NPC aklı: duvara takılmadan ve aynı çizgiden olmadan doğal yürüme, arabaların çakışmaması, ayrı park yerleri, sürücünün inip sandık taşıması ve geri dönmesi, satır satır sohbet, sataşma ve karşılık verme, selam ve selamı almama tepkisi, boşta hareket çeşitliliği, silaha el kaldırma, atlıdan kaçma |
| `boot` | ana menü, karakter ekranı, 13 kasabalık dünya, yeni binaların iç mekânları, yürüme, duraklatma, harita |
| `saves` | kayıt yuvaları, otomatik/manuel kayıt, Tek Hayat, eski kayıt taşıma, eski 1024 dünya, 1890 fiyat dönüşümü |
| `i18n` | çeviri anahtarları (tools/i18n-check.js), oyun içinde dil değiştirme |
| `hud` | arayüz boyutu ayarının köşe gruplarını ölçeklemesi ve kaydedilmesi, binilen atın kapıdan içeri uzanamaması, içeride kalan atın dışarı çıkarılması, dükkânda sağ üstteki cüzdan, harita açıklamasından en yakın yeri işaretleme |
| `ui` | arayüz yenilemesi: HUD gösterge kümesinde çakışma olmaması, genişletilmiş HUD, hava rozeti, mermi pipleri, duyuru kuyruğu, yardım süresi, mesafe biçimi, tam ekran duraklatma ve kayıt defteri, harita konum kartı ve sis katmanı, yükleme atlısı, ölüm ekranı, ana menü son hayat kartı |
| `settings` | ayarlar ekranı, ses kaydırıcısına tıklama ve sürükleme, Kaydet ve Kapat düğmesi, tam ekran tercihinin saklanması, klavye tuş atama, takas, iptal, kalıcılık |
| `resume` | kaldığı yerden devam: NPC, hayvan, ceset, post, sandık ve arabaların konumu ve durumu, sakinlerin kasaba kaydına bağlanması, kopya doğmaması, sekme kapanırken kayıt |
| `story` | Sully'nin Senedi: açılış (Harlow'da toprağını kaybetmiş genç, Sully'den iş isteme; gazete ilanı yok), on bölüm baştan sona (selamlaşma, alışveriş, matara, ata binme, çakallar, av, deri, satış, çalışma, şerif, saloon, kamp, uyku, dürbün, kement, teslim, final), kayıt/yükleme, günlük sekmesi, bırakma; gece yarısından sonra saat atlatma, konuşma sürerken yapılan eylemin sayılması, tapuyu almadan teslimde kilitlenmeme, aynı kişiyi iki kez selamlamanın sayılmaması, Sully'nin vurulamaması |
| `guide` | yeni hayatta hoş geldin rehberinin kendiliğinden açılması, sayfalar, ikinci hayatta yine açılması, "gösterme" işaretinin kalıcılığı, Duraklat menüsünden yeniden açma |
| `carry` | kement, bağlama, omuzda/eyerde taşıma, şerife teslim, ödül hedefi, leş ve post, kanıt, suya atma |
| `law` | tanıklar, tehdit, rüşvet, maske, dükkân reddi, teslim olma, ceza, hapis, dörtnala kanun adamına ve sivile çarpmada iki uyarı |
| `economy` | para biçimi, fiyatlar, soygun tekrarları, al-sat açığı, günlük sınırlar |
| `city` | zengin şehir: arnavut kaldırımı ve taş kaldırım, iki park (çeşme, çit, çiçek), pazar yeri ve %25 pahalı seçkin mallar, modern binalar, çeşmeden su, eski dünya sürümünün değişmemesi ve kayıtta korunması |
| `business` | işletme satın alma, yük arabası, toptan mal, teslimat, gelir, arsaya inşaat, kayıt |
| `haulers` | nakliyeci, sefer, yoldaki araba, baskın, maaş, kayıt |
| `homestead` | yer uygunluğu (kasaba, su, yol), kazık ve plan menüsü, tapu alma, tapulu inşaat, şantiyede çalışma, aşamalar, iç eşyalar, ekler ve yemlik, kaçak yapı ihbarı/mühür/tapuya bağlama, iç tasarımlar, kayıt |
| `items` | yeni ilaçların etkileri, kas merhemiyle koşu, süreli etkilerin kaydı, maymuncuk (ev, dükkân, kırılma), dürbün (görüş, etiket, yer işaretleme, indirme) |
| `poker` | el değerlendirme, masadaki yerler, klavye ve fareyle bir el, çekilme, masadan kalkma, günlük rakipler, kayıt, yüz okuma |
| `hunters` | ödül avcısı grubu: çıkma koşulları, yaklaşma, parayla kurtulma, teslim olma, çatışma |
| `world` | kasaba sakinleri, ölüm ve yerine gelen, at arabası, hayvan kementleme, boğulma, göçebeler, mevsimler, küçük zemin lekesinin havayı değiştirmemesi, bölge sınırında ve zamanla yumuşak hava ve sıcaklık geçişi |
| `controls` | oyun kolu ile menü, yürüme, nişan ve ateş, silah çarkı, binme animasyonu, genişletilmiş radar |
| `audio` | ses listesi aracı (çeşit, uzantı, bilinmeyen ad), dosya yokken eski seslere dönüş, dosyaların yüklenmesi ve döngüler, konumlu ses (menzil, yön, duvar arkası), mekâna göre yankı ve zemin, silah sesinde kısma, art arda aynı kaydın çalmaması ve eşzamanlı sınır, oyun içi olayların örnekli sesi, seslendirme anahtarı |
| `story_outlaw` | Kanun Kaçağı hikâyesi baştan sona: saklı kamp ve çete, on bölüm, kayıt/yükleme, posta arabası soygunu, ödül avcıları, Hollis'i kurtarma, iki son (Vance'i teslim et / kendin teslim ol) |
| `story_rail` | Demiryolu hikâyesi baştan sona: Fort Redstone ve ray kampı, on bölüm, kayıt/yükleme, ray döşeme, kazma ve dinamit, tren, travers taşıma, banka, tanık ve söylenti, yük arabasıyla erzak, nal izleri, sığınak baskını, Hale'i teslim |
| `story_trapper` | Tuzakçı hikâyesi baştan sona: Cedar Falls ve Elias'ın kampı, on bölüm, çömelerek iz okuma, yalnızca yayla av, post satışı, kürk manto ve kamp, gece kurt sürüsü, gözetleme tepesi ve dürbün, fenerle mağara, kulübede ipuçları, Yaşlı Kral, yaralı babayı sarma, eyere yükleme (kayıt/yükleme), doktora teslim |
| `story_immigrant` | Göçmen hikâyesi baştan sona: Saint Clement'ta Greta, on bölüm, kayıt/yükleme, liman işi, satış, at alma, posta arabasıyla maden kasabası, galeri, maymuncukla borç defteri, Anton'u kurtarma, Pike'ı teslim, dükkânın tapusu |
| `backgrounds` | beş geçmişin genel kontrolü: her geçmiş kendi hikâyesine ve başarımına bağlı, günlük metinleri iki dilde tam; hikâyesiz başlangıç her geçmişte kendi kasabasında (Kanun Kaçağı saklı kampta) açılır ve hikâye kişisi çıkmaz; hikâye kimliği olmayan eski kayıt Sully'yle sürer |
| `opening` | açılış sinematikleri: beş sahne üç anda çizilir (boş değil, gölge açık, GL hatası yok), hikâye satırları altyazıda, son çekimde yer adı ve alt başlık; hikâye kapalıyken satırsız; İngilizce başlık; yeni oyunda Çiftçi açılışı babanın sözüyle oynar, geçilince Sully'nin hikâyesi başlar |
| `outlaw` | Kanun Kaçağı'nın saklı kampta başlaması (kasaba dışı, ateş, harita işareti, bandana, tulum, at), kampta tanınmama, bandanayla kasabada tanınmama, kayıt/yüklemede kampın korunması |
| `create` | karakter ekranında adım adım bölümler, isim yazıp Enter'la oyunun başlamaması, yazılan ismin korunması, bakılmamış bölüme yönlendirme, Esc ile geri, seçimlerin oyuna geçmesi |
| `debug` | hata ayıklama paneli şifresi ve kilidi |
| `stress` | 45 sn rastgele tuş ve fare girdisi |

Yeni bir test için `tests/e2e/` altına `ad.test.js` ekle: `module.exports = { name, async run(t) { const p = await t.newGame(); await t.step('…', async () => { t.ok(…); }); } }`. Sayfa içinde `TH` yardımcıları (boş yer bulma, ışınlanma, binaya girme, menü öğesine tıklama) hazır gelir.

## Teknik

- Saf HTML, CSS ve JavaScript. Hiçbir kütüphane yok; bütün grafikler kodla üretiliyor.
- Arayüzdeki bütün ikonlar (eşyalar, silahlar, radar ve harita işaretleri, PS tuşları) koddan üretilen SVG'lerdir.
- Dünya, 512 piksellik parçalar (chunk) halinde önceden çizilip önbelleğe alınır. Yeni parçalar kare başına küçük bir zaman bütçesiyle arka planda hazırlanır, bu yüzden hareket ederken takılma olmaz.
- Oyun düşük çözünürlüklü bir tuvale çizilip piksel ölçeklemeyle büyütülür. Bu hem piksel sanat görünümü verir hem de akıcı FPS sağlar.
- Efektler ve ortam sesleri WebAudio ile prosedürel olarak üretilir; `audio/sfx/` klasörüne dosyası konan ses o dosyayla çalar (bkz. Ses). Ana tema ve saloon piyanosu `audio/` klasöründeki sıkıştırılmış mp3 dosyalarından akışla çalınır (belleğe tamamen açılmaz). Ana tema menüde ve keşif sırasında aralıklarla, Karplus-Strong gitarıyla çalan prosedürel müzikle dönüşümlü çalar.
- Saloon piyanosu üç parça arasından rastgele seçilir. İçeride tam sesle duyulur; dışarıda kapıya yaklaştıkça yavaşça yükselir, duvar arkasından boğuk gelir. Piyano duyulurken ana tema kısılır.

```
index.html
css/style.css
js/util.js      yardımcılar, RNG, gürültü
js/quests.js    hikâyeli başlangıç: Sully'nin Senedi (görev motoru, bölümler, Sully ve Jack, izleyici, işaretler)
js/storycine.js hikâye sinematikleri (bölüm geçişlerinin 3D sahneleri)
js/worldsave.js dünyanın anlık görüntüsü: çevredeki NPC, hayvan, at, araba, ceset ve yerdeki eşyaların kaydı ve geri kurulması
js/platform.js  platform katmanı: kayıt, Steam başarımları, rich presence, tam ekran, çıkış
fonts/          yerel fontlar ve lisansları
desktop/        Electron + Steam masaüstü paketi
js/i18n.js      çok dil desteği: Tr(), dil seçimi, tablo ve HTML çevirisi
lang/en.js      İngilizce sözlük
tools/i18n-check.js  eksik/fazla çeviri denetleyicisi (node)
js/icons.js     SVG ikon seti (eşya, silah, glif, PS tuşları)
js/data.js      eşyalar, silahlar, hayvanlar, kasabalar, başarımlar
js/input.js     klavye, fare ve oyun kolu (PlayStation, Xbox, Steam Deck simgeleri)
js/audio.js     ses motoru: kanallar, konumlu ses, yankı, zemin, kısma, örnek bankası, seslendirme; müzik ve mp3 akışı
audio/          ana tema ve saloon piyanosu (mp3)
audio/sfx/      efekt ve ortam ses dosyaları, manifest ve ses listesi (LISTE.md)
audio/vo/       seslendirme senaryosu (CSV), kayıtlar ve manifest
tools/sfx-manifest.js  ses listesi ve manifest aracı (node)
tools/vo-script.js   seslendirme senaryosu ve manifest aracı (node)
js/world.js     dünya üretimi, chunk render, harita
js/sprites.js   karakter, hayvan, at, bina ve nesne çizimleri
js/entities.js  oyuncu, at, hayvan, NPC, tren, parçacıklar
js/systems.js   zaman, hava, hayatta kalma, kanun, doğma, etkileşim
js/carry.js     taşıma, kement, ödül teslimi, kanıt
js/debug.js     hata ayıklama paneli (Ctrl+Alt+C)
js/townlife.js  kasaba sakinleri, günlük program, A* yol bulma, hafıza, sohbet baloncukları, yol trafiği
js/npcmind.js   NPC aklı: gövde genişliğiyle yol bulma, takılma kurtarma, kalabalıkta kaçınma, algı ve tepkiler, sohbetler, sataşma
js/npcacts.js   NPC eylemleri: boşta hareketler ve jestler, yürüyüş stilleri, selamlaşma ve tepkisi, araba sürücüsü ve yolcu işleri
js/business.js  işletmeler: satın alma, işletmeci, stok ve kasa, toptan mal sandıkları, yük arabası, arsaya inşaat
js/haulers.js   nakliyeciler: işe alma, rota ve sefer, yolda görünen araba, haydut baskını ve kurtarma
js/homestead.js  kendi yapın: arazi seçimi, tapulu/kaçak inşaat, aşamalar, iç tasarımlar, ahır/kuyu/bostan
js/binoculars.js dürbün: uzağa bakma, etiketler, uzaktaki yerleri haritada işaretleme
js/poker.js     poker: el değerlendirme, rakip yapay zekâsı, sabit limitli bahis, masa arayüzü
js/hunters.js   ödül avcıları: kasaba dışında çıkan grup, bekleyiş, teslim olma, parayla kurtulma, çatışma
tests/run.js    test çalıştırıcı (npm test); tests/lib.js yardımcılar; tests/e2e/*.test.js testler
js/ui.js        HUD, radar, harita, menüler, mini oyunlar
js/cinema.js    sinematik çizici (kütüphanesiz WebGL: gölge haritası, nokta ışık, su, son işlem)
js/opencine.js  beş geçmişin açılış sinematikleri
js/fx.js        görsel efektler: rüzgâr, bulut gölgesi, duman, iz, isabet, salınım, su, renk derecelendirme
js/juice.js     his efektleri: isabet duraklaması, tepme, savrulma, şapka, dinamit izi, toz şeytanı, birikinti, balık, şahin, ateş böceği, saloon kapıları, bayrak ve çamaşır, sönen pencereler
js/game.js      oyun döngüsü, kamera, render, ışık, kayıt
js/main.js      başlatıcı
```
