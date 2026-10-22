'use strict';
/* ==========================================================
   FRONTIER'S END — malikane, hizmetçiler, özel kulüp ve özel fayton
   (G nesnesine eklenir)
   - Saint Clement Malikanesi (dünya sürümü 5): şehrin kuzeyinde, yan
     bahçeli, iki katlı. Zemin kat büyük salon (şömine, piyano, yemek
     masaları, mutfak köşesi); üst katta çalışma odası, banyo, yatak
     odası ve misafir odası. Kapısından ya da tapu dairesinden / ilçe
     binasından satın alınır ve ev gibi kullanılır: yatakta uyku ve
     kayıt, sandık, ocak, küvet.
   - Hizmetçiler üst kattaki çalışma masasından (Malikane Defteri)
     tutulur: aşçı her sabah sıcak kahvaltı hazırlar, seyis bahçe
     kapısına getirilen atı tımarlar, besler ve dinlendirir; uşak kapıda
     karşılar, ganimeti sandığa kaldırır, faytonu kapıya getirtir.
   - Özel kulüp: üyelik ücretlidir, kapı yalnızca üyelere açılır. Okuma
     odasında gazeteler, puro ve konyak salonunda bar, üst katta yüksek
     bahisli kart odası ve bilardo salonu.
   - Özel fayton: ahırdan alınır; ahırdan, postaneden ya da uşaktan
     çağrılır. Bindiğinde gideceğin yeri seçersin, arabacı yolu sürer:
     yolculuğu izlersin, onay tuşunu basılı tutarak yolu atlarsın,
     etkileşim tuşuyla inersin. Atın faytonun arkasına bağlanıp gelir.
   Hizmetçilerin ve arabacının ücreti günlüktür (önce banka, sonra
   cüzdan); iki gün ödenmezse işi bırakırlar.
   ========================================================== */

/* Hizmetçilerin sözleri */
const SERVANT_LINES = {
  cook: ['Kilerde taze un ve tereyağı var, efendim.', 'Sabahları ocağı erkenden yakarım; kahvaltınız hep sıcak olur.', 'Pazardan istiridye aldım; akşama güzel bir sofra kurarım.', 'Mutfağım temiz, tenceremiz dolu. Daha ne isteriz?'],
  butler: ['Her şey yolunda, efendim.', 'Sandığınızı düzenledim, efendim.', 'Bir beyefendi kartvizitini bıraktı; yine uğrayacakmış.', 'Şömine yandı, odalarınız hazır.'],
  groom: ['Atınız iyi bakılıyor, efendim.', 'Nallarını kontrol ettim, sağlamlar.', 'Bahçenin kenarında biraz otlattım; keyfi yerinde.', 'Eyeri yağladım, kayışları değiştirdim.'],
  greet: ['Hoş geldiniz, efendim. Eviniz hazır.', 'Hoş geldiniz. Şömine yandı, sizi bekliyordu.', 'Döndüğünüze sevindim, efendim.', 'İyi akşamlar, efendim. Bir arzunuz var mı?'],
};
/* Hizmetçinin malikanedeki yeri: yerel karo ve baktığı yön (seyis bahçe kapısında, b.garden) */
const SERVANT_AT = { cook: [1, 6, Math.PI / 2], butler: [8, 8, Math.PI * 0.75] };

