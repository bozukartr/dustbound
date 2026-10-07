'use strict';
/* ==========================================================
   FRONTIER'S END — yumruk kavgası ve özür
   Kasabalıya (kanun adamı dışında) yumrukla vurmak hemen suç sayılmaz: 1890'da sokakta
   yumruklaşma olağandır. Vurulan kişi karakterine göre karşılık verir, öfkeyle uyarır ya da kaçar.
   - Karşılık veren biriyle dövüşmek suç değildir; yenilen "yeter" der, kazanan seni yere serer
     (öldürmez). Yere serilen ya da teslim olan birine vurmaya devam etmek saldırıdır.
   - Karşılık vermeyen birine üst üste vurmak (üçüncü yumruk) saldırı suçu olur.
   - Silah dipçiği ve bıçak kavga sayılmaz; kanun adamına vurmak her zaman suçtur.
   - "Özür Dile": kişiliğine, kaç kez vurduğuna ve kavganın nasıl bittiğine göre kabul edilir ya da edilmez.
   ========================================================== */
const BRAWL_ROLES = new Set(['town', 'traveler', 'clerk', 'farmer', 'teamster', 'stranger', 'romance', 'nomad']);
const BRAWL_RESET = 90;     // sn: bu kadar süre yumruk yemeyen kişiyle kavga kapanmış sayılır
const BRAWL_SORRY = 180;    // sn: özür dilenebilecek süre
// kişiliğe göre kavgaya yatkınlık ve özrü kabul etme eğilimi
const BRAWL_MOOD = {
  grumpy: { grit: 0.75, forgive: 0.35 }, jolly: { grit: 0.5, forgive: 0.8 }, plain: { grit: 0.45, forgive: 0.7 },
  gossip: { grit: 0.3, forgive: 0.6 }, pious: { grit: 0.15, forgive: 0.92 }, shy: { grit: 0.1, forgive: 0.8 },
};
const BRAWL_OCC = { laborer: 0.2, miner: 0.25, dockhand: 0.25, lumberman: 0.25, farmhand: 0.15, drifter: 0.25, elder: -0.3, homemaker: -0.1 };
const BRAWL_KEEPER = { smith: 0.2, butcher: 0.2, saloon: 0.15, stable: 0.1, lumber: 0.15, brewery: 0.1, church: -0.35, doctor: -0.2, bank: -0.2, pharmacy: -0.2 };

