'use strict';
/* ==========================================================
   FRONTIER'S END — Tuzakçı'nın hikâyesi: "Babamın Tuzakları"
   Baban altı hafta önce kuzey ormanlarındaki tuzak hattına gitti ve
   dönmedi. Onun eski dostu, kimseyle konuşmayan yaşlı tuzakçı Elias
   Crowe Cedar Falls'a iner. İz okumak, yayla sessiz av, postu tüccara
   satmak, kürk manto ve kamp ateşi, kurt sürüsü, gözetleme tepesi,
   fenerle mağara, babanın kulübesindeki ipuçları, efsanevi boz ayı
   "Yaşlı Kral" ve yaralı babayı eyere yükleyip doktora yetiştirmek.
   Konuşma satırları: S = Elias, K = baban, T = kürk tüccarı (kasap),
   D = doktor, P = oyuncu.
   ========================================================== */

const ELIAS_LOOK = { sex: 'm', skin: '#c8946c', hair: '#b8b0a4', hairStyle: 4, beard: 4, beardLen: 1, hat: 'wide', hatCol: '#4a3a2a', coat: '#5a4430', shirt: '#7a6a52', pants: '#3a3024', eyes: '#5a6a5a', coatLen: 0.9 };
const FATHER_LOOK = { sex: 'm', skin: '#d8a880', hair: '#8a8478', hairStyle: 0, beard: 3, beardLen: 0.8, hat: 'cowboy', hatCol: '#3a2e24', coat: '#4a3a2c', shirt: '#8a5a3a', pants: '#3a3228', eyes: '#5a6a7a', coatLen: 0.9 };
const ELIAS_HORSE = { col: '#5a4a3a', mane: '#2a2018', blanket: '#5a3a2a' };
/* efsanevi boz ayı: sıradan ayıdan iri, dayanıklı ve hırçın */
const OLD_KING = { hp: 700, len: 21, wid: 12, dmg: 30, aggro: 150 };

