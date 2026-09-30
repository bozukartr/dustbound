'use strict';
/* ==========================================================
   FRONTIER'S END — NPC eylemleri ve canlandırma (G nesnesine eklenir)
   Boşta:     duruma, saate, havaya ve kişiye göre seçilen hareketler:
              sigara (kibritle yakar, üfler), matara, cep saati, kol
              kavuşturma, eller belde, kafa kaşıma, gerinme, omuz silkme,
              işaret etme, yelpazelenme, el ovuşturma, gazete, ayakkabı
              bağlama; sohbette el kol hareketi ve gülme.
   Yürüyüş:   yaşlı bastonla, çocuk sekerek, gece sarhoş sendeleyerek,
              yağmurda şapkasını tutarak yürür; gezerken durup bakınır.
   Selam:     sakin seni el sallayıp selamlar; karşılık vermezsen
              mizacına göre bozulur, yanındakine dert yanar, seni
              unutmaz. Sakinler yolda birbirini de selamlar.
   Arabalar:  dükkân önüne park eden sürücü iner, sandıkları içeri
              taşır, sonra atların yanında bekler (sigara, gerinme, atı
              okşama, saat); vakit gelince arabasına döner. Posta
              arabasından yolcular iner, otele ya da saloona yürür.
   ========================================================== */

/* Oyuncuyu selamlama */
const HELLO = {
  morning: ['Günaydın!', 'Günaydın, yabancı!', 'Hayırlı sabahlar!', 'Sabah sabah nereye böyle?'],
  day: ['Merhaba!', 'İyi günler!', 'Selam!', 'Nasılsın bakalım?', 'Hoş geldin!'],
  evening: ['İyi akşamlar!', 'Akşamın hayrolsun!', 'Akşam oldu bile, değil mi?'],
  night: ['İyi geceler.', 'Hayırlı geceler, yabancı.'],
  friend: ['Selam {ad}! Nasılsın bakalım?', 'Hey {ad}! Seni gördüğüme sevindim!', '{ad}! Uğramadan geçme!'],
  kid: ['Merhaba kovboy!', 'Selaaam!', 'Hey! Hey! Merhaba!'],
};
/* Selamı karşılıksız kalınca (mizaca göre) */
const SNUB = {
  jolly: ['Hey! Selam verdim, duymadın mı?', 'Peki, sen de bana selam verme bakalım!', 'Hıh, kendini valinin oğlu sanıyor.'],
  grumpy: ['Selam vermek de mi para ister?', 'Kaba herif!', 'Görmezden gel bakalım, unutmam bunu.'],
  shy: ['...', 'Belki duymadı...', 'Ben de selam vermeyeyim o zaman.'],
  gossip: ['Selamımı almadı! Herkese anlatacağım.', 'Vay vay, burnu havada biri.'],
  pious: ['Selam vermek sevaptır, evlat.', 'Tanrı affetsin, selamı bile esirgedi.'],
  plain: ['Peki... Selam sana da.', 'Selamıma karşılık yok demek.', 'Hıh. Kaba.'],
  kid: ['Hey! Beni duymadın mı?', 'Kovboylar selam vermez mi?'],
};
const THANKS = ['İşte böyle! Selam karşılıksız kalmaz.', 'Hoş geldin, dostum!', 'Güzel günler dilerim.', 'Sağ ol, sağ ol.', 'Bak sen, ne kibar!'];
/* Selamı alınmayan sakin yanındakine dert yanar */
const SNUB_TALK = [
  ['Gördün mü? Selamımı almadı.', 'Yabancılar böyle işte.', 'Bir daha selam veren de kabahat.'],
  ['Şu {ad} var ya, selamımı almadı!', 'Belki duymamıştır.', 'Duydu duydu. Burnu havada.'],
];
/* Sakinlerin yolda birbirini selamlaması: {y} karşıdakinin, {z} selamlayanın adı */
const PASS = [['Günaydın {y}!', 'Sana da {z}!'], ['Selam {y}, nasılsın?', 'İyiyim {z}, sağ ol!'], ['Hey {y}!', 'Hey!'], ['{y}! Akşam saloona gel!', 'Bakarız!'], ['Kolay gelsin {y}.', 'Sağ ol.'], ['Eşine selam söyle {y}!', 'Söylerim!']];
/* Araba sürücüsü */
const TEAMSTER = {
  arrive: ['Hooop! Geldik.', 'Yük geldi! Sandıklar nereye?', 'Ohh, sonunda. Belim koptu.', 'Kimse yok mu? Mal geldi!'],
  carry: ['Hıh... ağırmış bu.', 'Bir tane daha...', 'Kim doldurdu bunları taşla?', 'Kapıyı tutan olsa bari!'],
  rest: ['Şu tütün olmasa ne yapardım.', 'Yol uzun, atlar yorgun.', 'Biraz soluklanalım.', 'Akşama kadar iki kasaba daha.'],
  horse: ['Aferin kızım, aferin.', 'Az kaldı, dayan.', 'Susadın mı güzelim?'],
  leave: ['Deh! Hadi kızlar!', 'Yola devam!', 'Hoşça kalın!', 'Hadi bakalım, yol bizi bekler.'],
  stolen: ['Hey! O benim arabam!', 'Hırsız! Arabamı çalıyorlar!', 'Bırak o dizginleri!'],
};
const TEAM_TALK = [
  ['Yollar nasıl?', 'Toz toprak. Bir de haydut korkusu.', 'Dikkatli ol o zaman.'],
  ['Ne getirdin bu sefer?', 'Un, çivi, bir de kahve.', 'Kahve! Nihayet!'],
  ['Hangi yoldan geldin?', 'Kanyondan. Tekerlek az kalsın kırılıyordu.', 'Allah korumuş.'],
];
const PASSENGER = ['Sonunda! Kemiklerim sızladı.', 'Burası mı {k}? Ne kadar toz!', 'Otel ne tarafta acaba?', 'Bir daha posta arabasına binersem...', 'Oh, yere bastım nihayet.'];
const DRUNK = ['Hık!', 'Bir tane daha... hık!', 'Ev... ev ne tarafta?', '♪ Oh Susanna... ♪', 'Sen... sen benim en iyi dostumsun.'];

