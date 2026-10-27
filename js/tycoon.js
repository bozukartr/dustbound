'use strict';
/* ==========================================================
   FRONTIER'S END — tekelleşme (G nesnesine eklenir)
   - Sektörler (data.js SECTORS): aynı pazara satan işletme türleri.
     Payın, bütün kasabalardaki o türden açık işletmelerin değerinden
     (fiyat × kasaba çarpanı) senin olanların oranıdır.
   - Pay arttıkça hakimiyet basamağın yükselir (SECTOR_LV): güçlü %25,
     hakim %50, tekel %75. Hakimiyet o sektördeki işletmelerinin gelirini
     artırır, toptan malı ucuzlatır ve satmak istemeyen rakiplere yapılan
     teklifi ucuzlatır. Hakim olduğun sektörde her yıl bir rakip (tekelde
     iki) müşterisini kaybedip ucuza satılığa çıkabilir.
   - Satmak istemeyen bir işletmeye de teklif yapılır: bedeli piyasa
     fiyatının iki katından başlar, hakimiyetin arttıkça düşer.
   - Tekel itibarını zedeler; ticaret odası (kurgusal) TEKEL_YEAR'dan
     sonra zaman zaman soruşturup ceza keser.
   - Hakimiyet, tekel, ceza ve zor durumdaki rakipler gazetelere yansır:
     gelişim günlüğüne (js/develop.js) 'eco' kaydı olarak yazılır.
   - Kendi bankan (BANK): gelişmiş bir kasabadaki büyük arsaya kurulur ya da
     kasabanın bankası teklifle alınır. Kasabanın mevduatı bankalar arasında
     güvene ve mevduat faizine göre paylaşılır; mevduatın bir kısmı krediye
     gider. Kâr, kredi faiziyle mevduat faizi arasındaki fark eksi batık
     krediler ve giderlerdir. Sen faizi, kredi politikasını ve bekçiyi
     seçersin, sermaye ekler ya da çekersin. Güven sarsılırsa mevduat
     sahipleri kapıya dayanır (panik): kasadaki para yetmezse önce kendi
     hesabından aktarılır; o da yetmezse iki gün içinde sermaye eklemezsen
     banka batar. Bankalar soyulabilir; bekçi bunu zorlaştırır.
   - Petrol (OIL): sahalar dünya tohumundan gelir, yüzeyde kara sızıntılar
     görünür. OIL.year'dan sonra arazi alınır, sondaj kuleleri dikilir (kuru
     kuyu ya da fışkıran kuyu çıkabilir), rezerv tükendikçe üretim düşer.
     Varilin fiyatı döneme bağlıdır: elektrik gazyağını geriletir,
     otomobiller benzine talebi büyütür. Sahiplenilmemiş sahaları zamanla
     kurgusal rakip şirketler alır; onlara teklif yapılabilir. İstasyonlu
     bir kasabaya kurulan rafineri petrolü daha pahalıya sattırır.
   ========================================================== */

/* Petrol sahasının düzeni (merkezine göre karo): kuyuların, sızıntıların ve deponun yerleri */
const OIL_WELLS = [[-4, -2], [0, -3], [4, -1], [-2, 2], [3, 3]], OIL_SEEPS = [[-1, 0], [1, 1], [-4, 2]], OIL_TANK = [-5, 4];
const OIL_OK = (w) => w && (w.s === 'ok' || w.s === 'gush');

