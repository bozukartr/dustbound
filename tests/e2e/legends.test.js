'use strict';
/* Efsaneler ve posttan zanaat (js/legends.js): veri tutarlı; inler ve sular dünyada nadir, doğru arazide; söylenti
   arama çemberi açar, izler daraltır, üçüncü izde in bulunur; efsane yalnızca koşulu tutunca ininde belirir (sürüsüyle),
   huyu işler (vurup çekilme, kudurma, saldırma, kaçınca o gün dönmeme); avlanınca bir daha gelmez, yüzülünce eşsiz post
   ve ganimet verir; kayıt; terzi postundan giysi diker (ücret, süre, teslim), heybe ve eyer büyür; efsanevi balık
   yalnızca kendi suyunda ve vaktinde vurur, sert çeker ve oltayla gerçekten tutulur. */
module.exports = {
  name: 'Efsaneler',
  timeout: 300000,
  async run(t) {
    const p = await t.newGame();
    const errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    await p.evaluate(() => {
      G.godMode = true;
      window.WITH_RANDOM = (v, fn) => { const r = Math.random; Math.random = () => v; try { return fn(); } finally { Math.random = r; } };
      window.AT_HOUR = (h) => { G.clock = Math.floor(G.clock / 1440) * 1440 + h * 60; G.weather.type = 'clear'; };
      window.LIVE = (id) => G.ents.find(e => e.legend === id && !e.dead && !e.remove);
      // inin yakınında açık bir yer (in en az 200 px ötede, 650 px'ten yakın)
      window.NEAR = (id) => { const sp = G.legendSpots()[id]; const s = TH.openSpot(sp.x, sp.y, 20); TH.goto(s[0], s[1]); return Math.round(dist(s[0], s[1], sp.x, sp.y)); };
      window.CLEAN = () => { for (const e of G.ents) if (e.kind === 'animal' || e.lgKey) e.remove = true; G.ents = G.ents.filter(e => !e.remove); };
    });

    await t.step('veri: efsaneler, eşyalar, siparişler, başarımlar ve simgeler birbirini tutar', async () => {
      const r = await p.evaluate(() => {
        const bad = [];
        for (const [id, L] of Object.entries(LEGENDS)) {
          if (!ANIMALS[L.base]) bad.push(id + ': tür');
          if (!ITEMS[L.pelt] || ITEMS[L.pelt].legend !== id || ITEMS[L.pelt].c !== 'animal') bad.push(id + ': post');
          if (L.trophy && (!ITEMS[L.trophy] || ITEMS[L.trophy].c !== 'collect')) bad.push(id + ': ganimet');
          if (!L.when.every(k => LEGEND_WHEN[k])) bad.push(id + ': koşul');
          if (!TAILOR.some(r => ITEMS[r.id].legend === id && r.need[L.pelt] === 1)) bad.push(id + ': giysisi yok');
          if (!['tuft', 'scrape', 'carcass', 'hoof', 'slide'].includes(L.clue)) bad.push(id + ': iz');
        }
        for (const [id, F] of Object.entries(LEGEND_FISH)) {
          if (!ITEMS[F.item] || ITEMS[F.item].legend !== id || ITEMS[F.item].c !== 'food') bad.push(id + ': balık');
          if (!F.when.every(k => LEGEND_WHEN[k])) bad.push(id + ': koşul');
          if (/^fish_/.test(F.item)) bad.push(id + ': sıradan balık havuzuna karışır');
        }
        const sold = new Set(Object.values(SHOPS).flatMap(S => S.sell || []));
        for (const R of TAILOR) {
          const it = ITEMS[R.id];
          if (!it || !it.coat || !it.made || it.c !== 'clothing') bad.push(R.id + ': giysi değil');
          if (sold.has(R.id)) bad.push(R.id + ': dükkânda satılıyor');
          for (const k in R.need) if (!ITEMS[k]) bad.push(R.id + ': ' + k);
          if (!(R.fee > 0 && R.h > 0)) bad.push(R.id + ': ücret/süre');
        }
        for (const S of [...SATCHEL.slice(1), ...SADDLE.slice(1)]) for (const k in S.need) if (!ITEMS[k]) bad.push(S.n + ': ' + k);
        const ids = Object.keys(ITEMS).filter(k => /^lg_|^coat_(buck|wolf|cougar|gator|bison|bear|lg_)/.test(k));
        const noIcon = ids.filter(k => !ITEM_ICON[k]);
        return { bad, noIcon, n: ids.length, cap0: SADDLE[0].cap === HORSE_CAP, mul: SATCHEL.map(s => s.mul), caps: SADDLE.map(s => s.cap),
          ach: ['legend1', 'legend6', 'legendfish', 'tailor'].map(id => !!ACHIEVEMENTS.find(a => a.id === id)), svc: [BUILDINGS.tailor.svc.includes('order'), BUILDINGS.stable.svc.includes('saddle'), BUILDINGS.cabin.svc.includes('tales'), BUILDINGS.docks.svc.includes('tales')] };
      });
      t.eq(r.bad, [], 'tutarsızlık yok');
      t.eq(r.noIcon, [], 'her yeni eşyanın simgesi var');
      t.eq(r.n, 26, 'efsanevi eşyalar (6 post, 4 ganimet, 4 balık) ve dikilen giysiler (12)');
      t.ok(r.cap0, 'eyerin ilk basamağı HORSE_CAP');
      t.eq(r.mul, [1, 1.5, 2, 3], 'heybe basamakları'); t.eq(r.caps, [4, 6, 8], 'eyer basamakları');
      t.eq(r.ach, [true, true, true, true], 'başarımlar'); t.eq(r.svc, [true, true, true, true], 'hizmetler');
    });

    await t.step('yerler: altı in karada ve kasabalardan uzak, dört su kıyıdan ulaşılır; izler karada; her kurulumda aynı', async () => {
      const r = await p.evaluate(() => {
        const W = G.world, S = G.legendSpots(), out = { lairs: {}, fish: {}, clues: {} };
        for (const id in LEGENDS) {
          const s = S[id], town = Math.min(...W.towns.map(tw => dist(tw.cx, tw.cy, s.x, s.y)));
          out.lairs[id] = { land: !W.isWaterPx(s.x, s.y), town: town > 700, region: W.regionAt(s.x, s.y) };
          out.clues[id] = G.legendClues(id).map(c => !W.isWaterPx(c.x, c.y) && !W.blocked(c.x, c.y, 4));
        }
        for (const id in LEGEND_FISH) { const s = S[id]; out.fish[id] = s ? { water: W.tileAtPx(s.x, s.y) === T.WATER, heat: LEGEND_FISH[id].heat[0] <= W.climateAt(s.x, s.y) && W.climateAt(s.x, s.y) <= LEGEND_FISH[id].heat[1] } : null; }
        // aynı dünyada yeniden hesap aynı yerleri verir
        const o = Object.create(G); o.world = W; o._lgSp = null; const S2 = o.legendSpots();
        out.same = Object.keys(LEGENDS).concat(Object.keys(LEGEND_FISH)).every(id => S2[id] && S2[id].x === S[id].x && S2[id].y === S[id].y);
        return out;
      });
      for (const id in r.lairs) t.ok(r.lairs[id].land && r.lairs[id].town, `${id}: karada, kasabadan uzak`, r.lairs[id]);
      t.eq(r.lairs.ghost.region, 'Frostcrown', 'Ak Hayalet kuzeyin karlarında'); t.eq(r.lairs.tooth.region, 'Lowland Bayou', 'Yaşlı Diş bataklıkta');
      for (const id in r.clues) t.eq(r.clues[id], [true, true, true], `${id}: üç iz karada`);
      for (const id in r.fish) t.ok(r.fish[id] && r.fish[id].water && r.fish[id].heat, `${id}: sığ su, iklim tutuyor`, r.fish[id]);
      t.ok(r.same, 'yerler her hesapta aynı');
    });

    await t.step('söylenti çember açar, izler daraltır, üçüncü izde in bulunur; iz kendin bulunca da söylenti sayılır', async () => {
      const r = await p.evaluate(() => {
        const out = {};
        G.legends = {};
        const txt = WITH_RANDOM(0, () => G.legendRumor('beast'));   // ilk efsane: Ak Hayalet
        const id = Object.keys(G.legends)[0], sp = G.legendSpots()[id];
        out.id = id; out.txt = /Ak Hayalet/.test(txt) && /Frostcrown/.test(txt);
        const c0 = G.legendCircle(id);
        out.r0 = c0.r; out.in0 = dist(c0.x, c0.y, sp.x, sp.y) < c0.r;
        out.targets = G.legendTargets().map(x => x.n);
        // izler: yanına git, dünyada belirir, incele
        CLEAN(); AT_HOUR(12);
        const radii = [];
        G.legendClues(id).forEach((c, i) => {
          TH.goto(c.x + 14, c.y);
          G.legendTick();
          const e = G.ents.find(x => x.lgClue && x.lgClue.i === i && !x.remove);
          if (i === 0) out.acts = TH.actions();
          if (e) G.legendClue(e);
          const C = G.legendCircle(id); radii.push(C.r); if (C.r) out['in' + (i + 1)] = dist(C.x, C.y, sp.x, sp.y) < C.r;
        });
        out.radii = radii; out.found = G.lgR(id).f; out.exact = (() => { const C = G.legendCircle(id); return C.r === 0 && C.x === sp.x && C.y === sp.y; })();
        // söylentisi duyulmamış bir efsanenin izi: ilk iz söylenti sayılır
        G.legends = {}; CLEAN();
        const c = G.legendClues('scar')[0]; TH.goto(c.x + 14, c.y); G.legendTick();
        const e = G.ents.find(x => x.lgClue && x.lgClue.id === 'scar' && !x.remove); if (e) G.legendClue(e);
        out.selfFound = !!G.lgR('scar').r && (G.lgR('scar').c || []).length === 1;
        CLEAN();
        return out;
      });
      t.eq(r.id, 'ghost', 'söylenti bir efsaneyi işaretledi'); t.ok(r.txt, 'söylentide adı ve bölgesi');
      t.eq(r.r0, 1100, 'çember geniş başlar'); t.ok(r.in0, 'in çemberin içinde');
      t.ok(r.targets.includes('Ak Hayalet'), 'harita açıklamasında hedef', r.targets);
      t.ok(r.acts.includes('İzi İncele'), 'izin yanında İzi İncele', r.acts);
      t.eq(r.radii, [720, 440, 0], 'çember her izle daralır, üçüncüde in'); t.ok(r.in1 && r.in2, 'in daralan çemberin içinde');
      t.ok(r.found && r.exact, 'in haritada tam yerinde');
      t.ok(r.selfFound, 'izi kendin bulunca da söylenti sayılır');
    });

    await t.step('efsane yalnızca koşulu tutunca ininde belirir (sürüsüyle); kayda girmez; uzaklaşınca kaybolur', async () => {
      const r = await p.evaluate(() => {
        const out = {}; G.legends = {}; CLEAN();
        AT_HOUR(12); out.d = NEAR('ghost'); G.legendTick();
        out.dayNone = !LIVE('ghost'); out.hint = !!G.lgR('ghost').f;   // gündüz: in boş, ne zaman geldiği söylenir
        AT_HOUR(23); G.legendTick();
        const a = LIVE('ghost'); out.night = !!a;
        if (a) {
          out.def = [a.def.n, a.hp, a.def.col, a.type, a.keep];
          out.pack = G.ents.filter(e => e.lgPack === 'ghost' && e.leader === a).length;
          out.far = Math.round(dist(a.x, a.y, G.player.x, G.player.y));
          out.skip = [G.skipEnt(a), G.skipEnt(G.ents.find(e => e.lgPack === 'ghost'))];
          // tek: ikinci kez doğmaz
          G.legendTick(); out.one = G.ents.filter(e => e.legend === 'ghost' && !e.dead && !e.remove).length;
          // uzaklaşınca kaybolur
          TH.goto(a.x + 1700, a.y); G.legendTick(); out.gone = !LIVE('ghost');
        }
        CLEAN();
        // yağmurda gelen: Yaşlı Diş gece ya da yağmurda
        AT_HOUR(12); NEAR('tooth'); G.legendTick(); out.toothDry = !LIVE('tooth');
        G.weather.type = 'rain'; G.legendTick(); out.toothRain = !!LIVE('tooth');
        CLEAN(); G.weather.type = 'clear';
        return out;
      });
      t.ok(r.d < 650, 'inin yakınında', r.d);
      t.ok(r.dayNone && r.hint, 'gündüz in boş; in bulunur, vakti söylenir', r);
      t.ok(r.night, 'gece ininde belirdi');
      t.eq(r.def.slice(0, 4), ['Ak Hayalet', 260, '#e6e6e0', 'wolf'], 'efsanenin değerleri'); t.ok(r.def[4], 'uzakta da silinmez (keep)');
      t.eq(r.pack, 3, 'üç kurtluk sürüsüyle'); t.ok(r.far >= 200, 'oyuncunun dibinde doğmaz', r.far);
      t.eq(r.skip, [true, true], 'yaşayan efsane ve sürüsü kayda girmez'); t.eq(r.one, 1, 'tek efsane');
      t.ok(r.gone, 'uzaklaşınca kaybolur');
      t.ok(r.toothDry && r.toothRain, 'Yaşlı Diş kuru gündüz yok, yağmurda var', r);
    });

    await t.step('huylar: vurup çekilme, kudurma, vurulunca saldırma, ürkek olanın kaçınca o gün dönmemesi', async () => {
      const r = await p.evaluate(() => {
        const out = {}; G.legends = {}; CLEAN();
        AT_HOUR(23); NEAR('ghost'); G.legendTick(); const g = LIVE('ghost');
        WITH_RANDOM(0.1, () => g.hurt(10, 'player', 'gun')); out.hitRun = g.state;
        AT_HOUR(12); CLEAN(); NEAR('scar'); G.legendTick(); const s = LIVE('scar');
        const spd = s.def.spd; s.hurt(s.maxHp * 0.6, 'player', 'gun'); out.rage = [!!s.raged, Math.round(s.def.spd / spd * 100), s.state];
        out.baseSpd = ANIMALS.bear.spd === 98;   // efsanenin kopyası temel türü bozmaz
        CLEAN(); NEAR('iron'); G.legendTick(); const b = LIVE('iron');
        out.herd = G.ents.filter(e => e.lgPack === 'iron').length;
        b.hurt(20, 'player', 'gun'); out.charge = b.state;
        AT_HOUR(6); CLEAN(); NEAR('crown'); G.legendTick(); const c = LIVE('crown');
        out.crown = !!c;
        if (c) { c.state = 'flee'; c.x = G.player.x + 1000; c.y = G.player.y; G.legendTick(); out.fled = [!LIVE('crown'), G.lgR('crown').gone === G.day]; G.legendTick(); out.noBack = !LIVE('crown'); }
        CLEAN();
        return out;
      });
      t.eq(r.hitRun, 'flee', 'Ak Hayalet vurulunca çekilir');
      t.eq(r.rage, [true, 125, 'attack'], 'Yaralı Pençe canı yarıya inince kudurur'); t.ok(r.baseSpd, 'temel tür değişmez');
      t.eq(r.herd, 4, 'Demir Boynuz sürüsüyle'); t.eq(r.charge, 'attack', 'vurulunca kaçmaz, saldırır');
      t.ok(r.crown, 'Taç Boynuz şafakta'); t.eq(r.fled, [true, true], 'kaçınca kaybolur'); t.ok(r.noBack, 'o gün geri gelmez');
    });

    await t.step('avlanınca bir daha gelmez; yüzünce eşsiz post (büyüğü omza, kaybolmaz), ganimet ve iki kat et; leş kayıtta efsane kalır', async () => {
      const r = await p.evaluate(async () => {
        const out = {}, P = G.player; G.legends = {}; CLEAN(); P.carry = null;
        for (const k of ['lg_ghost_pelt', 'lg_scar_claw', 'raw_big']) P.inv[k] = 0;
        AT_HOUR(23); NEAR('ghost'); G.legendTick(); const g = LIVE('ghost');
        const s0 = G.stats.legends || 0;
        g.hurt(9999, 'player', 'gun');
        out.killed = [!!G.lgR('ghost').k, (G.stats.legends || 0) - s0];
        G.checkAchievements(); out.ach = !!G.achieved.legend1;
        TH.goto(g.x + 8, g.y); out.acts = TH.actions();
        TH.act(/Derisini Yüz/);
        out.pelt = P.count('lg_ghost_pelt'); out.keepAfter = g.keep;
        G.legendTick(); out.noRespawn = !LIVE('ghost') && !G.ents.some(e => e.lgClue && e.lgClue.id === 'ghost' && !e.remove);
        // büyük post: omza; ganimet ve et
        AT_HOUR(12); CLEAN(); NEAR('scar'); G.legendTick(); const s = LIVE('scar');
        s.hurt(9999, 'player', 'gun'); G.skin(s);
        out.carry = P.carry && [P.carry.kind, P.carry.id, P.carry.keep, P.carry.name];
        out.claw = P.count('lg_scar_claw'); out.meat = P.count('raw_big');
        // yüzülmemiş leş kayıttan efsane olarak döner
        CLEAN(); AT_HOUR(23); G.legends.tooth = {}; G.weather.type = 'rain'; NEAR('tooth'); G.legendTick(); const tz = LIVE('tooth');
        tz.hurt(9999, 'player', 'gun'); G.weather.type = 'clear';
        const S = G.saveEnts(); CLEAN(); G.loadEnts(S);
        const back = G.ents.find(e => e.kind === 'animal' && e.legend === 'tooth');
        out.saved = back && [back.dead, back.def.n, back.def.pelt[0], back.keep];
        // hikâyenin Yaşlı Kral'ı (legend: true, efsane kimliği yok): sıradan ayı postu, çökme yok
        P.carry = null; CLEAN();
        const ok = new Animal(P.x + 12, P.y, 'bear'); ok.legend = true; ok.keep = true; G.addEnt(ok); ok.hurt(9999, 'player', 'gun'); G.skin(ok);
        out.oldKing = [P.carry && P.carry.id, !!G.lgR('true').k];
        // sürüden ölen sıradan kurt kayda girer (yaşayanı girmez)
        const w = new Animal(P.x + 20, P.y, 'wolf'); w.lgPack = 'ghost'; G.addEnt(w); out.packLive = G.skipEnt(w); w.hurt(9999, 'player', 'gun'); out.packDead = G.skipEnt(w);
        P.carry = null; CLEAN();
        return out;
      });
      t.eq(r.oldKing, ['bear_pelt', false], 'hikâyenin Yaşlı Kral\'ı sıradan ayı postu verir'); t.eq([r.packLive, r.packDead], [true, false], 'sürünün leşi kayda girer');
      t.eq(r.killed, [true, 1], 'avlandı, sayıldı'); t.ok(r.ach, 'Efsane Avcısı başarımı');
      t.ok(r.acts.includes('Derisini Yüz'), 'leşte Derisini Yüz', r.acts);
      t.eq(r.pelt, 1, 'beyaz kurt postu çantada'); t.eq(r.keepAfter, false, 'yüzülen leş artık sıradan');
      t.ok(r.noRespawn, 'bir daha gelmez, izleri kalkar');
      t.eq(r.carry, ['pelt', 'lg_scar_pelt', true, 'Yaralı Pençe Postu'], 'büyük efsanevi post omuzda, kaybolmaz');
      t.eq(r.claw, 1, 'ganimet: pençe'); t.eq(r.meat, 8, 'iki kat et');
      t.eq(r.saved, [true, 'Yaşlı Diş', 'lg_tooth_skin', true], 'leş kayıttan efsane olarak döner');
    });

    await t.step('terzi: postundan giysi (çanta, omuz ve eyerden), ücret ve süre, teslim; giysinin etkisi', async () => {
      const r = await p.evaluate(() => {
        const out = {}, P = G.player;
        const b = G.world.buildings.find(x => x.type === 'tailor' && !x.shut);
        AT_HOUR(12); TH.inside(b); P.carry = null; P.money = 500;
        P.inv.wolf_pelt = 3; P.inv.coat_wolf = 0; P.coat = null; G.orders = [];
        UI.openBuilding(b); out.menu = TH.menuLabels(); TH.clickItem(/Postundan Diktir/); out.list = TH.menuLabels(); UI.closeAll();
        const m0 = P.money, c0 = G.clock;
        out.placed = G.placeOrder({ k: 'coat', id: 'coat_wolf' }, b);
        out.paid = Math.round((m0 - P.money) * 100) / 100; out.used = P.count('wolf_pelt');
        out.hours = Math.round((G.orders[0].ready - c0) / 60);
        out.again = G.orderWhy({ k: 'coat', id: 'coat_wolf' });
        out.early = G.collectOrder(G.orders[0]);
        G.clock += 25 * 60; G.legendTick(); out.told = !!G.orders[0].told;
        UI.openBuilding(b); out.readyMenu = ([...UI.top().el.querySelectorAll('.p-item')].find(n => /Postundan Diktir/.test(n.textContent)) || {}).textContent; TH.clickItem(/Postundan Diktir/); TH.clickItem(/Teslim Al/); UI.closeAll();
        out.got = P.count('coat_wolf'); out.left = G.orders.length;
        G.equipClothing('coat_wolf'); out.scent = G.coatFx('scent'); out.guard = G.coatFx('guard'); P.coat = null;
        // giysisizken ve etkisiz bir paltoda çarpanlar 1 (yılan zehri varsayılanı 0): hayvanlar, Odak ve dayanıklılık eskisi gibi
        const fx = () => ['scent', 'guard', 'aggro', 'sta', 'de'].map(k => G.coatFx(k)).concat(G.coatFx('venom', 0));
        out.bare = fx(); P.inv.coat_sheep = 1; P.coat = 'coat_sheep'; out.sheep = fx(); P.coat = null;
        // büyük post omuzdan: ayı postu kürk
        P.inv.fox_pelt = 1; P.carry = new Pelt(P.x, P.y, 'bear_pelt', 1);
        out.bearWhy = G.orderWhy({ k: 'coat', id: 'coat_bear' });
        G.placeOrder({ k: 'coat', id: 'coat_bear' }, b); out.carryUsed = P.carry === null;
        // eksik malzeme ve efsanevi giysi
        out.missing = G.orderWhy({ k: 'coat', id: 'coat_bison' });
        P.inv.lg_ghost_pelt = 1; P.inv.wolf_pelt = 2;
        out.legendOk = G.orderWhy({ k: 'coat', id: 'coat_lg_ghost' });
        G.orders = [];
        return out;
      });
      t.ok(r.menu.some(l => /Postundan Diktir/.test(l)), 'terzide seçenek', r.menu);
      t.ok(r.list.includes('Kurt Postu Palto') && r.list.includes('Ak Hayalet Pelerini') && r.list.includes('Deri Heybe'), 'giysiler ve heybe listede', r.list);
      t.ok(r.placed, 'sipariş verildi'); t.eq(r.paid, 5, 'ücret'); t.eq(r.used, 0, 'postlar alındı'); t.eq(r.hours, 24, 'bir günde hazır');
      t.ok(/hazırlanıyor/.test(r.again), 'ikinci kez verilmez', r.again); t.eq(r.early, false, 'hazır olmadan teslim alınmaz');
      t.ok(r.told, 'hazır olunca haber verilir'); t.ok(/hazır/.test(r.readyMenu), 'menüde hazır sayısı', r.readyMenu);
      t.eq([r.got, r.left], [1, 0], 'giysi teslim alındı');
      t.eq([r.scent, r.guard], [0.85, 1], 'kurt paltosu: hayvanlar geç fark eder');
      t.eq(r.bare, [1, 1, 1, 1, 1, 0], 'giysisizken etki yok'); t.eq(r.sheep, [1, 1, 1, 1, 1, 0], 'dükkân paltosunda ek etki yok');
      t.eq(r.bearWhy, '', 'omuzdaki ayı postu malzeme sayılır'); t.ok(r.carryUsed, 'omuzdaki post alındı');
      t.ok(/Eksik: Bizon Derisi/.test(r.missing), 'eksik malzeme söylenir', r.missing);
      t.eq(r.legendOk, '', 'efsanevi postla eşsiz giysi diktirilebilir');
    });

    await t.step('heybe eşyaların sınırını büyütür (alet ve belge aynı kalır); saraç eyerin yükünü büyütür', async () => {
      const r = await p.evaluate(() => {
        const out = {}, P = G.player;
        G.orders = []; G.gear = { bag: 0, saddle: 0 }; P.money = 500;
        const tl = G.world.buildings.find(x => x.type === 'tailor' && !x.shut);
        TH.inside(tl);
        out.cap0 = [P.cap('beans'), P.cap('wolf_pelt'), P.cap('fishing_rod'), P.cap('land_deed')];
        out.skip = G.orderWhy({ k: 'bag', tier: 2 });
        P.inv.deer_hide = 2; P.inv.prong_hide = 1;
        G.placeOrder({ k: 'bag', tier: 1 }, tl); G.clock += 13 * 60; G.collectOrder(G.orders[0]);
        out.cap1 = [P.cap('beans'), P.cap('wolf_pelt'), P.cap('fishing_rod'), P.cap('land_deed'), P.cap('dynamite')];
        P.inv.beans = 0; P.addItem('beans', 40, true); out.beans = P.count('beans');
        // eyer
        const st = G.world.buildings.find(x => x.type === 'stable' && !x.shut);
        TH.inside(st); UI.openBuilding(st); out.stMenu = TH.menuLabels().some(l => /Saraç/.test(l)); UI.closeAll();
        P.inv.deer_hide = 2; P.inv.boar_hide = 1;
        out.cap = [G.horseCap()];
        G.placeOrder({ k: 'saddle', tier: 1 }, st); G.clock += 13 * 60; G.collectOrder(G.orders[0]);
        out.cap.push(G.horseCap());
        const h = G.horse || (G.setHorse(new Horse(P.x + 10, P.y, 'morgan', { owner: 'player' }), true), G.horse);
        h.load = []; for (let k = 0; k < 6; k++) { P.carry = new Pelt(P.x, P.y, 'deer_hide', 1); h.x = P.x + 10; h.y = P.y; G.stowOnHorse(h); }
        out.loaded = h.load.length;
        P.carry = new Pelt(P.x, P.y, 'deer_hide', 1); out.full = G.stowOnHorse(h) === false; P.carry = null; h.load = [];
        const sv = G.saveLegends(); G.gear = { bag: 0, saddle: 0 }; G.loadLegends(sv); out.kept = [G.gear.bag, G.gear.saddle];
        return out;
      });
      t.eq(r.cap0, [10, 20, 1, 3], 'başlangıç sınırları'); t.ok(/önceki/.test(r.skip), 'basamak atlanmaz', r.skip);
      t.eq(r.cap1, [15, 30, 1, 3, 5], 'Deri Heybe: yığılanlar ×1,5; alet, belge, patlayıcı aynı'); t.eq(r.beans, 15, 'çanta yeni sınıra kadar dolar');
      t.ok(r.stMenu, 'ahırda saraç'); t.eq(r.cap, [4, 6], 'Yük Eyeri 6 taşır');
      t.eq(r.loaded, 6, 'altı post eyerde'); t.ok(r.full, 'yedinci sığmaz'); t.eq(r.kept, [1, 1], 'kayıtta kalır');
    });

    await t.step('efsanevi balık: yalnızca kendi suyunda ve vaktinde vurur; sert çeker, oltayla tutulur; misina koparsa o gün vurmaz', async () => {
      const r = await p.evaluate(async () => {
        const out = {}, P = G.player; G.legends = {}; CLEAN();
        const sp = G.legendSpots().jaw, W = G.world;
        // suyun kıyısında bir kara karesi
        let at = null;
        for (let rr = 12; rr < 160 && !at; rr += 6) for (let k = 0; k < 24 && !at; k++) { const x = sp.x + Math.cos(k / 24 * TAU) * rr, y = sp.y + Math.sin(k / 24 * TAU) * rr; if (!W.isWaterPx(x, y) && !W.blocked(x, y, 3)) at = [x, y]; }
        TH.goto(at[0], at[1]); P.addItem('fishing_rod', 1, true);
        AT_HOUR(12); out.noon = WITH_RANDOM(0, () => G.legendFishBite());
        AT_HOUR(19); out.dusk = WITH_RANDOM(0, () => G.legendFishBite());
        TH.goto(at[0] + 2000, at[1]); out.elsewhere = WITH_RANDOM(0, () => G.legendFishBite()); TH.goto(at[0], at[1]);
        // gerçek oyun: Input taklidiyle at, bekle, vurunca çek, gerginliğe göre sar
        const I = Input, d0 = I.down, p0 = I.pressed, r0 = I.released, bite0 = G.legendFishBite;
        let hold = false, press = false, rel = false;
        I.down = k => k === 'confirm' && hold; I.pressed = k => k === 'confirm' && press; I.released = k => k === 'confirm' && rel;
        const fish = async (strategy) => {
          UI.startFishing(); const m = UI.top(); m.born = -10;
          const step = (dt) => { G.t += dt; m.update(dt); press = false; rel = false; };   // oyun saati akar (balığın çekişi dalgalanır)
          hold = true; for (let k = 0; k < 20; k++) step(0.05); hold = false; rel = true; step(0.05);   // at
          G.legendFishBite = () => 'jaw';
          for (let k = 0; k < 400 && !m.el.querySelector('.f-msg.big'); k++) step(0.05);   // vurana kadar bekle
          press = true; step(0.05);
          let maxT = 0, surge = false;
          for (let k = 0; k < 4000; k++) {
            const bar = m.el.querySelector('.f-bar.tension i'); if (!bar) break;
            const ten = parseFloat(bar.style.width) / 100; maxT = Math.max(maxT, ten);
            if (m.el.querySelector('.f-surge')) surge = true;
            hold = strategy(ten, !!m.el.querySelector('.f-surge'));
            step(0.05);
          }
          hold = false;
          const msg = m.el.innerText.replace(/\s+/g, ' ');
          UI.closeAll(); G.legendFishBite = bite0;
          return { msg, surge, maxT };
        };
        AT_HOUR(19);
        out.greedy = await fish(() => true);                       // hep sararsan misina kopar
        out.lostToday = G.legendFishBite === bite0 && WITH_RANDOM(0, () => G.legendFishBite());
        G.legends.jaw.lost = -1;                                     // ertesi gün gibi
        P.inv.lg_fish_jaw = 0; const f0 = G.stats.legendFish || 0;
        out.calm = await fish((ten, sg) => !sg && ten < 0.55);       // gerginliğe göre sar, atılımda gevşet
        out.item = P.count('lg_fish_jaw'); out.rec = [!!G.lgR('jaw').k, (G.stats.legendFish || 0) - f0];
        const kg = G.lgR('jaw').kg; out.kg = kg >= LEGEND_FISH.jaw.kg[0] && kg <= LEGEND_FISH.jaw.kg[1];
        out.after = WITH_RANDOM(0, () => G.legendFishBite());
        I.down = d0; I.pressed = p0; I.released = r0;
        return out;
      });
      t.eq([r.noon, r.dusk, r.elsewhere], [null, 'jaw', null], 'Demir Çene yalnızca akşam alacasında, kendi suyunda vurur');
      t.ok(/Misina koptu! Demir Çene/.test(r.greedy.msg), 'hep sararsan misina kopar', r.greedy.msg);
      t.eq(r.lostToday, null, 'misina koptuysa o gün vurmaz');
      t.ok(/Demir Çene tuttun/.test(r.calm.msg), 'gerginliğe göre sararsan tutulur', r.calm.msg);
      t.ok(r.calm.surge, 'arada kaçmaya atılır');
      t.eq(r.item, 1, 'balık çantada'); t.eq(r.rec, [true, 1], 'tutuldu, sayıldı'); t.ok(r.kg, 'ağırlığı aralıkta');
      t.eq(r.after, null, 'bir kez tutulur');
    });

    await t.step('anlatanlar ve harita: tuzakçı ve liman söylenti verir, bilinenler biter; harita çizimi hatasız', async () => {
      const r = await p.evaluate(() => {
        const out = {}; G.legends = {}; G.player.money = 50;
        const m0 = G.player.money;
        UI.legendTales('beast'); out.beast = Object.keys(G.legends).filter(k => LEGENDS[k]).length; out.text = (UI.top() && UI.top().el.innerText) || ''; UI.closeAll();
        out.paid = Math.round((m0 - G.player.money) * 100) / 100;
        for (const id of Object.keys(LEGENDS)) G.lg(id).r = 1;
        const m1 = G.player.money; UI.legendTales('beast'); out.done = (UI.top() && UI.top().el.innerText) || ''; UI.closeAll(); out.free = m1 === G.player.money;
        UI.legendTales('fish'); out.fish = Object.keys(G.legends).filter(k => LEGEND_FISH[k]).length; UI.closeAll();
        // harita: çember, bilinen in, avlanmış olan
        G.lg('scar').k = 1; G.lg('scar').f = 1; G.lg('gold').f = 1;
        UI.openMap(); const ok = !!document.querySelector('#map-legend'); UI.closeAll();
        out.map = ok;
        return out;
      });
      t.eq(r.beast, 1, 'tuzakçı bir av efsanesi anlatır'); t.ok(/Haritanda/.test(r.text), 'haritaya işlendi', r.text); t.eq(r.paid, 0.5, 'ücret');
      t.ok(/bütün av hikâyelerini/.test(r.done) && r.free, 'hepsi biliniyorsa para alınmaz', r.done);
      t.eq(r.fish, 1, 'liman bir balık efsanesi anlatır');
      t.ok(r.map, 'harita açıldı');
    });

    t.eq(errs, [], 'sayfa hatası yok');
  },
};
