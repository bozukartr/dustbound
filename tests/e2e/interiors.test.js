'use strict';
/* İç mekânlar: her binanın planı (INT_PLANS) uygulanır, kapı yolu açık kalır, tezgâhtarın ve oturanların yeri boştur;
   hizmet veren her eşyaya kapıdan yürünerek ulaşılır ve etkileşimi çalışır; Saint Clement'in binaları zengin plan,
   döşeme ve süslerle döşenir (sıradan kasabalar standart); şömine/ocak içerideyken ışık verir; iki çizici hatasız çizer. */
module.exports = {
  name: 'İç mekânlar',
  timeout: 300000,
  async run(t) {
    const p = await t.newGame();
    await p.evaluate(() => {
      UI.closeAll(); G.godMode = true;
      G.clock = Math.floor(G.clock / 1440) * 1440 + 12 * 60;
      window.IT = {
        /* iç mekânlar (otel kendi testinde); başka bir yapının üstüne kurulmuş bina (eski bir dünya üretimi sorunu:
           yer bulamayan çiftlik kasabanın ortasına düşebilir) dışarıda kalır */
        rooms: () => G.world.buildings.filter(b => b.enter && b.type !== 'hotel' && IT.whole(b)),
        whole(b) { for (let ly = 0; ly < b.h; ly++) for (let lx = 0; lx < b.w; lx++) if (G.world.bid[IT.idx(b, lx, ly)] !== b.id) return false; return true; },
        idx: (b, lx, ly) => (b.y + ly) * WW + b.x + lx,
        /* kapıdan başlayarak yürünebilen karolar (yerel "lx,ly"): ön sıra ve çarpışma maskesi taşıyan karolar yürünür */
        walk(b) {
          const W = G.world, seen = new Set(), q = [];
          const open = (lx, ly) => lx >= 0 && ly >= 1 && lx < b.w && ly < b.h && (W.solid[IT.idx(b, lx, ly)] === 0 || W.solid[IT.idx(b, lx, ly)] >= 16);
          for (let lx = 1; lx < b.w - 1; lx++) if (open(lx, b.h - 1)) { seen.add(lx + ',' + (b.h - 1)); q.push([lx, b.h - 1]); }
          while (q.length) {
            const [x, y] = q.shift();
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy, k = nx + ',' + ny; if (!seen.has(k) && open(nx, ny)) { seen.add(k); q.push([nx, ny]); } }
          }
          return seen;
        },
      };
    });

    await t.step('her binanın iç planı uygulanır: kapı yolu açık, tezgâhtar ve oturma yerleri boş', async () => {
      const r = await p.evaluate(() => {
        const bad = [], W = G.world;
        let n = 0, minItems = 99, sparse = null;
        for (const b of IT.rooms()) {
          n++;
          const pl = INT_PLANS[b.type];
          if (!pl) { bad.push(b.type + ': plan yok'); continue; }
          if (!b.lay) bad.push(b.name + ': plan seçilmedi');
          let items = 0;
          for (let ly = 1; ly < b.h; ly++) for (let lx = 0; lx < b.w; lx++) { const o = W.obj[IT.idx(b, lx, ly)]; if (o && o !== O.IBLOCK) items++; }
          if (items < minItems) { minItems = items; sparse = b.name + ' ' + b.type + ' ' + b.lay; }
          const D = b.w >> 1;
          for (let ly = b.h - 3; ly < b.h; ly++) if (W.solid[IT.idx(b, D, ly)] === 1) bad.push(b.name + ': kapı yolu kapalı ' + ly);
          const tileFree = (pt) => { const i = (pt.y >> 4) * WW + (pt.x >> 4); return W.solid[i] !== 1; };
          if (b.staff && !tileFree(b.staff)) bad.push(b.name + ': tezgâhtarın yeri dolu');
          for (const s of b.seats || []) if (!tileFree(s)) bad.push(b.name + ': sandalye dolu');
        }
        return { n, minItems, sparse, bad: bad.slice(0, 12) };
      });
      t.ok(r.n > 100, 'bina sayısı', r.n);
      t.eq(r.bad, [], 'plan hataları');
      t.ok(r.minItems >= 5, 'her iç mekânda en az beş eşya', [r.minItems, r.sparse]);
    });

    await t.step('binadaki her hizmete kapıdan yürünerek ulaşılır', async () => {
      const r = await p.evaluate(() => {
        // tezgâhın arkasındaki raf, kitaplık, saat gibi eşyalara ulaşmak gerekmez; aynı hizmet önden alınabilmeli
        const W = G.world, bad = [], FLAVOR = new Set([Tr('Kitaplara Göz At'), Tr('Saate Bak'), Tr('Elini Yüzünü Yıka'), Tr('Otur ve Bekle'), Tr('Isın'), Tr('Parmaklıklara Bak')]);
        let checked = 0;
        for (const b of IT.rooms()) {
          const seen = IT.walk(b), got = new Map();
          for (let ly = 1; ly < b.h - 1; ly++) for (let lx = 1; lx < b.w - 1; lx++) {
            let i = IT.idx(b, lx, ly), o = W.obj[i];
            if (!isFurnO(o)) continue;
            if (o === O.IBLOCK) { i = W.obj[i - WW] === O.BED ? i - WW : i - 1; o = W.obj[i]; }
            const fa = G.furnActions(b, o, i);
            if (!fa) continue;
            const ok = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => seen.has((lx + dx) + ',' + (ly + dy)));
            for (const a of fa.acts) if (!FLAVOR.has(a.n)) got.set(a.n, (got.get(a.n) || false) || ok);
          }
          for (const [act, ok] of got) { checked++; if (!ok) bad.push(b.name + ': ' + act); }
        }
        return { checked, bad: bad.slice(0, 12) };
      });
      t.ok(r.checked > 300, 'denetlenen hizmet', r.checked);
      t.eq(r.bad, [], 'ulaşılamayan hizmet');
    });

    await t.step('Saint Clement zengin döşenir; sıradan kasabalar standart', async () => {
      const r = await p.evaluate(() => {
        const W = G.world, RICH = [O.PALM, O.LAMPSTAND, O.FIREPLACE, O.BOOKCASE, O.ARMCHAIR, O.GCLOCK, O.BUST, O.CABINET, O.BILLIARD, O.ORGAN];
        const sc = IT.rooms().filter(b => b.town === 'stclement'), hw = IT.rooms().filter(b => b.town === 'harlow');
        const count = (bs) => { let n = 0; for (const b of bs) for (let ly = 1; ly < b.h; ly++) for (let lx = 0; lx < b.w; lx++) if (RICH.includes(W.obj[IT.idx(b, lx, ly)])) n++; return n; };
        const richPlan = sc.filter(b => INT_PLANS[b.type].rich), st = sc.map(b => IntDeco.style(b));
        const saloon = sc.find(b => b.type === 'saloon'), bank = sc.find(b => b.type === 'bank');
        return {
          sc: sc.length, richLay: richPlan.every(b => b.lay[0] === 'r'), stdLay: hw.every(b => b.lay[0] === 's'),
          richStyle: st.filter(s => s.rich).length, richN: richPlan.length, hwRich: hw.some(b => IntDeco.style(b).rich),
          floors: [...new Set(st.filter(s => s.rich).map(s => s.fl))].sort(), perSc: count(sc) / sc.length, perHw: count(hw) / hw.length,
          bankFloor: IntDeco.style(bank).fl, saloonFire: W.lights.some(L => L.type === 'hearth' && L.b === saloon.id),
        };
      });
      t.ok(r.sc >= 20, 'Saint Clement binaları', r.sc);
      t.ok(r.richLay && r.stdLay, 'zengin şehirde zengin plan, Harlow standart', r);
      t.eq(r.richStyle, r.richN, 'zengin planlı her bina zengin döşenir');
      t.ok(!r.hwRich, 'Harlow zengin döşenmez');
      t.ok(r.floors.includes('parquet') && r.floors.includes('marble') && r.floors.includes('hex'), 'parke, mermer, çini döşemeler', r.floors);
      t.eq(r.bankFloor, 'marble', 'banka mermer');
      t.ok(r.perSc > r.perHw * 2.5 && r.perSc >= 3, 'zengin eşyalar Saint Clement\'te yoğun', [r.perSc, r.perHw]);
      t.ok(r.saloonFire, 'saloonun şöminesi ışık verir');
    });

    await t.step('yeni eşyaların etkileşimleri: şömine, ayaklı saat, org, lavabo, vitrin', async () => {
      const r = await p.evaluate(() => {
        const W = G.world, P = G.player, out = {};
        /* eşyanın yanındaki, kapıdan ulaşılan bir karoya git ve etkileşimi oku (o eşyanın etkileşimi seçilen ilk karo) */
        const near = (b, o) => {
          const seen = IT.walk(b);
          let last = null;
          for (let ly = 1; ly < b.h - 1; ly++) for (let lx = 1; lx < b.w - 1; lx++) {
            const i = IT.idx(b, lx, ly);
            if (W.obj[i] !== o) continue;
            const want = G.furnActions(b, o, i).label;
            for (const [dx, dy] of [[0, 1], [1, 0], [-1, 0], [0, -1]]) if (seen.has((lx + dx) + ',' + (ly + dy))) {
              UI.closeAll(); G.insideB = b; TH.goto((b.x + lx + dx) * TS + 8, (b.y + ly + dy) * TS + 8);
              last = TH.actions();
              if (last[0] === want) return last;
            }
          }
          return last;
        };
        const sc = (type) => G.world.buildings.find(b => b.town === 'stclement' && b.type === type);
        out.fire = near(sc('saloon'), O.FIREPLACE);
        P.warmBuff = 0; out.warmed = TH.act(/Isın/) && P.warmBuff >= 90;
        out.clock = near(sc('bank'), O.GCLOCK); TH.feeds.length = 0; TH.act(/Saate Bak/); out.clockFeed = TH.feeds.join(' ');
        out.organ = near(sc('church'), O.ORGAN);
        out.wash = near(sc('doctor'), O.WASHSTAND); P.clean = 40; TH.act(/Yıka/); out.clean = P.clean;
        out.shop = near(G.world.buildings.find(b => b.town === 'harlow' && b.type === 'general'), O.DISPLAY);
        return out;
      });
      t.ok(r.fire && r.fire[0] === 'Şömine' && r.fire.includes('Isın'), 'şömine', r.fire);
      t.ok(r.warmed, 'şöminede ısınılır');
      t.ok(r.clock && r.clock.includes('Saate Bak') && /Saat \d\d:\d\d/.test(r.clockFeed), 'ayaklı saat', [r.clock, r.clockFeed]);
      t.ok(r.organ && r.organ.includes('Org Çal'), 'org', r.organ);
      t.ok(r.wash && r.wash.includes('Elini Yüzünü Yıka') && r.clean === 65, 'lavabo', [r.wash, r.clean]);
      t.ok(r.shop && r.shop.includes('Mallara Bak'), 'vitrin dükkânı açar', r.shop);
    });

    await t.step('bar taburesine oturan bara, masadaki masaya döner', async () => {
      const r = await p.evaluate(() => {
        const b = G.world.buildings.find(x => x.town === 'harlow' && x.type === 'saloon');
        const stools = b.seats.filter(s => s.ang === -Math.PI / 2), tables = b.seats.filter(s => s.ang !== -Math.PI / 2);
        const pair = tables.slice(0, 2);
        return { stools: stools.length, tables: tables.length, faces: pair.length === 2 && pair[0].x < pair[1].x && pair[0].ang === 0 && pair[1].ang === Math.PI };
      });
      t.ok(r.stools >= 3 && r.tables >= 6, 'tabure ve sandalyeler', r);
      t.ok(r.faces, 'sol sandalye sağa, sağdaki sola bakar');
    });

    await t.step('iki çizici zengin ve standart iç mekânları hatasız çizer', async () => {
      const r = await p.evaluate(async () => {
        const out = {};
        const frames = async (n) => { for (let k = 0; k < n; k++) await new Promise(res => requestAnimationFrame(res)); };
        for (const [town, type] of [['stclement', 'bank'], ['stclement', 'gambling'], ['harlow', 'saloon']]) {
          const b = G.world.buildings.find(x => x.town === town && x.type === type);
          UI.closeAll(); TH.clearNpcs(); TH.inside(b);
          for (const gfx of [0, 1]) {
            G.settings.gfx = gfx; G.applySettings();
            await frames(gfx ? 8 : 40);
            if (gfx === 0 && window.HY && G.hybridOn()) for (let k = 0; k < 120; k++) { const q = HY._queued(); if (!q.chunks && !q.covers) break; await frames(2); }
            await frames(4);
            // binanın ortasında ekrandaki renk çeşitliliği (döşeme ve halı deseni çizilmiş mi)
            const s = G.canvas.width / G.vw, cx = Math.round(((b.x + b.w / 2) * TS - G.cam.ox) * s), cy = Math.round(((b.y + b.h / 2) * TS - G.cam.oy) * s);
            const d = G.ctx.getImageData(cx - 40, cy - 30, 80, 60).data, cols = new Set();
            for (let i = 0; i < d.length; i += 4) cols.add((d[i] >> 3) * 1024 + (d[i + 1] >> 3) * 32 + (d[i + 2] >> 3));
            out[town + '.' + type + '.' + (gfx ? 'cl' : 'hy')] = cols.size;
          }
        }
        G.settings.gfx = 0; G.applySettings();
        return out;
      });
      for (const [k, n] of Object.entries(r)) t.ok(n > 40, 'desenli çizim ' + k, n);
    });
  },
};
