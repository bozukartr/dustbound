'use strict';
/* Zehir: Yılan Yağı da Panzehir gibi zehri söker. Zehir içten içe tüketir: kan akıtmaz, ekranı sarsmaz, ata geçmez.
   Zehirliyken ten solgunlaşır, ter damlar, hafifçe sendeler ve ara ara öğürür (iki büklüm, neredeyse durur, iki kez
   safra; atta öğürmez); ekrana yeşil, nabız gibi atan bir kenar gelir. Ölüm sebepleri: attan düşme, ödül avcısı
   kurşunu, zehirlenme. */
module.exports = {
  name: 'Zehir',
  timeout: 240000,
  async run(t) {
    const p = await t.newGame();
    await p.evaluate(() => {
      UI.closeAll(); G.godMode = false;
      const s = TH.openSpot(); TH.goto(s[0], s[1]); TH.clearNpcs();
      window.spot = s;
      if (G.horse) { G.horse.x = s[0] + 400; G.horse.y = s[1]; }
      const P = G.player; P.hp = P.maxHp; P.poison = 0;
      window.clearParts = () => { const L = G.parts.list; while (L.length) G.parts.pool.push(L.pop()); };
      window.countParts = (type) => G.parts.list.filter(q => q.type === type).length;
      // sn kadar oyunu 30 kare/sn ilerlet; draw: her karede çiz (ekran efekti çizimde güncellenir)
      window.run = (sec, draw) => { for (let f = 0; f < Math.round(sec * 30); f++) { G.update(1 / 30); if (draw) G.render(1 / 30); } };
      // girdi yerine sabit yön: doğuya yürü
      window.walk = (fn) => { const mv0 = Input.moveVec; Input.moveVec = () => ({ x: 1, y: 0, m: 1, kb: true }); try { return fn(); } finally { Input.moveVec = mv0; } };
      // ölüm ekranı açılmasın: sebep G.deathCause'ta okunur
      UI.showDeath = () => {};
    });

    await t.step('Yılan Yağı zehri tamamen söker (Panzehir gibi); zehirsizken "zehir yitirdi" yazmaz', async () => {
      const r = await p.evaluate(() => {
        const P = G.player, out = {};
        P.addItem('snake_oil', 2, true); P.addItem('antidote', 1, true);
        P.poison = 60; TH.feeds.length = 0;
        out.used = G.consume('snake_oil'); out.after = P.poison; out.feed = TH.feeds.some(f => /Zehir etkisini yitirdi/.test(f));
        TH.feeds.length = 0; G.consume('snake_oil');
        out.idleFeed = TH.feeds.some(f => /Zehir etkisini yitirdi/.test(f));
        P.poison = 60; G.consume('antidote'); out.antidote = P.poison;
        out.side = UI.itemSide(ITEMS.snake_oil).replace(/<[^>]*>/g, ' ');
        return out;
      });
      t.ok(r.used, 'yılan yağı kullanıldı');
      t.eq(r.after, 0, 'zehir tamamen geçti');
      t.ok(r.feed, 'zehrin geçtiği yazıldı');
      t.ok(!r.idleFeed, 'zehirsizken zehir mesajı yok');
      t.eq(r.antidote, 0, 'panzehir de söker');
      t.ok(/Zehri yok eder/.test(r.side), 'eşya kartında yazar', r.side);
    });

    await t.step('zehir kan akıtmaz, ekranı sarsmaz, ata geçmez; canı yine de azaltır', async () => {
      const r = await p.evaluate(() => {
        const P = G.player, out = {}, hunger0 = P.hunger;
        P.hunger = 15;   // açken can kendiliğinden dolmaz: yalnızca zehrin hasarı ölçülür
        P.hp = P.maxHp; clearParts(); G.fx.flash = 0; G.fx.shake = 0;
        P.poison = 30; P.retchCd = 99;
        const hp0 = P.hp; let shake = 0, flash = 0, sweat = 0;
        // ter damlası yere değince kaybolur (~0,3 sn): kare kare en çok görüleni say
        for (let f = 0; f < 60; f++) { G.update(1 / 30); shake = Math.max(shake, G.fx.shake); flash = Math.max(flash, G.fx.flash); sweat = Math.max(sweat, countParts('drop')); }
        out.lost = hp0 - P.hp; out.blood = countParts('blood'); out.shake = shake; out.flash = flash; out.sweat = sweat;
        // atta: zehir hasarı ata geçmez (eskiden her karede %25 olasılıkla ata yansırdı)
        let h = G.horse; if (!h || h.dead) { h = new Horse(P.x, P.y, 'mustang', { owner: 'player' }); G.addEnt(h); G.setHorse(h, true); }
        h.x = P.x; h.y = P.y; h.hp = h.maxHp; P.mount(h, true);
        const hh0 = h.hp, ph0 = P.hp;
        run(1);
        out.horseLost = hh0 - h.hp; out.riderLost = ph0 - P.hp;
        P.dismount(); P.poison = 0; P.hp = P.maxHp; P.hunger = hunger0; h.x = P.x + 400;
        return out;
      });
      t.near(r.lost, 3.2, 0.3, '2 sn zehir: 1,6/sn');
      t.eq(r.blood, 0, 'kan parçacığı yok');
      t.ok(r.shake < 0.01 && r.flash < 0.01, 'sarsıntı ve kırmızı parlama yok', r);
      t.ok(r.sweat > 0, 'ter damlıyor', r.sweat);
      t.eq(r.horseLost, 0, 'at zarar görmez');
      t.near(r.riderLost, 1.6, 0.2, 'atta da binici zehirden etkilenir');
    });

    await t.step('zehirliyken öğürür: iki büklüm, neredeyse durur, iki kez safra; atta öğürmez', async () => {
      const r = await p.evaluate(() => {
        const P = G.player, out = {};
        TH.goto(spot[0], spot[1]); clearParts();
        P.hp = P.maxHp; P.poison = 40; P.retchT = 0; P.retchCd = 0.05;
        let f0 = -1;
        for (let f = 0; f < 30 && f0 < 0; f++) { G.update(1 / 30); if (P.retchT > 0) f0 = f; }
        out.started = f0 >= 0;
        let heave = 0, frames = 0;
        while (P.retchT > 0 && frames < 60) { G.update(1 / 30); heave = Math.max(heave, P.heave); frames++; }
        out.frames = frames; out.heave = heave; out.bile = countParts('bile'); out.cd = P.retchCd;
        // safra yere düşüp orada kalır (sekmez)
        run(0.5); const b = G.parts.list.filter(q => q.type === 'bile');
        out.landed = b.length > 0 && b.every(q => q.z === 0 && q.vx === 0 && q.vy === 0);
        // öğürürken yürüyüş: neredeyse durur
        const dist = (retch) => walk(() => {
          TH.goto(spot[0], spot[1]); P.vx = P.vy = 0; P.retchCd = 99;
          const x0 = P.x;
          for (let f = 0; f < 20; f++) { if (retch) P.retchT = Player.RETCH * 0.5; G.update(1 / 30); }
          P.retchT = 0;
          return P.x - x0;
        });
        out.walkNormal = dist(false); out.walkRetch = dist(true);
        // atta öğürmez, biraz sonra yeniden dener
        let h = G.horse; h.x = P.x; h.y = P.y; P.mount(h, true);
        P.retchT = 0; P.retchCd = 0;
        run(0.5);
        out.rideRetch = P.retchT; out.rideCd = P.retchCd;
        P.dismount(); P.poison = 0; h.x = P.x + 400;
        return out;
      });
      t.ok(r.started, 'öğürme başladı');
      t.near(r.frames, 27, 2, 'yaklaşık 0,9 sn sürer');
      t.ok(r.heave > 1, 'gövde öne kasılır', r.heave);
      t.eq(r.bile, 10, 'iki kasılmada beşer damla safra');
      t.ok(r.cd >= 4 && r.cd <= 7.2, 'sonraki öğürme 5-8 sn sonra (öğürme süresi düşülmüş)', r.cd);
      t.ok(r.landed, 'safra yere düşüp kalır');
      t.ok(r.walkRetch < r.walkNormal * 0.5, 'öğürürken neredeyse durur', r);
      t.eq(r.rideRetch, 0, 'atta öğürmez');
      t.ok(r.rideCd > 0.3, 'atta öğürme ertelenir', r.rideCd);
    });

    await t.step('zehirliyken hafifçe sendeler; zehir yokken dümdüz yürür', async () => {
      const r = await p.evaluate(() => {
        const P = G.player;
        // sendeleme açısı zamana bağlı: belirgin olduğu bir ana ilerle (yalnızca ileri)
        const wob = (x) => (Math.sin(x * 1.9) + Math.sin(x * 0.73 + 1.3)) * 0.1;
        let tt = G.t; while (wob(tt) < 0.15) tt += 0.02; G.t = tt;
        const drift = (poison) => walk(() => {
          TH.goto(spot[0], spot[1]); P.vx = P.vy = 0; P.poison = poison; P.retchCd = 99;
          const y0 = P.y; let m = 0;
          for (let f = 0; f < 15; f++) { G.update(1 / 30); m = Math.max(m, Math.abs(P.y - y0)); }
          return m;
        });
        const sick = drift(30), well = drift(0);
        P.poison = 0;
        return { sick, well };
      });
      t.ok(r.sick > 1, 'zehirliyken yan yana kayar', r);
      t.ok(r.well < 0.05, 'zehir yokken düz', r);
    });

    await t.step('görüntü: ten solgunlaşır, ekrana yeşil kenar gelir, iki çizimde de öğürme hatasız çizilir', async () => {
      const r = await p.evaluate(() => {
        const P = G.player, out = {};
        TH.goto(spot[0], spot[1]);
        P.poison = 0; const base = P.lookNow();
        P.poison = 30; const sick = P.lookNow();
        out.diff = sick !== base && sick.skin !== base.skin; out.same = P.lookNow() === sick;
        out.coatSame = sick.coat === base.coat && sick.hat === base.hat;
        // ekran efekti: zehirliyken yükselir, geçince söner (çizimle güncellenir)
        const gfx0 = G.settings.gfx;
        P.retchCd = 99; run(2, true); out.fxOn = FX.g.poison;
        // iki çizimde de öğürme pozu (çömelme + öne kasılma) ve safra
        for (const gfx of [0, 1]) { G.settings.gfx = gfx; G.applySettings(); P.retchT = Player.RETCH; for (let f = 0; f < 27; f++) { G.update(1 / 30); G.render(1 / 30); } }
        G.settings.gfx = gfx0; G.applySettings();
        P.poison = 0; out.cured = P.lookNow() === base;
        run(3, true); out.fxOff = FX.g.poison;
        return out;
      });
      t.ok(r.diff, 'zehirliyken ten rengi değişir');
      t.ok(r.same, 'zehirli görünüm aynı nesne kalır (melez önbelleği için)');
      t.ok(r.coatSame, 'yalnızca ten değişir');
      t.ok(r.cured, 'zehir geçince eski görünüm');
      t.ok(r.fxOn > 0.3, 'yeşil ekran efekti yükselir', r.fxOn);
      t.ok(r.fxOff < 0.12, 'zehir geçince söner', r.fxOff);
    });

    await t.step('ölüm sebepleri: attan düşme, ödül avcısı kurşunu, kanun, zehirlenme', async () => {
      const r = await p.evaluate(() => {
        const P = G.player, out = {};
        const revive = () => { G.state = 'play'; P.hp = P.maxHp; P.poison = 0; G.deathCause = null; TH.goto(spot[0], spot[1]); };
        // attan düşme
        revive(); let h = G.horse; h.dead = false; h.x = P.x; h.y = P.y; P.mount(h, true); P.hp = 5; P.dismount(true);
        out.fall = G.deathCause; h.x = P.x + 400;
        // ödül avcısı ve şerif kurşunu
        const shoot = (role) => {
          revive(); P.hp = 5;
          const n = new NPC(P.x - 40, P.y, role, { hostile: true, weapon: 'cattleman' }); G.addEnt(n);
          G.fireRay(n.x, n.y, 0, 120, 50, n, { npc: true }); n.remove = true;
          return G.deathCause;
        };
        out.hunter = shoot('hunter'); out.law = shoot('law'); out.bandit = shoot('bandit');
        // zehirlenme: kansız
        revive(); clearParts(); P.hp = 1; P.poison = 10; run(2);
        out.poison = G.deathCause; out.poisonBlood = countParts('blood');
        revive(); G.ents = G.ents.filter(e => !e.remove);
        return out;
      });
      t.eq(r.fall, 'attan düşme', 'attan düşünce');
      t.eq(r.hunter, 'ödül avcısı kurşunu', 'ödül avcısı vurunca');
      t.eq(r.law, 'kanun adamlarının kurşunu', 'şerif vurunca');
      t.eq(r.bandit, 'haydut kurşunu', 'haydut vurunca');
      t.eq(r.poison, 'zehirlenme', 'zehirden');
      t.eq(r.poisonBlood, 0, 'zehirden ölümde kan yok');
    });
  },
};
