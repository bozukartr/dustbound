'use strict';
/* ==========================================================
   FRONTIER'S END — Kanun Kaçağı'nın hikâyesi: "Son İş"
   Çetenin saklı kampında uyanırsın. Yaşlı tetikçi Hollis Crane
   artık bırakmak istiyor; çete lideri Silas Vance ise son bir büyük
   iş peşinde. Kamp, at, av, maske ve eşkâl, kaçakçı, posta arabası
   soygunu, kanundan kaçış, ödül avcıları, ihanet ve son bir seçim:
   Vance'i kanuna teslim et ya da kendin teslim ol.
   Konuşma satırları: S = Hollis, R = Vance, P = oyuncu, W = şerif,
   ya da doğrudan isim (Dutch).
   ========================================================== */

const HOLLIS_LOOK = { sex: 'm', skin: '#c8946a', hair: '#9a9690', hairStyle: 0, beard: 2, beardLen: 0.5, hat: 'flat', hatCol: '#3a3028', coat: '#4a4038', shirt: '#8a7a64', pants: '#2e2a26', eyes: '#5a4a3a', coatLen: 0.9 };
const VANCE_LOOK = { sex: 'm', skin: '#e2b896', hair: '#1a1410', hairStyle: 1, beard: 1, beardLen: 0.4, hat: 'cowboy', hatCol: '#141210', coat: '#1e1a18', shirt: '#7a1e18', pants: '#22201e', eyes: '#3a4a5a', coatLen: 0.9 };
const HOLLIS_HORSE = { col: '#5a4a3a', mane: '#2a2018', blanket: '#3a4a5a' };
const OUTLAW_JEWELS = ['pocket_watch', 'gold_ring', 'necklace'];