const EstateSystems = {
  /* ---------------- malikane ---------------- */
  mansionB() {
    const W = this.world, c = this._manB;
    if (c && W.buildings[c.id] === c) return c;
    return (this._manB = W.buildings.find(b => b.type === 'mansion') || null);
  },
  mansionPrice() { return Math.round(MANSION_PRICE * this.priceMul(true)); },
  buyMansion(b) {
    if (this.estate) return false;
    if (this.law.level > 0) { UI.feed(Tr('Aranırken kimse sana tapu vermez.'), 'warn'); return false; }
    if (!this.spend(this.mansionPrice())) return false;
    this.estate = { bid: b.id, since: this.day, staff: {}, meal: -1, groomed: -1 };
    Audio_.ui('cash');
    UI.toast(Tr('Malikane Senin'), Tr`${b.name} artık senin. Yatağında uyuyup oyunu kaydedebilir, sandığı, ocağı ve küveti kullanabilirsin.`, 'ok');
    this.hintOnce('mansion', Tr`Merdivenler salonun iki arka köşesinde. Hizmetçileri üst kattaki <b>çalışma odasının masasından</b> (Malikane Defteri) tutarsın: aşçı, seyis ve uşak günlük ücretle çalışır.`, 10);
    this.stat('mansions', 1);
    this.qEvent('mansion', b);
    return true;
  },
  /* Malikanenin eşyaları (yalnızca sahibine): yatak, sandık, ocak, küvet, çalışma masası, yemek masası */
  mansionFurn(b, o) {
    const U = UI, P = this.player;
    if (!this.estate) return o === O.DESK ? null : undefined;
    switch (o) {
      case O.BED: return { label: Tr('Yatağın'), acts: [{ n: Tr('Uyu'), qe: ['sleep', 'home'], fn: () => U.openSleep('home') }, { n: Tr('Oyunu Kaydet'), fn: () => this.saveGame() }] };
      case O.HOMECHEST: return { label: Tr('Sandık'), acts: [{ n: Tr('Sandığı Aç'), fn: () => U.openStash() }] };
      case O.STOVE: return { label: Tr('Ocak'), acts: [{ n: Tr('Yemek Pişir'), fn: () => U.openCook() }] };
      case O.TUB: return { label: Tr('Küvet'), acts: [{ n: Tr('Sıcak Banyo'), fn: () => { P.clean = 100; P.warmBuff = Math.max(P.warmBuff, 60); UI.feed(Tr('🛁 Malikanenin banyosunda sıcak bir banyo yaptın.')); this.advanceClock(30); } }] };
      case O.DESK: return { label: Tr('Çalışma Masası'), acts: [{ n: Tr('Malikane Defteri'), fn: () => U.openLedger(b) }] };
      case O.TABLE: {
        const acts = [];
        if (this.breakfastReady()) acts.push({ n: Tr('Kahvaltı Et'), qe: ['eat', 'meal'], fn: () => this.breakfast() });
        acts.push({ n: Tr('Otur ve Bekle'), fn: () => U.openWait() });
        return { label: Tr('Yemek Masası'), acts };
      }
    }
    return undefined;
  },

  /* ---------------- hizmetçiler ---------------- */
  servant(k) { return this.estate && this.estate.staff[k] || null; },
  hireServant(k) {
    const E = this.estate;
    if (!E || E.staff[k]) return false;
    const sex = k === 'cook' ? (chance(0.6) ? 'f' : 'm') : chance(0.8) ? 'm' : 'f', look = randomLook(sex);
    if (k === 'butler') Object.assign(look, { coat: '#1c1c22', shirt: '#f0ece0', pants: '#1c1c22', hat: 'none', coatLen: 0.7 });
    else if (k === 'cook') Object.assign(look, { coat: '#ece6d8', shirt: '#f4f0e6', hat: 'none', coatLen: 0.7 });
    else Object.assign(look, { coat: '#6a4a2a', hat: 'flat' });
    E.staff[k] = { name: randomName(sex), look, since: this.day, unpaid: 0 };
    Audio_.ui('pick');
    UI.feed(Tr`🏠 ${SERVANTS[k].n} olarak ${E.staff[k].name} işe başladı (günlük ${fmtMoney(SERVANTS[k].wage)}).`);
    this.servantSync(true);
    return true;
  },
  fireServant(k) {
    const E = this.estate, s = E && E.staff[k];
    if (!s) return;
    delete E.staff[k];
    UI.feed(Tr`🏠 ${SERVANTS[k].n} ${s.name} işten ayrıldı.`);
    this.servantSync(true);
  },
  /* Ücret: önce banka, sonra cüzdan */
  payWage(w) {
    if (this.bank >= w) { this.bank -= w; return true; }
    if (this.player.money >= w) { this.player.money -= w; return true; }
    return false;
  },
  estateDaily() {
    const E = this.estate;
    if (E) for (const k of Object.keys(E.staff)) {
      const s = E.staff[k];
      if (this.payWage(SERVANTS[k].wage)) s.unpaid = 0;
      else if (++s.unpaid >= 2) { delete E.staff[k]; UI.toast(Tr('Hizmetçin Gitti'), Tr`${SERVANTS[k].n} ${s.name} iki gündür ücretini alamadığı için malikaneden ayrıldı.`, 'wanted'); }
      else UI.feed(Tr`🏠 ${SERVANTS[k].n} ${s.name} ücretini alamadı. Yarın da ödenmezse gidecek.`, 'warn');
    }
    const C = this.carriage;
    if (C && C.driver) {
      if (this.payWage(CARRIAGE_WAGE)) C.unpaid = 0;
      else if (++C.unpaid >= 2) { UI.toast(Tr('Arabacın Gitti'), Tr`Arabacın ${C.driver.name} iki gündür ücretini alamadığı için işi bıraktı. Ahırdan yeni bir arabacı tutabilirsin.`, 'wanted'); C.driver = null; this.coachAway(); }
      else UI.feed(Tr`🐴 Arabacın ${C.driver.name} ücretini alamadı. Yarın da ödenmezse gidecek.`, 'warn');
    }
    if (E) this.servantSync(true);
  },
  /* Hizmetçiler oyuncu malikanenin yakınındayken yerlerinde durur (aşçı mutfakta, uşak kapının iç yanında, seyis bahçe
     kapısında); uzaklaşınca dünyadan kalkarlar. Biri öldürülürse işten düşer. */
  servantSync(force) {
    const E = this.estate, b = this.mansionB(), P = this.player, S = this._serv || (this._serv = {});
    if (!force && (this._servT = (this._servT || 0) - 1) > 0) return;   // her karede değil, yirmi karede bir
    this._servT = 20;
    const near = !!E && !!b && dist2(P.x, P.y, b.door.x, b.door.y) < 750 * 750;
    for (const k of Object.keys(SERVANTS)) {
      const s = E && E.staff[k], e = S[k];
      if (e && (e.dead || e.remove)) {
        if (e.dead && s) { delete E.staff[k]; UI.toast(Tr('Hizmetçin Öldü'), Tr`${SERVANTS[k].n} ${s.name} öldü.`, 'wanted'); }
        S[k] = null;
        continue;
      }
      if (s && near && !e) {
        const p = this.servantSpot(b, k);
        const n = new NPC(p.x, p.y, 'clerk', { state: 'static', home: { x: p.x, y: p.y, r: 6 }, look: s.look, name: s.name, money: rnd(0.2, 1.2) });
        n.ang = p.ang; n.servant = k; n.keep = true; n.town = b.town; n.keepTown = true;
        this.addEnt(n); S[k] = n;
      } else if (e && (!s || !near)) { e.remove = true; S[k] = null; }
    }
  },
  servantSpot(b, k) {
    const A = SERVANT_AT[k];
    if (A) return { x: (b.x + A[0]) * TS + 8, y: (b.y + A[1]) * TS + 8, ang: A[2] };
    const g = b.garden;
    return g ? { x: g.gate.x + 16, y: g.gate.y, ang: Math.PI / 2 } : { x: b.door.x + 40, y: b.door.y + 18, ang: Math.PI / 2 };
  },
  servantActions(e) {
    const k = e.servant, acts = [], line = () => e.say(pick(SERVANT_LINES[k]), 3);
    if (k === 'cook') {
      if (this.breakfastReady()) acts.push({ n: Tr('Kahvaltı Et'), qe: ['eat', 'meal'], fn: () => this.breakfast() });
      else acts.push({ n: Tr('Konuş'), fn: () => e.say(this.estate && this.estate.meal === this.day ? Tr('Yarın sabah yine sıcak bir kahvaltı hazırlarım, efendim.') : this.hour >= 11 ? Tr('Kahvaltı sabahları, beşle on bir arası, efendim.') : pick(SERVANT_LINES.cook), 3) });
    } else if (k === 'butler') {
      acts.push({ n: Tr('Ganimeti Sandığa Kaldır'), fn: () => this.stowLoot(e) });
      if (this.carriage && this.carriage.driver) acts.push({ n: Tr('Faytonu Kapıya Getirt'), fn: () => this.coachCall(this.mansionB(), e) });
      acts.push({ n: Tr('Konuş'), fn: line });
    } else {
      const h = this.horse;
      if (h && !h.dead && !h.rider && dist(h.x, h.y, e.x, e.y) < 260) acts.push({ n: Tr('Atınla İlgilensin'), fn: () => this.groomHorse(true, e) });
      acts.push({ n: Tr('Konuş'), fn: line });
    }
    return acts;
  },
  /* Aşçının kahvaltısı: sabah 5-11 arası, günde bir */
  breakfastReady() { const E = this.estate; return !!E && !!E.staff.cook && this.hour >= 5 && this.hour < 11 && E.meal !== this.day; },
  breakfast(auto) {
    const P = this.player, E = this.estate, c = E.staff.cook;
    E.meal = this.day;
    P.hunger = 100; P.thirst = Math.min(100, P.thirst + 50); P.hp = Math.min(P.maxHp, P.hp + 25); P.energy = Math.min(100, P.energy + 10); P.warmBuff = Math.max(P.warmBuff, 150);
    this.stat('eaten', 1);
    UI.feed(auto ? Tr`🍳 Aşçı ${c.name} kahvaltını hazırlamış: sıcak ekmek, yumurta, kızarmış et ve kahve. Karnın doydu, için ısındı.` : Tr`🍳 Aşçı ${c.name} sıcak bir kahvaltı getirdi. Karnın doydu, için ısındı.`);
    if (!auto) this.advanceClock(20);
    this.qEvent('eat', 'meal');
  },
  /* Malikanede uyanınca: aşçı varsa sabah kahvaltısı hazır */
  estateWake() { if (this.breakfastReady()) this.breakfast(true); },
  /* Uşak: post, deri, değerli eşya ve koleksiyon parçalarını sandığa kaldırır */
  stowLoot(e) {
    const P = this.player;
    let n = 0;
    for (const id of Object.keys(P.inv)) {
      const c = ITEMS[id] && ITEMS[id].c;
      if (c !== 'animal' && c !== 'valuable' && c !== 'collect') continue;
      const q = P.inv[id];
      P.removeItem(id, q);
      this.stash[id] = (this.stash[id] || 0) + q; n += q;
    }
    if (e) e.say(n ? Tr`Eşyalarınızı sandığa kaldırdım, efendim.` : Tr('Kaldırılacak bir şey yok, efendim.'), 3);
    UI.feed(n ? Tr`📦 Uşağın ${n} parça post, değerli eşya ve koleksiyonu yatak odasındaki sandığa kaldırdı.` : Tr('Çantanda sandığa kaldırılacak ganimet yok.'));
    if (n) Audio_.ui('pick');
  },
  /* Seyis: atın bahçe kapısının yakınındaysa tımarlanır, beslenir ve dinlenir (günde bir bağ kurar) */
  groomHorse(asked, e) {
    const E = this.estate, h = this.horse, s = E && E.staff.groom;
    if (!s || !h || h.dead || h.rider) return;
    h.hp = h.maxHp; h.sta = h.maxSta; h.dirty = 0;
    if (E.groomed !== this.day) { E.groomed = this.day; h.addBond(2); UI.feed(Tr`🐴 Seyis ${s.name} atın ${h.name} ile ilgilendi: tımarlandı, beslendi, dinlendi.`); }
    else if (asked) UI.feed(Tr`🐴 ${h.name} tımarlı ve dinç.`);
    if (e) e.say(pick(SERVANT_LINES.groom), 3);
  },
  groomTick() {
    const E = this.estate, h = this.horse, b = this.mansionB();
    if (!E || !E.staff.groom || !h || h.dead || h.rider || !b) return;
    const g = b.garden ? b.garden.gate : b.door;
    if (dist2(h.x, h.y, g.x, g.y) > 240 * 240) return;
    if (h.hp < h.maxHp || h.sta < h.maxSta - 1 || h.dirty > 0 || E.groomed !== this.day) this.groomHorse(false);
  },
  /* Uşak, sahibini kapıda karşılar */
  butlerGreet() {
    const e = this._serv && this._serv.butler;
    if (!e || e.dead || e.remove) return;
    e.ang = Math.atan2(this.player.y - e.y, this.player.x - e.x);
    e.say(pick(SERVANT_LINES.greet), 3);
  },

  /* ---------------- kulüp ---------------- */
  clubPrice() { return CLUB_FEE; },
  joinClub(b) {
    const P = this.player;
    if (this.club) return true;
    if (this.law.level > 0) { UI.feed(Tr('"Kanunla başı dertte olan biri bu kapıdan giremez."'), 'warn'); return false; }
    if (P.masked) { UI.feed(Tr('"Maskeli birini içeri alamam."'), 'warn'); return false; }
    if (P.clean < 30) { UI.feed(Tr('"Üstünüz başınız toz toprak. Bir banyo yapıp öyle gelin."'), 'warn'); return false; }
    if (!this.spend(this.clubPrice())) return false;
    this.club = { since: this.day };
    Audio_.ui('cash');
    UI.toast(Tr('Kulüp Üyeliği'), Tr`${b.name} üyesisin. Puro ve konyak salonu, okuma odası, üst katta kart odası ve bilardo salonu emrinde.`, 'ok');
    this.hintOnce('club', Tr`Kulüpte okuma odasındaki kürsüden günün gazetelerini okursun; bar puro ve konyak satar. Merdiven sağ arka köşede: üst katta <b>yüksek bahisli poker</b> ve <b>bilardo</b> oynanır.`, 10);
    this.qEvent('club', b);
    return true;
  },
  /* Kulübün eşyaları: üye değilsen oyun ve hizmet yok */
  clubFurn(b, o) {
    const members = (label) => ({ label, acts: [{ n: Tr('Yalnızca Üyeler'), fn: () => UI.feed(Tr('"Bu salon yalnızca kulüp üyelerine açık."'), 'warn') }] });
    if (!this.club) {
      if (o === O.CARDTABLE) return members(Tr('Kart Masası'));
      if (o === O.BILLIARD) return members(Tr('Bilardo Masası'));
      if (o === O.LECTERN) return members(Tr('Gazete Kürsüsü'));
      if (o === O.BAR) return members(Tr('Bar'));
      return undefined;
    }
    const P = this.player;
    switch (o) {
      case O.LECTERN: return { label: Tr('Gazete Kürsüsü'), acts: [{ n: Tr('Gazeteleri Oku'), qe: ['news'], fn: () => UI.clubPapers() }] };
      case O.BILLIARD: return { label: Tr('Bilardo Masası'), acts: [{ n: Tr('Bilardo Oyna'), fn: () => UI.openBilliards(b) }] };
      case O.CARDTABLE: return { label: Tr('Kart Masası'), acts: [{ n: Tr('Yüksek Bahisli Poker'), fn: () => UI.openPoker(b) }] };
      case O.ARMCHAIR: case O.SOFA: {
        const acts = [];
        if (P.has('cigar')) acts.push({ n: Tr('Puro Tüttür'), fn: () => { this.consume('cigar'); P.energy = Math.min(100, P.energy + 8); UI.feed(Tr('Koltuğa gömülüp ağır ağır bir puro tüttürdün.')); this.advanceClock(30); } });
        acts.push({ n: Tr('Otur ve Bekle'), fn: () => UI.openWait() });
        return { label: Tr('Koltuk'), acts };
      }
    }
    return undefined;
  },

  /* ---------------- özel fayton ---------------- */
  carriagePrice() { return Math.round(CARRIAGE_PRICE * this.priceMul(true)); },
  newCoachman() {
    const look = randomLook('m');
    Object.assign(look, { coat: '#1e2028', hat: 'top', hatCol: '#1a1a1e', coatLen: 0.7 });
    return { name: randomName('m'), look };
  },
  buyCarriage(b) {
    if (this.carriage) { UI.feed(Tr('Zaten bir faytonun var.')); return false; }
    if (!this.spend(this.carriagePrice())) return false;
    this.carriage = { driver: this.newCoachman(), unpaid: 0, body: pick(['#1e2a3a', '#2a1a1e', '#1e3a2a', '#26262c']), hc: [pick(HORSE_BREEDS.standardbred.cols), pick(HORSE_BREEDS.standardbred.cols)] };
    Audio_.ui('cash');
    UI.toast(Tr('Özel Fayton'), Tr`Faytonun ve arabacın ${this.carriage.driver.name} kapıda bekliyor. Onu ahırdan, postaneden ya da malikanendeki uşaktan çağırabilirsin.`, 'horse');
    this.hintOnce('coach', Tr`Faytona binip gideceğin yeri seç: arabacı yolu kendisi sürer. Yolculuğu izleyebilir ya da ${Input.glyph('confirm')} tuşunu <b>basılı tutarak</b> yolu atlayabilirsin; ${Input.glyph('interact')} ile inersin. Atın faytonun arkasına bağlanıp gelir.`, 12);
    this.coachCall(b);
    return true;
  },
  hireCoachman() {
    const C = this.carriage;
    if (!C || C.driver) return false;
    C.driver = this.newCoachman(); C.unpaid = 0;
    UI.feed(Tr`🐴 Yeni arabacın ${C.driver.name} işe başladı (günlük ${fmtMoney(CARRIAGE_WAGE)}).`);
    return true;
  },
  /* Faytonun binanın önünde duracağı yer: kaldırım kenarı (şehirde) ya da kapının önü */
  curbSpot(b) {
    const W = this.world, y0 = b.curbY || b.door.y + 26;
    for (const dx of [34, -34, 60, -60, 86, -86, 0]) {
      const x = b.door.x + dx;
      if (!W.blocked(x, y0, 9) && !W.blocked(x - 22, y0, 7) && !W.indoorPx(x, y0)) return { x, y: y0 };
    }
    return { x: b.door.x + 34, y: y0 };
  },
  coachCall(b, e) {
    const C = this.carriage;
    if (!C || !b) return false;
    if (!C.driver) { UI.feed(Tr('Faytonunun arabacısı yok. Ahırdan yeni bir arabacı tutmalısın.'), 'warn'); return false; }
    if (this.ride) return false;
    const p = this.curbSpot(b);
    let w = this.coach;
    if (!w || w.remove || !this.ents.includes(w)) {
      w = new Wagon(null, 0, 1, false, { x: p.x, y: p.y, ang: 0 });
      Object.assign(w, { cab: true, coach: true, keep: true, owner: 'player', cargo: false, max: 0 });
      this.addEnt(w); this.coach = w;
    }
    Object.assign(w, { x: p.x, y: p.y, ang: 0, spd: 0, mv: 0, driver: C.driver, body: C.body, hc: C.hc, name: Tr('Özel Faytonun'), remove: false });
    w.bx = undefined; w.trail(true);
    if (e) e.say(Tr('Faytonunuz kapıda, efendim.'), 3);
    UI.feed(Tr('🐴 Faytonun kapının önünde seni bekliyor.'));
    return true;
  },
  coachAway() { if (this.coach) { this.coach.remove = true; this.coach = null; } },
  coachActions(w) {
    return [{ n: Tr('Faytona Bin'), fn: () => UI.openCoach(w) }, { n: Tr('Arabacıyı Gönder'), fn: () => { this.coachAway(); UI.feed(Tr('Arabacın faytonu ahıra götürdü. İstediğinde yeniden çağırabilirsin.')); } }];
  },
  /* Faytonla gidilebilecek yerler: bildiğin kasabalar, malikane, kendi yapıların ve haritadaki işaret */
  coachDests() {
    const W = this.world, P = this.player, out = [], here = W.townAt(P.x, P.y, 4);
    const far = (x, y) => dist(P.x, P.y, x, y) > 400;
    for (const t of W.towns) {
      if (!this.visited.has(t.id) || t === here) continue;
      const b = t.buildings.find(x => x.type === 'post') || t.buildings.find(x => x.type === 'stable') || t.buildings.find(x => x.type === 'hotel');
      const p = b ? this.curbSpot(b) : { x: t.spawn.x, y: t.spawn.y };
      if (far(p.x, p.y)) out.push({ n: t.n, x: p.x, y: p.y, icon: 'store', town: t.id });
    }
    const m = this.estate && this.mansionB();
    if (m) { const p = this.curbSpot(m); if (far(p.x, p.y)) out.unshift({ n: m.name, x: p.x, y: p.y, icon: 'house' }); }
    for (const h of this.homes) if (h.done) { const r = this.homeRect(h), x = (r.x + (r.w >> 1)) * TS + 8, y = (r.y + r.h + 2) * TS + 8; if (far(x, y)) out.push({ n: this.homeName(h), x, y, icon: 'hut' }); }
    const wp = this.waypoint;
    if (wp && far(wp.x, wp.y)) out.unshift({ n: Tr('Haritadaki İşaret'), x: wp.x, y: wp.y, icon: 'pin' });
    return out;
  },
  /* Tahmini yolculuk süresi (oyun dakikası): kuş uçuşu mesafenin yol payıyla */
  coachMins(d) { return dist(this.player.x, this.player.y, d.x, d.y) * 1.3 / CARRIAGE_SPD * MIN_PER_SEC; },
  rideStart(w, d) {
    const P = this.player;
    if (this.law.level > 0) { UI.feed(Tr('Aranırken arabacın yola çıkmaz!'), 'warn'); return false; }
    if (P.carry) { UI.feed(Tr('Omzundaki yükle faytona binemezsin.'), 'warn'); return false; }
    if (P.riding) P.dismount();
    const route = this.haulRoute(w.x, w.y, d.x, d.y, { r: 6 });
    const pts = [[w.x, w.y], ...route];
    let len = 0;
    for (let k = 1; k < pts.length; k++) len += dist(pts[k - 1][0], pts[k - 1][1], pts[k][0], pts[k][1]);
    const h = this.horse;
    this.ride = { w, d, route: pts, ri: 1, done: 0, len, v: 0, hold: 0, hitT: P.hitT || 0, horse: !!h && !h.dead && !h.rider && dist(h.x, h.y, w.x, w.y) < 500 };
    P.passenger = w; w.passenger = P; P.vx = P.vy = 0;
    this.coachSeat();
    Audio_.neigh();
    this.qEvent('coachRide', d);
    return true;
  },
  /* Yolcu arka koltukta, sürücünün arkasında */
  coachSeat() {
    const R = this.ride, P = this.player, w = R.w;
    P.x = w.bx - Math.cos(w.bang) * 3; P.y = w.by - Math.sin(w.bang) * 3; P.ang = w.bang;
  },
  /* Rotada yolcunun önündeki bir nokta: yön buna bakar (köşelerde yumuşak döner) */
  routeAhead(R, ahead) {
    let px = R.w.x, py = R.w.y;
    for (let k = R.ri; k < R.route.length; k++) {
      const q = R.route[k], L = dist(px, py, q[0], q[1]);
      if (L >= ahead) return [px + (q[0] - px) * ahead / L, py + (q[1] - py) * ahead / L];
      ahead -= L; px = q[0]; py = q[1];
    }
    return [px, py];
  },
  rideTick(dt) {
    const R = this.ride;
    if (!R) return;
    const P = this.player, w = R.w;
    if (w.remove || !this.ents.includes(w) || this.state !== 'play' || P.hp <= 0) { this.rideEnd(false); return; }
    if (this.law.level > 0) { UI.feed(Tr('Arabacın kanunu görünce faytonu durdurdu: "İnin, ben bu işe karışmam!"'), 'warn'); this.rideEnd(false); return; }
    if ((P.hitT || 0) > R.hitT) { UI.feed(Tr('Saldırıya uğradın! Arabacı faytonu durdurdu.'), 'warn'); this.rideEnd(false); return; }
    // yolu atlamak için onay tuşu basılı tutulur
    if (Input.down('confirm')) { R.hold += dt; if (R.hold >= 1) { R.hold = 0; this.rideSkip(); return; } }
    else R.hold = Math.max(0, R.hold - dt * 3);
    // hızlanarak kalkar, varmadan önce yavaşlar
    R.v = Math.min(CARRIAGE_SPD, R.v + 55 * dt);
    const sp = Math.min(R.v, Math.max(22, (R.len - R.done) * 1.1));
    let step = sp * dt;
    while (step > 0 && R.ri < R.route.length) {
      const [tx, ty] = R.route[R.ri], dd = dist(w.x, w.y, tx, ty);
      if (dd <= step) { w.x = tx; w.y = ty; step -= dd; R.done += dd; R.ri++; }
      else { w.x += (tx - w.x) / dd * step; w.y += (ty - w.y) / dd * step; R.done += step; step = 0; }
    }
    const la = this.routeAhead(R, 20);
    if (dist2(la[0], la[1], w.x, w.y) > 1) w.ang = turnTo(w.ang, Math.atan2(la[1] - w.y, la[0] - w.x), dt * 5);
    w.spd = sp; w.mv = sp / 60; w.phase = (w.phase || 0) + dt * sp * 0.15;
    w.trail();
    // yoldaki yayalar kenara çekilir
    const A = w.scanAhead();
    if (A.o && A.o.kind === 'npc' && A.d < 30) w.clearWay(A.o);
    // at arkaya bağlı gelir
    const h = this.horse;
    if (R.horse && h && !h.dead && !h.rider) {
      h.x = w.bx - Math.cos(w.bang) * 21; h.y = w.by - Math.sin(w.bang) * 21; h.ang = w.bang; h.state = 'idle';
      h.mv = w.mv; h.phase = (h.phase || 0) + dt * sp * 0.15; h.spd = sp;
    }
    if (sp > 40 && Math.random() < 0.12) { const t = this.world.tileAtPx(w.bx, w.by); if (t === T.DESERT || t === T.DRY || t === T.ROAD || t === T.SAND) this.parts.add('dust', w.bx - Math.cos(w.bang) * 10, w.by - Math.sin(w.bang) * 10, rnd(-8, 8), rnd(-8, 8), 0.8, 3); }
    this.coachSeat();
    if (R.ri >= R.route.length) this.rideEnd(true);
  },
  /* Yolu atla: kalan yol faytonun hızıyla geçen süre kadar zaman ilerler */
  rideSkip() {
    const R = this.ride, w = R.w, P = this.player;
    const mins = Math.max(0, R.len - R.done) / CARRIAGE_SPD * MIN_PER_SEC;
    UI.fade(() => {
      if (!this.ride) return;
      if (mins > 1) { this.advanceClock(mins); this.survivalUpdate(mins, false); }
      const end = R.route[R.route.length - 1], pv = R.route[R.route.length - 2] || [end[0] - 1, end[1]];
      w.x = end[0]; w.y = end[1]; w.ang = Math.atan2(end[1] - pv[1], end[0] - pv[0]); w.bx = undefined; w.trail(true);
      R.done = R.len; R.ri = R.route.length;
      this.rideEnd(true);
      this.cam.x = P.x; this.cam.y = P.y;
      this.prefetch(true);
    }, Tr`${R.d.n} yolunda...`);
  },
  rideEnd(arrived) {
    const R = this.ride, P = this.player;
    if (!R) return;
    this.ride = null;
    const w = R.w, W = this.world;
    P.passenger = null; w.passenger = null; w.spd = 0; w.mv = 0;
    // faytonun yanına iner (kaldırım tarafı önce)
    let ok = false;
    for (const a of [w.bang + Math.PI / 2, w.bang - Math.PI / 2, w.bang + Math.PI]) {
      const x = w.bx + Math.cos(a) * 15, y = w.by + Math.sin(a) * 15;
      if (!W.blocked(x, y, 4) && !W.indoorPx(x, y) && !W.isWaterPx(x, y)) { P.x = x; P.y = y; ok = true; break; }
    }
    if (!ok) { const s = this.findSpawnPos(w.x, w.y, 10, 60); if (s) { P.x = s[0]; P.y = s[1]; } }
    P.vx = P.vy = 0;
    const h = this.horse;
    if (R.horse && h && !h.dead && !h.rider) {
      const s = this.findSpawnPos(P.x, P.y, 18, 60);
      if (s) { h.x = s[0]; h.y = s[1]; }
      h.mv = 0; h.spd = 0; h.state = 'idle';
    }
    if (arrived) {
      UI.feed(Tr`🐴 Yolculuk bitti: ${R.d.n}.`);
      this.stat('coachRides', 1);
      if (R.d.town) this.qEvent('stage', W.towns.find(t => t.id === R.d.town));
    } else UI.feed(Tr('Faytondan indin.'));
  },
  /* Her kare: hizmetçiler, uşağın karşılaması, seyis, fayton yolculuğu, uzakta kalan fayton */
  estateTick(dt) {
    if (this.estate || this._serv) this.servantSync();
    const ib = this.insideB;
    if (ib !== this._estIn) {
      if (ib && ib.type === 'mansion' && this.estate) this.butlerGreet();
      this._estIn = ib;
    }
    if ((this._groomT = (this._groomT || 0) - dt) <= 0) { this._groomT = 1; this.groomTick(); }
    this.rideTick(dt);
    const w = this.coach, P = this.player;
    if (w && !this.ride && (w.remove || dist2(w.x, w.y, P.x, P.y) > 1100 * 1100)) this.coachAway();
  },

  /* ---------------- kayıt ---------------- */
  saveEstate() { return { estate: this.estate, club: this.club, carriage: this.carriage }; },
  loadEstate(d) {
    this.estate = (d && d.estate) || null; this.club = (d && d.club) || null; this.carriage = (d && d.carriage) || null;
    this._serv = null; this._manB = null; this.coach = null; this.ride = null;
  },
};

