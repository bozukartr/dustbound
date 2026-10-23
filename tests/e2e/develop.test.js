'use strict';
/* Yaşayan dünya: kasabaların gelişimi (js/develop.js) — basamaklar, yıl dönümü, kader, oyuncu etkisi,
   kayıt ve günlüğün yeniden uygulanması, gazete ve sohbet, Günlük'ün Kasabalar sekmesi, yıl atlama */
module.exports = {
  name: 'Kasabaların gelişimi', timeout: 600000,
  async run(t) {
    const p = await t.newGame();
    const state = () => p.evaluate(() => JSON.stringify({ y: G.dev.y, towns: G.dev.towns, log: G.dev.log }));

    await t.step('yeni hayatta kasabalar büyüklüklerine göre başlar (Saint Clement şehir), gelişim 1890', async () => {
      const r = await p.evaluate(() => ({ y: G.dev.y, log: G.dev.log.length, towns: G.world.towns.map(x => [x.id, x.sz, G.dev.towns[x.id].tier, x.tier]) }));
      t.eq(r.y, 1890, 'gelişim yılı'); t.eq(r.log, 0, 'günlük boş');
      for (const [id, sz, tier, mirror] of r.towns) { t.eq(tier, { s: 1, m: 2, l: 3 }[sz], id + ' başlangıç basamağı'); t.eq(mirror, tier, id + ' dünyadaki kasabaya yazılmalı'); }
    });

    await t.step('yıl dönümünde gelişim hesaplanır; birkaç gün birden geçerken kayıt yalnız son günde alınır', async () => {
      const r = await p.evaluate(() => {
        let saves = 0; const sv = G.saveGame; G.saveGame = function (...a) { saves++; return sv.apply(this, a); };
        G.advanceClock(G.dpy * 1440);
        G.saveGame = sv;
        return { year: G.year, dy: G.dev.y, saves, moved: G.world.towns.filter(x => G.dev.towns[x.id].g !== 0).length };
      });
      t.eq(r.year, 1891, 'oyun yılı'); t.eq(r.dy, 1891, 'gelişim yılı'); t.eq(r.saves, 1, 'altı günde tek kayıt');
      t.ok(r.moved >= 10, 'kasabaların yıllık gelişimi hesaplanmalı', r.moved);
    });

    await t.step('1963\'e kadar: aynı dünyada aynı sonuç, basamaklar türün sınırında, sonra gelişim durur', async () => {
      const r = await p.evaluate(() => {
        const run = () => { G.devInit(); G.devYear(1975, true); return JSON.stringify({ log: G.dev.log, towns: G.dev.towns }); };
        const a = run(), b = run(), D = G.dev, bad = [];
        for (const x of G.world.towns) { const S = D.towns[x.id], K = G.devKind(x); if (S.tier < K.min || S.tier > K.max || (S.ghost && !K.ghost)) bad.push(x.id); }
        return { same: a === b, bad, sc: D.towns.stclement.tier, last: Math.max(...D.log.map(e => e.y)), ups: D.log.filter(e => e.k === 'up').length, kinds: [...new Set(D.log.map(e => e.k))] };
      });
      t.ok(r.same, 'iki koşu aynı günlüğü ve durumu üretmeli');
      t.eq(r.bad, [], 'basamak türün sınırları içinde');
      t.eq(r.sc, 4, 'Saint Clement büyük şehir olmalı');
      t.ok(r.last <= 1963, '1963\'ten sonra gelişme olmamalı', r.last);
      t.ok(r.ups >= 3, 'birkaç kasaba büyümeli', r.ups);
    });

    await t.step('kayıt ve yükleme: günlük baştan uygulanınca aynı duruma gelinir', async () => {
      await p.evaluate(() => { G.devInit(); G.devYear(1940, true); G.saveGame(); });
      const before = await state();
      const warns = await p.evaluate(async () => {
        const w = [], cw = console.warn; console.warn = (...a) => { w.push(a.join(' ')); cw(...a); };
        await G.loadGame(G.slot, 'manual');
        console.warn = cw;
        return w.filter(s => /gelişim/.test(s));
      });
      t.eq(await state(), before, 'yüklenen gelişim durumu');
      t.eq(warns, [], 'günlük kayıttaki durumla uyuşmalı');
      t.ok(await p.evaluate(() => G.world.towns.every(x => x.tier === G.dev.towns[x.id].tier && x.ghost === G.dev.towns[x.id].ghost)), 'dünyadaki kasabalara yazılmalı');
    });

    await t.step('gelişim bilgisi olmayan bir kayıtta dünyanın geçmişi o yıla kadar yeniden hesaplanır', async () => {
      const r = await p.evaluate(async () => {
        G.devInit(); G.devYear(G.year, true);
        G.advanceClock(G.dpy * 1440 * 3); G.saveGame();
        const key = slotKey(G.slot, 'manual'), d = JSON.parse(Platform.get(key)); delete d.dev; Platform.set(key, JSON.stringify(d));
        await G.loadGame(G.slot, 'manual');
        return { y: G.year, dy: G.dev.y, fresh: G.dev.fresh.length };
      });
      t.eq(r.dy, r.y, 'gelişim oyunun yılına yetişmeli'); t.eq(r.fresh, 0, 'geçmiş yıllar duyurulmaz');
    });

    await t.step('oyuncunun yatırımı: büyüyeni hızlandırır, gerileyeni yavaşlatır; etkisi sınırlı', async () => {
      const r = await p.evaluate(() => {
        const T = TH.town('millbrook'), B = G.biz, out = [];
        const w0 = {}, g0 = G.devGrowth(T, 1900, w0);
        G.biz = [{ town: 'millbrook', bid: 0 }, { town: 'millbrook', bid: 1, lot: 3 }];
        const w1 = {}, g1 = G.devGrowth(T, 1900, w1);
        G.biz = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => ({ town: 'millbrook', bid: i, lot: i }));
        const w2 = {}, g2 = G.devGrowth(T, 1900, w2);
        G.biz = B;
        return { g0, p0: w0.player, g1, g2, p2: w2.player, raw: g0 - w0.player };
      });
      t.eq(r.p0, 0, 'yatırımsız oyuncu etkisi yok');
      t.ok(r.g1 > r.g0 && r.g2 > r.g1, 'yatırım arttıkça gelişim artmalı', r);
      const cap = r.raw > 0 ? 0.003 + 0.5 * r.raw : 0.063;
      t.ok(r.p2 <= cap + 1e-9, 'oyuncunun etkisi sınırlı (durgun köyü tek başına şehre çeviremez)', r);
    });

    await t.step('kasabada işlenen suç gelişimi yavaşlatır, temizlenen kamp ve teslim edilen kaçak hızlandırır', async () => {
      const r = await p.evaluate(() => {
        const T = TH.town('harlow'); G.dev.yr = {};
        const g0 = G.devGrowth(T, 1900, {});
        for (let k = 0; k < 3; k++) G.devNote(T.cx, T.cy, 'crime');
        const g1 = G.devGrowth(T, 1900, {});
        G.dev.yr = {}; G.devNote(T.cx + 3000, T.cy, 'camp', DEV_CAMP_R); G.devNote(T.cx, T.cy, 'bounty');
        const g2 = G.devGrowth(T, 1900, {});
        G.dev.yr = {};
        return { crime: g0 - g1, help: g2 - g0 };
      });
      t.near(r.crime, 0.018, 1e-9, 'üç suç'); t.near(r.help, 0.015, 1e-9, 'temizlenen kamp ve teslim edilen kaçak');
    });

    await t.step('kader olayları dünyadan dünyaya değişir', async () => {
      const r = await p.evaluate(() => {
        const S = G.seed, T = TH.town('silverridge'), out = [];
        for (const s of [11, 222, 3333, 44444, 555555, 6666666, 77777777, 888888888]) { G.seed = s; G._devF = null; const f = G.devFates(T).find(x => x.id === 'vein_out'); out.push(f ? f.y : 0); }
        G.seed = S; G._devF = null;
        return out;
      });
      t.ok(new Set(r).size >= 4, 'maden damarının tükenme yılı dünyaya göre değişmeli', r);
    });

    await t.step('gazete, gazeteci çocuk ve kasabalılar gelişmeleri anlatır; yeni gelişme duyurulur', async () => {
      const r = await p.evaluate(() => {
        G.devInit(); G.devYear(G.year, true);
        const T = TH.town('harlow'), feeds = [];
        const f = UI.feed; UI.feed = (s) => { feeds.push(String(s)); };
        G.devLog(G.year, T, 'up', 3); G.devAnnounce();
        UI.feed = f;
        const rnd = Math.random; Math.random = () => 0.5;
        const head = G.devHeadline(T), shout = G.devShout(), talk = G.devTalk(T) === TALKS.grow;
        G.curTown = 'harlow'; G.player.money += 1; UI.readNews();
        Math.random = rnd;
        const n = document.querySelector('.modal .news'), paper = n ? n.textContent : '';
        UI.closeAll();
        return { feeds, head, shout, talk, paper };
      });
      t.ok(r.feeds.some(s => /Harlow şehir oldu!/.test(s)), 'yeni gelişme bildirim satırında', r.feeds);
      t.eq(r.head && r.head[0], 'HARLOW ŞEHİR OLDU', 'gazete manşeti');
      t.ok(/^Ekstra! Ekstra! Harlow şehir oldu!$/.test(r.shout || ''), 'gazeteci çocuk', r.shout);
      t.ok(r.talk, 'büyüyen kasabanın sohbeti');
      t.ok(/HARLOW ŞEHİR OLDU/.test(r.paper), 'okunan gazete', r.paper);
    });

    await t.step('Günlük\'ün Kasabalar sekmesi kasabaların durumunu ve son gelişmeleri gösterir', async () => {
      const r = await p.evaluate(() => { UI.openJournal(7); const el = document.querySelector('.journal'), out = { tx: el.textContent, rows: el.querySelectorAll('.jr-towns tr').length, news: el.querySelectorAll('.jr-news li').length }; UI.closeAll(); return out; });
      t.eq(r.rows, 1 + 13, 'başlık ve 13 kasaba');
      t.ok(/Kasabalar/.test(r.tx) && /Saint Clement/.test(r.tx) && /dönemi/.test(r.tx), 'sekme içeriği', r.tx.slice(0, 200));
      t.ok(r.news >= 1 && /Harlow şehir oldu!/.test(r.tx), 'son gelişmeler', r.news);
    });

    await t.step('hata ayıklama: +1 yıl oyunu bir yıl ileri alır ve o yılın gelişimini işler', async () => {
      const r = await p.evaluate(() => { const y0 = G.year; Debug.act('y1'); return { y0, y1: G.year, dy: G.dev.y }; });
      t.eq(r.y1, r.y0 + 1, 'oyun yılı'); t.eq(r.dy, r.y1, 'gelişim yılı');
    });
  },
};