STORIES.trapper = {
  id: 'trapper', ach: 'story_trapper', rumorCamp: false,
  title: () => Tr('Babamın Tuzakları'),
  intro: () => Tr`Baban altı hafta önce kuzey ormanlarındaki tuzak hattına gitti ve dönmedi. Eski dostu, yaşlı tuzakçı Elias Crowe seni Cedar Falls'ta bekliyor.`,
  outro: () => Tr`Hikâye tamamlandı. Baban eve döndü; Elias'ın kampında iyileşiyor. Kuzey ormanları artık senin de av sahan.`,
  welcome: () => Tr('Cedar Falls\'tasın. Babanın eski dostu, yaşlı tuzakçı <b>Elias Crowe</b> seni kasabada bekliyor; sağ üstteki hedefi izle.'),
  mentor: {
    name: 'Elias Crowe', short: 'Elias', look: ELIAS_LOOK, horse: ELIAS_HORSE,
    place: () => Tr('Elias\'ın Kampı'),
    home(S) { return S.ec; },
    chatDone: () => [
      Tr('Baban yine kalkmaya çalıştı. Bacağına söz geçiremiyor ama ağzına hiç geçiremedi zaten.'), Tr('Kar erken yağacak bu yıl. Kunduzlar setlerini iki kat yüksek yapmış.'),
      Tr('Yaşlı Kral\'ın postunu gördüm kasapta. Yirmi yıl ondan kaçtım; şimdi bir duvarda asılı.'), Tr('Az konuş, çok dinle, {ad}. Orman konuşanı sevmez.'),
    ],
    chatBusy: () => [Tr('Sonra. Orman beklemez.'), Tr('Hm.'), Tr('Az konuş. İz kaybolur.')],
  },
  /* baba: soyadı oyuncununkiyle aynı, görünüşü ona benzer */
  kin: {
    short: () => Tr('Baban'),
    name() { const sn = this.player.name.split(' ').slice(1).join(' '); return Tr('Abel') + (sn ? ' ' + sn : ''); },
    look: FATHER_LOOK,
    chatDone: () => [
      Tr('Elias\'ın yemeği beni öldürmediyse ayı hiç öldüremezdi.'), Tr('Tuzak hattını sana bırakıyorum, {ad}. Bacağım iyileşse de artık senin.'),
      Tr('Annen görse ne derdi? "İkiniz de aynı inatçı keçisiniz" derdi.'), Tr('Bıçağımı bulmuşsun. Onu sakla; benim babamındı, şimdi senin.'),
    ],
    chatBusy: () => [Tr('Sonra, evlat. Önce... şu bacak.'), Tr('Su... biraz su.')],
  },
  speakers: { T: () => Tr('Kürk Tüccarı'), D: () => Tr('Doktor') },
  setup(S, town) {
    const W = this.world, sp = [town.spawn.x, town.spawn.y];
    // babaya benzer: ten ve göz rengi oyuncununki, saçı kırlaşmış
    const L = this.player.look || {};
    S.kinLook = { skin: L.skin || FATHER_LOOK.skin, eyes: L.eyes || FATHER_LOOK.eyes };
    const free = (s, m) => !W.townAt(s[0], s[1], m) && !W.blocked(s[0], s[1], 14);
    // Elias'ın kampı: kasabanın dışında, ormanda, yürüme mesafesinde (kuzeye doğru)
    S.ec = this.trRing(town.cx, town.cy, 950, s => free(s, 10) && this.storyReach(sp, s), -Math.PI / 2) || this.trSpot(town.cx, town.cy - 950);
    S.ranch = { pid: -1, x: S.ec.x, y: S.ec.y + 24, cx: S.ec.x, cy: S.ec.y };
    const away = Math.atan2(S.ec.y - town.cy, S.ec.x - town.cx);
    // geyik sürüsü: kamptan ~620 piksel, kasabadan uzaklaşarak; izler kamptan sürüye
    S.herd = this.trRing(S.ec.x, S.ec.y, 620, s => free(s, 20) && this.storyReach([S.ec.x, S.ec.y], s), away) || this.trSpot(S.ec.x + Math.cos(away) * 620, S.ec.y + Math.sin(away) * 620);
    S.trk = this.trLine(S.ec, S.herd, 5);
    // kuzeyin karlı ormanı: kamp ateşi ve kurtlar
    const snow = (s) => W.biomeAt(s[0], s[1]) === 'SNOW' || W.biomeAt(s[0], s[1]) === 'FOREST';
    S.north = null;
    for (const r of [1700, 2100, 2500, 2900]) {
      S.north = this.trRing(town.cx, town.cy, r, s => W.biomeAt(s[0], s[1]) === 'SNOW' && free(s, 30), -Math.PI / 2, 32);
      if (S.north) break;
    }
    if (!S.north) S.north = this.trRing(town.cx, town.cy, 1800, s => snow(s) && free(s, 30), -Math.PI / 2, 32) || this.trSpot(town.cx, town.cy - 1800);
    // gözetleme tepesi: kuzey kampına en yakın tepe
    let lk = null, bd = 1e12;
    for (const p of W.pois) if (p.type === 'lookout') { const d = dist(p.x, p.y, S.north.x, S.north.y); if (d < bd) { bd = d; lk = p; } }
    S.look = lk ? { id: lk.id, x: lk.x, y: lk.y + 20, n: lk.n } : Object.assign(this.trSpot(S.north.x + 900, S.north.y - 300), { id: null, n: Tr('Sisli Zirve') });
    // Ayı İni: kasabaya en yakın mağara
    let cb = null; bd = 1e12;
    for (const b of W.buildings) if (b.type === 'mineentrance' && b.cave) { const d = dist(b.door.x, b.door.y, town.cx, town.cy); if (d < bd) { bd = d; cb = b; } }
    let cp = null; bd = 1e12;
    if (cb) for (const p of W.pois) if (p.type === 'cave') { const d = dist(p.x, p.y, cb.door.x, cb.door.y); if (d < bd) { bd = d; cp = p; } }
    S.cave = cb ? { bid: cb.id, x: cb.door.x, y: cb.door.y + 16, n: cb.name, poi: cp ? cp.id : null } : Object.assign(this.trSpot(town.cx - 1400, town.cy - 900), { bid: -1, n: Tr('Ayı İni'), poi: null });
    // babanın kulübesi: mağaradan ~800 piksel ötede; ayının izleri kulübeden vadiye
    const out = Math.atan2(S.cave.y - town.cy, S.cave.x - town.cx);
    S.fc = this.trRing(S.cave.x, S.cave.y, 800, s => free(s, 30) && !W.blocked(s[0], s[1], 26) && this.storyReach([S.cave.x, S.cave.y], s), out) || this.trSpot(S.cave.x + Math.cos(out) * 800, S.cave.y + Math.sin(out) * 800);
    S.den = this.trRing(S.fc.x, S.fc.y, 680, s => free(s, 30) && dist(s[0], s[1], S.cave.x, S.cave.y) > 600 && this.storyReach([S.fc.x, S.fc.y], s), out + 0.9) || this.trSpot(S.fc.x + Math.cos(out + 0.9) * 680, S.fc.y + Math.sin(out + 0.9) * 680);
    S.btrail = this.trLine(S.fc, S.den, 5);
    const fp = this.sSpot(S.den.x + 70, S.den.y + 40, 0, 40);
    S.fp = { x: Math.round(fp[0]), y: Math.round(fp[1]) };
    const ms = this.sSpot(town.spawn.x + 34, town.spawn.y + 6, 0, 40);
    S.sully = { x: ms[0], y: ms[1] };
    S.biome = this.storyBiome(S.ec.x, S.ec.y);
  },
  apply(S) {
    const W = this.world;
    if (S.ec && !W.pois.some(p => p.id === 'eliascamp')) W.pois.push({ id: 'eliascamp', pid: -79, kind: 'trappercamp', x: S.ec.x, y: S.ec.y, tx: (S.ec.x / TS) | 0, ty: (S.ec.y / TS) | 0, n: Tr('Elias\'ın Kampı'), desc: Tr('Yaşlı tuzakçı Elias Crowe\'un orman kenarındaki kampı. Kurutma çerçeveleri, bir çadır ve hiç sönmeyen bir ateş.') });
    this.discovered.add('eliascamp');
    if (S.fcKnown && S.fc && !W.pois.some(p => p.id === 'fathercabin')) {
      W.pois.push({ id: 'fathercabin', pid: -80, kind: 'fathercabin', x: S.fc.x, y: S.fc.y, tx: (S.fc.x / TS) | 0, ty: (S.fc.y / TS) | 0, n: Tr('Babanın Kulübesi'), desc: Tr('Babanın kuzey ormanındaki tuzak kulübesi. Elias\'la birlikte yapmışlar.') });
      if (!this.discovered.has('fathercabin')) this.rumored.add('fathercabin');
    }
    if (S.caveKnown && S.cave.poi && !this.discovered.has(S.cave.poi)) this.rumored.add(S.cave.poi);
  },
  tick(S) { this.trSync(S); this.trWard(S); },
  onEvent(type, d, S) {
    // yaydan başka bir şeyle vurulan geyik: Elias söylenir, sürü sonra yeniden belirir
    if (type === 'kill' && d && d.storyDeer && d.how !== 'arrow' && S.ch === 1 && !S.flags.notBow) { S.flags.notBow = 1; this.qSay([['S', Tr('Yayla dedim. Silah sesi bütün ormanı uyandırır; bir dahaki sürüde okunu kullan.')]]); }
    if (type === 'kill' && d && d.legend) S.flags.bear = 1;
  },
  propActions(e, S) {
    const st = this.qStep();
    if (e.trKey && e.trKey.startsWith('clue') && st && st.ev === 'clue' && !S.wait) {
      const i = e.ci;
      if ((S.clues || []).includes(i)) return [];
      return [{ n: Tr('İncele'), hold: 1, fn: () => {
        (S.clues = S.clues || []).push(i);
        Audio_.ui('pick');
        const txt = [
          Tr('Babanın günlüğü. Son sayfa: "Yaşlı Kral tuzak hattını üç kez bozdu. Peşine düşüyorum. İzleri doğudaki vadiye iniyor."'),
          Tr('Bir kurt kapanı, çeneleri kopmuş. Bunu ancak bir ayının pençesi koparır.'),
          Tr('Kapının önünde iri pençe izleri. Kulübenin etrafını dolaşıp vadiye inmişler. Eski değil; iki üç günlük.'),
        ][i];
        UI.subtitle(this.player.name, txt, 5, true);
        this.qEvent('clue', e);
      } }];
    }
    return [];
  },
  npcActions(e, S) {
    if (e.quest !== 'ward') return null;
    const st = this.qStep();
    if (st && st.ev === 'bandage' && !S.wait) return [{ n: Tr('Yarasını Sar'), hold: 1.2, fn: () => {
      const P = this.player;
      if (!P.has('bandage')) { UI.feed(Tr('Sargı bezin yok. Elias\'tan iste ya da doktordan al.'), 'warn'); return; }
      P.removeItem('bandage', 1); S.flags.band = 1; this.addHonor(1);
      Audio_.play('rope'); this.qEvent('bandage', e);
    } }];
    if (!S.flags.band) return [{ n: Tr('Konuş'), fn: () => { UI.subtitle(e.name, Tr('Bacağım... Ama yaşıyorum, evlat. Yaşıyorum.'), 3.5); Bubbles.add(e, '', 3.5, true); } }];
    return null;   // sarıldıktan sonra: Omzuna Al (eyere yükle)
  },
  /* yaralı baba omuzdayken doktorun kapısında ya da içinde */
  carryActions(e, S) {
    if (e.quest !== 'ward') return [];
    const P = this.player, b = this.world.buildingAtPx(P.x, P.y), doc = this.sBld('doctor');
    if ((b && b.type === 'doctor') || (doc && dist(P.x, P.y, doc.door.x, doc.door.y) < 70)) return [{ n: Tr('Babanı Doktora Teslim Et'), fn: () => this.trDeliver({ e, h: null }) }];
    return [];
  },
  buildingActions(b, S) {
    const st = this.qStep();
    if (!st || S.wait || st.ev !== 'doctor' || b.type !== 'doctor') return [];
    const it = this.carriedAll().find(x => x.e.quest === 'ward');
    if (!it) return [];
    return [{ icon: '✚', label: Tr('Babanı Doktora Teslim Et'), fn: () => { UI.closeAll(); this.trDeliver(it); } }];
  },
  finish(S) {
    this.earn(10, Tr('Elias\'ın birikimi'));
    this.addHonor(6);
    S.kin = { x: S.ec.x + 28, y: S.ec.y + 14 };
    this.sullyGo(S.ec.x - 24, S.ec.y + 8);
    setTimeout(() => UI.help(Tr('Postlar kasaba kasaplarında ve tuzakçılarda iyi para eder. <b>Kusursuz</b> postlar için hayvanı tek atışta, yayla ya da tüfekle başından vur; av becerin arttıkça daha çok post çıkarırsın.'), 12), 17000);
  },
  epilogue: () => Tr`Hikâye bitti ama hayat sürüyor. Baban Elias'ın kampında iyileşiyor; tuzak hattı artık senin. Avlanmak, kürk ticareti yapmak, kasabaya yerleşmek ya da başka yollara düşmek senin elinde. <b>Hedefin hâlâ 80 yaşına kadar yaşamak.</b>`,
  chapters: [
    /* 1 — İz: Elias ile tanış, kampına yürü, çömelip izleri oku */
    {
      t: () => Tr('İz'),
      start() { setTimeout(() => UI.help(Tr`Baban altı hafta önce tuzak hattına gitti ve dönmedi. Kasabaya inen yaşlı tuzakçı <b>Elias Crowe</b> onun en eski dostu; konuşmayı pek sevmez.`, 10), 600); },
      steps: [
        { t: () => Tr('Elias Crowe ile konuş'), ev: 'talk', at() { return this.mentorEnt() || this.story.sully; },
          hint: () => Tr`Kürk mantolu yaşlı adama yaklaş ve ${Input.glyph('interact')} ile <b>Konuş</b>.`,
          say: () => [
            ['S', Tr('Abel\'in çocuğu. Yürüyüşünden tanıdım; o da yere bakmadan yürür.')],
            ['P', Tr('Babamdan haber var mı?')],
            ['S', Tr('Yok. Altı hafta. Tuzak hattı on günlük iştir; Abel hiç geç kalmazdı.')],
            ['S', Tr('Kasabada beklemekle bulunmaz. Ormanı okumayı öğreneceksin. Baban sana öğretti mi?')],
            ['P', Tr('Biraz. Yeterince değil.')],
            ['S', Tr('Yeterince değil. Gel, kampım kasabanın dışında.')],
          ],
          done() { const E = this.story.ec; this.sullyGo(E.x - 24, E.y + 6); } },
        { t: () => Tr('Elias\'ın kampına git'), chk() { const E = this.story.ec, P = this.player; return dist(P.x, P.y, E.x, E.y) < 140; }, at() { return this.story.ec; }, wp: true,
          hint: () => Tr`Kamp haritada işaretli. Elias önden yürür; atına binebilirsin.`,
          after: () => [
            ['S', Tr('Burası. Çadır, ateş, kurutma çerçevesi. Fazlası insanı yavaşlatır.')],
            ['S', Tr('Şu yere bak. Ne görüyorsun?')],
            ['P', Tr('Toprak.')],
            ['S', Tr('Çömel. Gözünü yere yaklaştır. Toprak konuşur, ama fısıldar.')],
          ] },
        { t: () => Tr('Çömel ve geyik izlerini oku'), n: 5,
          chk() { const S = this.story, P = this.player, p = S.trk[S.ti || 0]; if (p && P.crouch && dist(P.x, P.y, p.x, p.y) < 44) { S.ti = (S.ti || 0) + 1; Audio_.tone(520, 0.06, 'triangle', 0.04); } else if (p && !P.crouch && dist(P.x, P.y, p.x, p.y) < 30 && !S.flags.crouchTip) { S.flags.crouchTip = 1; UI.feed(Tr('Ayakta izleri seçemiyorsun. Çömel.'), 'warn'); } if (S.n !== (S.ti || 0)) { S.n = S.ti || 0; this.questHud(); } return (S.ti || 0) >= S.trk.length; },
          on(S) { S.ti = S.ti || 0; },
          at() { const S = this.story; return S.trk[Math.min(S.ti || 0, S.trk.length - 1)]; },
          hint: () => Tr`${Input.glyph('crouch')} ile çömel ve yerdeki izlerin üstüne yürü. Ayaktayken izleri okuyamazsın; her iz bir sonrakini gösterir.`,
          after: () => [
            ['S', Tr('Üç geyik. Biri yaşlı dişi, topallıyor; ikisi genç. Yarım saat önce geçtiler.')],
            ['P', Tr('Bunu topraktan mı okudun?')],
            ['S', Tr('Sen de okudun. Yalnızca adını koymadın.')],
          ] },
      ],
    },
    /* 2 — Yay: sürüye sessizce yaklaş, yayla avla, derisini yüz */
    {
      t: () => Tr('Yay'),
      talk: () => [
        ['S', Tr('Tüfek avcıyı tembel yapar. Yay sabır ister; sabır da ormanın dilidir.')],
        ['S', Tr('Rüzgâr yüzüne essin, kokun arkada kalsın. Çömel, yavaş yürü. Yayı tam ger, nefesini tut, sonra bırak.')],
      ],
      start(S) {
        const P = this.player;
        if (!P.weapons.has('bow')) { P.giveWeapon('bow', true); S.flags.bow = 1; }
        P.ammo.arrow = Math.max(P.ammo.arrow || 0, 12);
        const H = S.herd; this.sullyGo(lerp(S.ec.x, H.x, 0.55), lerp(S.ec.y, H.y, 0.55));
      },
      steps: [
        { t: () => Tr('Sürüye sessizce yaklaş'), chk() { const H = this.story.herd, P = this.player; return dist(P.x, P.y, H.x, H.y) < 240; }, at() { return this.story.herd; },
          hint: () => Tr`${Input.glyph('crouch')} ile çömel: daha az ses çıkarırsın, geyikler seni geç fark eder. Atını geride bırak.` },
        { t: () => Tr('Bir geyiği yayla avla'), ev: 'kill', ok: (a) => !!(a && a.storyDeer && a.how === 'arrow'),
          at() { const P = this.player; let best = null, bd = 1e9; for (const e of this.ents) if (e.storyDeer && !e.dead && !e.remove) { const d = dist(e.x, e.y, P.x, P.y); if (d < bd) { bd = d; best = e; } } return best || this.story.herd; },
          hint: () => Tr`${Input.glyph('wheel')} Silah Çarkı'ndan <b>Yay</b>'ı seç. ${Input.glyph('fire')} basılı tutarak yayı ger, bırakınca ok uçar; tam gerilmiş yay daha uzağa ve sert atar.` },
        { t: () => Tr('Geyiğin derisini yüz'), ev: 'skin', ok: (a) => !!(a && a.type === 'deer'),
          at() { return this.ents.find(e => e.storyDeer && e.dead && !e.skinned && !e.remove) || null; },
          hint: () => Tr`Avın yanında ${Input.glyph('interact')} basılı tut: <b>Derisini Yüz</b>. Geyik derisi büyüktür; omzuna alınır ya da <b>eyere yüklenir</b>.`,
          after: () => [
            ['S', Tr('Temiz atış. Hayvan acı çekmedi; ormanın tek kuralı bu.')],
            ['S', Tr('Postu Cedar Falls\'taki kasap dükkânına götür. Kasap kürk de alır; baban da hep ona satardı.')],
          ] },
      ],
    },
    /* 3 — Post Ticareti: postu kasabın tüccarına sat, babanın son izini öğren */
    {
      t: () => Tr('Post Ticareti'),
      talk: () => [['S', Tr('Tüccar ilk fiyatı düşük söyler. Söylesin. Sen postun değerini bil, yeter.')]],
      start(S) { this.sullyGo(S.ec.x - 24, S.ec.y + 6); },
      steps: [
        { t: () => Tr('Postu Cedar Falls\'taki kasapta sat'), ev: 'sell', ok: (d) => !!(d && (d.carried || d.all || (d.id && ITEMS[d.id] && ITEMS[d.id].c === 'animal'))), at() { return this.sDoor(this.sBld('butcher') || this.sBld('general'), 4); }, wp: true,
          skip() { return !this.storyHasGoods(); },
          hint: () => Tr`Postu kasap dükkânına götür. Dükkânın içinde ${Input.glyph('interact')} ile <b>Getirdiğin Avı Sat</b>; eyerdeki yük de atın kapıdaysa satılır. Dükkânlar 22:00 – 06:00 arası kapalıdır.`,
          after: () => [
            ['T', Tr('Abel\'in çocuğu musun? Postu babanınki gibi temiz yüzülmüş.')],
            ['T', Tr('Son gelişinde kuzeye, Ayı İni tarafına gideceğini söyledi. "Yaşlı Kral yine hattımı bozuyor" dedi.')],
            ['P', Tr('Yaşlı Kral kim?')],
            ['T', Tr('Kim değil, ne. Bu ormanın en yaşlı boz ayısı. Elias\'a sor; ondan iyi bilen yok.')],
          ] },
        { t: () => Tr('Elias\'ın kampına dön'), chk() { const E = this.story.ec, P = this.player; return dist(P.x, P.y, E.x, E.y) < 140; }, at() { return this.story.ec; }, wp: true,
          after: () => [
            ['P', Tr('Tüccar Yaşlı Kral\'dan söz etti.')],
            ['S', Tr('...Etti demek.')],
            ['S', Tr('Yirmi yıldır bu ormanda. İki tuzakçı onun yüzünden topal, biri mezarda. Baban onu hep rahat bırakırdı.')],
            ['S', Tr('Kuzeye çıkacağız. Ama o mantoyla değil; orada gece insanın nefesi donar.')],
          ] },
      ],
    },
    /* 4 — Kış Geliyor: kürk manto, kuzeyin soğuğu, kamp ateşi */
    {
      t: () => Tr('Kış Geliyor'),
      cine() {
        return { sc: 'q_dawn', lines: [
          ['S', Tr('Gece kırağı düştü. Kış erken geliyor bu yıl.')],
          ['S', Tr('Baban kuzeyde, karın altında bir yerde. Ölü ya da diri, bulacağız.')],
          ['P', Tr('Diri.')],
          ['S', Tr('...Diri. Öyle de.')],
        ], after() { if (this.hour < 7 || this.hour > 14) this.sSkipTo(8); } };
      },
      talk: (S) => [['S', S.flags.coatCash ? Tr('Al. Babanın bende alacağı vardı; bu onun parası. Terziden kürk manto al, koyun postu kuzeyde işe yaramaz.') : Tr('Terziden kürk manto al. Koyun postu kuzeyde işe yaramaz.')]],
      start(S) {
        const P = this.player;
        if (!P.has('coat_fur')) { const need = Math.ceil(this.buyPrice('coat_fur') + 0.5 - P.money); if (need > 0) { this.earn(need, 'Elias'); S.flags.coatCash = 1; } }
        if (!P.has('raw_game') && !P.has('raw_big')) P.addItem('raw_game', 1, true);
      },
      steps: [
        { t: () => Tr('Terziden kürk manto al'), ev: 'buy', ok: (d) => !!(d && d.id === 'coat_fur'), at() { return this.sDoor(this.sBld('tailor') || this.sBld('general'), 4); }, wp: true,
          skip() { return this.player.has('coat_fur'); },
          hint: () => Tr`Cedar Falls terzisinde <b>Alışveriş</b>'ten <b>Kürk Manto</b>'yu al.` },
        { t: () => Tr('Kürk mantoyu giy'), chk() { return this.player.coat === 'coat_fur'; },
          hint: () => Tr`${Input.glyph('satchel')} Çanta'da mantoyu seç ve <b>Giy</b>. Manto soğukta vücut ısını korur.`,
          done() { const N = this.story.north; this.sullyGo(N.x + 28, N.y - 8, true); } },
        { t: () => Tr('Elias\'la kuzeyin karlı ormanına git'), chk() { const N = this.story.north, P = this.player; return dist(P.x, P.y, N.x, N.y) < 160; }, at() { return this.story.north; }, wp: true,
          talk: () => [['S', Tr('Atına bin, arkamdan gel. Kuzeyde yol yok; ağaçların arasından gideriz.')]],
          hint: () => Tr`Elias'ın ardından sür. Soğuk arttıkça ekranın kenarı buz tutar; mantoyu çıkarma.`,
          after: () => [['P', Tr('Nefesim buhar oldu. Parmaklarımı hissetmiyorum.')], ['S', Tr('Güneş batmadan kamp kur. Karanlıkta ateş yakmayı öğrenmek istemezsin.')]] },
        { t: () => Tr('Kamp kur'), ev: 'camp',
          hint: () => Tr`${Input.glyph('camp')} basılı tutarak kamp kur. Kamp ateşinin yanında soğuk sana işlemez.`,
          after: () => [['S', Tr('İyi. Ateşe yakın otur; ama botların yanmasın. Baban bir kış iki çift bot yaktı.')]] },
        { t: () => Tr('Ateşte et pişir'), ev: 'cook', skip() { return !this.player.has('raw_game') && !this.player.has('raw_big') && !this.player.has('raw_bird'); },
          hint: () => Tr`Kamp menüsünde <b>Pişir ve Üret</b>: sıcak yemek soğuğa karşı vücudunu ısıtır.`,
          after: () => [['S', Tr('Ye. Soğukta aç kalan adam iki kere üşür.')]] },
      ],
    },
    /* 5 — Kurt Sürüsü: gece kampa sokulan kurtlar, sabaha kadar uyku */
    {
      t: () => Tr('Kurt Sürüsü'),
      cine() {
        return { sc: 'q_fire', lines: [
          ['S', Tr('Baban ve ben bu ormana aynı kış geldik. İkimiz de on yedi yaşındaydık, ikimiz de aptaldık.')],
          ['S', Tr('İlk kışımızda bir kurt sürüsü kampımızı sardı. Abel ateşten bir odun kaptı ve bağırdı. Kurtlar kaçtı.')],
          ['P', Tr('Babam mı? Bağırmak mı?')],
          ['S', Tr('Bir kere. Sonra yirmi yıl sesini yükseltmedi.')],
          ['S', Tr('...Şşt. Duydun mu?')],
        ], after() { this.sSkipTo(22, 21); } };
      },
      talk: (S) => S.flags.gun ? [['S', Tr('Kurtlar! Al şu tüfeği, babanın eski tüfeği. Bende kalmıştı. Ateşin ışığından ayrılma!')]] : [['S', Tr('Kurtlar! Ateşin ışığından ayrılma; ışığın dışında onlar görür, sen görmezsin.')]],
      start(S) {
        const P = this.player;
        if (!this.hasGun()) { P.giveWeapon('repeater', true); S.flags.gun = 1; }
        P.ammo.repeater = Math.max(P.ammo.repeater || 0, 30);
        const c = this.camp || this.story.north; S.wc = { x: Math.round(c.x), y: Math.round(c.y) };
        this.trWolves(S);
      },
      resume(S) { if (S.st === 0) { if (!S.wc) S.wc = { x: S.north.x, y: S.north.y }; this.trWolves(S); } },
      steps: [
        { t: () => Tr('Kurt sürüsünü püskürt'), n: 3, chk() { const S = this.story, n = this.trWolfCount(); if (n !== S.n) { S.n = n; this.questHud(); } return n >= 3; },
          at() { const c = this.story.wc; let best = null, bd = 1e9; for (const e of this.ents) if (e.storyWolf && !e.dead && !e.remove) { const d = dist(e.x, e.y, c.x, c.y); if (d < bd) { bd = d; best = e; } } return best; },
          hint: () => Tr`${Input.glyph('aim')} ile nişan al, ${Input.glyph('fire')} ile ateş et. Kurtlar sürü hâlinde saldırır: sırtını ateşe ver, biri yaklaşınca geri çekil.`,
          after: () => [['S', Tr('Gittiler. Üç kurt; ama sürü beşti. Ötekiler sabahı bekleyecek.')], ['S', Tr('Uyu. Nöbeti ben tutarım; zaten yaşlı adam uyumaz, dinlenir.')]] },
        { t: () => Tr('Sabaha kadar uyu'), ev: 'sleep',
          hint: () => Tr`Kamp menüsünde <b>Uyu</b> → <b>Sabaha Kadar</b>. Uyurken oyun kaydedilir.`,
          after: () => [['S', Tr('Gün doğdu. Şu tepeyi görüyor musun? Sisli olanı. Oradan bütün orman görünür.')]] },
      ],
    },
    /* 6 — Gözetleme Tepesi: tepeye tırman, haritayı aç, dürbünle ormanı gözetle */
    {
      t: () => Tr('Gözetleme Tepesi'),
      talk: () => [['S', Tr('Baban kayboldu diye ormanı karış karış aramayız; ömrümüz yetmez. Önce yukarıdan bakarız.')]],
      start(S) {
        const P = this.player;
        if (!P.has('binoculars')) { P.addItem('binoculars', 1, true); S.flags.binoc = 1; }
        const L = S.look; this.sullyGo(L.x - 30, L.y + 20, true);
      },
      steps: [
        { t() { return Tr`${this.story.look.n} tepesine çık`; }, chk() { const L = this.story.look, P = this.player; return dist(P.x, P.y, L.x, L.y) < 100; }, at() { return this.story.look; }, wp: true,
          hint: () => Tr`Tepenin zirvesine kadar sür. Gözetleme noktalarından bakınca haritanın geniş bir kısmı açılır.`,
          done() {
            const L = this.story.look;
            this.revealAt(L.x, L.y, 1400);
            if (L.id && !this.discovered.has(L.id)) { this.discovered.add(L.id); this.skillXp('survival', 8); }
          },
          after: () => [['P', Tr('Bütün orman ayaklarımın altında. Haritam artık bomboş değil.')]] },
        { t: () => Tr('Dürbünle ormanı gözetle'), chk() { const B = this.binoc; return !!(B && Math.hypot(B.x, B.y) > 200); },
          hint: () => Tr`${Input.glyph('satchel')} Çanta'dan <b>Dürbün</b>'ü kullan ve uzaklara bak: ağaçların arasında hareket eden, parlayan bir şey ara.`,
          done() { const S = this.story; S.caveKnown = true; this.storyApplyWorld(); },
          after: () => [
            ['P', Tr('Orada, kayalıkların dibinde... bir mağara ağzı. Önünde bir şey parlıyor.')],
            ['S', Tr('Ayı İni. Baban hep fenerini yanında taşırdı; camı güneşi tutar.')],
            ['S', Tr('Mağara haritanda. Gidelim.')],
          ] },
      ],
    },
    /* 7 — Mağara: fenerle Ayı İni'ne in, babanın bıçağını ve notunu bul */
    {
      t: () => Tr('Mağara'),
      talk: (S) => S.flags.lantern ? [['S', Tr('İçerisi zifiri karanlık. Al, benim fenerim. Yağı az; oyalanma.')]] : [['S', Tr('İçerisi zifiri karanlık. Fenerin var, iyi. Yağını kontrol et.')]],
      start(S) {
        const P = this.player;
        if (!P.has('lantern')) { P.addItem('lantern', 1, true); S.flags.lantern = 1; }
        const C = S.cave; this.sullyGo(C.x + 40, C.y + 20, true);
      },
      steps: [
        { t() { return Tr`${this.story.cave.n} mağarasına git`; }, chk() { const C = this.story.cave, P = this.player; return dist(P.x, P.y, C.x, C.y) < 140; }, at() { return this.story.cave; }, wp: true,
          after: () => [['S', Tr('Kemikler... taze değil. Ayı burayı çoktan bırakmış.')], ['S', Tr('Ama bir insan buraya girmiş. Şu ayak izine bak: sağ topuğu içe basıyor. Abel.')]] },
        { t: () => Tr('Fenerle mağarayı keşfet'), ev: 'explore', ok(b) { return !!(b && b.id === this.story.cave.bid); }, at() { return this.story.cave; },
          skip() { return this.story.cave.bid < 0; },
          hint: () => Tr`Mağara ağzında ${Input.glyph('interact')} basılı tut: <b>Madene Gir</b>. Fenerin çantanda olmalı.`,
          after: () => [
            ['P', Tr('Babamın bıçağı... Kabzasına bir kâğıt sıkıştırılmış.')],
            ['P', Tr('"Kim bulursa: kulübeme dönüyorum. Ayı peşimde. — A."')],
            ['S', Tr('Kulübesi kuzeydoğuda. Birlikte yapmıştık; çatısı hâlâ benim hatam yüzünden akar.')],
          ],
          done() { const S = this.story; S.fcKnown = true; this.storyApplyWorld(); } },
      ],
      end(S) { if (!S.fcKnown) { S.fcKnown = true; this.storyApplyWorld(); } },
    },
    /* 8 — Babanın Kulübesi: kulübeye git, üç ipucunu incele */
    {
      t: () => Tr('Babanın Kulübesi'),
      talk: () => [['S', Tr('Kulübeye gidelim. Bir şey bulursan dokunmadan önce bak; iz bozulur.')]],
      start(S) { const F = S.fc; this.sullyGo(F.x - 46, F.y + 22, true); S.clues = S.clues || []; },
      steps: [
        { t: () => Tr('Babanın kulübesine git'), chk() { const F = this.story.fc, P = this.player; return dist(P.x, P.y, F.x, F.y) < 120; }, at() { return this.story.fc; }, wp: true,
          after: () => [['P', Tr('Kapı açık. Ocak soğuk. Günlerdir kimse yok.')], ['S', Tr('Etrafa bak. Baban iz bırakmadan bir yere gitmez.')]] },
        { t: () => Tr('Kulübede ipuçlarını incele'), n: 3, ev: 'clue',
          at() { const S = this.story, e = this.ents.find(x => x.trKey && x.trKey.startsWith('clue') && !(S.clues || []).includes(x.ci) && !x.remove); return e || S.fc; },
          hint: () => Tr`Kulübenin çevresindeki şeylerin yanında ${Input.glyph('interact')} basılı tut: <b>İncele</b>. Üç ipucu var.`,
          after: () => [
            ['S', Tr('Günlük, kopmuş kapan, pençe izi. Yaşlı Kral hattı bozmuş; baban da onu durdurmaya kalkmış.')],
            ['S', Tr('Yirmi yıl dedim ya; o ayı yirmi yıldır kimseden korkmadı.')],
            ['P', Tr('Babam ölmedi, Elias. İzler vadiye iniyor; ben de iniyorum.')],
            ['S', Tr('...Biliyorum. Ben de geliyorum.')],
          ] },
      ],
    },
    /* 9 — Boz Ayı: izleri vadiye sür, Yaşlı Kral'ı avla, babanı bul */
    {
      t: () => Tr('Boz Ayı'),
      cine() {
        return { sc: 'q_dawn', lines: [
          ['S', Tr('Yaşlı Kral. Ayakta durunca iki adam boyunda. Sol kulağı yırtık; bir tuzakçının hatırası.')],
          ['S', Tr('Ona tek atışla yaklaşamazsın. Uzaktan vur, geri çekil, yeniden vur. Kaçarsan seni koşarak yakalar.')],
          ['P', Tr('Ya babam?')],
          ['S', Tr('Ayı bir yeri koruyorsa, orada ya yiyeceği vardır ya da düşmanı. Dua et ki ikincisidir.')],
        ], after() { if (this.hour > 14 || this.hour < 5) this.sSkipTo(7); } };
      },
      start(S) {
        const P = this.player;
        if (!this.hasGun()) { P.giveWeapon('repeater', true); S.flags.gun = 1; }
        P.ammo.repeater = Math.max(P.ammo.repeater || 0, 30); P.ammo.arrow = Math.max(P.ammo.arrow || 0, 12);
        S.bi = S.bi || 0; const F = S.fc; this.sullyGo(F.x + 20, F.y + 30);
      },
      steps: [
        { t: () => Tr('Ayının izlerini sür'), n: 5,
          chk() { const S = this.story, P = this.player, p = S.btrail[S.bi || 0]; if (p && dist(P.x, P.y, p.x, p.y) < 80) { S.bi = (S.bi || 0) + 1; Audio_.tone(440, 0.06, 'triangle', 0.04); } if (S.n !== (S.bi || 0)) { S.n = S.bi || 0; this.questHud(); } return (S.bi || 0) >= S.btrail.length; },
          at() { const S = this.story; return S.btrail[Math.min(S.bi || 0, S.btrail.length - 1)]; }, wp: true,
          hint: () => Tr`Yerdeki iri pençe izlerini izle. Ayıya yaklaşırken çömelirsen seni geç fark eder.`,
          done() { const D = this.story.den; this.sullyGo(D.x - 260, D.y + 60); } },
        { t: () => Tr('Yaşlı Kral\'ı avla'), ev: 'kill', ok: (a) => !!(a && a.legend),
          at() { return this.ents.find(e => e.legend && !e.dead && !e.remove) || this.story.den; },
          hint: () => Tr`Uzaktan ateş et ve mesafeni koru. Nişan alırken ${Input.glyph('deadeye')} ile <b>Odak</b>'ı aç; zaman yavaşlar. Yaraladıkça ayı daha da hırçınlaşır.`,
          after: () => [
            ['S', Tr('...Bitti. Yirmi yıl. Bitti.')],
            ['P', Tr('Duydun mu? Şuradan... biri inliyor.')],
          ] },
        { t: () => Tr('Sesin geldiği yere bak'), chk() { const F = this.story.fp, P = this.player; return dist(P.x, P.y, F.x, F.y) < 70; }, at() { return this.story.fp; },
          after: () => [
            ['K', Tr('{ad}? ...Sen misin? Rüya görüyorum sandım.')],
            ['P', Tr('Benim, baba. Buradayım.')],
            ['K', Tr('Kral beni kayalardan aşağı attı. Bacağım... Dört gündür kar suyu ve kuru etle bekliyorum.')],
            ['K', Tr('Ayıyı sen mi...? Hah. Annen görse inanmazdı.')],
            ['S', Tr('Abel, ihtiyar keçi. Konuşma, kanını harcama.')],
          ] },
      ],
    },
    /* 10 — Eve Dönüş: yarayı sar, babanı eyere yükle, doktora yetiştir */
    {
      t: () => Tr('Eve Dönüş'),
      talk: (S) => [['S', S.flags.bandGiven ? Tr('Bacağı kırık, yarası açık. Al şu sargı bezini; sar, sonra atına yükle. Cedar Falls\'taki doktor onu kurtarır.') : Tr('Bacağı kırık, yarası açık. Sar, sonra atına yükle. Cedar Falls\'taki doktor onu kurtarır.')]],
      start(S) { const P = this.player; if (!P.has('bandage')) { P.addItem('bandage', 1, true); S.flags.bandGiven = 1; } },
      steps: [
        { t: () => Tr('Babanın yarasını sar'), ev: 'bandage', at() { return this.trWardEnt() || this.story.fp; },
          hint: () => Tr`Babanın yanında ${Input.glyph('interact')} basılı tut: <b>Yarasını Sar</b>.`,
          after: () => [['K', Tr('Ahh... Elias\'tan daha iyi sarıyorsun. O beni bir keresinde ağaca bağlamıştı.')], ['S', Tr('Kanaması durdu. Hadi, atına.')]] },
        { t: () => Tr('Babanı atının eyerine yükle'), chk() { return this.trWardHeld() > 0; }, at() { const w = this.trWardEnt(), P = this.player; return P.carry && P.carry.quest === 'ward' ? this.horse : w || this.horse; },
          hint: () => Tr`Babanın yanında ${Input.glyph('interact')} ile <b>Omzuna Al</b>. Atın uzaktaysa ${Input.glyph('whistle')} ile çağır, yanındayken <b>Atına Yükle</b>.`,
          done() { const b = this.sBld('doctor'), p = b && this.sDoor(b, 22); if (p) this.sullyGo(p.x + 20, p.y, true); },
          after: () => [['S', Tr('Yavaş sür; her sarsıntıda bacağı acır. Ama durma da. Ben önden giderim.')]] },
        { t: () => Tr('Babanı Cedar Falls doktoruna yetiştir'), ev: 'doctor',
          at() { const w = this.trWardEnt(); return w || this.sDoor(this.sBld('doctor'), 4); }, wp: true,
          hint: () => Tr`Doktorun kapısında atından in. Babanı omzunda içeri taşı ya da atın kapıdayken doktorun menüsünde <b>Babanı Doktora Teslim Et</b>'i seç.`,
          after: () => [
            ['D', Tr('Kırık temiz; yara da iyi sarılmış. Kim sardıysa bacağını o kurtardı.')],
            ['D', Tr('Bir ay yatacak. Sonra bastonla yürür. Sonra da, tanıdığım kadarıyla, yine ormana kaçar.')],
          ],
          cine: () => ({ sc: 'q_finale', cast: 'kin', cap: { k: Tr('Son'), n: Tr('Babamın Tuzakları'), s: '' }, lines: [
            ['K', Tr('Altı hafta. Seni beklerken her gece aynı şeyi düşündüm: "Çocuk iz okumayı bilmiyor."')],
            ['P', Tr('Elias öğretti.')],
            ['K', Tr('Elias mı? Yirmi yıldır bana iki cümleden fazla kurmadı.')],
            ['S', Tr('Sana kurmadım. Ona kurdum.')],
            ['K', Tr('Tuzak hattı artık senin, {ad}. Ben kulübede oturup sana akıl veririm; dinlemezsin, ben de söylenirim.')],
            ['P', Tr('Anlaştık, baba.')],
          ] }) },
      ],
    },
  ],
};
STORY_FOR_BG.trapper = 'trapper';