STORIES.outlaw = {
  id: 'outlaw', ach: 'story_outlaw',
  title: () => Tr('Son İş'),
  intro: () => Tr`Çetenin saklı kampında uyandın. Yaşlı tetikçi Hollis Crane artık bırakmak istiyor; lider Silas Vance ise son bir büyük iş peşinde.`,
  outro: () => Tr`Hikâye tamamlandı. Çeteyle hesabın kapandı; artık nereye gideceğine sen karar veriyorsun.`,
  welcome: () => Tr('Çetenin saklı kampındasın. Ateşin başındaki yaşlı adam, <b>Hollis Crane</b>, seninle konuşmak istiyor; sağ üstteki hedefi izle.'),
  mentor: {
    name: 'Hollis Crane', short: 'Hollis', look: HOLLIS_LOOK, horse: HOLLIS_HORSE,
    chatDone: () => [
      Tr('Batı geniş, {ad}. İnsan bir kez olsun arkasına bakmadan yürüyebilmeli.'), Tr('Otuz yıl tetikte uyudum. Şimdi horlamaya başladım, inanabiliyor musun?'),
      Tr('Kahve demlemeyi öğrendim sonunda. Hâlâ kötü ama benim kötüm.'), Tr('Bir gün torunlarına anlatırsın beni. Abartmayı unutma.'),
    ],
    chatBusy: () => [Tr('Konuşmanın sırası değil, evlat. Gözünü dört aç.'), Tr('Sonra, sonra. Önce iş.'), Tr('Bir şey diyecektim... Unuttum. Yaş.')],
  },
  rival: {
    name: () => Tr('Silas Vance'), look: VANCE_LOOK, hp: 160, weapon: 'repeater', money: 6, fromCh: 8, reward: [30, 15],
  },
  setup(S, town) {
    const H = this.hideout || this.findHideout(town);
    S.hideout = { x: H.x, y: H.y };
    // çiftlik yardımcıları (av sürüsü vb.) kampı merkez alır
    S.ranch = { pid: -1, x: H.x, y: H.y + 24, cx: H.x, cy: H.y };
    S.sully = { x: H.x - 26, y: H.y + 8 };
    // Vance'in sonradan gideceği yer: kampa en yakın haydut kampı
    let best = null, bd = 1e9;
    for (const p of this.world.pois) if (p.kind === 'camp') { const d = dist(p.x, p.y, H.x, H.y); if (d > 1100 && d < bd) { bd = d; best = p; } }
    S.camp = best ? { pid: best.pid, id: best.id, x: best.x, y: best.y, n: best.n } : (() => { const s = this.sSpot(H.x + 1800, H.y + 300, 0, 300); return { pid: -1, x: s[0], y: s[1], n: Tr('Vance\'in Kampı') }; })();
    // dörtnala gidilecek tepe
    const R = new RNG((this.seed || 1) + 811);
    for (let k = 0; k < 24 && !S.ridePt; k++) {
      const a = R.range(0, TAU), s = this.findSpawnPos(H.x + Math.cos(a) * 950, H.y + Math.sin(a) * 950, 0, 120);
      if (s && !this.world.townAt(s[0], s[1], 30) && TownPath.walkable([H.x, H.y], s, 6)) S.ridePt = { x: s[0], y: s[1] };
    }
    if (!S.ridePt) { const s = this.sSpot(H.x + 900, H.y, 0, 200); S.ridePt = { x: s[0], y: s[1] }; }
    // pusu yeri: kampa uzak olmayan, kasaba dışında bir ana yol noktası
    let ab = null, abd = 1e9;
    this.world.roads.forEach((r, ri) => {
      if (r.spur || r.pts.length < 16) return;
      for (let i = 8; i < r.pts.length - 8; i += 2) {
        const [x, y] = r.pts[i], d = dist(x, y, H.x, H.y);
        if (d < 700 || d > 3200 || this.world.townAt(x, y, 40)) continue;
        if (Math.abs(d - 1500) < abd) { abd = Math.abs(d - 1500); ab = { ri, pi: i, x, y }; }
      }
    });
    S.ambush = ab || { ri: -1, pi: 0, x: S.ridePt.x, y: S.ridePt.y };
  },
  apply(S) {
    if (S.hideout && !this.hideout) { this.hideout = { x: S.hideout.x, y: S.hideout.y }; this.placeHideout(); }
  },
  poster(S) {
    if (S.ch < 8) return '';
    return `<div class="poster story"><div class="po-w">${Tr`ARANIYOR`}</div><div class="po-n">${Tr('Silas Vance')}</div><div class="po-c">${Tr`Posta soygunu, yol kesme, adam kaçırma`}</div><div class="po-r">${fmtMoney(30)}</div><div class="po-l">${Tr`Canlı teslime tam ödül.`}</div></div>`;
  },
  /* çete: kampta dost üyeler; ihanetten sonra dağılır */
  tick(S) { this.olGangTick(S); this.olWagonTick(S); this.olPosseTick(S); },
  onEvent(type, d, S) {
    // posta arabası işinde ölen olursa Hollis unutmaz
    if (type === 'kill' && d && d.kind === 'npc' && S.ch >= 5 && S.ch <= 6 && !d.hostile) S.flags.blood = (S.flags.blood || 0) + 1;
  },
  mentorActions(e, S, acts) {
    if (S.sully && S.sully.tied) return [{ n: Tr('İplerini Kes'), hold: 0.8, fn: () => { S.sully = { x: e.x, y: e.y }; Audio_.play('rope'); this.qEvent('free', e); } }];
    return acts;
  },
  buildingActions(b, S) {
    const st = this.qStep();
    if (b.type === 'sheriff' && st && st.ev === 'confess' && !S.wait) return [{ icon: '⚖', label: Tr('Teslim Ol ve Hesap Ver'), fn: () => {
      UI.pop(); S.flags.confessed = 1;
      this.surrender({ say: () => {} });
    } }];
    return [];
  },
  finish(S) {
    const P = this.player, L = this.law;
    if (S.choice === 'law') {
      // kanuna yardım eden kaçağın sicili temizlenir
      L.bounty = 0; L.maskBounty = 0; L.desc = null; L.level = 0;
      this.addHonor(8);
      UI.toast(Tr('Sicil Temizlendi'), Tr('Şerif, Vance\'i getirdiğin için başındaki ödülü kaldırdı.'), 'quest');
    } else this.addHonor(5);
    this.earn(8, Tr('Hollis\'in payı'));
    if (!P.weapons.has('schofield')) { P.giveWeapon('schofield'); P.ammo.pistol = Math.min(AMMO.pistol.max, (P.ammo.pistol || 0) + 18); UI.feed(Tr`Hollis'in tabancası artık senin: ${WEAPONS.schofield.n}`); }
    S.sully = null;
  },
  epilogue: (S) => S && S.choice === 'law'
    ? Tr`Hikâye bitti ama hayat sürüyor. Vance parmaklıklar ardında, senin sicilin temiz. Ne yapacağın artık sana kalmış: çalış, avlan, ev kur ya da yeniden yola düş. <b>Hedefin hâlâ 80 yaşına kadar yaşamak.</b>`
    : Tr`Hikâye bitti ama hayat sürüyor. Hesabını verdin, borcun kapandı. Vance hâlâ bir yerlerde; belki bir gün yolunuz yine kesişir. <b>Hedefin hâlâ 80 yaşına kadar yaşamak.</b>`,
  chapters: [
    /* 1 — Kampta Sabah: konuş, pişir, ye, silahını doldur */
    {
      t: () => Tr('Kampta Sabah'),
      start(S) { const P = this.player; P.addItem('raw_game', 2, true); },
      steps: [
        { t: () => Tr('Hollis ile konuş'), ev: 'talk', at() { return this.mentorEnt() || this.story.sully; },
          hint: () => Tr`Ateşin başındaki yaşlı adama yaklaş ve ${Input.glyph('interact')} ile <b>Konuş</b>.`,
          say: () => [
            ['S', Tr('Uyandın demek. Vance\'in çocukları gibi öğlene kadar yatarsın sandım.')],
            ['P', Tr('Vance nerede?')],
            ['S', Tr('Kasabada. "Büyük iş" kokusu almış. Her sene bir büyük iş kokusu alır.')],
            ['S', Tr('Ben otuz yıldır bu ateşin başındayım, {ad}. Kokusunu aldığım tek şey kendi kahvem.')],
            ['S', Tr('Neyse. Çantanda et var, ateş yanıyor. Önce karnını doyur; aç adam yanlış yere ateş eder.')],
          ] },
        { t: () => Tr('Ateşte et pişir'), ev: 'cook', skip() { return !this.player.has('raw_game') && !this.player.has('raw_big'); }, at() { return this.camp; },
          hint: () => Tr`Kamp ateşine yaklaş, ${Input.glyph('interact')} ile <b>Kamp</b> menüsünü aç ve <b>Pişir ve Üret</b>'i seç.` },
        { t: () => Tr('Bir şeyler ye'), ev: 'eat',
          hint: () => Tr`${Input.glyph('satchel')} Çanta'dan pişmiş eti seç ya da ${Input.glyph('quick')} ile atıştır.` },
        { t: () => Tr('Silahını doldur'), ev: 'reload',
          hint: () => Tr`Tabancanı eline al (${Input.glyph('wheel')}) ve ${Input.glyph('reload')} ile doldur.`,
          after: () => [
            ['S', Tr('Silahının kaç mermi aldığını uykunda bileceksin. Saymak zorunda kaldığın gün, geç kalmışsın demektir.')],
            ['S', Tr('Hadi, atına bak. Bu dünyada sana sırtını dönmeyecek tek can o.')],
          ] },
      ],
    },
    /* 2 — Mustang: ıslık, fırçala, bin, dörtnala tepeye ve geri */
    {
      t: () => Tr('Mustang'),
      start(S) { const P = this.player; if (!P.has('horse_brush')) { P.addItem('horse_brush', 1, true); S.flags.brush = 1; } },
      talk: (S) => S.flags.brush ? [['S', Tr('Al şu fırçayı. Atını fırçalamayan adama at da güvenmez, ben de.')]] : [],
      steps: [
        { t: () => Tr('Atını ıslıkla çağır'), ev: 'whistle', hint: () => Tr`${Input.glyph('whistle')} ile atını çağır.` },
        { t: () => Tr('Atını fırçala'), ev: 'brush', at() { return this.horse; },
          hint: () => Tr`Atının yanında ${Input.glyph('interact')} basılı tut ve <b>Fırçala</b>'yı seç. Bağ kurdukça atın daha uysal ve dayanıklı olur.` },
        { t: () => Tr('Atına bin'), chk() { return this.player.riding && this.player.riding === this.horse; }, at() { return this.horse; },
          hint: () => Tr`Atına yaklaş ve ${Input.glyph('interact')} ile bin.`,
          done() { const R = this.story.ridePt; this.sullyGo(R.x + 20, R.y, true); } },
        { t: () => Tr('Hollis\'le tepeye kadar dörtnala git'), chk() { const R = this.story.ridePt, P = this.player; return dist(P.x, P.y, R.x, R.y) < 140; }, at() { return this.story.ridePt; }, wp: true,
          hint: () => Tr`${Input.glyph('sprint')} basılı tutarak dörtnala sür. Atın yorulunca yavaşla, nefeslensin.`,
          cine: () => ({ sc: 'q_ride', lines: [
            ['S', Tr('Bu tepeye ilk çıktığımda senin yaşındaydım. Elimde ödünç bir tabanca, cebimde hiç.')],
            ['P', Tr('Pişman mısın?')],
            ['S', Tr('Pişmanlık lüks, evlat. Yorgunum, o kadar.')],
            ['S', Tr('Bu son kış. Bahar gelince bırakıyorum. Vance bilmiyor; bilmesin de.')],
          ], after() { const H = this.story.hideout; this.sullyGo(H.x - 26, H.y + 8, true); } }) },
        { t: () => Tr('Saklı kampa dön'), chk() { const H = this.story.hideout, P = this.player; return dist(P.x, P.y, H.x, H.y) < 140; }, at() { return this.story.hideout; }, wp: true,
          after: () => [['S', Tr('Erzak bitti. Dutch avlanmayı bilmez, Pete de silahını bile zor tutar. İş yine bize kaldı.')]] },
      ],
    },
    /* 3 — Çetenin Sofrası: av, deri, kampa getir */
    {
      t: () => Tr('Çetenin Sofrası'),
      resume(S) { if (S.st <= 0) this.storyGame(S); },
      steps: [
        { t() { return this.story.game === 'pronghorn' ? Tr('Bir antilop avla') : Tr('Bir geyik avla'); }, ev: 'kill', ok(a, S) { return a.kind === 'animal' && a.type === S.game; },
          on(S) { this.storyGame(S); },
          at() { const P = this.player; let best = null, bd = 1e9; for (const e of this.ents) if (e.storyGame && !e.dead && !e.remove) { const d = dist(e.x, e.y, P.x, P.y); if (d < bd) { bd = d; best = e; } } return best; },
          hint: () => Tr`${Input.glyph('crouch')} ile çömelip rüzgârı arkana almadan yaklaş. ${Input.glyph('aim')} ile nişan al; biraz beklersen elin titremez.` },
        { t: () => Tr('Hayvanın derisini yüz'), ev: 'skin', ok(a, S) { return a.type === S.game; },
          hint: () => Tr`Avın yanında ${Input.glyph('interact')} basılı tut: <b>Derisini Yüz</b>.` },
        { t: () => Tr('Avı kampa getir'), chk() { const H = this.story.hideout, P = this.player; return dist(P.x, P.y, H.x, H.y) < 160; }, at() { return this.story.hideout; }, wp: true,
          after: () => [
            ['Dutch', Tr('Et! Tanrı seni korusun, {ad}. Üç gündür fasulye yiyoruz.')],
            ['S', Tr('Postu sakla, işe yarar. Bu akşam başka bir iş var: fişek bitmek üzere.')],
          ] },
      ],
    },
    /* 4 — Yüzünü Sakla: maske, kasaba, mühimmat, tanınmadan çık */
    {
      t: () => Tr('Yüzünü Sakla'),
      steps: [
        { t: () => Tr('Hollis ile konuş'), ev: 'talk', at() { return this.mentorEnt() || this.story.sully; },
          say: () => [
            ['S', Tr('Kasabaya biri inmeli. Benim yüzüm her duvarda asılı; Vance de "patron kasabaya inmez" diyor.')],
            ['S', Tr('Başında yirmi dolar var. Şerifin adamları yüzüne iki saniye bakarsa tanır.')],
            ['S', Tr('Yolda bandanayı tak. Ama dükkâna girerken çıkar: maskeli adama kimse mal satmaz, şerife koşar.')],
            ['S', Tr('Kanun adamının yanında oyalanma. Al, çık, dön. Tanınırsan dönüp bakma, sür.')],
          ] },
        { t: () => Tr('Bandananı tak'), ev: 'mask', ok: (d) => d === true, skip() { return this.player.masked; },
          hint: () => Tr`${Input.glyph('satchel')} Çanta'dan <b>Bandana</b>'yı seç ya da ${Input.glyph('mask')} ile tak. Maskeliyken işlediğin suçlar senin adına yazılmaz.` },
        { t() { return Tr`${this.sTown().n} kasabasına git`; }, chk() { const t = this.world.townAt(this.player.x, this.player.y, 0); return !!(t && t.id === this.story.town); }, at() { return this.sTown().spawn; }, wp: true },
        { t: () => Tr('Silahçıdan mühimmat al'), ev: 'buy', ok: (d) => !!(d && d.ammo), at() { return this.sDoor(this.sBld(['gunsmith', 'general']), 4); },
          hint: () => Tr`Dükkâna girmeden maskeni çıkar (${Input.glyph('mask')}). İçeride satıcıyla konuş ve <b>Mühimmat</b> al. Kanun adamlarına yaklaşma.` },
        { t: () => Tr('Tanınmadan kasabadan çık'), chk() { return !this.world.townAt(this.player.x, this.player.y, 12) && this.law.level === 0; },
          hint: () => Tr`Kasabadan çık. Tanınırsan ${Input.glyph('sprint')} ile kaç: görüş alanından çıkınca kanun izini kaybeder.` },
        { t: () => Tr('Saklı kampa dön'), chk() { const H = this.story.hideout, P = this.player; return dist(P.x, P.y, H.x, H.y) < 140; }, at() { return this.story.hideout; }, wp: true,
          done() { this.story.flags.vance = 1; } },
      ],
    },
    /* 5 — Kirli Para: Vance döner (gece), kaçakçıya mücevher, terziden yeni şapka */
    {
      t: () => Tr('Kirli Para'),
      cine() {
        return { sc: 'q_fire', cast: 'rival', lines: [
          ['R', Tr('Bak sen. Yaşlı kurt yavruyu kasabaya yollamış, yavru da tanınmadan dönmüş.')],
          ['R', Tr('Yarın sabah bir posta arabası geçecek. Maden şirketinin maaşları içinde.')],
          ['P', Tr('Muhafız var mı?')],
          ['R', Tr('Bir sürücü, bir de korkak. Kimse ölmeyecek, değil mi Hollis? Yaşlandıkça yumuşadı.')],
          ['R', Tr('Önce paraya çevir şu eski işten kalanları. Kaçakçı sorgu sual etmez. Bir de kılık değiştir; eşkâlin kasabanın dilinde.')],
        ], after() { this.sSkipTo(8); const H = this.story.hideout; this.sullyGo(H.x - 26, H.y + 8); } };
      },
      start(S) { const P = this.player; for (const id of ['pocket_watch', 'gold_ring']) P.addItem(id, 1, true); },
      steps: [
        { t: () => Tr('Mücevherleri kaçakçıya sat'), ev: 'sell', ok: (d) => !!(d && d.id && OUTLAW_JEWELS.includes(d.id)), at() { const b = this.olNearest('fence') || this.sBld('general'); return b ? this.sDoor(b, 4) : null; }, wp: true,
          hint: () => Tr`Kaçakçı kasabanın kuytu bir köşesindedir. Maskeyle girebileceğin tek dükkân orası; <b>Sat</b> sekmesinden saati ve yüzüğü sat. Sorgu sual etmez.` },
        { t: () => Tr('Terziden yeni bir şapka ya da palto al'), ev: 'buy', ok: (d) => !!(d && d.id && ITEMS[d.id] && ITEMS[d.id].c === 'clothing' && !ITEMS[d.id].mask), skip() { return !this.olNearest('tailor'); },
          at() { const b = this.olNearest('tailor'); return b ? this.sDoor(b, 4) : null; }, wp: true,
          hint: () => Tr`Şerifin elindeki eşkâl şapkan ve paltondur. Yenisini al, ${Input.glyph('satchel')} Çanta'dan giy: tanınman zorlaşır.` },
        { t: () => Tr('Saklı kampa dön'), chk() { const H = this.story.hideout, P = this.player; return dist(P.x, P.y, H.x, H.y) < 140; }, at() { return this.story.hideout; }, wp: true,
          after: () => [
            ['S', Tr('Vance\'e güvenme, {ad}. Ben güvendim, otuz yıl.')],
            ['S', Tr('Yarın kimse ölmeyecek. Bana söz ver.')],
            ['P', Tr('Söz.')],
          ] },
      ],
    },
    /* 6 — Posta Arabası: pusu, maske, kementle sürücüyü indir, çantayı ara */
    {
      t: () => Tr('Posta Arabası'),
      talk: () => [['S', Tr('Pusu yeri yolun kıvrıldığı yerde. Araba yavaşlar, biz de orada oluruz.')]],
      start(S) { if (this.hour < 7 || this.hour > 16) this.sSkipTo(8); if (!this.player.weapons.has('lasso')) this.player.giveWeapon('lasso', true); },
      steps: [
        { t: () => Tr('Pusu yerine git'), chk() { const A = this.story.ambush, P = this.player; return dist(P.x, P.y, A.x, A.y) < 170; }, at() { return this.story.ambush; }, wp: true,
          on() { const A = this.story.ambush; const s = this.sSpot(A.x + 60, A.y + 50, 0, 60); this.sullyGo(s[0], s[1], true); } },
        { t: () => Tr('Bandananı tak'), ev: 'mask', ok: (d) => d === true, skip() { return this.player.masked; },
          talk: () => [['S', Tr('Yüzünü kapat. Sürücü seni hatırlamasın.')]] },
        { t: () => Tr('Posta arabasını durdur: sürücüyü kementle indir'), chk() { const w = this.olWagon(); return !!(w && !w.driver); },
          at() { return this.olWagon() || this.story.ambush; },
          on(S) { S.wagonT = 0; },
          hint: () => Tr`Kementi seç (${Input.glyph('wheel')}), arabaya nişan al ve ${Input.glyph('fire')} ile at: sürücü yere iner. Ateş etme; Hollis kimsenin ölmesini istemiyor.` },
        { t: () => Tr('Posta çantasını ara'), ev: 'loot', ok: (w) => !!(w && w.storyWagon), at() { return this.olWagon(); },
          hint: () => Tr`Arabanın yanında ${Input.glyph('interact')} basılı tut: <b>Posta Çantasını Ara</b>.`,
          after(S) {
            return S.flags.blood ? [['S', Tr('Söz vermiştin.')], ['S', Tr('...Neyse. Şimdi kaç. Sonra konuşuruz.')]]
              : [['S', Tr('Kimse ölmedi. Otuz yılda ilk kez bir iş temiz bitti.')], ['S', Tr('Şimdi dağıl. Sürücü kasabaya koşuyordur.')]];
          } },
      ],
    },
    /* 7 — Peşimizde: kanunu at, kampa dön; gece Vance payları böler */
    {
      t: () => Tr('Peşimizde'),
      steps: [
        { t: () => Tr('Kanunu peşinden at'), chk() { return this.law.level === 0 && !this.reports.some(r => !r.done); },
          hint: () => Tr`Kanun adamlarının göremeyeceği yerlere sür; ağaçlar ve kayalar seni saklar. Radarın kenarındaki kırmızı alan aranma bölgesidir: dışına çık ve gözden uzak dur.` },
        { t: () => Tr('Saklı kampa dön'), chk() { const H = this.story.hideout, P = this.player; return dist(P.x, P.y, H.x, H.y) < 140; }, at() { return this.story.hideout; }, wp: true,
          cine: () => ({ sc: 'q_fire', cast: 'rival', lines: [
            ['R', Tr('Saydım. İki kere saydım. Yarısı benim, yarısı çetenin.')],
            ['S', Tr('Çete sensin, Silas.')],
            ['R', Tr('Aynen öyle, ihtiyar. Hesap kitap bilmeyenlerin işi değil bu.')],
            ['R', Tr('Bir de şunu duydum: biri bahar gelince bırakacakmış. Kimmiş acaba?')],
            ['S', Tr('Yorgunum, Silas. Hepsi bu.')],
            ['R', Tr('Yorgun adamlar konuşur, Hollis. Konuşan adamlar asılır.')],
          ], after() { this.sSkipTo(9); } }) },
      ],
    },
    /* 8 — Ödül Avcıları: avcılarla başa çık */
    {
      t: () => Tr('Ödül Avcıları'),
      talk: () => [['S', Tr('Başındaki ödül kabardı. Bu tür paralar avcı çeker; kasabanın dışında gözün arkanda olsun.')], ['S', Tr('Dutch\'la erzak almaya gidiyorum. Sen etrafı kolaçan et.')]],
      start(S) { const H = S.hideout; this.sullyGo(H.x + 400, H.y + 300, true); },
      steps: [
        { t: () => Tr('Kamptan uzaklaş ve etrafı kolaçan et'), chk() { const H = this.story.hideout, P = this.player; return dist(P.x, P.y, H.x, H.y) > 500; },
          skip() { return this.law.bounty < 1; } },
        { t: () => Tr('Ödül avcılarıyla başa çık'), posse: true, chk() { const S = this.story; return !!S.flags.posse && !this.posse; },
          skip() { return this.law.bounty < 1; },
          at() { return this.posse && this.posse.ents[0]; },
          hint: () => Tr`Ödül avcıları seni sıkıştırırsa liderin yanına git: ${Input.glyph('interact')} ile <b>parayla kurtulabilir</b>, <b>teslim olabilir</b> ya da çatışabilirsin. Onlara nişan alırsan ateş açarlar.`,
          after: () => [['P', Tr('Avcılar... Birisi nerede olduğumu söylemiş.')]] },
        { t: () => Tr('Saklı kampa dön'), chk() { const H = this.story.hideout, P = this.player; return dist(P.x, P.y, H.x, H.y) < 140; }, at() { return this.story.hideout; }, wp: true,
          done() { this.story.flags.betray = 1; } },
      ],
    },
    /* 9 — İhanet: kamp boş, Hollis Vance'in elinde; gözetle, kurtar */
    {
      t: () => Tr('İhanet'),
      start(S) {
        S.campKnown = true; this.storyApplyWorld();
        const cp = this.world.pois.find(p => p.pid === S.camp.pid); if (cp) this.rumored.add(cp.id);
        S.sully = { x: S.camp.x - 18, y: S.camp.y + 14, tied: true };
        const e = this.mentorEnt(); if (e) e.remove = true;
      },
      talk: () => [
        ['Dutch', Tr('{ad}! Gittiler. Vance, Pete, hepsi.')],
        ['Dutch', Tr('Hollis\'i bağladılar. Vance "ispiyoncu" dedi, avcılara yerini de o vermiş.')],
        ['Dutch', Tr('{kamp} tarafına sürdüler. Ben... ben gelemem. Bacağım.')],
      ],
      steps: [
        { t: () => Tr('Vance\'in kampını dürbünle gözetle'), chk() { const S = this.story, C = this.cam; return !!this.binoc && S.camp.x > C.ox && S.camp.x < C.ox + this.vw && S.camp.y > C.oy && S.camp.y < C.oy + this.vh; }, at() { return this.story.camp; }, wp: true,
          on() { const P = this.player; if (!P.has('binoculars')) P.addItem('binoculars', 1, true); },
          hint: () => Tr`Kampa fazla yaklaşmadan ${Input.glyph('satchel')} Çanta'dan <b>Dürbün</b>'ü kullan ve kampa bak.`,
          after: () => [['P', Tr('Hollis ateşin yanında, bağlı. Vance\'in adamları etrafında.')]] },
        { t: () => Tr('Hollis\'i kurtar'), ev: 'free', at() { return this.mentorEnt() || this.story.sully; },
          hint: () => Tr`Çömelerek yaklaş (${Input.glyph('crouch')}). Nöbetçileri sessizce ya da kementle etkisiz hâle getir. Hollis'in yanında ${Input.glyph('interact')} basılı tut: <b>İplerini Kes</b>.`,
          after: () => [
            ['S', Tr('Geldin. Gelmezsin sanmıştım. Vance de öyle sandı.')],
            ['S', Tr('Avcıları sana o yolladı. Seni satıp benim ağzımı kapatacaktı.')],
          ] },
      ],
    },
    /* 10 — Seçim: Vance'i kanuna teslim et ya da kendin teslim ol */
    {
      t: () => Tr('Seçim'),
      talk: () => [
        ['S', Tr('İki yol var, {ad}. İkisi de seni bu hayattan çıkarır.')],
        ['S', Tr('Vance\'i canlı yakalar şerife götürürsün; şerif onun için seni affeder.')],
        ['S', Tr('Ya da Vance\'i kendi haline bırakırsın; şerife gider, hesabını kendin verirsin. Temiz ama pahalı.')],
        ['S', Tr('Ben senin yerinde olsam... Yok. Bu sefer karar senin.')],
      ],
      steps: [
        { t: () => Tr('Yolunu seç'), choice: () => [
            { k: 'law', n: Tr('Vance\'i yakala, şerife teslim et'), d: Tr('Vance\'i canlı ya da ölü şerife götür. Başındaki ödül silinir.') },
            { k: 'self', n: Tr('Şerife git, teslim ol'), d: Tr('Vance kaçar. Ceza öder ya da hapis yatarsın; sonra borcun kapanır.') },
          ],
          done() { const S = this.story, H = S.hideout; if (S.choice === 'self') { const p = this.sDoor(this.sBld('sheriff'), 22); if (p) this.sullyGo(p.x - 14, p.y); } else this.sullyGo(H.x - 26, H.y + 8, true); } },
        { t: () => Tr('Vance\'i etkisiz hâle getir'), chk() { const j = this.rivalEnt(); return !!(j && (j.dead || j.bound)); }, skip() { return this.story.choice !== 'law'; },
          at() { return this.rivalEnt() || this.story.camp; },
          hint: () => Tr`Vance'i canlı istiyorsan kementi seç ve at, sonra yaklaşıp ${Input.glyph('interact')} basılı tutarak bağla. ${Input.glyph('deadeye')} ile <b>Odak</b>'ı açmayı unutma.`,
          done() { const j = this.rivalEnt(); this.story.alive = !!(j && !j.dead); } },
        { t() { return this.story.alive ? Tr('Vance\'i şerife canlı teslim et') : Tr('Vance\'in cesedini şerife götür'); }, ev: 'deliver', ok: (e) => e && e.quest === 'rival', skip() { return this.story.choice !== 'law'; },
          at() { const j = this.rivalEnt(), P = this.player; if (j && j !== P.carry && !(this.horse && this.horse.load && this.horse.load.includes(j))) return j; return this.sDoor(this.sBld('sheriff'), 4); }, wp: true,
          on(S) { const p = this.sDoor(this.sBld('sheriff'), 22); if (p) this.sullyGo(p.x - 14, p.y); if (S.jack === 'delivered') { const st = this.qStep(); setTimeout(() => { if (this.qStep() === st && !S.wait) this.qDone(); }, 60); } },
          hint: () => Tr`Vance'i omzuna al (${Input.glyph('interact')}), atının yanında <b>eyere yükle</b> ve şerif ofisinde teslim et.`,
          done() { this.story.jack = 'delivered'; },
          after() { return this.story.alive ? [['W', Tr('Silas Vance. Canlı. Bunu kim getirdi dersen inanmazlar.')], ['W', Tr('Başındaki ödülü siliyorum, evlat. Bir daha bu masaya bu taraftan gelme.')]] : [['W', Tr('Vance... Böylesi de bir son. Başındaki ödülü siliyorum; bir daha görmeyeyim seni bu masada.')]]; } },
        { t: () => Tr('Şerif ofisinde teslim ol'), ev: 'confess', chk() { return !!this.story.flags.confessed && this.law.bounty === 0 && !UI.isModal(); }, skip() { return this.story.choice !== 'self'; },
          at() { return this.sDoor(this.sBld('sheriff'), 4); }, wp: true,
          hint: () => Tr`Şerif ofisine gir, şerifin masasında <b>Teslim Ol ve Hesap Ver</b>'i seç. Ceza ödersen serbest kalırsın; ödeyemezsen birkaç gün hapis yatarsın.`,
          after: () => [['W', Tr('Kendi ayağıyla gelen kaçak... Bunu da gördüm ya.')], ['W', Tr('Borcun kapandı. Git, düzgün yaşa.')]] },
        { t: () => Tr('Hollis ile konuş'), ev: 'talk', at() { return this.mentorEnt() || this.story.sully; },
          on(S) { if (S.choice === 'law') { const p = this.sDoor(this.sBld('sheriff'), 22); if (p) this.sullyGo(p.x - 14, p.y); } },
          say: () => [['P', Tr('Bitti, Hollis.')], ['S', Tr('Bitti mi? Yeni başladı, evlat.')]],
          cine: () => ({ sc: 'q_ride', cap: { k: Tr('Son'), n: Tr('Son İş'), s: '' }, lines: [
            ['S', Tr('Otuz yıl bir ateşin başında oturdum, bir sonraki işi bekledim.')],
            ['S', Tr('Şimdi bekleyecek bir şeyim yok. Garip. Hafif.')],
            ['P', Tr('Nereye gideceksin?')],
            ['S', Tr('Batıya. Okyanusu hiç görmedim. Belki balık tutarım; belki balıklar beni tutar.')],
            ['S', Tr('Sen de bir yer bul, {ad}. Bir kapı, bir çit, bir kahve. Benim hiç bulamadığım şeyler.')],
            ['S', Tr('Şu tabancayı al. Bana bir daha lazım olmayacak; sana da olmasın.')],
          ] }) },
      ],
    },
  ],
};
STORY_FOR_BG.outlaw = 'outlaw';

