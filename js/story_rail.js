'use strict';
/* ==========================================================
   FRONTIER'S END — Demiryolu İşçisi'nin hikâyesi: "Raylar ve Toz"
   Fort Mercy dışındaki ray kampında ustabaşı Walt Boone'un ekibindesin.
   İşçilerin maaşı her ay biraz daha "kayboluyor". Ray döşeme, kazma ve
   dinamit, tren, travers taşıma, maaş günü ve banka, soyulan maaş
   sandığı ve tanık, şirketin yük arabası, nal izleri, kanyondaki sığınak
   ve şerifin masası. Hedef kişi şirketin maaş memuru Cyrus Hale.
   Konuşma satırları: S = Boone, R = Hale, D = arabacı, P = oyuncu,
   W = şerif, B = barmen, ya da doğrudan isim (Mick, Sven).
   ========================================================== */

const BOONE_LOOK = { sex: 'm', skin: '#c89870', hair: '#8a8680', hairStyle: 0, beard: 1, beardLen: 0.6, hat: 'flat', hatCol: '#3a3a3e', coat: '#5a3a28', shirt: '#a8a090', pants: '#3a3a44', eyes: '#4a5a6a', coatLen: 0 };
const HALE_LOOK = { sex: 'm', skin: '#ecc8a8', hair: '#3a2a1e', hairStyle: 1, beard: 0, beardLen: 0, hat: 'bowler', hatCol: '#2a2420', coat: '#3a3046', shirt: '#e8e4dc', pants: '#2a2630', eyes: '#5a5a4a', coatLen: 0.7 };
const BOONE_HORSE = { col: '#6a4a2a', mane: '#2a1a10', blanket: '#5a5a3a' };
const RAIL_CREW = ['Mick', 'Sven', 'Tomas'];