const BrawlSystems = {
  /* Yumrukla vurulunca suç yerine kavga kuralları geçerli olur mu */
  brawlOK(e) {
    if (e.kind !== 'npc' || e.dead || e.isLaw || e.hostile || e.quest || e.storyNpc || e.bountyId || e.mounted) return false;
    if (!BRAWL_ROLES.has(e.role) || (e.eventType && e.eventType !== 'peddler')) return false;
    if (e.res && OCCS[e.res.occ] && OCCS[e.res.occ].kid) return false;
    return true;
  },
  /* Kavgaya yatkınlık (0-1): kişilik, meslek, cinsiyet ve oyuncu hakkındaki fikri */
  brawlGrit(e) {
    const r = e.res;
    const mood = r ? this.moodOf(r) : null;
    let g = mood ? BRAWL_MOOD[mood].grit : 0.3 + hash2(e.name.length * 11, e.name.charCodeAt(0) * 3, 77) * 0.4;
    if (r) g += BRAWL_OCC[r.occ] || 0;
    if (r && r.occ === 'keeper' && r.work) g += BRAWL_KEEPER[r.work.type] || 0;
    if (e.role === 'traveler' || e.role === 'teamster' || e.role === 'nomad') g += 0.1;
    if (e.sex === 'f') g -= 0.25;
    if (r) { const op = this.opOf(r); if (op >= 40) g -= 0.15; else if (op <= -30) g += 0.15; }
    return clamp(g, 0.02, 0.95);
  },
  /* NPC.hurt'tan: yumruk bu kural içinde kalıyorsa true (suç yazılmaz, kaçış kuralı uygulanmaz) */
  brawlHit(e) {
    if (!this.brawlOK(e)) return false;
    let B = e.brawl;
    if (!B || (this.t - B.t > BRAWL_RESET && e.state !== 'fightFist')) B = e.brawl = { hits: 0, free: 0, fought: false, yielded: false, won: false, t: 0 };
    B.hits++; B.t = this.t; B.sorry = false;
    if (B.crime) return false;
    // kavga sürüyor: karşılıklı dövüş suç değildir
    if (e.state === 'fightFist') { B.fought = true; B.free = 0; return true; }
    // teslim olmuş, yere serilmiş ya da karşılık vermeyen birini dövmeye devam etmek saldırıdır
    B.free++;
    if (B.yielded || e.bound || B.free >= 3) { B.crime = true; return false; }
    if (e.hp <= 0) return true;   // bayıldı (KO): yere yığılma NPC.hurt'ta
    this.addHonor(-0.5);
    const g = this.brawlGrit(e) + (B.free - 1) * 0.3 + (B.fought ? 0.3 : 0);
    const r = Math.random();
    if (e.hp > e.maxHp * 0.45 && r < g) this.brawlStart(e);
    else if (B.free === 1 && r < g + 0.4) {
      // öfkeyle yüzleşir, bir daha vurulursa karar verir
      e.state = 'glare'; e.t = 5; e.mv = 0;
      e.say(pick([Tr('Hey! Dikkat etsene!'), Tr('Bir daha yaparsan pişman olursun.'), Tr('Ne yaptığını sanıyorsun sen?'), Tr('Elini kendine sakla, yabancı.')]), 2.5);
      if (e.res) this.resOpinion(e, -4, 'hit');
    } else {
      e.state = 'flee'; e.t = 6;
      e.say(pick([Tr('Delisin sen!'), Tr('Uzak dur benden!'), Tr('Yardım edin, deli bu!')]), 2);
      if (e.res) this.resOpinion(e, -6, 'hit');
    }
    return true;
  },
  brawlStart(e) {
    const B = e.brawl;
    e.state = 'fightFist'; e.fistOK = true; e.cool = 0.7; e.calmT = 0; B.fought = true; B.free = 0;
    e.say(pick([Tr('Bunu sana ödeteceğim!'), Tr('Gel bakalım, göster kendini!'), Tr('Yanlış adama vurdun!'), Tr('Seni gidi... Kalk ellerini!')]), 2);
    if (e.res) this.resOpinion(e, -6, 'hit');
    // çevredekiler kavgaya bakar
    let n = 0;
    for (const o of this.ents) {
      if (n >= 2 || o === e || o.kind !== 'npc' || o.dead || o.hostile || o.isLaw || o.bound || dist2(o.x, o.y, e.x, e.y) > 150 * 150) continue;
      if (chance(0.5)) { o.say(pick([Tr('Kavga! Kavga!'), Tr('Vur şuna!'), Tr('Ayırın şunları!'), Tr('Bir dolarına bahse girerim, yabancı kaybeder.')]), 2); n++; }
    }
  },
  /* Kavganın sonu: NPC yeniliyor (teslim) */
  brawlYield(e) {
    const B = e.brawl;
    if (B) B.yielded = true;
    e.state = 'glare'; e.t = 6; e.mv = 0;
    e.say(pick([Tr('Tamam, tamam! Yeter!'), Tr('Pes ediyorum, yeter!'), Tr('Kazandın... Bırak artık.')]), 2.5);
    if (!B) this.addHonor(-1);
  },
  /* Kavganın sonu: NPC oyuncuyu yere serdi (yumruk kavgasında ölüm yok) */
  brawlWin(e) {
    const B = e.brawl;
    if (B) B.won = true;
    e.state = 'glare'; e.t = 5; e.mv = 0;
    e.say(pick([Tr('Bu sana ders olsun.'), Tr('Bir daha düşün, sonra vur.'), Tr('Kalk da evine git, yabancı.')]), 3);
    UI.feed(Tr`${e.name} seni yere serdi.`, 'warn');
  },
  /* Öfkeyle yüzleşme: oyuncuya bakar, süre bitince günlük işine döner */
  glareTick(e, dt, pd) {
    const P = this.player;
    e.mv = 0;
    e.ang = turnTo(e.ang, Math.atan2(P.y - e.y, P.x - e.x), dt * 5);
    if (e.t <= 0 || pd > 220) { e.state = 'idle'; e.t = 2; if (e.res) e.goal = null; }
  },
  /* Kavgadan uzaklaşınca karşıdaki sakinleşir */
  brawlCalm(e, dt, pd) {
    if (pd < 60) { e.calmT = 0; return false; }
    e.calmT = (e.calmT || 0) + dt;
    if (e.calmT < 6 && pd < 250) return false;
    e.state = 'idle'; e.t = 2; e.calmT = 0; if (e.res) e.goal = null;
    e.say(pick([Tr('Bir daha karşıma çıkma!'), Tr('Kaç bakalım, korkak.'), Tr('Hah! Gördün mü?')]), 2);
    return true;
  },

  /* ---------------- özür ---------------- */
  canApologize(e) {
    const B = e.brawl;
    return !!B && !B.crime && !B.sorry && !e.assaulted && !e.dead && !e.bound && this.t - B.t < BRAWL_SORRY && !(B.noT && this.t < B.noT);
  },
  apologize(e) {
    const B = e.brawl, P = this.player, r = e.res;
    const mood = r ? this.moodOf(r) : 'plain';
    UI.subtitle(P.name, B.fought ? pick([Tr('Kusura bakma, fazla ileri gittim.'), Tr('Özür dilerim, kendimi kaybettim.')]) : pick([Tr('Kusura bakma, istemeden oldu.'), Tr('Özür dilerim, seni görmedim.')]), 1.6, true);
    let p = BRAWL_MOOD[mood].forgive;
    p -= (B.hits - 1) * 0.12;
    if (B.hits === 1 && !B.fought) p += 0.2;      // tek yumruk: kaza sayılabilir
    if (B.won) p += 0.25;                         // kavgayı kazanan gönlü rahat affeder
    if (B.yielded) p -= 0.1;
    if (r) { const op = this.opOf(r); p += op >= 30 ? 0.15 : op <= -40 ? -0.2 : 0; }
    p += this.skill('charisma') * 0.03;
    p = clamp(p, 0.05, 0.97);
    e.ang = Math.atan2(P.y - e.y, P.x - e.x);
    const ok = Math.random() < p;
    setTimeout(() => {
      if (e.dead || e.remove) return;
      if (ok) {
        B.sorry = true;
        if (e.state === 'fightFist' || e.state === 'glare' || e.state === 'flee') { e.state = 'idle'; e.t = 2; if (e.res) e.goal = null; }
        e.say(mood === 'pious' ? pick([Tr('Affettim. Git ve bir daha yapma.'), Tr('Tanrı affeder, ben de affediyorum.')])
          : mood === 'jolly' ? pick([Tr('Hah! Yumruğun fena değilmiş. Unut gitsin.'), Tr('Boş ver, bir içki ısmarlarsın.')])
          : mood === 'grumpy' ? pick([Tr('Hıh. Peki. Ama gözüm üstünde.'), Tr('Bu seferlik.')])
          : pick([Tr('Peki, olur böyle şeyler.'), Tr('Tamam, unutalım.'), Tr('Özrün kabul.')]), 3);
        if (r) this.resOpinion(e, B.hits === 1 && !B.fought ? 6 : 4, 'sorry');
        this.addHonor(0.5); this.skillXp('charisma', 1);
      } else {
        B.noT = this.t + 25;
        e.say(pick([Tr('Özrünü kendine sakla.'), Tr('Şimdi mi aklın başına geldi?'), Tr('Kelimeler yetmez, yabancı.'), Tr('Defol karşımdan.')]), 3);
      }
    }, 900);
  },
};