/* Kanun Kaçağı hikâyesinin yardımcıları (Story'ye eklenir) */
Object.assign(Story, {
  /* oyuncuya en yakın, belli türde bir bina (her kasabada olmayabilir) */
  olNearest(type) {
    const P = this.player, types = Array.isArray(type) ? type : [type];
    let best = null, bd = 1e18;
    for (const b of this.world.buildings) if (types.includes(b.type)) { const d = dist2(b.door.x, b.door.y, P.x, P.y); if (d < bd) { bd = d; best = b; } }
    return best;
  },
  /* çete: ihanetten önce kampta dost üyeler; ihanette Dutch yaralı kalır */
  olGangTick(S) {
    const H = S.hideout, P = this.player;
    if (!H) return;
    const near = dist(P.x, P.y, H.x, H.y) < 900;
    const want = !near ? [] : S.ch < 8 && !S.flags.betray ? ['Dutch', 'Pete'].concat(S.flags.vance ? ['Vance'] : []) : S.ch === 8 && S.flags.betray ? ['Dutch'] : [];
    for (const e of this.ents) if (e.gang && !e.remove && !want.includes(e.gang)) e.remove = true;
    for (const [i, k] of want.entries()) {
      if (this.ents.some(e => e.gang === k && !e.remove)) continue;
      const a = 0.8 + i * 1.9, s = this.sSpot(H.x + Math.cos(a) * 34, H.y + 10 + Math.sin(a) * 26, 0, 20);
      const look = k === 'Vance' ? Object.assign({}, VANCE_LOOK) : randomLook('m', new RNG((this.seed || 1) + k.length * 97));
      if (k !== 'Vance') { look.hat = k === 'Dutch' ? 'bowler' : 'cowboy'; }
      const n = new NPC(s[0], s[1], 'gang', { name: k === 'Vance' ? Tr('Silas Vance') : k, look, weapon: k === 'Pete' ? 'shotgun' : 'cattleman', home: { x: H.x, y: H.y + 10, r: 46 }, money: 0.5 });
      n.gang = k; n.keep = true; n.ang = Math.atan2(H.y - n.y, H.x - n.x);
      if (k === 'Dutch' && S.flags.betray) { n.state = 'hurt'; n.hp = 30; }
      this.addEnt(n);
    }
  },
  /* posta arabası: oyuncu pusu yerindeyken yolda belirir; kaçarsa bir sonraki gelir */
  olWagon() { return this.ents.find(e => e.storyWagon && !e.remove) || null; },
  olWagonTick(S) {
    const st = this.qStep();
    let w = this.olWagon();
    const active = S.ch === 5 && st && (st.chk || st.ev === 'loot') && S.st >= 2;
    if (!active) { if (w && S.ch !== 5) w.storyWagon = false; return; }
    const A = S.ambush, P = this.player, road = this.world.roads[A.ri];
    if (w && w.driver && dist(w.x, w.y, A.x, A.y) > 1500) { w.remove = true; w = null; S.wagonT = 6; UI.feed(Tr('Araba kaçtı. Hollis: "Sabret, bir sonraki gelir."'), 'warn'); }
    if (w || !road || dist(P.x, P.y, A.x, A.y) > 700) return;
    if ((S.wagonT = (S.wagonT || 0) - 0.25) > 0) return;
    // pusu yerinin 500 piksel kadar gerisinden, ona doğru gelir
    const dir = chance(0.5) ? 1 : -1, back = Math.max(1, Math.min(road.pts.length - 2, A.pi - dir * 22));
    w = new Wagon(road, back, dir, true);
    w.storyWagon = true; w.keep = true; w.name = Tr('Maden Şirketi Posta Arabası');
    this.addEnt(w);
  },
  /* ödül avcıları: kampın dışına çıkınca bir grup peşine düşer */
  olPosseTick(S) {
    const st = this.qStep();
    if (S.ch !== 7 || !st || !st.posse || S.flags.posse || S.wait) return;
    const P = this.player;
    if (this.posse) { S.flags.posse = 1; return; }
    if (this.world.townAt(P.x, P.y, 60) || this.insideB || UI.isModal()) return;
    if (this.hunterSpawn()) { S.flags.posse = 1; Audio_.chime(); }
  },
});