STORIES.rail = {
  id: 'rail', ach: 'story_rail',
  title: () => Tr('Raylar ve Toz'),
  intro: () => Tr`Fort Mercy dışındaki ray kampında ustabaşı Walt Boone'un ekibindesin. İşçilerin maaşı her ay biraz daha "kayboluyor".`,
  outro: () => Tr`Hikâye tamamlandı. Maaş sandığı ekibe döndü; şirketin yük arabası artık senin.`,
  welcome: () => Tr('Fort Mercy\'desin. Ray ekibinin ustabaşı <b>Walt Boone</b> seni kasabada bekliyor; sağ üstteki hedefi izle.'),
  mentor: {
    name: 'Walt Boone', short: 'Boone', look: BOONE_LOOK, horse: BOONE_HORSE, work: 'rail',
    place: () => Tr('Ray Kampı'),
    home(S) { return S.rc; },
    chatDone: () => [
      Tr('Raylar batıya uzuyor, {ad}. Bir gün o trene binip bu kampı pencereden göreceğiz.'), Tr('Mick yine kahveyi yaktı. Bazı şeyler hiç değişmez.'),
      Tr('Ekip seni soruyor. "Ustabaşı ne zaman gelir?" diyorlar. Sana diyorlar, bana değil.'), Tr('Dinamiti dikkatli kullan. Ben iki parmağımı bu işe verdim; sen verme.'),
    ],
    chatBusy: () => [Tr('Sonra, evlat. Raylar kendi kendine döşenmiyor.'), Tr('Bir şey mi lazım? Söyle, ama kısa söyle.'), Tr('Akşam ateşin başında konuşuruz.')],
  },
  speakers: { D: () => Tr('Arabacı') },
  rival: {
    name: () => Tr('Cyrus Hale'), look: HALE_LOOK, hp: 130, weapon: 'cattleman', money: 10, fromCh: 8, reward: [25, 12],
  },
  setup(S, town) {
    const W = this.world;
    // ray kampı: kasabadan çıkan rayın yanında, kasabaya yürüme mesafesinde
    let best = null, bs = 1e9;
    for (const line of W.rails || []) for (let i = 0; i < line.length; i += 2) {
      const [x, y] = line[i], d = dist(x, y, town.cx, town.cy);
      if (d < 700 || d > 1500 || W.townAt(x, y, 12)) continue;   // kenar payı karo cinsinden
      const sc = Math.abs(d - 1000);
      if (sc >= bs) continue;
      const [nx, ny] = line[Math.min(line.length - 1, i + 2)], a = Math.atan2(ny - y, nx - x) + Math.PI / 2;
      for (const sd of [1, -1]) {
        const s = this.findSpawnPos(x + Math.cos(a) * 70 * sd, y + Math.sin(a) * 70 * sd, 0, 30);
        if (s && !W.blocked(s[0], s[1], 20) && !W.townAt(s[0], s[1], 10) && this.storyReach([town.spawn.x, town.spawn.y], s)) { best = { x: s[0], y: s[1], line, i }; bs = sc; break; }
      }
    }
    if (!best) { const s = this.sSpot(town.cx + 1000, town.cy + 200, 0, 200); best = { x: s[0], y: s[1], line: null, i: 0 }; }
    S.rc = { x: Math.round(best.x), y: Math.round(best.y) };
    S.ranch = { pid: -1, x: S.rc.x, y: S.rc.y + 24, cx: S.rc.x, cy: S.rc.y };
    // heyelan: kamptan rayı izleyerek kasabanın ters yönünde ~420 piksel
    S.slide = null;
    if (best.line) {
      const L = best.line, dt = dist(L[0][0], L[0][1], town.cx, town.cy) < dist(L[L.length - 1][0], L[L.length - 1][1], town.cx, town.cy) ? 1 : -1;
      let acc = 0;
      for (let i = best.i; i > 0 && i < L.length - 1; i += dt) { acc += dist(L[i][0], L[i][1], L[i + dt][0], L[i + dt][1]); if (acc > 420) { S.slide = { x: Math.round(L[i][0]), y: Math.round(L[i][1]) }; break; } }
    }
    if (!S.slide) { const s = this.sSpot(S.rc.x + 420, S.rc.y, 0, 60); S.slide = { x: s[0], y: s[1] }; }
    // küçük kayalar büyükten uzakta: patlama onları götürmez, kazmayla tek tek kırılır
    S.rocks = [[-56, -12], [54, 14], [-8, 50]].map(([dx, dy]) => ({ x: S.slide.x + dx, y: S.slide.y + dy, gone: false })).concat([{ x: S.slide.x + 2, y: S.slide.y - 2, big: true, gone: false }]);
    // traverslerin kesildiği yer: kampa ulaşılabilen bir düzlük
    S.cut = null;
    for (let k = 0; k < 24 && !S.cut; k++) {
      const a = k / 24 * TAU, s = this.findSpawnPos(S.rc.x + Math.cos(a) * 460, S.rc.y + Math.sin(a) * 460, 0, 60);
      if (s && !W.townAt(s[0], s[1], 6) && dist(s[0], s[1], S.slide.x, S.slide.y) > 250 && this.storyReach([S.rc.x, S.rc.y], s)) S.cut = { x: Math.round(s[0]), y: Math.round(s[1]) };
    }
    if (!S.cut) { const s = this.sSpot(S.rc.x - 400, S.rc.y + 200, 0, 80); S.cut = { x: s[0], y: s[1] }; }
    // tren yolculuğu: istasyonu ve oteli olan en yakın kasaba (Hale orada kalır)
    const dests = W.towns.filter(t => t !== town && t.station).sort((a, b) => dist(a.cx, a.cy, town.cx, town.cy) - dist(b.cx, b.cy, town.cx, town.cy));
    const dest = dests.find(t => t.buildings.some(b => b.type === 'hotel')) || dests[0] || W.towns.find(t => t !== town);
    S.dest = dest.id;
    const hb = dest.buildings.find(b => b.type === 'hotel') || dest.buildings.find(b => b.type === 'saloon') || dest.buildings[0];
    S.hotel = hb ? hb.id : -1;
    // banka: kampa en yakın banka
    let bk = null, bd = 1e12;
    for (const b of W.buildings) if (b.type === 'bank') { const d = dist(b.door.x, b.door.y, S.rc.x, S.rc.y); if (d < bd) { bd = d; bk = b; } }
    S.bank = bk ? bk.id : -1;
    // soygun yeri: kasabayla kamp arasında, kasabanın dışında
    let rb = null;
    for (const f of [0.55, 0.45, 0.65, 0.35]) {
      const s = this.findSpawnPos(lerp(town.spawn.x, S.rc.x, f), lerp(town.spawn.y, S.rc.y, f), 0, 60);
      if (s && !W.townAt(s[0], s[1], 3)) { rb = s; break; }
    }
    if (!rb) rb = this.sSpot(lerp(town.spawn.x, S.rc.x, 0.6), lerp(town.spawn.y, S.rc.y, 0.6), 0, 120);
    S.rob = { x: Math.round(rb[0]), y: Math.round(rb[1]) };
    // haydutların sığınağı: soygun yerine en yakın haydut kampı (kasabadan uzakta)
    let cp = null; bd = 1e12;
    for (const p of W.pois) if (p.kind === 'camp') { const d = dist(p.x, p.y, S.rob.x, S.rob.y); if (d > 1100 && dist(p.x, p.y, town.cx, town.cy) > 1200 && d < bd) { bd = d; cp = p; } }
    S.camp = cp ? { pid: cp.pid, id: cp.id, x: cp.x, y: cp.y, n: cp.n } : (() => { const s = this.sSpot(S.rob.x + 1600, S.rob.y - 600, 0, 300); return { pid: -1, x: s[0], y: s[1], n: Tr('Kanyondaki Sığınak') }; })();
    S.site = this.storySite(S.camp, town);
    // nal izleri: soygun yerinden sığınağı gören tepeye
    S.trail = [];
    for (let k = 1; k <= 6; k++) {
      const f = k / 6, s = this.findSpawnPos(lerp(S.rob.x, S.site.x, f), lerp(S.rob.y, S.site.y, f), 0, 50) || [lerp(S.rob.x, S.site.x, f), lerp(S.rob.y, S.site.y, f)];
      S.trail.push({ x: Math.round(s[0]), y: Math.round(s[1]) });
    }
    const sp = this.sSpot(town.spawn.x + 34, town.spawn.y + 6, 0, 40);
    S.sully = { x: sp[0], y: sp[1] };
  },
  apply(S) {
    const W = this.world;
    if (S.rc && !W.pois.some(p => p.id === 'railcamp')) W.pois.push({ id: 'railcamp', pid: -78, kind: 'railcamp', x: S.rc.x, y: S.rc.y, tx: (S.rc.x / TS) | 0, ty: (S.rc.y / TS) | 0, n: Tr('Ray Kampı'), desc: Tr('Walt Boone\'un ray ekibinin kampı. Çadırlar, ateş ve bitmeyen çekiç sesi.') });
    this.discovered.add('railcamp');
  },
  poster(S) {
    if (S.ch < 8) return '';
    return `<div class="poster story"><div class="po-w">${Tr`ARANIYOR`}</div><div class="po-n">${Tr('Cyrus Hale')}</div><div class="po-c">${Tr`Maaş sandığı soygunu, sahtekârlık`}</div><div class="po-r">${fmtMoney(25)}</div><div class="po-l">${Tr`Canlı teslime tam ödül.`}</div></div>`;
  },
  rumor() {
    UI.info(Tr('Barmen Fısıldıyor'), `<p class="quote">${this.sFmt(Tr('"Maaş arabası mı? Dün gece dört atlı geçti buradan, atları köpük içinde. Biri ötekilere emir veriyordu; şehirli konuşuyordu, kovboy gibi değil. {kamp} tarafına sürdüler. Ben bir şey söylemedim."'))}</p><p>${this.sFmt(Tr('<b>{kamp}</b> haritanda işaretlendi.'))}</p>`);
  },
  tick(S) { this.rlSync(S); this.rlDynamite(S); },
  onEvent(type, d, S) {
    // büyük kaya dinamitle parçalanır; yakındaki küçükler de gider
    // yük arabası bölümünde alınan erzak sandıkları (bir seferde birden çok alınabilir)
    if (type === 'goods' && d && d.g === 'dry' && S.ch === 6) S.flags.dry = (S.flags.dry || 0) + (d.n || 1);
    if (type === 'blast' && S.rocks) {
      for (const r of S.rocks) if (!r.gone && dist(d.x, d.y, r.x, r.y) < (r.big ? 55 : 40)) { r.gone = true; if (r.big) UI.feed(Tr('Kaya paramparça oldu!'), 'ok'); }
    }
  },
  propActions(e, S) {
    const P = this.player, st = this.qStep();
    if (e.rlKey && e.rlKey.startsWith('rock') && !e.big) {
      if (!P.has('pickaxe')) return [{ n: Tr('Kazma gerekli'), fn: () => UI.feed(Tr('Kayayı kırmak için kazma lazım. Genel mağazada satılır.'), 'warn') }];
      return [{ n: Tr('Kazmayla Kır'), hold: 1.4, fn: () => {
        const r = S.rocks[e.ri]; if (!r || r.gone) return;
        r.gone = true; P.energy = Math.max(0, P.energy - 4); this.skillXp('strength', 3); Audio_.thud(0.5);
        this.parts.burst('debris', e.x, e.y, 10, 60, 0.7, 1.6, '#6a6460'); this.qEvent('rock', e);
      } }];
    }
    if (e.rlKey === 'rock3') return [{ n: Tr('Dinamit gerekli'), fn: () => UI.feed(Tr('Bu kaya kazmayla kırılmaz. Dinamit at ve uzaklaş.'), 'warn') }];
    if (e.rlKey === 'chest' && st && st.ev === 'chest') return [{ n: Tr('Maaş Sandığını Al'), hold: 1, fn: () => { S.flags.chest = 1; Audio_.ui('pick'); this.qEvent('chest', e); } }];
    return [];
  },
  npcActions(e, S) {
    const st = this.qStep();
    if (e.storyNpc === 'driver') {
      if (st && st.ev === 'witness' && !S.wait) return [{ n: Tr('Yarasını Sar ve Dinle'), hold: 1, fn: () => {
        const P = this.player; if (P.has('bandage')) { P.removeItem('bandage', 1); this.addHonor(2); S.flags.bandaged = 1; }
        e.ang = Math.atan2(P.y - e.y, P.x - e.x); this.qEvent('witness', e);
      } }];
      return [{ n: Tr('Konuş'), fn: () => { UI.subtitle(Tr('Arabacı'), Tr('Bacağım... Ama yaşıyorum. Sandık gitti, ben kaldım.'), 3.5); Bubbles.add(e, '', 3.5, true); } }];
    }
    if (e.storyNpc === 'crew') return [{ n: Tr('Sohbet Et'), fn: () => { UI.subtitle(e.name, this.sFmt(pick([Tr('Çekici bırakma, {ad}. Boone görürse söylenir.'), Tr('Maaş günü gelsin de... gelirse.'), Tr('Bu toz ciğerime işledi. Akşam viski şart.'), Tr('Raylar batıya, biz toza.')])), 3.5); Bubbles.add(e, '', 3.5, true); } }];
    return null;
  },
  buildingActions(b, S) {
    const st = this.qStep();
    if (!st || S.wait) return [];
    if (b.id === S.hotel && st.ev === 'letter') return [{ icon: '✉', label: Tr('Boone\'un Mektubunu Ver'), fn: () => { UI.closeAll(); this.qEvent('letter', b); } }];
    return [];
  },
  finish(S) {
    this.earn(12, Tr('Şirketin ödülü'));
    this.addHonor(6);
    if (this.myWagon) UI.feed(Tr('Şirketin yük arabası artık senin.'));
    this.sullyGo(S.rc.x - 24, S.rc.y + 6);
    setTimeout(() => UI.help(Tr('Kendi taşıma ekibini kurmak istersen: posta ofislerinde <b>Nakliyeci Tut</b>. Nakliyeciler işletmelerine yükü senin yerine taşır. Yük araban sandıkları, ahırlarda <b>Arabanı Buraya Getirt</b> ile istediğin kasabaya gelir.'), 12), 17000);
  },
  epilogue: () => Tr`Hikâye bitti ama hayat sürüyor. Ray kampında her zaman iş var; Boone'un ekibi de sana artık "ustabaşı" diyor. Kendi işini kurmak, arabanla yük taşımak ya da başka yollara düşmek senin elinde. <b>Hedefin hâlâ 80 yaşına kadar yaşamak.</b>`,
  chapters: [
    /* 1 — Ray Kampı: Boone ile tanış, kampa yürü, ray döşe, ye */
    {
      t: () => Tr('Ray Kampı'),
      start() { setTimeout(() => UI.help(Tr`Ustabaşı Boone'un telgrafı cebinde: <i>"Ekipte yer var. Fort Mercy'de karşılarım. Elleri nasırlı birini arıyorum. — W. Boone"</i>`, 10), 600); },
      steps: [
        { t: () => Tr('Walt Boone ile konuş'), ev: 'talk', at() { return this.mentorEnt() || this.story.sully; },
          hint: () => Tr`İri yarı adama yaklaş ve ${Input.glyph('interact')} ile <b>Konuş</b>.`,
          say: () => [
            ['S', Tr('Sen olmalısın. Telgrafta "elleri nasırlı" yazmıştım; şu ellere bak, yazdığım gibi.')],
            ['P', Tr('{ad}. Ray işi arıyorum.')],
            ['S', Tr('Walt Boone. Ray ekibinin ustabaşıyım. İş çok, para az, toz bol. Hâlâ istiyor musun?')],
            ['P', Tr('İstiyorum.')],
            ['S', Tr('Güzel. Kamp rayın yanında, kasabanın dışında. Yürü benimle; yürümek bedava, at kirası değil.')],
          ],
          done() { const R = this.story.rc; this.sullyGo(R.x - 24, R.y + 6); } },
        { t: () => Tr('Boone\'la ray kampına yürü'), chk() { const R = this.story.rc, P = this.player; return dist(P.x, P.y, R.x, R.y) < 140; }, at() { return this.story.rc; }, wp: true,
          hint: () => Tr`Rayı izle; kamp haritada işaretli. ${Input.glyph('sprint')} ile koşabilirsin ama yorulursun.`,
          after: () => [
            ['S', Tr('İşte evin. Üç çadır, bir ateş ve bitmeyen çekiç sesi.')],
            ['Mick', Tr('Yeni çocuk mu? Hoş geldin. Kahveden uzak dur, ben yaptım.')],
            ['S', Tr('Mick, Sven, Tomas. İyi adamlardır; maaş gününe kadar.')],
          ] },
        { t: () => Tr('Boone\'un ekibinde ray döşe'), ev: 'work', ok: (j) => j === 'rail', at() { return this.mentorEnt() || this.story.rc; },
          hint: () => Tr`Boone'a yaklaş ve <b>Ray Döşe</b>'yi seç. Dört saat sürer; çalışınca yorulur, acıkır ve susarsın. İş saatleri 06:00 – 18:00.`,
          after(S) {
            const P = this.player; if (!P.has('stew')) { P.addItem('stew', 1, true); S.flags.stew = 1; }
            return [['S', Tr('Fena değil. Traversi düz koyuyorsun, çiviyi eğmiyorsun. Çoğu ilk gün ikisini de beceremez.')], ['S', Tr('Al, güveç. Mick yapmadı, korkma. Ye bakalım.')]];
          } },
        { t: () => Tr('Kampta karnını doyur'), ev: 'eat',
          hint: () => Tr`${Input.glyph('satchel')} Çanta'dan güveci seç ya da ${Input.glyph('quick')} ile atıştır.`,
          after: () => [['S', Tr('Yarın erken kalk. Rayın ilerisine kaya düşmüş; tren geçmeden temizlemeliyiz.')]] },
      ],
    },
    /* 2 — Kazma ve Dinamit: heyelanı temizle */
    {
      t: () => Tr('Kazma ve Dinamit'),
      cine() {
        return { sc: 'q_dawn', lines: [
          ['S', Tr('Gece yamaç kaymış. Ray kayaların altında kaldı.')],
          ['S', Tr('Öğlen treni gelmeden yol açılmazsa şirket ekibin yarısını kapı dışarı eder.')],
          ['P', Tr('Kazmam var.')],
          ['S', Tr('Küçükler için yeter. Büyüğü için başka bir şeye ihtiyacımız var.')],
        ], after() { if (this.hour < 6 || this.hour > 10) this.sSkipTo(7); } };
      },
      start(S) {
        const P = this.player;
        if (!P.has('pickaxe')) { P.addItem('pickaxe', 1, true); S.flags.pick = 1; }
        if (P.count('dynamite') < 2) P.addItem('dynamite', 2 - P.count('dynamite'), true);
        const L = S.slide; this.sullyGo(L.x - 60, L.y + 40);
      },
      steps: [
        { t: () => Tr('Raydaki heyelana git'), chk() { const L = this.story.slide, P = this.player; return dist(P.x, P.y, L.x, L.y) < 160; }, at() { return this.story.slide; }, wp: true },
        { t: () => Tr('Küçük kayaları kazmayla kır'), n: 3, chk() { const S = this.story, n = S.rocks.filter(r => !r.big && r.gone).length; if (n !== S.n) { S.n = n; this.questHud(); } return n >= 3; },
          at() { const S = this.story, r = S.rocks.find(x => !x.big && !x.gone); return r || S.slide; },
          hint: () => Tr`Kayanın yanında ${Input.glyph('interact')} basılı tut: <b>Kazmayla Kır</b>. Her vuruş seni biraz yorar.` },
        { t: () => Tr('Büyük kayayı dinamitle patlat'), chk() { return this.story.rocks.some(r => r.big && r.gone); }, at() { const r = this.story.rocks.find(x => x.big); return r; },
          talk: () => [
            ['S', Tr('Dinamit. Dinle beni, çünkü bunu bir kez söyleyeceğim.')],
            ['S', Tr('Fitili yakarsın, atarsın, sonra koşarsın. Sırası önemli. Çoğu adam ikinciyle üçüncüyü karıştırır.')],
            ['S', Tr('Kayaya at, en az on adım uzaklaş. Patlama kayayı da seni de ayırt etmez.')],
          ],
          hint: () => Tr`${Input.glyph('wheel')} Silah Çarkı'ndan <b>Dinamit</b>'i seç, kayaya nişan al ve ${Input.glyph('fire')} ile at. Sonra hemen uzaklaş: patlama yakındaki herkese zarar verir.`,
          after: () => [
            ['S', Tr('İşte bu! Yol açık.')],
            ['S', Tr('Sen dinamitle iyisin, ben de hesapla. Şu hesap tutmuyor ama: geçen ayın maaşı yine eksik geldi.')],
            ['S', Tr('Şirketin maaş memuru Cyrus Hale. Mektubumu ona götüreceksin; trenle. Hiç trene bindin mi?')],
          ] },
      ],
    },
    /* 3 — Tren Bileti: trenle Hale'in kasabasına git, mektubu ver, dön */
    {
      t: () => Tr('Tren Bileti'),
      talk: () => [['S', Tr('Bilet parası benden. Hale\'e mektubu ver, ağzından çıkanı aklında tut. Yazılı söz yalan söylemez; Hale söyler.')]],
      start(S) { this.earn(3, 'Boone'); },
      steps: [
        { t() { return Tr`Trenle ${this.rlDest().n} kasabasına git`; }, chk() { const P = this.player, D = this.rlDest(), t = this.world.townAt(P.x, P.y, 2); return !!(t && t.id === D.id) || !!(D.station && dist(P.x, P.y, D.station.door.x, D.station.door.y) < 300); },   // istasyon kasabanın dışında kalabilir
          at() { const t = this.world.townAt(this.player.x, this.player.y, 30), st = t && t.id === this.story.town && this.sBld('station'); return st ? this.sDoor(st, 4) : this.rlDest().spawn; }, wp: true,
          hint: () => Tr`Fort Mercy istasyonunda gişeye git ve <b>Tren Bileti Al</b>. Tren hızlı ve ucuzdur; aranırken seni almazlar.` },
        { t: () => Tr('Hale\'e Boone\'un mektubunu ver'), ev: 'letter', at() { const b = this.world.buildings[this.story.hotel]; return b ? this.sDoor(b, 4) : null; }, wp: true,
          hint: () => Tr`Hale otelde kalıyor. İçeri gir, resepsiyonda <b>Boone'un Mektubunu Ver</b>'i seç.`,
          after: () => [
            ['R', Tr('Boone yine mi yazmış? Adam mektupla nefes alıyor.')],
            ['R', Tr('"Maaşlar eksik" diyor. Eksik değil, efendim; işçileriniz savurgan. Viskiye, kumara...')],
            ['P', Tr('Ekip kampta viski bile içmiyor.')],
            ['R', Tr('O zaman tasarruf ediyorlardır. Söyle Boone\'a: sandık cuma günü trenle gelir, Fort Mercy\'den arabayla kampa gider. Her zamanki gibi.')],
            ['P', Tr('...Her zamanki gibi.')],
          ] },
        { t: () => Tr('Ray kampına dön'), chk() { const R = this.story.rc, P = this.player; return dist(P.x, P.y, R.x, R.y) < 140; }, at() { return this.story.rc; }, wp: true,
          hint: () => Tr`İstasyondan Fort Mercy'ye bilet al, sonra kampa yürü.`,
          after: () => [['P', Tr('Hale savurgan olduğumuzu söylüyor.')], ['S', Tr('Savurgan. Mick\'in tek gömleği var, onu da Sven\'den ödünç aldı.')]] },
      ],
    },
    /* 4 — Kereste: kesim yerinden iki travers demetini kampa taşı */
    {
      t: () => Tr('Kereste'),
      talk: () => [
        ['S', Tr('Traversler bitti. Sven\'le Tomas kesim yerinde iki demet hazırladı, ama sırtları tutuldu.')],
        ['S', Tr('Omzuna al, getir. Ağırdır; koşma, nefesini bölme. Atın varsa eyere yükle, iki demeti birden taşır.')],
      ],
      start(S) {
        if (!S.flags.ties) { S.flags.ties = 1; for (let k = 0; k < 2; k++) this.addEnt(new Crate(S.cut.x - 10 + k * 18, S.cut.y + 10, 'ties')); }
      },
      steps: [
        { t: () => Tr('Kesim yerine git'), chk() { const C = this.story.cut, P = this.player; return dist(P.x, P.y, C.x, C.y) < 120; }, at() { return this.story.cut; }, wp: true },
        { t: () => Tr('Travers demetlerini kampa taşı'), n: 2, chk() { const S = this.story, n = this.rlTiesAtCamp(); if (n !== S.n) { S.n = n; this.questHud(); } this.rlTiesRespawn(S); return n >= 2; },
          at() { const P = this.player, R = this.story.rc; if (P.carry && P.carry.g === 'ties') return R; const c = this.ents.find(e => e.kind === 'crate' && e.g === 'ties' && !e.remove && dist(e.x, e.y, R.x, R.y) > 110); return c || R; },
          hint: () => Tr`Demetin yanında ${Input.glyph('interact')} ile <b>Omzuna Al</b>, kampa götürüp ${Input.glyph('interact')} ile <b>Yere Bırak</b>. Atın varsa demeti yanında <b>atına yükle</b>.`,
          done() { const R = this.story.rc; for (const e of this.ents) if (e.kind === 'crate' && e.g === 'ties' && dist(e.x, e.y, R.x, R.y) < 120) e.remove = true; this.earn(1, 'Boone'); },
          after: () => [['S', Tr('Sırtın sağlam, evlat. Yarın maaş günü. Ya da öyle olması gerekiyor.')]] },
      ],
    },
    /* 5 — Maaş Günü: eksik maaş, bankaya yatır */
    {
      t: () => Tr('Maaş Günü'),
      cine() {
        return { sc: 'q_fire', lines: [
          ['S', Tr('Sandık geldi. Saydım. İki kere saydım.')],
          ['Sven', Tr('Ne kadar eksik bu sefer?')],
          ['S', Tr('Üçte biri. "Kayıp" yazmışlar. Yol masrafı, nem, fare...')],
          ['P', Tr('Fare para mı yer?')],
          ['S', Tr('Şirketinkiler yer. Al, payın bu. Kampta tutma; çadırda para, çantada su gibidir: bir sabah bakarsın, yok.')],
        ], after() { this.sSkipTo(8); this.earn(4, Tr('Yevmiye')); } };
      },
      steps: [
        { t: () => Tr('Kazancını bankaya yatır'), ev: 'deposit', at() { const b = this.world.buildings[this.story.bank]; return b ? this.sDoor(b, 4) : null; }, wp: true,
          skip() { return !this.world.buildings[this.story.bank]; },
          hint: () => Tr`En yakın banka haritada işaretli; trenle gidebilirsin. <b>Banka İşlemleri</b>'nde para yatır: bankadaki para ölünce kaybolmaz ve yıllık faiz getirir.` },
        { t: () => Tr('Ray kampına dön'), chk() { const R = this.story.rc, P = this.player; return dist(P.x, P.y, R.x, R.y) < 140; }, at() { return this.story.rc; }, wp: true,
          done() { this.story.flags.robbed = 1; } },
      ],
    },
    /* 6 — Kayıp Sandık: soyulan araba, tanık, söylenti */
    {
      t: () => Tr('Kayıp Sandık'),
      talk: () => [
        ['S', Tr('Bu sabah gelecek ikinci sandık gelmedi. Araba yolda kalmış, at kampa tek başına döndü.')],
        ['S', Tr('Arabacı Eli\'yi tanırım; sarhoş değildir, kaybolmaz. Git bak. Al şu sargı bezini; yaralıysa lazım olur.')],
      ],
      start() { const P = this.player; if (!P.has('bandage')) P.addItem('bandage', 1, true); },
      steps: [
        { t: () => Tr('Yoldaki arabaya git'), chk() { const R = this.story.rob, P = this.player; return dist(P.x, P.y, R.x, R.y) < 120; }, at() { return this.story.rob; }, wp: true,
          after: () => [['P', Tr('Araba devrilmiş. Sandığın kilidi kırılmış... boş.')]] },
        { t: () => Tr('Yaralı arabacıyı dinle'), ev: 'witness', at() { return this.ents.find(e => e.storyNpc === 'driver' && !e.remove) || this.story.rob; },
          hint: () => Tr`Arabacının yanında ${Input.glyph('interact')} basılı tut: <b>Yarasını Sar ve Dinle</b>. Tanıklar gördüklerini anlatır.`,
          after: () => [
            ['D', Tr('Dört atlı... Yüzleri bantlıydı. Biri silahı alnıma dayadı.')],
            ['D', Tr('Ama sandığın anahtarı birindeydi. Kırmadılar bile, açtılar. Anahtar yalnızca şirkette olur.')],
            ['D', Tr('Biri "acele etme, tren cumaya" dedi. Şehirli konuşuyordu. Kasabaya, saloona sor; böyleleri orada içer.')],
          ] },
        { t: () => Tr('Fort Mercy saloonunda söylenti dinle'), ev: 'rumor', at() { return this.sDoor(this.sBld(['saloon', 'cantina']), 4); }, wp: true,
          hint: () => Tr`Barmenle konuş ve <b>Söylenti Dinle</b>. Birkaç kuruşa bildiklerini anlatır.`,
          after: () => [['P', Tr('Şehirli konuşan biri... ve şirketin anahtarı. Boone\'a anlatmalıyım.')]] },
      ],
    },
    /* 7 — Yük Arabası: şirketin arabasıyla erzak getir */
    {
      t: () => Tr('Yük Arabası'),
      talk(S) {
        return [
          ['S', Tr('Bunu Hale\'e söylersek kanıt ister. Kanıtımız yok, erzakımız da yok. Önce ekibi doyuralım.')],
          ['S', S.flags.wagon ? Tr('Şirketin yük arabasını al. Fort Mercy\'deki mağazadan iki sandık erzak getir. Parası benden.') : Tr('Arabana bin, Fort Mercy\'deki mağazadan iki sandık erzak getir. Parası benden.')],
        ];
      },
      start(S) {
        if (!this.myWagon) { const R = S.rc, s = this.sSpot(R.x + 40, R.y + 34, 0, 40); this.spawnMyWagon(s[0], s[1], 0, []); S.flags.wagon = 1; }
        // iki sandık erzak parası (mağazanın toptan fiyatından) ve biraz fazlası
        const b = this.sBld('general'), g = b && this.goodsAt(b).find(x => x.g === 'dry');
        this.earn(Math.ceil((g ? g.p : GOODS.dry.p * 1.5) * 2) + 1, 'Boone');
      },
      steps: [
        { t: () => Tr('Yük arabasına bin'), chk() { return !!this.myWagon && this.player.riding === this.myWagon; }, at() { return this.myWagon; },
          hint: () => Tr`Arabanın yanında ${Input.glyph('interact')} ile <b>Arabayı Sür</b>. At gibi sürülür ama dönüşleri geniştir.` },
        { t: () => Tr('Mağazadan iki sandık erzak al'), n: 2, chk() { const S = this.story, n = Math.min(2, S.flags.dry || 0); if (n !== S.n) { S.n = n; this.questHud(); } return n >= 2; }, at() { return this.sDoor(this.sBld('general'), 4); }, wp: true,
          hint: () => Tr`Arabayı mağazanın kapısına sür, in ve tezgâhta <b>Toptan Mal Al</b> → <b>Erzak Sandığı</b>. Araba kapıdayken sandıklar doğrudan arabaya yüklenir.` },
        { t: () => Tr('Erzakı ray kampına götür'), chk() { return this.rlDryAtCamp() >= 2; }, at() { return this.story.rc; }, wp: true,
          hint: () => Tr`Arabayla kampa dön. Yükü kampa getirmen yeter; ekip indirir.`,
          done() { this.rlTakeDry(2); },
          after: () => [['Tomas', Tr('Fasulye! Kahve! Tanrı seni korusun.')], ['S', Tr('Arabayı yanında tut. Şirkete "kayboldu" yazarım; onlar da hep öyle yazıyor.')]] },
      ],
    },
    /* 8 — Şirketin Adamı: nal izlerini sür, sığınağı gözetle */
    {
      t: () => Tr('Şirketin Adamı'),
      talk: () => [
        ['S', Tr('Anahtar şirkette olur, şehirli konuşur... Hale bu sabah Fort Mercy\'ye inmiş, at kiralamış.')],
        ['S', Tr('Soygun yerinden dağa doğru taze nal izleri var. Sür izi; yakalanma. Uzaktan bak, yeter.')],
      ],
      start(S) { S.ti = S.ti || 0; if (!this.player.has('binoculars')) { this.player.addItem('binoculars', 1, true); S.flags.binoc = 1; } },
      steps: [
        { t: () => Tr('Nal izlerini takip et'), chk() { const S = this.story, P = this.player; const p = S.trail[S.ti]; if (p && dist(P.x, P.y, p.x, p.y) < 80) { S.ti++; Audio_.tone(520, 0.06, 'triangle', 0.04); } if (S.n !== S.ti) { S.n = S.ti; this.questHud(); } return S.ti >= S.trail.length; },
          n: 6,
          at() { const S = this.story; return S.trail[Math.min(S.ti, S.trail.length - 1)]; }, wp: true,
          hint: () => Tr`Yerdeki nal izlerini izle; her iz bir sonrakini gösterir. İz sürerken ${Input.glyph('crouch')} ile çömelirsen daha az dikkat çekersin.` },
        { t: () => Tr('Sığınağı dürbünle gözetle'), chk() { const S = this.story, C = this.cam; return !!this.binoc && S.camp.x > C.ox && S.camp.x < C.ox + this.vw && S.camp.y > C.oy && S.camp.y < C.oy + this.vh; }, at() { return this.story.camp; },
          hint: () => Tr`Fazla yaklaşma. ${Input.glyph('satchel')} Çanta'dan <b>Dürbün</b>'ü kullan ve sığınağa bak.`,
          after: () => [
            ['P', Tr('Hale. Şirketin maaş memuru, haydutlarla aynı ateşin başında.')],
            ['P', Tr('Önünde bizim sandık. Para sayıyor... ve gülüyor.')],
          ] },
      ],
    },
    /* 9 — Kanyon: sığınağa baskın, Hale'i yakala, sandığı al */
    {
      t: () => Tr('Kanyon'),
      cine() {
        return { sc: 'q_dawn', lines: [
          ['S', Tr('Haber aldım, geldim. Ekibin parasını bir adam çalarsa ustabaşı kenarda durmaz.')],
          ['S', Tr('Kayaların arkasından ilerle. Ateş ederken siper al; açıkta duran adam uzun yaşamaz.')],
          ['S', Tr('Hale\'i canlı istiyorum. Mahkemede şirketin önünde konuşsun.')],
        ], after() {
          const S = this.story; if (this.hour > 9 || this.hour < 5) this.sSkipTo(6);
          const a = Math.atan2(S.site.y - S.camp.y, S.site.x - S.camp.x), s = this.sSpot(S.camp.x + Math.cos(a) * 470, S.camp.y + Math.sin(a) * 470, 0, 80);
          this.sTeleport(s[0], s[1]); this.sullyGo(S.site.x + 20, S.site.y);
        } };
      },
      start(S) { const P = this.player; if (!P.weapons.has('lasso')) { P.giveWeapon('lasso', true); S.flags.lasso = 1; } P.ammo.pistol = Math.max(P.ammo.pistol || 0, 24); },
      talk: (S) => S.flags.lasso ? [['S', Tr('Şu kementi de al. Kazıklarla tren vagonu bağlarım; bir adamı da bağlar.')]] : [],
      steps: [
        { t: () => Tr('Sığınaktaki haydutları etkisiz hâle getir'), chk() { const S = this.story, P = this.player; if (dist(P.x, P.y, S.camp.x, S.camp.y) > 360) return false; return !this.ents.some(e => e.kind === 'npc' && e.role === 'bandit' && !e.quest && !e.dead && !e.bound && !e.remove && dist(e.x, e.y, S.camp.x, S.camp.y) < 420); },
          at() { return this.story.camp; },
          hint: () => Tr`Kayaların ve ağaçların arkasına geç: siperdeyken daha az isabet alırsın. Nişan alırken ${Input.glyph('deadeye')} ile <b>Odak</b>'ı aç; zaman yavaşlar.` },
        { t: () => Tr('Hale\'i etkisiz hâle getir'), chk() { const j = this.rivalEnt(); return !!(j && (j.dead || j.bound)); }, at() { return this.rivalEnt() || this.story.camp; },
          hint: () => Tr`Hale'i canlı istiyorsan kementi seç (${Input.glyph('wheel')}), ${Input.glyph('fire')} ile at, sonra yaklaşıp ${Input.glyph('interact')} basılı tutarak bağla.`,
          done() { const j = this.rivalEnt(); this.story.alive = !!(j && !j.dead); } },
        { t: () => Tr('Maaş sandığını al'), ev: 'chest', at() { return this.ents.find(e => e.rlKey === 'chest' && !e.remove) || this.story.camp; },
          hint: () => Tr`Sandığın yanında ${Input.glyph('interact')} basılı tut: <b>Maaş Sandığını Al</b>.`,
          after: () => [['S', Tr('Ağır. İyi. Ağır olması gerekiyordu zaten, her ay.')], ['S', Tr('Hale\'i Fort Mercy şerifine götür. Ben sandığı kampa taşırım.')]] },
      ],
    },
    /* 10 — Şerif Masası: Hale'i teslim et, Boone'la vedalaş */
    {
      t: () => Tr('Şerif Masası'),
      start(S) { const R = S.rc; this.sullyGo(R.x - 24, R.y + 6, true); },
      steps: [
        { t() { return this.story.alive ? Tr('Hale\'i şerife canlı teslim et') : Tr('Hale\'in cesedini şerife götür'); }, ev: 'deliver', ok: (e) => e && e.quest === 'rival',
          at() { const j = this.rivalEnt(), P = this.player; if (j && j !== P.carry && !(this.horse && this.horse.load && this.horse.load.includes(j)) && !(this.myWagon && P.riding === this.myWagon)) return j; return this.sDoor(this.sBld('sheriff'), 4); }, wp: true,
          on(S) { if (S.jack === 'delivered') { const st = this.qStep(); setTimeout(() => { if (this.qStep() === st && !S.wait) this.qDone(); }, 60); } },
          hint: () => Tr`Hale'i omzuna al (${Input.glyph('interact')}), atın varsa <b>eyere yükle</b> ve Fort Mercy şerif ofisinde teslim et.`,
          done() { this.story.jack = 'delivered'; },
          after() {
            return this.story.alive
              ? [['W', Tr('Şirketin maaş memuru, kendi sandığını soyarken yakalanmış. Bunu gazeteler sever.')], ['W', Tr('Ödülün burada. Bir de şirketten telgraf geldi: ekibin yeni ustabaşısını soruyorlar.')]]
              : [['W', Tr('Hale... Mahkemeye çıkamayacak ama defterleri konuşur. Ödülün burada.')], ['W', Tr('Şirketten telgraf geldi: ekibin yeni ustabaşısını soruyorlar.')]];
          } },
        { t: () => Tr('Ray kampına dön, Boone ile konuş'), ev: 'talk', at() { return this.mentorEnt() || this.story.rc; }, wp: true,
          say: () => [['P', Tr('Şirket yeni bir ustabaşı istiyor.')], ['S', Tr('Biliyorum. Seni yazdım.')]],
          cine: () => ({ sc: 'q_finale', cap: { k: Tr('Son'), n: Tr('Raylar ve Toz'), s: '' }, lines: [
            ['S', Tr('Yirmi yıl ray döşedim. Bir gün o raylardan geçen trenin içinde olmak istedim; olmadı.')],
            ['P', Tr('Ya şimdi?')],
            ['S', Tr('Şimdi biletimi aldım. Kızım batıda, kıyıda bir kasabada. Torunum varmış; adını bile bilmiyorum.')],
            ['S', Tr('Ekip senin. Maaşı tam ver, kahveyi Mick\'e yaptırma, dinamiti hep son çare say.')],
            ['P', Tr('Araba?')],
            ['S', Tr('Şirkete "kayboldu" yazdım. Senin artık; kendi yükünü taşı, kendi ekibini kur.')],
            ['S', Tr('Raylar batıya uzanıyor, {ad}. Bir gün o raylardan sen de geçersin. Pencereden bu kampa el salla.')],
          ] }) },
      ],
    },
  ],
};
STORY_FOR_BG.rail = 'rail';