/* Tuzakçı hikâyesinin yardımcıları (Story'ye eklenir) */
Object.assign(Story, {
  /* cx, cy merkezli r yarıçaplı halkada (tercih edilen yön a0'dan başlayarak) ok() koşulunu sağlayan açık bir nokta */
  trRing(cx, cy, r, ok, a0 = 0, n = 24) {
    for (const rr of [r, r * 0.85, r * 1.15, r * 0.7, r * 1.3]) for (let k = 0; k < n; k++) {
      const a = a0 + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * TAU / n, s = this.findSpawnPos(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, 0, 50);
      if (s && ok(s)) return { x: Math.round(s[0]), y: Math.round(s[1]) };
    }
    return null;
  },
  trSpot(x, y) { const s = this.sSpot(x, y, 0, 160); return { x: Math.round(s[0]), y: Math.round(s[1]) }; },
  /* iki nokta arasında n iz noktası */
  trLine(a, b, n) {
    const out = [];
    for (let k = 1; k <= n; k++) {
      const f = k / (n + 1), x = lerp(a.x, b.x, f), y = lerp(a.y, b.y, f), s = this.findSpawnPos(x, y, 0, 40) || [x, y];
      out.push({ x: Math.round(s[0]), y: Math.round(s[1]) });
    }
    return out;
  },
  /* kurtlar: gece kampı sarar */
  trWolves(S) {
    const c = S.wc;
    for (const e of this.ents) if (e.storyWolf) e.remove = true;
    S.wolfGone = S.wolfGone || 0;
    for (let k = S.wolfGone; k < 3; k++) {
      const a = k / 3 * TAU + rnd(-0.4, 0.4), s = this.sSpot(c.x + Math.cos(a) * 250, c.y + Math.sin(a) * 250, 0, 60);
      const w = new Animal(s[0], s[1], 'wolf'); w.storyWolf = true; w.keep = true; w.state = 'attack'; w.t = 30; w.home = { x: c.x, y: c.y, r: 200 };
      w.ang = Math.atan2(c.y - w.y, c.x - w.x);
      this.addEnt(w);
    }
  },
  /* vurulan, kaçan ya da kaybolan kurtlar */
  trWolfCount() {
    const S = this.story, c = S.wc;
    let gone = S.wolfGone || 0;
    for (const e of this.ents) if (e.storyWolf && !e.counted && (e.dead || e.remove || dist(e.x, e.y, c.x, c.y) > 700)) { e.counted = true; e.keep = false; gone++; }
    S.wolfGone = Math.min(3, gone);
    return S.wolfGone;
  },
  /* geyik sürüsü: yoksa ya da kaybolduysa sürünün yerinde yeniden */
  trHerd(S) {
    const P = this.player, H = S.herd, live = this.ents.filter(e => e.storyDeer && !e.dead && !e.remove);
    if (live.length && live.some(e => dist(e.x, e.y, P.x, P.y) < 1400)) return;
    // ilk sürü oyuncu yaklaşınca belirir; kaybolan sürü, oyuncu sürünün yerinden uzaktayken yenilenir
    const d = dist(P.x, P.y, H.x, H.y);
    if (d > 900 || (d < 260 && S.flags.herd)) return;
    S.flags.herd = 1;
    for (const e of live) e.remove = true;
    let lead = null;
    for (let k = 0; k < 3; k++) {
      let s = this.sSpot(H.x + rnd(-30, 30), H.y + rnd(-30, 30), 0, 50);
      if (!TownPath.walkable([H.x, H.y], s, 5)) s = [H.x + k * 8, H.y];
      const g = new Animal(s[0], s[1], 'deer'); g.storyDeer = true; g.keep = true; g.home = { x: H.x, y: H.y, r: 90 };
      if (lead) g.leader = lead; else lead = g;
      this.addEnt(g);
    }
  },
  /* yaralı baba: yerde, omuzda ya da eyerde */
  trWardEnt() { return this.ents.find(e => e.quest === 'ward' && !e.remove) || null; },
  trWardHeld() { const P = this.player, h = this.horse; return (P.carry && P.carry.quest === 'ward' ? 1 : 0) + (h && h.load ? h.load.filter(e => e.quest === 'ward').length : 0); },
  trWard(S) {
    if (S.ch < 8 || !S.flags.bear || S.flags.doc) return;
    if (S.ch === 8 && S.st < 2) return;
    const w = this.trWardEnt();
    if (w) { w.state = 'downed'; w.downT = 9999; w.hp = Math.max(w.hp, 30); w.mounted = null; S.wx = Math.round(w.x); S.wy = Math.round(w.y); return; }
    const P = this.player, h = this.horse;
    const held = P.carry && P.carry.quest === 'ward' ? P.carry : h && h.load ? h.load.find(e => e.quest === 'ward') : null;
    if (held) { held.state = 'downed'; held.downT = 9999; return; }
    // kayıttan dönüşte ya da yük kaybolduysa bırakıldığı yerde yeniden
    const x = S.wx || S.fp.x, y = S.wy || S.fp.y;
    if (dist(P.x, P.y, x, y) > 900) return;
    const K = this.storyDef().kin;
    const e = new NPC(x, y, 'gang', { name: K.name.call(this), look: Object.assign({}, K.look, S.kinLook || {}), money: 0 });
    e.quest = 'ward'; e.keep = true; e.weapon = null; e.state = 'downed'; e.downT = 9999; e.hp = 40; e.ang = rnd(-Math.PI, Math.PI);
    this.addEnt(e);
  },
  trDeliver(it) {
    const S = this.story;
    this.takeCarried(it);
    S.flags.doc = 1;
    Audio_.ui('pick');
    this.qEvent('doctor', it.e);
  },
  /* kamp, izler, kulübe ve ipuçları, sürü ve Yaşlı Kral: oyuncu yakınken dünyada belirir */
  trSync(S) {
    const P = this.player, want = [], near = (p, r = 900) => p && dist(P.x, P.y, p.x, p.y) < r;
    const E = S.ec;
    if (near(E)) {
      want.push({ k: 'fire', x: E.x, y: E.y, t: 'fire' });
      want.push({ k: 'tent', x: E.x - 38, y: E.y - 28, t: 'tent', col: '#8a7a5a' });
      want.push({ k: 'rack', x: E.x + 34, y: E.y - 18, t: 'rack' });
      want.push({ k: 'log', x: E.x + 4, y: E.y + 22, t: 'log' });
    }
    if (S.ch === 0 && S.trk) S.trk.forEach((p, i) => { if (i >= (S.ti || 0) - 1 && near(p, 700)) { const q = S.trk[i + 1] || S.herd; want.push({ k: 'trk' + i, x: p.x, y: p.y, t: 'paw', ang: Math.atan2(q.y - p.y, q.x - p.x) }); } });
    if (S.ch === 8 && S.btrail) S.btrail.forEach((p, i) => { if (i >= (S.bi || 0) - 1 && near(p, 700)) { const q = S.btrail[i + 1] || S.den; want.push({ k: 'btk' + i, x: p.x, y: p.y, t: 'paw', big: true, ang: Math.atan2(q.y - p.y, q.x - p.x) }); } });
    if (S.ch >= 7 && S.fc && near(S.fc)) {
      const F = S.fc, snow = this.world.biomeAt(F.x, F.y) === 'SNOW';
      want.push({ k: 'shack', x: F.x, y: F.y - 30, t: 'shack', col: snow ? 'snow' : '' });
      want.push({ k: 'ash', x: F.x + 34, y: F.y + 4, t: 'ash' });
      want.push({ k: 'frack', x: F.x - 36, y: F.y - 20, t: 'rack' });
      if (S.ch === 7) {
        want.push({ k: 'clue0', x: F.x - 20, y: F.y + 6, t: 'note', act: true, ci: 0, label: Tr('Babanın Günlüğü') });
        want.push({ k: 'clue1', x: F.x + 44, y: F.y - 26, t: 'trap', act: true, ci: 1, label: Tr('Kırık Kapan') });
        want.push({ k: 'clue2', x: F.x + 6, y: F.y + 28, t: 'paw', big: true, ang: 0.6, act: true, ci: 2, label: Tr('Pençe İzleri') });
      }
    }
    const keys = new Set(want.map(w => w.k));
    for (const e of this.ents) if (e.trKey && !e.remove && !keys.has(e.trKey)) e.remove = true;
    for (const w of want) {
      if (this.ents.some(e => e.trKey === w.k && !e.remove)) continue;
      const e = new Prop(w.x, w.y, w.t, { col: w.col, ang: w.ang || 0 });
      e.big = !!w.big;
      if (w.act) { e.storyAct = true; e.label = w.label; e.ci = w.ci; }
      e.trKey = w.k; e.keep = true;
      this.addEnt(e);
    }
    // geyik sürüsü (bölüm 2, avlanana kadar)
    if (S.ch === 1 && S.st <= 1) this.trHerd(S);
    // Yaşlı Kral: izler bitince vadide
    if (S.ch === 8 && S.st >= 1 && !S.flags.bear && near(S.den, 800) && !this.ents.some(e => e.legend && !e.remove)) {
      const s = this.sSpot(S.den.x, S.den.y, 0, 50), b = new Animal(s[0], s[1], 'bear');
      b.def = Object.assign({}, ANIMALS.bear, OLD_KING, { n: Tr('Yaşlı Kral') });
      b.hp = b.maxHp = OLD_KING.hp; b.legend = true; b.keep = true; b.male = true; b.home = { x: S.den.x, y: S.den.y, r: 80 };
      b.ang = Math.atan2(P.y - b.y, P.x - b.x);
      this.addEnt(b);
    }
  },
});
