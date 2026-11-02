'use strict';
/* Uzun oynanış taraması: dünyanın her kasabası ve bölgesi, günün farklı saatleri ve havalar, at sırtında ve yaya,
   bina içleri, çatışma ve aranma, uyku ve bekleme, kayıt-yükleme, iki çizim ve İngilizce. Her durumda oyun hatasız
   çalışır (sayfa ya da konsol hatası yok; çalıştırıcı bunları ayrıca yakalar), oyuncu, kamera, canlılar ve hayatta
   kalma değerleri sayı kalır (NaN ya da sonsuz yok) ve arayüzde "NaN", "undefined" ya da "[object Object]" yazmaz. */
module.exports = {
  name: 'Uzun oynanış taraması',
  timeout: 900000,
  async run(t) {
    const p = await t.newGame();
    await p.evaluate(() => {
      UI.closeAll(); G.godMode = true; UI.showDeath = () => {};
      window.bad = [];
      const fin = v => typeof v === 'number' && isFinite(v);
      window.check = (tag) => {
        const P = G.player;
        const vals = { x: P.x, y: P.y, can: P.hp, dayanıklılık: P.sta, odak: P.de, açlık: P.hunger, susuzluk: P.thirst, uyku: P.energy, para: P.money,
          kameraX: G.cam.x, kameraY: G.cam.y, hissedilen: G.feltTemp, sıcakYük: G.heatLoad, soğukYük: G.coldLoad, saat: G.clock };
        for (const k in vals) if (!fin(vals[k])) bad.push(`${tag}: ${k} = ${vals[k]}`);
        for (const e of G.ents) if (!e.remove && (!fin(e.x) || !fin(e.y))) { bad.push(`${tag}: ${e.kind}/${e.role || e.type || ''} konumu ${e.x}, ${e.y}`); break; }
        const txt = document.getElementById('hud').innerText;
        const m = txt.match(/.{0,30}(NaN|undefined|\[object Object\]).{0,30}/);
        if (m) bad.push(`${tag}: arayüzde «${m[0].replace(/\s+/g, ' ')}»`);
      };
      // sn kadar oyna: 30 kare/sn, her üç karede bir çiz; sonunda arayüzü güncelle ve denetle
      window.play = (sec, tag) => {
        for (let f = 0; f < Math.round(sec * 30); f++) { if (UI.isModal()) UI.closeAll(); G.update(1 / 30); if (f % 3 === 0) G.render(1 / 30); }
        UI.hudUpdate(); UI.dangerCard(); check(tag);
      };
      window.setHour = h => { G.clock = Math.floor(G.clock / 1440) * 1440 + h * 60; };
      window.setWeather = type => { G.weather.type = type; G.weather.t = 300; };
      window.go = (x, y) => { UI.closeAll(); G.state = 'play'; TH.goto(x, y); G.prefetch(true); };
      // kasaba dışında, verilen zemin türünde, engelsiz bir nokta (dünya taranarak)
      window.spotOf = (types) => {
        const W = G.world, R = new RNG(77 + types[0]);
        for (let k = 0; k < 6000; k++) {
          const x = R.range(600, WW * TS - 600), y = R.range(600, WH * TS - 600);
          if (!types.includes(W.tileAtPx(x, y)) || W.townAt(x, y, 120) || W.blocked(x, y, 8) || W.isWaterPx(x, y)) continue;
          return [x, y];
        }
        return null;
      };
    });

    await t.step('her kasaba, gündüz ve gece, değişen havayla', async () => {
      const r = await p.evaluate(() => {
        const W = ['clear', 'rain', 'cloudy', 'storm', 'fog'];
        G.world.towns.forEach((tw, i) => { setHour(i % 2 ? 22 : 11); setWeather(W[i % W.length]); go(tw.spawn.x, tw.spawn.y); play(2, `${tw.n} ${i % 2 ? 'gece' : 'gündüz'}`); });
        return { n: G.world.towns.length, bad };
      });
      t.ok(r.n >= 10, 'kasabalar', r.n);
      t.eq(r.bad, [], 'sorun yok');
    });

    await t.step('bölgeler: çöl, kızıl kaya, kar, orman, çayır, bataklık; öğlen ve gece', async () => {
      const r = await p.evaluate(() => {
        const out = [];
        for (const [n, types] of [['çöl', [T.DESERT]], ['kızıl kaya', [T.REDROCK]], ['kar', [T.SNOW]], ['orman', [T.FOREST]], ['çayır', [T.GRASS]], ['bataklık', [T.SWAMP, T.MUD]]]) {
          const s = spotOf(types);
          if (!s) { out.push(n + ': yer bulunamadı'); continue; }
          for (const h of [13, 2]) { setHour(h); setWeather(h === 13 ? 'clear' : 'rain'); go(s[0], s[1]); play(3, `${n} ${h}:00`); }
          out.push(n);
        }
        return { out, bad };
      });
      t.ok(!r.out.some(x => /bulunamadı/.test(x)), 'her bölgede bir yer', r.out);
      t.eq(r.bad, [], 'sorun yok');
    });

    await t.step('at sırtında dörtnala, yaya koşu; at ve oyuncu ilerler', async () => {
      const r = await p.evaluate(() => {
        const P = G.player, s = spotOf([T.GRASS, T.DRY]); setHour(10); setWeather('clear'); go(s[0], s[1]);
        let h = G.horse; if (!h || h.dead) { h = new Horse(P.x, P.y, 'mustang', { owner: 'player' }); G.addEnt(h); G.setHorse(h, true); }
        h.dead = false; h.hp = h.maxHp; h.x = P.x; h.y = P.y; P.mount(h, true);
        // klavyeyle dizgin: W ileri (yön girdisi), Shift dörtnala
        const d0 = Input.down, mvq = Input.moveVec, x0 = P.x, y0 = P.y;
        Input.down = k => k === 'sprint' || d0.call(Input, k); Input.moveVec = () => ({ x: 0, y: -1, m: 1, kb: true });
        try { play(5, 'at sırtında'); } finally { Input.down = d0; Input.moveVec = mvq; }
        const ride = Math.hypot(P.x - x0, P.y - y0);
        P.dismount();
        const mv0 = Input.moveVec, x1 = P.x, y1 = P.y;
        Input.moveVec = () => ({ x: 1, y: 0.3, m: 1, kb: true });
        try { play(3, 'yaya'); } finally { Input.moveVec = mv0; }
        return { ride, walk: Math.hypot(P.x - x1, P.y - y1), bad };
      });
      t.ok(r.ride > 100, 'at ilerledi', r.ride);
      t.ok(r.walk > 40, 'oyuncu yürüdü', r.walk);
      t.eq(r.bad, [], 'sorun yok');
    });

    await t.step('bina içleri: saloon, otel, dükkân, doktor, şerif, banka, postane', async () => {
      const r = await p.evaluate(() => {
        const tw = G.world.towns.slice().sort((a, b) => b.buildings.length - a.buildings.length)[0], seen = [];
        setHour(15);
        for (const type of ['saloon', 'hotel', 'store', 'doctor', 'sheriff', 'bank', 'post']) {
          const b = tw.buildings.find(x => x.type === type);
          if (!b) continue;
          UI.closeAll(); TH.inside(b); play(1.5, `${tw.n} ${type}`); seen.push(type);
        }
        return { seen, bad };
      });
      t.ok(r.seen.length >= 5, 'bina türleri', r.seen);
      t.eq(r.bad, [], 'sorun yok');
    });

    await t.step('çatışma ve aranma: haydutlar, kurt, kanun adamları', async () => {
      const r = await p.evaluate(() => {
        const P = G.player, s = spotOf([T.GRASS, T.DRY]); setHour(16); go(s[0], s[1]);
        P.giveWeapon('cattleman', true); P.weapon = 'cattleman'; P.ammo.pistol = 60; P.clip.cattleman = 6;
        for (const dx of [-120, 140]) G.addEnt(new NPC(P.x + dx, P.y + 40, 'bandit', { hostile: true, weapon: 'cattleman' }));
        G.addEnt(new Animal(P.x + 90, P.y - 80, 'wolf'));
        play(4, 'çatışma');
        G.law.level = 2; play(4, 'aranırken');
        G.law.level = 0; G.law.bounty = 0;
        for (const e of G.ents) if (e.kind === 'npc' && (e.hostile || e.role === 'law')) e.remove = true;
        play(1, 'çatışmadan sonra');
        return { bad };
      });
      t.eq(r.bad, [], 'sorun yok');
    });

    await t.step('kamp, uyku ve bekleme; zaman atlayınca değerler sayı kalır', async () => {
      const r = await p.evaluate(async () => {
        const P = G.player, s = spotOf([T.GRASS, T.FOREST]); setHour(21); go(s[0], s[1]);
        P.hunger = P.thirst = P.energy = 60;
        const fade = () => new Promise(res => { const k = setInterval(() => { if (!UI.state && G.state === 'play') { clearInterval(k); res(); } }, 50); });
        G.sleep(8, 'camp'); await fade(); check('uykudan sonra');
        G.passTime(3); await fade(); check('beklemeden sonra');
        play(2, 'sabah');
        return { bad };
      });
      t.eq(r.bad, [], 'sorun yok');
    });

    await t.step('kaydet ve yükle: oyun kaldığı yerden hatasız sürer', async () => {
      const r = await p.evaluate(async () => {
        const P = G.player; setHour(12); const x = P.x, y = P.y;
        G.saveGame(true); const ok = await G.loadGame(G.slot, 'auto');
        const Q = G.player, same = Math.hypot(Q.x - x, Q.y - y) < 2;
        UI.closeAll(); play(3, 'yüklemeden sonra');
        return { ok, same, state: G.state, bad };
      });
      t.ok(r.ok && r.state === 'play', 'yüklendi', r);
      t.ok(r.same, 'aynı yerde');
      t.eq(r.bad, [], 'sorun yok');
    });

    await t.step('kaynaklar sınırlı: canlı ve parçacık sayısı, kayıt boyutu', async () => {
      const r = await p.evaluate(() => {
        const s = spotOf([T.GRASS, T.DRY]); go(s[0], s[1]);
        let ents = 0, parts = 0;
        for (let k = 0; k < 10; k++) { play(3, 'kaynaklar ' + k); ents = Math.max(ents, G.ents.length); parts = Math.max(parts, G.parts.list.length); }
        G.saveGame(true);
        const size = (Platform.get(slotKey(G.slot, 'auto')) || '').length;
        return { ents, parts, size, heap: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null, bad };
      });
      t.ok(r.ents < 600, 'canlı sayısı sınırlı', r);
      t.ok(r.parts < 3000, 'parçacık sayısı sınırlı', r);
      t.ok(r.size < 2 * 1024 * 1024, 'kayıt 2 MB\'ın altında', r.size);
      t.eq(r.bad, [], 'sorun yok');
    });

    await t.step('Klasik çizim ve İngilizce arayüz', async () => {
      const r = await p.evaluate(() => {
        const gfx0 = G.settings.gfx, tw = G.world.towns[0];
        G.settings.gfx = 1; G.applySettings(); setHour(19); go(tw.spawn.x, tw.spawn.y); play(2, 'Klasik çizim');
        G.settings.gfx = gfx0; G.applySettings();
        I18N.setLang('en'); play(2, 'İngilizce'); UI.openJournal(0); const j = document.querySelector('.journal').innerText; UI.closeAll();
        I18N.setLang('tr'); play(0.5, 'Türkçeye dönüş');
        const m = j.match(/.{0,30}(NaN|undefined|\[object Object\]).{0,30}/);
        if (m) bad.push('Günlük (İngilizce): «' + m[0].replace(/\s+/g, ' ') + '»');
        return { bad };
      });
      t.eq(r.bad, [], 'sorun yok');
    });
  },
};
