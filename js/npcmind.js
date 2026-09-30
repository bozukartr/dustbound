'use strict';
/* ==========================================================
   FRONTIER'S END — NPC aklı (G nesnesine eklenir)
   Gezinme:  kasabada A* rotası (gövde genişliğiyle sadeleştirilmiş),
             takılınca yeniden rota, en yakın boş yere çıkıp devam,
             yine olmazsa hedefi bırakma; yürürken kalabalıkta
             birbirinden, oyuncudan, atlardan ve arabalardan kaçınma,
             karşılaşınca sağdan geçme, önü kapalıysa sırada bekleme.
   Algı:     dörtnala gelen atlıdan kaçıp söylenme, silah doğrultana
             ellerini kaldırma, ceset başında toplanma, yağmurda
             acele etme, yanından geçene dönüp bakma.
   Sohbet:   sakinler kendi aralarında birkaç satırlık sohbetler eder
             (yakındaysan baloncuklar görünür); konu mesleğe, saate,
             havaya ve kasabada olup bitenlere göre seçilir.
   Sataşma:  sakinler oyuncuya takılır: kir, sarhoşluk, yara, para,
             at, maske, ün, saat... Kısa süre içinde karşılık
             verilebilir; şakadan anlayan güler, huysuzu bozulur.
   ========================================================== */

/* ---------------- sakinlerin mizacı ---------------- */
const MOODS = {
  jolly:  { n: 'Şakacı', tease: 0.8, chat: 1.2, laugh: 0.8 },
  grumpy: { n: 'Huysuz', tease: 0.55, chat: 0.7, laugh: 0.15 },
  shy:    { n: 'Utangaç', tease: 0.1, chat: 0.6, laugh: 0.5 },
  gossip: { n: 'Dedikoducu', tease: 0.5, chat: 1.6, laugh: 0.5 },
  pious:  { n: 'Dindar', tease: 0.25, chat: 0.9, laugh: 0.35 },
  plain:  { n: 'Sakin', tease: 0.35, chat: 1, laugh: 0.45 },
};

/* ---------------- sakinlerin kendi aralarındaki sohbetleri ----------------
   Her sohbet sırayla konuşulan satırlardır (A, B, A, B...). {ad}: oyuncunun adı,
   {x}: kasabadan bir sakinin adı, {k}: kasabanın adı. */
