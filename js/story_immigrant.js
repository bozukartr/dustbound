'use strict';
/* ==========================================================
   FRONTIER'S END — Göçmen'in hikâyesi: "Ağabeyin Mektupları"
   Saint Clement limanına ayak basarsın. İki yıl önce gelen ağabeyin
   Anton'un mektupları dört ay önce kesilmiş. Mektuplarında adı geçen
   pansiyoncu Greta Halvorsen seni karşılar. Liman, ilk yevmiye,
   pazarlık, telgraf, ilk at, posta arabası, maden kasabası, şirket
   dükkânının sahte borç defteri, hak gaspçılarının kampı ve sonunda
   iki kardeşin kendi dükkânı.
   Konuşma satırları: S = Greta, R = Ambrose Pike, K = Anton (ağabey),
   M = madenci, P = oyuncu, W = şerif.
   ========================================================== */

const GRETA_LOOK = { sex: 'f', skin: '#f0cfb4', hair: '#d8c8a0', hairStyle: 2, beard: 0, beardLen: 0, hat: 'none', hatCol: '#3a3028', coat: '#3a4a5a', shirt: '#e8e0d0', pants: '#2a3038', eyes: '#5a7a9a', coatLen: 0.9 };
const PIKE_LOOK = { sex: 'm', skin: '#e8c0a0', hair: '#6a5a48', hairStyle: 0, beard: 1, beardLen: 0.3, hat: 'bowler', hatCol: '#1a1a1e', coat: '#2a2a30', shirt: '#c8c0b0', pants: '#26262a', eyes: '#6a6a5a', coatLen: 0.7 };
const ANTON_LOOK = { sex: 'm', skin: '#e8c0a0', hair: '#8a5a30', hairStyle: 3, beard: 3, beardLen: 0.6, hat: 'flat', hatCol: '#4a4038', coat: '#5a4a3a', shirt: '#9a8a70', pants: '#3a342c', eyes: '#5a6a7a', coatLen: 0 };
const GRETA_HORSE = { col: '#8a6a4a', mane: '#3a2a1a', blanket: '#3a4a6a' };

