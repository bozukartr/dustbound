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
    return { nw, wealth, honor, assets, local };
  },
  /* Genel (t yoksa) ya da bir kasabadaki nüfuz, 0–100 */
  influence(t) { const p = this.infParts(t); return clamp(Math.round(p.wealth + p.honor + p.assets + p.local), 0, 100); },
  infLv(v) { let k = 0; INF_LV.forEach((L, i) => { if (v >= L.min) k = i; }); return k; },
  /* Bulunduğun kasaba (yoksa en yakını) */
  infTown() { const P = this.player; return this.world.townAt(P.x, P.y, 60) || this.nearestTown(P.x, P.y); },

  /* ---------------- günlük ---------------- */
  /* Basamak değişimi: yükselince duyurulur, düşünce bildirilir */
  infDaily() {
    if (!this.infl) this.infInit();
    const I = this.infl, lv = this.infLv(this.influence());
    if (lv === I.cur) return;
    if (lv > I.cur) UI.toast(Tr`Nüfuz: ${INF_LV[lv].n}`, INF_LV[lv].d, 'ok');
    else UI.feed(Tr`Nüfuzun azaldı: ${INF_LV[lv].n}.`, 'warn');
    I.cur = lv; I.top = Math.max(I.top, lv);
  },

  /* ---------------- kayıt ---------------- */
  infInit() { this.infl = { cur: 0, top: 0 }; },
  saveInfl() { return this.infl; },
  loadInfl(d) {
    this.infInit();
    // nüfuzdan önceki bir kayıt: bugünkü basamak duyurulmadan kabul edilir
    if (!d) { this.infl.cur = this.infl.top = this.infLv(this.influence()); return; }
    Object.assign(this.infl, d);
  },
};
