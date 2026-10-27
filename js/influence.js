'use strict';
/* ==========================================================
   FRONTIER'S END — nüfuz (G nesnesine eklenir)
   - Nüfuz (0–100): servet (nakit, banka, işletmeler, bankaların sermayesi,
     petrol, mülkler, malikane, evler; logaritmik, en çok 60), onur
     (−25…+25) ve varlıklar (pazar hakimiyeti, banka, malikane, kulüp).
   - Bir kasabada işletmelerin, kasabanın bankası ve malikanen orada
     nüfuzunu artırır (yerel nüfuz).
   - Basamaklar (INF_LV): sıradan, tanınmış, nüfuzlu, sözü geçen, patron.
     Her gün bakılır; yükselince duyurulur.
   - Suç dosyası (law.rec): başındaki ödülün suçları. Dosyanın en ağır
     suçunun sınıfı (CRIME_CLS) rüşvetle kapanması için gereken nüfuzu
     belirler: hafif → tanınmış, orta → nüfuzlu, soygun → sözü geçen,
     cinayet → patron; kanun adamı öldürmek hiç kapanmaz.
   - Rüşvet: tutuklamaya gelen kanun adamına, şerifin masasında ("Dosyayı
     Kapat") ya da tutuklanınca ("Şerifle Anlaş"). Kabul edilirse aranma
     biter, ödül ve dosya silinir; onur düşer, kasabada söylenti birikir.
     Bazı kasabaların şerifi rüşvet almaz (dünya tohumuna ve on yıla göre):
     ona teklif yapmak ayrı bir suçtur. Nüfuz arttıkça tanıklar ucuzlar,
     bir kısmı hiç konuşmaz; ödül avcıları seyrek gelir.
   - Söylenti eşiği aşılınca skandal çıkar: gazeteye düşersin, onurun ve
     nüfuzun (birkaç yıl) düşer, kasabaya dürüst bir şerif atanır.
     BRIBE.reformYear'da kurgusal Islah Komisyonu kurulur: rüşvet
     pahalılaşır, dürüst şerif çoğalır, skandalda ceza kesilir.
   ========================================================== */