STORIES.immigrant = {
  id: 'immigrant', ach: 'story_immigrant', rumorCamp: false,
  title: () => Tr('Ağabeyin Mektupları'),
  intro: () => Tr`Saint Clement limanına ayak bastın. Ağabeyin Anton'un mektupları dört ay önce kesildi; mektuplarında adı geçen pansiyoncu Greta Halvorsen seni bekliyor.`,
  outro: () => Tr`Hikâye tamamlandı. Anton'la birlikte kendi dükkânınız var; Greta'nın pansiyonunun kapısı da hep açık.`,
  opening: () => [
    ['P', Tr('Dört ay oldu, Anton. Bu senin son mektubun.')],
    ['P', Tr('"Saint Clement\'a varınca Greta Halvorsen\'i bul. O sana yardım eder."')],
  ],
  welcome: () => Tr('Saint Clement limanındasın. Ağabeyinin mektuplarında adı geçen pansiyoncu <b>Greta Halvorsen</b> seni bekliyor; sağ üstteki hedefi izle.'),
  mentor: {
    name: 'Greta Halvorsen', short: 'Greta', look: GRETA_LOOK, horse: GRETA_HORSE,
    chatDone: () => [
      Tr('Anton yine mektup yazdı. Bu sefer kira için değil, kek tarifi için. İlerleme bu.'), Tr('Pansiyonda odan hazır, {ad}. Çarşaflar temiz, kahve hâlâ kötü.'),
      Tr('Limana her gemi girdiğinde iskeleye bakıyorum. Alışkanlık. Birileri hep bir şey arar.'), Tr('Kocam derdi ki: insan iki kere göç eder; bir kez gemiyle, bir kez kafasında.'),
    ],
    chatBusy: () => [Tr('Sonra, canım. Önce ağabeyini bulalım.'), Tr('Bir şey mi unuttun? Ben listemi hep cebimde taşırım.'), Tr('Konuşmaya vaktimiz olacak. Hadi.')],
  },
  /* ağabey: soyadı oyuncununkiyle aynı, görünüşü ona benzer */
  kin: {
    short: () => Tr('Anton'),
    name() { const sn = this.player.name.split(' ').slice(1).join(' '); return Tr('Anton') + (sn ? ' ' + sn : ''); },
    look: ANTON_LOOK,
    chatDone: () => [
      Tr('Raflara yeni çivi çaktım. Bu sefer kimse borç defteri tutmayacak; yalnızca stok defteri.'), Tr('Annem görse ne derdi, {ad}? "Sonunda bir işe yaradınız" derdi herhalde.'),
      Tr('Madenciler veresiye istiyor. Veriyorum ama faizsiz. Pike gibi olmayacağız.'), Tr('Seni iskelede bekleyecektim, biliyor musun? Gemi gelmeden yazdığım son mektupta söz vermiştim.'),
    ],
    chatBusy: () => [Tr('Sonra konuşuruz, kardeşim. Önce şu işi bitirelim.'), Tr('Hâlâ rüya görüyorum sanıyorum. Sen gerçekten buradasın.')],
  },
  speakers: { M: () => Tr('Madenci') },
  rival: {
    name: () => Tr('Ambrose Pike'), look: PIKE_LOOK, hp: 130, weapon: 'cattleman', money: 8, fromCh: 9, reward: [20, 10],
    take: { n: () => Tr('Senetleri Al'), k: () => Tr('Borç Senetleri'), msg: () => Tr('Pike\'ın tuttuğu sahte borç senetleri artık sende.') },
  },
  setup(S, town) {
    S.port = town.id;
    // ağabey kardeşine benzer: ten, saç ve göz rengi aynı
    const L = this.player.look || {};
    S.kinLook = { skin: L.skin || ANTON_LOOK.skin, hair: L.hair || ANTON_LOOK.hair, eyes: L.eyes || ANTON_LOOK.eyes };
    const W = this.world;
    // Greta iskelede, kasabanın girişinde bekler
    const sp = this.sSpot(town.spawn.x + 34, town.spawn.y + 6, 0, 40);
    S.sully = { x: sp[0], y: sp[1] };
    // maden kasabası: maden ofisi olan en yakın kasaba
    let mt = null, bd = 1e12;
    for (const t of W.towns) if (t !== town && t.buildings.some(b => b.type === 'mine')) { const d = dist(t.cx, t.cy, town.cx, town.cy); if (d < bd) { bd = d; mt = t; } }
    if (!mt) for (const t of W.towns) if (t !== town) { const d = dist(t.cx, t.cy, town.cx, town.cy); if (d < bd) { bd = d; mt = t; } }
    S.mine = mt.id;
    const store = mt.buildings.find(b => b.type === 'general') || mt.buildings.find(b => BIZ[b.type]);
    S.store = store ? store.id : -1;
    // Pike'ın evi: dükkâna en yakın ev
    let ob = null; bd = 1e12;
    for (const b of mt.buildings) if (b.type === 'house' && store) { const d = dist(b.door.x, b.door.y, store.door.x, store.door.y); if (d < bd) { bd = d; ob = b; } }
    S.office = ob ? ob.id : -1;
    // terk edilmiş galeri: maden kasabasına en yakın eski maden ağzı
    let gb = null; bd = 1e12;
    for (const b of W.buildings) if (b.type === 'mineentrance' && !b.cave) { const d = dist(b.door.x, b.door.y, mt.cx, mt.cy); if (d < bd && d < 9000) { bd = d; gb = b; } }
    S.gallery = gb ? gb.id : -1;
    // hak gaspçılarının kampı: maden kasabasına en yakın haydut kampı
    let cp = null; bd = 1e12;
    for (const p of W.pois) if (p.kind === 'camp') { const d = dist(p.x, p.y, mt.cx, mt.cy); if (d > 900 && d < bd) { bd = d; cp = p; } }
    S.camp = cp ? { pid: cp.pid, id: cp.id, x: cp.x, y: cp.y, n: cp.n } : (() => { const s = this.sSpot(mt.cx + 1600, mt.cy + 400, 0, 300); return { pid: -1, x: s[0], y: s[1], n: Tr('Hak Gaspçılarının Kampı') }; })();
    S.site = this.storySite(S.camp, mt);
    S.biome = this.storyBiome(town.cx, town.cy);
  },
  poster(S) {
    if (S.ch < 9) return '';
    return `<div class="poster story"><div class="po-w">${Tr`ARANIYOR`}</div><div class="po-n">${Tr('Ambrose Pike')}</div><div class="po-c">${Tr`Sahte senet, adam kaçırma, maaş hırsızlığı`}</div><div class="po-r">${fmtMoney(20)}</div><div class="po-l">${Tr`Canlı teslime tam ödül.`}</div></div>`;
  },
  rumor(S) {
    UI.info(Tr('Telgraf Memuru'), `<p class="quote">${this.sFmt(Tr('"Anton mu? Dur bakayım... Evet, Silver Ridge\'den düzenli yazardı. Her ay bir zarf, içinde birkaç dolar. Dört ay önce kesildi. Bir de şu var: geri dönen bir mektup. Alıcısı bulunamamış, gönderen o. Al, senin olsun."'))}</p><p>${Tr('Anton\'un son mektubu artık sende. Greta\'ya göster.')}</p>`);
  },
  buildingActions(b, S) {
    const st = this.qStep();
    if (!st || S.wait) return [];
    if (b.type === 'sheriff' && b.town === S.mine && st.ev === 'ledger') return [{ icon: '📒', label: Tr('Borç Defterini Göster'), fn: () => { UI.pop(); this.qEvent('ledger', b); } }];
    if (b.id === S.store && st.ev === 'biz') return [{ icon: '📜', label: Tr('Dükkânın Tapusunu Al'), fn: () => { UI.closeAll(); this.imGrantStore(S); } }];
    return [];
  },
  finish(S) {
    const P = this.player, store = this.world.buildings[S.store];
    this.addHonor(5);
    if (S.flags.loan) UI.feed(Tr`Greta at için verdiği ${fmtMoney(S.flags.loan)} borcu sildi: "Düğün hediyesi say. Kimin düğünü, sonra bakarız."`);
    this.earn(5, Tr('Anton\'un birikimi'));
    if (store) { const p = this.sDoor(store, 18); S.kin = { x: p.x + 14, y: p.y }; }
    const hotel = this.world.buildings.find(b => b.town === S.port && b.type === 'hotel');
    if (hotel) { const p = this.sDoor(hotel, 18); this.sullyGo(p.x - 14, p.y); }
  },
  epilogue: () => Tr`Hikâye bitti ama hayat sürüyor. Anton dükkânın tezgâhında, sen de kendi yolunda. Kasayı uğradıkça toplayabilir, stok getirebilir ya da başka işlere atılabilirsin. <b>Hedefin hâlâ 80 yaşına kadar yaşamak.</b>`,
  chapters: [
    /* 1 — Liman: Greta ile tanış, selamlaş, pansiyonda uyu */
    {
      t: () => Tr('Liman'),
      start() { setTimeout(() => UI.help(Tr`Cebinde ağabeyinin son mektuplarından biri var: <i>"Saint Clement'a varınca Greta Halvorsen'in pansiyonuna git. O sana yardım eder. — Anton"</i>`, 10), 600); },
      resume(S) { if (S.st >= 1) { const b = this.sBld('hotel'), p = this.sDoor(b); if (p) this.sullyGo(p.x, p.y); } },
      steps: [
        { t: () => Tr('Greta Halvorsen ile konuş'), ev: 'talk', at() { return this.mentorEnt() || this.story.sully; },
          hint: () => Tr`İskelede bekleyen kadına yaklaş ve ${Input.glyph('interact')} ile <b>Konuş</b>.`,
          say: () => [
            ['S', Tr('Sen... Anton\'un kardeşisin. Aynı kaşlar. Aynı "nereye düştüm ben" bakışı.')],
            ['P', Tr('{ad}. Anton\'u arıyorum. Dört aydır mektup gelmiyor.')],
            ['S', Tr('Bana da gelmiyor. Üç haftalık kirası da gelmiyor ama onu boş ver.')],
            ['S', Tr('Greta Halvorsen. Pansiyon benim; kocam öldüğünden beri kiracılarım ailem oldu.')],
            ['S', Tr('Önce buraya alış. Bu şehir yabancıyı sever ama önce bir yüzünü görmek ister. Birkaç kişiye selam ver.')],
          ],
          done() { const p = this.sDoor(this.sBld('hotel')); if (p) this.sullyGo(p.x, p.y); } },
        { t: () => Tr('Kasabalıları selamla'), ev: 'greet', n: 2, ok: (e, S) => { if (!e || e.quest) return false; const g = S.greeted || (S.greeted = []); if (g.includes(e.id)) return false; g.push(e.id); return true; },
          hint: () => Tr`Birine yaklaş, ${Input.glyph('interact')} basılı tut ve <b>Selamla</b>. Dil farklı olabilir ama selam evrenseldir.` },
        { t: () => Tr('Greta\'nın pansiyonuna gir'), ev: 'enter', ok: (b) => b && b.type === 'hotel', at() { return this.sDoor(this.sBld('hotel'), 4); },
          hint: () => Tr`Otelin kapısından içeri yürü. Greta seni orada bekliyor.`,
          done() { const b = this.sBld('hotel'); if (b) { let iy = b.door.y; for (let k = 0; k < 40 && !this.world.buildingAtPx(b.door.x, iy); k++) iy -= 2; this.sullyGo(b.door.x - 10, iy - 12); } },
          after: () => [['S', Tr('Anton\'un odası buydu. Hâlâ duvarda bıraktığı harita asılı.')], ['S', Tr('Bir gece uyu, sonra konuşuruz. Yolculuk insanı iki kere yorar: önce bedenini, sonra aklını.')]] },
        { t: () => Tr('Pansiyonda bir gece uyu'), ev: 'sleep', ok: (d) => d === 'hotel',
          hint: () => Tr`Yatağa yaklaş, ${Input.glyph('interact')} ile <b>Oda Tut ve Uyu</b>. Uyurken oyun kaydedilir.` },
      ],
    },
    /* 2 — İlk Yevmiye: limanda çalış */
    {
      t: () => Tr('İlk Yevmiye'),
      steps: [
        { t: () => Tr('Greta ile konuş'), ev: 'talk', at() { return this.mentorEnt() || this.story.sully; },
          say: () => [
            ['S', Tr('Günaydın. Kahvaltı yok; kahve var, o da kötü.')],
            ['S', Tr('Anton buraya ilk geldiğinde cebinde tek kuruş yoktu. İlk haftası limanda sandık taşıyarak geçti.')],
            ['P', Tr('Benim de param az.')],
            ['S', Tr('O zaman ağabeyinin izinden yürü. Liman deposuna git, dört saat ter dök. Kimse sana soru sormaz; sırtın konuşur.')],
          ],
          done() { const p = this.sDoor(this.sBld('docks'), 22); if (p) this.sullyGo(p.x - 18, p.y); } },
        { t: () => Tr('Limanda çalış'), ev: 'work', ok: (j) => j === 'docks', at() { return this.sDoor(this.sBld('docks'), 4); }, wp: true,
          skip() { return !this.sBld('docks'); },
          hint: () => Tr`Liman Deposu'na gir, tezgâhta <b>Limanda Yük Taşı</b>'yı seç. İş saatleri 06:00 – 18:00; çalışınca yorulur, acıkır ve susarsın.`,
          after: () => [
            ['S', Tr('Ellerine bak. Nasırın ilk günü acıtır, sonra gurur olur.')],
            ['S', Tr('Anton da böyle dönerdi. Sırtı ağrıyan ama gülümseyen bir adam.')],
          ] },
      ],
    },
    /* 3 — Pazarlık: Greta'nın şeftalilerini iyi fiyata sat, yol için tulum al */
    {
      t: () => Tr('Pazarlık'),
      talk: () => [
        ['S', Tr('Al şu kavanozları. Benim şeftali konservem; her yaz yaparım, kimse yemez.')],
        ['S', Tr('Sat onları. Ama dikkat et: her dükkân başka fiyat verir. Liman tüccarı yiyeceğe mağazadan iyi para öder.')],
        ['S', Tr('Sormadan satan, iki kere kaybeder.')],
      ],
      start(S) { this.player.addItem('peaches', 3, true); },
      steps: [
        { t: () => Tr('Şeftalileri sat'), ev: 'sell', ok: (d) => !!(d && d.id === 'peaches'), at() { return this.sDoor(this.sBld('docks') || this.sBld('general'), 4); }, wp: true,
          skip() { return !this.player.has('peaches'); },
          hint: () => Tr`Dükkânda satıcıyla konuş, <b>Sat</b> sekmesinde şeftaliyi seç. Fiyatları karşılaştır: ticaret becerin yükseldikçe daha iyi fiyat alırsın.` },
        { t: () => Tr('Yol için bir uyku tulumu al'), ev: 'buy', ok: (d) => !!(d && d.id === 'bedroll'), at() { return this.sDoor(this.sBld('general'), 4); }, wp: true,
          skip() { return this.player.has('bedroll'); },
          hint: () => Tr`Genel mağazada <b>Alışveriş</b>'i aç ve <b>Uyku Tulumu</b> al. Kasaba dışında kamp kurmanı sağlar.`,
          after: () => [['S', Tr('Güzel. Artık her yerde uyuyabilirsin. Anton hep "Batı geniş, yatak dar" derdi.')], ['S', Tr('Hadi telgrafhaneye. Mektuplar oradan geçer; memur her zarfı bilir.')]] },
      ],
    },
    /* 4 — Telgraf: postaneye gir, memura sor, son mektubu oku */
    {
      t: () => Tr('Telgraf'),
      steps: [
        { t: () => Tr('Postaneye gir'), ev: 'enter', ok: (b) => b && (b.type === 'post' || b.type === 'saloon'), at() { return this.sDoor(this.sBld(['post', 'saloon']), 4); }, wp: true,
          on() { const p = this.sDoor(this.sBld(['post', 'saloon']), 22); if (p) this.sullyGo(p.x - 14, p.y); },
          hint: () => Tr`Posta ve Telgraf binası mektupların ve posta arabalarının merkezidir. Yoksa saloondaki barmen her şeyi bilir.` },
        { t: () => Tr('Memura Anton\'u sor'), ev: 'rumor', at() { return this.sDoor(this.sBld(['post', 'saloon']), -16); },
          hint: () => Tr`Görevliyle konuş ve <b>Söylenti Dinle</b>. Birkaç kuruşa bildiklerini anlatır.` },
        { t: () => Tr('Mektubu Greta\'ya göster'), ev: 'talk', at() { return this.mentorEnt() || this.story.sully; },
          say: () => [['P', Tr('Memur bunu verdi. Anton\'dan. Geri dönmüş.')], ['S', Tr('Aç bakalım. Gözlüğüm... neyse, sen oku.')]],
          cine: () => ({ sc: 'q_porch', lines: [
            ['K', Tr('"Sevgili {ad}. Silver Ridge\'de madendeyim. İş ağır ama para iyi, diye yazmıştım. Yalan söyledim."')],
            ['K', Tr('"Şirket dükkânı her şeyi veresiye verir. Kazma, fener, ekmek. Sonra maaşından keser. Kesmeye doymaz."')],
            ['K', Tr('"Pike adında biri defter tutuyor. Ne ödersem ödeyeyim borcum büyüyor. Gemi parasını biriktiremedim, affet."')],
            ['K', Tr('"Gelme. Ya da gel, ama Pike\'a adımı söyleme."')],
            ['S', Tr('...O aptal. Bana neden yazmadı?')],
            ['P', Tr('Gururundan.')],
            ['S', Tr('Gurur kimseyi borçtan kurtarmadı. Silver Ridge uzak; yürüyerek gidilmez. Sana bir at lazım.')],
          ] }) },
      ],
    },
    /* 5 — İlk At: ahırdan at al, bin */
    {
      t: () => Tr('İlk At'),
      talk(S) {
        return S.flags.loan ? [['S', Tr('Paran yetmez, biliyorum. Al, şu kadarını ben veriyorum. Borç değil; borç olursa Pike gibi olurum.')], ['S', Tr('Ahırcıya söyle, Greta yolladı. Kazıklamaz... çok.')]]
          : [['S', Tr('Ahıra git, kendine bir at seç. Ucuzu da olur, iyisi de; ama kendine güvendiğini al.')]];
      },
      start(S) {
        const P = this.player;
        if (this.horse && !this.horse.dead) return;
        const need = HORSE_BREEDS.morgan.p * this.priceMul(true) + 0.5 - P.money;
        if (need > 0) { S.flags.loan = Math.ceil(need); this.earn(S.flags.loan, 'Greta'); }
        const p = this.sDoor(this.sBld('stable'), 22); if (p) this.sullyGo(p.x - 16, p.y);
      },
      steps: [
        { t: () => Tr('Ahırdan bir at satın al'), ev: 'horse', at() { return this.sDoor(this.sBld('stable'), 4); }, wp: true,
          skip() { return !!(this.horse && !this.horse.dead) || !this.sBld('stable'); },
          hint: () => Tr`Ahırda seyisle konuş, <b>At Satın Al</b>'ı seç. Hız, dayanıklılık ve sağlık çubuklarına bak.` },
        { t: () => Tr('Atına bin'), chk() { return this.player.riding && this.player.riding === this.horse; }, at() { return this.horse; },
          skip() { return !this.horse || this.horse.dead; },
          hint: () => Tr`Atına yaklaş ve ${Input.glyph('interact')} ile bin. ${Input.glyph('whistle')} ile çağırabilirsin.`,
          after: () => [['S', Tr('Yakışmış. Bir adı olsun ama; adsız ata kimse güvenmez.')], ['S', Tr('Ben de geliyorum. Anton\'un kirası için değil... Tamam, biraz da onun için.')]] },
      ],
    },
    /* 6 — Posta Arabasıyla: Silver Ridge'e git */
    {
      t: () => Tr('Posta Arabasıyla'),
      talk: () => [['S', Tr('Silver Ridge dağların ardında. Atla günler sürer; posta arabası daha çabuk, at da arkadan bağlı gelir.')], ['S', Tr('Bilet parası benden. Pazarlık edersen bir dahakine sen ısmarlarsın.')]],
      start(S) { S.stageTo = S.mine; this.earn(6, 'Greta'); },
      steps: [
        { t() { return Tr`${this.imMine().n} kasabasına git`; }, chk() { const t = this.world.townAt(this.player.x, this.player.y, 0); return !!(t && t.id === this.story.mine); },
          at() { const t = this.world.townAt(this.player.x, this.player.y, 30), b = t && t.id === this.story.port && (this.sBld('post') || this.sBld('station')); return b ? this.sDoor(b, 4) : this.imMine().spawn; }, wp: true,
          on(S) { const M = this.imMine(); this.sullyGo(M.spawn.x + 24, M.spawn.y + 6, true); },
          hint: () => Tr`Postanede <b>Posta Arabası Bileti</b> al ya da istasyondan trene bin. İstersen atınla da gidebilirsin; ${Input.glyph('map')} Harita'da rota görünür.`,
          done() { const P = this.player, s = this.sSpot(P.x + 26, P.y + 6, 0, 40); this.story.sully = { x: s[0], y: s[1] }; const e = this.mentorEnt(); if (e) { e.x = s[0]; e.y = s[1]; e.mounted = null; } },
          cine: () => ({ sc: 'q_town', lines: [
            ['S', Tr('Şuna bak. Toz, taş ve bir sürü yorgun yüz.')],
            ['P', Tr('Anton burada iki yıl yaşadı.')],
            ['S', Tr('Yaşamak mı? Burada insanlar yaşamaz, {ad}. Borç öder.')],
          ] }) },
      ],
    },
    /* 7 — Maden Kasabası: madende çalış, fener al, eski galeriye in */
    {
      t: () => Tr('Maden Kasabası'),
      start(S) { S.town = S.mine; if (this.hour < 6 || this.hour >= 13) this.sSkipTo(8); },
      talk: () => [['S', Tr('Madencilere soru sorarsan susarlar. Yanlarında kazma sallarsan konuşurlar.')]],
      steps: [
        { t: () => Tr('Madende çalış'), ev: 'work', ok: (j) => j === 'mine', at() { return this.sDoor(this.sBld('mine'), 4); }, wp: true,
          skip() { return !this.sBld('mine'); },
          hint: () => Tr`Maden Ofisi'ne gir ve <b>Madende Çalış</b>'ı seç. Ağır iş: çıktığında yorgun, aç ve susuz olursun.`,
          after: () => [
            ['M', Tr('Anton mu? Uzun boylu, bıyıklı, hep mektup yazan? Pike\'ın defterine yazılanlardandı.')],
            ['M', Tr('Borcu büyüyenleri eski galeriye yollarlar. Orada çalışırsın, kimse görmez, kimse sormaz.')],
            ['P', Tr('Eski galeri nerede?')],
            ['M', Tr('Kasabanın dışında. Fenersiz girme, evlat. Oranın karanlığı insanı yutar.')],
          ] },
        { t: () => Tr('Bir fener al'), ev: 'buy', ok: (d) => !!(d && d.id === 'lantern'), at() { return this.sDoor(this.sBld(['mine', 'general']), 4); },
          skip() { return this.player.has('lantern') || !this.imGallery(); },
          hint: () => Tr`Maden deposunda ya da genel mağazada <b>Fener</b> al.` },
        { t: () => Tr('Terk edilmiş galeriye in'), ev: 'explore', ok(b, S) { return !!b && b.id === S.gallery; }, at() { const g = this.imGallery(); return g ? this.sDoor(g, 4) : null; }, wp: true,
          skip() { return !this.imGallery(); },
          on() { const g = this.imGallery(); if (g) { const p = this.sDoor(g, 30); this.sullyGo(p.x + 30, p.y, true); } },
          hint: () => Tr`Maden ağzının önünde ${Input.glyph('interact')} basılı tut: <b>Madene Gir</b>. Fenerin yanında olmalı.`,
          after: () => [
            ['P', Tr('Duvarda kazınmış harfler var... "A." ve bir tarih. Altında bir çetele: yüzlerce çizgi.')],
            ['S', Tr('Gün saymış. Kaç gün çalıştığını, kaç gün borç ödediğini.')],
            ['S', Tr('Bu çetele burada bitiyor. Ya borcunu ödedi... ya da Pike onu başka yere aldı.')],
          ] },
      ],
    },
    /* 8 — Şirket Dükkânı: Pike'la yüzleş, evinde borç defterini bul, şerife götür */
    {
      t: () => Tr('Şirket Dükkânı'),
      steps: [
        { t: () => Tr('Şirket dükkânına gir'), ev: 'enter', ok(b, S) { return !!b && b.id === S.store; }, at() { const b = this.world.buildings[this.story.store]; return b ? this.sDoor(b, 4) : null; }, wp: true,
          on() { const b = this.world.buildings[this.story.store]; if (b) { const p = this.sDoor(b, 22); this.sullyGo(p.x - 14, p.y); } },
          after: () => [
            ['R', Tr('Hoş geldiniz. Kazma, fener, kahve; hepsi var, hepsi veresiye. Sadece adınızı deftere yazarım.')],
            ['P', Tr('Anton adında birini arıyorum.')],
            ['R', Tr('Anton... Ah, evet. Borçlu. Borçlular sözleşmeyi bitirene kadar şirketin işçisidir. Yasal, tamamen yasal.')],
            ['R', Tr('Borcunu ödemeye mi geldiniz? Kırk iki dolar. Faiziyle elli. Yarın altmış.')],
            ['S', Tr('Gel, {ad}. Burada daha fazla durursam elimdeki şemsiyeyi ona kırarım.')],
          ] },
        { t: () => Tr('Pike\'ın evine gir'), ev: 'enter', ok(b, S) { return !!b && b.id === S.office; }, at() { const b = this.world.buildings[this.story.office]; return b ? this.sDoor(b, 4) : null; },
          skip() { return !this.world.buildings[this.story.office]; },
          talk: () => [
            ['S', Tr('Borç yazan adam defter tutar. Defter dükkânda değilse evindedir.')],
            ['S', Tr('Al şunu. Kocamın maymuncuğu; çilingirdi, rahmetli. Hiç kullanmadım... sayılır.')],
            ['S', Tr('Gece git, kimse görmesin. Başkasının evine girmek suç; ama başkasının hayatını çalmak daha büyük suç.')],
          ],
          on() { const P = this.player; if (!P.has('lockpick')) P.addItem('lockpick', 2, true); },
          hint: () => Tr`Kilitli kapının önünde ${Input.glyph('interact')} ile <b>Maymuncukla Aç</b>. Kimse görmezse suç yazılmaz; gece daha güvenli.` },
        { t: () => Tr('Evi ara: borç defterini bul'), ev: 'search', ok(b, S) { return !!b && b.id === S.office; },
          skip() { return !this.world.buildings[this.story.office]; },
          hint: () => Tr`Evin içindeki masada ${Input.glyph('interact')} basılı tut: <b>Evi Ara</b>.`,
          after: () => [
            ['P', Tr('İşte. "Anton: borç 42 dolar. Ödenen: 57 dolar. Kalan: 38 dolar."')],
            ['P', Tr('Ödedikçe borcu artırmış. Her sayfada aynı hile. Onlarca isim.')],
          ] },
        { t: () => Tr('Borç defterini şerife göster'), ev: 'ledger', at() { return this.sDoor(this.sBld('sheriff'), 4); }, wp: true,
          skip() { return !this.sBld('sheriff'); },
          on() { const p = this.sDoor(this.sBld('sheriff'), 22); if (p) this.sullyGo(p.x - 14, p.y); },
          hint: () => Tr`Şerif ofisine gir, şerifin masasında <b>Borç Defterini Göster</b>'i seç.`,
          after(S) {
            S.campKnown = true; this.storyApplyWorld();
            const cp = this.world.pois.find(p => p.pid === S.camp.pid); if (cp && !this.discovered.has(cp.id)) this.rumored.add(cp.id);
            return [
              ['W', Tr('Bu defter... Pike\'ın el yazısı. Yıllardır şikâyet geliyor ama kanıt yoktu.')],
              ['W', Tr('Kötü haber: dün gece Pike\'ın tuttuğu hak gaspçıları birini {kamp} tarafına götürdü. "Kaçmaya kalkan borçlu" demişler.')],
              ['P', Tr('Anton.')],
              ['W', Tr('Adamım yok, evlat. Pike\'ı yakalayacak adamım bile yok. Ama sen gidersen ben görmezden gelirim.')],
            ];
          } },
      ],
    },
    /* 9 — Hak Gaspçıları: kampı gözetle, ağabeyini kurtar, kasabaya dön */
    {
      t: () => Tr('Hak Gaspçıları'),
      talk(S) {
        const out = [['S', Tr('Ben bu yaşta silah çatışmasına girmem. Ama kenarda durup bağırabilirim; o da bir şeydir.')]];
        if (S.flags.gun) out.push(['S', Tr('Al, kocamın tabancası. Mermisi de var. Kullanmasan iyi olur; ama kullanırsan iyi kullan.')]);
        if (S.flags.lasso) out.push(['S', Tr('Şu kementi ahırcıdan aldım. Adamı vurmaktan iyidir; bağlanan adam mahkemede konuşur.')]);
        return out;
      },
      start(S) {
        const P = this.player;
        if (!this.hasGun()) { P.giveWeapon('cattleman'); P.ammo.pistol = Math.max(P.ammo.pistol || 0, 24); S.flags.gun = 1; }
        if (!P.weapons.has('lasso')) { P.giveWeapon('lasso', true); S.flags.lasso = 1; }
        if (!P.has('binoculars')) P.addItem('binoculars', 1, true);
        S.kin = { x: S.camp.x - 18, y: S.camp.y + 14, tied: true };
        const s = S.site; this.sullyGo(s.x + 30, s.y - 10, true);
      },
      steps: [
        { t: () => Tr('Kampı dürbünle gözetle'), chk() { const S = this.story, C = this.cam; return !!this.binoc && S.camp.x > C.ox && S.camp.x < C.ox + this.vw && S.camp.y > C.oy && S.camp.y < C.oy + this.vh; }, at() { return this.story.camp; }, wp: true,
          hint: () => Tr`Kampa fazla yaklaşmadan ${Input.glyph('satchel')} Çanta'dan <b>Dürbün</b>'ü kullan ve kampa bak.`,
          after: () => [['P', Tr('Anton... ateşin yanında, elleri bağlı. Etrafında silahlı adamlar.')]] },
        { t: () => Tr('Anton\'u kurtar'), ev: 'free', at() { return this.kinEnt() || this.story.kin; },
          hint: () => Tr`Çömelerek yaklaş (${Input.glyph('crouch')}). Nöbetçileri kementle bağla ya da etkisiz hâle getir. Anton'un yanında ${Input.glyph('interact')} basılı tut: <b>İplerini Kes</b>.`,
          after: () => [
            ['K', Tr('{ad}? Sen... Sen burada ne arıyorsun? Sana gelme demiştim!')],
            ['P', Tr('"Ya da gel" de demiştin.')],
            ['K', Tr('...Demiştim, değil mi? Tanrım. Annemin inadı sende kalmış.')],
          ] },
        { t() { return Tr`Anton'la ${this.imMine().n} kasabasına dön`; }, chk() { const t = this.world.townAt(this.player.x, this.player.y, 0); return !!(t && t.id === this.story.mine); }, at() { return this.imMine().spawn; }, wp: true,
          on(S) { const M = this.imMine(); S.kin = { x: M.spawn.x - 20, y: M.spawn.y + 4 }; this.sullyGo(M.spawn.x + 20, M.spawn.y + 4); },
          // Pike bundan sonra eski galeride saklanır (hedef kişi bölüm 10'da orada belirir)
          done(S) { const g = this.imGallery(); if (g) { const p = this.sDoor(g, 26); S.camp = { pid: -1, x: p.x, y: p.y, n: g.name }; } } },
      ],
    },
    /* 10 — Yeni Başlangıç: Pike'ı yakala, teslim et, dükkânı devral */
    {
      t: () => Tr('Yeni Başlangıç'),
      cine() {
        return { sc: 'q_saloon', cast: 'kin', lines: [
          ['K', Tr('İlk yıl iyiydi. Para biriktiriyordum, sana gemi bileti alacaktım.')],
          ['K', Tr('Sonra bir göçük oldu. Ayağım kırıldı; iki ay çalışamadım. Pike "veresiye" dedi. Gülümseyerek.')],
          ['S', Tr('Ve o gülümseme hiç bitmedi.')],
          ['W', Tr('Pike kaçtı. Şirketin maaş sandığını alıp eski galeriye kapanmış; adamlarını bekliyor.')],
          ['K', Tr('Senetler onda. Kasabadaki herkesin senedi. O kâğıtlar varken kimse özgür değil.')],
          ['P', Tr('O zaman kâğıtları alırız.')],
        ], after() { if (this.hour < 7 || this.hour > 17) this.sSkipTo(8); } };
      },
      steps: [
        { t: () => Tr('Pike\'ı etkisiz hâle getir'), chk() { const j = this.rivalEnt(); return !!(j && (j.dead || j.bound)); }, at() { return this.rivalEnt() || this.story.camp; }, wp: true,
          hint: () => Tr`Pike'ı canlı istiyorsan kementi seç (${Input.glyph('wheel')}), ${Input.glyph('fire')} ile at, sonra yaklaşıp ${Input.glyph('interact')} basılı tutarak bağla. ${Input.glyph('deadeye')} ile <b>Odak</b>'ı açmayı unutma.`,
          done() { const j = this.rivalEnt(); this.story.alive = !!(j && !j.dead); } },
        { t: () => Tr('Borç senetlerini Pike\'ın üstünden al'), ev: 'deed', at() { return this.rivalEnt(); }, skip() { return this.story.deed; }, chk() { return this.story.deed; },
          hint: () => Tr`Pike'ın yanında ${Input.glyph('interact')} basılı tut: <b>Senetleri Al</b>.` },
        { t() { return this.story.alive ? Tr('Pike\'ı şerife canlı teslim et') : Tr('Pike\'ın cesedini şerife götür'); }, ev: 'deliver', ok: (e) => e && e.quest === 'rival',
          at() { const j = this.rivalEnt(), P = this.player; if (j && j !== P.carry && !(this.horse && this.horse.load && this.horse.load.includes(j))) return j; return this.sDoor(this.sBld('sheriff'), 4); }, wp: true,
          on(S) { if (S.jack === 'delivered') { const st = this.qStep(); setTimeout(() => { if (this.qStep() === st && !S.wait) this.qDone(); }, 60); } },
          hint: () => Tr`Pike'ı omzuna al (${Input.glyph('interact')}), atının yanında <b>eyere yükle</b> ve şerif ofisinde teslim et.`,
          done() { this.story.jack = 'delivered'; },
          after() {
            const S = this.story, b = this.world.buildings[S.store];
            if (b) { const p = this.sDoor(b, 20); S.kin = { x: p.x + 14, y: p.y }; this.sullyGo(p.x - 14, p.y); }
            return [
              ...(S.alive ? [['W', Tr('Ambrose Pike. Canlı ve tek parça. Mahkeme bunu sevecek.')]] : [['W', Tr('Pike... Mahkemeye çıkamayacak. Ama defteri konuşur.')]]),
              ['W', Tr('Şirket, Pike\'ın dükkânını mahkeme kararıyla borçlandırdığı işçilere bırakıyor. İlk sırada ağabeyin var.')],
              ['W', Tr('Tapu senin adına çıktı; Anton "kardeşim imzalasın" dedi. Dükkâna git, kâğıtlar tezgâhta.')],
            ];
          } },
        { t: () => Tr('Dükkânın tapusunu al'), ev: 'biz', at() { const b = this.world.buildings[this.story.store]; return b ? this.sDoor(b, 4) : null; }, wp: true,
          skip() { const b = this.world.buildings[this.story.store]; return !b || !!this.bizOf(b); },
          hint: () => Tr`Dükkâna gir, tezgâhta <b>Dükkânın Tapusunu Al</b>'ı seç. İşletmen kendi kendine çalışır; gelir kasada birikir.` },
        { t: () => Tr('Anton ile konuş'), ev: 'talk', who: 'kin', at() { return this.kinEnt() || this.story.kin; },
          say: () => [['P', Tr('Senin dükkânın, Anton.')], ['K', Tr('Bizim. Bizim dükkânımız.')]],
          cine: () => ({ sc: 'q_finale', cast: 'kin', cap: { k: Tr('Son'), n: Tr('Ağabeyin Mektupları'), s: '' }, lines: [
            ['K', Tr('Gemiden inince seni iskelede karşılayacaktım. Elimde çiçek, cebimde bilet parası. Öyle hayal etmiştim.')],
            ['P', Tr('Ben de seni kendi dükkânının önünde bulacağımı hayal etmiştim.')],
            ['K', Tr('Eh. Biri tuttu.')],
            ['S', Tr('İkiniz de aynı kafadasınız. Ben Saint Clement\'a dönüyorum; kiracısız pansiyon, kahvesiz sabah gibidir.')],
            ['S', Tr('Kira borcunu da unutmadım, Anton. Ama acele etme. Yeni başlangıçlar ucuz değildir.')],
            ['K', Tr('Annem hep derdi: insan gittiği yere kökünü de götürür. Galiba kökümüz geldi, {ad}.')],
          ] }) },
      ],
    },
  ],
};
STORY_FOR_BG.immigrant = 'immigrant';

