'use strict';
/* ==========================================================
   FRONTIER'S END — kement, taşıma ve teslim (G nesnesine eklenir)
   - Kementle yakala, bağla; yaralı ya da baygın düşenleri bağla
   - Cesetleri, bağlı kişileri, leşleri ve büyük postları omuzda
     ya da atın eyerinde taşı
   - Aranan suçluları şerif ofisine teslim et (canlı: tam ödül)
   - Postları ve leşleri kasaba/tuzakçıya sat
   - Kanıt: masum birinin cesedi bulunursa ve sen yakındaysan
     suç sana yazılır; ceset taşırken görülmek de öyle
   ========================================================== */

const HORSE_CAP = 4;   // eyer kapasitesi (ceset/leş 2, küçük leş ve post 1)

const CarrySystems = {
  /* ---------------- yük ---------------- */
  carryWeight(e) { return e.kind === 'pelt' || (e.kind === 'animal' && e.def.len < 9) ? 1 : 2; },
  loadWeight(list) { let w = 0; for (const e of list) w += this.carryWeight(e); return w; },
  carryName(e) {
    if (e.kind === 'npc') return e.dead ? Tr`${e.name} (ceset)` : e.state === 'tied' ? Tr`${e.name} (bağlı)` : Tr`${e.name} (baygın)`;
    if (e.kind === 'animal') return Tr`${e.def.n} Leşi`;
    return e.name;
  },
  /* Bu büyüklükteki bir hayvan omuza alınamaz; önce derisi yüzülür */
  heavyCarcass(a) { return a.def.len >= 16; },
  isEvidence(e) { return e.kind === 'npc' && e.dead && e.evidence; },
  isBountyTarget(e) { const B = this.activeBounty; return !!(B && e.kind === 'npc' && e.bountyId === B.id); },

  pickUp(e) {
    const P = this.player;
    if (P.carry || P.riding || !e) return;
    if (P.rope === e) P.rope = null;
    const i = this.ents.indexOf(e);
    if (i >= 0) this.ents.splice(i, 1);
    P.carry = e; P.crouch = false;
    Audio_.thud(0.25);
    this.hintOnce('carry', Tr`Yük taşırken koşamaz ve silah kullanamazsın. ${Input.glyph('interact')} ile yere bırakabilir, atının yanındayken <b>eyere yükleyebilirsin</b>. Aranan suçluları şerif ofisine, postları ve leşleri kasap ya da tuzakçıya götür.`, 10);
  },
  /* Yükü dünyaya geri koy (x, y verilmezse oyuncunun önüne) */
  placeDown(e, x, y) {
    const W = this.world;
    if (x === undefined) { const P = this.player; x = P.x + Math.cos(P.ang) * 8; y = P.y + Math.sin(P.ang) * 8; if (W.blocked(x, y, 2)) { x = P.x; y = P.y; } }
    e.x = x; e.y = y; e.remove = false; e.ang = rnd(-Math.PI, Math.PI);
    if (e.kind === 'npc' || e.kind === 'animal') e.deadT = 0;
    if (!this.ents.includes(e)) this.ents.push(e);
  },
  dropCarry(silent) {
    const P = this.player, e = P.carry;
    if (!e) return;
    P.carry = null;
    this.placeDown(e);
    if (!silent) Audio_.thud(0.2);
  },
  stowOnHorse(h) {
    const P = this.player, e = P.carry;
    if (!e) return true;
    if (!h || h.dead || h !== this.horse) { UI.feed(Tr('Yükü yalnızca kendi atına yükleyebilirsin.'), 'warn'); return false; }
    if (this.loadWeight(h.load) + this.carryWeight(e) > HORSE_CAP) { UI.feed(Tr`${h.name} daha fazla taşıyamaz. Önce bir yükü indir.`, 'warn'); return false; }
    P.carry = null;
    h.load.push(e);
    Audio_.thud(0.2);
    UI.feed(Tr`${this.carryName(e)} eyere yüklendi.`);
    return true;
  },
  unloadHorse(h, e) {
    const P = this.player;
    if (P.carry) { UI.feed(Tr('Elin dolu. Önce taşıdığını bırak.'), 'warn'); return; }
    const k = h.load.indexOf(e);
    if (k < 0) return;
    h.load.splice(k, 1);
    P.carry = e;
    Audio_.thud(0.2);
  },
  dropHorseLoad(h) {
    for (const e of h.load) this.placeDown(e, h.x + rnd(-10, 10), h.y + rnd(-10, 10));
    h.load = [];
  },
  /* Oyuncunun yakınındaki kendi atı (dükkân ve şerif ofisi önüne bağlanmış olabilir) */
  nearHorse(r = 300) { const h = this.horse, P = this.player; return h && !h.dead && dist(h.x, h.y, P.x, P.y) < r ? h : null; },
  /* Taşınan ve yakındaki eyerdeki yükler: [{ e, h }] (h: yüklendiği at, omuzdaysa null) */
  carriedAll() {
    const out = [], P = this.player;
    if (P.carry) out.push({ e: P.carry, h: null });
    const h = this.nearHorse();
    if (h) for (const e of h.load) out.push({ e, h });
    return out;
  },
  takeCarried(it) {
    if (it.h) { const k = it.h.load.indexOf(it.e); if (k >= 0) it.h.load.splice(k, 1); }
    else if (this.player.carry === it.e) this.player.carry = null;
    it.e.remove = true;
  },
  /* Suya at: ceset ve leş batar, kanıt ortadan kalkar */
  sinkCarry() {
    const P = this.player, e = P.carry;
    if (!e) return;
    if (this.isBountyTarget(e)) { UI.feed(Tr('Ödül için onu şerife teslim etmelisin.'), 'warn'); return; }
    P.carry = null;
    e.remove = true;
    this.parts.burst('splash', P.x + Math.cos(P.ang) * 10, P.y + Math.sin(P.ang) * 10, 8, 25, 0.7, 3);
    Audio_.tone(160, 0.25, 'sine', 0.06, null, 0, 70);
    UI.feed(e.kind === 'npc' ? Tr('Ceset suyun dibini boyladı.') : Tr('Leşi suya attın.'));
  },
  buryBody(e) {
    if (this.isBountyTarget(e)) { UI.feed(Tr('Ödül için onu şerife teslim etmelisin.'), 'warn'); return; }
    e.remove = true;
    this.addHonor(1);
    this.skillXp('strength', 3);
    this.player.clean = Math.max(0, this.player.clean - 10);
    UI.feed(Tr`${e.name} toprağa verildi.`);
  },

  /* ---------------- kement ---------------- */
  lassoHit(e) {
    const P = this.player;
    if (e.mounted) {
      const h = new Horse(e.x + 6, e.y, 'mustang', { look: e.mounted, owner: 'npc' });
      h.state = 'flee'; h.t = 6; h.ang = Math.random() * TAU;
      this.addEnt(h);
      e.mounted = null;
    }
    const outlaw = e.role === 'bandit' || e.role === 'target';
    e.state = 'lassoed'; e.lasT = outlaw ? rnd(4, 6) : rnd(6, 9); e.wrig = 0; e.aggro = false; e.path = null;
    P.rope = e;
    Audio_.thud(0.3);
    e.say(pick([Tr('Hey! Bırak beni!'), Tr('Ne yapıyorsun?!'), Tr('Lanet olsun!')]), 2);
    if (e.isLaw) e.hostile = true;
    if (!e.hostile && !outlaw && !e.assaulted) { e.assaulted = true; this.crime(e.isLaw ? 'assaultLaw' : 'assault', e.x, e.y, e); }
    this.hintOnce('lasso', Tr`Kementle yakaladın! Yaklaş ve ${Input.glyph('interact')} basılı tutarak <b>bağla</b>. Uzaklaşırsan onu peşinden sürüklersin. Ateş tuşu ipi bırakır.`, 9);
    this.skillXp('riding', 2);
  },
  hogtie(e) {
    const P = this.player;
    if (P.rope === e) P.rope = null;
    const outlaw = e.role === 'bandit' || e.role === 'target';
    e.state = 'tied'; e.tieT = rnd(110, 170) + this.skill('survival') * 8; e.wrig = 0; e.aggro = false;
    e.say(pick([Tr('Bunu ödeyeceksin!'), Tr('Çöz beni!'), Tr('Hmmf!')]), 2);
    Audio_.tone(260, 0.1, 'triangle', 0.05);
    if (!e.hostile && !outlaw && !e.assaulted) { e.assaulted = true; this.crime(e.isLaw ? 'assaultLaw' : 'assault', e.x, e.y, e); }
    if (e.bountyId) this.bountyTargetDown(e);
    this.skillXp('strength', 2);
  },
  untie(e) {
    const innocent = !(e.role === 'bandit' || e.role === 'target');
    e.recover();
    if (innocent) { this.addHonor(1); e.say(pick([Tr('Bir daha yaklaşma bana!'), Tr('Deli misin sen?!')]), 2); }
  },

  /* ---------------- ödül avı ---------------- */
  bountyTargetDown(e) {
    const B = this.activeBounty;
    if (!B || e.bountyId !== B.id || B.noted) return;
    B.noted = 1;
    UI.toast(Tr('Hedef Etkisiz'), Tr`${e.name} — bağla ve şerif ofisine canlı teslim et: ${fmtMoney(B.reward)}`, 'bounty');
  },
  /* Şerifin bu kişi için ödeyeceği para (0: aranmıyor) */
  wantedValue(e) {
    if (e.kind !== 'npc') return 0;
    const B = this.activeBounty;
    if (B && e.bountyId === B.id) return e.dead ? Math.round(B.reward * 0.5) : B.reward;
    if (e.role === 'bandit' || e.role === 'target') return e.dead ? 5 : 15;
    return 0;
  },
  deliverToSheriff(it) {
    const e = it.e, v = this.wantedValue(e);
    if (!v) { UI.subtitle(Tr('Şerif'), Tr`${e.name} aranan biri değil. Onu buraya neden getirdin?`, 3); return; }
    const alive = !e.dead, target = this.isBountyTarget(e);
    this.takeCarried(it);
    this.earn(v, alive ? Tr('Canlı teslim') : Tr('Ceset teslimi'));
    this.addHonor(alive ? 3 : 1);
    this.stat('captures', 1);
    Audio_.ui('cash');
    if (target) {
      this.activeBounty = null;
      UI.toast(Tr('Ödül Alındı'), alive ? Tr`${e.name} canlı teslim edildi. Adalet yerini bulacak.` : Tr`${e.name} ölü teslim edildi. Yarı ödül ödendi.`, 'bounty');
      UI.subtitle(Tr('Şerif'), alive ? Tr('İyi iş. Mahkeme onu bekliyor.') : Tr('Canlı getirseydin tamamını alırdın.'), 3);
    } else UI.subtitle(Tr('Şerif'), alive ? Tr('Bir haydut daha parmaklıklar ardında. Al, hak ettin.') : Tr('Bir haydut eksik. Al şu parayı.'), 3);
  },

  /* ---------------- av satışı ---------------- */
  loadValue(e, shop) {
    if (e.kind === 'pelt') return this.sellPrice(e.id, shop) * e.q;
    if (e.kind === 'animal') {
      const d = e.def; let v = 0;
      if (d.pelt) v += this.sellPrice(d.pelt[0], shop) * d.pelt[1];
      if (d.meat) v += this.sellPrice(d.meat[0], shop) * d.meat[1];
      return v * 1.1;   // bütün leş, parça parça satmaktan biraz iyi
    }
    return 0;
  },
  sellables(shop) { return this.carriedAll().filter(it => (it.e.kind === 'pelt' || it.e.kind === 'animal') && this.loadValue(it.e, shop) > 0); },
  sellCarried(shop, only) {
    const list = only ? [only] : this.sellables(shop);
    let sum = 0;
    for (const it of list) { sum += this.loadValue(it.e, shop); this.takeCarried(it); }
    if (sum <= 0) return;
    this.earn(sum, Tr('Av satışı'));
    this.skillXp('trade', 1 + list.length);
    Audio_.ui('cash');
  },
  /* Bulunduğun binanın dükkânı (hayvan ürünü alıyorsa) */
  shopHere(kind) {
    const P = this.player, b = this.world.buildingAtPx(P.x, P.y);
    if (!b) return null;
    if (kind === 'sheriff') return b.type === 'sheriff' ? b : null;
    const S = b.def.shop && SHOPS[b.def.shop];
    return S && S.buy && S.buy.animal ? b : null;
  },

  /* ---------------- etkileşim ---------------- */
  /* Oyuncu bir şey taşırken etkileşim tuşu yalnızca yükle ilgilidir */
  carryInteraction() {
    const P = this.player, e = P.carry, W = this.world;
    const acts = [];
    const sh = this.shopHere('sheriff');
    if (sh && e.kind === 'npc') {
      const v = this.wantedValue(e);
      acts.push({ n: v ? Tr`Şerife Teslim Et (${fmtMoney(v)})` : Tr('Şerife Göster'), fn: () => this.deliverToSheriff({ e, h: null }) });
    }
    const shop = this.shopHere('shop');
    if (shop && e.kind !== 'npc') { const v = this.loadValue(e, shop.def.shop); if (v > 0) acts.push({ n: Tr`Sat (${fmtMoney(v)})`, fn: () => this.sellCarried(shop.def.shop, { e, h: null }) }); }
    const h = this.horse;
    if (h && !h.dead && dist(h.x, h.y, P.x, P.y) < 34) acts.push({ n: Tr`${h.name} Atına Yükle`, fn: () => this.stowOnHorse(h) });
    if (e.dead || e.kind === 'animal') {
      for (const [dx, dy] of [[0, 0], [12, 0], [-12, 0], [0, 12], [0, -12]]) {
        const t = W.tileAtPx(P.x + dx, P.y + dy);
        if (t === T.WATER || t === T.DEEP) { acts.push({ n: Tr('Suya At'), fn: () => this.sinkCarry() }); break; }
      }
    }
    acts.push({ n: Tr('Yere Bırak'), fn: () => this.dropCarry() });
    return { x: P.x, y: P.y, label: this.carryName(e), actions: acts, riding: true };
  },
  /* Yerdeki bir ceset, bağlı/baygın kişi, leş ya da post için eylemler; null: bu varlık bizim değil */
  carryableActions(e, add, d) {
    const P = this.player;
    const take = { n: Tr('Omzuna Al'), fn: () => this.pickUp(e) };
    if (e.kind === 'pelt') { add(e.x, e.y, e.name, [take]); return true; }
    if (e.kind === 'animal' && e.dead && !e.skinned) {
      const acts = [{ n: Tr('Derisini Yüz'), hold: 1.3, fn: () => this.skin(e) }];
      add(e.x, e.y, e.def.n + Tr(' Leşi'), acts, 0, this.heavyCarcass(e) ? null : take);
      return true;
    }
    if (e.kind !== 'npc') return false;
    if (e.dead) {
      if (!e.looted) add(e.x, e.y, e.name, [{ n: Tr('Cesedi Ara'), hold: 0.8, fn: () => this.lootBody(e) }], 0, take);
      else {
        const acts = [take];
        if (P.has('shovel')) acts.push({ n: Tr('Göm'), hold: 3, fn: () => this.buryBody(e) });
        add(e.x, e.y, e.name, acts);
      }
      return true;
    }
    if (e.state === 'lassoed') { add(e.x, e.y, e.name, [{ n: Tr('Bağla'), hold: 1, fn: () => this.hogtie(e) }], 2); return true; }
    if (e.state === 'downed') { add(e.x, e.y, Tr`${e.name} (yaralı)`, [{ n: Tr('Bağla'), hold: 1, fn: () => this.hogtie(e) }], 2, take); return true; }
    if (e.state === 'tied') {
      const acts = [take, { n: Tr('Serbest Bırak'), hold: 0.8, fn: () => this.untie(e) }];
      if (!e.robbed && !e.hostile && e.role !== 'bandit' && e.role !== 'target') acts.push({ n: Tr('Soy'), fn: () => this.robNpc(e) });
      add(e.x, e.y, Tr`${e.name} (bağlı)`, acts, 2);
      return true;
    }
    return false;
  },
  /* Kendi atının eyerindeki yükler için eylemler */
  horseLoadActions(h) {
    return h.load.map(e => ({ n: Tr`İndir: ${this.carryName(e)}`, fn: () => this.unloadHorse(h, e) }));
  },

  /* ---------------- kanıt ---------------- */
  /* Saniyede bir: masum cesedi bulan ya da ceset taşıdığını gören biri var mı? */
  evidenceTick() {
    const P = this.player;
    const seer = (x, y, r) => {
      for (const n of this.ents) {
        if (n.kind !== 'npc' || n.dead || n.remove || n.hostile || n.bound || n.role === 'bandit' || n.role === 'spouse' || n.role === 'child' || n.state === 'report') continue;
        if (Math.abs(n.x - x) > r || Math.abs(n.y - y) > r) continue;
        if (dist2(n.x, n.y, x, y) < r * r && this.los(n.x, n.y, x, y)) return n;
      }
      return null;
    };
    const night = this.hour >= 21 || this.hour < 5;
    // yerdeki cesetler
    for (const b of this.ents) {
      if (b.kind !== 'npc' || !b.dead || !b.evidence || b.remove) continue;
      if (dist2(b.x, b.y, P.x, P.y) > 900 * 900) continue;
      const n = seer(b.x, b.y, night ? 60 : 110);
      if (!n) continue;
      b.evidence = false;
      n.say(pick([Tr('Aman Tanrım! Burada bir ceset var!'), Tr('Yardım edin! Biri öldürülmüş!'), Tr('Şerifi çağırın! Ölü biri var!')]), 3);
      if (dist(P.x, P.y, b.x, b.y) < 320) this.crime('murder', b.x, b.y, null, { noHonor: true });
      else { n.state = 'flee'; n.t = 8; if (dist(P.x, P.y, b.x, b.y) < 700) UI.feed(Tr('Biri bir ceset buldu. Neyse ki sen uzaktaydın.'), 'law'); }
    }
    // omuzda taşınan ceset ya da bağlı biri görülürse
    const c = P.carry;
    if (c && c.kind === 'npc' && !c.seenCarry && (c.evidence || (!c.dead && !c.hostile && c.role !== 'bandit' && c.role !== 'target'))) {
      const n = seer(P.x, P.y, night ? 50 : 100);
      if (n) {
        c.seenCarry = true;
        n.say(c.dead ? pick([Tr('Omzundaki... bir ceset mi o?!'), Tr('Katil! Birini öldürmüş!')]) : pick([Tr('O adamı nereye götürüyorsun?!'), Tr('İmdat! Adam kaçırıyor!')]), 3);
        if (c.dead) c.evidence = false;
        this.crime(c.dead ? 'murder' : 'assault', P.x, P.y, null, { noHonor: true });
      }
    }
  },

  /* ---------------- kayıt ---------------- */
  serCarry(e) {
    if (e.kind === 'pelt') return { k: 'pelt', id: e.id, q: e.q };
    if (e.kind === 'animal') return { k: 'animal', type: e.type, male: e.male, look: e.look };
    return { k: 'npc', role: e.role, name: e.name, look: e.look, dead: e.dead, state: e.state, tieT: e.tieT, money: e.money, weapon: e.weapon, looted: e.looted, bountyId: e.bountyId || null, evidence: !!e.evidence, hostile: e.hostile, assaulted: !!e.assaulted };
  },
  deserCarry(d) {
    if (d.k === 'pelt') return new Pelt(0, 0, d.id, d.q || 1);
    if (d.k === 'animal') { const a = new Animal(0, 0, d.type); a.dead = true; a.state = 'dead'; a.hp = 0; a.male = d.male; if (d.look) a.look = d.look; return a; }
    const n = new NPC(0, 0, d.role, { name: d.name, look: d.look, hostile: d.hostile, weapon: d.weapon, money: d.money });
    n.looted = d.looted; n.evidence = d.evidence; n.assaulted = d.assaulted;
    if (d.bountyId) { n.bountyId = d.bountyId; n.keep = true; }
    if (d.dead) { n.dead = true; n.hp = 0; n.state = 'dead'; } else { n.state = 'tied'; n.tieT = d.tieT || 120; n.hp = Math.max(1, n.maxHp * 0.3); }
    return n;
  },
  saveCarry() {
    const h = this.horse;
    return { p: this.player.carry ? this.serCarry(this.player.carry) : null, h: h && h.load ? h.load.map(e => this.serCarry(e)) : [] };
  },
  loadCarry(d) {
    if (!d) return;
    if (d.p) this.player.carry = this.deserCarry(d.p);
    if (this.horse && d.h) this.horse.load = d.h.map(x => this.deserCarry(x));
  },
  /* Kayıt öncesi ödül hedefinin durumu: ceset/bağlı yerde mi, taşınıyor mu */
  noteBountyState() {
    const B = this.activeBounty;
    if (!B || B.done) return;
    const P = this.player, own = (P.carry ? [P.carry] : []).concat(this.horse ? this.horse.load : []);
    if (own.some(e => e.bountyId === B.id)) { B.status = 'carried'; return; }
    const t = this.ents.find(e => e.kind === 'npc' && e.bountyId === B.id && !e.remove);
    if (t) {
      if (t.dead) { B.status = 'dead'; B.bx = t.x; B.by = t.y; }
      else if (t.bound) { B.status = 'tied'; B.bx = t.x; B.by = t.y; }
      else B.status = null;
    } else if (B.status === 'carried') B.status = null;   // taşınan yük kayboldu: hedef yerinde yeniden belirir
  },
};