/* Hareketlerin süresi [en az, en çok] ve yürürken sürebilenler */
const ANIM_DUR = { smoke: [10, 16], drink: [7, 11], watch: [2.4, 3.2], scratch: [1.4, 2], cross: [4, 8], hips: [3, 6], stretch: [2, 2.6], shrug: [1, 1.4],
  point: [1.4, 2], tie: [2.2, 3], fan: [4, 7], rub: [3, 5], read: [8, 16], laugh: [1.4, 2], wave: [1.6, 2.2], tiphat: [1.2, 1.4], gesture: [2, 3], pat: [3, 5], hurry: [1.5, 1.5] };
const ANIM_MOVE = { smoke: 1, hurry: 1 };

const NpcActs = {
  /* ---------------- canlandırma ---------------- */
  setAnim(e, k, dur) {
    if (!k) return null;
    const D = ANIM_DUR[k] || [2, 3];
    e.anim = { k, t: 0, dur: dur || rnd(D[0], D[1]) };
    if (k === 'smoke') { if ((e.smokeLit || -1e9) > this.t - 90) e.anim.t = 1.4; else e.smokeLit = this.t; }   // yeni yaktıysa kibrit yok
    return e.anim;
  },
  smoker(e) {
    if (e.smk === undefined) {
      const occ = e.res ? e.res.occ : e.role;
      const p = { drifter: 0.8, laborer: 0.55, miner: 0.7, farmhand: 0.5, lumberman: 0.6, dockhand: 0.6, elder: 0.45, teamster: 0.9, law: 0.45 }[occ];
      e.smk = !e.child && occ !== 'kid' && occ !== 'newsboy' && hash2(e.id, 17, 5) < (p === undefined ? 0.25 : p);
    }
    return e.smk;
  },
  isKid(e) { return !!(e.child || (e.res && OCCS[e.res.occ] && OCCS[e.res.occ].kid)); },
  /* Boşta ne yapsın: kişiye, saate ve havaya göre ağırlıklı seçim */
  pickIdle(e, sitting) {
    const h = this.hour, occ = e.res ? e.res.occ : e.role, L = [];
    const add = (k, w) => { if (w > 0) L.push([k, w]); };
    if (this.isKid(e)) { add('laugh', 1); add('point', 1.2); add('scratch', 0.8); add('wave', 0.5); add('tie', sitting ? 0 : 0.6); add('stretch', 0.4); add('shrug', 0.5); }
    else {
      if (this.smoker(e)) add('smoke', 3);
      if (occ === 'drifter') add('drink', 2.5); else if (h >= 19 || h < 2) add('drink', 0.5);
      add('watch', occ === 'teamster' || occ === 'keeper' ? 1.5 : 0.7);
      add('scratch', 0.8); add('cross', sitting ? 1.2 : 1.6); add('hips', sitting ? 0 : 1.1);
      add('stretch', h >= 5 && h < 10 ? 2 : 0.3); add('shrug', 0.3); add('point', 0.3); add('tie', sitting ? 0 : 0.35);
      if (sitting) add('read', occ === 'elder' ? 3 : 1.2);
      if (this.hotness > 0.25) add('fan', 3);
      if (this.coldness > 0.25) add('rub', 3);
    }
    let s = L.reduce((a, x) => a + x[1], 0) * Math.random();
    for (const [k, w] of L) if ((s -= w) <= 0) return k;
    return L.length ? L[0][0] : null;
  },
  /* Her kare: hareket sayacı, sigara dumanı, yürüyüş stili */
  animTick(e, dt) {
    const A = e.anim;
    if (A) {
      const u0 = A.t % 6;
      A.t += dt;
      if (A.t >= A.dur || (e.mv > 0.15 && !ANIM_MOVE[A.k])) e.anim = null;
      else if (A.k === 'smoke' && A.t > 1.3 && this.onScreen(e.x, e.y, 20)) {
        const u = A.t % 6, c = Math.cos(e.ang), s = Math.sin(e.ang);
        // üfleme: ağızdan çıkan bulut; arada sigaranın ucundan ince duman
        if (u0 < 1.45 && u >= 1.45) for (let k = 0; k < 2; k++) this.parts.add('breath', e.x + c * 5, e.y + s * 5 - 2, c * rnd(4, 8), s * rnd(4, 8) - 3, rnd(1.2, 1.8), 1.2);
        else if ((e.puffT = (e.puffT || 0) - dt) <= 0) { e.puffT = rnd(0.7, 1.3); this.parts.add('breath', e.x + c * 3 - s * 5, e.y + s * 3 + c * 5 - 3, rnd(-1.5, 1.5), rnd(-5, -3), 1.4, 0.5); }
      }
    }
    // yürüyüş stili: gece saloondan çıkan serseri sendeler
    if ((e.styleT = (e.styleT || 0) - dt) <= 0) {
      e.styleT = 1;
      const h = this.hour, occ = e.res && e.res.occ;
      e.walkStyle = (occ === 'drifter' && (h >= 21 || h < 4)) ? 'drunk' : null;
      // yağmurda yürürken şapkasını tutar
      const rain = (this.envCache || {}).rain || 0;
      if (rain > 0.35 && e.mv > 0.2 && !e.anim && !e.carry2 && e.res) this.setAnim(e, 'hurry');
    }
  },
  /* Otururken: gazete, sigara, kollar kavuşturulmuş... */
  sitTick(e, dt) { if (!e.anim && !e.talk && Math.random() < dt * 0.12) this.setAnim(e, this.pickIdle(e, true)); },
  /* Ayakta beklerken (kanun adamı, sürücü, duraklayan sakin) */
  standTick(e, dt, rate = 0.3) {
    if (e.anim || e.talk) return;
    if (Math.random() < dt * rate) {
      const k = this.pickIdle(e, false), A = this.setAnim(e, k);
      // duraklayan sakin hareketi bitirir ama durağını en fazla birkaç saniye uzatır
      if (A && !ANIM_MOVE[k] && e.res) { A.dur = Math.min(A.dur, Math.max(e.pauseT || 0, 1.5) + 2); e.pauseT = Math.max(e.pauseT || 0, A.dur); }
    }
  },

  /* ---------------- selamlaşma ---------------- */
  /* Sakin oyuncuyu selamlar; karşılık gelmezse bozulur. Meşgulse true döner. */
  helloTick(e, r, M, d2) {
    const P = this.player;
    if (e.hiWait) {
      if (this.t - e.hiWait > 7) { e.hiWait = 0; this.snubbed(e, r, M); }
      return true;
    }
    if (d2 > 55 * 55 || d2 < 10 * 10 || e.talk || e.state === 'sit' || P.masked) return false;
    const m = this.mem(r);
    if (m.hiDay === this.day || this.opOf(r) <= -30 || (this.hiT || 0) > this.t) return false;
    const k = { jolly: 0.55, grumpy: 0.12, shy: 0.18, gossip: 0.45, pious: 0.4, plain: 0.3 }[this.moodOf(r)] || 0.3;
    if (!chance(k * 0.35) || !this.los(e.x, e.y, P.x, P.y)) return false;
    m.hiDay = this.day; this.hiT = this.t + 12;
    const tod = this.timeOfDay(), op = this.opOf(r);
    const pool = this.isKid(e) ? HELLO.kid : op >= 30 ? HELLO.friend : HELLO[tod] || HELLO.day;
    e.ang = Math.atan2(P.y - e.y, P.x - e.x); e.talk = null;
    this.setAnim(e, this.isKid(e) || chance(0.5) ? 'wave' : 'tiphat');
    e.pauseT = Math.max(e.pauseT || 0, 3);
    Bubbles.add(e, this.fmtTalk(pick(pool), r.t), 2.6);
    e.hiWait = this.t;
    return true;
  },
  snubbed(e, r, M) {
    const mood = this.isKid(e) ? 'kid' : this.moodOf(r);
    Bubbles.add(e, this.fmtTalk(pick(SNUB[mood] || SNUB.plain), r.t), 2.8);
    this.setAnim(e, { grumpy: 'hips', jolly: 'shrug', gossip: 'point', pious: 'cross', plain: 'shrug', kid: 'hips' }[mood] || null);
    e.pauseT = Math.max(e.pauseT || 0, 2.4);
    this.resOpinion(e, mood === 'grumpy' ? -5 : mood === 'shy' ? -1 : -3, 'snub');
    const m = this.mem(r); m.snubDay = this.day;
    // dedikoducu ya da huysuzsa yakındaki birine dert yanar
    if (mood === 'gossip' || mood === 'grumpy' || chance(0.3)) {
      const o = this.ents.find(o => o !== e && o.res && !o.dead && !o.talk && !o.hostile && o.state !== 'flee' && dist2(o.x, o.y, e.x, e.y) < 70 * 70);
      if (o) setTimeout(() => { if (!e.dead && !e.remove && !o.dead && !o.remove && !e.talk && !o.talk) this.startTalk(e, o, r.t, pick(SNUB_TALK)); }, 2600);
    }
  },
  /* Oyuncu Selamla dediğinde: bekleyen selama karşılık verildiyse sevinir */
  helloAck(e) {
    if (!e.hiWait) return null;
    e.hiWait = 0;
    if (e.res) this.resOpinion(e, 3);
    this.setAnim(e, 'tiphat');
    return pick(THANKS);
  },
  /* Sakinler yolda birbirini selamlar */
  passTick(e) {
    if (e.talk || e.passCd > this.t || !e.mv) return;
    const o = this.ents.find(o => o !== e && o.res && !o.dead && !o.talk && o.mv > 0.1 && !(o.passCd > this.t) && dist2(o.x, o.y, e.x, e.y) < 24 * 24);
    if (!o || !chance(0.25)) return;
    e.passCd = o.passCd = this.t + rnd(40, 80);
    const [a, b] = pick(PASS), fn = (x) => x.name.split(' ')[0];
    Bubbles.add(e, a.replace('{y}', fn(o)).replace('{z}', fn(e)), 2);
    this.setAnim(e, chance(0.5) ? 'wave' : 'tiphat');
    setTimeout(() => { if (!o.dead && !o.remove) { Bubbles.add(o, b.replace('{y}', fn(o)).replace('{z}', fn(e)), 1.8); this.setAnim(o, 'tiphat'); } }, 900);
  },

  /* ---------------- araba sürücüsü ve yolcular ---------------- */
  /* Araba park yerine vardı: sürücü iner, posta arabasından yolcular iner */
  wagonArrive(w) {
    if (!w.driver || w.hauler || w.mine || !w.stopT) return;
    const t = w.stopT, W = this.world, st = w.seat;
    const at = (side) => { const a = w.bang + side * Math.PI / 2; return [st.x + Math.cos(a) * 11, st.y + Math.sin(a) * 11]; };
    let [x, y] = at(1);
    if (W.blocked(x, y, 4) || W.indoorPx(x, y)) [x, y] = at(-1);
    const n = new NPC(x, y, 'teamster', { look: w.driver.look, name: w.driver.name, money: rnd(0.5, 3) });
    n.town = t.id; n.ang = w.bang + Math.PI / 2;
    // posta çantası yakındaki postaneye ya da istasyona götürülür (uzaksa bekler)
    const post = t.buildings.filter(b => (b.type === 'post' || b.type === 'station') && dist2(b.door.x, b.door.y, w.x, w.y) < 220 * 220)[0];
    n.job = { kind: 'teamster', w, phase: w.stage ? (post ? 'unload' : 'rest') : (w.cargo && w.shop ? 'unload' : 'rest'), trips: w.stage ? 1 : rndi(2, 4), t: 0, to: w.stage ? post : w.shop };
    w.awayDriver = w.driver; w.driver = null; w.driverEnt = n;
    this.addEnt(n);
    Bubbles.add(n, pick(TEAMSTER.arrive), 2.4);
    if (w.stage) {
      const dests = ['hotel', 'saloon', 'station', 'general'].map(ty => t.buildings.find(b => b.type === ty)).filter(Boolean);
      for (let k = rndi(1, 2); k > 0 && dests.length; k--) {
        let [px, py] = at(-1); px += rnd(-4, 4); py += rnd(-4, 4);
        if (W.blocked(px, py, 4) || W.indoorPx(px, py)) continue;
        const p = new NPC(px, py, 'traveler', { money: rnd(1, 6) });
        p.town = t.id; p.job = { kind: 'passenger', b: pick(dests), t: rnd(0.8, 2) };
        this.addEnt(p);
        if (chance(0.6)) setTimeout(() => { if (!p.dead && !p.remove) Bubbles.add(p, this.fmtTalk(pick(PASSENGER), t), 2.4); }, 700);
      }
    }
  },
  /* Park halindeki arabanın sürücüsü dışarıdayken */
  wagonPark(w, dt) {
    const d = w.driverEnt;
    if (!d || d.dead || d.remove || d.bound || d.hostile || d.state === 'flee' || d.state === 'report' || !d.job) {
      // sürücü öldü, bağlandı, kaçtı: araba sürücüsüz kalır
      w.driverEnt = null; w.awayDriver = null; if (d && !d.dead) d.job = null;
      return;
    }
    w.parkT -= dt;
    if (w.parkT <= 0 && d.job.phase !== 'return' && d.job.phase !== 'inside') { d.job.phase = 'return'; d.anim = null; d.carry2 = null; d.nav = null; }
  },
  /* İş yapan NPC (sürücü, yolcu) */
  jobUpdate(e, dt) {
    const J = e.job;
    if (e.talk) { e.mv = 0; return; }
    if (J.kind === 'passenger') {
      if ((J.t -= dt) > 0) { e.mv = 0; if (!e.anim && chance(dt * 0.8)) this.setAnim(e, 'stretch'); return; }
      const r = this.navStep(e, J.b.door.x, J.b.door.y + 3, dt, 30, { near: 7 });
      if (r !== 'moving') { e.remove = true; }
      return;
    }
    const w = J.w;
    if (!w || w.remove) { e.job = null; e.hide = false; if (!this.onScreen(e.x, e.y, 30)) e.remove = true; else e.home = { x: e.x, y: e.y, r: 60 }; return; }
    if (w.rider) {
      // araba çalınıyor
      e.hide = false; e.carry2 = null; e.anim = null; e.job = null; w.driverEnt = null;
      Bubbles.add(e, pick(TEAMSTER.stolen), 2.6);
      e.state = 'flee'; e.t = 6;
      return;
    }
    const c = Math.cos(w.bang), s = Math.sin(w.bang);
    switch (J.phase) {
      case 'unload': {
        const B = J.to;
        if (J.trips <= 0 || !B) { J.phase = 'rest'; break; }
        const rx = w.bx - c * 13, ry = w.by - s * 13;
        const r = this.navStep(e, rx, ry, dt, 32, { near: 7, straight: true, ignore: w });
        if (r === 'arrived' || r === 'fail') { J.phase = 'load'; J.t = rnd(0.8, 1.2); e.ang = Math.atan2(w.by - e.y, w.bx - e.x); this.setAnim(e, 'tie', J.t); }
        break;
      }
      case 'load':
        e.mv = 0;
        if ((J.t -= dt) <= 0) { e.carry2 = 'crate'; e.anim = null; J.phase = 'toDoor'; if (chance(0.35)) Bubbles.add(e, pick(TEAMSTER.carry), 1.8); }
        break;
      case 'toDoor': {
        const B = J.to, r = this.navStep(e, B.door.x, B.door.y + 3, dt, 24, { near: 7 });
        if (r === 'arrived' || r === 'fail') { J.phase = 'inside'; J.t = rnd(1.2, 2.2); e.hide = true; e.x = B.door.x; e.y = B.door.y + 3; e.mv = 0; }
        break;
      }
      case 'inside':
        if ((J.t -= dt) <= 0) {
          e.hide = false; e.carry2 = null; J.trips--; e.ang = Math.PI / 2;
          J.phase = w.parkT <= 0 ? 'return' : 'unload';
        }
        break;
      case 'rest': {
        // atların yanında bekler
        if (!J.spot) { const px = w.x - s * 13 - c * 2, py = w.y + c * 13 - s * 2; J.spot = this.world.blocked(px, py, 4) ? [w.x + s * 13, w.y - c * 13] : [px, py]; }
        const r = this.navStep(e, J.spot[0], J.spot[1], dt, 30, { near: 6, straight: true, ignore: w });
        if (r !== 'moving') { J.phase = 'idle'; e.ang = Math.atan2(w.y - e.y, w.x - e.x); if (chance(0.4)) Bubbles.add(e, pick(TEAMSTER.rest), 2.2); }
        break;
      }
      case 'idle': {
        e.mv = 0;
        if (!e.anim) {
          if (chance(dt * 0.5)) {
            const k = chance(0.3) ? 'pat' : this.pickIdle(e, false);
            if (k === 'pat') { e.ang = Math.atan2(w.y - e.y, w.x - e.x); if (chance(0.4)) Bubbles.add(e, pick(TEAMSTER.horse), 1.8); }
            this.setAnim(e, k);
          }
          // yakındaki biriyle yol sohbeti
          if (chance(dt * 0.06)) {
            const o = this.ents.find(o => o.res && !o.dead && !o.talk && !o.hostile && o.state !== 'flee' && dist2(o.x, o.y, e.x, e.y) < 60 * 60);
            if (o) this.startTalk(e, o, w.stopT, pick(TEAM_TALK));
          }
        }
        break;
      }
      case 'return': {
        const st = w.seat, a = w.bang + Math.PI / 2;
        let x = st.x + Math.cos(a) * 9, y = st.y + Math.sin(a) * 9;
        if (this.world.blocked(x, y, 4)) { x = st.x - Math.cos(a) * 9; y = st.y - Math.sin(a) * 9; }
        const r = this.navStep(e, x, y, dt, 34, { near: 6, straight: true, ignore: w });
        if (r !== 'moving') {
          // arabaya biner: yeniden sürücü koltuğunda
          e.remove = true; w.driver = w.awayDriver || { look: e.look, name: e.name }; w.driverEnt = null; w.awayDriver = null;
          w.parkT = 1; Bubbles.add(w, pick(TEAMSTER.leave), 2);
        }
        break;
      }
    }
  },
};
