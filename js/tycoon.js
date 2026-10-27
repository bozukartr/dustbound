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
   ========================================================== */

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
    for (const k in S) { const s = S[k]; s.share = s.tot ? s.mine / s.tot : 0; s.lv = s.own ? this.secLvOf(s.share) : 0; }
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
      const m = Math.round(S[k].mine * TEKEL_FINE);
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
    if (d % this.dpy === 0) this.ecoYear(START_YEAR + d / this.dpy);
    this.bankDaily();
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
    const f = s => s.replace(/\{p\}/g, p).replace(/\{X\}/g, up(x)).replace(/\{x\}/g, low(x)).replace(/\{K\}/g, up(t.n)).replace(/\{k\}/g, t.n)
      .replace(/\{B\}/g, up(b)).replace(/\{b\}/g, low(b)).replace(/\{m\}/g, e.m !== undefined ? fmtMoney(e.m) : '');
    return { h: up(f(N.h)), t: cap(f(N.t)), s: cap(f(N.s)), good: !!N.good, y: e.y, town: t, eco: true };
  },

  /* ---------------- kayıt ---------------- */
  tycoonInit() {
    this.tycoon = { lv: {}, cur: {}, dist: {}, fines: 0 };
    this._sec = null;
  },
  saveTycoon() { return this.tycoon; },
  loadTycoon(d) {
    this.tycoonInit();
    // tekelleşmeden önceki bir kayıt: bugünkü basamaklar duyurulmadan kabul edilir
    if (!d) { for (const k in SECTORS) this.tycoon.cur[k] = this.tycoon.lv[k] = this.sectors()[k].lv; return; }
    Object.assign(this.tycoon, d);
  },
};