const TALKS = {
  any: [
    ['Bu sabah horoz bile geç kalktı.', 'Horoz değil o, ihtiyar {x}\'in eşeği.', 'Hangisi olursa, ikisi de benden çok çalışıyor.'],
    ['Kahve on sente çıkmış, duydun mu?', 'Duydum. Tüccar bizi soyuyor.', 'Yakında suyu da parayla satarlar.', 'Kuyu bizim, bırak satsınlar!'],
    ['Gece çakallar yine uludu.', 'Tavukları içeri aldım ama biri eksik.', 'Çakal mı, {x} mi, belli değil.'],
    ['{x} yine borç istedi benden.', 'Verdin mi?', 'Verdim. Geri gelmeyecek, biliyorum.', 'İyi kalpli olmak pahalı iş.'],
    ['Posta arabası yine gecikti.', 'Yolda haydut var diyorlar.', 'Ya da sürücü yine saloonda uyuyakaldı.'],
    ['Madende yeni damar bulmuşlar.', 'Bize bir faydası dokunur mu?', 'Fiyatlar artar, o kadar.'],
    ['Karım yine turta yaptı.', 'Elmalı mı?', 'Tuzlu. Şekeri bitmiş, tuzla idare etmiş.', 'Allah sabır versin.'],
    ['Şu {k} büyüyor, fark ettin mi?', 'Yeni yüzler geliyor her hafta.', 'Eskiden herkesi tanırdım. Şimdi selam vermeye korkuyorum.'],
    ['Berber dün kulağımı az kalsın kesiyordu.', 'Ona güvenme, gözü görmüyor.', 'Şimdi mi söylüyorsun?'],
    ['Dün gece bir yıldız kaydı.', 'Dilek tuttun mu?', 'Yağmur diledim.', 'Keşke biraz da para dileseydin.'],
    ['Tren düdüğünü duyunca hâlâ irkiliyorum.', 'Ben de. İnsan alışmıyor.', 'Çocuklar bayılıyor ama.'],
  ],
  morning: [
    ['Günaydın! Erkencisin.', 'Uyku tutmadı. Sen?', 'Karım horluyor, ben de kaçtım.'],
    ['Kahve içtin mi?', 'Daha değil. Konuşmaya da hazır değilim.', 'Anlaşıldı, sonra görüşürüz.'],
  ],
  evening: [
    ['İş bitti, saloona mı?', 'Bir tek atarız, eve erken dönerim.', 'Hep böyle dersin.', 'Bu sefer ciddiyim!'],
    ['Güneş batarken buralar ne güzel oluyor.', 'Toz bile altın gibi parlıyor.', 'Şair olmuşsun maşallah.'],
  ],
  night: [
    ['Bu saatte sokakta ne işin var?', 'Senin ne işin var?', 'Uykum kaçtı.', 'Benimki de. Hadi evlerimize.'],
  ],
  rain: [
    ['Bu yağmur hiç durmayacak.', 'Tarlalara iyi gelir.', 'Benim çatıma iyi gelmiyor ama.'],
    ['Sırılsıklam oldum!', 'Saloonda bir viski ısıtır.', 'Sen her şeye viski dersin.'],
  ],
  hot: [
    ['Kavruluyoruz!', 'Kuyu da azaldı bu sıcakta.', 'Gölgede yumurta pişer.', 'Yumurta nerede ki pişsin?'],
  ],
  cold: [
    ['Ayaz kemiklerime işliyor.', 'Odun stoğunu doldur, kış uzun.', 'Doldurdum ama yarısını komşu aldı.'],
  ],
  sunday: [
    ['Pederin vaazı bugün uzun sürdü.', 'Ben ikinci yarısında uyudum.', 'Horlaman duyuldu, haberin olsun.'],
  ],
  // meslek çiftleri ya da tek meslek
  laborer: [
    ['Bu sandıklar kurşun gibi.', 'İçinde ne var ki?', 'Sorma. Ben sadece taşırım.', 'Sırtın da sorar ama.'],
    ['Patron yine maaşı geciktirdi.', 'Söylesene bir şey.', 'Söyledim, sandık sayısını artırdı.'],
  ],
  elder: [
    ['Benim gençliğimde bu sokakta tek bir çadır vardı.', 'Biliyorum, yüz kere anlattın.', 'Yüz birinci kez anlatırım o zaman!'],
    ['Dizlerim yağmuru bir gün önceden bilir.', 'Bugün ne diyor?', 'Bugün sadece ağrıyor.'],
  ],
  kid: [
    ['Ebe sensin!', 'Değilim, dokunmadın!', 'Dokundum!', 'Annemin yanında söyle bakalım!'],
    ['Büyüyünce şerif olacağım.', 'Ben de haydut olacağım, beni yakalarsın.', 'Olmaz, sen benim yardımcım olacaksın.'],
    ['Şu yabancının atını gördün mü?', 'Gördüm! Benim de öyle bir atım olacak.', 'Önce eşekten başla.'],
  ],
  miner: [
    ['Galeride su bastı yine.', 'Kürekle mi boşalttınız?', 'Şapkayla. Şapkamı da kaybettim.'],
  ],
  drifter: [
    ['Bir kadeh ısmarlar mısın?', 'Paran yok mu?', 'Param olsa sana sorar mıydım?'],
  ],
  // oyuncu hakkında (kasabadaki ününe göre)
  good: [
    ['{ad} denen yabancıyı gördün mü?', 'Gördüm. Geçen gün yaşlı bir kadına yardım etmiş.', 'Böylesi az kaldı buralarda.'],
    ['{ad} kasabaya uğur getirdi.', 'Keşke hep burada kalsa.', 'Kalırsa bir kızımı veririm.', 'Hangisini? Hepsi evli!'],
  ],
  bad: [
    ['Şu gelen... {ad} değil mi?', 'Göz göze gelme, yürü git.', 'Şerife haber versek mi?', 'Şerif de ondan korkuyor.'],
    ['{ad} yine kasabada.', 'Kilitleri kontrol ettin mi?', 'İki kere.'],
  ],
  // kasabada olup bitenler (G.townNews)
  gunfire: [
    ['Silah seslerini duydun mu?', 'Duymaz mıyım, masanın altına girdim.', 'Ben de. Kedi de benimle geldi.'],
    ['Az önceki patırtı neydi öyle?', 'Biri birini vurmuş galiba.', 'Bu kasaba eskiden sakindi.'],
  ],
  death: [
    ['Sokakta ölü biri var, gördün mü?', 'Bakamadım bile. Zavallı.', 'Kimse de kaldırmıyor.'],
    ['{x} diyorlar, vurulmuş.', 'Hayır, yanlış duymuşsun... değil mi?', 'Keşke yanlış duysaydım.'],
  ],
  gallop: [
    ['Az kalsın biri beni atla ezecekti!', 'Kim?', 'Bilmem, tozdan göremedim.'],
  ],
  robbery: [
    ['{x}\'in dükkânını soymuşlar!', 'Bu kasabaya ne oldu böyle?', 'Kapıyı iki kere kilitleyeceğim artık.'],
  ],
  bounty: [
    ['Şerife ceset getirmişler, gördün mü?', 'Ödül avcısı mı?', 'Öyle diyorlar. Bu işler bana göre değil.'],
  ],
  rich: [
    ['{ad} yeni bir dükkân almış diyorlar.', 'Parası nereden?', 'Sorma. Ben sormadım, sen de sorma.'],
  ],
};

