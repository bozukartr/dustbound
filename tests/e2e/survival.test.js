'use strict';
/* Hayatta kalma süreçleri: ateş ve sıcak yemek yalnızca rahat bir sıcaklığa (26 °C) dek ısıtır, ateş başında uyurken
   sıcaktan ölünmez; uyku ve bekleme tehlikede bölünür. Sıcak ve soğuk birikmiş yükle üç aşamada ağırlaşır (1: susuzluk
   ya da açlık hızlanır; 2: yavaş yürüme, titreyen el, can dolmaz; 3: can gider), içeride ve su içince hafifler. Can
   bitmek üzereyken önce bayılırsın: saatler sonra kendine gelirsin ya da yoldan geçen biri doktora götürür (aranırken
   kimse yardım etmez); yakında yine düşersen ölürsün. Yolculukta bayılıp ölünmez; yük, zehir ve bayılma kayda geçer. */
module.exports = {
  name: 'Hayatta kalma',
  timeout: 300000,
  async run(t) {
    const p = await t.newGame();
    await p.evaluate(() => {
      UI.closeAll(); G.godMode = false;
      const s = TH.openSpot(); TH.goto(s[0], s[1]); TH.clearNpcs();
      window.spot = s;
      if (G.horse) { G.horse.x = s[0] + 400; G.horse.y = s[1]; }
      // uzun benzetimlerde yeni hayvan, yolcu ve rastgele olay doğmaz (gece bir kurt saldırısı ölçülen hasarı bozmasın); olanlar kaldırılır
      G.spawnTick = () => {}; for (const e of G.ents) if (e.kind === 'animal') e.remove = true;
      window.amb0 = G.ambientTemp;
      window.setTemp = v => { G.ambientTemp = () => v; G._feltOk = false; };
      window.reset = (temp = 18) => {
        const P = G.player; UI.closeAll(); G.state = 'play'; TH.goto(spot[0], spot[1]);
        P.poison = 0; P.sick = 0; P.painT = 0; P.faintCd = 0; P.hunger = P.thirst = P.energy = 80; P.hp = P.maxHp;
        P.coat = null; P.look.hat = 'none'; P.warmBuff = 0; P.coolT = 0; P.riding = null; G.law.level = 0;
        G.heatLoad = G.coldLoad = 0; G.fireHeat = 0; G.nearFire = false; if (G.envCache) G.envCache.rain = 0;
        setTemp(temp); G.survivalUpdate(1, false);
        UI.el.help.classList.add('hidden');
      };
      window.helpText = () => (UI.el.help.classList.contains('hidden') ? '' : UI.el.help.innerText.replace(/\s+/g, ' '));
      // gösterilen yardım mesajları (oyunun kendi ipuçları üstüne yazabilir)
      window.helps = []; const help0 = UI.help; UI.help = function (m) { helps.push(String(m).replace(/<[^>]*>/g, '')); return help0.apply(this, arguments); };
      window.hintTick0 = G.hintTick; G.hintTick = () => {};
      window.fadeText = () => document.querySelector('#fader-text').textContent;
      // ekran kararması bitene dek bekle (uyku, bekleme, bayılma)
      window.fadeDone = () => new Promise(r => { const k = setInterval(() => { if (!UI.state && G.state === 'play') { clearInterval(k); r(); } }, 50); });
      // bayılmanın iki rastlantısı (baygın kalınan saat, yardımın gelmesi) sabitlenir; geri kalan her şey rastgele kalır
      window.fixFaint = (v) => { const fw = G.faintWake; G.faintWake = function (c) { const r0 = Math.random; let k = 0; Math.random = () => (k++ < 2 ? v : r0()); try { return fw.call(this, c); } finally { Math.random = r0; G.faintWake = fw; } }; };
      window.walk = (fn) => { const mv0 = Input.moveVec; Input.moveVec = () => ({ x: 1, y: 0, m: 1, kb: true }); try { return fn(); } finally { Input.moveVec = mv0; } };
      UI.showDeath = () => {};
    });

    await t.step('ateş ve sıcak yemek yalnızca 26 °C\'ye dek ısıtır', async () => {
      const r = await p.evaluate(() => {
        const out = {};
        for (const a of [-10, 15, 30, 38]) { reset(a); G.fireHeat = 18; G._feltOk = false; G.survivalUpdate(31, false); out[a] = Math.round(G.feltTemp * 10) / 10; }
        reset(30); G.player.warmBuff = 60; G._feltOk = false; G.survivalUpdate(31, false); out.meal = G.feltTemp;
        reset();
        return out;
      });
      t.eq([r[-10], r[15], r[30], r[38]], [8, 26, 30, 38], 'ateş: soğukta +18, ılıkta 26\'ya dek, sıcakta hiç');
      t.eq(r.meal, 30, 'sıcak yemek de sıcakta ısıtmaz');
    });

    await t.step('ılık bir gecede ateş başında 8 saat uyku: uyku bölünmez, can gitmez', async () => {
      const r = await p.evaluate(async () => {
        reset(30); const P = G.player; G.fireHeat = 18; P.hp = P.maxHp * 0.8; const hp0 = P.hp, c0 = G.clock;
        G.sleep(8, 'camp'); await fadeDone();
        const out = { hp0, hp: P.hp, hours: (G.clock - c0) / 60, heat: G.heatLoad, help: helpText() };
        reset();
        return out;
      });
      t.near(r.hours, 8, 0.01, '8 saat uyudu');
      t.ok(r.hp > r.hp0, 'can doldu', r);
      t.eq(r.heat, 0, 'sıcak yükü yok');
      t.ok(!/Uykun bölündü/.test(r.help), 'bölünmedi', r.help);
    });

    await t.step('kızgın sıcakta uyku, ayazda bekleme 2. aşamada bölünür; can gitmez', async () => {
      const r = await p.evaluate(async () => {
        const P = G.player, out = {};
        reset(44); let hp0 = P.hp, c0 = G.clock;
        G.sleep(8, 'camp'); await new Promise(res => setTimeout(res, 800)); out.fade = fadeText(); await fadeDone();
        out.sleep = { hours: (G.clock - c0) / 60, stage: G.heatStage, lost: hp0 - P.hp, help: helpText() };
        reset(-25); hp0 = P.hp; c0 = G.clock;
        G.passTime(6); await fadeDone();
        out.wait = { hours: (G.clock - c0) / 60, stage: G.coldStage, lost: hp0 - P.hp, help: helpText() };
        reset(18); P.thirst = 8; c0 = G.clock;
        G.sleep(8, 'camp'); await fadeDone();
        out.thirst = { hours: (G.clock - c0) / 60, thirst: P.thirst, help: helpText() };
        reset();
        return out;
      });
      t.ok(r.sleep.hours < 4 && r.sleep.stage === 2, 'sıcaktan uyandı (2. aşama)', r.sleep);
      t.ok(r.sleep.lost <= 0.01, 'can gitmedi', r.sleep);
      t.eq(r.fade, 'Uykun bölündü...', 'ekrandaki yazı');
      t.ok(/Uykun bölündü\. Sıcak bunalttı/.test(r.sleep.help), 'sebep ve öneri', r.sleep.help);
      t.ok(r.wait.hours < 3 && r.wait.stage === 2 && r.wait.lost <= 0.01, 'ayazda bekleme bölündü', r.wait);
      t.ok(/Beklemeyi bıraktın\. Titriyorsun/.test(r.wait.help), 'sebep ve öneri', r.wait.help);
      t.ok(r.thirst.hours < 8 && r.thirst.thirst <= 5 && /Boğazın kurudu/.test(r.thirst.help), 'susuzluktan uyandı', r.thirst);
    });

    await t.step('sıcak aşamaları: yük birikir, 2. aşamada yavaşlar ve el titrer, 3. aşamada can gider', async () => {
      const r = await p.evaluate(() => {
        const P = G.player, out = { t2: null, t3: null };
        reset(42); P.thirst = P.hunger = 100;
        const e = G.hotness, gain = SURV.GAIN[0] + SURV.GAIN[1] * e;
        out.e = e; out.want2 = SURV.LOAD2 / gain; out.want3 = SURV.LOAD3 / gain;
        let hpAt3 = null;
        for (let m = 10; m <= 6 * 60; m += 10) {
          G.survivalUpdate(10, false);
          if (out.t2 === null && G.heatStage >= 2) { out.t2 = m / 60; out.hp2 = P.hp; out.reg2 = G.survRates(false).reg; out.worn = G.worn; }
          if (out.t3 === null && G.heatStage >= 3) { out.t3 = m / 60; hpAt3 = P.hp; }
        }
        out.lost3 = hpAt3 - P.hp; out.hours3 = 6 - out.t3; out.rate = SURV.HEAT_DMG[0] + SURV.HEAT_DMG[1] * e;
        // yürüyüş: bitkinken yavaş
        const go = () => walk(() => { TH.goto(spot[0], spot[1]); P.vx = P.vy = 0; const x0 = P.x; for (let f = 0; f < 45; f++) G.update(1 / 30); return P.x - x0; });
        G.heatLoad = 1.5; out.walkWorn = go(); G.heatLoad = 0; out.walk = go();
        // nişan: en uç sapma (Math.random = 1) bitkinken 1,5 kat
        P.giveWeapon('cattleman', true); P.weapon = 'cattleman';
        const shot = () => { P.clip.cattleman = 6; P.fireCd = 0; P.aiming = true; P.aimSteady = 0; let a = null; const fr = G.fireRay, rnd0 = Math.random; G.fireRay = (x, y, ang) => { a = ang; }; Math.random = () => 1; try { const sa = P.shotAng(); P.shoot(); return a - sa; } finally { G.fireRay = fr; Math.random = rnd0; P.aiming = false; } };
        G.heatLoad = 1.5; out.aimWorn = shot(); G.heatLoad = 0; out.aim = shot();
        reset();
        return out;
      });
      t.ok(r.e > 0.5, 'kızgın sıcak', r.e);
      t.near(r.t2, r.want2, 0.17, '2. aşamaya varış (yük eşiği / saatlik birikim)');
      t.near(r.t3, r.want3, 0.17, '3. aşamaya varış');
      t.eq(r.hp2, 100, '2. aşamaya dek can gitmez');
      t.ok(r.worn && r.reg2 === 0, '2. aşamada can dolmaz', r);
      t.near(r.lost3, r.rate * r.hours3, 1, '3. aşamada saatte 3 + 7 × şiddet can');
      t.near(r.walkWorn / r.walk, 0.88, 0.03, 'bitkinken %12 yavaş yürür');
      t.near(r.aimWorn / r.aim, 1.5, 0.01, 'bitkinken nişan dağılımı 1,5 kat');
    });

    await t.step('yük içeride ve ateş başında hızlı, dışarıda yavaş azalır; su ve sıcak içecek hafifletir', async () => {
      const r = await p.evaluate(() => {
        reset(); const P = G.player, out = {};
        out.slow = G.loadStep(2, 0, 1, false); out.fast = G.loadStep(2, 0, 1, true);
        G.nearFire = true; out.fireCold = G.loadFast('cold', false, 0); out.fireHeat = G.loadFast('heat', false, 0); G.nearFire = false;
        G.heatLoad = 2; P.addItem('canteen', 1, true); P.canteen = 2; G.drinkCanteen(); out.drink = G.heatLoad;
        G.coldLoad = 2; P.addItem('coffee', 1, true); G.consume('coffee'); out.coffee = G.coldLoad;
        reset();
        return out;
      });
      t.eq([r.slow, r.fast], [1.5, 0.5], 'saatte 0,5 ya da 1,5 azalır');
      t.ok(r.fireCold && !r.fireHeat, 'ateş yalnızca soğuğun yükünü hızlı azaltır');
      t.near(r.drink, 1.6, 0.001, 'matara: sıcak yükü −0,4'); t.near(r.coffee, 1.6, 0.001, 'kahve: soğuk yükü −0,4');
    });

    await t.step('HUD: aşamaya göre simge ve açıklama', async () => {
      const r = await p.evaluate(() => {
        reset(); const icons = () => [...document.querySelectorAll('#status-icons span')].map(s => [s.title, s.classList.contains('blink')]);
        G.hotness = 0.5; UI.hudUpdate(); const h1 = icons();
        G.heatLoad = 1.2; UI.hudUpdate(); const h2 = icons();
        G.heatLoad = 2.7; UI.hudUpdate(); const h3 = icons();
        reset(); G.coldness = 0.4; G.coldLoad = 1.2; UI.hudUpdate(); const c2 = icons();
        reset(); UI.hudUpdate();
        return { h1, h2, h3, c2 };
      });
      const f = (L, re) => L.find(([t]) => re.test(t));
      t.ok(f(r.h1, /^Sıcak basıyor$/) && !f(r.h1, /^Sıcak basıyor$/)[1], '1. aşama: yanıp sönmez', r.h1);
      t.ok(f(r.h2, /^Sıcaktan bitkinsin/) && f(r.h2, /^Sıcaktan bitkinsin/)[1], '2. aşama: yanıp söner', r.h2);
      t.ok(f(r.h3, /^Sıcak çarpması: can gidiyor/), '3. aşama', r.h3);
      t.ok(f(r.c2, /^Titriyorsun/), 'soğuk 2. aşama', r.c2);
    });

    await t.step('bayılma: olduğun yerde kendine gelirsin; yakında yine düşersen ölürsün', async () => {
      const r = await p.evaluate(async () => {
        reset(); const P = G.player, out = {};
        P.thirst = 0; P.hp = P.maxHp * 0.12;
        fixFaint(0.99);   // kimse gelmez, 4 saat baygın
        let f = 0; while (G.state === 'play' && f < 30 * 120) { G.update(1 / 30); f++; }
        out.state = G.state; out.hpF = P.hp / P.maxHp; out.fade = fadeText(); const c0 = G.clock, x0 = P.x, y0 = P.y;
        await fadeDone();
        Object.assign(out, { hours: (G.clock - c0) / 60, moved: Math.hypot(P.x - x0, P.y - y0), hp: P.hp / P.maxHp, cd: P.faintCd, help: helpText(), faints: G.stats.faints });
        // yakında yine: bayılmadan ölür
        f = 0; while (G.state === 'play' && f < 30 * 200) { G.update(1 / 30); f++; }
        out.died = G.state; out.cause = G.deathCause;
        reset();
        return out;
      });
      t.eq(r.state, 'faint', 'can %10\'a inince bayıldı');
      t.near(r.hpF, 0.1, 0.01, 'bayılırken can');
      t.eq(r.fade, 'Bayıldın...', 'ekrandaki yazı');
      t.near(r.hours, 4, 0.05, '4 saat baygın kaldı');
      t.ok(r.moved < 1, 'olduğu yerde', r.moved);
      t.near(r.hp, 0.15, 0.005, '%15 canla kendine geldi');
      t.ok(r.cd > 700, 'yeniden bayılamama süresi', r.cd);
      t.ok(/Bayıldın; 4 saat sonra olduğun yerde kendine geldin\. Hemen su bulmalısın\./.test(r.help) && /bu kez ölebilirsin/.test(r.help), 'mesaj', r.help);
      t.ok(r.faints >= 1, 'istatistik');
      t.eq([r.died, r.cause], ['dead', 'susuzluk'], 'bu kez bayılmadan öldü');
    });

    await t.step('bayılma: yoldan geçen biri doktora götürür; aranırken kimse yardım etmez', async () => {
      const r = await p.evaluate(async () => {
        const P = G.player, out = {};
        const faintNow = async (wanted) => {
          reset(); P.thirst = 0; P.hp = P.maxHp * 0.11; P.money = 5; P.poison = 100; G.heatLoad = 2.6;
          fixFaint(0.01);   // yardım gelir (gelebiliyorsa), 2 saat baygın
          let f = 0; while (G.state === 'play' && f < 30 * 60) { G.update(1 / 30); f++; }
          if (wanted) G.law.level = 1;
          try { await fadeDone(); } finally { G.law.level = 0; }
          const tw = G.nearestTown(P.x, P.y, t => t.buildings.some(b => b.type === 'doctor')), doc = tw.buildings.find(b => b.type === 'doctor');
          return { atDoc: Math.hypot(P.x - doc.door.x, P.y - (doc.door.y + 10)) < 1, money: P.money, hp: P.hp / P.maxHp, thirst: P.thirst, poison: P.poison, heat: G.heatLoad, help: helpText(), town: tw.n };
        };
        out.rescue = await faintNow(false);
        out.wanted = await faintNow(true);
        reset();
        return out;
      });
      t.ok(r.rescue.atDoc, 'doktorun kapısında', r.rescue);
      t.eq(r.rescue.money, 2, 'doktor $3 aldı');
      t.ok(r.rescue.hp >= 0.499 && r.rescue.thirst >= 39.9 && r.rescue.poison === 0 && r.rescue.heat === 0, 'ayıltıldı ve tedavi edildi', r.rescue);
      t.ok(r.rescue.help.includes(`Yoldan geçen biri seni baygın bulup ${r.rescue.town} doktoruna getirdi.`), 'mesaj', r.rescue.help);
      t.ok(!r.wanted.atDoc && r.wanted.money === 5, 'aranırken kimse götürmez', r.wanted);
      t.near(r.wanted.heat, 1.5, 0.01, 'kendine gelince yük 2. aşamaya iner');
    });

    await t.step('yolculukta bayılıp ölünmez; yük, zehir ve bayılma süresi kayda geçer', async () => {
      const r = await p.evaluate(() => {
        reset(); const P = G.player, out = {};
        P.thirst = 0; P.hp = P.maxHp * 0.12;
        G.survivalUpdate(8 * 60, false, true);
        out.travel = { state: G.state, hp: P.hp / P.maxHp };
        reset(); P.poison = 200; P.faintCd = 300; G.heatLoad = 1.25; G.coldLoad = 0.5;
        G.saveGame(true); const d = JSON.parse(Platform.get(slotKey(G.slot, 'auto')));
        out.saved = { poison: d.player.poison, cd: d.player.faintCd, loads: d.loads };
        reset();
        return out;
      });
      t.eq(r.travel.state, 'play', 'yolculukta bayılmadı, ölmedi');
      t.near(r.travel.hp, 0.1, 0.001, 'can %10\'da tutuldu');
      t.eq(r.saved, { poison: 200, cd: 300, loads: [1.25, 0.5] }, 'kayıtta');
    });

    await t.step('İngilizce', async () => {
      const r = await p.evaluate(async () => {
        I18N.setLang('en');
        reset(44); const P = G.player; helps.length = 0;
        G.sleep(8, 'camp'); await fadeDone(); const a = helps.join(' | ');
        reset(); G.hotness = 0.5; G.heatLoad = 1.2; UI.hudUpdate(); const b = [...document.querySelectorAll('#status-icons span')].map(s => s.title).join(' | ');
        reset(); I18N.setLang('tr'); UI.hudUpdate();
        return { a, b };
      });
      t.ok(/Your sleep was cut short\. The heat is too much/.test(r.a), 'uyku bölündü', r.a);
      t.ok(/Heat exhaustion: you're slower/.test(r.b), 'HUD', r.b);
    });

    await p.evaluate(() => { G.ambientTemp = amb0; G.hintTick = hintTick0; });
  },
};