/* Demiryolu hikâyesinin yardımcıları (Story'ye eklenir) */
Object.assign(Story, {
  rlDest() { return this.world.towns.find(t => t.id === this.story.dest); },
  /* kampa bırakılmış travers demetleri */
  rlTiesAtCamp() {
    const R = this.story.rc;
    let n = 0;
    for (const e of this.ents) if (e.kind === 'crate' && e.g === 'ties' && !e.remove && dist(e.x, e.y, R.x, R.y) < 110) n++;
    return n;
  },
  /* kaybolan (satılan, yok olan) demetler kesim yerinde yeniden belirir */
  rlTiesRespawn(S) {
    const P = this.player, all = this.ents.filter(e => e.kind === 'crate' && e.g === 'ties' && !e.remove).length
      + (P.carry && P.carry.g === 'ties' ? 1 : 0) + (this.horse && this.horse.load ? this.horse.load.filter(e => e.g === 'ties').length : 0);
    if (all < 2 && dist(P.x, P.y, S.cut.x, S.cut.y) > 300) for (let k = all; k < 2; k++) this.addEnt(new Crate(S.cut.x - 10 + k * 18, S.cut.y + 10, 'ties'));
  },
  /* kampa getirilen erzak sandıkları: arabada, eyerde, omuzda ya da yerde */
  rlDryAtCamp() {
    const R = this.story.rc, P = this.player, near = (x, y) => dist(x, y, R.x, R.y) < 140;
    let n = 0;
    const w = this.myWagon; if (w && !w.remove && near(w.x, w.y)) n += w.crates.filter(g => g === 'dry').length;
    if (P.carry && P.carry.kind === 'crate' && P.carry.g === 'dry' && near(P.x, P.y)) n++;
    const h = this.horse; if (h && h.load && near(h.x, h.y)) n += h.load.filter(e => e.kind === 'crate' && e.g === 'dry').length;
    for (const e of this.ents) if (e.kind === 'crate' && e.g === 'dry' && !e.remove && near(e.x, e.y)) n++;
    return n;
  },
  rlTakeDry(n) {
    const P = this.player, w = this.myWagon, h = this.horse;
    while (n > 0 && w && w.crates.includes('dry')) { w.crates.splice(w.crates.indexOf('dry'), 1); n--; }
    if (n > 0 && P.carry && P.carry.g === 'dry') { P.carry = null; n--; }
    while (n > 0 && h && h.load && h.load.some(e => e.g === 'dry')) { h.load.splice(h.load.findIndex(e => e.g === 'dry'), 1); n--; }
    for (const e of this.ents) if (n > 0 && e.kind === 'crate' && e.g === 'dry' && !e.remove && dist(e.x, e.y, this.story.rc.x, this.story.rc.y) < 140) { e.remove = true; n--; }
  },
  /* dinamit biterse Boone bir tane daha verir (en fazla dört kez) */
  rlDynamite(S) {
    const st = this.qStep();
    if (S.ch !== 1 || !st || S.wait || !S.rocks.some(r => r.big && !r.gone) || this.player.has('dynamite') || this.projs.some(p => p.type === 'dynamite')) return;
    if ((S.flags.dyn || 0) >= 4) return;
    S.flags.dyn = (S.flags.dyn || 0) + 1;
    this.player.addItem('dynamite', 1, true);
    UI.feed(Tr('Boone sana bir dinamit daha uzattı: "Bu sefer kayaya at."'));
  },
  /* kamp, heyelan, soygun yeri, nal izleri ve sığınaktaki sandık: oyuncu yakınken dünyada belirir */
  rlSync(S) {
    const P = this.player, want = [], near = (p, r = 900) => p && dist(P.x, P.y, p.x, p.y) < r;
    const R = S.rc;
    if (near(R)) {
      want.push({ k: 'fire', x: R.x, y: R.y, t: 'fire' });
      [[-40, -26, '#c8b890'], [36, -30, '#b8a880'], [-6, -44, '#d0c0a0']].forEach(([dx, dy, col], i) => want.push({ k: 'tent' + i, x: R.x + dx, y: R.y + dy, t: 'tent', col }));
      want.push({ k: 'tiestack', x: R.x + 46, y: R.y + 14, t: 'ties' });
      RAIL_CREW.forEach((n, i) => want.push({ k: 'crew' + i, npc: n, x: R.x + Math.cos(0.9 + i * 2.1) * 34, y: R.y + 8 + Math.sin(0.9 + i * 2.1) * 24 }));
    }
    if (S.rocks && near(S.slide)) S.rocks.forEach((r, i) => { if (!r.gone) want.push({ k: 'rock' + i, x: r.x, y: r.y, t: r.big ? 'boulder' : 'rock', ri: i, big: !!r.big, act: true, label: r.big ? Tr('Büyük Kaya') : Tr('Kaya') }); });
    if (S.flags.robbed && S.ch <= 7 && near(S.rob)) {
      want.push({ k: 'wreck', x: S.rob.x + 18, y: S.rob.y - 6, t: 'wagon' });
      want.push({ k: 'driver', npc: 'driver', x: S.rob.x - 10, y: S.rob.y + 8 });
    }
    if (S.ch === 7 && S.trail) S.trail.forEach((p, i) => { if (i >= (S.ti || 0) - 1 && near(p, 700)) { const q = S.trail[i + 1] || S.site; want.push({ k: 'trk' + i, x: p.x, y: p.y, t: 'tracks', ang: Math.atan2(q.y - p.y, q.x - p.x) }); } });
    if (S.ch === 8 && !S.flags.chest && near(S.camp)) want.push({ k: 'chest', x: S.camp.x + 16, y: S.camp.y + 8, t: 'chest', act: true, label: Tr('Maaş Sandığı') });
    const keys = new Set(want.map(w => w.k));
    for (const e of this.ents) if (e.rlKey && !e.remove && !keys.has(e.rlKey)) e.remove = true;
    for (const w of want) {
      if (this.ents.some(e => e.rlKey === w.k && !e.remove)) continue;
      let e;
      if (w.npc === 'driver') {
        e = new NPC(w.x, w.y, 'gang', { name: Tr('Arabacı Eli'), look: randomLook('m', new RNG((this.seed || 1) + 71)), money: 0.2 });
        e.state = 'hurt'; e.hp = 30; e.storyNpc = 'driver'; e.home = { x: w.x, y: w.y, r: 6 };
      } else if (w.npc) {
        const look = randomLook('m', new RNG((this.seed || 1) + w.npc.length * 131)); look.hat = w.npc === 'Sven' ? 'flat' : 'cowboy';
        e = new NPC(w.x, w.y, 'gang', { name: w.npc, look, money: 0.3, home: { x: R.x, y: R.y + 8, r: 50 } });
        e.storyNpc = 'crew'; e.weapon = null;
      } else {
        e = new Prop(w.x, w.y, w.t, { col: w.col, ang: w.ang || 0 });
        if (w.act) { e.storyAct = true; e.label = w.label; e.ri = w.ri; e.big = w.big; }
      }
      e.rlKey = w.k; e.keep = true;
      this.addEnt(e);
    }
  },
});