/* Göçmen hikâyesinin yardımcıları (Story'ye eklenir) */
Object.assign(Story, {
  imMine() { return this.world.towns.find(t => t.id === this.story.mine); },
  imGallery() { const S = this.story; return S.gallery >= 0 ? this.world.buildings[S.gallery] : null; },
  /* mahkeme kararıyla dükkân oyuncuya geçer; işletmecisi Anton olur */
  imGrantStore(S) {
    const b = this.world.buildings[S.store];
    if (!b) { this.qEvent('biz', null); return; }
    if (!this.bizOf(b)) {
      const B = BIZ[b.type], K = this.storyDef().kin;
      const mgr = { name: K.name.call(this), look: Object.assign({}, K.look, S.kinLook || {}), trait: 'hard' };
      this.biz.push({ bid: b.id, type: b.type, town: b.town, stock: B.goods ? B.cap * 0.5 : 0, cash: 0, mgr, since: this.day, bank: false, total: 0, last: 0 });
      this.stat('businesses', 1);
      Audio_.ui('cash');
      UI.toast(Tr('Dükkân Sizin'), Tr`${b.name} artık senin. Anton işletmeci olarak tezgâhta.`, 'ok');
      this.hintOnce('biz', Tr`İşletmen kendi kendine çalışır; kasada durman gerekmez. Gelir kasada birikir: tezgâha uğrayıp <b>kasayı al</b>. ${B.goods ? Tr`Bu işletme <b>${GOODS[B.goods].n}</b> tüketir: toptancıdan ya da üreticiden alıp getir, stok boşalırsa gelir düşer.` : ''}`, 12);
    }
    this.qEvent('biz', b);
  },
});
