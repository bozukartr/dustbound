'use strict';
/* ==========================================================
   FRONTIER'S END — işletmeler (G nesnesine eklenir)
   - Kasabadaki dükkânları sahibinden satın al; eski sahibi
     işletmeci olarak kalır. Satılık arsaya yeni işletme kur.
   - Her işletmenin bir işletmecisi, stoğu ve kasası vardır.
     Sen kasada durmazsın: gelir kasada birikir, uğrayıp alırsın
     (istersen %10 kesintiyle doğrudan bankaya aktarılır).
   - Mal tüketen işletmeler toptan mal ister: toptancıdan,
     değirmenden, imalathaneden sandık alıp omzunda, atınla ya
     da kendi yük arabanla getirirsin. Stok boşsa işletme
     gelirinin yalnız %30'unu kazanır.
   - Kendi zincirin (değirmen → fırın, imalathane → saloon)
     malı ucuzlatır ve beslediği işletmenin gelirini artırır.
   ========================================================== */

/* ---------------- Yerdeki mal sandığı ---------------- */
class Crate extends Ent {
  constructor(x, y, g) {
    super(x, y);
    this.kind = 'crate'; this.g = g; this.r = 0; this.ang = 0;
  }
  get name() { return GOODS[this.g].n; }
  update() {}
  draw(ctx) { Spr.goods(ctx, this.x, this.y, this.g, 1.25); }
}