const TycoonSystems = {
  /* ---------------- sektörler ---------------- */
  secOf(type) {
    for (const k in SECTORS) if (SECTORS[k].types.includes(type)) return k;
    return null;
  },
  /* Bir işletmenin pazardaki ağırlığı: fiyatı × kasaba çarpanı */
  secWeight(b) { return BIZ[b.type].p * this.bizTownMul(this.bizTown(b.town)); },
  /* Bütün sektörlerin durumu: { k: { tot, mine, n, own, share, lv } }. Sahiplik ya da binalar değişmedikçe önbellekli. */
  sectors() {
    const W = this.world;
    let built = 0;
    for (const z of this.biz) if (!z.site) built++;
    const key = this.day + ':' + built + ':' + W.buildings.length + ':' + (this._secV || 0);
    if (this._sec && this._secK === key) return this._sec;
    const S = {}, mine = new Set();
    for (const k in SECTORS) S[k] = { tot: 0, mine: 0, n: 0, own: 0, share: 0, lv: 0 };
    for (const z of this.biz) if (!z.site) mine.add(z.bid);
    for (const b of W.buildings) {
      if (!b.town || b.shut || !BIZ[b.type]) continue;
      const k = this.secOf(b.type);
      if (!k) continue;
      const s = S[k], v = this.secWeight(b);
      s.tot += v; s.n++;
      if (mine.has(b.id)) { s.mine += v; s.own++; }
    }
    for (const k in S) S[k].val = S[k].mine;
    // petrol: bütün kuyuların günlük üretim gücü; değeri arazi ve kuyular
    const T = this.tycoon;
    if (T && T.oil) T.oil.f.forEach((f, i) => {
      if (f.own === null) return;
      const s = S.petrol, cap = this.oilCap(i), nw = f.w.filter(OIL_OK).length;
      s.tot += cap; s.n += nw;
      if (f.own === 'p') { s.mine += cap; s.own += nw; s.val += OIL.land + f.w.filter(w => w && w.s !== 'dry').length * OIL.well; }
    });
    for (const k in S) { const s = S[k]; s.share = s.tot ? s.mine / s.tot : 0; s.lv = s.own && s.n >= (SECTORS[k].minN || 0) ? this.secLvOf(s.share) : 0; }
    this._sec = S; this._secK = key;
    return S;
  },
  secDirty() { this._secV = (this._secV || 0) + 1; },
  /* Yüzde: Türkçede %12,5; dec ondalık basamak */
  pct(v, dec = 0) {
    const k = Math.pow(10, dec), n = Math.round(v * 100 * k) / k;
    return Tr('%{0}', typeof I18N !== 'undefined' && I18N.lang === 'tr' ? String(n).replace('.', ',') : String(n));
  },
  secLvOf(share) { let lv = 0; SECTOR_LV.forEach((L, i) => { if (share >= L.min - 1e-9) lv = i; }); return lv; },
  secLv(type) { const k = this.secOf(type); return k ? this.sectors()[k].lv : 0; },
  /* Hakimiyetin gelir çarpanı (o sektördeki işletmelerin) */
  secIncMul(type) { return SECTOR_LV[this.secLv(type)].inc; },
  /* Toptan malın çarpanı: malı tüketen sektörlerden en güçlü olanının indirimi */
  secGoodsMul(g) {
    let m = 1;
    const S = this.sectors();
    for (const k in SECTORS) if (SECTORS[k].types.some(t => BIZ[t] && BIZ[t].goods === g)) m = Math.min(m, SECTOR_LV[S[k].lv].goods);
    return m;
  },
  /* b'yi alırsan sektördeki payın ve basamağın */
  secAfter(b) {
    const k = this.secOf(b.type);
    if (!k) return null;
    const s = this.sectors()[k], share = s.tot ? (s.mine + this.secWeight(b)) / s.tot : 0;
    return { k, before: s.share, share, lv: this.secLvOf(share), lv0: s.lv };
  },
  /* Sektörde en değerli işletmenin kasabası (haberlerin kasabası) */
  secTown(k) {
    if (k === 'petrol') { const f = this.tycoon && this.tycoon.oil.f.findIndex(x => x.own === 'p'); if (f >= 0) return this.oilTown(f); }
    let best = null, bv = -1;
    for (const z of this.biz) {
      if (z.site || this.secOf(z.type) !== k) continue;
      const v = BIZ[z.type].p * this.bizTownMul(this.bizTown(z.town));
      if (v > bv) { bv = v; best = this.bizTown(z.town); }
    }
    return best || this.nearestTown(this.player.x, this.player.y);
  },

  /* ---------------- teklif ve zor durumdaki rakipler ---------------- */
  /* Satmak istemeyen bir işletmeye satın alma teklifi yapılabilir mi */
  bizOfferable(b) {
    return !!(b && BIZ[b.type] && b.town && !b.def.lock && !b.shut && !this.bizOf(b) && !this.bizForSale(b));
  },
  bizOfferPrice(b) { return Math.round(this.bizPrice(b) * SECTOR_LV[this.secLv(b.type)].offer / 5) * 5; },
  /* Büyük rakibinin gölgesinde müşterisini kaybetmiş, ucuza satılık işletme */
  bizDistress(b) { const T = this.tycoon; return !!(T && b && T.dist[this.bKey(b)]); },
  /* Yılbaşı: hakim olduğun sektörlerde rakipler zorlanır; süresi dolan toparlanır */
  ecoYear(y) {
    const T = this.tycoon, S = this.sectors();
    for (const id in T.dist) if (y - T.dist[id].y >= DISTRESS_YRS) delete T.dist[id];
    for (const k in S) {
      const n = S[k].lv >= 3 ? 2 : S[k].lv >= 2 ? 1 : 0;
      for (let i = 0; i < n; i++) {
        if (!chance(0.65)) continue;
        const c = this.world.buildings.filter(b => SECTORS[k].types.includes(b.type) && b.town && !b.shut && !b.def.lock && !this.bizOf(b) && !this.bizDistress(b));
        if (!c.length) break;
        const b = pick(c);
        T.dist[this.bKey(b)] = { y };
        this.ecoLog('zor', this.bizTown(b.town), { b: b.type });
      }
    }
    // petrolde: rakip şirket sahasını ucuza satmaya razı olur
    if (S.petrol.lv >= 2 && chance(0.65)) {
      const c = T.oil.f.map((f, i) => i).filter(i => typeof T.oil.f[i].own === 'number' && !T.dist['o' + i]);
      if (c.length) { const i = pick(c); T.dist['o' + i] = { y }; this.ecoLog('zorp', this.oilTown(i), { c: T.oil.f[i].own }); }
    }
  },

  /* ---------------- günlük ---------------- */
  /* Basamak değişimleri: yükselişte duyuru; ilk kez hakim ve tekel olunca gazeteye çıkar, tekel itibarı zedeler */
  ecoCheck() {
    const T = this.tycoon;
    if (!T) return;
    const S = this.sectors();
    for (const k in S) {
      const lv = S[k].lv, cur = T.cur[k] || 0;
      if (lv === cur) continue;
      T.cur[k] = lv;
      if (lv > cur) UI.toast(Tr`${SECTORS[k].n}: ${SECTOR_LV[lv].n}`, [Tr`Bu pazarda artık sözün geçiyor: işletmelerin daha çok kazanır, toptan mal ucuzlar.`, Tr`Pazarın yarısı senin: rakipler fiyatlarını sana bakarak belirliyor.`, Tr`Pazar neredeyse tamamen senin. Ama halk tekelcileri sevmez.`][lv - 1], 'ok');
      else UI.feed(Tr`📉 ${SECTORS[k].n} pazarındaki hakimiyetin geriledi: ${SECTOR_LV[lv].n}.`, 'warn');
      if (lv > (T.lv[k] || 0)) {
        T.lv[k] = lv;
        if (lv >= 2) this.ecoLog(lv === 3 ? 'tekel' : 'hakim', this.secTown(k), { x: k });
        if (lv === 3) this.addHonor(-3);
      }
    }
  },
  /* Ticaret odası: tekel olunan sektör için zaman zaman ceza */
  ecoFine() {
    if (this.year < TEKEL_YEAR) return;
    const S = this.sectors();
    for (const k in S) {
      if (S[k].lv < 3 || !chance(1 / (TEKEL_ODDS * this.dpy))) continue;
      const m = Math.round(S[k].val * TEKEL_FINE);
      // önce bankadan, yetmezse cepten; ödenemeyen kısım itibarından düşer
      let left = m;
      const fb = Math.min(Math.max(0, this.bank), left); this.bank -= fb; left -= fb;
      const fp = Math.min(Math.max(0, this.player.money), left); this.player.money -= fp; left -= fp;
      if (left > 0.5) this.addHonor(-2);
      this.tycoon.fines += m;
      UI.toast(Tr('Tekel Cezası'), Tr`Ticaret odası ${SECTORS[k].n} pazarındaki tekelin için ${fmtMoney(m)} ceza kesti.`);
      this.ecoLog('ceza', this.secTown(k), { x: k, m });
    }
  },
  tycoonDaily(d) {
    if (!this.tycoon) this.tycoonInit();
    if (d % this.dpy === 0) { const y = START_YEAR + d / this.dpy; this.oilYear(y); this.ecoYear(y); }
    this.bankDaily();
    this.oilDaily();
    this.ecoFine();
    this.ecoCheck();
  },
  /* İşletme alındı ya da inşaatı bitti (z: yeni işletme) */
  tyBought(z) {
    this.secDirty();
    if (z && z.type === 'bank' && !z.fin) this.bankInit(z, z.lot !== undefined);
    this.ecoCheck();
  },

  /* ---------------- kendi bankan ---------------- */
  /* Banka kurulabilir mi; değilse nedeni (arsaya kurulan banka) */
  bizBuildWhy(type, lot) {
    if (type !== 'bank') return '';
    const S = this.devOf(this.bizTown(lot.town));
    if (!S || S.ghost || S.tier < BANK.minTier) return Tr`Banka ancak gelişmiş bir kasabada kurulur (${DEV_TIERS[BANK.minTier]} ya da daha büyüğü).`;
    if (this.honor < BANK.honor) return Tr`Halk parasını ancak itibarlı birine emanet eder (itibar ${BANK.honor} ve üstü).`;
    return '';
  },
  /* Satmak istemeyen işletmeye neden teklif yapılamıyor ('' ise yapılabilir) */
  bizOfferWhy(b) {
    if (b.type === 'bank' && this.honor < BANK.honor) return Tr`Bankanın hissedarları yalnızca itibarlı birine satar (itibar ${BANK.honor} ve üstü).`;
    return '';
  },
  /* fresh: yeni kurulan banka (mevduatı sıfırdan toplar); yoksa kasabanın bankası müşterileriyle devralınır */
  bankInit(z, fresh) {
    const F = z.fin = { d: 0, l: 0, e: BANK.cap0, tr: fresh ? 0.45 : 0.6, rd: 1, rl: 1, g: false, run: null, prof: 0, avg: 0 };
    if (!fresh) { F.d = this.bankTarget(z) * 0.9; F.l = F.d * BANK.lends[1].k * 0.9; }
    this.ecoLog(fresh ? 'banka' : 'bankal', this.bizTown(z.town));
    this.hintOnce('bank', Tr`Bankan kendi kendine işler: mevduat toplar, kredi verir. Tezgâhtan <b>mevduat faizini</b>, <b>kredi politikasını</b> ve <b>bekçiyi</b> seçer, <b>sermaye</b> ekler ya da çekersin. Kasada yeterli para kalmazsa bir panik bankanı batırabilir.`, 14);
  },
  bankVault(F) { return F.d + F.e - F.l; },
  /* Kasabanın mevduatı: basamağına göre (hayalet kasabada neredeyse hiç) */
  bankPool(t) {
    const S = this.devOf(t);
    if (S && S.ghost) return BANK.pool[0] * 0.15;
    return BANK.pool[clamp(S ? S.tier : this.devStartTier(t), 0, 4)];
  },
  bankAppeal(F) { return (0.4 + F.tr) * BANK.rates[F.rd].pull; },
  /* Bankanın payına düşen mevduat: öteki bankalar 1 çekicilikle, yastık altı da bir pay alır */
  bankTarget(z) {
    const t = this.bizTown(z.town), a = this.bankAppeal(z.fin);
    let others = BANK.mattress;
    for (const b of t.buildings) {
      if (b.type !== 'bank' || b.shut || b.id === z.bid) continue;
      const o = this.bizOf(b);
      others += o && o.fin ? this.bankAppeal(o.fin) : 1;
    }
    return this.bankPool(t) * a / (a + others);
  },
  bankTrustWord(tr) { return tr > 0.8 ? Tr('çok yüksek') : tr > 0.6 ? Tr('yüksek') : tr > 0.4 ? Tr('orta') : tr > 0.25 ? Tr('düşük') : Tr('sarsıldı'); },
  bankDaily() {
    for (const z of this.biz.slice()) if (z.fin && !z.site) this.bankDay(z);
  },
  bankDay(z) {
    const F = z.fin, t = this.bizTown(z.town), S = this.devOf(t), dpy = this.dpy;
    const R = BANK.rates[F.rd], L = BANK.lends[F.rl];
    // panik sürüyor: süre dolduysa banka batar
    if (F.run) { if (this.day >= F.run.until) this.bankFail(z); return; }
    // mevduat hedefine doğru akar; çekilen para kasadan ödenir
    F.d = Math.max(0, F.d + (this.bankTarget(z) - F.d) * BANK.flow);
    // krediler: hedefe doğru verilir (kasada karşılık kalır); fazlası vadesi doldukça geri döner
    const want = F.d * L.k;
    if (want > F.l) F.l += Math.max(0, Math.min((want - F.l) * 0.25, this.bankVault(F) - F.d * BANK.reserve));
    else F.l -= (F.l - want) / (2 * dpy);
    // faiz geliri ve gideri (yıllık oranlar), batık krediler: kasaba geriledikçe artar
    const mood = S && S.ghost ? 4 : clamp(1 - (S ? S.g : 0) * 15, 0.5, 3);
    const inc = F.l * L.r / dpy * this.secIncMul('bank'), exp = F.d * R.r / dpy;
    let bad = F.l * L.def / dpy * mood * rnd(0.5, 1.5);
    const spike = chance(BANK.spike);
    if (spike) bad += F.l * rnd(0.04, 0.1) * (0.5 + F.rl * 0.5);
    bad = Math.min(bad, F.l);
    F.l -= bad;
    const p = inc - exp - bad - BANK.wage - (F.g ? BANK.guard : 0);
    F.prof = p; F.avg = F.avg ? F.avg * 0.7 + p * 0.3 : p;
    z.last = p; z.total += p;
    // kâr sahibine (kasaya ya da kendi hesabına), zarar sermayeden
    if (p > 0) { if (z.bank) this.bank += p * 0.9; else z.cash += p; this.stats.earned += p; this.stat('bizEarned', p); }
    else F.e += p;
    UI.feed(p >= 0 ? Tr`🏦 ${this.bizName(z)} dün ${fmtMoney(p)} kâr etti.` : Tr`🏦 ${this.bizName(z)} dün ${fmtMoney(-p)} zarar etti.`, p >= 0 ? '' : 'warn');
    if (spike) { F.tr = Math.max(0, F.tr - 0.04); UI.feed(Tr`🏦 ${this.bizName(z)}: büyük bir borçlu batınca kredisi geri dönmedi.`, 'warn'); }
    // soygun: kasadaki paranın bir kısmı gider (bekçi zorlaştırır)
    if (chance(BANK.rob * (F.g ? 0.3 : 1))) {
      const loss = Math.max(0, this.bankVault(F)) * rnd(0.2, 0.45);
      F.e -= loss; F.tr = Math.max(0, F.tr - 0.12);
      UI.toast(Tr('Bankan Soyuldu'), Tr`Silahlı adamlar ${this.bizName(z)} kasasından ${fmtMoney(loss)} alıp kaçtı.`);
      this.ecoLog('soygun', t);
    }
    // güven: sermaye ve kasadaki karşılık, sahibinin itibarı, bekçi ve faiz
    const vr = F.d > 1 ? this.bankVault(F) / F.d : 1, er = F.d > 1 ? F.e / F.d : 1;
    const tt = 0.25 + 0.3 * clamp(er / 0.08, -1, 1) + 0.25 * clamp(vr / 0.3, 0, 1) + clamp(this.honor / 200, -0.15, 0.15) + (F.g ? 0.04 : 0) + (F.rd - 1) * 0.04;
    F.tr = clamp(F.tr + (clamp(tt, 0, 1) - F.tr) * 0.12, 0, 1);
    // kasa çekilen mevduatı karşılayamadı (ödenemeyen kısım mevduatta kalır) ya da bir söylenti yayıldı: panik
    const v = this.bankVault(F);
    if (v < 0) { F.d -= v; this.bankRun(z, -v); }
    else if (F.d > 50 && chance(BANK.run + Math.max(0, 0.5 - F.tr) * 0.1)) this.bankRun(z, F.d * rnd(0.3, 0.6));
  },
  /* Panik: mevduat sahipleri W kadar parayı birden ister */
  bankRun(z, W) {
    const F = z.fin, t = this.bizTown(z.town), v = Math.max(0, this.bankVault(F));
    this.ecoLog('panik', t);
    if (v >= W) {
      F.d -= W; F.tr = Math.min(1, F.tr + 0.08);
      UI.toast(Tr('Bankada Panik'), Tr`Mevduat sahipleri ${this.bizName(z)} önünde kuyruk oldu; kasadan ${fmtMoney(W)} ödendi. Banka paniği atlattı.`);
      this.ecoLog('atlatti', t);
      return;
    }
    // kasadaki para yetmiyor: açık önce kendi hesabından kapatılır
    const need = W - v;
    if (this.bank >= need) {
      this.bank -= need; F.e += need; F.d -= W; F.tr = Math.min(1, F.tr + 0.03);
      UI.toast(Tr('Bankada Panik'), Tr`${this.bizName(z)} kasası yetmedi; açığı kapatmak için hesabından ${fmtMoney(need)} aktarıldı. Banka paniği atlattı.`);
      this.ecoLog('atlatti', t);
      return;
    }
    F.d -= v;
    F.run = { need, until: this.day + BANK.runDays };
    F.tr = Math.max(0, F.tr - 0.2);
    UI.toast(Tr('Bankanda Panik!'), Tr`${this.bizName(z)} ödemeleri durdurdu: mevduat sahipleri ${fmtMoney(need)} daha istiyor. ${BANK.runDays} gün içinde tezgâha gidip sermaye eklemezsen banka batar.`);
    Audio_.ui('error');
  },
  /* Sermaye ekle (panikte önce bekleyen ödemeler yapılır) */
  bankAdd(z, v) {
    const F = z.fin;
    if (!this.spend(v)) return false;
    F.e += v;
    if (F.run) {
      const pay = Math.min(F.run.need, v);
      F.d -= pay; F.run.need -= pay;
      if (F.run.need < 0.01) { F.run = null; F.tr = Math.min(1, F.tr + 0.05); UI.toast(Tr('Panik Atlatıldı'), Tr`Herkes parasını aldı; ${this.bizName(z)} yeniden açık.`, 'ok'); this.ecoLog('atlatti', this.bizTown(z.town)); }
      else UI.feed(Tr`🏦 Kuyruktakilere ${fmtMoney(pay)} ödendi; ${fmtMoney(F.run.need)} daha gerek.`, 'warn');
    } else UI.feed(Tr`🏦 Bankana ${fmtMoney(v)} sermaye eklendi.`);
    Audio_.ui('cash');
    return true;
  },
  /* Çekilebilir sermaye: kasada karşılık kalmalı */
  bankFree(z) { const F = z.fin; return F.run ? 0 : Math.max(0, Math.min(F.e, this.bankVault(F) - F.d * BANK.reserve * 2)); },
  bankTake(z, v) {
    v = Math.min(v, this.bankFree(z));
    if (v < 0.01) { UI.feed(Tr('Kasada çekilebilecek sermaye yok.'), 'warn'); return false; }
    z.fin.e -= v; this.player.money += v;
    UI.feed(`💵 +${fmtMoney(v)} — ${Tr('Sermaye')}`, 'money');
    Audio_.ui('cash');
    return true;
  },
  /* İflas: banka elden çıkar, birikimini kaybeden kasaba sahibini unutmaz */
  bankFail(z) {
    const t = this.bizTown(z.town), name = this.bizName(z);
    this.biz.splice(this.biz.indexOf(z), 1);
    this.secDirty();
    this.addHonor(-8);
    UI.toast(Tr('Bankan Battı'), Tr`${name} ödemelerini yapamadı ve kapılarını kapattı. Sermayen ve bankan elinden gitti.`);
    this.ecoLog('iflas', t);
    Audio_.ui('error');
  },

  /* ---------------- petrol ---------------- */
  /* Sahalar: dünya tohumundan, kasabalardan uzak düz ovada, birbirinden ve yerlerden (kamp, nirengi) uzak.
     { i, x, y (merkez karosu), town (en yakın kasaba), res (rezerv), cY (rakibin alacağı yıl), co (rakip şirket) } */
  oilFields() {
    if (this._oilF && this._oilF.seed === this.seed) return this._oilF;
    const W = this.world, R = new RNG(Math.floor(hash2(this.seed, 4242, 7) * 4294967296)), out = [];
    const cos = OIL_COS.map((n, k) => k);
    for (let k = cos.length - 1; k > 0; k--) { const j = R.int(0, k); [cos[k], cos[j]] = [cos[j], cos[k]]; }
    const okTile = (tx, ty) => {
      if (!W.inb(tx, ty)) return false;
      const i = ty * WW + tx, t = W.tile[i], o = W.obj[i];
      if (W.flags[i] & (2 | 4 | 8 | 16)) return false;
      if (t !== T.GRASS && t !== T.DRY && t !== T.DESERT) return false;
      return this.oilClear(o);
    };
    for (let n = 0; n < 6000 && out.length < OIL.fields; n++) {
      const tx = R.int(90, WW - 90), ty = R.int(90, WH - 90), px = tx * TS, py = ty * TS;
      let near = Infinity, nt = null;
      for (const t of W.towns) { const d = dist(px, py, t.cx, t.cy); if (d < near) { near = d; nt = t; } }
      if (near < 1500 || near > 7500) continue;
      if (out.some(f => dist(px, py, f.x * TS, f.y * TS) < 4500)) continue;
      if (W.pois.some(p => dist2(px, py, p.x, p.y) < 800 * 800)) continue;
      let ok = true;
      for (let yy = -4; yy <= 5 && ok; yy++) for (let xx = -6; xx <= 6 && ok; xx++) if (!okTile(tx + xx, ty + yy)) ok = false;
      if (!ok) continue;
      out.push({ i: out.length, x: tx, y: ty, town: nt.id, res: Math.round(R.range(OIL.res[0], OIL.res[1]) / 100) * 100, cY: R.int(OIL.claim[0], OIL.claim[1]), co: cos[out.length % cos.length] });
    }
    out.seed = this.seed;
    return (this._oilF = out);
  },
  /* Sahaya konan nesnenin üstüne yazılabileceği küçük süsler */
  oilClear(o) { return !o || o === O.TUFT || o === O.FLOWERS || o === O.DRYBUSH || o === O.BUSH || o === O.ROCK || o === O.SEEP || o === O.DERRICK || o === O.OILTANK; },
  oilInit() {
    return { f: this.oilFields().map(F => ({ own: null, w: [], rem: F.res, known: false, emp: false })), ref: null, mk: 1, prod: 0, rev: 0, total: 0 };
  },
  oilTown(i) { const F = this.oilFields()[i]; return F && this.bizTown(F.town); },
  /* Sahanın adı: en yakın kasaba, uzaklık ve yön (aynı kasabanın yakınında birden çok saha olabilir) */
  oilName(i) { const t = this.oilTown(i), p = this.oilPos(i); return Tr`${t.n} · ${fmtDist(dist(t.cx, t.cy, p.x, p.y))} ${dirWord(p.x - t.cx, p.y - t.cy)}`; },
  oilPos(i) { const F = this.oilFields()[i]; return { x: F.x * TS + 8, y: F.y * TS + 8 }; },
  /* Varilin fiyatı: gazyağı (elektrik yaygınlaştıkça geriler) + benzin (otomobiller yaygınlaştıkça artar) */
  oilPrice(y = this.year) {
    const elec = clamp((y - 1905) / 30, 0, 1);
    return 0.12 * (1 - 0.6 * elec) + 0.3 * this.motorShare(y) + 0.03;
  },
  /* Bugünkü satış fiyatı: piyasa dalgası, rafineri ve petroldeki hakimiyetin */
  oilSell() {
    const O_ = this.tycoon.oil, R = O_.ref;
    return this.oilPrice() * O_.mk * (R && R.done ? OIL.refMul : 1) * SECTOR_LV[this.sectors().petrol.lv].inc;
  },
  /* Arazinin fiyatı petrolün fiyatıyla artar */
  oilLandPrice() { return Math.round(OIL.land * this.oilPrice() / this.oilPrice(OIL.year) / 5) * 5; },
  /* Kuyunun günlük üretimi: rezerv azaldıkça düşer; fışkıran kuyu daha bereketli */
  oilWellOut(i, w) {
    const f = this.tycoon.oil.f[i], F = this.oilFields()[i];
    if (!OIL_OK(w) || f.rem <= 0) return 0;
    return OIL.out * (w.s === 'gush' ? 2.5 : 1) * (0.3 + 0.7 * f.rem / F.res);
  },
  oilCap(i) { const f = this.tycoon.oil.f[i]; let c = 0; for (const w of f.w) c += this.oilWellOut(i, w); return Math.min(c, f.rem); },
  oilOwnerName(f) { return f.own === 'p' ? Tr('Senin') : f.own === null ? Tr('Sahipsiz') : OIL_COS[f.own]; },
  /* Rakibin sahası için teklif: arazi ve kuyular, petroldeki hakimiyetinle ucuzlar; zor durumdaysa daha da */
  oilOfferPrice(i) {
    const f = this.tycoon.oil.f[i], n = f.w.filter(w => w && w.s !== 'dry').length;
    return Math.round((this.oilLandPrice() + n * OIL.well * 1.1) * SECTOR_LV[this.sectors().petrol.lv].offer * (this.tycoon.dist['o' + i] ? DISTRESS_MUL : 1) / 5) * 5;
  },
  oilFreeSpot(i) { const f = this.tycoon.oil.f[i]; for (let k = 0; k < OIL_WELLS.length; k++) if (!f.w[k]) return k; return -1; },

  /* ---- dünyaya uygula: sızıntılar her zaman, kuleler ve depo duruma göre ---- */
  oilApply(i) {
    const W = this.world, F = this.oilFields()[i], f = this.tycoon.oil.f[i];
    const set = (dx, dy, o) => { const x = F.x + dx, y = F.y + dy, k = y * WW + x; if (W.inb(x, y) && this.oilClear(W.obj[k])) { W.obj[k] = o; W.flags[k] |= 1; } };
    for (const [dx, dy] of OIL_SEEPS) set(dx, dy, O.SEEP);
    OIL_WELLS.forEach(([dx, dy], k) => { const w = f.w[k]; set(dx, dy, w && w.s !== 'dry' ? O.DERRICK : 0); });
    set(OIL_TANK[0], OIL_TANK[1], f.w.some(w => w && w.s !== 'dry' && w.s !== 'dig') ? O.OILTANK : 0);
    W.refreshArea(F.x - 7, F.y - 6, F.x + 7, F.y + 6);
  },
  oilApplyAll() {
    if (!this.world) return;
    this.oilFields().forEach((F, i) => this.oilApply(i));
    this.refApply();
  },

  /* ---- yıllık: petrol çağı, rakip şirketler ---- */
  oilYear(y) {
    const O_ = this.tycoon.oil, Fs = this.oilFields();
    if (y === OIL.year && Fs.length) { O_.f[0].known = true; this.ecoLog('petrol', this.oilTown(0)); }
    if (y < OIL.year) return;
    Fs.forEach((F, i) => {
      const f = O_.f[i];
      if (f.own === null && y >= F.cY) {
        f.own = F.co; f.cy = y; f.known = true;
        this.ecoLog('rakip', this.oilTown(i), { c: F.co });
      }
      if (typeof f.own !== 'number' || f.rem <= 0) return;
      // rakip birkaç yılda bir yeni kule diker
      const want = Math.min(OIL_WELLS.length, 1 + Math.floor((y - (f.cy || F.cY)) / OIL.rivalGap));
      let n = f.w.filter(Boolean).length, changed = false;
      for (let k = 0; k < OIL_WELLS.length && n < want; k++) if (!f.w[k]) { f.w[k] = { s: 'ok' }; n++; changed = true; }
      if (changed) { this.oilApply(i); this.secDirty(); }
    });
  },
  /* Petrolden önceki bir kayıt: rakipler bugüne kadar aldıkları sahalarla ve kuyularla gelir (haber olmadan) */
  oilCatchUp(y) {
    const O_ = this.tycoon.oil, Fs = this.oilFields();
    if (y >= OIL.year && Fs.length) O_.f[0].known = true;
    Fs.forEach((F, i) => {
      const f = O_.f[i];
      if (f.own !== null || y < F.cY) return;
      f.own = F.co; f.cy = F.cY; f.known = true;
      const n = Math.min(OIL_WELLS.length, 1 + Math.floor((y - F.cY) / OIL.rivalGap));
      for (let k = 0; k < n; k++) f.w[k] = { s: 'ok' };
      f.rem = Math.max(F.res * 0.3, F.res - (y - F.cY) * this.dpy * n * OIL.out * 0.6);
    });
    this.oilApplyAll();
    this.secDirty();
  },

  /* ---- günlük: sondajlar, üretim, satış ---- */
  oilDaily() {
    const O_ = this.tycoon.oil, Fs = this.oilFields();
    O_.mk = clamp(O_.mk * rnd(0.96, 1.04) + (1 - O_.mk) * 0.05, 0.6, 1.4);
    let mine = 0, changed = false;
    Fs.forEach((F, i) => {
      const f = O_.f[i];
      if (f.own === null) return;
      if (f.own === 'p') for (let k = 0; k < f.w.length; k++) {
        const w = f.w[k];
        if (!w || w.s !== 'dig' || this.day < w.t) continue;
        const r = Math.random();
        if (r < OIL.dry) { w.s = 'dry'; UI.toast(Tr('Kuru Kuyu'), Tr`${this.oilTown(i).n} yakınlarındaki sondajdan petrol çıkmadı. Kule söküldü.`); }
        else if (r < OIL.dry + OIL.gush) { w.s = 'gush'; UI.toast(Tr('Petrol Fışkırdı!'), Tr`${this.oilTown(i).n} yakınlarındaki kuyudan kara altın göğe fışkırıyor! Bu kuyu ötekilerden çok daha bereketli.`, 'ok'); this.ecoLog('fiskirdi', this.oilTown(i)); }
        else { w.s = 'ok'; UI.toast(Tr('Petrol Bulundu'), Tr`${this.oilTown(i).n} yakınlarındaki yeni kuyu üretime başladı.`, 'ok'); }
        changed = true; this.oilApply(i);
      }
      const out = this.oilCap(i);
      if (out <= 0) return;
      f.rem = Math.max(0, f.rem - out);
      if (f.own === 'p') mine += out;
      if (f.rem <= 0 && !f.emp) { f.emp = true; changed = true; this.ecoLog('tukendi', this.oilTown(i)); if (f.own === 'p') UI.toast(Tr('Saha Tükendi'), Tr`${this.oilTown(i).n} yakınlarındaki sahanda petrol bitti. Kuleler artık boş dönüyor.`); }
    });
    if (changed) this.secDirty();
    // rafineri inşaatı
    const R = O_.ref;
    if (R && !R.done && this.day >= R.ready) {
      R.done = true; this.refApply(); this.secDirty();
      const t = this.bizTown(R.town);
      UI.toast(Tr('Rafineri Açıldı'), Tr`${t.n} istasyonunun yanındaki rafinerin çalışıyor: petrolün artık ${OIL.refMul} katı fiyata satılıyor.`, 'ok');
      this.ecoLog('rafineri', t);
    }
    O_.prod = mine;
    if (!mine) { O_.rev = 0; return; }
    const v = mine * this.oilSell();
    O_.rev = v; O_.total += v;
    this.bank += v; this.stats.earned += v; this.stat('bizEarned', v);
    UI.feed(Tr`🛢 Petrol: dün ${Math.round(mine)} varil satıldı, ${fmtMoney(v)} hesabına yatırıldı.`);
  },

  /* ---- oyuncunun eylemleri ---- */
  oilWhy(i) {
    const f = this.tycoon.oil.f[i];
    if (this.year < OIL.year) return Tr('Kimse bu kara sızıntıyla ilgilenmiyor; şimdilik değeri yok.');
    if (this.law.level > 0) return Tr('Aranırken kimse sana tapu vermez.');
    if (f.own === 'p') return Tr('Bu saha zaten senin.');
    return '';
  },
  oilBuyLand(i) {
    const why = this.oilWhy(i), f = this.tycoon.oil.f[i];
    if (why) { UI.feed(why, 'warn'); return false; }
    const pr = f.own === null ? this.oilLandPrice() : this.oilOfferPrice(i), rival = f.own;
    if (!this.spend(pr)) return false;
    f.own = 'p'; f.known = true; f.since = this.day;
    delete this.tycoon.dist['o' + i];
    if (typeof rival === 'number') this.ecoLog('sahaal', this.oilTown(i), { c: rival });
    this.secDirty(); this.addHonor(0.5);
    Audio_.ui('cash');
    UI.toast(Tr('Petrol Sahası'), typeof rival === 'number' ? Tr`${OIL_COS[rival]} sahasını kuyularıyla birlikte sana devretti.` : Tr('Arazinin tapusu artık senin. Sızıntıların yanına sondaj kulesi kurabilirsin.'), 'ok');
    this.hintOnce('oil', Tr`Sahanın menüsünden ya da ilçe binasından <b>sondaj kulesi</b> kur: ${OIL.wellDays} günde biter; kuyu kuru çıkabilir ya da fışkırabilir. Petrol her gün satılır, para hesabına yatar. Varilin fiyatı otomobiller yaygınlaştıkça artar; istasyonlu bir kasabaya kuracağın <b>rafineri</b> petrolünü daha pahalıya sattırır.`, 14);
    this.ecoCheck();
    return true;
  },
  oilDrill(i) {
    const f = this.tycoon.oil.f[i], k = this.oilFreeSpot(i);
    if (f.own !== 'p') return false;
    if (k < 0) { UI.feed(Tr('Sahada kule kuracak yer kalmadı.'), 'warn'); return false; }
    if (f.rem <= 0) { UI.feed(Tr('Bu sahanın petrolü tükendi.'), 'warn'); return false; }
    if (!this.spend(OIL.well)) return false;
    f.w[k] = { s: 'dig', t: this.day + OIL.wellDays };
    this.oilApply(i);
    Audio_.ui('cash');
    UI.feed(Tr`🛢 Sondajcılar işe koyuldu; kuyu ${OIL.wellDays} gün içinde açılacak.`);
    return true;
  },
  /* Rafineri: istasyonlu kasabada, istasyonun yakınında boş bir yer */
  refWhy(t) {
    if (this.year < OIL.refYear) return Tr`Rafineri kurmak için daha erken (${OIL.refYear}).`;
    if (!t || !t.station) return Tr('Rafineri ancak demiryolu istasyonu olan bir kasabaya kurulur.');
    if (this.tycoon.oil.ref) return Tr('Zaten bir rafinerin var.');
    if (this.law.level > 0) return Tr('Aranırken kimse sana tapu vermez.');
    if (!this.refSpot(t)) return Tr('İstasyonun yakınında rafineriye yer yok.');
    return '';
  },
  refSpot(t) {
    const W = this.world, st = t.station, cx = st.door.x >> 4, cy = st.door.y >> 4;
    const free = (x, y) => {
      if (!W.inb(x, y)) return false;
      const i = y * WW + x, tt = W.tile[i];
      return !(W.flags[i] & (2 | 8 | 16)) && !TINFO[tt].solid && !isWaterT(tt) && tt !== T.ROAD && tt !== T.PLANK && this.oilClear(W.obj[i]);
    };
    for (const town of [false, true]) for (let r = 5; r < 26; r++) for (let k = 0; k < r * 6; k++) {
      const a = k / (r * 6) * TAU, x = Math.round(cx + Math.cos(a) * r), y = Math.round(cy + Math.sin(a) * r);
      if (!W.inb(x, y) || (!town && (W.flags[y * WW + x] & 4))) continue;
      let ok = true;
      for (let yy = -2; yy <= 2 && ok; yy++) for (let xx = -2; xx <= 2 && ok; xx++) if (!free(x + xx, y + yy)) ok = false;
      // baca ve kule yukarı uzanır: üstünde ray ya da bina kalmasın
      for (let yy = -6; yy <= -3 && ok; yy++) for (let xx = -3; xx <= 3 && ok; xx++) if (W.inb(x + xx, y + yy) && (W.flags[(y + yy) * WW + x + xx] & (2 | 8))) ok = false;
      if (ok) return [x, y];
    }
    return null;
  },
  refBuild(t) {
    const why = this.refWhy(t);
    if (why) { UI.feed(why, 'warn'); return false; }
    if (!this.spend(OIL.ref)) return false;
    const [x, y] = this.refSpot(t);
    this.tycoon.oil.ref = { town: t.id, x, y, ready: this.day + OIL.refDays, done: false };
    Audio_.ui('cash');
    UI.toast(Tr('Rafineri İnşaatı'), Tr`${t.n} istasyonunun yanındaki rafinerin ${OIL.refDays} günde bitecek.`, 'ok');
    return true;
  },
  /* Rafineri dünyada: bitince 3×3 yapı ve çakıllı avlu */
  refApply() {
    const R = this.tycoon && this.tycoon.oil.ref, W = this.world;
    if (!R || !R.done || !W) return;
    for (let yy = -2; yy <= 2; yy++) for (let xx = -2; xx <= 2; xx++) {
      const x = R.x + xx, y = R.y + yy, i = y * WW + x;
      if (!W.inb(x, y)) continue;
      W.tile[i] = T.GRAVEL; W.flags[i] |= 1;
      if (this.oilClear(W.obj[i])) W.obj[i] = 0;
    }
    W.obj[R.y * WW + R.x] = O.REFINERY;
    W.refreshArea(R.x - 3, R.y - 4, R.x + 3, R.y + 3);
  },

  /* ---- dünyada: keşif, duman ---- */
  oilTick(dt) {
    const O_ = this.tycoon && this.tycoon.oil;
    if (!O_) return;
    const P = this.player, Fs = this.oilFields(), C = this.cam;
    this._oilT = (this._oilT || 0) - dt;
    if (this._oilT <= 0) {
      this._oilT = 1;
      Fs.forEach((F, i) => {
        const f = O_.f[i];
        if (f.known || dist2(P.x, P.y, F.x * TS, F.y * TS) > 420 * 420) return;
        f.known = true;
        if (this.year >= OIL.year) {
          UI.toast(Tr('Petrol Sızıntısı'), Tr('Toprakta kara, yağlı sızıntılar var: burada petrol olabilir. Araziyi sızıntının başından ya da bir ilçe binasından satın alabilirsin.'), 'ok');
          this.secDirty();
        }
      });
    }
    // duman: rafinerinin bacası ve üretimdeki kulelerin buhar kazanları (görüş alanında)
    if (!C || typeof FX === 'undefined') return;
    const inView = (x, y) => x > C.ox - 60 && x < C.ox + this.vw + 60 && y > C.oy - 40 && y < C.oy + this.vh + 120;
    const R = O_.ref;
    if (R && R.done) { const x = R.x * TS + 8 - 17.5, y = R.y * TS + 8 - 61; if (inView(x, y) && Math.random() < dt * 5) FX.puff(x + rnd(-1, 1), y, rnd(-2, 2), rnd(-14, -10), 2, rnd(3.2, 4.2), rnd(4, 5.5), 0.42, '70,64,60'); }
    Fs.forEach((F, i) => {
      const f = O_.f[i];
      if (f.own === null || f.rem <= 0) return;
      OIL_WELLS.forEach(([dx, dy], k) => {
        if (!OIL_OK(f.w[k])) return;
        const x = (F.x + dx) * TS + 8 - 13, y = (F.y + dy) * TS + 8 - 12;
        if (inView(x, y) && Math.random() < dt * 1.5) FX.puff(x, y, rnd(-1.5, 1.5), rnd(-11, -8), 1, rnd(2, 2.8), rnd(2, 3), 0.3, '232,230,226');
      });
    });
  },
  /* Sızıntı, kule ya da depoyla etkileşim: hangi sahanın parçası */
  oilFieldAt(tx, ty) {
    const Fs = this.oilFields();
    for (const F of Fs) if (Math.abs(tx - F.x) <= 7 && Math.abs(ty - F.y) <= 6) return F.i;
    return -1;
  },
  oilActs(tx, ty, o) {
    const i = this.oilFieldAt(tx, ty);
    if (i < 0 || !this.tycoon) return null;
    const f = this.tycoon.oil.f[i];
    if (this.year < OIL.year) return { label: Tr('Kara Sızıntı'), acts: [{ n: Tr('İncele'), fn: () => UI.feed(Tr('Topraktan kara, kokulu bir sıvı sızıyor. Çiftçiler hayvanlarını bu lanetli sudan uzak tutar. Belki bir gün bir işe yarar.')) }] };
    if (!f.known) { f.known = true; this.secDirty(); }
    const label = o === O.SEEP ? Tr('Petrol Sızıntısı') : o === O.OILTANK ? Tr('Petrol Deposu') : Tr('Sondaj Kulesi');
    const acts = [{ n: Tr('Sahaya Bak'), fn: () => UI.openOilField(i) }];
    if (f.own === null) acts.push({ n: Tr`Araziyi Satın Al (${fmtMoney(this.oilLandPrice())})`, fn: () => UI.confirmOilLand(i) });
    else if (f.own === 'p' && this.oilFreeSpot(i) >= 0 && f.rem > 0) acts.push({ n: Tr`Sondaj Kulesi Kur (${fmtMoney(OIL.well)})`, fn: () => this.oilDrill(i) });
    return { label, acts };
  },
  refActs(x, y) {
    const R = this.tycoon && this.tycoon.oil.ref;
    if (!R || !R.done || dist2(x, y, R.x * TS + 8, R.y * TS + 8) > 46 * 46) return null;
    return { x: R.x * TS + 8, y: R.y * TS + 22, label: Tr('Rafinerin'), acts: [{ n: Tr('Rafineriye Bak'), fn: () => UI.openOilOverview() }] };
  },

  /* ---------------- haberler ---------------- */
  ecoLog(v, t, x) {
    const D = this.dev;
    if (!D || !t) return;
    const e = Object.assign({ y: this.year, t: t.id, k: 'eco', v }, x);
    D.log.push(e); D.fresh.push(e);
  },
  /* Ekonomi haberinin gazete metni (js/develop.js devStory) */
  ecoStory(e, t) {
    const N = ECO_NEWS[e.v];
    if (!N) return null;
    const lang = typeof I18N !== 'undefined' && I18N.lang === 'en' ? 'en' : 'tr';
    const up = s => s.toLocaleUpperCase(lang), low = s => s.toLocaleLowerCase(lang), cap = s => s.charAt(0).toLocaleUpperCase(lang) + s.slice(1);
    const x = e.x && SECTORS[e.x] ? SECTORS[e.x].n : '', b = e.b && BUILDINGS[e.b] ? BUILDINGS[e.b].n : '', p = this.player ? this.player.name : '';
    const c = e.c !== undefined ? OIL_COS[e.c] || '' : '';
    const f = s => s.replace(/\{p\}/g, p).replace(/\{X\}/g, up(x)).replace(/\{x\}/g, low(x)).replace(/\{K\}/g, up(t.n)).replace(/\{k\}/g, t.n)
      .replace(/\{B\}/g, up(b)).replace(/\{b\}/g, low(b)).replace(/\{m\}/g, e.m !== undefined ? fmtMoney(e.m) : '').replace(/\{c\}/g, c);
    return { h: up(f(N.h)), t: cap(f(N.t)), s: cap(f(N.s)), good: !!N.good, y: e.y, town: t, eco: true };
  },

  /* ---------------- kayıt ---------------- */
  tycoonInit() {
    this.tycoon = { lv: {}, cur: {}, dist: {}, fines: 0, oil: this.oilInit() };
    this._sec = null;
    this.oilApplyAll();
  },
  saveTycoon() { return this.tycoon; },
  loadTycoon(d) {
    this.tycoonInit();
    // tekelleşmeden önceki bir kayıt: bugünkü basamaklar duyurulmadan kabul edilir, rakip şirketler bugüne yetişir
    if (!d) {
      this.oilCatchUp(this.year);
      for (const k in SECTORS) this.tycoon.cur[k] = this.tycoon.lv[k] = this.sectors()[k].lv;
      return;
    }
    const oil = d.oil;
    Object.assign(this.tycoon, d);
    if (!oil) { this.tycoon.oil = this.oilInit(); this.oilCatchUp(this.year); }
    this.oilApplyAll();
  },
};
