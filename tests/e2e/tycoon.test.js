'use strict';
/* Tekelleşme, kendi bankan ve petrol (js/tycoon.js): sektör payları ve hakimiyet basamakları, satmak istemeyen rakibe
   teklif, zor durumdaki rakip ve tekel cezası; arsaya banka kurmak, mevduat ve kâr, panik, sermaye ve iflas; petrol
   sahaları, sızıntılar, arazi, sondaj, üretim, rafineri, rakip şirketler; kayıttan yükleme ve menüler. */
module.exports = {
  name: 'Tekel, banka ve petrol',
  async run(t) {
    const p = await t.newGame();
    const errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    await p.evaluate(() => {
      G.player.money = 200000; G.honor = 40;
      // olasılıklı adımlar için: Math.random'u kısa süre sabitle
      window.WITH_RANDOM = (v, fn) => { const r = Math.random; Math.random = () => v; try { return fn(); } finally { Math.random = r; } };
    });

    await t.step('sektör payı işletme aldıkça artar; hakimiyet basamağı gelir ve toptan malı etkiler', async () => {
      const r = await p.evaluate(() => {
        const S0 = G.sectors().icki, bs = G.world.buildings.filter(b => SECTORS.icki.types.includes(b.type) && b.town);
        let lvs = [];
        const wh = G.world.buildings.find(b => b.type === 'warehouse'), drink0 = G.goodsAt(wh).find(x => x.g === 'drink').p;
        for (const b of bs) {
          const pr = G.bizForSale(b) ? G.bizPrice(b) : G.bizOfferPrice(b);
          G.buyBiz(b, pr);
          lvs.push(G.sectors().icki.lv);
        }
        const z0 = G.bizOf(bs[0]), B = BIZ[z0.type];
        const plain = B.inc * G.bizTownMul(G.bizTown(z0.town)) * MGR_TRAITS[z0.mgr.trait].inc * (B.goods && G.bizChain(B.goods) ? 1.2 : 1);
        return { n: S0.n, share0: S0.share, share: G.sectors().icki.share, lvs, mul: G.secIncMul('saloon'), est: G.bizDailyEst(z0) / plain,
          drink: G.goodsAt(wh).find(x => x.g === 'drink').p / drink0, flour: G.secGoodsMul('flour'), cur: G.tycoon.cur.icki, honor: G.honor };
      });
      t.ok(r.n >= 8, 'dünyada içki işletmeleri', r.n); t.eq(r.share0, 0, 'başta pay yok');
      t.near(r.share, 1, 0.001, 'hepsi alınınca pay %100');
      t.ok(r.lvs.includes(1) && r.lvs.includes(2) && r.lvs[r.lvs.length - 1] === 3, 'güçlü, hakim, tekel sırayla', r.lvs);
      t.eq(r.mul, 1.3, 'tekelde gelir çarpanı');
      t.near(r.est, 1.3, 0.001, 'tahmini gelir artar');
      t.near(r.drink, 0.85, 0.02, 'içki fıçısı ucuzlar'); t.eq(r.flour, 1, 'başka sektörün malı ucuzlamaz'); t.eq(r.cur, 3, 'duyurulan basamak');
    });

    await t.step('satmak istemeyen işletmeye teklif: piyasa fiyatının üstünde, hakimiyetle ucuzlar', async () => {
      const r = await p.evaluate(() => {
        const b = G.world.buildings.find(x => SECTORS.gida.types.includes(x.type) && x.town && G.bizOfferable(x));
        const pr = G.bizPrice(b), off = G.bizOfferPrice(b), lv = G.secLv(b.type);
        const m0 = G.player.money; G.buyBiz(b, off);
        return { pr, off, lv, paid: m0 - G.player.money, own: !!G.bizOf(b), offerable: G.bizOfferable(b) };
      });
      t.ok(r.off > r.pr * 1.4, 'teklif piyasa fiyatının üstünde', r);
      t.near(r.paid, r.off, 0.01, 'teklif bedeli ödenir'); t.ok(r.own && !r.offerable, 'işletme senin');
    });

    await t.step('hakim olunan pazarda rakip zor duruma düşer, ucuza satılır', async () => {
      const r = await p.evaluate(() => {
        // gıdada hakim ol
        for (const b of G.world.buildings.filter(x => SECTORS.gida.types.includes(x.type) && x.town)) { if (G.sectors().gida.share >= 0.6) break; if (!G.bizOf(b)) G.buyBiz(b, G.bizForSale(b) ? G.bizPrice(b) : G.bizOfferPrice(b)); }
        const lv = G.sectors().gida.lv;
        WITH_RANDOM(0, () => G.ecoYear(G.year));
        const d = G.world.buildings.find(b => SECTORS.gida.types.includes(b.type) && G.bizDistress(b));
        const full = d && Math.round(BIZ[d.type].p * G.bizTownMul(G.bizTown(d.town)) / 5) * 5;
        const news = G.dev.log.filter(e => e.k === 'eco').map(e => e.v);
        return { lv, distressed: !!d, forSale: d && G.bizForSale(d), price: d && G.bizPrice(d), full, news };
      });
      t.ok(r.lv >= 2, 'gıdada hakim', r.lv);
      t.ok(r.distressed && r.forSale, 'zor durumdaki rakip satılık');
      t.ok(r.price < r.full * 0.8, 'ucuza satılır', r);
      t.ok(r.news.includes('zor') && r.news.includes('tekel') && r.news.includes('hakim'), 'gazete haberleri', r.news);
    });

    await t.step('petrol sahaları: dünyada sızıntılar; 1900\'den önce değersiz', async () => {
      const r = await p.evaluate(() => {
        const Fs = G.oilFields(), W = G.world;
        const seeps = Fs.every(F => OIL_SEEPS.every(([dx, dy]) => W.obj[(F.y + dy) * WW + F.x + dx] === O.SEEP));
        const far = Fs.every(F => W.towns.every(tw => dist(F.x * TS, F.y * TS, tw.cx, tw.cy) >= 1500));
        const a = G.oilActs(Fs[0].x + OIL_SEEPS[0][0], Fs[0].y + OIL_SEEPS[0][1], O.SEEP);
        return { n: Fs.length, seeps, far, year: G.year, label: a.label, acts: a.acts.map(x => x.n), why: G.oilWhy(0) };
      });
      t.eq(r.n, 6, 'altı saha'); t.ok(r.seeps, 'sızıntılar dünyada'); t.ok(r.far, 'kasabalardan uzak');
      t.ok(r.year < 1900, 'yıl 1900 öncesi', r.year); t.eq(r.label, 'Kara Sızıntı', 'değersiz sızıntı'); t.ok(!!r.why, 'arazi satılmaz');
    });

    await t.step('banka: gelişmiş kasabanın büyük arsasına kurulur, mevduat toplar, kâr eder', async () => {
      const r = await p.evaluate(() => {
        const H = TH.town('harlow'), lot = H.lots.find(l => l.w >= 10 && l.h >= 8), small = TH.town('dustcreek').lots[0];
        G.buyLot(lot);
        const fits = G.lotTypes(lot).includes('bank'), smallFits = G.lotTypes(small).includes('bank');
        const h0 = G.honor; G.honor = 0; const lowHonor = G.bizBuildWhy('bank', lot); G.honor = h0;
        G.startBuild(lot, 'bank', 'std');
        G.advanceClock(1440 * (BUILD_DAYS + 1));
        const z = G.lotBiz(lot); window.BZ = z;
        const d0 = z.fin.d;
        G.advanceClock(1440 * 20);
        return { fits, smallFits, lowHonor: !!lowHonor, built: !z.site, fin: !!z.fin, d0, d: z.fin.d, l: z.fin.l, prof: z.fin.avg, cash: z.cash, forSale: G.bizForSale(G.world.buildings.find(b => b.type === 'bank' && !G.bizOf(b))), news: G.dev.log.filter(e => e.k === 'eco').map(e => e.v) };
      });
      t.ok(r.fits && !r.smallFits, 'banka yalnızca büyük arsaya sığar');
      t.ok(r.lowHonor, 'itibarsız kişi banka kuramaz');
      t.ok(r.built && r.fin, 'banka açıldı');
      t.ok(r.d > r.d0 + 1000, 'mevduat birikir', r); t.ok(r.l > r.d * 0.3 && r.l < r.d, 'kredi verilir', r);
      t.ok(r.prof > 0 && r.cash > 0, 'kâr kasada birikir', r);
      t.ok(!r.forSale, 'kasabaların bankası satılık çıkmaz');
      t.ok(r.news.includes('banka'), 'gazete: yeni banka');
    });

    await t.step('banka paniği: kasa yetmezse sermaye eklenerek durdurulur; eklenmezse banka batar', async () => {
      const r = await p.evaluate(() => {
        const z = BZ, F = z.fin;
        G.bank = 0;
        F.l = F.d * 0.95; F.e = 20;
        G.bankRun(z, F.d * 0.5);
        const run = !!F.run, need = F.run ? F.run.need : 0;
        G.bankAdd(z, need);
        const ok = !F.run && G.bankVault(F) >= -0.01;
        F.l = F.d * 0.95; F.e = 20;
        G.bankRun(z, F.d * 0.5);
        const run2 = !!F.run, h0 = G.honor;
        G.advanceClock(1440 * (BANK.runDays + 1));
        return { run, need, ok, run2, failed: !G.biz.includes(z), honor: G.honor - h0, news: G.dev.log.filter(e => e.k === 'eco').map(e => e.v) };
      });
      t.ok(r.run && r.need > 0, 'ödemeler durur', r);
      t.ok(r.ok, 'sermaye eklenince panik atlatılır');
      t.ok(r.run2 && r.failed, 'süre dolunca banka batar');
      t.ok(r.honor <= -7, 'iflas itibarı zedeler', r.honor);
      t.ok(r.news.includes('panik') && r.news.includes('atlatti') && r.news.includes('iflas'), 'gazete haberleri', r.news);
    });

    await t.step('kasabanın bankası teklifle alınır, devralınan mevduatla çalışır', async () => {
      const r = await p.evaluate(() => {
        const b = G.world.buildings.find(x => x.type === 'bank' && x.town && !G.bizOf(x));
        const h0 = G.honor; G.honor = 0; const why = G.bizOfferWhy(b); G.honor = h0;
        G.buyBiz(b, G.bizOfferPrice(b));
        const z = G.bizOf(b);
        UI.openBuilding(b); const labels = TH.menuLabels(); UI.closeAll();
        UI.openBankMgmt(z); const mg = TH.menuLabels(); TH.clickItem(/^Cesur/); const rl = z.fin.rl; TH.clickItem(/Bekçi/); const g = z.fin.g; UI.closeAll();
        return { why: !!why, own: !!z, d: z && z.fin.d, labels, mg, rl, g };
      });
      t.ok(r.why, 'itibarsıza satılmaz'); t.ok(r.own && r.d > 1000, 'müşterileriyle devralındı', r.d);
      t.ok(r.labels.some(l => /Bankayı Yönet/.test(l)) && r.labels.some(l => /Kârı Al/.test(l)), 'banka paneli', r.labels);
      t.ok(r.mg.some(l => /Temkinli/.test(l)) && r.mg.some(l => /Sermaye Ekle/.test(l)), 'yönetim menüsü', r.mg);
      t.eq(r.rl, 2, 'kredi politikası seçilir'); t.ok(r.g, 'bekçi tutulur');
    });

    await t.step('1900: arazi alınır, sondaj kulesi kurulur, petrol satılır', async () => {
      const r = await p.evaluate(() => {
        G.advanceClock(Math.max(0, (OIL.year - G.year)) * G.dpy * 1440);
        const O_ = G.tycoon.oil, i = 2, F = G.oilFields()[i];
        const news = G.dev.log.filter(e => e.k === 'eco' && e.v === 'petrol').length;
        const pr = G.oilLandPrice(), m0 = G.player.money;
        const bought = G.oilBuyLand(i);
        const paid = m0 - G.player.money;
        for (let k = 0; k < 3; k++) G.oilDrill(i);
        const objs = OIL_WELLS.slice(0, 3).every(([dx, dy]) => G.world.obj[(F.y + dy) * WW + F.x + dx] === O.DERRICK);
        const solid = G.world.solid[(F.y + OIL_WELLS[0][1]) * WW + F.x + OIL_WELLS[0][0]] > 0;
        // sondaj biter: biri kuru, biri fışkıran, biri olağan (piyasa dalgası önce bir sayı alır)
        G.advanceClock(1440 * (OIL.wellDays - 1));
        const od = G.oilDaily, seq = [0.5, 0.05, 0.25, 0.9];
        G.oilDaily = function () { const R = Math.random; let j = 0; Math.random = () => (j < seq.length ? seq[j++] : R()); try { return od.call(this); } finally { Math.random = R; } };
        G.advanceClock(1440);
        G.oilDaily = od;
        const st = O_.f[i].w.map(w => w.s);
        const dryObj = G.world.obj[(F.y + OIL_WELLS[0][1]) * WW + F.x + OIL_WELLS[0][0]];
        const tank = G.world.obj[(F.y + OIL_TANK[1]) * WW + F.x + OIL_TANK[0]];
        const b0 = G.bank; G.advanceClock(1440);
        return { news, pr, bought, paid, objs, solid, st, dryObj, tank, gain: G.bank - b0, prod: O_.prod, cap: G.oilCap(i), sell: G.oilSell() };
      });
      t.ok(r.news >= 1, 'gazete: kara altın'); t.ok(r.bought, 'arazi alındı'); t.near(r.paid, r.pr, 0.01, 'arazi bedeli');
      t.ok(r.objs && r.solid, 'kuleler dünyada ve katı');
      t.eq(r.st.join(','), 'dry,gush,ok', 'kuru, fışkıran ve olağan kuyu');
      t.eq(r.dryObj, 0, 'kuru kuyunun kulesi söküldü'); t.eq(r.tank, 36, 'depo kuruldu');
      t.ok(r.prod > 100 && r.gain > 0, 'petrol satıldı, para hesaba yattı', r);
      t.near(r.gain, r.prod * r.sell, Math.max(1, r.gain * 0.2), 'gelir üretim × fiyat');
    });

    await t.step('rafineri istasyonlu kasabaya kurulur, petrolü pahalıya sattırır', async () => {
      const r = await p.evaluate(() => {
        G.advanceClock(Math.max(0, (OIL.refYear - G.year)) * G.dpy * 1440);
        const noSt = G.world.towns.find(tw => !tw.station), st = TH.town('harlow');
        const why = G.refWhy(noSt);
        const ok = G.refBuild(st);
        G.advanceClock(1440 * (OIL.refDays + 1));
        const R = G.tycoon.oil.ref;
        const base = G.oilPrice() * G.tycoon.oil.mk * SECTOR_LV[G.sectors().petrol.lv].inc;
        return { why: !!why, ok, done: R.done, obj: G.world.obj[R.y * WW + R.x], solid: G.world.solid[(R.y + 1) * WW + R.x + 1] > 0, ratio: G.oilSell() / base, refMul: OIL.refMul, rail: (() => { for (let y = R.y - 6; y <= R.y + 2; y++) for (let x = R.x - 3; x <= R.x + 3; x++) if (G.world.flags[y * WW + x] & 2) return true; return false; })() };
      });
      t.ok(r.why, 'istasyonsuz kasabaya kurulmaz'); t.ok(r.ok && r.done, 'rafineri bitti');
      t.eq(r.obj, 37, 'rafineri dünyada'); t.ok(r.solid, '3×3 katı'); t.ok(!r.rail, 'ray üstüne taşmaz');
      t.near(r.ratio, r.refMul, 0.001, 'rafine petrol pahalı');
    });

    await t.step('ticaret odası tekele ceza keser', async () => {
      const r = await p.evaluate(() => {
        G.advanceClock(Math.max(0, (TEKEL_YEAR - G.year)) * G.dpy * 1440);
        const b0 = G.bank + G.player.money, f0 = G.tycoon.fines, lv = G.sectors().icki.lv;
        WITH_RANDOM(0, () => G.ecoFine());
        return { year: G.year, lv, fine: G.tycoon.fines - f0, paid: b0 - (G.bank + G.player.money), news: G.dev.log.filter(e => e.k === 'eco' && e.v === 'ceza').length };
      });
      t.ok(r.year >= 1905, 'yıl', r.year); t.eq(r.lv, 3, 'içkide tekel');
      t.ok(r.fine > 0, 'ceza kesilir', r.fine); t.near(r.paid, r.fine, 0.01, 'ceza ödenir'); t.ok(r.news >= 1, 'gazete');
    });

    await t.step('rakip şirketler sahipsiz sahaları alır; sahaları teklifle satın alınır', async () => {
      const r = await p.evaluate(() => {
        G.advanceClock(Math.max(0, 1927 - G.year) * G.dpy * 1440);
        const O_ = G.tycoon.oil, own = O_.f.map(f => f.own);
        const ri = O_.f.findIndex(f => typeof f.own === 'number');
        const wells = O_.f[ri].w.filter(Boolean).length, co = O_.f[ri].own;
        const S0 = G.sectors().petrol, pr = G.oilOfferPrice(ri);
        G.oilBuyLand(ri);
        return { own, wells, co, pr, land: G.oilLandPrice(), mine: O_.f[ri].own, share0: S0.share, share: G.sectors().petrol.share, news: G.dev.log.filter(e => e.k === 'eco').map(e => e.v) };
      });
      t.ok(r.own.filter(o => typeof o === 'number').length >= 4, 'rakipler sahaları aldı', r.own);
      t.ok(r.wells >= 2, 'rakip kuleler dikti', r.wells);
      t.ok(r.pr > r.land, 'teklif bedeli', r); t.eq(r.mine, 'p', 'saha artık senin');
      t.ok(r.share > r.share0, 'petrol payı arttı', r);
      t.ok(r.news.includes('rakip') && r.news.includes('sahaal'), 'gazete haberleri', r.news);
    });

    await t.step('kayıttan yüklenince bankalar, petrol ve dünyadaki kuleler korunur', async () => {
      const r = await p.evaluate(async () => {
        const O_ = G.tycoon.oil, before = JSON.stringify({ own: O_.f.map(f => f.own), w: O_.f.map(f => f.w.map(w => w && w.s)), ref: O_.ref, banks: G.biz.filter(z => z.fin).map(z => z.bid), dist: G.tycoon.dist, lv: G.tycoon.lv });
        const i = O_.f.findIndex(f => f.own === 'p'), F = G.oilFields()[i], k = O_.f[i].w.findIndex(w => w && w.s !== 'dry');
        G.saveGame(true); await G.loadGame(G.slot, 'auto');
        const O2 = G.tycoon.oil, R = O2.ref;
        const after = JSON.stringify({ own: O2.f.map(f => f.own), w: O2.f.map(f => f.w.map(w => w && w.s)), ref: O2.ref, banks: G.biz.filter(z => z.fin).map(z => z.bid), dist: G.tycoon.dist, lv: G.tycoon.lv });
        return { same: before === after, derrick: G.world.obj[(F.y + OIL_WELLS[k][1]) * WW + F.x + OIL_WELLS[k][0]], ref: G.world.obj[R.y * WW + R.x], fin: G.biz.filter(z => z.fin).every(z => z.fin.d > 0) };
      });
      t.ok(r.same, 'durum aynı'); t.eq(r.derrick, 35, 'kule yerinde'); t.eq(r.ref, 37, 'rafineri yerinde'); t.ok(r.fin, 'banka hesapları');
    });

    await t.step('menüler: satılık listesi (rakipler, petrol), petrol sahası, günlük, harita', async () => {
      const r = await p.evaluate(() => {
        const out = {};
        G.visited = new Set(G.world.towns.map(tw => tw.id));
        const cb = TH.town('harlow').buildings.find(b => b.type === 'county' || b.type === 'land');
        UI.openBizMarket(cb);
        for (const k of [2, 3]) { document.querySelector(`.p-tabs .tab[data-tab="${k}"]`).click(); out['tab' + k] = TH.menuLabels(); }
        UI.closeAll();
        const i = G.tycoon.oil.f.findIndex(f => f.own === 'p');
        UI.openOilField(i); out.field = TH.menuLabels(); UI.closeAll();
        UI.openJournal(5); out.jr = document.querySelector('.scroll.jr').textContent; UI.closeAll();
        UI.openMap(); out.map = !!document.querySelector('#mapscreen:not(.hidden)'); UI.closeMap ? UI.closeMap() : UI.closeAll();
        return out;
      });
      t.ok(r.tab2.length > 3, 'rakipler sekmesi', r.tab2.length);
      t.ok(r.tab3.some(l => /Rafinerin/.test(l)) && r.tab3.some(l => /·/.test(l)), 'petrol sekmesi', r.tab3);
      t.ok(r.field.some(l => /Sondaj Kulesi Kur/.test(l)), 'saha menüsü', r.field);
      t.ok(/Pazar Payların/.test(r.jr) && /Bankaların|Petrol/.test(r.jr), 'günlük bölümleri');
      t.ok(r.map, 'harita açılır');
      t.eq(errs.length, 0, 'sayfa hatası yok', errs);
    });
  },
};