/* ---------------- oyuncuya sataşmalar ---------------- */
const TEASE = {
  dirty: ['Pöh! Bu koku da ne? Hamam şurada dostum.', 'Rüzgâr senden yana esiyor, haberin olsun!', 'Domuz ahırından mı çıktın?'],
  drunk: ['Dümdüz yürü bakalım, hadi!', 'Yol bir tane, sen üç tane görüyorsun galiba.', 'Saloonu boşaltmışsın maşallah!'],
  hurt: ['Vay, seni kim bu hale getirdi?', 'Doktora git, kan kaybediyorsun!', 'Kurt mu yedi, kurşun mu?'],
  rich: ['Keseyi iyi doldurmuşsun, bir içki ısmarlasana!', 'Paranın sesi buradan duyuluyor.', 'Zengin olunca bizi unutma!'],
  poor: ['Cebinde akrep mi var? Hiç harcamıyorsun.', 'Beş parasız mısın yine?'],
  gallop: ['Yavaş be! Burası kasaba!', 'Atını yavaşlat, çocuklar var!', 'Toz yuttum, sağ ol!'],
  horse: ['Güzel at! Satar mısın?', 'Atın senden daha bakımlı.', 'O at seni taşıyor mu, sen mi onu?'],
  masked: ['Maskeli... Hayırdır inşallah.', 'Bandanan kaymış, yüzünü gördüm!'],
  wanted: ['Sen o afişteki değil misin?', 'Şerif seni arıyor, bilmiyor musun?'],
  famous: ['Şerif bile senden bahsediyor, aferin.', 'Bizim kahramanımız geldi!', 'İmza verir misin? Şaka şaka!'],
  feared: ['Yolundan çekiliyorum, tamam.', 'Bir şey demedim ben, yürü git.'],
  night: ['Bu saatte sokakta ne arıyorsun?', 'Gece kuşu musun sen?'],
  rain: ['Şemsiye alsana, sırılsıklamsın!', 'Yağmurda ıslanmayı seviyorsun galiba.'],
  hot: ['Şapkan olmasa kafan pişerdi!', 'Bu sıcakta palto mu giyilir?'],
  cold: ['Titriyorsun, bir şeyler giy!', 'Burnun kıpkırmızı olmuş!'],
  armed: ['Silahını kılıfında tut, burası kasaba.', 'Nişan alma bana, huylanıyorum!'],
  carry: ['Aman Tanrım! Omzundaki ne öyle?!', 'Onu nereye götürüyorsun?!'],
  again: ['Yine mi sen? Bugün kaçıncı kez görüyorum.', 'Sen bu sokakta mı yaşıyorsun?'],
  friend: ['Selam {ad}! Nerelerdesin?', '{ad}! Dün seni saloonda gördüm, iyi dans ediyordun!', 'Hey {ad}, bir gün bana da nişan atmayı öğret!'],
  kid: ['Kovboy! Nişan göster!', 'Atına binebilir miyim?', 'Kaç haydut yakaladın?', 'Şapkan çok havalı!'],
  elder: ['Genç, şapkanı düzelt, yakışıklı görün.', 'Bizim zamanımızda böyle gezilmezdi.', 'Otur biraz, sana eski günleri anlatayım.'],
  drifter: ['Bir kadeh ısmarla, sana bir sır vereyim.', 'Hey dostum, bozukluğun var mı?'],
  generic: ['Selam yabancı! {k} nasıl buldun?', 'Buralarda yenisin galiba.', 'İyi günler! Havaya bak, ne güzel.'],
  poker: ['Geçen poker masasında seni gördüm, yüzün kireç gibiydi!', 'Kartlarda şansın yaver gidiyor mu?'],
  snubbed: ['Selamımı almayan sen değil miydin?', 'Bugün selam verecek misin, yoksa yine mi yok?', 'Hıh, selam vermeyi öğrendin mi bari?'],
};
/* Karşılık: oyuncunun cevabı ve sakinin tepkisi */
const RETORT = {
  me: ['Sen de pek parlamıyorsun dostum!', 'Laf çok, iş yok!', 'Ağzına bir şeker at, tatlansın.', 'Seninle sonra hesaplaşırız, ha ha!', 'Beni kıskanıyorsun, belli.'],
  laugh: ['Ha ha! İyi cevaptı!', 'Hah! Sen iyisin, sevdim seni.', 'Tamam, bu turu sen kazandın!', 'Ha! Diline sağlık.'],
  sour: ['Hıh. Şakadan anlamıyorsun.', 'Kendini komik mi sanıyorsun?', 'Seninle konuşan da kabahat.'],
};
/* Olaylara anlık tepkiler */
const REACT = {
  gallopDodge: ['Hey! Dikkat et!', 'Az kalsın eziyordun!', 'Deli misin sen?!'],
  handsUp: ['Tamam! Tamam! Ateş etme!', 'Hey! İndir şunu!', 'Param yok, yemin ederim!'],
  corpse: ['Aman Tanrım!', 'Biri şerifi çağırsın!', 'Bakamıyorum...', 'Kim yaptı bunu?'],
  rainHurry: ['Of, yine yağmur!', 'Şapkam ıslanacak!'],
  bump: ['Önüne bak!', 'Pardon!', 'Dikkat!', 'Yavaş!'],
  laughAlone: ['Ha ha ha!', 'Hah!', 'Hıh hıh.'],
};