const InfluenceSystems = {
  /* Varlıkların toplam değeri ($) */
  netWorth() {
    let v = Math.max(0, this.player.money) + Math.max(0, this.bank);
    for (const z of this.biz) if (!z.site) v += BIZ[z.type].p * this.bizTownMul(this.bizTown(z.town)) + (z.fin ? Math.max(0, z.fin.e) : 0);
    const T = this.tycoon;
    if (T) {
      for (const f of T.oil.f) if (f.own === 'p') v += OIL.land + f.w.filter(w => w && w.s !== 'dry').length * OIL.well;
      if (T.oil.ref && T.oil.ref.done) v += OIL.ref;
    }
    for (const id of this.props) { const P = PROPERTIES.find(p => p.id === id); if (P) v += P.p; }
    if (this.estate) v += MANSION_PRICE;
    for (const h of this.homes) if (h.done && HOME_TYPES[h.type]) v += HOME_TYPES[h.type].p;
    return v;
  },
  /* Nüfuzun parçaları; t verilirse o kasabaya özel pay da */
  infParts(t) {
    const nw = this.netWorth();
    const wealth = clamp(25 * Math.log10(Math.max(1, nw) / 400), 0, 60);
    const honor = clamp(this.honor / 4, -25, 25);
    let assets = 0;
    if (this.tycoon) { const S = this.sectors(); for (const k in S) assets += S[k].lv === 3 ? 8 : S[k].lv === 2 ? 4 : 0; }
    assets = Math.min(16, assets);
    if (this.biz.some(z => z.fin && !z.site)) assets += 5;
    if (this.estate) assets += 5;
    if (this.club) assets += 3;
    let local = 0;
    if (t) {
      local += Math.min(10, 2 * this.biz.filter(z => !z.site && z.town === t.id).length);
      if (this.biz.some(z => z.fin && !z.site && z.town === t.id)) local += 10;
      if (this.estate) { const mb = this.world.buildings[this.estate.bid]; if (mb && mb.town === t.id) local += 5; }
    }
    const taint = this.infl && this.infl.taint > this.year ? -BRIBE.taint : 0;   // skandal lekesi
    return { nw, wealth, honor, assets, local, taint };
  },
  /* Genel (t yoksa) ya da bir kasabadaki nüfuz, 0–100 */
  influence(t) { const p = this.infParts(t); return clamp(Math.round(p.wealth + p.honor + p.assets + p.local + p.taint), 0, 100); },
  infLv(v) { let k = 0; INF_LV.forEach((L, i) => { if (v >= L.min) k = i; }); return k; },
  /* Bulunduğun kasaba (yoksa en yakını) */
  infTown() { const P = this.player; return this.world.townAt(P.x, P.y, 60) || this.nearestTown(P.x, P.y); },

  /* ---------------- suç dosyası ---------------- */
  recAdd(type, b, masked) { const L = this.law; (L.rec || (L.rec = [])).push({ t: type, b: Math.round(b * 100) / 100, m: masked ? 1 : 0, d: this.day }); },
  recClear() { this.law.rec = []; },
  /* maskeli suçlar kimliğin açığa çıkınca senin dosyana geçer; iz kaybolunca unutulur */
  recUnmask() { for (const r of this.law.rec || []) r.m = 0; },
  recDropMasked() { const L = this.law; if (L.rec) L.rec = L.rec.filter(r => !r.m); },
  /* Dosyanın en ağır suçu (0 hafif … 4 kanun adamı öldürme); kaydı olmayan eski ödül büyüklüğüne göre */
  recClass() {
    const L = this.law, R = (L.rec || []).filter(r => !r.m);
    if (!R.length) return L.bounty >= 100 ? 3 : L.bounty >= 30 ? 2 : L.bounty >= 8 ? 1 : 0;
    return Math.max(...R.map(r => (CRIME_CLS[r.t] !== undefined ? CRIME_CLS[r.t] : 1)));
  },

  /* ---------------- rüşvet ---------------- */
  /* Kasabanın şerifi rüşvet alır mı: dünya tohumuna ve on yıla bağlı; skandaldan sonra dürüst biri atanır */
  lawHonest(t) {
    if (!t) return false;
    const I = this.infl, y = this.year;
    if (I.honest[t.id] > y) return true;
    return hash2((this.seed % 9973) + 11, TOWNS.findIndex(d => d.id === t.id) + 7, Math.floor(y / 10)) < BRIBE.honest[y >= BRIBE.reformYear ? 1 : 0];
  },
  /* Dosya rüşvetle kapanabilir mi: '' ya da nedeni */
  bribeWhy(t) {
    const L = this.law;
    if (L.bounty <= 0 && L.level <= 0) return Tr('Kapatılacak bir dosyan yok.');
    if (this.player.masked) return Tr('Maskeyle pazarlık olmaz.');
    const c = this.recClass();
    if (c >= 4) return Tr('Kanun adamı öldürmenin pazarlığı olmaz.');
    if (this.infLv(this.influence(t)) < c + 1) return Tr`Bu dosya (${CRIME_CLS_N[c]}) için nüfuzun yetmez: ${INF_LV[c + 1].n} olmalısın.`;
    return '';
  },
  /* Bedel: ödül × suçun sınıfı, nüfuzla ucuzlar (resmî cezanın altında); kovalamaca sürüyorsa ve Islah Komisyonu'ndan
     sonra pahalı; kasabanın bankası seninse şerifin kredisi sende, ucuz */
  bribePrice(t) {
    const L = this.law, c = Math.min(3, this.recClass()), inf = this.influence(t);
    let p = Math.max(BRIBE.min, L.bounty * BRIBE.cls[c] * (1 - 0.7 * inf / 100));
    if (L.level > 0) p *= 1 + 0.1 * L.level;
    if (this.year >= BRIBE.reformYear) p *= BRIBE.reform;
    if (t && this.biz.some(z => z.fin && !z.site && z.town === t.id)) p *= 0.75;
    return Math.ceil(p);
  },
  /* Rüşvet teklifi: by kanun adamı (şerif ofisinde masadaki), t kasaba. Döner: 'ok', 'no' (geri çevirdi) ya da 'honest'
     (dürüst kanun adamı: teklif suç sayıldı) */
  bribeLaw(by, t) {
    const why = this.bribeWhy(t), P = this.player;
    if (why) { UI.feed(why, 'warn'); return 'no'; }
    const pr = this.bribePrice(t), c = Math.min(3, this.recClass());
    if (P.money < pr) { UI.feed(Tr('Yeterli paran yok.'), 'warn'); Audio_.ui('error'); return 'no'; }
    UI.subtitle(P.name, pick(LINES.bribeOffer), 2, true);
    if (by) by.bribeTried = true;
    if (this.lawHonest(t) || (by && by.honest)) { this.bribeFail(by); return 'honest'; }
    const ch = clamp(0.55 + (this.influence(t) - INF_LV[c + 1].min) / 80 + this.skill('charisma') * 0.02, 0.2, 0.97);
    if (!chance(ch)) {
      if (by) setTimeout(() => by.say(pick(LINES.lawGreedy), 2.5), 600);
      UI.feed(Tr('Kanun adamı pazarlığa yanaşmadı.'), 'warn');
      return 'no';
    }
    P.money -= pr; Audio_.ui('cash');
    if (by) setTimeout(() => by.say(pick(LINES.lawBribed), 2.5), 600);
    this.lawClear(by);
    this.addHonor(-BRIBE.honor[c]);
    this.skillXp('charisma', 2);
    this.stat('bribes', 1);
    this.infl.paid = (this.infl.paid || 0) + pr;
    UI.feed(Tr`💵 -${fmtMoney(pr)} — dosyan kapandı, kanun peşini bıraktı.`, 'law');
    this.bribeHeat(t, c);
    return 'ok';
  },
  /* Tutuklamaya gelen kanun adamına rüşvet (yalnızca dosya kapanabiliyorsa) */
  bribeActs(cop) {
    const t = this.infTown();
    if (cop.bribeTried || this.bribeWhy(t)) return [];
    return [{ n: Tr`Rüşvet Teklif Et (${fmtMoney(this.bribePrice(t))})`, fn: () => this.bribeLaw(cop, t) }];
  },
  /* Dürüst kanun adamına rüşvet teklifi: ayrı bir suç */
  bribeFail(by) {
    const L = this.law, P = this.player;
    if (by) { by.honest = true; setTimeout(() => by.say(pick(LINES.lawRefuse), 2.5), 600); }
    L.bounty += BRIBE.fail; this.recAdd('bribery', BRIBE.fail);
    L.desc = this.outfit(); L.masked = false;
    this.addHonor(-2);
    if (L.level <= 0) { L.level = 1; L.lastX = P.x; L.lastY = P.y; L.unseen = 0; L.spawnT = 4; if (by) by.hostile = true; }
    UI.wanted(Tr('Rüşvet teklifi'), BRIBE.fail);
  },
  /* Aranma, ödül ve dosya silinir (teslim olup cezayı ödemekle ya da rüşvetle); keep: rüşveti alan kanun adamı yerinde kalır */
  lawClear(keep) {
    const L = this.law;
    this.truce = null; this.truceUsed = 0;
    L.level = 0; L.bounty = 0; L.maskBounty = 0; L.masked = false; L.resist = false; L.desc = null; L.arrestT = 0; L.fleeT = 0; L.warned = false; L.fleeWarn = false;
    this.recClear();
    for (const r of this.reports) r.done = true;
    for (const e of this.ents) if (e.kind === 'npc' && e.isLaw) { e.hostile = false; e.state = e.work !== undefined ? 'static' : 'idle'; if (!e.town && e !== keep) e.remove = true; }
  },
  /* Kasabada söylenti birikir; eşik aşılınca skandal çıkabilir */
  bribeHeat(t, c) {
    if (!t) return;
    const I = this.infl, h = (I.heat[t.id] || 0) + BRIBE.heat[c];
    I.heat[t.id] = h;
    if (h >= BRIBE.scandal && chance((h - BRIBE.scandal + 2) * 0.08 * (this.year >= BRIBE.reformYear ? 1.5 : 1))) this.scandal(t);
  },
  scandal(t) {
    const I = this.infl, reform = this.year >= BRIBE.reformYear;
    I.heat[t.id] = 0;
    I.honest[t.id] = this.year + 8;
    I.taint = this.year + BRIBE.taintYrs;
    this.addHonor(-6);
    let fine = 0;
    if (reform) {
      fine = clamp(Math.round(this.netWorth() * 0.03 / 5) * 5, 50, 3000);
      let left = fine;
      const fb = Math.min(Math.max(0, this.bank), left); this.bank -= fb; left -= fb;
      const fp = Math.min(Math.max(0, this.player.money), left); this.player.money -= fp;
    }
    UI.toast(Tr('Rüşvet Skandalı'), reform ? Tr`${t.n} şerifine verdiğin rüşvetler ortaya çıktı. Islah Komisyonu ${fmtMoney(fine)} ceza kesti; şerif görevden alındı.` : Tr`${t.n} şerifine verdiğin rüşvetler gazeteye düştü. Şerif görevden alındı; nüfuzun birkaç yıl zarar görecek.`);
    this.ecoLog(reform ? 'islahceza' : 'skandal', t, reform ? { m: fine } : {});
    Audio_.ui('error');
  },
  /* Kasabadaki söylentinin sözü (Günlük) */
  heatWord(h) { return h >= BRIBE.scandal ? Tr('herkes konuşuyor') : h >= BRIBE.scandal * 0.6 ? Tr('dedikodu dolaşıyor') : Tr('fısıltılar'); },

  /* ---------------- günlük ---------------- */
  /* Basamak değişimi: yükselince duyurulur, düşünce bildirilir; yılbaşında söylentiler yatışır */
  infDaily(d) {
    if (!this.infl) this.infInit();
    const I = this.infl;
    if (d !== undefined && d % this.dpy === 0) {
      const y = START_YEAR + d / this.dpy;
      for (const k in I.heat) { I.heat[k] *= 0.5; if (I.heat[k] < 0.5) delete I.heat[k]; }
      if (y === BRIBE.reformYear) this.ecoLog('islah', this.infTown());
    }
    const lv = this.infLv(this.influence());
    if (lv === I.cur) return;
    if (lv > I.cur) UI.toast(Tr`Nüfuz: ${INF_LV[lv].n}`, INF_LV[lv].d, 'ok');
    else UI.feed(Tr`Nüfuzun azaldı: ${INF_LV[lv].n}.`, 'warn');
    I.cur = lv; I.top = Math.max(I.top, lv);
  },

  /* ---------------- kayıt ---------------- */
  infInit() { this.infl = { cur: 0, top: 0, heat: {}, honest: {}, taint: 0, paid: 0 }; },
  saveInfl() { return this.infl; },
  loadInfl(d) {
    this.infInit();
    this.recDropMasked();   // yüklemede maskeli aranma unutulur
    // nüfuzdan önceki bir kayıt: bugünkü basamak duyurulmadan kabul edilir
    if (!d) { this.infl.cur = this.infl.top = this.infLv(this.influence()); return; }
    Object.assign(this.infl, d);
  },
};
