'use strict';
/* Görünür kasaba gelişimi (js/devworld.js): kasaba görüş alanındayken değişiklik bekler; 1963'e kadar ileri sarınca
   yeni binalar çakışmaz, sokakta durmaz, kapıları sokağa ulaşır, sokaklar yerinde kalır; kayıt ve yüklemede dünya
   (karolar, nesneler, bayraklar, çarpışma, binalar, ışıklar) birebir aynı kurulur; oyuncunun işletmesi ve hikâyenin
   kasabası kapanmaz; tahta perdeli binaya girilmez, esnafı ve ışığı yoktur; nüfus basamağa göre değişir, eski sakinler
   aynı kalır; iki çizici de hatasız çizer; görünür gelişimden önceki kayıt bugünkü duruma getirilir. */
module.exports = {
  name: 'Görünür kasaba gelişimi', timeout: 900000,
  async run(t) {
    const p = await t.newGame();
    const errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    // dünyanın özeti: karo, nesne, bayrak, çarpışma ve bina dizileri; binalar (numara, tür, yer, anahtar, cephe, perde) ve
    // ışıklar (sırasız)
    await p.evaluate(() => {
      window.__H = () => {
        const W = G.world;
        let h = 0x811c9dc5;
        for (const A of [W.tile, W.obj, W.flags, W.solid]) for (let i = 0; i < A.length; i++) h = Math.imul(h ^ A[i], 16777619);
        for (let i = 0; i < W.bid.length; i++) h = Math.imul(h ^ (W.bid[i] + 1), 16777619);
        const B = W.buildings.map(b => [b.id, b.type, b.x, b.y, b.dkey || '', b.face === undefined ? 1 : b.face, b.shut ? 1 : 0].join(',')).join(';');
        const L = W.lights.map(l => [Math.round(l.x), Math.round(l.y), l.type, l.off ? 1 : 0, l.b === undefined ? '' : l.b, l.el ? 1 : 0, l.r].join(',')).sort().join(';');
        const Wr = Object.keys(W.wires || {}).sort().map(k => k + ':' + W.wires[k].map(s => s.join(',')).join('|')).join(';');
        return { h: h >>> 0, B, L, Wr, towns: W.towns.map(t => t.buildings.length + ':' + t.hitch.length) };
      };
      window.__far = () => { const s = TH.openSpot(300 * TS, 300 * TS) || [300 * TS, 300 * TS]; TH.goto(s[0], s[1]); };
      window.__res0 = G.residents(TH.town('harlow')).map(r => [r.id, r.name]);
      // başlangıçta kapısı sokağa ulaşan binalar (büyüme bunları kapatmamalı)
      window.__reach = (ids) => {
        const out = [];
        for (const t of G.world.towns) for (const b of t.buildings) {
          if (!b.enter || (ids && !ids.includes(b.id))) continue;
          if (TownPath.find(t, t.spawn.x, t.spawn.y, b.door.x, b.door.y + 10)) out.push(b.id);
        }
        return out;
      };
      window.__reach0 = __reach();
    });

    await t.step('kasaba görüş alanındayken yılın değişikliği bekler; uzaklaşınca ya da ekran kararınca uygulanır', async () => {
      const r = await p.evaluate(() => {
        const T = TH.town('harlow'), s0 = G.devStartTier(T), n0 = G.devBuilt(T);
        TH.goto(T.spawn.x, T.spawn.y);
        G.dev.pend.push([T.id, G.dev.y, { tier: s0 + 1, prog: 0.6, ghost: false, pk: s0 + 1.6 }]);
        G.devTick();
        const waited = G.devBuilt(T) === n0 && G.dev.pend.length === 1;
        __far(); G.devTick();
        const n1 = G.devBuilt(T), lv = G.devStreetLv(T), lamps = G.dev.lamps[T.id] || 0, pend = G.dev.pend.length;
        // ekran kararınca (uyku, bekleme, yolculuk) kasabada dururken de uygulanır
        TH.goto(T.spawn.x, T.spawn.y);
        G.dev.pend.push([T.id, G.dev.y, { tier: s0 + 1, prog: 0.8, ghost: false, pk: s0 + 1.8 }]);
        G.devTick();
        const waited2 = G.dev.pend.length === 1;
        UI.fade(() => {});
        return { waited, n0, n1, lv, lamps, pend, waited2 };
      });
      t.ok(r.waited, 'oyuncu kasabadayken değişiklik uygulanmamalı', r);
      t.ok(r.n1 > r.n0, 'uzaklaşınca yeni bina dikilmeli', r);
      t.eq(r.lv, 1, 'sokak çakıl olmalı'); t.ok(r.lamps > 0, 'yeni lambalar', r); t.eq(r.pend, 0, 'bekleyen yıl kalmamalı');
      t.ok(r.waited2, 'yeniden kasabadayken bekler', r);
      await t.sleep(1100);
      t.eq(await p.evaluate(() => G.dev.pend.length), 0, 'ekran kararınca uygulanmalı');
    });

    await t.step('1963\'e kadar: yeni binalar çakışmaz, sokakta durmaz, kapıları sokağa ulaşır; sokaklar yerinde', async () => {
      const r = await p.evaluate(() => {
        __far();
        const W = G.world, ms = [];
        for (let y = G.dev.y + 1; y <= DEV_END_YEAR; y++) { const t0 = performance.now(); G.devYear(y); G.devFlush(true); ms.push(performance.now() - t0); }
        const overlap = [], onStreet = [], streetLost = [];
        for (const b of W.buildings) for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) if (W.bid[y * WW + x] !== b.id) overlap.push(b.id);
        for (const t of W.towns) {
          const st = new Set(t._dv.st);
          for (const b of t.buildings) if (b.dkey) for (let y = b.y; y <= b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) if (st.has(y * WW + x)) onStreet.push(b.dkey);
          for (const i of t._dv.st) if ((W.flags[i] & 8) || !(W.tile[i] === T.ROAD || isStoneT(W.tile[i]))) streetLost.push(t.id);
        }
        const dev = W.buildings.filter(b => b.dkey).map(b => b.id), before = __reach(__reach0), devReach = __reach(dev);
        return {
          overlap: [...new Set(overlap)], onStreet: [...new Set(onStreet)], streetLost: [...new Set(streetLost)], dev: dev.length,
          lost: __reach0.filter(id => !before.includes(id)), devBad: dev.filter(id => !devReach.includes(id)),
          lv: W.towns.map(t => G.devStreetLv(t)), avg: ms.reduce((a, b) => a + b, 0) / ms.length, max: Math.max(...ms),
          types: [...new Set(W.buildings.filter(b => b.dkey).map(b => b.type))],
        };
      });
      t.eq(r.overlap, [], 'binalar üst üste binmemeli');
      t.eq(r.onStreet, [], 'yeni bina ve verandası sokakta olmamalı');
      t.eq(r.streetLost, [], 'sokak karoları sokak kalmalı');
      t.ok(r.dev >= 5, 'kasabalara yeni binalar gelmeli', r.dev);
      t.ok(r.types.includes('house') && r.types.length >= 2, 'evler ve dükkânlar', r.types);
      t.eq(r.lost, [], 'eskiden sokağa ulaşan kapılar ulaşmaya devam etmeli');
      t.eq(r.devBad, [], 'yeni binaların kapıları sokağa ulaşmalı');
      t.ok(r.lv.some(v => v >= 1), 'sokaklar yenilenmeli', r.lv);
      t.ok(r.avg < 150 && r.max < 600, 'yıllık güncelleme kısa sürmeli (ms)', { avg: r.avg, max: r.max });
    });

    await t.step('kayıt ve yükleme: dünya birebir aynı kurulur, bina numaraları değişmez', async () => {
      const before = await p.evaluate(() => { G.saveGame(); return __H(); });
      const r = await p.evaluate(async () => {
        const w = [], cw = console.warn; console.warn = (...a) => { w.push(a.join(' ')); cw(...a); };
        await G.loadGame(G.slot, 'manual');
        console.warn = cw;
        return { warns: w.filter(s => /gelişim/.test(s)), H: __H(), ops: G.dev.ops.length };
      });
      t.eq(r.warns, [], 'kayıttaki numaralarla dikilmeli');
      t.ok(r.ops > 0, 'günlükte görünür değişiklik kayıtları', r.ops);
      t.eq(r.H.B, before.B, 'binalar (numara, yer, anahtar, cephe, perde)');
      t.eq(r.H.towns, before.towns, 'kasabaların bina ve bağlama direği listeleri');
      t.eq(r.H.L, before.L, 'ışıklar');
      t.eq(r.H.Wr, before.Wr, 'elektrik telleri');
      t.eq(r.H.h, before.h, 'karo, nesne, bayrak, çarpışma ve bina dizileri');
    });

    await t.step('gerileme: hayalet kasabada her şey kapanır, lambalar söner; oyuncunun işletmesi, içinde durduğu bina ve hikâyenin kasabası kapanmaz', async () => {
      const r = await p.evaluate(() => {
        __far();
        const T = TH.town('longhorn'), T2 = TH.town('cedarfalls');
        const gs = T.buildings.find(b => b.type === 'general');
        if (gs.shut) G.devSetShut(gs, false);
        G.biz.push({ bid: gs.id, type: 'general', town: T.id, stock: 0, cash: 0, mgr: G.newManager(), since: G.day, bank: false, total: 0, last: 0 });
        const S0 = G.story, shut2 = T2.buildings.filter(b => b.shut).length; G.story = { on: true, done: false, town: T2.id };
        // oyuncunun içinde durduğu bina (beklerken, uyurken) kapanmaz; çıkınca sonraki yılda kapanır
        const hb = G.devClosable(T, true)[0];
        if (hb.shut) G.devSetShut(hb, false);
        TH.inside(hb);
        const inHb = G.world.buildingAtPx(G.player.x, G.player.y) === hb;
        // çekirdekte de hayalet kasaba (nüfus ondan okunur); görünür yılı hemen uygula
        for (const tw of [T, T2]) { Object.assign(G.dev.towns[tw.id], { tier: 0, prog: -0.5, ghost: true }); G.devTownYear(tw, G.dev.y, { tier: 0, prog: -0.5, ghost: true, pk: 3 }); }
        const hbOpen = !hb.shut;
        __far(); G.devTownYear(T, G.dev.y, { tier: 0, prog: -0.5, ghost: true, pk: 3 });
        G.story = S0;
        const cl = T.buildings.filter(b => b !== gs && DEV_SHUT[b.type] !== undefined && b.enter);
        const x0 = T.x * TS, y0 = T.y * TS, x1 = (T.x + T.w) * TS, y1 = (T.y + T.h) * TS;
        const lamps = G.world.lights.filter(L => L.type === 'lamp' && L.x >= x0 && L.x <= x1 && L.y >= y0 && L.y <= y1);
        window.__shutB = cl.find(b => b.type === 'saloon' || b.type === 'butcher' || b.type === 'smith') || cl[0];
        return { own: !!gs.shut, all: cl.every(b => b.shut), n: cl.length, story: T2.buildings.filter(b => b.shut).length - shut2, lamps: lamps.length, off: lamps.every(L => L.off), pop: G.residents(T).length, inHb, hbOpen, hbShut: !!hb.shut, hb: hb.type };
      });
      t.ok(!r.own, 'oyuncunun işletmesi açık kalmalı');
      t.ok(r.inHb && r.hbOpen && r.hbShut, 'oyuncunun içinde durduğu bina o yıl kapanmaz, çıkınca kapanır', r);
      t.ok(r.all && r.n > 3, 'öbür dükkânlar ve evler tahta perdeyle kapanmalı', r);
      t.eq(r.story, 0, 'etkin hikâyenin kasabasında yeni bina kapanmamalı');
      t.ok(r.lamps > 0 && r.off, 'hayalet kasabada lambalar sönük', r);
      t.eq(r.pop, 3, 'hayalet kasabada birkaç kişi kalır');
    });

    await t.step('tahta perdeli bina: girilmez, esnafı ve ışığı yok, satılmaz, mal vermez; kapısında "Tahta Perdeli"', async () => {
      const r = await p.evaluate(() => {
        const b = __shutB;
        TH.goto(b.door.x, b.door.y + 6);
        const acts = TH.actions();
        const wl = G.world.lights.filter(L => L.type === 'window' && L.b === b.id);
        return { type: b.type, open: G.isOpen(b), door: G.doorOpen(b), acts, sale: G.bizForSale(b), goods: G.goodsAt(b).length, keeper: !!G.keeperOf(b), lit: wl.some(L => Juice.windowLit(L)), wl: wl.length };
      });
      t.ok(!r.open && !r.door, 'kapalı ve kilitli', r);
      t.ok(r.acts.includes('Tahta Perdeli'), 'kapıdaki seçenek', r.acts);
      t.ok(!r.sale && r.goods === 0 && !r.keeper, 'satılmaz, mal yok, esnaf yok', r);
      t.ok(r.wl > 0 && !r.lit, 'pencereleri karanlık', r);
    });

    await t.step('kasaba canlanınca binalar yeniden açılır, lambalar yanar', async () => {
      const r = await p.evaluate(() => {
        __far();
        const T = TH.town('longhorn');
        Object.assign(G.dev.towns[T.id], { tier: 2, prog: 0.5, ghost: false });
        G.devTownYear(T, G.dev.y, { tier: 2, prog: 0.5, ghost: false, pk: 2.6 });
        const x0 = T.x * TS, y0 = T.y * TS, x1 = (T.x + T.w) * TS, y1 = (T.y + T.h) * TS;
        const lamps = G.world.lights.filter(L => L.type === 'lamp' && L.x >= x0 && L.x <= x1 && L.y >= y0 && L.y <= y1);
        return { shut: G.devShutN(T), all: T.buildings.filter(b => DEV_SHUT[b.type] !== undefined && b.enter).length, on: lamps.every(L => !L.off), news: G.dev.log.filter(e => e.k === 'reopen' && e.t === T.id).length };
      });
      t.ok(r.shut < r.all, 'bazı binalar yeniden açılmalı', r);
      t.ok(r.on, 'lambalar yanmalı');
      t.ok(r.news > 0, 'yeniden açılan dükkân gazetede', r);
    });

    await t.step('nüfus basamağa göre değişir; kasabanın eski sakinleri aynı kalır, yeni dükkâna esnaf gelir', async () => {
      const r = await p.evaluate(() => {
        const T = TH.town('harlow'), L = G.residents(T), byId = new Map(L.map(x => [x.id, x.name]));
        const same = __res0.filter(([id, n]) => byId.has(id)).every(([id, n]) => byId.get(id) === n);
        const kept = __res0.filter(([id]) => byId.has(id)).length;
        const dshops = T.buildings.filter(b => b.dkey && b.enter && b.staff && b.type !== 'sheriff' && !b.shut);
        return { n: L.length, pop: G.devPop(T), same, kept, keepers: dshops.every(b => !!G.keeperOf(b)), ds: dshops.length };
      });
      t.eq(r.n, r.pop, 'sakin sayısı');
      t.ok(r.same && r.kept >= 10, 'eski sakinlerin adı aynı', r);
      t.ok(r.keepers, 'yeni dükkânların esnafı', r);
    });

    await t.step('iki çizici büyümüş kasabayı gündüz ve gece hatasız çizer', async () => {
      await p.evaluate(() => {
        const T = [...G.world.towns].sort((a, b) => G.devBuilt(b) - G.devBuilt(a))[0], b = T.buildings.find(q => q.dkey);
        window.__hySoft = true; G.settings.gfx = 0; G.applySettings();
        TH.goto(b.door.x, b.door.y + 30); G.clock = Math.floor(G.clock / 1440) * 1440 + 12 * 60;
      });
      const f0 = await p.evaluate(() => HY.stat.frames); await t.sleep(1500);
      t.ok(await p.evaluate(() => HY.stat.frames) > f0, 'melez çiziyor');
      await p.evaluate(() => { G.clock = Math.floor(G.clock / 1440) * 1440 + 22 * 60; }); await t.sleep(1200);
      await p.evaluate(() => { G.settings.gfx = 1; G.applySettings(); }); await t.sleep(1200);
      await p.evaluate(() => { G.clock = Math.floor(G.clock / 1440) * 1440 + 12 * 60; }); await t.sleep(1200);
      t.eq(errs, [], 'sayfa hatası yok');
    });

    await t.step('görünür gelişimden önceki kayıt: kasabalar bugünkü durumlarına bir kerede getirilir', async () => {
      const r = await p.evaluate(async () => {
        G.saveGame();
        const key = slotKey(G.slot, 'manual'), d = JSON.parse(Platform.get(key));
        for (const k of ['ops', 'face', 'shut', 'st', 'pend', 'nk']) delete d.dev[k];
        Platform.set(key, JSON.stringify(d));
        await G.loadGame(G.slot, 'manual');
        const W = G.world, grown = W.towns.filter(t => !t.modern && G.dev.towns[t.id].tier > G.devStartTier(t));
        return { ops: G.dev.ops.length, built: grown.map(t => G.devBuilt(t)), lv: grown.map(t => G.devStreetLv(t)), n: grown.length };
      });
      t.ok(r.n === 0 || (r.ops > 0 && r.built.some(n => n > 0)), 'büyümüş kasabalara binalar gelmeli', r);
      t.ok(r.lv.every(v => v >= 1), 'büyümüş kasabaların sokakları yenilenmeli', r);
      t.eq(errs, [], 'sayfa hatası yok');
    });
  },
};