/* ---------------- arayüz ---------------- */
Object.assign(UI, {
  /* Kapıdan ya da tapu dairesinden: malikaneyi incele ve satın al */
  openMansion(b) {
    const own = !!G.estate, pr = G.mansionPrice();
    this.menu({
      title: b.name, cls: 'small', wallet: true,
      sub: own ? Tr('Senin malikanen') : Tr`Satılık · ${fmtMoney(pr)}`,
      build: () => {
        const it = [{ html: `<div class="biz-card"><p>${Tr('Şehrin kuzeyinde, yan bahçeli iki katlı bir taş malikane. Zemin katta şömineli büyük salon, piyano, yemek masaları ve mutfak köşesi; üst katta çalışma odası, banyo, yatak odası ve misafir odası.')}</p><p class="dim">${Tr('Ev gibi kullanılır: yatakta uyku ve kayıt, sandık, ocak, küvet. Aşçı, seyis ve uşak günlük ücretle tutulabilir.')}</p></div>` }];
        if (own) it.push({ icon: '🏠', label: Tr('Malikane senin'), disabled: true, why: '' });
        else it.push({ icon: '📜', label: Tr('Malikaneyi Satın Al'), right: fmtMoney(pr), disabled: G.player.money < pr, why: Tr('Yeterli paran yok.'), fn: () => { if (G.buyMansion(b)) this.closeAll(); } });
        return it;
      },
    });
  },
  /* Çalışma odasının masası: hizmetçiler, ücretler, fayton */
  openLedger(b) {
    const E = G.estate;
    this.menu({
      title: Tr('Malikane Defteri'), cls: 'small buildpick', side: (it) => it.side || '', wallet: true,
      sub: () => Tr`Banka: ${fmtMoney(G.bank)} · Ücretler önce bankadan ödenir`,
      build: () => {
        const it = [{ header: Tr('Hizmetçiler') }];
        let tot = 0;
        for (const k of Object.keys(SERVANTS)) {
          const S = SERVANTS[k], s = E.staff[k];
          const days = s ? G.day - s.since : 0;
          const side = `<div class="ps-t">${S.n}</div><div class="ps-d">${S.d}</div><div class="ps-e">${Tr`Günlük ücret: ${fmtMoney(S.wage)}`}${s ? '<br>' + (days > 0 ? Tr`${s.name}, ${days} gündür yanında.` : Tr`${s.name} bugün işe başladı.`) + '<br>' + Tr('Seçersen işten çıkarılır.') : ''}${s && s.unpaid ? `<br><span class="bad">${Tr('Dünkü ücretini alamadı!')}</span>` : ''}</div>`;
          if (s) { tot += S.wage; it.push({ icon: '👤', label: `${S.n} · ${escapeHtml(s.name)}`, right: Tr`${fmtMoney(S.wage)}/gün`, side, fn: () => { G.fireServant(k); } }); }
          else it.push({ icon: '➕', label: Tr`${S.n} Tut`, right: Tr`${fmtMoney(S.wage)}/gün`, side, fn: () => { G.hireServant(k); } });
        }
        if (G.carriage && G.carriage.driver) tot += CARRIAGE_WAGE;
        it.push({ html: `<p class="dim">${Tr`Günlük toplam ücret: ${fmtMoney(tot)}. İki gün ödenmeyen hizmetçi işi bırakır.`}</p>` });
        return it;
      },
    });
  },
  /* Kulübün kapısı: üyelik */
  openClubJoin(b) {
    const pr = G.clubPrice();
    this.menu({
      title: b.name, cls: 'small', wallet: true, sub: Tr('Yalnızca üyeler'),
      build: () => [
        { html: `<div class="biz-card"><p class="quote">${Tr('"İyi günler. Kulübümüz yalnızca üyelerine açıktır."')}</p><p>${Tr('Üyeler puro ve konyak salonunu, okuma odasını ve üst kattaki kart odası ile bilardo salonunu kullanır. Kart odasında bahisler yüksektir.')}</p></div>` },
        { icon: '🎩', label: Tr('Kulübe Üye Ol'), right: fmtMoney(pr), disabled: G.player.money < pr, why: Tr('Yeterli paran yok.'), fn: () => { if (G.joinClub(b)) this.closeAll(); } },
        { icon: '🚪', label: Tr('Vazgeç'), fn: () => this.pop() },
      ],
    });
  },
  /* Kulübün okuma odası: günün gazeteleri (günde bir), kulüp üyeleri arasında konuşulanlar */
  clubPapers() {
    if (G.dailyTalk.clubPaper) { this.feed(Tr('Bugünün gazetelerini zaten okudun.')); return; }
    G.dailyTalk.clubPaper = 1;
    G.advanceClock(30);
    const [h, t] = pick(HEADLINES);
    const unk = G.world.pois.filter(p => (p.kind === 'landmark' || p.kind === 'camp') && !G.discovered.has(p.id) && !G.rumored.has(p.id));
    let extra = '';
    if (unk.length) { const p = pick(unk); G.rumored.add(p.id); extra = `<p class="dim">${Tr`Koltuklarda gazetelerini okuyan üyeler <b>${p.n}</b> hakkında konuşuyor. Haritanda işaretlendi.`}</p>`; }
    this.info(Tr('Okuma Odası'), `<div class="news"><div class="nw-h">${h}</div><p>${t}</p></div>${extra}`);
    G.qEvent('news');
  },
  /* Ahırda / postanede: özel fayton */
  coachItems(b) {
    const it = [], C = G.carriage;
    if (!C) {
      if (b.type === 'stable') it.push({ icon: '🎩', label: Tr('Özel Fayton ve Arabacı Al'), right: fmtMoney(G.carriagePrice()), side: `<div class="ps-t">${Tr('Özel Fayton')}</div><div class="ps-d">${Tr('Çift atlı, körüklü bir fayton ve üniformalı arabacısı. Gideceğin yere yolu kendisi sürer; yolculuğu izleyebilir ya da atlayabilirsin.')}</div><div class="ps-e">${Tr`Arabacının ücreti: günlük ${fmtMoney(CARRIAGE_WAGE)}`}</div>`, fn: () => { if (G.buyCarriage(b)) this.closeAll(); } });
      return it;
    }
    if (!C.driver) { if (b.type === 'stable') it.push({ icon: '🎩', label: Tr('Yeni Arabacı Tut'), right: Tr`${fmtMoney(CARRIAGE_WAGE)}/gün`, fn: () => { G.hireCoachman(); this.pop(); } }); return it; }
    it.push({ icon: '🐴', label: Tr('Faytonunu Çağır'), right: C.driver.name, fn: () => { if (G.coachCall(b)) this.closeAll(); } });
    return it;
  },
  /* Faytona bin: gideceğin yer */
  openCoach(w) {
    const dests = G.coachDests();
    this.menu({
      title: Tr('Özel Faytonun'), cls: 'small', sub: () => Tr`Arabacı: ${G.carriage && G.carriage.driver ? G.carriage.driver.name : '—'} · ${G.timeStr()}`,
      build: () => dests.map(d => {
        const m = G.coachMins(d), hrs = m / 60;
        return { icon: Icons.glyph(d.icon, '#efe6d2'), label: d.n, right: hrs >= 1 ? Tr`~${Math.round(hrs * 10) / 10} sa` : Tr`~${Math.max(5, Math.round(m / 5) * 5)} dk`, fn: () => { this.closeAll(); G.rideStart(w, d); } };
      }),
      empty: Tr('Gidecek bir yer yok. Önce kasabaları keşfet ya da haritada bir yer işaretle.'),
    });
  },
});