/* ================== gezinme ================== */
const NpcNav = {
  /* e'yi (x, y) hedefine yürüt. 'arrived' | 'moving' | 'fail' döner. */
  navStep(e, x, y, dt, sp, opt) {
    let N = e.nav;
    if (!N || Math.abs(N.tx - x) > 18 || Math.abs(N.ty - y) > 18) N = e.nav = { tx: x, ty: y, route: null, ri: 0, fails: 0, stuckT: 0 };
    const W = this.world;
    if (!N.route) {
      const t = W.townAt(e.x, e.y, 10) || W.townAt(x, y, 10);
      N.route = this.bendRoute(e, (t && TownPath.find(t, e.x, e.y, x, y)) || [[x, y]]); N.ri = 0;
    }
    const wp = N.route[N.ri], last = N.ri >= N.route.length - 1;
    const d2 = dist2(e.x, e.y, wp[0], wp[1]), d = Math.sqrt(d2);
    // köşeyi yuvarla: ara noktaya yaklaşınca, bir sonrakine düz yol varsa erkenden ona dön
    const nx = N.route[N.ri + 1];
    const early = !last && d < 15 && nx && (N.peek === N.ri || (N.peek = N.ri, N.peekOk = TownPath.walkable([e.x, e.y], nx, e.r + 0.5))) && N.peekOk;
    if (d2 < (last ? (opt && opt.near ? opt.near * opt.near : 25) : 64) || early) {
      N.ri++; N.best = Infinity; N.noProg = 0;
      if (N.ri >= N.route.length) { e.nav = null; e.mv = 0; return 'arrived'; }
      return 'moving';
    }
    // kalabalıktan kaçarken rotadan saptıysa ve önündeki ara noktaya düz yol kalmadıysa yeniden rota
    if ((N.losT = (N.losT || 0) - dt) <= 0) {
      N.losT = 0.6;
      if (N.route.length > 1 && !TownPath.walkable([e.x, e.y], wp, e.r + 0.5)) { N.route = null; N.best = Infinity; return 'moving'; }
    }
    // ilerleme takibi: duvar boyunca kayıyor, dönüp duruyor ya da itişiyorsa takılmış say
    if (d < (N.best === undefined ? Infinity : N.best) - 1.5) { N.best = d; N.noProg = 0; } else N.noProg = (N.noProg || 0) + dt;
    if (last && d < 16 && N.noProg > 0.8) { e.nav = null; e.mv = 0; return 'arrived'; }
    if (N.noProg > 1.6) { N.noProg = 0; N.best = Infinity; e.stuck = 1; }
    // doğal yürüyüş: herkes kendi şeridinden (rota çizgisinin biraz yanından) yürür, yönü hafifçe salınır
    const gt = this.gait(e);
    // şerit hedefi her ara nokta için bir kez hesaplanır; oraya düz yol yoksa rota noktası kullanılır
    if (N.lti !== N.ri || N.ltr !== N.route) {
      N.lti = N.ri; N.ltr = N.route; N.lt = null;
      if (!last && gt.lane) {
        const pv = N.route[N.ri - 1] || [e.x, e.y], sa = Math.atan2(wp[1] - pv[1], wp[0] - pv[0]);
        const lx = wp[0] - Math.sin(sa) * gt.lane, ly = wp[1] + Math.cos(sa) * gt.lane;
        if (!this.world.blocked(lx, ly, e.r + 1.5) && !this.world.indoorPx(lx, ly) && TownPath.walkable([e.x, e.y], [lx, ly], e.r + 0.5)) N.lt = [lx, ly];
      }
    }
    const tx = N.lt ? N.lt[0] : wp[0], ty = N.lt ? N.lt[1] : wp[1];
    let a = Math.atan2(ty - e.y, tx - e.x);
    if (d > 10 && !(opt && opt.straight)) {
      // hafif salınım: duvar dibinde yapılmaz
      const wa = gt.wa * (e.walkStyle === 'drunk' ? 3.2 : 1), wob = Math.sin(this.t * gt.wf + gt.seed) * wa + Math.sin(this.t * gt.wf * 2.7 + gt.seed * 3) * wa * 0.35;
      if (!this.world.blocked(e.x + Math.cos(a + wob * 2) * 9, e.y + Math.sin(a + wob * 2) * 9, e.r)) a += wob;
    }
    const av = this.avoidSteer(e, a, opt && opt.ignore);
    a += av.steer;
    // dönüş hızı sınırlı: köşeler kavisle alınır; ters yöne dönerken olduğu yerde yavaşlar
    const turn = Math.abs(angDiff(e.ang, a));
    e.ang = turnTo(e.ang, a, dt * (Math.abs(av.steer) > 0.3 ? 8 : 4.6));
    if (av.wait) { e.mv = 0; N.waitT = (N.waitT || 0) + dt; if (N.waitT < 1.6) return 'moving'; }
    else N.waitT = 0;
    // kişisel hız, zamanla hafif değişen tempo, kalkışta hızlanma, varışta yavaşlama
    N.acc = Math.min(1, (N.acc || 0.25) + dt * 2.2);
    let k = gt.k * (1 + 0.09 * Math.sin(this.t * 0.37 + gt.seed)) * N.acc * (turn > 1.5 ? 0.35 : turn > 0.8 ? 0.7 : 1);
    if (last && d < 22) k *= 0.45 + 0.55 * d / 22;
    const ox = e.x, oy = e.y;
    e.walk(dt, sp * av.slow * k);
    // duvara sürtünerek yavaş kayma da takılmadır (ilerliyor görünse bile)
    const want = sp * av.slow * k * e.slow() * dt;
    if (Math.hypot(e.x - ox, e.y - oy) < want * 0.45) N.slowT = (N.slowT || 0) + dt; else N.slowT = Math.max(0, (N.slowT || 0) - dt * 0.5);
    if (N.slowT > 0.7) { N.slowT = 0; e.stuck = 1; }
    // takılma: yeniden rota, sonra en yakın boş yer, sonra vazgeç
    if (e.stuck > 0.55) {
      e.stuck = 0; N.fails++;
      if (last && d2 < 20 * 20) { e.nav = null; return 'arrived'; }
      if (N.fails <= 2) N.route = null;
      else if (N.fails <= 3) { const f = this.freeNear(e.x, e.y, e.r + 1.5); if (f) { N.route = [f, ...N.route.slice(N.ri)]; N.ri = 0; } else N.route = null; }
      else { e.nav = null; return 'fail'; }
    }
    return 'moving';
  },
  /* Uzun düz rota parçalarını hafifçe büker: insanlar cetvelle çizilmiş gibi yürümez */
  bendRoute(e, R) {
    const out = [];
    let prev = [e.x, e.y];
    for (const p of R) {
      const len = Math.hypot(p[0] - prev[0], p[1] - prev[1]);
      if (len > 60 && out.length < 14) {
        const a = Math.atan2(p[1] - prev[1], p[0] - prev[0]), off = (Math.random() * 2 - 1) * Math.min(16, len * 0.13);
        const m = [(prev[0] + p[0]) / 2 - Math.sin(a) * off, (prev[1] + p[1]) / 2 + Math.cos(a) * off];
        if (TownPath.walkable(prev, m, e.r + 0.8) && TownPath.walkable(m, p, e.r + 0.8)) out.push(m);
      }
      out.push(p); prev = p;
    }
    return out;
  },
  /* Kişiye özgü yürüyüş: hız, şerit, salınım (kimlikten sabit) */
  gait(e) {
    if (e.gt) return e.gt;
    const h = (k) => hash2(e.id * 7 + k, k * 13 + 5, 311);
    const occ = e.res ? e.res.occ : e.role;
    const gt = { k: 0.86 + h(1) * 0.28, lane: (h(2) - 0.5) * 9, wf: 0.45 + h(3) * 0.5, wa: 0.09 + h(4) * 0.1, seed: h(5) * 100, style: null };
    if (occ === 'elder') { gt.style = h(6) < 0.7 ? 'cane' : null; gt.k *= 0.9; }
    else if (occ === 'kid' || occ === 'newsboy' || e.child) { gt.style = 'kid'; gt.wa *= 1.6; }
    e.gt = gt;
    return gt;
  },
  /* Yakındaki boş ve düz çizgiyle varılabilen nokta */
  freeNear(x, y, r = 5) {
    const W = this.world;
    for (let d = 8; d <= 40; d += 8) for (let k = 0; k < 12; k++) {
      const a = k / 12 * TAU + d * 0.1, px = x + Math.cos(a) * d, py = y + Math.sin(a) * d;
      if (!W.blocked(px, py, r) && !W.indoorPx(px, py) && !W.isWaterPx(px, py) && TownPath.walkable([x, y], [px, py], r - 1.5)) return [px, py];
    }
    return null;
  },
  /* Kalabalıkta kaçınma: önündeki kişiye göre yön sapması, yavaşlama ya da bekleme */
  avoidSteer(e, a, ignore) {
    const fx = Math.cos(a), fy = Math.sin(a), P = this.player;
    let steer = 0, slow = 1, wait = false;
    const test = (o, rr) => {
      const dx = o.x - e.x, dy = o.y - e.y;
      if (dx > 28 || dx < -28 || dy > 28 || dy < -28) return;
      const fwd = dx * fx + dy * fy;
      if (fwd < 0) return;
      const lat = -dx * fy + dy * fx, R = rr + e.r + 2.5;
      if (Math.abs(lat) > R || fwd > 26) return;
      const w = 1 - fwd / 26;
      // karşıdan gelen ya da duran: sağdan geç (ortadaysa sağ, yandaysa uzak taraf)
      steer += (Math.abs(lat) < 1.2 ? 1 : -Math.sign(lat)) * w * 0.9;
      if (fwd < R + 2) { slow = Math.min(slow, 0.35); if (fwd < R && Math.abs(lat) < R * 0.6) wait = true; }
    };
    if (P && !P.riding && P !== ignore) test(P, P.r || 4);
    for (const o of this.ents) {
      if (o === e || o === ignore || o.remove || o.hide) continue;
      if (o.kind === 'npc') { if (!o.dead && o.state !== 'sit') test(o, o.r); else if (o.dead) test(o, 5); }
      else if (o.kind === 'horse') test(o, 7);
      else if (o.kind === 'wagon') { test(o, 9); test({ x: o.bx, y: o.by }, 10); }
    }
    if (P && P.riding) test(P, 8);
    // bekleyen biri sonsuza dek beklemesin: iki kişi karşı karşıya kalırsa sağa kayar
    return { steer: clamp(steer, -1.3, 1.3), slow, wait };
  },
  /* Kasabada ulaşılabilir rastgele bir nokta (A* ızgarasından) */
  reachSpot(cx, cy, r, from) {
    const W = this.world, t = W.townAt(cx, cy, 10);
    for (let k = 0; k < 14; k++) {
      const x = cx + rnd(-r, r), y = cy + rnd(-r * 0.7, r * 0.7);
      if (W.blocked(x, y, 6) || W.indoorPx(x, y) || W.isWaterPx(x, y)) continue;
      if (t) { const g = TownPath.grid(t), gx = (x >> 4) - g.x0, gy = (y >> 4) - g.y0; if (gx < 0 || gy < 0 || gx >= g.w || gy >= g.h || !g.pass[gy * g.w + gx]) continue; }
      else if (from && !this.los(from.x, from.y, x, y)) continue;
      return { x, y };
    }
    return null;
  },
  /* Kaçış: kasabada tehlikeden uzak, ulaşılabilir bir noktaya koş; dışarıda uzaklaş */
  fleeStep(e, fx, fy, dt, sp) {
    const W = this.world, t = W.townAt(e.x, e.y, 10);
    if (t) {
      if (!e.fleePt || dist2(e.x, e.y, e.fleePt.x, e.fleePt.y) < 16 * 16 || (e.fleePt.t -= dt) <= 0) {
        const away = Math.atan2(e.y - fy, e.x - fx);
        let best = null;
        for (let k = 0; k < 10; k++) {
          const a = away + rnd(-0.9, 0.9), d = rnd(110, 200), x = e.x + Math.cos(a) * d, y = e.y + Math.sin(a) * d;
          const s = this.reachSpot(x, y, 12);
          if (s) { best = s; break; }
        }
        e.fleePt = best ? { x: best.x, y: best.y, t: 6 } : null;
      }
      if (e.fleePt) { if (this.navStep(e, e.fleePt.x, e.fleePt.y, dt, sp) === 'fail') e.fleePt = null; return; }
    }
    let a = Math.atan2(e.y - fy, e.x - fx);
    if (e.stuck > 0.5 && !(e.detourT > 0)) { e.detour = (chance(0.5) ? 1 : -1) * rnd(1.1, 1.8); e.detourT = rnd(0.6, 1.1); e.stuck = 0; }
    if (e.detourT > 0) { e.detourT -= dt; a += e.detour; }
    e.ang = turnTo(e.ang, a, dt * 4);
    e.walk(dt, sp);
  },
};

