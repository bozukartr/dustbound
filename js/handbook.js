'use strict';
/* ==========================================================
   FRONTIER'S END — Rehber el kitabı (Günlük → Rehber)
   Oyunun ince işleyişini konu konu anlatır. Sayılar oyunun
   kurallarıyla aynıdır; ilaç ve Odak listeleri eşya verisinden
   okunur. Bir mekanikle ilk kez karşılaşınca ilgili konu "yeni"
   diye işaretlenir (G.guideFlag), Rehber açılınca okunmuş sayılır.
   ========================================================== */
const Handbook = {
  /* ipucu anahtarı → el kitabı konusu (G.hintOnce ilk kez gösterince konuyu işaretler) */
  HINT_TOPIC: { hunger: 'needs', thirst: 'needs', sleep: 'needs', water: 'needs', cold: 'temp', hot: 'temp', poison: 'poison', sick: 'poison',
    deadeye: 'deadeye', ride: 'horse', rideKb: 'horse', law: 'law', witness: 'law', hunters: 'law', masked: 'law', surrender: 'law', office: 'law', death: 'death', aging: 'aging', hotel: 'needs', mansion: 'estate', club: 'estate', coach: 'estate' },

  unread() { const H = G.hints || {}; return this.topics().some(T => H['new:' + T.id]); },

  topics() {
    const g = k => Input.glyph(k), mi = px => fmtDist(px);
    const hour = Math.round(60 / MIN_PER_SEC), dayMin = Math.round(24 * 60 / MIN_PER_SEC / 60);
    const skill = G.skill ? G.skill('survival') : 0;
    const dec = v => { const s = String(Math.round(v * 10) / 10); return I18N.lang === 'tr' ? s.replace('.', ',') : s; };   // 2,6 / 2.6
    const coldT = dec(3 - (G.hasPerk('cold') ? 6 : 0) - skill * 0.4), hotT = dec(33 + (G.hasPerk('desert') ? 6 : 0) + skill * 0.4);
    const li = a => `<ul>${a.filter(Boolean).map(x => `<li>${x}</li>`).join('')}</ul>`;
    const rawN = Object.values(ITEMS).filter(it => it.raw).map(it => Math.round(it.raw * 100));
    const meds = Object.values(ITEMS).filter(it => it.c === 'med' && it.e).sort((a, b) => a.p - b.p);
    const focus = Object.values(ITEMS).filter(it => it.e && it.e.deadeye > 0).sort((a, b) => b.e.deadeye - a.e.deadeye);
    return [
      { id: 'time', ic: 'hourglass', t: Tr('Zaman'), b: () => li([
        Tr`Oyunda bir saat gerçekte yaklaşık <b>${hour} saniye</b>, bir gün yaklaşık <b>${dayMin} dakika</b> sürer.`,
        Tr`Bu hayatta bir yıl <b>${G.dpy} oyun günü</b> sürer (yaşlanma hızı yeni hayatta seçilir).`,
        Tr('Uyurken zaman hızla akar; açlık ve susuzluk uyurken yarı hızla azalır, uyku dolar.'),
      ]) },
      { id: 'health', ic: 'heart', t: Tr('Sağlık ve İyileşme'), b: () => li([
        Tr('Canın kendiliğinden dolar: açlık ve susuzluk 20\'nin, uyku 10\'un üstündeyken, hasta değilken, donmuyor ve sıcak çarpmıyorken.'),
        Tr('Hızı oyun saatinde <b>7 can</b>; açlık ve susuzluk 60\'ın üstündeyse <b>13</b>, uyurken 8 fazlası.'),
        Tr('Canın %20\'nin altına inince yürüyüşün %15 yavaşlar.'),
        Tr`Doktor <b>${fmtMoney(SVC.heal * (G.hasPerk('saint') ? 0.5 : 1))}</b> karşılığında canını, hastalığını ve zehrini tamamen iyileştirir (30 oyun dakikası).`,
        Tr('Her ölüm kalıcı bir iz bırakır: en yüksek can 3 azalır (en çok 30).'),
      ]) },
      { id: 'needs', ic: 'meat', t: Tr('Açlık, Susuzluk ve Uyku'), b: () => li([
        Tr('Oyun saatinde açlık <b>2,8</b>, susuzluk <b>4</b>, uyku <b>3,4</b> azalır. Koşarken açlık ve susuzluk 1,5 kat hızlı azalır; sıcakta susuzluk 2,5 kata kadar hızlanır; çok sarhoşken uyku 1,5 kat hızlı azalır.'),
        Tr('Hayatta Kalma yeteneğinin her seviyesi açlık ve susuzluğu %4 yavaşlatır.'),
        Tr('Sıfıra inerlerse can gider: açlıkta saatte <b>6</b>, susuzlukta <b>10</b>, uykusuzlukta <b>3</b>.'),
        Tr('Uyku 20\'nin altındayken koşu dayanıklılığı 1,5 kat hızlı tükenir; 15\'in altında dayanıklılık yavaş dolar; 10\'un altında en yüksek dayanıklılık %40 düşer.'),
        Tr`Matara 5 yudum alır, her yudum susuzluğu 32 doldurur (${g('quick')} ile hızlıca iç). Kuyu, çeşme ve nehir başında dolar.`,
        Tr('Nehir ya da gölden içmek susuzluğu 40 doldurur ama %6 (bataklıkta %20) hastalık riski taşır; kuyu ve çeşme temizdir.'),
        Tr`Otelde oda resepsiyondan kiralanır (<b>${fmtMoney(SVC.room)}</b>, bir gün geçerli; otel senin işletmense ücretsiz). Odan üst kattadır: merdivenden çık, odandaki yatakta uyu. Öbür odalar kilitlidir.`,
      ]) },
      { id: 'temp', ic: 'snow', t: Tr('Sıcak ve Soğuk'), b: () => li([
        Tr('Sağ üstteki rozet <b>hissedilen sıcaklıktır</b>: bölge, mevsim, gece (çölde daha çok soğur), yağmur ve kar, giydiğin palto ve ateşe yakınlık belirler. Bina içinde 21 °C\'ye yaklaşır.'),
        Tr('Sıcak yemek ve içecek bir süre +8 °C ısıtır; sarsaparilla sıcakta −7 °C serinletir; geniş kenarlı şapka sıcakta −2 °C; yağmurluk olmadan yağmur −3 °C.'),
        Tr('Hissedilen sıcaklık yavaş değişir: ateşe yaklaşınca ya da uzaklaşınca yaklaşık 20 oyun dakikasında oturur.'),
        Tr`Senin için şu an: <b>${coldT} °C</b> altında üşürsün, <b>${hotT} °C</b> üstünde sıcak çarpar. Hayatta Kalma yeteneğinin her seviyesi eşikleri 0,4 °C genişletir.`,
        Tr('Donarken saatte 14 cana kadar gider, dayanıklılık yarı hızla dolar; eşiğin 4 °C altından sonra can kendiliğinden dolmaz.'),
        Tr('Sıcak çarpması eşiğin 6 °C üstünden sonra can götürür (saatte en çok 10) ve can kendiliğinden dolmaz.'),
      ]) },
      { id: 'poison', ic: 'skull', t: Tr('Zehir ve Hastalık'), b: () => li([
        Tr('Yılan sokması seni <b>90 saniye</b> zehirler: saniyede 1,6 can (toplam ~144). Tedavi etmezsen tam canla bile ölebilirsin.'),
        Tr`<b>Panzehir</b> ve <b>Yılan Yağı</b> zehri anında söker, doktor da tedavi eder. ${g('quick')} zehirliyken önce panzehiri kullanır.`,
        Tr('Laudanum 3 saat boyunca aldığın her hasarı (zehir dahil) %40 azaltır. At sırtındayken yılan seni zehirleyemez.'),
        Tr`Hastalık kaynakları: çiğ et ve balık (%${Math.min(...rawN)}-${Math.max(...rawN)} ihtimal), nehir ve göl suyu, 62 yaşından sonra her doğum gününde artan bir ihtimal.`,
        Tr('Hastalık birkaç oyun saati sürer (kirli su 6, çiğ et 8, yaşlılık 30 saat); bu sürede saatte 2,5 can gider ve can kendiliğinden dolmaz.'),
        Tr('Kinin hastalığı iyileştirir ve bir gün yeni hastalığa karşı korur; Bitki Toniği ve Yılan Yağı da iyileştirir.'),
        Tr('Zehirliyken ya da can götüren başka bir durumdayken sağ üstte çıkan kart, ne kadar süreceğini, bu gidişle ölüme kalan süreyi ve ne yapman gerektiğini gösterir.'),
      ]) },
      { id: 'meds', ic: 'cross', t: Tr('İlaçlar'), b: () => `<p>${Tr('Doktor ve eczanede, bir kısmı seyyar satıcı, kervan ve münzevide satılır. Süreli etkiler HUD\'da simgeyle görünür.')}</p>
        <table class="hb-tab">${meds.map(it => `<tr><td>${Icons.item(it.id, 'ic inl')} ${it.n}</td><td>${fmtMoney(it.p)}</td><td>${UI.itemEffects(it).join(', ')}</td></tr>`).join('')}</table>` },
      { id: 'deadeye', ic: 'deadeye', t: Tr('Odak'), b: () => li([
        Tr`Silahla nişan alırken ${g('deadeye')} ile açılır; Odak çubuğu 12'nin üstünde olmalı. Zaman %35 hızına yavaşlar.`,
        Tr('Açıkken saniyede 18 tükenir; biterse ya da nişanı bırakırsan kapanır. Kapalıyken saniyede 0,6 + (çekirdek ÷ 60) dolar.'),
        Tr('Çubuğun içindeki çekirdek oyun saatinde 1,2 azalır; aşağıdakiler çubuğu doldurur, çekirdeğe yarısı kadar eklenir:'),
        focus.map(it => `${Icons.item(it.id, 'ic inl')} ${it.n} +${it.e.deadeye}`).join(' · '),
      ]) },
      { id: 'horse', ic: 'horse', t: Tr('At'), b: () => li([
        Tr('Bağ seviyeleri: 1 (başlangıç), 2 (50 puan), 3 (150), 4 (300).'),
        Tr('Bağ kazanma: kendi atınla her mil yaklaşık 1 puan, okşamak 3, fırçalamak (At Fırçası) 5, saman vermek 6.'),
        Tr('Bağı 2\'nin altındaki at, üstünde değilken yakında silah patlarsa %30 ihtimalle kaçar.'),
        Tr('Saman +40 can ve tam dayanıklılık, At Toniği tam dayanıklılık ve +15 can verir; At Diriltici yere yığılan atını %50 canla kaldırır.'),
        Tr('Atının canı biterse yere yığılır; üstündeysen düşer ve 12 can kaybedersin.'),
        Tr`Islıkla (${g('whistle')}) çağırırsın; at çok uzaktaysa yakınına gelir. Islık 3 saniyede bir çalınır.`,
        Tr`Klavyede at ve araba dizginle sürülür: ${g('moveUp')} ileri (gaz), ${g('moveLeft')} ${g('moveRight')} sola ve sağa döner (dururken yerinde, dörtnalda daha geniş), ${g('moveDown')} frendir; durunca basılı tutarsan geri gidersin. Kolda sol analog atı gösterdiği yöne çevirir.`,
      ]) },
      { id: 'law', ic: 'star', t: Tr('Kanun ve Ödül Avcıları'), b: () => li([
        Tr`Suçunu gören tanık, ${mi(800)} içindeki en yakın kanun adamına ya da şerif ofisine koşar. Ulaşırsa ya da süre dolarsa (kanun yakınsa 40, değilse 70 saniye) aranmaya başlarsın.`,
        Tr`Tanığa silah doğrultup ${g('interact')} ile tehdit edebilir ya da rüşvet verebilirsin; tanık kalmazsa suç kayda geçmez. Maskeliyken işlediğin suç maskeli bir yabancıya yazılır.`,
        Tr('Radardaki kırmızı alan seni en son gördükleri yerin çevresidir ve her yıldızda büyür. Alanın dışına çıkıp 12 saniye görünmezsen aranman biter; başındaki ödül kalır.'),
        Tr('Ödülünü şerif ofisinde ödeyebilir ya da kanun adamına teslim olabilirsin (para cezası ya da birkaç gün hapis).'),
        Tr`Aranırken şerif ofisine girersen kanun ${TRUCE_SEC} saniye ateş etmez: kanun adamının yanında ya da şerifin masasında teslim olup cezanı ödeyebilir ya da hapis yatabilirsin. Ofisten çıkınca süre durur; ateş eder, silah doğrultur ya da suç işlersen ateşkes bozulur.`,
        Tr`Başındaki ödül ${fmtMoney(HUNTER_MIN)} ve üstündeyse birkaç saat sonra kasaba dışında ödül avcıları peşine düşebilir; ödül arttıkça daha sık ve daha kalabalık gelirler (2-4 kişi). Parayla anlaşabilir (ödülün %60'ı), teslim olabilir ya da çatışabilirsin; onları öldürmek suç değildir.`,
      ]) },
      { id: 'death', ic: 'grave', t: Tr('Ölüm ve Doktor'), b: () => li([
        Tr('Ölünce bir doktor seni kurtarır: cebindeki paranın dörtte biri gider (bankadaki para güvende), kalıcı iz kalır (en yüksek can −3), aranıyorsan aranman biter ama ödül kalır.'),
        Tr('18 saat sonra %60 canla uyanırsın; açlık ve susuzluk en az 50, uyku en az 60 olur; zehir ve hastalık geçer.'),
        Tr('Ölüm ekranı ölüm sebebini, seni öldüreni, son iki dakikada aldığın hasarı ve bir öğüt gösterir.'),
        Tr('<b>Tek Hayat</b> zorluğunda ölüm kalıcıdır: kayıt silinir.'),
      ]) },
      { id: 'money', ic: 'coin', t: Tr('Para Kazanma ve Banka'), b: () => `<p>${Tr`Avlan ve postları kasapta sat. Bitki topla. Madende, kerestecide, limanda ya da çiftliklerde <b>çalış</b>. Nehirde altın ele. Ödül ilanlarını takip et. Ya da… kanunun yanlış tarafında yaşa.`}</p>` + li([
        Tr('Bankadaki para ölünce kaybolmaz ve her doğum gününde %2 faiz kazanır. Mülklerin günlük geliri bankaya yatar.'),
      ]) },
      { id: 'biz', ic: 'store', t: Tr('İşletmeler'), b: () => `<p>${Tr`Dükkân sahiplerinin bir kısmı dükkânını satar: tezgâhta ya da ilçe binasında satın al. İşletmeci işi yürütür, gelir kasada birikir. Çoğu işletme mal tüketir: toptancıdan, değirmenden ya da imalathaneden sandık alıp omzunda, atınla ya da ahırdan alacağın yük arabasıyla getir; ya da ahırdan bir nakliyeci tut, bu işi o yapsın. Boş arsalara yeni işletme kurabilirsin. Günlüğün İşlerim sekmesi hepsini gösterir.`}</p>` },
      { id: 'estate', ic: 'house', t: Tr('Malikane, Kulüp ve Özel Fayton'), b: () => li([
        Tr`Saint Clement Malikanesi ${fmtMoney(MANSION_PRICE)}: kapısından ya da tapu dairesinden satın alınır, ev gibi kullanılır (yatakta uyku ve kayıt, sandık, ocak, küvet).`,
        Tr`Hizmetçiler üst kattaki çalışma masasından tutulur; günlük ücret aşçı ${fmtMoney(SERVANTS.cook.wage)}, seyis ${fmtMoney(SERVANTS.groom.wage)}, uşak ${fmtMoney(SERVANTS.butler.wage)}. Ücretler önce bankadan ödenir; iki gün ücretini alamayan işi bırakır.`,
        Tr('Aşçı sabah 5 ile 11 arası günde bir kahvaltı hazırlar. Seyis bahçe kapısına getirdiğin atı tımarlar, besler ve dinlendirir. Uşak post, değerli eşya ve koleksiyonu sandığa kaldırır, faytonu kapıya getirtir.'),
        Tr`Kulüp üyeliği ${fmtMoney(CLUB_FEE)}; aranırken, maskeliyken ya da kirliyken içeri alınmazsın. Üst katta poker girişi ${fmtMoney(CLUB_ANTES[0] / 100)}-${fmtMoney(CLUB_ANTES[CLUB_ANTES.length - 1] / 100)}, bilardo bahsi ${fmtMoney(BILLIARD_BETS[0])}-${fmtMoney(BILLIARD_BETS[BILLIARD_BETS.length - 1])} (kazanan iki katını alır).`,
        Tr`Özel fayton ahırdan ${fmtMoney(CARRIAGE_PRICE)}, arabacının günlüğü ${fmtMoney(CARRIAGE_WAGE)}. Bin ve gideceğin yeri seç: yolu izle ya da ${g('confirm')} tuşunu basılı tutarak atla (zaman yine geçer). ${g('interact')} ile inersin. Biri saldırırsa ya da kanun görünürse arabacı durur.`,
      ]) },
      { id: 'aging', ic: 'hourglass', t: Tr('Yaşlanma'), b: () => li([
        Tr('Hayata 18 yaşında başlarsın; yaş sınırı yoktur, oyun ancak ölünce biter. Hedefin itibar sahibi ve zengin biri olmak.'),
        Tr('32 yaşından sonra en yüksek dayanıklılık her yıl %1,1 azalır (en çok %50); 50\'den sonra en yüksek can her yıl %1,2 azalır (en çok %35).'),
        Tr('42\'den sonra saçın ağarır, 60\'tan sonra yürüyüşün yılda %1,2 yavaşlar (en çok %25), 62\'den sonra her doğum gününde hastalanma ihtimali artar.'),
      ]) },
      { id: 'ach', ic: 'trophy', t: Tr('Başarımlar'), b: () => `<p>${Tr`Başarımlar sana kalıcı kazanımlar (perk) sağlar. Günlüğün Başarımlar sekmesine bak.`}</p>` },
      { id: 'controls', ic: 'pad', t: Tr('Kontroller'), b: () => UI.controlsTable() },
    ];
  },

  /* Rehber sekmesi: başta içindekiler (yeni konular işaretli), sonra konular. Açılınca "yeni"ler okunmuş sayılır. */
  html() {
    const H = G.hints || (G.hints = {}), T = this.topics(), isNew = t => !!H['new:' + t.id];
    const toc = T.map(t => `<a class="hb-toc-i${isNew(t) ? ' new' : ''}" data-hb="${t.id}">${Icons.glyph(t.ic, '#c9a45c')}${t.t}${isNew(t) ? `<em>${Tr('YENİ')}</em>` : ''}</a>`).join('');
    const body = T.map(t => `<section class="hb-sec" id="hb-${t.id}"><h3>${Icons.glyph(t.ic, '#c9a45c')}${t.t}${isNew(t) ? `<em class="hb-new">${Tr('YENİ')}</em>` : ''}</h3>${t.b()}</section>`).join('');
    for (const t of T) delete H['new:' + t.id];
    return `<div class="guide"><p><button class="st-btn" onclick="UI.openWelcome()">${Icons.glyph('book', 'currentColor')} ${Tr`Hoş Geldin Rehberini Aç`}</button></p>
      <div class="hb-toc">${toc}</div>${body}</div>`;
  },
  /* içindekilerden konuya kaydır */
  bind(el) {
    $$('[data-hb]', el).forEach(a => (a.onclick = () => { const s = $('#hb-' + a.dataset.hb, el), sc = s && s.closest('.scroll'); if (s && sc) sc.scrollTop = s.offsetTop - sc.offsetTop - 6; }));
  },
};