const BizSystems = {
  /* ---------------- sorgular ---------------- */
  bizOf(b) { return b && this.biz.find(z => z.bid === b.id) || null; },
  bizBuilding(z) { return this.world.buildings[z.bid]; },
  bizTown(id) { return this.world.towns.find(t => t.id === id); },
  bizTownMul(t) { return t ? { s: 0.85, m: 1, l: 1.2 }[t.sz] || 1 : 1; },
  /* Sahibi satmaya razı mı: dünya tohumuna bağlı, her oyunda aynı */
  bizForSale(b) {
    if (!b || !BIZ[b.type] || !b.town || b.def.lock || this.bizOf(b)) return false;
    return hash2(b.id, 17, (this.seed % 9973) + 3) < 0.6;
  },
  bizPrice(b) { return Math.round(BIZ[b.type].p * this.bizTownMul(this.bizTown(b.town)) / 5) * 5; },
  bizBuildPrice(type, town) { return Math.round(BIZ[type].p * 0.9 * this.bizTownMul(town) / 5) * 5; },
  /* Bir mal türünün asıl üreticisi oyuncuya ait mi (zincir) */
  bizChain(g) {
    const src = GOODS[g].src[0][0];
    return this.biz.some(z => z.type === src && !z.site);
  },
  bizStockWord(z) {
    const B = BIZ[z.type];
    if (!B.goods) return Tr('gerekmez');
    const f = z.stock / B.cap;
    return f > 0.5 ? Tr('dolu') : f > 0.15 ? Tr('azalıyor') : Tr('boş');
  },
  bizStockCls(z) {
    const B = BIZ[z.type];
    if (!B.goods) return 'ok';
    const f = z.stock / B.cap;
    return f > 0.5 ? 'ok' : f > 0.15 ? 'mid' : 'low';
  },
  /* Beklenen günlük brüt gelir (stok dolu varsayımıyla) */
  bizDailyEst(z) {
    const B = BIZ[z.type], t = this.bizTown(z.town);
    return B.inc * this.bizTownMul(t) * MGR_TRAITS[z.mgr.trait].inc * (B.goods && this.bizChain(B.goods) ? 1.2 : 1);
  },
  bizName(z) { const b = this.bizBuilding(z); return b ? b.name : BUILDINGS[z.type].n; },

  /* ---------------- satın alma ---------------- */
  newManager(R) {
    const sex = chance(0.7) ? 'm' : 'f';
    const traits = Object.keys(MGR_TRAITS);
    return { name: randomName(sex), look: randomLook(sex), trait: R !== undefined ? traits[Math.floor(R * traits.length) % traits.length] : pick(traits) };
  },
  buyBiz(b) {
    if (this.law.level > 0) { UI.feed(Tr('Aranırken kimse sana tapu vermez.'), 'warn'); return false; }
    const pr = this.bizPrice(b);
    if (!this.spend(pr)) return false;
    this.townNote(b.door.x, b.door.y, 'rich');
    const kr = this.keeperOf(b);
    const mgr = this.newManager(hash2(b.id, 29, this.seed % 7919));
    if (kr) { mgr.name = kr.name; mgr.res = true; }
    const B = BIZ[b.type];
    this.biz.push({ bid: b.id, type: b.type, town: b.town, stock: B.goods ? B.cap * 0.5 : 0, cash: 0, mgr, since: this.day, bank: false, total: 0, last: 0 });
    this.stat('businesses', 1);
    this.addHonor(1);
    Audio_.ui('cash');
    UI.toast(Tr('İşletme Satın Alındı'), kr ? Tr`${b.name} artık senin. ${kr.name} işletmeci olarak kalıyor.` : Tr`${b.name} artık senin.`, 'ok');
    this.hintOnce('biz', Tr`İşletmen kendi kendine çalışır; kasada durman gerekmez. Gelir kasada birikir: tezgâha uğrayıp <b>kasayı al</b>. ${B.goods ? Tr`Bu işletme <b>${GOODS[B.goods].n}</b> tüketir: toptancıdan ya da üreticiden alıp getir, stok boşalırsa gelir düşer.` : ''}`, 12);
    return true;
  },

  /* ---------------- günlük hesap ---------------- */
  bizDaily() {
    let sum = 0, bank = 0, empty = 0, skim = false;
    for (const z of this.biz) {
      if (z.site) continue;
      const B = BIZ[z.type];
      let inc = this.bizDailyEst(z);
      if (B.goods) {
        const f = z.stock >= B.use ? 1 : 0.3 + 0.7 * (z.stock / B.use);
        if (f < 1) empty++;
        inc *= f;
        z.stock = Math.max(0, z.stock - B.use);
      }
      inc *= rnd(0.85, 1.15);
      const T = MGR_TRAITS[z.mgr.trait];
      if (T.skim && chance(T.skim)) { inc *= 0.6; skim = true; z.skimmed = (z.skimmed || 0) + 1; }
      z.last = inc; z.total += inc;
      if (z.bank) { bank += inc * 0.9; this.bank += inc * 0.9; }
      else z.cash += inc;
      sum += inc;
    }
    if (!sum) return;
    this.stats.earned += sum;
    this.stat('bizEarned', sum);
    UI.feed(Tr`🏪 İşletmelerin dün ${fmtMoney(sum)} kazandı${bank ? Tr` (${fmtMoney(bank)} bankaya)` : ''}.`);
    if (empty) UI.feed(Tr`📦 ${empty} işletmenin stoğu azaldı ya da bitti. Mal getirmen gerek.`, 'warn');
    if (skim && chance(0.5)) UI.feed(Tr('Bir işletmende kasa beklenenden az çıktı...'), 'warn');
  },
  /* Arsa inşaatları: süresi dolan binayı dikip işletmeyi açar */
  bizBuildTick() {
    for (const z of this.biz) {
      if (!z.site || this.day < z.ready) continue;
      const lot = this.world.lots.find(l => l.id === z.lot);
      if (!lot) continue;
      const b = this.world.buildOnLot(lot, z.type);
      z.site = false; z.bid = b.id; z.stock = 0;
      this.world.buildMapImage(true);
      UI.toast(Tr('İnşaat Bitti'), Tr`${b.name} kapılarını açtı. İşletmecin ${z.mgr.name} seni bekliyor.`, 'ok');
    }
  },
  bizCollect(z) {
    if (z.cash < 0.01) { UI.feed(Tr('Kasa boş.')); return; }
    const v = z.cash; z.cash = 0;
    this.player.money += v;
    UI.feed(`💵 +${fmtMoney(v)} — ${Tr('@işletme|Kasa')}`, 'money');
    Audio_.ui('cash');
    this.skillXp('trade', 2);
  },
  bizNewMgr(z) {
    if (!this.spend(5)) return;
    const old = z.mgr.name;
    z.mgr = this.newManager();
    UI.feed(Tr`${old} gönderildi. Yeni işletmecin: ${z.mgr.name} (${MGR_TRAITS[z.mgr.trait].n}).`);
  },

  /* ---------------- toptan mal ---------------- */
  /* Bu binada satılan mallar: [{ g, p }] */
  goodsAt(b) {
    const out = [];
    for (const g in GOODS) {
      const s = GOODS[g].src.find(x => x[0] === b.type);
      if (!s) continue;
      let p = GOODS[g].p * s[1];
      const z = this.bizOf(b);
      if (z && GOODS[g].src[0][0] === b.type) p *= 0.3;   // kendi üretimin: yalnızca maliyet
      out.push({ g, p: Math.round(p * 100) / 100 });
    }
    return out;
  },
  /* Oyuncunun işletmelerinin ihtiyaç duyduğu mallar */
  goodsNeeded() {
    const need = {};
    for (const z of this.biz) { const B = BIZ[z.type]; if (B.goods && !z.site) need[B.goods] = (need[B.goods] || 0) + Math.max(0, Math.ceil(B.cap - z.stock)); }
    return need;
  },
  myWagonNear(x, y, r = 90) { const w = this.myWagon; return w && !w.remove && dist(w.x, w.y, x, y) < r ? w : null; },
  /* Satın alınan sandıkları yerleştir: önce yakındaki yük arabası, sonra at, sonra omuz, kalanı kapının önüne */
  buyGoods(b, g, p, n) {
    if (!this.spend(p * n)) return;
    const P = this.player, w = this.myWagonNear(b.door.x, b.door.y, 120), h = this.nearHorse(160);
    let toW = 0, toH = 0, toP = 0, toG = 0;
    for (let k = 0; k < n; k++) {
      if (w && w.crates.length < WAGON_CAP) { w.crates.push(g); toW++; continue; }
      if (h && this.loadWeight(h.load) + 2 <= HORSE_CAP) { h.load.push(new Crate(0, 0, g)); toH++; continue; }
      if (!P.carry && !P.riding) { P.carry = new Crate(0, 0, g); toP++; continue; }
      const a = rnd(0, TAU);
      this.addEnt(new Crate(b.door.x + Math.cos(a) * rnd(8, 18), b.door.y + 8 + Math.abs(Math.sin(a)) * 12, g));
      toG++;
    }
    const parts = [];
    if (toW) parts.push(Tr`${toW} arabaya`);
    if (toH) parts.push(Tr`${toH} ata`);
    if (toP) parts.push(Tr`${toP} omzuna`);
    if (toG) parts.push(Tr`${toG} kapının önüne`);
    UI.feed(Tr`📦 ${n} ${GOODS[g].n}: ${parts.join(', ')}.`);
    this.qEvent('goods', { g, n, b, wagon: toW });
    Audio_.thud(0.25);
    this.hintOnce('crate', Tr`Sandığı kendi işletmenin kapısına ya da tezgâhına götür ve <b>Teslim Et</b>. Atın 2, yük araban ${WAGON_CAP} sandık taşır; araba ahırdan alınır.`, 10);
  },
  /* b işletmesine gidebilecek yakındaki sandıklar: [{ from, e|g }] */
  deliverables(b) {
    const z = this.bizOf(b);
    if (!z || z.site) return [];
    const B = BIZ[z.type];
    if (!B.goods) return [];
    const P = this.player, out = [];
    const ok = (g) => g === B.goods;
    if (P.carry && P.carry.kind === 'crate' && ok(P.carry.g)) out.push({ from: 'p', e: P.carry });
    if (P.carry && B.goods === 'meat' && P.carry.kind === 'animal' && P.carry.dead) out.push({ from: 'p', e: P.carry, meat: true });
    const h = this.nearHorse(200);
    if (h) for (const e of h.load) if ((e.kind === 'crate' && ok(e.g)) || (B.goods === 'meat' && e.kind === 'animal' && e.dead)) out.push({ from: 'h', h, e, meat: e.kind === 'animal' });
    const w = this.myWagonNear(b.door.x, b.door.y, 140);
    if (w) w.crates.forEach((g, k) => { if (ok(g)) out.push({ from: 'w', w, g }); });
    return out;
  },
  deliverGoods(b) {
    const z = this.bizOf(b), B = BIZ[z.type], P = this.player;
    const list = this.deliverables(b);
    let n = 0;
    for (const it of list) {
      if (z.stock >= B.cap - 0.01) break;
      const v = it.meat ? (it.e.def.len >= 9 ? 1 : 0.5) : 1;
      z.stock = Math.min(B.cap, z.stock + v); n += v;
      if (it.from === 'p') P.carry = null;
      else if (it.from === 'h') { const k = it.h.load.indexOf(it.e); if (k >= 0) it.h.load.splice(k, 1); }
      else { const k = it.w.crates.indexOf(it.g); if (k >= 0) it.w.crates.splice(k, 1); }
    }
    if (!n) { UI.feed(z.stock >= B.cap - 0.01 ? Tr('Depo dolu, daha fazla mal alamaz.') : Tr('Yakında bu işletmeye uygun mal yok.'), 'warn'); return; }
    Audio_.thud(0.3);
    this.skillXp('strength', 1);
    UI.feed(Tr`📦 ${b.name}: ${n} ${GOODS[B.goods].n} teslim edildi. Stok ${this.bizStockWord(z)}.`);
  },
  /* Omuzdaki sandık için ek eylemler (taşıma menüsü) */
  bizCarryActions(e, acts) {
    const P = this.player, W = this.world;
    const w = this.myWagonNear(P.x, P.y, 40) || (this.myWagon && dist(this.myWagon.bx, this.myWagon.by, P.x, P.y) < 30 ? this.myWagon : null);
    if (w) acts.push({ n: Tr`Arabaya Yükle (${w.crates.length}/${WAGON_CAP})`, fn: () => this.stowOnWagon(w) });
    const b = W.buildingAtPx(P.x, P.y) || W.buildings.find(bb => dist2(bb.door.x, bb.door.y, P.x, P.y) < 40 * 40);
    const z = this.bizOf(b);
    if (z && !z.site) {
      if (BIZ[z.type].goods === e.g) acts.unshift({ n: Tr`Teslim Et: ${b.name}`, fn: () => this.deliverGoods(b) });
      else acts.push({ n: Tr('Bu işletme bu malı kullanmaz'), fn: () => UI.feed(Tr`${b.name} ${BIZ[z.type].goods ? GOODS[BIZ[z.type].goods].n : Tr('mal')} istiyor.`, 'warn') });
    }
  },
  stowOnWagon(w) {
    const P = this.player, e = P.carry;
    if (!e) return true;
    if (e.kind !== 'crate') { UI.feed(Tr('Arabaya yalnızca mal sandıkları yüklenir.'), 'warn'); return false; }
    if (w.crates.length >= WAGON_CAP) { UI.feed(Tr('Araba dolu.'), 'warn'); return false; }
    P.carry = null; w.crates.push(e.g);
    Audio_.thud(0.2);
    return true;
  },
  /* Kendi yük arabanın eylemleri */
  myWagonActions(w) {
    const P = this.player, acts = [{ n: Tr('Arabayı Sür'), fn: () => P.mount(w) }];
    const kinds = [...new Set(w.crates)];
    for (const g of kinds) acts.push({ n: Tr`İndir: ${GOODS[g].n} (${w.crates.filter(x => x === g).length})`, fn: () => { if (P.carry) { UI.feed(Tr('Elin dolu.'), 'warn'); return; } w.crates.splice(w.crates.indexOf(g), 1); P.carry = new Crate(0, 0, g); Audio_.thud(0.2); } });
    return acts;
  },
  /* At ya da araba üstünden, kendi işletmenin kapısında: malı boşalt */
  bizRidingActions(acts) {
    const P = this.player, W = this.world;
    const b = W.buildings.find(bb => dist2(bb.door.x, bb.door.y, P.x, P.y) < 70 * 70 && this.bizOf(bb));
    if (!b) return;
    const n = this.deliverables(b).length;
    if (n) acts.push({ n: Tr`Malı Boşalt: ${b.name} (${n})`, fn: () => this.deliverGoods(b) });
  },

  /* ---------------- yük arabası ---------------- */
  buyWagon(b) {
    if (this.myWagon) { UI.feed(Tr('Zaten bir yük araban var.')); return; }
    const pr = WAGON_PRICE * this.priceMul(true);
    if (!this.spend(pr)) return;
    this.spawnMyWagon(b.door.x + 30, b.door.y + 26, 0, []);
    UI.toast(Tr('Yük Arabası'), Tr`Ahırın önünde seni bekliyor. ${WAGON_CAP} sandık taşır.`, 'horse');
    this.hintOnce('mywagon', Tr`Yük arabana binip at gibi sürersin. Sandığı omzundayken arabanın yanında <b>Arabaya Yükle</b>; işletmenin kapısına arabayla gelince <b>Malı Boşalt</b>. Arabanı herhangi bir ahıra getirtebilirsin.`, 10);
  },
  spawnMyWagon(x, y, ang, crates) {
    const w = Wagon.owned(x, y, ang);
    w.crates = crates.slice();
    this.myWagon = w;
    this.addEnt(w);
    return w;
  },
  fetchWagon(b) {
    const w = this.myWagon;
    if (!w) return;
    if (this.player.riding === w) { UI.feed(Tr('Zaten arabadasın.')); return; }
    if (!this.spend(0.5)) return;
    w.x = b.door.x + 30; w.y = b.door.y + 26; w.ang = 0; w.spd = 0; w.bx = undefined; w.trail(true);
    if (!this.ents.includes(w)) { w.remove = false; this.addEnt(w); }
    UI.feed(Tr('Seyis arabanı ahırın önüne getirdi.'));
  },

  /* ---------------- arsalar ---------------- */
  lotOwned(lot) { return this.lotsOwned.includes(lot.id); },
  lotBiz(lot) { return this.biz.find(z => z.lot === lot.id) || null; },
  buyLot(lot) {
    if (this.law.level > 0) { UI.feed(Tr('Aranırken kimse sana tapu vermez.'), 'warn'); return false; }
    if (!this.spend(lot.price)) return false;
    this.lotsOwned.push(lot.id);
    Audio_.ui('cash');
    UI.toast(Tr('Arsa Satın Alındı'), Tr('İlçe binasında ya da arsanın tabelasından inşaata başlayabilirsin.'), 'ok');
    return true;
  },
  /* Bu arsaya sığan işletme türleri */
  lotTypes(lot) { return Object.keys(BIZ).filter(k => BUILDINGS[k].w <= lot.w && BUILDINGS[k].h <= lot.h); },
  startBuild(lot, type) {
    const t = this.bizTown(lot.town), pr = this.bizBuildPrice(type, t);
    if (!this.spend(pr)) return false;
    const mgr = this.newManager();
    this.biz.push({ lot: lot.id, bid: -1, site: true, ready: this.day + BUILD_DAYS, type, town: lot.town, stock: 0, cash: 0, mgr, since: this.day, bank: false, total: 0, last: 0 });
    this.world.lotSite(lot);
    this.stat('businesses', 1);
    Audio_.ui('cash');
    UI.toast(Tr('İnşaat Başladı'), Tr`${BUILDINGS[type].n} ${BUILD_DAYS} gün içinde hazır olacak. İşletmecin: ${mgr.name}.`, 'ok');
    return true;
  },
  /* Kayıttan yüklenince: arsa durumlarını dünyaya yeniden uygula */
  bizApplyWorld() {
    const W = this.world;
    // kayıt sırası korunur: binalar aynı kimliği alsın diye sırayla dikilir
    const built = this.biz.filter(z => z.lot && !z.site).sort((a, c) => a.bid - c.bid);
    for (const z of built) { const lot = W.lots.find(l => l.id === z.lot); if (lot) z.bid = W.buildOnLot(lot, z.type).id; }
    for (const z of this.biz) if (z.site) { const lot = W.lots.find(l => l.id === z.lot); if (lot) W.lotSite(lot); }
    if (built.length) W.buildMapImage(true);
  },

  /* ---------------- kayıt ---------------- */
  saveBiz() {
    const w = this.myWagon;
    const ground = this.ents.filter(e => e.kind === 'crate' && !e.remove).map(e => ({ x: Math.round(e.x), y: Math.round(e.y), g: e.g }));
    return { list: this.biz, lots: this.lotsOwned, wagon: w ? { x: Math.round(w.x), y: Math.round(w.y), ang: w.ang, crates: w.crates, riding: this.player.riding === w } : null, ground };
  },
  loadBiz(d) {
    if (!d) return;
    this.biz = d.list || []; this.lotsOwned = d.lots || [];
    this.bizApplyWorld();
    if (d.wagon) {
      const w = this.spawnMyWagon(d.wagon.x, d.wagon.y, d.wagon.ang || 0, d.wagon.crates || []);
      if (d.wagon.riding && !this.player.riding) { w.x = this.player.x; w.y = this.player.y; w.trail(true); this.player.mount(w, true); }
    }
    for (const c of d.ground || []) this.addEnt(new Crate(c.x, c.y, c.g));
  },
};