/* ================== algı, sohbet ve sataşma ================== */
const NpcMind = {
  moodOf(r) {
    if (r.mood) return r.mood;
    const h = hash2(r.id.length * 7 + r.id.charCodeAt(r.id.length - 1), r.name.length * 13 + r.name.charCodeAt(0), 919);
    r.mood = r.occ === 'kid' ? (h < 0.6 ? 'jolly' : 'shy') : r.occ === 'elder' ? (h < 0.4 ? 'grumpy' : h < 0.75 ? 'gossip' : 'pious')
      : h < 0.22 ? 'jolly' : h < 0.38 ? 'grumpy' : h < 0.5 ? 'shy' : h < 0.66 ? 'gossip' : h < 0.74 ? 'pious' : 'plain';
    return r.mood;
  },
  fmtTalk(l, t) {
    const P = this.player, res = t && t._res;
    let x = '';
    if (res && res.length) { const c = res[(hash2(this.day, l.length, 3) * res.length) | 0]; x = c.name.split(' ')[0]; }
    return l.replace(/\{ad\}/g, P.name.split(' ')[0]).replace(/\{x\}/g, x || pick(NAMES.m)).replace(/\{k\}/g, t ? t.n : '');
  },
  /* Kasabada yakın zamanda olan olaylar: sohbet konusu olur */
  townNote(x, y, kind) {
    const t = this.world.townAt(x, y, 40);
    if (!t) return;
    const N = this.townNews || (this.townNews = {});
    N[t.id] = N[t.id] || {};
    N[t.id][kind] = this.clock;
  },
  recentNews(t) {
    const N = this.townNews && this.townNews[t.id];
    if (!N) return null;
    const fresh = Object.keys(N).filter(k => this.clock - N[k] < 60 * 30);
    return fresh.length ? pick(fresh) : null;
  },
  talkPool(a, b, t) {
    const h = this.hour, env = this.envCache || {}, pools = [TALKS.any, TALKS.any, CHAT.any];
    const news = this.recentNews(t);
    if (news && TALKS[news] && chance(0.7)) return TALKS[news];
    if ((env.rain || 0) > 0.2) pools.push(TALKS.rain, TALKS.rain);
    else if (this.hotness > 0.3) pools.push(TALKS.hot);
    else if (this.coldness > 0.3) pools.push(TALKS.cold);
    if (h >= 5 && h < 10) pools.push(TALKS.morning);
    else if (h >= 17 && h < 21) pools.push(TALKS.evening);
    else if (h >= 21 || h < 5) pools.push(TALKS.night);
    if (this.day % 7 === 0 && h >= 11 && h < 15) pools.push(TALKS.sunday);
    for (const r of [a.res, b.res]) if (r && TALKS[r.occ]) pools.push(TALKS[r.occ], TALKS[r.occ]);
    if (this.honor > 30 && chance(0.35)) pools.push(TALKS.good, TALKS.good);
    if (this.honor < -30 && chance(0.35)) pools.push(TALKS.bad, TALKS.bad);
    return pick(pools);
  },
  /* İki (ya da üç) sakin arasında sohbet başlat */
  startTalk(a, b, t, lines) {
    const ppl = [a, b];
    const c = this.ents.find(o => o !== a && o !== b && o.res && !o.dead && !o.hostile && !o.talk && o.state !== 'flee' && dist2(o.x, o.y, a.x, a.y) < 34 * 34 && chance(0.4));
    if (c) ppl.push(c);
    const script = (lines || pick(this.talkPool(a, b, t))).map(l => this.fmtTalk(l, t));
    const T = { ppl, script, i: 0, t: 0.3, t0: this.clock };
    for (const p of ppl) { p.talk = T; p.talkT = 0; p.pauseT = 0; }
    (this.talks || (this.talks = [])).push(T);
    return T;
  },
  talkTick(dt) {
    const L = this.talks;
    if (!L || !L.length) return;
    for (let i = L.length - 1; i >= 0; i--) {
      const T = L[i];
      const alive = T.ppl.filter(p => !p.dead && !p.remove && p.talk === T && !p.hostile && p.state !== 'flee' && p.state !== 'report' && !p.bound);
      if (alive.length < 2 || T.i > T.script.length) { for (const p of T.ppl) if (p.talk === T) { p.talk = null; p.talkCd = this.clock + rnd(25, 60); } L.splice(i, 1); continue; }
      // yüz yüze dur
      const cx = alive.reduce((s, p) => s + p.x, 0) / alive.length, cy = alive.reduce((s, p) => s + p.y, 0) / alive.length;
      for (const p of alive) { p.mv = 0; const tgt = alive.find(q => q !== p) ; p.ang = turnTo(p.ang, Math.atan2((alive.length > 2 ? cy : tgt.y) - p.y, (alive.length > 2 ? cx : tgt.x) - p.x), dt * 5); }
      T.t -= dt;
      if (T.t > 0) continue;
      if (T.i >= T.script.length) {
        // son: bazen gülerler
        const m = alive[0].res ? MOODS[this.moodOf(alive[0].res)] : MOODS.plain;
        if (chance(m.laugh * 0.5)) { const who = pick(alive); Bubbles.add(who, pick(REACT.laughAlone), 1.6); this.setAnim(who, 'laugh'); }
        T.i++; T.t = 1.2; continue;
      }
      const sp = alive[T.i % alive.length], line = T.script[T.i];
      Bubbles.add(sp, line, clamp(1.6 + line.length * 0.045, 2, 4.2));
      T.t = clamp(1.4 + line.length * 0.04, 1.8, 3.8);
      // konuşan el kol oynatır; dinleyen bazen kollarını kavuşturur ya da sigarasını tüttürür
      if (!sp.anim || sp.anim.k !== 'smoke') { if (chance(0.7)) this.setAnim(sp, /\?$/.test(line) && chance(0.4) ? 'shrug' : 'gesture', T.t); else sp.anim = null; }
      for (const o of alive) if (o !== sp && !o.anim && chance(0.15)) this.setAnim(o, chance(0.5) ? 'cross' : 'hips', T.t * 2);
      T.i++;
    }
  },
  /* Sakinin saniyelik aklı: sohbet başlatma, oyuncuya sataşma, olaylara tepki */
  mindTick(e, t) {
    const P = this.player, r = e.res;
    if (!r || e.hostile || e.dead || e.bound || e.state === 'flee' || e.state === 'report' || e.state === 'cower') return;
    const d2 = dist2(e.x, e.y, P.x, P.y);
    if (d2 > 360 * 360) return;
    const M = MOODS[this.moodOf(r)];
    // ceset: yakındaki sakin durur, bakar, söylenir
    if (!e.talk && !(e.shockT > this.clock)) {
      const body = this.ents.find(o => o.kind === 'npc' && o.dead && !o.remove && dist2(o.x, o.y, e.x, e.y) < 70 * 70 && (o.deadT || 0) < 600);
      if (body && this.los(e.x, e.y, body.x, body.y)) {
        e.shockT = this.clock + 90; e.pauseT = rnd(3, 6); e.ang = Math.atan2(body.y - e.y, body.x - e.x);
        Bubbles.add(e, pick(REACT.corpse), 2.4);
        this.townNote(body.x, body.y, 'death');
        return;
      }
    }
    if (e.talk || e.state === 'sit' && !chance(0.3)) return;
    // yağmur başlayınca söylenip adımlarını sıklaştırır
    if ((this.envCache || {}).rain > 0.3 && e.state !== 'sit' && !(e.rainCd > this.day) && chance(0.04)) { e.rainCd = this.day; Bubbles.add(e, pick(REACT.rainHurry), 1.8); }
    // oyuncuya sataşma
    // selam: önce o selam verir; karşılık bekler
    if (this.helloTick(e, r, M, d2)) return;
    // yolda karşılaşan sakinler birbirini selamlar; sarhoş serseri söylenir
    this.passTick(e);
    if (e.walkStyle === 'drunk' && chance(0.08)) Bubbles.add(e, pick(DRUNK), 1.8);
    if (d2 < 60 * 60) {
      const m = this.mem(r);
      if (m.seenDay !== this.day) { m.seenDay = this.day; m.seenN = 0; }
      if (this.clock - (m.seenAt || -1e9) > 20) m.seenN = (m.seenN || 0) + 1;
      m.seenAt = this.clock;
      if (this.teaseCheck(e, r, M, d2)) return;
    }
    // sohbet: yürüyüşte, otururken, oyunda
    if (!e.plan || !['stroll', 'sit', 'play', 'sweep', 'news', 'haul', 'errand'].includes(e.plan.act)) return;
    if (e.talkCd > this.clock || !chance(0.06 * M.chat)) return;
    const o = this.ents.find(o => o !== e && o.res && !o.dead && !o.hostile && !o.talk && !(o.talkCd > this.clock) && o.state !== 'flee' && o.plan && !['home', 'in', 'away', 'church', 'school'].includes(o.plan.act) && dist2(o.x, o.y, e.x, e.y) < 38 * 38);
    if (!o) return;
    // çocuklar kendi aralarında, büyükler kendi aralarında (çoğunlukla)
    if (!!e.child !== !!o.child && chance(0.8)) return;
    const lines = e.child && o.child ? pick(TALKS.kid) : null;
    this.startTalk(e, o, t, lines);
  },
  teaseCheck(e, r, M, d2) {
    const P = this.player;
    if (e.teaseCd > this.clock || (this.teaseT || 0) > this.clock) return false;
    if (!this.los(e.x, e.y, P.x, P.y)) return false;
    const op = this.opOf(r);
    if (op <= -40) return false;   // nefret eden zaten kaçar
    if (!chance(0.2 * M.tease)) return false;
    const env = this.envCache || {}, h = this.hour, pool = [];
    const add = (k, w = 1) => { for (let i = 0; i < w; i++) pool.push(k); };
    const rider = P.riding;
    if (P.carry && (P.carry.kind === 'npc')) add('carry', 6);
    else if (rider && rider.spd > 110) add('gallop', 5);
    if (P.masked) add('masked', 4);
    if (this.law && this.law.bounty > 0 && !P.masked) add('wanted', 3);
    if (P.clean < 25) add('dirty', 3);
    if (P.drunk > 40) add('drunk', 3);
    if (P.hp < P.maxHp * 0.4) add('hurt', 3);
    if (P.isArmed && (P.aiming || P.rsAim)) add('armed', 4);
    if (P.money > 150) add('rich', 1); else if (P.money < 0.5) add('poor', 1);
    if (rider && rider.kind === 'horse' && rider.spd < 60) add('horse', 1);
    if (this.honor > 50) add('famous', 2); else if (this.honor < -50) add('feared', 2);
    if (h >= 22 || h < 5) add('night', 2);
    if ((env.rain || 0) > 0.3) add('rain', 2);
    else if (this.hotness > 0.4) add('hot', 1);
    else if (this.coldness > 0.4) add('cold', 1);
    const m = this.mem(r);
    if (m.seenDay === this.day && m.seenN >= 3) add('again', 2);
    if (op >= 30) add('friend', 3);
    if (m.snubDay !== undefined && this.day - m.snubDay <= 2) add('snubbed', 4);
    if (this.stats && this.stats.pokerWins) add('poker', 1);
    if (r.occ === 'kid') add('kid', 4);
    else if (r.occ === 'elder') add('elder', 2);
    else if (r.occ === 'drifter') add('drifter', 2);
    add('generic', 1);
    const k = pick(pool), t = r.t;
    const line = this.fmtTalk(pick(TEASE[k]), t);
    e.teaseCd = this.clock + rnd(180, 360); this.teaseT = this.clock + rnd(0.4, 0.8) * 60;
    e.pauseT = Math.max(e.pauseT || 0, 2.2); e.ang = Math.atan2(P.y - e.y, P.x - e.x);
    Bubbles.add(e, line, 3.4);
    this.setAnim(e, k === 'kid' ? 'wave' : k === 'dirty' ? 'fan' : chance(0.5) ? 'point' : 'hips');
    e.teased = { rt: this.t, k };
    if (k === 'gallop') { e.state = 'flee'; e.t = 1.2; }
    return true;
  },
  /* Oyuncu sataşana karşılık verir */
  retort(e) {
    const P = this.player, r = e.res;
    e.teased = null;
    Bubbles.add(P, pick(RETORT.me), 2.6);
    const M = r ? MOODS[this.moodOf(r)] : MOODS.plain;
    const good = chance(0.35 + M.laugh * 0.6);
    setTimeout(() => {
      if (e.dead || e.remove) return;
      Bubbles.add(e, pick(good ? RETORT.laugh : RETORT.sour), 2.4);
      this.setAnim(e, good ? 'laugh' : 'cross');
      if (r) this.resOpinion(e, good ? 4 : -3);
    }, 1400);
  },
  /* Her kare: dörtnala geçen atlıdan kaç, silah doğrultana el kaldır, yanından geçene bak */
  perceive(e, dt) {
    const P = this.player;
    if (e.dead || e.bound || e.hostile || e.role === 'law' || e.role === 'hunter' || e.role === 'bandit' || e.role === 'target') return false;
    if (e.dodgeT > 0) {
      // atlıdan ya da arabadan kaçış sıçraması: o yan duvarsa öbür yana, ikisi de kapalıysa olduğu yerde kalır
      const W = this.world, free = (a) => !W.blocked(e.x + Math.cos(a) * 7, e.y + Math.sin(a) * 7, e.r);
      if (!free(e.dodgeA)) { if (free(e.dodgeA + Math.PI)) e.dodgeA += Math.PI; else { e.dodgeT = 0; return false; } }
      e.dodgeT -= dt; e.ang = e.dodgeA; e.walk(dt, 90); return true;
    }
    const dx = P.x - e.x, dy = P.y - e.y, d2 = dx * dx + dy * dy;
    if (d2 > 140 * 140) { e.lookAt = null; return false; }
    // silah doğrultulan sivil ellerini kaldırır, sonra kaçar
    if (P.isArmed && (P.aiming || P.rsAim) && d2 < 110 * 110 && e.state !== 'robbed' && e.state !== 'robbing' && e.state !== 'sit') {
      const toMe = Math.atan2(-dy, -dx);
      if (Math.abs(angDiff(P.aimAng, toMe)) < 0.3 && this.los(P.x, P.y, e.x, e.y)) {
        if (!(e.handsT > 0)) { Bubbles.add(e, pick(REACT.handsUp), 2); if (e.res) this.resOpinion(e, -2, 'aimed'); }
        e.handsT = 1.2; e.talk = null; e.state = 'cower'; e.cowerT = 2.5; e.mv = 0;
        return true;
      }
    }
    if (e.handsT > 0) e.handsT -= dt;
    // dörtnala gelen atlı: yana sıçra
    const R = P.riding;
    if (R && R.spd > 100 && d2 < 50 * 50 && !(e.dodgeT > 0)) {
      const va = R.ang, rel = Math.atan2(-dy, -dx);
      if (Math.abs(angDiff(va, rel)) < 0.9) {
        const side = Math.sign(-Math.sin(va) * (-dx) + Math.cos(va) * (-dy)) || 1;
        e.dodgeT = 0.5; e.dodgeA = va + side * Math.PI / 2; e.talk = null;
        if (chance(0.7)) Bubbles.add(e, pick(REACT.gallopDodge), 2);
        if (e.res) this.resOpinion(e, -1);
        this.townNote(e.x, e.y, 'gallop');
      }
    }
    // oyuncu yürürken üstüne gelip çarparsa söylenir
    if (d2 < 9 * 9 && !P.riding && (P.mv || 0) > 0.3 && !(e.bumpCd > this.t) && e.state !== 'sit') {
      e.bumpCd = this.t + 12;
      Bubbles.add(e, pick(REACT.bump), 1.6);
      if (e.talk) e.talk = null;
    }
    // yakından geçen oyuncuya dönüp bakar (başını çevirir)
    if (d2 < 45 * 45 && e.state !== 'sit' && !e.talk) e.lookAt = Math.atan2(dy, dx); else e.lookAt = null;
    return false;
  },
};
